import "server-only";

/**
 * Per-segment document/token builder module for the `grocery-food`
 * industry segment (TMPL-03, TMPL-04) — 8 named builder pairs (16
 * functions), one document/tokens pair per this segment's non-flagship rows
 * in `src/server/theming/registry.ts`. `flagship-fashion` itself keeps its
 * own document and token builder functions in
 * `src/server/theming/defaults.ts`, unchanged — it does not get a builder
 * here.
 *
 * CONTENT-COMPLETE (plan 05-15, Wave 3). Every builder's `sections` array
 * matches its registry row's declared section types and order exactly, and
 * every settings field is present. Every copy value reads
 * `strings.templates["<key>"]?.<path> ?? ""` — the ONE access pattern every
 * segment module uses, with optional chaining down to the leaf field and a
 * `?? ""` fallback that is now unreachable dead code for a fully-authored
 * key (Task 1 of this same plan populates every leaf `strings.templates
 * ["grocery-*"]` reads), kept only so a future edit that drops a field from
 * `src/lib/strings/templates/grocery-food.ts` degrades to an empty string
 * rather than a crash. Plan 05-20's generalized default-document parse test
 * is the gate that would catch that regression.
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
 * ACCENTS (TMPL-05's second distinctiveness axis). Each of the 4 shared
 * skeletons in this segment (full-bleed/dense/band/split;
 * stack/banner/strip/grid; split/band/dense/card; full-bleed/card/showcase/
 * banner) is used by exactly two templates, and the two never share a
 * `primaryAccent` — see the per-tokens-function comment for the palette
 * reasoning. Foregrounds and the focus ring are always derived
 * (`deriveThemeCssVars` / `accentForeground` in `src/lib/theme-defaults.ts`),
 * never stored here.
 *
 * ITEM COUNT. `grocery-market`, `grocery-harvest`, `grocery-orchard` and
 * `grocery-grove` use the `dense` product-grid variant and bump `itemCount`
 * to 12 (documented per-builder below): a grocery/food catalogue — dozens of
 * SKUs across produce, drinks, staples — reads as sparse at the fashion-tuned
 * default of 8. The `grid` and `showcase` variants (pantry/fresh,
 * cellar/larder) keep `DEFAULT_ITEM_COUNT`.
 */

import {
  DEFAULT_ITEM_COUNT,
  DEFAULT_OVERLAY_OPACITY,
} from "@/server/theming/defaults";
import { strings } from "@/lib/strings";

import type { PageDocument, ThemeTokens } from "@/server/theming/schema";

export function groceryMarketDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["grocery-market"]?.hero?.eyebrow ?? "",
          heading: strings.templates["grocery-market"]?.hero?.heading ?? "",
          body: strings.templates["grocery-market"]?.hero?.body ?? "",
          ctaLabel: strings.templates["grocery-market"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["grocery-market"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["grocery-market"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["grocery-market"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["grocery-market"]?.productGrid?.viewAllHref ?? "",
          // `dense` variant + a general-provisions catalogue: bumped above
          // DEFAULT_ITEM_COUNT (see file header, "ITEM COUNT").
          itemCount: 12,
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
              heading: strings.templates["grocery-market"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["grocery-market"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["grocery-market"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["grocery-market"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["grocery-market"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["grocery-market"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["grocery-market"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["grocery-market"]?.editorialSplit?.heading ?? "",
          body: strings.templates["grocery-market"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["grocery-market"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["grocery-market"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
    ],
  };
}

/**
 * `grocery-market` shares its skeleton with `grocery-harvest`; the two must
 * not share a `primaryAccent`. Terracotta/rust — a warm, general-provisions
 * identity distinct from `grocery-harvest`'s produce green.
 */
export function groceryMarketTokens(): ThemeTokens {
  return {
    primaryAccent: "#C2410C",
    secondaryAccent: "#FDE68A",
    announcementText: strings.templates["grocery-market"]?.announcement ?? "",
    footerTagline: strings.templates["grocery-market"]?.footerTagline ?? "",
  };
}

export function groceryHarvestDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["grocery-harvest"]?.hero?.eyebrow ?? "",
          heading: strings.templates["grocery-harvest"]?.hero?.heading ?? "",
          body: strings.templates["grocery-harvest"]?.hero?.body ?? "",
          ctaLabel: strings.templates["grocery-harvest"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["grocery-harvest"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["grocery-harvest"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["grocery-harvest"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["grocery-harvest"]?.productGrid?.viewAllHref ?? "",
          // `dense` variant + a wide produce catalogue: bumped above
          // DEFAULT_ITEM_COUNT (see file header, "ITEM COUNT").
          itemCount: 12,
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
              heading: strings.templates["grocery-harvest"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["grocery-harvest"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["grocery-harvest"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["grocery-harvest"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["grocery-harvest"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["grocery-harvest"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["grocery-harvest"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["grocery-harvest"]?.editorialSplit?.heading ?? "",
          body: strings.templates["grocery-harvest"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["grocery-harvest"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["grocery-harvest"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
    ],
  };
}

/**
 * `grocery-harvest` shares its skeleton with `grocery-market`; the two must
 * not share a `primaryAccent`. Produce green, distinct from `grocery-market`'s
 * terracotta.
 */
export function groceryHarvestTokens(): ThemeTokens {
  return {
    primaryAccent: "#15803D",
    secondaryAccent: "#BBF7D0",
    announcementText: strings.templates["grocery-harvest"]?.announcement ?? "",
    footerTagline: strings.templates["grocery-harvest"]?.footerTagline ?? "",
  };
}

export function groceryPantryDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["grocery-pantry"]?.hero?.eyebrow ?? "",
          heading: strings.templates["grocery-pantry"]?.hero?.heading ?? "",
          body: strings.templates["grocery-pantry"]?.hero?.body ?? "",
          ctaLabel: strings.templates["grocery-pantry"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["grocery-pantry"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["grocery-pantry"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["grocery-pantry"]?.editorialSplit?.heading ?? "",
          body: strings.templates["grocery-pantry"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["grocery-pantry"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["grocery-pantry"]?.editorialSplit?.ctaHref ?? "",
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
              icon: "truck",
              heading: strings.templates["grocery-pantry"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["grocery-pantry"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["grocery-pantry"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["grocery-pantry"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["grocery-pantry"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["grocery-pantry"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["grocery-pantry"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["grocery-pantry"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["grocery-pantry"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

/**
 * `grocery-pantry` shares its skeleton with `grocery-fresh`; the two must not
 * share a `primaryAccent`. Deep grain-sack brown, distinct from
 * `grocery-fresh`'s butchery red.
 */
export function groceryPantryTokens(): ThemeTokens {
  return {
    primaryAccent: "#78350F",
    secondaryAccent: "#FEF3C7",
    announcementText: strings.templates["grocery-pantry"]?.announcement ?? "",
    footerTagline: strings.templates["grocery-pantry"]?.footerTagline ?? "",
  };
}

export function groceryFreshDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["grocery-fresh"]?.hero?.eyebrow ?? "",
          heading: strings.templates["grocery-fresh"]?.hero?.heading ?? "",
          body: strings.templates["grocery-fresh"]?.hero?.body ?? "",
          ctaLabel: strings.templates["grocery-fresh"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["grocery-fresh"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["grocery-fresh"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["grocery-fresh"]?.editorialSplit?.heading ?? "",
          body: strings.templates["grocery-fresh"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["grocery-fresh"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["grocery-fresh"]?.editorialSplit?.ctaHref ?? "",
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
              icon: "truck",
              heading: strings.templates["grocery-fresh"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["grocery-fresh"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["grocery-fresh"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["grocery-fresh"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["grocery-fresh"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["grocery-fresh"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["grocery-fresh"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["grocery-fresh"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["grocery-fresh"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

/**
 * `grocery-fresh` shares its skeleton with `grocery-pantry`; the two must not
 * share a `primaryAccent`. Butchery red, distinct from `grocery-pantry`'s
 * grain-sack brown.
 */
export function groceryFreshTokens(): ThemeTokens {
  return {
    primaryAccent: "#991B1B",
    secondaryAccent: "#FECACA",
    announcementText: strings.templates["grocery-fresh"]?.announcement ?? "",
    footerTagline: strings.templates["grocery-fresh"]?.footerTagline ?? "",
  };
}

export function groceryOrchardDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["grocery-orchard"]?.hero?.eyebrow ?? "",
          heading: strings.templates["grocery-orchard"]?.hero?.heading ?? "",
          body: strings.templates["grocery-orchard"]?.hero?.body ?? "",
          ctaLabel: strings.templates["grocery-orchard"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["grocery-orchard"]?.hero?.ctaHref ?? "",
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
              icon: "truck",
              heading: strings.templates["grocery-orchard"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["grocery-orchard"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["grocery-orchard"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["grocery-orchard"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["grocery-orchard"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["grocery-orchard"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["grocery-orchard"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["grocery-orchard"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["grocery-orchard"]?.productGrid?.viewAllHref ?? "",
          // `dense` variant + a wide fruit catalogue: bumped above
          // DEFAULT_ITEM_COUNT (see file header, "ITEM COUNT").
          itemCount: 12,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["grocery-orchard"]?.contact?.heading ?? "",
          body: strings.templates["grocery-orchard"]?.contact?.body ?? "",
          ctaLabel: strings.templates["grocery-orchard"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

/**
 * `grocery-orchard` shares its skeleton with `grocery-grove`; the two must
 * not share a `primaryAccent`. Citrus orange (whole fruit), distinct from
 * `grocery-grove`'s pressed-juice lime.
 */
export function groceryOrchardTokens(): ThemeTokens {
  return {
    primaryAccent: "#EA580C",
    secondaryAccent: "#FED7AA",
    announcementText: strings.templates["grocery-orchard"]?.announcement ?? "",
    footerTagline: strings.templates["grocery-orchard"]?.footerTagline ?? "",
  };
}

export function groceryGroveDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["grocery-grove"]?.hero?.eyebrow ?? "",
          heading: strings.templates["grocery-grove"]?.hero?.heading ?? "",
          body: strings.templates["grocery-grove"]?.hero?.body ?? "",
          ctaLabel: strings.templates["grocery-grove"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["grocery-grove"]?.hero?.ctaHref ?? "",
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
              icon: "truck",
              heading: strings.templates["grocery-grove"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["grocery-grove"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["grocery-grove"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["grocery-grove"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["grocery-grove"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["grocery-grove"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["grocery-grove"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["grocery-grove"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["grocery-grove"]?.productGrid?.viewAllHref ?? "",
          // `dense` variant + a wide flavor catalogue: bumped above
          // DEFAULT_ITEM_COUNT (see file header, "ITEM COUNT").
          itemCount: 12,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["grocery-grove"]?.contact?.heading ?? "",
          body: strings.templates["grocery-grove"]?.contact?.body ?? "",
          ctaLabel: strings.templates["grocery-grove"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

/**
 * `grocery-grove` shares its skeleton with `grocery-orchard`; the two must
 * not share a `primaryAccent`. Pressed-juice lime, distinct from
 * `grocery-orchard`'s whole-fruit citrus orange.
 */
export function groceryGroveTokens(): ThemeTokens {
  return {
    primaryAccent: "#65A30D",
    secondaryAccent: "#D9F99D",
    announcementText: strings.templates["grocery-grove"]?.announcement ?? "",
    footerTagline: strings.templates["grocery-grove"]?.footerTagline ?? "",
  };
}

export function groceryCellarDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["grocery-cellar"]?.hero?.eyebrow ?? "",
          heading: strings.templates["grocery-cellar"]?.hero?.heading ?? "",
          body: strings.templates["grocery-cellar"]?.hero?.body ?? "",
          ctaLabel: strings.templates["grocery-cellar"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["grocery-cellar"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["grocery-cellar"]?.contact?.heading ?? "",
          body: strings.templates["grocery-cellar"]?.contact?.body ?? "",
          ctaLabel: strings.templates["grocery-cellar"]?.contact?.ctaLabel ?? "",
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["grocery-cellar"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["grocery-cellar"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["grocery-cellar"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["grocery-cellar"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["grocery-cellar"]?.editorialSplit?.heading ?? "",
          body: strings.templates["grocery-cellar"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["grocery-cellar"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["grocery-cellar"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
    ],
  };
}

/**
 * `grocery-cellar` shares its skeleton with `grocery-larder`; the two must
 * not share a `primaryAccent`. Cold-drinks teal, distinct from
 * `grocery-larder`'s warm bakery gold.
 */
export function groceryCellarTokens(): ThemeTokens {
  return {
    primaryAccent: "#0E7490",
    secondaryAccent: "#A5F3FC",
    announcementText: strings.templates["grocery-cellar"]?.announcement ?? "",
    footerTagline: strings.templates["grocery-cellar"]?.footerTagline ?? "",
  };
}

export function groceryLarderDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["grocery-larder"]?.hero?.eyebrow ?? "",
          heading: strings.templates["grocery-larder"]?.hero?.heading ?? "",
          body: strings.templates["grocery-larder"]?.hero?.body ?? "",
          ctaLabel: strings.templates["grocery-larder"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["grocery-larder"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["grocery-larder"]?.contact?.heading ?? "",
          body: strings.templates["grocery-larder"]?.contact?.body ?? "",
          ctaLabel: strings.templates["grocery-larder"]?.contact?.ctaLabel ?? "",
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["grocery-larder"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["grocery-larder"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["grocery-larder"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["grocery-larder"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["grocery-larder"]?.editorialSplit?.heading ?? "",
          body: strings.templates["grocery-larder"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["grocery-larder"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["grocery-larder"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
    ],
  };
}

/**
 * `grocery-larder` shares its skeleton with `grocery-cellar`; the two must
 * not share a `primaryAccent`. Warm bakery gold, distinct from
 * `grocery-cellar`'s cold-drinks teal.
 */
export function groceryLarderTokens(): ThemeTokens {
  return {
    primaryAccent: "#A16207",
    secondaryAccent: "#FEF08A",
    announcementText: strings.templates["grocery-larder"]?.announcement ?? "",
    footerTagline: strings.templates["grocery-larder"]?.footerTagline ?? "",
  };
}
