import { applySetCookies } from "better-auth/cookies";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { seedTwoTenants } from "../setup/seed-two-tenants";

/**
 * ADM-01 / D-06: the admin surface is not enumerable.
 *
 * ---------------------------------------------------------------------------
 * A REDIRECT OR A 403 WOULD EACH CONFIRM THE ROUTE EXISTS. THAT IS THE BUG.
 * ---------------------------------------------------------------------------
 * `requireAdminContext()` is the single decision point in front of every
 * `/admin/**` page and every admin Server Action, and its failure mode is the
 * whole control. A `redirect("/login")` tells an anonymous prober that `/admin`
 * is a real route and that authentication is the missing piece. A 403 tells
 * them the same thing AND that they are one credential away. Only `notFound()`
 * leaves the surface indistinguishable from the thousands of paths this
 * application has never heard of — which is what D-06 asks for.
 *
 * That property is not visible in a type, it is not visible in a code review of
 * the happy path, and it is exactly the kind of thing a well-meaning refactor
 * "improves" into a friendly redirect. So it is asserted here, against a real
 * signed cookie decoded by real Better Auth against real Postgres, for all
 * three session classes that can reach the function.
 *
 * The machine-checkable half of D-06 is the fourth test: the anonymous refusal
 * and the merchant refusal must be BYTE-IDENTICAL. Two different 404s that
 * differ in any observable way are an oracle, just a quieter one.
 *
 * WHY AN ISOLATION TEST AND NOT A UNIT TEST. The claim under test is "what a
 * real session resolves to", and `platformRole` arrives on `session.user` only
 * because Better Auth merges `options.user.additionalFields` into its output
 * schema and reads the column from the database on every `getSession` (no
 * `session.cookieCache` is configured). Against a stubbed session that whole
 * chain is assumed rather than proven, and a regression in it would hand every
 * merchant an admin context. The harness is
 * `tests/isolation/merchant-context.test.ts`'s, reused rather than re-invented.
 *
 * `tests/unit/no-tenant-id-param.test.ts` is the complementary source-level
 * guard: this file proves the gate refuses the wrong caller, that one proves
 * nobody can later hand the gate a caller of their choosing.
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
const { requireAdminContext } = await import("@/server/admin/context");
const { signUpMerchant } = await import("@/server/auth/signup");
const { platformDb } = await import("@/server/db/platform");
const { auth } = await import("@/server/auth/auth");

// ---------------------------------------------------------------------------
// The two Next control-flow digests, read from the installed Next 16.3.1
// ---------------------------------------------------------------------------

/**
 * `notFound()` throws an `Error` whose `digest` is exactly this string.
 *
 * Read from the installed package rather than guessed:
 * `node_modules/next/dist/client/components/not-found.js` builds
 * ``const DIGEST = `${HTTP_ERROR_FALLBACK_ERROR_CODE};404`;`` and
 * `node_modules/next/dist/client/components/http-access-fallback/http-access-fallback.js`
 * defines `HTTP_ERROR_FALLBACK_ERROR_CODE = 'NEXT_HTTP_ERROR_FALLBACK'`.
 *
 * Pinned as a literal on purpose: importing Next's internal module would make
 * this assertion agree with the implementation by construction, and a change to
 * the digest format IS a change this test should notice.
 */
const NOT_FOUND_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;404";

/**
 * The prefix of the digest `redirect()` throws (`NEXT_REDIRECT;<type>;<url>;…`).
 *
 * Asserted against explicitly rather than left implied by the equality check
 * above, because "it redirected instead" is the specific regression D-06 is
 * about and the failure message should say so in those words.
 */
const REDIRECT_DIGEST_PREFIX = "NEXT_REDIRECT";

const PASSWORD = "correct-horse-battery";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetRequestContext(): void {
  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.9" });
  requestContext.cookies.clear();
}

/**
 * Put a real, signed session cookie on the NEXT request.
 *
 * Same round trip as `tests/isolation/login.test.ts`: `nextCookies()`'s jar is
 * always empty under Vitest because that plugin reaches its store through a
 * dynamic `import("next/headers.js")` the `vi.mock` above does not intercept,
 * and a hand-rolled `name=value` join gets the signing and percent-encoding
 * subtly wrong.
 */
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

/**
 * A merchant with a store and a live session. `platformRole` is left at its
 * `defaultValue` of `"merchant"` — this is the ordinary, legitimate,
 * lower-privilege caller reaching for a higher-privilege DAL.
 */
async function signUpMerchantAndCarrySession(
  email: string,
  slug: string,
): Promise<void> {
  const result = await signUpMerchant({
    email,
    password: PASSWORD,
    storeName: "Admin Access Store",
    slug,
  });
  if (!result.ok) {
    throw new Error(`fixture signup failed: ${JSON.stringify(result.error)}`);
  }
  await authenticateAs(email);
}

/**
 * The platform owner: an account with a credential, NO organization (D-04), and
 * `platformRole` written straight to the row.
 *
 * The column is set here through `platformDb` and NOT through
 * `scripts/promote-admin.ts`. That is deliberate — a test that minted its admin
 * with the bootstrap script would be a test of the script, and a bug in the
 * script would then present as a bug in the gate. The gate's contract is "a row
 * saying admin resolves"; how the row got that way is the script's own problem.
 */
async function signUpAdminAndCarrySession(email: string): Promise<string> {
  await auth.api.signUpEmail({
    body: { email, password: PASSWORD, name: "Platform Owner" },
    headers: requestContext.headers,
  });

  const promoted = await platformDb.user.update({
    where: { email },
    data: { platformRole: "admin" },
    select: { id: true, platformRole: true },
  });
  expect(
    promoted.platformRole,
    "the fixture failed to write platformRole, so the admin case below would " +
      "be asserting against a merchant row",
  ).toBe("admin");

  resetRequestContext();
  await authenticateAs(email);
  return promoted.id;
}

/**
 * Assert that a call refused with `notFound()`, and return the digest it threw.
 *
 * Three things are checked, and the second is the one that matters:
 *   1. the call did NOT return — a resolver that fell through its ladder and
 *      returned `undefined` would satisfy a bare `rejects.toThrow()` never
 *      running, so it is stated rather than inferred;
 *   2. the thrown value carries a STRING `digest`, so a future refactor that
 *      throws a plain `Error` (or a domain error) cannot pass this vacuously;
 *   3. the digest is the 404 one and is not a redirect.
 */
async function expectNotFound(call: () => Promise<unknown>): Promise<string> {
  let returned: unknown;
  try {
    returned = await call();
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;

    expect(
      typeof digest,
      `expected a Next control-flow error carrying a digest, got ${String(
        error,
      )}. A plain Error here means the refusal is no longer notFound() and the ` +
        "assertions below would be checking nothing.",
    ).toBe("string");

    expect(
      (digest as string).startsWith(REDIRECT_DIGEST_PREFIX),
      "requireAdminContext() REDIRECTED instead of 404-ing. D-06: a redirect " +
        "confirms /admin is a real route to anyone who probes it, which is the " +
        "single thing this gate exists to withhold.",
    ).toBe(false);

    expect(
      digest as string,
      "requireAdminContext() must fail with notFound() on every rung.",
    ).toBe(NOT_FOUND_DIGEST);

    return digest as string;
  }

  throw new Error(
    `expected requireAdminContext() to call notFound(), but it returned ` +
      `${JSON.stringify(returned)}. Returning instead of refusing means the ` +
      "platform admin surface renders for a caller the gate was supposed to " +
      "turn away.",
  );
}

/**
 * SEEDED ONCE PER FILE. Every test below mints its own account under its own
 * email, and none reads a row another created, so per-test isolation is a
 * property of the fixtures rather than of the truncate. The per-test
 * `beforeEach` still runs: the request context MUST be reset between tests or
 * the previous test's session cookie would authenticate the next one, and
 * "no session" would silently stop testing anything.
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

describe("anonymous session", () => {
  it("404s an empty cookie jar rather than redirecting to /login", async () => {
    // The direct-request case: reachable without ever loading a page.
    resetRequestContext();

    await expectNotFound(() => requireAdminContext());
  });
});

describe("merchant session", () => {
  it("404s a legitimate merchant reaching for admin identity", async () => {
    await signUpMerchantAndCarrySession(
      "merchant-probe@example.test",
      "merchant-probe-store",
    );

    // Non-vacuous: the session really is authenticated and really does carry
    // the default role, so the refusal below is the platformRole rung doing
    // work rather than the no-session rung above it firing again.
    const session = await auth.api.getSession({
      headers: requestContext.headers,
    });
    expect(session, "fixture produced no merchant session").not.toBeNull();
    expect(session?.user.platformRole).toBe("merchant");

    await expectNotFound(() => requireAdminContext());
  });
});

describe("admin session", () => {
  it("resolves the platform owner and returns their userId", async () => {
    const userId = await signUpAdminAndCarrySession("owner@example.test");

    const ctx = await requireAdminContext();

    expect(ctx.userId).toBe(userId);

    // Cross-check against Postgres so a gate that echoed the session id back
    // without the role ever being consulted could not pass.
    const row = await platformDb.user.findUnique({
      where: { id: ctx.userId },
      select: { email: true, platformRole: true },
    });
    expect(row?.email).toBe("owner@example.test");
    expect(row?.platformRole).toBe("admin");
  });
});

describe("indistinguishable refusals", () => {
  it("throws a byte-identical digest for an anonymous and a merchant caller", async () => {
    resetRequestContext();
    const anonymousDigest = await expectNotFound(() => requireAdminContext());

    await signUpMerchantAndCarrySession(
      "merchant-compare@example.test",
      "merchant-compare-store",
    );
    const merchantDigest = await expectNotFound(() => requireAdminContext());

    /*
     * D-06's machine-checkable half. Two 404s that differ in ANY observable
     * way — a distinct digest, a distinct message, a distinct error class —
     * are still an oracle: "this refusal looks different when I am logged in"
     * is enough to confirm the surface exists. Equality here is the assertion
     * that no such difference has crept in.
     */
    expect(
      merchantDigest,
      "the anonymous and merchant refusals differ, which reintroduces the " +
        "enumeration oracle D-06 closes.",
    ).toBe(anonymousDigest);
  });
});
