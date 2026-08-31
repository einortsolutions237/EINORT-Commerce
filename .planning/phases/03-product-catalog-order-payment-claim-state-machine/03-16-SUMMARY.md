---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 16
subsystem: testing
tags: [vitest, source-scanning, requirement-coverage, phase-gate, validation, eslint, typescript]

# Dependency graph
requires:
  - phase: 03-03
    provides: transitionOrder as the single writer of Order.state, and single-order-state-writer.test.ts as the source-scan idiom this plan reuses
  - phase: 03-04
    provides: dashboard-nav.test.ts, the gold-accent budget contract and the comment-stripping scan style
  - phase: 03-05
    provides: image-pipeline.test.ts and r2-key.test.ts (CAT-02's proof)
  - phase: 03-06
    provides: catalog.test.ts, product-limit.test.ts, variant-matrix.test.ts (CAT-01's proof)
  - phase: 03-07
    provides: stock-race.test.ts and checkout-trust.test.ts (CAT-03 and TEN-08's proof)
  - phase: 03-08
    provides: ussd.test.ts, whatsapp.test.ts, phone.test.ts (CHK-02 and CHK-03's automated half)
  - phase: 03-09
    provides: cart.test.ts and storefront-catalog.test.ts (CHK-01's proof)
  - phase: 03-10
    provides: order-state-chip.test.ts and order-actions.test.ts
  - phase: 03-11
    provides: product-form-contract.test.ts
  - phase: 03-12
    provides: checkout-paths.test.ts
  - phase: 03-13
    provides: claims.test.ts, claim-reference.test.ts and confirmClaim as the single confirmer of a PaymentClaim
  - phase: 03-14
    provides: order-status-copy.test.ts and the isolation tracking-token test (CHK-05 and CHK-04's proof)
  - phase: 03-15
    provides: claim-submission.test.ts
provides:
  - tests/unit/phase-03-requirement-coverage.test.ts — a build-failing assertion that every Phase 3 requirement's named proof exists and still asserts something
  - Three cross-plan structural invariants re-checked independently of the plans that introduced them (one Order.state writer, one claim confirmer, a two-file gold budget)
  - A resolved 03-VALIDATION.md — nyquist_compliant, no Wave-0 gap markers, the measured 720-test baseline, and every inherited research question recorded as answered
affects: [phase-04-templates, phase-05-storefront-polish, phase-06-admin-messaging]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The requirement→proof map as executable code rather than a document: renaming a test file fails the build in the same commit that broke the link, with the requirement's own text quoted at whoever renamed it"
    - "Positive controls on every source-scanning guard, so a drifted detector fails loudly instead of reporting 'no violations' over zero coverage"
    - "Cross-plan invariants re-asserted outside the plan that introduced them, because a late edit in an unrelated plan is exactly what breaks them"
    - "A matcher widened to the shape the code actually uses (variant: \"gold\" as well as variant=\"gold\") rather than the shape the plan predicted"

key-files:
  created:
    - tests/unit/phase-03-requirement-coverage.test.ts
  modified:
    - .planning/phases/03-product-catalog-order-payment-claim-state-machine/03-VALIDATION.md

key-decisions:
  - "existsSync alone is not proof — every named file is also checked for at least one it( or test( block after comments are stripped, because a file emptied to a stub during debugging is present, green, and proves nothing"
  - "Failure messages quote the requirement's verbatim text from REQUIREMENTS.md, not its id: an id is a lookup somebody has to go and perform, the sentence is what tells them whether the missing file mattered"
  - "The gold-budget matcher accepts variant: \"gold\" as well as variant=\"gold\" — the chip spends its gold in a state→appearance data row, so the plan's JSX-only pattern would have counted one file and called the two-use budget kept"
  - "CHK-03's it() block asserts that 03-VALIDATION.md still records the manual rows, which is what makes the test a real link to the document rather than a parallel copy of it — deleting the manual rows does not make the requirement automated, it makes it unproven"
  - "The three cross-plan invariants each carry a positive control asserting the SANCTIONED file still matches; without it, moving transition.ts would turn the guard into a green no-op"
  - "Order.state detection uses the call's parenthesis-matched argument window, not a line window — a line window both misses a data: object spread across a long argument list and flags an unrelated state: in the following statement"
  - "Task 3 was not attempted: it is a blocking human checkpoint requiring physical iPhone and Android hardware, and nothing in a test runner can stand in for what a real dialer does with a USSD tel: URI"

patterns-established:
  - "Phase-gate coverage test: one it() per requirement, plus one per cross-plan invariant, plus a positive control per scanner — the phase's claim about itself, executable"

requirements-completed: []

# Metrics
duration: ~55min
completed: 2026-08-31
---

# Phase 3 Plan 16: Phase Gate — Requirement Coverage and Validation Resolution Summary

**A build-failing test that maps all thirteen Phase 3 requirements to proof files that must exist and must still assert, three cross-plan invariants re-checked outside their owning plans, and a 03-VALIDATION.md that now states what is true — with the blocking real-device checkpoint deliberately left open.**

## Performance

- **Duration:** ~55 min (of which ~20 min was a single `npm run test:full` run against the remote Neon test branch)
- **Completed:** 2026-08-31
- **Tasks:** 2 of 3 executed — Task 3 is a blocking human checkpoint, out of scope for this executor by explicit instruction
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- **Every Phase 3 requirement now points at a proof the build checks.** `tests/unit/phase-03-requirement-coverage.test.ts` holds the thirteen requirement ids, their verbatim text from REQUIREMENTS.md, and the twenty-one test files that prove them. Renaming any one of those files fails this test with a message naming the file and quoting the requirement — verified by temporarily renaming `tests/unit/phone.test.ts` and confirming the failure read `CHK-03 has no proof: tests/unit/phone.test.ts is missing`, then restoring it.
- **A file that exists but asserts nothing is caught too.** `existsSync` is only half the check; each proof is also scanned (comments stripped) for at least one `it(` / `test(` block, which is the shape a stub left behind mid-debugging takes.
- **The three cross-plan invariants are guarded independently of their owning plans.** One writer of `Order.state` (`src/server/orders/transition.ts`), one confirmer of a `PaymentClaim` (`src/server/claims/actions.ts`), and gold spent in exactly the two budgeted files. Each carries a positive control asserting the sanctioned file still matches the detector, so a rename turns the guard red rather than vacuous.
- **All four gates ran on one commit.** `npm run test:full` — **720 passed, 0 failed, 0 skipped, 48 files** (against the inherited baseline of 250 across 19 files, so Phase 3 contributed 470 tests across 29 files). `npm run lint` exits 0 at `--max-warnings=0`. `npm run typecheck` exits 0. `grep` for `it.skip` / `describe.skip` / `test.skip` / `.only(` across `tests/` returns 0. No `eslint-disable` was added by this plan.
- **03-VALIDATION.md states facts instead of intentions.** `nyquist_compliant: true`, `wave_0_complete: true`, `status: complete`, zero `❌ W0` markers, the baseline corrected from 250 to the measured 720, every Wave 0 item ticked against a file confirmed on disk, and new `## Resolved Questions` and `## Resolved Assumptions` sections recording all five inherited research questions and both MEDIUM-risk assumptions with the plan that decided each.

## Task Commits

Each task was committed atomically:

1. **Task 1: The requirement-coverage test and the full gate run** — `03f3298` (test)
2. **Task 2: Resolve 03-VALIDATION.md and record the phase's decisions** — `7cd1ab7` (docs)

## Gate Numbers

| Gate | Command | Result |
|------|---------|--------|
| Full suite | `npm run test:full` | 720 passed, 0 failed, **0 skipped**, 48 files, 1204s |
| Quick suite | `npm run test:unit` | 442 passed, 26 files, 5.6s |
| Coverage test | `npx vitest run --project unit tests/unit/phase-03-requirement-coverage.test.ts` | 20 passed, 0 skipped (13 requirements + 1 inherited row + 3 invariants + 3 positive controls) |
| Lint | `npm run lint` | exit 0 at `--max-warnings=0` |
| Typecheck | `npm run typecheck` | exit 0 |
| Skips/onlys | `grep -rn "it.skip\|describe.skip\|test.skip\|\.only(" tests/ \| wc -l` | 0 |
| Production build | `npx next build` | **Not verifiable in this worktree** — see Deviations |

Inherited baseline was 250 passing / 19 files. Phase 3's contribution: **+470 tests, +29 files**, with the skip count still at zero.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The gold-budget matcher had to accept `variant: "gold"` as well as `variant="gold"`**

- **Found during:** Task 1
- **Issue:** The plan specifies the invariant as "`variant="gold"` appears in exactly two files under `src/`, `src/components/app-sidebar.tsx` and `src/components/order-state-chip.tsx`". In the shipped code only the sidebar spends gold as a JSX attribute; `order-state-chip.tsx:104` spends it as `variant: "gold"` in the state→appearance table. The plan's literal pattern would have matched one file and either failed spuriously or — worse, had it been written as an upper bound — reported the two-use budget as kept while only counting one.
- **Fix:** The matcher is `/\bvariant\s*[:=]\s*"gold"/`, and the assertion is two-sided: both budgeted files MUST spend gold (a use going missing is a signal disappearing from a queue a merchant works, not a saving), and no other file may.
- **Files modified:** `tests/unit/phase-03-requirement-coverage.test.ts`
- **Commit:** `03f3298`

**2. [Rule 3 - Blocking] Worktree environment setup before the gates could run at all**

- **Found during:** Task 1
- **Issue:** A fresh git worktree carries none of the gitignored build inputs. `npm run test:full` failed at `src/generated/prisma/client` (Prisma client not generated), then at `node_modules/server-only/empty.js` (the worktree's `node_modules` is an empty real directory, so `vitest.config.ts`'s worktree-root-relative alias resolved to nothing). `npm run typecheck` reported nine `Cannot find name 'PageProps' / 'LayoutProps'` errors purely because Next 16's generated `.next/types` did not exist yet.
- **Fix:** Ran `node scripts/prisma-generate.mjs` (the project's own postinstall hook), copied the `server-only` marker package into the worktree's `node_modules`, copied the gitignored `.env.test` / `.env.local` in from the main checkout, and ran `npx next typegen`. All four are local environment state; every one of those paths is gitignored, and `git status` confirmed the working tree stayed clean of them. No source file was changed to accommodate any of it.
- **Files modified:** none tracked
- **Commit:** n/a (environment only)

### Not Fixed — Reported

**3. `npx next build` cannot run inside a git worktree on this machine**

- **Found during:** Task 1
- **Issue:** `npx next build` fails before compiling anything: `Error: Could not find the Next.js package (next/package.json) — Resolved from: <worktree>/src/app — Filesystem root used for resolution: <worktree>`. Turbopack refuses to resolve outside the detected workspace root, and the worktree's `node_modules` is empty (Node itself resolves fine by walking up to the main checkout, which is why every other tool works). This is the known structural Turbopack/worktree interaction confirmed across multiple prior sessions in this project, not a code defect — the same failure surfaces as an "invalid symlink, points out of the filesystem root" error when `node_modules` is junctioned instead of empty. Both directions are blocked by the same workspace-root rule.
- **Why not fixed:** The only fixes available are a full `npm install` inside the worktree (minutes, and pointless for a directory about to be force-removed) or setting `turbopack.root` in `next.config.ts` — a permanent production-config change to work around a temporary sandbox, which is exactly the kind of gate-weakening this plan's threat register (T-03-84) forbids.
- **Standing evidence in its place:** `tsc --noEmit` exits 0 across the whole tree with Next's own generated route types present, `eslint . --max-warnings=0` exits 0, and 720 tests pass including the source-scanning contract tests that inspect the shipped `.tsx`/`.ts` sources directly.
- **Outstanding:** the plan's acceptance criterion — `npx next build` completes and lists `/api/upload/finalize` and `/api/upload/claim-finalize` as Node-runtime functions — must be checked on the merged main checkout. It is recorded as an open item in 03-VALIDATION.md § Validation Sign-Off.

### Pre-existing, not introduced

`grep -rn "eslint-disable" src tests` returns seven hits: five narrow
`// eslint-disable-next-line @next/next/no-img-element` (and one
`react-hooks/exhaustive-deps`) suppressions committed by 03-10, 03-11 and
03-15 for blob-URL and R2 previews, plus two that are text inside explanatory
comments in `src/server/db/enums.ts` and `model-inputs.ts`. None was added by
this plan — `git diff` for both of this plan's commits adds zero. The acceptance
criterion (no `eslint-disable` added by the gate) holds.

## Outstanding

### Task 3 — blocking human checkpoint, NOT attempted

Plan 03-16's third task is `<task type="checkpoint:human-verify" gate="blocking">`: a
real-device walkthrough of the three checkout paths on **an actual iPhone and an
actual Android handset**. It was deliberately not attempted, not simulated, and
is not marked done anywhere. Nothing in this summary should be read as evidence
that it passed.

It exists because two of its steps are physically outside a test runner's reach:
what Apple's Phone app does with a `tel:` URI containing `*` and `#` (it silently
refuses them, which is why iOS must render no dial button at all rather than a
dead one), and whether a real Android dialer receives the pre-filled MTN string
**including its trailing `#`** — a missing `#` is the Pitfall 9 encoding bug and
fails CHK-03 outright. The string builders are unit-tested and green; the
handsets are not.

The plan's walkthrough covers six sections — A. Merchant setup, B. WhatsApp path,
C. Manual transfer on an iPhone, D. Manual transfer on Android, E. The claim loop,
F. Anything that breaks — in `03-16-PLAN.md`'s `<how-to-verify>` block, which
should be handed to the user verbatim. Failures on step 10 (iOS renders a dial
button) or step 12 (missing trailing `#`) are CHK-03 failures and block the phase.

The plan's resume signal, verbatim:

> Type "approved" once steps A through E pass on both an iPhone and an Android handset, or describe exactly which step failed and on which device

### Also open

- `npx next build` on the merged main checkout (see Deviations #3), confirming `/api/upload/finalize` and `/api/upload/claim-finalize` are listed as Node-runtime functions.
- STATE.md and ROADMAP.md were deliberately not touched — this plan ran in an isolated worktree and those are the orchestrator's to update after merge.

## Known Stubs

None. This plan created one test file and resolved one planning document; it
introduced no application code, no placeholder data and no unwired component.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema change was
introduced. The one new file is a filesystem-and-source-text test in the `unit`
project that opens no socket and imports no application module.

## Self-Check: PASSED

- `tests/unit/phase-03-requirement-coverage.test.ts` — FOUND
- `.planning/phases/03-product-catalog-order-payment-claim-state-machine/03-VALIDATION.md` — FOUND (modified, `nyquist_compliant: true`, zero `❌ W0`)
- Commit `03f3298` — FOUND
- Commit `7cd1ab7` — FOUND
