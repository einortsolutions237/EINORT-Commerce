import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminContext } from "@/server/admin/context";
import { merchantExistsForAdmin } from "@/server/admin/queries";
/*
 * Imported as a namespace on purpose: every call below is visibly a call
 * across the storage boundary, and exactly one line in this file computes a
 * key — the same convention `thread-document-finalize/route.ts` and every
 * other sibling finalize route in this codebase already uses.
 */
import * as storage from "@/server/images/r2";

/**
 * D-22 step 3 of 3 — verify and accept a PDF support-thread attachment, for
 * the platform owner. `thread-document-finalize/route.ts`'s admin-authenticated
 * sibling, exactly as `admin-thread-finalize/route.ts` is to its own merchant
 * counterpart.
 *
 * ---------------------------------------------------------------------------
 * WHY A SEPARATE FILE, NOT A BRANCH IN EITHER SIBLING.
 * ---------------------------------------------------------------------------
 * Two independent reasons this route exists rather than being folded into
 * something else, restated because both matter:
 *   1. It must not be a branch inside `thread-document-finalize/route.ts` —
 *      "the merchant context, or the admin context plus a body-supplied
 *      target tenant" is the one-more-branch shape `thread-upload.ts`'s
 *      header rejects for the mint step, and this route follows that
 *      precedent for the finalize step exactly as `admin-thread-finalize
 *      /route.ts` already does for the image path.
 *   2. It must not be a branch inside `admin-thread-finalize/route.ts`
 *      either — that route's whole purpose is the Sharp derive step this
 *      one deliberately has none of. `thread-document-finalize/route.ts`'s
 *      own header states the argument at length: merging the two would put
 *      opposite storage contracts behind one handler.
 *
 * ---------------------------------------------------------------------------
 * `tenantId` IS THE ONE DELIBERATE EXCEPTION TO "NEVER A TENANT ID IN THE
 * BODY", FOR THE SAME REASON THE ADMIN MINT DOOR MAKES IT.
 * ---------------------------------------------------------------------------
 * `thread-document-finalize/route.ts` derives its key from `ctx.tenantId` —
 * the signed-in merchant's own session. The platform owner has no tenant of
 * their own (D-04): `requireAdminContext()` resolves WHO is calling, never
 * WHICH store they mean, so the store has to arrive as an explicit, validated
 * argument — the same shape `requestAdminThreadDocumentUpload`'s own schema
 * already accepted at mint time. Validated below through
 * `merchantExistsForAdmin` before any storage read, for the identical reason
 * the mint door validates it before signing: an unvalidated id would let a
 * typo — or a probe — spend a storage read under a prefix nobody owns.
 *
 * ---------------------------------------------------------------------------
 * IT RE-AUTHORIZES. FINALIZE IS NOT A CONTINUATION OF THE MINT.
 * ---------------------------------------------------------------------------
 * `requireAdminContext()` is called here, fresh, exactly as every sibling
 * finalize route does. No `canWrite`/trial re-check, unlike the merchant
 * door: the platform owner has no plan, no trial and no subscription (D-04).
 *
 * ---------------------------------------------------------------------------
 * NODE RUNTIME. NO `maxDuration` EXPORT, AND THAT ABSENCE IS A DECISION.
 * ---------------------------------------------------------------------------
 * Mirrors `thread-document-finalize/route.ts`'s own note: this route never
 * reaches Sharp, so there is no decompression-bomb-shaped pathology to bound
 * and nothing here to cap.
 *
 * ---------------------------------------------------------------------------
 * MAGIC BYTES, THE STORED KEY SHAPE, AND "IT WRITES NO ROW" ALL MIRROR THE
 * MERCHANT DOOR. SEE ITS HEADER FOR THE FULL REASONING.
 * ---------------------------------------------------------------------------
 * `postPlatformMessage` (`src/server/admin/support.ts`) writes the
 * `SupportAttachment` row, for the identical reason
 * `thread-document-finalize/route.ts`'s own header gives.
 */

/** Matches `thread-document-finalize/route.ts`'s own copy — see its header. */
const MAX_THREAD_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * The body. An upload id and the validated target tenant — never a key, a
 * path, or a file name.
 */
const adminThreadDocumentFinalizeSchema = z.object({
  uploadId: z.string().min(1).max(64),
  tenantId: z.string().min(1).max(64),
});

type ErrorCode =
  | "invalid_request"
  | "not_found"
  | "not_a_document"
  | "storage_unavailable";

const fail = (code: ErrorCode, status: number): NextResponse =>
  NextResponse.json({ error: code }, { status });

/** True for the AWS SDK's "the object is not there" shapes, as opposed to "R2 is unwell". Copied verbatim from every sibling finalize route. */
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
  // Authorization first, and outside every try below — same discipline
  // every sibling finalize route documents at its own call site.
  await requireAdminContext();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_request", 400);
  }

  const parsed = adminThreadDocumentFinalizeSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid_request", 400);
  }

  const exists = await merchantExistsForAdmin(parsed.data.tenantId);
  if (!exists) {
    return fail("not_found", 404);
  }

  let originalKey: string;
  try {
    originalKey = storage.objectKeyFor(
      parsed.data.tenantId,
      "threads",
      parsed.data.uploadId,
    );
  } catch {
    return fail("invalid_request", 400);
  }

  let original: Buffer;
  try {
    original = await storage.getObjectBuffer(originalKey);
  } catch (error) {
    return isMissingObject(error)
      ? fail("not_found", 404)
      : fail("storage_unavailable", 502);
  }

  if (!storage.looksLikePdf(original)) {
    return fail("not_a_document", 422);
  }
  if (original.byteLength > MAX_THREAD_UPLOAD_BYTES) {
    return fail("not_a_document", 422);
  }

  // The PREFIX, never the raw `/original` key — see
  // `thread-document-finalize/route.ts`'s header for the full reasoning.
  const storageKey = storage.derivativePrefixFor(originalKey);

  return NextResponse.json({
    storageKey,
    contentType: "application/pdf",
    byteSize: original.byteLength,
  });
}
