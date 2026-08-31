import "server-only";

import type {
  ClaimStatus,
  OrderChannel,
  OrderState,
  PaymentOperator,
} from "@/server/db/enums";
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

/**
 * One row of the A5 queue — a claim and the order it is a claim against.
 *
 * The order's `totalXaf` rides along rather than being fetched per card,
 * because the amount-mismatch line is a COMPARISON: the whole point of A5's
 * card is that the merchant sees what the customer says they sent next to what
 * the order actually costs, at the moment of the decision. Fetching the order
 * separately would make that an N+1 over a list whose length is "however many
 * customers are waiting", and would let the two halves of the comparison come
 * from two different instants.
 */
export interface ClaimReviewRow {
  readonly id: string;
  readonly operator: PaymentOperator;
  /** Exactly as the customer typed it — what the merchant eyeballs. */
  readonly reference: string;
  /** ORD-04's key. Passed straight back into `findDuplicateReference`. */
  readonly referenceNormalized: string;
  readonly amountClaimedXaf: number;
  /** R2 derivative PREFIX, or null when the customer skipped the upload. */
  readonly screenshotKey: string | null;
  readonly submittedAt: Date;
  readonly status: ClaimStatus;
  readonly order: {
    readonly id: string;
    readonly orderNumber: string;
    readonly totalXaf: number;
    readonly state: OrderState;
    readonly channel: OrderChannel;
    readonly customerName: string;
  };
}

/**
 * The A5 queue, oldest first (ORD-03).
 *
 * ---------------------------------------------------------------------------
 * `submittedAt asc` IS A PRODUCT DECISION, NOT A DEFAULT.
 * ---------------------------------------------------------------------------
 * Newest-first is the reflex for a feed; this is not a feed. A payment claim is
 * a customer standing still with their money already sent, and the one who has
 * been waiting longest is the one closest to giving up on the sale. Ascending
 * order also rides `@@index([tenantId, status, submittedAt])` end to end — the
 * predicate matches the first two columns and the sort matches the third — so
 * the ordering that is right for the merchant is also the one Postgres can
 * answer without a sort node.
 *
 * `status` is a PARAMETER with a `PENDING` default rather than a hard-coded
 * literal, because the reopen path in `actions.ts` makes `REJECTED` a queue a
 * merchant may legitimately want to look back at, and a second near-identical
 * function would be a second `select` list to drift.
 *
 * The nested `order` selection does NOT pass through the scope extension —
 * `scopedDb` hooks client operations, not the generated SQL (Pitfall 4). It is
 * nonetheless tenant-safe by a stronger mechanism: `PaymentClaim.order` is
 * declared `@relation(fields: [tenantId, orderId], references: [tenantId, id])`,
 * so the join predicate Postgres runs already carries this tenant's id and a
 * foreign order is not merely filtered out but impossible to have linked.
 * `src/server/orders/queries.ts` states the same distinction at length.
 */
export async function listClaimsForReview(
  tenantId: string,
  status: ClaimStatus = "PENDING",
): Promise<readonly ClaimReviewRow[]> {
  return scopedDb(tenantId).paymentClaim.findMany({
    where: { status },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      operator: true,
      reference: true,
      referenceNormalized: true,
      amountClaimedXaf: true,
      screenshotKey: true,
      submittedAt: true,
      status: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          totalXaf: true,
          state: true,
          channel: true,
          customerName: true,
        },
      },
    },
  });
}

/**
 * The order number of another claim in this tenant carrying the same normalised
 * reference, or `null` (ORD-04, the display half).
 *
 * ---------------------------------------------------------------------------
 * BE HONEST ABOUT WHAT THIS RETURNS TODAY: `null`, ALWAYS.
 * ---------------------------------------------------------------------------
 * `PaymentClaim` carries `@@unique([tenantId, referenceNormalized])`, so two
 * claims within one tenant CANNOT share a normalised reference — the second
 * insert is a `P2002` before it ever becomes a row. This query therefore has no
 * match to find under the current schema, and the A5 duplicate alert it feeds
 * is the display half of a control whose ENFORCEMENT half lives at submission
 * (plan 03-15) as a customer-facing field error.
 *
 * It is implemented rather than omitted for three reasons, and none of them is
 * "the spec said so":
 *
 *   1. 03-UI-SPEC.md § A5 specifies the alert, and a card that can never show
 *      it is a card whose silence means nothing. A merchant has to be able to
 *      read the ABSENCE of the alert as "this reference is not a repeat" —
 *      which is only true if something actually looked.
 *   2. It is the correct shape if the constraint is ever relaxed. RESEARCH.md
 *      Pattern 10 names the partial unique index (`WHERE status <> 'REJECTED'`)
 *      as the considered-and-rejected alternative; if a later phase takes it,
 *      duplicates become genuinely constructible and this function starts
 *      returning rows without a caller changing.
 *   3. `exceptOrderId` keeps it honest under either schema: a claim must never
 *      report ITSELF, or every card in the queue would carry the alert.
 *
 * Tenant-scoped, and the scope is the disclosure control (T-03-69): the order
 * number it returns is one this same merchant already owns, so naming it leaks
 * nothing across a tenant boundary. It deliberately returns the number and not
 * the claim — a merchant needs to know WHICH of their orders to go and look at.
 */
export async function findDuplicateReference(
  tenantId: string,
  referenceNormalized: string,
  exceptOrderId: string,
): Promise<string | null> {
  const duplicate = await scopedDb(tenantId).paymentClaim.findFirst({
    where: {
      referenceNormalized,
      orderId: { not: exceptOrderId },
    },
    orderBy: { submittedAt: "asc" },
    select: { order: { select: { orderNumber: true } } },
  });

  return duplicate?.order.orderNumber ?? null;
}
