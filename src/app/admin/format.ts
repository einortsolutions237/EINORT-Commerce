/**
 * Display-only time formatting for the admin surface — `/admin`'s "Joined"
 * column and `/admin/merchants/[id]`'s "Active since" / "Covers through"
 * lines.
 *
 * ---------------------------------------------------------------------------
 * WHY A SEPARATE MODULE FROM `src/app/(dashboard)/dashboard/orders/format.ts`,
 * RATHER THAN IMPORTING IT.
 * ---------------------------------------------------------------------------
 * That module's `formatRelativeTime` is pure `Intl` arithmetic with nothing
 * merchant-specific about it, so importing it would cost nothing functionally
 * — but this codebase's convention (see `src/server/admin/claims.ts`'s header,
 * and `src/server/admin/domain.ts`'s duplicated `ACTIVE_STATUS`) is that the
 * admin and merchant surfaces do not reach across into each other's route
 * trees even for code that happens to be shareable today, because the day one
 * of the two needs to diverge, an import is a much larger refactor than a
 * fifteen-line duplicate ever was. This is the admin zone's own copy of the
 * same small, dependency-free `Intl` cookbook.
 *
 * Not `server-only`: both functions are called exclusively from Server
 * Components in this plan (`page.tsx`, `merchants/[id]/page.tsx`), but neither
 * touches Prisma, `next/headers` or a session, so there is nothing here that
 * would be unsafe in a client bundle if a later plan ever needed to format a
 * timestamp client-side.
 */

import { strings } from "@/lib/strings";
import { PLAN_TIERS, type PlanTier } from "@/server/entitlements/plans";

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

/** Smallest to largest — the standard `Intl.RelativeTimeFormat` cookbook
 * shape (MDN), matching `src/app/(dashboard)/dashboard/orders/format.ts`'s
 * own division table. */
const RELATIVE_TIME_DIVISIONS: readonly {
  readonly amount: number;
  readonly unit: Intl.RelativeTimeFormatUnit;
}[] = [
  { amount: 60, unit: "seconds" },
  { amount: 60, unit: "minutes" },
  { amount: 24, unit: "hours" },
  { amount: 7, unit: "days" },
  { amount: 4.34524, unit: "weeks" },
  { amount: 12, unit: "months" },
  { amount: Number.POSITIVE_INFINITY, unit: "years" },
];

/**
 * "3 days ago", under a store's name in the § C1 "Joined" column.
 *
 * `now` defaults to `new Date()` rather than being required because every
 * call site is a Server Component rendering at request time — there is no
 * client clock here for a required parameter to protect against.
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  let duration = (date.getTime() - now.getTime()) / 1000;

  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return RELATIVE_TIME_FORMATTER.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return RELATIVE_TIME_FORMATTER.format(Math.round(duration), "years");
}

const ABSOLUTE_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

/**
 * "Aug 23, 2026" — § C2's "Active since" line and the plan card's "Covers
 * through" date. Date-only, no time: neither reading is a to-the-minute
 * event, and a bare date is what `tabular-nums` renders cleanly.
 */
export function formatAbsoluteDate(date: Date): string {
  return ABSOLUTE_DATE_FORMATTER.format(date);
}

/**
 * `Organization.planTier` -> its display name (`strings.plan.<tier>.name`),
 * the same proper-noun label the merchant-facing plan picker uses — a plan
 * tier's name is not audience-specific prose, unlike everything else in
 * `strings.admin.*`. Shared by `page.tsx` (the list's Plan column) and
 * `merchants/[id]/page.tsx` (the detail card), so the two cannot drift on
 * what an unrecognised or null tier renders as.
 */
const PLAN_TIER_LABEL: Readonly<Record<PlanTier, string>> = {
  starter: strings.plan.starter.name,
  business: strings.plan.business.name,
  professional: strings.plan.professional.name,
};

/** `null` (not yet chosen, D-05) and any value the registry has never seen
 * (an org mid-onboarding, or a future tier) render as "—", never a raw
 * string. */
export function planLabelFor(tier: string | null): string {
  if (tier !== null && (PLAN_TIERS as readonly string[]).includes(tier)) {
    return PLAN_TIER_LABEL[tier as PlanTier];
  }
  return "—";
}
