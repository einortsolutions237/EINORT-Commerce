"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  CreditCard,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { BRAND, strings } from "@/lib/strings";

/**
 * The dashboard navigation rail (03-UI-SPEC.md § A. Navigation Shell).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS NOW, AND WHY IT IS THE REGISTRY BLOCK RATHER THAN A DIV.
 * ---------------------------------------------------------------------------
 * Phase 2's layout said, in a comment, that a placeholder nav rail would be
 * "Phase 3's decision made early and badly". Phase 3 is that phase: it adds
 * four destinations, and without a rail `/dashboard/products` is a URL nobody
 * can reach. The shadcn `sidebar` block is used rather than a hand-rolled rail
 * because the parts that are easy to get wrong — the off-canvas sheet, focus
 * trapping inside it, the escape key, the collapse cookie — are exactly the
 * parts it already ships.
 *
 * ---------------------------------------------------------------------------
 * THE ACTIVE ITEM IS NOT BLUE. THIS IS A BUDGET, NOT AN OVERSIGHT.
 * ---------------------------------------------------------------------------
 * 03-UI-SPEC.md § A. Color reserves `--primary` for four things, and the active
 * nav item is not one of them: it gets a `--sidebar-accent` fill and
 * `--sidebar-primary` text. A blue fill bar here would be the fifth place the
 * accent appears on a dashboard page that already has a primary CTA, and an
 * accent that marks everything marks nothing.
 *
 * `aria-current="page"` carries the same information without relying on colour,
 * which the accessibility floor requires independently.
 *
 * ---------------------------------------------------------------------------
 * GOLD APPEARS TWICE IN THIS ENTIRE PHASE. ONE OF THEM IS HERE.
 * ---------------------------------------------------------------------------
 * The pending-claims badge and the `Payment claimed` order chip. That is the
 * whole budget, and `tests/unit/dashboard-nav.test.ts` counts it, so spending
 * it on a generic highlight fails the build rather than passing review. Gold
 * means "a human needs to look at this now"; it is not a success colour, not a
 * hover, and not a border.
 *
 * The badge renders only when the count is greater than zero. A `0` badge is a
 * permanent decoration that teaches a merchant to stop looking at the one place
 * that is supposed to shout.
 *
 * ---------------------------------------------------------------------------
 * EVERY VISIBLE STRING COMES FROM `strings.dashboard.nav`.
 * ---------------------------------------------------------------------------
 * Not a house-style preference: `tests/unit/dashboard-nav.test.ts` fails on a
 * user-facing literal in this file, and on a missing destination. An
 * unreachable dashboard page is then a red test rather than a discovery.
 */

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Only the claims item carries the gold pending count. */
  readonly badged?: boolean;
}

/** The apex route, matched exactly — every other item matches by prefix. */
const OVERVIEW_HREF = "/dashboard";

/**
 * The six destinations, in render order. Adding a dashboard route means adding
 * it here; there is no second list to keep in step.
 */
const NAV_ITEMS: readonly NavItem[] = [
  {
    href: OVERVIEW_HREF,
    label: strings.dashboard.nav.overview,
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/products",
    label: strings.dashboard.nav.products,
    icon: Package,
  },
  {
    href: "/dashboard/orders",
    label: strings.dashboard.nav.orders,
    icon: ShoppingBag,
  },
  {
    href: "/dashboard/claims",
    label: strings.dashboard.nav.claims,
    icon: Banknote,
    badged: true,
  },
  {
    href: "/dashboard/plan",
    label: strings.dashboard.nav.plan,
    icon: CreditCard,
  },
  {
    href: "/dashboard/settings/payment",
    label: strings.dashboard.nav.paymentSettings,
    icon: Settings,
  },
];

/**
 * Exact match for the apex, prefix match for everything else.
 *
 * A bare `startsWith` would light Overview on every dashboard route, since
 * every one of them starts with `/dashboard`. The prefix arm appends a `/` so
 * that a future `/dashboard/products-archive` does not light `Products`.
 */
function isCurrent(pathname: string, href: string): boolean {
  if (href === OVERVIEW_HREF) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ pendingClaims }: { pendingClaims: number }) {
  const pathname = usePathname();

  return (
    <Sidebar className="border-sidebar-border">
      <SidebarHeader className="min-h-14 justify-center border-b border-sidebar-border px-4">
        <span className="text-sm leading-normal font-semibold tracking-wide text-sidebar-foreground">
          {BRAND}
        </span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) => {
                const current = isCurrent(pathname, item.href);
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={current}
                      /*
                       * `h-auto min-h-11` overrides the registry's `h-8`: the
                       * 44px touch target is inherited and non-negotiable on
                       * this market's hardware. `font-semibold` (and its
                       * `data-active` twin, which beats the registry's
                       * `font-medium`) holds the two-weight type contract —
                       * there is no 500 in this system.
                       */
                      className="h-auto min-h-11 text-sm font-semibold data-active:font-semibold data-active:text-sidebar-primary"
                      aria-current={current ? "page" : undefined}
                      render={<Link href={item.href} />}
                    >
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                      {item.badged && pendingClaims > 0 ? (
                        <Badge variant="gold" className="ml-auto tabular-nums">
                          {pendingClaims}
                        </Badge>
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
