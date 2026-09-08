# Deferred Items — Phase 05.3 (out of scope for 05.3-03)

## 1. `editor-shell.tsx` still imports the retired `./change-template-panel`

**File:** `src/app/(dashboard)/dashboard/storefront-editor/editor-shell.tsx`

`05.3-03`'s Task 2 moved `change-template-panel.tsx` to
`src/app/(dashboard)/dashboard/storefront/themes-browser.tsx` (renamed
`ThemesBrowser`), as its plan explicitly directs. `editor-shell.tsx` — part
of the OLD combined `storefront-editor/` route — still imports the old
`ChangeTemplatePanel` export from the now-gone relative path, and still
wires a `"changeTemplate"` rail target that opens it with `onBack`/
`onSwitched` props `ThemesBrowser` no longer accepts.

This breaks `npm run typecheck` and `npm run build` for the whole repo when
`05.3-03` is evaluated in isolation.

This file is explicitly **not** in `05.3-03`'s `files_modified` list.
Per `05.3-04-PLAN.md`'s own framing ("`05.3-02` moved the Editor"),
retiring the "change template" rail entry point from the Editor shell —
and moving/retiring the rest of `storefront-editor/` to
`storefront/editor/` — is `05.3-02`'s responsibility, executed in a
separate parallel worktree. `05.3-04` (wave 3, `depends_on: ["05.3-02",
"05.3-03"]`) is the phase-gate plan that verifies the full green build only
after both wave-2 plans are merged, and explicitly checks for exactly this
kind of dead reference ("Zero functional references to the retired
`/dashboard/storefront-editor` route remain anywhere in `src/` or
`tests/`").

**Action:** none taken in this plan. Documented here for the phase-gate
plan (`05.3-04`) and the orchestrator's post-merge reconciliation.

## 2. Pre-existing `tsc` module-resolution errors for `@/assets/brand/einort-logo.png`

**Files:** `src/app/login/page.tsx`, `src/app/signup/page.tsx`,
`src/app/page.tsx`, `src/components/app-sidebar.tsx`

`npm run typecheck` reports `Cannot find module
'@/assets/brand/einort-logo.png'` for these four files even though the
asset physically exists on disk and is tracked in git (added in
`c89860d feat(260903-nxf): add platform brand mark...`). None of these
files are touched by `05.3-03`. `npm run build` (Turbopack) does not
surface this as an error — the build failure it reports is solely the
`editor-shell.tsx` issue above (item 1), which build fails on first,
before ever reaching these files' compile step. `npm run lint` also passes
clean. This looks like a `tsc`/`next-env.d.ts` type-declaration
environment quirk unrelated to this plan's file set; out of scope per the
executor's scope-boundary rule (pre-existing, unrelated files).

**Action:** none taken in this plan. Flagged for whoever next touches
those four files or investigates the typecheck environment.
