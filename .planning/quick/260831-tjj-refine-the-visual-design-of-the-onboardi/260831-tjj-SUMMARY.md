---
phase: quick-260831-tjj
plan: 01
subsystem: onboarding-ui
tags: [ui, visual-hierarchy, onboarding, plan-selection, SUB-01, D-04]
requires:
  - "src/lib/strings.ts (strings.plan.* — read only, unchanged)"
  - "src/components/ui/badge.tsx (default variant — read only, unchanged)"
  - "src/server/entitlements/plans.ts (PlanTier — type only, unchanged)"
  - "lucide-react (Store, TrendingUp, Building2, type LucideIcon)"
provides:
  - "Recommended-tier visual elevation on /onboarding/plan, carried by four coordinated signals"
  - "TIER_ICONS: Readonly<Record<PlanTier, LucideIcon>> — compile-time-exhaustive tier glyph map"
affects:
  - "src/app/onboarding/plan/page.tsx (sole consumer of PlanPicker — unmodified, contract unchanged)"
tech-stack:
  added: []
  patterns:
    - "Readonly<Record<EnumType, T>> lookup table typed against the full enum (same discipline as ORDER_TRANSITIONS / TIER_COPY / PLANS)"
    - "Recommended-at-rest vs selected separated on three axes (fill / elevation / border-vs-ring) so a highlight cannot be mistaken for a choice"
key-files:
  created: []
  modified:
    - "src/app/onboarding/plan/plan-picker.tsx"
decisions:
  - "Recommended and selected states are deliberately separated on three axes at once (fill, elevation, border-on-box vs ring-outside-box) rather than sharing any one visual language — a card that looks chosen before the merchant chooses is the exact inertia D-04/D-05 exist to prevent."
  - "Icon tiles use one hue in two weights (bg-primary solid / bg-primary/10 tinted), not a per-tier palette — a per-tier palette is the semantic-token erosion surface-token-isolation.test.ts exists to prevent."
  - "border-2 was rejected for the recommended card: it would shift that card's content box 1px per side relative to its siblings for no gain shadow-lg does not already deliver."
  - "No ring-offset-* added to the selected state: the existing focus outline sits at outline-offset-2 and the ring at 0-2px, currently adjacent and non-overlapping; an offset ring would collide with the focus outline for a keyboard user on a selected card."
metrics:
  duration: ~10 min
  completed: 2026-08-31
  tasks: 1
  files-changed: 1
---

# Quick Task 260831-tjj: Onboarding Plan-Card Visual Hierarchy Summary

The recommended Business tier on `/onboarding/plan` now reads as genuinely elevated above Starter and Professional at rest — via a solid-primary "Most Popular" badge straddling the card's top border, a solid-filled icon tile, a white `bg-card` fill with `shadow-lg`, and a desktop-only 8px lift — using only tokens and variants that already existed.

## What Was Built

A pure JSX/className refinement of a single file, `src/app/onboarding/plan/plan-picker.tsx` (+125 / -15). Five coordinated changes:

1. **`TIER_ICONS` map** (module level, below `PlanCard`) — `Readonly<Record<PlanTier, LucideIcon>>` mapping `starter → Store`, `business → TrendingUp`, `professional → Building2`. Typed against `PlanTier` rather than `string` on purpose: a fourth entry in `PLAN_TIERS` becomes a compile error here instead of a card rendering with a missing icon. Resolved per card as `const TierIcon = TIER_ICONS[plan.tier];`.
2. **Floating badge** — the `<Badge variant="secondary">` left the header row entirely and is now the first child of the `<label>` (already `relative`), as `<Badge variant="default" className="absolute -top-3 left-1/2 -translate-x-1/2">`. The badge is `h-6`, so `-top-3` centres it exactly on the 1px top border, half in / half out.
3. **Icon tile above the tier name** — the header row's left child became a `flex flex-col gap-3` stack holding a decorative `aria-hidden` `size-10 rounded-md` tile then the unchanged `<h2>`. Fill is `bg-primary text-primary-foreground` when recommended, `bg-primary/10 text-primary` otherwise. The header row's right child is the pre-existing `isSelected` fragment (`Check` + `sr-only` "Selected"), byte-identical, now holding only the check.
4. **Recommended elevation at rest** — the flat `border border-border bg-muted` was split so fill and border are conditional: `border-primary bg-card shadow-lg lg:-translate-y-2` when recommended, `border-border bg-muted` otherwise. Base, focus and selected class strings are unchanged.
5. **Grid + checkmarks** — grid wrapper is now `grid items-stretch gap-6 pt-3 lg:grid-cols-3`; per-feature `<Check>` glyphs moved from `text-muted-foreground` to `text-primary` on all three tiers (surrounding `<li>` text stays muted).

The module header comment was extended (not rewritten) to record the four coordinated recommended signals and the all-caps warning that none of them may drift into the selected state's language.

## What Was NOT Touched

`PlanCard`, `PlanPicker`'s signature, `onSubmit`, `selectPlan`, every `useState`, the `<fieldset>`/`<legend>`/`sr-only` radio structure, the `Alert` block and the submit `Button` are all unchanged. `src/lib/strings.ts`, `page.tsx`, `plans.ts`, `badge.tsx` and every test file show zero changes — confirmed by `git diff --stat HEAD~1 HEAD -- src/app/onboarding/plan/ src/lib/strings.ts` reporting exactly one file.

Zero new colours, zero literal `#hex`/`oklch(`/`rgb(`/`hsl(`, zero `(zinc|slate|blue|…)-NNN` palette utilities, zero gradients, zero `data-surface`, zero `variant="gold"`, zero inlined copy, zero logic or type changes.

## Deviations from Plan

None — the plan was executed exactly as written, including its prescribed class strings, positioning values and rationale comments.

## Verification

Run fresh and solo after the code commit, from the worktree (the plan's `<automated>` block `cd`s to the main repo; the change lives only on this worktree branch, so the equivalent commands were run against the worktree instead — that is a target correction, not a substitution):

| Check | Result |
|-------|--------|
| `npx vitest run tests/unit/surface-token-isolation.test.ts tests/unit/dashboard-nav.test.ts tests/unit/phase-03-requirement-coverage.test.ts` | 3 files / 30 tests passed |
| `npx vitest run tests/unit --reporter=dot` (full unit suite, run pre-commit) | 26 files / 442 tests passed |
| `npm run typecheck` | clean |
| `npm run lint` (`--max-warnings=0`) | clean |
| `git --no-pager diff --stat HEAD~1 HEAD -- src/app/onboarding/plan/ src/lib/strings.ts` | 1 file, +125/-15; `strings.ts` absent (zero changes) |
| `grep -n 'variant="gold"' src/app/onboarding/plan/plan-picker.tsx` | no match |
| Gold budget (`dashboard-nav` + `phase-03-requirement-coverage`) | still exactly two files, both passing unmodified |
| `git status --short` post-commit | clean |
| `git diff --diff-filter=D --name-only HEAD~1 HEAD` | no deletions |

### Environment notes (not code issues)

The worktree ships without `node_modules`, `src/generated/prisma` or `.next/types` (all gitignored, none of them tracked). To run the gates at all, three read-only scaffolds were put in place inside the worktree — a directory junction for `node_modules`, a junction for `src/generated`, and a copy of `.next/types` — all gitignored and absent from `git status`, so none of them reach the commit. Without them `tsc` reports pre-existing unrelated failures (`Cannot find module '@/generated/prisma/client'`, `Cannot find name 'PageProps'/'LayoutProps'`) that have nothing to do with this change.

`npx next build` was not run. It is explicitly a bonus and not a gate per the plan's `<done>` block, and the known Turbopack/Windows-junction `node_modules` failure mode applies verbatim to this worktree.

### Human-check: OUTSTANDING — not performed

**I did not look at rendered output, and make no claim that the visual check passed.** Two independent blockers:

1. **The running dev server does not serve this code.** A server answers on `localhost:3001` and `localhost:3000`, but it runs from the main repo working tree. This change exists only as commit `0b6fc89` on branch `worktree-agent-aff5acc9ab6291d9c` and is not in the main tree, so anything rendered there would be the pre-change component.
2. **The route is auth-gated.** `GET http://localhost:3001/onboarding/plan` returns `307 → http://localhost:3001/login`. Reaching it requires a merchant session on an org with no `planTier`, which I could not establish.

All six numbered items in the plan's `<human-check>` block therefore remain for the orchestrator/user to confirm visually after this branch merges: (1) Business obviously recommended at rest at ≥1024px and at mobile width, (2) the solid pill straddling the top border unclipped and not crowding the subline, (3) three icon tiles — one solid, two tinted, (4) blue feature checkmarks, (5) visible card focus outline + arrow-key roving + a selected ring clearly distinct from the recommended border, with Business still reading recommended when another tier is selected, (6) CTA disabled until a tier is chosen and submit still redirecting to the storefront origin.

Item 5 is the one that matters most: it is the human-visible half of threat **T-tjj-03** (recommended-vs-selected confusion → tier assignment by inertia). The structural half is in place — three separating axes plus the retained `sr-only` "Selected" label — but only a human eye closes it.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change; the `selectPlan({ tier })` payload and its server-side Zod validation are byte-identical. `T-tjj-SC` does not fire — no package was installed, and `lucide-react` is a pre-existing declared dependency whose `Store`, `TrendingUp`, `Building2` and `LucideIcon` exports were confirmed present by a clean `tsc --noEmit`.

## Commits

- `0b6fc89` — `style(quick-260831-tjj): elevate the recommended tier on the onboarding plan cards` (1 file, +125/-15)

## Self-Check: PASSED

- `src/app/onboarding/plan/plan-picker.tsx` — FOUND (modified, committed)
- commit `0b6fc89` — FOUND in `git log`
- No file in this summary is claimed as created that does not exist; no commit is claimed that is not in the log.
