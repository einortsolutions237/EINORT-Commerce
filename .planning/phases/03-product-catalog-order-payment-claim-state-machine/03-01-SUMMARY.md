---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 01
subsystem: database
tags: [prisma, postgres, neon, multi-tenancy, composite-foreign-keys, vitest, migrations]

# Dependency graph
requires:
  - phase: 01-foundation-tenancy
    provides: "scopedDb tenant-scoping extension, TENANT_SCOPED_MODELS registry, the two-tenant isolation fixture and its Neon test branch, prisma.config.ts (Prisma 7 driver-adapter setup), the eslint generated-client import zone"
  - phase: 02-subscriptions-entitlements
    provides: "the plan/trial migration this one stacks on (20260817214536_plan_trial_entitlements)"
provides:
  - "Nine tenant-scoped models: Category, Product, ProductVariant, ProductImage, Order, OrderItem, OrderEvent, PaymentClaim, MerchantPaymentSettings"
  - "Five enums: OrderState, OrderChannel, PaymentOperator, ClaimStatus, EventActor"
  - "Composite foreign keys (tenantId, <fk>) making a cross-tenant reference a Postgres rejection"
  - "src/server/db/enums.ts — the single sanctioned import path for enum names in feature code"
  - "ScopedTx type alias for helpers that receive a transaction client"
  - "An applied, committed migration on both the dev and Neon test branches"
  - "Catalog/order/claim fixture rows for both fixture tenants"
  - "Proof, against real Postgres, that tenant scoping survives $transaction"
affects: [03-02-product-crud, 03-03-order-state-machine, 03-04-checkout, 03-05-payment-claims, 03-06-merchant-order-management, phase-04, phase-05, phase-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composite FK tenant guard: @relation(fields: [tenantId, <fk>], references: [tenantId, id]) backed by @@unique([tenantId, id])"
    - "Empty-string sentinel for optional variant axes (NOT NULL DEFAULT '') so the unique index actually collides"
    - "Sanctioned re-export module as the single door through a lint import ban"
    - "Registry array kept in FK dependency order because the seed batches in that order"

key-files:
  created:
    - src/server/db/enums.ts
    - prisma/migrations/20260824031644_product_catalog_orders_claims/migration.sql
  modified:
    - prisma/schema.prisma
    - src/server/db/tenant-scoped.ts
    - tests/setup/seed-two-tenants.ts
    - tests/isolation/tenant-isolation.test.ts

key-decisions:
  - "Cross-tenant references are refused by Postgres composite FKs, not by application checks — there is no code path that validates a submitted categoryId/productId against the caller's tenant, and there does not need to be"
  - "ProductVariant.option1Value/option2Value are NOT NULL DEFAULT '' rather than nullable, because Postgres treats NULLs as distinct in a unique index and two all-NULL default variants would both be accepted"
  - "Stock lives only on ProductVariant; an option-less product still owns exactly one variant, so there is exactly one decrement code path"
  - "Order.trackingTokenHash carries a GLOBAL unique index, not a tenant-led one, mirroring StoreSlugHistory.slug"
  - "MerchantPaymentSettings uses a single-field tenantId @unique so findUnique/upsert by tenantId work directly; the isolation battery handles the one-row-per-tenant cardinality rather than skipping the model"
  - "The Product fixture leaves categoryId NULL, because the category FK is onDelete: Restrict and the generic isolation battery runs deleteMany against every registered model"
  - "The seed's fixture reference normalisation is duplicated rather than imported, so a regression in the production normaliser cannot move both sides together"

patterns-established:
  - "Pattern 1: every tenant-scoped model declares tenantId required with no default, so a nested or unscoped create is a compile error"
  - "Pattern 2: registering a model in TENANT_SCOPED_MODELS obliges a seed builder AND an isolation probe; both omissions fail loudly with a message naming the fix"
  - "Pattern 3: money is whole-XAF Int everywhere — no Decimal, no minor units"
  - "Pattern 4: order line items store product data as plain columns, not relations, so an order shows what was bought at the price charged"

requirements-completed: [CAT-01, CAT-03, ORD-01, ORD-04, ORD-05]

# Metrics
duration: 105min
completed: 2026-08-24
---

# Phase 3 Plan 01: Catalog, Order and Payment-Claim Data Foundation Summary

**Nine tenant-scoped Prisma models and five enums behind composite foreign keys that make a cross-tenant reference a Postgres error, with the migration applied to both Neon branches and 94 new isolation assertions proving the boundary — including that it survives `$transaction`.**

## Performance

- **Duration:** ~105 min (dominated by two full 24-minute test runs)
- **Completed:** 2026-08-24
- **Tasks:** 3
- **Files modified:** 4 (+2 created)

## Accomplishments

- `prisma/schema.prisma` now carries 17 models and 5 enums. The nine new models are wired to each other through composite FKs `(tenantId, <fk>) REFERENCES <table>(tenantId, id)`, verified in the emitted DDL rather than assumed from the Prisma DSL — RESEARCH.md rated composite-FK ergonomics MEDIUM confidence and named exactly this inspection as what raises it.
- The migration `20260824031644_product_catalog_orders_claims` is applied to the development branch and to the Neon `einort-test` branch, and `npx prisma migrate status` reports no pending migrations against either.
- `src/server/db/enums.ts` gives feature code a single sanctioned import for `OrderState`/`OrderChannel`/`PaymentOperator`/`ClaimStatus`/`EventActor`, so the ESLint ban on `generated/prisma*` imports stays absolute instead of accumulating per-site disables.
- The isolation suite went from 250 to 344 tests, all passing, 0 skipped, and byte-identical across two consecutive runs. 90 of the 94 new tests came for free: the battery is model-generic, so registering the nine models enrolled them automatically.
- RESEARCH.md assumption A1 — "does the tenant extension follow the `tx` handed to `$transaction`?" — is now a fact this codebase owns, in both directions: a create inside a transaction is stamped with the caller's tenant, and an `updateMany` naming another tenant's product returns `count: 0` and changes nothing.

## Task Commits

1. **Task 1: models, enums, registry and enum re-export** — `f50cefe` (feat)
2. **Task 2: named migration** — `67ca7c8` (feat)
3. **Task 3: fixtures and `$transaction` proof** — `258aaa6` (test)

## Files Created/Modified

- `prisma/schema.prisma` — 9 models + 5 enums appended under the tenant-scoped banner, with the Pattern 1 doc-comments transcribed so the D-04/D-05/D-08/D-10/D-12 and ORD-04/ORD-05 rationale travels with the schema.
- `prisma/migrations/20260824031644_product_catalog_orders_claims/migration.sql` — the DDL. 6 composite FKs, `option1Value`/`option2Value` as `TEXT NOT NULL DEFAULT ''`, a global `order_trackingTokenHash_key`, and a tenant-led `payment_claim_tenantId_referenceNormalized_key`.
- `src/server/db/tenant-scoped.ts` — `REGISTERED_MODELS` extended to all ten models in FK dependency order, plus the exported `ScopedTx` alias and the comment explaining why prisma/prisma#19565 makes it safe and prisma/prisma#17948 does not apply.
- `src/server/db/enums.ts` — new. The sanctioned door, with a header stating why the alternatives (per-site eslint-disable, hand-maintained duplicate) are worse.
- `tests/setup/seed-two-tenants.ts` — nine fixture builders, all deterministic; the transaction-timeout fix described below.
- `tests/isolation/tenant-isolation.test.ts` — nine probes, one-row-per-tenant handling, and four new named tests.

## Decisions Made

**The Product fixture leaves `categoryId` NULL.** The category FK is `onDelete: Restrict` (D-08 — a category holding products is not disposable), and the generic isolation battery runs `deleteMany({})` against every registered model. A fixture product linked to the fixture category would have turned `Category`'s battery into a foreign-key error that had nothing to do with tenant isolation. Both rows still exist and are independently asserted; plan 03-02 owns the linked case. The same reasoning applies to the `Product` isolation probe.

**`MerchantPaymentSettings` is handled, not skipped.** Its `tenantId String @unique` means tenant B cannot hold a fixture row and a probe row simultaneously, which breaks the battery's create-family cases. Rather than exempt the model — a model exempted from the battery is a model with nothing proving its boundary — the probe declares `singleRowPerTenant` and the create paths free the slot through `adminDb` first. Every operation that could actually leak (all reads, `update`, `updateMany`, `delete`, `deleteMany`, `upsert`) runs identically to every other model.

**The seed duplicates ORD-04's reference normalisation instead of importing it.** The production normaliser lands in plan 03-05 under `src/server/**`; importing it would make the fixture agree with the code under test by construction, so a regression would move both sides together and the suite would stay green.

**`deleteMany` in the sweep now asserts an exact count.** The old `count >= 1` would pass on a model whose slot the sweep had already emptied. It now counts tenant B's survivors first and asserts the delete matched all of them — strictly stronger, and required for the one-row-per-tenant case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Seed transaction exceeded Prisma's 5 s default timeout**

- **Found during:** Task 3, first full-suite run
- **Issue:** `seedTwoTenants` assembles the whole reseed as one `$transaction([...])`, and Phase 3 took that batch from 4 statements to 14. The Rust-free client issues each array element as its own round trip inside the BEGIN/COMMIT, and the `TRUNCATE` now spans 17 tables — against the remote Neon branch the batch lands around 6 s. The 5 s default aborted it with `A commit cannot be executed on an expired transaction`. It presented as 12 scattered, unrelated-looking isolation failures (including one in `signup.test.ts`), because the reporting test was simply whichever one happened to own the slowest reseed.
- **Fix:** `new PrismaClient({ transactionOptions: { maxWait: 15_000, timeout: 30_000 } })` in the seed's cached client factory, with a comment recording why the timeout was raised rather than the reseed split — splitting would trade a bounded wait for a fixture that can be left half-applied, which is what the single-transaction design exists to prevent. 30 s stays under the `hookTimeout: 60_000` so a genuine hang still surfaces as a hang. Test-fixture setting only; no production client is affected.
- **Files modified:** `tests/setup/seed-two-tenants.ts`
- **Verification:** Two consecutive `npm run test:full` runs, 344 passed / 0 failed / 0 skipped each.
- **Committed in:** `258aaa6` (Task 3 commit)

**2. [Rule 2 - Missing Critical] Isolation probes for the nine new models**

- **Found during:** Task 3
- **Issue:** The plan's Task 3 action describes extending `MODEL_FIXTURES` and adding one `$transaction` case, but `tests/isolation/tenant-isolation.test.ts` is driven by `TENANT_SCOPED_MODELS` and throws for any registered model without a `MODEL_PROBES` entry. Registering nine models without probes is a hard failure, and `model-registry-drift.test.ts`'s own failure message already prescribes the probe as part of the workflow — so this is implied work rather than new scope.
- **Fix:** One probe per new model, each supplying a unique-constraint-safe `newRow` and a mutation that touches no unique constraint. All probes hang off tenant B's fixture parents because every create in that file runs as tenant B.
- **Files modified:** `tests/isolation/tenant-isolation.test.ts`
- **Verification:** 90 new generic assertions pass across the nine models.
- **Committed in:** `258aaa6` (Task 3 commit)

**3. [Rule 2 - Missing Critical] Three named tests for the plan's `must_haves.truths`**

- **Found during:** Task 3
- **Issue:** Three of the plan's five stated truths had no assertion anywhere: that a cross-tenant `categoryId` is refused by Postgres rather than by a code check (T-03-01), that claim-reference uniqueness is tenant-led in both directions (ORD-04 / T-03-04), and that an option-less product owns exactly one variant with the empty-string sentinels (CAT-03 / Pitfall 2). The generic battery covers tenant isolation, not these schema-shape guarantees.
- **Fix:** A `describe("the Phase 3 schema guarantees")` block with one test each. The cross-tenant FK test is the load-bearing one: nothing in `src/**` validates a submitted `categoryId` against the caller's tenant, so if the FK were single-column that insert would succeed.
- **Files modified:** `tests/isolation/tenant-isolation.test.ts`
- **Verification:** All three pass; the FK test fails loudly if the composite FK is ever downgraded.
- **Committed in:** `258aaa6` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing critical)
**Impact on plan:** No scope creep. The blocking fix was caused directly by this plan's own growth of the fixture; the two additions are work the plan's `must_haves` and the repo's own drift-guard error messages already required.

## Issues Encountered

- **Task 2's verification could not run at Task 2.** The plan puts `npm run test:full` in Task 2's `<automated>` block, but Task 1 had already extended `TENANT_SCOPED_MODELS`, and the seed loop hard-fails on a registered model with no fixture builder — which Task 3 supplies. Running it at Task 2 would have been a guaranteed, uninformative failure. Task 2 was verified with `npx prisma migrate status` plus direct DDL inspection (composite FK count, `payment_claim` table, `NOT NULL DEFAULT ''` on the option columns, both unique-index shapes), and the suite was run once at the end of Task 3 as the plan's Task 2 action itself asks ("Prove that propagation by running the full suite at the end of this task rather than by assuming it").
- **`prisma/migrations/migration_lock.toml` showed as modified with an empty diff** after `migrate dev` — a CRLF normalisation artifact, reverted rather than committed.
- **Full-suite runtime grew from ~2 min to ~24 min.** Out of scope and not a defect — it is the arithmetic of a model-generic battery over 10 models with a reseed before every test. Logged with options in `deferred-items.md`.

## Threat Flags

None. Every model added is covered by the plan's existing threat register; no new network endpoint, auth path or file-access pattern was introduced.

## Known Stubs

None.

## User Setup Required

None — no external service configuration required. The Neon dev and test branches were already provisioned in Phase 1 and both now carry the migration.

## Next Phase Readiness

Wave 1's blocking dependency is cleared. Plans 03-02 through 03-16 can now:

- import enum names from `@/server/db/enums` without tripping the lint gate;
- write through `scopedDb` against any of the nine models, including inside `$transaction`, with the scoping guarantee proven rather than assumed;
- type transaction-taking helpers with `ScopedTx`;
- assert against seeded catalog/order/claim rows for both fixture tenants.

Two things for the next executor to carry:

- Registering any further tenant-scoped model now obliges three edits, not one: `REGISTERED_MODELS`, `MODEL_FIXTURES`, `MODEL_PROBES`. All three failures are loud and name the fix, but they are three separate loud failures.
- Plan 03-03's `transitionOrder()` will open interactive transactions against a remote branch. The 5 s default transaction timeout that bit the fixture here applies to `prismaBase` too — worth deciding deliberately rather than discovering.

## Self-Check: PASSED

- `prisma/schema.prisma` — FOUND
- `src/server/db/enums.ts` — FOUND
- `src/server/db/tenant-scoped.ts` — FOUND
- `prisma/migrations/20260824031644_product_catalog_orders_claims/migration.sql` — FOUND
- `tests/setup/seed-two-tenants.ts` — FOUND
- `tests/isolation/tenant-isolation.test.ts` — FOUND
- Commit `f50cefe` — FOUND
- Commit `67ca7c8` — FOUND
- Commit `258aaa6` — FOUND

---
*Phase: 03-product-catalog-order-payment-claim-state-machine*
*Completed: 2026-08-24*
