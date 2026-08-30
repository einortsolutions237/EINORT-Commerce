import { Skeleton } from "@/components/ui/skeleton";

/**
 * A1's loading fallback — a `skeleton` shaped like the real table, never a
 * full-page spinner (03-UI-SPEC.md § Interaction).
 *
 * No `requireMerchantContext()` here: this is the Suspense boundary Next
 * renders WHILE the real page's data is still loading, so it has nothing to
 * authorize and nothing tenant-specific to show — five bars at the real row
 * height is the whole contract.
 */
export default function ProductsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-11 w-36 shrink-0" />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border p-2">
        {/* The header block. */}
        <Skeleton className="h-10 w-full" />
        {/* Five row bars at the real `TableRow` height. */}
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
