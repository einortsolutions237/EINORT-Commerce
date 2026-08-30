import { beforeEach, describe, expect, it } from "vitest";

import type { StoredCart } from "@/server/cart/cache";
import { scopedDb } from "@/server/db/tenant-scoped";
import {
  getStorefrontProduct,
  hydrateCart,
  listStorefrontProducts,
} from "@/server/storefront/queries";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * 03-09 Task 2 — the five cases the plan names.
 *
 * These are `isolation` (not `unit`) tests for the reason the seed fixture's
 * own header names: `scopedDb`'s tenant guarantee is a database property, not
 * a stub property, and every case below is checking exactly that guarantee —
 * one tenant's storefront read must not surface another tenant's row, however
 * the query is shaped.
 *
 * Case 2, "a deactivated product disappears from the storefront but remains
 * for the merchant", is adapted from the plan's literal wording. The plan
 * names `listProductsForMerchant` as the second half of that assertion, but
 * that function is owned by `src/server/catalog/queries.ts` (03-06), which
 * has not executed in this worktree (03-09 depends on 03-01/03-02/03-04
 * only). The adaptation below asserts the same underlying invariant —
 * deactivation is D-08's only removal path, never a delete — by reading the
 * row back through the same `scopedDb(tenantId)` a merchant-facing query
 * will use once 03-06 lands.
 */

beforeEach(async () => {
  await seedTwoTenants();
});

describe("listStorefrontProducts", () => {
  it("never returns another tenant's product", async () => {
    const productsA = await listStorefrontProducts(TENANT_A.id);

    expect(productsA.length).toBeGreaterThan(0);
    expect(
      productsA.every((product) => product.id !== `${TENANT_B.id}-product-1`),
    ).toBe(true);
    expect(
      productsA.some((product) => product.id === `${TENANT_A.id}-product-1`),
    ).toBe(true);
  });

  it("hides a deactivated product from the storefront while the row survives (D-08)", async () => {
    await scopedDb(TENANT_A.id).product.update({
      where: { id: `${TENANT_A.id}-product-1` },
      data: { active: false },
    });

    const products = await listStorefrontProducts(TENANT_A.id);
    expect(
      products.some((product) => product.id === `${TENANT_A.id}-product-1`),
    ).toBe(false);

    // Still there, just inactive — the same `scopedDb` read a merchant
    // product list uses. Deactivation, not deletion.
    const stillExists = await scopedDb(TENANT_A.id).product.findUnique({
      where: { id: `${TENANT_A.id}-product-1` },
      select: { id: true, active: true },
    });
    expect(stillExists).toEqual({
      id: `${TENANT_A.id}-product-1`,
      active: false,
    });
  });
});

describe("getStorefrontProduct", () => {
  it("returns null for another tenant's slug", async () => {
    const result = await getStorefrontProduct(
      TENANT_A.id,
      `${TENANT_B.slug}-product-1`,
    );
    expect(result).toBeNull();
  });

  it("returns the product for its own tenant's slug", async () => {
    const result = await getStorefrontProduct(
      TENANT_A.id,
      `${TENANT_A.slug}-product-1`,
    );
    expect(result?.id).toBe(`${TENANT_A.id}-product-1`);
  });
});

describe("hydrateCart", () => {
  it("prices a line from the database and ignores any extra key on the stored object", async () => {
    const stored = {
      tenantId: TENANT_A.id,
      items: [
        {
          variantId: `${TENANT_A.id}-variant-1`,
          quantity: 2,
          // A key `StoredCart["items"][number]` does not declare. `hydrateCart`
          // must never read it — TEN-08's "no client-supplied price" would be
          // broken the moment a stray field like this one changed the output.
          priceXaf: 1,
        },
      ],
      updatedAt: Date.now(),
      // Same idea at the cart level.
      extra: "should be ignored",
    } as unknown as StoredCart;

    const [line] = await hydrateCart(TENANT_A.id, stored);

    // Fixture: `basePriceXaf: 5000`, no variant override.
    expect(line?.unitPriceXaf).toBe(5000);
    expect(line?.lineTotalXaf).toBe(10_000);
    expect(line?.adjustment).toBe("none");
  });

  it("clamps a stored quantity above current stock and flags the adjustment", async () => {
    const stored: StoredCart = {
      tenantId: TENANT_A.id,
      items: [{ variantId: `${TENANT_A.id}-variant-1`, quantity: 999 }],
      updatedAt: Date.now(),
    };

    const [line] = await hydrateCart(TENANT_A.id, stored);

    // Fixture: `stock: 10`.
    expect(line?.adjustment).toBe("clamped");
    expect(line?.quantity).toBe(10);
  });
});
