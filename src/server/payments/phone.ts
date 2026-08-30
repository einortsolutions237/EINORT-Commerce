import type { PaymentOperator } from "@/server/db/enums";

/**
 * Cameroon mobile-number normalization and the ADVISORY operator hint.
 *
 * ---------------------------------------------------------------------------
 * PURE ON PURPOSE.
 * ---------------------------------------------------------------------------
 * No database client, no environment read, and none of the markers that would
 * make this module server-exclusive. It sits at two boundaries — the write side of `savePaymentSettings` and the read
 * side of the deep-link builders — and it is the one place a merchant-typed
 * string is turned into the single canonical storage form. Keeping it free of
 * I/O is what lets `tests/unit/phone.test.ts` pin that behaviour in
 * milliseconds instead of asserting it indirectly through a form.
 *
 * The `PaymentOperator` import is TYPE-ONLY and erases at compile time, so
 * nothing generated is pulled in at runtime.
 *
 * ---------------------------------------------------------------------------
 * THE STORAGE FORM IS `2376XXXXXXXX`, AND IT IS NOT AN ARBITRARY CHOICE.
 * ---------------------------------------------------------------------------
 * WhatsApp's click-to-chat format takes a full international number with no
 * `+`, no leading zero, no brackets and no separators. Storing exactly that
 * means `buildWhatsAppOrderLink` can assert the shape and refuse anything else
 * instead of re-cleaning a value at every call site — which is how a
 * half-cleaned number eventually reaches a customer's phone as a dead link.
 */

/**
 * A Cameroon mobile number in national form: nine digits beginning with `6`.
 *
 * Exported so the settings form, the schema and the tests all validate against
 * the same expression rather than three copies that drift.
 */
export const CM_MOBILE_PATTERN = /^6\d{8}$/;

/**
 * Accepts `+237 6XX XX XX XX`, `237-6XXXXXXXX`, `6XX.XX.XX.XX` and the bare
 * nine digits; returns `2376XXXXXXXX`, or `null`.
 *
 * TOTAL BY CONTRACT: it never throws, for any input, including letters, emoji
 * and pasted SQL. It is called on a raw form field, so a throw here would turn
 * an ordinary typo into a 500 on a merchant's save.
 *
 * `null` means "this is not a Cameroon mobile number", and the caller decides
 * whether that is a field error (a non-blank field the merchant meant to fill)
 * or a clear (a blank field). This function does not know the difference and
 * must not guess.
 */
export function normalizeCameroonMsisdn(raw: string): string | null {
  if (typeof raw !== "string") return null;

  // Strip every separator a merchant might type — spaces, dots, dashes,
  // brackets, a leading plus — then drop the country code if it is present.
  // `replace(/^237/, "")` is deliberately anchored: a number whose national
  // part happens to start with 237 is impossible here, because every Cameroon
  // mobile number starts with 6.
  const digits = raw.replace(/\D/g, "").replace(/^237/, "");

  return CM_MOBILE_PATTERN.test(digits) ? `237${digits}` : null;
}

/**
 * Renders a stored `2376XXXXXXXX` back as `+237 6XX XX XX XX`.
 *
 * For the settings form and the payment-instructions block: a merchant reading
 * back the number money will arrive at should see it grouped the way they say
 * it out loud, not as a twelve-digit run they have to count through.
 *
 * Returns the input unchanged rather than throwing when the value is not in the
 * storage form. This is a display helper; a malformed value should render
 * visibly wrong, not take the page down.
 */
export function formatMsisdnForDisplay(msisdn: string): string {
  if (typeof msisdn !== "string" || !/^237[0-9]{9}$/.test(msisdn)) {
    return msisdn;
  }

  const national = msisdn.slice(3);
  return `+237 ${national.slice(0, 3)} ${national.slice(3, 5)} ${national.slice(
    5,
    7,
  )} ${national.slice(7, 9)}`;
}

/**
 * The number-block table, as a hint and never as a rule.
 *
 * ---------------------------------------------------------------------------
 * CAMEROON HAS MOBILE NUMBER PORTABILITY.
 * ---------------------------------------------------------------------------
 * A prefix therefore indicates the ORIGINAL allocation and NOT the current
 * network. A merchant who ported an MTN-block number to Orange has an entirely
 * ordinary number that this table will label wrongly, and there are more of
 * them every year.
 *
 * That is why this function exists only to power a soft inline warning, and why
 * it must NEVER be used to reject a number. Hard-rejecting on a prefix mismatch
 * would lock out exactly the population portability created, and D-17 already
 * settled the trust question: the merchant is trusted about their own receiving
 * number, there is no verification step, and a wrong number is self-correcting
 * because the merchant simply does not get paid.
 *
 * The block allocations themselves are MEDIUM confidence — widely reported,
 * not read from an ART primary source — which is a second, independent reason
 * this answer may only ever be advisory.
 *
 * Accepts either the stored form or the national form, so a client island can
 * call it on what the merchant is typing without normalizing first.
 */
export function likelyOperatorFor(msisdn: string): PaymentOperator | null {
  const normalized = normalizeCameroonMsisdn(msisdn);
  if (!normalized) return null;

  const prefix = normalized.slice(3, 6);
  const second = prefix.charAt(1);

  // 67X and 68X — MTN.
  if (second === "7" || second === "8") return "MTN_MOMO";
  // 69X — Orange.
  if (second === "9") return "ORANGE_MONEY";

  // 650–654 MTN, 655–659 Orange. 66X is Camtel/Nexttel and has no mobile-money
  // wallet on this platform, so it is neither.
  if (second === "5") {
    return Number(prefix.charAt(2)) <= 4 ? "MTN_MOMO" : "ORANGE_MONEY";
  }

  return null;
}
