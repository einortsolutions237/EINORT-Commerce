import { NextResponse, type NextRequest } from "next/server";

import { classifyHost } from "@/server/tenant/host";

/**
 * Next.js 16 Proxy — the request-interception half of hostname resolution
 * (TEN-03, DOM-02).
 *
 * The filename is `proxy.ts`, not `middleware.ts`: Next 16 renamed the
 * convention and `middleware.ts` is deprecated and slated for removal. Every
 * hostname snippet in `.planning/research/ARCHITECTURE.md` predates the rename
 * and is pseudocode here.
 *
 * Two rules govern what may live in this file:
 *
 *   1. **No I/O, no ORM, no cache client.** This runs on every matched request,
 *      including prefetches. The Next 16 Proxy docs state it "should not attempt
 *      relying on shared modules or globals". Resolving a slug to a real tenant
 *      is plan 01-05's job, in the storefront layout, behind a cache.
 *   2. **No `runtime` config export.** Proxy is always the Node.js runtime in
 *      Next 16, and setting that option throws.
 *
 * Tenant identity leaves this file exactly one way: the rewritten path. A client
 * cannot forge a path the proxy generates from the `Host` header, and it can
 * forge any header it likes — which is why the sanitisation below is
 * unconditional rather than per-branch.
 */

/**
 * Read once at module scope from a literal `process.env` reference so Next
 * inlines it at build time. Read through `@/env` instead and this file pulls
 * the whole validated-env module (and Zod) into the interception path.
 *
 * The throw is not defensive noise: a blank root domain makes `classifyHost`
 * treat every hostname as the apex, which takes every storefront offline
 * silently. Failing at module load turns that into a boot error (threat T-01-03).
 */
function readRootDomain(): string {
  const value = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_ROOT_DOMAIN is not set. Hostname classification cannot run without it — " +
        "every host would classify as the root domain and every storefront would go offline.",
    );
  }
  return value;
}

const ROOT_DOMAIN = readRootDomain();

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // (1) The internal rewrite prefix is never externally addressable.
  //
  // `/s/[slug]` is a real filesystem route (plan 01-05). Nothing else stops
  // `https://einort.com/s/some-other-store` from serving a tenant storefront on
  // the apex. That is not a data leak — storefronts are public — but it breaks
  // DOM-02's exact-resolution guarantee, creates duplicate content across hosts,
  // and renders merchant-controlled content inside the apex cookie scope, which
  // is precisely what makes D-07's cookie separation safe.
  //
  // Unconditional is correct: legitimate traffic only reaches `/s/...` after a
  // rewrite, and rewrites do not re-enter the Proxy.
  if (pathname === "/s" || pathname.startsWith("/s/")) {
    return new NextResponse(null, { status: 404 });
  }

  // (2) No inbound request may pre-set tenant identity.
  //
  // A client can send `x-tenant-id` itself. The Proxy *feels* like a trusted
  // boundary, but nothing downstream enforces that a header it reads came from
  // here. Stripping on every branch — not just the storefront one — is what
  // closes that gap.
  //
  // `NextResponse.next({ request: { headers } })` replaces the forwarded request
  // headers. The nested `request` key matters: `NextResponse.next({ headers })`
  // sets *response* headers instead, exposing them to the client and leaving the
  // forged request headers intact.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-tenant-id");
  requestHeaders.delete("x-store-slug");
  const forward = { request: { headers: requestHeaders } };

  const result = classifyHost(request.headers.get("host"), ROOT_DOMAIN);

  switch (result.kind) {
    // The apex serves D-06's placeholder plus D-07's signup, login, dashboard
    // and `/api/auth/*`. Reserved hostnames are platform-owned and are never a
    // tenant lookup. Both are ordinary passthroughs.
    case "root":
    case "reserved":
      return NextResponse.next(forward);

    // Fail closed (DOM-02). Unknown, foreign, deep, punycode, numeric and
    // malformed hostnames all land on one branded not-found route, which is
    // also what a suspended store renders (D-05) — an anonymous visitor cannot
    // tell "never existed" from "suspended".
    case "unknown":
      return NextResponse.rewrite(new URL("/store-not-found", request.url), forward);

    case "store": {
      const url = request.nextUrl.clone();
      url.pathname = `/s/${result.slug}${pathname}`;
      return NextResponse.rewrite(url, forward);
    }
  }
}

export const config = {
  // Deliberately does NOT exclude `/api`. A storefront subdomain hitting
  // `/api/auth/*` must be rewritten into `/s/{slug}/api/auth/*`, where no
  // handler exists, so it 404s — that is what keeps auth apex-only per D-07.
  // Excluding `/api` instead would leave a live auth endpoint on every
  // merchant-controlled subdomain.
  //
  // Without a matcher the Proxy runs on every request including static assets.
  // Note that `_next/data` still runs even when a negative matcher excludes it —
  // intentional in Next 16, so a protected page cannot have an unprotected data
  // route.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
