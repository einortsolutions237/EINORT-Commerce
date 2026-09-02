---
phase: 04-theme-section-block-system-flagship-template
plan: 03
subsystem: auth
tags: [entitlements, plan-tiers, trial, authorization, vitest, typescript]

# Dependency graph
requires:
  - phase: 02-merchant-auth-entitlements-trial
    provides: "PLANS registry, resolveEntitlements, EntitlementError/ReadOnlyError, merchantAction wrapper"
  - phase: 03-catalog-products-images
    provides: "The productLimitFor precedent for a registry-backed, server-enforced cap"
provides:
  - "PlanLimits.storefrontEditor — tier data for the editor capability (Starter false, Business/Professional true)"
  - "MerchantContext.canEditStorefront — the trial-aware boolean every editor gate must consult"
  - "EditorLockedError — an EntitlementError subclass merchantAction already converts to a merchant-readable refusal"
  - "assertCanEditStorefront — the throwing write-time gate for editor mutations"
  - "The D-15 trial-override truth table, pinned in tests/unit/entitlements.test.ts"
affects: [04-04 editor strings, 04-12 editor UI and Save/Publish buttons, any plan adding a theming Server Action]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capability composed in the resolver, not read at the call site"
    - "Domain error subclassing used as the wiring mechanism for an existing catch arm"

key-files:
  created: []
  modified:
    - src/server/entitlements/plans.ts
    - src/server/entitlements/resolve.ts
    - src/server/entitlements/assert.ts
    - src/server/merchant/action.ts
    - tests/unit/entitlements.test.ts

key-decisions:
  - "canEditStorefront is `subscribed ? plan.limits.storefrontEditor : !expired` — derived from the two existing locals, never stored, so an active trial grants the editor regardless of tier (D-15)"
  - "storefrontEditor is deliberately absent from PlanFeature, so `can()` cannot be pointed at it and the naive registry-only gate is unreachable by construction"
  - "EditorLockedError extends EntitlementError so merchantAction needs no control-flow change; action.ts received comment-only edits"
  - "editorSections stays registered and permanently null on all tiers (D-05 fixes one section list per tier); its stale 'Phase 4 will enforce it' comment was rewritten rather than the key removed"

patterns-established:
  - "Trial-elevated capability: a feature flag whose answer depends on trial state is composed in resolveEntitlements, and the registry key carries an all-caps warning against direct reads"
  - "Error-subclass wiring: a new refusal type extends the error the boundary already catches, rather than widening the boundary's instanceof list"

requirements-completed: [EDIT-03]

# Metrics
duration: ~25min
completed: 2026-09-02
---

# Phase 4 Plan 03: Editor Capability Entitlement Summary

**Trial-aware `canEditStorefront` composed in `resolveEntitlements`, plus an `EditorLockedError` that `merchantAction` already converts — defusing the D-15 trap where a naive registry lookup would hand a mid-trial Starter merchant a view-only editor.**

## Performance

- **Duration:** ~25 min (spans two executor instances; the first was killed mid-Task-1 by an API rate limit)
- **Completed:** 2026-09-02T14:26:35Z
- **Tasks:** 3 (Task 2 executed TDD, so 4 commits total)
- **Files modified:** 5

## Accomplishments

- `PlanLimits.storefrontEditor` registered as tier data — Starter `false`, Business and Professional both `true` — as a single boolean, never a three-way branch (D-14).
- `MerchantContext.canEditStorefront` computed in the one pure function that knows both plan and trial state. A Starter merchant on day 2 of their trial gets `true`; the same merchant one day post-trial gets `false`; a genuinely subscribed Starter merchant gets `false` (D-13/D-15).
- The full D-15 truth table pinned by unit tests written **before** the implementation, so a later "simplification" back to `can(ctx, "storefrontEditor")` is a red test rather than a silent regression a merchant discovers.
- `EditorLockedError extends EntitlementError` and `assertCanEditStorefront`, wired so an editor refusal reaches the merchant as a message rather than a 500 (T-04-16) — with **zero** control-flow change in `action.ts`.
- The stale `editorSections` doc comment corrected: D-05 fixes one section list for every tier, so `null` on all three is the permanent answer, not a placeholder.

## Task Commits

1. **Task 1: Register storefrontEditor on PlanLimits** — `833e2e7` (feat)
2. **Task 2 (RED): Failing D-15 cases for canEditStorefront** — `67df97c` (test)
3. **Task 2 (GREEN): Trial-aware canEditStorefront** — `32842fb` (feat)
4. **Task 3: EditorLockedError + assertCanEditStorefront** — `501603f` (feat)

_Task 2 was `tdd="true"`: the RED commit fails with 8 assertion errors (`expected undefined to be true`) against the unimplemented field; GREEN turns all 43 green. No refactor commit was needed._

## Files Created/Modified

- `src/server/entitlements/plans.ts` — Added `storefrontEditor` to `PlanLimits` and all three `PLANS` rows; rewrote the `editorSections` doc comment.
- `src/server/entitlements/resolve.ts` — Added `canEditStorefront` to `MerchantContext` and computed it beside `canWrite`.
- `src/server/entitlements/assert.ts` — Added `EditorLockedError` and `assertCanEditStorefront`.
- `src/server/merchant/action.ts` — Comment-only: names the subclass the existing catch arm covers.
- `tests/unit/entitlements.test.ts` — Registry assertions, the D-15 truth table (`editor capability`), and the prototype-chain cases (`editor refusal`).

## Decisions Made

- **Chose the ternary form over the composed boolean.** 04-RESEARCH.md offered `(subscribed || !expired) && (trialActive || plan.limits.storefrontEditor)`; the plan permitted either. `subscribed ? plan.limits.storefrontEditor : !expired` was chosen because it reads as the two-case rule it actually is and needs no derived `trialActive` local. Both satisfy the truth table; the ternary makes the D-13 branch (a paying Starter merchant is refused) visible on one line.
- **Left `storefrontEditor` out of `PlanFeature`.** The naive gate is not merely discouraged by a comment — `can()` is typed such that it cannot be pointed at the key at all.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored missing gitignored dev artifacts**
- **Found during:** Task 1 (verification)
- **Issue:** The worktree had no `node_modules`, `src/generated`, `.env.local`, `.env.test`, `next-env.d.ts` or `.next/types`. Without them `npm run typecheck` reported 9 spurious `Cannot find name 'PageProps'/'LayoutProps'` errors (Next 16 generates those globals into `.next/types`), and no test could run.
- **Fix:** Copied all of them from the main checkout at `D:\Maxs\Claude\einort-commerce`. `node_modules` was first linked as a directory junction, but Turbopack rejects a junction pointing outside the project root (`Symlink [project]/node_modules is invalid`), so it was replaced with a real copy before `npm run build`.
- **Files modified:** None tracked — every restored path is gitignored; `git status` stayed limited to the intended source files throughout.
- **Verification:** `npm run typecheck` went from 9 errors to 0 with no source change; `npm run build` then succeeded.
- **Committed in:** Nothing committed (environment only).

**2. [Rule 2 - Missing Critical] Added prototype-chain tests for EditorLockedError**
- **Found during:** Task 3
- **Issue:** T-04-16 is a `mitigate` disposition in the plan's threat register, and its entire mitigation rests on `EditorLockedError` remaining a genuine `EntitlementError` subclass. That is a fact about the transpiled prototype chain, not an obvious property of the source — a later reader changing it to `extends Error` would silently convert every editor refusal into an unhandled 500. The plan specified no test for it.
- **Fix:** Added an `editor refusal` describe block asserting `instanceof EntitlementError`, the re-assigned `name`, the inherited `feature`, message pass-through, and `assertCanEditStorefront`'s throw/no-throw behaviour across the tier/trial matrix.
- **Files modified:** `tests/unit/entitlements.test.ts`
- **Verification:** 7 new tests pass; suite total 471.
- **Committed in:** `501603f` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/environment, 1 missing critical)
**Impact on plan:** No scope creep. The first was environment restoration with no tracked-file impact; the second pins a mitigation the plan's own threat model already required.

## Issues Encountered

- **Resumed mid-task.** The prior executor was killed by an API rate limit while verifying Task 1, leaving `plans.ts` and `entitlements.test.ts` modified but uncommitted. Both were read as-is and verified against Task 1's acceptance criteria rather than rewritten, then committed as Task 1.
- **`ENFORCED FROM PHASE 4` grep nuance.** Task 1's acceptance criterion asks that this string be gone. It still appears once in the file — at line 93, inside the **`storefrontEditor`** comment ("ENFORCED FROM PHASE 4, but NEVER FROM THIS KEY DIRECTLY"), which is correct and intended. The criterion scopes it to the `editorSections` comment, which no longer contains it.

## Verification

All four gates from the plan's `<verification>` block pass:

| Gate | Result |
|------|--------|
| `npm run test:unit` | 471 passed, 28 files |
| `npm run lint` | exit 0 (`--max-warnings=0`) |
| `npm run typecheck` | exit 0 |
| `npm run build` | succeeded |

## Known Stubs

None. Every field added is read by real logic; no placeholder values were introduced.

## Threat Flags

None. This plan adds no network endpoint, auth path, file access or schema change — it tightens an existing authorization surface. `assertCanEditStorefront` has no call site yet; the editor mutations that will call it arrive in 04-12, and until then the gate is dead code by design, not an unguarded surface.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 04-04:** `assertCanEditStorefront` expects a caller-supplied message and 04-04 adds `strings.editor.starterViewOnly` for exactly that. The assertion composes no copy of its own.
- **Ready for 04-12:** the editor UI reads `ctx.canEditStorefront` for disabled `Save`/`Publish` buttons, and the Server Actions behind them must call `assertCanEditStorefront` — the button is courtesy, the assertion is the control (T-04-05).
- **One invariant to carry forward:** nothing outside `resolveEntitlements` may read `plan.limits.storefrontEditor`. The registry doc comment and the `PlanFeature` type both enforce this, and `tests/unit/entitlements.test.ts` fails if the composition is flattened back to a tier-only lookup.

---
*Phase: 04-theme-section-block-system-flagship-template*
*Completed: 2026-09-02*
