import { describe, expect, it } from "vitest";

import {
  MissingTestDatabaseError,
  requireTestDatabaseUrl,
} from "../setup/global-setup";

/**
 * Guards the isolation harness itself.
 *
 * This file also has a structural job: Vitest skips `globalSetup` entirely when
 * no test file matches a project's `include`. Without at least one file here,
 * the isolation project would silently exit 0 with no database configured, and
 * the fail-closed guarantee below would be unverifiable.
 *
 * The tenant-isolation suites proper arrive in plan 01-04.
 */
describe("isolation harness", () => {
  it("refuses to run without TEST_DATABASE_URL", () => {
    const original = process.env.TEST_DATABASE_URL;
    try {
      delete process.env.TEST_DATABASE_URL;
      expect(() => requireTestDatabaseUrl()).toThrow(MissingTestDatabaseError);
      expect(() => requireTestDatabaseUrl()).toThrow(/TEST_DATABASE_URL/);
      expect(() => requireTestDatabaseUrl()).toThrow(/\.env\.test/);
    } finally {
      if (original !== undefined) {
        process.env.TEST_DATABASE_URL = original;
      }
    }
  });

  it("treats a blank TEST_DATABASE_URL as missing, not as a valid value", () => {
    const original = process.env.TEST_DATABASE_URL;
    try {
      process.env.TEST_DATABASE_URL = "   ";
      expect(() => requireTestDatabaseUrl()).toThrow(MissingTestDatabaseError);
    } finally {
      if (original === undefined) {
        delete process.env.TEST_DATABASE_URL;
      } else {
        process.env.TEST_DATABASE_URL = original;
      }
    }
  });

  it("never falls back to the development DATABASE_URL", () => {
    const originalTest = process.env.TEST_DATABASE_URL;
    const originalDev = process.env.DATABASE_URL;
    try {
      delete process.env.TEST_DATABASE_URL;
      process.env.DATABASE_URL = "postgresql://dev:dev@localhost:5432/dev";
      // A truncate-and-seed suite pointed at the dev database is the failure
      // mode this assertion exists to prevent.
      expect(() => requireTestDatabaseUrl()).toThrow(MissingTestDatabaseError);
    } finally {
      if (originalTest !== undefined) {
        process.env.TEST_DATABASE_URL = originalTest;
      }
      if (originalDev === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDev;
      }
    }
  });
});
