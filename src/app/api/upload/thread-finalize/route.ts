import { NextResponse } from "next/server";
import { z } from "zod";

import { processImage } from "@/server/images/pipeline";
/*
 * Imported as a namespace on purpose: every call below is visibly a call
 * across the storage boundary, and exactly one line in this file computes a
 * key — the same convention `finalize/route.ts` and `claim-finalize/route.ts`
 * already use.
 */
import * as storage from "@/server/images/r2";
import { requireMerchantContext } from "@/server/merchant/context";

/**
 * ADM-05 step 3 of 3 — derive and store a support-thread image attachment,
 * for a signed-in merchant.
 *
 * ---------------------------------------------------------------------------
 * THE MERCHANT DOOR ONLY. THE ADMIN DOOR HAS ITS OWN SIBLING ROUTE.
 * ---------------------------------------------------------------------------
 * `src/server/images/thread-upload.ts`'s two mint doors are matched by two
 * finalize routes, not one: this file for the merchant door, and
 * `src/app/api/upload/admin-thread-finalize/route.ts` (plan 06-12) for the
 * admin door that `/admin/support/[tenantId]`'s attach affordance now calls.
 * Building a single branching route here — "the admin context, or the
 * merchant context, chosen by whether the body names a target tenant" —
 * would be exactly the one-more-branch shape `thread-upload.ts`'s own header
 * rejects for the mint step: the credential in force would be buried in a
 * runtime conditional instead of visible at an export. `finalize/route.ts`
 * sets the same precedent for the product/logo pair — "the `claims` kind is
 * deliberately not handled here... that path is a later plan's action" —
 * and both of these routes follow it. Plan 06-15's subscription-receipt
 * upload (the `subscriptions` namespace) finalizes through this same
 * merchant-door route rather than a third one, because the credential is
 * unchanged — a merchant session — and only the write-gate exception below
 * differs by kind.
 *
 * ---------------------------------------------------------------------------
 * IT RE-AUTHORIZES. FINALIZE IS NOT A CONTINUATION OF THE MINT.
 * ---------------------------------------------------------------------------
 * A Route Handler is every bit as reachable by a direct POST as a Server
 * Action is, and nothing carries state between the mint call and this one.
 * `requireMerchantContext()` is called here, fresh, exactly as
 * `finalize/route.ts` does for product and logo uploads — a caller who could
 * finalize without a live merchant session could spend compute deriving
 * images for a tenant they no longer (or never did) belong to.
 *
 * `ctx.canWrite` is re-checked explicitly (D-08 / SUB-02) for the `threads`
 * kind: `merchantAction` enforces the trial write gate for the MINT step,
 * but this Route Handler sits outside that wrapper, and a five-minute
 * presigned grant obtained before a trial expired must not be convertible
 * into a stored object after it has.
 *
 * The `subscriptions` kind is the deliberate exception, mirroring
 * `requestSubscriptionReceiptUpload`'s own `mode: "read"` mint
 * (`src/server/images/thread-upload.ts`) and `submitSubscriptionPayment`'s
 * header (`src/server/subscription/actions.ts`, T-06-78): an expired-trial
 * merchant is exactly the merchant a subscription receipt exists for, so
 * this route re-checking `canWrite` unconditionally would silently convert
 * the mint step's own trial-lockout fix back into a lockout at finalize
 * time. The check below runs AFTER the body is parsed for this reason — it
 * needs `kind` to know which of the two rules applies.
 *
 * ---------------------------------------------------------------------------
 * NODE RUNTIME. DO NOT ADD A `runtime` EXPORT.
 * ---------------------------------------------------------------------------
 * This route reaches `processImage`, which imports Sharp, which is a binding
 * over native libvips. The Edge runtime cannot load native binaries, so
 * pinning this route to Edge is a hard crash on first use rather than a slow
 * path (T-03-26/T-06-53). Node is the Next.js default — the failure mode is
 * ADDING the line, not omitting it, so there is deliberately nothing here to
 * omit.
 *
 * ---------------------------------------------------------------------------
 * IT NEVER ACCEPTS A KEY (T-03-23).
 * ---------------------------------------------------------------------------
 * The body carries an upload id and a namespace `kind`; the key is
 * recomputed from the session-resolved tenant. A caller who could name a key
 * could read and overwrite any object in the bucket with a single string
 * field. The upload id alone cannot escape the caller's own prefix, and the
 * key builder throws on anything that tries.
 *
 * ---------------------------------------------------------------------------
 * THIS ROUTE WRITES NO DATABASE ROW (D-07's reuse contract, restated).
 * ---------------------------------------------------------------------------
 * `postMerchantMessage` (`src/server/support/messages.ts`) writes the
 * `SupportAttachment` row, because it is the caller that knows whether the
 * message itself succeeded. An attachment row pointing at a message that was
 * never sent would be evidence for a conversation that does not exist; an
 * orphaned R2 object is cheap and this route leaves it to become one rather
 * than guess at persistence it cannot see the outcome of.
 *
 * ---------------------------------------------------------------------------
 * ERRORS CARRY A CODE, NEVER A KEY AND NEVER A URL (T-03-27, ASVS V7).
 * ---------------------------------------------------------------------------
 * A presigned URL is a bearer capability; an object key is a map of the
 * bucket. Neither belongs in a response body. The codes below are the entire
 * error surface, and the caller does not need more: it already knows which
 * upload it asked about.
 */

/**
 * Thirty seconds, matching `finalize/route.ts` and `claim-finalize/route.ts`.
 * Deriving one WebP rendition from a few-megabyte screenshot completes in low
 * hundreds of milliseconds, so this is a ceiling on pathology — a slow
 * storage read, a hostile input that survived the pixel limit — not a budget
 * the happy path spends. It is also the second half of the
 * decompression-bomb defence (T-03-25).
 */
export const maxDuration = 30;

/**
 * The body. An upload id and the namespace it was minted under — never a key,
 * a path, or a file name. `kind` mirrors the mint schema's own union so a
 * receipt upload (plan 06-15) finalizes through this same shape once its own
 * merchant-side UI exists.
 */
const threadFinalizeSchema = z.object({
  uploadId: z.string().min(1).max(64),
  kind: z.enum(["threads", "subscriptions"]),
});

type ErrorCode =
  | "invalid_request"
  | "read_only"
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
  /*
   * Authorization first, and outside every try below: the merchant DAL
   * redirects rather than returning, and a redirect is signalled by a thrown
   * control-flow error that must not be caught and relabelled as a storage
   * failure — the same discipline `finalize/route.ts` documents at its own
   * call site.
   */
  const ctx = await requireMerchantContext();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_request", 400);
  }

  const parsed = threadFinalizeSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid_request", 400);
  }

  // See this file's header: every kind except `subscriptions` stays
  // write-gated; a subscription receipt is the one upload an expired-trial
  // merchant must still be able to finalize.
  if (parsed.data.kind !== "subscriptions" && !ctx.canWrite) {
    return fail("read_only", 403);
  }

  /*
   * The one place a key is produced, from the session's tenant and the id. A
   * malformed id throws here rather than producing a key, so the catch below
   * treats it as a bad request and not as a storage fault.
   */
  let originalKey: string;
  try {
    originalKey = storage.objectKeyFor(
      ctx.tenantId,
      parsed.data.kind,
      parsed.data.uploadId,
    );
  } catch {
    return fail("invalid_request", 400);
  }

  let original: Buffer;
  try {
    original = await storage.getObjectBuffer(originalKey);
  } catch (error) {
    // A merchant who never completed the direct PUT lands here; so does a
    // replayed finalize for an id that was never minted. Both are 404, and
    // neither response says which key was looked for.
    return isMissingObject(error)
      ? fail("not_found", 404)
      : fail("storage_unavailable", 502);
  }

  let derived;
  try {
    /*
     * `thread`, not `product`: a support-thread attachment is evidence, the
     * same as a payment-claim screenshot, and the preset preserves its aspect
     * ratio precisely so a square crop cannot cut away whatever detail the
     * merchant or the owner needs to read off it.
     */
    derived = await processImage(original, "thread");
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
   * The PREFIX, never the original. Everything that renders this attachment
   * appends a derivative name to it, so the unprocessed uploaded bytes are
   * never addressable — which is the whole reason the re-encode exists
   * (T-06-48). `width`/`height`/`contentType`/`byteSize` are read back from
   * what Sharp actually produced, never from what the browser claimed, so the
   * caller persists the real, verified figures.
   */
  return NextResponse.json({
    storageKey: prefix,
    width: single.width,
    height: single.height,
    contentType: single.contentType,
    byteSize: single.body.byteLength,
  });
}
