import type { Metadata } from "next";
import { Check, ExternalLink } from "lucide-react";
import Link from "next/link";

import { SubscriptionClaimCard } from "@/components/subscription-claim-card";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { platformDb } from "@/server/db/platform";
import { PLAN_TIERS, PLANS } from "@/server/entitlements/plans";
import { publicUrlFor } from "@/server/images/r2";
import { requireMerchantContext } from "@/server/merchant/context";
import { latestSubscriptionClaimFor } from "@/server/subscription/claims";

import { PlanSwitchForm, type PlanSwitchCard } from "./plan-switch-form";
import { SubmitPaymentDialog } from "./submit-payment-dialog";

/**
 * `/dashboard/plan` (D-06) — the in-trial plan switcher, and the expired-trial
 * terminal state OQ-3 resolves as no in-app switch path.
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireMerchantContext()` is not inherited from `(dashboard)/layout.tsx` —
 * see that file's own comment for why a Next 16 layout cannot be the gate.
 * Every page under `(dashboard)/` calls the DAL itself; `React.cache()` makes
 * the repeat call free.
 *
 * ---------------------------------------------------------------------------
 * A FUNCTIONAL POST-EXPIRY SWITCHER IS A CONTRACT VIOLATION.
 * ---------------------------------------------------------------------------
 * CONTEXT.md's addendum resolves OQ-3 as **no**: an expired-trial merchant has
 * no in-app plan-switch path. This route therefore branches on
 * `ctx.trial.state` and renders the expired terminal state — heading, body,
 * the WhatsApp contact link — instead of `<PlanSwitchForm />` when expired.
 * The write itself is additionally refused server-side by `switchPlan`'s
 * `merchantAction({ mode: "write" })`, so this branch is a UX courtesy, never
 * the control. As of quick task `260831-vd2` that same branch also *shows* the
 * three tiers read-only beneath the contact link — information the merchant
 * needs to have the contact conversation, still with nothing to click.
 */

export const metadata: Metadata = {
  // Renders as "Your plan · EINORT" through the root layout's template.
  title: strings.plan.dashboard.title,
};

/**
 * Copy language is English; the number formatting below is independent of that
 * and deliberate on its own terms. It matches `/onboarding/plan`'s formatter
 * exactly — construction and suffix — so a price never reads differently
 * between the two plan surfaces. Change one and you must change the other.
 *
 * ---------------------------------------------------------------------------
 * THIS IS NOT THE CURRENCY FORMATTER CLAUDE.md DOCUMENTS. DO NOT "FIX" IT BACK.
 * ---------------------------------------------------------------------------
 * The rest of this codebase formats money with the locale-driven currency
 * formatter CLAUDE.md prescribes, which renders `5 000 FCFA`. Quick task
 * `260831-urm` asked for `5,000 XAF` — comma-grouped thousands, the literal
 * currency code trailing — on the subscription-plan price display specifically.
 * No standard locale produces that shape through a currency-style formatter:
 * English locales put the code in front (`XAF 5,000`), and every locale that
 * trails it groups with spaces or dots (`5 000 XAF`, `5.000 XAF`). So this is a
 * plain decimal formatter and the code is appended as a literal at the call
 * site. The deviation is scoped to the two plan surfaces and nothing else —
 * product, cart, checkout, order and WhatsApp prices are untouched.
 *
 * `maximumFractionDigits: 0` is required rather than cosmetic — the currency
 * has no decimal subunit in common use.
 */
const priceFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export default async function DashboardPlanPage() {
  const ctx = await requireMerchantContext();

  /**
   * The three tiers, resolved ONCE above the expired-trial split because both
   * branches render them. A tier's name and its price can therefore never
   * diverge between the in-trial switcher and the expired-trial read-only
   * display — one array, one source of tier data, one price formatter
   * (quick task `260831-vd2`).
   *
   * Pure, synchronous, three iterations, so hoisting it costs the expired
   * branch nothing measurable. The `await` member count deliberately stays
   * BELOW the branch: a read-only display enforces no limits and must not pay
   * for a database round trip it has no use for.
   */
  const planTiers = PLAN_TIERS.map((tier) => ({
    tier,
    name: strings.plan[tier].name,
    price: `${priceFormatter.format(PLANS[tier].monthlyPriceXaf)} XAF`,
  }));

  /**
   * SUB-03 (plan 06-15) — resolved once, above the branch, for the same
   * reason `planTiers` is: both the in-trial switcher and the expired-trial
   * read-only display render the current plan's payment CTA/claim card, and
   * a single read here is what keeps the two branches from ever disagreeing
   * about which claim is the merchant's latest.
   *
   * `receiptUrl` is resolved server-side (`publicUrlFor` is `server-only`
   * and cannot be called from `submit-payment-dialog.tsx`'s client island) —
   * `full.webp` is the `thread`/`subscriptions` preset's one derivative
   * label, the same suffix `src/components/support/message-list.tsx`
   * appends for a support-thread attachment.
   */
  const latestClaim = await latestSubscriptionClaimFor(ctx.tenantId);
  const receiptUrl =
    latestClaim?.receiptKey != null
      ? publicUrlFor(`${latestClaim.receiptKey}/full.webp`)
      : null;

  /**
   * The one region this plan adds to the current plan's card. A `PENDING`
   * claim replaces the submit trigger with the read-only card plus the
   * Support link (§ A3's "Blocked resubmit" row) — never a disabled button,
   * which would explain nothing. A `REJECTED` claim shows the card AND a
   * resubmit trigger, pre-selecting the rejected claim's own operator. Any
   * other state (no claim yet, or the latest claim is already `CONFIRMED` —
   * a merchant pays again next month) renders the plain trigger.
   */
  const paymentSection = (
    <div className="flex flex-col gap-3">
      {latestClaim !== null &&
      (latestClaim.status === "PENDING" ||
        latestClaim.status === "REJECTED") ? (
        <SubscriptionClaimCard
          status={latestClaim.status}
          operator={latestClaim.operator}
          reference={latestClaim.reference}
          amountXaf={latestClaim.amountXaf}
          rejectionReason={latestClaim.rejectionReason}
          submittedAt={latestClaim.submittedAt}
          coversThrough={latestClaim.coversThrough}
          receiptUrl={receiptUrl}
        />
      ) : null}

      {latestClaim?.status === "PENDING" ? (
        <Link
          href="/dashboard/support"
          className="w-fit text-sm leading-normal font-medium text-foreground underline underline-offset-3"
        >
          {strings.plan.subscriptionClaim.awaitingLink}
        </Link>
      ) : (
        <SubmitPaymentDialog
          planTier={ctx.plan.tier}
          amountXaf={PLANS[ctx.plan.tier].monthlyPriceXaf}
          resubmit={latestClaim?.status === "REJECTED"}
          defaultOperator={
            latestClaim?.status === "REJECTED" ? latestClaim.operator : null
          }
        />
      )}
    </div>
  );

  if (ctx.trial.state === "expired") {
    return (
      /* The page owns its column now — see the return below. */
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-4">
          <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
            {strings.plan.dashboard.expiredHeading}
          </h1>
          <p className="text-base leading-normal font-normal text-muted-foreground">
            {strings.plan.dashboard.expiredBody}
          </p>
          <a
            href={strings.trial.contactUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-fit items-center gap-1.5 text-base leading-normal font-medium text-foreground underline underline-offset-3"
          >
            {strings.plan.dashboard.expiredCta}
            <ExternalLink aria-hidden="true" className="size-4" />
            <span className="sr-only">{strings.trial.contactUrlLabel}</span>
          </a>
        </div>

        {/**
         * -------------------------------------------------------------------
         * THIS GRID IS READ-ONLY ON PURPOSE. DO NOT WIRE A SWITCHER INTO IT.
         * -------------------------------------------------------------------
         * `02-CONTEXT.md` § Addendum resolves OQ-3 verbatim as: *"No. D-06's
         * plan-switch capability applies only during an active trial. Once
         * expired, the only self-service action is the D-10 'contact us'
         * placeholder — there is no in-app plan-switch path out of read-only
         * in this phase, consistent with the real subscribe flow being
         * deferred."* Quick task `260831-vd2` added the display with no
         * switcher wired into it, and none is added here either: no tier
         * card in this grid ever grows a `Switch to {plan}` button, expired
         * or not.
         *
         * `260831-vd2` also left a note that a subscription-payment redirect
         * was deferred to Phase 6, "which owns the platform receiving number
         * and the subscription-claim flow." This IS that plan (06-15):
         * `paymentSection` below renders in the CURRENT tier's card only —
         * SUB-03's `Submit payment` CTA, or the read-only claim card while
         * one is awaiting review or was rejected. That CTA pays the account
         * back into subscribed standing; it is deliberately not a plan
         * SWITCH, which stays exactly as unreachable post-expiry as the
         * paragraph above still requires.
         *
         * And the display is a courtesy, never the control: `switchPlan`'s
         * `merchantAction({ mode: "write" })` refuses the write server-side
         * for an expired trial regardless of what this page renders, and
         * `submitSubscriptionPayment`'s own `mode: "read"` is exactly why the
         * payment CTA keeps working here where a `"write"` gate would not
         * (see that action's header).
         *
         * No `strings.plan.dashboard.heading` sub-heading sits above this grid,
         * and that omission is deliberate. The expired heading already anchors
         * the page; a second, weaker heading stacked directly beneath it reads
         * oddly. Vertical spacing does the separating instead.
         */}
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          {planTiers.map((entry) => {
            const isCurrent = entry.tier === ctx.plan.tier;

            return (
              <div
                key={entry.tier}
                className={cn(
                  "flex flex-col gap-4 rounded-lg border border-border bg-muted p-6",
                  isCurrent && "ring-2 ring-primary",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-heading text-lg leading-snug font-semibold text-foreground">
                    {entry.name}
                  </h2>

                  {isCurrent ? (
                    <>
                      <Check aria-hidden="true" className="size-5 text-primary" />
                      {/* Colour is never the only signal (WCAG 1.4.1). */}
                      <span className="sr-only">
                        {strings.plan.selectedLabel}
                      </span>
                    </>
                  ) : null}
                </div>

                <p className="flex flex-wrap items-baseline gap-1">
                  <span className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
                    {entry.price}
                  </span>
                  <span className="text-base leading-normal text-muted-foreground">
                    {strings.plan.priceSuffix}
                  </span>
                </p>

                {isCurrent ? paymentSection : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /**
   * Prices are already formatted on the server, above the branch, in
   * `planTiers` (T-02-08 / T-02-28), matching `/onboarding/plan`'s convention:
   * only `tier` ever crosses into the client, never a number to compute a
   * price with. `memberLimit` is resolved here and travels the same way — it
   * drives the client-side inline confirm copy, but the server-side refusal in
   * `switchPlan` is the actual control regardless of what this number says.
   *
   * Only the switcher needs a seat count, which is why this query lives below
   * the expired-trial branch rather than beside the shared tier data.
   */
  const memberCount = await platformDb.member.count({
    where: { organizationId: ctx.tenantId },
  });

  const cards: PlanSwitchCard[] = planTiers.map((entry) => ({
    ...entry,
    memberLimit: PLANS[entry.tier].limits.members,
  }));

  /**
   * The same `{days}` token and the same singular/plural pair
   * `trial-banner.tsx` uses (`strings.trial.oneDayLeft` has no counterpart in
   * `strings.plan.dashboard`), so the two surfaces never disagree about how a
   * single day left reads.
   */
  const trialLine =
    ctx.trial.daysLeft === 1
      ? strings.trial.oneDayLeft
      : strings.plan.dashboard.trialDaysLeft.replace(
          "{days}",
          String(ctx.trial.daysLeft),
        );

  return (
    /*
     * The content column is the PAGE's, not the layout's, since Phase 3 moved
     * this page inside the sidebar shell. `max-w-3xl` is the form/settings
     * width from 03-UI-SPEC.md § Spacing Scale and is the same column this page
     * read at in Phase 2 — only its owner changed.
     */
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.plan.dashboard.heading}
        </h1>
        <p className="text-base leading-normal font-normal text-muted-foreground">
          {strings.plan.dashboard.currentPlan.replace(
            "{plan}",
            strings.plan[ctx.plan.tier].name,
          )}
        </p>
        <p className="text-sm leading-normal font-medium text-muted-foreground">
          {trialLine}
        </p>
      </div>

      <PlanSwitchForm
        currentTier={ctx.plan.tier}
        memberCount={memberCount}
        cards={cards}
        currentPlanExtra={paymentSection}
      />
    </div>
  );
}
