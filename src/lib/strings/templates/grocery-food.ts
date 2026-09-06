/**
 * Per-template copy for the `grocery-food` segment (TMPL-04, Phase 5).
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
 * PLAN 05-15 (WAVE 3): THE SEGMENT'S 8 TEMPLATES, EACH A DISTINCT SUB-NICHE.
 * ---------------------------------------------------------------------------
 * Every row below reads `strings.templates["<key>"]` at document-build time
 * (`src/server/theming/templates/grocery-food.ts`) and each template's copy
 * groups match exactly the section types its registry row declares — no
 * group is authored for a section a template's skeleton does not carry (see
 * `05-08-SUMMARY.md`'s allocation table for which four sections each of the
 * four shared skeletons declares).
 *
 * `grocery-market` is this segment's ONLY `minTier: "starter"` row — it is
 * the entire Starter experience a grocery/food merchant in this segment can
 * pick, so it is authored first and deliberately the strongest: the broad
 * neighborhood-provisions identity every other sub-niche below narrows away
 * from. A weak Starter row here is the segment-shaped dead end D-10 exists
 * to prevent.
 *
 * The eight sub-niches, so a reader can see why no two hero voices collide:
 *   - `grocery-market`   (starter)      — the neighborhood provisions store
 *   - `grocery-harvest`  (professional) — fresh produce / greengrocer
 *   - `grocery-pantry`   (business)     — bulk staples & dry goods by weight
 *   - `grocery-fresh`    (professional) — butchery: meat, fish, eggs
 *   - `grocery-orchard`  (business)     — fruit stall / fruit specialist
 *   - `grocery-grove`    (professional) — fresh-pressed juice
 *   - `grocery-cellar`   (business)     — bottled drinks & beverages
 *   - `grocery-larder`   (professional) — bakery & same-day prepared food
 *
 * None promises a delivery speed or a live payment gateway the platform
 * cannot support (T-05-57) — every payment mention stays manual Mobile
 * Money / Orange Money transfer, WhatsApp order, or cash on delivery, and
 * every freshness claim is about stock turnover, never a delivery-time
 * guarantee.
 */

import type { TemplateKey } from "@/server/theming/registry";
import type { FlagshipCopy } from "../flagship";

export const groceryFoodTemplates: Partial<Record<TemplateKey, Partial<FlagshipCopy>>> = {
  /**
   * STARTER. The whole Starter experience for this segment — see the file
   * header. The neighborhood provisions store: broad daily-essentials
   * identity, not a narrow sub-niche, because it is the only Starter row a
   * grocery/food merchant can choose.
   */
  "grocery-market": {
    name: "Market",
    segmentTag: "Grocery & food",
    announcement: "Order online. Pay by Mobile Money, Orange Money, or on delivery.",
    hero: {
      eyebrow: "Your neighborhood store, online",
      heading: "Everything for the kitchen, in one place",
      body: "Rice, oil, drinks, fresh produce, and the everyday staples your household runs on — order from home and skip the line.",
      ctaLabel: "Shop the store",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivery across Douala",
        body: "Tell us your neighborhood and we'll arrange delivery, or come collect your order yourself.",
      },
      itemTwo: {
        heading: "Ask before you order",
        body: "Message us on WhatsApp to check what's in stock or ask about a price.",
      },
      itemThree: {
        heading: "Pay your way",
        body: "Mobile Money, Orange Money, or cash when your order arrives.",
      },
    },
    productGrid: {
      heading: "What's in stock today",
      viewAllLabel: "See everything",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "About this store",
      heading: "Run by people who know your street",
      body: "This is a real shop with real stock, not a warehouse you'll never see. We restock often and we know what our neighbors actually buy.",
      ctaLabel: "See what's fresh",
      ctaHref: "/",
    },
    footerTagline: "Thanks for shopping with your neighborhood store.",
  },

  /**
   * PROFESSIONAL. Shares `grocery-market`'s skeleton (hero, product-grid,
   * trust-bar, editorial-split) but a distinct sub-niche and hero voice: the
   * fresh-produce greengrocer, not the general store.
   */
  "grocery-harvest": {
    name: "Harvest",
    segmentTag: "Grocery & food",
    announcement: "Fresh produce, ordered online. Pay by Mobile Money or on delivery.",
    hero: {
      eyebrow: "Fresh from the market, not the warehouse",
      heading: "Vegetables and fruit picked for today",
      body: "We buy in small batches so what you see is what's actually fresh right now, not what's been sitting since last week.",
      ctaLabel: "See today's produce",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivery in Douala",
        body: "Order your produce and we'll bring it to you, still fresh.",
      },
      itemTwo: {
        heading: "Ask what's ripe",
        body: "Message us on WhatsApp before you order if you want something specific.",
      },
      itemThree: {
        heading: "Freshness you can see",
        body: "We sort out anything bruised or overripe before it reaches your bag.",
      },
    },
    productGrid: {
      heading: "Today's fresh produce",
      viewAllLabel: "View all produce",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "Where it comes from",
      heading: "Sourced close, sold quickly",
      body: "We work with growers near Douala and turn stock over fast, because produce that sits around stops being fresh produce.",
      ctaLabel: "Shop fresh today",
      ctaHref: "/",
    },
    footerTagline: "Fresh today, gone by tomorrow — order while it lasts.",
  },

  /**
   * BUSINESS. Bulk staples and dry goods: rice, oil, flour, pasta, sold by
   * weight. Skeleton is hero, editorial-split, trust-bar, product-grid — no
   * contact section.
   */
  "grocery-pantry": {
    name: "Pantry",
    segmentTag: "Grocery & food",
    announcement: "Bulk staples, ordered online. Pay by Mobile Money or on delivery.",
    hero: {
      eyebrow: "Stock your kitchen for the month",
      heading: "Rice, oil, flour, and staples by the bag",
      body: "Buy in the quantities your household or your own shop actually needs, at a price that's clear before you order.",
      ctaLabel: "Shop staples",
      ctaHref: "/",
    },
    editorialSplit: {
      eyebrow: "Why buy in bulk here",
      heading: "Clear quantities, clear prices",
      body: "Every listing states the weight and the price together, so you know exactly what you're paying for before you commit to an order.",
      ctaLabel: "See our prices",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivery for bulk orders",
        body: "Large or small, we'll arrange delivery or you can collect it yourself.",
      },
      itemTwo: {
        heading: "Check a price first",
        body: "Message us on WhatsApp to confirm quantity and price before you order.",
      },
      itemThree: {
        heading: "Pay your way",
        body: "Mobile Money, Orange Money, or cash when your order arrives.",
      },
    },
    productGrid: {
      heading: "Staples in stock",
      viewAllLabel: "See all staples",
      viewAllHref: "/",
    },
    footerTagline: "Stock up once, cook all month.",
  },

  /**
   * PROFESSIONAL. Shares `grocery-pantry`'s skeleton but a distinct
   * sub-niche: the butchery — meat, fish, eggs — instead of dry goods.
   */
  "grocery-fresh": {
    name: "Fresh",
    segmentTag: "Grocery & food",
    announcement: "Fresh meat, fish, and eggs, ordered online. Pay by Mobile Money or on delivery.",
    hero: {
      eyebrow: "Cut and packed the day you order",
      heading: "Meat, fish, and eggs you can trust",
      body: "We cut and pack to order, not days in advance, so what arrives is what you'd choose yourself at the counter.",
      ctaLabel: "Shop fresh proteins",
      ctaHref: "/",
    },
    editorialSplit: {
      eyebrow: "How we handle it",
      heading: "Cold from the source to your door",
      body: "Everything is kept cold from delivery to pickup, and nothing sits out waiting for an order. Ask us about the cut you want.",
      ctaLabel: "See what's available",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Careful delivery in Douala",
        body: "We keep it cold on the way — tell us your neighborhood and we'll bring it to you.",
      },
      itemTwo: {
        heading: "Ask for a specific cut",
        body: "Message us on WhatsApp to request a cut, size, or quantity before you order.",
      },
      itemThree: {
        heading: "Quality you can count on",
        body: "We check every order before it leaves for freshness and quantity.",
      },
    },
    productGrid: {
      heading: "Today's fresh cuts",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    footerTagline: "Fresh cuts, ordered your way.",
  },

  /**
   * BUSINESS. Fruit stall / fruit specialist. Skeleton is hero, trust-bar,
   * product-grid, contact — no editorial-split.
   */
  "grocery-orchard": {
    name: "Orchard",
    segmentTag: "Grocery & food",
    announcement: "Fresh fruit, ordered online. Pay by Mobile Money or on delivery.",
    hero: {
      eyebrow: "Fruit at its best, not its last days",
      heading: "Fruit picked ripe, sold fast",
      body: "Mangoes, pineapple, oranges, and whatever's in season — sold within days of arriving, not weeks.",
      ctaLabel: "Shop today's fruit",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivery across Douala",
        body: "Order your fruit and we'll bring it to you the same way we'd carry it ourselves.",
      },
      itemTwo: {
        heading: "Ask what's in season",
        body: "Message us on WhatsApp to find out what's ripe right now.",
      },
      itemThree: {
        heading: "Ripe, not rotten",
        body: "We check every batch before it goes out, so what you get is what you'd pick yourself.",
      },
    },
    productGrid: {
      heading: "Fruit in season",
      viewAllLabel: "See all fruit",
      viewAllHref: "/",
    },
    contact: {
      heading: "Looking for a fruit we don't list?",
      body: "Message us on WhatsApp and we'll tell you what we can get and when.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Ripe today, sold today.",
  },

  /**
   * PROFESSIONAL. Shares `grocery-orchard`'s skeleton but a distinct
   * sub-niche: fresh-pressed juice, not whole fruit.
   */
  "grocery-grove": {
    name: "Grove",
    segmentTag: "Grocery & food",
    announcement: "Fresh juice, ordered online. Pay by Mobile Money or on delivery.",
    hero: {
      eyebrow: "Pressed the day you order, not before",
      heading: "Fresh juice, made from real fruit",
      body: "No syrups and no shortcuts — every bottle is pressed from fruit we bought fresh, and sold before it has a chance to sit.",
      ctaLabel: "Shop our juices",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Cold delivery in Douala",
        body: "We deliver it cold so it tastes the way it did when we pressed it.",
      },
      itemTwo: {
        heading: "Ask about a flavor",
        body: "Message us on WhatsApp if you want a mix we don't have listed yet.",
      },
      itemThree: {
        heading: "Real fruit, nothing added",
        body: "Every bottle is fruit and water only — no added sugar unless you ask for it.",
      },
    },
    productGrid: {
      heading: "Our fresh juices",
      viewAllLabel: "See all flavors",
      viewAllHref: "/",
    },
    contact: {
      heading: "Want a flavor made to order?",
      body: "Message us on WhatsApp and tell us what you're in the mood for.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Pressed fresh, delivered cold.",
  },

  /**
   * BUSINESS. Bottled drinks & beverages. Skeleton is hero, contact,
   * product-grid, editorial-split — no trust-bar.
   */
  "grocery-cellar": {
    name: "Cellar",
    segmentTag: "Grocery & food",
    announcement: "Drinks and beverages, ordered online. Pay by Mobile Money or on delivery.",
    hero: {
      eyebrow: "Cold drinks, ready for any occasion",
      heading: "Water, sodas, and drinks by the case",
      body: "Order water, soft drinks, and other beverages by the bottle or by the case — whatever the occasion calls for.",
      ctaLabel: "Shop drinks",
      ctaHref: "/",
    },
    contact: {
      heading: "Ordering for an event?",
      body: "Message us on WhatsApp for a bulk order and we'll work out the quantity and price together.",
      ctaLabel: "Message us on WhatsApp",
    },
    productGrid: {
      heading: "Drinks in stock",
      viewAllLabel: "See all drinks",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "Why order here",
      heading: "Stocked for everyday and for occasions",
      body: "From a single bottle of water to a case of drinks for a gathering, we keep enough in stock that you're not stuck without one.",
      ctaLabel: "See what's stocked",
      ctaHref: "/",
    },
    footerTagline: "Stocked up and ready to deliver.",
  },

  /**
   * PROFESSIONAL. Shares `grocery-cellar`'s skeleton but a distinct
   * sub-niche: bakery & same-day prepared food, not bottled drinks.
   */
  "grocery-larder": {
    name: "Larder",
    segmentTag: "Grocery & food",
    announcement: "Bread and prepared food, ordered online. Pay by Mobile Money or on delivery.",
    hero: {
      eyebrow: "Baked and cooked the day you order",
      heading: "Bread, pastries, and food ready to eat",
      body: "Fresh bread, pastries, and prepared dishes made the same day — order ahead and skip the wait.",
      ctaLabel: "Shop today's menu",
      ctaHref: "/",
    },
    contact: {
      heading: "Ordering for a group?",
      body: "Message us on WhatsApp to plan a larger order and we'll confirm what we can prepare.",
      ctaLabel: "Message us on WhatsApp",
    },
    productGrid: {
      heading: "Today's bakes and dishes",
      viewAllLabel: "See the full menu",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "How we work",
      heading: "Made fresh, not stockpiled",
      body: "We bake and cook in small batches through the day, so what you order is close to what just came out, not something reheated.",
      ctaLabel: "See what's ready",
      ctaHref: "/",
    },
    footerTagline: "Made fresh, ready when you are.",
  },
};
