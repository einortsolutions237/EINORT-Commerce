import { applySetCookies } from "better-auth/cookies";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { platformDb } from "@/server/db/platform";

import { seedTwoTenants } from "../setup/seed-two-tenants";

/**
 * TEN-04 and the A7 throttle gap (02-VALIDATION.md lines 47-58).
 *
 * This file is `isolation`, not `unit`, for the same reason
 * `tests/isolation/signup.test.ts` is: every assertion here is about what a
 * real signed session and a real Postgres row say, and about what the actual
 * HTTP route does under a real Better Auth rate-limit middleware — not about
 * what a stub was told to return.
 *
 * Substitutions, and only these:
 *
 *   next/headers          — same behaviour-accurate stand-in as
 *                            `signup.test.ts`: a mutable jar whose `set` is
 *                            immediately visible to `getAll`.
 *   rate limiters          — `slugCheckLimiter`/`signupLimiter`/`loginLimiter`
 *                            get controllable verdicts so ordering is
 *                            assertable behaviourally, exactly as in
 *                            `signup.test.ts`.
 *   authRateLimitStorage    — the ACTION-level `loginLimiter` above is
 *                            unrelated to this: this is the storage Better
 *                            Auth's OWN built-in HTTP rate limiter calls via
 *                            `rateLimit.customStorage`. There is no live
 *                            Upstash reachable from Vitest (no credentials in
 *                            `.env.test`, matching the project's own rule that
 *                            isolation tests never depend on live Redis — see
 *                            `slugCheckLimiter`/`signupLimiter` above, which
 *                            are mocked for the same reason). This is a
 *                            behaviour-accurate in-memory stand-in for the
 *                            `{ get, set, consume }` contract: real atomic
 *                            increment-and-check semantics, just backed by a
 *                            `Map` instead of Redis. Better Auth's own
 *                            rate-limit middleware, its default `/sign-in*`
 *                            special rule (window 10s, max 3) and the route
 *                            handler are ALL real and unmocked; only the
 *                            key-value backing store is swapped, the same way
 *                            `next/headers` swaps a jar implementation but not
 *                            the code that reads it.
 *
 * Better Auth itself, Prisma, `signUpMerchant` and the auth config are all the
 * real thing. The `better-auth` package is never mocked in this file.
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
// Rate limiters with controllable verdicts, plus a real-behaviour in-memory
// stand-in for the Better Auth HTTP-level storage adapter.
// ---------------------------------------------------------------------------

const { limitVerdict } = vi.hoisted(() => ({
  limitVerdict: { slugCheck: true, signup: true, login: true },
}));

const { authThrottleStore } = vi.hoisted(() => ({
  authThrottleStore: new Map<
    string,
    { key: string; count: number; lastRequest: number }
  >(),
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
    loginLimiter: {
      prefix: "rl:login",
      limit: async () => ({ success: limitVerdict.login }),
    },
    authRateLimitStorage: {
      async get(key: string) {
        return authThrottleStore.get(key) ?? null;
      },
      async set(
        key: string,
        value: { key: string; count: number; lastRequest: number },
      ) {
        authThrottleStore.set(key, value);
      },
      async consume(key: string, rule: { window: number; max: number }) {
        const now = Date.now();
        const windowMs = rule.window * 1000;
        const entry = authThrottleStore.get(key);

        if (!entry || now - entry.lastRequest > windowMs) {
          authThrottleStore.set(key, { key, count: 1, lastRequest: now });
          return { allowed: true, retryAfter: null };
        }

        if (entry.count >= rule.max) {
          const retryAfter = Math.max(
            0,
            Math.ceil((entry.lastRequest + windowMs - now) / 1000),
          );
          return { allowed: false, retryAfter };
        }

        authThrottleStore.set(key, {
          key,
          count: entry.count + 1,
          lastRequest: entry.lastRequest,
        });
        return { allowed: true, retryAfter: null };
      },
    },
  };
});

// Imported after the mocks so the modules under test pick them up.
const { signUpMerchant } = await import("@/server/auth/signup");
const { signInMerchant, signOutMerchant } = await import(
  "@/server/auth/login"
);
const { auth } = await import("@/server/auth/auth");
const { strings } = await import("@/lib/strings");

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
 * `nextCookies()`'s jar is always empty under Vitest — it reaches its store
 * through a dynamic `import("next/headers.js")` the `vi.mock` above does not
 * intercept (see `tests/isolation/merchant-context.test.ts`). Signing in
 * directly and applying the `Set-Cookie` with Better Auth's own
 * `applySetCookies` is the honest round trip for tests that need an
 * AUTHENTICATED starting point, as opposed to tests that exercise
 * `signInMerchant`/`signOutMerchant` themselves.
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

beforeEach(async () => {
  await seedTwoTenants();
  resetRequestContext();
  limitVerdict.slugCheck = true;
  limitVerdict.signup = true;
  limitVerdict.login = true;
  authThrottleStore.clear();
});

// ---------------------------------------------------------------------------
// signInMerchant / signOutMerchant — the login round trip
// ---------------------------------------------------------------------------

describe("signs in", () => {
  it("returns ok for a returning merchant and creates a new session", async () => {
    const email = "returning-signin@example.test";

    const signUp = await signUpMerchant({
      email,
      password: PASSWORD,
      storeName: "Returning Signin",
      slug: "returning-signin-store",
    });
    expect(signUp.ok).toBe(true);

    const user = await platformDb.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();

    // A fresh visit: no cookie carried over from the signup request above.
    resetRequestContext();

    const sessionsBefore = await platformDb.session.count({
      where: { userId: user!.id },
    });

    const result = await signInMerchant({ email, password: PASSWORD });
    expect(result).toEqual({ ok: true });

    const sessionsAfter = await platformDb.session.count({
      where: { userId: user!.id },
    });
    expect(sessionsAfter).toBe(sessionsBefore + 1);
  });
});

describe("tenant from session", () => {
  it("back-fills activeOrganizationId equal to the merchant's organization", async () => {
    const email = "returning-tenant@example.test";
    const slug = "returning-tenant-store";

    const signUp = await signUpMerchant({
      email,
      password: PASSWORD,
      storeName: "Returning Tenant",
      slug,
    });
    expect(signUp.ok).toBe(true);

    const organization = await platformDb.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    const user = await platformDb.user.findUnique({ where: { email } });

    resetRequestContext();

    const result = await signInMerchant({ email, password: PASSWORD });
    expect(result).toEqual({ ok: true });

    const session = await platformDb.session.findFirst({
      where: { userId: user!.id },
      orderBy: { createdAt: "desc" },
    });
    expect(session).not.toBeNull();
    expect(session?.activeOrganizationId).toBe(organization!.id);
  });
});

describe("invalid credentials", () => {
  it("returns the identical message for a wrong password and an unknown email", async () => {
    const email = "known-merchant@example.test";

    const signUp = await signUpMerchant({
      email,
      password: PASSWORD,
      storeName: "Known Merchant",
      slug: "known-merchant-store",
    });
    expect(signUp.ok).toBe(true);

    resetRequestContext();
    const wrongPassword = await signInMerchant({
      email,
      password: "totally-the-wrong-password",
    });

    resetRequestContext();
    const unknownEmail = await signInMerchant({
      email: "nobody-signed-up@example.test",
      password: PASSWORD,
    });

    const expected = {
      ok: false,
      error: { form: [strings.login.invalidCredentials] },
    };
    expect(wrongPassword).toEqual(expected);
    expect(unknownEmail).toEqual(expected);
  });
});

describe("signs out", () => {
  it("really revokes the session, not just the client cookie", async () => {
    const email = "signs-out@example.test";

    const signUp = await signUpMerchant({
      email,
      password: PASSWORD,
      storeName: "Signs Out Store",
      slug: "signs-out-store",
    });
    expect(signUp.ok).toBe(true);

    resetRequestContext();
    await authenticateAs(email);

    const before = await auth.api.getSession({
      headers: requestContext.headers,
    });
    expect(before, "fixture produced no session").not.toBeNull();

    let redirectDigest: string | undefined;
    try {
      await signOutMerchant();
      throw new Error(
        "expected signOutMerchant to redirect, but it returned normally",
      );
    } catch (error) {
      redirectDigest = (error as { digest?: unknown }).digest as
        | string
        | undefined;
    }
    expect(typeof redirectDigest).toBe("string");
    expect(redirectDigest).toContain("/login");

    const after = await auth.api.getSession({
      headers: requestContext.headers,
    });
    expect(after).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// HTTP-level throttle — the A7 gap (02-VALIDATION.md line 58)
// ---------------------------------------------------------------------------

describe("login throttled", () => {
  it("refuses the fourth rapid sign-in in a 10-second window with HTTP 429", async () => {
    const { POST } = await import("@/app/api/auth/[...all]/route");

    const url = "http://localhost:3000/api/auth/sign-in/email";
    const email = `login-throttle-${Date.now()}@example.test`;
    const ip = "198.51.100.77";
    const requestHeaders = () =>
      new Headers({
        "content-type": "application/json",
        "x-forwarded-for": ip,
      });

    const request1 = new Request(url, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({ email, password: "wrong-password-1" }),
    });
    const response1 = await POST(request1);

    const request2 = new Request(url, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({ email, password: "wrong-password-2" }),
    });
    const response2 = await POST(request2);

    const request3 = new Request(url, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({ email, password: "wrong-password-3" }),
    });
    const response3 = await POST(request3);

    const request4 = new Request(url, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({ email, password: "wrong-password-4" }),
    });
    const response4 = await POST(request4);

    expect(response1.status, "1st request must not be rate-limited").not.toBe(
      429,
    );
    expect(response2.status, "2nd request must not be rate-limited").not.toBe(
      429,
    );
    expect(response3.status, "3rd request must not be rate-limited").not.toBe(
      429,
    );
    expect(response4.status, "4th request must be rate-limited").toBe(429);
  });
});
