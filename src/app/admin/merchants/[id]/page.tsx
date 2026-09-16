import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CircleCheck, MessagesSquare } from "lucide-react";

import { DomainCell } from "@/components/admin/domain-cell";
import { SuspendRestoreControl } from "@/components/admin/suspend-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { env } from "@/env";
import { strings } from "@/lib/strings";
import { requireAdminContext } from "@/server/admin/context";
import { merchantDetailForAdmin } from "@/server/admin/queries";
import { threadForAdmin } from "@/server/admin/support";
import { resolveEntitlements } from "@/server/entitlements/resolve";

import { formatAbsoluteDate, planLabelFor } from "../../format";

/**
 * `/admin/merchants/[id]` — one store in full, § C2 (ADM-01 / ADM-03).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireAdminContext()` is called here, not inherited from
 * `src/app/admin/layout.tsx` — same rule as `page.tsx`, the layout is a shell.
 *
 * ---------------------------------------------------------------------------
 * A NON-MATCHING `id` calls `notFound()` — THE SAME RESPONSE AN UNAUTHORIZED
 * CALLER GETS (D-06, T-06-31).
 * ---------------------------------------------------------------------------
 * `id` is the one path segment a caller fully controls. `merchantDetailForAdmin`
 * returns `null` for any id that does not match a row, and this page's only
 * response to that is `notFound()` — the same branded 404
 * `requireAdminContext()` throws for an anonymous or non-admin caller. A
 * probed id therefore looks identical to a wrong one from outside.
 *
 * ---------------------------------------------------------------------------
 * ONE CARD STILL SHIPS SMALLER THAN `06-UI-SPEC.md § C2` DESCRIBES —
 * DELIBERATELY, NOT AN OVERSIGHT.
 * ---------------------------------------------------------------------------
 * The header's `Open support thread` button (plan 06-12) and the Store
 * status card's `SuspendRestoreControl` (this plan — see
 * `src/components/admin/suspend-dialog.tsx`) both land now. The Plan card's
 * `See subscription payments` link and the At a glance figures' own
 * per-figure ledger links still point at a destination that does not exist
 * until `/admin/subscriptions` (plan 06-16). `06-08-PLAN.md`'s own words: "a
 * menu item pointing at a 404 is worse than an absent one." That one
 * remaining case is a comment at the spot it will land, not a disabled
 * control.
 *
 * ---------------------------------------------------------------------------
 * "WHEN THE STATUS LAST CHANGED" IS DERIVED FROM THE THREAD, NOT A COLUMN.
 * ---------------------------------------------------------------------------
 * `Organization` carries no `statusChangedAt` — ADM-04 keeps this phase's
 * admin scope pilot-sized, and `src/server/admin/suspend.ts`'s own header
 * explains why the merchant's `SYSTEM`-authored thread message already IS
 * that record. `statusChangeLineFor` below reads the most recent matching
 * `SYSTEM` message from `threadForAdmin` rather than adding a column a
 * second writer could drift from the first.
 */

export const metadata: Metadata = {
  // Renders as "Merchants · EINORT" — the parent list's title, reused rather
  // than the store's own name, for the same reason
  // `/dashboard/products/[id]/page.tsx` does not put a product's name in its
  // title either: this page's own scope does not define new admin-facing
  // metadata copy.
  title: strings.admin.merchants.title,
};

const STATUS_CHIP = {
  active: { icon: CircleCheck, variant: "outline-success" as const },
  suspended: { icon: Ban, variant: "destructive" as const },
};

/**
 * The fixed prefix `strings.support.system.suspended` always carries before
 * its interpolated `{reason}` — matching against it is how this page reads
 * the reason back out of the thread rather than keeping a second copy of
 * that template.
 */
const SUSPENDED_MESSAGE_PREFIX = "Your store was suspended by EINORT. Reason: ";
/** `strings.support.system.restored` carries no `{reason}` token (R-2). */
const RESTORED_MESSAGE = "Your store was restored by EINORT.";

type ThreadMessage = { readonly author: string; readonly body: string; readonly createdAt: Date };

/**
 * The Store status card's Body line, derived from the thread rather than a
 * column — see the file header. `null` for an active store that has never
 * been suspended (the ordinary case for most of the pilot fleet); the
 * caller falls back to `fallbackActiveSince`.
 */
function statusChangeLineFor(
  status: string,
  messages: readonly ThreadMessage[],
  fallbackActiveSince: Date,
): string {
  // Newest first: a store can be suspended and restored more than once, and
  // only the most recent change is "when it last changed".
  const reversed = [...messages].reverse();

  if (status === "active") {
    const restored = reversed.find(
      (message) => message.author === "SYSTEM" && message.body === RESTORED_MESSAGE,
    );
    return strings.admin.merchantDetail.statusChangedActive.replace(
      "{when}",
      formatAbsoluteDate(restored?.createdAt ?? fallbackActiveSince),
    );
  }

  const suspended = reversed.find(
    (message) =>
      message.author === "SYSTEM" && message.body.startsWith(SUSPENDED_MESSAGE_PREFIX),
  );

  // Should never be null — `setOrganizationSuspended` posts this message in
  // the SAME transaction as the status flip — but a defensive fallback beats
  // a crash on the one page the platform owner reads to find out why a store
  // is down.
  if (!suspended) {
    return strings.admin.merchantDetail.statusChangedSuspended
      .replace("{when}", formatAbsoluteDate(fallbackActiveSince))
      .replace("{reason}", strings.admin.errors.generic);
  }

  return strings.admin.merchantDetail.statusChangedSuspended
    .replace("{when}", formatAbsoluteDate(suspended.createdAt))
    .replace("{reason}", suspended.body.slice(SUSPENDED_MESSAGE_PREFIX.length));
}

export default async function AdminMerchantDetailPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  await requireAdminContext();
  const { id } = await params;

  const merchant = await merchantDetailForAdmin(id);
  if (merchant === null) {
    notFound();
  }

  // One clock for the whole render (same discipline `page.tsx` documents).
  const now = new Date();
  const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN;

  // The thread IS the audit record (ADM-04) — read once here so the Store
  // status card's Body line can be derived from it, rather than a column.
  const thread = await threadForAdmin(merchant.id);
  const statusChangeLine = statusChangeLineFor(merchant.status, thread, merchant.createdAt);

  // Allowlist `active`; anything else — including a status this page has
  // never seen — reads as Suspended's styling, matching
  // `src/server/admin/domain.ts`'s fail-closed convention.
  const chip =
    merchant.status === "active" ? STATUS_CHIP.active : STATUS_CHIP.suspended;
  const StatusIcon = chip.icon;
  const statusLabel =
    merchant.status === "active"
      ? strings.admin.storeStatus.active
      : strings.admin.storeStatus.suspended;

  /*
   * The SAME `TrialState` computation the merchant's own dashboard trial
   * banner reads (`src/server/entitlements/resolve.ts`), reused rather than
   * re-derived: the platform owner's view of a store's trial must never say
   * something different from what that store's own merchant sees.
   */
  const entitlements = resolveEntitlements(
    {
      id: merchant.id,
      name: merchant.storeName,
      slug: merchant.slug,
      status: merchant.status,
      createdAt: merchant.createdAt,
      planTier: merchant.planTier,
      trialEndsAt: merchant.trialEndsAt,
      subscriptionStatus: merchant.subscriptionStatus,
    },
    now,
  );

  const trialLine =
    entitlements.trial.state === "subscribed"
      ? strings.admin.merchantDetail.subscriptionActiveLine
      : entitlements.trial.state === "expired"
        ? strings.admin.merchantDetail.trialEndedLine.replace(
            "{when}",
            formatAbsoluteDate(entitlements.trial.endsAt),
          )
        : strings.admin.merchantDetail.trialEndsLine.replace(
            "{when}",
            formatAbsoluteDate(entitlements.trial.endsAt),
          );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
            {merchant.storeName}
          </h1>
          <Badge variant={chip.variant}>
            <StatusIcon aria-hidden="true" />
            {statusLabel}
          </Badge>
        </div>
        <p className="text-sm leading-normal font-normal text-muted-foreground">
          {merchant.ownerName} · {merchant.ownerEmail}
        </p>

        <div>
          <Button
            variant="outline"
            className="min-h-11"
            render={<Link href={`/admin/support/${merchant.id}`} />}
          >
            <MessagesSquare aria-hidden="true" />
            {strings.admin.merchantDetail.openThread}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {strings.admin.merchantDetail.cardStoreStatus}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Badge variant={chip.variant}>
              <StatusIcon aria-hidden="true" />
              {statusLabel}
            </Badge>
            <p className="text-sm leading-normal font-normal text-muted-foreground">
              {statusChangeLine}
            </p>
            {/*
             * The page's most consequential control, and the only one in
             * this card — the `SuspendDialog` (see
             * src/components/admin/suspend-dialog.tsx), mounted via this
             * small client wrapper so the Server Component above it never
             * needs to hold dialog-open state itself.
             */}
            <SuspendRestoreControl
              merchantId={merchant.id}
              storeName={merchant.storeName}
              status={merchant.status}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{strings.admin.merchantDetail.cardDomain}</CardTitle>
          </CardHeader>
          <CardContent>
            <DomainCell
              slug={merchant.slug}
              status={merchant.status}
              isPublished={merchant.isPublished}
              rootDomain={rootDomain}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{strings.admin.merchantDetail.cardPlan}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Badge variant="secondary">{planLabelFor(merchant.planTier)}</Badge>
            <p className="text-sm leading-normal font-normal text-muted-foreground">
              {trialLine}
            </p>
            {merchant.subscriptionCurrentPeriodEnd !== null ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {strings.admin.merchantDetail.coversThrough}
                </span>
                <span className="text-base leading-normal font-medium tabular-nums text-foreground">
                  {formatAbsoluteDate(merchant.subscriptionCurrentPeriodEnd)}
                </span>
              </div>
            ) : null}
            {/*
             * `See subscription payments` lands here — plan 06-16, see the
             * header.
             */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{strings.admin.merchantDetail.cardAtAGlance}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm leading-normal font-medium text-muted-foreground">
                {strings.admin.merchantDetail.figureProducts}
              </span>
              <span className="text-base leading-normal font-semibold tabular-nums text-foreground">
                {merchant.productCount}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm leading-normal font-medium text-muted-foreground">
                {strings.admin.merchantDetail.figureOrders}
              </span>
              <span className="text-base leading-normal font-semibold tabular-nums text-foreground">
                {merchant.orderCount}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm leading-normal font-medium text-muted-foreground">
                {strings.admin.merchantDetail.figurePendingClaims}
              </span>
              <span className="text-base leading-normal font-semibold tabular-nums text-foreground">
                {merchant.pendingClaimCount}
              </span>
            </div>
            {/*
             * Each figure links to its filtered ledger per § C2 — lands here
             * once /admin/claims (plan 06-10) exists to link to.
             */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
