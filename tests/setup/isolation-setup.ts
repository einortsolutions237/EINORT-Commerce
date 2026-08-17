import { afterAll } from "vitest";

import { closeSeedClient } from "./seed-two-tenants";

/**
 * Per-file setup for the Vitest `isolation` project.
 *
 * `seedTwoTenants` caches one Prisma client per connection string so that
 * rebuilding the fixture before every test does not pay for a fresh TLS
 * handshake to Neon each time. That cache has to be released when a test file
 * finishes, or Vitest ends the run holding an open connection pool.
 *
 * Registering the teardown here rather than in each test file means plans
 * 01-05 and 01-06 inherit it by dropping a file into `tests/isolation/` — there
 * is no per-file ritual for them to forget.
 */
afterAll(async () => {
  await closeSeedClient();
});
