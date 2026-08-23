import { applySetCookies } from "better-auth/cookies";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { platformDb } from "@/server/db/platform";

import { seedTwoTenants } from "../setup/seed-two-tenants";

/**
 * SUB-01 / SUB-02, against the raw `/api/auth/organization/*` endpoints —
 * the second, independent entry point into tenant state that no Server
 * Action wrapper can intercept.
 *
 * Better Auth's `organization` plugin registers 34 live endpoints under
 * `/api/auth/organization/*`, already served by the Phase 1 apex handler
 * (`src/app/api/auth/[...all]/route.ts`). None of them is code this project
 * wrote, so none appears in a route `grep` and none is visible in review.
 * `update`, `delete` and `invite-member` mutate tenant state with no gate
 * until `organizationHooks` closes them, so every assertion here goes
 * through a real `Request` against the exported route handler and checks the
 * resulting database rows, never the HTTP response alone.
 *
 * Substitutions, and only these (identical to `tests/isolation/login.test.ts`,
 * plan 02-04's established pattern for driving this exact route handler):
 *
 *   next/headers         — behaviour-accurate mutable cookie jar.
 *   rate limiters         — controllable verdicts so a refusal assertion is
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
 * `tests/isolation/login.test.ts`'s helper of the same name.
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

async function createMerchant(
  slug: string,
  ownerEmail: string,
): Promise<{ organizationId: string; ownerHeaders: Headers }> {
  const signUp = await signUpMerchant({
    email: ownerEmail,
    password: PASSWORD,
    storeName: "Org Endpoint Store",
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

beforeEach(async () => {
  await seedTwoTenants();
  resetRequestContext();
  limitVerdict.slugCheck = true;
  limitVerdict.signup = true;
  limitVerdict.login = true;
  authThrottleStore.clear();
});

// ---------------------------------------------------------------------------
// update slug refused
// ---------------------------------------------------------------------------

describe("update slug refused", () => {
  it("refuses POST /organization/update carrying a slug and leaves the slug unchanged", async () => {
    const { POST } = await import("@/app/api/auth/[...all]/route");
    const { organizationId, ownerHeaders } = await createMerchant(
      "update-refused-store",
      "update-owner@example.test",
    );

    const request = new Request(
      "http://localhost:3000/api/auth/organization/update",
      {
        method: "POST",
        headers: new Headers({
          "content-type": "application/json",
          cookie: ownerHeaders.get("cookie") ?? "",
          "x-forwarded-for": "203.0.113.7",
        }),
        body: JSON.stringify({ data: { slug: "admin" }, organizationId }),
      },
    );
    const response = await POST(request);

    expect(response.status).toBeGreaterThanOrEqual(400);

    const organization = await platformDb.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    });
    expect(organization?.slug).toBe("update-refused-store");
  });
});

// ---------------------------------------------------------------------------
// delete refused
// ---------------------------------------------------------------------------

describe("delete refused", () => {
  it("refuses POST /organization/delete and the organization row still exists", async () => {
    const { POST } = await import("@/app/api/auth/[...all]/route");
    const { organizationId, ownerHeaders } = await createMerchant(
      "delete-refused-store",
      "delete-owner@example.test",
    );

    const request = new Request(
      "http://localhost:3000/api/auth/organization/delete",
      {
        method: "POST",
        headers: new Headers({
          "content-type": "application/json",
          cookie: ownerHeaders.get("cookie") ?? "",
          "x-forwarded-for": "203.0.113.7",
        }),
        body: JSON.stringify({ organizationId }),
      },
    );
    const response = await POST(request);

    expect(response.status).toBeGreaterThanOrEqual(400);

    const organization = await platformDb.organization.findUnique({
      where: { id: organizationId },
    });
    expect(organization).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// invite refused at the seat limit
// ---------------------------------------------------------------------------

describe("invite refused at the seat limit", () => {
  it("refuses POST /organization/invite-member on a Starter organization at creation time", async () => {
    const { POST } = await import("@/app/api/auth/[...all]/route");
    const { organizationId, ownerHeaders } = await createMerchant(
      "invite-refused-store",
      "invite-owner@example.test",
    );
    await platformDb.organization.update({
      where: { id: organizationId },
      data: { planTier: "starter" },
    });

    const request = new Request(
      "http://localhost:3000/api/auth/organization/invite-member",
      {
        method: "POST",
        headers: new Headers({
          "content-type": "application/json",
          cookie: ownerHeaders.get("cookie") ?? "",
          "x-forwarded-for": "203.0.113.7",
        }),
        body: JSON.stringify({
          email: "invitee@example.test",
          role: "member",
          organizationId,
        }),
      },
    );
    const response = await POST(request);

    expect(response.status).toBeGreaterThanOrEqual(400);

    const invitations = await platformDb.invitation.count({
      where: { organizationId },
    });
    expect(invitations).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// signup still works
// ---------------------------------------------------------------------------

describe("signup still works", () => {
  it("still completes signUpMerchant end to end, proving the seat rule does not refuse the owner's own row", async () => {
    const slug = "seat-rule-signup-store";
    const email = "seat-rule-signup@example.test";

    const result = await signUpMerchant({
      email,
      password: PASSWORD,
      storeName: "Seat Rule Signup Store",
      slug,
    });

    expect(result).toEqual({ ok: true, slug });

    const organization = await platformDb.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    expect(organization).not.toBeNull();

    const members = await platformDb.member.count({
      where: { organizationId: organization!.id },
    });
    expect(members).toBe(1);

    // The seat gate must not collaterally block the owner's own, ordinary
    // writes either — a raw, slug-free update (renaming the display name,
    // not the address) has to keep succeeding after this plan lands.
    resetRequestContext();
    const ownerHeaders = await authenticateAs(email);
    const { POST } = await import("@/app/api/auth/[...all]/route");
    const request = new Request(
      "http://localhost:3000/api/auth/organization/update",
      {
        method: "POST",
        headers: new Headers({
          "content-type": "application/json",
          cookie: ownerHeaders.get("cookie") ?? "",
          "x-forwarded-for": "203.0.113.7",
        }),
        body: JSON.stringify({
          data: { name: "Renamed Display Name" },
          organizationId: organization!.id,
        }),
      },
    );
    const response = await POST(request);
    expect(response.status).toBeLessThan(300);

    const updated = await platformDb.organization.findUnique({
      where: { id: organization!.id },
      select: { name: true, slug: true },
    });
    expect(updated?.name).toBe("Renamed Display Name");
    expect(updated?.slug).toBe(slug);
  });
});
