"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
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

import { OrderStateChip } from "@/components/order-state-chip";
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
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { strings } from "@/lib/strings";
import type {
  ClaimStatus,
  OrderChannel,
  OrderState,
  PaymentOperator,
} from "@/server/db/enums";
import { confirmOrderClaimAsAdmin, rejectOrderClaimAsAdmin } from "@/server/admin/actions";

import { RejectDialog } from "@/app/(dashboard)/dashboard/claims/reject-dialog";

/**
 * ADM-02 / D-19 — the C3 ledger's per-claim interactivity: the inline
 * confirm/reject island, the screenshot lightbox, the reference copy button,
 * and the two filter `select`s. `page.tsx` owns everything that must stay
 * server-side (identity, money formatting, the storage URL); this file owns
 * everything that must be a Client Component (state, dialogs, the clipboard).
 *
 * ---------------------------------------------------------------------------
 * NEITHER THE STORAGE-URL RESOLVER NOR THE CURRENCY FORMATTER APPEARS HERE.
 * THAT IS THE POINT.
 * ---------------------------------------------------------------------------
 * `screenshotUrl`, `amountClaimedFormatted` and `orderTotalFormatted` arrive
 * as finished strings from `page.tsx`. The resolver that builds a screenshot
 * URL throws on a key ending in `/original` — a guard this file could not
 * honour even if it wanted to, since `server-only` keeps `@/server/images/r2`
 * out of a Client Component's bundle entirely.
 *
 * ---------------------------------------------------------------------------
 * THE REJECT DIALOG IS REUSED AS A COMPONENT, NOT RECOMPOSED FROM ITS COPY.
 * ---------------------------------------------------------------------------
 * `src/app/(dashboard)/dashboard/claims/reject-dialog.tsx` was read in full
 * before this decision: it imports nothing merchant-specific (no
 * `confirmClaim`/`rejectClaim`, no tenant context) — every prop it needs
 * (`open`, `onOpenChange`, `onReject`) is already surface-agnostic, and every
 * string it renders is `strings.claims.*` (`rejectDialogTitle`,
 * `rejectReasonAmount`, `rejectReasonReference`, `rejectReasonNotReceived`,
 * `rejectReasonOther`, the free-text counter, `rejectDialogConfirm`,
 * `rejectDialogCancel`), exactly the sentences 06-UI-SPEC.md § C3 requires
 * reused verbatim. Recomposing that dialog here would be a second
 * implementation of the same three enforced guards its own header describes
 * (the Zod floor, `transitionOrder`'s blank-reason refusal, and the
 * disabled-until-valid submit) for zero behavioural difference — so this
 * file imports the component directly instead.
 *
 * ---------------------------------------------------------------------------
 * "STATUS CHIP" MEANS THE ORDER'S CHIP, NOT A NEW CLAIM-STATUS CHIP.
 * ---------------------------------------------------------------------------
 * See `src/server/admin/claims.ts`'s `AdminClaimRow` header for the full
 * reasoning: 06-UI-SPEC.md § Status Chip Registry states order-state chips
 * are reused byte-identically here, so this file renders `OrderStateChip`
 * with the row's live `orderChannel`/`orderState` — never a bespoke
 * `ClaimStatus`-keyed chip, which would also need a `PENDING` gold entry the
 * five-use `--gold-accent` budget (06-UI-SPEC.md § Color) has no room for.
 *
 * ---------------------------------------------------------------------------
 * "LEAVES THE (AWAITING) FILTER" IS GENERAL, NOT SPECIAL-CASED TO `PENDING`.
 * ---------------------------------------------------------------------------
 * § C3: "the row's status chip flips and the row leaves the default
 * (awaiting) filter." On the default `Awaiting review` filter a confirmed or
 * rejected row must disappear; on `All` it must stay, with its chip updated
 * in place — the merchant order list's `OrderRowActions` does the identical
 * thing for the identical reason. `activeStatusFilter` carries whichever
 * status this row was fetched under (`undefined` on `All`), and a row hides
 * itself the instant its own optimistic status stops matching it.
 */

/** The badge label for a claim's payment rail, reused from the merchant
 * namespace verbatim — 06-UI-SPEC.md § C3's Operator column matches
 * `strings.claims.operatorMtn`/`operatorOrange` exactly ("MTN Mobile Money" /
 * "Orange Money"), not the shorter `strings.orders.operatorMtn` used on the
 * order-channel chip. */
const OPERATOR_LABELS: Readonly<Record<PaymentOperator, string>> = {
  MTN_MOMO: strings.claims.operatorMtn,
  ORANGE_MONEY: strings.claims.operatorOrange,
};

/** The 40px thumb and its lightbox, or the no-upload tile. */
function Screenshot({
  screenshotUrl,
  orderNumber,
}: {
  readonly screenshotUrl: string | null;
  readonly orderNumber: string;
}) {
  const altText = strings.admin.claims.screenshotAlt.replace("{n}", orderNumber);

  if (screenshotUrl === null) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
          <ImageOff aria-hidden="true" className="size-4 text-muted-foreground" />
        </div>
        <span className="text-sm leading-normal font-medium text-muted-foreground">
          {strings.admin.claims.noScreenshot}
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
            aria-label={strings.admin.claims.viewScreenshot}
            className="size-10 shrink-0 overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <Image
          src={screenshotUrl}
          alt={altText}
          width={40}
          height={40}
          className="aspect-square size-full object-cover"
        />
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogTitle className="sr-only">{altText}</DialogTitle>
        <Image
          src={screenshotUrl}
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
          copied ? strings.admin.claims.copiedReference : strings.admin.claims.copyReference
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
          {strings.admin.claims.copiedReference}
        </span>
      ) : null}
    </div>
  );
}

interface ClaimReviewInput {
  readonly claimId: string;
  readonly orderNumber: string;
  readonly orderChannel: OrderChannel;
  readonly orderState: OrderState;
  readonly status: ClaimStatus;
  readonly amountMismatch: boolean;
  readonly amountClaimedFormatted: string;
  readonly orderTotalFormatted: string;
  /** The status this row was fetched under; `undefined` on the `All` filter. */
  readonly activeStatusFilter: ClaimStatus | undefined;
}

/**
 * The shared state machine behind both the `md`+ row and the sub-`md` card —
 * one hook, so the optimistic-update and hide-on-leave logic is never copied
 * twice, matching `src/app/(dashboard)/dashboard/orders/order-row-actions.tsx`'s
 * `useConfirmable` precedent.
 */
function useClaimReview({
  claimId,
  orderNumber,
  orderChannel,
  orderState,
  status,
  amountMismatch,
  amountClaimedFormatted,
  orderTotalFormatted,
  activeStatusFilter,
}: ClaimReviewInput) {
  const [optimisticOrderState, setOptimisticOrderState] = useState<OrderState>(orderState);
  const [optimisticStatus, setOptimisticStatus] = useState<ClaimStatus>(status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mismatchOpen, setMismatchOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const leftFilter =
    activeStatusFilter !== undefined && optimisticStatus !== activeStatusFilter;

  async function runConfirm() {
    setError(null);
    setPending(true);

    const result = await confirmOrderClaimAsAdmin({ claimId });

    setPending(false);

    if (result.ok) {
      setOptimisticStatus("CONFIRMED");
      setOptimisticOrderState("CONFIRMED");
      toast.success(strings.admin.claims.confirmedToast.replace("{n}", orderNumber));
      return;
    }

    setError(result.error.form?.[0] ?? strings.admin.errors.generic);
  }

  /** Returns whether the rejection stuck, so the dialog can close itself. */
  async function runReject(reason: string): Promise<boolean> {
    setError(null);

    const result = await rejectOrderClaimAsAdmin({ claimId, reason });

    if (result.ok) {
      setOptimisticStatus("REJECTED");
      setOptimisticOrderState("DISPUTED");
      toast.success(strings.admin.claims.rejectedToast.replace("{n}", orderNumber));
      return true;
    }

    setError(result.error.form?.[0] ?? strings.admin.errors.generic);
    return false;
  }

  const chip = <OrderStateChip channel={orderChannel} state={optimisticOrderState} />;

  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        disabled={pending}
        onClick={() => {
          // The mismatch is the ONE case that asks first — everything else is
          // D-19's single tap, matching the merchant queue's own rule.
          if (amountMismatch) {
            setMismatchOpen(true);
            return;
          }
          void runConfirm();
        }}
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <CircleCheck aria-hidden="true" />
        )}
        {strings.admin.claims.confirmCta}
      </Button>

      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="min-h-11"
        disabled={pending}
        onClick={() => {
          setRejectOpen(true);
        }}
      >
        <X aria-hidden="true" />
        {strings.admin.claims.rejectCta}
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

  const mismatchDialog = (
    <AlertDialog open={mismatchOpen} onOpenChange={setMismatchOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{strings.admin.claims.mismatchDialogTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {strings.admin.claims.mismatchDialogBody
              .replace("{claimed}", amountClaimedFormatted)
              .replace("{total}", orderTotalFormatted)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11">
            {strings.admin.claims.mismatchDialogCancel}
          </AlertDialogCancel>
          <AlertDialogAction
            className="min-h-11"
            disabled={pending}
            onClick={() => {
              void runConfirm();
            }}
          >
            {strings.admin.claims.mismatchDialogConfirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const rejectDialog = (
    <RejectDialog open={rejectOpen} onOpenChange={setRejectOpen} onReject={runReject} />
  );

  return { chip, actions, errorAlert, mismatchDialog, rejectDialog, leftFilter };
}

export interface LedgerRowProps {
  readonly claimId: string;
  readonly tenantId: string;
  readonly storeName: string;
  readonly orderNumber: string;
  readonly orderChannel: OrderChannel;
  readonly orderState: OrderState;
  readonly amountClaimedFormatted: string;
  readonly orderTotalFormatted: string;
  readonly amountMismatch: boolean;
  readonly operator: PaymentOperator;
  readonly reference: string;
  readonly submittedAtRelative: string;
  readonly screenshotUrl: string | null;
  readonly status: ClaimStatus;
  readonly activeStatusFilter: ClaimStatus | undefined;
}

/** The `md`+ table row — one `<TableRow>` per claim. */
export function LedgerRow(props: LedgerRowProps) {
  const {
    tenantId,
    storeName,
    orderNumber,
    amountClaimedFormatted,
    orderTotalFormatted,
    amountMismatch,
    operator,
    reference,
    submittedAtRelative,
    screenshotUrl,
  } = props;

  const { chip, actions, errorAlert, mismatchDialog, rejectDialog, leftFilter } =
    useClaimReview(props);

  if (leftFilter) return null;

  return (
    <TableRow>
      <TableCell>
        <Screenshot screenshotUrl={screenshotUrl} orderNumber={orderNumber} />
      </TableCell>
      <TableCell>
        <Link
          href={`/admin/merchants/${tenantId}`}
          className="text-sm leading-normal font-medium text-foreground hover:underline"
        >
          {storeName}
        </Link>
      </TableCell>
      <TableCell>
        <span className="font-mono text-sm leading-normal font-medium text-foreground">
          {orderNumber}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="text-base leading-normal font-normal tabular-nums text-foreground">
            {amountClaimedFormatted}
          </span>
          {amountMismatch ? (
            <span className="text-sm leading-normal font-medium text-destructive">
              {strings.admin.claims.amountMismatch.replace("{total}", orderTotalFormatted)}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{OPERATOR_LABELS[operator]}</Badge>
      </TableCell>
      <TableCell>
        <ReferenceRow reference={reference} />
      </TableCell>
      <TableCell>
        <span className="text-sm leading-normal font-normal text-muted-foreground">
          {submittedAtRelative}
        </span>
      </TableCell>
      <TableCell>{chip}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-2">
          {actions}
          {errorAlert}
        </div>
        {mismatchDialog}
        {rejectDialog}
      </TableCell>
    </TableRow>
  );
}

/** The sub-`md` stacked card — the same fields, self-contained. */
export function LedgerCard(props: LedgerRowProps) {
  const {
    tenantId,
    storeName,
    orderNumber,
    amountClaimedFormatted,
    orderTotalFormatted,
    amountMismatch,
    operator,
    reference,
    submittedAtRelative,
    screenshotUrl,
  } = props;

  const { chip, actions, errorAlert, mismatchDialog, rejectDialog, leftFilter } =
    useClaimReview(props);

  if (leftFilter) return null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-4 sm:flex-row-reverse sm:justify-end sm:gap-6">
        <Screenshot screenshotUrl={screenshotUrl} orderNumber={orderNumber} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/admin/merchants/${tenantId}`}
              className="text-sm leading-normal font-medium text-foreground hover:underline"
            >
              {storeName}
            </Link>
            {chip}
          </div>
          <span className="font-mono text-sm leading-normal font-medium text-foreground">
            {orderNumber}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-2xl leading-tight font-semibold tabular-nums text-foreground">
              {amountClaimedFormatted}
            </span>
            {amountMismatch ? (
              <span className="text-sm leading-normal font-medium text-destructive">
                {strings.admin.claims.amountMismatch.replace("{total}", orderTotalFormatted)}
              </span>
            ) : null}
          </div>
          <Badge variant="secondary" className="w-fit">
            {OPERATOR_LABELS[operator]}
          </Badge>
          <ReferenceRow reference={reference} />
          <span className="text-sm leading-normal font-normal text-muted-foreground">
            {submittedAtRelative}
          </span>
        </div>
      </div>

      {errorAlert}
      {actions}
      {mismatchDialog}
      {rejectDialog}
    </div>
  );
}

export interface ClaimsFilterBarProps {
  readonly status: ClaimStatus | "ALL";
  readonly merchant: string;
  readonly merchants: readonly { readonly id: string; readonly name: string }[];
}

const STATUS_OPTIONS: readonly { readonly value: ClaimStatus | "ALL"; readonly label: string }[] = [
  { value: "PENDING", label: strings.admin.claims.filterAwaiting },
  { value: "CONFIRMED", label: strings.admin.claims.filterConfirmed },
  { value: "REJECTED", label: strings.admin.claims.filterRejected },
  { value: "ALL", label: strings.admin.claims.filterAll },
];

/**
 * The two C3 filters. Each `select` change navigates to a new `?status=` /
 * `?merchant=` URL, preserving the other filter — the filter state lives in
 * the URL (shareable, back-button-safe), never in client-only state, the
 * same discipline `/dashboard/orders`'s filter chips follow.
 */
export function ClaimsFilterBar({ status, merchant, merchants }: ClaimsFilterBarProps) {
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
    { label: strings.admin.claims.filterAllMerchants, value: "ALL" },
    ...merchants.map((m) => ({ label: m.name, value: m.id })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Label className="text-sm leading-normal font-medium text-foreground">
          {strings.admin.claims.filterStatusLabel}
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
            aria-label={strings.admin.claims.filterStatusLabel}
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
          {strings.admin.claims.filterMerchantLabel}
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
            aria-label={strings.admin.claims.filterMerchantLabel}
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
