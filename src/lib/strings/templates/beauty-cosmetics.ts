/**
 * Per-template copy for the `beauty-cosmetics` segment (TMPL-04, Phase 5).
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
 * ---------------------------------------------------------------------------
 * WHY THE COPY CARRIES MORE WEIGHT HERE THAN ANYWHERE ELSE IN THE LIBRARY.
 * ---------------------------------------------------------------------------
 * `05-UI-SPEC.md` § Image Policy: every one of these 8 templates ships with
 * `backgroundImageKey: null` / `imageKey: null` (05-RESEARCH.md Finding 3 —
 * `storageKeySchema`'s tenant-prefixed regex makes a shared stock asset
 * structurally unreferenceable). Beauty and cosmetics is the segment where
 * that constraint bites hardest: it is the most visually-led category in the
 * library and it gets zero photographs by construction. A hero heading
 * written to sit over an imagined photo is the wrong heading here — every
 * string below is written to carry a fully typographic page on its own, and
 * to speak to what a Douala beauty/cosmetics buyer actually cares about:
 * authenticity of the product, whether a shade or skin/hair type actually
 * suits them, and discreet delivery — not generic "shop now" enthusiasm.
 *
 * Plan 05-08 shipped this namespace EMPTY as a contract-complete bridge
 * (`?? ""` in the segment's document/token builders). Plan 05-14 (this file,
 * Wave 3) fills it with the segment's 8 templates' real copy under that exact
 * type — no hand-widened or narrowed type introduced here.
 */

import type { TemplateKey } from "@/server/theming/registry";
import type { FlagshipCopy } from "../flagship";

export const beautyCosmeticsTemplates: Partial<Record<TemplateKey, Partial<FlagshipCopy>>> = {
  /**
   * S8 (hero:split | product-grid:showcase | editorial-split:split), starter.
   * Skincare generalist — the segment's strongest copy, per this plan's
   * instruction that the two `minTier: "starter"` rows get the most work.
   */
  "beauty-glow": {
    name: "Glow",
    segmentTag: "Beauty & cosmetics",
    announcement: "Skincare and beauty essentials, delivered across Douala.",
    hero: {
      eyebrow: "Skin first",
      heading: "Made for your skin, not just any skin",
      body: "Cleansers, serums and creams picked for real skin types and real Douala weather. Tell us your skin type and we'll point you to the right routine.",
      ctaLabel: "Shop skincare",
      ctaHref: "/",
    },
    productGrid: {
      heading: "Bestselling right now",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "Our approach",
      heading: "Skincare that respects your skin",
      body: "We choose products for the skin tones and skin types we actually sell to, not a stock photo. If something doesn't suit you, message us before you buy it.",
      ctaLabel: "See what's in stock",
      ctaHref: "/",
    },
    footerTagline: "Your skin, taken seriously.",
  },

  /**
   * S8, professional. Shares beauty-glow's skeleton, not its accent or its
   * subject — complexion/foundation matching rather than general skincare.
   */
  "beauty-veil": {
    name: "Veil",
    segmentTag: "Beauty & cosmetics",
    announcement: "Foundation and complexion shades matched to you.",
    hero: {
      eyebrow: "Shade matched",
      heading: "Foundation that actually matches your shade",
      body: "Complexion products chosen for the shade ranges people ask for most, not the ones a chart says should sell. Message us your shade questions before you order.",
      ctaLabel: "Find your shade",
      ctaHref: "/",
    },
    productGrid: {
      heading: "Complexion and colour",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "Why we stock this",
      heading: "Built around the shades people actually ask for",
      body: "Every foundation and concealer here earned its place because a customer asked for that exact shade. If we don't have your match yet, tell us.",
      ctaLabel: "See what's in stock",
      ctaHref: "/",
    },
    footerTagline: "Your shade, not the nearest one.",
  },

  /**
   * S9 (hero:full-bleed | trust-bar:band | product-grid:dense | contact:card),
   * starter. Natural haircare — the segment's other strongest-copy row.
   */
  "beauty-bloom": {
    name: "Bloom",
    segmentTag: "Beauty & cosmetics",
    announcement: "Haircare for natural hair, curls and braids.",
    hero: {
      eyebrow: "Hair care",
      heading: "Haircare that works with your texture",
      body: "Shampoos, oils and treatments chosen for natural hair, braids and everything in between. No routine here assumes one hair type fits all.",
      ctaLabel: "Shop haircare",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivery in Douala",
        body: "Your order reaches you, wrapped so nobody outside your home knows what's inside.",
      },
      itemTwo: {
        heading: "Ask before you buy",
        body: "Not sure which product suits your hair type. Message us on WhatsApp first.",
      },
      itemThree: {
        heading: "Pay your way",
        body: "Mobile Money, or cash when your order arrives.",
      },
    },
    productGrid: {
      heading: "Everything for your hair",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    contact: {
      heading: "Questions about a product?",
      body: "Send us a message on WhatsApp and we'll help you pick.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Hair care, done properly.",
  },

  /**
   * S9, professional. Shares beauty-bloom's skeleton, not its accent or its
   * subject — makeup finish rather than haircare.
   */
  "beauty-satin": {
    name: "Satin",
    segmentTag: "Beauty & cosmetics",
    announcement: "Makeup and finishing products for every skin tone.",
    hero: {
      eyebrow: "Makeup",
      heading: "A finish that looks like skin, not a mask",
      body: "Foundations, powders and finishing sprays chosen for a natural result across skin tones, not just the lightest ones.",
      ctaLabel: "Shop makeup",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivery in Douala",
        body: "Ordered discreetly, delivered the same way.",
      },
      itemTwo: {
        heading: "Talk to us",
        body: "Ask about finish, coverage or shade before you order.",
      },
      itemThree: {
        heading: "Pay your way",
        body: "Mobile Money, or cash on delivery.",
      },
    },
    productGrid: {
      heading: "Makeup essentials",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    contact: {
      heading: "Need help choosing a shade?",
      body: "Message us on WhatsApp with your questions and we'll get back to you.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Makeup that fits your tone.",
  },

  /**
   * S10 (hero:stack | product-grid:grid | trust-bar:strip | contact:band),
   * business. `hero:stack` has no image slot at all by construction — the
   * heading below is written to be the whole page's opening statement, not a
   * caption over a photo that will never exist.
   */
  "beauty-radiance": {
    name: "Radiance",
    segmentTag: "Beauty & cosmetics",
    announcement: "Skincare and wellness essentials for Douala's climate.",
    hero: {
      eyebrow: "Skin, in this climate",
      heading: "Skincare built for Douala's heat and humidity",
      body: "Lightweight formulas that hold up in the heat instead of sitting heavy on your skin. Picked for this city, not a cooler one.",
      ctaLabel: "Shop skincare",
      ctaHref: "/",
    },
    productGrid: {
      heading: "What's selling right now",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivery in Douala",
        body: "We get your order to you, wrapped for the trip.",
      },
      itemTwo: {
        heading: "Ask first",
        body: "Message us on WhatsApp if you're not sure what suits your skin.",
      },
      itemThree: {
        heading: "Pay your way",
        body: "Mobile Money, or cash when it arrives.",
      },
    },
    contact: {
      heading: "Questions? Message us.",
      body: "Send us a message on WhatsApp and we'll help you choose.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Skin care that suits the weather.",
  },

  /**
   * S10, professional. Shares beauty-radiance's skeleton, not its accent or
   * its subject — fragrance rather than skincare.
   */
  "beauty-luxe": {
    name: "Luxe",
    segmentTag: "Beauty & cosmetics",
    announcement: "Fragrance and premium beauty, sourced with care.",
    hero: {
      eyebrow: "Fragrance",
      heading: "Scent worth wearing, not just spraying",
      body: "Perfumes and body mists chosen for how they actually wear through a Douala day, not just how they smell in the bottle.",
      ctaLabel: "Shop fragrance",
      ctaHref: "/",
    },
    productGrid: {
      heading: "Fragrance and favourites",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivery in Douala",
        body: "Carefully packed so nothing arrives broken.",
      },
      itemTwo: {
        heading: "Ask before you buy",
        body: "Message us on WhatsApp if you want a scent description first.",
      },
      itemThree: {
        heading: "Pay your way",
        body: "Mobile Money, or cash on delivery.",
      },
    },
    contact: {
      heading: "Questions? Message us.",
      body: "Send us a message on WhatsApp and we'll help you pick a scent.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Worth the spray.",
  },

  /**
   * S11 (hero:split | editorial-split:banner | product-grid:showcase |
   * contact:card), business. Self-care / body-care generalist.
   */
  "beauty-aura": {
    name: "Aura",
    segmentTag: "Beauty & cosmetics",
    announcement: "Fragrance, body care and self-care essentials.",
    hero: {
      eyebrow: "Self-care",
      heading: "A routine, not just a product",
      body: "Body oils, mists and self-care essentials chosen to build a routine you'll actually keep, not a one-time purchase.",
      ctaLabel: "Shop self-care",
      ctaHref: "/",
    },
    editorialSplit: {
      eyebrow: "Our story",
      heading: "Why we sell what we sell",
      body: "Every product here is something we use ourselves first. If it doesn't hold up in daily use, it doesn't make it onto this shelf.",
      ctaLabel: "See what's in stock",
      ctaHref: "/",
    },
    productGrid: {
      heading: "Self-care essentials",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    contact: {
      heading: "Questions about a product?",
      body: "Message us on WhatsApp and we'll get back to you.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Make it part of your routine.",
  },

  /**
   * S11, professional. Shares beauty-aura's skeleton, not its accent or its
   * subject — makeup artistry and technique rather than self-care.
   */
  "beauty-muse": {
    name: "Muse",
    segmentTag: "Beauty & cosmetics",
    announcement: "Makeup and tools for every skill level.",
    hero: {
      eyebrow: "Makeup artistry",
      heading: "From your first brush to your best look",
      body: "Makeup and tools chosen for beginners and professionals alike, with honest advice on what actually works.",
      ctaLabel: "Shop makeup",
      ctaHref: "/",
    },
    editorialSplit: {
      eyebrow: "Learn as you shop",
      heading: "Advice, not just products",
      body: "Ask us how to use anything you buy here. We'd rather you love a product than return it because nobody explained it.",
      ctaLabel: "See what's in stock",
      ctaHref: "/",
    },
    productGrid: {
      heading: "Makeup and tools",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    contact: {
      heading: "Need advice?",
      body: "Message us on WhatsApp and we'll help you get it right.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Makeup, explained.",
  },
};
