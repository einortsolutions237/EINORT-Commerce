import { applySetCookies } from "better-auth/cookies";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adminDb } from "@/server/db/admin";
import { platformDb } from "@/server/db/platform";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * ADM-01 / D-14..D-17, end to end against the real Neon test branch.
 *
 * `setOrganizationSuspended` (`src/server/admin/suspend.ts`) does not exist
 * yet — this file is RED on purpose (Task 1). It imports the module directly
 * so Task 2 turns every case below green without this file changing.
 *
 * ---------------------------------------------------------------------------
 * THE CACHE-INVALIDATION CASE FAKES `@upstash/redis`. EVERY OTHER CASE DOES
 * NOT, AND THAT IS DELIBERATE.
 * ---------------------------------------------------------------------------
 * Proving T-06-69 ("a stale Redis positive keeps a suspended store serving")
 * needs a genuine cached positive entry to invalidate — a status check alone
 * cannot distinguish "the resolver re-read Postgres and got null" from "the
 * resolver served a cache invalidation actually evicted". So exactly one
 * `describe` block below reproduces `tests/isolation/resolve.test.ts`'s own
 * in-memory Upstash stand-in (comment there explains why: `@upstash/redis`'s
 * *transport* is faked, never the resolver or the cache logic above it) and
 * loads `resolve.ts`, `cache.ts` and `suspend.ts` together in one fresh
 * module epoch so `suspend.ts`'s internal `invalidateTenantHost` call reaches
 * the SAME fake store the priming resolution wrote to.
 *
 * Every other case in this file calls `setOrganizationSuspended` through the
 * plain top-level import, against whatever Upstash configuration `.env.test`
 * actually carries. IF Upstash is not configured there, `invalidateTenantHost`
 * degrades to a documented no-op (`src/server/tenant/cache.ts`) and those
 * cases still pass — they were never exercising invalidation, only the
 * status flip, the system message, and the no-op guard. A green run of
 * THOSE cases in a Redis-less environment must not be mistaken for proof
 * that invalidation happens; the one faked-Redis case below is what proves
 * it.
 *
 * ---------------------------------------------------------------------------
 * THE MERCHANT-CONTEXT REDIRECT CASE REUSES `tests/isolation/
 * merchant-context.test.ts`'S HARNESS, NOT `resolve.test.ts`'S.
 * ---------------------------------------------------------------------------
 * D-16 says there is no read-only dashboard mode — `requireMerchantContext()`
 * already redirects a non-active organization to `/suspended`, unchanged by
 * this plan. Asserting that against a REAL signed session (rather than a
 * stubbed one) is the only way "a suspended merchant's dashboard login lands
 * on `/suspended`" means anything, for the identical reason that file's own
 * header gives. The `next/headers` stand-in and the sign-up-then-sign-in
 * fixture below are that file's harness, reproduced rather than imported —
 * there is no shared test-harness module in this codebase to import from
 * (every isolation file that needs one builds its own).
 */

// ---------------------------------------------------------------------------
// next/headers stand-in (tests/isolation/merchant-context.test.ts's harness)
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

/** See `merchant-context.test.ts` for why this mock exists. */
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));

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

// Imported after the mocks so the modules under test pick them up. This is
// the UNFAKED path — real Upstash configuration (or its absence) from
// `.env.test`, matching the second header block above.
const { signUpMerchant } = await import("@/server/auth/signup");
const { selectPlan } = await import("@/server/merchant/actions");
const { saveBranding } = await import("@/server/theming/actions");
const { requireMerchantContext } = await import("@/server/merchant/context");
const { auth } = await import("@/server/auth/auth");
const { setOrganizationSuspended } = await import("@/server/admin/suspend");

const PASSWORD = "correct-horse-battery";
const PLATFORM_ACTOR_ID = "platform-owner-fixed-id";

function resetRequestContext(): void {
  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.9" });
  requestContext.cookies.clear();
}

/** See `merchant-context.test.ts`'s identical helper for the full reasoning. */
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

/** A merchant past every onboarding gate, with a live session. */
async function signUpChooseAndCarrySession(
  email: string,
  slug: string,
  storeName = "Suspension Fixture Store",
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

  const chosen = await selectPlan({ tier: "business" });
  if (!chosen.ok) {
    throw new Error(`fixture plan pick failed: ${JSON.stringify(chosen.error)}`);
  }

  const branded = await saveBranding({
    businessName: storeName,
    industry: "general-retail",
    logoKey: null,
    primaryAccent: "#18181B",
    secondaryAccent: "#71717A",
    templateKey: "flagship-fashion",
  });
  if (!branded.ok) {
    throw new Error(`fixture branding failed: ${JSON.stringify(branded.error)}`);
  }

  return result.slug;
}

/** Assert a `requireMerchantContext()` call redirected, and did NOT return. */
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
    expect(digest as string, `expected the redirect to target ${path}`).toContain(
      path,
    );
    return;
  }

  throw new Error(
    `expected requireMerchantContext() to redirect to ${path}, but it ` +
      `returned ${JSON.stringify(returned)}.`,
  );
}

async function systemMessagesFor(
  merchantId: string,
): Promise<readonly { readonly body: string }[]> {
  return adminDb.supportMessage.findMany({
    where: { tenantId: merchantId, author: "SYSTEM" },
    orderBy: { createdAt: "asc" },
    select: { body: true },
  });
}

beforeEach(async () => {
  await seedTwoTenants();
  resetRequestContext();
  limitVerdict.slugCheck = true;
  limitVerdict.signup = true;
});

// ---------------------------------------------------------------------------

describe("setOrganizationSuspended", () => {
  it("suspends: status flips, one SYSTEM message carries the reason, the other tenant is untouched", async () => {
    await setOrganizationSuspended({
      merchantId: TENANT_A.id,
      suspend: true,
      reason: "Repeated chargebacks reported by three separate customers.",
      actorUserId: PLATFORM_ACTOR_ID,
    });

    const org = await platformDb.organization.findUnique({
      where: { id: TENANT_A.id },
      select: { status: true },
    });
    expect(org?.status).toBe("suspended");

    const messages = await systemMessagesFor(TENANT_A.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.body).toContain(
      "Repeated chargebacks reported by three separate customers.",
    );
    expect(messages[0]?.body).toContain("Your store was suspended by EINORT");

    // TENANT_B is untouched — both its status and its thread.
    const other = await platformDb.organization.findUnique({
      where: { id: TENANT_B.id },
      select: { status: true },
    });
    expect(other?.status).toBe("active");
    expect(await systemMessagesFor(TENANT_B.id)).toHaveLength(0);
  });

  it("suspending an already-suspended organization writes nothing", async () => {
    await setOrganizationSuspended({
      merchantId: TENANT_A.id,
      suspend: true,
      reason: "First reason, the one that should stick.",
      actorUserId: PLATFORM_ACTOR_ID,
    });
    const afterFirst = await systemMessagesFor(TENANT_A.id);
    expect(afterFirst).toHaveLength(1);

    await setOrganizationSuspended({
      merchantId: TENANT_A.id,
      suspend: true,
      reason: "Second reason, which must never be recorded.",
      actorUserId: PLATFORM_ACTOR_ID,
    });

    const afterSecond = await systemMessagesFor(TENANT_A.id);
    // No second status update and no second system message — the repeat call
    // is a no-op (two admin tabs is the normal case, not an attack).
    expect(afterSecond).toHaveLength(1);
    expect(afterSecond[0]?.body).toContain("First reason, the one that should stick.");

    const org = await platformDb.organization.findUnique({
      where: { id: TENANT_A.id },
      select: { status: true },
    });
    expect(org?.status).toBe("suspended");
  });

  it("restores: status flips back to active and the restore message is posted", async () => {
    await setOrganizationSuspended({
      merchantId: TENANT_A.id,
      suspend: true,
      reason: "Reason for the suspension half of this test case.",
      actorUserId: PLATFORM_ACTOR_ID,
    });

    await setOrganizationSuspended({
      merchantId: TENANT_A.id,
      suspend: false,
      actorUserId: PLATFORM_ACTOR_ID,
    });

    const org = await platformDb.organization.findUnique({
      where: { id: TENANT_A.id },
      select: { status: true },
    });
    expect(org?.status).toBe("active");

    const messages = await systemMessagesFor(TENANT_A.id);
    expect(messages).toHaveLength(2);
    expect(messages[1]?.body).toBe("Your store was restored by EINORT.");
  });

  it("restoring an already-active organization writes nothing", async () => {
    await setOrganizationSuspended({
      merchantId: TENANT_A.id,
      suspend: false,
      actorUserId: PLATFORM_ACTOR_ID,
    });

    expect(await systemMessagesFor(TENANT_A.id)).toHaveLength(0);
    const org = await platformDb.organization.findUnique({
      where: { id: TENANT_A.id },
      select: { status: true },
    });
    expect(org?.status).toBe("active");
  });
});

describe("setOrganizationSuspended cache invalidation (T-06-69)", () => {
  // ---------------------------------------------------------------------
  // In-memory Upstash stand-in, reproduced from tests/isolation/resolve.test.ts
  // ---------------------------------------------------------------------
  type StoredValue = { raw: string; expiresAtMs: number };
  const redisStore = new Map<string, StoredValue>();

  class FakeRedis {
    constructor(_config: { url: string; token: string }) {}

    async get<T>(key: string): Promise<T | null> {
      const entry = redisStore.get(key);
      if (!entry) return null;
      if (Date.now() >= entry.expiresAtMs) {
        redisStore.delete(key);
        return null;
      }
      try {
        return JSON.parse(entry.raw) as T;
      } catch {
        return entry.raw as unknown as T;
      }
    }

    async set(
      key: string,
      value: unknown,
      opts?: { ex?: number },
    ): Promise<"OK"> {
      const ttlSeconds = opts?.ex ?? null;
      redisStore.set(key, {
        raw: typeof value === "string" ? value : JSON.stringify(value),
        expiresAtMs:
          ttlSeconds === null
            ? Number.POSITIVE_INFINITY
            : Date.now() + ttlSeconds * 1000,
      });
      return "OK";
    }

    async del(...keys: string[]): Promise<number> {
      let removed = 0;
      for (const key of keys) if (redisStore.delete(key)) removed += 1;
      return removed;
    }
  }

  /**
   * Loads `resolve.ts`, `cache.ts` and `suspend.ts` together in one fresh
   * module epoch, Upstash faked and configured — so `suspend.ts`'s internal
   * `invalidateTenantHost(org.slug)` call reaches the SAME fake Redis store
   * `resolveTenantBySlug` primed. See the file header for why this is the
   * one case in this file that fakes the transport at all.
   */
  async function loadCacheAwareModules(): Promise<{
    resolveTenantBySlug: (
      slug: string,
    ) => Promise<{ id: string; slug: string; status: string } | null>;
    setOrganizationSuspended: typeof setOrganizationSuspended;
  }> {
    vi.resetModules();
    vi.doMock("@upstash/redis", () => ({ Redis: FakeRedis }));
    vi.doMock("@/env", async () => {
      const actual = await vi.importActual<typeof import("@/env")>("@/env");
      return {
        env: new Proxy(actual.env as unknown as Record<string, unknown>, {
          get(target, prop) {
            if (prop === "UPSTASH_REDIS_REST_URL") {
              return "https://fake.upstash.invalid";
            }
            if (prop === "UPSTASH_REDIS_REST_TOKEN") return "fake-token";
            return Reflect.get(target, prop);
          },
        }) as unknown as typeof actual.env,
      };
    });

    const resolveModule = await import("@/server/tenant/resolve");
    const suspendModule = await import("@/server/admin/suspend");

    return {
      resolveTenantBySlug: resolveModule.resolveTenantBySlug,
      setOrganizationSuspended: suspendModule.setOrganizationSuspended,
    };
  }

  afterEach(() => {
    redisStore.clear();
    vi.doUnmock("@upstash/redis");
    vi.doUnmock("@/env");
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("evicts a cached positive so the next resolution returns null instead of the stale entry", async () => {
    const first = await loadCacheAwareModules();

    // Prime a positive cache entry — the store is active, so this caches a
    // "hit" under tenant:host:<slug>.
    const primed = await first.resolveTenantBySlug(TENANT_A.slug);
    expect(primed).not.toBeNull();
    expect(redisStore.has(`tenant:host:${TENANT_A.slug}`)).toBe(true);

    await first.setOrganizationSuspended({
      merchantId: TENANT_A.id,
      suspend: true,
      reason: "Suspended to prove the hostname cache is evicted, not just TTL'd.",
      actorUserId: PLATFORM_ACTOR_ID,
    });

    // The transaction's own commit does not by itself prove eviction — a
    // stale positive would still be sitting under the same key with the old
    // (active) status. Assert the key is gone.
    expect(redisStore.has(`tenant:host:${TENANT_A.slug}`)).toBe(false);

    // A fresh epoch stands in for the next request — React's cache() is
    // per-render, so the only thing that could still serve the store here is
    // a stale Redis entry, and there is none.
    const second = await loadCacheAwareModules();
    await expect(
      second.resolveTenantBySlug(TENANT_A.slug),
    ).resolves.toBeNull();
  });
});

describe("suspended organization's storefront resolution (D-05, unfaked environment)", () => {
  it("resolveTenantBySlug returns null for a suspended organization — fail-closed, not a cache artifact", async () => {
    const { resolveTenantBySlug } = await import("@/server/tenant/resolve");

    await setOrganizationSuspended({
      merchantId: TENANT_A.id,
      suspend: true,
      reason: "Suspended for the unfaked fail-closed resolver assertion.",
      actorUserId: PLATFORM_ACTOR_ID,
    });

    await expect(resolveTenantBySlug(TENANT_A.slug)).resolves.toBeNull();
  });
});

describe("suspended organization's dashboard session (D-16)", () => {
  it("redirects a merchant whose organization was suspended to /suspended", async () => {
    const slug = await signUpChooseAndCarrySession(
      "suspend-target@example.test",
      "suspend-target-store",
    );

    const before = await requireMerchantContext();
    expect(before.storeSlug).toBe(slug);

    await setOrganizationSuspended({
      merchantId: before.tenantId,
      suspend: true,
      reason: "Suspended mid-session to exercise the /suspended redirect.",
      actorUserId: PLATFORM_ACTOR_ID,
    });

    await expectRedirect(() => requireMerchantContext(), "/suspended");
  });

  it("a restored organization's session resolves normally again", async () => {
    await signUpChooseAndCarrySession(
      "restore-target@example.test",
      "restore-target-store",
    );

    const before = await requireMerchantContext();

    await setOrganizationSuspended({
      merchantId: before.tenantId,
      suspend: true,
      reason: "Suspended, then restored, in the same test case.",
      actorUserId: PLATFORM_ACTOR_ID,
    });
    await expectRedirect(() => requireMerchantContext(), "/suspended");

    await setOrganizationSuspended({
      merchantId: before.tenantId,
      suspend: false,
      actorUserId: PLATFORM_ACTOR_ID,
    });

    const after = await requireMerchantContext();
    expect(after.tenantId).toBe(before.tenantId);
  });
});
