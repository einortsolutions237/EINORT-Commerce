import "server-only";

/**
 * The theming registry — EDIT-01's editor-side source of truth, and TMPL-02's
 * template table.
 *
 * `src/server/theming/schema.ts` says what a stored document MAY contain.
 * This file says how a human EDITS it, which template a new storefront starts
 * from, and which industry segments exist. Those are two lists of the same
 * field names living in two files, so they can drift — and drift here is
 * invisible at runtime until a merchant opens the settings panel and finds a
 * field that is not there. `tests/unit/theming-registry.test.ts` is the guard
 * that turns that into a red build (T-04-12).
 *
 * ---------------------------------------------------------------------------
 * SECTION AND BLOCK **TYPES** ARE BUILD-TIME CODE. INSTANCES ARE TENANT ROWS.
 * ---------------------------------------------------------------------------
 * ARCHITECTURE.md Anti-Pattern 3. This is not a runtime-authorable CMS and must
 * never grow into one. A merchant cannot invent a section type, and nothing in
 * this table is reachable by a write. Adding `"newsletter"` means editing the
 * Zod union, this registry and the renderer switch in one commit, with a
 * migration if a stored document shape changes — not inserting a row.
 *
 * The marker on line 1 is `server-only`, and the Server Actions directive is
 * the WRONG one here — deliberately not spelled out, because the audit for that
 * boundary is a plain grep and this header must not be the thing it finds.
 * A registry exports data and two pure narrowers, not async endpoints; the
 * actions directive would require every export to be an awaitable function
 * reachable by POST. The two markers are mutually exclusive, and the wrong one
 * is a build error rather than a subtle bug.
 *
 * ---------------------------------------------------------------------------
 * THE `Record` HERE IS FOR THE EDITOR ONLY.
 * ---------------------------------------------------------------------------
 * `SECTION_TYPES` is keyed by section type because the editor's value type is
 * homogeneous — every entry is `{ label, fields }`, so it can be indexed and
 * mapped over. The RENDERER may not work this way. The one exhaustive `switch`
 * in `src/app/s/[slug]/sections/section-renderer.tsx` (plan 04-08) is the only
 * place a type maps to a component, because TypeScript narrows
 * `section.settings` from `section.type` in a switch and cannot prove
 * `REGISTRY[section.type].Component` accepts `section.settings` in a lookup.
 * Do not "unify" the two by hanging a `Component` off the rows below — that
 * trades a compile error for a cast, and the cast is what lets a new section
 * type ship silently unrendered.
 *
 * ---------------------------------------------------------------------------
 * NO USER-FACING PROSE IN THIS FILE.
 * ---------------------------------------------------------------------------
 * Every `label` and `helper` below is a member expression into
 * `src/lib/strings.ts`. This is the same split `plans.ts`'s header states
 * ("marketing copy … belong in `src/lib/strings.ts`") and what
 * `tests/unit/dashboard-nav.test.ts`'s prose scan enforces for `.tsx`. That
 * scan does not reach a `.ts` file under `src/server/**`, which is precisely
 * why the rule is written down here: this registry is the one place the copy
 * would otherwise leak in unnoticed.
 *
 * Decisions recorded below: D-01 (industry is captured, not rendered from),
 * D-02 (the six segments), D-03 (template is independent of industry),
 * D-06 (content-only editing, six field kinds).
 */

import { strings } from "@/lib/strings";

import type { PlanTier } from "@/server/entitlements/plans";
import {
  SECTION_VARIANTS,
  type SectionType,
  type SectionVariantMap,
  type TemplateSectionRef,
} from "@/server/theming/schema";

// ---------------------------------------------------------------------------
// Field kinds
// ---------------------------------------------------------------------------

/**
 * The complete vocabulary of editor controls. Exactly six, and
 * `<FieldRenderer>` switches on this value.
 *
 * A SEVENTH KIND IS A CONTRACT CHANGE, NOT AN IMPLEMENTATION DETAIL. It goes
 * through `tests/unit/theming-registry.test.ts` (which pins that every
 * descriptor's `kind` is a member of this tuple) and 04-UI-SPEC.md § The six
 * field kinds, which specifies one control and one behavioural contract per
 * kind. Adding one here without the matching renderer arm produces a field the
 * merchant sees and cannot use.
 */
export const FIELD_KINDS = [
  "text",
  "textarea",
  "link",
  "image",
  "color",
  "select",
] as const;

export type FieldKind = (typeof FIELD_KINDS)[number];

/** One option in a `select` field. `value` is stored; `label` is read. */
export interface FieldOption {
  readonly value: string | number;
  readonly label: string;
}

/**
 * One editable field.
 *
 * `key` MUST match a key in that section's Zod settings shape. A descriptor
 * with no schema key throws a Zod error the moment the merchant touches it; a
 * schema key with no descriptor is invisible to the merchant forever. Both
 * directions are asserted by `tests/unit/theming-registry.test.ts`.
 *
 * `label`, `helper` and `options[].label` are REFERENCES into `strings`. See
 * the file header.
 */
export interface FieldDescriptor {
  readonly key: string;
  readonly kind: FieldKind;
  readonly label: string;
  readonly helper?: string;
  readonly options?: readonly FieldOption[];
}

/**
 * One section type's editor entry.
 *
 * `repeatable` names the settings key holding an array of blocks, when the
 * section has one. Where it is set, `fields` describes ONE ITEM of that array
 * and the settings panel repeats the list per block — it does not describe the
 * array itself. `trust-bar` is the only such type this phase (D-06), and the
 * drift test encodes that exception explicitly so the comparison it runs can
 * see through it.
 */
export interface SectionTypeDefinition {
  readonly label: string;
  readonly repeatable?: string;
  readonly fields: readonly FieldDescriptor[];
}

// ---------------------------------------------------------------------------
// Section types
// ---------------------------------------------------------------------------

/**
 * `Readonly<Record<SectionType, …>>` rather than a loose object: adding a sixth
 * member to the Zod discriminated union becomes a COMPILE error right here,
 * which is the same drift detection `ORDER_TRANSITIONS`, `TENANT_SCOPED_MODELS`
 * and `PLANS` provide. A lookup with a default would instead make the new type
 * silently uneditable — legal-looking, untested, and discovered by a merchant
 * whose section has no settings.
 *
 * FIELD ORDER IS THE RENDER ORDER. 04-UI-SPEC.md § Settings-panel view renders
 * `SECTION_TYPES[type].fields` "in order, exactly", so reordering this array is
 * a UI change, not a refactor.
 *
 * There is no `href` validation, no character cap and no required/optional flag
 * on a descriptor. Those live in `schema.ts` and nowhere else — a cap declared
 * in two places is a cap that disagrees with itself, and the schema is the one
 * a scripted POST actually meets.
 */
export const SECTION_TYPES: Readonly<
  Record<SectionType, SectionTypeDefinition>
> = {
  hero: {
    label: strings.editor.sectionLabels.hero,
    fields: [
      {
        key: "eyebrow",
        kind: "text",
        label: strings.editor.fieldLabels.eyebrow,
      },
      {
        key: "heading",
        kind: "text",
        label: strings.editor.fieldLabels.heading,
      },
      {
        key: "body",
        kind: "textarea",
        label: strings.editor.fieldLabels.body,
      },
      {
        key: "ctaLabel",
        kind: "text",
        label: strings.editor.fieldLabels.ctaLabel,
      },
      {
        key: "ctaHref",
        kind: "link",
        label: strings.editor.fieldLabels.ctaHref,
      },
      {
        key: "backgroundImageKey",
        kind: "image",
        label: strings.editor.fieldLabels.backgroundImageKey,
        helper: strings.editor.fieldHelpers.backgroundImageKey,
      },
      {
        key: "overlayOpacity",
        kind: "select",
        label: strings.editor.fieldLabels.overlayOpacity,
        helper: strings.editor.fieldHelpers.overlayOpacity,
        /*
         * Three steps, not a slider. The schema clamps 0…0.8; the values a
         * merchant can actually reach are these three, because the question is
         * "is my headline readable over this photo" and a continuous control
         * invites fiddling with a number that has no right answer.
         */
        options: [
          { value: 0, label: strings.editor.overlayOpacityOptions.none },
          { value: 0.3, label: strings.editor.overlayOpacityOptions.medium },
          { value: 0.6, label: strings.editor.overlayOpacityOptions.strong },
        ],
      },
    ],
  },

  "trust-bar": {
    label: strings.editor.sectionLabels["trust-bar"],
    /*
     * THE ONLY REPEATABLE SECTION THIS PHASE (D-06). `blocks` is a 1…4 array of
     * `trust-item` in the schema, so the descriptors below are the PER-ITEM
     * fields and the panel repeats them per block. Modelling `blocks` as a
     * scalar descriptor would make the drift test compare a descriptor list of
     * one against a schema shape of one and pass while describing nothing.
     *
     * The `type` discriminant is deliberately not a field: it is a literal the
     * schema fixes, not a choice the merchant makes.
     */
    repeatable: "blocks",
    fields: [
      {
        key: "icon",
        kind: "select",
        label: strings.editor.fieldLabels.icon,
        options: [
          { value: "truck", label: strings.editor.iconOptions.truck },
          {
            value: "shield-check",
            label: strings.editor.iconOptions["shield-check"],
          },
          { value: "clock", label: strings.editor.iconOptions.clock },
          {
            value: "message-circle",
            label: strings.editor.iconOptions["message-circle"],
          },
        ],
      },
      {
        key: "heading",
        kind: "text",
        label: strings.editor.fieldLabels.heading,
      },
      {
        key: "body",
        kind: "textarea",
        label: strings.editor.fieldLabels.body,
      },
    ],
  },

  "product-grid": {
    label: strings.editor.sectionLabels["product-grid"],
    fields: [
      {
        key: "heading",
        kind: "text",
        label: strings.editor.fieldLabels.heading,
      },
      {
        key: "viewAllLabel",
        kind: "text",
        label: strings.editor.fieldLabels.viewAllLabel,
      },
      {
        key: "viewAllHref",
        kind: "link",
        label: strings.editor.fieldLabels.viewAllHref,
      },
      {
        key: "itemCount",
        kind: "select",
        label: strings.editor.fieldLabels.itemCount,
        helper: strings.editor.fieldHelpers.itemCount,
        /*
         * 4 / 8 / 12 only, matching the schema's literal union. The grid's
         * column maths is laid out for these three; any other count leaves a
         * ragged final row at some breakpoint.
         */
        options: [
          { value: 4, label: strings.editor.itemCountOptions.four },
          { value: 8, label: strings.editor.itemCountOptions.eight },
          { value: 12, label: strings.editor.itemCountOptions.twelve },
        ],
      },
    ],
  },

  "editorial-split": {
    label: strings.editor.sectionLabels["editorial-split"],
    fields: [
      {
        key: "eyebrow",
        kind: "text",
        label: strings.editor.fieldLabels.eyebrow,
      },
      {
        key: "heading",
        kind: "text",
        label: strings.editor.fieldLabels.heading,
      },
      {
        key: "body",
        kind: "textarea",
        label: strings.editor.fieldLabels.body,
      },
      {
        key: "ctaLabel",
        kind: "text",
        label: strings.editor.fieldLabels.ctaLabel,
      },
      {
        key: "ctaHref",
        kind: "link",
        label: strings.editor.fieldLabels.ctaHref,
      },
      {
        key: "imageKey",
        kind: "image",
        label: strings.editor.fieldLabels.imageKey,
      },
    ],
  },

  contact: {
    label: strings.editor.sectionLabels.contact,
    fields: [
      {
        key: "heading",
        kind: "text",
        label: strings.editor.fieldLabels.heading,
      },
      {
        key: "body",
        kind: "textarea",
        label: strings.editor.fieldLabels.body,
      },
      {
        key: "ctaLabel",
        kind: "text",
        label: strings.editor.fieldLabels.ctaLabel,
      },
    ],
  },
};

export type SectionTypeKey = keyof typeof SECTION_TYPES;

// ---------------------------------------------------------------------------
// Theme fields
// ---------------------------------------------------------------------------

/**
 * The rail's `Brand & logo` entry — `themeTokensSchema`'s four keys plus the
 * logo.
 *
 * `logoKey` IS NOT PART OF `themeTokensSchema` AND MUST NOT BE ADDED TO IT.
 * The logo is a column on the organization (ONB-03), not a theme token, and the
 * tokens object is validated as a whole at three trust boundaries. It appears
 * here because the merchant edits it on the same panel, which is a UI grouping
 * and not a schema claim. The drift test knows about this one exception by
 * name.
 *
 * The three brand labels below come from `strings.branding` rather than
 * `strings.editor`: 04-UI-SPEC.md § The six field kinds makes this colour field
 * "identical to the onboarding colour field", so the merchant must read the
 * same words in both places. A second copy under `strings.editor` would be a
 * sentence free to drift from the one they already saw.
 */
export const THEME_FIELDS: readonly FieldDescriptor[] = [
  {
    key: "logoKey",
    kind: "image",
    label: strings.branding.logoCardTitle,
    helper: strings.branding.logoHelper,
  },
  {
    key: "primaryAccent",
    kind: "color",
    label: strings.branding.primaryAccentLabel,
    helper: strings.branding.primaryAccentCaption,
  },
  {
    key: "secondaryAccent",
    kind: "color",
    label: strings.branding.secondaryAccentLabel,
    helper: strings.branding.secondaryAccentCaption,
  },
  {
    key: "announcementText",
    kind: "text",
    label: strings.editor.fieldLabels.announcementText,
    helper: strings.editor.fieldHelpers.announcementText,
  },
  {
    key: "footerTagline",
    kind: "text",
    label: strings.editor.fieldLabels.footerTagline,
    helper: strings.editor.fieldHelpers.footerTagline,
  },
];

/** The one key on `THEME_FIELDS` that is not a `themeTokensSchema` member. */
export const THEME_NON_TOKEN_FIELD = "logoKey";

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const TEMPLATE_KEYS = ["flagship-fashion"] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export interface TemplateDefinition {
  readonly key: TemplateKey;
  /**
   * The industry segment this template was DESIGNED FOR — a property of the
   * template row, never a derivation from any merchant's
   * `Organization.industry`. D-03/D-05 still bind here unchanged: the Phase 5
   * picker sorts and pre-filters templates on this field and must always
   * offer a "show all" affordance, and there is no function anywhere — here
   * or in the picker — that maps an organization's industry to a template.
   * That mapping would recreate the exact auto-migration hole D-03 forbids
   * below, one level removed.
   */
  readonly segment: IndustrySegment;
  /**
   * D-06: the lowest plan tier that may SELECT this template from the
   * picker. Explicitly NOT a render gate — `variantsForTemplate()` and the
   * storefront renderer do not consult it. A merchant who downgrades after
   * choosing a template keeps rendering it forever (the D-12 corollary to
   * D-03's no-auto-migration rule): losing write access to the editor is not
   * the same as losing the storefront they already published.
   */
  readonly minTier: PlanTier;
  /**
   * The ordered section types a new storefront on this template ships with,
   * each paired with the variant IT renders in (D-02, TMPL-03/TMPL-04). A
   * `TemplateSectionRef` is a discriminated union, so a row cannot pair
   * `"hero"` with `"trust-bar"`'s `"strip"` variant and still compile.
   */
  readonly sections: readonly TemplateSectionRef[];
}

/**
 * The template table. Exactly one row this phase (TMPL-01).
 *
 * ---------------------------------------------------------------------------
 * D-03: A `templateKey` IS DELIBERATELY INDEPENDENT OF `Organization.industry`.
 * ---------------------------------------------------------------------------
 * There is no derivation from industry to template, here or anywhere, and there
 * must not be one. Phase 5 adds ROWS to this table and a picker that writes a
 * merchant's choice; it does not add a function that computes a template from
 * the segment they picked at onboarding. Two reasons, and both are permanent:
 *
 *   - A merchant's stored document is theirs. Deriving the template from a
 *     column they can change would let editing "what do you sell" silently
 *     restyle a storefront they have already published and shown customers.
 *   - NO MERCHANT IS EVER AUTO-MIGRATED. When Phase 5 ships a fashion-specific
 *     template, every merchant already on `flagship-fashion` stays on it until
 *     they choose otherwise. A backfill that "upgrades" live storefronts is a
 *     mass unannounced redesign of other people's businesses.
 *
 * D-01 is the same rule from the other side: the industry segment is CAPTURED
 * this phase and READ by Phase 5. Nothing in this phase's renderer consults it.
 *
 * No display name lives on a row yet — nothing renders a template's name until
 * Phase 5's picker exists, and a string nothing reads is a string nobody keeps
 * accurate. Phase 5 adds it to `strings` at the same time it adds the surface.
 */
export const TEMPLATES: Readonly<Record<TemplateKey, TemplateDefinition>> = {
  "flagship-fashion": {
    key: "flagship-fashion",
    segment: "fashion-apparel",
    minTier: "starter",
    /*
     * The order is LOCKED and is not alphabetical — see the header of
     * `src/server/theming/defaults.ts` for the background-treatment alternation
     * rule it encodes. `flagshipDefaultDocument()` builds against this list and
     * the drift test asserts the two agree.
     *
     * Every variant below is the FIRST entry of that section type's
     * `SECTION_VARIANTS` list — i.e. exactly Phase 4's design, unchanged by
     * this plan. `TEMPLATE_KEYS` stays a single row this plan; 05-08 grows it
     * to 50.
     */
    sections: [
      { type: "hero", variant: "full-bleed" },
      { type: "trust-bar", variant: "band" },
      { type: "product-grid", variant: "grid" },
      { type: "editorial-split", variant: "split" },
      { type: "contact", variant: "band" },
    ],
  },
};

const TEMPLATE_KEY_SET: ReadonlySet<string> = new Set(TEMPLATE_KEYS);

/** Narrows an untrusted value — a stored column, a form field — to a template. */
export function isTemplateKey(value: unknown): value is TemplateKey {
  return typeof value === "string" && TEMPLATE_KEY_SET.has(value);
}

/**
 * Resolves a (possibly untrusted) template key to a COMPLETE variant map.
 *
 * `Organization.draftTemplateKey`/`publishedTemplateKey` are `String?`
 * columns, so nothing at the type level stops one holding a value from a bad
 * backfill or a template retired in a later phase. This function is the one
 * place that drift is absorbed: for each section type it uses the variant
 * `TEMPLATES[key]` declares, if `key` is a real template AND that template
 * declares that section type, and otherwise the FIRST entry of
 * `SECTION_VARIANTS` for that type — the same degrade-don't-throw posture
 * `isIndustrySegment` documents above. An unrecognised key therefore renders
 * the all-first flagship map (T-05-02) instead of crashing a live storefront.
 *
 * MUST NEVER THROW AND MUST NEVER RETURN A PARTIAL MAP. Every section type in
 * `SECTION_VARIANTS` gets an entry regardless of what `key` resolves to,
 * which is what lets `SectionVariantMap` stay complete rather than `Partial`.
 */
export function variantsForTemplate(key: string): SectionVariantMap {
  const template = isTemplateKey(key) ? TEMPLATES[key] : undefined;

  const entries = (Object.keys(SECTION_VARIANTS) as SectionType[]).map(
    (type) => {
      const declared = template?.sections.find((ref) => ref.type === type);
      const variant = declared ? declared.variant : SECTION_VARIANTS[type][0];
      return [type, variant] as const;
    },
  );

  return Object.fromEntries(entries) as SectionVariantMap;
}

// ---------------------------------------------------------------------------
// Industry segments (D-02)
// ---------------------------------------------------------------------------

/**
 * The six segments a merchant picks from at `/onboarding/branding`, as a closed
 * set.
 *
 * The ids match `strings.branding.segments` key for key, so the tile grid reads
 * its label from the id it already holds rather than from a parallel array that
 * can fall out of order.
 */
export const INDUSTRY_SEGMENTS = [
  "fashion-apparel",
  "electronics",
  "beauty-cosmetics",
  "grocery-food",
  "furniture-home",
  "general-retail",
] as const;

export type IndustrySegment = (typeof INDUSTRY_SEGMENTS)[number];

/**
 * The lucide icon NAME for each segment's onboarding tile — a string, never a
 * component.
 *
 * A registry under `src/server/**` must not import React: this module is
 * `server-only` and pulling a component in would drag the icon library into
 * every server module that reads the segment list. The `.tsx` picker maps a
 * name to a component at its own boundary, which is also where the icon set is
 * verified (04-UI-SPEC.md § Onboarding).
 */
export const INDUSTRY_SEGMENT_ICONS: Readonly<Record<IndustrySegment, string>> =
  {
    "fashion-apparel": "shirt",
    electronics: "smartphone",
    "beauty-cosmetics": "sparkles",
    "grocery-food": "shopping-basket",
    "furniture-home": "sofa",
    "general-retail": "store",
  };

const SEGMENT_SET: ReadonlySet<string> = new Set(INDUSTRY_SEGMENTS);

/**
 * Narrows an untrusted value to a real segment (T-04-21).
 *
 * Copied from `isPlanTier` in `src/server/entitlements/plans.ts` deliberately,
 * body for body, because it guards the same shape of hole:
 * `Organization.industry` is a `String?` column and nothing at the type level
 * stops it holding `"fashion"`, `""` or a leftover from a bad backfill. Two
 * narrowers that resolve differently are two chances to be wrong, and the
 * second one is always the one nobody re-reads.
 *
 * Callers narrow BEFORE use. What an unknown value degrades to is the point of
 * D-01: nothing in this phase renders a template from the industry, so an
 * unrecognised string reads as "no segment selected" — the merchant is asked
 * again — rather than as an unrenderable storefront.
 */
export function isIndustrySegment(value: unknown): value is IndustrySegment {
  return typeof value === "string" && SEGMENT_SET.has(value);
}
