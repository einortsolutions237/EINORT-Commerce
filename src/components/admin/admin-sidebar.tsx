"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  CreditCard,
  MessagesSquare,
  Store,
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
import einortLogo from "@/assets/brand/einort-logo.png";
import { BRAND, strings } from "@/lib/strings";

/**
 * The Platform Admin navigation rail — Surface C (06-UI-SPEC.md § C0).
 *
 * ---------------------------------------------------------------------------
 * THE SAME BLOCK AND THE SAME BREAKPOINT AS THE MERCHANT RAIL, ON PURPOSE.
 * ---------------------------------------------------------------------------
 * Structurally this is `src/components/app-sidebar.tsx` with four destinations
 * instead of seven: the same shadcn `sidebar` block, the same 256px-at-`lg` /
 * off-canvas-sheet behaviour, the same `isCurrent` helper, the same
 * `h-auto min-h-11` touch-target override. D-01 keeps the two trees out of each
 * other's bundle, which is why this is a sibling file rather than a prop on the
 * merchant rail — but the two surfaces should still FEEL like one product, and
 * a second navigation idiom invented here would be a second thing to maintain
 * for no gain.
 *
 * ONE FLAT GROUP, NO GROUP LABELS. The merchant rail carries three named groups
 * because seven destinations need sorting; four do not, and a `SidebarGroupLabel`
 * over a list of four is chrome describing itself.
 *
 * ---------------------------------------------------------------------------
 * THE ACTIVE ITEM IS NOT BLUE. THIS IS A BUDGET, NOT AN OVERSIGHT.
 * ---------------------------------------------------------------------------
 * Carried across verbatim from the merchant rail's header, because the reason
 * is unchanged and the "fix" is just as tempting here. 06-UI-SPEC.md § Color
 * reserves `--primary` for a short list, and the active nav item is not on it:
 * it gets a `--sidebar-accent` fill and `--sidebar-primary` text. A blue fill
 * bar would be an accent on a page that already has a primary CTA, and an
 * accent that marks everything marks nothing.
 *
 * `aria-current="page"` carries the same information without relying on colour,
 * which the accessibility floor requires independently.
 *
 * ---------------------------------------------------------------------------
 * GOLD MEANS UNREVIEWED MONEY. BLUE MEANS UNREAD INFORMATION.
 * ---------------------------------------------------------------------------
 * Two count badges in one rail with two hues, deliberately (§ Color's narrow
 * accent amendment). `Payment claims` and `Subscription payments` are both
 * money somebody has not looked at yet, so both wear gold — and they SHARE one
 * `variant="gold"` occurrence, because the badge is rendered once inside the
 * item map and selected by the item's own `badge` field. That shared slot is
 * entry #4 of the five-use budget in § Color, and
 * `tests/unit/dashboard-nav.test.ts` counts exactly one occurrence in this
 * file. `Support` is unread information, not money: inflating gold into a
 * generic notification hue would destroy the signal the claims queues depend
 * on, so its badge is `variant="default"`.
 *
 * Every badge sits beside its item's text label and carries an `sr-only`
 * sentence naming what the number counts, so neither hue is ever the only
 * signal. A badge renders only when its count is greater than zero: a permanent
 * `0` is a decoration that teaches the owner to stop reading the one place that
 * is supposed to shout.
 *
 * ---------------------------------------------------------------------------
 * THE COUNTS ARE PROPS, AND THEY ARE ZERO TODAY BECAUSE THE QUEUES DO NOT EXIST.
 * ---------------------------------------------------------------------------
 * `src/app/admin/layout.tsx` passes literal zeros. That is honest rather than
 * unfinished: plan 06-10 wires `pendingOrderClaims`, 06-16 wires
 * `pendingSubscriptionClaims` and 06-12 wires `unreadThreads`, and because the
 * counts are props each of those plans changes one call site instead of this
 * component. The rail is a Client Component and all three counts are database
 * reads, so they could not be fetched here in any case.
 *
 * ---------------------------------------------------------------------------
 * EVERY VISIBLE STRING COMES FROM `strings.admin.nav`.
 * ---------------------------------------------------------------------------
 * C-14. `admin.ts` is the owner's copy module and it is authored in one pass
 * before any component exists, so a label written here would be a label the
 * later i18n extraction never sees.
 */

/**
 * Which count, if any, an item carries — not a boolean, because the two badges
 * differ in hue AND in what they announce. A third member added here is a
 * compile error in `badgeFor` below until it is given a rendering.
 */
type BadgeKind = "pending" | "unread";

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly badge?: BadgeKind;
}

/** The apex route, matched exactly — every other item matches by prefix. */
const MERCHANTS_HREF = "/admin";

/**
 * § C0's four destinations, in render order. Adding an admin route means adding
 * it here in the same commit that adds its `page.tsx`; a route nobody can click
 * still resolves from the address bar, which is exactly how it stays invisible.
 */
const NAV_ITEMS: readonly NavItem[] = [
  {
    href: MERCHANTS_HREF,
    label: strings.admin.nav.merchants,
    icon: Store,
  },
  {
    href: "/admin/claims",
    label: strings.admin.nav.claims,
    icon: Banknote,
    badge: "pending",
  },
  {
    href: "/admin/subscriptions",
    label: strings.admin.nav.subscriptions,
    icon: CreditCard,
    badge: "pending",
  },
  {
    href: "/admin/support",
    label: strings.admin.nav.support,
    icon: MessagesSquare,
    badge: "unread",
  },
];

/**
 * Exact match for the apex, prefix match for everything else.
 *
 * Verbatim from the merchant rail, with the exact-match constant swapped: a
 * bare `startsWith` would light `Merchants` on every admin route, since every
 * one of them starts with `/admin`. The prefix arm appends a `/` so a future
 * `/admin/claims-archive` does not light `Payment claims`.
 */
function isCurrent(pathname: string, href: string): boolean {
  if (href === MERCHANTS_HREF) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface AdminSidebarProps {
  /** Order-payment claims awaiting the owner's review, across every tenant. */
  readonly pendingOrderClaims: number;
  /** Merchant → EINORT subscription payments awaiting review. */
  readonly pendingSubscriptionClaims: number;
  /** Support threads with at least one message the owner has not read. */
  readonly unreadThreads: number;
}

export function AdminSidebar({
  pendingOrderClaims,
  pendingSubscriptionClaims,
  unreadThreads,
}: AdminSidebarProps) {
  const pathname = usePathname();

  /**
   * The count an item's badge shows, resolved from the item itself so the map
   * below stays a render and not a lookup table with a render inside it.
   */
  const countFor = (item: NavItem): number => {
    if (item.href === "/admin/claims") return pendingOrderClaims;
    if (item.href === "/admin/subscriptions") return pendingSubscriptionClaims;
    if (item.href === "/admin/support") return unreadThreads;
    return 0;
  };

  return (
    <Sidebar
      className="border-sidebar-border"
      /*
       * `Sidebar`'s own `fixed inset-y-0 h-svh` (`src/components/ui/sidebar.tsx`)
       * positions the desktop rail relative to the true viewport, ignoring
       * `AdminBanner`'s height even though the banner renders before this tree
       * in `src/app/admin/layout.tsx` — a `position: fixed` box is taken out of
       * document flow entirely, so a sibling occupying space above it in the
       * flow does not push it down. Without this override the rail's own
       * header (the wordmark + "Platform Admin" lockup below) draws underneath
       * the banner's `sticky top-0 z-30` strip instead of below it.
       *
       * An inline `style` wins over `Sidebar`'s class-based `top`/`h-svh`
       * regardless of Tailwind's own utility ordering, which a className
       * override cannot guarantee. `2rem` is `AdminBanner`'s rendered height —
       * `min-h-8` wins over its `py-0.5` content box there (21px line-box +
       * 4px padding = 25px < 32px floor), and that file's own header documents
       * why the banner can never grow past one line, so this value never
       * drifts out from under it.
       */
      style={{ top: "2rem", height: "calc(100svh - 2rem)" }}
    >
      <SidebarHeader className="min-h-14 justify-center border-b border-sidebar-border px-4">
        <div className="flex items-center gap-2">
          <Image src={einortLogo} alt={BRAND} className="h-6 w-auto shrink-0" />
          {/*
           * § R-1's second, cheaper distinctness signal: the wordmark followed
           * by `Platform Admin` in muted Label on its own line. It costs no
           * colour, it sits above every page, and together with the four
           * absences in the header band (no trial banner, no search modal, no
           * store name, no switcher) it does more per pixel than a hue would.
           */}
          <div className="flex min-w-0 flex-col">
            <span className="text-sm leading-normal font-semibold tracking-wide text-sidebar-foreground">
              {BRAND}
            </span>
            <span className="text-sm leading-normal font-semibold text-muted-foreground">
              {strings.admin.nav.platformAdmin}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) => {
                const current = isCurrent(pathname, item.href);
                const Icon = item.icon;
                const count = countFor(item);
                const showBadge = item.badge !== undefined && count > 0;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={current}
                      /*
                       * `h-auto min-h-11` overrides the registry's `h-8`: the
                       * 44px touch target is inherited from the merchant rail
                       * and is non-negotiable on this market's hardware.
                       * `font-semibold` (and its `data-active` twin) holds the
                       * two-weight type contract — there is no 500 here.
                       */
                      className="h-auto min-h-11 text-sm font-semibold data-active:font-semibold data-active:text-sidebar-primary"
                      aria-current={current ? "page" : undefined}
                      render={<Link href={item.href} />}
                    >
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>

                      {showBadge && item.badge === "pending" ? (
                        <Badge variant="gold" className="ml-auto tabular-nums">
                          <span aria-hidden="true">{count}</span>
                          <span className="sr-only">
                            {strings.admin.nav.pendingCountLabel.replace(
                              "{n}",
                              String(count),
                            )}
                          </span>
                        </Badge>
                      ) : null}

                      {showBadge && item.badge === "unread" ? (
                        <Badge
                          variant="default"
                          className="ml-auto tabular-nums"
                        >
                          <span aria-hidden="true">{count}</span>
                          <span className="sr-only">
                            {strings.admin.nav.unreadCountLabel.replace(
                              "{n}",
                              String(count),
                            )}
                          </span>
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
