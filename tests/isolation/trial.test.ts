import { applySetCookies } from "better-auth/cookies";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedTwoTenants } from "../setup/seed-two-tenants";

/**
 * ONB-05, end to end: the 10-day trial is anchored to the row Better Auth wrote.
 *
 * `tests/unit/entitlements.test.ts` already proves the arithmetic — day 1, day
 * 9, the boundary, the millisecond either side — against hand-built `OrgRow`
 * objects. What it cannot prove is that the number the resolver is handed in
 * production is the right one. That claim has three links, and only a real
 * signup exercises all three:
 *
 *   1. `createdAt` is stamped server-side by Better Auth's own endpoint, so it
 *      cannot be forged by the signup payload;
 *   2. `trialEndsAt` is left NULL by that path, so `createdAt + 10 days` is the
 *      live formula and not a dormant fallback;
 *   3. `requireMerchantContext()` passes the row through unchanged.
 *
 * A hand-built fixture would satisfy the resolver and prove none of them. This
 * is also the regression test for the failure the derived-not-stored design
 * exists to prevent: a back-fill that writes `trialEndsAt` at signup would leave
 * every assertion in the unit suite green while quietly making the trial
 * length a stored value that can drift.
 *
 * Harness: `tests/isolation/plan-selection.test.ts`'s, unchanged.
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

const { signUpMerchant } = await import("@/server/auth/signup");
const { selectPlan } = await import("@/server/merchant/actions");
const { requireMerchantContext } = await import("@/server/merchant/context");
const { platformDb } = await import("@/server/db/platform");
const { TRIAL_DAYS } = await import("@/server/entitlements/resolve");
const { auth } = await import("@/server/auth/auth");

// ---------------------------------------------------------------------------

const PASSWORD = "correct-horse-battery";
const DAY_MS = 86_400_000;

function resetRequestContext(): void {
  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.9" });
  requestContext.cookies.clear();
}

async function authenticateAs(email: string): Promise<void> {
  const signIn = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    headers: requestContext.headers,
    returnHeaders: true,
  });

  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.9" });
  const setCookie = signIn.headers.get("set-cookie");
  if (!setCookie) throw new Error("fixture sign-in issued no session cookie");
  applySetCookies(requestContext.headers, [setCookie]);
}

beforeEach(async () => {
  await seedTwoTenants();
  resetRequestContext();
  limitVerdict.slugCheck = true;
  limitVerdict.signup = true;
});

// ---------------------------------------------------------------------------

describe("trial anchored to createdAt", () => {
  it("derives endsAt as createdAt + 10 days with trialEndsAt left null", async () => {
    const signUp = await signUpMerchant({
      email: "trial@example.test",
      password: PASSWORD,
      storeName: "Trial Store",
      slug: "trial-store",
    });
    if (!signUp.ok) {
      throw new Error(`fixture signup failed: ${JSON.stringify(signUp.error)}`);
    }
    await authenticateAs("trial@example.test");

    const chosen = await selectPlan({ tier: "starter" });
    if (!chosen.ok) {
      throw new Error(`fixture plan pick failed: ${JSON.stringify(chosen.error)}`);
    }

    const row = await platformDb.organization.findUnique({
      where: { slug: signUp.slug },
      select: { createdAt: true, trialEndsAt: true, subscriptionStatus: true },
    });
    expect(row, "the signup produced no organization row").not.toBeNull();

    // Link 2: nothing back-filled an expiry column. If this ever starts
    // failing, the trial stopped being derived and became stored.
    expect(
      row?.trialEndsAt,
      "trialEndsAt must stay NULL at signup — it is a support override, not " +
        "the normal anchor. A value here means the 10-day window is now a " +
        "stored number that can drift from TRIAL_DAYS.",
    ).toBeNull();
    expect(row?.subscriptionStatus).toBe("none");

    const ctx = await requireMerchantContext();
    const createdAt = row?.createdAt as Date;

    // Exact, to the millisecond: `createdAt + TRIAL_DAYS` and nothing else.
    expect(ctx.trial.endsAt.getTime()).toBe(
      createdAt.getTime() + TRIAL_DAYS * DAY_MS,
    );
    expect(TRIAL_DAYS).toBe(10);

    expect(ctx.trial.state).toBe("active");
    // `Math.ceil` over a window that opened milliseconds ago: still a full 10.
    expect(ctx.trial.daysLeft).toBe(10);
    // D-08's boolean, on the happy path.
    expect(ctx.canWrite).toBe(true);
  });
});
