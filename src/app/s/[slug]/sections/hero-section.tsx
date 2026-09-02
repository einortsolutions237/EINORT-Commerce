import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { SectionInstance } from "@/server/theming/schema";

import type { StorefrontRenderData } from "./render-data";

/**
 * S1 — the flagship hero (TMPL-01, TMPL-02, D-09).
 *
 * 04-UI-SPEC.md § S1 is the contract; every class string below is quoted from
 * it rather than chosen here.
 *
 * ---------------------------------------------------------------------------
 * NO `"use client"`. THIS COMPONENT HOLDS NO STATE AND RUNS NO EFFECT.
 * ---------------------------------------------------------------------------
 * It renders from the RSC tree on the live storefront AND from inside the
 * editor's client-side preview canvas, which is only possible while it stays
 * free of both a client directive and a `server-only` dependency. The single
 * cross-boundary module it touches is `src/server/theming/schema.ts`, which
 * plan 04-02 deliberately built marker-free (T-04-24). See `render-data.ts`.
 *
 * ---------------------------------------------------------------------------
 * THE NO-IMAGE MODE IS A FIRST-CLASS STATE, NOT A FALLBACK.
 * ---------------------------------------------------------------------------
 * It is the DAY-ONE state: a merchant who publishes from onboarding without
 * opening the editor has uploaded no hero photo, and what they see is the
 * whole "looks like it cost money to build" promise being kept or broken. So
 * the no-image branch is not a degraded image branch with the photo removed —
 * it is a zinc-100 band with the type re-inked onto the `--foreground` family
 * and NO scrim, because a scrim over nothing is a grey rectangle. Treat both
 * modes as designs. Do not let one rot.
 *
 * ---------------------------------------------------------------------------
 * ACCENT BUDGET: THE CTA FILL AND NOTHING ELSE.
 * ---------------------------------------------------------------------------
 * D-09 / 04-UI-SPEC.md § Color reserves `--brand-accent` for exactly four
 * things across the whole storefront, and this section spends one of them: the
 * pill CTA's fill. Not the eyebrow, not the headline, not the scrim, not a
 * border. A merchant can tint this storefront; they can never restructure it.
 *
 * The pill radius (`rounded-full`) is deliberate and must NOT be "made
 * consistent" with the 0.25rem transactional buttons on the cart and checkout
 * pages. A marketing CTA and a money button are different affordances and the
 * shape is how a shopper tells them apart.
 */

/**
 * The widest derivative of the `product` preset in
 * `src/server/images/pipeline.ts` (`sizes: [400, 800, 1600]`,
 * `labels: ["thumb", "card", "detail"]`).
 *
 * The hero is full-bleed and `priority`, so it is the LCP element on the home
 * page — the 1600px original is the only derivative that does not visibly soften
 * on a desktop display. `settings.backgroundImageKey` is a validated PREFIX
 * (`storageKeySchema`, T-04-15), never a URL, so this concatenation cannot
 * point `next/image` at an arbitrary host.
 */
const HERO_DERIVATIVE = "detail.webp";

/**
 * The `<h1>`'s id, as a module constant rather than a generated one.
 *
 * `useId()` is a hook and this component is deliberately hook-free; a value
 * derived from the section's own id would be stable but would force every
 * caller to thread it. Neither is needed: D-05 fixes the section list at five
 * entries with one hero, so exactly one element in the document ever carries
 * this id, and the `aria-labelledby` link is unambiguous by construction.
 */
const HERO_HEADING_ID = "hero-heading";

/**
 * The on-mount cascade — 04-UI-SPEC.md § Motion Language, "Hero cascade".
 *
 * The hero is above the fold and already in view, so it is animated on mount
 * and NOT wrapped in the scroll observer: an observer here costs a visible
 * blank frame between paint and intersection, which is the single worst place
 * on the page to spend one. The four children then stagger through
 * `delay-0` / `delay-200` / `delay-[400ms]` / `delay-[600ms]` (tw-animate-css
 * maps `delay-*` onto `animation-delay`, not `transition-delay`).
 *
 * The reduced-motion floor is global: `globals.css` collapses every animation
 * under `[data-surface="storefront"]` to 1ms, so this cascade needs no branch
 * of its own and no content is ever hidden waiting for it.
 */
const CASCADE =
  "animate-in fade-in slide-in-from-bottom-4 fill-mode-both " +
  "ease-[var(--motion-ease)] animation-duration-[var(--motion-hero)]";

export function HeroSection({
  settings,
  data,
}: {
  /*
   * Narrowed OUT of the discriminated union rather than hand-written as a
   * seven-key interface. That is the entire reason `sectionInstanceSchema` is
   * a union: adding or renaming a hero setting becomes a compile error here,
   * where a duplicated interface would just drift silently.
   */
  readonly settings: Extract<SectionInstance, { type: "hero" }>["settings"];
  readonly data: StorefrontRenderData;
}) {
  const hasImage = settings.backgroundImageKey !== null;

  return (
    <section
      aria-labelledby={HERO_HEADING_ID}
      className={cn(
        "relative isolate flex min-h-[85svh] max-h-[900px] items-center justify-center overflow-hidden",
        // `svh`, not `vh`: mobile browser chrome is counted out of `vh`, so a
        // `85vh` hero crops its own CTA on exactly the low-end Android this
        // market runs. The no-image band is the secondary surface (zinc-100).
        !hasImage && "bg-secondary",
      )}
    >
      {hasImage && (
        <>
          <Image
            src={`${data.imageBaseUrl}/${settings.backgroundImageKey}/${HERO_DERIVATIVE}`}
            // Decorative: the headline carries the meaning, and a photo
            // described twice is a screen reader reading the page twice.
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />

          {/*
           * The scrim. A token utility supplies the COLOUR and a plain number
           * supplies the opacity (T-04-09) — so the only merchant-controlled
           * value that reaches a `style` attribute on this page is a number
           * clamped to 0…0.8 by `heroSettings`, and there is no colour string
           * on the path to inject through. Never move the fill into `style`.
           */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-foreground"
            style={{ opacity: settings.overlayOpacity }}
          />
        </>
      )}

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 text-center md:px-8">
        {settings.eyebrow !== "" && (
          /* Label 14/600/1.4, uppercase. */
          <p
            className={cn(
              "text-sm leading-snug font-semibold tracking-[0.08em] uppercase",
              CASCADE,
              "delay-0",
              hasImage ? "text-background/80" : "text-muted-foreground",
            )}
          >
            {settings.eyebrow}
          </p>
        )}

        {/*
         * Display 40→64px / 600 / 1.05.
         *
         * NEVER REACH FOR THE WEIGHT-700 UTILITY HERE. Weight 700 is not
         * loaded — `src/app/layout.tsx` declares Plus Jakarta Sans at 400 and
         * 600 only — so asking for it makes the browser synthesise a fake
         * bold, which smears the letter shapes at 64px on precisely the
         * display where they are most visible.
         * 04-UI-SPEC.md § Typography resolves this as a contract, not a
         * preference: display presence comes from SIZE plus `tracking-tighter`
         * plus the 1.05 line-height. Adding "700" to the font declaration is
         * also forbidden — it is another file on the LCP path for a market on
         * low-end Android.
         */}
        <h1
          id={HERO_HEADING_ID}
          className={cn(
            "mt-4 text-[40px] leading-[1.05] font-semibold tracking-tighter md:text-[64px]",
            CASCADE,
            "delay-200",
            hasImage ? "text-background" : "text-foreground",
          )}
        >
          {settings.heading}
        </h1>

        {settings.body !== "" && (
          /* Body 16/400/1.6, measure-capped. */
          <p
            className={cn(
              "mt-6 max-w-prose text-base leading-[1.6] font-normal",
              CASCADE,
              "delay-[400ms]",
              hasImage ? "text-background/90" : "text-muted-foreground",
            )}
          >
            {settings.body}
          </p>
        )}

        {/*
         * The one accent-filled element above the fold. `--brand-accent-
         * foreground` is DERIVED server-side from the accent, so the label is
         * readable at every colour a merchant can pick — a merchant must not
         * be able to produce a button whose own text is invisible.
         */}
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
