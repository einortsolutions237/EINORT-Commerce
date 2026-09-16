"use server";

import { z } from "zod";

import {
  confirmSubscriptionClaim,
  rejectSubscriptionClaim,
} from "@/server/admin/subscription-claims";

import { adminAction } from "./action";

/**
 * SUB-03 / D-20 — the two Server Actions `/admin/subscriptions`'s row island
 * calls.
 *
 * ---------------------------------------------------------------------------
 * THIS MODULE IS THE ENDPOINT LAYER ONLY. EVERY CONSEQUENCE LIVES IN
 * `src/server/admin/subscription-claims.ts`.
 * ---------------------------------------------------------------------------
 * `confirmSubscriptionClaim` and `rejectSubscriptionClaim` already own the
 * transaction, the optimistic lock, the `SubscriptionPaymentClaim.status`
 * write, the `Organization.subscriptionCurrentPeriodEnd` write, the SYSTEM
 * message, and the `AlreadyReviewedError` -> `{ ok: false, error: { form:
 * [...] } }` conversion (their own `refusalOrRethrow`, reusing
 * `strings.claims.alreadyReviewed`). This file does not repeat any of that.
 * Its entire job is: resolve identity (`adminAction`), validate the payload
 * (Zod), and inject the one value a client must never be allowed to supply —
 * `actorUserId`, always `ctx.userId`, never anything read from `raw`.
 *
 * ---------------------------------------------------------------------------
 * A SEPARATE MODULE FROM `src/server/admin/actions.ts` (plan 06-10's order
 * claims), DELIBERATELY.
 * ---------------------------------------------------------------------------
 * `src/app/admin/claims/ledger-row.tsx` imports `confirmOrderClaimAsAdmin`
 * from `./actions.ts` — a different domain, a different file, per the
 * per-domain endpoint-module convention `src/server/admin/action.ts`'s own
 * header names. Plan 06-14 (suspend/restore) is also in this wave; a shared
 * actions file would put three unrelated plans' Server Actions in one module
 * in the same wave for no reason beyond proximity.
 *
 * ---------------------------------------------------------------------------
 * `reason`'S BOUNDS ARE THIS SURFACE'S OWN, NOT REUSED FROM THE ORDER-CLAIMS
 * REJECT SCHEMA.
 * ---------------------------------------------------------------------------
 * 06-UI-SPEC.md § C4: a required free-text reason, at least 10 characters,
 * at most 140 — narrower on both ends than `src/server/admin/actions.ts`'s
 * `z.string().trim().min(3).max(200)` for order claims, because there are no
 * canned reasons here to fall back on if the merchant needs to read a full
 * sentence. `.trim()` runs BEFORE the length check, so three spaces is a
 * two-character reason and is refused — the same discipline every reject
 * schema in this codebase already follows.
 *
 * ---------------------------------------------------------------------------
 * NO NEW RATE LIMITER, FOR THE SAME REASON `src/server/admin/actions.ts`
 * STATES.
 * ---------------------------------------------------------------------------
 * There is exactly one legitimate user of the admin surface, and `/login`
 * already throttles the only pre-authentication path to it. T-06-05,
 * disposition "accept".
 */

const confirmSchema = z.object({ claimId: z.string().min(1) });

const rejectSchema = z.object({
  claimId: z.string().min(1),
  reason: z.string().trim().min(10).max(140),
});

/**
 * The owner's confirm — NOT optimistic, because it changes what the merchant
 * is entitled to. The row island opens an `alert-dialog` first; this action
 * is what runs once the owner has actually committed to that dialog.
 */
export const confirmSubscriptionPayment = adminAction({
  schema: confirmSchema,
  handler: async (ctx, { claimId }) => {
    // The reviewer is always the session's own user, never a client-supplied
    // value — there is no `reviewedByUserId` field on the schema above.
    return confirmSubscriptionClaim({ claimId, actorUserId: ctx.userId });
  },
});

/**
 * The owner's reject — a required free-text reason, no canned options. The
 * failure modes here are platform-specific and the owner is writing to one
 * merchant, not triaging a queue of customer complaints.
 */
export const rejectSubscriptionPayment = adminAction({
  schema: rejectSchema,
  handler: async (ctx, { claimId, reason }) => {
    return rejectSubscriptionClaim({ claimId, reason, actorUserId: ctx.userId });
  },
});
