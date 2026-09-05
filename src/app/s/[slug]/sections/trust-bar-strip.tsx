import {
  ClockIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react";
import { Fragment } from "react";

import { cn } from "@/lib/utils";
import type { SectionInstance } from "@/server/theming/schema";

import { Reveal } from "./reveal";

/**
 * S2 — the trust bar's `strip` variant (TMPL-03, D-02).
 *
 * 05-UI-SPEC.md § New Section-Type Variant Contracts, `trust-bar` variant
 * `strip`, is the contract; every class string below is quoted from it
 * rather than chosen here.
 *
 * ---------------------------------------------------------------------------
 * NO WASH. THAT ABSENCE, PLUS NO BODY TEXT, IS THE WHOLE DISTINCTIVENESS
 * SIGNAL. DO NOT "FIX" EITHER OMISSION FOR CONSISTENCY WITH `band`.
 * ---------------------------------------------------------------------------
 * The tinted wash `trust-bar-section.tsx`'s `TrustBarBand` renders is
 * reserved for exactly two things across the storefront (05-UI-SPEC.md §
 * Color): the announcement-bar fill and that band's own wash. This variant
 * is deliberately not a third use of it — a plain hairline-bordered row is
 * what makes `strip` read as a genuinely different structural choice next to
 * `band`, not a recolour of it.
 *
 * The `body` field still exists on each block in the settings row (the
 * schema caps and shape are unchanged, per plan scope) — it is simply never
 * read below. A hairline strip that still prints two lines per item reads as
 * `band` with tighter spacing, not as its own design; dropping the second
 * line is what makes it a strip.
 *
 * Marker-free like every section component: no `"use client"`, no
 * `server-only` dependency, so it renders from both the live storefront's
 * RSC tree and the editor's client-side preview canvas.
 */

/**
 * The closed icon set, mapped to lucide components through a `Record` typed
 * against the schema's own `z.enum` — the same table `trust-bar-section.tsx`
 * builds for `band`, kept as a second copy here rather than imported from
 * that file. `trust-bar-section.tsx` imports `TrustBarStrip` FROM this
 * module, so an import running the other way would be circular. Both copies
 * are typed against the same enum, so a fifth icon added to
 * `src/server/theming/schema.ts` is a compile error at BOTH tables, not just
 * one — there is no fallback arm, on purpose, matching `band`'s own table.
 */
type TrustIcon =
  Extract<SectionInstance, { type: "trust-bar" }>["settings"]["blocks"][number]["icon"];

const TRUST_ICONS: Readonly<Record<TrustIcon, LucideIcon>> = {
  truck: TruckIcon,
  "shield-check": ShieldCheckIcon,
  clock: ClockIcon,
  "message-circle": MessageCircleIcon,
};

/**
 * 05-UI-SPEC.md § Motion Language (inherited from `04-UI-SPEC.md` unchanged),
 * "Grid / column stagger". A courtesy copy of the reveal combination for the
 * same reason `trust-bar-section.tsx` keeps its own: `reveal.tsx` carries
 * `"use client"`, so a server component reading a plain export across that
 * boundary would get a client reference rather than the string value.
 */
const ITEM_ENTER =
  "animate-in fade-in slide-in-from-bottom-4 fill-mode-both " +
  "ease-[var(--motion-ease)] animation-duration-[var(--motion-reveal)]";

export function TrustBarStrip({
  settings,
}: {
  /* Narrowed out of the union — see the note in `hero-section.tsx`. */
  readonly settings: Extract<
    SectionInstance,
    { type: "trust-bar" }
  >["settings"];
}) {
  const lastIndex = settings.blocks.length - 1;

  return (
    <Reveal>
      <section className="border-y border-border bg-background py-6 md:py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-4 px-6 md:gap-x-12 md:px-8">
          {settings.blocks.map((block, index) => {
            const Icon = TRUST_ICONS[block.icon];

            return (
              <Fragment key={`${block.icon}-${index}`}>
                <div
                  className={cn("flex items-center gap-2", ITEM_ENTER)}
                  /*
                   * The stagger. `calc()` over a token and an index — a
                   * number, never a merchant string — so nothing injectable
                   * reaches a `style` attribute (T-04-09, unchanged this
                   * phase).
                   */
                  style={{
                    animationDelay: `calc(var(--motion-stagger) * ${index})`,
                  }}
                >
                  {/*
                   * `aria-hidden`: the heading text carries the meaning, same
                   * rule as `band`.
                   */}
                  <Icon
                    aria-hidden="true"
                    className="size-5 text-foreground"
                  />

                  {/* Label 14/600/1.4 — the item's only line of copy. */}
                  <p className="text-sm leading-snug font-semibold text-foreground">
                    {block.heading}
                  </p>
                </div>

                {/*
                 * A plain rule between items, never after the last one — a
                 * structural separator, not a merchant-authored element, so
                 * it carries no accessible role of its own.
                 */}
                {index !== lastIndex && (
                  <span
                    aria-hidden="true"
                    className="hidden h-4 w-px bg-border md:block"
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      </section>
    </Reveal>
  );
}
