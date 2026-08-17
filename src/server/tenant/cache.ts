import "server-only";

import { Redis } from "@upstash/redis";

import { env } from "@/env";

/**
 * The `tenant:host:*` Redis namespace — and nothing else.
 *
 * This module owns exactly one key family. Constraint C-11 keeps the session,
 * jobs, cart and idempotency key namespaces separate from this one and owned by
 * their own modules — none of them may be read or written from here, and
 * `tenant:host:` may not be read or written from them. One module per namespace
 * is what makes "which code can evict a tenant resolution?" answerable by
 * reading one file.
 *
 * Two things about this cache are load-bearing rather than performance work:
 *
 *  1. **It caches misses.** With a wildcard domain every `<anything>.einort.com`
 *     reaches the app, so a scanner walking random subdomains produces a stream
 *     of cache misses that each fall through to a database lookup returning
 *     nothing and caching nothing — an unauthenticated path to saturating the
 *     Neon connection pool (T-01-31). Caching the miss is the fix.
 *
 *  2. **It caches the whole record, not just the id.** The resolver has to
 *     enforce D-05 (a suspended store renders the same page as an unclaimed
 *     hostname) and it must be able to do that from the cached value alone.
 *     Storing only an id would force a second lookup on every hit, which is the
 *     entire point of the cache.
 *
 * When Upstash is unconfigured the module degrades to a no-op cache rather than
 * throwing: a missing cache must add database load, never take the storefront
 * down (T-01-35, dispositioned `accept`). The degradation is deliberately loud —
 * silence is how a no-cache configuration reaches production unnoticed.
 */

/** The shape persisted under a positive entry. Mirrors the resolver's select. */
export type CachedTenant = {
  id: string;
  slug: string;
  status: string;
};

/**
 * Three distinguishable outcomes, not two.
 *
 * `unset` (no entry) and `miss` (a cached negative) must not collapse into one
 * value: the first means "ask the database", the second means "the database was
 * already asked and said no". Returning `null` for both would silently disable
 * negative caching — the resolver would re-query on every request for an
 * unknown hostname and the T-01-31 mitigation would be gone with every test
 * still green.
 */
export type TenantCacheLookup =
  | { kind: "unset" }
  | { kind: "miss" }
  | { kind: "hit"; tenant: CachedTenant };

/** C-11: this module owns this prefix, and owns nothing else. */
const KEY_PREFIX = "tenant:host:";

const keyFor = (slug: string): string => `${KEY_PREFIX}${slug}`;

/**
 * 300s for a resolved store. A backstop, not the suspension mechanism —
 * `invalidateTenantHost` is (T-01-32, Pitfall 7).
 */
const TTL_HIT_SECONDS = 300;

/**
 * 60s for a negative entry. Shorter than the positive TTL on purpose: the
 * negative entry exists to absorb scanner traffic, and a newly claimed slug
 * must not be shadowed by a cached "no such store" for five minutes after the
 * merchant signs up.
 */
const TTL_MISS_SECONDS = 60;

/**
 * The negative sentinel. A structurally tagged object rather than a magic
 * string, so it can never collide with a serialized tenant and so a
 * partially-written value fails the discriminant check instead of being read as
 * a tenant.
 */
const MISS_SENTINEL = { kind: "miss" } as const;

type StoredEntry =
  | typeof MISS_SENTINEL
  | { kind: "hit"; tenant: CachedTenant };

/**
 * Memoized client resolution. `null` means "degraded — no cache configured".
 *
 * Memoizing the *decision* (rather than just the client) is what keeps the
 * degradation warning to one line per process instead of one per request.
 */
let resolvedClient: { redis: Redis | null } | undefined;

function getRedis(): Redis | null {
  if (resolvedClient !== undefined) return resolvedClient.redis;

  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    const missing: string[] = [];
    if (!url) missing.push("UPSTASH_REDIS_REST_URL");
    if (!token) missing.push("UPSTASH_REDIS_REST_TOKEN");

    console.warn(
      `[tenant-cache] DEGRADED: no tenant hostname cache. Missing ${missing.join(
        " and ",
      )}. Every storefront request will read Postgres directly and unknown ` +
        `hostnames will not be negative-cached, so a wildcard-subdomain scan ` +
        `can saturate the connection pool. Acceptable in local development; ` +
        `never acceptable in production.`,
    );
    resolvedClient = { redis: null };
    return null;
  }

  resolvedClient = { redis: new Redis({ url, token }) };
  return resolvedClient.redis;
}

/**
 * Upstash deserializes JSON automatically on `get`, so a value written as a
 * JSON string comes back as an object. Older/other transports hand back the raw
 * string. Accept both rather than depending on which one is in play — guessing
 * wrong turns every cache hit into a silent miss, which is invisible except as
 * database load.
 */
function parseEntry(raw: unknown): StoredEntry | null {
  if (raw === null || raw === undefined) return null;

  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (typeof value !== "object" || value === null) return null;
  const entry = value as Partial<StoredEntry>;

  if (entry.kind === "miss") return MISS_SENTINEL;

  if (entry.kind === "hit") {
    const tenant = (entry as { tenant?: unknown }).tenant;
    if (
      typeof tenant === "object" &&
      tenant !== null &&
      typeof (tenant as CachedTenant).id === "string" &&
      typeof (tenant as CachedTenant).slug === "string" &&
      typeof (tenant as CachedTenant).status === "string"
    ) {
      const { id, slug, status } = tenant as CachedTenant;
      return { kind: "hit", tenant: { id, slug, status } };
    }
  }

  return null;
}

/**
 * Read the cached resolution for a slug.
 *
 * Fails **open toward the database**: any transport or parse error resolves to
 * `{ kind: "unset" }` so the caller performs the authoritative lookup. A cache
 * error must never be able to manufacture a tenant, and must never be able to
 * take a storefront down.
 */
export async function getCachedTenant(slug: string): Promise<TenantCacheLookup> {
  const redis = getRedis();
  if (!redis) return { kind: "unset" };

  try {
    const raw = await redis.get<unknown>(keyFor(slug));
    const entry = parseEntry(raw);
    if (entry === null) return { kind: "unset" };
    return entry.kind === "miss"
      ? { kind: "miss" }
      : { kind: "hit", tenant: entry.tenant };
  } catch (error) {
    console.warn(
      `[tenant-cache] read failed for ${keyFor(slug)}; falling through to the database.`,
      error,
    );
    return { kind: "unset" };
  }
}

/**
 * Cache a positive resolution for `TTL_HIT_SECONDS`.
 *
 * Stores whatever the database said, including a non-`active` status. The
 * suspension rule is applied by the resolver at return time, not here — that
 * way an un-suspend is a single invalidation rather than a different cache
 * shape, and a suspended store still costs zero database reads while it is
 * being scanned.
 */
export async function setCachedTenant(
  slug: string,
  tenant: CachedTenant,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const entry: StoredEntry = {
    kind: "hit",
    tenant: { id: tenant.id, slug: tenant.slug, status: tenant.status },
  };

  try {
    await redis.set(keyFor(slug), JSON.stringify(entry), {
      ex: TTL_HIT_SECONDS,
    });
  } catch (error) {
    console.warn(`[tenant-cache] write failed for ${keyFor(slug)}.`, error);
  }
}

/**
 * Cache a negative resolution for `TTL_MISS_SECONDS`. This is the T-01-31
 * mitigation; removing it reopens the wildcard-scan denial of service.
 */
export async function setCachedMiss(slug: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(keyFor(slug), JSON.stringify(MISS_SENTINEL), {
      ex: TTL_MISS_SECONDS,
    });
  } catch (error) {
    console.warn(
      `[tenant-cache] negative-cache write failed for ${keyFor(slug)}.`,
      error,
    );
  }
}

/**
 * Evict one or more slugs.
 *
 * **Call this on every mutation of `slug` or `status`** — plan 01-06 after
 * provisioning, Phase 6 on suspend and on rename (both the old and the new
 * slug). The TTL is a backstop; this is the mechanism (T-01-32, Pitfall 7).
 *
 * Unlike the read and write paths this one does **not** swallow errors. A
 * failed eviction means a suspended store keeps serving, so the caller has to
 * be able to see it and retry. Silently succeeding here would make the
 * suspension path lie.
 */
export async function invalidateTenantHost(...slugs: string[]): Promise<void> {
  const targets = slugs.filter((slug) => slug.length > 0);
  if (targets.length === 0) return;

  const redis = getRedis();
  if (!redis) return;

  await redis.del(...targets.map(keyFor));
}
