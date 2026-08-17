import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const srcPath = fileURLToPath(new URL("./src", import.meta.url));

/**
 * `server-only` is a marker package whose *default* export condition is a
 * module that throws on import; only the `react-server` condition resolves to
 * an empty module. Vitest resolves with Node's default conditions, so every
 * `src/server/db/*` module — all of which open with `import "server-only"` —
 * would throw on import inside the isolation suite.
 *
 * Aliasing to the package's own `empty.js` is the surgical fix. Adding
 * `react-server` to `resolve.conditions` globally would also work, but it
 * changes how React and Next resolve too, which is a much larger blast radius
 * for a one-package problem.
 */
const serverOnlyStub = fileURLToPath(
  new URL("./node_modules/server-only/empty.js", import.meta.url),
);

/**
 * The isolation project talks to the dedicated Neon test branch and nothing
 * else. `TEST_DATABASE_URL` is the only variable `.env.test` carries, so the
 * data-layer variables that `@/env` validates are derived from it here.
 *
 * DATABASE_URL is set to the TEST url deliberately: `src/server/db/base.ts`
 * builds `prismaBase` from `env.DATABASE_URL`, so without this mapping
 * `scopedDb`/`adminDb` would either fail validation or — far worse — connect to
 * whatever `.env.local` happens to hold, and the isolation suite would be
 * asserting against the development database.
 *
 * The auth/domain values are placeholders that only have to be *valid*: the
 * isolation suite exercises the data layer, not the HTTP or auth surface. They
 * mirror the "optional overrides" block in `.env.test.example`.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "";
const isolationEnv = {
  DATABASE_URL: testDatabaseUrl,
  DIRECT_URL: testDatabaseUrl,
  BETTER_AUTH_SECRET: "0".repeat(48),
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_ROOT_DOMAIN: "localhost:3000",
};

/**
 * Two projects, one config (01-VALIDATION.md § Test Infrastructure):
 *
 *   unit      — no database, no network, target < 2s. This is the fast gate that
 *               runs after every task commit.
 *   isolation — the tenant-isolation suite. Requires TEST_DATABASE_URL pointing
 *               at a dedicated Neon branch and runs migrations before the suite.
 *               Docker is unavailable on this machine, so Testcontainers is not
 *               an option and the branch is the substitute.
 *
 * The `@/*` alias is repeated here on purpose — Vitest does not read tsconfig
 * `paths`, so omitting this makes every aliased import fail at test time only.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { "@": srcPath } },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: { alias: { "@": srcPath, "server-only": serverOnlyStub } },
        test: {
          name: "isolation",
          environment: "node",
          include: ["tests/isolation/**/*.test.ts"],
          globalSetup: ["tests/setup/global-setup.ts"],
          env: isolationEnv,
          // Isolation tests share one database branch; running files in parallel
          // would let one suite's truncate wipe another's fixtures mid-assertion.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
