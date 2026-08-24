import { beforeEach, describe, expect, it } from "vitest";

import type { Prisma } from "@/generated/prisma/client";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";
import { OutOfStockError } from "@/server/orders/errors";
import { holdStockForLines, releaseStock } from "@/server/orders/stock";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * CAT-03 / T-03-35, T-03-36, T-03-37 — the phase's highest-value test.
 *
 * ---------------------------------------------------------------------------
 * OPEN THIS FILE FIRST WHEN YOU DOUBT THE STOCK GUARANTEE.
 * ---------------------------------------------------------------------------
 * Overselling is the failure a merchant cannot recover from. They have taken
 * money — over Mobile Money, in cash at the door — for a unit that does not
 * exist, and the only remedies left are a refund they have to arrange manually
 * and a customer who tells other people. Every other bug in this phase costs
 * somebody time; this one costs a merchant their reputation on the platform
 * that promised them a shop.
 *
 * So "the decrement is atomic" may not be a code-review opinion. It has to be a
 * database property, demonstrated by transactions that genuinely overlap. That
 * is why this file is an isolation test and could not be anything else: a
 * stubbed client has no row lock to contend for, so every assertion below would
 * be vacuously true against one.
 *
 * ---------------------------------------------------------------------------
 * WHAT "GENUINELY OVERLAP" MEANS HERE.
 * ---------------------------------------------------------------------------
 * Each racing branch opens its OWN `$transaction` and the branches are started
 * together with `Promise.allSettled`, so both are in flight before either
 * commits. The second one's `UPDATE` then blocks on the first one's row lock,
 * and — this is the property under test — re-evaluates its `WHERE` against the
 * committed row version once the lock is released. `allSettled` rather than
 * `all` is deliberate: `all` rejects on the first failure and would throw away
 * the other branch's outcome, which is half of what each case asserts.
 *
 * The fixture is `tests/setup/seed-two-tenants.ts`'s, reseeded before every
 * test: one product per tenant with a single implicit variant at `stock: 10`.
 * Cases that need a different starting stock, or a second variant, set it up
 * explicitly rather than depending on the fixture's number.
 */

const VARIANT_A = `${TENANT_A.id}-variant-1`;
const VARIANT_B_TENANT = `${TENANT_B.id}-variant-1`;
/** A second variant on tenant A's product, created by the deadlock case. */
const VARIANT_A2 = `${TENANT_A.id}-variant-2`;
const ORDER_A = `${TENANT_A.id}-order-1`;

/** Hold `lines` in one scoped transaction, exactly as `placeOrder` will. */
function holdInOwnTransaction(
  tenantId: string,
  lines: readonly { variantId: string; quantity: number }[],
): Promise<void> {
  return scopedDb(tenantId).$transaction((tx) => holdStockForLines(tx, lines));
}

function readStock(tenantId: string, variantId: string): Promise<number> {
  return scopedDb(tenantId)
    .productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stock: true },
    })
    .then((row) => row.stock);
}

function setStock(
  tenantId: string,
  variantId: string,
  stock: number,
): Promise<unknown> {
  return scopedDb(tenantId).productVariant.updateMany({
    where: { id: variantId },
    data: { stock },
  });
}

/** Add a second variant to tenant A's seeded product. */
function createSecondVariant(stock: number): Promise<unknown> {
  return scopedDb(TENANT_A.id).productVariant.create({
    data: scopedCreateData<Prisma.ProductVariantUncheckedCreateInput>({
      id: VARIANT_A2,
      productId: `${TENANT_A.id}-product-1`,
      // The fixture variant is the implicit `("", "")` one, and
      // `@@unique([tenantId, productId, option1Value, option2Value])` means a
      // sibling has to differ on an option value.
      option1Value: "SECOND",
      option2Value: "",
      priceXaf: null,
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

describe("two shoppers racing for the last unit in stock", () => {
  it("lets exactly one win, and never leaves stock below zero", async () => {
    await setStock(TENANT_A.id, VARIANT_A, 1);

    /*
     * THIS IS THE ASSERTION THE PHASE EXISTS TO MAKE.
     *
     * Both branches ask for the same single unit at the same moment. If the
     * conditional `stock: { gte: quantity }` predicate were replaced by a
     * read-then-write — check availability, then decrement — both would read
     * `stock = 1`, both would decrement, and the variant would land at -1 with
     * two customers each believing they bought it.
     */
    const outcomes = await Promise.allSettled([
      holdInOwnTransaction(TENANT_A.id, [{ variantId: VARIANT_A, quantity: 1 }]),
      holdInOwnTransaction(TENANT_A.id, [{ variantId: VARIANT_A, quantity: 1 }]),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o) => o.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // The loser must be told it is out of stock, not handed some generic
    // database error — the checkout page has a specific thing to say about a
    // sold-out line, and it identifies the line by `OutOfStockError.variantId`.
    const failure = rejected[0]?.reason as unknown;
    expect(failure).toBeInstanceOf(OutOfStockError);
    expect((failure as OutOfStockError).variantId).toBe(VARIANT_A);

    // Never -1. This is the number a merchant would have discovered by finding
    // an empty shelf.
    expect(await readStock(TENANT_A.id, VARIANT_A)).toBe(0);
  });

  it("rolls back an earlier line when a later line in the same order sells out", async () => {
    await createSecondVariant(5);
    await setStock(TENANT_A.id, VARIANT_A, 3);

    // Sorted order puts `-variant-1` before `-variant-2`, so the first line
    // succeeds and the second must undo it.
    await expect(
      holdInOwnTransaction(TENANT_A.id, [
        { variantId: VARIANT_A, quantity: 2 },
        { variantId: VARIANT_A2, quantity: 99 },
      ]),
    ).rejects.toBeInstanceOf(OutOfStockError);

    // A partial hold is inventory sold to an order that was never written.
    expect(await readStock(TENANT_A.id, VARIANT_A)).toBe(3);
    expect(await readStock(TENANT_A.id, VARIANT_A2)).toBe(5);
  });
});

describe("two multi-line orders buying the same variants in opposite order", () => {
  it("both settle without a deadlock, because the lines are sorted first", async () => {
    await createSecondVariant(5);
    await setStock(TENANT_A.id, VARIANT_A, 5);

    /*
     * THE CASE THAT PROVES THE SORT, RATHER THAN A COMMENT CLAIMING IT.
     *
     * Without `sortedByVariant`, one branch locks variant 1 then wants
     * variant 2 while the other holds variant 2 and wants variant 1. Postgres
     * spots the cycle and kills one with SQLSTATE `40P01` — a "deadlock
     * detected" error, which reaches the shopper as a 500 during checkout and
     * looks, to whoever reads the log, like a random infrastructure blip
     * rather than a design defect.
     *
     * Both inputs below are deliberately in OPPOSITE sequence. Both must
     * still succeed, and both variants must land at 3.
     */
    const outcomes = await Promise.allSettled([
      holdInOwnTransaction(TENANT_A.id, [
        { variantId: VARIANT_A, quantity: 2 },
        { variantId: VARIANT_A2, quantity: 2 },
      ]),
      holdInOwnTransaction(TENANT_A.id, [
        { variantId: VARIANT_A2, quantity: 2 },
        { variantId: VARIANT_A, quantity: 2 },
      ]),
    ]);

    const reasons = outcomes
      .filter((o) => o.status === "rejected")
      .map((o) => String((o as PromiseRejectedResult).reason));

    // Named explicitly so a failure here reads as "the sort was removed"
    // rather than as a flaky test.
    expect(reasons.join(" | ")).not.toMatch(/40P01|deadlock/i);
    expect(reasons).toEqual([]);

    expect(await readStock(TENANT_A.id, VARIANT_A)).toBe(1);
    expect(await readStock(TENANT_A.id, VARIANT_A2)).toBe(1);
  });
});

describe("releasing a hold", () => {
  it("returns the units exactly once, however many times it is called", async () => {
    const before = await readStock(TENANT_A.id, VARIANT_A);

    await holdInOwnTransaction(TENANT_A.id, [
      { variantId: VARIANT_A, quantity: 1 },
    ]);
    expect(await readStock(TENANT_A.id, VARIANT_A)).toBe(before - 1);

    // The seeded order holds one unit of this variant (`stockHeld: true`,
    // one `OrderItem` at quantity 1), which is what `releaseStock` gives back.
    await scopedDb(TENANT_A.id).$transaction((tx) => releaseStock(tx, ORDER_A));

    expect(await readStock(TENANT_A.id, VARIANT_A)).toBe(before);
    expect(
      (
        await scopedDb(TENANT_A.id).order.findUniqueOrThrow({
          where: { id: ORDER_A },
          select: { stockHeld: true },
        })
      ).stockHeld,
    ).toBe(false);

    /*
     * The second call is the whole point (Pitfall 6 / T-03-37). A merchant
     * double-tapping "Reject", or a retried Server Action, must not invent a
     * unit — because the merchant then oversells FOR REAL, having been told by
     * their own dashboard that the stock existed, and nothing in the system
     * contradicts them.
     */
    await scopedDb(TENANT_A.id).$transaction((tx) => releaseStock(tx, ORDER_A));

    expect(await readStock(TENANT_A.id, VARIANT_A)).toBe(before);
  });

  it("is a no-op for two concurrent releases of the same order", async () => {
    const before = await readStock(TENANT_A.id, VARIANT_A);

    const outcomes = await Promise.allSettled([
      scopedDb(TENANT_A.id).$transaction((tx) => releaseStock(tx, ORDER_A)),
      scopedDb(TENANT_A.id).$transaction((tx) => releaseStock(tx, ORDER_A)),
    ]);

    expect(outcomes.every((o) => o.status === "fulfilled")).toBe(true);

    // The seeded order holds one unit. Exactly one release may add it back.
    expect(await readStock(TENANT_A.id, VARIANT_A)).toBe(before + 1);
  });
});

describe("tenant scope", () => {
  it("cannot decrement another tenant's variant, even with its real id", async () => {
    const before = await readStock(TENANT_B.id, VARIANT_B_TENANT);
    expect(before).toBeGreaterThan(0);

    /*
     * A REAL, SEEDED id belonging to tenant B — not an invented string. An
     * invented id would fail for the boring reason too, and the test would
     * keep passing with the tenant-scope extension removed.
     *
     * The extension rewrites the `where` of the `updateMany`, so the row is
     * simply not visible and the conditional decrement matches nothing. A
     * cross-tenant decrement is therefore impossible rather than unlikely, and
     * it surfaces to the caller in the same shape as a sold-out line.
     */
    await expect(
      holdInOwnTransaction(TENANT_A.id, [
        { variantId: VARIANT_B_TENANT, quantity: 1 },
      ]),
    ).rejects.toBeInstanceOf(OutOfStockError);

    expect(await readStock(TENANT_B.id, VARIANT_B_TENANT)).toBe(before);
  });
});
