import { Skeleton } from "@/components/ui/skeleton";

/**
 * B3's loading state — the cart's own shape, never a full-page spinner
 * (03-UI-SPEC.md § Interaction & State Contract).
 *
 * Three line rows and a summary block: the count is a deliberate guess at the
 * common basket rather than an attempt to be right, because the real number is
 * behind the very fetch this skeleton is covering. What matters is that the
 * column width, the 64px thumb and the summary block land where the loaded page
 * will put them, so the content arrives into the space already reserved for it
 * instead of shoving the page around under a thumb that is already reaching for
 * the CTA.
 */
export default function CartLoading() {
  return (
    <>
      <div className="sticky top-0 z-10 flex min-h-14 items-center justify-between border-b border-border bg-background px-4 md:px-8">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-11 rounded-full" />
      </div>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6">
        <Skeleton className="h-7 w-32" />

        <div className="mt-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex gap-3 border-t border-border py-4 first:border-t-0 first:pt-0"
            >
              <Skeleton className="size-16 shrink-0 rounded" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="mt-1 h-11 w-32 rounded" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded bg-muted p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-28" />
          </div>
        </div>

        <Skeleton className="mt-4 h-12 w-full rounded" />
      </main>
    </>
  );
}
