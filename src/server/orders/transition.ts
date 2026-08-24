import "server-only";

import type { EventActor, OrderState } from "@/server/db/enums";
import type { OrderEventCreateInput } from "@/server/db/model-inputs";
import { scopedCreateData, type ScopedTx } from "@/server/db/tenant-scoped";

import { InvalidTransitionError } from "./errors";
import { canTransition } from "./state-machine";

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
 * function opened its own `$transaction`, the state change would commit while
 * the stock release was still in flight, and a crash in between would leave an
 * order that says DISPUTED over inventory that says sold.
 *
 * `tx` is a `ScopedTx`, never a `ScopedDb`. An extended client's `$transaction`
 * hands the callback an extended `tx` (prisma/prisma#19565, proved against a
 * real Postgres in `tests/isolation/tenant-isolation.test.ts`), so the
 * tenant-scope extension still injects `tenantId` into everything below. The
 * frequently-cited prisma/prisma#17948 — extension handlers issuing their own
 * side queries that escape the transaction — does not apply: `scopedDb`'s
 * extension mutates `args` and calls `query(a)`, and never opens a query of its
 * own.
 *
 * That scoping is also the cross-tenant defence here. There is no `tenantId`
 * parameter and no tenant check written out below, because the `where` clause
 * of the read is rewritten by the extension: pass another tenant's order id and
 * `findUniqueOrThrow` finds nothing and throws, rather than transitioning it.
 */

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
  tx: ScopedTx,
  args: TransitionOrderArgs,
): Promise<void> {
  // Scoped by the extension: another tenant's id is a miss, and a miss throws.
  // `select` is narrow on purpose — this function needs three columns, and
  // reading the whole row would invite a later edit to start making decisions
  // on data the transition rules are not a function of.
  const order = await tx.order.findUniqueOrThrow({
    where: { id: args.orderId },
    select: { id: true, state: true, channel: true },
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

  // ORD-05, in the SAME transaction as the state change above. A SEPARATE
  // `create` and deliberately NOT a nested write off the `order.update`: the
  // tenant-scope extension hooks client operations, not the generated SQL, so a
  // nested create never passes through it and would land with no `tenantId`
  // stamp (Pitfall 1/4). `scopedCreateData` is the compile-time half of the
  // same rule — it omits `tenantId` from the payload precisely because the
  // extension supplies it and a caller-supplied one would be overwritten
  // (TEN-08).
  await tx.orderEvent.create({
    data: scopedCreateData<OrderEventCreateInput>({
      orderId: order.id,
      fromState: order.state,
      toState: args.to,
      actor: args.actor,
      actorUserId: args.actorUserId ?? null,
      reason: args.reason ?? null,
    }),
  });
}
