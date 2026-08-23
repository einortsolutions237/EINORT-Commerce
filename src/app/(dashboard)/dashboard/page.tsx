import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { strings } from "@/lib/strings";
import { requireMerchantContext } from "@/server/merchant/context";

/**
 * `/dashboard` — the merchant's own store (TEN-04).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * The `requireMerchantContext()` call below is not inherited from
 * `(dashboard)/layout.tsx` and must never be deleted on the grounds that the
 * layout already made it. A Next 16 layout cannot prevent a child segment from
 * rendering, and it does not re-run on client-side navigation between sibling
 * dashboard routes, so the layout's call is a data fetch and this one is the
 * gate. `React.cache()` means the two together still cost one `getSession` and
 * one organization read.
 *
 * Phase 2 has no lists, so this renders the empty state and links to the
 * storefront. It deliberately links to NOTHING ELSE: no "Add your first
 * product", no orders, no settings. Phase 3 owns products, and a CTA that opens
 * a 404 is a worse first impression than an honest, quiet page.
 */

export const metadata: Metadata = {
  // Renders as "Your store · EINORT" through the root layout's template.
  title: strings.dashboard.title,
};

/**
 * `localhost:3000` in development, `einort.com` in production.
 *
 * Read here on the server rather than imported from
 * `src/app/signup/store-address-field.tsx`: that module's `storeOrigin` helper
 * builds its scheme from `window.location.protocol`, which does not exist in a
 * Server Component, and the module is a `"use client"` boundary whose plain
 * exports become client references when imported from the server. The same
 * `protocol` derivation already appears in
 * `src/app/onboarding/create-store/page.tsx`, which is the server-side
 * precedent this follows.
 */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "einort.com";

/** The address as the merchant reads it: no scheme, no port. */
function storeHost(slug: string): string {
  return `${slug}.${ROOT_DOMAIN.split(":")[0]}`;
}

/** The address as a browser needs it: scheme and port intact. */
function storeHref(slug: string): string {
  const protocol = ROOT_DOMAIN.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${slug}.${ROOT_DOMAIN}`;
}

export default async function DashboardPage() {
  const ctx = await requireMerchantContext();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        {/* Heading role: 24px / 600 / 1.2 */}
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.dashboard.heading}
        </h1>

        {/* Label role, --muted-foreground. The address, not a URL bar. */}
        <p className="text-sm leading-normal font-medium text-muted-foreground">
          {strings.dashboard.address.replace("{host}", storeHost(ctx.storeSlug))}
        </p>
      </div>

      {/*
       * The empty state. Same --muted fill and --border hairline construction
       * as /signup and /onboarding/create-store — the shadcn Card defaults are
       * overridden rather than re-authored so the component stays upgradable.
       */}
      <Card className="rounded-lg border border-border bg-muted ring-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
        <CardContent className="flex flex-col items-start gap-2">
          <h2 className="font-heading text-base leading-normal font-semibold text-foreground">
            {strings.dashboard.emptyHeading}
          </h2>
          <p className="text-base leading-normal font-normal text-muted-foreground">
            {strings.dashboard.emptyBody}
          </p>

          {/*
           * A different origin, so a plain anchor in a new tab rather than a
           * client-router push. `rel="noopener noreferrer"` because the target
           * is a merchant-controlled host inside the wildcard.
           */}
          <a
            href={storeHref(ctx.storeSlug)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-base leading-normal font-medium text-foreground underline underline-offset-3"
          >
            {strings.dashboard.viewStore}
            <ExternalLink aria-hidden="true" className="size-4" />
            <span className="sr-only">{strings.dashboard.viewStoreLabel}</span>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
