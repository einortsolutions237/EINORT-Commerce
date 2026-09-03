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
status: complete

# Metrics
duration: ~12min (Tasks 1-2) + checkpoint verification
completed: 2026-09-03
---

# Phase quick/260903-nxf Plan 01: EINORT Platform Logo Summary

**EINORT platform brand mark (blue-to-purple gradient faceted "S") added as favicon/icon/apple-icon via Next 16's App Router file convention and rendered inline via next/image in the dashboard sidebar, /login, and /signup headers — Task 3's real-browser checkpoint is approved.**

## Performance

- **Duration:** ~12 min (Tasks 1-2) + checkpoint verification pass
- **Completed:** 2026-09-03 (all 3 tasks complete)
- **Tasks:** 3 of 3 complete
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
3. **Task 3: Confirm the mark renders correctly in a real browser** - APPROVED (checkpoint, no code change — verification-only, no commit)

## Task 3: Checkpoint Verification — APPROVED

**Verification method:** This checkpoint was driven by the orchestrator using Claude Code's Browser pane (a real Chromium instance hitting the actual dev server on port 3001) — not a developer directly at the keyboard. This distinction is recorded honestly: the check exercised a genuine browser rendering the genuine app over a live connection (not a headless/automated assertion re-implementing the plan's checks), but the click-through and visual judgment were performed by the orchestrator agent relaying screenshots, not a human set of eyes at first hand. The user reviewed and approved the resulting report before this checkpoint was marked closed.

**Steps performed and results, against the plan's `<how-to-verify>` block:**

1. **Favicon** — `/login` tab shows the blue-to-purple gradient mark (not Next's default icon); `/favicon.ico` loads directly as a real 32x32 image, not a 404. **PASS.**
2. **Sidebar** — signed in as a freshly-created test merchant (`logocheck@example.test` / `logocheck-store`, completed real signup → plan-select → branding), landed on `/dashboard`; the logo mark sits immediately left of "EINORT" in the sidebar header, both vertically centered, no clipping against the sidebar background. (Incidentally also confirmed plan 04-15's "Storefront" nav item is present between Products and Orders, as expected — unrelated to this task.) **PASS.**
3. **Login** — `/login` shows the mark above "Sign in", left-aligned with the card content, sized as a deliberate brand mark. **PASS.**
4. **Signup** — `/signup` shows the mark above "Create your store", same sizing as login. **PASS.**
5. **Storefront isolation** — visited `http://megasolution.localhost:3001/`; the platform logo does NOT appear anywhere, the storefront renders its own merchant branding (wordmark "MEGASOLUTION", no logo image) completely independent of the platform mark. **PASS.**

All five checks pass. No surface showed missing, cropped, stretched, or hard-edged-box rendering. No follow-up fix was required — Tasks 1-2's implementation is confirmed correct as shipped.

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

**All 3 tasks complete, including Task 3 (checkpoint:human-verify, gate="blocking").** The checkpoint was approved 2026-09-03 after the orchestrator drove a real browser through all five `<how-to-verify>` steps (favicon, sidebar, login, signup, storefront isolation) and confirmed each passed — see the "Task 3: Checkpoint Verification — APPROVED" section above. No follow-up fixes were needed.

This quick task is closed. No blockers remain.

---
*Phase: quick/260903-nxf*
*Completed: 2026-09-03 (all 3 tasks, checkpoint approved)*

## Self-Check: PASSED

All 8 files listed in `key-files` (created + modified) verified present on disk. Both task commits (`c89860d`, `3e94aec`) verified present in `git log`. Task 3 required no code commit (verification-only checkpoint); approval is recorded in this SUMMARY per the orchestrator's relayed browser-verification report.
