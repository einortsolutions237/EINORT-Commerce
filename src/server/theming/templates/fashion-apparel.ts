import "server-only";

/**
 * Per-segment document/token builder module for the `fashion-apparel`
 * industry segment (TMPL-03, TMPL-04) — 7 named builder pairs (14
 * functions), one document/tokens pair per this segment's non-flagship rows
 * in `src/server/theming/registry.ts`. `flagship-fashion` itself keeps its
 * own document and token builder functions in
 * `src/server/theming/defaults.ts`, unchanged — it does not get a builder
 * here.
 *
 * CONTENT-COMPLETE as of 05-12 (Wave 3). Every builder's `sections` array
 * matches its registry row's declared section types and order exactly, and
 * every settings field is present. Every copy value reads
 * `strings.templates["<key>"]?.<path> ?? ""` — the ONE access pattern this
 * phase's six segment modules use, with optional chaining down to the leaf
 * field and a `?? ""` fallback so the expression typechecks against
 * `strings.templates`'s `Partial` shape. The fallback is exercised only if a
 * key/path pair goes missing from `src/lib/strings/templates/fashion-apparel.ts`
 * — every key/path this file reads has a real, cap-respecting entry there
 * as of this plan.
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
 * `primaryAccent` / `secondaryAccent` are chosen per template below (hex
 * literals, `hexColorSchema`-valid) rather than reusing the flagship's
 * neutral `DEFAULT_PRIMARY_ACCENT` / `DEFAULT_SECONDARY_ACCENT` — the
 * "accent" axis of TMPL-05's distinctiveness test. No two templates sharing
 * a skeleton (`fashion-classic`/`flagship-fashion`, `fashion-edit`/
 * `fashion-muse`, `fashion-studio`/`fashion-house`, `fashion-runway`/
 * `fashion-loft`) share a `primaryAccent`. Foregrounds and the focus ring are
 * derived from these two values by `deriveThemeCssVars`
 * (`src/lib/theme-defaults.ts`) at render time — never stored, never a
 * second source of truth, no contrast library needed. This file is not
 * scanned by `tests/unit/surface-token-isolation.test.ts` (its `SHARED_DIRS`
 * is `src/app` and `src/components` only), so hex literals here are the
 * sanctioned pattern, not a violation of that ban.
 */

import {
  DEFAULT_ITEM_COUNT,
  DEFAULT_OVERLAY_OPACITY,
} from "@/server/theming/defaults";
import { strings } from "@/lib/strings";

import type { PageDocument, ThemeTokens } from "@/server/theming/schema";

/**
 * `fashion-classic` — S0, same skeleton as `flagship-fashion` (hero,
 * trust-bar, product-grid, editorial-split, contact). Stone/charcoal accent,
 * distinct from the flagship's zinc.
 */
export function fashionClassicDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["fashion-classic"]?.hero?.eyebrow ?? "",
          heading: strings.templates["fashion-classic"]?.hero?.heading ?? "",
          body: strings.templates["fashion-classic"]?.hero?.body ?? "",
          ctaLabel: strings.templates["fashion-classic"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["fashion-classic"]?.hero?.ctaHref ?? "",
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
              heading: strings.templates["fashion-classic"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["fashion-classic"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["fashion-classic"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["fashion-classic"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["fashion-classic"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["fashion-classic"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["fashion-classic"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["fashion-classic"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["fashion-classic"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["fashion-classic"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["fashion-classic"]?.editorialSplit?.heading ?? "",
          body: strings.templates["fashion-classic"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["fashion-classic"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["fashion-classic"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["fashion-classic"]?.contact?.heading ?? "",
          body: strings.templates["fashion-classic"]?.contact?.body ?? "",
          ctaLabel: strings.templates["fashion-classic"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function fashionClassicTokens(): ThemeTokens {
  return {
    /** stone-800. Distinct from the flagship's zinc-900 sibling accent. */
    primaryAccent: "#292524",
    /** stone-400. */
    secondaryAccent: "#A8A29E",
    announcementText: strings.templates["fashion-classic"]?.announcement ?? "",
    footerTagline: strings.templates["fashion-classic"]?.footerTagline ?? "",
  };
}

/**
 * `fashion-edit` — S1 (hero, product-grid:showcase). One of this segment's
 * two starter rows. `itemCount` is deliberately 4, not `DEFAULT_ITEM_COUNT`
 * (8): the `showcase` variant renders fewer, larger tiles, and a small
 * curated "edit" is the persona's own point — a dense grid here would fight
 * the copy.
 */
export function fashionEditDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["fashion-edit"]?.hero?.eyebrow ?? "",
          heading: strings.templates["fashion-edit"]?.hero?.heading ?? "",
          body: strings.templates["fashion-edit"]?.hero?.body ?? "",
          ctaLabel: strings.templates["fashion-edit"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["fashion-edit"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["fashion-edit"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["fashion-edit"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["fashion-edit"]?.productGrid?.viewAllHref ?? "",
          itemCount: 4,
        },
      },
    ],
  };
}

export function fashionEditTokens(): ThemeTokens {
  return {
    /** navy-900-ish. Distinct from `fashion-muse`'s purple sibling accent. */
    primaryAccent: "#1E3A5F",
    /** slate-400. */
    secondaryAccent: "#94A3B8",
    announcementText: strings.templates["fashion-edit"]?.announcement ?? "",
    footerTagline: strings.templates["fashion-edit"]?.footerTagline ?? "",
  };
}

/**
 * `fashion-muse` — S1, same skeleton as `fashion-edit`. Same showcase
 * itemCount reasoning applies.
 */
export function fashionMuseDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["fashion-muse"]?.hero?.eyebrow ?? "",
          heading: strings.templates["fashion-muse"]?.hero?.heading ?? "",
          body: strings.templates["fashion-muse"]?.hero?.body ?? "",
          ctaLabel: strings.templates["fashion-muse"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["fashion-muse"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["fashion-muse"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["fashion-muse"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["fashion-muse"]?.productGrid?.viewAllHref ?? "",
          itemCount: 4,
        },
      },
    ],
  };
}

export function fashionMuseTokens(): ThemeTokens {
  return {
    /** purple-900-ish. Distinct from `fashion-edit`'s navy sibling accent. */
    primaryAccent: "#581C87",
    /** purple-400. */
    secondaryAccent: "#C084FC",
    announcementText: strings.templates["fashion-muse"]?.announcement ?? "",
    footerTagline: strings.templates["fashion-muse"]?.footerTagline ?? "",
  };
}

/** `fashion-studio` — S2 (hero:split, product-grid:dense). */
export function fashionStudioDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["fashion-studio"]?.hero?.eyebrow ?? "",
          heading: strings.templates["fashion-studio"]?.hero?.heading ?? "",
          body: strings.templates["fashion-studio"]?.hero?.body ?? "",
          ctaLabel: strings.templates["fashion-studio"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["fashion-studio"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["fashion-studio"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["fashion-studio"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["fashion-studio"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

export function fashionStudioTokens(): ThemeTokens {
  return {
    /** teal-900-ish. Distinct from `fashion-house`'s maroon sibling accent. */
    primaryAccent: "#134E4A",
    /** teal-300. */
    secondaryAccent: "#5EEAD4",
    announcementText: strings.templates["fashion-studio"]?.announcement ?? "",
    footerTagline: strings.templates["fashion-studio"]?.footerTagline ?? "",
  };
}

/** `fashion-house` — S2, same skeleton as `fashion-studio`. */
export function fashionHouseDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["fashion-house"]?.hero?.eyebrow ?? "",
          heading: strings.templates["fashion-house"]?.hero?.heading ?? "",
          body: strings.templates["fashion-house"]?.hero?.body ?? "",
          ctaLabel: strings.templates["fashion-house"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["fashion-house"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["fashion-house"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["fashion-house"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["fashion-house"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

export function fashionHouseTokens(): ThemeTokens {
  return {
    /** maroon-900-ish. Distinct from `fashion-studio`'s teal sibling accent. */
    primaryAccent: "#7F1D1D",
    /** red-300. */
    secondaryAccent: "#FCA5A5",
    announcementText: strings.templates["fashion-house"]?.announcement ?? "",
    footerTagline: strings.templates["fashion-house"]?.footerTagline ?? "",
  };
}

/** `fashion-runway` — S3 (hero:full-bleed, product-grid:grid, contact:card). */
export function fashionRunwayDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["fashion-runway"]?.hero?.eyebrow ?? "",
          heading: strings.templates["fashion-runway"]?.hero?.heading ?? "",
          body: strings.templates["fashion-runway"]?.hero?.body ?? "",
          ctaLabel: strings.templates["fashion-runway"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["fashion-runway"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["fashion-runway"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["fashion-runway"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["fashion-runway"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["fashion-runway"]?.contact?.heading ?? "",
          body: strings.templates["fashion-runway"]?.contact?.body ?? "",
          ctaLabel: strings.templates["fashion-runway"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function fashionRunwayTokens(): ThemeTokens {
  return {
    /** near-black. Distinct from `fashion-loft`'s brown sibling accent. */
    primaryAccent: "#111827",
    /** amber-500. */
    secondaryAccent: "#F59E0B",
    announcementText: strings.templates["fashion-runway"]?.announcement ?? "",
    footerTagline: strings.templates["fashion-runway"]?.footerTagline ?? "",
  };
}

/** `fashion-loft` — S3, same skeleton as `fashion-runway`. Resale/vintage persona. */
export function fashionLoftDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["fashion-loft"]?.hero?.eyebrow ?? "",
          heading: strings.templates["fashion-loft"]?.hero?.heading ?? "",
          body: strings.templates["fashion-loft"]?.hero?.body ?? "",
          ctaLabel: strings.templates["fashion-loft"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["fashion-loft"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["fashion-loft"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["fashion-loft"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["fashion-loft"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["fashion-loft"]?.contact?.heading ?? "",
          body: strings.templates["fashion-loft"]?.contact?.body ?? "",
          ctaLabel: strings.templates["fashion-loft"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function fashionLoftTokens(): ThemeTokens {
  return {
    /** brown-900-ish. Distinct from `fashion-runway`'s near-black sibling accent. */
    primaryAccent: "#78350F",
    /** amber-200. */
    secondaryAccent: "#FDE68A",
    announcementText: strings.templates["fashion-loft"]?.announcement ?? "",
    footerTagline: strings.templates["fashion-loft"]?.footerTagline ?? "",
  };
}
