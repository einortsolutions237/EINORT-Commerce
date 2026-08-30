import "server-only";

import { Redis } from "@upstash/redis";

import { env } from "@/env";

/**
 * The `cart:` Redis namespace — and nothing else.
 *
 * This module owns exactly one key family. Constraint C-11 keeps the tenant
 * hostname, session, jobs and idempotency namespaces separate from this one and
 * owned by their own modules: `tenant:host:` belongs to
 * `src/server/tenant/cache.ts` and `idem:` belongs to the idempotency module.
 * Neither may be read or written from here, and `cart:` may not be read or
 * written from them. One module per namespace is what makes "which code can
 * evict a shopper's basket?" answerable by reading one file.
 *
 * The degradation contract is copied from `src/server/tenant/cache.ts`
 * deliberately, not by coincidence: unconfigured Upstash or a transport error
 * warns once per process and behaves as an empty cache. It never throws,
 * because a missing cache must add work, never take a storefront down. The
 * shopper loses persistence, not the shop.
 */

/** The opaque cookie that carries the cart id. It carries nothing else. */
export const CART_COOKIE_NAME = "einort_cart";

/** 30 days, per CLAUDE.md's guest-cart row. */
export const CART_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * The documented ceiling on a single line's quantity.
 *
 * It lives here rather than in `actions.ts` because it is a property of the
 * stored shape, not of one mutation: it is what bounds how large an abandoned
 * cart can grow (T-03-49, dispositioned `accept`) alongside the TTL. 99 is
 * comfortably beyond any real order on this market and small enough that a
 * scripted flood cannot inflate a blob meaningfully.
 */
export const CART_MAX_LINE_QUANTITY = 99;

/**
 * What a cart is, in full.
 *
 * Three non-negotiables, from 03-RESEARCH.md § Pattern 7:
 *
 *  1. **No money in the cart.** `{variantId, quantity}` only. Every displayed
 *     figure is recomputed from the database on render, and re-derived again at
 *     placement (TEN-08). A cart that carries a price IS a client-supplied
 *     price, because the cookie that points at it is under the shopper's
 *     control. There is deliberately no field here for one, and
 *     `tests/unit/cart.test.ts` asserts against the serialized bytes so the
 *     absence cannot be quietly reversed.
 *
 *  2. **The cart records its `tenantId`.** On read, the caller compares it to
 *     the host-resolved tenant and discards the cart on mismatch
 *     (`cartForTenant` below). Cheap, and it makes the cookie useless if it
 *     ever escapes its host scope (T-03-45).
 *
 *  3. **Redis degrades rather than throwing.** See the module header.
 *
 * `updatedAt` is epoch milliseconds. It is diagnostic only — nothing branches
 * on it — and exists so an operator staring at a Redis blob can tell a live
 * basket from one abandoned four weeks ago without waiting for the TTL.
 */
export type StoredCart = {
  tenantId: string;
  items: { variantId: string; quantity: number }[];
  updatedAt: number;
};

/** C-11: this module owns this prefix, and owns nothing else. */
const KEY_PREFIX = "cart:";

const keyFor = (cartId: string): string => `${KEY_PREFIX}${cartId}`;

/**
 * Memoized client resolution. `null` means "degraded — no cache configured".
 *
 * Memoizing the *decision* rather than just the client is what keeps the
 * degradation warning to one line per process instead of one per add-to-cart.
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
      `[cart-cache] DEGRADED: no guest cart persistence. Missing ${missing.join(
        " and ",
      )}. Adding to a basket will appear to work and the basket will be empty ` +
        `on the next request, because there is nowhere to put it. Acceptable ` +
        `in local development; never acceptable in production.`,
    );
    resolvedClient = { redis: null };
    return null;
  }

  resolvedClient = { redis: new Redis({ url, token }) };
  return resolvedClient.redis;
}

/**
 * Upstash deserializes JSON automatically on `get`, so a value written as a
 * JSON string comes back as an object; other transports hand back the raw
 * string. Accept both rather than depending on which is in play — guessing
 * wrong turns every hit into a silent miss, which looks exactly like a shopper
 * losing their basket for no reason.
 *
 * Validation is structural and exhaustive. A partly written or edited value
 * reads as *absent*, never as a half-cart: a line missing its quantity that
 * survived into the basket would reach `hydrateCart` and then placement, and
 * "reject the whole blob" is the only failure direction that cannot end in a
 * wrong order.
 */
function parseStoredCart(raw: unknown): StoredCart | null {
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
  const candidate = value as Partial<StoredCart>;

  if (typeof candidate.tenantId !== "string" || candidate.tenantId === "") {
    return null;
  }
  if (!Array.isArray(candidate.items)) return null;

  const items: StoredCart["items"] = [];
  for (const entry of candidate.items) {
    if (typeof entry !== "object" || entry === null) return null;
    const line = entry as Partial<StoredCart["items"][number]>;
    if (typeof line.variantId !== "string" || line.variantId === "") return null;
    if (typeof line.quantity !== "number" || !Number.isFinite(line.quantity)) {
      return null;
    }
    items.push({ variantId: line.variantId, quantity: line.quantity });
  }

  return {
    tenantId: candidate.tenantId,
    items,
    updatedAt:
      typeof candidate.updatedAt === "number" &&
      Number.isFinite(candidate.updatedAt)
        ? candidate.updatedAt
        : 0,
  };
}

/**
 * Read a cart by id, or `null`.
 *
 * Deliberately unopinionated about the tenant: the raw stored value comes back
 * as written, because only the caller knows which host resolved. Pair it with
 * `cartForTenant` — every caller in this codebase does.
 *
 * Fails toward "no cart". A transport or parse error resolves to `null` so the
 * shopper sees an empty basket rather than a 500; the alternative is a cache
 * outage taking down every storefront at once.
 */
export async function readStoredCart(
  cartId: string,
): Promise<StoredCart | null> {
  if (!cartId) return null;

  const redis = getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get<unknown>(keyFor(cartId));
    return parseStoredCart(raw);
  } catch (error) {
    console.warn(
      `[cart-cache] read failed for ${keyFor(cartId)}; treating the basket as empty.`,
      error,
    );
    return null;
  }
}

/** Persist a cart for `CART_TTL_SECONDS`. Never throws. */
export async function writeStoredCart(
  cartId: string,
  cart: StoredCart,
): Promise<void> {
  if (!cartId) return;

  const redis = getRedis();
  if (!redis) return;

  // Rebuilt field by field rather than spread, so an extra key a caller
  // happened to be carrying — anything at all resembling a client-supplied
  // figure — cannot reach Redis and be read back as if the server had put it
  // there (TEN-08).
  const entry: StoredCart = {
    tenantId: cart.tenantId,
    items: cart.items.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
    })),
    updatedAt: cart.updatedAt,
  };

  try {
    await redis.set(keyFor(cartId), JSON.stringify(entry), {
      ex: CART_TTL_SECONDS,
    });
  } catch (error) {
    console.warn(`[cart-cache] write failed for ${keyFor(cartId)}.`, error);
  }
}

/**
 * Drop a cart.
 *
 * Swallows transport errors like the read and write paths do — unlike
 * `invalidateTenantHost`, which must not, because a failed tenant eviction
 * keeps a suspended store serving. Nothing comparable is at stake here: a cart
 * that outlives its order expires on its own within 30 days and is discarded on
 * read anyway once its order has been placed.
 */
export async function clearStoredCart(cartId: string): Promise<void> {
  if (!cartId) return;

  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(keyFor(cartId));
  } catch (error) {
    console.warn(`[cart-cache] delete failed for ${keyFor(cartId)}.`, error);
  }
}

/**
 * The tenant guard (T-03-45), as one pure function so both the mutation path
 * and the read path apply exactly the same rule.
 *
 * A cart whose `tenantId` is not the host-resolved tenant is not "someone
 * else's cart to be merged" — it is not a cart at all on this store, and it
 * reads as empty. The cookie is host-scoped so this should be unreachable; it
 * is here because "should be unreachable" is not a security property and the
 * comparison costs one string equality.
 */
export function cartForTenant(
  cart: StoredCart | null,
  tenantId: string,
): StoredCart | null {
  if (!cart) return null;
  return cart.tenantId === tenantId ? cart : null;
}
