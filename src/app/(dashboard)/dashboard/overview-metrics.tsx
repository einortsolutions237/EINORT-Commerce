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
}: {
  readonly revenueXaf: number;
  readonly openOrders: number;
  readonly unitsSold: number;
  readonly newCustomers: number;
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

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
    </div>
  );
}
