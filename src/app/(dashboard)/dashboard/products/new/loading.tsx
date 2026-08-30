import { Skeleton } from "@/components/ui/skeleton";

/**
 * A2's loading fallback — four stacked card shapes, never a full-page spinner
 * (03-UI-SPEC.md § Interaction).
 *
 * No `requireMerchantContext()` here: this is what Next renders WHILE the real
 * page's data is still loading, so it has nothing to authorize and nothing
 * tenant-specific to show. The bars stand where the four cards will, at the
 * real column width, so the page does not jump when the data lands.
 */

/** Details, Images, Options and stock, Visibility — in that order. */
const CARD_BODY_HEIGHTS = ["h-64", "h-52", "h-36", "h-16"] as const;

export default function NewProductLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Skeleton className="h-8 w-44" />

      {CARD_BODY_HEIGHTS.map((bodyHeight) => (
        <div
          key={bodyHeight}
          className="flex flex-col gap-4 rounded-xl border border-border p-6"
        >
          <Skeleton className="h-6 w-40" />
          <Skeleton className={`w-full ${bodyHeight}`} />
        </div>
      ))}

      <Skeleton className="h-11 w-44" />
    </div>
  );
}
