import type { OrderChannel, OrderState } from "@/server/db/enums";

/**
 * The order domain's refusals, as types rather than as strings.
 *
 * ---------------------------------------------------------------------------
 * THESE ARE THROWN INSIDE `$transaction` CALLBACKS. THAT IS THE POINT.
 * ---------------------------------------------------------------------------
 * Every one of these is raised from inside an interactive transaction — a
 * placement that discovers a variant sold out mid-checkout, a transition the
 * state graph refuses, a review submitted twice. Throwing is what rolls the
 * transaction back, so the refusal and the un-doing of every partial write are
 * the same event. A function that returned `{ ok: false }` instead would leave
 * the caller responsible for aborting, and a caller that forgot would commit a
 * half-applied order: stock decremented, no order row, and nothing in the audit
 * trail to explain it.
 *
 * The Server Action layer catches them and converts each to an `ActionResult`
 * with copy the customer or merchant can act on
 * (`src/server/merchant/action.ts` owns that translation). They are DISTINCT
 * classes rather than one `OrderError` with a `code` because that translation
 * is a `switch` the compiler should be able to check, and because a caller that
 * legitimately wants to recover from "sold out" while re-throwing everything
 * else needs `instanceof` to be able to tell them apart.
 *
 * `name` is set on every one. An `Error` subclass in a transpiled build reports
 * `name: "Error"` unless it is assigned, and the name is what a Vercel log line
 * shows — so without it the audit-relevant refusals become indistinguishable
 * from a null-pointer bug in the log.
 */

/**
 * A move the ORD-01 graph, the D-02/D-03 channel rule, the ORD-02 actor guard,
 * or the D-11 reason requirement refuses.
 *
 * The message names the channel as well as both states, because "cannot go from
 * ORDER_PLACED to PAYMENT_PENDING" is baffling on its own — that transition is
 * legal, and the reader has to already know the order was placed over WhatsApp
 * for the refusal to make sense. Including the channel makes a single log line
 * self-explaining.
 */
export class InvalidTransitionError extends Error {
  override readonly name = "InvalidTransitionError";
  readonly from: OrderState;
  readonly to: OrderState;
  readonly channel: OrderChannel;

  constructor(from: OrderState, to: OrderState, channel: OrderChannel) {
    super(
      `Invalid order transition: ${from} -> ${to} on a ${channel} order.`,
    );
    this.from = from;
    this.to = to;
    this.channel = channel;
  }
}

/**
 * A variant with fewer units available than the order wants (CAT-03, ORD-03).
 *
 * Carries the variant id rather than a rendered message so the caller can name
 * the offending line item — a cart with five products needs to say WHICH one
 * sold out, and re-deriving that from a string would be parsing an error
 * message.
 */
export class OutOfStockError extends Error {
  override readonly name = "OutOfStockError";
  readonly variantId: string;

  constructor(variantId: string) {
    super(`Variant ${variantId} does not have enough stock.`);
    this.variantId = variantId;
  }
}

/**
 * A cart line referring to a product or variant that is no longer purchasable
 * — deactivated, deleted, or belonging to another tenant.
 *
 * Distinct from `OutOfStockError` because the remedies differ: out of stock is
 * "try a smaller quantity or come back later", unavailable is "this is gone,
 * remove it". Deliberately carries no id in the message: the anonymous
 * checkout path is reachable without an account, and confirming that a given
 * id exists-but-is-inactive versus never existed is a small enumeration oracle
 * for no user benefit.
 */
export class UnavailableItemError extends Error {
  override readonly name = "UnavailableItemError";

  constructor() {
    super("One or more items in this order are no longer available.");
  }
}

/**
 * A payment claim being reviewed a second time (ORD-02, D-11).
 *
 * The realistic cause is not an attack but a double-submit: a merchant on a
 * slow Douala connection taps "Confirm" twice, or two staff members open the
 * same claim. Both would otherwise write a second `OrderEvent` and, worse,
 * re-run whatever the first review already did. The check is server-side
 * because the button being disabled is a property of one browser tab.
 */
export class AlreadyReviewedError extends Error {
  override readonly name = "AlreadyReviewedError";

  constructor() {
    super("This payment claim has already been reviewed.");
  }
}
