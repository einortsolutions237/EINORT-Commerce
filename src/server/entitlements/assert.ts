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

/**
 * EDIT-03: the merchant may not use the storefront editor — a Starter tier
 * whose trial has ended (D-13/D-15).
 *
 * EXTENDS `EntitlementError` ON PURPOSE, AND THE SUBCLASS RELATIONSHIP IS THE
 * FEATURE. An editor refusal *is* an entitlement refusal, so this inherits the
 * `feature` field and, more importantly, `merchantAction`'s existing
 * `instanceof EntitlementError` arm converts it into
 * `{ ok: false, error: { form: [message] } }` with NO change to that file's
 * control flow. Declaring it as a bare `Error` instead would mean the merchant
 * sees an unhandled 500 where they should see "you're on the Starter plan".
 *
 * The `this.name` re-assignment is not redundant: `EntitlementError`'s own
 * constructor has already set it to `"EntitlementError"` by the time `super()`
 * returns, so without the line below every log line for an editor refusal
 * would name the parent class. Assigned in the constructor rather than as an
 * `override readonly name` field to match the two classes above it.
 */
export class EditorLockedError extends EntitlementError {
  constructor(message: string) {
    super("storefrontEditor", message);
    this.name = "EditorLockedError";
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

/**
 * Write-time gate for the storefront editor (EDIT-03). The THROWING half of
 * the pair — `ctx.canEditStorefront` is the boolean half, and it is the only
 * thing a disabled `Save` button should be rendered from.
 *
 * Use this one on every editor mutation. A save path whose only gate is
 * `if (ctx.canEditStorefront)` has no gate at all the day someone drops the
 * `if`, which is the failure mode the header of this file describes: a Server
 * Action is reachable by a direct POST that never rendered the editor.
 *
 * Reads `ctx.canEditStorefront` and never `ctx.plan.limits.storefrontEditor`.
 * The registry value is tier-only; `resolveEntitlements` is what folds D-15's
 * trial grant into it.
 *
 * `message` is caller-supplied (`strings.editor.starterViewOnly`) and is never
 * composed here — this module must not become a second home for user-facing
 * copy.
 */
export function assertCanEditStorefront(
  ctx: MerchantContext,
  message: string,
): void {
  if (!ctx.canEditStorefront) {
    throw new EditorLockedError(message);
  }
}
