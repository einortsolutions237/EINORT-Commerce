# Deferred items — Phase 03

Out-of-scope discoveries logged during execution. Not fixed in the plan that
found them.

## `npm run test:full` runtime grew from ~2 min to ~22 min (found in plan 03-01)

**What happened.** Plan 03-01 took `TENANT_SCOPED_MODELS` from 1 model to 10.
`tests/isolation/tenant-isolation.test.ts` is model-generic — it runs a
10-assertion battery per registered model — so the isolation suite went from
~25 tests to ~120, and `tests/setup/seed-two-tenants.ts` reseeds before *every
one of them*. Measured: 344 tests, 1354 s wall clock, of which the isolation
project is essentially all of it.

**Why it is not fixed here.** Nothing about it is wrong. The reseed-per-test
design is what makes the tests order-independent, and the per-model battery is
what makes registering a model automatically mean testing it — both are
deliberate and both are load-bearing. The cost is real but it is the cost of the
guarantee, and changing either is a test-architecture decision well outside a
schema plan's scope.

**What it will cost.** Plans 03-02 through 03-16 each end with
`npm run test:full`. At ~22 min per run that is a material share of the phase.

**Options when it becomes the bottleneck** (none evaluated, listed so the next
person does not start from zero):

- Reseed once per `describe` instead of per `it`, for the read-only assertions
  that provably do not mutate — leaving `beforeEach` only on the mutating ones.
- Run the isolation project against a local Postgres instead of a remote Neon
  branch. The `assertSafeSeedTarget` allowlist already supports an override via
  `TEST_DATABASE_ENDPOINTS`, and round-trip latency to Neon eu-west-2 is what
  dominates.
- Split a fast `test:isolation:smoke` (one representative model) for the
  per-task gate, keeping the full matrix for the per-plan gate.

---

## Same-transaction `OrderEvent` rows share a `createdAt`

**Found during:** plan 03-07, task 3 (`placeOrder`).

**What.** `OrderEvent.createdAt` is `@default(now())`, which Prisma maps to the
column's Postgres `DEFAULT CURRENT_TIMESTAMP`. In Postgres that resolves to the
TRANSACTION's start time, not the statement's. A `MANUAL_TRANSFER` placement
writes two events in one transaction — the `fromState: null` genesis and the
`ORDER_PLACED -> PAYMENT_PENDING` hop — and both land with byte-identical
timestamps. Ordering them by `createdAt` is a tie-break, not a sequence.

**Why it was not fixed here.** Every remedy is a schema change or a clock
change, and both belong to whoever owns the timeline UI rather than to the
placement engine:

- a monotonic `sequence` integer per order, assigned by the writer;
- `clock_timestamp()` as the default, which breaks the "one transaction, one
  timestamp" property other queries may already rely on;
- application-supplied `new Date()` per event, which reintroduces clock skew
  between the app and the database.

**Who is affected.** 03-13 (customer tracking timeline) and 03-16 (merchant
order detail) both render an event history. Either order by `createdAt` and
then a stable secondary key, or accept that same-transaction events are
unordered and render them as a group.

**Not affected.** `tests/isolation/checkout-trust.test.ts` asserts the event SET
rather than its order and says so inline; `tests/isolation/order-audit.test.ts`
uses `events.at(-1)` after separate transactions, where the timestamps genuinely
differ.

---

## `stock-race.test.ts` fails when the Neon test branch is slow

**Found during:** plan 03-02, full-suite verification. Out of scope for that
plan, which touched CSS tokens, env keys and shadcn components only.

**What.** All three concurrency cases in `tests/isolation/stock-race.test.ts`
failed on a run where the whole suite took **43 min against master's 16.1 min**
for effectively the same tests — a 2.7x slowdown. The failures are the shape a
timeout produces, not the shape a logic bug produces:

- `lets exactly one win…` — the loser threw `PrismaClientKnownRequestError`
  instead of `OutOfStockError`. The `fulfilled`/`rejected` split was still 1/1,
  so the race resolved correctly; only the error TYPE was wrong.
- `both settle without a deadlock…` — `expected [ Array(1) ] to deeply equal []`
  (a transaction left work behind).
- `is a no-op for two concurrent releases…` — one of two releases rejected.

**The smoking gun.** `src/server/orders/place.ts:371` sets
`$transaction(..., { timeout: 15_000 })`. The two failing race cases took
**21911ms** and **26182ms**. They exceeded the engine's own transaction timeout,
so the loser's transaction was aborted by Prisma before the winner committed and
the conditional `stock: { gte: quantity }` predicate could report a clean
sold-out.

**Why it is environmental.** The same session saw `npx prisma migrate deploy`
return `P1001 Can't reach database server` on 2 of 3 consecutive attempts with
TCP reachability to the endpoint confirmed good throughout. The branch was
degraded or contended — plausibly by the other Wave 1 worktree agents running
their own isolation suites against the same shared branch. Plan 03-02 changed no
transaction, stock, or order code; its only test-path change adds five `??=` env
placeholders to `applyDataLayerEnv`.

**What to do.** Re-run `tests/isolation/stock-race.test.ts` on a quiet branch
before treating this as a real defect. If it reproduces when the suite is back
near 16 min, it IS a real defect and the question to ask is whether 15s is
enough headroom for a lock wait on a scale-to-zero Postgres — in which case the
fix belongs to 03-07, either by raising the timeout or by catching the timeout
error and mapping it to `OutOfStockError` when the predicate did not match.

**Also worth considering at the orchestration level.** The isolation suite
truncates and reseeds a single shared Neon branch, and `fileParallelism: false`
only serialises files WITHIN one run. Two Wave 1 agents running `test:full`
concurrently will interleave truncates and fixtures. A branch per agent, or a
lock, would make this class of failure impossible rather than merely unlikely.

**Addendum (orchestrator, post-03-04/03-05 merge verification).** Recurred a
third time, but this time with **no sibling worktree running** — a solo,
sequential `npm run test:full` (~27 min, all 30 files) produced the same three
`stock-race.test.ts` failures with the identical `PrismaClientKnownRequestError`
shape, and an immediate isolated re-run of just that file passed 6/6 in ~68s
both times it was tried. This weakens the "contention from parallel worktrees"
explanation as the *sole* cause — a long enough solo suite run reproduces it
too, which is more consistent with the 15s transaction timeout being generically
too tight for this test's concurrency pattern on a scale-to-zero Neon branch
whenever the branch's compute has throttled down or warmed up mid-run, not only
under multi-agent contention. Reinforces the fix options already listed above,
particularly raising `place.ts:371`'s `timeout` or mapping a timed-out
transaction to `OutOfStockError` only when the stock predicate provably did not
match.
