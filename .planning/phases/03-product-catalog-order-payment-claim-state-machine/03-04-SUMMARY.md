---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 04
subsystem: ui
tags: [next-app-router, shadcn-sidebar, lucide-react, prisma, tailwind, vitest, i18n-copy]

# Dependency graph
requires:
  - phase: 03-01
    provides: PaymentClaim model, ClaimStatus enum, @@index([tenantId, status, submittedAt]), PaymentClaim registered in TENANT_SCOPED_MODELS
  - phase: 03-02
    provides: shadcn sidebar/sheet/tooltip/skeleton/separator/badge blocks, the badge `gold` variant, surface-token-isolation grep test
  - phase: 02
    provides: requireMerchantContext(), isUrgentTrial(), scopedDb(), TrialBanner, SignOutButton, strings.ts conventions
provides:
  - Six-destination dashboard navigation rail (AppShell) reachable from every dashboard page
  - Dashboard layout rebuilt as SidebarProvider + rail + header band + trial banner, with the off-canvas sheet below 1024px
  - pendingClaimCount(tenantId) — an index-only tenant-scoped count() driving the ORD-03/D-13 gold badge
  - The complete Phase-3 copy module — eight new strings namespaces plus strings.entitlements.productLimitReached
  - tests/unit/dashboard-nav.test.ts — nav reachability, no-inline-copy and gold-accent-budget contract test
affects: [03-05, 03-06, 03-07, product-catalog, orders, claims-review, payment-settings, storefront-checkout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All Phase-3 user-facing copy landed up-front in one file so later plans read strings.* instead of appending to a contended file"
    - "Navigation contract enforced as a source-grep unit test rather than a DOM render"
    - "Counted-grep accent budget: a design token's scarcity is enforced by a test, not a convention"
    - "Badge counts are derived index-only count() queries, never denormalized counter columns"

key-files:
  created:
    - src/components/app-sidebar.tsx
    - src/server/claims/queries.ts
    - tests/unit/dashboard-nav.test.ts
  modified:
    - src/lib/strings.ts
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/(dashboard)/dashboard/plan/page.tsx
    - src/components/ui/sidebar.tsx
    - src/hooks/use-mobile.ts

key-decisions:
  - "The active nav item uses --sidebar-accent fill + --sidebar-primary text, not a --primary blue fill bar — 03-UI-SPEC § A. Color does not extend the accent budget to the rail"
  - "aria-current=\"page\" carries the active state for screen readers, because the visual treatment is colour-only and colour must never be the sole signal"
  - "The pending-claims badge renders only above zero; a zero badge is noise and would dilute what gold means"
  - "pendingClaimCount is a count() against @@index([tenantId, status, submittedAt]), not a denormalized counter — a derived number cannot drift from the rows across submit/confirm/reject/reopen"
  - "The registry sidebar's md: desktop breakpoint was overridden to lg: in place, because 03-UI-SPEC fixes the rail at 1024px; documented as the diff to re-apply after any shadcn re-add"
  - "The layout dropped its own max-w-3xl wrapper; each page now owns its content column so list pages can use max-w-5xl"
  - "src/server/claims/queries.ts was committed with Task 2 rather than Task 3 so the layout compiled at its own commit"

patterns-established:
  - "Nav contract test: every dashboard destination must appear in the rail or the build goes red — an unreachable page becomes a test failure instead of a support message"
  - "Comment-stripping before source matching, with string literals preserved, so a header explaining a rule cannot self-invalidate the rule"
  - "Vacuity guard: a source-grep test asserts its target file exists and is non-empty before asserting anything about its contents"

requirements-completed: [ORD-03]

# Metrics
duration: ~50min (across two sessions)
completed: 2026-08-25
---

# Phase 3 Plan 04: AppShell Navigation, Pending-Claims Badge and the Phase-3 Copy Module Summary

**A six-destination dashboard rail on the shadcn sidebar block with an off-canvas sheet below 1024px, a gold pending-claims badge fed by an index-only tenant-scoped `count()`, and all 593 lines of Phase-3 user-facing copy landed up-front in `strings.ts`.**

## Performance

- **Duration:** ~50 min of execution across two sessions (the first ended on an API session limit)
- **Started:** 2026-08-25T01:30Z (approx.)
- **Completed:** 2026-08-25T05:16Z
- **Tasks:** 3
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- **The dashboard stopped being a single page.** Six destinations — Overview, Products, Orders, Payment claims, Plan, Payment settings — are now reachable from every dashboard route. `/dashboard/products` and the three other routes later plans build are no longer URLs nobody can reach.
- **The ORD-03 / D-13 pending-claims signal is live.** `pendingClaimCount(tenantId)` runs through `scopedDb`, matches the first two columns of `@@index([tenantId, status, submittedAt])`, and drives a gold count badge that renders only when work is actually waiting.
- **Every string Phase 3 needs exists before any page that renders it.** Eight namespaces (`products`, `orders`, `claims`, `paymentSettings`, `catalog`, `cart`, `checkout`, `orderStatus`) plus `strings.entitlements.productLimitReached` were transcribed from the approved 03-UI-SPEC contract in one pass, so plans 03-05 onward read copy instead of authoring it into a file four of them would otherwise contend over.
- **The two pre-existing pages migrated without changing substance.** Both keep their own `requireMerchantContext()` call and their `max-w-3xl` column; the layout is still explicitly not the authorization boundary.
- **Three design and architecture commitments became tests rather than conventions**, so a later plan cannot quietly break them.

## Task Commits

1. **Task 1: Land the complete Phase-3 copy module** — `c6fdd97` (feat)
2. **Task 2: The AppShell sidebar, and the migration of Overview and Plan into it** — `cc0d508` (feat)
3. **Task 3: `pendingClaimCount()` and the nav-contract test** — `618878f` (test) — the `src/server/claims/queries.ts` half of this task shipped in `cc0d508`; see Deviations.

**Plan metadata:** this SUMMARY's own commit.

## Files Created/Modified

- `src/lib/strings.ts` — +593 lines: the eight Phase-3 namespaces, `strings.dashboard.nav`'s six rail labels plus `openNavigation`, and `strings.entitlements.productLimitReached`. Each namespace carries a one-line comment naming the UI-SPEC section it was transcribed from.
- `src/components/app-sidebar.tsx` — the six-item rail. Labels read from `strings.dashboard.nav`, icons from `lucide-react`, active state from `usePathname()` (exact match for `/dashboard`, prefix for the rest), gold badge on `Payment claims` above zero only.
- `src/app/(dashboard)/layout.tsx` — rebuilt as `SidebarProvider` → `AppSidebar` + `SidebarInset`. Header band carries the `SidebarTrigger` below `lg`, the store name, and `SignOutButton`. Both load-bearing block comments survive verbatim; it still fetches data and still never redirects.
- `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/dashboard/plan/page.tsx` — each now supplies its own `max-w-3xl` column and keeps its own `requireMerchantContext()` call.
- `src/server/claims/queries.ts` — `pendingClaimCount(tenantId)`, `server-only`, with a header explaining why it is a `count()` and why its `tenantId` parameter is not what `no-tenant-id-param.test.ts` bans.
- `src/components/ui/sidebar.tsx`, `src/hooks/use-mobile.ts` — the registry's `md` desktop breakpoint moved to `lg` (1024px). See Deviations.
- `tests/unit/dashboard-nav.test.ts` — 5 tests: the module was actually read, all six hrefs present, `aria-current="page"` set, no inline prose, and `variant="gold"` spent exactly once in the rail and nowhere unauthorized.

## Decisions Made

- **No blue fill bar on the active nav item.** 03-UI-SPEC § A. Color budgets `--primary` elsewhere; the rail's active state is `--sidebar-accent` fill with `--sidebar-primary` text. Because that is colour-only, `aria-current="page"` is required rather than optional — the test asserts it.
- **No zero badge.** Gold means "a human needs to look at this now." A badge showing `0` teaches a merchant that gold is decorative, at which point the badge stops working on the day it matters.
- **`count()` over a counter column.** A denormalized `pendingClaimCount` would need to stay correct across submit, confirm, reject and re-submit-from-disputed — four places to drift, and a badge that lies is worse than no badge, since it either hides work or cries wolf.
- **The layout gave up its content column.** List pages need `max-w-5xl` per the Spacing Scale exceptions table, which the layout's old shared `max-w-3xl` wrapper made impossible without fighting it.
- **The gold budget is a counted grep.** A budget that is only written down in a spec is a budget that gets spent. `tests/unit/dashboard-nav.test.ts` caps `variant="gold"` at one occurrence in the rail and forbids it anywhere under `src/app` or `src/components` except the order-state chip module a later plan will add.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Overrode the shadcn sidebar registry's `md` desktop breakpoint to `lg`**
- **Found during:** Task 2 (the AppShell sidebar)
- **Issue:** 03-UI-SPEC § A. Navigation Shell fixes the rail at 1024px and above with an off-canvas sheet beneath it. The shadcn `sidebar` registry output ships a `md:` (768px) breakpoint in two `className` strings in `src/components/ui/sidebar.tsx`, and a matching `MOBILE_BREAKPOINT = 768` in `src/hooks/use-mobile.ts`. Left as shipped, the rail would appear at 768px — a tablet-width breakpoint the spec explicitly does not want — and the CSS and the JS media query are two halves of one decision that must agree.
- **Fix:** Changed the two utilities to `lg:block` / `lg:flex` and the hook's breakpoint to 1024, each with a header comment stating that this is the one deliberate override of registry output and naming the exact diff to re-apply if a future `shadcn add sidebar` overwrites the file. This follows the discipline `badge.tsx` already documents for its own registry diff.
- **Files modified:** `src/components/ui/sidebar.tsx`, `src/hooks/use-mobile.ts`
- **Verification:** `npx next build` compiles; `npm run lint` and `npm run typecheck` exit 0; `tests/unit/surface-token-isolation.test.ts` passes (no palette literal introduced).
- **Committed in:** `cc0d508` (Task 2 commit)
- **Note:** Neither file is in the plan's `files_modified` list. The plan's own Task 2 instruction — "read them rather than assuming an upstream API" — anticipated that the registry copy might not match the contract; it did not, and the contract wins.

### Sequencing Deviations

**2. `src/server/claims/queries.ts` shipped in the Task 2 commit rather than the Task 3 commit**
- **Found during:** Task 2
- **Issue:** The plan assigns `pendingClaimCount()` to Task 3, but Task 2's rewritten layout calls it. Committing Task 2 alone would have produced a commit that does not compile.
- **Fix:** Landed `queries.ts` with Task 2 so every commit in this plan builds on its own; Task 3's commit therefore carries only the nav-contract test. All of Task 3's acceptance criteria for the file still hold.
- **Files modified:** `src/server/claims/queries.ts`
- **Verification:** Every commit in the plan passes `npm run typecheck` and `npx next build` at its own tree.
- **Committed in:** `cc0d508`

---

**Total deviations:** 2 (1 Rule 3 blocking auto-fix, 1 commit-sequencing adjustment)
**Impact on plan:** Neither changes scope. The breakpoint override was required to satisfy the plan's own stated 1024px contract, and the resequencing exists only to keep every commit compilable. No scope creep.

## Issues Encountered

**Shared Neon test-branch contention between parallel Wave-3 worktrees.** `npm run test:full` connects to a single shared remote Neon test branch that each run truncates and seeds. Plan 03-05 is executing concurrently in a sibling worktree and running the same command against the same branch. Two runs were confirmed live simultaneously via process inspection, and both stalled on each other — this is the same symptom the first session of this plan diagnosed in `tests/isolation/tenant-isolation.test.ts` (DB-state assertions failing under concurrent truncate/seed) and correctly attributed to contention rather than to a 03-04 regression.

This is an environment/harness constraint, not a defect in this plan's code, and it is worth fixing at the harness level before the next parallel wave — either a per-worktree Neon branch or a cross-worktree lock around `test:full`.

**All verification that does not touch the shared database passes cleanly:**

| Check | Result |
|---|---|
| `npm run test:unit` | 13 files, 212 tests, 0 failures, 0 skipped — includes the 5 new `dashboard-nav` tests |
| `npx vitest run tests/unit/dashboard-nav.test.ts` | 5/5 pass |
| `npx vitest run tests/unit/surface-token-isolation.test.ts` | passes — no palette literal or literal colour in any file this plan touches |
| `npm run lint` | exit 0 at `--max-warnings=0` |
| `npm run typecheck` | exit 0 |
| `npx next build` | completes; 12 routes generated |
| Mutation check | removing the `/dashboard/claims` entry from the rail fails `npm run test:unit` with the intended message; reverted and re-verified clean |

No file in this plan's diff is exercised by a database-backed test: the change set is JSX, a strings object, one Prisma `count()` wrapper, and a source-grep test. The `test:full` DB tests it would run are the inherited Phase 1–2 isolation suite, which this plan does not touch.

## Known Stubs

None. Every destination in the rail links to a route that a later Wave-3 plan builds (`/dashboard/products`, `/dashboard/orders`, `/dashboard/claims`, `/dashboard/settings/payment`); the rail is deliberately built ahead of them, which is the plan's stated intent and the reason the reachability test exists.

## User Setup Required

None — no external service configuration required. No packages were installed by this plan.

## Next Phase Readiness

**Ready for the rest of Wave 3 and beyond:**
- `strings.products`, `strings.orders`, `strings.claims`, `strings.paymentSettings`, `strings.catalog`, `strings.cart`, `strings.checkout` and `strings.orderStatus` are complete and can be read directly — no later plan should append user-facing copy to `src/lib/strings.ts`.
- Any plan adding a dashboard route must add it to `NAV_ITEMS` in `src/components/app-sidebar.tsx` **and** to `REQUIRED_HREFS` in `tests/unit/dashboard-nav.test.ts` in the same commit.
- The order-state chip plan owns the second and final use of `variant="gold"`; its module filename must match `/order-state/` or the budget test will reject it.

**Concerns:**
- The `<human-check>` in the plan is unrun: `/dashboard` and `/dashboard/plan` should be opened in `npm run dev` at 1280px and 360px to confirm the rail highlights without a blue fill bar, the trial banner still sits above content on both pages, the Plan page still reads at `max-w-3xl`, and the rail becomes a sheet at 360px. Everything statically checkable about those properties is asserted by tests and the build, but the visual confirmation is outstanding.
- `npm run test:full` must be re-run once no sibling worktree is executing, before or during the orchestrator's merge, to confirm the inherited DB suite on the merged tree.

---
*Phase: 03-product-catalog-order-payment-claim-state-machine*
*Completed: 2026-08-25*
