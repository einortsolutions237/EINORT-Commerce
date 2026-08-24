import "server-only";

import { Redis } from "@upstash/redis";

import { env } from "@/env";

/**
 * The `idem:` Redis namespace — and nothing else (C-11).
 *
 * ---------------------------------------------------------------------------
 * ONE MODULE, ONE PREFIX. THIS ONE OWNS `idem:`.
 * ---------------------------------------------------------------------------
 * Constraint C-11 gives every Redis key family exactly one owning module. The
 * hostname-resolution family belongs to `src/server/tenant/cache.ts`, the guest
 * cart and the rate-limit counters to their own modules, and none of those may
 * be read or written from here — nor `idem:` from them. The property that buys
 * is that "which code can expire a checkout's idempotency key?" is answerable
 * by reading one file, which is not true of a shared Redis helper.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS FOR.
 * ---------------------------------------------------------------------------
 * One shopper, one slow connection, two taps on "Place order". Without a claim
 * on a key the second tap runs the whole placement again: stock decremented
 * twice, two orders, two genesis events, and a merchant who has to work out
 * which one is real. The client generates its key ONCE per checkout-page mount
 * — not per submit — so the retry carries the same key as the attempt it is
 * retrying (03-RESEARCH.md Pattern 7b). A per-submit key would be a fresh key
 * every tap and would make this module decorative.
 *
 * ---------------------------------------------------------------------------
 * DEGRADATION IS DELIBERATE, AND HONEST ABOUT ITS COST.
 * ---------------------------------------------------------------------------
 * With no credentials, or with the transport down, every call behaves as though
 * the key had never been seen: `rememberOrderForKey` says the caller won and
 * `recallOrderForKey` says it knows nothing. Checkout then proceeds with NO
 * idempotency, and a double-submit in that window really can create two orders.
 *
 * That is the intended trade. Two orders is a mess one merchant can cancel; a
 * Redis blip that fails checkout closed loses every sale on the platform for
 * the duration, and it does so at the exact moment the merchant is least able
 * to do anything about it. The 600-second TTL bounds the exposure in the other
 * direction — a key cannot outlive the checkout it belongs to by long enough to
 * shadow a genuinely new order.
 *
 * The degradation is LOUD. Silence is how a no-cache configuration reaches
 * production unnoticed, so the missing-credentials path warns once per process
 * and names what stopped working.
 */

/** C-11: this module owns this prefix, and owns nothing else. */
const KEY_PREFIX = "idem:";

const keyFor = (clientKey: string): string => `${KEY_PREFIX}${clientKey}`;

/**
 * 600 seconds.
 *
 * Long enough to cover a retry on a bad connection plus the time a shopper
 * spends staring at a spinner, short enough that a key cannot linger into a
 * later, genuinely separate checkout from the same page. It is a bound on how
 * wrong this can be, not a cache-warming decision.
 */
const TTL_SECONDS = 600;

/**
 * Memoized client resolution. `null` means "degraded — no idempotency".
 *
 * The DECISION is memoized rather than just the client, which is what keeps the
 * degradation notice to one line per process instead of one per checkout.
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
      `[idempotency] DEGRADED: order placement is not idempotent. Missing ` +
        `${missing.join(" and ")}. A double-submitted checkout will create ` +
        `two orders, each holding its own stock. Acceptable in local ` +
        `development; never acceptable in production.`,
    );
    resolvedClient = { redis: null };
    return null;
  }

  resolvedClient = { redis: new Redis({ url, token }) };
  return resolvedClient.redis;
}

/**
 * Claim `clientKey` for `orderId`, returning whether this caller won it.
 *
 * `SET idem:{key} {orderId} NX EX 600`. `NX` is the whole mechanism: the write
 * and the "was it already there?" check are ONE Redis command, so two
 * simultaneous submits cannot both read "absent" and both proceed. A
 * `GET`-then-`SET` here would be the same race this function exists to close,
 * moved one layer up and made harder to see.
 *
 * Returns `true` when degraded, because the caller's correct behaviour in that
 * case is to place the order. Failing closed would convert a cache outage into
 * a checkout outage.
 */
export async function rememberOrderForKey(
  clientKey: string,
  orderId: string,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;

  try {
    const result = await redis.set(keyFor(clientKey), orderId, {
      nx: true,
      ex: TTL_SECONDS,
    });
    return result === "OK";
  } catch (error) {
    console.warn(
      `[idempotency] claim failed for ${keyFor(clientKey)}; proceeding ` +
        `without idempotency for this placement.`,
      error,
    );
    return true;
  }
}

/**
 * The order a previous submit created under `clientKey`, or `null`.
 *
 * Fails OPEN toward "unseen" on every error path, for the same reason the claim
 * above fails open toward "you won": a cache that cannot be read must add work,
 * never remove the ability to buy. The caller uses this to show the losing
 * submit the order the winning one made, so a `null` here degrades the
 * experience (a confusing second attempt) rather than the correctness of
 * anything already committed.
 */
export async function recallOrderForKey(
  clientKey: string,
): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const value = await redis.get<unknown>(keyFor(clientKey));
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch (error) {
    console.warn(
      `[idempotency] read failed for ${keyFor(clientKey)}; treating the key ` +
        `as unseen.`,
      error,
    );
    return null;
  }
}
