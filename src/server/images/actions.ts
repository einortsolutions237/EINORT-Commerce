"use server";

import { z } from "zod";

import { merchantAction } from "@/server/merchant/action";

import { isAllowedContentType, objectKeyFor, presignUpload } from "./r2";

/**
 * CAT-02 step 1 of 3 — mint a presigned PUT for a product image.
 *
 * `"use server"` is the first line and there is deliberately no
 * `import "server-only"` beside it: the two markers are mutually exclusive, and
 * this module must be reachable from the client island that runs the upload.
 * The transport helpers it calls live in `./r2.ts`, which IS `server-only`.
 *
 * ---------------------------------------------------------------------------
 * THIS ACTION IS REACHABLE BY DIRECT POST, SO THE SCHEMA IS THE TRUST BOUNDARY.
 * ---------------------------------------------------------------------------
 * A Server Action is a public endpoint that happens to have a nice client
 * binding; nothing requires a caller to have loaded the form first. So the
 * schema below is the exhaustive list of things a browser is permitted to
 * influence, and it contains neither a tenant id, nor a key, nor a path, nor
 * the name of the file being uploaded. The key is composed from `ctx.tenantId`
 * — which `merchantAction` resolved from the session before this handler ran —
 * and an id this process generates. There is no field to tamper with (T-03-23).
 *
 * The name of the uploaded file is the pointed omission. It is the single input
 * a browser controls completely, and appending it to a storage path is the
 * shape of every upload traversal bug ever written. It is not sanitised here;
 * it is never sent.
 *
 * `mode: "write"` is what enforces the read-only trial gate (D-08 / SUB-02).
 * Re-checking `ctx.canWrite` in this handler would create a second place for
 * that rule to drift, which is exactly what the wrapper exists to prevent.
 */

/**
 * Ten megabytes.
 *
 * The browser declares this size and the browser can lie — but it can only lie
 * once, and only against itself. `presignUpload` signs the declared value as
 * `content-length`, so R2 refuses any body that is not exactly that many bytes
 * (403, verified against the live bucket). A caller who understates the size to
 * slip under this ceiling has minted a grant its real file cannot use.
 *
 * That makes this a real ceiling rather than an advisory one, and it is the
 * cheapest layer of the decompression-bomb defence (T-03-25): the refusal costs
 * one signature check at Cloudflare's edge instead of a Sharp decode inside a
 * Vercel function. A modern phone photo lands comfortably under it.
 */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const requestProductImageUploadSchema = z.object({
  contentType: z.string(),
  byteSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

/*
 * Inline copy rather than `@/lib/strings`: plan 03-04 is restructuring the copy
 * module in the same wave, and these two lines are the whole merchant-facing
 * surface of this action. Lifting them into `strings` is a follow-up, not a
 * reason to contend for the same file.
 */
const UNSUPPORTED_TYPE_MESSAGE =
  "Choose a JPEG, PNG or WebP image. Other formats are not supported.";

/**
 * What a successful mint hands back.
 *
 * `merchantAction`'s success arm is `{ ok: true } & R`, and `R` appears only in
 * the handler's return position, so TypeScript cannot infer it from the config
 * object — it has to be named. Naming it also gives the client island a type to
 * import instead of restating the three fields.
 */
export type ProductImageUploadGrant = {
  /**
   * The presigned PUT. Five minutes, one key, one content type, one exact byte
   * count. The browser must send the file with EXACTLY the `contentType` it
   * declared and exactly `byteSize` bytes — both are inside the signature, so
   * anything else is a 403 from Cloudflare rather than a stored object.
   */
  uploadUrl: string;
  /** The `original` object key. Echoed back so the caller can finalize it. */
  key: string;
  /** The server-generated id the finalize route re-derives the key from. */
  uploadId: string;
};

export const requestProductImageUpload = merchantAction<
  typeof requestProductImageUploadSchema,
  ProductImageUploadGrant
>({
  mode: "write",
  schema: requestProductImageUploadSchema,
  handler: async (ctx, { contentType, byteSize }) => {
    /*
     * The allowlist is checked here, before signing, because the signature is
     * what makes the content type binding: R2 refuses an upload whose actual
     * header differs from the signed value. Anything not on the list simply
     * never receives a grant.
     */
    if (!isAllowedContentType(contentType)) {
      return { ok: false as const, error: { contentType: [UNSUPPORTED_TYPE_MESSAGE] } };
    }

    /*
     * Server-generated, every time. This id is the only caller-facing segment of
     * the key, and it is caller-facing only in the sense that the caller is told
     * what it is afterwards — never that the caller chooses it.
     */
    const uploadId = crypto.randomUUID();
    const key = objectKeyFor(ctx.tenantId, "products", uploadId);
    const uploadUrl = await presignUpload(key, contentType, byteSize);

    return { ok: true as const, uploadUrl, key, uploadId };
  },
});
