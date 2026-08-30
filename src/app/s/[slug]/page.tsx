import type { Metadata } from "next";
import { ImageOffIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { publicUrlFor } from "@/server/images/r2";
// The product-listing query is imported under a local alias (`fetchProducts`)
// so it has exactly one call site in this file, named once here.
import {
  listStorefrontCategories,
  listStorefrontProducts as fetchProducts,
} from "@/server/storefront/queries";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

import { StoreHeader } from "./store-header";

/**
 * The B1 catalog grid (CHK-01 / D-09) — and the zero-active-products branch
 * of the Phase-1 placeholder's permanent home.
 *
 * RESEARCH.md's Open Question 2 (resolved in 03-09) settled the transition
 * this page makes: Phase 3 makes it conditional on the active-product query's
 * result, and Phase 4's Theme/Section/Block system replaces the RENDERED
 * OUTPUT of the non-empty branch — the zero-products branch, and its copy in
 * `strings.storefront`, are not touched by that replacement. There is
 * deliberately only one call to the storefront product query in this file
 * (see this plan's acceptance criteria): the same result drives both "is the
 * store empty" and "what renders in the grid", filtered by `?category=` at
 * the database layer. A category with zero products currently falls through
 * to this same placeholder rather than a dedicated "nothing in this
 * category" state — a narrow, deliberate trade-off, not an oversight;
 * 03-UI-SPEC.md's B1 contract is explicit that a second empty state must not
 * be authored.
 *
 * The second `resolveTenantBySlug` call costs nothing: the layout above
 * already made it and React's `cache()` dedupes both to a single lookup
 * within one render pass. Re-resolving rather than threading the tenant down
 * through props keeps the gate and the read independent — this page cannot
 * end up rendering for a tenant the layout rejected.
 */

export const metadata: Metadata = {
  // Static on purpose — see the placeholder branch below; a live store's
  // metadata is genuinely dynamic and Phase 4 owns that surface.
  title: strings.storefront.heading,
};

const currency = new Intl.NumberFormat("fr-CM", {
  style: "currency",
  currency: "XAF",
  maximumFractionDigits: 0,
});

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

  const [categories, products] = await Promise.all([
    listStorefrontCategories(tenant.id),
    fetchProducts(tenant.id, categorySlug),
  ]);

  if (products.length === 0) {
    return (
      <>
        <StoreHeader slug={slug} tenantId={tenant.id} storeName={tenant.name} />
        <main className="flex flex-1 flex-col items-center justify-center px-8 py-16">
          <div className="flex max-w-prose flex-col items-center text-center">
            {/* Label role: 14px / 600 / 1.4. The store's own name, proving the read reached Postgres. */}
            <p className="text-sm leading-snug font-semibold tracking-wide text-muted-foreground uppercase">
              {tenant.name}
            </p>

            {/* Heading role: 24px / 600 / 1.2 */}
            <h1 className="mt-4 text-2xl leading-tight font-semibold tracking-tight text-foreground">
              {strings.storefront.heading}
            </h1>

            {/* Body role: 16px / 400 / 1.5 */}
            <p className="mt-4 text-base leading-normal font-normal text-muted-foreground">
              {strings.storefront.body}
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <StoreHeader slug={slug} tenantId={tenant.id} storeName={tenant.name} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 md:px-8">
        {categories.length >= 2 && (
          <nav
            aria-label={strings.catalog.allCategories}
            className="mb-4 flex gap-2 overflow-x-auto pb-2"
          >
            <Link
              href={`/s/${slug}`}
              className={cn(
                "shrink-0 rounded-full border border-border px-3 py-1.5 text-sm leading-snug font-semibold tracking-[0.08em] uppercase",
                !categorySlug
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground",
              )}
            >
              {strings.catalog.allCategories}
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/s/${slug}?category=${category.slug}`}
                className={cn(
                  "shrink-0 rounded-full border border-border px-3 py-1.5 text-sm leading-snug font-semibold tracking-[0.08em] uppercase",
                  categorySlug === category.slug
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground",
                )}
              >
                {category.name}
              </Link>
            ))}
          </nav>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/s/${slug}/p/${product.slug}`}
              className="group flex flex-col"
            >
              <div className="relative aspect-square overflow-hidden rounded bg-muted">
                {product.imageKey ? (
                  <Image
                    src={publicUrlFor(`${product.imageKey}/card.webp`)}
                    alt={product.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                    className={cn(
                      "object-cover",
                      // D-09: the image is dimmed, never the tile removed and
                      // never the link disabled.
                      !product.inStock && "opacity-60",
                    )}
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    aria-hidden="true"
                  >
                    <ImageOffIcon className="size-8 text-muted-foreground" />
                  </div>
                )}

                {!product.inStock && (
                  <Badge
                    variant="outline"
                    className="absolute top-2 left-2 border-border bg-background text-xs leading-none font-semibold tracking-[0.08em] text-foreground uppercase"
                  >
                    {strings.catalog.outOfStock}
                  </Badge>
                )}
              </div>

              {/* Body role, 2-line clamp. */}
              <p className="mt-2 line-clamp-2 text-base leading-normal font-normal text-foreground">
                {product.name}
              </p>
              {/* Body/600, tabular-nums. */}
              <p className="mt-1 text-base leading-normal font-semibold tabular-nums text-foreground">
                {currency.format(product.priceXaf)}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
