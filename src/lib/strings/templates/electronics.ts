/**
 * Per-template copy for the `electronics` segment (TMPL-04, Phase 5).
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
 * Character caps every string here satisfies (`src/server/theming/
 * schema.ts`): hero/editorial `heading` 120, `body` 280, `ctaLabel` 30;
 * trust-bar `heading` 48, `body` 140; product-grid `heading` 80; contact
 * `heading` 80, `body` 280, `ctaLabel` 30.
 *
 * Voice contract (`src/lib/strings/index.ts` lines 1-33): direct, second
 * person, no exclamation marks, no "Oops", no emoji.
 *
 * 05-08's allocation table (`05-08-SUMMARY.md`) fixes this segment's nine
 * keys, tiers and skeletons. A key here gets only the copy groups its
 * registry row (`src/server/theming/registry.ts`) actually declares a
 * section for — no `trustBar` on `electronics-circuit`/`-signal`
 * (contact-card skeleton, no trust-bar row), no `editorialSplit` outside
 * `-pulse`/`-volt`, no group at all beyond `hero`/`productGrid` on
 * `electronics-byte` (the two-section shared skeleton).
 *
 * Douala electronics buyers weigh authenticity, warranty, delivery and
 * after-sale/repair support more than aspiration — the trust-bar and contact
 * copy below leans concrete (what happens if something goes wrong) rather
 * than lifestyle-aspirational, which is what makes this segment read
 * differently from fashion. The two `minTier: "starter"` keys
 * (`electronics-circuit`, `electronics-grid`) carry the strongest copy, not
 * the leftovers, since starter is the tier most merchants land on.
 */

import type { TemplateKey } from "@/server/theming/registry";
import type { FlagshipCopy } from "../flagship";

export const electronicsTemplates: Partial<Record<TemplateKey, Partial<FlagshipCopy>>> = {
  // S4 (hero:stack | product-grid:dense | contact:card) — shared by
  // electronics-circuit (starter) and electronics-signal (professional).
  "electronics-circuit": {
    name: "Circuit",
    segmentTag: "Electronics & appliances",
    announcement: "Genuine devices, real warranty, delivered across Douala.",
    hero: {
      eyebrow: "Authentic tech, straight from Akwa",
      heading: "Phones and gadgets you can trust",
      body: "Every device we sell is genuine, tested, and backed by our own warranty. Buy with confidence, not guesswork.",
      ctaLabel: "Browse devices",
      ctaHref: "/",
    },
    productGrid: {
      heading: "In stock now",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    contact: {
      heading: "Need help choosing?",
      body: "Message us on WhatsApp and we'll help you find the right device or accessory.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Thanks for trusting us with your tech.",
  },

  "electronics-signal": {
    name: "Signal",
    segmentTag: "Electronics & appliances",
    announcement: "Authenticated devices. Warranty included on every sale.",
    hero: {
      eyebrow: "Premium electronics, expertly sourced",
      heading: "Upgrade with devices built to last",
      body: "From flagship phones to reliable laptops, every listing here is authenticated and warrantied. We stand behind what we sell.",
      ctaLabel: "Shop the range",
      ctaHref: "/",
    },
    productGrid: {
      heading: "Featured devices",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    contact: {
      heading: "Questions before you buy?",
      body: "Reach us on WhatsApp for specs, pricing, or delivery details before you order.",
      ctaLabel: "Message us on WhatsApp",
    },
    footerTagline: "Built on trust, backed by warranty.",
  },

  // S5 (hero:split | trust-bar:strip | product-grid:showcase) — shared by
  // electronics-grid (starter) and electronics-current (professional).
  "electronics-grid": {
    name: "Grid",
    segmentTag: "Electronics & appliances",
    announcement: "Warranty included. Delivery across Douala.",
    hero: {
      eyebrow: "Your neighbourhood electronics shop",
      heading: "Everything you need, nothing you don't",
      body: "Phones, accessories, and home electronics at fair prices, with real people ready to help after the sale.",
      ctaLabel: "See what's in stock",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Delivery across Douala",
        body: "Order today, we'll get it to your door.",
      },
      itemTwo: {
        heading: "Warranty on every device",
        body: "Every sale comes with our own warranty, no fine print.",
      },
      itemThree: {
        heading: "Real support after you buy",
        body: "Message us on WhatsApp anytime you need help.",
      },
    },
    productGrid: {
      heading: "Popular right now",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    footerTagline: "Your neighbourhood electronics shop.",
  },

  "electronics-current": {
    name: "Current",
    segmentTag: "Electronics & appliances",
    announcement: "Verified devices. Warranty and repair support included.",
    hero: {
      eyebrow: "Electronics, sourced and verified",
      heading: "Devices worth switching to",
      body: "We test every device before it reaches you and stand behind it with a real warranty and fast support.",
      ctaLabel: "Explore the shop",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Fast delivery in Douala",
        body: "Most orders reach you within the day.",
      },
      itemTwo: {
        heading: "Verified and warrantied",
        body: "Every device is checked before it ships, warranty included.",
      },
      itemThree: {
        heading: "Quick turnaround on repairs",
        body: "Bring in a device for repair and we'll keep you posted on timing.",
      },
    },
    productGrid: {
      heading: "What's new",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    footerTagline: "Devices worth switching to.",
  },

  // S6 (hero:full-bleed | editorial-split:banner | product-grid:dense) —
  // shared by electronics-pulse (business) and electronics-volt (professional).
  "electronics-pulse": {
    name: "Pulse",
    segmentTag: "Electronics & appliances",
    announcement: "Authentic devices, warrantied and repair-ready.",
    hero: {
      eyebrow: "Tech that keeps up with you",
      heading: "The devices Douala runs on",
      body: "Phones, laptops, and home electronics chosen for reliability, not just looks. Buy once, buy right.",
      ctaLabel: "Shop devices",
      ctaHref: "/",
    },
    editorialSplit: {
      eyebrow: "Why buy from us",
      heading: "We sell what we'd use ourselves",
      body: "We test every device before it's listed, offer real repair support, and stand behind every sale with our own warranty.",
      ctaLabel: "See what's in stock",
      ctaHref: "/",
    },
    productGrid: {
      heading: "In stock",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    footerTagline: "The devices Douala runs on.",
  },

  "electronics-volt": {
    name: "Volt",
    segmentTag: "Electronics & appliances",
    announcement: "Genuine devices. In-house repair support.",
    hero: {
      eyebrow: "Power your day with the right device",
      heading: "Electronics built for how you actually work",
      body: "From office laptops to home appliances, we source devices that hold up, and we back every one with a warranty.",
      ctaLabel: "Browse the shop",
      ctaHref: "/",
    },
    editorialSplit: {
      eyebrow: "Our promise",
      heading: "Authenticity first, always",
      body: "Every device sold here is genuine and tested. If something's wrong, our repair team sorts it, not a stranger.",
      ctaLabel: "Learn how we work",
      ctaHref: "/",
    },
    productGrid: {
      heading: "Available now",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    footerTagline: "Built for how you actually work.",
  },

  // S7 (hero:stack | trust-bar:band | product-grid:grid) — shared by
  // electronics-module (business) and electronics-frame (business).
  "electronics-module": {
    name: "Module",
    segmentTag: "Electronics & appliances",
    announcement: "Checked before it's listed. Delivered across Douala.",
    hero: {
      eyebrow: "Reliable tech, honestly priced",
      heading: "Devices that do their job, and keep doing it",
      body: "We carry phones, computers, and home electronics we've checked ourselves, so you don't have to guess.",
      ctaLabel: "Shop the catalogue",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Authenticity checked",
        body: "Every device is inspected before it's listed for sale.",
      },
      itemTwo: {
        heading: "Delivered across Douala",
        body: "We bring your order to you, on schedule.",
      },
      itemThree: {
        heading: "Support that answers",
        body: "Message us on WhatsApp with any question, before or after you buy.",
      },
    },
    productGrid: {
      heading: "Our catalogue",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    footerTagline: "Reliable tech, honestly priced.",
  },

  "electronics-frame": {
    name: "Frame",
    segmentTag: "Electronics & appliances",
    announcement: "Tested devices. Warranty included, no excuses.",
    hero: {
      eyebrow: "The basics done right",
      heading: "Phones, computers and appliances you can rely on",
      body: "No inflated claims, just devices we've tested and would recommend to family. Warranty included on every sale.",
      ctaLabel: "Start browsing",
      ctaHref: "/",
    },
    trustBar: {
      itemOne: {
        heading: "Same-day dispatch",
        body: "Most orders leave our shop the same day you place them.",
      },
      itemTwo: {
        heading: "Warranty, not excuses",
        body: "If a device fails under warranty, we fix or replace it.",
      },
      itemThree: {
        heading: "Talk to a real person",
        body: "WhatsApp us before you buy if you're not sure what you need.",
      },
    },
    productGrid: {
      heading: "What we carry",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    footerTagline: "The basics done right.",
  },

  // S24 (hero:full-bleed | product-grid:grid) — shared with `retail-district`
  // (general-retail, plan 05-17), not with any other electronics key. Only
  // two sections exist on this row, so this is the only electronics entry
  // with no trust-bar, editorial-split, or contact group.
  "electronics-byte": {
    name: "Byte",
    segmentTag: "Electronics & appliances",
    announcement: "Genuine devices. Delivery you can count on.",
    hero: {
      eyebrow: "Minimal shop, maximum trust",
      heading: "Just the devices, and the details that matter",
      body: "A straightforward electronics shop: genuine devices, clear pricing, and delivery you can count on.",
      ctaLabel: "Shop now",
      ctaHref: "/",
    },
    productGrid: {
      heading: "The full range",
      viewAllLabel: "View all",
      viewAllHref: "/",
    },
    footerTagline: "Just the devices, and the details that matter.",
  },
};
