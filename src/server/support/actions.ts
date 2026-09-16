"use server";

import { after } from "next/server";
import { z } from "zod";

import { merchantAction, type ActionResult } from "@/server/merchant/action";

import { markThreadReadForMerchant, postMerchantMessage } from "./messages";
import { notifyPlatformOfMerchantMessage } from "./notify";
import type { SupportMessageRow } from "./shared";

/**
 * ADM-05 — the merchant's gated entry point into the support thread.
 *
 * ---------------------------------------------------------------------------
 * NO `tenantId` PARAMETER. `merchantAction` RESOLVES IT FROM THE SESSION.
 * ---------------------------------------------------------------------------
 * Same TEN-04 discipline as every other merchant Server Action in this
 * codebase: the handler receives `ctx` from `requireMerchantContext()`, never
 * a tenant id a caller could substitute.
 */

/**
 * § S's attachment cap — enforced HERE as the boundary, and in the composer
 * as a convenience (the attach button disables at four). A client cap alone
 * is a UI nicety a scripted POST can ignore; this is the check that matters.
 */
const MAX_ATTACHMENTS = 4;

/**
 * The shape a `threads`-namespace derivative prefix must have. Mirrors
 * `objectKeyFor`'s own layout with `/original` stripped
 * (`tenants/{tenantId}/threads/{uploadId}`), restated here rather than
 * imported because `src/server/images/r2.ts` exposes no schema of its own —
 * only `src/server/theming/schema.ts`'s `storageKeySchema` does that for the
 * `products`/`logos` pair, and this is the same idiom applied to a third
 * namespace.
 *
 * This checks SHAPE only. It does not and cannot check that the tenant
 * segment is the CALLER's own tenant — a static schema has no access to
 * `ctx` — so the handler below re-checks that ownership explicitly (T-06-49).
 */
const THREAD_STORAGE_KEY_PATTERN =
  /^tenants\/[A-Za-z0-9_-]+\/threads\/[a-z0-9-]{8,64}$/;

/**
 * One finalized attachment, either kind — a discriminated union on `kind`,
 * matching `ThreadAttachmentInput`'s own shape (`./messages.ts`).
 *
 * ---------------------------------------------------------------------------
 * D-22 — THE DOCUMENT VARIANT, ADDED BESIDE THE IMAGE ONE.
 * ---------------------------------------------------------------------------
 * The `IMAGE` variant is exactly as `src/app/api/upload/thread-finalize
 * /route.ts` returns it: `width`/`height` required, because that route
 * always reports real, Sharp-measured dimensions. The `DOCUMENT` variant is
 * exactly as `src/app/api/upload/thread-document-finalize/route.ts` returns
 * it: no `width`/`height` at all — a PDF has no raster dimensions, and a
 * schema that made them merely optional would still let a client attach a
 * fabricated pair of numbers to a document row. `z.discriminatedUnion` makes
 * that shape impossible to submit rather than merely unused.
 *
 * Both variants reuse `THREAD_STORAGE_KEY_PATTERN` — the persisted storage
 * key for a `threads`-namespace attachment has the same derivative-PREFIX
 * shape for either kind (`SupportAttachment.storageKey`'s own contract, see
 * `prisma/schema.prisma` and `./shared.ts`: "NEVER an `/original` key in
 * either case"), so `kind` is what distinguishes the two contracts, not the
 * key's shape.
 */
const imageAttachmentSchema = z.object({
  kind: z.literal("IMAGE"),
  storageKey: z.string().regex(THREAD_STORAGE_KEY_PATTERN),
  contentType: z.string().min(1).max(128),
  byteSize: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const documentAttachmentSchema = z.object({
  kind: z.literal("DOCUMENT"),
  storageKey: z.string().regex(THREAD_STORAGE_KEY_PATTERN),
  contentType: z.string().min(1).max(128),
  byteSize: z.number().int().positive(),
});

const attachmentSchema = z.discriminatedUnion("kind", [
  imageAttachmentSchema,
  documentAttachmentSchema,
]);

/**
 * `body` may be empty ONLY when at least one attachment is present
 * (06-UI-SPEC.md § A2) — "a body OR an attachment, never neither". `.trim()`
 * runs BEFORE the length check, the same order `claims/actions.ts`'s
 * `rejectSchema` uses, so a submission of pure whitespace with no attachment
 * is refused as empty rather than accepted as one space.
 *
 * The cross-field rule is a `.refine` on the whole object rather than two
 * independent field constraints, because "body OR attachment" cannot be
 * expressed as a property of either field alone. `path: ["body"]` is what
 * keeps the failure inside `fieldErrors` — `merchantAction` discards
 * `z.flattenError`'s `formErrors` half, so a refine with no path would
 * produce an error object with nothing in it for the client to read.
 */
const sendMessageSchema = z
  .object({
    body: z.string().trim().max(4000),
    attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS),
  })
  .refine((data) => data.body.length > 0 || data.attachments.length > 0, {
    error: "A message needs text, an attachment, or both.",
    path: ["body"],
  });

/**
 * A merchant sends a message. Posts it, schedules the platform-direction
 * email nudge, and returns the created row so the client can replace its
 * optimistic bubble with the server's own id/timestamp.
 *
 * `mode: "write"` — this is D-08 read-only-blockable: an expired-trial
 * merchant cannot post. The support thread is not exempt from that gate, and
 * `strings.trial.readOnlyBlocked` is the message they see, same as every
 * other blocked write in the dashboard.
 */
export const sendSupportMessage = merchantAction({
  mode: "write",
  schema: sendMessageSchema,
  handler: async (ctx, input): Promise<ActionResult<{ message: SupportMessageRow }>> => {
    /*
     * T-06-49 — the ownership half of the storage-key check. The schema above
     * only proves the key is SHAPED like a `threads` derivative prefix; it
     * cannot prove it is the CALLER's own, because a static Zod schema has no
     * access to `ctx`. A key naming another tenant's prefix would let a
     * merchant attach a stranger's image to their own message — not a bucket
     * compromise (both prefixes hold nothing but Sharp-re-encoded WebP), but a
     * forged reference this action must refuse rather than trust as opaque.
     */
    const expectedPrefix = `tenants/${ctx.tenantId}/threads/`;
    const foreignAttachment = input.attachments.find(
      (attachment) => !attachment.storageKey.startsWith(expectedPrefix),
    );
    if (foreignAttachment) {
      return {
        ok: false,
        error: { attachments: ["That attachment could not be attached."] },
      };
    }

    const message = await postMerchantMessage(
      ctx.tenantId,
      ctx.userId,
      input.body,
      input.attachments,
    );

    /*
     * Scheduled after the response, never awaited: the merchant's optimistic
     * bubble must not wait on a mail provider. `notifyPlatformOfMerchantMessage`
     * can never reject — see `notify.ts`'s header — so there is nothing here to
     * catch.
     */
    after(() => notifyPlatformOfMerchantMessage(ctx.tenantId));

    return { ok: true, message };
  },
});

/**
 * Mark the merchant's thread read. `mode: "read"` — this is a visibility
 * update, not a write to anything the trial gate protects, and an
 * expired-trial merchant must still be able to open and read their own
 * thread.
 *
 * Exported for the composer's post-send refresh (`06-UI-SPEC.md` § A2). If
 * `/dashboard/support`'s own server load marks the thread read directly on
 * render instead, this action remains the callable path a client component
 * needs after sending — the two are not mutually exclusive, and both routes
 * to `markThreadReadForMerchant` are idempotent by that function's own
 * construction.
 */
export const markSupportThreadRead = merchantAction({
  mode: "read",
  schema: z.object({}),
  handler: async (ctx) => {
    await markThreadReadForMerchant(ctx.tenantId);
    return { ok: true };
  },
});
