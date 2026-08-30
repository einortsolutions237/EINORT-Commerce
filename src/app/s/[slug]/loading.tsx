import { Skeleton } from "@/components/ui/skeleton";

/**
 * B1's loading state — a skeleton matching the grid's own shape, never a
 * full-page spinner (03-UI-SPEC.md § Interaction & State Contract).
 *
 * Eight tiles is enough to fill the viewport at every breakpoint (2 cols at
 * 360px through 4 at `lg`) without guessing the real product count.
 */
export default function StorefrontLoading() {
  return (
    <>
      <div className="sticky top-0 z-10 flex min-h-14 items-center justify-between border-b border-border bg-background px-4 md:px-8">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-11 rounded-full" />
      </div>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 md:px-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="aspect-square w-full rounded" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
