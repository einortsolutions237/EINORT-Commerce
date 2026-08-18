---
phase: 02-merchant-auth-entitlements-trial
plan: 02
subsystem: onboarding
tags: [onboarding, plan-selection, server-action, pricing-screen, shadcn, tdd, react-compiler]
requires:
  - "02-01: PLAN_TIERS / PLANS / PlanTier and the Organization.planTier + planSelectedAt columns"
  - "01-06: signUpMerchant, createStoreForCurrentUser and the session-derived-identity idiom"
  - "01-07: signup-form.tsx / create-store-form.tsx and storeOrigin(slug)"
  - "01-01: the unit/isolation vitest project split and the two-tenant seed"
provides:
  - "src/server/merchant/actions.ts — selectPlan, SelectPlanResult ({tier}-only schema, session-derived tenant, idempotent)"
  - "src/app/onboarding/plan/page.tsx — the three-tier pricing screen and its guard ladder"
  - "src/app/onboarding/plan/plan-picker.tsx — PlanPicker, PlanCard (native-radio client island)"
  - "strings.plan — both plan surfaces' copy, including the /dashboard/plan strings plan 02-05 consumes"
  - "src/components/ui/badge.tsx — official shadcn badge with the Label-role and h-6 overrides"
  - "tests/isolation/plan-selection.test.ts — 5 tests pinning persistence, forged-payload refusal and idempotence"
affects: [02-03, 02-04, 02-05, 02-07]
tech-stack:
  added: []
  patterns:
    - "The tenant target is never in the payload: {tier}-only Zod schema, organization read from session.session.activeOrganizationId"
    - "Prices formatted on the server from PLANS and passed to the island as finished strings — the client receives no number to compute with"
    - "Idempotence-not-authorization guard: a non-null planTier short-circuits to ok:true rather than re-writing, so a replayed request cannot re-price a store or move the trial anchor"
    - "Native <input type=\"radio\"> inside a full-card <label>, focus ring rendered on the card via has-[:focus-visible]:outline-*, no radio group component"
    - "Same-origin apex hops use router.push; the storefront hop stays window.location.assign because it crosses origins"
    - "One server action deliberately outside the entitlement wrapper, because the wrapper's null-planTier redirect would loop the surface that fixes null planTier"
key-files:
  created:
    - src/server/merchant/actions.ts
    - src/app/onboarding/plan/page.tsx
    - src/app/onboarding/plan/plan-picker.tsx
    - src/components/ui/badge.tsx
    - tests/isolation/plan-selection.test.ts
  modified:
    - src/lib/strings.ts
    - src/app/signup/signup-form.tsx
    - src/app/onboarding/create-store/create-store-form.tsx
decisions:
  - "selectPlan returns the session-expired copy (not a new string) for both no-session and null-activeOrganizationId, and never searches for an organization by user — searching would re-derive a tenant the session does not assert"
  - "The three radios are rendered by mapping the server-supplied plans array rather than written out three times, so the card count follows PLAN_TIERS instead of a hand-maintained triple"
  - "The /dashboard/plan copy authored here lives at strings.plan.dashboard, nested under plan because it reuses the same tier names, taglines and bullets"
  - "Prices are formatted in page.tsx (server) and passed as strings; the island imports no price and no formatter"
requirements-completed: []
metrics:
  duration: ~50 min
  completed: 2026-08-18
  tasks: 3
  commits: 3
  tests-added: 5
  tests-total: 223
---

# Phase 2 Plan 02: Mandatory Plan Selection Summary

Signup no longer reaches the storefront directly: it lands on a real three-tier pricing screen whose pick writes `planTier` + `planSelectedAt` to the merchant's own organization through a `{tier}`-only server action that cannot be retargeted by a forged payload.

## What Was Built

**`src/server/merchant/actions.ts`** — `selectPlan(input)`. The schema is `z.object({ tier: z.enum(PLAN_TIERS) })` and nothing else: no organization id, no tenant id, no user id, so a forged key is dropped by the parse and the write still lands on `session.session.activeOrganizationId`. A missing session *or* a null active organization both return the existing `strings.signup.sessionExpired` copy and perform no write — the action deliberately does **not** fall back to "find an organization this user belongs to", because that would quietly re-derive a tenant the session never asserted. A non-null `planTier` short-circuits to `{ ok: true, slug }`: idempotence rather than authorization, for the same reason `createStoreForCurrentUser` short-circuits on an existing store, with the added stake that `planSelectedAt` is the trial's anchor and re-writing it would extend the trial.

It is deliberately **not** routed through `merchantAction` (plan 02-03). At this point in the flow `planTier` is null, and the wrapper's context resolver redirects exactly that state back to `/onboarding/plan` — routing the selection through it would loop the merchant on the screen they are trying to leave. This is the one merchant write that legitimately runs before entitlements exist.

**`src/app/onboarding/plan/page.tsx`** — a server component with a four-step guard ladder (no session → `/login`; no active organization → `/onboarding/create-store`; organization row missing → `/onboarding/create-store`; `planTier` already set → the storefront origin, no "you already picked" screen). Prices are read from `PLANS[tier].monthlyPriceXaf` and run through `Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 })` **here, on the server**, then handed to the island as finished strings. Card order comes from `PLAN_TIERS` itself rather than a second ordering to keep in sync.

**`src/app/onboarding/plan/plan-picker.tsx`** — the `"use client"` island. A `<fieldset>` with a visually hidden `<legend>` wraps one native radio per tier, each `sr-only` inside a `<label>` that is the whole card, so the card is the tap target and arrow-key roving focus, `aria-checked` and form semantics all come for free. No pre-selection (D-04 pre-*highlights* Business with the badge; D-05 makes the pick a deliberate act), CTA disabled until a tier is checked, no skip control. Selected treatment is a 2px `--primary` ring plus a `check` icon with a visually hidden `Selected`; the fill never changes. The focus ring renders on the **card** through `has-[:focus-visible]:outline-*`, not on the hidden radio. Errors render in a destructive `Alert` above the CTA, never a toast.

**`strings.plan`** — one namespace for both plan surfaces. `/onboarding/plan` headings, subline, badge label, `/month` suffix, hidden `Selected`, CTA and its pending form, the no-selection and generic-error lines; per-tier `name`, `tagline`, group header and the verbatim bullet lists (Starter 8, Business 10, Professional 8, with the constraint-excluded payment-integration bullet deliberately omitted); and `strings.plan.dashboard.*`, the `/dashboard/plan` copy plan 02-05 consumes. No formatted price literal appears anywhere in the namespace.

**`src/components/ui/badge.tsx`** — installed from the official registry (`registries: {}` unchanged, no dependency added) with exactly two tokens overridden in place: `text-sm font-semibold` for the Label role and `h-6` so the taller line-height does not clip.

**Both post-signup redirects rewired** — `signup-form.tsx` and `create-store-form.tsx` now `router.push("/onboarding/plan")`. `storeOrigin` is no longer imported by either: the plan picker owns the cross-origin hop now, and `/onboarding/plan` is same-origin apex where a full-page assign would throw away the client router mid-onboarding. Nothing else in either form changed — not the fields, not the order, not the slug check.

## Key Decisions

**A no-session and a null `activeOrganizationId` get the same answer.** Both are "your session does not currently identify a store", and both must perform no write. Inventing a second message would add a copy string whose only job is to describe an internal distinction the merchant cannot act on differently.

**The radios are mapped, not written out three times.** The plan's acceptance criterion expected three literal `type="radio"` occurrences in the source; the implementation renders them from the server-supplied `plans` array, which is built from `PLAN_TIERS`. The DOM has exactly three, and the count now follows the registry — a fourth tier would produce a fourth card instead of silently rendering three. Unrolling to satisfy the grep would have re-introduced exactly the hand-maintained triple that `PLANS` exists to eliminate. Logged as a deviation below.

**`/dashboard/plan` copy is nested at `strings.plan.dashboard`.** That surface reuses the tier names, taglines and bullets verbatim; only the switcher's own lines are new. A sibling top-level namespace would have been a second home for the same copy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fresh worktree had no dependencies, no env files and no generated types**

- **Found during:** Task 1, before the first test run
- **Issue:** The worktree carried no `node_modules`, no `.env.local`, no `.env.test`, no Prisma client and no Next route types, so no test, lint, typecheck or build command could run.
- **Fix:** Copied `.env.local` / `.env.test` from the main checkout, ran `npm ci` (from the committed lockfile — no package added, no lockfile change; `git status` clean afterwards), then `node scripts/prisma-generate.mjs` and `npx next typegen`. This is the documented fresh-worktree setup in 02-PATTERNS.md § Fresh-worktree setup.
- **Files modified:** none (all four paths are gitignored)

**2. [Rule 3 - Blocking] A `node_modules` junction is not buildable by Turbopack**

- **Found during:** Task 3 verification (`npx next build`)
- **Issue:** The first attempt at environment setup reused plan 02-01's approach — a directory junction from the worktree's `node_modules` to the main checkout's. Vitest, ESLint and `tsc` are all fine with it, but Turbopack panics: `Symlink [project]/node_modules is invalid, it points out of the filesystem root`. Removing the junction and relying on Node's parent-directory resolution does not help either, because Turbopack constrains resolution to the workspace root and then reports `Could not find the Next.js package`.
- **Fix:** Replaced the junction with a real `npm ci` inside the worktree (see deviation 1). Worth recording for the remaining Phase 2 worktrees: **a junction is sufficient only for plans that never run `next build`.**
- **Files modified:** none (gitignored)

**3. [Rule 1 - Bug] The isolation harness could not authenticate a second request**

- **Found during:** Task 2 (GREEN run — 3 of 5 tests returned session-expired)
- **Issue:** The harness was written to replay `signup.test.ts`'s `next/headers` cookie jar into the next request's `Cookie` header. The jar is always empty under Vitest: `nextCookies()` reaches its cookie store through a dynamic `import("next/headers.js")`, and `vi.mock("next/headers")` does not intercept that specifier. `signup.test.ts` never noticed because none of its assertions read the jar. A jar-based helper therefore authenticates nothing, and every `selectPlan` call looked like an expired session.
- **Fix:** `authenticateAs(email)` now performs a real `auth.api.signInEmail({ returnHeaders: true })` and applies the issued `Set-Cookie` with Better Auth's own `applySetCookies` — the same helper `signup.ts` uses internally, which matters because the session cookie is signed and percent-encoded and a hand-rolled `name=value` join gets the round trip wrong. This is both the honest round trip and a bonus exercise of the `databaseHooks` back-fill that puts `activeOrganizationId` on a sign-in session.
- **Verification:** 5/5 tests pass; the diagnosis was confirmed with a throwaway scratch test that printed the jar (empty) and the sign-in session (populated, with `activeOrganizationId`). The scratch file was deleted and never committed.
- **Files modified:** `tests/isolation/plan-selection.test.ts`
- **Commit:** `caacc3a`

**4. [Deferred criterion] `grep -c "type=\"radio\"" plan-picker.tsx` is 1, not 3**

- **Found during:** Task 3 acceptance verification
- **Issue:** The criterion assumes three literal radio inputs in the source. The island maps the server-supplied `plans` array instead, so the literal appears once and renders three times.
- **Resolution:** Kept the map. Satisfying the grep would mean duplicating a card three times and hand-maintaining the count — the exact drift `PLAN_TIERS` and `PLANS` exist to prevent, and it would silently render three cards if a fourth tier were ever registered. The criterion's intent (three native radios, no radio-group component, no pre-selection) holds: `radio-group` count is 0, `defaultChecked` count is 0, and the rendered DOM has one radio per `PLAN_TIERS` entry. The DOM-level count is a plan 02-07 human-verify item, as the plan's own verification section anticipates.
- **Files modified:** `src/app/onboarding/plan/plan-picker.tsx` (comment reworded so the `radio-group` grep reads 0 — the only occurrence was a comment naming the prohibition)

No Rule 2 or Rule 4 deviations. **Total: 3 auto-fixed (2 blocking-environment, 1 test bug), 1 criterion deferred with reason.** Impact: no production-code behaviour differs from the plan.

## Authentication Gates

None. No login, no API key and no external service was required.

## Verification

| Check | Result |
|-------|--------|
| `npx dotenv -e .env.test -- npx vitest run tests/isolation/plan-selection.test.ts` | 5 passed, 0 failed |
| `npm run test:full` | 12 files, **223 passed**, 0 skipped (baseline was 186; 02-01 added 32, this plan adds 5) |
| `npm run lint` (`--max-warnings=0`) | exit 0, no `react-hooks/*` warning on the new island |
| `npm run typecheck` | exit 0 |
| `npx next build` | succeeds; `/onboarding/plan` listed as `ƒ (Dynamic)` |
| `grep -n 'router.push("/onboarding/plan")' signup-form.tsx create-store-form.tsx` | matches in both |
| `grep -c "storeOrigin" src/app/signup/signup-form.tsx` | 0 — the cross-origin call is gone from the signup success branch |
| `grep -c "radio-group"` / `grep -c "defaultChecked"` in `plan-picker.tsx` | 0 / 0 |
| `grep -rn "Skip\|Decide later\|décider" src/app/onboarding/plan/` | no matches |
| `grep -c "min-h-11" plan-picker.tsx` | 2 |
| `grep -c "h-6"` / `"text-sm font-semibold"` in `badge.tsx` | 2 / 2 (comment + applied class) |
| FCFA/XAF literals inside the `plan` strings namespace | 0 |
| `plan.starter/business/professional.features` lengths | 8 / 10 / 8, matching 02-UI-SPEC.md § Tier copy |
| `git status` after `npm ci` | clean — no `package.json` or `package-lock.json` change |

Manual sanity (formally checked in plan 02-07): the flow is `/signup` → `router.push("/onboarding/plan")` → pick a tier → `window.location.assign(storeOrigin(slug))`. The seeded `alpha-store` and `recovered-store` rows still carry `planTier = NULL`, so they remain a live test of the D-05 gate.

## Threat Model Coverage

| Threat ID | Disposition | Evidence |
|-----------|-------------|----------|
| T-02-06 | mitigated | `{ tier }`-only schema; target from `session.session.activeOrganizationId`. The "forged organizationId ignored" test passes a **real** seeded `TENANT_B.id` and asserts that row's `planTier` is still null afterwards |
| T-02-07 | mitigated | `auth.api.getSession({ headers: await headers() })` is the only identity source; the "no session" test asserts the session-expired result and no throw |
| T-02-08 | mitigated | Prices formatted in `page.tsx` from `PLANS[tier].monthlyPriceXaf`; the island receives strings only, and the `plan` strings namespace holds no price literal |
| T-02-09 | deferred by design | The screen has no skip control, but the enforcing control is plan 02-03's DAL redirect on `planTier === null`. This plan deliberately does not claim that mitigation |
| T-02-10 | mitigated | `components.json` `registries: {}` untouched; `npx shadcn add badge` copied source from the official registry only |
| T-02-SC | mitigated | Zero packages added. `npm ci` installs the committed lockfile verbatim; `git status` shows no manifest change |

## Threat Flags

None. No new network endpoint, auth path or schema change was introduced — `selectPlan` writes two already-migrated columns on the caller's own organization.

## Known Stubs

None. Every rendered string resolves through `strings.plan.*` and every price through `PLANS`. `strings.plan.dashboard.*` is authored-ahead copy for plan 02-05's `/dashboard/plan`, not a stub: it has no surface yet by design, and the plan explicitly assigns its authorship here so the two plan screens cannot drift.

## Notes for Downstream Plans

- **`selectPlan` is the only merchant write that may run before entitlements exist.** Plan 02-03's `merchantAction` wrapper must not be retrofitted onto it — the wrapper's `planTier === null → /onboarding/plan` redirect would loop this exact surface.
- **`/login` does not exist yet.** `page.tsx` redirects there for the no-session case; the plan that builds `/login` closes that loop. Nothing type-checks route strings today, so this compiles and builds cleanly either way.
- **Plan 02-05 should import `strings.plan.dashboard.*` rather than author new copy**, and should read tier names from `strings.plan[tier].name` — no user-facing string may name the internal `planTier` value.
- **The `PlanCard` prop type is exported from `plan-picker.tsx`.** A dashboard switcher that wants the same cards can reuse it; the price must stay a pre-formatted string produced on the server.
- **Isolation tests that need an authenticated second request should use the `authenticateAs` pattern here, not the cookie jar.** The jar is empty under Vitest (see deviation 3); `applySetCookies` on a real `signInEmail` response is the working route.
- **A `node_modules` junction is not enough for any plan that runs `next build`** — use `npm ci` in the worktree.

## Self-Check: PASSED

Files verified present on disk: `src/server/merchant/actions.ts`, `src/app/onboarding/plan/page.tsx`, `src/app/onboarding/plan/plan-picker.tsx`, `src/components/ui/badge.tsx`, `tests/isolation/plan-selection.test.ts`, `src/lib/strings.ts`.
Commits verified in `git log`: `30fae2f` (RED), `caacc3a` (GREEN), `3abb0f6` (screen + redirects).

## TDD Gate Compliance

RED (`30fae2f`, `test(02-02)`) → GREEN (`caacc3a`, `feat(02-02)`) → no refactor commit needed. The RED run failed on the unresolved `@/server/merchant/actions` specifier — the correct RED signal for a module that does not exist yet — rather than on harness setup.
