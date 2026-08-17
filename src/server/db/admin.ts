import "server-only";

import { prismaBase } from "./base";

/**
 * The platform-admin data client. **Deliberately unscoped and cross-tenant.**
 *
 * This is not an oversight and it is not a hole — it is the requirement.
 * TEN-05 asks that the platform admin surface be *architecturally* isolated
 * from the tenant surface, and this module is that architecture:
 *
 *   1. It is a separate module from `scopedDb`, so admin reads can never be
 *      confused for tenant reads at a call site.
 *   2. It is importable only from `src/server/admin/**`, enforced by the
 *      `no-restricted-imports` zone in `eslint.config.mjs` — importing it
 *      anywhere else fails `npm run lint`, which is a gate on CI, not advice.
 *   3. The same ESLint config forbids `src/server/admin/**` from importing
 *      `tenant-scoped.ts`. The isolation runs both ways: if the admin surface
 *      could reuse tenant-scoped services, "isolated" would degrade into
 *      "shares most of its code with the tenant path".
 *
 * TEN-05 is satisfied by this client existing, being unscoped, and being
 * lint-fenced. No admin route consumes it until Phase 6 — building admin UI
 * now is not what the requirement asks for.
 *
 * When Phase 6 does arrive: every read through this client crosses a trust
 * boundary, so each call site needs its own `platformRole` authorization check
 * (CLAUDE.md C-8). There is no tenant predicate here to fall back on.
 */
export const adminDb = prismaBase;

export type AdminDb = typeof adminDb;
