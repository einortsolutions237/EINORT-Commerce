/**
 * Per-template copy for the `general-retail` segment (TMPL-04, Phase 5).
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
 * PLAN 05-17 — THE NINE IMPLIED SHOPS (TMPL-05's distinctiveness gate).
 * ---------------------------------------------------------------------------
 * "General retail" is a registry category, not a voice. Each of the nine
 * templates below is written for one specific implied shop, not for the
 * category label, so a merchant reading the picker can tell which one is
 * nearest their own business:
 *
 *   - `retail-corner`      — a mixed neighbourhood convenience store
 *                            (the segment's one Starter row; written first
 *                            and strongest, since it is the only template a
 *                            Starter merchant in this segment can pick)
 *   - `retail-emporium`    — a bulk-and-wholesale trader
 *   - `retail-bazaar`      — a gift and party supplier
 *   - `retail-mercantile`  — a hardware and tools shop
 *   - `retail-general`     — a sports and outdoor seller
 *   - `retail-provisions`  — a stationery and school-supplies seller
 *   - `retail-market`      — a books-and-media shop
 *   - `retail-trading`     — a pet supplies seller
 *   - `retail-district`    — a seasonal-and-occasions shop
 *
 * No payment or delivery capability the platform lacks is promised anywhere
 * below: payment is manual Mobile Money / Orange Money transfer, a WhatsApp
 * order, or cash on delivery — never a live gateway, never a guaranteed
 * delivery window.
 */

import type { TemplateKey } from "@/server/theming/registry";
import type { FlagshipCopy } from "../flagship";

export const generalRetailTemplates: Partial<Record<TemplateKey, Partial<FlagshipCopy>>> = {
  /**
   * The segment's one Starter row (S20: hero:full-bleed | product-grid:dense
   * | trust-bar:strip | editorial-split:banner | contact:band). Written for a
   * mixed neighbourhood convenience store — the broadest, most welcoming
   * implied shop in the segment, matching its role as the only template a
   * Starter merchant here can pick.
   */
  "retail-corner": {
    name: "The Corner Shop",
    segmentTag: "General store",
    announcement: "Order on WhatsApp or come by the shop. Pay by Mobile Money or cash.",
    hero: {
      eyebrow: "Your neighbourhood shop",
      heading: "Everything the block needs, all in one place",
      body: "From household basics to everyday snacks, we keep the shelves stocked with what this neighbourhood actually buys.",
      ctaLabel: "See what's in stock",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Open every day",
        body: "Drop by whenever you need something — we're close and we're open.",
      },
      itemTwo: {
        heading: "Order on WhatsApp",
        body: "Send us your list and we'll have it ready for you.",
      },
      itemThree: {
        heading: "Delivery nearby",
        body: "We can drop your order off if you're close by.",
      },
    },
    productGrid: {
      heading: "What's on the shelves",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "About us",
      heading: "Your shop around the corner",
      body: "We've been serving this neighbourhood for years, stocking the everyday things people actually need. Stop by and see what's new.",
      ctaLabel: "Browse the shop",
      ctaHref: "/",
    },
    contact: {
      heading: "Need something specific?",
      body: "Message us on WhatsApp and we'll let you know if we have it.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Thanks for shopping local.",
  },

  /**
   * S20's professional sibling of `retail-corner`, same skeleton. Written for
   * a bulk-and-wholesale trader instead, so the two S20 rows read as two
   * different shops rather than two copies of the same one.
   */
  "retail-emporium": {
    name: "Wholesale Emporium",
    segmentTag: "Wholesale & bulk goods",
    announcement: "Buy in bulk and save. Pay by Mobile Money, Orange Money or on delivery.",
    hero: {
      eyebrow: "Buy more, pay less",
      heading: "Bulk goods at trade prices",
      body: "We supply shops, households and event organisers with bulk quantities of the goods they use most, at prices that make sense in volume.",
      ctaLabel: "See bulk prices",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Bulk delivery",
        body: "Order in quantity and we'll arrange delivery for you.",
      },
      itemTwo: {
        heading: "Talk to a trader",
        body: "Message us on WhatsApp to discuss quantities and pricing.",
      },
      itemThree: {
        heading: "Trusted stock",
        body: "We check every batch before it reaches you.",
      },
    },
    productGrid: {
      heading: "Our bulk catalogue",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "Who we serve",
      heading: "Supplying shops and households alike",
      body: "Whether you're restocking a small shop or buying for a big event, we sell in the quantities that make sense for you.",
      ctaLabel: "See what we stock",
      ctaHref: "/",
    },
    contact: {
      heading: "Ask about a bulk order",
      body: "Send us a message on WhatsApp with what you need and how much.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Trade prices, every time.",
  },

  /**
   * S21 (hero:split | product-grid:showcase | editorial-split:split |
   * trust-bar:strip | contact:card). Written for a gift and party supplier.
   */
  "retail-bazaar": {
    name: "The Gift Bazaar",
    segmentTag: "Gifts & party supplies",
    announcement: "Order ahead for your next celebration. Pay by Mobile Money or cash on delivery.",
    hero: {
      eyebrow: "Celebrate in style",
      heading: "Gifts and party supplies for every occasion",
      body: "Birthdays, weddings, graduations — we stock the decorations, gifts and party pieces that make an occasion feel special.",
      ctaLabel: "Shop for your event",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Order ahead",
        body: "Message us early and we'll set your order aside for pickup.",
      },
      itemTwo: {
        heading: "Ask us anything",
        body: "Not sure what you need? We're happy to help you choose on WhatsApp.",
      },
      itemThree: {
        heading: "Delivery available",
        body: "We can bring your order to you, depending on where you are.",
      },
    },
    productGrid: {
      heading: "Gifts and party pieces",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "Planning something?",
      heading: "We help you plan the occasion",
      body: "Tell us the date and the mood you're going for, and we'll help you put together the gifts and décor to match.",
      ctaLabel: "Message us on WhatsApp",
      ctaHref: "/",
    },
    contact: {
      heading: "Ready to order?",
      body: "Message us on WhatsApp with your date and what you're celebrating.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Making every occasion a little more special.",
  },

  /**
   * S21's professional sibling of `retail-bazaar`, same skeleton. Written for
   * a hardware and tools shop instead.
   */
  "retail-mercantile": {
    name: "The Mercantile",
    segmentTag: "Hardware & tools",
    announcement: "Order by WhatsApp or visit the shop. Pay by Mobile Money or cash on delivery.",
    hero: {
      eyebrow: "Built to last",
      heading: "Hardware and tools for the job at hand",
      body: "From hand tools to building supplies, we stock what tradespeople and homeowners reach for to get a job done properly.",
      ctaLabel: "See our tools",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Quality checked",
        body: "We stock hardware that holds up to real work.",
      },
      itemTwo: {
        heading: "Ask before you buy",
        body: "Not sure which part you need? Send us a photo on WhatsApp.",
      },
      itemThree: {
        heading: "Site delivery",
        body: "Order in quantity and we can deliver to your site.",
      },
    },
    productGrid: {
      heading: "Tools and hardware",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "Who we work with",
      heading: "Trusted by tradespeople and homeowners",
      body: "Whether you're fixing something small or supplying a whole site, we carry the hardware to match the job.",
      ctaLabel: "See what's in stock",
      ctaHref: "/",
    },
    contact: {
      heading: "Need a specific part?",
      body: "Message us on WhatsApp and we'll check if we have it in stock.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "The right tool, every time.",
  },

  /**
   * S22 (hero:stack | trust-bar:strip | product-grid:grid |
   * editorial-split:banner | contact:band). Written for a sports and
   * outdoor seller.
   */
  "retail-general": {
    name: "Outdoor & Sport",
    segmentTag: "Sports & outdoor",
    announcement: "Gear up for your next game. Pay by Mobile Money or on delivery.",
    hero: {
      eyebrow: "Get moving",
      heading: "Gear for sport and the outdoors",
      body: "Football boots, running shoes, camping gear and everything in between — equipment for the way you actually play.",
      ctaLabel: "Shop the gear",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Built for the game",
        body: "We stock gear that holds up to real training and real matches.",
      },
      itemTwo: {
        heading: "Size help",
        body: "Not sure of your size? Message us on WhatsApp before you order.",
      },
      itemThree: {
        heading: "Delivery available",
        body: "Get your gear delivered, or pick it up from the shop.",
      },
    },
    productGrid: {
      heading: "Sport and outdoor gear",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "About us",
      heading: "Equipping local athletes",
      body: "We work with teams and everyday players alike, stocking the gear that keeps you on the field or the trail.",
      ctaLabel: "See what's in stock",
      ctaHref: "/",
    },
    contact: {
      heading: "Looking for something specific?",
      body: "Message us on WhatsApp and we'll let you know if it's in stock.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Gear up and get out there.",
  },

  /**
   * S22's professional sibling of `retail-general`, same skeleton. Written
   * for a stationery and school-supplies seller instead.
   */
  "retail-provisions": {
    name: "School & Office Provisions",
    segmentTag: "Stationery & school supplies",
    announcement: "Order your school list on WhatsApp. Pay by Mobile Money or cash on delivery.",
    hero: {
      eyebrow: "Ready for class",
      heading: "Stationery and school supplies, sorted",
      body: "Exercise books, pens, backpacks and everything on the school list — we help parents get ready for the term without the running around.",
      ctaLabel: "Shop the school list",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Ready before term starts",
        body: "Order early and avoid the back-to-school rush.",
      },
      itemTwo: {
        heading: "Send us the list",
        body: "Message us your child's school list on WhatsApp and we'll put it together.",
      },
      itemThree: {
        heading: "Delivery available",
        body: "We can deliver your order or have it ready for pickup.",
      },
    },
    productGrid: {
      heading: "Stationery and supplies",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    editorialSplit: {
      eyebrow: "For parents and offices",
      heading: "From the school list to the office desk",
      body: "We stock what students need for class and what offices need for the desk, all in one shop.",
      ctaLabel: "See what's in stock",
      ctaHref: "/",
    },
    contact: {
      heading: "Have a supply list?",
      body: "Send it to us on WhatsApp and we'll tell you what we have.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Ready for the term ahead.",
  },

  /**
   * S23 (hero:full-bleed | editorial-split:split | product-grid:dense |
   * trust-bar:band | contact:card). Written for a books-and-media shop.
   */
  "retail-market": {
    name: "The Reading Room",
    segmentTag: "Books & media",
    announcement: "Order your next read on WhatsApp. Pay by Mobile Money or cash on delivery.",
    hero: {
      eyebrow: "For the love of reading",
      heading: "Books and media for every reader",
      body: "Novels, textbooks, magazines and more — we stock titles for students, professionals and anyone who just wants a good read.",
      ctaLabel: "Browse our titles",
      ctaHref: "/",
    },
    editorialSplit: {
      eyebrow: "About the shop",
      heading: "A shop for readers of every kind",
      body: "From exam textbooks to weekend novels, we choose titles that this neighbourhood actually wants to read.",
      ctaLabel: "See what's on the shelf",
      ctaHref: "/",
    },
    productGrid: {
      heading: "Books and media",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Ask for a title",
        body: "Can't find it here? Message us on WhatsApp and we'll try to source it.",
      },
      itemTwo: {
        heading: "New titles regularly",
        body: "We restock often, so there's usually something new on the shelf.",
      },
      itemThree: {
        heading: "Delivery available",
        body: "We can deliver your order or hold it for pickup.",
      },
    },
    contact: {
      heading: "Looking for a specific title?",
      body: "Message us on WhatsApp and we'll check if we have it or can get it.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "A good read, close to home.",
  },

  /**
   * S23's professional sibling of `retail-market`, same skeleton. Written
   * for a pet supplies seller instead.
   */
  "retail-trading": {
    name: "Pet Trading Post",
    segmentTag: "Pet supplies",
    announcement: "Order pet food and supplies on WhatsApp. Pay by Mobile Money or on delivery.",
    hero: {
      eyebrow: "For your best friend",
      heading: "Food and supplies for every pet",
      body: "From dog food to fish tank supplies, we stock what local pet owners rely on to keep their animals happy and healthy.",
      ctaLabel: "Shop pet supplies",
      ctaHref: "/",
    },
    editorialSplit: {
      eyebrow: "Who we serve",
      heading: "Trusted by pet owners nearby",
      body: "Whether you keep a dog, cat, or something more unusual, we stock the food and supplies that keep them well cared for.",
      ctaLabel: "See what's in stock",
      ctaHref: "/",
    },
    productGrid: {
      heading: "Pet food and supplies",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Quality feed",
        body: "We stock pet food we'd trust for our own animals.",
      },
      itemTwo: {
        heading: "Ask us anything",
        body: "Not sure what your pet needs? Message us on WhatsApp.",
      },
      itemThree: {
        heading: "Delivery available",
        body: "Heavy bags of feed? We can deliver them to you.",
      },
    },
    contact: {
      heading: "Need help choosing?",
      body: "Message us on WhatsApp and tell us about your pet.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Happy pets, happy homes.",
  },

  /**
   * S24 (hero:full-bleed | product-grid:grid) — the minimal skeleton shared
   * with `electronics-byte` outside this segment. Only these two copy groups
   * exist because this row declares only these two section types; no
   * trust-bar, editorial-split or contact groups are authored below. Written
   * for a seasonal-and-occasions shop.
   */
  "retail-district": {
    name: "Seasons & Occasions",
    segmentTag: "Seasonal & occasion goods",
    announcement: "Stock up for the season. Pay by Mobile Money or on delivery.",
    hero: {
      eyebrow: "Right on time",
      heading: "Seasonal goods for every occasion",
      body: "Holiday decorations, festive foods, back-to-school bundles — we bring in what the calendar calls for, right when you need it.",
      ctaLabel: "Shop this season",
      ctaHref: "/",
    },
    productGrid: {
      heading: "This season's picks",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    footerTagline: "For whatever the season brings.",
  },
};
