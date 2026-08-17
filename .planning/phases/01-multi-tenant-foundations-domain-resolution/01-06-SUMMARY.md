---
phase: 01-multi-tenant-foundations-domain-resolution
plan: 06
subsystem: auth
tags: [better-auth, organization-plugin, tenant-provisioning, rate-limiting, reserved-slugs, system-action, tdd]
requires:
  - "01-01: src/env.ts (BETTER_AUTH_*, optional UPSTASH_*), src/lib/strings.ts, vitest projects"
  - "01-02: prismaBase (custom-output Prisma 7 client), platformDb, scopedDb, Organization.status + User.platformRole NOT NULL"
  - "01-03: storeSlugSchema, RESERVED_SLUGS, SLUG_RESERVED_MESSAGE, the Proxy that makes /api/auth apex-only"
  - "01-04: seedTwoTenants, TENANT_A/TENANT_B, isolation project setup + teardown"
  - "01-05: invalidateTenantHost, resolveTenantBySlug, ResolvedTenant"
provides:
  - "src/server/auth/auth.ts — Better Auth with organization as the tenant primitive, reserved-slug write gate, activeOrganizationId back-fill"
  - "src/app/api/auth/[...all]/route.ts — apex-only Better Auth HTTP handler"
  - "src/server/tenant/actions.ts — checkStoreSlug + SlugStatus (rate limited, format/reserved/taken/released)"
  - "src/server/auth/signup.ts — signUpMerchant + SignUpMerchantResult"
  - "src/server/rate-limit.ts — rl:slugcheck and rl:signup limiters, callerIp, RateLimiter"
  - "src/server/db/tenant-scoped.ts — scopedCreateData (type-level companion to the stamping extension)"
  - "src/lib/strings.ts — signup copy namespace (server-returned messages)"
  - "tests/isolation/signup.test.ts — 22 tests against the Neon test branch"
affects: [01-07]
tech-stack:
  added: []
  patterns:
    - "System-action organization creation: userId present, headers absent — the only route past allowUserToCreateOrganization: false"
    - "Hook constrained to throw-or-void so beforeCreateOrganization cannot re-spread ctx.body into the insert"
    - "Rate limit before parsing on unauthenticated enumerable endpoints, asserted behaviourally rather than by source order"
    - "Resolve write races by asking the database who holds the unique column, not by matching library error strings"
    - "Replay the issued Set-Cookie into the request headers with better-auth's own applySetCookies rather than hand-parsing a signed cookie"
    - "scopedCreateData: one documented cast reconciling a deliberately-required tenantId type with an extension that stamps it"
key-files:
  created:
    - src/server/auth/auth.ts
    - src/server/auth/signup.ts
    - src/server/tenant/actions.ts
    - src/server/rate-limit.ts
    - src/app/api/auth/[...all]/route.ts
    - tests/isolation/signup.test.ts
  modified:
    - src/server/db/tenant-scoped.ts
    - src/lib/strings.ts
    - .planning/phases/01-multi-tenant-foundations-domain-resolution/deferred-items.md
decisions:
  - "A3 resolved PASS — databaseHooks.session.create.before persists activeOrganizationId, asserted on a real login"
  - "setActiveOrganization needs the issued session cookie replayed into the request headers; the incoming snapshot never carries it"
  - "Slug races are classified by a database read of the slug holder, not by ORGANIZATION_ALREADY_EXISTS vs P2002"
  - "checkStoreSlug maps reserved by comparing to SLUG_RESERVED_MESSAGE rather than sniffing for the substring 'reserved'"
  - "StoreSlugHistory's global registry read goes through prismaBase (lint-sanctioned for server/tenant/**), not platformDb"
  - "scopedCreateData added to tenant-scoped.ts so the plan's no-tenantId create call type-checks without an inline cast"
  - "Steps 3-5 of provisioning log-and-continue on failure; only steps 1-2 can fail the signup"
requirements: [TEN-06, TEN-08, DOM-01, ONB-01]
metrics:
  duration: "~2h20m (includes one watchdog stall and re-verification)"
  completed: 2026-08-17
  tasks: 2
  commits: 3
  tests: 22 new (171 total)
---

# Phase 1 Plan 06: Merchant Signup, Tenant Provisioning & the Slug Check Summary

The loop closes on the server. One call turns an email, a password and a chosen
address into a user, a tenant, a membership, a slug-history row, an active
session and a subdomain that plan 01-05's resolver answers for on the very next
request — and every bypass path (reserved slug, second store, concurrent race,
released slug, rate-limit flood) is refused by something that cannot be talked
out of it.

---

## Required Plan Outputs

| Question the plan asked | Answer |
|---|---|
| **A3 test result** | **PASS.** `databaseHooks.session.create.before` returning `{ data: { …, activeOrganizationId } }` persists correctly with the organization plugin's session field. Asserted twice, on the real database — see below. |
| **Observed behaviour of the concurrent-signup race** | Exactly one Organization, every run. One caller returns `ok:true`, the other `ok:false` with a **slug-scoped** error. No orphaned Organization on the contested slug or any other, and exactly one `StoreSlugHistory` row. Detail below. |
| **Does the installed `better-auth` still match 1.6.29?** | **Yes** — `node_modules/better-auth/package.json` reports `1.6.29`, matching STACK.md. Every unexported internal this plan leans on was re-verified against the installed source, not against training data or the research doc. Line references below. |
| **Was any Vercel domain API call added?** | **No.** `grep -c '@vercel/sdk\|domains' src/server/auth/signup.ts` → **0**. `@vercel/sdk` is not a dependency. Inserting the organization row IS provisioning (Pattern 7). |

### A3, resolved

Two separate assertions, because they test two different mechanisms and only
the second is actually A3:

| Assertion | What it proves |
|---|---|
| After `signUpMerchant`, the signup session row carries `activeOrganizationId` = the new org id | `setActiveOrganization` closed the gap the system action leaves open |
| After a **later `signInEmail`**, the new session row carries `activeOrganizationId` = the org id | **A3 itself.** Nothing else could have set it — no `setActiveOrganization` call is made on that path, so the `databaseHooks` back-fill is the only possible writer |

Both pass. `npx vitest run tests/isolation -t "activeOrganizationId"` → 2 passed.
Phase 2's TEN-04 dashboard tenant context can be built on this rather than
around it.

### The race, precisely

`Promise.all` of two `signUpMerchant` calls for `contested-store` with different
emails. Result: one winner, one loser, one Organization, one slug-history row.

Worth recording *how* the loser is classified, because the plan assumed one
mechanism and the implementation deliberately does not depend on it. Better Auth
re-checks `findOrganizationBySlug` inside the endpoint and throws
`ORGANIZATION_ALREADY_EXISTS`, but when two requests clear that read
concurrently the failure instead arrives as the Postgres `@unique` violation on
`organization.slug`. Both are the same event to a merchant. So the catch does
not pattern-match either one — it **asks the database who holds the slug**:

```ts
const holder = await platformDb.organization.findUnique({ where: { slug }, select: { id: true } });
if (holder) return { ok: false, error: { slug: [strings.signup.slugRaceLost] } };
```

That is version-independent and correct under both orderings. The database
constraint remains the actual guarantee (T-01-42); the error shape is an
implementation detail of two libraries and would rot on a patch release.

### better-auth 1.6.29 internals, re-verified against the installed package

Every claim this plan depends on was checked in
`node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs`:

| Claim | Verified |
|---|---|
| `const isSystemAction = !session && ctx.body.userId;` and `if (!canCreateOrg && !isSystemAction) throw FORBIDDEN` | line 57–58 — the system action is real; issue #6791 does not hold for 1.6.29 |
| `organizationLimit` checked **before** and **without** the bypass | line 61, above the hook and above the insert |
| Slug uniqueness re-checked in-endpoint → `ORGANIZATION_ALREADY_EXISTS` | line 62 |
| The `beforeCreateOrganization` re-spread trap | lines 63–72: `let { keepCurrentActiveOrganization: _, userId: __, ...orgData } = ctx.body;` strips the two non-column fields, then `orgData = { ...ctx.body, ...response.data }` **puts them straight back** if the hook returns a value |
| A system action does not set the active organization | line 142: `if (ctx.context.session && !ctx.body.keepCurrentActiveOrganization)` |
| The session cookie is **signed** | `dist/cookies/index.mjs:127` `ctx.setSignedCookie(...)` |

The re-spread trap is the sharpest of these: the destructure on line 63 makes
the code *look* safe, and it is — right up until a hook returns `{ data }`.

---

## What Was Built

### Task 1 — Better Auth as the tenant primitive (`17c4c1b`)

`auth.ts` is small and almost entirely comments, which is the right ratio: every
option in it is load-bearing and several are load-bearing by **absence**.

**The cookie is host-only, and the enforcement is that nothing is written.**
There is no `crossSubDomainCookies` setting, and the file does not contain the
identifier anywhere — including in prose, so a future grep cannot produce a
false positive. Setting it would give the merchant session `Domain=.einort.com`
and send it to every tenant storefront, all of which render merchant-controlled
content; a stored XSS in any one storefront could then ride any other merchant's
platform session (T-01-44). D-07 makes avoiding this free rather than a trade,
and the comment says so, because if a later plan proposes moving the dashboard
to `app.einort.com` this stops being a cosmetic change.

**The reserved-slug hook throws and returns nothing.** It is the authoritative
TEN-06 layer — the form check and the submit parse are UX, and both are bypassed
by anyone who calls the API directly. The throw-or-void constraint is T-01-37,
and it is a real trap rather than a theoretical one (see the table above).

**`status` and `platformRole` are `input: false` with `defaultValue`.** These
are the two columns plan 01-02 hand-corrected to NOT NULL, and this is the half
that keeps that constraint satisfiable from the application side: `input: false`
makes them unsettable through the public API (no signup payload can mint a
platform administrator or un-suspend a store), and `defaultValue` supplies them
on insert. The plan flagged the risk that a schema regeneration would silently
revert the NOT NULL — see Verification for the DDL check that proves it did not.

`rate-limit.ts` exposes two limiters with distinct prefixes and **no in-process
counter fallback**. That omission is deliberate and is the most likely thing a
future contributor will try to "fix": a per-instance counter across an unbounded
number of Vercel serverless instances gives an effective limit of
`tokens × instances` — an unknown, traffic-dependent number that reviews and
tests as if it were a working control. Allow-all with one loud warning is honest
about being off; a local counter is dishonest about being on.

`route.ts` is one line plus the reason it is safe: the Proxy rewrites a
storefront's `/api/auth/*` into `/s/{slug}/api/auth/*` where no handler exists,
so it 404s, and that 404 is the control.

### Task 2 — the availability check and provisioning (`41669df` RED, `2989188` GREEN)

`checkStoreSlug` runs the limiter **first**, and that ordering is asserted
behaviourally rather than by reading the source: a throttled caller asking about
`admin` must get `rate-limited`, not `reserved`. A source-order convention is
one refactor away from being silently inverted; a test is not.

It consults two registries. `organization.slug` is the live holder;
`StoreSlugHistory` is every slug ever claimed, including ones released by a
future rename — and a released slug must never be re-issued, because handing
`ancienne-boutique` to a different merchant also hands them the previous store's
inbound links, printed QR codes and WhatsApp shares (T-01-41). The history read
goes through `prismaBase`, which needs justifying: it is a tenant-scoped model,
but there is no tenant here — an anonymous visitor is asking about the *global*
hostname registry, which is exactly why `slug` carries a platform-wide `@unique`.
`platformDb` was rejected because its surface is a deliberate allowlist that
excludes every model with a `tenantId`, and widening it would blur that boundary
for everyone. `eslint.config.mjs` already sanctions `src/server/tenant/**` for
this class of narrow registry read, and only `id` is selected.

`signUpMerchant` runs five steps, and the interesting part is which of them can
fail the signup: **only the first two.**

| Step | On failure |
|---|---|
| 1. `signUpEmail` (user + session) | returns `ok:false` — email taken, or generic |
| 2. `createOrganization` (system action) | returns `ok:false` — slug race, slug gate, or the honest non-atomic message |
| 3. `storeSlugHistory.create` | logs and continues — the store exists and resolves; a missing row is a D-03 repair task, not a signup failure |
| 4. `setActiveOrganization` | logs and continues — the dashboard can recover from a null active org; a failed signup cannot |
| 5. `invalidateTenantHost` | logs and continues — worst case the store 404s for ≤60s |

Getting this split wrong in either direction is a real bug: failing the signup at
step 5 would tell a merchant their store was not created when it was, and
swallowing step 2 would tell them it was when it was not.

**One thing the plan's snippet could not have worked as written**, and it is the
subtlest finding here. Step 4 needs the session, but `await headers()` is a
snapshot of the *incoming* request and therefore carries no session — the cookie
`signUpEmail` just issued lives in Next's cookie store, on its way to the
browser. Calling `setActiveOrganization({ headers })` with that snapshot looks up
a session that does not exist from its point of view and fails `UNAUTHORIZED`,
which would leave `activeOrganizationId` null and make the A3 work pointless. The
fix uses `returnHeaders: true` and Better Auth's own `applySetCookies` to replay
the issued `Set-Cookie` into the header set:

```ts
const setCookie = signUp.headers.get("set-cookie");
if (setCookie) applySetCookies(requestHeaders, [setCookie]);
```

Hand-rolling that parse was rejected on purpose: the session cookie value is
**signed** and percent-encoded, so a subtly wrong encode/decode round trip
produces an invalid signature and an authentication failure that reads as a
session bug rather than as a string bug.

---

## Verification

| Gate | Command | Result |
|---|---|---|
| Signup suite | `npx dotenv -e .env.test -- npx vitest run tests/isolation/signup.test.ts` | exit 0, **22 passed**, 0 skipped |
| Full suite | `npx dotenv -e .env.test -- npx vitest run` | **exit 0**, 9 files, **171 passed**, 0 skipped |
| Lint | `npm run lint` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Build | `npx next build` | exit 0; routes include **`ƒ /api/auth/[...all]`**, plus `ƒ Proxy (Middleware)` |

### Required `-t` filters

| Filter | Matched | Result |
|---|---|---|
| `signup provisions a resolvable store` | 1 | exit 0 |
| `reserved` | 6 | exit 0 |
| `second store` | 2 | exit 0 |
| `race` | 1 | exit 0 |
| `activeOrganizationId` | 2 | exit 0 |

### Source-level acceptance criteria

| Criterion | Result |
|---|---|
| `grep -c 'crossSubDomainCookies' src/server/auth/auth.ts` | **0** |
| `grep -c 'admin(' src/server/auth/auth.ts` | **0** |
| `grep -A 12 'beforeCreateOrganization' … \| grep -c 'return {'` | **0** (and `throw` present: 1) |
| `allowUserToCreateOrganization: false` / `organizationLimit: 1` / `creatorRole: "owner"` / `cookiePrefix` / `platformRole` | all present (lines 156 / 166 / 168 / 79 / 69) |
| `nextCookies()` last in `plugins` | yes — line 236, after `organization({` at 141; no entry follows |
| `grep -rc 'runtime = "edge"' src/server/auth src/app/api` | **0** for both files |
| `rate-limit.ts` distinct prefixes | `rl:slugcheck` (30/min), `rl:signup` (5/min) |
| `rate-limit.ts` in-memory counter fallback | **0** |
| `grep -c 'checkSlug\|checkOrganizationSlug' src/server/tenant/actions.ts` | **0** |
| `grep -c '@vercel/sdk\|domains' src/server/auth/signup.ts` | **0** |
| `createOrganization` passes `userId`, no `headers` | `body: { name: storeName, slug, userId }` — line 151, no `headers` key |
| `signUpEmail` / `setActiveOrganization` pass `headers` | lines 97 / 258 |
| `storeSlugHistory.create` has no literal `tenantId` in `data` | **0** |
| Rate limit before `safeParse` | limiter line 54, `safeParse` line 68 |

### NOT NULL, checked at the DDL level

The plan's success criterion asks that `Organization.status` and
`User.platformRole` survive *real* Better Auth config rather than only the
hand-patched migration. Three independent confirmations:

1. `git diff 4af2bda..HEAD -- prisma/` is **empty** — no regeneration occurred.
2. Live `information_schema` query against the Neon test branch:

| table | column | is_nullable | default |
|---|---|---|---|
| organization | status | **NO** | `'active'::text` |
| organization | slug | **NO** | — |
| user | platformRole | **NO** | `'merchant'::text` |

3. Behavioural: a store created through the real Better Auth path has
   `status === "active"` and its owner `platformRole === "merchant"`, asserted
   in `signup provisions a resolvable store`.

---

## Deviations from Plan

### 1. [Rule 3 — Blocking] The plan's `setActiveOrganization` call could not authenticate as written

- **Found during:** Task 2, GREEN.
- **Issue:** the plan (and RESEARCH.md Code Example 8) passes `headers: h` from
  `await headers()` to `setActiveOrganization`. That object is the incoming
  request's headers and cannot contain the session cookie `signUpEmail` issued
  microseconds earlier — `nextCookies()` writes that cookie to Next's *cookie
  store*, not back into the request snapshot. The call would look up a session
  that does not exist and throw `UNAUTHORIZED`, leaving `activeOrganizationId`
  null on every merchant's first session.
- **Fix:** `returnHeaders: true` on the sign-up call, then Better Auth's public
  `applySetCookies(requestHeaders, [setCookie])` to merge the issued cookie into
  the header set step 4 uses. Verified in `dist/integrations/next-js.mjs` (the
  plugin's `after` hook only touches the cookie store) and
  `dist/cookies/index.mjs:127` (the value is signed, so hand-parsing was not an
  option).
- **Why it mattered:** this is precisely the failure the A3 work exists to
  prevent, and it would have passed a source review — the plan's line looks
  right. Only the assertion caught it.
- **Files:** `src/server/auth/signup.ts` · **Commit:** `2989188`

### 2. [Rule 3 — Blocking] `scopedDb(...).create({ data: { slug } })` does not type-check

- **Found during:** Task 2, first typecheck.
- **Issue:** the plan requires the slug-history write to pass **no** `tenantId`
  (TEN-08 — the extension stamps it) and makes "no literal `tenantId` key" an
  acceptance criterion. But plan 01-02 declares `tenantId` **required with no
  default** on every tenant-scoped model, deliberately, as the Pitfall 4
  defence. So the generated `CreateInput` demands the one field the caller is
  forbidden to supply, and the plan's own call is a type error.
- **Fix:** added `scopedCreateData<T>()` to `src/server/db/tenant-scoped.ts` — a
  compile-time-only assertion (`Omit<T, "tenantId"> → T`) living next to the
  extension that makes it true. Rejected alternatives: an inline cast at every
  call site (scatters unexplained casts through feature code), and passing a real
  `tenantId` that the extension then discards (that is exactly the
  client-supplied tenant id the mechanism exists to reject, and it would read as
  legitimate in review).
- **Note for Phase 3:** this is the sanctioned way to write a tenant-scoped
  create. It is a type assertion only and stamps nothing itself.
- **Files:** `src/server/db/tenant-scoped.ts`, `src/server/auth/signup.ts`,
  `tests/isolation/signup.test.ts` · **Commit:** `2989188`

### 3. [Rule 2 — Convention] Server-returned copy moved into `src/lib/strings.ts`

- **Found during:** Task 2.
- **Issue:** `SlugStatus` and `SignUpMerchantResult` both carry user-facing
  `message` strings, and 01-01-SUMMARY's instruction #2 is explicit: *"never
  inline a user-facing literal"*. `strings.ts` also said the `signup` namespace
  belongs to plan 01-07.
- **Resolution:** added the `signup` namespace **now**, containing only the copy
  the server returns, with a comment reserving the form's own labels for 01-07.
  The surface exists as of this plan, so the "don't pre-populate" rule is
  satisfied. `SLUG_FORMAT_MESSAGE` and `SLUG_RESERVED_MESSAGE` are deliberately
  **not** copied here — they stay owned by `@/server/tenant/host`, because the
  format message is built by template literal from `SLUG_MIN_LENGTH`/
  `SLUG_MAX_LENGTH` and duplicating it would let the bounds the merchant reads
  drift from the bounds the schema enforces.
- **Copy is English** per 01-01-SUMMARY, superseding 01-UI-SPEC.md's French
  column, consistent with plan 01-05.
- **Files:** `src/lib/strings.ts` · **Commit:** `2989188`

### 4. [Plan correction] `reserved` is keyed off the message constant, not the substring "reserved"

- **Issue:** 01-03-SUMMARY and RESEARCH.md Code Example 3 both map the reserved
  state by testing `message.includes("reserved")`.
- **Resolution:** compared against the imported `SLUG_RESERVED_MESSAGE` constant
  instead. Both behave identically today, but the constant is the actual
  contract: a copy revision that drops the word "reserved" would silently
  downgrade every reserved hostname to the generic `invalid` state, with nothing
  failing. The test asserts the returned message equals the constant.
- **Files:** `src/server/tenant/actions.ts` · **Commit:** `2989188`

### 5. [Plan correction] Slug races classified by a database read, not an error code

- **Issue:** the plan says to catch `BAD_REQUEST ORGANIZATION_ALREADY_EXISTS`.
  That is one of **two** ways the race surfaces; when both requests clear Better
  Auth's in-endpoint re-check concurrently, the Postgres `@unique` violation
  arrives instead, in a different shape.
- **Resolution:** the catch asks `platformDb.organization.findUnique` who holds
  the slug. Authoritative, covers both orderings, and cannot rot on a patch
  release. The `BAD_REQUEST` branch is retained *below* it to surface the
  reserved/format gate's own message on the slug field.
- **Files:** `src/server/auth/signup.ts` · **Commit:** `2989188`

### 6. [Rule 3 — Blocking] Fresh worktree had no `node_modules` and no env files

- Same blocker plans 01-02 through 01-05 all recorded. `npm ci` (lockfile
  restore only — no package added, changed or resolved by name, so the
  package-legitimacy checkpoint does not apply; `package.json` and
  `package-lock.json` are untouched and appear in no commit), then `cp -n` of
  `.env.local` and `.env.test` from the parent checkout. Both remain gitignored
  and are absent from every commit.
- `npm run typecheck` also failed initially on `LayoutProps`/`PageProps` in
  files this plan does not touch — those are Next-generated globals that only
  exist after a build. `npx next build` emits them; typecheck is clean
  afterwards. Not a code issue.

### 7. [Out of scope — logged] Intermittent P2028 at isolation-suite teardown

- **Found during:** Task 2, full-suite verification.
- **Issue:** on some full-suite runs, one unhandled rejection prints *after* the
  last test passes — a rollback attempted on an expired 5 s transaction, from
  the truncate inside `seedTwoTenants`' batch `$transaction`. A subsequent
  identical run was completely clean. All 171 tests pass and the suite exits 0
  either way.
- **Why not fixed:** the fix belongs to plan 01-04's seed harness (an explicit
  `{ timeout, maxWait }`, and draining in-flight work before `$disconnect`).
  Editing shared test infrastructure from this plan would put every earlier
  plan's isolation suite on an untested code path to silence a teardown warning
  that fails nothing. Logged as **D4** in `deferred-items.md` with the
  diagnosis and a suggested fix.
- **Attribution:** this plan's 22 tests do trigger it — Better Auth's scrypt
  hashing is CPU-bound and blocks the event loop, which is what lets a 5 s
  transaction budget overrun. Recorded honestly rather than filed as
  pre-existing.

---

## Authentication Gates

None. The Neon and Upstash credentials in `.env.local` / `.env.test` were
already provisioned and worked as-is. No task required interactive login.

---

## Known Stubs

None. Every surface this plan creates is fully wired: `checkStoreSlug` reads two
real registries, `signUpMerchant` performs five real writes, and the isolation
suite asserts each against a live database rather than a fixture.

`/signup` and `/onboarding/create-store` do not exist yet — those routes are
plan 01-07's, and this plan's `<interfaces>` block declares the server contract
they will consume. That is a missing downstream surface, not a stub: nothing
here renders a placeholder or returns hardcoded empty data.

---

## Threat Flags

None. Every surface this plan adds is already in its own `<threat_model>`
register, and the plan is net-mitigating.

| Threat | Status |
|---|---|
| T-01-36 reserved hostname claimed by calling the API directly | **mitigated, asserted by bypassing the form** — `createOrganization` with slug `admin` and a fresh zero-org user is refused with the reserved message, and no row is created |
| T-01-37 `beforeCreateOrganization` re-spreading `ctx.body` | mitigated — hook throws only; `return {` absent (grep 0); the trap re-verified in the installed 1.6.29 source |
| T-01-38 merchant minting extra stores | mitigated — `allowUserToCreateOrganization: false` + `organizationLimit: 1`; a direct system-action call for an owner who already has a store is refused |
| T-01-39 slug enumeration | mitigated — `rl:slugcheck` applied **before** parsing or any database read, asserted behaviourally |
| T-01-40 signup flood | mitigated — `rl:signup` before any write; test asserts a throttled call creates **no** user |
| T-01-41 released slug re-issued | mitigated — `StoreSlugHistory` global `@unique`, written at provisioning and consulted by `checkStoreSlug`; asserted with a history row whose organization no longer exists |
| T-01-42 TOCTOU race producing two stores | mitigated — DB `@unique` is the guarantee; classified by a slug-holder read so both failure shapes are covered |
| T-01-43 negative cache shadowing a new store | mitigated — `invalidateTenantHost(slug)` at the end of provisioning, asserted via a delegating spy |
| T-01-44 session cookie readable from a storefront | mitigated — no cross-subdomain cookie option set (grep 0); handler apex-only |
| T-01-45 client-supplied `tenantId` on the slug-history write | mitigated — no `tenantId` in `data` (grep 0); test asserts the stamped value equals the new org id |
| T-01-46 user left with an account and no store | mitigated — honest error copy; 01-07 owns the recovery route |
| T-01-47 password/session/CSRF | transferred to Better Auth core; no bespoke crypto added |

---

## Notes for Downstream Plans

- **01-07 (the UI):** `SlugStatus`'s five statuses map one-to-one onto the
  UI-SPEC slug states — `available | invalid | reserved | taken | rate-limited`,
  where `rate-limited` is the "check unavailable" state and **the submit button
  must stay enabled in it** (the server is the authority; the live check is UX).
  Render `message` as returned rather than re-authoring copy. `signUpMerchant`
  returns `{ ok: false, error: Record<string, string[]> }` keyed by field name
  (`email`, `password`, `storeName`, `slug`) plus `form` for whole-form errors —
  map `form` to a non-field alert. The `/onboarding/create-store` recovery route
  is yours: any authenticated user with zero organizations belongs there.
- **01-07:** the Vercel wildcard-domain setup (`*.einort.com` + Vercel
  nameservers) is the one-time human task that makes DOM-01 true in production.
  Nothing in code depends on it locally, and wildcard SSL silently does not
  issue if the apex nameservers are not Vercel's.
- **Phase 2 (TEN-04):** `session.activeOrganizationId` is populated on both
  signup and every subsequent login. A3 is settled — build on it directly.
- **Phase 3:** use `scopedCreateData<Prisma.XUncheckedCreateInput>({ … })` for
  tenant-scoped creates. Do not pass `tenantId`, and do not add inline casts.
- **Phase 4 (rename, D-03):** a rename must write a new `StoreSlugHistory` row,
  set `releasedAt` on the old one, and call `invalidateTenantHost(oldSlug,
  newSlug)`. `checkStoreSlug` already refuses to re-issue a released slug, so
  the rename path gets that protection for free.
- **Phase 6 (admin):** `status` and `platformRole` are `input: false`, so
  suspension and role changes cannot go through the public API by design — they
  need a deliberate admin-only write path.
- **Testing:** `tests/isolation/signup.test.ts` shows how to test a Next Server
  Action end to end — `vi.mock("next/headers")` with a mutable cookie jar that
  mirrors `MutableRequestCookiesAdapter` semantics, so the real `nextCookies()`
  plugin runs and the session-cookie round trip is exercised rather than
  stubbed. Reuse it rather than mocking Better Auth.

---

## Commits

| Commit | Task | Gate | Description |
|---|---|---|---|
| `17c4c1b` | 1 | — | Better Auth with organization as the tenant primitive, rate limiters, apex-only handler |
| `41669df` | 2 | RED | Failing signup, slug-check and provisioning tests |
| `2989188` | 2 | GREEN | `checkStoreSlug`, `signUpMerchant`, `scopedCreateData`, signup copy |

TDD gate sequence satisfied: `test(01-06)` (`41669df`) precedes `feat(01-06)`
(`2989188`), and the RED run was confirmed failing before implementation. No
REFACTOR commit was needed. Task 1 is configuration with no behaviour of its own
to drive from a test; its acceptance is the build, the source criteria, and the
Task 2 tests that exercise every option it sets.

---

## Self-Check: PASSED

All 6 claimed created files and all 3 claimed modified files exist on disk. All
3 commit hashes (`17c4c1b`, `41669df`, `2989188`) resolve in `git log`.
`git diff --diff-filter=D` reports **no deletions** in any of the three commits.
The throwaway DDL-inspection script was removed and appears in no commit;
`git status --short` was clean before this SUMMARY was written. `node_modules/`,
`.env.local` and `.env.test` are gitignored and absent from every commit. Per
the orchestrator's instructions, **`STATE.md` and `ROADMAP.md` were not
modified**.

---

## Execution Environment Note

Executed in the worktree `.claude/worktrees/agent-a802190cd94c01a24` on branch
`worktree-agent-a802190cd94c01a24`, based on `4af2bda`. Windows 11, Node 24.16.0,
`better-auth@1.6.29`, `next@16.3.1`, `prisma@7.9.1`, `zod@4.4.3`. The isolation
suite runs against the dedicated Neon **test** branch via `.env.test`; the
development branch was never touched.
