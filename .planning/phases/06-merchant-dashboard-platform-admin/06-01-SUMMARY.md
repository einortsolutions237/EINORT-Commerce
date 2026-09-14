---
phase: 06-merchant-dashboard-platform-admin
plan: 01
subsystem: platform-admin-trust-boundary
tags: [admin, auth, access-control, bootstrap, d-05, d-06, adm-01]
requires:
  - better-auth organization/additionalFields config (src/server/auth/auth.ts, Phase 1)
  - User.platformRole column, input:false, NOT NULL default "merchant" (Phase 1)
  - adminDb + the src/server/admin/** ESLint fence (src/server/db/admin.ts, Phase 1)
  - ActionResult<T> (src/server/merchant/action.ts, Phase 2)
provides:
  - requireAdminContext() — the single gate in front of every /admin surface
  - AdminContext type ({ userId })
  - adminAction({ schema, handler }) factory
  - scripts/promote-admin.ts + npm run admin:promote
  - SignInMerchantResult.redirectTo (server-computed post-login destination)
affects:
  - every later Phase 6 plan that builds an /admin page or admin Server Action
  - src/app/login/login-form.tsx (now pushes a server-supplied path)
  - src/server/merchant/context.ts (new admin rung at the top of the ladder)
tech-stack:
  added: []
  patterns:
    - notFound()-on-every-rung identity gate (vs the merchant surface's redirect ladder)
    - type-only cross-zone import to share a result shape without runtime coupling
    - out-of-band CLI privilege bootstrap with a --yes confirmation gate
key-files:
  created:
    - tests/isolation/admin-access.test.ts
    - src/server/admin/context.ts
    - src/server/admin/action.ts
    - scripts/promote-admin.ts
  modified:
    - tests/unit/no-tenant-id-param.test.ts
    - src/server/auth/login.ts
    - src/app/login/login-form.tsx
    - src/server/merchant/context.ts
    - tests/isolation/login.test.ts
    - package.json
decisions:
  - "Every admin-identity failure is notFound(), never redirect() or 403 (D-06) — the anonymous and merchant refusals are byte-identical by construction"
  - "requireAdminContext() takes zero parameters, now enforced by an explicit assertion in tests/unit/no-tenant-id-param.test.ts rather than only by the generic tenant-id scan"
  - "adminAction drops merchantAction's mode axis and its EntitlementError/ReadOnlyError catch — both would be dead controls on a surface with no trial or plan"
  - "ADMIN_ROLE is duplicated across three modules rather than extracted to a shared constant, because the TEN-05 ESLint fence isolates src/server/admin/** in both directions"
  - "promote-admin.ts refuses any account holding an Organization membership (D-04), even with --yes, because that state has no clean unwind"
  - "Requirements ADM-01/ADM-04 deliberately NOT marked complete — this plan builds the gate, not the surface"
metrics:
  duration: ~1h 20m active (across two sessions; a rate-limit interruption sits between them)
  tasks-completed: 3
  tasks-total: 3
  files-created: 4
  files-modified: 6
  lines-added: 1107
  commits: 3
  completed: 2026-09-14
---

# Phase 6 Plan 01: Admin Trust Boundary Summary

The platform-admin gate exists and is un-enumerable: `requireAdminContext()` 404s every caller who is not the one promoted account, `adminAction()` wraps it for Server Actions, one committed script is the only way to mint that account, and login now resolves `/admin` vs `/dashboard` server-side.

## What Was Built

**`src/server/admin/context.ts`** — `requireAdminContext()`, parameterless and `React.cache()`-memoized. Two rungs (no session; `platformRole !== "admin"`), both calling `notFound()`. Returns `{ userId }` and nothing else — deliberately no `tenantId`, because the platform owner has no organization (D-04).

**`src/server/admin/action.ts`** — `adminAction({ schema, handler })`. Resolves identity before touching the payload, then Zod-parses, then dispatches. `ActionResult` is imported `import type` so no runtime edge crosses the TEN-05 zone fence.

**`scripts/promote-admin.ts`** — the only code path in the repository that writes `platformRole = "admin"`. Dry-run by default; `--yes` to commit; idempotent; refuses zero/multiple arguments, unknown flags, unknown emails, and any account that owns a store. Wired as `npm run admin:promote`.

**D-05 role routing** — `signInMerchant` re-reads the session after `signInEmail` succeeds and returns `{ ok: true, redirectTo }`. `login-form.tsx` pushes that value. `requireMerchantContext()` gained a belt-and-braces `/admin` rung *above* the `!tenantId` rung.

**Contract tests** — `tests/unit/no-tenant-id-param.test.ts` now scans `src/server/admin`, checks non-vacuity per-directory rather than in aggregate, and pins `requireAdminContext` to an empty parameter list. `tests/isolation/admin-access.test.ts` covers the three session classes plus the byte-identical-refusal assertion.

`/admin` 404s for everyone until plan 06-04 builds the shell. That is the correct intermediate state, per the plan's own `<done>`.

## Verification Status

| Gate | Result |
|------|--------|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test:unit` (40 files, 665 tests) | PASS |
| `promote-admin.ts` CLI guards (no arg / 2 args / bad flag / unknown email / D-04 refusal) | PASS, exit code 1 on each |
| D-03 check — no `/admin` link under `src/app/**` or `src/components/**` | PASS (only two server-side routing sites) |
| Task 1 RED state (module-not-found on `@/server/admin/context`) | PASS — verified before Task 2 |
| `tests/isolation/**` GREEN run | **BLOCKED — see below** |

### Blocked: the isolation suite could not be run to green

**This is the one open item in this plan and it needs a re-run before the phase gate.**

The Neon `einort-test` branch is being truncated by another process every few seconds, so the isolation suite cannot complete. Evidence gathered rather than assumed:

1. `tests/isolation/admin-access.test.ts` failed with `member_userId_fkey` / `session_userId_fkey` violations on rows Better Auth had *just* inserted.
2. The pre-existing, untouched `tests/isolation/merchant-context.test.ts` fails **identically** on this branch, which rules out my changes as the cause.
3. Decisive test: I inserted a sentinel `User` row and polled it while running nothing else. It was deleted within ~12 seconds. Repeated ~9 hours later — same result.

Because `seedTwoTenants()` opens with `TRUNCATE … CASCADE`, my runs were also destroying the other process's fixtures. I stopped running the suite rather than keep trading truncations.

**To close this, run (serially, when the branch is free):**

```
npx dotenv -e .env.test -- vitest run tests/isolation/admin-access.test.ts tests/isolation/login.test.ts tests/isolation/merchant-context.test.ts
```

Confirm `merchant-context.test.ts` passes first — if it still fails, the branch is still contended and the result says nothing about this plan's code.

### A note on worktree verification setup

A fresh GSD worktree has no `node_modules`, no `src/generated`, no `.next` and no `next-env.d.ts` (all gitignored), so `lint`/`typecheck`/`test` cannot run in it as-created. I junctioned those from the main checkout and copied `.env.local`/`.env.test` in. Without this, `typecheck` reports 15 phantom errors (`Cannot find name 'PageProps' | 'LayoutProps'`, `Cannot find module '@/assets/brand/einort-logo.png'`) that are purely missing generated artifacts. All junctions/copies are gitignored and none were committed. Worth fixing in the worktree spawn step — otherwise every parallel executor either skips its gates or silently reports those 15 errors as real.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tests/isolation/login.test.ts` asserted the old success shape**
- **Found during:** Task 3
- **Issue:** Two assertions read `expect(result).toEqual({ ok: true })`. Widening `SignInMerchantResult`'s success arm to carry `redirectTo` breaks both, and Task 3's acceptance criteria require that file to pass.
- **Fix:** Updated both to `{ ok: true, redirectTo: "/dashboard" }` — strictly stronger, since they now pin the merchant destination. Also added a `routes by role` test asserting **both** arms (owner → `/admin`, merchant → `/dashboard`) in one case, so an implementation that sent everyone to `/admin` could not pass.
- **Files modified:** `tests/isolation/login.test.ts`
- **Commit:** 644abe0

**2. [Rule 2 - Missing critical functionality] The parameterless contract was only partly enforced**
- **Found during:** Task 2
- **Issue:** The plan's `must_haves.truths` requires "the admin identity function takes zero parameters, enforced by a source-scanning test". Adding `src/server/admin` to `SCANNED_DIRS` only gets the generic scan, which matches three *tenant-id* spellings — `requireAdminContext(userId)` or `requireAdminContext(role)` would pass it while handing the caller exactly the authority the rule exists to withhold.
- **Fix:** Added an explicit assertion mirroring the existing `requireMerchantContext` one, pinning `requireAdminContext`'s parameter list to `""`.
- **Files modified:** `tests/unit/no-tenant-id-param.test.ts`
- **Commit:** 1b4f993

**3. [Rule 2 - Missing critical functionality] Aggregate non-vacuity check would not cover the new directory**
- **Found during:** Task 2
- **Issue:** The guard's anti-vacuous test asserted `scannedFiles.length > 0` across all directories combined. With three directories that stays comfortably non-zero even if one is emptied or renamed — so a newly-added zone could go silently uncovered, which is precisely the failure mode the test's own header says it must not have.
- **Fix:** Per-directory assertion, with the aggregate one kept.
- **Files modified:** `tests/unit/no-tenant-id-param.test.ts`
- **Commit:** 1b4f993

### Non-code Deviation

**4. Worktree branch was 32 commits stale**
- The worktree spawned on `d302801` (Phase 05.3 completion), which predates the entire `.planning/phases/06-*` directory — the plan file did not exist in the worktree. HEAD assertion passed (correct `worktree-agent-*` namespace), the tree was clean, and `d302801` was a strict ancestor of `master`, so I fast-forwarded with `git reset --hard master` before starting. No local commits existed to lose.

### Requirements Not Marked Complete

`ADM-01` ("Platform owner can view and suspend merchants/stores") and `ADM-04` (admin scope discipline) are in this plan's frontmatter but are **not** marked complete in `REQUIREMENTS.md`. This plan builds the gate; neither viewing nor suspending exists yet, and both requirements span later plans in the phase. Marking them now would be false.

## Threat Model Coverage

| Threat ID | Disposition | Where it landed |
|-----------|-------------|-----------------|
| T-06-01 | mitigated | `notFound()` on both rungs of `context.ts`; identical-digest assertion in `admin-access.test.ts` (**assertion not yet executed — see Blocked**) |
| T-06-02 | mitigated | `input: false` untouched; `promote-admin.ts` is the only writer, outside the request path |
| T-06-03 | mitigated | `--yes` gate, target printed before writing, D-04 membership refusal — all three exercised against a real account |
| T-06-04 | mitigated | `no-tenant-id-param.test.ts` extended in the same commit as the modules, plus the explicit zero-parameter assertion |
| T-06-05 | accepted | No new limiter; omission stated in `context.ts`'s header with the reasoning |
| T-06-SC | mitigated | Zero packages installed. `package.json` `dependencies`/`devDependencies` are byte-identical to the base commit; the only change is one `scripts` entry |

## Known Stubs

None. Every module in this plan is fully wired. `/admin` returning 404 is the specified behaviour of this plan, not a stub — no route file was created for it.

## Self-Check: PASSED

Created files:
- FOUND: `tests/isolation/admin-access.test.ts`
- FOUND: `src/server/admin/context.ts`
- FOUND: `src/server/admin/action.ts`
- FOUND: `scripts/promote-admin.ts`

Commits:
- FOUND: `32f8033` test(06-01): add failing admin access-control isolation test
- FOUND: `1b4f993` feat(06-01): add the admin trust boundary
- FOUND: `644abe0` feat(06-01): owner bootstrap script and D-05 role-aware post-login routing

## For the Next Plan

- Call `requireAdminContext()` in **every** `/admin/**` `page.tsx`, not only the layout (Pitfall 9). `React.cache()` makes the duplicate free.
- The admin surface looks at one store by passing an id to a **query**, never to `requireAdminContext()`. The contract test will fail the build otherwise.
- `src/server/admin/**` may not import `tenant-scoped.ts`. Pitfall 3 (reusing `transitionOrder`/`stock.ts` from the admin zone) is still an open integration risk and is unaffected by this plan.
- Before the phase gate, the admin account must actually be minted and used once: `npm run admin:promote -- <email> --yes` against a **fresh account with no store**, then sign in and confirm the `/admin` destination.
