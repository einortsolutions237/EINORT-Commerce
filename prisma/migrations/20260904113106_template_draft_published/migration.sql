-- AlterTable
-- Hand-edited (Phase 5, D-13). Prisma's default schema diff would generate a
-- drop-then-add pair for "templateKey" -> "publishedTemplateKey" (a dropped
-- column, followed by an added column, DEFAULT 'flagship-fashion'), which
-- silently resets every existing merchant's template to the flagship
-- default. Because every merchant is currently on "flagship-fashion", that
-- reset is byte-identical to a correct migration in dev and would not be
-- caught by any runtime test — it only becomes visible data loss after
-- merchants start picking templates. Do NOT regenerate this file with
-- `prisma migrate dev` and accept its diff; the RENAME COLUMN below is the
-- fix. See tests/isolation/template-migration-safety.test.ts.
ALTER TABLE "storefront_theme" RENAME COLUMN "templateKey" TO "publishedTemplateKey";
ALTER TABLE "storefront_theme" ADD COLUMN "draftTemplateKey" TEXT NOT NULL DEFAULT 'flagship-fashion';
UPDATE "storefront_theme" SET "draftTemplateKey" = "publishedTemplateKey";
