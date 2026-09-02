---
phase: 04-theme-section-block-system-flagship-template
plan: 04
subsystem: ui
tags: [tailwind-v4, css-custom-properties, design-tokens, i18n-catalogue, static-analysis, accessibility, prefers-reduced-motion]

# Dependency graph
requires:
  - phase: 01-multi-tenant-foundations-domain-resolution
    provides: "src/lib/strings.ts and its one-namespace-per-surface rule; src/app/globals.css; the [data-surface=\"storefront\"] scope"
  - phase: 03-product-catalog-order-payment-claim-state-machine
    provides: "the 20-token storefront palette, tests/unit/surface-token-isolation.test.ts bans 1-5, the strings prose-scan contract tests"
provides:
  - "strings.flagship — the D-04 industry-neutral default document every new storefront ships with"
  - "strings.branding — every string on /onboarding/branding"
  - "strings.editor — every string on /dashboard/storefront-editor"
  - "strings.dashboard.nav.storefrontEditor — the rail label (label only; the rail item is plan 04-15's)"
  - "strings.storefront.emptyHeading/.emptyBody — the shared product-grid empty state"
  - "five --color-brand-accent* Tailwind utilities, resolving only inside the storefront scope"
  - "five --brand-accent* fallbacks so a tenant with no StorefrontTheme row renders correctly"
  - "six motion tokens plus the prefers-reduced-motion floor"
  - "ban 6 in tests/unit/surface-token-isolation.test.ts — D-12 enforced by a build failure"
affects: [04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11, 04-12, 04-13, 04-14, 04-15, 05-industry-templates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Copy and design tokens land in wave 1, in one pass, before any consuming component exists — later plans only read them"
    - "Scope-as-mechanism: a custom property declared only inside [data-surface=\"storefront\"] makes the matching utility inert everywhere else"
    - "Guard breadth over enumeration: a source-scanning ban matches the bare token, not a list of prefixes"

key-files:
  created: []
  modified:
    - src/lib/strings.ts
    - src/app/globals.css
    - tests/unit/surface-token-isolation.test.ts

key-decisions:
  - "The new ban is #6, not #5 — the file already shipped a ban 5 (the D-08 delete-product affordance) that the plan's <interfaces> block did not know about"
  - "BRAND_ACCENT_UTILITY matches the bare `brand-accent` token rather than an enumeration of Tailwind prefixes, because the utility family is open-ended"
  - "The view-only notice's link key is `seePlansLink`, not `starterViewOnlyLink`, so a grep for the `starterViewOnly` interface key returns exactly one line"
  - "The flagship product-grid empty state lives in strings.storefront (as emptyHeading/emptyBody), never duplicated into strings.flagship, so /preview and the live store cannot drift"
  - "npm run build could not run in the worktree (no local node_modules); Tailwind resolution of the five new @theme inline entries was verified by compiling globals.css through @tailwindcss/postcss directly"

patterns-established:
  - "Vocabulary as guardrail: the brand-accent family is fill, text-on-fill, ring, secondary fill and its text-on-fill — there is deliberately no background or body-text member, so a merchant can tint the storefront and never restructure it"
  - "Accessibility floors ship in the same commit as the thing they bound — the prefers-reduced-motion block landed with the motion tokens so no window exists where animation is live and the floor is not"
  - "A source-scanning guard asserts its own comment exemption, so the paragraph documenting a prohibition cannot trip it"

requirements-completed: [TMPL-01, TMPL-02]

# Metrics
duration: 22min
completed: 2026-09-02
---

# Phase 4 Plan 04: Copy Surface and Design-Token Surface Summary

**The phase's entire copy catalogue (three `strings` namespaces plus a nav key) and its entire token surface (five storefront-scoped `brand-accent` utilities, six motion tokens, a `prefers-reduced-motion` floor) landed in one wave-1 pass, with a new build-failing ban keeping the merchant accent off every dashboard surface.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-02T15:12:00Z
- **Completed:** 2026-09-02T15:34:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Every user-facing string plans 04-05 through 04-15 will render now exists in `src/lib/strings.ts`, authored before any component that consumes it. No later plan in this phase has a reason to append to the file 04-PATTERNS.md named as its most likely merge conflict.
- `bg-brand-accent`, `text-brand-accent-foreground`, `bg-brand-accent-secondary`, `text-brand-accent-secondary-foreground` and `ring-brand-accent-ring` are real Tailwind utilities whose custom properties are in scope in exactly one place. A tenant with no `StorefrontTheme` row renders correctly — ink CTAs, a zinc-500 announcement strip, a visible focus ring — with zero JavaScript and zero database reads.
- The motion language is six named tokens rather than scattered arbitrary values, and the reduced-motion floor shipped in the same commit, so there is no interval in this repository's history where the storefront animates and the floor does not exist.
- D-12 is now enforced in both directions: ban 4 keeps `data-surface="storefront"` off the dashboard, and the new ban 6 keeps the merchant accent off it. RED was demonstrated before the guard was committed.

## Task Commits

1. **Task 1: The three new strings namespaces plus the nav key** — `1c33905` (feat)
2. **Task 2: The five brand-accent tokens and the six motion tokens in globals.css** — `1306f35` (feat)
3. **Task 3: Ban 6 — no brand-accent utility outside the storefront tree** — `cec6df5` (test, TDD)

## Files Created/Modified

- `src/lib/strings.ts` — adds `strings.flagship` (the industry-neutral default document: announcement, hero, three trust-bar items, product grid, editorial split, contact band, footer tagline), `strings.branding` (four cards, six segment labels keyed by segment id, both colour fields with their captions, the D-11 contrast warning, the invalid-hex error, the submit pair), `strings.editor` (rail groups and section labels keyed by section type, the six field kinds' helpers and rejections, preview-canvas and viewport copy, publish-bar statuses and buttons, the discard `alert-dialog`, the three distinct error strings, and `starterViewOnly`), plus `strings.dashboard.nav.storefrontEditor` and `strings.storefront.emptyHeading`/`.emptyBody`.
- `src/app/globals.css` — five `--color-brand-accent*` mappings in `@theme inline`; five `--brand-accent*` fallbacks and six `--motion-*` tokens inside `[data-surface="storefront"]`; the `prefers-reduced-motion: reduce` floor; an extended header comment recording the D-12 rationale. Purely additive — the diff removes zero lines and changes zero existing token values.
- `tests/unit/surface-token-isolation.test.ts` — ban 6, with both non-vacuity guards, three positive controls, one path-discrimination negative control, an assertion pinning the comment exemption, and a failure message naming the rule, the reason, the fix and both wrong fixes. Bans 1-5 untouched; the diff is additions only.

## Decisions Made

- **The new ban is #6.** The plan's `<interfaces>` block listed four existing bans and called the new one #5, but `tests/unit/surface-token-isolation.test.ts` already ships a ban 5 — the D-08 no-trash-icon check on the products pages, which is also the file's one documented tolerated-empty-scan exception. Numbering the new one #5 would have produced two bans with the same name in the same suite.
- **The matcher is the bare token.** `BRAND_ACCENT_UTILITY` is `/\bbrand-accent\b/` rather than an enumeration of `bg-`/`text-`/`border-`/`ring-`/`outline-`/`from-`/`to-`. The utility family is open — a future Tailwind release extends it without telling anyone — and it also catches a raw `--brand-accent` written into a style object, which is the more dangerous version of the same mistake. Ban 3's comment already makes this argument about `border-success`. There is no legitimate reason for the string to appear in a dashboard component at all, so breadth costs nothing.
- **One predicate, two callers.** `isBrandAccentOffender` is used by both the real scan and the fixtures, so the positive controls prove something about the check that actually runs rather than about a lookalike.
- **`seePlansLink`, not `starterViewOnlyLink`.** `strings.editor.starterViewOnly` is an interface — plan 04-09 passes it to `assertCanEditStorefront` — and the plan's own acceptance criterion requires `grep -c "starterViewOnly"` to return exactly 1. A sibling key prefixed with the same name would have made that grep return 2 while the interface itself was still correct.
- **The empty state lives in `strings.storefront`.** 04-UI-SPEC.md § Core contract specifies `Nothing here yet` / `This shop hasn't added any products yet. Check back soon.` and states it is reused from `strings.storefront`; the namespace did not carry those two sentences yet. They were added there as `emptyHeading`/`emptyBody` rather than into `flagship`, because `/preview` *is* the storefront and the sentence a shopper reads must be the same object the merchant previews.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The new ban is #6, not #5**

- **Found during:** Task 3 (Ban 6)
- **Issue:** The plan's `<interfaces>` block enumerated four existing bans in `tests/unit/surface-token-isolation.test.ts` and instructed the new one be added as #5. The file already contains a ban 5 — "no delete-product affordance in the products pages" (D-08) — added in Phase 3 after the plan's reference material was written. Following the instruction literally would have produced two tests both named ban 5 in one suite, and would have collided with the file header's note that "Ban 5 is the single documented exception" to the non-vacuity rule.
- **Fix:** Added the new ban as #6, mirroring ban 4's implementation as instructed. The file header's reference to ban 5 remains accurate and was left alone.
- **Files modified:** `tests/unit/surface-token-isolation.test.ts`
- **Verification:** `npx vitest run --project unit tests/unit/surface-token-isolation.test.ts` — 6 tests pass; `git diff` shows additions only.
- **Committed in:** `cec6df5`

**2. [Rule 2 - Missing Critical] The flagship product-grid empty-state copy did not exist anywhere**

- **Found during:** Task 1 (strings namespaces)
- **Issue:** The plan forbids duplicating the empty state into `strings.flagship` and says to reuse `strings.storefront`'s. 04-UI-SPEC.md § Core contract fixes that copy as `Nothing here yet` / `This shop hasn't added any products yet. Check back soon.` — but `strings.storefront` only carried `heading`/`body` for the Phase-1 placeholder page (`Store coming soon`), which is different copy for a different situation. The two sentences the product-grid section needs existed in no namespace, so plan 04-06 or 04-07 would have had to inline them (failing the prose-scan contract test) or append to this file (the merge conflict this plan exists to prevent).
- **Fix:** Added `emptyHeading` and `emptyBody` to `strings.storefront` with the UI-SPEC's exact wording. The existing `heading`/`body` were left untouched, so the placeholder page is unaffected.
- **Files modified:** `src/lib/strings.ts`
- **Verification:** `npm run test:unit` — the prose-scan contract tests still pass; `npx eslint src/lib/strings.ts --max-warnings=0` exits 0.
- **Committed in:** `1c33905`

**3. [Rule 2 - Missing Critical] Spec-required editor strings the plan's enumeration omitted**

- **Found during:** Task 1 (strings namespaces)
- **Issue:** The plan's list of `strings.editor` contents omitted several strings 04-UI-SPEC.md § Storefront Editor requires a component to render: the reorder-button `aria-label`s and the reorder live-region announcement, the rail's back-row label, the preview `iframe` title, the below-`lg` Edit/Preview pane switch, the image-field labels, and the `Saving…`/`Publishing…` in-flight labels. Every one of them is a user-facing string in a `.tsx`, so omitting them here means a later plan inlines a literal — the exact failure mode the truth "every user-facing string this phase ships exists in one file before any component that renders it" forbids.
- **Fix:** Added them to `strings.editor` alongside the enumerated keys.
- **Files modified:** `src/lib/strings.ts`
- **Verification:** Same as above.
- **Committed in:** `1c33905`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing critical)
**Impact on plan:** No scope creep — all three keep the plan's own stated truths achievable. Deviation 1 prevents a duplicate test name; deviations 2 and 3 close copy gaps that would otherwise force a later plan to either inline a literal or edit this file out of wave order.

## Issues Encountered

**The worktree has no `node_modules` and no generated Prisma client, so three of the plan's four verification commands cannot complete here.**

`.claude/worktrees/agent-ae5515938b07e6fb9/node_modules` contains only Vitest's `.vite` cache. Node's own resolver walks up to the main repo's install, but Vite's does not, and `src/generated/prisma` is gitignored so it is absent from the worktree entirely. `node scripts/prisma-generate.mjs` cannot regenerate it (no Prisma binary in the worktree), and installing packages is explicitly excluded from auto-fix.

Consequences, all pre-existing and none caused by this plan:

- `npm run test:unit` — **9 test files fail to import** with `Cannot find package 'server-only'` or `Cannot find package '@/generated/prisma/*'`. The counts are identical before and after this plan's changes (9 failed files, 5 failed tests), except that the passing test count rose 292 → 293 as ban 6 was added. None of the failing files touch this plan's three files.
- `npm run typecheck` — fails on the same missing generated client, cascading into `implicitly has an 'any' type` errors across `tests/isolation/**`. `npx tsc --noEmit` over `src/lib/strings.ts` in isolation is clean.
- `npm run build` — fails with `Could not find the Next.js package (next/package.json)`.

What was verified instead:

- `npx vitest run --project unit tests/unit/surface-token-isolation.test.ts tests/unit/dashboard-nav.test.ts` — all 10 tests pass. These are the two suites that actually guard this plan's output.
- `npx eslint src/lib/strings.ts tests/unit/surface-token-isolation.test.ts --max-warnings=0` — exits 0.
- Tailwind resolution of the five new `@theme inline` entries was proved directly, by compiling `src/app/globals.css` through the repo's own `@tailwindcss/postcss` with `@source inline(...)` for the five class names. All five emit (`.bg-brand-accent`, `.text-brand-accent-foreground`, `.bg-brand-accent-secondary`, `.text-brand-accent-secondary-foreground`, `.ring-brand-accent-ring`), and the compiled output carries both the motion tokens and the `prefers-reduced-motion` floor. The temporary `.tw-check.css` was deleted; the working tree is clean.

**Recommendation for the orchestrator:** re-run `npm run test:unit`, `npm run typecheck` and `npm run build` once in the main repo after merging this wave. The failures above should not survive the merge; if any does, it is a genuine finding rather than a worktree artifact.

## TDD Gate Compliance

Task 3 carried `tdd="true"`. Because the deliverable is a static-analysis guard rather than runtime behaviour, the RED gate was demonstrated against the guard itself rather than against a missing implementation:

- **RED** — with ban 6 written, `const TEMPORARY_RED_FIXTURE = "bg-brand-accent";` was added to `src/app/(dashboard)/trial-banner.tsx`. Ban 6 alone failed, naming the file and line: `src/app/(dashboard)/trial-banner.tsx:2`. Bans 1-5 stayed green, confirming the new ban and not an existing one produced the failure.
- **Comment-exemption control** — the same token was then written as a whole-line comment in the same file. The suite returned to 6 passing, confirming the guard cannot be tripped by the paragraphs that document it.
- **GREEN** — the fixture was reverted with `git checkout -- "src/app/(dashboard)/trial-banner.tsx"`; the suite passes and the working tree is clean.

There is no separate `feat(...)` commit for this task because there is no production code to write: the codebase already satisfies the rule, and the guard's job is to keep it that way. The commit is therefore `test(04-04)`, with the RED transcript recorded in its message.

## Known Stubs

None. This plan ships data — strings and CSS custom properties — and a test. Nothing here renders, so there is no placeholder to wire. `strings.dashboard.nav.storefrontEditor` is deliberately a label without a rail item: the paired `REQUIRED_HREFS` + `app-sidebar.tsx` edit is owned by plan 04-15 and must land in one commit, and neither of those files was touched (`git diff --stat` on both is empty).

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema change was introduced. The plan's `<threat_model>` dispositions were all satisfied: T-04-02 by ban 6, T-04-09 by the bounded utility vocabulary, T-04-03 by the `var(--ring)` fallback and the reduced-motion floor shipping with the tokens, T-04-17 by the whole copy surface landing in wave 1, and T-04-SC by installing nothing.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Ready for the rest of wave 2 and beyond. Specifically:

- **04-06 (section registry / `defaults.ts`)** reads `strings.flagship`, one key per settings field. The shape mirrors the settings schemas, not the page layout.
- **04-07 (flagship sections)** has the five `brand-accent` utilities, the six motion tokens and the reduced-motion floor available, and must reuse `strings.storefront.emptyHeading`/`.emptyBody` for the product-grid empty state.
- **04-09 (editor gating)** passes `strings.editor.starterViewOnly` to `assertCanEditStorefront`.
- **04-15 (navigation)** owns the paired `REQUIRED_HREFS` + `app-sidebar.tsx` edit; the label it needs is already at `strings.dashboard.nav.storefrontEditor`.

One concern for the orchestrator, restated: the worktree could not run `npm run build` or a full `npm run typecheck`. Both should be run once in the main repo after this wave merges.

## Self-Check: PASSED

- `src/lib/strings.ts` — FOUND, contains `flagship:`, `branding:`, `editor:`; `grep -c "starterViewOnly"` = 1; `grep -c "storefrontEditor"` = 1; `grep -c "newsletter\|Newsletter"` = 0; `grep -c "!"` = 0
- `src/app/globals.css` — FOUND, `grep -c "color-brand-accent"` = 5; `grep -c -- "--brand-accent"` = 10; motion tokens = 6; `prefers-reduced-motion: reduce` and `scroll-behavior: auto !important` present; all five `--brand-accent*` declarations verified between the `[data-surface="storefront"] {` line and its closing brace, none at `:root`; zero removed lines in the diff
- `tests/unit/surface-token-isolation.test.ts` — FOUND, contains `brand-accent`, a test naming both `brand-accent` and D-12, a `toBeGreaterThan(0)` scanned-count assertion, and positive controls
- `.planning/phases/04-theme-section-block-system-flagship-template/04-04-SUMMARY.md` — FOUND
- Commits `1c33905`, `1306f35`, `cec6df5` — all FOUND in `git log`
- `git diff --stat tests/unit/dashboard-nav.test.ts src/components/app-sidebar.tsx` — empty, both untouched

---
*Phase: 04-theme-section-block-system-flagship-template*
*Completed: 2026-09-02*
