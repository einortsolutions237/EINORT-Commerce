---
phase: 05-template-segment-expansion
plan: 10
subsystem: ui
tags: [nextjs, react, typescript, zod, postmessage, theming]

# Dependency graph
requires:
  - phase: 05-template-segment-expansion
    provides: seven new section-variant components and SectionVariantMap/sectionVariantsSchema (plans 05-01, 05-02, 05-05, 05-06, 05-07)
provides:
  - "SectionRenderer accepting a complete SectionVariantMap, read only by literal key"
  - "The live storefront and the editor's preview page both resolving variants from publishedTemplateKey in an RSC"
  - "The preview canvas validating a fourth postMessage field (variants) with independent-refusal fallback to the all-first flagship map"
affects: [05-template-segment-expansion wave 3 remaining plans, any future plan touching section-renderer.tsx or the preview postMessage protocol]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Literal-key-only reads into a mapped SectionVariantMap (never a computed section.type index), documented as a fourth ALL-CAPS rule in section-renderer.tsx's header"
    - "Client-safe flagship-variant fallback built from schema.ts's non-server-only SECTION_VARIANTS, instead of importing the server-only registry.ts function into a client component"

key-files:
  created: []
  modified:
    - "src/app/s/[slug]/sections/section-renderer.tsx"
    - "src/app/s/[slug]/page.tsx"
    - "src/app/s/[slug]/preview/page.tsx"
    - "src/app/s/[slug]/preview/preview-canvas.tsx"

key-decisions:
  - "Built a module-level FLAGSHIP_VARIANTS constant in preview-canvas.tsx from schema.ts's SECTION_VARIANTS (client-safe) rather than importing variantsForTemplate() from the server-only registry.ts, to avoid a server-only leak into the client preview bundle."
  - "A missing OR invalid variants field in a postMessage envelope always resets state to FLAGSHIP_VARIANTS (not 'keep last known good'), matching the plan's literal instruction; this means the preview will show flagship variants on every document/token edit until a future plan teaches editor-shell.tsx's sender to include the variants field — that sender change is out of this plan's files_modified scope and was left untouched."
  - "Rewrote two explanatory comments to avoid the literal substring 'draftTemplateKey' (referring instead to 'the draft template choice'/'a draft column') so the repo-wide grep -rn 'draftTemplateKey' src/app/s/ invariant in the plan's own <verification> block stays true while still documenting the same rationale the plan asked for."

requirements-completed: [TMPL-03]

# Metrics
duration: continuation session ~35min (total plan effort spans an interrupted prior session)
completed: 2026-09-06
---

# Phase 5 Plan 10: Thread the Section Variant Map Through the Render Path Summary

**Closed the Phase 5 cross-wave gap: `SectionRenderer` now takes a `SectionVariantMap`, both storefront routes resolve it from `publishedTemplateKey` in an RSC, and the preview canvas validates it as a fourth independently-degrading `postMessage` field — `npm run build` is clean project-wide again.**

## Performance

- **Started:** prior session (interrupted by API rate limit, mid-Task-1-verification)
- **Completed:** 2026-09-06T04:37:56Z
- **Tasks:** 3/3 completed
- **Files modified:** 4

## Accomplishments

- `SectionRenderer` reads `variants` by literal key only (`variants.hero`, `variants["trust-bar"]`, `variants["product-grid"]`, `variants["editorial-split"]`, `variants.contact`); the file's header carries a new fourth ALL-CAPS rule naming and explaining the forbidden `variants[section.type]` shape.
- `src/app/s/[slug]/page.tsx` resolves `variantsForTemplate(published.publishedTemplateKey)` once above the sections map and passes it to every `SectionRenderer`.
- `src/app/s/[slug]/preview/page.tsx` resolves the same way, from the published key only, and passes an `initialVariants` prop into `PreviewCanvas` so the pane is correct before any message arrives.
- `preview-canvas.tsx` validates a fourth envelope field with `sectionVariantsSchema.safeParse`, at step 3 of the four ordered mitigations, and falls back independently to a client-safe `FLAGSHIP_VARIANTS` map on a bad or absent payload — never blocking the document/tokens update.
- `npm run build` succeeds project-wide (previously blocked on the known cross-wave `variants`-prop gap left by Wave 2).

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread the variants prop through the section renderer** - `fbf7e6e` (feat)
2. **Task 2: Resolve and pass variants on the live storefront and the preview page** - `5f8a993` (feat)
3. **Task 3: Accept the variant map as the fourth validated postMessage field** - `058599b` (feat)

_No plan-metadata commit yet — this SUMMARY and STATE.md updates follow._

## Files Created/Modified

- `src/app/s/[slug]/sections/section-renderer.tsx` - Added `readonly variants: SectionVariantMap` prop, five literal-key reads, fourth header rule.
- `src/app/s/[slug]/page.tsx` - Resolves `variantsForTemplate(published.publishedTemplateKey)` once, passes `variants={variants}` at the sections map.
- `src/app/s/[slug]/preview/page.tsx` - Same resolution from the published key only; passes `initialVariants` into `PreviewCanvas`.
- `src/app/s/[slug]/preview/preview-canvas.tsx` - Adds `initialVariants` prop, `variants` state, a fourth `sectionVariantsSchema.safeParse` step, a client-safe `FLAGSHIP_VARIANTS` fallback constant, and passes `variants` to `SectionRenderer`.

## Decisions Made

See `key-decisions` in frontmatter. In short: (1) built a client-safe flagship-variant fallback from `schema.ts` rather than importing the `server-only` registry into the client canvas; (2) an absent variants field resets to flagship rather than preserving prior state, per the plan's literal wording; (3) rephrased two comments to avoid the literal string `draftTemplateKey` so the plan's own repo-wide grep invariant holds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Acceptance-criteria comment text collided with the plan's own repo-wide invariant grep**
- **Found during:** Task 3 verification (running the plan's own acceptance-criteria greps)
- **Issue:** The plan's Task 3 action explicitly asks to "record why it travels by postMessage rather than by a draft read" in the header comment, and Task 2's analogous instruction for `preview/page.tsx` implied the same. A first draft of both comments used the literal identifier `draftTemplateKey` to be precise about which column is not read. That satisfied the prose instruction but violated the plan's own `<verification>` block invariant (`grep -rn 'draftTemplateKey' src/app/s/` must return no matches) and the Task 2/Task 3 acceptance criteria (`grep -c 'draftTemplateKey' ...` must return 0 in both `preview/page.tsx` and `preview-canvas.tsx`).
- **Fix:** Reworded both comments to refer to "the draft template choice" / "a draft column" instead of the literal field name, preserving the same rationale without the forbidden substring.
- **Files modified:** `src/app/s/[slug]/preview/page.tsx`, `src/app/s/[slug]/preview/preview-canvas.tsx`
- **Verification:** `grep -rn 'draftTemplateKey' src/app/s/` now returns no matches; `npm run typecheck`, `npm run lint`, `npm run build` all still pass.
- **Committed in:** `5f8a993`, `058599b` (part of the respective task commits — caught before the initial commit, not as a follow-up fix)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug/contradiction inside the plan's own instructions, resolved in favor of the plan's explicit machine-checked verification block over its looser prose wording)
**Impact on plan:** No scope creep; the fix is a wording change only, no behavior changed.

## Issues Encountered

- **Acceptance-criteria grep imprecision (not fixed, documented only):** Two of the plan's literal `grep -c` acceptance criteria do not hold exactly as written against the final, correctly-behaving code, because of pre-existing/plan-mandated prose that legitimately contains the "forbidden" substring as documentation:
  - `grep -c 'variants\[section.type\]' section-renderer.tsx` returns **2**, not 0 — both matches are inside the Task-1-mandated header comment that documents the wrong shape verbatim (the plan's own action text says "State both the wrong shape and why it is wrong"). No code path uses a computed index; verified by reading the switch body and by the manual test below.
  - `grep -c 'ONLY data the storefront already serves publicly' preview/page.tsx` returns **0**, not 1 — the phrase is present but wraps across two comment lines (`... serves ONLY` / `data the storefront already serves publicly ...`), a pre-existing line-wrap from a prior phase's file that this plan was instructed to preserve verbatim, not reflow. Confirmed present via `grep -n "already serves publicly"`.
  Neither affects behavior; both are acceptance-criteria wording gaps against the codebase's own established comment-wrapping and self-documenting-anti-pattern conventions. Not changed, to avoid stretching prose past the project's line-wrap style or diluting the required "state the wrong shape" documentation.
- **Manual computed-index test contradicted the plan's stated expectation:** Task 1's acceptance criteria asks to confirm that "replacing one literal read with `variants[section.type]` produces a typecheck error." Performed exactly that (temporarily, on the `hero` arm) and re-ran `tsc --noEmit`: it exited 0, no error. This is because TypeScript's control-flow narrowing on the `switch (section.type)` discriminant narrows `section.type` itself to the literal `"hero"` inside that case body, and indexing a homomorphic mapped type (`SectionVariantMap`) with a literal key type resolves to exactly that key's value type — identical to `variants.hero`. The widening risk the plan's header describes is real for a `Record`-keyed *component* registry (`REGISTRY[section.type].Component(settings)`, where the correlation between two independently-mapped things is lost), but does not reproduce for a single mapped-type property read in this TypeScript version. The change was reverted immediately after the test; the literal-key form was kept regardless, as it remains the correct and clearer pattern the plan specifies.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Phase 5 cross-wave gap (section-renderer needing `variants` before templates render distinctly) is closed. `npm run build`, `npm run lint`, `npm run typecheck`, and `npm run test:unit` (571/571) all pass project-wide.
- Not yet wired, and explicitly out of this plan's scope (not in its `files_modified` list): the editor's `editor-shell.tsx` postMessage sender does not yet include a `variants` field on its `einort:preview-doc` posts. Until a future plan adds it, the preview canvas will show the `FLAGSHIP_VARIANTS` fallback on every live-edit repaint rather than the merchant's actual draft template's variants, even though the published route and the very first paint of the preview canvas both already show the correct published variants. This is a known, intentional gap for whichever plan wires template switching into the editor rail.

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-06*

## Self-Check: PASSED

All four modified files and this SUMMARY.md confirmed present on disk; all three task commit hashes (`fbf7e6e`, `5f8a993`, `058599b`) confirmed present in `git log`.
