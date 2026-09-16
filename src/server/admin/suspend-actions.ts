"use server";

import { z } from "zod";

import { strings } from "@/lib/strings";
import { setOrganizationSuspended } from "@/server/admin/suspend";

import { adminAction } from "./action";

/**
 * ADM-01 / D-14..D-17 — the two Server Actions the suspend/restore dialog
 * calls: `/admin`'s row menu and `/admin/merchants/[id]`'s Store status
 * card, both mounted from the SAME `SuspendDialog` component
 * (`src/components/admin/suspend-dialog.tsx`).
 *
 * ---------------------------------------------------------------------------
 * THIS MODULE IS THE ENDPOINT LAYER ONLY. EVERY CONSEQUENCE LIVES IN
 * `src/server/admin/suspend.ts`.
 * ---------------------------------------------------------------------------
 * `setOrganizationSuspended` already owns the transaction, the optimistic
 * lock, the `Organization.status` write, the D-15 system message and the
 * hostname-cache eviction. This file's entire job — matching
 * `src/server/admin/actions.ts`'s own stated discipline for
 * `confirmOrderClaimAsAdmin`/`rejectOrderClaimAsAdmin` — is: resolve
 * identity (`adminAction`), validate the payload (Zod), and inject the one
 * value a client must never be allowed to supply: `actorUserId`, always
 * `ctx.userId`, never anything read from the raw payload.
 *
 * ---------------------------------------------------------------------------
 * A SEPARATE ACTION MODULE FROM `src/server/admin/actions.ts`, DELIBERATELY.
 * ---------------------------------------------------------------------------
 * Plan 06-16 (subscription-payment review) lands in the same wave and edits
 * that file. A per-domain endpoint module — the same convention
 * `src/server/admin/support-actions.ts` already follows for the support
 * surface — keeps this plan and that one from touching the same file in the
 * same wave.
 *
 * ---------------------------------------------------------------------------
 * THE REASON BOUNDS ARE 10–280 CHARACTERS, ENFORCED HERE AS THE LITERAL
 * BOUNDS THE DIALOG'S COUNTER SHOWS.
 * ---------------------------------------------------------------------------
 * R-2 / § Copywriting Contract: a suspension reason is REQUIRED (10–280
 * characters) because it is posted verbatim into the merchant's support
 * thread and is the only record of why their store went offline (ADM-04). A
 * restore note is OPTIONAL (≤280 characters) and is never interpolated into
 * `strings.support.system.restored` — restoring needs no justification the
 * merchant must read (R-2's "restoring is a safe action" reasoning).
 * `.trim()` runs BEFORE the length check, matching every other bounded
 * free-text field in this codebase (`src/server/claims/actions.ts`'s
 * `rejectSchema`), so three spaces cannot count as a ten-character reason.
 */

const suspendSchema = z.object({
  merchantId: z.string().min(1),
  reason: z.string().trim().min(10).max(280),
});

const restoreSchema = z.object({
  merchantId: z.string().min(1),
  note: z.string().trim().max(280).optional(),
});

/**
 * The routine "no such organization" case, converted into a refusal the
 * dialog can render — `merchantId` is a real id read off a row this same
 * render already fetched, so this branch is realistically a merchant that
 * was suspended (or, in the fixture-less future, deleted) between page load
 * and submit, not an attack. Duck-typed against Prisma's `P2025` "record
 * not found" code, matching this codebase's `isUniqueViolation` convention
 * (`src/server/orders/place.ts`) rather than importing the generated
 * client, which `eslint.config.mjs`'s `no-restricted-imports` forbids here.
 */
function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  );
}

/**
 * `/admin`'s row menu and `/admin/merchants/[id]`'s Store status card.
 *
 * The explicit `<typeof suspendSchema, unknown>` type argument matches
 * `src/server/admin/claims.ts`'s own documented reason for its identical
 * `Promise<ActionResult<unknown>>` annotation: with two independent
 * `return` statements (the success path and the `catch` refusal) and no
 * generic context otherwise driving inference, TypeScript widens the
 * literal `{ ok: true }` branch away entirely rather than unioning it with
 * `{ ok: false, error }` — `unknown` is what lets an actual `{ ok: true }`
 * object literal satisfy `{ ok: true } & unknown`.
 */
export const suspendStore = adminAction<typeof suspendSchema, unknown>({
  schema: suspendSchema,
  handler: async (ctx, { merchantId, reason }) => {
    try {
      await setOrganizationSuspended({
        merchantId,
        suspend: true,
        reason,
        actorUserId: ctx.userId,
      });
    } catch (error) {
      if (isRecordNotFound(error)) {
        return { ok: false, error: { form: [strings.admin.errors.generic] } };
      }
      throw error;
    }

    return { ok: true };
  },
});

/** The symmetric restore, from either of the same two entry points. */
export const restoreStore = adminAction<typeof restoreSchema, unknown>({
  schema: restoreSchema,
  handler: async (ctx, { merchantId, note }) => {
    try {
      await setOrganizationSuspended({
        merchantId,
        suspend: false,
        reason: note,
        actorUserId: ctx.userId,
      });
    } catch (error) {
      if (isRecordNotFound(error)) {
        return { ok: false, error: { form: [strings.admin.errors.generic] } };
      }
      throw error;
    }

    return { ok: true };
  },
});
