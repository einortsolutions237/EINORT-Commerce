"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  DEFAULT_PRIMARY_ACCENT,
  DEFAULT_SECONDARY_ACCENT,
  deriveThemeCssVars,
} from "@/lib/theme-defaults";
import { cn } from "@/lib/utils";
import {
  hexColorSchema,
  pageDocumentSchema,
  themeTokensSchema,
  type PageDocument,
  type ThemeTokens,
} from "@/server/theming/schema";

import type { StorefrontRenderData } from "../sections/render-data";
import { SectionRenderer } from "../sections/section-renderer";

/**
 * The preview receiver (EDIT-02, D-07) — 04-RESEARCH.md Pattern 4, the iframe
 * half of the protocol. Plan 04-15 writes the editor half.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS GENUINELY INSTANT, AND WHY THAT MATTERS HERE SPECIFICALLY.
 * ---------------------------------------------------------------------------
 * A `postMessage` between two documents in the same browser is a
 * structured-clone hop measured in microseconds, and React re-renders a
 * five-section tree inside a frame. THERE IS NO NETWORK IN THE LOOP AT ALL —
 * a stronger guarantee than Shopify's own theme editor, which re-renders a
 * section server-side on every settings change. On a Douala mobile connection
 * a per-keystroke round trip is not "instant" under any definition, so the
 * client-render approach is not merely simpler: it is the only shape that
 * satisfies D-07 on the network this product is built for.
 *
 * The corollary is that the merchant's DRAFT never touches the server while
 * they are typing. It lives in their own browser and travels only between two
 * documents that browser already has open, which is also why the route above
 * this component needs no session (see `page.tsx`).
 *
 * ---------------------------------------------------------------------------
 * THE MESSAGE HANDLER'S FOUR STEPS ARE ORDERED. REORDERING THEM DEFEATS THE
 * EARLIER ONES.
 * ---------------------------------------------------------------------------
 *   1. The origin comparison, FIRST, before the payload is touched at all.
 *   2. A shape check on the envelope — object, non-null, a known `type`.
 *   3. `safeParse` against the real schemas.
 *   4. Only then a state update.
 *
 * Each is a separate mitigation for a separate threat, documented at the line
 * that implements it. Step 1 without step 3 trusts a compromised editor tab;
 * step 3 without step 1 lets any page that frames this document repaint the
 * merchant's store in front of them. Both are required.
 *
 * A REJECTED MESSAGE IS IGNORED SILENTLY, NOT THROWN. This is a render path:
 * `src/server/entitlements/resolve.ts` takes the same posture for an unknown
 * plan tier, and `src/server/theming/queries.ts` for an unparseable document.
 * A preview that goes white because something posted junk at it is strictly
 * worse than a preview that keeps showing the last good state.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS COMPONENT DELIBERATELY DOES NOT DO.
 * ---------------------------------------------------------------------------
 * CLICKING A SECTION DOES NOT SELECT IT THIS PHASE. The editor's rail is the
 * only selection surface (04-UI-SPEC.md § Preview canvas). Stated here so the
 * absence reads as a decision rather than as something half-built: a
 * click-to-select that works for four of five sections is worse than a rail
 * that works for all of them.
 *
 * It also renders no chrome. The announcement bar, header and footer come from
 * the inherited storefront layout, along with the surface scope and the
 * PUBLISHED brand tokens — this component overrides only the five accent
 * values, and only for the duration of a draft.
 */

/**
 * The two envelope types this document accepts, and nothing else.
 *
 * A closed list rather than a prefix test on `"einort:"`: a prefix would keep
 * accepting message types that a later phase adds to the editor without a
 * matching handler here, which is a silent no-op rather than a refusal.
 */
const PREVIEW_DOC_MESSAGE = "einort:preview-doc";
const PREVIEW_SELECT_MESSAGE = "einort:preview-select";

/** The iframe's half of the handshake. */
const PREVIEW_READY_MESSAGE = "einort:preview-ready";

/** How long the selection ring stays drawn before it fades out. */
const SELECTION_RING_MS = 2000;

/**
 * The attribute that lets a `preview-select` message find a rendered section.
 *
 * A data attribute rather than a DOM `id`: the value is merchant-authored and
 * arrives over `postMessage`, and an `id` on a public page is addressable by a
 * URL fragment and collides with anything the section components already name.
 *
 * The name is spelled twice — here, for the lookup, and literally in the JSX
 * below, because a computed key cannot be written as a plain JSX attribute.
 * They must move together; a rename in one place alone silently breaks
 * selection sync while every test stays green.
 */
const SECTION_ATTRIBUTE = "data-preview-section";

/**
 * Every anchor in this DOCUMENT renders with a default cursor, because none of
 * them navigates (see the interception effect below).
 *
 * Written as a Tailwind arbitrary variant on a wrapper rather than as a class
 * on each anchor: the header and footer links are rendered by the inherited
 * layout, above this component, so there is no call site here to change. The
 * literal is also what makes Tailwind emit the rule at build time — it is
 * applied to `<body>` by the effect below, which is not a source location the
 * scanner can see.
 */
const INERT_ANCHOR_CLASS = "[&_a]:cursor-default";

export type PreviewCanvasProps = {
  /** The PUBLISHED document, so the first paint is never a blank pane. */
  readonly initialDocument: PageDocument;
  /** The PUBLISHED tokens, replaced by the draft's on the first message. */
  readonly initialTokens: ThemeTokens;
  readonly data: StorefrontRenderData;
  /** The apex origin, computed server-side from configuration. Never a wildcard. */
  readonly editorOrigin: string;
};

/**
 * The anchor an event landed inside, if any.
 *
 * `instanceof Element` rather than a cast: a document-level listener can be
 * handed a target that is not an element at all, and `closest` on it throws.
 */
function anchorFrom(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLAnchorElement>("a[href]");
}

export function PreviewCanvas({
  initialDocument,
  initialTokens,
  data,
  editorOrigin,
}: PreviewCanvasProps) {
  /*
   * Seeded from the published props, so the pane shows the merchant's real
   * store from the first frame and swaps to their draft when the editor's
   * first message lands. Named `pageDocument` rather than `document` on
   * purpose: the selection handler below needs the global `document`, and a
   * state variable of that name would shadow it in exactly the scope that
   * reads it.
   */
  const [pageDocument, setPageDocument] = useState(initialDocument);
  const [tokens, setTokens] = useState(initialTokens);
  const [highlightedSectionId, setHighlightedSectionId] = useState<
    string | null
  >(null);

  /** The pending ring-fade timer, so a second selection cancels the first. */
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Scroll a section into view and ring it for two seconds.
   *
   * The node is found by SCANNING the tagged elements rather than by building
   * a selector string from `sectionId`: the id crossed a trust boundary a few
   * lines before this runs, and interpolating it into a query would let a
   * crafted value select something else entirely. A comparison cannot be
   * escaped wrong. The attribute NAME is interpolated, which is safe because
   * it is a module constant — only the value is untrusted.
   *
   * The `behavior` branch is not redundant with the reduced-motion block in
   * `globals.css`: that block overrides the CSS `scroll-behavior` property,
   * which has no effect at all on the option passed to this method.
   *
   * `useCallback` with no dependencies rather than a function declared inside
   * the effect below. Both setters and the ref are stable, so the identity
   * never changes and the handshake effect still runs exactly once — and the
   * state updates stay out of an effect body, where
   * `react-hooks/set-state-in-effect` correctly objects to them (the same rule
   * `src/hooks/use-mobile.ts` was rewritten to satisfy).
   */
  const revealSection = useCallback((sectionId: string) => {
    const nodes = window.document.querySelectorAll(`[${SECTION_ATTRIBUTE}]`);
    let match: Element | null = null;
    for (const node of nodes) {
      if (node.getAttribute(SECTION_ATTRIBUTE) === sectionId) {
        match = node;
        break;
      }
    }
    if (!match) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    match.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });

    setHighlightedSectionId(sectionId);
    if (ringTimer.current !== null) clearTimeout(ringTimer.current);
    ringTimer.current = setTimeout(() => {
      setHighlightedSectionId(null);
      ringTimer.current = null;
    }, SELECTION_RING_MS);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      /*
       * STEP 1 — THE ORIGIN CHECK, AND IT IS THE FIRST STATEMENT IN THIS
       * FUNCTION ON PURPOSE (Pitfall 4, T-04-08).
       *
       * `event.data` is NOT read above this line and must never be. A
       * `postMessage` handler that inspects the payload before the origin
       * accepts a document from any page that frames this route — which is any
       * page at all, since there is deliberately no frame-ancestors header
       * (see `page.tsx`). `editorOrigin` was computed on the server from
       * configuration, never from anything the framed document reports about
       * itself, so it cannot be influenced by whoever did the framing.
       */
      if (event.origin !== editorOrigin) return;

      /*
       * STEP 2 — the envelope's shape, before its contents mean anything.
       * `typeof null === "object"`, hence the explicit null test.
       */
      const envelope: unknown = event.data;
      if (typeof envelope !== "object" || envelope === null) return;

      const type = (envelope as { type?: unknown }).type;
      if (type !== PREVIEW_DOC_MESSAGE && type !== PREVIEW_SELECT_MESSAGE) {
        return;
      }

      if (type === PREVIEW_SELECT_MESSAGE) {
        const sectionId = (envelope as { sectionId?: unknown }).sectionId;
        if (typeof sectionId !== "string") return;
        revealSection(sectionId);
        return;
      }

      /*
       * STEP 3 — the real schemas, `safeParse`, never deserialise-and-trust.
       *
       * The payload arrived as a structured clone, so it is already a live
       * object graph rather than a string: there is nothing to deserialise and
       * everything to validate. Each half is applied INDEPENDENTLY — a message
       * whose tokens are valid and whose document is not still updates the
       * colours, because refusing both would make one bad section blank a
       * merchant's whole preview.
       */
      const parsedDocument = pageDocumentSchema.safeParse(
        (envelope as { document?: unknown }).document,
      );
      const parsedTokens = themeTokensSchema.safeParse(
        (envelope as { tokens?: unknown }).tokens,
      );

      // STEP 4 — and only now.
      if (parsedDocument.success) setPageDocument(parsedDocument.data);
      if (parsedTokens.success) setTokens(parsedTokens.data);
    }

    /*
     * THE LISTENER IS ATTACHED BEFORE THE HANDSHAKE IS POSTED, AND THE ORDER
     * IS THE MITIGATION FOR A RACE, NOT A STYLE CHOICE.
     *
     * The editor holds its first document post until `preview-ready` arrives,
     * so announcing readiness before this document can hear the reply would
     * drop the merchant's first draft on the floor — a preview stuck on the
     * published store while the rail insists it changed something.
     *
     * The `targetOrigin` is EXACT and must never become a wildcard
     * (T-04-08b): the reverse direction carries the merchant's unpublished
     * draft, and a wildcard would hand it to whatever page happened to be
     * framing this one.
     */
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: PREVIEW_READY_MESSAGE }, editorOrigin);

    return () => window.removeEventListener("message", onMessage);
  }, [editorOrigin, revealSection]);

  /*
   * NAVIGATION IS INTERCEPTED FOR THE WHOLE DOCUMENT (04-UI-SPEC.md § Preview
   * canvas → "Navigation is intercepted", T-04-33).
   *
   * Anchor activation — click AND `Enter` — is prevented and does nothing. The
   * merchant cannot navigate the preview away from the home document this
   * phase, which preserves the full visual fidelity of every header, footer
   * and section link without producing a dead end inside a 320px-wide pane.
   *
   * Bound to the DOCUMENT in the capture phase, not to the wrapper below. The
   * chrome links are rendered by the inherited layout, as SIBLINGS of this
   * component — a handler on the wrapper would leave the header wordmark and
   * the footer links live, which is precisely the dead end this exists to
   * prevent. Capture also means the handler runs before anything a section
   * attaches, so it cannot be beaten by a stopped propagation.
   *
   * Delegated rather than rewritten into each section: the sections are shared
   * verbatim with the live storefront, where those links must work.
   */
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (anchorFrom(event.target)) event.preventDefault();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter") return;
      if (anchorFrom(event.target)) event.preventDefault();
    }

    const body = window.document.body;
    body.classList.add(INERT_ANCHOR_CLASS);
    window.document.addEventListener("click", onClick, true);
    window.document.addEventListener("keydown", onKeyDown, true);

    return () => {
      body.classList.remove(INERT_ANCHOR_CLASS);
      window.document.removeEventListener("click", onClick, true);
      window.document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  /** The ring timer outlives a fast unmount otherwise. */
  useEffect(() => {
    return () => {
      if (ringTimer.current !== null) clearTimeout(ringTimer.current);
    };
  }, []);

  /*
   * PITFALL 3 / T-04-09 — THE ACCENTS ARE VALIDATED A SECOND TIME, HERE,
   * IMMEDIATELY BEFORE THEY REACH A `style` OBJECT.
   *
   * This is NOT redundant with the `themeTokensSchema.safeParse` above. That
   * parse validated the ENVELOPE, once, at the moment a message arrived; this
   * one guards the RENDER, on every pass, including the very first one from
   * server props. React writes a custom property through `setProperty`, which
   * does not sanitise, so `red; background-image: url(https://evil/x)` is
   * stopped here and nowhere else downstream (ASVS V5). Pitfall 3 asks for
   * validation on write AND on read; this is the read.
   *
   * `safeParse` with a fallback rather than a strict parse, and the wording is
   * `src/app/s/[slug]/layout.tsx`'s because the rule is the same one: a render
   * path must never throw over a colour.
   *
   * THIS LINE CONTAINS NO COLOUR LITERAL. Every value is a variable, which is
   * what keeps ban #1 green; the constants live in `src/lib/theme-defaults.ts`,
   * a directory that ban does not scan, for exactly this reason.
   */
  const primaryAccent = hexColorSchema.safeParse(tokens.primaryAccent);
  const secondaryAccent = hexColorSchema.safeParse(tokens.secondaryAccent);

  const themeVars = deriveThemeCssVars({
    primaryAccent: primaryAccent.success
      ? primaryAccent.data
      : DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: secondaryAccent.success
      ? secondaryAccent.data
      : DEFAULT_SECONDARY_ACCENT,
  });

  /*
   * The wrapper's token values OVERRIDE the layout's for the duration of the
   * draft — the layout injected the PUBLISHED accents on an ancestor, and a
   * custom property set closer to the element wins. That is the whole
   * mechanism by which a colour change appears instantly with no server round
   * trip, and it is why the draft accents are never persisted to see them.
   *
   * `<main className="flex flex-1 flex-col">` is the live home page's own
   * wrapper, reproduced exactly: the preview's job is to be indistinguishable
   * from the storefront, so a different flex context here would show up as a
   * layout difference between the pane and the published store.
   */
  return (
    <main
      className={cn("flex flex-1 flex-col", INERT_ANCHOR_CLASS)}
      style={themeVars as CSSProperties}
    >
      {pageDocument.sections.map((section) => (
        /*
         * The ring is drawn on a wrapper rather than on the section itself:
         * the sections are shared verbatim with the live storefront and must
         * not grow an editor-only prop. `outline` takes no space in the box
         * model, and `outline-offset-[-2px]` pulls it inside the bounds, so a
         * highlighted section does not shift a single pixel of the layout the
         * merchant is judging. `outline-ring` is zinc-400 in this scope, which
         * is visible on both the white sections and the ink editorial band —
         * the reason it is a ring rather than a fill.
         */
        <div
          key={section.id}
          data-preview-section={section.id}
          className={cn(
            "outline-2 outline-offset-[-2px] transition-[outline-color] duration-300",
            section.id === highlightedSectionId
              ? "outline-ring"
              : "outline-transparent",
          )}
        >
          <SectionRenderer section={section} data={data} />
        </div>
      ))}
    </main>
  );
}
