"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import { strings } from "@/lib/strings";
import { PaymentOperator } from "@/server/db/enums";
import type { PaymentClaimCreateInput } from "@/server/db/model-inputs";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";
import { derivativePrefixFor, objectKeyFor } from "@/server/images/r2";
import { OutOfStockError } from "@/server/orders/errors";
/*
 * Namespace imports below keep each helper's name at the ONE line that uses it,
 * so a grep for the stock hold or the claim limiter across `src/` returns call
 * sites rather than import lines. That matters here more than usual: both are
 * the subject of acceptance greps in 03-15-PLAN.md, and both are rules a reader
 * has to be able to locate in one hop.
 */
import * as stock from "@/server/orders/stock";
/*
 * Aliased for the same reason the tracking page aliases it: the resolver's name
 * appears once, and that single occurrence is the D-12 audit anchor — one call,
 * one authorization decision, no second way into an order.
 */
import { findOrderByTrackingToken as findOrder } from "@/server/orders/tracking";
import { hashTrackingToken } from "@/server/orders/tracking-token";
import { transitionOrder } from "@/server/orders/transition";
import * as rateLimit from "@/server/rate-limit";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

import { notifyMerchantOfClaim } from "./notify";
import * as claimReference from "./reference";

/**
 * CHK-04 / ORD-02 / ORD-04 / D-11 — the customer's half of the payment loop.
 *
 * ---------------------------------------------------------------------------
 * THIS ACTION CANNOT SETTLE A PAYMENT, AND THE PROOF IS A GREP.
 * ---------------------------------------------------------------------------
 * A claim is an ASSERTION. Its target is `PAYMENT_CLAIMED` and its actor is
 * `CUSTOMER`, and the word naming the settled state does not appear anywhere in
 * this file — `tests/isolation/claim-submission.test.ts` asserts that against
 * the source, in the spirit of `tests/unit/single-order-state-writer.test.ts`.
 * The requirement ORD-02 states is not "we do not auto-confirm"; it is "there is
 * nowhere an auto-confirmation could be written" (T-03-76). Even if this line
 * were ever edited, `transitionOrder` refuses the settled state for any actor
 * that is not `MERCHANT` one level down, and `src/server/claims/actions.ts` is
 * the only module in `src/` permitted to settle a claim row.
 *
 * ---------------------------------------------------------------------------
 * THERE IS NO AMOUNT FIELD, AND THERE MUST NEVER BE ONE.
 * ---------------------------------------------------------------------------
 * `amountClaimedXaf` is copied from `Order.totalXaf`, which `placeOrder` read
 * out of the catalogue inside the transaction that wrote the order. The
 * merchant's claims queue shows an A5 mismatch line when the claimed amount
 * differs from the order total — and that comparison is only meaningful while
 * one side of it is the server's own number. A customer-supplied amount would
 * make the check compare a forgeable value against itself and quietly turn a
 * control into decoration (T-03-79). The schema below has no such field, so
 * there is no property for a forged amount to arrive in.
 *
 * ---------------------------------------------------------------------------
 * NOT A `merchantAction`. THE CREDENTIAL IS THE TRACKING TOKEN.
 * ---------------------------------------------------------------------------
 * Checkout is accountless (CHK-01), so this caller has no session. `slug` is
 * resolved against Postgres and fails closed; `token` is matched against a
 * digest INSIDE that store's scope, so another store's live token matches
 * nothing here rather than matching and then being filtered out. A malformed
 * token, an unknown token, an unknown store and another store's token all
 * produce one identical refusal — a distinguishable failure would be an oracle
 * over which links exist (T-03-77).
 *
 * ---------------------------------------------------------------------------
 * ORD-04 IS THE DATABASE'S JOB, NOT THIS FILE'S.
 * ---------------------------------------------------------------------------
 * The duplicate check is `@@unique([tenantId, referenceNormalized])` and the
 * unique-violation code it raises. It is deliberately NOT a `count()` before
 * the insert: two
 * customers submitting the same reference in the same second would both read
 * zero and both write, and the control would fail exactly when it was being
 * exercised. A unique index cannot be raced (T-03-75).
 *
 * The refusal names no other order. Telling a customer WHICH order already
 * holds their reference would leak another customer's order number to anyone
 * willing to guess at references, inside a store where they are a stranger.
 *
 * ---------------------------------------------------------------------------
 * D-11'S RESUBMISSION RE-HOLDS THE STOCK BEFORE THE ORDER MOVES.
 * ---------------------------------------------------------------------------
 * A rejection put the units back on sale (`rejectClaim`), and during the
 * dispute window somebody else may have bought them. So a `DISPUTED`
 * resubmission re-holds FIRST: if the hold fails the whole transaction rolls
 * back, the claim is never written, and the order stays disputed. Moving the
 * order into the payment path over inventory that now belongs to another order
 * is the oversell `src/server/orders/stock.ts` warns about, and nobody would
 * find out until a shelf was counted (RESEARCH.md assumption A6).
 */

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

/** The codebase's `ActionResult` shape — a discriminated union, never a raise. */
export type SubmitClaimResult =
  | { ok: true }
  | { ok: false; error: Record<string, string[]> };

function fail(field: string, message: string): SubmitClaimResult {
  return { ok: false, error: { [field]: [message] } };
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Note what is absent: no tenant id, no order id, no amount, and no file name.
 *
 * `reference` is bounded rather than free: three characters is the floor below
 * which nothing an operator issues could be meant, and sixty-four is far above
 * the longest MoMo or Orange reference while keeping the column and the index
 * predictable.
 */
const submitClaimSchema = z.object({
  slug: z.string().min(1).max(64),
  token: z.string().min(1).max(64),
  operator: z.enum(PaymentOperator),
  reference: z.string().trim().min(3).max(64),
  /** The prefix the finalize route reported, or `null` when none was attached. */
  screenshotKey: z.string().max(256).nullable(),
});

/** The two states a claim may legitimately be submitted from. */
const CLAIMABLE_STATES = new Set(["PAYMENT_PENDING", "DISPUTED"]);

/**
 * Re-derive the screenshot key from the resolved tenant rather than trusting the
 * one the browser sent (T-03-23).
 *
 * The client is handed a prefix by the finalize route and hands it back here,
 * which is convenient and completely untrustworthy: nothing stops a caller
 * posting the prefix of ANOTHER store's claim screenshot, and the merchant's
 * claims queue renders whatever key the row carries. So the last segment is
 * treated as the only meaningful part, the key is rebuilt from `tenant.id` by
 * the one function that owns the layout, and a value that does not match what
 * was rebuilt is discarded.
 *
 * DISCARDED, not refused. The screenshot is optional by design, and a customer
 * must never lose a claim over an attachment — a mismatch here is either an
 * attack, which is now inert, or a stale client, which still gets its claim.
 */
function rebuildScreenshotKey(tenantId: string, submitted: string): string | null {
  const uploadId = submitted.slice(submitted.lastIndexOf("/") + 1);

  try {
    const rebuilt = derivativePrefixFor(
      objectKeyFor(tenantId, "claims", uploadId),
    );
    return rebuilt === submitted ? rebuilt : null;
  } catch {
    return null;
  }
}

/** A unique-constraint violation, recognised without importing the client. */
function isDuplicateReference(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

// ---------------------------------------------------------------------------
// The action
// ---------------------------------------------------------------------------

/**
 * Turn "I've paid" into exactly one reviewable claim, or into one sentence the
 * customer can act on.
 *
 * Never raises for an expected refusal. An unexpected failure is deliberately
 * not caught: it must stay visible in the logs rather than becoming a polite
 * sentence that hides a broken store.
 */
export async function submitClaim(input: unknown): Promise<SubmitClaimResult> {
  /*
   * ONE limiter, TWO buckets, and they answer different questions.
   *
   * The IP bucket runs first and before parsing, so a scripted caller sending
   * garbage still costs itself budget. The per-order bucket runs once the token
   * is known and is what caps resubmission spam against a single order — D-11
   * makes "submit again" legitimate and repeatable, so an IP-only budget would
   * either be too loose to matter or would lock out a whole Douala
   * neighbourhood egressing from one address.
   *
   * The key is the token's DIGEST, never the plaintext: the plaintext is what a
   * link-holder possesses, and it must not become an Upstash key that outlives
   * the request (T-03-05). Both buckets fail OPEN on an Upstash outage.
   */
  const limiter = rateLimit.claimSubmissionLimiter;

  const byCaller = await limiter.limit(`ip:${rateLimit.callerIp(await headers())}`);
  if (!byCaller.success) {
    return fail("form", strings.orderStatus.claimRateLimited);
  }

  const parsed = submitClaimSchema.safeParse(input);
  if (!parsed.success) {
    return fail("form", strings.checkout.genericError);
  }

  const { slug, token, operator, reference, screenshotKey } = parsed.data;

  const byOrder = await limiter.limit(`order:${hashTrackingToken(token)}`);
  if (!byOrder.success) {
    return fail("form", strings.orderStatus.claimRateLimited);
  }

  // The store, then the order. One answer for every way of not holding a valid
  // link — see the file header.
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return fail("form", strings.checkout.genericError);

  const order = await findOrder(tenant.id, token);
  if (!order) return fail("form", strings.checkout.genericError);

  /*
   * A claim against an order that is not waiting to be paid is not a thing. The
   * two claimable states are the first submission and D-11's correction; every
   * other state is either settled, delivered, or on a channel that has no
   * in-band payment for a claim to be about (D-02).
   */
  if (
    order.channel !== "MANUAL_TRANSFER" ||
    !CLAIMABLE_STATES.has(order.state)
  ) {
    return fail("form", strings.checkout.genericError);
  }

  /*
   * ORD-04's actual key. A blank result must be refused rather than stored: an
   * empty normalised reference would claim this tenant's one empty-string slot
   * under the unique index and permanently block every later claim that also
   * normalised to nothing.
   */
  const referenceNormalized = claimReference.normalizeReference(reference);
  if (referenceNormalized.length === 0) {
    return fail("reference", strings.orderStatus.claimDuplicateReference);
  }

  const storedScreenshotKey =
    screenshotKey === null
      ? null
      : rebuildScreenshotKey(tenant.id, screenshotKey);

  /*
   * Captured inside the transaction and read after it rolled back. The rollback
   * un-writes rows, not local variables — which is what lets the sold-out
   * message name the item, since the failing line is only known once the hold
   * has already failed.
   */
  let soldOutItemName: string | undefined;

  try {
    await scopedDb(tenant.id).$transaction(async (tx) => {
      if (order.state === "DISPUTED") {
        // `findOrder` does not select `variantId` — it is a customer-facing
        // read and a variant id is of no use on that page — so the stock lines
        // are read here, inside the transaction that will move them.
        const lines = await tx.orderItem.findMany({
          where: { orderId: order.id },
          select: { variantId: true, quantity: true, productName: true },
        });

        try {
          await stock.holdStockForLines(tx, lines);
        } catch (error) {
          if (error instanceof OutOfStockError) {
            soldOutItemName = lines.find(
              (line) => line.variantId === error.variantId,
            )?.productName;
          }
          // Rolls the whole transaction back, before the order has moved.
          throw error;
        }

        /*
         * `releaseStock` is keyed on `Order.stockHeld`, which the rejection
         * cleared. Without this line a SECOND rejection of the corrected claim
         * would find the flag false, release nothing, and strand the decrement
         * forever — the merchant's dashboard would under-report stock they
         * physically have, with nothing in the audit trail to explain it.
         */
        await stock.markStockHeld(tx, order.id);
      }

      await tx.paymentClaim.create({
        data: scopedCreateData<PaymentClaimCreateInput>({
          orderId: order.id,
          operator,
          // Stored exactly as typed — this is what the merchant compares
          // against their own SMS receipt — beside the normalised key the
          // ORD-04 index actually constrains.
          reference,
          referenceNormalized,
          amountClaimedXaf: order.totalXaf,
          screenshotKey: storedScreenshotKey,
          status: "PENDING",
        }),
        select: { id: true },
      });

      await transitionOrder(tx, {
        orderId: order.id,
        to: "PAYMENT_CLAIMED",
        actor: "CUSTOMER",
      });
    });
  } catch (error) {
    if (isDuplicateReference(error)) {
      return fail("reference", strings.orderStatus.claimDuplicateReference);
    }
    if (error instanceof OutOfStockError) {
      /*
       * Reused from the merchant's reopen path on purpose. It is the SAME event
       * — the `DISPUTED -> PAYMENT_CLAIMED` re-hold failing because the units
       * sold during the dispute window — and it says the two things this
       * customer needs: which item went, and that their order has not moved.
       * `src/lib/strings.ts`'s own header forbids writing one sentence twice,
       * slightly differently.
       */
      return fail(
        "form",
        soldOutItemName
          ? strings.claims.reopenOutOfStock.replace("{name}", soldOutItemName)
          : strings.checkout.genericError,
      );
    }
    throw error;
  }

  /*
   * D-13, and only once the claim row is committed. A deferred callback rather
   * than a bare floating promise: Next runs it once the response is flushed, so
   * the customer's page re-render never waits on a mail provider. The notifier
   * itself can never fail this call — it catches everything and degrades to a
   * warning, because the keys behind it are `.optional()` precisely so a
   * project deployed without email still takes claims (T-03-80).
   */
  after(() =>
    notifyMerchantOfClaim({
      tenantId: tenant.id,
      orderNumber: order.orderNumber,
      amountXaf: order.totalXaf,
      customerName: order.customerName,
    }),
  );

  return { ok: true };
}
