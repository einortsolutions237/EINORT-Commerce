"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import {
  Check,
  CircleCheck,
  Copy,
  ImageOff,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { SubscriptionClaimStatusChip } from "@/components/subscription-claim-chip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/lib/strings";
import type { ClaimStatus, PaymentOperator } from "@/server/db/enums";
import {
  confirmSubscriptionPayment,
  rejectSubscriptionPayment,
} from "@/server/admin/subscription-actions";

/**
 * ADM-02's sibling — SUB-03 / D-20's C4 ledger: the inline confirm/reject
 * island, the receipt lightbox, the reference copy button, and the two
 * filter `select`s.
 *
 * ---------------------------------------------------------------------------
 * CONFIRM IS NOT OPTIMISTIC. THIS IS THE ONE STRUCTURAL DIFFERENCE FROM
 * `/admin/claims/ledger-row.tsx`.
 * ---------------------------------------------------------------------------
 * Confirming an order-payment claim flips the row's chip immediately and
 * asks only when the amounts disagree. Confirming a subscription payment
 * changes what a merchant is ENTITLED TO — every catalog write, every order
 * transition, every theme publish reads `Organization.subscriptionStatus`
 * downstream — so every confirmation here opens an `alert-dialog` first,
 * shows a submitting state while the write is in flight, and only updates
 * this row's own displayed status AFTER the server has actually answered.
 * This file uses plain `useState`, never React's optimistic-update hook.
 *
 * ---------------------------------------------------------------------------
 * THE RESULTING DATE IS NEVER COMPUTED HERE. IT ARRIVES ALREADY FORMATTED.
 * ---------------------------------------------------------------------------
 * `resultingPeriodEndFormatted` is resolved server-side in `page.tsx` through
 * `resolveNextPeriodEnd` — the EXACT pure function
 * `confirmSubscriptionClaim` writes through — and handed down as a plain
 * string. This file does no date arithmetic of its own (T-06-86): the
 * sentence the owner reads in the confirm dialog and the value the server
 * actually writes cannot drift apart, because neither is a second
 * expression of "one month from now, or from the existing period end,
 * whichever is later".
 *
 * ---------------------------------------------------------------------------
 * REJECT HAS NO CANNED REASONS, UNLIKE `/admin/claims`'s REJECT DIALOG.
 * ---------------------------------------------------------------------------
 * 06-UI-SPEC.md § C4: the failure modes here are platform-specific ("your
 * receipt doesn't match our SMS", "wrong operator") and the owner is writing
 * to ONE merchant, not triaging a queue of customer disputes — so this is a
 * required free-text `Textarea` with a live counter, never the canned-reason
 * radio-button group the order-claims dialog offers.
 * `src/app/(dashboard)/dashboard/claims/reject-dialog.tsx` is deliberately
 * NOT reused here for that reason.
 *
 * ---------------------------------------------------------------------------
 * NEITHER ROW ACTION USES THE PRIMARY BUTTON VARIANT.
 * ---------------------------------------------------------------------------
 * The same one-primary-per-page rule `/admin/claims/ledger-row.tsx`'s own
 * header states: a table of N rows cannot carry N primary fills. `Confirm`
 * is `outline`, `Reject` is `destructive`.
 */

const OPERATOR_LABELS: Readonly<Record<PaymentOperator, string>> = {
  MTN_MOMO: strings.plan.subscriptionClaim.operatorMtn,
  ORANGE_MONEY: strings.plan.subscriptionClaim.operatorOrange,
};

/** The 40px thumb and its lightbox, or the no-receipt tile. */
function Receipt({
  receiptUrl,
  storeName,
}: {
  readonly receiptUrl: string | null;
  readonly storeName: string;
}) {
  const altText = strings.admin.subscriptions.receiptAlt.replace("{store}", storeName);

  if (receiptUrl === null) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
          <ImageOff aria-hidden="true" className="size-4 text-muted-foreground" />
        </div>
        <span className="text-sm leading-normal font-medium text-muted-foreground">
          {strings.admin.subscriptions.noReceipt}
        </span>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={strings.admin.subscriptions.viewReceipt}
            className="size-10 shrink-0 overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <Image
          src={receiptUrl}
          alt={altText}
          width={40}
          height={40}
          className="aspect-square size-full object-cover"
        />
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogTitle className="sr-only">{altText}</DialogTitle>
        <Image
          src={receiptUrl}
          alt={altText}
          width={1200}
          height={1200}
          className="h-auto max-h-[90vh] w-full object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}

/** The reference, with a copy button that confirms itself in place. */
function ReferenceRow({ reference }: { readonly reference: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reference);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-base leading-normal font-normal text-foreground">
        {reference}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11"
        aria-label={
          copied
            ? strings.admin.subscriptions.copiedReference
            : strings.admin.subscriptions.copyReference
        }
        onClick={() => {
          void handleCopy();
        }}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </Button>
      {copied ? (
        <span
          role="status"
          aria-live="polite"
          className="text-sm leading-normal font-medium text-muted-foreground"
        >
          {strings.admin.subscriptions.copiedReference}
        </span>
      ) : null}
    </div>
  );
}

const REJECT_REASON_MIN = 10;
const REJECT_REASON_MAX = 140;

interface SubscriptionReviewInput {
  readonly claimId: string;
  readonly storeName: string;
  readonly status: ClaimStatus;
  readonly resultingPeriodEndFormatted: string;
  readonly activeStatusFilter: ClaimStatus | undefined;
}

/**
 * The shared state machine behind both the `md`+ row and the sub-`md` card —
 * one hook, matching `useClaimReview`'s precedent on `/admin/claims`.
 *
 * `optimisticStatus` is named for parity with that file's variable, not
 * because this is optimistic: it is only ever written from inside a
 * `.then`-shaped success branch, after `confirmSubscriptionPayment` /
 * `rejectSubscriptionPayment` have already resolved `{ ok: true }`.
 */
function useSubscriptionReview({
  claimId,
  storeName,
  status,
  resultingPeriodEndFormatted,
  activeStatusFilter,
}: SubscriptionReviewInput) {
  const reasonId = useId();
  const [optimisticStatus, setOptimisticStatus] = useState<ClaimStatus>(status);
  const [displayedCoversThrough, setDisplayedCoversThrough] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const leftFilter =
    activeStatusFilter !== undefined && optimisticStatus !== activeStatusFilter;

  async function runConfirm() {
    setError(null);
    setPending(true);

    const result = await confirmSubscriptionPayment({ claimId });

    setPending(false);

    if (result.ok) {
      setOptimisticStatus("CONFIRMED");
      setDisplayedCoversThrough(resultingPeriodEndFormatted);
      setConfirmOpen(false);
      toast.success(strings.admin.subscriptions.confirmedToast.replace("{store}", storeName));
      return;
    }

    setError(result.error.form?.[0] ?? strings.admin.errors.confirmSubscription);
  }

  async function runReject() {
    setError(null);
    setPending(true);

    const result = await rejectSubscriptionPayment({ claimId, reason: reason.trim() });

    setPending(false);

    if (result.ok) {
      setOptimisticStatus("REJECTED");
      setRejectOpen(false);
      setReason("");
      toast.success(strings.admin.subscriptions.rejectedToast.replace("{store}", storeName));
      return;
    }

    setError(result.error.form?.[0] ?? strings.admin.errors.generic);
  }

  const canSubmitReject = reason.trim().length >= REJECT_REASON_MIN && !pending;

  const chip = <SubscriptionClaimStatusChip status={optimisticStatus} />;

  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        disabled={pending}
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
      >
        <CircleCheck aria-hidden="true" />
        {strings.admin.subscriptions.confirmCta}
      </Button>

      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="min-h-11"
        disabled={pending}
        onClick={() => {
          setError(null);
          setRejectOpen(true);
        }}
      >
        <X aria-hidden="true" />
        {strings.admin.subscriptions.rejectCta}
      </Button>
    </div>
  );

  const errorAlert =
    error === null ? null : (
      <Alert variant="destructive">
        <TriangleAlert aria-hidden="true" />
        <AlertDescription className="text-destructive">{error}</AlertDescription>
      </Alert>
    );

  const confirmDialog = (
    <AlertDialog
      open={confirmOpen}
      onOpenChange={(open) => {
        if (!pending) setConfirmOpen(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{strings.admin.subscriptions.confirmDialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {strings.admin.subscriptions.confirmDialogBody
              .replace("{store}", storeName)
              .replace("{date}", resultingPeriodEndFormatted)}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {errorAlert}

        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11" disabled={pending}>
            {strings.admin.subscriptions.confirmDialogCancel}
          </AlertDialogCancel>
          <AlertDialogAction
            className="min-h-11"
            disabled={pending}
            onClick={() => {
              void runConfirm();
            }}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <CircleCheck aria-hidden="true" />
            )}
            {pending
              ? strings.admin.subscriptions.confirmSubmitting
              : strings.admin.subscriptions.confirmDialogConfirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const rejectDialog = (
    <Dialog
      open={rejectOpen}
      onOpenChange={(open) => {
        if (pending) return;
        setRejectOpen(open);
        if (!open) {
          setReason("");
          setError(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{strings.admin.subscriptions.rejectDialogTitle}</DialogTitle>
          <DialogDescription>
            {strings.admin.subscriptions.rejectDialogBody}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={reasonId}
            className="text-sm leading-normal font-medium text-foreground"
          >
            {strings.admin.subscriptions.rejectReasonLabel}
          </label>
          <Textarea
            id={reasonId}
            value={reason}
            maxLength={REJECT_REASON_MAX}
            rows={3}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm leading-normal font-normal text-muted-foreground">
              {strings.admin.subscriptions.rejectReasonHelper}
            </span>
            {/* `aria-live="polite"` so a screen-reader user hears the count
                fall as they type, matching the merchant-side reject dialog's
                own counter discipline. */}
            <span
              aria-live="polite"
              className="text-sm leading-normal font-normal tabular-nums text-muted-foreground"
            >
              {strings.admin.subscriptions.rejectReasonCounter
                .replace("{n}", String(reason.length))
                .replace("{max}", String(REJECT_REASON_MAX))}
            </span>
          </div>
        </div>

        {errorAlert}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() => {
              setRejectOpen(false);
              setReason("");
              setError(null);
            }}
          >
            {strings.admin.subscriptions.rejectDialogCancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            disabled={!canSubmitReject}
            onClick={() => {
              void runReject();
            }}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            {pending
              ? strings.admin.subscriptions.rejectSubmitting
              : strings.admin.subscriptions.rejectDialogConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return {
    chip,
    actions,
    confirmDialog,
    rejectDialog,
    leftFilter,
    displayedCoversThrough,
  };
}

export interface SubscriptionRowProps {
  readonly claimId: string;
  readonly tenantId: string;
  readonly storeName: string;
  readonly planLabel: string;
  readonly amountFormatted: string;
  readonly operator: PaymentOperator;
  readonly reference: string;
  readonly submittedAtRelative: string;
  readonly coversThroughFormatted: string | null;
  readonly resultingPeriodEndFormatted: string;
  readonly receiptUrl: string | null;
  readonly status: ClaimStatus;
  readonly activeStatusFilter: ClaimStatus | undefined;
}

/** The `md`+ table row — one `<TableRow>` per subscription claim. */
export function SubscriptionRow(props: SubscriptionRowProps) {
  const {
    storeName,
    planLabel,
    amountFormatted,
    operator,
    reference,
    submittedAtRelative,
    coversThroughFormatted,
    receiptUrl,
  } = props;

  const { chip, actions, confirmDialog, rejectDialog, leftFilter, displayedCoversThrough } =
    useSubscriptionReview(props);

  if (leftFilter) return null;

  const coversThrough =
    displayedCoversThrough ??
    coversThroughFormatted ??
    strings.admin.subscriptions.coversThroughPending;

  return (
    <TableRow>
      <TableCell>
        <Receipt receiptUrl={receiptUrl} storeName={storeName} />
      </TableCell>
      <TableCell>
        <span className="text-sm leading-normal font-medium text-foreground">{storeName}</span>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{planLabel}</Badge>
      </TableCell>
      <TableCell>
        <span className="text-base leading-normal font-normal tabular-nums text-foreground">
          {amountFormatted}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm leading-normal font-normal text-foreground">
          {OPERATOR_LABELS[operator]}
        </span>
      </TableCell>
      <TableCell>
        <ReferenceRow reference={reference} />
      </TableCell>
      <TableCell>
        <span className="text-sm leading-normal font-normal text-muted-foreground">
          {submittedAtRelative}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm leading-normal font-normal tabular-nums text-foreground">
          {coversThrough}
        </span>
      </TableCell>
      <TableCell>{chip}</TableCell>
      <TableCell>
        {actions}
        {confirmDialog}
        {rejectDialog}
      </TableCell>
    </TableRow>
  );
}

/** The sub-`md` stacked card — the same fields, self-contained. */
export function SubscriptionCard(props: SubscriptionRowProps) {
  const {
    storeName,
    planLabel,
    amountFormatted,
    operator,
    reference,
    submittedAtRelative,
    coversThroughFormatted,
    receiptUrl,
  } = props;

  const { chip, actions, confirmDialog, rejectDialog, leftFilter, displayedCoversThrough } =
    useSubscriptionReview(props);

  if (leftFilter) return null;

  const coversThrough =
    displayedCoversThrough ??
    coversThroughFormatted ??
    strings.admin.subscriptions.coversThroughPending;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-4 sm:flex-row-reverse sm:justify-end sm:gap-6">
        <Receipt receiptUrl={receiptUrl} storeName={storeName} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm leading-normal font-medium text-foreground">
              {storeName}
            </span>
            {chip}
          </div>
          <Badge variant="secondary" className="w-fit">
            {planLabel}
          </Badge>
          <span className="text-2xl leading-tight font-semibold tabular-nums text-foreground">
            {amountFormatted}
          </span>
          <span className="text-sm leading-normal font-normal text-foreground">
            {OPERATOR_LABELS[operator]}
          </span>
          <ReferenceRow reference={reference} />
          <span className="text-sm leading-normal font-normal text-muted-foreground">
            {submittedAtRelative}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm leading-normal font-medium text-muted-foreground">
              {strings.admin.subscriptions.columnCoversThrough}
            </span>
            <span className="text-sm leading-normal font-normal tabular-nums text-foreground">
              {coversThrough}
            </span>
          </div>
        </div>
      </div>

      {actions}
      {confirmDialog}
      {rejectDialog}
    </div>
  );
}

export interface SubscriptionsFilterBarProps {
  readonly status: ClaimStatus | "ALL";
  readonly merchant: string;
  readonly merchants: readonly { readonly id: string; readonly name: string }[];
}

const STATUS_OPTIONS: readonly { readonly value: ClaimStatus | "ALL"; readonly label: string }[] = [
  { value: "PENDING", label: strings.admin.subscriptions.filterAwaiting },
  { value: "CONFIRMED", label: strings.admin.subscriptions.filterConfirmed },
  { value: "REJECTED", label: strings.admin.subscriptions.filterRejected },
  { value: "ALL", label: strings.admin.subscriptions.filterAll },
];

/**
 * The two C4 filters — same shape as `/admin/claims`'s `ClaimsFilterBar`: the
 * filter state lives in the URL (shareable, back-button-safe), never in
 * client-only state.
 */
export function SubscriptionsFilterBar({
  status,
  merchant,
  merchants,
}: SubscriptionsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(next: { readonly status?: string; readonly merchant?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.status !== undefined) params.set("status", next.status);
    if (next.merchant !== undefined) params.set("merchant", next.merchant);
    router.push(`${pathname}?${params.toString()}`);
  }

  const merchantItems = [
    { label: strings.admin.subscriptions.filterAllMerchants, value: "ALL" },
    ...merchants.map((m) => ({ label: m.name, value: m.id })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Label className="text-sm leading-normal font-medium text-foreground">
          {strings.admin.subscriptions.filterStatusLabel}
        </Label>
        <Select
          items={STATUS_OPTIONS}
          value={status}
          onValueChange={(next) => {
            if (!next) return;
            navigate({ status: next });
          }}
        >
          <SelectTrigger
            className="min-h-11"
            aria-label={strings.admin.subscriptions.filterStatusLabel}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm leading-normal font-medium text-foreground">
          {strings.admin.subscriptions.filterMerchantLabel}
        </Label>
        <Select
          items={merchantItems}
          value={merchant}
          onValueChange={(next) => {
            if (!next) return;
            navigate({ merchant: next });
          }}
        >
          <SelectTrigger
            className="min-h-11"
            aria-label={strings.admin.subscriptions.filterMerchantLabel}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {merchantItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
