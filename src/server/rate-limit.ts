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
 * are `rl:slugcheck` and `rl:signup`, and they are the key namespace of this
 * module the way `tenant:host:` is `src/server/tenant/cache.ts`'s (C-11).
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
