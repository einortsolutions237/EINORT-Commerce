import { Clock, ExternalLink, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { strings } from "@/lib/strings";
import type { TrialState } from "@/server/entitlements/resolve";

/**
 * The persistent trial banner (D-11, D-12) and the read-only explanation (D-08).
 *
 * ---------------------------------------------------------------------------
 * IT RECEIVES AN INTEGER. IT NEVER RECEIVES A DATE.
 * ---------------------------------------------------------------------------
 * `daysLeft` is computed on the server by `resolveEntitlements`, which takes
 * `now` as a parameter. No `Date` object, no ISO string and no timestamp
 * crosses into this component, and no `Date` is ever constructed anywhere under
 * `src/app/(dashboard)/`. A countdown derived from the browser's
 * clock is a countdown the merchant can change by changing their system time,
 * and it would also disagree with the server's own `canWrite` decision for
 * anyone whose device clock is simply wrong — which, on the low-end Android
 * this market runs on, is common enough to be a support burden rather than an
 * edge case (T-02-14).
 *
 * ---------------------------------------------------------------------------
 * NOT A LIVE REGION, AND NOT DISMISSIBLE.
 * ---------------------------------------------------------------------------
 * This is persistent page furniture, not an update: announcing it on every
 * navigation would be noise, so it carries no live-region attribute. The thing
 * that DOES get `role="alert"` is the write-refusal message, rendered at the
 * control the merchant used — a different surface with a different job. D-11
 * says persistent, so there is no close control and nothing is remembered in
 * browser storage; a banner the merchant can make disappear is a banner that
 * stops explaining why their dashboard is read-only.
 *
 * The accessible name comes from `aria-labelledby` pointing at the message the
 * banner already renders, rather than from an invented `aria-label`. That keeps
 * the announced name and the visible copy the same string by construction.
 *
 * A Server Component: it has no state, no effects and no handlers, so shipping
 * it as HTML costs the merchant nothing and arrives before any JavaScript does.
 */

export interface TrialBannerProps {
  /** Server-computed. Never 0 while `state` is `"active"` (`Math.ceil`). */
  readonly daysLeft: number;
  readonly state: TrialState;
  /**
   * `isUrgentTrial(ctx)`, resolved by the caller. Passed in rather than derived
   * from `daysLeft <= 2` here so the threshold has exactly one home — the
   * exported `TRIAL_URGENT_DAYS` constant — and the banner cannot drift from
   * the unit test that pins the day-3 / day-2 boundary.
   */
  readonly urgent: boolean;
}

const MESSAGE_ID = "trial-banner-message";

export function TrialBanner({ daysLeft, state, urgent }: TrialBannerProps) {
  // A paying merchant has nothing to count down. Render nothing at all — not an
  // empty container, which would leave a gap above the page content.
  if (state === "subscribed") return null;

  if (state === "expired") {
    return (
      <section aria-labelledby={MESSAGE_ID}>
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle id={MESSAGE_ID} className="text-destructive">
            {strings.trial.expiredHeading}
          </AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            {/*
             * States what is still possible before what is not. D-08 is
             * read-only, not lockout, and the merchant must never be left
             * thinking their data is gone.
             */}
            <span>{strings.trial.expiredBody}</span>
            <a
              href={strings.trial.contactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 font-medium text-destructive underline underline-offset-3"
            >
              {strings.trial.expiredCta}
              <ExternalLink aria-hidden="true" className="size-4" />
              <span className="sr-only">{strings.trial.contactUrlLabel}</span>
            </a>
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  /*
   * Active. Same sentence in both treatments — only the icon and the variant
   * escalate. Changing the words as well would make the final two days read as
   * a different, unrelated message rather than as the same countdown getting
   * short, and D-12 asks for escalating urgency, not a new announcement.
   *
   * The singular is a separate string selected by `=== 1`, not a
   * `day(s)` fallback and not `Intl.PluralRules`: two flat strings are what a
   * later i18n pass can replace with a real plural group.
   */
  const message =
    daysLeft === 1
      ? strings.trial.oneDayLeft
      : strings.trial.daysLeft.replace("{days}", String(daysLeft));

  return (
    <section aria-labelledby={MESSAGE_ID}>
      <Alert
        variant={urgent ? "destructive" : "default"}
        className={urgent ? undefined : "bg-muted text-foreground"}
      >
        {urgent ? (
          <TriangleAlert aria-hidden="true" />
        ) : (
          <Clock aria-hidden="true" />
        )}
        <AlertTitle
          id={MESSAGE_ID}
          className={urgent ? "text-destructive" : undefined}
        >
          {message}
        </AlertTitle>
        <AlertDescription>
          {/* D-06: switching tiers is an active-trial capability, so the link
              is present on both active treatments and on neither expired one. */}
          <a
            href="/dashboard/plan"
            className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-3"
          >
            {strings.trial.changePlan}
          </a>
        </AlertDescription>
      </Alert>
    </section>
  );
}
