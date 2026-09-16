import { Badge } from "@/components/ui/badge";
import { strings } from "@/lib/strings";
import { publicUrlFor } from "@/server/images/r2";
import type { SupportMessageRow } from "@/server/support/shared";

import { MessageBubble, type SupportViewer } from "./message-bubble";

/**
 * The append-only transcript — 06-UI-SPEC.md § S / D-12.
 *
 * ---------------------------------------------------------------------------
 * `createdAt ASC`, NEVER RE-ORDERED, NEVER THREADED. THIS IS A TRANSCRIPT.
 * ---------------------------------------------------------------------------
 * `threadForMerchant` (plan 06-06) already rides `createdAt asc` server-side,
 * and this component trusts that order rather than re-sorting: a re-sort
 * here would silently paper over a query regression instead of surfacing it.
 * `rows` is rendered exactly as given.
 *
 * ---------------------------------------------------------------------------
 * THE "New" DIVIDER IS ONE-SHOT, DRIVEN BY A TIMESTAMP THE SERVER COMPUTED.
 * ---------------------------------------------------------------------------
 * `firstUnreadAt` comes from `firstUnreadForMerchant`, read BEFORE the
 * page's own load calls `markThreadReadForMerchant` — see that ordering
 * note in `page.tsx`. It is a boundary between two rows, not a property of
 * one, so it is compared against every row's `createdAt` rather than
 * matched against a single message id, and it never moves after the first
 * render: this component does not recompute it once the thread is marked
 * read.
 *
 * ---------------------------------------------------------------------------
 * NO STATE, NO HOOKS. THIS RENDERS SERVER-SIDE LIKE THE REST OF THE PAGE.
 * ---------------------------------------------------------------------------
 * Nothing here is interactive — day separators and the "New" divider are
 * pure functions of `rows` and `firstUnreadAt` — so this file carries no
 * `"use client"` directive. `MessageBubble` is imported unchanged; it is
 * equally at home rendered from here (server) or from `composer.tsx`
 * (client, for the optimistic pending bubble), because it holds no state
 * of its own either.
 *
 * ---------------------------------------------------------------------------
 * `renderBelowMessage` — THE NAMED SLOT SUB-03 / D-20 (PLAN 06-16) FILLS,
 * NEVER A SPECIAL CASE INSIDE `MessageBubble`.
 * ---------------------------------------------------------------------------
 * A `SYSTEM` message carrying a non-null `subscriptionClaimId` renders the
 * read-only `SubscriptionClaimCard` inline, below its own row — on BOTH
 * `/dashboard/support` and `/admin/support/[tenantId]`. This component and
 * `MessageBubble` hold NO subscription-specific knowledge either way: they
 * expose one generic, optional, synchronous callback over a `row`, and the
 * PAGE decides what (if anything) renders below it. That is what keeps this
 * pair "surface-agnostic" per 06-UI-SPEC.md § C6 — a fork inside
 * `MessageBubble` for one claim type would be the first of many, and the
 * next surface-specific inline card would either fork it again or reach for
 * the same slot this one already provides.
 *
 * Synchronous and pure by contract: `MessageList` never awaits anything, so
 * a caller must already have resolved whatever the slot needs (here, the
 * thread's own subscription claims, fetched in ONE batched query keyed by
 * the ids collected from `rows` before this component ever renders — never
 * one query per message) and hand down a plain lookup closure.
 */

export interface MessageListProps {
  readonly rows: readonly SupportMessageRow[];
  readonly viewer: SupportViewer;
  /** `EINORT` on `/dashboard/support`, the store's name on `/admin/support/[tenantId]`. */
  readonly authorOtherLabel: string;
  /** `firstUnreadForMerchant`'s result — `null` when nothing is unread. */
  readonly firstUnreadAt: Date | null;
  /** See the header. `undefined`/`null`/anything falsy renders nothing extra. */
  readonly renderBelowMessage?: (row: SupportMessageRow) => React.ReactNode;
}

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

/**
 * ADM-05 (plan 06-11) — turns a persisted `IMAGE` attachment's derivative
 * PREFIX into its publicly reachable URL, resolved HERE, server-side, before
 * it ever reaches `MessageBubble`.
 *
 * `publicUrlFor` (`src/server/images/r2.ts`) is `server-only`. This module
 * carries no `"use client"` directive and is rendered from
 * `/dashboard/support/page.tsx`, a Server Component, so importing it here is
 * safe — but `MessageBubble` is ALSO imported by `composer.tsx` (a Client
 * Component, for the optimistic pending bubble), so the resolved closure is
 * handed down as a PROP rather than `MessageBubble` importing `publicUrlFor`
 * itself. See that component's own header for the full reasoning: a
 * `server-only` import anywhere in ITS static import graph would fail the
 * client build regardless of whether the code path actually runs.
 *
 * `full.webp` is the `thread` preset's one derivative label
 * (`src/server/images/pipeline.ts`).
 */
function resolveThreadAttachmentUrl(storageKey: string): string {
  return publicUrlFor(`${storageKey}/full.webp`);
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `Today`, `Yesterday`, or a formatted date — compared against the render's own clock, once. */
function dayLabel(date: Date, now: Date): string {
  if (isSameCalendarDay(date, now)) {
    return strings.support.thread.separatorToday;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameCalendarDay(date, yesterday)) {
    return strings.support.thread.separatorYesterday;
  }

  return DAY_LABEL_FORMATTER.format(date);
}

/** A centered Label/muted chip on a `--border` rule — shared shape for the day separator and the "New" divider. */
function DividerRow({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden="true" className="h-px flex-1 bg-border" />
      {children}
      <div aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}

export function MessageList({
  rows,
  viewer,
  authorOtherLabel,
  firstUnreadAt,
  renderBelowMessage,
}: MessageListProps) {
  // One clock for the whole render, so no row can compare against a moment
  // slightly later than the row rendered just before it.
  const now = new Date();

  const items: React.ReactNode[] = [];
  let previousDay: Date | null = null;
  let newDividerPlaced = false;

  for (const row of rows) {
    const crossedDay =
      previousDay === null || !isSameCalendarDay(previousDay, row.createdAt);

    if (crossedDay) {
      items.push(
        <DividerRow key={`day-${row.id}`}>
          <span className="text-sm leading-normal font-semibold text-muted-foreground">
            {dayLabel(row.createdAt, now)}
          </span>
        </DividerRow>,
      );
    }

    const isFirstUnread =
      !newDividerPlaced &&
      firstUnreadAt !== null &&
      row.createdAt.getTime() >= firstUnreadAt.getTime();

    if (isFirstUnread) {
      newDividerPlaced = true;
      items.push(
        <DividerRow key={`new-${row.id}`}>
          <Badge variant="outline">{strings.support.thread.newDivider}</Badge>
        </DividerRow>,
      );
    }

    items.push(
      <MessageBubble
        key={row.id}
        row={row}
        viewer={viewer}
        authorOtherLabel={authorOtherLabel}
        resolveAttachmentUrl={resolveThreadAttachmentUrl}
      />,
    );

    // The named slot. Synchronous, pure, and optional — see the header.
    const belowContent = renderBelowMessage?.(row);
    if (belowContent) {
      items.push(<div key={`below-${row.id}`}>{belowContent}</div>);
    }

    previousDay = row.createdAt;
  }

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label={strings.support.thread.logLabel}
      className="flex flex-col gap-4"
    >
      {items}
    </div>
  );
}
