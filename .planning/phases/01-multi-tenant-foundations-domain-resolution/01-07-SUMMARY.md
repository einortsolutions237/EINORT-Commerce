---
phase: 01-multi-tenant-foundations-domain-resolution
plan: 07
subsystem: onboarding
tags: [signup-form, live-slug-check, recovery-route, proxy-smoke-check, tdd, react-compiler]
status: awaiting-human-verify
requires:
  - "01-01: src/lib/strings.ts, design tokens (--success), shadcn button/input/label/card/alert, vitest unit project"
  - "01-03: storeSlugSchema, SLUG_MIN_LENGTH/SLUG_MAX_LENGTH, SLUG_FORMAT_MESSAGE, SLUG_RESERVED_MESSAGE, src/proxy.ts"
  - "01-05: /s/[slug] storefront, /store-not-found, resolveTenantBySlug"
  - "01-06: checkStoreSlug + SlugStatus, signUpMerchant, auth, platformDb, signupLimiter"
provides:
  - "src/app/signup/page.tsx — the merchant signup surface on the root domain (ONB-01, D-07)"
  - "src/app/signup/slug-status.ts — slugFieldState, the pure seven-state D-02 mapper"
  - "src/app/signup/store-address-field.tsx — useSlugCheck + StoreAddressField, shared by both forms"
  - "src/app/signup/signup-form.tsx — the signup client island"
  - "src/app/onboarding/create-store/{page,create-store-form}.tsx — recovery for a half-failed signup"
  - "src/server/auth/signup.ts — createStoreForCurrentUser + the shared provisionStore path"
  - "src/server/tenant/slug.ts — storeNameFromSlug"
  - "README.md — documented full-stack local run and the Windows next start smoke check"
  - "tests/unit/slug-status.test.ts — 15 tests"
affects: []
tech-stack:
  added: []
  patterns:
    - "Derive UI state from the value it belongs to instead of synchronising it in an effect — removes setState-in-effect and doubles as a stale-response guard"
    - "Two-layer stale-response defence: a request sequence number for out-of-order responses, value-binding for out-of-date answers"
    - "Fail open on the client when a UX-only check cannot run; the server remains the authority"
    - "One provisioning path shared by signup and recovery, parameterised only on the message the caller should show"
    - "Identity for a recovery action comes from the session; the input schema has no id field to substitute"
key-files:
  created:
    - src/app/signup/page.tsx
    - src/app/signup/signup-form.tsx
    - src/app/signup/slug-status.ts
    - src/app/signup/store-address-field.tsx
    - src/app/onboarding/create-store/page.tsx
    - src/app/onboarding/create-store/create-store-form.tsx
    - tests/unit/slug-status.test.ts
    - README.md
  modified:
    - src/lib/strings.ts
    - src/server/auth/signup.ts
    - src/server/tenant/slug.ts
decisions:
  - "Pitfall 10 / assumption A7 RESOLVED — the Proxy runs correctly under next start on Windows 11 Pro with Next 16.3.1; no middleware.ts workaround needed"
  - "Vercel wildcard domain DEFERRED — not required for local verification, and nothing in code depends on it"
  - "Store name is derived from the slug rather than asked for, keeping /signup at three fields per D-01"
  - "provisionStore extracted so the recovery route shares the signup path instead of duplicating it"
  - "The D-02 field is one shared component; a second copy would let the two surfaces drift"
  - "React Compiler rules forced deriving slug state rather than syncing it — the stricter structure is also more correct"
requirements: [ONB-01, DOM-01, TEN-06]
metrics:
  duration: "~2h10m across one interruption"
  completed: 2026-08-17
  tasks: 2 of 3 (Task 3 is a blocking human-verify gate)
  commits: 3
  tests: 15 new (186 total)
---

# Phase 1 Plan 07: Merchant Signup Form & End-to-End Verification Summary

The loop closes on the client. A prospective merchant types an email, a password
and an address they choose themselves, watches that address get checked live
against two registries, submits, and lands on their own storefront on their own
subdomain — verified against a real production build on this Windows machine,
not just asserted in a test.

**Task 3 is a blocking human-verify checkpoint and has NOT been performed.**
Steps 1-12 require a human at a browser and the plan explicitly forbids the
executor performing them or marking them passed from a `curl` result. See
[Task 3 — Awaiting Human Verification](#task-3--awaiting-human-verification).

---

## Required Plan Outputs

| Question the plan asked | Answer |
|---|---|
| **Windows `next start` smoke check (Pitfall 10 / A7)** | **RESOLVED — the Proxy works.** Full result table below. Next.js issue #85243 does **not** reproduce on 16.3.1 / Windows 11 Pro. No `middleware.ts` workaround was needed or made; `git ls-files \| grep -c middleware.ts` is still 0. |
| **Vercel wildcard domain** | **Deferred.** Not required for the local full-stack verification, and no code path depends on it. It stays a one-time human task before the first production deploy, and the ordering in the plan's `user_setup` is load-bearing: registrar nameservers → Vercel → apex → `*.einort.com`, or wildcard SSL silently fails to issue (T-01-54). |
| **UI-SPEC deviations** | Four, all documented below with justification: English copy (already-locked, from 01-01), a derived store name, the recovery route's new copy, and port 3312 for the smoke run. |
| **Steps 1-12 pass/fail** | **Not yet recorded — blocked on the human-verify gate.** The plan requires each step be explicitly marked and forbids marking any from automation. |

---

## The Windows production-mode smoke check

`npx next build && npx next start`, against the real development Neon branch,
`NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000`. Every row is a live HTTP request, not
a unit test.

| Request | Result | What it proves |
|---|---|---|
| `GET /` on the apex | **200** | Passthrough branch runs. |
| `GET /signup` | **200** | The new route is served in production mode. |
| `GET /onboarding/create-store` (no session) | **307 → `/signup`** | The unauthenticated guard. |
| `POST /signup` (the `signUpMerchant` action) | **`{"ok":true,"slug":"alpha-store"}`** | A real end-to-end signup: user, organization, membership, slug-history row and session, through the exact action the form calls. |
| `GET /` with `Host: alpha-store.localhost` | **200**, body contains `Alpha Store` and `Store coming soon`, `<title>Store coming soon · EINORT</title>` | **The Pitfall 10 check.** The Proxy classified the host, rewrote to `/s/alpha-store`, and the layout resolved the tenant out of Postgres — the store name in the body can only have come from the database. Also proves T-01-43: the store resolved immediately after provisioning, so `invalidateTenantHost` evicted the negative cache rather than leaving it to a 60s TTL. |
| `GET /` with `Host: nosuchstore.localhost` | **404** | Unclaimed hostnames still fail closed under `next start`. |
| `GET /s/alpha-store` from the apex | **404** | The internal rewrite prefix is not reachable publicly (DOM-02 / T-01-14). |
| `GET /` with `Host: alpha-store.einort.com.evil.tld` | **404** | Suffix-confusion defence holds in production mode (T-01-15). |

### The live check, exercised against the running server

`checkStoreSlug` invoked over HTTP exactly as the form invokes it:

| Input | Response |
|---|---|
| `admin` | `{"status":"reserved","message":"That address is reserved by EINORT. Choose another."}` |
| `alpha-store` | `{"status":"taken","message":"That address is taken. Try another name."}` |
| `maboutique2026` | `{"status":"available"}` |
| `Bad--Slug` | `{"status":"invalid","message":"Use 3–30 characters: lowercase letters, numbers and hyphens, no leading or trailing hyphen."}` |

Four of the five states confirmed live. `rate-limited` is the fifth and is
covered by the dedicated unit row plus 01-06's isolation suite — deliberately
not provoked here, because flooding the shared Upstash limiter would have left
the developer's own walkthrough throttled.

### The recovery route, exercised end to end

The half-failed state was reproduced honestly rather than simulated: a
`POST /api/auth/sign-up/email` creates a user **without** an organization, which
is precisely the state a signup that fails between step 1 and step 2 leaves
behind.

| Request | Result |
|---|---|
| `GET /onboarding/create-store`, session with **zero** organizations | **200**, renders "Finish creating your store" + the notice + the address field |
| `POST` the `createStoreForCurrentUser` action with `{"slug":"recovered-store"}` | **`{"ok":true,"slug":"recovered-store"}`** |
| `GET /` with `Host: recovered-store.localhost` | **200**, body contains `Recovered Store` |
| `GET /onboarding/create-store`, session that **now has** a store | **307 → `http://alpha-store.localhost:3000/`** |

The last row is the one worth having: a merchant who already has a store is sent
to it rather than shown a form that `organizationLimit: 1` would have refused
with a confusing error. `Recovered Store` in the body also confirms
`storeNameFromSlug` end to end.

### Two caveats on how this was run

1. **Port 3312, not 3000.** Port 3000 on this machine is already occupied by a
   different application (it answers `307 → /login`, a route this project does
   not have; `/login` is Phase 2 here). `classifyHost` strips the port from both
   the `Host` header and the root domain, so the port has no bearing on
   classification — plan 01-03 ran its smoke check the same way for the same
   reason. **The developer must free port 3000 before the walkthrough**, or the
   `localhost:3000` URLs in steps 1-12 will reach the other application.
2. **The signup was driven over HTTP, not clicked in a browser.** It is the same
   POST the form issues — same route, same `Next-Action` id, same payload
   encoding, same server action — so the server half of the journey is genuinely
   verified. What it does **not** verify is rendering, focus behaviour, debounce
   timing and copy consistency, which is exactly what steps 1-12 exist for and
   why the plan forbids marking them from a `curl`.

---

## What Was Built

### Task 1 — `/signup` and the live check (`7c81e82` RED, `50a677d` GREEN)

**`slug-status.ts`** is the whole of the field's branching logic, as one pure
function, and that isolation is the point: it makes the seven-state contract
assertable in the existing node-environment `unit` project with no DOM harness.
The `SlugStatus` import is `import type`, so it is erased and the module pulls
neither the `"use server"` action file nor Prisma into a test or a client
bundle — while still being unable to drift from the five statuses 01-06
actually returns.

The load-bearing row is `rate-limited → submitDisabled: false`. Every other
non-available status disables submission, which makes this one easy to
"correct" into consistency. It has its own `describe` block, its own comment
explaining why, and its own assertion, because the failure it prevents is a
degraded availability checker turning into a total signup outage (T-01-52).

**`signup-form.tsx`** is three fields — the store name is derived, not asked
(see Deviation 2). The two behaviours worth calling out:

*Stale responses are guarded twice, not once.* A request sequence number stops
an out-of-order **response** from winning. Binding the resolved answer to the
value it answers for stops an out-of-date **answer** from being displayed at
all: if the field no longer holds the text that was checked, the state is
`checking`, not the previous result. The second layer arrived as a consequence
of a React Compiler lint error (Deviation 1) and is strictly better than what
the plan asked for — it also removes the idle→checking flicker the naive
version would have shown during every debounce window.

*Normalization never rewrites the merchant's choice.* Lowercase and whitespace
only. No character stripping, no suggested alternative, and typing is never
blocked — silently changing the address someone chose is worse than telling them
it is invalid.

**`page.tsx`** is a server component wrapping one client island, so the heading,
sub-line and card render before the form's JavaScript arrives. That is not a
micro-optimisation on a market that is mobile-first on low-end Android.

### Task 2 — recovery, README, smoke check (`bcf8ad6`)

**`provisionStore` was extracted from `signUpMerchant`** and both entry points
now call it. This is a security property rather than tidiness: that function
encodes which of the five provisioning steps may fail the request (only 1 and 2)
and which are logged and survived (3, 4, 5). A second hand-written copy of that
decision is precisely the drift that ends with one entry point creating stores
the other would have refused. The only thing the two callers parameterise is the
message shown on an unclassified failure — from signup it names the non-atomic
gap and points at the recovery route; from the recovery route the merchant is
already on that page, so the same words would be a loop.

**`createStoreForCurrentUser` accepts a slug and nothing else.** There is no
user id or organization id in the schema, so there is no field to substitute in
order to provision a store onto another account (T-01-49). Identity is read from
`auth.api.getSession({ headers })`. It reuses `signupLimiter`, because each
success still mints a tenant and a hostname — the same abuse surface as signup
(T-01-40) — and it returns the existing store's slug if one is found, so a
double submit or a stale tab redirects instead of colliding with
`organizationLimit: 1`.

**The D-02 field is one component, rendered by both forms.** The debounce
interval, the 3-character floor, the stale-response guard and the fail-open rule
are behaviour. Two copies of behaviour drift.

---

## Verification

| Gate | Command | Result |
|---|---|---|
| Unit (this plan) | `npx vitest run tests/unit/slug-status.test.ts --reporter=dot` | exit 0, **15 passed** |
| Full suite | `npx dotenv -e .env.test -- npx vitest run --reporter=dot` | exit 0, 10 files, **186 passed**, **0 skipped** |
| Lint | `npm run lint` (`--max-warnings=0`) | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Build | `npx next build` | exit 0; routes include **`○ /signup`** and **`ƒ /onboarding/create-store`**, plus `ƒ Proxy (Middleware)` |
| Windows `next start` | see the smoke-check tables above | all rows as expected |

186 = 171 inherited + 15 new. The `signup.ts` refactor was the risk in this
plan, and 01-06's 22 isolation tests passing unchanged is what retires it.

### Source-level acceptance criteria

| Criterion | Result |
|---|---|
| `signup-form.tsx` contains `checkStoreSlug`, `signUpMerchant`, `slugFieldState` | all present (via `store-address-field.tsx` for the first — see Deviation 3) |
| `aria-live="polite"`, `role="status"`, `aria-describedby` | all present on the field's status region |
| Stale-response handling present | `requestSeq` (7 references) plus the value-binding layer |
| Debounce interval | `SLUG_CHECK_DEBOUNCE_MS = 400` |
| `grep -c 'sonner\|toast' src/app/signup/*.tsx` | **0** — including in prose, so the check cannot be defeated by a comment |
| lucide imports | exactly `AlertCircle, Check, LoaderCircle, Lock, X` — the five authorized icons and no others |
| One label element per input | 3 inputs, 3 `<Label>` elements, all visible |
| `grep -c 'min-h-11'` | 4 across the two form files — every interactive element clears the 44px floor |
| Invalid-format copy states the enforced bounds | 3–30, rendered from `SLUG_FORMAT_MESSAGE`, asserted against `SLUG_MIN_LENGTH`/`SLUG_MAX_LENGTH` rather than hardcoded |
| `create-store/page.tsx` contains `getSession`, the `/signup` redirect, and the has-a-store redirect | all three present and all three verified live |
| `grep -c 'rename\|renommer' create-store/page.tsx` outside comments | **0** — the single occurrence is the D-03 comment the plan asked for |
| `README.md` contains `store1.localhost`, `npm run test:full`, `npx next start`, the three verification URLs | all present |
| No `middleware.ts` | `git ls-files \| grep -c middleware.ts` → 0 |

---

## Deviations from Plan

### 1. [Rule 3 — Blocking] React Compiler lint rules rejected the planned form structure

- **Found during:** Task 1, first `npm run lint`.
- **Issue:** `eslint-config-next@16.3.1` ships the React Compiler rule set, and
  `lint` runs at `--max-warnings=0`. Four separate violations, none of which the
  plan could have anticipated:
  1. `react-hooks/set-state-in-effect` — the planned "reset state when the value
     drops below 3 characters" effect.
  2. `react-hooks/immutability` — assigning `window.location.href`.
  3. `react-hooks/refs` — passing an options object containing closures into
     `form.register("slug", { … })` during render.
  4. `react-hooks/incompatible-library` — `form.watch(...)` returns a function
     the compiler cannot memoize, which silently opts the **entire component**
     out of compilation.
- **Fix, and why the result is better than the plan:**
  - The below-minimum reset became a **derivation** rather than an effect. State
    now stores `{ value, status }`, and the displayed state is computed from
    whether that value still matches the field. This eliminated the setState and
    incidentally added the second stale-response guard described above — the
    plan asked for one layer and the constraint produced two. It also removed a
    flicker: the naive version would drop to `idle` for 400ms on every keystroke
    after an answer, whereas the derived version correctly reads `checking`.
  - `window.location.assign(storeOrigin(slug))` — a method call rather than an
    assignment, and building the origin in a helper also made the Next
    `no-location-assign-relative-destination` suppression unnecessary. Both
    `eslint-disable` comments were removed; the file now has none.
  - The `onChange`/`onBlur` handlers moved onto the JSX element, composed over
    `registration.onChange` / `registration.onBlur`.
  - `useWatch({ control, name: "slug" })` instead of `form.watch("slug")`.
- **Files:** `src/app/signup/signup-form.tsx`, `store-address-field.tsx`
  · **Commits:** `50a677d`, `bcf8ad6`

### 2. [Plan gap] The form has three fields but `signUpMerchant` requires four values

- **Found during:** Task 1.
- **Issue:** the plan's field order is Email → Password → Store address → CTA,
  and D-01 is explicit that the merchant types one thing. But 01-06's
  `signupSchema` requires `storeName` (2–80 characters), which is used as both
  the user's name and the organization's name. There is no fourth field to
  supply it and the plan does not say where it comes from.
- **Fix:** `storeNameFromSlug` derives it — `alpha-store` → `Alpha Store`. It
  lives in `src/server/tenant/slug.ts`, beside the schema, because the signup
  form and the recovery action both derive it and the two must agree.
  `storeSlugSchema` guarantees ≥3 characters, so the result always clears the
  server's 2-character floor.
- **Rejected:** relaxing `signUpMerchant`'s schema to make `storeName` optional.
  That would have changed a contract 22 passing isolation tests assert against,
  to avoid writing four lines.
- **Consequence for Phase 4:** the storefront renders this derived name until
  the merchant gets a real branding surface. `Alpha Store` and
  `Recovered Store` in the smoke check are it working.
- **Files:** `src/server/tenant/slug.ts`, `signup-form.tsx` · **Commit:** `bcf8ad6`

### 3. [Rule 2 — Missing critical functionality] Two files beyond the plan's list

- **`src/app/signup/store-address-field.tsx`** — the plan says the recovery
  route should "reuse `signup-form.tsx`'s slug field composition rather than
  authoring a second variant of it", which is not possible while that
  composition is inline in a form that also owns email and password. Extracted
  as `useSlugCheck` + `StoreAddressField`; both routes render the one
  implementation.
- **`src/app/onboarding/create-store/create-store-form.tsx`** — the recovery
  page is a server component (it must read the session server-side), so its
  interactive form has to be a separate client island.
- **Files:** both · **Commit:** `bcf8ad6`

### 4. [Rule 2 — Missing critical functionality] `createStoreForCurrentUser` added

- **Found during:** Task 2.
- **Issue:** the plan requires the recovery page to carry "a store-address field
  and CTA that reuse the same `checkStoreSlug` + provisioning path as
  `/signup`". No server action existed that could provision a store for an
  **already-authenticated** user — `signUpMerchant` creates the user too, and
  calling it would fail on the duplicate email, which is the exact trap the
  recovery route exists to free the merchant from. Without this the page would
  have been a stub with a dead button.
- **Fix:** `createStoreForCurrentUser`, plus the `provisionStore` extraction so
  it shares rather than duplicates the provisioning path. Verified end to end
  against a real half-failed account (table above).
- **Files:** `src/server/auth/signup.ts` · **Commit:** `bcf8ad6`

### 5. [UI-SPEC deviation] `/onboarding/create-store` copy is new

- `01-UI-SPEC.md` governs four surfaces and this route is not one of them — the
  plan adds it. Four strings were written under a `createStore` namespace,
  following the spec's voice (state what happened, then what to do next).
- It deliberately does **not** reuse `signup.provisioningFailed`. That string
  ends *"sign back in to finish"*, and the merchant reading this page is already
  signed in — repeating it would send them in a circle.
- **Files:** `src/lib/strings.ts` · **Commit:** `bcf8ad6`

### 6. [Already-locked decision] English copy, not the UI-SPEC's French column

Not a new deviation — the decision was made and recorded in `01-01-SUMMARY.md`
§ "Copy language decision" and has been followed by plans 05 and 06. Every
string added here comes from the spec's "English reference" column, and all of
them live in `src/lib/strings.ts` rather than inline in JSX, so the later i18n
pass stays an extraction.

### 7. [Rule 3 — Blocking] Worktree setup

Same as plans 01-02 through 01-06: a fresh worktree has no `node_modules` and no
env files. `npm ci` (lockfile restore only — no package added, changed or
resolved by name, so the package-legitimacy checkpoint does not apply;
`package.json` and `package-lock.json` are untouched and appear in no commit),
then `cp -n` of `.env.local` and `.env.test` from the parent checkout. Both
remain gitignored and are absent from every commit.

One addition: the `postinstall` `prisma generate` did not leave a usable client
in this worktree, so `npx next build` failed on `@/generated/prisma/client`.
Running `node scripts/prisma-generate.mjs` directly fixed it. This is
environment setup, not a code defect — `src/generated/**` is gitignored by
design. It is now documented in the README so the next person does not have to
diagnose it.

---

## Authentication Gates

None. The Neon and Upstash credentials in `.env.local` were already provisioned
and worked as-is. The Vercel wildcard domain is a human task but is explicitly
not required by this plan and blocked nothing.

---

## Known Stubs

None. Every surface this plan creates is fully wired and was exercised against a
live database in production mode: `/signup` calls two real server actions,
`/onboarding/create-store` reads a real session and provisions a real tenant,
and both redirect to a storefront that resolves out of Postgres.

The one deliberately-unbuilt thing is the D-03 address-change UI, which the plan
instructs be noted in a comment and **not** built in this phase. It is a comment
on `create-store/page.tsx` and nothing more.

---

## Threat Flags

None. Every surface added here is already in this plan's own `<threat_model>`,
and the plan is net-mitigating.

| Threat | Status |
|---|---|
| T-01-48 bypassing the form to submit a reserved or malformed slug | mitigated — client gating is presentational; refused live by the server for `admin` (reserved) and `Bad--Slug` (invalid) |
| T-01-49 recovery route accepting an id from the request | mitigated — `recoverStoreSchema` is `{ slug }` and nothing else; identity from `getSession`; both redirect branches verified live |
| T-01-50 slug enumeration via the live check | mitigated — `rl:slugcheck` is the control; the 400ms debounce and 3-character floor reduce incidental volume and are not relied on |
| T-01-51 stale response overwriting current state | mitigated **twice** — sequence number plus value-binding |
| T-01-52 form unsubmittable when the check is throttled | mitigated — `rate-limited → submitDisabled: false`, its own unit row, plus a transport failure mapped to the same state so one dropped request cannot lock the button |
| T-01-53 silent Windows `next start` proxy regression | **mitigated and RESOLVED** — full live table above; no `middleware.ts` workaround made |
| T-01-54 wildcard TLS silently failing to issue | deferred with the ordering preserved in `user_setup`; nothing in code depends on it |
| T-01-55 copy leaking internals or naming a phase/tier | no `/s/`, `scopedDb` or `proxy.ts` appears in any user-facing string; final confirmation is human-verify step 12 |

---

## Task 3 — Awaiting Human Verification

**This is a `checkpoint:human-verify` gate with `gate="blocking"`, and it has not
been performed.** `workflow.auto_advance` is `false`, and the plan states
directly: *"Do not perform any of the twelve steps on the developer's behalf and
do not mark a step passed from a `curl` result."*

The four automated gates the plan requires immediately beforehand are green:

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npx next build` | exit 0 |
| `npx dotenv -e .env.test -- npx vitest run --reporter=dot` | exit 0, 186 passed, 0 skipped |

### Before starting

1. **Free port 3000.** Another application is currently serving it on this
   machine (it answers `307 → /login`). The steps below assume
   `localhost:3000`.
2. `npm run build` then `npx next start`, with `NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000`.
3. Two stores already exist in the development database from this plan's smoke
   check, which makes steps 4 and 7 work as written: **`alpha-store`**
   ("Alpha Store") and **`recovered-store`** ("Recovered Store").

### Step results — to be filled in from the walkthrough

| # | Step | Result |
|---|---|---|
| 1 | `/` shows wordmark, one tagline, one button, nothing else | ⬜ pending |
| 2 | `/signup` single-column ≤448px card, fields Email → Password → Store address, visible labels | ⬜ pending |
| 3 | `ad` fires no check; `admin` → lock icon, red, reserved message, submit disabled | ⬜ pending |
| 4 | `alpha-store` → X icon, red, "already taken", submit disabled | ⬜ pending |
| 5 | `MaBoutique2026` displays lowercased, then green check + "is available", submit enabled | ⬜ pending |
| 6 | Typing quickly through several values ends on the status for the FINAL value | ⬜ pending |
| 7 | Submit → "Creating…" without layout shift → redirect to the new storefront | ⬜ pending |
| 8 | `nosuchstore.localhost:3000` → branded "Store not found" with the EINORT link | ⬜ pending |
| 9 | `localhost:3000/s/maboutique2026` → 404, not the storefront | ⬜ pending |
| 10 | Keyboard-only tab through `/signup`: visible focus ring, correct order, Enter submits | ⬜ pending |
| 11 | 360px width: no horizontal scroll or overlap on `/`, `/signup`, storefront | ⬜ pending |
| 12 | All copy is English, no stray strings from the French column | ⬜ pending |

**Resume signal:** type `approved`, or name the failing step numbers and what
you saw instead.

Steps 8 and 9 were separately confirmed at the HTTP level during the smoke
check (both 404 correctly), but they are left pending because step 8 is a claim
about *rendered branding*, which no status code can establish.

---

## Notes for Phase Verification and Later Phases

- **Before the first production deploy:** the Vercel wildcard domain, in this
  order — registrar nameservers to `ns1/ns2.vercel-dns.com`, then `einort.com`
  on the project, then `*.einort.com`. Reversing it makes wildcard SSL fail to
  issue, silently.
- **Phase 2 (login):** `/signup` has no sign-in link, deliberately, because no
  such surface exists yet. Adding one is a Phase 2 change to `page.tsx`. Note
  `strings.signup.provisioningFailed` and `sessionExpired` both tell the
  merchant to sign back in — those become actionable only once login ships.
- **Phase 4 (rename, D-03):** `/onboarding/create-store` is the natural home for
  the address-change UI; it is already the authenticated "choose your address"
  surface. The comment saying so is in the page.
- **Phase 4 (templates):** the storefront currently renders the derived store
  name. A real branding surface should let the merchant set a display name
  independent of their address.
- **Test data:** `alpha-store` and `recovered-store` now exist in the
  **development** branch (users `smoke.alpha@einort.test` and
  `smoke.orphan@einort.test`, password `correct-horse-8`). The test branch is
  untouched by this — `prisma/seed.ts` refuses to run against the development
  endpoint by design, which is why the smoke fixtures had to be created through
  the real signup path rather than seeded.

---

## Deferred Items

No new entries. D1 from `deferred-items.md` — *"shadcn `form` is empty under the
Base UI registry and must be resolved by plan 01-07"* — **is resolved by this
plan**, via option 1 of the two it listed: Base UI primitives composed with
`react-hook-form` directly. No Radix fallback was pulled in and no third-party
registry was added, so `components.json` still reads `"registries": {}`.

---

## Commits

| Commit | Task | Gate | Description |
|---|---|---|---|
| `7c81e82` | 1 | RED | Failing slug-field-state tests, including the fail-open row |
| `50a677d` | 1 | GREEN | `slugFieldState`, the signup form and page, the copy namespace |
| `bcf8ad6` | 2 | — | Recovery route, `createStoreForCurrentUser`, shared field, README |

TDD gate sequence satisfied for Task 1: `test(01-07)` (`7c81e82`) precedes
`feat(01-07)` (`50a677d`), and the RED run was confirmed failing (module not
found, then 15 assertions) before implementation. No REFACTOR commit was needed.
Task 2 is composition over an already-tested core; its acceptance is the build,
the source criteria and the live smoke check.

---

## Self-Check: PASSED

All 8 claimed created files and all 3 claimed modified files exist on disk. All
3 commit hashes resolve in `git log`. `git diff --diff-filter=D` reports **no
deletions** in any of the three commits. The two throwaway curl cookie jars
(`ck-smoke.txt`, `ck-orphan.txt`) were deleted and appear in no commit;
`git status --short` was clean before this SUMMARY was written. `node_modules/`,
`src/generated/`, `.env.local` and `.env.test` are gitignored and absent from
every commit. Per the orchestrator's instructions, **`STATE.md` and
`ROADMAP.md` were not modified.**

---

## Execution Environment Note

Executed in the worktree `.claude/worktrees/agent-a4b5a0a7fb9cdd6a9` on branch
`worktree-agent-a4b5a0a7fb9cdd6a9`, based on `a4a1e61`. Windows 11 Pro,
Node 24, `next@16.3.1`, `better-auth@1.6.29`, `prisma@7.9.1`, `zod@4.4.3`,
`react-hook-form@7.85.0`. The isolation suite ran against the dedicated Neon
**test** branch via `.env.test`; the smoke check ran against the **development**
branch via `.env.local`, which is what makes it a real end-to-end verification
rather than a fixture replay.

Execution was interrupted once by a session usage limit between the Task 1 lint
fixes and the Task 1 commit. On resume the uncommitted work was re-verified
(`npm run lint`, `npx next build`, the unit suite) before anything was
committed; nothing was half-written.
