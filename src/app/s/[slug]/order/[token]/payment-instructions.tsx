import { Phone } from "lucide-react";
import { Fragment } from "react";

import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";
import { formatMsisdnForDisplay } from "@/server/payments/phone";
import type { PaymentSettingsRow } from "@/server/payments/settings";
/*
 * Imported as a namespace on purpose. It keeps the builder's name at exactly
 * one place in this file — the call site below — so a grep for that builder
 * across `src/app/s` returns a COMPLETE list of every place a dial href can
 * originate on the storefront, with no import lines to read past. T-03-72 is
 * why that audit has to stay cheap: a href the operating system will act on,
 * built anywhere else or from anything client-supplied, is the whole threat.
 */
import * as ussd from "@/server/payments/ussd";
import { formatXaf } from "@/server/payments/whatsapp";
import type { PaymentOperator } from "@/server/db/enums";

import { CopyField } from "./copy-field";

/**
 * B5 / CHK-03 / D-15 — the highest-stakes block on the storefront.
 *
 * ---------------------------------------------------------------------------
 * WHAT MAKES THIS BLOCK DIFFERENT FROM EVERY OTHER ONE.
 * ---------------------------------------------------------------------------
 * A wrong number here is money sent to a stranger, and an unreadable amount is
 * a transfer the merchant cannot match to an order. There is no undo and no
 * support queue behind it. So the manual path — the number and the exact
 * amount, large, selectable, with a copy button — is rendered FIRST, LARGEST
 * and UNCONDITIONALLY, on every platform and in every tier. D-15 settled that
 * before the research went looking for anything better, and nothing the
 * research found is allowed to replace it. Everything below is an addition to
 * that floor, never a substitute for it.
 *
 * ---------------------------------------------------------------------------
 * WHY THE TIER DECISION IS MADE ON THE SERVER.
 * ---------------------------------------------------------------------------
 * 03-UI-SPEC.md § B5 requires the correct markup in the first paint and
 * forbids flashing a dial button and then removing it. A customer who sees a
 * button appear and vanish concludes the store is broken at the exact moment
 * they were about to pay. So the platform is read from the request
 * User-Agent here, in a Server Component: this module is deliberately NOT a
 * client island, and the only island on this page is the copy button.
 *
 * ---------------------------------------------------------------------------
 * THE ORDER ROW DOES NOT NAME AN OPERATOR, AND THAT IS WHY THIS LOOPS.
 * ---------------------------------------------------------------------------
 * `Order` records the channel, not which wallet the customer intends to send
 * from — that only becomes a fact when they submit a claim (`PaymentClaim`
 * carries it). While the order is still waiting to be paid there is genuinely
 * no such fact to read, so the block renders one complete set of instructions
 * per operator the merchant can actually receive on. Each set repeats the
 * amount rather than sharing one: the amount belongs beside the number it must
 * be sent to, and a shared amount block at the top invites the reader to think
 * the two numbers below it are alternatives to each other.
 */

/**
 * iOS, from the User-Agent, for the one decision it governs.
 *
 * KNOWN AND ACCEPTED GAP: iPadOS 13+ reports a desktop Macintosh User-Agent by
 * default, so an iPad in that mode is not matched here. That is tolerable and
 * not worth a fingerprinting workaround — an iPad has no dialler for a dial
 * href to fail in, the manual floor is rendered for it either way, and the
 * cost of the miss is a button that does nothing on a device nobody pays from.
 * A false NEGATIVE (missing a real iPhone) is the expensive direction, and
 * `iPhone` has been in that string unchanged for the platform's whole life.
 */
export function isIosUserAgent(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

export interface PaymentInstructionsProps {
  readonly storeName: string;
  /** The server's own order total. Never a number that came from the client. */
  readonly amountXaf: number;
  readonly settings: PaymentSettingsRow;
  /** The raw request User-Agent, read from `headers()` by the page. */
  readonly userAgent: string;
}

export function PaymentInstructions({
  storeName,
  amountXaf,
  settings,
  userAgent,
}: PaymentInstructionsProps) {
  const isIos = isIosUserAgent(userAgent);
  const amountLabel = formatXaf(amountXaf);

  // Only a wallet with a receiving NUMBER is a destination. A merchant code
  // with no number behind it improves the instructions; it does not receive
  // money — the same rule `resolvePaymentPaths` applies at checkout.
  const destinations: { operator: PaymentOperator; msisdn: string }[] = [];
  if (settings.mtnMomoNumber) {
    destinations.push({ operator: "MTN_MOMO", msisdn: settings.mtnMomoNumber });
  }
  if (settings.orangeMoneyNumber) {
    destinations.push({
      operator: "ORANGE_MONEY",
      msisdn: settings.orangeMoneyNumber,
    });
  }

  return (
    <section className="flex flex-col gap-6">
      {/* Display role — the largest thing in the action region. */}
      <h2 className="text-4xl leading-[1.05] font-semibold tracking-tight text-foreground">
        {strings.orderStatus.payHeading
          .replace("{amount}", amountLabel)
          .replace("{store}", storeName)}
      </h2>

      {destinations.map(({ operator, msisdn }) => (
        <OperatorInstructions
          key={operator}
          operator={operator}
          msisdn={msisdn}
          amountXaf={amountXaf}
          amountLabel={amountLabel}
          settings={settings}
          isIos={isIos}
        />
      ))}
    </section>
  );
}

interface OperatorInstructionsProps {
  readonly operator: PaymentOperator;
  readonly msisdn: string;
  readonly amountXaf: number;
  readonly amountLabel: string;
  readonly settings: PaymentSettingsRow;
  readonly isIos: boolean;
}

function OperatorInstructions({
  operator,
  msisdn,
  amountXaf,
  amountLabel,
  settings,
  isIos,
}: OperatorInstructionsProps) {
  const isMtn = operator === "MTN_MOMO";

  const operatorName = isMtn
    ? strings.checkout.operatorMtn
    : strings.checkout.operatorOrange;

  /*
   * The ONLY origin of a dial href on this surface (T-03-72). It is built from
   * the merchant's stored, six-digit-validated code and the server's own order
   * total, and it already carries `%23` in place of `#` — Pitfall 9, where an
   * unencoded `#` truncates the URI at the fragment and dials a code that ends
   * early. It returns non-null for MTN with a valid merchant code and for
   * nothing else, which is D-15's tier A condition expressed as a value.
   */
  const dial = ussd.buildMerchantUssd(operator, settings, amountXaf);

  // D-15 tier B: Orange with a merchant code. `#150*47#` takes NO parameters,
  // so there is nothing to prefill and a button would only hide the code the
  // customer still has to type by hand.
  const orangeMerchantCode = isMtn ? null : settings.orangeMerchantCode;

  /*
   * D-15 tier A: MTN, a valid merchant code, AND not iOS.
   *
   * The iOS half is not a nicety. Apple's documentation states the Phone app
   * will not dial a `tel` URL containing `*` or `#`, and percent-encoding does
   * not work around it — the URL is decoded before the dialler sees it. Every
   * merchant USSD string contains both characters, so the button would render,
   * be tapped, and do nothing (Pitfall 8). A dead button on a payment screen is
   * worse than no button: it teaches the customer the store is broken at the
   * one moment they were ready to send money.
   *
   * DO NOT "simplify" this to `dial !== null`. The two conditions are
   * independent facts and the second one is the whole reason D-15 exists.
   */
  const showDialButton = dial !== null && !isIos;

  /*
   * D-15 tier C — everything else, and the expected majority: a personal
   * wallet, or a merchant who never entered a code. Nothing renders in
   * addition. A deep link to the operator's menu ROOT is worse than nothing,
   * because it replaces the number the customer needs with a menu that does
   * not know it.
   */

  // The dial code is an operator fact verified in `src/server/payments/ussd.ts`,
  // not authored copy, so it is read from there — and only that module can make
  // the tier-B distinction between Orange's menu root and its merchant-payment
  // entry point, which is a choice a string catalogue cannot express.
  const menuCode = isMtn
    ? ussd.MTN_MENU_CODE
    : orangeMerchantCode
      ? ussd.ORANGE_MERCHANT_CODE_ENTRY
      : ussd.ORANGE_MENU_CODE;

  const steps = isMtn
    ? strings.orderStatus.mtnSteps
    : strings.orderStatus.orangeSteps;

  return (
    <div className="flex flex-col gap-4">
      <CopyField
        label={strings.orderStatus.payNumberLabel.replace(
          "{operator}",
          operatorName,
        )}
        value={formatMsisdnForDisplay(msisdn)}
        // Copied bare and national: this is what goes into a transfer field,
        // where spaces and a country prefix are a syntax error rather than a
        // formality.
        copyText={msisdn.replace(/^237/, "")}
      />

      <div className="flex flex-col gap-2">
        <CopyField
          label={strings.orderStatus.payAmountLabel}
          value={amountLabel}
          copyText={String(amountXaf)}
        />
        {/* Body / muted — helper text, per § B. Color's rule for that token. */}
        <p className="text-base leading-[1.6] font-normal text-muted-foreground">
          {strings.orderStatus.payAmountHelper}
        </p>
      </div>

      {orangeMerchantCode ? (
        // Tier B's third copyable field, in the same block shape as the number
        // and the amount — the customer types this into the menu, so it has to
        // be as easy to lift as the number is.
        <CopyField
          label={strings.orderStatus.merchantCodeLabel}
          value={orangeMerchantCode}
        />
      ) : null}

      {showDialButton && dial !== null ? (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="min-h-12 w-full gap-2"
            render={<a href={dial.href} />}
          >
            <Phone aria-hidden="true" />
            {strings.orderStatus.dialCta}
          </Button>

          {/* The literal string, so the customer can see what will be dialled
              before they press call — and can type it by hand if they prefer. */}
          <span className="text-sm leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            <span className="font-mono tracking-normal normal-case">
              {dial.display}
            </span>
          </span>

          <p className="text-base leading-[1.6] font-normal text-muted-foreground">
            {strings.orderStatus.dialHelper}
          </p>
        </div>
      ) : null}

      <ol className="flex list-decimal flex-col gap-2 pl-5">
        {steps.map((step) => (
          <li
            key={step}
            className="text-base leading-[1.6] font-normal text-foreground"
          >
            <StepText step={step} code={menuCode} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * One step, with `{code}` replaced by the dial code in `font-mono`.
 *
 * Split rather than interpolated into a string so the code is a real element
 * and can carry the monospace treatment § B5 asks for. A step with no
 * placeholder renders as a single part and costs nothing.
 */
function StepText({ step, code }: { step: string; code: string }) {
  const parts = step.split("{code}");

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? <code className="font-mono">{code}</code> : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}
