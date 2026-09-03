import type { CSSProperties } from "react";
import { notFound } from "next/navigation";

import { Toaster } from "@/components/ui/sonner";
import {
  DEFAULT_PRIMARY_ACCENT,
  DEFAULT_SECONDARY_ACCENT,
  deriveThemeCssVars,
} from "@/lib/theme-defaults";
import { hexColorSchema } from "@/server/theming/schema";
import { getPublishedStorefront } from "@/server/theming/queries";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

import { StoreFooter } from "./store-footer";
import { StoreHeader } from "./store-header";

/**
 * The storefront tenant gate (TEN-03, DOM-02) and the ONE brand-token
 * injection site (EDIT-01, D-09, D-12).
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
 *
 * ---------------------------------------------------------------------------
 * PHASE 4 — THE FIVE `--brand-accent*` VALUES ARE INJECTED HERE AND NOWHERE
 * ELSE.
 * ---------------------------------------------------------------------------
 * `deriveThemeCssVars(tokens)` is spread onto the `style` of the SAME
 * `data-surface` div below. Their fallbacks live in the storefront-scope block
 * in `src/app/globals.css`, which is why a tenant with no `StorefrontTheme` row
 * renders correctly with zero JavaScript and no extra query — the override
 * lands on top of a scope that already resolves. There is no second wrapper div
 * and the attribute has not moved: ban #4 in
 * `tests/unit/surface-token-isolation.test.ts` fails the build if the
 * storefront surface attribute appears outside `src/app/s/`, ban #6 does the
 * same for a `brand-accent` utility, and D-12 forbids weakening either. The
 * attribute is written exactly once in this file, and a grep for it should keep
 * returning exactly one hit.
 *
 * THE FOREGROUNDS AND THE RING ARE DERIVED, NOT MERCHANT-CHOSEN. A merchant
 * stores two colours; the other three values are computed from them by
 * `accentForeground()` / `contrastRatio()`. That asymmetry is the guardrail
 * D-09 exists to protect: a button whose own label is unreadable, or an
 * invisible focus ring, on a route tree that contains `/cart`, `/checkout` and
 * `/order/[token]`, is a structural break of WCAG 1.4.3 / 1.4.11, not a taste
 * question. Persisting the derived values instead would let them go stale
 * against the accent they were computed from — the same reason the trial state
 * is derived rather than stored.
 *
 * THE `style` LINE CONTAINS NO COLOUR LITERAL. Every value is a variable, which
 * is what keeps ban #1 (a hex/oklch/rgb/hsl anywhere in a component) green. The
 * constants themselves live in `src/lib/theme-defaults.ts`, a directory that
 * ban is not scanned over, for exactly this reason.
 *
 * ---------------------------------------------------------------------------
 * WHY THE CHROME IS THEME SETTINGS AND NOT SECTIONS (04-RESEARCH Pattern 12).
 * ---------------------------------------------------------------------------
 * This layout is shared by `/`, the PDP, `/cart`, `/checkout`, `/order/[token]`
 * and `/preview`. Modelling the announcement bar, header and footer as
 * `StorefrontTheme` settings applied HERE — rather than as reorderable sections
 * on the home document — is what keeps a merchant's branding consistent across
 * editable and fixed pages alike. Only `/` is section-rendered; a route that
 * can take money or move an order is never section-rendered, and a merchant
 * must not be able to reorder or blank their own revenue path.
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
   * The one theming read on this route tree. `getPublishedStorefront` is
   * `cache()`-wrapped, so the page beneath this layout asking for the same
   * document costs one lookup, not two, and it performs no write on this
   * anonymous, unauthenticated, unlimited path (Pitfall 11, T-04-11).
   */
  const { tokens, logoKey } = await getPublishedStorefront(tenant.id);

  /*
   * PITFALL 3 / T-04-09 — RE-VALIDATE ON READ, NOT ONLY ON WRITE, AND FAIL
   * CLOSED TO THE DEFAULT.
   *
   * This is NOT redundant with `themeTokensSchema` on the write path. React
   * sets a custom property through `setProperty`, which does not sanitise, so a
   * value like `red; background-image: url(https://evil/x)` arriving from a bad
   * backfill, a manual SQL fix or a future migration is stopped by this anchored
   * regex and by nothing else downstream (ASVS V5). `safeParse` and a fallback
   * rather than `parse`: a render path must never throw over a colour — a live
   * storefront going white is strictly worse than a live storefront in zinc.
   */
  const primaryAccent = hexColorSchema.safeParse(tokens.primaryAccent);
  const secondaryAccent = hexColorSchema.safeParse(tokens.secondaryAccent);

  const themeVars = deriveThemeCssVars({
    primaryAccent: primaryAccent.success
      ? primaryAccent.data
      : DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: secondaryAccent.success
      ? secondaryAccent.data
      : DEFAULT_SECONDARY_ACCENT,
  });

  const announcement = tokens.announcementText.trim();

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
    <div
      data-surface="storefront"
      className="flex min-h-full flex-1 flex-col"
      style={themeVars as CSSProperties}
    >
      {/*
       * The announcement bar — one of the secondary accent's only two permitted
       * uses (04-UI-SPEC.md § Color). Its foreground is derived, so the label is
       * readable at every value a merchant can pick.
       *
       * Deliberately NOT sticky: it scrolls away and the header does not. A
       * second sticky band would eat a third of a phone viewport for a sentence
       * the shopper has already read.
       *
       * Rendered only when the text is non-empty — a merchant who clears it gets
       * no strip, not an empty coloured bar.
       */}
      {announcement !== "" && (
        <div className="truncate bg-brand-accent-secondary px-4 py-2 text-center text-sm leading-snug font-semibold tracking-[0.08em] text-brand-accent-secondary-foreground uppercase">
          {announcement}
        </div>
      )}

      <StoreHeader
        slug={slug}
        tenantId={tenant.id}
        storeName={tenant.name}
        logoKey={logoKey}
      />

      {children}

      <StoreFooter storeName={tenant.name} tagline={tokens.footerTagline} />

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
