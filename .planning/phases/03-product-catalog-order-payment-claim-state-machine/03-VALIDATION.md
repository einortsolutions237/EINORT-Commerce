---
phase: 3
slug: product-catalog-order-payment-claim-state-machine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-23
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10, two projects (`unit`, `isolation`) — already established in Phases 1-2 |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npm run test:unit` (`vitest run tests/unit --reporter=dot`, no DB, target < 2s) |
| **Full suite command** | `npm run test:full` (`dotenv -e .env.test -- vitest run`) |
| **Current baseline** | 250 passing, 0 skipped, 19 files (inherited from Phases 1-2) |
| **Other gates** | `npm run lint --max-warnings=0`, `npm run typecheck` — the lint gate *is* the TEN-02/TEN-05 enforcement mechanism |

---

## Sampling Rate

- **Per task commit:** `npm run test:unit && npm run lint && npm run typecheck` (<2s, no DB)
- **Per wave merge:** `npm run test:full`
- **Phase gate:** full suite green (≥250 inherited + new, 0 skipped) before `/gsd:verify-work`, plus a manual Android + iOS pass on the manual-transfer checkout page (tap-to-dial vs. manual-copy rendering)

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| CAT-01 | Product + 2-axis variant matrix creation; variant uniqueness | isolation | `vitest run --project isolation tests/isolation/catalog.test.ts` | ❌ W0 |
| CAT-01 | Product creation refused at the tier's product cap | unit + isolation | `vitest run --project unit tests/unit/product-limit.test.ts` | ❌ W0 |
| CAT-02 | Sharp pipeline produces the 3 derivatives at the right dimensions | unit | `vitest run --project unit tests/unit/image-pipeline.test.ts` | ❌ W0 |
| CAT-02 | Presigned key is always under `tenants/{ctx.tenantId}/` regardless of input | unit | `vitest run --project unit tests/unit/r2-key.test.ts` | ❌ W0 |
| **CAT-03** | **Two concurrent placements for the last unit: exactly one succeeds** | **isolation** | `vitest run --project isolation tests/isolation/stock-race.test.ts` | ❌ **W0 — phase's single most important test** |
| CAT-03 | Multi-line orders do not deadlock (sorted decrement) | isolation | same file, second case | ❌ W0 |
| CHK-01 | Cart survives a refresh; cart bound to the wrong tenant is discarded | unit | `vitest run --project unit tests/unit/cart.test.ts` | ❌ W0 |
| CHK-02 | `wa.me` link format, number normalization, message encoding | unit | `vitest run --project unit tests/unit/whatsapp.test.ts` | ❌ W0 |
| CHK-03 | `buildMerchantUssd` returns the MTN string only with a valid 6-digit code; `#` is `%23`; null otherwise | unit | `vitest run --project unit tests/unit/ussd.test.ts` | ❌ W0 |
| CHK-03 | iOS renders manual copy, no `tel:` anchor | manual | — | Manual pilot check; UA branching is unit-testable, real-device behaviour is not |
| CHK-04 | Claim submission requires a valid token; wrong/absent token 404s identically | isolation | `vitest run --project isolation tests/isolation/tracking-token.test.ts` | ❌ W0 |
| CHK-05 | Every `OrderState` maps to non-empty customer copy (exhaustive) | unit | `vitest run --project unit tests/unit/order-status-copy.test.ts` | ❌ W0 |
| ORD-01 | Every legal transition allowed, every illegal one refused, channel rules enforced | unit | `vitest run --project unit tests/unit/state-machine.test.ts` | ❌ W0 |
| ORD-02 | `PAYMENT_CLAIMED → CONFIRMED` with actor `CUSTOMER` or `SYSTEM` is refused | unit | same file | ❌ W0 |
| ORD-03 | Confirm/reject are refused for another tenant's claim id | isolation | `vitest run --project isolation tests/isolation/claims.test.ts` | ❌ W0 |
| ORD-04 | Duplicate normalized reference rejected within a tenant; the same reference IS accepted in a different tenant | isolation | same file | ❌ W0 — cross-tenant half proves the constraint is scoped, not global |
| ORD-05 | Every transition writes exactly one `OrderEvent` with the correct actor; no state change without one | isolation | `vitest run --project isolation tests/isolation/order-audit.test.ts` | ❌ W0 |
| TEN-02 | New models registered; unregistered model throws | isolation | `tests/isolation/model-registry-drift.test.ts` | ✅ exists — will fail if a model is missed |
| TEN-08 | A forged price/quantity in the placement payload is ignored | isolation | `tests/isolation/checkout-trust.test.ts` | ❌ W0 — mirror `plan-selection.test.ts`'s forged-tenant-id approach |
| Pattern 4 | Extension still injects `tenantId` inside `$transaction` | isolation | `tests/isolation/tenant-isolation.test.ts` (extend) | ✅ file exists, ❌ case to add |

---

## Wave 0 Requirements

- [ ] `src/server/db/enums.ts` — re-export generated Prisma enums past the ESLint import zone (Pitfall 10); blocks nearly every other file in this phase
- [ ] `ScopedTx` type alias in `src/server/db/tenant-scoped.ts` (Pattern 4 — tenant-scoped transactions)
- [ ] `tests/isolation/stock-race.test.ts` — CAT-03, the phase's highest-value test
- [ ] `tests/unit/state-machine.test.ts` — ORD-01/ORD-02
- [ ] `tests/unit/ussd.test.ts`, `tests/unit/whatsapp.test.ts`, `tests/unit/phone.test.ts` — CHK-02/CHK-03
- [ ] `tests/isolation/order-audit.test.ts` — ORD-05
- [ ] `tests/isolation/claims.test.ts` — ORD-03/ORD-04 (including the cross-tenant-reference-reuse case)
- [ ] `tests/isolation/checkout-trust.test.ts` — TEN-08
- [ ] `tests/isolation/catalog.test.ts`, `tests/unit/product-limit.test.ts`, `tests/unit/image-pipeline.test.ts`, `tests/unit/r2-key.test.ts`, `tests/unit/cart.test.ts`, `tests/isolation/tracking-token.test.ts`, `tests/unit/order-status-copy.test.ts`
- [ ] Extend `tests/setup/seed-two-tenants.ts` with catalog + order fixtures for both tenants
- [ ] Add the extension-inside-`$transaction` case to `tests/isolation/tenant-isolation.test.ts`
- [ ] R2 bucket provisioning + `src/env.ts` additions (`checkpoint:human-verify` — external service setup)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| iOS renders manual-copy only, no dead `tel:` button | CHK-03 | Real-device Phone-app behavior for `tel:` URIs containing `*`/`#` cannot be simulated in a test runner (Apple's own docs confirm the Phone app silently refuses these) | Human-verify walkthrough at phase gate: open checkout on an actual iPhone (or iOS Simulator with a real Phone app), confirm no tap-to-dial button renders, only selectable receiving-number + amount text |
| Android tap-to-dial opens the dialer pre-filled correctly | CHK-03 | Real-device dialer behavior | Human-verify walkthrough: open checkout on an actual Android device where the merchant has a code configured, confirm the dialer opens pre-filled with the correct MTN string |
| WhatsApp order flow feels natural end-to-end | CHK-02 | Subjective UX + real WhatsApp app behavior (message truncation, deep-link handoff) | Human-verify walkthrough: place a WhatsApp order, confirm the app opens with a readable, correctly pre-filled message |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (all rows above currently ❌ W0)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s (quick) — inherited from Phases 1-2
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 lands

**Approval:** pending
