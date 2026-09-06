---
phase: 05-template-segment-expansion
plan: 11
subsystem: api
tags: [server-actions, prisma, zod, multi-tenant, theming, entitlements]

# Dependency graph
requires:
  - phase: 05-template-segment-expansion
    provides: assertTemplateAccess/canUseTemplate (05-04), templateDefaultDocument/templateDefaultTokens and the 50-row TEMPLATES registry (05-08)
provides:
  - "switchTemplate server action — the merchant-facing draft-only template switch"
  - "publishStorefront and discardDraft made template-aware (promote/revert draftTemplateKey <-> publishedTemplateKey alongside the document and tokens)"
  - "saveBranding seeds onboarding from the merchant's picked template instead of the flagship-only builders, with its own tier gate"
affects: [05-09 (template picker UI), 05-21 (isolation test suite for the tier gate and switch/publish/discard template behaviour)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Draft-only mutation pattern: switchTemplate writes draft + draftTokens + draftTemplateKey inside one transaction and never touches published/publishedTokens/publishedTemplateKey — same shape as saveDraft"
    - "Tier gate as assert-before-any-DB-call, not a render-time filter: assertTemplateAccess in switchTemplate, canUseTemplate called directly in saveBranding (which has no MerchantContext to assert against)"

key-files:
  created: []
  modified:
    - src/server/theming/actions.ts
    - tests/isolation/branding.test.ts
    - tests/isolation/storefront-editor.test.ts
    - .planning/phases/05-template-segment-expansion/deferred-items.md

key-decisions:
  - "switchTemplate re-seeds the draft only; published/publishedTokens/publishedTemplateKey are left byte-identical, with the silent-publish warning written into the code as a comment (D-08/D-09)."
  - "switchTemplate preserves primaryAccent/secondaryAccent from the tenant's current draftTokens and logoKey (untouched column) while resetting announcementText/footerTagline to the new template's defaults (D-11)."
  - "discardDraft's flagship-only fallback is replaced with templateDefaultDocument/templateDefaultTokens(theme.publishedTemplateKey) — falling back to the flagship for a non-flagship tenant would render the old document under new variants."
  - "saveBranding's tier gate calls canUseTemplate directly rather than constructing a fake MerchantContext to reuse assertTemplateAccess, because this action runs before the DAL (no context object exists to assert against)."
  - "saveBranding writes both draftTemplateKey and publishedTemplateKey to the picked key, in both halves of the theme upsert — the one deliberate write of publishedTemplateKey outside publishStorefront, since onboarding publishes immediately (ONB-04)."

patterns-established:
  - "Template-key resolution degrades to the flagship builders only inside templateDefaultDocument/templateDefaultTokens (registry-level), never inline in actions.ts — actions.ts always calls through those two functions once ensureStorefrontSeeded's flagship-only defaults are no longer the only option."

requirements-completed: [TMPL-04]

# Metrics
duration: ~35min
completed: 2026-09-06
---

# Phase 05 Plan 11: switchTemplate + template-aware publish/discard/branding Summary

**Draft-only `switchTemplate` server action plus template-aware `publishStorefront`/`discardDraft`/`saveBranding`, so a template is a previewed-then-published draft choice, not an instant redesign of a live store.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-06T05:23:00+01:00 (approx, worktree environment setup)
- **Completed:** 2026-09-06T05:58:00+01:00 (approx)
- **Tasks:** 3/3 completed
- **Files modified:** 4 (1 source, 2 test fixtures, 1 deviation log)

## Accomplishments

- Added `switchTemplate`, a new merchant-gated Server Action: `assertCanEditStorefront` then `assertTemplateAccess` before any database call, re-seeds the draft page/theme from the new template's registry defaults inside one transaction, preserves the merchant's brand accents and logo, resets the announcement/footer copy tokens, and returns `document`/`tokens`/`variants`/`templateKey`/`draftUpdatedAt` so the open editor repaints without a reload.
- Made `publishStorefront` promote `publishedTemplateKey` alongside the document and tokens in the same transaction, so a publish can never leave a live store rendering one half under new variants and the other under old ones.
- Made `discardDraft` revert `draftTemplateKey` to the tenant's own `publishedTemplateKey` in the same transaction, and replaced its flagship-only fallback with `templateDefaultDocument`/`templateDefaultTokens(theme.publishedTemplateKey)` so a non-flagship tenant's discard never falls back to the wrong template's shape.
- Added a sixth field, `templateKey`, to `saveBrandingSchema` and made onboarding seed the storefront from the merchant's picked template (both `draftTemplateKey` and `publishedTemplateKey`, since onboarding publishes immediately), enforcing the tier gate via `canUseTemplate` directly (no `MerchantContext` exists on this pre-DAL surface).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the switchTemplate Server Action** - `03c9c44` (feat)
2. **Task 2: Make publish and discard handle the template column** - `bd3022b` (feat)
3. **Task 3: Make saveBranding seed from the merchant's picked template** - `df7091d` (feat)

**Plan metadata:** not yet committed — orchestrator writes STATE.md/ROADMAP.md updates per this agent's instructions (agent explicitly told not to touch those files).

## Files Created/Modified

- `src/server/theming/actions.ts` - Added `switchTemplate`; made `publishStorefront`, `discardDraft` and `saveBranding` template-aware.
- `tests/isolation/branding.test.ts` - `payload()` builder gains the now-required `templateKey` field (defaulted to `"flagship-fashion"`).
- `tests/isolation/storefront-editor.test.ts` - `signUpChooseAndCarrySession`'s `saveBranding` fixture call gains `templateKey: "flagship-fashion"`.
- `.planning/phases/05-template-segment-expansion/deferred-items.md` - Logged a transient Neon test-branch contention flake and five out-of-scope isolation fixtures still needing the new `templateKey` field (flagged for plan 05-21).

## Decisions Made

See `key-decisions` in frontmatter. In summary: `switchTemplate` writes draft columns only and never touches any `published*` column; the accent-preserving/copy-resetting token composition in `switchTemplate` mirrors `saveBranding`'s existing `{ ...defaults, primaryAccent, secondaryAccent }` shape; `discardDraft`'s fallback now reads the tenant's own template rather than the flagship's; `saveBranding`'s tier gate is a direct `canUseTemplate` call rather than a fabricated `MerchantContext`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored `next-env.d.ts` and `.next/types/*.ts` in the worktree**
- **Found during:** Task 1 (pre-flight `npm run typecheck`)
- **Issue:** These files are gitignored and generated by `next dev`/`next build`; a fresh worktree checkout has neither, so `tsc --noEmit` failed with `Cannot find name 'LayoutProps'/'PageProps'` across every route file and `Cannot find module '@/assets/brand/einort-logo.png'` (the `next/image-types/global` triple-slash reference was missing).
- **Fix:** Copied `next-env.d.ts` and `.next/types/{cache-life,root-params,routes,validator}.ts` from the main checkout (a real file copy, consistent with the environment-setup instructions for `node_modules`/`src/generated/prisma`).
- **Files modified:** `next-env.d.ts`, `.next/types/*` (both gitignored, not committed).
- **Verification:** `npm run typecheck` afterward showed only the one pre-announced, expected `section-renderer.tsx` error (fixed by sibling plan 05-10).
- **Committed in:** not committed (gitignored generated files).

**2. [Rule 3 - Blocking] Added `templateKey` to `saveBranding` fixture calls in two isolation test files within this plan's own `<verify>` scope**
- **Found during:** Task 3 (making `templateKey` a required field on `saveBrandingSchema`)
- **Issue:** The plan's own top-level `<verification>` block requires both `tests/isolation/storefront-editor.test.ts` and `tests/isolation/branding.test.ts` to pass after all three tasks. `storefront-editor.test.ts`'s fixture (`signUpChooseAndCarrySession`) calls `saveBranding({...})` without a `templateKey`, so once Task 3 lands it would fail `saveBrandingSchema`'s parse and throw inside the fixture, taking down every test in that file.
- **Fix:** Added `templateKey: "flagship-fashion"` to that one fixture call, and to `branding.test.ts`'s shared `payload()` builder (the field this task's own acceptance criteria explicitly asked for).
- **Files modified:** `tests/isolation/storefront-editor.test.ts`, `tests/isolation/branding.test.ts`.
- **Verification:** Both files pass individually (`storefront-editor.test.ts`: 9/9, `branding.test.ts`: 8/8).
- **Committed in:** `df7091d` (Task 3 commit).

---

**Total deviations:** 2 auto-fixed (1 blocking/environment, 1 blocking/test-fixture)
**Impact on plan:** Both were necessary to make the plan's own stated verification gates pass; neither touched behavior outside what Task 3's own acceptance criteria already required. No scope creep into the five isolation files outside this plan's `files_modified` — those are logged in `deferred-items.md` instead of fixed, per the scope-boundary rule.

## Issues Encountered

- A combined run of `tests/isolation/storefront-editor.test.ts tests/isolation/branding.test.ts` in one `vitest` invocation (an extra check beyond the plan's own per-task `<verify>` blocks, attempting to satisfy the top-level `<verification>` section in one pass) hit one transient `PrismaClientKnownRequestError: Transaction API error: Unable to start a transaction in the given time` inside `ensureStorefrontSeeded`'s pre-existing transaction — a named, documented flake class in this repo (two session-bearing files each calling `seedTwoTenants()` in `beforeAll`, contending for a slot on the shared remote Neon test branch). `ensureStorefrontSeeded` is untouched by this plan (explicitly out of scope per Task 1's `<action>`), and both files pass cleanly when run individually (which is what each task's own `<verify>` block actually specifies). Logged in `deferred-items.md`; not treated as a regression.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `switchTemplate` is ready for the template-picker UI (plan 05-09) to call.
- `saveBranding`'s new `templateKey` field is ready for the onboarding branding form to supply once that UI plan wires a template choice into `src/app/onboarding/branding/branding-form.tsx` (currently out of this plan's scope — that form still omits `templateKey` from its `saveBranding` call and will need updating by whichever plan adds the picker to onboarding).
- Six isolation test files outside this plan's `files_modified` (`catalog.test.ts`, `claims.test.ts`, `merchant-context.test.ts`, `order-actions.test.ts`, `read-only.test.ts`, `trial.test.ts`) call `saveBranding` without the new required field and will fail their own fixture setup until updated — flagged in `deferred-items.md` for plan 05-21, which `src/server/theming/access.ts`'s own header names as the plan that "pins" this phase's tier-gate isolation behaviour.

---
*Phase: 05-template-segment-expansion*
*Completed: 2026-09-06*

## Self-Check: PASSED

- FOUND: `.planning/phases/05-template-segment-expansion/05-11-SUMMARY.md`
- FOUND: `src/server/theming/actions.ts`
- FOUND: commit `03c9c44` (Task 1)
- FOUND: commit `bd3022b` (Task 2)
- FOUND: commit `df7091d` (Task 3)
