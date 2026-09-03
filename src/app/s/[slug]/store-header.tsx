import { ShoppingBagIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { getCurrentCart } from "@/server/cart/read";
import { publicUrlFor } from "@/server/images/r2";
import { cartLineCount, hydrateCart } from "@/server/storefront/queries";

/**
 * B1's sticky header — the whole thing, and nothing else (03-UI-SPEC.md § B1,
 * extended by 04-UI-SPEC.md § Theme Chrome → Header).
 *
 * A `--border` bottom hairline, `min-h-14`. Store name as a Label/uppercase
 * wordmark on the left — or the merchant's logo when they uploaded one; a 44px
 * cart icon-button on the right carrying the count as a `--foreground`-on-
 * `--muted` bubble. No search, no account, no nav — this is the whole contract.
 *
 * Reads the cart through `getCurrentCart` (`src/server/cart/read.ts`) rather
 * than touching the cart cookie itself — see that module's header for why
 * the split exists.
 *
 * ---------------------------------------------------------------------------
 * PHASE 4 — TWO CHANGES, AND THIS IS RENDERED BY THE LAYOUT NOW.
 * ---------------------------------------------------------------------------
 * 1. The band is translucent: `bg-background/80 backdrop-blur-sm` instead of an
 *    opaque fill. It is the one visual change from Phase 3 and it is what the
 *    editorial reference does — content passes under a sticky bar rather than
 *    disappearing behind a card.
 * 2. The left slot is a LOGO OR A WORDMARK, NEVER BOTH. A store with a logo
 *    already carries its name inside the mark, so drawing both reads as a
 *    duplicated title; a store without one still needs to say who it is.
 *
 * This component is mounted once, by `src/app/s/[slug]/layout.tsx`, so the same
 * header renders on `/`, the PDP, `/cart`, `/checkout` and `/order/[token]`
 * (04-RESEARCH Pattern 12 — the chrome is theme settings, not a section, so
 * branding stays consistent across editable and fixed pages alike). Individual
 * pages must NOT render it as well: Phase 3 mounted it per page and plan 04-10
 * lifted every one of those call sites into the layout.
 */
export async function StoreHeader({
  slug,
  tenantId,
  storeName,
  logoKey,
}: {
  slug: string;
  tenantId: string;
  storeName: string;
  /** The R2 derivative PREFIX for the merchant's logo, or `null`. Never a URL. */
  logoKey: string | null;
}) {
  const stored = await getCurrentCart(slug);
  const hydrated = await hydrateCart(tenantId, stored);
  const count = cartLineCount(hydrated);

  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm md:px-8">
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
      <Link href="/" className="flex items-center">
        {/*
         * ONE BRANCH, NEVER TWO RENDERS (04-UI-SPEC.md § Theme Chrome → Header).
         *
         * A LOGO IS NEVER CROPPED. `object-contain` with `w-auto` and a fixed
         * height means a wide wordmark and a square badge both fit the band at
         * their own aspect ratio; a fixed width, or `object-cover`, would slice
         * a merchant's mark in half and there is no way for them to discover it
         * except by looking.
         *
         * The `src` goes through `publicUrlFor` rather than being concatenated
         * from a base URL prop. That function refuses a key ending in
         * `/original` (T-03-28, and the T-04-15 mitigation names it), so
         * building the URL by hand here would quietly drop a control that
         * exists. This component is server-only already — it awaits the cart —
         * so unlike everything under `sections/` it may import from
         * `src/server/**` freely.
         */}
        {logoKey !== null ? (
          <Image
            src={publicUrlFor(`${logoKey}/large.webp`)}
            alt={storeName}
            width={512}
            height={512}
            className="h-7 w-auto object-contain md:h-8"
            priority
          />
        ) : (
          <span className="text-sm leading-snug font-semibold tracking-[0.08em] text-foreground uppercase">
            {storeName}
          </span>
        )}
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
