import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * The deterministic two-tenant fixture the `isolation` Vitest project runs against.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE WRITES THROUGH AN UNSCOPED CLIENT ON PURPOSE. DO NOT "FIX" IT.
 * ---------------------------------------------------------------------------
 * Never route the seed through `scopedDb`. The entire value of the isolation
 * suite is that the fixture can create tenant A's rows while the code under
 * test is running as tenant B. A scoped seed could only ever create rows for
 * the tenant currently under test, which would make every cross-tenant
 * assertion vacuously true — the suite would stay green while the guarantee it
 * claims to prove had been deleted.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE CONTAINS THE ONE SANCTIONED RAW SQL IN THE REPOSITORY (T-01-28).
 * ---------------------------------------------------------------------------
 * `eslint.config.mjs`'s `no-restricted-syntax` ban on `$queryRaw`/`$executeRaw`
 * is scoped to `src/**`. This module lives in `tests/setup/**`, so the ban does
 * not apply — and the exemption is sound rather than convenient: the statement
 * below carries no tenant predicate (it truncates everything, for every
 * tenant), so there is no tenant filter for it to bypass, and the guard in
 * `assertSafeSeedTarget` means it can only ever reach the dedicated Neon test
 * branch. A single `TRUNCATE ... RESTART IDENTITY CASCADE` is also what makes
 * the fixture idempotent: re-running the seed is always a full reset, never an
 * append.
 *
 * The client here is built explicitly against the resolved test connection
 * string rather than imported from `src/server/db/*`. That is deliberate too:
 * it removes any possibility of a truncate-and-reseed inheriting whatever
 * ambient `DATABASE_URL` happens to be loaded, and it keeps this module
 * importable from a plain `tsx` script (the `src/server/db/*` modules open with
 * `import "server-only"`, which throws outside a `react-server` resolution).
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** Raised when the seed is pointed at anything that is not the test branch. */
export class UnsafeSeedTargetError extends Error {
  override readonly name = "UnsafeSeedTargetError";
}

/**
 * Neon endpoint IDs this fixture is allowed to TRUNCATE.
 *
 * WHY THIS IS NOT A SUBSTRING CHECK ON `"einort-test"`: a Neon connection
 * string never contains the branch name. Branches are addressed by endpoint ID
 * (`ep-<words>-<hash>`), and every branch of this project serves the same
 * database name (`neondb`) with the same credentials. `.env.test.example`
 * suggests otherwise because its placeholder URL puts `einort-test` in the
 * database-name position, but the real provisioned branch does not — so a
 * literal-substring guard would reject the genuine test branch 100% of the
 * time and the seed could never run at all. The endpoint ID is the only part of
 * the URL that actually distinguishes one branch from another, so that is what
 * the allowlist names.
 *
 * `ep-sweet-shape-za5xwdvh` is the Neon `einort-test` branch. If that branch is
 * ever recreated its endpoint changes and this list must be updated — or set
 * `TEST_DATABASE_ENDPOINTS` to a comma-separated override. A stale value here
 * fails closed (refuses to seed) rather than silently truncating something
 * else, which is the correct direction for a destructive operation.
 */
const DEFAULT_TEST_ENDPOINTS: readonly string[] = ["ep-sweet-shape-za5xwdvh"];

/**
 * Reduce a Postgres URL to its Neon endpoint ID.
 *
 * Neon exposes a pooled and a direct host per endpoint that differ only by a
 * `-pooler` suffix, so the suffix is normalised away — otherwise the
 * development-branch check below would compare the pooled dev URL against the
 * direct dev URL and conclude they are different databases.
 */
function endpointIdOf(connectionString: string): string {
  let hostname: string;
  try {
    hostname = new URL(connectionString).hostname.toLowerCase();
  } catch {
    throw new UnsafeSeedTargetError(
      "Refusing to seed: the connection string is not a parseable URL, so its " +
        "target database cannot be identified. A destructive fixture will not " +
        "run against an unidentifiable host.",
    );
  }
  const label = hostname.split(".")[0] ?? "";
  return label.replace(/-pooler$/, "");
}

/**
 * Endpoint IDs belonging to the *application* database, read from disk rather
 * than from `process.env`.
 *
 * On-disk is the robust source: `applyDataLayerEnv` below sets `DATABASE_URL`
 * so that `@/env` validates, and a `process.env`-based check would then be
 * comparing the test URL against itself. `.env.local` cannot drift that way.
 */
function developmentEndpoints(): string[] {
  const found: string[] = [];
  for (const file of [".env.local", ".env"]) {
    const path = resolve(repoRoot, file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
      const match = text.match(
        new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\r\\n]+)`, "m"),
      );
      if (!match?.[1]) continue;
      try {
        found.push(endpointIdOf(match[1]));
      } catch {
        // An unparseable app URL is not this guard's problem to report.
      }
    }
  }
  return found;
}

function allowedEndpoints(): readonly string[] {
  const override = process.env.TEST_DATABASE_ENDPOINTS;
  if (override && override.trim() !== "") {
    return override
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry !== "");
  }
  return DEFAULT_TEST_ENDPOINTS;
}

/**
 * Refuse to truncate anything that is not the dedicated test branch (T-01-27).
 *
 * Two independent layers, because this is the guard standing between a test run
 * and the irreversible loss of the development database:
 *   1. denylist — the endpoint behind `DATABASE_URL`/`DIRECT_URL` is never a
 *      legal target, however the caller arrived at it;
 *   2. allowlist — the target must additionally be a known test endpoint, so an
 *      unrecognised third database (staging, a colleague's branch, production
 *      under a new name) is refused rather than assumed safe.
 */
export function assertSafeSeedTarget(connectionString: string): void {
  const target = endpointIdOf(connectionString);

  for (const devEndpoint of developmentEndpoints()) {
    if (devEndpoint === target) {
      throw new UnsafeSeedTargetError(
        `Refusing to seed: the target endpoint "${target}" is the same Neon ` +
          "endpoint as DATABASE_URL/DIRECT_URL in .env.local — that is the " +
          "development branch. This fixture TRUNCATEs every table, so running " +
          "it there would be unrecoverable data loss.\n" +
          "Point TEST_DATABASE_URL at the dedicated `einort-test` branch.",
      );
    }
  }

  const allowed = allowedEndpoints();
  if (!allowed.includes(target)) {
    throw new UnsafeSeedTargetError(
      `Refusing to seed: endpoint "${target}" is not a known test endpoint.\n` +
        `Allowed: ${allowed.join(", ")}\n` +
        "This fixture TRUNCATEs every table and only ever runs against the " +
        "dedicated Neon `einort-test` branch.\n" +
        "If that branch was recreated its endpoint changed — update " +
        "DEFAULT_TEST_ENDPOINTS in tests/setup/seed-two-tenants.ts, or set " +
        "TEST_DATABASE_ENDPOINTS to a comma-separated allowlist.",
    );
  }
}

/**
 * Resolve the connection string this fixture may write to.
 *
 * Reads `TEST_DATABASE_URL` and **never** falls back to `DATABASE_URL`. The
 * absent-variable path is the common accident (running the seed with the wrong
 * dotenv file), so it fails closed with a message that names the branch.
 */
export function resolveSeedTargetUrl(explicit?: string): string {
  const candidate = explicit ?? process.env.TEST_DATABASE_URL;
  if (!candidate || candidate.trim() === "") {
    throw new UnsafeSeedTargetError(
      "Refusing to seed: TEST_DATABASE_URL is not set.\n" +
        "The two-tenant fixture TRUNCATEs every table, so it only ever runs " +
        "against the dedicated Neon `einort-test` branch configured in " +
        "`.env.test` — and it deliberately never falls back to DATABASE_URL, " +
        "because that would point a destructive fixture at the development " +
        "database.\n" +
        "Run it as: npx dotenv -e .env.test -- <command>",
    );
  }
  const url = candidate.trim();
  assertSafeSeedTarget(url);
  return url;
}

/**
 * Make `@/env` satisfiable for the dynamic `tenant-scoped` import below.
 *
 * Every value is set with `??=`, so a real environment (Vitest's configured
 * `test.env`, CI) always wins. The placeholders match the "optional overrides"
 * block documented in `.env.test.example`: the fixture exercises the data
 * layer, not the HTTP or auth surface, so auth/domain values only need to be
 * *valid*, not real.
 */
function applyDataLayerEnv(connectionString: string): void {
  process.env.DATABASE_URL ??= connectionString;
  process.env.DIRECT_URL ??= connectionString;
  process.env.BETTER_AUTH_SECRET ??= "0".repeat(48);
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN ??= "localhost:3000";
}

/** One tenant's fixed identity. Never randomised — see `TENANT_A` below. */
export interface TenantFixture {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly userId: string;
  readonly email: string;
  readonly memberId: string;
}

/**
 * Fixed, human-readable identities.
 *
 * Deliberately not `randomUUID()`/`cuid()`: when an isolation assertion fails,
 * the diff should read `expected "tenant-b-fixed-id", received
 * "tenant-a-fixed-id"` — which names the leak directly — rather than two
 * opaque identifiers that have to be traced back to a tenant first. Fixed ids
 * also make the fixture reproducible across runs, which matters because the
 * suite shares one long-lived Neon branch.
 */
export const TENANT_A: TenantFixture = Object.freeze({
  id: "tenant-a-fixed-id",
  slug: "alpha-store",
  name: "Alpha Store",
  userId: "user-a-fixed-id",
  email: "owner-a@example.test",
  memberId: "member-a-fixed-id",
});

export const TENANT_B: TenantFixture = Object.freeze({
  id: "tenant-b-fixed-id",
  slug: "beta-store",
  name: "Beta Store",
  userId: "user-b-fixed-id",
  email: "owner-b@example.test",
  memberId: "member-b-fixed-id",
});

export const TENANTS: readonly TenantFixture[] = Object.freeze([
  TENANT_A,
  TENANT_B,
]);

/** Fixed timestamp so two runs of the fixture are byte-identical. */
const FIXTURE_EPOCH = new Date("2026-01-01T00:00:00.000Z");

/**
 * Per-model row builders for the tenant-scoped registry.
 *
 * The seed loop is driven by `TENANT_SCOPED_MODELS`, not by this map, so
 * registering a model in Phase 3 without adding a builder here is a loud,
 * self-describing failure at seed time rather than a silently missing fixture
 * that would make the isolation suite pass over zero rows.
 *
 * `tenantId` is NOT set here — the loop appends it, so a builder cannot
 * accidentally cross-stamp a tenant.
 */
const MODEL_FIXTURES: Record<
  string,
  (tenant: TenantFixture) => Record<string, unknown>
> = {
  /**
   * `slug` is globally unique (DOM-02), so each tenant must claim its OWN slug
   * here. Giving both tenants the same slug would make the fixture unseedable.
   */
  StoreSlugHistory: (tenant) => ({
    id: `${tenant.id}-slug-history`,
    slug: tenant.slug,
    claimedAt: FIXTURE_EPOCH,
    releasedAt: null,
  }),
};

/** `StoreSlugHistory` -> `storeSlugHistory`. */
export function delegateKeyFor(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function createUnscopedClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/**
 * Drop every row in the public schema in one statement.
 *
 * Table names come from `pg_tables` rather than a hand-maintained list, so a
 * migration adding a table in Phase 3+ is covered without touching this file.
 * `_prisma_migrations` is excluded: truncating it would make the next
 * `migrate deploy` try to replay every migration against a populated schema.
 * `CASCADE` handles FK ordering; `RESTART IDENTITY` resets sequences so runs do
 * not drift.
 */
async function truncateAllTables(db: PrismaClient): Promise<string[]> {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;
  if (rows.length === 0) return [];

  const quoted = rows
    .map((row) => `"public"."${row.tablename.replace(/"/g, '""')}"`)
    .join(", ");
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
  );
  return rows.map((row) => row.tablename);
}

/**
 * Truncate, then rebuild the two-tenant fixture from scratch.
 *
 * Idempotent by construction: every run starts with a full truncate, so calling
 * this twice leaves exactly the same rows as calling it once.
 *
 * @param databaseUrl Optional explicit target. Omit to resolve
 *   `TEST_DATABASE_URL`. Either way the target passes `assertSafeSeedTarget`.
 */
export async function seedTwoTenants(databaseUrl?: string): Promise<void> {
  // Guard FIRST, before anything touches process.env — `applyDataLayerEnv`
  // writes DATABASE_URL, and the denylist must not end up comparing the target
  // against a value this function itself just wrote.
  const connectionString = resolveSeedTargetUrl(databaseUrl);
  applyDataLayerEnv(connectionString);

  // Dynamic on purpose: `@/server/db/tenant-scoped` transitively imports
  // `@/env`, which validates at module-evaluation time. A static import would
  // therefore run validation before the line above could satisfy it.
  const { TENANT_SCOPED_MODELS } = await import("@/server/db/tenant-scoped");

  const db = createUnscopedClient(connectionString);
  try {
    await truncateAllTables(db);

    for (const tenant of TENANTS) {
      // `Organization` IS the tenant, so it is intentionally NOT in
      // TENANT_SCOPED_MODELS and is seeded explicitly.
      await db.organization.create({
        data: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          createdAt: FIXTURE_EPOCH,
          status: "active",
        },
      });

      // User + Member exist so the fixture also exercises the Better Auth
      // registry tables that plan 01-06's signup test will read back.
      await db.user.create({
        data: {
          id: tenant.userId,
          name: `${tenant.name} Owner`,
          email: tenant.email,
          emailVerified: true,
          createdAt: FIXTURE_EPOCH,
          updatedAt: FIXTURE_EPOCH,
        },
      });

      await db.member.create({
        data: {
          id: tenant.memberId,
          organizationId: tenant.id,
          userId: tenant.userId,
          role: "owner",
          createdAt: FIXTURE_EPOCH,
        },
      });
    }

    // One row per registered tenant-scoped model, per tenant. Driven by the
    // registry so Phase 3's Product/Order are covered the moment they are
    // registered (and loudly incomplete until a builder is added).
    for (const model of TENANT_SCOPED_MODELS) {
      const build = MODEL_FIXTURES[model];
      if (!build) {
        throw new Error(
          `seedTwoTenants: no fixture row builder registered for "${model}".\n` +
            "The isolation suite iterates TENANT_SCOPED_MODELS and needs one " +
            "row per tenant per model, so a newly registered model must also " +
            "get an entry in MODEL_FIXTURES in " +
            "tests/setup/seed-two-tenants.ts.",
        );
      }

      const delegate = (db as unknown as Record<string, { create: (a: unknown) => Promise<unknown> }>)[
        delegateKeyFor(model)
      ];
      if (!delegate) {
        throw new Error(
          `seedTwoTenants: "${model}" is registered in TENANT_SCOPED_MODELS ` +
            `but the Prisma client exposes no "${delegateKeyFor(model)}" ` +
            "delegate. The registry and prisma/schema.prisma have drifted.",
        );
      }

      for (const tenant of TENANTS) {
        await delegate.create({
          // `tenantId` last: a builder can never cross-stamp a tenant.
          data: { ...build(tenant), tenantId: tenant.id },
        });
      }
    }
  } finally {
    await db.$disconnect();
  }
}

/**
 * Direct-invocation entry point, so the fixture can be run and re-run on its
 * own while developing:
 *
 *   npx dotenv -e .env.test -- npx tsx --conditions=react-server \
 *     tests/setup/seed-two-tenants.ts
 *
 * `--conditions=react-server` is required because the dynamic
 * `@/server/db/tenant-scoped` import above reaches `import "server-only"`,
 * which throws under Node's default resolution.
 */
const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  seedTwoTenants()
    .then(() => {
      console.log(
        `[seed] two-tenant fixture ready: ${TENANT_A.slug} (${TENANT_A.id}), ` +
          `${TENANT_B.slug} (${TENANT_B.id})`,
      );
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
