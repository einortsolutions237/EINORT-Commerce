import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * `/dashboard/support`'s loading fallback — a skeleton shaped like the real
 * page, never a full-page spinner (06-UI-SPEC.md § Interaction & State
 * Contract's four-states rule).
 *
 * No `requireMerchantContext()` here: this renders WHILE the real page's
 * data is still loading, so it has nothing tenant-specific to show — the
 * same contract every other `loading.tsx` in this tree states
 * (`dashboard/loading.tsx`, `dashboard/storefront/loading.tsx`).
 *
 * Shape matches `page.tsx`'s final render: the header block, four
 * alternating bubble skeletons (own/other, per 06-UI-SPEC.md § A2), and the
 * composer's sticky bar.
 */

const BUBBLE_SKELETON_COUNT = 4;

export default function SupportLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-5 w-72" />
      </div>

      <div className="flex flex-col gap-4">
        {Array.from({ length: BUBBLE_SKELETON_COUNT }, (_, index) => (
          <div
            key={index}
            className={cn(
              "flex",
              index % 2 === 0 ? "justify-start" : "justify-end",
            )}
          >
            <Skeleton className="h-16 w-2/3 max-w-[42rem] rounded-lg" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:px-8">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="flex justify-end">
          <Skeleton className="h-11 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
