import { applySetCookies } from "better-auth/cookies";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { seedTwoTenants, TENANT_B } from "../setup/seed-two-tenants";

/**
 * TEN-04: the dashboard's tenant comes from the session and from nothing else.
 *
 * `requireMerchantContext()` is the whole of that guarantee. It takes no
 * parameters, so there is no field to substitute; this file proves the other
 * half — that the value it *does* read is the signed session's
 * `activeOrganizationId`, and that a merchant holding one session can never
 * resolve, or read through, another tenant's rows.
 *
 * WHY THIS IS AN INTEGRATION TEST AND NOT A UNIT TEST. Every assertion here is
 * about what a real signed cookie, decoded by real Better Auth, resolves to
 * against real Postgres. Against a stubbed session "the other tenant's rows are
 * absent" is vacuously true, which is precisely the failure mode a tenant
 * control's regression test must not have. `tests/unit/no-tenant-id-param.test.ts`
 * is the complementary source-level guard, and it is a unit test for the equally
 * deliberate reason that it asserts on text.
 *
 * The redirect ladder is tested by its *thrown* error. `redirect()` from
 * `next/navigation` does not return — it throws an error carrying a
 * `NEXT_REDIRECT;<type>;<url>;<status>;` digest — so a test that checked a
 * return value would pass on a resolver that silently returned `undefined` and
 * let the dashboard render for an unauthenticated visitor. `expectRedirect`
 * below asserts on the digest AND fails loudly if the call returned at all.
 *
 * The harness is `tests/isolation/plan-selection.test.ts`'s, reused rather than
 * re-invented: Better Auth and Prisma stay the real thing, and only
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
const { selectPlan } = await import("@/server/merchant/actions");
const { saveBranding } = await import("@/server/theming/actions");
const { requireMerchantContext } = await import("@/server/merchant/context");
const { platformDb } = await import("@/server/db/platform");
const { scopedDb } = await import("@/server/db/tenant-scoped");
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
 * See `plan-selection.test.ts` for the full reasoning: the `nextCookies()` jar
 * is always empty under Vitest because that plugin reaches its store through a
 * dynamic `import("next/headers.js")` the `vi.mock` above does not intercept, so
 * a jar-based helper would silently authenticate nothing. Signing in for the
 * cookie and applying it with Better Auth's own `applySetCookies` is the honest
 * round trip — the cookie is signed and percent-encoded, and a hand-rolled
 * `name=value` join gets the encoding subtly wrong.
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

/** A merchant with a store and a live session. `planTier` is still null. */
async function signUpAndCarrySession(
  email: string,
  slug: string,
  storeName = "Context Store",
): Promise<string> {
  const result = await signUpMerchant({
    email,
    password: PASSWORD,
    storeName,
    slug,
  });
  if (!result.ok) {
    throw new Error(`fixture signup failed: ${JSON.stringify(result.error)}`);
  }
  await authenticateAs(email);
  return result.slug;
}

/** The same merchant, past the mandatory plan gate. */
async function signUpChooseAndCarrySession(
  email: string,
  slug: string,
  storeName = "Context Store",
): Promise<string> {
  const created = await signUpAndCarrySession(email, slug, storeName);
  const chosen = await selectPlan({ tier: "business" });
  if (!chosen.ok) {
    throw new Error(`fixture plan pick failed: ${JSON.stringify(chosen.error)}`);
  }

  /*
   * ONB-02's mandatory branding step. `requireMerchantContext()` — the very
   * function every test in this file calls — redirects a merchant whose
   * `industry` is still null to `/onboarding/branding` (plan 04-11). This
   * fixture predates that gate; without this call every test using it would
   * throw an uncaught `NEXT_REDIRECT` instead of exercising the resolution or
   * redirect behaviour actually under test (including the "suspended" case,
   * whose own `requireMerchantContext()` call — made BEFORE the org is marked
   * suspended — must resolve normally so that the suspended-status redirect
   * checked afterward is the only one that fires).
   *
   * `businessName` is deliberately `storeName`, not a fixed literal: the
   * "tenant from session" test below asserts `ctx.storeName` and
   * `organization.name` equal the name passed to signup, and `saveBranding`
   * overwrites `Organization.name` with `businessName` (ONB-02's "confirm your
   * name" step) — passing anything else here would silently change what that
   * assertion is checking.
   */
  const branded = await saveBranding({
    businessName: storeName,
    industry: "general-retail",
    logoKey: null,
    primaryAccent: "#18181B",
    secondaryAccent: "#71717A",
  });
  if (!branded.ok) {
    throw new Error(`fixture branding failed: ${JSON.stringify(branded.error)}`);
  }

  return created;
}

/**
 * Assert that a call redirected, and that it did NOT return a value.
 *
 * The returned-a-value branch is the important one: a resolver that fell
 * through its ladder and returned `undefined` would satisfy a bare
 * `rejects.toThrow()` never running, so the failure has to be stated
 * explicitly rather than inferred from a missing assertion.
 */
async function expectRedirect(
  call: () => Promise<unknown>,
  path: string,
): Promise<void> {
  let returned: unknown;
  try {
    returned = await call();
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    expect(
      typeof digest,
      `expected a Next redirect error, got ${String(error)}`,
    ).toBe("string");
    expect(
      digest as string,
      `expected the redirect to target ${path}`,
    ).toContain(path);
    return;
  }

  throw new Error(
    `expected requireMerchantContext() to redirect to ${path}, but it ` +
      `returned ${JSON.stringify(returned)}. Returning instead of redirecting ` +
      "means the dashboard renders for a caller the ladder was supposed to " +
      "turn away.",
  );
}

/**
 * SEEDED ONCE PER FILE, NOT ONCE PER TEST — deliberately, and safely.
 *
 * Every test below signs up its own merchant under its own email and slug, and
 * the only row any of them mutates is that merchant's own organization. None
 * reads a row another created, so per-test isolation is a property of the
 * fixtures rather than of the truncate, and re-truncating between them buys
 * nothing.
 *
 * What it costs is real: `seedTwoTenants` opens with a
 * `TRUNCATE … CASCADE` inside a `$transaction`, whose default `maxWait` is
 * 2 000 ms. Against a remote Neon branch, with a second connection pool already
 * live for `prismaBase`, five of those in one file intermittently failed to
 * acquire a connection in time ("Transaction API error: Unable to start a
 * transaction in the given time") — a flake in the fixture, never in the code
 * under test, but one that turns a tenant-isolation suite into a suite people
 * learn to re-run. One reseed per file removes four fifths of that exposure.
 *
 * The per-test `beforeEach` below still runs: the request context MUST be reset
 * between tests, or the previous test's session cookie would authenticate the
 * next one and "no session" would silently stop testing anything.
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

describe("tenant from session", () => {
  it("resolves tenantId from activeOrganizationId, with the store's name and slug", async () => {
    const slug = await signUpChooseAndCarrySession(
      "context@example.test",
      "context-store",
      "Context Store",
    );

    const session = await auth.api.getSession({
      headers: requestContext.headers,
    });
    expect(session, "fixture produced no session").not.toBeNull();
    const activeOrganizationId = session?.session.activeOrganizationId;
    expect(
      activeOrganizationId,
      "the session carries no active organization, so this test would compare " +
        "the resolved tenant against nothing",
    ).toBeTruthy();

    const ctx = await requireMerchantContext();

    // The identity assertion. Not "some organization the user belongs to" —
    // the one the SESSION asserts.
    expect(ctx.tenantId).toBe(activeOrganizationId);
    expect(ctx.storeSlug).toBe(slug);
    expect(ctx.storeName).toBe("Context Store");

    // Cross-check against Postgres so a resolver that echoed the session id
    // back without ever reading the row could not pass.
    const organization = await platformDb.organization.findUnique({
      where: { id: ctx.tenantId },
      select: { name: true, slug: true },
    });
    expect(organization?.slug).toBe(slug);
    expect(organization?.name).toBe("Context Store");
  });
});

describe("cross-tenant", () => {
  it("never resolves the other tenant, and reads none of its rows", async () => {
    await signUpChooseAndCarrySession(
      "own@example.test",
      "own-store",
      "Own Store",
    );

    const ctx = await requireMerchantContext();

    // TENANT_B is a real, seeded organization with real seeded rows — not an
    // invented id — so a resolver that leaked it would genuinely return data.
    expect(ctx.tenantId).not.toBe(TENANT_B.id);

    const visible = await scopedDb(ctx.tenantId).storeSlugHistory.findMany({
      select: { tenantId: true, slug: true },
    });

    // Non-vacuous: the signup claimed this merchant's own slug, so the scoped
    // read returns something. An empty result would make the next assertion
    // meaningless.
    expect(
      visible.length,
      "the scoped read returned nothing, so 'tenant B is absent' proves nothing",
    ).toBeGreaterThan(0);
    expect(visible.map((row) => row.tenantId)).not.toContain(TENANT_B.id);
    expect(visible.map((row) => row.slug)).not.toContain(TENANT_B.slug);

    // And tenant B's row does exist — read unscoped — so the exclusion above is
    // the tenant boundary doing work, not an empty database.
    const betaRow = await platformDb.organization.findUnique({
      where: { id: TENANT_B.id },
      select: { slug: true },
    });
    expect(betaRow?.slug).toBe(TENANT_B.slug);
  });
});

describe("plan gate", () => {
  it("redirects a merchant with no plan to /onboarding/plan", async () => {
    // Deliberately NOT calling selectPlan: this is the D-05 state.
    await signUpAndCarrySession("noplan@example.test", "noplan-store");

    await expectRedirect(() => requireMerchantContext(), "/onboarding/plan");
  });
});

describe("suspended", () => {
  it("redirects a suspended organization to /suspended", async () => {
    await signUpChooseAndCarrySession("susp@example.test", "susp-store");

    const before = await requireMerchantContext();
    await platformDb.organization.update({
      where: { id: before.tenantId },
      data: { status: "suspended" },
    });

    await expectRedirect(() => requireMerchantContext(), "/suspended");
  });
});

describe("no session", () => {
  it("redirects an empty cookie jar to /login", async () => {
    // The direct-request case: reachable without ever loading the dashboard.
    resetRequestContext();

    await expectRedirect(() => requireMerchantContext(), "/login");
  });
});
