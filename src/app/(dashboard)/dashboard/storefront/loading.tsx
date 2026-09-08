import { Skeleton } from "@/components/ui/skeleton";

/**
 * The Themes page's loading fallback — a `skeleton` shaped like the real
 * spotlight-row + grid layout, never a full-page spinner (04-UI-SPEC.md §
 * "The four states").
 *
 * No `requireMerchantContext()` here: this is the Suspense boundary Next
 * renders WHILE the real page's data is still loading, so it has nothing to
 * authorize and nothing tenant-specific to show — the same contract
 * `dashboard/storefront-editor/loading.tsx` (and `products/loading.tsx`
 * before it) states.
 *
 * Shape matches `page.tsx`'s final render exactly: `max-w-5xl` container,
 * the R-3 two-column spotlight row (`md:grid-cols-[minmax(0,22rem)_1fr]`),
 * then the "Available templates" heading above a 3-up grid of
 * `aspect-[16/10]` card skeletons (05.3-UI-SPEC.md § Layout → Themes page).
 */
export default function StorefrontThemesLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {/* Spotlight row skeleton — two-column at md+, per R-3 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,22rem)_1fr] md:items-center">
        <Skeleton className="aspect-[16/10] w-full rounded-lg" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-11 w-40" />
        </div>
      </div>

      {/* Grid skeleton — 3-up, aspect-[16/10] each, matching the picker's card anatomy */}
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2 @4xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-[16/10] w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
