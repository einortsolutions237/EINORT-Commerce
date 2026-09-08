"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import {
  TemplatePicker,
  type TemplateTile,
} from "@/components/theming/template-picker";
import { CurrentTemplateCard } from "@/components/theming/current-template-card";
import { strings } from "@/lib/strings";
import { switchTemplate } from "@/server/theming/actions";
import type {
  PageDocument,
  SectionVariantMap,
  ThemeTokens,
} from "@/server/theming/schema";

/**
 * The Themes page's own primary content (D-08, D-09, D-11, TMPL-04 —
 * 05.3-UI-SPEC.md § Layout → Themes page, moved and adapted from the
 * editor's former "Change template" rail panel, `change-template-panel.tsx`
 * — 05.3-CONTEXT.md D-A/D-B, 05.3-UI-SPEC.md § Component Changes).
 *
 * ---------------------------------------------------------------------------
 * THE `<TemplatePicker>` ALREADY OWNS THE CURRENT-CARD AND LOCKED-CARD
 * RENDERING. THIS COMPONENT DOES NOT DUPLICATE IT.
 * ---------------------------------------------------------------------------
 * `src/components/theming/template-picker.tsx` is the ONE component shared
 * with onboarding, and its own header states the rule this component leans
 * on: the current-template card's ring, `Current` badge, retained-above-tier
 * caption and inert click are ALL rendered there, driven by `currentKey` and
 * each tile's own `locked` flag (assembled by the RSC in `page.tsx`). This
 * file supplies only what the Themes page adds on top: the current-template
 * spotlight row above the grid, no industry sort, no tier-locked upsell
 * cards (a single text link instead), and the destructive confirm dialog
 * that turns a pick into a persisted write.
 *
 * ---------------------------------------------------------------------------
 * THE DIALOG IS THE CONFIRM STEP. THERE IS NO SECOND ONE INSIDE THIS FILE.
 * ---------------------------------------------------------------------------
 * Selecting any non-current card opens the `alert-dialog` immediately, via
 * `TemplatePicker`'s own `onChange` — clicking the current card never
 * reaches it (that component's own inert-current-card behaviour, T-05-35).
 * Only the dialog's own confirm button calls `switchTemplate`.
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE ADDS NO SAVE BUTTON, NO PUBLISH BUTTON AND NO STATUS PILL.
 * ---------------------------------------------------------------------------
 * `switchTemplate` is a completed persisted write (`merchantAction({ mode:
 * "write" })`, writing the draft columns in one transaction) — there is
 * nothing left here to save. It is also this page's ONLY commit flow: unlike
 * the old combined route, this page has no `PublishBar` at all (D-B forbids
 * adding a second commit UI — 05.3-UI-SPEC.md § U-6). The information that
 * used to come from the `PublishBar`'s `Saved · not published yet` state on
 * the same screen now comes from a success toast instead, with an action
 * that navigates to the Editor (see `handleConfirm` below).
 *
 * ---------------------------------------------------------------------------
 * SURFACE 3 TOKENS ONLY. THE MERCHANT'S OWN ACCENT TOKEN RESOLVES TO NOTHING ON THIS SURFACE.
 * ---------------------------------------------------------------------------
 * Blue/gold/slate, Outfit headings, 0.75rem radius — the same dashboard scope
 * `section-list.tsx` and `settings-panel.tsx` already carry. The merchant's
 * own accent is never read or written on this surface (D-12); every tile's
 * `primaryAccent` is the TEMPLATE's own default colour, resolved server-side
 * by the RSC, never the merchant's saved one.
 *
 * ---------------------------------------------------------------------------
 * THE SPOTLIGHT/GRID SPLIT (quick task 260908-bv1, CONTEXT.md D-A, D-B).
 * ---------------------------------------------------------------------------
 * `tiles` (the RSC's already-assembled `TemplateTile[]`) is split here, at
 * this last consumer, into `spotlightTile` (the merchant's current template,
 * rendered in its own non-interactive `<CurrentTemplateCard>` above the
 * grid, now in the R-3 two-column composition) and `gridTiles` (every other
 * tile, unchanged, still tier-gated with locked templates visible-but-
 * dimmed). `<TemplatePicker>` itself is unchanged in behaviour and contract
 * — only the array this component hands it has changed shape (`gridTiles`
 * instead of `tiles`). `currentKey` is still passed to it as defense-in-
 * depth, per RESEARCH.md Focus 1, even though `gridTiles` never contains
 * that key anymore: `TemplatePicker` is a shared, surface-agnostic
 * component (onboarding is its other caller), and keeping its own inert-
 * current-card guard wired costs nothing.
 */

/**
 * Both halves of a discard hand back, plus the variant map — kept as a
 * documented shape even though this page's own caller no longer reads it
 * (see `handleConfirm` below). `tests/isolation/template-switch.test.ts`
 * asserts on the shape this interface documents, so it stays exported and
 * unchanged rather than deleted with the callback that used to consume it.
 */
export interface TemplateSwitchedState {
  readonly document: PageDocument;
  readonly tokens: ThemeTokens;
  readonly variants: SectionVariantMap;
  readonly templateKey: string;
}

export interface ThemesBrowserProps {
  /** The RSC's already-assembled tiles — tier-accessible set plus the retained current template, if any. */
  readonly tiles: readonly TemplateTile[];
  /** The draft template key, i.e. `EditorState.templateKey`. */
  readonly currentTemplateKey: string;
  /** `resolveEntitlements`' trial-aware boolean. Decides what the picker allows, never what the server allows. */
  readonly canEditStorefront: boolean;
}

/**
 * The message a refusal carries, preferring the server's own sentence.
 *
 * Copied from `publish-bar.tsx`'s own `refusalMessage`, body for body — a
 * known, accepted small duplication in this codebase rather than a shared
 * utility (05.3-PATTERNS.md explicitly flags this as intentional, not
 * scope for a "clean up" during this move): `merchantAction` converts
 * `TemplateLockedError` (which extends `EntitlementError`) into `{ form:
 * [message] }`, and that message is `strings.editor.templateTierLocked` —
 * the same string this component's fallback reads, so the merchant sees one
 * sentence for one situation whichever door they came through.
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

export function ThemesBrowser({
  tiles,
  currentTemplateKey,
  canEditStorefront,
}: ThemesBrowserProps) {
  const router = useRouter();

  /** The card awaiting confirmation. Non-null is what opens the dialog. */
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingTile = tiles.find((tile) => tile.key === pendingKey) ?? null;
  const pendingName = pendingTile?.name ?? "";

  /**
   * The spotlight/grid split (quick task 260908-bv1, D-A/D-B) — see this
   * file's own header comment. `spotlightTile` is `null` only if the RSC's
   * `tiles` somehow omits the merchant's own current key, which should never
   * happen; the grid still renders correctly with no spotlight above it.
   */
  const spotlightTile =
    tiles.find((tile) => tile.key === currentTemplateKey) ?? null;
  const gridTiles = tiles.filter((tile) => tile.key !== currentTemplateKey);

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
      // `result.document`/`.tokens`/`.variants` are intentionally unread here
      // — this page has no draft to repaint. `switchTemplate`'s dual
      // `revalidatePath` (src/server/theming/actions.ts) is what refreshes
      // the Current badge on this same page; the Editor gets a fresh RSC
      // read the next time the merchant navigates there.
      toast.success(
        strings.editor.templateSwitchedToast.replace(
          "{templateName}",
          pendingTile.name,
        ),
        {
          action: {
            label: strings.editor.customizeButton,
            onClick: () => router.push("/dashboard/storefront/editor"),
          },
        },
      );
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
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.editor.themesPageHeading}
        </h1>

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
          {spotlightTile !== null ? (
            <>
              <h3 className="border-b border-border pb-2 text-sm leading-normal font-semibold text-foreground">
                {strings.editor.templateCurrentHeading}
              </h3>
              {/* R-3 two-column spotlight row — Source: 05.3-UI-SPEC.md § R-3 */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,22rem)_1fr] md:items-center">
                <CurrentTemplateCard
                  tile={spotlightTile}
                  sizes="(min-width: 768px) 352px, 100vw"
                />
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-sm leading-normal text-muted-foreground">
                      {strings.editor.templateCurrentHeading}
                    </p>
                    <h2 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
                      {spotlightTile.name}
                    </h2>
                  </div>
                  <Button
                    render={<Link href="/dashboard/storefront/editor" />}
                    className="w-fit min-h-11"
                  >
                    {strings.editor.customizeButton}
                  </Button>
                </div>
              </div>
            </>
          ) : null}

          <h3 className="border-b border-border pb-2 text-sm leading-normal font-semibold text-foreground">
            {strings.editor.templateAvailableHeading}
          </h3>
          <TemplatePicker
            tiles={gridTiles}
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
