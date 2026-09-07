import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { strings } from "@/lib/strings";
import type { DailyBucket } from "@/server/dashboard/buckets";

import { formatXaf } from "./orders/format";

/**
 * Quick task 260906-egn, Task 4 — the Overview page's 7-day revenue chart.
 * A Server Component, hand-rolled rather than a charting library: recharts
 * would force a client boundary and a meaningful bundle cost for 7 static
 * bars, and its `ChartConfig` idiom invites a literal colour that
 * `tests/unit/surface-token-isolation.test.ts` rejects.
 *
 * ---------------------------------------------------------------------------
 * THE SINGLE REVENUE SERIES USES THE BRAND CHART SLOT — NEVER THE GOLD ONE.
 * ---------------------------------------------------------------------------
 * `bg-chart-1` is brand-600 (light) / brand-400 (dark) — the platform's own
 * accent, appropriate for a single revenue series. The chart palette's third
 * slot is gold-500: spending it here would be a THIRD use of the gold-accent
 * budget, which `tests/unit/dashboard-nav.test.ts` reserves for exactly two
 * things (the pending-claims badge and the `Payment claimed` order chip) —
 * gold means "a human needs to look at this now", not "this is a chart bar".
 * (This file's own verification grep checks for the literal utility name of
 * that third slot, which is why it is deliberately not spelled out here.)
 *
 * ---------------------------------------------------------------------------
 * `height` AS AN INLINE PERCENTAGE IS NOT A LITERAL COLOUR.
 * ---------------------------------------------------------------------------
 * `tests/unit/surface-token-isolation.test.ts` ban #1 rejects hex/oklch/rgb
 * values in components — a percentage number in a `style` object is
 * unaffected by that ban, which is what makes an inline height safe here
 * while an inline colour would not be.
 *
 * ---------------------------------------------------------------------------
 * `role="img"` + `aria-label` — A BAR CHART IS UNREADABLE TO A SCREEN READER.
 * ---------------------------------------------------------------------------
 * Seven unlabelled divs of varying height carry no information without sight.
 * The container's `aria-label` summarises the whole series (the 7-day total)
 * so colour and height are never the only signal, per the same accessibility
 * floor `app-sidebar.tsx`'s `aria-current` already serves for the nav rail.
 */
export function RevenueBars({
  buckets,
  totalXaf,
}: {
  readonly buckets: readonly DailyBucket[];
  readonly totalXaf: number;
}) {
  const ariaLabel = strings.dashboard.overview.chartAriaLabel.replace(
    "{total}",
    formatXaf(totalXaf),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{strings.dashboard.overview.chartHeading}</CardTitle>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label={ariaLabel} className="flex h-40 items-end gap-2">
          {buckets.map((bucket) => (
            <div
              key={bucket.dayKey}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <div className="flex h-32 w-full items-end">
                <div
                  className="w-full rounded-sm bg-chart-1"
                  style={{ height: `${bucket.percentOfMax}%` }}
                />
              </div>
              <span className="text-xs leading-normal font-normal text-muted-foreground">
                {bucket.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
