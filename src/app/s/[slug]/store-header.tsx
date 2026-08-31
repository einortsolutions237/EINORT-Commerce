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
      {/*
       * EVERY LINK IN THIS ROUTE TREE IS ORIGIN-RELATIVE. This is the canonical
       * statement for all of `src/app/s/[slug]/**` (quick task 260901-00j).
       *
       * The shopper's origin is already `{slug}.{root}`. `src/proxy.ts` is what
       * supplies the `/s/{slug}` prefix, on the way in, from the `Host` header —
       * the one channel this codebase trusts for tenant identity. Writing that
       * prefix into an href instead makes the browser request `/s/{slug}/...`
       * literally, and the proxy hard-404s exactly that path (TEN-03/DOM-02),
       * so the link renders a blank page. `src/app/s/[slug]/layout.tsx` already
       * records the rule: `/s/{slug}` is "never a URL a visitor types."
       *
       * `tests/unit/storefront-link-prefix.test.ts` fails the build if the
       * prefix comes back. The fix for that failure is to make the link
       * origin-relative — NEVER to relax the `/s/` check in `src/proxy.ts`.
       */}
      <Link
        href="/"
        className="text-sm leading-snug font-semibold tracking-[0.08em] text-foreground uppercase"
      >
        {storeName}
      </Link>

      <Link
        href="/cart"
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
