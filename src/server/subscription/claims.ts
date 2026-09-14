import "server-only";

import { strings } from "@/lib/strings";
import { normalizeReference } from "@/server/claims/reference";
import type { PaymentOperator } from "@/server/db/enums";
import type { SubscriptionPaymentClaimCreateInput } from "@/server/db/model-inputs";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";
import { PLANS, type PlanTier } from "@/server/entitlements/plans";
import { formatXaf } from "@/server/payments/whatsapp";
import { postSystemMessage } from "@/server/support/messages";

/**
 * SUB-03's merchant half — THE ONLY MODULE IN `src/` THAT CREATES A
 * `SubscriptionPaymentClaim`. This is tested (`tests/isolation/subscription-
 * claims.test.ts` extends, in plan 06-16, the same source-scanning discipline
 * `tests/isolation/claims.test.ts` already applies to `PaymentClaim.status`).
 *
 * `src/server/admin/subscription-claims.ts` (plan 06-16) is the ONLY module
 * permitted to change a claim's `status` — confirm/reject, the platform
 * owner's side. Two modules, two invariants, the same trust-boundary split
 * `src/server/claims/submit.ts` (create) and `src/server/claims/actions.ts`
 * (review) already use for `PaymentClaim`. Neither module may cross into the
 * other's half: this file never writes `status` past its initial `PENDING`,
 * and 06-16's module never calls `.create()`.
 *
 * ---------------------------------------------------------------------------
 * THE AMOUNT IS SERVER-AUTHORITATIVE (T-06-75).
 * ---------------------------------------------------------------------------
 * There is no `amountXaf` parameter. The price is read from `PLANS[planTier]`
 * inside this function, the same posture `placeOrder` takes for cart prices —
 * a client-supplied amount would let a merchant claim to have paid 100 XAF for
 * a Professional subscription and have the claim believed. `planTier` itself
 * is snapshotted onto the row (plan 06-03's column) so a later plan-price
 * change can never retroactively alter what a merchant already paid for.
 *
 * ---------------------------------------------------------------------------
 * THE CLAIM AND ITS SYSTEM MESSAGE ARE ONE TRANSACTION (T-06-80).
 * ---------------------------------------------------------------------------
 * `postSystemMessage` is called with the SAME `tx` the claim insert runs
 * inside. A failed message must never leave an invisible claim (a PENDING row
 * the merchant cannot see any record of asking about), and a failed claim must
 * never leave a system message about nothing — D-15's repudiation guard.
 *
 * ---------------------------------------------------------------------------
 * GLOBAL UNIQUENESS AND THE EXISTENCE-ORACLE REFUSAL (T-06-76 / T-06-77).
 * ---------------------------------------------------------------------------
 * `referenceNormalized` is `@unique` across ALL tenants (see the schema
 * comment on the column) — unlike `PaymentClaim`'s per-tenant composite key —
 * because the payee is the one platform account, so the same reference twice
 * is the same payment twice, whoever sent it. A cross-tenant collision
 * therefore surfaces as a Prisma `P2002`, and refusing it with anything other
 * than ONE generic, byte-identical message would let a caller learn that
 * *some other tenant* already used this reference. `isUniqueViolation` below
 * cannot tell same-tenant from cross-tenant apart, on purpose — there is
 * exactly one refusal string, reused verbatim from Phase 3
 * (`strings.plan.subscriptionClaim.duplicateReference`, which is the same
 * `DUPLICATE_REFERENCE` constant `strings.orderStatus.claimDuplicateReference`
 * already uses — see `src/lib/strings/index.ts`'s header for why this file
 * writes no second copy of that sentence).
 */

// ---------------------------------------------------------------------------
// Result shape — mirrors `SubmitClaimResult` in `src/server/claims/submit.ts`.
// ---------------------------------------------------------------------------

/** One `SubscriptionPaymentClaim` row, as every reader of this module needs it. */
export interface SubscriptionClaimRow {
  readonly id: string;
  readonly operator: PaymentOperator;
  readonly reference: string;
  readonly amountXaf: number;
  readonly planTier: string;
  readonly receiptKey: string | null;
  readonly status: "PENDING" | "CONFIRMED" | "REJECTED";
  readonly rejectionReason: string | null;
  readonly submittedAt: Date;
  readonly reviewedAt: Date | null;
  readonly coversThrough: Date | null;
}

export type SubmitSubscriptionClaimResult =
  | { ok: true; claim: SubscriptionClaimRow }
  | { ok: false; error: Record<string, string[]> };

const CLAIM_SELECT = {
  id: true,
  operator: true,
  reference: true,
  amountXaf: true,
  planTier: true,
  receiptKey: true,
  status: true,
  rejectionReason: true,
  submittedAt: true,
  reviewedAt: true,
  coversThrough: true,
} as const;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface SubmitSubscriptionPaymentClaimInput {
  readonly tenantId: string;
  /**
   * The submitting merchant's own `userId` (`ctx.userId` in
   * `submitSubscriptionPayment`, `src/server/subscription/actions.ts`).
   *
   * NOT YET PERSISTED. `SubscriptionPaymentClaim` records `reviewedByUserId`
   * — the platform owner's identity at review time — but has no
   * `submittedByUserId` column: nothing downstream needs "which of this
   * tenant's own users submitted it" today, so plan 06-03's schema did not add
   * one. Accepted here rather than dropped from the signature, so a future
   * column is one field to wire on this line rather than a second plumbing
   * pass through `actions.ts` and every call site.
   */
  readonly actorUserId: string;
  readonly operator: PaymentOperator;
  readonly reference: string;
  readonly planTier: PlanTier;
  /** R2 derivative prefix, or `null` when the merchant attached no receipt. */
  readonly receiptKey: string | null;
}

/** A unique-constraint violation, recognised without importing the client. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function fail(field: string, message: string): SubmitSubscriptionClaimResult {
  return { ok: false, error: { [field]: [message] } };
}

/** `strings.plan.{tier}.name` — the tier NAME, never the internal key. */
function planDisplayName(tier: PlanTier): string {
  return strings.plan[tier].name;
}

// ---------------------------------------------------------------------------
// The writer
// ---------------------------------------------------------------------------

/**
 * Turn "I've paid my subscription" into exactly one reviewable claim, with
 * the platform's own thread carrying the receipt.
 *
 * Never raises for an expected refusal (the duplicate-reference case);
 * everything else rethrows uncaught, exactly as `submitClaim` does, so an
 * unexpected failure stays visible in the logs rather than becoming a
 * misleading validation message.
 */
export async function submitSubscriptionPaymentClaim(
  input: SubmitSubscriptionPaymentClaimInput,
): Promise<SubmitSubscriptionClaimResult> {
  const { tenantId, operator, reference, planTier, receiptKey } = input;

  /*
   * ORD-04's sibling rule, restated for the global index: a blank normalised
   * reference would claim the ONE global empty-string slot under
   * `referenceNormalized @unique` and permanently block every later
   * submission — from any tenant — that also normalises to nothing. Refused
   * with the same string as an ordinary duplicate, matching the precedent
   * `src/server/claims/submit.ts` sets for the exact same edge case.
   */
  const referenceNormalized = normalizeReference(reference);
  if (referenceNormalized.length === 0) {
    return fail("reference", strings.plan.subscriptionClaim.duplicateReference);
  }

  const amountXaf = PLANS[planTier].monthlyPriceXaf;

  const systemMessageBody = strings.support.system.subscriptionSubmitted
    .replace("{plan}", planDisplayName(planTier))
    .replace("{amount}", formatXaf(amountXaf));

  try {
    const claim = await scopedDb(tenantId).$transaction(async (tx) => {
      const created = await tx.subscriptionPaymentClaim.create({
        data: scopedCreateData<SubscriptionPaymentClaimCreateInput>({
          operator,
          // Stored exactly as typed — this is what the platform owner
          // compares against the platform account's own SMS receipt —
          // beside the normalised key the unique index actually constrains.
          reference,
          referenceNormalized,
          amountXaf,
          planTier,
          receiptKey,
          status: "PENDING",
        }),
        select: CLAIM_SELECT,
      });

      // ONE transaction with the insert above — see the file header.
      await postSystemMessage(tenantId, systemMessageBody, {
        subscriptionClaimId: created.id,
        tx,
      });

      return created;
    });

    return { ok: true, claim };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("reference", strings.plan.subscriptionClaim.duplicateReference);
    }
    throw error;
  }
}

/**
 * The merchant's own most recent claim, for `/dashboard/plan` to render.
 *
 * `scopedDb` filters to the caller's tenant structurally — an unregistered or
 * mis-scoped read is a thrown error, not a silent leak — so there is no
 * `WHERE tenantId = …` written out here to drift from that guarantee.
 */
export async function latestSubscriptionClaimFor(
  tenantId: string,
): Promise<SubscriptionClaimRow | null> {
  return scopedDb(tenantId).subscriptionPaymentClaim.findFirst({
    orderBy: { submittedAt: "desc" },
    select: CLAIM_SELECT,
  });
}
