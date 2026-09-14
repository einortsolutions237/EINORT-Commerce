import { BellRing, PackageMinus, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { DashboardCard } from "@/components/dashboard-card";
import { Label } from "@/components/ui/label";
import { strings } from "@/lib/strings";

import { LOW_STOCK_THRESHOLD, type AttentionCounts } from "@/server/dashboard/queries";

/**
 * Phase 6 plan 06-05, Task 3 — the "Needs your attention" band, per
 * `06-UI-SPEC.md` § A1.
 *
 * Built on `DashboardCard` (`src/components/dashboard-card.tsx`), the card
 * shell primitive quick task 260903-ugl introduced but deliberately left
 * unwired ("do not wire it into any existing page as part of quick task
 * 260903-ugl"). That prohibition was scoped to that task, not to this one —
 * this band is the retrofit the primitive was built for.
 *
 * ---------------------------------------------------------------------------
 * ZERO-COUNT TILES ARE NOT RENDERED. NOT GREYED OUT, NOT SHOWN AS "0".
 * ---------------------------------------------------------------------------
 * A merchant with nothing pending should see fewer things on screen, not a
 * row of zeroes to visually filter out. When all three counts are zero the
 * band collapses to a single muted sentence instead of an empty grid — an
 * empty `grid-cols-3` row would read as a layout bug, not as good news.
 *
 * ---------------------------------------------------------------------------
 * NO GOLD ANYWHERE IN THIS BAND.
 * ---------------------------------------------------------------------------
 * The gold accent is reserved for genuinely rare, deliberately weighted
 * moments elsewhere in the dashboard (`tests/unit/dashboard-nav.test.ts`
 * enforces the exact 5-file/5-count budget). This band is frequent, routine
 * merchant traffic — the disputed tile carries its own severity via
 * `text-destructive`, never gold, which keeps that budget untouched.
 */
export function AttentionBand({ counts }: { readonly counts: AttentionCounts }) {
  const tiles = [
    counts.pendingClaims > 0 && {
      key: "claims",
      href: "/dashboard/claims",
      icon: BellRing,
      count: counts.pendingClaims,
      label: strings.dashboard.attention.claims,
      countClassName: "text-foreground",
    },
    counts.lowStock > 0 && {
      key: "lowStock",
      href: "/dashboard/products",
      icon: PackageMinus,
      count: counts.lowStock,
      label: strings.dashboard.attention.lowStock.replace(
        "{threshold}",
        String(LOW_STOCK_THRESHOLD),
      ),
      countClassName: "text-foreground",
    },
    counts.disputedOrders > 0 && {
      key: "disputed",
      href: "/dashboard/orders?state=disputed",
      icon: TriangleAlert,
      count: counts.disputedOrders,
      label: strings.dashboard.attention.disputed,
      countClassName: "text-destructive",
    },
  ].filter((tile) => tile !== false);

  if (tiles.length === 0) {
    return (
      <p className="text-sm leading-normal font-normal text-muted-foreground">
        {strings.dashboard.attention.allClear}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-muted-foreground">{strings.dashboard.attention.heading}</Label>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.key}
            href={tile.href}
            className="min-h-11 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <DashboardCard>
              <div className="flex items-start gap-3">
                <tile.icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <span
                    className={`font-heading text-xl leading-tight font-semibold tabular-nums ${tile.countClassName}`}
                  >
                    {tile.count.toLocaleString("fr-CM")}
                  </span>
                  <Label className="font-normal text-muted-foreground">{tile.label}</Label>
                </div>
              </div>
            </DashboardCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
