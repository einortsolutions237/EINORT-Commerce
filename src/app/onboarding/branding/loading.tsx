import { Skeleton } from "@/components/ui/skeleton";

/**
 * The branding step's loading fallback — a `skeleton` shaped like the real
 * page, never a full-page spinner (04-UI-SPEC.md § The four states).
 *
 * No session ladder here, and no `requireMerchantContext()` either: this is the
 * Suspense boundary Next renders WHILE the real page's session read and
 * organization lookup are still in flight, so it has nothing to authorize and
 * nothing tenant-specific to show. The heading, the subline and four card
 * blocks at the real card heights are the whole contract — the same shape
 * `src/app/(dashboard)/dashboard/products/loading.tsx` follows.
 */
export default function BrandingLoading() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16 sm:px-8">
      <div className="w-full max-w-2xl">
        {/* The h1. */}
        <Skeleton className="h-8 w-72 max-w-full" />
        {/* The subline. */}
        <Skeleton className="mt-2 h-6 w-96 max-w-full" />

        {/*
         * Four cards: business name, the industry tile grid (the tall one),
         * the logo field and the two colour fields.
         */}
        <div className="mt-8 flex flex-col gap-6">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>

        {/* The submit, at its real height. */}
        <Skeleton className="mt-8 h-11 w-full" />
      </div>
    </main>
  );
}
