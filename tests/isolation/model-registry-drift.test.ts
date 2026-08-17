import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { TENANT_SCOPED_MODELS } from "@/server/db/tenant-scoped";

/**
 * The schema-drift guard (TEN-01, TEN-02).
 *
 * `tests/isolation/tenant-isolation.test.ts` proves that every REGISTERED model
 * is isolated. It cannot prove anything about a model nobody registered — and
 * that is the realistic failure. Phase 3 adds `Product` with a `tenantId`
 * column, the registry edit is forgotten, and the isolation suite stays green
 * while an entire table sits outside the boundary. Nothing else in the system
 * notices: `scopedDb` throws on first use, but only if some code path happens
 * to reach for it through `scopedDb` rather than `platformDb`.
 *
 * This one test closes that direction by deriving the truth from the schema
 * instead of trusting the list: every model whose scalar fields include
 * `tenantId` must appear in `TENANT_SCOPED_MODELS`, and nothing else may.
 *
 * IMPLEMENTATION NOTE — DO NOT REACH FOR THE `dmmf` EXPORT. Runtime model
 * introspection via that export is what every pre-Prisma-7 example does, and it
 * was REMOVED from the Prisma 7 generated client. `Prisma.ModelName` and
 * `Prisma.<Model>ScalarFieldEnum` are the supported replacements, and both are
 * verified present on 7.9.1. The first test below pins that absence so the
 * reason this file looks unusual stays documented by an assertion rather than
 * by a comment alone.
 */

/**
 * `Prisma` is a namespace of generated constants; the per-model
 * `<Model>ScalarFieldEnum` members can only be reached by computed key, which
 * the generated types do not describe. One narrow cast, used read-only.
 */
const meta = Prisma as unknown as Record<string, Record<string, string>>;

function allModelNames(): string[] {
  return Object.keys(meta.ModelName ?? {});
}

function scalarFieldsOf(model: string): string[] {
  return Object.keys(meta[`${model}ScalarFieldEnum`] ?? {});
}

describe("tenant-scoped model registry", () => {
  it("does not depend on the dmmf export that Prisma 7 removed", () => {
    // If this ever starts failing, Prisma reintroduced `dmmf` and the guard
    // below could be simplified — but until then, its absence is why this file
    // introspects the way it does.
    expect("dmmf" in (Prisma as object)).toBe(false);
    expect(allModelNames().length).toBeGreaterThan(0);
  });

  it("registers every model that has a tenantId column", () => {
    const withTenantId = allModelNames()
      .filter((model) => scalarFieldsOf(model).includes("tenantId"))
      .sort();
    const registered = [...TENANT_SCOPED_MODELS].sort();

    const unregistered = withTenantId.filter((m) => !registered.includes(m));
    const stale = registered.filter((m) => !withTenantId.includes(m));

    expect(
      withTenantId,
      [
        "TENANT_SCOPED_MODELS has drifted from prisma/schema.prisma.",
        unregistered.length > 0
          ? `\n  MISSING from the registry: ${unregistered.join(", ")}\n` +
            "  These models carry a tenantId column but are NOT tenant-scoped " +
            "at runtime, so nothing injects a tenant predicate into queries " +
            "against them. Add each one to TENANT_SCOPED_MODELS in " +
            "src/server/db/tenant-scoped.ts, and add a fixture row builder to " +
            "tests/setup/seed-two-tenants.ts plus a probe to " +
            "tests/isolation/tenant-isolation.test.ts so the isolation suite " +
            "actually covers them."
          : "",
        stale.length > 0
          ? `\n  REGISTERED but has no tenantId column: ${stale.join(", ")}\n` +
            "  scopedDb would inject tenantId into a column that does not " +
            "exist, so every query against these models fails. Remove them " +
            "from TENANT_SCOPED_MODELS, or add the column to the schema."
          : "",
      ]
        .filter(Boolean)
        .join(""),
    ).toEqual(registered);
  });

  it("registers no model the generated client does not define", () => {
    // Catches a registry entry that survived a model rename — the compile-time
    // `Prisma.ModelName[]` typing catches this too, but only while the registry
    // stays typed. Belt and braces on the guarantee that matters most.
    const known = allModelNames();
    for (const model of TENANT_SCOPED_MODELS) {
      expect(
        known,
        `"${model}" is in TENANT_SCOPED_MODELS but is not a model in the ` +
          "generated Prisma client.",
      ).toContain(model);
    }
  });
});
