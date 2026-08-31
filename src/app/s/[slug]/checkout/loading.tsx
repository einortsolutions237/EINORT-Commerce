import { Skeleton } from "@/components/ui/skeleton";

/**
 * B4's loading state — the checkout's own shape, never a full-page spinner
 * (03-UI-SPEC.md § Interaction & State Contract).
 *
 * The three sections are reserved at the sizes they will fill: four fields,
 * three payment rows at `min-h-14`, and the summary. The payment count is a
 * deliberate over-reservation — a store offering only one path will settle
 * upward, which is the harmless direction. Settling DOWNWARD is the one to
 * avoid here: this page ends in a money button, and a layout that grows under
 * a thumb already moving toward it is how someone taps the wrong thing.
 */
export default function CheckoutLoading() {
  return (
    <>
      <div className="sticky top-0 z-10 flex min-h-14 items-center justify-between border-b border-border bg-background px-4 md:px-8">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-11 rounded-full" />
      </div>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6">
        {/* 1. Your details */}
        <Skeleton className="h-7 w-36" />
        <div className="mt-4 flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full rounded" />
            </div>
          ))}
        </div>

        {/* 2. How you'll pay */}
        <div className="mt-8 border-t border-border pt-8">
          <Skeleton className="h-7 w-40" />
          <div className="mt-4 flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded" />
            ))}
          </div>
        </div>

        {/* 3. Order summary */}
        <div className="mt-8 border-t border-border pt-8">
          <Skeleton className="h-5 w-48" />
          <div className="mt-4 hidden flex-col gap-3 md:flex">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="flex items-start justify-between">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>

        <Skeleton className="mt-6 h-12 w-full rounded" />
      </main>
    </>
  );
}
