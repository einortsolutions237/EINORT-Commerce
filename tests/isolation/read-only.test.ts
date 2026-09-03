import { applySetCookies } from "better-auth/cookies";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { strings } from "@/lib/strings";

import { seedTwoTenants, TENANT_B } from "../setup/seed-two-tenants";

/**
 * SUB-02 and D-08: the write gate refuses a mutation after the trial has
 * expired, reads keep working in the same state, and the plan switch this
 * write gate protects cannot be retargeted onto another tenant.
 *
 * THE TENANT TARGET IS NEVER IN THE PAYLOAD. `switchPlan` accepts `{ tier }`
 * and nothing else — no organization id, no tenant id — so the write always
 * lands on `session.session.activeOrganizationId`. "forged organizationId
 * ignored" below passes a REAL id belonging to the second seeded tenant
 * rather than an invented one, so a naive implementation that trusted the
 * payload would genuinely write to it and the test would catch a real
 * cross-tenant write rather than a foreign-key error.
 *
 * The expired state is produced by writing a past `trialEndsAt` directly
 * through `platformDb.organization.update` — the resolver's override field
 * exists for exactly this — rather than by mocking the clock. `resolve.ts`
 * derives `trialEndsAt` from `createdAt` only when the column is null, so
 * setting it directly is the same override a real support gesture would use.
 *
 * This file is in the `isolation` project rather than `unit` for the same
 * reason `signup.test.ts` and `plan-selection.test.ts` are: every assertion
 * here is about what reached Postgres. Against a stubbed database "the write
 * refused" and "the other tenant's row is untouched" are both vacuously true,
 * which is precisely the failure mode a tenant/entitlement control's
 * regression test must not have.
 *
 * The harness is `tests/isolation/plan-selection.test.ts`'s, reused rather
 * than re-invented: Better Auth and Prisma stay the real thing, and only
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

/**
 * `@/server/theming/actions` imports `revalidatePath` at module scope for the
 * onboarding branding action this fixture now calls (ONB-02's mandatory
 * industry gate — see `signUpChooseAndCarrySession` below). Outside a Next
 * request scope the real module throws, which would fail this file during
 * import for a reason that has nothing to do with the database. Same idiom as
 * `tests/isolation/branding.test.ts`.
 */
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));

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
const { selectPlan, switchPlan } = await import("@/server/merchant/actions");
const { merchantAction } = await import("@/server/merchant/action");
const { saveBranding } = await import("@/server/theming/actions");
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
async function signUpChooseAndCarrySession(
  email: string,
  slug: string,
  tier: "starter" | "business" | "professional" = "business",
): Promise<string> {
  const result = await signUpMerchant({
    email,
    password: PASSWORD,
    storeName: "Read Only Store",
    slug,
  });
  if (!result.ok) {
    throw new Error(`fixture signup failed: ${JSON.stringify(result.error)}`);
  }
  await authenticateAs(email);

  const chosen = await selectPlan({ tier });
  if (!chosen.ok) {
    throw new Error(`fixture plan pick failed: ${JSON.stringify(chosen.error)}`);
  }

  /*
   * ONB-02's mandatory branding step. `requireMerchantContext()` — which every
   * `merchantAction()` built here reaches, including `switchPlan` — redirects a
   * merchant whose `industry` is still null to `/onboarding/branding`
   * (plan 04-11). This fixture predates that gate; without this call every
   * read/switch case below would throw an uncaught `NEXT_REDIRECT` instead of
   * exercising the behaviour under test.
   */
  const branded = await saveBranding({
    businessName: "Read Only Store",
    industry: "general-retail",
    logoKey: null,
    primaryAccent: "#18181B",
    secondaryAccent: "#71717A",
  });
  if (!branded.ok) {
    throw new Error(`fixture branding failed: ${JSON.stringify(branded.error)}`);
  }

  return result.slug;
}

function organizationBySlug(slug: string) {
  return platformDb.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      planTier: true,
      planSelectedAt: true,
      subscriptionStatus: true,
    },
  });
}

/** Force the expired-trial, unsubscribed state the resolver reads (D-08). */
async function expireTrial(organizationId: string): Promise<void> {
  await platformDb.organization.update({
    where: { id: organizationId },
    data: { trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });
}

/**
 * Add `count` extra seats (beyond the owner already seeded by signup) to an
 * organization, so a downgrade to a tighter tier has real members to refuse
 * against. Rows are minimal — this fixture only needs `Member.count` to see
 * them, not a working login for the seat.
 */
async function addExtraMembers(
  organizationId: string,
  count: number,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    const suffix = `${organizationId}-extra-${i}`;
    const user = await platformDb.user.create({
      data: {
        id: `user-${suffix}`,
        name: "Extra Seat",
        email: `${suffix}@example.test`,
        emailVerified: true,
      },
    });
    await platformDb.member.create({
      data: {
        id: `member-${suffix}`,
        organizationId,
        userId: user.id,
        role: "member",
        createdAt: new Date(),
      },
    });
  }
}

/** A `mode: "read"` probe built with the real wrapper (T-02-25 evidence). */
const probeRead = merchantAction({
  mode: "read",
  schema: z.object({}),
  handler: async () => ({ ok: true as const }),
});

/**
 * SEEDED ONCE PER FILE, NOT ONCE PER TEST (02-03-SUMMARY.md precedent).
 *
 * Every test below signs up its own merchant under its own email and slug
 * and mutates only its own organization, so per-test isolation is a property
 * of the fixtures rather than of the truncate. `seedTwoTenants` opens with a
 * `TRUNCATE … CASCADE` inside a `$transaction` whose default `maxWait` is
 * 2 000 ms; six of those per file against the remote Neon branch
 * intermittently exceeded it. The per-test `beforeEach` still resets the
 * request context — without it the previous test's session cookie would
 * authenticate the next one.
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

describe("switch during trial", () => {
  it("writes the new tier and refreshes planSelectedAt while the trial is active", async () => {
    const slug = await signUpChooseAndCarrySession(
      "trial@example.test",
      "trial-store",
      "business",
    );

    const before = await organizationBySlug(slug);
    expect(before?.planTier).toBe("business");

    await expect(switchPlan({ tier: "professional" })).resolves.toEqual({
      ok: true,
    });

    const after = await organizationBySlug(slug);
    expect(after?.planTier).toBe("professional");
    expect(after?.planSelectedAt).not.toBeNull();
    expect(after?.planSelectedAt?.getTime()).not.toBe(
      before?.planSelectedAt?.getTime(),
    );
  });
});

describe("write refused", () => {
  it("returns the read-only message and leaves the row untouched once the trial has expired", async () => {
    const slug = await signUpChooseAndCarrySession(
      "expired@example.test",
      "expired-store",
      "business",
    );
    const org = await organizationBySlug(slug);
    await expireTrial(org!.id);

    const result = await switchPlan({ tier: "starter" });

    expect(result.ok).toBe(false);
    const error = (result as { ok: false; error: Record<string, string[]> })
      .error;
    expect(error.form).toEqual([strings.trial.readOnlyBlocked]);

    const after = await organizationBySlug(slug);
    expect(after?.planTier).toBe("business");
  });
});

describe("read still allowed", () => {
  it("still reaches the handler of a mode: read action once the trial has expired", async () => {
    const slug = await signUpChooseAndCarrySession(
      "readonly@example.test",
      "readonly-store",
      "business",
    );
    const org = await organizationBySlug(slug);
    await expireTrial(org!.id);

    // D-08: read-only, not lockout — a read action must not be caught by the
    // same refusal that blocks switchPlan above.
    await expect(probeRead({})).resolves.toEqual({ ok: true });
  });
});

describe("forged organizationId ignored", () => {
  it("writes to the session's own organization and never the forged one", async () => {
    const slug = await signUpChooseAndCarrySession(
      "forger@example.test",
      "forger-store",
      "starter",
    );

    // TENANT_B is a real, seeded organization — the id is not invented, so an
    // implementation that trusted the payload would genuinely write to it.
    await expect(
      switchPlan({ tier: "professional", organizationId: TENANT_B.id }),
    ).resolves.toEqual({ ok: true });

    const own = await organizationBySlug(slug);
    expect(own?.planTier).toBe("professional");

    const forged = await platformDb.organization.findUnique({
      where: { id: TENANT_B.id },
      select: { planTier: true, planSelectedAt: true },
    });
    expect(forged?.planTier).toBeNull();
    expect(forged?.planSelectedAt).toBeNull();
  });
});

describe("blocked by member count", () => {
  it("refuses a downgrade below the current member count and writes nothing", async () => {
    const slug = await signUpChooseAndCarrySession(
      "crowded@example.test",
      "crowded-store",
      "business",
    );
    const org = await organizationBySlug(slug);

    // Owner + 1 extra seat = 2 members. Starter's limit is 1, so this must
    // refuse the downgrade regardless of the client's confirm step.
    await addExtraMembers(org!.id, 1);

    const result = await switchPlan({ tier: "starter" });

    expect(result.ok).toBe(false);
    const error = (result as { ok: false; error: Record<string, string[]> })
      .error;
    const expected = strings.plan.dashboard.memberLimitBlocked
      .replace("{m}", "2")
      .replace("{n}", "1")
      .replace("{plan}", strings.plan.starter.name);
    expect(error.form).toEqual([expected]);

    const after = await organizationBySlug(slug);
    expect(after?.planTier).toBe("business");
  });
});

describe("subscribed writes allowed", () => {
  it("allows the write when subscribed even though trialEndsAt is in the past", async () => {
    const slug = await signUpChooseAndCarrySession(
      "subscribed@example.test",
      "subscribed-store",
      "business",
    );
    const org = await organizationBySlug(slug);
    await expireTrial(org!.id);
    await platformDb.organization.update({
      where: { id: org!.id },
      data: { subscriptionStatus: "active" },
    });

    await expect(switchPlan({ tier: "professional" })).resolves.toEqual({
      ok: true,
    });

    const after = await organizationBySlug(slug);
    expect(after?.planTier).toBe("professional");
  });
});
