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

/* ===========================================================================
 * DASH-02 — the `Needs your attention` band, and DASH-01's `Products live`
 * ===========================================================================
 *
 * Quick task 260906-egn answered "how is the business performing". It did not
 * answer "what needs attention": low stock existed nowhere in the codebase,
 * disputed orders were surfaced nowhere, and the pending-claims signal was a
 * rail badge — a count rather than the work. The four reads below close that
 * gap, and they are appended to this module rather than given their own
 * because they are the same page's data load.
 *
 * ---------------------------------------------------------------------------
 * THESE ARE `count()` CALLS. NONE OF THEM IS A COUNTER COLUMN. DO NOT
 * "OPTIMIZE" THEM.
 * ---------------------------------------------------------------------------
 * `src/server/claims/queries.ts` makes this argument for the rail badge and it
 * is restated here rather than cross-referenced, because the band is where the
 * temptation actually lands: three numbers on the first block of the page look
 * like something worth denormalizing. They are not. Every count below matches
 * the leading columns of an existing index — `@@index([tenantId, state,
 * placedAt])` on `Order`, `@@index([tenantId, active])` on `Product` — so at
 * pilot scale each is sub-millisecond on a request that already pays for a
 * session read and an organization read.
 *
 * The alternative that looks cheaper is a `lowStockCount`/`disputedCount` pair
 * on the tenant row. It is not cheaper, it is a new opportunity to be wrong on
 * every checkout, every restock, every claim confirmation and every dispute —
 * and a counter column that misses one of those makes the band lie. A band
 * that lies is strictly worse than no band: it either hides work a customer is
 * waiting on, or cries wolf until the merchant stops reading it. A number
 * derived from the rows cannot drift from the rows.
 *
 * ---------------------------------------------------------------------------
 * THE `tenantId` PARAMETER HERE IS CORRECT, AND IS NOT WHAT TEN-04 BANS.
 * ---------------------------------------------------------------------------
 * `tests/unit/no-tenant-id-param.test.ts` forbids a tenant identifier in an
 * exported signature under `src/server/merchant/**` and
 * `src/server/entitlements/**`, because on those surfaces the tenant must come
 * from `session.session.activeOrganizationId` and a parameter would be a field
 * a caller could substitute. This module is not on that surface and is not
 * reachable from a client: it opens with `server-only`, it exports no Server
 * Action, and its single caller — `src/app/(dashboard)/dashboard/page.tsx` —
 * has already resolved the tenant through `requireMerchantContext()`. The
 * isolation guarantee stays structural rather than trusted: `scopedDb` injects
 * the tenant predicate into every call it forwards, and
 * `tests/isolation/dashboard-attention.test.ts` asserts both directions of the
 * boundary with deliberately unequal per-tenant figures (T-06-18).
 */

/**
 * R-5. What "low" means, as one number.
 *
 * DELIBERATELY NOT A SCHEMA COLUMN AND NOT A PER-MERCHANT SETTING. A column
 * would have to be migrated, defaulted, exposed in settings and then migrated
 * again in Phase 9 (Inventory), which is where this becomes a real store-wide
 * merchant setting — three phases of carrying cost for zero pilot benefit. One
 * exported constant is the honest description of what the product enforces
 * today.
 *
 * `strings.dashboard.attention.lowStock` interpolates THIS EXACT VALUE into
 * its `{threshold}` placeholder, so the merchant reads "Items at or below 5 in
 * stock" and can then count the rows themselves. That is why the number must
 * live in exactly one place and why the comparison below is `lte` rather than
 * `lt`: the tile and the sentence printed under it have to agree.
 * `tests/isolation/dashboard-attention.test.ts` asserts the boundary from both
 * sides and scans this module and the band component for a second copy of the
 * literal.
 *
 * `SCREAMING_SNAKE_CASE` per the convention this codebase reserves for a
 * module-level constant that encodes a rule — the same register as
 * `STARTER_PRODUCT_CAP` and `ORDER_TRANSITIONS`.
 */
export const LOW_STOCK_THRESHOLD = 5;

/**
 * The state that means a customer says they have paid and nobody has checked.
 *
 * Named rather than inlined, and deliberately the SAME state the rail badge's
 * `pendingClaimCount` already means, so the band and the badge cannot disagree
 * about how many claims are waiting. Two surfaces showing two different
 * numbers for the same thing is how a merchant learns to trust neither.
 */
const CLAIM_WAITING_STATE: OrderState = OrderState.PAYMENT_CLAIMED;

/**
 * A payment this platform could not match — the merchant rejected the claim,
 * or the reference never reconciled. `EARNED_STATES` above excludes it for the
 * same reason this counts it: it is unfinished business with a customer.
 */
const DISPUTED_STATE: OrderState = OrderState.DISPUTED;

/** DASH-02's three signals, in the order the band renders them. */
export interface AttentionCounts {
  /** Orders in `PAYMENT_CLAIMED` — the claims queue, as work rather than a badge. */
  readonly pendingClaims: number;
  /** Live variants of live products at or below `LOW_STOCK_THRESHOLD`. */
  readonly lowStock: number;
  /** Orders in `DISPUTED`. */
  readonly disputedOrders: number;
}

/**
 * The three counts behind the `Needs your attention` band.
 *
 * One `Promise.all` of three tenant-scoped `count()` calls, matching
 * `overviewMetrics`'s shape above: the band is one block on the page, so it
 * costs one round of parallel reads rather than three sequential ones.
 *
 * ---------------------------------------------------------------------------
 * LOW STOCK IS A COUNT OF VARIANTS, AND ONLY OF SELLABLE ONES.
 * ---------------------------------------------------------------------------
 * `ProductVariant.stock` is the only place stock lives (D-04 / CAT-03), so the
 * count is over variants rather than products — a product with one sold-out
 * size and four full ones is one thing to reorder, not zero.
 *
 * Both `active` flags are required, and they exclude different things. A
 * PARKED VARIANT is a size the merchant removed from the matrix; a
 * DEACTIVATED PRODUCT is a whole product removed from the store (D-08 forbids
 * deleting either, so both rows live forever). Neither can be bought, so
 * neither is work — and counting them would make the band grow steadily and
 * permanently as a merchant tidies their catalogue, which is the fastest way
 * to teach someone to ignore it.
 *
 * The nested `product: { active: true }` filter does not pass through the
 * scope extension — `scopedDb` hooks client operations, not generated SQL. It
 * is tenant-safe by the stronger mechanism `src/server/claims/queries.ts`
 * documents: `ProductVariant.product` is declared
 * `@relation(fields: [tenantId, productId], references: [tenantId, id])`, so
 * the join predicate Postgres runs already carries this tenant's id and a
 * foreign product is not merely filtered out but impossible to have linked.
 */
export async function attentionCounts(
  tenantId: string,
): Promise<AttentionCounts> {
  const db = scopedDb(tenantId);

  const [pendingClaims, lowStock, disputedOrders] = await Promise.all([
    db.order.count({ where: { state: CLAIM_WAITING_STATE } }),
    db.productVariant.count({
      where: {
        active: true,
        stock: { lte: LOW_STOCK_THRESHOLD },
        product: { active: true },
      },
    }),
    db.order.count({ where: { state: DISPUTED_STATE } }),
  ]);

  return { pendingClaims, lowStock, disputedOrders };
}

/**
 * DASH-01's products clause — how many products are live in this store.
 *
 * `active: true` only, and that matches what `productLimitFor`'s cap already
 * counts (`src/server/catalog/actions.ts` refuses at `count >= limit` over
 * active products): the `{n} of {cap}` sub-line on the `Products live` card
 * would otherwise report a numerator and a denominator measured differently,
 * and a merchant reading "52 of 50" has no way to know which half is wrong.
 * Deactivated products are also exactly the ones a shopper cannot see, which
 * is what "live" says.
 */
export async function activeProductCount(tenantId: string): Promise<number> {
  return scopedDb(tenantId).product.count({ where: { active: true } });
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
