import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The A6 loading state — four stacked cards at their real heights, not a
 * full-page spinner. `getPaymentSettings` and `resolvePaymentPaths` both read
 * from Postgres before the page can decide whether to render the
 * nothing-configured alert, so this is what a merchant sees for that one
 * round trip. Matching the real card heights (title + description + one or
 * two field rows) keeps the page from visibly growing once the data arrives.
 */

/** One label-height plus one input-height, the shape every field in the form uses. */
function FieldSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

function CardSkeleton({ fieldCount }: { readonly fieldCount: 1 | 2 }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldSkeleton />
        {fieldCount === 2 ? <FieldSkeleton /> : null}
      </CardContent>
    </Card>
  );
}

export default function PaymentSettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Skeleton className="h-8 w-56" />

      <div className="flex flex-col gap-8">
        {/* WhatsApp orders — one field. */}
        <CardSkeleton fieldCount={1} />
        {/* MTN Mobile Money — number plus optional merchant code. */}
        <CardSkeleton fieldCount={2} />
        {/* Orange Money — number plus optional merchant code. */}
        <CardSkeleton fieldCount={2} />
        {/* Cash on delivery — a single switch row, not a text field. */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-9 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
