"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Check, Copy, LoaderCircle, TriangleAlert, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SubscriptionClaimCard } from "@/components/subscription-claim-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import type { PaymentOperator } from "@/server/db/enums";
import type { PlanTier } from "@/server/entitlements/plans";
import { requestThreadAttachmentUpload } from "@/server/images/thread-upload";
import { formatMsisdnForDisplay } from "@/server/payments/phone";
import { formatXaf } from "@/server/payments/whatsapp";
import { submitSubscriptionPayment } from "@/server/subscription/actions";
import type { SubscriptionClaimRow } from "@/server/subscription/claims";

/**
 * SUB-03's submit form — 06-UI-SPEC.md § A3 (R-3). The page's ONE primary CTA.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS LIVES ON `/dashboard/plan` AND NOT INSIDE THE SUPPORT THREAD.
 * ---------------------------------------------------------------------------
 * R-3, restated at the call site: the thread carries the RECEIPT (a `SYSTEM`
 * message with `subscriptionClaimId`), never the FORM. A payment form inside
 * a chat transcript competes with a conversation and strands the merchant
 * without plan or price context. This page is where a merchant already goes
 * to think about paying.
 *
 * ---------------------------------------------------------------------------
 * NOT OPTIMISTIC. IT MINTS A ROW AND UPLOADS AN IMAGE.
 * ---------------------------------------------------------------------------
 * Unlike `composer.tsx`'s optimistic-hook-driven send, this dialog shows the
 * submitting state and WAITS for the server's answer before doing anything
 * to the screen — a claim row and (optionally) a stored receipt image are too
 * consequential to show before they exist.
 *
 * ---------------------------------------------------------------------------
 * ON SUCCESS: AN OPTIMISTIC CARD, THEN A BACKGROUND REFRESH.
 * ---------------------------------------------------------------------------
 * `submitSubscriptionPaymentClaim` (`src/server/subscription/claims.ts`)
 * returns the created claim so THIS component can swap straight to the
 * read-only `SubscriptionClaimCard` without waiting on a second database
 * read of its own. The one field it cannot show immediately is the receipt
 * thumbnail: `publicUrlFor` (`src/server/images/r2.ts`) is `server-only` and
 * a client component cannot resolve a storage key into a URL, so the
 * optimistic card renders with `receiptUrl: null` and `router.refresh()` is
 * still called in the background — the very next server render
 * (`page.tsx`) resolves the real URL and the thumbnail appears. This is the
 * same "optimistic now, reconciled on refresh" shape `plan-switch-form.tsx`
 * already uses for a plan switch, applied to a payment claim.
 *
 * ---------------------------------------------------------------------------
 * THE RECEIPT IS OPTIONAL, AND AN EXPIRED-TRIAL MERCHANT MAY GENUINELY NOT
 * BE ABLE TO ATTACH ONE.
 * ---------------------------------------------------------------------------
 * `submitSubscriptionPayment` is `mode: "read"` precisely so an expired-trial
 * merchant can still submit a claim (see that action's own header). But the
 * receipt upload triad it reuses — `requestThreadAttachmentUpload` and
 * `/api/upload/thread-finalize` (plan 06-11) — is `mode: "write"` /
 * `ctx.canWrite`-gated, unchanged by this plan, because D-08's read-only
 * trial state already blocks the general support-thread attach affordance
 * for the same population. An expired merchant can therefore submit a
 * reference and an operator with no photo; the schema's `receiptKey` is
 * nullable precisely so that path is not a dead end. A failed or refused
 * upload is surfaced inline and never blocks the claim itself, mirroring
 * `claim-form.tsx`'s own "the screenshot is optional, so it never costs
 * somebody their claim" rule.
 *
 * ---------------------------------------------------------------------------
 * NO INVENTED USSD STRING (§ Payment instructions).
 * ---------------------------------------------------------------------------
 * `src/server/payments/ussd.ts`'s own header settles this: neither MTN nor
 * Orange Cameroon publishes a one-shot parametrized PERSON-TO-PERSON dial
 * string, only merchant-code flows this platform account does not hold. So
 * this dialog restates the platform's own receiving number and a manual-copy
 * affordance — the unconditional floor — and nothing else.
 *
 * The number is derived from `strings.trial.contactUrl`, the ONE real,
 * monitored contact number this codebase already treats as copy rather than
 * configuration (see that string's own header). Mobile Money and Orange
 * Money both resolve a plain phone number, so the same monitored number is
 * the platform's receiving number too, rather than a second literal that
 * could silently drift from the first.
 */

const OPERATORS: readonly PaymentOperator[] = ["MTN_MOMO", "ORANGE_MONEY"];

const OPERATOR_LABELS: Record<PaymentOperator, string> = {
  MTN_MOMO: strings.plan.subscriptionClaim.operatorMtn,
  ORANGE_MONEY: strings.plan.subscriptionClaim.operatorOrange,
};

/** See this file's header. `contactUrl` is `https://wa.me/2376XXXXXXXX`. */
const PLATFORM_MSISDN = strings.trial.contactUrl.replace(
  /^https:\/\/wa\.me\//,
  "",
);
const PLATFORM_MSISDN_DISPLAY = formatMsisdnForDisplay(PLATFORM_MSISDN);

/** Mirrors `thread-upload.ts`'s private byte cap — see `composer.tsx` for why. */
const MAX_RECEIPT_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const FINALIZE_ENDPOINT = "/api/upload/thread-finalize";

type UploadState = "empty" | "uploading" | "ready" | "failed";

/** The one field of the finalize response this dialog uses. */
function readStorageKey(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const key = (body as { storageKey?: unknown }).storageKey;
  return typeof key === "string" && key.length > 0 ? key : null;
}

/** The platform's own number, restated with a copy button — § B5, reversed. */
function PayToBlock() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(PLATFORM_MSISDN_DISPLAY);
    } catch {
      // The number is right there as selectable text; no confirmation for a
      // copy that did not happen (same rule `copy-field.tsx` documents).
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted p-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm leading-snug font-semibold text-muted-foreground">
          {strings.plan.subscriptionClaim.payToLabel}
        </span>
        <span className="font-mono text-lg leading-snug font-semibold tabular-nums text-foreground select-all">
          {PLATFORM_MSISDN_DISPLAY}
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 shrink-0"
        onClick={() => {
          void handleCopy();
        }}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied
          ? strings.plan.subscriptionClaim.copiedNumber
          : strings.plan.subscriptionClaim.copyNumber}
      </Button>
    </div>
  );
}

export interface SubmitPaymentDialogProps {
  readonly planTier: PlanTier;
  /** Server-resolved from the plan registry — never computed here. */
  readonly amountXaf: number;
  /** `true` renders the resubmit trigger copy (a REJECTED claim exists). */
  readonly resubmit: boolean;
  /** The rejected claim's operator, pre-selected when `resubmit` is `true`. */
  readonly defaultOperator: PaymentOperator | null;
}

export function SubmitPaymentDialog({
  planTier,
  amountXaf,
  resubmit,
  defaultOperator,
}: SubmitPaymentDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [operator, setOperator] = useState<PaymentOperator | null>(
    defaultOperator,
  );
  const [reference, setReference] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [uploadState, setUploadState] = useState<UploadState>("empty");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  /*
   * The optimistic post-success view. Once set, this replaces the trigger
   * button AND the dialog entirely for the rest of this component's life —
   * `router.refresh()` (fired in the same handler) hands the true, fully
   * resolved state back to `page.tsx` on its next render, which unmounts
   * this whole island in favour of its own server-rendered card. See the
   * file header.
   */
  const [submittedClaim, setSubmittedClaim] =
    useState<SubscriptionClaimRow | null>(null);

  function resetFields() {
    setOperator(defaultOperator);
    setReference("");
    setErrors({});
    clearAttachment();
  }

  function clearAttachment() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setStorageKey(null);
    setUploadState("empty");
  }

  async function runUpload(file: File) {
    if (!ACCEPTED_CONTENT_TYPES.includes(file.type)) {
      setUploadState("failed");
      return;
    }

    try {
      const grant = await requestThreadAttachmentUpload({
        kind: "subscriptions",
        contentType: file.type,
        byteSize: file.size,
      });
      if (!grant.ok) {
        setUploadState("failed");
        return;
      }

      const stored = await fetch(grant.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!stored.ok) {
        setUploadState("failed");
        return;
      }

      const finalized = await fetch(FINALIZE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: grant.uploadId,
          kind: "subscriptions",
        }),
      });
      if (!finalized.ok) {
        setUploadState("failed");
        return;
      }

      const key = readStorageKey(await finalized.json());
      if (key === null) {
        setUploadState("failed");
        return;
      }

      setStorageKey(key);
      setUploadState("ready");
    } catch {
      // A dropped connection mid-upload — the claim is not the photo's
      // fault, so the receipt field just fails and the rest keeps working.
      setUploadState("failed");
    }
  }

  function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    // Cleared so picking the same photo twice in a row still fires a change.
    event.target.value = "";
    if (file === null) return;

    /*
     * The courtesy check, before a byte leaves the device. The binding limit
     * is the mint schema's own `.max()`, which signs the real ceiling into
     * `content-length` so R2 enforces it regardless of what this file
     * believes — matching `composer.tsx`'s own division of labour between
     * this client-side check and the server's.
     */
    if (file.size > MAX_RECEIPT_UPLOAD_BYTES) {
      setUploadState("failed");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setStorageKey(null);
    setUploadState("uploading");

    void runUpload(file);
  }

  async function handleSubmit() {
    if (operator === null) return;

    setPending(true);
    setErrors({});

    const result = await submitSubscriptionPayment({
      operator,
      reference,
      planTier,
      receiptUploadKey: storageKey ?? undefined,
    });

    setPending(false);

    if (!result.ok) {
      setErrors(result.error);
      return;
    }

    setOpen(false);
    toast.success(strings.plan.subscriptionClaim.successToast);
    setSubmittedClaim(result.claim);
    router.refresh();
  }

  const canSubmit =
    operator !== null &&
    reference.trim().length >= 3 &&
    !pending &&
    uploadState !== "uploading";

  const formError = errors.form?.[0];
  const referenceError = errors.reference?.[0];

  /* --- Post-success: the read-only card, in place of everything below --- */

  if (submittedClaim !== null) {
    return (
      <div className="flex flex-col gap-3">
        <SubscriptionClaimCard
          status={submittedClaim.status}
          operator={submittedClaim.operator}
          reference={submittedClaim.reference}
          amountXaf={submittedClaim.amountXaf}
          rejectionReason={submittedClaim.rejectionReason}
          submittedAt={submittedClaim.submittedAt}
          coversThrough={submittedClaim.coversThrough}
          // Resolved on the next server render — see the file header.
          receiptUrl={null}
        />
        <p className="text-sm leading-normal font-normal text-muted-foreground">
          {strings.plan.subscriptionClaim.awaitingBody}{" "}
          <Link
            href="/dashboard/support"
            className="font-medium text-foreground underline underline-offset-3"
          >
            {strings.plan.subscriptionClaim.awaitingLink}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="default"
        className="min-h-11 w-full sm:w-fit"
        onClick={() => {
          resetFields();
          setOpen(true);
        }}
      >
        {resubmit
          ? strings.plan.subscriptionClaim.resubmit
          : strings.plan.subscriptionClaim.trigger}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {strings.plan.subscriptionClaim.dialogTitle}
            </DialogTitle>
            <DialogDescription>
              {strings.plan.subscriptionClaim.dialogBody}
            </DialogDescription>
          </DialogHeader>

          <PayToBlock />

          {/* --- Operator --------------------------------------------- */}
          <div className="flex flex-col gap-2">
            <Label>{strings.plan.subscriptionClaim.operatorLabel}</Label>
            <RadioGroup
              value={operator ?? ""}
              onValueChange={(value: string) => {
                setOperator(value as PaymentOperator);
              }}
              className="grid grid-cols-2 gap-3"
            >
              {OPERATORS.map((available) => (
                <label
                  key={available}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm leading-snug font-medium text-foreground",
                    operator === available
                      ? "border-primary bg-primary/5"
                      : "border-border",
                  )}
                >
                  <RadioGroupItem value={available} />
                  {OPERATOR_LABELS[available]}
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* --- Transaction reference ---------------------------------- */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subscription-claim-reference">
              {strings.plan.subscriptionClaim.referenceLabel}
            </Label>
            <Input
              id="subscription-claim-reference"
              value={reference}
              onChange={(event) => {
                setReference(event.target.value.trim());
              }}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="font-mono"
              aria-invalid={Boolean(referenceError)}
              aria-describedby="subscription-claim-reference-helper"
            />
            <p
              id="subscription-claim-reference-helper"
              className="text-sm leading-normal font-normal text-muted-foreground"
            >
              {strings.plan.subscriptionClaim.referenceHelper.replace(
                "{operator}",
                operator ? OPERATOR_LABELS[operator] : "",
              )}
            </p>
            {referenceError ? (
              <p className="text-sm leading-normal font-normal text-destructive">
                {referenceError}
              </p>
            ) : null}
          </div>

          {/* --- Amount (read-only) --------------------------------------- */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subscription-claim-amount">
              {strings.plan.subscriptionClaim.amountLabel}
            </Label>
            <Input
              id="subscription-claim-amount"
              readOnly
              value={formatXaf(amountXaf)}
              className="font-mono tabular-nums"
            />
          </div>

          {/* --- Receipt image (optional) ---------------------------------- */}
          <div className="flex flex-col gap-1.5">
            <Label>{strings.plan.subscriptionClaim.receiptLabel}</Label>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_CONTENT_TYPES.join(",")}
              className="sr-only"
              onChange={onPickFile}
            />

            {previewUrl === null ? (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-input px-4 py-3 text-sm leading-normal font-medium text-foreground hover:bg-accent"
                >
                  <Upload aria-hidden="true" className="size-4" />
                  {strings.plan.subscriptionClaim.receiptLabel}
                </button>
                {uploadState === "failed" ? (
                  <span className="text-sm leading-normal font-normal text-destructive">
                    {strings.support.attachments.uploadError}
                  </span>
                ) : null}
              </>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={strings.plan.subscriptionClaim.receiptLabel}
                  className="relative size-24 shrink-0 overflow-hidden rounded-md border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL. */}
                  <img
                    src={previewUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                  {uploadState === "uploading" ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-5 animate-spin"
                      />
                    </span>
                  ) : null}
                </button>

                <div className="flex flex-1 flex-col gap-1">
                  <span className="text-sm leading-normal font-normal text-muted-foreground">
                    {strings.support.attachments.typeHelper}
                  </span>
                  {uploadState === "failed" ? (
                    <span className="text-sm leading-normal font-normal text-destructive">
                      {strings.support.attachments.uploadError}
                    </span>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={clearAttachment}
                  aria-label={strings.support.attachments.removeLabel}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
            )}

            <p className="text-sm leading-normal font-normal text-muted-foreground">
              {strings.plan.subscriptionClaim.receiptHelper}
            </p>
          </div>

          {formError ? (
            <Alert variant="destructive">
              <TriangleAlert aria-hidden="true" />
              <AlertDescription className="text-destructive">
                {formError}
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {strings.plan.subscriptionClaim.cancel}
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={!canSubmit}
              onClick={() => {
                void handleSubmit();
              }}
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : null}
              {pending
                ? strings.plan.subscriptionClaim.submitting
                : strings.plan.subscriptionClaim.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
