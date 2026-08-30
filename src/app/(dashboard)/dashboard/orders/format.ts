/**
 * Display-only formatting shared by the A3 list and the A4 detail page —
 * money and time, so neither hand-rolls its own `Intl` call and the two
 * never drift on locale or precision.
 *
 * Pure and framework-agnostic on purpose: no `import "server-only"`, because
 * `order-row-actions.tsx` is a Client Component and needs `formatXaf` for its
 * `sonner` toast message. Nothing here touches Prisma, `next/headers` or a
 * session — it is arithmetic and `Intl`, safe on either side of the
 * server/client boundary.
 *
 * `formatRelativeTime` and `formatAbsoluteTime` are called ONLY from Server
 * Components (`page.tsx`, `[id]/page.tsx`), so every timestamp they render is
 * computed against the SERVER's clock at render time — the same discipline
 * `trial-banner.tsx` documents for `daysLeft`, applied here to a genuine
 * recorded event (`Order.placedAt`, `OrderEvent.createdAt`) rather than to a
 * countdown a merchant's own device clock must never be trusted to compute.
 */

const XAF_FORMATTER = new Intl.NumberFormat("fr-CM", {
  style: "currency",
  currency: "XAF",
  maximumFractionDigits: 0,
});

/** Whole francs, `fr-CM` — the same instantiation `/dashboard/plan` uses. */
export function formatXaf(amountXaf: number): string {
  return XAF_FORMATTER.format(amountXaf);
}

const ABSOLUTE_TIME_FORMATTER = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** The A4 `Order history` card's absolute timestamp, e.g. "Aug 23, 2026, 3:04 PM". */
export function formatAbsoluteTime(date: Date): string {
  return ABSOLUTE_TIME_FORMATTER.format(date);
}

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

/**
 * Smallest to largest: how many of the current unit make one of the next,
 * and what the next unit is called. The standard `Intl.RelativeTimeFormat`
 * cookbook shape (MDN), so `formatRelativeTime` needs no hand-rolled
 * "is it hours or days yet?" ladder of its own.
 */
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
 * "2 hours ago", beneath an order's number in the A3 list.
 *
 * `now` defaults to `new Date()` rather than being required, because every
 * call site is a Server Component rendering at request time — there is no
 * client clock for a required parameter to protect against here.
 */
export function formatRelativeTime(
  date: Date,
  now: Date = new Date(),
): string {
  let duration = (date.getTime() - now.getTime()) / 1000;

  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return RELATIVE_TIME_FORMATTER.format(
        Math.round(duration),
        division.unit,
      );
    }
    duration /= division.amount;
  }

  return RELATIVE_TIME_FORMATTER.format(Math.round(duration), "years");
}
