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
