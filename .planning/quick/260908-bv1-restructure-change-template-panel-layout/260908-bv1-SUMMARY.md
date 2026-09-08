---
phase: quick-260908-bv1
plan: 01
subsystem: ui
tags: [dashboard, storefront-editor, theming, template-picker, strings]

# Dependency graph
requires:
  - phase: quick-05.1
    provides: template-picker.tsx (grid engine, D-05 fallback, T-05-32/T-05-35 guards), template-thumbnail.tsx
provides:
  - template-media.tsx (TemplateMedia) — shared D-05 image/fallback branch
  - current-template-card.tsx (CurrentTemplateCard) — non-interactive spotlight card
  - ChangeTemplatePanel spotlight/grid split (spotlightTile/gridTiles)
  - strings.editor.templateCurrentHeading / templateAvailableHeading
affects: [storefront-editor-change-template-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared media-rendering component (TemplateMedia) extracted so two rendering surfaces (grid card, spotlight card) cannot silently diverge on the D-05 fallback decision."
    - "Non-interactive spotlight card as a structural (not runtime-guarded) mitigation — no click surface exists at all, rather than relying solely on an early-return guard."

key-files:
  created:
    - src/components/theming/template-media.tsx
    - src/components/theming/current-template-card.tsx
  modified:
    - src/components/theming/template-picker.tsx
    - src/lib/strings/index.ts
    - tests/unit/template-picker-contract.test.ts
    - src/app/(dashboard)/dashboard/storefront-editor/change-template-panel.tsx

key-decisions:
  - "current-template-card.tsx header comment avoids literally spelling `RadioGroupItem`/`onClick=`/`onChange=` even in prose, since the plan's grep-based acceptance gate scans the whole file including comments — rephrased to describe the ban without tripping it."
  - "Worktree lacked node_modules, generated Prisma client, .env.local, and Next.js's auto-generated next-env.d.ts/.next/types — all gitignored, none present in a fresh worktree checkout. Restored via `cp .env.local`, `npm install` (from the existing, already-vetted package-lock.json — no new package added), and `npm run build` (which regenerates next-env.d.ts/.next/types). This is environment bootstrap, not a plan deviation; no source files were touched to work around it."

patterns-established:
  - "TemplateMedia takes a required `sizes` prop with no default, forcing every caller to supply its own responsive value rather than risk one caller's breakpoint list silently leaking into another surface."

requirements-completed: [QT-01]

# Metrics
duration: 11min
completed: 2026-09-08
---

# Quick Task 260908-bv1: Restructure Change Template Panel Layout Summary

**Split the editor's "Change template" panel into a non-interactive spotlight card for the merchant's current template (zero click surface, T-05-35 mitigation by construction) above the unchanged, still tier-gated switchable grid, which now excludes only that one current tile.**

## Performance

- **Duration:** ~11 min (implementation + verification; worktree environment bootstrap — npm install, Prisma generate, first `next build` — included)
- **Started:** 2026-09-08T08:55:51Z (plan load)
- **Completed:** 2026-09-08T09:06:28Z
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `template-media.tsx` now owns the D-05 image/wireframe-fallback branch (`previewUrl !== null ? <Image> : <TemplateThumbnail>`), extracted out of `template-picker.tsx` so the grid card and the new spotlight card render that decision from one shared component, not two hand-copied trees.
- `current-template-card.tsx` renders the merchant's current template as a standalone card — ring/border "you have this" treatment reused from the codebase's existing idiom, `TemplateMedia` for the image, name + `Current` badge, segment tag, and (only when `tile.locked`) the retained-above-tier caption. Zero interactive elements: no `RadioGroupItem`, no `onClick`/`onChange`, no form control of any kind — enforced by a grep-based test gate.
- `template-picker.tsx` delegates its image rendering to `<TemplateMedia>`, no longer imports `next/image` or `TemplateThumbnail` directly. Its `onValueChange` inert-current-card guard (`if (currentKey !== undefined && key === currentKey) return;`) is byte-identical to before.
- Two new `strings.editor` keys added: `templateCurrentHeading` ("Your current template") and `templateAvailableHeading` ("Available templates").
- `tests/unit/template-picker-contract.test.ts` extended (not weakened): the D-05 fallback, `priority`-ban (T-05.1-26), and `onError`-ban (T-05.1-27) assertions now scan `template-media.tsx` (where that branch physically lives), plus a new anti-vacuity floor for that file and a new assertion that `template-picker.tsx` still delegates to `<TemplateMedia>`. The T-05-32/T-05-35 guard assertion stays pinned on `template-picker.tsx`, completely untouched.
- `ChangeTemplatePanel` derives `spotlightTile`/`gridTiles` from the RSC's `tiles` array (`Array.find`/`Array.filter` on `currentTemplateKey`) and renders `<CurrentTemplateCard tile={spotlightTile} />` above a heading-labelled `<TemplatePicker tiles={gridTiles} currentKey={currentTemplateKey} .../>`. `currentKey` stays wired as defense-in-depth per RESEARCH.md Focus 1, even though `gridTiles` never contains that key anymore.
- Confirmed via `git diff --quiet` that `page.tsx` (`editorTemplateTiles`) and both onboarding files (`src/app/onboarding/branding/page.tsx`, `branding-form.tsx`) are byte-unchanged (D-B).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract TemplateMedia, build CurrentTemplateCard, add string keys, extend the contract test** - `94c02cf` (feat)
2. **Task 2: Wire the spotlight/grid split into ChangeTemplatePanel and run full verification** - `fb050a6` (feat)

## Files Created/Modified

- `src/components/theming/template-media.tsx` (created) - Shared `TemplateMedia` component owning the D-05 image/fallback branch, `sizes` required with no default.
- `src/components/theming/current-template-card.tsx` (created) - `CurrentTemplateCard`, the zero-interactive spotlight card.
- `src/components/theming/template-picker.tsx` - Deleted direct `next/image`/`TemplateThumbnail` imports, delegates to `<TemplateMedia>`; one added header-comment sentence; `onValueChange` guard untouched.
- `src/lib/strings/index.ts` - Added `templateCurrentHeading` and `templateAvailableHeading` to the `editor` namespace, each with a doc comment.
- `tests/unit/template-picker-contract.test.ts` - Added `MEDIA_FILE`/`mediaRawContent`/`mediaCodeLines`, a `MEDIA_MIN_LINE_COUNT` anti-vacuity test, repointed the D-05/`priority`/`onError` assertions at the media file, added a `TemplateMedia`-delegation assertion on the picker file.
- `src/app/(dashboard)/dashboard/storefront-editor/change-template-panel.tsx` - Added `spotlightTile`/`gridTiles` derivations and the spotlight-card + heading-labelled-grid JSX; one added header-comment section.

## Decisions Made

- `current-template-card.tsx`'s header comment describes the interactivity ban without literally writing `RadioGroupItem`, `onClick=`, or `onChange=` in prose, since the plan's own grep gate (`grep -Ec 'RadioGroupItem|onClick=|onChange=' current-template-card.tsx` must equal 0) scans the whole file, comments included. First draft tripped this gate on its own explanatory prose; rewritten to describe the same rule without the literal substrings.
- Worktree environment bootstrap (see Issues Encountered) — no source-code decision, but recorded since it consumed most of the task's wall-clock time.

## Deviations from Plan

None — plan executed exactly as written for both tasks. The `current-template-card.tsx` comment rewrite above is a Rule 1 (self-caught bug against the plan's own acceptance gate) fix made during Task 1, before the first commit — not a deviation from the plan's intent.

## Issues Encountered

**Worktree environment bootstrap (not a plan deviation, required before any verification gate could run):**
- `node_modules` was present as an empty directory, `src/generated/prisma` (Prisma client), `.env.local`, and Next.js's auto-generated `next-env.d.ts`/`.next/types` were all absent — every one gitignored and therefore not carried into a fresh worktree checkout.
- Copied `.env.local` from the main checkout (`D:\Maxs\Claude\einort-commerce`) so `prisma generate` could resolve `DIRECT_URL`.
- Ran `npm install` (no package arguments — installing exactly what `package-lock.json` already pins, not a new/unvetted dependency) to populate `node_modules`; its `postinstall` hook regenerated the Prisma client.
- Ran `npm run build` once, which is also one of the plan's required verification gates, and which additionally regenerates `next-env.d.ts`/`.next/types` — this cleared a first-pass `npm run typecheck` failure (`Cannot find name 'LayoutProps'/'PageProps'`) that was present before the build ran and had nothing to do with this task's files.
- No source files were touched to work around any of this.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The editor's "Change template" panel now matches the Shopify "Online Store" layout the user referenced: current template spotlighted, non-interactive, above a switchable grid that never repeats it.
- Onboarding's own template picker (`src/app/onboarding/branding/`) is untouched — it still renders the full grid with the current-in-grid affordance `template-picker.tsx` already provides, unaffected by this restructuring.
- `TemplateMedia` is now available for any future surface that needs the same D-05 image/fallback contract without re-deriving it.

## Verification Summary

All commands specified in the plan's `<verification>` block were run and passed:

- `npm run test:unit` — 651/651 tests passed (39 files).
- `npm run lint` — clean (`eslint . --max-warnings=0`).
- `npm run typecheck` — clean (`tsc --noEmit`).
- `npm run build` — succeeded, all 23 routes generated.
- `npx vitest run tests/unit/surface-token-isolation.test.ts tests/unit/theming-marker-boundary.test.ts tests/unit/dashboard-nav.test.ts tests/unit/template-picker-contract.test.ts` — 30/30 tests passed.
- `git diff --quiet -- src/app/onboarding/branding/page.tsx src/app/onboarding/branding/branding-form.tsx` — exit 0 (D-B, onboarding untouched).
- `git diff --quiet -- "src/app/(dashboard)/dashboard/storefront-editor/page.tsx"` — exit 0 (`editorTemplateTiles` byte-unchanged).
- Task 1's grep-based gates: `TemplateMedia` present and `next/image` import absent in `template-picker.tsx`; inert-guard string byte-identical; zero `RadioGroupItem`/`onClick=`/`onChange=` matches in `current-template-card.tsx`; both new string keys present.
- Task 2's grep-based gate: `gridTiles`, `spotlightTile`, and `CurrentTemplateCard` all present in `change-template-panel.tsx`.

## Self-Check: PASSED

- FOUND: src/components/theming/template-media.tsx
- FOUND: src/components/theming/current-template-card.tsx
- FOUND: src/components/theming/template-picker.tsx (modified, verified via gates)
- FOUND: src/lib/strings/index.ts (modified, verified via gates)
- FOUND: tests/unit/template-picker-contract.test.ts (modified, verified via gates)
- FOUND: src/app/(dashboard)/dashboard/storefront-editor/change-template-panel.tsx (modified, verified via gates)
- FOUND: commit 94c02cf in `git log --oneline`
- FOUND: commit fb050a6 in `git log --oneline`

---
*Phase: quick-260908-bv1*
*Completed: 2026-09-08*
