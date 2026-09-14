import { Skeleton } from "@/components/ui/skeleton";

/**
 * `/admin/claims`'s loading fallback — a six-row skeleton table, never a
 * full-page spinner, matching `page.tsx`'s final shape: the header block,
 * the two filter `select`s, and the ledger.
 */
export default function AdminClaimsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Skeleton className="h-11 w-40" />
        <Skeleton className="h-11 w-48" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
