import { existsSync } from "node:fs";

import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * Prisma 7 no longer reads `datasource.url` from `schema.prisma` (Pitfall 9 —
 * the single most common Prisma-7 setup failure, because every pre-2026
 * tutorial still puts it there). Connection configuration lives here instead,
 * and the runtime client gets its connection through `@prisma/adapter-pg` in
 * `src/server/db/base.ts`.
 *
 * Env loading: the Prisma CLI does not read `.env.local`, and this project's
 * real credentials live there (Next.js's convention), not in `.env`. We use
 * Node's built-in `process.loadEnvFile` rather than `dotenv/config` for two
 * reasons: `dotenv/config` only ever loads `.env`, and `dotenv` is not a
 * declared dependency of this project — importing it would rely on npm
 * hoisting a transitive package.
 *
 * Precedence matches Next.js: a variable already present in the real
 * environment (CI, Vercel) always wins, then `.env.local`, then `.env`.
 * `loadEnvFile` never overwrites an existing `process.env` key.
 */
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

/**
 * TEST_DATABASE_URL, when present, wins outright.
 *
 * This is a correctness fix, not a convenience (T-01-27). `.env.test` carries
 * TEST_DATABASE_URL and nothing else, so the documented command
 * `npx dotenv -e .env.test -- npx prisma migrate deploy` left DIRECT_URL unset
 * — and the `.env.local` load above then quietly supplied the DEVELOPMENT
 * connection string. The command that every plan and the README describe as
 * "migrate the test branch" was in fact running DDL against the development
 * branch, and announcing it only in a line of CLI output nobody diffs.
 *
 * The override direction is deliberately the safe one. If TEST_DATABASE_URL
 * leaks into a shell where a developer meant to migrate development, the
 * migration lands on the disposable test branch; the reverse mistake is
 * unrecoverable.
 *
 * `tests/setup/global-setup.ts` still passes DATABASE_URL/DIRECT_URL
 * explicitly to its `migrate deploy` child process. That belt-and-braces stays:
 * the guarantee should not rest on this file alone.
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DIRECT_URL = process.env.TEST_DATABASE_URL;
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    // Prisma 7 no longer auto-seeds on `migrate dev`, so the runner must be
    // declared explicitly.
    //
    // `--conditions=react-server` is required, not cosmetic: the seed reaches
    // `src/server/db/tenant-scoped.ts` for TENANT_SCOPED_MODELS, and every
    // module in that directory opens with `import "server-only"` — a marker
    // package whose default export condition throws on import. Only the
    // `react-server` condition resolves it to an empty module.
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },

  datasource: {
    /*
     * The UNPOOLED Neon string, on purpose.
     *
     * Prisma 7 removed `directUrl` — the `Datasource` type is exactly
     * `{ url?, shadowDatabaseUrl? }`, so the Prisma 5/6 two-URL split no
     * longer exists here. It is not needed either, because this file is read
     * *only by the Prisma CLI* (`migrate`, `studio`, `db pull`). The
     * application runtime never loads it: `src/server/db/base.ts` builds its
     * own connection through `@prisma/adapter-pg`.
     *
     * That split is what keeps CLAUDE.md C-5 intact while still doing the
     * right thing for migrations:
     *   runtime  -> DATABASE_URL (pooled)   — via the adapter, in base.ts
     *   CLI/DDL  -> DIRECT_URL  (unpooled)  — here
     *
     * Migrations want the unpooled host specifically: schema changes take
     * session-level advisory locks, which do not survive a transaction pooler.
     */
    url: env("DIRECT_URL"),
  },
});
