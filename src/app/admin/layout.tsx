import { AdminBanner } from "@/components/admin/admin-banner";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Label } from "@/components/ui/label";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { strings } from "@/lib/strings";
import { platformDb } from "@/server/db/platform";

import { requireAdminContext } from "@/server/admin/context";

import { SignOutButton } from "../sign-out-button";

/**
 * The Platform Admin shell — Surface C (D-01, 06-UI-SPEC.md § C0).
 *
 * ---------------------------------------------------------------------------
 * THIS LAYOUT IS NOT THE AUTHORIZATION BOUNDARY. IT NEVER REDIRECTS.
 * ---------------------------------------------------------------------------
 * Same rule as `(dashboard)/layout.tsx`, for the same reason: a Next 16 layout
 * does not control whether its child segments render or appear in the RSC
 * payload, and it does not re-run on client-side navigation between sibling
 * routes. So a check placed only here is a check that sometimes does not
 * happen. `requireAdminContext()` is called below for DATA — the owner's
 * `userId`, to read their email for the header — and every `page.tsx` under
 * this tree calls it again as the real gate. `React.cache()` collapses the
 * repeat calls within one render pass to a single `getSession`.
 *
 * ---------------------------------------------------------------------------
 * NO LOCAL `not-found.tsx`. THIS IS A DECISION, NOT AN OMISSION.
 * ---------------------------------------------------------------------------
 * D-06 requires a non-admin's 404 to be byte-identical to a route that never
 * existed. With no local not-found boundary here, `notFound()` thrown inside
 * `requireAdminContext()` bubbles past this layout entirely and renders
 * `src/app/not-found.tsx` — the same branded 404 every other dead route in
 * this app renders — with this admin chrome skipped. A local
 * `src/app/admin/not-found.tsx` would render INSIDE this shell (the gold
 * banner, the rail) and would itself leak the surface's existence to the
 * exact caller D-06 exists to keep it hidden from. Do not add one.
 *
 * ---------------------------------------------------------------------------
 * ITS OWN `ThemeProvider` AND ITS OWN `Toaster`, NOT THE DASHBOARD'S.
 * ---------------------------------------------------------------------------
 * `(dashboard)/layout.tsx`'s `Toaster` comment warns that two mounts show
 * every toast twice — that warning is about two `Toaster`s on the SAME
 * rendered tree. It does not apply here: D-01 keeps this route tree and the
 * merchant dashboard's out of each other's bundle by construction (this is
 * `src/app/admin/**`, a literal segment, not a route group sharing the
 * dashboard's layout), and a session is never on both trees in the same
 * render — the owner has no store (D-04) and a merchant has no
 * `platformRole`. Two independent trees, two independent mounts; neither can
 * ever be visited in the same page load as the other, so there is nothing to
 * double.
 *
 * ---------------------------------------------------------------------------
 * ABSENT BY DESIGN: NO TRIAL BANNER, NO SEARCH, NO STORE NAME, NO SWITCHER.
 * ---------------------------------------------------------------------------
 * All four exist on the merchant header band and all four are specific to
 * having a store — a trial clock, a store-scoped search index, a store name to
 * disambiguate two open tabs, a store switcher. D-04 makes the owner's account
 * admin-only with no `Organization` of its own, so none of the four has a
 * subject to describe. Their absence is R-1's second-cheapest distinctness
 * signal after the wordmark treatment in `AdminSidebar`'s header, not a gap to
 * fill later. There is also no link back to `/dashboard`: the owner has
 * nowhere on that surface to go back to.
 */
export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const ctx = await requireAdminContext();
  const owner = await platformDb.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { email: true },
  });

  return (
    <>
      <AdminBanner />

      <ThemeProvider>
        <SidebarProvider>
          {/*
           * Literal zeros: plan 06-10 wires `pendingOrderClaims`, 06-16 wires
           * `pendingSubscriptionClaims`, 06-12 wires `unreadThreads`. Honest
           * rather than unfinished — see `AdminSidebar`'s own header for why
           * each later plan changes only this call site.
           */}
          <AdminSidebar
            pendingOrderClaims={0}
            pendingSubscriptionClaims={0}
            unreadThreads={0}
          />

          <SidebarInset>
            <header className="flex min-h-14 items-center gap-3 border-b border-border px-4 sm:px-8">
              <SidebarTrigger
                aria-label={strings.admin.nav.openNavigation}
                className="lg:hidden"
              />

              <div className="ml-auto flex items-center gap-3">
                <ThemeToggle />

                <Label className="hidden text-sm leading-normal font-normal text-muted-foreground md:inline">
                  {owner.email}
                </Label>

                <SignOutButton />
              </div>
            </header>

            <div className="flex flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
              {children}
            </div>
          </SidebarInset>

          <Toaster />
        </SidebarProvider>
      </ThemeProvider>
    </>
  );
}
