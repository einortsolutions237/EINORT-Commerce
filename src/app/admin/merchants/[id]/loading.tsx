import { Skeleton } from "@/components/ui/skeleton";

/**
 * `/admin/merchants/[id]`'s loading skeleton — a four-card grid at the real
 * layout's shape, matching `page.tsx` so nothing jumps when the store loads.
 * No full-page spinner.
 */
const SKELETON_CARDS = 4;

export default function AdminMerchantDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-6 w-20 rounded-4xl" />
        </div>
        <Skeleton className="h-5 w-64" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          >
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-24 rounded-4xl" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
