---
phase: 6
slug: merchant-dashboard-platform-admin
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-13
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
| TBD-01 | TBD | 1 | ADM-01 | T-06-01 | Non-admin session hitting `/admin` gets the root 404, not a redirect/403 (D-06) | isolation | `vitest run tests/isolation/admin-access.test.ts` | ❌ W0 | ⬜ pending |
| TBD-02 | TBD | 1 | ADM-01 | T-06-02 | `Organization.status` has exactly one writer in `src/` | unit (source scan) | `vitest run tests/unit/single-org-status-writer.test.ts` | ❌ W0 | ⬜ pending |
| TBD-03 | TBD | 1 | ADM-01 | T-06-03 | Suspending a tenant makes its storefront resolve not-found and its owner's dashboard `/suspended` (D-15/D-16) | isolation | `vitest run tests/isolation/suspension.test.ts` | ❌ W0 | ⬜ pending |
| TBD-04 | TBD | 2 | ADM-02 | — | The admin ledger reads across tenants; the merchant queue still cannot | isolation | extend `tests/isolation/claims.test.ts` | ✅ exists — extend | ⬜ pending |
| TBD-05 | TBD | 2 | ADM-03 | — | Domain status derives purely from `Organization.slug` + `status` (D-21) | unit | `vitest run tests/unit/domain-status.test.ts` | ❌ W0 | ⬜ pending |
| TBD-06 | TBD | 1-2 | ADM-05 | T-06-04 | `SupportMessage`/`SupportAttachment` are tenant-isolated | isolation (generic) | `vitest run tests/isolation/tenant-isolation.test.ts` | ✅ auto-generated once registered | ⬜ pending |
| TBD-07 | TBD | 2 | ADM-05 | — | Unread counts derive from rows, no counter column | unit (schema scan) | fold into a new contract test | ❌ W0 | ⬜ pending |
| TBD-08 | TBD | 2 | ADM-05 | — | The Support nav item is reachable and the gold-accent budget (D-02) is respected | unit | `vitest run tests/unit/dashboard-nav.test.ts` | ✅ exists — **must be extended** | ⬜ pending |
| TBD-09 | TBD | 2 | ADM-05 | — | Email nudge (D-09) degrades loudly when Resend is unconfigured | unit | `vitest run tests/unit/support-notify.test.ts` (console.warn spy, per `cart`/`tracking-token` precedent) | ❌ W0 | ⬜ pending |
| TBD-10 | TBD | 2-3 | SUB-03 | T-06-05 | A duplicate normalized payment reference is refused (global uniqueness, not per-tenant) | isolation | `vitest run tests/isolation/subscription-claims.test.ts` | ❌ W0 | ⬜ pending |
| TBD-11 | TBD | 2-3 | SUB-03 | T-06-06 | Confirming a subscription claim is idempotent under a double-tap | isolation | same file | ❌ W0 | ⬜ pending |
| TBD-12 | TBD | 1 | DASH-01/02 | — | The attention band's queries return correct counts for pending claims / low stock / disputed orders | isolation | `vitest run tests/isolation/dashboard-attention.test.ts` | ❌ W0 | ⬜ pending |
| TBD-13 | TBD | 1 | DASH-02 | — | Low-stock threshold is a single exported constant, no scattered literals | unit | fold into the attention-band test | ❌ W0 | ⬜ pending |
| TBD-14 | TBD | all | ADM-01..05 | T-06-07 | The admin identity function takes no parameters (mirrors `requireMerchantContext`) | unit (source scan) | extend `tests/unit/no-tenant-id-param.test.ts` to cover `src/server/admin/**` | ✅ exists — extend | ⬜ pending |

*Plan/wave/task IDs are placeholders (`TBD`) — the planner fills these in against the actual PLAN.md task breakdown. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/isolation/admin-access.test.ts` — covers ADM-01/D-06 (anonymous, merchant, and admin sessions against `/admin`)
- [ ] `tests/unit/single-org-status-writer.test.ts` — covers ADM-01/D-17 (modeled on `single-order-state-writer.test.ts`)
- [ ] `tests/isolation/suspension.test.ts` — covers ADM-01/D-15/D-16 end to end
- [ ] `tests/isolation/subscription-claims.test.ts` — covers SUB-03
- [ ] `tests/isolation/dashboard-attention.test.ts` — covers DASH-02
- [ ] `tests/unit/domain-status.test.ts` — covers ADM-03/D-21
- [ ] `tests/unit/support-notify.test.ts` — covers ADM-05/D-09 degradation
- [ ] **Extensions to existing tests (not new files, but blocking):** `dashboard-nav.test.ts` (gold budget + `REQUIRED_HREFS`), `no-tenant-id-param.test.ts` (admin zone), `seed-two-tenants.ts` + `tenant-isolation.test.ts` (three new models registered)
- [ ] No framework install needed — Vitest and both projects are already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| The one-off admin-account bootstrap script correctly sets `platformRole="admin"` on the intended user and no other | ADM-01..05 | `platformRole` is `input: false` by design — no API path can set it, so the bootstrap is a `tsx` script run once against production data; a source-scanning test can't verify a script ran correctly against the *real* target row | Run the bootstrap script against the developer's own account in dev, confirm `/admin` becomes reachable for that session and remains an indistinguishable 404 for every other session |
| A full merchant↔platform support-thread round trip: a merchant sends a message with an attachment, the owner receives it in the Super Admin inbox with correct unread state, replies, the merchant sees the reply and unread badge clears; a suspend action posts its reason into the same thread | ADM-05, D-07 through D-17 | End-to-end UX across two sessions (merchant + admin), email delivery, and file upload — no automated test exercises the full human experience of the thread or confirms the suspend-reason message reads naturally | Log in as a merchant and as the bootstrapped admin in two browser sessions; exchange messages with an attachment both ways; suspend the merchant from Super Admin with a reason and confirm it appears in the thread and the merchant hits `/suspended` on next dashboard load |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (unit gate)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
