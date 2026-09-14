import "server-only";

import { Resend } from "resend";

import { env } from "@/env";
import { strings } from "@/lib/strings";
import { platformDb } from "@/server/db/platform";

/**
 * D-09 — the support thread's email nudge, in both directions. Modeled
 * near-verbatim on `src/server/claims/notify.ts`; read that file's header
 * before changing this one.
 *
 * ---------------------------------------------------------------------------
 * NOTHING IN THIS FILE MAY EVER FAIL A THREAD MESSAGE.
 * ---------------------------------------------------------------------------
 * Both functions below are called from `after()` — `notifyPlatformOfMerchantMessage`
 * from `actions.ts`'s `sendSupportMessage`, `notifyMerchantOfPlatformMessage`
 * from `src/server/admin/support.ts` (plan 06-12) — which means they run once
 * the message row is already committed. Every failure mode here (a missing
 * key, a missing recipient, a bounce, a provider outage) resolves to one
 * `console.warn`/`console.error` and a return. Neither function ever rejects.
 * `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are `.optional()` in `src/env.ts`
 * PRECISELY so a project deployed without email still lets a merchant and the
 * platform owner exchange messages.
 *
 * ---------------------------------------------------------------------------
 * THE IN-APP UNREAD BADGE IS THE RELIABLE CHANNEL (D-11). THIS IS THE NUDGE.
 * ---------------------------------------------------------------------------
 * `unreadForMerchant` (`queries.ts`) and its admin-side counterpart are real
 * counts read on every render, so either party sees the thread whether or not
 * any mail was delivered. There is deliberately no retry, no queue and no
 * delivery-status column — the same posture `claims/notify.ts` takes for the
 * same reason.
 *
 * ---------------------------------------------------------------------------
 * TWO FAILURE CHANNELS. BOTH ARE CHECKED, NOT JUST THE REJECTION.
 * ---------------------------------------------------------------------------
 * `resend.emails.send` rejects on transport failure and separately returns a
 * RESOLVED `{ error }` on an API-level refusal (unverified sending domain,
 * malformed address, a suppressed recipient). Checking only the rejection is
 * the half a reimplementation always misses, and it makes an undelivered
 * notification read as a success in the logs.
 *
 * ---------------------------------------------------------------------------
 * NO MESSAGE BODY AND NO REFERENCE IN THE EMAIL. THAT IS A DECISION.
 * ---------------------------------------------------------------------------
 * `strings.support.email` says only that a message arrived and where to read
 * it — never the body, and never a subscription claim's transaction
 * reference. Same reasoning as `claims/notify.ts`'s "NO REFERENCE AND NO
 * OPERATOR IN THE BODY" paragraph: mail is an unencrypted channel landing in
 * whatever inbox the recipient happens to be signed into.
 *
 * ---------------------------------------------------------------------------
 * NOT EXTRACTED INTO A SHARED `src/server/email/send.ts`. A DELIBERATE CHOICE.
 * ---------------------------------------------------------------------------
 * 06-RESEARCH.md rates a shared-transport extraction MEDIUM confidence
 * because it touches `claims/notify.ts`, a shipped Phase 3 file. This plan's
 * decision is: do not extract. Consolidating the two send paths here would
 * mix a refactor of shipped payment-notification behaviour into a feature
 * plan; Phase 8's design-system migration is the right place to reconsider
 * it, once there are three call sites instead of two.
 */

/** Resolve the store owner's address. Copied verbatim from `claims/notify.ts`. */
async function ownerEmailFor(tenantId: string): Promise<string | null> {
  const owner = await platformDb.member.findFirst({
    where: { organizationId: tenantId, role: "owner" },
    select: { user: { select: { email: true } } },
  });

  const email = owner?.user.email ?? null;
  return email && email.length > 0 ? email : null;
}

/** The store name for the `{store}` placeholder in the platform-direction copy. */
async function storeNameFor(tenantId: string): Promise<string | null> {
  const org = await platformDb.organization.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  return org?.name ?? null;
}

/**
 * Tell the platform owner a merchant wrote in. Best effort, always.
 *
 * The recipient lookup is `platformRole: "admin"`, not a hardcoded address —
 * this platform has exactly one such account (D-04), and finding it by role
 * rather than by a config value means the notice keeps working if that
 * account is ever rotated via `scripts/promote-admin.ts`.
 */
export async function notifyPlatformOfMerchantMessage(
  tenantId: string,
): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn(
      "[support] DEGRADED: no support-message email was sent to the platform " +
        "owner. Missing RESEND_API_KEY and/or RESEND_FROM_EMAIL. The owner's " +
        "in-app unread badge (D-11) is unaffected and remains the reliable " +
        "channel. Acceptable in local development and in tests; in " +
        "production it means the owner is not being nudged.",
    );
    return;
  }

  try {
    const owner = await platformDb.user.findFirst({
      where: { platformRole: "admin" },
      select: { email: true },
    });

    if (!owner || !owner.email) {
      console.warn(
        "[support] no platformRole=\"admin\" account found; the support " +
          "message notification to the platform owner was skipped. The " +
          "message itself is unaffected.",
      );
      return;
    }

    const storeName = (await storeNameFor(tenantId)) ?? "A merchant";
    const copy = strings.support.email.toPlatform;

    const subject = copy.subject.replace("{store}", storeName);
    const body = copy.body.replace("{store}", storeName);

    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: owner.email,
      subject,
      html: `<p>${copy.heading}</p><p>${body}</p>`,
      text: `${copy.heading}\n\n${body}`,
    });

    if (error) {
      console.error(
        "[support] the support-message email to the platform owner was " +
          "refused by the mail provider. The message is committed and the " +
          "in-app unread badge already shows it.",
        error,
      );
    }
  } catch (error) {
    console.error(
      "[support] the support-message email to the platform owner could not " +
        "be sent. The message is committed and the in-app unread badge " +
        "already shows it.",
      error,
    );
  }
}

/**
 * Tell the merchant the platform owner wrote back. Best effort, always.
 *
 * The recipient lookup is `ownerEmailFor`, copied verbatim from
 * `claims/notify.ts` — no new column, resolved at send time through the
 * existing `Member`/`User` join.
 */
export async function notifyMerchantOfPlatformMessage(
  tenantId: string,
): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn(
      "[support] DEGRADED: no support-message email was sent to the " +
        "merchant. Missing RESEND_API_KEY and/or RESEND_FROM_EMAIL. The " +
        "merchant's in-app unread badge (D-11) is unaffected and remains the " +
        "reliable channel. Acceptable in local development and in tests; in " +
        "production it means the merchant is not being nudged.",
    );
    return;
  }

  try {
    const to = await ownerEmailFor(tenantId);
    if (!to) {
      console.warn(
        `[support] no owner address for tenant ${tenantId}; the support ` +
          "message notification to the merchant was skipped. The message " +
          "itself is unaffected.",
      );
      return;
    }

    const copy = strings.support.email.toMerchant;

    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject: copy.subject,
      html: `<p>${copy.heading}</p><p>${copy.body}</p>`,
      text: `${copy.heading}\n\n${copy.body}`,
    });

    if (error) {
      console.error(
        "[support] the support-message email to the merchant was refused " +
          "by the mail provider. The message is committed and the in-app " +
          "unread badge already shows it.",
        error,
      );
    }
  } catch (error) {
    console.error(
      "[support] the support-message email to the merchant could not be " +
        "sent. The message is committed and the in-app unread badge already " +
        "shows it.",
      error,
    );
  }
}
