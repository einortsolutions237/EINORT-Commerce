import {
  ClockIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactElement } from "react";

import { cn } from "@/lib/utils";
import type { SectionInstance, SectionVariant } from "@/server/theming/schema";

import { Reveal } from "./reveal";
import { TrustBarStrip } from "./trust-bar-strip";

/**
 * S2 — the trust bar (TMPL-01, TMPL-02, TMPL-03, D-10, D-02).
 *
 * 04-UI-SPEC.md § S2 is `band`'s contract; 05-UI-SPEC.md § New Section-Type
 * Variant Contracts adds `strip` (`./trust-bar-strip.tsx`) alongside it. Like
 * every file in this directory it carries no `"use client"` and no
 * `server-only` dependency, so it renders from both the RSC tree and the
 * editor's preview canvas — see `render-data.ts` for why that is
 * load-bearing rather than tidy.
 *
 * ---------------------------------------------------------------------------
 * THE 8% WASH IS SAFE FOR AN ARBITRARY MERCHANT COLOUR. THAT IS THE WHOLE
 * REASON IT IS 8% AND NOT A SOLID FILL.
 * ---------------------------------------------------------------------------
 * `--brand-accent-secondary` is reserved for exactly two things across the
 * storefront (04-UI-SPEC.md § Color, unchanged this phase) and `TrustBarBand`
 * below spends one of them. The `/8` makes Tailwind v4 emit `color-mix(in
 * oklab, …, transparent)`, which is valid for ANY CSS colour, and an 8% wash
 * of any hue over white stays light enough that zinc-950 body text on it
 * clears 4.5:1 without a single per-colour check. A merchant cannot pick a
 * secondary accent that makes this band unreadable.
 *
 * Turn the wash into a solid fill and that guarantee is gone: the heading and
 * body here are `--foreground` and `--muted-foreground`, neither of which is
 * derived from the merchant's colour, so a saturated fill would be the one
 * place on this page a merchant could produce unreadable text. Do not.
 *
 * `TrustBarStrip`, by contrast, carries no wash at all (§ New Variant
 * Contracts) — that is a deliberate structural difference between the two
 * variants, not an oversight to reconcile.
 */

/**
 * The closed icon set, mapped to lucide components through a `Record` typed
 * against the schema's own `z.enum`.
 *
 * This is the `ORDER_TRANSITIONS` / `TENANT_SCOPED_MODELS` idiom: a fifth icon
 * added to the enum in `src/server/theming/schema.ts` becomes a COMPILE error
 * at this table rather than a `undefined is not a component` crash on a live
 * public storefront. There is deliberately no fallback arm — a fallback would
 * make the new value render silently as the wrong glyph, which is the failure
 * mode that survives review.
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
 * Column counts, one arm per legal block count (04-UI-SPEC.md § S2).
 *
 * `trustBarSettings` clamps `blocks` to 1…4, so the four arms are the whole
 * domain. Four items wrap 2-up before going 4-up because four columns at
 * 640px would give each item roughly 140px — narrower than one trust heading.
 * Written as explicit comparisons rather than a keyed lookup so no cast is
 * needed to convince TypeScript that `.length` is one of four literals.
 */
function columnsFor(blockCount: number): string {
  if (blockCount <= 1) return "grid-cols-1";
  if (blockCount === 2) return "sm:grid-cols-2";
  if (blockCount === 3) return "sm:grid-cols-3";
  return "sm:grid-cols-2 lg:grid-cols-4";
}

/**
 * 04-UI-SPEC.md § Motion Language, "Grid / column stagger".
 *
 * A courtesy copy of the reveal combination, not a second source of truth: the
 * string cannot be re-used from `reveal.tsx` because that module carries
 * `"use client"`, and a server component reading a plain export across that
 * boundary gets a client reference rather than the value. The spec table is
 * the authority for both copies.
 */
const ITEM_ENTER =
  "animate-in fade-in slide-in-from-bottom-4 fill-mode-both " +
  "ease-[var(--motion-ease)] animation-duration-[var(--motion-reveal)]";

/**
 * `band` — Phase 4's original rendering, moved here verbatim as a local
 * component so `TrustBarSection` below can dispatch to it. Not exported: the
 * only public entry point for this section type is the variant switch.
 */
function TrustBarBand({
  settings,
}: {
  readonly settings: Extract<
    SectionInstance,
    { type: "trust-bar" }
  >["settings"];
}) {
  return (
    <Reveal>
      <section className="border-y border-border bg-brand-accent-secondary/8 py-12 md:py-16">
        <div
          className={cn(
            "mx-auto grid max-w-7xl gap-8 px-6 md:gap-12 md:px-8",
            columnsFor(settings.blocks.length),
          )}
        >
          {settings.blocks.map((block, index) => {
            const Icon = TRUST_ICONS[block.icon];

            return (
              <div
                key={`${block.icon}-${index}`}
                className={ITEM_ENTER}
                /*
                 * The stagger. `calc()` over a token and an index — a number,
                 * never a merchant string — so nothing injectable reaches a
                 * `style` attribute and ban #1 sees no colour (T-04-09).
                 */
                style={{
                  animationDelay: `calc(var(--motion-stagger) * ${index})`,
                }}
              >
                {/*
                 * `aria-hidden`: the heading text carries the meaning. A
                 * screen reader announcing "truck" before "Delivery in Douala"
                 * adds a word, not information.
                 */}
                <Icon aria-hidden="true" className="size-6 text-foreground" />

                {/* Label 14/600/1.4. */}
                <p className="mt-2 text-sm leading-snug font-semibold text-foreground">
                  {block.heading}
                </p>

                {block.body !== "" && (
                  /* Body 16/400/1.6. */
                  <p className="mt-1 max-w-prose text-base leading-[1.6] font-normal text-muted-foreground">
                    {block.body}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </Reveal>
  );
}

/**
 * The variant switch (TMPL-03, D-02) — THE one place `trust-bar` dispatches
 * to a rendering. Two arms, no `default`, `: ReactElement` return annotation:
 * an unrecognised variant is a compile error here, never a blank band on a
 * live public storefront (T-05-20) — the same discipline
 * `section-renderer.tsx`'s own header documents for section TYPES, applied
 * one level down to variants of a single type.
 *
 * `variant` defaults to `"band"` — `SECTION_VARIANTS["trust-bar"][0]` in
 * `src/server/theming/schema.ts`, the flagship's Phase 4 rendering — so this
 * component keeps compiling against `section-renderer.tsx`'s current
 * single-argument call site. Threading a real `variant` through that switch
 * is a later plan's job (05-10, per its own frontmatter); this default is
 * what keeps that boundary from being a broken build in between, and matches
 * exactly the degraded-read default `variantsForTemplate()` documents for an
 * unrecognised template key.
 *
 * The trust bar still takes no `data` — its content is entirely
 * merchant-authored settings, with nothing read from the catalogue. Threading
 * `data` in anyway "for symmetry" would make every future reader wonder which
 * of its fields the band depends on. (Mirrors the same note on
 * `section-renderer.tsx`'s `trust-bar` case.)
 */
export function TrustBarSection({
  settings,
  variant = "band",
}: {
  /* Narrowed out of the union — see the note in `hero-section.tsx`. */
  readonly settings: Extract<
    SectionInstance,
    { type: "trust-bar" }
  >["settings"];
  readonly variant?: SectionVariant<"trust-bar">;
}): ReactElement {
  switch (variant) {
    case "band":
      return <TrustBarBand settings={settings} />;

    case "strip":
      return <TrustBarStrip settings={settings} />;
  }
}
