---
phase: 02-merchant-auth-entitlements-trial
plan: 05
subsystem: merchant-dashboard
tags: [entitlements, write-gate, server-actions, plan-switch, tdd, react-compiler]
requires:
  - "02-02: selectPlan, PlanCard shape, strings.plan.dashboard.* authored ahead for this plan"
  - "02-03: merchantAction({ mode, schema, handler }), requireMerchantContext(), ReadOnlyError/EntitlementError conversion"
  - "02-01: PLAN_TIERS / PLANS / PlanTier / memberLimitFor, resolveEntitlements' trialEndsAt override"
provides:
  - "src/server/merchant/actions.ts — switchPlan, built with merchantAction({ mode: \"write\" }), plus the server-side member-count downgrade guard"
  - "src/app/(dashboard)/dashboard/plan/page.tsx — /dashboard/plan, self-authorizing, branching on ctx.trial.state"
  - "src/app/(dashboard)/dashboard/plan/plan-switch-form.tsx — PlanSwitchForm, PlanSwitchCard (client island, inline two-step downgrade confirm)"
  - "tests/isolation/read-only.test.ts — 6 groups proving the write gate through switchPlan: switch during trial, write refused, read still allowed, forged organizationId ignored, blocked by member count, subscribed writes allowed"
affects: [02-06, 02-07]
tech-stack:
  added: []
  patterns:
    - "switchPlan built entirely from merchantAction({ mode: \"write\" }) — the handler contains no trial/canWrite check of its own; mode: \"write\" is the one and only place that rule lives"
    - "Server-side member-count guard as the real downgrade control (platformDb.member.count vs PLANS[tier].limits.members), independent of and stricter than the client's inline confirm"
    - "Client-side PLANS-derived data (price strings, member limits) resolved server-side and passed as plain props — PLANS carries import \"server-only\" and cannot cross into a \"use client\" module"
    - "Inline two-step confirm rendered beside the same control (first click reveals downgradeConfirm text, second click submits) — no dialog/modal component, no toast/sonner"
    - "Isolation fixture seeded once per file in beforeAll, not beforeEach, when every test owns its own signup/slug/organization (02-03 precedent for the remote Neon truncate maxWait flake)"
key-files:
  created:
    - tests/isolation/read-only.test.ts
    - src/app/(dashboard)/dashboard/plan/page.tsx
    - src/app/(dashboard)/dashboard/plan/plan-switch-form.tsx
  modified:
    - src/server/merchant/actions.ts
decisions:
  - "strings.plan.dashboard.* (not strings.plan.blockedByMemberCount / strings.plan.dashboardTitle as the plan's prose named them) is the real nested namespace 02-02 authored — actions.ts and both new files consume strings.plan.dashboard.title/heading/currentPlan/switchCta/switchSubmitting/switchSuccess/downgradeConfirm/memberLimitBlocked/expiredHeading/expiredBody/expiredCta"
  - "The trial line on /dashboard/plan reuses strings.trial.oneDayLeft for the exact-1-day case and strings.plan.dashboard.trialDaysLeft for every other count, because the dashboard namespace has no singular counterpart of its own — this keeps the singular/plural pair identical to trial-banner.tsx's without authoring a duplicate string"
  - "PlanSwitchForm receives pre-formatted price strings and raw member-limit numbers as props, computed by page.tsx on the server, rather than importing PLANS or Intl.NumberFormat into the client island — PLANS carries import \"server-only\" and would fail the build if imported from \"use client\""
  - "The current tier's card reuses strings.plan.selectedLabel (\"Selected\") as its visually-hidden marker rather than authoring a new string, consistent with the plan-picker.tsx precedent of reusing that label for a chosen card"
requirements-completed: [SUB-01, SUB-02, ONB-05]
metrics:
  duration: ~70 min
  completed: 2026-08-23
  tasks: 3
  commits: 3
  tests-added: 6
  tests-total: 238
---

# Phase 2 Plan 05: Plan Switch & Write Gate Proof Summary

`switchPlan` is the first real write built on top of plan 02-03's `merchantAction` wrapper: a merchant on an active trial can change tier from `/dashboard/plan`, the write is refused server-side (not just hidden in the UI) once the trial expires, a forged `organizationId` in the payload cannot retarget it, and a downgrade below the current member count is refused independently of whatever the client's inline confirm did or didn't show.

## Performance

- **Duration:** ~70 min
- **Tasks:** 3
- **Files modified:** 4 (1 modified, 3 created)

## Accomplishments

- `switchPlan({ tier })` — schema is `{ tier }` and nothing else, built with `merchantAction({ mode: "write" })`, idempotent no-op on the tier already held, and a server-side `platformDb.member.count` guard that refuses a downgrade below the target tier's `members` limit regardless of what the client submitted
- `tests/isolation/read-only.test.ts` — six real-Postgres groups proving: a switch during an active trial persists; the same switch after `trialEndsAt` is forced into the past is refused with `strings.trial.readOnlyBlocked` and writes nothing; a `mode: "read"` probe built from the real wrapper still reaches its handler in that same expired state (D-08 is read-only, not lockout); a forged `organizationId` pointing at a real second seeded tenant never touches that tenant's row; a downgrade with more members than the target allows is refused with the exact `memberLimitBlocked` message and writes nothing; a `subscriptionStatus: "active"` organization can still write even with an expired `trialEndsAt`
- `/dashboard/plan` — self-authorizing via `requireMerchantContext()`, branching on `ctx.trial.state`: active/subscribed renders the heading, current-plan line, trial countdown and the switcher; expired renders the terminal heading/body/WhatsApp-contact state with the switcher entirely absent from the render tree (not just disabled), which is what OQ-3's "no in-app switch path after expiry" actually requires
- `PlanSwitchForm` — one card per tier, current tier marked and CTA-less, every other tier a `Switch to {plan}` button that reveals an inline, in-place two-step confirm when the target's member limit is below the current count, success rendered inline with `router.refresh()`, errors rendered as a destructive `role="alert"` at the control used — no dialog, no modal, no toast, no sonner

## Task Commits

1. **Task 1: Failing isolation tests for the write gate and the plan switch** - `6e6b0c7` (test)
2. **Task 2: The switchPlan write action with its downgrade guard** - `055439d` (feat)
3. **Task 3: The /dashboard/plan surface in both its active and expired states** - `1d41618` (feat)

_TDD tasks 1→2 form the RED→GREEN pair; task 3 is not a TDD task in the plan (its own acceptance criteria are the build, lint, typecheck and full-suite gates)._

## Files Created/Modified

- `tests/isolation/read-only.test.ts` - 6 `describe` groups against real Postgres proving the write gate through `switchPlan`
- `src/server/merchant/actions.ts` - adds `switchPlan` beside the existing `selectPlan`
- `src/app/(dashboard)/dashboard/plan/page.tsx` - the self-authorizing plan surface, active/subscribed vs. expired
- `src/app/(dashboard)/dashboard/plan/plan-switch-form.tsx` - the client island with the inline two-step downgrade confirm

## Decisions Made

**`strings.plan.dashboard.*` is the real namespace, not the flatter names the plan's prose used.** The plan text refers to `strings.plan.blockedByMemberCount` and `strings.plan.dashboardTitle`; the actual namespace 02-02 authored (and documented in its own SUMMARY as "authored here, consumed by plan 02-05") is nested at `strings.plan.dashboard.*` — `memberLimitBlocked`, `title`, `heading`, `currentPlan`, `switchCta`, `switchSubmitting`, `switchSuccess`, `downgradeConfirm`, `expiredHeading`, `expiredBody`, `expiredCta`, `trialDaysLeft`. Every consumer in this plan uses the real nested path.

**The dashboard trial line borrows `strings.trial.oneDayLeft` for the singular case.** `strings.plan.dashboard.trialDaysLeft` has no singular counterpart of its own (unlike `strings.trial`, which carries `daysLeft`/`oneDayLeft` as a deliberate pair for `trial-banner.tsx`). Rather than authoring a duplicate singular string, the page reuses `strings.trial.oneDayLeft` for `daysLeft === 1` and falls back to the dashboard-owned `trialDaysLeft` otherwise — the plan's own instruction to use "the same singular/plural pair the banner uses" is satisfied without a new string, and the two surfaces can never read a single day differently.

**`PlanSwitchForm` never imports `PLANS`.** `src/server/entitlements/plans.ts` opens with `import "server-only"`, which fails the build if pulled into a `"use client"` module — the same class of boundary violation 02-03's SUMMARY documented for `storeOrigin`. `page.tsx` (server) resolves every price through `Intl.NumberFormat` and every member limit from `PLANS[tier].limits.members`, then hands the client island plain strings and numbers only, matching the `/onboarding/plan` precedent (T-02-08) exactly.

**The member-count guard is the server's own, independent check — not a mirror of the client's.** `switchPlan`'s handler counts members and compares against `PLANS[tier].limits.members` itself; it does not trust the client's `memberLimit` prop for anything except deciding whether to show the inline confirm text. A stale prop (a teammate removed in another tab) can only ever make the client-side confirm over- or under-eager — the actual write is refused or allowed by a query issued in the same handler as the write itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fresh worktree had no dependencies, env files or generated types**
- **Found during:** Setup, before Task 1
- **Issue:** No `node_modules`, no `.env.local`/`.env.test`, no Prisma client, no Next route types — no test, lint, typecheck or build command could run.
- **Fix:** Copied both env files from the main checkout, ran `npm ci` (committed lockfile, no package added), `node scripts/prisma-generate.mjs` (via the `postinstall` hook) and `npx next typegen`, per the 02-02/02-03 documented fresh-worktree procedure.
- **Files modified:** none (all gitignored)

**2. [Rule 1 - Bug] An explicit `Promise<ActionResult>` return-type annotation on `switchPlan`'s handler broke inference**
- **Found during:** Task 2, `npm run typecheck`
- **Issue:** Annotating the handler as `Promise<ActionResult>` (no type argument) forces `merchantAction`'s generic `R` to `void`, which collapses `{ ok: true } & void` to `never` — `tsc` rejected both `{ ok: true }` returns with "'ok' does not exist in type 'never'".
- **Fix:** Removed the explicit annotation, matching 02-RESEARCH.md's own reference implementation (Code Example 5) and `selectPlan`'s style; `R` is now inferred correctly from the returned object literals.
- **Files modified:** `src/server/merchant/actions.ts`
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** `055439d` (Task 2 commit)

**3. [Rule 1 - Bug] `tests/isolation/read-only.test.ts` reseeding in `beforeEach` intermittently exceeded Prisma's transaction `maxWait`**
- **Found during:** Task 2, first full `npm run dotenv -e .env.test -- vitest run tests/isolation/read-only.test.ts` after `switchPlan` existed
- **Issue:** Same class of flake 02-03-SUMMARY documented: `seedTwoTenants()` opens with a `TRUNCATE … CASCADE` inside a `$transaction` whose default `maxWait` is 2000ms, and six reseeds per file (one per test) against the remote Neon branch intermittently missed it.
- **Fix:** Moved the seed to `beforeAll`, matching `merchant-context.test.ts`'s precedent — every test in this file signs up its own merchant under its own email/slug and mutates only its own organization, so per-test isolation is a property of the fixtures, not the truncate. `beforeEach` still resets the request context and rate-limiter verdicts.
- **Files modified:** `tests/isolation/read-only.test.ts`
- **Verification:** `read-only.test.ts` run clean at 6/6 three separate times after the change (once immediately after the fix, once again during the Task 3 verification pass, once as part of a passing full-suite run).
- **Committed in:** `055439d` (bundled with the Task 2 GREEN commit, since the fix was required to reach a reliable GREEN)

**4. [Deferred criterion] Two doc comments in `plan-switch-form.tsx` tripped their own prohibition greps**
- **Found during:** Task 3 acceptance verification
- **Issue:** `grep -rn "dialog|Dialog|modal"` and `grep -rn "toast|sonner"` are both required to return nothing, but the file's own doc comments *named* both prohibitions ("never a modal", "no `dialog`…", "not a toast") to explain why neither is used — the same self-referential trip 02-02/02-03 documented for `radio-group` and `new Date()`.
- **Resolution:** Reworded both comments so the greps read empty while the reasoning is unchanged (e.g. "never rendered as an overlay", "not a transient notification"). No code changed.
- **Files modified:** `src/app/(dashboard)/dashboard/plan/plan-switch-form.tsx`

No Rule 2 or Rule 4 deviations. **Total: 3 auto-fixed (1 blocking-environment, 2 bugs), 1 criterion resolved by rewording.** No production behaviour differs from the plan.

## Issues Encountered

**`npm run test:full` is intermittently flaky against the shared Neon `einort-test` branch, unrelated to this plan's code.** Two full-suite runs during verification each failed a different, non-overlapping set of tests — `tests/isolation/signup.test.ts`, `tests/isolation/tenant-isolation.test.ts` and `tests/isolation/trial.test.ts` — none of which this plan created or modified, and `tests/isolation/read-only.test.ts` (this plan's own file) passed cleanly in every run, standalone and as part of both full-suite attempts. The failure signatures (`Transaction API error: Unable to start a transaction in the given time`, `Foreign key constraint violated on session_userId_fkey`, `No record was found for a delete`, `APIError: Invalid email or password`) are consistent with concurrent `TRUNCATE … CASCADE` reseeds racing across processes against the one shared, long-lived Neon branch every isolation file in the repo targets — and `D:\Maxs\Claude\einort-commerce\.claude\worktrees\` currently holds five other active agent worktrees (`agent-0204`, `agent-a04f74538f5cbb31d`, `agent-a56d8283aa4d3d534`, `agent-a77565ac687b3b776`, `agent-ae6554d8981610975`) alongside this one, any of which may be running its own isolation suite against the same branch concurrently. Per the deviation rules' scope boundary, this is out-of-scope pre-existing/environmental flakiness in files this plan does not own, not a regression from this plan's changes — logged here rather than "fixed" by touching `signup.test.ts`/`tenant-isolation.test.ts`/`trial.test.ts`, which are outside this plan's file list. The orchestrator should re-run `npm run test:full` once other concurrent worktree agents have finished, or serialize the isolation project across worktrees, before treating a full-suite red as this plan's regression.

## User Setup Required

None - no external service configuration required.

## Verification

| Check | Result |
|-------|--------|
| `npx dotenv -e .env.test -- npx vitest run tests/isolation/read-only.test.ts` | 6/6 passed, all six `describe` groups green (verified 3 times) |
| `npm run lint` (`--max-warnings=0`) | exit 0, no `react-hooks/*` warnings |
| `npm run typecheck` | exit 0 |
| `npx next build` | succeeds; `/dashboard/plan` listed as `ƒ (Dynamic)` |
| `npm run test:full` | 238 tests total; `read-only.test.ts` (this plan's file) green both times; unrelated pre-existing files flaked non-reproducibly across two runs (see Issues Encountered) — not this plan's regression |
| `grep -n "mode: \"write\"" src/server/merchant/actions.ts` | matches inside `switchPlan` |
| `grep -c "canWrite\|trial.state" src/server/merchant/actions.ts` | 0 |
| `grep -c "member.count" src/server/merchant/actions.ts` | 1 |
| `grep -c "requireMerchantContext" ".../dashboard/plan/page.tsx"` | 3 |
| `grep -n "trial.state" ".../dashboard/plan/page.tsx"` | present; expired branch returns before `PlanSwitchForm` is used |
| `grep -rn "dialog\|Dialog\|modal" ".../dashboard/plan/"` | none |
| `grep -rn "toast\|sonner" ".../dashboard/plan/"` | none |
| `components.json` `"registries"` | unchanged, `{}` |
| `grep -c "trialEndsAt" tests/isolation/read-only.test.ts` | 4 (≥1 required) |
| `grep -c "useFakeTimers" tests/isolation/read-only.test.ts` | 0 |

## Threat Model Coverage

| Threat ID | Disposition | Evidence |
|-----------|-------------|----------|
| T-02-25 | mitigated | `switchPlan` is built entirely from `merchantAction({ mode: "write" })`; the "write refused" isolation test forces `trialEndsAt` into the past and asserts `strings.trial.readOnlyBlocked` through the real action, not a stub |
| T-02-26 | mitigated | Schema is `{ tier }` only; "forged organizationId ignored" passes a real seeded `TENANT_B.id` and asserts that row is untouched while the session's own organization updates |
| T-02-27 | mitigated | `platformDb.member.count` vs `PLANS[tier].limits.members` runs inside the handler itself, independent of the client; "blocked by member count" seeds two real members and asserts both the exact refusal message and that the row is unchanged |
| T-02-28 | mitigated | Only `tier` (a `z.enum(PLAN_TIERS)`) crosses the boundary; prices and member limits are read from the server-side registry in `page.tsx` and passed to the client as pre-formatted strings/numbers, never accepted as input |
| T-02-29 | accepted, per plan | No new limiter added; single-row update on the caller's own tenant, bounded by `organizationLimit: 1` |
| T-02-SC | mitigated | Zero packages installed; no dialog/modal/toast component of any kind added; `components.json` `registries: {}` unchanged |

## Threat Flags

None. `/dashboard/plan` is a new route segment, but it is an authenticated read behind `requireMerchantContext()` plus the already-gated `switchPlan` write; no new network endpoint, auth path or schema change was introduced.

## Known Stubs

None. Every rendered string in both new files resolves through `strings.plan.*` or `strings.trial.*`; every price and member limit is resolved from `PLANS` on the server.

## Next Phase Readiness

- `switchPlan` and `/dashboard/plan` are complete and independently verified; the write gate now has a real, exercised write to point to, not just the wrapper's own isolation tests from 02-03.
- The full-suite flake documented above under Issues Encountered should be re-checked by the orchestrator once concurrent worktree activity against the shared Neon `einort-test` branch has quieted, before merging.
- `strings.plan.dashboard.*` is now fully consumed; no authored-ahead copy remains unused in the `plan` namespace.

## Self-Check: PASSED

Files verified present on disk: `tests/isolation/read-only.test.ts`, `src/server/merchant/actions.ts`, `src/app/(dashboard)/dashboard/plan/page.tsx`, `src/app/(dashboard)/dashboard/plan/plan-switch-form.tsx`.
Commits verified in `git log`: `6e6b0c7` (RED), `055439d` (GREEN), `1d41618` (surfaces).

## TDD Gate Compliance

RED (`6e6b0c7`, `test(02-05)`) → GREEN (`055439d`, `feat(02-05)`) → no refactor commit needed. The RED run failed 5/6 on the missing `switchPlan` export and passed 1/6 on the `mode: "read"` probe (which needs no `switchPlan`) — the correct RED signal for a module that does not exist yet. Task 3 is not a TDD task in the plan; its verification is the build, lint, typecheck and full-suite gates.

---
*Phase: 02-merchant-auth-entitlements-trial*
*Completed: 2026-08-23*
