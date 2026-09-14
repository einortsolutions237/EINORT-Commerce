import "server-only";

import { scopedDb } from "@/server/db/tenant-scoped";

import {
  UNREAD_BY_MERCHANT_AUTHORS,
  type SupportMessageRow,
} from "./shared";

/**
 * ADM-05 — the merchant's half of the support thread, read-only.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE IS THE SCOPED ZONE. THE ADMIN ZONE MUST NOT IMPORT IT.
 * ---------------------------------------------------------------------------
 * Every read below goes through `scopedDb(tenantId)`, which injects the tenant
 * predicate into the `where` of each call. The platform owner's side of the
 * SAME table is a separate module — `src/server/admin/support.ts`, plan 06-12 —
 * reading through `adminDb`, because the owner legitimately reads across every
 * tenant and their authorization comes from `requireAdminContext` instead of
 * from a predicate. `eslint.config.mjs` forbids `src/server/admin/**` from
 * importing `src/server/db/tenant-scoped`, so importing this module from there
 * would pull the scoped client across that fence. `./shared.ts` is the one file
 * in this directory the admin zone may read; see its header.
 *
 * ---------------------------------------------------------------------------
 * THE BADGE IS A `count()`. IT IS NOT A COUNTER COLUMN. DO NOT "OPTIMIZE" IT.
 * ---------------------------------------------------------------------------
 * `unreadForMerchant` below is a real count read on every dashboard render, and
 * `prisma/schema.prisma`'s `SupportMessage` block says the same thing from the
 * schema side: DO NOT ADD A COUNTER COLUMN. The denormalized alternative looks
 * cheaper and is not — it is a second writer on a value the rows already
 * answer, and it has to be incremented when the platform owner replies,
 * incremented again when a `SYSTEM` notice is posted, and zeroed when the
 * merchant opens the thread. Miss one, or let one land outside the transaction
 * that wrote the message, and the badge lies. That is worse than no badge: it
 * either hides a message the merchant is waiting on or cries wolf until they
 * stop reading it. A number derived from the rows cannot drift from the rows —
 * the argument `src/server/claims/queries.ts` makes at length for the claims
 * badge, and it is the same argument here.
 *
 * There is deliberately no `SupportThread` model for the same reason. The
 * thread IS `SupportMessage WHERE tenantId = X ORDER BY createdAt`, so a thread
 * row would carry nothing but tallies that could disagree with it.
 *
 * ---------------------------------------------------------------------------
 * THE `tenantId` PARAMETER HERE IS CORRECT, AND IS NOT WHAT TEN-04 BANS.
 * ---------------------------------------------------------------------------
 * `tests/unit/no-tenant-id-param.test.ts` forbids a tenant identifier in an
 * exported signature under `src/server/merchant/**`,
 * `src/server/entitlements/**` and `src/server/admin/**`, because on those
 * surfaces the tenant must come from the session and a parameter would be a
 * field a caller could substitute. This module is not on that surface and is
 * not reachable from a client: it is `server-only`, it exports no Server
 * Action, and its callers — the `/dashboard/support` page and the dashboard
 * layout's badge (plan 06-09) — have already resolved the tenant through
 * `requireMerchantContext()`. The scan's own doc comment names this distinction
 * (`resolveTenantBySlug(slug)` is the precedent).
 *
 * The isolation guarantee stays structural rather than trusted: `scopedDb`
 * injects `tenantId` into every call it forwards, `SupportMessage` is
 * registered in `TENANT_SCOPED_MODELS`, and
 * `tests/isolation/model-registry-drift.test.ts` fails if it ever is not.
 */

/**
 * The whole conversation, oldest first (D-12).
 *
 * ---------------------------------------------------------------------------
 * `createdAt asc` IS THE ONLY ORDER, AND THE THREAD IS NEVER RE-GROUPED.
 * ---------------------------------------------------------------------------
 * Newest-first is the reflex for a feed; this is not a feed, it is a
 * transcript. A conversation read bottom-up is unintelligible, and the whole
 * point of D-12's "one continuous conversation, never archived or closed" is
 * that the merchant and the owner are reading the SAME sequence. So it is never
 * re-ordered by author, never bucketed into sub-threads, and never paginated
 * newest-first. The read rides `@@index([tenantId, createdAt])` end to end —
 * the predicate matches the first column and the sort matches the second — so
 * the order that is right for the reader is also the one Postgres answers
 * without a sort node.
 *
 * `select` is the explicit DTO and NOT the whole row. The two read-receipt
 * columns are absent on purpose (06-UI-SPEC.md § S — receipts are never shown
 * to either party); see `SupportMessageRow`'s own header. Attachments come
 * along in the same query rather than per message, because a thread is rendered
 * whole and fetching them per bubble would be an N+1 over a list whose length
 * is "however long this merchant has been a customer".
 */
export async function threadForMerchant(
  tenantId: string,
): Promise<readonly SupportMessageRow[]> {
  return scopedDb(tenantId).supportMessage.findMany({
    orderBy: { createdAt: "asc" },
    select: {
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
    },
  });
}

/**
 * How many messages are waiting for this merchant to read (D-11).
 *
 * Drives the count badge on the `Support` rail item, which renders only when
 * this is greater than zero — a zero badge is noise. This is the RELIABLE
 * notification channel on the merchant's side: `notify.ts`'s email is a nudge
 * that is allowed to fail, and this count is what makes that acceptable,
 * because a merchant who opens their dashboard sees the thread whether or not
 * any mail was ever delivered.
 *
 * The author set comes from `UNREAD_BY_MERCHANT_AUTHORS` rather than a literal
 * list, so this predicate, the divider's below, and `markThreadReadForMerchant`
 * cannot drift apart.
 *
 * Honest note on indexes: `SupportMessage` carries `@@index([tenantId,
 * createdAt])` and `@@index([author, readByPlatformAt, createdAt])`. The first
 * column of the former matches this predicate's tenant, and Postgres filters
 * the rest; the latter is the ADMIN direction's index and does not serve this
 * query. At pilot scale — tens of messages per tenant, one call per dashboard
 * render — that is the right trade, and adding a third index for it would cost
 * every message write to save a read that is already sub-millisecond. Revisit
 * this with a real plan from a real dataset, not from this comment.
 */
export async function unreadForMerchant(tenantId: string): Promise<number> {
  return scopedDb(tenantId).supportMessage.count({
    where: {
      author: { in: [...UNREAD_BY_MERCHANT_AUTHORS] },
      readByMerchantAt: null,
    },
  });
}

/**
 * When the merchant's first unread message arrived, or `null` (06-UI-SPEC § S).
 *
 * ---------------------------------------------------------------------------
 * RESOLVED ONCE, SERVER-SIDE, AT LOAD. THE DIVIDER IS NOT RECOMPUTED.
 * ---------------------------------------------------------------------------
 * § S specifies a ONE-SHOT "New" divider: it is positioned when the page loads
 * and it does not move afterwards, even as the merchant reads and even as the
 * page marks the thread read. Returning the boundary timestamp from the server
 * is what makes that possible — the component compares each message's
 * `createdAt` against this single value instead of re-deriving "unread" after
 * render, by which point `markThreadReadForMerchant` has already run and the
 * answer would be "nothing is unread" for every row.
 *
 * Returning the timestamp rather than the message id is deliberate: the divider
 * is rendered BEFORE the first unread message, which is a position between two
 * rows rather than a property of one, and a timestamp compares correctly even
 * if that exact message is not in the rendered window.
 */
export async function firstUnreadForMerchant(
  tenantId: string,
): Promise<Date | null> {
  const first = await scopedDb(tenantId).supportMessage.findFirst({
    where: {
      author: { in: [...UNREAD_BY_MERCHANT_AUTHORS] },
      readByMerchantAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  return first?.createdAt ?? null;
}
