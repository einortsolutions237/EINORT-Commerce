---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 12
subsystem: payments
tags:
  [
    checkout,
    cart,
    server-actions,
    idempotency,
    rate-limiting,
    whatsapp,
    mobile-money,
    cash-on-delivery,
    zod,
    redis,
    react,
  ]

# Dependency graph
requires:
  - phase: 03-07
    provides: "placeOrder (atomic stock hold, genesis OrderEvent, plaintext tracking token) and the rememberOrderForKey/recallOrderForKey idempotency cache"
  - phase: 03-08
    provides: "getPaymentSettings, resolvePaymentPaths, buildWhatsAppOrderLink, buildOrderMessage, normalizeCameroonMsisdn"
  - phase: 03-09
    provides: "readStoredCart/clearStoredCart, CART_COOKIE_NAME, setCartQuantity/removeCartLine, hydrateCart and the storefront shell"
  - phase: 03-03
    provides: "orderPlacementLimiter and callerIp, both fail-open"
  - phase: 03-04
    provides: "strings.cart and strings.checkout copy namespaces"
provides:
  - "B3 cart review page at /s/[slug]/cart with server-derived totals, optimistic quantity/removal, and the two stock-changed notes"
  - "submitCheckout — the anonymous-shopper order placement action: rate limit, idempotency recall, Redis cart read, server-side path refusal, placeOrder, tracking outcome"
  - "B4 checkout page at /s/[slug]/checkout with the three-path radio-card selector, D-16 operator chips and the D-12 tracking-link block"
  - "Per-channel outcome naming: WhatsApp deep link, manual-transfer PAYMENT_PENDING continuation, cash-on-delivery confirmation"
  - "orderMessageArgsFor — the WhatsApp message read off the committed order, keeping every amount out of submitCheckout"
  - "tests/isolation/checkout-paths.test.ts — 10 cases covering the three channels, both unconfigured-path refusals, idempotency, cross-tenant cart and the limiter"
affects:
  [
    order tracking page,
    payment instructions page,
    payment claim submission,
    merchant order list,
    04-storefront-templates,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anonymous server action (not merchantAction): the caller has no session, so identity comes from the host-resolved tenant and the cart cookie, never from the payload"
    - "Money-free action schema: submitCheckout's Zod schema has no items field and no amount field; lines come from Redis and every franc from Postgres inside placeOrder"
    - "Per-mount idempotency key: crypto.randomUUID() in a useState lazy initializer, never regenerated on submit"
    - "Split module to keep an action money-free: order-message.ts reads the committed order's amounts so actions.ts can name none of them"

key-files:
  created:
    - "src/app/s/[slug]/cart/page.tsx"
    - "src/app/s/[slug]/cart/cart-lines.tsx"
    - "src/app/s/[slug]/cart/loading.tsx"
    - "src/app/s/[slug]/checkout/page.tsx"
    - "src/app/s/[slug]/checkout/checkout-form.tsx"
    - "src/app/s/[slug]/checkout/loading.tsx"
    - "src/server/checkout/actions.ts"
    - "src/server/checkout/order-message.ts"
    - "tests/isolation/checkout-paths.test.ts"
  modified:
    - "src/lib/strings.ts"
    - "src/server/storefront/queries.ts"

key-decisions:
  - "The confirmation screen reads the selected channel, never the presence of a wa.me link — a manual transfer lands in PAYMENT_PENDING and 'Order received' would be a lie there"
  - "The WhatsApp message is built from the committed order rather than the cart, in a separate module, so submitCheckout still names no amount (TEN-08 / T-03-59)"
  - "errorEmptyCart deliberately covers both an empty basket and another tenant's basket — telling them apart would answer a question only a prober asks"
  - "hydrateCart keeps the identity fields on an unavailable line and zeroes only the money and quantity, so B3's removed-item note can name the product"
  - "Unconfigured payment paths are omitted from the markup entirely and independently refused server-side; the markup is a courtesy, the action is the authority"

patterns-established:
  - "Server-side channel authority: resolvePaymentPaths is re-checked inside the action so a direct POST cannot reach a payment path the merchant cannot accept"
  - "Refusal copy written from the shopper's side: no refusal names the server-side rule it violated"

requirements-completed: [CHK-01, CHK-02]

# Metrics
duration: ~7h wall clock across two sessions (one session-limit disconnect between Task 1 and Task 2)
completed: 2026-08-31
---

# Phase 03 Plan 12: Cart Review + Checkout Summary

**An accountless Cameroonian shopper reviews a server-priced basket and places one order on whichever of WhatsApp, manual Mobile Money transfer or cash on delivery the merchant actually accepts — with the Order row and its tracking token existing before the WhatsApp link is ever handed over.**

## Performance

- **Duration:** ~7h wall clock across two sessions (a session-limit disconnect sits between Task 1 and Task 2; active working time is substantially shorter)
- **Started:** 2026-08-30T19:17Z (worktree created)
- **Completed:** 2026-08-31T12:55Z (verification and closeout)
- **Tasks:** 3 of 3
- **Files modified:** 11 (9 created, 2 modified)

## Accomplishments

- **CHK-01's review half.** `/s/[slug]/cart` renders the B3 column: 64px thumbnails, quantity steppers and remove buttons at 44px, a `--muted` summary block with `tabular-nums`, and a sticky full-width `min-h-12` `Checkout` CTA below `md`. There is no shipping row and no tax row — V1 has neither, and a `0 FCFA` shipping line would be a promise the platform does not make. Every amount comes from `hydrateCart`; the page computes nothing.
- **CHK-02's three paths, all accountless.** `submitCheckout` runs `orderPlacementLimiter` → `resolveTenantBySlug` → `recallOrderForKey` → Redis cart read → `resolvePaymentPaths` refusal → phone normalization → `placeOrder` → `rememberOrderForKey` → `clearStoredCart`, then names the per-channel outcome.
- **D-01 holds by construction.** The `Order` row and its plaintext tracking token exist before the `wa.me` URL is returned, so the sale is recorded whether or not the shopper ever opens WhatsApp.
- **T-03-59 holds structurally.** The action's Zod schema carries no `items` field and no amount field of any kind; `grep -cE "unitPriceXaf|totalXaf|subtotal|items:\s*z\."` on `actions.ts` returns 0. The WhatsApp message's amounts are read off the committed order in a separate module.
- **Unconfigured paths are absent, not disabled.** The markup omits them and the action refuses them independently — for the channel and for the D-16 operator — resolving RESEARCH.md Open Question 4.
- **Ten isolation cases, three more than the plan required.** Beyond the seven named cases the test file adds a WhatsApp-unconfigured refusal, a distinct-key second placement (proving idempotency does not over-collapse), and a limiter refusal that writes nothing.

## Task Commits

Each task was committed atomically:

1. **Task 1: The B3 cart review page** — `91f0388` (feat)
2. **Task 2: submitCheckout, the three per-channel outcomes and their refusals** — `6a0eced` (feat)
3. **Task 3: The B4 checkout page and its three-path selector** — `db461a3` (feat)
4. **Verification fix: name the right outcome on each checkout path** — `730d564` (fix)

**Plan metadata:** committed with this SUMMARY (docs)

## Files Created/Modified

- `src/app/s/[slug]/cart/page.tsx` — B3 Server Component: reads the cart cookie (read only, never `set` — Pitfall 4), `readStoredCart` → `hydrateCart`, renders line items, the summary block and the empty state
- `src/app/s/[slug]/cart/cart-lines.tsx` — the client island wrapping the steppers and remove buttons, calling `setCartQuantity`/`removeCartLine` optimistically and reverting on failure
- `src/app/s/[slug]/cart/loading.tsx` — skeleton shaped like three line rows plus a summary block
- `src/server/checkout/actions.ts` — `submitCheckout`: the whole anonymous placement path, its eight refusals, and the per-channel outcome
- `src/server/checkout/order-message.ts` — `orderMessageArgsFor`, the WhatsApp message's arguments read back off the placed order through `scopedDb(tenantId)`
- `src/app/s/[slug]/checkout/page.tsx` — B4 Server Component: resolves the tenant, hydrates the cart, redirects an empty cart back to `/cart`, resolves the payment paths, and passes down only resolved paths and server-formatted amounts
- `src/app/s/[slug]/checkout/checkout-form.tsx` — the three numbered sections, the radio-card selector with `aria-checked` and whole-row tap targets, the D-16 operator chips, the collapsed-below-`md` summary, the per-mount idempotency key, and the D-12 tracking-link block with its in-place `Copied` swap
- `src/app/s/[slug]/checkout/loading.tsx` — skeleton shaped like the three sections
- `tests/isolation/checkout-paths.test.ts` — 472 lines, 10 cases
- `src/lib/strings.ts` — the 11 checkout refusal strings and `trackingCta` (see Deviation 3)
- `src/server/storefront/queries.ts` — `hydrateCart` now preserves identity fields on an unavailable line (see Deviation 2)

## Decisions Made

- **The confirmation screen branches on the selected channel, not on the presence of a `wa.me` link.** The three paths end in three genuinely different places and the copy has to say which one this is. See Deviation 1.
- **The WhatsApp message lives in its own module.** A message that lists what was bought and what it came to necessarily names money columns. Keeping that read in `order-message.ts` means `submitCheckout` still names none of them, and the values come from exactly one place — the rows Postgres just committed. It reads the order rather than the cart, so the message and the order cannot disagree.
- **`errorEmptyCart` covers both an empty basket and a cross-tenant basket.** Distinguishing them would answer a question only someone probing would ask. The server logs the difference; the shopper reads one sentence.
- **Refusal copy never names the server-side rule.** A shopper cannot act on "channel not configured", and naming an internal rule teaches a prober its shape for nothing in return.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The confirmation screen collapsed manual transfer into cash on delivery**

- **Found during:** Post-Task-3 verification of the B4 success states
- **Issue:** The confirmation screen branched on `outcome.whatsappUrl !== null`, which made every non-WhatsApp path render the cash-on-delivery copy. A `MANUAL_TRANSFER` order lands in `PAYMENT_PENDING` (D-02) and the shopper still owes an action, so "Order received" was factually wrong there — and the onward link read `Your order link` rather than naming the payment step waiting on the other side.
- **Fix:** The screen now reads the selected `channel` and picks one of three headings and bodies (`placedWhatsapp*`, `paymentPending*`, `placedCod*`). The manual-transfer path's onward link uses `strings.checkout.submitTransfer` ("Continue to payment"); the cash-on-delivery path uses a new `strings.checkout.trackingCta` ("View your order").
- **Files modified:** `src/app/s/[slug]/checkout/checkout-form.tsx`, `src/lib/strings.ts`
- **Verification:** `npm run test:full` (636 passed), `npm run lint`, `npm run typecheck`, `npx next build` all clean; the copy-isolation contract test still passes with the new `trackingCta` key in `strings`.
- **Committed in:** `730d564` (standalone fix commit)

**2. [Rule 1 - Bug] `hydrateCart` zeroed the name B3's removed-item note has to print**

- **Found during:** Task 1 (rendering the two stock-changed notes)
- **Issue:** `hydrateCart` returned `productName: ""`, `productSlug: ""`, `variantLabel: ""` and `imageKey: null` for any line whose variant or product was inactive. B3's removed-item note is *"{name} is no longer available and has been removed."* — with an empty name the shopper reads a sentence with a hole in it.
- **Fix:** The identity fields now survive deactivation (`variant?.product.name ?? ""` and friends). The money fields and the quantity are still zeroed, so an unbuyable line still contributes nothing to any total, and `placeOrder` refuses it independently at placement. D-08 means the row is deactivated rather than deleted, so the lookup normally succeeds and only `active` is false.
- **Files modified:** `src/server/storefront/queries.ts`
- **Verification:** The inherited `hydrateCart` isolation coverage from 03-09 still passes inside the 636-test full run.
- **Committed in:** `91f0388` (Task 1 commit)

**3. [Rule 2 - Missing Critical] `submitCheckout`'s refusal copy did not exist**

- **Found during:** Task 2 (`submitCheckout`)
- **Issue:** The plan's interfaces block declares `src/lib/strings.ts` read-only, landed complete by 03-04. It was not: `strings.checkout` carried the headings, labels and submit copy but none of the eight-plus refusal messages the action returns. CLAUDE.md forbids inlining a user-facing string in a component or action, and the copy-isolation contract test enforces it, so the action had no legal way to name any of its failures.
- **Fix:** Added `errorRateLimited`, `errorStoreUnavailable`, `errorEmptyCart`, `errorNameRequired`, `errorPhoneFormat`, `errorAddressRequired`, `errorPathUnavailable`, `errorOperatorUnavailable`, `errorOutOfStock`, `errorItemUnavailable` and `genericError` to `strings.checkout`. `errorOutOfStock` is 03-UI-SPEC.md § B4's approved wording verbatim.
- **Files modified:** `src/lib/strings.ts`
- **Verification:** `npm run lint` at `--max-warnings=0` and the copy-isolation contract test both pass.
- **Committed in:** `6a0eced` (Task 2 commit)

**4. [Rule 2 - Missing Critical] A new module was needed to keep `submitCheckout` money-free**

- **Found during:** Task 2 (the WhatsApp outcome)
- **Issue:** `buildOrderMessage` needs the order's line items and total. Reading those inside `actions.ts` would have put amount-shaped identifiers into the one file whose entire contract (T-03-59, TEN-08) is that no amount passes through it — and would have made the plan's own acceptance grep fail.
- **Fix:** Created `src/server/checkout/order-message.ts` exporting `orderMessageArgsFor`, which reads the committed order through `scopedDb(tenantId)` — so an order id arriving from an anonymous request path cannot return a stranger's basket — and hands `submitCheckout` a ready `OrderMessageArgs`. The file is not in the plan's `files_modified` list.
- **Files modified:** `src/server/checkout/order-message.ts` (created)
- **Verification:** `grep -cE "unitPriceXaf|totalXaf|subtotal|items:\s*z\." src/server/checkout/actions.ts` returns 0; the WhatsApp isolation case asserts the returned `wa.me` number segment matches the merchant's configured number.
- **Committed in:** `6a0eced` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 missing critical)
**Impact on plan:** All four were necessary for correctness or for the plan's own stated invariants. Deviations 3 and 4 exist only because they were required to satisfy acceptance criteria the plan itself set. No scope creep — nothing outside `/s/[slug]/{cart,checkout}`, `src/server/checkout/**` and the two supporting edits was touched.

## Verification Results

Run fresh from a clean tree in the worktree, serialized so no sibling worktree was running `test:full` concurrently (a prior concurrent run across four worktrees hit a Postgres `deadlock detected (40P01)` on the shared Neon test branch; no vitest process was live before this run and none appeared during it).

| Gate                   | Result                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm run test:full`    | **41/41 files passed, 636/636 tests passed, 0 failed, 0 skipped** (975s) |
| `npm run lint`         | exit 0 at `--max-warnings=0`                                            |
| `npm run typecheck`    | exit 0                                                                  |
| `npx next build`       | exit 0 — compiled in 1.7s, 16/16 static pages, `/s/[slug]/cart` and `/s/[slug]/checkout` both present in the route table |

The Turbopack `Symlink [project]/node_modules is invalid` failure that a sibling worktree (03-11) hit — a structural consequence of the worktree's `node_modules` being a Windows junction into the main checkout, not a code fault — did **not** reproduce in this run. The build completed normally.

All of the plan's acceptance-criteria greps were re-run and pass, including the two that need reading rather than counting:

- `crypto.randomUUID()` appears exactly once in `checkout-form.tsx`, inside a `useState` lazy initializer whose setter is discarded — the key is minted once per mount, not per submit (Pattern 7b).
- Unavailable payment paths are omitted from the rendered list, never rendered with `disabled`.

## Issues Encountered

- **Session-limit disconnect between Task 1 and Task 2.** Execution resumed in the same worktree with all prior commits intact; no work was redone.
- **No transient test failures.** Nothing needed re-running, so no transience claim is made anywhere in this summary.

## Threat Model Coverage

Every `mitigate` disposition in the plan's register is implemented and, where the plan asked for it, isolation-tested.

| Threat ID | Status | Evidence |
| --------- | ------ | -------- |
| T-03-59 (forged price or line item) | mitigated | Money/items grep returns 0 on `actions.ts`; lines come from Redis, amounts from Postgres inside `placeOrder` |
| T-03-60 (unconfigured channel or operator) | mitigated | `resolvePaymentPaths` re-checked in the action; two isolation cases (channel, D-16 operator) plus a WhatsApp-unconfigured case |
| T-03-61 (double submit) | mitigated | `rememberOrderForKey`/`recallOrderForKey` with a per-mount key; isolation-tested for one row and one decrement, plus a distinct-key case proving it does not over-collapse |
| T-03-62 (placement flood) | mitigated | `orderPlacementLimiter` keyed on `callerIp`, fail-open; isolation case asserts a limiter refusal writes nothing |
| T-03-63 (token leak) | mitigated | `grep trackingTokenHash` returns 0; the plaintext token builds one path in the return value and is never logged |
| T-03-64 (cross-tenant cart cookie) | mitigated | `StoredCart.tenantId` compared against the host-resolved tenant before `placeOrder`; isolation-tested |

No security-relevant surface was introduced outside the register.

## Known Stubs

None. Every rendered value on both pages is wired to a real server source, and every branch of the confirmation screen renders real copy.

## Outstanding Manual Verification

The plan's `<human-check>` block has **not** been performed and still needs manual confirmation. In `npm run dev` at 360px, with a merchant configured for WhatsApp and MTN only:

1. Open the cart, change a quantity, tap `Checkout`.
2. Confirm the Cash-on-delivery card is **absent** rather than greyed out, and that selecting Mobile Money reveals **only** the MTN chip.
3. Complete a WhatsApp order and confirm the order appears in `/dashboard/orders` as `New order` on the WhatsApp channel **before** the deep link is opened.
4. Confirm the pre-filled message is readable and carries the tracking link near the top.
5. Confirm the on-screen tracking-link block copies with an in-place `Copied` confirmation.

Automated coverage asserts the server-side halves of 2 and 3 (path refusal, order-before-link) but cannot confirm the rendered layout at 360px or the clipboard behaviour.

## User Setup Required

None — no external service configuration is required beyond the credentials the phase already assumes.

## Next Phase Readiness

- The order tracking page (`/s/[slug]/order/[token]`) is now the destination of every checkout path and is the next thing a shopper reaches; the payment-instructions page is where `MANUAL_TRANSFER` continues.
- A WhatsApp order and a cash-on-delivery order are complete round trips from browse to merchant confirmation as of this plan.
- No blockers. The one open item is the manual `<human-check>` above.

## Self-Check: PASSED

All 9 created files verified present on disk; both modified files verified present. All 4 commits verified in `git log`: `91f0388`, `6a0eced`, `db461a3`, `730d564`. Working tree was clean before this SUMMARY was written.

---

_Phase: 03-product-catalog-order-payment-claim-state-machine_
_Completed: 2026-08-31_
