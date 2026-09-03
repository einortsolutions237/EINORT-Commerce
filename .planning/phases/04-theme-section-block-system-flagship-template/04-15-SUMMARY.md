---
phase: 04-theme-section-block-system-flagship-template
plan: 15
subsystem: ui
tags: [postmessage, iframe, zod, react, next, theming, live-preview, security, dashboard-nav]

# Dependency graph
requires:
  - phase: 04-02
    provides: "editorReducer / EditorState / EditorAction — every document transition the shell dispatches"
  - phase: 04-09
    provides: "getEditorStorefront, ensureStorefrontSeeded, saveDraft, publishStorefront, discardDraft, and assertCanEditStorefront's write gate"
  - phase: 04-12
    provides: "SectionList, SettingsPanel, FieldRenderer, PublishBar — the rail and panel components with their exported prop interfaces"
  - phase: 04-14
    provides: "The einort:preview-* postMessage protocol and preview-canvas.tsx's receiver discipline (origin check before payload read)"
provides:
  - "/dashboard/storefront-editor reachable from the rail with no gold badge, REQUIRED_HREFS updated to agree"
  - "toggle-group, the phase's only new shadcn component, reviewed for hardcoded zinc-* utilities"
  - "editor-shell.tsx: the client shell owning the reducer, the postMessage sender, the iframe, and the ready handshake with its 10s non-destructive timeout"
  - "page.tsx: the self-authorizing RSC that seeds an unseeded tenant, loads the draft, resolves rail data from the server-only registry, and builds the iframe URL/origin from configuration"
  - "loading.tsx: a two-pane skeleton matching the real layout, no spinner"
  - "sectionFieldMaxima / themeFieldMaxima: the {n}/{max} counters read back out of Zod's own maxLength/element metadata rather than restated"
affects: [phase-05 template picker, any future editor-rail section type]

# Tech tracking
tech-stack:
  added: ["src/components/ui/toggle-group.tsx (shadcn official registry, reviewed for zinc-* utilities before use)"]
  patterns:
    - "Zod metadata read-back: a public getter (ZodString.maxLength) walked recursively through ZodArray.element.shape, rather than a hand-duplicated cap table, so a cap declared once in schema.ts cannot disagree with the UI that enforces it"
    - "Two-timestamp 'unpublished changes' comparison (draftUpdatedAt > publishedAt) instead of a deep document diff, carried from the RSC as plain ISO strings"
    - "Handshake-gated postMessage sender: nothing posted before einort:preview-ready, first post is the handshake response itself, every subsequent post keyed off reducer-produced document/token identity"

key-files:
  created:
    - "src/app/(dashboard)/dashboard/storefront-editor/page.tsx"
    - "src/app/(dashboard)/dashboard/storefront-editor/editor-shell.tsx"
    - "src/app/(dashboard)/dashboard/storefront-editor/loading.tsx"
    - "src/components/ui/toggle-group.tsx"
  modified:
    - "src/components/app-sidebar.tsx"
    - "tests/unit/dashboard-nav.test.ts"
    - "src/server/theming/schema.ts"
    - "src/lib/strings.ts"

key-decisions:
  - "page.tsx reads NEXT_PUBLIC_ROOT_DOMAIN via the validated @/env module rather than a literal process.env read. The plan's interfaces section names process.env as the pattern (matching /onboarding/plan, which runs outside a validated-env context), but page.tsx runs inside one, and CLAUDE.md's standing rule is 'never read process.env directly outside src/env.ts'. The preview route this page must agree with (src/app/s/[slug]/preview/page.tsx, plan 04-14) already reads it the same way — env.NEXT_PUBLIC_ROOT_DOMAIN — so this keeps both halves of the origin protocol on one spelling of the value rather than two. Verified: both files produce the identical rootDomain/protocol/origin expression."
  - "sectionFieldMaxima/themeFieldMaxima check the array-element branch unconditionally before the maxLength branch, defensively, even though the installed zod@4.4.3 does not expose a public maxLength getter on ZodArray (only ZodString has one, verified empirically). The order costs nothing and protects against a future zod version adding one, which would otherwise report the array's own bound (e.g. trust-bar's 4-block cap) instead of walking into its per-block fields."
  - "logoKey is excluded from the theme panel's editable fields (EDITABLE_THEME_FIELDS filters THEME_NON_TOKEN_FIELD) because it is not a themeTokensSchema member and no reducer action could carry a change to it — rendering an upload control whose result is silently discarded would be worse than omitting it. The write path (a future requestLogoUpload action) is recorded as future work, not built here."

patterns-established:
  - "Pattern: a Zod schema's own public metadata (maxLength, element) is the single source of a UI cap, read back out via a small recursive walker rather than duplicated in a registry or a component — extends the 'schema.ts and nowhere else' rule already stated in registry.ts's header to derived numeric bounds, not just structural validation."

requirements-completed: [EDIT-02, EDIT-03]

# Metrics
duration: unknown (continuation of an interrupted prior session; this session's active work was approximately 55min)
completed: 2026-09-03
---

# Phase 4 Plan 15: The Storefront Editor Assembly Summary

**Wired the storefront editor end to end: a no-badge nav entry with its paired contract-test edit, a self-authorizing RSC that seeds/loads/resolves rail data and builds the iframe address from configuration, a client shell whose only state transitions go through the existing `editorReducer`, and a Zod-metadata read-back helper so the settings panel's `{n}/{max}` counters cannot drift from the schema that actually enforces them.**

## Performance

- **Duration:** Continuation of a session interrupted by a rate limit; this executor's active portion was approximately 55 minutes (verification-heavy: reviewing ~2,800 lines of pre-existing work across two prior sessions before adding anything).
- **Completed:** 2026-09-03
- **Tasks:** 3/3 complete
- **Files modified:** 8 (4 created, 4 modified) across all three tasks

## Accomplishments

- `/dashboard/storefront-editor` is reachable from the rail between Products and Orders, with no gold badge, and `REQUIRED_HREFS` (now seven destinations) agrees with the rail in the same order.
- The client shell (`editor-shell.tsx`, 810 lines) owns one `useReducer(editorReducer, …)` with zero duplicate reorder/merge logic, a handshake-gated `postMessage` sender that never sends before `einort:preview-ready` and never sends to a wildcard origin, a 10-second non-destructive timeout with a `Reload preview` control, a `beforeunload` guard on `dirty`, and the push/pop rail (list ↔ settings panel) with the two merchant-facing nudges (WhatsApp number, zero products) computed server-side and passed through as plain data.
- The RSC (`page.tsx`) authorizes itself independently of the dashboard layout, self-heals a pre-Phase-4 tenant via the idempotent `ensureStorefrontSeeded`, resolves the rail's section-type data and `{n}/{max} `caps from the server-only registry and schema, and builds the iframe URL/origin from `NEXT_PUBLIC_ROOT_DOMAIN` — never from the browser.
- `sectionFieldMaxima`/`themeFieldMaxima` (`schema.ts`) read the editor's field-length caps directly out of Zod's own `maxLength`/`element` metadata, verified against the live schema to produce the exact caps declared in each `.max(n)` call (hero eyebrow 60, heading 120, body 280, ctaLabel 30, ctaHref 200; trust-bar per-block heading 48/body 140; product-grid heading 80/viewAllLabel 30/viewAllHref 200; editorial-split same as hero; contact heading 80/body 280/ctaLabel 30; theme announcementText 120/footerTagline 160).
- `npm run typecheck`, `npm run lint` (`--max-warnings=0`), and `npm run build` all pass clean with the new/modified files in place.

## Task Commits

Each task was committed atomically:

1. **Task 1: The nav item, its paired contract-test edit, and toggle-group** - `b17a78a` (feat) — committed in a prior session, verified intact
2. **Task 2: The editor shell — reducer, postMessage sender, iframe, handshake** - `4909c30` (feat) — committed in a prior session, verified intact
3. **Task 3: The editor page RSC and its loading skeleton** - `38e8e17` (feat) — completed and committed this session

_No separate plan-metadata commit yet; STATE.md/ROADMAP.md updates are orchestrator-owned per this session's instructions and are deliberately not touched here._

## Files Created/Modified

- `src/components/app-sidebar.tsx` - Adds the `Storefront editor` nav entry between Products and Orders, no `badged` key
- `tests/unit/dashboard-nav.test.ts` - `REQUIRED_HREFS` extended with `/dashboard/storefront-editor` in rail order, comment updated to "seven destinations"
- `src/components/ui/toggle-group.tsx` - shadcn official-registry component, reviewed and free of hardcoded `zinc-*`/`slate-*` utilities
- `src/app/(dashboard)/dashboard/storefront-editor/editor-shell.tsx` - The client shell: reducer, postMessage sender/receiver, iframe chrome, viewport toggle, rail push/pop, leave guard
- `src/app/(dashboard)/dashboard/storefront-editor/page.tsx` - The self-authorizing RSC: seeds, loads, resolves rail data, builds the iframe URL/origin, computes the two notice conditions
- `src/app/(dashboard)/dashboard/storefront-editor/loading.tsx` - Two-pane loading skeleton, no spinner
- `src/server/theming/schema.ts` - Adds `collectCaps`/`sectionFieldMaxima`/`themeFieldMaxima`, reading the settings panel's caps out of the schema's own Zod metadata
- `src/lib/strings.ts` - Adds the `editor` namespace's remaining copy (nudge sentences, preview/pane/viewport labels) referenced by `editor-shell.tsx`

## Decisions Made

See `key-decisions` in the frontmatter above: (1) `page.tsx` reads `NEXT_PUBLIC_ROOT_DOMAIN` via `@/env` rather than a literal `process.env`, matching the preview route it must protocol-agree with and CLAUDE.md's standing env-access rule; (2) the cap-reading helper checks the array-element branch unconditionally as defensive-but-currently-inert ordering; (3) `logoKey` stays out of the editable theme fields until a dedicated upload action exists.

## Deviations from Plan

None requiring a fix. One documented adaptation, made by the prior interrupted session and verified correct by this one:

**1. [Not a Rule 1-4 deviation — a justified adaptation, already present] `page.tsx` reads the root domain through `@/env` instead of a literal `process.env` read**
- **Found during:** Task 3 review (resuming interrupted work)
- **Context:** The plan's `<interfaces>` section names `NEXT_PUBLIC_ROOT_DOMAIN via a literal process.env read` as the canonical pattern, citing `/onboarding/plan/page.tsx`. That file reads raw `process.env` because it runs *before* `requireMerchantContext()` would normally apply and predates this convention being centralized. `page.tsx` runs inside a fully validated-env context, where CLAUDE.md's explicit rule (`never read process.env directly outside src/env.ts`) applies without exception.
- **Verification:** Confirmed `src/app/s/[slug]/preview/page.tsx` (plan 04-14, the other half of this exact origin-comparison protocol) already reads `env.NEXT_PUBLIC_ROOT_DOMAIN` the same way. Both files produce byte-identical `rootDomain`/`protocol`/origin-string expressions, so the protocol's two ends cannot disagree. No fix needed; documenting only because it differs from the plan's literal wording.

---

**Total deviations:** 0 requiring action. 1 documented, already-correct adaptation carried over from the interrupted session.
**Impact on plan:** None. All acceptance criteria satisfied; the one wording difference from the plan's `<interfaces>` section improves consistency with the file it must agree with.

## Issues Encountered

- **`npm run test:full` did not complete within this session.** The command was started and ran for approximately 40 minutes with zero stdout/stderr output, while `node.exe` worker processes remained alive and churning (PIDs cycling, memory static rather than climbing) — consistent with the orchestrator's own advance warning that other worktrees/agents may be concurrently exercising the shared Neon test branch (`TEST_DATABASE_URL`) and that a `P2028`/`40P01`-shaped transaction-timeout/deadlock is contention, not a regression. No code-level error was ever produced to point at a real failure. Per the orchestrator's explicit instruction, this is noted rather than chased. **`test:full` should be re-run in a follow-up session at a moment with less apparent concurrent worktree activity** to get a clean pass/fail signal before this branch is merged.
- In lieu of a completed `test:full`, this session performed direct static verification of every grep-checkable acceptance criterion across all three tasks (all passed — see below), plus `npm run typecheck` (clean), `npm run lint --max-warnings=0` (clean), and `npm run build` (succeeds, `/dashboard/storefront-editor` registered as a dynamic route).
- Directly executed `sectionFieldMaxima`/`themeFieldMaxima` against the live `schema.ts` via `tsx --conditions=react-server` (not part of the automated suite) to confirm the caps they read back out match every `.max(n)` in the schema exactly — see Accomplishments.
- **Manual smoke test was only partially possible.** Started `npm run dev`, confirmed unauthenticated `GET /dashboard/storefront-editor` compiles and responds `307 → /login` (no crash, `requireMerchantContext()`'s auth ladder fires correctly) and `GET /login` returns `200`. Full authenticated visual smoke (rail rendering, live iframe load, typing a hero heading updating the preview) was **not** performed — this session has no seeded dev-database merchant credentials available (the seed script guards against ever targeting the dev database, and no demo account exists in `.env.local`'s target). **This should be verified separately** by signing up/logging in as a merchant and visiting the route directly.
- A background `npm run dev` process (port 3001) may still be running from this session's smoke check; it was not cleanly terminated because this environment has multiple concurrent `node.exe` processes (other worktrees' test runs) and killing the wrong PID risked disrupting a sibling agent's work. It touches only `.env.local`/port 3001, not the shared test database, so it should not affect other worktrees, but the orchestrator may want to confirm it is stopped before final merge/deploy steps.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three tasks of plan 04-15 are complete and committed on `worktree-agent-ab6a515e6b50b3e70`.
- `test:full` needs a clean confirmed run (see Issues Encountered) before this branch is merged — recommend the orchestrator re-run it post-merge or at a quieter moment.
- Full authenticated manual smoke (rail → typed edit → live preview update) should be performed once, either by the orchestrator or in a follow-up session with real merchant credentials.
- EDIT-02 and EDIT-03 are both now fully wired end to end: reachable nav entry, self-authorizing RSC, reducer-driven client shell, and the existing 04-09/04-12/04-14 pieces this plan was pure wiring over.

---
*Phase: 04-theme-section-block-system-flagship-template*
*Completed: 2026-09-03*

## Self-Check: PASSED

All claimed files confirmed present on disk (`page.tsx`, `loading.tsx`, `editor-shell.tsx`, `toggle-group.tsx`, this summary) and all three task commit hashes (`b17a78a`, `4909c30`, `38e8e17`) confirmed present in `git log --oneline --all`.
