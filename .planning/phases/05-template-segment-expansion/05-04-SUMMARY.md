---
phase: 05-template-segment-expansion
plan: 04
subsystem: entitlements
tags: [entitlements, theming, template-picker, tier-gating, plan-limits]

# Dependency graph
requires:
  - phase: 05-01
    provides: "TemplateDefinition.minTier field on the theming registry"
provides:
  - "PLAN_TIER_RANK: Readonly<Record<PlanTier, number>> nested-tier ordering table"
  - "PlanLimits.templates (10 / 25 / null) registered catalog size, documented not-the-gate"
  - "TemplateLockedError extends EntitlementError, carrying templateKey"
  - "canUseTemplate / accessibleTemplateKeys / assertTemplateAccess in src/server/theming/access.ts"
affects: ["05-05", "05-08", "05-21", "template-picker-ui", "switchTemplate-action"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Boolean/throw entitlement pair for a new domain (template tier), following src/server/entitlements/assert.ts's can/assertEntitlement stem convention"
    - "Fail-closed narrowing of an untrusted tier string to the Starter accessible set, mirroring productLimitFor's posture"

key-files:
  created:
    - src/server/theming/access.ts
  modified:
    - src/server/entitlements/plans.ts
    - src/server/theming/errors.ts

key-decisions:
  - "assertTemplateAccess reads ctx.plan.tier directly and never ctx.canEditStorefront or any trial-composed boolean — the deliberate D-12 divergence from assertCanEditStorefront, since a template grant is durable and cannot be safely un-granted at trial expiry the way editor access can"
  - "PlanLimits.templates is registered as the documented cumulative catalog size (10/25/null) but is never read as the gate — the gate is access.ts's per-template minTier comparison against PLAN_TIER_RANK"
  - "TemplateLockedError's feature field is the literal string \"templates\", not a PlanFeature member — matching EditorLockedError's precedent of passing a key deliberately absent from PlanFeature"

requirements-completed: [TMPL-04]

# Metrics
duration: resumed session, ~15min to complete remaining work (Task 2 verification + Task 3)
completed: 2026-09-05
---

# Phase 5 Plan 04: Template Tier Gate (Entitlements + Access) Summary

**Server-enforced 10/15/25 template tier gate: `PLAN_TIER_RANK` nesting table, `TemplateLockedError`, and a boolean/throw `access.ts` pair that gates on `ctx.plan.tier` directly and is deliberately never elevated by the trial.**

## Performance

- **Duration:** Resumed from a prior interrupted session (rate limit). Task 1 (`plans.ts`) was already complete and committed before this session began. This session verified/completed Task 2 (`errors.ts`, found ~95% complete uncommitted) and wrote Task 3 (`access.ts`) from scratch.
- **Completed:** 2026-09-05
- **Tasks:** 3/3 complete
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `PLAN_TIER_RANK` establishes the nested tier ordering (`starter: 0, business: 1, professional: 2`) as a compile-time table, and `PlanLimits.templates` registers the cumulative catalog size (10/25/null) with an explicit "not the gate" warning naming `access.ts`.
- `TemplateLockedError extends EntitlementError`, carrying a structured `templateKey` field, requiring zero changes to `merchantAction`'s existing `instanceof EntitlementError` catch arm.
- `src/server/theming/access.ts` provides the real gate: `canUseTemplate` (boolean, rendering), `accessibleTemplateKeys` (fail-closed reachable set), and `assertTemplateAccess` (throwing, write-time) — all three nested by rank and reading `ctx.plan.tier` directly, never a trial-elevated boolean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PLAN_TIER_RANK and the registered PlanLimits.templates catalog size** - `aa46a37` (feat) — completed and committed by the prior session before the interruption.
2. **Task 2: Add TemplateLockedError to the theming domain errors** - `3302a68` (feat) — found ~95% complete (uncommitted) from the interrupted session; verified against full acceptance criteria and committed as-is (no corrections needed).
3. **Task 3: Create access.ts — the boolean/throw template gate** - `817efbd` (feat) — written this session.

_No plan-metadata commit yet — this SUMMARY.md is written prior to that final commit, per the orchestrator's instruction not to touch STATE.md/ROADMAP.md from this worktree; the merge/final-commit step is owned by the Wave 2 orchestrator._

## Files Created/Modified

- `src/server/entitlements/plans.ts` - Added `PLAN_TIER_RANK` and `PlanLimits.templates` (10/25/null), with doc comments cross-referencing `access.ts` as the actual gate.
- `src/server/theming/errors.ts` - Added `TemplateLockedError extends EntitlementError`, `override readonly name = "TemplateLockedError"`, `templateKey` structured field.
- `src/server/theming/access.ts` (new) - `canUseTemplate`, `accessibleTemplateKeys`, `assertTemplateAccess`. Imports `PLAN_TIER_RANK`/`PlanTier` from `plans.ts`, `MerchantContext` from `src/server/entitlements/resolve.ts` (not `src/server/merchant/context.ts`, which does not re-export the type — see Deviations), `TemplateLockedError` from `errors.ts`, and `TEMPLATE_KEYS`/`TEMPLATES`/`TemplateKey` from `registry.ts`.

## Decisions Made

- **`MerchantContext` import source corrected.** The plan's `read_first` pointed at `src/server/merchant/context.ts` for "the `MerchantContext` shape". That file imports the type from `src/server/entitlements/resolve.ts` and does not re-export it — `import type { MerchantContext } from "@/server/merchant/context"` fails typecheck (`TS2459: declares 'MerchantContext' locally, but it is not exported`). `access.ts` imports it from `@/server/entitlements/resolve` instead, which is the module that actually exports it. This is a Rule 1 (auto-fix bug) correction to a plan `read_first` pointer, not a design change — the shape and semantics of `ctx.plan.tier` are unaffected.
- Followed the plan's exact design for the D-12 divergence: `assertTemplateAccess` reads `ctx.plan.tier` directly, and the module header plus the function's own doc comment both spell out why this must never be "fixed" to match `assertCanEditStorefront`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected `MerchantContext` import path in `access.ts`**
- **Found during:** Task 3 (`access.ts`), first `npm run typecheck` after initial write
- **Issue:** Plan's `read_first` named `src/server/merchant/context.ts` as the source of `MerchantContext`; that file only re-exports it internally as part of resolving `requireMerchantContext`'s return type and does not `export type { MerchantContext }` itself. Importing from there is a compile error.
- **Fix:** Changed the import to `import type { MerchantContext } from "@/server/entitlements/resolve"`, the module that actually declares and exports the type.
- **Files modified:** `src/server/theming/access.ts`
- **Verification:** `npm run typecheck` exits 0 after the fix.
- **Committed in:** `817efbd` (Task 3 commit — the corrected import was part of the initial file write, never committed with the wrong path)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** No scope creep — a corrected import pointer only. All three functions have the exact signatures, fail-closed behavior, and D-12 divergence documentation the plan specified.

## Issues Encountered

- **Verification of the `assertTemplateAccess` throw path required a temporary in-memory registry mutation.** `TEMPLATE_KEYS` currently holds exactly one row (`flagship-fashion`, `minTier: "starter"`) — Phase 5's 50-template catalog lands in plan 05-08. Every real tier can therefore access the one existing template, so the acceptance criterion "a context whose `plan.tier` is `starter` and a key whose `minTier` is `professional` throws `TemplateLockedError`" could not be exercised against real registry data yet. Verified instead with a disposable `tsx` script (not committed) that temporarily set `TEMPLATES["flagship-fashion"].minTier = "professional"` in-process, confirmed `canUseTemplate` returns `false` and `assertTemplateAccess` throws `TemplateLockedError` (itself `instanceof EntitlementError`) carrying the correct `templateKey`, then reverted the mutation before the process exited. The underlying `PLAN_TIER_RANK` comparison logic is identical regardless of how many rows exist in `TEMPLATES`, so this is a valid proxy for the real multi-tier case that 05-08 will make directly testable. `tests/isolation` plan 05-21 is the plan of record for pinning this with a real Professional-tier template and an active-trial Starter context, per the threat model's own T-05-13 disposition.
- All other verification (`npm run typecheck`, `npm run lint`, `npm run test:unit` — 571/571 passing across 33 files) ran clean with no failures requiring investigation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The tier gate is real and enforceable: `05-05` (the template picker UI) can call `accessibleTemplateKeys`/`canUseTemplate` for rendering, and `switchTemplate`/`saveBranding` (wherever they land) can call `assertTemplateAccess` before any write, closing Pitfall 6 (a picker that filters correctly while a direct POST with an out-of-tier key succeeds).
- `05-08` (the 50-template catalog expansion) is the first plan that will actually exercise `accessibleTemplateKeys`'s nesting behavior against real multi-tier data — worth a follow-up assertion in that plan's own verification that the observed per-tier counts equal `PLANS.<tier>.limits.templates` (10/25/null), which `plans.ts`'s doc comment already promises `tests/unit/template-distinctiveness.test.ts` will check.
- `05-21`'s isolation suite is the intended home for the ACTIVE-trial-Starter-vs-Professional-template regression test that this plan's own verification could only simulate in-process.
- No blockers.

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-05*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all three task commit hashes (`aa46a37`, `3302a68`, `817efbd`) confirmed present in `git log --oneline --all`.
