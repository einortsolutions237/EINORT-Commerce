"use client";

import {
  AlertCircle,
  Building2,
  Check,
  LoaderCircle,
  Store,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
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
 * absence of a button is only the UI agreeing with it. That highlight is now
 * carried by four coordinated signals rather than one grey chip: the solid
 * `bg-primary` badge straddling the card's top edge, the solid-filled icon
 * tile, the white raised fill with `shadow-lg`, and the desktop-only 8px lift.
 * NONE OF THEM MAY DRIFT INTO THE SELECTED STATE'S LANGUAGE. Selection speaks
 * with a 2px ring OUTSIDE the box plus the `Check` glyph and its `sr-only`
 * label; recommendation speaks with fill, elevation and a border ON the box. A
 * card that looks chosen before the merchant chooses is the exact inertia
 * D-04/D-05 were written to prevent.
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

/**
 * One decorative glyph per tier, keyed by `PlanTier` and NOT by `string`.
 *
 * The typing is the point: this is the same drift discipline `TIER_COPY` in
 * `page.tsx` and `ORDER_TRANSITIONS` apply. A fourth entry added to
 * `PLAN_TIERS` must become a compile error here, not a card that silently
 * renders with a hole where its icon should be.
 *
 * The three glyphs are an ascending scale of business maturity — a storefront,
 * a growth curve, an institution — matching the ascending price order, so the
 * iconography restates the tier ladder instead of decorating it arbitrarily.
 * Deliberately not playful/consumer imagery: this is a tool small businesses
 * run their revenue on, and the icons are asked to read as serious.
 */
const TIER_ICONS: Readonly<Record<PlanTier, LucideIcon>> = {
  starter: Store,
  business: TrendingUp,
  professional: Building2,
};

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
         *
         * `gap-6` rather than `gap-4` so `shadow-lg` on the recommended card
         * has room to fall without crowding its neighbours, and so the badge's
         * 12px overhang sits in the gutter on the single-column layout instead
         * of touching the card above it. `pt-3` reserves that same 12px above
         * the first row, where there is no gutter to borrow from — otherwise
         * the badge rides up against the `subline` on mobile (Starter is first)
         * and against it again at `lg` once the -8px lift applies.
         */}
        <div className="grid items-stretch gap-6 pt-3 lg:grid-cols-3">
          {plans.map((plan) => {
            const isSelected = selected === plan.tier;
            const TierIcon = TIER_ICONS[plan.tier];

            return (
              <label
                key={plan.tier}
                className={cn(
                  // The whole card is the label, therefore the whole card is
                  // the tap target — comfortably past the 44px floor.
                  "relative flex min-h-11 cursor-pointer flex-col gap-4 rounded-lg border p-6",
                  // RECOMMENDED-AT-REST AND SELECTED MUST NOT READ AS THE SAME
                  // THING, so they are separated on three axes at once. Fill:
                  // `bg-card` (white) against a slate-50 page reads two steps
                  // lighter than the `bg-muted` siblings, so the card is
                  // genuinely raised rather than merely outlined. Elevation:
                  // `shadow-lg` plus an 8px lift applied only at `lg`, where
                  // the grid is actually three columns and a lift means
                  // something. Geometry: recommended is a 1px border ON the
                  // box, selected is a 2px ring OUTSIDE it. `border-2` is
                  // deliberately NOT used here — it would shift this card's
                  // content box 1px per side against its siblings for no gain
                  // the shadow does not already deliver. `lg:-translate-y-2` is
                  // a paint-time transform and does not participate in layout,
                  // so `items-stretch` still equalises all three heights.
                  plan.recommended
                    ? "border-primary bg-card shadow-lg lg:-translate-y-2"
                    : "border-border bg-muted",
                  // The focus ring renders on the CARD, never on the hidden
                  // radio, or a keyboard user sees nothing at all.
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                  // Selected treatment: a 2px primary ring. The fill never
                  // changes — no value shift on a monochrome palette. NO
                  // `ring-offset-*`: the focus outline already sits at
                  // `outline-offset-2` (2-4px out) and this ring at 0-2px out,
                  // adjacent and non-overlapping. An offset ring would collide
                  // with the focus outline for a keyboard user on a selected
                  // card.
                  isSelected && "ring-2 ring-primary",
                )}
              >
                {/*
                 * The badge straddles the card's top border — the label is
                 * already `relative`, so no wrapper is needed. It is `h-6`
                 * (24px), so `-top-3` (-12px) centres it exactly on the border,
                 * half in and half out: it now reads as ATTACHED to the card
                 * rather than as one more grey chip sitting inside it.
                 * `left-1/2 -translate-x-1/2` beats `right-6` because on the
                 * single-column mobile layout the card is full-bleed and a
                 * right-anchored pill drifts far from the tier name it
                 * modifies. `default` is the Badge's own defaultVariant
                 * (`bg-primary text-primary-foreground`); it is stated
                 * explicitly so the solid fill is legible at the call site.
                 */}
                {plan.recommended ? (
                  <Badge
                    variant="default"
                    className="absolute -top-3 left-1/2 -translate-x-1/2"
                  >
                    {strings.plan.recommendedBadge}
                  </Badge>
                ) : null}

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
                  <div className="flex flex-col gap-3">
                    {/*
                     * Decorative only — `aria-hidden`, because the `<h2>` below
                     * already carries the tier's meaning and a second announced
                     * label would just be noise. One hue, two weights: solid
                     * for the recommended tier, tinted for the other two. Each
                     * tier deliberately does NOT get its own colour; this
                     * project runs one accent, and a per-tier palette is
                     * exactly the semantic-token erosion
                     * `surface-token-isolation.test.ts` exists to prevent.
                     */}
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-md",
                        plan.recommended
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      <TierIcon aria-hidden="true" className="size-5" />
                    </span>

                    {/* Heading role, one step down: 18px / 600 */}
                    <h2 className="font-heading text-lg leading-snug font-semibold text-foreground">
                      {plan.name}
                    </h2>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
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
                      {/* The glyph carries the accent on all three tiers; the
                       * `<li>` text stays muted so the list reads as content,
                       * not as three columns of shouting. */}
                      <Check
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-primary"
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
