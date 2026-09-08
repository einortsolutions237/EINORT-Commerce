# Quick Task 260908-bv1: Restructure "Change template" Panel Layout - Research

**Researched:** 2026-09-08
**Domain:** React/Next.js client component restructuring (dashboard editor surface, existing design system, no new dependencies)
**Confidence:** HIGH

## Summary

This is a pure presentation-layer restructuring of one already-shipped panel (`change-template-panel.tsx` + `template-picker.tsx`). No new packages, no new server logic, no schema change. The RSC's tile-flattening function (`editorTemplateTiles` in `page.tsx`) does not need to change at all — it keeps producing the same `TemplateTile[]` (tier-accessible set plus the retained current key if a downgrade put it above tier), preserving every existing invariant (`tiles.length`, the D-05 sort-never-filter guarantee, the T-05-32/T-05-35 threat mitigations). The restructuring happens entirely in the client components that consume that array: a new small "spotlight" component renders the current template on its own, and `ChangeTemplatePanel` filters the same array before handing the remainder to the existing `<TemplatePicker>` grid.

All five focus questions below are resolved with a stated reason, grounded in the actual source and threat register — none are left open for the planner. One genuine judgment call is flagged (whether the spotlight card carries a "View live store" text link) rather than silently decided, since it would be a new interactive affordance not covered by any existing decision record.

**Primary recommendation:** Keep `editorTemplateTiles` (RSC) byte-unchanged. In `ChangeTemplatePanel`, derive `spotlightTile = tiles.find(t => t.key === currentTemplateKey)` and `gridTiles = tiles.filter(t => t.key !== currentTemplateKey)`. Render a new `CurrentTemplateCard` (new file, `src/components/theming/current-template-card.tsx`) above `<TemplatePicker tiles={gridTiles} currentKey={currentTemplateKey} ... />`. Extract only the image-frame/D-05-fallback branch into a shared `TemplateMedia` component; leave everything else (badges, text block, card chrome) as two separate, intentionally different renderings, because the spotlight card's chrome is not the grid card's chrome and forcing them through one body-renderer would fight the two surfaces' real visual differences. Keep the `disabled=` / `aria-disabled` / byte-identical `onValueChange` inert-guard in `template-picker.tsx` untouched — it becomes defense-in-depth rather than dead code, and the contract test requires it to stay byte-identical regardless.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spotlight card rendering (current template) | Browser/Client (`"use client"` component) | — | Purely presentational; no data fetch, consumes props already resolved server-side |
| Switchable grid rendering (existing `TemplatePicker`) | Browser/Client | — | Unchanged component, already client-side |
| Tile data assembly (tier scoping, current-key retention, segment sort) | API/Backend (RSC, `page.tsx`) | — | `accessibleTemplateKeys`, `TEMPLATES` registry, and tier logic are all `server-only`; must stay server-side per existing `theming-marker-boundary` test |
| Template switch write (`switchTemplate`) | API/Backend (Server Action) | — | Unchanged — `assertTemplateAccess` remains the real security boundary; this task does not touch it |
| Copy/string keys | API/Backend at build time (`src/lib/strings/index.ts`), consumed client-side | — | Existing convention; two new keys needed (see Focus 5) |

No capability in this task crosses into CDN/static or Database/Storage tiers — this is a client-rendering restructuring of data the RSC already assembles today.

## Standard Stack

No new packages. This task uses only what's already installed: React 19.2.8, Next.js 16.3.1, `next/image`, `lucide-react`, `@/components/ui/badge`, `@/components/ui/label`, existing Tailwind 4 utility classes. `npm view` / registry verification is not applicable — nothing is being installed.

## Package Legitimacy Audit

Not applicable — this task installs zero external packages.

## Architecture Patterns

### System Architecture Diagram

```
page.tsx (RSC)
   |
   |  editorTemplateTiles(tier, currentKey) -- UNCHANGED
   |  returns TemplateTile[] (tier-accessible set + retained current key)
   v
EditorShell ("use client")
   |
   |  templates={tiles}  currentTemplateKey={editor.templateKey}
   v
ChangeTemplatePanel ("use client")  <-- MODIFIED (this task)
   |
   |-- spotlightTile = tiles.find(t => t.key === currentTemplateKey)
   |-- gridTiles      = tiles.filter(t => t.key !== currentTemplateKey)
   |
   |---> <CurrentTemplateCard tile={spotlightTile} />   [NEW component]
   |           uses <TemplateMedia .../>                 [NEW, extracted]
   |
   \---> <TemplatePicker tiles={gridTiles}
                          currentKey={currentTemplateKey}   <-- still passed,
                          selectedKey={pendingKey}               guard stays wired
                          onChange={...} />              [UNCHANGED component]
              uses <TemplateMedia .../> internally         [swap in place of
                                                             the inline image block]
```

A reader can trace the primary use case (merchant opens "Change template") top to bottom: the RSC computes the tile set once, `ChangeTemplatePanel` splits that one array into "the one that's current" and "everything else," and the two already-established rendering primitives (a new spotlight card, the untouched grid) each render their half. Nothing downstream of the split (the confirm dialog, `switchTemplate`, the entitlement gate) changes.

### Recommended Project Structure

```
src/components/theming/
├── template-picker.tsx        # UNCHANGED props/behavior; internal image block
│                               # swapped for <TemplateMedia> (Focus 2)
├── template-thumbnail.tsx     # UNCHANGED (already has optional className since 05.1-06)
├── template-media.tsx         # NEW — extracted image-frame + D-05 fallback branch,
│                               # shared by template-picker.tsx and current-template-card.tsx
└── current-template-card.tsx  # NEW — the spotlight card

src/app/(dashboard)/dashboard/storefront-editor/
├── page.tsx                   # UNCHANGED (editorTemplateTiles stays byte-identical)
└── change-template-panel.tsx  # MODIFIED — splits tiles, renders both pieces
```

### Pattern 1: Split-at-the-call-site, not split-in-the-data-layer

**What:** `editorTemplateTiles` (the RSC's `TemplateTile[]` builder) stays exactly as it is today. The spotlight/grid split happens in `ChangeTemplatePanel`, a plain `Array.find` + `Array.filter` over the same array already being passed down.
**When to use:** Whenever a UI restructuring only needs to change *how* existing data is grouped for rendering, not *what* data is fetched or *how* it is authorized.
**Why here specifically:** `editorTemplateTiles`'s own header comment (`page.tsx:149-177`) documents a real invariant other code may depend on later (`keys.length` unchanged, `INDUSTRY_SEGMENTS` order preserved) — changing that function's contract to matcher a UI-only concern would widen its blast radius for no reason. Splitting one array into two views at the last consumer is the smaller, more honest change.
```typescript
// change-template-panel.tsx — new code, illustrative
const spotlightTile = tiles.find((t) => t.key === currentTemplateKey) ?? null;
const gridTiles = tiles.filter((t) => t.key !== currentTemplateKey);
```

### Pattern 2: Extract only the piece with real branching logic

**What:** `TemplateMedia` wraps exactly the `tile.previewUrl !== null ? <Image .../> : <TemplateThumbnail .../>` branch — the D-05 fallback decision, the `next/image` `fill`/`sizes`/`object-cover` props, and the `motion-reduce:` guards.
**When to use:** When two call sites need the *identical* rendering of a data-driven branch whose two arms (real image vs. wireframe) must never drift out of sync with each other.
**Why here specifically:** The image-or-fallback branch is the one piece of `template-picker.tsx`'s card anatomy that is not just styling — it is the D-05 contract (`tests/unit/template-picker-contract.test.ts` tests 4-7: `previewUrl`, `TemplateThumbnail`, no `onError`, no `priority`). Hand-copying it into a second component risks the two branches silently diverging (e.g. one gets a `sizes` fix the other doesn't). Everything *around* it — badges, text block, card frame, hover/selected treatment — is intentionally different between the grid card and the spotlight card (see Focus 2 below) and should not be forced through one shared body.

```typescript
// src/components/theming/template-media.tsx — proposed shape
"use client";
import type { ReactElement } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { TemplateSectionRef } from "@/server/theming/schema";
import { TemplateThumbnail } from "./template-thumbnail";

export function TemplateMedia({
  previewUrl,
  sections,
  primaryAccent,
  sizes,
  imageClassName,
  fallbackClassName,
}: {
  readonly previewUrl: string | null;
  readonly sections: readonly TemplateSectionRef[];
  readonly primaryAccent: string;
  /** Matches the grid's existing responsive sizes string by default at each call site — not hardcoded here so the spotlight card (a different layout slot) can pass its own. */
  readonly sizes: string;
  readonly imageClassName?: string;
  readonly fallbackClassName?: string;
}): ReactElement {
  if (previewUrl !== null) {
    return (
      <Image
        src={previewUrl}
        alt=""
        fill
        sizes={sizes}
        className={cn(
          "object-cover object-top transition-transform duration-200 motion-reduce:transform-none motion-reduce:transition-none",
          imageClassName,
        )}
      />
    );
  }
  return (
    <TemplateThumbnail
      sections={sections}
      primaryAccent={primaryAccent}
      className={cn("h-full w-full aspect-auto min-w-0 rounded-none border-0", fallbackClassName)}
    />
  );
}
```
`template-picker.tsx`'s grid card keeps its own `relative aspect-[16/10] w-full overflow-hidden border-b border-border bg-muted` frame div and its own badge overlays exactly as today, just swapping the inline `previewUrl !== null ? <Image .../> : <TemplateThumbnail .../>` block for `<TemplateMedia previewUrl={...} sections={...} primaryAccent={...} sizes="(min-width: 1024px) 340px, (min-width: 640px) 50vw, 92vw" imageClassName="group-hover:scale-[1.02]" />` — the `group-hover:scale-[1.02]` stays a caller-supplied class because the hover-lift is a grid-card-only affordance (the spotlight card is not "selectable," so it should not scale on hover — see Focus 2).

### Anti-Patterns to Avoid

- **Building one shared `TemplateCardBody({ tile, isCurrent, isSpotlight, ... })` mega-component:** the grid card and spotlight card differ in frame shape, badge placement, hover behavior, selectability (radio vs. none), and eventually action affordances. A single component branching on 4-5 booleans to produce two genuinely different layouts is harder to read than two small, honest components sharing only the one piece that actually needs to match byte-for-byte (the media branch).
- **Re-deriving `spotlightTile`/`gridTiles` inside `<TemplatePicker>` itself:** `TemplatePicker`'s own header states it is "ONE COMPONENT, TWO SURFACES" shared with onboarding, which has no current-template concept at all. Teaching it to filter out `currentKey` internally would add editor-only behavior to a component that must stay surface-agnostic. The filter belongs in `ChangeTemplatePanel`, which is already editor-only.
- **Passing `currentKey={undefined}` to `<TemplatePicker>` for the grid** (since the current tile is no longer in `gridTiles`, one might think the prop is now pointless): keep passing the real `currentTemplateKey`. It costs nothing, it is what the contract test's "keeps the Phase 5 lock/inert-card controls" assertion is pinning against, and it is correct defense-in-depth (see Focus 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image-vs-wireframe fallback decision | A second `previewUrl === null` check hand-copied into the spotlight card | Extracted `TemplateMedia` (Pattern 2) | Prevents the two render sites from silently diverging on the D-05 contract |
| "Current" visual language | A new ring/badge treatment invented for the spotlight | Reuse `strings.editor.templateCurrentBadge` ("Current") and the existing `border-primary ring-2 ring-primary` selected-state language already used both in the grid card and in `dashboard/plan/page.tsx`'s current-plan card | One visual vocabulary for "this is the one you have" across the dashboard, already established in two places |
| Retained-above-tier messaging | New copy for "you kept this from a previous plan" | Reuse `strings.editor.templateRetainedCaption` verbatim | Already exists, already correct, already covers this exact edge case |

**Key insight:** almost nothing in this task is a new problem — it is a rearrangement of already-solved pieces (image fallback, current-badge language, retained caption, tier-lock chip). The only genuinely new thing is the spotlight card's outer chrome and layout.

## Common Pitfalls

### Pitfall 1: Treating the inert-guard's new dead-code status as "safe to delete"
**What goes wrong:** Because `gridTiles` never contains a tile with `key === currentTemplateKey`, the `if (currentKey !== undefined && key === currentKey) return;` line in `template-picker.tsx`'s `onValueChange` can no longer actually fire for the editor's grid. It is tempting to view this as dead code and delete it.
**Why it happens:** The guard's condition genuinely cannot be satisfied anymore given the new data flow.
**How to avoid:** Do not delete it. `tests/unit/template-picker-contract.test.ts`'s "keeps the Phase 5 lock/inert-card controls (T-05-32 / T-05-35)" test asserts this exact string is present, byte-identical, unconditionally — it does not know or care what data flows through at runtime. It is also legitimate defense-in-depth: `TemplatePicker` is a shared component also used by onboarding and could in principle be reused by a future caller that *does* still include the current tile in its `tiles` array; the guard protects that future caller too.
**Warning signs:** `npx vitest run tests/unit/template-picker-contract.test.ts` failing on the "keeps the Phase 5 lock/inert-card controls" assertion.

### Pitfall 2: Segment group silently disappearing from the grid
**What goes wrong:** If a merchant's current template is the *only* Starter-tier-accessible template in its segment, excluding it from `gridTiles` can leave that segment with zero tiles in the grid below.
**Why it happens:** `05.1-UI-SPEC.md` only guarantees "every segment has ≥1 Starter-accessible template" — not ≥2. Removing exactly the current one can zero out a segment.
**How to avoid:** No code change needed — `partitionBySegment`'s existing "a segment with zero tiles never gets a bucket at all" behavior (already shipped, already covered by the D-05 partition invariant) handles this correctly by construction: the group heading simply does not render for that segment. Confirm this is acceptable UX (a segment heading disappearing entirely from the grid when its one member becomes the spotlight) rather than assuming it needs special-casing.
**Warning signs:** None expected at runtime — flagging so the planner does not "fix" a heading that legitimately vanishes.

### Pitfall 3: Duplicating "Launch store"/"Edit theme" affordances that already exist elsewhere on this page
**What goes wrong:** Copying Shopify's reference literally would add "Edit theme" and "Launch store" buttons to the spotlight card.
**Why it happens:** The screenshots are the explicit visual reference, and their button pair is the most visible chrome on the reference card.
**How to avoid:** See Focus 3 below — both affordances already exist on this exact page under different names (`onBack` / the live preview iframe / the publish bar's post-publish "View store" toast action).

## Code Examples

### The existing "current" ring/check visual language (precedent to reuse, not reinvent)

```tsx
// Source: src/app/(dashboard)/dashboard/plan/page.tsx:142-168 (read in full during research)
<div
  className={cn(
    "flex flex-col gap-4 rounded-lg border border-border bg-muted p-6",
    isCurrent && "ring-2 ring-primary",
  )}
>
  {/* ... */}
  {isCurrent ? (
    <>
      <Check aria-hidden="true" className="size-5 text-primary" />
      <span className="sr-only">{strings.plan.selectedLabel}</span>
    </>
  ) : null}
</div>
```
This is the closest in-repo precedent for a "here is the one you currently have, sitting apart from the switchable set" card — not pixel-identical to what the spotlight card needs (that page's cards are still in a row, not a spotlight-above-grid layout), but it confirms the established idiom: `ring-2 ring-primary` + an explicit "current" marker, not a new visual treatment invented from the Shopify screenshots.

### The existing inert-current-card guard (must survive byte-identical)

```tsx
// Source: src/components/theming/template-picker.tsx:222-228 (current, must not change)
<RadioGroup
  value={selectedKey ?? undefined}
  onValueChange={(value: unknown) => {
    const key = String(value);
    if (currentKey !== undefined && key === currentKey) return;
    onChange(key);
  }}
  className="flex flex-col gap-8"
>
```

## State of the Art

| Old Approach (shipped 05.1-06, today) | New Approach (this task) | When Changed | Impact |
|--------------|------------------|------------------|--------|
| Current template renders inert-in-place inside the same segment-grouped grid as every other tile, distinguished only by a `Current` badge + ring + disabled click | Current template renders in its own spotlight card above the grid; the grid below shows only the switchable set | This task | Matches the Shopify "Online Store" precedent the user supplied; removes the visual redundancy of a large disabled card sitting among selectable ones |

**Deprecated/outdated:** none — this is additive restructuring on top of the 05.1-06 redesign, not a reversal of it. Every 05.1-06 decision (container-query grid, 16:10 frame, segment grouping, D-05 fallback, T-05-32/T-05-35 mitigations) stays in force.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A merchant's current template can, in a downgrade scenario, be the *only* Starter-accessible tile in its segment (Pitfall 2) | Common Pitfalls | Low — even if this never occurs in the live 50-template registry today, the partition logic already handles it correctly with zero new code, so being wrong about the scenario's likelihood costs nothing |
| A2 | No other call site currently imports `TemplateTile` or reads `editorTemplateTiles`'s output expecting the current key to be excluded | Architecture Patterns | Low — grep confirms `page.tsx` and `change-template-panel.tsx` are the only two files in this data path; a new consumer is out of scope |

**If this table is empty:** N/A — two low-risk assumptions recorded above; both are self-correcting even if wrong (existing code already handles the edge case; no other consumer exists per grep).

## Open Questions

None remaining that block planning — all five focus items are resolved below with a stated reason. One item (the "View live store" link) is explicitly a design judgment call flagged for the UI-SPEC pass rather than an open research question; see Focus 3.

---

## Focus Resolutions

### Focus 1 — Exclude current from the grid below, or keep it inert-in-place too?

**Resolution: EXCLUDE.** The spotlight card is the *only* place the current template renders in this panel; `gridTiles` (passed to `<TemplatePicker>`) never contains a tile with `key === currentTemplateKey`.

**Reasoning:**
- The three screenshots the user supplied (Shopify's "Online Store" admin) show the active theme's card at the top and a *separate* "Discover themes" grid below that does **not** repeat the active theme. Showing it twice (once large and interactive-looking in the spotlight, once small and greyed-out in the grid) is the redundant, less-professional layout the task exists to fix — CONTEXT.md's own phrasing ("instead of rendered inert-in-place within the grid below") points the same direction.
- **D-05 (SORT-NEVER-FILTER) is not implicated.** Re-reading the actual decision record (`.planning/phases/05-template-segment-expansion/05-CONTEXT.md`, `05-UI-SPEC.md` § Behaviour): D-05 forbids a merchant's *industry/segment* mechanically determining which templates are reachable — it says nothing about whether the already-selected template must additionally render inert inside the switch grid. Tier-locking (D-A in this task's CONTEXT.md) is the other protected "always visible" rule, and it is fully preserved: every tier-locked template, including ones the merchant does not currently have, keeps rendering dimmed with its `Requires {tier}` chip in `gridTiles`. Only the *one* tile that is the merchant's current template moves out of the grid — and it does not disappear, it becomes more prominent (the spotlight), which is the opposite of a "filtering" harm.
- **T-05-32 and T-05-35, read from the actual threat register (`05-09-PLAN.md:174,177`), are unaffected:**
  - T-05-32 (Elevation of Privilege — "a disabled locked card treated as the gate") is about *locked* cards, not the current card. It is untouched: locked cards still render disabled/dimmed in `gridTiles`, and `assertTemplateAccess` on the server remains the actual boundary, exactly as before.
  - T-05-35 (Repudiation — "a downgraded merchant re-selecting an above-tier template from the current-card") is specifically about the current card being clickable-and-re-selectable. Since the current tile no longer renders as a *card in the grid at all*, there is no click surface for this threat to exploit through the grid. The mitigation nonetheless **stays wired as defense-in-depth** (see below) rather than removed, because `TemplatePicker` is a shared component whose contract (byte-identical guard) is pinned by an automated test regardless of what any one caller currently passes.
- **Contract test impact:** none. `tests/unit/template-picker-contract.test.ts` is a source-scan test (`environment: "node"`, no DOM) — it greps `template-picker.tsx`'s text for patterns (`@container`, `role="group"`, the literal guard string, absence of `priority`/`onError`/viewport breakpoints). It never renders the component with real `tiles` data, so it cannot detect or care that `gridTiles.length` is now `tiles.length - 1` (or `tiles.length` unchanged, when the current template isn't tier-accessible and wasn't appended — see `page.tsx:183-188`). The `Σ group.length === tiles.length` partition invariant inside `template-picker.tsx` is a property of `partitionBySegment`'s algorithm relative to *whatever* array it receives — it holds trivially for the smaller `gridTiles` array too.

**Disposition of the guard logic:** `disableHoverLift`/`isInert`/the `onValueChange` early-return **all stay exactly as they are today, in `template-picker.tsx`, unmodified.** Do not attempt to "clean up" now-unreachable branches (`isCurrent` becoming permanently `false` for every tile the editor's grid renders). This is the "left as defense-in-depth belt-and-suspenders" option from CONTEXT.md's discretion list, and it is the only option that satisfies both the contract test (which pins the guard byte-identical) and honest engineering (removing a still-tested, still-documented mitigation because one caller no longer exercises it would be premature optimization against a shared component's own stated contract).

### Focus 2 — Card-body extraction shape

**Resolution: extract only the image-frame/D-05-fallback branch** into a new `TemplateMedia` component (`src/components/theming/template-media.tsx`); build `CurrentTemplateCard` as a new, small, independent component that does **not** reuse `TemplatePicker`'s card chrome, badges, or text-block layout wholesale.

**Reasoning:** See Pattern 2 above for the extraction's exact proposed signature. The deciding factor is that the grid card and the spotlight card are not the same shape of thing once you list what each actually needs:

| Element | Grid card (unchanged) | Spotlight card (new) |
|---|---|---|
| Selectable (radio target) | Yes | No — it is not a switch destination for itself |
| Frame | `aspect-[16/10]`, card padding none, `rounded-lg border` | Likely larger/wider — a "hero" treatment, still 16:10 for the image but the outer card can be full-width of the rail/panel rather than one grid cell |
| Hover lift on image | Yes, for selectable neighbors; suppressed for locked/current | No — nothing to select, hover-lift would misleadingly suggest interactivity |
| Lock badge | Yes, when `tile.locked` | No — showing "Requires {tier}" on the template the merchant already has would be actively confusing (they already have it) |
| Current badge | Yes (`bg-primary` overlay on the image) | Redundant given the card's position + a heading (see Focus 5) — reuse the string, but as a smaller inline label rather than an image overlay, or omit if the heading already says it |
| Retained-above-tier caption | Yes | Yes, unchanged — the one piece of copy that transfers as-is |
| Text block padding/typography | `p-4`, `gap-2`, Label 14/600 | Can be larger given more available width — a judgment call for the UI-SPEC pass, not this research |

Forcing both through one `TemplateCardBody({ tile, variant: "grid" | "spotlight", ... })` component would need enough conditional branching (skip radio wrapper, skip lock badge, change frame size, change hover behavior, change text scale) that the "one component" would in practice be two components glued together by a discriminant prop — worse than two small, honestly-separate components, and it would also mean editing `template-picker.tsx` (which explicitly forbids forking for surface-specific behavior — its header rule is "ONE COMPONENT, TWO SURFACES," referring to onboarding vs. editor, not "one component, every possible layout").

The one thing genuinely worth not hand-copying is the `previewUrl !== null ? <Image/> : <TemplateThumbnail/>` branch, because it carries real, tested logic (D-05's silent-fallback contract, `next/image`'s `fill`/`sizes` props, `motion-reduce:` guards) that a second hand-written copy could drift from over time. That is `TemplateMedia`.

**Proposed function signature** (also shown in Pattern 2):
```typescript
export function TemplateMedia({
  previewUrl,       // string | null
  sections,         // readonly TemplateSectionRef[]
  primaryAccent,    // string
  sizes,            // string — caller-specific responsive sizes attribute
  imageClassName,   // string? — e.g. hover-lift class, grid-only
  fallbackClassName,// string? — merged onto TemplateThumbnail's frame override
}: { ... }): ReactElement
```
`template-picker.tsx` swaps its inline branch for this component (one-line change per call site, no change to its surrounding frame/badges). `current-template-card.tsx` uses the same component for its own image slot with its own `sizes` string and no `imageClassName` (no hover-lift needed).

### Focus 3 — Primary action(s) on the spotlight card

**Resolution: no "Edit"/"Launch store" button pair.** Both Shopify affordances already exist on this exact page under different names, confirmed by reading `page.tsx`, `change-template-panel.tsx`, `editor-shell.tsx`, and `publish-bar.tsx` in full:

- **"Edit theme" equivalent:** the merchant is *already* on the template-editing page. The "Change template" panel's own `onBack` control (the `ChevronLeft` + `railBack` button already at the top of `change-template-panel.tsx:166-173`) returns to the main section-editing rail — that *is* "Edit theme" for this product. Adding a second "Edit" button on the spotlight card that does the same thing (or worse, nothing, since there is nothing else to navigate to) would be the exact redundant-affordance bug the task description warns against.
- **Live preview equivalent:** the editor's main content pane is a persistently-visible, instantly-updating iframe of the current template (`editor-shell.tsx`'s preview protocol, `PREVIEW_DOC_MESSAGE` etc.) — the merchant is looking at a live rendering of the current template while this very panel is open, one pane over. Shopify's "Launch store" opens the theme in a new tab because Shopify's admin has no persistent live preview pane; EINORT's editor already gives the merchant something strictly better for this purpose.
- **"View live/published store" equivalent:** `publish-bar.tsx`'s `handlePublish` already surfaces a `View store` action (`strings.editor.viewStore`) as a toast action after a successful publish (`publish-bar.tsx:184-191`, `window.open(storefrontUrl, "_blank", "noopener,noreferrer")`). This is the one affordance that is **not** persistently visible on-screen (it only appears transiently in a post-publish toast) — so it is the one candidate that would not be a strict duplicate if added to the spotlight card.

**Recommendation, flagged as a judgment call beyond this research pass's authority:** omit a "View live store" link from the spotlight card in the first cut, on the grounds that (a) `05.1-UI-SPEC.md`'s own U-06 decision already established "no per-card secondary button" as this design system's convention for template cards, and (b) the spotlight card's entire job in this task is informational (which template is live), not navigational. If a UI-SPEC pass or the user wants one anyway, `storefrontUrl` is already threaded all the way down to `EditorShell` (`page.tsx:276`) and would need one additional prop hop into `ChangeTemplatePanel` → `CurrentTemplateCard` to wire a `text-sm text-primary underline` link matching the existing `templateUpsellLink` visual register (`change-template-panel.tsx:222-227`) — this is a small, well-understood addition if approved, not a research gap.

**What the spotlight card DOES need, resolved (not a judgment call — reuses existing, established elements):**
- The template's real preview image (or D-05 wireframe fallback) via `TemplateMedia`.
- The template's display name (`tile.name`) and segment tag (`tile.segmentTag`), same typography as the grid card (Label 14/600 + 14/400 muted).
- A "Current" indicator — reuse `strings.editor.templateCurrentBadge` ("Current"), placed as a small badge/label near the name rather than as an image overlay (the overlay convention exists specifically to distinguish the current card *from its neighbors in a grid*; the spotlight card has no neighbors, so a badge inline with the heading is clearer than replicating the overlay).
- The retained-above-tier caption (`strings.editor.templateRetainedCaption`), shown only when `spotlightTile.locked === true` (i.e., a downgrade retained this template above the merchant's current tier) — same condition (`isCurrent && tile.locked`) `template-picker.tsx` already uses.

### Focus 4 — Segment-grouping interaction

**Resolution: no change needed to `sortBySegment` behavior; confirmed the editor already passes none.**

- Confirmed directly from `change-template-panel.tsx:207-215`: the `<TemplatePicker>` call in the editor passes `tiles`, `selectedKey`, `currentKey`, `onChange` — **no `sortBySegment` prop.** This matches `05.1-06-PLAN.md`'s own interfaces section ("`TemplatePicker` props after plan 05.1-05: `tiles`, `selectedKey`, `onChange`, `currentKey?`, `sortBySegment?`, `error?`") and `05.1-UI-SPEC.md`'s explicit statement: "Group order — editor: Plain `INDUSTRY_SEGMENTS` order. The editor picker passes no `sortBySegment`; a merchant here is changing template, not declaring an industry." This restructuring does not need to add, remove, or alter that — the grid below the spotlight continues to group by segment in plain `INDUSTRY_SEGMENTS` order, exactly as it does today, just over a `tiles.length - 1` (or unchanged, when the current key wasn't tier-accessible and thus wasn't in `gridTiles` to begin with) array.
- **Does removing the current tile change any invariant the contract test asserts?** No — see Focus 1's "Contract test impact" paragraph above. The test is a source scan, not a data-driven render test, and the partition invariant it documents (`Σ group.length === tiles.length`) is a property of the algorithm relative to whatever input it receives, which holds regardless of array size.
- **The one real (not test-breaking, but UX-relevant) downstream effect** is Pitfall 2 above: a segment can end up with zero tiles in the grid if the current template was that segment's only Starter-accessible member. This is already handled correctly by the shipped "a zero-length group is never rendered" behavior — flagged for planner awareness, not as something requiring new code.

### Focus 5 — New string keys

**Resolution: two new keys, both in the `strings.editor` namespace** (the existing home for every other editor-panel-specific template string: `templateCurrentBadge`, `templateRetainedCaption`, `templateUpsellLink`, `templateTierLocked`, `railChangeTemplateEntry`), following the codebase's existing `template`-prefixed camelCase convention:

| Key | Proposed copy | Placement |
|---|---|---|
| `strings.editor.templateCurrentHeading` | `"Your current template"` | Small heading/label directly above the spotlight card, parallel in role to the grid's own segment headings (`templateGroupHeading`) but describing the spotlight section as a whole rather than a segment |
| `strings.editor.templateAvailableHeading` | `"Available templates"` | Heading above the switchable grid, replacing the implicit "it's just a grid" framing today. Chosen over `"Switch template"` because it stays descriptive (matches the register of `templateGroupHeading`/`templateGroupRecommended`, which describe *what's there*, not *what to do*) rather than imperative — consistent with this panel's existing non-CTA heading style (`railChangeTemplateEntry` = "Change template" is the one exception, but that is the panel's own page-level `<h2>`, not a sub-section label) |

No new string is needed for the "Current" badge itself (`templateCurrentBadge` already exists and is reused, per Focus 3), nor for the retained-above-tier caption (`templateRetainedCaption` already exists and is reused). If the discretionary "View live store" link from Focus 3 is later approved, it would need one further new key (e.g. `strings.editor.templateViewLiveLink`), not proposed here since the affordance itself is not yet decided.

## Sources

### Primary (HIGH confidence — read in full this session)
- `src/app/(dashboard)/dashboard/storefront-editor/page.tsx` — RSC, `editorTemplateTiles`, tile assembly
- `src/app/(dashboard)/dashboard/storefront-editor/change-template-panel.tsx` — current call site
- `src/components/theming/template-picker.tsx` — shared picker, full header invariants, guard logic
- `src/components/theming/template-thumbnail.tsx` — D-05 fallback, `className` prop (05.1-06)
- `tests/unit/template-picker-contract.test.ts` — the 13-assertion source-scan contract
- `.planning/phases/05.1-template-preview-rendering-picker-redesign/05.1-06-PLAN.md` — threat register (T-05.1-22, T-05.1-27), interfaces, task actions
- `.planning/phases/05.1-template-preview-rendering-picker-redesign/05.1-UI-SPEC.md` — full grid/card/grouping/color contract
- `.planning/phases/05-template-segment-expansion/05-09-PLAN.md` — original T-05-32/T-05-35 threat register entries
- `.planning/phases/05-template-segment-expansion/05-CONTEXT.md`, `05-UI-SPEC.md` — D-05 SORT-NEVER-FILTER original definition
- `src/app/(dashboard)/dashboard/storefront-editor/publish-bar.tsx` — existing "View store" toast action, publish/save/discard actions
- `src/app/(dashboard)/dashboard/storefront-editor/editor-shell.tsx` (lines 1-120) — live preview iframe protocol, header
- `src/app/(dashboard)/dashboard/plan/page.tsx` — current-plan card precedent (`ring-2 ring-primary` + Check)
- `src/lib/strings/index.ts` (grep for "template") — existing string-key naming convention
- `.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md` — design token source (radius, color idiom)
- `.planning/quick/260908-bv1-restructure-change-template-panel-layout/CONTEXT.md` — locked decisions D-A, D-B

### Secondary (MEDIUM confidence)
- `src/server/theming/registry.ts` (partial read — `TemplateKey`, `TEMPLATES` shape confirmed structurally, not modified)

### Tertiary (LOW confidence)
None — every claim above traces to a file read directly in this session; no unverified web search was needed for this task (pure in-repo restructuring, no external library research required).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, everything already installed and in use
- Architecture: HIGH — every referenced file was read in full or in the cited line ranges this session
- Pitfalls: HIGH — both pitfalls derive directly from reading the actual contract test and partition function, not inference
- Focus resolutions: HIGH for 1, 2, 4, 5 (each traces to a specific file/line); MEDIUM for the "omit View live store link" half of Focus 3 (a genuine design judgment call, flagged as such, not a verified fact)

**Research date:** 2026-09-08
**Valid until:** 30 days (stable in-repo restructuring; no fast-moving external dependency)
