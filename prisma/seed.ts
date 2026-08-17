/**
 * `prisma db seed` entry point.
 *
 * Declared in `prisma.config.ts` as `tsx --conditions=react-server prisma/seed.ts`.
 * Prisma 7 no longer auto-seeds on `migrate dev`, so this only ever runs when
 * somebody types the command — which is precisely why the guard below matters:
 * the one realistic way to lose the development database is an explicit
 * invocation aimed at the wrong dotenv file.
 *
 * All of the safety lives in `resolveSeedTargetUrl` / `assertSafeSeedTarget`
 * (see `tests/setup/seed-two-tenants.ts`), deliberately shared with the Vitest
 * `globalSetup` path so the two entry points cannot diverge:
 *
 *   1. the target is read from TEST_DATABASE_URL and never falls back to
 *      DATABASE_URL;
 *   2. the endpoint behind DATABASE_URL/DIRECT_URL in `.env.local` is rejected
 *      outright — that is the development branch;
 *   3. the target must additionally appear in the known-test-endpoint
 *      allowlist, so an unrecognised database is refused rather than assumed
 *      safe.
 *
 * The seed TRUNCATEs every table. There is no partial or recoverable mode.
 */
import {
  closeSeedClient,
  seedTwoTenants,
  TENANT_A,
  TENANT_B,
} from "../tests/setup/seed-two-tenants";

async function main(): Promise<void> {
  await seedTwoTenants();
  console.log(
    "[prisma db seed] two-tenant fixture ready: " +
      `${TENANT_A.slug} (${TENANT_A.id}), ${TENANT_B.slug} (${TENANT_B.id})`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    // Non-zero exit so a refused target fails a CI step rather than logging and
    // continuing as if the database had been seeded.
    process.exitCode = 1;
  })
  // The seed client is cached for reuse across calls, so a one-shot run has to
  // release the pool or the process will not exit.
  .finally(() => closeSeedClient());
