import "server-only";

import { type OrderChannel, OrderState } from "@/server/db/enums";
import { scopedDb } from "@/server/db/tenant-scoped";

import { bucketByDay, type DailyBucket } from "./buckets";

/**
 * Quick task 260906-egn, Task 4 — the real `/dashboard` Overview reads:
 * four metric cards, the 7-day revenue chart's source rows, and the
 * recent-orders list.
 *
 * ---------------------------------------------------------------------------
 * TWO NAMED STATE SETS, NOT TWO INLINE ARRAYS.
 * ---------------------------------------------------------------------------
 * `EARNED_STATES` — money is only real once a human has confirmed it.
 * Deliberately excludes `ORDER_PLACED`, `PAYMENT_PENDING` and
 * `PAYMENT_CLAIMED` (a claim is the CUSTOMER's assertion, not a fact —
 * `strings.claims`'s own header makes the same point) and `DISPUTED` (a
 * payment this platform could not match). Revenue counts `CONFIRMED` and
 * `FULFILLED` only.
 *
 * `OPEN_STATES` — decision A-01. The Active orders card is the merchant's
 * whole current backlog: every order still requiring action, regardless of
 * when it was placed. This is deliberately NOT windowed by `since` the way
 * the other three metrics are — see `overviewMetrics` below and the card's
 * own "All time" sublabel in `overview-metrics.tsx`.
 *
 * `OrderState` is imported from `@/server/db/enums`, never from the generated
 * client — the one sanctioned door, per that module's own header.
 */
const EARNED_STATES: readonly OrderState[] = [
  OrderState.CONFIRMED,
  OrderState.FULFILLED,
];

const OPEN_STATES: readonly OrderState[] = [
  OrderState.ORDER_PLACED,
  OrderState.PAYMENT_PENDING,
  OrderState.PAYMENT_CLAIMED,
  OrderState.CONFIRMED,
];

const RECENT_ORDERS_TAKE = 5;

/**
 * Bounded at pilot scale but unbounded in principle: a merchant doing many
 * thousands of orders in a single 7-day window would exceed this and the
 * chart would undercount that window's tail. Revisiting this cap is a
 * follow-up for whenever pilot volume approaches it, not a correctness bug
 * today.
 */
const REVENUE_WINDOW_ROW_CAP = 5000;

export interface OverviewMetrics {
  /** `_sum` over EARNED_STATES orders placed since `since`. */
  readonly revenueXaf: number;
  /** OPEN_STATES count, UNWINDOWED — decision A-01. */
  readonly openOrders: number;
  readonly unitsSold: number;
  readonly newCustomers: number;
  readonly revenueByDay: readonly DailyBucket[];
}

/**
 * One `Promise.all` of six reads, all tenant-scoped via `scopedDb`.
 *
 * ---------------------------------------------------------------------------
 * `_sum` RETURNS `null`, NOT `0`, ON AN EMPTY WINDOW.
 * ---------------------------------------------------------------------------
 * SQL `SUM()` over zero rows is `NULL`, not `0` — coalesced below with `?? 0`.
 * Never `!` and never `as number`: a brand-new merchant with no confirmed
 * orders yet must see a `0` currency string, not a `NaN` one.
 *
 * ---------------------------------------------------------------------------
 * THE CUSTOMERS METRIC: A SET DIFFERENCE OVER `customerPhone`, NOT A COUNT.
 * ---------------------------------------------------------------------------
 * There is no `Customer` model in this schema — the only customer identity is
 * the `Order.customerName`/`customerPhone` snapshot pair. What makes counting
 * distinct phones defensible is that `src/server/checkout/actions.ts` runs
 * `normalizeCameroonMsisdn()` before `placeOrder` persists the phone, so
 * `customerPhone` is a stable, normalized MSISDN and a `+237`-prefixed number
 * cannot double-count against a bare one. "New" means a phone number that
 * placed an order in this window and never placed one before it — computed as
 * the set difference between two `groupBy(["customerPhone"])` calls (this
 * window, and everything before it) rather than a single distinct count,
 * because a distinct count alone cannot tell a first-time buyer from a
 * returning one. If that set-difference logic is ever dropped, the card must
 * be relabelled "Customers who ordered" — see `overview-metrics.tsx`.
 */
export async function overviewMetrics(
  tenantId: string,
  since: Date,
): Promise<OverviewMetrics> {
  const db = scopedDb(tenantId);

  const [
    revenueAgg,
    openOrders,
    unitsAgg,
    windowCustomers,
    priorCustomers,
    windowRows,
  ] = await Promise.all([
    db.order.aggregate({
      _sum: { totalXaf: true },
      where: { placedAt: { gte: since }, state: { in: [...EARNED_STATES] } },
    }),
    // NO `placedAt` filter — the backlog is a to-do gauge, not a period
    // measure (decision A-01).
    db.order.count({
      where: { state: { in: [...OPEN_STATES] } },
    }),
    db.orderItem.aggregate({
      _sum: { quantity: true },
      where: { order: { placedAt: { gte: since } } },
    }),
    db.order.groupBy({
      by: ["customerPhone"],
      where: { placedAt: { gte: since } },
    }),
    db.order.groupBy({
      by: ["customerPhone"],
      where: { placedAt: { lt: since } },
    }),
    db.order.findMany({
      where: { placedAt: { gte: since } },
      select: { placedAt: true, totalXaf: true },
      // Bounded at pilot scale but unbounded in principle — see
      // REVENUE_WINDOW_ROW_CAP above.
      take: REVENUE_WINDOW_ROW_CAP,
    }),
  ]);

  const priorPhones = new Set(priorCustomers.map((row) => row.customerPhone));
  const newCustomers = windowCustomers.filter(
    (row) => !priorPhones.has(row.customerPhone),
  ).length;

  return {
    revenueXaf: revenueAgg._sum.totalXaf ?? 0,
    openOrders,
    unitsSold: unitsAgg._sum.quantity ?? 0,
    newCustomers,
    revenueByDay: bucketByDay(windowRows, since),
  };
}

export interface RecentOrderRow {
  readonly id: string;
  readonly orderNumber: string;
  readonly customerName: string;
  readonly state: OrderState;
  readonly channel: OrderChannel;
  readonly totalXaf: number;
  readonly placedAt: Date;
}

/** The Overview page's recent-orders list. Same shape and ordering pattern
 * as `dashboard/orders/page.tsx`'s own list, so the two stay visually
 * consistent. */
export async function recentOrders(
  tenantId: string,
): Promise<readonly RecentOrderRow[]> {
  return scopedDb(tenantId).order.findMany({
    orderBy: { placedAt: "desc" },
    take: RECENT_ORDERS_TAKE,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      state: true,
      channel: true,
      totalXaf: true,
      placedAt: true,
    },
  });
}
