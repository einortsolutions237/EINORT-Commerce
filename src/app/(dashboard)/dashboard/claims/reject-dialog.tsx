"use client";

import { useId, useState } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/lib/strings";

/**
 * D-11's rejection dialog — 03-UI-SPEC.md § A5's "Reject — reason is required".
 *
 * ---------------------------------------------------------------------------
 * REJECTING ALWAYS OPENS THIS. THERE IS NO ONE-TAP REJECT, EVER.
 * ---------------------------------------------------------------------------
 * Confirming is one tap because a confirmed sale is the outcome both parties
 * want; rejecting is not its mirror image. It is irreversible from the
 * customer's side, it puts their order into `DISPUTED`, and the ONLY thing they
 * can act on is the sentence typed here — which is why 03-UI-SPEC.md's
 * destructive-action register gives rejection a `dialog` with a required reason
 * while giving confirmation nothing at all.
 *
 * ---------------------------------------------------------------------------
 * THE SUBMIT IS DISABLED UNTIL A REASON EXISTS, AND THAT IS THE THIRD GUARD.
 * ---------------------------------------------------------------------------
 * D-11 is enforced three times over, deliberately: `rejectClaim`'s Zod schema
 * refuses a reason under three characters, `transitionOrder` independently
 * refuses `DISPUTED` with a blank one, and this button will not enable without a
 * selection. The two server guards are the invariant; this one is the courtesy
 * that means a merchant never discovers the rule by having their tap rejected
 * (T-03-68). Removing any of the three leaves the other two — removing the two
 * server ones would leave a requirement enforced by a disabled attribute, which
 * is not enforcement at all.
 *
 * ---------------------------------------------------------------------------
 * THE THREE CANNED REASONS ARE THE REASON TEXT, NOT CODES FOR IT.
 * ---------------------------------------------------------------------------
 * Each radio's value IS the sentence the customer will read. Mapping a code to
 * copy at submit time would put the customer-facing string in two places — here
 * and in whatever translated it — and the whole point of D-11 is that what the
 * merchant chose is what the customer receives, with nothing in between.
 */

/**
 * The sentinel for `Something else`. Not a reason — the marker that the reason
 * is in the textarea. A real sentence can never collide with it because it is
 * not a sentence.
 */
const OTHER = "__other__";

/** A5 caps the free-text reason. `rejectClaim`'s schema allows 200; this is the
 * tighter UI limit, and the counter below is what makes it visible rather than
 * a silent truncation at the boundary. */
const OTHER_MAX_LENGTH = 140;

export interface RejectDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Resolves once the server has answered, so the card can leave the queue. */
  readonly onReject: (reason: string) => Promise<boolean>;
}

export function RejectDialog({
  open,
  onOpenChange,
  onReject,
}: RejectDialogProps) {
  const otherFieldId = useId();
  const [choice, setChoice] = useState<string>("");
  const [otherReason, setOtherReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOther = choice === OTHER;
  const reason = isOther ? otherReason.trim() : choice;

  /*
   * `Something else` selected but empty is NOT a chosen reason. Treating it as
   * one would let the dialog submit a blank string that the server would then
   * refuse — turning a disabled button into a round trip and an error message,
   * which is the exact experience the disabled state exists to prevent.
   */
  const canSubmit = reason.length >= 3 && !pending;

  async function handleSubmit() {
    setError(null);
    setPending(true);

    const succeeded = await onReject(reason);

    setPending(false);
    if (succeeded) {
      // Reset, so reopening the dialog on another card never inherits this
      // one's typing.
      setChoice("");
      setOtherReason("");
      onOpenChange(false);
      return;
    }

    setError(strings.orders.genericError);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{strings.claims.rejectDialogTitle}</DialogTitle>
          <DialogDescription>
            {strings.claims.rejectDialogBody}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={choice}
          onValueChange={(value: string) => {
            setChoice(value);
            setError(null);
          }}
          className="gap-3"
        >
          {[
            strings.claims.rejectReasonAmount,
            strings.claims.rejectReasonReference,
            strings.claims.rejectReasonNotReceived,
          ].map((canned) => (
            <label
              key={canned}
              className="flex min-h-11 items-center gap-3 text-sm leading-normal font-normal text-foreground"
            >
              <RadioGroupItem value={canned} />
              {canned}
            </label>
          ))}

          <label className="flex min-h-11 items-center gap-3 text-sm leading-normal font-normal text-foreground">
            <RadioGroupItem value={OTHER} />
            {strings.claims.rejectReasonOther}
          </label>
        </RadioGroup>

        {isOther ? (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={otherFieldId}
              className="text-sm leading-normal font-medium text-foreground"
            >
              {strings.claims.rejectReasonOtherLabel}
            </label>
            <Textarea
              id={otherFieldId}
              value={otherReason}
              maxLength={OTHER_MAX_LENGTH}
              rows={3}
              onChange={(event) => {
                setOtherReason(event.target.value);
                setError(null);
              }}
            />
            {/*
             * `aria-live="polite"` rather than silent: a sighted merchant sees
             * the count fall as they type, and a screen-reader user gets the
             * same warning before the field stops accepting characters.
             */}
            <span
              aria-live="polite"
              className="self-end text-sm leading-normal font-normal tabular-nums text-muted-foreground"
            >
              {otherReason.length}/{OTHER_MAX_LENGTH}
            </span>
          </div>
        ) : null}

        {error === null ? null : (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {strings.claims.rejectDialogCancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            disabled={!canSubmit}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            {strings.claims.rejectDialogConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
