"use server";

import { z } from "zod";

import { strings } from "@/lib/strings";
import { scopedDb } from "@/server/db/tenant-scoped";
import { merchantAction, type ActionResult } from "@/server/merchant/action";
import {
  AlreadyReviewedError,
  InvalidTransitionError,
  OutOfStockError,
} from "@/server/orders/errors";
import {
  holdStockForLines,
  markStockHeld,
  releaseStock,
} from "@/server/orders/stock";
import { transitionOrder } from "@/server/orders/transition";

/**
 * ORD-02 / ORD-03 / D-04 / D-11 — the merchant is the judge, and this file is
 * the whole courtroom.
 *
 * ---------------------------------------------------------------------------
 * THE ONLY PLACE IN `src/` THAT WRITES `PaymentClaim.status`. THIS IS TESTED.
 * ---------------------------------------------------------------------------
 * `tests/isolation/claims.test.ts` scans the source tree and fails if any other
 * module sets a claim's status to `CONFIRMED`. That guard is the structural half
 * of ORD-02: the requirement is not "we do not auto-confirm payments", it is
 * "there is nowhere an auto-confirmation could be written". A customer-facing
 * submission path (plan 03-15) that flipped a claim to CONFIRMED after its own
 * validation would satisfy every behavioural test in this repository and quietly
 * turn "I have paid" and "the merchant agrees I paid" into one event (T-03-65).
 *
 * The other half is enforced one level down and deliberately NOT duplicated
 * here: `transitionOrder` refuses `to: "CONFIRMED"` for any actor that is not
 * `MERCHANT`, and refuses `to: "DISPUTED"` with a blank reason (D-11). Both
 * guards are re-stated in this file's comments and in neither case in its code,
 * because a second copy of a rule is a second copy to drift out of agreement
 * with the first.
 *
 * ---------------------------------------------------------------------------
 * EVERY ACTION IS ONE TRANSACTION, AND THE `PENDING` GUARD IS INSIDE IT.
 * ---------------------------------------------------------------------------
 * A merchant with two tabs open is the NORMAL case, not an attack (T-03-67). So
 * each action reads the claim, checks its status, updates it, moves the order
 * and moves the stock inside a single `$transaction` — and the status check is
 * the optimistic lock. RESEARCH.md Open Question 5 settles that this is
 * sufficient at pilot scale: the loser of the race re-reads a row the winner has
 * already flipped, throws `AlreadyReviewedError`, and rolls back having changed
 * nothing. Without the guard inside the transaction, two rejections would each
 * write an `OrderEvent` and each release the stock — and D-04's "exactly once"
 * would be a coin toss.
 *
 * ---------------------------------------------------------------------------
 * NO `tenantId` PARAMETER, AND NO CLAIM OWNERSHIP CHECK WRITTEN OUT BELOW.
 * ---------------------------------------------------------------------------
 * `merchantAction` resolves the tenant from the session, and `scopedDb` rewrites
 * the `where` of every read and write. A merchant posting another tenant's claim
 * id therefore hits a `findUniqueOrThrow` that finds nothing — the row is not
 * filtered out after being read, it is never visible — and the throw rolls back
 * before any audit row exists (T-03-66). That failure is deliberately NOT
 * softened into a readable refusal: "that claim is not yours" is an existence
 * oracle over another tenant's ids, and `src/server/orders/actions.ts` states
 * the same reasoning at length.
 *
 * `"use server"` is the first line and there is deliberately no
 * `import "server-only"` beside it: the two markers are mutually exclusive.
 */

/** Confirm and reopen take a claim id and nothing else. */
const claimIdSchema = z.object({ claimId: z.string().min(1) });

/**
 * D-11's reason, as a schema rather than as a hope.
 *
 * `.trim()` runs BEFORE the length check, so three spaces is a two-character
 * reason and is refused — which is the shape a merchant hammering the keyboard
 * to get past a required field actually produces. `min(3)` is the floor that
 * makes the reason worth showing a customer; `max(200)` is the ceiling that
 * keeps it renderable on a tracking page. `transitionOrder` independently
 * refuses a blank reason, and that redundancy is intentional: this schema
 * protects the copy quality, that guard protects the invariant (T-03-68).
 */
const rejectSchema = z.object({
  claimId: z.string().min(1),
  reason: z.string().trim().min(3).max(200),
});

/**
 * Turn the three refusals a review can legitimately produce into something the
 * merchant can act on, and rethrow everything else.
 *
 * All three are ordinary, not exceptional: the order moved in another tab, the
 * claim was reviewed in another tab, the units sold during the dispute window.
 * Letting any of them escape would answer a routine race with a 500 and give the
 * merchant no way to guess the remedy.
 *
 * Everything else rethrows — including the cross-tenant miss, which arrives as a
 * Prisma error and must stay one. An unexpected failure dressed up as a refusal
 * is a bug hidden from both the merchant and the logs.
 *
 * `outOfStockCopy` is passed in rather than resolved here because only the
 * caller knows which item sold out; `confirmClaim` and `rejectClaim` pass
 * `undefined` because neither can raise `OutOfStockError` at all.
 */
function refusalOrRethrow(
  error: unknown,
  outOfStockCopy?: string,
): ActionResult {
  if (error instanceof AlreadyReviewedError) {
    return { ok: false, error: { form: [strings.claims.alreadyReviewed] } };
  }
  if (error instanceof InvalidTransitionError) {
    // Reused from the orders surface on purpose — it is the same event, seen by
    // the same merchant, and `src/lib/strings.ts` forbids writing one sentence
    // twice.
    return { ok: false, error: { form: [strings.orders.staleAction] } };
  }
  if (error instanceof OutOfStockError && outOfStockCopy) {
    return { ok: false, error: { form: [outOfStockCopy] } };
  }
  throw error;
}

/**
 * ORD-03's one tap: the merchant agrees the money arrived.
 *
 * ---------------------------------------------------------------------------
 * IT MOVES NO STOCK, AND THAT IS THE CORRECT BEHAVIOUR.
 * ---------------------------------------------------------------------------
 * The units were decremented and held at placement (D-04). A confirmed sale
 * keeps them held — they are leaving the shelf, not returning to it — so a
 * decrement here would double-count every manual-transfer order in the product,
 * and an increment would put sold goods back on sale. Confirmation is purely the
 * merchant's assent; inventory already moved when the customer checked out.
 *
 * `actor: "MERCHANT"` and `actorUserId: ctx.userId` are not decoration. The
 * first is what `transitionOrder`'s ORD-02 guard tests, and the second is what
 * keeps ORD-05's audit row from being anonymous in the one place a dispute would
 * need a name. Both are written out here rather than threaded through a shared
 * helper so a reader — or a grep — finds them at the action.
 */
export const confirmClaim = merchantAction({
  mode: "write",
  schema: claimIdSchema,
  handler: async (ctx, { claimId }) => {
    try {
      await scopedDb(ctx.tenantId).$transaction(async (tx) => {
        const claim = await tx.paymentClaim.findUniqueOrThrow({
          where: { id: claimId },
          select: { id: true, orderId: true, status: true },
        });

        // THE OPTIMISTIC LOCK. Inside the transaction, before anything is
        // written. See the file header.
        if (claim.status !== "PENDING") throw new AlreadyReviewedError();

        await tx.paymentClaim.update({
          where: { id: claim.id },
          data: {
            status: "CONFIRMED",
            reviewedAt: new Date(),
            reviewedByUserId: ctx.userId,
          },
        });

        await transitionOrder(tx, {
          orderId: claim.orderId,
          to: "CONFIRMED",
          actor: "MERCHANT",
          actorUserId: ctx.userId,
        });
      });
    } catch (error) {
      return refusalOrRethrow(error);
    }

    return { ok: true };
  },
});

/**
 * D-11's rejection: a reason, an audit row, and the stock back on sale.
 *
 * ---------------------------------------------------------------------------
 * THIS ACTION IS THE ENTIRE DISPUTE SURFACE (D-03).
 * ---------------------------------------------------------------------------
 * `DISPUTED` is reachable from exactly one origin in the state machine — a
 * rejected payment claim — so there is no other door to this state and there
 * must never be a second one. `src/server/orders/actions.ts` says the same thing
 * from the other side, explaining why it deliberately carries no reject action.
 *
 * The `reason` travels all the way through: the schema requires it, the claim
 * row stores it, `transitionOrder` writes it into the `OrderEvent`, and the
 * customer reads it on their tracking page. That last hop is the point of the
 * requirement — a rejection the customer cannot act on leaves them with a dead
 * order and no correction to make.
 *
 * `releaseStock` is LAST and inside the same transaction. It is idempotent by
 * its own `stockHeld` claim rather than by anything here, so a double-tap that
 * somehow got past the `PENDING` guard still cannot add the units back twice.
 */
export const rejectClaim = merchantAction({
  mode: "write",
  schema: rejectSchema,
  handler: async (ctx, { claimId, reason }) => {
    try {
      await scopedDb(ctx.tenantId).$transaction(async (tx) => {
        const claim = await tx.paymentClaim.findUniqueOrThrow({
          where: { id: claimId },
          select: { id: true, orderId: true, status: true },
        });

        if (claim.status !== "PENDING") throw new AlreadyReviewedError();

        await tx.paymentClaim.update({
          where: { id: claim.id },
          data: {
            status: "REJECTED",
            rejectionReason: reason,
            reviewedAt: new Date(),
            reviewedByUserId: ctx.userId,
          },
        });

        await transitionOrder(tx, {
          orderId: claim.orderId,
          to: "DISPUTED",
          actor: "MERCHANT",
          actorUserId: ctx.userId,
          reason,
        });

        // D-04: the units the customer was holding go back on sale, exactly
        // once.
        await releaseStock(tx, claim.orderId);
      });
    } catch (error) {
      return refusalOrRethrow(error);
    }

    return { ok: true };
  },
});

/**
 * The way out of a rejection made in error (RESEARCH.md Pattern 10).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AT ALL, WHEN THE CUSTOMER COULD JUST RESUBMIT.
 * ---------------------------------------------------------------------------
 * They cannot. `@@unique([tenantId, referenceNormalized])` means the reference
 * that was right all along is now permanently claimed by the rejected row, so a
 * customer retyping the same correct reference gets a duplicate error forever.
 * That is a genuine dead end reachable by a single mistaken tap, and the merchant
 * who made the mistake is the only person who can undo it. RESEARCH.md Pattern 10
 * names this remedy explicitly and prefers it to the alternative it considered
 * and rejected — relaxing the constraint to a partial index — because a narrow
 * merchant-only action is a smaller surface than a weaker uniqueness rule.
 *
 * ---------------------------------------------------------------------------
 * THE RE-HOLD CAN FAIL, AND MUST BE ALLOWED TO.
 * ---------------------------------------------------------------------------
 * The rejection put the units back on sale, and during the dispute window
 * somebody else may have bought them. `holdStockForLines` throws `OutOfStockError`
 * in that case and the throw rolls the whole transaction back — the claim stays
 * REJECTED and the order stays DISPUTED. That is the only safe outcome: moving
 * the order into the payment path over inventory that now belongs to another
 * order is exactly the oversell `src/server/orders/stock.ts` warns about in its
 * header, and the merchant would have no way to know it happened.
 *
 * ---------------------------------------------------------------------------
 * `stockHeld` GOES BACK TO TRUE, OR THE NEXT REJECTION SILENTLY LEAKS STOCK.
 * ---------------------------------------------------------------------------
 * `releaseStock` is keyed on `Order.stockHeld`, not on the order's state. The
 * rejection cleared that flag; if the reopen re-held the units without setting it
 * again, a SECOND rejection of the same claim would find `stockHeld: false`,
 * return silently having released nothing, and leave the units decremented with
 * no order holding them. The merchant's dashboard would then under-report stock
 * they physically have, forever, with nothing in the audit trail to explain it.
 * This is the one line that keeps the release idempotent across a full
 * reject -> reopen -> reject cycle.
 */
export const reopenClaim = merchantAction({
  mode: "write",
  schema: claimIdSchema,
  handler: async (ctx, { claimId }) => {
    /*
     * Captured inside the transaction, read after it rolled back. The rollback
     * un-writes rows, not local variables — which is what lets the out-of-stock
     * message below name the item, since the failing variant is only known once
     * the hold has already thrown.
     */
    let soldOutItemName: string | undefined;

    try {
      await scopedDb(ctx.tenantId).$transaction(async (tx) => {
        const claim = await tx.paymentClaim.findUniqueOrThrow({
          where: { id: claimId },
          select: { id: true, orderId: true, status: true },
        });

        // Only a REJECTED claim can be reopened. A PENDING one is already in
        // the queue, and a CONFIRMED one is a completed sale — reopening either
        // would be undoing a decision nobody asked to undo.
        if (claim.status !== "REJECTED") throw new AlreadyReviewedError();

        const items = await tx.orderItem.findMany({
          where: { orderId: claim.orderId },
          select: { variantId: true, quantity: true, productName: true },
        });

        await tx.paymentClaim.update({
          where: { id: claim.id },
          data: {
            status: "PENDING",
            rejectionReason: null,
            reviewedAt: null,
            reviewedByUserId: null,
          },
        });

        /*
         * The re-hold FIRST, before the order moves. Per RESEARCH.md assumption
         * A6 the stock is re-held at the moment the order re-enters review, and
         * doing it ahead of the transition means the failure path never has a
         * moved order to un-move — the throw happens before `transitionOrder`
         * is ever reached.
         */
        try {
          await holdStockForLines(tx, items);
        } catch (error) {
          if (error instanceof OutOfStockError) {
            soldOutItemName = items.find(
              (item) => item.variantId === error.variantId,
            )?.productName;
          }
          throw error;
        }

        // See the header block above — this is not bookkeeping, it is what keeps
        // `releaseStock` honest on the next rejection. It lives in `stock.ts`
        // because that module owns the flag; writing it from here with a direct
        // order update would split one invariant across two directories.
        await markStockHeld(tx, claim.orderId);

        await transitionOrder(tx, {
          orderId: claim.orderId,
          to: "PAYMENT_CLAIMED",
          actor: "MERCHANT",
          actorUserId: ctx.userId,
        });
      });
    } catch (error) {
      return refusalOrRethrow(
        error,
        soldOutItemName
          ? strings.claims.reopenOutOfStock.replace("{name}", soldOutItemName)
          : undefined,
      );
    }

    return { ok: true };
  },
});
