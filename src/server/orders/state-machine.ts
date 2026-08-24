import type { OrderChannel, OrderState } from "@/server/db/enums";

/**
 * ORD-01 — the order lifecycle, as data.
 *
 * The rules live in one table and one predicate, and nothing else in `src/`
 * decides whether a move is legal. That is the same discipline
 * `src/server/entitlements/plans.ts` applies to pricing tiers and
 * `src/server/db/tenant-scoped.ts` applies to the tenant registry: when the
 * rules are a value rather than a scattering of `if` statements, drifting from
 * them is a compile error at one place instead of a review catch at many.
 *
 * ---------------------------------------------------------------------------
 * "CART" IS A REDIS STATE, NOT AN `order` ROW. NOBODY MAY ADD A CART MEMBER.
 * ---------------------------------------------------------------------------
 * ORD-01 describes the customer's journey starting at a cart, and the natural
 * reading is that the cart is the first value of `Order.state`. It is not. The
 * cart is a Redis key with a TTL (RESEARCH.md Pattern 7) and it belongs to a
 * shopper who may never buy anything; the first PERSISTED state is
 * `ORDER_PLACED`, written by `placeOrder` at the moment stock is actually held.
 * Adding a `CART` member to the `OrderState` enum would put every abandoned
 * browse session into the `order` table, give the merchant queue a category of
 * rows that are not orders, and make `@@index([tenantId, state, placedAt])`
 * carry the platform's entire browsing traffic. `tests/unit/state-machine.test.ts`
 * asserts the state set stays at six.
 *
 * ---------------------------------------------------------------------------
 * WHY THE CHANNEL RULE IS A RULE AND NOT THREE TABLES.
 * ---------------------------------------------------------------------------
 * Two decisions push in the same direction:
 *
 *   D-02 — `PAYMENT_PENDING` and `PAYMENT_CLAIMED` exist ONLY on the
 *          manual-transfer path. A WhatsApp order is negotiated and confirmed
 *          in the conversation; a cash-on-delivery order is paid at the door.
 *          Neither has an in-band payment for the platform to be pending on.
 *   D-03 — `DISPUTED` is reachable only from a rejected payment claim, which is
 *          the same manual-transfer path, and never from `CONFIRMED` or
 *          `FULFILLED`.
 *
 * Both reduce to one sentence — *the claim-only states belong to the
 * manual-transfer channel* — so they are encoded as one `CLAIM_ONLY_STATES` set
 * checked once. Splitting the graph into a per-channel table instead would
 * triple the surface a future state has to be added to, and two of the three
 * copies would be identical, which is precisely the shape that drifts. Keeping
 * one readable graph plus one named exception is what lets
 * `tests/unit/state-machine.test.ts` restate the whole rule in two clauses and
 * sweep all 108 combinations against it.
 *
 * The threat this closes is T-03-15: without the channel clause, a
 * cash-on-delivery order could be walked into `DISPUTED` and used to fabricate
 * a payment dispute over a payment that was never in-band to begin with.
 *
 * PURE, BY CONSTRUCTION. No Prisma client, no I/O, no clock — which is what
 * makes this module importable from the database-free `unit` project. The
 * enums arrive as TYPES from `@/server/db/enums`, the one sanctioned door
 * (Pitfall 10); importing the generated client directly from here is an ESLint
 * error, and that rule is the TEN-02/TEN-05 enforcement mechanism rather than
 * style policing. The repository-wide audit for that boundary is a plain grep,
 * so this file deliberately does not even name the banned path in prose.
 */

/**
 * Every legal move, keyed by the state being left.
 *
 * `Readonly<Record<OrderState, …>>` and NOT a lookup-with-default: a seventh
 * enum member must be a COMPILE error at this table. A
 * `Partial<Record<…>>`-plus-`?? []` shape would instead make the new state
 * silently terminal — legal-looking, untested, and discovered by a merchant
 * whose order will not move.
 */
export const ORDER_TRANSITIONS: Readonly<
  Record<OrderState, readonly OrderState[]>
> = {
  // MANUAL_TRANSFER goes to PAYMENT_PENDING; WHATSAPP and CASH_ON_DELIVERY
  // are confirmed by the merchant directly (the channel rule below is what
  // keeps those two out of the payment path).
  ORDER_PLACED: ["PAYMENT_PENDING", "CONFIRMED"],
  PAYMENT_PENDING: ["PAYMENT_CLAIMED"],
  PAYMENT_CLAIMED: ["CONFIRMED", "DISPUTED"],
  // D-11: a dispute is recoverable. A corrected claim re-enters review rather
  // than dead-ending the order — the customer who mistyped a reference must
  // have a way back that does not involve the merchant deleting anything.
  DISPUTED: ["PAYMENT_CLAIMED"],
  CONFIRMED: ["FULFILLED"],
  // Terminal. Deliberately not `["CONFIRMED"]` for an "undo": reversing a
  // fulfilment is a new business event, not a state rewind, and it would make
  // the audit trail ambiguous about which fulfilment a later row describes.
  FULFILLED: [],
};

/**
 * The states that exist only on the manual-transfer path (D-02, D-03).
 *
 * Module-private on purpose. Exporting it would invite a caller to re-implement
 * the check — "is this order in a claim state?" — next to a different set of
 * conditions, and the whole value of this module is that there is one predicate
 * to read and one to test.
 */
const CLAIM_ONLY_STATES: ReadonlySet<OrderState> = new Set<OrderState>([
  "PAYMENT_PENDING",
  "PAYMENT_CLAIMED",
  "DISPUTED",
]);

/**
 * Whether `from -> to` is legal for an order on `channel`.
 *
 * Two clauses, and there must never be a third: the registry row must contain
 * the target, and a claim-only target requires the manual-transfer channel.
 * Anything else that wants to refuse a transition — the ORD-02 merchant-actor
 * rule, D-11's mandatory rejection reason — belongs in
 * `src/server/orders/transition.ts`, because those depend on WHO is acting and
 * WHAT they supplied, not on where the order is. Keeping this function a
 * function of `(channel, from, to)` alone is what makes it exhaustively
 * testable.
 */
export function canTransition(
  channel: OrderChannel,
  from: OrderState,
  to: OrderState,
): boolean {
  if (!ORDER_TRANSITIONS[from].includes(to)) return false;
  if (CLAIM_ONLY_STATES.has(to) && channel !== "MANUAL_TRANSFER") return false;
  return true;
}
