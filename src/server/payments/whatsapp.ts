import { strings } from "@/lib/strings";

/**
 * CHK-02 / D-01 — the click-to-chat handoff, as a pure function.
 *
 * ---------------------------------------------------------------------------
 * THE NUMBER SEGMENT IS THE WHOLE RISK SURFACE.
 * ---------------------------------------------------------------------------
 * The official click-to-chat format takes a full international number with no
 * `+`, no leading zero, no brackets and no separators. A number that fails that
 * shape does not produce an error — it produces a link that opens a dead end on
 * the customer's device, with nothing logged anywhere on the server. That is
 * why `buildWhatsAppOrderLink` THROWS on a malformed number (T-03-41) instead
 * of returning a best-effort string: a loud failure during development is the
 * only failure mode this link has that anyone will ever see.
 *
 * `normalizeCameroonMsisdn` produces exactly the accepted form, and
 * `savePaymentSettings` runs it on every write, so in practice the assertion
 * below never fires. It exists because "in practice" is not a guarantee.
 *
 * ---------------------------------------------------------------------------
 * MESSAGE SHAPE.
 * ---------------------------------------------------------------------------
 * Some clients truncate a long `text` value, so the tracking URL goes on the
 * SECOND line — before the item lines, which are the expendable part. Per D-12
 * that link is the customer's only way back to their order, and per D-01 the
 * `Order` row and its tracking token exist before this message is ever built.
 *
 * Pure: no I/O and no database import. `@/lib/strings` is a plain object
 * literal with no imports of its own, so reading copy from it (C-14) costs
 * nothing at unit-test time and keeps the fixed words out of this file.
 */

/** The exact shape click-to-chat accepts for Cameroon: `237` + nine digits. */
const WA_MSISDN_PATTERN = /^237[0-9]{9}$/;

/**
 * XAF, formatted the way the rest of V1 formats it.
 *
 * `Intl` directly rather than a currency library (CLAUDE.md): V1 is
 * single-currency, and XAF has no decimal subunit in common usage, so the whole
 * problem is one formatter call.
 */
export function formatXaf(amountXaf: number): string {
  return new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(amountXaf);
}

export type OrderMessageLine = {
  quantity: number;
  name: string;
  amountXaf: number;
};

export type OrderMessageArgs = {
  storeName: string;
  orderNumber: string;
  trackingUrl: string;
  lines: readonly OrderMessageLine[];
  totalXaf: number;
};

/**
 * The D-01 pre-filled cart message.
 *
 * Store name and order number first so the merchant knows what they are looking
 * at from the notification preview alone; the tracking URL immediately after;
 * then the items; then the total, always last and always on its own line.
 */
export function buildOrderMessage({
  storeName,
  orderNumber,
  trackingUrl,
  lines,
  totalXaf,
}: OrderMessageArgs): string {
  const heading = strings.orderStatus.orderNumberEyebrow.replace(
    "{orderNumber}",
    orderNumber,
  );

  return [
    `${storeName} — ${heading}`,
    trackingUrl,
    ...lines.map(
      (line) =>
        `${line.quantity} x ${line.name} — ${formatXaf(line.amountXaf)}`,
    ),
    `${strings.cart.total}: ${formatXaf(totalXaf)}`,
  ].join("\n");
}

/**
 * The click-to-chat URL: the wa.me host, the bare MSISDN, and the message
 * body as a URL-encoded `text` parameter.
 *
 * @throws when `merchantMsisdn` is not already in the normalized storage form.
 */
export function buildWhatsAppOrderLink(
  merchantMsisdn: string,
  message: string,
): string {
  if (
    typeof merchantMsisdn !== "string" ||
    !WA_MSISDN_PATTERN.test(merchantMsisdn)
  ) {
    throw new Error(
      "buildWhatsAppOrderLink: expected a normalized Cameroon MSISDN " +
        "(237 followed by nine digits). Run normalizeCameroonMsisdn first.",
    );
  }

  return `https://wa.me/${merchantMsisdn}?text=${encodeURIComponent(message)}`;
}

/**
 * The storefront contact band's click-to-chat URL (TMPL-01, plan 04-10).
 *
 * The same host and the same number segment as the order link above, with NO
 * `text` parameter: this link opens an empty conversation because the shopper
 * has not ordered anything yet and pre-filling a message they did not write is
 * a sentence they then have to delete.
 *
 * IT RETURNS `null` INSTEAD OF THROWING, and that is the one deliberate
 * difference from `buildWhatsAppOrderLink`. The order link is built at the end
 * of a checkout the merchant has already been gated through, so a malformed
 * number there is a bug that must be loud. This one is built on the anonymous
 * public render path for a merchant who may simply never have opened the
 * payment settings page — a store with no number is the ordinary case, not an
 * error, and `null` is what `ContactSection` reads to render a shorter section
 * with no CTA rather than a dead one. A `throw` here would take a live
 * storefront down over an unconfigured field.
 *
 * The pattern check still runs, so a number that somehow escaped
 * `normalizeCameroonMsisdn` produces no link rather than a link to a dead end.
 */
export function buildWhatsAppContactLink(
  merchantMsisdn: string | null,
): string | null {
  if (
    typeof merchantMsisdn !== "string" ||
    !WA_MSISDN_PATTERN.test(merchantMsisdn)
  ) {
    return null;
  }

  return `https://wa.me/${merchantMsisdn}`;
}
