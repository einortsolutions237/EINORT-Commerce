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

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    // Prisma 7 no longer auto-seeds on `migrate dev`, so the runner must be
    // declared explicitly. `prisma/seed.ts` itself is owned by plan 01-04.
    seed: "tsx prisma/seed.ts",
  },

  datasource: {
    // Neon POOLED connection string. Serverless concurrency exhausts Postgres
    // connection limits against an unpooled host (CLAUDE.md C-5).
    url: env("DATABASE_URL"),
    // Neon UNPOOLED connection string. Migrations only — DDL and advisory
    // locks do not survive a transaction pooler.
    directUrl: env("DIRECT_URL"),
  },
});
