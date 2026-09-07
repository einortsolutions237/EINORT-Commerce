"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  TemplatePicker,
  type TemplateTile,
} from "@/components/theming/template-picker";
import { strings } from "@/lib/strings";
import { switchTemplate } from "@/server/theming/actions";
import type {
  PageDocument,
  SectionVariantMap,
  ThemeTokens,
} from "@/server/theming/schema";

/**
 * The editor's "Change template" panel (D-08, D-09, D-11, TMPL-04 —
 * 05-UI-SPEC.md § Editor "Change Template" Action).
 *
 * ---------------------------------------------------------------------------
 * THE `<TemplatePicker>` ALREADY OWNS THE CURRENT-CARD AND LOCKED-CARD
 * RENDERING. THIS PANEL DOES NOT DUPLICATE IT.
 * ---------------------------------------------------------------------------
 * `src/components/theming/template-picker.tsx` is the ONE component shared
 * with onboarding, and its own header states the rule this panel leans on:
 * the current-template card's ring, `Current` badge, retained-above-tier
 * caption and inert click are ALL rendered there, driven by `currentKey` and
 * each tile's own `locked` flag (assembled by the RSC in `page.tsx`). This
 * file supplies only what the EDITOR context adds on top: no industry sort,
 * no tier-locked upsell cards (a single text link instead), and the
 * destructive confirm dialog that turns a pick into a persisted write.
 *
 * ---------------------------------------------------------------------------
 * THE DIALOG IS THE CONFIRM STEP. THERE IS NO SECOND ONE INSIDE THIS PANEL.
 * ---------------------------------------------------------------------------
 * Selecting any non-current card opens the `alert-dialog` immediately, via
 * `TemplatePicker`'s own `onChange` — clicking the current card never reaches
 * it (that component's own inert-current-card behaviour, T-05-35). Only the
 * dialog's own confirm button calls `switchTemplate`.
 *
 * ---------------------------------------------------------------------------
 * THIS PANEL ADDS NO SAVE BUTTON, NO PUBLISH BUTTON AND NO STATUS PILL.
 * ---------------------------------------------------------------------------
 * `switchTemplate` is a completed persisted write (`merchantAction({ mode:
 * "write" })`, writing the draft columns in one transaction) — there is
 * nothing left here to save. The existing `PublishBar` already renders its
 * `hasUnpublishedChanges: true, dirty: false` branch for any saved-but-
 * unpublished edit, which is exactly what a completed switch is. Rendering
 * this panel's own "changes not yet saved" status pill for something already
 * saved would be the misleading draft/live signal the editor's whole design
 * exists to prevent.
 *
 * ---------------------------------------------------------------------------
 * SURFACE 3 TOKENS ONLY. THE MERCHANT'S OWN ACCENT TOKEN RESOLVES TO NOTHING ON THIS SURFACE.
 * ---------------------------------------------------------------------------
 * Blue/gold/slate, Outfit headings, 0.75rem radius — the same dashboard scope
 * `section-list.tsx` and `settings-panel.tsx` already carry. The merchant's
 * own accent is never read or written on this surface (D-12); every tile's
 * `primaryAccent` is the TEMPLATE's own default colour, resolved server-side
 * by the RSC, never the merchant's saved one.
 */

/**
 * Both halves of a discard hand back, plus the variant map — the shell's
 * `onTemplateSwitched` contract, parallel to `publish-bar.tsx`'s
 * `DiscardedState`.
 */
export interface TemplateSwitchedState {
  readonly document: PageDocument;
  readonly tokens: ThemeTokens;
  readonly variants: SectionVariantMap;
  readonly templateKey: string;
}

export interface ChangeTemplatePanelProps {
  /** The editor-scoped tiles the RSC assembled — tier-accessible set plus the retained current template, if any. */
  readonly tiles: readonly TemplateTile[];
  /** The draft template key, i.e. `EditorState.templateKey`. */
  readonly currentTemplateKey: string;
  /** `resolveEntitlements`' trial-aware boolean. Decides what the picker allows, never what the server allows. */
  readonly canEditStorefront: boolean;
  readonly onBack: () => void;
  readonly onSwitched: (state: TemplateSwitchedState) => void;
}

/**
 * The message a refusal carries, preferring the server's own sentence.
 *
 * Copied from `publish-bar.tsx`'s own `refusalMessage`, body for body:
 * `merchantAction` converts `TemplateLockedError` (which extends
 * `EntitlementError`) into `{ form: [message] }`, and that message is
 * `strings.editor.templateTierLocked` — the same string this panel's
 * fallback reads, so the merchant sees one sentence for one situation
 * whichever door they came through.
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

export function ChangeTemplatePanel({
  tiles,
  currentTemplateKey,
  canEditStorefront,
  onBack,
  onSwitched,
}: ChangeTemplatePanelProps) {
  /** The card awaiting confirmation. Non-null is what opens the dialog. */
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingTile = tiles.find((tile) => tile.key === pendingKey) ?? null;
  const pendingName = pendingTile?.name ?? "";

  async function handleConfirm() {
    if (pendingTile === null) return;
    setBusy(true);
    try {
      const result = await switchTemplate({ templateKey: pendingTile.key });
      if (!result.ok) {
        setPendingKey(null);
        setError(
          refusalMessage(result.error, strings.editor.templateTierLocked),
        );
        return;
      }
      setPendingKey(null);
      onSwitched({
        document: result.document,
        tokens: result.tokens,
        variants: result.variants,
        templateKey: result.templateKey,
      });
    } catch {
      // A rejected promise here is the network, not a refusal — the draft
      // template is untouched either way, same posture as `publish-bar.tsx`.
      setPendingKey(null);
      setError(strings.editor.templateTierLocked);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onBack}
        className="flex min-h-11 items-center gap-2 border-b border-border px-4 py-2 text-left text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
        {strings.editor.railBack}
      </button>

      <div className="flex flex-col gap-6 px-4 py-6">
        <h2 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.editor.railChangeTemplateEntry}
        </h2>

        {/*
         * `TemplateLockedError` refusal — e.g. a stale client posting an
         * out-of-tier key. Non-destructive, same register as the publish
         * bar's own save-failure alert. The whole sentence is the link: the
         * string already reads as one complete thought and there is no
         * separate CTA fragment to split it on.
         */}
        {error === null ? null : (
          <Alert variant="destructive">
            <AlertDescription>
              <Link href="/dashboard/plan">{error}</Link>
            </AlertDescription>
          </Alert>
        )}

        {/*
         * The courtesy, not the control — `switchTemplate`'s own
         * `assertCanEditStorefront` is what actually refuses a Starter
         * merchant's write. `disabled` on a `fieldset` cascades to every
         * native control `<TemplatePicker>` renders, the same reach
         * `publish-bar.tsx`'s per-button `disabled={busy || !canEditStorefront}`
         * has, expressed once instead of per-card.
         */}
        <fieldset
          disabled={!canEditStorefront || busy}
          className="contents"
        >
          <TemplatePicker
            tiles={tiles}
            selectedKey={pendingKey}
            currentKey={currentTemplateKey}
            onChange={(key) => {
              setError(null);
              setPendingKey(key);
            }}
          />
        </fieldset>

        {/*
         * The onboarding upsell moment does not repeat on a working surface —
         * a single text link instead of tier-locked cards (05-UI-SPEC.md).
         */}
        <Link
          href="/dashboard/plan"
          className="w-fit text-sm leading-normal text-muted-foreground underline"
        >
          {strings.editor.templateUpsellLink}
        </Link>
      </div>

      <AlertDialog
        open={pendingTile !== null}
        onOpenChange={(open) => {
          if (!open) setPendingKey(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {strings.editor.changeTemplateTitle.replace(
                "{templateName}",
                pendingName,
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {strings.editor.changeTemplateBody.replace(
                "{templateName}",
                pendingName,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {strings.editor.changeTemplateCancel}
            </AlertDialogCancel>
            {/* Destructive, same register as the existing Discard control: it discards work, even though nothing is deleted from the database. */}
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => {
                void handleConfirm();
              }}
            >
              {strings.editor.changeTemplateConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
