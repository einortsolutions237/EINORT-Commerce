---
phase: 02-merchant-auth-entitlements-trial
plan: 03
subsystem: merchant-dashboard
tags: [dal, react-cache, tenant-isolation, server-actions, trial-banner, read-only, tdd, next16]
requires:
  - "02-01: resolveEntitlements, MerchantContext, OrgRow, TRIAL_DAYS, TRIAL_URGENT_DAYS, isUrgentTrial, ReadOnlyError, EntitlementError"
  - "02-02: selectPlan and the /onboarding/plan screen this DAL's plan gate redirects to"
  - "01-02: platformDb (Organization is the tenant, so never scopedDb) and the fail-closed voice of src/server/tenant/resolve.ts"
  - "01-06: auth.api.getSession and the organization plugin's input:false activeOrganizationId"
  - "01-07: the /signup card construction reused by /suspended"
provides:
  - "src/server/merchant/context.ts — requireMerchantContext(), React.cache()-wrapped, parameterless, session-derived, redirect ladder"
  - "src/server/merchant/action.ts — merchantAction() factory and ActionResult<T>"
  - "src/app/(dashboard)/layout.tsx — the shell; calls the DAL for banner data and never redirects"
  - "src/app/(dashboard)/trial-banner.tsx — TrialBanner, TrialBannerProps (four states from a server-computed integer)"
  - "src/app/(dashboard)/dashboard/page.tsx — /dashboard, authorizing itself"
  - "src/app/suspended/page.tsx — /suspended"
  - "strings.trial / strings.dashboard / strings.entitlements / strings.suspended"
  - "tests/unit/no-tenant-id-param.test.ts (3), tests/isolation/merchant-context.test.ts (5), tests/isolation/trial.test.ts (1)"
affects: [02-04, 02-05, 02-06, 02-07]
tech-stack:
  added: []
  patterns:
    - "Tenant identity as a parameterless function: no argument exists that could carry another tenant's id, and a source-level test fails the build if one is ever added"
    - "The layout is a data consumer, not an auth gate — every page re-calls the DAL and React.cache() makes the duplication free"
    - "mode as a required, never-defaulted config property, so the safe choice is not the one you have to remember"
    - "Refuse before parse: an expired-trial write costs zero database work, so a scripted POST cannot probe validation or generate load"
    - "Throwing entitlement guards converted to { ok: false } at the wrapper boundary; everything else rethrows so a bug stays a bug"
    - "Server-computed integer props for anything time-derived — no Date, ISO string or timestamp crosses into a dashboard component"
    - "Accessible name via aria-labelledby onto copy the component already renders, rather than an invented aria-label that can drift"
key-files:
  created:
    - src/server/merchant/context.ts
    - src/server/merchant/action.ts
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/trial-banner.tsx
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/suspended/page.tsx
    - tests/unit/no-tenant-id-param.test.ts
    - tests/isolation/merchant-context.test.ts
    - tests/isolation/trial.test.ts
  modified:
    - src/lib/strings.ts
decisions:
  - "The trial banner's accessible name comes from aria-labelledby pointing at the message it already renders, so no new aria-only copy string was authored and the announced name cannot drift from the visible one"
  - "The dashboard builds the storefront host and href on the server rather than importing storeOrigin, which reads window.location.protocol from a \"use client\" module and cannot run in a Server Component"
  - "merchantAction is a server-only factory, not a \"use server\" module: every export of an action module must be a registerable async function, and a generic higher-order function is not one"
  - "(dashboard)/layout.tsx is typed LayoutProps<\"/\"> because a route group adds no URL segment — confirmed against the generated LayoutRoutes union, not assumed from the folder name"
  - "merchant-context.test.ts seeds once per file rather than once per test: each test owns its own merchant, and five TRUNCATE transactions per file intermittently exceeded Prisma's 2000ms maxWait against the remote Neon branch"
requirements-completed: [TEN-04, SUB-02, ONB-05]
metrics:
  duration: ~55 min
  completed: 2026-08-23
  tasks: 3
  commits: 3
  tests-added: 9
  tests-total: 232
---

# Phase 2 Plan 03: Merchant DAL, Write Gate & Dashboard Summary

Tenant identity in the dashboard now has exactly one provenance — a parameterless, `React.cache()`-wrapped `requireMerchantContext()` reading `session.session.activeOrganizationId` — with a source-level test that fails the build if any merchant function ever grows a tenant-id parameter, a write gate that refuses expired-trial writes before the parse, and a `/dashboard` whose trial countdown is a server-computed integer.

## What Was Built

**`src/server/merchant/context.ts`** — `requireMerchantContext()`, `cache()`-wrapped and taking no arguments, ever. The session is read through `auth.api.getSession({ headers: await headers() })` and never hand-parsed; the tenant is `session.session.activeOrganizationId` and comes from nowhere else. The organization is read through `platformDb.organization.findUnique` with an eight-column `select` declared as a named `MERCHANT_COLUMNS` constant — a DTO, so nothing Prisma-shaped can be serialized into a component (T-02-16). The redirect ladder runs in order: no session → `/login`, no active organization → `/onboarding/create-store`, organization missing → `/login`, `status !== "active"` → `/suspended`, `planTier === null` → `/onboarding/plan`. Every rung redirects; none returns null, because a nullable return is a check a caller can forget and forgetting it would render the dashboard. `ACTIVE_STATUS` is allowlisted rather than `"suspended"` denylisted, so a status a future migration adds fails closed. This is the one place `new Date()` is called for trial purposes — the resolver stays pure.

**`src/server/merchant/action.ts`** — `merchantAction({ mode, schema, handler })` and `ActionResult<T>`. `mode` is a required union with no default, so a new action does not compile until its author has answered "does this write?". Inside the returned function the order is load-bearing: resolve the context, then refuse on `!ctx.canWrite` with `strings.trial.readOnlyBlocked` **before** `safeParse` and before any database call, then parse, then call the handler with `(ctx, parsed.data)` only. The handler never sees the raw payload, so it has no channel through which to read a tenant id out of the request. `ReadOnlyError` and `EntitlementError` thrown by a handler become `{ ok: false, error: { form: [message] } }`; everything else rethrows, so an unexpected error stays an error instead of being dressed up as a validation message.

It carries `import "server-only"` rather than `"use server"`. The two markers are mutually exclusive and this module is the right side of that line: every export of a `"use server"` module must be an async function Next can register as an endpoint, and a generic higher-order factory is not one. Callers put `"use server"` at the top of their own action module and build the exported action with `merchantAction({ … })`.

**`src/app/(dashboard)/layout.tsx`** — the shell. It calls the DAL for the banner's data and contains no `redirect(` at all, with a comment recording why: a Next 16 layout does not control whether child segments render and does not re-run on client-side navigation between siblings, so a check placed there is a check that sometimes does not happen. A second comment records that the route group is apex-only for free, because `src/proxy.ts` rewrites any storefront subdomain's `/dashboard` to `/s/{slug}/dashboard` where no route file exists — so nobody adds a hostname guard later, and nobody adds one to `proxy.ts` in violation of its own no-I/O rule. Header band with the store name, `max-w-3xl` single column, banner above `{children}`, no sidebar.

**`src/app/(dashboard)/trial-banner.tsx`** — a Server Component taking `daysLeft: number`, `state: TrialState` and `urgent: boolean`. `subscribed` renders `null` (not an empty container, which would leave a gap). `active` with `urgent` false gets the neutral `--muted` alert and a `clock` icon; `active` with `urgent` true gets `variant="destructive"` and `triangle-alert` — the same sentence in both, because D-12 asks for escalating urgency, not a new announcement. The singular is a separate string selected by `daysLeft === 1`. `expired` renders the read-only heading and body plus `Contact us to subscribe` to the WhatsApp URL, `target="_blank" rel="noopener noreferrer"`, an `external-link` icon and a visually hidden `(opens WhatsApp)`. Both active states carry `Change plan` → `/dashboard/plan`. Urgency is the caller's `isUrgentTrial(ctx)` result, so the threshold has one home in `TRIAL_URGENT_DAYS`. A `<section>` with an accessible name, no live region, no close control.

**`src/app/(dashboard)/dashboard/page.tsx`** — calls `requireMerchantContext()` itself, with a comment saying it must never be deleted on the grounds the layout already made the call. Heading, the store address in Label role and `--muted-foreground`, and the `Your store is live` empty state with `View my store` opening the storefront in a new tab. It links to nothing else: no "Add your first product", because Phase 3 owns products and a CTA that opens a 404 is worse than a quiet page.

**`src/app/suspended/page.tsx`** — static, `max-w-md`, the same card construction as `/signup`. Heading, body, `Contact us`. `/store-not-found` and `/s/[slug]/layout.tsx` are untouched, so the anonymous path stays byte-identical for unknown, unclaimed and suspended hostnames.

**`src/lib/strings.ts`** — four namespaces (`trial`, `dashboard`, `entitlements`, `suspended`) transcribed from 02-UI-SPEC.md. The WhatsApp URL appears exactly once, as copy; `src/env.ts` has no `wa.me` reference.

## Key Decisions

**The banner's accessible name is `aria-labelledby`, not `aria-label`.** The UI spec requires a `<section>` with an accessible name but authors no copy for one. Pointing `aria-labelledby` at the message the banner already renders satisfies the requirement with zero new strings and makes the announced name and the visible copy the same string by construction — an invented `aria-label` would be a second piece of copy free to drift from the first.

**The dashboard builds the storefront URL on the server.** The plan specified importing `storeOrigin(slug)` from `@/app/signup/store-address-field`, but that helper reads `window.location.protocol` and its module is a `"use client"` boundary, so it cannot run in a Server Component. `storeHost` (display: no scheme, no port) and `storeHref` (navigable: scheme and port intact) are derived locally from `NEXT_PUBLIC_ROOT_DOMAIN`, following the same protocol idiom already in `src/app/onboarding/create-store/page.tsx`. Logged as a deviation below.

**The read-only refusal runs before the parse.** Putting it after would mean an expired merchant's scripted POST still exercised Zod and, for anything with a uniqueness check, still touched Postgres. Refusing first makes the whole request cost one session read and one indexed row read, so a replayed write cannot be used to probe validation behaviour or generate load.

**`no-tenant-id-param.test.ts` scans two named directories, not `src/server/**`.** A broad glob would sweep in `resolveTenantBySlug(slug)`, whose parameter is both legitimate and load-bearing — the storefront's tenant genuinely arrives in the hostname. Naming the directories keeps the prohibition true rather than merely wide, while every *file* inside them is discovered automatically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fresh worktree had no dependencies, env files or generated types**

- **Found during:** Setup, before Task 1
- **Issue:** No `node_modules`, no `.env.local`, no `.env.test`, no Prisma client, no Next route types — no test, lint, typecheck or build command could run.
- **Fix:** Copied both env files from the main checkout, ran `npm ci` (committed lockfile, no package added — `git status` clean afterwards), then `node scripts/prisma-generate.mjs` and `npx next typegen`. `npm ci` rather than a `node_modules` junction, per 02-02-SUMMARY.md's note that Turbopack cannot build through a junction and this plan runs `next build`.
- **Files modified:** none (all gitignored)

**2. [Rule 1 - Bug] `storeOrigin` cannot be called from a Server Component**

- **Found during:** Task 3
- **Issue:** The plan's `<interfaces>` listed `@/app/signup/store-address-field: storeOrigin(slug)` as an existing import for the dashboard page. It builds its scheme from `window.location.protocol`, which is `undefined` on the server, and it lives in a `"use client"` module whose plain exports become client references when imported from a Server Component. Following the plan literally would have produced a runtime `window is not defined`.
- **Fix:** Derived `storeHost` and `storeHref` in `dashboard/page.tsx` from `NEXT_PUBLIC_ROOT_DOMAIN`, mirroring the server-side protocol idiom already present in `src/app/onboarding/create-store/page.tsx`. A comment in the page records why the import was not used, so nobody re-adds it.
- **Files modified:** `src/app/(dashboard)/dashboard/page.tsx`
- **Commit:** `6d452db`

**3. [Rule 1 - Bug] Five reseeds per file intermittently exceeded Prisma's transaction `maxWait`**

- **Found during:** Task 3 verification (`npm run test:full`)
- **Issue:** `tests/isolation/merchant-context.test.ts` ran `seedTwoTenants()` in `beforeEach`. That fixture opens with `TRUNCATE … CASCADE` inside a `$transaction` whose default `maxWait` is 2 000 ms; against the remote Neon branch, with `prismaBase`'s pool also live, one of the five failed with `Transaction API error: Unable to start a transaction in the given time` after 2 012 ms. Random — the same file passed 5/5 on the immediately preceding run.
- **Fix:** Moved the seed to `beforeAll`. Every test in the file signs up its own merchant under its own email and slug and mutates only its own organization, so isolation is a property of the fixtures rather than of the truncate. The `beforeEach` remains and still resets the request context — without it the previous test's session cookie would authenticate the next one and the "no session" case would silently stop testing anything. File runtime dropped from ~42s to ~25s.
- **Verification:** `merchant-context` + `trial` green twice in a row; `npm run test:full` green at 232/232.
- **Files modified:** `tests/isolation/merchant-context.test.ts`
- **Commit:** `6d452db`

### Deferred criteria

**4. Two acceptance greps matched documentation, not code**

- **Found during:** Task 3 acceptance verification
- **Issue:** `grep -rn "new Date()" src/app/(dashboard)/` and `grep -rn "aria-live\|dismiss\|localStorage" trial-banner.tsx` were both required to return nothing, but each matched a doc comment *stating the prohibition* — the comments explaining why no `Date` is constructed and why the banner is neither a live region nor dismissible.
- **Resolution:** Reworded both comments so the greps read 0 while the reasoning is unchanged ("no `Date` is ever constructed", "carries no live-region attribute", "no close control and nothing is remembered in browser storage"). Same resolution 02-02 applied to its `radio-group` comment. No code changed.
- **Files modified:** `src/app/(dashboard)/trial-banner.tsx`

No Rule 2 or Rule 4 deviations. **Total: 3 auto-fixed (1 blocking-environment, 2 bugs), 1 criterion resolved by rewording.** No production behaviour differs from the plan except deviation 2, which the plan's own prescription made impossible.

## Authentication Gates

None. No login, API key or external service was required.

## Verification

| Check | Result |
|-------|--------|
| `npx dotenv -e .env.test -- npx vitest run tests/isolation/merchant-context.test.ts tests/isolation/trial.test.ts` | 6 passed, 0 failed |
| `npx vitest run tests/unit/no-tenant-id-param.test.ts` | 3 passed |
| `npm run test:full` | 15 files, **232 passed**, 0 skipped (baseline 223 + 9) |
| `npm run lint` (`--max-warnings=0`) | exit 0, no `react-hooks/*` warnings |
| `npm run typecheck` | exit 0 |
| `npx next build` | succeeds; `/dashboard` is `ƒ (Dynamic)`, `/suspended` is `○ (Static)` |
| `grep -n "export const requireMerchantContext" context.ts` | zero-argument arrow wrapped in `cache(` |
| `grep -rn "generated/prisma\|server/db/base\|scopedDb" context.ts` | no matches (`platformDb` only) |
| `grep -rn "eslint-disable" src/server/merchant/` | no matches |
| `grep -n "mode" action.ts` | required config property, no default assignment |
| `grep -c "wa.me/237686661578" src/lib/strings.ts` / `grep -c "wa.me" src/env.ts` | 1 / 0 |
| `grep -c "requireMerchantContext" (dashboard)/dashboard/page.tsx` | 3 (≥1 required) |
| `grep -c "redirect(" (dashboard)/layout.tsx` | **0** |
| `grep -rn "new Date()" src/app/(dashboard)/` | no matches |
| `grep -c "daysLeft" trial-banner.tsx` | 6 |
| `grep -c "TRIAL_URGENT_DAYS\|isUrgentTrial" trial-banner.tsx` | 2 |
| `grep -rn "aria-live\|dismiss\|localStorage" trial-banner.tsx` | no matches |
| `git diff --diff-filter=D 9a27122..HEAD` | no deletions |
| `git status` after `npm ci` | clean — no manifest or lockfile change |

The RED run failed on the unresolved `@/server/merchant/context` specifier in both isolation specs and on the missing-resolver assertion in the unit spec — the correct signal for a module that does not exist yet, not a harness break.

## Threat Model Coverage

| Threat ID | Disposition | Evidence |
|-----------|-------------|----------|
| T-02-11 | mitigated | `requireMerchantContext()` takes no parameters; `tests/unit/no-tenant-id-param.test.ts` parses exported signatures out of `src/server/merchant/**` and `src/server/entitlements/**` and asserts none names `tenantId`/`organizationId`/`storeId`, plus a dedicated assertion that the resolver's parameter list is empty |
| T-02-12 | mitigated | `grep -c "redirect(" (dashboard)/layout.tsx` is 0; the page calls the DAL itself and the layout carries the comment saying why |
| T-02-13 | mitigated | The `!ctx.canWrite` refusal precedes `safeParse` and every database call. Disabled UI controls are explicitly documented as assumed bypassed |
| T-02-14 | mitigated | `TrialBannerProps` accepts `daysLeft: number`; no `Date` is constructed anywhere under `src/app/(dashboard)/` |
| T-02-15 | mitigated | `/suspended` is reachable only via the DAL redirect, which fires only when the session's own active organization is suspended. `/store-not-found` and `/s/[slug]/layout.tsx` are unmodified in this plan |
| T-02-16 | mitigated | `MERCHANT_COLUMNS` is an eight-key explicit `select`; `resolveEntitlements` returns `MerchantContext`, and no Prisma row reaches a component |
| T-02-17 | mitigated | A missing organization row redirects to `/login`. There is deliberately no "find an organization this user belongs to" fallback, which would re-derive a tenant the session never asserted |
| T-02-SC | mitigated | Zero packages installed. `npm ci` installs the committed lockfile verbatim; `git status` shows no manifest change |

## Threat Flags

None. No new network endpoint or schema change was introduced. `/dashboard` and `/suspended` are new route segments, but both are authenticated reads behind the DAL and neither adds a write path — `merchantAction` is a factory with no action built on it yet.

## Known Stubs

None blocking. Two pieces of authored-ahead copy have no surface yet, both assigned to a named later plan by the plan that authored them:

- `strings.dashboard.renameUnsupported` / `deleteUnsupported` and `strings.entitlements.memberLimitReached` — plan 02-06's Better Auth organization hooks and member-limit gate. Written here so the two refusal surfaces cannot drift from each other.
- `strings.dashboard.signOut` and `strings.suspended.signOut` — no sign-out control was built. It needs a `"use client"` island calling `authClient.signOut`, which is not in this plan's file list, and `/login` (which a sign-out would return the merchant to) does not exist yet.

Neither prevents this plan's goal: a signed-in merchant can load `/dashboard`, see their own store resolved from their session, and read a live server-computed trial countdown.

## Notes for Downstream Plans

- **Build every merchant mutation with `merchantAction`.** Put `"use server"` at the top of your own action module and export `const doThing = merchantAction({ mode: "write", schema, handler })`. Do not add `import "server-only"` beside `"use server"` — they are mutually exclusive.
- **`selectPlan` stays outside the wrapper.** The DAL's `planTier === null → /onboarding/plan` redirect would loop the surface that fixes that state. 02-02 already recorded this; it is now live.
- **Never add a parameter to anything exported from `src/server/merchant/**`** that is named `tenantId`, `organizationId` or `storeId`. `tests/unit/no-tenant-id-param.test.ts` fails the build, names the file and explains the remedy.
- **Every new page under `(dashboard)/` must call `requireMerchantContext()` itself.** The layout is not the gate and asserting `grep -c "redirect(" layout.tsx` is 0 is a standing criterion.
- **`/login` still does not exist.** The DAL redirects there for both the no-session and the orphaned-session cases. Nothing type-checks route strings, so this builds cleanly — but the plan that adds `/login` closes the loop for three separate rungs of the ladder.
- **Plan 02-05's `/dashboard/plan` route already has a link pointing at it** from both active banner states, and its copy is waiting at `strings.plan.dashboard.*`.
- **The read-only write refusal renders as `role="alert"` at the control**, not as a toast and not as a redirect — `strings.trial.readOnlyBlocked` for the refusal and `strings.trial.disabledHint` for the disabled-control `title`/`aria-describedby`.
- **`React.cache()` is a pass-through under Vitest.** The non-`react-server` React build's `cache` just calls the function, so an isolation test cannot assert the one-read-per-render-pass property and will re-resolve on every call. That is why no test claims it.
- **Isolation files may seed in `beforeAll` when every test owns its own fixtures.** Five truncate transactions per file against the remote Neon branch is enough to flake on `maxWait`.

## Self-Check: PASSED

Files verified present on disk: `src/server/merchant/context.ts`, `src/server/merchant/action.ts`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/trial-banner.tsx`, `src/app/(dashboard)/dashboard/page.tsx`, `src/app/suspended/page.tsx`, `tests/unit/no-tenant-id-param.test.ts`, `tests/isolation/merchant-context.test.ts`, `tests/isolation/trial.test.ts`, `src/lib/strings.ts`.
Commits verified in `git log`: `b50edf7` (RED), `89913a8` (GREEN), `6d452db` (dashboard surfaces).

## TDD Gate Compliance

RED (`b50edf7`, `test(02-03)`) → GREEN (`89913a8`, `feat(02-03)`) → no refactor commit needed. Task 3 is not a TDD task in the plan; its verification is the build plus the isolation spec written in Task 1, both green.
