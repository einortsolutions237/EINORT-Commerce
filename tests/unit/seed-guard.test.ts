import { describe, expect, it } from "vitest";

import {
  UnsafeSeedTargetError,
  assertSafeSeedTarget,
  delegateKeyFor,
  resolveSeedTargetUrl,
  TENANT_A,
  TENANT_B,
} from "../setup/seed-two-tenants";

/**
 * Regression cover for the guard standing between a test run and the
 * irreversible loss of the development database (threat T-01-27).
 *
 * This lives in the `unit` project on purpose: it must run on every task commit
 * (the fast gate), not only when a test database happens to be configured. It
 * touches no database — `assertSafeSeedTarget` is pure string analysis.
 *
 * The interesting property is that these are all *refusals*. A guard is only
 * worth having if it has been observed saying no, so each layer is asserted
 * against a connection string that must be rejected, rather than by reading the
 * implementation and believing it.
 */

const NEON = "c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const TEST_ENDPOINT = `postgresql://u:p@ep-sweet-shape-za5xwdvh.${NEON}`;

describe("seed target guard", () => {
  it("refuses an endpoint that is not on the test allowlist", () => {
    expect(() =>
      assertSafeSeedTarget(`postgresql://u:p@ep-some-other-branch-00000.${NEON}`),
    ).toThrow(UnsafeSeedTargetError);
    expect(() =>
      assertSafeSeedTarget(`postgresql://u:p@ep-some-other-branch-00000.${NEON}`),
    ).toThrow(/not a known test endpoint/);
  });

  it("refuses a connection string whose target cannot be identified", () => {
    expect(() => assertSafeSeedTarget("not-a-url")).toThrow(
      /not a parseable URL/,
    );
  });

  it("never falls back to DATABASE_URL when TEST_DATABASE_URL is absent", () => {
    const originalTest = process.env.TEST_DATABASE_URL;
    const originalDev = process.env.DATABASE_URL;
    try {
      delete process.env.TEST_DATABASE_URL;
      process.env.DATABASE_URL = TEST_ENDPOINT;
      // Even with a *valid test* URL sitting in DATABASE_URL, the resolver must
      // refuse: silently accepting whatever DATABASE_URL holds is exactly how a
      // truncate-and-reseed ends up pointed at development.
      expect(() => resolveSeedTargetUrl()).toThrow(UnsafeSeedTargetError);
      expect(() => resolveSeedTargetUrl()).toThrow(/TEST_DATABASE_URL is not set/);
    } finally {
      if (originalTest === undefined) delete process.env.TEST_DATABASE_URL;
      else process.env.TEST_DATABASE_URL = originalTest;
      if (originalDev === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDev;
    }
  });

  it("treats a blank TEST_DATABASE_URL as missing", () => {
    expect(() => resolveSeedTargetUrl("   ")).toThrow(UnsafeSeedTargetError);
  });

  it("normalises Neon's -pooler suffix so pooled and direct are one endpoint", () => {
    // Neon serves each branch on two hostnames differing only by `-pooler`.
    // If the guard compared raw hosts, the pooled development URL would look
    // like a different database from the direct one and slip past the denylist.
    const pooled = `postgresql://u:p@ep-sweet-shape-za5xwdvh-pooler.${NEON}`;
    // Both forms of the allowlisted test endpoint must be accepted identically.
    expect(() => assertSafeSeedTarget(pooled)).not.toThrow();
    expect(() => assertSafeSeedTarget(TEST_ENDPOINT)).not.toThrow();
  });

  it("honours a TEST_DATABASE_ENDPOINTS override for a recreated branch", () => {
    const original = process.env.TEST_DATABASE_ENDPOINTS;
    try {
      process.env.TEST_DATABASE_ENDPOINTS = "ep-rebuilt-branch-12345";
      expect(() =>
        assertSafeSeedTarget(`postgresql://u:p@ep-rebuilt-branch-12345.${NEON}`),
      ).not.toThrow();
      // The override replaces the default list rather than extending it, so the
      // previously allowed endpoint is now refused.
      expect(() => assertSafeSeedTarget(TEST_ENDPOINT)).toThrow(
        UnsafeSeedTargetError,
      );
    } finally {
      if (original === undefined) delete process.env.TEST_DATABASE_ENDPOINTS;
      else process.env.TEST_DATABASE_ENDPOINTS = original;
    }
  });
});

describe("two-tenant fixture identities", () => {
  it("gives the two tenants distinct, fixed, recognisable identities", () => {
    expect(TENANT_A.id).not.toBe(TENANT_B.id);
    expect(TENANT_A.slug).not.toBe(TENANT_B.slug);
    // Fixed, not random: a failing isolation assertion should name a tenant.
    expect(TENANT_A.id).toBe("tenant-a-fixed-id");
    expect(TENANT_B.id).toBe("tenant-b-fixed-id");
  });

  it("derives the Prisma delegate key from a model name", () => {
    expect(delegateKeyFor("StoreSlugHistory")).toBe("storeSlugHistory");
    expect(delegateKeyFor("Product")).toBe("product");
  });
});
