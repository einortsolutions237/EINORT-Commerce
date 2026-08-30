import { Skeleton } from "@/components/ui/skeleton";

/**
 * The A3 list's loading skeleton, matching `page.tsx`'s `md`+ table shape —
 * `products/page.tsx`'s sibling skeleton follows the same discipline: shape
 * matches the real layout so nothing jumps when the data arrives.
 *
 * Semantic tokens only (`bg-muted` via `Skeleton`), zero literals, and no
 * `variant="gold"` anywhere in this tree — this file spends none of the
 * budget `tests/unit/dashboard-nav.test.ts` counts.
 */
const SKELETON_ROWS = 6;

export default function OrdersLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Skeleton className="h-8 w-32" />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-28 shrink-0 rounded-lg" />
        ))}
      </div>

      <div className="hidden flex-col gap-2 rounded-xl border border-border bg-card p-4 md:flex">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div key={index} className="flex items-center gap-4 py-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-28 rounded-4xl" />
            <Skeleton className="ml-auto h-5 w-20" />
            <Skeleton className="h-6 w-24 rounded-4xl" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-6 w-24 rounded-4xl" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-6 w-24 rounded-4xl" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
