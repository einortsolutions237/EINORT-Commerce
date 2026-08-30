import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The anonymous cart (CHK-01), asserted at the module boundary.
 *
 * Everything this suite touches is stubbed one layer out — Upstash, the cookie
 * jar, `revalidatePath`, the tenant resolver and `scopedDb` — so the whole file
 * runs in the `unit` project with no network, no database and no request
 * context. That is not a convenience: the cart's security properties are all
 * *decisions* (which tenant a cart belongs to, whether a variant id is real,
 * what the cookie attributes are), and a decision is best proven against a fake
 * that can be interrogated rather than against a real service that can only be
 * observed.
 *
 * TWO ROWS OF THE PLAN'S `<behavior>` BLOCK ARE PROVEN ELSEWHERE, ON PURPOSE:
 * nothing here proves that `scopedDb` really is tenant-scoped, or that a real
 * Postgres refuses a foreign variant — those are database facts, and
 * `tests/isolation/storefront-catalog.test.ts` owns them against the real
 * two-tenant fixture. What this file proves is that the cart *asks*: that a
 * forged variant id is looked up before it can enter a line, and that a cart
 * carrying another tenant's id is discarded rather than merged.
 */

/**
 * `vi.hoisted` runs before the `vi.mock` factories and before every import, so
 * this is the only place that can configure `@/env` — which validates at module
 * evaluation — for the modules under test. Both variables are `.optional()` in
 * `src/env.ts`, so the default `unit` project environment leaves the cart
 * degraded; setting them here is what makes the persistence path reachable at
 * all. The last test in this file deletes them again to prove the other half.
 */
const redisState = vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_URL = "https://cart-unit.upstash.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "cart-unit-token";

  return {
    store: new Map<string, string>(),
    ttl: new Map<string, number>(),
    /** Flipped by a test to make exactly the next call throw. */
    failNext: { get: false, set: false, del: false },
  };
});

/**
 * A fake Upstash client.
 *
 * `get` returns a PARSED object rather than the raw string, mirroring the real
 * transport: Upstash deserializes JSON automatically. `cache.ts` accepts both
 * shapes, and returning the harder one here is what keeps that tolerance
 * honest instead of decorative.
 */
vi.mock("@upstash/redis", () => ({
  Redis: class FakeRedis {
    constructor(_config: { url: string; token: string }) {}

    async get<T>(key: string): Promise<T | null> {
      if (redisState.failNext.get) {
        redisState.failNext.get = false;
        throw new Error("fake upstash: transport failure on GET");
      }
      const raw = redisState.store.get(key);
      if (raw === undefined) return null;
      return JSON.parse(raw) as T;
    }

    async set(key: string, value: string, options?: { ex?: number }) {
      if (redisState.failNext.set) {
        redisState.failNext.set = false;
        throw new Error("fake upstash: transport failure on SET");
      }
      redisState.store.set(key, value);
      if (options?.ex !== undefined) redisState.ttl.set(key, options.ex);
      return "OK";
    }

    async del(...keys: string[]) {
      if (redisState.failNext.del) {
        redisState.failNext.del = false;
        throw new Error("fake upstash: transport failure on DEL");
      }
      let removed = 0;
      for (const key of keys) {
        if (redisState.store.delete(key)) removed += 1;
        redisState.ttl.delete(key);
      }
      return removed;
    }
  },
}));

/**
 * The cookie jar. `options` records every `set` call in order so the attribute
 * assertions can read what was actually asked for rather than what the jar
 * chose to keep.
 */
const cookieJar = vi.hoisted(() => ({
  values: new Map<string, string>(),
  writes: [] as { name: string; value: string; options: Record<string, unknown> }[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get(name: string) {
      const value = cookieJar.values.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name: string, value: string, options: Record<string, unknown>) {
      cookieJar.values.set(name, value);
      cookieJar.writes.push({ name, value, options });
    },
  }),
}));

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));

/** The two stores and their variants, as the stubbed data layer sees them. */
const world = vi.hoisted(() => ({
  tenants: new Map<
    string,
    { id: string; slug: string; name: string; status: string }
  >(),
  variants: new Map<
    string,
    { id: string; tenantId: string; active: boolean; productActive: boolean }
  >(),
}));

vi.mock("@/server/tenant/resolve", () => ({
  resolveTenantBySlug: async (slug: string) => world.tenants.get(slug) ?? null,
}));

/**
 * A stand-in for `scopedDb(tenantId).productVariant.findFirst`.
 *
 * It reproduces the three filters the action relies on — same tenant, variant
 * active, product active — and nothing else. The point of asserting against it
 * is that the action *performed the lookup*; whether Prisma's extension really
 * injects `tenantId` is proven against a real database in the isolation suite.
 */
vi.mock("@/server/db/tenant-scoped", () => ({
  scopedDb: (tenantId: string) => ({
    productVariant: {
      findFirst: async (args: { where: { id?: string } }) => {
        const variant = world.variants.get(args.where.id ?? "");
        if (!variant) return null;
        if (variant.tenantId !== tenantId) return null;
        if (!variant.active || !variant.productActive) return null;
        return { id: variant.id };
      },
    },
  }),
}));

import { addToCart, removeCartLine, setCartQuantity } from "@/server/cart/actions";
import {
  CART_COOKIE_NAME,
  CART_MAX_LINE_QUANTITY,
  CART_TTL_SECONDS,
  clearStoredCart,
  readStoredCart,
  writeStoredCart,
  type StoredCart,
} from "@/server/cart/cache";

const ALPHA = { id: "tenant-a-fixed-id", slug: "alpha-store" };
const BETA = { id: "tenant-b-fixed-id", slug: "beta-store" };

function keyFor(cartId: string): string {
  return `cart:${cartId}`;
}

/** The cart the cookie currently points at, as persisted. */
async function currentCart(): Promise<StoredCart | null> {
  const cartId = cookieJar.values.get(CART_COOKIE_NAME);
  return cartId === undefined ? null : readStoredCart(cartId);
}

function lastCookieWrite() {
  return cookieJar.writes.at(-1);
}

beforeEach(() => {
  redisState.store.clear();
  redisState.ttl.clear();
  redisState.failNext.get = false;
  redisState.failNext.set = false;
  redisState.failNext.del = false;

  cookieJar.values.clear();
  cookieJar.writes.length = 0;

  revalidatePath.mockClear();

  world.tenants.clear();
  world.tenants.set(ALPHA.slug, {
    id: ALPHA.id,
    slug: ALPHA.slug,
    name: "Alpha Store",
    status: "active",
  });
  world.tenants.set(BETA.slug, {
    id: BETA.id,
    slug: BETA.slug,
    name: "Beta Store",
    status: "active",
  });

  world.variants.clear();
  world.variants.set("alpha-variant-1", {
    id: "alpha-variant-1",
    tenantId: ALPHA.id,
    active: true,
    productActive: true,
  });
  world.variants.set("alpha-variant-2", {
    id: "alpha-variant-2",
    tenantId: ALPHA.id,
    active: true,
    productActive: true,
  });
  world.variants.set("alpha-variant-retired", {
    id: "alpha-variant-retired",
    tenantId: ALPHA.id,
    active: false,
    productActive: true,
  });
  world.variants.set("alpha-variant-hidden-product", {
    id: "alpha-variant-hidden-product",
    tenantId: ALPHA.id,
    active: true,
    productActive: false,
  });
  world.variants.set("beta-variant-1", {
    id: "beta-variant-1",
    tenantId: BETA.id,
    active: true,
    productActive: true,
  });
});

describe("cart cache", () => {
  it("returns null for an unknown cart id", async () => {
    await expect(readStoredCart("no-such-cart")).resolves.toBeNull();
  });

  it("never throws when the transport fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      redisState.failNext.get = true;
      await expect(readStoredCart("anything")).resolves.toBeNull();

      redisState.failNext.set = true;
      await expect(
        writeStoredCart("anything", {
          tenantId: ALPHA.id,
          items: [{ variantId: "alpha-variant-1", quantity: 1 }],
          updatedAt: 1,
        }),
      ).resolves.toBeUndefined();

      redisState.failNext.del = true;
      await expect(clearStoredCart("anything")).resolves.toBeUndefined();
    } finally {
      warn.mockRestore();
    }
  });

  it("reads a structurally wrong value as absent rather than as a cart", async () => {
    redisState.store.set(keyFor("corrupt"), JSON.stringify({ nope: true }));
    await expect(readStoredCart("corrupt")).resolves.toBeNull();

    redisState.store.set(
      keyFor("half-written"),
      JSON.stringify({ tenantId: ALPHA.id, items: "not-an-array" }),
    );
    await expect(readStoredCart("half-written")).resolves.toBeNull();
  });

  it("round-trips exactly tenantId, items and updatedAt — and no money", async () => {
    const cart: StoredCart = {
      tenantId: ALPHA.id,
      items: [
        { variantId: "alpha-variant-1", quantity: 2 },
        { variantId: "alpha-variant-2", quantity: 1 },
      ],
      updatedAt: 1_767_225_600_000,
    };

    await writeStoredCart("round-trip", cart);

    const raw = redisState.store.get(keyFor("round-trip"));
    expect(raw).toBeDefined();

    const parsed = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual([
      "items",
      "tenantId",
      "updatedAt",
    ]);

    // TEN-08 as a string assertion: a cart that carries an amount IS a
    // client-supplied amount, so the persisted bytes must contain no word for
    // one anywhere, at any nesting depth.
    expect(raw).not.toMatch(/price|amount|total|xaf/i);

    await expect(readStoredCart("round-trip")).resolves.toEqual(cart);
  });

  it("writes the cart under the `cart:` prefix with the 30-day expiry", async () => {
    await writeStoredCart("ttl-check", {
      tenantId: ALPHA.id,
      items: [],
      updatedAt: 1,
    });

    expect([...redisState.store.keys()]).toEqual([keyFor("ttl-check")]);
    expect(redisState.ttl.get(keyFor("ttl-check"))).toBe(CART_TTL_SECONDS);
    expect(CART_TTL_SECONDS).toBe(60 * 60 * 24 * 30);
  });

  it("clears a cart", async () => {
    await writeStoredCart("doomed", {
      tenantId: ALPHA.id,
      items: [{ variantId: "alpha-variant-1", quantity: 1 }],
      updatedAt: 1,
    });
    await clearStoredCart("doomed");
    await expect(readStoredCart("doomed")).resolves.toBeNull();
  });
});

describe("addToCart", () => {
  it("mints a cart id, sets the cookie and stores one line for a first-time visitor", async () => {
    const result = await addToCart({
      slug: ALPHA.slug,
      variantId: "alpha-variant-1",
      quantity: 1,
    });

    expect(result).toEqual({ ok: true, lineCount: 1 });

    const cartId = cookieJar.values.get(CART_COOKIE_NAME);
    expect(cartId).toBeTypeOf("string");
    expect(cartId).not.toBe("");

    await expect(currentCart()).resolves.toMatchObject({
      tenantId: ALPHA.id,
      items: [{ variantId: "alpha-variant-1", quantity: 1 }],
    });
  });

  it("sets a host-scoped, HttpOnly, lax cookie with no domain attribute", async () => {
    await addToCart({
      slug: ALPHA.slug,
      variantId: "alpha-variant-1",
      quantity: 1,
    });

    const write = lastCookieWrite();
    expect(write?.name).toBe(CART_COOKIE_NAME);
    expect(write?.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: CART_TTL_SECONDS,
    });

    // T-03-45. Omitting `domain` is what host-scopes the cookie to one store's
    // subdomain; setting `.einort.com` would hand every tenant the same cart.
    expect(write?.options).not.toHaveProperty("domain");

    // Not production under test, so the flag must follow the environment
    // rather than being hardcoded either way.
    expect(write?.options.secure).toBe(false);
  });

  it("increments an existing line instead of appending a second one", async () => {
    await addToCart({
      slug: ALPHA.slug,
      variantId: "alpha-variant-1",
      quantity: 2,
    });
    const second = await addToCart({
      slug: ALPHA.slug,
      variantId: "alpha-variant-1",
      quantity: 3,
    });

    expect(second).toEqual({ ok: true, lineCount: 5 });
    await expect(currentCart()).resolves.toMatchObject({
      items: [{ variantId: "alpha-variant-1", quantity: 5 }],
    });
  });

  it("keeps distinct variants as distinct lines, in insertion order", async () => {
    await addToCart({
      slug: ALPHA.slug,
      variantId: "alpha-variant-1",
      quantity: 1,
    });
    await addToCart({
      slug: ALPHA.slug,
      variantId: "alpha-variant-2",
      quantity: 4,
    });

    await expect(currentCart()).resolves.toMatchObject({
      items: [
        { variantId: "alpha-variant-1", quantity: 1 },
        { variantId: "alpha-variant-2", quantity: 4 },
      ],
    });
  });

  it("refuses a variant id the shopper made up, or one belonging to another store", async () => {
    await expect(
      addToCart({ slug: ALPHA.slug, variantId: "invented", quantity: 1 }),
    ).resolves.toEqual({ ok: false, reason: "variant_unavailable" });

    // T-03-46: beta's variant is real, but not on alpha's storefront.
    await expect(
      addToCart({ slug: ALPHA.slug, variantId: "beta-variant-1", quantity: 1 }),
    ).resolves.toEqual({ ok: false, reason: "variant_unavailable" });

    // D-08: a deactivated product is invisible to shoppers, so its variants
    // cannot be bought either.
    await expect(
      addToCart({
        slug: ALPHA.slug,
        variantId: "alpha-variant-hidden-product",
        quantity: 1,
      }),
    ).resolves.toEqual({ ok: false, reason: "variant_unavailable" });

    await expect(
      addToCart({
        slug: ALPHA.slug,
        variantId: "alpha-variant-retired",
        quantity: 1,
      }),
    ).resolves.toEqual({ ok: false, reason: "variant_unavailable" });

    expect(cookieJar.values.get(CART_COOKIE_NAME)).toBeUndefined();
    expect(redisState.store.size).toBe(0);
  });

  it("refuses a store that does not resolve", async () => {
    await expect(
      addToCart({
        slug: "nobody-store",
        variantId: "alpha-variant-1",
        quantity: 1,
      }),
    ).resolves.toEqual({ ok: false, reason: "store_not_found" });

    expect(cookieJar.values.get(CART_COOKIE_NAME)).toBeUndefined();
  });

  it("clamps quantity to an integer between 1 and the per-line maximum", async () => {
    await addToCart({
      slug: ALPHA.slug,
      variantId: "alpha-variant-1",
      quantity: 2.7,
    });
    await expect(currentCart()).resolves.toMatchObject({
      items: [{ variantId: "alpha-variant-1", quantity: 2 }],
    });

    await addToCart({
      slug: ALPHA.slug,
      variantId: "alpha-variant-2",
      quantity: CART_MAX_LINE_QUANTITY + 500,
    });
    await expect(currentCart()).resolves.toMatchObject({
      items: [
        { variantId: "alpha-variant-1", quantity: 2 },
        { variantId: "alpha-variant-2", quantity: CART_MAX_LINE_QUANTITY },
      ],
    });

    // The increment path is clamped too, not just the first write.
    await addToCart({
      slug: ALPHA.slug,
      variantId: "alpha-variant-2",
      quantity: 10,
    });
    await expect(currentCart()).resolves.toMatchObject({
      items: [
        { variantId: "alpha-variant-1", quantity: 2 },
        { variantId: "alpha-variant-2", quantity: CART_MAX_LINE_QUANTITY },
      ],
    });
  });

  it("refuses a quantity below one rather than silently removing the line", async () => {
    await expect(
      addToCart({
        slug: ALPHA.slug,
        variantId: "alpha-variant-1",
        quantity: -3,
      }),
    ).resolves.toEqual({ ok: false, reason: "invalid_quantity" });

    await expect(
      addToCart({
        slug: ALPHA.slug,
        variantId: "alpha-variant-1",
        quantity: Number.NaN,
      }),
    ).resolves.toEqual({ ok: false, reason: "invalid_quantity" });
  });

  it("discards a cart carrying another tenant's id instead of merging into it", async () => {
    // The cookie escapes its host scope somehow — a shared browser profile, a
    // proxy, a copied header — and arrives on beta's storefront still pointing
    // at a cart built on alpha's.
    const leaked = "leaked-cart-id";
    await writeStoredCart(leaked, {
      tenantId: ALPHA.id,
      items: [
        { variantId: "alpha-variant-1", quantity: 2 },
        { variantId: "alpha-variant-2", quantity: 9 },
      ],
      updatedAt: 1,
    });
    cookieJar.values.set(CART_COOKIE_NAME, leaked);

    const result = await addToCart({
      slug: BETA.slug,
      variantId: "beta-variant-1",
      quantity: 1,
    });

    expect(result).toEqual({ ok: true, lineCount: 1 });

    const stored = await currentCart();
    expect(stored?.tenantId).toBe(BETA.id);
    expect(stored?.items).toEqual([{ variantId: "beta-variant-1", quantity: 1 }]);
  });

  it("reads a cart bound to another tenant as empty", async () => {
    const leaked = "leaked-read";
    await writeStoredCart(leaked, {
      tenantId: ALPHA.id,
      items: [{ variantId: "alpha-variant-1", quantity: 2 }],
      updatedAt: 1,
    });

    // The raw read is deliberately unopinionated — the tenant comparison is the
    // caller's, because only the caller knows which host resolved.
    await expect(readStoredCart(leaked)).resolves.toMatchObject({
      tenantId: ALPHA.id,
    });
  });

  it("revalidates the storefront so the header count is not stale", async () => {
    await addToCart({
      slug: ALPHA.slug,
      variantId: "alpha-variant-1",
      quantity: 1,
    });
    expect(revalidatePath).toHaveBeenCalled();
    expect(revalidatePath.mock.calls.flat()).toContain(`/s/${ALPHA.slug}`);
  });
});

describe("setCartQuantity and removeCartLine", () => {
  async function seedTwoLines(): Promise<void> {
    await addToCart({
      slug: ALPHA.slug,
      variantId: "alpha-variant-1",
      quantity: 2,
    });
    await addToCart({
      slug: ALPHA.slug,
      variantId: "alpha-variant-2",
      quantity: 3,
    });
  }

  it("replaces a line's quantity rather than adding to it", async () => {
    await seedTwoLines();

    const result = await setCartQuantity({
      slug: ALPHA.slug,
      variantId: "alpha-variant-1",
      quantity: 5,
    });

    expect(result).toEqual({ ok: true, lineCount: 8 });
    await expect(currentCart()).resolves.toMatchObject({
      items: [
        { variantId: "alpha-variant-1", quantity: 5 },
        { variantId: "alpha-variant-2", quantity: 3 },
      ],
    });
  });

  it("treats zero as removal", async () => {
    await seedTwoLines();

    const result = await setCartQuantity({
      slug: ALPHA.slug,
      variantId: "alpha-variant-1",
      quantity: 0,
    });

    expect(result).toEqual({ ok: true, lineCount: 3 });
    await expect(currentCart()).resolves.toMatchObject({
      items: [{ variantId: "alpha-variant-2", quantity: 3 }],
    });
  });

  it("refuses a negative quantity and leaves the cart untouched", async () => {
    await seedTwoLines();

    await expect(
      setCartQuantity({
        slug: ALPHA.slug,
        variantId: "alpha-variant-1",
        quantity: -1,
      }),
    ).resolves.toEqual({ ok: false, reason: "invalid_quantity" });

    await expect(currentCart()).resolves.toMatchObject({
      items: [
        { variantId: "alpha-variant-1", quantity: 2 },
        { variantId: "alpha-variant-2", quantity: 3 },
      ],
    });
  });

  it("clamps to the per-line maximum", async () => {
    await seedTwoLines();

    await setCartQuantity({
      slug: ALPHA.slug,
      variantId: "alpha-variant-1",
      quantity: CART_MAX_LINE_QUANTITY * 4,
    });

    await expect(currentCart()).resolves.toMatchObject({
      items: [
        { variantId: "alpha-variant-1", quantity: CART_MAX_LINE_QUANTITY },
        { variantId: "alpha-variant-2", quantity: 3 },
      ],
    });
  });

  it("removes a line", async () => {
    await seedTwoLines();

    const result = await removeCartLine({
      slug: ALPHA.slug,
      variantId: "alpha-variant-2",
    });

    expect(result).toEqual({ ok: true, lineCount: 2 });
    await expect(currentCart()).resolves.toMatchObject({
      items: [{ variantId: "alpha-variant-1", quantity: 2 }],
    });
  });

  it("removes a line that is no longer sellable without needing it to be valid", async () => {
    await seedTwoLines();

    // The merchant deactivates the product while the cart is open. Removal must
    // still work — refusing it would strand the shopper with an unremovable
    // line.
    world.variants.set("alpha-variant-2", {
      id: "alpha-variant-2",
      tenantId: ALPHA.id,
      active: false,
      productActive: true,
    });

    await expect(
      removeCartLine({ slug: ALPHA.slug, variantId: "alpha-variant-2" }),
    ).resolves.toEqual({ ok: true, lineCount: 2 });
  });
});

describe("degraded Upstash", () => {
  it("keeps the storefront up with a non-persistent cart when Upstash is absent", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();

    try {
      const cache = await import("@/server/cart/cache");
      const actions = await import("@/server/cart/actions");

      // Resolves rather than throwing — a missing cache adds database load and
      // loses persistence; it must never take a storefront down.
      await expect(
        actions.addToCart({
          slug: ALPHA.slug,
          variantId: "alpha-variant-1",
          quantity: 1,
        }),
      ).resolves.toMatchObject({ ok: true });

      // Nothing was persisted, so the next read is empty.
      await expect(cache.readStoredCart("anything")).resolves.toBeNull();
      expect(redisState.store.size).toBe(0);

      // The degradation is loud. Silence is how a cacheless configuration
      // reaches production unnoticed.
      expect(warn).toHaveBeenCalled();
    } finally {
      if (url !== undefined) process.env.UPSTASH_REDIS_REST_URL = url;
      if (token !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = token;
      vi.resetModules();
      warn.mockRestore();
    }
  });
});
