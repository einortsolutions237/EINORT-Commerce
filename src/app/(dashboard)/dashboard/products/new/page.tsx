import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { env } from "@/env";
import { strings } from "@/lib/strings";
import { activeProductCount, listCategories } from "@/server/catalog/queries";
import { limitFor } from "@/server/entitlements/assert";
import { requireMerchantContext } from "@/server/merchant/context";

import { ProductForm } from "../product-form";

/**
 * A2 create — `/dashboard/products/new` (CAT-01).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireMerchantContext()` is called here, not inherited from
 * `(dashboard)/layout.tsx`. A Next 16 layout is not an authorization boundary —
 * it does not re-run on every navigation into its subtree, so a gate placed
 * there is a gate that sometimes does not run. `React.cache()` makes the repeat
 * call free, so the correct thing is also the cheap thing.
 *
 * ---------------------------------------------------------------------------
 * THE CAP REDIRECT IS A COURTESY. `createProduct` IS THE AUTHORITY (SUB-01).
 * ---------------------------------------------------------------------------
 * A merchant already at their plan's product limit is sent back to the list,
 * where A1's alert explains the refusal in place — that saves them filling in a
 * form the server was always going to refuse. It is politeness and nothing
 * else. `createProduct` re-counts `activeProductCount` against
 * `PLANS[tier].limits.products` inside its own handler and refuses
 * independently, and it is reachable by a POST that never loaded this page.
 * Deleting the check below would cost a merchant a wasted form; deleting the
 * one in the action would cost the platform its plan limits.
 *
 * The count is of ACTIVE products, matching the action exactly — D-08 forbids
 * removal, so counting hidden rows would ratchet the cap permanently downward
 * and leave a capped merchant with no action that could ever free a slot.
 */

export const metadata: Metadata = {
  // Renders as "Add product · EINORT" through the root layout's template.
  title: strings.products.addCta,
};

export default async function NewProductPage() {
  const ctx = await requireMerchantContext();

  const limit = limitFor(ctx, "products");
  if (limit !== null && (await activeProductCount(ctx.tenantId)) >= limit) {
    redirect("/dashboard/products");
  }

  const categories = await listCategories(ctx.tenantId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
        {strings.products.addCta}
      </h1>

      {/*
        R2's public origin, read here because `publicUrlFor` lives in a
        `server-only` module and `R2_PUBLIC_BASE_URL` is not a `NEXT_PUBLIC_`
        variable. Card 2 appends a derivative name to it; the stored upload
        itself is never addressed.
      */}
      <ProductForm
        categories={categories}
        product={null}
        imageBaseUrl={env.R2_PUBLIC_BASE_URL}
      />
    </div>
  );
}
