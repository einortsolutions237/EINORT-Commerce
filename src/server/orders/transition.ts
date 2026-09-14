import "server-only";

import type { EventActor, OrderChannel, OrderState } from "@/server/db/enums";
import type {
  OrderCreateInput,
  OrderEventCreateInput,
} from "@/server/db/model-inputs";
import { scopedCreateData, type ScopedTx } from "@/server/db/tenant-scoped";

import { InvalidTransitionError } from "./errors";
import { canTransition } from "./state-machine";
import type { OrderWriteTx } from "./write-client";

/**
 * ORD-01 + ORD-05 — the ONLY writer of `Order.state` in this codebase.
 *
 * ---------------------------------------------------------------------------
 * NOTHING ELSE IN `src/` MAY WRITE `Order.state`. THIS IS TESTED, NOT ASKED.
 * ---------------------------------------------------------------------------
 * `tests/unit/single-order-state-writer.test.ts` walks every `.ts`/`.tsx` file
 * under `src/`, strips comments, and fails the build if any file other than
 * this one passes `state:` to an `order` create/update/upsert. That test exists
 * because the alternative is a promise, and a promise does not survive four
 * more plans of checkout, claim review and merchant-queue code written under
 * time pressure.
 *
 * The reason the rule is worth a build gate: `Order.state` is what the customer
 * sees on the tracking page and what decides which buttons the merchant is
 * offered. If two code paths can write it, then ORD-05's audit trail is
 * advisory — the second writer moves the order and no `OrderEvent` records who
 * did it, so the history has a hole exactly where a dispute would need it
 * (T-03-12, T-03-14). One writer means "did this order move?" and "who moved
 * it?" cannot have different answers.
 *
 * ---------------------------------------------------------------------------
 * IT TAKES A `tx`. IT NEVER OPENS ONE.
 * ---------------------------------------------------------------------------
 * The state change and the audit row must be indivisible, so they are two
 * statements inside ONE transaction — and that transaction belongs to the
 * caller, because the caller almost always has other work that must be equally
 * indivisible: releasing a stock hold when a claim is rejected, re-holding it
 * when the claim is corrected (D-11), writing the claim row itself. If this
 * function opened a transaction of its own, the state change would commit while
 * the stock release was still in flight, and a crash in between would leave an
 * order that says DISPUTED over inventory that says sold.
 *
 * (That property is audited by grep, so the transaction-opening method is not
 * named anywhere in this file — not even to say it is not called.
 * `tests/isolation/order-audit.test.ts` proves the same thing behaviourally: a
 * legal move made earlier in the caller's transaction is rolled back when a
 * later call throws, which could not happen if each call committed alone.)
 *
 * `tx` is a TRANSACTION client, never a top-level one. An extended client hands
 * its transaction callback an extended `tx` (prisma/prisma#19565, proved against
 * a real Postgres in `tests/isolation/tenant-isolation.test.ts`), so when the
 * caller opened the transaction on `scopedDb` the tenant-scope extension still
 * injects `tenantId` into everything below. The frequently-cited
 * prisma/prisma#17948 — extension handlers issuing their own side queries that
 * escape the transaction — does not apply: `scopedDb`'s extension mutates `args`
 * and calls `query(a)`, and never opens a query of its own.
 *
 * ---------------------------------------------------------------------------
 * `tx` IS `OrderWriteTx`, NOT `ScopedTx`, AND THAT CHANGES WHO GUARDS THE TENANT.
 * ---------------------------------------------------------------------------
 * ADM-02 (plan 06-07) gives the platform owner the same one-tap confirm and
 * reject the merchant has, over any tenant's claim. The admin zone reads through
 * `adminDb`, cannot construct a `ScopedTx`, and — under `eslint.config.mjs` —
 * cannot even NAME that type. Rather than duplicate this function (the one thing
 * `tests/unit/single-order-state-writer.test.ts` exists to prevent), the
 * parameter was widened to `OrderWriteTx`: the structural minimum of delegate
 * operations enumerated from the body below. Read
 * `src/server/orders/write-client.ts` before touching either.
 *
 * The consequence is that the cross-tenant defence is now conditional on WHO
 * OPENED THE TRANSACTION, and both halves are deliberate:
 *
 *   - Opened on `scopedDb`: unchanged from before. The `where` of the read is
 *     rewritten by the extension, so another tenant's order id is a miss and a
 *     miss throws — the row is never visible, not filtered out after the fact.
 *
 *   - Opened on `adminDb`: there is no predicate, and there is not supposed to
 *     be. `Order.id` is a cuid, so the `where` below selects exactly one row or
 *     none; reaching another tenant's order is the authorised act, and the
 *     authorisation happened at `requireAdminContext()` before this function was
 *     ever called. What is NOT optional on that path is the audit row's tenant —
 *     see `order.tenantId` below.
 */

/**
 * The first state every order has. `openOrderAtGenesis` is the only writer.
 *
 * Named rather than inlined because the genesis state is a fact about the
 * lifecycle — ORD-01's entry point — and not a parameter a caller may choose. A
 * `placeOrder` that could pick its own starting state could place an order
 * directly into `CONFIRMED` and skip every guard in this file.
 */
const GENESIS_STATE: OrderState = "ORDER_PLACED";

/**
 * Everything an order needs at birth EXCEPT its state, which is not the
 * caller's to supply.
 *
 * No `state`, no `confirmedAt`, no `placedAt`: the first is fixed by
 * `GENESIS_STATE`, and the other two are stamped by the schema. What is left is
 * exactly the data the placement gathered — the channel, the customer, the
 * amounts it re-derived from the database, and the digest of the tracking
 * token.
 */
export interface OpenOrderArgs {
  readonly orderNumber: string;
  readonly channel: OrderChannel;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly deliveryAddress: string | null;
  readonly customerNote: string | null;
  readonly subtotalXaf: number;
  readonly totalXaf: number;
  /** The SHA-256 digest. The plaintext token is never persisted (D-12). */
  readonly trackingTokenHash: string;
  /** Whether the caller has already decremented inventory for these lines. */
  readonly stockHeld: boolean;
  /** ORD-05's *who* for the genesis row. `CUSTOMER` for a real checkout. */
  readonly actor: EventActor;
  readonly actorUserId?: string;
}

/**
 * ORD-05's genesis — create the order AND its first audit row, together.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS LIVES HERE AND NOT IN `place.ts`.
 * ---------------------------------------------------------------------------
 * 03-03 left the genesis write for a later plan and predicted exactly what
 * would happen when that plan arrived: `placeOrder` would call
 * `tx.order.create({ data: { …, state: "ORDER_PLACED" } })`, and
 * `tests/unit/single-order-state-writer.test.ts` would fire, because that IS a
 * second writer of `Order.state` by every definition the guard uses. The two
 * ways out were to add `place.ts` to the guard's allowlist, or to do what the
 * guard's own failure message says:
 *
 *   "If a genuinely new state-writing path is ever needed, it belongs INSIDE
 *    src/server/orders/transition.ts, not beside it."
 *
 * This is that. The allowlist route would have been the weaker choice by a wide
 * margin: an allowlist with two entries is an allowlist with three next quarter,
 * and the invariant would have decayed from "one writer" to "the writers we
 * happen to have blessed" — which is not a property anybody can check by
 * reading a file.
 *
 * Putting the create here makes the invariant STRONGER than 03-03 left it.
 * Before, "the genesis event is always written" was a promise held by whoever
 * wrote the placement. Now it is structural: there is no way to bring an
 * `Order` row into existence without the matching `OrderEvent` landing in the
 * same transaction, because the only function that can do the first also does
 * the second. Every row in `order` has a complete history from its first
 * instant, with no gap for a dispute to fall into (T-03-12, T-03-14).
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES NOT DO.
 * ---------------------------------------------------------------------------
 * No `canTransition` check, because there is nothing to check: a genesis has no
 * `from` state, and `ORDER_TRANSITIONS` is a map keyed by the state being left.
 * That asymmetry is the reason this is a separate function rather than a
 * `from: null` special case threaded through `transitionOrder` — a null-`from`
 * branch would put an `if` in front of every guard in that function and make
 * each one answer "does this apply to a creation?", which is four new ways to
 * get the ordinary path wrong.
 *
 * It also does NOT hold stock, price anything, or decide the channel's next
 * hop. `place.ts` owns all three; this function's whole job is that the row and
 * its first audit line are indivisible. `stockHeld` is passed in rather than
 * inferred for the same reason: whether inventory moved is a fact the caller
 * establishes, and inferring it here would be this module guessing about work
 * it did not do.
 *
 * Like `transitionOrder`, it takes the caller's `tx` and never opens one.
 */
export async function openOrderAtGenesis(
  tx: ScopedTx,
  args: OpenOrderArgs,
): Promise<{ id: string; orderNumber: string }> {
  const order = await tx.order.create({
    data: scopedCreateData<OrderCreateInput>({
      orderNumber: args.orderNumber,
      state: GENESIS_STATE,
      channel: args.channel,
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      deliveryAddress: args.deliveryAddress,
      customerNote: args.customerNote,
      subtotalXaf: args.subtotalXaf,
      totalXaf: args.totalXaf,
      trackingTokenHash: args.trackingTokenHash,
      stockHeld: args.stockHeld,
    }),
    select: { id: true, orderNumber: true },
  });

  // `fromState: null` exactly once per order, and only here. That null is what
  // makes the audit trail readable end to end: the row with no predecessor is
  // unambiguously the beginning, so "how did this order get to DISPUTED?" is a
  // walk from a known origin rather than a guess about which row came first.
  await tx.orderEvent.create({
    data: scopedCreateData<OrderEventCreateInput>({
      orderId: order.id,
      fromState: null,
      toState: GENESIS_STATE,
      actor: args.actor,
      actorUserId: args.actorUserId ?? null,
      reason: null,
    }),
  });

  return order;
}

export interface TransitionOrderArgs {
  readonly orderId: string;
  readonly to: OrderState;
  /** Who is acting. The audit row's subject; see the ORD-02 guard below. */
  readonly actor: EventActor;
  /** `MerchantContext.userId`. Required when `actor` is `MERCHANT`. */
  readonly actorUserId?: string;
  /** D-11: mandatory when `to` is `DISPUTED`. Shown to the customer. */
  readonly reason?: string;
}

export async function transitionOrder(
  tx: OrderWriteTx,
  args: TransitionOrderArgs,
): Promise<void> {
  // On a scoped transaction this is scoped by the extension: another tenant's
  // id is a miss, and a miss throws. On an admin transaction the cuid is the
  // whole selector and crossing tenants is the authorised act — see the header.
  //
  // `select` is narrow on purpose — this function needs four columns, and
  // reading the whole row would invite a later edit to start making decisions
  // on data the transition rules are not a function of.
  const order = await tx.order.findUniqueOrThrow({
    where: { id: args.orderId },
    select: { id: true, state: true, channel: true, tenantId: true },
  });

  // ORD-01 + D-02/D-03. The graph and the channel rule, in one call.
  if (!canTransition(order.channel, order.state, args.to)) {
    throw new InvalidTransitionError(order.state, args.to, order.channel);
  }

  // ORD-02. The state graph says PAYMENT_CLAIMED -> CONFIRMED is legal; it does
  // NOT say who may do it. This line does. A customer confirming their own
  // payment is the whole failure the manual-transfer flow exists to prevent —
  // without it, "I have paid" and "the merchant agrees I paid" become the same
  // event and the claim-review step is decorative (T-03-13).
  if (args.to === "CONFIRMED" && args.actor !== "MERCHANT") {
    throw new InvalidTransitionError(
      order.state,
      args.to,
      order.channel,
      `Only a MERCHANT may confirm an order; the actor was ${args.actor}.`,
    );
  }

  // ORD-05's *who*, enforced rather than hoped for. A MERCHANT-actor event with
  // no user id is an anonymous row in the one place the audit trail has to name
  // a person, and it is silently producible — `actorUserId` is optional in this
  // signature because CUSTOMER and SYSTEM events genuinely have none. Every
  // merchant call site has a `MerchantContext.userId` to pass, so this cannot
  // be a burden; it can only catch a caller that forgot (T-03-12).
  if (args.actor === "MERCHANT" && !args.actorUserId) {
    throw new InvalidTransitionError(
      order.state,
      args.to,
      order.channel,
      "A MERCHANT transition must carry actorUserId so the audit row can " +
        "name who acted.",
    );
  }

  // D-11. A rejection with no reason leaves the customer looking at a DISPUTED
  // order and no way to work out what to correct, which makes the resubmission
  // path the same decision unavailable. The caller's Zod schema enforces a
  // minimum length too; this is the server-side floor that survives a caller
  // that forgets one — and callers here include an anonymous path, so "the form
  // validates it" is not a property of the system.
  if (args.to === "DISPUTED" && (args.reason ?? "").trim().length === 0) {
    throw new InvalidTransitionError(
      order.state,
      args.to,
      order.channel,
      "A dispute must carry a non-empty reason (D-11).",
    );
  }

  await tx.order.update({
    where: { id: order.id },
    data: {
      state: args.to,
      // Stamped here rather than by the caller so "when was this confirmed?"
      // has exactly one answer, written in the same statement that made it
      // true.
      ...(args.to === "CONFIRMED" ? { confirmedAt: new Date() } : {}),
    },
  });

  /*
   * ORD-05, in the SAME transaction as the state change above. A SEPARATE
   * `create` and deliberately NOT a nested write off the `order.update`: the
   * tenant-scope extension hooks client operations, not the generated SQL, so a
   * nested create never passes through it and would land with no `tenantId`
   * stamp (Pitfall 1/4).
   *
   * -------------------------------------------------------------------------
   * `tenantId` COMES FROM THE ORDER ROW. IT IS NEVER A PARAMETER, AND IT IS NOT
   * THE EXTENSION'S STAMP EITHER.
   * -------------------------------------------------------------------------
   * This is the one line the `OrderWriteTx` widening actually required, and
   * removing it breaks the admin path silently-then-loudly rather than
   * obviously. `OrderEvent.tenantId` is `NOT NULL` with no default, and the row
   * carries a composite foreign key to `Order(tenantId, id)`. On a transaction
   * opened against `adminDb` nothing injects the column, so `scopedCreateData`'s
   * deliberately `tenantId`-less payload would be a NOT NULL violation; a
   * GUESSED tenant would be a foreign-key violation. The only correct value is
   * the one on the order this event describes, which was read three statements
   * ago inside this same transaction.
   *
   * It is equally correct on the merchant path, and provably not a TEN-08
   * regression. The read above was itself scoped, so `order.tenantId` IS the
   * caller's tenant; and `scopedDb`'s extension spreads its own `tenantId` LAST
   * into a create payload, so even if the two ever disagreed the extension's
   * value — not this one — is what reaches the database. The value is derived
   * from a row, never accepted from a caller: `TransitionOrderArgs` has no
   * tenant field and must never grow one, because a tenant a CALLER supplies is
   * exactly the substitution `scopedCreateData`'s own header warns about.
   */
  await tx.orderEvent.create({
    data: {
      tenantId: order.tenantId,
      orderId: order.id,
      fromState: order.state,
      toState: args.to,
      actor: args.actor,
      actorUserId: args.actorUserId ?? null,
      reason: args.reason ?? null,
    } satisfies OrderEventCreateInput,
  });
}
