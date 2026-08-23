"use client";

import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { storeOrigin } from "@/app/signup/store-address-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { selectPlan } from "@/server/merchant/actions";
import type { PlanTier } from "@/server/entitlements/plans";

/**
 * The plan-selection island (SUB-01, D-04, D-05).
 *
 * Semantics are native on purpose: a `<fieldset>` with a visually hidden
 * `<legend>` wrapping one real radio input per tier — three of them, from the
 * three-entry `PLAN_TIERS` registry — each hidden inside a `<label>` that IS
 * the card. That buys arrow-key roving focus, `aria-checked` and correct form
 * semantics for free, which is why no component library radio group is
 * installed for this (02-UI-SPEC.md § Interaction, C-15: shadcn's `form` ships
 * empty under the Base UI registry).
 *
 * The inputs are rendered by mapping the server-supplied `plans` array rather
 * than written out three times. The count therefore follows the registry: a
 * fourth tier added to `PLAN_TIERS` produces a fourth card automatically
 * instead of silently rendering three, which is the same drift discipline
 * `PLANS` itself applies.
 *
 * Nothing here is pre-checked. D-04 pre-HIGHLIGHTS Business with the
 * `Most Popular` badge; D-05 makes the pick MANDATORY, and those are different
 * things. A pre-checked card would let a merchant be assigned the middle tier
 * by inertia, so the CTA stays disabled until the merchant actually chooses.
 * There is deliberately no skip control — the pick is not optional, and the
 * server-side gate that enforces that (plan 02-03) is the real control; the
 * absence of a button is only the UI agreeing with it.
 *
 * PRICES ARRIVE FORMATTED, FROM THE SERVER (T-02-08). This component receives
 * strings and never a number, so there is no arithmetic here to get wrong and
 * no way for a client-computed figure to reach the screen.
 *
 * React Compiler rules that bit plan 01-07 and are honoured here: state is
 * derived rather than synced in an effect, and the cross-origin hop is
 * `window.location.assign(...)` rather than an assignment to
 * `window.location.href`.
 */

export interface PlanCard {
  readonly tier: PlanTier;
  readonly name: string;
  readonly tagline: string;
  /** `Everything in Starter, plus` — absent on the entry tier. */
  readonly featuresHeader: string | null;
  readonly features: readonly string[];
  /** Already run through `Intl.NumberFormat` on the server. */
  readonly price: string;
  readonly recommended: boolean;
}

export function PlanPicker({ plans }: { plans: readonly PlanCard[] }) {
  const [selected, setSelected] = useState<PlanTier | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Derived, not synced: `redirecting` holds the button in its pending state
  // across the hand-off so it cannot flash back while the browser is leaving.
  const busy = submitting || redirecting;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selected === null) {
      // The CTA is disabled until a tier is checked, so this is the belt to
      // that braces — a submit that arrives any other way still gets an answer.
      setFormError(strings.plan.noSelection);
      return;
    }

    setFormError(null);
    setSubmitting(true);

    /**
     * The tier is the ONLY thing sent. The organization is read from the
     * session server-side — there is deliberately no organization id in this
     * payload for an attacker to substitute (T-02-06).
     */
    const result = await selectPlan({ tier: selected });

    if (result.ok) {
      // The storefront is a different origin, so this stays a full navigation.
      setRedirecting(true);
      window.location.assign(storeOrigin(result.slug));
      return;
    }

    setSubmitting(false);
    setFormError(
      result.error.tier?.[0] ??
        result.error.form?.[0] ??
        strings.plan.genericError,
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-8">
      <fieldset className="min-w-0">
        <legend className="sr-only">{strings.plan.heading}</legend>

        {/*
         * One column below lg, three equal columns from lg, equal height in
         * the row. Order is ascending price at every breakpoint — Business is
         * NOT re-centered on mobile, because comparability by price beats
         * visual centering (02-UI-SPEC.md § Layout).
         */}
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isSelected = selected === plan.tier;

            return (
              <label
                key={plan.tier}
                className={cn(
                  // The whole card is the label, therefore the whole card is
                  // the tap target — comfortably past the 44px floor.
                  "relative flex min-h-11 cursor-pointer flex-col gap-4 rounded-lg border border-border bg-muted p-6",
                  // The focus ring renders on the CARD, never on the hidden
                  // radio, or a keyboard user sees nothing at all.
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                  // Selected treatment: a 2px primary ring. The fill never
                  // changes — no value shift on a monochrome palette.
                  isSelected && "ring-2 ring-primary",
                )}
              >
                <input
                  type="radio"
                  name="tier"
                  value={plan.tier}
                  checked={isSelected}
                  onChange={() => setSelected(plan.tier)}
                  disabled={busy}
                  className="sr-only"
                />

                <div className="flex items-start justify-between gap-2">
                  {/* Heading role, one step down: 18px / 600 */}
                  <h2 className="font-heading text-lg leading-snug font-semibold text-foreground">
                    {plan.name}
                  </h2>

                  <div className="flex shrink-0 items-center gap-2">
                    {plan.recommended ? (
                      <Badge variant="secondary">
                        {strings.plan.recommendedBadge}
                      </Badge>
                    ) : null}
                    {isSelected ? (
                      <>
                        <Check
                          aria-hidden="true"
                          className="size-5 text-primary"
                        />
                        {/* Colour is never the only signal (WCAG 1.4.1). */}
                        <span className="sr-only">
                          {strings.plan.selectedLabel}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>

                <p className="text-base leading-normal text-muted-foreground">
                  {plan.tagline}
                </p>

                <p className="flex flex-wrap items-baseline gap-1">
                  <span className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-base leading-normal text-muted-foreground">
                    {strings.plan.priceSuffix}
                  </span>
                </p>

                {plan.featuresHeader === null ? null : (
                  <p className="text-sm leading-snug font-semibold text-foreground">
                    {plan.featuresHeader}
                  </p>
                )}

                <ul className="flex flex-col gap-2">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm leading-snug text-muted-foreground"
                    >
                      <Check
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </label>
            );
          })}
        </div>
      </fieldset>

      {formError === null ? null : (
        /* In the document flow, above the CTA: a blocking error must not be
         * able to disappear on a timer, and never a toast. */
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription className="text-destructive">
            {formError}
          </AlertDescription>
        </Alert>
      )}

      {/* The single page CTA, below the grid — the cards themselves are
       * CTA-less so there is exactly one primary action on the screen. */}
      <Button
        type="submit"
        disabled={selected === null || busy}
        className="min-h-11 w-full px-6 text-sm font-semibold sm:w-auto sm:self-start"
      >
        {busy ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            {strings.plan.ctaSubmitting}
          </>
        ) : (
          strings.plan.cta
        )}
      </Button>
    </form>
  );
}
