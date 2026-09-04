import { z } from "zod";

/**
 * ---------------------------------------------------------------------------
 * THIS FILE DELIBERATELY CARRIES NO `server-only` MARKER. DO NOT ADD ONE.
 * ---------------------------------------------------------------------------
 * `src/app/s/[slug]/preview/preview-canvas.tsx` is a client component and it
 * MUST validate the postMessage payload with `pageDocumentSchema` before any
 * state update (Pitfall 4, T-04-08). A `server-only` import here breaks that
 * build. The Server Actions directive is equally wrong: this module exports
 * schemas, not async endpoints. There are no secrets and no data access — it is
 * Zod and nothing else, which is precisely why the marker is unnecessary as
 * well as harmful.
 *
 * EDIT-01. This is the single validation boundary that three separate trust
 * boundaries all narrow through:
 *
 *   1. `StorefrontPage.draft` / `.published` (JSONB) — a direct POST to a
 *      theming Server Action, and any historical row a backfill wrote.
 *   2. The `postMessage` payload the preview iframe receives — untrusted
 *      structured-clone data from whatever page happens to frame it.
 *   3. The publish gate — draft is copied to published only if it parses.
 *
 * None of the three has a second check downstream, so every `.min`, `.max` and
 * `.regex` below is the last thing standing between a hostile value and either
 * a rendered stylesheet or a live storefront.
 *
 * NO TENANT IDENTIFIER FIELD APPEARS ANYWHERE IN THIS FILE, AND NONE MAY BE
 * ADDED (T-04-04). `merchantAction` resolves the tenant from the session before
 * a handler runs and `scopedDb` stamps it last; a tenant field in a document
 * schema is exactly the retargeting vector that architecture exists to prevent.
 * The audit for that boundary is a plain grep, so this file deliberately does
 * not spell the column name in prose either.
 *
 * EDIT-01 names three doors above. Phase 5 (TMPL-03/TMPL-04, D-02) adds a
 * FOURTH, narrower one: `sectionVariantsSchema` validates the per-section
 * rendering-variant map carried on the `postMessage` payload only. It is
 * deliberately NOT folded into `pageDocumentSchema` — a variant is a property
 * of the template a storefront is built on, not of the document a merchant
 * edits, so a direct POST to `saveDraft`/`discardDraft` can never set one. See
 * `sectionVariantsSchema`'s own comment below for the full rationale.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Hex only, six digits, anchored at both ends.
 *
 * THIS REGEX IS A SECURITY CONTROL, NOT A FORMATTING NICETY (Pitfall 3,
 * T-04-09, ASVS V5). The value that clears it is written verbatim into a CSS
 * custom property, and React sets custom properties through `setProperty`,
 * which does not sanitise. An unanchored or keyword-tolerant pattern would let
 * `red; background-image: url(https://evil/x)` through into a stylesheet.
 *
 * Three-digit shorthand is given up deliberately: `<input type="color">` emits
 * `#rrggbb` and nothing else, so shorthand is never a real user — widening the
 * pattern buys no capability and costs the anchor's guarantee.
 */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour.");

/**
 * An R2 derivative PREFIX, never a URL — the same convention
 * `ProductImage.storageKey` already stores.
 *
 * A key is combined with `R2_PUBLIC_BASE_URL` at render time, so accepting an
 * absolute URL here would let a document point the storefront's `<Image>` at an
 * arbitrary host. The `tenants/` anchor and the character classes together also
 * refuse `..`: a traversal segment cannot match `[A-Za-z0-9_-]+`.
 */
export const storageKeySchema = z
  .string()
  .regex(
    /^tenants\/[A-Za-z0-9_-]+\/(products|logos)\/[a-z0-9-]{8,64}$/,
    "Not a storage key.",
  );

// ---------------------------------------------------------------------------
// Section settings — one module-level object per type
// ---------------------------------------------------------------------------
//
// The character caps are the ones 04-UI-SPEC.md § S1-S5 sets against the type
// scale, enforced here rather than in the editor's inputs. A `maxLength` on an
// input is a courtesy to someone typing; this is what a scripted POST meets.

/** S1. `overlayOpacity` is clamped 0…0.8: above 0.8 the photo is gone. */
const heroSettings = z.object({
  eyebrow: z.string().max(60),
  heading: z.string().min(1).max(120),
  body: z.string().max(280),
  ctaLabel: z.string().min(1).max(30),
  ctaHref: z.string().max(200),
  backgroundImageKey: storageKeySchema.nullable(),
  overlayOpacity: z.number().min(0).max(0.8),
});

/**
 * S2. The icon set is a CLOSED enum, not a free string: the renderer maps it to
 * a `lucide-react` import, and an unknown name there is a runtime crash on a
 * public page rather than a missing glyph.
 */
const trustBarSettings = z.object({
  blocks: z
    .array(
      z.object({
        type: z.literal("trust-item"),
        icon: z.enum(["truck", "shield-check", "clock", "message-circle"]),
        heading: z.string().min(1).max(48),
        body: z.string().max(140),
      }),
    )
    .min(1)
    .max(4),
});

/**
 * S3. `itemCount` is a union of literals rather than `z.number().min(4)`,
 * because the grid's column maths is only laid out for 4 / 8 / 12 — any other
 * value leaves a ragged final row at some breakpoint.
 */
const productGridSettings = z.object({
  heading: z.string().min(1).max(80),
  viewAllLabel: z.string().min(1).max(30),
  viewAllHref: z.string().max(200),
  itemCount: z.union([z.literal(4), z.literal(8), z.literal(12)]),
});

/** S4. `imageKey` nullable: with no image the section collapses to one column. */
const editorialSplitSettings = z.object({
  eyebrow: z.string().max(60),
  heading: z.string().min(1).max(120),
  body: z.string().max(280),
  ctaLabel: z.string().min(1).max(30),
  ctaHref: z.string().max(200),
  imageKey: storageKeySchema.nullable(),
});

/** S5. Deliberately not a newsletter — there is no email backend in V1. */
const contactSettings = z.object({
  heading: z.string().min(1).max(80),
  body: z.string().max(280),
  ctaLabel: z.string().min(1).max(30),
});

// ---------------------------------------------------------------------------
// The document graph
// ---------------------------------------------------------------------------

/**
 * THE discriminated union, and the reason this is a union rather than a
 * `Record<string, { schema, Component }>` registry.
 *
 * TypeScript narrows `section.settings` from `section.type`, so
 * `SectionRenderer`'s switch needs no cast — a `Record`-keyed registry cannot be
 * mapped over without one, because TypeScript cannot prove
 * `REGISTRY[section.type].Component` accepts `section.settings`. Adding a
 * section type here then becomes a COMPILE error at every incomplete switch in
 * the codebase, which is the same drift detection `ORDER_TRANSITIONS` and
 * `TENANT_SCOPED_MODELS` provide. A lookup-with-default would instead make the
 * new type silently unrendered: legal-looking, untested, and discovered by a
 * merchant whose section does not appear.
 *
 * D-05: membership is fixed. A type outside this list — `"newsletter"`, say —
 * is refused rather than ignored, at all three doors.
 */
export const sectionInstanceSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("hero"), settings: heroSettings }),
  z.object({
    id: z.string(),
    type: z.literal("trust-bar"),
    settings: trustBarSettings,
  }),
  z.object({
    id: z.string(),
    type: z.literal("product-grid"),
    settings: productGridSettings,
  }),
  z.object({
    id: z.string(),
    type: z.literal("editorial-split"),
    settings: editorialSplitSettings,
  }),
  z.object({
    id: z.string(),
    type: z.literal("contact"),
    settings: contactSettings,
  }),
]);

/**
 * The whole page, as stored and as posted.
 *
 * `version` is `z.literal(1)` and not `z.number()` on purpose (Pitfall 9,
 * T-04-12): renaming a settings key is a MIGRATION, not an edit. A literal
 * turns a shape mismatch into a refused parse the storefront read path can
 * degrade from, instead of a silent misread that renders wrong copy. Bump it
 * and write a backfill; do not widen it.
 *
 * THE ARRAY INDEX IS THE ORDER. There is no `position` field, here or in the
 * editor state — two representations of one ordering is how they drift.
 * `.min(1)` because a zero-section document is a blank page no merchant should
 * be able to reach through any door; `.max(12)` is a size bound on an untrusted
 * body, not a product limit (D-05 fixes the real list at five).
 */
export const pageDocumentSchema = z.object({
  version: z.literal(1),
  sections: z.array(sectionInstanceSchema).min(1).max(12),
});

/**
 * The merchant's brand tokens, stored on `StorefrontTheme.draftTokens` /
 * `.publishedTokens`.
 *
 * Only the two accents are colours, and both go through `hexColorSchema` for
 * the reason stated there. The foreground and ring values are NOT stored — they
 * are derived by `src/lib/theme-defaults.ts` so a merchant cannot pick an
 * unreadable pair (D-11).
 */
export const themeTokensSchema = z.object({
  primaryAccent: hexColorSchema,
  secondaryAccent: hexColorSchema,
  announcementText: z.string().max(120),
  footerTagline: z.string().max(160),
});

// ---------------------------------------------------------------------------
// Types — inferred, never hand-written, so they cannot disagree with the parse
// ---------------------------------------------------------------------------

export type SectionInstance = z.infer<typeof sectionInstanceSchema>;
export type SectionType = SectionInstance["type"];
export type PageDocument = z.infer<typeof pageDocumentSchema>;
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

// ---------------------------------------------------------------------------
// Rendering variants (TMPL-03, TMPL-04, D-02)
// ---------------------------------------------------------------------------
//
// A section TYPE is what a document instance is ("hero"); a VARIANT is how a
// template renders it ("full-bleed" vs "split" vs "stack"). Phase 4 shipped
// exactly one rendering per type. Phase 5 gives every type a closed, typed
// list of variants a template row can select from, so pairing a section type
// with another type's variant — "hero" rendered as "dense" — is a compile
// error, not a runtime crash on a public storefront.
//
// 05-RESEARCH.md Finding 1: this vocabulary belongs HERE, in the marker-free
// schema module, and not in `src/server/theming/registry.ts`. The registry
// carries `import "server-only"` on line 1; the variant type is read by
// `src/app/s/[slug]/sections/section-renderer.tsx` and every section
// component beneath it, none of which may import a server-only module
// (T-04-24). Putting the vocabulary in the registry is "the single most
// likely wrong turn in this phase, and it fails at *build* time on the
// editor route" — this module is where it must live instead.

/**
 * The closed, per-section-type list of rendering variants a template row may
 * select from. The FIRST entry of every list is the flagship's current
 * rendering (Phase 4's design) and is the degraded-read default every
 * unrecognised template key falls back to — see `variantsForTemplate()` in
 * `src/server/theming/registry.ts`.
 *
 * `as const satisfies Readonly<Record<SectionType, …>>` rather than a plain
 * object literal: adding a sixth `SectionType` member becomes a COMPILE error
 * right here, the same drift detection `INDUSTRY_SEGMENTS` /
 * `INDUSTRY_SEGMENT_ICONS` provide in `registry.ts`. `satisfies` is used
 * instead of a type annotation so the literal string values are preserved
 * (a `: Readonly<Record<…>>` annotation would widen every entry to
 * `readonly string[]`, and `SectionVariant<T>` below needs the literal union,
 * not `string`).
 */
export const SECTION_VARIANTS = {
  hero: ["full-bleed", "split", "stack"],
  "trust-bar": ["band", "strip"],
  "product-grid": ["grid", "dense", "showcase"],
  "editorial-split": ["split", "banner"],
  contact: ["band", "card"],
} as const satisfies Readonly<
  Record<SectionType, readonly [string, string, ...string[]]>
>;

/** The closed set of variants one section type may render as. */
export type SectionVariant<T extends SectionType> =
  (typeof SECTION_VARIANTS)[T][number];

/**
 * The variant every section type renders in, for one resolved template.
 *
 * COMPLETE, NEVER `Partial`. A `Partial<…>` would widen every renderer read
 * to `SectionVariant<T> | undefined` and force the `?? "full-bleed"`
 * lookup-with-a-default shape `section-renderer.tsx`'s header bans — the same
 * failure mode that file's own comment names for a `Record`-keyed component
 * registry. `variantsForTemplate()` is the one function that produces this
 * type, and it always produces a complete map, degrading a missing entry to
 * that type's own first variant rather than omitting the key.
 */
export type SectionVariantMap = {
  readonly [K in SectionType]: SectionVariant<K>;
};

/**
 * One row of a template's `sections` list: a section type PLUS the variant it
 * renders in, as a single discriminated union rather than two independent
 * fields.
 *
 * `{ type: K; variant: SectionVariant<K> }` mapped over every `K` and indexed
 * back out by `SectionType` is what makes the pairing exhaustive: TypeScript
 * narrows `variant` from `type` the same way `sectionInstanceSchema` narrows
 * `settings` from `type`, so `{ type: "hero", variant: "dense" }` (a real
 * variant, just not `hero`'s) is a compile error instead of a value that
 * parses and then renders nothing recognisable. A plain
 * `{ type: SectionType; variant: string }` shape would accept that pairing
 * silently.
 */
export type TemplateSectionRef = {
  [K in SectionType]: { readonly type: K; readonly variant: SectionVariant<K> };
}[SectionType];

/**
 * The FOURTH trust boundary this file validates (see the file header):
 * `postMessage` only, and DELIBERATELY NOT a member of `pageDocumentSchema`.
 *
 * A section's rendering variant is a property of the TEMPLATE, not of the
 * document a merchant edits (D-02) — the picker in
 * `src/components/theming/template-picker.tsx` sets it by choosing a
 * template, and `switchTemplate` in `src/server/theming/actions.ts` is the
 * only write path. Folding this schema into `pageDocumentSchema` would make a
 * variant reachable from `saveDraft`'s direct-POST surface, which turns
 * "pick a template" into "pick any variant of any section, independent of any
 * template that declares that combination" — a merchant-editable field this
 * decision explicitly refuses. `preview-canvas.tsx`'s `safeParse` step
 * validates a payload's `variants` field with this schema before any state
 * update, exactly as it already does for `pageDocumentSchema` and
 * `themeTokensSchema`.
 */
export const sectionVariantsSchema = z.object({
  hero: z.enum(SECTION_VARIANTS.hero),
  "trust-bar": z.enum(SECTION_VARIANTS["trust-bar"]),
  "product-grid": z.enum(SECTION_VARIANTS["product-grid"]),
  "editorial-split": z.enum(SECTION_VARIANTS["editorial-split"]),
  contact: z.enum(SECTION_VARIANTS.contact),
});

// ---------------------------------------------------------------------------
// The caps, read back out
// ---------------------------------------------------------------------------

/**
 * THE CAPS ARE READ OUT OF THE SCHEMAS ABOVE, NEVER RESTATED BESIDE THEM.
 *
 * 04-UI-SPEC.md § The six field kinds gives every `text` and `textarea` field a
 * `{n}/{max}` counter that turns `text-destructive` at the cap, and
 * `<SettingsPanel>` takes those numbers as a `maxima` prop (plan 04-12). The
 * numbers have to come from somewhere, and the two obvious somewheres are both
 * wrong:
 *
 *   - A hand-written table in the registry or the editor page is the same
 *     failure mode `src/server/theming/registry.ts`'s header names for field
 *     keys, one level down. A cap written twice is a cap free to disagree with
 *     itself, and the copy that disagrees is always the one the merchant sees:
 *     a counter reading `120` over an input the server refuses at `80`.
 *   - Putting a `max` on each `FieldDescriptor` moves the same duplication into
 *     the registry, where that file's own header explicitly refuses it
 *     ("There is no `href` validation, no character cap … on a descriptor.
 *     Those live in `schema.ts` and nowhere else").
 *
 * So this reads Zod's own metadata. `maxLength` is a public getter on
 * `ZodString`, so nothing below reaches into `_zod`; an array is detected by
 * its equally public `element`. The cost of the reflection is that a field
 * whose cap moves inside a wrapper — `.nullable()`, today — reports no cap. That
 * is correct rather than merely tolerable here: the only nullable settings are
 * `backgroundImageKey` and `imageKey`, both `image` fields, and an image field
 * has no counter to drive.
 *
 * Called from a Server Component per render. The document has five sections and
 * the deepest walk is two levels, so memoizing it would cost more to explain
 * than it saves.
 */

/** A Zod node that may carry a string cap. Structural, so no import widens. */
type MaybeCapped = {
  readonly maxLength?: number | null;
  readonly element?: { readonly shape?: Record<string, unknown> };
};

/**
 * Every capped string key in a Zod object shape, flattened.
 *
 * An ARRAY IS WALKED INTO RATHER THAN MEASURED, and the order of the two
 * branches below is what makes that true: `z.array(…).max(4)` also answers
 * `maxLength`, so reading the cap first would report "4" for `trust-bar`'s
 * `blocks` and never reach the per-block `heading` and `body` the panel
 * actually renders. `SECTION_TYPES["trust-bar"].fields` describes ONE ITEM of
 * that array (see the registry), so the item's keys are the keys the panel
 * looks up — flattening is the shape the caller needs, and there is no
 * collision to worry about because a repeatable section's settings hold the
 * array and nothing else.
 */
function collectCaps(
  shape: Record<string, unknown>,
  into: Record<string, number>,
): void {
  for (const [key, field] of Object.entries(shape)) {
    const node = field as MaybeCapped;

    const elementShape = node.element?.shape;
    if (elementShape !== undefined) {
      collectCaps(elementShape, into);
      continue;
    }

    if (typeof node.maxLength === "number") into[key] = node.maxLength;
  }
}

/**
 * The `{n}/{max}` counters for one section type's settings panel.
 *
 * The union is searched rather than indexed because a discriminated union is
 * not a `Record` — the same reason `SectionRenderer` is a switch. A type with no
 * capped field returns `{}`, which the panel reads as "no counters", so the
 * lookup cannot fail loudly for a caller that passes a legitimate type.
 */
export function sectionFieldMaxima(type: SectionType): Record<string, number> {
  const option = sectionInstanceSchema.options.find(
    (candidate) => candidate.shape.type.value === type,
  );
  if (option === undefined) return {};

  const maxima: Record<string, number> = {};
  collectCaps(option.shape.settings.shape, maxima);
  return maxima;
}

/**
 * The same, for the rail's `Brand & logo` panel.
 *
 * `logoKey` is deliberately absent: it is not a `themeTokensSchema` member at
 * all (the registry's `THEME_NON_TOKEN_FIELD` says why), and it is an `image`
 * field, so it has no counter either way.
 */
export function themeFieldMaxima(): Record<string, number> {
  const maxima: Record<string, number> = {};
  collectCaps(themeTokensSchema.shape, maxima);
  return maxima;
}
