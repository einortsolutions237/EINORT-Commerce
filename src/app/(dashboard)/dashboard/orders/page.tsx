import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, ChevronRight } from "lucide-react";

import { OrderChannelChip, OrderStateChip } from "@/components/order-state-chip";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import type { OrderChannel, OrderState } from "@/server/db/enums";
import { requireMerchantContext } from "@/server/merchant/context";
import {
  listOrdersForMerchant,
  ORDER_FILTERS,
  type OrderFilter,
  type OrderListRow,
} from "@/server/orders/queries";

import { formatRelativeTime, formatXaf } from "./format";
import { OrderCard, OrderRowActions } from "./order-row-actions";

/**
 * `/dashboard/orders` (03-UI-SPEC.md § A3, ORD-01 / ORD-05).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF. See `plan/page.tsx` for why every page under
 * `(dashboard)/` calls `requireMerchantContext()` rather than inheriting a
 * check from the layout.
 * ---------------------------------------------------------------------------
 * THE DEFAULT FILTER IS A SERVER DECISION, NOT A CLIENT ONE.
 * ---------------------------------------------------------------------------
 * A3 says: land on `Needs attention` when its count is above zero, otherwise
 * `All`. `listOrdersForMerchant`'s per-filter counts are returned in the SAME
 * round trip as the rows for whichever filter was actually requested, so
 * deciding the default requires one "peek" call at `needs-attention` before
 * the real query can run — see `resolveOrders` below. That peek IS the real
 * query whenever its own count turns out to be the one the merchant lands on,
 * so the common case (something needs attention) costs exactly one round trip
 * and only the empty-inbox case costs two.
 * ---------------------------------------------------------------------------
 * FILTERS ARE LINKS, NOT CLIENT STATE.
 * ---------------------------------------------------------------------------
 * Each chip is a plain `<Link href="?filter=…">`. The filter is therefore
 * shareable, back-button-safe and requires no client-side state at all.
 * ---------------------------------------------------------------------------
 * ONLY A CONFIRMABLE ROW IS A CLIENT ISLAND.
 * ---------------------------------------------------------------------------
 * D-02's one-tap confirm only exists on an `ORDER_PLACED` row whose channel
 * is WhatsApp or cash-on-delivery — every other row has no state this page
 * can change (a claim is reviewed on `/dashboard/claims`; every other state
 * only offers a link to the detail page). So only THOSE rows render the
 * `order-row-actions.tsx` client island; everything else renders
 * `OrderStateChip` directly, server-side, with the row's actual persisted
 * state — no optimism needed where nothing on this page can move it.
 */

export const metadata: Metadata = {
  title: strings.orders.title,
};

const FILTER_LABELS: Readonly<Record<OrderFilter, string>> = {
  all: strings.orders.filterAll,
  "needs-attention": strings.orders.filterNeedsAttention,
  "awaiting-payment": strings.orders.filterAwaitingPayment,
  confirmed: strings.orders.filterConfirmed,
  fulfilled: strings.orders.filterFulfilled,
  disputed: strings.orders.filterDisputed,
};

/** `?filter=` -> a member of `ORDER_FILTERS`, or `undefined` if absent/invalid. */
function parseFilter(
  raw: string | string[] | undefined,
): OrderFilter | undefined {
  if (typeof raw !== "string") return undefined;
  return (ORDER_FILTERS as readonly string[]).includes(raw)
    ? (raw as OrderFilter)
    : undefined;
}

/**
 * The A3 default-filter rule, resolved server-side. See the file header for
 * why this can cost one round trip or two depending on what it finds.
 */
async function resolveOrders(
  tenantId: string,
  explicitFilter: OrderFilter | undefined,
): Promise<{
  readonly filter: OrderFilter;
  readonly orders: readonly OrderListRow[];
}> {
  if (explicitFilter) {
    const result = await listOrdersForMerchant(tenantId, explicitFilter);
    return { filter: explicitFilter, orders: result.orders };
  }

  const peek = await listOrdersForMerchant(tenantId, "needs-attention");
  if (peek.counts["needs-attention"] > 0) {
    return { filter: "needs-attention", orders: peek.orders };
  }

  const all = await listOrdersForMerchant(tenantId, "all");
  return { filter: "all", orders: all.orders };
}

/** D-02: the one state+channel combination this page can confirm in one tap. */
function isConfirmable(state: OrderState, channel: OrderChannel): boolean {
  return state === "ORDER_PLACED" && channel !== "MANUAL_TRANSFER";
}

/**
 * The static (non-confirmable) row's action: `Review claim` when a payment is
 * waiting on the merchant's judgement, otherwise a plain link to the detail
 * page. No client component — nothing here can change from this page.
 */
function StaticRowAction({
  orderId,
  orderNumber,
  state,
}: {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly state: OrderState;
}) {
  if (state === "PAYMENT_CLAIMED") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="min-h-11"
        render={<Link href="/dashboard/claims" />}
      >
        <BellRing aria-hidden="true" />
        {strings.orders.reviewClaim}
      </Button>
    );
  }

  return (
    <Link
      href={`/dashboard/orders/${orderId}`}
      aria-label={strings.orders.viewOrder.replace("{n}", orderNumber)}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <ChevronRight aria-hidden="true" />
    </Link>
  );
}

export default async function OrdersPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
}) {
  const ctx = await requireMerchantContext();
  const params = await searchParams;
  const explicitFilter = parseFilter(params.filter);

  const { filter, orders } = await resolveOrders(ctx.tenantId, explicitFilter);

  const isUnfilteredEmpty = filter === "all" && orders.length === 0;
  const isFilteredEmpty = filter !== "all" && orders.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.orders.heading}
        </h1>
      </div>

      <nav
        aria-label={strings.orders.filterNavLabel}
        className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible"
      >
        {ORDER_FILTERS.map((item) => {
          const current = item === filter;
          return (
            <Link
              key={item}
              href={
                item === "all"
                  ? "/dashboard/orders"
                  : `/dashboard/orders?filter=${item}`
              }
              aria-current={current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm leading-normal font-semibold whitespace-nowrap",
                current
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {FILTER_LABELS[item]}
            </Link>
          );
        })}
      </nav>

      {isUnfilteredEmpty ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card px-6 py-12 text-center sm:items-center">
          <h2 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
            {strings.orders.emptyHeading}
          </h2>
          <p className="max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {strings.orders.emptyBody}
          </p>
        </div>
      ) : isFilteredEmpty ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card px-6 py-12 text-center sm:items-center">
          <h2 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
            {strings.orders.filteredEmptyHeading}
          </h2>
          <p className="max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {strings.orders.filteredEmptyBody}
          </p>
          <Button
            variant="ghost"
            className="min-h-11"
            render={<Link href="/dashboard/orders" />}
          >
            {strings.orders.filteredEmptyCta}
          </Button>
        </div>
      ) : (
        <>
          {/* >= md: table. strings.orders column headers, never inlined. */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{strings.orders.columnOrder}</TableHead>
                  <TableHead>{strings.orders.columnCustomer}</TableHead>
                  <TableHead>{strings.orders.columnChannel}</TableHead>
                  <TableHead className="text-right">
                    {strings.orders.columnTotal}
                  </TableHead>
                  <TableHead>{strings.orders.columnStatus}</TableHead>
                  <TableHead className="text-right">
                    {strings.orders.columnAction}
                  </TableHead>
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
                        <span className="text-sm leading-normal font-normal text-muted-foreground">
                          {formatRelativeTime(order.placedAt)}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-base leading-normal font-normal text-foreground">
                          {order.customerName}
                        </span>
                        <span className="text-sm leading-normal font-normal text-muted-foreground">
                          {order.customerPhone}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <OrderChannelChip
                        channel={order.channel}
                        operator={order.operator}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatXaf(order.totalXaf)}
                    </TableCell>
                    {isConfirmable(order.state, order.channel) ? (
                      <OrderRowActions
                        orderId={order.id}
                        orderNumber={order.orderNumber}
                        channel={order.channel}
                        state={order.state}
                      />
                    ) : (
                      <>
                        <TableCell>
                          <OrderStateChip
                            channel={order.channel}
                            state={order.state}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <StaticRowAction
                              orderId={order.id}
                              orderNumber={order.orderNumber}
                              state={order.state}
                            />
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* < md: stacked cards, A3's three-line arrangement. */}
          <div className="flex flex-col gap-3 md:hidden">
            {orders.map((order) =>
              isConfirmable(order.state, order.channel) ? (
                <OrderCard
                  key={order.id}
                  orderId={order.id}
                  orderNumber={order.orderNumber}
                  channel={order.channel}
                  state={order.state}
                  customerName={order.customerName}
                  customerPhone={order.customerPhone}
                  totalFormatted={formatXaf(order.totalXaf)}
                  placedAtRelative={formatRelativeTime(order.placedAt)}
                  operator={order.operator}
                />
              ) : (
                <div
                  key={order.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="font-mono text-sm leading-normal font-semibold text-foreground"
                    >
                      {order.orderNumber}
                    </Link>
                    <OrderStateChip
                      channel={order.channel}
                      state={order.state}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-base leading-normal font-normal text-foreground">
                        {order.customerName}
                      </span>
                      <span className="text-sm leading-normal font-normal text-muted-foreground">
                        {formatRelativeTime(order.placedAt)}
                      </span>
                    </div>
                    <span className="text-base leading-normal font-semibold tabular-nums text-foreground">
                      {formatXaf(order.totalXaf)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <OrderChannelChip
                      channel={order.channel}
                      operator={order.operator}
                    />
                    <StaticRowAction
                      orderId={order.id}
                      orderNumber={order.orderNumber}
                      state={order.state}
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
