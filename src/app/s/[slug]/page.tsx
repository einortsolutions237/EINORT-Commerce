import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { env } from "@/env";
import { getPaymentSettings } from "@/server/payments/settings";
import { buildWhatsAppContactLink } from "@/server/payments/whatsapp";
// The product-listing query is imported under a local alias (`fetchProducts`)
// so it has exactly one call site in this file, named once here.
import {
  listStorefrontCategories,
  listStorefrontProducts as fetchProducts,
} from "@/server/storefront/queries";
import { getPublishedStorefront } from "@/server/theming/queries";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

import type { StorefrontRenderData } from "./sections/render-data";
import { SectionRenderer } from "./sections/section-renderer";

/**
 * The flagship home (TMPL-01 / EDIT-01 / D-05) — the merchant's PUBLISHED
 * document, rendered.
 *
 * ---------------------------------------------------------------------------
 * THE PHASE-3 HANDOVER IS DONE.
 * ---------------------------------------------------------------------------
 * This file used to carry the B1 catalogue grid inline plus the Phase-1
 * full-page placeholder, and its own header recorded the transition:
 * "Phase 4's Theme/Section/Block system replaces the RENDERED OUTPUT of the
 * non-empty branch — the zero-products branch, and its copy in
 * `strings.storefront`, are not touched by that replacement." That is what
 * happened. The grid moved verbatim into
 * `sections/product-grid-section.tsx` (plan 04-08); the empty copy is
 * UNCHANGED in `strings.storefront` and is now rendered by that section as an
 * in-section dashed block instead of by this page as a full-page state.
 *
 * The full-page placeholder is retired ON `/` and only on `/`. The page is no
 * longer empty when a store has no products — the hero, the trust bar, the
 * editorial band and the contact band are all there — so a centred paragraph on
 * white would now be a worse render than the one the section gives
 * (04-UI-SPEC.md § S3 → Empty). `strings.storefront.heading` / `.body` remain in
 * the catalogue for the surfaces that still want them.
 *
 * ---------------------------------------------------------------------------
 * `/` IS THE ONLY SECTION-RENDERED ROUTE (04-RESEARCH Pattern 12).
 * ---------------------------------------------------------------------------
 * The product detail page is FIXED for this phase (04-CONTEXT.md Addendum,
 * OQ-4). `/cart`, `/checkout` and `/order/[token]` are NEVER section-rendered,
 * in this phase or a later one: a merchant able to reorder or blank a checkout
 * section can break their own revenue path, and D-08's draft/publish cycle must
 * have no reachable interaction with order placement or order state. Brand
 * tokens still reach all of those routes — they are applied by the layout, not
 * by a section, which is the whole reason the chrome is theme settings.
 *
 * ---------------------------------------------------------------------------
 * ONE PRODUCT QUERY, STILL.
 * ---------------------------------------------------------------------------
 * There is deliberately exactly one call to the storefront product query in
 * this file. The same result drives what the grid renders and whether the
 * grid's empty block shows, filtered by `?category=` at the database layer. A
 * category with zero products falls through to the same in-section empty block
 * rather than a dedicated "nothing in this category" state — a narrow,
 * deliberate trade-off; 03-UI-SPEC.md's B1 contract is explicit that a second
 * empty state must not be authored.
 *
 * `getPublishedStorefront` is called here AND in the layout. It is `cache()`-
 * wrapped (plan 04-10, see that function's own note), so the pair dedupes to a
 * single lookup within one render pass. The Redis tenant cache was deliberately
 * NOT widened to carry theme data (T-04-28): that would make a published colour
 * change invisible for up to five minutes.
 *
 * The second `resolveTenantBySlug` call costs nothing for the same reason: the
 * layout above already made it and React's `cache()` dedupes both to a single
 * lookup. Re-resolving rather than threading the tenant down through props
 * keeps the gate and the read independent — this page cannot end up rendering
 * for a tenant the layout rejected.
 */

/**
 * The tab title is the STORE'S NAME now, not the placeholder heading.
 *
 * Phase 1 pinned a static `metadata` here because the page was a placeholder
 * and the title was true of it. This page renders a real published storefront,
 * so the placeholder heading in the browser tab and in a search result would be
 * a live store advertising itself as not yet open. `resolveTenantBySlug` is
 * `cache()`-wrapped, so asking for the tenant twice in one render pass is one
 * lookup — the same reason the page body re-resolves rather than being handed
 * the tenant by the layout. `{}` for an unresolved slug: the page itself
 * `notFound()`s, and returning a title for a tenant that does not serve would
 * confirm its absence differently from a suspended one (D-05).
 */
export async function generateMetadata({
  params,
}: PageProps<"/s/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  return tenant ? { title: tenant.name } : {};
}

export default async function StorefrontPage({
  params,
  searchParams,
}: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const categoryParam = sp.category;
  const categorySlug =
    typeof categoryParam === "string" && categoryParam !== ""
      ? categoryParam
      : undefined;

  const tenant = await resolveTenantBySlug(slug);

  // Unreachable in practice — the layout gates this subtree — but the check
  // is what makes that a type-level fact rather than an assumption.
  if (!tenant) notFound();

  const [published, categories, products, paymentSettings] = await Promise.all([
    getPublishedStorefront(tenant.id),
    listStorefrontCategories(tenant.id),
    fetchProducts(tenant.id, categorySlug),
    getPaymentSettings(tenant.id),
  ]);

  /*
   * THE ONE DATA BUNDLE EVERY SECTION RECEIVES (`sections/render-data.ts`).
   *
   * The query rows are mapped field by field rather than passed through. The
   * section components cannot import `StorefrontProductListItem` — that type
   * lives in a `server-only` module and everything under `sections/` has to stay
   * client-safe for the editor's preview canvas — so `render-data.ts` redeclares
   * the shapes structurally and THIS FILE is the one place that legitimately
   * sees both sides. A rename on the query side surfaces as a type error here.
   *
   * `whatsappHref` is built SERVER-SIDE, here, from the merchant's Phase 3
   * payment settings. The raw phone number never leaves this function: what goes
   * down the tree is a finished URL or `null`, because the normalisation rules
   * live in `src/server/payments/**` and a second, client-side spelling of them
   * is how two versions of a number drift apart. `null` means the contact
   * section renders with no CTA at all — never a dead one.
   *
   * `imageBaseUrl` is the validated env value, threaded down as a prop for the
   * same reason: `publicUrlFor()` is `server-only` and a section concatenates,
   * it never reads env.
   */
  const data: StorefrontRenderData = {
    imageBaseUrl: env.R2_PUBLIC_BASE_URL,
    storeName: tenant.name,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      priceXaf: product.priceXaf,
      imageKey: product.imageKey,
      inStock: product.inStock,
    })),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })),
    activeCategorySlug: categorySlug ?? null,
    whatsappHref: buildWhatsAppContactLink(
      paymentSettings?.whatsappNumber ?? null,
    ),
  };

  return (
    <main className="flex flex-1 flex-col">
      {/*
       * The document's own order, not a hardcoded one (D-05). `SectionRenderer`
       * is the single type-to-component switch and is exhaustive by construction
       * — a sixth section type is a compile error there, never a silently blank
       * band here.
       *
       * `key={section.id}` is set at this call site because this is the map, and
       * it is the only place React needs it.
       */}
      {published.document.sections.map((section) => (
        <SectionRenderer key={section.id} section={section} data={data} />
      ))}
    </main>
  );
}
