import "server-only";

import type { ScopedTx } from "@/server/db/tenant-scoped";

import { OutOfStockError } from "./errors";

/**
 * CAT-03 / D-04 — moving inventory, atomically, without a lock of our own.
 *
 * ---------------------------------------------------------------------------
 * WHY THE CONDITIONAL `updateMany` IS CORRECT, NOT MERELY CONVENIENT.
 * ---------------------------------------------------------------------------
 * The decrement below is a single statement whose `WHERE` carries its own
 * precondition:
 *
 *     UPDATE product_variant SET stock = stock - $q
 *      WHERE id = $id AND active AND stock >= $q
 *
 * At READ COMMITTED — Postgres's default, and what Prisma opens a transaction
 * with — an `UPDATE` that finds a row already locked by another uncommitted
 * transaction WAITS for that transaction, and then RE-EVALUATES its `WHERE`
 * clause against the newly committed row version. It does not proceed on the
 * snapshot it started with. So when two placements race for the last unit, the
 * loser re-checks `stock >= 1` against `stock = 0`, matches nothing, and reports
 * zero rows updated. `count === 0` is therefore not "probably sold out" — it is
 * the database telling us the precondition was false at the instant of the
 * write. Overselling is impossible by construction rather than by timing.
 *
 * `tests/isolation/stock-race.test.ts` proves it with two genuinely overlapping
 * transactions, because a comment claiming a concurrency property is worth
 * nothing.
 *
 * ---------------------------------------------------------------------------
 * THE ALTERNATIVES, AND WHY EACH ONE IS WORSE. DO NOT "UPGRADE" THIS.
 * ---------------------------------------------------------------------------
 *   - The classic pessimistic pair: take an explicit row lock with a locking
 *     `SELECT`, then issue a plain update. Needs a raw query, and
 *     `eslint.config.mjs` bans raw queries outright under `src/` because they
 *     are NOT intercepted by the tenant-scope extension. Reaching for one here
 *     would trade a tenant-isolation guarantee for a concurrency guarantee we
 *     already have.
 *   - An optimistic `version` column. Buys exactly the same guarantee, and
 *     costs a read, a write, a retry loop, and a new class of "retried too many
 *     times" failure at checkout.
 *   - `Serializable` isolation. Correct, and pushes P2034 serialization
 *     failures onto every caller of the placement transaction — including the
 *     ones that are not touching stock at all.
 *   - A Redis mutex. Adds a failure mode the database cannot have: a lock held
 *     by a process that died, blocking sales until a TTL nobody tuned expires.
 *
 * ---------------------------------------------------------------------------
 * NEITHER FUNCTION OPENS A TRANSACTION. BOTH TAKE THE CALLER'S.
 * ---------------------------------------------------------------------------
 * A hold that committed on its own would decrement stock for an order that the
 * next statement then failed to write — inventory sold to nobody, invisible
 * until a merchant counts their shelves. Same for a release: it must vanish
 * together with the state change that justified it. So both take a `ScopedTx`,
 * and the tenant scope rides along with it (prisma/prisma#19565): there is no
 * `tenantId` parameter here because the extension rewrites every `where` below,
 * which is also what makes a cross-tenant variant id match zero rows instead of
 * decrementing someone else's inventory.
 *
 * ---------------------------------------------------------------------------
 * `holdStockForLines` IS DELIBERATELY CALLABLE OUTSIDE PLACEMENT.
 * ---------------------------------------------------------------------------
 * D-04 releases the hold when a payment claim is rejected and RE-HOLDS it when
 * a corrected claim is accepted (03-RESEARCH.md § Assumptions Log A6, the
 * `DISPUTED -> PAYMENT_CLAIMED` hop that plan 03-15 owns). That re-hold uses
 * this same function and CAN legitimately fail, because the units may have sold
 * during the dispute window. A caller in that position must refuse the
 * resubmission with an explicit out-of-stock message — it must NOT move the
 * order and leave the stock unheld, which would put an order into the payment
 * path over inventory that belongs to somebody else's order.
 */

/** One cart line, reduced to the only two fields stock cares about. */
export interface StockLine {
  readonly variantId: string;
  readonly quantity: number;
}

/**
 * A COPY of `rows`, ordered by `variantId`. The deadlock fix, in one place.
 *
 * 03-RESEARCH.md Pitfall 5: two transactions that touch variants A and B in
 * opposite sequence each hold the row lock the other needs next, Postgres
 * detects the cycle and kills one with `40P01`, and a shopper sees a 500 at the
 * moment they pay. Taking the locks in a consistent GLOBAL order makes the
 * cycle unconstructible — and any total order works, so the variant id is used
 * because both functions below already have it.
 *
 * ONE definition, used by the hold AND the release, because a release that
 * ordered its increments differently from the way holds order their decrements
 * would reopen exactly the cycle this closes. `tests/isolation/stock-race.test.ts`
 * runs the opposite-order case concurrently to keep it honest.
 *
 * A copy, never the caller's array: `placeOrder` builds its line-item snapshots
 * from the same input it passes here, and silently reordering a caller's array
 * is the kind of side effect that produces a bug three files away.
 */
function sortedByVariant<T extends { variantId: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => a.variantId.localeCompare(b.variantId));
}

/**
 * Decrement every line's variant, or throw and let the caller's transaction
 * roll all of them back.
 *
 * `sortedByVariant` is the deadlock fix and is not optional — see its doc
 * comment. It runs BEFORE the loop, so the lock order is fixed no matter what
 * sequence the cart happened to arrive in.
 */
export async function holdStockForLines(
  tx: ScopedTx,
  lines: readonly StockLine[],
): Promise<void> {
  for (const line of sortedByVariant(lines)) {
    const { count } = await tx.productVariant.updateMany({
      // `active: true` belongs in the predicate rather than in a prior read:
      // a merchant deactivating a variant mid-checkout must fail the hold, and
      // a separate read-then-write would leave a window where it does not.
      where: {
        id: line.variantId,
        active: true,
        stock: { gte: line.quantity },
      },
      data: { stock: { decrement: line.quantity } },
    });

    // Zero rows means one of three things — sold out, deactivated, or another
    // tenant's id — and all three are "this line cannot be bought right now".
    // Throwing is what rolls back the lines already held above.
    if (count === 0) throw new OutOfStockError(line.variantId);
  }
}

/**
 * Return an order's held units to inventory, at most once (Pattern 2b).
 *
 * ---------------------------------------------------------------------------
 * THE FLAG IS CLAIMED ATOMICALLY BEFORE ANYTHING IS INCREMENTED.
 * ---------------------------------------------------------------------------
 * The obvious implementation reads the order, checks `state === "DISPUTED"` (or
 * `stockHeld === true`), and then increments. That version double-releases:
 * two rejections submitted at once, a merchant double-tapping "Reject", or a
 * retried Server Action both read `true` and both add the units back. The
 * result is inventory that says five when the shelf holds three — and the
 * merchant then oversells FOR REAL, having been told by their own dashboard
 * that the units existed. That is strictly worse than the overselling
 * `holdStockForLines` prevents, because nothing in the system contradicts it.
 *
 * So the first statement is a conditional `updateMany` predicated on the flag
 * still being set, which flips it and reports whether it was the one to do so. The loser sees
 * `count === 0` and returns having changed nothing. Only the winner proceeds to
 * the increments, and both halves are inside the caller's transaction, so a
 * failure after the claim un-claims it too.
 *
 * Deliberately keyed on `stockHeld` rather than on `Order.state`: the flag
 * records what is TRUE of inventory, while the state records where the order is
 * in its lifecycle. Those come apart — D-04 re-holds stock on an accepted
 * resubmission without the state going backwards — and keying the release on
 * the state would make the re-held units releasable a second time.
 *
 * This primitive is also why 03-RESEARCH.md § Open Questions could close item 1
 * — no `CANCELLED` state in V1 — without painting the design into a corner: a
 * future "cancel a stale order" action is a call to this function plus a
 * transition, not a redesign.
 */
export async function releaseStock(
  tx: ScopedTx,
  orderId: string,
): Promise<void> {
  const { count } = await tx.order.updateMany({
    where: { id: orderId, stockHeld: true },
    data: { stockHeld: false },
  });

  // Already released — by an earlier call, by a concurrent one, or by an order
  // that never held stock at all. Returning silently is correct: the
  // postcondition the caller wants ("this order holds no stock") is true.
  if (count === 0) return;

  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { variantId: true, quantity: true },
  });

  // Sorted for the same reason the hold is, and by the same function: a
  // release and a concurrent hold touching the same two variants would
  // otherwise be able to form the lock cycle Pitfall 5 describes.
  for (const item of sortedByVariant(items)) {
    // No `gte` guard and no count check: an increment has no precondition that
    // can fail, and a variant deleted since the order was placed simply matches
    // nothing. Refusing to release the rest of the order because one variant
    // is gone would strand real inventory.
    await tx.productVariant.updateMany({
      where: { id: item.variantId },
      data: { stock: { increment: item.quantity } },
    });
  }
}
