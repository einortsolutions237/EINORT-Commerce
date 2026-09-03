"use client";

import Link from "next/link";
import { useState } from "react";
import { Info } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";
import {
  discardDraft,
  publishStorefront,
  saveDraft,
} from "@/server/theming/actions";
import type { PageDocument, ThemeTokens } from "@/server/theming/schema";

/**
 * EDIT-02 / EDIT-03 — the editor's publish bar (04-UI-SPEC.md § Publish bar).
 *
 * ---------------------------------------------------------------------------
 * THE DISABLED BUTTONS AND THE NOTICE ARE COURTESY ONLY (D-13, EDIT-03).
 * ---------------------------------------------------------------------------
 * `saveDraft` and `publishStorefront` are each reachable by a POST that never
 * loaded this page. Both call `assertCanEditStorefront` as their FIRST handler
 * statement and refuse independently, after `merchantAction({ mode: "write" })`
 * has already refused on `canWrite`. Nothing rendered here is the control —
 * exactly the posture `dashboard/products/page.tsx` documents for
 * `createProduct`. The notice exists so a merchant reads why the button will not
 * work, not so the button stops working.
 *
 * ---------------------------------------------------------------------------
 * DURING AN ACTIVE TRIAL `canEditStorefront` IS TRUE FOR EVERY TIER, SO THE
 * NOTICE DOES NOT RENDER (D-15). SAY IT, BECAUSE THE NAIVE READING IS WRONG.
 * ---------------------------------------------------------------------------
 * The obvious implementation of D-13 keys the notice off `planTier === "starter"`
 * and shows it to a merchant on trial day 2 who has full access — which is the
 * exact opposite of the pitch, since the whole point of the view-only state is
 * that a merchant can try the editor properly before deciding to pay for it.
 * `canEditStorefront` is the trial-aware boolean `resolveEntitlements` produces
 * (plan 04-03), and it is the only input this component branches on.
 *
 * ---------------------------------------------------------------------------
 * NONE OF THE THREE ACTIONS PAINTS ITS RESULT BEFORE THE SERVER AGREES TO IT.
 * ---------------------------------------------------------------------------
 * Save may be refused by the entitlement gate. Publish may be refused by the
 * strict `pageDocumentSchema.parse` that guards the promotion (Pitfall 9).
 * Discard changes what the merchant is looking at. All three change something a
 * merchant would be misled about, so each shows a real pending state and
 * surfaces a refusal as a destructive `alert` in this same region — NEVER a
 * toast alone for a blocking error. Reorder and field edits ARE painted ahead
 * of any server round trip, but they are pure browser draft state the server
 * has not been asked about yet, and they are the shell's concern rather than
 * this component's. The React hook that names this pattern is deliberately not
 * spelled out here, because the audit for its absence is a plain grep over this
 * file (the `registry.ts` precedent).
 *
 * ---------------------------------------------------------------------------
 * `Discard` IS THE PHASE'S ONE IRREVERSIBLE ACTION AND THE ONLY ONE BEHIND A
 * DIALOG.
 * ---------------------------------------------------------------------------
 * Publishing is a forward action and gets a toast; colouring it as destructive
 * would teach a merchant to fear the thing the product exists to do. Discard
 * drops unpublished work permanently and is confirmed with a destructive
 * `alert-dialog` first. Server-side it OVERWRITES the draft column rather than
 * deleting a row, so no data is hard-deleted even on confirm (D-08).
 *
 * ---------------------------------------------------------------------------
 * THE UNPUBLISHED INDICATOR IS A TIMESTAMP COMPARISON, DONE BY THE SHELL.
 * ---------------------------------------------------------------------------
 * `hasUnpublishedChanges` arrives as a boolean the caller computed from
 * `draftUpdatedAt > publishedAt`. It is deliberately not a structural
 * comparison of two documents on every render — that is a deep walk over the
 * whole page on every keystroke, to answer a question two dates already answer.
 *
 * Surface 3 tokens only, and no gold anywhere: the gold budget is fully spent
 * on the claims queue (03-UI-SPEC § A. Color) and
 * `tests/unit/dashboard-nav.test.ts` counts it.
 */

/** Both halves of what a discard hands back, so the shell can reset its state. */
export interface DiscardedState {
  readonly document: PageDocument;
  readonly tokens: ThemeTokens;
}

export interface PublishBarProps {
  readonly dirty: boolean;
  /** The shell's `draftUpdatedAt > publishedAt`, never a deep comparison. */
  readonly hasUnpublishedChanges: boolean;
  /** `resolveEntitlements`' trial-aware boolean — NOT `planTier === "starter"`. */
  readonly canEditStorefront: boolean;
  readonly document: PageDocument;
  readonly tokens: ThemeTokens;
  /**
   * The absolute storefront address, built by the RSC from the CONFIGURED root
   * domain exactly as `/onboarding/plan` builds it.
   *
   * IT IS A PROP AND NOT DERIVED FROM `window.location.host` (Pitfall 12): dev
   * binds port 3001 while `NEXT_PUBLIC_ROOT_DOMAIN` says 3000, so a host read
   * from the browser opens a tab on a port nothing is serving.
   */
  readonly storefrontUrl: string;
  readonly onSaved: () => void;
  readonly onDiscarded: (state: DiscardedState) => void;
}

/** Which button is in flight. Only one of the three can be at a time. */
type Pending = "none" | "save" | "publish" | "discard";

/**
 * The message a refusal carries, preferring the server's own sentence.
 *
 * `merchantAction` converts an `EntitlementError` into
 * `{ form: [message] }`, and the message it hands back for this surface is
 * `strings.editor.starterViewOnly` — the same key the notice renders. Reading it
 * rather than substituting a local one means the merchant sees one sentence for
 * one situation whichever door they came through.
 */
function refusalMessage(
  error: Record<string, string[]>,
  fallback: string,
): string {
  const form = error.form?.[0];
  if (form !== undefined) return form;
  const first = Object.values(error)[0]?.[0];
  return first ?? fallback;
}

export function PublishBar({
  dirty,
  hasUnpublishedChanges,
  canEditStorefront,
  document,
  tokens,
  storefrontUrl,
  onSaved,
  onDiscarded,
}: PublishBarProps) {
  const [pending, setPending] = useState<Pending>("none");
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const busy = pending !== "none";

  async function handleSave() {
    setPending("save");
    setError(null);
    try {
      const result = await saveDraft({ document, tokens });
      if (!result.ok) {
        setError(refusalMessage(result.error, strings.editor.saveFailed));
        return;
      }
      onSaved();
    } catch {
      // A rejected promise here is the network, not a refusal. The copy says
      // what happened and what to do next, and the draft is untouched.
      setError(strings.editor.saveFailed);
    } finally {
      setPending("none");
    }
  }

  async function handlePublish() {
    setPending("publish");
    setError(null);
    try {
      const result = await publishStorefront({});
      if (!result.ok) {
        setError(refusalMessage(result.error, strings.editor.publishRefused));
        return;
      }
      toast.success(strings.editor.publishedToast, {
        action: {
          label: strings.editor.viewStore,
          onClick: () => {
            window.open(storefrontUrl, "_blank", "noopener,noreferrer");
          },
        },
      });
    } catch {
      setError(strings.editor.publishRefused);
    } finally {
      setPending("none");
    }
  }

  async function handleDiscard() {
    setPending("discard");
    setError(null);
    try {
      const result = await discardDraft({});
      if (!result.ok) {
        /*
         * The fallback is the save copy on purpose: a discard that did not land
         * is the same class of failure — the write never reached the server and
         * nothing changed. A refusal carries the server's own sentence instead,
         * which is the case that actually happens (the entitlement gate).
         */
        setError(refusalMessage(result.error, strings.editor.saveFailed));
        return;
      }
      setConfirmOpen(false);
      onDiscarded({ document: result.document, tokens: result.tokens });
    } catch {
      setError(strings.editor.saveFailed);
    } finally {
      setPending("none");
    }
  }

  const status = dirty
    ? strings.editor.statusUnsaved
    : hasUnpublishedChanges
      ? strings.editor.statusSaved
      : strings.editor.statusPublished;

  return (
    /*
     * Sticky to the TOP of the editor region at >=md, and to the VIEWPORT BOTTOM
     * below md, where a top-docked bar would compete with the pane toggle for
     * the only row of chrome a 360px screen can spare.
     *
     * The notice is the first child of a column, which is "inside this region"
     * at >=md and "directly above it" once the whole region is docked to the
     * bottom — one render satisfying both readings of the contract.
     */
    <div className="sticky bottom-0 z-10 flex min-h-14 flex-col gap-3 border-t border-border bg-card px-4 py-3 md:top-0 md:bottom-auto md:border-t-0 md:border-b">
      {canEditStorefront ? null : (
        <Alert>
          <Info aria-hidden="true" />
          <AlertDescription>
            {strings.editor.starterViewOnly}{" "}
            <Link href="/dashboard/plan">{strings.editor.seePlansLink}</Link>
          </AlertDescription>
        </Alert>
      )}

      {error === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-sm leading-normal font-semibold text-muted-foreground"
        >
          {dirty ? (
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-primary"
            />
          ) : null}
          {status}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={busy}
            onClick={() => {
              setError(null);
              setConfirmOpen(true);
            }}
          >
            {strings.editor.discard}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy || !canEditStorefront}
            onClick={() => {
              void handleSave();
            }}
          >
            {pending === "save"
              ? strings.editor.saveSubmitting
              : strings.editor.save}
          </Button>

          {/* The one primary on this page. */}
          <Button
            type="button"
            className="min-h-11"
            disabled={busy || !canEditStorefront}
            onClick={() => {
              void handlePublish();
            }}
          >
            {pending === "publish"
              ? strings.editor.publishSubmitting
              : strings.editor.publish}
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{strings.editor.discardTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {strings.editor.discardBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {strings.editor.discardCancel}
            </AlertDialogCancel>
            {/* Destructive, because this one genuinely drops work. */}
            <AlertDialogAction
              variant="destructive"
              disabled={pending === "discard"}
              onClick={() => {
                void handleDiscard();
              }}
            >
              {strings.editor.discardConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
