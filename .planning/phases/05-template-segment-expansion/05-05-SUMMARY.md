---
phase: 05-template-segment-expansion
plan: 05
subsystem: ui
tags: [react, nextjs, tailwind, storefront, section-variants, typescript]

# Dependency graph
requires:
  - phase: 05-template-segment-expansion
    provides: "05-01's SECTION_VARIANTS.hero / SectionVariant<T> schema types"
provides:
  - "HeroSection three-arm exhaustive variant switch (full-bleed / split / stack)"
  - "HeroSplit component (two-column, initials-monogram no-image mode)"
  - "HeroStack component (type-led, no image slot at all)"
affects: [05-10 (section-renderer.tsx variant threading), 05-templates-and-copy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exhaustive switch with `: ReactElement` return annotation and no `default` arm as the variant-dispatch mechanism (not a Record lookup)"
    - "No-image mode designed as the primary/first-class state, not a fallback, per 05-RESEARCH.md Pitfall 4"

key-files:
  created:
    - src/app/s/[slug]/sections/hero-split.tsx
    - src/app/s/[slug]/sections/hero-stack.tsx
  modified:
    - src/app/s/[slug]/sections/hero-section.tsx

key-decisions:
  - "HeroFullBleed body moved verbatim out of the old exported HeroSection, byte-identical Tailwind classes preserved, so flagship-fashion's rendered hero is unchanged from Phase 4"
  - "hero-stack.tsx never reads settings.backgroundImageKey, even when non-null on the underlying settings object — structurally immune to the no-image trap rather than defensively coded around it"

patterns-established:
  - "Each hero variant file duplicates its own CASCADE motion constant and HERO_HEADING_ID rather than importing a shared one, keeping every section component a self-contained marker-free leaf"

requirements-completed: [TMPL-03]

# Metrics
duration: ~35min (this resumed leg; original session interrupted by rate limit before verification)
completed: 2026-09-06
---

# Phase 5 Plan 05: Hero Variant Family (full-bleed / split / stack) Summary

**Three-variant hero family behind one exhaustive switch — `HeroFullBleed` (Phase 4 design, moved verbatim), `HeroSplit` (two-column with initials-monogram no-image mode), and `HeroStack` (type-led, structurally no image slot) — all dispatched from `SectionVariant<"hero">` with no `default` arm, so a fourth variant is a compile error.**

## Performance

- **Duration:** ~35 min (this resumed leg — a prior executor agent completed the implementation but was interrupted by a session rate limit before running verification/commit; this leg verified, confirmed, and committed the already-written work)
- **Completed:** 2026-09-06T00:36Z (approx, UTC)
- **Tasks:** 3/3 completed
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- `HeroSection` now dispatches on `variant: SectionVariant<"hero">` through a three-arm exhaustive `switch` (`: ReactElement`, no `default`), confirmed by deliberately deleting the `"stack"` arm and observing a real compile error (`TS2366: Function lacks ending return statement`), then reverting.
- `HeroFullBleed` is the Phase 4 hero moved verbatim — `git diff` against the prior commit shows only additive changes (new imports, new switch function, new header paragraph); no line inside `HeroFullBleed`'s body was touched.
- `HeroSplit` renders a two-column hero with the `<h1>` first in DOM order (`md:order-1`) and a no-image mode that renders the store's initials as an oversized, low-opacity, `aria-hidden` typographic mark instead of an empty band.
- `HeroStack` has no `next/image` import and never reads `settings.backgroundImageKey` even when set — it cannot fail Pitfall 4's no-image trap because it has no image-rendering code path at all.
- Accent (`bg-brand-accent`) appears exactly once per variant file, spent only on the CTA fill.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract HeroFullBleed and add the variant switch** - `179892a` (feat)
2. **Task 2: Build the split hero** - `ad7d3b0` (feat)
3. **Task 3: Build the stack hero** - `9d06210` (feat)

_No separate plan-metadata commit was made in this leg per the orchestrator's instructions (STATE.md/ROADMAP.md updates were explicitly out of scope for this resumed session)._

## Files Created/Modified

- `src/app/s/[slug]/sections/hero-section.tsx` - `HeroFullBleed` (Phase 4 design, verbatim) plus the new exported `HeroSection` three-arm exhaustive variant switch
- `src/app/s/[slug]/sections/hero-split.tsx` - `HeroSplit`: two-column hero, text column always first in DOM/visual order, image column with initials-monogram no-image mode
- `src/app/s/[slug]/sections/hero-stack.tsx` - `HeroStack`: type-led hero, no image slot, plain `--border` divider as its one decorative identity element

## Decisions Made

- Confirmed (rather than assumed) the exhaustiveness mechanism actually gates the build: deleted the `"stack"` case, re-ran `npm run typecheck`, observed `TS2366`, then reverted and re-verified the file was byte-identical to its pre-test state via `diff`.
- Treated several grep-based acceptance-criteria literal-match discrepancies as expected false positives from prose/documentation matching the searched substring, not real code defects (see "Deviations" below) — verified this conclusion against `git diff` (for `hero-section.tsx`) and against the substantive test suite (`theming-marker-boundary.test.ts`, which passed) rather than relying on the grep count alone.

## Deviations from Plan

None functionally — the implementation done by the prior (interrupted) executor agent matched the plan's task specs closely. This leg's only work was verification, the exhaustiveness confirm/revert, and committing. Documenting two non-functional discrepancies discovered during verification, both traced to documentation prose rather than actual code:

**1. [Not a defect — grep-literal false positive] Some acceptance-criteria grep counts differ from the plan's literal expected numbers because the searched substring also appears inside descriptive header comments**
- **Found during:** verification of Tasks 1-3
- **Detail:**
  - `hero-section.tsx`: `grep -c '"use client"\|server-only'` returns 2, not 0 — both matches are in the file's own pre-existing (Phase 4, unchanged by this plan — confirmed via `git diff`) header prose ("NO `\"use client\"`...", "...a `server-only` dependency"), which *describes* the absence of these markers rather than containing them. No real `"use client"` directive or `server-only` import exists in the file (confirmed via `theming-marker-boundary.test.ts`, which passed).
  - `hero-split.tsx`: same pattern, 2 matches, both in its own analogous header prose.
  - `hero-stack.tsx`: `grep -c 'max-w-4xl'` returns 2 (one real usage at line 80, one mention inside a comment at line 107 quoting the spec); `grep -c '<h1'` (informal check) returns 2 for the same reason (one real `<h1>` element, one mention inside a doc comment about `HERO_HEADING_ID`). The actual rendered code has exactly one `<h1>` and exactly one `max-w-4xl` class, matching the plan's substantive intent.
- **Why not fixed:** The codebase's documented convention (CLAUDE.md "Comments" section) is exactly this style — comments justify design decisions and explicitly name the patterns they rule out, which is why they contain these substrings. Editing the prose to dodge a literal grep would work against that convention for no functional gain; the actual enforcement mechanism (`theming-marker-boundary.test.ts`, exhaustiveness typecheck) is what was verified to pass.
- **Files affected:** `hero-section.tsx`, `hero-split.tsx`, `hero-stack.tsx` (no changes made)
- **Verification:** `npx vitest run tests/unit/theming-marker-boundary.test.ts tests/unit/surface-token-isolation.test.ts` — 11/11 pass; manual re-read of the flagged lines confirms no real `"use client"` directive, `server-only` import, or extra `<h1>`/`max-w-4xl` in actual markup.

---

**Total deviations:** 0 functional. 1 documentation note (grep-literal false positives, no code change).
**Impact on plan:** None on scope or correctness — all acceptance criteria are met in substance.

## Issues Encountered

- **Expected cross-wave typecheck error:** `npm run typecheck` reports `src/app/s/[slug]/sections/section-renderer.tsx(96,15): error TS2741: Property 'variant' is missing...`. `section-renderer.tsx` is owned by plan `05-10` (a separate Wave 2 plan not yet merged into this worktree), whose job is to thread the new `variant` prop through the renderer's five-arm switch. This plan's `files_modified` list does not include `section-renderer.tsx`, and its read-only reference to that file (lines 15-54, 82-85) only concerns the exhaustiveness *mechanism* it inherits, not an obligation to update it. This error is expected to disappear once 05-10 merges and is out of this plan's scope to fix.
- **Pre-existing, unrelated typecheck error:** `src/components/app-sidebar.tsx(175,43): error TS2345` (a `string | null` not assignable to `string`). Confirmed via `git log`/`git diff` that this file has zero changes in this branch and was last touched by an unrelated commit (`feat(260903-nxf): render the platform logo...`). Out of scope per the deviation rules' scope boundary; not modified.
- **`npm run lint` exits 0** with zero warnings across the whole repo (the `--max-warnings=0` gate), so neither of the above typecheck issues is a lint regression from this plan's work.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three hero variant components exist, are marker-free, and pass `theming-marker-boundary.test.ts` and `surface-token-isolation.test.ts`.
- `section-renderer.tsx` (plan 05-10, a sibling Wave 2 plan) still needs to thread a `variant` prop through to `HeroSection` before the storefront can render any variant besides its current hard-coded call — this is a known, expected, cross-wave dependency, not a regression introduced here.
- No blockers for merging this plan's three files once the wave's other plans (05-06, 05-10, etc.) land.

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-06*

## Self-Check: PASSED

- FOUND: `src/app/s/[slug]/sections/hero-section.tsx`
- FOUND: `src/app/s/[slug]/sections/hero-split.tsx`
- FOUND: `src/app/s/[slug]/sections/hero-stack.tsx`
- FOUND commit `179892a` (Task 1)
- FOUND commit `ad7d3b0` (Task 2)
- FOUND commit `9d06210` (Task 3)
