"use server";

import { after } from "next/server";
import { z } from "zod";

import { merchantAction, type ActionResult } from "@/server/merchant/action";

import { markThreadReadForMerchant, postMerchantMessage } from "./messages";
import { notifyPlatformOfMerchantMessage } from "./notify";
import type { SupportMessageRow } from "./shared";

/**
 * ADM-05 — the merchant's gated entry point into the support thread.
 *
 * ---------------------------------------------------------------------------
 * NO `tenantId` PARAMETER. `merchantAction` RESOLVES IT FROM THE SESSION.
 * ---------------------------------------------------------------------------
 * Same TEN-04 discipline as every other merchant Server Action in this
 * codebase: the handler receives `ctx` from `requireMerchantContext()`, never
 * a tenant id a caller could substitute.
 */

/**
 * `body` is the only field this plan's schema validates. `.trim()` runs
 * BEFORE the length check — the same order `claims/actions.ts`'s
 * `rejectSchema` uses — so a submission of pure whitespace is refused as
 * empty rather than accepted as one space.
 *
 * `min(1)`: an empty body is not yet permitted. Plan 06-11 relaxes this to a
 * cross-field refinement once an attachment exists ("body is required unless
 * an attachment is present") — that relaxation is NOT built here. Building it
 * now would leave a branch with no attachment path to satisfy it, which is
 * exactly the kind of unreachable code this codebase's review discipline
 * exists to catch.
 */
const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

/**
 * A merchant sends a message. Posts it, schedules the platform-direction
 * email nudge, and returns the created row so the client can replace its
 * optimistic bubble with the server's own id/timestamp.
 *
 * `mode: "write"` — this is D-08 read-only-blockable: an expired-trial
 * merchant cannot post. The support thread is not exempt from that gate, and
 * `strings.trial.readOnlyBlocked` is the message they see, same as every
 * other blocked write in the dashboard.
 */
export const sendSupportMessage = merchantAction({
  mode: "write",
  schema: sendMessageSchema,
  handler: async (ctx, input): Promise<ActionResult<{ message: SupportMessageRow }>> => {
    const message = await postMerchantMessage(ctx.tenantId, ctx.userId, input.body);

    /*
     * Scheduled after the response, never awaited: the merchant's optimistic
     * bubble must not wait on a mail provider. `notifyPlatformOfMerchantMessage`
     * can never reject — see `notify.ts`'s header — so there is nothing here to
     * catch.
     */
    after(() => notifyPlatformOfMerchantMessage(ctx.tenantId));

    return { ok: true, message };
  },
});

/**
 * Mark the merchant's thread read. `mode: "read"` — this is a visibility
 * update, not a write to anything the trial gate protects, and an
 * expired-trial merchant must still be able to open and read their own
 * thread.
 *
 * Exported for the composer's post-send refresh (`06-UI-SPEC.md` § A2). If
 * `/dashboard/support`'s own server load marks the thread read directly on
 * render instead, this action remains the callable path a client component
 * needs after sending — the two are not mutually exclusive, and both routes
 * to `markThreadReadForMerchant` are idempotent by that function's own
 * construction.
 */
export const markSupportThreadRead = merchantAction({
  mode: "read",
  schema: z.object({}),
  handler: async (ctx) => {
    await markThreadReadForMerchant(ctx.tenantId);
    return { ok: true };
  },
});
