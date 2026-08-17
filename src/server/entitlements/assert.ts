import "server-only";

import type { MerchantContext } from "./resolve";

/**
 * The entitlement guards — SUB-01 and SUB-02 at the call site.
 *
 * Each check exists in two forms on purpose:
 *
 *   - a **boolean** (`can`, `limitFor`) for rendering. A page that hides a
 *     button is a courtesy to the merchant, not a control.
 *   - a **throw** (`assertEntitlement`, `assertCanWrite`) for writes. "Forgot
 *     to check the return value" is a silent bypass; "forgot to call the
 *     assert" is at least a reviewable absence, and the thrown error is loud
 *     the first time it is exercised.
 *
 * Mixing them up is the failure mode this pairing is designed to make obvious:
 * a mutation whose only gate is `if (can(...))` has no gate at all when the
 * caller drops the `if`.
 *
 * Both errors carry a caller-supplied message rather than composing one here.
 * The copy the merchant sees lives in `src/lib/strings.ts` (the locked
 * English-copy decision from Phase 1); this module must not become a second
 * place where user-facing text is written.
 */

/** A feature flag on `PlanLimits` — the boolean-valued entitlements. */
export type PlanFeature = "discountCodes" | "bulkImport";

/** A numeric limit on `PlanLimits`. `null` from `limitFor` means unlimited. */
export type PlanLimitKey = "members" | "products" | "editorSections";

/**
 * The tenant's plan does not include the requested feature. Carries `feature`
 * so a handler can log or branch on which gate refused without parsing the
 * message.
 */
export class EntitlementError extends Error {
  readonly feature: string;

  constructor(feature: string, message: string) {
    super(message);
    this.name = "EntitlementError";
    this.feature = feature;
  }
}

/**
 * D-08: the trial has ended without a subscription, so the dashboard is
 * read-only. Distinct from `EntitlementError` because the remedy is different —
 * subscribe, rather than upgrade tier — and the merchant must never be left
 * guessing which of the two just happened to them.
 */
export class ReadOnlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadOnlyError";
  }
}

/** Rendering-time question: does this tenant's plan include the feature? */
export function can(ctx: MerchantContext, feature: PlanFeature): boolean {
  return ctx.plan.limits[feature];
}

/**
 * The tenant's numeric cap for `key`, or `null` for unlimited.
 *
 * `null` is returned rather than `Infinity` so a caller that forgets to handle
 * unlimited gets a type error instead of a comparison that quietly always
 * passes.
 */
export function limitFor(
  ctx: MerchantContext,
  key: PlanLimitKey,
): number | null {
  return ctx.plan.limits[key];
}

/** Write-time gate for a feature entitlement. Throws rather than returning. */
export function assertEntitlement(
  ctx: MerchantContext,
  feature: PlanFeature,
  message: string,
): void {
  if (!can(ctx, feature)) {
    throw new EntitlementError(feature, message);
  }
}

/**
 * Write-time gate for the trial/subscription state (SUB-02). Every mutation
 * path is built on this — reads stay allowed, which is what makes D-08
 * read-only rather than a lockout.
 */
export function assertCanWrite(ctx: MerchantContext, message: string): void {
  if (!ctx.canWrite) {
    throw new ReadOnlyError(message);
  }
}
