---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 13
subsystem: payments
tags: [payment-claims, mobile-money, prisma, server-actions, next-app-router, zod, tenant-isolation, optimistic-locking]

# Dependency graph
requires:
  - phase: 03-03
    provides: "transitionOrder + InvalidTransitionError/AlreadyReviewedError — the ORD-02 merchant-actor guard and the D-11 blank-reason guard these actions rely on rather than duplicate"
  - phase: 03-04
    provides: "src/server/claims/queries.ts with pendingClaimCount, and the complete strings.claims namespace"
  - phase: 03-07
    provides: "releaseStock / holdStockForLines and the Order.stockHeld idempotency flag"
  - phase: 03-05
    provides: "publicUrlFor + the IMAGE_PRESETS.claim derivative the screenshot thumb renders through"
  - phase: 03-10
    provides: "OrderStateChip / OrderChannelChip, reused for the operator sub-label"
provides:
  - "normalizeReference() — the pure ORD-04 uniqueness-key derivation collapsing three operator spellings of one transaction reference to one key"
  - "listClaimsForReview + findDuplicateReference — the indexed single-query read behind the A5 card queue"
  - "confirmClaim / rejectClaim / reopenClaim — the entire merchant claim-review write surface, all merchantAction write-mode"
  - "markStockHeld — the second sanctioned writer of Order.stockHeld, keeping the D-04 release invariant inside the inventory module"
  - "/dashboard/claims — the A5 card queue with one-tap confirm, screenshot lightbox and required-reason reject dialog"
  - "tests/isolation/claims.test.ts — 12 cases proving ORD-02, ORD-03, ORD-04 and D-11"
affects: [03-15, 03-16, order-notifications, platform-admin-disputes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status-guard-as-optimistic-lock: `status !== \"PENDING\"` read and checked inside the same transaction that writes, sufficient concurrency control at this scale"
    - "Normalized-key column pairing: store both the raw operator reference and its normalized form, and put the unique index on the normalized one"
    - "Reopen-as-remedy: a rejected-in-error claim has a merchant-side path back rather than a dead end created by the unique index"

key-files:
  created:
    - src/server/claims/reference.ts
    - src/server/claims/actions.ts
    - src/app/(dashboard)/dashboard/claims/page.tsx
    - src/app/(dashboard)/dashboard/claims/claim-card.tsx
    - src/app/(dashboard)/dashboard/claims/reject-dialog.tsx
    - src/app/(dashboard)/dashboard/claims/loading.tsx
    - tests/unit/claim-reference.test.ts
    - tests/isolation/claims.test.ts
  modified:
    - src/server/claims/queries.ts
    - src/server/orders/stock.ts
    - src/lib/strings.ts

key-decisions:
  - "The `status !== \"PENDING\"` guard inside the transaction IS the optimistic lock for two open dashboard tabs — no version column, no advisory lock, per RESEARCH.md Open Question 5"
  - "markStockHeld was added to src/server/orders/stock.ts rather than written inline in the claims module, so both writers of the Order.stockHeld flag that releaseStock keys on stay in the module that owns the invariant"
  - "InvalidTransitionError reuses strings.orders.staleAction instead of getting its own claims-namespaced copy — it is the same event (the order moved in another tab) described to the same merchant"
  - "findDuplicateReference is implemented despite returning null under the current @@unique([tenantId, referenceNormalized]), because UI-SPEC A5 specifies the alert and a merchant must be able to trust that its absence means something"
  - "The duplicate-reference alert leaves both action buttons enabled — A5 is explicit that the merchant is the judge, not the system"
  - "A rejection's reason is required at three independent layers (Zod 3-200 chars, transitionOrder's D-11 guard, and the dialog's disabled submit) because it is the only thing the customer can act on"

patterns-established:
  - "Pattern: normalize-then-index — a user-supplied external identifier gets a pure normalizer and a paired normalized column, never a raw-string unique constraint"
  - "Pattern: transaction-scoped status guard as the concurrency primitive for human-review queues"
  - "Pattern: state-flag writers colocated with the reader that depends on them (markStockHeld beside releaseStock)"

requirements-completed: [ORD-02, ORD-03, ORD-04]

# Metrics
duration: ~3h40m implementation + 3 verification sessions
completed: 2026-08-31
---

# Phase 3 Plan 13: Merchant Payment-Claim Review Summary

**The merchant-side claim court: a pure ORD-04 reference normalizer, three transaction-scoped `merchantAction` mutations (confirm / reject-with-reason / reopen), and the A5 card queue with one-tap confirm, screenshot lightbox and a reject dialog that cannot submit without a reason.**

## Performance

- **Duration:** ~3h40m of implementation (2026-08-30 15:57 → 19:33 +0100), followed by three separate verification sessions across two days
- **Started:** 2026-08-30T14:57:05Z
- **Completed:** 2026-08-31 (final full-suite verification)
- **Tasks:** 3 of 3
- **Files modified:** 11 (8 created, 3 modified), 2452 insertions

## Accomplishments

- **ORD-02 holds structurally, not by convention.** A payment is confirmable only by an explicit merchant tap, enforced twice: `transitionOrder` refuses `CONFIRMED` for any non-`MERCHANT` actor, and a source-scanning test asserts no module outside `src/server/claims/actions.ts` writes `PaymentClaim.status = "CONFIRMED"`.
- **ORD-04's per-tenant scoping is proven, not assumed.** `normalizeReference` collapses `MP240823.1234.A56789`, `mp240823 1234 a56789` and `MP-240823-1234-A56789` to one key, and the isolation suite proves the same reference succeeds in a second tenant while a second use inside one tenant raises `P2002`.
- **D-11's reason is mandatory at three layers** — Zod (3–200 chars), `transitionOrder`'s independent blank-reason guard, and a dialog whose submit stays disabled until a reason is picked — and it reaches the customer through the ORD-05 audit row.
- **D-04's release happens exactly once per rejection.** `releaseStock` claims the `Order.stockHeld` flag atomically; the new `markStockHeld` restores it on reopen so a later rejection cannot strand the decrement forever.
- **A mistaken rejection has a way out.** `reopenClaim` returns a `REJECTED` claim to `PENDING` and the order to `PAYMENT_CLAIMED`, re-holding stock — or refusing by name when the units genuinely sold in the interim, leaving the order `DISPUTED`.

## Task Commits

Each task was committed atomically:

1. **Task 1: normalizeReference and the claim review queries** — `0528de6` (test, RED) → `dc34444` (feat, GREEN)
2. **Task 2: confirmClaim, rejectClaim and reopenClaim** — `927d97b` (feat)
3. **Task 3: The A5 payment-claims queue** — `3dc3bc4` (feat)

_Task 1 was TDD (`tdd="true"`): the failing `claim-reference.test.ts` landed first at `0528de6`, the implementation at `dc34444`. No refactor commit was needed._

## Files Created/Modified

- `src/server/claims/reference.ts` (54) — `normalizeReference`, pure, no Prisma/`server-only` import so the `unit` project can load it
- `src/server/claims/queries.ts` (+147) — extends 03-04's `pendingClaimCount` with `listClaimsForReview` (ordered `submittedAt asc`, riding `@@index([tenantId, status, submittedAt])`, joining the order total so the card's mismatch line is not an N+1) and `findDuplicateReference`
- `src/server/claims/actions.ts` (366) — `confirmClaim`, `rejectClaim`, `reopenClaim`; each one `$transaction`, each guarding on `status`, each routing every order-state change through `transitionOrder`
- `src/server/orders/stock.ts` (+37) — `markStockHeld`, the reopen-path counterpart to `releaseStock`
- `src/lib/strings.ts` (+36) — `strings.claims.alreadyReviewed` and `strings.claims.reopenOutOfStock`
- `src/app/(dashboard)/dashboard/claims/page.tsx` (133) — Server Component, `requireMerchantContext()`, the queue and its empty state
- `src/app/(dashboard)/dashboard/claims/claim-card.tsx` (443) — the A5 card: amount, operator chip, copyable reference, relative submit time, destructive order-total mismatch line, 96px screenshot thumb with lightbox, `No screenshot` tile
- `src/app/(dashboard)/dashboard/claims/reject-dialog.tsx` (223) — three canned reasons plus `Something else` with a 140-char counted textarea, submit disabled until a reason is chosen
- `src/app/(dashboard)/dashboard/claims/loading.tsx` (61) — three claim-card-shaped skeletons at real height
- `tests/unit/claim-reference.test.ts` (151) — every `<behavior>` row including the three-spellings equality case
- `tests/isolation/claims.test.ts` (801) — 12 cases across ORD-02, ORD-03, ORD-04, D-04 and D-11

## Decisions Made

See `key-decisions` in the frontmatter. The two worth restating in prose:

- **The optimistic lock is a status read inside the writing transaction.** RESEARCH.md Open Question 5 argues that at this scale (a merchant with two tabs, not a distributed writer fleet) a `status !== "PENDING"` check inside the transaction is sufficient, and the second tab getting a clear "already reviewed" message is the correct product behaviour rather than a silent last-write-wins. Adopted as written.
- **`markStockHeld` belongs to the inventory module.** `releaseStock` is keyed entirely on `Order.stockHeld`, so the flag and the release must agree or neither means anything. Putting the reopen-path write in `src/server/claims/` would have split one invariant across two modules — the shape that drifts, because the next person to change the release rule would have no reason to look in the claims directory.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] Added `markStockHeld` to `src/server/orders/stock.ts`**

- **Found during:** Task 2 (`reopenClaim`)
- **Issue:** The plan specified `reopenClaim` should re-hold stock via `holdStockForLines`, but did not account for restoring the `Order.stockHeld` flag that `releaseStock` keys on. Left `false`, the *next* rejection of that same claim would call `releaseStock`, match zero rows, return having released nothing, and strand the decrement permanently — the merchant's dashboard silently under-reporting stock they physically hold, with nothing in the audit trail to explain it.
- **Fix:** Added `markStockHeld(tx, orderId)` beside `releaseStock` in the module that owns the flag, deliberately unconditional (unlike the release, setting the flag is not a decision and performs no inventory movement).
- **Files modified:** `src/server/orders/stock.ts`
- **Verification:** Covered by the reopen cases in `tests/isolation/claims.test.ts`; the full suite passes.
- **Committed in:** `927d97b` (Task 2 commit)

**2. [Rule 3 — Blocking] Added two keys to `strings.claims`**

- **Issue:** 03-04 was documented as landing `src/lib/strings.ts` whole, but the two refusals this plan's actions can produce (`AlreadyReviewedError` and the reopen out-of-stock case) had no copy, and CLAUDE.md forbids inlining a user-facing string literal in a component.
- **Fix:** Added `strings.claims.alreadyReviewed` and `strings.claims.reopenOutOfStock`, each with a comment noting it is a documented exception to the "03-04 lands this file whole" rule. Deliberately did *not* add a third key for `InvalidTransitionError` — that reuses `strings.orders.staleAction`, since it is the same event described to the same merchant and the file's own header forbids writing one sentence twice, slightly differently.
- **Files modified:** `src/lib/strings.ts`
- **Verification:** `tests/unit/dashboard-nav.test.ts` (the prose-literal scanner) passes.
- **Committed in:** `927d97b` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing-critical, 1 blocking)
**Impact on plan:** Both were required for correctness under the plan's own D-04 and CLAUDE.md constraints. No scope creep — no new dependency, no new table, no new surface.

## Issues Encountered

### The `40P01` deadlock false alarm — full arc, recorded as project history

This plan's verification took three sessions and produced one wrong conclusion before the right one. The arc is documented here because the failure mode is a property of the *test environment's* shared Neon branch, not of this plan, and any future Wave plan running `test:full` alongside siblings can hit it again.

**1. The false alarm.** An early verification session ran the suite while sibling worktrees were active and reported **"4 real signal failures, not environmental contention"** in `tests/isolation/claims.test.ts`. That finding was stated with confidence and is **wrong**. It caused a subsequent session to open a deadlock investigation against this plan's application code, chasing a bug in `confirmClaim`/`rejectClaim` transaction ordering that does not exist.

**2. The root cause.** The failures were a genuine Postgres `deadlock detected (40P01)` — but the deadlocking parties were not two claim transactions. They were **multiple sibling worktrees concurrently truncating and reseeding the one shared Neon test branch**. Every worktree in `.claude/worktrees/` points at the same `TEST_DATABASE_URL`; `tests/setup/global-setup.ts` truncates and reseeds on entry. Two suites entering at once take the same tables in different orders and Postgres kills one. The error surfaced inside whichever isolation test happened to be mid-transaction, which is why it looked like a claims bug. The investigation also left two debug scratch files (`tmp-mkdb.mjs`, `tmp-dburl.txt`) from an attempt to provision a private database; both were deleted before this summary and the working tree is clean.

**3. The resolution.** Running `npx vitest run --project isolation tests/isolation/claims.test.ts` **solo**, with no sibling `test:full` active, produced **12/12 passing clean**. Two other Wave-4 sibling plans (03-11 and 03-12) independently ran `npm run test:full` solo and also came back clean with zero issues. This session then confirmed no sibling vitest process was running (enumerated `node.exe` command lines — only dev servers and MCP servers present) and ran the entire suite fresh: **42/42 files, 646/646 tests, 0 failures, 0 skipped.**

**The deadlock investigation is closed as environmental.** There is no bug in 03-13's code. The operational rule it produces: **the isolation suite is not safe to run concurrently from more than one worktree**, because they share one Neon branch and one truncate/reseed step. Run it solo, or give each worktree its own test branch.

### `npx next build` fails on a worktree-structural Turbopack error

`npx next build` exits 1 inside this worktree with:

```
Error [TurbopackInternalError]: Symlink [project]/node_modules is invalid, it points out of the filesystem root
```

This is **not a code failure** and matches exactly what sibling plan 03-11 reported. The worktree's `node_modules` is a Windows **junction** whose target is `D:\Maxs\Claude\einort-commerce\node_modules` — outside the worktree root — and Turbopack's resolver refuses a symlink that escapes the project filesystem root. The panic occurs at `try_get_next_package` during package resolution, **before any of this plan's source is parsed**, so it cannot be caused by the code in these four commits.

Compensating evidence that the app tree compiles: `npm run typecheck` (`tsc --noEmit` across all of `src/`, including the four new `.tsx` files) exits 0, `npm run lint` exits 0 at `--max-warnings=0`, and the `unit` contract tests that scan this tree's source (`surface-token-isolation.test.ts`, `dashboard-nav.test.ts`) pass inside the full suite. The build should be re-confirmed from the main checkout after this branch merges.

## Verification Results

| Gate | Result |
|------|--------|
| `npm run test:full` | **PASS** — 42/42 files, 646/646 tests, 0 failed, 0 skipped (1281s; the duration is remote-Neon latency, not a hang) |
| `tests/isolation/claims.test.ts` | **PASS** — 12/12, run solo and again inside the full suite |
| `npm run lint` | **PASS** — exit 0 at `--max-warnings=0` |
| `npm run typecheck` | **PASS** — exit 0 |
| `npx next build` | **BLOCKED (environmental)** — worktree `node_modules` junction / Turbopack, see above |

## Known Stubs

None. The claims tree was scanned for hardcoded empty values, `TODO`/`FIXME` markers and placeholder copy; no matches in `src/server/claims/` or `src/app/(dashboard)/dashboard/claims/`.

`findDuplicateReference` returns `null` under the current schema, but this is **documented intent, not a stub** — the function is a correctly-shaped read whose enforcement half lives at claim submission (03-15), and the plan's Task 1 action requires it to exist so a merchant can trust that the absence of the duplicate alert means something.

## Threat Flags

None. Every surface added by this plan is covered by the plan's existing `<threat_model>` register (T-03-65 through T-03-69). No new network endpoint, auth path, file-access pattern or trust-boundary schema change was introduced.

## Human Check — STILL OUTSTANDING

The plan's `<human-check>` block has **not** been performed and remains a prerequisite for signing this plan off visually. In `npm run dev` with a seeded pending claim:

- [ ] The sidebar `Payment claims` item carries a **gold count badge**
- [ ] The queue renders correctly at **360px and 1280px**
- [ ] The **screenshot lightbox opens and closes with the keyboard**, and focus returns to the trigger
- [ ] `Reject` keeps its submit **disabled until a reason is picked**, and `Something else` reveals a **counted textarea** (140 cap)
- [ ] After rejecting, `/dashboard/orders/[id]` **Order history shows the rejection reason**
- [ ] After rejecting, the product's **stock has gone back up** on `/dashboard/products`

## Next Phase Readiness

- The merchant half of the payment-claim loop is complete and green. 03-15 can build the customer submission side against `normalizeReference` and the `@@unique([tenantId, referenceNormalized])` constraint, and should surface `P2002` as a customer-facing field error with a non-leaky message.
- `strings.claims.email` is present and untouched, reserved for 03-15's merchant notification.
- **Operational blocker for future waves:** the shared Neon test branch cannot serve concurrent `test:full` runs from multiple worktrees. Either serialize isolation runs across the wave, or provision a test branch per worktree.
- The `npx next build` gate needs one confirmation from the main checkout post-merge.

## Self-Check: PASSED

All 9 claimed source/test files verified present on disk, plus this SUMMARY. All 4 claimed commit hashes (`0528de6`, `dc34444`, `927d97b`, `3dc3bc4`) verified present in `git log --all`.

---
*Phase: 03-product-catalog-order-payment-claim-state-machine*
*Completed: 2026-08-31*
