import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { scopedDb } from "@/server/db/tenant-scoped";

import { seedTwoTenants, TENANTS } from "../setup/seed-two-tenants";

/**
 * The migration-safety control for D-13 / Pitfall 1 (plan 05-02 Task 3).
 *
 * ---------------------------------------------------------------------------
 * WHY A RUNTIME ASSERTION CANNOT SUBSTITUTE FOR THE SOURCE HALF BELOW.
 * ---------------------------------------------------------------------------
 * `05-RESEARCH.md` Pitfall 1: Prisma's schema diff has no rename primitive, so
 * asking it to reconcile `templateKey` -> `publishedTemplateKey` produces a
 * `DROP COLUMN "templateKey"` followed by
 * `ADD COLUMN "publishedTemplateKey" TEXT NOT NULL DEFAULT 'flagship-fashion'`
 * — which silently resets every merchant's template choice to the flagship
 * default. Every merchant in this codebase is on `"flagship-fashion"` today
 * (TMPL-01, D-03's starting state), so that reset is BYTE-IDENTICAL to a
 * correct migration in dev: a "database half" test that seeds a tenant and
 * asserts `publishedTemplateKey === "flagship-fashion"` would pass whether the
 * migration renamed the column or destroyed and recreated it. The data loss
 * only becomes visible after real merchants start picking non-default
 * templates in production, at which point it is unrecoverable — the dropped
 * column's real values are gone before `ADD COLUMN` ever runs.
 *
 * The only place this distinction is still visible is the migration SQL
 * itself, before it reaches a database. That is why the first half of this
 * file is a source scan, not a database probe — the same idiom
 * `tests/unit/single-order-state-writer.test.ts` uses for the same reason: a
 * behavioural test cannot fail the way a regenerated migration fails, because
 * the regenerated migration would leave the observable behaviour unchanged.
 *
 * ---------------------------------------------------------------------------
 * HOW TO READ A FAILURE HERE.
 * ---------------------------------------------------------------------------
 * A failure in the "source" describe block means the hand-edited
 * `RENAME COLUMN` migration was edited, regenerated, or replaced with a
 * `DROP COLUMN` + `ADD COLUMN` pair — almost certainly by re-running
 * `npx prisma migrate dev` and accepting its diff instead of hand-editing the
 * generated SQL the way plan 05-02 Task 1 did.
 *
 *   THE FIX: restore the migration body to the three hand-written statements
 *   documented in `prisma/migrations/<timestamp>_template_draft_published/
 *   migration.sql`'s own header comment — `RENAME COLUMN`, then
 *   `ADD COLUMN "draftTemplateKey" ... DEFAULT 'flagship-fashion'`, then
 *   `UPDATE ... SET "draftTemplateKey" = "publishedTemplateKey"`.
 *
 *   THE WRONG FIX: do NOT regenerate the migration with
 *   `npx prisma migrate dev --create-only` and accept whatever diff it
 *   produces. That diff is exactly the `DROP COLUMN` + `ADD COLUMN` pair this
 *   test exists to catch.
 *
 * A failure in the "database" describe block means a seeded tenant's stored
 * template columns are missing, unreadable, or have drifted from each other —
 * i.e. the non-vacuity control this suite also runs against the real Neon
 * test branch found the rename did not actually take effect there.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const migrationsDir = join(repoRoot, "prisma", "migrations");

interface MigrationFile {
  readonly dir: string;
  readonly sql: string;
}

/** Every `migration.sql` under `prisma/migrations/*`, read as text. */
function migrationSqlFiles(): MigrationFile[] {
  if (!existsSync(migrationsDir)) return [];

  const found: MigrationFile[] = [];
  for (const entry of readdirSync(migrationsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sqlPath = join(migrationsDir, entry.name, "migration.sql");
    if (!existsSync(sqlPath)) continue;
    found.push({ dir: entry.name, sql: readFileSync(sqlPath, "utf8") });
  }
  return found;
}

const allMigrations = migrationSqlFiles();

/** The one migration expected to touch the split, identified by content, not by filename. */
const templateMigrations = allMigrations.filter((migration) =>
  migration.sql.includes("publishedTemplateKey"),
);

describe("template migration safety (D-13 / Pitfall 1)", () => {
  describe("source: the hand-edited RENAME COLUMN migration", () => {
    it("actually scanned the migrations directory", () => {
      // The non-vacuity control for the source half. A scan that silently
      // found zero files would make every assertion below pass over nothing,
      // which is the one failure mode a source-level guard must not have —
      // see tests/unit/single-order-state-writer.test.ts for the same pin.
      expect(
        allMigrations.length,
        "No migration.sql files were found under prisma/migrations/. That " +
          "means prisma/migrations/ is missing or empty, so every assertion " +
          "in this describe block is passing over zero files rather than " +
          "actually checking the rename.",
      ).toBeGreaterThan(0);
    });

    it("has exactly one migration that touches publishedTemplateKey", () => {
      expect(
        templateMigrations.map((migration) => migration.dir),
        "Expected exactly one migration to mention publishedTemplateKey. " +
          "Zero means the Phase 5 rename migration is missing entirely; more " +
          "than one means a second migration also touched this column, which " +
          "makes it ambiguous which one actually ran the rename in order.",
      ).toHaveLength(1);
    });

    const migration = templateMigrations[0];

    it("renames templateKey to publishedTemplateKey rather than dropping and recreating it", () => {
      expect(
        migration,
        "No migration touches publishedTemplateKey — see the previous test.",
      ).toBeDefined();
      if (!migration) return;

      expect(
        migration.sql,
        `${migration.dir}/migration.sql does not contain the hand-written ` +
          'RENAME COLUMN statement. Every merchant in this codebase is ' +
          'currently on "flagship-fashion" (TMPL-01), so a regenerated ' +
          "DROP COLUMN + ADD COLUMN migration would produce byte-identical " +
          "data in dev and pass every runtime test — the data loss is " +
          "invisible until a merchant picks a different template in " +
          "production, and by then the dropped column's values are gone.\n" +
          "FIX: restore " +
          'ALTER TABLE "storefront_theme" RENAME COLUMN "templateKey" TO ' +
          '"publishedTemplateKey"; as the migration\'s first statement.\n' +
          "WRONG FIX: do not run `npx prisma migrate dev` and accept its " +
          "regenerated diff — that diff IS the DROP COLUMN pair this test " +
          "exists to catch.",
      ).toContain(
        'RENAME COLUMN "templateKey" TO "publishedTemplateKey"',
      );
    });

    it("contains no DROP COLUMN referencing templateKey", () => {
      if (!migration) return;

      const dropOffenders =
        migration.sql.match(/DROP COLUMN\s+"?templateKey"?/gi) ?? [];

      expect(
        dropOffenders,
        `${migration.dir}/migration.sql contains a DROP COLUMN touching ` +
          "templateKey. Because every merchant is currently on " +
          '"flagship-fashion", this reset is byte-identical to a correct ' +
          "migration in dev and invisible to any runtime test — it only " +
          "becomes real data loss once merchants have picked non-default " +
          "templates in production.\n" +
          "FIX: replace the DROP COLUMN + ADD COLUMN pair with the " +
          'hand-written RENAME COLUMN "templateKey" TO "publishedTemplateKey", ' +
          'followed by ADD COLUMN "draftTemplateKey" ... DEFAULT ' +
          "'flagship-fashion' and an UPDATE that copies the published value " +
          "into the new draft column.\n" +
          "WRONG FIX: do not regenerate this migration with " +
          "`npx prisma migrate dev` and accept its diff.",
      ).toEqual([]);
    });
  });

  describe("database: every seeded storefront_theme row survived the rename", () => {
    beforeAll(async () => {
      // A fresh, known baseline. This file only reads — it never mutates a
      // seeded tenant's rows — so a single beforeAll (rather than a
      // per-test reseed) is enough, matching merchant-context.test.ts's
      // and storefront-editor.test.ts's documented preference for one
      // seedTwoTenants() call per session-bearing... file over several,
      // to avoid contending with prismaBase's own pool for a transaction
      // slot.
      await seedTwoTenants();
    });

    it("has at least one storefront_theme row to check (non-vacuity control)", async () => {
      const rows = await Promise.all(
        TENANTS.map((tenant) =>
          scopedDb(tenant.id).storefrontTheme.findUnique({
            where: { tenantId: tenant.id },
            select: { draftTemplateKey: true, publishedTemplateKey: true },
          }),
        ),
      );

      expect(
        rows.filter((row) => row !== null).length,
        "The two-tenant fixture produced zero readable storefront_theme " +
          "rows, so the assertions below would be vacuously true. Either " +
          "the fixture failed to seed, or the rename migration was not " +
          "applied to the test branch.",
      ).toBeGreaterThan(0);
    });

    it.each(TENANTS)(
      "draftTemplateKey and publishedTemplateKey are both readable, equal to each other, and equal 'flagship-fashion' for $slug",
      async (tenant) => {
        // Read through scopedDb(tenantId), never $queryRaw/$executeRaw —
        // those are banned repository-wide by eslint.config.mjs's
        // no-restricted-syntax rule (verified empirically not to be
        // intercepted by the tenant-scope extension).
        const theme = await scopedDb(tenant.id).storefrontTheme.findUnique({
          where: { tenantId: tenant.id },
          select: { draftTemplateKey: true, publishedTemplateKey: true },
        });

        expect(
          theme,
          `tenant ${tenant.id} has no storefront_theme row. The two-tenant ` +
            "fixture seeds one per tenant — this means the fixture did not " +
            "run, or ran against the wrong branch.",
        ).not.toBeNull();
        if (!theme) return;

        expect(theme.draftTemplateKey).toBe("flagship-fashion");
        expect(theme.publishedTemplateKey).toBe("flagship-fashion");
        expect(
          theme.draftTemplateKey,
          `tenant ${tenant.id}: draftTemplateKey ` +
            `(${theme.draftTemplateKey}) and publishedTemplateKey ` +
            `(${theme.publishedTemplateKey}) disagree. The migration's ` +
            "UPDATE statement copies publishedTemplateKey into " +
            "draftTemplateKey for every existing row at migration time — a " +
            "mismatch here means that UPDATE did not run or did not cover " +
            "this row.",
        ).toBe(theme.publishedTemplateKey);
      },
    );
  });
});
