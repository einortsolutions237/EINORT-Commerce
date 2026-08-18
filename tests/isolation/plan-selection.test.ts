import { applySetCookies } from "better-auth/cookies";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { strings } from "@/lib/strings";

import { seedTwoTenants, TENANT_B } from "../setup/seed-two-tenants";

/**
 * SUB-01 and D-05: the plan pick is a real, recorded choice, and it is recorded
 * on the merchant's OWN organization.
 *
 * THE TENANT TARGET IS NEVER IN THE PAYLOAD. `selectPlan` accepts `{ tier }`
 * and nothing else — no organization id, no tenant id, no user id — so the
 * write always lands on `session.session.activeOrganizationId`. The
 * "forged organizationId ignored" block below is the regression test for that
 * property (T-02-06); it passes a REAL id belonging to the second seeded tenant
 * rather than an invented one, so a naive implementation that trusted the
 * payload would actually succeed in writing to it and the test would catch a
 * genuine cross-tenant write rather than a foreign-key error.
 *
 * This file is in the `isolation` project rather than `unit` for the same
 * reason `signup.test.ts` is: every assertion here is about what reached
 * Postgres. Against a stubbed database "the other organization's planTier is
 * still null" is vacuously true, which is exactly the failure mode a tenant
 * control's regression test must not have.
 *
 * The harness below is `tests/isolation/signup.test.ts`'s, reused rather than
 * re-invented. Better Auth and Prisma stay the real thing (01-06's note): only
 * `next/headers` and the rate limiters are substituted.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PASSWORD = "correct-horse-battery";

function resetRequestContext(): void {
  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
  requestContext.cookies.clear();
}

/**
 * Put a real, signed session cookie on the NEXT request.
 *
 * `selectPlan` reads `await headers()`, so the merchant's session has to arrive
 * the way a browser would send it — in a `Cookie` header — rather than being
 * inherited from the signup call. `applySetCookies` is Better Auth's own helper
 * (the same one `signup.ts` uses internally): the session cookie is SIGNED and
 * percent-encoded, so a hand-rolled `name=value` join gets the encode/decode
 * round trip subtly wrong and presents as an expired session.
 *
 * The `nextCookies()` jar is deliberately NOT the source here. That plugin
 * reaches for its cookie store through a dynamic `import("next/headers.js")`,
 * which the `vi.mock("next/headers")` above does not intercept, so under Vitest
 * the jar stays empty and a jar-based helper would silently authenticate
 * nothing. Signing in for the cookie is both the real round trip and the honest
 * one — and it additionally exercises the `databaseHooks` back-fill that puts
 * `activeOrganizationId` on a session created by `signInEmail`.
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

/** A merchant with a store and a live session, ready to pick a plan. */
async function signUpAndCarrySession(
  email: string,
  slug: string,
): Promise<string> {
  const result = await signUpMerchant({
    email,
    password: PASSWORD,
    storeName: "Plan Picker Store",
    slug,
  });
  if (!result.ok) {
    throw new Error(`fixture signup failed: ${JSON.stringify(result.error)}`);
  }
  await authenticateAs(email);
  return result.slug;
}

function organizationBySlug(slug: string) {
  return platformDb.organization.findUnique({
    where: { slug },
    select: { id: true, planTier: true, planSelectedAt: true },
  });
}

beforeEach(async () => {
  await seedTwoTenants();
  resetRequestContext();
  limitVerdict.slugCheck = true;
  limitVerdict.signup = true;
});

// ---------------------------------------------------------------------------

describe("selects a plan", () => {
  it("writes planTier and planSelectedAt on the session's organization", async () => {
    const slug = await signUpAndCarrySession("picker@example.test", "picker-store");

    await expect(selectPlan({ tier: "business" })).resolves.toEqual({
      ok: true,
      slug,
    });

    // Read the ROW back, not the return value: the point of SUB-01 is that the
    // choice is persisted, and a return shape can be right while the write is
    // missing.
    const organization = await organizationBySlug(slug);
    expect(organization?.planTier).toBe("business");
    expect(organization?.planSelectedAt).not.toBeNull();
  });
});

describe("rejects an unknown tier", () => {
  it("returns a field error on tier and leaves the row untouched", async () => {
    const slug = await signUpAndCarrySession("unknown@example.test", "unknown-tier-store");

    const result = await selectPlan({ tier: "enterprise" });

    expect(result.ok).toBe(false);
    const error = (result as { ok: false; error: Record<string, string[]> })
      .error;
    expect(Object.keys(error)).toContain("tier");

    const organization = await organizationBySlug(slug);
    expect(organization?.planTier).toBeNull();
    expect(organization?.planSelectedAt).toBeNull();
  });
});

describe("forged organizationId ignored", () => {
  it("writes to the session's own organization and never the forged one", async () => {
    const slug = await signUpAndCarrySession("forger@example.test", "forger-store");

    // TENANT_B is a real, seeded organization — the id is not invented, so an
    // implementation that trusted the payload would genuinely write to it.
    await expect(
      selectPlan({ tier: "starter", organizationId: TENANT_B.id }),
    ).resolves.toEqual({ ok: true, slug });

    const own = await organizationBySlug(slug);
    expect(own?.planTier).toBe("starter");

    const forged = await platformDb.organization.findUnique({
      where: { id: TENANT_B.id },
      select: { planTier: true, planSelectedAt: true },
    });
    expect(forged?.planTier).toBeNull();
    expect(forged?.planSelectedAt).toBeNull();
  });
});

describe("idempotent when already chosen", () => {
  it("returns ok twice and leaves exactly one tier on the row", async () => {
    const slug = await signUpAndCarrySession("twice@example.test", "twice-store");

    await expect(selectPlan({ tier: "starter" })).resolves.toEqual({
      ok: true,
      slug,
    });

    const afterFirst = await organizationBySlug(slug);
    expect(afterFirst?.planTier).toBe("starter");
    const firstSelectedAt = afterFirst?.planSelectedAt;

    // A double-submit, or a stale tab, must not be able to re-price the store.
    await expect(selectPlan({ tier: "professional" })).resolves.toEqual({
      ok: true,
      slug,
    });

    const afterSecond = await organizationBySlug(slug);
    expect(afterSecond?.planTier).toBe("starter");
    expect(afterSecond?.planSelectedAt).toEqual(firstSelectedAt);
  });
});

describe("no session", () => {
  it("returns the session-expired copy instead of throwing", async () => {
    // An empty jar and empty headers: the direct-POST case, reachable without
    // the form at all (T-02-07).
    resetRequestContext();

    const result = await selectPlan({ tier: "starter" });

    expect(result.ok).toBe(false);
    const error = (result as { ok: false; error: Record<string, string[]> })
      .error;
    expect(error.form).toEqual([strings.signup.sessionExpired]);
  });
});
