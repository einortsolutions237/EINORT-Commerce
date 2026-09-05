import { MessageCircleIcon } from "lucide-react";
import type { ReactElement } from "react";

import { cn } from "@/lib/utils";
import type { SectionInstance, SectionVariant } from "@/server/theming/schema";

import { ContactCard } from "./contact-card";
import type { StorefrontRenderData } from "./render-data";
import { Reveal } from "./reveal";

/**
 * S5 — the contact section (TMPL-01, TMPL-02, TMPL-03, D-02, D-09).
 *
 * 04-UI-SPEC.md § S5 is `band`'s contract; 05-UI-SPEC.md § New Section-Type
 * Variant Contracts adds `card` (`./contact-card.tsx`) alongside it. Every
 * class string below is quoted from 04-UI-SPEC.md rather than chosen here.
 *
 * ---------------------------------------------------------------------------
 * DEVIATION 1 (04-RESEARCH.md § Pattern 9): THIS IS WHERE THE VISUAL REFERENCE
 * HAS A MAILING-LIST SIGN-UP BAND. IT IS DELIBERATELY NOT ONE HERE, AND
 * RE-ADDING ONE IS A PRODUCT DECISION, NOT A DESIGN TWEAK.
 * ---------------------------------------------------------------------------
 * V1 has no email-capture backend. `resend` is a declared dependency that is
 * wired to nothing — no send call, no list, no storage, no unsubscribe. A form
 * that silently discards what a customer types is worse than no form: it costs
 * the shopper a real expectation and returns nothing, and the merchant never
 * learns it is happening because a discarded submission produces no error.
 *
 * It would also put a promise into the copy catalogue that the product cannot
 * keep — "we'll email you" is a sentence no code in this repository can honour,
 * and shipping it makes the whole storefront's voice untrustworthy for the sake
 * of one band.
 *
 * WhatsApp is the channel these merchants already answer, on the phone they
 * already carry. So the band keeps the reference's shape — centred column,
 * heading, one line of body, one pill CTA — and points it at something real.
 *
 * ---------------------------------------------------------------------------
 * NO `"use client"`, AND NO SERVER-MARKED DEPENDENCY.
 * ---------------------------------------------------------------------------
 * Like every sibling in this directory, this renders from the RSC tree on the
 * live storefront AND from inside the editor's client-side preview canvas. That
 * is also why `data.whatsappHref` arrives fully built: the click-to-chat URL is
 * assembled server-side in plan 04-10 from the merchant's stored payment
 * settings, using the normalisation rules in the payments module. A second,
 * client-side implementation of those rules is exactly how two spellings of a
 * phone number drift apart, so this component concatenates nothing — it either
 * has a link or it does not.
 *
 * lucide ships no WhatsApp glyph and this project is NOT adding a brand-icon
 * package for one band. `message-circle` plus the channel's name in the label
 * (which the copy catalogue already supplies) is the answer; the word carries
 * the meaning and the icon carries the affordance.
 */

/**
 * `band` — Phase 4's original rendering, kept as a local component so
 * `ContactSection` below can dispatch to it. Not exported: the only public
 * entry point for this section type is the variant switch.
 */
function ContactBand({
  settings,
  data,
}: {
  /* Narrowed out of the union — see the note in `hero-section.tsx`. */
  readonly settings: Extract<SectionInstance, { type: "contact" }>["settings"];
  readonly data: StorefrontRenderData;
}) {
  return (
    <Reveal>
      <section className="mx-auto max-w-3xl px-6 py-16 text-center md:py-24">
        {/* Heading role: 24→32px / 600 / 1.2. */}
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
         * -------------------------------------------------------------------
         * NO CONFIGURED NUMBER MEANS NO BUTTON AT ALL. NEVER A DEAD ONE.
         * -------------------------------------------------------------------
         * `whatsappHref` is `null` when the merchant has not saved a number. A
         * greyed-out control, or an anchor pointing at the current page, both
         * leave a shopper clicking something that does nothing — and on a
         * storefront that is indistinguishable from a broken site. A merchant
         * who has not configured a number gets a SHORTER section, not a broken
         * one, and the section still reads as finished because the heading and
         * body stand alone.
         *
         * The nudge to go and configure one belongs in the editor's settings
         * panel for this section, with its link to the payment settings page.
         * It must never be rendered here: the preview route IS the storefront,
         * so anything this component draws is something a customer can see, and
         * merchant-facing instructions on a public page are a leak, not a hint.
         */}
        {data.whatsappHref !== null && (
          /*
           * The second of the accent's four permitted uses (04-UI-SPEC.md
           * § Color) — the same pill treatment as the hero CTA, on purpose:
           * these are the page's two "do something" moments and a shopper
           * should recognise the second from the first.
           *
           * `--brand-accent-foreground` is derived server-side from the accent,
           * so the label is readable at every colour a merchant can pick.
           *
           * `rel="noopener noreferrer"` is not optional on a new-tab link: it
           * denies the opened page a `window.opener` handle back into the
           * storefront's tab, which is the reverse-tabnabbing hole (T-04-26).
           * The href itself is server-built, so nothing here concatenates a
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
      </section>
    </Reveal>
  );
}

/**
 * The variant switch (TMPL-03, D-02) — THE one place `contact` dispatches to
 * a rendering. Two arms, no `default`, `: ReactElement` return annotation: an
 * unrecognised variant is a compile error here, never a blank band on a live
 * public storefront (T-05-20) — the same discipline `section-renderer.tsx`'s
 * own header documents for section TYPES, applied one level down to variants
 * of a single type. Mirrors `trust-bar-section.tsx`'s `TrustBarSection`
 * switch exactly.
 *
 * `variant` defaults to `"band"` — `SECTION_VARIANTS["contact"][0]` in
 * `src/server/theming/schema.ts`, the flagship's Phase 4 rendering — so this
 * component keeps compiling against `section-renderer.tsx`'s current
 * single-argument call site. Threading a real `variant` through that switch
 * is a later plan's job (05-10, per its own frontmatter); this default is
 * what keeps that boundary from being a broken build in between.
 */
export function ContactSection({
  settings,
  data,
  variant = "band",
}: {
  /* Narrowed out of the union — see the note in `hero-section.tsx`. */
  readonly settings: Extract<SectionInstance, { type: "contact" }>["settings"];
  readonly data: StorefrontRenderData;
  readonly variant?: SectionVariant<"contact">;
}): ReactElement {
  switch (variant) {
    case "band":
      return <ContactBand settings={settings} data={data} />;

    case "card":
      return <ContactCard settings={settings} data={data} />;
  }
}
