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
          itemCount: DEFAULT_ITEM_COUNT,
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
              icon: "message-circle",
              heading: strings.templates["furniture-loom"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-loom"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-loom"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-loom"]?.footerTagline ?? "",
  };
}

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
          itemCount: DEFAULT_ITEM_COUNT,
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
              icon: "message-circle",
              heading: strings.templates["furniture-grain"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-grain"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-grain"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-grain"]?.footerTagline ?? "",
  };
}

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
              icon: "message-circle",
              heading: strings.templates["furniture-oak"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-oak"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-oak"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-oak"]?.footerTagline ?? "",
  };
}

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
              icon: "message-circle",
              heading: strings.templates["furniture-hearth"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-hearth"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-hearth"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-hearth"]?.footerTagline ?? "",
  };
}

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
              icon: "message-circle",
              heading: strings.templates["furniture-timber"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-timber"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
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
          itemCount: DEFAULT_ITEM_COUNT,
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-timber"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-timber"]?.footerTagline ?? "",
  };
}

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
              icon: "message-circle",
              heading: strings.templates["furniture-haven"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-haven"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
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
          itemCount: DEFAULT_ITEM_COUNT,
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-haven"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-haven"]?.footerTagline ?? "",
  };
}

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
              icon: "message-circle",
              heading: strings.templates["furniture-nook"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-nook"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
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
          itemCount: DEFAULT_ITEM_COUNT,
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-nook"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-nook"]?.footerTagline ?? "",
  };
}

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
              icon: "message-circle",
              heading: strings.templates["furniture-loft"]?.trustBar?.itemTwo?.heading ?? "",
              body: strings.templates["furniture-loft"]?.trustBar?.itemTwo?.body ?? "",
            },
            {
              type: "trust-item",
              icon: "shield-check",
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
          itemCount: DEFAULT_ITEM_COUNT,
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
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.templates["furniture-loft"]?.announcement ?? "",
    footerTagline: strings.templates["furniture-loft"]?.footerTagline ?? "",
  };
}
