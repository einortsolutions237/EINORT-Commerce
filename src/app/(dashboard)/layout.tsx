import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { strings } from "@/lib/strings";
import { pendingClaimCount } from "@/server/claims/queries";
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
 * PHASE 3 REPLACED THE BARE COLUMN WITH THE SIDEBAR SHELL.
 * ---------------------------------------------------------------------------
 * Phase 2 wrote here that there was "nothing to navigate to yet". Phase 3 adds
 * four destinations, so `AppSidebar` is now mandatory — see its own header for
 * why the active item is not blue and why gold appears exactly twice in the
 * phase.
 *
 * Two consequences worth stating, because both look like omissions:
 *
 *   - This layout no longer owns a `max-w-3xl` column. Content width is now a
 *     per-page decision (forms and settings `max-w-3xl`, list pages
 *     `max-w-5xl`, per 03-UI-SPEC.md § Spacing Scale), so every page under this
 *     group supplies its own. A page that forgets renders full-bleed, which is
 *     visible immediately — that is the point.
 *   - The pending-claims count is fetched HERE rather than inside the rail,
 *     because the rail is a Client Component and the count is a tenant-scoped
 *     database read. It is a live `count()` on every dashboard render, not a
 *     maintained counter — `src/server/claims/queries.ts` explains why that is
 *     the cheaper of the two.
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
  const pendingClaims = await pendingClaimCount(ctx.tenantId);

  return (
    <SidebarProvider>
      <AppSidebar pendingClaims={pendingClaims} />

      <SidebarInset>
        {/*
         * The header band, retained from Phase 2 and extended with the sheet
         * trigger. The store name is still here because it is the one fact the
         * whole dashboard is scoped to, and a merchant with two stores open in
         * two tabs needs to be able to tell them apart at a glance.
         *
         * The trigger is hidden at `lg` and above, where the rail is already
         * on screen. Its accessible name comes from `strings` rather than the
         * registry's own hardcoded sr-only text, so the one string a screen
         * reader announces here is copy like every other.
         */}
        <header className="flex min-h-14 items-center gap-3 border-b border-border px-4 sm:px-8">
          <SidebarTrigger
            aria-label={strings.dashboard.nav.openNavigation}
            className="lg:hidden"
          />
          <span className="text-sm leading-normal font-semibold text-foreground">
            {ctx.storeName}
          </span>
          {/* Calls the signOutMerchant server action; see sign-out-button.tsx. */}
          <div className="ml-auto">
            <SignOutButton />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
          {/*
           * Above the content on every dashboard route (D-11). `isUrgentTrial`
           * owns the threshold so the banner never compares against a literal
           * day count of its own.
           */}
          <TrialBanner
            daysLeft={ctx.trial.daysLeft}
            state={ctx.trial.state}
            urgent={isUrgentTrial(ctx)}
          />

          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
