import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * D-12 / T-03-70 / T-03-74 — the tracking lookup, against a real Postgres.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS AN ISOLATION TEST AND NOT A UNIT TEST.
 * ---------------------------------------------------------------------------
 * The two claims this file exists to prove are both properties of the DATABASE,
 * not of the function body:
 *
 *   - a token that is genuinely valid for tenant A resolves to nothing under
 *     tenant B, because `scopedDb` rewrote the query and not because the
 *     function compared two strings afterwards;
 *   - two tenants CANNOT hold the same `trackingTokenHash`, because the schema
 *     carries a GLOBAL unique index on it — which is the property that makes a
 *     tenant-scoped equality read on a digest unambiguous in the first place.
 *
 * Neither survives a mocked client. A unit test would restate the function's
 * own logic back to itself and pass on the day someone drops the `scopedDb`
 * wrapper for a raw read.
 *
 * ---------------------------------------------------------------------------
 * `scopedDb` IS WRAPPED, NOT REPLACED.
 * ---------------------------------------------------------------------------
 * The mock below counts calls and then hands straight back to the real client,
 * so every assertion still runs against the real branch. The count is what lets
 * this file prove the ONE thing that is genuinely internal: a malformed token
 * never reaches Postgres. That is an anti-load property (a scripted walk of the
 * token space must not cost a query per guess), and it is invisible from the
 * outside because the answer — `null` — is identical either way.
 */

const { scopedCalls } = vi.hoisted(() => ({ scopedCalls: { count: 0 } }));

vi.mock("@/server/db/tenant-scoped", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/db/tenant-scoped")>();
  return {
    ...actual,
    scopedDb: (tenantId: string) => {
      scopedCalls.count += 1;
      return actual.scopedDb(tenantId);
    },
  };
});

// Imported after the mock so the module under test picks up the wrapper.
const { findOrderByTrackingToken } = await import("@/server/orders/tracking");
const { hashTrackingToken, mintTrackingToken } = await import(
  "@/server/orders/tracking-token"
);
const { scopedDb } = await import("@/server/db/tenant-scoped");
const { openOrderAtGenesis } = await import("@/server/orders/transition");

/**
 * One real token per tenant, minted rather than typed.
 *
 * `seedTwoTenants` gives each fixture order a placeholder digest derived from
 * its tenant id — enough to satisfy the global unique index, but not the hash
 * of any token that exists. So this file mints two real ones and re-stamps the
 * seeded orders with their true digests, which is the only way the "valid token
 * for A" case is testing the hash lookup rather than a string coincidence.
 */
const TOKEN_A = mintTrackingToken();
const TOKEN_B = mintTrackingToken();

/** Minted, never stored — the unknown-but-well-formed case. */
const TOKEN_UNKNOWN = mintTrackingToken();

const ORDER_A = `${TENANT_A.id}-order-1`;
const ORDER_B = `${TENANT_B.id}-order-1`;

beforeAll(async () => {
  await seedTwoTenants();

  await scopedDb(TENANT_A.id).order.update({
    where: { id: ORDER_A },
    data: { trackingTokenHash: hashTrackingToken(TOKEN_A) },
  });
  await scopedDb(TENANT_B.id).order.update({
    where: { id: ORDER_B },
    data: { trackingTokenHash: hashTrackingToken(TOKEN_B) },
  });
});

beforeEach(() => {
  scopedCalls.count = 0;
});

describe("the token opens exactly one order in exactly one tenant", () => {
  it("resolves tenant A's order for tenant A's token", async () => {
    const order = await findOrderByTrackingToken(TENANT_A.id, TOKEN_A);

    expect(
      order,
      "A valid tracking token did not open its own order. The customer's only " +
        "route to their order is this lookup; if it misses, the link they were " +
        "given is dead and there is no second way in (D-12).",
    ).not.toBeNull();
    expect(order?.id).toBe(ORDER_A);
    expect(order?.orderNumber).toBe(`${TENANT_A.slug}-0001`);
    expect(order?.items.length).toBeGreaterThan(0);
  });

  it("resolves nothing for the SAME token under tenant B (T-03-74)", async () => {
    const order = await findOrderByTrackingToken(TENANT_B.id, TOKEN_A);

    expect(
      order,
      "Tenant A's tracking token opened an order while the request was scoped " +
        "to tenant B.\n" +
        "  This is a cross-tenant read of a customer's name, phone and order " +
        "total. The digest is unique platform-wide, so a lookup that is not " +
        "tenant-bound WILL find another store's row — the scoping is the only " +
        "thing standing between the two, and it must live in the query rather " +
        "than in a comparison after it.",
    ).toBeNull();
  });

  it("resolves nothing for a well-formed token nobody was ever issued", async () => {
    const order = await findOrderByTrackingToken(TENANT_A.id, TOKEN_UNKNOWN);

    expect(order).toBeNull();
    // The shape check passes, so this one is SUPPOSED to reach the database:
    // an unknown digest is indistinguishable from a foreign one only because
    // both are answered by the same empty read.
    expect(
      scopedCalls.count,
      "A well-formed unknown token did not reach the database, which means " +
        "the shape check is rejecting tokens this system actually mints.",
    ).toBe(1);
  });
});

describe("a malformed token is answered without a query", () => {
  /*
   * Every one of these is `null`, and none of them costs a round trip. The
   * strings are the realistic shapes: an empty segment, a near-miss on length,
   * a base64 (not base64url) alphabet, and the two traversal attempts a scanner
   * puts in a path segment by reflex.
   */
  const MALFORMED = [
    "",
    "short",
    "a".repeat(31),
    "a".repeat(33),
    `${"a".repeat(30)}+/`,
    `${"a".repeat(30)}==`,
    "../../etc/passwd",
    "..%2F..%2Fetc%2Fpasswd",
    "' OR 1=1 --",
    `${"a".repeat(31)} `,
  ];

  it.each(MALFORMED)("resolves null for %j and issues no query", async (raw) => {
    const order = await findOrderByTrackingToken(TENANT_A.id, raw);

    expect(order).toBeNull();
    expect(
      scopedCalls.count,
      `A malformed token (${JSON.stringify(raw)}) reached Postgres. A token ` +
        "that cannot have been minted by this system is not worth a query — " +
        "answering it from the shape alone is what keeps a scripted walk of " +
        "the token space from costing a database read per guess (T-03-70).",
    ).toBe(0);
  });

  it("survives a non-string token without surfacing a failure", async () => {
    // The path segment is typed `string`, but this function is the access
    // control for an anonymous surface and a `null` answer must be the ONLY
    // answer it can give — including when a future caller hands it something
    // Next decoded into a shape TypeScript did not predict.
    const order = await findOrderByTrackingToken(
      TENANT_A.id,
      undefined as unknown as string,
    );

    expect(order).toBeNull();
    expect(scopedCalls.count).toBe(0);
  });
});

describe("the digest never travels back out", () => {
  it("omits trackingTokenHash from the resolved order", async () => {
    const order = await findOrderByTrackingToken(TENANT_A.id, TOKEN_A);

    expect(order).not.toBeNull();
    expect(
      Object.keys(order as object),
      "The resolved order carries trackingTokenHash.\n" +
        "  This value is rendered by a Server Component, so a key in the " +
        "returned object is a key in the serialised HTML that ships to the " +
        "browser. Nothing on the tracking page needs the digest; select only " +
        "what 03-UI-SPEC.md § B7 draws.",
    ).not.toContain("trackingTokenHash");
  });
});

describe("the global unique index is what makes the lookup safe", () => {
  it("refuses the same trackingTokenHash in a second tenant (T-03-05)", async () => {
    const shared = hashTrackingToken(mintTrackingToken());

    await scopedDb(TENANT_A.id).$transaction((tx) =>
      openOrderAtGenesis(tx, {
        orderNumber: `${TENANT_A.slug}-collide`,
        channel: "MANUAL_TRANSFER",
        customerName: "Collision Customer",
        customerPhone: "237600000011",
        deliveryAddress: null,
        customerNote: null,
        subtotalXaf: 1000,
        totalXaf: 1000,
        trackingTokenHash: shared,
        stockHeld: false,
        actor: "CUSTOMER",
      }),
    );

    await expect(
      scopedDb(TENANT_B.id).$transaction((tx) =>
        openOrderAtGenesis(tx, {
          orderNumber: `${TENANT_B.slug}-collide`,
          channel: "MANUAL_TRANSFER",
          customerName: "Collision Customer",
          customerPhone: "237600000012",
          deliveryAddress: null,
          customerNote: null,
          subtotalXaf: 1000,
          totalXaf: 1000,
          trackingTokenHash: shared,
          stockHeld: false,
          actor: "CUSTOMER",
        }),
      ),
      "Two tenants were allowed to hold the same trackingTokenHash.\n" +
        "  The @@unique([trackingTokenHash]) on Order is GLOBAL on purpose. " +
        "Without it a digest could name two rows, and a tenant-scoped equality " +
        "read on it would be a coin flip rather than an answer — which is " +
        "exactly the ambiguity findOrderByTrackingToken relies on being " +
        "impossible.",
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
