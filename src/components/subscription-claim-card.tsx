"use client";

import Image from "next/image";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubscriptionClaimStatusChip } from "@/components/subscription-claim-chip";
import { strings } from "@/lib/strings";
import type { ClaimStatus, PaymentOperator } from "@/server/db/enums";
import { formatXaf } from "@/server/payments/whatsapp";

import { formatRelativeTime } from "@/app/(dashboard)/dashboard/orders/format";

/**
 * SUB-03 / 06-UI-SPEC.md § A3 — the READ-ONLY subscription-claim card,
 * rendered in three places: `/dashboard/plan`, and inline in both the
 * merchant's and the platform owner's support thread (plan 06-12 / 06-16
 * wire the latter two once this component exists).
 *
 * ---------------------------------------------------------------------------
 * NO ACTION PROPS. THIS COMPONENT CANNOT CONFIRM OR REJECT ANYTHING.
 * ---------------------------------------------------------------------------
 * D-20's one-decision-surface rule lives at `/admin/subscriptions`, never
 * inline in a transcript. Giving this card a confirm-or-reject callback prop
 * would be the exact shape of the violation that rule exists to prevent — so
 * there is none, on any of its three call sites, and there must never be one
 * added later "for convenience".
 *
 * ---------------------------------------------------------------------------
 * `receiptUrl` ARRIVES PRE-RESOLVED. THIS COMPONENT NEVER COMPOSES ONE.
 * ---------------------------------------------------------------------------
 * `SubscriptionPaymentClaim.receiptKey` is an R2 derivative PREFIX, not a
 * URL, and `publicUrlFor` (`src/server/images/r2.ts`) is `server-only`. Same
 * discipline `src/app/(dashboard)/dashboard/claims/claim-card.tsx` documents
 * for `screenshotUrl`: the caller resolves the public URL server-side and
 * hands this component a plain string, so a storage-layout detail never has
 * to reach a client bundle.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE HOLDS ITS OWN TWO-LINE DATE FORMATTER RATHER THAN IMPORTING
 * `src/app/admin/format.ts`'s.
 * ---------------------------------------------------------------------------
 * That module's own header states the convention this repository already
 * follows: the admin and merchant route trees do not reach across into each
 * other's formatting helpers even where the code is byte-for-byte shareable,
 * because the day one needs to diverge an import is a bigger refactor than a
 * short duplicate ever was. This component sits in neither tree — it is
 * genuinely shared, the same position `src/components/support/message-bubble.tsx`
 * already occupies — and that file's own precedent is followed here:
 * `formatRelativeTime` is imported from the merchant surface's
 * `dashboard/orders/format.ts` (exactly as `message-bubble.tsx` already does),
 * because that module is pure `Intl` arithmetic with nothing merchant-specific
 * about it and is already the cross-surface-shared instance of that formatter.
 * `coversThrough` needs a DATE-only (no time) rendering neither existing
 * module exports, so it gets its own two-line `Intl.DateTimeFormat` here
 * rather than reaching into the admin zone for one more function.
 */

const OPERATOR_LABELS: Record<PaymentOperator, string> = {
  MTN_MOMO: strings.plan.subscriptionClaim.operatorMtn,
  ORANGE_MONEY: strings.plan.subscriptionClaim.operatorOrange,
};

const COVERS_THROUGH_FORMATTER = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

export interface SubscriptionClaimCardProps {
  readonly status: ClaimStatus;
  readonly operator: PaymentOperator;
  readonly reference: string;
  readonly amountXaf: number;
  readonly rejectionReason: string | null;
  readonly submittedAt: Date;
  /** `null` while unreviewed (plan 06-16's confirm writes it). Renders "—". */
  readonly coversThrough: Date | null;
  /** `null` when the merchant submitted no receipt image. */
  readonly receiptUrl: string | null;
}

/** The 96px thumb and its shared lightbox, or nothing when there is no receipt. */
function Receipt({ receiptUrl }: { readonly receiptUrl: string | null }) {
  if (receiptUrl === null) return null;

  const alt = strings.plan.subscriptionClaim.receiptLabel;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={strings.claims.viewScreenshot}
            className="size-24 shrink-0 overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <Image
          src={receiptUrl}
          alt={alt}
          width={96}
          height={96}
          className="aspect-square size-full object-cover"
        />
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <Image
          src={receiptUrl}
          alt={alt}
          width={1200}
          height={1200}
          className="h-auto max-h-[90vh] w-full object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}

export function SubscriptionClaimCard({
  status,
  operator,
  reference,
  amountXaf,
  rejectionReason,
  submittedAt,
  coversThrough,
  receiptUrl,
}: SubscriptionClaimCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col gap-4 md:flex-row-reverse md:justify-end md:gap-6">
        <Receipt receiptUrl={receiptUrl} />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <SubscriptionClaimStatusChip status={status} className="w-fit" />

          <span className="text-2xl leading-tight font-semibold tabular-nums text-foreground">
            {formatXaf(amountXaf)}
          </span>

          <span className="text-sm leading-normal font-medium text-foreground">
            {OPERATOR_LABELS[operator]}
          </span>

          <span className="font-mono text-base leading-normal font-normal text-foreground">
            {reference}
          </span>

          <span className="text-sm leading-normal font-normal text-muted-foreground">
            {formatRelativeTime(submittedAt)}
          </span>

          <div className="flex items-baseline gap-1.5">
            <span className="text-sm leading-normal font-medium text-muted-foreground">
              {strings.admin.merchantDetail.coversThrough}
            </span>
            <span className="text-sm leading-normal font-normal tabular-nums text-foreground">
              {coversThrough === null
                ? "—"
                : COVERS_THROUGH_FORMATTER.format(coversThrough)}
            </span>
          </div>
        </div>
      </div>

      {rejectionReason === null ? null : (
        <p className="text-base leading-relaxed font-normal text-foreground">
          {rejectionReason}
        </p>
      )}
    </div>
  );
}
