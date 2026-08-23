---
phase: 2
slug: merchant-auth-entitlements-trial
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10, two projects (`unit`, `isolation`) — already established in Phase 1 |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npm run test:unit` (`vitest run tests/unit --reporter=dot`) |
| **Full suite command** | `npm run test:full` (`dotenv -e .env.test -- vitest run`) |
| **Current baseline** | 186 passing, 0 skipped, 10 files (inherited from Phase 1) |
| **Other gates** | `npm run lint --max-warnings=0`, `npm run typecheck`, `npx next build` |

`unit` project is node-environment, no DB/network — `resolveEntitlements(org, now)` takes `now` as a parameter specifically so trial-boundary math is unit-testable. `isolation` runs serially against the Neon test branch; reuse `tests/isolation/signup.test.ts`'s cookie-jar harness (`vi.mock("next/headers")` + real `nextCookies()`) for anything touching Better Auth or Prisma — do not mock Better Auth itself.

---

## Sampling Rate

- **Per task commit:** `npm run test:unit` (<2s, no DB)
- **Per wave merge:** `npm run test:full` + `npm run lint` + `npm run typecheck` + `npx next build`
- **Phase gate:** full suite green (≥186 inherited + new, 0 skipped) before `/gsd:verify-work`, plus the human-verify walkthrough

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| ONB-05 | `resolveEntitlements` returns `trial.state === "active"` on day 1 and day 9 | unit | `npx vitest run tests/unit/entitlements.test.ts -t "trial active"` | ✅ `tests/unit/entitlements.test.ts` |
| ONB-05 | Boundary: `now === endsAt` is expired, `now === endsAt - 1ms` is active | unit | `… -t "trial boundary"` | ✅ `tests/unit/entitlements.test.ts` |
| ONB-05 | `daysLeft` is never negative and is 10 at t=0 | unit | `… -t "daysLeft"` | ✅ `tests/unit/entitlements.test.ts` |
| ONB-05 | A real signup produces an org whose derived `trialEndsAt` is `createdAt + 10d` | integration | `npx dotenv -e .env.test -- npx vitest run tests/isolation/trial.test.ts -t "trial anchored to createdAt"` | ✅ `tests/isolation/trial.test.ts` |
| TEN-04 | `requireMerchantContext()` returns `tenantId === session.activeOrganizationId` after a real `signInEmail` | integration | `… tests/isolation/merchant-context.test.ts -t "tenant from session"` | ✅ `tests/isolation/merchant-context.test.ts` |
| TEN-04 | No exported merchant function accepts a tenant id — source-level assertion over `src/server/merchant/**` | unit | `… tests/unit/no-tenant-id-param.test.ts` | ✅ `tests/unit/no-tenant-id-param.test.ts` |
| TEN-04 | Merchant A's session cannot read Merchant B's data through the DAL (two-tenant fixture) | integration | `… tests/isolation/merchant-context.test.ts -t "cross-tenant"` | ✅ `tests/isolation/merchant-context.test.ts` |
| SUB-01 | `PLANS` is exhaustive over `PLAN_TIERS`, every tier has every limit key | unit | `… tests/unit/entitlements.test.ts -t "registry"` | ✅ `tests/unit/entitlements.test.ts` |
| SUB-01 | `membershipLimit` resolves 1 / 4 / 11 per tier, and 1 (not 100) when `planTier` is null | unit | `… -t "member limit"` | ✅ `tests/unit/entitlements.test.ts` |
| SUB-01 | `POST /organization/add-member` on a Starter org refused with `ORGANIZATION_MEMBERSHIP_LIMIT_REACHED` — through the real endpoint | integration | `… tests/isolation/entitlements.test.ts -t "starter refuses second member"` | ✅ `tests/isolation/entitlements.test.ts` |
| SUB-02 | A `mode: "write"` action returns the read-only error when the trial is expired | integration | `… tests/isolation/read-only.test.ts -t "write refused"` | ✅ `tests/isolation/read-only.test.ts` |
| SUB-02 | A `mode: "read"` action still succeeds when the trial is expired (D-08: read-only, not lockout) | integration | `… -t "read still allowed"` | ✅ `tests/isolation/read-only.test.ts` |
| SUB-02 | A forged `{ tier, organizationId: <other> }` payload cannot retarget the write | integration | `… -t "forged organizationId ignored"` | ✅ `tests/isolation/read-only.test.ts` |
| SUB-02 | `POST /api/auth/organization/update {"data":{"slug":"admin"}}` refused (the live unguarded-endpoint gap) | integration | `… tests/isolation/org-endpoints.test.ts -t "update slug refused"` | ✅ `tests/isolation/org-endpoints.test.ts` |
| SUB-02 | `POST /api/auth/organization/delete` refused | integration | `… -t "delete refused"` | ✅ `tests/isolation/org-endpoints.test.ts` |
| SUB-02 (A7) | The 4th rapid `/sign-in/email` in a 10s window is refused — behaviourally, not by reading config | integration | `… tests/isolation/login.test.ts -t "login throttled"` | ✅ `tests/isolation/login.test.ts` |
| D-05 (Ctx) | A merchant with `planTier === null` reaching the dashboard is redirected to `/onboarding/plan` | integration | `… tests/isolation/merchant-context.test.ts -t "plan gate"` | ✅ `tests/isolation/merchant-context.test.ts` |
| D-11/D-12 | Banner urgency threshold flips at the documented day count | unit | `… tests/unit/entitlements.test.ts -t "urgency"` | ✅ `tests/unit/entitlements.test.ts` |
| D-01/D-02 | Plan screen renders three tiers, correct prices, "Most Popular" on Business, English copy | manual-only | human-verify walkthrough (UI-SPEC) | n/a |
| D-08 | Read-only dashboard reads as intentional, not broken | manual-only | human-verify walkthrough | n/a |

---

## Wave 0 Requirements

- [x] `tests/unit/entitlements.test.ts` — ONB-05 (trial math, boundaries, urgency), SUB-01 (registry exhaustiveness, member limits)
- [x] `tests/unit/no-tenant-id-param.test.ts` — TEN-04 source-level guard over `src/server/merchant/**` and `src/server/entitlements/**`
- [x] `tests/isolation/merchant-context.test.ts` — TEN-04 (session-derived tenant, cross-tenant refusal, plan gate)
- [x] `tests/isolation/login.test.ts` — login round trip, `activeOrganizationId` on the new session, throttling (A7)
- [x] `tests/isolation/read-only.test.ts` — SUB-02 write gate, read allowance, forged-payload rejection
- [x] `tests/isolation/org-endpoints.test.ts` — raw calls to `/organization/{update,delete,add-member,invite-member}` (closes the live unguarded-endpoint gap the research found)
- [x] `tests/isolation/trial.test.ts` — trial anchored to `createdAt` through a real signup
- [x] No new framework, config, or fixture infrastructure required — `tests/setup/seed-two-tenants.ts` and the `signup.test.ts` cookie-jar harness already cover what these need.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Plan-selection screen renders correctly (three tiers, prices, "Most Popular" badge, English copy) | D-01/D-02 | Rendered appearance, not automatable | Human-verify walkthrough at phase gate |
| Read-only dashboard reads as an intentional state, not a broken one | D-08 | Subjective UX judgment | Human-verify walkthrough at phase gate |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (every row in the per-task map above now resolves to an existing, passing spec file)
- [x] No watch-mode flags
- [x] Feedback latency < 10s (quick) — inherited from Phase 1
- [x] `nyquist_compliant: true` set in frontmatter once Wave 0 lands

Automated gate, run 2026-08-23: `npm run test:full` — 250/250 tests, 19 files, 0 skipped. `npm run lint` (`--max-warnings=0`), `npm run typecheck`, `npx next build` all exit 0. Smoke check: unauthenticated `/dashboard` redirects to `/login`; `/signup` and `/login` both serve at the apex; a storefront subdomain's `/dashboard` path resolves to `Store not found` rather than the merchant dashboard, confirming the route group is apex-only.

The two manual-only rows (D-01/D-02 plan-screen readability, D-08 read-only-dashboard readability) remain unticked pending the human walkthrough — see Task 2 of `02-07-PLAN.md`.

**Approval:** pending human walkthrough (Task 2)
