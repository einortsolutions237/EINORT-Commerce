import "server-only";

import { scopedDb } from "@/server/db/tenant-scoped";

/**
 * Read-only claim queries (ORD-03 / D-13).
 *
 * ---------------------------------------------------------------------------
 * THE BADGE IS A `count()`. IT IS NOT A COUNTER COLUMN. DO NOT "OPTIMIZE" IT.
 * ---------------------------------------------------------------------------
 * `PaymentClaim` carries `@@index([tenantId, status, submittedAt])`, and the
 * query below matches its first two columns exactly, so Postgres answers it
 * from the index without touching a heap page. At pilot scale — tens of claims
 * per tenant, one call per dashboard render — that is sub-millisecond, and the
 * dashboard already pays for a session read and an organization read on the
 * same request.
 *
 * The alternative that looks cheaper is a denormalized `pendingClaimCount`
 * column on the tenant. It is not cheaper, it is four new opportunities to be
 * wrong: the count has to be incremented when a customer submits, decremented
 * when a merchant confirms, decremented when a merchant rejects, and
 * incremented again when a rejected claim is re-submitted from `DISPUTED`. Miss
 * one — or let one land outside the transaction that changed the claim — and
 * the badge lies, which is worse than no badge at all: it either hides work a
 * merchant is waiting on or cries wolf until they stop reading it. A number
 * derived from the rows cannot drift from the rows (03-RESEARCH.md Pattern 11).
 *
 * ---------------------------------------------------------------------------
 * THE `tenantId` PARAMETER HERE IS CORRECT, AND IS NOT WHAT TEN-04 BANS.
 * ---------------------------------------------------------------------------
 * `tests/unit/no-tenant-id-param.test.ts` forbids a tenant identifier in an
 * exported signature under `src/server/merchant/**` and
 * `src/server/entitlements/**`, because on those surfaces the tenant must come
 * from `session.session.activeOrganizationId` and a parameter would be a field
 * a caller could substitute. This module is not on that surface and is not
 * reachable from a client: it is `server-only`, it exports no Server Action,
 * and its single caller — `src/app/(dashboard)/layout.tsx` — has already
 * resolved the tenant through `requireMerchantContext()`. The scan's own doc
 * comment names this distinction (`resolveTenantBySlug(slug)` is the precedent).
 *
 * The isolation guarantee is still structural rather than trusted: `scopedDb`
 * injects `tenantId` into the `where` of every call it forwards, `PaymentClaim`
 * is registered in `TENANT_SCOPED_MODELS`, and
 * `tests/isolation/model-registry-drift.test.ts` fails if it ever is not
 * (T-03-20).
 */

/**
 * How many claims are waiting for this tenant's merchant to review.
 *
 * Drives the gold count badge on the `Payment claims` rail item, which renders
 * only when this is greater than zero — a zero badge is noise, and gold means
 * "a human needs to look at this now".
 */
export async function pendingClaimCount(tenantId: string): Promise<number> {
  return scopedDb(tenantId).paymentClaim.count({
    where: { status: "PENDING" },
  });
}
