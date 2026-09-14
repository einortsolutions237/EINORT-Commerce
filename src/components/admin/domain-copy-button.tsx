"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";

/**
 * `<DomainCell>`'s copy affordance, split into its own client island.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A SEPARATE FILE FROM `domain-cell.tsx`.
 * ---------------------------------------------------------------------------
 * `src/server/admin/domain.ts` opens with `import "server-only"` (06-08-PLAN.md
 * Task 1) — the marker package throws at build time if anything importing it
 * reaches a client bundle. `domain-cell.tsx` calls `domainStatusFor` directly
 * (the whole point of the pure derivation: the chip state comes from that
 * function, never an inline conditional), so `domain-cell.tsx` MUST stay a
 * Server Component. `navigator.clipboard` needs a browser, so the one piece of
 * this cell that is genuinely interactive is split out here — the same
 * "only a confirmable row is a client island" discipline
 * `src/app/(dashboard)/dashboard/orders/page.tsx` documents for its own row
 * actions, applied to a cell instead of a row.
 *
 * Confirms in place, not with a toast — the `copy-field.tsx` /
 * `claim-card.tsx` `ReferenceRow` idiom, restated for an icon-only button.
 */

/** Long enough to be read, short enough the button is ready on re-tap. */
const COPY_CONFIRM_MS = 2_000;

export function DomainCopyButton({ host }: { readonly host: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(host);
    } catch {
      // A refused clipboard permission is not worth an error state — the
      // hostname is right there as selectable text next to the button.
      return;
    }
    setCopied(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPY_CONFIRM_MS);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11"
        aria-label={
          copied
            ? strings.admin.domain.copiedLabel
            : strings.admin.domain.copyLabel
        }
        onClick={() => {
          void handleCopy();
        }}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </Button>
      {/* § D's confirmation region — announced, not just shown. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? strings.admin.domain.copiedLabel : ""}
      </span>
    </>
  );
}
