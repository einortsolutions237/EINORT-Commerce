import { Skeleton } from "@/components/ui/skeleton";

/**
 * `/admin/support`'s loading skeleton — matches `page.tsx`'s row shape so
 * nothing jumps when the inbox arrives, same idiom as
 * `src/app/admin/loading.tsx`. No full-page spinner.
 */
const SKELETON_ROWS = 6;

export default function AdminSupportInboxLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-5 w-28" />
      </div>

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div key={index} className="flex min-h-11 items-center justify-between gap-4 px-4 py-4 lg:px-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-8 rounded-4xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
