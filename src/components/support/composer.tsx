"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { LoaderCircle, Send, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePlatformIsMac } from "@/hooks/use-platform-is-mac";
import { strings } from "@/lib/strings";
import { sendSupportMessage } from "@/server/support/actions";
import type { SupportMessageRow } from "@/server/support/shared";

import { MessageBubble } from "./message-bubble";

/**
 * The sticky composer, with an optimistic send — 06-UI-SPEC.md § A2 / § S.
 *
 * ---------------------------------------------------------------------------
 * `useOptimistic` HAS NO PRECEDENT IN THIS REPOSITORY. READ THIS BEFORE
 * TOUCHING IT.
 * ---------------------------------------------------------------------------
 * Every other async write in this codebase (`claim-card.tsx`,
 * `reject-dialog.tsx`) is a plain `useState` + `await` + re-render — this is
 * the first place `useOptimistic` is used, because this is the first UI
 * whose whole point is to show something BEFORE the server has answered.
 *
 * The mechanism, and why it is honest rather than a lie the merchant later
 * discovers: `addPendingRow` is called synchronously at the top of a
 * `startTransition`, before the `await`. For as long as that transition is
 * in flight, `pendingRows` holds the draft and this component renders it —
 * via the SAME `MessageBubble` the confirmed thread uses, with `pending`
 * set, so it visibly renders DIFFERENTLY (`opacity-70`, a spinner where the
 * time would be, no timestamp — nothing here claims the server has seen it
 * yet). The instant the transition settles — success OR failure — React
 * reverts `pendingRows` back to its base value (a stable empty array), so
 * the pending bubble disappears on its own. Nothing has to remove it by
 * hand, and there is no path where it lingers after the transition ends.
 *
 * On success the real message is on the server; `router.refresh()` re-runs
 * `/dashboard/support`'s own server load, so the confirmed row appears in
 * `MessageList` in the server's own words, with the server's own id and
 * timestamp — never a client-guessed one kept around.
 *
 * On failure the pending bubble is gone (same mechanism) and `body` is NOT
 * cleared, so the merchant's typed text survives in the textarea exactly as
 * they left it (T-06-37) — a blocking `destructive` `Alert` says so above
 * the composer, never a toast alone.
 *
 * ---------------------------------------------------------------------------
 * PLAIN `Enter` INSERTS A NEWLINE. ONLY `Cmd/Ctrl+Enter` SENDS.
 * ---------------------------------------------------------------------------
 * This market is mobile-first, and an accidental send from a stray Enter is
 * worse than the extra tap Cmd/Ctrl+Enter costs a desktop user. The
 * textarea's native Enter behaviour (a newline) is therefore left alone —
 * this component adds a handler ONLY for the modified combination.
 *
 * ---------------------------------------------------------------------------
 * NO ATTACHMENT AFFORDANCE YET.
 * ---------------------------------------------------------------------------
 * Plan 06-11 adds the attach-image button and its staged-thumbnail row.
 * Shipping a disabled version of it now would be a dead control sitting in
 * a live composer; the text-only send path below is this plan's whole
 * scope, and the slot simply does not exist until that plan builds it.
 */

const TEXTAREA_ROWS = 3;

/** `useOptimistic`'s base value never changes, so a stable reference avoids a needless reset on every render. */
const NO_PENDING_ROWS: readonly SupportMessageRow[] = [];

/**
 * A draft, shaped as a `SupportMessageRow` so it can render through the same
 * `MessageBubble` the confirmed thread uses. The id is never sent anywhere —
 * it exists only as a React key for the transition's lifetime — and
 * `createdAt` is never read: `pending` suppresses the time line entirely.
 */
function draftRow(body: string): SupportMessageRow {
  return {
    id: `optimistic-${Date.now()}`,
    author: "MERCHANT",
    authorUserId: null,
    body,
    createdAt: new Date(),
    subscriptionClaimId: null,
    attachments: [],
  };
}

export function Composer() {
  const router = useRouter();
  const textareaId = useId();
  const isMac = usePlatformIsMac();

  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, startTransition] = useTransition();
  const [pendingRows, addPendingRow] = useOptimistic(
    NO_PENDING_ROWS,
    (state, draft: SupportMessageRow) => [...state, draft],
  );

  const trimmedBody = body.trim();
  const canSend = trimmedBody.length > 0 && !isSending;

  function send() {
    if (!canSend) return;

    const outgoingBody = trimmedBody;
    setError(null);

    startTransition(async () => {
      addPendingRow(draftRow(outgoingBody));

      const result = await sendSupportMessage({ body: outgoingBody });

      if (!result.ok) {
        setError(result.error.form?.[0] ?? strings.support.composer.sendError);
        return;
      }

      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-background px-4 py-4 sm:px-8">
      {pendingRows.map((row) => (
        <MessageBubble
          key={row.id}
          row={row}
          viewer="MERCHANT"
          authorOtherLabel={strings.support.thread.authorOther}
          pending
        />
      ))}

      {error === null ? null : (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={textareaId}>{strings.support.composer.label}</Label>
        <Textarea
          id={textareaId}
          value={body}
          rows={TEXTAREA_ROWS}
          className="max-h-64 overflow-y-auto"
          onChange={(event) => {
            setBody(event.target.value);
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              send();
            }
          }}
        />
        <span className="text-sm leading-normal font-normal text-muted-foreground">
          {isMac
            ? strings.support.composer.keyboardHintMac
            : strings.support.composer.keyboardHintWindows}
        </span>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          className="min-h-11"
          disabled={!canSend}
          onClick={send}
        >
          {isSending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Send aria-hidden="true" />
          )}
          {isSending
            ? strings.support.composer.sending
            : strings.support.composer.send}
        </Button>
      </div>
    </div>
  );
}
