---
phase: 02-merchant-auth-entitlements-trial
plan: 06
subsystem: auth
tags: [better-auth, organization-plugin, entitlements, seat-limits, raw-endpoint-hardening]

# Dependency graph
requires:
  - phase: 02-01
    provides: PLANS registry, memberLimitFor, isPlanTier, the plan/trial additionalFields on organization
  - phase: 02-03
    provides: strings.entitlements.memberLimitReached, strings.dashboard.renameUnsupported/deleteUnsupported, signUpMerchant harness
  - phase: 02-04
    provides: the raw-Request-against-route-handler isolation test pattern (login.test.ts)
provides:
  - membershipLimit as a function reading memberLimitFor, closing the /organization/add-member and /organization/accept-invitation seat gap
  - beforeCreateInvitation hook closing the /organization/invite-member seat gap (the one call site membershipLimit does not cover)
  - beforeUpdateOrganization hook refusing any incoming slug on /organization/update
  - beforeDeleteOrganization hook refusing /organization/delete unconditionally
  - tests/isolation/entitlements.test.ts and tests/isolation/org-endpoints.test.ts exercising all of the above through real Request objects against the Better Auth apex handler
affects: [phase-04-storefront-rename-flow, phase-06-platform-admin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "organizationHooks throw-or-void discipline: every hook throws APIError or returns nothing, never a data object, because the plugin re-spreads returned data over the request/insert payload"
    - "membershipLimit in function form (never a numeric literal) to stay immune to Better Auth's `membershipLimit || 100` falsy-coalescing trap on a Starter cap of 1"
    - "seat/invitation counting via Promise.all(platformDb.member.count, platformDb.invitation.count) scoped to pending status, so queued invitations count against the same cap as accepted members"

key-files:
  created:
    - tests/isolation/entitlements.test.ts
    - tests/isolation/org-endpoints.test.ts
  modified:
    - src/server/auth/auth.ts

key-decisions:
  - "beforeAddMember was NOT added. Verified directly against node_modules/better-auth/dist/plugins/organization/routes/crud-members.mjs (the /organization/add-member seat check already calls membershipLimit) and crud-org.mjs (organization creation never calls membershipLimit at all), so the creator path was never at risk and no additional guard was needed beyond membershipLimit + beforeCreateInvitation."
  - "beforeUpdateOrganization refuses rather than validates any incoming slug, because a real rename needs a StoreSlugHistory row, a releasedAt stamp, and invalidateTenantHost on both hostnames — none of which exist until Phase 4 — so a half-done rename through the raw endpoint is worse than a refused one."
  - "beforeDeleteOrganization refuses unconditionally; V1 ships no store-deletion UI, so the raw endpoint is a self-inflicted DoS hole with no product surface behind it."
  - "remove-member, update-member-role and leave were reviewed and deliberately left ungated (T-02-37, disposition accept) — recorded in a comment in auth.ts so the omission reads as a decision, not an oversight."

patterns-established:
  - "Any new organizationHooks entry must state, in its comment, which raw endpoint(s) it gates and the exact node_modules source line(s) verifying the call site — future hooks should keep citing the library source rather than trusting training-data assumptions about Better Auth's internals."

requirements-completed: [SUB-01, SUB-02]

# Metrics
duration: 13min (this session; ~4h13m wall-clock including a mid-plan session interruption, see Issues Encountered)
completed: 2026-08-23
---

# Phase 02 Plan 06: Close the raw organization-endpoint write surface Summary

**Better Auth's `organizationHooks` now gate all four previously-ungated raw `/api/auth/organization/*` endpoints (add-member/accept-invitation via a function-form `membershipLimit`, invite-member via `beforeCreateInvitation`, update via `beforeUpdateOrganization`, delete via `beforeDeleteOrganization`), closing the second entry point a Server Action wrapper could never intercept.**

## Performance

- **Duration:** ~13 min of active execution in this resumed session (Task 2 verification/commit + Task 3 implementation/verification/commit); the plan's first commit (Task 1, RED tests) was made in a prior session ~4h13m earlier before an API session limit interrupted execution
- **Started:** 2026-08-23T10:29:00Z (this session's resumption point)
- **Completed:** 2026-08-23T10:43:00Z
- **Tasks:** 3/3 completed
- **Files modified:** 3 (`src/server/auth/auth.ts`, `tests/isolation/entitlements.test.ts`, `tests/isolation/org-endpoints.test.ts`)

## Accomplishments
- Seat limits (1/4/11, owner inclusive) are now enforced at the Better Auth layer itself — the layer every raw HTTP call to `/organization/add-member`, `/organization/accept-invitation`, and `/organization/invite-member` actually passes through — reading the same `memberLimitFor`/`PLANS` registry the rest of the codebase reads, so there is exactly one source of truth for the numbers.
- `/organization/update` and `/organization/delete`, previously live and completely ungated, now refuse a slug change and any deletion respectively, with the refusal reasons tied to concrete future-phase work (slug-history/host-cache invalidation) rather than left as unexplained restrictions.
- Two new isolation suites drive every assertion through real `Request` objects against the exported `/api/auth/[...all]` route handler and assert on both the HTTP response and the resulting database rows — proving the gates hold at the actual entry point, not just in application code that a raw HTTP call could bypass.
- `signUpMerchant` and the full inherited Phase 1/2 suite (250 tests, 19 files, 0 skipped) remain green, confirming the owner's own membership row during organization creation was never at risk.

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing isolation tests against the raw organization endpoints** - `f365a54` (test) — committed in the prior session before the interruption
2. **Task 2: Seat limits at the Better Auth layer** - `0ef1e02` (feat)
3. **Task 3: Close the ungated organization update and delete endpoints** - `f5b0205` (feat)

**Plan metadata:** (this commit, made immediately after this summary)

## Files Created/Modified
- `tests/isolation/entitlements.test.ts` - Starter/business/no-plan seat-limit coverage against the real `/organization/add-member` endpoint
- `tests/isolation/org-endpoints.test.ts` - update/delete/invite refusal coverage plus a full-signup-still-works regression, all against real `Request` objects
- `src/server/auth/auth.ts` - `membershipLimit` (function form), `beforeCreateInvitation`, `beforeUpdateOrganization`, `beforeDeleteOrganization` added to the existing `organizationHooks` block; imports added for `strings`, `platformDb`, `memberLimitFor`

## Decisions Made
- Confirmed by direct inspection of `node_modules/better-auth/dist/plugins/organization/routes/{crud-members,crud-invites,crud-org}.mjs` (not from training-data assumptions) that:
  - `membershipLimit` is consulted only at `crud-members.mjs:62` (`/organization/add-member`) and `crud-invites.mjs:275` (`/organization/accept-invitation`) — never at invitation creation, which is why `beforeCreateInvitation` is a separate, required hook.
  - Organization creation (`crud-org.mjs`) calls `adapter.createMember` directly with no `membershipLimit` check at all, and `beforeAddMember` fires for the owner's own row during `/organization/create` as well as for `/organization/add-member` — but since the seat check itself never runs during creation, no `beforeAddMember` guard was needed to protect the creator path. This matches the plan's "add it only if a guard is genuinely needed beyond `membershipLimit`" instruction — no guard was needed, so none was added.
- `beforeUpdateOrganization` checks `"slug" in organization && organization.slug !== undefined` against `ctx.body.data` (verified via `crud-org.mjs` lines ~211-224 that the hook receives the incoming patch as `organization`, not the existing row) rather than checking truthiness alone, so an explicit `slug: undefined` in the patch is not mistaken for an attempted rename.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a typecheck error in `beforeCreateInvitation`'s `memberLimitFor` call**
- **Found during:** Task 2 verification (`npm run typecheck`)
- **Issue:** `memberLimitFor` expects `{ planTier?: string | null }`, but the `organization` object Better Auth hands to `beforeCreateInvitation` is typed as the full organization row plus `Record<string, any>`, which TypeScript could not structurally match to the narrower parameter type (`TS2559: has no properties in common with type '{ planTier?: string | null }'`).
- **Fix:** Applied the same `organization as unknown as { planTier?: string | null }` cast already used for `membershipLimit`'s call to the same function, for consistency.
- **Files modified:** `src/server/auth/auth.ts`
- **Verification:** `npm run typecheck` exits 0; `tests/isolation/entitlements.test.ts` and `tests/isolation/signup.test.ts` re-run green (25/25) after the fix.
- **Committed in:** `0ef1e02` (Task 2 commit — the fix was made before the commit, so it is not a separate commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for the plan's own Task 2 acceptance criteria (`npm run typecheck` exit 0). No scope creep — same cast pattern the plan's own code already established one line above.

## Issues Encountered
The previous executor session hit an API session limit mid-plan, after committing Task 1 (RED tests, `f365a54`) and after writing but not yet verifying or committing Task 2's `auth.ts` changes (`membershipLimit` function and `beforeCreateInvitation` hook). This session resumed from that exact worktree state: the uncommitted `auth.ts` diff was reviewed line-by-line against the plan's acceptance criteria and the cited `node_modules/better-auth` source files before trusting it, one typecheck-blocking issue was found and fixed (see Deviations above), and execution proceeded through Task 2's commit and all of Task 3 without further incident.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SUB-01 (seat limits) and SUB-02 ("checked on every relevant write") are now enforced at both the Server Action layer (prior plans) and the raw Better Auth HTTP layer (this plan) — the two layers read the same `PLANS`/`memberLimitFor` registry, so they cannot drift.
- The `beforeUpdateOrganization` refusal is explicitly a placeholder pending Phase 4's slug-rename flow (`StoreSlugHistory`, `releasedAt`, `invalidateTenantHost`); Phase 4 should replace the blanket refusal with the real flow rather than simply removing the hook.
- `remove-member`, `update-member-role` and `leave` remain deliberately ungated (T-02-37); any future phase that gives those endpoints new consequences (e.g. a role that carries elevated permissions) should revisit that decision explicitly rather than assume it was reviewed under new requirements.

---
*Phase: 02-merchant-auth-entitlements-trial*
*Completed: 2026-08-23*

## Self-Check: PASSED

All claimed files found on disk (`tests/isolation/entitlements.test.ts`, `tests/isolation/org-endpoints.test.ts`, `src/server/auth/auth.ts`, this SUMMARY.md) and all three task commit hashes (`f365a54`, `0ef1e02`, `f5b0205`) found in `git log --all`.
