import Link from "next/link";

import { cn } from "@/lib/utils";
import type { SectionInstance } from "@/server/theming/schema";

import type { StorefrontRenderData } from "./render-data";

/**
 * `hero:stack` — one of three `SectionVariant<"hero">` arms (TMPL-03, D-02).
 * `05-UI-SPEC.md` § `hero` — variant `stack` is the contract; every class
 * string below is quoted from it rather than chosen here.
 *
 * ---------------------------------------------------------------------------
 * NO `"use client"`. THIS COMPONENT HOLDS NO STATE AND RUNS NO EFFECT.
 * ---------------------------------------------------------------------------
 * Same reasoning as `hero-section.tsx`'s `HeroFullBleed` and
 * `hero-split.tsx`'s `HeroSplit`: it renders from the RSC tree on the live
 * storefront AND from inside the editor's client-side preview canvas. See
 * `render-data.ts`.
 *
 * ---------------------------------------------------------------------------
 * NO IMAGE SLOT AT ALL. `settings.backgroundImageKey` IS NEVER READ HERE,
 * EVEN WHEN ONE IS SET ON THE UNDERLYING SETTINGS OBJECT.
 * ---------------------------------------------------------------------------
 * `05-RESEARCH.md` Pitfall 4 names the way a hero variant fails: designed
 * against a stock mock-up, shipped with `backgroundImageKey: null`, and a
 * merchant on day one sees an empty band. `hero:stack` is specified with no
 * image case to fail — this component structurally cannot render a photo,
 * so there is nothing here for that pitfall to catch. The editor's settings
 * panel still renders the image field for the hero section TYPE (the field
 * belongs to `heroSettings` in `schema.ts`, not to a variant), and no
 * variant-conditional field hiding happens this phase — see
 * `05-UI-SPEC.md` § Decisions Made Under "Claude's Discretion".
 *
 * ---------------------------------------------------------------------------
 * ACCENT BUDGET: THE CTA FILL AND NOTHING ELSE.
 * ---------------------------------------------------------------------------
 * Same rule as every hero variant: `--brand-accent` is spent once, on the
 * pill CTA's fill. The divider below is a plain `--border` rule, deliberately
 * not accent-coloured — it is the one purely decorative element that gives
 * `stack` an identity beyond "hero with no photo", not a second accent use.
 */

/** The `<h1>`'s id — only one hero variant ever mounts per page (D-05). */
const HERO_HEADING_ID = "hero-heading";

/**
 * The on-mount cascade — the same delay ladder `hero-section.tsx`'s
 * `HeroFullBleed` uses (`delay-0` / `delay-200` / `delay-[400ms]` /
 * `delay-[600ms]`), duplicated for the same self-containment reason as
 * `hero-split.tsx`'s local `CASCADE`. The divider shares the eyebrow's
 * `delay-0` step — it is part of the same opening beat, not a fifth stagger
 * step of its own; `05-UI-SPEC.md`'s "same cascade timings" is the set of
 * four values above, not a newly invented fifth one.
 */
const CASCADE =
  "animate-in fade-in slide-in-from-bottom-4 fill-mode-both " +
  "ease-[var(--motion-ease)] animation-duration-[var(--motion-hero)]";

export function HeroStack({
  settings,
  data: _data,
}: {
  /* Narrowed out of the union — see the note in `hero-section.tsx`. */
  readonly settings: Extract<SectionInstance, { type: "hero" }>["settings"];
  /*
   * Unused: `hero:stack` has no image slot and reads nothing from the
   * catalogue-derived render bundle. Kept as a parameter (not dropped) so
   * every hero variant shares one call signature at `hero-section.tsx`'s
   * switch, exactly as `TrustBarSection` documents for its own no-`data` arm
   * in `section-renderer.tsx`.
   */
  readonly data: StorefrontRenderData;
}) {
  return (
    <section
      aria-labelledby={HERO_HEADING_ID}
      className="flex min-h-[70svh] max-h-[900px] items-center justify-center bg-secondary"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center md:px-8">
        {settings.eyebrow !== "" && (
          /* Label 14/600/1.4, uppercase. */
          <p
            className={cn(
              "text-sm leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase",
              CASCADE,
              "delay-0",
            )}
          >
            {settings.eyebrow}
          </p>
        )}

        {/*
         * The one purely decorative element — a plain rule, no icon, no
         * colour. Shares the eyebrow's `delay-0` step (see the `CASCADE`
         * comment above).
         */}
        <div
          aria-hidden="true"
          className={cn("mt-6 h-px w-16 bg-border", CASCADE, "delay-0")}
        />

        {/*
         * Display 40→64px / 600 / 1.05 — the standard Display role at its
         * standard size. "Oversized" per `05-UI-SPEC.md` means generous
         * surrounding whitespace and the wider `max-w-4xl` above, never a
         * larger font: a third hero size step would be a new role in
         * disguise. Same weight-700 prohibition as every hero variant.
         */}
        <h1
          id={HERO_HEADING_ID}
          className={cn(
            "mt-6 text-[40px] leading-[1.05] font-semibold tracking-tighter text-foreground md:text-[64px]",
            CASCADE,
            "delay-200",
          )}
        >
          {settings.heading}
        </h1>

        {settings.body !== "" && (
          /* Body 16/400/1.6, measure-capped. */
          <p
            className={cn(
              "mt-6 max-w-prose text-base leading-[1.6] font-normal text-muted-foreground",
              CASCADE,
              "delay-[400ms]",
            )}
          >
            {settings.body}
          </p>
        )}

        {/* The one accent-filled element — the CTA fill and nothing else. */}
        <Link
          href={settings.ctaHref}
          className={cn(
            "mt-8 inline-flex min-h-12 items-center justify-center rounded-full px-8",
            "text-sm leading-snug font-semibold tracking-[0.08em] uppercase",
            "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90",
            "transition-colors duration-[var(--motion-quick)] ease-[var(--motion-ease)]",
            CASCADE,
            "delay-[600ms]",
          )}
        >
          {settings.ctaLabel}
        </Link>
      </div>
    </section>
  );
}
