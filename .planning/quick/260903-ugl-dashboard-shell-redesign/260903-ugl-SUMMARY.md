---
phase: quick/260903-ugl
plan: 01
subsystem: ui
tags: [tailwind-css, css-custom-properties, next-app-router, shadcn, base-ui, dashboard-shell]

requires: []
provides:
  - ".sidebar-dark-scope" CSS class (globals.css) applied at the sidebar's three hardcoded bg-sidebar DOM nodes, giving both the desktop rail and the mobile off-canvas sheet a dark slate-900/slate-50 fill without touching .dark or any other surface
  - "Kbd" primitive (src/components/ui/kbd.tsx) satisfying tooltip.tsx's pre-existing data-slot="kbd" selectors
  - "DashboardCard" shell primitive (src/components/dashboard-card.tsx) composing Card/CardHeader/CardTitle/CardContent, no consumer yet by design
  - "DashboardTopbarSearch" (src/components/dashboard-topbar-search.tsx) -- visual-only, non-functional search box wired into (dashboard)/layout.tsx's header
  - "strings.dashboard.topbar" copy namespace (searchPlaceholder, searchAriaLabel, searchShortcutHint)
affects: [future dashboard page retrofit onto DashboardCard, future real cross-entity search implementation]

tech-stack:
  added: []
  patterns:
    - "Narrowly-scoped CSS variable override class (.sidebar-dark-scope) instead of .dark, to avoid collateral token bleed (--gold-accent-foreground) into an unrelated component's contrast pair"
    - "Class applied at every hardcoded DOM node inside the owning component (sidebar.tsx) rather than passed down as a className prop, because base-ui's Dialog.Portal teleports the mobile sheet outside any ancestor's subtree"

key-files:
  created:
    - src/components/ui/kbd.tsx
    - src/components/dashboard-card.tsx
    - src/components/dashboard-topbar-search.tsx
  modified:
    - src/app/globals.css
    - src/components/ui/sidebar.tsx
    - src/lib/strings.ts
    - "src/app/(dashboard)/layout.tsx"

key-decisions:
  - "Used .sidebar-dark-scope as a standalone selector (not .dark) carrying only the 8 --sidebar-* tokens, so --gold-accent-foreground is never touched and the pending-claims badge stays legible"
  - "Applied the scope class inside sidebar.tsx at all three hardcoded bg-sidebar sites rather than as a className prop from app-sidebar.tsx, because SheetContent's portal renders outside the parent's DOM subtree"
  - "DashboardCardProps omits both 'children' and 'title' from Card's spread-through props: 'children' is redefined with dashboard-card's own required-children contract, and 'title' had to be excluded because HTMLAttributes<HTMLDivElement> already declares a native string-only 'title' attribute that conflicts with the React.ReactNode title prop (TS2430) -- not anticipated by the plan's prose but required for typecheck to pass"

requirements-completed: [QUICK-260903-ugl]

duration: ~10min (Tasks 1-3) + ~20min (Task 4 verification + a real contrast bug found and fixed)
completed: 2026-09-03
status: complete
---

# Quick Task 260903-ugl: Dashboard Shell Redesign Summary

**Dark slate-900 sidebar rail scoped via a new `.sidebar-dark-scope` CSS class (desktop + mobile sheet), plus a non-functional top-bar search box with a `Kbd` shortcut chip and a new unwired `DashboardCard` primitive. Task 4's real-browser check caught a real, user-reported contrast bug (nav labels rendering near-black on the new dark fill) that passed every automated gate — root-caused and fixed by the orchestrator; all four tasks are now complete and verified live.**

## Performance

- **Duration:** ~10 min (Tasks 1-3)
- **Started:** ~2026-09-03T21:17:00Z (first edit)
- **Completed (Tasks 1-3):** 2026-09-03T21:21:06Z
- **Tasks:** 3 of 4 (Task 4 is a blocking human-verify checkpoint, not yet run)
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- Sidebar rail (desktop `sidebar-inner` div, mobile `SheetContent`, and the unused-today `collapsible="none"` branch) now carries `sidebar-dark-scope`, resolving to a slate-900 fill / slate-50 text via 8 copied `--sidebar-*` custom properties -- deliberately not `.dark`, so the pending-claims gold badge's own tokens (`--gold-accent`, `--gold-accent-foreground`, declared only in `:root`) are untouched.
- New `Kbd` primitive fills a pre-existing `data-slot="kbd"` selector gap already anticipated by `tooltip.tsx`.
- New `DashboardCard` shell exists as a shared primitive with zero consumers, exactly as CONTEXT.md's locked decision #4 specifies (page retrofit deferred to a future task).
- New `DashboardTopbarSearch` Server Component renders a centered, real-but-inert `Input` (type="search") with a decorative `Search` icon and a `Kbd` "⌘K" hint, hidden below `sm`, wired into the dashboard header between the store name and the sign-out control.
- Full automated gate green: lint (`--max-warnings=0`), typecheck, `next build` (Turbopack, no Windows/junction failure encountered this run), and `test:unit` (32 files / 566 tests, including `dashboard-nav.test.ts` and `surface-token-isolation.test.ts`).
- Recursive grep of `src/app/s` confirms zero references to any file or class this task introduces.
- `(dashboard)/layout.tsx` still calls `requireMerchantContext()` for data only and contains no `redirect(`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scope a dark rail to the sidebar only (desktop + mobile)** - `eb336de` (feat)
2. **Task 2: Add the Kbd primitive, the DashboardCard shell, and their copy** - `cf51c54` (feat)
3. **Task 3: Build the top-bar search placeholder and wire it into the dashboard shell** - `094fba7` (feat)

4. **Task 4 (checkpoint:human-verify, gate="blocking"): APPROVED** by the orchestrator after live-browser verification, following a real contrast fix -- `5de1797` (fix). See "Contrast Bug Found and Fixed During Task 4" below.

## Files Created/Modified

- `src/app/globals.css` - New `.sidebar-dark-scope` selector (8 `--sidebar-*` tokens copied verbatim from `.dark`), inserted after the `.dark` block and before `@layer base`
- `src/components/ui/sidebar.tsx` - `sidebar-dark-scope` prepended to the 3 hardcoded `bg-sidebar` class strings (collapsible="none" branch, mobile `SheetContent`, desktop `sidebar-inner` div); JSDoc above `Sidebar()` extended with a second paragraph documenting the override
- `src/components/ui/kbd.tsx` - New `Kbd` primitive, `data-slot="kbd"`, purely decorative
- `src/components/dashboard-card.tsx` - New `DashboardCard` shell composing `Card`/`CardHeader`/`CardTitle`/`CardContent`; no consumer yet
- `src/lib/strings.ts` - New `dashboard.topbar` object (`searchPlaceholder`, `searchAriaLabel`, `searchShortcutHint`) inserted between `nav` and `emptyHeading`
- `src/components/dashboard-topbar-search.tsx` - New `DashboardTopbarSearch` Server Component
- `src/app/(dashboard)/layout.tsx` - One new import + one JSX insertion (`<DashboardTopbarSearch />`) inside the existing `<header>`; nothing above the JSX `return` touched

## Decisions Made

- Kept `.sidebar-dark-scope` limited to exactly the 8 `--sidebar-*` tokens (verified by the plan's own grep-count gates: exactly 1 declaration in `globals.css`, exactly 3 applications in `sidebar.tsx`) so the change cannot silently spread beyond the sidebar.
- Rewrote my first draft of the extended `sidebar.tsx` JSDoc paragraph to avoid repeating the literal string `sidebar-dark-scope` (used "this scope class" after first reference) once I discovered the prose itself was pushing the file's total occurrence count from 3 to 6 and failing Task 1's automated verify. This is a wording-only change; the documented intent (what changed, why, and where to re-apply it if `shadcn add sidebar` overwrites the file) is unchanged from the plan's prescribed content.
- Excluded `title` (in addition to `children`) from the props `DashboardCard` spreads through from `Card`, because `React.ComponentProps<typeof Card>` includes the native HTML `title` attribute (`string | undefined`) via `HTMLAttributes<HTMLDivElement>`, which is incompatible with the plan-specified `title?: React.ReactNode` prop (TS2430). This is the minimal fix required for `tsc --noEmit` to pass; it does not change the component's documented public contract (`title` still accepts `React.ReactNode`, just no longer forwarded to the underlying `<div>`'s native `title` attribute, which was never the intent).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded sidebar.tsx JSDoc to stop it from failing Task 1's exact-count verify**
- **Found during:** Task 1, immediately after the automated `<verify>` command
- **Issue:** The plan's prescribed JSDoc paragraph uses the literal string `sidebar-dark-scope` three times in prose (once as the class name, once referencing the globals.css comment, once in the re-apply instruction). Combined with the 3 real class-string applications, the file's total occurrence count was 6, failing `test $(grep -c "sidebar-dark-scope" src/components/ui/sidebar.tsx) -eq 3` -- the exact check the plan's own threat model (T-ugl-01) relies on to catch accidental over-application.
- **Fix:** Reworded the JSDoc to reference "this scope class" / "a new dark-rail scope class" after the first mention instead of repeating the literal identifier, preserving the same documented content (what was added, why it's not `.dark`, why it lives in this file, and the re-apply instruction for a future `shadcn add sidebar`).
- **Files modified:** src/components/ui/sidebar.tsx
- **Verification:** `grep -c "sidebar-dark-scope" src/components/ui/sidebar.tsx` now returns exactly 3; full Task 1 verify command passed.
- **Committed in:** eb336de (Task 1 commit)

**2. [Rule 1 - Bug] Excluded `title` from DashboardCard's spread-through Card props**
- **Found during:** Task 2, `npm run typecheck`
- **Issue:** `interface DashboardCardProps extends Omit<React.ComponentProps<typeof Card>, "children">` failed to compile (TS2430) because `React.ComponentProps<typeof Card>` includes `HTMLAttributes<HTMLDivElement>`'s native `title?: string` attribute, which conflicts with the plan-specified `title?: React.ReactNode` prop.
- **Fix:** Changed the `Omit` to also exclude `"title"`: `Omit<React.ComponentProps<typeof Card>, "children" | "title">`.
- **Files modified:** src/components/dashboard-card.tsx
- **Verification:** `npm run typecheck` clean; `DashboardCard`'s `title` prop still accepts `React.ReactNode` as specified.
- **Committed in:** cf51c54 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug fixes required for the plan's own automated gates to pass)
**Impact on plan:** Both fixes are wording/typing corrections with zero behavioral or visual impact on what the plan specifies. No scope creep -- no new files, no new tokens, no new consumers introduced beyond what the plan lists.

## Contrast Bug Found and Fixed During Task 4

The user spotted it directly from a screenshot: every inactive sidebar nav label and icon
(Products, Storefront, Orders, Payment claims, Plan, Payment settings) rendered nearly invisible
-- nearly-black text on the new slate-900 fill. Only the active item ("Overview," rendered via
`--sidebar-primary`, which happens to share the same value in both light and dark scope) was
legible. This passed every automated gate (lint, typecheck, build, all 566 unit tests) because
none of them assert computed color contrast.

**Root cause, confirmed by direct browser measurement (`getComputedStyle`), not guessed:**
`color` is an inherited CSS property that computes ONCE, at the element where a `text-*` utility
is actually applied, and every descendant then inherits that already-resolved value -- it does
not re-read the underlying custom property fresh at each level. `text-sidebar-foreground` is
applied on the OUTER `data-slot="sidebar"` wrapper (`className="group peer hidden
text-sidebar-foreground lg:block"`), not on the `data-slot="sidebar-inner"` div where Task 1
applied `.sidebar-dark-scope`. Because `sidebar-inner` sits BELOW that outer wrapper in the DOM,
`color` was already locked in (using `:root`'s un-scoped, near-black value) before the scope
class ever had a chance to apply. `background-color` on `sidebar-inner` looked correct in
isolation purely because `background-color` is NOT an inherited property -- it re-reads the
custom property fresh regardless of where the scope class sits, which is exactly why the dark
FILL was right while the TEXT was wrong.

A second, related issue surfaced during diagnosis: `@theme inline`'s generated `--color-sidebar-*`
aliases (what Tailwind utility classes actually consume) are declared once at `:root` as
`var(--sidebar-*)`. Overriding only the raw `--sidebar-*` names in `.sidebar-dark-scope` was not
sufficient on its own to fix even the elements it was correctly scoped to -- the alias also needed
a direct override.

**Fix (two parts, both in `src/app/globals.css` and `src/components/ui/sidebar.tsx`):**
1. `.sidebar-dark-scope` now sets both the raw `--sidebar-*` tokens AND their `--color-sidebar-*`
   aliases (16 declarations total, still 8 conceptual tokens).
2. The desktop application site moved from the inner `sidebar-inner` div to the OUTER
   `data-slot="sidebar"` wrapper -- the same element that already carries
   `text-sidebar-foreground`. The scope class was removed from `sidebar-inner` (redundant once the
   outer wrapper carries it, since custom properties -- unlike `color` -- inherit correctly
   downward regardless of the exact ancestor they're declared on). Total occurrence count in
   `sidebar.tsx` stayed at exactly 3, so the plan's own `-eq 3` verify gate still passes.

Both the JSDoc above `Sidebar()` and the comment above `.sidebar-dark-scope` were extended to
document this precisely, including the "why background looked fine and text didn't" split, so a
future edit doesn't reintroduce the same bug by "simplifying" the doubled token declarations.

**Re-verified live in a real browser after the fix:** desktop rail and the mobile off-canvas
sheet both render dark-navy fill with clearly legible near-white nav labels and icons; the active
item's blue highlight is unaffected; `/dashboard/orders` and `/dashboard/plan` render with
unchanged page content (shell-only, as scoped); the storefront (`megasolution.localhost:3001`)
is completely unaffected; the search box hides below `sm` and is inert (typing produces no
request/dropdown/navigation) at `sm` and above.

**Full gate re-run clean after the fix:** `npm run lint`, `npm run typecheck`,
`npx vitest run tests/unit/dashboard-nav.test.ts tests/unit/surface-token-isolation.test.ts`
(11/11), `npm run test:unit` (566/566), `npm run build` -- all green.

## Issues Encountered

None beyond the two auto-fixed deviations above. `npm run build` succeeded cleanly this run (no Windows/Turbopack junction-symlink failure encountered, so the plan's documented exception did not need to be invoked).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Task 4 (checkpoint:human-verify, `gate="blocking"`) is APPROVED.** All six verification steps
from the plan were completed live by the orchestrator, including the contrast fix documented
above. `.planning/STATE.md` is updated separately by the orchestrator; this quick task is closed.

No blockers for a future page-retrofit task adopting `DashboardCard`, or for a future task wiring
real search into `DashboardTopbarSearch`/`strings.dashboard.topbar` -- both primitives exist and
are documented as placeholders awaiting that follow-up work.

---
*Phase: quick/260903-ugl*
*Completed (Tasks 1-3): 2026-09-03*

## Self-Check: PASSED

All 8 created/modified files confirmed present on disk; all 3 task commit hashes (`eb336de`, `cf51c54`, `094fba7`) confirmed present in `git log`.
