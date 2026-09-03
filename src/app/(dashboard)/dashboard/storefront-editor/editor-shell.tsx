"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { Info, Monitor, RotateCcw, Smartphone } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { editorReducer, type EditorState } from "@/lib/editor/reducer";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import type { FieldDescriptor } from "@/server/theming/registry";
import {
  themeTokensSchema,
  type PageDocument,
  type SectionInstance,
  type SectionType,
  type ThemeTokens,
} from "@/server/theming/schema";

import { PublishBar } from "./publish-bar";
import { SectionList, type SectionListEntry } from "./section-list";
import { REPEATABLE_KEY_SEPARATOR, SettingsPanel } from "./settings-panel";

/**
 * EDIT-02 — the storefront editor shell (04-UI-SPEC.md § Storefront Editor).
 *
 * ---------------------------------------------------------------------------
 * THIS FILE IS WIRING. EVERY DOCUMENT TRANSITION GOES THROUGH `editorReducer`.
 * ---------------------------------------------------------------------------
 * `vitest.config.ts` runs the `unit` project on `environment: "node"` with no
 * jsdom and no testing-library, so nothing in this component is reachable by an
 * automated test — every "component" test in this repository is a source scan or
 * a pure-logic test. That is exactly why `src/lib/editor/reducer.ts` exists and
 * why it holds all of EDIT-02's behaviour: a reorder inlined into a callback
 * here would be the product's core interaction with zero coverage. There is one
 * `useReducer`, no second reducer, no `patch()` updater and no inline setter
 * that touches the document. A transition duplicated here silently deletes the
 * suite that covers it.
 *
 * The two `useState` values below are CHROME and touch nothing that is saved:
 * which of the rail's two views is showing, and which pane a <`lg` screen is
 * looking at. `editorReducer` has no action for either — there is no
 * "deselect", and the `Brand & logo` entry is not a section — so expressing
 * them as reducer state would mean widening the action union and its tests to
 * carry a value the document never sees.
 *
 * ---------------------------------------------------------------------------
 * THE PREVIEW PROTOCOL: NOTHING IS POSTED BEFORE THE HANDSHAKE, AND EVERY POST
 * CARRIES AN EXACT `targetOrigin` (T-04-08).
 * ---------------------------------------------------------------------------
 * `src/app/s/[slug]/preview/preview-canvas.tsx` attaches its listener and THEN
 * announces `einort:preview-ready`. This half waits for that announcement
 * before its first `einort:preview-doc`, so the merchant's first draft cannot
 * be posted into a document that is not yet listening — a preview stuck on the
 * published store while the rail insists something changed.
 *
 * The listener applies the receiver's own discipline in the receiver's own
 * order: `event.origin` is compared BEFORE `event.data` is read at all. And
 * `previewOrigin` is a PROP, computed server-side from the configured root
 * domain — never from the browser's own address, and never a wildcard. The
 * reverse direction carries the merchant's unpublished draft, so a wildcard
 * would hand it to whatever page happened to be framing this one.
 *
 * ---------------------------------------------------------------------------
 * EVERY EDIT IS PUSHED ON THE SPOT (D-07). NO TIMER SITS BETWEEN A KEYSTROKE
 * AND THE PREVIEW.
 * ---------------------------------------------------------------------------
 * A `postMessage` between two documents the browser already has open is a
 * structured-clone hop measured in microseconds — there is NO NETWORK IN THIS
 * LOOP — so coalescing keystrokes would spend latency on the one interaction
 * the merchant is actively judging and buy nothing. The identifier that names
 * the forbidden technique is deliberately not spelled out here, because the
 * audit for it is a plain grep over this file (the `registry.ts` precedent).
 * The one timer below is the handshake deadline, which measures a page load
 * rather than a keystroke.
 *
 * PERSISTENCE IS THE EXPLICIT `Save`, NOT AN AUTOSAVE, AND THAT IS A DECISION
 * RATHER THAN AN OMISSION. D-07's "instant" promise is about the preview. Quietly
 * writing experimental edits from a flaky Douala mobile connection would create
 * more support questions than it prevents, so the leave-guard below exists
 * precisely because leaving with unsaved work is a real state a merchant can
 * reach.
 *
 * ---------------------------------------------------------------------------
 * SURFACE 3 TOKENS ONLY.
 * ---------------------------------------------------------------------------
 * Blue/gold/slate, Outfit headings, 0.75rem radius, and no gold: that budget is
 * spent on the claims queue and `tests/unit/dashboard-nav.test.ts` counts it.
 * The merchant's own accent resolves to nothing on this surface (D-12) and the
 * only place they see it applied is INSIDE the iframe — a different document on
 * a different origin, which is D-12 satisfied by a document boundary rather
 * than by discipline. Both of the tokens that would break that are deliberately
 * unspelled here; the audit for each is a plain grep over this file.
 */

// ---------------------------------------------------------------------------
// The protocol, spelled the same way the receiver spells it
// ---------------------------------------------------------------------------

/** Editor -> iframe: the whole draft, after every reducer action. */
const PREVIEW_DOC_MESSAGE = "einort:preview-doc";

/** Editor -> iframe: scroll this section into view and ring it. */
const PREVIEW_SELECT_MESSAGE = "einort:preview-select";

/** iframe -> editor: "my listener is attached, you may post now." */
const PREVIEW_READY_MESSAGE = "einort:preview-ready";

/**
 * How long the handshake may take before the merchant is told it failed.
 *
 * Ten seconds is a page load on a slow connection plus room, not a network
 * timeout: the pane server-renders the published storefront first, so the
 * handshake lands only after that document has hydrated.
 */
const HANDSHAKE_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

/** Which of the two documents a <`lg` screen is looking at. */
type Pane = "edit" | "preview";

/** The iframe's width, chosen by the merchant. */
type Viewport = "desktop" | "mobile";

/** Which entry the rail's settings panel is showing, when one is open. */
type RailTarget = "theme" | "section";

/**
 * One section type's editor entry, resolved from the `server-only` registry by
 * the RSC and handed down as plain data.
 *
 * `maxima` is `sectionFieldMaxima(type)` — the Zod caps read back out of the
 * schema rather than restated. The registry deliberately carries no cap on a
 * descriptor (see its own header), so this is the only honest source for the
 * `{n}/{max}` counters the settings panel renders.
 */
export interface EditorSectionType {
  readonly label: string;
  /** `SECTION_TYPES[type].repeatable` — `blocks`, and only for `trust-bar`. */
  readonly repeatable?: string;
  readonly fields: readonly FieldDescriptor[];
  readonly maxima: Record<string, number>;
}

export interface EditorShellProps {
  readonly initialDocument: PageDocument;
  readonly initialTokens: ThemeTokens;
  readonly sectionTypes: Readonly<Record<SectionType, EditorSectionType>>;
  /**
   * `THEME_FIELDS` with the one non-token descriptor already removed by the
   * RSC — see the note on the page's `themeFields` for why.
   */
  readonly themeFields: readonly FieldDescriptor[];
  readonly themeMaxima: Record<string, number>;
  readonly imageBaseUrl: string;
  /** `{protocol}://{slug}.{rootDomain}/preview`, built by the RSC (Pitfall 12). */
  readonly previewUrl: string;
  /** The same address without the path — the exact `targetOrigin` of every send. */
  readonly previewOrigin: string;
  /** The merchant's live storefront, for the publish toast's `View store`. */
  readonly storefrontUrl: string;
  /** `resolveEntitlements`' trial-aware boolean. Decides what is READ, never what is allowed. */
  readonly canEditStorefront: boolean;
  /** ISO. Half of the "are there unpublished changes?" comparison. */
  readonly draftUpdatedAt: string;
  /** ISO, epoch when the merchant has never published. The other half. */
  readonly publishedAt: string;
  /** The contact section's nudge condition, computed server-side. */
  readonly needsWhatsappNumber: boolean;
  /** The product grid's nudge condition, computed server-side. */
  readonly hasNoProducts: boolean;
}

// ---------------------------------------------------------------------------
// Narrowers — all module-private, none of them a state transition
// ---------------------------------------------------------------------------

/**
 * A section's settings as the homogeneous map the panel reads.
 *
 * The spread is what widens the discriminated union's narrowed `settings` to an
 * indexable shape; the panel cannot know which member it is looking at, which is
 * the same asymmetry `withSetting` documents on the reducer's side.
 */
function settingsOf(section: SectionInstance): Record<string, unknown> {
  return { ...section.settings };
}

/**
 * The stored blocks, narrowed without trusting their shape.
 *
 * MIRRORS `settings-panel.tsx`'s private `readBlocks` DELIBERATELY, filter for
 * filter. The panel emits `blocks.{index}.{key}` against the list IT rendered,
 * so this side has to arrive at the same list or an index would address a
 * different block. Two different narrowings of one array is how the merchant
 * edits one item and watches another change.
 */
function readBlocks(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null,
  );
}

/** One block replaced, as a whole new array — never an in-place write. */
function withBlockField(
  blocks: readonly Record<string, unknown>[],
  index: number,
  fieldKey: string,
  value: unknown,
): Record<string, unknown>[] {
  return blocks.map((block, position) =>
    position === index ? { ...block, [fieldKey]: value } : block,
  );
}

/**
 * Whether a theme-panel key is really a token.
 *
 * Read off `themeTokensSchema.shape` rather than written as a list: the schema
 * is the boundary `saveDraft`, the publish gate and the preview receiver all
 * narrow through, so a second enumeration here would be a fourth spelling free
 * to disagree with the three that are enforced.
 */
function isTokenKey(key: string): key is keyof ThemeTokens {
  return Object.prototype.hasOwnProperty.call(themeTokensSchema.shape, key);
}

// ---------------------------------------------------------------------------
// The shell
// ---------------------------------------------------------------------------

export function EditorShell({
  initialDocument,
  initialTokens,
  sectionTypes,
  themeFields,
  themeMaxima,
  imageBaseUrl,
  previewUrl,
  previewOrigin,
  storefrontUrl,
  canEditStorefront,
  draftUpdatedAt,
  publishedAt,
  needsWhatsappNumber,
  hasNoProducts,
}: EditorShellProps) {
  const initialState: EditorState = {
    document: initialDocument,
    tokens: initialTokens,
    selectedSectionId: null,
    dirty: false,
  };

  const [state, dispatch] = useReducer(editorReducer, initialState);

  /* --- rail and pane chrome ---------------------------------------------- */

  const [railTarget, setRailTarget] = useState<RailTarget | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pane, setPane] = useState<Pane>("edit");

  /*
   * Desktop at `lg`+, Mobile below, until the merchant says otherwise —
   * expressed as a fallback rather than as seeded state so the default follows
   * a resize instead of freezing at whatever the first render saw.
   * `useIsMobile` is already the editor's breakpoint: its own header fixes it
   * at 1024px, which is the `lg` this layout switches on.
   */
  const isBelowLg = useIsMobile();
  const [chosenViewport, setChosenViewport] = useState<Viewport | null>(null);
  const viewport: Viewport = chosenViewport ?? (isBelowLg ? "mobile" : "desktop");

  /* --- the preview handshake --------------------------------------------- */

  const [phase, setPhase] = useState<"loading" | "ready" | "timeout">("loading");
  const [reloadNonce, setReloadNonce] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  /*
   * The same fact as `phase === "ready"`, in a form an event handler can read
   * without being re-created when it changes. `phase` drives the render; this
   * drives the guard on `postSelect`, which is called from a click.
   */
  const readyRef = useRef(false);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      /*
       * THE ORIGIN COMPARISON IS THE FIRST STATEMENT, AND `event.data` IS NOT
       * READ ABOVE IT (Pitfall 4, T-04-08). `previewOrigin` was computed on the
       * server from configuration, so it cannot be influenced by whatever the
       * framed document reports about itself. This mirrors the receiver's step
       * 1 exactly; a handler that inspects the payload first would accept a
       * readiness announcement from any page at all.
       */
      if (event.origin !== previewOrigin) return;

      const envelope: unknown = event.data;
      if (typeof envelope !== "object" || envelope === null) return;
      if ((envelope as { type?: unknown }).type !== PREVIEW_READY_MESSAGE) {
        return;
      }

      readyRef.current = true;
      setPhase("ready");
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewOrigin]);

  /*
   * THE DEADLINE, RE-ARMED ON EVERY RELOAD.
   *
   * It reads the ref rather than `phase` so the timer does not have to be torn
   * down and rebuilt every time the document changes — the only question it
   * asks is whether the handshake has landed yet.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (readyRef.current) return;
      setPhase("timeout");
    }, HANDSHAKE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [reloadNonce]);

  /*
   * THE SENDER. This effect is the whole "hold the first post until ready"
   * rule: the guard drops everything before the handshake, and the effect
   * re-runs the moment `phase` becomes `ready`, which IS the first post. After
   * that it re-runs on every new `document` or `tokens` identity — and the
   * reducer returns new objects for every action (D-07), so every edit lands
   * here on the same frame it was dispatched.
   *
   * `previewOrigin` is passed as the exact `targetOrigin` on every send.
   */
  useEffect(() => {
    if (phase !== "ready") return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: PREVIEW_DOC_MESSAGE,
        document: state.document,
        tokens: state.tokens,
      },
      previewOrigin,
    );
  }, [phase, state.document, state.tokens, previewOrigin]);

  /** Selection sync. Dropped silently before the handshake, like every send. */
  function postSelect(sectionId: string) {
    if (!readyRef.current) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: PREVIEW_SELECT_MESSAGE, sectionId },
      previewOrigin,
    );
  }

  /**
   * NON-DESTRUCTIVE BY CONSTRUCTION: this remounts the iframe and nothing else.
   * The draft lives in this component's reducer state, which the new `key` does
   * not reach — the copy tells the merchant their changes are safe, and this is
   * why that is true rather than merely reassuring.
   */
  function reloadPreview() {
    readyRef.current = false;
    setPhase("loading");
    setReloadNonce((previous) => previous + 1);
  }

  /* --- the leave guard ---------------------------------------------------- */

  useEffect(() => {
    if (!state.dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state.dirty]);

  /* --- the unpublished-changes indicator ---------------------------------- */

  /**
   * The `publishedAt` the merchant's last in-page `Save` was made against,
   * or `null` if they have not saved since this page loaded.
   *
   * TWO TIMESTAMPS, NEVER A STRUCTURAL COMPARISON OF TWO DOCUMENTS — that is a
   * deep walk over the whole page on every keystroke to answer a question two
   * dates already answer (04-RESEARCH.md Pattern 2).
   *
   * The stored value is a `publishedAt` rather than a clock reading, and that is
   * the point. A save makes the draft newer than whatever was published at the
   * time, so while the two agree there ARE unpublished changes. `publishStorefront`
   * calls `revalidatePath` on this route, so a successful publish arrives here as
   * a NEW `publishedAt` prop — the equality then fails and the answer falls back
   * to the server's own comparison, with no callback from the publish bar and no
   * browser clock read to be wrong about.
   */
  const [savedAgainstPublishedAt, setSavedAgainstPublishedAt] = useState<
    string | null
  >(null);

  const hasUnpublishedChanges =
    savedAgainstPublishedAt === publishedAt
      ? true
      : draftUpdatedAt > publishedAt;

  /* --- dispatchers -------------------------------------------------------- */

  function handleSelect(sectionId: string) {
    dispatch({ kind: "select", sectionId });
    setRailTarget("section");
    setPanelOpen(true);
    postSelect(sectionId);
  }

  function handleMove(sectionId: string, direction: "up" | "down") {
    dispatch({ kind: direction === "up" ? "move-up" : "move-down", sectionId });
  }

  /**
   * One field edit.
   *
   * The repeatable branch is the reason this function exists at all. The panel
   * emits `blocks.{index}.{key}` for a `trust-bar` item, and `set-field`
   * REPLACES a settings key outright rather than merging into one (Pitfall 8) —
   * so the whole array is rebuilt here and handed to a SINGLE `set-field` on
   * `blocks`. Dispatching per sub-field would write `blocks.0.icon` as a
   * settings key of its own and lose the array.
   */
  function handleSectionChange(
    section: SectionInstance,
    key: string,
    value: unknown,
  ) {
    const repeatable = sectionTypes[section.type].repeatable;
    if (repeatable === undefined) {
      dispatch({ kind: "set-field", sectionId: section.id, key, value });
      return;
    }

    const parts = key.split(REPEATABLE_KEY_SEPARATOR);
    if (parts.length !== 3 || parts[0] !== repeatable) return;

    const index = Number(parts[1]);
    if (!Number.isInteger(index)) return;

    const blocks = readBlocks(settingsOf(section)[repeatable]);
    if (index < 0 || index >= blocks.length) return;

    dispatch({
      kind: "set-field",
      sectionId: section.id,
      key: repeatable,
      value: withBlockField(blocks, index, parts[2], value),
    });
  }

  /**
   * One brand-token edit.
   *
   * Both guards are refusals rather than casts: the descriptor table is
   * homogeneous, so `key` and `value` arrive untyped, and `set-token` writes
   * straight into the object `themeTokensSchema` validates at three boundaries.
   */
  function handleThemeChange(key: string, value: unknown) {
    if (!isTokenKey(key)) return;
    if (typeof value !== "string") return;
    dispatch({ kind: "set-token", key, value });
  }

  /* --- derived render data ------------------------------------------------ */

  /*
   * THE RAIL'S ORDER IS READ FROM THE DOCUMENT ON EVERY RENDER, not from a list
   * the server built once. The reducer owns the order and the array index IS
   * the order; a second ordered list handed down as a prop would be correct
   * only until the first move.
   */
  const railSections: SectionListEntry[] = state.document.sections.map(
    (section) => ({
      id: section.id,
      type: section.type,
      label: sectionTypes[section.type].label,
    }),
  );

  const selectedSection =
    state.document.sections.find(
      (section) => section.id === state.selectedSectionId,
    ) ?? null;

  /**
   * The merchant-facing nudges, and they live HERE rather than in the rendered
   * page on purpose: `/preview` IS the storefront, so a nudge painted into it
   * would make the merchant confident about a page nobody else is looking at.
   */
  function noticeFor(type: SectionType): ReactNode {
    if (type === "contact" && needsWhatsappNumber) {
      return (
        <Alert>
          <Info aria-hidden="true" />
          <AlertDescription>
            {strings.editor.contactNoWhatsapp}{" "}
            <Link href="/dashboard/settings/payment">
              {strings.editor.contactNoWhatsappLink}
            </Link>
          </AlertDescription>
        </Alert>
      );
    }

    if (type === "product-grid" && hasNoProducts) {
      return (
        <Alert>
          <Info aria-hidden="true" />
          <AlertDescription>
            {strings.editor.productGridNoProducts}{" "}
            <Link href="/dashboard/products">
              {strings.editor.productGridNoProductsLink}
            </Link>
          </AlertDescription>
        </Alert>
      );
    }

    return undefined;
  }

  /* --- render ------------------------------------------------------------- */

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
       * NO SIDE-BY-SIDE AT 360px. Below `lg` the two panes are one at a time
       * behind this switch, defaulting to `Edit`; at `lg` and above it is gone
       * and both panes render together.
       */}
      <ToggleGroup
        spacing={0}
        value={[pane]}
        onValueChange={(next) => {
          const chosen = next[0];
          if (chosen === "edit" || chosen === "preview") setPane(chosen);
        }}
        className="w-full lg:hidden"
      >
        <ToggleGroupItem value="edit" variant="outline" className="min-h-11 flex-1">
          {strings.editor.paneEdit}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="preview"
          variant="outline"
          className="min-h-11 flex-1"
        >
          {strings.editor.panePreview}
        </ToggleGroupItem>
      </ToggleGroup>

      {/*
       * Spanning the whole editor region rather than sitting inside the rail:
       * `Save` and `Publish` act on the document, not on whichever pane happens
       * to be showing. The component owns its own sticky behaviour — top at
       * `md`+, viewport bottom below it.
       */}
      <PublishBar
        dirty={state.dirty}
        hasUnpublishedChanges={hasUnpublishedChanges}
        canEditStorefront={canEditStorefront}
        document={state.document}
        tokens={state.tokens}
        storefrontUrl={storefrontUrl}
        onSaved={() => {
          setSavedAgainstPublishedAt(publishedAt);
          dispatch({ kind: "reset", state });
        }}
        onDiscarded={({ document, tokens }) => {
          setSavedAgainstPublishedAt(null);
          dispatch({ kind: "reset", state: { ...state, document, tokens } });
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/*
         * The rail: a fixed 320px column with its own scroll at `lg`+, the
         * whole screen below it.
         */}
        <div
          className={cn(
            "min-h-0 w-full shrink-0 flex-col overflow-y-auto border-border bg-card lg:flex lg:w-80 lg:border-r",
            pane === "edit" ? "flex" : "hidden",
          )}
        >
          {/*
           * PUSH/POP, NOT A THIRD PANE — a third pane does not fit at 1024px.
           * The list is replaced by the panel and the panel's back row restores
           * it, which is also why `SectionList` is told nothing is current while
           * no panel is open: its `themeSelected` prop means "the Brand & logo
           * panel is open", and the selected row's `aria-current` says the same
           * thing about a section.
           */}
          {panelOpen && railTarget === "theme" ? (
            <SettingsPanel
              title={strings.editor.railThemeEntry}
              fields={themeFields}
              values={{ ...state.tokens }}
              maxima={themeMaxima}
              imageBaseUrl={imageBaseUrl}
              onBack={() => setPanelOpen(false)}
              onChange={handleThemeChange}
            />
          ) : panelOpen &&
            railTarget === "section" &&
            selectedSection !== null ? (
            <SettingsPanel
              title={sectionTypes[selectedSection.type].label}
              fields={sectionTypes[selectedSection.type].fields}
              values={settingsOf(selectedSection)}
              maxima={sectionTypes[selectedSection.type].maxima}
              repeatable={sectionTypes[selectedSection.type].repeatable}
              imageBaseUrl={imageBaseUrl}
              notice={noticeFor(selectedSection.type)}
              onBack={() => setPanelOpen(false)}
              onChange={(key, value) =>
                handleSectionChange(selectedSection, key, value)
              }
            />
          ) : (
            <SectionList
              sections={railSections}
              selectedSectionId={
                railTarget === "section" ? state.selectedSectionId : null
              }
              themeSelected={railTarget === "theme"}
              onSelectTheme={() => {
                setRailTarget("theme");
                setPanelOpen(true);
              }}
              onSelect={handleSelect}
              onMove={handleMove}
            />
          )}
        </div>

        {/*
         * The preview canvas. The frame floats on the dashboard's own field,
         * which is what makes the storefront inside it read as a different
         * thing — which it is: a different document on a different origin.
         */}
        <div
          className={cn(
            "min-h-0 flex-1 flex-col gap-3 bg-muted p-4 md:p-8 lg:flex",
            pane === "preview" ? "flex" : "hidden",
          )}
        >
          <TooltipProvider>
            <div className="flex shrink-0 items-center justify-end">
              <ToggleGroup
                spacing={0}
                value={[viewport]}
                onValueChange={(next) => {
                  const chosen = next[0];
                  if (chosen === "desktop" || chosen === "mobile") {
                    setChosenViewport(chosen);
                  }
                }}
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <ToggleGroupItem
                        value="desktop"
                        variant="outline"
                        aria-label={strings.editor.viewportDesktop}
                        className="min-h-11"
                      >
                        <Monitor aria-hidden="true" className="size-4" />
                        <span className="hidden md:inline">
                          {strings.editor.viewportDesktop}
                        </span>
                      </ToggleGroupItem>
                    }
                  />
                  <TooltipContent className="md:hidden">
                    {strings.editor.viewportDesktop}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <ToggleGroupItem
                        value="mobile"
                        variant="outline"
                        aria-label={strings.editor.viewportMobile}
                        className="min-h-11"
                      >
                        <Smartphone aria-hidden="true" className="size-4" />
                        <span className="hidden md:inline">
                          {strings.editor.viewportMobile}
                        </span>
                      </ToggleGroupItem>
                    }
                  />
                  <TooltipContent className="md:hidden">
                    {strings.editor.viewportMobile}
                  </TooltipContent>
                </Tooltip>
              </ToggleGroup>
            </div>
          </TooltipProvider>

          <div className="relative min-h-[32rem] flex-1 overflow-hidden rounded-lg border border-border bg-background shadow-sm">
            {/*
             * `src` COMES FROM THE SERVER, BUILT FROM THE CONFIGURED ROOT
             * DOMAIN (Pitfall 12). Reading a host from the browser would bind
             * the wrong port in development — `npm run dev` serves 3001 while
             * every example env file says 3000 — and the failure would look
             * like a broken protocol rather than a mismatched port.
             *
             * The `key` is the reload control: bumping it remounts the element,
             * which reloads the document without touching the draft.
             */}
            <iframe
              key={reloadNonce}
              ref={iframeRef}
              src={previewUrl}
              title={strings.editor.previewFrameTitle}
              className={cn(
                "border-0 transition-opacity duration-200",
                phase === "ready" ? "opacity-100" : "opacity-0",
                viewport === "mobile"
                  ? "mx-auto block h-[844px] max-h-full w-[390px] max-w-full"
                  : "h-full w-full",
              )}
            />

            {phase === "loading" ? (
              /*
               * THE FLAGSHIP'S OWN SHAPE, NOT A SPINNER — one tall block for the
               * hero, a short band for the trust bar, a 2x2 tile grid for the
               * products. A silhouette that matches what is about to appear
               * tells the merchant the pane is loading THEIR storefront; a
               * spinner tells them only that something is happening.
               */
              <div className="absolute inset-0 flex flex-col gap-4 bg-background p-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-10 w-full" />
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-32 w-full" />
                  ))}
                </div>
                <p
                  role="status"
                  aria-live="polite"
                  className="text-sm leading-normal text-muted-foreground"
                >
                  {strings.editor.previewLoading}
                </p>
              </div>
            ) : null}

            {phase === "timeout" ? (
              /*
               * A PLAIN `alert`, NOT A DESTRUCTIVE ONE. Nothing was lost: the
               * draft is in this component and the reload below only remounts
               * the iframe. Colouring this as an error would tell the merchant
               * their work is in danger, which is the opposite of true.
               */
              <div className="absolute inset-0 flex flex-col items-start gap-4 bg-background p-4">
                <Alert>
                  <Info aria-hidden="true" />
                  <AlertDescription>
                    {strings.editor.previewTimeout}
                  </AlertDescription>
                </Alert>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={reloadPreview}
                >
                  <RotateCcw aria-hidden="true" />
                  {strings.editor.reloadPreview}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
