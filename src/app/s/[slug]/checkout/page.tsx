import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { strings } from "@/lib/strings";
import { getCurrentCart } from "@/server/cart/read";
// Namespace import so the path resolver is named exactly once in this file —
// at the call site that decides the markup — rather than once in an import
// list and again below. The same convention `submitCheckout` uses.
import * as payments from "@/server/payments/settings";
import { cartLineCount, hydrateCart } from "@/server/storefront/queries";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

import { StoreHeader } from "../store-header";
import { CheckoutForm } from "./checkout-form";

/**
 * The B4 checkout page (CHK-02 / D-16).
 *
 * ---------------------------------------------------------------------------
 * THE FORM IS HANDED ANSWERS, NEVER THE MEANS TO INVENT THEM.
 * ---------------------------------------------------------------------------
 * Two things cross into the client island below, and both arrive already
 * decided: WHICH PAYMENT PATHS EXIST, resolved here from the merchant's saved
 * settings, and WHAT THE BASKET COSTS, formatted here from amounts the 03-09
 * hydration query read out of `Product`/`ProductVariant` behind `scopedDb`.
 *
 * The island receives the totals as STRINGS. That is deliberate and it is not
 * a formatting convenience: a number in those props is a number a component
 * could add up, and a component that can add up money is one that can be made
 * to add it up differently. `submitCheckout` accepts no amount and no line
 * items at all, so nothing this page renders can reach an order row anyway —
 * the string-typed props make that visible at the boundary rather than only
 * provable by reading the action (TEN-08, T-03-59).
 *
 * ---------------------------------------------------------------------------
 * A PATH THIS SELLER CANNOT ACCEPT IS NOT RENDERED, NOT RENDERED-AND-DISABLED.
 * ---------------------------------------------------------------------------
 * The resolver below is the same function `submitCheckout` re-runs server-side
 * before placing (T-03-60), and the same one A6's settings page reads — one
 * source of truth, so the merchant's settings screen and the shopper's
 * checkout can never disagree about what this store can take. Hiding the card
 * here is the courtesy; the action is the authority. Both are needed: without
 * the check the page would offer a dead end, and without the action a direct
 * POST would reach one.
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE READS THE COOKIE. IT NEVER WRITES ONE.
 * ---------------------------------------------------------------------------
 * 03-RESEARCH.md Pitfall 4 — Next 16 permits a cookie write only inside a
 * Server Function or a Route Handler. The read goes through `getCurrentCart`,
 * the same door the cart page and the store header use.
 */

export const metadata: Metadata = {
  title: strings.checkout.title,
};

const currency = new Intl.NumberFormat("fr-CM", {
  style: "currency",
  currency: "XAF",
  maximumFractionDigits: 0,
});

export default async function CheckoutPage({
  params,
}: PageProps<"/s/[slug]/checkout">) {
  const { slug } = await params;

  const tenant = await resolveTenantBySlug(slug);

  // Unreachable in practice — the storefront layout gates this subtree — but
  // the check is what makes that a type-level fact rather than an assumption.
  if (!tenant) notFound();

  const stored = await getCurrentCart(slug);
  const lines = await hydrateCart(tenant.id, stored);

  /*
   * A line whose product or variant has gone contributes nothing to the money
   * and cannot be bought, so it is not part of what this page is asking the
   * shopper to confirm. The cart page still shows it, carrying its own note,
   * which is where the explanation belongs.
   */
  const payable = lines.filter((line) => line.adjustment !== "unavailable");

  /*
   * Nothing to buy means there is nothing to ask for. Back to the cart rather
   * than an empty-checkout state: the cart already owns the empty case, and it
   * is the screen that can do something about it.
   */
  if (payable.length === 0) redirect(`/s/${slug}/cart`);

  const settings = await payments.getPaymentSettings(tenant.id);
  const paths = payments.resolvePaymentPaths(settings);

  const totalXaf = payable.reduce((sum, line) => sum + line.lineTotalXaf, 0);

  return (
    <>
      <StoreHeader slug={slug} tenantId={tenant.id} storeName={tenant.name} />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6">
        <CheckoutForm
          slug={slug}
          storeName={tenant.name}
          paths={paths}
          itemCount={cartLineCount(payable)}
          total={currency.format(totalXaf)}
          lines={payable.map((line) => ({
            variantId: line.variantId,
            productName: line.productName,
            variantLabel: line.variantLabel,
            quantity: line.quantity,
            lineTotal: currency.format(line.lineTotalXaf),
          }))}
        />
      </main>
    </>
  );
}
