"use server";

import { z } from "zod";

import { strings } from "@/lib/strings";
import { scopedDb } from "@/server/db/tenant-scoped";
import { merchantAction, type ActionResult } from "@/server/merchant/action";

import { InvalidTransitionError } from "./errors";
import { transitionOrder } from "./transition";

/**
 * The two moves a merchant may make on an order, and there are only two.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY ABSENT, SO NOBODY ADDS IT BACK.
 * ---------------------------------------------------------------------------
 * There is no reject-a-claim action here and there never should be. The
 * DISPUTED state is reachable only from a rejected payment claim (D-03), that
 * review lives with the claims queue, and putting a second door to the same
 * state on the orders surface would give the same decision two code paths and
 * two sets of copy.
 *
 * There is also no undo, no reopen and no order-cancelling action, because the
 * lifecycle has no state for one to move to: `OrderState` enumerates six
 * members and ORD-01 adds none, 03-RESEARCH.md Open Question 1 resolved that
 * out of V1 explicitly, and an enum member no transition can reach is a state
 * the machine must defend against forever. When a later phase does want to
 * unwind an order, the inventory primitive it needs already exists in
 * `src/server/orders/stock.ts`, so that is a call to write rather than a design
 * to redo. Reaching for it here would be building the hard half early and the
 * decision late.
 *
 * ---------------------------------------------------------------------------
 * NEITHER HANDLER WRITES `Order.state`, AND THAT IS A BUILD GATE.
 * ---------------------------------------------------------------------------
 * `src/server/orders/transition.ts` is the only writer, and
 * `tests/unit/single-order-state-writer.test.ts` fails the build if a second
 * one appears. So both handlers below are a transaction wrapped around one call
 * — the audit row is not something they remember to write, it is something they
 * cannot avoid writing.
 *
 * `"use server"` is the first line and there is deliberately no
 * `import "server-only"` beside it: the two markers are mutually exclusive, and
 * `src/server/merchant/actions.ts` states the same reasoning at length.
 */

/**
 * The whole payload. An order id and nothing else — no tenant id, no state, no
 * actor. There is no field here for a caller to set that could retarget the
 * write or choose who the audit row names: the tenant comes from
 * `merchantAction`'s session-resolved context and the destination state is a
 * literal below (T-03-50).
 */
const orderIdSchema = z.object({ orderId: z.string().min(1) });

/**
 * Turn the state machine's refusal into something a merchant can act on, and
 * rethrow anything else.
 *
 * A merchant with two tabs open WILL hit this: the row was rendered when the
 * order was placed, and by the time the button is tapped the order has already
 * been confirmed from the other tab. Letting `InvalidTransitionError` escape
 * would answer that with a 500 — an error page for an entirely ordinary race,
 * and one whose only remedy (reload) the merchant is given no way to guess
 * (T-03-52).
 *
 * Everything else rethrows. An unexpected failure must stay a failure rather
 * than be dressed up as a refusal the merchant could have avoided — including
 * the cross-tenant miss, which surfaces from `findUniqueOrThrow` as a Prisma
 * error and must NOT be softened into a readable message, because a readable
 * "that order is not yours" is an existence oracle over another tenant's ids.
 *
 * DELIBERATELY NOT A WRAPPER AROUND THE WHOLE TRANSITION. The two handlers
 * below each write out their own `$transaction`, their own `to:`, and their own
 * `actor` / `actorUserId` pair rather than delegating to one shared runner. The
 * duplication is the point: passing `ctx.userId` as the transition's
 * `actorUserId` is the line that keeps ORD-05's audit trail from going
 * anonymous (T-03-51), and it is worth more as something a reader — or a
 * grep — finds at each action than as a parameter threaded through a helper
 * where its absence would be invisible.
 */
function refusalOrRethrow(error: unknown): ActionResult {
  if (error instanceof InvalidTransitionError) {
    return { ok: false, error: { form: [strings.orders.staleAction] } };
  }
  throw error;
}

/**
 * D-02's one-tap confirm.
 *
 * Moves no inventory, on purpose. Stock was decremented and held at placement
 * (D-04), so confirmation is purely the merchant agreeing the sale is real; a
 * decrement here would double-count every order in the product.
 *
 * `actor: "MERCHANT"` is not decoration: `transitionOrder`'s ORD-02 guard
 * refuses CONFIRMED for any other actor, which is the entire reason "the
 * customer says they paid" and "the merchant agrees they paid" stay two
 * different events. Nor is `actorUserId`: the same function refuses a merchant
 * move that carries no user id, and `ctx.userId` is what lands in
 * `OrderEvent.actorUserId` so the audit row is never anonymous.
 */
export const confirmOrder = merchantAction({
  mode: "write",
  schema: orderIdSchema,
  handler: async (ctx, { orderId }) => {
    try {
      await scopedDb(ctx.tenantId).$transaction((tx) =>
        transitionOrder(tx, {
          orderId,
          to: "CONFIRMED",
          actor: "MERCHANT",
          actorUserId: ctx.userId,
        }),
      );
    } catch (error) {
      return refusalOrRethrow(error);
    }

    return { ok: true };
  },
});

/**
 * The other end of the two-state life: the merchant has shipped it.
 *
 * Same shape, same named actor, same audited row. The registry is what refuses
 * a fulfilment of an order nobody confirmed — this handler does not re-check
 * it, because a second copy of the rule here is a second copy to drift.
 */
export const markFulfilled = merchantAction({
  mode: "write",
  schema: orderIdSchema,
  handler: async (ctx, { orderId }) => {
    try {
      await scopedDb(ctx.tenantId).$transaction((tx) =>
        transitionOrder(tx, {
          orderId,
          to: "FULFILLED",
          actor: "MERCHANT",
          actorUserId: ctx.userId,
        }),
      );
    } catch (error) {
      return refusalOrRethrow(error);
    }

    return { ok: true };
  },
});
