"use server";

import { after } from "next/server";
import { z } from "zod";

import { merchantExistsForAdmin } from "@/server/admin/queries";
import type { ActionResult } from "@/server/merchant/action";
import { notifyMerchantOfPlatformMessage } from "@/server/support/notify";

import { adminAction } from "./action";
import { postPlatformMessage, type PlatformThreadAttachmentInput } from "./support";
import type { SupportMessageRow } from "../support/shared";

/**
 * ADM-05 — the platform owner's gated entry point into a merchant's support
 * thread: `/admin/support/[tenantId]`'s composer calls this.
 *
 * ---------------------------------------------------------------------------
 * THIS MODULE IS THE ENDPOINT LAYER ONLY. THE WRITE ITSELF LIVES IN
 * `src/server/admin/support.ts`.
 * ---------------------------------------------------------------------------
 * `postPlatformMessage` already owns the transaction and the attachment
 * batch. This file's entire job is: resolve identity (`adminAction`),
 * validate the target tenant exists, validate the payload (Zod), and inject
 * the one value a client must never supply — `authorUserId`, always
 * `ctx.userId`, never anything read from the raw request.
 *
 * ---------------------------------------------------------------------------
 * A SEPARATE ACTION MODULE PER DOMAIN IS DELIBERATE.
 * ---------------------------------------------------------------------------
 * `actions.ts` (plan 06-10) holds order-claim endpoints; this file holds
 * support endpoints; plans 06-14 and 06-16 add their own. One file per
 * domain keeps two plans in the same wave from editing the same module.
 *
 * ---------------------------------------------------------------------------
 * `tenantId` IS THE ONE CLIENT-SUPPLIED VALUE ON THIS SURFACE, AND IT IS
 * VALIDATED BEFORE ANY WRITE (T-06-54).
 * ---------------------------------------------------------------------------
 * `requireAdminContext()` (inside `adminAction`) answers "who is calling",
 * never "which store they mean" — the store arrives as an ordinary,
 * client-supplied argument, exactly as `/admin/merchants/[id]` and the admin
 * upload mint door (`src/server/images/thread-upload.ts`) already treat one.
 * `merchantExistsForAdmin` closes the gap a Zod shape check cannot: an
 * unvalidated id would let a typo — or a probe — write a `SupportMessage`
 * under a `tenantId` that names no real organization, silently orphaning the
 * row in a way nothing in the inbox would ever surface again.
 *
 * ---------------------------------------------------------------------------
 * NO NEW RATE LIMITER FOR THIS SURFACE, FOR THE SAME REASON
 * `src/server/admin/actions.ts` STATES ONE ISN'T NEEDED THERE.
 * ---------------------------------------------------------------------------
 * There is exactly one legitimate user of the admin surface, and the only
 * pre-authentication path to it is `/login`, already throttled by
 * `loginLimiter`. T-06-05, disposition "accept".
 */

/**
 * § S's attachment cap — enforced HERE as the boundary, mirroring
 * `src/server/support/actions.ts`'s `MAX_ATTACHMENTS`. A client cap alone is
 * a UI nicety a scripted POST can ignore; this is the check that matters.
 */
const MAX_ATTACHMENTS = 4;

/**
 * The shape a `threads`-namespace derivative prefix must have. Duplicated
 * from `src/server/support/actions.ts` rather than imported — that module
 * lives in the scoped zone this surface may not reach into (see
 * `src/server/admin/support.ts`'s header) — matching the same duplication
 * idiom `HOME_PAGE_TYPE`/`OWNER_ROLE` already use in
 * `src/server/admin/queries.ts`. Ownership of the tenant segment is already
 * enforced at mint time by `requestAdminThreadAttachmentUpload`
 * (`merchantExistsForAdmin`), so this schema checks SHAPE only, exactly as
 * the merchant-side pattern does.
 */
const THREAD_STORAGE_KEY_PATTERN =
  /^tenants\/[A-Za-z0-9_-]+\/threads\/[a-z0-9-]{8,64}$/;

/**
 * One finalized image attachment, exactly as
 * `src/app/api/upload/thread-finalize/route.ts` returns it. `width`/`height`
 * are required because this plan is images-only.
 */
const attachmentSchema = z.object({
  storageKey: z.string().regex(THREAD_STORAGE_KEY_PATTERN),
  contentType: z.string().min(1).max(128),
  byteSize: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

/**
 * `body` may be empty ONLY when at least one attachment is present — the
 * same cross-field rule `src/server/support/actions.ts`'s
 * `sendMessageSchema` applies on the merchant side, restated here rather
 * than imported for the same fenced-zone reason as the regex above.
 */
const sendPlatformMessageSchema = z
  .object({
    tenantId: z.string().min(1).max(64),
    body: z.string().trim().max(4000),
    attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS),
  })
  .refine((data) => data.body.length > 0 || data.attachments.length > 0, {
    error: "A message needs text, an attachment, or both.",
    path: ["body"],
  });

/**
 * The owner writes into one merchant's thread. Validates the target store
 * exists, posts the message, and schedules the merchant-direction email
 * nudge inside `after()` — never awaited, because `notifyMerchantOfPlatformMessage`
 * can never reject (see `notify.ts`'s own header) and the owner's optimistic
 * bubble must not wait on a mail provider.
 */
export const sendPlatformMessage = adminAction({
  schema: sendPlatformMessageSchema,
  handler: async (
    ctx,
    input,
  ): Promise<ActionResult<{ message: SupportMessageRow }>> => {
    const exists = await merchantExistsForAdmin(input.tenantId);
    if (!exists) {
      return { ok: false, error: { tenantId: ["Unknown store."] } };
    }

    const attachments: readonly PlatformThreadAttachmentInput[] =
      input.attachments;

    const message = await postPlatformMessage(
      input.tenantId,
      ctx.userId,
      input.body,
      attachments,
    );

    after(() => notifyMerchantOfPlatformMessage(input.tenantId));

    return { ok: true, message };
  },
});
