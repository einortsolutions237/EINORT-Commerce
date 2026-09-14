import "server-only";

import { adminDb } from "@/server/db/admin";
import type { SupportAuthor } from "@/server/db/enums";

import { UNREAD_BY_PLATFORM_AUTHORS, type SupportMessageRow } from "../support/shared";

/**
 * ADM-05 — the platform owner's half of the support thread (06-UI-SPEC.md
 * § C5 / § C6), and the admin-zone writer for the SAME table the merchant
 * side's message writer (plan 06-06) writes from the other direction.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE IS THE ADMIN ZONE. IT MAY IMPORT ONLY `./shared.ts` FROM THE
 * SUPPORT DOMAIN — NEVER THE MERCHANT SIDE'S OWN READ OR WRITE MODULE.
 * ---------------------------------------------------------------------------
 * The merchant side's own read and write modules (plan 06-06, siblings of
 * this file one directory over) reach Postgres through the tenant-PREDICATE
 * client that injects a caller's organization id into every operation, and
 * `eslint.config.mjs` forbids `src/server/admin` from importing the module
 * that builds that client at all — so this module could not call into either
 * even by accident, and it does not try to. `./shared.ts` (imported above as
 * `../support/shared`) is the one file in that directory this zone may read:
 * it is types plus two frozen arrays, holds no database client, and exists
 * specifically so both sides of the conversation agree on what "unread"
 * means (`UNREAD_BY_PLATFORM_AUTHORS` — see its own header). The two writers
 * below are deliberate SIBLINGS of the merchant side's own message writers,
 * not a gap to "deduplicate": merging them would mean one of the two zones
 * reaching across the fence `shared.ts`'s header describes, and TEN-05 asks
 * for exactly that fence.
 *
 * ---------------------------------------------------------------------------
 * `adminDb` IS UNSCOPED. EVERY OPERATION BELOW NAMES `tenantId` EXPLICITLY.
 * ---------------------------------------------------------------------------
 * On the merchant path the predicate client's Prisma Client Extension
 * injects the tenant predicate into every operation automatically, so a reviewer never
 * has to check each call site by hand. Nothing injects it here: `adminDb` is
 * the bare, unscoped client (`src/server/db/admin.ts`), and the platform
 * owner's authorization comes from `requireAdminContext()` one layer up
 * (`support-actions.ts`), not from a predicate underneath these queries. So
 * every `where` and every `create`/`createMany` payload below names
 * `tenantId` itself, even on `threadForAdmin`, whose caller could technically
 * rely on an id alone — naming it anyway keeps every operation in this file
 * legible as tenant-aware at a glance, the same discipline
 * `src/server/admin/claims.ts`'s header states at length.
 *
 * ---------------------------------------------------------------------------
 * THE UNREAD COUNTS ARE `groupBy`/`count` READS. THEY ARE NOT COUNTER
 * COLUMNS. DO NOT "OPTIMIZE" THEM.
 * ---------------------------------------------------------------------------
 * `unreadByTenant` is the ONE query that feeds both D-11 consumers: the
 * per-thread badge on each inbox row, and — via `unreadThreadCount`, which
 * reuses its result rather than running a second query — the admin rail's
 * total badge. A denormalized counter would need to be incremented on every
 * merchant message, decremented on every platform mark-read, and would drift
 * the first time one of those sites forgot. A number derived from the rows
 * cannot drift from the rows — the merchant side's own read module makes
 * this argument at length (plan 06-06) and it is the same argument here.
 *
 * ---------------------------------------------------------------------------
 * THE INBOX ROW CAP IS HONEST ABOUT PILOT SCALE, NOT A HIDDEN CEILING.
 * ---------------------------------------------------------------------------
 * `ADMIN_INBOX_ROW_CAP` below bounds `inboxForAdmin` at a fleet size this
 * pilot will not approach. A platform running many thousands of stores at
 * once would exceed it and the inbox would silently drop its tail —
 * revisiting this with pagination is a follow-up for whenever pilot volume
 * approaches it, not a correctness bug today. Same idiom as
 * `ADMIN_MERCHANT_LEDGER_ROW_CAP` (`src/server/admin/queries.ts`) and
 * `REVENUE_WINDOW_ROW_CAP` (`src/server/dashboard/queries.ts`).
 *
 * ---------------------------------------------------------------------------
 * `inboxForAdmin` IS THREE PARALLEL READS PLUS ONE DEPENDENT ONE, MERGED IN
 * JS. NO RAW SQL, ANYWHERE IN THIS FILE.
 * ---------------------------------------------------------------------------
 * Raw SQL escape hatches are banned repository-wide (`eslint.config.mjs`,
 * verified empirically not to be intercepted by the tenant extension), so
 * "every merchant, with their latest message and unread count, unread-first"
 * cannot be one query. `adminDb.organization.findMany` (the fleet),
 * `adminDb.supportMessage.groupBy` for the latest timestamp per tenant, and
 * `adminDb.supportMessage.groupBy` for the unread count per tenant run in one
 * `Promise.all`. The actual preview text and its author cannot come from
 * either `groupBy` — `_max` returns the timestamp, not the row it belongs
 * to — so a fourth read resolves the exact `(tenantId, createdAt)` pairs the
 * first `groupBy` already found into their full rows. That read is
 * DEPENDENT, not parallel: it cannot run until the timestamps are known,
 * which is why it is not inside the `Promise.all`. Every result is then
 * merged into `InboxRow[]` and sorted by § C5's rule in JS, exactly as
 * `listMerchantsForAdmin` (`src/server/admin/queries.ts`) merges its own
 * three parallel reads by `Map`.
 *
 * ---------------------------------------------------------------------------
 * READ RECEIPTS ARE NEVER SELECTED INTO A ROW DTO.
 * ---------------------------------------------------------------------------
 * 06-UI-SPEC.md § S: `readByMerchantAt`/`readByPlatformAt` exist to COUNT
 * unread messages and to position the one-shot "New" divider, never to
 * render "seen" to either party. Both columns appear below only inside a
 * `where` clause (`markThreadReadForPlatform`, `firstUnreadForPlatform`),
 * never inside a `select` that could reach a component — `SupportMessageRow`
 * (`./shared.ts`) already omits them from the shape both surfaces render.
 */

/** See the header. Pilot scale, not a hard platform ceiling. */
const ADMIN_INBOX_ROW_CAP = 1000;

/**
 * The columns every thread read needs, named once so `threadForAdmin` and
 * `postPlatformMessage`'s post-write re-select cannot drift on which ones
 * they pick — mirrors `messages.ts`'s own `MESSAGE_SELECT` on the merchant
 * side, restated here rather than imported because that module lives in the
 * fenced-off scoped zone.
 */
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
 * One image attachment as `support-actions.ts`'s Zod schema hands it down,
 * after the admin mint door (`src/server/images/thread-upload.ts`,
 * `requestAdminThreadAttachmentUpload`) has already derived and stored it.
 * `width`/`height` are non-null for the identical reason
 * `messages.ts`'s `ThreadAttachmentInput` states: this plan is images-only.
 */
export interface PlatformThreadAttachmentInput {
  readonly storageKey: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A narrow, structural transaction-client shape — `postSystemMessageAsAdmin`
 * accepts an optional one so a caller (plan 06-14's suspend, plan 06-16's
 * subscription decisions) can write the notice inside the SAME transaction
 * as the state change it announces. Modeled on `OrderWriteTx`
 * (`src/server/orders/write-client.ts`): narrow rather than the full
 * `AdminDb`/transaction-client type, because `src/server/admin` cannot
 * name a generated Prisma type directly (`eslint.config.mjs`'s default-zone
 * `no-restricted-imports` bans a `generated/prisma` import everywhere except
 * the three sanctioned `src/server/db`-adjacent directories, and this is not
 * one of them). `adminDb` and any `adminDb.$transaction` callback both
 * satisfy this structurally — no cast needed at any call site.
 */
interface AdminSupportWriteTx {
  readonly supportMessage: {
    create(args: {
      data: {
        tenantId: string;
        author: SupportAuthor;
        authorUserId: string | null;
        body: string;
        subscriptionClaimId?: string;
      };
    }): Promise<unknown>;
  };
}

/**
 * How many unread (author `MERCHANT`, `readByPlatformAt` null) messages are
 * waiting, per tenant. The ONE query behind both D-11 consumers — see the
 * header. Keyed by `tenantId` rather than by store name: callers that need a
 * name already have `inboxForAdmin`'s rows or `merchantDetailForAdmin`'s own
 * read, and duplicating a name lookup here would be a second join for
 * something no caller of this function has asked for.
 */
export async function unreadByTenant(): Promise<Map<string, number>> {
  const groups = await adminDb.supportMessage.groupBy({
    by: ["tenantId"],
    where: {
      author: { in: [...UNREAD_BY_PLATFORM_AUTHORS] },
      readByPlatformAt: null,
    },
    _count: { _all: true },
  });

  return new Map(groups.map((group) => [group.tenantId, group._count._all]));
}

/**
 * How many threads, across the whole fleet, have at least one unread
 * message — the admin rail's total badge (D-07 / D-11). Derived from
 * `unreadByTenant`'s own map rather than a second `count()`: the `groupBy`
 * behind it already returns exactly one row per tenant with at least one
 * unread message, so the map's size IS this number. Not a counter column —
 * see the header.
 */
export async function unreadThreadCount(): Promise<number> {
  const byTenant = await unreadByTenant();
  return byTenant.size;
}

/** One row of the § C5 flat inbox. */
export interface InboxRow {
  readonly tenantId: string;
  readonly storeName: string;
  /** `null` when this merchant has never sent nor received a message. */
  readonly lastMessageBody: string | null;
  readonly lastMessageAuthor: SupportAuthor | null;
  readonly lastMessageAt: Date | null;
  readonly unreadCount: number;
}

/**
 * The § C5 inbox: every merchant, unread first (most recent unread at the
 * top), then read threads by most recent message, then merchants with no
 * messages at all, alphabetically by store name. See the header for the
 * read shape (three parallel reads plus one dependent read, merged in JS).
 */
export async function inboxForAdmin(): Promise<InboxRow[]> {
  const [organizations, latestByTenant, unreadGroups] = await Promise.all([
    adminDb.organization.findMany({
      select: { id: true, name: true },
      take: ADMIN_INBOX_ROW_CAP,
    }),
    adminDb.supportMessage.groupBy({
      by: ["tenantId"],
      _max: { createdAt: true },
    }),
    adminDb.supportMessage.groupBy({
      by: ["tenantId"],
      where: {
        author: { in: [...UNREAD_BY_PLATFORM_AUTHORS] },
        readByPlatformAt: null,
      },
      _count: { _all: true },
    }),
  ]);

  // The dependent read: resolve the exact (tenantId, createdAt) pairs the
  // first groupBy found into their full rows, so the preview can show a body
  // and an author — neither of which `_max` can return. Cannot run in
  // parallel with the three above; it needs their result.
  const latestPairs = latestByTenant
    .filter(
      (row): row is typeof row & { _max: { createdAt: Date } } =>
        row._max.createdAt !== null,
    )
    .map((row) => ({ tenantId: row.tenantId, createdAt: row._max.createdAt }));

  const lastMessages =
    latestPairs.length > 0
      ? await adminDb.supportMessage.findMany({
          where: {
            OR: latestPairs.map((pair) => ({
              tenantId: pair.tenantId,
              createdAt: pair.createdAt,
            })),
          },
          select: { tenantId: true, author: true, body: true, createdAt: true },
        })
      : [];

  const lastMessageByTenant = new Map(
    lastMessages.map((message) => [message.tenantId, message] as const),
  );
  const unreadCountByTenant = new Map(
    unreadGroups.map((group) => [group.tenantId, group._count._all] as const),
  );

  const rows: InboxRow[] = organizations.map((org) => {
    const last = lastMessageByTenant.get(org.id);
    return {
      tenantId: org.id,
      storeName: org.name,
      lastMessageBody: last?.body ?? null,
      lastMessageAuthor: last?.author ?? null,
      lastMessageAt: last?.createdAt ?? null,
      unreadCount: unreadCountByTenant.get(org.id) ?? 0,
    };
  });

  return rows.sort(compareInboxRows);
}

/**
 * § C5's ordering, as a comparator: unread first (most recent unread at the
 * top), then read threads by most recent message, then merchants with no
 * messages at all, alphabetically. A merchant who has never messaged still
 * sorts into the list — see § C5's own rule and `inbox.emptyBody`'s copy.
 */
function compareInboxRows(a: InboxRow, b: InboxRow): number {
  const aUnread = a.unreadCount > 0;
  const bUnread = b.unreadCount > 0;
  if (aUnread !== bUnread) return aUnread ? -1 : 1;

  const aHasMessage = a.lastMessageAt !== null;
  const bHasMessage = b.lastMessageAt !== null;
  if (aHasMessage !== bHasMessage) return aHasMessage ? -1 : 1;

  if (aHasMessage && bHasMessage) {
    // Both unread-with-a-message, or both read-with-a-message: most recent
    // first either way.
    return (b.lastMessageAt as Date).getTime() - (a.lastMessageAt as Date).getTime();
  }

  // Neither has ever exchanged a message: alphabetical by store name.
  return a.storeName.localeCompare(b.storeName);
}

/**
 * One merchant's whole conversation, oldest first (D-12) — the admin-zone
 * mirror of `threadForMerchant`. `createdAt asc` is never re-ordered, for the
 * identical reason stated there: this is a transcript, not a feed, and both
 * parties must read the same sequence.
 */
export async function threadForAdmin(
  merchantId: string,
): Promise<readonly SupportMessageRow[]> {
  return adminDb.supportMessage.findMany({
    where: { tenantId: merchantId },
    orderBy: { createdAt: "asc" },
    select: MESSAGE_SELECT,
  });
}

/**
 * When the platform owner's first unread message in this thread arrived, or
 * `null` — the admin-zone mirror of `firstUnreadForMerchant`. Resolved once,
 * server-side, at load: § S's "New" divider is positioned when the page
 * loads and does not move afterwards, which is only possible if this is read
 * BEFORE `markThreadReadForPlatform` runs. Callers must preserve that order —
 * see `/admin/support/[tenantId]/page.tsx`'s own comment.
 */
export async function firstUnreadForPlatform(
  merchantId: string,
): Promise<Date | null> {
  const first = await adminDb.supportMessage.findFirst({
    where: {
      tenantId: merchantId,
      author: { in: [...UNREAD_BY_PLATFORM_AUTHORS] },
      readByPlatformAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  return first?.createdAt ?? null;
}

/**
 * Mark every message the platform owner has not read, in this one tenant's
 * thread, as read — the admin-zone mirror of `markThreadReadForMerchant`.
 * Idempotent by construction: an `updateMany` with `readByPlatformAt: null`
 * in its `where` writes nothing on a second call.
 */
export async function markThreadReadForPlatform(
  merchantId: string,
): Promise<void> {
  await adminDb.supportMessage.updateMany({
    where: {
      tenantId: merchantId,
      author: { in: [...UNREAD_BY_PLATFORM_AUTHORS] },
      readByPlatformAt: null,
    },
    data: { readByPlatformAt: new Date() },
  });
}

/**
 * The platform owner writes into one merchant's thread, optionally with up
 * to four image attachments — the admin-zone sibling of `postMerchantMessage`.
 *
 * `authorUserId` is always `ctx.userId` from `requireAdminContext()`, passed
 * down by `support-actions.ts` — never a value a caller could substitute.
 *
 * One transaction, message then attachments, for the identical reason
 * `postMerchantMessage` uses one: if it fails, no attachment row exists and
 * the owner sees a send failure with their typed text intact, rather than a
 * message that silently lost its picture. `tenantId` is supplied on every
 * write inside the transaction, because nothing here injects it.
 */
export async function postPlatformMessage(
  merchantId: string,
  authorUserId: string,
  body: string,
  attachments: readonly PlatformThreadAttachmentInput[] = [],
): Promise<SupportMessageRow> {
  return adminDb.$transaction(async (tx) => {
    const created = await tx.supportMessage.create({
      data: {
        tenantId: merchantId,
        author: "PLATFORM",
        authorUserId,
        body,
      },
      select: { id: true },
    });

    if (attachments.length > 0) {
      await tx.supportAttachment.createMany({
        data: attachments.map((attachment) => ({
          tenantId: merchantId,
          messageId: created.id,
          // Images only in this plan (D-22's DOCUMENT path is plan 06-13).
          kind: "IMAGE" as const,
          storageKey: attachment.storageKey,
          contentType: attachment.contentType,
          byteSize: attachment.byteSize,
          width: attachment.width,
          height: attachment.height,
        })),
      });
    }

    // Re-selected rather than assembled by hand — the attachment rows just
    // written carry server-generated ids and timestamps this function never
    // saw, matching `postMerchantMessage`'s own reasoning.
    return tx.supportMessage.findUniqueOrThrow({
      where: { id: created.id },
      select: MESSAGE_SELECT,
    });
  });
}

/**
 * Post an automated notice into a merchant's thread, from the admin zone —
 * the sibling of `postSystemMessage`, and the one function every later
 * plan's automated notice should reuse: plan 06-14's suspend/restore notices
 * and plan 06-16's subscription confirm/reject notices are its first
 * callers, not its last.
 *
 * `authorUserId` is always `null` — an automated message has no human to
 * name, matching `SupportMessageRow.authorUserId`'s own contract.
 *
 * `options.tx` accepts an optional transaction client (see
 * `AdminSupportWriteTx` above) so a caller can post the notice INSIDE the
 * same transaction as the state change it announces — a crash between a
 * suspension write and its own audit message must not leave a suspended
 * store with no record of why. When omitted, `adminDb` is used directly.
 */
export async function postSystemMessageAsAdmin(
  merchantId: string,
  body: string,
  options?: { subscriptionClaimId?: string; tx?: AdminSupportWriteTx },
): Promise<void> {
  const client = options?.tx ?? adminDb;

  await client.supportMessage.create({
    data: {
      tenantId: merchantId,
      author: "SYSTEM",
      authorUserId: null,
      body,
      subscriptionClaimId: options?.subscriptionClaimId,
    },
  });
}
