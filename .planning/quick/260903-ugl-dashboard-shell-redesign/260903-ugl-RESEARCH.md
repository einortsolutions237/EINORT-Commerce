# Quick Task 260903-ugl: Dashboard Shell Redesign — Research

**Researched:** 2026-09-03
**Domain:** Tailwind CSS 4 scoped theming inside a shadcn `Sidebar` block; shadcn `Card`/`Input` reuse
**Confidence:** HIGH (all four questions verified directly against source in this repo, plus one external claim cross-checked against official docs)

## Summary

All four questions resolve cleanly and none require a new npm package. The critical finding is
in Q1: a scoped CSS-variable override for the sidebar **does** work under this project's exact
Tailwind 4 `@theme inline` setup — the same mechanism is already live in production in this same
file (`[data-surface="storefront"]` re-scopes the whole token set for the storefront route tree,
verified by `tests/unit/surface-token-isolation.test.ts`). What does **not** work unmodified is
reusing the shipped `.dark` class for this purpose: it redeclares `--gold-accent-foreground` to a
light value, and the pending-claims gold `Badge` lives inside the sidebar being scoped — wrapping
it in `.dark` would silently break that badge's contrast (dark-mode gold-100 text on an
unchanged, still-light, 15%-opacity gold fill). The fix is a **new, narrow selector** that
redeclares only the eight `--sidebar-*` tokens, applied at the exact two DOM nodes in
`src/components/ui/sidebar.tsx` where `bg-sidebar`/`text-sidebar-foreground` is already hardcoded
(desktop container + mobile `SheetContent`) — not a wrapper `className="dark"` placed from
`app-sidebar.tsx`, because the mobile render path is a portaled `Sheet` and does not inherit an
ancestor's class at all.

**Primary recommendation:** Add a new top-level selector to `globals.css` (e.g.
`.sidebar-dark-scope`) that copies only the 8 `--sidebar-*` OKLCH values already sitting unused in
the `.dark` block (lines 324–331), and apply that class directly inside
`src/components/ui/sidebar.tsx`'s `Sidebar()` function at both the desktop and mobile render
branches — not via an external wrapper. No variant/prop change to `Sidebar` is needed; shadcn's
`--sidebar-*` namespace already exists precisely to support an independently-themed rail. Reuse
`Card` (already installed, already used in `login`/`signup`) for the new `DashboardCard`, and
`Input` for the placeholder search box; build a small new `Kbd` primitive by hand (no such
component exists yet, though `tooltip.tsx` already anticipates a `data-slot="kbd"` convention).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sidebar dark-scope theming | Browser / Client (CSS custom properties) | — | Pure CSS cascade scoping; no server involvement, no new data |
| Top-bar search placeholder | Browser / Client (React Client Component or static markup) | — | Explicitly non-functional (locked decision #3); no server action, no query |
| `DashboardCard` shared component | Browser / Client + Server (RSC-compatible) | — | Presentational wrapper around existing `Card`; must stay a Server Component-compatible primitive (no `"use client"` needed) since dashboard pages are Server Components |
| Dashboard shell layout (`(dashboard)/layout.tsx`) | Frontend Server (SSR) | — | Already a Server Component; unaffected structurally by this task except for wrapping the new topbar |

## User Constraints (from CONTEXT.md)

> This quick task's context file does not use the standard `## Decisions` / `## Claude's
> Discretion` / `## Deferred Ideas` headers — it uses `## Locked decisions`, `## What must not
> change`, and `## Key discovery from pre-planning investigation`. Copied verbatim below in their
> original structure.

### Locked decisions (via AskUserQuestion, this session)
1. **Fidelity**: Adopt Shopify's LAYOUT STRUCTURE (dark left icon-nav rail, top search bar, white
   card-based main content area on a soft gray background) — NOT Shopify's actual color palette.
   EINORT keeps its own locked blue/gold/slate + Outfit design system throughout. This is a
   structural/IA change, not a re-skin.
2. **Timing**: After Phase 4's gate closes.
3. **Search bar**: Visual placeholder only. Style a search input matching Shopify's look
   (centered, keyboard-shortcut hint) but non-functional. Real cross-entity search is deferred.
4. **Card retrofit scope**: Shell only. Rebuild the sidebar rail and top bar; introduce the card
   convention as a new shared component — but do NOT retrofit the six existing dashboard pages
   into it.

### What must not change
- The storefront surface (`src/app/s/[slug]/**`) and its zinc-monochrome system — untouched.
- EINORT's own brand colors (blue/gold/slate) — no Shopify colors anywhere.
- `(dashboard)/layout.tsx` remains NOT the authorization boundary — every page still calls
  `requireMerchantContext()` itself.
- The gold-badge budget (exactly 2 uses across the whole dashboard, enforced by
  `tests/unit/dashboard-nav.test.ts`) — a restyled shell must not add a third **and must not break
  the contrast of the existing one** (see Pitfall 1 below — this is the concrete mechanism by
  which a naive dark-scope implementation would violate this constraint without adding a literal
  third `variant="gold"`).
- The existing nav-item set, hrefs, and `REQUIRED_HREFS` contract in
  `tests/unit/dashboard-nav.test.ts`.
- Centralized copy convention (`src/lib/strings.ts`) — no new inline UI string literals (applies
  to the search placeholder's copy and any new `Kbd`/topbar text).
- 44px minimum touch targets on nav items (`h-auto min-h-11`, already enforced on
  `SidebarMenuButton` in `app-sidebar.tsx`) — must survive whatever className changes this task
  makes to `Sidebar`/`SidebarMenuButton`.
- The two-weight type contract (`font-semibold` / `font-medium` only, no 500).

### Key discovery from pre-planning investigation (carried over, now verified)
`globals.css` defines a complete, currently-unused `.dark` class (lines 294–331) including dark
sidebar tokens closely matching what a Shopify-style dark rail needs. This research confirms the
mechanism is sound but that the `.dark` class itself is the wrong vehicle (see Q1 below).

## Project Constraints (from CLAUDE.md)

- **kebab-case file names** — any new file (`kbd.tsx`, `dashboard-card.tsx`, `top-bar.tsx`, etc.)
  must follow this.
- **No inline user-facing string literals** — enforced by `tests/unit/dashboard-nav.test.ts`'s
  `looksLikeProse` scanner pattern for `app-sidebar.tsx` specifically; the same convention (all
  copy in `src/lib/strings.ts`) applies project-wide per CLAUDE.md, so any new topbar/search copy
  must be added under `strings.dashboard` (see `src/lib/strings.ts:459` for the existing
  `dashboard` namespace shape, with `nav` already nested at `:485`).
- **shadcn `base-nova` style, base-ui primitives** (`components.json`) — any new primitive
  (`Kbd`) should follow the existing `data-slot="..."` + `cn()` + `React.ComponentProps<"tag">`
  pattern used by every file in `src/components/ui/**` (see `card.tsx`, `badge.tsx` for the
  house style: plain `<span>`/`<div>` wrappers, no base-ui primitive needed for something this
  simple).
- **"Deliberate override, documented in place" convention** — `src/components/ui/sidebar.tsx`
  already carries one precedent for exactly this situation (the `lg:` vs shadcn's stock `md:`
  breakpoint override, documented in a header comment above the `Sidebar` function, lines
  152–164). The new dark-scope class edit should follow the same pattern: a short comment
  directly above the two edited lines explaining why, so a future `shadcn add sidebar` diff stays
  legible.
- **ESLint zero-warning gate** (`npm run lint`, `--max-warnings=0`) — no import-boundary rules are
  implicated by this task (no `src/server/**` or Prisma involvement).
- **Vitest** — `npm run test:unit` runs `tests/unit/dashboard-nav.test.ts`, which will exercise
  any edits to `app-sidebar.tsx` and must keep passing unmodified in its assertions (gold count
  stays exactly 1 in that file, all `REQUIRED_HREFS` present, no inlined copy).

## Q1 — Scoping dark tokens to just the sidebar

### The mechanism is sound and already proven in this exact codebase

`globals.css`'s `@theme inline` block (lines 7–73) maps every Tailwind sidebar utility to a
**custom-property indirection**, not a baked value:

```css
@theme inline {
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  /* ...same pattern for every other token family */
}
```

This is the pattern the official Tailwind CSS v4 theme docs and shadcn's own Tailwind v4 dark-mode
guide describe as the one that supports runtime overriding: because the *generated utility*
(`bg-sidebar` → `background-color: var(--color-sidebar)`) still points at `--color-sidebar`, which
itself is `var(--sidebar)`, the browser resolves `--sidebar` by walking up the DOM from the
element the utility is applied to and using the nearest declaration in scope — exactly like any
other inherited custom property. `[VERIFIED: docs.tailwindcss.com/docs/theme, ui.shadcn.com/docs/tailwind-v4]`

Proof this already works in this exact file, in production, today: `[data-surface="storefront"]`
(lines 210–264) redeclares `--background`, `--primary`, `--border`, etc. scoped to an attribute
selector, and the whole storefront route tree renders on the zinc palette while the dashboard
renders on blue/gold/slate from the same compiled CSS bundle — enforced by
`tests/unit/surface-token-isolation.test.ts`. `[VERIFIED: codebase, src/app/globals.css:210-264]`
A scoped sidebar override is the identical mechanism at smaller radius: **a plain
`className="some-new-class"` wrapper (or attribute selector) redeclaring `--sidebar`,
`--sidebar-foreground`, etc. will work.**

### Why NOT to reuse `.dark` — a concrete, project-specific contrast bug

`.dark` (lines 294–331) redeclares far more than the sidebar family — including
`--gold-accent-foreground`:

| Token | Light (`:root`, current) | `.dark` block |
|-------|---------------------------|----------------|
| `--gold-accent` | `oklch(0.767 0.139 91.1)` (gold-500) | `oklch(0.767 0.139 91.1)` (unchanged, "gold does not invert") |
| `--gold-accent-foreground` | `oklch(0.359 0.067 91)` (gold-900, dark text) | `oklch(0.985 0.014 106.7)` (gold-100, **light** text) |

The pending-claims gold `Badge` (the sidebar's one sanctioned gold use, in `app-sidebar.tsx`) is
rendered via `badge.tsx`'s `gold` variant: `bg-gold-accent/15 text-gold-accent-foreground`. That
badge lives **inside** the sidebar subtree that would be scoped dark. Wrap it in `.dark` and the
fill stays an unchanged, still-near-transparent 15%-opacity gold, while the text flips from
gold-900 (dark, legible) to gold-100 (light) — producing light-on-near-transparent-light text,
i.e. an illegible badge on the platform's one place gold is supposed to mean "look at this now."
`.dark` also touches `--card`, `--primary`, `--border`, `--popover` and others that have no
sidebar-scoped counterpart and are not needed here — pure blast-radius risk for zero benefit.
`[VERIFIED: codebase, src/components/ui/badge.tsx:56, src/app/globals.css:122-123,309-310]`

**Recommendation: create a new, narrowly-scoped selector — do not reuse `.dark`.** Add directly
below the existing `.dark` block in `globals.css`:

```css
/*
 * A dark-themed sidebar rail on an otherwise light dashboard (Shopify-style
 * structure, EINORT's own colors) — NOT real dark mode. Deliberately NOT
 * `.dark`: that class also redeclares --gold-accent-foreground to a light
 * value, which would break the pending-claims badge's contrast (the badge's
 * fill, --gold-accent, does not invert, so a light foreground on it is
 * illegible). Values below are copied verbatim from the .dark block above —
 * same slate-900 rail, same brand-500 lift for the active item's text.
 */
.sidebar-dark-scope {
  --sidebar: oklch(0.208 0.04 265.8); /* slate-900 */
  --sidebar-foreground: oklch(0.984 0.003 247.9); /* slate-50 */
  --sidebar-primary: oklch(0.623 0.188 259.8); /* brand-500 */
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.279 0.037 260); /* slate-800 */
  --sidebar-accent-foreground: oklch(0.984 0.003 247.9); /* slate-50 */
  --sidebar-border: oklch(0.279 0.037 260); /* slate-800 */
  --sidebar-ring: oklch(0.623 0.188 259.8); /* brand-500 */
}
```

### Where to apply it — NOT a wrapper in `app-sidebar.tsx`

`app-sidebar.tsx` currently passes `className="border-sidebar-border"` as a prop into `<Sidebar>`.
Tracing that prop through `src/components/ui/sidebar.tsx`'s `Sidebar()` function
(`className` is destructured out of `props` at the top, so it is **not** part of the `{...props}`
spread onto `<Sheet {...props}>`) shows it currently reaches **only the desktop branch**
(the `data-slot="sidebar-container"` div, line ~245–253) and is silently dropped on mobile,
because the mobile branch renders `<SheetContent>` with its own hardcoded, unrelated
`className` — and `SheetContent` is rendered through `SheetPortal` → base-ui's
`Dialog.Portal` (`src/components/ui/sheet.tsx:22-24,50`), which teleports its DOM node to
(by default) `document.body`, **outside** any ancestor wrapper's DOM subtree entirely. A
`className="dark"` (or any new class) applied from `app-sidebar.tsx` around `<Sidebar>` would
therefore theme the desktop rail correctly and silently fail to theme the mobile off-canvas sheet.
`[VERIFIED: codebase, src/components/ui/sidebar.tsx:165-265, src/components/ui/sheet.tsx:22-24,39-60]`

**The fix must be made inside `src/components/ui/sidebar.tsx` itself**, at both places that
already hardcode `bg-sidebar text-sidebar-foreground`:

1. Desktop — the `data-sidebar="sidebar" data-slot="sidebar-inner"` div, line 255–259:
   ```tsx
   <div
     data-sidebar="sidebar"
     data-slot="sidebar-inner"
     className="sidebar-dark-scope flex size-full flex-col bg-sidebar text-sidebar-foreground group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border"
   >
   ```
   (Note: `text-sidebar-foreground` is currently only set on an ancestor, line 223 — adding it
   here alongside the scope class is optional but harmless; the class alone is what matters.)

2. Mobile — the `SheetContent`, line 198–210: add `"sidebar-dark-scope"` into its existing
   `className` string (`"w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"`).

3. `collapsible === "none"` branch, line 182–192 (unused today — `AppSidebar` never sets this
   prop — but cheap to keep consistent): add the same class for completeness.

This keeps `app-sidebar.tsx` untouched for this specific mechanism (it can still pass
`border-sidebar-border` or any other override as before) and guarantees both render paths share
one CSS-variable scope, defined once in `globals.css`.

**Confidence: HIGH.** Verified against this project's actual `@theme inline` block, actual
`.dark` values, actual `Sidebar`/`SheetContent` source, and a live, tested precedent
(`[data-surface="storefront"]`) using the identical mechanism in the same file.

## Q2 — shadcn `Sidebar`'s existing variant/theming support

`src/components/ui/sidebar.tsx`'s `Sidebar` component already accepts `variant?: "sidebar" |
"floating" | "inset"` (line 175) and `collapsible?: "offcanvas" | "icon" | "none"` (line 176).
`app-sidebar.tsx` passes neither, so both default (`variant="sidebar"`, `collapsible="offcanvas"`)
— this task does not need to change either prop. The `--sidebar-*` token family (8 tokens,
declared separately from `--background`/`--foreground`/`--card` in both `:root` and `.dark`) is
precisely shadcn's own documented mechanism for "the sidebar has its own color scheme independent
of the page" — no plugin, no extra dependency, no new prop is needed beyond correctly-scoped CSS
custom properties (Q1). `SidebarInset` (used in `(dashboard)/layout.tsx:89`) is the main-content
counterpart and reads `bg-background` (line 323), which is untouched by this task — confirming
the light/dark split lands exactly on the `Sidebar` / `SidebarInset` boundary already present in
the code, with no structural change needed to `(dashboard)/layout.tsx` itself beyond whatever the
new top bar requires.
`[VERIFIED: codebase, src/components/ui/sidebar.tsx:165-176,318-329]`

**Confidence: HIGH.**

## Q3 — Top-bar search placeholder visual pattern

No existing search-input or keyboard-shortcut-hint pattern exists in this codebase. The grep hits
for "kbd"/"⌘"/"Ctrl" are false positives (unrelated prose in `server/theming/actions.ts` and
`server/merchant/actions.ts`) except one real signal: `src/components/ui/tooltip.tsx` (lines
53,58 — installed via `shadcn`) already contains CSS selectors keyed to
`data-slot="kbd"` (`has-data-[slot=kbd]:pr-1.5`, `**:data-[slot=kbd]:...`), which is shadcn's
registry convention for a `Kbd` primitive **that has not been added to this project**
(no `src/components/ui/kbd.tsx` exists — confirmed via glob of the full `ui/` directory, 24 files,
no `kbd`). `[VERIFIED: codebase — glob of src/components/ui/*.tsx]`

**Recommendation:** Reuse `Input` (`src/components/ui/input.tsx`) for the search box itself — it
already has the right base styling (`h-8 rounded-lg border-input bg-transparent ...
placeholder:text-muted-foreground focus-visible:ring-ring/50`) and needs no changes; a centered,
wider variant is a `className` override at the call site, not a new component. For the
keyboard-shortcut hint, hand-build a small new `src/components/ui/kbd.tsx` (a single `<kbd>`
wrapper following the exact house style of `card.tsx`/`badge.tsx`: `data-slot="kbd"`, `cn()`,
`React.ComponentProps<"kbd">`) rather than pulling a new registry component over the network mid-task
— this keeps the change entirely local, avoids the package-legitimacy gate, and satisfies the
`data-slot="kbd"` selector `tooltip.tsx` already anticipates, e.g.:

```tsx
// src/components/ui/kbd.tsx — new file, house style matches card.tsx/badge.tsx
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 items-center justify-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground select-none",
        className
      )}
      {...props}
    />
  );
}
export { Kbd };
```

The visible copy for the input's placeholder text and any accessible label must be added under
`strings.dashboard` (e.g. `strings.dashboard.topbar.searchPlaceholder`), matching the existing
`strings.dashboard.nav` nesting pattern (`src/lib/strings.ts:459,485`) — no literal string in the
component, consistent with the project-wide convention documented above.

**Confidence: HIGH** on what exists in the codebase (verified by direct read/glob); **MEDIUM** on
the exact `Kbd` styling recommendation, which is original, unreviewed markup rather than something
pulled from an official source — flagged in Assumptions Log.

## Q4 — `<DashboardCard>` shared component precedent

`Card` (`src/components/ui/card.tsx`) is already installed and used in 11 files, including
`src/app/login/page.tsx` (`Card`, `CardContent`) and `src/app/signup/page.tsx`. Its API:

- `Card` — root, `size?: "default" | "sm"`, base classes `bg-card text-card-foreground ring-1
  ring-foreground/10 rounded-xl`, spacing driven by a local `--card-spacing` custom property
  (`--spacing(4)` default, `--spacing(3)` at `size="sm"`) that callers already override inline
  (see `login/page.tsx:46`: `[--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]`).
- `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` — all
  present, all read the same `--card-spacing` variable, all follow the `data-slot="card-*"` +
  `cn()` house style.
- Existing call sites already demonstrate the override pattern needed for a "page-background
  elevated card" look distinct from the login form's own `bg-muted`/`border-border` override
  (`login/page.tsx:46` deliberately overrides `Card`'s default `bg-card ring-1` to a flatter
  `bg-muted border border-border ring-0` for its specific centered-form context) — i.e. `Card`'s
  defaults (`bg-card`, `ring-1 ring-foreground/10`, `rounded-xl`) are themselves already the
  "elevated card on a page" look the Shopify-style dashboard content area wants, with no override
  needed for that use case.

**Recommendation:** `DashboardCard` should be a thin wrapper composing `Card`
(`+ CardHeader/CardTitle/CardContent` as needed) rather than a new primitive — reusing `Card`'s
existing defaults directly satisfies "white card-based content area on a soft gray background"
with zero new CSS, since `--card` is already white (`oklch(1 0 0)`, `globals.css:104`) against a
`--background` of slate-50 (`oklch(0.984 0.003 247.9)`, already the page background via
`body { @apply bg-background }`). No new token is needed for the "soft gray background" — it
already exists as `--background` and is already applied globally.
`[VERIFIED: codebase, src/components/ui/card.tsx, src/app/login/page.tsx:46, src/app/globals.css:92-104,338-340]`

**Confidence: HIGH.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sidebar collapse/off-canvas/focus-trap behavior | A new mobile drawer or collapse state machine | Existing `Sidebar`/`SidebarProvider`/`useSidebar` (`src/components/ui/sidebar.tsx`) | Already ships this; already wired into `app-sidebar.tsx` and `(dashboard)/layout.tsx` |
| Elevated "card" surface styling | A new `bg-white rounded-xl shadow` div ad hoc per page | `Card` (`src/components/ui/card.tsx`) | Already installed, already the exact visual (white on slate-50), used elsewhere in the app |
| Keyboard-shortcut hint chip | A styled `<span>` invented per call site | New shared `Kbd` primitive (Q3) | `tooltip.tsx` already has selectors anticipating a `data-slot="kbd"` convention; a shared primitive keeps any future real search feature's hint consistent |
| Dark rail theming | New literal hex/oklch colors invented for a "Shopify dark" palette | The already-authored `.dark` block's `--sidebar-*` values, copied into a new narrow selector (Q1) | The values are already derived, already color-reviewed as part of this design system's `.dark` inversion (`globals.css:85-91` header), and reusing them avoids introducing an un-reviewed third palette |

**Key insight:** every piece needed for this restyle already exists in the codebase in some form
(sidebar behavior, card surface, color tokens) — the task is scoping and composition, not new
primitives, except for the one genuinely-missing `Kbd` component.

## Common Pitfalls

### Pitfall 1: Reusing `.dark` breaks the pending-claims badge's contrast
**What goes wrong:** Wrapping the sidebar in `className="dark"` (the obvious-looking fix) silently
flips `--gold-accent-foreground` from gold-900 to gold-100 while `--gold-accent` itself stays
unchanged, producing near-invisible badge text.
**Why it happens:** `.dark` is a full palette inversion, not a sidebar-scoped one; the gold family
deliberately does not invert (per its own code comment) but the two-value pair (fill + foreground)
was authored assuming both members of the pair stay together.
**How to avoid:** Use a new, narrow selector containing only the 8 `--sidebar-*` tokens (Q1).
**Warning signs:** Pending-claims count badge (`app-sidebar.tsx`'s `Badge variant="gold"`) reads
as blank/illegible against its own fill in a dark-scoped rail — visually obvious in review, but
would slip past `tests/unit/dashboard-nav.test.ts` (it counts `variant="gold"` occurrences, not
contrast).

### Pitfall 2: Wrapping `<Sidebar>` from `app-sidebar.tsx` misses the mobile sheet
**What goes wrong:** A `className="dark"` (or any scope class) applied only where `<Sidebar>` is
invoked in `app-sidebar.tsx` themes the desktop rail but not the mobile off-canvas sheet, because
`SheetContent` renders through a `Portal` to `document.body` and is outside that wrapper's DOM
subtree.
**Why it happens:** React portals break DOM ancestry for CSS cascade purposes even though they
preserve React component-tree ancestry for context/events.
**How to avoid:** Apply the scope class inside `src/components/ui/sidebar.tsx`'s `Sidebar()`
function itself, directly on both the desktop container and the mobile `SheetContent` (Q1).
**Warning signs:** Rail looks correct on desktop (≥1024px), reverts to white/light on the mobile
off-canvas sheet (<1024px, via `SidebarTrigger`) — easy to miss if only tested at desktop width.

### Pitfall 3: `className` passed as a prop to `Sidebar` doesn't reach the mobile branch either
**What goes wrong:** Any prop-based approach that relies on `app-sidebar.tsx` passing a className
down through `<Sidebar>`'s own `className` prop has the same gap as Pitfall 2 — confirmed by
tracing the current `className="border-sidebar-border"` usage, which today already only reaches
the desktop `sidebar-container` div, never the mobile `SheetContent`.
**Why it happens:** `Sidebar()` destructures `className` out of `props` before spreading the rest
onto `<Sheet {...props}>`, and the mobile branch's `SheetContent` has its own separate, hardcoded
`className` string unrelated to the one passed to `Sidebar`.
**How to avoid:** Same as Pitfall 2 — edit the two hardcoded className strings inside
`sidebar.tsx` directly; do not thread a new prop through if it will only get wired to one branch.

### Pitfall 4: Forgetting `strings.ts` for the new search/kbd copy
**What goes wrong:** Inlining placeholder text like `"Search"` or an aria-label directly in a new
top-bar component.
**Why it happens:** The search input is new UI with no existing string to copy from, easy to
type inline "just for now."
**How to avoid:** Add the new keys under `strings.dashboard` (sibling to the existing `nav`
namespace) before writing the component. Note: `tests/unit/dashboard-nav.test.ts`'s prose-literal
scanner is scoped to `app-sidebar.tsx` only — a new top-bar file would not be caught by that
specific test, so this is a discipline point, not a build-breaking one, unless the plan extends
that test's `SIDEBAR_FILE`/scan scope to the new component.
**Warning signs:** `npm run lint` won't catch this (no ESLint rule for inline prose); only a
manual/code-review check will.

## Code Examples

### Scoped sidebar dark theme (globals.css — new block, place after `.dark`)
```css
/* Source: pattern verified against src/app/globals.css's existing
   [data-surface="storefront"] scope, same file, lines 210-264 */
.sidebar-dark-scope {
  --sidebar: oklch(0.208 0.04 265.8);
  --sidebar-foreground: oklch(0.984 0.003 247.9);
  --sidebar-primary: oklch(0.623 0.188 259.8);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.279 0.037 260);
  --sidebar-accent-foreground: oklch(0.984 0.003 247.9);
  --sidebar-border: oklch(0.279 0.037 260);
  --sidebar-ring: oklch(0.623 0.188 259.8);
}
```

### Applying it inside `src/components/ui/sidebar.tsx` (both render paths)
```tsx
// Desktop branch, ~line 255
<div
  data-sidebar="sidebar"
  data-slot="sidebar-inner"
  className="sidebar-dark-scope flex size-full flex-col bg-sidebar text-sidebar-foreground ..."
>

// Mobile branch, ~line 198 — SheetContent, portaled, needs the class directly
<SheetContent
  ...
  className="sidebar-dark-scope w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
  ...
>
```

### Reusing `Card` for `DashboardCard` (compose, don't reinvent)
```tsx
// Source: pattern from src/app/login/page.tsx:46 (Card override precedent)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DashboardCard({ title, children, className, ...props }: /* ... */) {
  return (
    <Card className={cn(className)} {...props}>
      {title ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact visual styling proposed for the new `Kbd` primitive (`h-5`, `rounded border`, `bg-muted`, `font-mono text-xs`) | Q3 / Code Examples | Low — purely cosmetic, easy to adjust in review; not sourced from an official shadcn `kbd` registry component (none was fetched — this project's `components.json` uses the `base-nova` style and no network call was made to check if an official `kbd` block exists for it) |
| A2 | Recommended class name `.sidebar-dark-scope` is a suggested name, not a required one | Q1 | None if renamed consistently — the mechanism (narrow selector, not `.dark`) is what matters, not the literal identifier |

## Open Questions

1. **Should the mobile off-canvas sheet even get the dark rail, or should it stay light?**
   - What we know: Locked decision #1 says "dark left icon-nav rail" without a breakpoint
     qualifier; Shopify's own mobile nav is not a dark rail (it's a different pattern entirely on
     small screens).
   - What's unclear: Whether the user's intent was specifically "desktop rail is dark" or
     "the sidebar component, wherever it renders, is dark."
   - Recommendation: Default to applying it everywhere the `Sidebar` component renders (simplest,
     most consistent, matches "dark rail" read literally) unless the planner surfaces this back to
     the user — Pitfall 2/3 above ensure the implementation *can* do either consistently once
     understood, so this is a design call, not a technical constraint.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | `vitest.config.ts` (two projects: `unit`, `isolation`) |
| Quick run command | `npm run test:unit` (`vitest run tests/unit --reporter=dot`) |
| Full suite command | `npm run test:full` (`dotenv -e .env.test -- vitest run`) |

### Phase Requirements → Test Map
This is a quick task with no formal `REQUIREMENTS.md` requirement IDs. The relevant existing
contract test and what it does/doesn't cover:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|---------------------|-------------|
| Nav rail still offers all 7 destinations, `aria-current`, no inline copy, gold budget = 1 in `app-sidebar.tsx` | static-analysis unit | `npx vitest run tests/unit/dashboard-nav.test.ts` | ✅ existing, must keep passing |
| Storefront token isolation unaffected by new dashboard-only class/tokens | static-analysis unit | `npx vitest run tests/unit/surface-token-isolation.test.ts` | ✅ existing — new `.sidebar-dark-scope` selector is dashboard-only and outside `[data-surface="storefront"]`, so it is out of that test's scan scope by construction; still worth a sanity run |
| Gold badge legible against `.sidebar-dark-scope` fill | visual/manual | none automated | ❌ — no contrast-ratio test exists in this repo; this is a manual-review point (Pitfall 1) |

### Sampling Rate
- **Per task commit:** `npm run test:unit`
- **Phase gate:** `npm run test:unit` green, plus a manual visual check at both desktop (≥1024px)
  and mobile (<1024px, via the sheet trigger) widths, since no automated test covers rendering.

### Wave 0 Gaps
- No automated contrast/visual-regression test exists for the sidebar restyle — acceptable given
  this is a quick task, but the planner should include an explicit manual verification step (both
  breakpoints, badge legibility) rather than relying on `test:unit` alone to catch a regression.
- `Kbd` is a brand-new component with no existing test file; a lightweight rendering smoke test is
  optional given it is non-interactive and purely presentational.

## Sources

### Primary (HIGH confidence)
- Codebase: `src/app/globals.css`, `src/components/ui/sidebar.tsx`, `src/components/app-sidebar.tsx`,
  `src/components/ui/sheet.tsx`, `src/components/ui/card.tsx`, `src/components/ui/input.tsx`,
  `src/components/ui/badge.tsx`, `src/components/ui/tooltip.tsx`, `src/app/login/page.tsx`,
  `src/app/(dashboard)/layout.tsx`, `tests/unit/dashboard-nav.test.ts`, `src/lib/strings.ts`,
  `components.json` — all read directly, this session.
- [ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4) — confirms `@theme
  inline` + `.dark` override pattern preserves runtime CSS-variable resolution (not build-time
  baking) for exactly the `--color-x: var(--x)` shape used throughout this project's `globals.css`.
- [tailwindcss.com/docs/theme](https://tailwindcss.com/docs/theme) — general `@theme` vs `@theme
  inline` semantics (used to sanity-check the shadcn-specific claim above; the general docs page's
  wording is more easily misread out of context than the shadcn-specific page, which describes
  this project's exact pattern).

### Secondary (MEDIUM confidence)
- None — no unverified web claims made in this research beyond the `Kbd` styling recommendation
  (A1), which is original markup, not sourced.

## Metadata

**Confidence breakdown:**
- Q1 (sidebar scoping mechanism + pitfalls): HIGH — verified against live, tested precedent in
  the same file plus official docs cross-check.
- Q2 (shadcn variant/theming support): HIGH — direct source read.
- Q3 (search/kbd pattern): HIGH on "nothing exists yet" (verified by exhaustive glob), MEDIUM on
  the specific new `Kbd` styling proposed (original, unreviewed).
- Q4 (Card precedent): HIGH — direct source read, existing call sites confirm the pattern.

**Research date:** 2026-09-03
**Valid until:** No expiry driver — this is a static analysis of code already in the repo, not a
fast-moving external dependency; re-verify only if `globals.css`, `sidebar.tsx`, or `sheet.tsx`
change before this task executes.
