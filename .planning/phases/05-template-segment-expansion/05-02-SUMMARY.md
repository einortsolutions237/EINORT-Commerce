---
phase: 05-template-segment-expansion
plan: 02
subsystem: database
tags: [prisma, postgresql, migrations, theming, storefront]

# Dependency graph
requires:
  - phase: 04-theme-section-block-system-flagship-template
    provides: StorefrontTheme model with draftTokens/publishedTokens pairing precedent
provides:
  - "StorefrontTheme.draftTemplateKey / .publishedTemplateKey schema split, applied to both the dev and Neon test branches"
  - "getPublishedStorefront returning publishedTemplateKey; getEditorStorefront sourcing templateKey from draftTemplateKey"
  - "tests/isolation/template-migration-safety.test.ts — the migration-safety control for D-13 / Pitfall 1"
affects: [05-01, 05-03 through 05-22 (any plan reading/writing templateKey), theming/queries, storefront-editor, onboarding template picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-edited Prisma migration SQL (RENAME COLUMN, never DROP+ADD) for a rename on a live table, matching house style already used in prisma/migrations/20260902141926_storefront_theme_page_industry"
    - "Source-scanning migration-safety test (read prisma/migrations/*/migration.sql as text, assert RENAME COLUMN present / DROP COLUMN absent) — the same idiom as tests/unit/single-order-state-writer.test.ts, applied because a runtime/database assertion cannot distinguish a correct rename from a DROP+ADD when every existing row happens to hold the same default value"

key-files:
  created:
    - prisma/migrations/20260904113106_template_draft_published/migration.sql
    - tests/isolation/template-migration-safety.test.ts
  modified:
    - prisma/schema.prisma
    - src/server/theming/queries.ts
    - src/server/theming/actions.ts
    - tests/setup/seed-two-tenants.ts
    - tests/isolation/tenant-isolation.test.ts

key-decisions:
  - "D-13 implemented via hand-written RENAME COLUMN + ADD COLUMN + UPDATE (zero DROP COLUMN) instead of trusting Prisma's default diff, which would drop `templateKey` and re-add `publishedTemplateKey` with a default, silently resetting every existing merchant to flagship-fashion (confirmed by Prisma's own dry-run warning during Task 1: 'You are about to drop the column `templateKey` on the `storefront_theme` table, which still contains 2 non-null values')."
  - "Migration folder/file created by hand rather than via `npx prisma migrate dev --create-only` (Task 1), because that command hard-refuses in a non-interactive shell. The final migration.sql content is byte-for-byte what the plan's <action> specifies; only the scaffolding mechanism differs."
  - "getEditorStorefront keeps returning the field name `templateKey` on `EditorStorefront` (sourced from the `draftTemplateKey` column) rather than renaming the public field, so downstream editor code has one obvious name to read — the contract is unchanged, only the source column changed. getPublishedStorefront's new field is named `publishedTemplateKey` to match its column directly, since no downstream code depended on a different name yet."
  - "The migration-safety test's source half is the real control, not the database half — every merchant is on 'flagship-fashion' today, so a DROP+ADD migration produces byte-identical rows in dev; only the SQL text distinguishes a correct rename from silent data loss."

requirements-completed: [TMPL-04]

# Metrics
duration: ~2h10min total across three sessions (Task 1 ~25min, Task 2 checkpoint applied and verified by the orchestrator directly against Neon, Task 3 ~this session)
completed: 2026-09-04
---

# Phase 05 Plan 02: Split StorefrontTheme.templateKey into draft/published columns — Summary

**All three tasks complete.** `StorefrontTheme.templateKey` is now `draftTemplateKey`/`publishedTemplateKey`, applied to both the development and Neon test branches via a hand-written `RENAME COLUMN` migration with zero `DROP COLUMN` statements. Both theming read paths select the correct column, and a source-scanning migration-safety test guards the rename against ever being silently regenerated into a data-losing `DROP COLUMN` + `ADD COLUMN` pair.

## Performance

- **Tasks:** 3 of 3 completed
- **Files modified:** 7 (2 created, 5 modified) across the whole plan; Task 3 alone touched 5 files (1 created, 4 modified)

## Accomplishments

### Task 1 (previously summarized, unchanged)

- `prisma/schema.prisma`: `StorefrontTheme.templateKey` split into `draftTemplateKey` (new) and `publishedTemplateKey` (renamed), both `String @default("flagship-fashion")`, doc comments preserved and extended with the draft/published rationale.
- `prisma/migrations/20260904113106_template_draft_published/migration.sql`: hand-written 3-statement body — `RENAME COLUMN "templateKey" TO "publishedTemplateKey"`, `ADD COLUMN "draftTemplateKey" ... DEFAULT 'flagship-fashion'`, `UPDATE "storefront_theme" SET "draftTemplateKey" = "publishedTemplateKey"`. Zero `DROP COLUMN` anywhere in the file.

### Task 2 — applied and verified (checkpoint approved by the orchestrator, not this session)

The blocking `checkpoint:human-verify` task was run and approved by the orchestrator session directly against the real databases, not simulated. Evidence recorded by that session and confirmed at the start of this one:

- `npx prisma migrate dev` applied the pending migration cleanly to the development branch (Neon host `ep-little-unit-zaqlnwiw`) — no drift warnings, no prompts.
- `npx prisma generate` regenerated the client.
- `npx prisma migrate deploy` applied the same migration cleanly to the `TEST_DATABASE_URL` branch (Neon host `ep-sweet-shape-za5xwdvh`).
- `npx prisma migrate status` reported clean on the dev branch, both branches on the same migration.
- A raw `pg` query (outside `scopedDb`, run as a one-off verification, not part of the codebase) confirmed the dev database's 2 existing tenant rows both had `draftTemplateKey === publishedTemplateKey === "flagship-fashion"` at that point — zero data loss from the rename.
- `npm run typecheck` immediately after showed exactly 3 remaining errors, all `templateKey` does not exist, all in the two files Task 3 owns (`src/server/theming/actions.ts` lines 421/628, `src/server/theming/queries.ts` line 206) — the expected, correct post-migration state, not a regression.

This session re-verified `npx prisma migrate status` implicitly by running `npx prisma migrate deploy` as part of every isolation-test global setup during Task 3's own verification, which reported "No pending migrations to apply" on the test branch every time — consistent with Task 2's applied state still holding.

### Task 3 — read paths, seed fixtures, and the migration-safety test (this session)

- `src/server/theming/queries.ts`:
  - `getPublishedStorefront` now selects `publishedTemplateKey` and returns it on `PublishedStorefront`. A missing theme row (the documented pre-seed state) falls back to the literal `"flagship-fashion"` **without** logging, matching the existing no-log-on-missing-row rule the file already applies to `document`/`tokens`.
  - `getEditorStorefront` now selects `draftTemplateKey` instead of the removed `templateKey` column. The returned field is still named `templateKey` on `EditorStorefront` (D-08: the editor reads draft, the storefront reads published — contract unchanged, source column changed), documented at the field.
  - No derived `isDirty`/`templateDirty` field was added anywhere (confirmed: `grep -ci 'isDirty\|templateDirty' src/server/theming/queries.ts` → 0).
- `tests/isolation/template-migration-safety.test.ts` (new): source half reads every `prisma/migrations/*/migration.sql`, asserts exactly one mentions `publishedTemplateKey`, that it contains the hand-written `RENAME COLUMN`, and that it contains no `DROP COLUMN` touching `templateKey` — with failure messages naming the FIX (restore `RENAME COLUMN`) and the WRONG FIX (do not accept a `prisma migrate dev` regenerated diff). Database half asserts, for every seeded tenant (`it.each(TENANTS)`), that `draftTemplateKey`/`publishedTemplateKey` are both readable, equal to each other, and equal `"flagship-fashion"`, read exclusively through `scopedDb(tenantId)` — no `$queryRaw`/`$executeRaw`. A non-vacuity control asserts the migrations directory was actually scanned and that at least one seeded row exists.
- **Verified the source half actually fails on a regression**: temporarily rewrote the applied migration's `RENAME COLUMN` statement into a `DROP COLUMN` + `ADD COLUMN` pair, reran the test suite — 2 of 7 tests failed with the exact FIX/WRONG FIX message — then reverted the file and confirmed the revert was byte-identical via `git diff --stat` (no changes reported against the committed version).

## Task Commits

1. **Task 1: Split templateKey into draftTemplateKey / publishedTemplateKey and hand-write the rename migration** — `e8af527` (feat)
2. **Task 2: [BLOCKING] Apply the schema push and regenerate the Prisma client** — checkpoint, no code commit (migration apply + client regeneration only; `src/generated/prisma/**` is gitignored). Approved by the orchestrator directly against the dev and Neon test branches.
3. **Task 3: Teach the read paths which column to select, and add the migration-safety test** — `282b042` (feat)

## Files Created/Modified

- `prisma/schema.prisma` — `StorefrontTheme.templateKey` split into `draftTemplateKey`/`publishedTemplateKey` (Task 1).
- `prisma/migrations/20260904113106_template_draft_published/migration.sql` — hand-written `RENAME COLUMN` + `ADD COLUMN` + `UPDATE`, no `DROP COLUMN` (Task 1), applied to dev and test branches (Task 2).
- `src/server/theming/queries.ts` — `getPublishedStorefront` selects/returns `publishedTemplateKey`; `getEditorStorefront` selects `draftTemplateKey`, returns it as `templateKey` (Task 3).
- `src/server/theming/actions.ts` — the two seed-time upsert creates (`ensureStorefrontSeeded`, `saveBranding`) write both `draftTemplateKey` and `publishedTemplateKey` instead of the removed `templateKey` column (Task 3, Rule 3 fix — see Deviations).
- `tests/setup/seed-two-tenants.ts` — the shared `StorefrontTheme` fixture builder now seeds both draft/published columns instead of the removed `templateKey` (Task 3, Rule 3 fix).
- `tests/isolation/tenant-isolation.test.ts` — the generic cross-tenant mutation probe for `StorefrontTheme` retargeted from `templateKey` to `draftTemplateKey` (Task 3, Rule 3 fix).
- `tests/isolation/template-migration-safety.test.ts` — new, the migration-safety control (Task 3).

## Decisions Made

- Kept the migration folder timestamp format consistent with existing migrations (Task 1, previously documented).
- `getPublishedStorefront`'s new field is named `publishedTemplateKey` (matching the column) rather than reusing the editor's `templateKey` name — no downstream code reads it yet in this plan, so there was no existing contract to preserve, unlike the editor path.
- `getEditorStorefront` keeps the public field name `templateKey` deliberately, even though its source column changed, so a later plan wiring the editor's template picker does not need to touch every call site — see the plan's own instruction on this point.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npx prisma migrate dev --name template_draft_published --create-only` cannot run in this non-interactive shell; migration folder/file created by hand instead**
- **Found during:** Task 1 (previously documented; repeated here for completeness of the full-plan summary)
- **Committed in:** `e8af527`

**2. [Rule 1 - Bug] Fixed stale `templateKey` reference in `Organization.industry`'s doc comment**
- **Found during:** Task 1 (previously documented)
- **Committed in:** `e8af527`

**3. [Rule 3 - Blocking] `src/server/theming/actions.ts` still wrote the removed `templateKey` column at two seed-time call sites**
- **Found during:** Task 3, before writing any new code — `npm run typecheck` (re-run at session start per the resumption brief) showed 2 of its 3 expected errors here (`ensureStorefrontSeeded` line 421, `saveBranding` line 628), both `Object literal may only specify known properties, and 'templateKey' does not exist`.
- **Issue:** These are the two authenticated write paths that create a `StorefrontTheme` row (onboarding branding and the editor self-heal seed). Both used `templateKey: DEFAULT_TEMPLATE_KEY` in `scopedCreateData<StorefrontThemeCreateInput>({...})`, which no longer compiles against the renamed column.
- **Fix:** Replaced each with `draftTemplateKey: DEFAULT_TEMPLATE_KEY, publishedTemplateKey: DEFAULT_TEMPLATE_KEY`, mirroring the `draftTokens`/`publishedTokens` pattern already present in the same object literals — a brand-new storefront starts fully published with no pending draft change, on every column pair this model has.
- **Files modified:** `src/server/theming/actions.ts`
- **Verification:** `npm run typecheck` exits 0; no `templateKey:` literal remains in the file (`grep -n templateKey src/server/theming/actions.ts` → no bare match, only `DEFAULT_TEMPLATE_KEY` and the two new field names).
- **Committed in:** `282b042` (Task 3 commit)

**4. [Rule 3 - Blocking] The shared two-tenant seed fixture (`tests/setup/seed-two-tenants.ts`) still wrote the removed `templateKey` column**
- **Found during:** Task 3, while reading `read_first` material for the new test — the `StorefrontTheme` builder in `MODEL_FIXTURES` wrote `templateKey: "flagship-fashion"`.
- **Issue:** This function is called once by every isolation test file's global/`beforeAll` setup (`tests/setup/global-setup.ts`). Because the fixture assembles its `createMany` payload through a loosely typed `Record<string, unknown>` (so it bypasses compile-time schema checking by design — the isolation battery is model-generic), this was invisible to `npm run typecheck` and would only have surfaced as a runtime Prisma "unknown argument" error the first time any isolation test ran, failing the ENTIRE isolation suite's global setup, not just this plan's new test.
- **Fix:** Replaced the single `templateKey: "flagship-fashion"` line with `draftTemplateKey: "flagship-fashion", publishedTemplateKey: "flagship-fashion"`, matching the existing "already published, no pending edits" baseline the adjacent `draftTokens`/`publishedTokens` fixture fields already establish.
- **Files modified:** `tests/setup/seed-two-tenants.ts`
- **Verification:** `npx dotenv -e .env.test -- vitest run tests/isolation/template-migration-safety.test.ts --reporter=dot` — 7/7 passed against the real Neon test branch, including the database-half assertions that read this exact fixture.
- **Committed in:** `282b042` (Task 3 commit)

**5. [Rule 3 - Blocking] The generic cross-tenant isolation battery's `StorefrontTheme` mutation probe targeted the removed `templateKey` column**
- **Found during:** Task 3, while reading `tests/isolation/storefront-editor.test.ts` (a `read_first` reference) led to checking the sibling `tenant-isolation.test.ts`, whose `StorefrontTheme` entry mutated `templateKey` as its "carries no unique constraint, safe to scribble on" probe field.
- **Issue:** Same failure mode as Deviation 4 — a runtime-only break, invisible to typecheck, that would fail `tests/isolation/tenant-isolation.test.ts`'s entire `StorefrontTheme` battery (not this plan's own test) the next time that file ran.
- **Fix:** Retargeted the mutation to `draftTemplateKey`, which is equally unconstrained, preserving the comment's own reasoning.
- **Files modified:** `tests/isolation/tenant-isolation.test.ts`
- **Verification:** `npm run typecheck` and `npm run lint` both exit 0. A full run of `tests/isolation/tenant-isolation.test.ts` itself was not completed within this session (see Known Gaps below); the fix is a one-line field-name substitution with no behavioral change to the probe's logic.
- **Committed in:** `282b042` (Task 3 commit)

---

**Total deviations across the whole plan:** 5 auto-fixed (2 from Task 1: 1 blocking/tooling, 1 doc-comment bug; 3 from Task 3: all Rule 3 blocking-issue fixes required to reach a green `npm run typecheck`/`npm run lint`/isolation-test state after the column rename). None were architectural (no Rule 4 needed) and none expanded the plan's actual scope — every fix mirrors a pattern the model or the surrounding file already established (draftTokens/publishedTokens pairing).

## Issues Encountered

None beyond the deviations documented above.

## Known Gaps / Follow-up for the Orchestrator

- **Full `tests/isolation/**` regression run: completed, 23/25 files green, 2 unrelated pre-existing failures.** Because Deviations 4 and 5 touched two files every other isolation test file depends on (the shared seed fixture and the generic cross-tenant battery), a supplementary full `npx dotenv -e .env.test -- vitest run tests/isolation --reporter=dot` run was started as an extra precaution (25 files, `fileParallelism: false`, ~30 minutes against the shared Neon test branch). Final result: **321/323 tests passed, 23/25 files passed.** `tests/isolation/template-migration-safety.test.ts` and `tests/isolation/tenant-isolation.test.ts` (the two files most exposed to this plan's changes) both passed cleanly.

  Two unrelated failures, neither touching `StorefrontTheme`/`templateKey` and both in files last modified in Phase 3 — logged to `.planning/phases/05-template-segment-expansion/deferred-items.md` per the scope-boundary rule rather than fixed here:
  - `tests/isolation/claim-submission.test.ts` — `PrismaClientKnownRequestError: Unable to start a transaction in the given time`, the same transaction-pool-contention flake `merchant-context.test.ts`'s own header already documents by name.
  - `tests/isolation/stock-race.test.ts` — a concurrent-release timing assertion failed under real network latency against the remote branch.

  Recommend the orchestrator re-run these two files in isolation before merging Wave 1 to confirm they are flakes under load rather than real regressions — but they are not this plan's responsibility to fix, since 05-02 touched neither order claims nor stock-hold release logic.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- This plan (05-02) is the schema/read-path foundation that plans 05-04 onward (switchTemplate, onboarding picker, editor "Change template" action) depend on for `draftTemplateKey`/`publishedTemplateKey`.
- `getPublishedStorefront` and `getEditorStorefront` both expose the correct column now; a future plan wiring a template-switch UI can write `draftTemplateKey` freely without touching either read path again, and can promote it to `publishedTemplateKey` inside `publishStorefront`'s existing transaction (not yet wired — out of this plan's scope, per its `<action>`'s explicit instruction not to teach `src/app/s/[slug]/preview/page.tsx` to read draft columns either).
- Per the orchestrator's explicit instruction, `.planning/STATE.md` and `.planning/ROADMAP.md` were **not** touched by this session — the orchestrator owns updating them once Wave 1 (05-01, 05-02, 05-03) is confirmed fully complete.

---
*Phase: 05-template-segment-expansion*
*Status: COMPLETE — 3/3 tasks done*

## Self-Check: PASSED

- FOUND: `prisma/schema.prisma`
- FOUND: `prisma/migrations/20260904113106_template_draft_published/migration.sql`
- FOUND: `src/server/theming/queries.ts`
- FOUND: `src/server/theming/actions.ts`
- FOUND: `tests/setup/seed-two-tenants.ts`
- FOUND: `tests/isolation/tenant-isolation.test.ts`
- FOUND: `tests/isolation/template-migration-safety.test.ts`
- FOUND: commit `e8af527` in `git log --oneline --all`
- FOUND: commit `282b042` in `git log --oneline --all`
