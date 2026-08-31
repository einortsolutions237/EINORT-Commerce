"use client";

import { useId, useState, useTransition } from "react";
import {
  BanknoteIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  MessageCircleIcon,
  TruckIcon,
} from "lucide-react";

import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import {
  submitCheckout,
  type CheckoutOutcome,
} from "@/server/checkout/actions";
import type { OrderChannel, PaymentOperator } from "@/server/db/enums";
import type { ResolvedPaymentPaths } from "@/server/payments/settings";

/**
 * The B4 three-section checkout form (CHK-02 / D-16 / D-12).
 *
 * ---------------------------------------------------------------------------
 * THIS COMPONENT KNOWS NO PRICES AND CANNOT LEARN ANY.
 * ---------------------------------------------------------------------------
 * Every amount in `lines` and `total` arrives as a STRING the server already
 * formatted, and nothing here adds, multiplies or compares one. That is not
 * tidiness: `submitCheckout`'s schema has no amount field and no items field
 * at all, so even a rewritten bundle has nothing to send. The summary below is
 * a receipt of what the server computed, not an input to it (TEN-08,
 * T-03-59).
 *
 * ---------------------------------------------------------------------------
 * AN UNCONFIGURED PATH IS ABSENT, NOT DISABLED.
 * ---------------------------------------------------------------------------
 * The three cards are each behind a `paths.*` guard, so a method this seller
 * cannot accept is not in the document at all. A greyed-out card would be
 * worse than no card: the shopper reaches for it, cannot use it, and reads
 * that as the store being broken rather than as the seller simply not taking
 * that method. `submitCheckout` re-checks the same resolver server-side, so
 * this is the courtesy and the action is the authority (T-03-60).
 *
 * ---------------------------------------------------------------------------
 * PLACING AN ORDER IS NOT OPTIMISTIC, AND THAT IS A DELIBERATE EXCEPTION.
 * ---------------------------------------------------------------------------
 * 03-UI-SPEC.md § Interaction & State Contract permits an optimistic update in
 * exactly three places, and this is not one of them. The button disables, the
 * label swaps to the submitting copy, the width is held so the page does not
 * move under a thumb, and the form WAITS. A cart quantity guessed wrongly is
 * corrected on the next render; an order guessed wrongly is a person who
 * believes they have bought something they have not.
 */

export type CheckoutSummaryLine = {
  variantId: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  /** Already formatted by the server. */
  lineTotal: string;
};

/** The three cards, in B4's order, each with its icon and its copy. */
const PAYMENT_OPTIONS = [
  {
    channel: "WHATSAPP",
    Icon: MessageCircleIcon,
    title: strings.checkout.whatsappTitle,
    description: strings.checkout.whatsappDescription,
    submit: strings.checkout.submitWhatsapp,
    submitting: strings.checkout.submittingWhatsapp,
  },
  {
    channel: "MANUAL_TRANSFER",
    Icon: BanknoteIcon,
    title: strings.checkout.transferTitle,
    description: strings.checkout.transferDescription,
    submit: strings.checkout.submitTransfer,
    submitting: strings.checkout.submittingTransfer,
  },
  {
    channel: "CASH_ON_DELIVERY",
    Icon: TruckIcon,
    title: strings.checkout.codTitle,
    description: strings.checkout.codDescription,
    submit: strings.checkout.submitCod,
    submitting: strings.checkout.submittingCod,
  },
] as const satisfies readonly {
  channel: OrderChannel;
  Icon: typeof TruckIcon;
  title: string;
  description: string;
  submit: string;
  submitting: string;
}[];

const [WHATSAPP_OPTION, TRANSFER_OPTION, COD_OPTION] = PAYMENT_OPTIONS;

const OPERATOR_LABELS: Record<PaymentOperator, string> = {
  MTN_MOMO: strings.checkout.operatorMtn,
  ORANGE_MONEY: strings.checkout.operatorOrange,
};

/**
 * One payment option as a full-width radio card.
 *
 * The WHOLE ROW is the control, so the whole row is the tap target — a 56px
 * band rather than a small circle beside a label, which on a phone held in one
 * hand is the difference between a thumb landing and a thumb missing.
 *
 * `children` is the expansion slot, used only by the manual-transfer card for
 * its D-16 operator chips. It sits OUTSIDE the button because a control nested
 * inside another control is neither valid markup nor operable with a keyboard.
 */
function PaymentCard({
  option,
  selected,
  onSelect,
  children,
}: {
  option: (typeof PAYMENT_OPTIONS)[number];
  selected: boolean;
  onSelect: (channel: OrderChannel) => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded border",
        selected ? "border-primary" : "border-border",
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => onSelect(option.channel)}
        className={cn(
          "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left",
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-background text-foreground hover:bg-accent",
        )}
      >
        <option.Icon className="size-5 shrink-0" aria-hidden="true" />

        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-snug font-semibold">
            {option.title}
          </span>
          <span
            className={cn(
              "block text-base leading-relaxed font-normal",
              selected ? "text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {option.description}
          </span>
        </span>
      </button>

      {children}
    </div>
  );
}

export function CheckoutForm({
  slug,
  storeName,
  paths,
  lines,
  itemCount,
  total,
}: {
  slug: string;
  storeName: string;
  paths: ResolvedPaymentPaths;
  lines: CheckoutSummaryLine[];
  itemCount: number;
  /** Already formatted by the server. */
  total: string;
}) {
  const fieldId = useId();

  const [channel, setChannel] = useState<OrderChannel | null>(null);
  /*
   * D-16 — pre-selected when the merchant configured exactly one operator, and
   * still rendered rather than hidden, because the customer needs to know
   * WHICH network to send to. A silent default would leave them guessing at
   * the one thing the screen exists to tell them.
   */
  const [operator, setOperator] = useState<PaymentOperator | null>(
    paths.operators.length === 1 ? paths.operators[0] : null,
  );

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [outcome, setOutcome] = useState<CheckoutOutcome | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  /*
   * ONE KEY PER MOUNT, NOT ONE PER SUBMIT (03-RESEARCH.md Pattern 7b).
   *
   * This is the whole mechanism. The key is minted here, during the first
   * render of this form, and every attempt the shopper makes on this screen —
   * the first tap, the impatient second tap, the retry after a refusal — sends
   * the SAME value, so the server recognises the repeat and hands back the
   * order it already placed instead of placing another. Minting it inside the
   * submit handler would give every attempt a fresh key, which is exactly the
   * duplicate-order bug wearing the costume of a fix (T-03-61).
   *
   * A LAZY `useState` INITIALISER RATHER THAN A REF, deliberately. Both mint
   * once per mount, but the initialiser runs during mounting instead of during
   * render, so it does not trip `react-hooks/refs` — and reaching for a ref
   * here would mean writing one during render, which is the pattern that rule
   * exists to stop. The setter is discarded: nothing may ever change this
   * value, because changing it is precisely the bug.
   */
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const selectedOption = PAYMENT_OPTIONS.find(
    (option) => option.channel === channel,
  );

  const addressRequired = channel === "CASH_ON_DELIVERY";

  function copyTrackingUrl(url: string): void {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    // The confirmation is IN PLACE and short-lived: it belongs at the point of
    // action, where the thumb already is, not in a toast at the other end of
    // the screen.
    window.setTimeout(() => setCopied(false), 2000);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!channel || pending) return;

    const form = new FormData(event.currentTarget);
    const text = (name: string): string => String(form.get(name) ?? "").trim();
    const address = text("deliveryAddress");
    const note = text("customerNote");

    setErrors({});

    startTransition(async () => {
      const result = await submitCheckout({
        slug,
        customerName: text("customerName"),
        customerPhone: text("customerPhone"),
        deliveryAddress: address.length > 0 ? address : null,
        customerNote: note.length > 0 ? note : null,
        channel,
        operator: channel === "MANUAL_TRANSFER" ? operator : null,
        idempotencyKey,
      });

      if (!result.ok) {
        setErrors(result.error);
        return;
      }

      setOutcome(result);

      /*
       * D-01 by construction: the order row and its tracking token already
       * exist — the action returned them — so the sale is recorded whether or
       * not this handoff succeeds. A blocked popup costs the shopper a tap on
       * the link below, never the order.
       */
      if (result.whatsappUrl) {
        window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
      }
    });
  }

  /* ---------------------------------------------------------------------
   * The D-12 block, and the only screen the shopper sees after a placement.
   * ------------------------------------------------------------------- */

  if (outcome) {
    const isWhatsapp = outcome.whatsappUrl !== null;

    return (
      <section>
        <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {isWhatsapp
            ? strings.orderStatus.placedWhatsappHeading
            : strings.orderStatus.placedCodHeading}
        </h1>

        <p className="mt-3 text-base leading-relaxed font-normal text-foreground">
          {(isWhatsapp
            ? strings.orderStatus.placedWhatsappBody
            : strings.orderStatus.placedCodBody
          ).replace("{store}", storeName)}
        </p>

        <p className="mt-2 text-sm leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {strings.orderStatus.orderNumberEyebrow.replace(
            "{orderNumber}",
            outcome.orderNumber,
          )}
        </p>

        {/*
         * D-12 — shown on screen IMMEDIATELY, on every path, before the
         * shopper goes anywhere. This link is the only way back to the order:
         * there is no account to log into, and the plaintext token exists
         * nowhere in the database, so a shopper who loses this URL has lost
         * their way in. It is never truncated for that reason — a URL with an
         * ellipsis in the middle cannot be read off a screen and retyped.
         */}
        <div className="mt-6 rounded border border-border bg-muted p-4">
          <p className="text-sm leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {strings.checkout.trackingHeading}
          </p>

          <div className="mt-2 flex items-start gap-2">
            <p className="min-w-0 flex-1 text-base leading-relaxed font-normal break-all text-foreground font-mono">
              {outcome.trackingUrl}
            </p>

            <button
              type="button"
              onClick={() => copyTrackingUrl(outcome.trackingUrl)}
              aria-label={strings.checkout.trackingCopy}
              className="flex size-11 shrink-0 items-center justify-center rounded text-foreground hover:bg-background"
            >
              {copied ? (
                <CheckIcon className="size-4" aria-hidden="true" />
              ) : (
                <CopyIcon className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* The in-place confirmation, at the point of action. */}
          <p
            aria-live="polite"
            className="mt-1 min-h-5 text-sm leading-snug font-semibold text-foreground"
          >
            {copied ? strings.checkout.trackingCopied : ""}
          </p>

          <p className="mt-2 text-base leading-relaxed font-normal text-muted-foreground">
            {strings.checkout.trackingBody}
          </p>
        </div>

        {/*
         * The page's one ink fill, now that the form's submit is gone. On the
         * WhatsApp path it reopens the conversation the popup may have been
         * blocked from opening; on the other two it carries the shopper to the
         * tracking page, which is where the payment instructions live.
         */}
        <a
          href={outcome.whatsappUrl ?? outcome.trackingPath}
          target={outcome.whatsappUrl ? "_blank" : undefined}
          rel={outcome.whatsappUrl ? "noopener noreferrer" : undefined}
          className="mt-6 flex min-h-12 w-full items-center justify-center rounded bg-primary px-4 text-base leading-normal font-semibold text-primary-foreground hover:bg-primary/80"
        >
          {outcome.whatsappUrl
            ? strings.orderStatus.openWhatsappAgain
            : strings.checkout.trackingHeading}
        </a>
      </section>
    );
  }

  /* ---------------------------------------------------------------------
   * The form.
   * ------------------------------------------------------------------- */

  const formError = errors.form?.[0];

  return (
    <form onSubmit={onSubmit} noValidate>
      {/* --- 1. Your details ------------------------------------------- */}

      <section>
        <h2 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.checkout.detailsHeading}
        </h2>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label
              htmlFor={`${fieldId}-name`}
              className="block text-sm leading-snug font-semibold text-foreground"
            >
              {strings.checkout.nameLabel}
            </label>
            <input
              id={`${fieldId}-name`}
              name="customerName"
              type="text"
              required
              autoComplete="name"
              aria-invalid={Boolean(errors.customerName)}
              className="mt-2 block min-h-11 w-full rounded border border-input bg-background px-3 text-base leading-normal text-foreground aria-invalid:border-destructive"
            />
            <FieldError messages={errors.customerName} />
          </div>

          <div>
            <label
              htmlFor={`${fieldId}-phone`}
              className="block text-sm leading-snug font-semibold text-foreground"
            >
              {strings.checkout.phoneLabel}
            </label>

            {/*
             * The `+237` is an ADORNMENT, not a value in the field. The
             * shopper types the nine digits they say out loud, and the server
             * normalises whatever arrives — so a number pasted with the
             * country code already on it still resolves rather than being
             * rejected for being right twice.
             */}
            <div className="mt-2 flex min-h-11 w-full items-stretch overflow-hidden rounded border border-input bg-background aria-invalid:border-destructive" aria-invalid={Boolean(errors.customerPhone)}>
              <span
                aria-hidden="true"
                className="flex items-center bg-muted px-3 text-base leading-normal tabular-nums text-muted-foreground"
              >
                {strings.checkout.phonePrefix}
              </span>
              <input
                id={`${fieldId}-phone`}
                name="customerPhone"
                type="tel"
                inputMode="tel"
                required
                autoComplete="tel-national"
                aria-invalid={Boolean(errors.customerPhone)}
                className="min-w-0 flex-1 bg-background px-3 text-base leading-normal tabular-nums text-foreground"
              />
            </div>

            <p className="mt-2 text-base leading-relaxed font-normal text-muted-foreground">
              {strings.checkout.phoneHelper}
            </p>
            <FieldError messages={errors.customerPhone} />
          </div>

          {/*
           * The address requirement APPEARS WITH THE SELECTION (B4). It is not
           * a greyed-out field waiting for permission: until cash on delivery
           * is chosen there is nothing to deliver to, and asking for an
           * address the seller will never use is a field the shopper abandons
           * the form over.
           */}
          <div>
            <label
              htmlFor={`${fieldId}-address`}
              className="block text-sm leading-snug font-semibold text-foreground"
            >
              {strings.checkout.addressLabel}
            </label>
            <textarea
              id={`${fieldId}-address`}
              name="deliveryAddress"
              rows={2}
              required={addressRequired}
              aria-required={addressRequired}
              autoComplete="street-address"
              aria-invalid={Boolean(errors.deliveryAddress)}
              className="mt-2 block w-full rounded border border-input bg-background p-3 text-base leading-relaxed text-foreground aria-invalid:border-destructive"
            />
            <FieldError messages={errors.deliveryAddress} />
          </div>

          <div>
            <label
              htmlFor={`${fieldId}-note`}
              className="block text-sm leading-snug font-semibold text-foreground"
            >
              {strings.checkout.noteLabel}
            </label>
            <textarea
              id={`${fieldId}-note`}
              name="customerNote"
              rows={2}
              className="mt-2 block w-full rounded border border-input bg-background p-3 text-base leading-relaxed text-foreground"
            />
          </div>
        </div>
      </section>

      {/* --- 2. How you'll pay ------------------------------------------ */}

      <section className="mt-8 border-t border-border pt-8">
        <h2
          id={`${fieldId}-payment`}
          className="text-2xl leading-tight font-semibold tracking-tight text-foreground"
        >
          {strings.checkout.paymentHeading}
        </h2>

        <div
          role="radiogroup"
          aria-labelledby={`${fieldId}-payment`}
          className="mt-4 flex flex-col gap-3"
        >
          {/*
           * ONE GUARD PER CARD, WRITTEN OUT RATHER THAN LOOPED.
           *
           * A shopper never sees a card whose guard is false, because there is
           * no element to see — the card is absent from the document, not
           * present and disabled. Spelling the three out means the rule is
           * readable in three lines instead of inferred from a predicate
           * inside a loop, and it is the shape a reviewer can check against
           * the merchant's settings page at a glance.
           */}
          {paths.whatsapp && (
            <PaymentCard
              option={WHATSAPP_OPTION}
              selected={channel === "WHATSAPP"}
              onSelect={setChannel}
            />
          )}

          {paths.manualTransfer && (
            <PaymentCard
              option={TRANSFER_OPTION}
              selected={channel === "MANUAL_TRANSFER"}
              onSelect={setChannel}
            >
              {/*
               * D-16 — the operator sub-choice, revealed BY the selection and
               * listing ONLY what the merchant configured. Sending money to
               * the wrong network is not a recoverable mistake in this market,
               * so the network is named on screen rather than assumed.
               */}
              {channel === "MANUAL_TRANSFER" && (
                <div
                  role="radiogroup"
                  aria-labelledby={`${fieldId}-operators`}
                  className="flex flex-wrap gap-2 border-t border-border bg-background p-3"
                >
                  <span id={`${fieldId}-operators`} className="sr-only">
                    {strings.checkout.transferTitle}
                  </span>

                  {paths.operators.map((available) => (
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
              )}
            </PaymentCard>
          )}

          {paths.cod && (
            <PaymentCard
              option={COD_OPTION}
              selected={channel === "CASH_ON_DELIVERY"}
              onSelect={setChannel}
            />
          )}
        </div>

        <FieldError messages={errors.channel} />
        <FieldError messages={errors.operator} />
      </section>

      {/* --- 3. Order summary ------------------------------------------- */}

      <section className="mt-8 border-t border-border pt-8">
        <h2 className="sr-only">{strings.checkout.summaryHeading}</h2>

        {/*
         * Collapsed below `md` behind one line that still answers the two
         * questions a shopper actually has at this point — how many things,
         * and how much — so collapsing costs them no information. Expanded
         * from `md` up, where the column has room for the detail.
         */}
        <button
          type="button"
          onClick={() => setSummaryOpen((open) => !open)}
          aria-expanded={summaryOpen}
          className="flex min-h-11 w-full items-center justify-between text-left text-sm leading-snug font-semibold text-foreground md:hidden"
        >
          <span className="tabular-nums">
            {strings.checkout.summaryCollapsed
              .replace("{n}", String(itemCount))
              .replace("{total}", total)}
          </span>
          <ChevronDownIcon
            className={cn("size-4 shrink-0", summaryOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>

        <div className={cn(summaryOpen ? "block" : "hidden", "md:block")}>
          <h3
            aria-hidden="true"
            className="hidden text-2xl leading-tight font-semibold tracking-tight text-foreground md:block"
          >
            {strings.checkout.summaryHeading}
          </h3>

          <ul className="mt-4">
            {lines.map((line) => (
              <li
                key={line.variantId}
                className="flex items-start justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="text-base leading-relaxed font-normal text-foreground">
                    {line.productName}
                  </p>
                  {line.variantLabel !== "" && (
                    <p className="text-sm leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                      {line.variantLabel}
                    </p>
                  )}
                  <p className="text-base leading-relaxed font-normal tabular-nums text-muted-foreground">
                    {`× ${line.quantity}`}
                  </p>
                </div>

                <p className="shrink-0 text-base leading-relaxed font-normal tabular-nums text-foreground">
                  {line.lineTotal}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
            <span className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
              {strings.cart.total}
            </span>
            <span className="text-2xl leading-tight font-semibold tracking-tight tabular-nums text-foreground">
              {total}
            </span>
          </div>
        </div>
      </section>

      {/* --- Submit ------------------------------------------------------ */}

      {/*
       * A blocking failure is an ALERT ON THE PAGE, above the button that
       * failed — never a toast alone. A toast dismisses itself, and a shopper
       * who looked away for two seconds is left with a button that did
       * nothing and no explanation anywhere on screen.
       */}
      {formError && (
        <p
          role="alert"
          className="mt-6 rounded border border-destructive px-3 py-2 text-base leading-relaxed font-normal text-destructive"
        >
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={!channel || pending}
        className="mt-6 flex min-h-12 w-full items-center justify-center rounded bg-primary px-4 text-base leading-normal font-semibold text-primary-foreground hover:bg-primary/80 disabled:opacity-40"
      >
        {!selectedOption
          ? strings.checkout.submitNoSelection
          : pending
            ? selectedOption.submitting
            : selectedOption.submit}
      </button>
    </form>
  );
}

/** A field-level refusal, rendered directly beneath the field that caused it. */
function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;

  return (
    <p className="mt-2 text-base leading-relaxed font-normal text-destructive">
      {messages[0]}
    </p>
  );
}
