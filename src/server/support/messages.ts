import "server-only";

import type { SupportMessageCreateInput } from "@/server/db/model-inputs";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";
import type { ScopedTx } from "@/server/db/tenant-scoped";

import { UNREAD_BY_MERCHANT_AUTHORS, type SupportMessageRow } from "./shared";

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
 * A merchant writes into their own thread.
 *
 * `authorUserId` is the merchant's own `userId` from `MerchantContext` — never
 * a parameter a caller could substitute for another merchant's. The Server
 * Action in `actions.ts` is the only caller, and it passes `ctx.userId`
 * straight from `requireMerchantContext()`.
 */
export async function postMerchantMessage(
  tenantId: string,
  authorUserId: string,
  body: string,
): Promise<SupportMessageRow> {
  const message = await scopedDb(tenantId).supportMessage.create({
    data: scopedCreateData<SupportMessageCreateInput>({
      author: "MERCHANT",
      authorUserId,
      body,
    }),
    select: {
      id: true,
      author: true,
      authorUserId: true,
      body: true,
      createdAt: true,
      subscriptionClaimId: true,
      attachments: {
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
    },
  });

  return message;
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
