import { Skeleton } from "@/components/ui/skeleton";

/**
 * The A5 queue's loading skeleton — three claim cards at their real height.
 *
 * Shaped to match `page.tsx` rather than to look busy: the card's padding, the
 * 96px thumb and the 44px action row are all reproduced, so nothing jumps when
 * the claims arrive. Three because that is roughly a screen's worth, and a
 * skeleton longer than the data usually is reads as a queue that is filling up.
 *
 * Semantic tokens only (`bg-muted`, via `Skeleton`), zero colour literals, and
 * no gold badge variant anywhere in this tree — that budget was spent on the
 * sidebar badge and the order-state chip, and `tests/unit/dashboard-nav.test.ts`
 * fails the build on a third spender.
 */
const SKELETON_CARDS = 3;

export default function ClaimsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-5 w-36" />
      </div>

      <div className="flex flex-col gap-4">
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
          >
            <div className="flex flex-col gap-4 md:flex-row-reverse md:justify-end md:gap-6">
              <Skeleton className="size-24 shrink-0 rounded-lg" />

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {/* Order number + customer name */}
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-32" />
                </div>
                {/* The claimed amount, at its Heading size */}
                <Skeleton className="h-8 w-40" />
                {/* Operator chip */}
                <Skeleton className="h-6 w-36 rounded-4xl" />
                {/* Reference + its copy button */}
                <Skeleton className="h-11 w-56" />
                {/* Submitted, relative */}
                <Skeleton className="h-5 w-28" />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Skeleton className="h-11 w-full rounded-lg sm:w-44" />
              <Skeleton className="h-11 w-full rounded-lg sm:w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
