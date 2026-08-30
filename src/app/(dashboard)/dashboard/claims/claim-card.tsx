"use client";

import Image from "next/image";
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

import { OrderChannelChip } from "@/components/order-state-chip";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { strings } from "@/lib/strings";
import { confirmClaim, rejectClaim } from "@/server/claims/actions";
import type { OrderChannel, PaymentOperator } from "@/server/db/enums";

import { RejectDialog } from "./reject-dialog";

/**
 * One claim, as a CARD — 03-UI-SPEC.md § A5.
 *
 * ---------------------------------------------------------------------------
 * A CARD, NOT A TABLE ROW. THE SPEC SAYS SO AND THE REASON IS PHYSICAL.
 * ---------------------------------------------------------------------------
 * A screenshot needs room and the two actions need 44px targets. A table row
 * that carried both would either shrink the thumbnail to something a merchant
 * cannot read a transaction reference off, or grow so tall that the "table" was
 * a list of cards with extra rules. On a Douala merchant's phone the whole
 * decision has to fit on one screen: the amount, the reference, the picture, and
 * the two buttons.
 *
 * ---------------------------------------------------------------------------
 * THE ORDER TOTAL SITS NEXT TO THE CLAIMED AMOUNT, AT THE POINT OF DECISION.
 * ---------------------------------------------------------------------------
 * When the two differ, the destructive line beneath the amount is the ONLY
 * thing standing between a distracted merchant and confirming a 5,000 XAF
 * payment against a 50,000 XAF order. Putting that comparison one page away — on
 * the order detail — would make the safe path the one that costs a navigation,
 * and the queue exists precisely so the merchant does not have to navigate.
 *
 * ---------------------------------------------------------------------------
 * WHY CONFIRM IS ONE TAP AND REJECT IS NEVER ONE TAP.
 * ---------------------------------------------------------------------------
 * ORD-03 asks for a one-tap confirm and A5's interaction contract permits the
 * optimistic removal. There is no undo, and that is honest rather than lazy: the
 * transition is written to the audit trail with the merchant's name on it, so
 * "undo" could only ever mean a second audited event, not an erasure. The one
 * exception is the amount mismatch, which opens an `alert-dialog` first — the
 * single case where the merchant is probably about to make a mistake they cannot
 * take back.
 *
 * Rejection always opens `reject-dialog.tsx`. See its header.
 *
 * ---------------------------------------------------------------------------
 * NO GOLD IN THIS FILE, OR ANYWHERE IN THIS ROUTE.
 * ---------------------------------------------------------------------------
 * 03-UI-SPEC.md § A. Color grants `--gold-accent` exactly two uses in the phase:
 * the sidebar's pending-claims badge and the `Payment claimed` state chip. Both
 * are already spent, and `tests/unit/dashboard-nav.test.ts` fails the build on a
 * third. `--destructive` is likewise rationed — it marks the amount mismatch, the
 * duplicate-reference alert and the Reject action, and nothing else here.
 */

/** Everything the card renders, resolved on the server. */
export interface ClaimCardProps {
  readonly claimId: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly customerName: string;
  readonly channel: OrderChannel;
  readonly operator: PaymentOperator;
  readonly reference: string;
  /** Pre-formatted `fr-CM` XAF — the server owns every `Intl` call. */
  readonly amountClaimedFormatted: string;
  readonly orderTotalFormatted: string;
  /** True when the claimed amount and the order total disagree. */
  readonly amountMismatch: boolean;
  readonly submittedAtRelative: string;
  /**
   * The DERIVATIVE URL, built server-side by `publicUrlFor`, or `null` when the
   * customer uploaded nothing. This component never composes a storage key of
   * its own — see `page.tsx` for why that is a security boundary and not a
   * convenience.
   */
  readonly screenshotUrl: string | null;
  /** The order number a matching reference was already submitted on (ORD-04). */
  readonly duplicateOnOrderNumber: string | null;
}

/** The reference, with a copy button that confirms itself in place. */
function ReferenceRow({ reference }: { readonly reference: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reference);
    } catch {
      // A refused clipboard permission is not worth an error state: the
      // reference is right there in selectable text, so the merchant's fallback
      // is the one they would have used anyway.
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
          copied ? strings.claims.copiedReference : strings.claims.copyReference
        }
        onClick={() => {
          void handleCopy();
        }}
      >
        {copied ? (
          <Check aria-hidden="true" />
        ) : (
          <Copy aria-hidden="true" />
        )}
      </Button>
      {/*
       * The confirmation is an in-place swap plus a word, not a toast: the
       * merchant's eyes are on the reference they just copied, and a toast in
       * the corner asks them to look away from it.
       */}
      {copied ? (
        <span
          aria-live="polite"
          className="text-sm leading-normal font-medium text-muted-foreground"
        >
          {strings.claims.copiedReference}
        </span>
      ) : null}
    </div>
  );
}

/** The 96px thumb and its lightbox, or the no-upload tile. */
function Screenshot({
  screenshotUrl,
  orderNumber,
}: {
  readonly screenshotUrl: string | null;
  readonly orderNumber: string;
}) {
  const altText = strings.claims.screenshotAlt.replace("{n}", orderNumber);

  if (screenshotUrl === null) {
    // Never a broken-image glyph: a claim with no upload is a normal claim, and
    // a broken icon reads as a fault the merchant should report.
    return (
      <div className="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-muted">
        <ImageOff aria-hidden="true" className="size-5 text-muted-foreground" />
        <span className="px-1 text-center text-sm leading-normal font-medium text-muted-foreground">
          {strings.claims.noScreenshot}
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
            aria-label={strings.claims.viewScreenshot}
            className="size-24 shrink-0 overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <Image
          src={screenshotUrl}
          alt={altText}
          width={96}
          height={96}
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

export function ClaimCard(props: ClaimCardProps) {
  const {
    claimId,
    orderNumber,
    customerName,
    channel,
    operator,
    reference,
    amountClaimedFormatted,
    orderTotalFormatted,
    amountMismatch,
    submittedAtRelative,
    screenshotUrl,
    duplicateOnOrderNumber,
  } = props;

  /*
   * A5's optimistic removal. The card hides itself the instant the server says
   * yes, rather than waiting for a `router.refresh()` — the merchant's next tap
   * is on the NEXT claim, and re-rendering the whole queue to remove one card
   * would put a spinner between them and it.
   */
  const [resolved, setResolved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mismatchOpen, setMismatchOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  if (resolved) return null;

  async function runConfirm() {
    setError(null);
    setPending(true);

    const result = await confirmClaim({ claimId });

    setPending(false);

    if (result.ok) {
      setResolved(true);
      toast.success(
        strings.claims.confirmedToast.replace("{n}", orderNumber),
      );
      return;
    }

    setError(result.error.form?.[0] ?? strings.orders.genericError);
  }

  /** Returns whether the rejection stuck, so the dialog can close itself. */
  async function runReject(reason: string): Promise<boolean> {
    setError(null);

    const result = await rejectClaim({ claimId, reason });

    if (result.ok) {
      setResolved(true);
      toast.success(strings.claims.rejectedToast);
      return true;
    }

    setError(result.error.form?.[0] ?? strings.orders.genericError);
    return false;
  }

  const details = (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-sm leading-normal font-medium text-foreground">
          {orderNumber}
        </span>
        <span className="text-sm leading-normal font-normal text-muted-foreground">
          {customerName}
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-2xl leading-tight font-semibold tabular-nums text-foreground">
          {amountClaimedFormatted}
        </span>
        {amountMismatch ? (
          <span className="text-sm leading-normal font-medium text-destructive">
            {strings.claims.amountMismatch.replace(
              "{total}",
              orderTotalFormatted,
            )}
          </span>
        ) : null}
      </div>

      <OrderChannelChip channel={channel} operator={operator} />

      <ReferenceRow reference={reference} />

      <span className="text-sm leading-normal font-normal text-muted-foreground">
        {submittedAtRelative}
      </span>
    </div>
  );

  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button
        type="button"
        className="min-h-11 w-full sm:w-fit"
        disabled={pending}
        onClick={() => {
          // The mismatch is the ONE case that asks first. Everything else is
          // ORD-03's single tap.
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
        {strings.claims.confirmCta}
      </Button>

      <Button
        type="button"
        variant="destructive"
        className="min-h-11 w-full sm:w-fit"
        disabled={pending}
        onClick={() => {
          setRejectOpen(true);
        }}
      >
        <X aria-hidden="true" />
        {strings.claims.rejectCta}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      {/* Below `md` the picture leads, because on a phone it is the thing the
          merchant zooms into first. At `md`+ it moves to the right rail. */}
      <div className="flex flex-col gap-4 md:flex-row-reverse md:justify-end md:gap-6">
        <Screenshot screenshotUrl={screenshotUrl} orderNumber={orderNumber} />
        <div className="flex min-w-0 flex-1 flex-col gap-4">{details}</div>
      </div>

      {duplicateOnOrderNumber === null ? null : (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          {/*
           * ORD-04's alert leaves BOTH buttons enabled, on purpose. A repeated
           * reference is evidence, not a verdict — the merchant may well be
           * looking at a customer who resubmitted after a typo — and A5 is
           * explicit that the merchant is the judge.
           */}
          <AlertDescription className="text-destructive">
            {strings.claims.duplicateReference.replace(
              "{n}",
              duplicateOnOrderNumber,
            )}
          </AlertDescription>
        </Alert>
      )}

      {error === null ? null : (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {actions}

      <AlertDialog open={mismatchOpen} onOpenChange={setMismatchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{strings.claims.confirmCta}</AlertDialogTitle>
            <AlertDialogDescription>
              {strings.claims.mismatchDialogBody
                .replace("{claimed}", amountClaimedFormatted)
                .replace("{total}", orderTotalFormatted)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">
              {strings.claims.mismatchDialogCancel}
            </AlertDialogCancel>
            {/*
             * Default variant, not destructive: confirming a payment is the
             * outcome the merchant wants, and the dialog exists to slow them
             * down, not to warn them off.
             */}
            <AlertDialogAction
              className="min-h-11"
              disabled={pending}
              onClick={() => {
                void runConfirm();
              }}
            >
              {strings.claims.mismatchDialogConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onReject={runReject}
      />
    </div>
  );
}
