---
phase: 06-merchant-dashboard-platform-admin
plan: 06
subsystem: support-thread-merchant-side
tags: [support, adm-05, d-09, d-12, zone-split]

requires:
  - phase: 06-merchant-dashboard-platform-admin (plan 02)
    provides: "strings.support.* copy surface"
  - phase: 06-merchant-dashboard-platform-admin (plan 03)
    provides: "SupportMessage schema, SupportAuthor enum"
provides:
  - "src/server/support/shared.ts, queries.ts, messages.ts, actions.ts, notify.ts — the full merchant-side thread domain"
  - "postSystemMessage — the reusable automated-notice primitive Phases 7-15 depend on"
  - "SupportMessageCreateInput in src/server/db/model-inputs.ts"
affects: ["06-09 (puts a screen on this)", "06-12 (the admin-zone sibling writer)", "06-14 (D-15's suspension notice, first postSystemMessage caller)"]

tech-stack:
  added: []
  patterns:
    - "scopedCreateData<T>() is required for single create() calls too, not just createMany — the CHECKED create input demands tenantId once no nested relation is supplied, exactly as it does for createMany's flat scalar rows."
    - "A merchantAction handler with no extra payload must NOT annotate its return type as Promise<ActionResult> (bare, T=void) — {ok:true} & void collapses to never in TypeScript. Leave the return type uninferred and let TS derive it from the literal, matching switchPlan's existing precedent in merchant/actions.ts."
    - "A vi.fn().mockImplementation() used as a class-under-test's `new SomeClass()` target must use `function` or `class`, never an arrow function — arrow functions have no [[Construct]] and `new` on one throws, which a catch-swallowing function under test can mask as an unrelated 'passing' assertion."

key-files:
  created:
    - "src/server/support/messages.ts"
    - "src/server/support/actions.ts"
    - "src/server/support/notify.ts"
    - "tests/unit/support-notify.test.ts"
  modified:
    - "src/server/db/model-inputs.ts"

key-decisions:
  - "Added SupportMessageCreateInput to db/model-inputs.ts (one alias per model, per that file's own discipline) so messages.ts's two create() calls could use scopedCreateData rather than hand-rolled casts."
  - "Dropped the explicit `Promise<ActionResult>` return-type annotation on markSupportThreadRead's handler — TypeScript collapses `{ok:true} & void` to `never`, which is a real gap in ActionResult<T=void>'s design that switchPlan (merchant/actions.ts) already routes around by leaving the handler's return type to be inferred rather than declared."
  - "Fixed two real bugs in the already-written support-notify.test.ts (found while running Task 3's own verification, not pre-existing/pre-reviewed): the Resend mock's arrow-function implementation crashed every `new Resend(...)` call, and missing per-test console-spy restoration let later assertions count earlier tests' calls. Fixed with cart.test.ts's inline try/finally + mockRestore() pattern rather than a blanket afterEach(vi.restoreAllMocks()), because restoreAllMocks() would have reset the Resend mock's own vi.fn() implementation to undefined for every test after the first."
  - "Strengthened the two tests the constructor bug had been passing 'by accident' (their console.error assertion was satisfied by the catch block firing on the constructor TypeError, not on the resolved-error/rejection path each test claims to prove) by adding an explicit sendMock call-count assertion, so the tests now prove what their names say."

requirements-completed: [ADM-05]

duration: ~35min (continuation of interrupted session)
completed: 2026-09-14
---

# Phase 06 Plan 06: Support Thread — Merchant Side Summary

Task 1 (shared.ts, queries.ts) was already committed from an earlier session segment. Task 2 built the write primitive (`postMerchantMessage`, `postSystemMessage`, `markThreadReadForMerchant`) and the merchant's gated Server Actions (`sendSupportMessage`, `markSupportThreadRead`), fixing two real TypeScript errors along the way (missing `SupportMessageCreateInput` model-input alias, and a `Promise<ActionResult>` void-collapse bug). Task 3 built the Resend email nudge in both directions (`notify.ts`) and its degradation unit test, fixing two bugs discovered while getting the test green: an unconstructable `Resend` mock and un-restored console spies leaking call counts across tests.

## Verification

- `npm run lint && npm run typecheck && npm run test:unit && npm run build` — all green (670/670 unit tests, clean build).
- `npx vitest run tests/unit/support-notify.test.ts` — 5/5 passed, now genuinely exercising the resolved-error and rejection channels (previously 2 of the 5 passed only because a masked constructor bug's catch-block coincidentally satisfied their assertions).
- All Task 2 and Task 3 acceptance-criteria greps re-verified directly: `"use server"` at line 1 of `actions.ts`, zero `server-only` in it; `server-only` at line 1 of `messages.ts`; `after(` present; `.trim()` precedes the length constraint; `APPEND-ONLY` present; zero `supportMessage.delete`/`deleteMany`; `merchantAction` used; `DEGRADED`, `if (error)`, `catch`, `platformRole` all present in `notify.ts`; zero bare `throw` outside comments; `src/server/claims/notify.ts` diff empty; `src/server/admin/**` imports nothing from `src/server/support/` (the directory doesn't exist yet — trivially true, real enforcement lands with 06-12).

## Session Continuity Note

Task 1's commit predates this session segment. Tasks 2 and 3's source files were found already written but uncommitted when the orchestrator resumed after a rate-limit interruption; both had real, previously-undetected bugs (a TypeScript error in messages.ts's create() typing, and two independent bugs in the notify test's mock harness) that only surfaced when the orchestrator actually ran the plan's own verification commands rather than treating "code exists" as "code verified."

## Self-Check: PASSED

All five `src/server/support/**` modules and the test file exist on disk and are committed (`e60c18d`, `14a4db0`). `src/server/db/model-inputs.ts`'s new alias is in the same commit as its first consumer. Full automated gate green.
