---
phase: quick/260903-nxf
plan: 01
subsystem: ui
tags: [nextjs, sharp, next-image, branding, favicon, app-router]

# Dependency graph
requires: []
provides:
  - "Master platform brand asset at src/assets/brand/einort-logo.png"
  - "Rerunnable sharp-based icon generator at scripts/generate-brand-icons.mjs"
  - "Next 16 App Router auto-detected icon.png, apple-icon.png, favicon.ico"
  - "Logo mark rendered in dashboard sidebar header, /login, /signup"
affects: [dashboard-shell, auth-pages]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-built PNG-in-ICO container (ICONDIR + ICONDIRENTRY + raw PNG bytes) to avoid adding a png-to-ico dependency"
    - "Next 16 App Router reserved-filename icon convention (src/app/icon.png, apple-icon.png, favicon.ico) — zero code change needed in layout.tsx"

key-files:
  created:
    - src/assets/brand/einort-logo.png
    - scripts/generate-brand-icons.mjs
    - src/app/icon.png
    - src/app/apple-icon.png
  modified:
    - src/app/favicon.ico
    - src/components/app-sidebar.tsx
    - src/app/login/page.tsx
    - src/app/signup/page.tsx

key-decisions:
  - "Used sharp's fit:contain with a transparent background to letterbox the near-square (645x606) master onto perfect squares, rather than cropping, to preserve the faceted mark's keyhole cutout intact"
  - "Hand-rolled the ICO container instead of adding a png-to-ico npm dependency — PNG-in-ICO has been valid since Windows Vista and every current browser accepts it"
  - "alt text on every new <Image> reuses the existing centralized BRAND export (alt={BRAND}), never a literal, to satisfy the no-inline-copy convention enforced by tests/unit/dashboard-nav.test.ts"

patterns-established:
  - "scripts/*.mjs generator scripts self-verify their own output (dimension/alpha assertions on the source, byte-level ICO header checks on the result) and exit 1 loudly rather than writing a silently-wrong derived asset"

requirements-completed: [QUICK-260903-nxf]

# Metrics
duration: ~12min (Tasks 1-2 only; Task 3 checkpoint pending)
completed: 2026-09-03
---

# Phase quick/260903-nxf Plan 01: EINORT Platform Logo Summary

**EINORT platform brand mark (blue-to-purple gradient faceted "S") added as favicon/icon/apple-icon via Next 16's App Router file convention and rendered inline via next/image in the dashboard sidebar, /login, and /signup headers — Task 3's real-browser confirmation is still pending.**

## Performance

- **Duration:** ~12 min (Tasks 1-2)
- **Completed:** 2026-09-03 (Tasks 1-2; Task 3 checkpoint outstanding)
- **Tasks:** 2 of 3 complete (Task 3 is a blocking human-verify checkpoint)
- **Files modified:** 8 (5 created, 3 edited)

## Accomplishments
- Copied the verified master logo asset into the repo at `src/assets/brand/einort-logo.png` (504,499 bytes, byte-identical to source, 645x606, transparent)
- Wrote `scripts/generate-brand-icons.mjs`, a rerunnable, self-verifying sharp-based generator that derives `icon.png` (64x64), `apple-icon.png` (180x180), and a hand-built PNG-in-ICO `favicon.ico` (32x32) from the master asset
- Ran the generator; Next 16's App Router picked up all three reserved-filename icons automatically — confirmed by `npm run build` listing `○ /icon.png` and `○ /apple-icon.png` as static routes, with zero changes to `src/app/layout.tsx` or `next.config.ts`
- Rendered the logo mark via `next/image` beside the existing `{BRAND}` wordmark in the dashboard sidebar header (`src/components/app-sidebar.tsx`)
- Rendered the logo mark above the headings on `/login` and `/signup`, `priority`-loaded as a plausible LCP element on each auth page

## Task Commits

Each task was committed atomically:

1. **Task 1: Bring the logo into the repo and derive the favicon/icon/apple-icon files** - `c89860d` (feat)
2. **Task 2: Render the logo in the dashboard sidebar, login and signup headers** - `3e94aec` (feat)
3. **Task 3: Confirm the mark renders correctly in a real browser** - NOT YET RUN (blocking checkpoint, requires a human with a real browser)

## Files Created/Modified
- `src/assets/brand/einort-logo.png` - Master platform brand asset (source of truth for every derivative)
- `scripts/generate-brand-icons.mjs` - Sharp-based, rerunnable, self-verifying icon generator
- `src/app/icon.png` - Generated 64x64 App Router favicon
- `src/app/apple-icon.png` - Generated 180x180 Apple touch icon
- `src/app/favicon.ico` - Regenerated as a real PNG-in-ICO container (was Next's default placeholder)
- `src/components/app-sidebar.tsx` - Logo mark added beside the `{BRAND}` wordmark in `SidebarHeader`
- `src/app/login/page.tsx` - Logo mark added above the sign-in heading, `priority`-loaded
- `src/app/signup/page.tsx` - Logo mark added above the create-store heading, `priority`-loaded

## Decisions Made
- No deviations from the plan's decisions — every choice (fit:contain letterboxing, hand-built ICO, alt={BRAND} reuse, no strings.ts change, no next.config.ts change) was pre-specified in the plan's `<constraints_verified_by_the_planner>` and followed exactly.

## Deviations from Plan

None — plan executed exactly as written for Tasks 1 and 2. One environment-only workaround was needed, documented below (not a deviation from the plan's intended behavior, since the underlying checks it replaces are identical).

### Auto-fixed Issues

**1. [Rule 3 - Blocking, environment-only] Adapted Task 1's verify-block temp-script location, not its checks**
- **Found during:** Task 1 verification
- **Issue:** Task 1's `<verify>` block uses `mktemp --suffix=.mjs` (defaults to the OS temp dir on this Windows/Git-Bash environment). A pre-existing, unrelated empty `package.json` at the root of the Windows Temp directory tree (dated Aug 8, long before this session — not created by any part of this task) breaks Node's ESM package-boundary resolution (`ERR_INVALID_PACKAGE_CONFIG`) for any script located under that tree, including the plan's temp verification script.
- **Fix:** Wrote the identical verification script (same assertions, same import of `sharp`, byte-for-byte the same checks specified in the plan) to a location inside this repo instead of the OS temp dir, so Node's module resolution finds `node_modules` locally without walking into the broken directory. Ran it, captured PASS, then deleted the temp file (never committed).
- **Files modified:** None (temp file was created and deleted outside the commit; no repo file affected by this workaround)
- **Verification:** Script printed `PASS: icon.png 64x64, apple-icon.png 180x180, favicon.ico header + PNG signature correct` and exited 0 — the same pass condition the plan's verify block requires.
- **Committed in:** N/A (verification-only workaround, no committed change)

---

**Total deviations:** 1 environment-only workaround (not a plan/behavior deviation)
**Impact on plan:** None. All of Task 1 and Task 2's specified automated checks (file existence, master asset size, generator idempotency/self-checks, icon dimensions/alpha, favicon.ico header + PNG signature bytes, `next.config.ts`/`layout.tsx` untouched, no storefront leakage, import assertions, `alt={BRAND}` assertions, wordmark-span survival, `strings.ts` untouched, color-literal/Tailwind-palette bans) passed exactly as written. `npm run lint`, `npm run typecheck`, and `npm run build` are green after each task. `npx vitest run tests/unit/dashboard-nav.test.ts tests/unit/surface-token-isolation.test.ts` passes 11/11.

## Issues Encountered
- See the Rule 3 workaround above — a pre-existing, unrelated broken file in the Windows Temp directory required relocating (not modifying) the plan's verify-block temp script. No repo code was changed as a result.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Task 3 (checkpoint:human-verify, gate="blocking") is NOT complete.** This plan stops here per its own instructions: Task 3 requires a real browser to confirm the favicon tab icon, the sidebar mark's alignment/spacing against the sidebar background, the login/signup mark sizing, and — critically — that the platform mark does NOT appear on any seeded storefront (`http://megasolution.localhost:3001/` or equivalent).

**How to resume:** A developer (or the orchestrator relaying to one) should follow the exact steps in Task 3's `<how-to-verify>` block in `260903-nxf-PLAN.md`:
1. Start `npm run dev` if not already running on port 3001 (a `npm run test:full` process may already be running concurrently in this working directory — unrelated, do not kill it).
2. Check the browser tab icon on `/login` and load `/favicon.ico` directly.
3. Check the sidebar header on `/dashboard`.
4. Check `/login` and `/signup` heading marks.
5. Confirm the mark is absent from a seeded storefront subdomain.

Report "approved" or describe what looked wrong — a follow-up execution pass can then fix any surface issue found (all three edited files and the generator script are small and easy to adjust) and this SUMMARY should be updated/re-run once Task 3 closes.

No blockers on Tasks 1-2's own correctness — both are fully committed, gate-verified, and ready for the visual check.

---
*Phase: quick/260903-nxf*
*Completed: 2026-09-03 (Tasks 1-2 only; Task 3 pending)*

## Self-Check: PASSED

All 8 files listed in `key-files` (created + modified) verified present on disk. Both task commits (`c89860d`, `3e94aec`) verified present in `git log`.
