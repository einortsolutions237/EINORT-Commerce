---
phase: 04-theme-section-block-system-flagship-template
plan: 01
subsystem: database
tags: [prisma, postgres, multi-tenancy, better-auth, migrations, tenant-isolation]

# Dependency graph
requires:
  - phase: 01-tenant-foundations
    provides: scopedDb Prisma client extension, REGISTERED_MODELS registry, two-tenant isolation battery
  - phase: 02-plan-trial-entitlements
    provides: Organization additionalFields `input: false` precedent (planTier, subscriptionStatus)
  - phase: 03-catalog-orders-claims
    provides: MerchantPaymentSettings — the singleRowPerTenant fixture/probe precedent
provides:
  - StorefrontTheme model (one row per tenant, draft/published brand tokens, templateKey, logoKey)
  - StorefrontPage model (one row per tenant+pageType, draft/published section documents)
  - Organization.industry nullable column (ONB-02 segment capture, input:false)
  - Both models registered in TENANT_SCOPED_MODELS with seed fixtures and isolation probes
  - Migration 20260902141926_storefront_theme_page_industry applied to dev and test branches
affects:
  - 04-02 through 04-13 (every plan in this phase reads these models through the generated client)
  - Phase 5 segment templates (templateKey is deliberately independent of industry)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Draft/published as two columns on one row, not two tables — publish is a single row write and a half-published state is not representable"
    - "templateKey stored, never derived from industry — keeps Phase 5 from auto-migrating existing merchants"
    - "logoKey on a tenant-scoped model instead of Better Auth's core Organization.logo field"

key-files:
  created:
    - prisma/migrations/20260902141926_storefront_theme_page_industry/migration.sql
  modified:
    - prisma/schema.prisma
    - src/server/auth/auth.ts
    - src/server/db/tenant-scoped.ts
    - tests/setup/seed-two-tenants.ts
    - tests/isolation/tenant-isolation.test.ts

key-decisions:
  - "StorefrontTheme.logoKey exists instead of writing Organization.logo, because logo is a Better Auth CORE field that input:false cannot protect (T-04-10)"
  - "Organization.industry declared input:false with NO defaultValue — NULL is the meaningful third state the onboarding redirect ladder gates on (T-04-13)"
  - "templateKey is deliberately independent of industry (D-03) so Phase 5 can ship segment templates without auto-migrating anyone"
  - "Neither new model declares a relation to Organization — scopedDb is the isolation mechanism, not a foreign key"
  - "StorefrontPage's isolation probe mutates `draft`, not `pageType`, because pageType sits inside @@unique([tenantId, pageType])"

patterns-established:
  - "Parentless tenant-scoped models append to the END of REGISTERED_MODELS — the array's order drives the seed's batched $transaction and Postgres checks FKs immediately"
  - "Seed fixtures set every @default(now())/@updatedAt column explicitly to FIXTURE_EPOCH so two runs are byte-identical"
  - "A model registered as tenant-scoped is clamped from both sides: seed-two-tenants throws without a fixture, probeFor throws without a probe, model-registry-drift fails if a tenantId-bearing model is unregistered"

requirements-completed: [EDIT-01, ONB-02]

# Metrics
duration: ~75min
completed: 2026-09-02
---

# Phase 4 Plan 01: Storefront Theme & Page Data Model Summary

**Two tenant-scoped Prisma models (`StorefrontTheme`, `StorefrontPage`) with a draft/published split, a nullable `Organization.industry` segment column locked behind Better Auth `input: false`, both models registered in `TENANT_SCOPED_MODELS` with seed fixtures and isolation probes, migrated onto the dev and test Neon branches.**

## Performance

- **Duration:** ~75 min (resumed execution; the full isolation suite alone runs ~22 min against remote Neon)
- **Tasks:** 3
- **Files modified:** 5 (+1 migration created)

## Accomplishments

- `storefront_theme` and `storefront_page` tables exist in both the dev and test Neon branches, each with a `tenantId` column, and `organization.industry` exists and is nullable.
- Both models are registered in `TENANT_SCOPED_MODELS`, so `scopedDb` stamps and filters `tenantId` on every operation including both halves of an `upsert` (T-04-06).
- The generic two-tenant isolation battery now runs its full operation sweep against both new models — `npm run test:full` is green at 50 files / 752 tests.
- `Organization.industry` is unreachable from any request body: declared `input: false` with no `defaultValue` in the organization `additionalFields` (T-04-13).
- `Organization.logo` was left completely untouched; the tenant's logo key lives on `StorefrontTheme.logoKey` instead (T-04-10).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add StorefrontTheme, StorefrontPage and Organization.industry to the Prisma schema** — `52a8a63` (feat)
2. **Task 2: Register both models in TENANT_SCOPED_MODELS, add seed fixtures and isolation probes** — `7c81086` (feat)
3. **Task 3: Push the schema to the database and regenerate the Prisma client** — `cc97b3c` (feat)

## Files Created/Modified

- `prisma/schema.prisma` — `StorefrontTheme` (tenantId `@unique`, templateKey, logoKey, draft/publishedTokens, publishedAt), `StorefrontPage` (`@@unique([tenantId, pageType])`, draft/published documents), and `Organization.industry`, all with house-style `///` doc comments naming their requirement IDs.
- `src/server/auth/auth.ts` — `industry` added to the organization `additionalFields` block: `type: "string"`, `input: false`, `required: false`, deliberately no `defaultValue`.
- `src/server/db/tenant-scoped.ts` — `"StorefrontTheme"` then `"StorefrontPage"` appended to `REGISTERED_MODELS`; the array's ORDER IS LOAD-BEARING comment updated so it still describes the real tail of the list.
- `tests/setup/seed-two-tenants.ts` — two `MODEL_FIXTURES` builders, `FIXTURE_EPOCH` on every DateTime, neither setting `tenantId` (the seed loop stamps it).
- `tests/isolation/tenant-isolation.test.ts` — `MODEL_PROBES` entries for both; `StorefrontTheme` carries `singleRowPerTenant: true`, `StorefrontPage` does not.
- `prisma/migrations/20260902141926_storefront_theme_page_industry/migration.sql` — created via `prisma migrate dev`, joining the existing three-migration history rather than taking the `db push` fallback.

## Decisions Made

- **Took the `migrate dev` primary path, not the `db push` fallback.** The environment was TTY-capable and the dev branch reported no drift, so the project keeps a real, ordered migration history (now 4 migrations).
- **Ran `prisma format` after editing the schema.** This re-aligned the `Organization` field block (11 existing lines) because the new `industry` column changed the widest-name column. The churn is confined to that one model and is a direct consequence of the change, not unrelated reformatting.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] StorefrontPage's isolation probe mutates `draft`, not `pageType`**
- **Found during:** Task 2
- **Issue:** The plan specified `mutation: () => ({ pageType: "probe-mutated" })` for `StorefrontPage`. The `ModelProbe` contract requires "a field mutation that touches no unique constraint", and `pageType` sits inside `@@unique([tenantId, pageType])`. The battery's `injects tenantId into every intercepted Prisma operation` test runs an **unfiltered** `updateMany` after inserting create/createMany/createManyAndReturn probe rows — collapsing five of tenant B's rows onto the same `(tenantId, pageType)` key. That would have failed on a unique constraint having nothing to do with tenant isolation. Every pre-existing probe in the map (`Category`, `Product`, `ProductVariant`, `ProductImage`, `Order`) already picks a constraint-free column for exactly this reason.
- **Fix:** `mutation: () => ({ draft: { version: 1, sections: [], probe: "mutated" } })`, with a comment recording why `pageType` is the wrong choice. `StorefrontTheme`'s prescribed `templateKey` mutation was kept — that column carries no unique constraint.
- **Files modified:** `tests/isolation/tenant-isolation.test.ts`
- **Verification:** `npm run test:full` green, 752 tests.
- **Committed in:** `7c81086` (Task 2 commit)

**2. [Rule 3 - Blocking] Restored the gitignored dev environment in the worktree**
- **Found during:** Task 1 verification
- **Issue:** The worktree had no `node_modules`, no `src/generated/`, and no `.next/types` — `npm run typecheck` failed with 9 `Cannot find name 'PageProps' / 'LayoutProps'` errors (Next 16 generates those types) and nothing could resolve a dependency.
- **Fix:** Copied `node_modules` from the main checkout (a filesystem copy, **no registry fetch** — this plan installs nothing, preserving the T-04-SC zero-install posture), copied `src/generated/`, and ran `npx next typegen` to produce `.next/types` + `next-env.d.ts`. All four are gitignored; nothing tracked was affected.
- **Files modified:** none tracked
- **Verification:** `npm run typecheck` and `npm run lint` both exit 0.
- **Committed in:** n/a (gitignored artifacts only)

**3. [Rule 3 - Blocking] Replaced the `node_modules` junction with a real copy**
- **Found during:** Task 3 verification
- **Issue:** `node_modules` was first restored as a Windows directory junction to the main checkout. `npm run typecheck`, `npm run lint` and `npm run test:full` all worked, but `npm run build` panicked: `TurbopackInternalError: Symlink [project]/node_modules is invalid, it points out of the filesystem root`. A build failure caused purely by how the worktree environment was assembled.
- **Fix:** Removed the junction and `robocopy`'d the 843 MB tree in as real files.
- **Files modified:** none tracked
- **Verification:** `npm run build` exits 0, all 23 routes compiled.
- **Committed in:** n/a (gitignored artifacts only)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking-environment)
**Impact on plan:** The one code deviation prevents a guaranteed test failure and follows the file's own established convention. The other two are worktree environment repair touching no tracked file. No scope creep.

## Issues Encountered

- **The full suite takes ~22 minutes** (1307s) against the remote Neon test branch — the isolation battery reseeds both tenants before every test, and this plan added two more models to that loop. It exceeds a 10-minute command timeout and had to be run as a background job. Worth knowing for the remaining plans in this phase.
- **Acceptance criterion `grep -v ... | grep -c "logo String?"` returns 0, not 1.** This is a false negative in the criterion's literal, not a problem with the code: `prisma/schema.prisma` aligns field types, so line 111 reads `logo      String?` (multiple spaces), which the single-space pattern cannot match. The criterion's intent is satisfied — `Organization.logo` appears exactly once and is byte-identical to its pre-phase state.

## Threat Flags

None — no security-relevant surface was introduced beyond what the plan's threat register already covers. `T-04-06`, `T-04-10` and `T-04-13` are all mitigated as specified.

## Verification

| Gate | Result |
|------|--------|
| `npm run typecheck` | exit 0 |
| `npm run lint` (`--max-warnings=0`) | exit 0 |
| `npm run test:full` | exit 0 — 50 files, 752 tests passed |
| `npm run build` | exit 0 |
| `npx prisma migrate status` (dev) | in sync, 4 migrations |
| test branch (`TEST_DATABASE_URL`) | 4 migrations found, no pending migrations |
| `tests/isolation/model-registry-drift.test.ts` | 3/3 passed — every tenantId-bearing model is registered |

## User Setup Required

None — no external service configuration required. This plan installs nothing.

## Next Phase Readiness

- Every downstream plan in Phase 4 can now read and write `StorefrontTheme` / `StorefrontPage` through `scopedDb` with tenant filtering enforced structurally.
- `src/server/theming/registry.ts` (`TEMPLATES`, `INDUSTRY_SEGMENTS`) is referenced by the new schema doc comments but does not exist yet — it is a later plan's output. The comments are forward references, not broken links in code.
- `pageDocumentSchema` (the Zod validator for the `draft`/`published` documents) is likewise still to be built; the columns are untyped `Json` until then, and the seed fixtures deliberately hold trivial `{ version: 1, sections: [] }` documents so a later schema change cannot break the generic isolation battery.

## Self-Check: PASSED

All claimed files exist on disk and all four claimed commits exist in the branch history. No modifications to `STATE.md` or `ROADMAP.md` — the orchestrator owns those.

---
*Phase: 04-theme-section-block-system-flagship-template*
*Completed: 2026-09-02*
