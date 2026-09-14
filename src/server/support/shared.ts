import type {
  SupportAttachmentKind,
  SupportAuthor,
} from "@/server/db/enums";

/**
 * ADM-05 / D-07..D-15 — the support thread's pure layer.
 *
 * ---------------------------------------------------------------------------
 * THIS IS THE ONLY FILE UNDER `src/server/support/**` THE ADMIN ZONE MAY READ.
 * ---------------------------------------------------------------------------
 * The merchant↔platform conversation is ONE table read from TWO zones with two
 * different clients, and the split is deliberate (06-RESEARCH.md § Recommended
 * Project Structure). Everything else in this directory — `queries.ts`,
 * `messages.ts`, `actions.ts` — reaches Postgres through the tenant-scoped
 * client, which carries the merchant's tenant predicate. The platform owner's
 * half lives in `src/server/admin/support.ts` and reads through the admin
 * client, which is deliberately unscoped because its authorization comes from
 * `requireAdminContext`, not from a tenant predicate.
 *
 * Neither client is NAMED anywhere in this file, and that is on purpose: "this
 * module holds no database client" is audited by a plain grep for those
 * identifiers, and a header that mentions them in prose turns a meaningful
 * audit into one that always reports a hit. `state-machine.ts` declines to name
 * the import it is forbidden to make for exactly the same reason.
 *
 * `eslint.config.mjs` forbids `src/server/admin/**` from importing
 * `src/server/db/tenant-scoped` at all, so an admin module importing this
 * directory's `queries.ts` would drag the scoped client across a fence the lint
 * rule exists to hold. That rule catches the direct import; it does not catch
 * every transitive path, and TEN-05's spirit is what matters rather than the
 * exact reach of one glob. So the rule is stated rather than merely enforced:
 * the admin zone imports `shared.ts` and nothing else from here.
 *
 * That is why this module holds NO database client, and why it does not open
 * with `import "server-only"` either. It is types plus two frozen arrays —
 * nothing here reaches a socket, and the marker would push a Client Component
 * that legitimately needs `SupportMessageRow` to render a bubble back toward
 * declaring its own duplicate of the shape. Same reasoning, for the same
 * reason, as `src/server/db/enums.ts`'s closing note. `state-machine.ts` is the
 * shape this file mirrors: pure, DB-free, and unit-testable on its own.
 */

/**
 * One attachment hanging off a message (D-10 / D-22).
 *
 * Present in the DTO from day one even though THIS plan writes no attachment —
 * plan 06-11 owns the write path. A row shape that gains a field later is a
 * consumer that has to change; a shape that is honest about the table from the
 * start is not.
 *
 * `kind` is not decoration and must never be inferred from `storageKey`: an
 * `IMAGE` row's key is an R2 derivative PREFIX served publicly, a `DOCUMENT`
 * row's key is the stored object itself served only through an authorized route
 * handler. Reading this column is the ONLY way a caller knows which of the two
 * storage contracts it is holding.
 */
export interface SupportAttachmentRow {
  readonly id: string;
  readonly kind: SupportAttachmentKind;
  /** Derivative PREFIX for `IMAGE`, the object key for `DOCUMENT`. Never a URL. */
  readonly storageKey: string;
  readonly contentType: string;
  /** Bytes as verified at finalize time, never as claimed by the uploader. */
  readonly byteSize: number;
  /** NULL for `DOCUMENT` — a PDF has no raster dimensions, and 0 would lie. */
  readonly width: number | null;
  readonly height: number | null;
}

/**
 * One message as every surface reads it.
 *
 * ---------------------------------------------------------------------------
 * `readByMerchantAt` AND `readByPlatformAt` ARE DELIBERATELY ABSENT.
 * ---------------------------------------------------------------------------
 * 06-UI-SPEC.md § S is explicit that read receipts are never shown to either
 * party: the two timestamps exist to COUNT unread messages and to position the
 * one-shot "New" divider, never to render "seen". Leaving them out of the DTO
 * is the structural half of that rule — a column that is never selected cannot
 * be rendered by accident, and no reviewer has to notice its absence from a
 * JSX file to keep the promise.
 *
 * Declared explicitly rather than inferred from Prisma, exactly as
 * `ClaimReviewRow` is: an inferred type silently gains whatever a later
 * `select` adds, which is how a column nobody decided to expose reaches a
 * component.
 */
export interface SupportMessageRow {
  readonly id: string;
  readonly author: SupportAuthor;
  /** `user.id` for MERCHANT/PLATFORM, NULL for SYSTEM — an automated message has no human to name. */
  readonly authorUserId: string | null;
  readonly body: string;
  readonly createdAt: Date;
  /** SUB-03: set only on the message that announced a subscription payment claim. */
  readonly subscriptionClaimId: string | null;
  readonly attachments: readonly SupportAttachmentRow[];
}

/** Which side of the conversation has not yet read a message from this author. */
type UnreadSide = "merchant" | "platform";

/**
 * Every author, and the side that counts its messages as unread.
 *
 * ---------------------------------------------------------------------------
 * THE EXHAUSTIVE TABLE IS THE POINT. THE TWO ARRAYS BELOW ARE DERIVED FROM IT.
 * ---------------------------------------------------------------------------
 * `Readonly<Record<SupportAuthor, …>>` typed against the FULL enum is what
 * makes a fourth `SupportAuthor` member a compile error at this table — the
 * same registry-as-data discipline `ORDER_TRANSITIONS`, `PLANS` and
 * `TENANT_SCOPED_MODELS` already use, and the reason each of them is a
 * `Record` rather than a list.
 *
 * Two hand-written arrays would NOT have that property: adding a member to the
 * enum would leave both of them still compiling, and the new author's messages
 * would simply never be counted as unread by anybody. That is the worst shape
 * of bug this surface can have — silent, invisible in review, and discovered by
 * a merchant whose badge never lights up. So the arrays are derived rather than
 * duplicated, and there is exactly one place to update.
 */
const AUTHOR_UNREAD_SIDE: Readonly<Record<SupportAuthor, UnreadSide>> = {
  // The platform owner wrote it, so the merchant has not read it yet.
  PLATFORM: "merchant",
  // D-15's automated notices are addressed to the merchant and read like a
  // record in their transcript, so they light the MERCHANT's badge. The owner
  // does not need to be told about a message the platform itself generated.
  SYSTEM: "merchant",
  // The merchant wrote it, so it is waiting in the platform owner's inbox.
  MERCHANT: "platform",
};

/**
 * The `as SupportAuthor[]` cast is sound BECAUSE the record above is exhaustive
 * and typed: its keys are exactly the enum's members, which is the one case
 * where `Object.keys`' `string[]` return type is narrower in reality than in
 * the type system.
 */
function authorsUnreadFor(side: UnreadSide): readonly SupportAuthor[] {
  return (Object.keys(AUTHOR_UNREAD_SIDE) as SupportAuthor[]).filter(
    (author) => AUTHOR_UNREAD_SIDE[author] === side,
  );
}

/**
 * Authors whose messages the MERCHANT has not read: `PLATFORM` and `SYSTEM`.
 *
 * Consumed by `unreadForMerchant`, `firstUnreadForMerchant` and
 * `markThreadReadForMerchant`, so the predicate behind the badge, the divider
 * and the mark-read write is literally one value rather than three `in` lists
 * that agree today.
 */
export const UNREAD_BY_MERCHANT_AUTHORS: readonly SupportAuthor[] =
  authorsUnreadFor("merchant");

/**
 * Authors whose messages the PLATFORM OWNER has not read: `MERCHANT`.
 *
 * Exported from the shared layer, and used by `src/server/admin/support.ts`
 * (plan 06-12) rather than re-declared there. This constant is the entire
 * reason this file is importable from the admin zone: the two sides must agree
 * on what "unread" means, and a second copy across the fence is the drift that
 * makes one surface's badge disagree with the other's.
 */
export const UNREAD_BY_PLATFORM_AUTHORS: readonly SupportAuthor[] =
  authorsUnreadFor("platform");
