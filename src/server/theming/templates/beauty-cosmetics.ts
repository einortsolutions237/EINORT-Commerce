import "server-only";

/**
 * Per-segment document/token builder module for the `beauty-cosmetics`
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

export function beautyGlowDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["beauty-glow"]?.hero?.eyebrow ?? "",
          heading: strings.templates["beauty-glow"]?.hero?.heading ?? "",
          body: strings.templates["beauty-glow"]?.hero?.body ?? "",
          ctaLabel: strings.templates["beauty-glow"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["beauty-glow"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["beauty-glow"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["beauty-glow"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["beauty-glow"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["beauty-glow"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["beauty-glow"]?.editorialSplit?.heading ?? "",
          body: strings.templates["beauty-glow"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["beauty-glow"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["beauty-glow"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
    ],
  };
}

export function beautyGlowTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["beauty-glow"]?.announcement ?? "",
    footerTagline: strings.templates["beauty-glow"]?.footerTagline ?? "",
  };
}

export function beautyVeilDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["beauty-veil"]?.hero?.eyebrow ?? "",
          heading: strings.templates["beauty-veil"]?.hero?.heading ?? "",
          body: strings.templates["beauty-veil"]?.hero?.body ?? "",
          ctaLabel: strings.templates["beauty-veil"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["beauty-veil"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["beauty-veil"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["beauty-veil"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["beauty-veil"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["beauty-veil"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["beauty-veil"]?.editorialSplit?.heading ?? "",
          body: strings.templates["beauty-veil"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["beauty-veil"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["beauty-veil"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
    ],
  };
}

export function beautyVeilTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["beauty-veil"]?.announcement ?? "",
    footerTagline: strings.templates["beauty-veil"]?.footerTagline ?? "",
  };
}

export function beautyBloomDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["beauty-bloom"]?.hero?.eyebrow ?? "",
          heading: strings.templates["beauty-bloom"]?.hero?.heading ?? "",
          body: strings.templates["beauty-bloom"]?.hero?.body ?? "",
          ctaLabel: strings.templates["beauty-bloom"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["beauty-bloom"]?.hero?.ctaHref ?? "",
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
              heading: strings.templates["beauty-bloom"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["beauty-bloom"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["beauty-bloom"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["beauty-bloom"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["beauty-bloom"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["beauty-bloom"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["beauty-bloom"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["beauty-bloom"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["beauty-bloom"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["beauty-bloom"]?.contact?.heading ?? "",
          body: strings.templates["beauty-bloom"]?.contact?.body ?? "",
          ctaLabel: strings.templates["beauty-bloom"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function beautyBloomTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["beauty-bloom"]?.announcement ?? "",
    footerTagline: strings.templates["beauty-bloom"]?.footerTagline ?? "",
  };
}

export function beautySatinDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["beauty-satin"]?.hero?.eyebrow ?? "",
          heading: strings.templates["beauty-satin"]?.hero?.heading ?? "",
          body: strings.templates["beauty-satin"]?.hero?.body ?? "",
          ctaLabel: strings.templates["beauty-satin"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["beauty-satin"]?.hero?.ctaHref ?? "",
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
              heading: strings.templates["beauty-satin"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["beauty-satin"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["beauty-satin"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["beauty-satin"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["beauty-satin"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["beauty-satin"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["beauty-satin"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["beauty-satin"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["beauty-satin"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["beauty-satin"]?.contact?.heading ?? "",
          body: strings.templates["beauty-satin"]?.contact?.body ?? "",
          ctaLabel: strings.templates["beauty-satin"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function beautySatinTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["beauty-satin"]?.announcement ?? "",
    footerTagline: strings.templates["beauty-satin"]?.footerTagline ?? "",
  };
}

export function beautyRadianceDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["beauty-radiance"]?.hero?.eyebrow ?? "",
          heading: strings.templates["beauty-radiance"]?.hero?.heading ?? "",
          body: strings.templates["beauty-radiance"]?.hero?.body ?? "",
          ctaLabel: strings.templates["beauty-radiance"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["beauty-radiance"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["beauty-radiance"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["beauty-radiance"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["beauty-radiance"]?.productGrid?.viewAllHref ?? "",
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
              heading: strings.templates["beauty-radiance"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["beauty-radiance"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["beauty-radiance"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["beauty-radiance"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["beauty-radiance"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["beauty-radiance"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["beauty-radiance"]?.contact?.heading ?? "",
          body: strings.templates["beauty-radiance"]?.contact?.body ?? "",
          ctaLabel: strings.templates["beauty-radiance"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function beautyRadianceTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["beauty-radiance"]?.announcement ?? "",
    footerTagline: strings.templates["beauty-radiance"]?.footerTagline ?? "",
  };
}

export function beautyLuxeDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["beauty-luxe"]?.hero?.eyebrow ?? "",
          heading: strings.templates["beauty-luxe"]?.hero?.heading ?? "",
          body: strings.templates["beauty-luxe"]?.hero?.body ?? "",
          ctaLabel: strings.templates["beauty-luxe"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["beauty-luxe"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["beauty-luxe"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["beauty-luxe"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["beauty-luxe"]?.productGrid?.viewAllHref ?? "",
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
              heading: strings.templates["beauty-luxe"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["beauty-luxe"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["beauty-luxe"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["beauty-luxe"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
              heading: strings.templates["beauty-luxe"]?.trustBar?.itemThree?.heading ?? "",
              body: strings.templates["beauty-luxe"]?.trustBar?.itemThree?.body ?? "",
            },
          ],
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["beauty-luxe"]?.contact?.heading ?? "",
          body: strings.templates["beauty-luxe"]?.contact?.body ?? "",
          ctaLabel: strings.templates["beauty-luxe"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function beautyLuxeTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["beauty-luxe"]?.announcement ?? "",
    footerTagline: strings.templates["beauty-luxe"]?.footerTagline ?? "",
  };
}

export function beautyAuraDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["beauty-aura"]?.hero?.eyebrow ?? "",
          heading: strings.templates["beauty-aura"]?.hero?.heading ?? "",
          body: strings.templates["beauty-aura"]?.hero?.body ?? "",
          ctaLabel: strings.templates["beauty-aura"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["beauty-aura"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["beauty-aura"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["beauty-aura"]?.editorialSplit?.heading ?? "",
          body: strings.templates["beauty-aura"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["beauty-aura"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["beauty-aura"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["beauty-aura"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["beauty-aura"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["beauty-aura"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["beauty-aura"]?.contact?.heading ?? "",
          body: strings.templates["beauty-aura"]?.contact?.body ?? "",
          ctaLabel: strings.templates["beauty-aura"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function beautyAuraTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["beauty-aura"]?.announcement ?? "",
    footerTagline: strings.templates["beauty-aura"]?.footerTagline ?? "",
  };
}

export function beautyMuseDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.templates["beauty-muse"]?.hero?.eyebrow ?? "",
          heading: strings.templates["beauty-muse"]?.hero?.heading ?? "",
          body: strings.templates["beauty-muse"]?.hero?.body ?? "",
          ctaLabel: strings.templates["beauty-muse"]?.hero?.ctaLabel ?? "",
          ctaHref: strings.templates["beauty-muse"]?.hero?.ctaHref ?? "",
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "editorial-split",
        type: "editorial-split",
        settings: {
          eyebrow: strings.templates["beauty-muse"]?.editorialSplit?.eyebrow ?? "",
          heading: strings.templates["beauty-muse"]?.editorialSplit?.heading ?? "",
          body: strings.templates["beauty-muse"]?.editorialSplit?.body ?? "",
          ctaLabel: strings.templates["beauty-muse"]?.editorialSplit?.ctaLabel ?? "",
          ctaHref: strings.templates["beauty-muse"]?.editorialSplit?.ctaHref ?? "",
          imageKey: null,
        },
      },
      {
        id: "product-grid",
        type: "product-grid",
        settings: {
          heading: strings.templates["beauty-muse"]?.productGrid?.heading ?? "",
          viewAllLabel: strings.templates["beauty-muse"]?.productGrid?.viewAllLabel ?? "",
          viewAllHref: strings.templates["beauty-muse"]?.productGrid?.viewAllHref ?? "",
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
      {
        id: "contact",
        type: "contact",
        settings: {
          heading: strings.templates["beauty-muse"]?.contact?.heading ?? "",
          body: strings.templates["beauty-muse"]?.contact?.body ?? "",
          ctaLabel: strings.templates["beauty-muse"]?.contact?.ctaLabel ?? "",
        },
      },
    ],
  };
}

export function beautyMuseTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["beauty-muse"]?.announcement ?? "",
    footerTagline: strings.templates["beauty-muse"]?.footerTagline ?? "",
  };
}
