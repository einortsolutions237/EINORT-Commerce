import "server-only";

/**
 * Per-segment document/token builder module for the `electronics`
 * industry segment (TMPL-03, TMPL-04) — 9 named builder pairs (18
 * functions), one document/tokens pair per this segment's non-flagship rows
 * in `src/server/theming/registry.ts`. `flagship-fashion` itself keeps its
 * own document and token builder functions in
 * `src/server/theming/defaults.ts`, unchanged — it does not get a builder
 * here.
 *
 * REAL COPY AND REAL ACCENTS (05-13, Wave 3). 05-08 shipped this module
 * contract-complete but content-minimal (every string `?? ""`, every accent
 * the flagship's neutral default). This plan fills `src/lib/strings/
 * templates/electronics.ts` with the segment's actual copy and gives each
 * template its own accent pair, so the `?? ""` bridge now resolves to real
 * values while remaining the correct type-safe shape (`strings.templates`'s
 * outer `Partial` still means an unauthored key elsewhere in the library
 * legitimately has no entry).
 *
 * Three invariants inherited verbatim from the flagship's own document
 * builder (`src/server/theming/defaults.ts`), unchanged by this plan:
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
 * ACCENTS. `05-08-SUMMARY.md`'s allocation table fixes four sibling pairs
 * that share a skeleton in this file — (`electronics-circuit`,
 * `-signal`), (`-grid`, `-current`), (`-pulse`, `-volt`), (`-module`,
 * `-frame`) — plus `electronics-byte`, whose skeleton (S24) is shared with
 * `retail-district` in a different segment module, not with any key here.
 * Every sibling pair below gets a distinct `primaryAccent` (the metric this
 * plan's `must_haves.truths` names: "no two read as the same shop
 * recoloured"). All nine accents are in fact mutually distinct, not merely
 * pairwise-distinct within a sibling pair — the stronger property was no
 * harder to author and reads better across the full picker grid. Values are
 * plain 6-digit hex literals satisfying `hexColorSchema`; foregrounds and the
 * focus ring are derived at render time by `deriveThemeCssVars`
 * (`src/lib/theme-defaults.ts`), so no contrast math happens here.
 *
 * ITEM COUNT. `electronics-grid` and `electronics-current` (S5) render their
 * product-grid in the `showcase` variant, which lays out fewer, larger tiles
 * than `grid`/`dense` — both set `itemCount: 4` rather than the segment's
 * usual `DEFAULT_ITEM_COUNT` (8), with a comment at each call site. No other
 * template in this file deviates.
 */

import { DEFAULT_OVERLAY_OPACITY } from "@/server/theming/defaults";
import { strings } from "@/lib/strings";

import type { PageDocument, ThemeTokens } from "@/server/theming/schema";

// ---------------------------------------------------------------------------
// S4 (hero:stack | product-grid:dense | contact:card)
// electronics-circuit (starter) / electronics-signal (professional)
// ---------------------------------------------------------------------------

export function electronicsCircuitDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["electronics-circuit"]?.hero?.eyebrow ?? "",
          heading: strings.templates["electronics-circuit"]?.hero?.heading ?? "",
          body: strings.templates["electronics-circuit"]?.hero?.body ?? "",
          ctaLabel: strings.templates["electronics-circuit"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["electronics-circuit"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["electronics-circuit"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["electronics-circuit"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["electronics-circuit"]?.productGrid?.viewAllHref ?? "",
          itemCount: 8,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["electronics-circuit"]?.contact?.heading ?? "",
          body: strings.templates["electronics-circuit"]?.contact?.body ?? "",
          ctaLabel: strings.templates["electronics-circuit"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function electronicsCircuitTokens(): ThemeTokens {
  return {
    primaryAccent: "#2563EB",
    secondaryAccent: "#1E3A8A",
    announcementText: strings.templates["electronics-circuit"]?.announcement ?? "",
    footerTagline: strings.templates["electronics-circuit"]?.footerTagline ?? "",
  };
}

export function electronicsSignalDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["electronics-signal"]?.hero?.eyebrow ?? "",
          heading: strings.templates["electronics-signal"]?.hero?.heading ?? "",
          body: strings.templates["electronics-signal"]?.hero?.body ?? "",
          ctaLabel: strings.templates["electronics-signal"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["electronics-signal"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["electronics-signal"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["electronics-signal"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["electronics-signal"]?.productGrid?.viewAllHref ?? "",
          itemCount: 8,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["electronics-signal"]?.contact?.heading ?? "",
          body: strings.templates["electronics-signal"]?.contact?.body ?? "",
          ctaLabel: strings.templates["electronics-signal"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function electronicsSignalTokens(): ThemeTokens {
  return {
    primaryAccent: "#7C3AED",
    secondaryAccent: "#4C1D95",
    announcementText: strings.templates["electronics-signal"]?.announcement ?? "",
    footerTagline: strings.templates["electronics-signal"]?.footerTagline ?? "",
  };
}

// ---------------------------------------------------------------------------
// S5 (hero:split | trust-bar:strip | product-grid:showcase)
// electronics-grid (starter) / electronics-current (professional)
// ---------------------------------------------------------------------------

export function electronicsGridDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["electronics-grid"]?.hero?.eyebrow ?? "",
          heading: strings.templates["electronics-grid"]?.hero?.heading ?? "",
          body: strings.templates["electronics-grid"]?.hero?.body ?? "",
          ctaLabel: strings.templates["electronics-grid"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["electronics-grid"]?.hero?.ctaHref ?? "",
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
              heading: strings.templates["electronics-grid"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["electronics-grid"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["electronics-grid"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["electronics-grid"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["electronics-grid"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["electronics-grid"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["electronics-grid"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["electronics-grid"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["electronics-grid"]?.productGrid?.viewAllHref ?? "",
          // showcase renders fewer, larger tiles than grid/dense — 4, not
          // DEFAULT_ITEM_COUNT (8).
          itemCount: 4,
        },
      },
    ],
  };
}

export function electronicsGridTokens(): ThemeTokens {
  return {
    primaryAccent: "#0D9488",
    secondaryAccent: "#134E4A",
    announcementText: strings.templates["electronics-grid"]?.announcement ?? "",
    footerTagline: strings.templates["electronics-grid"]?.footerTagline ?? "",
  };
}

export function electronicsCurrentDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["electronics-current"]?.hero?.eyebrow ?? "",
          heading: strings.templates["electronics-current"]?.hero?.heading ?? "",
          body: strings.templates["electronics-current"]?.hero?.body ?? "",
          ctaLabel: strings.templates["electronics-current"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["electronics-current"]?.hero?.ctaHref ?? "",
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
              heading: strings.templates["electronics-current"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["electronics-current"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["electronics-current"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["electronics-current"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "clock",
              heading: strings.templates["electronics-current"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["electronics-current"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["electronics-current"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["electronics-current"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["electronics-current"]?.productGrid?.viewAllHref ?? "",
          // showcase renders fewer, larger tiles than grid/dense — 4, not
          // DEFAULT_ITEM_COUNT (8).
          itemCount: 4,
        },
      },
    ],
  };
}

export function electronicsCurrentTokens(): ThemeTokens {
  return {
    primaryAccent: "#EA580C",
    secondaryAccent: "#7C2D12",
    announcementText: strings.templates["electronics-current"]?.announcement ?? "",
    footerTagline: strings.templates["electronics-current"]?.footerTagline ?? "",
  };
}

// ---------------------------------------------------------------------------
// S6 (hero:full-bleed | editorial-split:banner | product-grid:dense)
// electronics-pulse (business) / electronics-volt (professional)
// ---------------------------------------------------------------------------

export function electronicsPulseDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["electronics-pulse"]?.hero?.eyebrow ?? "",
          heading: strings.templates["electronics-pulse"]?.hero?.heading ?? "",
          body: strings.templates["electronics-pulse"]?.hero?.body ?? "",
          ctaLabel: strings.templates["electronics-pulse"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["electronics-pulse"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["electronics-pulse"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["electronics-pulse"]?.editorialSplit?.heading ?? "",
          body: strings.templates["electronics-pulse"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["electronics-pulse"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["electronics-pulse"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["electronics-pulse"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["electronics-pulse"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["electronics-pulse"]?.productGrid?.viewAllHref ?? "",
          itemCount: 8,
        },
      },
    ],
  };
}

export function electronicsPulseTokens(): ThemeTokens {
  return {
    primaryAccent: "#DC2626",
    secondaryAccent: "#7F1D1D",
    announcementText: strings.templates["electronics-pulse"]?.announcement ?? "",
    footerTagline: strings.templates["electronics-pulse"]?.footerTagline ?? "",
  };
}

export function electronicsVoltDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["electronics-volt"]?.hero?.eyebrow ?? "",
          heading: strings.templates["electronics-volt"]?.hero?.heading ?? "",
          body: strings.templates["electronics-volt"]?.hero?.body ?? "",
          ctaLabel: strings.templates["electronics-volt"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["electronics-volt"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["electronics-volt"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["electronics-volt"]?.editorialSplit?.heading ?? "",
          body: strings.templates["electronics-volt"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["electronics-volt"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["electronics-volt"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["electronics-volt"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["electronics-volt"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["electronics-volt"]?.productGrid?.viewAllHref ?? "",
          itemCount: 8,
        },
      },
    ],
  };
}

export function electronicsVoltTokens(): ThemeTokens {
  return {
    primaryAccent: "#CA8A04",
    secondaryAccent: "#713F12",
    announcementText: strings.templates["electronics-volt"]?.announcement ?? "",
    footerTagline: strings.templates["electronics-volt"]?.footerTagline ?? "",
  };
}

// ---------------------------------------------------------------------------
// S7 (hero:stack | trust-bar:band | product-grid:grid)
// electronics-module (business) / electronics-frame (business)
// ---------------------------------------------------------------------------

export function electronicsModuleDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["electronics-module"]?.hero?.eyebrow ?? "",
          heading: strings.templates["electronics-module"]?.hero?.heading ?? "",
          body: strings.templates["electronics-module"]?.hero?.body ?? "",
          ctaLabel: strings.templates["electronics-module"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["electronics-module"]?.hero?.ctaHref ?? "",
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
              heading: strings.templates["electronics-module"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["electronics-module"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "truck",
              heading: strings.templates["electronics-module"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["electronics-module"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["electronics-module"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["electronics-module"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["electronics-module"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["electronics-module"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["electronics-module"]?.productGrid?.viewAllHref ?? "",
          itemCount: 8,
        },
      },
    ],
  };
}

export function electronicsModuleTokens(): ThemeTokens {
  return {
    primaryAccent: "#0891B2",
    secondaryAccent: "#164E63",
    announcementText: strings.templates["electronics-module"]?.announcement ?? "",
    footerTagline: strings.templates["electronics-module"]?.footerTagline ?? "",
  };
}

export function electronicsFrameDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["electronics-frame"]?.hero?.eyebrow ?? "",
          heading: strings.templates["electronics-frame"]?.hero?.heading ?? "",
          body: strings.templates["electronics-frame"]?.hero?.body ?? "",
          ctaLabel: strings.templates["electronics-frame"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["electronics-frame"]?.hero?.ctaHref ?? "",
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
              heading: strings.templates["electronics-frame"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["electronics-frame"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["electronics-frame"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["electronics-frame"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["electronics-frame"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["electronics-frame"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["electronics-frame"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["electronics-frame"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["electronics-frame"]?.productGrid?.viewAllHref ?? "",
          itemCount: 8,
        },
      },
    ],
  };
}

export function electronicsFrameTokens(): ThemeTokens {
  return {
    primaryAccent: "#4F46E5",
    secondaryAccent: "#312E81",
    announcementText: strings.templates["electronics-frame"]?.announcement ?? "",
    footerTagline: strings.templates["electronics-frame"]?.footerTagline ?? "",
  };
}

// ---------------------------------------------------------------------------
// S24 (hero:full-bleed | product-grid:grid) — shared with `retail-district`
// (general-retail), not with any other key in this file.
// ---------------------------------------------------------------------------

export function electronicsByteDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["electronics-byte"]?.hero?.eyebrow ?? "",
          heading: strings.templates["electronics-byte"]?.hero?.heading ?? "",
          body: strings.templates["electronics-byte"]?.hero?.body ?? "",
          ctaLabel: strings.templates["electronics-byte"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["electronics-byte"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["electronics-byte"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["electronics-byte"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["electronics-byte"]?.productGrid?.viewAllHref ?? "",
          itemCount: 8,
        },
      },
    ],
  };
}

export function electronicsByteTokens(): ThemeTokens {
  return {
    primaryAccent: "#059669",
    secondaryAccent: "#064E3B",
    announcementText: strings.templates["electronics-byte"]?.announcement ?? "",
    footerTagline: strings.templates["electronics-byte"]?.footerTagline ?? "",
  };
}
