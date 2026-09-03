---
phase: 04-theme-section-block-system-flagship-template
plan: 14
subsystem: ui
tags: [postmessage, iframe, zod, react, next, theming, live-preview, security]

# Dependency graph
requires:
  - phase: 04-08
    provides: "SectionRenderer and the client-safe sections/ tree the canvas re-renders inside the iframe"
  - phase: 04-10
    provides: "The storefront layout's tenant gate, surface scope and published brand-token injection this route inherits, plus the server-built whatsappHref data bundle"
  - phase: 04-02
    provides: "pageDocumentSchema / themeTokensSchema / hexColorSchema (marker-free, client-importable) and deriveThemeCssVars"
  - phase: 04-09
    provides: "getPublishedStorefront — the initial-paint read"
provides:
  - "A public, unindexed, session-free /preview route on the tenant subdomain — the editor's iframe target"
  - "PreviewCanvas: the origin-checked, Zod-validated postMessage receiver that re-renders the storefront client-side with no network in the loop"
  - "The iframe half of the einort:preview-* protocol (ready / doc / select)"
affects: [04-15, editor chrome, any future clickjacking/CSP header work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-origin postMessage receiver: origin comparison before event.data is read, then envelope shape check, then safeParse, then setState"
    - "Draft brand tokens injected on a descendant wrapper to override the layout's published tokens for the duration of an edit"
    - "Document-level capture-phase anchor interception, so layout-rendered chrome links are inert too"

key-files:
  created:
    - "src/app/s/[slug]/preview/page.tsx"
    - "src/app/s/[slug]/preview/preview-canvas.tsx"
  modified: []

key-decisions:
  - "The anchor interception binds to the document in the capture phase rather than to the canvas wrapper, because the header and footer links are rendered by the inherited layout as siblings of this component — a wrapper-bound handler would leave exactly the links that produce a dead end live."
  - "The wrapper element is <main className=\"flex flex-1 flex-col\">, reproducing the live home page's own wrapper verbatim, so the pane cannot differ from the published store by a flex context."
  - "einort:preview-select finds its node by scanning [data-preview-section] and comparing values, never by interpolating the id into a selector — the id crossed a trust boundary two statements earlier."
  - "The document and the tokens are applied INDEPENDENTLY from one envelope: a message whose tokens parse and whose document does not still updates the colours, so one bad section cannot blank the whole preview."
  - "revealSection is a useCallback outside the effect rather than a function declared inside it, keeping the state updates clear of react-hooks/set-state-in-effect (the rule src/hooks/use-mobile.ts was rewritten to satisfy)."
  - "No ?category= filter on the preview: anchors inside it are inert by design, so nothing in the document can set one. Reading a parameter nothing can write would be dead plumbing."

patterns-established:
  - "Pattern: a public route whose missing session is a documented architectural requirement, not an oversight — stated in an all-caps header block with the reason a gate would break it."
  - "Pattern: validate a colour on write AND again on read, immediately before it reaches a style object, because React writes custom properties through setProperty and does not sanitise."

requirements-completed: [EDIT-02]

# Metrics
duration: 42min
completed: 2026-09-03
---

# Phase 4 Plan 14: The Preview Iframe Target Summary

**A public, unindexed `/preview` route on the tenant subdomain that paints the published storefront server-side and then re-renders from an origin-checked, Zod-validated `postMessage` draft with no network in the loop.**

## Performance

- **Duration:** ~42 min
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 0

## Accomplishments

- `/preview` exists on every tenant subdomain, inherits the storefront layout (tenant gate, surface scope, 0.25rem radius, published brand tokens) and is `robots: { index: false, follow: false }`.
- The receiver implements the four ordered mitigations exactly: `event.origin !== editorOrigin` as the **first statement**, before `event.data` is touched; an envelope shape check; `pageDocumentSchema.safeParse` / `themeTokensSchema.safeParse`; and only then a state update.
- The handshake posts `einort:preview-ready` with an **exact** `targetOrigin`, with the message listener attached before the post so the editor's first draft cannot lose a race with hydration.
- The accents are re-validated with `hexColorSchema` immediately before the `style` object, on top of the envelope parse — the second half of Pitfall 3's write-and-read rule.
- Anchors are inert on both click and `Enter` across the whole preview document, header and footer included, without touching a single section component.

## Task Commits

1. **Task 1: The /preview route — public data only, noindex, no session** — `e0d4545` (feat)
2. **Task 2: The preview canvas — origin-checked, Zod-validated, re-rendered client-side** — `85c4364` (feat)

## Files Created/Modified

- `src/app/s/[slug]/preview/page.tsx` — Server Component. Resolves the tenant from the rewritten slug, reads `getPublishedStorefront`, mirrors the home page's `StorefrontRenderData` bundle (products, categories, `imageBaseUrl`, `storeName`, server-built `whatsappHref`), computes the editor origin from `NEXT_PUBLIC_ROOT_DOMAIN`, and renders `PreviewCanvas`. No session, no token, no write.
- `src/app/s/[slug]/preview/preview-canvas.tsx` — `"use client"`. The `postMessage` receiver, the handshake, the draft-token override, the selection ring, and the document-level anchor interception.

## Security Posture (threat register dispositions)

| Threat | Disposition | How it landed |
|--------|-------------|---------------|
| T-04-08 (hostile page frames `/preview` and posts a document) | mitigated | The origin comparison is the first statement of the handler; `event.data` is first read six lines later. `editorOrigin` is computed server-side from configuration, never from anything the framed document reports about itself. A rejected payload is ignored silently rather than thrown on a render path. |
| T-04-08b (draft broadcast to an arbitrary origin) | mitigated | `window.parent.postMessage({ type: "einort:preview-ready" }, editorOrigin)` — exact `targetOrigin`. `grep -c '"\*"'` returns 0. |
| T-04-09 (draft accent reaching `setProperty`) | mitigated | `hexColorSchema.safeParse` on both accents immediately before `deriveThemeCssVars`, with the flagship defaults as the fallback. No colour literal in the file. |
| T-04-14 (preview URL indexed or shared) | mitigated | `robots: { index: false, follow: false }`. Impact nil by design regardless — the route serves only already-public data. |
| T-04-14b (a future blanket clickjacking header) | mitigated | Recorded in an all-caps header block on the route, with the correct replacement (`frame-ancestors https://{ROOT_DOMAIN}`). No CSP or frame header was added — explicitly out of scope. |
| T-04-32 (session cookie reaching the preview origin) | mitigated | No session is read anywhere on this route, and no code in this plan touches the cookie's `Domain`. |
| T-04-11 (write amplification on a public route) | mitigated | No `create`/`update`/`upsert`/`delete` on the route; `getPublishedStorefront` already degrades to defaults for an unseeded store. |
| T-04-33 (navigating the preview into a dead end) | mitigated | Click and `Enter` intercepted at the document in the capture phase; anchors render `cursor-default`. |

## Decisions Made

See `key-decisions` in the frontmatter. The two most consequential:

**The anchor interception is bound to the document, not to the canvas wrapper.** The plan's action text said "implement it at the wrapper with a delegated handler". A wrapper-bound handler is delegated, but it only covers the sections — the announcement bar, header and footer are rendered by `src/app/s/[slug]/layout.tsx` as siblings of this component, so the store wordmark and every footer link would have stayed live and navigated the pane to a page the editor cannot get back from. Binding to the document in the capture phase satisfies the same "delegated rather than rewriting every anchor" constraint and actually delivers 04-UI-SPEC.md's stated goal ("preserves full visual fidelity of the header/footer links without producing a dead-end"). The `cursor-default` rule follows the same path: a Tailwind arbitrary variant applied to the wrapper (so the literal is scanned and the rule is emitted) and added to `<body>` by the effect (so it reaches the chrome).

**`revealSection` is a `useCallback`, not a function inside the effect.** Both state setters and the timer ref are stable, so the identity never changes and the handshake effect still runs exactly once per `editorOrigin`. This keeps the selection state updates out of an effect body, where `react-hooks/set-state-in-effect` runs at `--max-warnings=0`.

## Deviations from Plan

None that changed scope. Two implementation details differ from the plan's literal wording, both documented above and in the source: the interception is bound at the document rather than the wrapper (to reach the layout-rendered chrome the spec explicitly names), and the wrapper element is `<main>` rather than a bare `<div>` (to reproduce the live home page's flex context exactly). Neither weakens a threat mitigation; the first strengthens T-04-33.

## Issues Encountered

The worktree spawned without `node_modules`, `src/generated/prisma`, `.env.local` or `.env.test` — all gitignored. Restored by copying from the main checkout at `D:\Maxs\Claude\einort-commerce` before running the verification gates. Expected environment repair, not a code problem, and nothing in it is committed.

## Verification

| Gate | Result |
|------|--------|
| `npm run build` | Pass — `/s/[slug]/preview` listed as a dynamic route |
| `npm run lint` (`--max-warnings=0`) | Pass |
| `npm run typecheck` | Pass |
| `npm run test:unit` | Pass — 32 files, 566 tests, including all six `surface-token-isolation` bans |

Every acceptance grep in the plan was run against the two files and returned the required count: no session helper, no write, no `window.location`, no `data-surface`, no wildcard `targetOrigin`, no strict `.parse(`, no deserialise-and-trust, no colour literal; `robots`, the `localhost` protocol switch, the `frame-ancestors 'none'` prohibition sentence, both `safeParse` calls, `hexColorSchema`, `preventDefault` on both the click and keydown paths, and `prefers-reduced-motion` all present.

Not covered by an automated gate: the manual dev smoke (`http://{slug}.localhost:3001/preview`) and the end-to-end handshake, which cannot be exercised until plan 04-15 ships the sender.

## Known Stubs

None. Every prop the canvas receives is wired to real data, and every branch of the protocol this plan owns is implemented.

## Next Phase Readiness

Ready for plan 04-15 (the editor and the sender half of the protocol). The contract it must honour:

- Frame `{protocol}://{slug}.{rootDomain}/preview`, with the URL built from the configured root domain and the same `startsWith("localhost")` protocol switch — never from the browser's own address.
- Hold the first `einort:preview-doc` until `einort:preview-ready` arrives from the iframe.
- Post `{ type: "einort:preview-doc", document, tokens }` and `{ type: "einort:preview-select", sectionId }` with an **exact** `targetOrigin` of `{protocol}://{slug}.{rootDomain}` — never `"*"`.
- Expect `einort:preview-ready` to arrive from the subdomain origin; validate it on the editor side symmetrically.

One open item for the first deploy: Vercel project settings are outside this repository and were not inspected. Confirm no platform-level `X-Frame-Options` / `frame-ancestors` header is being injected, or the preview pane will be blank in production while working locally (assumption A4 in 04-RESEARCH.md).

## Self-Check: PASSED

- `src/app/s/[slug]/preview/page.tsx` — FOUND
- `src/app/s/[slug]/preview/preview-canvas.tsx` — FOUND
- `e0d4545` — FOUND
- `85c4364` — FOUND
- Working tree clean; no shared orchestrator artifact (`STATE.md`, `ROADMAP.md`) was touched.

---
*Phase: 04-theme-section-block-system-flagship-template*
*Completed: 2026-09-03*
