import { isUrgentTrial } from "@/server/entitlements/resolve";
import { requireMerchantContext } from "@/server/merchant/context";

import { SignOutButton } from "../sign-out-button";
import { TrialBanner } from "./trial-banner";

/**
 * The dashboard shell.
 *
 * ---------------------------------------------------------------------------
 * THIS LAYOUT IS NOT THE AUTHORIZATION BOUNDARY. IT NEVER REDIRECTS.
 * ---------------------------------------------------------------------------
 * It calls `requireMerchantContext()` for DATA — the trial banner needs a
 * server-computed `daysLeft` — and for nothing else. Putting the auth check
 * here is the natural-looking mistake and it is a real one on two counts: a
 * Next 16 layout does not control whether its child segments render or appear
 * in the RSC payload, and it does not re-run on client-side navigation between
 * sibling routes, so a session check placed here is a check that sometimes does
 * not happen.
 *
 * Every page under this group therefore calls the DAL itself. That is not
 * defensive duplication — it is the only version of the check that is actually
 * enforced — and `React.cache()` collapses the repeat calls to one `getSession`
 * and one organization read per render pass, so it is free. A page under
 * `(dashboard)/` that never calls `requireMerchantContext()` is a bug, whatever
 * this file does.
 *
 * (The inverse of `src/app/s/[slug]/layout.tsx`, deliberately. There, the gate
 * belongs in the layout: the storefront's tenant comes from the hostname, which
 * is fixed for the whole subtree, and a Phase 3 page added beneath it should
 * inherit the gate rather than have to remember it. Here the subject is a
 * session, which is per-request and can expire mid-visit.)
 *
 * ---------------------------------------------------------------------------
 * THIS ROUTE GROUP IS APEX-ONLY, AND IT IS ALREADY ENFORCED — DO NOT "FIX" IT.
 * ---------------------------------------------------------------------------
 * `src/proxy.ts` classifies any storefront subdomain as `kind: "store"` and
 * rewrites its entire path under `/s/{slug}`, so `maboutique.einort.com/dashboard`
 * becomes `/s/maboutique/dashboard`, where no route file exists, and 404s. The
 * dashboard is therefore unreachable from a merchant-controlled hostname for
 * free, by the same mechanism that keeps `/api/auth/*` apex-only (D-07) — which
 * is what lets the session cookie stay host-only. There is no hostname check to
 * add here, and adding one to `src/proxy.ts` would break that file's own no-I/O
 * rule while duplicating a guarantee the rewrite already gives.
 */
export default async function DashboardLayout({
  children,
  // `"/"` and not `"/dashboard"`: a route group adds no URL segment, so Next
  // generates this layout's key as the apex. Confirmed against the generated
  // `LayoutRoutes` union rather than assumed from the folder name.
}: LayoutProps<"/">) {
  const ctx = await requireMerchantContext();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:px-8">
      {/*
       * Single content column, max-w-3xl. No sidebar: there is nothing to
       * navigate to yet, and a placeholder nav rail would be Phase 3's
       * decision made early and badly.
       */}
      <div className="flex w-full max-w-3xl flex-col gap-6">
        {/*
         * The header band. The store name, so the merchant can see at a glance
         * which store they are looking at — the one fact the whole dashboard
         * is scoped to.
         */}
        <header className="flex items-center justify-between gap-4 border-b border-border pb-4">
          <span className="text-sm leading-normal font-semibold text-foreground">
            {ctx.storeName}
          </span>
          {/* Calls the signOutMerchant server action; see sign-out-button.tsx. */}
          <SignOutButton />
        </header>

        {/*
         * Above the content, full column width, on every dashboard route
         * (D-11). `isUrgentTrial` owns the threshold so the banner never
         * compares against a literal day count of its own.
         */}
        <TrialBanner
          daysLeft={ctx.trial.daysLeft}
          state={ctx.trial.state}
          urgent={isUrgentTrial(ctx)}
        />

        {children}
      </div>
    </main>
  );
}
