---
phase: 05-template-segment-expansion
plan: 21
subsystem: testing
tags: [vitest, isolation-tests, prisma, better-auth, entitlements, theming, tier-gate]

# Dependency graph
requires:
  - phase: 05-template-segment-expansion (05-11)
    provides: switchTemplate/publishStorefront/discardDraft/saveBranding write paths, the draft/published templateKey split, access.ts's tier gate
  - phase: 05-template-segment-expansion (05-18, 05-19, 05-20)
    provides: onboarding picker, editor "Change template" action, distinctiveness metric — all merged and gate-clean on master before this wave
provides:
  - Isolation proof that the template tier gate (D-06/D-12) is not trial-elevated
  - Isolation proof that switchTemplate is draft-only (D-08) and byte-identical on published columns
  - Isolation proof that a switch preserves accents/logo and resets announcement/footer (D-11)
  - Isolation proof that publish promotes all three template columns atomically
  - Isolation proof that discard reverts all three, and never falls back to the flagship for a non-flagship tenant (Pitfall 5)
  - Isolation proof that onboarding seeds from the merchant's picked template, not the flagship (D-07)
  - Six shared isolation fixtures repaired for 05-11's new required saveBranding.templateKey field (deferred-items.md closed)
affects: [05-22 (phase gate — requirements/decision coverage, verifier, code-review)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real Better Auth session harness (plan-selection.test.ts's authenticateAs/signIn pattern) reused for a fifth and sixth isolation file, never a mocked merchant context"
    - "expectOk<T>() narrowed to Extract<T, {ok:true}> so callers can read data fields off a successful ActionResult without a cast at every call site"
    - "Negative-control discipline: each planned control-removal (assertTemplateAccess, publishedTemplateKey silent-write, saveBranding's flagship revert, canUseTemplate removal) confirmed to fail the suite, then reverted, with a git diff --stat check proving the revert was byte-clean"

key-files:
  created:
    - tests/isolation/template-switch.test.ts
    - tests/isolation/onboarding-template.test.ts
  modified:
    - tests/isolation/catalog.test.ts
    - tests/isolation/claims.test.ts
    - tests/isolation/merchant-context.test.ts
    - tests/isolation/order-actions.test.ts
    - tests/isolation/read-only.test.ts
    - tests/isolation/trial.test.ts

key-decisions:
  - "The D-06/D-12 tier-refusal case is built as a Starter merchant on a freshly-issued (untouched trialEndsAt) active trial, not a locked/expired one — the mirror image of storefront-editor.test.ts's EDIT-03 case, which uses an expired trial. An active trial is what makes canEditStorefront true via D-15, so the refusal can only be the tier gate."
  - "The Pitfall 5 'never published' fallback case is constructed via direct scopedDb writes (Prisma.DbNull for published, a malformed publishedTokens object) rather than by literally never calling publishStorefront — every onboarding path in this codebase publishes immediately (ONB-04), so there is no production route to a truly never-published row; the STALE_DRAFT idiom already established in storefront-editor.test.ts is the correct analog."
  - "The six deferred saveBranding fixtures (deferred-items.md, 05-11 Task 3 entry #2) were fixed in this plan, per that note's own recommendation naming 05-21 as the natural home for them."

requirements-completed: [TMPL-04]

# Metrics
duration: ~110min
completed: 2026-09-07
---

# Phase 5 Plan 21: Isolation Test Suites — Tier Gate, Draft-Only Switch, Discard Revert, Onboarding Seed Summary

**Two new isolation suites (13 cases total) proving switchTemplate's non-elevated tier gate, draft-only write, publish/discard atomicity, and saveBranding's onboarding seed against a real Better Auth session and the Neon test branch — plus a fix for six shared fixtures left broken by 05-11's new required `templateKey` field.**

## Performance

- **Duration:** ~110 min
- **Tasks:** 2 planned tasks + 1 deferred-item fix (explicitly directed in-scope by the orchestrator's own task description) + 1 lint/typecheck fixup
- **Files modified:** 8 (2 created, 6 fixed)

## Accomplishments

- `tests/isolation/template-switch.test.ts` — 8 tests across 7 named cases (tier gate, forged key, cross-tenant, draft-only write, accents/logo survival, publish promotion, discard revert with two sub-cases for Pitfall 5) proving TMPL-04's write paths against a real session and a real database.
- `tests/isolation/onboarding-template.test.ts` — 6 tests proving `saveBranding` seeds from the merchant's actual template pick (not the flagship), carries brand colours forward, refuses forged and out-of-tier keys, stays idempotent across a template change, and never leaks a cross-tenant write.
- Six isolation fixtures (`catalog.test.ts`, `claims.test.ts`, `merchant-context.test.ts`, `order-actions.test.ts`, `read-only.test.ts`, `trial.test.ts`) repaired for 05-11's `saveBrandingSchema.templateKey` requirement — closes the `deferred-items.md` entry that explicitly named this plan as the fix's home.
- Every required negative control (both for Task 1's tier gate and silent-publish regressions, and Task 2's flagship-revert and tier-gate-removal regressions) was performed once, confirmed to fail the suite, and reverted with a clean `git diff --stat`.

## Task Commits

1. **Task 1: Prove the switch, the gate, the publish and the discard** — `5c34ad9` (test)
2. **Task 2: Prove the onboarding seed picks the merchant's template** — `61621a9` (test)
3. **Deferred-item fix: six shared saveBranding fixtures** — `3826443` (fix)
4. **Lint/typecheck fixup on template-switch.test.ts** — `ad047e4` (fix)

_No plan-metadata commit yet — STATE.md/ROADMAP.md updates are explicitly out of scope for this executor per the orchestrator's instructions; the orchestrator will run that step separately._

## Files Created/Modified

- `tests/isolation/template-switch.test.ts` — real-session isolation suite for `switchTemplate`/`publishStorefront`/`discardDraft`.
- `tests/isolation/onboarding-template.test.ts` — real-session isolation suite for `saveBranding`'s template-seeding half.
- `tests/isolation/catalog.test.ts`, `claims.test.ts`, `merchant-context.test.ts`, `order-actions.test.ts`, `read-only.test.ts`, `trial.test.ts` — each gained `templateKey: "flagship-fashion"` in its shared `saveBranding` fixture call.

## Decisions Made

- **Tier-refusal construction (D-06/D-12).** Built the opposite way from `storefront-editor.test.ts`'s EDIT-03 case: an untouched, freshly-issued trial (active) rather than a locked/expired one, so `canEditStorefront` is true via D-15 and the refusal can only come from `assertTemplateAccess` reading `ctx.plan.tier` directly. Verified by asserting `resolveEntitlements` on the fixture's own organization row before exercising the gate.
- **Pitfall 5's "never published" state.** No production code path leaves a tenant with a genuinely null/unparseable `published` document — `saveBranding` always publishes immediately (ONB-04). Constructed the scenario the same way `storefront-editor.test.ts`'s `STALE_DRAFT` constant does: write straight through `scopedDb`, bypassing every action, using `Prisma.DbNull` for the nullable `published` column and a malformed object for the non-nullable `publishedTokens` column (which needed content that fails `themeTokensSchema`, not a null value, since the column itself is non-nullable).
- **Six deferred fixtures.** Per the orchestrator's explicit instruction and `deferred-items.md`'s own recommendation, fixed all six `saveBranding` call sites still missing `templateKey` in one pass, matching the fix already applied to `storefront-editor.test.ts`/`branding.test.ts` by 05-11.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `expectOk`'s generic return type did not narrow to the success branch**
- **Found during:** Task 1, running `npm run typecheck`
- **Issue:** `expectOk<T extends {ok:boolean}>(): Promise<T>` returns the full `ActionResult` union, so reading `.tokens`/`.document`/`.templateKey` off a call like `const switched = await expectOk(switchTemplate(...))` failed to typecheck (`Property 'tokens' does not exist on type '{ ok: false; ... }'`). No prior isolation file had ever read a data field off `expectOk`'s return value — every existing usage discards the result and re-reads state from the database instead — so this gap was previously invisible.
- **Fix:** Narrowed the return type to `Promise<Extract<T, { ok: true }>>` with a matching `as` cast (compile-time only; zero runtime change).
- **Files modified:** `tests/isolation/template-switch.test.ts`
- **Verification:** `npm run typecheck` clean for both new files (only the 11 pre-existing, already-documented `LayoutProps`/`PageProps` errors remain, unrelated to this plan).
- **Committed in:** `ad047e4`

**2. [Rule 1 - Bug] Unused `STALE_PUBLISHED` constant left `npm run lint` failing**
- **Found during:** Task 1, running `npm run lint`
- **Issue:** An earlier draft of the Pitfall 5 fallback case defined a `STALE_PUBLISHED` document literal, then the final implementation used `Prisma.DbNull` instead, leaving the constant unused (`@typescript-eslint/no-unused-vars`, zero-warning gate).
- **Fix:** Removed the dead constant.
- **Files modified:** `tests/isolation/template-switch.test.ts`
- **Verification:** `npm run lint` exits 0.
- **Committed in:** `ad047e4`

**3. [explicit orchestrator instruction, not a deviation rule] Six deferred `saveBranding` fixtures**
- **Found during:** Pre-execution review of `deferred-items.md` per the orchestrator's own instructions
- **Issue:** 05-11 added a required `templateKey` field to `saveBrandingSchema`; six isolation files still called `saveBranding({...})` with a literal object missing it, and would fail their own fixture setup on the next `test:full` run.
- **Fix:** Added `templateKey: "flagship-fashion"` to each of the six call sites, matching the established fix pattern.
- **Files modified:** `tests/isolation/catalog.test.ts`, `claims.test.ts`, `merchant-context.test.ts`, `order-actions.test.ts`, `read-only.test.ts`, `trial.test.ts`
- **Verification:** All six run clean as a batch except one known, pre-existing transaction-contention timeout in `claims.test.ts` (documented flake class — `deferred-items.md` already names the same failure mode for `merchant-context.test.ts`), confirmed to pass when re-run in isolation and again when the specific failing test was targeted alone with `-t`.
- **Committed in:** `3826443`

---

**Total deviations:** 2 auto-fixed (Rule 1/Rule 3, both mechanical gate fixes) + 1 explicitly-directed out-of-scope fix (the six deferred fixtures, directed by the orchestrator's own task description, not self-initiated scope creep).
**Impact on plan:** None of the three changed the tests' behavior or assertions — two are compile/lint-only fixes with zero runtime effect, and the third closes a documented, pre-existing gap the orchestrator explicitly asked this plan to close.

## Issues Encountered

- The full six-file deferred-fixture batch run showed two `claims.test.ts` failures ("Test timed out in 30000ms") when run together with the other five files in one Vitest invocation. Re-running `claims.test.ts` alone reproduced only one of the two, and targeting that one test alone with `-t` passed cleanly — consistent with the pre-existing, already-documented transaction-slot-contention flake class (`deferred-items.md`'s "From 05-02 Task 3" and "From 05-11 Task 3" entries both name the same failure signature against the shared remote Neon test branch under concurrent `seedTwoTenants()` calls). Not a regression from the `templateKey` fix — the failure occurs before `saveBranding` is ever called, inside `signUpMerchant`'s own transaction.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Both of this plan's isolation suites, and all six repaired shared fixtures, are ready for the next full `test:full` run.
- Phase 5's remaining work is Wave 6 (05-22), the final phase gate with its blocking human-verify checkpoints (live-preview device pass, Design-Distinctiveness stranger test folding in Phase 4's deferred Wave 7 Task 3 per D-14) — not touched by this plan.
- No blockers identified for 05-22.

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-07*

## Self-Check: PASSED

All 9 claimed files verified present on disk; all 4 claimed commit hashes
(`5c34ad9`, `61621a9`, `3826443`, `ad047e4`) verified present in `git log`.
