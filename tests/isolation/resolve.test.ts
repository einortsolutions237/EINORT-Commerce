import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { platformDb } from "@/server/db/platform";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * `resolveTenantBySlug` against the real Neon test branch (TEN-03, DOM-02).
 *
 * This file lives in the `isolation` project because the assertions that matter
 * are about what reaches Postgres — "the second resolution issued no query" is
 * only meaningful if the first one really did. Stubbing the database would make
 * every count trivially true.
 *
 * What IS substituted is the Upstash *transport*: `@upstash/redis` is replaced
 * with an in-memory implementation of `get` / `set` / `del` that honours `ex`.
 * Everything above the wire — the `tenant:host:` namespace, the positive and
 * negative entries, both TTLs, the sentinel, the degradation branch and the
 * resolver's fail-closed logic — is the real code. A shared live Redis would
 * make these tests order-dependent across runs (a leftover key from a previous
 * run silently satisfies "no second query"), which is the opposite of what a
 * security control's regression test should be.
 */

// ---------------------------------------------------------------------------
// In-memory Upstash stand-in
// ---------------------------------------------------------------------------

type StoredValue = {
  raw: string;
  ttlSeconds: number | null;
  expiresAtMs: number;
};

const redisStore = new Map<string, StoredValue>();

/**
 * Mirrors the two behaviours of `@upstash/redis` this module depends on:
 * `set(key, value, { ex })` stores with a second-granularity TTL, and `get`
 * automatically JSON-deserializes, so a value written as a JSON string comes
 * back as an object.
 */
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
      ttlSeconds,
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

// ---------------------------------------------------------------------------
// Module loader
// ---------------------------------------------------------------------------

type LoadedResolver = {
  resolveTenantBySlug: (
    slug: string,
  ) => Promise<{ id: string; slug: string; status: string } | null>;
  invalidateTenantHost: (...slugs: string[]) => Promise<void>;
  /** How many times the resolver reached Postgres in this module epoch. */
  dbQueryCount: () => number;
};

/**
 * Loads a fresh copy of the resolver with the cache transport faked and the
 * Upstash credentials present or absent.
 *
 * A fresh module epoch per test matters twice over: `cache.ts` memoizes its
 * client decision (so the degradation warning fires once per process), and
 * `resolve.ts` is wrapped in React's `cache()`. Reusing one epoch would let one
 * test's memoization decide the next test's result.
 */
async function loadResolver(
  { upstashConfigured = true }: { upstashConfigured?: boolean } = {},
): Promise<LoadedResolver> {
  vi.resetModules();

  vi.doMock("@upstash/redis", () => ({ Redis: FakeRedis }));

  vi.doMock("@/env", async () => {
    const actual = await vi.importActual<typeof import("@/env")>("@/env");
    const overrides: Record<string, string | undefined> = upstashConfigured
      ? {
          UPSTASH_REDIS_REST_URL: "https://fake.upstash.invalid",
          UPSTASH_REDIS_REST_TOKEN: "fake-token",
        }
      : {
          UPSTASH_REDIS_REST_URL: undefined,
          UPSTASH_REDIS_REST_TOKEN: undefined,
        };

    return {
      env: new Proxy(actual.env as unknown as Record<string, unknown>, {
        get(target, prop) {
          if (typeof prop === "string" && prop in overrides) {
            return overrides[prop];
          }
          return Reflect.get(target, prop);
        },
      }) as unknown as typeof actual.env,
    };
  });

  let dbQueries = 0;
  vi.doMock("@/server/db/platform", async () => {
    const actual =
      await vi.importActual<typeof import("@/server/db/platform")>(
        "@/server/db/platform",
      );
    return {
      platformDb: {
        // A counting passthrough, not a stub: the query still runs against the
        // real test branch, so a count of 1 means one genuine round trip.
        get organization() {
          const delegate = actual.platformDb.organization as unknown as {
            findUnique: (args: unknown) => Promise<unknown>;
          };
          return {
            findUnique: (args: unknown) => {
              dbQueries += 1;
              return delegate.findUnique(args);
            },
          };
        },
      },
    };
  });

  const resolveModule = await import("@/server/tenant/resolve");
  const cacheModule = await import("@/server/tenant/cache");

  return {
    resolveTenantBySlug: resolveModule.resolveTenantBySlug,
    invalidateTenantHost: cacheModule.invalidateTenantHost,
    dbQueryCount: () => dbQueries,
  };
}

const UNKNOWN_SLUG = "no-such-store-anywhere";

beforeEach(async () => {
  redisStore.clear();
  await seedTwoTenants();
});

afterEach(() => {
  vi.doUnmock("@upstash/redis");
  vi.doUnmock("@/env");
  vi.doUnmock("@/server/db/platform");
  vi.restoreAllMocks();
  vi.resetModules();
});

// ---------------------------------------------------------------------------

describe("resolveTenantBySlug", () => {
  it("resolves an active seeded slug to that tenant", async () => {
    const { resolveTenantBySlug, dbQueryCount } = await loadResolver();

    const tenant = await resolveTenantBySlug(TENANT_A.slug);

    expect(tenant).toEqual({
      id: TENANT_A.id,
      slug: TENANT_A.slug,
      status: "active",
    });
    expect(dbQueryCount()).toBe(1);
  });

  it("resolves a second seeded slug to its own tenant, not to the first", async () => {
    const { resolveTenantBySlug } = await loadResolver();

    const tenant = await resolveTenantBySlug(TENANT_B.slug);

    expect(tenant?.id).toBe(TENANT_B.id);
  });

  it("returns null for an unknown slug", async () => {
    const { resolveTenantBySlug } = await loadResolver();

    await expect(resolveTenantBySlug(UNKNOWN_SLUG)).resolves.toBeNull();
  });

  it("returns null for a suspended organization, indistinguishably from an unknown one (D-05)", async () => {
    await platformDb.organization.update({
      where: { id: TENANT_A.id },
      data: { status: "suspended" },
    });

    const { resolveTenantBySlug } = await loadResolver();

    const suspended = await resolveTenantBySlug(TENANT_A.slug);
    const unknown = await resolveTenantBySlug(UNKNOWN_SLUG);

    expect(suspended).toBeNull();
    // Not merely "both falsy" — the resolver must hand callers the *same*
    // value, so no downstream branch can tell the two apart.
    expect(suspended).toEqual(unknown);
  });

  it("returns null for any non-active status, not just the literal 'suspended'", async () => {
    await platformDb.organization.update({
      where: { id: TENANT_A.id },
      data: { status: "pending-review" },
    });

    const { resolveTenantBySlug } = await loadResolver();

    await expect(resolveTenantBySlug(TENANT_A.slug)).resolves.toBeNull();
  });
});

describe("resolveTenantBySlug caching", () => {
  it("issues no second database query for a repeated resolution within the TTL", async () => {
    const { resolveTenantBySlug, dbQueryCount } = await loadResolver();

    const first = await resolveTenantBySlug(TENANT_A.slug);
    const second = await resolveTenantBySlug(TENANT_A.slug);

    expect(first).toEqual(second);
    expect(dbQueryCount()).toBe(1);
  });

  it("issues exactly one database query for an unknown slug resolved twice (negative cache, T-01-31)", async () => {
    const { resolveTenantBySlug, dbQueryCount } = await loadResolver();

    await expect(resolveTenantBySlug(UNKNOWN_SLUG)).resolves.toBeNull();
    await expect(resolveTenantBySlug(UNKNOWN_SLUG)).resolves.toBeNull();

    expect(dbQueryCount()).toBe(1);
  });

  it("writes under the tenant:host: namespace and nothing else (C-11)", async () => {
    const { resolveTenantBySlug } = await loadResolver();

    await resolveTenantBySlug(TENANT_A.slug);
    await resolveTenantBySlug(UNKNOWN_SLUG);

    const keys = [...redisStore.keys()];
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => key.startsWith("tenant:host:"))).toBe(true);
    expect(keys).toContain(`tenant:host:${TENANT_A.slug}`);
    expect(keys).toContain(`tenant:host:${UNKNOWN_SLUG}`);
  });

  it("uses a 300s TTL for a hit and a 60s TTL for a miss", async () => {
    const { resolveTenantBySlug } = await loadResolver();

    await resolveTenantBySlug(TENANT_A.slug);
    await resolveTenantBySlug(UNKNOWN_SLUG);

    expect(redisStore.get(`tenant:host:${TENANT_A.slug}`)?.ttlSeconds).toBe(300);
    expect(redisStore.get(`tenant:host:${UNKNOWN_SLUG}`)?.ttlSeconds).toBe(60);
  });

  it("caches a suspended organization without a second query and still returns null", async () => {
    await platformDb.organization.update({
      where: { id: TENANT_A.id },
      data: { status: "suspended" },
    });

    const { resolveTenantBySlug, dbQueryCount } = await loadResolver();

    await expect(resolveTenantBySlug(TENANT_A.slug)).resolves.toBeNull();
    await expect(resolveTenantBySlug(TENANT_A.slug)).resolves.toBeNull();

    // The record is cached verbatim (status included), so the suspension rule
    // costs zero extra reads while a suspended hostname is being scanned.
    expect(dbQueryCount()).toBe(1);
    const stored = redisStore.get(`tenant:host:${TENANT_A.slug}`);
    expect(stored?.raw).toContain("suspended");
  });

  it("invalidateTenantHost sends the next resolution back to the database", async () => {
    const { resolveTenantBySlug, invalidateTenantHost, dbQueryCount } =
      await loadResolver();

    await resolveTenantBySlug(TENANT_A.slug);
    expect(dbQueryCount()).toBe(1);

    await invalidateTenantHost(TENANT_A.slug);
    expect(redisStore.has(`tenant:host:${TENANT_A.slug}`)).toBe(false);

    await resolveTenantBySlug(TENANT_A.slug);
    expect(dbQueryCount()).toBe(2);
  });

  it("invalidateTenantHost makes a suspension take effect before the TTL expires (T-01-32)", async () => {
    const { resolveTenantBySlug, invalidateTenantHost } = await loadResolver();

    await expect(resolveTenantBySlug(TENANT_A.slug)).resolves.not.toBeNull();

    await platformDb.organization.update({
      where: { id: TENANT_A.id },
      data: { status: "suspended" },
    });
    await invalidateTenantHost(TENANT_A.slug);

    // A fresh epoch stands in for the next request: React's cache() is
    // per-render, so the only thing that could still serve the store here is a
    // stale Redis entry.
    const next = await loadResolver();
    await expect(next.resolveTenantBySlug(TENANT_A.slug)).resolves.toBeNull();
  });
});

describe("resolveTenantBySlug without Upstash configured", () => {
  it("warns once naming both missing variables and still resolves from the database", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { resolveTenantBySlug, dbQueryCount } = await loadResolver({
      upstashConfigured: false,
    });

    const tenant = await resolveTenantBySlug(TENANT_A.slug);

    expect(tenant?.id).toBe(TENANT_A.id);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain("UPSTASH_REDIS_REST_URL");
    expect(message).toContain("UPSTASH_REDIS_REST_TOKEN");

    // Degraded means uncached, not broken: the second resolution costs another
    // query, and nothing throws.
    await expect(resolveTenantBySlug(TENANT_A.slug)).resolves.not.toBeNull();
    expect(dbQueryCount()).toBe(2);
    expect(redisStore.size).toBe(0);
  });

  it("still returns null for an unknown slug rather than throwing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { resolveTenantBySlug, invalidateTenantHost } = await loadResolver({
      upstashConfigured: false,
    });

    await expect(resolveTenantBySlug(UNKNOWN_SLUG)).resolves.toBeNull();
    // Invalidation must be a no-op, not a crash, when there is no cache.
    await expect(invalidateTenantHost(UNKNOWN_SLUG)).resolves.toBeUndefined();
  });
});
