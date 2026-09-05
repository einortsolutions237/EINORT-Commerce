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
          itemCount: DEFAULT_ITEM_COUNT,
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
          itemCount: DEFAULT_ITEM_COUNT,
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["electronics-signal"]?.announcement ?? "",
    footerTagline: strings.templates["electronics-signal"]?.footerTagline ?? "",
  };
}

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
              icon: "message-circle",
              heading: strings.templates["electronics-grid"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["electronics-grid"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
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
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

export function electronicsGridTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
              icon: "message-circle",
              heading: strings.templates["electronics-current"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["electronics-current"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
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
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

export function electronicsCurrentTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["electronics-current"]?.announcement ?? "",
    footerTagline: strings.templates["electronics-current"]?.footerTagline ?? "",
  };
}

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
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

export function electronicsPulseTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

export function electronicsVoltTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["electronics-volt"]?.announcement ?? "",
    footerTagline: strings.templates["electronics-volt"]?.footerTagline ?? "",
  };
}

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
              icon: "truck",
              heading: strings.templates["electronics-module"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["electronics-module"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["electronics-module"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["electronics-module"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
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
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

export function electronicsModuleTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
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
              icon: "truck",
              heading: strings.templates["electronics-frame"]?.trustBar?.itemOne?.heading ?? "",
              body: strings.templates["electronics-frame"]?.trustBar?.itemOne?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "message-circle",
              heading: strings.templates["electronics-frame"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["electronics-frame"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
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
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

export function electronicsFrameTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["electronics-frame"]?.announcement ?? "",
    footerTagline: strings.templates["electronics-frame"]?.footerTagline ?? "",
  };
}

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
          itemCount: DEFAULT_ITEM_COUNT,
        },
      },
    ],
  };
}

export function electronicsByteTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["electronics-byte"]?.announcement ?? "",
    footerTagline: strings.templates["electronics-byte"]?.footerTagline ?? "",
  };
}
