import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { SectionInstance } from "@/server/theming/schema";

import type { StorefrontRenderData } from "./render-data";
import { Reveal } from "./reveal";

/**
 * S4 — the editorial split (TMPL-01, TMPL-02).
 *
 * 04-UI-SPEC.md § S4 is the contract. No `"use client"`, no `server-only`
 * dependency — see `render-data.ts` for why that is load-bearing.
 *
 * ---------------------------------------------------------------------------
 * THIS IS THE PAGE'S ONLY INVERTED REGION, AND THAT IS A DESIGN DECISION, NOT
 * A COINCIDENCE.
 * ---------------------------------------------------------------------------
 * 04-UI-SPEC.md § Background-treatment alternation forbids two adjacent
 * sections from sharing a background treatment; the five-band rhythm is
 * photo → wash → white → INK → white, and this band is the ink. It is what
 * stops a five-section page from reading as one long white scroll, and it is
 * one of the things the § Design-Distinctiveness Gate is judged on. A second
 * inverted band anywhere on this page cancels the effect of this one.
 */

/**
 * The widest derivative of the `product` preset — same rule as the hero.
 * `settings.imageKey` is a validated PREFIX (`storageKeySchema`, T-04-15),
 * never a URL, so this concatenation cannot retarget `next/image`.
 */
const SPLIT_DERIVATIVE = "detail.webp";

/**
 * 04-UI-SPEC.md § Motion Language, "Grid / column stagger". A courtesy copy —
 * see the identical note in `trust-bar-section.tsx` for why it cannot be
 * re-used from `reveal.tsx` across the client boundary.
 */
const COLUMN_ENTER =
  "animate-in fade-in slide-in-from-bottom-4 fill-mode-both " +
  "ease-[var(--motion-ease)] animation-duration-[var(--motion-reveal)]";

export function EditorialSplitSection({
  settings,
  data,
}: {
  /* Narrowed out of the union — see the note in `hero-section.tsx`. */
  readonly settings: Extract<
    SectionInstance,
    { type: "editorial-split" }
  >["settings"];
  readonly data: StorefrontRenderData;
}) {
  const hasImage = settings.imageKey !== null;

  return (
    <Reveal>
      <section className="bg-foreground text-background">
        <div
          className={cn(
            "mx-auto grid max-w-7xl items-center gap-8 px-6 py-16 md:gap-12 md:px-8 md:py-24",
            // NO IMAGE: the section collapses to ONE centred column rather
            // than leaving a two-column grid with an empty half. A blank cell
            // beside text does not read as minimalism, it reads as a failed
            // image load — and this is the day-one state for a merchant who
            // has uploaded nothing.
            hasImage ? "md:grid-cols-2" : "max-w-3xl text-center",
          )}
        >
          {/*
           * Text column first in the DOM, which is also the reading order at
           * every width: stacked above the image below `md` (04-UI-SPEC.md
           * § S4 orders it that way) and to its left at `md` and up. No
           * `order-*` utility is needed, and none should be added — a visual
           * order that disagrees with the DOM order is a keyboard trap.
           */}
          <div className={COLUMN_ENTER}>
            {settings.eyebrow !== "" && (
              /* Label 14/600/1.4, uppercase. */
              <p className="text-sm leading-snug font-semibold tracking-[0.08em] text-background/70 uppercase">
                {settings.eyebrow}
              </p>
            )}

            {/*
             * The Display role's fifth SIZE step (32→40px), not a fifth type
             * role — 04-UI-SPEC.md § Typography declares it here so it is not
             * invented at build time. It steps down from the hero's 64px
             * because it sits beside an image in half a grid, not full-bleed.
             * Weight stays 600: the weight-700 utility is banned on this whole
             * surface, since 700 is not among the loaded faces.
             */}
            <h2 className="mt-4 text-[32px] leading-[1.1] font-semibold tracking-tight md:text-[40px]">
              {settings.heading}
            </h2>

            {settings.body !== "" && (
              /* Body 16/400/1.6. */
              <p
                className={cn(
                  "mt-6 max-w-prose text-base leading-[1.6] font-normal text-background/80",
                  !hasImage && "mx-auto",
                )}
              >
                {settings.body}
              </p>
            )}

            {/*
             * -----------------------------------------------------------------
             * THIS CTA IS DELIBERATELY NOT THE MERCHANT'S ACCENT FILL. DO NOT
             * "MAKE IT CONSISTENT" WITH THE HERO CTA.
             * -----------------------------------------------------------------
             * The default accent is ink — the near-black constant in
             * `src/lib/theme-defaults.ts` — and this band is `--foreground`,
             * which is the same end of the scale. That is a FILL-VERSUS-
             * FILL collision, and no foreground derivation can fix it: the
             * derived label colour makes the TEXT readable, but the button's
             * own shape disappears into the band, so the shopper never sees
             * there is a button to read. The result is an invisible CTA on the
             * one section built to carry a story.
             *
             * Inverting it instead — page white on the ink band — is legible at
             * every merchant colour because neither value is merchant-supplied.
             * That is why the accent budget in 04-UI-SPEC.md § Color lists four
             * uses and this is not one of them.
             */}
            <Link
              href={settings.ctaHref}
              className={cn(
                "mt-8 inline-flex min-h-12 items-center justify-center rounded-full px-8",
                "text-sm leading-snug font-semibold tracking-[0.08em] uppercase",
                "bg-background text-foreground hover:bg-background/90",
                "transition-colors duration-[var(--motion-quick)] ease-[var(--motion-ease)]",
              )}
            >
              {settings.ctaLabel}
            </Link>
          </div>

          {hasImage && (
            <div
              className={cn(
                "relative aspect-[4/3] overflow-hidden rounded",
                COLUMN_ENTER,
              )}
              /* One stagger step behind the text column — a number in a
                 `calc()`, never a merchant value (T-04-09). */
              style={{ animationDelay: "calc(var(--motion-stagger) * 1)" }}
            >
              <Image
                src={`${data.imageBaseUrl}/${settings.imageKey}/${SPLIT_DERIVATIVE}`}
                // The heading and body carry the meaning; the store name gives
                // the image an accessible identity without narrating a
                // decorative photograph twice.
                alt={data.storeName}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          )}
        </div>
      </section>
    </Reveal>
  );
}
