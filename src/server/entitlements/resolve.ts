import "server-only";

import { PLANS, isPlanTier, type PlanDefinition } from "./plans";

/**
 * The trial resolver — ONB-05's single source of truth.
 *
 * One pure function turns `(organization row, now)` into the snapshot every
 * dashboard page, banner and write gate reads. Nothing else in the codebase
 * computes trial state, and nothing stores it: there is no `isExpired` column
 * to fall out of date, and no back-fill job that can fail and leave a merchant
 * in limbo.
 *
 * Three properties are load-bearing:
 *
 *   1. **`now` is a parameter.** This file never reads the system clock. That
 *      is what makes day 1, day 9, the day-10 boundary, the millisecond either
 *      side of it and subscribed-after-expiry all expressible in the fast unit
 *      project with no clock mocking and no database.
 *   2. **Days are a duration, not a calendar difference.** `createdAt` is a
 *      timestamp without time zone; a calendar-day helper buckets by whatever
 *      zone it is handed, so a merchant in Douala (UTC+1) would see a different
 *      count from the server. ONB-05 reads "10 days from signup", so
 *      `ceil((endsAt - now) / 86 400 000)` is also the semantically correct
 *      reading.
 *   3. **No data-access import of any kind.** `OrgRow` is declared
 *      structurally here, so this module carries no dependency on the
 *      generated client and the caller decides how the row was fetched.
 */

const DAY_MS = 86_400_000;

/** ONB-05: every plan gets the same 10-day full-feature trial. */
export const TRIAL_DAYS = 10;

/**
 * D-12: the banner escalates in the final stretch. The threshold is one
 * constant, exported, so the visual treatment cannot drift away from the test
 * that pins it — "final 1-2 days" is `daysLeft <= 2`, decided once, here.
 */
export const TRIAL_URGENT_DAYS = 2;

export type TrialState = "active" | "expired" | "subscribed";

/**
 * The shape this resolver needs from an `organization` row — declared
 * structurally on purpose. Any caller that can produce these fields can use the
 * resolver, including a test that builds them by hand.
 */
export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  planTier: string | null;
  trialEndsAt: Date | null;
  subscriptionStatus: string;
}

export interface MerchantContext {
  readonly tenantId: string;
  readonly storeName: string;
  readonly storeSlug: string;
  readonly plan: PlanDefinition;
  readonly trial: {
    readonly state: TrialState;
    readonly endsAt: Date;
    readonly daysLeft: number;
  };
  /** D-08. The single boolean every write path consults. */
  readonly canWrite: boolean;
}

export function resolveEntitlements(org: OrgRow, now: Date): MerchantContext {
  // Derive, don't store. `createdAt` is stamped by Better Auth's own endpoint
  // and spread last over the request body, so it cannot be forged, and there is
  // no nullable window between the insert and a back-fill. `trialEndsAt` is an
  // optional override for a support gesture; null is the normal case.
  const endsAt =
    org.trialEndsAt ?? new Date(org.createdAt.getTime() + TRIAL_DAYS * DAY_MS);

  const subscribed = org.subscriptionStatus === "active";
  const expired = !subscribed && now.getTime() >= endsAt.getTime();

  // A tier the registry does not recognise means the column drifted — a bad
  // backfill, a hand edit, a tier removed without a migration. Degrade to the
  // least-privileged plan rather than throwing: this runs inside a render path,
  // and a crashed dashboard tells the merchant nothing while a Starter-limited
  // one at least keeps them working. The log is what makes it visible.
  if (org.planTier !== null && !isPlanTier(org.planTier)) {
    console.error(
      `SUB-01 degraded: organization ${org.id} has unknown planTier ` +
        `"${org.planTier}"; falling back to starter limits.`,
    );
  }
  const plan = isPlanTier(org.planTier) ? PLANS[org.planTier] : PLANS.starter;

  return {
    tenantId: org.id,
    storeName: org.name,
    storeSlug: org.slug,
    plan,
    trial: {
      state: subscribed ? "subscribed" : expired ? "expired" : "active",
      endsAt,
      // Never negative: an expired trial reads 0, not "-4 days left".
      daysLeft: Math.max(
        0,
        Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS),
      ),
    },
    canWrite: subscribed || !expired,
  };
}

/**
 * D-11/D-12: whether the trial banner should wear its urgent treatment.
 *
 * Only an *active* trial can be urgent. A subscribed organization has nothing
 * to count down, and an expired one is past urgency — it gets the read-only
 * treatment (D-08/D-10), which is a different surface with different copy.
 */
export function isUrgentTrial(ctx: MerchantContext): boolean {
  return (
    ctx.trial.state === "active" && ctx.trial.daysLeft <= TRIAL_URGENT_DAYS
  );
}
