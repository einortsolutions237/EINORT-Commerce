import "server-only";

/**
 * The plan registry — SUB-01's single source of truth.
 *
 * Plan differences are *data*, not conditionals. Every plan-dependent decision
 * in the codebase reads from this table; there is no `if (plan === "…")`
 * anywhere outside `src/server/entitlements/**`. That is the same discipline
 * `TENANT_SCOPED_MODELS` applies to tenant scoping: one registry, and drifting
 * from it is a compile error rather than a discovery in production.
 *
 * Two things deliberately do NOT live here:
 *
 *   - **Marketing copy.** The per-tier bullet lists D-02 asks for are
 *     user-facing text and belong in `src/lib/strings.ts`. Prices are
 *     enforcement inputs and belong in code. Keeping them apart is what stops
 *     a copy revision from silently changing a limit.
 *   - **Database access.** This module is pure data plus two pure functions,
 *     with no data-access import of any kind, which is what lets the unit suite
 *     prove SUB-01 with no database at all.
 *
 * Source for every number below:
 * `.planning/phases/02-merchant-auth-entitlements-trial/pricing-reference.md`
 * (v4.0 Master Specification § 4.4).
 */

export const PLAN_TIERS = ["starter", "business", "professional"] as const;

export type PlanTier = (typeof PLAN_TIERS)[number];

/**
 * D-07: every limit this product will ever gate is REGISTERED here now, even
 * where nothing reads it yet. A registered-but-unenforced key is a later-phase
 * wiring task with a compile-time home; an unregistered one is a design
 * decision somebody makes ad hoc, under time pressure, in a feature branch.
 *
 * `null` means unlimited. A missing key is a type error rather than a silently
 * permissive `undefined`, which is the whole reason this is an interface over a
 * `Record` rather than a loose object.
 */
export interface PlanLimits {
  /**
   * Total organization members, INCLUSIVE OF THE OWNER (pricing-reference OQ-2:
   * "up to 3 staff accounts" is a limit of 4).
   *
   * ENFORCED THIS PHASE, via Better Auth's `membershipLimit`.
   *
   * Starter is 1 — owner only — and must never be written as 0. Better Auth
   * resolves the cap as `ctx.context.orgOptions?.membershipLimit || 100`
   * (`plugins/organization/routes/crud-members.mjs`), so a falsy 0 evaluates to
   * **100**: the tier with the tightest limit would silently receive the
   * loosest one in the product. The guard is `count >= limit` and the owner is
   * itself a member, so 1 is both correct and safe.
   */
  readonly members: number;
  /**
   * Total ACTIVE products in the merchant's catalogue. `null` is unlimited.
   *
   * ENFORCED, as of Phase 3, by `createProduct` in
   * `src/server/catalog/actions.ts` — which counts before it writes and refuses
   * at `count >= limit` with `strings.entitlements.productLimitReached`. The
   * disabled `Add product` button on `/dashboard/products` is a courtesy; the
   * action is the control (SUB-01), because a Server Action is reachable by a
   * direct POST that never loaded the page.
   *
   * Deactivated products do NOT count. D-08 forbids deletion, so counting
   * hidden rows would ratchet the cap permanently downward with no recovery
   * path — which reads to a merchant as a bug rather than as a limit.
   */
  readonly products: number | null;
  /** ENFORCED FROM PHASE 4 (EDIT-03, editor sections). Registered now. */
  readonly editorSections: number | null;
  /** ENFORCED IN v2 (COM-V2-01, discount codes). Registered now. */
  readonly discountCodes: boolean;
  /** ENFORCED IN v2 (COM-V2-03, bulk product import). Registered now. */
  readonly bulkImport: boolean;
}

export interface PlanDefinition {
  readonly tier: PlanTier;
  /**
   * Whole XAF. The currency has no decimal subunit in common use, so there is
   * no minor-unit integer to convert from and no rounding decision to get
   * wrong.
   */
  readonly monthlyPriceXaf: number;
  /** D-04: Business is pre-highlighted as "Most Popular". */
  readonly recommended: boolean;
  readonly limits: PlanLimits;
}

/**
 * `Readonly<Record<PlanTier, …>>` rather than a lookup with a default: adding a
 * fourth tier becomes a compile error at every incomplete table in the
 * codebase, which is exactly the drift detection the tenant-model registry
 * provides. A default would turn the same change into a silent fallback.
 *
 * `editorSections` is `null` on all three tiers because Phase 4 has not yet
 * decided the per-tier section caps; the key exists so that decision has
 * somewhere to land, and `null` (unlimited) is the honest description of what
 * is enforced today.
 */
export const PLANS: Readonly<Record<PlanTier, PlanDefinition>> = {
  starter: {
    tier: "starter",
    monthlyPriceXaf: 5_000,
    recommended: false,
    limits: {
      members: 1,
      products: 50,
      editorSections: null,
      discountCodes: false,
      bulkImport: false,
    },
  },
  business: {
    tier: "business",
    monthlyPriceXaf: 12_500,
    recommended: true,
    limits: {
      members: 4,
      products: 250,
      editorSections: null,
      discountCodes: true,
      bulkImport: true,
    },
  },
  professional: {
    tier: "professional",
    monthlyPriceXaf: 25_000,
    recommended: false,
    limits: {
      members: 11,
      products: null,
      editorSections: null,
      discountCodes: true,
      bulkImport: true,
    },
  },
} as const;

const TIER_SET: ReadonlySet<string> = new Set(PLAN_TIERS);

/**
 * Narrows an untrusted value — a nullable database column, a form field, a
 * request body — to a real tier. Everything that reads `organization.planTier`
 * goes through this, because the column is `String?` and nothing at the type
 * level stops it holding `"enterprise"` after a bad backfill.
 */
export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === "string" && TIER_SET.has(value);
}

/**
 * The organization's member cap, for Better Auth's `membershipLimit`.
 *
 * Takes a structural shape rather than a Prisma model so this module stays
 * outside the generated client's blast radius and testable without a database.
 *
 * Fails **closed**: an absent, null or unrecognised tier resolves to 1 (owner
 * only), never to 0 and never to Better Auth's 100 default. A merchant who has
 * not picked a plan yet is gated to `/onboarding/plan` (D-05) rather than
 * granted seats.
 */
export function memberLimitFor(org: { planTier?: string | null }): number {
  const tier = org.planTier;
  return isPlanTier(tier)
    ? PLANS[tier].limits.members
    : PLANS.starter.limits.members;
}

/**
 * The organization's ACTIVE-product cap (CAT-01 / SUB-01). `null` is unlimited.
 *
 * Mirrors `memberLimitFor` line for line, deliberately: same structural
 * parameter shape, same registry lookup, same fail-closed fallback. Two caps
 * that resolve differently are two chances to be wrong, and the second one is
 * always the one nobody re-reads.
 *
 * Fails **closed**: an absent, null or unrecognised tier resolves to the
 * Starter cap, never to `null`. `organization.planTier` is a `String?` column
 * and nothing at the type level stops it holding `"enterprise"` after a bad
 * backfill — and returning `null` (unlimited) for an unknown tier would let one
 * such backfill grant every merchant on the platform an unlimited catalogue.
 * The tighter answer is the recoverable one: a merchant who is wrongly capped
 * complains, a merchant who is wrongly uncapped is discovered at the bill.
 *
 * `null` rather than `Infinity` for the genuinely unlimited tier, matching
 * `limitFor`: a caller who forgets to handle unlimited gets a type error rather
 * than a comparison that quietly always passes.
 */
export function productLimitFor(org: {
  planTier?: string | null;
}): number | null {
  const tier = org.planTier;
  return isPlanTier(tier)
    ? PLANS[tier].limits.products
    : PLANS.starter.limits.products;
}
