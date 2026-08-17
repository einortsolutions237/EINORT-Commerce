---
phase: 02-merchant-auth-entitlements-trial
plan: 01
subsystem: entitlements
tags: [entitlements, plan-registry, trial, subscription, prisma-migration, better-auth, input-false, tdd]
requires:
  - "01-02: prismaBase, platformDb, scopedDb, the Organization.status NOT NULL hand-correction and its comment idiom"
  - "01-06: src/server/auth/auth.ts — the organization() plugin block and its existing status additionalFields entry"
  - "01-01: the vitest unit/isolation project split and the @/* alias"
provides:
  - "src/server/entitlements/plans.ts — PLAN_TIERS, PlanTier, PlanLimits, PlanDefinition, PLANS, isPlanTier, memberLimitFor"
  - "src/server/entitlements/resolve.ts — TRIAL_DAYS, TRIAL_URGENT_DAYS, TrialState, OrgRow, MerchantContext, resolveEntitlements, isUrgentTrial"
  - "src/server/entitlements/assert.ts — PlanFeature, PlanLimitKey, EntitlementError, ReadOnlyError, can, limitFor, assertEntitlement, assertCanWrite"
  - "Organization.planTier / trialEndsAt / subscriptionStatus / planSelectedAt — applied to the development branch, input:false at the auth boundary"
  - "tests/unit/entitlements.test.ts — 32 tests, the six -t-addressable describe blocks 02-VALIDATION.md names"
affects: [02-02, 02-03, 02-04, 02-05, 02-06]
tech-stack:
  added: []
  patterns:
    - "Plan differences as one typed registry keyed Readonly<Record<PlanTier, …>>, so a fourth tier is a compile error at every incomplete table"
    - "`now` as a required parameter of the resolver, never the system clock — the whole trial lifecycle becomes arithmetic in the no-database unit project"
    - "Trial expiry derived from createdAt rather than stored, so there is no isExpired column to fall out of date and no back-fill write that can fail"
    - "Fail-closed limit resolution: an unknown or absent tier yields the owner-only limit, never 0 (which Better Auth widens to 100)"
    - "Paired guards — boolean form for rendering, throwing form for writes — so a dropped return-value check is not a silent bypass"
    - "input:false additionalFields as the tamper control for server-owned columns, mirroring Phase 1's status precedent"
key-files:
  created:
    - src/server/entitlements/plans.ts
    - src/server/entitlements/resolve.ts
    - src/server/entitlements/assert.ts
    - tests/unit/entitlements.test.ts
    - prisma/migrations/20260817214536_plan_trial_entitlements/migration.sql
  modified:
    - prisma/schema.prisma
    - src/server/auth/auth.ts
    - vitest.config.ts
decisions:
  - "memberLimitFor's fallback returns PLANS.starter.limits.members rather than a literal 1, so the fail-closed value cannot drift from the registry"
  - "An unrecognised planTier degrades to starter with a console.error naming SUB-01, rather than throwing — the resolver runs inside a render path"
  - "products limits set to 50 / 250 / null from pricing-reference.md; editorSections left null on all tiers because Phase 4 has not decided the caps"
  - "The unit vitest project now aliases server-only, so pure-but-server-marked modules stay unit-testable without weakening the client-bundle guard"
metrics:
  duration: ~20 min
  completed: 2026-08-17
  tasks: 3
  commits: 3
  tests-added: 32
  tests-total: 162
---

# Phase 2 Plan 01: Entitlement & Trial Data Spine Summary

One typed plan registry (5 000 / 12 500 / 25 000 XAF, owner-inclusive member limits 1 / 4 / 11), one pure trial resolver that takes `now` as a parameter and is proven at the day-10 boundary, and four `input: false` organization columns applied to the live development branch with zero drift.

## What Was Built

**`src/server/entitlements/plans.ts`** — `PLAN_TIERS` as an `as const` tuple and `PLANS` typed `Readonly<Record<PlanTier, PlanDefinition>>`, so adding a fourth tier is a compile error at every incomplete table rather than a silent default. Every limit the product will ever gate is registered now with a comment naming the phase that enforces it: `members` (this phase), `products` (Phase 3), `editorSections` (Phase 4/EDIT-03), `discountCodes` and `bulkImport` (v2). `memberLimitFor` takes a structural `{ planTier?: string | null }` and fails closed to the Starter member limit for null, absent or unrecognised tiers.

**`src/server/entitlements/resolve.ts`** — `resolveEntitlements(org, now)` derives `endsAt` from `trialEndsAt ?? createdAt + TRIAL_DAYS`, computes `daysLeft` as a clamped duration, and returns the `MerchantContext` every later plan in this phase consumes. `OrgRow` is declared structurally, so the module has no data-access dependency at all. `isUrgentTrial` pins D-12's threshold to the single exported `TRIAL_URGENT_DAYS = 2`.

**`src/server/entitlements/assert.ts`** — `can` / `limitFor` for rendering, `assertEntitlement` / `assertCanWrite` for writes, plus `EntitlementError` (carrying `feature`) and `ReadOnlyError`. Both errors take a caller-supplied message so user-facing copy stays in `strings.ts`.

**Schema + auth boundary** — four columns on `organization`, each with a hand-correction-style comment matching the `status` voice, and all four declared `input: false` in the `organization()` plugin's `additionalFields`.

## Key Decisions

**Starter's member limit is 1, never 0.** Better Auth resolves the cap as `membershipLimit || 100`, so the falsy 0 that "no staff accounts" naively suggests would hand the tightest tier the loosest limit in the product. The owner is itself a member and the guard is `count >= limit`, so 1 is both correct and safe. A unit test asserts no input to `memberLimitFor` can ever produce 0 or 100.

**The fail-closed value is read from the registry, not written as a literal.** `memberLimitFor` returns `PLANS.starter.limits.members` rather than `1`, so if Starter's limit ever changes, the fallback follows it instead of quietly disagreeing.

**An unknown `planTier` degrades rather than throws.** The column is `String?` and nothing at the type level stops a bad backfill putting `"enterprise"` in it. Since the resolver runs inside a render path, a throw would give the merchant a crashed dashboard that tells them nothing; falling back to Starter limits with a `console.error` naming SUB-01 keeps them working and makes the drift visible.

**Trial state is derived, never stored.** There is no `isExpired` column and no back-fill write that can fail, which also means the day-10 boundary is a pure comparison rather than a race between a cron job and a page load.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree had no `node_modules` and no env files**

- **Found during:** Task 1 (before the first test run)
- **Issue:** The fresh worktree carried no `node_modules`, no `.env.local` and no `.env.test`, so no test, lint, typecheck or migration command could run at all.
- **Fix:** Created a directory junction from the worktree's `node_modules` to the main checkout's, and copied `.env.local` and `.env.test` in. No package was installed and no lockfile was touched — the dependency set is byte-identical to the main checkout. All three paths are gitignored, so nothing entered a commit.
- **Files modified:** none (all gitignored)

**2. [Rule 3 - Blocking] The `unit` vitest project did not alias `server-only`**

- **Found during:** Task 2
- **Issue:** `server-only`'s default export condition resolves to a module that throws; only the `react-server` condition resolves to an empty one. `vitest.config.ts` aliased it for the `isolation` project only, because until now every `server-only` module also touched the database. The entitlement modules are the first that are pure *and* server-marked, so `tests/unit/entitlements.test.ts` could not import them.
- **Fix:** Added `"server-only": serverOnlyStub` to the `unit` project's alias map, with a comment explaining why a database-free module still carries the marker (it must never reach a client bundle). The stub was already defined in the file for the isolation project.
- **Files modified:** `vitest.config.ts`
- **Commit:** b867d4d

**3. [Rule 3 - Blocking] Generated types absent in the worktree**

- **Found during:** Task 2 verification
- **Issue:** `npm run typecheck` reported 16 errors — the Prisma client (`src/generated/`) and Next's route types (`.next/types`) are both gitignored and had never been generated here. None were in new code.
- **Fix:** Ran `node scripts/prisma-generate.mjs` and `npx next typegen`. Typecheck then exits clean.
- **Files modified:** none (both outputs gitignored)

No Rule 1, Rule 2 or Rule 4 deviations. No packages were installed, consistent with the phase's zero-install audit (T-02-SC).

## Verification

| Check | Result |
|-------|--------|
| `npx vitest run tests/unit/entitlements.test.ts` | 32 passed, 0 failed, 0 skipped |
| `npm run test:unit` | 6 files, 162 passed |
| `npm run lint` (`--max-warnings=0`) | exit 0, no `eslint-disable` anywhere under `src/server/entitlements/` |
| `npm run typecheck` | exit 0 |
| `npx prisma validate` | schema valid |
| `npx prisma migrate diff --from-schema … --to-config-datasource --exit-code` | `No difference detected`, exit 0 |
| `npx dotenv -e .env.test -- npx vitest run tests/isolation/model-registry-drift.test.ts` | 3 passed (test branch migrated automatically by global-setup) |
| `grep -rn "new Date()" src/server/entitlements/resolve.ts` | no matches |
| `grep -rn "generated/prisma\|server/db" src/server/entitlements/` | no matches |
| `grep -c "input: false" src/server/auth/auth.ts` | 10 (≥ 5 required) |
| `Organization` in `TENANT_SCOPED_MODELS` | absent, as intended |

The applied migration is purely additive:

```sql
ALTER TABLE "organization" ADD COLUMN "planSelectedAt" TIMESTAMP(3),
ADD COLUMN "planTier" TEXT,
ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN "trialEndsAt" TIMESTAMP(3);
```

`alpha-store` and `recovered-store` keep `planTier = NULL` deliberately — a free live test of the D-05 onboarding gate when plan 02-02 builds it.

## TDD Gate Compliance

RED (`7991fe5`, `test(02-01)`) → GREEN (`b867d4d`, `feat(02-01)`) → no refactor needed. The RED run failed on unresolved module specifiers, naming `@/server/entitlements/plans`, which is the correct RED signal for modules that do not yet exist rather than a syntax error masquerading as one.

## Threat Model Coverage

| Threat ID | Disposition | Evidence |
|-----------|-------------|----------|
| T-02-01 | mitigated | All four columns `input: false` in `additionalFields`; no public API path can set them |
| T-02-02 | mitigated | No stored expiry flag; `endsAt` derived from `createdAt`, which Better Auth stamps server-side |
| T-02-03 | mitigated | `memberLimitFor` fails closed to the Starter limit; a unit test asserts no input yields 0 or 100 |
| T-02-04 | mitigated | Lint at `--max-warnings=0` passes with no generated-client import under `src/server/entitlements/` |
| T-02-05 | accepted | Additive migration only; `migrate diff --exit-code` proves the applied state matches |
| T-02-SC | mitigated | Zero packages installed |

## Notes for Downstream Plans

- **Import the registry, never a string literal.** No plan tier should be compared against `"business"` outside `src/server/entitlements/**`. Use `isPlanTier` to narrow the nullable column and `PLANS[tier]` to read anything from it.
- **`memberLimitFor` is ready for `membershipLimit`.** Plan 02-03 (or whichever plan wires the organization plugin's membership gate) should pass the *function* form so the value is truthy regardless of what it returns.
- **`resolveEntitlements` needs a `now`.** The caller supplies `new Date()`; the resolver never will. Keep it that way — it is the entire reason the trial is unit-testable.
- **Writes to these four columns go through `platformDb.organization.update`.** `input: false` means there is no auth-API path, by design, and `Organization` is deliberately absent from `TENANT_SCOPED_MODELS` because it *is* the tenant.
- **`assert.ts` is untested so far.** Its behaviour is trivially derived from `plans.ts`, but the plan that first calls `assertCanWrite` from a real mutation should cover the SUB-02 refusal path in the isolation suite (02-VALIDATION.md already lists `tests/isolation/read-only.test.ts`).
- **`vitest.config.ts` now aliases `server-only` in both projects.** New pure server modules can be unit-tested directly without dropping the marker import.

## Known Stubs

None. `editorSections: null` on all three tiers is a *registered, deliberately unlimited* value pending Phase 4's per-tier caps, not a placeholder standing in for missing behaviour — the key exists precisely so that decision has a compile-time home (D-07).

## Self-Check: PASSED

Files verified present: `src/server/entitlements/plans.ts`, `src/server/entitlements/resolve.ts`, `src/server/entitlements/assert.ts`, `tests/unit/entitlements.test.ts`, `prisma/migrations/20260817214536_plan_trial_entitlements/migration.sql`.
Commits verified in `git log`: `7991fe5`, `b867d4d`, `a334a07`.
