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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["fashion-classic"]?.announcement ?? "",
    footerTagline: strings.templates["fashion-classic"]?.footerTagline ?? "",
  };
}

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
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

export function fashionEditTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["fashion-edit"]?.announcement ?? "",
    footerTagline: strings.templates["fashion-edit"]?.footerTagline ?? "",
  };
}

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
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

export function fashionMuseTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["fashion-muse"]?.announcement ?? "",
    footerTagline: strings.templates["fashion-muse"]?.footerTagline ?? "",
  };
}

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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["fashion-studio"]?.announcement ?? "",
    footerTagline: strings.templates["fashion-studio"]?.footerTagline ?? "",
  };
}

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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["fashion-house"]?.announcement ?? "",
    footerTagline: strings.templates["fashion-house"]?.footerTagline ?? "",
  };
}

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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["fashion-runway"]?.announcement ?? "",
    footerTagline: strings.templates["fashion-runway"]?.footerTagline ?? "",
  };
}

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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["fashion-loft"]?.announcement ?? "",
    footerTagline: strings.templates["fashion-loft"]?.footerTagline ?? "",
  };
}
