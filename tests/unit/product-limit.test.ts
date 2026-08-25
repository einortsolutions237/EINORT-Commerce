import { describe, expect, it } from "vitest";

import {
  PLANS,
  PLAN_TIERS,
  productLimitFor,
} from "@/server/entitlements/plans";

/**
 * SUB-01, the catalog half — the carried-forward 02-CONTEXT.md D-07 product cap.
 *
 * `PlanLimits.products` was REGISTERED in Phase 2 and enforced by nothing. This
 * file is one half of making it real; `tests/isolation/catalog.test.ts` is the
 * other, and the two prove different things on purpose. Here: the resolver
 * returns the right number for every tier and fails closed for everything else,
 * with no database and no clock. There: `createProduct` actually refuses, and
 * writes no row when it does.
 *
 * The tier cases are DRIVEN FROM `PLAN_TIERS` rather than typed out. A fourth
 * tier added to the registry without a `limits.products` value would otherwise
 * slip through a hand-written three-case table — the same drift-detection
 * discipline `TENANT_SCOPED_MODELS` applies to the schema.
 *
 * The voice is `tests/unit/entitlements.test.ts`'s, and the numbers come from
 * the same source: `.planning/phases/02-merchant-auth-entitlements-trial/
 * pricing-reference.md` (v4.0 Master Specification § 4.4) — Starter 50,
 * Business 250, Professional unlimited.
 */

/**
 * The values the registry is expected to hold, written out ONCE, independently
 * of `PLANS`. Reading the expectation out of the object under test would make
 * the assertion tautological: a backfill that set every tier to `null` would
 * still pass. This table is the second, independent expression of the rule.
 */
const EXPECTED_CAP: Readonly<Record<string, number | null>> = {
  starter: 50,
  business: 250,
  professional: null,
};

describe("registry", () => {
  it("declares a products cap for every tier, with no key left unexpected", () => {
    // A fourth tier has to be added to EXPECTED_CAP before this file will pass,
    // which is the whole point of driving the cases from PLAN_TIERS.
    expect([...PLAN_TIERS].sort()).toEqual(Object.keys(EXPECTED_CAP).sort());
  });

  it.each(PLAN_TIERS)("PLANS.%s.limits.products matches the pricing reference", (tier) => {
    expect(PLANS[tier].limits.products).toBe(EXPECTED_CAP[tier]);
  });
});

describe("product limit", () => {
  it.each(PLAN_TIERS)("resolves %s to its registered cap", (tier) => {
    expect(productLimitFor({ planTier: tier })).toBe(EXPECTED_CAP[tier]);
  });

  it("resolves professional to null — unlimited, not a large number", () => {
    // Stated separately because `null` is load-bearing at every call site:
    // `limitFor` returns `null` rather than `Infinity` so a caller that forgets
    // to handle unlimited gets a type error, not a comparison that always
    // passes.
    expect(productLimitFor({ planTier: "professional" })).toBeNull();
  });
});

describe("product limit fails closed", () => {
  /**
   * The three ways `organization.planTier` can fail to be a tier. The column is
   * `String?`, so nothing at the type level stops any of them, and returning
   * `null` (unlimited) for any of them would let one bad backfill grant every
   * merchant on the platform an unlimited catalogue.
   */
  const notATier: readonly { planTier?: string | null }[] = [
    {},
    { planTier: undefined },
    { planTier: null },
    { planTier: "enterprise" },
    { planTier: "" },
    { planTier: "STARTER" },
  ];

  it.each(notATier)("resolves %j to the Starter cap, never to unlimited", (org) => {
    expect(productLimitFor(org)).toBe(EXPECTED_CAP.starter);
    expect(productLimitFor(org)).not.toBeNull();
  });
});
