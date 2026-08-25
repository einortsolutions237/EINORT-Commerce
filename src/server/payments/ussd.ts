import type { PaymentOperator } from "@/server/db/enums";

/**
 * D-15, encoded. The dial strings, and the far more important question of when
 * there is no dial string at all.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE RESEARCH ACTUALLY FOUND.
 * ---------------------------------------------------------------------------
 * Neither MTN Cameroon nor Orange Cameroon publishes a one-shot parametrized
 * PERSON-TO-PERSON send-money code. Both P2P flows are interactive menus that
 * ask for the destination number, then the amount, then the PIN, one screen at
 * a time. That was verified by reading the operators' own account-management
 * and money-transfer pages, not inferred from an empty search result.
 *
 * Third-party blog posts circulate a P2P string of the shape
 * "menu code, option one, number, amount". It was checked against the operator
 * and is NOT corroborated. It must never be shipped: a dial string that looks
 * official and silently does the wrong thing sends a customer's money somewhere
 * nobody can trace, and there is no server-side signal that it happened.
 * `tests/unit/ussd.test.ts` and this plan's acceptance criteria both assert
 * that string appears nowhere in this file.
 *
 * Exactly one fully-parametrized string is published and verified: MTN's
 * MERCHANT payment, which carries the merchant's six-digit MoMoPay code and the
 * invoice amount. Orange publishes only an entry point for its merchant-payment
 * flow — no code parameter, no amount parameter.
 *
 * ---------------------------------------------------------------------------
 * WHY `null` IS THE NORMAL RETURN, AND WHAT IT INSTRUCTS.
 * ---------------------------------------------------------------------------
 * Both parametrizable paths need an operator-issued merchant code, which is a
 * separate commercial registration. The expected majority of merchants on this
 * platform receive money into a PERSONAL wallet identified by a phone number
 * and hold no such code. So `null` is not an error path — it is the common
 * case, and it means: render the manual-copy block alone.
 *
 * Never a disabled or dead button. A dial button that opens the root menu is
 * actively worse than no button, because it hides the number and the amount the
 * customer still has to type by hand. And on iOS the dialler refuses any URI
 * containing `*` or the hash character outright — percent-encoding does not
 * work around it — so the button would simply do nothing at all. The caller
 * decides iOS; this function decides whether a correct string even exists.
 *
 * ---------------------------------------------------------------------------
 * TWO STRINGS, NOT ONE.
 * ---------------------------------------------------------------------------
 * `display` is the label a human reads and can retype. `href` is what the OS
 * acts on, and in it the hash character must be percent-encoded — otherwise the
 * browser treats it as a fragment delimiter and truncates the dial string,
 * silently, on the customer's phone. The two are therefore never equal when a
 * hash is present, and the test asserts that inequality directly because the
 * inequality IS the fix.
 *
 * The merchant code is validated before interpolation, never after (T-03-40):
 * a merchant-controlled string flowing into a URI the OS will act on is the
 * threat this module exists to close.
 */

/** MTN Mobile Money main menu. Verified against the operator. No parameters. */
export const MTN_MENU_CODE = "*126#";

/** Orange Money main menu. Verified against the operator. No parameters. */
export const ORANGE_MENU_CODE = "#150#";

/**
 * Orange's merchant-payment entry point. Verified. It takes NO parameters —
 * the customer types the merchant code and the amount inside the menu — which
 * is precisely why this module refuses to build a deep link for Orange.
 */
export const ORANGE_MERCHANT_CODE_ENTRY = "#150*47#";

/**
 * An operator-issued merchant code: exactly six digits, nothing else.
 *
 * Exported so `savePaymentSettings` refuses at the write with the same rule the
 * builder refuses at the read. One expression, two gates.
 */
export const MERCHANT_CODE_PATTERN = /^\d{6}$/;

/** What the settings row contributes; the rest of the row is irrelevant here. */
export type MerchantCodes = {
  mtnMerchantCode: string | null;
  orangeMerchantCode: string | null;
};

/**
 * Returns the tap-to-dial pair, or `null` when no correct one exists.
 *
 * `amountXaf` must be a positive whole number of francs. A zero, a negative, a
 * fraction, `NaN` or an infinity all return `null` rather than producing a
 * string that would dial a nonsense amount — XAF has no decimal subunit, so a
 * fractional amount is always a bug upstream.
 */
export function buildMerchantUssd(
  operator: PaymentOperator,
  settings: MerchantCodes,
  amountXaf: number,
): { href: string; display: string } | null {
  if (!Number.isInteger(amountXaf) || amountXaf <= 0) return null;

  if (
    operator === "MTN_MOMO" &&
    MERCHANT_CODE_PATTERN.test(settings.mtnMerchantCode ?? "")
  ) {
    const display = `*126*4*${settings.mtnMerchantCode}*${amountXaf}#`;
    return { href: `tel:${display.replace(/#/g, "%23")}`, display };
  }

  return null;
}
