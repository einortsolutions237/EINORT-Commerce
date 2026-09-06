import "server-only";

import { PLAN_TIER_RANK, type PlanTier } from "@/server/entitlements/plans";
import type { MerchantContext } from "@/server/entitlements/resolve";
import { TemplateLockedError } from "@/server/theming/errors";
import {
  TEMPLATE_KEYS,
  TEMPLATES,
  type TemplateKey,
} from "@/server/theming/registry";

/**
 * The template-tier gate — D-06 / D-08 / D-12 made real. TMPL-04's 10/15/25
 * split is enforced HERE, as a per-template `minTier` comparison, never as a
 * count against `PlanLimits.templates` (see that key's own warning in
 * `plans.ts`).
 *
 * ---------------------------------------------------------------------------
 * THE GATE IS ON THE WRITE, NEVER ON THE RENDER.
 * ---------------------------------------------------------------------------
 * A merchant who downgrades keeps rendering their existing template forever
 * (D-12, the corollary to D-03's no-auto-migration rule) — `registry.ts`'s
 * `variantsForTemplate` and the storefront renderer never consult this
 * module. Only the picker (a boolean, for hiding a card) and `switchTemplate`
 * / `saveBranding` (a throw, for refusing a write) call into these functions.
 * Nothing else needs to, and nothing else should.
 *
 * ---------------------------------------------------------------------------
 * D-12'S DELIBERATE DIVERGENCE FROM `assertCanEditStorefront`.
 * ---------------------------------------------------------------------------
 * `assertTemplateAccess` below reads `ctx.plan.tier` DIRECTLY. It never reads
 * `ctx.canEditStorefront` and never composes a trial-elevated boolean, which
 * is the OPPOSITE of what `assertCanEditStorefront`
 * (`src/server/entitlements/assert.ts`) does with the editor grant. That
 * asymmetry is not an oversight:
 *
 *   - D-15 elevates the EDITOR during the 10-day trial because losing it at
 *     expiry costs the merchant nothing they can see — the storefront they
 *     already published keeps rendering exactly as it did the day before.
 *   - A template grant is a durable choice. Elevating it during a trial would
 *     mean one of two outcomes at expiry, and both are unacceptable: either
 *     force-migrating a live storefront back off the template it was built
 *     on (PERMANENTLY BANNED — see `registry.ts`'s D-03 header), or simply
 *     never enforcing the gate at all, which is Pitfall 6 from
 *     `05-RESEARCH.md`: a picker that filters correctly so manual testing
 *     passes, while a direct POST with an out-of-tier key succeeds.
 *
 * A later reader who "fixes" this by making the two consistent — pointing
 * `assertTemplateAccess` at `ctx.canEditStorefront`, say — reopens exactly
 * that hole. `tests/isolation` plan 05-21 pins this with an ACTIVE-trial
 * Starter context asserting a Professional-tier template is still refused.
 */

/**
 * Rendering-time question: may `tier` select `key` from the picker? A `false`
 * result hides a card; it is a courtesy, not a control. `assertTemplateAccess`
 * below is the control.
 */
export function canUseTemplate(tier: PlanTier, key: TemplateKey): boolean {
  return PLAN_TIER_RANK[tier] >= PLAN_TIER_RANK[TEMPLATES[key].minTier];
}

/**
 * Every template key `tier` may reach, in `TEMPLATE_KEYS` declaration order.
 * Order comes from `TEMPLATE_KEYS` itself rather than a second ordering kept
 * in sync, matching this registry's own no-parallel-list discipline.
 *
 * Fails **closed**, mirroring `productLimitFor` (`plans.ts:238-245`): an
 * unrecognised tier string resolves to the Starter set, never to all 50.
 * `tier` is typed `string` rather than `PlanTier` for exactly this reason —
 * the caller may be narrowing an untrusted value, and the fail-closed
 * behavior only matters if the type system cannot already rule it out.
 */
export function accessibleTemplateKeys(tier: string): readonly TemplateKey[] {
  const rank = Object.prototype.hasOwnProperty.call(PLAN_TIER_RANK, tier)
    ? PLAN_TIER_RANK[tier as PlanTier]
    : PLAN_TIER_RANK.starter;

  return TEMPLATE_KEYS.filter(
    (key) => rank >= PLAN_TIER_RANK[TEMPLATES[key].minTier],
  );
}

/**
 * Write-time gate for a template selection (`switchTemplate`, `saveBranding`
 * at onboarding). Throws `TemplateLockedError` rather than returning, in the
 * same register as `assertEntitlement`/`assertCanWrite`
 * (`src/server/entitlements/assert.ts`): a mutation whose only gate is
 * `if (canUseTemplate(...))` has no gate at all the day a caller drops the
 * `if`, and this is the reviewable, always-present half of the pair.
 *
 * Reads `ctx.plan.tier` directly — see the module header for why this must
 * never become `ctx.canEditStorefront` or any trial-composed boolean.
 */
export function assertTemplateAccess(
  ctx: MerchantContext,
  key: TemplateKey,
  message: string,
): void {
  if (!canUseTemplate(ctx.plan.tier, key)) {
    throw new TemplateLockedError(key, message);
  }
}
