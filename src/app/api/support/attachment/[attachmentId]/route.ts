import { NextResponse } from "next/server";

import { scopedDb } from "@/server/db/tenant-scoped";
import * as storage from "@/server/images/r2";
import { requireMerchantContext } from "@/server/merchant/context";

/**
 * D-22 — the merchant's authorized download door for a PDF support-thread
 * attachment. `src/app/api/admin/support/attachment/[attachmentId]/route.ts`
 * is its admin-credential sibling; there is no third route and no branch
 * that accepts either credential.
 *
 * ---------------------------------------------------------------------------
 * THIS IS THE ONLY WAY A DOCUMENT'S BYTES EVER LEAVE THIS APPLICATION.
 * ---------------------------------------------------------------------------
 * A `DOCUMENT`-kind `SupportAttachment` is stored at the `/original` key the
 * R2 client's own public-URL helper (`src/server/images/r2.ts`) structurally
 * refuses to return a public URL for — see that function's own header. So
 * there is no image-tag `src`, no `next/image` remote pattern and no CDN
 * path that ever reaches
 * this object; the ONLY reader is this route (and its admin sibling), which
 * re-derives identity on every request and forces a download rather than an
 * inline render. `src/components/support/attachment-grid.tsx` links a
 * `DOCUMENT` tile here rather than composing any URL itself, for the same
 * reason `attachment-grid.tsx`'s own header gives for never composing an
 * IMAGE url: URL composition happens once, in the layer that is authorized
 * to do it.
 *
 * ---------------------------------------------------------------------------
 * TWO NARROW DOORS, ONE CREDENTIAL EACH. NEVER ONE ROUTE WITH AN "OR".
 * ---------------------------------------------------------------------------
 * Restates `thread-upload.ts`'s header for the download step: the only two
 * honest alternatives to two files were a single route that accepts "a
 * merchant session OR an admin session", or widening this route's
 * authorization to accept a second credential. Both are the one-more-branch
 * change that turns a tenant boundary into a review item. This file imports
 * `requireMerchantContext` and `scopedDb`, never the admin zone's own
 * identity resolver or its unscoped database client — the credential in
 * force is visible at the import statement, not buried in a conditional.
 *
 * ---------------------------------------------------------------------------
 * THE TENANT PREDICATE COMES FROM `scopedDb`, NOT FROM A MANUAL CHECK.
 * ---------------------------------------------------------------------------
 * The lookup below reads through `scopedDb(ctx.tenantId)`, which injects the
 * tenant predicate into the `where` automatically. Another tenant's
 * attachment id simply does not exist for this caller — there is no
 * `attachment.tenantId === ctx.tenantId` comparison to forget, because the
 * comparison is structural (TEN-02).
 *
 * ---------------------------------------------------------------------------
 * `kind !== "DOCUMENT"` IS A 404, NOT A REDIRECT TO THE PUBLIC IMAGE.
 * ---------------------------------------------------------------------------
 * An `IMAGE` attachment id presented here answers identically to an unknown
 * id. Images are already served publicly from R2 through their own derivative
 * URL; this route must not become a second, authorized path that could be
 * repointed at an `/original` key by a future edit that "simplifies" the
 * branch away. The refusal is symmetric with the finalize route's own
 * discipline: neither path ever treats the two kinds as interchangeable.
 *
 * ---------------------------------------------------------------------------
 * THE FIVE RESPONSE HEADERS ARE THE CONTROL, NOT DECORATION.
 * ---------------------------------------------------------------------------
 * `Content-Disposition: attachment` forces a download rather than an inline
 * render, so the document never executes in a document context on this
 * origin even though it is served from the app's own origin rather than
 * R2's. `X-Content-Type-Options: nosniff` stops a browser from re-sniffing
 * the body into something else. `Content-Security-Policy: default-src
 * 'none'; sandbox` is the second, independent layer: even a browser that
 * somehow rendered the response inline would have no script execution
 * context to run in. `Cache-Control: private, no-store` keeps a shared or
 * disk cache from retaining another tenant's — or this tenant's own —
 * financial evidence (T-06-67). The filename is server-generated and
 * constant; the uploaded name was discarded at mint (`objectKeyFor` throws
 * rather than sanitising one) and is never stored, so there is nothing to
 * echo here even if this route wanted to (T-06-64).
 *
 * ---------------------------------------------------------------------------
 * NO `runtime` EXPORT, NO `maxDuration` EXPORT, AND NEITHER OMISSION IS AN
 * ACCIDENT.
 * ---------------------------------------------------------------------------
 * This route never reaches Sharp — it reads one object back and streams it
 * out — so Node is the correct (and default) runtime with nothing to pin, and
 * there is no decompression-bomb-shaped pathology to bound with a duration
 * ceiling.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
): Promise<NextResponse> {
  const ctx = await requireMerchantContext();
  const { attachmentId } = await params;

  const attachment = await scopedDb(ctx.tenantId).supportAttachment.findUnique({
    where: { id: attachmentId },
    select: { kind: true, storageKey: true },
  });

  // Unknown id, another tenant's id (scopedDb's predicate already made that
  // indistinguishable from unknown), or an IMAGE id — all one refusal, for
  // the reasons in this file's own header.
  if (!attachment || attachment.kind !== "DOCUMENT") {
    return new NextResponse(null, { status: 404 });
  }

  let bytes: Buffer;
  try {
    // `storageKey` is the derivative PREFIX (never the raw `/original` key —
    // see `SupportAttachment.storageKey`'s own schema comment and
    // `thread-document-finalize/route.ts`'s header), so the real object is
    // read back by re-appending the literal suffix the finalize route
    // stripped off.
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
