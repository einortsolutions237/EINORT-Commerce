---
phase: 05-template-segment-expansion
plan: 06
subsystem: ui
tags: [react, nextjs, tailwind, theming, section-renderer, storefront]

# Dependency graph
requires:
  - phase: 05-template-segment-expansion
    provides: "05-01's SECTION_VARIANTS registry and SectionVariant<T> helper type in src/server/theming/schema.ts"
provides:
  - "TrustBarSection two-arm variant switch (band|strip)"
  - "TrustBarStrip component: hairline no-wash trust bar row"
  - "ContactSection two-arm variant switch (band|card)"
  - "ContactCard component: floated bordered card contact section"
affects: ["05-10 (threads real variant prop through section-renderer.tsx)", "05-template-catalog assembly plans that reference trust-bar:strip or contact:card"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exhaustive two-arm variant switch with no default arm and an explicit `: ReactElement` return annotation, so an unhandled variant is a compile error (TS2366), never a blank render — same discipline as section-renderer.tsx applied one level down"
    - "`variant` prop defaults to the section type's first SECTION_VARIANTS member (`\"band\"`) so the new switch keeps compiling against the existing single-argument call site in section-renderer.tsx until 05-10 threads the real variant through"

key-files:
  created:
    - src/app/s/[slug]/sections/trust-bar-strip.tsx
    - src/app/s/[slug]/sections/contact-card.tsx
  modified:
    - src/app/s/[slug]/sections/trust-bar-section.tsx
    - src/app/s/[slug]/sections/contact-section.tsx

key-decisions:
  - "ContactSection's new variant switch mirrors TrustBarSection's switch exactly (same defaulting rationale, same no-default-arm/ReactElement discipline) for consistency across both section types touched in this plan"
  - "Deleted each variant's switch arm once to confirm TS2366 lands, then reverted — verification step only, not a permanent code change"

patterns-established:
  - "Two-arm exhaustive variant switch per section type, band variant kept as an unexported local component moved verbatim from the prior single-variant implementation, new variant as a separate sibling file"

requirements-completed: [TMPL-03]

# Metrics
duration: ~25min (continuation session; original session interrupted by rate limit after both new component files were substantially complete)
completed: 2026-09-06
---

# Phase 05 Plan 06: Trust-bar strip and contact card variants Summary

**Added `trust-bar:strip` (hairline no-wash icon+heading row) and `contact:card` (floated bordered card on a zinc wash) as new section-type variants behind exhaustive two-arm switches, keeping both section types' existing settings shape and schema caps unchanged.**

## Performance

- **Duration:** ~25 min this continuation session (prior session did the bulk of the two new component files before hitting a rate limit)
- **Completed:** 2026-09-06
- **Tasks:** 2/2 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `TrustBarSection` now dispatches on `variant: SectionVariant<"trust-bar">` via an exhaustive `band | strip` switch, no `default` arm, `: ReactElement` return type
- New `TrustBarStrip`: `border-y border-border bg-background` hairline row, icon (`size-5`) + heading only (no body text, no accent, no wash), hidden `md:block` separators between items
- `ContactSection` now dispatches on `variant: SectionVariant<"contact">` via an exhaustive `band | card` switch, no `default` arm, `: ReactElement` return type
- New `ContactCard`: `bg-secondary` wash outer field with a `rounded border border-border bg-background` card floated at the storefront radius, identical heading/body/CTA role stack to `band`, accent spent only on the CTA, never-a-disabled-button rule preserved for the no-WhatsApp-configured branch

## Task Commits

Each task was committed atomically:

1. **Task 1: Split trust-bar into a variant switch plus the strip variant** - `7791777` (feat)
2. **Task 2: Split contact into a variant switch plus the card variant** - `1708040` (feat)

_No separate plan-metadata commit yet — this summary/final commit follows below._

## Files Created/Modified
- `src/app/s/[slug]/sections/trust-bar-section.tsx` - `TrustBarBand` (Phase 4 body, moved verbatim) plus new `TrustBarSection` two-arm variant switch
- `src/app/s/[slug]/sections/trust-bar-strip.tsx` - new `TrustBarStrip` component (hairline, no wash, no body text)
- `src/app/s/[slug]/sections/contact-section.tsx` - `ContactBand` (Phase 4 body, moved verbatim) plus new `ContactSection` two-arm variant switch
- `src/app/s/[slug]/sections/contact-card.tsx` - new `ContactCard` component (floated bordered card on zinc wash)

## Decisions Made
- `ContactSection`'s variant switch was written to mirror `TrustBarSection`'s switch exactly, including the `variant = "band"` default rationale, so both section types touched by this plan read identically to a future maintainer.
- `section-renderer.tsx` was left untouched — threading a real `variant` prop through the renderer's call sites is explicitly plan 05-10's job, and the default parameter value keeps this plan's switches compiling against the current single-argument call sites in the interim (matches the pattern `TrustBarSection` established in the prior session before the rate-limit interruption).

## Deviations from Plan

None - plan executed exactly as written. The prior session's uncommitted work (both new component files, and `trust-bar-section.tsx`'s switch) matched the plan's spec on review and required no changes; this session's only code addition was `contact-section.tsx`'s switch, written to the plan's exact spec.

## Issues Encountered

**Acceptance-criteria grep false positives (not a code defect):** Two of the plan's literal `grep -c` acceptance checks on `contact-card.tsx` return a nonzero count that looks like a failure at first glance:
- `grep -c 'rounded-lg' contact-card.tsx` → 1 (expected 0)
- `grep -c 'disabled' contact-card.tsx` → 1 (expected 0)

Both matches are inside the file's header JSDoc comment, which explicitly documents *why* `rounded-lg` and a disabled button are avoided (prose like "never `rounded-lg`" and "never a dead one... disabled or dead-linking"), not actual code. Re-running each grep with the same comment-line exclusion the plan itself uses for `trust-bar-strip.tsx`'s `.body` check (`grep -v '^\s*\*\|^\s*//' contact-card.tsx | grep -c '...'`) confirms both are 0 in actual code. The component contains no `rounded-lg` class and no `disabled` attribute anywhere outside prose. Treated as a verification nuance, not a fix — the code satisfies the acceptance criteria's intent.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both new variants (`trust-bar:strip`, `contact:card`) are fully implemented, typechecked, linted, and covered by the plan's three named test files (30/30 passing).
- `section-renderer.tsx` still calls both sections with a single argument (no `variant` threaded) — this is by design per the plan; 05-10 is the plan responsible for wiring real per-instance variants through the renderer.
- No blockers for downstream plans that reference these two variants in the template catalog.

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-06*

## Self-Check: PASSED

All created/modified files found on disk; both task commits (`7791777`, `1708040`) found in `git log --oneline --all`.
