---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 10
subsystem: orders
tags: [nextjs, prisma, server-actions, order-state-machine, dashboard-ui, vitest, tenant-isolation]

# Dependency graph
requires:
  - phase: 03-01
    provides: Order/OrderItem/OrderEvent/PaymentClaim schema, tenant-scoped index on Order(tenantId, state, placedAt)
  - phase: 03-03
    provides: transitionOrder / canTransition / ORDER_TRANSITIONS state machine, requireMerchantContext, merchantAction
  - phase: 03-04
    provides: dashboard nav shell, strings.orders copy module, pending-claims gold badge budget precedent
provides:
  - Tenant-scoped order queries (listOrdersForMerchant with six filters and per-filter counts, getOrderDetail with full event trail)
  - The two merchant-initiated order transitions (confirmOrder, markFulfilled), both actor-audited through transitionOrder
  - The single order-state chip module (STATE_CHIPS, STATES_BY_CHANNEL, OrderStateChip, OrderChannelChip) that both the UI and the exhaustive unit test cross-check against canTransition
  - The A3 merchant orders list (filters, table/card responsive layout, optimistic one-tap confirm) and A4 order detail page (audit trail in plain English)
affects: [phase-06-messaging-subscription-claim, future-cancel-action-if-added]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "State/channel labels centralized in one Record<OrderState,...> / Record<OrderChannel,...> module (order-state-chip.tsx), never inlined in a page — exhaustively cross-checked against the server's canTransition by unit test"
    - "Server actions never call order.update directly — every state change routes through transitionOrder, enforced by a grep-based acceptance criterion and the standing single-order-state-writer.test.ts"
    - "Optimistic client island (order-row-actions.tsx) scoped narrowly to only the confirmable ORDER_PLACED row; every other state renders server-side without a client component"

key-files:
  created:
    - src/components/order-state-chip.tsx
    - src/server/orders/queries.ts
    - src/server/orders/actions.ts
    - src/app/(dashboard)/dashboard/orders/page.tsx
    - src/app/(dashboard)/dashboard/orders/loading.tsx
    - src/app/(dashboard)/dashboard/orders/order-row-actions.tsx
    - src/app/(dashboard)/dashboard/orders/format.ts
    - src/app/(dashboard)/dashboard/orders/[id]/page.tsx
    - tests/unit/order-state-chip.test.ts
    - tests/isolation/order-actions.test.ts
  modified:
    - src/lib/strings.ts
    - src/app/(dashboard)/layout.tsx

key-decisions:
  - "Mounted <Toaster /> in the dashboard layout (not in the plan's files_modified list) because D-02's one-tap confirm toast had no renderer before this plan — a Rule 2 missing-critical-functionality addition, documented in the Task 3 commit message"
  - "Added src/app/(dashboard)/dashboard/orders/format.ts as a small shared money/time formatter used by both the list and detail pages, avoiding duplicated formatting logic across the two routes"
  - "No cancelOrder, no disputeOrder, and no CANCELLED state added — DISPUTED is reachable only from a rejected payment claim (03-13's territory) and CANCELLED does not exist in the six-state enum (RESEARCH.md Open Question 1); both facts are written into the actions.ts module header so a future contributor does not add a second state setter"

patterns-established:
  - "Exhaustive display-map-vs-state-machine cross-check: a unit test drives STATES_BY_CHANNEL against ORDER_TRANSITIONS/canTransition programmatically rather than by inspection, so a future state addition cannot silently desync the UI from the server"
  - "Gold accent budget enforced by a comment-stripping grep in tests/unit/dashboard-nav.test.ts, holding at exactly two real usages (sidebar badge + Payment claimed chip) across the whole src/ tree"

requirements-completed: [ORD-01, ORD-03, ORD-05]

# Metrics
duration: verification-only session (implementation spanned 2026-08-25 to 2026-08-30 across a session-limit disconnect; this session performed verification and closeout only, ~35min wall time for test:full plus checks)
completed: 2026-08-30
---

# Phase 3 Plan 10: Merchant Order Surfaces (List, Detail, Confirm/Fulfill) Summary

**Tenant-scoped order list/detail queries, actor-audited confirmOrder/markFulfilled transitions, a single order-state chip module cross-checked against the server state machine, and the A3/A4 dashboard routes that make ORD-05's audit trail human-readable.**

## Resumption Note

This plan's three tasks were implemented and committed in a prior session that ended on a session-limit disconnect. This execution session performed **verification and closeout only** — no implementation code was written or modified. All findings below come from re-running the plan's own per-task `<verify>` commands and the plan-level `<verification>` block against the already-committed code.

## Performance

- **Implementation commits:** 2026-08-25 (Task 1) and 2026-08-30 (Tasks 2–3), across the disconnect
- **Verification session:** this session, ~35 min (dominated by `npm run test:full` against the shared Neon test branch, 900s)
- **Tasks:** 3/3 complete (all previously committed)
- **Files:** 12 created/modified, 2471 insertions (`git diff --stat afd127f..dd2364c`)

## Accomplishments
- `src/components/order-state-chip.tsx`: the one place a state or channel becomes a visible label — `STATE_CHIPS` (six states, each with a label key, badge variant and lucide icon) and `STATES_BY_CHANNEL` (WhatsApp/COD narrowed to three states, manual transfer to all six), exhaustively cross-checked against `canTransition` by `tests/unit/order-state-chip.test.ts`.
- `src/server/orders/queries.ts` and `actions.ts`: `listOrdersForMerchant` (six filters incl. `needs-attention`, per-filter counts in one pass) and `getOrderDetail` (items, claims, events newest-first), plus `confirmOrder`/`markFulfilled` — both `merchantAction({ mode: "write" })` wrapping `transitionOrder` with `actor: "MERCHANT"` and `actorUserId: ctx.userId`, no direct `order.update` anywhere.
- The A3 orders list (`/dashboard/orders`) and A4 order detail (`/dashboard/orders/[id]`) — six filter chips with a server-decided default, `md+` table / sub-`md` stacked cards, one-tap optimistic confirm via the `order-row-actions.tsx` client island, and the `Order history` audit card rendering `You` / `{customer name}` / `Automatic` instead of raw actor enums.

## Task Commits

Each task was committed atomically (from the prior session):

1. **Task 1: The one order-state chip module and its channel guard** — `666aacd` (test, RED) + `6ae9e86` (feat, GREEN)
2. **Task 2: Order queries and the confirmOrder / markFulfilled transitions** — `40c5709` (feat)
3. **Task 3: The A3 orders list and A4 order detail with its audit trail** — `dd2364c` (feat)

_TDD gate compliance (Task 1): a `test(...)` commit (`666aacd`) precedes its `feat(...)` commit (`6ae9e86`) — RED/GREEN sequence confirmed in git log._

## Files Created/Modified
- `src/components/order-state-chip.tsx` — the six-row state chip map, the per-channel display guard, `OrderStateChip`/`OrderChannelChip`
- `src/server/orders/queries.ts` — `ORDER_FILTERS`, `listOrdersForMerchant`, `getOrderDetail`
- `src/server/orders/actions.ts` — `confirmOrder`, `markFulfilled`
- `src/app/(dashboard)/dashboard/orders/page.tsx` — A3 list (server component, six filters, table/card responsive)
- `src/app/(dashboard)/dashboard/orders/order-row-actions.tsx` — the optimistic confirm client island
- `src/app/(dashboard)/dashboard/orders/[id]/page.tsx` — A4 detail page with the `Order history` audit trail
- `src/app/(dashboard)/dashboard/orders/loading.tsx` — table-shaped skeleton
- `src/app/(dashboard)/dashboard/orders/format.ts` — shared money/time formatting (not in original `files_modified`, see Deviations)
- `src/app/(dashboard)/layout.tsx` — mounts `<Toaster />` for the confirm toast (see Deviations)
- `src/lib/strings.ts` — additional `strings.orders` keys A3/A4 needed
- `tests/unit/order-state-chip.test.ts` — RED-first exhaustive sweep
- `tests/isolation/order-actions.test.ts` — the six isolation cases from the plan's action block

## Decisions Made
- No `cancelOrder`/`disputeOrder`/`CANCELLED` state added in this plan — `DISPUTED` stays reachable only from a rejected payment claim (03-13's territory), and there is no sixth-plus-one `CANCELLED` state in the enum at all. Both facts are documented in `actions.ts`'s module header per the plan's explicit instruction.
- `<Toaster />` mounted in the dashboard layout and a small `format.ts` helper added — both outside the plan's literal `files_modified` list but required for the plan's own stated behavior (the optimistic confirm toast literally could not render without a mounted `Toaster`). Documented as Rule 2 (missing critical functionality) in the Task 3 commit message from the prior session.

## Deviations from Plan

### Auto-fixed Issues (from the prior implementation session, verified this session)

**1. [Rule 2 - Missing Critical] Mounted `<Toaster />` in the dashboard layout**
- **Found during:** Task 3 implementation
- **Issue:** D-02's one-tap confirm toast (`Order {n} confirmed`) had no renderer anywhere in the dashboard tree before this plan.
- **Fix:** Added `<Toaster />` (Surface A / dashboard only) to `src/app/(dashboard)/layout.tsx`.
- **Files modified:** `src/app/(dashboard)/layout.tsx`
- **Verification:** `npm run test:unit`, `npm run lint`, `npm run typecheck`, `npx next build` all pass with the mount in place.
- **Committed in:** `dd2364c` (Task 3 commit)

**2. [Not a functional deviation — literal-grep vs. behavioral-test mismatch] `variant="gold"` literal grep count**
- **Found during:** this verification session, re-checking the plan's exact acceptance-criteria grep commands.
- **Issue:** The plan's literal criterion `grep -rc 'variant="gold"' src/ --include=*.tsx | grep -v ":0" | wc -l` returns **3**, not the expected 2, because `orders/loading.tsx` carries an explanatory doc comment that quotes the string `variant="gold"` in prose (explaining that the file spends none of the budget). This is a naive-grep false positive, not a real third usage.
- **Verification:** The actual enforcement mechanism, `tests/unit/dashboard-nav.test.ts`, strips comments before counting (`stripComments` + regex match) and asserts exactly two real usages (the sidebar badge and `order-state-chip.tsx`). That test passes both in isolation and as part of the full suite (491/491). No code change needed — the gold budget genuinely holds at two spends; only the plan's literal bash one-liner is comment-blind.
- **Committed in:** N/A — no fix required, documented here for auditability.

**3. [Not a functional deviation — literal-grep vs. documentation] `getOrderDetail` grep count in the detail page**
- **Found during:** this verification session.
- **Issue:** The plan's criterion `grep -c "getOrderDetail" ".../orders/[id]/page.tsx"` expects exactly 1, but the file returns 5 — one import, one actual call, and three mentions inside a security-rationale doc comment (explaining T-03-53's tenant-isolation guarantee).
- **Verification:** Read the file directly; confirmed exactly one import and one call site, with the remainder being documentation. No functional issue.
- **Committed in:** N/A — no fix required, documented here for auditability.

---

**Total deviations:** 1 auto-fixed (Rule 2, necessary for the plan's own stated toast behavior), 2 documentation-only literal-grep mismatches (no code impact).
**Impact on plan:** No scope creep. The Toaster mount was strictly required for D-02's confirm flow to work as specified; the two grep mismatches are artifacts of the plan's acceptance criteria being comment-blind, not defects in the implementation — the real behavioral tests (`dashboard-nav.test.ts`'s comment-stripping gold-budget check) pass cleanly.

## Issues Encountered
None beyond the documented grep-vs-comment mismatches above. No test failures, no stock-race flake this run (see Verification Results below).

## Verification Results (this session)

All commands run against the worktree at `D:\Maxs\Claude\einort-commerce\.claude\worktrees\agent-ad2de2630a8c08fd1`, branch `worktree-agent-ad2de2630a8c08fd1`.

- **Task 1 verify:** `npx vitest run --project unit tests/unit/order-state-chip.test.ts tests/unit/dashboard-nav.test.ts` — 2 files, 16 tests, all passed. `npm run lint` exit 0. `npm run typecheck` exit 0.
- **Task 2 verify:** `npm run test:full` — **32 test files passed, 491 tests passed, 0 failures, 0 skipped.** `npm run lint` and `npm run typecheck` both exit 0 (confirmed once, shared with Task 1's run — nothing changed between).
  - `tests/isolation/stock-race.test.ts` did **not** flake this run — it passed cleanly as part of the 491/491 result. No re-run in isolation was needed. This worktree was confirmed to be the only one still exercising the shared Neon test branch (the other three Wave-3 worktrees — 03-06, 03-08, 03-09 — were already merged and closed), so this is a clean, contention-free result.
- **Task 3 verify:** `npm run test:unit` — 16 files, 280 tests, all passed. `npx next build` — completed successfully; `Route (app)` output confirms `/dashboard/orders` and `/dashboard/orders/[id]` both compiled as dynamic (`ƒ`) routes.
- **Plan-level verification block:**
  - `npm run test:full` — 32/32 files, 491/491 tests, 0 failures (see above).
  - `npm run lint` — exit 0 at `--max-warnings=0`.
  - `npm run typecheck` — exit 0.
  - `npx next build` — completed.
  - `npx vitest run --project unit tests/unit/single-order-state-writer.test.ts` — 1 file, 3 tests, all passed (no second writer of `Order.state`).
  - `variant="gold"` real-usage count — exactly 2 across `src/` per the comment-stripping test (`dashboard-nav.test.ts`); see Deviations item 2 for the literal-grep caveat.
- **Task 2 & 3 acceptance-criteria greps** (exports, `actorUserId`, no `order.update`, no `cancel`/`dispute` outside comments, `server-only`, `needs-attention`, `requireMerchantContext`, `OrderStateChip`, no raw state-label strings, no raw actor enums, no palette literals, no `data-surface="storefront"`, `strings.orders` usage count) — all satisfied; see Deviations items 2–3 for the two literal-count nuances that do not indicate real problems.
- The `Deleting the DISPUTED row from STATE_CHIPS makes typecheck fail` acceptance criterion was verified structurally rather than by destructive edit-and-revert: `STATE_CHIPS` is typed `Readonly<Record<OrderState, StateChip>>`, which makes a missing enum key a compile error by TypeScript's own exhaustiveness checking — confirmed by reading the type declaration rather than temporarily breaking a committed file.

## Human Verification Still Required

**Not performed by this session — requires the orchestrator/user.** The plan's `<human-check>` block:

> In `npm run dev`, open `/dashboard/orders` at 1280px and 360px with seeded orders present. Confirm: the default filter lands on `Needs attention` when something is waiting; a WhatsApp row offers `Confirm order` inline and the chip swaps immediately on tap; a manual-transfer row in `Payment claimed` shows the gold chip and a `Review claim` link; and the detail page's `Order history` reads as sentences with `You` / `Automatic` rather than enum names.

This was **not** attempted or faked by this session. All automated verification (tests, lint, typecheck, build) passes, but the visual/interaction confirmation at both breakpoints against seeded data is outstanding and must be performed manually before this plan is considered fully closed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- The merchant-facing order surfaces (list, detail, confirm, fulfill) are complete and fully tested; `DISPUTED` remains correctly unreachable from this plan's actions, ready for 03-13 to wire the claim-rejection path into it.
- `getOrderDetail`'s event trail and `OrderStateChip`/`OrderChannelChip` are stable exports future plans (claims queue, Phase 6 messaging) can build against without re-deriving state-display rules.
- Outstanding: the plan's `<human-check>` visual/interaction verification at 1280px and 360px (see above) — recommend the orchestrator perform this before marking the phase's Wave 3 fully done.

---
*Phase: 03-product-catalog-order-payment-claim-state-machine*
*Completed: 2026-08-30*
