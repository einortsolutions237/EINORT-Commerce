import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const schemaPath = fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url));

/**
 * Thrown when the isolation project is started without a test database.
 * Named so the failure reads as configuration, not as a broken test.
 */
export class MissingTestDatabaseError extends Error {
  override readonly name = "MissingTestDatabaseError";

  constructor() {
    super(
      "TEST_DATABASE_URL is not set. The isolation test project requires a " +
        "dedicated Neon branch (`einort-test`) and refuses to run without one.\n" +
        "\n" +
        "Fix: copy `.env.test.example` to `.env.test`, set TEST_DATABASE_URL, " +
        "and run the suite through `npm run test:full` (which loads `.env.test`).\n" +
        "\n" +
        "This fails closed on purpose: defaulting to DATABASE_URL here would " +
        "point a truncate-and-seed suite at the development database.",
    );
  }
}

/**
 * Resolve and validate the isolation-suite database URL.
 *
 * Never falls back to DATABASE_URL — see the error message above.
 */
export function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || url.trim() === "") {
    throw new MissingTestDatabaseError();
  }
  return url;
}

/**
 * Truncate every table and rebuild the two-tenant fixture.
 *
 * The hook was left empty by plan 01-01; plan 01-04 T1 wires it to the real
 * fixture. The URL is passed explicitly rather than re-read from the
 * environment so that the database this migrates and the database it seeds
 * cannot possibly differ.
 *
 * `seedTwoTenants` re-runs its own `assertSafeSeedTarget` on the value — the
 * duplication is intentional, because the guard must hold for every caller,
 * not only for the ones that remembered to check first.
 */
export async function truncateAndSeed(databaseUrl: string): Promise<void> {
  const { seedTwoTenants } = await import("./seed-two-tenants");
  await seedTwoTenants(databaseUrl);
}

/**
 * Vitest `globalSetup` for the `isolation` project. Runs once per suite.
 */
export default async function setup(): Promise<void> {
  const databaseUrl = requireTestDatabaseUrl();

  // Identify the target BEFORE running DDL against it. `requireTestDatabaseUrl`
  // only proves the variable is set; this proves the branch it names is the
  // test branch and not the development one (T-01-27).
  const { assertSafeSeedTarget } = await import("./seed-two-tenants");
  assertSafeSeedTarget(databaseUrl);

  if (!existsSync(schemaPath)) {
    // Plan 01-02 creates prisma/schema.prisma. Until then there is nothing to
    // migrate — and there are no isolation tests either (they arrive in 01-04),
    // so this branch is unreachable in a normal run. Loud rather than silent so
    // it can never be mistaken for a passing migration.
    console.warn(
      "[global-setup] prisma/schema.prisma does not exist yet (created by plan " +
        "01-02) — skipping `prisma migrate deploy`. Isolation tests that need " +
        "tables WILL fail until the schema lands.",
    );
    return;
  }

  // Point Prisma at the test branch for this child process only. Both keys are
  // set: DATABASE_URL for the runtime datasource, DIRECT_URL because migrations
  // cannot run through Neon's transaction pooler.
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
    },
  });

  await truncateAndSeed(databaseUrl);
}
