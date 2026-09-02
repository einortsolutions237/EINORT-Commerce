import "server-only";

/**
 * The flagship template's day-one content — D-04's default document and tokens.
 *
 * This is what a merchant who signs up, uploads nothing and never opens the
 * editor actually shows their customers. It is not placeholder data waiting to
 * be replaced; it is the shipped state of most storefronts on this platform,
 * and it has to read as a real shop.
 *
 * ---------------------------------------------------------------------------
 * BOTH EXPORTS ARE FUNCTIONS. NEITHER IS A FROZEN MODULE-LEVEL CONSTANT.
 * ---------------------------------------------------------------------------
 * T-04-22. A shared literal is a literal one careless caller can mutate — and
 * the callers here are the tenant seed path and the storefront read-path
 * fallback, so a single `document.sections.reverse()` or
 * `settings.heading = …` upstream would corrupt every subsequent tenant created
 * in that process and every degraded read served from it. The corruption is
 * cross-tenant, silent, and invisible in the database. A fresh object per call
 * costs nothing at these sizes and removes the failure mode entirely.
 * `tests/unit/theming-registry.test.ts` pins it with a mutation test — do not
 * "optimise" either function into a hoisted constant.
 *
 * ---------------------------------------------------------------------------
 * D-01 / D-04: THE COPY IS INDUSTRY-NEUTRAL ON PURPOSE.
 * ---------------------------------------------------------------------------
 * `New arrivals`, never `The Autumn Collection`. Every merchant regardless of
 * segment ships on this one template this phase, so a sentence that only fits a
 * clothing boutique is a sentence that is wrong for most stores that ever
 * render it. The bar this default has to clear is not "delightful for a fashion
 * merchant" — it is "not obviously wrong to a hardware seller previewing their
 * new store". Industry-specific defaults are Phase 5's job, arriving as new
 * rows in `TEMPLATES`, and D-03 means no existing merchant is migrated onto one.
 *
 * Every string below is a reference into `strings.flagship`. There is no inline
 * prose in this file and there must not be one: the copy is a copy concern and
 * lives in `src/lib/strings.ts` for the same reason the registry's labels do.
 *
 * ---------------------------------------------------------------------------
 * THIS MODULE IS SERVER-ONLY AND MUST BE PASSED AS PROPS, NEVER IMPORTED.
 * ---------------------------------------------------------------------------
 * 04-PATTERNS.md § Shared Pattern 1. It reads `registry.ts` (also `server-only`)
 * and `strings`. If the preview CLIENT component or any editor island ever
 * needs a default, the RSC above it resolves it and hands it down as a prop.
 * Importing this file from a `"use client"` module is a build error, and the
 * fix is the prop — never dropping the marker from this file or from the
 * registry.
 */

import {
  DEFAULT_PRIMARY_ACCENT,
  DEFAULT_SECONDARY_ACCENT,
} from "@/lib/theme-defaults";
import { strings } from "@/lib/strings";

import type { PageDocument, ThemeTokens } from "@/server/theming/schema";

/**
 * The default hero scrim.
 *
 * The schema clamps 0…0.8 and the registry offers 0 / 0.3 / 0.6; 0.3 is the S1
 * default in 04-UI-SPEC.md. It is stored even though the default document has
 * NO background image, because the value is what applies the moment the
 * merchant adds one — a hero that renders unreadable on first upload is a worse
 * first impression than one that is slightly dark.
 */
const DEFAULT_OVERLAY_OPACITY = 0.3;

/** The grid's default count, one of the schema's three literals. */
const DEFAULT_ITEM_COUNT = 8 as const;

/**
 * A brand-new merchant's storefront document.
 *
 * ---------------------------------------------------------------------------
 * THE SECTION ORDER IS LOCKED. IT IS NOT ALPHABETICAL AND MUST NOT BE SORTED.
 * ---------------------------------------------------------------------------
 * 04-UI-SPEC.md's background-treatment alternation rule is what this order
 * encodes: photo hero → washed trust band → white product grid → ink editorial
 * band → white contact. No two adjacent sections share a background treatment,
 * which is most of what makes the page read as designed rather than as a stack
 * of boxes. Reordering these five is a visual change, and this exact order is
 * the one the Design-Distinctiveness Gate is judged against.
 *
 * `TEMPLATES["flagship-fashion"].sections` declares the same order, and
 * `tests/unit/theming-registry.test.ts` asserts the two agree — so the template
 * table cannot claim one thing while this function builds another.
 *
 * EACH SECTION'S `id` IS ITS OWN `type` STRING. That is not laziness. D-05
 * fixes membership at exactly one instance per type — sections are reorderable,
 * never addable or removable — so the type IS a stable unique id for the life of
 * the document. The reducer addresses sections by `id`, and a `randomUUID()`
 * here would make every seeded document differ from every other for no benefit
 * while breaking the fixture byte-identity `tests/setup/seed-two-tenants.ts`
 * depends on. If D-05 is ever relaxed to allow two heroes, this is the line
 * that has to change first.
 */
export function flagshipDefaultDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.flagship.hero.eyebrow,
          heading: strings.flagship.hero.heading,
          body: strings.flagship.hero.body,
          ctaLabel: strings.flagship.hero.ctaLabel,
          ctaHref: strings.flagship.hero.ctaHref,
          /*
           * NULL IS THE DAY-ONE STATE, NOT A MISSING VALUE. A merchant has
           * uploaded nothing at the moment this document is created, and S1's
           * no-image mode — zinc-100 field, no scrim, ink text — is a designed
           * state that must look deliberate rather than broken. There is no
           * stock photograph to fall back to and there should not be one: a
           * generic hero image on a Douala boutique is worse than no image.
           */
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "trust-bar",
        type: "trust-bar",
        /*
         * Three items, not four. The schema allows 1…4; three is what the band
         * is laid out for and what 04-UI-SPEC.md § Flagship default content
         * specifies. The icons pair with `strings.flagship.trustBar` items one
         * to three in this order, and the icon values are schema enum members —
         * identifiers, never copy.
         */
        settings: {
          blocks: [
            {
              type: "trust-item",
              icon: "truck",
              heading: strings.flagship.trustBar.itemOne.heading,
              body: strings.flagship.trustBar.itemOne.body,
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.flagship.trustBar.itemTwo.heading,
              body: strings.flagship.trustBar.itemTwo.body,
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.flagship.trustBar.itemThree.heading,
              body: strings.flagship.trustBar.itemThree.body,
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.flagship.productGrid.heading,
          viewAllLabel: strings.flagship.productGrid.viewAllLabel,
          viewAllHref: strings.flagship.productGrid.viewAllHref,
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.flagship.editorialSplit.eyebrow,
          heading: strings.flagship.editorialSplit.heading,
          /*
           * The one instructional default in the document. It reads as a prompt
           * to the merchant inside the editor and is still a coherent,
           * shippable sentence if they never touch it — which is the only form
           * of placeholder this file permits. Everything else is real copy.
           */
          body: strings.flagship.editorialSplit.body,
          ctaLabel: strings.flagship.editorialSplit.ctaLabel,
          ctaHref: strings.flagship.editorialSplit.ctaHref,
          /* Null collapses S4 to a single centred column — never a half-empty grid. */
          imageKey: null,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.flagship.contact.heading,
          body: strings.flagship.contact.body,
          ctaLabel: strings.flagship.contact.ctaLabel,
        },
      },
    ],
  };
}

/**
 * A brand-new merchant's brand tokens.
 *
 * The two accents are the zinc defaults from `src/lib/theme-defaults.ts`, so a
 * merchant who skips the colour pickers entirely gets the reference's own
 * editorial palette rather than a half-branded page. Only the two accents are
 * stored — the foregrounds and the focus ring are derived by
 * `deriveThemeCssVars` (D-11) so an unreadable pair cannot be persisted.
 *
 * THE ANNOUNCEMENT TEXT IS DELIBERATELY NON-EMPTY. The announcement bar is
 * where the secondary accent is filled, and D-10 asks the merchant for two
 * colours at onboarding. A colour with no visible role is a pointless question:
 * if the bar were empty by default, the second picker would appear to do
 * nothing, and the merchant would reasonably conclude the product ignored their
 * choice. Emptying this default is therefore a change to what the onboarding
 * step means, not a copy tweak.
 *
 * Returns a fresh object per call for the reason in the file header.
 */
export function flagshipDefaultTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.flagship.announcement,
    footerTagline: strings.flagship.footerTagline,
  };
}
