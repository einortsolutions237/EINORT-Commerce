import { describe, expect, it } from "vitest";

import {
  PLANS,
  PLAN_TIERS,
  isPlanTier,
  memberLimitFor,
} from "@/server/entitlements/plans";
import {
  TRIAL_DAYS,
  TRIAL_URGENT_DAYS,
  isUrgentTrial,
  resolveEntitlements,
} from "@/server/entitlements/resolve";
import type { OrgRow } from "@/server/entitlements/resolve";

/**
 * ONB-05 (10-day trial, enforced server-side from signup) and SUB-01 (plan
 * differences exist as one server-enforced registry).
 *
 * Every assertion here runs with no database, no network and no clock mocking,
 * because `resolveEntitlements` takes `now` as a **parameter**. That single
 * design choice is what makes the whole trial lifecycle — day 1, day 9, the
 * day-10 boundary, the millisecond either side of it, and subscribed-after-
 * expiry — expressible as ordinary arithmetic in the fast `unit` project.
 *
 * The tier numbers are not invented here: 5 000 / 12 500 / 25 000 XAF and the
 * 1 / 4 / 11 member limits come from
 * `.planning/phases/02-merchant-auth-entitlements-trial/pricing-reference.md`
 * (v4.0 Master Specification § 4.4). The member limits are **inclusive of the
 * owner** — "up to 3 staff accounts" is a limit of 4 — and Starter is 1 rather
 * than 0 because Better Auth reads `membershipLimit || 100`, so a falsy 0
 * silently becomes the loosest limit in the product.
 *
 * The six top-level `describe` names below (`registry`, `member limit`,
 * `trial active`, `trial boundary`, `daysLeft`, `urgency`) are addressed by
 * `-t` filters in 02-VALIDATION.md's per-task verification map. Renaming one
 * breaks a documented command, not just a test label.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Signup instant for every row below. UTC, so no zone can drift the maths. */
const T0 = new Date("2026-08-01T00:00:00.000Z");

/** `TRIAL_DAYS` after T0 — the derived expiry when `trialEndsAt` is null. */
const DERIVED_END = new Date(T0.getTime() + TRIAL_DAYS * DAY_MS);

const at = (offsetMs: number): Date => new Date(T0.getTime() + offsetMs);

/**
 * The row shape is declared structurally by `resolve.ts`, never imported from
 * the generated Prisma client — the entitlement modules sit outside the lint
 * sanctuary, so a generated-client import there is a lint failure by design.
 */
const orgRow = (overrides: Partial<OrgRow> = {}): OrgRow => ({
  id: "org_alpha",
  name: "Ma Boutique",
  slug: "ma-boutique",
  status: "active",
  createdAt: T0,
  planTier: "starter",
  trialEndsAt: null,
  subscriptionStatus: "none",
  ...overrides,
});

describe("registry", () => {
  it("has exactly one entry per declared tier", () => {
    expect(Object.keys(PLANS).sort()).toEqual([...PLAN_TIERS].sort());
    expect(PLAN_TIERS).toHaveLength(3);
  });

  it("keys every entry by its own tier", () => {
    for (const tier of PLAN_TIERS) {
      expect(PLANS[tier].tier).toBe(tier);
    }
  });

  it("carries all five limit keys on every tier", () => {
    for (const tier of PLAN_TIERS) {
      expect(Object.keys(PLANS[tier].limits).sort()).toEqual([
        "bulkImport",
        "discountCodes",
        "editorSections",
        "members",
        "products",
      ]);
    }
  });

  it("prices the tiers at 5 000 / 12 500 / 25 000 XAF", () => {
    expect(PLANS.starter.monthlyPriceXaf).toBe(5_000);
    expect(PLANS.business.monthlyPriceXaf).toBe(12_500);
    expect(PLANS.professional.monthlyPriceXaf).toBe(25_000);
  });

  it("recommends business and only business (D-04)", () => {
    const recommended = PLAN_TIERS.filter((tier) => PLANS[tier].recommended);
    expect(recommended).toEqual(["business"]);
  });

  it("caps products at 50 / 250 / unlimited", () => {
    expect(PLANS.starter.limits.products).toBe(50);
    expect(PLANS.business.limits.products).toBe(250);
    expect(PLANS.professional.limits.products).toBeNull();
  });

  it("narrows only the three real tiers with isPlanTier", () => {
    for (const tier of PLAN_TIERS) {
      expect(isPlanTier(tier)).toBe(true);
    }
    for (const value of ["enterprise", "Starter", "", null, undefined, 1, {}]) {
      expect(isPlanTier(value)).toBe(false);
    }
  });
});

describe("member limit", () => {
  it("resolves 1 / 4 / 11 per tier, owner inclusive", () => {
    expect(memberLimitFor({ planTier: "starter" })).toBe(1);
    expect(memberLimitFor({ planTier: "business" })).toBe(4);
    expect(memberLimitFor({ planTier: "professional" })).toBe(11);
  });

  it("fails closed to owner-only when no plan has been chosen", () => {
    expect(memberLimitFor({ planTier: null })).toBe(1);
    expect(memberLimitFor({})).toBe(1);
  });

  it("fails closed to owner-only for an unknown tier", () => {
    expect(memberLimitFor({ planTier: "enterprise" })).toBe(1);
  });

  it("never returns 0 or 100 for any input", () => {
    const inputs = [
      { planTier: "starter" },
      { planTier: "business" },
      { planTier: "professional" },
      { planTier: null },
      { planTier: "enterprise" },
      {},
    ];
    for (const input of inputs) {
      const limit = memberLimitFor(input);
      expect(limit).toBeGreaterThan(0);
      expect(limit).not.toBe(100);
    }
  });
});

describe("trial active", () => {
  it("is active on day 1", () => {
    const ctx = resolveEntitlements(orgRow(), at(1 * DAY_MS));
    expect(ctx.trial.state).toBe("active");
    expect(ctx.canWrite).toBe(true);
  });

  it("is active on day 9", () => {
    const ctx = resolveEntitlements(orgRow(), at(9 * DAY_MS));
    expect(ctx.trial.state).toBe("active");
    expect(ctx.canWrite).toBe(true);
  });

  it("carries the tenant identity and resolved plan through", () => {
    const ctx = resolveEntitlements(
      orgRow({ planTier: "business" }),
      at(1 * DAY_MS),
    );
    expect(ctx.tenantId).toBe("org_alpha");
    expect(ctx.storeName).toBe("Ma Boutique");
    expect(ctx.storeSlug).toBe("ma-boutique");
    expect(ctx.plan).toBe(PLANS.business);
    expect(ctx.trial.endsAt.getTime()).toBe(DERIVED_END.getTime());
  });

  it("falls back to starter when the column holds an unknown tier", () => {
    const ctx = resolveEntitlements(
      orgRow({ planTier: "enterprise" }),
      at(1 * DAY_MS),
    );
    expect(ctx.plan).toBe(PLANS.starter);
  });

  it("falls back to starter when no plan has been chosen yet", () => {
    const ctx = resolveEntitlements(orgRow({ planTier: null }), at(1 * DAY_MS));
    expect(ctx.plan).toBe(PLANS.starter);
  });
});

describe("trial boundary", () => {
  it("is expired at exactly the end instant", () => {
    const ctx = resolveEntitlements(orgRow(), DERIVED_END);
    expect(ctx.trial.state).toBe("expired");
    expect(ctx.canWrite).toBe(false);
  });

  it("is still active one millisecond earlier", () => {
    const ctx = resolveEntitlements(
      orgRow(),
      new Date(DERIVED_END.getTime() - 1),
    );
    expect(ctx.trial.state).toBe("active");
    expect(ctx.canWrite).toBe(true);
  });

  it("is subscribed, and writable, once past the end with an active subscription", () => {
    const ctx = resolveEntitlements(
      orgRow({ subscriptionStatus: "active" }),
      at(30 * DAY_MS),
    );
    expect(ctx.trial.state).toBe("subscribed");
    expect(ctx.canWrite).toBe(true);
  });

  it("is subscribed rather than active while still inside the trial window", () => {
    const ctx = resolveEntitlements(
      orgRow({ subscriptionStatus: "active" }),
      at(1 * DAY_MS),
    );
    expect(ctx.trial.state).toBe("subscribed");
    expect(ctx.canWrite).toBe(true);
  });

  it("lets a stored trialEndsAt override the createdAt derivation", () => {
    const granted = at(30 * DAY_MS);
    const ctx = resolveEntitlements(
      orgRow({ trialEndsAt: granted }),
      at(20 * DAY_MS),
    );
    expect(ctx.trial.endsAt.getTime()).toBe(granted.getTime());
    expect(ctx.trial.state).toBe("active");
    expect(ctx.canWrite).toBe(true);
  });

  it("honours a trialEndsAt override that shortens the trial", () => {
    const cut = at(2 * DAY_MS);
    const ctx = resolveEntitlements(
      orgRow({ trialEndsAt: cut }),
      at(3 * DAY_MS),
    );
    expect(ctx.trial.endsAt.getTime()).toBe(cut.getTime());
    expect(ctx.trial.state).toBe("expired");
    expect(ctx.canWrite).toBe(false);
  });
});

describe("daysLeft", () => {
  it("is the full trial length at signup", () => {
    expect(resolveEntitlements(orgRow(), T0).trial.daysLeft).toBe(TRIAL_DAYS);
    expect(TRIAL_DAYS).toBe(10);
  });

  it("counts down a whole day at a time while the trial runs", () => {
    expect(resolveEntitlements(orgRow(), at(1 * DAY_MS)).trial.daysLeft).toBe(
      9,
    );
    expect(resolveEntitlements(orgRow(), at(9 * DAY_MS)).trial.daysLeft).toBe(
      1,
    );
  });

  it("rounds a part-day up, so it is 1 with three hours left and never 0 while active", () => {
    const ctx = resolveEntitlements(
      orgRow(),
      new Date(DERIVED_END.getTime() - 3 * HOUR_MS),
    );
    expect(ctx.trial.daysLeft).toBe(1);
    expect(ctx.trial.state).toBe("active");
  });

  it("is 0 at the boundary instant", () => {
    expect(resolveEntitlements(orgRow(), DERIVED_END).trial.daysLeft).toBe(0);
  });

  it("never goes negative long after expiry", () => {
    expect(resolveEntitlements(orgRow(), at(90 * DAY_MS)).trial.daysLeft).toBe(
      0,
    );
  });
});

describe("urgency", () => {
  const atDaysLeft = (days: number): Date =>
    new Date(DERIVED_END.getTime() - days * DAY_MS);

  it("is calm at three days left", () => {
    const ctx = resolveEntitlements(orgRow(), atDaysLeft(3));
    expect(ctx.trial.daysLeft).toBe(3);
    expect(isUrgentTrial(ctx)).toBe(false);
  });

  it("escalates at two days left", () => {
    const ctx = resolveEntitlements(orgRow(), atDaysLeft(2));
    expect(ctx.trial.daysLeft).toBe(TRIAL_URGENT_DAYS);
    expect(isUrgentTrial(ctx)).toBe(true);
  });

  it("stays escalated at one day left", () => {
    const ctx = resolveEntitlements(orgRow(), atDaysLeft(1));
    expect(ctx.trial.daysLeft).toBe(1);
    expect(isUrgentTrial(ctx)).toBe(true);
  });

  it("is not urgent once the trial has expired", () => {
    const ctx = resolveEntitlements(orgRow(), at(11 * DAY_MS));
    expect(ctx.trial.state).toBe("expired");
    expect(isUrgentTrial(ctx)).toBe(false);
  });

  it("is not urgent for a subscribed organization", () => {
    const ctx = resolveEntitlements(
      orgRow({ subscriptionStatus: "active" }),
      atDaysLeft(1),
    );
    expect(ctx.trial.state).toBe("subscribed");
    expect(isUrgentTrial(ctx)).toBe(false);
  });
});
