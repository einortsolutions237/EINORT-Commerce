import type { ReactElement } from "react";

import type { SectionInstance } from "@/server/theming/schema";

import { ContactSection } from "./contact-section";
import { EditorialSplitSection } from "./editorial-split-section";
import { HeroSection } from "./hero-section";
import { ProductGridSection } from "./product-grid-section";
import type { StorefrontRenderData } from "./render-data";
import { TrustBarSection } from "./trust-bar-section";

/**
 * THE one place a section type maps to a component (TMPL-01, EDIT-01, D-05).
 *
 * ---------------------------------------------------------------------------
 * ONE `switch`, FIVE ARMS, NO `default` ARM, NO CAST. ADDING A SIXTH SECTION
 * TYPE MUST BE A COMPILE ERROR HERE.
 * ---------------------------------------------------------------------------
 * That compile error is the entire point of this file, and it is why the switch
 * has no fallback arm. `sectionInstanceSchema` is a discriminated union on
 * `type`, so the compiler narrows `section.settings` from `section.type` and
 * each arm hands its component a settings object already proven to be the right
 * shape.
 *
 * THE `: ReactElement` RETURN ANNOTATION IS THE MECHANISM AND MUST NOT BE
 * DELETED AS REDUNDANT. It is what turns "the switch does not cover everything"
 * into a build failure. Left off, the return type is INFERRED, a sixth union
 * member simply widens it to include `undefined`, and this file compiles
 * happily while the new section renders as nothing — the exact silent outcome
 * the no-fallback rule exists to prevent. Verified by adding a sixth member and
 * watching the error land here, not by assuming. With the annotation present a
 * sixth member produces TS2366 at this function: the switch stops being
 * exhaustive, so the body can fall off the end, and the declared return type
 * does not admit `undefined`.
 *
 * This is the same drift detection `src/server/orders/state-machine.ts` states
 * at lines 62-70 for `ORDER_TRANSITIONS`: a seventh enum member must be a
 * COMPILE error at that table, because a `Partial<Record<…>>`-plus-`?? []`
 * shape would instead make the new state silently terminal — legal-looking,
 * untested, and discovered by a merchant whose order will not move. The failure
 * mode here is the same one wearing different clothes: a lookup with a fallback
 * would make a newly added section type render as nothing at all, on a live
 * public storefront, with every test still green.
 *
 * ---------------------------------------------------------------------------
 * WHY A `switch` AND NOT A `Record<string, { schema, Component }>` REGISTRY.
 * ---------------------------------------------------------------------------
 * A keyed registry cannot be mapped over without a cast. The compiler cannot
 * prove that `REGISTRY[section.type].Component` accepts `section.settings` —
 * the lookup erases the correlation between the two, so the only way to make it
 * compile is to assert one, and an assertion is precisely the check being given
 * up. The `switch` proves the correlation instead of asserting it. IF YOU FIND
 * YOURSELF REACHING FOR AN ASSERTION IN THIS FILE, THE UNION IS NOT NARROWING
 * AND THE FIX IS UPSTREAM IN THE SCHEMA — never a widened type here.
 *
 * ---------------------------------------------------------------------------
 * A ROUTE THAT CAN TAKE MONEY OR CHANGE ORDER STATE IS NEVER SECTION-RENDERED.
 * ---------------------------------------------------------------------------
 * 04-RESEARCH.md Pattern 12, recorded here because it is the scope creep a
 * later phase proposes innocently ("the cart is just another page, let the
 * merchant style it"). `/cart`, `/checkout` and `/order/[token]` are fixed
 * transactional surfaces, and the product detail page is fixed for this phase
 * (04-CONTEXT.md Addendum, OQ-4). A merchant-authored document must never be
 * able to decide what a shopper sees at the moment they part with money, or
 * what an order's state page says. This renderer is only ever called for a
 * document whose page type is the home page. Brand tokens still reach those
 * routes — they are applied by the storefront layout, not by a section.
 *
 * ---------------------------------------------------------------------------
 * NO ERROR BOUNDARY AND NO `try`. ON PURPOSE.
 * ---------------------------------------------------------------------------
 * A document that does not parse is handled upstream, on the read path, by a
 * safe parse that falls back to the default document (plan 04-09). Swallowing a
 * render failure here would hide that degradation: the merchant would see a
 * section quietly vanish instead of a storefront that fell back visibly and a
 * log line saying why. Degrade in one place, loudly, or not at all.
 *
 * No `key` is set inside this component either — the caller maps over
 * `document.sections` and supplies `key={section.id}` there, which is where
 * React needs it and the only place it is meaningful.
 *
 * Marker-free like every other file in this directory: it renders from the RSC
 * tree on the live storefront and from inside the editor's client-side preview
 * canvas, and it pulls in all five sections, so a server-marked dependency
 * anywhere beneath it is an editor-route build failure (T-04-24).
 */
export function SectionRenderer({
  section,
  data,
}: {
  readonly section: SectionInstance;
  readonly data: StorefrontRenderData;
}): ReactElement {
  switch (section.type) {
    case "hero":
      return <HeroSection settings={section.settings} data={data} />;

    /*
     * The trust bar takes no `data`: its content is entirely merchant-authored
     * settings, with nothing read from the catalogue. Threading `data` in
     * anyway "for symmetry" would make every future reader wonder which of its
     * fields the band depends on.
     */
    case "trust-bar":
      return <TrustBarSection settings={section.settings} />;

    case "product-grid":
      return <ProductGridSection settings={section.settings} data={data} />;

    case "editorial-split":
      return <EditorialSplitSection settings={section.settings} data={data} />;

    case "contact":
      return <ContactSection settings={section.settings} data={data} />;
  }
}
