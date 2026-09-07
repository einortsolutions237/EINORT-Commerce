import { beforeAll, describe, expect, it } from "vitest";

import { searchMerchantSurface } from "@/server/search/queries";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * Quick task 260906-egn, T-egn-01 in that plan's threat model — the single
 * highest-value control on the new search endpoint: a query that matches
 * tenant A's own product and order must return NOTHING when run as tenant B.
 *
 * `searchMerchantSurface` is a plain function of `(tenantId, q)` with no
 * session or header dependency, so this test calls it directly rather than
 * reaching for `tests/isolation/merchant-context.test.ts`'s full
 * signed-session harness — there is no auth boundary to simulate here, only
 * the `scopedDb` tenant filter this file exists to prove.
 *
 * The two-tenant fixture (`tests/setup/seed-two-tenants.ts`) already seeds
 * exactly the shape this test needs, with fixed, human-readable identifiers
 * rather than random ones: tenant A owns a product named "Alpha Store
 * Product" and an order numbered "alpha-store-0001" for customer "Alpha
 * Store Customer". A query for "Alpha" matches all three fields (the product
 * name, the order number, and the customer name), which is what makes the
 * positive control below non-vacuous — if it did not match under tenant A's
 * own id, the negative assertion under tenant B would prove nothing.
 */
beforeAll(async () => {
  await seedTwoTenants();
});

describe("searchMerchantSurface cross-tenant isolation", () => {
  it("matches tenant A's own product and order under tenant A's id", async () => {
    const result = await searchMerchantSurface(TENANT_A.id, "Alpha");

    expect(
      result.products.map((product) => product.id),
      "the positive control found no product, so the negative assertion " +
        "below would prove nothing",
    ).toContain(`${TENANT_A.id}-product-1`);

    expect(
      result.orders.map((order) => order.id),
      "the positive control found no order, so the negative assertion below " +
        "would prove nothing",
    ).toContain(`${TENANT_A.id}-order-1`);
  });

  it("returns neither tenant A's product nor its order when searched as tenant B", async () => {
    const result = await searchMerchantSurface(TENANT_B.id, "Alpha");

    expect(result.products).toEqual([]);
    expect(result.orders).toEqual([]);
  });

  it("returns neither tenant B's product nor its order when searched as tenant A", async () => {
    // The symmetric direction: proves the filter is a tenant boundary, not a
    // one-way accident of which tenant happened to be seeded first.
    const result = await searchMerchantSurface(TENANT_A.id, "Beta");

    expect(result.products).toEqual([]);
    expect(result.orders).toEqual([]);
  });

  it("matches on order number and customer name, not only product name", async () => {
    // "alpha-store-0001" is the order NUMBER; it shares no word with the
    // product name "Alpha Store Product", so this proves the OR's second and
    // third branches (orderNumber, customerName) are actually reachable and
    // not dead code beside the product arm.
    const byOrderNumber = await searchMerchantSurface(
      TENANT_A.id,
      "alpha-store-0001",
    );
    expect(byOrderNumber.orders.map((order) => order.id)).toContain(
      `${TENANT_A.id}-order-1`,
    );

    const byCustomerName = await searchMerchantSurface(
      TENANT_A.id,
      "Store Customer",
    );
    expect(byCustomerName.orders.map((order) => order.id)).toContain(
      `${TENANT_A.id}-order-1`,
    );
  });
});
