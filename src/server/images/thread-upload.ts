"use server";

import { z } from "zod";

import { strings } from "@/lib/strings";
import { merchantExistsForAdmin } from "@/server/admin/queries";

/*
 * Namespace imports for both action factories, on purpose: each factory's
 * name is then spelled exactly ONCE in this file, at the line that actually
 * builds a door with it — the same audit-grep discipline
 * `claim-finalize/route.ts` applies to `import * as storage from "./r2"` and
 * `claim-upload.ts` applies to its own resolver alias. A reviewer (or a
 * script) grepping this file for either factory's name gets exactly the one
 * line where a credential is chosen, with no import-statement noise to read
 * past.
 */
import * as adminSurface from "@/server/admin/action";
import * as merchantSurface from "@/server/merchant/action";

import {
  isAllowedContentType,
  isAllowedDocumentContentType,
  objectKeyFor,
  presignUpload,
} from "./r2";

/**
 * ADM-05 / SUB-03 — mint a presigned PUT for a support-thread image
 * attachment, from either side of the conversation.
 *
 * ---------------------------------------------------------------------------
 * TWO NARROW DOORS, ONE CREDENTIAL EACH. NEVER ONE ROUTE WITH AN "OR".
 * ---------------------------------------------------------------------------
 * This restates `src/server/images/claim-upload.ts`'s header, because the
 * argument is unchanged: the only two honest alternatives to two files were a
 * single mint that accepts "a merchant session OR an admin session", or
 * widening one path's authorization to accept a second credential. Both are
 * the exact one-more-branch change that turns a tenant boundary into a review
 * item — every later reader of a combined action would have to work out which
 * of two credentials was in force on the line they were editing. Two doors,
 * each built from its own action factory below, stay readable: the
 * credential in force is visible at the export, not buried in a conditional.
 *
 * The merchant door's `kind` field is a two-value union
 * (`"threads" | "subscriptions"`), and that is NOT the pattern the paragraph
 * above forbids. A caller who already holds a valid merchant session is
 * choosing which NAMESPACE their own upload lands under — the credential
 * itself never changes. Pattern 4 is about a route accepting two different
 * credentials; this is one credential choosing between two destinations it is
 * already allowed to write to. Stated explicitly here so a future reader does
 * not mistake the two for the same shape.
 *
 * ---------------------------------------------------------------------------
 * THE MINT SCHEMA NEVER ACCEPTS A KEY, A PATH, OR A FILE NAME.
 * ---------------------------------------------------------------------------
 * Same rule as `claim-upload.ts`: the key layout IS the tenant boundary in
 * storage (T-03-23), so it is composed here from the resolved identity (the
 * merchant's own tenant id, or the admin door's validated target) and an
 * upload id this process generates with `crypto.randomUUID()`. A browser
 * never supplies any part of the key.
 *
 * ---------------------------------------------------------------------------
 * `"use server"`, NOT `import "server-only"`.
 * ---------------------------------------------------------------------------
 * Both exports below must be reachable from a client island — the composer's
 * attach button drives the mint directly — so this module declares Server
 * Actions rather than `server-only` helpers. Every export therefore has to be
 * an async function, which is also why `MAX_THREAD_UPLOAD_BYTES` below is a
 * private, unexported module constant rather than a named export a client
 * component could import: a `"use server"` file may only export async
 * functions, so the byte cap cannot leave this file. The composer mirrors the
 * number in its own copy instead, with a comment pointing back here — the
 * same technique `claim-form.tsx` already uses for
 * `ALLOWED_UPLOAD_CONTENT_TYPES`.
 */

/**
 * Ten megabytes, mirroring the claim path's own per-path ceiling for the same
 * reason: a phone screenshot from a support conversation is exactly the same
 * kind of upload as a payment-claim screenshot, and the browser declares this
 * value honestly or not at all — `presignUpload` signs it into
 * `content-length`, so R2 rejects any body that is not exactly that many
 * bytes regardless of what a lying client claimed. The composer interpolates
 * this number into its size-error copy rather than hardcoding "10 MB", so the
 * two never drift silently.
 */
const MAX_THREAD_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Everything a browser is permitted to influence. Note what is absent, same
 * as the claim path's own schema: no tenant id (on the merchant door — the
 * admin door is the one deliberate exception, see below), no key, no path, no
 * file name.
 *
 * `kind` selects the namespace a caller who already holds a valid credential
 * is allowed to write into — see this module's header for why that is not
 * the same shape as accepting a second credential.
 */
const requestThreadUploadSchema = z.object({
  kind: z.enum(["threads", "subscriptions"]),
  contentType: z.string().min(1).max(128),
  byteSize: z.number().int().positive().max(MAX_THREAD_UPLOAD_BYTES),
});

/**
 * The grant. `uploadId` and nothing else identifies the object afterwards —
 * the key is never echoed back, so a caller that never learns one cannot
 * present one, and the finalize route recomputes it from the same inputs
 * rather than accepting it (T-03-23).
 */
export interface ThreadUploadGrant {
  readonly uploadUrl: string;
  readonly uploadId: string;
}

/**
 * The merchant's door. The caller's own tenant id comes from the session,
 * never from the payload — write-gated because D-08's read-only trial state
 * applies to the thread the same as it does to every other merchant write.
 */
export const requestThreadAttachmentUpload = merchantSurface.merchantAction({
  mode: "write",
  schema: requestThreadUploadSchema,
  handler: async (
    ctx,
    input,
  ): Promise<merchantSurface.ActionResult<ThreadUploadGrant>> => {
    /*
     * The allowlist, checked BEFORE signing — R2 compares the header the
     * browser actually sends against the signed value, so the signature is
     * what makes the content-type binding real. Anything off the list simply
     * never receives a grant.
     */
    if (!isAllowedContentType(input.contentType)) {
      return {
        ok: false,
        error: { contentType: [strings.support.attachments.typeError] },
      };
    }

    // Server-generated, every time — the only caller-facing segment of the
    // key, and caller-facing only in the sense the caller is told what it is
    // afterwards, never that they chose it.
    const uploadId = crypto.randomUUID();
    const key = objectKeyFor(ctx.tenantId, input.kind, uploadId);
    const uploadUrl = await presignUpload(
      key,
      input.contentType,
      input.byteSize,
    );

    return { ok: true, uploadUrl, uploadId };
  },
});

/**
 * The platform owner's door. The target tenant id is the one deliberate
 * exception to "never a tenant id in the payload" on this module, because the
 * platform owner has no tenant of their own (D-04) — the admin identity
 * function resolves WHO is calling, never WHICH store they mean, so the store
 * has to arrive as an explicit, validated argument to the query it is used
 * against (the same distinction `src/server/admin/context.ts`'s header draws
 * at length). It is validated below through `merchantExistsForAdmin` before
 * signing: an unvalidated id would let a typo mint a grant under a prefix
 * nobody owns.
 */
const requestAdminThreadUploadSchema = requestThreadUploadSchema.extend({
  tenantId: z.string().min(1).max(64),
});

export const requestAdminThreadAttachmentUpload = adminSurface.adminAction({
  schema: requestAdminThreadUploadSchema,
  handler: async (
    _ctx,
    input,
  ): Promise<merchantSurface.ActionResult<ThreadUploadGrant>> => {
    if (!isAllowedContentType(input.contentType)) {
      return {
        ok: false,
        error: { contentType: [strings.support.attachments.typeError] },
      };
    }

    /*
     * The existence check, before the key is composed and before anything is
     * signed. `objectKeyFor` only validates that the tenant id is SHAPED
     * like one, never that a tenant behind it exists — this is the check
     * that closes that gap for a door whose payload can name any string.
     */
    const exists = await merchantExistsForAdmin(input.tenantId);
    if (!exists) {
      // No UI in this plan renders this message yet (plan 06-12 builds the
      // admin thread's attach affordance); it exists so the door fails
      // closed rather than silently minting a grant under a dead prefix.
      return { ok: false, error: { tenantId: ["Unknown store."] } };
    }

    const uploadId = crypto.randomUUID();
    const key = objectKeyFor(input.tenantId, input.kind, uploadId);
    const uploadUrl = await presignUpload(
      key,
      input.contentType,
      input.byteSize,
    );

    return { ok: true, uploadUrl, uploadId };
  },
});

/**
 * D-22 — the document siblings of the two mint doors above, for a PDF
 * receipt rather than an image.
 *
 * ---------------------------------------------------------------------------
 * WHY THESE ARE TWO MORE DOORS, NOT A BRANCH INSIDE THE EXISTING ONES.
 * ---------------------------------------------------------------------------
 * The existing `requestThreadAttachmentUpload` / `requestAdminThreadAttachmentUpload`
 * pair is gated by `isAllowedContentType`, the image allowlist, and their
 * schemas' `kind` field chooses a NAMESPACE (`"threads" | "subscriptions"`)
 * for a caller who already holds a valid image-upload credential — see this
 * module's header. A PDF is not a third namespace choice; it is a different
 * CONTRACT: never re-encoded, never published, read back only through an
 * authorized download door instead of a public derivative URL. Folding that
 * into the image doors' schema would mean a reader of those two functions has
 * to hold two storage contracts in their head to know which one is live on
 * the line they are changing. So the document mint gets its own pair, gated
 * by `isAllowedDocumentContentType` instead, and there is no `kind` field at
 * all: a PDF receipt only ever lands in the `threads` namespace, because
 * `subscriptions` (plan 06-15) is an image-receipt surface, not a document
 * one, and D-22 does not ask for that combination.
 *
 * Same size ceiling as the image doors (`MAX_THREAD_UPLOAD_BYTES`) for the
 * same reason: a PDF receipt is the same kind of upload as a screenshot, just
 * a different encoding, and the browser declares the size honestly or not at
 * all — `presignUpload` signs it into `content-length`, so R2 enforces it
 * regardless of what a lying client claims.
 */
const requestThreadDocumentUploadSchema = z.object({
  contentType: z.string().min(1).max(128),
  byteSize: z.number().int().positive().max(MAX_THREAD_UPLOAD_BYTES),
});

/**
 * The merchant's document door. The caller's own tenant id comes from the
 * session, never from the payload, mirroring the image door above.
 */
export const requestThreadDocumentUpload = merchantSurface.merchantAction({
  mode: "write",
  schema: requestThreadDocumentUploadSchema,
  handler: async (
    ctx,
    input,
  ): Promise<merchantSurface.ActionResult<ThreadUploadGrant>> => {
    /*
     * The document allowlist, not the image one — checked BEFORE signing for
     * the same reason as every other door in this file: the signature is
     * what makes the content-type binding real, so anything off the list
     * simply never receives a grant.
     */
    if (!isAllowedDocumentContentType(input.contentType)) {
      return {
        ok: false,
        error: { contentType: [strings.support.attachments.typeError] },
      };
    }

    const uploadId = crypto.randomUUID();
    const key = objectKeyFor(ctx.tenantId, "threads", uploadId);
    const uploadUrl = await presignUpload(
      key,
      input.contentType,
      input.byteSize,
    );

    return { ok: true, uploadUrl, uploadId };
  },
});

/**
 * The platform owner's document door. The target tenant id is the same
 * deliberate exception the image admin door documents above, validated the
 * same way before anything is signed.
 */
const requestAdminThreadDocumentUploadSchema =
  requestThreadDocumentUploadSchema.extend({
    tenantId: z.string().min(1).max(64),
  });

export const requestAdminThreadDocumentUpload = adminSurface.adminAction({
  schema: requestAdminThreadDocumentUploadSchema,
  handler: async (
    _ctx,
    input,
  ): Promise<merchantSurface.ActionResult<ThreadUploadGrant>> => {
    if (!isAllowedDocumentContentType(input.contentType)) {
      return {
        ok: false,
        error: { contentType: [strings.support.attachments.typeError] },
      };
    }

    const exists = await merchantExistsForAdmin(input.tenantId);
    if (!exists) {
      return { ok: false, error: { tenantId: ["Unknown store."] } };
    }

    const uploadId = crypto.randomUUID();
    const key = objectKeyFor(input.tenantId, "threads", uploadId);
    const uploadUrl = await presignUpload(
      key,
      input.contentType,
      input.byteSize,
    );

    return { ok: true, uploadUrl, uploadId };
  },
});
