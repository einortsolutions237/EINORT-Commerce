import "server-only";

import { strings } from "@/lib/strings";
import { postSystemMessageAsAdmin } from "@/server/admin/support";
import { adminDb } from "@/server/db/admin";
import type { ClaimStatus, PaymentOperator } from "@/server/db/enums";
import type { ActionResult } from "@/server/merchant/action";
import { AlreadyReviewedError } from "@/server/orders/errors";

/**
 * SUB-03's platform half (06-UI-SPEC.md § C4, D-20), and the review surface's
 * data layer.
 *
 * ---------------------------------------------------------------------------
 * THIS IS THE ONLY MODULE IN `src/` THAT WRITES `SubscriptionPaymentClaim
 * .status`, AND THE ONLY ONE THAT WRITES `Organization
 * .subscriptionCurrentPeriodEnd`.
 * ---------------------------------------------------------------------------
 * `src/server/subscription/claims.ts` (plan 06-15) is the merchant's half —
 * it creates a `PENDING` row and never touches `status` again past that
 * initial value, and it never writes the organization's period end at all.
 * This module is the platform owner's half: it reviews a row somebody else
 * created and is the sole place the decision is made. Two modules, two
 * invariants, the same trust-boundary split `src/server/claims/submit.ts`
 * (create) and `src/server/claims/actions.ts` (review) already use for
 * `PaymentClaim` — restated here rather than copied, because a subscription
 * claim's payee is the platform itself, not a merchant, so this module has
 * no merchant-side sibling to delegate a shared writer to the way
 * `src/server/admin/claims.ts` delegates the order-state write to
 * `transitionOrder`.
 *
 * ---------------------------------------------------------------------------
 * KD-V2-02 — THE ENTITLEMENT-ENFORCEMENT DEFERRAL, STATED IN FULL.
 * ---------------------------------------------------------------------------
 * Confirming a claim here STORES AND DISPLAYS
 * `Organization.subscriptionCurrentPeriodEnd`. `resolveEntitlements`
 * (`src/server/entitlements/resolve.ts`) is DELIBERATELY NOT taught to expire
 * on this column in this phase. Doing so would change `canWrite` semantics
 * for every entitlement-gated action in the product — every catalog write,
 * every order transition, every theme publish — which is tracked as
 * `KD-V2-02` in `.planning/STATE.md` as the milestone's single largest hidden
 * cost, and belongs to a later plan's deliberate decision, not to a quiet
 * edit made in passing here. `tests/isolation/subscription-claims.test.ts`
 * turns this into a structural guard: it reads `resolve.ts` from disk and
 * fails if `subscriptionCurrentPeriodEnd` appears in its logic, so a later
 * plan that DOES want to wire enforcement has to edit that test on purpose
 * rather than trip it by accident.
 *
 * ---------------------------------------------------------------------------
 * THE ADMIN CLIENT IS UNSCOPED. EVERY OPERATION NAMES `tenantId` WHEREVER IT
 * IS KNOWN.
 * ---------------------------------------------------------------------------
 * `adminDb` carries no tenant predicate, so nothing here can rely on one
 * being injected the way the merchant-side write layer's Prisma Client
 * Extension injects it automatically. Every `where` and every `data` payload
 * below that can name the row's tenant does, even where a cuid primary key
 * would technically already be enough on its own — matching the discipline
 * `src/server/admin/claims.ts`'s header states at length. The one read that
 * cannot yet name it — `subscriptionPaymentClaim.findUniqueOrThrow({ where:
 * { id: claimId } })` — is what DISCOVERS the tenant; every operation after
 * it uses the value that read returned.
 *
 * ---------------------------------------------------------------------------
 * THE OPTIMISTIC LOCK IS INSIDE THE TRANSACTION, BEFORE ANYTHING IS WRITTEN.
 * ---------------------------------------------------------------------------
 * Two admin browser tabs open on the same claim is the normal case, not an
 * attack — the same posture `src/server/claims/actions.ts` and
 * `src/server/admin/claims.ts` both take for `PaymentClaim`. Both writers
 * below re-read the claim's `status` inside the transaction and throw
 * `AlreadyReviewedError` the instant it is not `PENDING`, before any update
 * runs. The loser of a race re-reads a row the winner already flipped and
 * rolls back having changed nothing.
 *
 * ---------------------------------------------------------------------------
 * `resolveNextPeriodEnd` IS EXPORTED SO THE REVIEW PAGE CAN DISPLAY THE SAME
 * ANSWER IT WOULD WRITE.
 * ---------------------------------------------------------------------------
 * `/admin/subscriptions`'s confirm dialog (plan 06-16 Task 2) quotes the
 * resulting period end BEFORE the owner taps confirm — "This extends {store}'s
 * subscription through {date}". That sentence and the value this module
 * actually writes must never be able to disagree, so both read through this
 * one pure function rather than two independent expressions of "one month
 * from now, or from the existing period end, whichever is later".
 */

/**
 * Bounded at pilot scale, the same idiom `ADMIN_CLAIM_LEDGER_ROW_CAP`
 * (`src/server/admin/claims.ts`) documents at length: a platform running many
 * thousands of pending subscription claims at once would exceed this and the
 * ledger would silently drop its tail. Revisiting this — pagination, most
 * plausibly — is a follow-up for whenever pilot volume approaches it.
 */
const ADMIN_SUBSCRIPTION_LEDGER_ROW_CAP = 1000;

/** A confirmed subscription runs for exactly one calendar month per payment. */
const SUBSCRIPTION_PERIOD_MONTHS = 1;

const SYSTEM_MESSAGE_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

/**
 * "One month from now, or from the organization's existing period end,
 * whichever is later" — as a pure function, so a merchant paying early is
 * EXTENDED rather than reset (06-RESEARCH.md Open Question 1, 06-UI-SPEC.md
 * Open Item #3).
 *
 * `existing` is the value read INSIDE the confirming transaction, never a
 * value fetched earlier — see `confirmSubscriptionClaim`. The review page
 * (plan 06-16 Task 2) calls this with the same organization row it just read
 * for display, which is how the confirm dialog's quoted date and the value
 * this module writes stay incapable of disagreeing.
 */
export function resolveNextPeriodEnd(existing: Date | null, now: Date): Date {
  const base = existing !== null && existing.getTime() > now.getTime() ? existing : now;
  const next = new Date(base);
  next.setMonth(next.getMonth() + SUBSCRIPTION_PERIOD_MONTHS);
  return next;
}

/** One row of the § C4 ledger — a claim, the merchant it belongs to, and the organization's live period end. */
export interface AdminSubscriptionClaimRow {
  readonly id: string;
  readonly tenantId: string;
  readonly storeName: string;
  /** The submit-time SNAPSHOT tier, never the organization's live `planTier`. */
  readonly planTier: string;
  readonly amountXaf: number;
  readonly operator: PaymentOperator;
  readonly reference: string;
  readonly submittedAt: Date;
  /** This CLAIM's own reviewed-through date. `null` while unreviewed. */
  readonly coversThrough: Date | null;
  readonly status: ClaimStatus;
  readonly receiptKey: string | null;
  /**
   * The organization's CURRENT live period end — distinct from `coversThrough`
   * above, which is this one claim's own history. Confirming a still-`PENDING`
   * row would extend FROM this value; the review page resolves
   * `resolveNextPeriodEnd(organizationCurrentPeriodEnd, now)` to show what
   * confirming right now would produce, never recomputing it client-side.
   */
  readonly organizationCurrentPeriodEnd: Date | null;
}

/**
 * The § C4 ledger, newest first, optionally narrowed to one status and/or one
 * store — the subscription-payments sibling of `listOrderClaimsForAdmin`.
 * Cross-tenant by construction.
 *
 * `merchantId` (not `tenantId`) is a QUERY parameter naming which store's rows
 * to look at — never the identity function `tests/unit/no-tenant-id-param
 * .test.ts` scans for, exactly as `listOrderClaimsForAdmin`'s own header
 * explains.
 *
 * No raw SQL: `SubscriptionPaymentClaim.tenantId` is a bare scalar, not a
 * declared Prisma relation, so the store name and live period end are
 * resolved with a second `organization.findMany` and merged by a `Map`,
 * matching `listOrderClaimsForAdmin`'s own shape.
 */
export async function listSubscriptionClaimsForAdmin(
  filter: { readonly status?: ClaimStatus; readonly merchantId?: string } = {},
): Promise<readonly AdminSubscriptionClaimRow[]> {
  const claims = await adminDb.subscriptionPaymentClaim.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.merchantId ? { tenantId: filter.merchantId } : {}),
    },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      tenantId: true,
      operator: true,
      reference: true,
      amountXaf: true,
      planTier: true,
      receiptKey: true,
      status: true,
      submittedAt: true,
      coversThrough: true,
    },
    take: ADMIN_SUBSCRIPTION_LEDGER_ROW_CAP,
  });

  if (claims.length === 0) return [];

  const tenantIds = [...new Set(claims.map((claim) => claim.tenantId))];
  const organizations = await adminDb.organization.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true, subscriptionCurrentPeriodEnd: true },
  });
  const organizationByTenant = new Map(
    organizations.map((org) => [org.id, org] as const),
  );

  return claims.map((claim) => {
    const organization = organizationByTenant.get(claim.tenantId);
    return {
      id: claim.id,
      tenantId: claim.tenantId,
      storeName: organization?.name ?? claim.tenantId,
      planTier: claim.planTier,
      amountXaf: claim.amountXaf,
      operator: claim.operator,
      reference: claim.reference,
      submittedAt: claim.submittedAt,
      coversThrough: claim.coversThrough,
      status: claim.status,
      receiptKey: claim.receiptKey,
      organizationCurrentPeriodEnd: organization?.subscriptionCurrentPeriodEnd ?? null,
    };
  });
}

/**
 * How many subscription claims, across every tenant, are waiting for the
 * platform owner. Feeds the admin rail's gold badge (§ C0) and this page's
 * subline. A `count()`, not a counter column — same doctrine
 * `pendingOrderClaimCount` (`src/server/admin/claims.ts`) states at length.
 */
export function pendingSubscriptionClaimCount(): Promise<number> {
  return adminDb.subscriptionPaymentClaim.count({ where: { status: "PENDING" } });
}

/**
 * The one routine refusal a review can produce, converted to something a
 * caller can render — matching `src/server/admin/claims.ts`'s
 * `refusalOrRethrow` discipline verbatim, down to reusing
 * `strings.claims.alreadyReviewed` rather than writing a second copy of the
 * same sentence.
 */
function refusalOrRethrow(error: unknown): ActionResult<unknown> {
  if (error instanceof AlreadyReviewedError) {
    return { ok: false, error: { form: [strings.claims.alreadyReviewed] } };
  }
  throw error;
}

/**
 * The owner confirms a subscription payment: the claim moves to `CONFIRMED`,
 * the organization's subscription becomes (or stays) active through the
 * resulting period end, and the merchant is told in their own thread — all
 * inside one transaction.
 *
 * `coversThrough` is computed from the organization row read INSIDE this
 * transaction (never from a value resolved before the call), so a claim
 * confirmed a moment after another one for the same tenant still extends
 * from the truth at the instant it commits.
 */
export async function confirmSubscriptionClaim({
  claimId,
  actorUserId,
}: {
  readonly claimId: string;
  readonly actorUserId: string;
}): Promise<ActionResult<unknown>> {
  try {
    await adminDb.$transaction(async (tx) => {
      const claim = await tx.subscriptionPaymentClaim.findUniqueOrThrow({
        where: { id: claimId },
        select: { id: true, tenantId: true, status: true },
      });

      // THE OPTIMISTIC LOCK. Inside the transaction, before anything is
      // written. See the file header.
      if (claim.status !== "PENDING") throw new AlreadyReviewedError();

      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: claim.tenantId },
        select: { subscriptionCurrentPeriodEnd: true },
      });

      const now = new Date();
      const coversThrough = resolveNextPeriodEnd(
        organization.subscriptionCurrentPeriodEnd,
        now,
      );

      await tx.subscriptionPaymentClaim.update({
        where: { id: claim.id, tenantId: claim.tenantId },
        data: {
          status: "CONFIRMED",
          reviewedAt: now,
          reviewedByUserId: actorUserId,
          coversThrough,
        },
      });

      // ONLY WRITER of `Organization.subscriptionCurrentPeriodEnd`. See the
      // file header.
      await tx.organization.update({
        where: { id: claim.tenantId },
        data: {
          subscriptionStatus: "active",
          subscriptionCurrentPeriodEnd: coversThrough,
        },
      });

      const body = strings.support.system.subscriptionConfirmed.replace(
        "{date}",
        SYSTEM_MESSAGE_DATE_FORMATTER.format(coversThrough),
      );

      // Inside the SAME transaction — a crash between the state change and
      // its own announcement must not leave a confirmed subscription with no
      // record of why in the merchant's thread (D-15's repudiation guard).
      await postSystemMessageAsAdmin(claim.tenantId, body, {
        subscriptionClaimId: claim.id,
        tx,
      });
    });
  } catch (error) {
    return refusalOrRethrow(error);
  }

  return { ok: true };
}

/**
 * The owner rejects a subscription payment: the claim moves to `REJECTED`
 * with the owner's reason, and the merchant is told in their own thread.
 * `Organization.subscriptionStatus` and `.subscriptionCurrentPeriodEnd` are
 * untouched — a rejection changes nothing about what the merchant is
 * entitled to.
 */
export async function rejectSubscriptionClaim({
  claimId,
  reason,
  actorUserId,
}: {
  readonly claimId: string;
  readonly reason: string;
  readonly actorUserId: string;
}): Promise<ActionResult<unknown>> {
  try {
    await adminDb.$transaction(async (tx) => {
      const claim = await tx.subscriptionPaymentClaim.findUniqueOrThrow({
        where: { id: claimId },
        select: { id: true, tenantId: true, status: true },
      });

      if (claim.status !== "PENDING") throw new AlreadyReviewedError();

      await tx.subscriptionPaymentClaim.update({
        where: { id: claim.id, tenantId: claim.tenantId },
        data: {
          status: "REJECTED",
          rejectionReason: reason,
          reviewedAt: new Date(),
          reviewedByUserId: actorUserId,
        },
      });

      const body = strings.support.system.subscriptionRejected.replace(
        "{reason}",
        reason,
      );

      await postSystemMessageAsAdmin(claim.tenantId, body, {
        subscriptionClaimId: claim.id,
        tx,
      });
    });
  } catch (error) {
    return refusalOrRethrow(error);
  }

  return { ok: true };
}
