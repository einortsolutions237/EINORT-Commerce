import { Info, LoaderCircle } from "lucide-react";

import { formatAbsoluteTime, formatRelativeTime } from "@/app/(dashboard)/dashboard/orders/format";
import { cn } from "@/lib/utils";
import { strings } from "@/lib/strings";
import type { SupportMessageRow } from "@/server/support/shared";

/**
 * ONE message, rendered by a single `viewer` prop — 06-UI-SPEC.md § S.
 *
 * ---------------------------------------------------------------------------
 * ONE COMPONENT, TWO SURFACES. THE MIRROR IS A PROP, NEVER A FORK.
 * ---------------------------------------------------------------------------
 * `/dashboard/support` (this plan) renders `viewer="MERCHANT"`; plan 06-12's
 * `/admin/support/[tenantId]` renders `viewer="PLATFORM"` against the SAME
 * file. `isOwn` below is the one expression that decides which side of the
 * conversation `row.author` belongs to — right-aligned and slate-tinted for
 * the viewer's own messages, left-aligned and white with a hairline border
 * for the other party's. There is no second bubble component and there must
 * never be one: a fork here is the exact regression § S calls out by name.
 *
 * ---------------------------------------------------------------------------
 * OWN-SIDE BUBBLES ARE SLATE-100, NOT BLUE.
 * ---------------------------------------------------------------------------
 * A column of `--primary` fills would be the single largest spend of the
 * accent anywhere in the product and would leave nothing for the composer's
 * `Send`. Alignment plus the author label is a sufficient, conventional
 * signal on its own.
 *
 * ---------------------------------------------------------------------------
 * T-06-36 — LINKS ARE NOT AUTO-LINKIFIED, AND THAT IS NOT AN OVERSIGHT.
 * ---------------------------------------------------------------------------
 * Message bodies render as plain text, preserving the author's own line
 * breaks and wrapping long unbroken runs, so a pasted transaction reference
 * cannot blow the bubble past its column. Turning merchant-supplied text
 * into markup — auto-linkifying a URL, say — is a phase of its own with its
 * own XSS surface; do not add it casually because a merchant pasted a link.
 *
 * ---------------------------------------------------------------------------
 * T-06-38 — WHETHER A MESSAGE WAS READ IS NEVER RENDERED HERE, ON EITHER SIDE.
 * ---------------------------------------------------------------------------
 * `SupportMessageRow` does not even carry the two read-tracking timestamps
 * (see that type's own header) — they exist only to count unread messages
 * and to position the one-shot "New" divider, never to be displayed. There
 * is nothing to withhold here by discipline; the DTO already withholds it
 * structurally.
 */

/** The two sides a message can render as. `SYSTEM` never reaches this union — it takes its own branch below. */
export type SupportViewer = "MERCHANT" | "PLATFORM";

export interface MessageBubbleProps {
  readonly row: SupportMessageRow;
  /** Which side of the conversation is reading this render — never which side wrote the message. */
  readonly viewer: SupportViewer;
  /**
   * `EINORT` on `/dashboard/support`, the store's name on
   * `/admin/support/[tenantId]`. Data, not copy — the caller resolves it,
   * this component never guesses at a name.
   */
  readonly authorOtherLabel: string;
  /**
   * The optimistic-send state (06-UI-SPEC.md § S / T-06-37): `opacity-70`,
   * no timestamp, a spinner where the time would be. Only ever true for a
   * bubble the composer is still waiting on the server for — never a
   * property of a row that came back from `threadForMerchant`.
   */
  readonly pending?: boolean;
  /**
   * Plan 06-11 fills this with the attachment grid. A NAMED, EMPTY slot —
   * not a disabled `paperclip` affordance — so nothing here has to change
   * when attachments land; the grid simply arrives as this prop's value.
   */
  readonly attachmentsSlot?: React.ReactNode;
}

/** `strings.support.thread.meta` is `"{author} · {time}"` — split once, on `{time}`, so the pending state can swap a spinner in for the text half without hand-writing a second template. */
function splitMetaTemplate(authorLabel: string): readonly [string, string] {
  const withAuthor = strings.support.thread.meta.replace(
    "{author}",
    authorLabel,
  );
  const [prefix, suffix] = withAuthor.split("{time}");
  return [prefix ?? "", suffix ?? ""];
}

export function MessageBubble({
  row,
  viewer,
  authorOtherLabel,
  pending = false,
  attachmentsSlot,
}: MessageBubbleProps) {
  /*
   * SYSTEM messages are a platform EVENT, not a turn in the conversation —
   * full width, centered, no bubble. Rendering them through the own/other
   * branch below would make D-15's suspension notice read as if a person
   * typed it, which is exactly what § S rules out.
   */
  if (row.author === "SYSTEM") {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3">
        <Info aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <p className="text-sm leading-normal font-semibold text-foreground">
          {row.body}
        </p>
      </div>
    );
  }

  // The mirror, as one expression: which side wrote this is `row.author`;
  // which side is reading it is `viewer`. Own when they agree.
  const isOwn = row.author === viewer;

  const authorLabel = isOwn
    ? strings.support.thread.authorSelf
    : authorOtherLabel;

  const [metaPrefix, metaSuffix] = splitMetaTemplate(authorLabel);
  const absoluteTime = formatAbsoluteTime(row.createdAt);
  const relativeTime = formatRelativeTime(row.createdAt);

  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div className="flex max-w-[85%] flex-col gap-1">
        <div
          className={cn(
            "text-sm leading-normal font-semibold text-muted-foreground",
            isOwn ? "text-right" : "text-left",
          )}
        >
          <span>{metaPrefix}</span>
          {pending ? (
            <LoaderCircle
              aria-hidden="true"
              role="img"
              aria-label={strings.support.thread.messagePending}
              className="inline size-3.5 animate-spin align-[-2px]"
            />
          ) : (
            <span title={absoluteTime}>{relativeTime}</span>
          )}
          <span>{metaSuffix}</span>
        </div>

        <div
          className={cn(
            "max-w-[42rem] rounded-lg px-4 py-3",
            isOwn ? "bg-secondary" : "border border-border bg-card",
            pending && "opacity-70",
          )}
        >
          <p className="text-base leading-normal font-normal whitespace-pre-wrap break-words text-foreground">
            {row.body}
          </p>

          {attachmentsSlot}
        </div>
      </div>
    </div>
  );
}
