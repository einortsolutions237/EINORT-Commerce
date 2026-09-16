---
phase: 6
slug: merchant-dashboard-platform-admin
status: gate-tasks-1-2-complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-13
updated: 2026-09-16
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10, two projects declared in `vitest.config.ts` |
| **Config file** | `vitest.config.ts` (project `unit`: `tests/unit/**`, `server-only` aliased to a stub; project `isolation`: `tests/isolation/**`, real DB via `TEST_DATABASE_URL`) |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm run test:full` (`dotenv -e .env.test -- vitest run`) |
| **Estimated runtime** | ~22-27 min for the full isolation suite today; expect growth — this phase registers three new tenant-scoped models (~9 generic isolation assertions each) |

Other gates: `npm run lint` (`--max-warnings=0`), `npm run typecheck`. Per-task gates use `test:unit` + `lint` + `typecheck` only; `test:full` belongs at wave merges and the phase gate.

---

## Sampling Rate

- **After every task commit:** `npm run lint && npm run typecheck && npm run test:unit`
- **After every plan wave:** `npm run test:full`
- **Before `/gsd:verify-work`:** Full suite must be green, plus both manual-only verifications below signed off
- **Max feedback latency:** ~30s for the unit gate; isolation suite is a wave-boundary cost, not a per-task one

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01 | 06-01 | 1 | ADM-01 | T-06-01 | Non-admin session hitting `/admin` gets the root 404, not a redirect/403 (D-06) | isolation | `vitest run tests/isolation/admin-access.test.ts` | ✅ exists | ✅ green |
| 06-14 | 06-14 | 6 | ADM-01 | T-06-02 | `Organization.status` has exactly one writer in `src/` | unit (source scan) | `vitest run tests/unit/single-org-status-writer.test.ts` | ✅ exists | ✅ green |
| 06-14 | 06-14 | 6 | ADM-01 | T-06-03 | Suspending a tenant makes its storefront resolve not-found and its owner's dashboard `/suspended` (D-15/D-16) | isolation | `vitest run tests/isolation/suspension.test.ts` | ✅ exists | ✅ green |
| 06-07/06-10 | 06-07, 06-10 | 2-3 | ADM-02 | — | The admin ledger reads across tenants; the merchant queue still cannot | isolation | `vitest run tests/isolation/claims.test.ts` (extended) | ✅ exists | ✅ green |
| 06-08 | 06-08 | 3 | ADM-03 | — | Domain status derives purely from `Organization.slug` + `status` (D-21) | unit | `vitest run tests/unit/domain-status.test.ts` | ✅ exists | ✅ green |
| 06-03 | 06-03 | 1 | ADM-05 | T-06-04 | `SupportMessage`/`SupportAttachment` are tenant-isolated | isolation (generic) | `vitest run tests/isolation/tenant-isolation.test.ts` | ✅ exists (auto-generated once registered) | ✅ green |
| 06-12 | 06-12 | 5 | ADM-05 | — | Unread counts derive from rows, no counter column | unit (schema/source inspection) | N/A — no dedicated regression test; proven structurally (no `SupportThread`/counter-column model exists in `prisma/schema.prisma`, and `unreadThreadCount`/`unreadByTenant` in `src/server/admin/support.ts:199-221` derive the count from a live `groupBy` over `SupportMessage.readByPlatformAt`, not a stored counter) | ❌ no isolation-level regression test written | ⚠️ structural proof only — genuine coverage gap, not a false claim |
| 06-04/06-09 | 06-04, 06-09 | 2-3 | ADM-05 | — | The Support nav item is reachable and the gold-accent budget (D-02) is respected | unit | `vitest run tests/unit/dashboard-nav.test.ts` | ✅ exists (extended) | ✅ green |
| 06-06 | 06-06 | 2 | ADM-05 | — | Email nudge (D-09) degrades loudly when Resend is unconfigured | unit | `vitest run tests/unit/support-notify.test.ts` (console.warn spy, per `cart`/`tracking-token` precedent) | ✅ exists | ✅ green |
| 06-15 | 06-15 | 5 | SUB-03 | T-06-05 | A duplicate normalized payment reference is refused (global uniqueness, not per-tenant) | isolation | `vitest run tests/isolation/subscription-claims.test.ts` | ✅ exists | ✅ green |
| 06-16 | 06-16 | 6 | SUB-03 | T-06-06 | Confirming a subscription claim is idempotent under a double-tap | isolation | same file | ✅ exists | ✅ green |
| 06-05 | 06-05 | 2 | DASH-01/02 | — | The attention band's queries return correct counts for pending claims / low stock / disputed orders | isolation | `vitest run tests/isolation/dashboard-attention.test.ts` | ✅ exists | ✅ green |
| 06-05 | 06-05 | 2 | DASH-02 | — | Low-stock threshold is a single exported constant, no scattered literals | unit | folded into the attention-band test / `LOW_STOCK_THRESHOLD` export in `src/server/dashboard/queries.ts` | ✅ exists | ✅ green |
| 06-01 | 06-01 | 1 | ADM-01..05 | T-06-07 | The admin identity function takes no parameters (mirrors `requireMerchantContext`) | unit (source scan) | `vitest run tests/unit/no-tenant-id-param.test.ts` (extended to `src/server/admin/**`) | ✅ exists (extended) | ✅ green |
| 06-17 T1 | 06-17 | 7 | DASH-01, DASH-02, ADM-01..05, SUB-03 | T-06-90 | Every Phase 6 requirement has a real artifact on disk, and the admin route tree contains exactly its pilot-scoped six routes and no more (ADM-04 ceiling) | unit (source scan) | `vitest run tests/unit/phase-06-requirement-coverage.test.ts` | ✅ exists | ✅ green |

*Corrected 2026-09-16 by plan 06-17 Task 2, against the actual executed plans. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky/gap. The one row still carrying a real gap (unread-count regression coverage) is left flagged rather than marked green — see the row's own note.*

---

## Wave 0 Requirements

- [x] `tests/isolation/admin-access.test.ts` — covers ADM-01/D-06 (anonymous, merchant, and admin sessions against `/admin`) — built by plan 06-01
- [x] `tests/unit/single-org-status-writer.test.ts` — covers ADM-01/D-17 (modeled on `single-order-state-writer.test.ts`) — built by plan 06-14
- [x] `tests/isolation/suspension.test.ts` — covers ADM-01/D-15/D-16 end to end — built by plan 06-14
- [x] `tests/isolation/subscription-claims.test.ts` — covers SUB-03 — built by plan 06-15, extended by 06-16
- [x] `tests/isolation/dashboard-attention.test.ts` — covers DASH-02 — built by plan 06-05
- [x] `tests/unit/domain-status.test.ts` — covers ADM-03/D-21 — built by plan 06-08
- [x] `tests/unit/support-notify.test.ts` — covers ADM-05/D-09 degradation — built by plan 06-06
- [x] **Extensions to existing tests (not new files, but blocking):** `dashboard-nav.test.ts` (gold budget + `REQUIRED_HREFS`) — extended by 06-04, 06-09; `no-tenant-id-param.test.ts` (admin zone) — extended by 06-01; `seed-two-tenants.ts` + `tenant-isolation.test.ts` (three new models registered) — extended by 06-03
- [x] No framework install needed — Vitest and both projects are already configured (confirmed: zero packages installed across the entire phase, per 06-RESEARCH.md § Package Legitimacy Audit and T-06-SC)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| The one-off admin-account bootstrap script correctly sets `platformRole="admin"` on the intended user and no other | ADM-01..05 | `platformRole` is `input: false` by design — no API path can set it, so the bootstrap is a `tsx` script run once against production data; a source-scanning test can't verify a script ran correctly against the *real* target row | Run the bootstrap script against the developer's own account in dev, confirm `/admin` becomes reachable for that session and remains an indistinguishable 404 for every other session |
| A full merchant↔platform support-thread round trip: a merchant sends a message with an attachment, the owner receives it in the Super Admin inbox with correct unread state, replies, the merchant sees the reply and unread badge clears; a suspend action posts its reason into the same thread | ADM-05, D-07 through D-17 | End-to-end UX across two sessions (merchant + admin), email delivery, and file upload — no automated test exercises the full human experience of the thread or confirms the suspend-reason message reads naturally | Log in as a merchant and as the bootstrapped admin in two browser sessions; exchange messages with an attachment both ways; suspend the merchant from Super Admin with a reason and confirm it appears in the thread and the merchant hits `/suspended` on next dashboard load |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — the sole exception (unread-count regression coverage, see Per-Task Verification Map) is flagged honestly as a gap rather than claimed green
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — the one gap is a single row, bounded on both sides by automated-verify rows
- [x] Wave 0 covers all MISSING references — every file the table above marked `❌ W0` at planning time now exists and passes
- [x] No watch-mode flags — `npm run test:unit` (`vitest run tests/unit --reporter=dot`) and `npm run test:full` (`dotenv -e .env.test -- vitest run`) both use `run`, never `watch`
- [x] Feedback latency < 30s (unit gate) — `npm run test:unit` completed in 6.70s (715/715 tests, 45 files) during plan 06-17 Task 1's gate run
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Tasks 1-2 (automated gate + documentation corrections) complete and verified 2026-09-16 by plan 06-17. Task 3 (the two manual-only verifications below) is still pending — full phase approval awaits the developer's sign-off on Task 3, not this document alone.
