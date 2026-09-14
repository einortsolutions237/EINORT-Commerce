import { Skeleton } from "@/components/ui/skeleton";

/**
 * `/admin`'s loading skeleton — a six-row table shape at `md`+, matching
 * `page.tsx`'s real layout so nothing jumps when the merchants list arrives.
 * No full-page spinner.
 */
const SKELETON_ROWS = 6;

export default function AdminMerchantsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-28" />
      </div>

      <Skeleton className="h-11 w-44 rounded-lg" />

      <div className="hidden flex-col gap-2 md:flex">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-52" />
            </div>
            <Skeleton className="h-6 w-20 rounded-4xl" />
            <Skeleton className="h-6 w-20 rounded-4xl" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="size-11 shrink-0 rounded-lg" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-6 w-24 rounded-4xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
