import "server-only";

import { Resend } from "resend";

import { env } from "@/env";
import { strings } from "@/lib/strings";
import { platformDb } from "@/server/db/platform";
import { formatXaf } from "@/server/payments/whatsapp";

/**
 * D-13 — the merchant's nudge. It is allowed to fail, and it is designed to.
 *
 * ---------------------------------------------------------------------------
 * NOTHING IN THIS FILE MAY EVER FAIL A CUSTOMER'S CLAIM.
 * ---------------------------------------------------------------------------
 * This function is called from `after()` in `src/server/claims/submit.ts`,
 * which means it runs once the claim row is already committed and the customer
 * already has their answer. But `after()` is not a licence to be careless: an
 * unhandled rejection inside it is still an error in the platform's logs and
 * still costs a serverless invocation its clean exit. So every failure mode in
 * this file — a missing key, a missing owner, an address that bounces, an
 * outage at the provider — resolves to one `console.warn` or `console.error`
 * and a return. That is not defensive style; it is the requirement. The keys
 * are `.optional()` in `src/env.ts` PRECISELY so that a project deployed
 * without email still takes payment claims (T-03-80).
 *
 * ---------------------------------------------------------------------------
 * THE IN-APP GOLD BADGE IS THE RELIABLE CHANNEL. THIS IS THE NUDGE.
 * ---------------------------------------------------------------------------
 * 03-04's sidebar badge is driven by a real count read on every dashboard
 * render, so a merchant who opens their dashboard always sees the queue whether
 * or not any mail was delivered. Treating this send as the notification — for
 * instance by retrying it, or by recording delivery state against the claim —
 * would build a second, weaker source of truth beside a stronger one that
 * already exists. There is deliberately no retry, no queue and no status
 * column.
 *
 * ---------------------------------------------------------------------------
 * TWO FAILURE CHANNELS, AND THE SDK USES BOTH.
 * ---------------------------------------------------------------------------
 * `resend.emails.send` reports transport problems by rejecting AND reports
 * API-level refusals — an unverified sending domain, a malformed address, a
 * suppressed recipient — in the RESOLVED result's `error` field. Checking only
 * one of the two is the mistake that makes a silently undelivered notification
 * look like a success in the logs, so both are checked below.
 *
 * ---------------------------------------------------------------------------
 * NO REFERENCE AND NO OPERATOR IN THE BODY. THAT IS A DECISION.
 * ---------------------------------------------------------------------------
 * The authored copy in `strings.claims.email` names the customer, the amount
 * and the order number, and then sends the merchant to the queue. It quotes no
 * transaction reference, because email is an unencrypted channel that lands in
 * whatever inbox the merchant happens to be signed into, and the reference is
 * the one field the merchant must read from THEIR OWN operator receipt and
 * compare — not from a message the platform relayed. Putting it here would
 * both leak a payment detail into mail and invite the merchant to "verify" a
 * claim by comparing the platform's copy of a number against the platform's
 * copy of the same number.
 *
 * ---------------------------------------------------------------------------
 * THE ADDRESS IS RESOLVED AT SEND TIME, AND NO COLUMN WAS ADDED FOR IT.
 * ---------------------------------------------------------------------------
 * `Member` joins the organization to the `User` that owns it, and `User.email`
 * is where a merchant already receives mail from this platform. A
 * `notificationEmail` column on the tenant would be a second address to keep in
 * agreement with the first, and the failure it produces is silent: mail going
 * to an address the merchant stopped reading a year ago.
 * `Organization` and `Member` carry no `tenantId` — they ARE the tenant
 * registry — so this read goes through `platformDb`, which is the sanctioned
 * facade for exactly that category.
 */

export interface ClaimNotification {
  /** The organization id. Used only to find who to write to. */
  readonly tenantId: string;
  /** The human-facing order number, never an internal id. */
  readonly orderNumber: string;
  /** The SERVER's order total, formatted for display by this module. */
  readonly amountXaf: number;
  /** The name the customer gave at checkout. */
  readonly customerName: string;
}

/** Resolve the store owner's address, or `null` when there is nobody to write to. */
async function ownerEmailFor(tenantId: string): Promise<string | null> {
  const owner = await platformDb.member.findFirst({
    where: { organizationId: tenantId, role: "owner" },
    select: { user: { select: { email: true } } },
  });

  const email = owner?.user.email ?? null;
  return email && email.length > 0 ? email : null;
}

/**
 * Tell the merchant a claim is waiting. Best effort, always.
 *
 * Never rejects and never propagates a failure to its caller — see the header.
 */
export async function notifyMerchantOfClaim(
  notification: ClaimNotification,
): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn(
      "[claims] DEGRADED: no payment-claim email was sent. Missing " +
        "RESEND_API_KEY and/or RESEND_FROM_EMAIL. The merchant's in-app claims " +
        "badge is unaffected and remains the reliable channel (D-13). " +
        "Acceptable in local development and in tests; in production it means " +
        "merchants are not being nudged.",
    );
    return;
  }

  try {
    const to = await ownerEmailFor(notification.tenantId);
    if (!to) {
      console.warn(
        `[claims] no owner address for tenant ${notification.tenantId}; the ` +
          "claim notification was skipped. The claim itself is unaffected.",
      );
      return;
    }

    const amount = formatXaf(notification.amountXaf);
    const copy = strings.claims.email;

    const subject = copy.subject.replace("{order}", notification.orderNumber);
    const body = copy.body
      .replace("{customer}", notification.customerName)
      .replace("{amount}", amount)
      .replace("{order}", notification.orderNumber);

    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject,
      // Plain, single-column and link-free. A notification that survives every
      // mail client is worth more here than one that looks designed in two of
      // them, and the merchant's next step is their own dashboard, not a link
      // in an email they may not have been expecting.
      html: `<p>${copy.heading}</p><p>${body}</p>`,
      text: `${copy.heading}\n\n${body}`,
    });

    // The RESOLVED failure channel. See the header — checking only the
    // rejection would let an unverified sending domain read as a success.
    if (error) {
      console.error(
        `[claims] the payment-claim email for order ${notification.orderNumber} ` +
          "was refused by the mail provider. The claim is committed and the " +
          "in-app badge already shows it.",
        error,
      );
    }
  } catch (error) {
    console.error(
      `[claims] the payment-claim email for order ${notification.orderNumber} ` +
        "could not be sent. The claim is committed and the in-app badge " +
        "already shows it.",
      error,
    );
  }
}
