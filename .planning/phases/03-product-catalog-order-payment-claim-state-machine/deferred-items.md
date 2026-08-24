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
