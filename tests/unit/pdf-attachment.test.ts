import { describe, expect, it } from "vitest";

import {
  ALLOWED_DOCUMENT_CONTENT_TYPES,
  isAllowedContentType,
  isAllowedDocumentContentType,
  looksLikePdf,
} from "@/server/images/r2";

/**
 * D-22 — the regression guard for the second, PDF-only allowlist and its
 * magic-byte verification.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS BESIDE `r2-key.test.ts` RATHER THAN INSIDE IT.
 * ---------------------------------------------------------------------------
 * `r2-key.test.ts` is the exhaustive test of the IMAGE allowlist and the key
 * layout it shares with every upload namespace. This file is deliberately
 * separate because its single most important assertion is a NEGATIVE one
 * about that other file's subject: `isAllowedContentType("application/pdf")`
 * must stay `false` forever. Putting that assertion in a file that also
 * asserts things ABOUT the image allowlist would bury the one test that
 * exists specifically to catch a future "simplification" that merges the two
 * allowlists into one (T-06-65).
 */

describe("isAllowedDocumentContentType", () => {
  it("accepts application/pdf", () => {
    expect(isAllowedDocumentContentType("application/pdf")).toBe(true);
  });

  it.each([
    "application/PDF",
    "application/pdf; charset=utf-8",
    "image/jpeg",
    "text/html",
    "APPLICATION/PDF",
    " application/pdf",
    "application/pdf ",
    "",
  ])("rejects %s", (value) => {
    // Exact match, no normalization — the same reasoning as
    // `isAllowedContentType`: the value is echoed verbatim into
    // `PutObjectCommand`'s `ContentType` and R2 compares the signed value
    // byte-for-byte against what the browser actually sends.
    expect(isAllowedDocumentContentType(value)).toBe(false);
  });
});

describe("ALLOWED_DOCUMENT_CONTENT_TYPES", () => {
  it("is exactly application/pdf and nothing else", () => {
    expect([...ALLOWED_DOCUMENT_CONTENT_TYPES]).toEqual(["application/pdf"]);
  });
});

describe("isAllowedContentType stays untouched by the document allowlist (T-06-65)", () => {
  it("still refuses application/pdf — the image allowlist did not move", () => {
    // This is the regression guard: a future edit that merges the two
    // allowlists, or widens the image one to admit documents, fails this
    // assertion first.
    expect(isAllowedContentType("application/pdf")).toBe(false);
  });
});

describe("looksLikePdf", () => {
  it("is true for a buffer beginning with the five bytes %PDF-", () => {
    const buffer = Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n", "binary");
    expect(looksLikePdf(buffer)).toBe(true);
  });

  it("is false for an empty buffer", () => {
    expect(looksLikePdf(Buffer.alloc(0))).toBe(false);
  });

  it("is false for a buffer shorter than five bytes", () => {
    expect(looksLikePdf(Buffer.from("%PDF", "ascii"))).toBe(false);
  });

  it("is false for a JPEG's magic bytes", () => {
    const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(looksLikePdf(jpegMagic)).toBe(false);
  });

  it("is false when %PDF- appears at an offset other than zero", () => {
    const buffer = Buffer.concat([
      Buffer.from("garbage-prefix-", "ascii"),
      Buffer.from("%PDF-1.7", "ascii"),
    ]);
    expect(looksLikePdf(buffer)).toBe(false);
  });
});
