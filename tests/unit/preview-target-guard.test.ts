import { describe, expect, it } from "vitest";

import {
  UnsafePreviewTargetError,
  assertSafePreviewTarget,
  resolvePreviewStoreSlug,
} from "../../scripts/template-preview-target";

/**
 * Regression cover for the guard standing between
 * `npm run templates:previews` and somebody's real store
 * (T-05.1-08 .. T-05.1-10).
 *
 * This lives in the `unit` project on purpose: it must run on every task
 * commit (the fast gate), not only when a scratch store happens to exist.
 * It touches no database — both guard functions are pure.
 *
 * The interesting property is that these are all *refusals*. A guard is
 * only worth having if it has been observed saying no, so each layer is
 * asserted against an input that must be rejected, rather than by reading
 * the implementation and believing it. Exactly one test (the "returns
 * cleanly" case) is the negative control that proves the guard can also
 * say yes.
 */

const ACTIONABLE = /TEMPLATE_PREVIEW_STORE_SLUG|\.env\.local/;

describe("resolvePreviewStoreSlug", () => {
  it("refuses when TEMPLATE_PREVIEW_STORE_SLUG is unset", () => {
    const original = process.env.TEMPLATE_PREVIEW_STORE_SLUG;
    try {
      delete process.env.TEMPLATE_PREVIEW_STORE_SLUG;
      expect(() => resolvePreviewStoreSlug()).toThrow(UnsafePreviewTargetError);
      expect(() => resolvePreviewStoreSlug()).toThrow(
        /TEMPLATE_PREVIEW_STORE_SLUG is not set/,
      );
    } finally {
      if (original === undefined) delete process.env.TEMPLATE_PREVIEW_STORE_SLUG;
      else process.env.TEMPLATE_PREVIEW_STORE_SLUG = original;
    }
  });

  it("never falls back to another variable when unset", () => {
    const originalSlug = process.env.TEMPLATE_PREVIEW_STORE_SLUG;
    const originalRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    const originalDb = process.env.DATABASE_URL;
    const originalDecoy = process.env.STORE_SLUG;
    try {
      delete process.env.TEMPLATE_PREVIEW_STORE_SLUG;
      // Decoys: a real-looking root domain, a real-looking database URL, and
      // a plausibly-named but wrong variable. None of these may be read.
      process.env.NEXT_PUBLIC_ROOT_DOMAIN = "localhost:3000";
      process.env.DATABASE_URL =
        "postgresql://u:p@ep-decoy-00000.eu-west-2.aws.neon.tech/neondb";
      process.env.STORE_SLUG = "einort-preview";
      expect(() => resolvePreviewStoreSlug()).toThrow(UnsafePreviewTargetError);
      expect(() => resolvePreviewStoreSlug()).toThrow(
        /TEMPLATE_PREVIEW_STORE_SLUG is not set/,
      );
    } finally {
      if (originalSlug === undefined) delete process.env.TEMPLATE_PREVIEW_STORE_SLUG;
      else process.env.TEMPLATE_PREVIEW_STORE_SLUG = originalSlug;
      if (originalRoot === undefined) delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
      else process.env.NEXT_PUBLIC_ROOT_DOMAIN = originalRoot;
      if (originalDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDb;
      if (originalDecoy === undefined) delete process.env.STORE_SLUG;
      else process.env.STORE_SLUG = originalDecoy;
    }
  });

  it("treats a blank TEMPLATE_PREVIEW_STORE_SLUG as missing", () => {
    expect(() => resolvePreviewStoreSlug("   ")).toThrow(UnsafePreviewTargetError);
    expect(() => resolvePreviewStoreSlug("   ")).toThrow(
      /TEMPLATE_PREVIEW_STORE_SLUG is not set/,
    );
  });

  it("refuses a slug that violates the store-slug rule", () => {
    const malformed = ["Preview Store", "-lead", "trail-", "UPPER"];
    for (const candidate of malformed) {
      expect(
        () => resolvePreviewStoreSlug(candidate),
        `expected "${candidate}" to be refused`,
      ).toThrow(UnsafePreviewTargetError);
    }
  });

  it("returns a valid slug trimmed and unchanged", () => {
    expect(resolvePreviewStoreSlug("  einort-preview  ")).toBe("einort-preview");
    expect(resolvePreviewStoreSlug("einort-preview")).toBe("einort-preview");
  });
});

describe("assertSafePreviewTarget", () => {
  it("refuses a slug that does not match the configured target, naming both", () => {
    let error: unknown;
    try {
      assertSafePreviewTarget({
        slug: "some-real-shop",
        configuredSlug: "einort-preview",
        orderCount: 0,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(UnsafePreviewTargetError);
    const message = (error as Error).message;
    expect(message).toContain("some-real-shop");
    expect(message).toContain("einort-preview");
  });

  it("refuses a store that has orders, naming the order count", () => {
    let error: unknown;
    try {
      assertSafePreviewTarget({
        slug: "einort-preview",
        configuredSlug: "einort-preview",
        orderCount: 1,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(UnsafePreviewTargetError);
    const message = (error as Error).message;
    expect(message).toMatch(/real business/);
    expect(message).toContain("1");
  });

  it("returns without throwing for the one safe configuration", () => {
    expect(() =>
      assertSafePreviewTarget({
        slug: "einort-preview",
        configuredSlug: "einort-preview",
        orderCount: 0,
      }),
    ).not.toThrow();
  });
});

describe("every refusal", () => {
  it("throws UnsafePreviewTargetError with the correct name, not just Error", () => {
    const original = process.env.TEMPLATE_PREVIEW_STORE_SLUG;
    try {
      delete process.env.TEMPLATE_PREVIEW_STORE_SLUG;
      try {
        resolvePreviewStoreSlug();
        expect.unreachable("resolvePreviewStoreSlug should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(UnsafePreviewTargetError);
        expect((error as Error).name).toBe("UnsafePreviewTargetError");
      }
    } finally {
      if (original === undefined) delete process.env.TEMPLATE_PREVIEW_STORE_SLUG;
      else process.env.TEMPLATE_PREVIEW_STORE_SLUG = original;
    }

    try {
      assertSafePreviewTarget({
        slug: "wrong-shop",
        configuredSlug: "einort-preview",
        orderCount: 0,
      });
      expect.unreachable("assertSafePreviewTarget should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsafePreviewTargetError);
      expect((error as Error).name).toBe("UnsafePreviewTargetError");
    }

    try {
      assertSafePreviewTarget({
        slug: "einort-preview",
        configuredSlug: "einort-preview",
        orderCount: 3,
      });
      expect.unreachable("assertSafePreviewTarget should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsafePreviewTargetError);
      expect((error as Error).name).toBe("UnsafePreviewTargetError");
    }
  });

  it("names an actionable remediation in every refusal message", () => {
    const original = process.env.TEMPLATE_PREVIEW_STORE_SLUG;
    const messages: string[] = [];

    try {
      delete process.env.TEMPLATE_PREVIEW_STORE_SLUG;
      try {
        resolvePreviewStoreSlug();
      } catch (error) {
        messages.push((error as Error).message);
      }
    } finally {
      if (original === undefined) delete process.env.TEMPLATE_PREVIEW_STORE_SLUG;
      else process.env.TEMPLATE_PREVIEW_STORE_SLUG = original;
    }

    try {
      resolvePreviewStoreSlug("   ");
    } catch (error) {
      messages.push((error as Error).message);
    }

    try {
      resolvePreviewStoreSlug("UPPER");
    } catch (error) {
      messages.push((error as Error).message);
    }

    try {
      assertSafePreviewTarget({
        slug: "wrong-shop",
        configuredSlug: "einort-preview",
        orderCount: 0,
      });
    } catch (error) {
      messages.push((error as Error).message);
    }

    try {
      assertSafePreviewTarget({
        slug: "einort-preview",
        configuredSlug: "einort-preview",
        orderCount: 2,
      });
    } catch (error) {
      messages.push((error as Error).message);
    }

    expect(messages.length).toBeGreaterThanOrEqual(5);
    for (const message of messages) {
      expect(message).toMatch(ACTIONABLE);
    }
  });
});
