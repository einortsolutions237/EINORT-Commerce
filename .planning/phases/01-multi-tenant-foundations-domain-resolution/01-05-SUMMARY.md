---
phase: 01-multi-tenant-foundations-domain-resolution
plan: 05
subsystem: routing
tags: [hostname-resolution, redis, negative-caching, fail-closed, d-05, storefront, next16]
requires:
  - "01-01: src/env.ts (optional UPSTASH_*), src/lib/strings.ts, src/app/layout.tsx title template, vitest projects"
  - "01-02: src/server/db/platform.ts (platformDb.organization), Organization.slug @unique + status NOT NULL"
  - "01-03: src/proxy.ts rewrites store hosts to /s/{slug} and unknown hosts to /store-not-found"
  - "01-04: tests/setup/seed-two-tenants.ts (TENANT_A/TENANT_B), isolation project setup + teardown"
provides:
  - "src/server/tenant/cache.ts — tenant:host:* positive + negative cache, loud no-op degradation"
  - "src/server/tenant/resolve.ts — resolveTenantBySlug (React cache(), Redis-cached, fail-closed) + ResolvedTenant"
  - "src/app/not-found.tsx — THE branded EINORT failure body (D-04/D-05)"
  - "src/app/store-not-found/page.tsx — notFound() shim for the Proxy's unknown-host rewrite"
  - "src/app/s/[slug]/layout.tsx — storefront tenant gate"
  - "src/app/s/[slug]/page.tsx — placeholder storefront rendering the store name"
  - "src/lib/strings.ts — storeNotFound and storefront copy namespaces"
  - "tests/isolation/resolve.test.ts — 14 resolver tests against the Neon test branch"
affects: [01-06, 01-07]
tech-stack:
  added: []
  patterns:
    - "Three-state cache lookup (unset / miss / hit) so a cached negative cannot collapse into 'ask the database'"
    - "Cache the database record verbatim, apply the active-status allowlist at return time"
    - "Lazy, memoized Redis client resolution — makes the degradation branch testable and the warning fire once per process"
    - "One notFound() component for every failure path; duplicating the body is the drift mechanism"
    - "Static metadata on the storefront page so no per-tenant metadata surface has to be proven non-distinguishing"
key-files:
  created:
    - src/server/tenant/cache.ts
    - src/server/tenant/resolve.ts
    - src/app/not-found.tsx
    - src/app/store-not-found/page.tsx
    - src/app/s/[slug]/layout.tsx
    - src/app/s/[slug]/page.tsx
    - tests/isolation/resolve.test.ts
  modified:
    - src/lib/strings.ts
decisions:
  - "ResolvedTenant gains `name` (additive to the contract published for 01-06) so the placeholder storefront renders something the URL could not have supplied"
  - "English copy per 01-01-SUMMARY, not the plan's French literals — 01-UI-SPEC.md's French default is superseded"
  - "User-facing strings live in src/lib/strings.ts, so the plan's grep-for-literal acceptance criteria are satisfied against the rendered HTML instead of the source"
  - "D-05 verified by a same-hostname comparison (suspended vs unclaimed) rather than the plan's cross-hostname one — the cross-hostname bodies differ only by the slug the visitor themselves supplied"
  - "invalidateTenantHost deliberately does NOT swallow errors; the read and write paths do"
requirements: [TEN-03, DOM-02]
metrics:
  duration: "~85 min"
  completed: 2026-08-17
  tasks: 2
  commits: 2
  tests: 14 new (149 total)
---

# Phase 1 Plan 05: Tenant Resolution & the Storefront Route Tree Summary

The hostname loop is closed. The slug that plan 03's Proxy puts into the URL now
becomes a real tenant, read from Postgres through a Redis-cached, negative-cached,
fail-closed resolver, and rendered as either a live storefront or one branded
EINORT failure page — and a live check proved the suspended and unclaimed paths
return byte-identical bodies for the same hostname.

---

## Required Plan Outputs

| Question the plan asked | Answer |
|---|---|
| **Were Upstash credentials configured, or was the no-cache path exercised?** | **Both, live.** The production server was run twice against the seeded Neon test branch: once with the real Upstash credentials from `.env.local` (positive and negative keys confirmed present in Upstash with the right TTLs), and once with `UPSTASH_REDIS_REST_URL`/`_TOKEN` forced empty. The degraded run emitted exactly one `console.warn` naming both variables and continued to serve the storefront (200, store name rendered) and to 404 unknown hostnames. Nothing threw. |
| **Observed `curl` status codes** | See the table below — all six probes matched. |
| **Was the unknown/suspended body diff empty?** | **Yes, for the comparison that actually tests D-05** (same hostname, two backend states): byte-identical, 5890/5890. The plan's literal cross-hostname comparison differs by exactly 6 characters — see Deviation 4. |

### Live status codes (`next start`, `NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000`, port 3312)

| Request | Expected | Observed |
|---|---|---|
| `Host: alpha-store.localhost` `/` | 200 | **200** |
| `Host: beta-store.localhost` `/` | — | **200** |
| `Host: nosuchstore.localhost` `/` | 404 | **404** |
| `Host: localhost:3000` `/s/alpha-store` | 404 | **404** |
| `Host: a.b.localhost` `/` (unclassifiable) | 404 | **404** |
| `Host: localhost:3000` `/store-not-found` | 404 | **404** |

The live storefront body contained `Alpha Store` (the organization's `name`,
straight from Postgres), `Store coming soon`, `Check back soon`, and
`<title>Store coming soon · EINORT</title>`. The failure body contained
`Store not found`, `No store exists at this address. Check the spelling of the
address.`, `Discover EINORT`, `href="http://localhost:3000"`, and
`<title>Store not found · EINORT</title>`.

### Real Upstash keys after two live requests

```
tenant:host:alpha-store      ttl=299s  {"kind":"hit","tenant":{"id":"tenant-a-fixed-id","slug":"alpha-store","name":"Alpha Store","status":"active"}}
tenant:host:scanner1         ttl=59s   {"kind":"miss"}
tenant:host:never-requested  ttl=-2s   null
```

Both TTLs are the intended ones, the negative sentinel is written for a hostname
that was never claimed, and nothing is written for a slug nobody asked for. This
is the T-01-31 mitigation observed against the real service, not inferred from
the source.

---

## What Was Built

### Task 1 — `cache.ts` + `resolve.ts` + 14 isolation tests (`4c5e002`)

`cache.ts` owns the `tenant:host:` namespace and nothing else (C-11). Three
things in it are load-bearing rather than performance work.

**The lookup has three states, not two.** `getCachedTenant` returns
`{kind:"unset"} | {kind:"miss"} | {kind:"hit", tenant}`. Collapsing `unset` and
`miss` into `null` is the obvious simplification and it silently deletes the
negative cache: the resolver would re-query on every request for an unknown
hostname, every test would still pass, and T-01-31 would be gone. The
discriminated union is what makes that mistake a type error.

**The record is cached verbatim, including a non-active status, and the
suspension rule is applied at return time.** That ordering is what makes an
un-suspend a single `invalidateTenantHost` call rather than a differently shaped
cache entry — and it means a suspended hostname under scan still costs zero
database reads. An isolation test asserts exactly this: two resolutions of a
suspended slug return `null` twice for one query, and the stored value contains
`suspended`.

**The client is resolved lazily and memoized.** Memoizing the *decision* (not
just the client) is what keeps the degradation warning to one line per process.
It is also what makes the degradation branch testable at all — an eagerly
constructed module-scope client would be fixed at import time.

`invalidateTenantHost` is the one function that does **not** swallow errors. A
failed read or write means extra database load; a failed eviction means a
suspended store keeps serving. Those deserve different behaviour, so the caller
can see and retry the second one.

`resolve.ts` is `cache()`-wrapped for per-render dedupe and allowlists exactly
one status:

```ts
const ACTIVE_STATUS = "active";
```

Allowlisting one value rather than denylisting `"suspended"` is what makes a
status added by a future migration fail closed instead of accidentally serving.

The test file lives in the `isolation` project because "the second resolution
issued no query" is only meaningful if the first one really did — the counting
wrapper around `platformDb.organization.findUnique` is a passthrough to the real
Neon branch, not a stub. What *is* substituted is the Upstash transport: a
`Map`-backed `get`/`set`/`del` that honours `ex`. A shared live Redis would make
these tests order-dependent across runs (a leftover key silently satisfies "no
second query"), which is the opposite of what a security control's regression
test should be. The live Upstash evidence above covers the transport.

### Task 2 — the route tree and the one failure surface (`b77e829`)

Four files, and the interesting property is how few of them contain the failure
copy: exactly one.

`src/app/not-found.tsx` is the whole body. `src/app/store-not-found/page.tsx` is
three lines that call `notFound()`. `src/app/s/[slug]/layout.tsx` calls
`notFound()` when the resolver returns `null`. Both failure paths therefore
render the identical component with identical props, which is precisely D-05's
stated enforcement criterion — and it is only checkable because there is exactly
one such component. `notFound()` is also what turns a rewrite into a genuine 404
(Next additionally emits `<meta name="robots" content="noindex"/>`, which is a
free extra on T-01-33).

The layout has no `try`/`catch` around the resolver, deliberately. Failing closed
means failing: a Postgres or Redis error must surface, never be swallowed into a
rendered storefront and never be mistaken for "no such tenant".

`page.tsx` uses **static** metadata. Per-tenant metadata would be one more
surface someone would have to prove does not differ between a live and a
non-active store; a constant title cannot leak anything. The store's `name` is
rendered in the body instead — the one element on the page that could only have
come from the database.

`cacheComponents` stays off: `grep -v '^\s*//' next.config.ts | grep -c 'cacheComponents'` → **0**.

---

## Verification

| Gate | Command | Result |
|---|---|---|
| Resolver suite | `npx dotenv -e .env.test -- npx vitest run tests/isolation/resolve.test.ts --reporter=dot` | exit 0, **14 passed**, 0 skipped |
| Full suite | `npx dotenv -e .env.test -- npx vitest run` | exit 0, **8 files, 149 tests**, 0 skipped (117.9s) |
| Unit suite | `npx vitest run tests/unit --reporter=dot` | exit 0, 115 passed |
| Lint | `npm run lint` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Build | `npx next build` | exit 0; routes `/`, `/_not-found`, `/s/[slug]`, `/store-not-found`, plus `ƒ Proxy (Middleware)` |
| Live status codes | six `curl -H "Host: …"` probes | all six matched (table above) |
| Live degradation | `next start` with `UPSTASH_*` empty | one warn naming both vars; 200 storefront, 404 unknown, no throw |
| Real Upstash TTLs | `redis.ttl` after two live requests | hit **299s**, miss **59s** |

### Source-level acceptance criteria

| Criterion | Result |
|---|---|
| `grep -c 'tenant:host:' src/server/tenant/cache.ts` | **3** (≥1 required) |
| `grep -c 'session:\|jobs:\|cart:' src/server/tenant/cache.ts` | **0** |
| `cache.ts` contains 300 and 60, used for hit and miss respectively | yes — `TTL_HIT_SECONDS = 300`, `TTL_MISS_SECONDS = 60`, asserted behaviourally by a test |
| `grep -c 'resolve' src/proxy.ts` | **0** (the Proxy does not import the resolver) |
| Both new modules start with `import "server-only";` | yes |
| `grep -c 'notFound()' src/app/store-not-found/page.tsx` | **4** (1 call + 3 in the rationale comment) |
| `src/app/store-not-found/page.tsx` contains `Store not found` | **0** — body comes only from `not-found.tsx` |
| `grep -ci 'suspend\|temporarily\|indisponible\|unavailable' src/app/not-found.tsx` | **0** |
| `src/app/s/[slug]/layout.tsx` contains `await params`, `resolveTenantBySlug`, `notFound()` | yes / yes / yes |
| `grep -ci 'onboarding\|panier\|cart\|produit' src/app/s/[slug]/page.tsx` | **0** |
| `grep -v '^\s*//' next.config.ts \| grep -c 'cacheComponents'` | **0** |

### The D-05 body comparison, done two ways

The plan asks for a byte-identical diff. Run naively across two *different*
hostnames it cannot be empty, and the reason is worth recording (Deviation 4).
Both comparisons were performed:

| Comparison | Result |
|---|---|
| **Same hostname `alpha-store.localhost`, organization `status="suspended"` vs organization deleted (slug unclaimed)** | **IDENTICAL — 5890 vs 5890 bytes, `diff` empty.** This is the comparison that tests D-05: one variable changed, and it is the backend state. |
| `nosuchstore.localhost` vs suspended `alpha-store.localhost` (the plan's literal wording) | Differs by **6 characters**: common prefix 1863, common suffix 4021, A middle `"nosuch"`, B middle `"alpha-"`. The delta is the route param inside the RSC router state — `[\"slug\",\"nosuchstore\"]` vs `[\"slug\",\"alpha-store\"]` — i.e. the hostname the visitor typed, echoed back to them. |

The second row is not an information leak: the requester already knows which
hostname they requested, and the response reveals nothing about whether a store
exists there. Every byte that *could* distinguish a suspended store from an
unclaimed one — heading, body, link, `<title>`, metadata, status code, `noindex`
— is identical, which the first row proves at byte granularity.

---

## Deviations from Plan

### 1. [Rule 2 — Missing critical functionality] `ResolvedTenant` gains a `name` field

- **Found during:** Task 2, writing `src/app/s/[slug]/page.tsx`.
- **Issue:** the plan's action text says the placeholder storefront *"may render
  the resolved store's `name`, which is the real database read that proves the
  skeleton works end to end"*, but the `<interfaces>` block declares
  `ResolvedTenant = { id: string; slug: string; status: string }`. There is no
  `name` to render, and the two halves of the plan contradict each other.
- **Resolution:** added `name` to `CachedTenant`, `ResolvedTenant` and the
  resolver's `select`. This is **additive** — plan 01-06 destructures `id`,
  `slug` and `status` and is unaffected. The alternative (rendering the slug)
  proves nothing, because the slug arrives in the URL; only a value that could
  not have come from the request demonstrates the read happened.
- **New obligation, recorded because it is a real one:** a change to
  `organization.name` now also requires `invalidateTenantHost`, or the storefront
  shows the old name for up to 300s. Cosmetic, not security-relevant — unlike
  `status`, which was already covered by T-01-32 — and documented on both the
  type and the function.
- **Files:** `src/server/tenant/cache.ts`, `src/server/tenant/resolve.ts`,
  `tests/isolation/resolve.test.ts` · **Commit:** `b77e829`

### 2. [Plan correction] English copy, not the plan's French literals

- **Found during:** Task 2 `read_first`, exactly as the plan directs.
- **Issue:** the plan's action text and three acceptance criteria specify
  `Boutique introuvable`, `Découvrir EINORT` and
  `Aucune boutique n'existe à cette adresse.` — the French column of
  `01-UI-SPEC.md`. The plan's own `read_first` says *"`01-01-SUMMARY.md` — the
  copy-language decision from plan 01 Task 1 determines which copy column to
  render"*, and that decision is recorded verbatim from the developer: **ship
  English, French as a fast-follow**, with `01-UI-SPEC.md` explicitly
  *superseded* on its French-shipping default and on `<html lang="fr">`.
- **Resolution:** followed 01-01-SUMMARY. The shipped strings are the English
  reference column: `Store not found`, `No store exists at this address. Check
  the spelling of the address.`, `Discover EINORT`, `Store coming soon`,
  `This store hasn't opened yet. Check back soon.` `src/app/layout.tsx` already
  carries `lang="en"`. Everything else in the UI contract — spacing scale,
  typography roles, colour, the 44px touch target, `max-w-prose`, the
  accessibility floor — was followed unchanged.
- **Files:** `src/lib/strings.ts`, `src/app/not-found.tsx`,
  `src/app/s/[slug]/page.tsx` · **Commit:** `b77e829`

### 3. [Plan correction] Copy literals live in `strings.ts`, so two greps move to the rendered HTML

- **Found during:** Task 2 acceptance checks.
- **Issue:** the plan asserts `src/app/not-found.tsx` *contains* `Boutique
  introuvable` and `Découvrir EINORT`. 01-01-SUMMARY's instruction #2 is the
  opposite: *"Add strings to `src/lib/strings.ts` under a namespace named for the
  route — never inline a user-facing literal in JSX."* Both cannot hold.
- **Resolution:** kept the centralized-strings rule (it is what makes the later
  i18n pass an extraction rather than a rewrite) and verified the criterion's
  *intent* against the live response body instead, where `Store not found`,
  `No store exists at this address. Check the spelling of the address.`,
  `Discover EINORT` and `href="http://localhost:3000"` all appear. The negative
  criterion — `store-not-found/page.tsx` must NOT contain the heading — holds
  literally, at **0**.
- **Related:** `grep -c 'try' src/app/s/[slug]/layout.tsx` returns 1. The match is
  the comment *"There is deliberately no `try`/`catch` around the resolver"*.
  There is no `try` block; the criterion's intent holds.

### 4. [Rule 2 — Missing critical functionality] The D-05 diff was re-specified to isolate the variable

- **Found during:** Task 2 live verification.
- **Issue:** the plan asks that the bodies for `Host: nosuchstore.localhost` and
  for a suspended seeded store be byte-identical. Those are two *different*
  hostnames, and Next embeds the route param in the RSC router state, so the two
  responses necessarily differ by the slug — a 6-character delta that is present
  no matter how correct the implementation is. Run as written, the criterion can
  never pass and tells you nothing when it fails.
- **Resolution:** ran the comparison the property actually needs — **one
  hostname, two backend states**. `alpha-store.localhost` was captured with the
  organization `status="suspended"`, then with the organization deleted so the
  slug was genuinely unclaimed, evicting `tenant:host:alpha-store` from the real
  Upstash between the two so neither read a stale entry. The bodies are
  byte-identical (5890/5890, empty `diff`). The plan's literal comparison was
  also run and characterized to 6 characters (table above), so the delta is
  documented rather than waved away. The fixture was restored with
  `prisma db seed` afterwards.
- **Why this is stronger, not weaker:** the plan's version varies two things at
  once (hostname *and* backend state). The replacement varies exactly the thing
  D-05 is about.

### 5. [Rule 3 — Blocking] Fresh worktree had no `node_modules` and no env files

- **Found during:** setup — the same blocker plans 01-02, 01-03 and 01-04 all
  recorded.
- **Fix:** `npm ci` (lockfile restore only; no package added, changed or resolved
  by name, so the package-legitimacy checkpoint does not apply — `package.json`
  and `package-lock.json` are untouched and appear in no commit), then copied
  `.env.local` and `.env.test` from the parent checkout with `cp -n`. The
  `postinstall` `prisma generate` failed on the first pass because
  `prisma.config.ts` reads `.env.local`, which did not exist yet; re-running
  `node scripts/prisma-generate.mjs` after the copy succeeded. Both env files
  remain gitignored and are absent from every commit.
- **Files:** none committed

### 6. Live verification ran against the Neon **test** branch, not development

- **Rationale:** the D-05 check needs a seeded `alpha-store` and needs to
  suspend and delete it. Doing that against the development branch would mutate
  real data. `next start` was therefore launched with `DATABASE_URL` and
  `DIRECT_URL` pointed at `TEST_DATABASE_URL` (Next does not override variables
  already present in `process.env`), while `.env.local` still supplied the real
  Upstash credentials — which is what made the live Redis evidence possible.
  Six throwaway helper scripts (`_live-*.sh`, `_live-*.mts`, `_live-*.mjs`) were
  used and deleted; `git status` is clean and none appear in either commit.

---

## Authentication Gates

None. The Neon and Upstash credentials in `.env.local` / `.env.test` were already
provisioned and worked as-is. This plan is the first to actually exercise the
Upstash credentials, and they are confirmed live.

---

## Known Stubs

`src/app/s/[slug]/page.tsx` is a placeholder by design, not a stub: it renders
real data (the organization's `name`, read from Postgres through the resolver)
and `01-UI-SPEC.md` specifies its copy as an empty state. Phase 4 replaces it
wholesale. Nothing on it is faked, hardcoded or wired to an empty data source,
and the plan's goal — proving hostname resolution end to end — is achieved by
this page rather than deferred by it.

`/signup` is linked from the root placeholder and does not exist yet; that route
is plan 01-07's and is out of this plan's scope.

---

## Threat Flags

None. Every surface this plan adds is already in its own `<threat_model>`
register, and the plan is net-mitigating.

| Threat | Status |
|---|---|
| T-01-29 suspended vs never-claimed distinguishable | **mitigated, proven at byte granularity** — same-hostname diff empty; one component, one set of props |
| T-01-30 suspended tenant still rendering children | mitigated — resolver allowlists `active`; layout gates the subtree; no `try`/`catch` |
| T-01-31 wildcard scan exhausting the Neon pool | mitigated — negative cache at 60s, observed live in Upstash (`{"kind":"miss"}`, ttl 59s); isolation test asserts exactly one query across two unknown resolutions |
| T-01-32 suspended store serving until the TTL expires | mitigated — `invalidateTenantHost` exported, does not swallow errors, and has its own test proving a suspension takes effect before the TTL |
| T-01-33 crawlers indexing wildcard hostnames as 200s | mitigated — genuine 404 via `notFound()`, plus Next's `<meta name="robots" content="noindex"/>` |
| T-01-34 cross-tenant cached storefront shell | mitigated — `cacheComponents` absent from `next.config.ts` (grep 0) |
| T-01-35 Upstash outage taking storefronts offline | accepted, and the accepted behaviour is **verified live**: one warn, no throw, storefront still 200 |

---

## Notes for Downstream Plans

- **01-06 (provisioning):** call
  `invalidateTenantHost(slug)` from `@/server/tenant/cache` immediately after
  creating an organization. Without it, a merchant who checked their slug during
  signup has already written a 60s negative entry, and their brand-new store 404s
  for up to a minute after they land on it. This is the single most likely
  first-run bug in the whole phase.
- **01-06 / 01-07:** `ResolvedTenant` is `{ id, slug, name, status }` — `name` is
  additive to the contract the plan published; the three declared fields are
  unchanged.
- **Phase 6 (admin):** suspend, un-suspend, slug rename **and** store rename all
  call `invalidateTenantHost`. On a slug rename, pass both the old and the new
  slug. The 300s TTL is a backstop, not the mechanism.
- **Phase 3/4:** `scopedDb` is still the path for tenant-scoped models;
  `platformDb` is the only sanctioned reader of `organization`. Do not add a
  second Redis client for `tenant:host:` keys — `cache.ts` owns that namespace
  (C-11), and cart/idempotency keys get their own module.
- **Phase 4:** revisit `cacheComponents` only with explicit per-tenant cache
  keys. Next 16's dynamic-by-default posture is currently the thing standing
  between the platform and a storefront shell served across tenants.
- **Testing:** `tests/isolation/resolve.test.ts` shows the pattern for testing a
  module that memoizes at import time — `vi.resetModules()` plus `vi.doMock` on
  `@/env`, `@upstash/redis` and `@/server/db/platform`, then dynamic import. Reuse
  it rather than adding a test-only export seam to production code.

---

## Commits

| Commit | Task | Description |
|---|---|---|
| `4c5e002` | 1 | Cached, negative-cached, fail-closed tenant resolution + 14 isolation tests |
| `b77e829` | 2 | Storefront route tree and the one branded failure surface |

---

## Self-Check: PASSED

All 7 claimed created files and the 1 claimed modified file exist on disk. Both
commit hashes (`4c5e002`, `b77e829`) resolve in `git log`.
`git diff --diff-filter=D --name-only` reports no deletions in either commit. All
six throwaway verification helpers are absent from the tree and from both commits;
`git status --short` is clean apart from this SUMMARY. The Neon test branch was
restored to the canonical two-tenant fixture with `prisma db seed` after the
destructive D-05 probe. Per the orchestrator's instructions, `STATE.md` and
`ROADMAP.md` were **not** modified.

---

## Execution Environment Note

Executed in the worktree `.claude/worktrees/agent-ad8becc0d23af576b` on branch
`worktree-agent-ad8becc0d23af576b`, based on `2b4841d`. Live checks ran under
`next start` on Windows 11 — a second favourable data point for the Windows
`next start` proxy regression (issue #85243, Pitfall 10), and this time against
a **real storefront route**, which is what plan 01-03's Deviation 6 said was
still outstanding. Plan 01-07 T2/T3 can treat that as evidence rather than as an
open question.
