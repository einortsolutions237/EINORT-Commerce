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
  - "StorefrontTheme.draftTemplateKey / .publishedTemplateKey schema split (Task 1, done)"
  - "Hand-edited RENAME COLUMN migration file, NOT yet applied to any database (Task 2, blocked on human checkpoint)"
affects: [05-01, 05-03 through 05-22 (any plan reading/writing templateKey), theming/queries, storefront-editor, onboarding template picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-edited Prisma migration SQL (RENAME COLUMN, never DROP+ADD) for a rename on a live table, matching house style already used in prisma/migrations/20260902141926_storefront_theme_page_industry"

key-files:
  created:
    - prisma/migrations/20260904113106_template_draft_published/migration.sql
  modified:
    - prisma/schema.prisma

key-decisions:
  - "D-13 implemented via hand-written RENAME COLUMN + ADD COLUMN + UPDATE (zero DROP COLUMN) instead of trusting Prisma's default diff, which would drop `templateKey` and re-add `publishedTemplateKey` with a default, silently resetting every existing merchant to flagship-fashion (confirmed by Prisma's own dry-run warning during this task: 'You are about to drop the column `templateKey` on the `storefront_theme` table, which still contains 2 non-null values')."
  - "Migration folder/file created by hand rather than via `npx prisma migrate dev --create-only`, because that command hard-refuses in this non-interactive shell ('Prisma Migrate has detected that the environment is non-interactive, which is not supported') even with `--create-only` and `CI=true`. The final migration.sql content is byte-for-byte what the plan's <action> specifies; only the scaffolding mechanism differs. Documented as a deviation below."

requirements-completed: []  # TMPL-04 NOT complete — Task 2 (apply migration) and Task 3 (read-path updates + test) are still pending.

# Metrics
duration: ~25min (Task 1 only; Tasks 2-3 not started)
completed: IN PROGRESS - stopped at Task 2 checkpoint
---

# Phase 05 Plan 02: Split StorefrontTheme.templateKey into draft/published columns (Task 1 of 3 complete)

**Task 1 done and committed: `StorefrontTheme.publishedTemplateKey`/`.draftTemplateKey` schema split plus a hand-written `RENAME COLUMN` migration with zero `DROP COLUMN` statements — not yet applied to any database. Task 2 (the blocking human-verify checkpoint that applies this migration to both the dev and test Neon branches) has NOT been run. Task 3 (read-path updates + migration-safety test) has NOT been started.**

## Performance

- **Tasks:** 1 of 3 completed
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments

- `prisma/schema.prisma`: `StorefrontTheme.templateKey` split into `draftTemplateKey` (new, listed first) and `publishedTemplateKey` (renamed from `templateKey`), both `String @default("flagship-fashion")`. The original doc comment (the "key into `TEMPLATES`, never a foreign key" paragraph and the "DELIBERATELY SEPARATE FROM `Organization.industry` (D-03)" paragraph) is preserved verbatim on `draftTemplateKey`; a new paragraph explaining the draft/published rationale (D-13) was added, plus a short cross-reference comment on `publishedTemplateKey`. The `Organization.industry` field's own comment, which referenced the old `StorefrontTheme.templateKey` name, was updated to reference the two new field names (Rule 1 — stale doc-comment bug, same file, directly adjacent to the plan's scope).
- `prisma/migrations/20260904113106_template_draft_published/migration.sql`: hand-written 3-statement body exactly as specified — `RENAME COLUMN "templateKey" TO "publishedTemplateKey"`, `ADD COLUMN "draftTemplateKey" TEXT NOT NULL DEFAULT 'flagship-fashion'`, `UPDATE "storefront_theme" SET "draftTemplateKey" = "publishedTemplateKey"`. Zero `DROP COLUMN` statements anywhere in the file (including the explanatory header comment — the plan's own automated verify greps for the literal absence of that string, so the comment was worded to avoid it while still explaining the trap).
- All Task 1 acceptance-criteria greps verified directly:
  - `draftTemplateKey`/`publishedTemplateKey` both present on `StorefrontTheme`, each `String @default("flagship-fashion")`.
  - `grep -c 'templateKey String' prisma/schema.prisma` → 0 (bare field name gone).
  - Migration SQL contains `RENAME COLUMN "templateKey" TO "publishedTemplateKey"`.
  - Migration SQL contains no `DROP COLUMN`.
  - Migration SQL contains `UPDATE "storefront_theme" SET "draftTemplateKey" = "publishedTemplateKey"`.
  - `grep -c 'DELIBERATELY SEPARATE FROM' prisma/schema.prisma` → 1.
- Worktree environment restored from the main checkout as instructed: `node_modules` (real copy via `robocopy /E`, not a junction — Turbopack has repeatedly failed on junctioned `node_modules` this session), `src/generated/prisma`, `.env.local`, `.env.test`.

## Task Commits

1. **Task 1: Split templateKey into draftTemplateKey / publishedTemplateKey and hand-write the rename migration** - `e8af527` (feat)

Task 2 and Task 3 are NOT committed — not started (Task 2) / blocked behind Task 2 (Task 3).

## Files Created/Modified

- `prisma/schema.prisma` - `StorefrontTheme.templateKey` split into `draftTemplateKey`/`publishedTemplateKey`; `Organization.industry`'s comment updated to match.
- `prisma/migrations/20260904113106_template_draft_published/migration.sql` - hand-written `RENAME COLUMN` + `ADD COLUMN` + `UPDATE`, no `DROP COLUMN`.

## Decisions Made

- Kept the migration folder timestamp format consistent with existing migrations (`YYYYMMDDHHMMSS_name`, UTC), generated as `20260904113106_template_draft_published` since the timestamp had to be produced by hand (see Deviations below) rather than by the CLI.
- Extended the doc-comment fix to the one other file location (`Organization.industry`'s comment, ~30 lines above `StorefrontTheme`) that named the old `templateKey` field directly, so no stale reference to a renamed field survives in the same file. This is the only place outside the `StorefrontTheme` model itself that named `templateKey`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npx prisma migrate dev --name template_draft_published --create-only` cannot run in this non-interactive shell; migration folder/file created by hand instead**
- **Found during:** Task 1
- **Issue:** The plan's `<action>` specifies generating the migration via `npx prisma migrate dev --name template_draft_published --create-only`. Run as specified, Prisma printed its dry-run diff warning (confirming the exact Pitfall 1 trap: *"You are about to drop the column `templateKey` on the `storefront_theme` table, which still contains 2 non-null values"*) and then hard-refused with *"Prisma Migrate has detected that the environment is non-interactive, which is not supported."* This reproduced identically with `CI=true` set. `prisma migrate diff --from-migrations ./prisma/migrations --to-schema prisma/schema.prisma --script` (the documented non-interactive alternative) also failed, requiring `datasource.shadowDatabaseUrl` to be set in `prisma.config.ts` — a config change out of this task's scope and not requested by the plan.
- **Fix:** Created the migration folder (`prisma/migrations/20260904113106_template_draft_published/`, timestamp format matching existing migrations) and `migration.sql` by hand, with content identical to what the plan's `<action>` specifies the CLI-generated file should be hand-edited into: the same 3-statement `RENAME COLUMN` + `ADD COLUMN` + `UPDATE` body, zero `DROP COLUMN` statements. No database was touched by this fix — it is purely local file scaffolding.
- **Files modified:** `prisma/migrations/20260904113106_template_draft_published/migration.sql` (new file)
- **Verification:** The plan's own automated verify command for Task 1 passed: `grep -l "RENAME COLUMN" ... && ! grep -q "DROP COLUMN" ... && echo MIGRATION_SHAPE_OK` → printed `MIGRATION_SHAPE_OK`. All six Task 1 acceptance criteria greps verified individually (see Accomplishments above).
- **Committed in:** `e8af527` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed stale `templateKey` reference in `Organization.industry`'s doc comment**
- **Found during:** Task 1
- **Issue:** `Organization.industry`'s doc comment (lines ~159-160, same file, unrelated model) said *"DELIBERATELY NOT the same thing as `StorefrontTheme.templateKey` (D-03)"* — a field name that no longer exists after this task's rename, which would mislead the next reader.
- **Fix:** Updated the comment to reference `StorefrontTheme.draftTemplateKey` / `.publishedTemplateKey` instead, keeping the same D-03 rationale.
- **Files modified:** `prisma/schema.prisma`
- **Verification:** Re-read the updated comment; no remaining bare `templateKey` reference anywhere in the file (`grep -c 'templateKey String'` → 0; the only remaining occurrences of the substring `templateKey` are as part of `draftTemplateKey`/`publishedTemplateKey`).
- **Committed in:** `e8af527` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/tooling, 1 doc-comment bug)
**Impact on plan:** Both auto-fixes were necessary to complete Task 1 correctly and left the migration's actual DDL content unchanged from what the plan specifies. No scope creep, no database touched.

## Issues Encountered

None beyond the CLI non-interactivity issue documented above as a deviation.

## CHECKPOINT: Task 2 is a pending, blocking human-verify checkpoint — NOT executed

Per this plan's frontmatter (`autonomous: false`) and explicit run instructions, Task 2 was intentionally **not** run. No `prisma migrate dev`, `prisma migrate deploy`, or `prisma generate` was invoked against any real database (dev or `TEST_DATABASE_URL`) by this session. The migration file from Task 1 sits on disk, unapplied.

Quoted verbatim from `05-02-PLAN.md`, Task 2:

> **Task 2: [BLOCKING] Apply the schema push and regenerate the Prisma client**
>
> **what-built:** The hand-edited `RENAME COLUMN` migration from Task 1, ready to apply. Build and typecheck will pass WITHOUT this push because Prisma types come from the generated client, not the live database — so skipping it produces a false-positive verification state for the whole phase.
>
> **action:**
> Apply the migration and regenerate the client:
> - `npx prisma migrate dev` (applies the pending hand-edited migration to the development branch; do NOT pass `--create-only` here, and do NOT let the tool re-diff and regenerate the SQL — if it offers to reset the database, STOP and report rather than accepting).
> - `npx prisma generate` (or `npm install`, which runs the `postinstall` hook) to refresh `src/generated/prisma/**`.
> - Apply the same migration to the dedicated Neon test branch with `TEST_DATABASE_URL` in the shell so `prisma.config.ts` overrides `DIRECT_URL`: `npx prisma migrate deploy`.
> - Re-run `npm run typecheck` — it fails loudly until the client is regenerated, which is the signal that the push actually happened.
>
> Record in the summary: the applied migration directory name, the output of `npx prisma migrate status`, and confirmation that the dev branch and the test branch are both at the same migration.
>
> **how-to-verify:**
> 1. Run `npx prisma migrate status` — it must report no pending migrations and name `<timestamp>_template_draft_published` as applied.
> 2. Run `npm run typecheck` — it must exit 0, proving the regenerated client carries `draftTemplateKey`/`publishedTemplateKey`.
> 3. Confirm the migration was applied as written: the SQL file on disk still contains `RENAME COLUMN` and no `DROP COLUMN`.
> 4. Confirm no existing merchant row was reset: report the row count of `storefront_theme` and confirm every row's `draftTemplateKey` equals its `publishedTemplateKey`.
>
> **resume-signal:** Type "approved" once `prisma migrate status` is clean on both branches and typecheck is green, or describe what went wrong.
>
> **done:** The rename migration is applied to both the development branch and the Neon test branch, the Prisma client is regenerated, and typecheck is green.

**Applicable migration directory:** `prisma/migrations/20260904113106_template_draft_published/` (note: this timestamp/name differs from what `npx prisma migrate dev --create-only` would have produced on its own clock, since it was hand-created — see Deviation 1 above. Its SQL content matches the plan's `<action>` specification exactly.)

**Note for whoever runs Task 2:** the Prisma dry-run during Task 1 reported the `storefront_theme` table currently holds **2 non-null values** in `templateKey` on the dev branch — i.e., 2 real tenant rows exist and would be the ones at risk of a silent reset if this were ever applied via the default (non-hand-edited) diff. This is exactly the scenario D-13 and Pitfall 1 warn about; it is not hypothetical in this environment.

**Task 3 (read-path updates + migration-safety test) is also not started** — it depends on Task 2's applied migration and regenerated client to typecheck, per the plan's own dependency note in Task 2's `what-built`.

## User Setup Required

None — no external service configuration required. Task 2 requires database access this session does not have permission to exercise (per explicit run instructions), not new credentials.

## Next Phase Readiness

- Task 1's schema and migration file are ready for Task 2 to apply as-is; no further edits to `prisma/schema.prisma` or the migration SQL should be needed before running Task 2.
- Once Task 2 is approved and Task 3 completes, this plan (05-02) will be the schema/read-path foundation that plans 05-04 onward (switchTemplate, onboarding picker, editor "Change template" action) depend on for `draftTemplateKey`/`publishedTemplateKey`.
- **Blocker:** this plan is not done. `.planning/STATE.md` and `.planning/ROADMAP.md` were deliberately left untouched by this session per explicit run instructions — do not treat 05-02 as complete in either file until Tasks 2 and 3 finish and their own SUMMARY content is appended/revised.

---
*Phase: 05-template-segment-expansion*
*Status: IN PROGRESS — Task 1/3 complete, Task 2 blocking checkpoint pending*

## Self-Check: PASSED

- FOUND: `prisma/schema.prisma`
- FOUND: `prisma/migrations/20260904113106_template_draft_published/migration.sql`
- FOUND: `.planning/phases/05-template-segment-expansion/05-02-SUMMARY.md`
- FOUND: commit `e8af527` in `git log --oneline --all`
