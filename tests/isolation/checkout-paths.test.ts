import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * CHK-02 — the three payment paths, the two refusals, and the double submit.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE ASSERTS THAT `checkout-trust.test.ts` DOES NOT.
 * ---------------------------------------------------------------------------
 * That file proves `placeOrder` itself: the amounts come from the database and
 * `PlaceOrderInput` has no field to forge. This one proves the ACTION wrapped
 * around it — the part a stranger can POST to without ever loading a page:
 *
 *   · each channel lands in the state D-02 says it should, with the ORD-05
 *     event rows that state implies;
 *   · a channel the merchant has not configured is refused BY THE SERVER, not
 *     merely omitted from the markup (T-03-60, RESEARCH.md Open Question 4);
 *   · the same for an operator the merchant has not configured (D-16);
 *   · one idempotency key produces one order and one stock decrement, however
 *     many times it is submitted (T-03-61);
 *   · a cart cookie carrying another tenant's basket buys nothing (T-03-64).
 *
 * ---------------------------------------------------------------------------
 * THE UPSTASH TRANSPORT IS FAKED; EVERYTHING ABOVE THE WIRE IS REAL.
 * ---------------------------------------------------------------------------
 * `tests/isolation/resolve.test.ts` established the idiom and the reason:
 * substituting `@upstash/redis` with an in-memory implementation keeps the
 * `cart:` and `idem:` namespaces, the `SET NX EX 600` claim, the TTLs and the
 * degradation branches as the REAL code under test. Mocking
 * `@/server/idempotency/cache` instead would make the idempotency assertion
 * a test of the mock — and the whole claim rests on `NX` being one command.
 *
 * The database is the real Neon test branch, because every assertion here is
 * about what did or did not reach Postgres.
 */

// ---------------------------------------------------------------------------
// In-memory Upstash stand-in
// ---------------------------------------------------------------------------

const { redisStore, requestContext, limitVerdict } = vi.hoisted(() => ({
  redisStore: new Map<string, string>(),
  requestContext: {
    headers: new Headers(),
    cookies: new Map<string, { name: string; value: string }>(),
  },
  limitVerdict: { orderPlacement: true },
}));

vi.mock("@upstash/redis", () => {
  class FakeRedis {
    constructor(_config: { url: string; token: string }) {}

    async get<T>(key: string): Promise<T | null> {
      const raw = redisStore.get(key);
      if (raw === undefined) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    }

    /**
     * `nx` is the behaviour the idempotency proof depends on: a claim on a key
     * that already exists returns null rather than overwriting it, in ONE
     * command. TTLs are accepted and ignored — no test here advances a clock,
     * and honouring them would only add a timer to assert nothing with.
     */
    async set(
      key: string,
      value: unknown,
      opts?: { nx?: boolean; ex?: number },
    ): Promise<"OK" | null> {
      if (opts?.nx && redisStore.has(key)) return null;
      redisStore.set(
        key,
        typeof value === "string" ? value : JSON.stringify(value),
      );
      return "OK";
    }

    async del(...keys: string[]): Promise<number> {
      let removed = 0;
      for (const key of keys) if (redisStore.delete(key)) removed += 1;
      return removed;
    }
  }

  return { Redis: FakeRedis };
});

/** Upstash credentials present, so the caches take their configured path. */
vi.mock("@/env", async () => {
  const actual = await vi.importActual<typeof import("@/env")>("@/env");
  const overrides: Record<string, string> = {
    UPSTASH_REDIS_REST_URL: "https://fake.upstash.invalid",
    UPSTASH_REDIS_REST_TOKEN: "fake-token",
  };

  return {
    env: new Proxy(actual.env as unknown as Record<string, unknown>, {
      get(target, prop) {
        if (typeof prop === "string" && prop in overrides) {
          return overrides[prop];
        }
        return Reflect.get(target, prop);
      },
    }) as unknown as typeof actual.env,
  };
});

// ---------------------------------------------------------------------------
// next/headers and next/cache stand-ins
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
  headers: async () => requestContext.headers,
  cookies: async () => ({
    get: (name: string) => requestContext.cookies.get(name),
    getAll: () => Array.from(requestContext.cookies.values()),
    has: (name: string) => requestContext.cookies.has(name),
    set: (name: string, value: string) => {
      requestContext.cookies.set(name, { name, value });
    },
    delete: (name: string) => {
      requestContext.cookies.delete(name);
    },
  }),
}));

/**
 * RETAINED AS AN ASSERTION TARGET, not as a no-op stub.
 *
 * Quick task 260901-6wq deleted `submitCheckout`'s `revalidatePath` call, so
 * nothing in this import graph imports `next/cache` any more and this mock
 * could have gone with it. It is a spy instead, because it is the only place
 * that proves at RUNTIME, against a real database, that no future refactor
 * puts an invalidation back on the placement path. A call here re-renders the
 * `/checkout` route the shopper is standing on, the page's empty-cart guard
 * fires against a basket emptied by the very order that just succeeded, and
 * the shopper is redirected away from their confirmation. Same idiom as
 * `tests/unit/cart.test.ts`. The always-on guard is
 * `tests/unit/checkout-revalidation-race.test.ts`, which needs no database.
 */
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));

/**
 * The limiter, with a verdict this file can set.
 *
 * `@upstash/ratelimit` runs Lua against a real server; pointing it at the fake
 * above would exercise the try/catch rather than the budget. The action's
 * contract — refuse when the verdict is false, proceed when it is true — is
 * what matters here, and it is asserted directly.
 */
vi.mock("@/server/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/rate-limit")>();
  return {
    ...actual,
    orderPlacementLimiter: {
      prefix: "rl:order",
      limit: async () => ({ success: limitVerdict.orderPlacement }),
    },
  };
});

// Imported after the mocks so the module under test picks them up.
const { submitCheckout } = await import("@/server/checkout/actions");
const { CART_COOKIE_NAME, writeStoredCart } = await import(
  "@/server/cart/cache"
);
const { scopedDb } = await import("@/server/db/tenant-scoped");

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const VARIANT_A = `${TENANT_A.id}-variant-1`;
const VARIANT_B = `${TENANT_B.id}-variant-1`;
/** The fixture's configured WhatsApp/MTN number for tenant A. */
const TENANT_A_MSISDN = "237670000001";

type SubmitInput = Parameters<typeof submitCheckout>[0];

function baseSubmission(overrides: Record<string, unknown> = {}): SubmitInput {
  return {
    slug: TENANT_A.slug,
    customerName: "Aminata Nkeng",
    customerPhone: "670 00 01 23",
    deliveryAddress: null,
    customerNote: null,
    channel: "WHATSAPP",
    operator: null,
    idempotencyKey: crypto.randomUUID(),
    ...overrides,
  };
}

/** Put a basket in Redis and point the cookie at it, the way the site does. */
async function giveShopperACart(
  tenantId: string,
  items: { variantId: string; quantity: number }[],
): Promise<string> {
  const cartId = crypto.randomUUID();
  await writeStoredCart(cartId, { tenantId, items, updatedAt: Date.now() });
  requestContext.cookies.set(CART_COOKIE_NAME, {
    name: CART_COOKIE_NAME,
    value: cartId,
  });
  return cartId;
}

function ordersFor(tenantId: string): Promise<number> {
  return scopedDb(tenantId).order.count({});
}

function stockOf(tenantId: string, variantId: string): Promise<number> {
  return scopedDb(tenantId)
    .productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stock: true },
    })
    .then((row) => row.stock);
}

function stateOf(tenantId: string, orderId: string) {
  return scopedDb(tenantId).order.findUniqueOrThrow({
    where: { id: orderId },
    select: { state: true, channel: true, customerPhone: true },
  });
}

function eventsFor(tenantId: string, orderId: string) {
  return scopedDb(tenantId).orderEvent.findMany({
    where: { orderId },
    select: { fromState: true, toState: true, actor: true },
  });
}

/** Rewrite tenant A's payment destinations for one test. */
function setPaymentSettings(data: Record<string, unknown>) {
  return scopedDb(TENANT_A.id).merchantPaymentSettings.updateMany({
    where: {},
    data,
  });
}

beforeEach(async () => {
  await seedTwoTenants();
  redisStore.clear();
  requestContext.cookies.clear();
  limitVerdict.orderPlacement = true;
  revalidatePath.mockClear();
});

// ---------------------------------------------------------------------------

describe("the three channels a Cameroonian shopper actually uses", () => {
  it("places a WHATSAPP order in ORDER_PLACED and hands back the merchant's wa.me link", async () => {
    await giveShopperACart(TENANT_A.id, [{ variantId: VARIANT_A, quantity: 2 }]);

    const result = await submitCheckout(baseSubmission());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await stateOf(TENANT_A.id, result.orderId);
    expect(order.state).toBe("ORDER_PLACED");
    expect(order.channel).toBe("WHATSAPP");
    // The phone was normalized on the way in, not stored as typed.
    expect(order.customerPhone).toBe("237670000123");

    // D-02: a WhatsApp order has no in-band payment, so the genesis event is
    // the only event.
    expect(await eventsFor(TENANT_A.id, result.orderId)).toHaveLength(1);

    /*
     * D-01 — the order and its tracking token already exist by the time this
     * link is produced. The number segment is the merchant's CONFIGURED
     * number, read from `MerchantPaymentSettings`, never from the submission.
     */
    expect(result.whatsappUrl).not.toBeNull();
    expect(result.whatsappUrl).toContain(`https://wa.me/${TENANT_A_MSISDN}?`);
    // 260901-00j: the tracking path is origin-relative — the shape is
    // `/order/{token}` with no `/s/{slug}` prefix, because the proxy hard-404s
    // that prefix when a browser requests it directly (TEN-03/DOM-02). The
    // anchoring and the 32-character token class are unchanged; only the
    // slug-bearing prefix is gone. `trackingUrl` below still carries the full
    // subdomain origin, and this assertion no longer needs `TENANT_A.slug`.
    expect(result.trackingPath).toMatch(/^\/order\/[A-Za-z0-9_-]{32}$/);
    // The tracking URL the shopper is shown carries the plaintext token, and
    // the message carries that URL near the top (D-12).
    expect(decodeURIComponent(result.whatsappUrl ?? "")).toContain(
      result.trackingUrl,
    );
  });

  it("places a CASH_ON_DELIVERY order in ORDER_PLACED, and refuses one with no address", async () => {
    await giveShopperACart(TENANT_A.id, [{ variantId: VARIANT_A, quantity: 1 }]);

    const refused = await submitCheckout(
      baseSubmission({ channel: "CASH_ON_DELIVERY", deliveryAddress: null }),
    );
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    // The requirement appears WITH the selection (B4), so the refusal names
    // the field rather than the form.
    expect(Object.keys(refused.error)).toEqual(["deliveryAddress"]);

    const accepted = await submitCheckout(
      baseSubmission({
        channel: "CASH_ON_DELIVERY",
        deliveryAddress: "Rue Njo-Njo, Bonapriso, Douala",
      }),
    );
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;

    const order = await stateOf(TENANT_A.id, accepted.orderId);
    expect(order.state).toBe("ORDER_PLACED");
    expect(order.channel).toBe("CASH_ON_DELIVERY");
    expect(accepted.whatsappUrl).toBeNull();
  });

  it("places a MANUAL_TRANSFER order in PAYMENT_PENDING with two audit rows", async () => {
    await giveShopperACart(TENANT_A.id, [{ variantId: VARIANT_A, quantity: 1 }]);

    const result = await submitCheckout(
      baseSubmission({ channel: "MANUAL_TRANSFER", operator: "MTN_MOMO" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect((await stateOf(TENANT_A.id, result.orderId)).state).toBe(
      "PAYMENT_PENDING",
    );

    // D-02: the genesis row plus the hop `transitionOrder` wrote. Two rows,
    // not one silently-updated column.
    const events = await eventsFor(TENANT_A.id, result.orderId);
    expect(events).toHaveLength(2);
    expect(
      events.map((e) => `${String(e.fromState)}->${e.toState}`).sort(),
    ).toEqual(["ORDER_PLACED->PAYMENT_PENDING", "null->ORDER_PLACED"]);
  });
});

describe("a payment path the merchant has not configured", () => {
  it("refuses MANUAL_TRANSFER when neither MTN nor Orange has a number, and writes nothing", async () => {
    await setPaymentSettings({ mtnMomoNumber: null, orangeMoneyNumber: null });
    await giveShopperACart(TENANT_A.id, [{ variantId: VARIANT_A, quantity: 1 }]);

    const before = await ordersFor(TENANT_A.id);
    const beforeStock = await stockOf(TENANT_A.id, VARIANT_A);

    const result = await submitCheckout(
      baseSubmission({ channel: "MANUAL_TRANSFER", operator: "MTN_MOMO" }),
    );

    /*
     * THE POINT OF THIS TEST. The checkout page would not have rendered the
     * card at all — but this call never went through the page. The server is
     * the authority, and it refuses independently of the markup (T-03-60).
     */
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.error)).toEqual(["channel"]);

    expect(await ordersFor(TENANT_A.id)).toBe(before);
    expect(await stockOf(TENANT_A.id, VARIANT_A)).toBe(beforeStock);
  });

  it("refuses ORANGE_MONEY when only MTN is configured (D-16)", async () => {
    // The fixture configures an MTN number and no Orange number, which is the
    // common Douala setup and exactly the case D-16 exists for.
    await giveShopperACart(TENANT_A.id, [{ variantId: VARIANT_A, quantity: 1 }]);

    const before = await ordersFor(TENANT_A.id);

    const result = await submitCheckout(
      baseSubmission({ channel: "MANUAL_TRANSFER", operator: "ORANGE_MONEY" }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.error)).toEqual(["operator"]);
    expect(await ordersFor(TENANT_A.id)).toBe(before);
  });

  it("refuses WHATSAPP when the merchant has no WhatsApp number", async () => {
    await setPaymentSettings({ whatsappNumber: null });
    await giveShopperACart(TENANT_A.id, [{ variantId: VARIANT_A, quantity: 1 }]);

    const before = await ordersFor(TENANT_A.id);
    const result = await submitCheckout(baseSubmission());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.error)).toEqual(["channel"]);
    expect(await ordersFor(TENANT_A.id)).toBe(before);
  });
});

describe("a double submit", () => {
  it("produces one order, one stock decrement and the same tracking outcome twice", async () => {
    await giveShopperACart(TENANT_A.id, [{ variantId: VARIANT_A, quantity: 2 }]);

    const before = await ordersFor(TENANT_A.id);
    const beforeStock = await stockOf(TENANT_A.id, VARIANT_A);

    /*
     * ONE key, submitted twice — the impatient tap on a slow connection, which
     * is the normal case rather than the attack. The second call must not
     * reach `placeOrder` at all, and it must still be able to hand the shopper
     * their link: the recall runs BEFORE the cart is read, which is what makes
     * it survive the first call having cleared the basket.
     */
    const submission = baseSubmission({ idempotencyKey: crypto.randomUUID() });

    const first = await submitCheckout(submission);
    const second = await submitCheckout(submission);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(await ordersFor(TENANT_A.id)).toBe(before + 1);
    expect(await stockOf(TENANT_A.id, VARIANT_A)).toBe(beforeStock - 2);

    expect(second.orderId).toBe(first.orderId);
    expect(second.orderNumber).toBe(first.orderNumber);
    expect(second.trackingPath).toBe(first.trackingPath);
    expect(second.trackingUrl).toBe(first.trackingUrl);
    expect(second.whatsappUrl).toBe(first.whatsappUrl);
  });

  it("places a second order when the key differs, because that is a second order", async () => {
    await giveShopperACart(TENANT_A.id, [{ variantId: VARIANT_A, quantity: 1 }]);
    const before = await ordersFor(TENANT_A.id);

    const first = await submitCheckout(baseSubmission());
    expect(first.ok).toBe(true);

    // The first placement cleared the basket, so the shopper needs a new one —
    // which is the honest shape of "ordered twice on purpose".
    await giveShopperACart(TENANT_A.id, [{ variantId: VARIANT_A, quantity: 1 }]);
    const second = await submitCheckout(baseSubmission());
    expect(second.ok).toBe(true);

    expect(await ordersFor(TENANT_A.id)).toBe(before + 2);
  });
});

describe("a cart that does not belong to this store", () => {
  it("refuses a basket stored for tenant B and writes no order for tenant A", async () => {
    // A real, seeded variant belonging to tenant B, in a cart stamped with
    // tenant B's id, presented on tenant A's storefront.
    await giveShopperACart(TENANT_B.id, [{ variantId: VARIANT_B, quantity: 1 }]);

    const beforeA = await ordersFor(TENANT_A.id);
    const beforeB = await ordersFor(TENANT_B.id);
    const beforeStockB = await stockOf(TENANT_B.id, VARIANT_B);

    const result = await submitCheckout(baseSubmission());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Reported as an empty basket, deliberately: the shopper reads the same
    // sentence either way, and the distinction is logged, not published.
    expect(Object.keys(result.error)).toEqual(["form"]);

    expect(await ordersFor(TENANT_A.id)).toBe(beforeA);
    expect(await ordersFor(TENANT_B.id)).toBe(beforeB);
    expect(await stockOf(TENANT_B.id, VARIANT_B)).toBe(beforeStockB);
  });
});

describe("a successful placement invalidates nothing", () => {
  it("places a real order without calling any cache-invalidation API", async () => {
    await giveShopperACart(TENANT_A.id, [{ variantId: VARIANT_A, quantity: 1 }]);

    // Cash on Delivery is the cheapest complete path — no WhatsApp or Mobile
    // Money settings are needed for it to reach the end of the action.
    const result = await submitCheckout(
      baseSubmission({
        channel: "CASH_ON_DELIVERY",
        deliveryAddress: "Rue Njo-Njo, Bonapriso, Douala",
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    /*
     * 260901-6wq. Any call here makes Next re-render the `/checkout` route the
     * shopper is currently on, as part of this same Server Action response.
     * `checkout/page.tsx`'s `payable.length === 0 -> redirect("/cart")` guard
     * then fires — because the basket is empty precisely BECAUSE this order
     * succeeded — and the server redirect beats the client's `setOutcome`. The
     * shopper is bounced to an empty cart and loses their order number, their
     * D-12 tracking link and their payment instructions.
     *
     * Scoping the path narrower is NOT the fix: revalidatePath performs no path
     * matching in Next 16.3.1. See tests/unit/checkout-revalidation-race.test.ts
     * for the citations, and src/server/cart/actions.ts for the one module where
     * the call is correct.
     */
    expect(
      revalidatePath,
      "submitCheckout invalidated a path on a successful placement. The order " +
        "reached the database, but the shopper would never have seen the " +
        "confirmation proving it.",
    ).not.toHaveBeenCalled();
  });
});

describe("the placement budget", () => {
  it("refuses when the limiter says no, before anything is written", async () => {
    await giveShopperACart(TENANT_A.id, [{ variantId: VARIANT_A, quantity: 1 }]);
    limitVerdict.orderPlacement = false;

    const before = await ordersFor(TENANT_A.id);
    const result = await submitCheckout(baseSubmission());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.error)).toEqual(["form"]);
    expect(await ordersFor(TENANT_A.id)).toBe(before);
  });
});
