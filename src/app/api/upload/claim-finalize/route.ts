import { NextResponse } from "next/server";
import { z } from "zod";

import { processImage } from "@/server/images/pipeline";
/*
 * Imported as a namespace on purpose: every call below is visibly a call across
 * the storage boundary, and exactly one line in this file computes a key.
 */
import * as storage from "@/server/images/r2";
/*
 * Aliased so the resolver's name appears exactly once here, matching
 * `src/server/images/claim-upload.ts` — the two files perform the SAME
 * authorization and a grep for that resolver is the audit that proves it.
 */
import { findOrderByTrackingToken as findOrder } from "@/server/orders/tracking";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

/**
 * CHK-04 step 3 of 3 — derive and store a payment-claim screenshot for a caller
 * with no account.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A SECOND ROUTE AND NOT A BRANCH IN THE PRODUCT ONE.
 * ---------------------------------------------------------------------------
 * `src/app/api/upload/finalize/route.ts` authorizes with
 * `requireMerchantContext()` and then re-checks the trial write gate. An
 * anonymous customer can satisfy neither, so the only way to serve them from
 * that file would be to widen its authorization to "a session OR a tracking
 * token". That is the one-more-branch change that makes a tenant boundary
 * unreadable: every later edit to that route would have to establish which of
 * two credentials was in force on the line being changed. Two routes, one
 * credential each, is the version a reviewer can check.
 *
 * That sibling route says the same thing from its own side — it deliberately
 * leaves the claim namespace out and names this plan as the owner.
 *
 * ---------------------------------------------------------------------------
 * THE THREE STEPS, AND WHY THE MIDDLE ONE IS NOT HERE.
 * ---------------------------------------------------------------------------
 *   1. `requestClaimScreenshotUpload` mints a five-minute presigned PUT for one
 *      key, one content type and one exact byte count.
 *   2. The BROWSER puts the bytes straight at that URL with exactly the signed
 *      `Content-Type`. Those bytes never transit this application: Next 16 caps
 *      Server Action bodies at 1 MB, which a phone screenshot routinely
 *      exceeds. There is nothing to build for this step; that is the point of
 *      it.
 *   3. THIS ROUTE reads the stored original back, derives the single WebP
 *      rendition the `claim` preset describes, writes it beside the original
 *      and reports the prefix it was written under.
 *
 * ---------------------------------------------------------------------------
 * IT RE-AUTHORIZES. FINALIZE IS NOT A CONTINUATION OF THE MINT.
 * ---------------------------------------------------------------------------
 * A Route Handler is every bit as reachable by a direct POST as a Server Action
 * is, and nothing carries state between the two calls. So the store is resolved
 * and the token is checked again, identically — a caller who could finalize
 * without holding the link could spend compute processing another customer's
 * upload, and would learn from the response whether that upload existed.
 *
 * ---------------------------------------------------------------------------
 * NODE RUNTIME. DO NOT ADD A `runtime` EXPORT.
 * ---------------------------------------------------------------------------
 * This route reaches `processImage`, which imports Sharp, which is a binding
 * over native libvips. The Edge runtime cannot load native binaries, so pinning
 * this route away from Node is a hard crash on first use rather than a slow
 * path (T-03-26). Node is the Next.js default — the failure mode is ADDING the
 * line, not omitting it, so there is deliberately nothing here to omit.
 *
 * ---------------------------------------------------------------------------
 * IT WRITES NO DATABASE ROW, AND THAT IS THE CONTRACT (D-07).
 * ---------------------------------------------------------------------------
 * `submitClaim` writes the claim row's screenshot key, because `submitClaim` is
 * the caller that knows whether the claim itself succeeded. A screenshot stored
 * against a claim that was then refused for a duplicate reference would be a
 * row pointing at evidence for a payment nobody is asserting. Persistence
 * belongs to whoever owns the entity, and that is never this file.
 *
 * ---------------------------------------------------------------------------
 * ERRORS CARRY A CODE, NEVER A KEY AND NEVER A URL (T-03-27, ASVS V7).
 * ---------------------------------------------------------------------------
 * A presigned URL is a bearer capability; an object key is a map of the bucket.
 * Neither belongs in a response body. The codes below are the entire error
 * surface, and the caller does not need more: it already knows which upload it
 * asked about.
 */

/**
 * Thirty seconds. Deriving one WebP rendition from a few-megabyte screenshot
 * completes in low hundreds of milliseconds, so this is a ceiling on pathology
 * — a slow storage read, a hostile input that survived the pixel limit — not a
 * budget the happy path spends. It is also the second half of the
 * decompression-bomb defence (T-03-25).
 */
export const maxDuration = 30;

/**
 * The body. An upload id, and the two values that re-establish who is asking.
 * There is deliberately no field naming a key or a path.
 */
const claimFinalizeSchema = z.object({
  slug: z.string().min(1).max(64),
  token: z.string().min(1).max(64),
  uploadId: z.string().min(1).max(64),
});

type ErrorCode =
  | "invalid_request"
  | "not_found"
  | "unprocessable_image"
  | "storage_unavailable";

const fail = (code: ErrorCode, status: number): NextResponse =>
  NextResponse.json({ error: code }, { status });

/** True for the AWS SDK's "the object is not there" shapes, as opposed to "R2 is unwell". */
function isMissingObject(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const name = "name" in error ? String(error.name) : "";
  if (name === "NoSuchKey" || name === "NotFound") return true;
  const metadata = "$metadata" in error ? error.$metadata : undefined;
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "httpStatusCode" in metadata &&
    metadata.httpStatusCode === 404
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_request", 400);
  }

  const parsed = claimFinalizeSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid_request", 400);
  }

  const { slug, token, uploadId } = parsed.data;

  /*
   * The authorization, restated rather than inherited. Both misses answer 404
   * and neither says which one happened — the same collapse the mint action
   * makes, for the same reason.
   */
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return fail("not_found", 404);

  const order = await findOrder(tenant.id, token);
  if (!order) return fail("not_found", 404);

  /*
   * The one place a key is produced, from the resolved tenant and the id. A
   * malformed id throws here rather than producing a key, so the catch treats
   * it as a bad request and not as a storage fault.
   */
  let originalKey: string;
  try {
    originalKey = storage.objectKeyFor(tenant.id, "claims", uploadId);
  } catch {
    return fail("invalid_request", 400);
  }

  let original: Buffer;
  try {
    original = await storage.getObjectBuffer(originalKey);
  } catch (error) {
    // A customer whose direct PUT never completed lands here; so does a
    // replayed finalize for an id that was never minted. Both are 404, and
    // neither response says which object was looked for.
    return isMissingObject(error)
      ? fail("not_found", 404)
      : fail("storage_unavailable", 502);
  }

  let derived;
  try {
    /*
     * `claim` and not `product`: a payment screenshot is EVIDENCE, and the
     * preset preserves its aspect ratio precisely because a square crop can cut
     * away the transaction reference the merchant has to read off it.
     */
    derived = await processImage(original, "claim");
  } catch {
    // Undecodable bytes, a format Sharp refuses, or an image over the pixel
    // limit. All of them are the caller's input, so all of them are 4xx.
    return fail("unprocessable_image", 422);
  }

  const single = derived.at(0);
  if (!single) {
    return fail("unprocessable_image", 422);
  }

  const prefix = storage.derivativePrefixFor(originalKey);

  try {
    await storage.putObject(
      `${prefix}/${single.label}.webp`,
      single.body,
      single.contentType,
    );
  } catch {
    return fail("storage_unavailable", 502);
  }

  /*
   * The PREFIX, never the original. Everything that renders this screenshot
   * appends a derivative name to it, so the unprocessed uploaded bytes are
   * never addressable — which is the whole reason the re-encode exists
   * (T-03-28).
   */
  return NextResponse.json({ storageKey: prefix });
}
