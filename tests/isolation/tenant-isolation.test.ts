import { beforeEach, describe, expect, it } from "vitest";

import { adminDb } from "@/server/db/admin";
import { scopedDb, TENANT_SCOPED_MODELS } from "@/server/db/tenant-scoped";

import {
  delegateKeyFor,
  seedTwoTenants,
  TENANT_A,
  TENANT_B,
} from "../setup/seed-two-tenants";

/**
 * The two-tenant isolation suite (TEN-02, TEN-05, TEN-07, TEN-08).
 *
 * This file is what turns "cross-tenant leakage is structurally impossible"
 * from a claim in a design document into a red-or-green signal against a real
 * Postgres. Everything here acts as tenant B against a database that also holds
 * tenant A's rows, and asserts that B can neither see nor touch them.
 *
 * IT IS DELIBERATELY MODEL-GENERIC. There are no per-model test bodies: the
 * suite iterates `TENANT_SCOPED_MODELS`, so the day Phase 3 registers `Product`
 * and `Order` they acquire this entire battery of assertions with no edit here.
 * A hand-written per-model suite would drift the first time somebody was in a
 * hurry, and the drift would be invisible — a model with no tests looks exactly
 * like a model that passes.
 *
 * Reading a failure: `expected "tenant-b-fixed-id", received "tenant-a-fixed-id"`
 * means tenant A's data reached a tenant B caller. That is a production-severity
 * finding, not a flaky test.
 */

type Row = Record<string, unknown>;

/**
 * A structurally typed view of a Prisma model delegate.
 *
 * The suite addresses delegates by a string key computed from the registry, so
 * it cannot use Prisma's generated per-model types (they are only reachable
 * through a literal property access). This interface keeps the call sites typed
 * without reaching for `any`.
 */
interface Delegate {
  findMany: (args?: unknown) => Promise<Row[]>;
  findUnique: (args: unknown) => Promise<Row | null>;
  findUniqueOrThrow: (args: unknown) => Promise<Row>;
  findFirst: (args: unknown) => Promise<Row | null>;
  findFirstOrThrow: (args: unknown) => Promise<Row>;
  create: (args: unknown) => Promise<Row>;
  createMany: (args: unknown) => Promise<{ count: number }>;
  createManyAndReturn: (args: unknown) => Promise<Row[]>;
  update: (args: unknown) => Promise<Row>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
  upsert: (args: unknown) => Promise<Row>;
  delete: (args: unknown) => Promise<Row>;
  deleteMany: (args?: unknown) => Promise<{ count: number }>;
  count: (args?: unknown) => Promise<number>;
  aggregate: (args: unknown) => Promise<Record<string, unknown>>;
  groupBy: (args: unknown) => Promise<Row[]>;
}

function delegateOf(client: unknown, key: string): Delegate {
  const delegate = (client as Record<string, Delegate | undefined>)[key];
  if (!delegate) {
    throw new Error(
      `No Prisma delegate "${key}" on this client — TENANT_SCOPED_MODELS and ` +
        "prisma/schema.prisma have drifted.",
    );
  }
  return delegate;
}

/**
 * Per-model payloads.
 *
 * Required columns cannot be invented generically, so each registered model
 * contributes a row builder and a harmless mutation. The test LOOP stays driven
 * by `TENANT_SCOPED_MODELS`; this map only supplies data. Registering a model
 * without adding an entry fails loudly and says what to do, which is the
 * correct failure mode — a generic fallback would silently test nothing.
 */
interface ModelProbe {
  /** A complete row for a NEW record. Must be unique per `nonce`. */
  newRow: (nonce: string) => Row;
  /** A field mutation that touches no unique constraint. */
  mutation: () => Row;
}

const MODEL_PROBES: Record<string, ModelProbe> = {
  StoreSlugHistory: {
    // `slug` is globally unique (DOM-02), so every probe row needs its own.
    newRow: (nonce) => ({ id: `probe-${nonce}`, slug: `probe-${nonce}` }),
    // `releasedAt` is nullable and carries no constraint — the safest field to
    // scribble on when the assertion is about WHICH rows changed, not what to.
    mutation: () => ({ releasedAt: new Date("2030-06-01T00:00:00.000Z") }),
  },
};

function probeFor(model: string): ModelProbe {
  const probe = MODEL_PROBES[model];
  if (!probe) {
    throw new Error(
      `No isolation probe registered for "${model}".\n` +
        "Adding a model to TENANT_SCOPED_MODELS also means adding an entry to " +
        "MODEL_PROBES in tests/isolation/tenant-isolation.test.ts, or the model " +
        "would be registered as tenant-scoped with nothing proving that it is.",
    );
  }
  return probe;
}

let nonceCounter = 0;
const nextNonce = () => `${Date.now().toString(36)}-${++nonceCounter}`;

/** Read a tenant's rows through the deliberately unscoped admin client. */
async function adminRowsFor(key: string, tenantId: string): Promise<Row[]> {
  return delegateOf(adminDb, key).findMany({ where: { tenantId } });
}

async function adminRowFor(key: string, tenantId: string): Promise<Row> {
  const rows = await adminRowsFor(key, tenantId);
  if (rows.length !== 1) {
    throw new Error(
      `Fixture invariant broken: expected exactly 1 ${key} row for ${tenantId}, ` +
        `found ${rows.length}.`,
    );
  }
  return rows[0] as Row;
}

// Every test mutates, so the fixture is rebuilt before each one. `globalSetup`
// seeds once for the file; this keeps tests independent of execution order.
beforeEach(async () => {
  await seedTwoTenants();
});

const REGISTERED_MODELS = [...TENANT_SCOPED_MODELS];

for (const model of REGISTERED_MODELS) {
  const key = delegateKeyFor(model);

  describe(`${model} — tenant B cannot reach tenant A`, () => {
    it("findMany returns only tenant B rows", async () => {
      const rows = await delegateOf(scopedDb(TENANT_B.id), key).findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.tenantId).toBe(TENANT_B.id);
    });

    it("findUnique on a tenant-A id returns null", async () => {
      const rowA = await adminRowFor(key, TENANT_A.id);
      // Exercises the `extendedWhereUnique` path specifically. The stale
      // "rewrite findUnique into findFirst" advice would have broken this, and
      // the rewrite is exactly what `tenant-scoped.ts` refuses to do.
      const found = await delegateOf(scopedDb(TENANT_B.id), key).findUnique({
        where: { id: rowA.id },
      });
      expect(found).toBeNull();
    });

    it("findFirst on a tenant-A id returns null", async () => {
      const rowA = await adminRowFor(key, TENANT_A.id);
      const found = await delegateOf(scopedDb(TENANT_B.id), key).findFirst({
        where: { id: rowA.id },
      });
      expect(found).toBeNull();
    });

    it("update on a tenant-A id leaves the row byte-unchanged", async () => {
      const before = await adminRowFor(key, TENANT_A.id);
      await expect(
        delegateOf(scopedDb(TENANT_B.id), key).update({
          where: { id: before.id },
          data: probeFor(model).mutation(),
        }),
      ).rejects.toThrow();

      // Re-read through the unscoped client. Asserting only that the call
      // rejected would pass even if the write had landed and the error came
      // from something afterwards.
      expect(await adminRowFor(key, TENANT_A.id)).toEqual(before);
    });

    it("delete on a tenant-A id leaves the row present and unchanged", async () => {
      const before = await adminRowFor(key, TENANT_A.id);
      await expect(
        delegateOf(scopedDb(TENANT_B.id), key).delete({
          where: { id: before.id },
        }),
      ).rejects.toThrow();

      expect(await adminRowFor(key, TENANT_A.id)).toEqual(before);
    });

    it("updateMany and deleteMany never touch tenant A", async () => {
      const before = await adminRowFor(key, TENANT_A.id);
      const asB = delegateOf(scopedDb(TENANT_B.id), key);

      // Deliberately unfiltered: no `where` at all. This is the shape that
      // leaks everything if the extension only handles where-bearing calls.
      const updated = await asB.updateMany({ data: probeFor(model).mutation() });
      expect(updated.count).toBe(1);
      expect(await adminRowFor(key, TENANT_A.id)).toEqual(before);

      const deleted = await asB.deleteMany({});
      expect(deleted.count).toBe(1);

      // Tenant A survives a `deleteMany` that named no rows at all.
      expect(await adminRowFor(key, TENANT_A.id)).toEqual(before);
      expect(await adminRowsFor(key, TENANT_B.id)).toHaveLength(0);
    });

    it("count, aggregate and groupBy exclude tenant A", async () => {
      const asB = delegateOf(scopedDb(TENANT_B.id), key);

      expect(await asB.count()).toBe(1);

      // `aggregate` and `groupBy` arrive with NO `where` key whatsoever, so
      // these two assertions cover the case an extension that only rewrote an
      // existing `where` would silently leak.
      const aggregated = await asB.aggregate({ _count: { _all: true } });
      expect((aggregated._count as { _all: number })._all).toBe(1);

      const grouped = await asB.groupBy({
        by: ["tenantId"],
        _count: { _all: true },
      });
      expect(grouped).toHaveLength(1);
      expect(grouped[0]?.tenantId).toBe(TENANT_B.id);
    });

    it("create ignores client-supplied tenantId and stores the row under B", async () => {
      const nonce = nextNonce();
      const created = await delegateOf(scopedDb(TENANT_B.id), key).create({
        data: {
          ...probeFor(model).newRow(nonce),
          // A hostile (or merely buggy) caller naming another tenant. TEN-08
          // and CLAUDE.md C-2: the extension OVERWRITES, it does not merge.
          tenantId: TENANT_A.id,
        },
      });

      expect(created.tenantId).toBe(TENANT_B.id);

      // Confirm at rest, not just in the returned object.
      const atRest = await delegateOf(adminDb, key).findUnique({
        where: { id: created.id },
      });
      expect(atRest?.tenantId).toBe(TENANT_B.id);
      expect(await adminRowsFor(key, TENANT_A.id)).toHaveLength(1);
    });

    it("upsert cannot resurrect a tenant-A row", async () => {
      const before = await adminRowFor(key, TENANT_A.id);
      const nonce = nextNonce();

      const result = await delegateOf(scopedDb(TENANT_B.id), key).upsert({
        // Keyed on tenant A's unique selector. With `tenantId: B` injected into
        // `where`, this must miss — and fall through to `create` as a B-owned
        // row rather than updating A's.
        where: { id: before.id },
        update: probeFor(model).mutation(),
        create: probeFor(model).newRow(nonce),
      });

      expect(result.tenantId).toBe(TENANT_B.id);
      expect(result.id).not.toBe(before.id);
      expect(await adminRowFor(key, TENANT_A.id)).toEqual(before);
    });

    it("injects tenantId into every intercepted Prisma operation", async () => {
      // Behavioural coverage of the full interception table, one assertion per
      // operation. Asserting on observable results rather than on captured
      // `args` is deliberate: it proves the predicate reached SQL, and it stays
      // true if `tenant-scoped.ts` ever changes how it builds the arguments.
      const failures: string[] = [];
      const check = (operation: string, ok: boolean, detail: string) => {
        if (!ok) failures.push(`${operation}: ${detail}`);
      };

      const asB = delegateOf(scopedDb(TENANT_B.id), key);
      const rowA = await adminRowFor(key, TENANT_A.id);
      const probe = probeFor(model);

      check(
        "findUnique",
        (await asB.findUnique({ where: { id: rowA.id } })) === null,
        "returned tenant A's row",
      );

      let threw = false;
      try {
        await asB.findUniqueOrThrow({ where: { id: rowA.id } });
      } catch {
        threw = true;
      }
      check("findUniqueOrThrow", threw, "resolved tenant A's row");

      check(
        "findFirst",
        (await asB.findFirst({ where: { id: rowA.id } })) === null,
        "returned tenant A's row",
      );

      threw = false;
      try {
        await asB.findFirstOrThrow({ where: { id: rowA.id } });
      } catch {
        threw = true;
      }
      check("findFirstOrThrow", threw, "resolved tenant A's row");

      const many = await asB.findMany();
      check(
        "findMany",
        many.every((row) => row.tenantId === TENANT_B.id),
        "returned foreign rows",
      );

      check("count", (await asB.count()) === 1, "counted tenant A");

      const agg = await asB.aggregate({ _count: { _all: true } });
      check(
        "aggregate",
        (agg._count as { _all: number })._all === 1,
        "aggregated tenant A",
      );

      const grouped = await asB.groupBy({ by: ["tenantId"] });
      check(
        "groupBy",
        grouped.length === 1 && grouped[0]?.tenantId === TENANT_B.id,
        "grouped across tenants",
      );

      const created = await asB.create({ data: probe.newRow(nextNonce()) });
      check("create", created.tenantId === TENANT_B.id, "stamped the wrong tenant");

      const madeMany = await asB.createMany({
        data: [probe.newRow(nextNonce()), probe.newRow(nextNonce())],
      });
      check("createMany", madeMany.count === 2, "did not insert both rows");

      const returned = await asB.createManyAndReturn({
        data: [probe.newRow(nextNonce())],
      });
      check(
        "createManyAndReturn",
        returned.every((row) => row.tenantId === TENANT_B.id),
        "stamped the wrong tenant",
      );

      const updatedOwn = await asB.update({
        where: { id: created.id },
        data: probe.mutation(),
      });
      check("update", updatedOwn.tenantId === TENANT_B.id, "escaped the tenant");

      const upserted = await asB.upsert({
        where: { id: created.id },
        update: probe.mutation(),
        create: probe.newRow(nextNonce()),
      });
      check("upsert", upserted.tenantId === TENANT_B.id, "escaped the tenant");

      const bulkUpdated = await asB.updateMany({ data: probe.mutation() });
      check(
        "updateMany",
        bulkUpdated.count === (await adminRowsFor(key, TENANT_B.id)).length,
        "touched a different number of rows than tenant B owns",
      );

      const deletedOne = await asB.delete({ where: { id: created.id } });
      check("delete", deletedOne.tenantId === TENANT_B.id, "escaped the tenant");

      const bulkDeleted = await asB.deleteMany({});
      check("deleteMany", bulkDeleted.count >= 1, "deleted nothing");

      // The whole point: after every write operation above ran unfiltered as
      // tenant B, tenant A must still own exactly its original row.
      const survivingA = await adminRowsFor(key, TENANT_A.id);
      check(
        "tenant A survives the full operation sweep",
        survivingA.length === 1 && survivingA[0]?.id === rowA.id,
        `tenant A now has ${survivingA.length} row(s)`,
      );

      expect(failures).toEqual([]);
    });
  });
}

describe("the tenant boundary itself", () => {
  const firstModel = REGISTERED_MODELS[0] as string;
  const firstKey = delegateKeyFor(firstModel);

  it("adminDb sees both tenants where scopedDb sees one", async () => {
    // TEN-05. If this ever fails by returning one row, `adminDb` has silently
    // become a renamed `scopedDb` and the platform-admin surface has no way to
    // see the platform.
    const all = await delegateOf(adminDb, firstKey).findMany({
      orderBy: { tenantId: "asc" },
    });
    expect(all.map((row) => row.tenantId)).toEqual([TENANT_A.id, TENANT_B.id]);

    const asB = await delegateOf(scopedDb(TENANT_B.id), firstKey).findMany();
    expect(asB).toHaveLength(1);
    expect(asB[0]?.tenantId).toBe(TENANT_B.id);
  });

  it("$transaction inside scopedDb stays scoped", async () => {
    /*
     * RESEARCH.md assumption A1 — the highest-risk unverified claim in the
     * phase, settled here against a real Postgres.
     *
     * Prisma client extensions hook the client's operation layer, and the
     * `tx` handed to an interactive transaction callback is a *different*
     * object from the client it was opened on. If the extension did not follow
     * it, every transactional write in Phases 3-6 would run unscoped while
     * looking completely ordinary at the call site.
     *
     * If this test fails: STOP. `scopedDb` must grow its own `$transaction`
     * wrapper before any transactional code is written.
     */
    const asB = scopedDb(TENANT_B.id);

    const { created, visible } = await asB.$transaction(async (tx) => {
      const row = await delegateOf(tx, firstKey).create({
        data: probeFor(firstModel).newRow(nextNonce()),
      });
      const rows = await delegateOf(tx, firstKey).findMany();
      return { created: row, visible: rows };
    });

    // The write was stamped with B inside the transaction...
    expect(created.tenantId).toBe(TENANT_B.id);
    // ...and the read inside the transaction never saw tenant A.
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((row) => row.tenantId === TENANT_B.id)).toBe(true);
    // ...and it is still B's after the transaction commits.
    const atRest = await delegateOf(adminDb, firstKey).findUnique({
      where: { id: created.id },
    });
    expect(atRest?.tenantId).toBe(TENANT_B.id);
    expect(await adminRowsFor(firstKey, TENANT_A.id)).toHaveLength(1);
  });

  it("throws rather than running unscoped for an unregistered model", async () => {
    /*
     * The negative control, and arguably the most important test in the file.
     *
     * `Organization` IS the tenant, so it has no `tenantId` and is correctly
     * absent from the registry. The failure mode this guards is not "the query
     * errors" — it is `scopedDb` quietly executing UNSCOPED against a model
     * nobody registered, which looks like a working query and returns every
     * tenant's data.
     */
    const asB = scopedDb(TENANT_B.id);

    await expect(asB.organization.findMany()).rejects.toThrow(
      /not a tenant-scoped model/,
    );
    // The message must route the reader to the correct client, or the likely
    // "fix" is to add Organization to the registry and break everything.
    await expect(asB.organization.findMany()).rejects.toThrow(/platformDb/);
    await expect(asB.organization.findMany()).rejects.toThrow(/adminDb/);

    // And the unscoped path still works, proving the throw is about the
    // boundary rather than about the model being unreadable.
    expect(await adminDb.organization.count()).toBe(2);
  });

  it("rejects an empty tenantId instead of scoping to nothing", async () => {
    expect(() => scopedDb("")).toThrow(/tenantId is required/);
  });
});
