/**
 * Quick task 260906-egn, Task 4 — the Overview page's 7-day revenue chart
 * bucketing, computed in Node rather than in SQL.
 *
 * ---------------------------------------------------------------------------
 * WHY NODE AND NOT SQL.
 * ---------------------------------------------------------------------------
 * `$queryRaw`/`$executeRaw` are lint-banned repository-wide
 * (`eslint.config.mjs`, `no-restricted-syntax`) because they are the one
 * escape hatch the tenant-scoping Prisma extension cannot intercept
 * (`src/server/db/tenant-scoped.ts`). Prisma's `groupBy` also cannot truncate
 * a `DateTime` to a calendar day on its own. Bucketing a bounded, already
 * tenant-scoped 7-day window in application code is therefore both the safe
 * option and the only one available without a raw query.
 *
 * ---------------------------------------------------------------------------
 * A PURE MODULE ON PURPOSE — NO `server-only`, NO DATABASE IMPORT.
 * ---------------------------------------------------------------------------
 * `bucketByDay` takes plain rows and a plain `Date` and returns plain data.
 * That is what makes `tests/unit/overview-buckets.test.ts` able to cover the
 * UTC+1 midnight boundary — the case most likely to silently regress — without
 * a Neon branch or a frozen system clock.
 *
 * ---------------------------------------------------------------------------
 * `DOUALA_UTC_OFFSET_MINUTES` IS A FIXED CONSTANT, NOT AN `Intl` TIME ZONE.
 * ---------------------------------------------------------------------------
 * Cameroon is WAT, UTC+1, year-round — no daylight saving transitions ever
 * apply, so a fixed offset is correct with no seasonal drift and
 * `Intl.DateTimeFormat`'s `timeZone` option (which exists to handle exactly
 * that drift) buys nothing here. An order placed late in the UTC day can
 * still belong to the NEXT Douala-local calendar day; ignoring the offset
 * would silently misfile that order's revenue into the wrong bar.
 */
export const DOUALA_UTC_OFFSET_MINUTES = 60;

const DAY_MS = 86_400_000;
const BUCKET_COUNT = 7;

/** Short weekday label ("Mon"), formatted in UTC because the offset is
 * already applied by hand before formatting — formatting with a real time
 * zone on top would shift the date a second time. */
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en", {
  weekday: "short",
  timeZone: "UTC",
});

export interface DailyBucket {
  /** `YYYY-MM-DD`, the Douala-local calendar date this bucket represents. */
  readonly dayKey: string;
  /** Short weekday label, e.g. "Mon". */
  readonly label: string;
  readonly totalXaf: number;
  /** 0-100, this bucket's total relative to the largest bucket in the set. */
  readonly percentOfMax: number;
}

interface DailyRow {
  readonly placedAt: Date;
  readonly totalXaf: number;
}

/**
 * Partitions `rows` into exactly 7 daily buckets starting at `since`,
 * oldest first. No I/O, no clock read — `since` is the caller's own `now`,
 * computed once on the server.
 *
 * Bucket index is `Math.floor(((placedAt + offset) - since) / DAY_MS)`,
 * clamped to `0..6` so a row outside the nominal 7-day window (a clock skew,
 * a caller passing a wider query than the window implies) cannot write out of
 * range — it is folded into the nearest edge bucket instead of being dropped
 * or throwing. `Math.floor` alone is what sends a row landing EXACTLY on a
 * bucket boundary into the later bucket (the day that instant begins), with
 * no extra branch required.
 */
export function bucketByDay(
  rows: readonly DailyRow[],
  since: Date,
): readonly DailyBucket[] {
  const offsetMs = DOUALA_UTC_OFFSET_MINUTES * 60_000;
  const totals = new Array<number>(BUCKET_COUNT).fill(0);

  for (const row of rows) {
    const rawIndex = Math.floor(
      (row.placedAt.getTime() + offsetMs - since.getTime()) / DAY_MS,
    );
    const index = Math.min(Math.max(rawIndex, 0), BUCKET_COUNT - 1);
    totals[index] += row.totalXaf;
  }

  const max = Math.max(...totals);

  return totals.map((totalXaf, i) => {
    // The Douala-local calendar date this bucket represents: shift `since`
    // forward by the offset (converting it into "Douala-local read as UTC")
    // before adding whole days, so the date parts read off below are the
    // Douala-local ones rather than the UTC ones.
    const shifted = new Date(since.getTime() + offsetMs + i * DAY_MS);
    return {
      dayKey: shifted.toISOString().slice(0, 10),
      label: WEEKDAY_FORMATTER.format(shifted),
      totalXaf,
      percentOfMax: max === 0 ? 0 : Math.round((totalXaf / max) * 100),
    };
  });
}
