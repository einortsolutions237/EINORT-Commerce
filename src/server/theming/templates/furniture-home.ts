import "server-only";

/**
 * Per-segment document/token builder module for the `furniture-home`
 * industry segment (TMPL-03, TMPL-04) — 8 named builder pairs (16
 * functions), one document/tokens pair per this segment's non-flagship rows
 * in `src/server/theming/registry.ts`. `flagship-fashion` itself keeps its
 * own document and token builder functions in
 * `src/server/theming/defaults.ts`, unchanged — it does not get a builder
 * here.
 *
 * CONTENT-COMPLETE (05-16, Wave 3). Plan 05-08 (Wave 2) shipped this file
 * contract-complete but content-minimal: every builder's `sections` matched
 * its registry row and every settings field was present, but every copy
 * value resolved to `""` and every token pair reused the flagship's neutral
 * `DEFAULT_PRIMARY_ACCENT`/`DEFAULT_SECONDARY_ACCENT`. This plan (05-16)
 * lands the real content on both axes: every copy value now reads Task 1's
 * real strings under `src/lib/strings/templates/furniture-home.ts`, and
 * every token pair carries a real, per-template accent so no two templates
 * sharing a skeleton render with the same primary accent.
 *
 * The `?? ""` fallback on every copy read survives this plan and is not a
 * placeholder anymore — it is a type-safety bridge, not a content bridge.
 * `strings.templates` is typed `Partial<Record<TemplateKey,
 * Partial<FlagshipCopy>>>` (05-03), so TypeScript cannot statically know that
 * `strings.templates["furniture-loom"]` is populated even though it always
 * is at runtime after Task 1 — the same reason every other segment module in
 * this phase keeps the identical `?? ""` shape after its own Wave 3 plan
 * lands. Removing it here would not be a cleanup; it would make this file
 * the only one that disagrees with the other five on how the namespace is
 * read.
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
 * ---------------------------------------------------------------------------
 * ITEM COUNT IS CHOSEN PER PRODUCT-GRID VARIANT, NOT LEFT AT THE DEFAULT.
 * ---------------------------------------------------------------------------
 * `product-grid:showcase` renders two large tiles per row
 * (`product-grid-showcase.tsx`'s `sm:grid-cols-2`), so `DEFAULT_ITEM_COUNT`
 * (8) is a four-row scroll before the next section — wrong for "fewer,
 * larger, more considered items", the whole reason this segment leans on the
 * showcase variant (see this plan's objective). The two showcase-bearing
 * skeletons here (S16: `furniture-loom`/`furniture-grain`; S19:
 * `furniture-nook`/`furniture-loft`) use the schema's lowest literal, `4` —
 * two rows of two. `product-grid:dense` (S18: `furniture-timber`/
 * `furniture-haven`) is the opposite instinct — a fuller, more practical
 * catalogue — and uses the schema's highest literal, `12`. `product-grid:grid`
 * (S17: `furniture-oak`/`furniture-hearth`) keeps `DEFAULT_ITEM_COUNT` (8),
 * the same neutral count the flagship itself uses for its own `grid` variant.
 *
 * ---------------------------------------------------------------------------
 * ACCENTS: EACH SIBLING PAIR IS DISTINCT; NONE REUSE THE FLAGSHIP DEFAULTS.
 * ---------------------------------------------------------------------------
 * `DEFAULT_PRIMARY_ACCENT`/`DEFAULT_SECONDARY_ACCENT` (zinc-900/zinc-500) are
 * the flagship's own neutral palette and Wave 2's placeholder for every
 * non-flagship template. This plan replaces both for all 8 furniture-home
 * templates with warm, material-led tones (walnut, oak, terracotta, timber
 * charcoal, sage, bronze) that read as a furniture/homeware storefront rather
 * than the flagship's ink-and-zinc fashion palette. Each hex constant below
 * is named for the template it belongs to and is a plain module-scope
 * string — not a document literal, so the "never hoist a builder's literal"
 * rule above does not apply to it; only the `PageDocument`/`ThemeTokens`
 * object built and returned inside each function body is fresh-per-call.
 * `accentForeground`/the focus ring are derived by
 * `src/lib/theme-defaults.ts`'s `deriveThemeCssVars` and are never stored
 * here, so an accent choice below cannot produce an unreadable pair (D-11).
 */

import {
  DEFAULT_ITEM_COUNT,
  DEFAULT_OVERLAY_OPACITY,
} from "@/server/theming/defaults";
import { strings } from "@/lib/strings";

import type { PageDocument, ThemeTokens } from "@/server/theming/schema";

/**
 * `product-grid:showcase`'s reduced tile count (see the file header).
 * Named separately from `DEFAULT_ITEM_COUNT` so a reader sees at the call
 * site that the reduction is deliberate, not a typo of the default.
 */
const SHOWCASE_ITEM_COUNT = 4;

/** `product-grid:dense`'s increased tile count (see the file header). */
const DENSE_ITEM_COUNT = 12;

// ---------------------------------------------------------------------------
// Accents — one pair of hex constants per template, S16/S17/S18/S19 grouped.
// ---------------------------------------------------------------------------

/** S16 (starter). Deep walnut — the segment's strongest voice per Task 1. */
const LOOM_PRIMARY_ACCENT = "#4A3728";
const LOOM_SECONDARY_ACCENT = "#C9A66B";

/** S16 (professional). Oak amber — distinct from `furniture-loom`'s walnut. */
const GRAIN_PRIMARY_ACCENT = "#8B5E34";
const GRAIN_SECONDARY_ACCENT = "#3F3F3F";

/** S17 (starter). Oak brown — the segment's other strongest voice. */
const OAK_PRIMARY_ACCENT = "#6B4423";
const OAK_SECONDARY_ACCENT = "#D8C4A0";

/** S17 (professional). Terracotta — distinct from `furniture-oak`'s oak. */
const HEARTH_PRIMARY_ACCENT = "#B5623A";
const HEARTH_SECONDARY_ACCENT = "#EDE4D3";

/** S18 (business). Graphite charcoal — practical, built-to-last framing. */
const TIMBER_PRIMARY_ACCENT = "#4B4B4B";
const TIMBER_SECONDARY_ACCENT = "#C7A15A";

/** S18 (professional). Warm mocha — distinct from `furniture-timber`'s charcoal. */
const HAVEN_PRIMARY_ACCENT = "#8C6A56";
const HAVEN_SECONDARY_ACCENT = "#E8DCC8";

/** S19 (business). Sage — a calmer tone for the small-space angle. */
const NOOK_PRIMARY_ACCENT = "#5B7065";
const NOOK_SECONDARY_ACCENT = "#D9CBB8";

/** S19 (professional). Near-black bronze pairing — distinct from `furniture-nook`'s sage. */
const LOFT_PRIMARY_ACCENT = "#2F2F2F";
const LOFT_SECONDARY_ACCENT = "#A88B6A";

// ---------------------------------------------------------------------------
// S16: hero:stack | product-grid:showcase | contact:card | trust-bar:strip
// ---------------------------------------------------------------------------

export function furnitureLoomDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["furniture-loom"]?.hero?.eyebrow ?? "",
          heading: strings.templates["furniture-loom"]?.hero?.heading ?? "",
          body: strings.templates["furniture-loom"]?.hero?.body ?? "",
          ctaLabel: strings.templates["furniture-loom"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["furniture-loom"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["furniture-loom"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["furniture-loom"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["furniture-loom"]?.productGrid?.viewAllHref ?? "",
          // Showcase variant — two large tiles per row; see file header.
          itemCount: SHOWCASE_ITEM_COUNT,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["furniture-loom"]?.contact?.heading ?? "",
          body: strings.templates["furniture-loom"]?.contact?.body ?? "",
          ctaLabel: strings.templates["furniture-loom"]?.contact?.ctaLabel ?? "",
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
              heading: strings.templates["furniture-loom"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["furniture-loom"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              // Lead time on made-to-order work.
              icon: "clock",
              heading: strings.templates["furniture-loom"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-loom"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              // WhatsApp dimension check before ordering.
              icon: "message-circle",
              heading: strings.templates["furniture-loom"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["furniture-loom"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
    ],
  };
}

export function furnitureLoomTokens(): ThemeTokens {
  return {
    primaryAccent: LOOM_PRIMARY_ACCENT,
    secondaryAccent: LOOM_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-loom"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-loom"]?.footerTagline ?? "",
  };
}

// S16, shared with `furniture-loom` above — same sections/order, different
// tier and accent (see the accent constants above).

export function furnitureGrainDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["furniture-grain"]?.hero?.eyebrow ?? "",
          heading: strings.templates["furniture-grain"]?.hero?.heading ?? "",
          body: strings.templates["furniture-grain"]?.hero?.body ?? "",
          ctaLabel: strings.templates["furniture-grain"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["furniture-grain"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["furniture-grain"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["furniture-grain"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["furniture-grain"]?.productGrid?.viewAllHref ?? "",
          // Showcase variant — two large tiles per row; see file header.
          itemCount: SHOWCASE_ITEM_COUNT,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["furniture-grain"]?.contact?.heading ?? "",
          body: strings.templates["furniture-grain"]?.contact?.body ?? "",
          ctaLabel: strings.templates["furniture-grain"]?.contact?.ctaLabel ?? "",
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
              heading: strings.templates["furniture-grain"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["furniture-grain"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              // Lead time on made-to-order work.
              icon: "clock",
              heading: strings.templates["furniture-grain"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-grain"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              // Material/quality assurance ("solid wood, always").
              icon: "shield-check",
              heading: strings.templates["furniture-grain"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["furniture-grain"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
    ],
  };
}

export function furnitureGrainTokens(): ThemeTokens {
  return {
    primaryAccent: GRAIN_PRIMARY_ACCENT,
    secondaryAccent: GRAIN_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-grain"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-grain"]?.footerTagline ?? "",
  };
}

// ---------------------------------------------------------------------------
// S17: hero:full-bleed | trust-bar:band | product-grid:grid |
// editorial-split:banner | contact:card
// ---------------------------------------------------------------------------

export function furnitureOakDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["furniture-oak"]?.hero?.eyebrow ?? "",
          heading: strings.templates["furniture-oak"]?.hero?.heading ?? "",
          body: strings.templates["furniture-oak"]?.hero?.body ?? "",
          ctaLabel: strings.templates["furniture-oak"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["furniture-oak"]?.hero?.ctaHref ?? "",
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
              heading: strings.templates["furniture-oak"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["furniture-oak"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              // Lead time stated upfront.
              icon: "clock",
              heading: strings.templates["furniture-oak"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-oak"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              // WhatsApp measurement check before buying.
              icon: "message-circle",
              heading: strings.templates["furniture-oak"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["furniture-oak"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["furniture-oak"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["furniture-oak"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["furniture-oak"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["furniture-oak"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["furniture-oak"]?.editorialSplit?.heading ?? "",
          body: strings.templates["furniture-oak"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["furniture-oak"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["furniture-oak"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["furniture-oak"]?.contact?.heading ?? "",
          body: strings.templates["furniture-oak"]?.contact?.body ?? "",
          ctaLabel: strings.templates["furniture-oak"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function furnitureOakTokens(): ThemeTokens {
  return {
    primaryAccent: OAK_PRIMARY_ACCENT,
    secondaryAccent: OAK_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-oak"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-oak"]?.footerTagline ?? "",
  };
}

// S17, shared with `furniture-oak` above — same sections/order, different
// tier and accent (see the accent constants above).

export function furnitureHearthDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["furniture-hearth"]?.hero?.eyebrow ?? "",
          heading: strings.templates["furniture-hearth"]?.hero?.heading ?? "",
          body: strings.templates["furniture-hearth"]?.hero?.body ?? "",
          ctaLabel: strings.templates["furniture-hearth"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["furniture-hearth"]?.hero?.ctaHref ?? "",
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
              heading: strings.templates["furniture-hearth"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["furniture-hearth"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              // Material quality the merchant will show on request.
              icon: "shield-check",
              heading: strings.templates["furniture-hearth"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-hearth"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              // WhatsApp conversation before ordering.
              icon: "message-circle",
              heading: strings.templates["furniture-hearth"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["furniture-hearth"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["furniture-hearth"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["furniture-hearth"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["furniture-hearth"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["furniture-hearth"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["furniture-hearth"]?.editorialSplit?.heading ?? "",
          body: strings.templates["furniture-hearth"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["furniture-hearth"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["furniture-hearth"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["furniture-hearth"]?.contact?.heading ?? "",
          body: strings.templates["furniture-hearth"]?.contact?.body ?? "",
          ctaLabel: strings.templates["furniture-hearth"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function furnitureHearthTokens(): ThemeTokens {
  return {
    primaryAccent: HEARTH_PRIMARY_ACCENT,
    secondaryAccent: HEARTH_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-hearth"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-hearth"]?.footerTagline ?? "",
  };
}

// ---------------------------------------------------------------------------
// S18: hero:split | trust-bar:strip | product-grid:dense |
// editorial-split:banner | contact:band
// ---------------------------------------------------------------------------

export function furnitureTimberDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["furniture-timber"]?.hero?.eyebrow ?? "",
          heading: strings.templates["furniture-timber"]?.hero?.heading ?? "",
          body: strings.templates["furniture-timber"]?.hero?.body ?? "",
          ctaLabel: strings.templates["furniture-timber"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["furniture-timber"]?.hero?.ctaHref ?? "",
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
              heading: strings.templates["furniture-timber"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["furniture-timber"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              // In-stock vs. made-to-order timing.
              icon: "clock",
              heading: strings.templates["furniture-timber"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-timber"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              // Build-quality assurance ("built to last").
              icon: "shield-check",
              heading: strings.templates["furniture-timber"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["furniture-timber"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["furniture-timber"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["furniture-timber"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["furniture-timber"]?.productGrid?.viewAllHref ?? "",
          // Dense variant — a fuller, practical catalogue; see file header.
          itemCount: DENSE_ITEM_COUNT,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["furniture-timber"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["furniture-timber"]?.editorialSplit?.heading ?? "",
          body: strings.templates["furniture-timber"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["furniture-timber"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["furniture-timber"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["furniture-timber"]?.contact?.heading ?? "",
          body: strings.templates["furniture-timber"]?.contact?.body ?? "",
          ctaLabel: strings.templates["furniture-timber"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function furnitureTimberTokens(): ThemeTokens {
  return {
    primaryAccent: TIMBER_PRIMARY_ACCENT,
    secondaryAccent: TIMBER_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-timber"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-timber"]?.footerTagline ?? "",
  };
}

// S18, shared with `furniture-timber` above — same sections/order, different
// tier and accent (see the accent constants above).

export function furnitureHavenDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["furniture-haven"]?.hero?.eyebrow ?? "",
          heading: strings.templates["furniture-haven"]?.hero?.heading ?? "",
          body: strings.templates["furniture-haven"]?.hero?.body ?? "",
          ctaLabel: strings.templates["furniture-haven"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["furniture-haven"]?.hero?.ctaHref ?? "",
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
              heading: strings.templates["furniture-haven"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["furniture-haven"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              // Custom-piece timeline confirmed upfront.
              icon: "clock",
              heading: strings.templates["furniture-haven"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-haven"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              // WhatsApp room-size check before ordering.
              icon: "message-circle",
              heading: strings.templates["furniture-haven"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["furniture-haven"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["furniture-haven"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["furniture-haven"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["furniture-haven"]?.productGrid?.viewAllHref ?? "",
          // Dense variant — a fuller, practical catalogue; see file header.
          itemCount: DENSE_ITEM_COUNT,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["furniture-haven"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["furniture-haven"]?.editorialSplit?.heading ?? "",
          body: strings.templates["furniture-haven"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["furniture-haven"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["furniture-haven"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["furniture-haven"]?.contact?.heading ?? "",
          body: strings.templates["furniture-haven"]?.contact?.body ?? "",
          ctaLabel: strings.templates["furniture-haven"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function furnitureHavenTokens(): ThemeTokens {
  return {
    primaryAccent: HAVEN_PRIMARY_ACCENT,
    secondaryAccent: HAVEN_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-haven"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-haven"]?.footerTagline ?? "",
  };
}

// ---------------------------------------------------------------------------
// S19: hero:stack | editorial-split:split | trust-bar:band |
// product-grid:showcase | contact:card
// ---------------------------------------------------------------------------

export function furnitureNookDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["furniture-nook"]?.hero?.eyebrow ?? "",
          heading: strings.templates["furniture-nook"]?.hero?.heading ?? "",
          body: strings.templates["furniture-nook"]?.hero?.body ?? "",
          ctaLabel: strings.templates["furniture-nook"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["furniture-nook"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["furniture-nook"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["furniture-nook"]?.editorialSplit?.heading ?? "",
          body: strings.templates["furniture-nook"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["furniture-nook"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["furniture-nook"]?.editorialSplit?.ctaHref ?? "",
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
              heading: strings.templates["furniture-nook"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["furniture-nook"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              // Made-to-order timeline confirmed before building.
              icon: "clock",
              heading: strings.templates["furniture-nook"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-nook"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              // WhatsApp measurements before ordering.
              icon: "message-circle",
              heading: strings.templates["furniture-nook"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["furniture-nook"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["furniture-nook"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["furniture-nook"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["furniture-nook"]?.productGrid?.viewAllHref ?? "",
          // Showcase variant — two large tiles per row; see file header.
          itemCount: SHOWCASE_ITEM_COUNT,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["furniture-nook"]?.contact?.heading ?? "",
          body: strings.templates["furniture-nook"]?.contact?.body ?? "",
          ctaLabel: strings.templates["furniture-nook"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function furnitureNookTokens(): ThemeTokens {
  return {
    primaryAccent: NOOK_PRIMARY_ACCENT,
    secondaryAccent: NOOK_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-nook"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-nook"]?.footerTagline ?? "",
  };
}

// S19, shared with `furniture-nook` above — same sections/order, different
// tier and accent (see the accent constants above).

export function furnitureLoftDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["furniture-loft"]?.hero?.eyebrow ?? "",
          heading: strings.templates["furniture-loft"]?.hero?.heading ?? "",
          body: strings.templates["furniture-loft"]?.hero?.body ?? "",
          ctaLabel: strings.templates["furniture-loft"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["furniture-loft"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["furniture-loft"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["furniture-loft"]?.editorialSplit?.heading ?? "",
          body: strings.templates["furniture-loft"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["furniture-loft"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["furniture-loft"]?.editorialSplit?.ctaHref ?? "",
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
              heading: strings.templates["furniture-loft"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["furniture-loft"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              // Real-materials quality assurance.
              icon: "shield-check",
              heading: strings.templates["furniture-loft"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-loft"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              // WhatsApp planning conversation before ordering.
              icon: "message-circle",
              heading: strings.templates["furniture-loft"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["furniture-loft"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["furniture-loft"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["furniture-loft"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["furniture-loft"]?.productGrid?.viewAllHref ?? "",
          // Showcase variant — two large tiles per row; see file header.
          itemCount: SHOWCASE_ITEM_COUNT,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["furniture-loft"]?.contact?.heading ?? "",
          body: strings.templates["furniture-loft"]?.contact?.body ?? "",
          ctaLabel: strings.templates["furniture-loft"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function furnitureLoftTokens(): ThemeTokens {
  return {
    primaryAccent: LOFT_PRIMARY_ACCENT,
    secondaryAccent: LOFT_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-loft"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-loft"]?.footerTagline ?? "",
  };
}
