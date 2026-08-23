---
phase: quick/260823-gu4
plan: 01
subsystem: ui
tags: [tailwind, oklch, next-font, design-tokens, css-variables]

requires:
  - phase: 01-multi-tenant-foundations-domain-resolution
    provides: src/app/globals.css's original zinc oklch token set and shadcn scaffolding
  - phase: 02-merchant-auth-entitlements-trial
    provides: the 11 heading-role pages/components this plan retypes (signup, login, onboarding/plan, dashboard, dashboard/plan, suspended, not-found, root)
provides:
  - Blue/gold/slate oklch token set in src/app/globals.css (:root and .dark), replacing the zinc palette mistakenly inherited from the flagship storefront reference
  - --gold-accent / --gold-accent-foreground as a dedicated brand-accent token pair, distinct from shadcn's neutral --accent hover slot
  - --radius corrected from 0.625rem to 0.75rem
  - Outfit loaded via next/font/google as --font-heading, applied to exactly the 11 heading-role elements across auth/onboarding/dashboard/root/not-found pages
  - .planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md registering the canonical merchant-platform design source for Phases 3-6
affects: [03-product-catalog, 04-theme-section-block-system, 05-template-segment-expansion, 06-merchant-dashboard-platform-admin]

tech-stack:
  added: []
  patterns:
    - "Design-token retrofit: rewrite :root/.dark oklch values only, never introduce hex into an oklch-only globals.css"
    - "font-heading applied additively (prepended to existing className) to heading-role elements only — body/labels/buttons stay on --font-sans"

key-files:
  created:
    - .planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/app/not-found.tsx
    - src/app/login/page.tsx
    - src/app/signup/page.tsx
    - src/app/suspended/page.tsx
    - src/app/onboarding/plan/page.tsx
    - src/app/onboarding/plan/plan-picker.tsx
    - src/app/onboarding/create-store/page.tsx
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/(dashboard)/dashboard/plan/page.tsx
    - src/app/(dashboard)/dashboard/plan/plan-switch-form.tsx

key-decisions:
  - "Scope locked to tokens + typography only, per explicit user decision — no page-structure change (kept separate /login and /signup routes, kept centered-card layouts; did NOT adopt the reference's split-screen auth page or sidebar+header dashboard shell, the latter deferred to Phase 3+ once real dashboard content justifies a sidebar)"
  - "Gold introduced as a new --gold-accent pair rather than repointing shadcn's --accent, which is a neutral hover-state token consumed only through bg-accent/text-accent-foreground utilities — repointing it would have gold-tinted every ghost-button hover in the app"
  - "--card kept white against a slate-50 --background, diverging from the reference's identical background/card values, because every Phase 1-2 surface is a centered card on an otherwise-empty page where identical values would collapse the card into the page"

patterns-established:
  - "Two distinct, non-conflatable design references now exist for two distinct surfaces: zinc/DTC editorial for the storefront (src/app/s/[slug]/**), blue/gold/slate for the merchant platform (everything else) — see the new design-reference doc for the do-not-conflate note"

requirements-completed: [QUICK-UI-RETROFIT]

duration: 24min
completed: 2026-08-23
---

# Quick Task 260823-gu4: Merchant-Platform UI Token Retrofit Summary

**Retokenized `globals.css` to the user's actual blue/gold/slate merchant-platform design and wired Outfit as the heading face, correcting a Phase 1 palette mix-up that had applied the storefront's zinc/DTC reference app-wide.**

## Performance

- **Duration:** 24 min (across Tasks 1-4; Task 5 held for the human-verify checkpoint before this summary was written)
- **Completed:** 2026-08-23
- **Tasks:** 5 (4 auto + 1 blocking human-verify)
- **Files modified:** 14 (1 created, 13 modified)

## Accomplishments

- Corrected a real design-fidelity gap: Phase 1's `01-UI-SPEC.md` sourced `globals.css`'s entire palette from the flagship storefront's zinc/DTC visual reference, which was never meant to govern the merchant dashboard/auth surfaces. The user caught this by testing the live app against their own actual merchant-platform design.
- Registered that actual design (`github.com/njeirheinard21-ai/Einort-Commerce-Front-End`, a Google-AI-Studio-generated visual/token reference — not code to port) as the canonical source for this retrofit and for all future Phase 3-6 UI-SPEC work on dashboard sections and the platform admin surface.
- Re-tokenized `globals.css` end to end (`:root` and `.dark`) to blue-600 primary actions, a gold brand-accent token, and a full slate surface scale with real dark-mode inversion — zero hex literals, zero zinc hues left outside historical comments.
- Loaded Outfit as a genuine second typeface (`--font-heading`) and applied it to exactly the 11 heading-role elements across every page this project has built so far, leaving body copy, labels, buttons, and price numerals on Plus Jakarta Sans.
- Zero regressions: 250/250 tests unchanged, lint/typecheck/build all green, and the storefront route (`src/app/s/[slug]/**`) and `card.tsx` were deliberately left untouched.

## Task Commits

1. **Task 1: Register merchant-platform design reference** - `0ed41c7` (docs)
2. **Task 2: Retrofit globals.css to blue/gold/slate** - `c887717` (feat)
3. **Task 3: Load Outfit + apply font-heading** - `b749036` (feat)
4. **Task 4: Full regression gate** - *(no commit — verification only, zero files modified)*
5. **Task 5: Human-verify checkpoint** - approved by the project owner after visual inspection at `http://localhost:3001` (signup, login, onboarding/plan, dashboard); no defects reported

**Plan metadata:** this commit (docs: complete quick task)

## Files Created/Modified

- `.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md` - Canonical merchant-platform design source registration (token values, file inventory, do-not-conflate cross-reference against the flagship storefront reference)
- `src/app/globals.css` - Full `:root`/`.dark` oklch retokenization (blue/gold/slate), `--radius: 0.75rem`, new `--gold-accent`/`--gold-accent-foreground` pair exposed via `@theme inline`, `--font-heading` re-export flipped from aliasing `--font-sans`
- `src/app/layout.tsx` - Outfit loaded via `next/font/google` as `--font-heading`, applied on `<html>` alongside the existing Plus Jakarta Sans variable
- 11 page/component files - `font-heading` prepended to the existing `className` of each heading-role element (h1/h2), additive-only edits

## Decisions Made

See `key-decisions` in frontmatter. In addition:

- **Verify-script arithmetic corrected during execution, not the underlying work.** Task 3's automated verify asserted `grep -rl 'font-heading' src/app | wc -l` equals 12, but the plan's own sibling assertion in the same line requires `layout.tsx` to also match (it contains `--font-heading`). The correct count against the plan's own file list is 13 (11 heading files + `globals.css` + `layout.tsx`). The substantive contract — `font-heading` applied to precisely the enumerated heading elements and nowhere else — was verified directly against the plan's inventory table rather than trusting the miscounted grep gate. This is a plan-arithmetic defect, not an implementation shortfall; no code changed as a result, only which check was trusted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan Defect] Task 3 verify command asserted an arithmetically impossible file count**
- **Found during:** Task 3 (Outfit loading + font-heading application)
- **Issue:** The plan's automated verify required exactly 12 files under `src/app` to match `font-heading`, but its own preceding clause in the same command requires `layout.tsx` (which lives under `src/app`) to also contain `--font-heading`. 11 heading-element files + `globals.css` + `layout.tsx` = 13, not 12.
- **Fix:** Verified the substantive contract directly — confirmed all 11 heading elements from the plan's inventory table carry `font-heading` and nothing else does (storefront route and `card.tsx` excluded as instructed) — rather than gating on the miscounted literal `-eq 12`.
- **Files modified:** None (verification-only correction).
- **Verification:** Manual re-check of the file list against the plan's own 11-row heading inventory table; `git diff --stat` confirms exactly the 14 planned paths touched, no more, no less.
- **Committed in:** `b749036` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 plan defect)
**Impact on plan:** No scope change, no extra files touched, no missed heading. Purely a verification-gate correction.

## Issues Encountered

None beyond the verify-arithmetic note above.

## User Setup Required

None - no external service configuration required. Outfit is self-hosted at build time by `next/font/google`, same trust posture as the already-shipped Plus Jakarta Sans font.

## Next Phase Readiness

- Phase 2 (`02-07`, the phase gate) is unaffected by this quick task — it was a pure presentation retrofit with zero behavioral change, confirmed by the unchanged 250/250 test count.
- Phases 3-6 must read `.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md` before any `ui-phase`/`discuss-phase` work touching dashboard sections or the platform admin surface.
- **Open tension flagged for Phase 4-5 planning, not resolved here:** the merchant-platform reference repo also ships its own storefront pages (`src/pages/storefront/`), meaning the storefront surface now has two candidate design sources (this repo vs. the earlier zinc/DTC flagship reference). Must be resolved deliberately, not by whichever gets read last.
- The reference's sidebar+header `AppShell` dashboard shell and split-screen auth page were deliberately NOT adopted in this retrofit (tokens+typography only) — Phase 3+ should revisit the dashboard shell once there is real multi-section content (products, orders, etc.) to justify a sidebar.

---
*Phase: quick/260823-gu4*
*Completed: 2026-08-23*
