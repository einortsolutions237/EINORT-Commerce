import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { applySetCookies } from "better-auth/cookies";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Prisma } from "@/generated/prisma/client";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * ORD-02 / ORD-03 / ORD-04 / D-04 / D-11 against a real Postgres and a real
 * Better Auth session — the merchant's half of the payment-claim loop.
 *
 * WHY THIS GOES THROUGH REAL SESSIONS. `confirmClaim`, `rejectClaim` and
 * `reopenClaim` are `merchantAction`s, and the properties this file exists to
 * prove are about the wiring around the state machine, not the machine itself:
 * that `ctx.tenantId` and `ctx.userId` arrive from the SESSION and not from the
 * payload, that a foreign claim id is invisible rather than merely filtered, and
 * that the stock moves exactly once per rejection.
 * `tests/isolation/order-audit.test.ts` already proves `transitionOrder`'s
 * guards and `tests/isolation/stock-race.test.ts` already proves the
 * conditional decrement under concurrency; neither is repeated here.
 *
 * The harness is `tests/isolation/order-actions.test.ts`'s, reused verbatim
 * rather than re-invented: Better Auth and Prisma stay real, and only
 * `next/headers` and the rate limiters are substituted. `seedTwoTenants()` runs
 * once in `beforeAll` for the same documented reason — a reseed between tests
 * would truncate a merchant a still-running test had already signed up.
 *
 * `TENANT_A` / `TENANT_B` are used ONLY by the ORD-04 constraint cases, which
 * write claim rows directly and need no session. Every action case signs up its
 * own merchant, because the fixture users carry no password credential.
 */

// ---------------------------------------------------------------------------
// next/headers stand-in
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

/**
 * `@/server/theming/actions` imports `revalidatePath` at module scope for the
 * onboarding branding action this fixture now calls (ONB-02's mandatory
 * industry gate — see `signUpAndCarrySession` below). Outside a Next request
 * scope the real module throws, which would fail this file during import for
 * a reason that has nothing to do with the database. Same idiom as
 * `tests/isolation/branding.test.ts`.
 */
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));

// ---------------------------------------------------------------------------
// Rate limiters with controllable verdicts
// ---------------------------------------------------------------------------

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

// Imported after the mocks so the modules under test pick them up.
const { signUpMerchant } = await import("@/server/auth/signup");
const { selectPlan } = await import("@/server/merchant/actions");
const { saveBranding } = await import("@/server/theming/actions");
const { platformDb } = await import("@/server/db/platform");
const { auth } = await import("@/server/auth/auth");
const { scopedDb, scopedCreateData } = await import(
  "@/server/db/tenant-scoped"
);
const { openOrderAtGenesis, transitionOrder } = await import(
  "@/server/orders/transition"
);
const { releaseStock } = await import("@/server/orders/stock");
const { confirmClaim, rejectClaim, reopenClaim } = await import(
  "@/server/claims/actions"
);
const { normalizeReference } = await import("@/server/claims/reference");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PASSWORD = "correct-horse-battery";

function resetRequestContext(): void {
  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.9" });
  requestContext.cookies.clear();
}

/** Put a real, signed session cookie on the NEXT request. */
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

/** A merchant with a store, a chosen plan and a live session. */
async function signUpAndCarrySession(
  email: string,
  slug: string,
): Promise<{ tenantId: string; userId: string }> {
  const result = await signUpMerchant({
    email,
    password: PASSWORD,
    storeName: "Claims Store",
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

  /*
   * ONB-02's mandatory branding step. `requireMerchantContext()` — which
   * `confirmClaim`/`rejectClaim`/`reopenClaim` reach through `merchantAction()`
   * — redirects a merchant whose `industry` is still null to
   * `/onboarding/branding` (plan 04-11). This fixture predates that gate;
   * without this call every claim action below would throw an uncaught
   * `NEXT_REDIRECT` instead of exercising the behaviour under test.
   */
  const branded = await saveBranding({
    businessName: "Claims Store",
    industry: "general-retail",
    logoKey: null,
    primaryAccent: "#18181B",
    secondaryAccent: "#71717A",
  });
  if (!branded.ok) {
    throw new Error(`fixture branding failed: ${JSON.stringify(branded.error)}`);
  }

  const organization = await platformDb.organization.findUniqueOrThrow({
    where: { slug },
    select: { id: true },
  });
  const member = await platformDb.member.findFirstOrThrow({
    where: { organizationId: organization.id },
    select: { userId: true },
  });

  return { tenantId: organization.id, userId: member.userId };
}

let fixtureCounter = 0;

interface ClaimFixture {
  readonly claimId: string;
  readonly orderId: string;
  readonly variantId: string;
  readonly quantity: number;
}

/**
 * A MANUAL_TRANSFER order walked to PAYMENT_CLAIMED with a PENDING claim
 * against it, plus a real product variant whose stock is genuinely held.
 *
 * Built through `openOrderAtGenesis` and `transitionOrder` rather than by
 * inserting an order row directly, so the fixture cannot construct a state the
 * production code could not reach.
 */
async function claimAwaitingReview(
  tenantId: string,
  options: { stock?: number; quantity?: number; amountClaimedXaf?: number } = {},
): Promise<ClaimFixture> {
  fixtureCounter += 1;
  const suffix = `${tenantId}-${fixtureCounter}`;
  const quantity = options.quantity ?? 1;
  const stock = options.stock ?? 10;

  const db = scopedDb(tenantId);

  const product = await db.product.create({
    data: scopedCreateData<Prisma.ProductUncheckedCreateInput>({
      name: `Claim Product ${fixtureCounter}`,
      slug: `claim-product-${fixtureCounter}`,
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
      // `quantity` units, so the shelf shows `stock` and the hold is real.
      stock,
      sku: null,
      active: true,
    }),
    select: { id: true },
  });

  const order = await db.$transaction((tx) =>
    openOrderAtGenesis(tx, {
      orderNumber: `mt-${suffix}`,
      channel: "MANUAL_TRANSFER",
      customerName: "Claim Customer",
      customerPhone: "237600000020",
      deliveryAddress: null,
      customerNote: null,
      subtotalXaf: 5000 * quantity,
      totalXaf: 5000 * quantity,
      trackingTokenHash: `tracking-hash-${suffix}`,
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
        productName: `Claim Product ${fixtureCounter}`,
        variantLabel: "Default",
        unitPriceXaf: 5000,
        quantity,
        lineTotalXaf: 5000 * quantity,
        imageKey: null,
      }),
    ],
  });

  await db.$transaction(async (tx) => {
    await transitionOrder(tx, {
      orderId: order.id,
      to: "PAYMENT_PENDING",
      actor: "SYSTEM",
    });
    await transitionOrder(tx, {
      orderId: order.id,
      to: "PAYMENT_CLAIMED",
      actor: "CUSTOMER",
    });
  });

  const reference = `MP-${suffix}`;
  const claim = await db.paymentClaim.create({
    data: scopedCreateData<Prisma.PaymentClaimUncheckedCreateInput>({
      orderId: order.id,
      operator: "MTN_MOMO",
      reference,
      referenceNormalized: normalizeReference(reference),
      amountClaimedXaf: options.amountClaimedXaf ?? 5000 * quantity,
      screenshotKey: null,
      status: "PENDING",
    }),
    select: { id: true },
  });

  return {
    claimId: claim.id,
    orderId: order.id,
    variantId: variant.id,
    quantity,
  };
}

function readOrder(tenantId: string, orderId: string) {
  return scopedDb(tenantId).order.findUniqueOrThrow({
    where: { id: orderId },
    select: { state: true, confirmedAt: true, stockHeld: true },
  });
}

function readClaim(tenantId: string, claimId: string) {
  return scopedDb(tenantId).paymentClaim.findUniqueOrThrow({
    where: { id: claimId },
    select: {
      status: true,
      rejectionReason: true,
      reviewedAt: true,
      reviewedByUserId: true,
    },
  });
}

function countEvents(tenantId: string, orderId: string): Promise<number> {
  return scopedDb(tenantId).orderEvent.count({ where: { orderId } });
}

function readEvents(tenantId: string, orderId: string) {
  return scopedDb(tenantId).orderEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    select: { toState: true, actor: true, actorUserId: true, reason: true },
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
  resetRequestContext();
  limitVerdict.slugCheck = true;
  limitVerdict.signup = true;
});

// ---------------------------------------------------------------------------

describe("confirmClaim (ORD-03)", () => {
  it("confirms the claim, moves the order and leaves the stock held", async () => {
    const merchant = await signUpAndCarrySession(
      "claim-confirm@example.test",
      "claim-confirm-store",
    );
    const fixture = await claimAwaitingReview(merchant.tenantId);
    const stockBefore = await readStock(merchant.tenantId, fixture.variantId);
    const eventsBefore = await countEvents(merchant.tenantId, fixture.orderId);

    await expect(confirmClaim({ claimId: fixture.claimId })).resolves.toEqual({
      ok: true,
    });

    const claim = await readClaim(merchant.tenantId, fixture.claimId);
    expect(claim.status).toBe("CONFIRMED");
    expect(claim.reviewedAt).not.toBeNull();
    // ORD-05's *who*, on the claim row as well as on the event.
    expect(claim.reviewedByUserId).toBe(merchant.userId);

    const order = await readOrder(merchant.tenantId, fixture.orderId);
    expect(order.state).toBe("CONFIRMED");
    expect(order.confirmedAt).not.toBeNull();

    // EXACTLY one new event, named.
    expect(await countEvents(merchant.tenantId, fixture.orderId)).toBe(
      eventsBefore + 1,
    );
    const events = await readEvents(merchant.tenantId, fixture.orderId);
    expect(events.at(-1)).toMatchObject({
      toState: "CONFIRMED",
      actor: "MERCHANT",
      actorUserId: merchant.userId,
    });

    // D-04: the units were held at placement and a confirmed sale keeps them
    // held. A decrement here would double-count; an increment would put sold
    // goods back on sale.
    expect(await readStock(merchant.tenantId, fixture.variantId)).toBe(
      stockBefore,
    );
  });

  it("refuses a second confirmation and adds no second event (T-03-67)", async () => {
    const merchant = await signUpAndCarrySession(
      "claim-confirm-twice@example.test",
      "claim-confirm-twice-store",
    );
    const fixture = await claimAwaitingReview(merchant.tenantId);

    await expect(confirmClaim({ claimId: fixture.claimId })).resolves.toEqual({
      ok: true,
    });
    const afterFirst = await countEvents(merchant.tenantId, fixture.orderId);

    // The `status !== "PENDING"` guard inside the transaction IS the optimistic
    // lock for two open tabs. The second caller must get a readable refusal,
    // not a 500 and not a second audit row.
    const second = await confirmClaim({ claimId: fixture.claimId });
    expect(second.ok).toBe(false);

    expect(await countEvents(merchant.tenantId, fixture.orderId)).toBe(
      afterFirst,
    );
    expect((await readOrder(merchant.tenantId, fixture.orderId)).state).toBe(
      "CONFIRMED",
    );
  });
});

describe("ORD-02 — nothing auto-confirms a payment", () => {
  /*
   * THE STRUCTURAL HALF, ASSERTED AGAINST THE SOURCE.
   *
   * In the spirit of `tests/unit/single-order-state-writer.test.ts`: no runtime
   * test can catch a second confirmer, because a second confirmer is by
   * construction code the first one's tests never execute. The requirement is
   * not "we do not auto-confirm" but "there is nowhere an auto-confirmation
   * could be written" (T-03-65).
   */
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  const SANCTIONED_CONFIRMER = "src/server/claims/actions.ts";
  const SKIPPED_DIRS = new Set(["generated"]);
  const CONFIRMED_WRITE = /status\s*:\s*"CONFIRMED"/;

  function sourceFilesUnder(dir: string): string[] {
    const absolute = join(repoRoot, dir);
    if (!existsSync(absolute)) return [];

    const found: string[] = [];
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIPPED_DIRS.has(entry.name)) continue;
        found.push(...sourceFilesUnder(`${dir}/${entry.name}`));
      } else if (/\.tsx?$/.test(entry.name)) {
        found.push(`${dir}/${entry.name}`);
      }
    }
    return found;
  }

  /** Blank comment lines so documenting the rule cannot trip it. */
  function stripCommentLines(code: string): string {
    return code
      .split("\n")
      .map((line) =>
        /^\s*(?:\/\/|\/\*|\*)/.test(line) ? " ".repeat(line.length) : line,
      )
      .join("\n");
  }

  const scannedFiles = sourceFilesUnder("src").sort();
  const confirmers = scannedFiles.filter((file) =>
    CONFIRMED_WRITE.test(
      stripCommentLines(readFileSync(join(repoRoot, file), "utf8")),
    ),
  );

  it("actually scanned the source tree and still detects the sanctioned writer", () => {
    // The positive control. A scan that found nothing, or a detector that no
    // longer recognises a claim confirmation, would both report "no second
    // confirmer" with total confidence and zero coverage.
    expect(scannedFiles.length).toBeGreaterThan(0);
    expect(confirmers).toContain(SANCTIONED_CONFIRMER);
  });

  it("has no module outside the claims actions that confirms a claim", () => {
    expect(
      confirmers.filter((file) => file !== SANCTIONED_CONFIRMER),
      "ORD-02 violation — something other than " +
        `${SANCTIONED_CONFIRMER} sets a payment claim to CONFIRMED.\n` +
        "  A claim is a customer's ASSERTION that they paid. Confirming one is " +
        "the merchant's judgement and the only thing standing between a " +
        "self-report and a confirmed sale (T-03-65).",
    ).toEqual([]);
  });

  it("refuses PAYMENT_CLAIMED -> CONFIRMED for a CUSTOMER actor", async () => {
    // The behavioural half. The graph PERMITS this move; the refusal is purely
    // about who is asking.
    const fixture = await claimAwaitingReview(TENANT_A.id);
    const before = await countEvents(TENANT_A.id, fixture.orderId);

    await expect(
      scopedDb(TENANT_A.id).$transaction((tx) =>
        transitionOrder(tx, {
          orderId: fixture.orderId,
          to: "CONFIRMED",
          actor: "CUSTOMER",
        }),
      ),
    ).rejects.toThrow();

    const order = await readOrder(TENANT_A.id, fixture.orderId);
    expect(order.state).toBe("PAYMENT_CLAIMED");
    expect(order.confirmedAt).toBeNull();
    expect(await countEvents(TENANT_A.id, fixture.orderId)).toBe(before);
  });
});

describe("rejectClaim (D-11 / D-04)", () => {
  it("refuses a blank or two-character reason at the schema", async () => {
    const merchant = await signUpAndCarrySession(
      "claim-reject-blank@example.test",
      "claim-reject-blank-store",
    );
    const fixture = await claimAwaitingReview(merchant.tenantId);
    const stockBefore = await readStock(merchant.tenantId, fixture.variantId);

    for (const reason of ["", "   ", "no"]) {
      const result = await rejectClaim({ claimId: fixture.claimId, reason });
      expect(result.ok).toBe(false);
    }

    // Nothing moved: not the claim, not the order, not the stock.
    expect((await readClaim(merchant.tenantId, fixture.claimId)).status).toBe(
      "PENDING",
    );
    expect((await readOrder(merchant.tenantId, fixture.orderId)).state).toBe(
      "PAYMENT_CLAIMED",
    );
    expect(await readStock(merchant.tenantId, fixture.variantId)).toBe(
      stockBefore,
    );
  });

  it("disputes the order, stores the reason and puts the stock back", async () => {
    const merchant = await signUpAndCarrySession(
      "claim-reject@example.test",
      "claim-reject-store",
    );
    const fixture = await claimAwaitingReview(merchant.tenantId, {
      quantity: 2,
    });
    const stockBefore = await readStock(merchant.tenantId, fixture.variantId);
    const reason = "The reference does not match any payment we received.";

    await expect(
      rejectClaim({ claimId: fixture.claimId, reason }),
    ).resolves.toEqual({ ok: true });

    const claim = await readClaim(merchant.tenantId, fixture.claimId);
    expect(claim.status).toBe("REJECTED");
    expect(claim.rejectionReason).toBe(reason);
    expect(claim.reviewedByUserId).toBe(merchant.userId);

    const order = await readOrder(merchant.tenantId, fixture.orderId);
    expect(order.state).toBe("DISPUTED");
    expect(order.stockHeld).toBe(false);

    // D-11: the reason reaches the audit row, which is what the customer reads
    // on their tracking page.
    const events = await readEvents(merchant.tenantId, fixture.orderId);
    expect(events.at(-1)).toMatchObject({
      toState: "DISPUTED",
      actor: "MERCHANT",
      reason,
    });

    // D-04: the held units go back on sale, by the ordered quantity.
    expect(await readStock(merchant.tenantId, fixture.variantId)).toBe(
      stockBefore + fixture.quantity,
    );
  });

  it("releases the stock exactly once, even under a second release (D-04)", async () => {
    const merchant = await signUpAndCarrySession(
      "claim-reject-idem@example.test",
      "claim-reject-idem-store",
    );
    const fixture = await claimAwaitingReview(merchant.tenantId, {
      quantity: 3,
    });
    const stockBefore = await readStock(merchant.tenantId, fixture.variantId);

    await expect(
      rejectClaim({
        claimId: fixture.claimId,
        reason: "No payment received against this reference.",
      }),
    ).resolves.toEqual({ ok: true });

    const released = await readStock(merchant.tenantId, fixture.variantId);
    expect(released).toBe(stockBefore + fixture.quantity);

    /*
     * A SECOND release, called directly rather than through the action, so the
     * `PENDING` guard cannot be what makes this pass. The idempotency being
     * proved is `releaseStock`'s own `stockHeld` claim: a double-release would
     * report stock the merchant does not physically have, which is strictly
     * worse than an oversell because nothing else in the system contradicts it.
     */
    await scopedDb(merchant.tenantId).$transaction((tx) =>
      releaseStock(tx, fixture.orderId),
    );

    expect(await readStock(merchant.tenantId, fixture.variantId)).toBe(released);
  });
});

describe("ORD-04 — the reference constraint is per tenant, not global", () => {
  /**
   * Insert a claim carrying an explicit reference against a tenant's seeded
   * order. Written directly rather than through an action because the property
   * under test is the database constraint itself.
   */
  function claimWithReference(
    tenantId: string,
    orderId: string,
    reference: string,
  ) {
    return scopedDb(tenantId).paymentClaim.create({
      data: scopedCreateData<Prisma.PaymentClaimUncheckedCreateInput>({
        orderId,
        operator: "MTN_MOMO",
        reference,
        referenceNormalized: normalizeReference(reference),
        amountClaimedXaf: 5000,
        screenshotKey: null,
        status: "PENDING",
      }),
      select: { id: true },
    });
  }

  it("accepts the SAME reference in a second tenant, then refuses it in the first", async () => {
    const shared = "MP-SHARED-240823-0001";

    /*
     * THIS IS THE HALF THAT MAKES ORD-04 MEAN "PER TENANT".
     *
     * A test that only proved the duplicate is refused would pass just as
     * happily against a GLOBAL unique index — and a global one would be a real
     * bug: two unrelated Cameroonian merchants can legitimately receive MoMo
     * references that normalise identically, and the second merchant's customer
     * would be told their genuine payment was a duplicate of a stranger's.
     */
    const inA = await claimAwaitingReview(TENANT_A.id);
    const inB = await claimAwaitingReview(TENANT_B.id);

    await expect(
      claimWithReference(TENANT_A.id, inA.orderId, shared),
    ).resolves.toBeTruthy();

    await expect(
      claimWithReference(TENANT_B.id, inB.orderId, shared),
    ).resolves.toBeTruthy();

    // The other half: WITHIN tenant A, on a DIFFERENT order, the same
    // normalised reference is a P2002 before it can become a row.
    const secondOrderInA = await claimAwaitingReview(TENANT_A.id);
    const failure = await claimWithReference(
      TENANT_A.id,
      secondOrderInA.orderId,
      // A different spelling of the same reference, so the constraint is being
      // tested through `normalizeReference` rather than on a raw string.
      shared.toLowerCase().replace(/-/g, "."),
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as { code?: string }).code).toBe("P2002");
  });
});

describe("ORD-03 tenant isolation (T-03-66)", () => {
  it("refuses another tenant's claim id and writes no event in either tenant", async () => {
    const merchantA = await signUpAndCarrySession(
      "claim-cross-a@example.test",
      "claim-cross-a-store",
    );
    const merchantB = await signUpAndCarrySession(
      "claim-cross-b@example.test",
      "claim-cross-b-store",
    );

    const foreign = await claimAwaitingReview(merchantB.tenantId);
    const beforeA = await countEvents(merchantA.tenantId, foreign.orderId);
    const beforeB = await countEvents(merchantB.tenantId, foreign.orderId);

    // Signing up B left the session pointed at B.
    await authenticateAs("claim-cross-a@example.test");

    /*
     * NOT an `ok: false` refusal. The row is not visible to tenant A at all, so
     * the miss surfaces as a genuine throw rather than a readable message — a
     * readable "that claim is not yours" would be an existence oracle over
     * another tenant's ids.
     */
    await expect(confirmClaim({ claimId: foreign.claimId })).rejects.toThrow();
    await expect(
      rejectClaim({
        claimId: foreign.claimId,
        reason: "Attempting a cross-tenant rejection.",
      }),
    ).rejects.toThrow();

    expect(await countEvents(merchantA.tenantId, foreign.orderId)).toBe(beforeA);
    expect(await countEvents(merchantB.tenantId, foreign.orderId)).toBe(beforeB);

    const claim = await readClaim(merchantB.tenantId, foreign.claimId);
    expect(claim.status).toBe("PENDING");
    expect((await readOrder(merchantB.tenantId, foreign.orderId)).state).toBe(
      "PAYMENT_CLAIMED",
    );
  });
});

describe("reopenClaim (RESEARCH.md Pattern 10)", () => {
  it("returns a rejected claim to review and re-holds the stock", async () => {
    const merchant = await signUpAndCarrySession(
      "claim-reopen@example.test",
      "claim-reopen-store",
    );
    const fixture = await claimAwaitingReview(merchant.tenantId, {
      quantity: 2,
    });
    const heldStock = await readStock(merchant.tenantId, fixture.variantId);

    await expect(
      rejectClaim({
        claimId: fixture.claimId,
        reason: "Rejected by mistake, the reference was right all along.",
      }),
    ).resolves.toEqual({ ok: true });
    expect(await readStock(merchant.tenantId, fixture.variantId)).toBe(
      heldStock + fixture.quantity,
    );

    await expect(reopenClaim({ claimId: fixture.claimId })).resolves.toEqual({
      ok: true,
    });

    const claim = await readClaim(merchant.tenantId, fixture.claimId);
    expect(claim.status).toBe("PENDING");
    expect(claim.rejectionReason).toBeNull();
    expect(claim.reviewedAt).toBeNull();
    expect(claim.reviewedByUserId).toBeNull();

    const order = await readOrder(merchant.tenantId, fixture.orderId);
    expect(order.state).toBe("PAYMENT_CLAIMED");
    // The flag `releaseStock` is keyed on, restored — without it a second
    // rejection would release nothing and strand the decrement forever.
    expect(order.stockHeld).toBe(true);

    // Re-decremented back to the held level.
    expect(await readStock(merchant.tenantId, fixture.variantId)).toBe(
      heldStock,
    );

    // And the round trip is complete: rejecting again releases once more.
    await expect(
      rejectClaim({
        claimId: fixture.claimId,
        reason: "Rejected again after a closer look at the statement.",
      }),
    ).resolves.toEqual({ ok: true });
    expect(await readStock(merchant.tenantId, fixture.variantId)).toBe(
      heldStock + fixture.quantity,
    );
  });

  it("fails and leaves the order DISPUTED when the units have sold", async () => {
    const merchant = await signUpAndCarrySession(
      "claim-reopen-soldout@example.test",
      "claim-reopen-soldout-store",
    );
    const fixture = await claimAwaitingReview(merchant.tenantId, {
      stock: 0,
      quantity: 1,
    });

    await expect(
      rejectClaim({
        claimId: fixture.claimId,
        reason: "No matching payment found against this reference.",
      }),
    ).resolves.toEqual({ ok: true });

    // The rejection put one unit back. Somebody else buys it during the
    // dispute window.
    await scopedDb(merchant.tenantId).productVariant.update({
      where: { id: fixture.variantId },
      data: { stock: 0 },
    });

    const result = await reopenClaim({ claimId: fixture.claimId });
    expect(result.ok).toBe(false);
    // The copy names the item rather than a variant id.
    expect(JSON.stringify(result)).toContain("Claim Product");

    /*
     * The whole transaction rolled back. Moving the order into the payment path
     * over inventory that now belongs to another order is the oversell
     * `src/server/orders/stock.ts` warns about, and the merchant would have no
     * way to know it happened.
     */
    const claim = await readClaim(merchant.tenantId, fixture.claimId);
    expect(claim.status).toBe("REJECTED");
    expect(claim.rejectionReason).not.toBeNull();

    const order = await readOrder(merchant.tenantId, fixture.orderId);
    expect(order.state).toBe("DISPUTED");
    expect(order.stockHeld).toBe(false);
    expect(await readStock(merchant.tenantId, fixture.variantId)).toBe(0);
  });
});
