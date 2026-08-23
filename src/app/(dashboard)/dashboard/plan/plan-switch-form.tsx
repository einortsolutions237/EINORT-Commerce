"use client";

import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import type { PlanTier } from "@/server/entitlements/plans";
import { switchPlan } from "@/server/merchant/actions";

/**
 * The `/dashboard/plan` switcher island (D-06), the first real proof that
 * `merchantAction({ mode: "write" })` works.
 *
 * ---------------------------------------------------------------------------
 * PRICES AND LIMITS ARRIVE PRE-RESOLVED, FROM THE SERVER (T-02-08 / T-02-28).
 * ---------------------------------------------------------------------------
 * `PLANS` carries `import "server-only"` and cannot be imported from a
 * `"use client"` module — the build would fail if it were. `page.tsx` formats
 * every price with `Intl.NumberFormat` and reads every tier's member limit
 * from the registry, then hands this component finished strings and numbers
 * only. There is no arithmetic here and no way for a client-computed figure
 * to reach the screen or the request.
 *
 * ---------------------------------------------------------------------------
 * THE INLINE CONFIRM IS A COURTESY. THE SERVER REFUSAL IS THE CONTROL.
 * ---------------------------------------------------------------------------
 * `memberLimit`/`memberCount` here only decide whether the confirmation copy
 * appears before a submit — never whether the switch actually happens.
 * `switchPlan` re-checks the real member count itself and refuses
 * independently, so a stale prop (a member removed in another tab) can never
 * let an unsafe downgrade through, and a stale one that over-warns just costs
 * an extra click.
 *
 * Two-step, rendered in place rather than as an overlay: the first click on a
 * tier that fails the client-side member check reveals `downgradeConfirm`
 * text beside the SAME button; only a second click on that same button
 * submits. No overlay component of any kind lives in this file, and none may
 * be added (T-02-SC).
 */

export interface PlanSwitchCard {
  readonly tier: PlanTier;
  readonly name: string;
  /** Already run through `Intl.NumberFormat` on the server. */
  readonly price: string;
  readonly memberLimit: number;
}

export function PlanSwitchForm({
  currentTier,
  memberCount,
  cards,
}: {
  readonly currentTier: PlanTier;
  readonly memberCount: number;
  readonly cards: readonly PlanSwitchCard[];
}) {
  const router = useRouter();

  // The tier whose inline confirm is currently showing — awaiting the second
  // click on its own button, not yet submitted.
  const [confirmingTier, setConfirmingTier] = useState<PlanTier | null>(null);
  const [submittingTier, setSubmittingTier] = useState<PlanTier | null>(null);
  const [errorTier, setErrorTier] = useState<PlanTier | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSwitchClick(card: PlanSwitchCard) {
    const needsConfirm = card.memberLimit < memberCount;

    // First click on a downgrade that would exceed the target's seats: reveal
    // the inline confirm copy and stop — no request goes out yet.
    if (needsConfirm && confirmingTier !== card.tier) {
      setConfirmingTier(card.tier);
      setErrorTier(null);
      setErrorMessage(null);
      return;
    }

    setSuccessMessage(null);
    setErrorTier(null);
    setErrorMessage(null);
    setSubmittingTier(card.tier);

    const result = await switchPlan({ tier: card.tier });

    setSubmittingTier(null);
    setConfirmingTier(null);

    if (result.ok) {
      // Deliberately not a redirect and not a transient notification
      // (02-UI-SPEC.md § Success): plan-switch success stays on the page as
      // an inline confirmation line, refreshed from the server data the
      // confirm state now reflects.
      setSuccessMessage(
        strings.plan.dashboard.switchSuccess.replace("{plan}", card.name),
      );
      router.refresh();
      return;
    }

    setErrorTier(card.tier);
    setErrorMessage(result.error.form?.[0] ?? strings.plan.genericError);
  }

  return (
    <div className="flex flex-col gap-4">
      {successMessage === null ? null : (
        <p className="text-sm leading-normal font-medium text-foreground">
          {successMessage}
        </p>
      )}

      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        {cards.map((card) => {
          const isCurrent = card.tier === currentTier;
          const isConfirming = confirmingTier === card.tier;
          const isSubmitting = submittingTier === card.tier;
          const busy = submittingTier !== null;

          return (
            <div
              key={card.tier}
              className={cn(
                "flex flex-col gap-4 rounded-lg border border-border bg-muted p-6",
                isCurrent && "ring-2 ring-primary",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-heading text-lg leading-snug font-semibold text-foreground">
                  {card.name}
                </h2>

                {isCurrent ? (
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

              <p className="flex flex-wrap items-baseline gap-1">
                <span className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
                  {card.price}
                </span>
                <span className="text-base leading-normal text-muted-foreground">
                  {strings.plan.priceSuffix}
                </span>
              </p>

              {isCurrent ? null : (
                <div className="flex flex-col gap-2">
                  {isConfirming ? (
                    <p className="text-sm leading-snug text-muted-foreground">
                      {strings.plan.dashboard.downgradeConfirm
                        .replace("{plan}", card.name)
                        .replace("{n}", String(card.memberLimit))
                        .replace("{m}", String(memberCount))}
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    onClick={() => {
                      void handleSwitchClick(card);
                    }}
                    disabled={busy}
                    className="min-h-11 w-full px-6 text-sm font-semibold"
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderCircle
                          aria-hidden="true"
                          className="size-4 animate-spin"
                        />
                        {strings.plan.dashboard.switchSubmitting}
                      </>
                    ) : (
                      strings.plan.dashboard.switchCta.replace(
                        "{plan}",
                        card.name,
                      )
                    )}
                  </Button>

                  {errorTier === card.tier && errorMessage !== null ? (
                    <Alert variant="destructive">
                      <AlertCircle aria-hidden="true" />
                      <AlertDescription className="text-destructive">
                        {errorMessage}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
