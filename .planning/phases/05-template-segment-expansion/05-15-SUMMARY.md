---
phase: 05-template-segment-expansion
plan: 15
subsystem: ui
tags: [theming, template-library, copy, zod, grocery-food, i18n-ready-strings]

# Dependency graph
requires:
  - phase: 05-03
    provides: "strings.templates namespace shape (Partial<Record<TemplateKey, Partial<FlagshipCopy>>>) and the six empty per-segment copy modules"
  - phase: 05-08
    provides: "grocery-food's 8 registry rows (TEMPLATES), the segment's 4 shared skeletons, and the contract-complete-content-minimal builder module with all ?? \"\" fallbacks wired"
provides:
  - "Complete, distinct, Douala-appropriate copy for all 8 grocery-food templates (src/lib/strings/templates/grocery-food.ts)"
  - "Complete document/token builders for all 8 grocery-food templates, each with a schema-valid fresh-per-call default document and a distinct accent pair per skeleton sibling (src/server/theming/templates/grocery-food.ts)"
  - "A fix to FlagshipCopy (src/lib/strings/flagship.ts) that deep-widens as-const literal leaf types to string, which every future Wave 3 segment plan (05-11 through 05-14, 05-16, 05-17) also needs to typecheck real (non-flagship-verbatim) copy"
affects: [05-11, 05-12, 05-13, 05-14, 05-16, 05-17, 05-20]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deep-widening mapped type (Widen<T>) to relax `as const` literal leaf types to `string` while keeping a type structurally derived (never hand-duplicated) from a const object"
    - "Sibling accent pairing keyed by shared skeleton (section-type sequence), not by template key — the collision rule TMPL-05 cares about is skeleton-scoped"

key-files:
  created: []
  modified:
    - src/lib/strings/templates/grocery-food.ts
    - src/server/theming/templates/grocery-food.ts
    - src/lib/strings/flagship.ts
    - .planning/phases/05-template-segment-expansion/deferred-items.md

key-decisions:
  - "grocery-market (the segment's single Starter row) authored first and given the broadest, strongest general-provisions copy, per the plan's explicit weighting"
  - "Fixed FlagshipCopy's type (Rule 3, blocking) rather than working around it per-file: typeof flagshipCopy verbatim carries as-const literal types at every leaf, and Partial<FlagshipCopy> only optionalizes one level, so any authored template whose wording differs from flagship's own text failed to typecheck. A deep Widen<T> mapped type keeps the shape check (still derived from typeof flagshipCopy) while relaxing leaf literals to string."
  - "Bumped itemCount to 12 on the 4 dense-variant product grids (market, harvest, orchard, grove) since a grocery/food catalogue reads sparse at the fashion-tuned default of 8; left the grid/showcase variants (pantry/fresh, cellar/larder) at DEFAULT_ITEM_COUNT"
  - "Accent palette chosen by sub-niche identity (terracotta for general provisions, produce green, grain-sack brown, butchery red, citrus orange, juice lime, cold-drinks teal, bakery gold) so no two skeleton siblings share a primaryAccent"

patterns-established:
  - "When a segment's copy module needs real strings.templates[key][...] values wired all the way through to a builder, cross-check both files by asserting equality against the strings module directly (not just re-reading source), which is what catches an accidental inline-prose regression or an accidental ?? \"\" fallback still firing"

requirements-completed: [TMPL-03, TMPL-04]

# Metrics
duration: ~25min (this resumed session; prior session's Task 1 authoring work is included in the diff but its wall-clock time was not tracked across the rate-limit interruption)
completed: 2026-09-06
---

# Phase 5 Plan 15: Grocery-Food Segment Authoring Summary

**8 grocery-food templates (grocery-market, -harvest, -pantry, -fresh, -orchard, -grove, -cellar, -larder) with real Douala-appropriate copy, schema-valid fresh-per-call default documents, and distinct accent pairs per skeleton — plus a FlagshipCopy type fix needed for any segment's real copy to typecheck.**

## Performance

- **Duration:** ~25 min this session (resumed from a rate-limit interruption; Task 1's copy content was already substantially written when this session began and was verified rather than re-authored)
- **Completed:** 2026-09-06T04:38:34Z
- **Tasks:** 2/2 completed
- **Files modified:** 4 (2 plan-scoped, 1 blocking-issue fix, 1 deviation log)

## Accomplishments
- All 8 grocery-food templates have complete, distinct hero/trust-bar/product-grid/editorial-split/contact copy groups matching their registry row's declared sections exactly, with `grocery-market` (the segment's only Starter row) authored as the strongest.
- All 8 grocery-food document/token builders produce schema-valid, fresh-per-call default documents with correct section order, `id === type`, no image keys, and a distinct `primaryAccent` for every pair of templates sharing a skeleton.
- Fixed a type-design bug in `FlagshipCopy` that would have blocked every future Wave 3 segment plan from typechecking real (non-flagship-verbatim) copy.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the grocery-food copy namespace** - `2d9d7a8` (feat)
2. **Task 2: Author the grocery-food document and token builders** - `a2431a2` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/lib/strings/templates/grocery-food.ts` - Real copy for all 8 grocery-food templates (name, segmentTag, announcement, footerTagline, and per-section copy groups matching each template's registry row)
- `src/server/theming/templates/grocery-food.ts` - 8 document builders (schema-valid, fresh-per-call, image-free) and 8 token builders (distinct accent pairs per skeleton, deviation-documented `itemCount` bumps on the 4 `dense` product grids)
- `src/lib/strings/flagship.ts` - Added a `Widen<T>` deep-widening mapped type so `FlagshipCopy` keeps its `typeof flagshipCopy`-derived shape while relaxing `as const` literal leaves to `string`
- `.planning/phases/05-template-segment-expansion/deferred-items.md` - Logged two pre-existing, unrelated `npm run typecheck` failures encountered while verifying this plan

## Decisions Made
- See `key-decisions` in frontmatter above (Starter-row weighting, the `FlagshipCopy` type fix, the `itemCount` bump rationale, and the accent-palette choices).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed `FlagshipCopy`'s type so real per-template copy can typecheck**
- **Found during:** Task 1 (Author the grocery-food copy namespace) — running the task's own `npm run typecheck` verification gate
- **Issue:** `export type FlagshipCopy = typeof flagshipCopy` (in `src/lib/strings/flagship.ts`) inherited `as const` literal types at every leaf (`hero.eyebrow: "Welcome"`, `trustBar.itemOne.heading: "Delivery in Douala"`, etc.). `Partial<FlagshipCopy>` — the type every per-segment copy module (`src/lib/strings/templates/*.ts`) is declared against — only optionalizes ONE level; it does not reach into `hero`/`trustBar`/`productGrid`/`editorialSplit`/`contact` to widen or optionalize their fields. Concretely, this meant any authored template whose wording differed from the flagship's own exact text failed to compile with `TS2322: Type "..." is not assignable to type "..."` — the opposite of TMPL-04's requirement that all 50 templates carry genuinely distinct copy. This is not specific to grocery-food; it would have blocked every one of the five other Wave 3 segment plans (05-11 through 05-14, 05-16, 05-17) the first time any of them typed real copy.
- **Fix:** Added a `Widen<T>` deep-widening mapped type in `src/lib/strings/flagship.ts` and changed `FlagshipCopy` to `Widen<typeof flagshipCopy>`. The type is still structurally derived from `typeof flagshipCopy` (no hand-duplicated interface, preserving the file's stated no-drift guarantee) — only the leaf string literal types are relaxed to `string`.
- **Files modified:** `src/lib/strings/flagship.ts`
- **Verification:** `npm run typecheck` — the ~58 `TS2322` errors against `grocery-food.ts` (one per authored leaf string) disappeared; no other file's typecheck output changed.
- **Committed in:** `2d9d7a8` (Task 1 commit)

**2. [Rule 3-adjacent — logged, not fixed] Two pre-existing, unrelated `npm run typecheck` failures observed during verification**
- **Found during:** Both tasks' `npm run typecheck` verification runs
- **Issue:** (a) `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/components/app-sidebar.tsx` all fail to resolve `@/assets/brand/einort-logo.png` as a module, even though the file exists on disk — a module-declaration/asset-typing gap from an unrelated prior commit (`3e94aec`). (b) `src/app/s/[slug]/sections/section-renderer.tsx` is missing a required `variant` prop — the exact gap this plan's own briefing identified as sibling plan 05-10's responsibility, not this plan's.
- **Fix:** None — out of scope per the scope-boundary rule (neither file was read or written by this plan; confirmed via `git diff --stat HEAD` showing only this plan's own files changed).
- **Files modified:** None (logged only)
- **Verification:** `npm run lint` and `npm run test:unit` both exit 0 with these same four pre-existing errors present, confirming they do not block this plan's own gates.
- **Committed in:** `a2431a2` (Task 2 commit, alongside the deferred-items.md log entry)

---

**Total deviations:** 2 (1 auto-fixed blocking type bug, 1 logged-only pre-existing/out-of-scope gap)
**Impact on plan:** The `FlagshipCopy` fix was necessary for this plan's own Task 1 to typecheck at all, and unblocks every remaining Wave 3 segment plan from hitting the identical failure. No scope creep — the fix is scoped to the one type definition responsible for the failure. The two logged items are genuinely unrelated to this plan's files.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `grocery-food` is now a fully authored segment: 8 templates, real copy, real accents, all verified against `pageDocumentSchema`/`themeTokensSchema` and cross-checked against `TEMPLATES[key].sections` for order and against `strings.templates[key]` for content fidelity.
- The `FlagshipCopy` type fix in `src/lib/strings/flagship.ts` is a prerequisite the remaining five Wave 3 segment plans (05-11 through 05-14, 05-16, 05-17) will now silently benefit from — they should NOT need to repeat this fix, but their own executors should be aware the type now widens to `string` rather than enforcing flagship's literal wording, in case any test elsewhere relied on the old (accidental) literal-narrowing behavior.
- Plan 05-20's generalized template-distinctiveness test suite is the next gate that exercises this segment alongside all 50 templates — nothing in this plan's own verification substitutes for that suite.
- Pre-existing, unrelated `npm run typecheck` failures (logo asset resolution, `section-renderer.tsx`'s `variant` prop) remain open; see `deferred-items.md`.

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-06*

## Self-Check: PASSED

- FOUND: src/lib/strings/templates/grocery-food.ts
- FOUND: src/server/theming/templates/grocery-food.ts
- FOUND: src/lib/strings/flagship.ts
- FOUND: .planning/phases/05-template-segment-expansion/05-15-SUMMARY.md
- FOUND commit: 2d9d7a8
- FOUND commit: a2431a2
