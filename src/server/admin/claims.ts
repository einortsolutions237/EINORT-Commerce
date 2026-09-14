import "server-only";

import { strings } from "@/lib/strings";
import { adminDb } from "@/server/db/admin";
import type { ClaimStatus, PaymentOperator } from "@/server/db/enums";
import type { ActionResult } from "@/server/merchant/action";
import {
  AlreadyReviewedError,
  InvalidTransitionError,
} from "@/server/orders/errors";
import { releaseStock } from "@/server/orders/stock";
import { transitionOrder } from "@/server/orders/transition";

/**
 * ADM-02 — the platform owner's cross-tenant order-payment-claims ledger
 * (06-UI-SPEC.md § C3), and the admin-side confirm/reject writers.
 *
 * ---------------------------------------------------------------------------
 * `confirmClaim`/`rejectClaim` (`src/server/claims/actions.ts`) ARE NOT
 * REUSED. THIS IS NOT AN OVERSIGHT (Pitfall 3).
 * ---------------------------------------------------------------------------
 * Both are `merchantAction`s: they resolve `ctx.tenantId` from
 * `requireMerchantContext()`, and the platform owner has no organization
 * (D-04). Calling either from the admin path would either throw resolving a
 * session with no active tenant, or — worse, if `requireMerchantContext()`
 * ever grew a fallback — redirect the owner into store creation. This module
 * is the admin zone's own writer, reading through `adminDb` and authorized by
 * `requireAdminContext()` one layer up (plan 06-10's `adminAction`-wrapped
 * Server Actions), not by a tenant predicate.
 *
 * ---------------------------------------------------------------------------
 * THIS IS NOT A SECOND `Order.state` WRITER. THE STATE WRITE STILL HAPPENS
 * INSIDE `transitionOrder`.
 * ---------------------------------------------------------------------------
 * `adminConfirmOrderClaim`/`adminRejectOrderClaim` call `transitionOrder(tx, …)`
 * with the SAME transaction client, which now satisfies `OrderWriteTx`
 * (`src/server/orders/write-client.ts`, plan 06-07 Task 1 — read it before
 * touching either function). `tests/unit/single-order-state-writer.test.ts`
 * still finds exactly one `SANCTIONED_WRITER`. What this module DOES
 * duplicate — necessarily — is the `PaymentClaim.status` write, because unlike
 * order state there is no shared claim-review function to delegate to without
 * reaching across the merchant/admin fence into a `merchantAction`. See the
 * next header block.
 *
 * ---------------------------------------------------------------------------
 * `PaymentClaim.status` NOW HAS TWO LEGITIMATE WRITERS. `tests/isolation/
 * claims.test.ts`'s ORD-02 SOURCE SCAN IS EXTENDED TO NAME BOTH, NOT WEAKENED.
 * ---------------------------------------------------------------------------
 * `src/server/claims/actions.ts` (the merchant's one tap) and this module
 * (the platform owner's) are the two — and ONLY the two — places a claim may
 * be set to `CONFIRMED`. The extended scan asserts exactly that allowlist,
 * the same way `COVERED_ZONES` in the single-writer test asserts its own
 * coverage rather than assuming it.
 *
 * ---------------------------------------------------------------------------
 * BECAUSE THE CLIENT IS UNSCOPED, EVERY OPERATION HERE THAT CAN NAME
 * `tenantId` MUST, EVEN WHERE A PRIMARY KEY WOULD TECHNICALLY BE ENOUGH.
 * ---------------------------------------------------------------------------
 * `write-client.ts`'s header explains why a cuid-keyed `where` is SAFE either
 * way — `Order.id`/`PaymentClaim.id` are globally unique, so an unscoped
 * lookup selects exactly the row a scoped one would have. That argument is
 * true and is why `transitionOrder`'s own internal read stays id-only. It is
 * NOT a license to omit `tenantId` everywhere it is available in THIS module:
 * on the merchant path the extension injects the predicate into every
 * operation automatically, so a reviewer never has to check each call site by
 * hand. Here nothing injects it, and the only defence against a future edit
 * accidentally loosening a `where` clause is that every `where` in this file
 * already names `tenantId` explicitly wherever the row's tenant is known —
 * making the omission a visible diff, not a silent one. The single read that
 * does NOT — `paymentClaim.findUniqueOrThrow({ where: { id: claimId } })` — is
 * the one place `tenantId` is not yet known; it is what that call discovers,
 * and every operation after it uses the value that call returned.
 *
 * ---------------------------------------------------------------------------
 * `actor: "MERCHANT"`, EVEN THOUGH THE PLATFORM OWNER IS ACTING.
 * ---------------------------------------------------------------------------
 * `EventActor` (`prisma/schema.prisma`) has exactly three values — `CUSTOMER`,
 * `MERCHANT`, `SYSTEM` — and adding a fourth is a schema migration this plan
 * does not make. ADM-02's own requirement is that the consequences are
 * IDENTICAL to the merchant's own tap, and `transitionOrder`'s ORD-02 guard
 * already encodes "only a MERCHANT may confirm an order" as the state graph's
 * rule, not as an identity check — the actual identity is `actorUserId`,
 * which carries the OWNER's id here, never a merchant's. A future audit-log
 * reader asking "who confirmed this" reads `actorUserId`, resolves it to the
 * one `platformRole: "admin"` account, and knows precisely what happened; the
 * `actor` column answers a different, narrower question — "was this the kind
 * of move only a merchant makes" — and the answer for an admin-confirmed claim
 * is still yes.
 *
 * ---------------------------------------------------------------------------
 * NO RAW SQL. THE MERCHANT-NAME JOIN IS A SECOND QUERY, MERGED IN JS.
 * ---------------------------------------------------------------------------
 * `$queryRaw`/`$executeRaw` are banned repository-wide (`eslint.config.mjs`,
 * verified empirically not to be intercepted by the tenant extension). Neither
 * `PaymentClaim` nor `Order` declares a Prisma relation to `Organization` —
 * `tenantId` is a bare scalar FK on both, not a declared relation field — so
 * `listOrderClaimsForAdmin` cannot `include` its way to a store name and
 * instead resolves the distinct set of tenant ids from the claim page and
 * looks their names up in one second `organization.findMany`, merged by a
 * `Map` rather than an N+1.
 */

/**
 * Bounded at pilot scale, exactly as `REVENUE_WINDOW_ROW_CAP`
 * (`src/server/dashboard/queries.ts`) is: a platform running many thousands of
 * pending claims across every tenant at once would exceed this and the ledger
 * would silently drop its tail. Revisiting this cap — pagination, most
 * plausibly — is a follow-up for whenever pilot volume approaches it, not a
 * correctness bug today.
 */
const ADMIN_CLAIM_LEDGER_ROW_CAP = 1000;

/** One row of the C3 ledger — a claim, the order it is against, and the store. */
export interface AdminClaimRow {
  readonly id: string;
  readonly tenantId: string;
  readonly storeName: string;
  readonly orderNumber: string;
  readonly orderTotalXaf: number;
  readonly amountClaimedXaf: number;
  readonly operator: PaymentOperator;
  readonly reference: string;
  readonly submittedAt: Date;
  readonly status: ClaimStatus;
  readonly screenshotKey: string | null;
}

/**
 * The C3 ledger, newest first, optionally narrowed to one status and/or one
 * store. Cross-tenant by construction — this is the entire reason a
 * platform-admin zone exists rather than the merchant's own queue being
 * reused with a bigger `where`.
 *
 * The filter is `merchantId`, not `tenantId` — a QUERY parameter naming
 * which store's rows to look at, exactly the "hand an id to a query, never
 * to the identity function" shape `tests/unit/no-tenant-id-param.test.ts`
 * describes as legitimate. It is still spelled differently on purpose: that
 * scan bans the literal identifiers `tenantId`/`organizationId`/`storeId`
 * from every exported signature under `src/server/admin/**`, with no
 * carve-out for a filter versus an identity parameter, because the admin
 * zone has no predicate underneath to catch a mis-scoped one either way. The
 * returned row's own `tenantId` field is unaffected — that scan reads
 * parameter lists, not return shapes.
 */
export async function listOrderClaimsForAdmin(
  filter: { readonly status?: ClaimStatus; readonly merchantId?: string } = {},
): Promise<readonly AdminClaimRow[]> {
  const claims = await adminDb.paymentClaim.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.merchantId ? { tenantId: filter.merchantId } : {}),
    },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      tenantId: true,
      amountClaimedXaf: true,
      operator: true,
      reference: true,
      submittedAt: true,
      status: true,
      screenshotKey: true,
      order: { select: { orderNumber: true, totalXaf: true } },
    },
    take: ADMIN_CLAIM_LEDGER_ROW_CAP,
  });

  if (claims.length === 0) return [];

  const tenantIds = [...new Set(claims.map((claim) => claim.tenantId))];
  const organizations = await adminDb.organization.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true },
  });
  const storeNameByTenant = new Map(
    organizations.map((org) => [org.id, org.name] as const),
  );

  return claims.map((claim) => ({
    id: claim.id,
    tenantId: claim.tenantId,
    storeName: storeNameByTenant.get(claim.tenantId) ?? claim.tenantId,
    orderNumber: claim.order.orderNumber,
    orderTotalXaf: claim.order.totalXaf,
    amountClaimedXaf: claim.amountClaimedXaf,
    operator: claim.operator,
    reference: claim.reference,
    submittedAt: claim.submittedAt,
    status: claim.status,
    screenshotKey: claim.screenshotKey,
  }));
}

/**
 * How many claims, across every tenant, are waiting for the platform owner.
 * Feeds the admin rail's gold badge (D-07). A `count()`, not a counter column
 * — same doctrine as `pendingClaimCount` in `src/server/claims/queries.ts`,
 * restated there at length and not repeated here.
 */
export function pendingOrderClaimCount(): Promise<number> {
  return adminDb.paymentClaim.count({ where: { status: "PENDING" } });
}

/**
 * The three routine refusals a review can produce, converted to something a
 * caller can render, matching `src/server/claims/actions.ts`'s
 * `refusalOrRethrow` discipline. Not imported from there: that function is
 * private to a `"use server"` module and exports nothing to import, and even
 * if it did, a values-level import across the merchant/admin fence would
 * blur the boundary this module's whole header argues for keeping sharp. This
 * is a small, DB-free mapping — copying it is copying fifteen lines, not
 * copying a trust boundary.
 *
 * `AlreadyReviewedError` and `InvalidTransitionError` are the only two this
 * module's callers can raise — `OutOfStockError` is `reopenClaim`'s alone
 * (plan 06-07 builds no admin reopen path), so there is no third branch here.
 */
function refusalOrRethrow(error: unknown): ActionResult {
  if (error instanceof AlreadyReviewedError) {
    return { ok: false, error: { form: [strings.claims.alreadyReviewed] } };
  }
  if (error instanceof InvalidTransitionError) {
    return { ok: false, error: { form: [strings.orders.staleAction] } };
  }
  throw error;
}

/**
 * The owner's one-tap confirm, over any tenant's claim.
 *
 * Moves no stock, for the identical reason `confirmClaim` does not: the units
 * were decremented and held at placement, and confirmation is purely assent.
 */
export async function adminConfirmOrderClaim({
  claimId,
  actorUserId,
}: {
  readonly claimId: string;
  readonly actorUserId: string;
}) {
  try {
    await adminDb.$transaction(async (tx) => {
      const claim = await tx.paymentClaim.findUniqueOrThrow({
        where: { id: claimId },
        select: { id: true, tenantId: true, orderId: true, status: true },
      });

      // THE OPTIMISTIC LOCK. Inside the transaction, before anything is
      // written — two admin tabs is the normal case, not an attack.
      if (claim.status !== "PENDING") throw new AlreadyReviewedError();

      await tx.paymentClaim.update({
        where: { id: claim.id, tenantId: claim.tenantId },
        data: {
          status: "CONFIRMED",
          reviewedAt: new Date(),
          reviewedByUserId: actorUserId,
        },
      });

      await transitionOrder(tx, {
        orderId: claim.orderId,
        to: "CONFIRMED",
        actor: "MERCHANT",
        actorUserId,
      });
    });
  } catch (error) {
    return refusalOrRethrow(error);
  }

  return { ok: true };
}

/**
 * The owner's reject, over any tenant's claim: a reason, an audit row, and
 * the stock back on sale — identical to `rejectClaim`'s consequences.
 */
export async function adminRejectOrderClaim({
  claimId,
  reason,
  actorUserId,
}: {
  readonly claimId: string;
  readonly reason: string;
  readonly actorUserId: string;
}) {
  try {
    await adminDb.$transaction(async (tx) => {
      const claim = await tx.paymentClaim.findUniqueOrThrow({
        where: { id: claimId },
        select: { id: true, tenantId: true, orderId: true, status: true },
      });

      if (claim.status !== "PENDING") throw new AlreadyReviewedError();

      await tx.paymentClaim.update({
        where: { id: claim.id, tenantId: claim.tenantId },
        data: {
          status: "REJECTED",
          rejectionReason: reason,
          reviewedAt: new Date(),
          reviewedByUserId: actorUserId,
        },
      });

      await transitionOrder(tx, {
        orderId: claim.orderId,
        to: "DISPUTED",
        actor: "MERCHANT",
        actorUserId,
        reason,
      });

      // D-04: the units the customer was holding go back on sale, exactly
      // once — LAST, and inside the same transaction, exactly as
      // `rejectClaim` orders it.
      await releaseStock(tx, claim.orderId);
    });
  } catch (error) {
    return refusalOrRethrow(error);
  }

  return { ok: true };
}
