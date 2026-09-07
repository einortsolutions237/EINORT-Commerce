import Link from "next/link";

import { OrderStateChip } from "@/components/order-state-chip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { strings } from "@/lib/strings";
import type { RecentOrderRow } from "@/server/dashboard/queries";

import { formatRelativeTime, formatXaf } from "./orders/format";

/**
 * Quick task 260906-egn, Task 4 — the Overview page's recent-orders list.
 * A Server Component built from `src/components/ui/table.tsx`, the same
 * primitives `dashboard/orders/page.tsx` uses, so the two lists stay visually
 * consistent — and `OrderStateChip` for state, so this file never writes the
 * `variant="gold"` literal itself (`order-state-chip.tsx` is the sole
 * authorized spender for the order-state chip; this component only renders
 * it).
 *
 * A brand-new merchant with zero orders sees the empty state below, never an
 * empty table or a crash.
 */
export function RecentOrders({
  orders,
}: {
  readonly orders: readonly RecentOrderRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{strings.dashboard.overview.recentOrdersHeading}</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <h3 className="font-heading text-base leading-normal font-semibold text-foreground">
              {strings.dashboard.overview.recentOrdersEmptyHeading}
            </h3>
            <p className="max-w-prose text-sm leading-normal font-normal text-muted-foreground">
              {strings.dashboard.overview.recentOrdersEmptyBody}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{strings.orders.columnOrder}</TableHead>
                <TableHead>{strings.orders.columnCustomer}</TableHead>
                <TableHead className="text-right">
                  {strings.orders.columnTotal}
                </TableHead>
                <TableHead>{strings.orders.columnStatus}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="flex flex-col gap-0.5"
                    >
                      <span className="font-mono text-sm leading-normal font-semibold text-foreground">
                        {order.orderNumber}
                      </span>
                      <span className="text-xs leading-normal font-normal text-muted-foreground">
                        {formatRelativeTime(order.placedAt)}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-base leading-normal font-normal text-foreground">
                    {order.customerName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatXaf(order.totalXaf)}
                  </TableCell>
                  <TableCell>
                    <OrderStateChip channel={order.channel} state={order.state} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
