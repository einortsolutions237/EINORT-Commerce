---
phase: 05-template-segment-expansion
plan: 14
subsystem: theming
tags: [templates, copy, zod, typescript, storefront, beauty-cosmetics]

# Dependency graph
requires:
  - phase: 05-template-segment-expansion
    provides: "05-03's strings.templates namespace and Partial<FlagshipCopy> shape; 05-08's 50-row TEMPLATE registry, beauty-cosmetics skeleton assignments (S8-S11), and contract-complete document/token builder module"
provides:
  - "Complete, distinct, Douala-appropriate copy for all 8 beauty-cosmetics templates in src/lib/strings/templates/beauty-cosmetics.ts"
  - "8 real, per-hue accent pairs for the segment's document/token builders in src/server/theming/templates/beauty-cosmetics.ts"
  - "A structural fix to FlagshipCopy (src/lib/strings/flagship.ts) that unblocks real copy authoring for all six segments, not just this one"
affects: [05-20]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WidenLeaves<T> mapped type in flagship.ts, recursively converting an `as const` object's literal string types back to `string` while preserving object shape — the correct way to use a concrete `as const` value as a structural template for other authors' content"

key-files:
  created: []
  modified:
    - src/lib/strings/templates/beauty-cosmetics.ts
    - src/lib/strings/flagship.ts
    - src/server/theming/templates/beauty-cosmetics.ts

key-decisions:
  - "Fixed FlagshipCopy's type derivation (Rule 1 bug) rather than routing around it, because the bug blocks every one of the six segment copy modules identically, not just beauty-cosmetics — leaving it unfixed would have required every other Wave 3 plan to independently rediscover and fix the same root cause, or worse, work around it with an unsafe cast."
  - "8 accent pairs chosen from 8 distinct hue families (rose, plum, forest green, terracotta, teal, wine, indigo, navy) rather than 8 shades of one hue, per the plan's own instruction that the accent pair carries a disproportionate share of the distinctiveness work in a segment with zero photography."

requirements-completed: [TMPL-03, TMPL-04]

# Metrics
duration: ~45min
completed: 2026-09-06
---

# Phase 5 Plan 14: Author the beauty-cosmetics segment Summary

**All 8 beauty-cosmetics templates (glow/veil/bloom/satin/radiance/luxe/aura/muse) now carry real, distinct, fully-typographic copy and 8 genuinely separated accent pairs — plus a fix to the shared `FlagshipCopy` type that was silently blocking every segment's copy authoring, not just this one.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-06T05:23:00Z (environment restoration)
- **Completed:** 2026-09-06T05:39:00Z
- **Tasks:** 2/2 complete
- **Files modified:** 3

## Accomplishments

- `src/lib/strings/templates/beauty-cosmetics.ts` filled with 8 complete copy sets (name, segmentTag, announcement, footerTagline, and the exact copy groups each template's registry row declares — hero, trust-bar, product-grid, editorial-split, contact as applicable), written for a Douala skincare/haircare/makeup/fragrance buyer and for a page that ships zero photography
- All 8 `hero.eyebrow + hero.heading` pairs verified distinct via a throwaway tsx script; all strings verified within their `src/server/theming/schema.ts` character caps
- `src/server/theming/templates/beauty-cosmetics.ts`'s 8 token builders given real, per-template accent pairs across 8 distinct hue families; sibling templates sharing a skeleton (beauty-glow/veil, beauty-bloom/satin, beauty-radiance/luxe, beauty-aura/muse) verified to never share a `primaryAccent`
- Fixed a structural bug in `src/lib/strings/flagship.ts`'s `FlagshipCopy` type export that made `Partial<FlagshipCopy>` reject any string other than the flagship's own literal words — a blocker for all six segment copy modules, discovered here because this is the first Wave 3 plan to populate real content against that type

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the beauty-cosmetics copy namespace** - `7a3408d` (feat)
2. **Task 2: Author the beauty-cosmetics document and token builders** - `95b9a16` (feat)

## Files Created/Modified

- `src/lib/strings/templates/beauty-cosmetics.ts` - 8 complete copy sets for beauty-glow, beauty-veil, beauty-bloom, beauty-satin, beauty-radiance, beauty-luxe, beauty-aura, beauty-muse
- `src/lib/strings/flagship.ts` - added `WidenLeaves<T>` mapped type; `FlagshipCopy` now derives from it instead of raw `typeof flagshipCopy`
- `src/server/theming/templates/beauty-cosmetics.ts` - replaced all 8 token builders' shared `DEFAULT_PRIMARY_ACCENT`/`DEFAULT_SECONDARY_ACCENT` with per-template accent pairs; updated module header comment to reflect content-complete state

## Decisions Made

- **Fixed `FlagshipCopy`'s type derivation instead of casting around it.** `type FlagshipCopy = typeof flagshipCopy` off an `as const` object types every leaf as its exact literal ("Welcome", "New arrivals", ...), so `Partial<FlagshipCopy>` — the type all six segment copy modules use — could only ever accept the flagship's own words. This is a Rule 1 bug (broken behavior at the type level; the code that consumed it could not have worked as designed for any segment) fixed at its source (`src/lib/strings/flagship.ts`) with a recursive `WidenLeaves<T>` mapped type rather than an `as` cast or a `string` re-annotation at each of the six segment call sites, because the six modules import `FlagshipCopy` as a type and have no way to widen it themselves without duplicating the fix six times.
- **8 accent pairs across 8 distinct hue families.** Since every beauty-cosmetics template ships `backgroundImageKey: null` / `imageKey: null` by construction (D-04, no stock imagery for this segment), the plan explicitly calls out the accent pair as doing "a disproportionate share of the distinctiveness work." Chose rose, plum, forest green, terracotta, teal, wine, indigo, and navy rather than eight shades of a single brand hue.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `FlagshipCopy` type made every segment's copy namespace uncompilable against anything but the flagship's own literal strings**
- **Found during:** Task 1, first `npm run typecheck` after writing real beauty-cosmetics copy
- **Issue:** `src/lib/strings/flagship.ts` exported `export type FlagshipCopy = typeof flagshipCopy;` where `flagshipCopy` is `as const`. Every string field's type was therefore its own literal value (e.g. `heading: "New arrivals"`), not `string`. `Partial<Record<TemplateKey, Partial<FlagshipCopy>>>` — the exact type all six `src/lib/strings/templates/*.ts` modules use — inherited those literal types, so any beauty-cosmetics (or fashion-apparel, electronics, grocery-food, furniture-home, general-retail) hero heading other than `"New arrivals"` was a `TS2322` compile error. `npm run typecheck` produced ~60 such errors the instant real copy was written.
- **Fix:** Added a recursive `WidenLeaves<T>` mapped type in `flagship.ts` (`T extends string ? string : T extends readonly (infer U)[] ? readonly WidenLeaves<U>[] : T extends object ? { [K in keyof T]: WidenLeaves<T[K]> } : T`) and changed `FlagshipCopy` to `WidenLeaves<typeof flagshipCopy>`. This preserves the object's shape (which fields exist, at which nesting) while widening every string leaf back to `string`, so `Partial<FlagshipCopy>` is now usable as a structural template rather than a literal-value demand. `flagshipCopy` itself and all other consumers of `strings.flagship` (`src/server/theming/defaults.ts`) are untouched — only the separately-exported type changed.
- **Files modified:** `src/lib/strings/flagship.ts`
- **Verification:** `npm run typecheck` — 0 errors from `beauty-cosmetics.ts` (only the pre-existing, out-of-scope `section-renderer.tsx` `variant` error remains, expected per this plan's own instructions). `npm run lint` exits 0. `npm run test:unit` — 571/571 pass.
- **Committed in:** `7a3408d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was necessary for this plan's Task 1 to compile at all, and its scope is strictly the type definition in `flagship.ts` — no value, no other file, no test was touched. Because the bug was in a shared contract (`FlagshipCopy`) rather than anything beauty-cosmetics-specific, the other five Wave 3 segment-copy plans (05-12, 05-13, 05-15, 05-16, 05-17) running in parallel worktrees will hit the identical `TS2322` wall the moment they write real copy in their own worktree, unless they've already fixed it independently. This is flagged here for the orchestrator's awareness at merge time — the fix is idempotent (same three-line type change) and should merge cleanly regardless of which plan's commit lands first, but two independent fixes to the same lines will conflict and need trivial reconciliation, not a re-decision.

## Issues Encountered

- **Environment restoration (pre-existing, not part of any task).** This worktree started with none of `node_modules`, `src/generated/prisma`, `.env.local`, `.env.test`, or `next-env.d.ts` (all gitignored). Restored via `robocopy` (node_modules, generated Prisma client) and direct file copy (`.env.local`, `.env.test`, `next-env.d.ts`) from the main checkout at `D:\Maxs\Claude\einort-commerce`, per the standard setup instructions and consistent with 05-08's own documented restoration of `next-env.d.ts` for the same `@/assets/brand/einort-logo.png` module-resolution symptom.
- **Known, expected `section-renderer.tsx` typecheck error.** Confirmed present before and after this plan's changes, unrelated to this plan's files, and explicitly called out as fixed by sibling plan 05-10 (not yet merged). Not touched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Beauty-cosmetics is now content-complete: 8 templates with real copy, real per-template accents, and a passing plan-level verification (typecheck, lint, targeted vitest suites, and a throwaway tsx script asserting schema-parse success, section-order match, `id === type` uniqueness, fresh-object-per-call, no non-null image keys, and accent distinctness across all 8 keys).
- Plan 05-20 (generalized default-document parse test across all 50 templates) can now include beauty-cosmetics without hitting an empty-string default — a concern the 05-08 summary flagged as still open for this segment.
- **Flagging for the orchestrator / plan 05-20:** the `FlagshipCopy` type fix in `src/lib/strings/flagship.ts` (see Deviations above) is a shared-contract fix, not scoped to beauty-cosmetics. If another Wave 3 plan (05-12, 05-13, 05-15, 05-16, 05-17) independently fixes the same lines in its own worktree, expect a small, mechanical merge conflict on `flagship.ts` at integration time — both fixes should be structurally identical (a `WidenLeaves<T>`-shaped mapped type), so resolution should be "keep either, they agree" rather than a design decision.
- No blockers. `npm run typecheck`, `npm run lint`, and `npm run test:unit` (571/571) all pass on the final state of this plan's two commits.

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-06*

## Self-Check: PASSED

Both modified template files (`src/lib/strings/templates/beauty-cosmetics.ts`, `src/server/theming/templates/beauty-cosmetics.ts`) and the fixed shared type file (`src/lib/strings/flagship.ts`) confirmed present on disk with expected content. Both task commit hashes (`7a3408d`, `95b9a16`) confirmed in `git log --oneline`.
