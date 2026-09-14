import type { Metadata } from "next";
import Link from "next/link";

import { Composer } from "@/components/support/composer";
import { MessageList } from "@/components/support/message-list";
import { ScrollToLatest } from "@/components/support/scroll-to-latest";
import { strings } from "@/lib/strings";
import { requireMerchantContext } from "@/server/merchant/context";
import {
  firstUnreadForMerchant,
  threadForMerchant,
} from "@/server/support/queries";
// Imported after `queries` — see this file's header on why
// `firstUnreadForMerchant` must be read before `markThreadReadForMerchant`
// runs; the import order below mirrors the call order it protects.
import { markThreadReadForMerchant } from "@/server/support/messages";

/**
 * `/dashboard/support` — the merchant's side of the thread. ADM-05 / D-07 /
 * D-10..D-13 / SUB-03 (06-UI-SPEC.md § A2).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireMerchantContext()` is called here, not inherited from
 * `(dashboard)/layout.tsx` — the layout is a shell, explicitly not an
 * authorization boundary. Every page under this route group repeats the
 * call for that reason; it is `React.cache()`-memoized, so the repetition
 * costs nothing.
 *
 * ---------------------------------------------------------------------------
 * READ THE FIRST-UNREAD BOUNDARY BEFORE MARKING THE THREAD READ. IN THAT
 * ORDER, ALWAYS.
 * ---------------------------------------------------------------------------
 * `firstUnreadForMerchant` runs (inside the `Promise.all` below) BEFORE
 * `markThreadReadForMerchant` runs, on the line beneath it. Reverse that
 * order — or worse, fold them into one combined step — and every message
 * would already read as read by the time the boundary is computed, so the
 * "New" divider would never render. The rail's unread badge clears by the
 * merchant simply navigating here (06-UI-SPEC.md § A2's "Unread rule");
 * there is no manual control anywhere in this tree for it, so this call is
 * the ONLY place the thread is ever marked read for the merchant.
 */

export const metadata: Metadata = {
  title: strings.support.page.title,
};

export default async function SupportPage() {
  const ctx = await requireMerchantContext();

  const [rows, firstUnreadAt] = await Promise.all([
    threadForMerchant(ctx.tenantId),
    firstUnreadForMerchant(ctx.tenantId),
  ]);

  // MUST run after the two reads above — see this file's header.
  await markThreadReadForMerchant(ctx.tenantId);

  /*
   * SUB-03 entry point (R-3): only when unsubscribed AND the trial has run
   * out. `resolveEntitlements` has no separate "unpaid" state to check —
   * `subscriptionStatus` is either "active" or it is not, so an active
   * trial (not yet subscribed, not yet expired) is deliberately NOT this
   * state: the merchant is not overdue for anything yet. Read straight off
   * the entitlements the merchant context already carries; this is not a
   * second query.
   */
  const showSubscriptionPrompt = ctx.trial.state === "expired";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.support.page.heading}
        </h1>
        <p className="text-base leading-normal font-normal text-muted-foreground">
          {strings.support.page.subline}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <h2 className="text-lg leading-snug font-semibold text-foreground">
            {strings.support.page.emptyHeading}
          </h2>
          <p className="max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {strings.support.page.emptyBody}
          </p>
        </div>
      ) : (
        <MessageList
          rows={rows}
          viewer="MERCHANT"
          authorOtherLabel={strings.support.thread.authorOther}
          firstUnreadAt={firstUnreadAt}
        />
      )}

      {showSubscriptionPrompt ? (
        <p className="text-base leading-normal font-normal text-foreground">
          {strings.support.page.subscriptionPrompt}
          <Link
            href="/dashboard/plan"
            className="underline underline-offset-3"
          >
            {strings.support.page.subscriptionLink}
          </Link>
        </p>
      ) : null}

      <Composer />

      <ScrollToLatest />
    </div>
  );
}
