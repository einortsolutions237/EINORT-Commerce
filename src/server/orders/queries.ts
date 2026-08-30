import "server-only";

import type {
  EventActor,
  OrderChannel,
  OrderState,
  PaymentOperator,
} from "@/server/db/enums";
import { scopedDb } from "@/server/db/tenant-scoped";

/**
 * The merchant's read side of an order (ORD-01 / ORD-05).
 *
 * ---------------------------------------------------------------------------
 * THE `tenantId` PARAMETER IS CORRECT HERE, AND IS NOT WHAT TEN-04 BANS.
 * ---------------------------------------------------------------------------
 * `tests/unit/no-tenant-id-param.test.ts` forbids a tenant identifier in an
 * exported signature under `src/server/merchant/**` and
 * `src/server/entitlements/**`, because on those surfaces the tenant must come
 * from the session and a parameter would be a field a caller could substitute.
 * This module is not on that surface and is not reachable from a client: the
 * import at the top of this file keeps its module out of any client bundle,
 * it exports no Server Action, and both callers are Server Components that
 * have already resolved the tenant through
 * `requireMerchantContext()`. `src/server/claims/queries.ts` is the precedent
 * and states the same distinction.
 *
 * The isolation guarantee stays structural rather than trusted: `scopedDb`
 * rewrites the `where` of every operation below, `Order`, `OrderItem`,
 * `OrderEvent` and `PaymentClaim` are all in `TENANT_SCOPED_MODELS`, and
 * `tests/isolation/model-registry-drift.test.ts` fails if one ever is not.
 *
 * ---------------------------------------------------------------------------
 * THE NESTED RELATION READS ARE SAFE FOR A DIFFERENT REASON. SAY IT OUT LOUD.
 * ---------------------------------------------------------------------------
 * `scopedDb`'s extension hooks the CLIENT operation, not the generated SQL, so
 * the `claims`, `items` and `events` selections below do NOT pass through it —
 * the same documented hole that makes nested writes dangerous (Pitfall 4).
 * They are nonetheless tenant-safe, and by a stronger mechanism than the
 * extension: every one of those relations is declared in `prisma/schema.prisma`
 * as `@relation(fields: [tenantId, orderId], references: [tenantId, id])`, so
 * the join predicate Postgres runs already carries the parent's `tenantId`.
 * A child row belonging to another tenant cannot be reached through a parent
 * this tenant can see, because the composite foreign key made that row
 * impossible to create in the first place (T-03-01, T-03-53).
 *
 * This is worth writing down because the reflex on reading a nested `select`
 * under a tenant-scoped client is to add a redundant `where: { tenantId }` to
 * it — which would read as the thing keeping it safe, and would quietly become
 * load-bearing in a reader's mind while the real control (the composite FK)
 * went unmentioned.
 */

/**
 * 03-UI-SPEC.md § A3's six filter chips, in render order.
 *
 * `as const` so the URL parameter can be validated against the same array the
 * page renders from — one list, and a seventh filter cannot appear in the UI
 * without also becoming a legal `?filter=` value.
 */
export const ORDER_FILTERS = [
  "all",
  "needs-attention",
  "awaiting-payment",
  "confirmed",
  "fulfilled",
  "disputed",
] as const;

export type OrderFilter = (typeof ORDER_FILTERS)[number];

/**
 * Which states each chip selects. `null` means "no state predicate at all".
 *
 * MODULE-PRIVATE on purpose. Exporting it would invite a page to re-derive
 * "which orders need attention?" beside a different list, and the whole value
 * of naming the filters here is that the definition of `needs-attention` —
 * placed orders plus claimed payments, per A3 — exists once.
 *
 * `Readonly<Record<OrderFilter, …>>` and not a lookup-with-default: adding a
 * chip to `ORDER_FILTERS` without deciding what it selects is a compile error
 * here rather than a chip that silently shows everything.
 */
const FILTER_STATES: Readonly<Record<OrderFilter, readonly OrderState[] | null>> =
  {
    all: null,
    // A3's definition, verbatim: a new order the merchant has not acted on, or
    // a payment a customer says they have made. Both are work waiting on a
    // human, which is what makes this the default landing filter.
    "needs-attention": ["ORDER_PLACED", "PAYMENT_CLAIMED"],
    "awaiting-payment": ["PAYMENT_PENDING"],
    confirmed: ["CONFIRMED"],
    fulfilled: ["FULFILLED"],
    disputed: ["DISPUTED"],
  };

export interface OrderListRow {
  readonly id: string;
  readonly orderNumber: string;
  readonly state: OrderState;
  readonly channel: OrderChannel;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly totalXaf: number;
  readonly placedAt: Date;
  /** The most recent claim's rail, for the channel chip's sub-label. */
  readonly operator: PaymentOperator | null;
}

export interface OrderListResult {
  readonly orders: readonly OrderListRow[];
  /** Every chip's count, from one `groupBy` rather than six `count()` calls. */
  readonly counts: Readonly<Record<OrderFilter, number>>;
}

/**
 * Every order this tenant has taken that matches `filter`, newest first.
 *
 * ORDERED `placedAt desc` AND FILTERED BY `state` DELIBERATELY, in that
 * combination: `Order` carries `@@index([tenantId, state, placedAt])`, and
 * `scopedDb` puts `tenantId` into the `where` before this reaches Postgres, so
 * the filtered queries ride all three index columns. The unfiltered `all` chip
 * rides the first and third.
 *
 * The counts come back in the SAME round trip as the rows. A3's default-filter
 * rule needs to know whether anything needs attention before it can decide
 * which chip to land on, and asking that question with a second query would
 * make every orders-page render pay for two.
 */
export async function listOrdersForMerchant(
  tenantId: string,
  filter: OrderFilter,
): Promise<OrderListResult> {
  const db = scopedDb(tenantId);
  const states = FILTER_STATES[filter];

  const [rows, grouped] = await Promise.all([
    db.order.findMany({
      where: states === null ? {} : { state: { in: [...states] } },
      orderBy: { placedAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        state: true,
        channel: true,
        customerName: true,
        customerPhone: true,
        totalXaf: true,
        placedAt: true,
        // Newest claim only: a corrected re-submission (D-11) supersedes the
        // one it replaces, and the chip has room for one rail name.
        claims: {
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: { operator: true },
        },
      },
    }),
    db.order.groupBy({ by: ["state"], _count: { _all: true } }),
  ]);

  const perState = new Map<OrderState, number>();
  for (const group of grouped) perState.set(group.state, group._count._all);

  let total = 0;
  for (const count of perState.values()) total += count;

  const counts = Object.fromEntries(
    ORDER_FILTERS.map((name) => {
      const selected = FILTER_STATES[name];
      if (selected === null) return [name, total];
      let sum = 0;
      for (const state of selected) sum += perState.get(state) ?? 0;
      return [name, sum];
    }),
  ) as Record<OrderFilter, number>;

  return {
    orders: rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      state: row.state,
      channel: row.channel,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      totalXaf: row.totalXaf,
      placedAt: row.placedAt,
      operator: row.claims[0]?.operator ?? null,
    })),
    counts,
  };
}

/**
 * WHO an audit row is about, as a presentational category rather than as the
 * `EventActor` enum member it was derived from.
 *
 * 03-UI-SPEC.md § A4 requires the trail to read `You`, the customer's name, or
 * `Automatic`, and § Copywriting Contract forbids an internal identifier from
 * reaching a merchant's screen at all. Doing the mapping HERE rather than on
 * the page means the enum member never crosses into
 * `src/app/(dashboard)/dashboard/orders/**` — which is checkable by grep, and
 * is checked.
 *
 * `"self"` rather than `"merchant"` on purpose: this describes the reader's
 * relationship to the event, which is what the copy says.
 */
export type OrderEventActorKind = "self" | "customer" | "automatic";

const ACTOR_KINDS: Readonly<Record<EventActor, OrderEventActorKind>> = {
  MERCHANT: "self",
  CUSTOMER: "customer",
  SYSTEM: "automatic",
};

export interface OrderDetailEvent {
  readonly id: string;
  /** `null` on the genesis row, and only there — it reads `Order placed`. */
  readonly fromState: OrderState | null;
  readonly toState: OrderState;
  readonly actorKind: OrderEventActorKind;
  /** D-11's rejection reason, when the event carried one. */
  readonly reason: string | null;
  readonly createdAt: Date;
}

/**
 * One order, everything the A4 page renders, or `null` when this tenant has no
 * such order — including when the id is real and belongs to somebody else.
 *
 * The `null` is the whole cross-tenant defence (T-03-53). `scopedDb` rewrites
 * the `where` into `{ id, tenantId }`, so a foreign id is a miss rather than a
 * read, and the page turns a miss into `notFound()`. There is no tenant check
 * written out below because there is nothing for one to add.
 */
export async function getOrderDetail(tenantId: string, orderId: string) {
  const order = await scopedDb(tenantId).order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      state: true,
      channel: true,
      customerName: true,
      customerPhone: true,
      deliveryAddress: true,
      customerNote: true,
      subtotalXaf: true,
      totalXaf: true,
      placedAt: true,
      confirmedAt: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productName: true,
          variantLabel: true,
          unitPriceXaf: true,
          quantity: true,
          lineTotalXaf: true,
          imageKey: true,
        },
      },
      claims: {
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          operator: true,
          reference: true,
          status: true,
          submittedAt: true,
          rejectionReason: true,
        },
      },
      events: {
        // Newest first, as A4 reads it. `id` is a tiebreaker rather than a
        // second sort key with meaning: `createdAt` defaults to the
        // TRANSACTION timestamp, so two events written in one transaction
        // share it exactly, and without a tiebreaker their order would differ
        // between renders of the same page.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          fromState: true,
          toState: true,
          actor: true,
          reason: true,
          createdAt: true,
        },
      },
    },
  });

  if (!order) return null;

  const { events, ...rest } = order;

  return {
    ...rest,
    events: events.map(
      (event): OrderDetailEvent => ({
        id: event.id,
        fromState: event.fromState,
        toState: event.toState,
        actorKind: ACTOR_KINDS[event.actor],
        reason: event.reason,
        createdAt: event.createdAt,
      }),
    ),
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;
