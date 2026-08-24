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
