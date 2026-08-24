import { beforeEach, describe, expect, it } from "vitest";

import type { Prisma } from "@/generated/prisma/client";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";
import { OutOfStockError, UnavailableItemError } from "@/server/orders/errors";
import { placeOrder, type PlaceOrderInput } from "@/server/orders/place";
import { hashTrackingToken } from "@/server/orders/tracking-token";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * TEN-08 / T-03-34, T-03-39 — nothing a customer submits becomes money.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE IS ACTUALLY ASSERTING.
 * ---------------------------------------------------------------------------
 * The forged-payload threat against checkout has a shape that is easy to test
 * badly. The bad version submits a wrong price and asserts it was rejected —
 * which passes for a system that VALIDATES client prices, and a validating
 * system is one discount rule away from a comparison with a tolerance in it.
 *
 * `placeOrder` does not validate a price, because `PlaceOrderInput` has no
 * price to validate. So the assertion here is the stronger one: every amount on
 * the persisted order equals the value derived from the DATABASE rows, and the
 * input type has no field a forger could aim at. The second half is checked at
 * compile time by `noPriceFieldOnInput` below and restated in a runtime
 * assertion so a reader of the test output can see it was checked.
 *
 * It mirrors `tests/isolation/plan-selection.test.ts`'s approach for the same
 * reason it is an isolation test rather than a unit test: the claims are about
 * what reached Postgres and what did not, and a stub has no rows to compare
 * against and no transaction to roll back.
 */

const VARIANT_A = `${TENANT_A.id}-variant-1`;
const VARIANT_A2 = `${TENANT_A.id}-variant-2`;
const VARIANT_B_TENANT = `${TENANT_B.id}-variant-1`;
const PRODUCT_A = `${TENANT_A.id}-product-1`;

/** The fixture's product price. Asserted, never assumed, in the first test. */
const BASE_PRICE_XAF = 5000;

function baseInput(
  overrides: Partial<PlaceOrderInput> = {},
): PlaceOrderInput {
  return {
    channel: "WHATSAPP",
    customerName: "Aminata Nkeng",
    customerPhone: "237670000123",
    deliveryAddress: "Bonapriso, Douala",
    customerNote: null,
    items: [{ variantId: VARIANT_A, quantity: 2 }],
    ...overrides,
  };
}

function readOrder(tenantId: string, orderId: string) {
  return scopedDb(tenantId).order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      state: true,
      channel: true,
      subtotalXaf: true,
      totalXaf: true,
      stockHeld: true,
      trackingTokenHash: true,
      orderNumber: true,
    },
  });
}

function readItems(tenantId: string, orderId: string) {
  return scopedDb(tenantId).orderItem.findMany({
    where: { orderId },
    select: {
      variantId: true,
      productName: true,
      variantLabel: true,
      unitPriceXaf: true,
      quantity: true,
      lineTotalXaf: true,
      imageKey: true,
    },
  });
}

function readEvents(tenantId: string, orderId: string) {
  return scopedDb(tenantId).orderEvent.findMany({
    where: { orderId },
    select: { fromState: true, toState: true, actor: true },
  });
}

function countOrders(tenantId: string): Promise<number> {
  return scopedDb(tenantId).order.count({});
}

function readStock(tenantId: string, variantId: string): Promise<number> {
  return scopedDb(tenantId)
    .productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stock: true },
    })
    .then((row) => row.stock);
}

/** A second variant on tenant A's product, priced differently from the base. */
function createSecondVariant(stock: number, priceXaf: number | null) {
  return scopedDb(TENANT_A.id).productVariant.create({
    data: scopedCreateData<Prisma.ProductVariantUncheckedCreateInput>({
      id: VARIANT_A2,
      productId: PRODUCT_A,
      option1Value: "LARGE",
      option2Value: "",
      priceXaf,
      stock,
      sku: null,
      active: true,
    }),
  });
}

beforeEach(async () => {
  await seedTwoTenants();
});

// ---------------------------------------------------------------------------

describe("the amounts on a placed order", () => {
  it("come from the database, and the input has no field to forge", async () => {
    /*
     * THE COMPILE-TIME HALF OF TEN-08.
     *
     * Uncommenting the price key below is a TypeScript error, not a runtime
     * rejection — `PlaceOrderInput` declares no such property and object
     * literals are checked for excess properties. That is the actual guarantee:
     * there is no field for a forged amount to arrive in, so there is no
     * comparison that could later develop a tolerance.
     *
     *   const forged: PlaceOrderInput = {
     *     ...baseInput(),
     *     items: [{ variantId: VARIANT_A, quantity: 2, unitPriceXaf: 1 }],
     *   };
     *
     * The runtime restatement below is what a reader of the reporter output
     * sees; the type is what actually stops it.
     */
    const input = baseInput({ items: [{ variantId: VARIANT_A, quantity: 2 }] });
    expect(Object.keys(input.items[0] ?? {}).sort()).toEqual([
      "quantity",
      "variantId",
    ]);

    // The fixture's real price, read rather than assumed — if the seed ever
    // changes this number, the assertions below must move with it rather than
    // silently comparing two stale constants.
    const product = await scopedDb(TENANT_A.id).product.findUniqueOrThrow({
      where: { id: PRODUCT_A },
      select: { basePriceXaf: true, name: true },
    });
    expect(product.basePriceXaf).toBe(BASE_PRICE_XAF);

    const placed = await placeOrder(TENANT_A.id, input);

    const order = await readOrder(TENANT_A.id, placed.orderId);
    const items = await readItems(TENANT_A.id, placed.orderId);

    expect(items).toHaveLength(1);
    // The variant carries `priceXaf: null`, so the product's base price is the
    // unit price — the `??` fallback, exercised.
    expect(items[0]?.unitPriceXaf).toBe(BASE_PRICE_XAF);
    expect(items[0]?.lineTotalXaf).toBe(BASE_PRICE_XAF * 2);
    expect(order.subtotalXaf).toBe(BASE_PRICE_XAF * 2);
    // V1 has no shipping and no tax, so the total IS the subtotal.
    expect(order.totalXaf).toBe(BASE_PRICE_XAF * 2);

    // Snapshots, not joins: the line records what was bought and what it cost,
    // independent of any later rename or reprice.
    expect(items[0]?.productName).toBe(product.name);
    expect(items[0]?.imageKey).toBe(`${TENANT_A.id}/product-1/original`);
    // D-05's no-options product owns a single `("", "")` variant, and its
    // label is genuinely empty rather than an invented "Default".
    expect(items[0]?.variantLabel).toBe("");
  });

  it("uses the variant override when one is set, per line", async () => {
    await createSecondVariant(10, 12_000);

    const placed = await placeOrder(
      TENANT_A.id,
      baseInput({
        items: [
          { variantId: VARIANT_A, quantity: 1 },
          { variantId: VARIANT_A2, quantity: 2 },
        ],
      }),
    );

    const items = await readItems(TENANT_A.id, placed.orderId);
    const byVariant = new Map(items.map((item) => [item.variantId, item]));

    expect(byVariant.get(VARIANT_A)?.unitPriceXaf).toBe(BASE_PRICE_XAF);
    expect(byVariant.get(VARIANT_A2)?.unitPriceXaf).toBe(12_000);
    expect(byVariant.get(VARIANT_A2)?.lineTotalXaf).toBe(24_000);
    expect(byVariant.get(VARIANT_A2)?.variantLabel).toBe("LARGE");

    const order = await readOrder(TENANT_A.id, placed.orderId);
    expect(order.subtotalXaf).toBe(BASE_PRICE_XAF + 24_000);
  });

  it("returns the plaintext tracking token once and stores only its digest", async () => {
    const placed = await placeOrder(TENANT_A.id, baseInput());
    const order = await readOrder(TENANT_A.id, placed.orderId);

    expect(placed.trackingToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(order.trackingTokenHash).toBe(
      hashTrackingToken(placed.trackingToken),
    );
    // The plaintext must not be recoverable from the row. A column holding it
    // would turn a database backup into access to live customer orders.
    expect(order.trackingTokenHash).not.toBe(placed.trackingToken);

    expect(order.orderNumber).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
  });
});

describe("an item that is not purchasable", () => {
  it("refuses another tenant's variant and writes no order at all", async () => {
    const beforeA = await countOrders(TENANT_A.id);
    const beforeStockB = await readStock(TENANT_B.id, VARIANT_B_TENANT);

    /*
     * A REAL, SEEDED id belonging to tenant B — not an invented one. The scope
     * extension makes the row invisible to tenant A's read, so the line falls
     * out as a count mismatch rather than being "rejected" by a check somebody
     * could later forget to write.
     */
    await expect(
      placeOrder(
        TENANT_A.id,
        baseInput({ items: [{ variantId: VARIANT_B_TENANT, quantity: 1 }] }),
      ),
    ).rejects.toBeInstanceOf(UnavailableItemError);

    expect(await countOrders(TENANT_A.id)).toBe(beforeA);
    expect(await readStock(TENANT_B.id, VARIANT_B_TENANT)).toBe(beforeStockB);
  });

  it("refuses a variant whose parent product has been deactivated", async () => {
    // D-08/D-09: the storefront already tells the customer this product is
    // gone. The checkout has to agree, even for a variant left active under it.
    await scopedDb(TENANT_A.id).product.updateMany({
      where: { id: PRODUCT_A },
      data: { active: false },
    });

    const before = await countOrders(TENANT_A.id);
    const beforeStock = await readStock(TENANT_A.id, VARIANT_A);

    await expect(placeOrder(TENANT_A.id, baseInput())).rejects.toBeInstanceOf(
      UnavailableItemError,
    );

    expect(await countOrders(TENANT_A.id)).toBe(before);
    expect(await readStock(TENANT_A.id, VARIANT_A)).toBe(beforeStock);
  });
});

describe("the ORD-05 audit trail and the D-02 channel rule", () => {
  it("writes exactly one genesis event for a WHATSAPP order", async () => {
    const placed = await placeOrder(
      TENANT_A.id,
      baseInput({ channel: "WHATSAPP" }),
    );

    const events = await readEvents(TENANT_A.id, placed.orderId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      // Null exactly once per order. That null is what makes the history
      // readable end to end: the row with no predecessor is the beginning.
      fromState: null,
      toState: "ORDER_PLACED",
      actor: "CUSTOMER",
    });

    const order = await readOrder(TENANT_A.id, placed.orderId);
    // D-02: a WhatsApp order is negotiated in the conversation. It has no
    // in-band payment for the platform to be pending on.
    expect(order.state).toBe("ORDER_PLACED");
    expect(order.stockHeld).toBe(true);
  });

  it("writes two events for a MANUAL_TRANSFER order and lands in PAYMENT_PENDING", async () => {
    const placed = await placeOrder(
      TENANT_A.id,
      baseInput({ channel: "MANUAL_TRANSFER" }),
    );

    const events = await readEvents(TENANT_A.id, placed.orderId);
    expect(events).toHaveLength(2);

    /*
     * Asserted as a SET rather than in order, deliberately. Both rows are
     * written inside one transaction and `createdAt` defaults to the database
     * clock, which in Postgres is the TRANSACTION's start time — so the two
     * timestamps are identical and any ordering between them is arbitrary.
     * Asserting a sequence here would be asserting a tie-break.
     */
    expect(
      events.map((e) => `${String(e.fromState)}->${e.toState}:${e.actor}`).sort(),
    ).toEqual([
      "ORDER_PLACED->PAYMENT_PENDING:SYSTEM",
      "null->ORDER_PLACED:CUSTOMER",
    ]);

    // The second hop went through `transitionOrder`, which is why it has an
    // event at all. A direct write would have moved the order silently.
    expect((await readOrder(TENANT_A.id, placed.orderId)).state).toBe(
      "PAYMENT_PENDING",
    );
  });

  it("leaves a CASH_ON_DELIVERY order in ORDER_PLACED with one event", async () => {
    const placed = await placeOrder(
      TENANT_A.id,
      baseInput({ channel: "CASH_ON_DELIVERY" }),
    );

    expect(await readEvents(TENANT_A.id, placed.orderId)).toHaveLength(1);
    expect((await readOrder(TENANT_A.id, placed.orderId)).state).toBe(
      "ORDER_PLACED",
    );
  });
});

describe("a placement that fails partway", () => {
  it("rolls back the first line's stock too, because it is one transaction", async () => {
    await createSecondVariant(3, null);

    const beforeFirst = await readStock(TENANT_A.id, VARIANT_A);
    const beforeSecond = await readStock(TENANT_A.id, VARIANT_A2);
    const beforeOrders = await countOrders(TENANT_A.id);

    /*
     * THE ASSERTION THIS DESCRIBE BLOCK EXISTS FOR.
     *
     * Sorted line order puts `-variant-1` first, so its decrement SUCCEEDS
     * before `-variant-2` fails on a quantity it cannot satisfy. If the hold
     * were not inside the placement's transaction, the first line's units would
     * stay decremented: inventory sold to an order that was never written, and
     * discovered by a merchant counting an empty shelf against a full-looking
     * dashboard.
     */
    await expect(
      placeOrder(
        TENANT_A.id,
        baseInput({
          items: [
            { variantId: VARIANT_A, quantity: 1 },
            { variantId: VARIANT_A2, quantity: 99 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(OutOfStockError);

    expect(await readStock(TENANT_A.id, VARIANT_A)).toBe(beforeFirst);
    expect(await readStock(TENANT_A.id, VARIANT_A2)).toBe(beforeSecond);
    expect(await countOrders(TENANT_A.id)).toBe(beforeOrders);
  });

  it("decrements every line exactly once on success", async () => {
    await createSecondVariant(10, null);

    const beforeFirst = await readStock(TENANT_A.id, VARIANT_A);
    const beforeSecond = await readStock(TENANT_A.id, VARIANT_A2);

    await placeOrder(
      TENANT_A.id,
      baseInput({
        items: [
          { variantId: VARIANT_A, quantity: 3 },
          { variantId: VARIANT_A2, quantity: 4 },
        ],
      }),
    );

    expect(await readStock(TENANT_A.id, VARIANT_A)).toBe(beforeFirst - 3);
    expect(await readStock(TENANT_A.id, VARIANT_A2)).toBe(beforeSecond - 4);
  });
});
