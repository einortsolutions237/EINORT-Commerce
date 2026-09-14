import { Skeleton } from "@/components/ui/skeleton";

/**
 * `/dashboard`'s loading fallback — a skeleton shaped like the real page,
 * never a full-page spinner, matching the same contract every other
 * `loading.tsx` in this tree states (`dashboard/storefront/loading.tsx`,
 * `dashboard/products/loading.tsx`).
 *
 * Created by Phase 6 plan 06-05, Task 3: before this task the page had no
 * `loading.tsx` at all (its Server Component fetches ran with no Suspense
 * fallback). The shape below matches `page.tsx`'s final render: the header
 * block, the attention band row, the 5-card metrics grid (`06-UI-SPEC.md` §
 * A1), the revenue chart, and the recent-orders list.
 *
 * No `requireMerchantContext()` here — this renders WHILE the real page's
 * data is still loading, so it has nothing tenant-specific to show.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <Skeleton className="h-6 w-32" />

      {/* Attention band skeleton — up to 3 tiles, per 06-UI-SPEC.md § A1 */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>

      {/* Metrics grid skeleton — 5 cards, per 06-UI-SPEC.md § A1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
