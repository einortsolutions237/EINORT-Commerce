---
phase: 05-template-segment-expansion
plan: 12
subsystem: templates
tags: [copy, theming, zod, typescript, storefront, distinctiveness]

# Dependency graph
requires:
  - phase: 05-template-segment-expansion
    provides: "05-03's strings.templates namespace typed against Partial<Record<TemplateKey, Partial<FlagshipCopy>>>; 05-08's 50-row TEMPLATES registry, the fashion-apparel segment's 7 contract-complete-but-content-empty builder pairs, and the binding key/segment/tier/skeleton allocation table"
provides:
  - "Real, Douala-appropriate copy for the fashion-apparel segment's 7 non-flagship templates (fashion-classic, fashion-edit, fashion-muse, fashion-studio, fashion-house, fashion-runway, fashion-loft)"
  - "7 schema-valid, fresh-per-call default documents and distinct-accent token pairs for the same 7 templates"
  - "A DeepWiden<T> type helper making FlagshipCopy usable as a shape for other templates' real prose, unblocking every remaining Wave-3 segment plan (05-13 through 05-17) from hitting the same TS2322 wall"
affects: [05-13, 05-14, 05-15, 05-16, 05-17, 05-20]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DeepWiden<T> recursive type helper (src/lib/strings/flagship.ts) — walks an `as const` object type and replaces string-literal leaves with `string`, preserving object/array structure, so a literal-typed source object can still serve as a structural shape for values with different content"

key-files:
  created: []
  modified:
    - src/lib/strings/templates/fashion-apparel.ts
    - src/server/theming/templates/fashion-apparel.ts
    - src/lib/strings/flagship.ts

key-decisions:
  - "Widened FlagshipCopy via a new DeepWiden<T> helper rather than hand-declaring a duplicate interface or stripping `as const` from flagshipCopy — preserves strings.flagship's own literal typing (a real, intentional property) while making Partial<FlagshipCopy> assignable from arbitrary in-cap prose, which is what every one of the 49 non-flagship templates' copy needs."
  - "fashion-edit and fashion-muse (S1, product-grid:showcase) use itemCount: 4 instead of DEFAULT_ITEM_COUNT (8) — the showcase variant renders fewer, larger tiles, and a curated small edit is the persona's own point. Documented inline per the plan's instruction to record variant-count deviations in a comment."

requirements-completed: [TMPL-03, TMPL-04]

# Metrics
duration: ~35min (resumed after a weekly API rate limit interrupted the prior session mid-Task-2; this session verified both files' pre-existing content against every acceptance criterion, fixed one blocking type error, ran all specified verification gates, and committed)
completed: 2026-09-06
---

# Phase 5 Plan 12: Author the fashion-apparel segment Summary

**Real, distinct, cap-respecting copy and fresh schema-valid default documents for all 7 non-flagship fashion-apparel templates, unblocked by a DeepWiden<T> type fix that widens FlagshipCopy's literal-typed leaves to plain `string` so other templates' prose can typecheck against it.**

## Performance

- **Duration:** ~35 min this session (continuation of a prior agent whose work was interrupted by a weekly rate limit after both files' content was substantially or fully written but never verified/committed)
- **Started:** 2026-09-06T05:20:00Z (approx, environment restoration + verification)
- **Completed:** 2026-09-06T05:30:00Z
- **Tasks:** 2/2 complete
- **Files modified:** 3 (2 plan-declared + 1 Rule-1 type fix)

## Accomplishments

- `src/lib/strings/templates/fashion-apparel.ts` fills in complete copy sets for the segment's 7 non-flagship templates (`fashion-classic`, `fashion-edit`, `fashion-muse`, `fashion-studio`, `fashion-house`, `fashion-runway`, `fashion-loft`), each carrying only the copy groups its registry row's skeleton actually declares, written for a Douala fashion/apparel merchant (boutique, tailor/atelier, streetwear, resale personas)
- All 7 hero `eyebrow + heading` pairs are distinct from each other and from `strings.flagship.hero`'s, satisfying the distinctiveness metric's rule 3 signature
- `src/server/theming/templates/fashion-apparel.ts` fills in all 7 document/token builder pairs: every document is a fresh literal per call, sections match registry row types/order exactly, every section `id === type`, heroes carry `backgroundImageKey: null`, the one editorial-split carries `imageKey: null`, and every settings string reads through `strings.templates["<key>"]?.<path> ?? ""`
- No two templates sharing a skeleton share a `primaryAccent` (verified programmatically, including `fashion-classic` against `flagship-fashion`'s own S0 accent)
- `flagship-fashion` is untouched in both files — no duplicate entry, no edit to its own builders in `defaults.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the fashion-apparel copy namespace** - `698433d` (feat, includes the Rule 1 `DeepWiden<T>` type fix)
2. **Task 2: Author the fashion-apparel document and token builders** - `a9010d0` (feat)

_No separate plan-metadata commit yet; this SUMMARY and STATE/ROADMAP updates are the orchestrator's final step._

## Files Created/Modified

- `src/lib/strings/templates/fashion-apparel.ts` - 7 complete copy sets (name, segmentTag, announcement, footerTagline, and per-skeleton section copy groups) for the segment's non-flagship templates
- `src/server/theming/templates/fashion-apparel.ts` - 7 document builders + 7 token builders, each reading copy from Task 1's namespace and choosing a distinct hex accent pair per template
- `src/lib/strings/flagship.ts` - added `DeepWiden<T>` type helper; `FlagshipCopy` now `DeepWiden<typeof flagshipCopy>` instead of the raw `typeof flagshipCopy`

## Decisions Made

- **DeepWiden<T> over alternatives.** `flagshipCopy` is declared `as const` (a deliberate, correct property — `strings.flagship` itself should carry literal types). But `typeof flagshipCopy` made every leaf field's type the flagship's own literal string, so `Partial<FlagshipCopy>` rejected any other template's real prose at every field (`TS2322`, ~62 errors across the file). Rather than stripping `as const` from `flagshipCopy` (which would lose `strings.flagship`'s own literal typing) or hand-declaring a duplicate interface (which the module's own header explicitly rejects, to avoid drift), added a recursive `DeepWiden<T>` type that walks the object graph and replaces string-literal leaves with `string`, preserving plain-object and array structure. This is a minimal, type-level-only fix with zero runtime effect.
- **itemCount: 4 for the two showcase-variant siblings.** `fashion-edit`/`fashion-muse` (S1, `product-grid:showcase`) use `itemCount: 4` instead of `DEFAULT_ITEM_COUNT` (8), per the plan's explicit allowance for the showcase variant's fewer/larger tiles; documented inline in the file's header comment and the two functions' own doc comments.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Widened `FlagshipCopy` with a new `DeepWiden<T>` type helper**
- **Found during:** Task 1, running the plan's specified `npm run typecheck` verification command
- **Issue:** `FlagshipCopy` was `typeof flagshipCopy`, and `flagshipCopy` is declared `as const`. This makes every leaf field (e.g. `hero.heading`) carry the flagship's own string-literal type (`"New arrivals"`), not `string`. `Partial<T>` only widens optionality at the top level — it does not touch literal types nested inside `hero`, `trustBar`, etc. As a result, assigning any other template's real copy (e.g. `hero.heading: "A few pieces, chosen carefully"`) to a field typed `Partial<FlagshipCopy>` failed to typecheck, producing ~62 `TS2322` errors across the newly-authored copy file — a blocker discovered only now because this is the first Wave-3 plan to populate real content into a `strings.templates[key]` entry (05-08's segment modules were all empty stubs, which never exercised this type path).
- **Fix:** Added a recursive `DeepWiden<T>` type to `src/lib/strings/flagship.ts` that maps every string-literal leaf to `string` while preserving object/array structure, and changed `export type FlagshipCopy = typeof flagshipCopy` to `export type FlagshipCopy = DeepWiden<typeof flagshipCopy>`. `flagshipCopy`'s own `const` declaration and `strings.flagship`'s literal typing are unaffected — only the exported type used by the other 49 templates changes.
- **Files modified:** `src/lib/strings/flagship.ts`
- **Verification:** `npm run typecheck` goes from ~62 errors in `fashion-apparel.ts` to the one known, pre-existing, out-of-scope error in `src/app/s/[slug]/sections/section-renderer.tsx` (sibling plan 05-10's `variant` prop gap). `npm run lint` exits 0. `npm run test:unit` — 571/571 pass.
- **Committed in:** `698433d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix is a prerequisite for this plan's own Task 1 deliverable to typecheck at all, and unblocks every remaining Wave-3 segment-copy plan (05-13 through 05-17) from hitting the identical wall the moment they populate real prose into their own `strings.templates[key]` entries. No file outside a `git diff`-visible, directly-necessitated change was touched.

## Issues Encountered

- **Missing dev-only type declarations, not a code bug.** `next-env.d.ts` and `.next/dev/types/**` (both gitignored, Next-generated) were absent from the worktree — expected per the resume brief. Restored both from the main checkout (`D:\Maxs\Claude\einort-commerce`) before running `typecheck`; nothing under this restoration is committed (both paths are gitignored).
- **Prior session's uncommitted work verified, not redone.** Both plan-declared files already carried complete, correct content from the interrupted prior session. This session's work was: read both files in full against every acceptance criterion in the plan, restore the missing dev-type declarations, discover and fix the `DeepWiden` blocker, run every `<verify>` gate the plan specifies (typecheck, lint, `test:unit`, the segment-specific `theming-registry.test.ts` + `contrast.test.ts` pair), and run ad-hoc `tsx` scripts (not committed) confirming cap compliance, hero-signature distinctness, schema-parse success, section-type/order match, id/type/uniqueness invariants, per-call freshness, and sibling accent distinctness — then commit atomically per task.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The fashion-apparel segment (`flagship-fashion` + 7 authored templates) is now fully content-complete: real copy, real schema-valid documents, real distinct accents.
- **Important for 05-13 through 05-17:** the `DeepWiden<T>` fix in `src/lib/strings/flagship.ts` (this plan's Task 1 commit) is a prerequisite each of those plans' own `npm run typecheck` gate will silently depend on — they do not need to re-discover or re-apply it, since `FlagshipCopy` is shared. Their copy files can assign arbitrary in-cap prose without the `TS2322` wall this plan hit first.
- One known, pre-existing, out-of-scope typecheck error remains: `src/app/s/[slug]/sections/section-renderer.tsx` missing a `variant` prop on its `hero` render call — sibling plan 05-10's responsibility, untouched here per the resume brief.
- No blockers. `npm run typecheck` (1 known unrelated error only), `npm run lint` (0), and `npm run test:unit` (571/571) all pass on the final state of this plan's two commits.

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-06*

## Self-Check: PASSED

Verified both modified plan files and the `flagship.ts` fix are present on disk with the expected content, and both task commit hashes (`698433d`, `a9010d0`) are present in `git log --oneline`.
