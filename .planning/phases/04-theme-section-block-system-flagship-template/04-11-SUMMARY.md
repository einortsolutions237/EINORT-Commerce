---
phase: 04-theme-section-block-system-flagship-template
plan: 11
subsystem: ui
tags: [onboarding, react-hook-form, zod, radio-group, r2-upload, wcag-contrast, next-app-router]

# Dependency graph
requires:
  - phase: 04-theme-section-block-system-flagship-template
    provides: "saveBranding (04-09), requestLogoUpload + logo preset (04-05), strings.branding + INDUSTRY_SEGMENTS/ICONS (04-04, 04-06), hexColorSchema (04-02), contrastRatio + theme defaults (04-02)"
  - phase: 02-subscription-plans-entitlements
    provides: "the /onboarding/plan step and the requireMerchantContext redirect ladder this extends by one rung"
provides:
  - "The `industry === null -> /onboarding/branding` rung on requireMerchantContext"
  - "The plan screen's bounce-back branch, retargeted so branding cannot be skipped"
  - "/onboarding/branding — RSC shell with its own session ladder, plus a loading skeleton"
  - "The four-card branding island: business name, six industry tiles, optional logo, two accents"
  - "storefrontOrigin() — the client-side cross-origin storefront URL builder"
affects: [04-12, 04-13, 04-15, phase-05-templates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A route that fixes an onboarding state resolves the session itself instead of calling the merchant DAL, so the DAL rung gating that state cannot loop the surface against itself"
    - "A tile-grid radio: the item is stretched over the tile at zero opacity so the whole tile is the tap target, with the border/ring carrying the selection"
    - "A client form schema that reuses the server's validator (hexColorSchema) rather than restating it"

key-files:
  created:
    - src/app/onboarding/branding/page.tsx
    - src/app/onboarding/branding/branding-form.tsx
    - src/app/onboarding/branding/loading.tsx
  modified:
    - src/server/merchant/context.ts
    - src/app/onboarding/plan/page.tsx

key-decisions:
  - "The branding page and saveBranding both stay outside requireMerchantContext — a merchant on that page has industry === null by definition, so routing either through the wrapper would redirect the request back to the page it came from (T-04-27)."
  - "`industry` was added to MERCHANT_COLUMNS but deliberately NOT to resolveEntitlements' OrgRow: OrgRow is structural, so the extra property is accepted on the value, and widening the type would force every entitlements fixture to carry a column the resolver never reads."
  - "The plan screen's already-chosen branch now redirects to /onboarding/branding while industry is null. Without it the one bounce-back path the DAL cannot see (this route is outside the DAL) would let the back button skip branding permanently."
  - "The colour field is ONE component rendered twice rather than two inline copies — the two-controls-one-value binding, the uppercasing, the 7-character cap and the validated chip are behaviour, and duplicated behaviour drifts. The primary/secondary difference (the contrast warning) is passed in as a prop."
  - "The contrast warning is primary-only, role=status, aria-live=polite, and is not wired to the submit button's disabled state (D-11). The secondary accent gets none, because its foreground is derived server-side and is readable at every value."
  - "The cross-origin success navigation goes through a named storefrontOrigin() helper: the host comes from the build-time NEXT_PUBLIC_ROOT_DOMAIN and never from the current document, and the named function is also what keeps @next/next/no-location-assign-relative-destination quiet (the plan-picker precedent)."

patterns-established:
  - "Onboarding-step self-authorization: session -> /login, no active organization -> /onboarding/create-store, no organization row -> /onboarding/create-store, planTier === null -> /onboarding/plan, then an already-done branch."
  - "Server-only registries hand icon NAMES down to client islands, which map them to components through a local Record with a fallback."
  - "A validated-sample helper (sampleColour) keeps an unparsed hex value from ever reaching a style attribute, while still showing the merchant a chip."

requirements-completed: [ONB-02, ONB-03, ONB-04]

# Metrics
duration: 38min
completed: 2026-09-03
---

# Phase 04 Plan 11: Onboarding Branding Step Summary

**The `/onboarding/branding` step — business name, six industry tiles, an optional R2 logo and two WCAG-checked accents — submitting straight onto the merchant's own live, published subdomain, with a new DAL rung that makes the step unskippable.**

## Performance

- **Duration:** ~38 min
- **Tasks:** 3 of 3
- **Files created:** 3
- **Files modified:** 2

## Accomplishments

- `requireMerchantContext()` grew exactly one rung — `industry === null -> /onboarding/branding` — immediately below the plan rung, with its zero-parameter signature and `resolveEntitlements`' `OrgRow` both untouched.
- `/onboarding/branding` exists as a Server Component with its own four-rung session ladder, deliberately outside the merchant DAL so the rung that sends merchants there cannot bounce them off it.
- The four-card island ships: a prefilled business name, a six-tile industry radio grid whose whole tile is the tap target, an optional logo running the Phase 3 presign → direct PUT → finalize pipeline at `kind: "logos"`, and two colour fields whose sample chips are the only elements on the page that take a merchant value.
- A light primary accent produces a non-blocking `role="status"` warning that the merchant can read and ignore; the submit is never disabled by it.
- Submitting calls `saveBranding` (which writes the published halves in the same transaction) and hard-navigates to `{protocol}://{slug}.{rootDomain}`.

## Task Commits

1. **Task 1: Extend the redirect ladder by exactly one rung** — `141a580` (feat)
2. **Task 2: The /onboarding/branding route shell** — `ae3bfa2` (feat)
3. **Task 3: The branding form** — `de534a0` (feat)

## Files Created/Modified

- `src/server/merchant/context.ts` — `industry: true` on `MERCHANT_COLUMNS`, and the one new redirect rung below the plan rung.
- `src/app/onboarding/plan/page.tsx` — selects `industry`; the already-chosen branch now routes to `/onboarding/branding` while it is null. The `rootDomain`/`protocol` expression is byte-identical to before.
- `src/app/onboarding/branding/page.tsx` — the RSC shell: session ladder, business-name prefill, the six tiles as plain data, `R2_PUBLIC_BASE_URL` handed down as a string.
- `src/app/onboarding/branding/branding-form.tsx` — the client island: RHF + `zodResolver`, the four cards, the logo's three hops, the two colour fields, the submit and the cross-origin hand-off.
- `src/app/onboarding/branding/loading.tsx` — a skeleton shaped like the final page (heading, subline, four card blocks, the CTA), no spinner.

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | passes |
| `npm run lint` (`--max-warnings=0`) | passes |
| `npm run test:unit` | 32 files / 566 tests, all passing (includes `surface-token-isolation`, `no-tenant-id-param`, `theming-registry`) |
| `npm run build` | succeeds; `/onboarding/branding` registered as a dynamic route |

`npm run test:full` was **not** run here by explicit orchestrator instruction: plan 04-13 owns the isolation-suite verification for branding in this wave, and a second concurrent run against the shared `TEST_DATABASE_URL` branch causes transaction timeouts and false failures.

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one is the first: the branding page and `saveBranding` are both outside the merchant DAL on purpose, and `src/server/theming/actions.ts`'s header (plan 04-09) already documents the write half of that decision. Neither should be "tidied" into the standard wrapper.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `window.location.assign()` with a template literal fails the lint gate**

- **Found during:** Task 3
- **Issue:** `@next/next/no-location-assign-relative-destination` cannot prove a template-literal argument is absolute and reports a warning, which `--max-warnings=0` turns into a failed build. The plan's success redirect is written as a template literal.
- **Fix:** Extracted the plan screen's builder into a module-level `storefrontOrigin(slug)` in the island, and passed the call result to `window.location.assign`. This is the exact shape `src/app/onboarding/plan/plan-picker.tsx` already uses for the same hop. The scheme/domain expression itself is unchanged from `plan/page.tsx`.
- **Files modified:** `src/app/onboarding/branding/branding-form.tsx`
- **Verification:** `npm run lint` exits 0.
- **Committed in:** `de534a0`

**2. [Rule 3 — Blocking] Worktree shipped without `node_modules`, `src/generated/prisma`, `.env.local`, `.env.test` and `.next/types`**

- **Found during:** Task 1 verification
- **Issue:** All five are gitignored and absent from a fresh worktree, so `typecheck` reported nine phantom `Cannot find name 'PageProps'/'LayoutProps'` errors in files this plan never touched, and nothing else could run.
- **Fix:** Copied all five from the main checkout at `D:\Maxs\Claude\einort-commerce`. Environment repair only — no source change.
- **Verification:** `npm run typecheck` clean afterwards, with no edits to the nine reporting files.
- **Committed in:** nothing (all five are gitignored).

### Accepted Divergences from the Plan's Literal Acceptance Greps

Three acceptance criteria are stated as exact `grep -c` counts that cannot be satisfied by any correct implementation. The invariant each is a proxy for **is** satisfied; the count is not. Recorded here rather than gamed:

| Criterion | Actual | Why |
|---|---|---|
| `grep -c "requestLogoUpload" branding-form.tsx` returns 1 | **2** | `grep -c` counts matching LINES. The import statement and the call site are two lines. Reduced from 3 by rewording a comment. **Invariant holds: exactly one call site.** |
| `grep -c "contrastRatio" branding-form.tsx` returns 1 | **2** | Same reason — import line plus the one call. **Invariant holds: `contrastRatio` is invoked once, on the primary accent only.** |
| `style={{ backgroundColor:` appears exactly twice | **1** | The colour field is one `ColourField` component rendered twice, not two inline copies. Duplicating ~35 lines of JSX to make a grep read `2` would trade the codebase's own anti-drift rule (`create-store-form.tsx`: "a second copy of that behaviour is how the two surfaces silently drift apart") for a literal count. **Invariant holds: one sample chip per colour field, painted from a variable that has cleared `hexColorSchema`, and nothing else on the page takes a merchant colour** — `grep -c "data-surface\|brand-accent"` returns 0 and ban 6 passes. |

One further wording change: the plan asked for an all-caps block naming `requireMerchantContext` in `page.tsx` **and** for `grep -c "requireMerchantContext" page.tsx` to return 0. The block is present but names "the merchant DAL" instead of the identifier, and says why — the same convention `src/server/theming/actions.ts` and `src/server/theming/registry.ts` already use for grep-audited boundaries. The grep now returns 0.

---

**Total deviations:** 2 auto-fixed (both Rule 3), plus 3 recorded grep-count divergences and 1 comment-wording change.
**Impact on plan:** No scope creep. Every behavioural contract in the plan is implemented as written.

## Issues Encountered

- **Base UI's `RadioGroupItem` is a `<button>`, not a labelable control.** Wrapping the tile in a `<label>` would not have forwarded clicks to it. Resolved by making the tile a `relative` container, stretching the radio over it at `opacity-0` (so the whole tile is genuinely the tap target), naming it with `aria-labelledby` pointing at the tile's `Label`, and neutralising the primitive's `::after` hit-area so it cannot overlap neighbouring tiles.
- **Selection styling is driven from React state rather than a `has-data-checked:` variant.** The `has-` + `data-*` composed variant's exact spelling in Tailwind 4 was not worth a build-time gamble for a step a merchant cannot skip; the ternary produces the spec's `border-primary ring-2 ring-primary` deterministically. Focus is expressed as an `outline` (not a ring) so it cannot collide with the selected ring.
- **No `strings.branding` key exists for a business-name validation error.** Rather than inline copy (banned) or add a key to `src/lib/strings.ts` (owned by plan 04-04 and outside this plan's file list, in a parallel wave), the field surfaces the resolver's own message. The field is prefilled, so an invalid value requires the merchant to clear it deliberately. Logged below.

## Deferred Items

- `strings.branding` has no business-name error copy. A future plan should add one (e.g. `nameError: "Enter a name between 2 and 80 characters."`) and wire it in place of the resolver's default message in `branding-form.tsx`.

## Known Stubs

None. Every field on the page is wired to a real write, and the submit lands on a live published storefront.

## Threat Flags

None — every surface this plan adds is covered by the plan's own `<threat_model>`. The three externally-reachable paths (`saveBranding`, `requestLogoUpload`, the finalize route) were all built and registered by earlier plans in this phase; this plan only calls them.

## Next Phase Readiness

- The onboarding ladder is complete end to end: signup → `/onboarding/plan` → `/onboarding/branding` → a live branded subdomain.
- Plan 04-15's iframe URL should reuse the same origin builder (Pitfall 12); `storefrontOrigin()` in `branding-form.tsx` is the client-side statement of it, and `plan/page.tsx` / `branding/page.tsx` carry the server-side one, all three byte-identical in their scheme rule.
- Plan 04-12's editor colour field is specified as "identical to the onboarding colour field" — `ColourField` in `branding-form.tsx` is the reference implementation, and its copy already reads from `strings.branding` (which is why `THEME_FIELDS` points there too).
- Manual smoke on `npm run dev` (fresh signup walking the whole ladder) has **not** been performed and remains open.

---
*Phase: 04-theme-section-block-system-flagship-template*
*Completed: 2026-09-03*
