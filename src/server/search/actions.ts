"use server";

import { z } from "zod";

import { strings } from "@/lib/strings";
import { merchantAction } from "@/server/merchant/action";
import { searchLimiter } from "@/server/rate-limit";

import { searchMerchantSurface, type SearchMerchantSurfaceResult } from "./queries";

/**
 * Quick task 260906-egn — the Server Action behind the Cmd/Ctrl+K search
 * modal. `"use server"` is the first line, mutually exclusive with the
 * `import "server-only"` in `./queries.ts`, because this module has to be
 * callable from `dashboard-topbar-search.tsx`, a Client Component.
 *
 * ---------------------------------------------------------------------------
 * `mode: "read"`, NOT `"write"` — THIS CODEBASE'S FIRST READ-MODE CALLER.
 * ---------------------------------------------------------------------------
 * `merchantAction({ mode: "read" })` skips the `ctx.canWrite` gate entirely.
 * That is correct here, not an oversight: a merchant on an expired trial is
 * D-08 read-only, not locked out, and must still be able to find their own
 * products and orders. Refusing search on an expired trial would make the
 * read-only state feel like a full lockout for no security benefit — nothing
 * this action touches is a write.
 *
 * ---------------------------------------------------------------------------
 * THE SCHEMA IS `{ q }` AND NOTHING ELSE, EVER.
 * ---------------------------------------------------------------------------
 * No `tenantId` field, following the same rule every other merchant action in
 * this codebase follows (`tests/unit/no-tenant-id-param.test.ts`'s invariant):
 * identity comes from `ctx`, which `merchantAction` resolves from the session
 * before this handler ever runs, never from the payload a caller controls.
 * The `.max(64)` cap is a security control, not cosmetics — an unbounded
 * `contains` term is a free sequential scan over the tenant's tables, and 64
 * characters is far past any real product name or order number this schema
 * needs to match.
 *
 * The rate limiter runs BEFORE the database read, per T-egn-03 in this plan's
 * threat model, and unexpected errors rethrow uncaught rather than being
 * swallowed into an empty result set — `merchantAction`'s own documented
 * contract, and the reason a genuine search failure surfaces as an error
 * instead of silently rendering "no results" and hiding the fault.
 */
const searchSchema = z.object({
  q: z.string().trim().min(1).max(64),
});

export const searchMerchantSurfaceAction = merchantAction({
  mode: "read",
  schema: searchSchema,
  async handler(
    ctx,
    { q },
  ): Promise<
    | ({ ok: true } & SearchMerchantSurfaceResult)
    | { ok: false; error: Record<string, string[]> }
  > {
    const { success } = await searchLimiter.limit(ctx.tenantId);
    if (!success) {
      return {
        ok: false,
        error: { form: [strings.dashboard.topbar.rateLimited] },
      };
    }

    const { products, orders } = await searchMerchantSurface(ctx.tenantId, q);
    return { ok: true, products, orders };
  },
});
