---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 03
subsystem: api
tags: [state-machine, prisma, postgres, audit-trail, rate-limiting, multi-tenant, vitest]

# Dependency graph
requires:
  - phase: 03-product-catalog-order-payment-claim-state-machine (plan 03-01)
    provides: "Order/OrderEvent schema, OrderState/OrderChannel/EventActor enums via @/server/db/enums, scopedDb/ScopedTx/scopedCreateData, two-tenant isolation fixture"
  - phase: 02-merchant-onboarding-subscription-trial
    provides: "MerchantContext, resolveEntitlements, requireMerchantContext, rate-limit module with createLimiter and the fail-open contract"
provides:
  - "ORDER_TRANSITIONS registry + canTransition — the ORD-01 graph and the D-02/D-03 channel rule as one data table"
  - "transitionOrder(tx, args) — the single writer of Order.state, writing the ORD-05 OrderEvent in the caller's transaction"
  - "ORD-02 enforcement: only a MERCHANT actor, carrying a user id, may reach CONFIRMED"
  - "D-11 enforcement: DISPUTED requires a non-blank reason, server-side"
  - "InvalidTransitionError / OutOfStockError / UnavailableItemError / AlreadyReviewedError"
  - "MerchantContext.userId, session-derived, without requireMerchantContext() growing a parameter"
  - "orderPlacementLimiter, claimSubmissionLimiter, orderTrackingLimiter, uploadPresignLimiter"
  - "src/server/db/model-inputs.ts — the sanctioned door to generated create-input types"
  - "A build-failing source guard proving no second writer of Order.state exists"
affects: [03-04-checkout-order-placement, 03-05-payment-claim-submission, 03-06-merchant-order-queue, order-tracking, admin-order-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry + single chokepoint: rules as a Readonly<Record<Enum, …>> table, one predicate, one writer"
    - "Source-grep build gates for invariants no runtime test can reach"
    - "Sanctioned type-only re-export modules inside src/server/db/** to keep the ESLint generated-client ban absolute"

key-files:
  created:
    - src/server/orders/state-machine.ts
    - src/server/orders/errors.ts
    - src/server/orders/transition.ts
    - src/server/db/model-inputs.ts
    - tests/unit/state-machine.test.ts
    - tests/unit/single-order-state-writer.test.ts
    - tests/isolation/order-audit.test.ts
  modified:
    - src/server/entitlements/resolve.ts
    - src/server/merchant/context.ts
    - src/server/rate-limit.ts

key-decisions:
  - "The channel rule is one CLAIM_ONLY_STATES set checked once, not three per-channel transition tables — two of the three copies would be identical, which is the shape that drifts"
  - "ORDER_TRANSITIONS is Readonly<Record<OrderState, …>> rather than a lookup-with-default, so a seventh enum member is a compile error at the table instead of a silently terminal state (verified: removing the DISPUTED row fails typecheck with TS2741)"
  - "transitionOrder takes the caller's tx and never opens a transaction, so a caller's stock or claim work stays indivisible with the state change"
  - "The OrderEvent is a separate create, never a nested write off order.update — the tenant-scope extension does not intercept nested writes"
  - "A MERCHANT-actor transition must carry actorUserId; an anonymous MERCHANT audit row is refused rather than written"
  - "resolveEntitlements keeps its purity and its two parameters; userId is spread on in requireMerchantContext, so tests/unit/entitlements.test.ts needed no edit"
  - "Generated create-input types get one named alias per model in src/server/db/model-inputs.ts rather than a per-call-site eslint-disable"

patterns-established:
  - "Pattern 1: Domain rules as data + one predicate + one writer, with a source-grep test enforcing the 'one writer' half"
  - "Pattern 2: Source-scan guards carry a positive control so they cannot pass vacuously"
  - "Pattern 3: One rate limiter per protected surface, each with an isolated rl:* prefix and the fail-open-and-log contract"

requirements-completed: [ORD-01, ORD-02, ORD-05]

# Metrics
duration: 45min
completed: 2026-08-24
---

# Phase 3 Plan 3: Order State Machine and the Single Transition Writer Summary

**The ORD-01 transition graph as a data table, plus `transitionOrder()` — the only code in `src/` that may write `Order.state`, proven by a build-failing source scan, and unable to move an order without writing the ORD-05 audit row in the same transaction.**

## Performance

- **Duration:** ~45 min of execution across two sessions (the first lost its connection mid-Task-3; this one resumed from the uncommitted `transition.ts`), plus a 14m 40s `npm run test:full` verification run
- **Started:** 2026-08-24T05:21:00Z
- **Completed:** 2026-08-24T11:22:00Z
- **Tasks:** 3
- **Files modified:** 10 (7 created, 3 modified)

## Verification

The plan's full `<verification>` block, all green:

| Check | Result |
|---|---|
| `npm run test:full` | **22 files, 375 tests passed, 0 failed, 0 skipped** (879s). Master's baseline was 344 tests / 19 files — exactly the 31 new cases in the three new files, no inherited test disturbed. |
| `npm run lint` | exits 0 at `--max-warnings=0` |
| `npm run typecheck` | exits 0 |
| No `@/generated/prisma*` import under `src/server/orders/**` | `grep -c` returns 0 for all three files |
| `src/server/rate-limit.ts` exports six limiters, distinct prefixes | `rl:claim`, `rl:login`, `rl:order`, `rl:signup`, `rl:slugcheck`, `rl:track`, `rl:upload` — seven prefixes for seven limiters (the plan said "six in total"; Phase 2 shipped three, this plan adds four, so seven is the correct count and no prefix repeats) |

Task-level acceptance criteria additionally verified by hand, including the two destructive probes the plan asks for:

- Deleting the `DISPUTED` row from `ORDER_TRANSITIONS` fails `npm run typecheck` with `TS2741: Property 'DISPUTED' is missing` — then restored, confirmed byte-identical to the committed file.
- Planting `await db.order.update({ where: { id }, data: { state: "CONFIRMED" } })` in a second file under `src/server/orders/` fails `single-order-state-writer.test.ts`, which reported `src/server/orders/violation-probe.ts:4` with the offending snippet — then removed.

## Accomplishments

- **The order lifecycle is data.** `ORDER_TRANSITIONS` holds the six rows; `canTransition(channel, from, to)` is two clauses and there must never be a third. A seventh `OrderState` member is a compile error at the table, verified by deleting the `DISPUTED` row and watching `tsc` fail with TS2741.
- **There is exactly one writer of `Order.state`.** `tests/unit/single-order-state-writer.test.ts` walks every `.ts`/`.tsx` under `src/`, blanks comment lines, matches the argument list of each `order.{update,updateMany,create,createMany,upsert}(` by parenthesis, and fails the build if anything but `transition.ts` passes `state:` inside one. Verified in both directions: it names a planted violation by file and line, and it carries a positive control that fails if the detector stops recognising the real writer.
- **An order cannot move without leaving an audit row.** The state change and the `OrderEvent` are two statements in the caller's transaction. `tests/isolation/order-audit.test.ts` proves the indivisibility directly: a *legal* move made earlier in the same transaction is rolled back when a later call throws, which could not happen if each call committed alone.
- **ORD-02 is enforced, not conventional.** `PAYMENT_CLAIMED → CONFIRMED` is in the registry; a `CUSTOMER` actor is still refused, and so is a `MERCHANT` actor with no user id.
- **Every merchant action can name its actor.** `MerchantContext.userId` comes from the same Better Auth session that supplies `activeOrganizationId`. `requireMerchantContext()` still takes no parameters, and `tests/unit/entitlements.test.ts` was not edited.
- **Four isolated rate-limit budgets** for the surfaces the rest of the phase throttles, each with its own `rl:*` prefix so a checkout flood cannot starve claim submission.

## Task Commits

1. **Task 1: ORDER_TRANSITIONS registry, channel rule, domain errors (TDD)**
   - `f0df75d` (test) — RED: `tests/unit/state-machine.test.ts`, the exhaustive 3x6x6 sweep
   - `295bc5e` (feat) — GREEN: `state-machine.ts` + `errors.ts`
2. **Task 2: Actor identity on MerchantContext and the four rate limiters** — `a18248d` (feat)
3. **Task 3: `transitionOrder()`, the single writer, with the ORD-05 audit row**
   - `da82096` (feat) — `transition.ts`, `model-inputs.ts`, `errors.ts` detail field, both new tests
   - `bc7a391` (docs) — header reword so the plan's `$transaction` grep audit returns 0

**Plan metadata:** see the `docs(03-03)` commit that carries this file.

## Files Created/Modified

- `src/server/orders/state-machine.ts` — `ORDER_TRANSITIONS`, module-private `CLAIM_ONLY_STATES`, `canTransition`. Pure: no Prisma client, no I/O, no clock, so it is importable from the database-free `unit` project.
- `src/server/orders/errors.ts` — `InvalidTransitionError` (carrying `from`/`to`/`channel` plus an optional `detail`), `OutOfStockError`, `UnavailableItemError`, `AlreadyReviewedError`. Thrown inside transaction callbacks so the transaction rolls back.
- `src/server/orders/transition.ts` — the chokepoint. Scoped read, `canTransition`, ORD-02 actor guard, MERCHANT-must-name-a-user guard, D-11 reason guard, the state write with the `confirmedAt` stamp, then the `OrderEvent` as a separate stamped create.
- `src/server/db/model-inputs.ts` — one named alias for `Prisma.OrderEventUncheckedCreateInput`, inside the ESLint-sanctioned zone.
- `src/server/entitlements/resolve.ts` — `MerchantContext.userId` added; `MerchantEntitlements = Omit<MerchantContext, "userId">` exported; `resolveEntitlements` returns it unchanged in body; `isUrgentTrial` relaxed to `Pick<MerchantContext, "trial">`.
- `src/server/merchant/context.ts` — spreads the resolver result and adds `userId: session.user.id`. Still takes no parameters.
- `src/server/rate-limit.ts` — `orderPlacementLimiter` (`rl:order`, 10/5min), `claimSubmissionLimiter` (`rl:claim`, 5/10min), `orderTrackingLimiter` (`rl:track`, 60/1min), `uploadPresignLimiter` (`rl:upload`, 20/5min). `createLimiter` stays module-private.
- `tests/unit/state-machine.test.ts` — table-driven, sweeps all 3 channels x 6 from-states x 6 to-states against the registry-plus-channel rule restated independently.
- `tests/unit/single-order-state-writer.test.ts` — the build gate for T-03-14.
- `tests/isolation/order-audit.test.ts` — 10 cases against the real Neon test branch.

## Decisions Made

- **Comment-blanking in the source guard is line-oriented, not a tokenizer.** Every comment in this repository is either a `//` line or a JSDoc `*` continuation, and a trailing `// …` after live code is deliberately left alone — that can only ever cause a false *positive*, which is a failing build somebody reads rather than a silent hole.
- **The guard's `state:` matcher uses a word boundary.** `OrderEvent.toState` and `fromState` are written on every legitimate transition; a bare substring match would flag the audit row as if it were a state write.
- **The cross-tenant isolation case uses a real, seeded order id and a *legal* move.** An invented id would fail for the boring reason too, and the test would keep passing with the scope guard removed. It also asserts the failure is *not* an `InvalidTransitionError` — if it ever becomes one, tenant A managed to read tenant B's order.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `src/server/db/model-inputs.ts` for the generated create-input type**

- **Found during:** Task 3 (`transitionOrder` implementation)
- **Issue:** The plan's action specifies `scopedCreateData<Prisma.OrderEventUncheckedCreateInput>(…)` written inline in `transition.ts`. `Prisma` is only importable from `@/generated/prisma/client`, and `eslint.config.mjs` makes that an error everywhere under `src/` except `src/server/db/**`, `src/server/tenant/**` and `src/server/auth/**` — a rule that is the TEN-02/TEN-05 enforcement mechanism and cannot be waived per call site. `scopedCreateData<T>` also cannot infer `T` (its parameter is `Omit<T, "tenantId">`, and TypeScript cannot run an `Omit` backwards), so the type must be named explicitly by the caller. The literal instruction was therefore unimplementable without an `eslint-disable`.
- **Fix:** Added a types-only module in the already-sanctioned zone, the exact sibling of the existing `src/server/db/enums.ts` and justified on the same grounds — one named alias per model, added deliberately, not `export type { Prisma }` and not a wildcard, so `grep -rn "generated/prisma" src/` stays a two-hit audit.
- **Files modified:** `src/server/db/model-inputs.ts` (new), `src/server/orders/transition.ts`
- **Verification:** `npm run lint` exits 0 at `--max-warnings=0`; `grep -c "generated/prisma" src/server/orders/*.ts` returns 0 for all three files; the plan's `grep -c "scopedCreateData" src/server/orders/transition.ts >= 1` criterion holds.
- **Committed in:** `da82096`

**2. [Rule 2 - Missing Critical] `InvalidTransitionError` gained an optional `detail`**

- **Found during:** Task 3
- **Issue:** Two of the four refusals in `transitionOrder` are not about the graph at all. `PAYMENT_CLAIMED → CONFIRMED` by a customer (ORD-02) and `→ DISPUTED` with a blank reason (D-11) are both moves the registry *permits*, refused on other grounds. With the plan's three-argument constructor they log as `Invalid order transition: PAYMENT_CLAIMED -> CONFIRMED`, which is not merely unhelpful — it is false, and it sends whoever reads the line looking for a bug in the registry.
- **Fix:** Added an optional fourth constructor argument appended to the message and exposed as a readonly field, so the Server Action layer can also tell a merchant "a rejection needs a reason" rather than "that move isn't allowed".
- **Files modified:** `src/server/orders/errors.ts`
- **Verification:** `npm run typecheck` exits 0; the plan's required exports are unchanged and all existing three-argument call sites still compile.
- **Committed in:** `da82096`

**3. [Rule 2 - Missing Critical] A `MERCHANT` transition must carry `actorUserId`**

- **Found during:** Task 3
- **Issue:** The plan's signature makes `actorUserId` optional (correctly — `CUSTOMER` and `SYSTEM` events genuinely have none) but specifies no guard. That makes an anonymous `MERCHANT` audit row silently producible, in the one place ORD-05 exists to name a person. A caller that simply forgot the field would write a row that satisfies every schema constraint and answers "who confirmed this payment?" with `null` (T-03-12).
- **Fix:** Added a guard alongside the ORD-02 actor check: `actor === "MERCHANT"` without `actorUserId` throws `InvalidTransitionError` with a detail explaining why. Every merchant call site has `MerchantContext.userId` available (Task 2), so this cannot burden a legitimate caller.
- **Files modified:** `src/server/orders/transition.ts`
- **Verification:** `tests/isolation/order-audit.test.ts` → "refuses a MERCHANT actor that carries no user id" passes, and the accepted case asserts `actorUserId` landed on the row.
- **Committed in:** `da82096`

**4. [Rule 3 - Blocking] Reworded the `transition.ts` header so the plan's own grep audit can pass**

- **Found during:** Task 3 acceptance-criteria verification
- **Issue:** The plan's action instructs: "Write that in the header … that this function … never opens its own transaction." Its acceptance criterion then requires `grep -c "\$transaction" src/server/orders/transition.ts` to return **0**. Following the action produced a file that returns 2 — both occurrences in prose *explaining* the rule. The two instructions are mutually unsatisfiable as literally written, and a grep audit that cannot come back clean on compliant code is not an audit.
- **Fix:** Kept the full explanation but removed the literal method token from the prose, and added a pointer to the behavioural proof (`order-audit.test.ts`'s rollback case) so the claim is checkable by something stronger than a grep. Committed separately so the reasoning is visible in history rather than buried in the feature commit.
- **Files modified:** `src/server/orders/transition.ts`
- **Verification:** `grep -c '\$transaction' src/server/orders/transition.ts` returns 0; `npm run lint` and `npm run typecheck` exit 0.
- **Committed in:** `bc7a391`

### Scope Additions (test coverage beyond the plan)

**5. [Rule 2 - Missing Critical] An isolation case proving the transaction actually rolls back**

- **Found during:** Task 3
- **Issue:** The plan's second isolation case — an illegal transition leaves `Order.state` and the `OrderEvent` count unchanged — only proves the guard returns *early*. Nothing is written before the throw, so "nothing changed" would hold equally for a function with no transaction at all. The case cannot distinguish the property it claims to prove from its absence.
- **Fix:** Added a case where a *legal* move is completed first and an illegal one follows inside the same `$transaction`. Both must vanish together. This is the assertion that makes "an order cannot move without an audit row" true in the presence of a caller that fails partway — which is every real caller, since `placeOrder` holds stock and `reviewClaim` releases it.
- **Also added beyond the plan's five:** `confirmedAt` is *not* stamped on a non-confirming move; the D-11 whitespace-only reason is refused and a real one is recorded; a WhatsApp order refused `PAYMENT_PENDING` can still be confirmed directly (the channel rule narrows the graph, it does not strand the order).
- **Verification:** 10 cases, 0 skipped, all passing against the Neon test branch.
- **Committed in:** `da82096`

---

**Total deviations:** 5 auto-fixed (2 blocking, 3 missing-critical). No architectural changes; no packages installed.
**Impact on plan:** Every deviation closes a hole the plan's literal text left open, or resolves a self-contradiction in the plan. No scope creep — nothing was built that a later plan in this phase does not consume.

## Issues Encountered

- **The previous executor session lost its connection mid-Task-3**, leaving `transition.ts`, `model-inputs.ts` and the `errors.ts` `detail` change uncommitted. All three were reviewed against the plan's Task 3 action and acceptance criteria, confirmed complete and passing `lint`/`typecheck` as found, and kept rather than redone. Task 3's remaining work — both tests — was written in this session and committed together with them.
- **`npm run test:full` takes ~15-26 minutes** (375 tests; this run was 879s) because plan 03-01 introduced a reseed-per-test plus per-model isolation battery against a remote Neon branch. This is deliberate and accepted, not a regression. Task-level iteration used `npx vitest run --project unit …` and a single isolation file instead.

## Threat Flags

None. Every security-relevant surface this plan introduces is already in the plan's `<threat_model>`: T-03-12 (audit row in the same transaction, plus the anonymous-MERCHANT guard added as deviation 3), T-03-13 (ORD-02 actor guard), T-03-14 (the source-grep build gate), T-03-15 (`CLAIM_ONLY_STATES` channel check, exhaustively swept), T-03-16 (`userId` read from the session, never from a payload), T-03-17 (four isolated limiter prefixes, fail-open), T-03-18 (D-11 blank-reason refusal). No network endpoint, no file access, no schema change — this plan adds a pure module, one transaction helper, three context/limiter edits and three test files.

## Known Stubs

None. Every export in this plan is fully implemented and exercised by a test. `transitionOrder` has no callers yet — plans 03-04 through 03-06 supply them — but that is unwired-consumer, not a stub: the function is complete and its behaviour is proven end-to-end against a real database.

## User Setup Required

None - no external service configuration required. The four new rate limiters use the Upstash credentials already configured in Phase 1, and fail open when they are absent.

## Next Phase Readiness

Ready. The rest of Phase 3 has everything it needs to move an order:

- **03-04 (checkout / place order)** calls `transitionOrder(tx, …)` inside its stock-hold transaction and throttles with `orderPlacementLimiter`. Note that `placeOrder` writes the *genesis* row directly (`fromState: null`, state `ORDER_PLACED`) — that is a row creation, not a transition, and the source guard permits it only because `order.create` there will not be reachable any other way; if 03-04 needs to set `state:` on a create, expect the guard to fire and route that create through `transition.ts` or extend the guard's exemption deliberately.
- **03-05 (payment claim)** uses `claimSubmissionLimiter` + `uploadPresignLimiter`, and moves `PAYMENT_PENDING → PAYMENT_CLAIMED` with `actor: "CUSTOMER"`.
- **03-06 (merchant queue)** passes `ctx.userId` from `requireMerchantContext()` as `actorUserId` for every confirm and reject, and must supply a non-blank `reason` on a rejection.

**One thing to carry forward:** the single-writer guard will fail the build the first time a later plan reaches for `order.update({ data: { state } })`. That is the intended behaviour and the failure message says so, but it will surprise whoever hits it — the answer is always `transitionOrder(tx, …)`, never an exemption.

## Self-Check: PASSED

All 10 source/test files this summary claims exist are present on disk. All five commit hashes
(`f0df75d`, `295bc5e`, `a18248d`, `da82096`, `bc7a391`) resolve in `git log`. The temporary
`violation-probe.ts` used for the negative control is removed, and `git status` is clean apart
from this file.

---
*Phase: 03-product-catalog-order-payment-claim-state-machine*
*Completed: 2026-08-24*
