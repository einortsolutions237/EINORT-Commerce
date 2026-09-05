---
phase: 05-template-segment-expansion
plan: 09
subsystem: ui
tags: [react, tailwind, base-ui, radio-group, theming, template-picker]

# Dependency graph
requires:
  - phase: 05-01
    provides: TemplateSectionRef / SectionType / SectionVariant vocabulary in src/server/theming/schema.ts
  - phase: 05-03
    provides: strings.branding.template* and strings.editor.template* copy keys, per-segment template namespaces
provides:
  - TemplateThumbnail — zero-byte geometric wireframe rendered from a template's own {type, variant}[] section list
  - TemplatePicker — the shared radio-group template grid (tier-lock, current-badge, show-all/sort affordances) used by both onboarding and the editor
affects: [05-onboarding-branding-wiring, 05-editor-change-template-action]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Geometric-render-from-skeleton thumbnails instead of stored template screenshots (05-RESEARCH.md Pattern 6)"
    - "One presentational component serving two surfaces entirely through props, never forking on surface"
    - "Sort-never-filter list transforms for industry-matched recommendations (D-05)"

key-files:
  created:
    - src/components/theming/template-thumbnail.tsx
    - src/components/theming/template-picker.tsx
  modified: []

key-decisions:
  - "TemplateTile.key is typed as a plain string rather than the registry's TemplateKey type, keeping template-picker.tsx at zero textual reference (even type-only) to the server-only registry module."
  - "Tier display names in the locked-card chip/tooltip are read from strings.plan[minTier].name (the existing canonical tier-name source) rather than a new hardcoded capitalization map."
  - "Placeholder interpolation follows the codebase's existing .replace(\"{token}\", value) convention (see section-list.tsx, claim-card.tsx) rather than treating strings.branding.templateLockedChip etc. as callable functions."
  - "The locked-tier chip reuses the storefront out-of-stock badge's exact visual language (Badge variant=\"outline\", border-border bg-background text-foreground) per the UI-SPEC's explicit instruction to reuse rather than invent a new badge colour."
  - "The show-all/recommended toggle is rendered as a real <button type=\"button\"> styled with Label's typographic classes (text-sm font-medium) plus text-primary underline, rather than the non-interactive <label> tag Label renders as, since it is a JS state toggle with no associated form control."

patterns-established:
  - "TemplateTile as the flattened, marker-free data shape a Server Component hands to a client-side picker component — precedent for any future template-registry-derived client prop."

requirements-completed: [TMPL-04]

# Metrics
duration: resumed session (~1h across two executor sessions; this session ~35min)
completed: 2026-09-05
---

# Phase 5 Plan 09: Template Thumbnail + Picker Summary

**Zero-byte geometric template thumbnail (all twelve type:variant shapes via exhaustive switch) plus the one shared radio-group picker grid that serves both the onboarding branding step and the editor's "Change template" panel through props alone.**

## Performance

- **Duration:** Resumed after a session rate-limit interruption; Task 1 (`template-thumbnail.tsx`) was already written by the prior executor and needed only verification; Task 2 (`template-picker.tsx`) was written and verified in this session.
- **Completed:** 2026-09-05T23:48:07Z
- **Tasks:** 2/2
- **Files modified:** 2 (both new)

## Accomplishments

- `TemplateThumbnail` renders all twelve `{type, variant}` shapes from a template's own `TemplateSectionRef[]` through an exhaustive nested `switch` (no default arm — a thirteenth variant is a compile error), with exactly one inline `backgroundColor` accent block and zero image bytes downloaded.
- `TemplatePicker` composes the installed `radio-group`/`badge`/`tooltip`/`label` primitives into the exact grid the industry-tile precedent in `branding-form.tsx` established (`grid grid-cols-2 gap-4 sm:grid-cols-3`, whole-tile tap target, identical selected-state ring language), driven entirely by props so the onboarding and editor surfaces read from one component that cannot fork.
- Segment-based recommendation sorting is implemented as a provably pure reorder (`sortedBySegment`) — `tiles.length` is preserved on every call, satisfying D-05's permanent ban on industry mechanically filtering the reachable template set.
- The current-template card is inert by construction: `onValueChange` short-circuits before calling the parent's change handler whenever the clicked key equals `currentKey`, closing the re-selection-as-a-gate-bypass path named in the plan's threat register (T-05-35).

## Task Commits

1. **Task 1: Build the geometric template thumbnail** - `33f4d4a` (feat) — already implemented by the prior executor; this session reviewed it against the full spec, ran its verify gate (typecheck/lint/`surface-token-isolation.test.ts`/`theming-marker-boundary.test.ts`), found it correct, and committed it.
2. **Task 2: Build the shared template picker grid** - `5731e4a` (feat) — implemented and verified in this session (typecheck/lint/`npm run test:unit`, 571/571 passing).

**Plan metadata:** committed separately after this summary (see final commit below).

## Files Created/Modified

- `src/components/theming/template-thumbnail.tsx` - Geometric, marker-free wireframe component; twelve exhaustive variant shapes, one accent block, `aria-hidden`, no text nodes.
- `src/components/theming/template-picker.tsx` - Shared `TemplatePicker` component and `TemplateTile` type; tier-lock, current-badge, segment-sort and show-all affordances, all prop-driven.

## Decisions Made

See `key-decisions` in the frontmatter above for the five implementation-level decisions made where the plan's prose left an implementation detail open (string-interpolation convention, tier-name source, chip visual reuse, toggle element choice, and keeping `TemplateTile.key` as `string`). None of these are scope changes — each resolves an ambiguity using an existing, already-established codebase convention rather than inventing a new one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored `.next/` and `next-env.d.ts` into the worktree**
- **Found during:** Task 1 verification (re-run after resuming from the session interruption)
- **Issue:** The worktree was missing both `.next/types/**` (Next 16's generated `PageProps`/`LayoutProps` ambient types) and `next-env.d.ts` (the ambient module declarations that let TypeScript resolve a `.png` import). `npm run typecheck` failed with 14 errors entirely unrelated to this plan's files — `Cannot find name 'PageProps'/'LayoutProps'` across nine route files and `Cannot find module '@/assets/brand/einort-logo.png'` in three files.
- **Fix:** Copied both gitignored, machine-generated artifacts (not symlinked/junctioned) from the main checkout at `D:\Maxs\Claude\einort-commerce` into the worktree. Both regenerate automatically on the next `npm run build`/`npm run dev` and are correctly excluded from git by `.gitignore` (verified via `git check-ignore -v` and a clean `git status --short` after committing).
- **Files modified:** `.next/` (directory, gitignored), `next-env.d.ts` (gitignored) — neither is a tracked or committed file.
- **Verification:** `npm run typecheck` went from 14 pre-existing/environment errors to a clean exit.
- **Committed in:** not committed (both paths are gitignored by design; this was an environment restoration, not a source change).

### Noted, not fixed (false positives, not defects)

The plan's Task 1 `acceptance_criteria` include two literal `grep -c` checks expected to return `0`:
- `grep -c 'brand-accent\|#[0-9a-fA-F]{3,8}'` returns `1`
- `grep -c 'server/theming/registry\|server/theming/defaults'` returns `1`

Both hits are inside `template-thumbnail.tsx`'s own header-comment prose, explaining *why* those patterns are banned (e.g. "never a Tailwind palette/brand-accent utility", "NEVER IMPORTS `@/server/theming/registry`..."). The actual enforcement test, `tests/unit/surface-token-isolation.test.ts`, strips whole-line comments before scanning (confirmed by reading its `codeLinesIn` helper) and passes cleanly — there is no real literal colour, no real Tailwind palette utility, and no real import of either server-only module anywhere in the file's code. This was verified, not fixed, since "fixing" it would mean stripping the load-bearing rationale comments CLAUDE.md's own conventions require. `template-picker.tsx` (written fresh this session) was phrased to avoid the same literal substrings in its own comments, so all of its acceptance-criteria greps return the expected values with no false positives.

---

**Total deviations:** 1 auto-fixed (blocking, environment restoration only, no source change), 1 noted false-positive (no fix required, verified against the real enforcement test).
**Impact on plan:** No scope creep. Both components match 05-UI-SPEC.md and the plan's threat model exactly.

## Issues Encountered

- A prior executor session was interrupted by a rate limit after finishing `template-thumbnail.tsx` but before running its verify gate. This session verified that file against the full Task 1 spec (all twelve variant shapes, single accent block, no text nodes, no server-only imports) before committing it, then proceeded to Task 2.
- The plan's `<verify><automated>` blocks are written as `cd D:/Maxs/Claude/einort-commerce && …`, which is the main checkout path, not this worktree's path. Running verification there would silently check the wrong (unmodified) tree. All verification in this session was run from the worktree's own root instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `TemplateThumbnail` and `TemplatePicker` are both built, typed, and verified in isolation; neither is yet wired into `src/app/onboarding/branding/page.tsx` (Card 3 insertion) or the editor's storefront-editor rail — that wiring, plus the `switchTemplate` Server Action and its destructive-confirm dialog, is explicitly out of scope for this plan and belongs to the wave's remaining plans (05-04 already covers the write path; a later plan covers the two call sites consuming these components).
- No blockers. Both files import cleanly with zero references to `@/server/theming/registry` or `@/server/theming/defaults`, so wiring them into either surface's Server Component will only require flattening `TEMPLATES` into `TemplateTile[]` at the call site, matching the `SegmentTile[]` precedent already established in `src/app/onboarding/branding/page.tsx`.

## Self-Check: PASSED

- FOUND: `src/components/theming/template-thumbnail.tsx`
- FOUND: `src/components/theming/template-picker.tsx`
- FOUND: commit `33f4d4a`
- FOUND: commit `5731e4a`

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-05*
