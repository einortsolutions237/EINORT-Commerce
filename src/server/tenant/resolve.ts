import "server-only";

import { cache } from "react";

import { platformDb } from "@/server/db/platform";

import { getCachedTenant, setCachedMiss, setCachedTenant } from "./cache";

/**
 * Hostname-derived slug -> tenant. The authoritative half of DOM-02.
 *
 * The other half lives in `src/proxy.ts`, which classifies the `Host` header
 * with zero I/O and rewrites to `/s/{slug}`. **This module is deliberately not
 * imported from there.** Resolution needs Postgres and Redis; the Proxy runs on
 * every matched request including prefetches, is documented to avoid shared
 * modules, and has no business holding a database connection. The split is the
 * design, not an accident of layering:
 *
 *   proxy.ts    — is this hostname *shaped* like a store?   (pure, zero I/O)
 *   resolve.ts  — does that store *exist and serve*?        (cached DB read)
 *
 * Fail-closed is the whole contract. There is no default tenant, no "probably
 * this one" branch, and no status treated as active-by-omission. Anything that
 * is not a live, active organization resolves to `null`, and `null` renders the
 * one branded not-found body (D-04/D-05).
 */

/**
 * `name` is additive to the contract this plan published for plan 01-06
 * (`{ id, slug, status }`) — consumers that destructure those three are
 * unaffected. It is here because the placeholder storefront has to render
 * something that could only have come from Postgres; echoing the slug back
 * would prove nothing, since the slug arrives in the URL.
 */
export type ResolvedTenant = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

/**
 * The only status that serves traffic. Everything else — `suspended`, a typo, a
 * value a future migration adds — resolves to `null`. Allowlisting one value
 * rather than denylisting `"suspended"` is what makes a new status fail closed.
 */
const ACTIVE_STATUS = "active";

/**
 * Resolve a store slug to its tenant, or `null`.
 *
 * `null` covers three cases that the caller must **not** be able to tell apart:
 * no such organization, a suspended organization, and an organization in any
 * other non-active state. That indistinguishability is D-05 and it is enforced
 * here rather than at the render layer, so no future caller can accidentally
 * branch on the difference.
 *
 * Wrapped in React's `cache()` so repeated calls inside a single render pass —
 * the `/s/[slug]` layout and the page beneath it, for instance — dedupe to one
 * lookup. That is per-render memoization only; cross-request caching is Redis's
 * job and lives in `./cache`.
 */
export const resolveTenantBySlug = cache(
  async (slug: string): Promise<ResolvedTenant | null> => {
    const cached = await getCachedTenant(slug);

    // A cached negative is authoritative for its (short) TTL. Returning here
    // without touching Postgres is the T-01-31 mitigation.
    if (cached.kind === "miss") return null;

    if (cached.kind === "hit") {
      return cached.tenant.status === ACTIVE_STATUS ? cached.tenant : null;
    }

    // `organization` has no `tenantId` — it *is* the tenant — so it is read
    // through `platformDb`, never `scopedDb`. Any error from here propagates:
    // a database failure must surface as a failure, not resolve to a tenant and
    // not resolve to a silently rendered storefront.
    const organization = await platformDb.organization.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, status: true },
    });

    if (!organization) {
      await setCachedMiss(slug);
      return null;
    }

    // Cache what the database said — including a non-active status — then apply
    // the suspension rule at return time. Ordering matters: an un-suspend then
    // only needs `invalidateTenantHost`, not a differently shaped cache entry.
    await setCachedTenant(slug, organization);

    return organization.status === ACTIVE_STATUS ? organization : null;
  },
);
