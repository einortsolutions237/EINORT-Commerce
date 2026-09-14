---
phase: 06-merchant-dashboard-platform-admin
plan: 05
subsystem: dashboard-attention
tags: [dashboard, dash-01, dash-02, r-5, r-6]

requires:
  - phase: 06-merchant-dashboard-platform-admin (plan 02)
    provides: "strings.dashboard.attention copy surface"
provides:
  - "attentionCounts(), activeProductCount(), LOW_STOCK_THRESHOLD in src/server/dashboard/queries.ts"
  - "The 'Needs your attention' band — first block on /dashboard (DASH-02)"
  - "The 'Products live' 5th metric card (DASH-01)"
  - "/dashboard's first loading.tsx"
affects: []

tech-stack:
  added: []
  patterns:
    - "createMany data literals through scopedDb still need an explicit tenantId field to satisfy TypeScript's checked CreateManyInput, even though the runtime extension re-stamps it regardless — TS has no visibility into the query-extension's argument rewrite."
    - "Zero-count tiles are omitted, not shown as 0; an all-three-zero band collapses to a single muted Body line rather than an empty grid."
    - "DashboardCard (260903-ugl's previously-unwired primitive) gets its first real consumer here, as the plan's own read_first note anticipated."

key-files:
  created:
    - "src/components/dashboard/attention-band.tsx"
    - "src/app/(dashboard)/dashboard/loading.tsx"
  modified:
    - "src/server/dashboard/queries.ts"
    - "tests/isolation/dashboard-attention.test.ts"
    - "src/app/(dashboard)/dashboard/page.tsx"
    - "src/app/(dashboard)/dashboard/overview-metrics.tsx"

key-decisions:
  - "Fixed a real bug in the already-committed Task 1 RED test: its createMany fixtures (order, product, productVariant) omitted the scalar tenantId field, which the CHECKED createMany input type requires even though scopedDb's runtime query extension always re-stamps tenantId last-wins. tests/isolation/catalog.test.ts already established the pattern (tenantId included in createMany data despite the extension); dashboard-attention.test.ts just missed it. Fixed by adding tenantId to all three createMany call sites rather than working around the type error."
  - "Attention tile icons/links corrected to the plan's exact spec after an initial pass used approximate substitutes: BellRing (not MessageSquareWarning) for claims, PackageMinus (not PackageX) for low stock, TriangleAlert (not AlertTriangle) for disputed, and the disputed tile links to /dashboard/orders?state=disputed, not bare /dashboard/orders."
  - "The disputed tile's count renders in text-destructive per the plan's explicit instruction — the only place in this band severity is expressed through color, and destructive is not gold so the budget is untouched."
  - "Products live 5th card kept on the existing raw Card/CardHeader/CardTitle/CardContent shape (matching its four siblings) rather than DashboardCard — the plan's DashboardCard instruction was scoped to the attention band's tiles specifically."

requirements-completed: [DASH-01, DASH-02]

duration: ~40min (continuation of interrupted session)
completed: 2026-09-14
---

# Phase 06 Plan 05: Dashboard Attention Band Summary

Task 2 added three tenant-scoped derived counts (`attentionCounts`, `activeProductCount`) and the `LOW_STOCK_THRESHOLD` constant to `src/server/dashboard/queries.ts`, and fixed a real TypeScript bug in Task 1's already-committed isolation-test fixtures (missing `tenantId` in `createMany` data). Task 3 built the `AttentionBand` component (up to three tiles: pending claims, low stock, disputed orders — zero-count tiles omitted, all-zero collapses to one line), wired it into `/dashboard` between the header and the metric grid, appended a fifth "Products live" card to `OverviewMetrics`, and created `/dashboard`'s first `loading.tsx` skeleton.

## Verification

- `npm run lint && npm run typecheck && npm run test:unit && npm run build` — all green (665/665 unit tests, clean build with `/dashboard` route present). Typecheck run after build per this project's known `.next/types` staleness trap.
- `npx dotenv -e .env.test -- vitest run tests/isolation/dashboard-attention.test.ts` — 10/10 passed, including both stock boundary cases and the single-constant source-scan guard.
- All Task 3 acceptance-criteria greps re-verified directly: `text-destructive` present (2×, doc comment + tile), `min-h-11` present, `xl:grid-cols-5` present exactly once in `overview-metrics.tsx`, gold-accent budget unchanged at exactly 5 across the repo, zero gold references in `attention-band.tsx`. The plan's own prose-literal grep (`grep -nE '"[A-Z][a-z]+ [a-z]+'`) flags one line — it is inside a doc comment quoting the band's own heading copy for context, not a JSX string literal; the real contract test (part of the 665 green unit tests) strips comments before scanning and passed. Same false-positive shape 06-04's SUMMARY documented for the gold-budget grep.
- `git diff` on `page.tsx` confirmed no changes inside `RevenueBars`, `RecentOrders`, or the storefront-address block — only the new imports, the two added `Promise.all` entries, and the `<AttentionBand>` insertion.

## Session Continuity Note

This plan's Task 2 code (`queries.ts`) was found already written but uncommitted in the worktree when the orchestrator resumed after a rate-limit interruption. Task 3 was completed by the orchestrator directly: the first `attention-band.tsx` draft used approximate icon/link choices before the plan file itself was read in full; a second pass corrected icons, the disputed-tile link, and the `text-destructive` count color to match `06-05-PLAN.md`'s exact instructions before committing.

## Self-Check: PASSED

`attention-band.tsx`, `loading.tsx` exist on disk and are committed (`b94fda8`, `9d64e3c`). `queries.ts` and the isolation test fix are committed separately (`b94fda8`). Full automated gate green, isolation suite green.
