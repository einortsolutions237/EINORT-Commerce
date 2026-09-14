import { describe, expect, it, beforeAll } from "vitest";

import { strings } from "@/lib/strings";
import { normalizeReference } from "@/server/claims/reference";
import { scopedDb } from "@/server/db/tenant-scoped";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * SUB-03 — the merchant's half of the subscription-payment claim loop, and
 * `prisma/schema.prisma`'s Assumption A1 made executable.
 *
 * ---------------------------------------------------------------------------
 * WHY `SubscriptionPaymentClaim.referenceNormalized` IS GLOBALLY UNIQUE, NOT
 * PER TENANT LIKE `PaymentClaim`'S.
 * ---------------------------------------------------------------------------
 * `PaymentClaim` (Phase 3's customer -> merchant claim) is `@@unique([tenantId,
 * referenceNormalized])` because the payee differs by tenant: two unrelated
 * merchants' customers can legitimately quote operator references that
 * normalise identically, and duplicate detection only makes sense within one
 * merchant's own inbox. A `SubscriptionPaymentClaim` is paid to the ONE
 * platform account regardless of which tenant submits it, so the same
 * reference twice is the same payment twice, whoever sent it — the schema
 * comment on `SubscriptionPaymentClaim.referenceNormalized` states this, and
 * this file is what proves it against a real Postgres unique index rather
 * than a mocked one.
 *
 * That choice creates an obligation this file also proves: a cross-tenant
 * `P2002` on the global index is technically an existence oracle over which
 * tenant used the reference first. `src/server/claims/actions.ts` already
 * takes the "one generic, byte-identical refusal" posture for cross-tenant
 * claim ids; `src/server/subscription/claims.ts` must take the same posture
 * here, and the "identical refusal" describe block below is the
 * machine-checkable half of that mitigation — a refusal that differs by so
 * much as a word between the same-tenant and cross-tenant cases would still
 * pass every other assertion in this file while quietly being the oracle the
 * design exists to avoid.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE DOES NOT COVER.
 * ---------------------------------------------------------------------------
 * Plan 06-16 (Wave 6) builds the platform owner's confirm/reject side and
 * extends THIS SAME FILE with those cases and with the optimistic-lock
 * double-tap shape `tests/isolation/claims.test.ts` already proves for the
 * customer-facing claim. The file is organised one `describe` per concern so
 * that extension appends cleanly rather than interleaving with the cases
 * below.
 */

const { submitSubscriptionPaymentClaim, latestSubscriptionClaimFor } =
  await import("@/server/subscription/claims");

beforeAll(async () => {
  await seedTwoTenants();
});

let counter = 0;

/** A reference unique to this test run, so unrelated cases never collide. */
function freshReference(): string {
  counter += 1;
  return `SUB-CLAIM-TEST-${counter}`;
}

function readClaims(tenantId: string) {
  return scopedDb(tenantId).subscriptionPaymentClaim.findMany({
    where: {},
    select: {
      id: true,
      status: true,
      coversThrough: true,
      operator: true,
      reference: true,
      referenceNormalized: true,
      amountXaf: true,
      planTier: true,
    },
  });
}

function readSystemMessages(tenantId: string, subscriptionClaimId: string) {
  return scopedDb(tenantId).supportMessage.findMany({
    where: { subscriptionClaimId },
    select: { author: true, subscriptionClaimId: true, body: true },
  });
}

// ---------------------------------------------------------------------------

describe("SUB-03 — a merchant submits a subscription payment claim", () => {
  it("creates a PENDING row with a null coversThrough, and posts one SYSTEM message carrying it", async () => {
    const reference = freshReference();

    const result = await submitSubscriptionPaymentClaim({
      tenantId: TENANT_A.id,
      actorUserId: TENANT_A.userId,
      operator: "MTN_MOMO",
      reference,
      planTier: "business",
      receiptKey: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const claims = await readClaims(TENANT_A.id);
    const created = claims.find((claim) => claim.id === result.claim.id);

    expect(
      created,
      "The claim returned to the caller does not match a row actually " +
        "persisted for this tenant.",
    ).toMatchObject({
      status: "PENDING",
      coversThrough: null,
      operator: "MTN_MOMO",
      reference,
      referenceNormalized: normalizeReference(reference),
    });

    // Exactly one SYSTEM message, carrying this claim's id — the thread is
    // the channel of record, and a claim with no trace there is D-15's
    // repudiation failure (T-06-80).
    const messages = await readSystemMessages(TENANT_A.id, result.claim.id);
    expect(
      messages,
      "Submitting a claim did not post exactly one SYSTEM message carrying " +
        "its subscriptionClaimId.",
    ).toHaveLength(1);
    expect(messages[0]?.author).toBe("SYSTEM");
  });

  it("resolves the amount server-side from the plan registry, never from the caller", async () => {
    const reference = freshReference();

    const result = await submitSubscriptionPaymentClaim({
      tenantId: TENANT_A.id,
      actorUserId: TENANT_A.userId,
      operator: "ORANGE_MONEY",
      reference,
      planTier: "starter",
      receiptKey: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Starter's price, per src/server/entitlements/plans.ts — never a value
    // this test could have smuggled in, because the input above has no
    // amount field to smuggle it through.
    expect(result.claim.amountXaf).toBe(5_000);
  });
});

describe("Assumption A1 — the reference is globally unique, not per tenant", () => {
  it("refuses a second submission of the same reference from the same tenant, writing no second row or message", async () => {
    const reference = freshReference();

    const first = await submitSubscriptionPaymentClaim({
      tenantId: TENANT_A.id,
      actorUserId: TENANT_A.userId,
      operator: "MTN_MOMO",
      reference,
      planTier: "business",
      receiptKey: null,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const duplicate = await submitSubscriptionPaymentClaim({
      tenantId: TENANT_A.id,
      actorUserId: TENANT_A.userId,
      operator: "MTN_MOMO",
      reference,
      planTier: "business",
      receiptKey: null,
    });

    expect(duplicate.ok).toBe(false);

    const claims = await readClaims(TENANT_A.id);
    expect(
      claims.filter((claim) => claim.referenceNormalized === normalizeReference(reference)),
    ).toHaveLength(1);

    const messages = await readSystemMessages(TENANT_A.id, first.claim.id);
    expect(
      messages,
      "A refused duplicate still posted a second SYSTEM message.",
    ).toHaveLength(1);
  });

  it("refuses a cross-tenant duplicate with the byte-identical refusal the same-tenant case produces (T-06-76)", async () => {
    const reference = freshReference();

    const first = await submitSubscriptionPaymentClaim({
      tenantId: TENANT_A.id,
      actorUserId: TENANT_A.userId,
      operator: "MTN_MOMO",
      reference,
      planTier: "business",
      receiptKey: null,
    });
    expect(first.ok).toBe(true);

    const sameTenantDuplicate = await submitSubscriptionPaymentClaim({
      tenantId: TENANT_A.id,
      actorUserId: TENANT_A.userId,
      operator: "MTN_MOMO",
      reference,
      planTier: "business",
      receiptKey: null,
    });

    const crossTenantDuplicate = await submitSubscriptionPaymentClaim({
      tenantId: TENANT_B.id,
      actorUserId: TENANT_B.userId,
      operator: "ORANGE_MONEY",
      reference,
      planTier: "professional",
      receiptKey: null,
    });

    expect(sameTenantDuplicate.ok).toBe(false);
    expect(crossTenantDuplicate.ok).toBe(false);

    /*
     * THE ASSERTION THAT MATTERS IN THIS FILE.
     *
     * Both refusals must be the SAME value, not merely two values that both
     * failed. `toStrictEqual` is what catches a refusal that names the other
     * tenant, varies its wording, or leaks which side of the pair went
     * first — any of which would turn a P2002 into the existence oracle
     * T-06-76 exists to close.
     */
    expect(sameTenantDuplicate).toStrictEqual(crossTenantDuplicate);
    expect(sameTenantDuplicate).toStrictEqual({
      ok: false,
      error: { reference: [strings.plan.subscriptionClaim.duplicateReference] },
    });

    // And the refusal names neither tenant.
    expect(JSON.stringify(sameTenantDuplicate)).not.toContain(TENANT_A.id);
    expect(JSON.stringify(sameTenantDuplicate)).not.toContain(TENANT_B.id);

    // No row exists for the cross-tenant caller.
    expect(await readClaims(TENANT_B.id)).toHaveLength(
      (await readClaims(TENANT_B.id)).filter(
        (claim) => claim.referenceNormalized === normalizeReference(reference),
      ).length,
    );
    expect(
      (await readClaims(TENANT_B.id)).filter(
        (claim) => claim.referenceNormalized === normalizeReference(reference),
      ),
    ).toHaveLength(0);
  });

  it("normalizes case and surrounding whitespace to the same key, so a re-typed reference still collides", async () => {
    const reference = freshReference();

    const first = await submitSubscriptionPaymentClaim({
      tenantId: TENANT_A.id,
      actorUserId: TENANT_A.userId,
      operator: "MTN_MOMO",
      reference,
      planTier: "business",
      receiptKey: null,
    });
    expect(first.ok).toBe(true);

    // Mixed case, extra whitespace — the exact shape claim-submission.test.ts
    // exercises for the sibling PaymentClaim model, applied to this one.
    const respelled = `  ${reference.toLowerCase()}  `;
    expect(normalizeReference(respelled)).toBe(normalizeReference(reference));

    const duplicate = await submitSubscriptionPaymentClaim({
      tenantId: TENANT_A.id,
      actorUserId: TENANT_A.userId,
      operator: "MTN_MOMO",
      reference: respelled,
      planTier: "business",
      receiptKey: null,
    });

    expect(
      duplicate.ok,
      "A respelled but case/whitespace-equivalent reference was accepted as a " +
        "NEW claim rather than refused as the same payment.",
    ).toBe(false);
  });
});

describe("latestSubscriptionClaimFor — a merchant reads only their own history", () => {
  it("never returns another tenant's latest claim", async () => {
    const referenceA = freshReference();

    const submitted = await submitSubscriptionPaymentClaim({
      tenantId: TENANT_A.id,
      actorUserId: TENANT_A.userId,
      operator: "MTN_MOMO",
      reference: referenceA,
      planTier: "business",
      receiptKey: null,
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const latestForA = await latestSubscriptionClaimFor(TENANT_A.id);
    expect(latestForA?.id).toBe(submitted.claim.id);

    const latestForB = await latestSubscriptionClaimFor(TENANT_B.id);
    expect(
      latestForB?.id,
      "Tenant B's latest claim resolved to Tenant A's freshly submitted row.",
    ).not.toBe(submitted.claim.id);
  });
});
