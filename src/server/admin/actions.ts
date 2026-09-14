"use server";

import { z } from "zod";

import { adminConfirmOrderClaim, adminRejectOrderClaim } from "@/server/admin/claims";

import { adminAction } from "./action";

/**
 * ADM-02 / D-19 — the two Server Actions `/admin/claims`'s row island calls.
 *
 * ---------------------------------------------------------------------------
 * THIS MODULE IS THE ENDPOINT LAYER ONLY. EVERY CONSEQUENCE LIVES IN
 * `src/server/admin/claims.ts`.
 * ---------------------------------------------------------------------------
 * `adminConfirmOrderClaim` and `adminRejectOrderClaim` (plan 06-07) already
 * own the transaction, the optimistic lock, the `PaymentClaim.status` write,
 * `transitionOrder`, `releaseStock`, and the `AlreadyReviewedError` /
 * `InvalidTransitionError` -> `{ ok: false, error: { form: [...] } }`
 * conversion (their own `refusalOrRethrow`, matching
 * `src/server/claims/actions.ts`'s discipline verbatim, down to reusing
 * `strings.claims.alreadyReviewed` and `strings.orders.staleAction`). This
 * file does not repeat any of that. Its entire job is: resolve identity
 * (`adminAction`), validate the payload (Zod), and inject the one value a
 * client must never be allowed to supply — `actorUserId`, always
 * `ctx.userId`, never anything read from `raw`.
 *
 * ---------------------------------------------------------------------------
 * `"use server"` IS THE FIRST LINE, AND THE OTHER MODULE MARKER IS ABSENT.
 * ---------------------------------------------------------------------------
 * Every export below is an async function Next registers as an endpoint —
 * this module holds actions, not a factory, so the data-access-only marker
 * (see `./action.ts`'s header for the factory/action split) would be the
 * wrong one to pair with the first line.
 *
 * ---------------------------------------------------------------------------
 * `reason`'S BOUNDS ARE REUSED VERBATIM FROM THE MERCHANT PATH.
 * ---------------------------------------------------------------------------
 * `z.string().trim().min(3).max(200)` is copied from
 * `src/server/claims/actions.ts`'s `rejectSchema`, not re-derived, so the two
 * surfaces cannot disagree about what a valid reason is. `.trim()` runs
 * BEFORE the length check for the identical reason stated there: three
 * spaces is a two-character reason and must be refused.
 *
 * ---------------------------------------------------------------------------
 * NO NEW RATE LIMITER FOR THIS SURFACE, DELIBERATELY (06-RESEARCH.md OQ-4).
 * ---------------------------------------------------------------------------
 * There is exactly one legitimate user of the admin surface, and the only
 * pre-authentication path to it is `/login`, which `loginLimiter` already
 * throttles by IP before it parses anything. A second limiter here would
 * throttle a population of one against an attack that cannot get past the
 * first one — the same reasoning `src/server/admin/context.ts` states for
 * `requireAdminContext()` itself. T-06-05, disposition "accept".
 */

const confirmSchema = z.object({ claimId: z.string().min(1) });

const rejectSchema = z.object({
  claimId: z.string().min(1),
  reason: z.string().trim().min(3).max(200),
});

/**
 * The owner's one-tap confirm, over any tenant's claim — the D-19 inline
 * action's `Confirm` button, and the `alert-dialog`'s confirm button on an
 * amount mismatch.
 */
export const confirmOrderClaimAsAdmin = adminAction({
  schema: confirmSchema,
  handler: async (ctx, { claimId }) => {
    // The reviewer is always the session's own user, never a client-supplied
    // value — there is no `reviewedByUserId` field on the schema above.
    return adminConfirmOrderClaim({ claimId, actorUserId: ctx.userId });
  },
});

/**
 * The owner's reject, over any tenant's claim — the D-19 inline action's
 * `Reject` button, behind the required-reason `dialog`.
 */
export const rejectOrderClaimAsAdmin = adminAction({
  schema: rejectSchema,
  handler: async (ctx, { claimId, reason }) => {
    return adminRejectOrderClaim({ claimId, reason, actorUserId: ctx.userId });
  },
});
