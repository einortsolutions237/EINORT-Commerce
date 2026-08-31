import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Prisma } from "@/generated/prisma/client";

import {
  seedTwoTenants,
  TENANT_A,
  TENANT_B,
  type TenantFixture,
} from "../setup/seed-two-tenants";

/**
 * CHK-04 / ORD-02 / ORD-04 / D-11 / D-13 against a real Postgres — the
 * customer's half of the payment-claim loop.
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY ONE OF THESE NEEDS A REAL DATABASE.
 * ---------------------------------------------------------------------------
 * The three properties this file exists to prove are all properties of the
 * SCHEMA, not of the function body:
 *
 *   - ORD-04 is `@@unique([tenantId, referenceNormalized])`. A mocked client
 *     would prove that `submitClaim` catches an error nobody raised.
 *   - The per-tenant half of ORD-04 is the composite key. A test that only
 *     showed the duplicate refused would pass identically against a GLOBAL
 *     index — and a global one is a real bug, because two unrelated Cameroonian
 *     merchants can legitimately receive references that normalise the same.
 *   - D-11's re-hold is a conditional `updateMany` whose `WHERE` is evaluated by
 *     Postgres at write time. Overselling is prevented by the database or not
 *     at all.
 *
 * `tests/isolation/claims.test.ts` already covers the MERCHANT side of the same
 * loop (confirm, reject, reopen) and the cross-tenant claim-id case; this file
 * complements it from the submission side and does not repeat it.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS SUBSTITUTED, AND WHY IT IS ONLY THESE TWO THINGS.
 * ---------------------------------------------------------------------------
 * `next/headers` and `next/server` are Next request-scope APIs with no request
 * to be scoped to here. `headers()` becomes a fixed `Headers`, and `after()`
 * becomes a collector the tests drain explicitly — which is strictly better
 * than a no-op, because it lets this file assert the D-13 degradation instead
 * of merely not exercising it.
 *
 * Nothing else is mocked. `resolveTenantBySlug`, `scopedDb`, the rate limiters,
 * `transitionOrder` and the stock primitives are all the production modules.
 */

// ---------------------------------------------------------------------------
// Next request-scope stand-ins
// ---------------------------------------------------------------------------

const { requestContext } = vi.hoisted(() => ({
  requestContext: { headers: new Headers({ "x-forwarded-for": "203.0.113.77" }) },
}));

vi.mock("next/headers", () => ({
  headers: async () => requestContext.headers,
}));

const { deferred } = vi.hoisted(() => ({
  deferred: { tasks: [] as (() => unknown)[] },
}));

/**
 * `after()` collected rather than dropped.
 *
 * The whole module is replaced rather than partially mocked: `submitClaim` uses
 * exactly one export from it, and loading the real `next/server` into a Node
 * test process pulls in server internals this suite has no use for.
 */
vi.mock("next/server", () => ({
  after: (task: () => unknown) => {
    deferred.tasks.push(task);
  },
}));

/** Run whatever the last submission deferred, and report how much there was. */
async function drainDeferred(): Promise<number> {
  const pending = deferred.tasks.splice(0);
  for (const task of pending) await task();
  return pending.length;
}

// Imported after the mocks so the modules under test pick them up.
const { submitClaim } = await import("@/server/claims/submit");
const { scopedCreateData, scopedDb } = await import(
  "@/server/db/tenant-scoped"
);
const { openOrderAtGenesis, transitionOrder } = await import(
  "@/server/orders/transition"
);
const { releaseStock } = await import("@/server/orders/stock");
const { hashTrackingToken, mintTrackingToken } = await import(
  "@/server/orders/tracking-token"
);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let counter = 0;

interface OrderFixture {
  readonly orderId: string;
  /** The PLAINTEXT token. Only the digest is ever stored (D-12). */
  readonly token: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly totalXaf: number;
}

/**
 * A MANUAL_TRANSFER order sitting in `PAYMENT_PENDING` with its stock genuinely
 * held, plus the plaintext tracking token that opens it.
 *
 * Built through `openOrderAtGenesis` and `transitionOrder` rather than by
 * inserting a row directly, so the fixture cannot construct a state the
 * production code could not reach.
 */
async function pendingTransferOrder(
  tenant: TenantFixture,
  options: { shelf?: number; quantity?: number } = {},
): Promise<OrderFixture> {
  counter += 1;
  const quantity = options.quantity ?? 1;
  const shelf = options.shelf ?? 10;
  const db = scopedDb(tenant.id);

  const product = await db.product.create({
    data: scopedCreateData<Prisma.ProductUncheckedCreateInput>({
      name: `Submission Product ${counter}`,
      slug: `submission-product-${counter}`,
      description: null,
      basePriceXaf: 5000,
      active: true,
      option1Name: null,
      option2Name: null,
      categoryId: null,
    }),
    select: { id: true },
  });

  const variant = await db.productVariant.create({
    data: scopedCreateData<Prisma.ProductVariantUncheckedCreateInput>({
      productId: product.id,
      option1Value: "",
      option2Value: "",
      priceXaf: null,
      // Already decremented by the notional placement below: the order holds
      // `quantity` units, so the shelf shows `shelf` and the hold is real.
      stock: shelf,
      sku: null,
      active: true,
    }),
    select: { id: true },
  });

  const token = mintTrackingToken();

  const order = await db.$transaction((tx) =>
    openOrderAtGenesis(tx, {
      orderNumber: `cs-${tenant.slug}-${counter}`,
      channel: "MANUAL_TRANSFER",
      customerName: "Submission Customer",
      customerPhone: "237600000030",
      deliveryAddress: null,
      customerNote: null,
      subtotalXaf: 5000 * quantity,
      totalXaf: 5000 * quantity,
      trackingTokenHash: hashTrackingToken(token),
      stockHeld: true,
      actor: "CUSTOMER",
    }),
  );

  await db.orderItem.createMany({
    data: [
      scopedCreateData<Prisma.OrderItemCreateManyInput>({
        orderId: order.id,
        productId: product.id,
        variantId: variant.id,
        productName: `Submission Product ${counter}`,
        variantLabel: "Default",
        unitPriceXaf: 5000,
        quantity,
        lineTotalXaf: 5000 * quantity,
        imageKey: null,
      }),
    ],
  });

  await db.$transaction((tx) =>
    transitionOrder(tx, {
      orderId: order.id,
      to: "PAYMENT_PENDING",
      actor: "SYSTEM",
    }),
  );

  return {
    orderId: order.id,
    token,
    variantId: variant.id,
    quantity,
    totalXaf: 5000 * quantity,
  };
}

/**
 * The merchant's rejection, performed without a session.
 *
 * Deliberately NOT a call to `rejectClaim`: that action is a `merchantAction`
 * and would drag a whole Better Auth sign-up into a file about the customer's
 * side. The three writes below are exactly what it performs, and
 * `tests/isolation/claims.test.ts` is where the action itself is proved.
 */
async function rejectLatestClaim(
  tenant: TenantFixture,
  orderId: string,
  reason: string,
): Promise<void> {
  const db = scopedDb(tenant.id);
  const claim = await db.paymentClaim.findFirstOrThrow({
    where: { orderId },
    orderBy: { submittedAt: "desc" },
    select: { id: true },
  });

  await db.$transaction(async (tx) => {
    await tx.paymentClaim.update({
      where: { id: claim.id },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedByUserId: tenant.userId,
      },
    });
    await transitionOrder(tx, {
      orderId,
      to: "DISPUTED",
      actor: "MERCHANT",
      actorUserId: tenant.userId,
      reason,
    });
    await releaseStock(tx, orderId);
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

function readOrder(tenantId: string, orderId: string) {
  return scopedDb(tenantId).order.findUniqueOrThrow({
    where: { id: orderId },
    select: { state: true, stockHeld: true, confirmedAt: true },
  });
}

function readClaims(tenantId: string, orderId: string) {
  return scopedDb(tenantId).paymentClaim.findMany({
    where: { orderId },
    orderBy: { submittedAt: "asc" },
    select: {
      reference: true,
      referenceNormalized: true,
      amountClaimedXaf: true,
      operator: true,
      screenshotKey: true,
      status: true,
    },
  });
}

function readEvents(tenantId: string, orderId: string) {
  return scopedDb(tenantId).orderEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    select: { toState: true, actor: true, actorUserId: true },
  });
}

async function readStock(tenantId: string, variantId: string): Promise<number> {
  const variant = await scopedDb(tenantId).productVariant.findUniqueOrThrow({
    where: { id: variantId },
    select: { stock: true },
  });
  return variant.stock;
}

beforeAll(async () => {
  await seedTwoTenants();
});

beforeEach(() => {
  deferred.tasks.length = 0;
});

// ---------------------------------------------------------------------------

describe("CHK-04 — a link-holder can say they have paid", () => {
  it("writes one PENDING claim, moves the order and names the CUSTOMER once", async () => {
    const order = await pendingTransferOrder(TENANT_A);
    const eventsBefore = (await readEvents(TENANT_A.id, order.orderId)).length;

    const result = await submitClaim({
      slug: TENANT_A.slug,
      token: order.token,
      operator: "MTN_MOMO",
      reference: "MP 250101.1111.A11111",
      screenshotKey: null,
    });

    expect(result).toEqual({ ok: true });

    const claims = await readClaims(TENANT_A.id, order.orderId);
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({
      status: "PENDING",
      operator: "MTN_MOMO",
      // Stored exactly as typed — this is what the merchant compares against
      // their own SMS receipt — beside the normalised key ORD-04 constrains.
      reference: "MP 250101.1111.A11111",
      referenceNormalized: "MP2501011111A11111",
      screenshotKey: null,
    });

    expect((await readOrder(TENANT_A.id, order.orderId)).state).toBe(
      "PAYMENT_CLAIMED",
    );

    const events = await readEvents(TENANT_A.id, order.orderId);
    expect(
      events.length,
      "A claim submission wrote something other than exactly one OrderEvent. " +
        "ORD-05's audit trail is only readable if one move is one row.",
    ).toBe(eventsBefore + 1);
    expect(events.at(-1)).toMatchObject({
      toState: "PAYMENT_CLAIMED",
      actor: "CUSTOMER",
      actorUserId: null,
    });
  });

  it("takes the claimed amount from the order, never from the payload (T-03-79)", async () => {
    const order = await pendingTransferOrder(TENANT_A, { quantity: 3 });

    const result = await submitClaim({
      slug: TENANT_A.slug,
      token: order.token,
      operator: "MTN_MOMO",
      reference: "MP-250101-2222-B22222",
      screenshotKey: null,
      // Every shape a forged amount could arrive in. The schema has no such
      // field, so none of them is even parsed — which is the point: a value
      // that cannot be received cannot later grow a tolerance.
      amountClaimedXaf: 1,
      amount: 1,
      totalXaf: 1,
    });

    expect(result).toEqual({ ok: true });

    const claims = await readClaims(TENANT_A.id, order.orderId);
    expect(
      claims[0]?.amountClaimedXaf,
      "The claimed amount did not come from the order total.\n" +
        "  The merchant's queue shows an amount-mismatch line when the claim " +
        "and the order disagree, and that comparison only means anything while " +
        "one side of it is the server's own number.",
    ).toBe(order.totalXaf);
  });

  it("discards a screenshot key that is not this tenant's own (T-03-23)", async () => {
    const order = await pendingTransferOrder(TENANT_A);

    const result = await submitClaim({
      slug: TENANT_A.slug,
      token: order.token,
      operator: "MTN_MOMO",
      reference: "MP-250101-3333-C33333",
      // Another tenant's prefix, in the exact shape the finalize route returns.
      screenshotKey: `tenants/${TENANT_B.id}/claims/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`,
    });

    expect(result).toEqual({ ok: true });

    const claims = await readClaims(TENANT_A.id, order.orderId);
    expect(
      claims[0]?.screenshotKey,
      "A client-supplied storage key was stored verbatim.\n" +
        "  The merchant's claims queue renders whatever key the row carries, so " +
        "a forged prefix is a cross-tenant read of another customer's payment " +
        "screenshot. The key is rebuilt from the resolved tenant; anything that " +
        "does not match what was rebuilt is dropped.",
    ).toBeNull();
  });
});

describe("ORD-04 — one reference, one claim, per store", () => {
  it("refuses a second spelling of the same reference and writes no row", async () => {
    const first = await pendingTransferOrder(TENANT_A);
    const second = await pendingTransferOrder(TENANT_A);

    await expect(
      submitClaim({
        slug: TENANT_A.slug,
        token: first.token,
        operator: "MTN_MOMO",
        reference: "MP-250101-4444-D44444",
        screenshotKey: null,
      }),
    ).resolves.toEqual({ ok: true });

    const duplicate = await submitClaim({
      slug: TENANT_A.slug,
      token: second.token,
      operator: "ORANGE_MONEY",
      // Mixed case, dots for hyphens, stray spaces — three spellings of ONE
      // payment. Comparing raw strings would let all three coexist.
      reference: "  mp.250101.4444.d44444  ",
      screenshotKey: null,
    });

    expect(duplicate.ok).toBe(false);
    expect(
      duplicate.ok === false && duplicate.error.reference?.[0],
      "The duplicate refusal did not land on the reference field. ORD-04's " +
        "message is field-level and destructive by design — a form-level error " +
        "leaves the customer with no idea which input to fix.",
    ).toBeTruthy();

    // The refusal names no other order. Telling this customer WHICH order holds
    // their reference leaks a stranger's order number inside the same store.
    const firstOrder = await scopedDb(TENANT_A.id).order.findUniqueOrThrow({
      where: { id: first.orderId },
      select: { orderNumber: true },
    });
    expect(JSON.stringify(duplicate)).not.toContain(firstOrder.orderNumber);

    expect(await readClaims(TENANT_A.id, second.orderId)).toHaveLength(0);
    expect((await readOrder(TENANT_A.id, second.orderId)).state).toBe(
      "PAYMENT_PENDING",
    );
  });

  it("accepts the identical reference in a DIFFERENT store", async () => {
    const shared = "MP-250101-5555-E55555";
    const inA = await pendingTransferOrder(TENANT_A);
    const inB = await pendingTransferOrder(TENANT_B);

    await expect(
      submitClaim({
        slug: TENANT_A.slug,
        token: inA.token,
        operator: "MTN_MOMO",
        reference: shared,
        screenshotKey: null,
      }),
    ).resolves.toEqual({ ok: true });

    await expect(
      submitClaim({
        slug: TENANT_B.slug,
        token: inB.token,
        operator: "MTN_MOMO",
        reference: shared,
        screenshotKey: null,
      }),
      "The same reference was refused in a second store.\n" +
        "  ORD-04's constraint is per tenant. A global one would tell a second " +
        "merchant's customer that their genuine payment duplicates a " +
        "stranger's — an outcome neither of them could ever resolve.",
    ).resolves.toEqual({ ok: true });

    expect(await readClaims(TENANT_B.id, inB.orderId)).toHaveLength(1);
  });
});

describe("CHK-04 token gating — three failures, one answer (T-03-77)", () => {
  it("refuses a malformed, an unknown and a foreign token identically", async () => {
    const mine = await pendingTransferOrder(TENANT_A);
    const foreign = await pendingTransferOrder(TENANT_B);

    const attempts = [
      { name: "malformed", token: "../../etc/passwd" },
      { name: "unknown", token: mintTrackingToken() },
      { name: "another store's live token", token: foreign.token },
    ];

    const answers: string[] = [];

    for (const attempt of attempts) {
      const result = await submitClaim({
        slug: TENANT_A.slug,
        token: attempt.token,
        operator: "MTN_MOMO",
        reference: `MP-250101-6666-F6666${answers.length}`,
        screenshotKey: null,
      });

      expect(result.ok, `${attempt.name} was accepted`).toBe(false);
      answers.push(JSON.stringify(result));
    }

    expect(
      new Set(answers).size,
      "The three ways of not holding a valid link produced different answers.\n" +
        "  A caller who can tell them apart has an oracle over which tracking " +
        "links exist, in a store where they are a stranger. The resolver " +
        "collapses all three to one null precisely so the caller cannot " +
        "branch on the difference.",
    ).toBe(1);

    // Nothing moved anywhere, in either store.
    expect(await readClaims(TENANT_A.id, mine.orderId)).toHaveLength(0);
    expect(await readClaims(TENANT_B.id, foreign.orderId)).toHaveLength(0);
    expect((await readOrder(TENANT_B.id, foreign.orderId)).state).toBe(
      "PAYMENT_PENDING",
    );
  });
});

describe("ORD-02 — a customer cannot settle their own payment (T-03-76)", () => {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  const SUBMIT_FILE = "src/server/claims/submit.ts";

  it("leaves the order awaiting review, with no settlement stamp", async () => {
    const order = await pendingTransferOrder(TENANT_A);

    await expect(
      submitClaim({
        slug: TENANT_A.slug,
        token: order.token,
        operator: "MTN_MOMO",
        reference: "MP-250101-7777-G77777",
        screenshotKey: null,
      }),
    ).resolves.toEqual({ ok: true });

    const after = await readOrder(TENANT_A.id, order.orderId);
    expect(after.state).toBe("PAYMENT_CLAIMED");
    expect(
      after.confirmedAt,
      "A customer's own submission stamped the order as settled. 'I have paid' " +
        "and 'the merchant agrees I paid' must stay two events.",
    ).toBeNull();
  });

  it("contains no settled-state literal anywhere in the submission module", () => {
    /*
     * THE STRUCTURAL HALF, ASSERTED AGAINST THE SOURCE.
     *
     * In the spirit of `tests/unit/single-order-state-writer.test.ts`: no
     * runtime test can catch a second confirmer, because a second confirmer is
     * by construction code the first one's tests never execute. The requirement
     * is not "this action does not settle payments" but "there is nowhere in it
     * a settlement could be written".
     */
    expect(
      existsSync(join(repoRoot, SUBMIT_FILE)),
      `${SUBMIT_FILE} does not exist, so this assertion would pass over an ` +
        "empty string with zero coverage.",
    ).toBe(true);

    const source = readFileSync(join(repoRoot, SUBMIT_FILE), "utf8");

    // The positive control: the file really is the submission path.
    expect(source).toContain("PAYMENT_CLAIMED");

    expect(
      source.includes("CONFIRMED"),
      `${SUBMIT_FILE} names the settled order state.\n` +
        "  Not even in a comment. The grep is the guarantee: a module that " +
        "cannot spell the state cannot reach it, however it is later edited. " +
        "Settling a claim belongs to src/server/claims/actions.ts, behind a " +
        "merchant session (T-03-65).",
    ).toBe(false);
  });

  it("refuses a submission against an order that is already settled", async () => {
    const order = await pendingTransferOrder(TENANT_A);

    await expect(
      submitClaim({
        slug: TENANT_A.slug,
        token: order.token,
        operator: "MTN_MOMO",
        reference: "MP-250101-8888-H88888",
        screenshotKey: null,
      }),
    ).resolves.toEqual({ ok: true });

    await scopedDb(TENANT_A.id).$transaction((tx) =>
      transitionOrder(tx, {
        orderId: order.orderId,
        to: "CONFIRMED",
        actor: "MERCHANT",
        actorUserId: TENANT_A.userId,
      }),
    );

    const late = await submitClaim({
      slug: TENANT_A.slug,
      token: order.token,
      operator: "MTN_MOMO",
      reference: "MP-250101-9999-I99999",
      screenshotKey: null,
    });

    expect(
      late.ok,
      "A claim was accepted against a settled order. A payment claim on an " +
        "order the merchant has already agreed to is not a thing, and letting " +
        "one through would put a second PENDING row in the merchant's queue " +
        "for a sale that is closed.",
    ).toBe(false);
    expect(await readClaims(TENANT_A.id, order.orderId)).toHaveLength(1);
  });
});

describe("D-11 — a dispute is recoverable from the same link", () => {
  it("accepts a corrected reference and re-holds the stock", async () => {
    const order = await pendingTransferOrder(TENANT_A, { quantity: 2 });
    const heldStock = await readStock(TENANT_A.id, order.variantId);

    await expect(
      submitClaim({
        slug: TENANT_A.slug,
        token: order.token,
        operator: "MTN_MOMO",
        reference: "MP-250102-1111-J11111",
        screenshotKey: null,
      }),
    ).resolves.toEqual({ ok: true });

    await rejectLatestClaim(
      TENANT_A,
      order.orderId,
      "The reference is eight digits, not ten.",
    );

    // The rejection put the units back on sale.
    expect(await readStock(TENANT_A.id, order.variantId)).toBe(
      heldStock + order.quantity,
    );
    expect((await readOrder(TENANT_A.id, order.orderId)).stockHeld).toBe(false);

    await expect(
      submitClaim({
        slug: TENANT_A.slug,
        token: order.token,
        operator: "MTN_MOMO",
        // A NEW reference. The rejected row still holds the old one under the
        // ORD-04 index, which is exactly why `reopenClaim` exists on the
        // merchant side for the case where the old one was right all along.
        reference: "MP-250102-2222-K22222",
        screenshotKey: null,
      }),
    ).resolves.toEqual({ ok: true });

    expect((await readOrder(TENANT_A.id, order.orderId)).state).toBe(
      "PAYMENT_CLAIMED",
    );
    expect(await readClaims(TENANT_A.id, order.orderId)).toHaveLength(2);

    // Re-decremented back to the held level.
    expect(await readStock(TENANT_A.id, order.variantId)).toBe(heldStock);

    /*
     * `releaseStock` is keyed on this flag, not on the order's state. Left
     * false, a SECOND rejection would release nothing and strand the decrement
     * forever — stock the merchant physically has, invisible to them, with
     * nothing in the audit trail to explain it.
     */
    expect(
      (await readOrder(TENANT_A.id, order.orderId)).stockHeld,
      "The resubmission re-held the units without recording that it had.",
    ).toBe(true);
  });

  it("refuses the resubmission and stays DISPUTED when the units have sold", async () => {
    const order = await pendingTransferOrder(TENANT_A, {
      shelf: 0,
      quantity: 1,
    });

    await expect(
      submitClaim({
        slug: TENANT_A.slug,
        token: order.token,
        operator: "MTN_MOMO",
        reference: "MP-250102-3333-L33333",
        screenshotKey: null,
      }),
    ).resolves.toEqual({ ok: true });

    await rejectLatestClaim(
      TENANT_A,
      order.orderId,
      "No payment received against this reference.",
    );

    // Somebody else buys the released unit during the dispute window.
    await scopedDb(TENANT_A.id).productVariant.update({
      where: { id: order.variantId },
      data: { stock: 0 },
    });

    const retry = await submitClaim({
      slug: TENANT_A.slug,
      token: order.token,
      operator: "MTN_MOMO",
      reference: "MP-250102-4444-M44444",
      screenshotKey: null,
    });

    expect(retry.ok).toBe(false);
    // The copy names the item rather than a variant id.
    expect(JSON.stringify(retry)).toContain("Submission Product");

    /*
     * The whole transaction rolled back. Moving the order into the payment path
     * over inventory that now belongs to another order is the oversell
     * `src/server/orders/stock.ts` warns about, and nobody would find out until
     * a shelf was counted.
     */
    const state = await readOrder(TENANT_A.id, order.orderId);
    expect(state.state).toBe("DISPUTED");
    expect(state.stockHeld).toBe(false);
    expect(await readStock(TENANT_A.id, order.variantId)).toBe(0);
    expect(await readClaims(TENANT_A.id, order.orderId)).toHaveLength(1);
  });
});

describe("D-13 — a missing mail key warns, it never fails a claim", () => {
  it("commits the claim and degrades the notification to one warning", async () => {
    const order = await pendingTransferOrder(TENANT_A);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await expect(
        submitClaim({
          slug: TENANT_A.slug,
          token: order.token,
          operator: "ORANGE_MONEY",
          reference: "MP-250102-5555-N55555",
          screenshotKey: null,
        }),
      ).resolves.toEqual({ ok: true });

      // The claim is committed BEFORE anything is deferred. That ordering is
      // the requirement: the customer's answer must never depend on a mail
      // provider.
      expect(await readClaims(TENANT_A.id, order.orderId)).toHaveLength(1);

      expect(
        await drainDeferred(),
        "The submission deferred no notification. D-13's email is best effort, " +
          "but 'best effort' still means it is attempted.",
      ).toBe(1);

      expect(
        warn.mock.calls.some(([first]) =>
          String(first).includes("[claims] DEGRADED"),
        ),
        "RESEND_* are unset in this suite on purpose — that is the " +
          "configuration the degraded path has to keep working under — and the " +
          "notifier must say so loudly rather than failing silently.",
      ).toBe(true);
    } finally {
      warn.mockRestore();
    }

    // And the order moved regardless.
    expect((await readOrder(TENANT_A.id, order.orderId)).state).toBe(
      "PAYMENT_CLAIMED",
    );
  });
});
