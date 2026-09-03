---
phase: 04-theme-section-block-system-flagship-template
plan: 12
subsystem: editor-chrome
tags: [client-island, props-driven, editor, rail, field-renderer, publish-bar, a11y, surface-3]

# Dependency graph
requires:
  - phase: 04-theme-section-block-system-flagship-template
    plan: 02
    provides: "src/lib/editor/reducer.ts — the EditorAction shape these callbacks feed; src/lib/theme-defaults.ts — DEFAULT_PRIMARY_ACCENT; src/lib/contrast.ts — contrastRatio / CONTRAST_TEXT; src/server/theming/schema.ts — hexColorSchema, PageDocument, ThemeTokens, SectionType"
  - phase: 04-theme-section-block-system-flagship-template
    plan: 04
    provides: "strings.editor.* and strings.branding.* — every label and sentence these four render"
  - phase: 04-theme-section-block-system-flagship-template
    plan: 06
    provides: "src/server/theming/registry.ts — FieldDescriptor / SECTION_TYPES / THEME_FIELDS, consumed as a TYPE only (the module is server-only; descriptors arrive as plain data props)"
  - phase: 04-theme-section-block-system-flagship-template
    plan: 09
    provides: "saveDraft / publishStorefront / discardDraft and their ActionResult shapes"
  - phase: 03-product-catalog-order-payment-claim-state-machine
    provides: "src/app/(dashboard)/dashboard/products/image-gallery-field.tsx — the presign -> PUT -> finalize sequence the image kind reuses structurally; product-row-actions.tsx's alert-dialog + ActionResult shape; products/page.tsx's 'the disabled CTA is courtesy only' header"
provides:
  - "src/app/(dashboard)/dashboard/storefront-editor/section-list.tsx — SectionList, SectionListProps, SectionListEntry"
  - "src/app/(dashboard)/dashboard/storefront-editor/field-renderer.tsx — FieldRenderer, FieldRendererProps"
  - "src/app/(dashboard)/dashboard/storefront-editor/settings-panel.tsx — SettingsPanel, SettingsPanelProps, repeatableFieldKey, REPEATABLE_KEY_SEPARATOR"
  - "src/app/(dashboard)/dashboard/storefront-editor/publish-bar.tsx — PublishBar, PublishBarProps, DiscardedState"
affects: [04-15-editor-shell]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interface-first client islands: four props-driven components written BEFORE the shell that owns their state, so every draft transition is forced through editorReducer where a node-only Vitest can reach it"
    - "A type-only import of a `server-only` module (`FieldDescriptor` from registry.ts) — the type crosses the boundary, the module never does; the values arrive as plain data props from the RSC"
    - "Exhaustive `switch` with no `default` used a third time in this phase (reducer, section renderer, field renderer) so a widened union is a compile error rather than a silently wrong control"
    - "A live region keyed by a nonce, so an announcement whose text repeats verbatim still mutates the DOM and is still spoken"
    - "Header comments that deliberately DO NOT spell an identifier an acceptance grep audits — the `registry.ts` precedent, applied to `brand-accent`, `data-surface`, `debounce`/`setTimeout` and `optimistic`"

key-files:
  created:
    - src/app/(dashboard)/dashboard/storefront-editor/section-list.tsx
    - src/app/(dashboard)/dashboard/storefront-editor/field-renderer.tsx
    - src/app/(dashboard)/dashboard/storefront-editor/settings-panel.tsx
    - src/app/(dashboard)/dashboard/storefront-editor/publish-bar.tsx
  modified: []

key-decisions:
  - "SECTION_ICONS lives in section-list.tsx, not in the server-only registry: a Record<SectionType, LucideIcon> is a React value, and 04-06's header rules that icon identities leave that module as lucide NAME strings so it never imports React"
  - "SettingsPanel gained one optional `repeatable` prop beyond the plan's declared list — the plan's own action paragraph requires the trust-bar's blocks to repeat per item, and the declared props gave the panel no way to know a section was repeatable"
  - "PublishBar gained one required `storefrontUrl` prop — the View store toast action needs an absolute address, and Pitfall 12 forbids deriving it from window.location.host"
  - "A failed discard falls back to strings.editor.saveFailed and prefers the server's own sentence when there is one; the entitlement refusal (the case that actually happens) therefore reads identically to the notice above it"
  - "The Starter notice renders as the first child of the bar's column, which is 'inside the region' at >=md and 'directly above it' once the region docks to the viewport bottom — one render satisfying both readings of the contract"

requirements-completed: [EDIT-02, EDIT-03]

# Metrics
metrics:
  duration: ~50 min
  completed: 2026-09-03
  tasks: 3
  files-created: 4
  files-modified: 0
  commits: 3
  tests-added: 0
  tests-total: 566
---

# Phase 4 Plan 12: Editor Rail, Field Kinds & Publish Bar Summary

**Four props-driven client islands built ahead of the shell that will own them: a rail whose disabled reorder edges mirror the reducer's no-ops and which renders nothing at all for add or remove, six field kinds behind one exhaustive switch that dispatches on every keystroke, and a publish bar where a post-trial Starter merchant reads why they cannot save instead of finding a dead button.**

## Performance

- **Duration:** ~50 min (including worktree environment repair)
- **Tasks:** 3 · **Files created:** 4 · **modified:** 0

## What Was Built

**`section-list.tsx`** — the rail's list view. A `Theme` group holding the `Brand & logo` row, a `Sections` group holding the five fixed rows, and the footnote that tells the merchant in words what the code enforces. Each row is a 44px select target plus two 44px `chevron-up` / `chevron-down` controls; the first row's up and the last row's down are `disabled`, mirroring `editorReducer`'s D-05 no-ops without ever enforcing them. The selected row carries `bg-accent`, a 2px `border-primary` left rule (`--primary`'s one new reserved use, which does not fill the row) and `aria-current` — colour is never the only signal. A `role="status" aria-live="polite"` region announces `{Section} moved to position {n} of {total}.` after each move.

**`field-renderer.tsx`** — one `switch (descriptor.kind)`, six arms, no `default`. Every arm renders a visible `<label>`, a `min-h-11` control and the registry's helper where one is declared. `text` and `textarea` carry an `{n}/{max}` counter that turns destructive at the cap; `link` carries the `link` icon adornment and rejects a `/s/`-prefixed path with its own message; `image` reuses the presign → browser PUT → finalize sequence across four states and emits a `storageKey`, never a URL; `color` is the onboarding field verbatim, including the sample chip and the non-blocking D-11 warning on the primary accent only; `select` reads its options and their copy from the descriptor.

**`settings-panel.tsx`** — the push/pop panel. Back row, `font-heading` title, a `notice` slot above the fields, then `fields` in array order with no sort. For `trust-bar` the per-item descriptors repeat once per block, each emitting an index-qualified key (`blocks.0.icon`) built by the exported `repeatableFieldKey` so the shell splits on the same rule it was written with.

**`publish-bar.tsx`** — sticky to the editor region's top at `≥md` and to the viewport bottom below it. Status line with the `bg-primary` dot on `Unsaved changes`; `Discard` (ghost) · `Save` (outline) · `Publish` (the one primary). Discard is behind a destructive `alert-dialog`; publish success is a `sonner` toast with a `View store` action; every refusal is a destructive `alert` in the same region, never a toast alone. When `canEditStorefront` is false, Save and Publish are disabled **and** a non-destructive alert renders `strings.editor.starterViewOnly` with an inline `See plans` link.

## Key Decisions

**The section icons live at the `.tsx` boundary.** `src/server/theming/registry.ts` carries `server-only` and its own header records that icon identities leave it as lucide *name* strings precisely so a server module never imports React (the same split `INDUSTRY_SEGMENT_ICONS` documents). A `Record<SectionType, LucideIcon>` is a React value, so it is declared in `section-list.tsx` — and typed against `SectionType`, so a sixth member added to the Zod union is a compile error there rather than a row that renders with no glyph.

**The live region is keyed by a nonce.** A live region reports DOM mutations. Moving a section up and straight back down produces a byte-identical sentence, React does not touch the text node, and the second move is silent. The announcement element is keyed so React replaces it either way.

**The announced position is read from the props, not computed at click time.** The parent reorders first, so by the time the region renders, `sections` already holds the new order — the announcement and the list cannot disagree about where the section went.

**Every audited identifier is left unspelled in the headers.** Four of this plan's acceptance criteria are `grep -c` counts that a header comment explaining the prohibition would trip: `brand-accent`, `data-surface`, `debounce`/`setTimeout`, `optimistic`. Each header now states the rule and says explicitly that the identifier is omitted because the audit for it is a plain grep — the precedent `registry.ts` set in plan 04-06 and `actions.ts` followed in 04-09.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Environment repair — the worktree shipped with no dependencies**

- **Found during:** Setup, before Task 1
- **Issue:** No `node_modules`, no `src/generated/prisma`, no `.env.local` / `.env.test`, no `.next/types` — all gitignored and therefore absent from the branch. Nothing could be typechecked, linted, tested or built. As 04-09 also found, `robocopy` invoked from Git Bash mangles `/E` into a path unless `MSYS_NO_PATHCONV=1` is set, and the first copy silently no-op'd.
- **Fix:** `MSYS_NO_PATHCONV=1 robocopy … /E` for `node_modules` and `src/generated` (a filesystem copy, **no registry fetch** — this plan installs nothing, preserving T-04-SC), `cp` for the two env files, then `SKIP_ENV_VALIDATION=1 npx next typegen`. A real copy rather than a junction, per 04-01's finding that a junction breaks Turbopack's build. A clean baseline `npm run typecheck` was confirmed green before any code was written.
- **Files modified:** none tracked (all four paths are gitignored)

**2. [Rule 2 - Missing functionality] `SettingsPanel` gained an optional `repeatable` prop**

- **Found during:** Task 2
- **Issue:** The task's action paragraph requires the trust-bar's `blocks` to "render as the per-item descriptors repeated once per block, using an index-qualified `onChange` key". The props list declared immediately above it gives the panel no way to know a section is repeatable: `fields` describes one item and `values` is an opaque `Record<string, unknown>`. Detecting it by sniffing `values` for an array would be magic that breaks the moment a scalar array field is added.
- **Fix:** Added `readonly repeatable?: string`, carrying `SECTION_TYPES[type].repeatable`. Optional, so a caller that only knows about the scalar case is unaffected, and documented at the prop with the D-06 reasoning. The panel does **not** rebuild the array itself — it emits `blocks.{index}.{key}` via the exported `repeatableFieldKey` and the shell rebuilds and dispatches one whole-array `set-field`, because `set-field` replaces a settings key outright (Pitfall 8) and a second copy of that write semantics in an untestable component is exactly what this plan exists to prevent.
- **Files modified:** `src/app/(dashboard)/dashboard/storefront-editor/settings-panel.tsx`
- **Commit:** `6c1c4b7`

**3. [Rule 2 - Missing functionality] `PublishBar` gained a required `storefrontUrl` prop**

- **Found during:** Task 3
- **Issue:** The publish-success toast carries a `View store` action "opening the storefront in a new tab", but the declared props carry no address. The only in-component source would be `window.location.host`, which 04-UI-SPEC.md Pitfall 12 rules out by name: dev binds port 3001 while `NEXT_PUBLIC_ROOT_DOMAIN` says 3000, so the tab would open on a port nothing is serving.
- **Fix:** Added `readonly storefrontUrl: string`, documented at the prop as being built by the RSC from the configured root domain exactly as `/onboarding/plan` builds it. `window.open(storefrontUrl, "_blank", "noopener,noreferrer")`.
- **Files modified:** `src/app/(dashboard)/dashboard/storefront-editor/publish-bar.tsx`
- **Commit:** `5e78a5d`

**4. [Rule 2 - Missing functionality] A discard refusal is surfaced, and prefers the server's own sentence**

- **Found during:** Task 3
- **Issue:** `discardDraft` calls `assertCanEditStorefront` (plan 04-09) exactly as save and publish do, but the spec's publish-bar table disables only Save and Publish. A post-trial Starter merchant can therefore press Discard and get a refusal the plan names no copy for. Swallowing it would leave the dialog open with nothing happening.
- **Fix:** All three handlers route a `{ ok: false }` through one `refusalMessage()` helper that prefers `error.form[0]` — which for this surface **is** `strings.editor.starterViewOnly`, the same key the notice above renders, so one situation reads as one sentence whichever door the merchant came through. A thrown (network) failure falls back to `strings.editor.saveFailed` for save and discard and `strings.editor.publishRefused` for publish, with the reasoning recorded at the call site.
- **Files modified:** `src/app/(dashboard)/dashboard/storefront-editor/publish-bar.tsx`
- **Commit:** `5e78a5d`

**5. [Rule 2 - Missing functionality] `SECTION_ICONS` had to be authored**

- **Found during:** Task 1
- **Issue:** 04-UI-SPEC.md § List view requires "a section-type icon (`size-4`)" on every row, but its § Component Inventory icon list for surface 3 names only chrome glyphs (`paintbrush`, `palette`, the chevrons, …) and no per-section icons; the registry stores none either. The row was not renderable as specified.
- **Fix:** A `Readonly<Record<SectionType, LucideIcon>>` in `section-list.tsx`, drawing on vocabulary the product already uses: `shield-check` and `message-circle` are already in the storefront's own icon list (and `shield-check` is one of the trust-bar's own options), `package` is the glyph `/dashboard/products` already uses for products, plus `panel-top` for the hero and `columns-2` for the editorial split. No new package, no brand-icon set.
- **Files modified:** `src/app/(dashboard)/dashboard/storefront-editor/section-list.tsx`
- **Commit:** `0b1f37f`

**6. [Rule 3 - Blocking] Four header comments reworded so acceptance greps can pass**

- **Found during:** Tasks 2 and 3
- **Issue:** Four acceptance criteria are `grep -c` counts of `brand-accent`, `data-surface`, `debounce|setTimeout` and `optimistic` expecting **0**, while the same tasks require headers documenting those prohibitions. A guard whose own explanation trips it does not survive its first reader — the identical problem `registry.ts` hit in plan 04-06 and `actions.ts` hit in 04-09.
- **Fix:** Each header states the rule and adds a clause recording that the identifier is deliberately not spelled out because the audit for it is a plain grep. All four counts are now 0 on the committed files.
- **Files modified:** `field-renderer.tsx`, `settings-panel.tsx`, `publish-bar.tsx`
- **Commits:** `6c1c4b7`, `5e78a5d`

---

**Total deviations:** 6 auto-fixed (1 environment, 4 missing functionality, 1 blocking). No architectural changes, **zero packages installed**, no file touched outside the plan's `files_modified` list.

## Deferred Issues

**`THEME_FIELDS.logoKey` uploads into the `products` namespace.** The plan fixes the `image` arm's `FINALIZE_KIND` at `"products"` (section images are catalogue imagery), and `logoKey` is also an `image` descriptor — so a logo replaced from the editor's theme panel would be signed into the products namespace. This is harmless in Phase 4: `logoKey` is deliberately **not** part of `themeTokensSchema` (see the `THEME_FIELDS` header in `registry.ts`), so `saveDraft` cannot persist it at all this phase and the logo is written only by onboarding's `saveBranding`. Whichever plan wires the theme panel to a logo write must route it through the sibling `requestLogoUpload` action, which is a sibling and not a `kind` parameter on purpose. Recorded here rather than in `deferred-items.md` because that file does not exist on this branch and creating it from a parallel worktree would collide with the three siblings in this wave.

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` (`--max-warnings=0`) | exit 0 |
| `npm run test:unit` | exit 0 — 32 files, 566 tests passed |
| `npx vitest run --project unit tests/unit/surface-token-isolation.test.ts` | 6 passed |
| `npm run build` | exit 0 — all 23 routes compiled |
| `npm run test:full` | **not run** — plan 04-13 owns the isolation-suite verification for this wave and a second concurrent run against the shared `TEST_DATABASE_URL` branch corrupts both. This plan adds no test file, no schema change and no tenant-scoped model, so it introduces no new isolation surface. |

Acceptance-criteria greps, confirmed on the committed files:

| Grep | Expected | Actual |
|---|---|---|
| `brand-accent\|data-surface` across all four files | 0 | **0, 0, 0, 0** |
| literal colour (`#rrggbb`, `oklch(`, `rgb(`, `hsl(`) in each file | 0 | **0** everywhere |
| `add section\|remove section\|delete section\|trash` in `section-list.tsx` | 0 | **0** (zero even inside the explanatory comment) |
| `aria-current` + `border-l-2 border-primary` in `section-list.tsx` | present | **3** / **1** |
| `role="status"` + `aria-live="polite"` in `section-list.tsx` | present | **1** / **1** |
| `.splice(` / `.sort(` in `section-list.tsx` | 0 | **0** |
| `switch (descriptor.kind)` / `case` arms / `default:` | 1 / 6 / 0 | **1 / 6 / 0** |
| `DEFAULT_PRIMARY_ACCENT` imported from `@/lib/theme-defaults` | yes | **yes** |
| `debounce\|setTimeout` in `field-renderer.tsx` | 0 | **0** |
| a distinct `/s/` rejection branch in the `link` arm | present | `INTERNAL_ROUTE_PREFIX`, its own message |
| `fields.map(` in array order, no `.sort(` in `settings-panel.tsx` | yes / 0 | **yes / 0** |
| `notice` prop rendered above the fields | present | **yes** |
| `alert-dialog` used ONLY on the discard path in `publish-bar.tsx` | yes | one dialog, discard only |
| `strings.editor.starterViewOnly` + `/dashboard/plan` link | present | **2** / **1** |
| the notice is not inside a `title`/`tooltip` attribute | 0 | **0** matches for `title=` or `tooltip` |
| `useOptimistic\|optimistic` in `publish-bar.tsx` | 0 | **0** |
| `JSON.stringify` in `publish-bar.tsx` | 0 | **0** |
| `#rrggbb\|gold-accent` in `publish-bar.tsx` | 0 | **0** |

## Interfaces for Plan 04-15

```ts
// section-list.tsx
interface SectionListEntry { id: string; type: SectionType; label: string }
interface SectionListProps {
  sections: readonly SectionListEntry[];
  selectedSectionId: string | null;
  themeSelected: boolean;
  onSelectTheme: () => void;
  onSelect: (sectionId: string) => void;
  onMove: (sectionId: string, direction: "up" | "down") => void;
}
function SectionList(props: SectionListProps)

// field-renderer.tsx
interface FieldRendererProps {
  descriptor: FieldDescriptor; value: unknown; max?: number;
  imageBaseUrl: string; onChange: (value: unknown) => void;
}
function FieldRenderer(props: FieldRendererProps)

// settings-panel.tsx
const REPEATABLE_KEY_SEPARATOR = ".";
function repeatableFieldKey(arrayKey: string, index: number, fieldKey: string): string;
interface SettingsPanelProps {
  title: string; fields: readonly FieldDescriptor[];
  values: Record<string, unknown>; maxima?: Record<string, number>;
  imageBaseUrl: string; notice?: React.ReactNode; repeatable?: string;
  onBack: () => void; onChange: (key: string, value: unknown) => void;
}
function SettingsPanel(props: SettingsPanelProps)

// publish-bar.tsx
interface DiscardedState { document: PageDocument; tokens: ThemeTokens }
interface PublishBarProps {
  dirty: boolean; hasUnpublishedChanges: boolean; canEditStorefront: boolean;
  document: PageDocument; tokens: ThemeTokens; storefrontUrl: string;
  onSaved: () => void; onDiscarded: (state: DiscardedState) => void;
}
function PublishBar(props: PublishBarProps)
```

Notes for the shell:

- `onMove` maps to `move-up` / `move-down`; `onSelect` to `select`; `onSelectTheme` sets `selectedSectionId` to `null` and opens the theme panel.
- `SettingsPanel`'s `onChange(key, value)` maps to `set-field` for a section and `set-token` for the theme panel. For `trust-bar`, split the key on `.`, rebuild the whole `blocks` array, and dispatch a **single** `set-field` on `blocks` — never a deep merge.
- `maxima` should be supplied from the caps in `src/server/theming/schema.ts` (hero: `eyebrow` 60, `heading` 120, `body` 280, `ctaLabel` 30, `ctaHref` 200; trust item: `heading` 48, `body` 140; product grid: `heading` 80, `viewAllLabel` 30, `viewAllHref` 200; editorial split: as hero; contact: `heading` 80, `body` 280, `ctaLabel` 30; tokens: `announcementText` 120, `footerTagline` 160).
- `hasUnpublishedChanges` is `draftUpdatedAt > publishedAt`, both already returned by `getEditorStorefront`. Never a structural document comparison.
- `onSaved` should dispatch nothing but the `dirty` reset; `onDiscarded` should dispatch `reset` with the returned document and tokens, which already forces `dirty` false.
- These four components render no `loading.tsx`, no page shell and no navigation. The route, the sidebar item, the `REQUIRED_HREFS` entry, the preview canvas and the `toggle-group` all belong to 04-15.

## Known Stubs

None. All four components are fully implemented against real data paths — the three server actions are live, the upload sequence is the real presign/PUT/finalize, and every string is a `strings` member expression or a value passed in on props. Nothing renders a hardcoded empty collection or placeholder copy. They are not yet *mounted* anywhere, which is the plan's deliberate interface-first ordering (04-15 assembles the shell), not a stub.

## Threat Flags

None. Every threat the plan's register assigns `mitigate` is mitigated as specified:

| Threat | Mitigation as shipped |
|---|---|
| T-04-05 | The all-caps courtesy header on `publish-bar.tsx`; `canEditStorefront === false` disables Save and Publish **and** renders a visible notice, while `saveDraft` / `publishStorefront` refuse independently server-side. |
| T-04-05b | The branch is on `canEditStorefront`, never on a plan tier. The header states the D-15 trap in full so the naive fix is not made later. |
| T-04-09 | The chip's value clears `hexColorSchema` (the same anchored regex the server applies) before it reaches `style`, and the chip is the only element on surface 3 that takes a merchant colour. |
| T-04-07 | The `link` arm rejects a `/s/`-prefixed value with its own message and a `aria-invalid` input, rather than accepting a guaranteed-dead link. |
| T-04-02 | All four files are scanned by bans 1, 2 and 6; every criterion grep returns 0. |
| T-04-29 | `Discard` is the only action behind an `alert-dialog`, with a destructive confirm, and it is the only dialog in the file. |
| T-04-30 | No result is painted before the server agrees; every refusal is a destructive `alert` in the same region, never a toast alone. |
| T-04-SC | Zero packages installed. `sonner`, `alert-dialog`, `select`, `textarea`, `alert` and `label` were all already present. |

No new network endpoint, auth path or schema change. The one new outbound call is the finalize `POST` the products gallery already makes, to the same route with the same body shape.

## Self-Check: PASSED

Files verified present on disk:

- `src/app/(dashboard)/dashboard/storefront-editor/section-list.tsx` — FOUND
- `src/app/(dashboard)/dashboard/storefront-editor/field-renderer.tsx` — FOUND
- `src/app/(dashboard)/dashboard/storefront-editor/settings-panel.tsx` — FOUND
- `src/app/(dashboard)/dashboard/storefront-editor/publish-bar.tsx` — FOUND

Commits verified in this branch's history:

- `0b1f37f` feat(04-12): add the editor rail list view (EDIT-02) — FOUND
- `6c1c4b7` feat(04-12): add the six field kinds and the settings panel (EDIT-02) — FOUND
- `5e78a5d` feat(04-12): add the publish bar with the Starter view-only notice (EDIT-03) — FOUND

No modifications to `STATE.md` or `ROADMAP.md` — the orchestrator owns those after the wave merges.

---
*Phase: 04-theme-section-block-system-flagship-template*
*Completed: 2026-09-03*
