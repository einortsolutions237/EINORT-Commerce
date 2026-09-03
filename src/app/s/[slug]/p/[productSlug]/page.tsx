import type { Metadata } from "next";
import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { strings } from "@/lib/strings";
import { publicUrlFor } from "@/server/images/r2";
// Imported under a local alias so the identifier has exactly one occurrence
// in this file, named once here, even though both `generateMetadata` and the
// page component below call it.
import { getStorefrontProduct as fetchProduct } from "@/server/storefront/queries";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

import { AddToCart, Gallery } from "./add-to-cart";

/**
 * The B2 product detail page (CHK-01 / D-05 / D-09 / D-10).
 *
 * The product query returns `null` for a foreign tenant's slug, an inactive
 * product, and a nonexistent one — all three `notFound()` here, byte
 * identically (T-03-48). A probe cannot distinguish "wrong tenant" from "no
 * such product" from this page's response.
 */

export async function generateMetadata({
  params,
}: PageProps<"/s/[slug]/p/[productSlug]">): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return {};
  const product = await fetchProduct(tenant.id, productSlug);
  return { title: product?.name ?? strings.storefront.heading };
}

export default async function ProductDetailPage({
  params,
}: PageProps<"/s/[slug]/p/[productSlug]">) {
  const { slug, productSlug } = await params;

  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) notFound();

  const product = await fetchProduct(tenant.id, productSlug);
  if (!product) notFound();

  // Derivative URLs are resolved here, server-side, and handed to the client
  // island as plain strings — `publicUrlFor` lives in `src/server/images/r2.ts`
  // (`import "server-only"`) and cannot cross into a client component.
  const galleryImages = product.images.map((image) => ({
    detailUrl: publicUrlFor(`${image.storageKey}/detail.webp`),
    thumbUrl: publicUrlFor(`${image.storageKey}/thumb.webp`),
  }));

  return (
    <>
      {/*
       * The header moved to `src/app/s/[slug]/layout.tsx` in plan 04-10 — it is
       * theme chrome now (04-RESEARCH Pattern 12) and every storefront route
       * inherits it, along with the announcement bar and the footer. Rendering
       * it here as well would draw two.
       */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">
        <Link
          href="/"
          className="flex h-11 w-fit items-center gap-1.5 text-sm leading-snug font-semibold tracking-[0.08em] text-foreground uppercase"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          {strings.catalog.backToProducts}
        </Link>

        <div className="mt-4 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
          <Gallery productName={product.name} images={galleryImages} />

          <div className="flex flex-1 flex-col">
            {product.categoryName && (
              <p className="text-sm leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {product.categoryName}
              </p>
            )}

            <h1 className="mt-2 text-4xl leading-[1.05] font-semibold tracking-tight text-foreground">
              {product.name}
            </h1>

            <AddToCart
              slug={slug}
              option1Name={product.option1Name}
              option2Name={product.option2Name}
              variants={product.variants}
            />

            {product.description && (
              <p className="mt-12 max-w-prose text-base leading-normal font-normal text-foreground">
                {product.description}
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
