---
phase: 05-template-segment-expansion
plan: 16
subsystem: theming
tags: [templates, copy, theming, zod, typescript, storefront]

# Dependency graph
requires:
  - phase: 05-template-segment-expansion
    provides: "05-03's strings.templates namespace scaffold; 05-08's furniture-home registry rows, contract-complete builder skeletons, and the 8-key/skeleton/tier allocation table"
provides:
  - "Real, distinct, Douala-appropriate copy for all 8 furniture-home templates (src/lib/strings/templates/furniture-home.ts)"
  - "Real per-template document/token builders for furniture-home: deliberate itemCount per grid variant, varied trust-bar icons, 8 distinct per-template accent pairs (src/server/theming/templates/furniture-home.ts)"
  - "Fix: FlagshipCopy's `as const` removed from src/lib/strings/flagship.ts, unblocking every Wave 3 segment plan from writing copy that differs from the flagship's exact wording"
affects: [05-20]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SHOWCASE_ITEM_COUNT (4) / DENSE_ITEM_COUNT (12) named module constants alongside DEFAULT_ITEM_COUNT (8), so a showcase-bearing or dense-bearing builder's itemCount choice reads as deliberate rather than restated inline"
    - "Per-template hex accent constants declared at module scope (e.g. LOOM_PRIMARY_ACCENT), named for the template rather than the color, mirroring DEFAULT_PRIMARY_ACCENT's own module-scope-constant convention"

key-files:
  created: []
  modified:
    - src/lib/strings/templates/furniture-home.ts
    - src/server/theming/templates/furniture-home.ts
    - src/lib/strings/flagship.ts

key-decisions:
  - "Removed `as const` from flagshipCopy (src/lib/strings/flagship.ts) rather than widening FlagshipCopy by hand: FlagshipCopy = typeof flagshipCopy is meant to be a SHAPE contract for the other 49 templates' copy, not a value-equality contract, and `as const` pinned every leaf to its own string-literal type. This is a Rule 1 bug that blocks every Wave 3 segment plan, not just this one, since furniture-home is simply the first to author real, distinct copy and hit it."
  - "product-grid itemCount chosen per variant rather than left at DEFAULT_ITEM_COUNT everywhere: 4 for the two showcase-bearing skeletons (S16, S19), 12 for the dense skeleton (S18), 8 (the default) for the grid skeleton (S17) — matching the plan's explicit instruction and product-grid-showcase.tsx's two-tiles-per-row layout."
  - "Trust-bar icons vary per template by reading what each block's copy is actually about (delivery -> truck, lead time -> clock, material/build quality -> shield-check, a WhatsApp conversation -> message-circle) rather than repeating the Wave 2 boilerplate's fixed truck/message-circle/shield-check triplet on every template."
  - "Eight distinct per-template accent pairs (walnut, oak amber, oak, terracotta, graphite, mocha, sage, near-black/bronze) replace the Wave 2 placeholder's shared DEFAULT_PRIMARY_ACCENT/DEFAULT_SECONDARY_ACCENT for all 8 templates, chosen as warm, material-led tones appropriate to a furniture/homeware storefront rather than the flagship's zinc palette. No two templates sharing a skeleton share a primaryAccent."

requirements-completed: [TMPL-03, TMPL-04]

# Metrics
duration: ~15min (this session; resumed after a prior session's rate-limit interruption that had already produced Task 1's uncommitted copy authoring)
completed: 2026-09-06
---

# Phase 5 Plan 16: Author the furniture-home segment Summary

**Eight furniture-home templates now carry real Douala-furniture copy and real per-template accent/itemCount/icon builders, plus a codebase-wide Rule 1 fix (removing `as const` from `flagshipCopy`) that was silently blocking every other Wave 3 segment plan from writing copy distinct from the flagship's.**

## Performance

- **Duration:** ~15 min this session (environment restoration + verification of already-authored Task 1 + all of Task 2)
- **Started:** 2026-09-06T05:23:00+01:00 (approx, environment restoration)
- **Completed:** 2026-09-06T05:37:51+01:00
- **Tasks:** 2/2 complete
- **Files modified:** 3 (2 plan-scoped + 1 out-of-scope fix)

## Accomplishments

- Verified Task 1's prior-session copy authoring (`src/lib/strings/templates/furniture-home.ts`, 8 templates) against every acceptance criterion: section-group match against each registry row, 8 distinct hero eyebrow+heading pairs, zero `/s/` hrefs, zero exclamation marks/emoji, every string within its schema cap (confirmed with a throwaway tsx script) — found complete and correct, not redone
- Discovered and fixed a Rule 1 bug in `src/lib/strings/flagship.ts`: `flagshipCopy` was declared `as const`, which pinned `FlagshipCopy` (`typeof flagshipCopy`) to string-literal types on every leaf, making it a compile error for any other template's copy to read anything but the flagship's exact wording. This blocked Task 1's typecheck and would have blocked every other Wave 3 segment plan (05-12 through 05-15, 05-17) the moment any of them tried to write real, different copy.
- Authored Task 2's real document/token builders: per-variant `itemCount` (4 for showcase, 12 for dense, 8/default for grid), trust-bar icons chosen from each block's actual copy content rather than a fixed repeating triplet, and 8 distinct hex accent pairs with no two skeleton-sharing siblings sharing a `primaryAccent`
- Verified all 8 documents parse against `pageDocumentSchema`, match their registry row's section types/order exactly, satisfy `id === type` with unique ids, return fresh object references per call (including fresh `sections` arrays), and carry no non-null image keys — via a throwaway tsx script, not committed

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the furniture-home copy namespace** - `1198226` (feat) — includes the `flagship.ts` Rule 1 fix, committed alongside since it was required for Task 1 to typecheck
2. **Task 2: Author the furniture-home document and token builders** - `1be1e08` (feat)

_This SUMMARY is the final commit for this plan; per the resuming instructions, STATE.md and ROADMAP.md are deliberately not touched by this execution._

## Files Created/Modified

- `src/lib/strings/templates/furniture-home.ts` - 8 complete copy sets (name, segmentTag, announcement, footerTagline, and per-section copy groups) for `furniture-loom`/`grain`/`oak`/`hearth`/`timber`/`haven`/`nook`/`loft`
- `src/server/theming/templates/furniture-home.ts` - 8 document builders (real copy references, per-variant itemCount, varied trust-bar icons, null image keys) and 8 token builders (real per-template accent pairs)
- `src/lib/strings/flagship.ts` - removed `as const` from `flagshipCopy` so `FlagshipCopy` is a shape contract, not a value-equality contract

## Decisions Made

See `key-decisions` in the frontmatter above: the `as const` fix, the per-variant itemCount table, the content-driven trust-bar icon variety, and the 8 distinct accent pairs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed `as const` from `flagshipCopy` in `src/lib/strings/flagship.ts`**
- **Found during:** Task 1 (running the plan's specified `npm run typecheck` verification command)
- **Issue:** `flagshipCopy` was declared `as const`, so `FlagshipCopy = typeof flagshipCopy` pinned every leaf string to its own literal type (e.g. `heading: "New arrivals"` rather than `heading: string`). `strings.templates` types each template's copy as `Partial<FlagshipCopy>`, so this made it a compile error for `furniture-loom`'s (or any other template's) `hero.heading` to be anything other than the flagship's exact wording — a shape contract accidentally enforcing value equality.
- **Fix:** Removed `as const` from the `flagshipCopy` object literal; added a comment on `FlagshipCopy` explaining the distinction between a shape contract and a value-equality contract, and noting this was discovered as the first Wave 3 plan to author real, distinct copy.
- **Files modified:** `src/lib/strings/flagship.ts`
- **Verification:** `npm run typecheck` went from 61 errors (all in `furniture-home.ts`, all "Type X is not assignable to type Y" against the flagship's literal strings) to the single known-unrelated `section-renderer.tsx` error (sibling plan 05-10's job). `npm run lint` and `npm run test:unit` (571/571) both pass with the fix in place. Confirmed the type's only other consumer (`tests/unit/theming-registry.test.ts`) does a runtime value comparison, not a literal-type-dependent assertion, so nothing else relies on the pinned literals.
- **Committed in:** `1198226` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for Task 1's own typecheck gate to pass as specified, and unblocks every other Wave 3 segment plan (05-12 through 05-15, 05-17) from the same failure the moment any of them writes copy that differs from the flagship's wording. No scope creep — no file outside a `src/lib/strings/**` copy-type fix was touched, and the fix removes an incorrect type constraint rather than adding new behavior.

## Issues Encountered

- **Environment restoration (pre-existing, not part of any task).** The worktree's `node_modules` was mid-copy when a prior session hit a weekly rate limit; a first `robocopy` attempt failed with `Invalid Parameter #3 : "E:/"` because Git Bash's MSYS path-conversion mangled the destination argument before robocopy.exe saw it. Retried with `MSYS_NO_PATHCONV=1`, which copied all 581 top-level `node_modules` packages successfully as real files (not junctions), consistent with this project's established Turbopack-compatibility precedent. `.next/dev/types/` (gitignored, Next-generated) was also missing and was restored the same way; `next-env.d.ts` and `.env.local`/`.env.test`/`src/generated/prisma` were already present and correct, as the resume brief indicated.
- **Task 1's prior-session work required no changes.** Read the full 451-line copy module against every acceptance criterion in the plan and confirmed it was complete, correct, and needed no rewriting — only the upstream `flagship.ts` type bug needed fixing for it to typecheck.
- **Own execution error, caught and corrected.** This SUMMARY.md was initially written with an absolute path resolved against the main checkout (`D:\Maxs\Claude\einort-commerce\.planning\...`) instead of the worktree's own `.planning` directory (`D:\Maxs\Claude\einort-commerce\.claude\worktrees\agent-a410d6a2ea3c2b445\.planning\...`), leaving a stray untracked file on the main checkout's `master` branch. Caught before committing anything; the stray file was deleted from the main checkout and this file was rewritten at the correct worktree-relative path. No commit in either working tree was affected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `furniture-home` is now fully authored end-to-end (copy + builders) and ready for plan 05-20's generalized default-document parse test, which is the build-level gate that would have caught the pre-fix empty-string state across all six segments.
- **The `flagship.ts` `as const` fix is relevant to every other Wave 3 segment plan.** 05-12 through 05-15 and 05-17 will hit the identical typecheck failure the moment they write copy that differs from the flagship's exact strings, unless they land after this plan's fix is merged. Worth flagging explicitly to whichever plan or orchestrator sequences the remaining Wave 3 plans, so the fix is not independently rediscovered five more times.
- No blockers. `npm run typecheck` (one known, pre-existing, out-of-scope error in `section-renderer.tsx` belonging to sibling plan 05-10), `npm run lint` (clean), and `npm run test:unit` (571/571) all pass on the final state of this plan's two commits.

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-06*

## Self-Check: PASSED

All 3 created/modified files confirmed present on disk; both task commit hashes (`1198226`, `1be1e08`) confirmed in `git log --all`.
