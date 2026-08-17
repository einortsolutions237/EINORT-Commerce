---
phase: 01-multi-tenant-foundations-domain-resolution
plan: 04
subsystem: validation
tags: [testing, multi-tenancy, prisma7, vitest, isolation, schema-drift, neon]
requires:
  - "01-01: vitest.config.ts (unit + isolation projects), tests/setup/global-setup.ts, .env.test.example"
  - "01-01: eslint.config.mjs — src/** raw-query ban does NOT cover tests/**"
  - "01-02: src/server/db/tenant-scoped.ts (scopedDb, TENANT_SCOPED_MODELS)"
  - "01-02: src/server/db/admin.ts (adminDb), src/server/db/base.ts (prismaBase)"
  - "01-02: prisma/schema.prisma, prisma.config.ts, the applied init migration"
provides:
  - "tests/setup/seed-two-tenants.ts — TENANT_A/TENANT_B fixture, seedTwoTenants(), closeSeedClient(), assertSafeSeedTarget()"
  - "tests/setup/isolation-setup.ts — per-file teardown for the isolation project"
  - "tests/isolation/tenant-isolation.test.ts — model-generic two-tenant suite"
  - "tests/isolation/model-registry-drift.test.ts — registry/schema drift guard"
  - "tests/unit/seed-guard.test.ts — regression cover for the destructive-seed guard"
  - "prisma/seed.ts — guarded `prisma db seed` entry point"
  - "A migrated + seeded Neon `einort-test` branch"
affects: [01-05, 01-06, 01-07]
tech-stack:
  added: []
  patterns:
    - "Isolation tests are model-generic: they iterate TENANT_SCOPED_MODELS, never name a model"
    - "Destructive fixtures are gated by endpoint-ID allowlist + dev-endpoint denylist, not by connection-string substring"
    - "TEST_DATABASE_URL overrides DIRECT_URL in prisma.config.ts so CLI DDL follows the test branch"
    - "server-only is aliased to its own empty.js in the Vitest isolation project"
    - "Fixture reseeds are one batched $transaction against a cached client"
key-files:
  created:
    - tests/setup/seed-two-tenants.ts
    - tests/setup/isolation-setup.ts
    - tests/isolation/tenant-isolation.test.ts
    - tests/isolation/model-registry-drift.test.ts
    - tests/unit/seed-guard.test.ts
    - prisma/seed.ts
  modified:
    - tests/setup/global-setup.ts
    - vitest.config.ts
    - prisma.config.ts
    - .env.test.example
decisions:
  - "A1 RESOLVED (PASS): the tenant-scoping extension DOES apply inside scopedDb(t).$transaction — no wrapper needed, Phase 3 may write transactional code"
  - "The plan's `einort-test` substring guard was unimplementable; replaced with a Neon endpoint-ID allowlist plus a dev-endpoint denylist"
  - "prisma.config.ts now prefers TEST_DATABASE_URL — the documented 'migrate the test branch' command was running DDL against development"
  - "Per-model required columns cannot be invented generically, so MODEL_FIXTURES/MODEL_PROBES supply data while the loops stay registry-driven"
metrics:
  duration: "~55 min"
  completed: 2026-08-17
  tasks: 2
  commits: 2
---

# Phase 1 Plan 04: Two-Tenant Isolation Suite & Schema-Drift Guard Summary

Tenant isolation stopped being a claim about source code and became a red-or-green
signal: 20 isolation tests run against a real Neon Postgres and prove that tenant B
cannot read, update, delete, aggregate or upsert its way to tenant A's rows through
any intercepted Prisma operation — and a drift guard turns "somebody added a model
and forgot the registry" into a failing build.

---

## Required Plan Outputs

| Question the plan asked | Answer |
|---|---|
| **`$transaction` test result (A1)** | **PASS — A1 resolved, not a blocking finding.** The extension *does* follow the `tx` client yielded by `scopedDb(B).$transaction(...)`. A `create` inside the transaction is stamped `tenantId: B`, a `findMany` inside it returns only B's rows, and the row is still B's after commit. **`scopedDb` needs no `$transaction` wrapper, and Phase 3 may write transactional code against it.** |
| **Observed drift-guard failure message** | Reproduced by emptying `REGISTERED_MODELS`, then restored. Verbatim: `AssertionError: TENANT_SCOPED_MODELS has drifted from prisma/schema.prisma.` / `  MISSING from the registry: StoreSlugHistory` / `  These models carry a tenantId column but are NOT tenant-scoped at runtime, so nothing injects a tenant predicate into queries against them. Add each one to TENANT_SCOPED_MODELS in src/server/db/tenant-scoped.ts, and add a fixture row builder to tests/setup/seed-two-tenants.ts plus a probe to tests/isolation/tenant-isolation.test.ts so the isolation suite actually covers them.: expected [ 'StoreSlugHistory' ] to deeply equal []` — exit code 1. |
| **Total isolation test count** | **20** (17 in `tenant-isolation.test.ts`, 3 in `model-registry-drift.test.ts`), plus the 3 pre-existing `harness.test.ts` tests in the same project. Zero skipped, zero todo. |
| **Full-suite runtime** | **62.2s** for `npx dotenv -e .env.test -- npx vitest run` — 7 files, 135 tests, all passing. |

---

## What Was Built

### Task 1 — The fixture and a global setup that actually reaches the test branch (`48cd82f`)

`tests/setup/seed-two-tenants.ts` exports `TENANT_A` / `TENANT_B` as frozen fixtures
with fixed ids (`tenant-a-fixed-id`, `alpha-store`). Fixed rather than random is a
diagnostics decision: a failing assertion reads `expected "tenant-b-fixed-id",
received "tenant-a-fixed-id"`, which names the leak, instead of two opaque cuids.

`seedTwoTenants()` truncates every table in `public` (discovered from `pg_tables`, so
Phase 3's tables are covered without editing this file), then inserts one
`Organization` + `User` + `Member` per tenant and **one row per model in
`TENANT_SCOPED_MODELS` per tenant**, with the delegate key derived by lowercasing the
model's first character.

The fixture writes through a client it constructs itself from the resolved test
connection string — never the tenant-scoping extension, and deliberately not
`prismaBase` either. Routing it through the scoped client would make every
cross-tenant assertion vacuously true (the fixture could only ever create rows for the
tenant under test); building the client explicitly removes any chance of the truncate
inheriting an ambient `DATABASE_URL`.

### Task 2 — The suite and the guard (`e7cd646`)

`tests/isolation/tenant-isolation.test.ts` contains **no per-model test bodies**. It
iterates `TENANT_SCOPED_MODELS` and generates a `describe` block per registered model,
so the day Phase 3 registers `Product` it inherits the entire battery. Per model:
`findMany` / `findUnique` / `findFirst` isolation, `update` and `delete` on a tenant-A
id asserted to leave the row **byte-unchanged when re-read through `adminDb`** (not
merely to reject), unfiltered `updateMany`/`deleteMany` proven not to touch A,
`count`/`aggregate`/`groupBy` (the two that arrive with no `where` key at all),
the TEN-08 client-supplied-`tenantId` overwrite, and an `upsert` that cannot resurrect
A's row.

Plus one test per model doing behavioural coverage of the whole interception table —
`findUnique`, `findUniqueOrThrow`, `findFirst`, `findFirstOrThrow`, `findMany`,
`count`, `aggregate`, `groupBy`, `create`, `createMany`, `createManyAndReturn`,
`update`, `updateMany`, `upsert`, `delete`, `deleteMany` (16 operations; RESEARCH.md
says "14", which appears to be a miscount of its own 15-row table) — collecting
per-operation failures so a break names the operation.

Asserting on **observable results** rather than on captured `args` was a deliberate
choice. Inspecting args would have required either depending on the extension's
in-place mutation of the `args` object or wrapping `scopedDb` in a second extension
whose ordering relative to the first is an implementation detail. Behavioural
assertions prove the predicate reached SQL and stay true if `tenant-scoped.ts` changes
how it builds arguments.

Three suite-level tests: `adminDb sees both tenants where scopedDb sees one` (TEN-05),
`$transaction inside scopedDb stays scoped` (A1), and the negative control asserting
`scopedDb(B).organization.findMany()` throws with a message naming both `platformDb`
and `adminDb`. That last one guards the failure mode that matters most — not "the
query errors" but "`scopedDb` quietly runs unscoped against a model nobody registered".

---

## Verification

| Gate | Command | Result |
|---|---|---|
| Full suite | `npx dotenv -e .env.test -- npx vitest run` | **7 files, 135 tests, 0 failed, 0 skipped, 0 todo — 62.2s** |
| Isolation only | `... vitest run tests/isolation --reporter=dot` | 3 files, 20 tests passed, 59.4s |
| TEN-02 filter | `... vitest run tests/isolation -t "injects"` | 1 passed / 19 skipped, exit 0 |
| TEN-08 filter | `... -t "ignores client-supplied tenantId"` | 1 passed / 19 skipped, exit 0 |
| TEN-05 filter | `... -t "adminDb sees both tenants"` | 1 passed / 19 skipped, exit 0 |
| TEN-01 drift | `... vitest run tests/isolation/model-registry-drift.test.ts` | 3 passed, exit 0 |
| Drift guard **fails** when it should | emptied `REGISTERED_MODELS`, re-ran | exit 1 with the message quoted above; registry restored, `git status` clean |
| Seed idempotency | ran the seed twice in a row | both exit 0 |
| Fixture counts | scripted against the DB | `organization`=2, `storeSlugHistory`=2, `user`=2, `member`=2 — 8/8 assertions |
| Seed refuses non-test DB | 5 scripted refusal probes | 5/5 (dev pooled, dev direct, unknown endpoint, unparseable URL, and the real test endpoint allowed) |
| Seed refuses without `TEST_DATABASE_URL` | `npx dotenv -e .env.local -- npx tsx ... prisma/seed.ts` | exit **1**, message names the `einort-test` branch |
| Lint | `npm run lint` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |

### Source-level assertions

| Criterion | Result |
|---|---|
| `grep -c 'Prisma.dmmf' tests/isolation/model-registry-drift.test.ts` | **0** |
| `grep -c 'scopedDb' tests/setup/seed-two-tenants.ts` | **0** |
| `grep -c 'describe("StoreSlugHistory' tests/isolation/tenant-isolation.test.ts` | **0** (blocks are driven by `${model}`) |
| `tenant-isolation.test.ts` imports and iterates `TENANT_SCOPED_MODELS` | yes (6 references) |
| `seed-two-tenants.ts` imports and iterates `TENANT_SCOPED_MODELS` | yes (6 references) |
| `global-setup.ts` references `TEST_DATABASE_URL`, never `env.DATABASE_URL` | 3 / **0** |

---

## Deviations from Plan

### 1. [Rule 1 — Bug] `npx dotenv -e .env.test -- npx prisma migrate deploy` was migrating the DEVELOPMENT database

- **Found during:** Task 1 verification — the very first run of the plan's own verify command.
- **Issue:** `.env.test` carries **only** `TEST_DATABASE_URL`. `prisma.config.ts` reads
  `DIRECT_URL`, so with `DIRECT_URL` unset the file's `process.loadEnvFile(".env.local")`
  quietly supplied the **development** connection string. The command printed
  `Datasource "db": ... at "ep-little-unit-zaqlnwiw..."` — the dev endpoint — and reported
  "No pending migrations to apply". The test branch had in fact never been migrated at
  all; that only became visible after the fix, when the same command actually applied the
  init migration. Every plan document, and `.env.test.example`, describes this command as
  "migrate the test branch".
- **Why it matters beyond this plan:** plans 01-05, 01-06 and 01-07 all run isolation
  tests. Left unfixed, any future `migrate deploy` invoked this way — including a
  destructive one — would have landed on development while looking correct.
- **Fix:** `prisma.config.ts` now sets `DIRECT_URL = TEST_DATABASE_URL` whenever the latter
  is present. The override direction is the safe one: a stray `TEST_DATABASE_URL` sends a
  migration to the disposable test branch, whereas the reverse mistake is unrecoverable.
  `global-setup.ts` still passes both URLs explicitly to its child process — belt and
  braces, because the guarantee should not rest on one file.
- **Files:** `prisma.config.ts` · **Commit:** `48cd82f`

### 2. [Rule 3 — Blocking] The specified `einort-test` substring guard was unimplementable

- **Found during:** Task 1, inspecting the real credentials.
- **Issue:** the plan requires `prisma/seed.ts` to "contain a guard on the literal substring
  `einort-test` and throw when it is absent". A Neon connection string never contains the
  branch name. The real `TEST_DATABASE_URL` is
  `...@ep-sweet-shape-za5xwdvh.c-2.eu-west-2.aws.neon.tech/neondb` and the development one is
  `...@ep-little-unit-zaqlnwiw...*/neondb` — same database name, no branch name anywhere.
  `.env.test.example` implies otherwise only because its **placeholder** puts `einort-test`
  in the database-name position. A literal substring guard would have refused the genuine
  test branch 100% of the time, making the seed permanently unrunnable.
- **Fix:** kept the plan's *intent* (a positive guard that names the test branch) using the
  identifier that actually distinguishes branches — the Neon endpoint ID. Three layers:
  (1) the target is read from `TEST_DATABASE_URL` and never falls back to `DATABASE_URL`;
  (2) a denylist rejects the endpoint behind `DATABASE_URL`/`DIRECT_URL` as read **from
  `.env.local` on disk** (not from `process.env`, which the seed itself mutates), with
  Neon's `-pooler` suffix normalised away so the pooled and direct dev hosts count as one
  endpoint; (3) a positive allowlist of known test endpoints, overridable via
  `TEST_DATABASE_ENDPOINTS` for when the branch is recreated. All five refusal paths are
  covered by `tests/unit/seed-guard.test.ts`.
- **Files:** `tests/setup/seed-two-tenants.ts`, `prisma/seed.ts` · **Commit:** `48cd82f`

### 3. [Rule 1 — Bug] `.env.test.example` documented a URL shape that does not exist

- **Found during:** Task 1 — it is the direct cause of deviation 2.
- **Fix:** corrected the placeholder to end in `/neondb`, and documented that branches are
  identified by endpoint ID, plus the new `TEST_DATABASE_ENDPOINTS` override.
- **Files:** `.env.test.example` · **Commit:** `48cd82f`

### 4. [Rule 3 — Blocking] `server-only` throws under Vitest, and `.env.test` cannot satisfy `@/env`

- **Found during:** Task 1.
- **Issue:** two independent blockers on importing `src/server/db/**` from a test.
  `server-only`'s export map resolves to a module that **throws** under every condition
  except `react-server`, which Vitest does not use — so importing `scopedDb` or `adminDb`
  would have failed outright. Separately, `base.ts` reads `env.DATABASE_URL`, and `.env.test`
  defines only `TEST_DATABASE_URL`, so `@/env` would either fail validation or — much worse —
  connect `prismaBase` to whatever `.env.local` held, silently running the "isolation" suite
  against the development database.
- **Fix:** the isolation project aliases `server-only` to the package's own `empty.js` (more
  surgical than adding `react-server` to `resolve.conditions`, which would change React and
  Next resolution too), and derives `DATABASE_URL`/`DIRECT_URL` from `TEST_DATABASE_URL` via
  `test.env`, with valid placeholders for the auth/domain vars. For the `tsx` CLI paths the
  equivalent is `--conditions=react-server`, now baked into `prisma.config.ts`'s seed runner.
- **Files:** `vitest.config.ts`, `prisma.config.ts` · **Commit:** `48cd82f`

### 5. [Rule 2 — Missing critical functionality] The destructive-seed guard had no regression test

- **Rationale:** `T-01-27` is dispositioned `mitigate`, and the mitigation is the only thing
  standing between a test run and the irreversible loss of the development database. A
  mitigation with no test silently regresses. `tests/unit/seed-guard.test.ts` asserts every
  refusal path plus the `-pooler` normalisation and the override. It lives in the **unit**
  project deliberately, so it runs on the fast per-commit gate rather than only when a test
  database happens to be configured; it touches no database.
- **Files:** `tests/unit/seed-guard.test.ts` · **Commit:** `48cd82f`

### 6. Per-model data could not be made fully generic

- **Issue:** the plan asks the seed and suite to grow automatically as models are registered.
  The **loops** do (both are driven by `TENANT_SCOPED_MODELS`), but required columns cannot be
  invented generically — `StoreSlugHistory` needs a globally unique `slug`, and a Phase 3
  `Product` will need its own required fields.
- **Fix:** `MODEL_FIXTURES` (seed) and `MODEL_PROBES` (suite) supply data only. A model
  registered without an entry throws a message naming the exact file and constant to edit.
  This is the correct failure direction: a generic fallback would have silently produced a
  suite that iterated a model and tested nothing.
- **Files:** `tests/setup/seed-two-tenants.ts`, `tests/isolation/tenant-isolation.test.ts`

### 7. Suite runtime reduced 107s → 59s

- **Issue:** the fixture is rebuilt before every test, and against a remote Neon branch the
  per-call client construction and per-statement round trips dominated everything else.
- **Fix:** one cached client per connection string (released by
  `tests/setup/isolation-setup.ts`, wired as a `setupFiles` hook so plans 01-05/01-06 inherit
  the teardown), the truncate statement cached after first discovery, and the entire reseed
  issued as a single batched `$transaction`. The batching also buys atomicity: a half-applied
  reseed would otherwise surface as a mysterious isolation failure rather than a broken
  fixture.
- **Files:** `tests/setup/seed-two-tenants.ts`, `tests/setup/isolation-setup.ts`, `vitest.config.ts`

### 8. Two acceptance criteria conflicted with their own plan text

- `grep -c 'scopedDb' tests/setup/seed-two-tenants.ts` must return 0, yet the same task asks
  for a header comment explaining that the seed does not use it. Resolved by phrasing the
  prohibition by module (`src/server/db/tenant-scoped.ts`) rather than by symbol — the comment
  is unchanged in force, and the grep returns 0.
- Same pattern for `Prisma.dmmf` in the drift guard: the warning now refers to "the `dmmf`
  export", and the test pins its absence with `expect("dmmf" in Prisma).toBe(false)`.

### 9. Environment gaps in a fresh worktree (no commit)

`node_modules`, `.env.local` and `.env.test` are all gitignored, so the worktree carried none
of them — the same blocker plan 01-02 recorded. Ran `npm ci` and copied both env files from the
parent checkout, re-confirming via `git check-ignore` that neither can be committed. Also ran
`npx next typegen` before `typecheck` (plan 01-02 deviation 8). Nothing committed.

---

## Assumption A1 — Resolved

RESEARCH.md flagged A1 as the phase's highest-risk unverified claim: *"the extension applies to
clients yielded inside `scopedDb(t).$transaction(async (tx) => …)`. If false, every transactional
write is unscoped."*

**It holds.** The test opens `scopedDb(TENANT_B.id).$transaction(...)`, performs a `create` and a
`findMany` on the `tx` client, and asserts all three of: the created row carries `tenantId: B`;
the in-transaction read returns only B's rows; and after commit the row is still B's when read
back through `adminDb`, with tenant A's row count unchanged.

Consequences: `scopedDb` does **not** need its own `$transaction` wrapper, and the moratorium on
transactional code in Phase 3 is lifted. The test stays in the suite as a regression guard — this
is exactly the property a future Prisma upgrade could break silently.

---

## Authentication Gates

None. The Neon credentials in `.env.test` were already provisioned and worked as-is.

---

## Known Stubs

None. Every artifact is wired and exercised against a live database. The suite currently covers
exactly one registered model (`StoreSlugHistory`) because that is the only tenant-scoped model in
the schema today — that is coverage of the whole registry, not a gap, and the drift guard is what
keeps the statement true as Phases 3-6 add models.

---

## Threat Flags

None. This plan adds no network endpoint, no auth path and no schema change. It introduces one new
destructive capability — the truncate — and that capability is itself the subject of the guard,
its unit tests, and threat `T-01-27`.

| Threat | Disposition | Evidence |
|---|---|---|
| T-01-21 (cross-tenant read) | mitigated | per-model `findMany`/`findUnique`/`findFirst`/`count`/`aggregate`/`groupBy` assertions |
| T-01-22 (cross-tenant write/delete) | mitigated | tenant A's row re-read through `adminDb` and asserted byte-unchanged after each attempt |
| T-01-23 (client-supplied `tenantId`) | mitigated | `create ignores client-supplied tenantId`, verified at rest |
| T-01-24 (unregistered model runs unscoped) | mitigated | negative control; error names `platformDb` and `adminDb` |
| T-01-25 (transactional writes escaping) | **mitigated — A1 proven true** | `$transaction inside scopedDb stays scoped` |
| T-01-26 (registry decay) | mitigated | drift guard, **with its failure path itself demonstrated** |
| T-01-27 (seed against dev/prod) | mitigated | 3-layer guard + 8 unit tests; also fixed the live `migrate deploy` misdirection (deviation 1) |
| T-01-28 (raw SQL in truncate) | accepted | single `TRUNCATE ... CASCADE`, no tenant predicate, `tests/setup/**` only, documented in the file header |

---

## Commits

| Commit | Task | Description |
|---|---|---|
| `48cd82f` | 1 | Two-tenant seed fixture, guarded seed entry point, working isolation global setup |
| `e7cd646` | 2 | Model-generic isolation suite and schema-drift guard |

---

## Notes for Downstream Plans

- **Phase 3 may write transactional code against `scopedDb`.** A1 is proven (see above).
- **Registering a tenant-scoped model is now four edits, and three of them are enforced:**
  the model in `prisma/schema.prisma`, the name in `REGISTERED_MODELS`
  (`src/server/db/tenant-scoped.ts`), a builder in `MODEL_FIXTURES`
  (`tests/setup/seed-two-tenants.ts`), and a probe in `MODEL_PROBES`
  (`tests/isolation/tenant-isolation.test.ts`). Miss the second and the drift guard fails the
  build; miss the third or fourth and the seed/suite throw a message naming the file.
- **Plans 01-05 and 01-06 get the fixture for free.** Import `TENANT_A` / `TENANT_B` /
  `seedTwoTenants` from `tests/setup/seed-two-tenants`. Any new file under `tests/isolation/`
  automatically inherits the connection teardown via `setupFiles`. Call `seedTwoTenants()` in a
  `beforeEach` if the tests mutate.
- **Do not add `DATABASE_URL` to `.env.test`.** The isolation project derives it from
  `TEST_DATABASE_URL` in `vitest.config.ts`; adding a second source would reintroduce the
  ambiguity that deviation 1 fixed.
- **If the Neon test branch is recreated,** its endpoint ID changes and the seed will refuse to
  run with a message saying so. Update `DEFAULT_TEST_ENDPOINTS` in
  `tests/setup/seed-two-tenants.ts`, or set `TEST_DATABASE_ENDPOINTS`.
- **`tsx` scripts that reach `src/server/**` need `--conditions=react-server`**, or
  `import "server-only"` throws.
- RESEARCH.md's "14 intercepted operations" is a miscount of its own table, which lists 15 model
  operations; the suite behaviourally covers 16 (including `findFirstOrThrow`). No action needed,
  but do not treat "14" as an exhaustive list when adding operations.

---

## Self-Check: PASSED

All 6 claimed created files and all 4 claimed modified files exist on disk. Both commits
(`48cd82f`, `e7cd646`) resolve in `git log`. `git diff --diff-filter=D HEAD~2 HEAD` reports no
deletions. The three throwaway verification scripts (`_probe.ts`, `_probe2.ts`, `_verify-t1.ts`,
`_verify-guard.ts`) are absent from the tree and from both commits. `src/server/db/tenant-scoped.ts`
was temporarily modified for the drift-guard failure demonstration and restored — `git status`
confirms it is unmodified. Per the orchestrator's instructions, `STATE.md` and `ROADMAP.md` were
**not** modified.
