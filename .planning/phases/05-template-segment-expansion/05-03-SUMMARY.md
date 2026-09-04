---
phase: 05-template-segment-expansion
plan: 03
subsystem: ui
tags: [copy, i18n-prep, typescript, template-picker, entitlements-copy]

# Dependency graph
requires:
  - phase: 04-theme-section-block-system-flagship-template
    provides: strings.flagship namespace, the branding/editor namespaces, plan.starter/business/professional feature bullets
provides:
  - src/lib/strings/index.ts as a directory-split copy catalogue (was strings.ts) with an identical @/lib/strings import path
  - strings.flagship extracted to src/lib/strings/flagship.ts (flagshipCopy value, FlagshipCopy type) to break a circular-type dependency
  - Six empty, correctly-typed per-segment copy namespaces under src/lib/strings/templates/, spliced flat into strings.templates
  - strings.templates typed Partial<Record<TemplateKey, Partial<FlagshipCopy>>> — ready for plan 05-08 (Wave 2) to read via optional chaining before any real content exists
  - All Phase-5 chrome copy (7 strings.branding.template* keys, 9 new strings.editor.* keys, 1 reused rail key)
  - Starter/Business/Professional template-count copy reconciled to 10/25/50 in strings.plan and pricing-reference.md
affects: [05-08, 05-09, 05-12, 05-13, 05-14, 05-15, 05-16, 05-17, 05-18, 05-19]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flat-by-template-key splice namespace (strings.templates), never nested by segment"
    - "Outer Partial + inner Partial typing lets an unauthored template/section simply have no entry, still typechecking against optional-chained reads"
    - "Extract a shared literal into its own module when a type-only import back to the aggregating file would be circular (src/lib/strings/flagship.ts)"

key-files:
  created:
    - src/lib/strings/flagship.ts
    - src/lib/strings/templates/fashion-apparel.ts
    - src/lib/strings/templates/electronics.ts
    - src/lib/strings/templates/beauty-cosmetics.ts
    - src/lib/strings/templates/grocery-food.ts
    - src/lib/strings/templates/furniture-home.ts
    - src/lib/strings/templates/general-retail.ts
  modified:
    - src/lib/strings/index.ts (renamed from src/lib/strings.ts, then extended)
    - .planning/phases/02-merchant-auth-entitlements-trial/pricing-reference.md

key-decisions:
  - "Extracted strings.flagship's value into src/lib/strings/flagship.ts rather than leaving it inline, to break a genuine TS7022 circular type reference the plan's own design would otherwise hit"
  - "Added name/segmentTag fields to strings.flagship (via flagshipCopy) so Partial<FlagshipCopy> structurally supports what plans 05-12 through 05-17 will write per template"
  - "Reused the existing railBack key instead of adding a byte-identical railBackToSections key, per this codebase's own no-duplicate-copy convention"

patterns-established:
  - "Pattern: per-segment copy modules are typed against a value extracted to its own module (FlagshipCopy), not against `typeof strings.flagship` imported from the aggregating index.ts, whenever the aggregating file also imports those modules' values"

requirements-completed: [TMPL-04]

# Metrics
duration: 28min
completed: 2026-09-04
---

# Phase 5 Plan 3: Strings Directory Split, Segment Copy Namespaces, and Chrome Copy Summary

**Split `src/lib/strings.ts` into a directory, added six empty but correctly-typed per-segment copy namespaces spliced into `strings.templates`, and landed all Phase-5 chrome copy plus the 10/25/50 tier-count reconciliation — fixing a real circular-type bug the plan's literal design would otherwise have hit.**

## Performance

- **Duration:** 28 min (environment setup + execution)
- **Started:** 2026-09-04T12:24:00Z (worktree environment restoration)
- **Completed:** 2026-09-04T12:52:47Z
- **Tasks:** 3/3 completed
- **Files modified:** 9 (1 renamed, 7 created, 1 planning-doc edited alongside index.ts)

## Accomplishments
- `src/lib/strings.ts` moved to `src/lib/strings/index.ts` as a pure `git mv` rename (R100, zero content diff) — `@/lib/strings` resolves identically, no call site changed
- Six per-segment copy namespaces (`fashion-apparel`, `electronics`, `beauty-cosmetics`, `grocery-food`, `furniture-home`, `general-retail`) created empty and spliced flat into `strings.templates`, typed `Partial<Record<TemplateKey, Partial<FlagshipCopy>>>` — structurally equivalent to the plan's specified `Partial<Record<TemplateKey, Partial<typeof strings.flagship>>>`, but sourced from an extracted module to avoid a circular type reference
- All Phase-5 chrome copy landed verbatim from 05-UI-SPEC.md (7 `branding.template*` keys, 9 new `editor.*` keys), including the destructive-dialog body confirmed character-for-character identical to the spec, including the em dash
- Starter/Business/Professional template-count copy reconciled to 10/25/50 in both `strings.plan` and `pricing-reference.md`, so marketing copy and the (future) entitlement gate cannot disagree

## Task Commits

1. **Task 1: Move strings.ts to strings/index.ts verbatim** - `a3a690d` (refactor)
2. **Task 2: Create the six per-segment template copy namespaces and splice them in** - `361eb35` (feat)
3. **Task 3: Add every Phase-5 chrome string and reconcile the Starter template count** - `33d5168` (feat)

_No plan-metadata commit yet — STATE.md/ROADMAP.md updates are the orchestrator's responsibility per this run's instructions; this plan's execution did not touch either file._

## Files Created/Modified
- `src/lib/strings/index.ts` - Renamed from `strings.ts`; extended with `strings.templates` splice and all Phase-5 chrome copy; `strings.flagship` now reads from the extracted `flagshipCopy`
- `src/lib/strings/flagship.ts` - New. `flagshipCopy` (the flagship's copy, moved verbatim) and `FlagshipCopy` (`typeof flagshipCopy`) — exists specifically to give the six per-segment modules a non-circular type source
- `src/lib/strings/templates/fashion-apparel.ts` - Empty, typed namespace for the fashion-apparel segment (filled by plan 05-12)
- `src/lib/strings/templates/electronics.ts` - Empty, typed namespace for the electronics segment (filled by plan 05-13)
- `src/lib/strings/templates/beauty-cosmetics.ts` - Empty, typed namespace for the beauty-cosmetics segment (filled by plan 05-14)
- `src/lib/strings/templates/grocery-food.ts` - Empty, typed namespace for the grocery-food segment (filled by plan 05-15)
- `src/lib/strings/templates/furniture-home.ts` - Empty, typed namespace for the furniture-home segment (filled by plan 05-16)
- `src/lib/strings/templates/general-retail.ts` - Empty, typed namespace for the general-retail segment (filled by plan 05-17)
- `.planning/phases/02-merchant-auth-entitlements-trial/pricing-reference.md` - Starter/Business/Professional template-count bullets reconciled to 10/25/50

## Decisions Made
- Extracted `strings.flagship`'s value into `src/lib/strings/flagship.ts` (see Deviations — this was necessary to make the plan's own typing design compile at all)
- Added `name`/`segmentTag` fields to `strings.flagship` (via `flagshipCopy`) because plans 05-12 through 05-17's own task text ("Per template, provide: `name` ... `segmentTag`, `announcement`, `footerTagline`, ...") and 05-18's own read (`strings.templates[key].name` / `.segmentTag`) require these fields to exist on the reference shape now, or those later plans' writes would fail to typecheck against `Partial<FlagshipCopy>`
- Reused the existing `railBack` key ("All sections") for the "Change template" panel's back row instead of adding a second, byte-identical `railBackToSections` key — this codebase explicitly forbids writing one sentence twice (see multiple header comments across `src/server/**`), and a duplicate key with an identical value in the same namespace is the same anti-pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Circular TypeScript type reference (TS7022) between `index.ts` and the six per-segment modules**
- **Found during:** Task 2, first `npm run typecheck` after creating the six files with `import type { strings } from "@/lib/strings"`
- **Issue:** The plan's literal design has each of the six `src/lib/strings/templates/<segment>.ts` files import `typeof strings.flagship` from `@/lib/strings` (i.e. from `index.ts`). But `index.ts`'s own `strings` object initializer imports those same six modules' *values* to build `strings.templates`. This is a genuine strongly-connected component in the type graph: `strings`'s own type can't be inferred without first knowing `fashionApparelTemplates`'s type, which can't be resolved without first knowing `strings`'s type. TypeScript reports `TS7022: 'strings' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer` and (cascading) an unrelated pre-existing file (`payment-instructions.tsx`) also failed to typecheck as collateral damage of the `any` widening.
- **Fix:** Extracted `strings.flagship`'s literal value into a new module, `src/lib/strings/flagship.ts`, exporting `flagshipCopy` (the value) and `FlagshipCopy` (`typeof flagshipCopy`). `index.ts` imports `flagshipCopy` and assigns `flagship: { ...flagshipCopy }` (an inline object-literal spread, preserving the acceptance criterion that `grep -c 'flagship: {' src/lib/strings/index.ts` returns 1). The six per-segment modules import `type { FlagshipCopy } from "../flagship"` instead of `type { strings } from "@/lib/strings"`, and type themselves `Partial<Record<TemplateKey, Partial<FlagshipCopy>>>` — structurally identical to the plan's specified `Partial<Record<TemplateKey, Partial<typeof strings.flagship>>>` (since `strings.flagship` is assigned from `flagshipCopy` verbatim), but sourced from a module with no import path back to `index.ts`, so there is no cycle.
- **Files modified:** `src/lib/strings/flagship.ts` (new), `src/lib/strings/index.ts`, all six `src/lib/strings/templates/*.ts` files
- **Verification:** `npm run typecheck` exits 0 (previously failed with 3 errors); `npm run lint` exits 0; `npm run test:unit` passes 566/566; a `tsx` script confirmed `strings.flagship.name`/`.segmentTag` and `strings.templates["flagship-fashion"]?.hero?.eyebrow` (optional-chained, unauthored key) both resolve correctly at runtime
- **Committed in:** `361eb35` (Task 2 commit)

**2. [Rule 2 - Missing critical functionality] `strings.flagship` lacked `name`/`segmentTag`, which future plans' own text requires**
- **Found during:** Task 2, while reading the plan's action text against the actual current shape of `strings.flagship`
- **Issue:** The plan's Task 2 action text lists `name` and `segmentTag` as part of "`strings.flagship`'s own inferred shape structurally" that the six per-segment namespaces reuse. But `strings.flagship` did not have these fields. Cross-referencing plans 05-12 through 05-17 ("Per template, provide: `name` ... `segmentTag`, `announcement`, `footerTagline`, ...") and 05-18 (`strings.templates[key].name` / `.segmentTag`) confirmed these are real fields those later plans will write and read — without them on the reference shape, those plans' writes would fail to typecheck against `Partial<FlagshipCopy>`.
- **Fix:** Added `name: "Flagship"` and `segmentTag: "Fashion & apparel"` to `flagshipCopy` (`src/lib/strings/flagship.ts`), documented as display-name/segment-tag fields for template-picker cards, matching the segment-label phrasing already used in `strings.branding.segments`.
- **Files modified:** `src/lib/strings/flagship.ts`
- **Verification:** `npm run typecheck` exits 0; a `tsx` script confirmed `strings.flagship.name` and `.segmentTag` resolve
- **Committed in:** `361eb35` (Task 2 commit)

**3. [Rule 1 - Bug] Skipped adding a duplicate `railBackToSections` key**
- **Found during:** Task 3, while adding the eleven `strings.editor.*` template keys the plan lists
- **Issue:** The plan lists `railBackToSections: "All sections"` as a new key, but `strings.editor.railBack` already exists with the exact same value and the exact same role ("Back row of the settings-panel view — this is a push/pop, not a pane."), which 05-UI-SPEC.md itself confirms the "Change template" panel reuses ("Identical push/pop pattern to `Brand & logo`"). Adding a second key with an identical value would be the literal "writing one sentence twice" anti-pattern this codebase's own header comments explicitly forbid in several `src/server/**` modules.
- **Fix:** Did not add `railBackToSections`. Documented `railBack`'s reuse for the template-picker panel's back row directly in the new `railChangeTemplateEntry` doc comment, so a future reader sees the connection rather than wondering why a listed key is missing.
- **Files modified:** `src/lib/strings/index.ts` (comment only — no new key)
- **Verification:** `railBack` already resolves at runtime (pre-existing); `npm run test:unit` includes the prose-scanning contract tests and all 566 pass
- **Committed in:** `33d5168` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 bug — circular type reference, 1 missing critical functionality, 1 bug — avoided introducing a duplicate string)
**Impact on plan:** All three were necessary for the plan's own design intent to actually compile and to avoid an internal contradiction with the codebase's established no-duplicate-copy convention. No scope creep — no new surfaces, no new files beyond what the plan specified (plus the one extraction module, `flagship.ts`, needed to make the specified typing work).

## Issues Encountered

**Environment restoration (pre-execution, not a plan deviation):** the worktree started with none of the gitignored build artifacts (`node_modules`, `src/generated/prisma`, `.env.local`, `.env.test`, `.next/types`) present, as expected for a fresh worktree. Restored all of these via real file copies (`robocopy`, not junctions — this project has previously hit Turbopack failures on junctioned `node_modules`) from the main checkout. One artifact not listed in the original setup instructions was also required: `next-env.d.ts` and `.next/dev/types/` (Next 16's dev-mode ambient type declarations, which back the `next/image` static-import module augmentation) — their absence caused three unrelated pre-existing typecheck errors (`Cannot find module '@/assets/brand/einort-logo.png'`) before any of this plan's own changes were made. Restored the same way (real file copy from the main checkout), after which typecheck was clean before Task 1 began.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `strings.templates` exists, is correctly typed, and is ready for plan 05-08 (Wave 2) to read from via `strings.templates[key]?.hero?.eyebrow ?? ""` before any real content exists — confirmed this typechecks and resolves to `undefined` at runtime as designed
- All eleven Phase-5 chrome strings (branding + editor) exist and are ready for plans 05-18/05-19 to consume
- Starter/Business/Professional copy states 10/25/50, matching what plan 05-04's tier gate (Wave 2) will enforce — no more disagreement between marketing copy and the entitlement gate
- Plans 05-12 through 05-17 (Wave 3) can write `name`/`segmentTag`/section-group copy into their respective per-segment modules under the exact type this plan established, with no further typing changes needed
- No blockers for Wave 2 plans (05-04 through 05-11) that depend on this plan's `strings.templates` namespace existing

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-04*

## Self-Check: PASSED

- All 10 created/modified files confirmed present on disk.
- All 3 task commit hashes (`a3a690d`, `361eb35`, `33d5168`) confirmed present in `git log`.
