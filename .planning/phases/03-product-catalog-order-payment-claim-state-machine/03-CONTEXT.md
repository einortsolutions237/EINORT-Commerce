# Phase 3: Product Catalog & Order/Payment-Claim State Machine - Context

**Gathered:** 2026-08-23
**Status:** Ready for planning

<domain>
## Phase Boundary

A merchant can list a product (with images, variants, stock, category) and a customer can browse the storefront, add to cart, and complete a full purchase through one of three checkout paths — WhatsApp order, manual Mobile Money/Orange Money transfer with an "I've paid" claim, or Cash on Delivery — ending in a merchant-confirmed order. Every order moves through an explicit, audited state machine regardless of channel, and stock cannot be oversold under concurrent orders. This phase also builds the image-enhancement pipeline (R2 + Sharp) that Phase 4's onboarding will reuse, and a minimal merchant payment-settings surface that Phase 4's fuller onboarding will later surface/edit rather than rebuild.

Covers: CAT-01, CAT-02, CAT-03, CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, ORD-01, ORD-02, ORD-03, ORD-04, ORD-05.

</domain>

<decisions>
## Implementation Decisions

### Order State Machine × Checkout Path

- **D-01:** A WhatsApp order always creates a trackable `Order` record (in `Order Placed` state) *before* opening the pre-filled WhatsApp deep link — never purely external. Keeps the merchant's order list, dashboard numbers, and ORD-05's audit trail complete regardless of which channel a sale came through.
- **D-02:** WhatsApp and Cash-on-Delivery orders skip `Payment Pending` and `Payment Claimed` entirely, going straight from `Order Placed` to `Confirmed` when the merchant taps confirm. Those two intermediate states exist *only* on the manual Mobile Money/Orange Money transfer path, where there's an actual claim object to wait for and review.
- **D-03:** `Disputed` is reachable *only* from a rejected payment claim (manual-transfer path only) — never from `Confirmed` or `Fulfilled`. Keeps the state's meaning narrow: "a claimed payment that didn't check out," not a general complaint/chargeback mechanism.
- **D-04:** Stock decrements atomically the moment an order is placed (`Order Placed`), not at `Confirmed` — this is what makes CAT-03's oversell-proofing meaningful under concurrency. If a claim is later rejected and the order goes `Disputed`, the held stock is released back automatically so it becomes sellable again. `Disputed` is not terminal (see D-11) — a resubmitted, later-accepted claim re-holds stock the same way a fresh order would.

### Product Catalog Structure

- **D-05:** "Simple variants" means a full option matrix capped at ~2 axes (e.g. Size × Color) — each combination is its own variant row with independent stock and an optional per-variant price override. Not single-axis-only, and not unbounded axes.
- **D-06:** Categories are merchant-defined, free-form, tenant-scoped (just a name per merchant) — no fixed platform-wide taxonomy in V1.
- **D-07:** The R2 + Sharp image-enhancement/aspect-ratio pipeline (presigned upload → automatic crop/enhance) is built in **this phase**, driven by CAT-02's product-image requirement. Phase 4's onboarding logo upload (ONB-03) reuses this same pipeline rather than a second implementation — avoid building image handling twice.
- **D-08:** Products are **deactivate-only** — no hard delete, ever. A merchant can hide a product from the storefront (can't be newly ordered) but the row and its variants persist so every historical order's product/variant reference stays intact.
- **D-09:** An out-of-stock product or variant stays visible on the storefront with a disabled "Add to cart" and an "Out of stock" label — it does not disappear from view. Standard e-commerce pattern; preserves shareable/bookmarked product links and shows merchants their sold-out demand signal.
- **D-10:** Products carry a small capped image gallery (~5 images). The first uploaded image (or one explicitly reordered to first) is the primary/hero image used everywhere a single thumbnail is needed — catalog grid, cart line items, order summaries.
- **Carried forward from Phase 2 (02-CONTEXT.md D-07):** product-count limits per plan tier (Starter 50 / Business 250 / Professional unlimited, per `.planning/phases/02-merchant-auth-entitlements-trial/pricing-reference.md`) were explicitly registered-but-unenforced placeholders in Phase 2. **This phase must wire the actual enforcement** — product creation is a `mode: "write"` merchant action and must consult the entitlements registry the same way `switchPlan` does, refusing creation past the tier's product cap.

### Payment Claim & Dispute Handling

- **D-11:** Rejecting a claim requires the merchant to supply a short reason (e.g. "Amount doesn't match," "Reference not found"), shown to the customer. The customer can then resubmit a corrected claim (new transaction reference and/or screenshot) against the same order — `Disputed` is a recoverable state, not a dead end, for the common real-world case of a typo'd reference or wrong amount sent.
- **D-12:** Since checkout requires no customer account (CHK-01), an anonymous customer reaches their order again via an **unguessable order-tracking link** — a long random token in the URL, generated at order placement, shown on-screen immediately and sent via WhatsApp. This link is how the customer checks status, submits the initial claim, and resubmits after a rejection. No phone-number+order-number lookup form — the token *is* the access control.
- **D-13:** Merchant notification of a new claim: an in-app pending-claims badge/count, **plus** a proactive email via Resend (already in the stack) — both ship in this phase. A proactive WhatsApp nudge does **not** ship now: sending a WhatsApp message *to* the merchant (as opposed to the customer clicking a `wa.me` link *to* the merchant) requires the paid WhatsApp Business API with business verification, which is not part of this project's current stack. Explicitly deferred to a post-pilot fast-follow once there's revenue to justify the setup.

### Merchant Payment Info & USSD Tap-to-Dial

- **D-14:** A minimal "Payment settings" surface (receiving number + operator) is built directly in this phase, since manual-transfer checkout cannot show a receiving number without it existing somewhere. Phase 4's fuller onboarding surfaces/edits the same underlying field — no rework.
- **D-15 (research-blocking):** The user does **not** know the exact MTN Mobile Money / Orange Money Cameroon merchant-payment USSD code format. This must be verified against real, current operator documentation during this phase's research pass, before the planner locks in the `tel:` deep-link construction — this resolves the long-standing gap already flagged in `.planning/STATE.md`'s Blockers/Concerns section. Regardless of what research finds, the manual-copy fallback (receiving number + exact amount shown as selectable plain text) ships unconditionally — CHK-03 already requires this as the iOS fallback, so it is also the acceptable floor if the USSD tap-to-dial format can't be verified reliably enough to ship.
- **D-16:** A merchant can configure receiving numbers for **both** MTN Mobile Money and Orange Money simultaneously; the customer picks their operator at checkout. Reflects the real Cameroonian market split between the two networks — requiring only one would turn away roughly half of potential customers.
- **D-17:** No verification step on a merchant's entered payment number — accepted as-entered, live immediately. Matches the manual-claim system's existing trust model (the whole system already relies on the merchant honestly confirming claims); a wrong number is self-correcting since the merchant simply doesn't get paid. No SMS/verification-code infrastructure needed.

### Claude's Discretion

- Exact stock/variant schema shape (e.g. whether a no-option product still gets a single implicit "Default" variant row, so stock always lives at the variant level uniformly) — follow whatever the planner/research determines is cleanest given D-05.
- Exact phone-number format validation for the payment-settings field (Cameroon national format, MTN-vs-Orange number-range sanity checks) — reasonable validation, not a hard product requirement.
- Exact order-tracking token generation scheme (length, character set, any expiry) — must be cryptographically unguessable; specifics are an implementation detail.
- Exact UX wording/flow for the rejection-reason field and the resubmission form.
- Exact image-reordering UI for picking a different primary/hero image.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/PROJECT.md` — core value, constraints (no live PSP, tenant isolation non-negotiable, Cameroon-first)
- `.planning/REQUIREMENTS.md` — full v1 requirement text for CAT-01/02/03, CHK-01 through CHK-05, ORD-01 through ORD-05
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, dependency on Phase 2

### Prior-phase patterns this phase extends
- `.planning/phases/02-merchant-auth-entitlements-trial/02-03-SUMMARY.md` — the `merchantAction({ mode: "write" | "read" })` write-gate wrapper; product/order mutations in this phase should be built the same way, not with ad-hoc trial/entitlement checks
- `.planning/phases/02-merchant-auth-entitlements-trial/02-05-SUMMARY.md` — `switchPlan`'s pattern for consulting the entitlements registry before a write; product-count-cap enforcement (see D-10's carry-forward) should follow this same shape
- `.planning/phases/02-merchant-auth-entitlements-trial/pricing-reference.md` — the actual per-tier product limits (Starter 50 / Business 250 / Professional unlimited) this phase must enforce
- `.planning/phases/02-merchant-auth-entitlements-trial/02-04-SUMMARY.md` — the distributed rate-limit pattern (`src/server/rate-limit.ts`, Upstash-backed) to reuse for claim-submission and order-placement abuse protection
- `src/server/entitlements/plans.ts`, `src/server/entitlements/resolve.ts` — the existing entitlements registry to extend with a product-count limit alongside the existing member limit

### Blocker this phase's research must resolve
- `.planning/STATE.md` — Blockers/Concerns section: "MTN MoMo / Orange Money USSD merchant-code strings need re-verification against official Cameroon operator merchant docs before build" (now formalized as D-15)

### Stack guidance already on file
- `CLAUDE.md` — "Image Upload/Processing Pipeline" section (R2 + Sharp + presigned uploads) and "Job/Queue Pattern" section (relevant if order-placement notification work needs `waitUntil()`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/server/merchant/action.ts` (`merchantAction`, `ActionResult`) — the write-gate wrapper every new product/order/claim mutation should be built through, exactly as `selectPlan`/`switchPlan` were in Phase 2
- `src/server/merchant/context.ts` (`requireMerchantContext`) — session-derived tenant identity; new dashboard pages (products, orders, claims, payment settings) call this themselves, per the established "no layout-level auth" pattern
- `src/server/entitlements/{plans,resolve,assert}.ts` — the registry to extend with product-count limits
- `src/server/rate-limit.ts` (`createLimiter`, `callerIp`) — reuse for claim-submission and checkout-abuse throttling
- `src/lib/strings.ts` — centralized copy module; all new customer-facing and merchant-facing copy belongs here, not inline JSX literals
- `src/server/db/{tenant-scoped,platform}.ts` — new tenant-scoped models (Product, Variant, Category, Order, PaymentClaim, OrderEvent) route through `scopedDb`; the tap-to-dial/USSD merchant payment settings likely live on `Organization` or a related model reached via `platformDb`

### Established Patterns
- TDD RED/GREEN, atomic per-task commits (established throughout Phases 1-2)
- Wave-based parallel execution via git worktrees for independent plans within a phase

### Integration Points
- New customer-facing routes under `src/app/s/[slug]/**` (product listing, product detail, cart, checkout, order-tracking-by-token) — this is new territory; Phase 1/2 only built the storefront placeholder (`src/app/s/[slug]/page.tsx`), which this phase's product/cart/checkout pages extend alongside, not replace (the placeholder becomes conditional on whether the merchant has published products, or Phase 4 replaces it — planner should confirm the exact transition condition)
- New merchant dashboard routes under `src/app/(dashboard)/dashboard/{products,orders,claims,settings/payment}`
- Prisma schema additions: `Product`, `ProductVariant`, `Category`, `Order`, `OrderEvent` (audit trail per ORD-05), `PaymentClaim` — all tenant-scoped, added to `TENANT_SCOPED_MODELS`

</code_context>

<specifics>
## Specific Ideas

- The order-tracking link should work the same way a guest-checkout tracking link does on any standard e-commerce site the user has used before — unguessable token in the URL, no login, sent via WhatsApp since that's the channel Cameroonian customers already check.
- The WhatsApp order flow should feel like: customer builds a cart, taps "Order via WhatsApp," an Order Placed record exists immediately, then the WhatsApp app opens with cart contents pre-filled as a message to the merchant's number.

</specifics>

<deferred>
## Deferred Ideas

- Proactive WhatsApp Business API messaging to merchants for new claims — deferred to a post-pilot fast-follow (D-13); requires paid API access and business verification not currently in this project's stack.
- SMS/verification-code confirmation of a merchant's entered payment number — considered and rejected for V1 (D-17); revisit only if payment-number fraud becomes a real observed problem post-pilot.
- Fixed/shared platform category taxonomy — considered and rejected in favor of merchant-defined free-form categories (D-06); would only become relevant if cross-tenant search/discovery is ever built.
- Hard delete for products — considered and rejected (D-08); no identified need strong enough to justify the added complexity of deciding what happens to historical orders referencing a deleted product.

None beyond the above — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-product-catalog-order-payment-claim-state-machine*
*Context gathered: 2026-08-23*
