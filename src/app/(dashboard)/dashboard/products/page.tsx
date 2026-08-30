import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, Info, Package, Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { strings } from "@/lib/strings";
import {
  listProductsForMerchant,
  type MerchantProductListItem,
} from "@/server/catalog/queries";
import { limitFor } from "@/server/entitlements/assert";
import { publicUrlFor } from "@/server/images/r2";
import { requireMerchantContext } from "@/server/merchant/context";

import { ProductRowActions } from "./product-row-actions";

/**
 * A1 — `/dashboard/products` (CAT-01).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireMerchantContext()` is not inherited from `(dashboard)/layout.tsx` —
 * that file's own header explains why a Next 16 layout cannot be the gate.
 * Every page under `(dashboard)/` calls the DAL itself; `React.cache()` makes
 * the repeat call free.
 *
 * ---------------------------------------------------------------------------
 * THE METER AND THE CAP-REACHED ALERT COUNT ACTIVE PRODUCTS, NOT EVERY ROW.
 * ---------------------------------------------------------------------------
 * `createProduct` refuses at `activeProductCount(ctx.tenantId) >= limit`
 * (D-08 decision 1 — a hidden product does not count against the cap, or a
 * capped merchant could never free a slot by hiding one). The meter has to
 * count the same thing the server enforces, or a merchant with 50 hidden
 * products and 0 active ones would see "50 of 50" and believe they are
 * capped when they are not. The count is derived from the list this page
 * already fetched rather than a second `activeProductCount` round trip —
 * one query, one number, and the two can never disagree with each other.
 *
 * ---------------------------------------------------------------------------
 * THE DISABLED CTA AND THE ALERT ARE COURTESY ONLY (SUB-01).
 * ---------------------------------------------------------------------------
 * `src/server/catalog/actions.ts` `createProduct` is reachable by a POST that
 * never loaded this page, and it re-counts and refuses independently. Nothing
 * rendered here is the control.
 */

export const metadata: Metadata = {
  // Renders as "Products · EINORT" through the root layout's template.
  title: strings.products.title,
};

/**
 * The 40px hero thumbnail's derivative. `heroStorageKey` is the upload
 * PREFIX `src/app/api/upload/finalize/route.ts` hands back (never the
 * `/original` object, which `publicUrlFor` itself refuses to serve — see its
 * own header), so the list-sized derivative is always `{prefix}/thumb.webp`
 * per `src/server/images/pipeline.ts`'s `product` preset.
 */
function thumbUrlFor(storageKey: string): string {
  return publicUrlFor(`${storageKey}/thumb.webp`);
}

/**
 * A plain `<img>`, not `next/image`. R2's public hostname is only known at
 * runtime from `env.R2_PUBLIC_BASE_URL`, and wiring it into
 * `next.config.ts`'s `images.remotePatterns` is a build-configuration change
 * this plan's `files_modified` list does not include. Logged rather than
 * silently worked around: `.planning/phases/03-.../deferred-items.md` records
 * it as a follow-up for whichever plan next touches image display.
 */
function ProductThumb({
  heroStorageKey,
}: {
  readonly heroStorageKey: string | null;
}) {
  if (heroStorageKey === null) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
        <Package aria-hidden="true" className="size-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- see header comment above.
    <img
      src={thumbUrlFor(heroStorageKey)}
      alt=""
      className="size-10 shrink-0 rounded-md border border-border object-cover"
    />
  );
}

/** A1's stock cell — the three-way rule is exact, not a rounding of it. */
function StockCell({ stock }: { readonly stock: number }) {
  if (stock === 0) {
    return (
      <span className="tabular-nums text-destructive">
        {strings.products.stockOut}
      </span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="tabular-nums text-muted-foreground">
        {strings.products.stockLow.replace("{n}", String(stock))}
      </span>
    );
  }
  return <span className="tabular-nums text-foreground">{stock}</span>;
}

function StatusBadge({ active }: { readonly active: boolean }) {
  if (active) {
    return (
      <Badge variant="outline-success">{strings.products.statusActive}</Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <EyeOff aria-hidden="true" />
      {strings.products.statusHidden}
    </Badge>
  );
}

/** `fr-CM` XAF, matching every other price on the merchant platform (CLAUDE.md). */
const priceFormatter = new Intl.NumberFormat("fr-CM", {
  style: "currency",
  currency: "XAF",
  maximumFractionDigits: 0,
});

function ProductNameCell({
  product,
}: {
  readonly product: MerchantProductListItem;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm leading-normal font-semibold text-foreground">
        {product.name}
      </span>
      {product.categoryName === null ? null : (
        <span className="text-base leading-normal text-muted-foreground">
          {product.categoryName}
        </span>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <h2 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.products.emptyHeading}
        </h2>
        <p className="max-w-sm text-base leading-normal font-normal text-muted-foreground">
          {strings.products.emptyBody}
        </p>
        <Button
          className="min-h-11"
          render={<Link href="/dashboard/products/new" />}
        >
          <Plus aria-hidden="true" />
          {strings.products.emptyCta}
        </Button>
      </CardContent>
    </Card>
  );
}

export default async function DashboardProductsPage() {
  const ctx = await requireMerchantContext();
  const products = await listProductsForMerchant(ctx.tenantId);
  const limit = limitFor(ctx, "products");

  const activeCount = products.reduce(
    (total, product) => total + (product.active ? 1 : 0),
    0,
  );
  const capReached = limit !== null && activeCount >= limit;

  const meterText =
    limit === null
      ? strings.products.meterNoCap.replace("{n}", String(activeCount))
      : strings.products.meterWithCap
          .replace("{n}", String(activeCount))
          .replace("{cap}", String(limit));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
            {strings.products.heading}
          </h1>
          <p className="text-sm leading-normal font-semibold text-muted-foreground">
            {meterText}
          </p>
        </div>

        {/* The one primary CTA on this page (UI-SPEC § A. Color). */}
        <Button
          disabled={capReached}
          className="min-h-11 w-fit"
          render={<Link href="/dashboard/products/new" />}
        >
          <Plus aria-hidden="true" />
          {strings.products.addCta}
        </Button>
      </div>

      {capReached ? (
        <Alert>
          <Info aria-hidden="true" />
          <AlertDescription>
            <Link
              href="/dashboard/plan"
              className="underline underline-offset-3"
            >
              {strings.entitlements.productLimitReached.replace(
                "{cap}",
                String(limit),
              )}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {products.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* >=`md`: the table. */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">
                      <span className="sr-only">
                        {strings.products.columnProduct}
                      </span>
                    </TableHead>
                    <TableHead>{strings.products.columnProduct}</TableHead>
                    <TableHead className="text-right">
                      {strings.products.columnPrice}
                    </TableHead>
                    <TableHead className="text-right">
                      {strings.products.columnStock}
                    </TableHead>
                    <TableHead>{strings.products.columnStatus}</TableHead>
                    <TableHead className="w-14">
                      <span className="sr-only">
                        {strings.products.columnActions}
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <ProductThumb heroStorageKey={product.heroStorageKey} />
                      </TableCell>
                      <TableCell>
                        <ProductNameCell product={product} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {priceFormatter.format(product.basePriceXaf)}
                      </TableCell>
                      <TableCell className="text-right">
                        <StockCell stock={product.stock} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge active={product.active} />
                      </TableCell>
                      <TableCell>
                        <ProductRowActions
                          productId={product.id}
                          productName={product.name}
                          active={product.active}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* <`md`: stacked cards, actions in the same dropdown-menu island. */}
          <div className="flex flex-col gap-3 md:hidden">
            {products.map((product) => (
              <Card key={product.id}>
                <CardContent className="flex items-start gap-3">
                  <ProductThumb heroStorageKey={product.heroStorageKey} />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <ProductNameCell product={product} />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular-nums text-sm leading-normal text-foreground">
                        {priceFormatter.format(product.basePriceXaf)}
                      </span>
                      <StockCell stock={product.stock} />
                    </div>
                    <StatusBadge active={product.active} />
                  </div>
                  <ProductRowActions
                    productId={product.id}
                    productName={product.name}
                    active={product.active}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
