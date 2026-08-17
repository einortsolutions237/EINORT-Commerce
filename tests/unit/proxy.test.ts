import { NextRequest, type NextResponse } from "next/server";
import {
  getRewrittenUrl,
  isRewrite,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

/**
 * TEN-03 / DOM-02 — the request-interception boundary.
 *
 * `proxy.ts` reads `process.env.NEXT_PUBLIC_ROOT_DOMAIN` once at module scope
 * and throws if it is missing, so the env var has to exist before the module is
 * evaluated. A static import would be hoisted above the assignment, hence the
 * top-level dynamic import below.
 *
 * 01-VALIDATION.md maps `vitest -t "strips"` and `vitest -t "internal prefix"`
 * to TEN-03 and DOM-02 respectively — do not rename those tests without
 * updating the validation map.
 */
process.env.NEXT_PUBLIC_ROOT_DOMAIN = "einort.com";
const { proxy, config } = await import("../../src/proxy");

const request = (url: string, headers: Record<string, string> = {}): NextRequest => {
  const host = new URL(url).host;
  return new NextRequest(url, { headers: { host, ...headers } });
};

/**
 * Reconstruct the request headers the proxy actually forwards downstream.
 *
 * `NextResponse.next({ request: { headers } })` encodes the forwarded set as
 * `x-middleware-override-headers` (a comma-separated name list) plus one
 * `x-middleware-request-<name>` per entry, and that list *replaces* the
 * inbound headers. So a header absent from the list is a header no application
 * code can read — which is exactly the assertion these tests need.
 */
const forwardedHeaders = (response: NextResponse): Headers => {
  const forwarded = new Headers();
  const override = response.headers.get("x-middleware-override-headers");
  if (!override) return forwarded;
  for (const name of override.split(",").filter(Boolean)) {
    const value = response.headers.get(`x-middleware-request-${name}`);
    if (value !== null) forwarded.set(name, value);
  }
  return forwarded;
};

const FORGED = { "x-tenant-id": "attacker-value", "x-store-slug": "attacker-store" };

describe("proxy", () => {
  describe("internal prefix", () => {
    it("404s a direct request to the internal prefix /s/<slug> from the apex", () => {
      // The /s/[slug] tree is a real filesystem route (plan 01-05). Without this
      // guard, einort.com/s/some-store serves that tenant's storefront inside
      // the apex cookie scope — which is what makes D-07's cookie separation
      // meaningless, and breaks DOM-02's exact-resolution guarantee.
      const response = proxy(request("https://einort.com/s/somestore"));
      expect(response.status).toBe(404);
      expect(isRewrite(response)).toBe(false);
    });

    it("404s the bare internal prefix /s from the apex", () => {
      const response = proxy(request("https://einort.com/s"));
      expect(response.status).toBe(404);
      expect(isRewrite(response)).toBe(false);
    });

    it("404s the internal prefix from a store hostname too, not just the apex", () => {
      const response = proxy(request("https://store1.einort.com/s/othersstore"));
      expect(response.status).toBe(404);
      expect(isRewrite(response)).toBe(false);
    });

    it("does not 404 a path that merely starts with the letter s", () => {
      const response = proxy(request("https://einort.com/signup"));
      expect(response.status).not.toBe(404);
      expect(isRewrite(response)).toBe(false);
    });
  });

  describe("header sanitisation", () => {
    it("strips a forged x-tenant-id on the root branch", () => {
      const response = proxy(request("https://einort.com/", FORGED));
      expect(forwardedHeaders(response).get("x-tenant-id")).toBeNull();
    });

    it("strips a forged x-store-slug on the root branch", () => {
      const response = proxy(request("https://einort.com/", FORGED));
      expect(forwardedHeaders(response).get("x-store-slug")).toBeNull();
    });

    it("strips forged tenant headers on the store branch", () => {
      const response = proxy(request("https://store1.einort.com/produits/42", FORGED));
      const headers = forwardedHeaders(response);
      expect(headers.get("x-tenant-id")).toBeNull();
      expect(headers.get("x-store-slug")).toBeNull();
    });

    it("strips forged tenant headers on the reserved branch", () => {
      const response = proxy(request("https://api.einort.com/", FORGED));
      const headers = forwardedHeaders(response);
      expect(headers.get("x-tenant-id")).toBeNull();
      expect(headers.get("x-store-slug")).toBeNull();
    });

    it("strips forged tenant headers on the unknown branch", () => {
      const response = proxy(request("https://a.b.einort.com/", FORGED));
      const headers = forwardedHeaders(response);
      expect(headers.get("x-tenant-id")).toBeNull();
      expect(headers.get("x-store-slug")).toBeNull();
    });

    it("forwards unrelated headers untouched", () => {
      const response = proxy(
        request("https://einort.com/", { ...FORGED, "accept-language": "en-GB" }),
      );
      expect(forwardedHeaders(response).get("accept-language")).toBe("en-GB");
    });
  });

  describe("store hostnames", () => {
    it("rewrites the storefront root to /s/<slug>", () => {
      // `url.pathname` is set to "/s/store1/", but NextURL normalizes the
      // trailing slash away under the default `trailingSlash: false`. Both forms
      // resolve to app/s/[slug]/page.tsx, so the normalized form is asserted
      // here rather than fought.
      const response = proxy(request("https://store1.einort.com/"));
      expect(isRewrite(response)).toBe(true);
      expect(new URL(getRewrittenUrl(response)!).pathname).toBe("/s/store1");
    });

    it("preserves the original path when rewriting", () => {
      const response = proxy(request("https://store1.einort.com/produits/42"));
      expect(new URL(getRewrittenUrl(response)!).pathname).toBe("/s/store1/produits/42");
    });

    it("preserves the query string when rewriting", () => {
      const response = proxy(request("https://store1.einort.com/produits?page=2"));
      const rewritten = new URL(getRewrittenUrl(response)!);
      expect(rewritten.pathname).toBe("/s/store1/produits");
      expect(rewritten.searchParams.get("page")).toBe("2");
    });

    it("rewrites /api/auth/* on a store hostname into the storefront tree, keeping auth apex-only", () => {
      // D-07: auth lives on the apex. The rewritten path has no handler, so this
      // 404s — deliberately. Excluding /api from the matcher instead would leave
      // a live auth endpoint on every merchant-controlled subdomain.
      const response = proxy(request("https://store1.einort.com/api/auth/session"));
      expect(new URL(getRewrittenUrl(response)!).pathname).toBe("/s/store1/api/auth/session");
    });
  });

  describe("platform hostnames pass through", () => {
    it("passes the apex through without rewriting", () => {
      const response = proxy(request("https://einort.com/signup"));
      expect(isRewrite(response)).toBe(false);
      expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    it("passes www through without rewriting", () => {
      const response = proxy(request("https://www.einort.com/"));
      expect(isRewrite(response)).toBe(false);
    });

    it("passes a reserved hostname through without rewriting", () => {
      const response = proxy(request("https://api.einort.com/"));
      expect(isRewrite(response)).toBe(false);
      expect(response.headers.get("x-middleware-next")).toBe("1");
    });
  });

  describe("unknown hostnames fail closed", () => {
    /**
     * "Unknown" here means *unclassifiable*, not *unclaimed*. `nope.einort.com`
     * is a well-formed slug, so it classifies as a store and rewrites into the
     * storefront tree — whether a tenant named `nope` actually exists is a
     * database question, answered by plan 01-05's storefront layout, which calls
     * `notFound()` and lands on the same branded body. The proxy stays zero-I/O.
     */
    it("rewrites a well-formed but unclaimed subdomain into the storefront tree, not to /store-not-found", () => {
      const response = proxy(request("https://nope.einort.com/"));
      expect(new URL(getRewrittenUrl(response)!).pathname).toBe("/s/nope");
    });

    it("rewrites a deep subdomain to /store-not-found", () => {
      const response = proxy(request("https://a.b.einort.com/"));
      expect(isRewrite(response)).toBe(true);
      expect(new URL(getRewrittenUrl(response)!).pathname).toBe("/store-not-found");
    });

    it("rewrites an all-numeric subdomain to /store-not-found", () => {
      const response = proxy(request("https://12345.einort.com/"));
      expect(isRewrite(response)).toBe(true);
      expect(new URL(getRewrittenUrl(response)!).pathname).toBe("/store-not-found");
    });

    it("rewrites the suffix-confusion host einort.com.evil.tld to /store-not-found", () => {
      const response = proxy(request("https://einort.com.evil.tld/"));
      expect(isRewrite(response)).toBe(true);
      expect(new URL(getRewrittenUrl(response)!).pathname).toBe("/store-not-found");
    });

    it("never rewrites an unknown host into the storefront tree", () => {
      const response = proxy(request("https://a.b.einort.com/produits/42"));
      expect(new URL(getRewrittenUrl(response)!).pathname).toBe("/store-not-found");
    });
  });

  describe("matcher", () => {
    it.each([
      "https://einort.com/_next/static/chunk.js",
      "https://einort.com/_next/image",
      "https://einort.com/favicon.ico",
      "https://einort.com/robots.txt",
      "https://einort.com/sitemap.xml",
    ])("does not run on %s", (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    });

    it.each([
      "https://einort.com/",
      "https://store1.einort.com/produits/42",
      // Deliberately NOT excluded: a storefront subdomain hitting /api/auth/*
      // must be rewritten so it 404s, keeping auth apex-only per D-07.
      "https://store1.einort.com/api/auth/session",
    ])("runs on %s", (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    });
  });
});
