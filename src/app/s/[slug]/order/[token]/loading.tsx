import { Skeleton } from "@/components/ui/skeleton";

/**
 * B7's loading state, shaped like the page it precedes.
 *
 * 03-UI-SPEC.md § B7's additional rules ban a bare spinner as the whole page,
 * and the reason is sharper here than on the catalog: this page exists to
 * answer one question — where is my order — and a spinner is the shape of "we
 * do not know". A skeleton in the page's own shape says "the answer is one
 * block down and it is arriving", which is a different message to somebody who
 * has already sent money.
 *
 * Three blocks, matching the real page's first screenful: the eyebrow, the
 * status block above its hairline, and one content block beneath it. Nothing
 * below the fold is drawn — a skeleton for content the customer has not
 * scrolled to is motion with no information in it.
 */
export default function OrderTrackingLoading() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-12 px-8 py-16">
      {/* The Label/uppercase eyebrow. */}
      <Skeleton className="h-4 w-28" />

      <div className="flex flex-col gap-4 border-b border-border pb-6">
        {/* The 24px status icon. */}
        <Skeleton className="size-6 rounded" />
        {/* The Display heading, then two lines of Body explanation. */}
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* One content block — the action region on a page that has one. */}
      <Skeleton className="h-32 w-full rounded" />
    </main>
  );
}
