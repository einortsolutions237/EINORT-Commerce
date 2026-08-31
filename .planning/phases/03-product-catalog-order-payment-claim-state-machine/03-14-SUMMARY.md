---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 14
subsystem: ui
tags: [nextjs, react-server-components, prisma, tailwind, ussd, tel-uri, user-agent, rate-limiting, tenant-isolation]

# Dependency graph
requires:
  - phase: 03-01
    provides: "Order/OrderItem/PaymentClaim schema, OrderState and OrderChannel enums, and the two-tenant seed with a distinct trackingTokenHash per tenant"
  - phase: 03-03
    provides: "orderTrackingLimiter and callerIp, with the fail-open-and-warn-loudly contract"
  - phase: 03-04
    provides: "strings.orderStatus — the seven B7 heading keys, the whole B5 instruction block, and the copy/copied labels"
  - phase: 03-07
    provides: "mintTrackingToken and hashTrackingToken, plus the global @@unique([trackingTokenHash])"
  - phase: 03-08
    provides: "buildMerchantUssd with its %23 encoding, the three menu-code constants, getPaymentSettings, resolvePaymentPaths and formatMsisdnForDisplay"
provides:
  - "findOrderByTrackingToken — the entire access control for a customer's order, with one indistinguishable null for all three failure modes"
  - "ORDER_STATUS_VIEW and statusViewFor — the exhaustive OrderState -> heading/body/icon map that cannot compile with a row missing (CHK-05)"
  - "The /s/[slug]/order/[token] tracking page: noindexed, no-referrer, rate-limited, with per-state action regions"
  - "The B5 manual-transfer instruction block with the D-15 three-tier dial rendering resolved server-side from the User-Agent"
  - "CopyField — the in-place copy-confirmation island reusable by any storefront surface that needs a lifted value"
affects: [03-15 payment claim submission, 03-16, any future surface that needs a customer-facing order view or a copyable payment value]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side platform branching: a User-Agent-derived rendering decision taken in a Server Component and passed down as a boolean prop, never re-derived in a client island"
    - "Single-origin URI construction: a href the OS will act on may only come from one server builder, made greppable by importing that builder as a namespace so its name appears exactly once per file"
    - "Indistinguishable-failure resolvers: collapse every distinct failure into one null inside the resolver so no caller downstream has the opportunity to branch on the difference"

key-files:
  created:
    - src/server/orders/tracking.ts
    - src/app/s/[slug]/order/[token]/status-block.tsx
    - src/app/s/[slug]/order/[token]/page.tsx
    - src/app/s/[slug]/order/[token]/payment-instructions.tsx
    - src/app/s/[slug]/order/[token]/copy-field.tsx
    - src/app/s/[slug]/order/[token]/loading.tsx
    - tests/unit/order-status-copy.test.ts
    - tests/isolation/tracking-token.test.ts
  modified: []

key-decisions:
  - "The payment-instructions block loops over every operator the merchant can receive on, rather than rendering one, because Order records the channel but not the wallet — that fact only exists once a PaymentClaim is submitted"
  - "Each operator block repeats the amount instead of sharing one at the top, so the amount always sits beside the number it must be sent to and the two numbers below cannot read as alternatives"
  - "buildMerchantUssd is imported as a namespace (import * as ussd) so a grep for the builder across src/app/s returns a complete list of every place a dial href can originate, with no import lines to read past"
  - "A rate-limited caller gets the same notFound() as a bad token — a distinguishable 'slow down' page would itself say something about the token that produced it"
  - "noindex and no-referrer are emitted through the route's own metadata export rather than a config-level header rule, so they live in the same file as the page they protect and cannot be dropped by an unrelated config edit"
  - "The B5 block is gated on the merchant actually having a receiving number, not on PAYMENT_PENDING alone, so a merchant who cleared their numbers cannot produce a heading telling a customer to send money to nobody"
  - "The clipboard failure path is swallowed silently: the value beside the button is real selectable text, so the fallback is already on screen, and a confirmation for a copy that did not happen would send the customer to paste an empty clipboard into a payment form"
  - "isIosUserAgent knowingly misses an iPadOS 13+ device in desktop-UA mode; a false negative on a real iPhone is the expensive direction, and an iPad has no dialler for the href to fail in"

patterns-established:
  - "Enum-keyed Readonly<Record<...>> view maps for customer-facing copy, driven in tests from the enum's own keys so a future migration fails a test instead of shipping a blank page"
  - "In-place copy confirmation (icon-and-label swap inside an aria-live=polite region) as the storefront standard, with a toast explicitly ruled insufficient at the point of action"
  - "Skeletons shaped like the page they precede, never a bare spinner as a whole page"

requirements-completed: [CHK-03, CHK-05]

# Metrics
duration: ~55min execution across two sessions (session-limit disconnect between Task 2 and Task 3)
completed: 2026-08-31
---

# Phase 3 Plan 14: Customer Order Tracking Page Summary

**An unguessable-link order page that always names the customer's state from an enum-exhaustive copy map, and renders the receiving number and exact amount large, selectable and one-tap copyable — with a tap-to-dial button only for MTN with a valid 6-digit merchant code on a non-iOS device, decided server-side from the User-Agent.**

## Performance

- **Duration:** ~55 min of execution, spread across two sessions (a session-limit disconnect landed between the Task 2 commit and the Task 3 commit)
- **Started:** 2026-08-30T19:10Z
- **Completed:** 2026-08-31T14:58Z
- **Tasks:** 3
- **Files created:** 8 (6 source, 2 test)

## Accomplishments

- `findOrderByTrackingToken` makes the link the whole access control and makes all three ways of not holding a valid one — malformed, unknown, another tenant's — return the identical `null`, collapsed inside the resolver so no caller can branch on the difference. A malformed token never reaches the database at all.
- `ORDER_STATUS_VIEW` gives every `OrderState` authored heading, body and icon copy, typed so a seventh state is a compile error rather than a blank page, and proven by a sweep driven from the enum's own keys. `ORDER_PLACED` reads differently on WhatsApp (`Order sent`) than on cash on delivery (`Order received`).
- The B5 manual-transfer block ships the number and the amount first, largest and unconditionally on every platform and every tier, with the copy confirmation swapped in place under the thumb that asked for it.
- The D-15 three tiers resolve on the server from the request User-Agent, so the correct markup is in the first paint and no dial button ever flashes and vanishes. iOS never receives a `tel:` href, and the only origin of one anywhere under `src/app/s` is `buildMerchantUssd`.
- The route is noindexed and no-referrer from its own `metadata` export, closing the two realistic leaks for a token that lives in a path segment.

## Task Commits

1. **Task 1: findOrderByTrackingToken and the indistinguishable miss** — `2870265` (feat)
2. **Task 2: The exhaustive CHK-05 status map** — `82c2426` (test, RED) then `a8f07e4` (feat, GREEN)
3. **Task 3: The tracking page and the B5 instructions with D-15 tier rendering** — `c7bfc74` (feat)

**Plan metadata:** this summary's own commit.

## Files Created/Modified

- `src/server/orders/tracking.ts` — the tenant-scoped hash lookup; pre-query shape check, no `throw` anywhere, never selects `trackingTokenHash` back out, and states the accepted residual (the token in the host's request logs) in its header.
- `src/app/s/[slug]/order/[token]/status-block.tsx` — `ORDER_STATUS_VIEW`, `statusViewFor`, and the monochrome icon/heading/body/hairline renderer. No chip and no badge on this surface.
- `src/app/s/[slug]/order/[token]/page.tsx` — the Server Component: rate limit, tenant resolve, token lookup, one `notFound()`; eyebrow, status block, per-state action region, line items and total, and the tracking-link reminder.
- `src/app/s/[slug]/order/[token]/payment-instructions.tsx` — the B5 block and the D-15 tier branches, each carrying the rule it enforces as a comment beside it. Not a client component.
- `src/app/s/[slug]/order/[token]/copy-field.tsx` — the one client island on the page; in-place `Copied` swap in an `aria-live="polite"` `role="status"` region, with a separate `copyText` so a phone number is shown grouped and copied bare.
- `src/app/s/[slug]/order/[token]/loading.tsx` — a three-block skeleton in the page's own shape.
- `tests/unit/order-status-copy.test.ts` — the enum-driven exhaustive sweep, whose failure message names the missing state and cites CHK-05.
- `tests/isolation/tracking-token.test.ts` — cross-tenant miss, unknown-token miss, malformed-token miss without a query, absence of `trackingTokenHash` on the result, and the global unique constraint that makes the tenant-free index safe.

## Decisions Made

See `key-decisions` in the frontmatter. The three that most constrain future work:

- **The operator loop is a consequence of the schema, not a UI preference.** `Order` has no operator column while it is still waiting to be paid, so anything that later wants to render "the" payment instruction for an unpaid order has the same non-fact to deal with.
- **`import * as ussd` is load-bearing for the T-03-72 audit.** Flattening it to a named import puts the builder's name on an import line and makes the "every dial href origin" grep return noise.
- **The `I've paid` CTA and the claim form are deliberately absent.** 03-15 owns the whole claim submission flow; a button here that went nowhere would be worse than the gap, because the customer would tap it, nothing would happen, and they would conclude the store cannot take their money.

## Deviations from Plan

None — plan executed exactly as written. No auto-fixes were required under Rules 1-3 and no Rule 4 architectural question arose.

## Issues Encountered

**1. Session-limit disconnect mid-plan (resolved).** Execution was interrupted after the Task 2 GREEN commit with Task 3's four files written but uncommitted. On resume all four were re-read in full and re-verified against Task 3's spec line by line before anything was trusted; every acceptance-criteria grep was re-run from scratch and the whole gate was re-run clean rather than assumed. No work was redone and no work was lost.

**2. `npx next build` fails in the worktree for a structural reason, not a code one (accepted, evidence recorded).**

```
Error [TurbopackInternalError]: Symlink [project]/node_modules is invalid, it points out of the filesystem root
- Execution of directory_tree_to_loader_tree failed
- Execution of try_get_next_package failed
- Execution of find_package failed
```

`node_modules` inside this worktree is a symlink to `/d/Maxs/Claude/einort-commerce/node_modules`, i.e. to the main checkout, which is outside the worktree root that Turbopack treats as its filesystem root. The failure occurs during **entrypoint discovery**, in `find_package`, before Turbopack compiles a single source file — so it cannot be a property of this plan's code, and it reproduces for any code in any worktree with this layout. Plan 03-11 hit the identical error independently. Evidence that the code itself is sound: `npm run typecheck` (`tsc --noEmit` over the entire tree including all six new files) exits 0, `npm run lint` at `--max-warnings=0` exits 0, and the full 652-test suite passes including the source-scanning contract tests that parse this plan's `.tsx` files. **This must still be confirmed by a real `next build` on the merged trunk**, where `node_modules` is a genuine directory.

**3. The previously-observed Postgres `deadlock detected (40P01)` did not recur.** It was caused by multiple Wave-4 worktrees concurrently truncating and reseeding the shared Neon `TEST_DATABASE_URL`. With 03-11, 03-12 and 03-13 closed out, this worktree ran the suite alone and it passed clean — consistent with the diagnosis and with the three siblings' solo runs.

## Verification Results

| Gate | Result |
|------|--------|
| `npm run test:full` | **42/42 files, 652/652 tests passed. 0 failed, 0 skipped.** Exit 0, 1021s |
| `npm run lint` (`--max-warnings=0`) | Exit 0 |
| `npm run typecheck` (`tsc --noEmit`) | Exit 0 |
| `npx next build` | Fails on the worktree `node_modules` symlink — structural, pre-compilation; see Issue 2 |

Acceptance-criteria greps, all re-run on the final tree:

| Assertion | Expected | Actual |
|-----------|----------|--------|
| `findOrderByTrackingToken` in `page.tsx` | 1 | 1 |
| `notFound` in `page.tsx` | >= 1 | 7 |
| `index: false` / `noindex` in `page.tsx` | >= 1 | 2 |
| `referrer` in `page.tsx` | >= 1 | 3 |
| `orderTrackingLimiter` in `page.tsx` | 1 | 1 |
| `buildMerchantUssd` in `payment-instructions.tsx` | 1 | 1 |
| iOS detection in `payment-instructions.tsx` | >= 1 | 12 |
| `"use client"` in `payment-instructions.tsx` | 0 | 0 |
| `tel:` literal in `payment-instructions.tsx` | 0 | 0 |
| `tel:` literal anywhere under `src/app/s/**` | 0 | 0 |
| `Copied` literal in `copy-field.tsx` | 0 | 0 |
| `aria-live` in `copy-field.tsx` | 1 | 1 |
| `font-heading` / `gold-accent` / `--success` under `src/app/s/[slug]/order/` | 0 | 0 across all 5 files |
| raw palette colours under `src/app/s/[slug]/order/` | 0 | 0 across all 5 files |

## Outstanding Manual Verification

The plan's `<human-check>` is **not satisfied and was not simulated**. Per 03-VALIDATION.md's manual-only rows, these need real handsets:

- **iPhone, `PAYMENT_PENDING` link:** confirm no tap-to-dial button renders at all — only the selectable number and amount, with copy buttons that show `Copied` in place.
- **Android, merchant with a valid 6-digit MTN merchant code:** confirm `Dial the payment code` opens the dialler pre-filled with the full string *including the trailing `#`*.
- **Any device:** open a link with one character changed and confirm it 404s identically to a nonexistent one.

The first two are exactly the cases automated tests cannot reach — the assertion is about what a vendor's dialler does with a URI, not about what markup was emitted. The server-side branch is written so a human can verify it by changing only the device.

## User Setup Required

None — no external service configuration required. No packages were installed (T-03-SC: `accept`, no installs in this plan).

## Next Phase Readiness

- **03-15 (payment claim submission) is unblocked and has a defined seam.** The `PAYMENT_PENDING` action region renders the instructions and deliberately leaves the `I've paid` CTA slot empty; 03-15 fills it. `PAYMENT_CLAIMED` already renders the read-only claim recap (operator, reference, screenshot thumb) that 03-15's submission produces, and `DISPUTED` already quotes `rejectionReason` verbatim, so 03-15 does not need to build a result view.
- **`CopyField` is reusable** by any surface needing a lifted value, and already separates displayed from copied text.
- **One carry-forward:** `npx next build` must be run and confirmed green on the merged trunk, where `node_modules` is a real directory rather than a cross-root symlink. Typecheck, lint and the full suite are green here, but the production build has not actually been observed to complete.

---
*Phase: 03-product-catalog-order-payment-claim-state-machine*
*Completed: 2026-08-31*
