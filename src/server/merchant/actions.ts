"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { strings } from "@/lib/strings";
import { auth } from "@/server/auth/auth";
import { platformDb } from "@/server/db/platform";
import { PLAN_TIERS } from "@/server/entitlements/plans";

/**
 * Merchant-owned writes that run OUTSIDE the entitlement wrapper.
 *
 * `"use server"` is the first line and there is deliberately no
 * `import "server-only"` beside it: the two markers are mutually exclusive.
 * A `"use server"` module is compiled as a server-action entry point, which is
 * exactly what makes it reachable from a client island — `server-only` asserts
 * the opposite and would fail the build.
 */

/**
 * SUB-01 / D-05: the plan pick is a real, recorded choice.
 *
 * ---------------------------------------------------------------------------
 * IDENTITY COMES FROM THE SESSION AND NOWHERE ELSE (T-02-06, T-02-07).
 * ---------------------------------------------------------------------------
 * The schema below accepts a tier and nothing more — no organization id, no
 * tenant id, no user id — so there is no field an attacker could set to write
 * a plan onto someone else's store. A caller who forges extra keys has them
 * dropped by the parse, and the write still lands on
 * `session.session.activeOrganizationId`. This action is reachable by a direct
 * POST without ever loading the form, so it is treated as a public endpoint:
 * the schema IS the trust boundary, and `tests/isolation/plan-selection.test.ts`
 * proves it with a real second-tenant id rather than an invented one.
 *
 * ---------------------------------------------------------------------------
 * DELIBERATELY NOT ROUTED THROUGH `merchantAction` (plan 02-03).
 * ---------------------------------------------------------------------------
 * At this exact point in the flow `planTier` is null, and the wrapper's context
 * resolver redirects precisely that state back to `/onboarding/plan`. Routing
 * the selection itself through the wrapper would therefore loop the merchant on
 * the screen they are trying to leave. This is the one merchant write that
 * legitimately runs before entitlements exist; everything after it goes through
 * the wrapper.
 */
const selectPlanSchema = z.object({ tier: z.enum(PLAN_TIERS) });

export type SelectPlanResult =
  | { ok: true; slug: string }
  | { ok: false; error: Record<string, string[]> };

export async function selectPlan(input: unknown): Promise<SelectPlanResult> {
  const parsed = selectPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    // The page redirects unauthenticated visitors to /login; reaching this
    // branch means the session expired between render and submit — or that the
    // action was posted directly with no session at all. Either way: no write.
    return { ok: false, error: { form: [strings.signup.sessionExpired] } };
  }

  /**
   * The single source of the target. If the session carries no active
   * organization the honest answer is the same session-expired result — NOT a
   * lookup of "an organization this user belongs to". Searching would quietly
   * re-derive a tenant the session does not actually assert, which is the exact
   * shape of the bug this schema is designed to make impossible.
   */
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) {
    return { ok: false, error: { form: [strings.signup.sessionExpired] } };
  }

  const organization = await platformDb.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true, planTier: true },
  });
  if (!organization) {
    return { ok: false, error: { form: [strings.signup.sessionExpired] } };
  }

  /**
   * Idempotence, not authorization — the same reasoning as the store guard in
   * `createStoreForCurrentUser`. A merchant who double-submits, or who lands
   * here from a stale tab after the choice was recorded, should simply be sent
   * on to their store. Re-writing would also silently re-price a store from a
   * replayed request, and `planSelectedAt` is the trial's anchor: moving it
   * would extend the trial (ONB-05).
   */
  if (organization.planTier !== null) {
    return { ok: true, slug: organization.slug };
  }

  const updated = await platformDb.organization.update({
    where: { id: organizationId },
    data: { planTier: parsed.data.tier, planSelectedAt: new Date() },
    select: { slug: true },
  });

  return { ok: true, slug: updated.slug };
}
