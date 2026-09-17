import type { Metadata } from "next";
import Link from "next/link";

import { Composer } from "@/components/support/composer";
import { MessageList } from "@/components/support/message-list";
import { ScrollToLatest } from "@/components/support/scroll-to-latest";
import { SubscriptionClaimCard } from "@/components/subscription-claim-card";
import { strings } from "@/lib/strings";
import { scopedDb } from "@/server/db/tenant-scoped";
import { IMAGE_PRESETS } from "@/server/images/pipeline";
import { publicUrlFor } from "@/server/images/r2";
import { requireMerchantContextAllowSuspended } from "@/server/merchant/context";
import {
  firstUnreadForMerchant,
  threadForMerchant,
} from "@/server/support/queries";
// Imported after `queries` — see this file's header on why
// `firstUnreadForMerchant` must be read before `markThreadReadForMerchant`
// runs; the import order below mirrors the call order it protects.
import { markThreadReadForMerchant } from "@/server/support/messages";

/**
 * `/dashboard/support` — the merchant's side of the thread. ADM-05 / D-07 /
 * D-10..D-13 / SUB-03 (06-UI-SPEC.md § A2).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF — AND IS THE ONE PAGE THAT STAYS OPEN WHILE
 * SUSPENDED.
 * ---------------------------------------------------------------------------
 * `requireMerchantContextAllowSuspended()` is called here, not
 * `requireMerchantContext()` and not inherited from `(dashboard)/layout.tsx`
 * — the layout is a shell, explicitly not an authorization boundary. Every
 * page under this route group repeats the call for that reason; it is
 * `React.cache()`-memoized, so the repetition costs nothing.
 *
 * The `AllowSuspended` variant is deliberate here specifically: see its own
 * header in `src/server/merchant/context.ts` for why a suspended merchant
 * must still reach this one page. `ctx.suspended` renders the inline notice
 * below; every other page in this route group still calls the strict
 * `requireMerchantContext()` and still redirects a suspended merchant to
 * `/suspended`.
 *
 * ---------------------------------------------------------------------------
 * READ THE FIRST-UNREAD BOUNDARY BEFORE MARKING THE THREAD READ. IN THAT
 * ORDER, ALWAYS.
 * ---------------------------------------------------------------------------
 * `firstUnreadForMerchant` runs (inside the `Promise.all` below) BEFORE
 * `markThreadReadForMerchant` runs, on the line beneath it. Reverse that
 * order — or worse, fold them into one combined step — and every message
 * would already read as read by the time the boundary is computed, so the
 * "New" divider would never render. The rail's unread badge clears by the
 * merchant simply navigating here (06-UI-SPEC.md § A2's "Unread rule");
 * there is no manual control anywhere in this tree for it, so this call is
 * the ONLY place the thread is ever marked read for the merchant.
 *
 * ---------------------------------------------------------------------------
 * A `SYSTEM` MESSAGE CARRYING `subscriptionClaimId` RENDERS THE INLINE CARD,
 * READ-ONLY, WITH NO LINK (SUB-03 / D-20).
 * ---------------------------------------------------------------------------
 * `SubscriptionClaimCard` takes no action props by construction — confirming
 * or rejecting a subscription payment happens on the platform owner's own
 * review page, which this merchant has no route to and which this page
 * never links to. The
 * merchant's own view of the SAME claim already lives on `/dashboard/plan`,
 * and `strings.plan.subscriptionClaim`'s `awaitingLink` already points the
 * other way ("See it in Support"), so no reciprocal link is added here. The
 * referenced claims are fetched in ONE `findMany` through the tenant-scoped
 * client, keyed by the `subscriptionClaimId` values already present on
 * `rows` — never one query per message.
 */

export const metadata: Metadata = {
  title: strings.support.page.title,
};

/** The `thread` preset's single derivative (`src/server/images/pipeline.ts`). */
const RECEIPT_DERIVATIVE = `${IMAGE_PRESETS.thread.labels[0]}.${IMAGE_PRESETS.thread.format}`;

export default async function SupportPage() {
  const ctx = await requireMerchantContextAllowSuspended();

  const [rows, firstUnreadAt] = await Promise.all([
    threadForMerchant(ctx.tenantId),
    firstUnreadForMerchant(ctx.tenantId),
  ]);

  // MUST run after the two reads above — see this file's header.
  await markThreadReadForMerchant(ctx.tenantId);

  /*
   * The inline claim cards' data, fetched in ONE query alongside the thread
   * read above — never one query per message. See this file's header.
   */
  const claimIds = [
    ...new Set(
      rows
        .map((row) => row.subscriptionClaimId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const claims =
    claimIds.length === 0
      ? []
      : await scopedDb(ctx.tenantId).subscriptionPaymentClaim.findMany({
          where: { id: { in: claimIds } },
          select: {
            id: true,
            status: true,
            operator: true,
            reference: true,
            amountXaf: true,
            rejectionReason: true,
            submittedAt: true,
            coversThrough: true,
            receiptKey: true,
          },
        });
  const claimById = new Map(claims.map((claim) => [claim.id, claim] as const));

  /** The named slot `MessageList` exposes — pure and synchronous, matching its own contract. */
  function renderClaimCard(row: (typeof rows)[number]) {
    if (row.subscriptionClaimId === null) return null;
    const claim = claimById.get(row.subscriptionClaimId);
    if (!claim) return null;

    return (
      <SubscriptionClaimCard
        status={claim.status}
        operator={claim.operator}
        reference={claim.reference}
        amountXaf={claim.amountXaf}
        rejectionReason={claim.rejectionReason}
        submittedAt={claim.submittedAt}
        coversThrough={claim.coversThrough}
        receiptUrl={
          claim.receiptKey === null
            ? null
            : publicUrlFor(`${claim.receiptKey}/${RECEIPT_DERIVATIVE}`)
        }
      />
    );
  }

  /*
   * SUB-03 entry point (R-3): only when unsubscribed AND the trial has run
   * out. `resolveEntitlements` has no separate "unpaid" state to check —
   * `subscriptionStatus` is either "active" or it is not, so an active
   * trial (not yet subscribed, not yet expired) is deliberately NOT this
   * state: the merchant is not overdue for anything yet. Read straight off
   * the entitlements the merchant context already carries; this is not a
   * second query.
   */
  const showSubscriptionPrompt = ctx.trial.state === "expired";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.support.page.heading}
        </h1>
        <p className="text-base leading-normal font-normal text-muted-foreground">
          {strings.support.page.subline}
        </p>
      </div>

      {ctx.suspended ? (
        <p className="rounded-lg border border-border bg-muted px-4 py-3 text-base leading-normal font-normal text-foreground">
          {strings.support.page.suspendedNotice}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <h2 className="text-lg leading-snug font-semibold text-foreground">
            {strings.support.page.emptyHeading}
          </h2>
          <p className="max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {strings.support.page.emptyBody}
          </p>
        </div>
      ) : (
        <MessageList
          rows={rows}
          viewer="MERCHANT"
          authorOtherLabel={strings.support.thread.authorOther}
          firstUnreadAt={firstUnreadAt}
          downloadBasePath="/api/support/attachment"
          renderBelowMessage={renderClaimCard}
        />
      )}

      {showSubscriptionPrompt ? (
        <p className="text-base leading-normal font-normal text-foreground">
          {strings.support.page.subscriptionPrompt}
          <Link
            href="/dashboard/plan"
            className="underline underline-offset-3"
          >
            {strings.support.page.subscriptionLink}
          </Link>
        </p>
      ) : null}

      <Composer />

      <ScrollToLatest />
    </div>
  );
}
