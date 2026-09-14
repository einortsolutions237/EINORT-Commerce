import { Badge } from "@/components/ui/badge";
import { strings } from "@/lib/strings";
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
 */

export interface MessageListProps {
  readonly rows: readonly SupportMessageRow[];
  readonly viewer: SupportViewer;
  /** `EINORT` on `/dashboard/support`, the store's name on `/admin/support/[tenantId]`. */
  readonly authorOtherLabel: string;
  /** `firstUnreadForMerchant`'s result — `null` when nothing is unread. */
  readonly firstUnreadAt: Date | null;
}

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

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
      />,
    );

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
