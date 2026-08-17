import "server-only";

import { prismaBase } from "./base";

/**
 * Narrow reads and writes on the **non**-tenant-scoped registry tables.
 *
 * Why this client exists as a distinct category: slug availability (D-02) and
 * hostname resolution (DOM-02) must read `organization`, which has no
 * `tenantId` column and therefore cannot go through `scopedDb` — that would
 * throw, correctly, because `Organization` is not a tenant-scoped model. It IS
 * the tenant.
 *
 * Without naming this third category, that code would be forced to reach for
 * `prismaBase` (weakening the TEN-02 boundary for everyone) or `adminDb`
 * (polluting the TEN-05 admin isolation with ordinary storefront traffic).
 * Both are worse than one explicitly narrow façade.
 *
 * Deliberately NOT a re-export of the client. The surface is an allowlist of
 * four delegates, so reaching a tenant-scoped model through this object is a
 * type error rather than a review comment. Adding a delegate here is a
 * decision to be made on purpose — and never for a model that carries a
 * `tenantId`.
 *
 * Exposed as getters so each access resolves against the live `prismaBase`
 * singleton rather than capturing a delegate at module-evaluation time.
 */
export const platformDb = {
  /** The tenant registry itself: slug lookup, hostname resolution, status. */
  get organization() {
    return prismaBase.organization;
  },
  /** Merchant and platform-admin accounts. Not tenant-scoped. */
  get user() {
    return prismaBase.user;
  },
  /** User-to-organization membership. The join, not tenant data. */
  get member() {
    return prismaBase.member;
  },
  /** Auth sessions, including `activeOrganizationId`. */
  get session() {
    return prismaBase.session;
  },
} as const;

export type PlatformDb = typeof platformDb;
