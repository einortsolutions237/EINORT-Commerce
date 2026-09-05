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
              icon: "shield-check",
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
          itemCount: DEFAULT_ITEM_COUNT,
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
              icon: "truck",
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
              icon: "shield-check",
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
          itemCount: DEFAULT_ITEM_COUNT,
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
              icon: "truck",
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
              icon: "shield-check",
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
              icon: "truck",
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
              icon: "shield-check",
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
              icon: "truck",
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
              icon: "shield-check",
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
              heading: strings.templates["retail-market"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["retail-market"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["retail-market"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["retail-market"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
              icon: "shield-check",
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

export function retailDistrictTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["retail-district"]?.announcement ?? "",
    footerTagline: strings.templates["retail-district"]?.footerTagline ?? "",
  };
}
