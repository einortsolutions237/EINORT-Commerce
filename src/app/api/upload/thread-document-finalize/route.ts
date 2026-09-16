import { NextResponse } from "next/server";
import { z } from "zod";

/*
 * Imported as a namespace on purpose: every call below is visibly a call
 * across the storage boundary, and exactly one line in this file computes a
 * key — the same convention `thread-finalize/route.ts` and every other
 * sibling finalize route in this codebase already uses.
 */
import * as storage from "@/server/images/r2";
import { requireMerchantContext } from "@/server/merchant/context";

/**
 * D-22 step 3 of 3 — verify and accept a PDF support-thread attachment, for a
 * signed-in merchant. The merchant door; `admin-thread-document-finalize/route.ts`
 * is its admin-authenticated sibling.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A SEPARATE ROUTE FROM `thread-finalize/route.ts`, NOT A BRANCH
 * IN IT.
 * ---------------------------------------------------------------------------
 * That route's whole purpose is the Sharp derive step that makes the served
 * bytes different from the uploaded bytes — a re-encode that also happens to
 * verify the input is a real, decodable image. A PDF cannot be re-encoded by
 * Sharp at all, so this route has no derive step whatsoever: it reads the
 * object back, checks its first five bytes are a real PDF header, and stops.
 * Merging the two would put two OPPOSITE storage contracts — "always
 * re-encoded, served from R2_PUBLIC_BASE_URL" versus "never touched, served
 * only through an authorized route" — behind one handler, and a later reader
 * editing one line would not be able to tell which contract was in force on
 * it. 06-RESEARCH.md § Discretion Q5 and 06-PATTERNS.md § R-2 both concluded
 * this had to be its own path; this file and its two authorized-download
 * siblings are that path.
 *
 * ---------------------------------------------------------------------------
 * THE MERCHANT DOOR ONLY. THE ADMIN DOOR HAS ITS OWN SIBLING ROUTE.
 * ---------------------------------------------------------------------------
 * Mirrors `thread-finalize/route.ts` -> `admin-thread-finalize/route.ts`'s
 * own arrangement: one credential per invocation, two files, never a single
 * route branching on "the admin context, or the merchant context, chosen by
 * whether the body names a target tenant". That branch would bury the
 * credential in force inside a runtime conditional instead of leaving it
 * visible at the export — the exact shape `thread-upload.ts`'s own header
 * rejects for the mint step, restated here for the finalize step.
 *
 * ---------------------------------------------------------------------------
 * IT RE-AUTHORIZES. FINALIZE IS NOT A CONTINUATION OF THE MINT.
 * ---------------------------------------------------------------------------
 * A Route Handler is every bit as reachable by a direct POST as a Server
 * Action is, and nothing carries state between the mint call and this one.
 * `requireMerchantContext()` is called here, fresh, exactly as every sibling
 * finalize route does. `ctx.canWrite` is re-checked explicitly (D-08): a
 * five-minute presigned grant obtained before a trial expired must not be
 * convertible into a stored, referenceable object after it has.
 *
 * ---------------------------------------------------------------------------
 * MAGIC BYTES ARE VERIFIED HERE, NOT TRUSTED FROM THE SIGNED CONTENT-TYPE.
 * ---------------------------------------------------------------------------
 * The signed `content-type` on the presigned PUT proves what the browser
 * DECLARED when the grant was minted, not what it actually sent — nothing in
 * the R2 grant stops a caller from uploading arbitrary bytes under an
 * `application/pdf` grant. Because this path never re-encodes, there is no
 * Sharp step to fail loudly on a bad file the way `unprocessable_image` does
 * for the image path, so this route reads the object back itself and calls
 * `looksLikePdf` before anything can reference it. A failed check answers
 * `not_a_document` and, critically, never creates a row — see below.
 *
 * ---------------------------------------------------------------------------
 * NODE RUNTIME. NO `maxDuration` EXPORT, AND THAT ABSENCE IS A DECISION.
 * ---------------------------------------------------------------------------
 * Every sibling finalize route pins `maxDuration = 30` because it reaches
 * Sharp, and 30 seconds is a ceiling on a decompression-bomb-shaped input.
 * This route never reaches Sharp — there is no derive step to bound — so
 * there is nothing here to cap and the Next.js default applies. Stated
 * explicitly so the absence reads as a decision made on purpose, not an
 * omission this route forgot.
 *
 * ---------------------------------------------------------------------------
 * NO PUBLIC URL. THIS ROUTE NEVER CALLS THE R2 CLIENT'S PUBLIC-URL HELPER.
 * ---------------------------------------------------------------------------
 * A document is never served from `R2_PUBLIC_BASE_URL` — that is the entire
 * point of this plan. The response below carries a storage key and nothing
 * else; rendering it happens exclusively through the two authorized download
 * doors (`src/app/api/support/attachment/[attachmentId]/route.ts` and its
 * admin sibling), neither of which calls that helper either.
 *
 * ---------------------------------------------------------------------------
 * IT WRITES NO DATABASE ROW (D-07's reuse contract, restated for this plan).
 * ---------------------------------------------------------------------------
 * `postMerchantMessage` (`src/server/support/messages.ts`) writes the
 * `SupportAttachment` row, because it is the caller that knows whether the
 * message itself succeeded. An attachment row pointing at a message that was
 * never sent would be evidence for a conversation that does not exist; an
 * orphaned R2 object is cheap, and a failed magic-byte check makes that
 * orphan even cheaper to accept, since nothing downstream can ever reference
 * it.
 *
 * ---------------------------------------------------------------------------
 * ERRORS CARRY A CODE, NEVER A KEY AND NEVER A URL (T-03-27, ASVS V7).
 * ---------------------------------------------------------------------------
 * Same discipline as every sibling finalize route in this codebase.
 */

/**
 * Ten megabytes, mirroring `thread-upload.ts`'s own private
 * `MAX_THREAD_UPLOAD_BYTES`, which cannot leave that `"use server"` module
 * (a Server Actions file may only export async functions). This route needs
 * its own copy for the same reason `composer.tsx` keeps one: R2 already
 * enforces the real ceiling via the signed `content-length`, so this is a
 * second, defence-in-depth assertion against the bytes actually read back,
 * not the sole enforcement point.
 */
const MAX_THREAD_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * The body. An upload id, and nothing that names a key or a path — the key is
 * recomputed from the session's own tenant, exactly as every sibling finalize
 * route does.
 */
const threadDocumentFinalizeSchema = z.object({
  uploadId: z.string().min(1).max(64),
});

type ErrorCode =
  | "invalid_request"
  | "read_only"
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
  /*
   * Authorization first, and outside every try below: the merchant DAL
   * redirects rather than returning, and a redirect is signalled by a thrown
   * control-flow error that must not be caught and relabelled as a storage
   * failure — the same discipline every sibling finalize route documents at
   * its own call site.
   */
  const ctx = await requireMerchantContext();

  if (!ctx.canWrite) {
    return fail("read_only", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_request", 400);
  }

  const parsed = threadDocumentFinalizeSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid_request", 400);
  }

  /*
   * The one place a key is produced, from the session's tenant and the id.
   * PDF receipts only ever land in the `threads` namespace (see
   * `thread-upload.ts`'s own header on why the document mint doors carry no
   * `kind` field) — a malformed id throws here rather than producing a key,
   * so the catch below treats it as a bad request and not as a storage
   * fault.
   */
  let originalKey: string;
  try {
    originalKey = storage.objectKeyFor(
      ctx.tenantId,
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
    // A merchant who never completed the direct PUT lands here; so does a
    // replayed finalize for an id that was never minted. Both are 404, and
    // neither response says which key was looked for.
    return isMissingObject(error)
      ? fail("not_found", 404)
      : fail("storage_unavailable", 502);
  }

  /*
   * The verification this whole route exists for. No Sharp, no derive, no
   * second object written — just the five-byte header check and the byte
   * length re-assertion.
   */
  if (!storage.looksLikePdf(original)) {
    return fail("not_a_document", 422);
  }
  if (original.byteLength > MAX_THREAD_UPLOAD_BYTES) {
    return fail("not_a_document", 422);
  }

  /*
   * The PREFIX, never the raw `/original` key — matching `SupportAttachment
   * .storageKey`'s own contract (`prisma/schema.prisma`, `shared.ts`): "the
   * stored object key itself, because there are no derivatives to prefix"
   * means a DOCUMENT row's key is structurally the same PREFIX shape an
   * IMAGE row's is, not a second filename appended onto it — the download
   * doors re-append the literal `/original` suffix when they read the real
   * object back. Storing the raw key here would be storing an `/original`
   * key in a DB column that, by that same contract, never holds one.
   */
  const storageKey = storage.derivativePrefixFor(originalKey);

  return NextResponse.json({
    storageKey,
    contentType: "application/pdf",
    byteSize: original.byteLength,
  });
}
