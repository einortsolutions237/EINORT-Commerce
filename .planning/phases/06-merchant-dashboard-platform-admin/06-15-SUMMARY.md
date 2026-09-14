---
phase: 06-merchant-dashboard-platform-admin
plan: 15
subsystem: subscription-payment-claims-merchant-half
tags: [sub-03, claims, subscription, manual-transfer, gold-budget]

requires:
  - phase: 06-merchant-dashboard-platform-admin (plan 03)
    provides: "SubscriptionPaymentClaim model (prisma/schema.prisma), globally-unique referenceNormalized, Organization.subscriptionCurrentPeriodEnd"
  - phase: 06-merchant-dashboard-platform-admin (plan 06)
    provides: "postSystemMessage(tenantId, body, { subscriptionClaimId, tx }) — the automated-notice primitive this plan's receipt message calls"
  - phase: 06-merchant-dashboard-platform-admin (plan 11)
    provides: "requestThreadAttachmentUpload / /api/upload/thread-finalize — the 'subscriptions' upload kind and the thread image preset this dialog's receipt field reuses"
provides:
  - "src/server/subscription/claims.ts — submitSubscriptionPaymentClaim / latestSubscriptionClaimFor, the ONLY module that creates a SubscriptionPaymentClaim"
  - "src/server/subscription/actions.ts — submitSubscriptionPayment, the mode:\"read\" merchantAction"
  - "src/components/subscription-claim-card.tsx — the read-only claim card, reusable from /dashboard/plan and (plans 06-12/06-16) both support threads"
  - "src/app/(dashboard)/dashboard/plan/submit-payment-dialog.tsx — SUB-03's submit form"
affects: ["06-16 (the platform owner's confirm/reject side at /admin/subscriptions, extending tests/isolation/subscription-claims.test.ts with the review/idempotency cases)", "06-12 (inline SubscriptionClaimCard rendering in both support threads, once a SYSTEM message carries subscriptionClaimId)"]

tech-stack:
  added: []
  patterns:
    - "Writer/reviewer module split by trust boundary (src/server/subscription/claims.ts creates, plan 06-16's src/server/admin/subscription-claims.ts will be the only module that changes status) — the same split src/server/claims/submit.ts and src/server/claims/actions.ts already establish for the sibling customer-facing claim."
    - "merchantAction mode:\"read\" chosen deliberately for a write-shaped action, documented at length in actions.ts's header, because the action being gated is the one that restores canWrite — a mode:\"write\" gate would refuse exactly the merchant who needs it (T-06-78)."
    - "Optimistic post-success render from the action's own return value (no extra database read), reconciled by a background router.refresh() for the one field a client component cannot resolve itself (the receipt image's public URL, since publicUrlFor is server-only)."
    - "A genuinely cross-surface component (subscription-claim-card.tsx, used by both the merchant dashboard and — in 06-12/06-16 — the platform admin support thread) keeps its own small Intl formatters rather than importing either surface's own dashboard/orders/format.ts or admin/format.ts, generalizing the 'admin and merchant route trees do not reach into each other's formatters' convention admin/format.ts's own header states."
  removed: []

key-files:
  created:
    - "tests/isolation/subscription-claims.test.ts"
    - "src/server/subscription/claims.ts"
    - "src/server/subscription/actions.ts"
    - "src/components/subscription-claim-card.tsx"
    - "src/app/(dashboard)/dashboard/plan/submit-payment-dialog.tsx"
  modified:
    - "src/server/db/model-inputs.ts"
    - "src/app/(dashboard)/dashboard/plan/page.tsx"
    - "src/app/(dashboard)/dashboard/plan/plan-switch-form.tsx"

key-decisions:
  - "merchantAction mode for submitSubscriptionPayment is \"read\", not \"write\" — the plan's own Task 2 text required this decision be made explicitly and documented, not defaulted. Reasoning: canWrite = subscribed || !expired (src/server/entitlements/resolve.ts); an expired-trial, unsubscribed merchant is exactly the merchant who needs to submit a payment, and paying is the action meant to restore write access. A mode:\"write\" gate would refuse that merchant before their input was even parsed (T-06-78). mode:\"read\" still runs every requireMerchantContext() identity check (unauthenticated/suspended callers never reach the handler) — it only skips the canWrite gate, which is correct here because submitting a claim writes a claim ABOUT restoring access, not the catalog/order/storefront state D-08's read-only trial protects."
  - "receiptKey/actorUserId added to submitSubscriptionPaymentClaim's parameter shape beyond the plan's literal '{ tenantId, actorUserId, operator, reference, planTier }' listing. receiptKey is necessary (Rule 2): the schema column exists and Task 3's dialog needs somewhere to persist an uploaded receipt's derivative prefix — omitting it would silently make the receipt-image half of SUB-03 unimplementable. actorUserId is accepted (matching the plan's literal signature) but deliberately NOT destructured/used in the writer body: SubscriptionPaymentClaim has no submittedByUserId column (only reviewedByUserId, the reviewer's identity) — documented at length in the parameter's own doc comment so a future column has an obvious place to wire, without an unused-variable lint violation today."
  - "The platform's own MoMo/Orange-Money receiving number is derived from strings.trial.contactUrl (the single real, monitored contact number this codebase already treats as copy, not configuration) rather than introducing a second, independently-maintained number. No such number existed anywhere in the codebase or env schema before this plan; inventing an unrelated one would risk drifting from the one number the business actually monitors."
  - "The payment CTA/claim-card region is rendered inside the CURRENT tier's card in BOTH /dashboard/plan branches (the in-trial PlanSwitchForm grid and the expired-trial static grid) via one paymentSection value computed once in page.tsx and threaded into PlanSwitchForm through a new optional currentPlanExtra prop — rather than duplicating the three-state (trigger / pending-card / rejected-card) decision logic in two places."
  - "An expired-trial merchant can submit a claim with NO receipt image. requestThreadAttachmentUpload (mint) and /api/upload/thread-finalize (finalize) — both built in plan 06-11, unmodified here — are mode:\"write\"/canWrite-gated by design (D-08 already blocks the general support-thread attach affordance for this population). Rather than loosening that unrelated gate (a Rule-4 architectural change out of this plan's scope), the claim schema's already-nullable receiptKey absorbs the gap: the operator+reference half of the claim is always submittable, the photo is optional and may simply be unavailable to an expired merchant until they resubscribe."

requirements-completed: []

duration: ~2h10min (task work; additional ~10min worktree setup — fast-forward, npm install, prisma generate, env copy)
completed: 2026-09-14
---

# Phase 06 Plan 15: Subscription Payment Claim — Merchant Half Summary

A merchant can now submit proof of their monthly subscription payment (operator, transaction reference, optional receipt image) from `/dashboard/plan`; the claim and its `SYSTEM` receipt message land in the same transaction in their support thread, the reference is globally unique with a byte-identical cross-tenant refusal, and the submit trigger is replaced by a read-only claim card while a claim is `PENDING` or shown alongside a resubmit trigger while `REJECTED`. **This is SUB-03's merchant half only** — the platform owner's review/confirm/reject surface at `/admin/subscriptions` is plan 06-16 (Wave 6, not yet dispatched); SUB-03 is not marked complete in this SUMMARY's frontmatter.

## Performance

- **Duration:** ~2h10min task execution (~2h20min including worktree fast-forward from a stale Phase 5.3 checkpoint, `npm install`, `npx prisma generate`, env-file copy)
- **Completed:** 2026-09-14
- **Tasks:** 3/3
- **Files modified:** 8 (5 created, 3 modified)

## Worktree Setup

The worktree's `HEAD` (`d302801`, a Phase 5.3 checkpoint) was not a descendant of `ce9ee38` (the plan's expected base, Phase 6 Wave 4's completion commit) and had zero unique commits of its own. Fast-forwarded cleanly via `git merge --ff-only ce9ee38` before any task work began. `npm install` and `npx prisma generate` both initially failed because `.env.local`/`.env.test` (gitignored) did not exist in the fresh worktree; copied both from the main checkout as instructed, then both commands succeeded.

## Accomplishments

- `tests/isolation/subscription-claims.test.ts` (Task 1, RED then GREEN): SUB-03's submit contract against a real Postgres — PENDING creation with null `coversThrough`, exactly one `SYSTEM` message carrying `subscriptionClaimId`, same-tenant duplicate refusal, cross-tenant duplicate refusal with `toStrictEqual`-asserted byte-identical payload (T-06-76), case/whitespace-normalized collision, and `latestSubscriptionClaimFor` tenant isolation. 6/6 passing.
- `src/server/subscription/claims.ts` (Task 2): `submitSubscriptionPaymentClaim` — server-resolves the amount from `PLANS[planTier]` (never client-supplied), normalizes and globally-uniques the reference, writes the claim and its `postSystemMessage` receipt in one `scopedDb` transaction, refuses a `P2002` with one generic string regardless of which tenant collided. `latestSubscriptionClaimFor` reads the merchant's own history through `scopedDb`.
- `src/server/subscription/actions.ts` (Task 2): `submitSubscriptionPayment`, a `merchantAction({ mode: "read", ... })` — the mode decision and its reasoning are documented at length in the file header (see Key Decisions). Re-derives the receipt key server-side against the caller's own tenant before trusting it (T-06-79).
- `src/server/db/model-inputs.ts` (Task 2): `SubscriptionPaymentClaimCreateInput` added to the sanctioned generated-type allowlist.
- `src/components/subscription-claim-card.tsx` (Task 3): the read-only card — status chip, `formatXaf` amount, operator, `font-mono` reference, relative submitted time, receipt lightbox (URL resolved server-side, never composed client-side), `coversThrough` (`—` while unreviewed via `strings.admin.merchantDetail.coversThrough`, the label its own comment already earmarked for this reuse). Zero action props.
- `src/app/(dashboard)/dashboard/plan/submit-payment-dialog.tsx` (Task 3): the submit dialog — two-card operator radio-group, live-trimmed reference, read-only server-resolved amount, single-image receipt upload reusing plan 06-11's `"subscriptions"` mint/finalize triad, the platform's own manual-transfer number with a copy affordance, not optimistic, and an optimistic post-success card render reconciled by `router.refresh()`.
- `src/app/(dashboard)/dashboard/plan/page.tsx` (Task 3): loads `latestSubscriptionClaimFor` once above both branches; the payment CTA/claim-card region is wired into the CURRENT tier's card in both the in-trial switcher and the expired-trial read-only grid — the payment step quick task `260831-vd2` explicitly deferred to Phase 6.
- `src/app/(dashboard)/dashboard/plan/plan-switch-form.tsx` (Task 3): plan-switch buttons now carry explicit `variant="outline"`; gained an optional `currentPlanExtra` slot so the payment section renders inside the current tier's own card rather than as a separate page region.

## Task Commits

1. **Task 1: The subscription-claim isolation test (RED)** - `e704713` (test)
2. **Task 2: The subscription-claim writer and its gated action** - `1e7b645` (feat)
3. **Task 3: The submit dialog, the claim card, and the amended plan page** - `3298581` (feat)

_No plan-metadata commit follows — this SUMMARY was produced by a direct execution session (no `gsd-sdk` state-update tooling available in this environment), so `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md` were not machine-updated. See "User Setup Required" / final report for what a human or a GSD-tooled session should do next._

## Files Created/Modified

- `tests/isolation/subscription-claims.test.ts` — SUB-03 coverage (new)
- `src/server/subscription/claims.ts` — the claim writer (new)
- `src/server/subscription/actions.ts` — the gated submit action (new)
- `src/server/db/model-inputs.ts` — `SubscriptionPaymentClaimCreateInput` added
- `src/components/subscription-claim-card.tsx` — the read-only card (new)
- `src/app/(dashboard)/dashboard/plan/submit-payment-dialog.tsx` — the submit dialog (new)
- `src/app/(dashboard)/dashboard/plan/page.tsx` — payment section wired into both branches
- `src/app/(dashboard)/dashboard/plan/plan-switch-form.tsx` — outline variant, `currentPlanExtra` slot

## Decisions Made

See `key-decisions` in the frontmatter for the five substantive ones: the `mode: "read"` choice (the plan's own required decision point), the `receiptKey`/`actorUserId` parameter-shape extension, the platform-number sourcing, the shared-`paymentSection` placement across both plan-page branches, and the expired-trial-merchant-can-submit-without-a-receipt design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `receiptKey` added to `submitSubscriptionPaymentClaim`'s parameters, beyond the plan's literal signature listing**

- **Found during:** Task 2, while designing the writer against `SubscriptionPaymentClaim.receiptKey` (a real, nullable schema column).
- **Issue:** The plan's Task 2 action text lists the export as `submitSubscriptionPaymentClaim({ tenantId, actorUserId, operator, reference, planTier })` — no `receiptKey`. Task 3 explicitly requires a receipt-image upload affordance in the dialog, which has nowhere to persist its result without this parameter.
- **Fix:** Added `receiptKey: string | null` to the input interface, documented as intentional in the interface's own doc comment.
- **Files modified:** `src/server/subscription/claims.ts`
- **Verification:** `tests/isolation/subscription-claims.test.ts` exercises `receiptKey: null` in every case; `npm run typecheck`/`build` clean end to end with the dialog actually wiring a real upload through it.
- **Committed in:** `1e7b645`

**2. [Rule 1 - Bug] Tautological assertion in the RED test, fixed while verifying GREEN**

- **Found during:** Task 2, first GREEN run of `subscription-claims.test.ts`.
- **Issue:** The cross-tenant-duplicate test's "no row exists for the cross-tenant caller" assertion compared `readClaims(TENANT_B.id)`'s full length against a filtered subset of itself — a self-referential comparison that would pass trivially regardless of what was actually in the table, rather than asserting the filtered subset (matching this test's specific reference) was empty.
- **Fix:** Removed the tautological `expect(...).toHaveLength((await readClaims(...)).filter(...).length)` line; kept only the correct `expect(filtered).toHaveLength(0)` assertion beneath it.
- **Files modified:** `tests/isolation/subscription-claims.test.ts`
- **Verification:** Re-ran the full isolation suite; all 6 cases pass with the corrected assertion actually exercising the property it claims to.
- **Committed in:** `1e7b645`

**3. [Rule 3 - Blocking] Two doc-comment rewrites to stop self-matching their own grep-based acceptance criteria**

- **Found during:** Task 3 final verification.
- **Issue:** `subscription-claim-card.tsx`'s header comment named `onConfirm`/`onReject` in prose (explaining why the card has neither), and `submit-payment-dialog.tsx`'s header comment named `useOptimistic` in prose (explaining how it differs from `composer.tsx`'s approach). The acceptance criteria's literal `grep -c "onConfirm\|onReject\|onClick"` (must be 0) and `grep -c "useOptimistic"` (must be 0) do not distinguish code from comments and initially failed on these mentions.
- **Fix:** Reworded both comments to describe the same properties without using the literal identifier strings ("a confirm-or-reject callback prop", "optimistic-hook-driven send").
- **Files modified:** `src/components/subscription-claim-card.tsx`, `src/app/(dashboard)/dashboard/plan/submit-payment-dialog.tsx`
- **Verification:** Re-ran both grep commands; both now return 0.
- **Committed in:** `3298581`

### Not Fixed — Pre-Existing, Out of Scope

**`grep -ro 'variant="gold"' src/app src/components | wc -l` returns 10, not the plan's asserted 5.** Verified this is unchanged by this plan's work: stashed all Task 3 changes, re-ran the exact command against the pre-Task-3 tree, got 10 again (identical). None of this plan's new/modified files contain the string `gold` anywhere. This is the SAME pre-existing discrepancy already documented at length in `.planning/phases/06-merchant-dashboard-platform-admin/deferred-items.md` (originating no later than plan 06-10/06-11): a plain `grep -o` counts doc-comment prose mentions of the literal string alongside the five real JSX usages. The authoritative enforcement — `tests/unit/dashboard-nav.test.ts`'s gold-budget contract test, which scans `.tsx` source specifically — passed cleanly in every `npm run test:unit` run (685/685) throughout this plan. Not fixed here per the executor's scope-boundary rule; no new entry added to `deferred-items.md` since the existing entry already covers this exact command and cause.

---

**Total deviations:** 4 (1 missing-parameter addition, 1 test bug fix, 1 doc-comment self-match fix reworded across two files, 1 pre-existing out-of-scope discrepancy re-verified not to be a regression)
**Impact on plan:** All were necessary for a correct, buildable, spec-compliant merchant-side claim flow, or were pre-existing conditions independently re-verified rather than newly introduced. No scope creep beyond what SUB-03's receipt-persistence requirement structurally demanded.

## Known Stubs

None. The submit dialog performs a real presign→PUT→finalize upload and a real Server Action submit; the claim card renders real, server-resolved data in all three of its intended call sites' worth of props (only two of the three call sites — `/dashboard/plan` — are actually wired up yet; the other two, inline in both support threads, are plans 06-12/06-16's job per this plan's own artifact contract, not a stub in this plan's own surface).

## Threat Flags

None beyond what the plan's own `<threat_model>` already dispositions (T-06-75 through T-06-80, T-06-SC). No new trust boundary was introduced outside that register.

## Issues Encountered

- **Two transient Neon "Unable to start a transaction in the given time" pool-timeout errors**, both during `tests/isolation/subscription-claims.test.ts` re-runs (once immediately after Task 2's writer was added, once during a later verification pass). Both were resolved by a single retry with no code changes, consistent with the sibling-plan-concurrency warning in this plan's dispatch instructions. Not a code defect — confirmed by the retry passing 6/6 both times.
- **Worktree was spawned from a stale Phase 5.3 checkpoint**, as anticipated by the dispatch instructions; fast-forwarded per the documented procedure with zero conflicts.
- **Stash isolation check for the gold-count discrepancy**: used `git stash push -u -m "wip-task3-goldcheck"` (never a bare `git stash`), captured the entry's SHA via `git stash list --format='%H %gs'`, restored with `git stash apply <sha>` (not `pop`), then dropped the now-redundant entry by its post-restore `stash@{0}` position — per this environment's shared-stash-stack safety protocol.

## User Setup Required

None — no external service configuration required. The platform's own MoMo/Orange-Money receiving number is derived from the existing `strings.trial.contactUrl` value already present in the codebase; no new environment variable or secret was introduced.

**For a human or a GSD-tooled follow-up session:** this plan's `requirements: [SUB-03]` frontmatter entry should NOT be checked off in `REQUIREMENTS.md` — SUB-03's full text requires the platform owner to "review and confirm/reject it there," which plan 06-16 has not yet built. `STATE.md`'s Current Plan counter and `ROADMAP.md`'s Phase 6 progress table were not machine-updated in this session (no `gsd-sdk` tool available); both should be advanced to reflect 06-15's completion and 06-16's unblocked status once tooling is available.

## Next Phase Readiness

- SUB-03's merchant half works end to end: submit from `/dashboard/plan`, receipt lands in the thread as a `SYSTEM` message, the claim card replaces the submit trigger while `PENDING`, and a `REJECTED` claim shows the reason plus a resubmit trigger.
- Plan 06-16 (Wave 6) can now build `/admin/subscriptions` and `src/server/admin/subscription-claims.ts` directly against `SubscriptionPaymentClaim` and this plan's `SubscriptionClaimCard` — the card takes no action props by design specifically so 06-16 can render it read-only inside `/admin/support/[tenantId]`'s thread, with confirm/reject living only in the ledger page (D-20).
- Plan 06-16 also extends `tests/isolation/subscription-claims.test.ts` with the confirm/reject and optimistic-lock double-tap cases — the file's `describe` blocks are already organized (SUB-03 submission / Assumption A1 uniqueness / `latestSubscriptionClaimFor` isolation) so that extension appends cleanly rather than interleaving.
- No blockers for 06-16. The one residual gap 06-16 must account for: an expired-trial merchant's claim may legitimately have `receiptKey: null` even when they intended to attach a photo (the upload triad is `canWrite`-gated by an earlier plan, unchanged here) — the review UI should not treat a missing receipt as unusual for that population.

---
*Phase: 06-merchant-dashboard-platform-admin*
*Completed: 2026-09-14*

## Self-Check: PASSED

All 5 newly created key-files confirmed present on disk (`tests/isolation/subscription-claims.test.ts`, `src/server/subscription/claims.ts`, `src/server/subscription/actions.ts`, `src/components/subscription-claim-card.tsx`, `src/app/(dashboard)/dashboard/plan/submit-payment-dialog.tsx`). All three task commits (`e704713`, `1e7b645`, `3298581`) confirmed present in `git log --oneline ce9ee38..HEAD`.
