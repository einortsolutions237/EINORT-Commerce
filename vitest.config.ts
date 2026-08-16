import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const srcPath = fileURLToPath(new URL("./src", import.meta.url));

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
        resolve: { alias: { "@": srcPath } },
        test: {
          name: "isolation",
          environment: "node",
          include: ["tests/isolation/**/*.test.ts"],
          globalSetup: ["tests/setup/global-setup.ts"],
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
