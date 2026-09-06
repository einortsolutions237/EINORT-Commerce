---
phase: 05-template-segment-expansion
plan: 08
subsystem: theming
tags: [templates, registry, zod, typescript, storefront]

# Dependency graph
requires:
  - phase: 05-template-segment-expansion
    provides: "05-01's original TEMPLATE_KEYS/TEMPLATES single-row registry, 05-03's strings.templates namespace typed against Partial<Record<TemplateKey, Partial<FlagshipCopy>>>"
provides:
  - "TEMPLATE_KEYS/TEMPLATES grown to 50 rows across all six merchant segments, drawn from exactly 25 distinct skeletons"
  - "Six src/server/theming/templates/*.ts segment modules with 49 named document/token builder pairs (98 functions)"
  - "TEMPLATE_DEFAULTS dispatch plus templateDefaultDocument(key)/templateDefaultTokens(key) in defaults.ts"
  - "The full 50-row key/segment/minTier/skeleton allocation table (below) for plans 05-12 through 05-17 to read their assignments from"
affects: [05-12, 05-13, 05-14, 05-15, 05-16, 05-17, 05-20]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional-chained strings.templates[\"<key>\"]?.<path> ?? \"\" as the one copy-read mechanism every segment builder uses, bridging an as-yet-empty copy namespace until Wave 3"
    - "TEMPLATE_DEFAULTS as a record of builder FUNCTIONS (never documents), matching the fresh-object-per-call rule flagshipDefaultDocument() established"

key-files:
  created:
    - src/server/theming/templates/fashion-apparel.ts
    - src/server/theming/templates/electronics.ts
    - src/server/theming/templates/beauty-cosmetics.ts
    - src/server/theming/templates/grocery-food.ts
    - src/server/theming/templates/furniture-home.ts
    - src/server/theming/templates/general-retail.ts
  modified:
    - src/server/theming/registry.ts
    - src/server/theming/defaults.ts
    - tests/unit/theming-registry.test.ts

key-decisions:
  - "One skeleton (hero:full-bleed|product-grid:grid, S24) is shared across two segments (electronics-byte and retail-district) rather than confined to one segment, because electronics (9 templates) and general-retail (9 templates) are both odd counts and every skeleton in a 25-skeleton/50-template library must carry exactly 2 templates (forced by the acceptance criteria's max-2-per-skeleton plus exactly-50-total constraint)"
  - "Token builders' primaryAccent/secondaryAccent reuse DEFAULT_PRIMARY_ACCENT/DEFAULT_SECONDARY_ACCENT (the same neutral defaults flagshipDefaultTokens() ships) rather than reading from strings.templates, because FlagshipCopy carries no accent field - per-template accent differentiation is Wave 3's job alongside the real copy"
  - "DEFAULT_OVERLAY_OPACITY and DEFAULT_ITEM_COUNT exported from defaults.ts (previously module-private) so the 49 builders reuse them per the plan's explicit instruction, accepting the resulting defaults.ts <-> templates/*.ts circular import (safe here because both sides only reference the circular import inside function bodies, never at module-eval time)"

requirements-completed: [TMPL-03, TMPL-04, TMPL-05]

# Metrics
duration: ~55min (resumed after a weekly rate limit; this session covered Task 1 completion plus Tasks 2-3 in ~13min of commits)
completed: 2026-09-06
---

# Phase 5 Plan 08: Declare the 50-template registry and stand up the default-document dispatch Summary

**Registry grown from 1 to 50 templates across 25 skeletons (6 segments, 10/15/25 tier split), six new segment builder modules with 49 document/token pairs reading copy through `strings.templates[key]?.path ?? ""`, and a `TEMPLATE_DEFAULTS` dispatch that degrades any unrecognised key to the flagship.**

## Performance

- **Duration:** ~13 min for this session's three commits (continuation of a prior agent that had begun Task 1's registry.ts edit before hitting a weekly rate limit)
- **Started (this session):** 2026-09-06T00:33:00+01:00 (approx, environment restoration + verification)
- **Completed:** 2026-09-06T00:58:22+01:00
- **Tasks:** 3/3 complete
- **Files modified:** 9 (2 modified registry/defaults + 6 new template modules + 1 test file fix)

## Accomplishments

- `TEMPLATE_KEYS`/`TEMPLATES` grown from the single `flagship-fashion` row to exactly 50 rows, drawn from exactly 25 distinct skeletons (none used more than twice), tier counts exactly 10 starter / 15 business / 25 professional, every one of the six `INDUSTRY_SEGMENTS` covered by at least one starter row, and the 10 starter rows spanning all 10 of their own distinct skeletons
- Six `src/server/theming/templates/*.ts` modules (one per `INDUSTRY_SEGMENTS` id) exposing 49 named document/token builder pairs (98 functions), each contract-complete but content-minimal, reading copy via the one sanctioned `strings.templates["<key>"]?.<path> ?? ""` pattern
- `TEMPLATE_DEFAULTS` + `templateDefaultDocument()`/`templateDefaultTokens()` added to `defaults.ts`, dispatching all 50 keys to builder functions (never documents) and degrading an unrecognised key to the flagship's own default, matching `variantsForTemplate()`'s existing degrade posture
- `flagship-fashion`'s row and default document are byte-unchanged: same segment, `minTier: "starter"`, the same five-section locked order

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare the 25 skeletons and 50 template rows** - `ddc7732` (feat)
2. **Task 2: Create the six segment builder modules with 49 named function contracts** - `f7924f3` (feat)
3. **Task 3: Add the TEMPLATE_DEFAULTS dispatch to defaults.ts** - `ec9f74f` (feat, includes a Rule 1 test fix)

_No separate plan-metadata commit was made in this session; this SUMMARY and STATE/ROADMAP updates are the final commit per the orchestrator's process._

## Files Created/Modified

- `src/server/theming/registry.ts` - `TEMPLATE_KEYS` (50 entries) and `TEMPLATES` (50 rows), generalized LOCKED-order and D-03 header comments
- `src/server/theming/defaults.ts` - exported `DEFAULT_OVERLAY_OPACITY`/`DEFAULT_ITEM_COUNT`; added `TEMPLATE_DEFAULTS`, `templateDefaultDocument()`, `templateDefaultTokens()`; `flagshipDefaultDocument()`/`flagshipDefaultTokens()` unchanged
- `src/server/theming/templates/fashion-apparel.ts` - 7 document/token pairs (fashion-classic, fashion-edit, fashion-muse, fashion-studio, fashion-house, fashion-runway, fashion-loft)
- `src/server/theming/templates/electronics.ts` - 9 document/token pairs
- `src/server/theming/templates/beauty-cosmetics.ts` - 8 document/token pairs
- `src/server/theming/templates/grocery-food.ts` - 8 document/token pairs
- `src/server/theming/templates/furniture-home.ts` - 8 document/token pairs
- `src/server/theming/templates/general-retail.ts` - 9 document/token pairs
- `tests/unit/theming-registry.test.ts` - generalized the Phase-4 "exactly one template" assertion to check all 50 rows

## The Full 50-Row Allocation Table

Skeleton ids (`S0`…`S24`) are this plan's own labels, not a stored value — they identify each distinct `sections` array by its `{type}:{variant}` join. Plans 05-12 through 05-17 read their segment's assignment from this table; the skeleton string in parentheses is what each pair of sibling templates shares byte-for-byte in `TEMPLATES[key].sections`.

| Key | Segment | Min tier | Skeleton |
|---|---|---|---|
| `flagship-fashion` | fashion-apparel | starter | S0 (hero:full-bleed\|trust-bar:band\|product-grid:grid\|editorial-split:split\|contact:band) |
| `fashion-classic` | fashion-apparel | professional | S0 (hero:full-bleed\|trust-bar:band\|product-grid:grid\|editorial-split:split\|contact:band) |
| `fashion-edit` | fashion-apparel | starter | S1 (hero:stack\|product-grid:showcase) |
| `fashion-muse` | fashion-apparel | professional | S1 (hero:stack\|product-grid:showcase) |
| `fashion-studio` | fashion-apparel | business | S2 (hero:split\|product-grid:dense) |
| `fashion-house` | fashion-apparel | professional | S2 (hero:split\|product-grid:dense) |
| `fashion-runway` | fashion-apparel | business | S3 (hero:full-bleed\|product-grid:grid\|contact:card) |
| `fashion-loft` | fashion-apparel | professional | S3 (hero:full-bleed\|product-grid:grid\|contact:card) |
| `electronics-circuit` | electronics | starter | S4 (hero:stack\|product-grid:dense\|contact:card) |
| `electronics-signal` | electronics | professional | S4 (hero:stack\|product-grid:dense\|contact:card) |
| `electronics-grid` | electronics | starter | S5 (hero:split\|trust-bar:strip\|product-grid:showcase) |
| `electronics-current` | electronics | professional | S5 (hero:split\|trust-bar:strip\|product-grid:showcase) |
| `electronics-pulse` | electronics | business | S6 (hero:full-bleed\|editorial-split:banner\|product-grid:dense) |
| `electronics-volt` | electronics | professional | S6 (hero:full-bleed\|editorial-split:banner\|product-grid:dense) |
| `electronics-module` | electronics | business | S7 (hero:stack\|trust-bar:band\|product-grid:grid) |
| `electronics-frame` | electronics | business | S7 (hero:stack\|trust-bar:band\|product-grid:grid) |
| `electronics-byte` | electronics | professional | S24 (hero:full-bleed\|product-grid:grid) — **shared with `retail-district`** |
| `beauty-glow` | beauty-cosmetics | starter | S8 (hero:split\|product-grid:showcase\|editorial-split:split) |
| `beauty-veil` | beauty-cosmetics | professional | S8 (hero:split\|product-grid:showcase\|editorial-split:split) |
| `beauty-bloom` | beauty-cosmetics | starter | S9 (hero:full-bleed\|trust-bar:band\|product-grid:dense\|contact:card) |
| `beauty-satin` | beauty-cosmetics | professional | S9 (hero:full-bleed\|trust-bar:band\|product-grid:dense\|contact:card) |
| `beauty-radiance` | beauty-cosmetics | business | S10 (hero:stack\|product-grid:grid\|trust-bar:strip\|contact:band) |
| `beauty-luxe` | beauty-cosmetics | professional | S10 (hero:stack\|product-grid:grid\|trust-bar:strip\|contact:band) |
| `beauty-aura` | beauty-cosmetics | business | S11 (hero:split\|editorial-split:banner\|product-grid:showcase\|contact:card) |
| `beauty-muse` | beauty-cosmetics | professional | S11 (hero:split\|editorial-split:banner\|product-grid:showcase\|contact:card) |
| `grocery-market` | grocery-food | starter | S12 (hero:full-bleed\|product-grid:dense\|trust-bar:band\|editorial-split:split) |
| `grocery-harvest` | grocery-food | professional | S12 (hero:full-bleed\|product-grid:dense\|trust-bar:band\|editorial-split:split) |
| `grocery-pantry` | grocery-food | business | S13 (hero:stack\|editorial-split:banner\|trust-bar:strip\|product-grid:grid) |
| `grocery-fresh` | grocery-food | professional | S13 (hero:stack\|editorial-split:banner\|trust-bar:strip\|product-grid:grid) |
| `grocery-orchard` | grocery-food | business | S14 (hero:split\|trust-bar:band\|product-grid:dense\|contact:card) |
| `grocery-grove` | grocery-food | professional | S14 (hero:split\|trust-bar:band\|product-grid:dense\|contact:card) |
| `grocery-cellar` | grocery-food | business | S15 (hero:full-bleed\|contact:card\|product-grid:showcase\|editorial-split:banner) |
| `grocery-larder` | grocery-food | professional | S15 (hero:full-bleed\|contact:card\|product-grid:showcase\|editorial-split:banner) |
| `furniture-loom` | furniture-home | starter | S16 (hero:stack\|product-grid:showcase\|contact:card\|trust-bar:strip) |
| `furniture-grain` | furniture-home | professional | S16 (hero:stack\|product-grid:showcase\|contact:card\|trust-bar:strip) |
| `furniture-oak` | furniture-home | starter | S17 (hero:full-bleed\|trust-bar:band\|product-grid:grid\|editorial-split:banner\|contact:card) |
| `furniture-hearth` | furniture-home | professional | S17 (hero:full-bleed\|trust-bar:band\|product-grid:grid\|editorial-split:banner\|contact:card) |
| `furniture-timber` | furniture-home | business | S18 (hero:split\|trust-bar:strip\|product-grid:dense\|editorial-split:banner\|contact:band) |
| `furniture-haven` | furniture-home | professional | S18 (hero:split\|trust-bar:strip\|product-grid:dense\|editorial-split:banner\|contact:band) |
| `furniture-nook` | furniture-home | business | S19 (hero:stack\|editorial-split:split\|trust-bar:band\|product-grid:showcase\|contact:card) |
| `furniture-loft` | furniture-home | professional | S19 (hero:stack\|editorial-split:split\|trust-bar:band\|product-grid:showcase\|contact:card) |
| `retail-corner` | general-retail | starter | S20 (hero:full-bleed\|product-grid:dense\|trust-bar:strip\|editorial-split:banner\|contact:band) |
| `retail-emporium` | general-retail | professional | S20 (hero:full-bleed\|product-grid:dense\|trust-bar:strip\|editorial-split:banner\|contact:band) |
| `retail-bazaar` | general-retail | business | S21 (hero:split\|product-grid:showcase\|editorial-split:split\|trust-bar:strip\|contact:card) |
| `retail-mercantile` | general-retail | professional | S21 (hero:split\|product-grid:showcase\|editorial-split:split\|trust-bar:strip\|contact:card) |
| `retail-general` | general-retail | business | S22 (hero:stack\|trust-bar:strip\|product-grid:grid\|editorial-split:banner\|contact:band) |
| `retail-provisions` | general-retail | professional | S22 (hero:stack\|trust-bar:strip\|product-grid:grid\|editorial-split:banner\|contact:band) |
| `retail-market` | general-retail | business | S23 (hero:full-bleed\|editorial-split:split\|product-grid:dense\|trust-bar:band\|contact:card) |
| `retail-trading` | general-retail | professional | S23 (hero:full-bleed\|editorial-split:split\|product-grid:dense\|trust-bar:band\|contact:card) |
| `retail-district` | general-retail | professional | S24 (hero:full-bleed\|product-grid:grid) — **shared with `electronics-byte`** |

**Verified counts:** 50 unique keys; 25 distinct skeletons, each used by exactly 2 templates; tiers 10 starter / 15 business / 25 professional; every segment has ≥1 starter row; the 10 starter rows span all 10 of their own distinct skeletons (≥8 required).

## Decisions Made

- **The shared skeleton (S24).** Electronics (9 templates) and general-retail (9 templates) are both odd counts under the plan's per-segment allocation table, while every skeleton in a 25×2=50 library must carry exactly 2 templates (forced arithmetic: 25 skeletons × up to 2 templates each = at most 50, and the plan requires exactly 50, so every skeleton must be used exactly twice, no slack). Two segments with odd counts can only be reconciled by sharing one skeleton between them. `electronics-byte` and `retail-district` both use the minimal `hero:full-bleed|product-grid:grid` skeleton (S24) — the simplest, most "stripped down" skeleton in the library, chosen deliberately for the shared slot since it carries the least segment-specific character to blur.
- **Accent fields degrade to the flagship's neutral defaults, not to `strings.templates`.** The plan's Task 2 prose describes all four `ThemeTokens` fields as reading "from the same namespace with the same `?? \"\"` pattern," but `FlagshipCopy` (the type `strings.templates[key]` is checked against) has no `primaryAccent`/`secondaryAccent` field — accent authoring was never part of the copy namespace `strings.templates` splices together. `primaryAccent`/`secondaryAccent` therefore reuse `DEFAULT_PRIMARY_ACCENT`/`DEFAULT_SECONDARY_ACCENT` (the same values `flagshipDefaultTokens()` already uses), which is the only type-safe reading of the instruction; `announcementText`/`footerTagline` do use the `strings.templates[key]?.path ?? ""` pattern as written. Per-template accent differentiation (the "accent" axis of TMPL-05's distinctiveness test) is Wave 3's job, arriving alongside the real copy in plans 05-12 through 05-17.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported `DEFAULT_OVERLAY_OPACITY` and `DEFAULT_ITEM_COUNT` from `defaults.ts`**
- **Found during:** Task 2
- **Issue:** Both constants were module-private (`const`, no `export`) in `defaults.ts`. The plan's Task 2 explicitly directs the 49 builders to "reuse `DEFAULT_OVERLAY_OPACITY` and `DEFAULT_ITEM_COUNT` from `defaults.ts` rather than restating their values," which is impossible without exporting them.
- **Fix:** Added `export` to both declarations; no value change. This creates a circular import (`defaults.ts` → `templates/*.ts` → `defaults.ts`), which is safe here because both sides reference the circular import only inside function bodies (deferred to call time), never at module-evaluation time.
- **Files modified:** `src/server/theming/defaults.ts`
- **Verification:** `npm run typecheck` and `npm run lint` both exit 0 with the circular import in place; `npx tsx` smoke tests confirm every builder resolves correctly.
- **Committed in:** `f7924f3` (Task 2 commit)

**2. [Rule 1 - Bug] Generalized `theming-registry.test.ts`'s Phase-4 "exactly one template" assertion**
- **Found during:** Task 3 (running the plan's specified `npx vitest run tests/unit/theming-registry.test.ts` verification command)
- **Issue:** `it("declares one template whose sections are all real section types", ...)` hardcoded `expect(Object.keys(TEMPLATES)).toEqual(["flagship-fashion"])` — a Phase 4 invariant this plan's Task 1 legitimately supersedes by growing `TEMPLATES` to 50 rows.
- **Fix:** Renamed the test to "declares fifty templates whose sections are all real section types," changed the count assertion to `.length === 50`, and looped the section-type-validity check over all 50 keys instead of just the flagship. The flagship-specific drift/mutation tests elsewhere in the same file were untouched.
- **Files modified:** `tests/unit/theming-registry.test.ts`
- **Verification:** `npx vitest run tests/unit/theming-registry.test.ts --reporter=dot` — 19/19 pass. `npm run test:unit` — 571/571 pass (full unit suite, no other regressions).
- **Committed in:** `ec9f74f` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes were necessary for the plan's own tasks to typecheck/pass as specified. No scope creep — no file outside the plan's declared `files_modified` list was touched, and the test fix only removed a now-incorrect hardcoded assumption, not new coverage.

## Issues Encountered

- **Environment restoration (pre-existing, not part of any task).** The worktree's `node_modules`, `src/generated/prisma`, `.env.local`, and `.env.test` were already present and current (verified byte-identical `StorefrontTheme` model, including the `draftTemplateKey`/`publishedTemplateKey` split, against the main checkout). However, `next-env.d.ts` and `.next/dev/types/*.d.ts` (both gitignored, Next-generated) were missing from the worktree, which made `next/image`'s global module augmentation invisible to `tsc` and produced three unrelated `Cannot find module '@/assets/brand/einort-logo.png'` errors in files this plan never touches. Copied both from the main checkout (real files, not junctions) to restore the dev-time type declarations; this is a build-artifact restoration, not a source change, and nothing under this restoration was committed (both paths are gitignored).
- **My own verification script bug, not a code bug.** An early check compared `PageDocument.sections[].variant` against the registry's `TemplateSectionRef.variant`, but `SectionInstance` (the document shape) deliberately carries no `variant` field — variant is a template-level property (`TemplateSectionRef`), read separately via `variantsForTemplate()` at render time, per `schema.ts`'s own header ("A section's rendering variant is a property of the TEMPLATE, not of the document a merchant edits"). Fixed the check to compare section `type` order only; the builders themselves were correct throughout.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The full 50-row allocation table above is what plans 05-12 through 05-17 (Wave 3, the six segment copy-authoring plans) read their key/segment/tier/skeleton assignment from — no further derivation needed on their part.
- Every one of the 49 non-flagship builders currently returns copy that resolves to `""` for every field not yet under `strings.templates[key]`, by design (the `?? ""` bridge). This is expected Wave-2 state, not a stub bug: plan 05-20's generalized default-document parse test is where an empty string reaching a live document becomes a red build, and Wave 3 is where real copy lands under the exact same access pattern already wired here.
- Accent values (`primaryAccent`/`secondaryAccent`) for all 49 non-flagship templates currently default to the same neutral `DEFAULT_PRIMARY_ACCENT`/`DEFAULT_SECONDARY_ACCENT` pair the flagship uses. Wave 3 plans that want per-template accent differentiation (the "accent" axis of TMPL-05's distinctiveness test) will need to decide where per-template accent values are authored — `strings.templates`'s `FlagshipCopy`-derived shape does not currently have a slot for them, so this is worth flagging explicitly to whichever plan owns that decision.
- No blockers. `npm run typecheck`, `npm run lint`, and `npm run test:unit` (571/571) all pass on the final state of this plan's three commits.

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-06*

## Self-Check: PASSED

All 10 created/modified files confirmed present on disk; all 3 task commit hashes (`ddc7732`, `f7924f3`, `ec9f74f`) confirmed in `git log --all`.
