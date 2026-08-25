import { NextResponse } from "next/server";
import { z } from "zod";

import { processImage } from "@/server/images/pipeline";
/*
 * Imported as a namespace on purpose: every call below is visibly a call across
 * the storage boundary, and exactly one line in this file computes a key.
 */
import * as storage from "@/server/images/r2";
import { requireMerchantContext } from "@/server/merchant/context";

/**
 * CAT-02 step 3 of 3 — derive and store.
 *
 * ---------------------------------------------------------------------------
 * THE THREE STEPS, AND WHY THE MIDDLE ONE IS NOT HERE.
 * ---------------------------------------------------------------------------
 *   1. `requestProductImageUpload` mints a five-minute presigned PUT for one key
 *      and one content type.
 *   2. The BROWSER does a plain `PUT` of the file bytes straight to that URL,
 *      with the exact `Content-Type` that was signed — R2 answers
 *      403 SignatureDoesNotMatch on any other value. Those bytes never transit
 *      Vercel compute. Next 16 caps Server Action bodies at 1 MB, which a phone
 *      photo routinely exceeds, and raising `serverActions.bodySizeLimit` would
 *      only route megabytes through metered compute to reach the same bucket.
 *      There is nothing to build for this step; that is the point of it.
 *   3. THIS ROUTE reads the uploaded original back, derives the fixed set of
 *      WebP renditions, writes them beside the original and reports what was
 *      stored.
 *
 * ---------------------------------------------------------------------------
 * NODE RUNTIME. DO NOT ADD A `runtime` EXPORT.
 * ---------------------------------------------------------------------------
 * This route reaches `processImage`, which imports Sharp, which is a binding
 * over native libvips. The Edge runtime cannot load native binaries, so pinning
 * this route to Edge is a hard crash on first use rather than a slow path
 * (T-03-26). Node is the Next.js default — the failure mode is ADDING the line,
 * not omitting it, so there is deliberately nothing here to omit.
 *
 * ---------------------------------------------------------------------------
 * IT NEVER ACCEPTS A KEY (T-03-23).
 * ---------------------------------------------------------------------------
 * The body carries an upload id, and the key is recomputed from the
 * session-resolved tenant. A caller who could name a key could read and
 * overwrite any object in the bucket — every tenant's product images and every
 * payment-claim screenshot — with a single string field. The upload id alone
 * cannot escape the caller's own prefix, and the key builder throws on anything
 * that tries.
 *
 * The `claims` kind is deliberately not handled here. A claim screenshot is
 * uploaded by an anonymous customer holding a checkout token, not by a signed-in
 * merchant, so it needs a different gate and its own rate limiter; that path is
 * a later plan's action calling `processImage` itself.
 *
 * ---------------------------------------------------------------------------
 * THIS ROUTE WRITES NO DATABASE ROW, AND THAT IS THE REUSE CONTRACT (D-07).
 * ---------------------------------------------------------------------------
 * Product images are uploaded on `/dashboard/products/new` BEFORE a product
 * exists, so there is no row to attach them to at this moment. Persistence
 * belongs to whichever caller knows the owning entity: the products plan writes
 * its image rows from this response, the claims plan writes its screenshot key,
 * and Phase 4's ONB-03 logo will write an organization field. Coupling storage
 * to one schema here would make each of those a modification of this file.
 *
 * ---------------------------------------------------------------------------
 * ERRORS CARRY A CODE, NEVER A KEY AND NEVER A URL (T-03-27).
 * ---------------------------------------------------------------------------
 * A presigned URL is a bearer capability; an object key is a map of the bucket.
 * Neither belongs in a response body or a log line (ASVS V7). The codes below
 * are the entire error surface, and the caller does not need more: it already
 * knows which upload it asked about.
 */

/**
 * Thirty seconds. Deriving three WebP renditions from a few-megabyte photo
 * completes in low hundreds of milliseconds, so this is a ceiling on pathology
 * — a slow R2 read, a hostile input that survived the pixel limit — not a
 * budget the happy path spends. It is also the second half of the
 * decompression-bomb defence (T-03-25): whatever gets past `limitInputPixels`
 * still cannot occupy a function for longer than this.
 */
export const maxDuration = 30;

const finalizeSchema = z.object({
  uploadId: z.string(),
  kind: z.literal("products"),
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
   * Authorization first, and outside every try below: the merchant DAL redirects
   * rather than returning, and a redirect is signalled by a thrown control-flow
   * error that must not be caught and relabelled as a storage failure.
   */
  const ctx = await requireMerchantContext();

  /*
   * The trial gate, restated deliberately (D-08 / SUB-02). `merchantAction`
   * enforces it for the mint step, but this is a Route Handler and the wrapper
   * does not reach it — and a Route Handler is every bit as reachable by direct
   * POST as a Server Action. An expired merchant who kept a five-minute grant
   * from before expiry must not be able to convert it into stored objects.
   */
  if (!ctx.canWrite) {
    return fail("read_only", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_request", 400);
  }

  const parsed = finalizeSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid_request", 400);
  }

  /*
   * The one place a key is produced, from the session's tenant and the id. A
   * malformed id throws here rather than producing a key, so the catch below
   * treats it as a bad request and not as a storage fault.
   */
  let originalKey: string;
  try {
    originalKey = storage.objectKeyFor(ctx.tenantId, parsed.data.kind, parsed.data.uploadId);
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
    derived = await processImage(original, "product");
  } catch {
    // Undecodable bytes, a format Sharp refuses, or an image over the pixel
    // limit. All of them are the caller's input, so all of them are 4xx.
    return fail("unprocessable_image", 422);
  }

  const prefix = storage.derivativePrefixFor(originalKey);

  try {
    await Promise.all(
      derived.map((image) =>
        storage.putObject(`${prefix}/${image.label}.webp`, image.body, image.contentType),
      ),
    );
  } catch {
    return fail("storage_unavailable", 502);
  }

  /*
   * The largest rendition is the one whose dimensions describe the image, and
   * it is the last row of the preset by construction. Reporting the REAL stored
   * numbers matters: for aspect-preserving presets they are not the requested
   * ones, and the caller persists them.
   */
  const largest = derived.at(-1);
  if (!largest) {
    return fail("unprocessable_image", 422);
  }

  return NextResponse.json({
    storageKey: prefix,
    width: largest.width,
    height: largest.height,
  });
}
