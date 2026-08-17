import { describe, expect, it } from "vitest";

import {
  classifyHost,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  type HostResult,
} from "@/server/tenant/host";

/**
 * DOM-02 / TEN-03 / TEN-06 — hostname classification.
 *
 * `classifyHost` is the only thing standing between the wildcard DNS record and
 * the tenant routing table. Every failure mode here is silent: a host that is
 * wrongly classified does not throw, it just serves the wrong thing forever.
 * So the table below is exhaustive rather than representative.
 *
 * 01-VALIDATION.md maps `vitest -t "fails closed"` to DOM-02 — do not rename
 * that describe block without updating the validation map.
 */

const ROOT = "einort.com";
const LOCAL_ROOT = "localhost:3000";

describe("classifyHost", () => {
  describe("root domain", () => {
    it.each([
      ["einort.com", "bare apex"],
      ["EINORT.COM", "uppercase apex"],
      ["einort.com.", "fully-qualified trailing dot"],
      ["einort.com:443", "explicit port"],
      ["  einort.com  ", "surrounding whitespace"],
      ["www.einort.com", "www is the apex, not a tenant"],
    ])("classifies %s as root (%s)", (host) => {
      expect(classifyHost(host, ROOT)).toEqual<HostResult>({ kind: "root" });
    });

    it("classifies any *.vercel.app preview host as root", () => {
      // Open Question 2: preview deploys exercise the apex surface only. Preview
      // URLs also hit the 63-character DNS-label ceiling, so tenant subdomains on
      // previews are not supported in V1.
      expect(classifyHost("einort-preview-abc123.vercel.app", ROOT)).toEqual<HostResult>({
        kind: "root",
      });
      expect(classifyHost("vercel.app", ROOT)).toEqual<HostResult>({ kind: "root" });
    });

    it("does not treat a foreign domain that merely contains vercel.app as root", () => {
      expect(classifyHost("vercel.app.evil.tld", ROOT)).toEqual<HostResult>({
        kind: "unknown",
        reason: "foreign-domain",
      });
    });
  });

  describe("reserved platform hostnames", () => {
    it.each(["api", "admin", "app", "dashboard", "checkout", "security", "s"])(
      "classifies %s.einort.com as reserved, never as a store",
      (label) => {
        expect(classifyHost(`${label}.${ROOT}`, ROOT)).toEqual<HostResult>({
          kind: "reserved",
          label,
        });
      },
    );
  });

  describe("store hostnames", () => {
    it("classifies a single valid label as a store", () => {
      expect(classifyHost("mystore.einort.com", ROOT)).toEqual<HostResult>({
        kind: "store",
        slug: "mystore",
      });
    });

    it("normalizes case before classifying, so an uppercase label is still that store", () => {
      expect(classifyHost("UPSTORE.einort.com", ROOT)).toEqual<HostResult>({
        kind: "store",
        slug: "upstore",
      });
    });

    it("accepts interior hyphens", () => {
      expect(classifyHost("ma-boutique-2.einort.com", ROOT)).toEqual<HostResult>({
        kind: "store",
        slug: "ma-boutique-2",
      });
    });

    it("ignores the port when classifying a store", () => {
      expect(classifyHost("mystore.einort.com:443", ROOT)).toEqual<HostResult>({
        kind: "store",
        slug: "mystore",
      });
    });
  });

  describe("fails closed", () => {
    // THE critical case. A suffix-confusion host must never be read as the root
    // domain or as a tenant: `endsWith(rootDomain)` (without the leading dot)
    // would classify this as ours and hand an attacker-controlled origin a
    // storefront. This is a total, silent DOM-02 failure when it regresses.
    it("fails closed on the suffix-confusion host einort.com.evil.tld", () => {
      expect(classifyHost("einort.com.evil.tld", ROOT)).toEqual<HostResult>({
        kind: "unknown",
        reason: "foreign-domain",
      });
    });

    it.each<[string, string]>([
      ["notmyeinort.com", "foreign-domain"],
      ["evil.tld", "foreign-domain"],
      ["192.168.1.1", "foreign-domain"],
      ["a.b.einort.com", "deep-subdomain"],
      ["xn--80ak6aa92e.einort.com", "punycode"],
      ["12345.einort.com", "numeric-label"],
      ["ab.einort.com", "bad-length"],
      ["UP.einort.com", "bad-length"],
      ["-bad-.einort.com", "bad-format"],
      ["ma--boutique.einort.com", "bad-format"],
      ["ma_boutique.einort.com", "bad-format"],
    ])("fails closed on %s with reason %s", (host, reason) => {
      expect(classifyHost(host, ROOT)).toEqual<HostResult>({ kind: "unknown", reason });
    });

    it("fails closed on a label longer than the slug maximum", () => {
      const tooLong = "a".repeat(SLUG_MAX_LENGTH + 1);
      expect(classifyHost(`${tooLong}.${ROOT}`, ROOT)).toEqual<HostResult>({
        kind: "unknown",
        reason: "bad-length",
      });
    });

    it("accepts a label of exactly the slug maximum", () => {
      const atLimit = "a".repeat(SLUG_MAX_LENGTH);
      expect(classifyHost(`${atLimit}.${ROOT}`, ROOT)).toEqual<HostResult>({
        kind: "store",
        slug: atLimit,
      });
    });

    it("accepts a label of exactly the slug minimum", () => {
      const atLimit = "a".repeat(SLUG_MIN_LENGTH);
      expect(classifyHost(`${atLimit}.${ROOT}`, ROOT)).toEqual<HostResult>({
        kind: "store",
        slug: atLimit,
      });
    });

    it("fails closed on a missing Host header", () => {
      expect(classifyHost(null, ROOT)).toEqual<HostResult>({
        kind: "unknown",
        reason: "missing-host",
      });
    });

    it("fails closed on an empty Host header", () => {
      expect(classifyHost("", ROOT)).toEqual<HostResult>({
        kind: "unknown",
        reason: "missing-host",
      });
    });

    it("fails closed on a Host header that is nothing but a port", () => {
      expect(classifyHost(":3000", ROOT)).toEqual<HostResult>({
        kind: "unknown",
        reason: "empty-host",
      });
    });
  });

  describe("local development root domain", () => {
    it("classifies localhost:3000 as root", () => {
      expect(classifyHost("localhost:3000", LOCAL_ROOT)).toEqual<HostResult>({ kind: "root" });
    });

    it("classifies store1.localhost as a store", () => {
      expect(classifyHost("store1.localhost", LOCAL_ROOT)).toEqual<HostResult>({
        kind: "store",
        slug: "store1",
      });
    });

    it("classifies store1.localhost:3000 as a store", () => {
      expect(classifyHost("store1.localhost:3000", LOCAL_ROOT)).toEqual<HostResult>({
        kind: "store",
        slug: "store1",
      });
    });

    it("still fails closed on a foreign host in local development", () => {
      expect(classifyHost("localhost.evil.tld", LOCAL_ROOT)).toEqual<HostResult>({
        kind: "unknown",
        reason: "foreign-domain",
      });
    });
  });

  describe("purity", () => {
    it("is deterministic and does no I/O — repeated calls return equal results", () => {
      const first = classifyHost("mystore.einort.com", ROOT);
      const second = classifyHost("mystore.einort.com", ROOT);
      expect(first).toEqual(second);
    });
  });
});
