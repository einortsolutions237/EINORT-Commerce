import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  derivativePrefixFor,
  isAllowedContentType,
  objectKeyFor,
  type UploadKind,
} from "@/server/images/r2";

/**
 * CAT-02 / T-03-23 — the object key IS the tenant boundary in storage.
 *
 * R2 is one bucket shared by every tenant. There is no per-tenant credential,
 * no bucket policy and no ACL doing the separating: the only thing that keeps
 * tenant A's presigned PUT from landing inside tenant B's prefix is the string
 * this function builds. So it is tested the way `classifyHost` is tested —
 * exhaustively rather than representatively, because every failure mode here is
 * silent. A key that escapes the prefix does not throw; it just quietly writes
 * somewhere it should not, and nobody finds out until the wrong image renders
 * on the wrong storefront.
 *
 * Two properties carry the whole guarantee and both are asserted below:
 *
 *   1. The key ALWAYS begins `tenants/{tenantId}/`, for every tenantId shape
 *      Better Auth can mint.
 *   2. The upload id is the only caller-influenced segment, and it is a
 *      server-generated `crypto.randomUUID()` in production — so the validation
 *      here is the belt for a suspenders that is already fastened. It exists
 *      because "the caller is trusted" is exactly the assumption that stops
 *      being true the first time someone adds a second call site.
 *
 * No network, no `S3Client` usage, no R2 round trip. Presigning is a local
 * signature computation and none of it is exercised here.
 */

/** A syntactically valid id: 8–64 chars of `[a-z0-9-]`, which is what randomUUID yields. */
const VALID_ID = "abc123de";
const REAL_UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("objectKeyFor", () => {
  it("builds the documented layout: tenants/{tenantId}/{kind}/{uploadId}/original", () => {
    expect(objectKeyFor("tenant-a", "products", VALID_ID)).toBe(
      "tenants/tenant-a/products/abc123de/original",
    );
  });

  it("accepts a real crypto.randomUUID() value", () => {
    expect(objectKeyFor("tenant-a", "products", REAL_UUID)).toBe(
      `tenants/tenant-a/products/${REAL_UUID}/original`,
    );
  });

  describe("always anchors the key under the caller's own tenant prefix", () => {
    // Better Auth organization ids are cuid-shaped, but the platform has already
    // seen slug-like and mixed-case ids in fixtures, so the table is wider than
    // production strictly needs.
    it.each([
      ["cm3xk9p2q0000abcd1234efgh", "cuid-shaped"],
      ["tenant-a", "hyphenated"],
      ["Tenant-B", "mixed case"],
      ["0123456789", "all digits"],
      ["a", "single character"],
      ["ma-boutique-2", "slug-shaped with digits"],
    ])("%s (%s)", (tenantId) => {
      for (const kind of ["products", "claims", "logos"] satisfies UploadKind[]) {
        const key = objectKeyFor(tenantId, kind, VALID_ID);
        expect(key.startsWith(`tenants/${tenantId}/`)).toBe(true);
        expect(key).toBe(`tenants/${tenantId}/${kind}/${VALID_ID}/original`);
      }
    });
  });

  describe("refuses a traversal or separator in the upload id rather than producing a key", () => {
    // Each of these, interpolated naively, either escapes the tenant prefix or
    // creates a second path segment the presigned grant was never meant to cover.
    it.each([
      "..",
      "../../other",
      "abc/../../etc",
      "abc/def",
      "abc\\def",
      ".hidden-id",
      "..abcdefgh",
      "abc%2f..%2fxyz",
      "abcdefg/",
      "/abcdefgh",
      "abcdef gh",
      "ABCDEFGH",
      "abc_defg",
      "abcdefgh.jpg",
    ])("%s", (uploadId) => {
      expect(() => objectKeyFor("tenant-a", "products", uploadId)).toThrow();
    });
  });

  describe("enforces the length bounds of the upload id", () => {
    it("rejects an id shorter than 8 characters", () => {
      expect(() => objectKeyFor("tenant-a", "products", "abc123")).toThrow();
    });

    it("rejects an empty id", () => {
      expect(() => objectKeyFor("tenant-a", "products", "")).toThrow();
    });

    it("rejects an id longer than 64 characters", () => {
      expect(() => objectKeyFor("tenant-a", "products", "a".repeat(65))).toThrow();
    });

    it("accepts the exact bounds", () => {
      expect(() => objectKeyFor("tenant-a", "products", "a".repeat(8))).not.toThrow();
      expect(() => objectKeyFor("tenant-a", "products", "a".repeat(64))).not.toThrow();
    });
  });

  describe("refuses a tenant id that could itself break out of the prefix", () => {
    // The tenant id arrives from `ctx.tenantId` and is therefore trusted today.
    // This guard is defence in depth: it costs nothing and it means a future
    // call site that passes something else cannot silently escape.
    it.each(["", "..", "../other", "a/b", "a\\b", ".dotted"])("%s", (tenantId) => {
      expect(() => objectKeyFor(tenantId, "products", VALID_ID)).toThrow();
    });
  });
});

/**
 * ---------------------------------------------------------------------------
 * ONB-03 — THE LOGO NAMESPACE, AND THE DRIFT IT COULD HIDE (T-04-15).
 * ---------------------------------------------------------------------------
 * `requestLogoUpload` mints a key in the logos namespace; the finalize route
 * returns its DERIVATIVE PREFIX (the key with `/original` stripped); the
 * branding action stores that prefix as `StorefrontTheme.logoKey`; and the
 * storefront header renders it as an image `src`. The renderer will not accept
 * an arbitrary string — `storageKeySchema` in `src/server/theming/schema.ts`
 * validates it against a regex.
 *
 * So there are two independent statements of the same layout in this codebase,
 * written in two files by two plans, and NOTHING makes them agree. If they ever
 * disagree the failure is silent in the worst way: the upload succeeds, the key
 * is stored, and the merchant's logo simply does not appear. The assertions
 * below are the join.
 *
 * The pattern is restated here rather than imported because the theming module
 * is created by a sibling plan in the same wave and does not exist while this
 * plan runs. The restatement alone would be worth very little — a copy that
 * drifts is exactly the problem — so the block after it loads the REAL schema
 * whenever the file is present and asserts the two agree.
 */
const STORAGE_KEY_PATTERN =
  /^tenants\/[A-Za-z0-9_-]+\/(products|logos)\/[a-z0-9-]{8,64}$/;

const THEMING_SCHEMA_PATH = fileURLToPath(
  new URL("../../src/server/theming/schema.ts", import.meta.url),
);

interface ParsesKeys {
  safeParse: (value: unknown) => { success: boolean };
}

describe("the logos namespace (ONB-03)", () => {
  it("builds the documented layout for a logo upload", () => {
    expect(objectKeyFor("tenant-a", "logos", REAL_UUID)).toBe(
      `tenants/tenant-a/logos/${REAL_UUID}/original`,
    );
  });

  it("refuses a malformed upload id in the logos namespace too", () => {
    // The namespace is not a second code path — the same guard covers it. Each
    // of these either escapes the tenant prefix or invents a path segment the
    // presigned grant was never meant to cover.
    for (const uploadId of ["..", "../../other", "abc/def", "abc123", ""]) {
      expect(() => objectKeyFor("tenant-a", "logos", uploadId)).toThrow();
    }
  });

  it("yields a derivative prefix the theming storageKeySchema regex accepts", () => {
    const prefix = derivativePrefixFor(objectKeyFor("tenant-a", "logos", REAL_UUID));
    expect(prefix).toBe(`tenants/tenant-a/logos/${REAL_UUID}`);
    expect(prefix).toMatch(STORAGE_KEY_PATTERN);
  });

  it("yields a products prefix the same regex accepts", () => {
    // The product surface reaches the same renderer through `imageKey`, so the
    // regex has to cover both namespaces — and the logo change must not have
    // narrowed it.
    const prefix = derivativePrefixFor(objectKeyFor("tenant-a", "products", REAL_UUID));
    expect(prefix).toMatch(STORAGE_KEY_PATTERN);
  });

  it("does not accept the original key itself", () => {
    // `publicUrlFor` refuses an `/original` key, and the schema must refuse it
    // too: an original is attacker-uploaded bytes and is never served.
    expect(objectKeyFor("tenant-a", "logos", REAL_UUID)).not.toMatch(STORAGE_KEY_PATTERN);
  });
});

/**
 * Inert until the theming module lands, then permanent. This is the assertion
 * that makes the restated regex above trustworthy rather than decorative.
 *
 * The import is deliberately dynamic and path-computed: a static
 * `import ... from "@/server/theming/schema"` would not compile in a worktree
 * where the sibling plan has not run yet, which would block this plan on a file
 * it does not own.
 */
describe.runIf(existsSync(THEMING_SCHEMA_PATH))(
  "storageKeySchema agrees with the keys this module mints",
  () => {
    let storageKeySchema: ParsesKeys;

    beforeAll(async () => {
      const loaded = (await import(pathToFileURL(THEMING_SCHEMA_PATH).href)) as {
        storageKeySchema: ParsesKeys;
      };
      storageKeySchema = loaded.storageKeySchema;
    });

    it("accepts a logos derivative prefix", () => {
      const prefix = derivativePrefixFor(objectKeyFor("tenant-a", "logos", REAL_UUID));
      expect(storageKeySchema.safeParse(prefix).success).toBe(true);
    });

    it("accepts a products derivative prefix", () => {
      const prefix = derivativePrefixFor(
        objectKeyFor("cm3xk9p2q0000abcd1234efgh", "products", VALID_ID),
      );
      expect(storageKeySchema.safeParse(prefix).success).toBe(true);
    });

    it("rejects the original key, a URL and a traversal", () => {
      for (const rejected of [
        objectKeyFor("tenant-a", "logos", REAL_UUID),
        `https://example.invalid/tenants/tenant-a/logos/${REAL_UUID}`,
        `tenants/tenant-a/logos/../../${REAL_UUID}`,
        `logos/${REAL_UUID}`,
      ]) {
        expect(storageKeySchema.safeParse(rejected).success).toBe(false);
      }
    });
  },
);

describe("ALLOWED_UPLOAD_CONTENT_TYPES", () => {
  it("is exactly the three raster types R2 will be asked to sign for", () => {
    expect([...ALLOWED_UPLOAD_CONTENT_TYPES]).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
  });

  it("does not include any vector or document type", () => {
    // A vector image is a script-carrying document, not a raster image; Sharp
    // would happily rasterise it and the stored original would remain a live
    // document served from the platform's own origin (T-03-24).
    for (const excluded of [
      "image/svg+xml",
      "text/html",
      "application/pdf",
      "image/gif",
      "image/avif",
    ]) {
      expect(ALLOWED_UPLOAD_CONTENT_TYPES as readonly string[]).not.toContain(excluded);
    }
  });
});

describe("isAllowedContentType", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s", (value) => {
    expect(isAllowedContentType(value)).toBe(true);
  });

  it.each([
    "image/svg+xml",
    "text/html",
    "application/octet-stream",
    "image/jpeg; charset=utf-8",
    "IMAGE/JPEG",
    " image/jpeg",
    "",
  ])("rejects %s", (value) => {
    // Casing and parameters are rejected rather than normalised on purpose: the
    // value is echoed straight into `PutObjectCommand`'s `ContentType`, and R2
    // compares the signed value byte-for-byte against the upload's actual
    // header. Anything we "helpfully" rewrite here becomes a 403 at upload time.
    expect(isAllowedContentType(value)).toBe(false);
  });
});
