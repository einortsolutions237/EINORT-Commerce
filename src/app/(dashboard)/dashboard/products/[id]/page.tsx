import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { env } from "@/env";
import { strings } from "@/lib/strings";
import { getProductForEdit, listCategories } from "@/server/catalog/queries";
import { requireMerchantContext } from "@/server/merchant/context";

import { ProductForm } from "../product-form";

/**
 * A2 edit — `/dashboard/products/[id]` (CAT-01, D-08).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * Same rule as the create route and the list: `requireMerchantContext()` is
 * called here rather than inherited from `(dashboard)/layout.tsx`, because a
 * Next 16 layout does not re-run on every navigation into its subtree and so
 * cannot be the gate.
 *
 * ---------------------------------------------------------------------------
 * A PRODUCT ID IN THE URL IS NOT AN AUTHORIZATION CLAIM.
 * ---------------------------------------------------------------------------
 * `id` is the one path segment a merchant fully controls, so it is never
 * trusted for anything but lookup. `getProductForEdit` reads through
 * `scopedDb(ctx.tenantId)`, which filters by the SESSION's tenant — another
 * merchant's product id simply does not resolve, and `null` becomes a 404. That
 * makes "not yours" and "not there" indistinguishable from outside, so the URL
 * cannot be used to probe whether a given product exists on the platform.
 *
 * ---------------------------------------------------------------------------
 * CARD 4 EXISTS ONLY HERE.
 * ---------------------------------------------------------------------------
 * Visibility is a state of a product that already exists, so there is nothing
 * for it to toggle on the create route. `ProductForm` renders it from the
 * presence of `product`, which is why the two routes can be one component with
 * one prop between them rather than two forms that drift.
 */

export const metadata: Metadata = {
  // Renders as "Products · EINORT" through the root layout's template. The
  // product's own name is deliberately not in the title: it would leak a
  // merchant's catalogue into their browser history and tab strip.
  title: strings.products.title,
};

export default async function EditProductPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ctx = await requireMerchantContext();
  const product = await getProductForEdit(ctx.tenantId, id);

  if (product === null) {
    notFound();
  }

  const categories = await listCategories(ctx.tenantId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
        {product.name}
      </h1>

      {/*
        R2's public origin, read here because `publicUrlFor` lives in a
        `server-only` module and `R2_PUBLIC_BASE_URL` is not a `NEXT_PUBLIC_`
        variable. Card 2 appends a derivative name to it; the stored upload
        itself is never addressed.
      */}
      <ProductForm
        categories={categories}
        product={product}
        imageBaseUrl={env.R2_PUBLIC_BASE_URL}
      />
    </div>
  );
}
