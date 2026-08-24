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
 *
 * The `unit` project needs the same alias as of plan 02-01: the entitlement
 * modules (`src/server/entitlements/**`) are pure, database-free and therefore
 * unit-testable, but they still open with `import "server-only"` because they
 * must never be bundled into a client component. The marker package is a build
 * constraint, not a runtime dependency, so stubbing it out under test changes
 * nothing about what the tests prove.
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
 *
 * The `R2_*` placeholders (plan 03-02) exist for the same reason and are
 * deliberately fake. `src/env.ts` marks them required — a real bucket must
 * exist before the app boots, because product images have no fallback storage
 * path — and `src/server/db/base.ts` imports `@/env`, so every isolation test
 * pulls the whole schema in transitively and would fail validation without
 * them. Supplying junk here rather than relaxing the schema keeps the boot-time
 * guarantee intact where it matters (production) without putting live R2
 * credentials on disk for a suite that never opens a socket to R2: presigning
 * is a local signature computation and the image pipeline runs Sharp against a
 * fixture file. `RESEND_*` are absent on purpose — they are `.optional()`, and
 * leaving them unset is the configuration the degraded path must keep working
 * under.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "";
const isolationEnv = {
  DATABASE_URL: testDatabaseUrl,
  DIRECT_URL: testDatabaseUrl,
  BETTER_AUTH_SECRET: "0".repeat(48),
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_ROOT_DOMAIN: "localhost:3000",
  R2_ACCOUNT_ID: "test-account",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_BUCKET: "test-bucket",
  R2_PUBLIC_BASE_URL: "https://r2.example.invalid",
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
        resolve: { alias: { "@": srcPath, "server-only": serverOnlyStub } },
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
          // Releases the cached seed connection pool when each file finishes.
          setupFiles: ["tests/setup/isolation-setup.ts"],
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
