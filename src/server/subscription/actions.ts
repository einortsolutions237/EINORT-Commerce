"use server";

import { z } from "zod";

import { PaymentOperator } from "@/server/db/enums";
import { PLAN_TIERS } from "@/server/entitlements/plans";
import { derivativePrefixFor, objectKeyFor } from "@/server/images/r2";
import { merchantAction } from "@/server/merchant/action";
import type { SubscriptionClaimRow } from "@/server/subscription/claims";
import { submitSubscriptionPaymentClaim } from "@/server/subscription/claims";

/**
 * SUB-03's merchant-facing Server Action — the ONLY caller of
 * `submitSubscriptionPaymentClaim` (`src/server/subscription/claims.ts`).
 *
 * ---------------------------------------------------------------------------
 * `mode: "read"`, DECIDED DELIBERATELY. DO NOT "FIX" THIS TO `"write"`.
 * ---------------------------------------------------------------------------
 * `merchantAction`'s `mode: "write"` refuses the call whenever `ctx.canWrite`
 * is false (`src/server/entitlements/resolve.ts`: `canWrite = subscribed ||
 * !expired`). An expired-trial, unsubscribed merchant is EXACTLY the merchant
 * who needs to submit a payment — paying is the action that is meant to
 * restore write access. Gating it on write access already being true is a
 * lockout: the one merchant this form exists for would be the one merchant
 * refused before their input was even parsed (T-06-78, a Denial of Service on
 * the platform's own revenue path).
 *
 * `mode: "read"` still runs every identity check `requireMerchantContext()`
 * performs — unauthenticated, suspended, or session-less callers never reach
 * the handler — it only skips the `canWrite` gate. That is the correct and
 * only unsafe-sounding-but-safe reading of "read" here: nothing about
 * submitting a claim WRITES catalog, order or storefront state that D-08's
 * read-only trial protects; it writes a claim ABOUT restoring access, which is
 * a different write surface entirely and has its own protection —
 * `submitSubscriptionPaymentClaim`'s global uniqueness constraint and the
 * per-tenant receipt-key revalidation below.
 */

/**
 * Re-derive the receipt key from the resolved tenant rather than trusting the
 * one the browser sent (T-06-79) — the same posture
 * `src/server/claims/submit.ts`'s `rebuildScreenshotKey` takes for the
 * sibling customer-facing claim, applied to the `"subscriptions"` upload
 * kind plan 06-11 built.
 *
 * DISCARDED, not refused, on a mismatch: a receipt image is optional by
 * design (the `receiptKey` column is nullable), and a merchant must never
 * lose a claim over an attachment. A mismatch here is either an attack, which
 * is now inert, or a stale client, which still gets its claim.
 */
function rebuildReceiptKey(tenantId: string, submitted: string): string | null {
  const uploadId = submitted.slice(submitted.lastIndexOf("/") + 1);

  try {
    const rebuilt = derivativePrefixFor(
      objectKeyFor(tenantId, "subscriptions", uploadId),
    );
    return rebuilt === submitted ? rebuilt : null;
  } catch {
    return null;
  }
}

/**
 * No `amountXaf` field, and there must never be one — see
 * `src/server/subscription/claims.ts`'s header. `reference` is bounded the
 * same way `submitClaimSchema` bounds it in `src/server/claims/submit.ts`:
 * three characters is the floor below which nothing an operator issues could
 * be meant, sixty-four is far above the longest MoMo/Orange reference.
 */
const submitSubscriptionPaymentSchema = z.object({
  operator: z.enum(PaymentOperator),
  reference: z.string().trim().min(3).max(64),
  planTier: z.enum(PLAN_TIERS),
  /** The prefix `thread-finalize` reported, or absent when none was attached. */
  receiptUploadKey: z.string().max(256).optional(),
});

/**
 * SUB-03: submit proof of a subscription payment from `/dashboard/plan`.
 *
 * Returns the created claim (via `submitSubscriptionPaymentClaim`'s own
 * `{ ok: true; claim }` shape, which already matches `ActionResult<{ claim:
 * SubscriptionClaimRow }>`) so the dialog can render the read-only claim card
 * immediately, without a refetch.
 */
export const submitSubscriptionPayment = merchantAction<
  typeof submitSubscriptionPaymentSchema,
  { claim: SubscriptionClaimRow }
>({
  mode: "read",
  schema: submitSubscriptionPaymentSchema,
  handler: async (ctx, { operator, reference, planTier, receiptUploadKey }) => {
    const receiptKey =
      receiptUploadKey === undefined
        ? null
        : rebuildReceiptKey(ctx.tenantId, receiptUploadKey);

    return submitSubscriptionPaymentClaim({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      operator,
      reference,
      planTier,
      receiptKey,
    });
  },
});
