/**
 * ---------------------------------------------------------------------------
 * EVERYTHING UNDER `sections/` IS CLIENT-SAFE. NEVER PULL A `server-only`
 * MODULE INTO THIS FILE, OR INTO ANY SIBLING FILE.
 * ---------------------------------------------------------------------------
 * TMPL-01 / TMPL-02, T-04-24.
 *
 * `src/app/s/[slug]/preview/preview-canvas.tsx` is a `"use client"` component
 * that renders these same section components inside the editor's iframe. It
 * reaches them through `section-renderer.tsx`, which pulls in EVERY section,
 * so a single `server-only` module anywhere in this directory is not a lint
 * warning — it is a build failure on the editor route, discovered two plans
 * later by someone who did not write it.
 *
 * That is why this file redeclares the shapes it needs STRUCTURALLY rather
 * than re-exporting `StorefrontProductListItem` and `StorefrontCategory` from
 * `src/server/storefront/queries.ts`. The duplication is the point: it is the
 * cheapest possible barrier, and a type-only reference cannot accidentally
 * cross it. The field names below are copied from what
 * `src/app/s/[slug]/page.tsx` already consumes, so a rename on the query side
 * surfaces as a type error at the RSC that assembles this bundle — the one
 * place that legitimately sees both sides.
 *
 * THIS MODULE REFERENCES NOTHING AND MUST KEEP REFERENCING NOTHING. It is
 * types and nothing else; it emits no runtime code at all, which is what lets
 * both the RSC tree and the client preview canvas depend on it without either
 * paying for the other.
 *
 * The one cross-boundary module permitted anywhere under `sections/` is
 * `src/server/theming/schema.ts`, which plan 04-02 deliberately built
 * marker-free for exactly this reason. Nothing else from the server tree — not
 * `theming/registry`, not `theming/defaults`, not `images/r2`, not
 * `storefront/queries`.
 */

/**
 * One product tile's worth of data.
 *
 * `imageKey` is an R2 derivative PREFIX (`tenants/…/products/…`), never a URL —
 * the same convention `ProductImage.storageKey` stores and `storageKeySchema`
 * validates. A section builds a `src` by joining it to `imageBaseUrl` and a
 * derivative label; it never receives an assembled URL, because a URL in this
 * position is an arbitrary host in `next/image`'s hands.
 *
 * `inStock` is a resolved boolean, not a stock count: D-09 says an
 * out-of-stock tile stays in the grid and dims, so the number is never
 * rendered and shipping it would leak inventory levels to a public page.
 */
export type StorefrontRenderProduct = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  /** The minimum active-variant price override, or the product's base price. */
  readonly priceXaf: number;
  readonly imageKey: string | null;
  readonly inStock: boolean;
};

/** A category filter chip's worth of data (D-06). */
export type StorefrontRenderCategory = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
};

/**
 * THE data contract every flagship section receives, assembled once by the RSC
 * and passed straight through `section-renderer.tsx`.
 *
 * One bundle rather than per-section props because the section list is
 * reorderable (D-05): a renderer that mapped each section type to its own
 * fetch would make the order of the array decide which queries run.
 *
 * Two fields are pre-resolved SERVER-side on purpose:
 *
 *   - `imageBaseUrl` is `R2_PUBLIC_BASE_URL`. `publicUrlFor()` lives in
 *     `src/server/images/r2.ts`, which carries `server-only`, so the base is
 *     threaded down as a prop exactly as `image-gallery-field.tsx` already
 *     does it. A section concatenates; it never reads env.
 *   - `whatsappHref` is a fully-built `wa.me` deep link, or `null` when the
 *     merchant has configured no number. It is built server-side (plan 04-10)
 *     from the Phase 3 payment settings and is NEVER assembled from a raw
 *     phone number in a client component — the formatting rules live in
 *     `src/server/payments/**` and a second, client-side implementation of
 *     them is how the two spellings drift. `null` means the contact section
 *     renders heading and body with NO CTA; never a dead or disabled button.
 */
export type StorefrontRenderData = {
  readonly imageBaseUrl: string;
  readonly storeName: string;
  readonly products: readonly StorefrontRenderProduct[];
  readonly categories: readonly StorefrontRenderCategory[];
  /** The active `?category=` filter, or `null` for "All". */
  readonly activeCategorySlug: string | null;
  readonly whatsappHref: string | null;
};
