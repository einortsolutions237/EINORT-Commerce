---
phase: 06-merchant-dashboard-platform-admin
plan: 03
subsystem: data-layer
tags: [schema, prisma, migration, tenant-isolation, support-thread, subscription-claim]
requires:
  - "Organization as the tenant primitive (Phase 1)"
  - "TENANT_SCOPED_MODELS registry + scopedDb extension (Phase 1)"
  - "ClaimStatus / PaymentOperator enums (Phase 3)"
  - "two-tenant isolation fixture + generic battery (Phase 1)"
provides:
  - "SupportMessage / SupportAttachment / SubscriptionPaymentClaim models, live in dev + test branches"
  - "SupportAuthor / SupportAttachmentKind enums, re-exported from src/server/db/enums.ts"
  - "Organization.subscriptionCurrentPeriodEnd (stored + displayed only)"
  - "all three models registered tenant-scoped with auto-generated isolation coverage"
affects:
  - "every later Phase 6 plan that writes a support message or a subscription claim"
  - "plans 06-11 / 06-13 (attachments) — no second migration needed"
  - "plan 06-15 (P2002 generic-refusal handler for the global reference key)"
tech-stack:
  added: []
  patterns:
    - "child model with composite FK (tenantId, parentId), mirroring ProductImage"
    - "globally-unique key where the payee is one account, mirroring Order.trackingTokenHash"
    - "submit-time snapshot column (planTier), mirroring OrderItem"
    - "derived counts over denormalized counters"
key-files:
  created:
    - "prisma/migrations/20260913195306_phase6_support_and_subscription_claims/migration.sql"
  modified:
    - "prisma/schema.prisma"
    - "src/server/auth/auth.ts"
    - "src/server/db/enums.ts"
    - "src/server/db/tenant-scoped.ts"
    - "tests/setup/seed-two-tenants.ts"
    - "tests/isolation/tenant-isolation.test.ts"
decisions:
  - "SUB-03 is a new SubscriptionPaymentClaim model, not a discriminated PaymentClaim"
  - "no SupportThread model — the thread IS the message set, every count derived at read time"
  - "referenceNormalized is globally @unique, not per-tenant"
  - "subscriptionCurrentPeriodEnd stored and displayed only; resolveEntitlements NOT taught to expire on it (KD-V2-02)"
  - "SupportAttachment carries kind/contentType/byteSize/nullable width-height from day one"
metrics:
  duration: "~55 min (incl. 25 min isolation suite)"
  tasks: 3
  files-changed: 7
  lines-added: 505
  lines-removed: 0
  completed: 2026-09-14
---

# Phase 6 Plan 03: Phase 6 Schema Surface Summary

The entire Phase 6 persistence layer — three tenant-scoped models, two enums, one `Organization` column — landed in a single migration applied to both the development and test Neon branches, together with all four files a new tenant-scoped model costs in this codebase, so no later plan in the phase needs a second migration.

## What Was Built

**Three models, two enums, one column** (`prisma/schema.prisma`):

- `SupportMessage` — the ADM-05 merchant↔platform thread. There is deliberately **no** `SupportThread` model: D-12 leaves a thread row no state to carry, so the thread IS `SupportMessage WHERE tenantId = X ORDER BY createdAt` and the admin inbox is a `groupBy(["tenantId"])`. The header comment carries the ALL-CAPS `DO NOT ADD A COUNTER COLUMN` line and cites `src/server/claims/queries.ts`'s derived-count doctrine.
- `SupportAttachment` — child of the above via a composite FK `(tenantId, messageId)`, mirroring `ProductImage`. Carries `kind`, `contentType`, `byteSize` and **nullable** `width`/`height` from day one so plan 06-13's PDF path (D-22) needs no second migration.
- `SubscriptionPaymentClaim` — SUB-03, the manual-claim pattern with payer and payee reversed. `referenceNormalized` is **globally** `@unique`, deliberately unlike `PaymentClaim`'s per-tenant key.
- `SupportAuthor` (`MERCHANT`/`PLATFORM`/`SYSTEM`) and `SupportAttachmentKind` (`IMAGE`/`DOCUMENT`), re-exported from `src/server/db/enums.ts` using the existing `ClaimStatus` idiom.
- `Organization.subscriptionCurrentPeriodEnd DateTime?`, declared `input: false` in the organization plugin's `additionalFields`.

**Registration + both fixtures**, in the same wave of commits as the schema — the RESEARCH Pitfall 4 failure mode is landing the schema and discovering the registry drift 25 minutes later, when the isolation suite finally reports it.

## Key Decisions

**`SubscriptionPaymentClaim` is a new model, not a discriminated `PaymentClaim`.** Extending the existing table would have cost three separate structural guarantees: `PaymentClaim.order` is a required composite FK and a subscription claim has no order (so `orderId` goes nullable, and a partially-required composite FK cannot use Prisma's default `SetNull`); the uniqueness scope differs and one table cannot carry both; and `src/server/claims/actions.ts` is the single sanctioned writer of a claim's `CONFIRMED` status, enforced by a source-scanning test — an admin-side confirm on that table would be exactly the second writer the ORD-02 control forbids.

**`referenceNormalized` is globally unique because the payee is one account.** A customer claim is paid to the *merchant*, so two customers of two different merchants may legitimately quote the same operator reference. A subscription claim is paid to the *one platform account*, so the same reference twice is the same payment twice. The obligation this creates is recorded in the schema comment rather than left to be discovered: a cross-tenant duplicate surfaces as `P2002`, which is an existence oracle, and must be refused with one generic message that never names or varies by the other tenant (T-06-11, plan 06-15 owns the handler).

**`subscriptionCurrentPeriodEnd` is stored and displayed only.** `resolveEntitlements` was deliberately **not** taught to expire on it. Doing so changes `canWrite` semantics for every gated action in the product — every catalog write, every order transition, every theme publish — and that is tracked as `KD-V2-02`, the milestone's largest hidden cost. The deferral is written into the schema comment so nothing in Phase 6 quietly starts reading the column inside an entitlement decision.

**Registry order is append-only.** `SupportMessage` before `SupportAttachment` (Postgres checks foreign keys immediately, so a child batched ahead of its parent aborts the whole fixture), `SubscriptionPaymentClaim` last (no FK parent). Nothing above the new entries moved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing every gitignored build input**

- **Found during:** Task 1 verification (`npx prisma validate`)
- **Issue:** The parallel-execution worktree is a fresh checkout, so `node_modules`, `.env.local`, `.env.test`, `src/generated/prisma`, `next-env.d.ts` and `.next/types` were all absent — every one of them gitignored and therefore not carried by the worktree. `prisma validate` failed on an unresolvable `DIRECT_URL`; `tsc` reported 15 errors for `PageProps`/`LayoutProps`/image-module declarations in files this plan never touched; and the isolation suite died on `Failed to load url /node_modules/server-only/empty.js`, because `vitest.config.ts` resolves that stub relative to the project root and the worktree root had no `node_modules` directory at all.
- **Fix:** Restored the gitignored inputs into the worktree only — copied `.env.local`/`.env.test`, ran `node scripts/prisma-generate.mjs`, copied `next-env.d.ts` and `.next/types`, and created `node_modules/server-only/` (Node's resolution walks up to the parent checkout for every other package, so a partial `node_modules` is safe). **No source or config file was changed** — in particular `vitest.config.ts` was left alone, since its path is correct for the real repository.
- **Files modified:** none tracked; all six artifacts are gitignored and verified so via `git check-ignore`.
- **Commit:** n/a (environment only)

**2. [Rule 1 - Bug] `migration_lock.toml` line-ending churn**

- **Found during:** Task 3, after `prisma migrate dev`
- **Issue:** The Prisma CLI rewrote `prisma/migrations/migration_lock.toml` with CRLF endings. Content was byte-identical to the committed version; only the EOLs differed, so it would have entered the merge as pure noise.
- **Fix:** `git checkout -- prisma/migrations/migration_lock.toml` (single named file). Confirmed identical content before restoring.
- **Commit:** n/a (reverted before staging)

### Acceptance criteria verified by substance rather than by their grep

Two of Task 2's acceptance criteria are greps written against a fixture style this file does not use, so they were satisfied in substance and verified at runtime instead. Both are recorded here rather than silently passed over:

| Criterion as written | Why the grep does not fit | How it was actually verified |
|---|---|---|
| `grep -c "SupportMessage\|SupportAttachment\|SubscriptionPaymentClaim" tests/setup/seed-two-tenants.ts` returns **≥ 6** | Returns **3**. `MODEL_FIXTURES` holds **one builder per model** that takes a `tenant` argument; the registry loop applies each to both tenants. Writing six literal entries would have meant abandoning the file's established architecture. | Queried the seeded test branch directly: **6 rows**, one per tenant per model (`tenant-a-fixed-id`, `tenant-b-fixed-id` on each of the three). |
| `grep -o 'referenceNormalized: "[^"]*"' … \| sort -u \| wc -l` returns **2** | Returns **0**. The value is derived — `normalizeReference(\`${tenant.slug}-sub-0001\`)` — matching the existing `PaymentClaim` builder exactly, not a quoted literal. Deriving is also what makes a collision structurally impossible rather than merely absent. | Queried the seeded rows: **2 distinct values**, `ALPHASTORESUB0001` and `BETASTORESUB0001`. The global `@unique` independently guarantees this — an equal pair would have aborted the seed transaction before any assertion ran, which it did not.|

No architectural changes were required, and no Rule 4 decision arose.

## Task 3 Recorded Observations

The plan asked for two values to be recorded here:

- **Migration directory created:** `prisma/migrations/20260913195306_phase6_support_and_subscription_claims/`
- **Isolation suite runtime:** **1502.53 s (25 m 03 s)** for `tenant-isolation.test.ts`, wall clock 19:55:46 → 20:20:51 UTC. That sits at the top of the 22–27 minute band STATE.md tracks, which is the expected result of adding three models to a suite whose cost is dominated by the per-test reseed (158 tests at ≈9.4 s each).

Test count moved from 128 to **158**, exactly +30 — ten auto-generated assertions for each of the three new models, with no per-model test body written by hand.

## Verification Results

| Gate | Result |
|---|---|
| `npx prisma validate` | pass |
| `npx prisma migrate status` (dev) | 6 migrations, "Database schema is up to date!" |
| `npx prisma migrate deploy` (test branch `ep-sweet-shape`) | applied |
| `npm run lint` (`--max-warnings=0`) | pass |
| `npm run typecheck` | pass, 0 errors |
| `npm run test:unit` | 40 files, 664 tests passed |
| `tests/isolation/model-registry-drift.test.ts` | 3 passed |
| `tests/isolation/tenant-isolation.test.ts` | **158 passed**, 0 failed |
| Named coverage of the three new models | re-run with `--reporter=verbose`: all 30 assertions pass, each naming `SupportMessage`, `SupportAttachment` or `SubscriptionPaymentClaim` |

Migration SQL contents confirmed: 3 `CREATE TABLE` (`support_message`, `support_attachment`, `subscription_payment_claim`), 2 `CREATE TYPE` (`SupportAuthor`, `SupportAttachmentKind`), and `ALTER TABLE "organization" ADD COLUMN "subscriptionCurrentPeriodEnd" TIMESTAMP(3)`.

Forbidden-column check clean: no `lastMessageAt`, `unreadCount`, `pendingClaimCount`, `domainStatus` or `notificationEmail` appears on any non-comment line of the schema. `SubscriptionPaymentClaim` carries `referenceNormalized String @unique` and **no** `@@unique([tenantId, referenceNormalized])` — the only composite occurrence in the file remains `PaymentClaim`'s.

The migration was additive throughout: no data-loss prompt was raised, and `--accept-data-loss` was never used. All three commits are insert-only (505 insertions, 0 deletions across 7 files).

## Threat Model Coverage

| Threat ID | Disposition | Status |
|---|---|---|
| T-06-09 | mitigate | `subscriptionCurrentPeriodEnd` declared `input: false`; verified present in the `additionalFields` block alongside the existing four-step rationale |
| T-06-10 | mitigate | both support models registered in `TENANT_SCOPED_MODELS`; 20 auto-generated cross-tenant assertions pass |
| T-06-11 | mitigate | global uniqueness deliberate; the generic-refusal obligation is written into the schema comment so plan 06-15's handler is not authored casually |
| T-06-12 | mitigate | appended in FK dependency order, never re-sorted; drift test and the seed's throw-by-name guard both green |
| T-06-13 | accept | unchanged — no `AdminAuditEvent` model introduced |
| T-06-SC | mitigate | **zero packages installed** |

## Known Stubs

None. This plan is pure persistence layer — it ships no UI surface and no hardcoded placeholder values.

## Threat Flags

None. Every model added here was already in the plan's `<threat_model>`; no new network endpoint, auth path, file-access pattern or trust-boundary schema change was introduced beyond it.

## Notes for Future Plans

- `SupportMessage.body` may be empty **only** when the message carries an attachment. That rule is not expressible as a single-column `NOT NULL`, so it must be enforced in the action's Zod schema — plans 06-11/06-13 own it.
- `SupportAttachment.storageKey` means different things per `kind`: a derivative **prefix** for `IMAGE`, the stored object key for `DOCUMENT`. Read `kind` before touching the key; it cannot be inferred from the key alone.
- `SupportMessage.subscriptionClaimId` is deliberately **not** a relation, so Prisma will not join it for you — a claim can be reviewed from the admin ledger with no message in scope.
- `SubscriptionPaymentClaim.coversThrough` and `Organization.subscriptionCurrentPeriodEnd` must be written by the **same** confirm operation; the claim keeps the per-payment history the organization column (holding only the latest value) cannot reconstruct.

## Self-Check: PASSED

Files claimed created/modified, all confirmed present on disk:

- `prisma/migrations/20260913195306_phase6_support_and_subscription_claims/migration.sql` — FOUND
- `prisma/schema.prisma`, `src/server/auth/auth.ts`, `src/server/db/enums.ts`, `src/server/db/tenant-scoped.ts`, `tests/setup/seed-two-tenants.ts`, `tests/isolation/tenant-isolation.test.ts` — FOUND

Commits claimed, all confirmed in `git log`:

- `2bc7386` feat(06-03): add Phase 6 support-thread and subscription-claim schema — FOUND
- `1b36414` feat(06-03): register the Phase 6 models and extend both isolation fixtures — FOUND
- `a584d2b` feat(06-03): apply the Phase 6 schema migration to dev and the test branch — FOUND

Per the parallel-execution dispatch, `STATE.md` and `ROADMAP.md` were deliberately **not** modified; the orchestrator owns those writes after the wave merges.
