import { applySetCookies } from "better-auth/cookies";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { platformDb } from "@/server/db/platform";

import { seedTwoTenants } from "../setup/seed-two-tenants";

/**
 * SUB-01 / SUB-02 — the seat cap that `membershipLimit`'s function form
 * enforces, exercised through the real, unmocked Better Auth call path.
 *
 * `/organization/add-member` is registered with `createAuthEndpoint.serverOnly`
 * (`node_modules/better-auth/dist/plugins/organization/routes/crud-members.mjs`),
 * and `better-call`'s router explicitly skips any endpoint carrying
 * `metadata.SERVER_ONLY` when building the HTTP route table
 * (`node_modules/better-call/dist/router.mjs:22`:
 * `if (endpoint.options?.metadata?.SERVER_ONLY) continue;`). Empirically
 * confirmed here too: a raw `POST /api/auth/organization/add-member` 404s
 * regardless of any hook. So unlike `update`, `delete` and `invite-member` —
 * all covered in `tests/isolation/org-endpoints.test.ts` via real `Request`
 * objects because they ARE reachable that way — `add-member` is only ever
 * reachable through `auth.api.addMember(...)`, the same call path Better
 * Auth's own admin/dashboard-facing server code would use. That is still the
 * real, unmocked endpoint handler; only the transport (direct call vs. HTTP)
 * differs.
 *
 * `membershipLimit`'s function form is not redundant with that transport
 * detail: the identical resolution (`typeof membershipLimit === "number" ? … :
 * await membershipLimit(user, organization)`) is also read by
 * `/organization/accept-invitation` (`crud-invites.mjs:275-279`), which IS a
 * plain HTTP endpoint invited users reach directly. Proving the seat cap here
 * against `auth.api.addMember` proves the same function that gates that real
 * HTTP surface.
 *
 * Substitutions, and only these (identical to `tests/isolation/login.test.ts`,
 * plan 02-04's established pattern for this exact auth config):
 *
 *   next/headers         — behaviour-accurate mutable cookie jar.
 *   rate limiters         — controllable verdicts so a plan-limit assertion is
 *                           never confused with a throttle.
 *   authRateLimitStorage  — real increment-and-check semantics backed by a
 *                           `Map` rather than live Upstash, which has no
 *                           credentials in `.env.test`.
 *
 * Better Auth itself, Prisma, `signUpMerchant` and the auth config are all the
 * real thing.
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
 * Put a real, signed session cookie on the NEXT request. Identical to
 * `tests/isolation/login.test.ts`'s helper of the same name — `nextCookies()`
 * never reaches its store under Vitest, so signing in directly and applying
 * the `Set-Cookie` with Better Auth's own `applySetCookies` is the honest
 * round trip.
 */
async function authenticateAs(email: string): Promise<Headers> {
  const signIn = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    headers: requestContext.headers,
    returnHeaders: true,
  });

  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
  const setCookie = signIn.headers.get("set-cookie");
  if (!setCookie) throw new Error("fixture sign-in issued no session cookie");
  applySetCookies(requestContext.headers, [setCookie]);
  return requestContext.headers;
}

/** A user with a session and NO organization — the "add me" target. */
async function createBareUser(email: string): Promise<string> {
  const result = await auth.api.signUpEmail({
    body: { email, password: PASSWORD, name: "Second Person" },
    headers: new Headers(),
  });
  return result.user.id;
}

async function createStarterMerchant(
  slug: string,
  ownerEmail: string,
): Promise<{ organizationId: string; ownerHeaders: Headers }> {
  const signUp = await signUpMerchant({
    email: ownerEmail,
    password: PASSWORD,
    storeName: "Seat Limit Store",
    slug,
  });
  expect(signUp.ok).toBe(true);

  const organization = await platformDb.organization.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!organization) throw new Error("fixture: organization missing");

  resetRequestContext();
  const ownerHeaders = await authenticateAs(ownerEmail);

  return { organizationId: organization.id, ownerHeaders };
}

/** Better Auth signals failures as `APIError`; the code lives on `body.code`. */
function apiErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const body = (error as { body?: unknown }).body;
  if (typeof body !== "object" || body === null) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
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
// starter refuses second member
// ---------------------------------------------------------------------------

describe("starter refuses second member", () => {
  it("refuses auth.api.addMember beyond the Starter seat", async () => {
    const { organizationId } = await createStarterMerchant(
      "starter-seat-store",
      "starter-owner@example.test",
    );
    await platformDb.organization.update({
      where: { id: organizationId },
      data: { planTier: "starter" },
    });

    const secondUserId = await createBareUser("starter-second@example.test");

    let caughtCode: string | undefined;
    try {
      await auth.api.addMember({
        body: { userId: secondUserId, role: "member", organizationId },
      });
      throw new Error("expected addMember to throw, but it succeeded");
    } catch (error) {
      caughtCode = apiErrorCode(error);
    }
    expect(caughtCode).toBe("ORGANIZATION_MEMBERSHIP_LIMIT_REACHED");

    const members = await platformDb.member.count({
      where: { organizationId },
    });
    expect(members).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// business allows a second member
// ---------------------------------------------------------------------------

describe("business allows a second member", () => {
  it("permits auth.api.addMember on a Business organization", async () => {
    const { organizationId } = await createStarterMerchant(
      "business-seat-store",
      "business-owner@example.test",
    );
    await platformDb.organization.update({
      where: { id: organizationId },
      data: { planTier: "business" },
    });

    const secondUserId = await createBareUser("business-second@example.test");

    await auth.api.addMember({
      body: { userId: secondUserId, role: "member", organizationId },
    });

    const members = await platformDb.member.count({
      where: { organizationId },
    });
    expect(members).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// no plan is owner only
// ---------------------------------------------------------------------------

describe("no plan is owner only", () => {
  it("refuses addMember when planTier is null, never the library's 100 default", async () => {
    const { organizationId } = await createStarterMerchant(
      "no-plan-seat-store",
      "no-plan-owner@example.test",
    );
    // planTier is null by default — no `platformDb.organization.update` call.

    const secondUserId = await createBareUser("no-plan-second@example.test");

    let caughtCode: string | undefined;
    try {
      await auth.api.addMember({
        body: { userId: secondUserId, role: "member", organizationId },
      });
      throw new Error("expected addMember to throw, but it succeeded");
    } catch (error) {
      caughtCode = apiErrorCode(error);
    }
    expect(caughtCode).toBe("ORGANIZATION_MEMBERSHIP_LIMIT_REACHED");

    const members = await platformDb.member.count({
      where: { organizationId },
    });
    expect(members).toBe(1);
  });
});
