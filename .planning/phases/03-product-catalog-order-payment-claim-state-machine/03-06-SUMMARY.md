---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 06
subsystem: database
tags: [prisma, zod, server-actions, tenant-isolation, next.js]

# Dependency graph
requires:
  - phase: 03-product-catalog-order-payment-claim-state-machine
    provides: "03-01's Category/Product/ProductVariant/ProductImage schema and scopedDb/scopedCreateData; 03-04's dashboard shell and strings.products copy"
provides:
  - "productLimitFor() — fail-closed product-count entitlement resolver (50/250/null by tier)"
  - "expandVariantMatrix() — pure, 2-axis, 50-combination-capped variant expander shared by server and (in 03-11) the client form preview"
  - "src/server/catalog/{queries,actions}.ts — the full tenant-scoped catalog write layer: createCategory, createProduct, updateProduct, setProductActive"
  - "/dashboard/products — the A1 products list page with cap meter, deactivate/reactivate, no delete affordance"
affects: [03-11-product-form, 03-storefront-catalog, 03-pdp, 03-cart]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Product-count entitlement mirrors memberLimitFor: absent/null/unrecognised tier fails closed to the Starter cap, never to unlimited"
    - "Variant matrix as one pure function: no-option products get an implicit single ('', '') variant so stock always lives at exactly one level"
    - "Parent + children written as separate createMany calls inside one $transaction, never nested creates — the tenant-scope Prisma extension only intercepts top-level and createMany operations"
    - "No hard-delete anywhere in the catalog write layer or the products route tree (D-08); visibility is toggled via setProductActive, enforced by a comment-stripping lint-style test (surface-token-isolation.test.ts ban 5) that fails the build on a trash icon"
    - "Generated Prisma CreateInput types are named once in src/server/db/model-inputs.ts (the sanctioned door), never imported from @/generated/prisma in feature code"

key-files:
  created:
    - src/server/catalog/slug.ts
    - src/server/catalog/variant-matrix.ts
    - src/server/catalog/queries.ts
    - src/server/catalog/actions.ts
    - "src/app/(dashboard)/dashboard/products/page.tsx"
    - "src/app/(dashboard)/dashboard/products/loading.tsx"
    - "src/app/(dashboard)/dashboard/products/product-row-actions.tsx"
    - tests/unit/product-limit.test.ts
    - tests/unit/variant-matrix.test.ts
    - tests/isolation/catalog.test.ts
  modified:
    - src/server/entitlements/plans.ts
    - src/server/db/model-inputs.ts
    - .planning/phases/03-product-catalog-order-payment-claim-state-machine/deferred-items.md

key-decisions:
  - "productLimitFor fails closed to the Starter cap (50) on an absent, null, or unrecognised plan tier — never resolves to unlimited, so a bad backfill can't accidentally grant an unlimited catalogue"
  - "The product-count check (limitFor + activeProductCount) is deliberately not transactionally atomic with the create — one merchant, one dashboard, an overshoot of at most one row is an acceptable tradeoff against serializable-transaction complexity at pilot scale"
  - "Deactivated products do NOT count against the cap (D-08 forbids deletion, so counting them would ratchet the cap down permanently with no recovery path)"
  - "updateProduct reconciles variants and images by natural key (option pair / storageKey) rather than delete-and-recreate, setting removed variants inactive rather than deleting them, because OrderItem may reference a variant id"
  - "Generated Prisma CreateInput/CreateManyInput types are re-exported one alias at a time from src/server/db/model-inputs.ts rather than via a wildcard or a per-call-site eslint-disable, keeping the generated-client import boundary a two-hit grep"
  - "R2 product thumbnails render via a plain <img> (not next/image) for this plan; deferred to a shared fix across 03-06/03-11/A5 since it needs a next.config.ts remotePatterns change outside this plan's scope"

patterns-established:
  - "Pattern 8 (product-count entitlement): count-before-write, refuse before the transaction opens, fail closed on unknown tier"
  - "Variant-matrix-as-single-source-of-truth: the server recomputes and rejects any client-submitted combination set that doesn't match its own expansion (TEN-08)"

requirements-completed: [CAT-01]

# Metrics
duration: ~35min (resumed-session closeout: verification, deferred-items commit, summary)
completed: 2026-08-30
---

# Phase 3 Plan 6: Product Catalog Write Layer Summary

**Tenant-scoped catalog write layer (createCategory/createProduct/updateProduct/setProductActive through merchantAction) plus the A1 products list page, with a fail-closed product-count cap and a pure 2-axis/50-combination variant-matrix expander shared by server and form.**

## Performance

- **Duration:** Implementation spanned two sessions (2026-08-25 Task 1, 2026-08-30 Tasks 2-3) due to a session-limit disconnect; this closeout session (~35 min) covered verification, the deferred-items commit, and this summary.
- **Started:** 2026-08-25T10:15:07+01:00 (first RED commit)
- **Completed:** 2026-08-30T14:36:44+01:00 (deferred-items closeout commit)
- **Tasks:** 3/3 complete
- **Files modified:** 13 (10 created, 3 modified)

## Accomplishments
- `productLimitFor()` added to `src/server/entitlements/plans.ts`, fail-closed to the Starter cap on any absent/null/unrecognised tier
- Pure `expandVariantMatrix()` / `variantLabelFor()` / `slugifyProductName()` helpers, exhaustively unit-tested (32 assertions)
- Full catalog write layer (`createCategory`, `createProduct`, `updateProduct`, `setProductActive`) through `merchantAction`, cap-enforced, matrix-validated, zero hard-delete paths
- Tenant-scoped read queries (`listProductsForMerchant`, `getProductForEdit`, `listCategories`, `activeProductCount`)
- `/dashboard/products` (A1): cap meter, cap-reached alert, responsive table/card layout, stock-cell rules, deactivate/reactivate via `alert-dialog`, empty state, loading skeleton — no delete affordance anywhere in the route tree

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing tests for product cap + variant matrix** - `46d0de7` (test)
2. **Task 1 GREEN: productLimitFor, slug, variant-matrix** - `08a214f` (feat)
3. **Task 2: catalog queries + the four merchantAction mutations** - `65eda67` (feat)
4. **Task 3: the A1 products list page** - `acbc191` (feat)

**Deferred-items closeout:** `f21ca8a` (docs — R2 thumbnail plain-`<img>` deferral, carried over from the interrupted session)

**Plan metadata:** commit pending (this closeout's final action)

## Files Created/Modified
- `src/server/entitlements/plans.ts` - Adds `productLimitFor()`, updates the `PlanLimits.products` doc-comment to point at `createProduct` as the enforcement site
- `src/server/catalog/slug.ts` - `slugifyProductName()`, pure, NFD-normalising, 60-char cap
- `src/server/catalog/variant-matrix.ts` - `expandVariantMatrix()`, `variantLabelFor()`, `VARIANT_MATRIX_MAX`, `VariantMatrixTooLargeError`, `VariantAxisOrderError`
- `src/server/catalog/queries.ts` - Four tenant-scoped read queries, `server-only`
- `src/server/catalog/actions.ts` - The four `merchantAction` mutations; no delete/deleteMany anywhere
- `src/server/db/model-inputs.ts` - Extended (not created — pre-existing sanctioned door from 03-03/03-07) with `CategoryCreateInput`, `ProductCreateInput`, `ProductVariantCreateManyInput`, `ProductImageCreateManyInput`
- `src/app/(dashboard)/dashboard/products/page.tsx` - A1 server component: heading, cap meter, cap-reached alert, table/card list, empty state
- `src/app/(dashboard)/dashboard/products/loading.tsx` - Skeleton shaped like the final table, no full-page spinner
- `src/app/(dashboard)/dashboard/products/product-row-actions.tsx` - Client island: Edit / Deactivate (alert-dialog) / Reactivate, no Delete item
- `tests/unit/product-limit.test.ts`, `tests/unit/variant-matrix.test.ts` - Table-driven unit coverage for both pure helpers
- `tests/isolation/catalog.test.ts` - CAT-01 tenant isolation, cross-tenant FK rejection, matrix round-trip, slug collision, cap refusal, visibility round-trip, inline category creation against real Postgres
- `.planning/phases/03-product-catalog-order-payment-claim-state-machine/deferred-items.md` - Records the R2-thumbnail plain-`<img>` deferral

## Decisions Made
- `productLimitFor` fails closed (never returns `null`/unlimited) on any tier it doesn't recognise — see key-decisions above.
- Cap check is intentionally non-atomic with the create write (pilot-scale tradeoff, documented in `actions.ts`).
- Deactivated products excluded from the cap count (D-08 consequence).
- `updateProduct` reconciles variants/images by natural key and soft-deactivates removed variants rather than deleting, because `OrderItem` may reference a variant id.
- Generated Prisma `CreateInput` types are named one alias at a time in the pre-existing `src/server/db/model-inputs.ts` sanctioned door rather than via a wildcard re-export or per-call-site `eslint-disable` — this file was extended, not newly introduced, following its own established "one alias per model" discipline from 03-03/03-07.
- R2 product thumbnails render via a plain `<img>` rather than `next/image` in this plan; the fix (parsing `env.R2_PUBLIC_BASE_URL` into `next.config.ts`'s `images.remotePatterns`) is deferred to a shared fix across this plan, 03-11, and the A5 claim-screenshot plan rather than three ad-hoc changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended `src/server/db/model-inputs.ts` instead of adding a new file**
- **Found during:** Task 2 (catalog actions implementation)
- **Issue:** `scopedCreateData<T>` requires the caller to name the generated Prisma `CreateInput` type explicitly, but `eslint.config.mjs` bans importing `@/generated/prisma` from feature code (TEN-02/TEN-05). The plan's `files_modified` list didn't call out `model-inputs.ts`, but the project already has this exact sanctioned-door file (created in 03-03, extended in 03-07) for precisely this problem.
- **Fix:** Appended four new type aliases (`CategoryCreateInput`, `ProductCreateInput`, `ProductVariantCreateManyInput`, `ProductImageCreateManyInput`) to the existing file, following its own documented "one alias per model, added deliberately" convention rather than introducing a parallel mechanism or a per-call-site `eslint-disable`.
- **Files modified:** `src/server/db/model-inputs.ts`
- **Verification:** `npm run lint` (0 warnings), `npm run typecheck` (0 errors), `grep -rn "generated/prisma" src/server/catalog/` returns 0 hits.
- **Committed in:** `65eda67` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for `createProduct`/`createCategory` to compile without weakening the generated-client import boundary. No scope creep — reused an existing, already-audited mechanism.

## Issues Encountered
- **Transient Neon connectivity failure during closeout verification.** The first `npm run test:full` run in this closeout session failed at global setup (`P1001: Can't reach database server`) before any tests ran — consistent with a Neon scale-to-zero cold-start on the shared test branch. A retry with no code changes succeeded cleanly: 33 test files, 517 tests, 0 failures, 0 skipped, including `tests/isolation/stock-race.test.ts` passing on the first (only needed) attempt — no flake occurred in this run.
- The plan's shorthand acceptance-criteria greps (`grep -c "listProductsForMerchant" ... returns 1`, `grep -crE "trash-2|trash" ... returns 0`) don't account for import-line matches or doc-comment mentions of the banned string. Both were manually inspected: `listProductsForMerchant` appears once as an import and once as the single call site (correct usage, not a duplicate call); the "trash" match in `product-row-actions.tsx` is a block-comment line describing the ban itself, which the real enforcement mechanism (`tests/unit/surface-token-isolation.test.ts`'s `codeLinesIn`, which strips whole-line comments) correctly excludes and which passed in the full suite run. Neither required a code change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `src/server/catalog/{slug,variant-matrix,queries,actions}.ts` are the complete, tested authority for product/category writes — 03-11's product-create/edit form can be pure UI against these actions with no second server implementation.
- `expandVariantMatrix()` is ready to be imported client-side (03-11) for the live matrix preview; server and client will share the identical combination logic.
- The R2-thumbnail `next/image` deferral (see `deferred-items.md`) should be picked up once — ideally at the start of 03-11 — rather than fixed three separate times across 03-06, 03-11, and the A5 claim-screenshot plan.
- No blockers for downstream storefront-catalog, PDP, or cart plans reading from this write layer.

---
*Phase: 03-product-catalog-order-payment-claim-state-machine*
*Completed: 2026-08-30*

## Self-Check: PASSED

All 14 referenced files found on disk; all 5 referenced commit hashes found in `git log --oneline --all`.
