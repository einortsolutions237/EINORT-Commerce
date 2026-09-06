import "server-only";

/**
 * Per-segment document/token builder module for the `general-retail`
 * industry segment (TMPL-03, TMPL-04) — 9 named builder pairs (18
 * functions), one document/tokens pair per this segment's non-flagship rows
 * in `src/server/theming/registry.ts`. `flagship-fashion` itself keeps its
 * own document and token builder functions in
 * `src/server/theming/defaults.ts`, unchanged — it does not get a builder
 * here.
 *
 * CONTENT-COMPLETE (05-17). Every builder's `sections` array matches its
 * registry row's declared section types and order exactly, every settings
 * field is present, and every copy value now reads real content authored in
 * `src/lib/strings/templates/general-retail.ts` (05-17, Task 1) via
 * `strings.templates["<key>"]?.<path> ?? ""` — the `?? ""` fallback stays in
 * place structurally (it is the one access pattern every segment builder
 * uses) but no longer resolves to an empty string for any of this segment's
 * nine keys, since Task 1 authored every field this file reads.
 *
 * Three invariants inherited verbatim from the flagship's own document
 * builder (`src/server/theming/defaults.ts`):
 *
 *   1. `id === type` on every section. D-05 fixes membership at one instance
 *      per type, so the type IS a stable unique id for the life of the
 *      document — never a `randomUUID()`, which would break the fixture
 *      byte-identity `tests/setup/seed-two-tenants.ts` depends on.
 *   2. `backgroundImageKey: null` / `imageKey: null` on every hero /
 *      editorial-split. Mandatory, not a default: `storageKeySchema`'s
 *      tenant-prefixed regex makes a shared stock asset structurally
 *      unreferenceable, and there is no stock photograph to fall back to.
 *   3. A fresh object literal per call, built inside the function body —
 *      never hoisted to a module-scope constant, never frozen. A shared
 *      literal is one careless caller away from corrupting every subsequent
 *      tenant created in the same process.
 *
 * `itemCount` follows the registry row's product-grid VARIANT, not a flat
 * default: `grid` keeps `DEFAULT_ITEM_COUNT` (8), `dense` goes higher (12,
 * matching the visually denser layout), and `showcase` goes lower (4,
 * matching the fewer/larger cards that variant renders).
 *
 * Trust-bar `icon` values are chosen per template to fit its implied shop
 * (see `src/lib/strings/templates/general-retail.ts`'s header for the full
 * list of the nine implied shops) rather than repeating the same three icons
 * across every row — `truck` (delivery), `shield-check` (quality/trust),
 * `clock` (hours/timing) and `message-circle` (WhatsApp contact) are the
 * schema's full closed enum (`src/server/theming/schema.ts`).
 *
 * `primaryAccent` / `secondaryAccent` are nine distinct hex pairs, one per
 * template, satisfying `hexColorSchema`. No two of the four sibling pairs
 * (`retail-corner`/`retail-emporium`, `retail-bazaar`/`retail-mercantile`,
 * `retail-general`/`retail-provisions`, `retail-market`/`retail-trading`)
 * share a `primaryAccent`, and the nine hues are chosen from clearly
 * different points on the colour wheel — not just "distinct enough within a
 * pair" — because this segment is the one most at risk of reading as one
 * generic shop repeated nine times (05-RESEARCH.md § The Distinctiveness
 * Gate at N=50). `retail-district` (S24, the skeleton shared with
 * `electronics-byte` outside this segment) still gets its own accent pair,
 * distinct from the other eight.
 */

import {
  DEFAULT_ITEM_COUNT,
  DEFAULT_OVERLAY_OPACITY,
} from "@/server/theming/defaults";
import { strings } from "@/lib/strings";

import type { PageDocument, ThemeTokens } from "@/server/theming/schema";

/**
 * `product-grid` variant → item count. `DEFAULT_ITEM_COUNT` (8) is `grid`'s
 * own value, restated here as a named constant (not `8` inline) so the three
 * counts read as one deliberate table rather than a magic number next to two
 * others.
 */
const DENSE_ITEM_COUNT = 12;
const SHOWCASE_ITEM_COUNT = 4;

export function retailCornerDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["retail-corner"]?.hero?.eyebrow ?? "",
          heading: strings.templates["retail-corner"]?.hero?.heading ?? "",
          body: strings.templates["retail-corner"]?.hero?.body ?? "",
          ctaLabel: strings.templates["retail-corner"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-corner"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["retail-corner"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["retail-corner"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["retail-corner"]?.productGrid?.viewAllHref ?? "",
          /* `dense` (registry). */
          itemCount: DENSE_ITEM_COUNT,
        },
      },
      {
        id: "trust-bar",
        type: "trust-bar",
        settings: {
          blocks: [
            {
              type: "trust-item",
              icon: "clock",
              heading: strings.templates["retail-corner"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["retail-corner"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["retail-corner"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["retail-corner"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "truck",
              heading: strings.templates["retail-corner"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["retail-corner"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["retail-corner"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["retail-corner"]?.editorialSplit?.heading ?? "",
          body: strings.templates["retail-corner"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["retail-corner"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-corner"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["retail-corner"]?.contact?.heading ?? "",
          body: strings.templates["retail-corner"]?.contact?.body ?? "",
          ctaLabel: strings.templates["retail-corner"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function retailCornerTokens(): ThemeTokens {
  return {
    /* Earthy terracotta — a warm, welcoming neighbourhood shop. */
    primaryAccent: "#B45309",
    secondaryAccent: "#78350F",
    announcementText: strings.templates["retail-corner"]?.announcement ?? "",
    footerTagline: strings.templates["retail-corner"]?.footerTagline ?? "",
  };
}

export function retailEmporiumDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["retail-emporium"]?.hero?.eyebrow ?? "",
          heading: strings.templates["retail-emporium"]?.hero?.heading ?? "",
          body: strings.templates["retail-emporium"]?.hero?.body ?? "",
          ctaLabel: strings.templates["retail-emporium"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-emporium"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["retail-emporium"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["retail-emporium"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["retail-emporium"]?.productGrid?.viewAllHref ?? "",
          /* `dense` (registry). */
          itemCount: DENSE_ITEM_COUNT,
        },
      },
      {
        id: "trust-bar",
        type: "trust-bar",
        settings: {
          blocks: [
            {
              type: "trust-item",
              icon: "truck",
              heading: strings.templates["retail-emporium"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["retail-emporium"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["retail-emporium"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["retail-emporium"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["retail-emporium"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["retail-emporium"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["retail-emporium"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["retail-emporium"]?.editorialSplit?.heading ?? "",
          body: strings.templates["retail-emporium"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["retail-emporium"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-emporium"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["retail-emporium"]?.contact?.heading ?? "",
          body: strings.templates["retail-emporium"]?.contact?.body ?? "",
          ctaLabel: strings.templates["retail-emporium"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function retailEmporiumTokens(): ThemeTokens {
  return {
    /* Industrial indigo/blue — a wholesale trading outfit. */
    primaryAccent: "#1E3A8A",
    secondaryAccent: "#3B82F6",
    announcementText: strings.templates["retail-emporium"]?.announcement ?? "",
    footerTagline: strings.templates["retail-emporium"]?.footerTagline ?? "",
  };
}

export function retailBazaarDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["retail-bazaar"]?.hero?.eyebrow ?? "",
          heading: strings.templates["retail-bazaar"]?.hero?.heading ?? "",
          body: strings.templates["retail-bazaar"]?.hero?.body ?? "",
          ctaLabel: strings.templates["retail-bazaar"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-bazaar"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["retail-bazaar"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["retail-bazaar"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["retail-bazaar"]?.productGrid?.viewAllHref ?? "",
          /* `showcase` (registry). */
          itemCount: SHOWCASE_ITEM_COUNT,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["retail-bazaar"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["retail-bazaar"]?.editorialSplit?.heading ?? "",
          body: strings.templates["retail-bazaar"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["retail-bazaar"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-bazaar"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "trust-bar",
        type: "trust-bar",
        settings: {
          blocks: [
            {
              type: "trust-item",
              icon: "clock",
              heading: strings.templates["retail-bazaar"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["retail-bazaar"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["retail-bazaar"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["retail-bazaar"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "truck",
              heading: strings.templates["retail-bazaar"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["retail-bazaar"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["retail-bazaar"]?.contact?.heading ?? "",
          body: strings.templates["retail-bazaar"]?.contact?.body ?? "",
          ctaLabel: strings.templates["retail-bazaar"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function retailBazaarTokens(): ThemeTokens {
  return {
    /* Vibrant fuchsia — a gift and party supplier. */
    primaryAccent: "#A21CAF",
    secondaryAccent: "#F0ABFC",
    announcementText: strings.templates["retail-bazaar"]?.announcement ?? "",
    footerTagline: strings.templates["retail-bazaar"]?.footerTagline ?? "",
  };
}

export function retailMercantileDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["retail-mercantile"]?.hero?.eyebrow ?? "",
          heading: strings.templates["retail-mercantile"]?.hero?.heading ?? "",
          body: strings.templates["retail-mercantile"]?.hero?.body ?? "",
          ctaLabel: strings.templates["retail-mercantile"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-mercantile"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["retail-mercantile"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["retail-mercantile"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["retail-mercantile"]?.productGrid?.viewAllHref ?? "",
          /* `showcase` (registry). */
          itemCount: SHOWCASE_ITEM_COUNT,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["retail-mercantile"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["retail-mercantile"]?.editorialSplit?.heading ?? "",
          body: strings.templates["retail-mercantile"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["retail-mercantile"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-mercantile"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "trust-bar",
        type: "trust-bar",
        settings: {
          blocks: [
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["retail-mercantile"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["retail-mercantile"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["retail-mercantile"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["retail-mercantile"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "truck",
              heading: strings.templates["retail-mercantile"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["retail-mercantile"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["retail-mercantile"]?.contact?.heading ?? "",
          body: strings.templates["retail-mercantile"]?.contact?.body ?? "",
          ctaLabel: strings.templates["retail-mercantile"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function retailMercantileTokens(): ThemeTokens {
  return {
    /* Steel stone with an orange accent — a hardware and tools shop. */
    primaryAccent: "#44403C",
    secondaryAccent: "#EA580C",
    announcementText: strings.templates["retail-mercantile"]?.announcement ?? "",
    footerTagline: strings.templates["retail-mercantile"]?.footerTagline ?? "",
  };
}

export function retailGeneralDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["retail-general"]?.hero?.eyebrow ?? "",
          heading: strings.templates["retail-general"]?.hero?.heading ?? "",
          body: strings.templates["retail-general"]?.hero?.body ?? "",
          ctaLabel: strings.templates["retail-general"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-general"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "trust-bar",
        type: "trust-bar",
        settings: {
          blocks: [
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["retail-general"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["retail-general"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["retail-general"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["retail-general"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "truck",
              heading: strings.templates["retail-general"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["retail-general"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["retail-general"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["retail-general"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["retail-general"]?.productGrid?.viewAllHref ?? "",
          /* `grid` (registry) — DEFAULT_ITEM_COUNT. */
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["retail-general"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["retail-general"]?.editorialSplit?.heading ?? "",
          body: strings.templates["retail-general"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["retail-general"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-general"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["retail-general"]?.contact?.heading ?? "",
          body: strings.templates["retail-general"]?.contact?.body ?? "",
          ctaLabel: strings.templates["retail-general"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function retailGeneralTokens(): ThemeTokens {
  return {
    /* Forest green with lime — a sports and outdoor seller. */
    primaryAccent: "#166534",
    secondaryAccent: "#84CC16",
    announcementText: strings.templates["retail-general"]?.announcement ?? "",
    footerTagline: strings.templates["retail-general"]?.footerTagline ?? "",
  };
}

export function retailProvisionsDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["retail-provisions"]?.hero?.eyebrow ?? "",
          heading: strings.templates["retail-provisions"]?.hero?.heading ?? "",
          body: strings.templates["retail-provisions"]?.hero?.body ?? "",
          ctaLabel: strings.templates["retail-provisions"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-provisions"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "trust-bar",
        type: "trust-bar",
        settings: {
          blocks: [
            {
              type: "trust-item",
              icon: "clock",
              heading: strings.templates["retail-provisions"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["retail-provisions"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["retail-provisions"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["retail-provisions"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "truck",
              heading: strings.templates["retail-provisions"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["retail-provisions"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["retail-provisions"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["retail-provisions"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["retail-provisions"]?.productGrid?.viewAllHref ?? "",
          /* `grid` (registry) — DEFAULT_ITEM_COUNT. */
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["retail-provisions"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["retail-provisions"]?.editorialSplit?.heading ?? "",
          body: strings.templates["retail-provisions"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["retail-provisions"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-provisions"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["retail-provisions"]?.contact?.heading ?? "",
          body: strings.templates["retail-provisions"]?.contact?.body ?? "",
          ctaLabel: strings.templates["retail-provisions"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function retailProvisionsTokens(): ThemeTokens {
  return {
    /* Navy with red — a stationery and school-supplies seller. */
    primaryAccent: "#1E293B",
    secondaryAccent: "#DC2626",
    announcementText: strings.templates["retail-provisions"]?.announcement ?? "",
    footerTagline: strings.templates["retail-provisions"]?.footerTagline ?? "",
  };
}

export function retailMarketDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["retail-market"]?.hero?.eyebrow ?? "",
          heading: strings.templates["retail-market"]?.hero?.heading ?? "",
          body: strings.templates["retail-market"]?.hero?.body ?? "",
          ctaLabel: strings.templates["retail-market"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-market"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["retail-market"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["retail-market"]?.editorialSplit?.heading ?? "",
          body: strings.templates["retail-market"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["retail-market"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-market"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["retail-market"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["retail-market"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["retail-market"]?.productGrid?.viewAllHref ?? "",
          /* `dense` (registry). */
          itemCount: DENSE_ITEM_COUNT,
        },
      },
      {
        id: "trust-bar",
        type: "trust-bar",
        settings: {
          blocks: [
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["retail-market"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["retail-market"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "clock",
              heading: strings.templates["retail-market"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["retail-market"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "truck",
              heading: strings.templates["retail-market"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["retail-market"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["retail-market"]?.contact?.heading ?? "",
          body: strings.templates["retail-market"]?.contact?.body ?? "",
          ctaLabel: strings.templates["retail-market"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function retailMarketTokens(): ThemeTokens {
  return {
    /* Deep maroon with amber — a books-and-media shop. */
    primaryAccent: "#7F1D1D",
    secondaryAccent: "#D97706",
    announcementText: strings.templates["retail-market"]?.announcement ?? "",
    footerTagline: strings.templates["retail-market"]?.footerTagline ?? "",
  };
}

export function retailTradingDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["retail-trading"]?.hero?.eyebrow ?? "",
          heading: strings.templates["retail-trading"]?.hero?.heading ?? "",
          body: strings.templates["retail-trading"]?.hero?.body ?? "",
          ctaLabel: strings.templates["retail-trading"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-trading"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["retail-trading"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["retail-trading"]?.editorialSplit?.heading ?? "",
          body: strings.templates["retail-trading"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["retail-trading"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-trading"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["retail-trading"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["retail-trading"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["retail-trading"]?.productGrid?.viewAllHref ?? "",
          /* `dense` (registry). */
          itemCount: DENSE_ITEM_COUNT,
        },
      },
      {
        id: "trust-bar",
        type: "trust-bar",
        settings: {
          blocks: [
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["retail-trading"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["retail-trading"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["retail-trading"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["retail-trading"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "truck",
              heading: strings.templates["retail-trading"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["retail-trading"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["retail-trading"]?.contact?.heading ?? "",
          body: strings.templates["retail-trading"]?.contact?.body ?? "",
          ctaLabel: strings.templates["retail-trading"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function retailTradingTokens(): ThemeTokens {
  return {
    /* Teal with amber — a pet supplies seller. */
    primaryAccent: "#0F766E",
    secondaryAccent: "#FBBF24",
    announcementText: strings.templates["retail-trading"]?.announcement ?? "",
    footerTagline: strings.templates["retail-trading"]?.footerTagline ?? "",
  };
}

export function retailDistrictDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["retail-district"]?.hero?.eyebrow ?? "",
          heading: strings.templates["retail-district"]?.hero?.heading ?? "",
          body: strings.templates["retail-district"]?.hero?.body ?? "",
          ctaLabel: strings.templates["retail-district"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["retail-district"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["retail-district"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["retail-district"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["retail-district"]?.productGrid?.viewAllHref ?? "",
          /* `grid` (registry) — DEFAULT_ITEM_COUNT. */
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

export function retailDistrictTokens(): ThemeTokens {
  return {
    /* Violet with amber — a seasonal-and-occasions shop. */
    primaryAccent: "#6D28D9",
    secondaryAccent: "#FCD34D",
    announcementText: strings.templates["retail-district"]?.announcement ?? "",
    footerTagline: strings.templates["retail-district"]?.footerTagline ?? "",
  };
}
