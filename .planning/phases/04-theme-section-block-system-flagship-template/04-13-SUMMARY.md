---
phase: 04-theme-section-block-system-flagship-template
plan: 13
subsystem: theming-tests
tags: [isolation-tests, tenant-isolation, publish-atomicity, entitlements, onboarding, vitest, prisma]

# Dependency graph
requires:
  - phase: 04-theme-section-block-system-flagship-template
    provides: StorefrontTheme / StorefrontPage fixtures + Organization.industry (04-01), pageDocumentSchema / themeTokensSchema (04-02), assertCanEditStorefront + EditorLockedError (04-03), flagshipDefaultDocument / flagshipDefaultTokens / isIndustrySegment (04-06), saveDraft / publishStorefront / discardDraft / ensureStorefrontSeeded / saveBranding / getEditorStorefront (04-09)
  - phase: 01-tenant-foundations
    provides: scopedDb, platformDb, seedTwoTenants + TENANT_A / TENANT_B fixed fixture ids, the isolation Vitest project
  - phase: 02-plan-trial-entitlements
    provides: merchantAction / ActionResult, resolveEntitlements, the plan-selection.test.ts session harness
provides:
  - tests/isolation/storefront-editor.test.ts — publish atomicity, refused-publish immutability, draft/published separation, discard-overwrites, cross-tenant refusal, EDIT-03 tier refusal, seed idempotency
  - tests/isolation/branding.test.ts — ONB-04 live-on-return, seed idempotency, non-clobbering second submission, forged-payload rejection, Organization.logo alarm
affects:
  - 04-14 / phase close (these two suites are the evidence 04-VALIDATION.md's Per-Task Verification Map points at for EDIT-02, EDIT-03, ONB-02, ONB-04)
  - any future change to src/server/theming/actions.ts (both suites fail loudly if the upsert halves, the publish transaction, or the entitlement gate move)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "beforeAll(seedTwoTenants) + a narrow per-test restore of the shared victim's columns, instead of a per-test truncate — the posture merchant-context.test.ts established for session-bearing isolation files"
    - "Proving an entitlement gate by DIRECT INVOCATION with a real session, never a hand-written context object: the refusing state is built the way production reaches it (Starter + expired trial + subscriptionStatus active) so canWrite stays true and only the editor gate can refuse"
    - "Non-vacuity assertions paired with every negative: the acting tenant's own row is asserted to HAVE moved before the victim is asserted unchanged, so a write that silently no-oped cannot pass as isolation"
    - "Writing an invalid document straight through scopedDb to simulate an older registry, because the action's own schema would refuse the payload before it landed"

key-files:
  created:
    - tests/isolation/storefront-editor.test.ts
    - tests/isolation/branding.test.ts
  modified: []

key-decisions:
  - "Both suites reuse the existing session harness (plan-selection.test.ts) rather than vi.mock-ing @/server/merchant/context — option (b) of the plan's two. With the real DAL in the loop the tenant is one Better Auth derived from a signed cookie and canEditStorefront is one resolveEntitlements actually computed, so the tier-refusal test cannot pass by asserting that a hand-written false is false"
  - "The EDIT-03 fixture sets subscriptionStatus: 'active' alongside an expired trial deliberately — that keeps canWrite TRUE so merchantAction's read-only gate lets the call through and assertCanEditStorefront is unambiguously what refuses. An expired-and-unsubscribed merchant would be refused a step earlier and the test would pass without EDIT-03 existing"
  - "The refused-publish case asserts `rejects.toThrow()`, not a failed ActionResult: merchantAction converts only ReadOnlyError and EntitlementError, and a ZodError must stay an error visible in logs rather than be laundered into a fake validation message"
  - "The forged-tenantId assertion is that the call SUCCEEDS on the acting tenant, not that it fails — rejecting unknown keys would make the defence depend on enumerating every name an attacker might try, where stripping them makes retargeting unrepresentable"
  - "Organization.logo and tenant B's industry are parked on distinguishable sentinel values before the action runs, because asserting NULL stayed NULL would pass just as well if the column had been dropped"
  - "beforeAll + targeted restore rather than beforeEach(seedTwoTenants): merchant-context.test.ts records that repeated truncate-in-transaction reseeds in a session-bearing file intermittently fail with 'Unable to start a transaction in the given time' while a second pool is live for prismaBase"

patterns-established:
  - "A 'how to read a failure here' header on every cross-tenant isolation file, naming the production severity of the failure so it is not re-run until green"
  - "Failure messages that name the rule, why it matters, and the tempting wrong fix — notably that the strict parse on publish vs safeParse on read is deliberate and must not be 'made consistent'"

requirements-completed: [EDIT-02, EDIT-03, ONB-02, ONB-04]

# Metrics
duration: ~85min (including three full-suite runs, two lost to a transient Neon outage)
completed: 2026-09-03
---

# Phase 4 Plan 13: Storefront Editor and Branding Isolation Suites Summary

Two `isolation` suites that prove, against the real Neon test branch, that publishing is atomic and refuses a draft the current registry cannot parse, that no theming path crosses a tenant boundary, and that branding seeding is idempotent and non-destructive.

## What Was Built

### Task 1 — `tests/isolation/storefront-editor.test.ts` (9 tests, commit `ca4f9d9`)

| Behaviour | What it pins |
|---|---|
| Publish atomicity | `storefrontPage.published` and `storefrontTheme.publishedTokens` both move, and both carry the **same** `publishedAt` — two different timestamps mean publish stopped being one transaction over two rows |
| Refused publish (T-04-12) | An unparseable document written straight through `scopedDb` makes `publishStorefront` throw, and `published` / `publishedAt` are byte-identical afterwards |
| `saveDraft` separation | Draft columns move, `draftUpdatedAt` advances, both published halves are byte-identical |
| `discardDraft` (D-08) | Draft reverts to published and the page **row still exists with the same id** — the "still there, just reverted" shape `storefront-catalog.test.ts` uses for a deactivated product |
| Cross-tenant write (T-04-06) | Tenant B's page and theme read back through `scopedDb(TENANT_B.id)` are unchanged field by field, after the acting tenant's own row is asserted to have moved |
| Cross-tenant read | `getEditorStorefront(TENANT_A.id)` never contains tenant B's marker, with tenant B's own read asserted to contain it first |
| Tier refusal ×2 (T-04-05) | `saveDraft` and `publishStorefront` both refused by direct invocation for a post-trial Starter merchant, neither column changed |
| Seed idempotency | Two `ensureStorefrontSeeded` calls leave one theme row and one page row, and never clobber an edited draft |

### Task 2 — `tests/isolation/branding.test.ts` (8 tests, commit `be5b6ee`)

| Behaviour | What it pins |
|---|---|
| ONB-04 live on return | From zero rows, one submission leaves `publishedTokens` and `published` non-null with `publishedAt` set on both, carrying the merchant's own accents |
| Idempotency | Two submissions leave exactly one theme row and one page row |
| Non-clobbering re-submit (T-04-31) | The second submission's accents reach `publishedTokens` **while** an edited page `draft` survives — the asymmetry between the theme upsert's populated `update` and the page upsert's `update: {}` |
| ONB-02 persistence | `Organization.industry` and the confirmed name read back through `platformDb` |
| Closed-set refusal | `"fashion"` (the near miss for `"fashion-apparel"`) is refused and nothing is written |
| Hex refusal | `"red"` and `"#FFF"` both refused, nothing written |
| Forged payload (T-04-04) | An extra `tenantId` / `organizationId` naming tenant B is **stripped, not honoured** — the write lands on the acting tenant, and tenant B's industry, tokens and row counts are unchanged |
| Logo alarm (T-04-10) | `Organization.logo` is byte-identical across a submission carrying a `logoKey`, while `StorefrontTheme.logoKey` holds the value |

## Verification

| Check | Result |
|---|---|
| `npx vitest run --project isolation tests/isolation/storefront-editor.test.ts` | 9 passed |
| `npx vitest run --project isolation tests/isolation/branding.test.ts` | 8 passed |
| `npm run test:full` | **exit 0** — 56 files, 882 tests, 0 failed, 0 skipped |
| `tenant-isolation.test.ts` + `model-registry-drift.test.ts` re-run | 2 files, 131 passed |
| `npm run lint` (`--max-warnings=0`) | exit 0 |
| `npm run typecheck` | exit 0 |
| `grep -c "randomUUID\|Math.random"` on both files | 0 / 0 |
| `grep -c "vi.mock.*tenant-scoped\|vi.mock.*db/base\|vi.mock.*db/platform"` on both files | 0 / 0 |

## Deviations from Plan

**None affecting content.** Both files were written to the plan's `<behavior>` and `<action>` specifications, and both took option (b) of the plan's invocation choice (reuse the existing session harness rather than mock the merchant context), which the plan marked as preferred where the helper exists — it does, in `plan-selection.test.ts`.

Two process notes:

1. **Execution was resumed mid-plan.** A previous executor instance was killed by an API rate limit after writing Task 1's file but before verifying or committing it. That file was read back in full, checked against the Task 1 acceptance criteria, and run for real rather than rewritten — it passed on the first run with no changes needed. Task 2 was written from scratch.
2. **`.next/types` was restored** by copying it from the main checkout. It is gitignored build output, not tracked content, and `npm run typecheck` needs it. Nothing tracked was modified.

## Issues Encountered

**A transient Neon outage cost two full-suite runs.** The first `npm run test:full` reported 6 files failing with `Can't reach database server at ep-sweet-shape-za5xwdvh…`; the second failed in `globalSetup` with `A rollback cannot be executed on an expired transaction… 193263 ms passed` — the seed transaction, which normally lands around 6 s, took over three minutes.

Diagnosed rather than retried blindly: a direct `pg` probe against `TEST_DATABASE_URL` returned in 1293 ms with 20 public tables and 12 backends, confirming the branch was healthy again and that the failures were infrastructure, not test logic. Every failure in both runs was a connection or transaction-timeout error inside `seedTwoTenants`; there was not a single assertion failure. The third run went green at 56/56 files and 882/882 tests.

No code or test change was made in response — there was nothing to fix. Worth knowing for the phase's remaining plans: the isolation suite runs ~25 minutes end to end against a remote Neon branch, and a cold or throttled compute surfaces as a scattering of unrelated-looking seed failures rather than as an obvious outage.

## Known Stubs

None. Both suites exercise the real database, the real Better Auth session path, and the real `scopedDb` / `platformDb` clients. Only `next/headers`, `next/cache` and the two rate limiters are substituted, each documented in the file headers with the reason.

## Self-Check

- `tests/isolation/storefront-editor.test.ts` — FOUND
- `tests/isolation/branding.test.ts` — FOUND
- `.planning/phases/04-theme-section-block-system-flagship-template/04-13-SUMMARY.md` — FOUND
- commit `ca4f9d9` — FOUND
- commit `be5b6ee` — FOUND

## Self-Check: PASSED
