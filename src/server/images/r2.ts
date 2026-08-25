import "server-only";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/env";

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
 * The three storage namespaces.
 *
 * `logos` is unused in Phase 3 and must not be deleted as dead code: D-07 makes
 * Phase 4's ONB-03 merchant logo a reuse of this exact pipeline, so the slot
 * exists now to guarantee the second caller adds a row rather than a module.
 */
export type UploadKind = "products" | "claims" | "logos";

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
