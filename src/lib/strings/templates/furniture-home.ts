/**
 * Per-template copy for the `furniture-home` segment (TMPL-04, Phase 5).
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
 * schema.ts`): hero `heading` 120, `body` 280, `ctaLabel` 30; trust-bar
 * `heading` 48, `body` 140; product-grid `heading` 80, `viewAllLabel` 30;
 * editorial-split `heading` 120, `body` 280, `ctaLabel` 30; contact `heading`
 * 80, `body` 280, `ctaLabel` 30; `announcement` 120; `footerTagline` 160.
 *
 * Voice contract (`src/lib/strings/index.ts` lines 1-33): direct, second
 * person, no exclamation marks, no "Oops", no emoji.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SEGMENT READS DIFFERENTLY FROM GROCERY OR FASHION
 * ---------------------------------------------------------------------------
 * A Douala furniture/homeware buyer is not deciding between two shirts — they
 * are deciding whether a sofa fits their sitting room, how it gets up the
 * stairs, and how long a made-to-order piece takes to build. The trust-bar
 * copy across all 8 templates below carries three recurring concerns instead
 * of the flagship's generic delivery/chat/payment triplet: delivery-and-
 * assembly logistics for bulky items, lead time on made-to-order work, and a
 * WhatsApp channel for confirming dimensions before a customer commits to a
 * large purchase. Icon choice (a schema enum, not copy — assigned in
 * `src/server/theming/templates/furniture-home.ts`) varies per template
 * rather than repeating one fixed pattern, so the 8 trust bars do not all
 * read as the same three sentences with nouns swapped.
 *
 * `furniture-loom` and `furniture-grain` share a skeleton (S16) with a
 * `product-grid:showcase` variant, as do `furniture-nook` and `furniture-
 * loft` (S19) — both pairs get a `productGrid.heading` and (where the row
 * carries one) `editorialSplit` copy pitched at fewer, larger, more
 * considered items rather than a dense catalogue, per the plan's Task 1
 * content rule. `furniture-oak`/`furniture-hearth` (S17, `grid`) and
 * `furniture-timber`/`furniture-haven` (S18, `dense`) read as a fuller,
 * more practical catalogue instead.
 *
 * The two `minTier: "starter"` rows — `furniture-oak` and `furniture-loom`
 * — carry this segment's strongest copy, per the plan's explicit instruction.
 */

import type { TemplateKey } from "@/server/theming/registry";
import type { FlagshipCopy } from "../flagship";

export const furnitureHomeTemplates: Partial<
  Record<TemplateKey, Partial<FlagshipCopy>>
> = {
  /**
   * S16: hero:stack | product-grid:showcase | contact:card | trust-bar:strip.
   * No editorial-split — this row's registry entry omits it. Starter tier;
   * the strongest voice in the segment per the plan's content rule.
   */
  "furniture-loom": {
    name: "Loom",
    segmentTag: "Furniture & home",
    announcement: "Made-to-order pieces. Delivery and assembly across Douala.",
    hero: {
      eyebrow: "Made in Douala",
      heading: "Furniture built for your home, not off a shelf",
      body: "Every piece is made to order — tell us the size, the wood, the finish, and we build it for your space.",
      ctaLabel: "See what we make",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivery and assembly",
        body: "We deliver and assemble in Douala. Larger pieces go out by truck, set up in your home.",
      },
      itemTwo: {
        heading: "Made to order",
        body: "Custom pieces take two to four weeks. We'll confirm your timeline before you order.",
      },
      itemThree: {
        heading: "Ask about dimensions",
        body: "Message us on WhatsApp with your room size and we'll help you choose.",
      },
    },
    productGrid: {
      heading: "Our made-to-order pieces",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    contact: {
      heading: "Planning a room?",
      body: "Send us your space and we'll help you find or build the right piece.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Furniture and homeware, made for Douala homes.",
  },

  /**
   * S16, shared with `furniture-loom` above — same section list and order,
   * different tier (professional) and, per Task 2, a different accent.
   * Angle shifts from "built for your home" to the wood itself.
   */
  "furniture-grain": {
    name: "Grain",
    segmentTag: "Furniture & home",
    announcement: "Solid wood, built to order. Ask us on WhatsApp.",
    hero: {
      eyebrow: "Crafted by hand",
      heading: "Solid wood, cut and finished for you",
      body: "We work in oak, mahogany, and iroko. Pick your wood and your dimensions, and we'll build a piece that fits your room exactly.",
      ctaLabel: "View our pieces",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivery, done right",
        body: "We deliver and assemble every piece ourselves — nothing left flat-packed at your door.",
      },
      itemTwo: {
        heading: "Built when you order",
        body: "Every piece is cut and finished after you order, in the wood you choose.",
      },
      itemThree: {
        heading: "Solid wood, always",
        body: "No veneer, no particleboard. Ask us about the wood before you buy.",
      },
    },
    productGrid: {
      heading: "Pieces in solid wood",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    contact: {
      heading: "Have a wood in mind?",
      body: "Tell us the wood, the size, and the finish — we'll quote you a build.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Solid wood furniture, built to order.",
  },

  /**
   * S17: hero:full-bleed | trust-bar:band | product-grid:grid |
   * editorial-split:banner | contact:card. Starter tier; the segment's other
   * strongest-copy row.
   */
  "furniture-oak": {
    name: "Oak",
    segmentTag: "Furniture & home",
    announcement: "Delivery and assembly included. Order online or on WhatsApp.",
    hero: {
      eyebrow: "Douala furniture, delivered",
      heading: "Furniture and homeware for every room",
      body: "Sofas, tables, beds, and the small things that make a house feel like home. Imported and made-to-order pieces, delivered and set up in your home.",
      ctaLabel: "Shop the collection",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivery across Douala",
        body: "Bulky pieces delivered and carried in — we handle the heavy lifting.",
      },
      itemTwo: {
        heading: "Lead time, upfront",
        body: "We'll tell you exactly how long your order takes before you pay.",
      },
      itemThree: {
        heading: "Measure before you buy",
        body: "Send us your room's dimensions on WhatsApp and we'll confirm it fits.",
      },
    },
    productGrid: {
      heading: "Shop furniture and homeware",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "Why shop with us",
      heading: "Furniture chosen for real Douala homes",
      body: "We import what travels well and build what doesn't — every piece picked or made for how you actually live.",
      ctaLabel: "See our story",
      ctaHref: "/",
    },
    contact: {
      heading: "Questions about a piece?",
      body: "Message us on WhatsApp about size, material, or delivery.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Furniture and homeware for every room.",
  },

  /**
   * S17, shared with `furniture-oak` above — same sections and order,
   * professional tier, different accent. Angle shifts from the full catalog
   * pitch to a calmer "finished home" framing.
   */
  "furniture-hearth": {
    name: "Hearth",
    segmentTag: "Furniture & home",
    announcement: "Furniture and homeware, delivered across Douala.",
    hero: {
      eyebrow: "For the whole home",
      heading: "Everything a home needs, in one place",
      body: "From the living room to the kitchen, we stock furniture and homeware imported and made locally, ready for your home.",
      ctaLabel: "Browse the shop",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "We deliver and assemble",
        body: "Sofas, beds, and tables arrive built or assembled on site.",
      },
      itemTwo: {
        heading: "Quality you can check",
        body: "Ask to see the materials before you order — we're happy to show you.",
      },
      itemThree: {
        heading: "Talk to us first",
        body: "Not sure what fits your space? Message us on WhatsApp before you order.",
      },
    },
    productGrid: {
      heading: "Everything for your home",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "About this shop",
      heading: "A home should feel finished",
      body: "From the sofa to the side table, we help you put a room together — piece by piece, at your pace.",
      ctaLabel: "See what we offer",
      ctaHref: "/",
    },
    contact: {
      heading: "Need help choosing?",
      body: "Message us on WhatsApp and we'll help you find the right piece.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "A home, finished one piece at a time.",
  },

  /**
   * S18: hero:split | trust-bar:strip | product-grid:dense |
   * editorial-split:banner | contact:band. Business tier; a fuller,
   * practical catalogue rather than a considered showcase.
   */
  "furniture-timber": {
    name: "Timber",
    segmentTag: "Furniture & home",
    announcement: "In stock and made-to-order pieces. Delivery included.",
    hero: {
      eyebrow: "Built to last",
      heading: "Furniture for homes and offices",
      body: "Solid, practical pieces at a fair price — chairs, tables, shelving, and storage for every room, in stock and ready for delivery.",
      ctaLabel: "See our range",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivery, included",
        body: "Every order includes delivery within Douala. Assembly on request.",
      },
      itemTwo: {
        heading: "In stock or made to order",
        body: "Some pieces ship this week. Custom pieces take longer — we'll tell you upfront.",
      },
      itemThree: {
        heading: "Built to last",
        body: "Solid frames and real materials, not what falls apart in a year.",
      },
    },
    productGrid: {
      heading: "Our full range",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "How we work",
      heading: "Furniture for homes and offices",
      body: "We stock practical pieces at a fair price and build custom ones when the size or shape you need isn't on the shelf.",
      ctaLabel: "See how we work",
      ctaHref: "/",
    },
    contact: {
      heading: "Furnishing a whole space?",
      body: "Message us on WhatsApp — we quote homes and offices, one room or the whole build.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Practical furniture, built to last.",
  },

  /**
   * S18, shared with `furniture-timber` above — same sections and order,
   * professional tier, different accent. Angle shifts from practical/office
   * framing to comfort at home.
   */
  "furniture-haven": {
    name: "Haven",
    segmentTag: "Furniture & home",
    announcement: "Furniture and soft furnishings for every room.",
    hero: {
      eyebrow: "Your home, comfortable",
      heading: "Furniture that makes a house a home",
      body: "Comfortable sofas, real wood tables, and soft furnishings chosen to make every room feel finished.",
      ctaLabel: "Explore the range",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivered and set up",
        body: "We bring larger pieces in and set them up — no assembly left to you.",
      },
      itemTwo: {
        heading: "Know your timeline",
        body: "We confirm how long a custom piece takes before you commit to it.",
      },
      itemThree: {
        heading: "Ask before you order",
        body: "Message us your room's size on WhatsApp and we'll tell you what fits.",
      },
    },
    productGrid: {
      heading: "Everything in stock",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "About us",
      heading: "Comfort, chosen carefully",
      body: "Every sofa, table and soft furnishing here is picked to make a room feel calmer, not just fuller.",
      ctaLabel: "See the collection",
      ctaHref: "/",
    },
    contact: {
      heading: "Looking for something specific?",
      body: "Message us on WhatsApp and we'll help you find it or build it.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "A calmer home, one room at a time.",
  },

  /**
   * S19: hero:stack | editorial-split:split | trust-bar:band |
   * product-grid:showcase | contact:card. Business tier; angle is
   * small-space furniture, matching the showcase grid's few-large-items
   * treatment.
   */
  "furniture-nook": {
    name: "Nook",
    segmentTag: "Furniture & home",
    announcement: "Made-to-order pieces, sized for your space.",
    hero: {
      eyebrow: "Small space, big style",
      heading: "Furniture made to fit your space",
      body: "Whatever the size of your home, we build and source pieces that fit — measured, made, and delivered to you in Douala.",
      ctaLabel: "See our pieces",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivery and assembly",
        body: "We deliver and assemble bulky pieces so moving day stays simple.",
      },
      itemTwo: {
        heading: "Made-to-order timelines",
        body: "Custom pieces are built after you order — we'll confirm how long first.",
      },
      itemThree: {
        heading: "Fits your space",
        body: "Send us your measurements on WhatsApp before you order anything.",
      },
    },
    editorialSplit: {
      eyebrow: "Made to fit",
      heading: "Furniture for the space you actually have",
      body: "Not every home has room for a full-size sofa. We build and source pieces sized for smaller rooms and awkward corners.",
      ctaLabel: "See what fits",
      ctaHref: "/",
    },
    productGrid: {
      heading: "Pieces made for small spaces",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    contact: {
      heading: "Not sure it'll fit?",
      body: "Message us your room's dimensions on WhatsApp and we'll help you decide.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Furniture that fits, even in a small room.",
  },

  /**
   * S19, shared with `furniture-nook` above — same sections and order,
   * professional tier, different accent. Angle shifts from small-space
   * fitting to a considered, edited collection.
   */
  "furniture-loft": {
    name: "Loft",
    segmentTag: "Furniture & home",
    announcement: "A considered collection. Delivery across Douala.",
    hero: {
      eyebrow: "Modern living",
      heading: "Furniture for the way you live now",
      body: "Clean lines, real materials, and pieces built to order — a considered collection for a home that feels put together.",
      ctaLabel: "View the collection",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "We handle delivery",
        body: "Assembly and delivery included on every order over a set size.",
      },
      itemTwo: {
        heading: "Real materials",
        body: "Solid wood, real leather, real linen — ask us what a piece is made of.",
      },
      itemThree: {
        heading: "Plan it with us",
        body: "Message us on WhatsApp before you order and we'll help you plan the room.",
      },
    },
    editorialSplit: {
      eyebrow: "Our approach",
      heading: "Fewer pieces, chosen carefully",
      body: "We'd rather sell you one piece you'll keep for years than five you'll replace. Every item here is picked with that in mind.",
      ctaLabel: "See the collection",
      ctaHref: "/",
    },
    productGrid: {
      heading: "This season's pieces",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    contact: {
      heading: "Planning a room?",
      body: "Message us on WhatsApp and we'll help you put it together.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Fewer pieces, chosen to last.",
  },
};
