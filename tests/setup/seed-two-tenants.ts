import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "@/generated/prisma/client";

/**
 * The deterministic two-tenant fixture the `isolation` Vitest project runs against.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE WRITES THROUGH AN UNSCOPED CLIENT ON PURPOSE. DO NOT "FIX" IT.
 * ---------------------------------------------------------------------------
 * Never route the seed through the tenant-scoping extension in
 * `src/server/db/tenant-scoped.ts`. The entire value of the isolation suite is
 * that the fixture can create tenant A's rows while the code under test is
 * running as tenant B. A tenant-scoped seed could only ever create rows for the
 * tenant currently under test, which would make every cross-tenant assertion
 * vacuously true — the suite would stay green while the guarantee it claims to
 * prove had been deleted.
 *
 * (This module is asserted to contain no reference to the scoped-client helper
 * at all, so the prohibition is phrased by module rather than by symbol name.)
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
 *
 * THIS FUNCTION, NOT `test.env`, IS WHAT SATISFIES `@/env` HERE — and the
 * distinction is the whole reason this list has to be maintained. `isolationEnv`
 * in `vitest.config.ts` is applied to the *worker* processes that run test
 * files. This module is reached from `globalSetup`, which Vitest runs in the
 * *main* process, where `test.env` has not been applied and `.env.test` carries
 * only `TEST_DATABASE_URL`. So a key that exists in `isolationEnv` but not here
 * is undefined at seed time, and the suite dies during global setup with
 * "Invalid environment variables" and zero tests collected — a failure that
 * looks like a broken config rather than like a missing line in this function.
 *
 * The rule that follows: every key added to the REQUIRED set in `src/env.ts`
 * must be added in BOTH places. The R2 block below is plan 03-02 paying that
 * cost the first time.
 */
function applyDataLayerEnv(connectionString: string): void {
  process.env.DATABASE_URL ??= connectionString;
  process.env.DIRECT_URL ??= connectionString;
  process.env.BETTER_AUTH_SECRET ??= "0".repeat(48);
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN ??= "localhost:3000";
  /*
   * Deliberately fake, and identical to `isolationEnv`. The seed opens no
   * socket to R2 — it only needs `@/env` to finish validating so the dynamic
   * `@/server/db/tenant-scoped` import below can resolve. Junk here rather than
   * relaxing the schema keeps the boot-time guarantee (T-03-08) intact where it
   * actually matters, and keeps live R2 credentials off the test path.
   */
  process.env.R2_ACCOUNT_ID ??= "test-account";
  process.env.R2_ACCESS_KEY_ID ??= "test-access-key";
  process.env.R2_SECRET_ACCESS_KEY ??= "test-secret-key";
  process.env.R2_BUCKET ??= "test-bucket";
  process.env.R2_PUBLIC_BASE_URL ??= "https://r2.example.invalid";
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
 * ORD-04's normalisation, reproduced here rather than imported.
 *
 * The production implementation lands in plan 03-05 under `src/server/**`, and
 * this module is deliberately importable from a plain `tsx` script (see the
 * header). Importing it would also make the fixture agree with the code under
 * test by construction — if the normaliser regressed, both sides would move
 * together and the isolation suite would stay green. Two independent
 * expressions of the same rule is the point.
 */
function normalizeReference(reference: string): string {
  return reference.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

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

  Category: (tenant) => ({
    id: `${tenant.id}-category-1`,
    name: `${tenant.name} Category`,
    slug: `${tenant.slug}-cat`,
    createdAt: FIXTURE_EPOCH,
  }),

  /**
   * `categoryId` is deliberately NULL.
   *
   * The composite FK to `category` is `onDelete: Restrict` (D-08 — a category
   * holding products is not disposable), so a fixture product pointing at the
   * fixture category would make `category.deleteMany({})` a foreign-key
   * violation — and that is exactly the call the generic isolation battery in
   * `tests/isolation/tenant-isolation.test.ts` makes against every registered
   * model. Leaving the link unset keeps both rows present and independently
   * assertable. Plan 03-02's own tests own the linked case.
   *
   * `option1Name`/`option2Name` NULL is the no-options product of D-05, whose
   * single implicit variant below is what proves CAT-03's "stock lives at
   * exactly one level".
   */
  Product: (tenant) => ({
    id: `${tenant.id}-product-1`,
    name: `${tenant.name} Product`,
    slug: `${tenant.slug}-product-1`,
    description: null,
    basePriceXaf: 5000,
    active: true,
    option1Name: null,
    option2Name: null,
    categoryId: null,
    createdAt: FIXTURE_EPOCH,
    // `@updatedAt` would otherwise stamp `now()` and break byte-identity
    // between runs. Prisma allows an explicit value, so the fixture sets one.
    updatedAt: FIXTURE_EPOCH,
  }),

  /**
   * The implicit default variant (D-04 / CAT-03). Empty-string option values,
   * NOT NULL — see RESEARCH.md Pitfall 2 and the `@@unique` on the model.
   */
  ProductVariant: (tenant) => ({
    id: `${tenant.id}-variant-1`,
    productId: `${tenant.id}-product-1`,
    option1Value: "",
    option2Value: "",
    priceXaf: null,
    stock: 10,
    sku: null,
    active: true,
  }),

  ProductImage: (tenant) => ({
    id: `${tenant.id}-image-1`,
    productId: `${tenant.id}-product-1`,
    // D-10: position 0 is the hero image.
    position: 0,
    storageKey: `${tenant.id}/product-1/original`,
    width: 1200,
    height: 1200,
    createdAt: FIXTURE_EPOCH,
  }),

  /**
   * `trackingTokenHash` is under a GLOBAL unique index (T-03-05), so the two
   * tenants must not collide — deriving it from `tenant.id` guarantees they
   * cannot.
   */
  Order: (tenant) => ({
    id: `${tenant.id}-order-1`,
    orderNumber: `${tenant.slug}-0001`,
    state: "ORDER_PLACED",
    channel: "MANUAL_TRANSFER",
    customerName: `${tenant.name} Customer`,
    customerPhone: "237600000000",
    deliveryAddress: null,
    customerNote: null,
    subtotalXaf: 5000,
    totalXaf: 5000,
    trackingTokenHash: `${tenant.id}-tracking-token-hash`,
    stockHeld: true,
    placedAt: FIXTURE_EPOCH,
    confirmedAt: null,
    updatedAt: FIXTURE_EPOCH,
  }),

  /**
   * `productId`/`variantId` are plain columns, not relations — the line item
   * records what was bought at the price charged, independent of any later
   * rename or reprice.
   */
  OrderItem: (tenant) => ({
    id: `${tenant.id}-order-item-1`,
    orderId: `${tenant.id}-order-1`,
    productId: `${tenant.id}-product-1`,
    variantId: `${tenant.id}-variant-1`,
    productName: `${tenant.name} Product`,
    variantLabel: "Default",
    unitPriceXaf: 5000,
    quantity: 1,
    lineTotalXaf: 5000,
    imageKey: null,
  }),

  /** The genesis event (ORD-05): `fromState` NULL, written by placeOrder. */
  OrderEvent: (tenant) => ({
    id: `${tenant.id}-order-event-1`,
    orderId: `${tenant.id}-order-1`,
    fromState: null,
    toState: "ORDER_PLACED",
    actor: "CUSTOMER",
    actorUserId: null,
    reason: null,
    createdAt: FIXTURE_EPOCH,
  }),

  /**
   * A DIFFERENT `referenceNormalized` per tenant, on purpose.
   *
   * ORD-04's constraint is `@@unique([tenantId, referenceNormalized])` — unique
   * WITHIN a tenant, not across the platform. Giving the two tenants distinct
   * references leaves a reference value unclaimed in both, so a later test can
   * insert the same one into each tenant and prove the constraint really is
   * tenant-led rather than global.
   */
  PaymentClaim: (tenant) => ({
    id: `${tenant.id}-payment-claim-1`,
    orderId: `${tenant.id}-order-1`,
    operator: "MTN_MOMO",
    reference: `${tenant.slug}-ref-0001`,
    referenceNormalized: normalizeReference(`${tenant.slug}-ref-0001`),
    amountClaimedXaf: 5000,
    screenshotKey: null,
    status: "PENDING",
    submittedAt: FIXTURE_EPOCH,
    reviewedAt: null,
    reviewedByUserId: null,
  }),

  /**
   * ONE ROW PER TENANT — `tenantId` is a single-field `@unique` here (D-14).
   * The isolation battery treats this model specially for that reason; see
   * `SINGLE_ROW_MODELS` in `tests/isolation/tenant-isolation.test.ts`.
   *
   * `mtnMerchantCode` NULL is the common case (D-15): most merchants are not
   * registered for MoMoPay, and the instructions must still work without it.
   */
  MerchantPaymentSettings: (tenant) => ({
    id: `${tenant.id}-payment-settings`,
    whatsappNumber:
      tenant.id === TENANT_A.id ? "237670000001" : "237690000002",
    mtnMomoNumber: tenant.id === TENANT_A.id ? "237670000001" : "237690000002",
    mtnMerchantCode: null,
    orangeMoneyNumber: null,
    orangeMerchantCode: null,
    codEnabled: true,
    payoutNotice: null,
    updatedAt: FIXTURE_EPOCH,
  }),

  /**
   * EDIT-01 / D-03. ONE ROW PER TENANT — `tenantId` is a single-field `@unique`
   * here for the same reason `MerchantPaymentSettings` above is, so the
   * isolation battery gives it the same `singleRowPerTenant` treatment.
   *
   * `publishedTokens` deliberately equals `draftTokens` and `publishedAt` is
   * set: the fixture represents an already-published theme with no pending
   * edits, which is the quiet baseline a test asserting "there ARE unpublished
   * changes" has to move away from before it means anything.
   *
   * `updatedAt` is set explicitly for the same byte-identity reason the
   * `Product` builder above documents — an implicit `@updatedAt` stamps
   * `now()` and makes two runs of the fixture differ.
   */
  StorefrontTheme: (tenant) => ({
    id: `${tenant.id}-storefront-theme`,
    templateKey: "flagship-fashion",
    logoKey: null,
    draftTokens: { primaryAccent: "#18181B", secondaryAccent: "#71717A" },
    publishedTokens: { primaryAccent: "#18181B", secondaryAccent: "#71717A" },
    publishedAt: FIXTURE_EPOCH,
    createdAt: FIXTURE_EPOCH,
    updatedAt: FIXTURE_EPOCH,
  }),

  /**
   * EDIT-01. One row per (tenant, pageType) — `@@unique([tenantId, pageType])`.
   * `"home"` is the only page type this phase ships.
   *
   * An EMPTY `sections` array is deliberate. This fixture exists to prove
   * tenant scoping, not document validity; plan 04-13's own isolation tests
   * seed real section trees. Keeping the document trivial here means a future
   * change to `pageDocumentSchema` cannot break the generic isolation battery.
   *
   * `draftUpdatedAt === publishedAt` is the "no unpublished changes" baseline,
   * matching the `StorefrontTheme` fixture above.
   */
  StorefrontPage: (tenant) => ({
    id: `${tenant.id}-storefront-page`,
    pageType: "home",
    draft: { version: 1, sections: [] },
    published: { version: 1, sections: [] },
    publishedAt: FIXTURE_EPOCH,
    draftUpdatedAt: FIXTURE_EPOCH,
    createdAt: FIXTURE_EPOCH,
  }),
};

/** `StoreSlugHistory` -> `storeSlugHistory`. */
export function delegateKeyFor(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * One client per connection string, reused across calls.
 *
 * The isolation suite rebuilds this fixture before every test, and opening a
 * fresh pool (TLS handshake to a remote Neon branch) dominated the runtime by a
 * wide margin — far more than the handful of statements the seed actually
 * issues. Reuse takes the suite from ~107s to roughly a third of that, and the
 * saving compounds as plans 01-05/01-06 add isolation files.
 *
 * `closeSeedClient` is the matching teardown, wired for every isolation test
 * file by `tests/setup/isolation-setup.ts`. Without it Vitest would hold an
 * open pool at the end of the run.
 */
let cached:
  | { url: string; db: PrismaClient; truncateSql?: string | null }
  | undefined;

/**
 * Prisma's default transaction timeout is 5000 ms, and the fixture outgrew it.
 *
 * The whole reseed is one `$transaction([...])` (see `seedTwoTenants`), and the
 * Rust-free client issues each statement in the array as its own round trip
 * inside the BEGIN/COMMIT. Phase 3 took the batch from 4 statements to 14, and
 * the `TRUNCATE` over 17 tables is itself not free — against a remote Neon
 * branch the whole thing lands around 6 s, which the 5 s default aborted with
 * "a commit cannot be executed on an expired transaction". It failed as a
 * scattering of unrelated-looking isolation tests, because whichever test
 * happened to own the slowest reseed was the one that reported it.
 *
 * Raised rather than worked around. Splitting the reseed into several smaller
 * transactions would trade a bounded, well-understood wait for a fixture that
 * can be left half-applied — and a half-applied fixture reads as a mysterious
 * isolation failure, which is exactly what the single-transaction design in
 * `seedTwoTenants` exists to prevent. 30 s stays comfortably under the
 * `hookTimeout: 60_000` that `vitest.config.ts` gives `beforeEach`, so a
 * genuine hang still surfaces as a hang.
 *
 * This is a TEST-FIXTURE setting and applies to no production client.
 */
const SEED_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 30_000 } as const;

function unscopedClientFor(connectionString: string): PrismaClient {
  if (cached && cached.url === connectionString) return cached.db;
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    transactionOptions: SEED_TRANSACTION_OPTIONS,
  });
  cached = { url: connectionString, db };
  return db;
}

/** Disconnect the cached seed client. Safe to call when there is none. */
export async function closeSeedClient(): Promise<void> {
  const current = cached;
  cached = undefined;
  if (current) await current.db.$disconnect();
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
async function truncateStatementFor(db: PrismaClient): Promise<string | null> {
  // Cached: the table list only changes when a migration runs, and migrations
  // run once in `globalSetup` — well before any reseed. Re-querying it before
  // every test would add a full round trip to a remote branch for an answer
  // that cannot have changed.
  if (cached?.truncateSql !== undefined) return cached.truncateSql;

  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;

  const quoted = rows
    .map((row) => `"public"."${row.tablename.replace(/"/g, '""')}"`)
    .join(", ");
  const sql =
    rows.length === 0
      ? null
      : `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`;

  if (cached) cached.truncateSql = sql;
  return sql;
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

  const db = unscopedClientFor(connectionString);
  const truncateSql = await truncateStatementFor(db);

  /*
   * Everything below is assembled as unawaited PrismaPromises and handed to a
   * single `$transaction([...])`.
   *
   * Two reasons, in order of importance:
   *   1. Atomicity — the fixture is either fully replaced or not touched. A
   *      reseed that failed halfway would leave later tests asserting against
   *      a half-truncated database, which reads as a mysterious isolation
   *      failure rather than as a broken fixture.
   *   2. Latency — Prisma sends a batch as one round trip. Against a remote
   *      Neon branch, with a reseed before every test in the project, the
   *      per-statement round trips dominated the suite's runtime.
   * Statements execute in array order, so the truncate must come first.
   */
  const batch: Prisma.PrismaPromise<unknown>[] = [];

  if (truncateSql) batch.push(db.$executeRawUnsafe(truncateSql));

  // `Organization` IS the tenant, so it is intentionally NOT in
  // TENANT_SCOPED_MODELS and is seeded explicitly.
  batch.push(
    db.organization.createMany({
      data: TENANTS.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        createdAt: FIXTURE_EPOCH,
        status: "active",
      })),
    }),
  );

  // User + Member exist so the fixture also exercises the Better Auth registry
  // tables that plan 01-06's signup test will read back.
  batch.push(
    db.user.createMany({
      data: TENANTS.map((tenant) => ({
        id: tenant.userId,
        name: `${tenant.name} Owner`,
        email: tenant.email,
        emailVerified: true,
        createdAt: FIXTURE_EPOCH,
        updatedAt: FIXTURE_EPOCH,
      })),
    }),
  );

  batch.push(
    db.member.createMany({
      data: TENANTS.map((tenant) => ({
        id: tenant.memberId,
        organizationId: tenant.id,
        userId: tenant.userId,
        role: "owner",
        createdAt: FIXTURE_EPOCH,
      })),
    }),
  );

  // One row per registered tenant-scoped model, per tenant. Driven by the
  // registry so Phase 3's Product/Order are covered the moment they are
  // registered (and loudly incomplete until a builder is added).
  //
  // ITERATION ORDER IS LOAD-BEARING. `TENANT_SCOPED_MODELS` is a `Set` built
  // from `REGISTERED_MODELS`, and a JS Set preserves insertion order — so this
  // loop appends statements in registry order. That array is deliberately kept
  // in composite-FK dependency order (Category -> Product -> variants/images,
  // Order -> items/events/claims) because Postgres checks foreign keys
  // immediately rather than at commit, so a child row batched ahead of its
  // parent aborts the whole fixture. No separate ordered list is maintained
  // here: a second copy of the order would be one more thing to drift.
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

    const delegate = (
      db as unknown as Record<
        string,
        | { createMany: (a: unknown) => Prisma.PrismaPromise<unknown> }
        | undefined
      >
    )[delegateKeyFor(model)];
    if (!delegate) {
      throw new Error(
        `seedTwoTenants: "${model}" is registered in TENANT_SCOPED_MODELS ` +
          `but the Prisma client exposes no "${delegateKeyFor(model)}" ` +
          "delegate. The registry and prisma/schema.prisma have drifted.",
      );
    }

    batch.push(
      delegate.createMany({
        // `tenantId` last: a builder can never cross-stamp a tenant.
        data: TENANTS.map((tenant) => ({
          ...build(tenant),
          tenantId: tenant.id,
        })),
      }),
    );
  }

  await db.$transaction(batch);
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
    })
    // The client is cached rather than per-call, so a one-shot CLI run has to
    // release it explicitly or the process hangs on an open pool.
    .finally(() => closeSeedClient());
}
