import "server-only";

import type { OrderChannel } from "@/server/db/enums";
import type { OrderItemCreateManyInput } from "@/server/db/model-inputs";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";

import { UnavailableItemError } from "./errors";
import { newOrderNumber } from "./order-number";
import { holdStockForLines } from "./stock";
import { hashTrackingToken, mintTrackingToken } from "./tracking-token";
import { openOrderAtGenesis, transitionOrder } from "./transition";

/**
 * ORD-01 / TEN-08 / T-03-34 — the only place an `Order` row is created.
 *
 * ---------------------------------------------------------------------------
 * THE CART CARRIES IDS AND QUANTITIES. IT DOES NOT CARRY MONEY.
 * ---------------------------------------------------------------------------
 * This is the reason the module exists, so it is the first thing in it.
 * `PlaceOrderInput` has no `unitPriceXaf`, no `lineTotalXaf`, no `subtotalXaf`
 * and no `totalXaf` — not "validated", not "checked against the database",
 * ABSENT. Every amount on the resulting order is read from `ProductVariant` and
 * `Product` inside the transaction that writes it.
 *
 * The distinction matters because "validate the client's price against the
 * database" is the shape that looks safe and is not: it works until someone
 * adds a discount code, a rounding rule or a currency conversion and the
 * comparison develops a tolerance. A field that does not exist cannot develop
 * one. If a `unitPriceXaf` ever appears in a checkout schema, that is the bug
 * this file exists to prevent, and the type will refuse it at the call site.
 *
 * The cart is client-triggered state — a Redis blob keyed off a cookie the
 * shopper controls — so the ids and quantities in it are forgeable too. Those
 * are handled differently because they have to be: an id is re-read (and a
 * foreign tenant's id simply is not visible), and a quantity is checked by the
 * conditional decrement in `stock.ts`.
 *
 * ---------------------------------------------------------------------------
 * ONE TRANSACTION. ALL OF IT, OR NONE OF IT.
 * ---------------------------------------------------------------------------
 * Five writes have to be indivisible: the stock decrements, the order row, its
 * line-item snapshots, its genesis audit row, and — on the manual-transfer
 * channel — the hop into `PAYMENT_PENDING`. Any subset committing alone is a
 * concrete, recognisable production incident:
 *
 *   stock without an order   → units sold to nobody, found by counting shelves
 *   order without stock      → the same unit sold twice, found by a customer
 *   order without its items  → a total with nothing to explain it
 *   order without its event  → a history with a hole at its origin (ORD-05)
 *
 * So the body below is one `$transaction` on the extended client, and every
 * helper it calls takes `tx` rather than opening its own. The 15-second timeout
 * is well above what a handful of statements against Neon costs, and exists so
 * a pathological lock wait surfaces as a failed checkout rather than as a
 * connection held open indefinitely.
 *
 * ---------------------------------------------------------------------------
 * TWO RESOLVED OPEN QUESTIONS THIS FILE EMBODIES.
 * ---------------------------------------------------------------------------
 *  1. There is deliberately NO `CANCELLED` state. ORD-01 enumerates six and
 *     03-CONTEXT.md adds none, so a cancellation in V1 is a conversation
 *     between a merchant and a customer, not a row transition.
 *  2. `releaseStock` nevertheless exists as a standalone primitive precisely so
 *     that when Phase 6 wants a "cancel this stale order" action, it is a call
 *     plus a transition rather than a redesign of how holds work.
 *
 * ---------------------------------------------------------------------------
 * THE GENESIS WRITE GOES THROUGH `transition.ts`. IT IS NOT AN `order.create`
 * HERE.
 * ---------------------------------------------------------------------------
 * `openOrderAtGenesis` writes the row and its first `OrderEvent` together, and
 * it lives in `transition.ts` because that module is the single sanctioned
 * writer of `Order.state` — a rule `tests/unit/single-order-state-writer.test.ts`
 * enforces against the source. This file therefore contains no `state:` in any
 * order write at all, which is the point: the guard stays a one-entry rule
 * instead of becoming an allowlist.
 */

/**
 * Everything a checkout submits. Note what is not here.
 *
 * Exported so 03-12's Server Action can type its Zod output against this
 * directly — which is what makes "the schema has no price field" a compile-time
 * property of the action layer rather than a review note about it.
 */
export interface PlaceOrderInput {
  readonly channel: OrderChannel;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly deliveryAddress: string | null;
  readonly customerNote: string | null;
  /** Ids and quantities. Nothing else, and deliberately no money. */
  readonly items: readonly { variantId: string; quantity: number }[];
}

export interface PlacedOrder {
  readonly orderId: string;
  readonly orderNumber: string;
  /**
   * The PLAINTEXT tracking token, returned exactly once in the life of this
   * order and never written to a column (D-12). The caller must put it in the
   * link it shows the customer; there is no second chance to read it.
   */
  readonly trackingToken: string;
}

/**
 * The `variantLabel` snapshot: `"M / Blue"`, or `"M"`, or `""`.
 *
 * TEMPORARY LOCATION. 03-06 owns `variantLabelFor` in
 * `src/server/catalog/variant-matrix.ts`, which does not exist yet — that plan
 * has not run. Rather than create the file from here and collide with 03-06's
 * own version of it, the three-line rule is written locally with the SAME
 * behaviour 03-06-PLAN.md specifies for it, and swapping this for the import is
 * a one-line change when the catalog module lands.
 *
 * The empty-string case is D-05's no-options product: its single implicit
 * variant carries `("", "")`, and the label for it is genuinely empty rather
 * than a made-up `"Default"` — the storefront decides how to render a variant
 * with nothing to distinguish it, and this column should not pre-empt that.
 */
function snapshotVariantLabel(variant: {
  option1Value: string;
  option2Value: string;
}): string {
  return [variant.option1Value, variant.option2Value]
    .filter((value) => value.length > 0)
    .join(" / ");
}

/** A unique-constraint violation, recognised without importing the client. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Place an order: hold the stock, write the row, snapshot the lines, open the
 * audit trail, and hand back the customer's one-time tracking token.
 *
 * `tenantId` is a parameter here, unlike everywhere in the merchant surface
 * (TEN-04), and the difference is real rather than an exception: checkout is an
 * ANONYMOUS path. There is no session to read an active organisation from — the
 * tenant arrives in the hostname and is resolved by
 * `src/server/tenant/resolve.ts` before this is ever called. What protects the
 * boundary is that everything below runs through `scopedDb(tenantId)`, so a
 * variant belonging to a different tenant is not visible at all.
 */
export async function placeOrder(
  tenantId: string,
  input: PlaceOrderInput,
): Promise<PlacedOrder> {
  if (input.items.length === 0) throw new UnavailableItemError();

  // Minted BEFORE the transaction: it is a pure CSPRNG draw with no reason to
  // be inside a database transaction, and keeping it out means a retry below
  // reuses the same token rather than orphaning one. Only the digest is ever
  // written; this variable is the sole copy of the plaintext.
  const trackingToken = mintTrackingToken();
  const trackingTokenHash = hashTrackingToken(trackingToken);

  /*
   * ONE retry, and only for a duplicate order number.
   *
   * `@@unique([tenantId, orderNumber])` is the real uniqueness guarantee;
   * `newOrderNumber()` only makes a collision rare (~6.6e11 combinations). Rare
   * over a long enough run is "eventually", and the failure mode of trusting
   * the draw is a lost sale. Two attempts is enough: a second collision on an
   * independent draw is not a probability worth writing a loop for, and an
   * unbounded retry would mask a genuinely exhausted keyspace.
   *
   * Scoped narrowly on purpose. Anything that is NOT a unique violation —
   * out of stock, an unavailable item, a lock timeout — is rethrown
   * immediately, because retrying a placement that failed for a real reason is
   * how one sold-out cart becomes two stock decrements.
   */
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await placeOnce(tenantId, input, trackingToken, trackingTokenHash);
    } catch (error) {
      if (attempt === 0 && isUniqueViolation(error)) continue;
      throw error;
    }
  }

  // Unreachable: the loop either returns or throws. Present because the
  // compiler cannot see that, and an implicit `undefined` here would be a
  // silently order-less success.
  throw new Error("placeOrder: exhausted order-number attempts.");
}

async function placeOnce(
  tenantId: string,
  input: PlaceOrderInput,
  trackingToken: string,
  trackingTokenHash: string,
): Promise<PlacedOrder> {
  return scopedDb(tenantId).$transaction(
    async (tx) => {
      // Sorted here as well as inside `holdStockForLines`, so the order the
      // rows are READ in matches the order they are WRITTEN in. Two different
      // orders would reintroduce the Pitfall 5 lock cycle through the back
      // door the moment a read starts taking locks.
      const lines = [...input.items].sort((a, b) =>
        a.variantId.localeCompare(b.variantId),
      );

      /*
       * THE RE-READ. This is TEN-08 / T-03-34 in one statement.
       *
       * Every number that ends up on the order comes from these rows. The
       * `where` is stamped with `tenantId` by the scope extension, so another
       * tenant's variant id is not "rejected" — it is invisible, and falls out
       * as a count mismatch below.
       */
      const variants = await tx.productVariant.findMany({
        where: { id: { in: lines.map((line) => line.variantId) }, active: true },
        select: {
          id: true,
          priceXaf: true,
          option1Value: true,
          option2Value: true,
          product: {
            select: {
              id: true,
              name: true,
              basePriceXaf: true,
              active: true,
            },
          },
        },
      });

      // A count mismatch covers every way a line can be unbuyable at once: the
      // variant was deleted, deactivated, or belongs to somebody else. All
      // three are the same message to the customer, and deliberately so —
      // distinguishing "inactive" from "never existed" on an anonymous path is
      // a small enumeration oracle for no user benefit (see `errors.ts`).
      if (variants.length !== lines.length) throw new UnavailableItemError();

      const byId = new Map(variants.map((variant) => [variant.id, variant]));

      // D-08/D-09: a deactivated PRODUCT must not be newly orderable even if
      // one of its variants was left active. The storefront already promises
      // the customer it is gone; the checkout has to agree, and this is the
      // server-side half of that promise.
      if (variants.some((variant) => !variant.product.active)) {
        throw new UnavailableItemError();
      }

      // CAT-03 / D-04. Before the order row, so a sold-out line costs nothing
      // but a rolled-back transaction.
      await holdStockForLines(tx, lines);

      // Hero images, snapshotted alongside the rest of the line. Position 0 is
      // the hero (D-10). A product with no image simply has no key, which is
      // why this is a lookup rather than a join with a `!` after it.
      const heroImages = await tx.productImage.findMany({
        where: {
          productId: { in: variants.map((variant) => variant.product.id) },
          position: 0,
        },
        select: { productId: true, storageKey: true },
      });
      const heroByProduct = new Map(
        heroImages.map((image) => [image.productId, image.storageKey]),
      );

      /*
       * THE SNAPSHOTS. `productName`, `variantLabel`, `unitPriceXaf` and
       * `imageKey` are copied onto the line rather than joined at read time,
       * so a later rename, reprice or image swap cannot rewrite what a customer
       * was charged. An order is a record of a past event; a join would make it
       * a view of the present.
       *
       * `priceXaf ?? basePriceXaf` is the variant-override rule: a variant
       * price is optional and NULL means "same as the product". `??` and not
       * `||` — a legitimately free item at 0 XAF must not fall through to the
       * base price.
       */
      let subtotalXaf = 0;
      const items = lines.map((line) => {
        const variant = byId.get(line.variantId);
        if (!variant) throw new UnavailableItemError();

        const unitPriceXaf = variant.priceXaf ?? variant.product.basePriceXaf;
        const lineTotalXaf = unitPriceXaf * line.quantity;
        subtotalXaf += lineTotalXaf;

        return {
          productId: variant.product.id,
          variantId: variant.id,
          productName: variant.product.name,
          variantLabel: snapshotVariantLabel(variant),
          unitPriceXaf,
          quantity: line.quantity,
          lineTotalXaf,
          imageKey: heroByProduct.get(variant.product.id) ?? null,
        };
      });

      // V1 has no shipping and no tax, so the total IS the subtotal. Both
      // columns exist because the day one of them is added, an order placed
      // before that day must still show what it actually cost. Inventing a zero
      // shipping line today would be the platform promising a feature it does
      // not have.
      const totalXaf = subtotalXaf;

      const order = await openOrderAtGenesis(tx, {
        orderNumber: newOrderNumber(),
        channel: input.channel,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        deliveryAddress: input.deliveryAddress,
        customerNote: input.customerNote,
        subtotalXaf,
        totalXaf,
        trackingTokenHash,
        // True because `holdStockForLines` above either succeeded or threw.
        stockHeld: true,
        actor: "CUSTOMER",
      });

      // A SEPARATE `createMany`, never a nested relation write hung off the
      // order's own create (Pitfall 1). The tenant-scope extension hooks client
      // operations rather than the generated SQL, so a nested create would land
      // with no `tenantId` — `createMany` is intercepted and every row stamped,
      // which is exactly why it is the one batch shape used here.
      await tx.orderItem.createMany({
        data: items.map((item) =>
          scopedCreateData<OrderItemCreateManyInput>({
            ...item,
            orderId: order.id,
          }),
        ),
      });

      /*
       * D-02. A manual-transfer order owes money through a channel the platform
       * can see, so it moves straight into the payment path. A WhatsApp or
       * cash-on-delivery order does not: there is no in-band payment for the
       * platform to be pending on, and letting either reach a claim state would
       * allow a dispute to be fabricated over a payment that never existed
       * (T-03-15).
       *
       * `transitionOrder` and NOT a second direct write to the order row. That
       * is not a style preference: `transition.ts` is the only sanctioned
       * writer of `Order.state`, so this hop leaves an `OrderEvent` naming
       * SYSTEM as the actor. Written directly, the order would move into the
       * payment path with nothing in its history saying why — the exact gap a
       * payment dispute needs closed.
       */
      if (input.channel === "MANUAL_TRANSFER") {
        await transitionOrder(tx, {
          orderId: order.id,
          to: "PAYMENT_PENDING",
          actor: "SYSTEM",
        });
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        trackingToken,
      };
    },
    { timeout: 15_000 },
  );
}
