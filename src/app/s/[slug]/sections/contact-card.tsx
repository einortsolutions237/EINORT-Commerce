import { MessageCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SectionInstance } from "@/server/theming/schema";

import type { StorefrontRenderData } from "./render-data";
import { Reveal } from "./reveal";

/**
 * S5 — the contact section's `card` variant (TMPL-03, D-02).
 *
 * 05-UI-SPEC.md § New Section-Type Variant Contracts, `contact` variant
 * `card`, is the contract; every class string below is quoted from it rather
 * than chosen here. `contact-section.tsx`'s `ContactBand` carries the fuller
 * rationale for the WhatsApp-only CTA and the "no configured number means no
 * button at all" rule — both apply here unchanged and are not repeated at
 * length in this file.
 *
 * ---------------------------------------------------------------------------
 * THE ZINC-100 OUTER FIELD IS WHAT MAKES THE CARD READ AS "FLOATED". DO NOT
 * DROP IT FOR "CONSISTENCY" WITH `band`'s WHITE FIELD.
 * ---------------------------------------------------------------------------
 * `band` sits directly on white (05-UI-SPEC.md § Background-treatment
 * classification). `card` is the opposite move: a tinted field with a
 * bordered white card floated on top of it. Removing the tint would leave a
 * white card indistinguishable from its own page background — the entire
 * "floated card" identity depends on the contrast between the two.
 *
 * `rounded` here is the STOREFRONT radius (0.25rem), never `rounded-lg` (the
 * dashboard's 0.75rem) — `tests/unit/surface-token-isolation.test.ts` bans
 * the dashboard radius under `src/app/s/**`, and mixing surface vocabularies
 * is exactly the incident (260823-gu4) that test exists to prevent.
 *
 * Marker-free like every section component: no `"use client"`, no
 * `server-only` dependency, so it renders from both the live storefront's RSC
 * tree and the editor's client-side preview canvas.
 */

export function ContactCard({
  settings,
  data,
}: {
  /* Narrowed out of the union — see the note in `hero-section.tsx`. */
  readonly settings: Extract<SectionInstance, { type: "contact" }>["settings"];
  readonly data: StorefrontRenderData;
}) {
  return (
    <Reveal>
      <section className="bg-secondary py-16 md:py-24">
        <div className="mx-auto max-w-md rounded border border-border bg-background p-8 text-center shadow-sm md:p-12">
          {/* Heading role: 24→32px / 600 / 1.2 — same role stack as `band`. */}
          <h2 className="text-2xl leading-tight font-semibold tracking-tight text-foreground md:text-[32px]">
            {settings.heading}
          </h2>

          {settings.body !== "" && (
            /* Body 16/400/1.6, measure-capped and centred. */
            <p className="mx-auto mt-4 max-w-prose text-base leading-[1.6] font-normal text-muted-foreground">
              {settings.body}
            </p>
          )}

          {/*
           * -----------------------------------------------------------------
           * NO CONFIGURED NUMBER MEANS NO BUTTON AT ALL. NEVER A DEAD ONE.
           * -----------------------------------------------------------------
           * Same rule as `ContactBand` in `contact-section.tsx`: a merchant
           * who has not saved a WhatsApp number gets a shorter card, not a
           * disabled or dead-linking one. The card still reads as finished
           * because the heading and body stand alone inside it.
           */}
          {data.whatsappHref !== null && (
            /*
             * The second of the accent's permitted uses (05-UI-SPEC.md §
             * Color) — the only accent use in this file, identical contract
             * to `band`'s CTA.
             *
             * `rel="noopener noreferrer"` denies the opened page a
             * `window.opener` handle back into the storefront's tab (the
             * reverse-tabnabbing hole, T-04-26, unchanged this phase). The
             * href itself is server-built, so nothing here concatenates a
             * merchant value into a URL.
             */
            <a
              href={data.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-8",
                "text-sm leading-snug font-semibold tracking-[0.08em] uppercase",
                "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90",
                "transition-colors duration-[var(--motion-quick)] ease-[var(--motion-ease)]",
              )}
            >
              <MessageCircleIcon className="size-5" aria-hidden="true" />
              {settings.ctaLabel}
            </a>
          )}
        </div>
      </section>
    </Reveal>
  );
}
