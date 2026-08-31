---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 15
subsystem: payments
tags: [payment-claim, prisma, postgres, unique-index, r2, sharp, resend, next-after, server-actions, rate-limiting, react]

# Dependency graph
requires:
  - phase: 03-01
    provides: The PaymentClaim table and its @@unique([tenantId, referenceNormalized]) index — the ORD-04 control itself
  - phase: 03-03
    provides: transitionOrder with its ORD-02 actor guard, and the named rate limiters (claimSubmissionLimiter, uploadPresignLimiter, callerIp)
  - phase: 03-05
    provides: The R2 three-step upload contract (objectKeyFor, presignUpload, getObjectBuffer, putObject, derivativePrefixFor) and IMAGE_PRESETS.claim
  - phase: 03-07
    provides: holdStockForLines / markStockHeld / releaseStock, the race-safe conditional-decrement stock primitives
  - phase: 03-13
    provides: normalizeReference, the merchant-side claim review (confirmClaim / rejectClaim / reopenClaim) this loop feeds
  - phase: 03-14
    provides: findOrderByTrackingToken and the tracking page whose action-region switch this plan extends
provides:
  - submitClaim — the accountless, token-gated claim submission action (CHK-04)
  - ORD-04 enforcement at the database index, with a non-leaky field-level refusal and a proven per-tenant scope
  - The D-11 resubmission branch, which re-holds stock before the order moves and refuses when the units have sold
  - notifyMerchantOfClaim — the D-13 merchant email, fired from after() and non-fatal by construction
  - requestClaimScreenshotUpload and /api/upload/claim-finalize — the anonymous, token-gated screenshot path
  - The B6 claim form, mounted in PAYMENT_PENDING and DISPUTED
affects: [phase-04-templates, phase-05-storefront-polish, phase-06-admin-messaging, any surface that reads PaymentClaim]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token-gated server action: the tracking token replaces the session, so the action is NOT a merchantAction and every authorization failure collapses to one identical refusal"
    - "Namespace imports used to hold a rule's name to exactly one line, so an acceptance grep returns call sites rather than import lines"
    - "Client-supplied storage keys are rebuilt from the resolved tenant and discarded on mismatch rather than refused — an optional attachment must never cost somebody their claim"
    - "after() for best-effort side effects, with the callee non-throwing by construction rather than by the caller's try/catch"

key-files:
  created:
    - src/server/images/claim-upload.ts
    - src/app/api/upload/claim-finalize/route.ts
    - src/server/claims/submit.ts
    - src/server/claims/notify.ts
    - src/app/s/[slug]/order/[token]/claim-form.tsx
    - tests/isolation/claim-submission.test.ts
  modified:
    - src/app/s/[slug]/order/[token]/page.tsx
    - src/server/db/model-inputs.ts

key-decisions:
  - "amountClaimedXaf is copied from Order.totalXaf and the Zod schema has no amount field at all — the A5 mismatch line is only meaningful while one side of the comparison is the server's own number"
  - "ORD-04 is enforced by the unique index and a P2002 catch, never by a count() before the insert, because a count can be raced and an index cannot"
  - "The duplicate refusal names no other order — telling a customer which order holds their reference leaks a stranger's order number inside the same store"
  - "The DISPUTED resubmission re-holds stock FIRST, so a failed hold rolls the whole transaction back and the order stays disputed rather than moving over inventory that now belongs to someone else"
  - "The resubmission also calls markStockHeld, so a second rejection can still release — releaseStock is keyed on Order.stockHeld, not on the order's state"
  - "The submitted screenshotKey is rebuilt from the resolved tenant and DISCARDED (not refused) on mismatch — an attack is made inert and a stale client still gets its claim"
  - "The word CONFIRMED appears nowhere in submit.ts, asserted by a source grep in the isolation test — the requirement is not 'we do not auto-confirm' but 'there is nowhere an auto-confirmation could be written'"
  - "Success is a router.refresh() into the PAYMENT_CLAIMED status block with no transient notification of any kind — the status block is the permanent evidence a customer's money was accounted for"
  - "The claim form opens behind the I've paid CTA in PAYMENT_PENDING (the reference does not exist yet) but is open from the first paint in DISPUTED (the customer has already been refused once)"
  - "The B6 remove-photo label and upload-failure copy are reused from strings.products rather than authored a second time in strings.orderStatus — strings.ts forbids writing one sentence twice, slightly differently"

patterns-established:
  - "Anonymous token-gated upload pair: the mint and the finalize route BOTH re-authorize with findOrderByTrackingToken, and neither ever accepts a key, a path or a filename from the client"
  - "Degrade-to-warning external dependency: notify.ts contains zero throw statements, checks both the SDK's rejection and its resolved error field, and states in its header that the in-app badge is the reliable channel"
  - "Source-grep assertions inside an isolation test, in the spirit of single-order-state-writer.test.ts, for invariants no runtime test can reach"

requirements-completed: [CHK-04, ORD-02, ORD-04]

# Metrics
duration: ~102min (across two interrupted sessions)
completed: 2026-08-31
---

# Phase 3 Plan 15: Claim Submission and Resubmission Summary

**Accountless, token-gated payment-claim submission with ORD-04 enforced at a per-tenant unique index, a D-11 resubmission branch that re-holds stock before the order moves, and a D-13 merchant email fired from `after()` that cannot fail a claim.**

## Performance

- **Duration:** ~102 min of execution across two sessions (the first was cut short by a session limit mid-Task-2)
- **Started:** 2026-08-31T14:55Z (first session)
- **Completed:** 2026-08-31T16:39Z
- **Tasks:** 3 of 3
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments

- **The customer's half of the payment loop closed.** A link-holder with no account can say they have paid, attach a screenshot, and watch the page become "Payment being confirmed" — and if the merchant refuses it, the same link quotes the reason and lets them send corrected details.
- **ORD-04 is a database guarantee, not an application check.** `normalizeReference` collapses the spellings, `@@unique([tenantId, referenceNormalized])` refuses the second insert, and the isolation test proves the constraint is per tenant by submitting the *identical* reference successfully in a second store.
- **ORD-02 holds from the customer side structurally.** `submitClaim` targets `PAYMENT_CLAIMED` with `actor: "CUSTOMER"`, `transitionOrder`'s actor guard refuses the settled state one level down, and a source grep in the isolation test asserts the settled-state literal appears nowhere in the module — not even in a comment.
- **D-11's recovery loop is complete and safe.** A `DISPUTED` resubmission re-holds the stock the rejection released *before* the order moves; when the units sold during the dispute window the whole transaction rolls back, the order stays `DISPUTED` with its stock unheld, and the customer is told which item went.
- **The email cannot take claims offline.** `notify.ts` contains zero `throw` statements, checks both Resend's rejection and its resolved `error` field, and degrades to one loud warning when `RESEND_API_KEY` is absent — asserted by an isolation case that runs with the keys deliberately unset.

## Task Commits

Each task was committed atomically:

1. **Task 1: The token-gated, unauthenticated screenshot upload path** — `27ed3ba` (feat)
2. **Task 2: submitClaim, the ORD-04 enforcement, the D-11 resubmission, and the D-13 email** — `29d8bb9` (feat)
3. **Task 3: The B6 claim form and its two entry points on the tracking page** — `bdca3ff` (feat)

## Files Created/Modified

- `src/server/images/claim-upload.ts` — `requestClaimScreenshotUpload`; the anonymous presign mint, rate-limited on the caller IP and authorized by `findOrderByTrackingToken` instead of a session. Never accepts or returns a key, path or filename.
- `src/app/api/upload/claim-finalize/route.ts` — the Node-runtime sibling of 03-05's merchant finalize route. Re-authorizes with the token exactly as the mint did, recomputes the key from the tenant it resolves for itself, runs the `claim` Sharp preset, and writes no database row.
- `src/server/claims/submit.ts` — `submitClaim`. Two rate-limit buckets (caller IP, then the order's token digest), tenant + token resolution collapsing to one refusal, a state/channel gate, `normalizeReference`, then one transaction: the D-11 re-hold, the `PaymentClaim` insert, and `transitionOrder` to `PAYMENT_CLAIMED` as `CUSTOMER`. `P2002` becomes the ORD-04 field error; `after()` defers the merchant nudge.
- `src/server/claims/notify.ts` — `notifyMerchantOfClaim`. Resolves the owner's address through `platformDb.member` → `user.email` at send time (no new column), and resolves every failure mode to a warning and a return.
- `src/app/s/[slug]/order/[token]/claim-form.tsx` — the B6 client island: operator chips limited to the merchant's configured networks, an auto-uppercasing `font-mono` reference input, and the optional screenshot driven through the Task 1 mint/PUT/finalize sequence.
- `src/app/s/[slug]/order/[token]/page.tsx` — the action-region switch extended in exactly two places (`PAYMENT_PENDING`, `DISPUTED`). Metadata, the rate limiter, the `notFound()` path and every other region are byte-for-byte 03-14's.
- `tests/isolation/claim-submission.test.ts` — 12 cases over a real Postgres covering all eight the plan named, plus the T-03-23 forged-screenshot-key case and the D-13 degradation.
- `src/server/db/model-inputs.ts` — added the `PaymentClaimCreateInput` alias (see Deviations).

## Decisions Made

Recorded in full in the frontmatter's `key-decisions`. The three that most constrain future work:

- **There is no amount field, and there must never be one.** A customer-supplied amount would make the merchant's mismatch check compare a forgeable value against itself.
- **The refusal is deliberately uninformative about *which* order holds a duplicate reference.** Any future "helpful" improvement here is a cross-customer leak inside a tenant.
- **`submit.ts` may never contain the string `CONFIRMED`.** A test asserts it against the source; settling a claim belongs to `src/server/claims/actions.ts`, behind a merchant session.

Two smaller judgement calls worth naming because the plan left them open:

- **The `I've paid` CTA is a disclosure, not a second button.** B5 specifies a CTA that "opens the claim form" and B6 specifies a submit reading `I've paid`. Rendering both would put the same label on screen twice, so the collapsed CTA *becomes* the submit when tapped — one `I've paid` at a time. `DISPUTED` skips the collapsed state entirely.
- **The claim form is gated on the merchant having a configured operator**, matching the gate 03-14 already applies to the B5 instructions block. A chip group with nothing in it, beside a reference field for a payment that could not have been made, is worse than the gap; the status block still states where the order stands.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the `PaymentClaimCreateInput` model-input alias**
- **Found during:** Task 2 (`submitClaim`)
- **Issue:** `submit.ts` is the first module in the codebase to *create* a `PaymentClaim` row (03-13's `actions.ts` only ever updates one), and `src/server/db/model-inputs.ts` had no alias for the model. `scopedCreateData<T>` needs one, and the generated Prisma client cannot be imported outside `src/server/db/**` — the ESLint import-zone rule is the point, so the alias had to be added in the sanctioned zone rather than worked around.
- **Fix:** Added `export type PaymentClaimCreateInput = Prisma.PaymentClaimUncheckedCreateInput;` with a header explaining the `Unchecked` choice (the claim names its order by the `orderId` scalar; a nested relation connect would land with no `tenantId` stamp, on the one table whose composite unique index *is* requirement ORD-04).
- **Files modified:** `src/server/db/model-inputs.ts`
- **Verification:** `npm run typecheck`, `npm run lint`, and the 12-case isolation file all pass.
- **Committed in:** `29d8bb9` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Forged-screenshot-key rebuild, and the paired `markStockHeld` call**
- **Found during:** Task 2 (`submitClaim`)
- **Issue:** Two gaps the plan's action text did not cover.
  (a) The client is handed a storage prefix by the finalize route and hands it back on submit. Nothing in the plan stopped a caller posting *another store's* claim-screenshot prefix, and the merchant's claims queue renders whatever key the row carries — a cross-tenant read of another customer's payment screenshot (T-03-23).
  (b) `releaseStock` is keyed on `Order.stockHeld`, which the rejection cleared. The D-11 re-hold as specified would have left the flag false, so a *second* rejection of the corrected claim would release nothing and strand the decrement permanently, with nothing in the audit trail to explain it.
- **Fix:** (a) `rebuildScreenshotKey` takes only the last path segment as meaningful, rebuilds the key from the resolved `tenant.id` via `objectKeyFor`/`derivativePrefixFor`, and stores `null` when the result does not match what was submitted. It *discards* rather than refuses, because the screenshot is optional and a customer must never lose a claim over an attachment. (b) `markStockHeld(tx, order.id)` added immediately after the successful re-hold, inside the same transaction.
- **Files modified:** `src/server/claims/submit.ts`
- **Verification:** Two dedicated isolation cases — "discards a screenshot key that is not this tenant's own" and the `stockHeld === true` assertion inside the D-11 resubmission case.
- **Committed in:** `29d8bb9` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both were required for correctness or tenant isolation. No scope creep — no new surfaces, no new packages, no schema change.

## Issues Encountered

**`npx next build` cannot run inside this git worktree.** It fails with `TurbopackInternalError: Symlink [project]/node_modules is invalid, it points out of the filesystem root`, aborting during `try_get_next_package` → `resolve` — that is, while locating the `next` package itself, before a single source file is compiled. This is the same structural Turbopack/worktree interaction independently diagnosed twice during Wave 4 and is not a code defect: the worktree's `node_modules` is a symlink out to the main checkout, which Turbopack's filesystem-root confinement rejects.

Evidence relied on instead, all clean:
- `npm run test:full` — **47 test files, 700 tests, 0 failures, 0 skipped**
- `npm run lint` — exits 0 at `--max-warnings=0`
- `npm run typecheck` — exits 0
- `npx vitest run --project unit tests/unit/surface-token-isolation.test.ts tests/unit/order-status-copy.test.ts tests/unit/single-order-state-writer.test.ts` — 18 passed
- Every acceptance grep in all three tasks returns its required count

**The orchestrator should run a real `npx next build` against the merged main checkout** before the Wave 6 phase gate. The build-specific risk this plan carries is narrow and worth naming: `src/server/claims/submit.ts` is a `"use server"` module that also exports the `SubmitClaimResult` *type*. TypeScript erases it before SWC's "every export must be an async function" check, and `tsc --noEmit` is clean, but that is the one construct here a production build would judge differently from a typecheck.

**Session interruption.** The first session was cut off by a session limit partway through Task 2, with `submit.ts`, `notify.ts` and the test file written but uncommitted and the `model-inputs.ts` alias half-considered. The work was inspected and reconciled against Task 2's full spec on resume rather than restarted; no work was discarded and no task was redone.

## Human Verification Still Required

The plan's `<human-check>` block has **not** been performed and cannot be satisfied by the automated evidence above. It needs a human at `npm run dev`:

1. Place a manual-transfer order, open the tracking link, tap `I've paid`, submit a reference with a screenshot. Confirm the page becomes `Payment being confirmed` with no transient notification, and that the merchant's sidebar badge turns gold.
2. Reject the claim from `/dashboard/claims` with a reason. Reload the tracking link and confirm the customer sees the reason quoted verbatim, the form pre-filled, and the submit reading `Send corrected details`.
3. Submit a corrected reference; confirm the order returns to review and the stock moved back down.
4. Submit the **first** reference again on a **different order in the same store**; confirm the duplicate error appears at field level and names no other order.

Steps 3 and 4 have isolation-test equivalents that pass; steps 1 and 2 are the parts only a browser can answer — the R2 round trip against real credentials, the actual rendered form, and the badge.

## User Setup Required

None new. `RESEND_API_KEY` / `RESEND_FROM_EMAIL` remain `.optional()` in `src/env.ts` by design: their absence produces one `[claims] DEGRADED` warning per submission and nothing else. Setting them is the only way to see the D-13 email, and *not* setting them is a supported production posture — the in-app gold badge is the reliable channel.

## Next Phase Readiness

- **Phase 3's manual-payment path is a closed round trip.** Order placed → payment pending → customer claims → merchant confirms or rejects → customer corrects → merchant confirms. Every arrow is now implemented, tenant-scoped, and isolation-tested.
- **Wave 6 (the phase gate) can proceed**, with two carry-ins: a real `next build` on the merged main checkout, and the four-step human check above.
- **No blockers.** No new packages, no schema migration, no external configuration.

## Self-Check: PASSED

Files verified present on disk:
- `src/server/images/claim-upload.ts` — FOUND
- `src/app/api/upload/claim-finalize/route.ts` — FOUND
- `src/server/claims/submit.ts` — FOUND
- `src/server/claims/notify.ts` — FOUND
- `src/app/s/[slug]/order/[token]/claim-form.tsx` — FOUND
- `tests/isolation/claim-submission.test.ts` — FOUND

Commits verified in `git log`:
- `27ed3ba` — FOUND
- `29d8bb9` — FOUND
- `bdca3ff` — FOUND

---
*Phase: 03-product-catalog-order-payment-claim-state-machine*
*Completed: 2026-08-31*
