---
phase: 05-template-segment-expansion
plan: 01
subsystem: theming
tags: [zod, typescript, discriminated-union, source-scanning-test, vitest]

# Dependency graph
requires:
  - phase: 04-storefront-editor-flagship-template
    provides: sectionInstanceSchema, pageDocumentSchema, TEMPLATES/TEMPLATE_KEYS, SECTION_TYPES, flagshipDefaultDocument()
provides:
  - "SECTION_VARIANTS, SectionVariant<T>, SectionVariantMap, TemplateSectionRef, sectionVariantsSchema in schema.ts"
  - "TemplateDefinition.segment / .minTier / .sections: TemplateSectionRef[] in registry.ts"
  - "variantsForTemplate(key): SectionVariantMap, degrade-don't-throw resolver"
  - "tests/unit/theming-marker-boundary.test.ts, the source-scanning server-only/client-boundary contract test"
affects: [05-02, 05-03, 05-08, storefront-editor-template-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union template-section pairing (TemplateSectionRef) instead of two independently-typed fields, to make an illegal type/variant pairing a compile error"
    - "Type-only import erasure as the sanctioned way for a \"use client\" module to reference a shape declared in a server-only module (FieldDescriptor precedent, now also the marker-boundary test's own detection rule)"

key-files:
  created:
    - tests/unit/theming-marker-boundary.test.ts
  modified:
    - src/server/theming/schema.ts
    - src/server/theming/registry.ts
    - tests/unit/theming-registry.test.ts

key-decisions:
  - "sectionVariantsSchema lives in schema.ts (marker-free) and is deliberately excluded from pageDocumentSchema — variants are template-level, not merchant-editable, per D-02"
  - "variantsForTemplate() never throws and always returns a complete map, degrading an unrecognised key to the all-first flagship map (T-05-02)"
  - "minTier gates template SELECTION only, never rendering — a downgraded merchant keeps their published template forever (D-12 corollary to D-03)"

patterns-established:
  - "SECTION_VARIANTS: as const satisfies Readonly<Record<SectionType, ...>> — adding a sixth SectionType is a compile error at the variant table, same drift detection as INDUSTRY_SEGMENTS/PLANS"
  - "Marker-boundary contract test distinguishes type-only imports (erased, safe) from value imports (reach the bundle, forbidden) when scanning for a server-only dependency from a client file"

requirements-completed: [TMPL-03, TMPL-04]

# Metrics
duration: ~55min (this session; resumed after a prior session was interrupted by a rate limit partway through Task 1)
completed: 2026-09-04
---

# Phase 5 Plan 1: Rendering-Variant Vocabulary and Template Contract Summary

**Closed per-section-type variant vocabulary (SECTION_VARIANTS/SectionVariantMap/TemplateSectionRef) in the marker-free schema module, an extended TemplateDefinition (segment/minTier/variant-bearing sections) with a degrade-don't-throw variantsForTemplate() resolver, and a source-scanning contract test that catches a server-only leak into the editor's client preview route in milliseconds instead of at build time.**

## Performance

- **Duration:** ~55 min this session (environment restore + Task 1 verification/commit + Tasks 2-3 full implementation). A prior session began Task 1 and was interrupted by a rate limit before verifying or committing; that work was reviewed, verified, and committed in this session rather than redone.
- **Completed:** 2026-09-04T11:39:54Z
- **Tasks:** 3/3
- **Files modified:** 4 (1 new test file, 3 modified)

## Accomplishments

- `src/server/theming/schema.ts` gained the fourth trust boundary: `SECTION_VARIANTS`, `SectionVariant<T>`, `SectionVariantMap`, `TemplateSectionRef`, and `sectionVariantsSchema`, all documented in the file's established header register, with no `server-only` marker added.
- `src/server/theming/registry.ts`'s `TemplateDefinition` now carries `segment: IndustrySegment`, `minTier: PlanTier`, and `sections: readonly TemplateSectionRef[]`; `flagship-fashion` was rewritten to the new shape without changing what it renders (every variant is the first entry of its `SECTION_VARIANTS` list).
- `variantsForTemplate(key: string): SectionVariantMap` resolves a (possibly untrusted) template key to a complete variant map, degrading to the all-first flagship map for an unrecognised key rather than throwing.
- `tests/unit/theming-marker-boundary.test.ts` scans `src/app/s/[slug]/sections/**` and every `"use client"` file under `src/` for a value import of `@/server/theming/registry` or `/defaults`, both `server-only`. It distinguishes type-only imports (erased by `tsc`, safe) from value imports (reach the client bundle, forbidden) — a distinction the plan's action text did not anticipate but the existing codebase already relies on (`FieldDescriptor` type-only imports in the editor).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the variant vocabulary to the marker-free schema module** - `97e1e42` (feat) — edit was already made by the prior, rate-limited session; this session verified it against the full acceptance criteria and committed it.
2. **Task 2: Extend TemplateDefinition with segment, minTier and per-section variants, and add variantsForTemplate()** - `ee38ec0` (feat)
3. **Task 3: Add the marker-boundary contract test** - `4f6e769` (test)

_No plan-metadata commit yet — this SUMMARY and the state-file updates land in that commit next, per orchestrator handoff (state files are not touched by this executor)._

## Files Created/Modified

- `src/server/theming/schema.ts` - Added `SECTION_VARIANTS`, `SectionVariant<T>`, `SectionVariantMap`, `TemplateSectionRef`, `sectionVariantsSchema` (the fourth, postMessage-only trust boundary); extended the file's three-doors header paragraph. No `server-only` marker added.
- `src/server/theming/registry.ts` - Extended `TemplateDefinition` with `segment`/`minTier`/variant-bearing `sections`; rewrote the `flagship-fashion` row to the new shape (unchanged rendering); added `variantsForTemplate()`.
- `tests/unit/theming-registry.test.ts` - Two drift assertions updated to compare `sections.map(ref => ref.type)` against the new `TemplateSectionRef[]` shape. No assertion deleted or weakened; all 19 tests still pass.
- `tests/unit/theming-marker-boundary.test.ts` - New. Source-scanning contract test for the server-only/client-safe boundary under `src/app/s/[slug]/sections/**` and across every `"use client"` file in `src/`.

## Decisions Made

- `sectionVariantsSchema` was kept out of `pageDocumentSchema` exactly as the plan specified (D-02): a variant is a property of the template, not the document, so `saveDraft`/`discardDraft` can never set one by direct POST.
- `variantsForTemplate()` builds its map by walking `SECTION_VARIANTS`'s own keys (not the template's `sections` array), which is what guarantees the map is always complete — a template that ever declared only 4 of 5 section types could not silently produce a partial map.
- `minTier` was documented, per the plan, as a selection gate only. No render-path code was touched or added to consult it this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored `node_modules`, `src/generated/prisma`, `next-env.d.ts`, and `.next/dev/types` in the fresh worktree**
- **Found during:** Environment setup, before Task 1 verification
- **Issue:** The worktree was missing `node_modules` and the generated Prisma client (expected per the resuming instructions), but `npm run typecheck` also failed with 13 `Cannot find name 'LayoutProps'/'PageProps'`-style errors because `next-env.d.ts` and `.next/dev/types/*.d.ts` (Next.js's typed-routes ambient declarations) did not exist yet either — these are gitignored, machine-generated artifacts that only regenerate on a `next dev`/`next build` run, which nothing in the resume instructions triggered.
- **Fix:** Copied `node_modules` and `src/generated/prisma` from the main checkout via `robocopy` (real file copies, not junctions, per the resume instructions' note about Turbopack failing on junctioned `node_modules`). Copied `next-env.d.ts` and `.next/dev/types/**` from the main checkout the same way, since both trees are on the same route structure and these are pure derived artifacts with no plan-relevant content.
- **Files modified:** None under version control — `node_modules/`, `src/generated/prisma/`, `next-env.d.ts`, and `.next/` are all gitignored.
- **Verification:** `npm run typecheck` went from 13 errors (all unrelated to this plan's files) to a clean exit 0.
- **Committed in:** N/A — gitignored, not committed.

**2. [Rule 1 - Bug] Fixed a false positive in the marker-boundary test's own forbidden-import check**
- **Found during:** Task 3, first run of the new test
- **Issue:** A naive `@/server/theming/(registry|defaults)` substring/regex match flagged `editor-shell.tsx`, `field-renderer.tsx`, and `settings-panel.tsx` — three pre-existing, correct `"use client"` files that write `import type { FieldDescriptor } from "@/server/theming/registry"`. This is a type-only import, erased entirely by `tsc`, and never evaluates the module at runtime — `field-renderer.tsx`'s own comment names this exact reasoning ("It is a literal rather than an import because `src/server/theming/registry.ts` carries `server-only`" for the one *value* it needs). The plan's Task 3 action text did not distinguish type-only from value imports, and a test that failed on this legitimate, pre-existing pattern would be a false positive blocking every future commit that touches those three files.
- **Fix:** Added `isTypeOnlyImportClause()` / `forbiddenValueImports()` to parse each `import … from "@/server/theming/registry"` (or `/defaults`) statement's clause and skip it if it is `import type …` or every named specifier carries its own `type` prefix. Only a genuine value import is now flagged.
- **Files modified:** `tests/unit/theming-marker-boundary.test.ts`
- **Verification:** All 5 assertions pass against the current tree; the "use client" value-import assertion was manually confirmed to still fire correctly (see Deviation 3 below for the negative-control run).
- **Committed in:** `4f6e769` (part of the Task 3 commit; the fix was made before the first commit of this file, so there is no separate "fix" commit)

**3. [Rule 1 - Bug] Named `reveal.tsx` as a documented exception to the section-tree marker check instead of treating it as a violation**
- **Found during:** Task 3, discovering `src/app/s/[slug]/sections/reveal.tsx` is a legitimate `"use client"` file
- **Issue:** The plan's Task 3 action text says literally "No file under `src/app/s/[slug]/sections/**` contains the literal `"use client"`" with no stated exception. `reveal.tsx`, however, is a pre-existing, intentional `"use client"` motion primitive, and its own header comment says so explicitly: `"use client"` is correct here and nowhere else in this directory. Implementing the check literally would make a brand-new contract test fail immediately against known-good, already-shipped code.
- **Fix:** Named `DOCUMENTED_CLIENT_FILE` as a single, explicit exception to the `"use client"`/`server-only` marker-literal assertion only (assertion 3) — not to the forbidden-import assertions (1 and 2), which still cover `reveal.tsx` unexcepted (it does not and should never import `registry.ts`/`defaults.ts`). This follows the same idiom `tests/unit/theming-registry.test.ts` already uses for its one repeatable section (`REPEATABLE_SECTION`) rather than leaving a real, documented exception looking like an undetected gap in the guard.
- **Files modified:** `tests/unit/theming-marker-boundary.test.ts`
- **Verification:** The full suite passes with `reveal.tsx` present and unmodified; a second file made client-marked (not `reveal.tsx`) was not separately tested, but the assertion logic excludes exactly one named path by string equality, so any other file remains covered.
- **Committed in:** `4f6e769`

---

**Total deviations:** 3 auto-fixed (1 blocking/environment, 2 bug fixes in the new test's own detection logic)
**Impact on plan:** All three were necessary either to make the plan's own verification commands runnable at all (Deviation 1) or to make the new contract test correctly distinguish real violations from pre-existing, correct code (Deviations 2-3). No scope creep — no production code beyond what the plan specified was touched.

## Documented Discrepancy (not a deviation, no code changed)

The plan's Task 1 acceptance criteria and the plan-level `<verification>` block both state: `grep -c 'server-only' src/server/theming/schema.ts` returns 0. This is not achievable and was never achievable, including in the Phase 4 baseline before this plan touched the file: the file's own DO-NOT-ADD-`server-only` header comment (lines 3-13, pre-existing) discusses the string `server-only` in prose twice, specifically to warn against adding it. `git show HEAD~3:src/server/theming/schema.ts | grep -c server-only` (i.e. the file before any of this plan's edits) already returns 2, not 0.

The real invariant — confirmed both by manual `grep -n '^import "server-only"'` (no match) and by the new `tests/unit/theming-marker-boundary.test.ts`'s `"keeps schema.ts free of an actual server-only import"` assertion, which strips comments before matching — is that the file carries no literal `import "server-only"` statement. That invariant holds, is now covered by an automated, comment-aware test going forward, and is the property every other acceptance criterion in the plan (and 05-RESEARCH.md Pitfall 2) actually cares about. No code was changed to chase the literal, unattainable grep count.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `SECTION_VARIANTS`, `SectionVariantMap`, `TemplateSectionRef`, `sectionVariantsSchema`, and `variantsForTemplate()` are all in place for 05-02/05-03 to build the template picker and postMessage variant-selection wiring against.
- `TemplateDefinition.segment`/`.minTier` are ready for the picker to sort/filter on; no derivation from `Organization.industry` exists anywhere, and D-03's no-auto-migration invariant is preserved verbatim in `registry.ts`'s header.
- `TEMPLATE_KEYS` is still exactly `["flagship-fashion"]` — 05-08 is where the table grows to 50 rows, each needing its own `segment`, `minTier`, and `sections: TemplateSectionRef[]`.
- The marker-boundary test is a standing regression guard: any future plan that imports a runtime value from `registry.ts`/`defaults.ts` into a client file, or adds a second `"use client"` file under the section tree, will fail `npm run test:unit` immediately rather than surfacing as an editor-route build failure discovered later.
- No blockers for 05-02/05-03, which this plan's `depends_on: []` and wave assignment (Wave 1, alongside 05-02/05-03) already anticipated.

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-04*

## Self-Check: PASSED

All 5 claimed files found on disk (`src/server/theming/schema.ts`, `src/server/theming/registry.ts`, `tests/unit/theming-marker-boundary.test.ts`, `tests/unit/theming-registry.test.ts`, this SUMMARY). All 3 claimed task commits (`97e1e42`, `ee38ec0`, `4f6e769`) found in `git log --oneline --all`.
