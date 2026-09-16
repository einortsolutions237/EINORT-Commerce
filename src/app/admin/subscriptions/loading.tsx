import { Skeleton } from "@/components/ui/skeleton";

/**
 * `/admin/subscriptions`'s loading fallback — a six-row skeleton table,
 * matching `/admin/claims/loading.tsx`'s precedent exactly: the header
 * block, the two filter `select`s, and the ledger.
 */
export default function AdminSubscriptionsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-64" />
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
