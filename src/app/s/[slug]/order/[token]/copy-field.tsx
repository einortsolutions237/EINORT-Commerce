"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

/**
 * The B5 copyable block — a label, a large selectable value, and a copy button
 * whose confirmation happens WHERE THE THUMB IS.
 *
 * ---------------------------------------------------------------------------
 * WHY THE CONFIRMATION IS AN IN-PLACE SWAP AND NOT A TOAST.
 * ---------------------------------------------------------------------------
 * 03-UI-SPEC.md § B5 rules a toast alone unacceptable here, and the reason is
 * specific to this block rather than a general preference. The person using it
 * is mid-task: they have tapped copy and are about to leave for their Mobile
 * Money menu, and the only question in their head is "did that work?". A toast
 * answers it at the other end of the screen, after a delay, and disappears —
 * so a customer who missed it taps again, or worse, gives up and retypes a
 * nine-digit number from memory. The swap answers it under the finger that
 * asked, and it stays for two seconds.
 *
 * ---------------------------------------------------------------------------
 * THIS IS THE ONLY CLIENT COMPONENT ON THE TRACKING PAGE.
 * ---------------------------------------------------------------------------
 * `navigator.clipboard` needs a browser, and nothing else on this page does.
 * In particular the D-15 tap-to-dial decision is NOT made here — it is made on
 * the server from the User-Agent, so the correct markup ships in the first
 * paint (see `payment-instructions.tsx`). Moving that branch into this island
 * would reintroduce exactly the flash-then-remove the spec forbids.
 *
 * ---------------------------------------------------------------------------
 * THE CLIPBOARD IS ALLOWED TO FAIL, AND THEN WE SAY NOTHING.
 * ---------------------------------------------------------------------------
 * `writeText` rejects in an insecure context and when a browser withholds
 * permission. The failure is swallowed deliberately: the value beside the
 * button is real, selectable text, so the fallback — long-press, select, copy —
 * is already on screen and needs no explanation. What must never happen is a
 * confirmation for a copy that did not occur, because the next thing that
 * customer does is paste an empty clipboard into a payment form.
 */

/** Long enough to be read, short enough that the button is ready on re-tap. */
const REVERT_AFTER_MS = 2_000;

export interface CopyFieldProps {
  /** Label role, uppercase. Read from `strings`, never written at the call site. */
  readonly label: string;
  /** What the customer sees and can select by hand. */
  readonly value: string;
  /**
   * What actually lands on the clipboard, when that differs from what is shown.
   * A phone number is displayed grouped (`6 77 12 34 56`) and copied bare, so
   * pasting it into a dialler produces a number rather than a syntax error.
   */
  readonly copyText?: string;
  /**
   * Renders the value at Body size with wrapping instead of Display size.
   * For the tracking URL, which is long and is read rather than dialled.
   */
  readonly compact?: boolean;
}

export function CopyField({
  label,
  value,
  copyText,
  compact = false,
}: CopyFieldProps) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A tap immediately before an unmount would otherwise set state on a gone
  // component two seconds later.
  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyText ?? value);
    } catch {
      // See the header. No confirmation for a copy that did not happen.
      return;
    }

    setDone(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), REVERT_AFTER_MS);
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded border border-border bg-muted p-6">
      <div className="flex min-w-0 flex-col gap-1">
        {/* Label role: 14px / 600 / 1.4, uppercase eyebrow. */}
        <span className="text-sm leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </span>

        {/*
         * Display role, `font-mono` and `tabular-nums` — this is the digit run
         * a customer reads at arm's length and compares against their dialler.
         * `select-all` makes one long-press take the whole value rather than a
         * word of it.
         */}
        <span
          className={cn(
            "font-mono font-semibold tabular-nums text-foreground select-all",
            compact
              ? "text-base leading-[1.6] break-all"
              : "text-4xl leading-[1.05] tracking-tight",
          )}
        >
          {value}
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleCopy}
        className="min-h-11 shrink-0 gap-2 px-4"
      >
        {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {/*
         * The live region is the label itself, so the swap is announced by the
         * same element that shows it. `polite` because a copy confirmation must
         * never interrupt a screen reader mid-sentence.
         */}
        <span
          role="status"
          aria-live="polite"
          className="text-sm leading-snug font-semibold"
        >
          {done ? strings.orderStatus.copied : strings.orderStatus.copy}
        </span>
      </Button>
    </div>
  );
}
