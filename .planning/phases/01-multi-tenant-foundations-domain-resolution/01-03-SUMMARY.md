---
phase: 01-multi-tenant-foundations-domain-resolution
plan: 03
subsystem: routing
tags: [hostname-resolution, proxy, tenant-isolation, reserved-slugs, fail-closed, tdd]
requires:
  - "01-01 — vitest `unit` project, `@/*` alias, ESLint import zones, `src/env.ts`"
provides:
  - "src/server/tenant/reserved-slugs.ts — RESERVED_SLUGS, the single source of truth for TEN-06"
  - "src/server/tenant/host.ts — classifyHost + HostResult + the slug format constants"
  - "src/server/tenant/slug.ts — storeSlugSchema (Zod 4)"
  - "src/proxy.ts — Next 16 Proxy: /s 404 guard, header sanitisation, host-based rewrite"
  - "tests/unit/{host,slug,proxy}.test.ts — 107 unit tests"
affects: [01-05, 01-06, 01-07]
tech-stack:
  added: []
  patterns:
    - "Two-stage hostname resolution: pure zero-I/O classification in the Proxy, cached DB lookup deferred to the RSC layer"
    - "Tenant identity travels only in a server-generated rewritten path, never in a header"
    - "Fail-closed classification: no 'probably a store' branch"
    - "Format constants owned by the dependency-free module so the Zod-importing module points at it, not the reverse"
key-files:
  created:
    - src/server/tenant/reserved-slugs.ts
    - src/server/tenant/host.ts
    - src/server/tenant/slug.ts
    - src/proxy.ts
    - tests/unit/host.test.ts
    - tests/unit/slug.test.ts
    - tests/unit/proxy.test.ts
  modified: []
decisions:
  - "Slug bounds fixed at 3-30 characters (01-UI-SPEC.md), not research's 3-40"
  - "proxy.ts lives at src/proxy.ts, not the repository root — Next only registers it from inside src/ in a src/-based project (empirically verified)"
  - "The unknown branch forwards sanitised headers too, which the plan's snippet omitted"
  - "classifyHost owns SLUG_MIN_LENGTH/SLUG_MAX_LENGTH/SLUG_PATTERN so slug.ts can import them without pulling Zod into the Proxy bundle"
requirements: [TEN-03, TEN-06, DOM-02]
metrics:
  duration: "~20 min (02:28 → 02:48 UTC+1)"
  completed: 2026-08-17
  tasks: 2
  commits: 4
  tests: 107
---

# Phase 1 Plan 03: Hostname Classification & the Next 16 Proxy Summary

Built the request-interception half of tenant resolution: one pure, exhaustively tested
hostname classifier and the Next 16 Proxy that acts on it. Storefront tenant identity now
derives from the `Host` header and nothing else — never from a client-supplied header,
never from a client-forgeable path.

---

## Recorded for plans 05, 06 and 07

**Slug bounds are 3–30 characters.** Research Code Example 3 proposed 3–40; `01-UI-SPEC.md`
§ "Slug field states" already renders *"Use 3–30 characters…"* to the merchant. One number
wins, and the one the user was going to read won. `SLUG_MIN_LENGTH` and `SLUG_MAX_LENGTH`
live in `src/server/tenant/host.ts`; both the Zod schema and `classifyHost` derive their
bounds from them, and the merchant-facing copy is **built from them by template literal**,
so the schema and the copy cannot drift.

Two message constants are exported and are **part of the contract**, because plan 01-07's
`checkStoreSlug` maps an issue to the `reserved` UI state by looking for the word "reserved"
and falls back to `invalid` otherwise:

| Constant | Value |
|---|---|
| `SLUG_FORMAT_MESSAGE` | `Use 3–30 characters: lowercase letters, numbers and hyphens, no leading or trailing hyphen.` |
| `SLUG_RESERVED_MESSAGE` | `That address is reserved by EINORT. Choose another.` |

Both are verbatim from `01-UI-SPEC.md`. Plan 01-07 should render the schema's message rather
than re-author the copy. The all-numeric case has its own message, `Cannot be all numbers`.

**No reserved-slug additions beyond the research list.** All 84 entries come from RESEARCH.md
Pattern 2, unchanged. Format-based blocks (punycode prefix, all-numeric, hyphen placement)
are deliberately *not* in the set — they are rules, not names, and live in the schema and the
classifier where each is expressed once.

**No `middleware.ts` was created.** `git ls-files | grep -c middleware.ts` returns 0.

---

## What Was Built

### Task 1 — Blocklist, slug schema, classifier (`b7915d7` RED, `c0d8d5b` GREEN)

`reserved-slugs.ts` is an 84-entry `ReadonlySet<string>` and the single source of truth for
all three TEN-06 layers. Two entries carry their reasons in the source: `app`/`dashboard`
stay reserved even though D-07 puts the dashboard on the apex — that is what keeps D-07
*reversible* — and `s` is reserved because it is the internal rewrite prefix, so a store
slugged `s` would produce `/s/s/…`.

`host.ts` is pure and zero-I/O: it imports the blocklist and nothing else. The root domain
arrives as an argument rather than being read from `@/env`, which is what makes the whole
classification table unit-testable with no environment at all. Order of operations is
fail-closed throughout, and one line carries most of the weight:

```ts
if (!host.endsWith(`.${root}`)) return { kind: "unknown", reason: "foreign-domain" };
```

The leading dot is the entire defence against suffix confusion. `endsWith(root)` alone
accepts `einort.com.evil.tld` and hands an attacker-controlled origin a storefront on our
routing table — a total, silent DOM-02 failure. `tests/unit/host.test.ts` asserts that exact
literal under a `describe("fails closed")` block, which is what `vitest -t "fails closed"`
matches.

`host.ts` also owns `SLUG_MIN_LENGTH`, `SLUG_MAX_LENGTH` and `SLUG_PATTERN`. That looks like
the wrong home until you follow the dependency arrow: `slug.ts` imports Zod, and `host.ts`
runs inside the Proxy. Putting the constants in the dependency-free module and having
`slug.ts` import them keeps one number in one place while keeping Zod out of the
interception path.

### Task 2 — `src/proxy.ts` (`ce2b27b` RED, `75da251` GREEN)

Three controls, in this order:

1. `/s` and `/s/*` return `new NextResponse(null, { status: 404 })` as the **first**
   statement after the `pathname` destructure. Safe unconditionally because legitimate
   traffic reaches `/s/…` only after a rewrite, and rewrites do not re-enter the Proxy.
2. `x-tenant-id` and `x-store-slug` are deleted from a copied `Headers` and forwarded via
   the nested `{ request: { headers } }` form — on **every** branch, the unknown branch
   included.
3. `classifyHost` drives an exhaustive switch: passthrough for `root`/`reserved`, fail-closed
   rewrite to `/store-not-found` for `unknown`, `/s/{slug}{pathname}` rewrite for `store`.

`ROOT_DOMAIN` is read once at module scope from a literal `process.env` reference (so Next
inlines it) and throws at module load if blank — a blank root domain classifies every host
as the apex and takes every storefront offline silently (T-01-03).

The matcher deliberately does **not** exclude `/api`, so a storefront subdomain hitting
`/api/auth/*` is rewritten into `/s/{slug}/api/auth/*` where no handler exists and 404s.
That is what keeps auth apex-only per D-07; excluding `/api` would leave a live auth endpoint
on every merchant-controlled subdomain.

---

## Verification

| Gate | Command | Result |
|---|---|---|
| Full unit suite | `npx vitest run tests/unit --reporter=dot` | exit 0, **107 passed**, 0 skipped |
| DOM-02 filter | `npx vitest run tests/unit/host.test.ts -t "fails closed"` | exit 0 |
| TEN-03 filter | `npx vitest run tests/unit/proxy.test.ts -t "strips"` | exit 0, **5** matched |
| DOM-02 filter | `npx vitest run tests/unit/proxy.test.ts -t "internal prefix"` | exit 0, **4** matched |
| Lint | `npm run lint` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Build | `npx next build` | exit 0, prints `ƒ Proxy (Middleware)` |
| No `middleware.ts` | `git ls-files \| grep -c middleware.ts` | 0 |
| No runtime export | `grep -v '^\s*//' src/proxy.ts \| grep -c "export const runtime"` | 0 |
| Header deletes | same, `delete("x-tenant-id")` / `delete("x-store-slug")` | 1 each, both before `classifyHost` (lines 76, 77 → 80) |
| No I/O in proxy | `grep -c "prisma\|upstash\|@/server/db" src/proxy.ts` | 0 |
| No I/O in classifier | `grep -c 'from "@/server/db' src/server/tenant/host.ts` | 0 |
| Blocklist entries | `www api admin app dashboard s checkout security` | all 8 present |

### Live smoke check (unplanned — see Deviation 6)

`next build && next start` on this Windows 11 machine, `NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000`:

| Request | Status | Meaning |
|---|---|---|
| `GET localhost:3312/` | 200 | apex placeholder, passthrough |
| `GET /` with `Host: store1.einort.com` | 404 | foreign under `root=localhost` → fail-closed rewrite |
| `GET /` with `Host: store1.localhost` | 404 | rewritten to `/s/store1`; that route arrives in plan 01-05 |
| `GET /s/store1` | 404, **body length 0** | the Proxy's own `NextResponse(null, 404)` |
| `GET /nonexistent-route` | 404, body length 8316 | the framework's HTML 404 |

The last two rows are the discriminator: a zero-length 404 can only come from the Proxy
guard, not from a missing route.

---

## Deviations from Plan

### 1. [Rule 3 — Blocking] `proxy.ts` at the repository root is never registered by Next

- **Found during:** Task 2 verification, `npx next build`
- **Issue:** the plan states *"Create `proxy.ts` at the repository root (same level as `src/`)"*.
  With the file there, `next build` compiled it — `.next/server/middleware.js` even referenced
  the chunk containing the code — but **never registered it**. The build output printed no
  `Proxy` line, and `next start` served the apex placeholder for `Host: store1.einort.com`
  with `x-nextjs-prerender: 1`. The Proxy was simply not running.
- **Why:** Next's convention is root **or** inside `src/` — and in a project that has a
  `src/` directory, it must be inside `src/`, at the same level as `app/`. This project uses
  `src/app`, so the root file is dead code. `PROXY_LOCATION_REGEXP` in
  `next/dist/lib/constants.js` is `(?:src/)?proxy`, but the two locations are not
  interchangeable — the resolver picks the one matching the app directory layout.
- **Fix:** `git mv proxy.ts src/proxy.ts`, and updated the test's dynamic import path.
  After the move, `next build` prints `ƒ Proxy (Middleware)` and the live smoke table above
  passes.
- **Why this mattered more than a path nit:** every `must_haves` truth in this plan is
  enforced by the Proxy. At the repo root, all four unit-test suites still passed — they
  import the module directly — while the deployed application had **no** header stripping,
  **no** `/s/` guard and **no** hostname resolution. Green tests over a proxy that never runs
  is precisely the silent-failure mode this plan exists to prevent.
- **Files:** `src/proxy.ts`, `tests/unit/proxy.test.ts` · **Commit:** `75da251`

### 2. [Rule 1 — Bug] `unstable_doesProxyMatch` does not exist in `next@16.3.1`

- **Found during:** Task 2, writing the RED test
- **Issue:** the plan and RESEARCH.md Pattern 1 both name `unstable_doesProxyMatch` as an
  export of `next/experimental/testing/server`. It is not there. The module exports
  `unstable_doesMiddlewareMatch`, `unstable_getResponseFromNextConfig`, `constructRequest`,
  `getRedirectUrl`, `getRewrittenUrl` and `isRewrite` — verified directly against
  `node_modules/next/dist/experimental/testing/server/`. The rename to "Proxy" reached the
  file convention and the build output but not the testing helper.
- **Fix:** used `unstable_doesMiddlewareMatch`. It accepts `{ config, url }` and works
  unmodified against the Proxy's `config.matcher`.
- **Files:** `tests/unit/proxy.test.ts` · **Commit:** `ce2b27b`

### 3. [Rule 2 — Missing critical functionality] The unknown branch now forwards sanitised headers

- **Found during:** Task 2
- **Issue:** the plan's step 4 (and RESEARCH.md Code Example 5) writes the unknown branch as
  a bare `NextResponse.rewrite(new URL("/store-not-found", request.url))` with no
  `{ request: { headers } }`. Because the override-header mechanism *replaces* the forwarded
  request headers only when supplied, omitting it means the **original, unsanitised** headers
  reach `/store-not-found`. A forged `x-tenant-id` would survive on exactly that branch.
- **Why it matters:** this plan's own `must_haves` states *"A request arriving with a forged
  `x-tenant-id` … has that header stripped before any application code can read it"*, and the
  T-01-13 mitigation says *"on every proxy branch"*. `/store-not-found` is application code.
  Nothing reads those headers today, which is what makes it worth closing now rather than
  after something does.
- **Fix:** the sanitised `forward` object is passed to all three responding branches.
  `tests/unit/proxy.test.ts` asserts the strip on root, store, reserved **and** unknown.
- **Files:** `src/proxy.ts`, `tests/unit/proxy.test.ts` · **Commit:** `75da251`

### 4. [Plan correction] `nope.einort.com` rewrites into the storefront tree, not to `/store-not-found`

- **Found during:** Task 2, first GREEN run (the test failed as written from the plan)
- **Issue:** the plan's behavior table asserts `Host: nope.einort.com, path / -> rewrite to
  /store-not-found`. That cannot be right: `nope` is a well-formed slug, so `classifyHost`
  returns `{ kind: "store" }`. "Unknown" in this layer means *unclassifiable*, not
  *unclaimed* — whether a tenant named `nope` exists is a database question, and the Proxy
  does zero I/O by design.
- **Resolution:** the behaviour is correct; the expectation was wrong. `nope.einort.com`
  rewrites to `/s/nope`, and **plan 01-05's storefront layout** calls `notFound()` when the
  slug resolves to nothing, landing on the same branded body (D-04/D-05). The test now
  asserts that explicitly, with the reasoning in a comment, and the fail-closed cases use
  genuinely unclassifiable hosts (`a.b.einort.com`, `12345.einort.com`).
- **Action for plan 01-05:** unclaimed-hostname 404s are yours. This plan only guarantees
  that *malformed* hostnames never reach you.
- **Files:** `tests/unit/proxy.test.ts` · **Commit:** `75da251`

### 5. [Plan correction] The storefront root rewrite normalizes to `/s/store1`, not `/s/store1/`

- **Found during:** Task 2, first GREEN run
- **Issue:** the plan expects `Host: store1.einort.com, path / -> /s/store1/`. The code does
  set `url.pathname = "/s/store1/"`, but `NextURL` strips the trailing slash on
  stringification under the default `trailingSlash: false`.
- **Resolution:** cosmetic. Both forms resolve to `app/s/[slug]/page.tsx`. The test asserts
  the normalized form rather than fighting the framework, with a comment saying why.
- **Files:** `tests/unit/proxy.test.ts` · **Commit:** `75da251`

### 6. [Rule 2 — Missing critical functionality] Windows `next start` smoke check run early

- **Found during:** Task 2 verification
- **Issue:** not a deviation from the plan so much as a consequence of Deviation 1 — once the
  build was suspect, unit tests could not settle whether the Proxy actually runs, because
  they import the module directly and would pass either way.
- **Action:** ran the live `next build && next start` + `curl -H "Host: …"` check on this
  Windows 11 machine. Results are in the Verification section. The Proxy executes correctly
  under `next start` on Windows.
- **Bearing on T-01-20 / Pitfall 10:** this is an early, favourable data point for the
  Windows `next start` proxy regression (issue #85243) — it does **not** reproduce here on
  Next 16.3.1. **This does not discharge plan 01-07 T2/T3**, which must re-run the check
  against a real storefront route once `/s/[slug]` exists; today's run only proves the Proxy
  is invoked and rewrites, since both rewrite targets still 404 by design.

### 7. [Rule 3 — Blocking] Worktree had no `node_modules` and no env files

- **Found during:** setup
- **Issue:** the executor worktree is a fresh checkout — no `node_modules`, and `.env.local` /
  `.env.test` are gitignored so they do not exist there. Nothing could be run.
- **Fix:** `npm ci` (lockfile restore only — no package added, changed or resolved by name,
  so the package-legitimacy checkpoint does not apply; `package.json` and `package-lock.json`
  are untouched and uncommitted by this plan), then copied `.env.local` and `.env.test` from
  the main checkout with `cp -n`. Both remain gitignored and are absent from every commit.
- **Files:** none committed

### 8. [Reconciliation] `UP.einort.com` classifies as `unknown`, not as a store

- **Found during:** Task 1, writing the RED test
- **Issue:** the plan's behavior table says `"UP.einort.com" (after lowercasing this is
  valid; assert the lowercased form classifies as store)`, while RESEARCH.md's table lists
  `UP.einort.com` under `unknown`. Both cannot hold: `UP` lowercases to `up`, which is two
  characters and below the minimum.
- **Resolution:** followed RESEARCH.md — `UP.einort.com` → `{ unknown, "bad-length" }`. The
  plan's *intent* (prove case normalization happens before classification) is covered by a
  separate assertion: `UPSTORE.einort.com` → `{ store, "upstore" }`. Both are in the suite.
- **Files:** `tests/unit/host.test.ts` · **Commit:** `b7915d7`

### 9. [Rule 3 — Blocking] Module-scope narrowing of `process.env` does not reach the handler

- **Found during:** Task 2, `npx next build`
- **Issue:** `const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;` followed by a
  module-level `if (!ROOT_DOMAIN) throw` does **not** narrow to `string` inside
  `export function proxy` — TS2345, and the build's typecheck stage failed. Function
  declarations are hoisted, so control-flow analysis stays conservative across them.
- **Fix:** extracted `readRootDomain(): string`, which throws internally and returns a
  `string`. Same boot-time failure, no assertion, no non-null operator.
- **Files:** `src/proxy.ts` · **Commit:** `75da251`

---

## Authentication Gates

None. No task required credentials.

---

## Known Stubs

None in this plan's own files.

Both of the Proxy's rewrite targets — `/s/[slug]/…` and `/store-not-found` — 404 today
because **plan 01-05 owns them**. The plan's `<interfaces>` block states this explicitly
(*"Until plan 05 lands, both rewrite targets 404. That is expected and does not fail this
plan"*). This is a missing downstream route, not a stub: no placeholder was written, nothing
renders empty, and no user-facing surface in this plan is faked.

---

## Threat Flags

None. Every surface this plan adds is already in its own `<threat_model>` register, and the
plan is net-mitigating:

| Threat | Status |
|---|---|
| T-01-13 forged `x-tenant-id` / `x-store-slug` | mitigated on all four branches; asserted by `-t "strips"` (5 tests) |
| T-01-14 apex-reachable `/s/{slug}` | mitigated; asserted by `-t "internal prefix"` (4 tests) and confirmed live (zero-length 404) |
| T-01-15 `einort.com.evil.tld` suffix confusion | mitigated; explicit literal assertion in `host.test.ts` |
| T-01-16 `xn--` homograph | mitigated in both `classifyHost` and `storeSlugSchema` |
| T-01-17 merchant claiming `admin`/`api` | mitigated at the routing and format layers; write layer is plan 01-06's |
| T-01-18 merchant session cookie on a storefront subdomain | the `/s/` guard half is in place; `crossSubDomainCookies` enforcement is plan 01-06's |
| T-01-19 wildcard-scanner flood | mitigated for malformed hosts (rejected with zero I/O); negative caching and rate limiting are plan 01-05's |
| T-01-20 Windows `next start` proxy regression | early favourable evidence (Deviation 6); plan 01-07 T2/T3 still required |

---

## Notes for Downstream Plans

- **01-05:** `/s/[slug]/{layout,page}.tsx` and `/store-not-found` are yours, and the rewrite
  contract is `/s/{slug}{originalPathname}` with the query string preserved. Unclaimed
  well-formed hostnames arrive at your layout, not at `/store-not-found` (Deviation 4).
- **01-06:** import `RESERVED_SLUGS` and `storeSlugSchema` from `@/server/tenant/*` for the
  `beforeCreateOrganization` hook. Do not re-declare either — a second copy of the blocklist
  is the failure mode `reserved-slugs.ts` exists to prevent.
- **01-07:** render `SLUG_FORMAT_MESSAGE` and `SLUG_RESERVED_MESSAGE` from
  `@/server/tenant/host` rather than re-authoring the copy, and key the `reserved` status off
  the word "reserved" in the message as RESEARCH.md Code Example 3 does.

---

## Commits

| Commit | Task | Gate | Description |
|---|---|---|---|
| `b7915d7` | 1 | RED | Failing hostname-classification and slug-schema tests |
| `c0d8d5b` | 1 | GREEN | Reserved-slug blocklist, slug schema, pure `classifyHost` |
| `ce2b27b` | 2 | RED | Failing proxy internal-prefix, header-strip and rewrite tests |
| `75da251` | 2 | GREEN | Next 16 Proxy at `src/proxy.ts` |

TDD gate sequence satisfied for both tasks: `test(...)` precedes `feat(...)` in each pair, and
both RED runs were confirmed failing before implementation. No REFACTOR commit was needed.

---

## Self-Check: PASSED

All 7 claimed source/test files plus this SUMMARY exist on disk; all 4 claimed commit hashes
resolve in `git log`; `git ls-files | grep -c middleware.ts` returns 0; and the full unit
suite, lint, typecheck and `next build` were re-run green after the final `src/proxy.ts` move.

---

## Execution Environment Note

Executed in the worktree `.claude/worktrees/agent-aca6560025a5e384d` on branch
`worktree-agent-aca6560025a5e384d`, based on `64c4c96`. Per the orchestrator's instructions,
`STATE.md` and `ROADMAP.md` were **not** modified — those writes remain the orchestrator's.
All files were staged individually; `node_modules/`, `.env.local` and `.env.test` are
gitignored and appear in no commit.
