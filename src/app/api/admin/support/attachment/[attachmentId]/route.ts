import { NextResponse } from "next/server";

import { requireAdminContext } from "@/server/admin/context";
import { attachmentForAdmin } from "@/server/admin/support";
import * as storage from "@/server/images/r2";

/**
 * D-22 — the platform owner's authorized download door for a PDF
 * support-thread attachment.
 * `src/app/api/support/attachment/[attachmentId]/route.ts`'s admin-credential
 * sibling — see that file's header for the full reasoning this route mirrors:
 * the structural unreachability of a `DOCUMENT` object from the public asset
 * origin, the two-narrow-doors discipline, the "wrong kind is a 404" rule,
 * and why each of the five response headers is a control rather than
 * decoration. Restated only where this door's shape genuinely differs.
 *
 * ---------------------------------------------------------------------------
 * `attachmentForAdmin`, NEVER `scopedDb` AND NEVER `adminDb` DIRECTLY.
 * ---------------------------------------------------------------------------
 * `eslint.config.mjs` restricts `adminDb` to `src/server/admin/**`, and this
 * Route Handler lives under `src/app/api/admin/**` — a different directory
 * that merely shares the `/admin/` URL prefix. So the lookup is a call into
 * `attachmentForAdmin` (`src/server/admin/support.ts`), the one function that
 * IS inside the fenced zone; see its own header for why it takes no tenant
 * id. This route never imports `scopedDb` either — the platform owner's
 * authorization comes from `requireAdminContext()`, not from a tenant
 * predicate.
 *
 * ---------------------------------------------------------------------------
 * THE ATTACHMENT ID ALONE IS NOT ENOUGH; THE TARGET TENANT IS TOO.
 * ---------------------------------------------------------------------------
 * `requireAdminContext()` answers WHO is calling and nothing about WHICH
 * store's attachment they mean — the same distinction `src/server/admin
 * /context.ts`'s header draws at length. A URL naming a second, explicit
 * tenant path segment would be the natural way to close that gap, but a
 * `SupportAttachment.id` (a `cuid()`) is already globally unique across every
 * tenant, so `adminDb.supportAttachment.findUnique({ where: { id } })` alone
 * is a complete, correct lookup — `adminDb` is deliberately unscoped and the
 * platform owner is authorized to read any tenant's attachment. No second
 * path parameter is needed to name the tenant, and none is added.
 *
 * ---------------------------------------------------------------------------
 * ONE CREDENTIAL. THE MERCHANT SURFACE'S OWN IDENTITY RESOLVER IS NEVER
 * IMPORTED HERE.
 * ---------------------------------------------------------------------------
 * Grep-checkable, exactly as the merchant door's own header states in
 * reverse.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
): Promise<NextResponse> {
  await requireAdminContext();
  const { attachmentId } = await params;

  const attachment = await attachmentForAdmin(attachmentId);

  if (!attachment || attachment.kind !== "DOCUMENT") {
    return new NextResponse(null, { status: 404 });
  }

  let bytes: Buffer;
  try {
    // `storageKey` is the derivative PREFIX, never the raw `/original` key —
    // see `thread-document-finalize/route.ts`'s header and this route's
    // merchant sibling for the full reasoning.
    bytes = await storage.getObjectBuffer(`${attachment.storageKey}/original`);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="receipt.pdf"',
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
