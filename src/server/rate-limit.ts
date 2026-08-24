import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "@/env";

/**
 * Sliding-window rate limiters for the unauthenticated surfaces.
 *
 * Two things about this module are load-bearing rather than plumbing.
 *
 * **One limiter per protected surface, each with its own `prefix`.** A shared
 * prefix would make a signup flood consume the slug-check budget and vice
 * versa, so an attacker could deny the availability check to every visitor by
 * hammering signup — and the operator would see one undifferentiated counter in
 * Upstash while trying to work out which surface was under load. The prefixes
 * (`rl:slugcheck`, `rl:signup`, `rl:login`, and Phase 3's `rl:order`,
 * `rl:claim`, `rl:track`, `rl:upload`) are the key namespace of this module the
 * way `tenant:host:` is `src/server/tenant/cache.ts`'s (C-11). Every one is
 * distinct, and adding a surface means adding a prefix — never reusing one.
 *
 * **There is deliberately no in-process counter fallback.** When Upstash is
 * unconfigured the limiter degrades to allow-all with one loud warning. A
 * per-instance counter is not a weaker limit, it is a *fictional* one: Vercel
 * runs an unbounded number of concurrent serverless instances, each would start
 * its own count from zero, and the effective limit would be
 * `tokens x instances` — an unknown, traffic-dependent number that looks like a
 * working control in code review and in tests. Allow-all with a warning is
 * honest about being off; a local counter is dishonest about being on.
 *
 * This mirrors the degradation contract `src/server/tenant/cache.ts` already
 * established for the hostname cache (T-01-35): a missing Upstash must add risk
 * or database load, never take the platform down.
 */

/** The narrow surface callers depend on — keeps the degraded path type-identical. */
export interface RateLimiter {
  /** Upstash key namespace. Distinct per surface, by design. */
  readonly prefix: string;
  limit(identifier: string): Promise<{ success: boolean }>;
}

type LimiterSpec = {
  readonly prefix: string;
  readonly tokens: number;
  readonly window: `${number} ${"ms" | "s" | "m" | "h" | "d"}`;
  /** Named so the degradation warning can say which surface is unprotected. */
  readonly surface: string;
};

/**
 * Memoized client resolution. `null` means "degraded — no limiter configured".
 *
 * Memoizing the *decision* rather than just the client is what keeps the
 * warning to one line per process instead of one per request, exactly as
 * `cache.ts` does. It is also what makes the degraded branch reachable in a
 * test: an eagerly constructed module-scope client would be fixed at import.
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
      `[rate-limit] DEGRADED: every rate limiter is allow-all. Missing ` +
        `${missing.join(" and ")}. Slug availability (an unauthenticated, ` +
        `enumerable read of which merchants exist) and signup (an ` +
        `unauthenticated write that creates a tenant and a hostname) are both ` +
        `unprotected. Acceptable in local development and in tests; never ` +
        `acceptable in production.`,
    );
    resolvedClient = { redis: null };
    return null;
  }

  resolvedClient = { redis: new Redis({ url, token }) };
  return resolvedClient.redis;
}

function createLimiter(spec: LimiterSpec): RateLimiter {
  // `undefined` = not yet resolved, `null` = resolved to degraded. Same
  // three-state discipline as the hostname cache, for the same reason: a single
  // nullable slot cannot distinguish "not tried" from "tried and unavailable".
  let limiter: Ratelimit | null | undefined;

  return {
    prefix: spec.prefix,

    async limit(identifier: string): Promise<{ success: boolean }> {
      if (limiter === undefined) {
        const redis = getRedis();
        limiter = redis
          ? new Ratelimit({
              redis,
              limiter: Ratelimit.slidingWindow(spec.tokens, spec.window),
              prefix: spec.prefix,
              // Analytics writes a second key per request. Not worth the
              // Upstash command budget for a control nobody dashboards yet.
              analytics: false,
            })
          : null;
      }

      if (limiter === null) return { success: true };

      try {
        const { success } = await limiter.limit(identifier);
        return { success };
      } catch (error) {
        // Fail OPEN, loudly. An Upstash blip must not take signup offline —
        // that is the same accepted trade as T-01-35 for the hostname cache.
        // Failing closed here would convert a third-party outage into a total
        // signup outage, which is a strictly worse failure than a window of
        // unthrottled requests.
        console.warn(
          `[rate-limit] ${spec.prefix} transport failure; allowing the ` +
            `request. ${spec.surface} is momentarily unthrottled.`,
          error,
        );
        return { success: true };
      }
    },
  };
}

/**
 * Slug availability (`checkStoreSlug`).
 *
 * 30/minute is tuned for the D-02 live check: a merchant typing a store address
 * with a debounced field issues a handful of checks per minute, so this is
 * generous for a human and useless for enumeration (T-01-39).
 */
export const slugCheckLimiter: RateLimiter = createLimiter({
  prefix: "rl:slugcheck",
  tokens: 30,
  window: "1 m",
  surface: "slug availability",
});

/**
 * Merchant signup (`signUpMerchant`).
 *
 * Much tighter at 5/minute: each success creates a user, a tenant and a
 * DNS-addressable hostname, and no legitimate visitor signs up twice (T-01-40).
 */
export const signupLimiter: RateLimiter = createLimiter({
  prefix: "rl:signup",
  tokens: 5,
  window: "1 m",
  surface: "merchant signup",
});

/**
 * Merchant login (`signInMerchant`).
 *
 * 10/minute per caller IP: much looser than `signupLimiter` because every
 * returning merchant hits this on every visit, not once ever. This is the
 * ACTION-level limiter, checked before parsing and before any credential
 * verification. It is a second, independent line of defence to the one
 * below — `authRateLimitStorage` throttles the raw HTTP endpoint, which is
 * reachable even when this Server Action never runs.
 *
 * Scrypt verification is CPU-bound, so an unthrottled login flood is a
 * compute-exhaustion vector (T-02-19) and not only a credential-stuffing one
 * (T-02-18) — the reason this exists alongside, rather than instead of, the
 * HTTP-level throttle.
 */
export const loginLimiter: RateLimiter = createLimiter({
  prefix: "rl:login",
  tokens: 10,
  window: "1 m",
  surface: "merchant login",
});

/*
 * ---------------------------------------------------------------------------
 * Phase 3: the four unauthenticated order surfaces (T-03-17).
 * ---------------------------------------------------------------------------
 * Each gets its OWN prefix, for the reason the module header already gives:
 * a shared budget means a checkout flood starves claim submission, and the
 * merchant then sees "customers cannot tell me they paid" while the actual
 * attack is somewhere else entirely. Four prefixes also means four separate
 * counters in Upstash, which is what makes "which surface is under load?"
 * answerable without instrumentation.
 *
 * All four numbers are TUNABLE, not structural (RESEARCH.md assumption A4).
 * They are first estimates of "generous for a human, useless for a script" on
 * a market where a shopper may be on an intermittent mobile connection and
 * legitimately retry. Raising one is a config change, not a design change —
 * what must not change is that they stay four distinct budgets.
 *
 * All four inherit `createLimiter`'s fail-open-and-log contract. That is the
 * same accepted trade as T-01-35: an Upstash outage must degrade throttling,
 * never take checkout offline. Failing closed here would convert a
 * third-party blip into "no Cameroonian merchant can take an order", which is
 * a strictly worse outcome than a window of unthrottled traffic.
 */

/**
 * Order placement (`placeOrder`).
 *
 * 10 per 5 minutes per caller IP — the tightest of the four relative to its
 * traffic, because each SUCCESS writes an order row and DECREMENTS stock. An
 * unthrottled flood is therefore not just noise in a table: it is an
 * inventory-denial attack that can take a merchant's entire catalogue to zero
 * available units, and every held unit is a real sale the merchant cannot
 * make until the holds are unwound by hand.
 *
 * 10 leaves room for a shopper who retries a timing-out submit several times
 * and then orders again from a second device.
 */
export const orderPlacementLimiter: RateLimiter = createLimiter({
  prefix: "rl:order",
  tokens: 10,
  window: "5 m",
  surface: "order placement",
});

/**
 * Payment-claim submission (`submitPaymentClaim`).
 *
 * 5 per 10 minutes, keyed by the ORDER's tracking-token hash rather than by
 * IP — callers apply an IP bucket as well, and the two answer different
 * questions. Keying on the order caps resubmission spam against one order
 * (D-11 makes a rejected claim resubmittable, so "submit again" is a
 * legitimate and repeatable action) without punishing a shared NAT: in Douala
 * a whole neighbourhood can egress from one address, and an IP-only budget
 * here would let one abusive claimant lock out every other customer on the
 * same connection.
 *
 * The key is the token HASH, never the plaintext token: the plaintext is what
 * a link-holder possesses, and it must not become an Upstash key that outlives
 * the request (T-03-05).
 */
export const claimSubmissionLimiter: RateLimiter = createLimiter({
  prefix: "rl:claim",
  tokens: 5,
  window: "10 m",
  surface: "payment claim submission",
});

/**
 * Order tracking lookup (the customer's `/track/[token]` read).
 *
 * 60 per minute per caller IP — much looser, because this is a READ that a
 * legitimately anxious customer refreshes repeatedly while waiting for a
 * merchant to confirm. It is not a credential-stuffing surface; the token
 * space is a 256-bit hash preimage and is not walkable in practice. The limit
 * is here to blunt a scripted walk and to keep one client from turning a
 * refresh loop into a database load problem, not to be a security boundary.
 */
export const orderTrackingLimiter: RateLimiter = createLimiter({
  prefix: "rl:track",
  tokens: 60,
  window: "1 m",
  surface: "order tracking lookup",
});

/**
 * Presigned-upload mint for claim screenshots.
 *
 * 20 per 5 minutes per caller IP. This is the one upload path reachable with
 * NO account at all — a customer proving they paid attaches a screenshot —
 * so it is the only place an anonymous caller can cause the platform to mint
 * a credential against object storage. Each mint is cheap, but an unthrottled
 * mint endpoint is a free URL generator pointed at the project's R2 bucket.
 *
 * 20 rather than 5: a claim can carry more than one screenshot, and a failed
 * upload on a flaky connection legitimately re-mints.
 */
export const uploadPresignLimiter: RateLimiter = createLimiter({
  prefix: "rl:upload",
  tokens: 20,
  window: "5 m",
  surface: "claim screenshot upload presign",
});

/**
 * A single rate-limit record as Better Auth's storage contract shapes it:
 * the key it was stored under, how many requests have landed in the current
 * window, and when the most recent one was recorded.
 */
interface AuthRateLimitRecord {
  key: string;
  count: number;
  lastRequest: number;
}

/**
 * The Upstash-backed storage adapter behind Better Auth's
 * `rateLimit.customStorage` (RESEARCH.md Pattern 6, Code Example 7).
 *
 * `consume` is the ONLY member Better Auth's own built-in HTTP rate limiter
 * calls in the hot path (`api/rate-limiter/index.mjs`): it is documented as
 * "the atomic path", and the separate `get`/`set` fallback is Better Auth's
 * own words "best-effort under concurrency" — N simultaneous requests can
 * all pass a stale read before any increment lands
 * (`@better-auth/core/dist/types/init-options.d.mts:76-95`). `get`/`set` are
 * implemented for contract completeness (the type requires them) but are not
 * on the enforcement path this project relies on.
 *
 * Not built on `@upstash/ratelimit`'s `Ratelimit` class like the limiters
 * above: Better Auth owns the window/max PER PATH (its own `/sign-in*`
 * special rule is window 10s, max 3) and hands them to `consume` per call, so
 * this needs a raw atomic increment-with-expiry primitive keyed by whatever
 * Better Auth passes in, not a limiter pre-configured with one fixed rule.
 *
 * Mirrors the SAME degradation contract as every limiter above: when Upstash
 * is unconfigured, allow-all with one loud warning. Never an in-process
 * counter — the module header explains why that is dishonest rather than
 * weak, and it applies here with equal force.
 */
export const authRateLimitStorage = {
  async get(key: string): Promise<AuthRateLimitRecord | null> {
    const redis = getRedis();
    if (!redis) return null;

    try {
      const record = await redis.get<AuthRateLimitRecord>(
        `rl:auth:record:${key}`,
      );
      return record ?? null;
    } catch (error) {
      console.warn(
        "[rate-limit] rl:auth get transport failure; reporting no record.",
        error,
      );
      return null;
    }
  },

  async set(key: string, value: AuthRateLimitRecord): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
      // No window is passed to `set()`, so this uses a generous fixed TTL.
      // Harmless: `consume` below is what every enforced request actually
      // goes through, and it manages its own TTL per call.
      await redis.set(`rl:auth:record:${key}`, value, { ex: 300 });
    } catch (error) {
      console.warn(
        "[rate-limit] rl:auth set transport failure; the record was not persisted.",
        error,
      );
    }
  },

  async consume(
    key: string,
    rule: { window: number; max: number },
  ): Promise<{ allowed: boolean; retryAfter: number | null }> {
    const redis = getRedis();
    if (!redis) {
      console.warn(
        `[rate-limit] DEGRADED: rl:auth is allow-all. Missing ` +
          `UPSTASH_REDIS_REST_URL and/or UPSTASH_REDIS_REST_TOKEN. The login ` +
          `HTTP endpoint (an unauthenticated, CPU-bound surface) is ` +
          `unprotected. Acceptable in local development and in tests; never ` +
          `acceptable in production.`,
      );
      return { allowed: true, retryAfter: null };
    }

    const redisKey = `rl:auth:${key}`;
    try {
      // INCR + EXPIRE, the atomic path: the increment and the check happen in
      // one round trip, so no concurrent request can read a stale count.
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.expire(redisKey, rule.window);
      }

      if (count > rule.max) {
        const ttl = await redis.ttl(redisKey);
        return { allowed: false, retryAfter: ttl > 0 ? ttl : rule.window };
      }

      return { allowed: true, retryAfter: null };
    } catch (error) {
      // Fail OPEN, loudly — an Upstash blip must not take login offline.
      console.warn(
        "[rate-limit] rl:auth transport failure; allowing the request. " +
          "Merchant login is momentarily unthrottled.",
        error,
      );
      return { allowed: true, retryAfter: null };
    }
  },
};

/**
 * Bucket key for an anonymous caller.
 *
 * `x-forwarded-for` is a comma-separated chain and only the FIRST entry is the
 * client; the rest are proxies. On Vercel the header is set by the platform
 * edge, so the first entry is trustworthy there. Off-platform it is
 * client-controllable — which is a reason to keep the limits as a speed bump
 * rather than a security boundary, not a reason to skip them.
 *
 * The fallback is a single shared bucket rather than a per-request random key:
 * an unidentifiable caller must still be counted, and a random key would give
 * every such request its own fresh budget, silently disabling the limiter for
 * exactly the traffic that declined to identify itself.
 */
export function callerIp(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;

  return requestHeaders.get("x-real-ip")?.trim() || "unknown-caller";
}
