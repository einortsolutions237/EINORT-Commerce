---
phase: 05-template-segment-expansion
plan: 07
subsystem: ui
tags: [react, server-components, storefront, section-variants, tailwind]

# Dependency graph
requires:
  - phase: 04-theme-section-block-system-flagship-template
    provides: ProductGridSection/EditorialSplitSection's Phase-4 rendering, StorefrontRenderData, SectionInstance/SectionVariant schema types
  - phase: 05-01
    provides: SECTION_VARIANTS["product-grid"] = ["grid","dense","showcase"] and SECTION_VARIANTS["editorial-split"] = ["split","banner"] in src/server/theming/schema.ts
provides:
  - ProductGridSection as an exhaustive three-arm switch (grid/dense/showcase, no default arm)
  - ProductGridDense — one column step tighter at every breakpoint, gap-2 held throughout, square tiles, inline single-line name+price, stagger capped at 9
  - ProductGridShowcase — one column step wider (gap-8/md:gap-12), site-wide 4/5 tile aspect, price below a small rule instead of beside the name, stagger capped at 3
  - EditorialSplitSection as an exhaustive two-arm switch (split/banner, no default arm)
  - EditorialSplitBanner — full-width ink band with no grid and no image slot at all (ever, regardless of imageKey), reusing split's Display step and its non-accent bg-background CTA
affects: [05-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Section-type variant dispatch: <Type>Section({ variant }) is an exhaustive switch with NO default arm over SectionVariant<T>, so a new SECTION_VARIANTS entry is a compile error here rather than a silently-blank render — same drift discipline as section-renderer.tsx one level up"
    - "The pre-existing variant-1 body is renamed in place (ProductGridGrid, EditorialSplitSplit) and moved verbatim under the new dispatcher's first arm; new variants are new sibling files, never edits to the moved body"
    - "variant has a literal default matching SECTION_VARIANTS[T][0] purely so the file keeps compiling against section-renderer.tsx's current, not-yet-variant-aware call site (05-10 threads the real value through)"

key-files:
  created:
    - src/app/s/[slug]/sections/product-grid-dense.tsx
    - src/app/s/[slug]/sections/product-grid-showcase.tsx
    - src/app/s/[slug]/sections/editorial-split-banner.tsx
  modified:
    - src/app/s/[slug]/sections/product-grid-section.tsx
    - src/app/s/[slug]/sections/editorial-split-section.tsx

key-decisions:
  - "EditorialSplitBanner's data prop is destructured as `data: _data` (declared, unused, underscore-prefixed) rather than omitted from the signature, so EditorialSplitSection's dispatcher can call every arm with an identical { settings, data } call shape"
  - "Wrote the file-header prose around the ignored image field without ever spelling its literal identifier outside a comment line, satisfying the plan's own grep-based acceptance check literally rather than only in spirit"

patterns-established:
  - "Pattern: a variant component's own file header states plainly which upstream contract (grid's or the *-UI-SPEC's) each class string is quoted from, so a reviewer never has to reverse-engineer where a number came from"

requirements-completed: [TMPL-03]

# Metrics
duration: ~35min (this resumed session; excludes the prior interrupted session's work on the same file)
completed: 2026-09-05
---

# Phase 5 Plan 7: Product-Grid Dense/Showcase and Editorial-Split Banner Variants Summary

**Split `product-grid-section.tsx` and `editorial-split-section.tsx` into exhaustive, no-default variant dispatchers and added the three remaining rendering variants (`product-grid:dense`, `product-grid:showcase`, `editorial-split:banner`), completing the full twelve-component variant set D-02 requires.**

## Performance

- **Duration:** ~35 min (this resumed session; a prior agent had already renamed `ProductGridGrid` and stubbed the imports before hitting a session rate limit)
- **Started:** 2026-09-05T23:xx:xxZ (resumed session, environment already restored)
- **Completed:** 2026-09-05T23:42:33Z
- **Tasks:** 3/3 completed
- **Files modified:** 5 (2 modified dispatchers, 3 new variant components)

## Accomplishments
- `ProductGridSection` is now a genuine exhaustive three-arm switch (`grid`/`dense`/`showcase`, no `default`) over `SectionVariant<"product-grid">`, with the Phase-4 body moved verbatim into `ProductGridGrid`
- `ProductGridDense` ships the full 05-UI-SPEC contract: `grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`, `aspect-square` tiles, inline single-line name+price, stagger capped at 9
- `ProductGridShowcase` ships the full contract: `grid-cols-1 gap-8 sm:grid-cols-2 md:gap-12`, unchanged `aspect-[4/5]` tiles, a `h-px w-8 bg-border` rule between name and price, stagger capped at 3
- `EditorialSplitSection` is now an exhaustive two-arm switch (`split`/`banner`, no `default`), with the Phase-4 body moved verbatim into `EditorialSplitSplit`
- `EditorialSplitBanner` ships the full contract: centred `max-w-3xl` ink band, no grid, no image column at all regardless of `imageKey`, reuses `split`'s 32→40px Display step, non-accent `bg-background text-foreground` CTA
- Confirmed (then reverted) that removing the `showcase` arm and the `banner` arm each independently produce a `tsc` compile error, proving the exhaustive-switch, no-default-arm contract actually holds

## Task Commits

1. **Task 1: Split product-grid into a three-arm switch and build the dense variant** - `b91999d` (feat)
2. **Task 2: Build the showcase grid variant** - `d7f9ffb` (feat)
3. **Task 3: Split editorial-split into a two-arm switch and build the banner variant** - `1e2fb9a` (feat)

_No plan-metadata commit for STATE.md/ROADMAP.md — per this run's explicit instructions, those files are the orchestrator's responsibility and were not touched._

## Files Created/Modified
- `src/app/s/[slug]/sections/product-grid-section.tsx` - `ProductGridGrid` (renamed, verbatim body) + new `ProductGridSection` three-arm dispatcher
- `src/app/s/[slug]/sections/product-grid-dense.tsx` - New. `ProductGridDense`, the tighter/denser grid variant
- `src/app/s/[slug]/sections/product-grid-showcase.tsx` - New. `ProductGridShowcase`, the wider/generous-gap grid variant
- `src/app/s/[slug]/sections/editorial-split-section.tsx` - `EditorialSplitSplit` (renamed, verbatim body) + new `EditorialSplitSection` two-arm dispatcher
- `src/app/s/[slug]/sections/editorial-split-banner.tsx` - New. `EditorialSplitBanner`, the no-image-slot ink band variant

## Decisions Made
- `EditorialSplitBanner`'s unused `data` prop is destructured `data: _data` rather than dropped from the type, keeping every arm's call signature (`{ settings, data }`) identical at the dispatcher call site
- The file-header prose explaining why `banner` ignores the image field intentionally never spells the field's literal identifier outside a `*`-prefixed comment line, so the plan's own comment-excluding grep check (`grep -v '^\s*\*\|^\s*//' … | grep -c 'imageKey'` = 0) passes literally, not just in spirit

## Deviations from Plan

None — plan executed exactly as written. Two self-inflicted near-misses were caught and fixed before commit, not deviations from the plan itself:
- Initial doc-comment prose in `product-grid-dense.tsx` incidentally contained the literal strings `aspect-square` and `aspect-[4/5]` inside a code-quoted sentence, which collided with the plan's own `grep -c` acceptance checks (expecting exactly 1 and exactly 0 respectively). Reworded the comment to describe the change without quoting both literal class names; no code changed.
- Initial doc-comment prose in `editorial-split-banner.tsx` similarly quoted `next/image` and the full `max-w-3xl …` class string, colliding with `grep -c 'next/image'` (expect 0) and `grep -c 'max-w-3xl'` (expect 1). Reworded both comments to describe the same facts without repeating the exact literal strings the JSX itself already contains.

## Issues Encountered

None. Typecheck, lint, and the full `npm run test:unit` suite (571/571) were clean on the first run after each task's fixes above. The orchestrator's note about a possible cross-wave `section-renderer.tsx` typecheck error did not materialize — `section-renderer.tsx` still calls `ProductGridSection`/`EditorialSplitSection` without a `variant` prop, which resolves cleanly against each dispatcher's own default (`"grid"` / `"split"`), so no sibling Wave-2 plan's absence caused a failure at this stage.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The full twelve-component variant set now exists: hero ×3 (from a sibling Wave 2 plan), trust-bar ×2 (sibling), product-grid ×3 (this plan), editorial-split ×2 (this plan), contact ×2 (sibling) — assuming the sibling Wave 2 plans land as expected
- `product-grid:dense`/`:showcase` and `editorial-split:banner` are ready for plan 05-10 (Wave 3) to wire real per-template `variants[...]` values through `section-renderer.tsx`, replacing the temporary `"grid"`/`"split"` defaults this plan's dispatchers fall back to
- No blockers for Wave 3

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-05*

## Self-Check: PASSED

- All 5 created/modified source files confirmed present on disk, plus this SUMMARY.md.
- All 3 task commit hashes (`b91999d`, `d7f9ffb`, `1e2fb9a`) confirmed present in `git log`.
