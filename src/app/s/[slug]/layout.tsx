import { notFound } from "next/navigation";

import { Toaster } from "@/components/ui/sonner";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

/**
 * The storefront tenant gate (TEN-03, DOM-02).
 *
 * `/s/{slug}` is an internal rewrite target, never a URL a visitor types — the
 * Proxy 404s any direct request for it from the apex. The slug therefore always
 * derives from the `Host` header and from nothing a client can forge.
 *
 * This layout is the single place where "this hostname is *shaped* like a
 * store" becomes "this store exists and is serving". Nothing beneath it may run
 * for an unresolved or suspended tenant, which is why the check lives in the
 * layout rather than in each page: a page added in Phase 3 or 4 inherits the
 * gate instead of having to remember it (T-01-30).
 *
 * There is deliberately no `try`/`catch` around the resolver. Failing closed
 * means failing: a database or cache error must surface as an error, never be
 * swallowed into a rendered storefront and never be mistaken for "no such
 * tenant".
 */
export default async function StorefrontLayout({
  children,
  params,
}: LayoutProps<"/s/[slug]">) {
  // `params` is a Promise in Next 16.
  const { slug } = await params;

  const tenant = await resolveTenantBySlug(slug);

  // `null` means unknown, unclaimed, suspended, or any other non-active status
  // — the resolver does not distinguish them and neither does this branch.
  // Renders the one branded body with a real 404 (D-04 / D-05).
  if (!tenant) notFound();

  /*
   * The surface boundary (03-UI-SPEC.md § "READ THIS FIRST").
   *
   * `globals.css`'s `:root` resolves every semantic token to the *merchant*
   * blue/gold/slate. A storefront page that writes `bg-background` inherits
   * those values unless something re-scopes them — which is why this attribute
   * is here and not decoration. The matching block in `globals.css` re-declares
   * the complete zinc set under it, so every page below this point uses the
   * ordinary semantic utilities — `bg-background`, `text-foreground`,
   * `bg-primary`, `border-border` — and gets zinc, plus the 0.25rem radius,
   * for free.
   *
   * The corollary is the rule: reaching for a palette utility (`bg-zinc-50`,
   * `text-slate-900`) anywhere under this tree is never necessary and is exactly
   * the retrofit this attribute exists to prevent. `tests/unit/
   * surface-token-isolation.test.ts` fails the build if one appears — there and
   * on the merchant side both.
   */
  return (
    <div data-surface="storefront" className="flex min-h-full flex-1 flex-col">
      {children}
      {/*
       * Mounted inside the scoped `div` above, not at the root layout, so the
       * toast reads zinc `--popover`/`--border` tokens rather than the
       * merchant palette (sonner does not portal to `document.body`, so its
       * CSS custom properties resolve from its actual DOM position). 03-09 is
       * the first storefront surface to call `toast()` — the add-to-cart
       * confirmation (03-UI-SPEC.md § B2 "Add feedback").
       */}
      <Toaster />
    </div>
  );
}
