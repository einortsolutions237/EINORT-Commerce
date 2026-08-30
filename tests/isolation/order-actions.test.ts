import { applySetCookies } from "better-auth/cookies";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * ORD-02 / ORD-05 / T-03-50 through T-03-53, against a real Postgres and a
 * real Better Auth session — the merchant-facing half of `transitionOrder`
 * that `tests/isolation/order-audit.test.ts` deliberately does not cover.
 *
 * WHY THIS GOES THROUGH A REAL SESSION RATHER THAN CALLING `transitionOrder`
 * DIRECTLY. `confirmOrder` and `markFulfilled` are `merchantAction`s: the
 * property this file exists to prove is that `ctx.tenantId` and `ctx.userId`
 * — the two values `transitionOrder` is trusted on — arrive from the SESSION
 * and not from anything a caller can set. `order-audit.test.ts` proves the
 * state machine; this file proves the wiring around it, the same way
 * `plan-selection.test.ts` and `read-only.test.ts` prove `switchPlan`'s
 * wiring rather than re-testing `resolveEntitlements`.
 *
 * The harness is `tests/isolation/read-only.test.ts`'s, reused rather than
 * re-invented: Better Auth and Prisma stay the real thing, and only
 * `next/headers` and the rate limiters are substituted.
 *
 * `TENANT_A` / `TENANT_B` from `seedTwoTenants` are used ONLY for the two
 * plain read queries (`listOrdersForMerchant`, `getOrderDetail`), which take
 * a `tenantId` directly and need no session. Every `confirmOrder` /
 * `markFulfilled` case signs up its own merchant, because those fixture users
 * carry no password credential to sign in with (`seedTwoTenants` builds the
 * Better Auth `user`/`member` rows directly and never calls `auth.api.signUp`,
 * so there is no matching `account` row for `signInEmail` to check against).
 * `seedTwoTenants()` runs exactly ONCE in `beforeAll`, so it can never
 * truncate a merchant a still-running test in this file has already signed up
 * (02-03-SUMMARY.md's documented precedent, restated in `read-only.test.ts`).
 */

// ---------------------------------------------------------------------------
// next/headers stand-in
// ---------------------------------------------------------------------------

const { requestContext } = vi.hoisted(() => ({
  requestContext: {
    headers: new Headers(),
    cookies: new Map<string, { name: string; value: string }>(),
  },
}));

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

// ---------------------------------------------------------------------------
// Rate limiters with controllable verdicts
// ---------------------------------------------------------------------------

const { limitVerdict } = vi.hoisted(() => ({
  limitVerdict: { slugCheck: true, signup: true },
}));

vi.mock("@/server/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/rate-limit")>();
  return {
    ...actual,
    slugCheckLimiter: {
      prefix: "rl:slugcheck",
      limit: async () => ({ success: limitVerdict.slugCheck }),
    },
    signupLimiter: {
      prefix: "rl:signup",
      limit: async () => ({ success: limitVerdict.signup }),
    },
  };
});

// Imported after the mocks so the modules under test pick them up.
const { signUpMerchant } = await import("@/server/auth/signup");
const { selectPlan } = await import("@/server/merchant/actions");
const { platformDb } = await import("@/server/db/platform");
const { auth } = await import("@/server/auth/auth");
const { scopedDb } = await import("@/server/db/tenant-scoped");
const { openOrderAtGenesis, transitionOrder } = await import(
  "@/server/orders/transition"
);
const { confirmOrder, markFulfilled } = await import("@/server/orders/actions");
const { listOrdersForMerchant, getOrderDetail } = await import(
  "@/server/orders/queries"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PASSWORD = "correct-horse-battery";

function resetRequestContext(): void {
  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
  requestContext.cookies.clear();
}

/**
 * Put a real, signed session cookie on the NEXT request. See
 * `plan-selection.test.ts` for the full reasoning: the `nextCookies()` jar is
 * always empty under Vitest, so a jar-based helper would silently
 * authenticate nothing.
 */
async function authenticateAs(email: string): Promise<void> {
  const signIn = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    headers: requestContext.headers,
    returnHeaders: true,
  });

  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
  const setCookie = signIn.headers.get("set-cookie");
  if (!setCookie) throw new Error("fixture sign-in issued no session cookie");
  applySetCookies(requestContext.headers, [setCookie]);
}

/** A merchant with a store, a chosen plan and a live session. */
async function signUpAndCarrySession(
  email: string,
  slug: string,
): Promise<{ tenantId: string; userId: string }> {
  const result = await signUpMerchant({
    email,
    password: PASSWORD,
    storeName: "Order Actions Store",
    slug,
  });
  if (!result.ok) {
    throw new Error(`fixture signup failed: ${JSON.stringify(result.error)}`);
  }
  await authenticateAs(email);

  const chosen = await selectPlan({ tier: "business" });
  if (!chosen.ok) {
    throw new Error(`fixture plan pick failed: ${JSON.stringify(chosen.error)}`);
  }

  const organization = await platformDb.organization.findUniqueOrThrow({
    where: { slug },
    select: { id: true },
  });
  const member = await platformDb.member.findFirstOrThrow({
    where: { organizationId: organization.id },
    select: { userId: true },
  });

  return { tenantId: organization.id, userId: member.userId };
}

let orderCounter = 0;

/** A fresh, minimal WHATSAPP order in ORDER_PLACED, ready to be confirmed. */
async function openWhatsAppOrder(tenantId: string): Promise<string> {
  orderCounter += 1;
  const suffix = `${tenantId}-${orderCounter}`;

  const order = await scopedDb(tenantId).$transaction((tx) =>
    openOrderAtGenesis(tx, {
      orderNumber: `wa-${suffix}`,
      channel: "WHATSAPP",
      customerName: "WhatsApp Customer",
      customerPhone: "237600000010",
      deliveryAddress: null,
      customerNote: null,
      subtotalXaf: 4000,
      totalXaf: 4000,
      trackingTokenHash: `tracking-hash-${suffix}`,
      stockHeld: true,
      actor: "CUSTOMER",
    }),
  );

  return order.id;
}

/**
 * Drive a freshly-opened order straight to CONFIRMED, as fixture setup for
 * `markFulfilled` — deliberately NOT through `confirmOrder`, so a bug in
 * `confirmOrder` cannot mask a bug in `markFulfilled` by coincidence.
 */
async function confirmDirect(
  tenantId: string,
  orderId: string,
  actorUserId: string,
): Promise<void> {
  await scopedDb(tenantId).$transaction((tx) =>
    transitionOrder(tx, {
      orderId,
      to: "CONFIRMED",
      actor: "MERCHANT",
      actorUserId,
    }),
  );
}

function countEvents(tenantId: string, orderId: string): Promise<number> {
  return scopedDb(tenantId).orderEvent.count({ where: { orderId } });
}

function readEvents(tenantId: string, orderId: string) {
  return scopedDb(tenantId).orderEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    select: { toState: true, actor: true, actorUserId: true },
  });
}

function readOrder(tenantId: string, orderId: string) {
  return scopedDb(tenantId).order.findUniqueOrThrow({
    where: { id: orderId },
    select: { state: true, confirmedAt: true },
  });
}

/**
 * SEEDED ONCE PER FILE, NOT ONCE PER TEST — see the file header and
 * `read-only.test.ts`'s identical note.
 */
beforeAll(async () => {
  await seedTwoTenants();
});

beforeEach(() => {
  resetRequestContext();
  limitVerdict.slugCheck = true;
  limitVerdict.signup = true;
});

// ---------------------------------------------------------------------------

describe("confirmOrder", () => {
  it("confirms a WHATSAPP order, stamps confirmedAt and names the actor (T-03-51)", async () => {
    const merchant = await signUpAndCarrySession(
      "confirm-happy@example.test",
      "confirm-happy-store",
    );
    const orderId = await openWhatsAppOrder(merchant.tenantId);
    const before = await countEvents(merchant.tenantId, orderId);

    await expect(confirmOrder({ orderId })).resolves.toEqual({ ok: true });

    const order = await readOrder(merchant.tenantId, orderId);
    expect(order.state).toBe("CONFIRMED");
    expect(order.confirmedAt).not.toBeNull();

    expect(await countEvents(merchant.tenantId, orderId)).toBe(before + 1);

    const events = await readEvents(merchant.tenantId, orderId);
    expect(events.at(-1)).toMatchObject({
      toState: "CONFIRMED",
      actor: "MERCHANT",
    });
    expect(events.at(-1)?.actorUserId).toBe(merchant.userId);
  });

  it("refuses another tenant's order id and writes no event anywhere (T-03-50)", async () => {
    const merchantA = await signUpAndCarrySession(
      "confirm-cross-a@example.test",
      "confirm-cross-a-store",
    );
    const merchantB = await signUpAndCarrySession(
      "confirm-cross-b@example.test",
      "confirm-cross-b-store",
    );

    const foreignOrderId = await openWhatsAppOrder(merchantB.tenantId);
    const beforeA = await countEvents(merchantA.tenantId, foreignOrderId);
    const beforeB = await countEvents(merchantB.tenantId, foreignOrderId);

    // Re-authenticate as merchant A: signing up merchant B above left the
    // session cookie pointed at B.
    await authenticateAs("confirm-cross-a@example.test");

    // NOT an ok:false refusal: the row is not visible to tenant A at all, so
    // the miss surfaces as a genuine failure rather than a readable "invalid
    // transition" — the same distinction `order-audit.test.ts`'s tenant-scope
    // case makes for `transitionOrder` directly.
    await expect(confirmOrder({ orderId: foreignOrderId })).rejects.toThrow();

    expect(await countEvents(merchantA.tenantId, foreignOrderId)).toBe(beforeA);
    expect(await countEvents(merchantB.tenantId, foreignOrderId)).toBe(beforeB);

    const order = await readOrder(merchantB.tenantId, foreignOrderId);
    expect(order.state).toBe("ORDER_PLACED");
  });

  it("refuses a second confirmation and leaves the event count at one move (T-03-52)", async () => {
    const merchant = await signUpAndCarrySession(
      "confirm-twice@example.test",
      "confirm-twice-store",
    );
    const orderId = await openWhatsAppOrder(merchant.tenantId);

    await expect(confirmOrder({ orderId })).resolves.toEqual({ ok: true });
    const afterFirst = await countEvents(merchant.tenantId, orderId);

    const second = await confirmOrder({ orderId });
    expect(second.ok).toBe(false);

    expect(await countEvents(merchant.tenantId, orderId)).toBe(afterFirst);
    expect((await readOrder(merchant.tenantId, orderId)).state).toBe(
      "CONFIRMED",
    );
  });
});

describe("markFulfilled", () => {
  it("fulfils a CONFIRMED order and refuses one still in ORDER_PLACED", async () => {
    const merchant = await signUpAndCarrySession(
      "fulfil@example.test",
      "fulfil-store",
    );

    const confirmedOrderId = await openWhatsAppOrder(merchant.tenantId);
    await confirmDirect(merchant.tenantId, confirmedOrderId, merchant.userId);

    await expect(markFulfilled({ orderId: confirmedOrderId })).resolves.toEqual(
      { ok: true },
    );
    expect((await readOrder(merchant.tenantId, confirmedOrderId)).state).toBe(
      "FULFILLED",
    );

    const placedOrderId = await openWhatsAppOrder(merchant.tenantId);
    const result = await markFulfilled({ orderId: placedOrderId });
    expect(result.ok).toBe(false);
    expect((await readOrder(merchant.tenantId, placedOrderId)).state).toBe(
      "ORDER_PLACED",
    );
  });
});

describe("listOrdersForMerchant", () => {
  it("returns only tenant A's needs-attention orders, never a tenant B row", async () => {
    const result = await listOrdersForMerchant(TENANT_A.id, "needs-attention");

    // The fixture seeds exactly one MANUAL_TRANSFER order per tenant in
    // ORDER_PLACED, which IS a needs-attention state.
    expect(result.orders.length).toBeGreaterThan(0);
    for (const order of result.orders) {
      expect(order.id.startsWith(TENANT_A.id)).toBe(true);
      expect(["ORDER_PLACED", "PAYMENT_CLAIMED"]).toContain(order.state);
    }
    expect(
      result.orders.some((order) => order.id.startsWith(TENANT_B.id)),
    ).toBe(false);
  });
});

describe("getOrderDetail", () => {
  it("returns null for another tenant's order id (T-03-53)", async () => {
    const foreignId = `${TENANT_B.id}-order-1`;
    await expect(getOrderDetail(TENANT_A.id, foreignId)).resolves.toBeNull();

    // Sanity: the same id genuinely resolves under its own tenant, so the
    // null above is the cross-tenant guard and not a typo'd id.
    await expect(getOrderDetail(TENANT_B.id, foreignId)).resolves.not.toBeNull();
  });
});
