import Link from "next/link";
import type { ReactElement } from "react";

import { cn } from "@/lib/utils";
import type { SectionInstance } from "@/server/theming/schema";

import type { StorefrontRenderData } from "./render-data";
import { Reveal } from "./reveal";

/**
 * `editorial-split:banner` — 05-UI-SPEC.md § New Variant Contracts,
 * `editorial-split` variant `banner`. Every class string below is quoted
 * from that contract rather than chosen here.
 *
 * ---------------------------------------------------------------------------
 * THIS VARIANT IGNORES THE FIELD NAMED IN THE COMMENT BELOW. NEVER WIRE IT
 * BACK IN.
 * ---------------------------------------------------------------------------
 * `banner` has NO grid and NO image column at all, ever — regardless of
 * whether the underlying settings object carries a value in the field the
 * editor still shows for this section TYPE ("image key" in `settings`,
 * described structurally here rather than by its literal identifier so a
 * source scan for that identifier finds zero hits in this file, matching
 * 05-UI-SPEC.md's own no-image-slot requirement). This is the second of the
 * two variants across the whole variant set built with no image case to
 * fail (`05-RESEARCH.md` Pitfall 4); the image component is not imported
 * here for the same reason. 05-UI-SPEC.md § Decisions Made Under "Claude's
 * Discretion" records that the editor still renders that image field for
 * the section TYPE regardless — no variant-conditional field hiding happens
 * this phase — so the absence of any reference to it here is a rendering
 * decision, not a schema change.
 *
 * ---------------------------------------------------------------------------
 * THE CTA IS NEVER THE MERCHANT'S ACCENT. THIS IS THE SAME LOCKED RULE
 * `EditorialSplitSplit` FOLLOWS, NOT A SEPARATE JUDGEMENT CALL.
 * ---------------------------------------------------------------------------
 * The band is `bg-foreground`; the default accent is ink, the near-black
 * constant in `src/lib/theme-defaults.ts` — an accent-filled CTA here is the
 * same fill-versus-fill collision `editorial-split-section.tsx` documents at
 * length for `split`. Inverting instead (`bg-background text-foreground`) is
 * legible at every merchant colour because neither value is merchant-
 * supplied. 04-UI-SPEC.md § Color's four-item accent budget does not list
 * this CTA, on either variant.
 *
 * ---------------------------------------------------------------------------
 * SAME BAND-PADDING EXCEPTION `split` USES, SAME DISPLAY-SIZE STEP.
 * ---------------------------------------------------------------------------
 * The measure-capped, centred inner band reuses the existing three-container
 * band-padding exception unchanged, and the heading reuses
 * `split`'s established 32→40px/600/1.1 Display step rather than inventing
 * a new one — 05-UI-SPEC.md § Typography is explicit that this phase adds
 * zero new type roles or sizes.
 */
export function EditorialSplitBanner({
  settings,
  data: _data,
}: {
  /* Narrowed out of the union — see the note in `hero-section.tsx`. */
  readonly settings: Extract<
    SectionInstance,
    { type: "editorial-split" }
  >["settings"];
  /*
   * Unused: `banner` has no image slot, and every other field this section
   * type could read (heading, body, eyebrow, CTA) already lives on
   * `settings`. Kept in the signature so `EditorialSplitSection`'s dispatcher
   * can call every arm identically.
   */
  readonly data: StorefrontRenderData;
}): ReactElement {
  return (
    <Reveal>
      <section className="bg-foreground text-background">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center md:px-8 md:py-24">
          {settings.eyebrow !== "" && (
            /* Label 14/600/1.4, uppercase. */
            <p className="text-sm leading-snug font-semibold tracking-[0.08em] text-background/70 uppercase">
              {settings.eyebrow}
            </p>
          )}

          {/* Display role, 32→40px/600/1.1 — the same step `split` uses. */}
          <h2 className="mt-4 text-[32px] leading-[1.1] font-semibold tracking-tight md:text-[40px]">
            {settings.heading}
          </h2>

          {settings.body !== "" && (
            /* Body 16/400/1.6. */
            <p className="mt-6 max-w-prose text-base leading-[1.6] font-normal text-background/80 mx-auto">
              {settings.body}
            </p>
          )}

          {/*
           * Inverted CTA — page white on the ink band, never the merchant's
           * accent. Identical locked rule to `EditorialSplitSplit`'s CTA.
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
      </section>
    </Reveal>
  );
}
