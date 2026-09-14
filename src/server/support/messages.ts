import "server-only";

import type {
  SupportAttachmentCreateManyInput,
  SupportMessageCreateInput,
} from "@/server/db/model-inputs";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";
import type { ScopedTx } from "@/server/db/tenant-scoped";

import { UNREAD_BY_MERCHANT_AUTHORS, type SupportMessageRow } from "./shared";

/**
 * One image attachment as `sendSupportMessage`'s Zod schema hands it down
 * after `src/app/api/upload/thread-finalize/route.ts` has already derived and
 * stored it (ADM-05 / D-10). `width`/`height` are non-null here on purpose —
 * this plan is images-only, and the finalize route always reports real,
 * Sharp-measured dimensions for an `IMAGE` row. `SupportAttachmentRow`'s own
 * fields stay nullable for the `DOCUMENT` case plan 06-13 adds.
 */
export interface ThreadAttachmentInput {
  readonly storageKey: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
}

const MESSAGE_SELECT = {
  id: true,
  author: true,
  authorUserId: true,
  body: true,
  createdAt: true,
  subscriptionClaimId: true,
  attachments: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      kind: true,
      storageKey: true,
      contentType: true,
      byteSize: true,
      width: true,
      height: true,
    },
  },
} as const;

/**
 * ADM-05 — the write primitive for the merchant↔platform support thread.
 *
 * ---------------------------------------------------------------------------
 * APPEND-ONLY. NO EDIT, NO DELETE, NO ARCHIVE, NO CLOSE.
 * ---------------------------------------------------------------------------
 * D-12 makes the thread one continuous conversation, and CLAUDE.md's
 * no-hard-deletes rule applies here as much as it does to catalog data. None
 * of the four controls above exists to be disabled somewhere else — they are
 * simply absent from this module's exports, and that absence IS the
 * enforcement. A `deleteMessage` or `editMessage` export added later is the
 * exact shape of the regression this file exists to prevent.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE IS THE SCOPED ZONE. THE ADMIN ZONE HAS ITS OWN SIBLING WRITER.
 * ---------------------------------------------------------------------------
 * Every write below goes through `scopedDb(tenantId)`, which injects the
 * tenant predicate. `src/server/admin/support.ts` (plan 06-12) is the
 * platform owner's writer for the SAME table, reading and writing through
 * `adminDb` instead, because the owner's authorization comes from
 * `requireAdminContext` rather than from a tenant predicate.
 * `eslint.config.mjs` forbids `src/server/admin/**` from importing
 * `src/server/db/tenant-scoped`, so the admin zone cannot call the functions
 * in THIS file — it has to have its own. The two writers are deliberate
 * siblings, not a gap to "deduplicate": each one is the correct writer for
 * its own trust boundary, and merging them would mean one of the two zones
 * reaching across the fence `./shared.ts`'s header describes.
 */

/** One `SupportMessage` row as `postMerchantMessage`/`postSystemMessage` return. */
export type { SupportMessageRow };

/**
 * A merchant writes into their own thread, optionally with up to four image
 * attachments (ADM-05 / plan 06-11).
 *
 * `authorUserId` is the merchant's own `userId` from `MerchantContext` — never
 * a parameter a caller could substitute for another merchant's. The Server
 * Action in `actions.ts` is the only caller, and it passes `ctx.userId`
 * straight from `requireMerchantContext()`.
 *
 * ---------------------------------------------------------------------------
 * ONE TRANSACTION, MESSAGE THEN ATTACHMENTS. NEVER TWO WRITES A CRASH COULD
 * SPLIT.
 * ---------------------------------------------------------------------------
 * `src/app/api/upload/thread-finalize/route.ts` already derived and stored
 * the bytes before this function ever runs — see that route's own header for
 * why it writes no row. This function is the caller that DOES know whether
 * the message succeeded, so the `SupportMessage` row and its
 * `SupportAttachment` rows are written inside one `scopedDb(tenantId)`
 * transaction: if the transaction fails, no attachment row exists and the
 * merchant sees a send failure with their typed text intact (T-06-37) rather
 * than a message that silently lost its picture.
 *
 * `SupportAttachment.messageId` is a scalar on a `createMany` batch rather
 * than a nested `create`, for the same Pitfall 1/4 reason
 * `ProductImageCreateManyInput` is: the tenant-scope extension does not
 * intercept nested writes, and `createMany` is one of the batch operations it
 * DOES intercept.
 */
export async function postMerchantMessage(
  tenantId: string,
  authorUserId: string,
  body: string,
  attachments: readonly ThreadAttachmentInput[] = [],
): Promise<SupportMessageRow> {
  return scopedDb(tenantId).$transaction(async (tx: ScopedTx) => {
    const created = await tx.supportMessage.create({
      data: scopedCreateData<SupportMessageCreateInput>({
        author: "MERCHANT",
        authorUserId,
        body,
      }),
      select: { id: true },
    });

    if (attachments.length > 0) {
      await tx.supportAttachment.createMany({
        data: attachments.map((attachment) =>
          scopedCreateData<SupportAttachmentCreateManyInput>({
            messageId: created.id,
            // Images only in this plan (D-22's DOCUMENT path is plan 06-13).
            kind: "IMAGE",
            storageKey: attachment.storageKey,
            contentType: attachment.contentType,
            byteSize: attachment.byteSize,
            width: attachment.width,
            height: attachment.height,
          }),
        ),
      });
    }

    // Re-selected rather than assembled by hand: the attachment rows just
    // written carry server-generated ids and timestamps this function never
    // saw, and `SupportMessageRow` is the one shape every surface renders.
    return tx.supportMessage.findUniqueOrThrow({
      where: { id: created.id },
      select: MESSAGE_SELECT,
    });
  });
}

/**
 * Post an automated notice into a merchant's thread. The primitive every
 * later phase's system message calls.
 *
 * ---------------------------------------------------------------------------
 * THE ONE FUNCTION EVERY FUTURE AUTOMATED NOTICE SHOULD REUSE.
 * ---------------------------------------------------------------------------
 * D-15's suspension notice (plan 06-14) is the first caller and not the last:
 * ROADMAP's v2.0 reconciliation note makes this thread the only real
 * notification channel Phases 7-15 can rely on (`resend` has no other wired
 * send call). A generic "post a system message" primitive is what lets each
 * of those phases add one call instead of inventing its own writer.
 *
 * `authorUserId` is always `null` — an automated message has no human to
 * name, and `SupportMessageRow.authorUserId`'s own doc comment states this is
 * the SYSTEM author's defining property.
 *
 * `options.tx` accepts an optional transaction client so a caller can post
 * the notice INSIDE the same transaction as the state change it announces —
 * the suspension write and its own audit message must commit together or not
 * at all, or a crash between the two leaves a suspended store with no record
 * of why. When omitted, `scopedDb(tenantId)` is used directly.
 */
export async function postSystemMessage(
  tenantId: string,
  body: string,
  options?: { subscriptionClaimId?: string; tx?: ScopedTx },
): Promise<void> {
  const client = options?.tx ?? scopedDb(tenantId);

  await client.supportMessage.create({
    data: scopedCreateData<SupportMessageCreateInput>({
      author: "SYSTEM",
      authorUserId: null,
      body,
      subscriptionClaimId: options?.subscriptionClaimId,
    }),
  });
}

/**
 * Mark every message the merchant has not read as read, as of now.
 *
 * Idempotent by construction: an `updateMany` with `readByMerchantAt: null`
 * in its `where` clause writes nothing on a second call. The author set comes
 * from `UNREAD_BY_MERCHANT_AUTHORS` (`./shared.ts`) so this predicate can
 * never drift from the one the unread badge and the "New" divider use.
 */
export async function markThreadReadForMerchant(
  tenantId: string,
): Promise<void> {
  await scopedDb(tenantId).supportMessage.updateMany({
    where: {
      author: { in: [...UNREAD_BY_MERCHANT_AUTHORS] },
      readByMerchantAt: null,
    },
    data: { readByMerchantAt: new Date() },
  });
}
