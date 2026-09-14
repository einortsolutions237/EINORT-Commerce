import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * `/admin/support/[tenantId]`'s loading fallback — mirrors
 * `/dashboard/support/loading.tsx`'s shape (this page's own merchant-side
 * counterpart), never a full-page spinner.
 *
 * No `requireAdminContext()` and no `params` read here: this renders WHILE
 * the real page's data is still loading, so it has nothing tenant-specific
 * to show — same contract as every other `loading.tsx` in this tree.
 */

const BUBBLE_SKELETON_COUNT = 4;

export default function AdminSupportThreadLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-11 w-36 rounded-lg" />
        </div>
        <Skeleton className="h-4 w-56" />
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
