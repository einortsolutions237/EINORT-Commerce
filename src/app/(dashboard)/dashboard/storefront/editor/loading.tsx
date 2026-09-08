import { Skeleton } from "@/components/ui/skeleton";

/**
 * The editor's loading fallback — a `skeleton` shaped like the real two-pane
 * layout, never a full-page spinner (04-UI-SPEC.md § The four states).
 *
 * No `requireMerchantContext()` here: this is the Suspense boundary Next renders
 * WHILE the real page's data is still loading, so it has nothing to authorize
 * and nothing tenant-specific to show — the same contract
 * `dashboard/products/loading.tsx` states for its table.
 *
 * It reproduces the shape the page lands on rather than a generic block: the
 * publish bar's row, then a 320px rail column of section rows beside a large
 * preview block on the muted field. This is the OUTER skeleton, distinct from
 * the flagship silhouette `editor-shell.tsx` draws inside the frame — that one
 * waits for the iframe handshake, this one waits for the draft to load, and the
 * merchant may see both in sequence.
 */
export default function StorefrontEditorLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The publish bar: a status line on the left, three controls right. */}
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <Skeleton className="h-5 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-20" />
          <Skeleton className="h-11 w-24" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* The rail, at its real 320px width and its real row height. */}
        <div className="flex w-full shrink-0 flex-col gap-2 border-border p-4 lg:w-80 lg:border-r">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="mt-4 h-5 w-24" />
          {/* Five rows — the template's fixed section count (D-05). */}
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>

        {/* The preview pane, on the same muted field the real one floats on. */}
        <div className="flex min-h-0 flex-1 flex-col bg-muted p-4 md:p-8">
          <Skeleton className="min-h-[32rem] flex-1 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
