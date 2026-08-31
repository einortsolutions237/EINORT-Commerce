"use client";

import { Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type ChangeEvent, type FormEvent } from "react";

import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { submitClaim } from "@/server/claims/submit";
import type { PaymentOperator } from "@/server/db/enums";
/*
 * A namespace import, for the reason `src/server/claims/submit.ts` states about
 * its own: the minted-presign helper's name then appears at exactly ONE line in
 * this file — the line that calls it. The screenshot path is unauthenticated and
 * token-gated, so "where is it invoked from the client?" is a question a
 * reviewer should be able to answer with one grep and no reading.
 */
import * as claimUpload from "@/server/images/claim-upload";

/**
 * B6 (CHK-04 / ORD-04 / D-11) — the customer says they have paid.
 *
 * ---------------------------------------------------------------------------
 * SUCCESS IS A PAGE STATE, NOT A TRANSIENT NOTIFICATION.
 * ---------------------------------------------------------------------------
 * A successful submission calls `router.refresh()` and the page comes back as
 * the `PAYMENT_CLAIMED` block — "Payment being confirmed", with the read-only
 * recap of what was sent. Nothing here announces the success on its own. A
 * self-dismissing banner would be the wrong instrument for the single most
 * consequential thing that happens on this surface: the customer looks away for
 * two seconds, it is gone, and the only remaining evidence that their money was
 * accounted for is a page they now have to interpret. The status block IS the
 * evidence, it is permanent, and it survives a reload and a share.
 *
 * The pending flag is deliberately NOT cleared on success — the refresh unmounts
 * this component, and clearing it first would flash `I've paid` back onto a form
 * that is about to disappear, which reads as a submission that failed.
 *
 * ---------------------------------------------------------------------------
 * THE `I'VE PAID` DISCLOSURE, AND WHY DISPUTED SKIPS IT.
 * ---------------------------------------------------------------------------
 * In `PAYMENT_PENDING` the customer has just been told to go to their phone and
 * send money. The reference field is useless until they come back, so the form
 * opens behind the primary CTA rather than sitting under the instructions
 * collecting a half-typed guess. Tapping `I've paid` IS the assertion; the
 * fields are the detail behind it, and the same button then submits them, so
 * only one `I've paid` is ever on screen.
 *
 * In `DISPUTED` the form is open from the first paint and the submit reads
 * `Send corrected details`. D-11 makes a dispute recoverable and the merchant's
 * quoted reason is sitting directly above — putting the fix behind one more tap
 * would leave a customer who has already been refused once staring at a
 * rejection with no visible way out.
 *
 * ---------------------------------------------------------------------------
 * THE SCREENSHOT IS OPTIONAL, SO IT NEVER COSTS SOMEBODY THEIR CLAIM.
 * ---------------------------------------------------------------------------
 * Every failure in the three-step upload — an unsupported type, a refused mint,
 * a rejected PUT, an unprocessable image, a dropped connection — lands in one
 * inline message beside the zone and leaves the rest of the form working. The
 * customer's payment is real whether or not a photo of it reached storage, and
 * a form that refuses the claim because the attachment failed would turn an
 * optional nicety into a hard dependency on a mobile connection in Douala.
 *
 * Only the `storageKey` the finalize route returned is ever submitted. The file
 * name is used for the on-screen caption and goes into no request body: it is
 * the one part of an upload the browser controls completely, and the server
 * rebuilds the key from the resolved tenant regardless (T-03-23).
 *
 * ---------------------------------------------------------------------------
 * NOTHING FINANCIAL IS IN THIS FORM.
 * ---------------------------------------------------------------------------
 * There is no amount input, and there must never be one. `submitClaim` copies
 * `amountClaimedXaf` from `Order.totalXaf`, because the merchant's queue shows a
 * mismatch line when the claim and the order disagree and that comparison only
 * means something while one side of it is the server's own number (T-03-79).
 */

const OPERATOR_LABELS: Record<PaymentOperator, string> = {
  MTN_MOMO: strings.checkout.operatorMtn,
  ORANGE_MONEY: strings.checkout.operatorOrange,
};

/**
 * Mirrors `ALLOWED_UPLOAD_CONTENT_TYPES` in `src/server/images/r2.ts`, which is
 * a server-only module and cannot be imported here. This list is the picker
 * filter and a courtesy check; the binding one is the mint, which pins the
 * content type into the signature so a lie here produces a 403 rather than an
 * object of the wrong kind.
 */
const ACCEPTED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** The anonymous, token-gated sibling of the merchant finalize route. */
const FINALIZE_ENDPOINT = "/api/upload/claim-finalize";

/** The one field of the finalize response this form uses, narrowed by hand. */
function readStorageKey(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const key = (body as { storageKey?: unknown }).storageKey;
  return typeof key === "string" && key.length > 0 ? key : null;
}

type UploadState = "empty" | "uploading" | "ready" | "failed";

export function ClaimForm({
  slug,
  token,
  operators,
  defaultOperator,
  previousReference,
}: {
  readonly slug: string;
  readonly token: string;
  /** Only what the merchant configured — never the full enum (D-16). */
  readonly operators: readonly PaymentOperator[];
  readonly defaultOperator: PaymentOperator;
  /** Present only on the D-11 correction, and it pre-fills the input. */
  readonly previousReference: string | null;
}) {
  const router = useRouter();
  const fieldId = useId();

  const correcting = previousReference !== null;

  const [open, setOpen] = useState(correcting);
  const [operator, setOperator] = useState<PaymentOperator>(defaultOperator);
  const [reference, setReference] = useState(previousReference ?? "");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [uploadState, setUploadState] = useState<UploadState>("empty");
  const [attachment, setAttachment] = useState<{
    previewUrl: string;
    caption: string;
  } | null>(null);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  const submitLabel = correcting
    ? strings.orderStatus.claimResubmit
    : strings.orderStatus.claimSubmit;

  function clearAttachment() {
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
    setStorageKey(null);
    setUploadState("empty");
  }

  /**
   * The three-step upload, in the same order and with the same failure handling
   * as `image-gallery-field.tsx` — one style for this sequence, not two.
   */
  async function runUpload(file: File) {
    if (!ACCEPTED_CONTENT_TYPES.includes(file.type)) {
      setUploadState("failed");
      return;
    }

    try {
      const grant = await claimUpload.requestClaimScreenshotUpload({
        slug,
        token,
        contentType: file.type,
        byteSize: file.size,
      });
      if (!grant.ok) {
        setUploadState("failed");
        return;
      }

      /*
       * Byte-for-byte the signed value. R2 compares this header against the
       * signature, so `image/JPEG` here is a 403 blamed on storage and caused
       * three lines above.
       */
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
        // The token again, because the finalize route re-authorizes exactly as
        // the mint did. No key and no file name: the route recomputes the key
        // from the tenant it resolves for itself.
        body: JSON.stringify({ slug, token, uploadId: grant.uploadId }),
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
      // A dropped connection mid-upload. Same outcome as every other failure:
      // the attachment is unavailable and the claim is not.
      setUploadState("failed");
    }
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    // Cleared so picking the same photo twice in a row still fires a change.
    event.target.value = "";
    if (file === null) return;

    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment({
      previewUrl: URL.createObjectURL(file),
      caption: file.name,
    });
    setStorageKey(null);
    setUploadState("uploading");

    void runUpload(file);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});

    const result = await submitClaim({
      slug,
      token,
      operator,
      reference,
      screenshotKey: storageKey,
    });

    if (result.ok) {
      // The page comes back as the PAYMENT_CLAIMED block. `pending` stays true
      // on purpose — see the header.
      router.refresh();
      return;
    }

    setErrors(result.error);
    setPending(false);
  }

  const formError = errors.form?.[0];
  const referenceError = errors.reference?.[0];

  /* --- Collapsed: the primary CTA that opens the form ------------------- */

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center justify-center rounded bg-primary px-4 text-base leading-normal font-semibold text-primary-foreground hover:bg-primary/80"
      >
        {submitLabel}
      </button>
    );
  }

  /* --- Open: the fields, and the same label on the submit ---------------- */

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {/* --- Operator ---------------------------------------------------- */}

      <div>
        <span
          id={`${fieldId}-operator`}
          className="block text-sm leading-snug font-semibold text-foreground"
        >
          {strings.orderStatus.claimOperatorLabel}
        </span>

        {/*
         * Pre-filled from the path the customer took, and still editable: a
         * customer who meant to use one wallet and reached for the other is
         * common, and the network the money actually left from is the only one
         * whose reference the merchant can match.
         */}
        <div
          role="radiogroup"
          aria-labelledby={`${fieldId}-operator`}
          className="mt-2 flex flex-wrap gap-2"
        >
          {operators.map((available) => (
            <button
              key={available}
              type="button"
              role="radio"
              aria-checked={operator === available}
              onClick={() => setOperator(available)}
              className={cn(
                "min-h-11 rounded border px-4 text-sm leading-snug font-semibold",
                operator === available
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-accent",
              )}
            >
              {OPERATOR_LABELS[available]}
            </button>
          ))}
        </div>
      </div>

      {/* --- Transaction reference --------------------------------------- */}

      <div>
        <label
          htmlFor={`${fieldId}-reference`}
          className="block text-sm leading-snug font-semibold text-foreground"
        >
          {strings.orderStatus.claimReferenceLabel}
        </label>

        <input
          id={`${fieldId}-reference`}
          name="reference"
          type="text"
          required
          minLength={3}
          maxLength={64}
          value={reference}
          /*
           * Uppercased as typed rather than on blur or on the server alone. The
           * reference the merchant reads off their own SMS is uppercase, and a
           * customer comparing two strings character by character on a phone
           * should be comparing like with like. `normalizeReference` collapses
           * the difference server-side anyway — this is so the person can see
           * that it did.
           */
          onChange={(event) => setReference(event.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={Boolean(referenceError)}
          aria-describedby={`${fieldId}-reference-helper`}
          className="mt-2 block min-h-11 w-full rounded border border-input bg-background px-3 font-mono text-base leading-normal tracking-wide text-foreground aria-invalid:border-destructive"
        />

        {referenceError ? (
          // ORD-04, at the field that caused it and in the destructive token.
          // The customer's next action is to re-read one input, so the message
          // belongs beside that input rather than anywhere else on the page.
          <p className="mt-2 text-base leading-relaxed font-normal text-destructive">
            {referenceError}
          </p>
        ) : null}

        <p
          id={`${fieldId}-reference-helper`}
          className="mt-2 text-base leading-relaxed font-normal text-muted-foreground"
        >
          {strings.orderStatus.claimReferenceHelper.replace(
            "{operator}",
            OPERATOR_LABELS[operator],
          )}
        </p>
      </div>

      {/* --- Screenshot (optional) --------------------------------------- */}

      <div>
        {attachment === null ? (
          <label
            htmlFor={`${fieldId}-screenshot`}
            className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-input px-4 py-3 text-base leading-normal font-semibold text-foreground hover:bg-accent"
          >
            <Upload className="size-5 shrink-0" aria-hidden="true" />
            {strings.orderStatus.claimScreenshotLabel}
          </label>
        ) : (
          <div className="flex items-center gap-3 rounded border border-border p-3">
            {/*
             * A local object URL for a file that is still uploading, so the
             * thumb appears the instant it is chosen rather than after a round
             * trip. `next/image` cannot optimize a blob URL and `alt=""` is
             * deliberate — the caption beside it already names the file, and
             * any alt text this component wrote would be a guess about a
             * picture it has never seen.
             */}
            {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL, see above. */}
            <img
              src={attachment.previewUrl}
              alt=""
              width={96}
              height={96}
              className="size-24 shrink-0 rounded border border-border object-cover"
            />

            <span className="min-w-0 flex-1 truncate text-base leading-relaxed font-normal text-foreground">
              {attachment.caption}
            </span>

            <button
              type="button"
              onClick={clearAttachment}
              // Borrowed from the merchant gallery's own remove control rather
              // than authored twice. `src/lib/strings.ts` forbids writing one
              // sentence twice, slightly differently, and this is that sentence.
              aria-label={strings.products.imageRemove}
              className="flex size-11 shrink-0 items-center justify-center rounded border border-border text-foreground hover:bg-accent"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        )}

        <input
          id={`${fieldId}-screenshot`}
          name="screenshot"
          type="file"
          accept={ACCEPTED_CONTENT_TYPES.join(",")}
          onChange={onPick}
          className="sr-only"
        />

        {/*
         * The zone changes without a navigation, so it announces itself. The
         * failure copy is the merchant gallery's, for the same reason the
         * remove label is.
         */}
        <div aria-live="polite">
          {uploadState === "failed" ? (
            <p className="mt-2 text-base leading-relaxed font-normal text-destructive">
              {strings.products.imageUploadFailed}
            </p>
          ) : null}
        </div>

        <p className="mt-2 text-base leading-relaxed font-normal text-muted-foreground">
          {strings.orderStatus.claimScreenshotHelper}
        </p>
      </div>

      {/* --- Submit ------------------------------------------------------ */}

      {/*
       * A blocking refusal — the rate limit, an unusable link — is an alert on
       * the page, directly above the button that failed. It stays until the
       * next attempt, because a customer who looked away must not be left with
       * a button that did nothing and no explanation anywhere on screen.
       */}
      {formError ? (
        <p
          role="alert"
          className="rounded border border-destructive px-3 py-2 text-base leading-relaxed font-normal text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        // Held only while an attachment is in flight, so a fast thumb does not
        // silently drop the screenshot it just chose. A failed upload does not
        // hold it — the claim matters and the photo does not.
        disabled={pending || uploadState === "uploading"}
        className="flex min-h-12 w-full items-center justify-center rounded bg-primary px-4 text-base leading-normal font-semibold text-primary-foreground hover:bg-primary/80 disabled:opacity-40"
      >
        {pending ? strings.orderStatus.claimSubmitting : submitLabel}
      </button>
    </form>
  );
}
