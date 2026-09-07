# Quick Task 260906-egn: Rebuild the merchant dashboard shell and Overview page to match the owner-supplied design reference (low-risk items only: nav grouping, working search modal, header controls, real Overview page) - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning

<domain>
## Task Boundary

Rebuild the merchant dashboard shell and Overview page toward parity with the owner-supplied design reference at `.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md`, scoped to the low-risk subset only:

1. Group `src/components/app-sidebar.tsx`'s 7 existing nav destinations under section labels.
2. Replace `src/components/dashboard-topbar-search.tsx`'s decorative search box with a real ⌘K search modal over Products and Orders.
3. Add header controls: a light/system/dark theme toggle, a decorative notification bell, and a "Super Admin Panel" button stub linking to `/admin` (route doesn't exist yet).
4. Rebuild `src/app/(dashboard)/dashboard/page.tsx` from the Phase-2 empty-state placeholder into a real Overview page: metrics cards, a revenue-over-time chart, and a recent-orders list.

Explicitly out of scope: Analytics, Inventory, Customers, Domains, Delivery, Settings pages, and the Super Admin console itself — these require their own data-model decisions and are separate, larger future phase scope.

</domain>

<decisions>
## Implementation Decisions

### Nav grouping
- 3 groups: **General** (Overview alone), **Commerce** (Products, Storefront Editor, Orders, Claims), **Configuration** (Plan, Payment Settings). Not the reference's 4-group taxonomy — a "Channels" group with only Storefront Editor in it would be a group of one.

### Search scope
- The ⌘K modal searches **Products and Orders** only. No Customers scope (no dedicated Customers page exists yet to link results to).

### Theme toggle
- **3-way**: Light / System / Dark. Dark-mode CSS variables already exist in `globals.css` (from the `260823-gu4` retrofit) but have never been wired to a real switcher — this task wires them.

### Overview window
- **Fixed last-7-days** for both the metrics cards and the revenue chart. No date-range picker — matches the reference's Overview page (its Analytics page, not Overview, is the 30-day/range-picker surface, and Analytics is out of scope here).
- **Explicit approved exception — Active orders is unwindowed.** Confirmed with the user after the plan-checker flagged this as a deviation from the rule above needing real confirmation, not an assumption: the Active-orders card counts the merchant's whole current backlog (every order in a non-terminal state), regardless of `placedAt`, rather than the fixed 7-day window the other three cards use. Rationale: it's a "what needs attention right now" gauge, not a period metric — a 9-day-old unfulfilled order is still real work owed to a customer, and windowing it would hide it. The card's sublabel must read "All time" (while the other three read "Last 7 days") so the asymmetry is visible on screen, not just in a comment.

### Keyboard shortcut platform-awareness
- The user flagged that ⌘K is Mac-only notation. The search shortcut must be platform-aware: the listener accepts **either** `metaKey` (Mac) **or** `ctrlKey` (Windows/Linux) + `K`, and the visible hint in the search box renders `⌘K` on Mac and `Ctrl K` on Windows/Linux (detected client-side, e.g. via `navigator.platform`/`navigator.userAgent`, never hardcoded to one symbol). This is EINORT's own target market (Cameroon, Windows-majority merchant hardware per `CLAUDE.md`), so defaulting to the Mac-only glyph would be wrong for most real users.

### Claude's Discretion
- Exact metrics-card set and how each metric is computed from existing `src/server/orders`/`src/server/catalog` queries (must derive from what's actually queryable today — do not fabricate a metric with no backing data).
- Chart implementation approach (library choice, if any, vs. hand-rolled) — must not introduce a new dependency without checking what's already installed.
- Exact wording/copy for all new UI strings, routed through `src/lib/strings.ts` per the codebase's centralized-copy convention.
- The "Super Admin Panel" button's exact placement/styling, given `/admin` doesn't exist yet — should be styled real per 03-UI-SPEC.md conventions, with an inline comment noting the route is future (Phase 6+) scope.

</decisions>

<specifics>
## Specific Ideas

The 9 screenshots the user supplied (Overview, Analytics, Products, Inventory, Orders, Customers, Storefront, Domains, Payments, Delivery pages) and the `einort-commerce (2).zip` reference export are the visual ground truth for what "matching the reference" means, cross-referenced against `.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md`'s token/component documentation. Only the Overview screenshot's layout (metrics row, "Revenue Overview" chart, "Recent Orders" list) and the shared header/sidebar chrome across all screenshots are in scope for this task — the other 9 pages' content is out of scope.

Must preserve the existing token system (`--sidebar-*`, brand-600 blue, gold-accent) and the documented "active nav item is not blue, gold budget is exactly two uses" rule from `03-UI-SPEC.md`, enforced by `tests/unit/dashboard-nav.test.ts` — do not add a third gold usage or make the active nav item blue.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md` — the registered design source for this surface.
- `03-UI-SPEC.md` — the nav-color/gold-budget rule this task must not violate.
- `tests/unit/dashboard-nav.test.ts` — the contract test enforcing gold-budget and reachability of every nav destination.

</canonical_refs>
