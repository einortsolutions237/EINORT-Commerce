import "server-only";

import { z } from "zod";

// Type-only, and that is the whole point. `import type` is erased at build
// time, so this creates NO runtime coupling between the admin zone and the
// merchant zone — nothing from `src/server/merchant/**` is loaded, called, or
// bundled here. TEN-05's isolation is about not reusing tenant-scoped code
// paths; it is not about forking a result SHAPE that every form in this
// codebase already consumes. Duplicating `ActionResult` would fork that
// contract for no security gain and guarantee the two copies drift.
import type { ActionResult } from "@/server/merchant/action";

import { requireAdminContext, type AdminContext } from "./context";

/**
 * The admin action factory — `merchantAction` for a surface with no tenant.
 *
 * The rationale for a wrapper at all is `src/server/merchant/action.ts`'s and
 * is not restated here: Next has no framework-level hook that runs before all
 * Server Actions, its own guidance is to treat an action as a public API
 * endpoint, and the only structural answer is to make the guarded action the
 * easiest one to write. That argument applies unchanged, and with more force —
 * an unguarded admin action is unguarded across every tenant at once, because
 * `adminDb` carries no tenant predicate to fall back on.
 *
 * `import "server-only"` and not `"use server"`, for the same reason the
 * merchant factory does it: this module exports a FACTORY, not an action. Every
 * export of a `"use server"` module must be an async function Next can register
 * as an endpoint, and a generic higher-order function is not that. Callers put
 * `"use server"` at the top of their own action module and build the exported
 * action with `adminAction({ … })`.
 *
 * ---------------------------------------------------------------------------
 * THREE DELIBERATE DIFFERENCES FROM `merchantAction`. NONE IS AN OMISSION.
 * ---------------------------------------------------------------------------
 *
 *   1. NO `mode: "read" | "write"` AXIS. `mode` is required on the merchant
 *      side because D-08's read-only trial state is a real thing a merchant can
 *      be in, and a default would make the safe answer the one you have to
 *      remember. The platform owner has no plan, no trial and no subscription
 *      (D-04) — there is no state in which their writes are refused, so a
 *      `mode` here would be a required parameter with exactly one legal value.
 *      That is worse than absent: it reads as a live control while enforcing
 *      nothing, and the first person to notice would delete it.
 *
 *   2. NO `EntitlementError`/`ReadOnlyError` CONVERSION. Both are thrown by
 *      `src/server/entitlements/assert.ts`, which is tenant-surface code the
 *      admin zone does not call. Catching them here would be catching errors
 *      that cannot arrive; worse, the `catch` block itself would be the thing a
 *      future reader trusts, and it would silently swallow nothing while
 *      looking like it handled something. Every error from an admin handler
 *      propagates. An unexpected error must stay an error, visible in the logs.
 *
 *   3. `notFound()` INSTEAD OF `redirect()`, inherited from
 *      `requireAdminContext()` — see D-06 in `./context.ts`. This is legal in a
 *      Server Action: Next 16's own reference states `notFound()` "can be
 *      invoked in Server Components, Server Functions, and Route Handlers".
 *      A merchant who POSTs an admin action directly gets a 404, exactly as if
 *      they had requested the page.
 *
 * What is NOT different, and is the load-bearing half: identity is resolved
 * BEFORE the payload is touched, and the handler receives `ctx` plus the PARSED
 * input, never the raw request body. A caller therefore has no channel through
 * which to smuggle an identity in, and an unauthorized POST costs one
 * `getSession` and zero database work beyond it.
 */
export function adminAction<S extends z.ZodType, R>(config: {
  schema: S;
  handler: (ctx: AdminContext, input: z.infer<S>) => Promise<ActionResult<R>>;
}) {
  return async (raw: unknown): Promise<ActionResult<R>> => {
    // Identity first, ahead of the parse and ahead of every database call.
    // A non-admin never reaches the schema, so the validation behaviour of this
    // surface cannot be probed by anyone who is not already on it.
    const ctx = await requireAdminContext();

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

    return config.handler(ctx, parsed.data as z.infer<S>);
  };
}
