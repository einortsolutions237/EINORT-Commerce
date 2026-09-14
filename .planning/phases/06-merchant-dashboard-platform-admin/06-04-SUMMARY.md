---
phase: 06-merchant-dashboard-platform-admin
plan: 04
subsystem: admin-shell
tags: [admin, layout, gold-budget, d-03, d-06]

requires:
  - phase: 06-merchant-dashboard-platform-admin (plan 01)
    provides: "requireAdminContext(), the admin trust boundary"
  - phase: 06-merchant-dashboard-platform-admin (plan 02)
    provides: "strings.admin, strings.support copy surfaces"
provides:
  - "The /admin route shell: layout, minimal merchants placeholder page, loading skeleton"
  - "Gold-accent budget amended from 2 to 5 uses across 5 named files, enforced by dashboard-nav.test.ts"
  - "D-03 deviation recorded in dashboard-header-controls.tsx: the Super Admin link stays removed"
affects: ["06-08 (replaces admin/page.tsx's body with the real merchants table)"]

tech-stack:
  added: []
  patterns:
    - "AdminBanner rendered as a sibling BEFORE ThemeProvider/SidebarProvider, not nested inside the sidebar flex row, so it spans the full width above both rail and content."
    - "No src/app/admin/not-found.tsx — notFound() from requireAdminContext() bubbles to the root src/app/not-found.tsx, keeping a non-admin's 404 byte-identical to a route that never existed (D-06)."

key-files:
  created:
    - "src/app/admin/layout.tsx"
    - "src/app/admin/page.tsx"
    - "src/app/admin/loading.tsx"
  modified:
    - "src/components/dashboard-header-controls.tsx"

key-decisions:
  - "AdminBanner is the literal first child of the layout's return (outside ThemeProvider's JSX nesting) so it spans the rail and content as one full-width sticky strip, per the plan's explicit ordering instruction."
  - "Owner's email for the header band is read via platformDb.user.findUniqueOrThrow({where:{id: ctx.userId}}) inside the layout — a live read every render, matching this codebase's existing 'derive, do not cache' posture for anything that could go stale (the same reasoning as trial-day derivation)."
  - "dashboard-header-controls.tsx's comment was corrected, not the code: no link was added, consistent with D-03."

requirements-completed: []

duration: ~25min (continuation of interrupted session)
completed: 2026-09-14
---

# Phase 06 Plan 04: The /admin Shell Summary

Task 2 completes the `/admin` route: `layout.tsx` (banner, theme/toast providers, sidebar, header band with theme toggle + owner email + sign-out), a minimal `page.tsx` placeholder for the merchants list (06-08 fills it in), and a matching `loading.tsx`. `dashboard-header-controls.tsx`'s stale comment predicting the Super Admin link's return was corrected to record D-03's actual decision (unlinked URL only).

## Verification

- `npm run lint && npm run typecheck && npm run test:unit && npm run build` — all green (665/665 unit tests, `/admin` listed in the build's route table). Typecheck was re-run after build to avoid this project's known `.next/types` staleness trap (a route added since the last build type-generates as an error until `next build` runs again).
- `npx vitest run tests/unit/dashboard-nav.test.ts` — 5/5, confirming the gold-accent budget lands at exactly 5 across the 5 named files (a manual raw-string grep undercounted because it missed the `variant: "gold"` object-literal form the registry-style files use, alongside `variant="gold"` JSX; the actual test's comment-stripping + dual-pattern regex is authoritative and passes).
- All Task 2 acceptance-criteria greps re-verified: no `src/app/admin/not-found.tsx`, `requireAdminContext` present in both new files, `ThemeProvider`/`Toaster` present in the layout, zero `"/dashboard"` links in the admin tree, zero `"/admin"` links in the merchant tree, D-03 comment present in `dashboard-header-controls.tsx`.

## Session Continuity Note

This plan was originally dispatched as a parallel worktree executor that completed Task 1 (commit `b4cd1a4`) before an API rate-limit session boundary interrupted it mid-Task-2. The orchestrator resumed Task 2 directly (not via a fresh subagent dispatch) using the worktree's existing progress, following the same plan file and read_first list.

## Self-Check: PASSED

`src/app/admin/layout.tsx`, `page.tsx`, `loading.tsx` exist on disk and are committed (`8bca19b`). `dashboard-header-controls.tsx`'s diff is comment-only (verified via `git show --stat`). Full automated gate green.
