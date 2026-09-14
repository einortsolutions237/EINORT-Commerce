import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { strings } from "@/lib/strings";
import { requireAdminContext } from "@/server/admin/context";
import { inboxForAdmin, type InboxRow } from "@/server/admin/support";
import { cn } from "@/lib/utils";

import { formatRelativeTime } from "../format";

/**
 * `/admin/support` — the flat, unread-first inbox, § C5 (ADM-03 / ADM-05 /
 * D-08 / D-11).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireAdminContext()` is called here, not inherited from
 * `src/app/admin/layout.tsx` — the layout is a shell, not an authorization
 * boundary (see its own header). `React.cache()` makes the repeated call
 * free, matching every other page under this tree.
 *
 * ---------------------------------------------------------------------------
 * ONE CLOCK, AND EVERY RELATIVE TIME IS RESOLVED HERE, ON THE SERVER.
 * ---------------------------------------------------------------------------
 * Same discipline `/admin/page.tsx` and `/dashboard/claims/page.tsx` both
 * document at length: `Intl` formatted on the client renders against the
 * viewer's device locale, and two owners in two time zones (or the same
 * owner on two tabs) must read the same "3 days ago". `now` is read exactly
 * once so two rows a second apart cannot report relative times computed
 * against two different instants.
 *
 * ---------------------------------------------------------------------------
 * NO CLIENT ISLAND. UNLIKE `merchants-list.tsx`, THIS PAGE HAS NO FILTER AND
 * NO CLIENT-SIDE SORT TO HOST.
 * ---------------------------------------------------------------------------
 * § C5 rules a filter out explicitly (D-08) and the ordering is a property
 * of the server read (`inboxForAdmin`'s own comparator), not something a
 * viewer ever changes. There is therefore nothing here that needs to run in
 * the browser, and the whole page renders as one Server Component — a
 * `"use client"` row list would only exist to re-implement a sort nobody can
 * trigger.
 *
 * ---------------------------------------------------------------------------
 * UNREAD IS NEVER COLOUR-ONLY.
 * ---------------------------------------------------------------------------
 * § C5: unread rows set the store name to `--foreground`; read rows use
 * `--muted-foreground`. The blue count badge is the second, independent
 * signal — removing either one on its own must still leave the row
 * legible as unread.
 */

export const metadata: Metadata = {
  // Renders as "Inbox · EINORT" through the root layout's template.
  title: strings.admin.inbox.title,
};

interface InboxListItem {
  readonly tenantId: string;
  readonly storeName: string;
  readonly unread: boolean;
  readonly unreadCount: number;
  readonly previewText: string;
  readonly relativeTime: string | null;
}

/**
 * One row's preview text: `No messages yet.` when the merchant has never
 * exchanged one, the raw body otherwise, prefixed with `You: ` when the
 * platform owner wrote the last message — the prefix carries its own
 * trailing space (`strings.admin.inbox.lastMessagePrefix`'s own contract).
 */
function previewTextFor(row: InboxRow): string {
  if (row.lastMessageBody === null) return strings.admin.inbox.noMessagesPreview;
  const prefix =
    row.lastMessageAuthor === "PLATFORM" ? strings.admin.inbox.lastMessagePrefix : "";
  return `${prefix}${row.lastMessageBody}`;
}

function toListItem(row: InboxRow, now: Date): InboxListItem {
  return {
    tenantId: row.tenantId,
    storeName: row.storeName,
    unread: row.unreadCount > 0,
    unreadCount: row.unreadCount,
    previewText: previewTextFor(row),
    relativeTime: row.lastMessageAt === null ? null : formatRelativeTime(row.lastMessageAt, now),
  };
}

export default async function AdminSupportInboxPage() {
  await requireAdminContext();

  const rows = await inboxForAdmin();
  const now = new Date();
  const items = rows.map((row) => toListItem(row, now));

  const unreadThreadCount = items.filter((item) => item.unread).length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.admin.inbox.heading}
        </h1>
        <p className="text-base leading-normal font-normal text-muted-foreground">
          {unreadThreadCount === 0
            ? strings.admin.inbox.sublineEmpty
            : strings.admin.inbox.subline.replace("{n}", String(unreadThreadCount))}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <h2 className="font-heading text-lg leading-snug font-semibold text-foreground">
            {strings.admin.inbox.emptyHeading}
          </h2>
          <p className="max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {strings.admin.inbox.emptyBody}
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {items.map((item) => (
            <Link
              key={item.tenantId}
              href={`/admin/support/${item.tenantId}`}
              className="flex min-h-11 items-center justify-between gap-4 px-4 py-4 hover:bg-muted/50 lg:px-6"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "truncate text-sm leading-normal font-semibold",
                    item.unread ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.storeName}
                </span>
                <span className="line-clamp-1 text-base leading-normal font-normal text-muted-foreground">
                  {item.previewText}
                </span>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                {item.relativeTime !== null ? (
                  <span className="text-sm leading-normal font-semibold text-muted-foreground">
                    {item.relativeTime}
                  </span>
                ) : null}

                {item.unread ? (
                  <Badge variant="default" className="tabular-nums">
                    <span aria-hidden="true">{item.unreadCount}</span>
                    <span className="sr-only">
                      {strings.admin.inbox.unreadCountLabel.replace(
                        "{n}",
                        String(item.unreadCount),
                      )}
                    </span>
                  </Badge>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
