import { ShoppingBagIcon } from "lucide-react";
import Link from "next/link";

import { getCurrentCart } from "@/server/cart/read";
import { cartLineCount, hydrateCart } from "@/server/storefront/queries";

/**
 * B1's sticky header — the whole thing, and nothing else (03-UI-SPEC.md § B1).
 * `--background` with a `--border` bottom hairline, `min-h-14`. Store name as
 * a Label/uppercase wordmark on the left; a 44px cart icon-button on the
 * right carrying the count as a `--foreground`-on-`--muted` bubble. No
 * search, no account, no nav — this is the whole contract.
 *
 * Reads the cart through `getCurrentCart` (`src/server/cart/read.ts`) rather
 * than touching the cart cookie itself — see that module's header for why
 * the split exists.
 */
export async function StoreHeader({
  slug,
  tenantId,
  storeName,
}: {
  slug: string;
  tenantId: string;
  storeName: string;
}) {
  const stored = await getCurrentCart(slug);
  const hydrated = await hydrateCart(tenantId, stored);
  const count = cartLineCount(hydrated);

  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between border-b border-border bg-background px-4 md:px-8">
      <Link
        href={`/s/${slug}`}
        className="text-sm leading-snug font-semibold tracking-[0.08em] text-foreground uppercase"
      >
        {storeName}
      </Link>

      <Link
        href={`/s/${slug}/cart`}
        aria-label="Cart"
        className="relative flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
      >
        <ShoppingBagIcon className="size-5" aria-hidden="true" />
        <span
          role="status"
          aria-live="polite"
          className="absolute -top-0.5 -right-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-muted px-1 text-xs leading-none font-semibold tabular-nums text-foreground"
        >
          {count}
        </span>
      </Link>
    </header>
  );
}
