import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

import { strings } from "@/lib/strings";
import { overviewMetrics, recentOrders } from "@/server/dashboard/queries";
import { requireMerchantContext } from "@/server/merchant/context";

import { OverviewMetrics } from "./overview-metrics";
import { RecentOrders } from "./recent-orders";
import { RevenueBars } from "./revenue-bars";

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
 * ---------------------------------------------------------------------------
 * QUICK TASK 260906-egn REPLACED THE PHASE-2 EMPTY STATE WITH THE REAL
 * OVERVIEW.
 * ---------------------------------------------------------------------------
 * Phase 2 had no lists at all, so this page rendered a single empty-state
 * card linking only to the storefront. Phase 3 and 4 gave the dashboard real
 * products, orders and revenue; this task is what finally makes `/dashboard`
 * show them: four metric cards, a 7-day revenue chart and a recent-orders
 * list, all real and tenant-scoped (`@/server/dashboard/queries`). A
 * brand-new merchant with zero orders sees zeroes and empty states here, not
 * a crash — `overviewMetrics` and `bucketByDay` are both written to make that
 * the easy path rather than a special case.
 *
 * The storefront address line and "view store" link survive unchanged from
 * Phase 2: they remain the merchant's fastest path to their own shop, and
 * nothing about this task's scope touches them.
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

const OVERVIEW_WINDOW_DAYS = 7;

export default async function DashboardPage() {
  const ctx = await requireMerchantContext();

  const now = new Date();
  const since = new Date(now.getTime() - OVERVIEW_WINDOW_DAYS * 86_400_000);
  const [metrics, orders] = await Promise.all([
    overviewMetrics(ctx.tenantId, since),
    recentOrders(ctx.tenantId),
  ]);

  return (
    /*
     * The content column is the PAGE's, not the layout's, since Phase 3 moved
     * this page inside the sidebar shell. `max-w-6xl` — wider than the
     * `max-w-5xl` list-page width from 03-UI-SPEC.md § Spacing Scale — because
     * this page is a 4-column metric grid plus a chart plus a table, not a
     * single list; `max-w-3xl` (the old Phase-2 form width) has been too
     * narrow for this content since Task 4 replaced the empty state.
     */
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
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

      <a
        href={storeHref(ctx.storeSlug)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 w-fit items-center gap-1.5 text-base leading-normal font-medium text-foreground underline underline-offset-3"
      >
        {strings.dashboard.viewStore}
        <ExternalLink aria-hidden="true" className="size-4" />
        <span className="sr-only">{strings.dashboard.viewStoreLabel}</span>
      </a>

      <OverviewMetrics
        revenueXaf={metrics.revenueXaf}
        openOrders={metrics.openOrders}
        unitsSold={metrics.unitsSold}
        newCustomers={metrics.newCustomers}
      />

      <RevenueBars buckets={metrics.revenueByDay} totalXaf={metrics.revenueXaf} />

      <RecentOrders orders={orders} />
    </div>
  );
}
