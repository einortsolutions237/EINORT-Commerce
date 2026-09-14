import { ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { strings } from "@/lib/strings";

/**
 * The persistent "you are in Platform Admin" strip (D-02, 06-UI-SPEC.md § R-1).
 *
 * ---------------------------------------------------------------------------
 * A FULL-WIDTH STRIP, NOT A BADGE BESIDE A PAGE HEADER.
 * ---------------------------------------------------------------------------
 * D-02 justifies gold chrome on this surface by CONSEQUENCE — the owner can
 * suspend a store and moderate somebody else's business from here — so the
 * reminder has to survive the scroll. A badge tucked next to a heading scrolls
 * away exactly when a long merchant list is being scanned, which is the moment
 * the reminder is worth having. `sticky top-0 z-30` and the full width (the
 * strip spans the rail as well as the content, because it is the layout's very
 * first child) are what make it a state indicator rather than a decoration.
 *
 * A full gold fill was rejected in § R-1: it would put gold across ~5% of every
 * admin viewport, which is not a 10% accent, and it would make the gold CHIPS
 * inside the page invisible against their own chrome. The 15% tint reads as a
 * warning band and leaves the page field slate-50.
 *
 * ---------------------------------------------------------------------------
 * THE GOLD GOES THROUGH `Badge variant="gold"`, AND THAT IS THE POINT.
 * ---------------------------------------------------------------------------
 * This file is entry #3 of the five-use gold budget in 06-UI-SPEC.md § Color,
 * and `tests/unit/dashboard-nav.test.ts` counts the literal string
 * `variant="gold"` across `src/app` and `src/components`. Reaching for the raw
 * fill utility instead — which would render identically — slips past that scan
 * silently, and a budget that can be spent invisibly is not a budget. So the
 * strip is a `Badge` wearing strip-shaped overrides rather than a `div` wearing
 * the tint: `w-full` beats the variant's `w-fit`, `rounded-none` its pill
 * radius, `h-auto min-h-8` its `h-6`, `justify-start` its centring, and
 * `[&>svg]:size-4!` the `size-3!` a chip-sized icon would get. `cn`'s
 * tailwind-merge resolves each of those pairs in the className's favour.
 *
 * ---------------------------------------------------------------------------
 * NON-INTERACTIVE, SO THE 44px TOUCH FLOOR DOES NOT APPLY.
 * ---------------------------------------------------------------------------
 * No dismiss, no link, no button — stated because the 44px touch floor is
 * otherwise inherited by every control this project ships, and its absence here
 * would read as an oversight. There is nothing to tap: the strip states a fact
 * about the session, and a dismissible reminder is a reminder that is off by
 * the second page. `min-h-8` is a band, not a target.
 *
 * ---------------------------------------------------------------------------
 * `role="note"` WITH THE WHOLE SENTENCE AS ITS NAME. NO `aria-live`.
 * ---------------------------------------------------------------------------
 * The strip never changes after render, so an `aria-live` region here would
 * announce nothing and cost a politeness setting. The visible copy is split in
 * two — the second clause is dropped below `sm` so the band never wraps to a
 * second line — and a screen reader must not inherit that breakpoint: what is
 * announced is `strings.admin.banner.full`, one sentence, at every viewport.
 * That is why the visible spans are `aria-hidden` and the name comes from the
 * label; they are the same words, said once.
 */
export function AdminBanner() {
  return (
    <Badge
      variant="gold"
      role="note"
      aria-label={strings.admin.banner.full}
      className="sticky top-0 z-30 h-auto min-h-8 w-full justify-start rounded-none px-4 text-sm leading-normal font-semibold sm:px-8 [&>svg]:size-4!"
    >
      <ShieldAlert aria-hidden="true" />
      <span aria-hidden="true">
        {strings.admin.banner.short}
        {/*
         * The clause that disappears below `sm`. A space before it rather than
         * inside the string: the copy module stores the clause, not the
         * spacing that happens to precede it at this one call site.
         */}
        <span className="hidden sm:inline"> {strings.admin.banner.detail}</span>
      </span>
    </Badge>
  );
}
