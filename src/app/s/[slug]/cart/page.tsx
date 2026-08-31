import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { strings } from "@/lib/strings";
import { getCurrentCart } from "@/server/cart/read";
import { publicUrlFor } from "@/server/images/r2";
// Imported under a local alias so the identifier has exactly one occurrence in
// this file, named once here — the same convention the catalog and product
// pages already use for their own single-call-site queries.
import { hydrateCart as fetchCartLines } from "@/server/storefront/queries";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

import { StoreHeader } from "../store-header";
import { CartLines } from "./cart-lines";

/**
 * The B3 cart review (CHK-01).
 *
 * ---------------------------------------------------------------------------
 * EVERY AMOUNT ON THIS PAGE IS THE SERVER'S. THE PAGE COMPUTES NO PRICE.
 * ---------------------------------------------------------------------------
 * The 03-09 cart-hydration query imported below takes the stored basket — which
 * is ids and quantities and nothing else — and returns display lines whose unit
 * and line amounts were read from `Product`/`ProductVariant` rows behind
 * `scopedDb` (`src/server/storefront/queries.ts`). This file sums
 * those line amounts and formats them; it never derives a figure from anything
 * the browser sent, because the cookie that points at the basket is under the
 * shopper's control (TEN-08).
 *
 * ---------------------------------------------------------------------------
 * THE SUMMARY BLOCK HAS EXACTLY TWO ROWS, AND THAT IS A PRODUCT DECISION.
 * ---------------------------------------------------------------------------
 * 03-UI-SPEC.md § B3 is explicit: `Subtotal` and `Total`, and nothing else. V1
 * charges nothing beyond the goods, so a third row valued at zero would be the
 * platform advertising a capability it does not have — and a merchant would
 * then be answering questions about a figure no code anywhere produces. The
 * total IS the subtotal here, exactly as `src/server/orders/place.ts` records
 * it at placement, so the two agree by construction rather than by review.
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE READS THE COOKIE. IT NEVER WRITES ONE.
 * ---------------------------------------------------------------------------
 * 03-RESEARCH.md Pitfall 4: Next 16 only permits a cookie WRITE inside a
 * Server Function or a Route Handler, so the cart id is minted by
 * `src/server/cart/actions.ts` on a real POST or not at all. The read goes
 * through `getCurrentCart` (`src/server/cart/read.ts`) rather than a local
 * cookie-jar lookup of its own, which is what keeps "which code can read a
 * shopper's basket?" answerable by reading two modules rather than the whole
 * route tree — and leaves this file with no reference to the cookie API at
 * all, write or read, which is what the plan's grep asserts.
 */

export const metadata: Metadata = {
  title: strings.cart.title,
};

const currency = new Intl.NumberFormat("fr-CM", {
  style: "currency",
  currency: "XAF",
  maximumFractionDigits: 0,
});

export default async function CartPage({ params }: PageProps<"/s/[slug]/cart">) {
  const { slug } = await params;

  const tenant = await resolveTenantBySlug(slug);

  // Unreachable in practice — the storefront layout gates this subtree — but
  // the check is what makes that a type-level fact rather than an assumption.
  if (!tenant) notFound();

  const stored = await getCurrentCart(slug);
  const lines = await fetchCartLines(tenant.id, stored);

  // A line whose variant or product is gone contributes nothing to the money.
  // It still RENDERS, carrying its own note, because a basket that silently
  // shrinks between two page loads reads as a bug to the person holding it.
  const payable = lines.filter((line) => line.adjustment !== "unavailable");
  const subtotalXaf = payable.reduce((sum, line) => sum + line.lineTotalXaf, 0);

  const isEmpty = lines.length === 0;

  return (
    <>
      <StoreHeader slug={slug} tenantId={tenant.id} storeName={tenant.name} />

      {isEmpty ? (
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          {/* Heading role: 24px / 600 / 1.2 */}
          <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
            {strings.cart.emptyHeading}
          </h1>

          {/* Body role: 16px / 400 / 1.6 — the storefront's looser rhythm. */}
          <p className="mt-3 text-base leading-relaxed font-normal text-muted-foreground">
            {strings.cart.emptyBody}
          </p>

          {/*
           * Ghost, not primary. § B. Color reserves the ink fill for one CTA
           * per page, and on an empty cart there is no order to place — so the
           * page spends nothing.
           */}
          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded border border-border px-4 text-sm leading-snug font-semibold text-foreground hover:bg-muted"
          >
            {strings.cart.emptyCta}
          </Link>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
            {strings.cart.heading}
          </h1>

          <CartLines
            slug={slug}
            lines={lines.map((line) => ({
              variantId: line.variantId,
              productName: line.productName,
              variantLabel: line.variantLabel,
              quantity: line.quantity,
              unitPrice: currency.format(line.unitPriceXaf),
              availableStock: line.availableStock,
              adjustment: line.adjustment,
              // The derivative prefix plus the 400px label (`IMAGE_PRESETS`).
              // Built here because `publicUrlFor` reads the validated server
              // env; the island receives a finished URL and no configuration.
              imageUrl: line.imageKey
                ? publicUrlFor(`${line.imageKey}/thumb.webp`)
                : null,
            }))}
          />

          {/* The B3 summary block: `--muted` fill, two rows, no third. */}
          <div className="mt-6 rounded bg-muted p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-base leading-relaxed font-normal text-muted-foreground">
                {strings.cart.subtotal}
              </span>
              <span className="text-base leading-relaxed font-normal tabular-nums text-foreground">
                {currency.format(subtotalXaf)}
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
                {strings.cart.total}
              </span>
              <span className="text-2xl leading-tight font-semibold tracking-tight tabular-nums text-foreground">
                {currency.format(subtotalXaf)}
              </span>
            </div>
          </div>

          {/*
           * The page's one ink fill. Sticky to the viewport bottom below `md`
           * so a long basket never buries it; static from `md` up, where the
           * whole column fits.
           */}
          <div className="sticky bottom-0 mt-4 -mx-4 border-t border-border bg-background px-4 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
            <Link
              href="/checkout"
              className="flex min-h-12 w-full items-center justify-center rounded bg-primary px-4 text-base leading-normal font-semibold text-primary-foreground hover:bg-primary/80"
            >
              {strings.cart.checkoutCta}
            </Link>
          </div>
        </main>
      )}
    </>
  );
}
