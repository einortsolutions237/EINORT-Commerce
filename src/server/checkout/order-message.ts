import "server-only";

import { scopedDb } from "@/server/db/tenant-scoped";
import type { OrderMessageArgs } from "@/server/payments/whatsapp";

/**
 * The D-01 WhatsApp message's arguments, read back off the PLACED ORDER.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A SEPARATE MODULE FROM `actions.ts`.
 * ---------------------------------------------------------------------------
 * Two reasons, and the first one is the real one.
 *
 * 1. **The message quotes money, and `submitCheckout` must not touch money.**
 *    That action's whole contract is that no amount passes through it: its Zod
 *    schema has no price field, its `PlaceOrderInput` has no price field, and
 *    grepping it for an amount-shaped identifier returns nothing (TEN-08,
 *    T-03-59). A WhatsApp message that lists what was bought and what it came
 *    to necessarily names those columns. Keeping that read here means the
 *    action still names none of them, and the values still come from exactly
 *    one place — the order rows Postgres just committed.
 *
 * 2. It reads the ORDER, not the cart. By the time this runs the basket has
 *    served its purpose and `placeOrder` has snapshotted every line at the
 *    price charged. Re-deriving the message from the cart would let the
 *    message and the order disagree — the exact failure the snapshot columns
 *    exist to make impossible.
 *
 * `scopedDb(tenantId)` rather than a raw client: the order id arrives from an
 * anonymous request path, so the tenant filter is what makes "that order is not
 * yours" return nothing rather than return a stranger's basket.
 */
export async function orderMessageArgsFor(args: {
  tenantId: string;
  orderId: string;
  storeName: string;
  orderNumber: string;
  trackingUrl: string;
}): Promise<OrderMessageArgs> {
  const db = scopedDb(args.tenantId);

  const order = await db.order.findUniqueOrThrow({
    where: { id: args.orderId },
    select: { totalXaf: true },
  });

  const items = await db.orderItem.findMany({
    where: { orderId: args.orderId },
    select: {
      productName: true,
      variantLabel: true,
      quantity: true,
      lineTotalXaf: true,
    },
  });

  return {
    storeName: args.storeName,
    orderNumber: args.orderNumber,
    trackingUrl: args.trackingUrl,
    lines: items.map((item) => ({
      quantity: item.quantity,
      // D-05's no-options product carries an empty variant label, and appending
      // a separator to nothing would send the merchant `2 x Kaba — ` with a
      // dangling dash. The label is only ever joined when there is one.
      name:
        item.variantLabel.length > 0
          ? `${item.productName} (${item.variantLabel})`
          : item.productName,
      amountXaf: item.lineTotalXaf,
    })),
    totalXaf: order.totalXaf,
  };
}
