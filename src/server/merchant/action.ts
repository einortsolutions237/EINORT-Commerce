import "server-only";

import { z } from "zod";

import { strings } from "@/lib/strings";
import {
  EntitlementError,
  ReadOnlyError,
} from "@/server/entitlements/assert";
import type { MerchantContext } from "@/server/entitlements/resolve";

import { requireMerchantContext } from "./context";

/**
 * The write gate — D-08 / SUB-02 as a wrapper, not as a convention.
 *
 * ---------------------------------------------------------------------------
 * WHY A WRAPPER AND NOT A CHECK EVERY ACTION IS TRUSTED TO CALL.
 * ---------------------------------------------------------------------------
 * Next has no framework-level hook that runs before all Server Actions, and its
 * own guidance is blunt about what that means: treat a Server Action as a
 * public-facing API endpoint, because render-time gating is not a security
 * boundary — a request can be sent without going through the UI at all. The
 * disabled button in an expired-trial dashboard is UX; it is assumed bypassed.
 * The only structural answer left is to make the guarded action the *easiest*
 * action to write, so the unguarded one has to be built on purpose.
 *
 * Three properties are load-bearing and none of them is a default:
 *
 *   1. `mode` is REQUIRED. There is no default value, because a default makes
 *      the safe choice the one you have to remember — which is the failure this
 *      wrapper exists to remove. A new action does not compile until its author
 *      has answered "does this write?".
 *   2. The handler receives `ctx` and the PARSED input, never the raw payload.
 *      It therefore has no channel through which to read a tenant id out of the
 *      request even if it wanted to; the tenant arrives only via `ctx`, which
 *      came from the session (TEN-04).
 *   3. `requireMerchantContext()` redirects rather than returning null, so an
 *      unauthenticated, suspended or plan-less caller never reaches the handler.
 *
 * Deliberately NOT `next-safe-action`. The `{ ok, error }` union below is the
 * repository's existing convention — `signUpMerchant`, `createStoreForCurrentUser`
 * and `selectPlan` all speak it, and the forms consume it — so adopting a
 * library's own result shape here would fork the contract across the codebase
 * for no gain. It is also a package this phase's zero-install audit would have
 * to justify.
 *
 * `import "server-only"` and not `"use server"`: this module exports a FACTORY,
 * not an action. Every export of a `"use server"` module must be an async
 * function that Next can register as an endpoint, and a generic higher-order
 * function is not that. Callers put `"use server"` at the top of their own
 * action module and build the exported action with `merchantAction({ … })`.
 */

/**
 * The result every merchant action returns.
 *
 * `error` is keyed by field name so a form can render each message beside the
 * input that produced it; `form` is the conventional key for a message that
 * belongs to the whole submission — which is what a read-only refusal is.
 */
export type ActionResult<T = void> =
  | ({ ok: true } & T)
  | { ok: false; error: Record<string, string[]> };

export function merchantAction<S extends z.ZodType, R>(config: {
  mode: "read" | "write";
  schema: S;
  handler: (ctx: MerchantContext, input: z.infer<S>) => Promise<ActionResult<R>>;
}) {
  return async (raw: unknown): Promise<ActionResult<R>> => {
    // Identity and entitlements first, before anything looks at the payload.
    const ctx = await requireMerchantContext();

    /*
     * The refusal, ahead of the parse and ahead of every database call.
     *
     * Order is deliberate: an expired merchant's write must cost nothing and
     * touch nothing, so a replayed or scripted POST cannot be used to probe
     * validation behaviour or to generate load against Postgres.
     *
     * It is not a 403 page and not a redirect. The merchant is legitimately
     * signed in and legitimately looking at this data — D-08 is read-only, not
     * lockout — so they are told, in the place they tried to act, exactly why
     * it did not happen. Leaving them to guess is the confusion CONTEXT.md's
     * <specifics> forbids.
     */
    if (config.mode === "write" && !ctx.canWrite) {
      return { ok: false, error: { form: [strings.trial.readOnlyBlocked] } };
    }

    const parsed = config.schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: z.flattenError(parsed.error).fieldErrors as Record<
          string,
          string[]
        >,
      };
    }

    /*
     * A handler may still refuse on its own terms — a member limit reached, a
     * feature the tier does not include — and the throwing guards in
     * `src/server/entitlements/assert.ts` exist precisely so a dropped
     * return-value check cannot become a silent bypass. Converting those two
     * error types here is what lets a handler use the throwing form and still
     * produce a message the form can render, instead of a 500.
     *
     * Everything else rethrows. An unexpected error must stay an error:
     * swallowing it into `{ ok: false }` would dress a bug up as a validation
     * message and hide it from both the merchant and the logs.
     */
    try {
      return await config.handler(ctx, parsed.data as z.infer<S>);
    } catch (error) {
      if (error instanceof ReadOnlyError || error instanceof EntitlementError) {
        return { ok: false, error: { form: [error.message] } };
      }
      throw error;
    }
  };
}
