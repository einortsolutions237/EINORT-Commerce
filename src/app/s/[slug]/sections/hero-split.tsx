import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { SectionInstance } from "@/server/theming/schema";

import type { StorefrontRenderData } from "./render-data";

/**
 * `hero:split` — one of three `SectionVariant<"hero">` arms (TMPL-03, D-02).
 * `05-UI-SPEC.md` § `hero` — variant `split` is the contract; every class
 * string below is quoted from it rather than chosen here.
 *
 * ---------------------------------------------------------------------------
 * NO `"use client"`. THIS COMPONENT HOLDS NO STATE AND RUNS NO EFFECT.
 * ---------------------------------------------------------------------------
 * Same reasoning as `hero-section.tsx`'s `HeroFullBleed`: it renders from the
 * RSC tree on the live storefront AND from inside the editor's client-side
 * preview canvas, so it stays free of both a client directive and any
 * `server-only` dependency. See `render-data.ts`.
 *
 * ---------------------------------------------------------------------------
 * THE NO-IMAGE MODE IS THE PRIMARY DESIGN, NOT A FALLBACK.
 * ---------------------------------------------------------------------------
 * `05-RESEARCH.md` Pitfall 4 names the exact way a variant fails: designed
 * against a stock mock-up, shipped with `backgroundImageKey: null`, and a
 * merchant who publishes from onboarding sees an empty band. The image
 * column here is never empty — with no image it carries the store's own
 * initials as an oversized, low-opacity typographic mark, using data already
 * on hand (`data.storeName`). Treat both modes as designs. Do not let one rot.
 *
 * ---------------------------------------------------------------------------
 * ACCENT BUDGET: THE CTA FILL AND NOTHING ELSE.
 * ---------------------------------------------------------------------------
 * Same rule as every hero variant (`04-UI-SPEC.md` § Color, restated in
 * `05-UI-SPEC.md`): `--brand-accent` is spent once, on the pill CTA's fill.
 * Not the eyebrow, not the headline, not the initials mark, not a border.
 */

/**
 * The widest derivative of the `product` preset — same rule as
 * `hero-section.tsx`'s `HERO_DERIVATIVE` and `editorial-split-section.tsx`'s
 * `SPLIT_DERIVATIVE`. Duplicated rather than imported/shared: each variant
 * file stays a self-contained, marker-free leaf.
 */
const HERO_SPLIT_DERIVATIVE = "detail.webp";

/** The `<h1>`'s id — only one hero variant ever mounts per page (D-05). */
const HERO_HEADING_ID = "hero-heading";

/**
 * The text column's on-mount cascade — identical delay ladder to
 * `hero-section.tsx`'s `CASCADE`, duplicated for the same self-containment
 * reason as `HERO_SPLIT_DERIVATIVE` above.
 */
const CASCADE =
  "animate-in fade-in slide-in-from-bottom-4 fill-mode-both " +
  "ease-[var(--motion-ease)] animation-duration-[var(--motion-hero)]";

/**
 * The image column's entrance — a plain fade, one stagger step behind the
 * text column (`05-UI-SPEC.md`: "fades in at `--motion-hero` with
 * `delay-[400ms]`, no separate stagger needed for two elements").
 */
const IMAGE_ENTER =
  "animate-in fade-in fill-mode-both " +
  "ease-[var(--motion-ease)] animation-duration-[var(--motion-hero)] delay-[400ms]";

/**
 * The store's initials, derived from `data.storeName` — no new schema field.
 * Up to two characters: the first letter of the first two words, or the
 * first two characters of a single-word name.
 */
function initialsFrom(storeName: string): string {
  const words = storeName.trim().split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function HeroSplit({
  settings,
  data,
}: {
  /* Narrowed out of the union — see the note in `hero-section.tsx`. */
  readonly settings: Extract<SectionInstance, { type: "hero" }>["settings"];
  readonly data: StorefrontRenderData;
}) {
  const hasImage = settings.backgroundImageKey !== null;

  return (
    <section
      aria-labelledby={HERO_HEADING_ID}
      className="grid grid-cols-1 md:grid-cols-2 md:min-h-[70svh]"
    >
      {/*
       * Text column first in the DOM (keeps the `<h1>` early in the
       * document), ordered first visually too via `md:order-1` — reading
       * order and visual order must always agree. Always `text-foreground`:
       * this column sits on white, never on the image.
       */}
      <div
        className={cn(
          "flex flex-col justify-center px-6 py-16 text-foreground md:order-1 md:px-8 md:py-0",
        )}
      >
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
         * Display 40→64px / 600 / 1.05. Same weight-700 prohibition as
         * `HeroFullBleed` — Plus Jakarta Sans loads at 400/600 only.
         */}
        <h1
          id={HERO_HEADING_ID}
          className={cn(
            "mt-4 text-[40px] leading-[1.05] font-semibold tracking-tighter md:text-[64px]",
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

      {/* Image column, second in the DOM, ordered second visually. */}
      <div
        className={cn(
          "relative aspect-[4/5] overflow-hidden bg-secondary md:order-2 md:aspect-auto md:h-full",
          IMAGE_ENTER,
        )}
      >
        {hasImage ? (
          <>
            <Image
              src={`${data.imageBaseUrl}/${settings.backgroundImageKey}/${HERO_SPLIT_DERIVATIVE}`}
              alt=""
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />

            {/*
             * The scrim. Same split-responsibility rule as
             * `hero-section.tsx`'s `HeroFullBleed` (T-04-09): a token utility
             * supplies the COLOUR, a plain clamped number supplies the
             * OPACITY via `style` — the only merchant-controlled value that
             * reaches a `style` attribute here is a number clamped to 0…0.8
             * by `heroSettings`. Never move the fill into `style`.
             */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-foreground"
              style={{ opacity: settings.overlayOpacity }}
            />
          </>
        ) : (
          /*
           * No-image mode: a flat zinc-100 panel carrying the store's
           * initials as an oversized, low-opacity typographic mark. This is
           * decorative typography, not content — `aria-hidden` — because the
           * `<h1>` in the text column already carries the section's meaning.
           */
          <p
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center text-8xl font-semibold tracking-tighter text-foreground/10 md:text-9xl"
          >
            {initialsFrom(data.storeName)}
          </p>
        )}
      </div>
    </section>
  );
}
