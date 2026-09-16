import "server-only";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/env";
import { isTemplateKey } from "@/server/theming/registry";

/**
 * The R2 transport layer — CAT-02 / D-07, and the storage half of tenant
 * isolation.
 *
 * ---------------------------------------------------------------------------
 * WHY DIRECT-TO-R2 IS MANDATORY, NOT AN OPTIMISATION.
 * ---------------------------------------------------------------------------
 * Next 16 caps Server Action request bodies at 1 MB by default. A photo taken
 * on the phone a Douala merchant actually owns is routinely three to eight
 * times that, so "post the file to a Server Action" is not a slower design —
 * it is a design that does not work. Raising `serverActions.bodySizeLimit`
 * would make it work by routing every megabyte through Vercel compute, paid for
 * and rate-limited, to accomplish nothing R2 is not already better at. So the
 * bytes never touch this application: the browser is handed a five-minute write
 * grant to exactly one key and PUTs straight to Cloudflare.
 *
 * ---------------------------------------------------------------------------
 * THE OBJECT KEY IS THE TENANT BOUNDARY (T-03-23).
 * ---------------------------------------------------------------------------
 * One bucket holds every tenant's images. There is no per-tenant credential, no
 * bucket policy and no ACL doing the separating — the layout
 * `tenants/{tenantId}/{kind}/{uploadId}/original` is the entire mechanism. That
 * makes `objectKeyFor` a security control rather than a naming helper, which is
 * why it validates, throws, and is unit-tested exhaustively in
 * `tests/unit/r2-key.test.ts`.
 *
 * The corollary is absolute: a client-supplied filename never reaches a key.
 * The filename is the one input a browser controls completely, and every
 * traversal bug in the history of file uploads is the same sentence — "we
 * appended the name the user gave us". The upload id is minted server-side with
 * `crypto.randomUUID()`; the original filename is discarded, not sanitised.
 */

/**
 * The only content types this platform will sign an upload for.
 *
 * Deliberately three raster formats and nothing else. The notable exclusion is
 * the vector format `image/svg+xml`: it is a script-carrying XML document, not
 * a raster image, and storing one means serving an attacker-authored document
 * from the platform's own origin. Animated and exotic raster formats are
 * excluded too — not because they are dangerous but because every accepted
 * format is a decoder Sharp has to be trusted with (T-03-24).
 */
export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedUploadContentType =
  (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number];

/**
 * Exact match, no trimming, no case folding, no parameter stripping.
 *
 * The accepted value is echoed verbatim into `PutObjectCommand`'s `ContentType`
 * and R2 compares the signed value byte-for-byte against the header the browser
 * actually sends. Normalising `IMAGE/JPEG` to `image/jpeg` here would sign a
 * grant the browser then fails to satisfy — a 403 at upload time, blamed on R2,
 * caused here.
 */
export function isAllowedContentType(
  value: string,
): value is AllowedUploadContentType {
  return (ALLOWED_UPLOAD_CONTENT_TYPES as readonly string[]).includes(value);
}

/**
 * D-22 — the PDF-receipt path, a SECOND allowlist beside the one above, never
 * merged into it.
 *
 * ---------------------------------------------------------------------------
 * WHY A PDF GETS ITS OWN CONSTANT INSTEAD OF JOINING ALLOWED_UPLOAD_CONTENT_TYPES.
 * ---------------------------------------------------------------------------
 * `ALLOWED_UPLOAD_CONTENT_TYPES`'s own header excludes `image/svg+xml` because
 * "it is a script-carrying XML document, not a raster image, and storing one
 * means serving an attacker-authored document from the platform's own
 * origin." A PDF is exactly that same objection restated: a script-carrying
 * document, not a raster image, that Sharp cannot re-encode. Widening the
 * image allowlist to admit it would mean every consumer of that constant —
 * the derive pipeline, the public-derivative finalize route — now has to
 * handle a type it cannot process. So this path answers the objection
 * differently instead of overriding it: a document minted through this
 * allowlist is deliberately never re-encoded and never published. It stays at
 * the `/original` key `publicUrlFor` structurally refuses to return a public
 * URL for, and the only reader is an authorized route handler
 * (`src/app/api/support/attachment/[attachmentId]/route.ts` and its admin
 * sibling) that forces a download with `X-Content-Type-Options: nosniff` and
 * a `Content-Security-Policy: default-src 'none'; sandbox` — so the document
 * never executes in a document context on this origin. D-22 is the decision
 * that requires PDF support; 06-RESEARCH.md § Discretion Q5 and
 * 06-PATTERNS.md § R-2 are the analyses that concluded this had to be a
 * separate, non-re-encoding path rather than an extension of the image one.
 */
export const ALLOWED_DOCUMENT_CONTENT_TYPES = ["application/pdf"] as const;

export type AllowedDocumentContentType =
  (typeof ALLOWED_DOCUMENT_CONTENT_TYPES)[number];

/**
 * Exact match, no trimming, no case folding, no parameter stripping — same
 * reasoning as `isAllowedContentType`: the accepted value is echoed verbatim
 * into `PutObjectCommand`'s `ContentType` and R2 compares the signed value
 * byte for byte against what the browser actually sends.
 */
export function isAllowedDocumentContentType(
  value: string,
): value is AllowedDocumentContentType {
  return (ALLOWED_DOCUMENT_CONTENT_TYPES as readonly string[]).includes(
    value,
  );
}

/**
 * A pure magic-byte check: true only for a buffer whose first five bytes are
 * the literal PDF header `%PDF-`.
 *
 * The signed `content-type` on a presigned PUT proves what the browser
 * DECLARED, not what it SENT — nothing about the R2 grant stops a caller from
 * uploading any bytes at all under an `application/pdf` grant. Since this
 * path never re-encodes (there is no Sharp step to fail loudly on a bad
 * file), the finalize route reads the object back and calls this function
 * before any `SupportAttachment` row can reference it. A buffer shorter than
 * five bytes, an empty buffer, or a real magic sequence appearing at any
 * offset other than zero are all refused — anchoring at offset zero is the
 * point: the header must be the first bytes of the file, not merely present
 * somewhere inside it.
 */
export function looksLikePdf(bytes: Buffer): boolean {
  const PDF_MAGIC = Buffer.from("%PDF-", "ascii");
  if (bytes.length < PDF_MAGIC.length) {
    return false;
  }
  return bytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
}

/**
 * The five storage namespaces.
 *
 * `logos` is unused in Phase 3 and must not be deleted as dead code: D-07 makes
 * Phase 4's ONB-03 merchant logo a reuse of this exact pipeline, so the slot
 * exists now to guarantee the second caller adds a row rather than a module.
 *
 * `threads` and `subscriptions` arrive TOGETHER in Phase 6 (plan 06-11), and
 * that pairing is deliberate rather than incidental: `threads` carries ADM-05
 * support-message image attachments and `subscriptions` carries SUB-03
 * subscription-payment receipts (plan 06-15). Both reuse the same `thread`
 * image preset and the same two-narrow-doors mint module
 * (`src/server/images/thread-upload.ts`), and adding both namespace rows in
 * one edit is what lets the second consumer — the receipt upload — call an
 * existing door instead of editing this file again in a later wave. The same
 * reasoning the `logos` row above already states for its own slot.
 */
export type UploadKind =
  | "products"
  | "claims"
  | "logos"
  | "threads"
  | "subscriptions";

/** 8–64 chars of lowercase alphanumerics and hyphens — the shape of `crypto.randomUUID()`. */
const UPLOAD_ID_PATTERN = /^[a-z0-9-]{8,64}$/;

/**
 * A tenant id may not contain anything that changes the meaning of a path.
 *
 * `ctx.tenantId` is a Better Auth organization id and is trusted today, so this
 * is defence in depth rather than a live control. It costs one regex and it
 * means a future call site that passes something else cannot silently write
 * outside the prefix — the failure becomes an exception instead of a leak.
 */
const TENANT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/**
 * Compose the one key a presigned grant will cover.
 *
 * Throws rather than sanitising. A sanitising version of this function has a
 * "close enough" branch, and the whole point is that there is no such thing as
 * close enough to a tenant boundary.
 */
export function objectKeyFor(
  tenantId: string,
  kind: UploadKind,
  uploadId: string,
): string {
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    throw new Error("Invalid tenant id for object key");
  }
  if (!UPLOAD_ID_PATTERN.test(uploadId)) {
    throw new Error("Invalid upload id for object key");
  }
  return `tenants/${tenantId}/${kind}/${uploadId}/original`;
}

/**
 * Strip the trailing `/original` to get the prefix the derivatives live under.
 *
 * `tenants/t/products/abc/original` → `tenants/t/products/abc`, so a derivative
 * is `${prefix}/card.webp`. Kept here beside `objectKeyFor` so the two halves of
 * the layout cannot drift apart in two different files.
 */
export function derivativePrefixFor(originalKey: string): string {
  const suffix = "/original";
  if (!originalKey.endsWith(suffix)) {
    throw new Error("Not an original object key");
  }
  return originalKey.slice(0, -suffix.length);
}

/**
 * The prefix a template's rendered preview derivatives live under (TMPL-06).
 *
 * `templates/` is a SIBLING namespace to `tenants/`, never nested inside one:
 * a preview is platform content, identical for every merchant, and putting it
 * under a tenant prefix would imply an ownership that does not exist.
 *
 * Throws rather than sanitising, exactly like `objectKeyFor` above. The input
 * is always a member of the closed `TEMPLATE_KEYS` tuple and never client
 * data, so this is defence in depth: the whole point is that there is no such
 * thing as close enough to a tenant boundary, even when the caller is trusted
 * today.
 *
 * The derivative basename comes from the `templatePreview` preset's own
 * `labels` entry (`src/server/images/pipeline.ts`), so the full key is
 * `templates/{key}/card.webp`. Renaming that label orphans stored objects
 * rather than moving them — kept here, beside `derivativePrefixFor`, so this
 * third half of the key layout cannot drift apart in a separate file.
 */
export function templatePreviewPrefixFor(templateKey: string): string {
  if (!isTemplateKey(templateKey)) {
    throw new Error("Invalid template key for preview object key");
  }
  return `templates/${templateKey}`;
}

/**
 * The literal `auto` region below is required by the AWS SDK and completely
 * unused by R2 — Cloudflare's own S3 API docs say so verbatim. Do not "fix" it
 * to `eu-west-3` or any other real region; the SDK only needs a non-empty value
 * to build a signature, and R2 ignores it entirely.
 */
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Mint a time-limited write grant for exactly one key, one content type and one
 * exact byte count.
 *
 * ---------------------------------------------------------------------------
 * `signableHeaders` IS THE CONTROL. `ContentType` ALONE IS NOT.
 * ---------------------------------------------------------------------------
 * This is the one thing in this file that was verified against the real bucket
 * rather than taken from documentation, because the documented behaviour is
 * wrong in a way that fails open.
 *
 * SigV4 presigning signs the `host` header and NOTHING ELSE by default. Setting
 * `ContentType` on the command without listing `content-type` in
 * `signableHeaders` puts the value in the request the SDK would have sent — and
 * leaves it entirely out of the signature. Measured against
 * `einort-commerce` on Cloudflare R2: a presigned PUT minted with
 * `ContentType: "image/jpeg"` and no `signableHeaders` accepted a body sent as
 * `Content-Type: text/html` with **200 OK**. With `content-type` signed, the
 * same request is refused **403**. The grant is only "one content type" because
 * of the option below; without it, it is "write anything you like to this path
 * for five minutes", which is precisely the reuse T-03-24 is about.
 *
 * `content-length` is signed for the same reason and buys the same kind of
 * promise: the 10 MB ceiling in the mint action's schema stops being a number
 * the browser is asked to respect and becomes one R2 enforces. Verified the same
 * way — the exact declared size uploads 200, one kilobyte more is refused 403.
 *
 * Five minutes because a grant is a capability: long enough for a slow Douala
 * mobile connection to finish a multi-megabyte PUT, short enough that a leaked
 * URL in a browser history or a shared screenshot is worthless by the time
 * anyone reads it. R2 permits 1s–604800s; the ceiling is not a target.
 *
 * The corollary for every caller: the browser must PUT with EXACTLY the signed
 * `Content-Type` and exactly `byteSize` bytes. Anything else is a 403 from
 * Cloudflare, and that 403 is the feature.
 */
export function presignUpload(
  key: string,
  contentType: string,
  byteSize: number,
): Promise<string> {
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: byteSize,
    }),
    {
      expiresIn: 300,
      signableHeaders: new Set(["content-type", "content-length"]),
    },
  );
}

/** Read an object back into memory. Used by the finalize route to feed Sharp. */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const result = await r2.send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
  );
  if (!result.Body) {
    throw new Error("Object has no body");
  }
  const bytes = await result.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/** Write a derivative back. Server-side only — never given to a browser. */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * The public URL for a DERIVATIVE. Never for an `original`.
 *
 * The original is the bytes a browser uploaded; the derivative is what Sharp
 * re-encoded. Serving the original would hand an attacker a path to publish
 * arbitrary uploaded bytes from the platform's origin — the exact outcome the
 * re-encode exists to prevent (T-03-28) — so this function refuses a key that
 * still ends in `/original` rather than trusting every future caller to
 * remember the rule.
 */
export function publicUrlFor(key: string): string {
  if (key.endsWith("/original")) {
    throw new Error("Originals are never publicly served");
  }
  return `${env.R2_PUBLIC_BASE_URL}/${key}`;
}
