import { afterEach, describe, expect, it, vi } from "vitest";

import { hashTrackingToken, mintTrackingToken } from "@/server/orders/tracking-token";

/**
 * D-12 / T-03-38 — the customer-facing order key, and the `idem:` namespace
 * that stops a double-tap becoming two orders.
 *
 * WHY THE IDEMPOTENCY CASES LIVE IN THIS FILE. 03-07-PLAN.md Task 1 asks for
 * them here *if* Upstash can be stubbed without a network call, and it can:
 * `src/server/idempotency/cache.ts` reaches Redis through exactly two seams —
 * `@/env` for the credentials and `@upstash/redis` for the client — and both
 * are replaceable with `vi.doMock` before a fresh dynamic import. So the two
 * behaviours that matter (SET NX semantics, and the degraded no-credentials
 * path) are proved here with no socket opened and nothing skipped. What a real
 * Redis would add is confidence in Upstash's own `nx` implementation, which is
 * not this repository's property to test.
 *
 * The token half needs no stubbing at all: `tracking-token.ts` imports
 * `node:crypto` and nothing else, on purpose, so it stays loadable by the
 * database-free `unit` project.
 */

// ---------------------------------------------------------------------------
// The tracking token
// ---------------------------------------------------------------------------

describe("mintTrackingToken", () => {
  it("returns 32 base64url characters and nothing that needs escaping", () => {
    // 24 random bytes encode to exactly 32 base64url characters with no
    // padding. The character-class assertion is the load-bearing half: the
    // token travels in a URL path segment, so a `+`, `/` or `=` from plain
    // base64 would have to be percent-encoded somewhere and would eventually
    // be decoded somewhere else.
    for (let i = 0; i < 50; i++) {
      expect(mintTrackingToken()).toMatch(/^[A-Za-z0-9_-]{32}$/);
    }
  });

  it("does not repeat itself across a thousand mints", () => {
    const minted = new Set<string>();
    for (let i = 0; i < 1000; i++) minted.add(mintTrackingToken());

    // A collision here would not be bad luck — 192 bits of entropy makes that
    // impossible in a thousand draws — it would mean the generator is not
    // actually random, which is the failure that turns a bearer credential
    // into a guessable one.
    expect(minted.size).toBe(1000);
  });
});

describe("hashTrackingToken", () => {
  it("returns 64 lowercase hex characters", () => {
    expect(hashTrackingToken(mintTrackingToken())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic, because the lookup is an indexed equality read", () => {
    const token = mintTrackingToken();

    // This is why the hash is deliberately unsalted. A per-row salt would make
    // "find the order for this token" a table scan, and there is no dictionary
    // to defend against when the input already carries 192 bits of entropy.
    expect(hashTrackingToken(token)).toBe(hashTrackingToken(token));
  });

  it("maps different tokens to different digests", () => {
    const digests = new Set<string>();
    for (let i = 0; i < 200; i++) digests.add(hashTrackingToken(mintTrackingToken()));

    expect(digests.size).toBe(200);
  });

  it("never returns its input", () => {
    // `trackingTokenHash` is under a GLOBAL unique index and is the only form
    // of the token that is ever persisted. An identity function here would put
    // the plaintext bearer credential in a column, which is precisely the
    // disclosure the hash exists to prevent (T-03-38).
    const token = mintTrackingToken();
    expect(hashTrackingToken(token)).not.toBe(token);
  });
});

// ---------------------------------------------------------------------------
// The `idem:` namespace
// ---------------------------------------------------------------------------

/**
 * A Redis stand-in that implements exactly the two calls the cache makes.
 *
 * Deliberately not a full fake: it honours `nx` and `ex` and nothing else, so
 * a future call to some other Redis command fails loudly here instead of
 * quietly succeeding against a permissive mock.
 */
class FakeRedis {
  static store = new Map<string, string>();
  static failNext = false;

  static reset(): void {
    FakeRedis.store.clear();
    FakeRedis.failNext = false;
  }

  set(
    key: string,
    value: string,
    options?: { nx?: boolean; ex?: number },
  ): Promise<"OK" | null> {
    if (FakeRedis.failNext) return Promise.reject(new Error("transport down"));
    if (options?.nx && FakeRedis.store.has(key)) return Promise.resolve(null);
    FakeRedis.store.set(key, value);
    return Promise.resolve("OK");
  }

  get(key: string): Promise<string | null> {
    if (FakeRedis.failNext) return Promise.reject(new Error("transport down"));
    return Promise.resolve(FakeRedis.store.get(key) ?? null);
  }
}

type IdempotencyCache = typeof import("@/server/idempotency/cache");

/** Load a fresh copy of the cache module against a chosen environment. */
async function loadCache(configured: boolean): Promise<IdempotencyCache> {
  // `resetModules` is what makes the module's one-shot client memoization (and
  // therefore its one-warning-per-process degradation notice) a per-test fact
  // rather than a per-run one.
  vi.resetModules();
  vi.doMock("@/env", () => ({
    env: {
      UPSTASH_REDIS_REST_URL: configured ? "https://fake.upstash.io" : undefined,
      UPSTASH_REDIS_REST_TOKEN: configured ? "fake-token" : undefined,
    },
  }));
  vi.doMock("@upstash/redis", () => ({ Redis: FakeRedis }));
  return (await import("@/server/idempotency/cache")) as IdempotencyCache;
}

afterEach(() => {
  FakeRedis.reset();
  vi.doUnmock("@/env");
  vi.doUnmock("@upstash/redis");
  vi.restoreAllMocks();
});

describe("the idem: namespace, configured", () => {
  it("returns null for a key nobody has claimed", async () => {
    const cache = await loadCache(true);
    expect(await cache.recallOrderForKey("never-seen")).toBeNull();
  });

  it("lets exactly one caller win a key (SET NX)", async () => {
    const cache = await loadCache(true);

    // The realistic cause is not an attack: it is one shopper on a slow Douala
    // connection tapping "Place order" twice. The first tap wins the key and
    // creates the order; the second must be told it lost and shown the order
    // the first one made.
    expect(await cache.rememberOrderForKey("checkout-1", "order-a")).toBe(true);
    expect(await cache.rememberOrderForKey("checkout-1", "order-b")).toBe(false);

    expect(await cache.recallOrderForKey("checkout-1")).toBe("order-a");
  });

  it("keeps distinct checkout keys independent", async () => {
    const cache = await loadCache(true);

    expect(await cache.rememberOrderForKey("checkout-1", "order-a")).toBe(true);
    expect(await cache.rememberOrderForKey("checkout-2", "order-b")).toBe(true);

    expect(await cache.recallOrderForKey("checkout-2")).toBe("order-b");
  });

  it("treats a transport failure as an unseen key rather than an outage", async () => {
    const cache = await loadCache(true);
    FakeRedis.failNext = true;

    // Degraded idempotency lets a double-submit create two orders. A Redis blip
    // taking checkout offline loses every order. The first is recoverable by a
    // merchant; the second is not.
    await expect(
      cache.rememberOrderForKey("checkout-3", "order-c"),
    ).resolves.toBe(true);
    await expect(cache.recallOrderForKey("checkout-3")).resolves.toBeNull();
  });
});

describe("the idem: namespace, unconfigured", () => {
  it("degrades to no idempotency and never throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const cache = await loadCache(false);

    expect(await cache.rememberOrderForKey("checkout-4", "order-d")).toBe(true);
    expect(await cache.rememberOrderForKey("checkout-4", "order-e")).toBe(true);
    expect(await cache.recallOrderForKey("checkout-4")).toBeNull();

    // Loud, once. A no-cache configuration reaching production unnoticed is the
    // failure mode a silent degradation has.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("DEGRADED");
  });
});
