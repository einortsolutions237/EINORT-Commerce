import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CircleCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Composer } from "@/components/support/composer";
import { MessageList } from "@/components/support/message-list";
import { ScrollToLatest } from "@/components/support/scroll-to-latest";
import { SubscriptionClaimCard } from "@/components/subscription-claim-card";
import { strings } from "@/lib/strings";
import { requireAdminContext } from "@/server/admin/context";
import { merchantDetailForAdmin } from "@/server/admin/queries";
import {
  firstUnreadForPlatform,
  markThreadReadForPlatform,
  threadForAdmin,
} from "@/server/admin/support";
import { subscriptionClaimsForThread } from "@/server/admin/subscription-claims";
import { IMAGE_PRESETS } from "@/server/images/pipeline";
import { publicUrlFor } from "@/server/images/r2";

/**
 * `/admin/support/[tenantId]` — one merchant's thread, the platform side,
 * § C6 (ADM-03 / ADM-05 / D-11 / D-12 / D-20).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireAdminContext()` is called here, not inherited from
 * `src/app/admin/layout.tsx` — the layout is a shell, not an authorization
 * boundary. `React.cache()` makes the repeated call free.
 *
 * ---------------------------------------------------------------------------
 * A NON-MATCHING `tenantId` CALLS `notFound()` — THE SAME RESPONSE AN
 * UNAUTHORIZED CALLER GETS (D-06, T-06-58).
 * ---------------------------------------------------------------------------
 * `tenantId` is the one path segment a caller fully controls, and it is the
 * only client-supplied tenant identifier anywhere on the admin surface.
 * `merchantDetailForAdmin` returns `null` for any id that does not match a
 * row, and this page's only response to that is `notFound()` — the same
 * branded 404 `requireAdminContext()` throws for an anonymous or non-admin
 * caller — matching `/admin/merchants/[id]/page.tsx`'s own precedent.
 *
 * ---------------------------------------------------------------------------
 * READ THE FIRST-UNREAD BOUNDARY BEFORE MARKING THE THREAD READ. IN THAT
 * ORDER, ALWAYS.
 * ---------------------------------------------------------------------------
 * `firstUnreadForPlatform` runs (inside the `Promise.all` below) BEFORE
 * `markThreadReadForPlatform` runs, on the line beneath it — the identical
 * ordering dependency `/dashboard/support/page.tsx`'s own header documents,
 * mirrored here for the platform owner's side of the same table. Reverse
 * that order and every message would already read as read by the time the
 * boundary is computed, so the "New" divider would never render. The rail's
 * unread badge clears by the owner simply opening this page; there is no
 * manual control anywhere in this tree for it, so this call is the ONLY
 * place a thread is ever marked read for the platform.
 *
 * ---------------------------------------------------------------------------
 * THE COMPOSER IS THE SAME COMPONENT, MIRRORED BY THE SAME PLATFORM-SIDE
 * `viewer` VALUE THE THREAD BELOW ALSO PASSES.
 * ---------------------------------------------------------------------------
 * `Composer` (plan 06-09, extended by this plan) took no props before this
 * page existed — see that file's own header on why `viewer`/`tenantId` were
 * added rather than this page forking a second composer. There is no SUB-03
 * entry line here at all: that line is `/dashboard/support/page.tsx`'s own
 * `<p>` block, never part of `Composer` itself, so there is nothing to strip
 * — this page simply never renders it.
 *
 * ---------------------------------------------------------------------------
 * A `SYSTEM` MESSAGE CARRYING `subscriptionClaimId` RENDERS THE INLINE CARD,
 * READ-ONLY, WITH A LINK TO THE ONE DECISION SURFACE.
 * ---------------------------------------------------------------------------
 * § C6: `SubscriptionClaimCard` renders below such a message, and it takes NO
 * action props by construction — confirming or rejecting a subscription
 * payment happens on `/admin/subscriptions` and nowhere else (D-20). The
 * referenced claims are fetched in ONE `findMany`
 * (`subscriptionClaimsForThread`), keyed by the `subscriptionClaimId` values
 * already present on `rows` after the thread read above — never one query
 * per message. The link to `/admin/subscriptions` is rendered by THIS page,
 * beside the card, not as a prop the card itself accepts: see that
 * component's own header for why it takes none.
 */

export const metadata: Metadata = {
  // Renders as "Inbox · EINORT" — the parent inbox's title, reused rather
  // than the store's own name, matching `/admin/merchants/[id]/page.tsx`'s
  // own precedent of not inventing new admin-facing metadata copy per row.
  title: strings.admin.inbox.title,
};

const STATUS_CHIP = {
  active: { icon: CircleCheck, variant: "outline-success" as const },
  suspended: { icon: Ban, variant: "destructive" as const },
};

/** The `thread` preset's single derivative (`src/server/images/pipeline.ts`), matching
 * `/admin/subscriptions/page.tsx`'s own `RECEIPT_DERIVATIVE`. */
const RECEIPT_DERIVATIVE = `${IMAGE_PRESETS.thread.labels[0]}.${IMAGE_PRESETS.thread.format}`;

export default async function AdminSupportThreadPage({
  params,
}: {
  readonly params: Promise<{ tenantId: string }>;
}) {
  await requireAdminContext();
  const { tenantId } = await params;

  const merchant = await merchantDetailForAdmin(tenantId);
  if (merchant === null) {
    notFound();
  }

  const [rows, firstUnreadAt] = await Promise.all([
    threadForAdmin(tenantId),
    firstUnreadForPlatform(tenantId),
  ]);

  // MUST run after the two reads above — see this file's header.
  await markThreadReadForPlatform(tenantId);

  /*
   * The inline claim cards' data, fetched in ONE query alongside the thread
   * read above — never one query per message. `claimIds` collects the
   * non-null `subscriptionClaimId` values already present on `rows`; a
   * thread with none costs nothing beyond the empty check inside
   * `subscriptionClaimsForThread`.
   */
  const claimIds = [
    ...new Set(
      rows
        .map((row) => row.subscriptionClaimId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const claims = await subscriptionClaimsForThread(tenantId, claimIds);
  const claimById = new Map(claims.map((claim) => [claim.id, claim] as const));

  /*
   * The named slot `MessageList` exposes (see that component's own header).
   * Pure and synchronous — every claim it can possibly need was already
   * resolved above, so this never awaits anything mid-render.
   */
  function renderClaimCard(row: (typeof rows)[number]) {
    if (row.subscriptionClaimId === null) return null;
    const claim = claimById.get(row.subscriptionClaimId);
    if (!claim) return null;

    return (
      <div className="flex flex-col gap-2">
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
        <Link
          href="/admin/subscriptions"
          className="self-start text-sm leading-normal font-semibold text-muted-foreground hover:text-foreground hover:underline"
        >
          {strings.admin.nav.subscriptions}
        </Link>
      </div>
    );
  }

  const chip =
    merchant.status === "active" ? STATUS_CHIP.active : STATUS_CHIP.suspended;
  const StatusIcon = chip.icon;
  const statusLabel =
    merchant.status === "active"
      ? strings.admin.storeStatus.active
      : strings.admin.storeStatus.suspended;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/support"
          className="text-sm leading-normal font-semibold text-muted-foreground hover:text-foreground"
        >
          {strings.admin.inbox.backToInbox}
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
              {merchant.storeName}
            </h1>
            <Badge variant={chip.variant}>
              <StatusIcon aria-hidden="true" />
              {statusLabel}
            </Badge>
          </div>

          <Button variant="outline" className="min-h-11" render={<Link href={`/admin/merchants/${merchant.id}`} />}>
            {strings.admin.inbox.viewMerchant}
          </Button>
        </div>

        <p className="text-sm leading-normal font-normal text-muted-foreground">
          {merchant.ownerName} · {merchant.ownerEmail}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <h2 className="text-lg leading-snug font-semibold text-foreground">
            {strings.admin.inbox.threadEmptyHeading}
          </h2>
          <p className="max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {strings.admin.inbox.threadEmptyBody.replace(
              "{store}",
              merchant.storeName,
            )}
          </p>
        </div>
      ) : (
        <MessageList
          rows={rows}
          viewer="PLATFORM"
          authorOtherLabel={merchant.storeName}
          firstUnreadAt={firstUnreadAt}
          renderBelowMessage={renderClaimCard}
        />
      )}

      <Composer viewer="PLATFORM" tenantId={tenantId} />

      <ScrollToLatest />
    </div>
  );
}
