/**
 * Per-template copy for the `fashion-apparel` segment (TMPL-04, Phase 5).
 *
 * Spliced flat into `strings.templates` by `src/lib/strings/index.ts` — see
 * that namespace's own header for why this stays flat by template key rather
 * than nested under a segment key.
 *
 * Shape mirrors `strings.flagship` structurally (`name`, `segmentTag`,
 * `announcement`, `footerTagline`, `hero.{eyebrow,heading,body,ctaLabel,
 * ctaHref}`, `trustBar.item{One,Two,Three}.{heading,body}`,
 * `productGrid.{heading,viewAllLabel,viewAllHref}`,
 * `editorialSplit.{eyebrow,heading,body,ctaLabel,ctaHref}`,
 * `contact.{heading,body,ctaLabel}`) via `FlagshipCopy`
 * (`src/lib/strings/flagship.ts`, `typeof flagshipCopy` — the exact value
 * `strings.flagship` is assigned from) rather than a hand-declared duplicate
 * interface, so this namespace can never drift from `strings.flagship`'s own
 * type. Imported from `./flagship`, not `@/lib/strings`, because
 * `@/lib/strings` (`index.ts`) imports this module's own export back to
 * build `strings.templates` — importing `strings` here would be a circular
 * type reference (see `flagship.ts`'s header for the full explanation).
 *
 * Character caps every string here must satisfy (`src/server/theming/
 * schema.ts`): `heading` 120, `body` 280, `ctaLabel` 30, trust-bar `heading`
 * 48, trust-bar `body` 140, product-grid `heading` 80.
 *
 * Voice contract (`src/lib/strings/index.ts` lines 1-33): direct, second
 * person, no exclamation marks, no "Oops", no emoji.
 *
 * 05-12 (Wave 3) fills this namespace with the segment's seven non-flagship
 * templates' real copy. `flagship-fashion` reads its own copy from
 * `strings.flagship` and deliberately has no entry here (05-RESEARCH.md §
 * Skeleton allocation — the fixture `tests/setup/seed-two-tenants.ts` and
 * `theming-registry.test.ts` pin depend on its byte-identity).
 *
 * A copy group only appears on a template below if that template's registry
 * row (`src/server/theming/registry.ts`) declares the matching section type:
 *
 *   - `fashion-classic` — hero, trustBar, productGrid, editorialSplit, contact
 *     (same skeleton as `flagship-fashion`, distinct copy and accent)
 *   - `fashion-edit` / `fashion-muse` — hero, productGrid only
 *   - `fashion-studio` / `fashion-house` — hero, productGrid only
 *   - `fashion-runway` / `fashion-loft` — hero, productGrid, contact
 *
 * Written for a Douala fashion/apparel merchant — boutique, tailor/atelier,
 * streetwear, or resale — concrete rather than aspirational, no
 * stock-marketing register. All seven `hero.eyebrow + hero.heading` pairs
 * below (and `strings.flagship.hero`'s) are distinct, satisfying the
 * distinctiveness metric's rule 3 signature.
 */

import type { TemplateKey } from "@/server/theming/registry";
import type { FlagshipCopy } from "../flagship";

export const fashionApparelTemplates: Partial<Record<TemplateKey, Partial<FlagshipCopy>>> = {
  /**
   * `minTier: "professional"`. Shares `flagship-fashion`'s full five-section
   * skeleton (S0) but reads as a distinct, well-established boutique rather
   * than a restatement of the flagship's own copy.
   */
  "fashion-classic": {
    name: "Classic",
    segmentTag: "Fashion & apparel",
    announcement: "New arrivals every week. Pay by Mobile Money or on delivery.",

    hero: {
      eyebrow: "The boutique",
      heading: "Dressed for every day in Douala",
      body: "Quality pieces you'll actually wear, from work to weekend.",
      ctaLabel: "Shop the collection",
      ctaHref: "/",
    },

    trustBar: {
      itemOne: {
        heading: "Delivery in Douala",
        body: "We bring your order to your door.",
      },
      itemTwo: {
        heading: "Easy to reach",
        body: "Message us on WhatsApp with any question.",
      },
      itemThree: {
        heading: "Quality checked",
        body: "Every piece is inspected before it ships.",
      },
    },

    productGrid: {
      heading: "What's new in the boutique",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },

    editorialSplit: {
      eyebrow: "About us",
      heading: "A boutique for everyday Douala style",
      body: "We started this boutique to make well-made, wearable fashion easy to find in Douala. Every piece is chosen to work for real days — market runs, church, the office, and everything after.",
      ctaLabel: "Shop the boutique",
      ctaHref: "/",
    },

    contact: {
      heading: "Questions about sizing or delivery?",
      body: "Message us on WhatsApp and we'll help you find the right fit.",
      ctaLabel: "Message us on WhatsApp",
    },

    footerTagline: "Thank you for shopping our boutique.",
  },

  /**
   * `minTier: "starter"`. One of this segment's two starter rows (alongside
   * `flagship-fashion`) — most merchants in this segment will see this one,
   * so it carries the strongest copy rather than a leftover.
   */
  "fashion-edit": {
    name: "Edit",
    segmentTag: "Fashion & apparel",
    announcement: "This week's edit, picked for you.",

    hero: {
      eyebrow: "This week's edit",
      heading: "A few pieces, chosen carefully",
      body: "We keep the edit small so every piece earns its place.",
      ctaLabel: "See the edit",
      ctaHref: "/",
    },

    productGrid: {
      heading: "In this week's edit",
      viewAllLabel: "See everything",
      viewAllHref: "/",
    },

    footerTagline: "Thanks for checking out the edit.",
  },

  /** `minTier: "professional"`. Shares `fashion-edit`'s S1 skeleton. */
  "fashion-muse": {
    name: "Muse",
    segmentTag: "Fashion & apparel",
    announcement: "Limited pieces. Once they're gone, they're gone.",

    hero: {
      eyebrow: "For the muse",
      heading: "Pieces with a point of view",
      body: "Statement fashion for the woman who dresses for herself first.",
      ctaLabel: "Shop the muse edit",
      ctaHref: "/",
    },

    productGrid: {
      heading: "The muse edit",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },

    footerTagline: "Thank you for shopping with us.",
  },

  /** `minTier: "business"`. Tailoring/atelier persona, S2 skeleton. */
  "fashion-studio": {
    name: "Studio",
    segmentTag: "Fashion & apparel",
    announcement: "Book a fitting or shop ready-to-wear.",

    hero: {
      eyebrow: "The studio",
      heading: "Tailoring, done right",
      body: "Made-to-measure and ready-to-wear, cut for your shape.",
      ctaLabel: "Book a fitting",
      ctaHref: "/",
    },

    productGrid: {
      heading: "Ready-to-wear from the studio",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },

    footerTagline: "Thank you for trusting us with your fit.",
  },

  /** `minTier: "professional"`. Shares `fashion-studio`'s S2 skeleton. */
  "fashion-house": {
    name: "House",
    segmentTag: "Fashion & apparel",
    announcement: "Made to order. Ask us about your size.",

    hero: {
      eyebrow: "The house",
      heading: "Custom fashion, house-made",
      body: "Every piece cut and finished in our own workshop.",
      ctaLabel: "Explore the house",
      ctaHref: "/",
    },

    productGrid: {
      heading: "From the house",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },

    footerTagline: "Thank you for shopping the house.",
  },

  /** `minTier: "business"`. Streetwear persona, S3 skeleton. */
  "fashion-runway": {
    name: "Runway",
    segmentTag: "Fashion & apparel",
    announcement: "Fresh drops every Friday.",

    hero: {
      eyebrow: "Fresh drops",
      heading: "Streetwear that moves fast",
      body: "New drops land often. Follow along so you don't miss one.",
      ctaLabel: "Shop the drop",
      ctaHref: "/",
    },

    productGrid: {
      heading: "Latest drops",
      viewAllLabel: "Shop all drops",
      viewAllHref: "/",
    },

    contact: {
      heading: "Need help before you order?",
      body: "Send us a WhatsApp message about sizing, stock, or delivery to your area.",
      ctaLabel: "Message us on WhatsApp",
    },

    footerTagline: "Thanks for shopping the drop.",
  },

  /**
   * `minTier: "professional"`. Shares `fashion-runway`'s S3 skeleton;
   * resale/vintage persona instead of streetwear.
   */
  "fashion-loft": {
    name: "Loft",
    segmentTag: "Fashion & apparel",
    announcement: "Preloved and one-of-one finds, restocked weekly.",

    hero: {
      eyebrow: "The loft",
      heading: "Preloved pieces, handpicked",
      body: "Vintage and gently worn fashion, sourced and checked by hand.",
      ctaLabel: "Browse the loft",
      ctaHref: "/",
    },

    productGrid: {
      heading: "In the loft right now",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },

    contact: {
      heading: "Ask about an item before you buy",
      body: "Preloved pieces are one of a kind. Message us on WhatsApp to check size, condition, or availability.",
      ctaLabel: "Message us on WhatsApp",
    },

    footerTagline: "Thank you for shopping the loft.",
  },
};
