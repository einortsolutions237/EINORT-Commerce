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
 * CONTRACT-COMPLETE, CONTENT-MINIMAL THIS PLAN (05-08). Every builder's
 * `sections` array matches its registry row's declared section types and
 * order exactly, and every settings field is present. Every copy value reads
 * `strings.templates["<key>"]?.<path> ?? ""` — the ONE access pattern this
 * phase's six segment modules use, with optional chaining down to the leaf
 * field and a `?? ""` fallback so the expression typechecks against the
 * as-yet-empty `strings.templates` namespace 05-03 typed
 * (`Partial<Record<TemplateKey, Partial<typeof strings.flagship>>>`). The
 * `?? ""` fallback is a type-safety bridge for this wave, never a shipped
 * value: plans 05-12 through 05-17 (Wave 3) land real copy under this exact
 * namespace in this same file, and plan 05-20's generalized default-document
 * parse test is the gate that catches an empty string before it ever reaches
 * a live document.
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
 * `primaryAccent` / `secondaryAccent` reuse the same neutral defaults
 * `flagshipDefaultTokens()` ships (`DEFAULT_PRIMARY_ACCENT` /
 * `DEFAULT_SECONDARY_ACCENT`) because accent authoring is not part of
 * `strings.templates`'s copy shape — `FlagshipCopy` carries no accent field.
 * Per-template accent differentiation (the second axis of TMPL-05's
 * distinctiveness test) is Wave 3's job, landing alongside the real copy.
 */

import {
  DEFAULT_ITEM_COUNT,
  DEFAULT_OVERLAY_OPACITY,
} from "@/server/theming/defaults";
import {
  DEFAULT_PRIMARY_ACCENT,
  DEFAULT_SECONDARY_ACCENT,
} from "@/lib/theme-defaults";
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
          itemCount: DEFAULT_ITEM_COUNT,
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

export function groceryMarketTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
          itemCount: DEFAULT_ITEM_COUNT,
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

export function groceryHarvestTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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

export function groceryPantryTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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

export function groceryFreshTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
          itemCount: DEFAULT_ITEM_COUNT,
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

export function groceryOrchardTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
          itemCount: DEFAULT_ITEM_COUNT,
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

export function groceryGroveTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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

export function groceryCellarTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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

export function groceryLarderTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["grocery-larder"]?.announcement ?? "",
    footerTagline: strings.templates["grocery-larder"]?.footerTagline ?? "",
  };
}
