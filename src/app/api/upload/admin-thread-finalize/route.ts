import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminContext } from "@/server/admin/context";
import { merchantExistsForAdmin } from "@/server/admin/queries";
import { processImage } from "@/server/images/pipeline";
/*
 * Imported as a namespace on purpose: every call below is visibly a call
 * across the storage boundary, and exactly one line in this file computes a
 * key — the same convention `thread-finalize/route.ts`,
 * `finalize/route.ts` and `claim-finalize/route.ts` already use.
 */
import * as storage from "@/server/images/r2";

/**
 * ADM-05 step 3 of 3 — derive and store a support-thread image attachment,
 * for the platform owner. `thread-finalize/route.ts`'s admin-authenticated
 * sibling, exactly as that file's own header names this one: "a new file
 * built the same way this one was, re-authorizing through
 * `requireAdminContext()` instead."
 *
 * ---------------------------------------------------------------------------
 * WHY A SEPARATE FILE, NOT A BRANCH IN `thread-finalize/route.ts`.
 * ---------------------------------------------------------------------------
 * Restates `src/server/images/thread-upload.ts`'s header, because the
 * argument is unchanged: a single finalize route branching on "the merchant
 * context, or the admin context plus a body-supplied target tenant" would be
 * exactly the one-more-branch shape that header rejects for the mint step —
 * the credential in force buried in a runtime conditional instead of visible
 * at an export. `finalize/route.ts` -> `claim-finalize/route.ts` already sets
 * this precedent for the claims namespace; this route is the same shape
 * applied to the thread namespace's admin door.
 *
 * ---------------------------------------------------------------------------
 * `tenantId` IS THE ONE DELIBERATE EXCEPTION TO "NEVER A TENANT ID IN THE
 * BODY", FOR THE SAME REASON THE ADMIN MINT DOOR MAKES IT.
 * ---------------------------------------------------------------------------
 * `thread-finalize/route.ts` derives its key from `ctx.tenantId` — the
 * signed-in merchant's own session. The platform owner has no tenant of
 * their own (D-04): `requireAdminContext()` resolves WHO is calling, never
 * WHICH store they mean, so the store has to arrive as an explicit,
 * validated argument to the query it is used against — the same distinction
 * `src/server/admin/context.ts`'s header draws at length, and the same shape
 * `requestAdminThreadAttachmentUpload`'s own schema already accepted at mint
 * time. Validated below through `merchantExistsForAdmin` before any storage
 * read, for the identical reason the mint door validates it before signing:
 * an unvalidated id would let a typo — or a probe — spend a Sharp derive
 * pass and a storage write under a prefix nobody owns.
 *
 * ---------------------------------------------------------------------------
 * IT RE-AUTHORIZES. FINALIZE IS NOT A CONTINUATION OF THE MINT.
 * ---------------------------------------------------------------------------
 * A Route Handler is every bit as reachable by a direct POST as a Server
 * Action is, and nothing carries state between the mint call and this one.
 * `requireAdminContext()` is called here, fresh, exactly as
 * `thread-finalize/route.ts` does for the merchant door.
 *
 * No `canWrite`/trial re-check here, unlike the merchant door: the platform
 * owner has no plan, no trial and no subscription (D-04) — there is no state
 * in which their writes are refused, the same reasoning `adminAction`'s own
 * header gives for omitting a `mode` axis entirely.
 *
 * ---------------------------------------------------------------------------
 * NODE RUNTIME. DO NOT ADD A `runtime` EXPORT.
 * ---------------------------------------------------------------------------
 * This route reaches `processImage`, which imports Sharp, a binding over
 * native libvips. The Edge runtime cannot load native binaries (T-03-26 /
 * T-06-53). Node is the Next.js default — the failure mode is ADDING the
 * line, not omitting it.
 *
 * ---------------------------------------------------------------------------
 * IT NEVER ACCEPTS A KEY (T-03-23).
 * ---------------------------------------------------------------------------
 * The body carries an upload id, the namespace `kind`, and the validated
 * target tenant; the key is recomputed from those, never accepted directly.
 *
 * ---------------------------------------------------------------------------
 * THIS ROUTE WRITES NO DATABASE ROW (D-07's reuse contract, restated).
 * ---------------------------------------------------------------------------
 * `postPlatformMessage` (`src/server/admin/support.ts`) writes the
 * `SupportAttachment` row, because it is the caller that knows whether the
 * message itself succeeded — identical reasoning to `thread-finalize/route.ts`'s
 * own header.
 *
 * ---------------------------------------------------------------------------
 * ERRORS CARRY A CODE, NEVER A KEY AND NEVER A URL (T-03-27, ASVS V7).
 * ---------------------------------------------------------------------------
 * Same discipline as every sibling finalize route in this codebase.
 */

/** Matches every sibling finalize route's ceiling — see their own headers. */
export const maxDuration = 30;

/**
 * The body. An upload id, the namespace it was minted under, and the
 * validated target tenant — never a key, a path, or a file name.
 */
const adminThreadFinalizeSchema = z.object({
  uploadId: z.string().min(1).max(64),
  kind: z.enum(["threads", "subscriptions"]),
  tenantId: z.string().min(1).max(64),
});

type ErrorCode =
  | "invalid_request"
  | "not_found"
  | "unprocessable_image"
  | "storage_unavailable";

const fail = (code: ErrorCode, status: number): NextResponse =>
  NextResponse.json({ error: code }, { status });

/** True for the AWS SDK's "the object is not there" shapes, as opposed to "R2 is unwell". Copied verbatim from `thread-finalize/route.ts`. */
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
  // `thread-finalize/route.ts` documents at its own call site.
  await requireAdminContext();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_request", 400);
  }

  const parsed = adminThreadFinalizeSchema.safeParse(body);
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
    return isMissingObject(error)
      ? fail("not_found", 404)
      : fail("storage_unavailable", 502);
  }

  let derived;
  try {
    // `thread`, not `product` — see `thread-finalize/route.ts`'s own note on
    // why the preset preserves aspect ratio for evidence.
    derived = await processImage(original, "thread");
  } catch {
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

  return NextResponse.json({
    storageKey: prefix,
    width: single.width,
    height: single.height,
    contentType: single.contentType,
    byteSize: single.body.byteLength,
  });
}
