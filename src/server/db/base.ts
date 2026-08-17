import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * The raw, unscoped Prisma client. **Not** an application data-access path.
 *
 * `eslint.config.mjs` restricts imports of this module to `src/server/db/**`,
 * `src/server/tenant/**` and `src/server/auth/**`. Feature code reaches for
 * `scopedDb(tenantId)`, `platformDb` or `adminDb` instead — see the four-client
 * table in `01-RESEARCH.md` Pattern 6.
 *
 * `import "server-only"` is the first line on purpose: an accidental client
 * import becomes a build failure rather than a runtime credential leak.
 */

/**
 * Prisma 7 is Rust-free and has no implicit query engine, so a driver adapter
 * is mandatory — `new PrismaClient()` with no adapter simply fails.
 *
 * The adapter is pointed at the **pooled** Neon URL (CLAUDE.md C-5). An
 * unpooled connection string exhausts Postgres connection limits under
 * serverless concurrency; `DIRECT_URL` exists for migrations only and is wired
 * up in `prisma.config.ts`, never here.
 */
const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

/**
 * Cached on `globalThis` in development so hot-reload does not open a new pool
 * on every edit — the classic way to exhaust Neon's connection limit locally.
 * Never cached in production, where each serverless instance wants its own.
 */
const globalForPrisma = globalThis as unknown as {
  prismaBase?: ReturnType<typeof createPrismaClient>;
};

export const prismaBase = globalForPrisma.prismaBase ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = prismaBase;
}
