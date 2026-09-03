---
phase: quick/260903-ugl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/globals.css
  - src/components/ui/sidebar.tsx
  - src/components/ui/kbd.tsx
  - src/components/dashboard-card.tsx
  - src/lib/strings.ts
  - src/components/dashboard-topbar-search.tsx
  - src/app/(dashboard)/layout.tsx
autonomous: false
requirements: [QUICK-260903-ugl]

must_haves:
  truths:
    - "The desktop sidebar rail (>=1024px) renders on a dark slate-900 fill with slate-50 text, not the previous white fill."
    - "The mobile off-canvas sidebar sheet (<1024px, opened via the header trigger) renders with the identical dark fill and text as the desktop rail — not white."
    - "The pending-claims gold badge stays clearly legible (gold-900 text on its 15%-opacity gold fill) against the dark rail; the badge's own tokens are untouched by the new scope."
    - "A centered, styled, non-functional search input with a keyboard-shortcut hint chip renders in the dashboard top bar at sm widths and above."
    - "Typing in the search input does nothing beyond local text entry — no request is issued, no dropdown appears, no page navigates."
    - "Every existing dashboard nav destination, href, badge, and 44px touch target is unchanged from before this task."
    - "The storefront surface (src/app/s/[slug]/**) renders exactly as before, with zero references to any file or class this task introduces."
    - "(dashboard)/layout.tsx still calls requireMerchantContext() for data only and still performs no redirect of its own."
  artifacts:
    - path: "src/app/globals.css"
      provides: "New, narrow .sidebar-dark-scope selector carrying only the 8 --sidebar-* tokens copied from the existing .dark block"
      contains: "sidebar-dark-scope"
    - path: "src/components/ui/sidebar.tsx"
      provides: "sidebar-dark-scope applied at all three DOM nodes that already hardcode bg-sidebar/text-sidebar-foreground (desktop, mobile SheetContent, collapsible=none)"
      contains: "sidebar-dark-scope"
    - path: "src/components/ui/kbd.tsx"
      provides: "New Kbd primitive satisfying tooltip.tsx's pre-existing data-slot=\"kbd\" selectors"
      contains: "data-slot=\"kbd\""
      min_lines: 12
    - path: "src/components/dashboard-card.tsx"
      provides: "New DashboardCard shell primitive composing the existing Card, for future page retrofits — no consumer yet by design"
      contains: "DashboardCard"
      min_lines: 20
    - path: "src/components/dashboard-topbar-search.tsx"
      provides: "Visual-only, centered top-bar search box with a Kbd shortcut hint"
      contains: "DashboardTopbarSearch"
      min_lines: 18
    - path: "src/app/(dashboard)/layout.tsx"
      provides: "Wires DashboardTopbarSearch into the existing header without touching the auth/data logic above it"
      contains: "DashboardTopbarSearch"
    - path: "src/lib/strings.ts"
      provides: "New dashboard.topbar copy namespace (searchPlaceholder, searchAriaLabel, searchShortcutHint)"
      contains: "topbar:"
  key_links:
    - from: "src/components/ui/sidebar.tsx"
      to: "src/app/globals.css"
      via: "className=\"sidebar-dark-scope ...\" resolving the 8 --sidebar-* custom properties declared in globals.css"
      pattern: "sidebar-dark-scope"
    - from: "src/app/(dashboard)/layout.tsx"
      to: "src/components/dashboard-topbar-search.tsx"
      via: "import { DashboardTopbarSearch } from \"@/components/dashboard-topbar-search\" rendered inside the header"
      pattern: "DashboardTopbarSearch"
    - from: "src/components/dashboard-topbar-search.tsx"
      to: "src/lib/strings.ts"
      via: "strings.dashboard.topbar.* read for placeholder, aria-label and the shortcut hint"
      pattern: "strings\\.dashboard\\.topbar"
    - from: "src/components/dashboard-card.tsx"
      to: "src/components/ui/card.tsx"
      via: "Card/CardHeader/CardTitle/CardContent composition, no new tokens"
      pattern: "from \"@/components/ui/card\""
---

<objective>
Restyle the dashboard shell (sidebar rail + top bar) toward Shopify admin's structural
pattern — a dark left icon-nav rail, a top bar with a non-functional search placeholder,
and a new `DashboardCard` primitive for future use — while keeping EINORT's own locked
blue/gold/slate colors untouched everywhere else. Shell only, per CONTEXT.md's locked
decision #4: this task does NOT retrofit the six existing dashboard pages' content into
the new card system, and it does NOT touch the storefront surface
(`src/app/s/[slug]/**`) at all.

Purpose: the current dashboard rail is flat white and structurally identical to the
merchant's dashboard content, which reads as undifferentiated chrome. The user supplied
Shopify admin screenshots and asked for the same layout skeleton — dark rail, search bar,
card-based content — without wanting Shopify's actual color palette.

Output: a new narrowly-scoped CSS class powering a dark sidebar rail on both desktop and
mobile, a visual-only top-bar search box with a keyboard-shortcut hint, and a new
`DashboardCard` shared component ready for a future, separate retrofit task to adopt.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/quick/260903-ugl-dashboard-shell-redesign/260903-ugl-CONTEXT.md
@.planning/quick/260903-ugl-dashboard-shell-redesign/260903-ugl-RESEARCH.md

@src/app/globals.css
@src/components/ui/sidebar.tsx
@src/components/app-sidebar.tsx
@src/app/(dashboard)/layout.tsx
@src/components/ui/card.tsx
@src/components/ui/input.tsx
@src/components/ui/badge.tsx
@src/components/ui/tooltip.tsx
@src/lib/strings.ts
@tests/unit/dashboard-nav.test.ts
@tests/unit/surface-token-isolation.test.ts

<interfaces>
<!-- Exact current source this plan edits. Do not re-explore the codebase for these — -->
<!-- read the values below directly. -->

`src/app/globals.css` — the `.dark` block (do not edit it; copy its `--sidebar-*` values
verbatim into the new selector) currently ends at line 332, immediately followed by
`@layer base {`. The eight tokens to copy, exactly as they read in `.dark` today:

    --sidebar: oklch(0.208 0.04 265.8);              /* slate-900 */
    --sidebar-foreground: oklch(0.984 0.003 247.9);  /* slate-50  */
    --sidebar-primary: oklch(0.623 0.188 259.8);     /* brand-500 */
    --sidebar-primary-foreground: oklch(1 0 0);
    --sidebar-accent: oklch(0.279 0.037 260);        /* slate-800 */
    --sidebar-accent-foreground: oklch(0.984 0.003 247.9); /* slate-50 */
    --sidebar-border: oklch(0.279 0.037 260);        /* slate-800 */
    --sidebar-ring: oklch(0.623 0.188 259.8);        /* brand-500 */

`@theme inline` already maps every one of these to a Tailwind utility
(`--color-sidebar: var(--sidebar)`, etc.) — no change needed there. The gold badge's
own tokens, `--gold-accent` / `--gold-accent-foreground`, are declared in `:root` only
and are NOT among the eight above — this is exactly why a narrow selector is safe where
`.dark` (which also touches `--gold-accent-foreground`) is not.

`src/components/ui/sidebar.tsx` — the three literal `className` strings that already
hardcode `bg-sidebar`/`text-sidebar-foreground`, verified at these exact locations:

1. `collapsible === "none"` branch (~line 185):
   `"flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground"`
2. Mobile `<SheetContent>` (~line 203):
   `"w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"`
3. Desktop `data-slot="sidebar-inner"` div (~line 258):
   `"flex size-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border"`

A JSDoc comment already sits directly above `function Sidebar(...)` (~lines 152-164)
documenting one prior deliberate override (`lg:` vs the registry's `md:`). This task's
own override belongs in that same comment, as a second paragraph — see Task 1.

`src/app/(dashboard)/layout.tsx` — current header block (inside `<SidebarInset>`):

    <header className="flex min-h-14 items-center gap-3 border-b border-border px-4 sm:px-8">
      <SidebarTrigger
        aria-label={strings.dashboard.nav.openNavigation}
        className="lg:hidden"
      />
      <span className="text-sm leading-normal font-semibold text-foreground">
        {ctx.storeName}
      </span>
      {/* Calls the signOutMerchant server action; see sign-out-button.tsx. */}
      <div className="ml-auto">
        <SignOutButton />
      </div>
    </header>

Imports currently read, in order: `AppSidebar` from `@/components/app-sidebar`, then
`SidebarInset`/`SidebarProvider`/`SidebarTrigger` from `@/components/ui/sidebar`, then
`Toaster` from `@/components/ui/sonner`, then `strings` from `@/lib/strings`, then two
server-side imports, then `SignOutButton` and `TrialBanner` as relative imports. The
`requireMerchantContext()` call and its own long header comment (why this layout is NOT
the auth boundary) sit above the JSX return and must not move or be touched.

`src/lib/strings.ts` — the `dashboard` object's `nav` sub-object closes at line 508
(`openNavigation: "Open navigation",\n    },`), immediately followed by a blank line and
`emptyHeading: "Your store is live",` at line 510. Both are nested one level under
`dashboard: {` (4-space indent for `nav`/new sibling keys).

`src/components/ui/card.tsx` exports `Card`, `CardHeader`, `CardTitle`, `CardContent`
(plus `CardDescription`, `CardAction`, `CardFooter`, unused here). `Card` accepts
`size?: "default" | "sm"` and spreads the rest onto a `<div data-slot="card">` whose
defaults (`bg-card`, `ring-1 ring-foreground/10`, `rounded-xl`) already are the
"elevated white card on slate-50" look — no override needed.

`src/components/ui/input.tsx` exports `Input`, a thin wrapper over `@base-ui/react`'s
`Input` primitive with `data-slot="input"` and the project's own focus/border styling.
No `"use client"` in this file — it has no hooks and needs none for this task's
non-functional use.

`src/components/ui/tooltip.tsx` already contains `has-data-[slot=kbd]:pr-1.5` and
`**:data-[slot=kbd]:...` selectors (lines 53, 58) anticipating a `Kbd` primitive that
does not exist yet in this codebase — confirmed by glob, no `kbd.tsx` under
`src/components/ui/`.

Badge/gold budget (`src/components/app-sidebar.tsx`, `src/components/ui/badge.tsx`):
`variant="gold"` appears exactly once today, on the pending-claims count badge, styled
`bg-gold-accent/15 text-gold-accent-foreground`. `tests/unit/dashboard-nav.test.ts`
fails the build if a second `variant="gold"` appears anywhere under `src/app` or
`src/components`. This plan adds zero.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scope a dark rail to the sidebar only (desktop + mobile)</name>
  <files>src/app/globals.css, src/components/ui/sidebar.tsx</files>
  <action>
**1a. `src/app/globals.css`.** Immediately after the `.dark { ... }` block closes
(currently line 332) and before `@layer base {`, insert a new top-level selector named
`.sidebar-dark-scope` containing exactly the eight `--sidebar-*` custom properties shown
verbatim in this plan's `<interfaces>` block above — copy the values, do not re-derive
them. Precede it with a comment (in this file's existing documentation voice — see the
comment above `.dark` for the tone to match) explaining: this is a dark-themed sidebar
rail on an otherwise light dashboard (Shopify's structure, EINORT's own colors), NOT
real dark mode; it is deliberately NOT `.dark` itself, because `.dark` also redeclares
`--gold-accent-foreground` to a light value while `--gold-accent` (the fill) does not
invert, which would make the pending-claims badge's text illegible against its own
fill; the values below are copied from `.dark` so a future edit to that block's sidebar
tokens should be mirrored here; scoped to exactly these 8 tokens so nothing outside the
sidebar is affected. Reference quick task 260903-ugl. Do not add, remove, or touch any
other selector, block, or the `@theme inline` mapping — the existing
`--color-sidebar: var(--sidebar)` family already makes these tokens reachable as
Tailwind utilities with no further change.

**1b. `src/components/ui/sidebar.tsx`.** Prepend the literal string `"sidebar-dark-scope "`
to the front of each of the three `className` strings identified in this plan's
`<interfaces>` block (the `collapsible === "none"` branch, the mobile `SheetContent`,
and the desktop `sidebar-inner` div) — three separate, minimal edits, each adding only
the one new class token at the start of the existing string. Do not reorder, remove, or
rewrite any other part of those class strings, and do not touch any other `className`
in this file.

Extend the existing JSDoc comment directly above `function Sidebar(...)` with a second
paragraph (do not replace the first, which documents the unrelated `lg:` breakpoint
override) recording: a `sidebar-dark-scope` class is now applied at all three places
this component hardcodes `bg-sidebar`/`text-sidebar-foreground`, added by quick task
260903-ugl; it is deliberately NOT the shadcn `.dark` class (see the comment on
`.sidebar-dark-scope` in `globals.css` for why); it is applied inside this file rather
than as a `className` prop from `app-sidebar.tsx` because the mobile branch renders
through `SheetContent` → `SheetPortal` → base-ui's `Dialog.Portal`, which teleports its
DOM node to `document.body` outside any ancestor wrapper's subtree — a class passed
from a parent component would style the desktop rail and silently never reach the
mobile sheet; if a future `shadcn add sidebar` overwrites this file, re-apply
`sidebar-dark-scope` at all three sites alongside the existing `lg:` fix.

Do not touch `src/components/app-sidebar.tsx` in this task — its own
`className="border-sidebar-border"` on `<Sidebar>` is untouched and continues to work
exactly as it does today (it still only reaches the desktop branch, which is fine and
pre-existing behavior, unrelated to this change).
  </action>
  <verify>
    <automated>test $(grep -c "sidebar-dark-scope" src/app/globals.css) -eq 1 && test $(grep -c "sidebar-dark-scope" src/components/ui/sidebar.tsx) -eq 3 && npx vitest run tests/unit/dashboard-nav.test.ts tests/unit/surface-token-isolation.test.ts --reporter=dot && npm run lint && npm run typecheck</automated>
  </verify>
  <done>`.sidebar-dark-scope` is declared exactly once in `globals.css` with all 8
`--sidebar-*` tokens copied from `.dark`; the class is applied at exactly the three
hardcoded `bg-sidebar` sites in `sidebar.tsx`; `dashboard-nav.test.ts` and
`surface-token-isolation.test.ts` both still pass unmodified; lint and typecheck are
clean.</done>
</task>

<task type="auto">
  <name>Task 2: Add the Kbd primitive, the DashboardCard shell, and their copy</name>
  <files>src/components/ui/kbd.tsx, src/components/dashboard-card.tsx, src/lib/strings.ts</files>
  <action>
**2a. `src/components/ui/kbd.tsx` (new file).** Create a small, non-interactive
keyboard-shortcut chip following this codebase's exact `ui/` house style (`data-slot`,
`cn()`, `React.ComponentProps<"kbd">` — see `badge.tsx`/`card.tsx` for the pattern; no
`"use client"`, it has no hooks). It satisfies the `data-slot="kbd"` selectors
`tooltip.tsx` already carries. Base classes:
`"pointer-events-none inline-flex h-5 items-center justify-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground select-none"`
merged with `className` via `cn()`, exactly like every other `ui/` primitive in this
repo. Add a doc comment stating it is purely decorative — it renders beside a
non-functional search input (Task 3) and carries no keydown listener anywhere in the
codebase — and that a future task wiring up real search may reuse it as-is. Export
`{ Kbd }`.

**2b. `src/components/dashboard-card.tsx` (new file).** Create `DashboardCard`, a thin
composition of the existing `Card`/`CardHeader`/`CardTitle`/`CardContent` — do not
invent new tokens or new styling; `Card`'s own defaults already produce the target
look. Props: `title?: React.ReactNode` (renders inside `CardHeader`/`CardTitle` only
when provided) and `children: React.ReactNode` (renders inside `CardContent`), plus
every prop `Card` itself accepts (spread through). Add a doc comment stating plainly:
this component has **no consumer yet** — CONTEXT.md's locked decision #4 explicitly
defers retrofitting the six existing dashboard pages (Overview, Products, Orders,
Claims, Plan, Payment Settings) into it to a separate, future task, and this file is
only the shared primitive that task will import; do not wire it into any existing page
as part of this task. Export `{ DashboardCard }`.

**2c. `src/lib/strings.ts`.** Add a new `topbar` object as a sibling of `nav` inside
`dashboard` (same 4-space nesting level as `nav`), placed immediately after `nav`'s
closing `},` and before `emptyHeading`. Three keys: `searchPlaceholder: "Search"`,
`searchAriaLabel: "Search"`, `searchShortcutHint: "⌘K"`. Give the object a doc comment
in this file's existing voice stating plainly that this is a VISUAL PLACEHOLDER ONLY
per CONTEXT.md's locked decision #3 — no search Server Action or query is wired to it
anywhere in the codebase, real cross-entity search across products/orders/customers is
a deliberately separate future task, and these strings existing is not a sign the
feature is live. Note on `searchShortcutHint` specifically that it is decorative and
that no keydown listener is registered anywhere in this task.
  </action>
  <verify>
    <automated>test -f src/components/ui/kbd.tsx &amp;&amp; grep -q 'data-slot="kbd"' src/components/ui/kbd.tsx &amp;&amp; test -f src/components/dashboard-card.tsx &amp;&amp; grep -q "export function DashboardCard\|export { DashboardCard" src/components/dashboard-card.tsx &amp;&amp; grep -q "topbar: {" src/lib/strings.ts &amp;&amp; grep -q "searchPlaceholder" src/lib/strings.ts &amp;&amp; grep -q "searchShortcutHint" src/lib/strings.ts &amp;&amp; ! grep -q 'variant="gold"' src/components/ui/kbd.tsx src/components/dashboard-card.tsx &amp;&amp; npm run lint &amp;&amp; npm run typecheck</automated>
  </verify>
  <done>`kbd.tsx` exists with `data-slot="kbd"`; `dashboard-card.tsx` exists exporting
`DashboardCard`, composing `Card` with no new tokens and no page consumer; `strings.ts`
carries `dashboard.topbar` with all three keys; lint and typecheck are clean; neither
new file spends the gold budget.</done>
</task>

<task type="auto">
  <name>Task 3: Build the top-bar search placeholder and wire it into the dashboard shell</name>
  <files>src/components/dashboard-topbar-search.tsx, src/app/(dashboard)/layout.tsx</files>
  <action>
**3a. `src/components/dashboard-topbar-search.tsx` (new file).** A Server-Component-
compatible function (no `"use client"` — it has no state, no `onChange`, no keydown
listener) named `DashboardTopbarSearch` that renders: an outer wrapper
`className="hidden flex-1 sm:block"` (hidden on narrow widths where the header already
carries the sidebar trigger, store name, and sign-out control; visible and taking the
header's remaining flex space from `sm` up); inside it, a `relative mx-auto w-full
max-w-md` div containing, in order: a decorative `Search` icon from `lucide-react`
(`aria-hidden="true"`, absolutely positioned at the input's left edge, vertically
centered, `text-muted-foreground`, `pointer-events-none`); the existing `Input`
component (`type="search"`, `placeholder={strings.dashboard.topbar.searchPlaceholder}`,
`aria-label={strings.dashboard.topbar.searchAriaLabel}`, styled `h-8 rounded-lg
bg-muted` with left padding cleared for the icon and right padding cleared for the
`Kbd` chip — do not disable the input; it stays a real, focusable, typable element,
non-functional only because nothing is wired to its value); the new `Kbd` component
(`aria-hidden="true"`, absolutely positioned at the input's right edge, vertically
centered, `pointer-events-none`) rendering `{strings.dashboard.topbar.searchShortcutHint}`
as its child. Add a doc comment: this is CONTEXT.md's locked decision #3, visual
placeholder only, deliberately a Server Component since there is nothing to wire up,
and it is hidden below `sm` on purpose because the header is already full at that width.
Export `{ DashboardTopbarSearch }`.

**3b. `src/app/(dashboard)/layout.tsx`.** Add one import,
`import { DashboardTopbarSearch } from "@/components/dashboard-topbar-search";`,
positioned alphabetically among the existing `@/components/*` imports (after
`AppSidebar`, before the `ui/sidebar` import group). Inside the existing `<header>`,
insert `<DashboardTopbarSearch />` between the store-name `<span>` and the comment
immediately preceding the `ml-auto` sign-out `<div>` — do not change the `<header>`'s
own `className`, do not change the `SidebarTrigger`, the store-name `span`, or the
`SignOutButton`/`ml-auto` div in any way, and do not touch anything above the JSX
`return` (the `requireMerchantContext()` call, the `pendingClaimCount` call, or any of
the header comments explaining why this file is not the auth boundary). This is a pure
JSX insertion plus one import — no logic, no data flow, no auth-path change.

**3c. Full regression gate.** Run, in order:

    npm run lint
    npm run typecheck
    npm run build
    npm run test:unit

`npm run test:unit` runs the entire `tests/unit` suite, which includes
`dashboard-nav.test.ts` and `surface-token-isolation.test.ts` — both must still pass,
unmodified, with the gold-accent budget still reporting exactly one spender in
`app-sidebar.tsx`. If `npm run build` fails specifically with the known
Turbopack/Windows-junction `node_modules` symlink error inside a worktree on this
platform, record that in the summary and treat lint + typecheck + test:unit as the
evidence bar — that is a confirmed pre-existing environmental issue, not something this
plan's changes caused. Any other build failure must be fixed, not waived.

Additionally confirm, by grep, that no file or class this plan introduces is referenced
anywhere under the storefront tree, and that the dashboard layout still calls the
merchant DAL and still performs no redirect of its own — see `<verify>` below for the
exact commands.
  </action>
  <verify>
    <automated>test -f src/components/dashboard-topbar-search.tsx &amp;&amp; grep -q "export function DashboardTopbarSearch\|export { DashboardTopbarSearch" src/components/dashboard-topbar-search.tsx &amp;&amp; grep -q "DashboardTopbarSearch" "src/app/(dashboard)/layout.tsx" &amp;&amp; grep -q "requireMerchantContext" "src/app/(dashboard)/layout.tsx" &amp;&amp; ! grep -q "redirect(" "src/app/(dashboard)/layout.tsx" &amp;&amp; ! grep -rlE "sidebar-dark-scope|dashboard-topbar-search|DashboardTopbarSearch|dashboard-card|DashboardCard|components/ui/kbd|\bKbd\b" src/app/s &amp;&amp; npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test:unit</automated>
  </verify>
  <done>`DashboardTopbarSearch` exists and is imported and rendered inside the
dashboard header; `(dashboard)/layout.tsx` still calls `requireMerchantContext()` and
still contains no `redirect(`; a recursive grep of `src/app/s` finds zero references to
any file or class this plan introduces; lint, typecheck, and the full `test:unit` suite
are all green (build green too, modulo the documented Windows/Turbopack exception).</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Visual confirmation of the dark rail and top-bar search</name>
  <what-built>
A dark, Shopify-structured sidebar rail (desktop and mobile), scoped narrowly so
nothing else on the dashboard changed color; a centered, non-functional top-bar search
box with a keyboard-shortcut hint chip; and a new `DashboardCard` primitive that exists
in the codebase but is not yet rendered anywhere (by design — its adoption is a
separate, future task). This kind of CSS-scoping change can pass every automated gate
while still looking wrong, so this checkpoint is required before considering the task
done.
  </what-built>
  <how-to-verify>
1. Check for an existing dev server on port 3001 before starting one (use the browser
   pane's `tabs_context` or equivalent) — only run `npm run dev` if nothing is already
   serving.
2. Sign in (or complete a fresh signup) and land on `/dashboard` at a desktop width
   (>=1024px). Confirm:
   - The left rail is dark (slate-900 fill, near-white text) — not white.
   - The pending-claims badge (visible once a claim exists, or trust the token math:
     gold-900 text on a 15%-opacity gold fill) reads clearly against the dark fill — not
     washed out or invisible. If claims are empty right now, this can be sanity-checked
     by briefly seeding one pending claim, or by trusting that `--gold-accent` and
     `--gold-accent-foreground` are untouched by `.sidebar-dark-scope` (confirm the
     class only carries the 8 `--sidebar-*` keys, no `--gold-accent*` key, by reading
     `globals.css`).
   - A centered search box with a placeholder and a small "⌘K" chip renders in the top
     bar between the store name and the sign-out control. Click into it and type — the
     text enters locally and nothing else happens (no dropdown, no navigation, no
     network request in the browser devtools Network tab).
3. Narrow the browser below 1024px, open the sidebar via the header's trigger button
   (the sheet/off-canvas panel). Confirm it is ALSO dark — same fill, same text color as
   desktop, not the pre-existing white sheet.
4. Confirm the search box is hidden below `sm` width (it should not appear on a narrow
   mobile viewport, by design — flag if this reads wrong to you).
5. Spot-check one or two other dashboard routes (e.g. `/dashboard/orders`,
   `/dashboard/plan`) to confirm only the shell (rail + top bar) changed — page content
   looks exactly as it did before this task, since `DashboardCard` was deliberately not
   wired into any page.
6. Confirm nothing on the storefront (any `/s/{slug}` page) changed.
  </how-to-verify>
  <resume-signal>Type "approved" to consider this task complete, or describe what looks wrong (name the breakpoint and the element).</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| N/A (presentational only) | This plan is a pure CSS-scoping and markup restyle. No new route, no new Server Action, no new input parsing, and no auth-path change. The new search `Input` collects no data (no `onChange`/state) and submits nothing — it is a local, uncontrolled DOM element with no listener. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ugl-01 | Tampering | `.sidebar-dark-scope` CSS scope | mitigate | Applied at exactly the three DOM nodes inside `sidebar.tsx` that already hardcode `bg-sidebar`; never on `SidebarInset` or any ancestor shared with dashboard page content. Task 1's verify greps for exactly 3 occurrences in `sidebar.tsx` and exactly 1 declaration in `globals.css`, so an accidental broader application (e.g. on `SidebarProvider`'s wrapper) fails the count check. |
| T-ugl-02 | Information Disclosure | Pending-claims gold `Badge` contrast inside the dark rail | mitigate | `.sidebar-dark-scope` deliberately carries only the 8 `--sidebar-*` tokens, not `--gold-accent`/`--gold-accent-foreground` (declared only in `:root`) — the badge's fill/text pair is untouched by construction. Task 4's checkpoint explicitly re-verifies legibility live, since no automated contrast test exists in this repo. |
| T-ugl-03 | Elevation of Privilege | `(dashboard)/layout.tsx` accidentally becoming (or drifting toward) an authorization boundary | mitigate | Task 3 only inserts one import and one JSX line inside the existing `<header>`; the `requireMerchantContext()` call and every line above the JSX return are explicitly off-limits. Task 3's verify greps confirm `requireMerchantContext` is still present and `redirect(` is still absent. |
| T-ugl-04 | Spoofing (UX, not security) | Non-functional search input appearing live | accept | The input is real and focusable (not `disabled`) so it visually matches Shopify's look per the locked decision, but nothing is wired to its value — no state, no submit, no network call exists anywhere in this diff, so no data can leave the browser through it. Risk is user confusion ("why doesn't this search anything"), not a security exposure; `strings.dashboard.topbar`'s doc comment and this plan's `<what-built>` both flag it explicitly so a future contributor does not mistake the string's existence for the feature being live. |
| T-ugl-SC | Tampering | npm/pip/cargo installs | n/a | No package is installed by this plan. `lucide-react`'s `Search` icon is an existing declared dependency. Package Legitimacy Gate does not apply. |
</threat_model>

<verification>
- `npm run lint` (`--max-warnings=0`) — clean.
- `npm run typecheck` — clean.
- `npm run build` — succeeds (or the documented Windows/Turbopack exception applies).
- `npm run test:unit` — full suite green, including `dashboard-nav.test.ts` (gold budget
  still exactly one spender, `REQUIRED_HREFS` unchanged, no inline copy) and
  `surface-token-isolation.test.ts` (bans 1-6 unaffected).
- `.sidebar-dark-scope` declared exactly once in `globals.css`, carrying only the 8
  `--sidebar-*` tokens.
- `sidebar-dark-scope` applied at exactly the 3 hardcoded `bg-sidebar` sites in
  `sidebar.tsx` — desktop, mobile `SheetContent`, and the unused-today
  `collapsible="none"` branch.
- A recursive grep of `src/app/s` finds zero references to `sidebar-dark-scope`,
  `dashboard-topbar-search`/`DashboardTopbarSearch`, `dashboard-card`/`DashboardCard`,
  or `components/ui/kbd`/`Kbd`.
- `(dashboard)/layout.tsx` still calls `requireMerchantContext()` and still contains no
  `redirect(`.
- Human visual confirmation (Task 4) on desktop rail, mobile sheet, badge legibility,
  and the search box's inert behavior.
</verification>

<success_criteria>
- The dashboard sidebar rail renders dark (slate-900/slate-50) on both desktop and the
  mobile off-canvas sheet, via one narrowly-scoped CSS class applied inside
  `sidebar.tsx` — not via `.dark`, and not via a wrapper `className` from
  `app-sidebar.tsx`.
- The pending-claims gold badge's contrast is unaffected by the dark rail.
- A centered, non-functional, Shopify-styled search input with a `Kbd` shortcut hint
  renders in the dashboard top bar at `sm` widths and above.
- `Kbd` and `DashboardCard` exist as new, reusable primitives; `DashboardCard` has
  deliberately no consumer in this task.
- Every existing nav destination, href, badge, touch target, and the two-weight type
  contract are unchanged.
- The storefront surface and `(dashboard)/layout.tsx`'s non-authorization posture are
  both untouched.
- Full gate green: lint, typecheck, build, and the full `test:unit` suite.
- Human visual confirmation completed and approved.
</success_criteria>

<output>
Create `.planning/quick/260903-ugl-dashboard-shell-redesign/260903-ugl-SUMMARY.md` when done.
</output>
