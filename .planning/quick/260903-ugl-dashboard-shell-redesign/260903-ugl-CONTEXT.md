---
quick_id: 260903-ugl
slug: dashboard-shell-redesign
date: 2026-09-03
---

# Context: Dashboard Shell Redesign

## Origin

User shared screenshots of the real Shopify admin (`admin.shopify.com` — Home, Online Store,
Pages views) and the Shopify Theme Store (`themes.shopify.com`) as visual/structural reference,
asking for the EINORT-Commerce merchant dashboard to look similar.

## Locked decisions (via AskUserQuestion, this session)

1. **Fidelity**: Adopt Shopify's LAYOUT STRUCTURE (dark left icon-nav rail, top search bar,
   white card-based main content area on a soft gray background) — NOT Shopify's actual color
   palette. EINORT keeps its own locked blue/gold/slate + Outfit design system throughout. This
   is a structural/IA change, not a re-skin.
2. **Timing**: After Phase 4's gate closes (Phase 4 gate work was running in parallel when this
   task started; the user then explicitly said to run both in parallel rather than wait).
3. **Search bar**: Visual placeholder only. Style a search input matching Shopify's look
   (centered, keyboard-shortcut hint) but non-functional. Real cross-entity search
   (products/orders/customers) is out of scope, deferred to a future task.
4. **Card retrofit scope**: Shell only. Rebuild the sidebar rail and top bar to the new
   structure, and introduce the card convention as a new shared component — but do NOT retrofit
   the six existing dashboard pages' content (Overview, Products, Orders, Claims, Plan, Payment
   Settings) into it. That is a separate, deliberately deferred follow-up task.

## What must not change

- The storefront surface (`src/app/s/[slug]/**`) and its separate zinc-monochrome editorial
  design system — completely untouched, structurally isolated per
  `tests/unit/surface-token-isolation.test.ts`.
- EINORT's own brand colors (blue/gold/slate) — no Shopify colors anywhere.
- `(dashboard)/layout.tsx` remains NOT the authorization boundary — every page continues calling
  `requireMerchantContext()` itself. This file's own header comment explains why at length; do
  not "fix" it.
- The existing gold-badge budget (exactly 2 uses across the whole dashboard: the pending-claims
  nav badge, the `Payment claimed` order chip) — `tests/unit/dashboard-nav.test.ts` counts this.
  A restyled shell must not add a third.
- The existing nav-item set, hrefs, and `REQUIRED_HREFS` contract in
  `tests/unit/dashboard-nav.test.ts` — restyle the rail, don't change what it links to.
- Centralized copy convention (`src/lib/strings.ts`) — no new inline UI string literals.
- 44px minimum touch targets on nav items (`h-auto min-h-11`, already enforced, must survive).
- The two-weight type contract (`font-semibold` / `font-medium` only, no 500) already documented
  in `app-sidebar.tsx`'s header.

## Key discovery from pre-planning investigation

`src/app/globals.css` already defines a COMPLETE, unused dark color-token set (shadcn's default
`.dark` class scaffold, lines ~294-331) that includes dark sidebar tokens
(`--sidebar: oklch(0.208 0.04 265.8)` / slate-900, etc.) closely matching what a Shopify-style
dark rail needs — currently applied nowhere in the app. The current light-mode sidebar is white
(`--sidebar: oklch(1 0 0)`). Reusing these existing tokens (scoped to just the sidebar, not the
whole app going dark) is the likely lowest-risk path to a dark rail, rather than inventing new
color values — subject to confirming this is technically sound for the shadcn `Sidebar`
component's actual rendering (research task).

The dashboard already uses shadcn's `sidebar` block (`@/components/ui/sidebar`, `Sidebar` /
`SidebarProvider` / `SidebarInset` / `SidebarTrigger` etc.) — not a hand-rolled rail. Off-canvas
mobile sheet, focus trapping, and collapse behavior already ship with it per `app-sidebar.tsx`'s
own header comment.

No `<DashboardCard>` or equivalent shared card primitive currently exists — `(dashboard)/layout.tsx`'s
header states content width is "a per-page decision," each page supplying its own. This task
introduces the new card component but does not force existing pages to adopt it yet (see scope
decision #4 above).
