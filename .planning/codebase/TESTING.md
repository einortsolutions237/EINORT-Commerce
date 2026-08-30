# Testing Patterns

**Analysis Date:** 2026-08-30

## Test Framework

**Runner:**
- Vitest 4.1.10, config at `vitest.config.ts`. Uses Vitest's `projects` feature to define two independent test projects sharing one config file rather than two config files.

**Assertion Library:**
- Vitest's built-in `expect` (Chai-compatible). No separate assertion library.

**Run Commands:**
```bash
npm run test:unit    # vitest run tests/unit --reporter=dot — fast gate, no DB/network, target < 2s
npm run test:full     # dotenv -e .env.test -- vitest run — runs BOTH projects (unit + isolation) against real Neon test branch
npm run lint           # eslint . --max-warnings=0
npm run typecheck      # tsc --noEmit
```
There is no separate `test:watch`/coverage script defined in `package.json`; run `vitest` directly (e.g. `npx vitest --project unit`) for watch mode ad hoc.

## Test Project Organization

Two Vitest **projects**, defined inline in `vitest.config.ts`, each with its own environment and env vars — not two separate config files:

**`unit` project:**
- `include: ["tests/unit/**/*.test.ts"]`
- No database, no network. Target: fast (< 2s for the whole suite). Runs after every task commit.
- `resolve.alias` maps `@` → `./src` and stubs `server-only` to the package's own `empty.js` (Vitest resolves with Node's default conditions, and `server-only`'s default export throws on import; only the `react-server` condition is safe — aliasing avoids widening `resolve.conditions` globally).
- `env` supplies placeholder values so modules that transitively import `@/env` (which validates at module-evaluation time via `@t3-oss/env-nextjs`) don't throw before a single assertion runs. The Postgres URL used is deliberately unreachable (`postgresql://unit:unit@127.0.0.1:5432/never-connected`) — if a unit test ever manages to connect to it, that is treated as a bug in the test, not a passing fixture.

**`isolation` project:**
- `include: ["tests/isolation/**/*.test.ts"]`
- Requires `TEST_DATABASE_URL` pointing at a dedicated Neon branch (`einort-test`). Docker is unavailable on the dev machine, so Testcontainers is not an option; the dedicated branch is the substitute.
- `globalSetup: ["tests/setup/global-setup.ts"]` — runs `prisma migrate deploy` against the test branch once per suite run, then truncates and reseeds a fixed two-tenant fixture.
- `setupFiles: ["tests/setup/isolation-setup.ts"]` — releases the cached seed connection pool after each test file.
- `fileParallelism: false` — isolation test files share one database branch; running files in parallel would let one file's truncate wipe another's fixtures mid-assertion.
- `testTimeout: 30_000`, `hookTimeout: 60_000` — raised because the two-tenant reseed transaction against a remote Neon branch can take several seconds and Prisma's default 5000ms transaction timeout is too tight for it.

**Directory layout:**
```
tests/
├── unit/            # pure-function + static-analysis tests, no DB/network
├── isolation/        # tests against a real Postgres (Neon test branch), tenant-isolation-focused
├── setup/            # global-setup.ts, isolation-setup.ts, seed-two-tenants.ts (shared fixture)
└── fixtures/          # binary/test-data fixtures (e.g. sample-product.jpg)
```

**Naming:** `<subject>.test.ts`, named after the unit or contract under test, not the file path. Table-driven "sweep" tests and static-analysis "contract" tests are named after the property they assert (`no-tenant-id-param.test.ts`, `surface-token-isolation.test.ts`, `single-order-state-writer.test.ts`, `model-registry-drift.test.ts`).

## Test Structure

**Suite organization (Vitest `describe`/`it`, always from `"vitest"`):**
```ts
import { describe, expect, it } from "vitest";

describe("ORDER_TRANSITIONS registry", () => {
  it("covers exactly the six persisted order states", () => {
    expect([...STATES].sort()).toEqual([...].sort());
  });
});
```
- `describe` blocks are named as English sentences describing the invariant under test ("the list is one tenant's catalog", "a forged categoryId is refused by the database"), not as `ClassName` or `methodName`.
- `it` blocks read as full sentences continuing the `describe` sentence, and non-trivial assertions carry a custom failure message as `expect(value, "explanation").toBe(...)` — the message explains *why* the invariant matters and *how to fix it*, not just what failed. This is a strong, consistently-applied convention across the whole suite.

**Setup/teardown:**
- Isolation tests: `beforeAll(() => seedTwoTenants())` seeds fixtures **once per file**, not once per test — deliberate, because reseeding is expensive against a remote Neon branch and the `$transaction`'s `maxWait` intermittently exceeds budget if run too often. Per-test isolation instead comes from each test either reading the fixed fixture tenants read-only or signing up its own merchant under its own unique email/slug.
- `beforeEach` resets lightweight per-test state only (request headers/cookies, rate-limiter verdicts) — never a full reseed.
- Unit tests with `vi.mock` typically have no `beforeEach`/`afterEach` at all; mock state is reset inline where needed via helper functions (e.g. `resetRequestContext()`).

## Mocking

**Framework:** Vitest's built-in `vi` (no separate mocking library like `sinon` or `jest`).

**Core pattern — `vi.hoisted` + `vi.mock`:**
```ts
const { requestContext } = vi.hoisted(() => ({
  requestContext: { headers: new Headers(), cookies: new Map() },
}));

vi.mock("next/headers", () => ({
  headers: async () => requestContext.headers,
  cookies: async () => ({ get: ..., getAll: ..., set: ..., delete: ... }),
}));
```
`vi.hoisted` is used whenever the mock factory needs to close over mutable state that the test body also mutates — `vi.mock` factories are hoisted above imports, so any variable they reference must itself be declared via `vi.hoisted`. This is the standard idiom across `tests/isolation/catalog.test.ts`, `tests/unit/cart.test.ts`, and others.

**Partial mocking with `importOriginal`** — mock only specific exports, keep the rest real:
```ts
vi.mock("@/server/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/rate-limit")>();
  return { ...actual, slugCheckLimiter: { limit: async () => ({ success: limitVerdict.slugCheck }) } };
});
```

**Dynamic post-mock imports** — modules under test are imported with `await import(...)` *after* every `vi.mock` call, so the mocked modules are what gets picked up:
```ts
vi.mock("next/headers", () => ({ ... }));
// ... more vi.mock calls ...
const { signUpMerchant } = await import("@/server/auth/signup");
```

**What to mock:**
- `next/headers` (cookies/headers are unavailable/empty under Vitest — see `plan-selection.test.ts` reasoning cited in `catalog.test.ts`).
- Rate limiters (`@upstash/redis`-backed), given controllable pass/fail verdicts via a `vi.hoisted` state object, so a test can force a rate-limit failure deterministically.
- `next/cache`'s `revalidatePath` (`vi.hoisted(() => vi.fn())` + `vi.mock`).

**What NOT to mock:**
- Better Auth and Prisma stay real in the isolation project — auth flows run through the actual `auth.api.signInEmail`, and all catalog/order writes go through the real Prisma client against the Neon test branch. The isolation suite's entire value is proving tenant isolation against a real database; mocking the data layer would make cross-tenant assertions vacuously true.
- Domain logic under test is never mocked — only its I/O-adjacent dependencies (headers/cookies, rate limiting, cache invalidation).
- `console.warn`/`console.error` are spied on with `vi.spyOn(console, "warn").mockImplementation(() => {})` specifically to assert a warn-path fires (not merely to silence it).

**Test harness reuse:** Isolation test files explicitly reuse a shared harness rather than reinventing setup — e.g. `catalog.test.ts`'s header states it reuses `tests/isolation/read-only.test.ts`'s harness pattern (real Better Auth + Prisma, only `next/headers` and rate limiters substituted).

## Fixtures and Factories

**Two-tenant fixture (`tests/setup/seed-two-tenants.ts`):**
- The canonical fixture for every isolation test. Provides `TENANT_A` and `TENANT_B`, each with fixed, human-readable, non-random IDs (`tenant-a-fixed-id`, not `randomUUID()`), so a failing cross-tenant assertion's diff names the leak directly instead of showing two opaque UUIDs.
- Seeded via a single `TRUNCATE ... RESTART IDENTITY CASCADE` + `$transaction([...])` batch of `createMany` calls, driven by a `MODEL_FIXTURES` registry keyed by model name and a `TENANT_SCOPED_MODELS` registry — adding a new tenant-scoped Prisma model without adding a fixture builder throws loudly at seed time rather than silently seeding zero rows for it.
- **Writes through the raw, unscoped Prisma client on purpose** — this is the one module in the repo explicitly exempted from the tenant-scoping requirement and from the `no-restricted-syntax` raw-SQL ESLint ban (both exemptions are scoped to this file only), because the fixture must be able to write tenant A's rows while code under test runs as tenant B.
- Guarded by `assertSafeSeedTarget()` — refuses to run (denylist + allowlist check on the Neon endpoint ID) unless the target is the known `einort-test` branch, never `DATABASE_URL`/`.env.local`'s development branch. This guard is defense against accidentally truncating the dev database and is treated as load-bearing, not incidental.
- Per-tenant row builders never set `tenantId` directly — the seed loop appends it, so a builder cannot accidentally cross-stamp a tenant.

**Test data location:** `tests/fixtures/` for binary fixtures (e.g. `sample-product.jpg`, regenerable via a documented Sharp script embedded in `tests/unit/image-pipeline.test.ts`'s header comment rather than committed from a stock photo, to avoid licensing questions and keep its properties stated rather than assumed).

**In-memory state fixtures for unit tests:** small `vi.hoisted` objects standing in for Redis/cookie-jar state (e.g. `redisState` in `cart.test.ts`), mutated directly by test bodies rather than through a full mock library.

## Coverage

**Requirements:** No coverage threshold enforced in `package.json` or `vitest.config.ts`. No coverage script defined; run `npx vitest run --coverage` ad hoc if needed (requires an installed coverage provider, not currently a dependency).

## Test Types

**Unit tests (`tests/unit/`):**
- Pure-function tests over exported business logic with no I/O (`state-machine.test.ts`, `variant-matrix.test.ts`, `order-number.test.ts`, `phone.test.ts`, `slug.test.ts`, `ussd.test.ts`, `whatsapp.test.ts`).
- Mocked-I/O tests for logic that touches Redis/cookies/headers but not Postgres (`cart.test.ts`, `entitlements.test.ts`, `image-pipeline.test.ts` — Sharp itself runs for real, locally, against a fixture file, no network).
- **Static-analysis "contract" tests** — a distinct, deliberate pattern: read a source file from disk as text (`readFileSync`), strip comments (and sometimes strings) with a hand-written mini-parser, and assert on structural properties via regex/string matching. Used to enforce invariants that no runtime test can observe, e.g.:
  - `no-tenant-id-param.test.ts` — no Server Action handler accepts a raw `tenantId` parameter.
  - `surface-token-isolation.test.ts` — style-token scoping isn't leaked across surfaces.
  - `dashboard-nav.test.ts` — every dashboard route is actually linked from the nav rail, `aria-current` is set, no inline user-facing copy, and the "gold accent" color budget (exactly 2 uses across the whole codebase) is respected.
  - `single-order-state-writer.test.ts`, `model-registry-drift.test.ts` — architectural invariants (single write path, registry/schema drift).
  These tests explicitly guard against "passing vacuously": each includes an assertion that the scanned file/set of files is non-empty and was actually found, so a rename that silently orphans the check fails loudly instead of reporting false health.
- **Exhaustive/table-driven sweep tests** — rather than hand-picking cases, iterate the full cross-product of an enum/state space and assert an implementation agrees with an independently-restated rule for every combination. `state-machine.test.ts`'s `canTransition exhaustive sweep` iterates all `channels × fromStates × toStates` (pinning the expected combination count, e.g. `expect(combinations).toBe(108)`, so a shrunken enum can't make the sweep pass by iterating over nothing) and also asserts the sweep is non-vacuous (some transitions must be allowed on every channel).

**Integration/isolation tests (`tests/isolation/`):**
- Full-stack tests against a real Postgres (Neon test branch), real Better Auth, real Prisma — exercising Server Actions end-to-end through their public entry points (e.g. `signUpMerchant` → `selectPlan` → `createProduct`), not by calling internal helpers directly.
- Primary focus: tenant isolation guarantees that are vacuously true against a stubbed/mocked database and therefore untestable anywhere else — cross-tenant leakage, composite foreign-key enforcement, transaction rollback-on-refusal, plan-limit server-side enforcement independent of any client-side UI gating.
- `tenant-isolation.test.ts` runs a generic isolation battery across every registered tenant-scoped model via the `TENANT_SCOPED_MODELS` registry, so a newly added model is automatically covered without a new hand-written test.
- Assertions on "refusal" always also assert "and nothing partial was written" — a rejection that left an orphan row behind is treated as worse than no rejection.

**E2E tests:** Not used. No Playwright/Cypress present.

## Common Patterns

**Async testing:**
```ts
await expect(
  createProduct({ ...simpleProduct("X"), categoryId: `${TENANT_B.id}-category-1` }),
).rejects.toThrow();
```

**Error/rejection testing:**
```ts
const refused = await createProduct(simpleProduct("One Too Many"));
expect(refused.ok).toBe(false);
expect((refused as ActionFailure).error.form).toEqual([expectedMessage]);
```
Result-union testing narrows with an `if (!result.ok) return;` / type-cast pattern (`as ActionFailure`) rather than a custom matcher, since `ActionResult<T>` is a plain discriminated union.

**Custom failure messages** — the dominant idiom for any non-obvious assertion:
```ts
expect(
  disagreements,
  "canTransition disagreed with `registry row contains to` AND `to is not " +
    "claim-only unless the channel is MANUAL_TRANSFER`. Those two clauses are " +
    "the whole rule (ORD-01 + D-02/D-03); a third condition living in the " +
    "function is a rule nobody can find from the table.",
).toEqual([]);
```
Always explain the invariant and, where practical, how to fix a real regression — not just restate the expected value.

---

*Testing analysis: 2026-08-30*
