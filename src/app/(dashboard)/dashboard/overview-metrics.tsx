import { Package } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { strings } from "@/lib/strings";

import { formatXaf } from "./orders/format";

/**
 * Quick task 260906-egn, Task 4 — the Overview page's four metric cards.
 * A Server Component: every value is computed on the server by
 * `@/server/dashboard/queries`'s `overviewMetrics` and passed down as plain
 * numbers, so there is nothing here to hydrate.
 *
 * ---------------------------------------------------------------------------
 * THE ACTIVE ORDERS SUBLABEL SAYS "All time" WHILE THE OTHER THREE SAY
 * "Last 7 days" — AND THAT ASYMMETRY IS THE POINT (decision A-01).
 * ---------------------------------------------------------------------------
 * Revenue, units sold and new customers are all windowed to the last 7 days.
 * Active orders is the merchant's whole current backlog — a 9-day-old
 * unfulfilled order is still work owed to a customer, and windowing it would
 * turn a to-do gauge into a lie. The difference has to be visible on screen,
 * not just documented in a code comment, or a merchant has no way to know the
 * fourth card means something different from the other three.
 */
export function OverviewMetrics({
  revenueXaf,
  openOrders,
  unitsSold,
  newCustomers,
  activeProductCount,
  productCap,
}: {
  readonly revenueXaf: number;
  readonly openOrders: number;
  readonly unitsSold: number;
  readonly newCustomers: number;
  /** Phase 6 plan 06-05, Task 3 — the 5th card, per `06-UI-SPEC.md` § A1. */
  readonly activeProductCount: number;
  /** `ctx.plan.limits.products` — `null` on an unlimited plan omits the sub-line. */
  readonly productCap: number | null;
}) {
  const cards = [
    {
      title: strings.dashboard.overview.metricRevenue,
      value: formatXaf(revenueXaf),
      sublabel: strings.dashboard.overview.sublabelLast7Days,
    },
    {
      title: strings.dashboard.overview.metricActiveOrders,
      value: openOrders.toLocaleString("fr-CM"),
      sublabel: strings.dashboard.overview.sublabelActiveOrders,
    },
    {
      title: strings.dashboard.overview.metricUnitsSold,
      value: unitsSold.toLocaleString("fr-CM"),
      sublabel: strings.dashboard.overview.sublabelLast7Days,
    },
    {
      title: strings.dashboard.overview.metricNewCustomers,
      value: newCustomers.toLocaleString("fr-CM"),
      sublabel: strings.dashboard.overview.sublabelLast7Days,
    },
  ] as const;

  const productsSublabel =
    productCap === null
      ? null
      : strings.dashboard.attention.productsLiveSublabel
          .replace("{n}", activeProductCount.toLocaleString("fr-CM"))
          .replace("{cap}", productCap.toLocaleString("fr-CM"));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader>
            <CardTitle className="font-sans text-sm leading-normal font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <span className="font-heading text-2xl leading-tight font-semibold tabular-nums text-foreground">
              {card.value}
            </span>
            <span className="text-xs leading-normal font-normal text-muted-foreground">
              {card.sublabel}
            </span>
          </CardContent>
        </Card>
      ))}

      <Link
        href="/dashboard/products"
        className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 font-sans text-sm leading-normal font-medium text-muted-foreground">
              <Package aria-hidden="true" className="size-4" />
              {strings.dashboard.attention.productsLive}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <span className="font-heading text-2xl leading-tight font-semibold tabular-nums text-foreground">
              {activeProductCount.toLocaleString("fr-CM")}
            </span>
            {productsSublabel !== null && (
              <span className="text-xs leading-normal font-normal text-muted-foreground">
                {productsSublabel}
              </span>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
