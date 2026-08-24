---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 07
subsystem: orders
tags: [order-placement, stock, concurrency, tenant-isolation, idempotency, audit-trail]

requires:
  - from: 03-01
    provides: "Order/OrderItem/OrderEvent/ProductVariant schema, scopedDb/ScopedTx/scopedCreateData, the two-tenant isolation fixture"
  - from: 03-03
    provides: "transitionOrder(), canTransition(), OutOfStockError/UnavailableItemError, the single-Order.state-writer source guard"

provides:
  - "mintTrackingToken()/hashTrackingToken() — the D-12 bearer credential and its stored digest"
  - "newOrderNumber() — the human-transcribable ORD-01 handle over an unambiguous 30-char alphabet"
  - "rememberOrderForKey()/recallOrderForKey() — sole owner of the idem: Redis namespace (C-11)"
  - "holdStockForLines()/releaseStock() — idempotent, conditional-update stock primitives that join the caller's transaction"
  - "openOrderAtGenesis() — the sanctioned creator of an Order row plus its fromState:null OrderEvent"
  - "placeOrder() + PlaceOrderInput — the only creator of Order rows, and a type with no money field"
  - "OrderCreateInput / OrderItemCreateManyInput in src/server/db/model-inputs.ts"

affects:
  - 03-12-checkout-page
  - 03-13-order-tracking
  - 03-15-claim-review
  - 03-16-merchant-order-queue

tech-stack:
  added: []
  patterns:
    - "Conditional updateMany with `stock: { gte: quantity }` at READ COMMITTED as the anti-oversell primitive — no row locks, no version column, no Serializable"
    - "Lines sorted by variantId before any decrement or increment, in ONE shared helper, to make the 40P01 lock cycle unconstructible"
    - "Order.stockHeld claimed atomically by a conditional updateMany before any increment (Pattern 2b)"
    - "Genesis Order.state write lives inside transition.ts, not beside it — the source guard stays a one-entry rule rather than an allowlist"
    - "Unbiased character selection by rejection sampling over node:crypto bytes, in place of a generator dependency"

key-files:
  created:
    - src/server/orders/tracking-token.ts
    - src/server/orders/order-number.ts
    - src/server/orders/stock.ts
    - src/server/orders/place.ts
    - src/server/idempotency/cache.ts
    - tests/unit/tracking-token.test.ts
    - tests/unit/order-number.test.ts
    - tests/isolation/stock-race.test.ts
    - tests/isolation/checkout-trust.test.ts
  modified:
    - src/server/orders/transition.ts
    - src/server/db/model-inputs.ts

decisions:
  - "The genesis Order.state write was routed INTO transition.ts as openOrderAtGenesis() rather than added to the single-writer guard's allowlist — the guard's own failure message prescribes this, and it turns 'the genesis event is always written' from a promise into a structural property"
  - "newOrderNumber() is built on node:crypto rejection sampling rather than nanoid's customAlphabet, because nanoid is not yet a dependency (03-02 owns its install) and this plan's own threat register says no package is installed here"
  - "variantLabelFor lives temporarily as a private snapshotVariantLabel() in place.ts, matching 03-06-PLAN.md's specified behaviour, rather than creating src/server/catalog/variant-matrix.ts and colliding with 03-06"
  - "The idempotency behaviour rows are unit-tested against a stubbed Upstash client rather than deferred to the isolation project — both seams (@/env, @upstash/redis) are replaceable with vi.doMock, so nothing is skipped and no socket is opened"
  - "A no-options variant's OrderItem.variantLabel is the empty string, not an invented 'Default' — the storefront owns that rendering decision"

metrics:
  duration: "~55 min"
  tasks: 3
  files: 11
  completed: 2026-08-24
---

# Phase 3 Plan 7: Order Placement Engine Summary

Order placement became a provable act: stock moves through a conditional `updateMany` that PostgreSQL itself arbitrates, every amount on the order is re-read from the database inside the transaction that writes it, and the order row cannot come into existence without its genesis audit row.

## What Was Built

**Task 1 — tracking token, order number, `idem:` namespace** (`68ede49`)

`mintTrackingToken()` returns 24 CSPRNG bytes as 32 base64url characters; `hashTrackingToken()` returns the unsalted SHA-256 hex digest that `Order.trackingTokenHash` stores under its global unique index. The module imports `node:crypto` and nothing else, which is what keeps it loadable by the database-free `unit` project. `newOrderNumber()` draws 8 characters from `23456789ABCDEFGHJKMNPQRSTVWXYZ` — no `I`, `L`, `O`, `U`, `0` or `1`, because the number is read aloud over WhatsApp — using rejection sampling so the last 16 members of the alphabet are not drawn 12.5% more often than the rest. `src/server/idempotency/cache.ts` owns the `idem:` prefix and nothing else (C-11): `SET NX EX 600` for the claim, `GET` for the recall, and a degradation path that warns once and behaves as though the key were unseen.

**Task 2 — stock primitives and the CAT-03 proof** (`329548c`)

`holdStockForLines()` decrements with `where: { id, active: true, stock: { gte: quantity } }` and throws `OutOfStockError(variantId)` on zero rows. `releaseStock()` claims `Order.stockHeld` with a conditional `updateMany` before touching any variant, so a second call returns having changed nothing. Both take the caller's `ScopedTx` and open no transaction. `tests/isolation/stock-race.test.ts` carries six cases against a real Postgres.

**Task 3 — `placeOrder()` and the TEN-08 proof** (`b0b90bd`)

One `$transaction` at `timeout: 15_000` covering the re-read, the stock hold, the order row, the line snapshots, the genesis event and the D-02 `PAYMENT_PENDING` hop. `PlaceOrderInput` carries `{ variantId, quantity }` and no money field of any kind. A duplicate order number retries the whole placement once and only for `P2002`.

## Key Decisions

**The genesis write went into `transition.ts`, not onto an allowlist.** 03-03's summary predicted this collision precisely: `placeOrder` needs `state: "ORDER_PLACED"` on an `order.create`, and `tests/unit/single-order-state-writer.test.ts` matches `order.create` just as it matches `order.update`. The two exits were adding `place.ts` to the guard's allowlist, or doing what the guard's own failure message says — *"If a genuinely new state-writing path is ever needed, it belongs INSIDE transition.ts, not beside it."*

`openOrderAtGenesis(tx, args)` is that. It writes the `Order` row and its `fromState: null` `OrderEvent` as two statements in the caller's transaction, exactly mirroring `transitionOrder`'s contract, and takes no `state` parameter — the genesis state is a module-private constant, so no caller can place an order directly into `CONFIRMED`. `place.ts` therefore contains no `state:` in any order write and the guard passed unmodified.

This is stronger than the allowlist route, not merely equivalent. An allowlist with two entries has three next quarter, and "one writer" decays into "the writers we happen to have blessed". More importantly, "every order has a genesis event" was previously a promise held by whoever wrote the placement; it is now structural — there is no way to bring an `Order` row into existence without the matching `OrderEvent` landing in the same transaction, because the only function that can do the first also does the second.

**The deadlock sort is one function, used by both directions.** The plan asked for the sort inside `holdStockForLines`. `releaseStock` increments variants too, and increments take row locks — a release ordering its variants differently from the way holds order theirs would reopen the same cycle from the other side. Both now call `sortedByVariant()`, which is also why the plan's `grep -c "localeCompare"` criterion still returns exactly 1.

**The negative control was run, and it fired on the first attempt.** Replacing `sortedByVariant`'s body with an unsorted copy made the opposite-order case fail immediately with a genuine `PrismaClientKnownRequestError … Code: 40P01. Message: deadlock detected`. Not flaky — deterministic on run 1. The sort was restored and the suite re-run green. That is the difference between a comment claiming a concurrency property and a test holding it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `nanoid` is not installed, so `newOrderNumber()` uses `node:crypto`**

- **Found during:** Task 1
- **Issue:** The plan specifies `nanoid`'s `customAlphabet` and its `<interfaces>` block states that 03-02 installed `nanoid@6.0.1` as a direct dependency. 03-02 has not run — it is blocked on Cloudflare R2 credentials — and `nanoid` is absent from both `package.json` and `node_modules`. Installing it from here would contradict this plan's own threat register (`T-03-SC`: *"No package installs in this plan"*) and would collide with 03-02's lockfile edit on merge.
- **Fix:** `order-number.ts` draws bytes from `node:crypto` directly, with rejection sampling at `ACCEPT_BELOW = 240` to remove the modulo bias that a bare `% 30` would introduce. This is what `customAlphabet` wraps anyway. The file header records the reason and notes that swapping in the library later is a local change with the unit test already in place.
- **Consequence for the plan's criteria:** `grep -c "customAlphabet("` returns 0 rather than matching. The criterion's *substance* — that the alphabet excludes the ambiguous characters — is verified two ways instead: `grep -o '"23456789[^"]*"' src/server/orders/order-number.ts | grep -cE '[ILOU01]'` returns 0, and `tests/unit/order-number.test.ts` asserts the emitted characters against `/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/` over 5,200 draws plus a coverage case proving no alphabet member is unreachable.
- **Files modified:** `src/server/orders/order-number.ts`
- **Commit:** `68ede49`

**2. [Rule 3 - Blocking] `variantLabelFor` does not exist yet; a local equivalent stands in**

- **Found during:** Task 3
- **Issue:** The plan sources `OrderItem.variantLabel` from `variantLabelFor` in `src/server/catalog/variant-matrix.ts`. That module is created by 03-06, which has not run.
- **Fix:** A private `snapshotVariantLabel()` in `place.ts` implementing exactly the behaviour 03-06-PLAN.md specifies (`"M / Blue"`, `"M"`, `""`). Creating `variant-matrix.ts` from this plan was rejected: it would collide with 03-06's own version of the same file on merge. The header marks the location as temporary and the swap as a one-line import change.
- **Files modified:** `src/server/orders/place.ts`
- **Commit:** `b0b90bd`

**3. [Rule 3 - Blocking] Generated create-input types needed sanctioned aliases**

- **Found during:** Task 3
- **Issue:** `scopedCreateData<T>` cannot infer `T`, so `openOrderAtGenesis` and the `orderItem.createMany` call must name `Prisma.OrderUncheckedCreateInput` and `Prisma.OrderItemCreateManyInput` explicitly — and `eslint.config.mjs` makes importing the generated client an error outside `src/server/db/**`.
- **Fix:** Two new aliases in `src/server/db/model-inputs.ts`, following the precedent 03-03 set for `OrderEventCreateInput`. No `eslint-disable` anywhere.
- **Files modified:** `src/server/db/model-inputs.ts`
- **Commit:** `b0b90bd`

**4. [Rule 2 - Missing critical functionality] `releaseStock` sorts its increments too**

- **Found during:** Task 2
- **Issue:** The plan applies the Pitfall 5 sort only to the hold path. An increment takes a row lock exactly as a decrement does, so a release of an order touching variants A and B, concurrent with a hold touching B and A, can form the same cycle.
- **Fix:** `sortedByVariant()` extracted and used by both functions.
- **Files modified:** `src/server/orders/stock.ts`
- **Commit:** `329548c`

**5. [Rule 2 - Missing critical functionality] An empty cart is refused explicitly**

- **Found during:** Task 3
- **Issue:** `placeOrder` with `items: []` would pass the count check vacuously (`0 === 0`), hold no stock, and write a real order at 0 XAF holding nothing — a row in the merchant's queue that is not an order.
- **Fix:** An explicit `UnavailableItemError` before the transaction opens.
- **Files modified:** `src/server/orders/place.ts`
- **Commit:** `b0b90bd`

### Criteria Not Literally Met (substance verified instead)

| Criterion | Actual | Why |
|-----------|--------|-----|
| `grep -c "customAlphabet(" order-number.ts` = 1 | 0 | Deviation 1. Alphabet verified by literal grep + 5,200-draw test. |
| `grep -c "hashTrackingToken" place.ts` = 1 | 2 | One import line, one call site. A symbol must be imported before it can be called; exactly one call site exists. |
| `grep -c "stockHeld: true" stock.ts` = 1 | 1 | Held after rewording a prose occurrence that would have inflated the count to 2. |
| `--repeat 3` for the negative control | 1 run | Vitest 4 has no `--repeat` flag. Unnecessary: the unsorted build produced a real `40P01` deterministically on the first run. |

## Verification

| Check | Result |
|-------|--------|
| `npm run test:full` | **26 files, 407 tests, 0 failed, 0 skipped** (957.9 s) |
| `npx vitest run --project unit tests/unit/tracking-token.test.ts tests/unit/order-number.test.ts` | 16 passed, 0 skipped |
| `npx vitest run --project isolation tests/isolation/stock-race.test.ts` | 6 passed, 0 skipped |
| `npx vitest run --project isolation tests/isolation/checkout-trust.test.ts` | 10 passed, 0 skipped |
| `npx vitest run --project unit tests/unit/single-order-state-writer.test.ts` | 3 passed — `transition.ts` is still the only writer, guard file unmodified |
| `npm run lint` (`--max-warnings=0`) | exit 0 |
| `npm run typecheck` | exit 0 |
| `grep -rcE "generated/prisma\|\$queryRaw" src/server/orders/ src/server/idempotency/` | 0 in every file |
| Negative control: sort removed from `sortedByVariant` | opposite-order case failed with a real `40P01 deadlock detected` on run 1; restored and re-verified green |

Baseline before this plan was 375 tests. The 32 added here are the four new files.

### The must-have truths, each against its test

| Truth | Where it is proved |
|-------|--------------------|
| Two concurrent placements for the last unit: one succeeds, one is told it is out of stock | `stock-race.test.ts` — "lets exactly one win, and never leaves stock below zero"; final stock is 0, never -1 |
| A multi-line order cannot deadlock against a concurrent order in the other sequence | `stock-race.test.ts` — "both settle without a deadlock, because the lines are sorted first", with the negative control above |
| A forged unit price or total changes nothing — every amount is re-read | `checkout-trust.test.ts` — "come from the database, and the input has no field to forge"; the forged literal is a documented compile error |
| Placement writes the ORD-05 genesis event, and manual transfer reaches PAYMENT_PENDING through `transitionOrder` | `checkout-trust.test.ts` — the three per-channel event-count cases |
| Releasing held stock twice increases nobody's inventory | `stock-race.test.ts` — sequential double release and concurrent double release |
| The plaintext token exists exactly once and never as a column | `checkout-trust.test.ts` — "returns the plaintext tracking token once and stores only its digest" |

## Notes for Future Plans

**03-12 (checkout page).** Type the Server Action's Zod output against `PlaceOrderInput`. A `unitPriceXaf` in that schema is the bug `place.ts` exists to prevent, and the type will refuse it. The idempotency key must be generated once per page mount, not per submit — a per-submit key makes `src/server/idempotency/cache.ts` decorative. `placeOrder` returns the plaintext token exactly once; if the action does not put it in the link it shows the customer, it is gone.

**03-06 (catalog).** When `variantLabelFor` lands, replace `snapshotVariantLabel` in `place.ts` with the import. The two must agree, and `checkout-trust.test.ts` asserts both the `"LARGE"` and the `""` cases.

**03-15 (claim review).** `holdStockForLines` is deliberately callable outside placement for the D-04 re-hold on `DISPUTED -> PAYMENT_CLAIMED`. That re-hold CAN legitimately fail if the units sold during the dispute window — refuse the resubmission with an explicit out-of-stock message rather than moving the order and leaving stock unheld.

**Anyone adding a state-writing path.** It goes inside `transition.ts`, alongside `transitionOrder` and `openOrderAtGenesis`. The guard is a one-entry rule and should stay one.

## Observation Logged, Not Fixed

Two `OrderEvent` rows written in the same transaction receive identical `createdAt` values, because `@default(now())` resolves to Postgres's `CURRENT_TIMESTAMP`, which is transaction start time. Ordering the manual-transfer order's two events by `createdAt` is therefore a tie-break, not a sequence. `checkout-trust.test.ts` asserts the event set rather than its order and says so inline. This matters for 03-13's tracking timeline and 03-16's order detail view: those should order by `createdAt` and then by a stable secondary key, or accept that same-transaction events are unordered. Recorded here rather than fixed — a monotonic sequence column is a schema change and belongs to whoever owns the timeline UI. Added to `deferred-items.md`.

## Known Stubs

None. Every function this plan created is fully wired and exercised by a test against a real Postgres.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or trust-boundary schema change beyond what `<threat_model>` already registered — `placeOrder` is a library function; 03-12 owns the HTTP surface that will call it, and `orderPlacementLimiter` already exists for it.

## Self-Check: PASSED

All eleven created/modified files exist on disk and all three commits are present in `git log`.
