---
phase: 3
slug: product-catalog-order-payment-claim-state-machine
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-23
resolved: 2026-08-31
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Resolved by plan 03-16.** Every row below names a file that exists on disk
> and a command that ran green on one commit. The map is now additionally
> enforced in code: `tests/unit/phase-03-requirement-coverage.test.ts` fails the
> build if any file named here is renamed away or emptied of its assertions, so
> this document cannot quietly drift from the suite it describes.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10, two projects (`unit`, `isolation`) — already established in Phases 1-2 |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npm run test:unit` (`vitest run tests/unit --reporter=dot`, no DB) — 442 tests in 26 files, 5.6s |
| **Full suite command** | `npm run test:full` (`dotenv -e .env.test -- vitest run`) |
| **Current baseline** | **720 passing, 0 skipped, 48 files** (was 250 / 19 inherited from Phases 1-2; Phase 3 added 470 tests across 29 files) |
| **Other gates** | `npm run lint --max-warnings=0`, `npm run typecheck`, `npx next build` — the lint gate *is* the TEN-02/TEN-05 enforcement mechanism |

---

## Sampling Rate

- **Per task commit:** `npm run test:unit && npm run lint && npm run typecheck` (5.6s, no DB)
- **Per wave merge:** `npm run test:full`
- **Phase gate:** full suite green (720, 0 skipped) before `/gsd:verify-work`, plus a manual Android + iOS pass on the manual-transfer checkout page (tap-to-dial vs. manual-copy rendering) — see § Manual-Only Verifications, still open

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| CAT-01 | Product + 2-axis variant matrix creation; variant uniqueness | isolation | `vitest run --project isolation tests/isolation/catalog.test.ts` | ✅ 03-06 |
| CAT-01 | Product creation refused at the tier's product cap | unit + isolation | `vitest run --project unit tests/unit/product-limit.test.ts` | ✅ 03-06 (matrix resolver `tests/unit/variant-matrix.test.ts` same commit; live form contract `tests/unit/product-form-contract.test.ts` 03-11) |
| CAT-02 | Sharp pipeline produces the 3 derivatives at the right dimensions | unit | `vitest run --project unit tests/unit/image-pipeline.test.ts` | ✅ 03-05 |
| CAT-02 | Presigned key is always under `tenants/{ctx.tenantId}/` regardless of input | unit | `vitest run --project unit tests/unit/r2-key.test.ts` | ✅ 03-05 |
| **CAT-03** | **Two concurrent placements for the last unit: exactly one succeeds** | **isolation** | `vitest run --project isolation tests/isolation/stock-race.test.ts` | ✅ **03-07 — the phase's single most important test, green** |
| CAT-03 | Multi-line orders do not deadlock (sorted decrement) | isolation | same file, second case | ✅ 03-07 |
| CHK-01 | Cart survives a refresh; cart bound to the wrong tenant is discarded | unit | `vitest run --project unit tests/unit/cart.test.ts` | ✅ 03-09 (storefront reads `tests/isolation/storefront-catalog.test.ts`, same plan) |
| CHK-02 | `wa.me` link format, number normalization, message encoding | unit | `vitest run --project unit tests/unit/whatsapp.test.ts` | ✅ 03-08 (per-channel checkout outcomes `tests/isolation/checkout-paths.test.ts` 03-12) |
| CHK-03 | `buildMerchantUssd` returns the MTN string only with a valid 6-digit code; `#` is `%23`; null otherwise | unit | `vitest run --project unit tests/unit/ussd.test.ts` | ✅ 03-08 (number normalization `tests/unit/phone.test.ts`, same commit) |
| CHK-03 | iOS renders manual copy, no `tel:` anchor | manual | — | ⏳ **Open** — manual pilot check, see § Manual-Only Verifications. UA branching is unit-tested; real-device behaviour is not |
| CHK-04 | Claim submission requires a valid token; wrong/absent token 404s identically | isolation | `vitest run --project isolation tests/isolation/tracking-token.test.ts` | ✅ 03-14 (submission path itself `tests/isolation/claim-submission.test.ts` 03-15) |
| CHK-05 | Every `OrderState` maps to non-empty customer copy (exhaustive) | unit | `vitest run --project unit tests/unit/order-status-copy.test.ts` | ✅ 03-14 |
| ORD-01 | Every legal transition allowed, every illegal one refused, channel rules enforced | unit | `vitest run --project unit tests/unit/state-machine.test.ts` | ✅ 03-03 (merchant-facing chip map `tests/unit/order-state-chip.test.ts` 03-10) |
| ORD-02 | `PAYMENT_CLAIMED → CONFIRMED` with actor `CUSTOMER` or `SYSTEM` is refused | unit | same file | ✅ 03-03 (the confirming action itself `tests/isolation/claims.test.ts` 03-13) |
| ORD-03 | Confirm/reject are refused for another tenant's claim id | isolation | `vitest run --project isolation tests/isolation/claims.test.ts` | ✅ 03-13 (merchant order actions `tests/isolation/order-actions.test.ts` 03-10) |
| ORD-04 | Duplicate normalized reference rejected within a tenant; the same reference IS accepted in a different tenant | isolation | same file | ✅ 03-13 — cross-tenant half proves the constraint is scoped, not global (normalizer `tests/unit/claim-reference.test.ts` same plan; resubmission `tests/isolation/claim-submission.test.ts` 03-15) |
| ORD-05 | Every transition writes exactly one `OrderEvent` with the correct actor; no state change without one | isolation | `vitest run --project isolation tests/isolation/order-audit.test.ts` | ✅ 03-03 (source-level second-writer guard `tests/unit/single-order-state-writer.test.ts`, same commit) |
| TEN-02 | New models registered; unregistered model throws | isolation | `tests/isolation/model-registry-drift.test.ts` | ✅ 01-04, re-proved against Phase 3's eight new models by 03-01 |
| TEN-08 | A forged price/quantity in the placement payload is ignored | isolation | `tests/isolation/checkout-trust.test.ts` | ✅ 03-07 — mirrors `plan-selection.test.ts`'s forged-tenant-id approach, as planned |
| Pattern 4 | Extension still injects `tenantId` inside `$transaction` | isolation | `tests/isolation/tenant-isolation.test.ts` | ✅ 01-04 file, case added by 03-01 |
| Cross-plan | One writer of `Order.state`, one confirmer of a payment claim, gold spent in exactly two files | unit | `vitest run --project unit tests/unit/phase-03-requirement-coverage.test.ts` | ✅ 03-16 — re-checked independently of the plans that introduced each invariant |

---

## Wave 0 Requirements

All landed. Each box below was ticked only after the named file was confirmed on
disk and green in `npm run test:full`.

- [x] `src/server/db/enums.ts` — re-export generated Prisma enums past the ESLint import zone (Pitfall 10); blocks nearly every other file in this phase — 03-01
- [x] `ScopedTx` type alias in `src/server/db/tenant-scoped.ts` (Pattern 4 — tenant-scoped transactions) — 03-01, `tenant-scoped.ts:183`
- [x] `tests/isolation/stock-race.test.ts` — CAT-03, the phase's highest-value test — 03-07
- [x] `tests/unit/state-machine.test.ts` — ORD-01/ORD-02 — 03-03
- [x] `tests/unit/ussd.test.ts`, `tests/unit/whatsapp.test.ts`, `tests/unit/phone.test.ts` — CHK-02/CHK-03 — 03-08
- [x] `tests/isolation/order-audit.test.ts` — ORD-05 — 03-03
- [x] `tests/isolation/claims.test.ts` — ORD-03/ORD-04 (including the cross-tenant-reference-reuse case) — 03-13
- [x] `tests/isolation/checkout-trust.test.ts` — TEN-08 — 03-07
- [x] `tests/isolation/catalog.test.ts` (03-06), `tests/unit/product-limit.test.ts` (03-06), `tests/unit/image-pipeline.test.ts` (03-05), `tests/unit/r2-key.test.ts` (03-05), `tests/unit/cart.test.ts` (03-09), `tests/isolation/tracking-token.test.ts` (03-14), `tests/unit/order-status-copy.test.ts` (03-14)
- [x] Extend `tests/setup/seed-two-tenants.ts` with catalog + order fixtures for both tenants — 03-01
- [x] Add the extension-inside-`$transaction` case to `tests/isolation/tenant-isolation.test.ts` — 03-01
- [x] R2 bucket provisioning + `src/env.ts` additions (`checkpoint:human-verify` — external service setup) — 03-02, human checkpoint satisfied before that session, including the npm package-legitimacy spot-check

---

## Manual-Only Verifications

Still open. These are the three things a test runner physically cannot check,
and they are the content of plan 03-16's blocking human checkpoint. **None of
them has been signed off yet** — this section is deliberately left unticked.

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|--------------------|--------|
| iOS renders manual-copy only, no dead `tel:` button | CHK-03 | Real-device Phone-app behavior for `tel:` URIs containing `*`/`#` cannot be simulated in a test runner (Apple's own docs confirm the Phone app silently refuses these) | Human-verify walkthrough at phase gate: open checkout on an actual iPhone (or iOS Simulator with a real Phone app), confirm no tap-to-dial button renders, only selectable receiving-number + amount text | ⏳ Not attempted |
| Android tap-to-dial opens the dialer pre-filled correctly | CHK-03 | Real-device dialer behavior | Human-verify walkthrough: open checkout on an actual Android device where the merchant has a code configured, confirm the dialer opens pre-filled with the correct MTN string **including the trailing `#`** — a missing `#` is the Pitfall 9 encoding bug and fails the phase | ⏳ Not attempted |
| WhatsApp order flow feels natural end-to-end | CHK-02 | Subjective UX + real WhatsApp app behavior (message truncation, deep-link handoff) | Human-verify walkthrough: place a WhatsApp order, confirm the app opens with a readable, correctly pre-filled message | ⏳ Not attempted |

The automated half of CHK-03 is complete and green: `tests/unit/ussd.test.ts`
proves the string is built only for a valid 6-digit code and that `#` is encoded
as `%23`, and `tests/unit/phone.test.ts` proves the number normalization it
depends on. What remains is whether a real handset honours it.

---

## Resolved Questions

The five open questions 03-RESEARCH.md carried into this phase. Each
recommendation was adopted by name; the plan that made it real is noted.

1. **Does the phase need a `CANCELLED` order state? — No (03-07).**
   The state was not added: ORD-01 enumerates exactly six states and CONTEXT.md
   adds none, so a seventh would be scope the user did not ask for. What was
   built instead is `releaseStock` in `src/server/orders/stock.ts` — the
   idempotent release primitive a future Phase 6 "cancel stale order" action
   calls, so that action is a call rather than a redesign. No `SYSTEM`-actor
   sweep was added this phase.

2. **What replaces the Phase-1 storefront placeholder, and when? — The catalog
   page, now (03-09).**
   `src/app/s/[slug]/page.tsx` became the product grid, and the Phase-1
   placeholder copy became its zero-active-products empty state rather than
   being deleted. Phase 4 restyles that page; it no longer has to replace it.

3. **Which merchant email address receives the claim notification? — The
   owner's, resolved at send time (03-15).**
   `platformDb.member` → `user.email`, looked up when the notification is sent,
   with the send skipped and a warning logged if no owner row is found. No new
   column on `Organization`, and the in-app gold badge remains the reliable
   channel.

4. **Is `MANUAL_TRANSFER` selectable when the merchant has configured no
   receiving number? — No, it is not offered at all (03-08, 03-12).**
   The channel is hidden entirely at checkout when `MerchantPaymentSettings`
   carries neither an MTN nor an Orange number, and the checkout action refuses
   it server-side as well, so hiding it in the markup is not the enforcement.

5. **Does the merchant confirm/reject flow need optimistic-locking against two
   dashboard tabs? — The in-transaction status guard is the whole answer
   (03-13).**
   `if (claim.status !== "PENDING") throw new AlreadyReviewedError()` runs inside
   the transaction, before anything is written. The second tab gets a clear
   "already reviewed" message rather than silently overwriting the first.

---

## Resolved Assumptions

The two MEDIUM-risk assumptions from 03-RESEARCH.md § Assumptions Log that the
plans had to act on. Both were decided in the direction research recommended.

- **A6 — stock is re-held at `DISPUTED → PAYMENT_CLAIMED`, not at
  `→ CONFIRMED`.** Rejecting a claim releases the held units back to inventory
  (03-13 `rejectClaim` / `releaseStock`), and a corrected resubmission re-holds
  them the way a fresh order would (03-15 `submitClaim`, 03-13 `reopenClaim`).
  The consequence that had to be decided with it: **a re-hold that cannot be
  satisfied refuses the resubmission rather than moving the order.** The
  customer is told the item sold out while their payment was disputed; the
  alternative — moving the order and reconciling stock later — is the oversell
  CAT-03 exists to prevent, arriving through a different door.

- **A7 — deactivated products do not count against the plan's product cap**
  (03-06). D-08 forbids hard deletes, so counting all rows would make the cap
  ratchet down permanently: a merchant who created and retired ten products
  would be stuck at the cap with an empty store and no way to recover, because
  the recovery action (delete) does not exist. The count is filtered to active
  products, and the reasoning is recorded in the code beside the query so the
  filter does not read like an oversight and get "fixed".

---

## Validation Sign-Off

Automated gates, all green on commit `03f3298` (this phase's final code commit):

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — every row above now names a file that exists
- [x] No watch-mode flags
- [x] Feedback latency < 10s (quick) — `npm run test:unit` is 5.6s for 442 tests
- [x] Frontmatter marked nyquist-compliant once Wave 0 landed
- [x] `npm run test:full` — 720 passed, 0 failed, **0 skipped**, 48 files
- [x] `npm run lint` — exits 0 at `--max-warnings=0`, with no `eslint-disable` added by the gate
- [x] `npm run typecheck` — exits 0
- [x] Every requirement's proof is asserted in code, not just listed here (`tests/unit/phase-03-requirement-coverage.test.ts`)

Still open — the phase is not signed off until these are done:

- [ ] `npx next build` verified on the merged main checkout (see 03-16-SUMMARY.md § Deviations — Turbopack cannot resolve `next/package.json` from inside a git worktree, so the build was not verifiable here)
- [ ] iPhone: manual-transfer tracking page renders no `tel:` button at all
- [ ] Android: `Dial the payment code` opens the dialer pre-filled **including the trailing `#`**
- [ ] WhatsApp handoff reads naturally on a real handset

**Approval:** automated gates approved; manual device verification pending (plan 03-16, Task 3).
