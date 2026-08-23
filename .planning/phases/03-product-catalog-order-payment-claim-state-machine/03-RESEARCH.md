# Phase 3: Product Catalog & Order/Payment-Claim State Machine - Research

**Researched:** 2026-08-23
**Domain:** Multi-tenant commerce data modelling, concurrency-safe inventory, manual mobile-money payment rails (Cameroon), anonymous-customer checkout, R2/Sharp image ingest
**Confidence:** HIGH on the blocking D-15 payment-rail question, HIGH on concurrency and schema patterns, MEDIUM on Cameroon operator prefix heuristics

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Order State Machine × Checkout Path**

- **D-01:** A WhatsApp order always creates a trackable `Order` record (in `Order Placed` state) *before* opening the pre-filled WhatsApp deep link — never purely external. Keeps the merchant's order list, dashboard numbers, and ORD-05's audit trail complete regardless of which channel a sale came through.
- **D-02:** WhatsApp and Cash-on-Delivery orders skip `Payment Pending` and `Payment Claimed` entirely, going straight from `Order Placed` to `Confirmed` when the merchant taps confirm. Those two intermediate states exist *only* on the manual Mobile Money/Orange Money transfer path, where there's an actual claim object to wait for and review.
- **D-03:** `Disputed` is reachable *only* from a rejected payment claim (manual-transfer path only) — never from `Confirmed` or `Fulfilled`. Keeps the state's meaning narrow: "a claimed payment that didn't check out," not a general complaint/chargeback mechanism.
- **D-04:** Stock decrements atomically the moment an order is placed (`Order Placed`), not at `Confirmed` — this is what makes CAT-03's oversell-proofing meaningful under concurrency. If a claim is later rejected and the order goes `Disputed`, the held stock is released back automatically so it becomes sellable again. `Disputed` is not terminal (see D-11) — a resubmitted, later-accepted claim re-holds stock the same way a fresh order would.

**Product Catalog Structure**

- **D-05:** "Simple variants" means a full option matrix capped at ~2 axes (e.g. Size × Color) — each combination is its own variant row with independent stock and an optional per-variant price override. Not single-axis-only, and not unbounded axes.
- **D-06:** Categories are merchant-defined, free-form, tenant-scoped (just a name per merchant) — no fixed platform-wide taxonomy in V1.
- **D-07:** The R2 + Sharp image-enhancement/aspect-ratio pipeline (presigned upload → automatic crop/enhance) is built in **this phase**, driven by CAT-02's product-image requirement. Phase 4's onboarding logo upload (ONB-03) reuses this same pipeline rather than a second implementation — avoid building image handling twice.
- **D-08:** Products are **deactivate-only** — no hard delete, ever. A merchant can hide a product from the storefront (can't be newly ordered) but the row and its variants persist so every historical order's product/variant reference stays intact.
- **D-09:** An out-of-stock product or variant stays visible on the storefront with a disabled "Add to cart" and an "Out of stock" label — it does not disappear from view. Standard e-commerce pattern; preserves shareable/bookmarked product links and shows merchants their sold-out demand signal.
- **D-10:** Products carry a small capped image gallery (~5 images). The first uploaded image (or one explicitly reordered to first) is the primary/hero image used everywhere a single thumbnail is needed — catalog grid, cart line items, order summaries.
- **Carried forward from Phase 2 (02-CONTEXT.md D-07):** product-count limits per plan tier (Starter 50 / Business 250 / Professional unlimited, per `.planning/phases/02-merchant-auth-entitlements-trial/pricing-reference.md`) were explicitly registered-but-unenforced placeholders in Phase 2. **This phase must wire the actual enforcement** — product creation is a `mode: "write"` merchant action and must consult the entitlements registry the same way `switchPlan` does, refusing creation past the tier's product cap.

**Payment Claim & Dispute Handling**

- **D-11:** Rejecting a claim requires the merchant to supply a short reason (e.g. "Amount doesn't match," "Reference not found"), shown to the customer. The customer can then resubmit a corrected claim (new transaction reference and/or screenshot) against the same order — `Disputed` is a recoverable state, not a dead end, for the common real-world case of a typo'd reference or wrong amount sent.
- **D-12:** Since checkout requires no customer account (CHK-01), an anonymous customer reaches their order again via an **unguessable order-tracking link** — a long random token in the URL, generated at order placement, shown on-screen immediately and sent via WhatsApp. This link is how the customer checks status, submits the initial claim, and resubmits after a rejection. No phone-number+order-number lookup form — the token *is* the access control.
- **D-13:** Merchant notification of a new claim: an in-app pending-claims badge/count, **plus** a proactive email via Resend (already in the stack) — both ship in this phase. A proactive WhatsApp nudge does **not** ship now: sending a WhatsApp message *to* the merchant (as opposed to the customer clicking a `wa.me` link *to* the merchant) requires the paid WhatsApp Business API with business verification, which is not part of this project's current stack. Explicitly deferred to a post-pilot fast-follow once there's revenue to justify the setup.

**Merchant Payment Info & USSD Tap-to-Dial**

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

### Deferred Ideas (OUT OF SCOPE)

- Proactive WhatsApp Business API messaging to merchants for new claims — deferred to a post-pilot fast-follow (D-13); requires paid API access and business verification not currently in this project's stack.
- SMS/verification-code confirmation of a merchant's entered payment number — considered and rejected for V1 (D-17); revisit only if payment-number fraud becomes a real observed problem post-pilot.
- Fixed/shared platform category taxonomy — considered and rejected in favor of merchant-defined free-form categories (D-06); would only become relevant if cross-tenant search/discovery is ever built.
- Hard delete for products — considered and rejected (D-08); no identified need strong enough to justify the added complexity of deciding what happens to historical orders referencing a deleted product.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | Merchants can create products with images, price, simple variants, stock count, and category assignment | Pattern 1 (Prisma schema: `Product` / `ProductVariant` / `Category`), Pattern 8 (product-count entitlement gate) |
| CAT-02 | Product images pass through the same automatic enhancement/aspect-ratio pipeline as onboarding logos | Pattern 5 (R2 presigned upload + Sharp ingest, structured for Phase 4 reuse) |
| CAT-03 | Stock decrement on order placement is atomic/race-safe — concurrent orders cannot oversell the same unit | Pattern 2 (conditional `updateMany` guard; verified against PostgreSQL READ COMMITTED semantics) |
| CHK-01 | Customer browses, views product detail, adds to cart, reviews order summary without an account | Pattern 7 (Redis guest cart + opaque host-scoped cookie), Pitfall 4 (cookies cannot be set during render) |
| CHK-02 | Checkout offers WhatsApp order, manual Mobile Money/Orange Money transfer, and Cash on Delivery | Payment Rails § (verified `wa.me` format), Pattern 3 (channel-constrained state machine per D-02) |
| CHK-03 | Manual transfer path shows receiving number + exact amount, tap-to-dial USSD assist (Android `tel:`), manual-copy fallback (iOS) | **Payment Rails § — the D-15 blocker, now resolved.** Verified operator strings + Apple's official refusal to dial `*`/`#` |
| CHK-04 | Customer submits an "I've paid" claim with transaction reference and optional screenshot | Pattern 1 (`PaymentClaim`), Pattern 5 (screenshot via same presigned-upload path), Pattern 10 (duplicate-reference constraint) |
| CHK-05 | Customer always sees an explicit order status | Pattern 6 (tracking token), Pattern 3 (state → customer-facing copy map in `strings.ts`) |
| ORD-01 | Explicit state machine Cart → Order Placed → Payment Pending → Payment Claimed → Confirmed/Disputed → Fulfilled | Pattern 3 (`ORDER_TRANSITIONS` registry; "Cart" is a Redis state, not an `Order` row) |
| ORD-02 | A payment claim is never auto-confirmed from the customer's self-report alone | Pattern 3 (no transition from `PAYMENT_CLAIMED` to `CONFIRMED` exists outside a merchant-actor action) |
| ORD-03 | Merchants get a Payment Claims queue with reference + screenshot and one-tap confirm/reject | Pattern 1 (`PaymentClaim` indexes), Pattern 11 (pending count / badge) |
| ORD-04 | Each claim's transaction reference is checked for uniqueness per tenant | Pattern 10 (`@@unique([tenantId, referenceNormalized])` + normalization function) |
| ORD-05 | Every state transition is recorded in an audit trail (who/what/when) | Pattern 1 (`OrderEvent`), Pattern 3 (transitions only ever happen through one `transitionOrder()` function that writes the event in the same transaction) |
</phase_requirements>

---

## Summary

The single blocking item — D-15's Cameroon USSD merchant-payment format — is **resolved with HIGH confidence from official operator documentation**, and the answer materially changes the CHK-03 design. MTN Cameroon publishes a fully parametrized merchant-payment string (`*126*4*<6-digit merchant code>*<amount>#`); Orange Money Cameroon publishes only a menu entry point (`#150*47#`) with the merchant code typed interactively. **Both require the merchant to hold an operator-issued merchant code, which a typical Douala SME receiving payments on a personal MoMo wallet does not have.** Neither operator publishes a one-shot person-to-person send-money string — both P2P flows are menu-driven (`*126#`, `#150#`). Separately, Apple's own documentation states the iOS Phone app will not dial any `tel:` URL containing `*` or `#`, so the iOS manual-copy fallback is not a degradation choice — it is the only possible behaviour on that platform. Net design consequence: model an **optional** per-operator merchant code alongside the required receiving number, offer the parametrized MTN deep link only when a merchant code exists and the visitor is on Android, and treat manual copy as the primary, always-present path (which D-15 already mandates).

On the engineering side, the codebase's own constraints narrow the solution space usefully. `eslint.config.mjs` bans `$queryRaw`/`$executeRaw` outright, which removes `SELECT … FOR UPDATE` from consideration entirely — but the better pattern was already the conditional `updateMany({ where: { id, stock: { gte: qty } }, data: { stock: { decrement: qty } } })` guard, and PostgreSQL's official documentation confirms it is race-safe at the default READ COMMITTED level because the `WHERE` clause is re-evaluated against the committed row version after lock acquisition. Next.js 16 caps Server Action bodies at 1 MB (not the 4.5 MB figure in `STACK.md`), which makes the presigned direct-to-R2 upload path mandatory rather than merely preferable for both product images and claim screenshots. And `cookies().set()` is only legal inside a Server Function or Route Handler in Next 16 — so the guest-cart session cookie must be minted by the "add to cart" action, never during a page render.

The rest of the phase is schema and registry discipline that mirrors what Phases 1–2 already established: one `ORDER_TRANSITIONS` registry the way `PLANS` and `TENANT_SCOPED_MODELS` are registries, one `transitionOrder()` chokepoint that writes the `OrderEvent` in the same transaction so ORD-05 cannot be forgotten, composite `(tenantId, id)` foreign keys so a cross-tenant product/category reference is a database impossibility rather than a code review item, and one new Redis namespace module per C-11.

**Primary recommendation:** Model stock exclusively at the variant level (every product gets at least one implicit default variant), decrement it with a conditional `updateMany` inside `scopedDb(tenantId).$transaction(...)` with line items sorted by variant id, and funnel every order state change through a single `transitionOrder()` function that validates against `ORDER_TRANSITIONS` + the order's channel and appends an `OrderEvent` in the same transaction.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Product/variant/category CRUD | API (Server Action via `merchantAction`) | Database (constraints) | Tenant scoping and entitlement gating are server-only; the DB enforces uniqueness and cross-tenant FK integrity |
| Product-count limit enforcement | API (Server Action) | — | SUB-01 is explicitly "never client-side gating"; the dashboard's disabled button is courtesy only |
| Image upload transport | Browser → CDN/Storage (direct to R2 via presigned PUT) | API (mints the presigned URL) | Next 16 Server Actions cap bodies at 1 MB; the bytes must never transit Vercel compute |
| Image enhancement / aspect normalization | API (Node.js runtime Route Handler, Sharp) | Storage (R2 derivatives) | Sharp needs native libvips — Node runtime only, never Edge |
| Guest cart persistence | API (Server Action) + Redis | Browser (opaque cookie holding only a session id) | Cart contents must never be client-authoritative; the cookie carries an id, nothing else |
| Cart → price/stock re-derivation | API + Database | — | TEN-08: price, stock, tenant id and order status are re-derived server-side at placement |
| Atomic stock decrement | Database (single conditional UPDATE) | API (transaction orchestration) | Only the DB can make "check and decrement" atomic under concurrency |
| Order state transitions | API (`transitionOrder()`) | Database (audit row in same tx) | ORD-02/ORD-05 require merchant actor identity and an inseparable audit write |
| Payment-claim duplicate detection | Database (unique index) | API (normalization before insert) | A unique index cannot be raced; an application-level `count()` check can |
| Order tracking access control | API (token hash lookup) | — | The token *is* the credential (D-12); validation is server-side on every request |
| USSD / WhatsApp deep-link construction | Frontend Server (RSC render) | Browser (`tel:` / `wa.me` handoff to OS) | Strings are built server-side from tenant settings; the OS owns the dial/chat handoff |
| Merchant claim notification email | API (Route Handler / Server Action) + `after()` | External (Resend) | Fire-and-forget after response so a Resend outage never fails a customer's claim submission |

---

## Project Constraints (from CLAUDE.md)

Directives extracted from `CLAUDE.md` that the planner must not contradict:

| Constraint | Source section | Consequence for this phase |
|------------|----------------|-----------------------------|
| Never trust price, stock, tenant ID, or payment/order status from client input | Project § Constraints (TEN-08) | Cart stores `{variantId, quantity}` only. All money is recomputed at placement from the DB. |
| Tenant isolation enforced server-side on every query, non-negotiable | Project § Constraints | Every new model goes in `TENANT_SCOPED_MODELS` and is reached via `scopedDb`. |
| No live PSP/gateway integration in V1 | Project § Constraints | No MTN/Orange API calls. USSD/`tel:`/`wa.me` are pure client-side deep links. |
| Prisma 7 requires an explicit driver adapter; no bare `datasource.url` | What NOT to Use | Already satisfied by `src/server/db/base.ts`. Do not reintroduce a `url` in `schema.prisma`. |
| Never run Sharp on the Edge runtime | What NOT to Use | No `export const runtime = 'edge'` on any route importing `sharp`. |
| No BullMQ / dedicated worker process | What NOT to Use | Use `after()` (Next 16's built-in, see below) for the Resend notification. |
| Shared schema + indexed `tenantId`, never schema-per-tenant | What NOT to Use | Every new model carries `tenantId String` (required, no default). |
| `Intl.NumberFormat('fr-CM', { currency: 'XAF' })` directly; no currency library | What NOT to Use | XAF prices are whole-number `Int` columns. No `Decimal`, no minor units. |
| Guest cart = `cart:{sessionId}` JSON, TTL ~30 days, signed session cookie | Redis Usage Patterns | Pattern 7 below. |
| Rate limit payment-claim submissions and checkout submission | Redis Usage Patterns | Pattern 9 below. |
| Order placement must be idempotent against double-submit via `idempotency:{key}` | Redis Usage Patterns | Pattern 7b below. |
| Presigned direct-to-R2 upload; Sharp derivatives written back synchronously; `next/image` is not a substitute | Image Upload/Processing Pipeline (`.planning/research/STACK.md`) | Pattern 5 below. |

**Additional constraints discovered in the codebase (not in CLAUDE.md but equally binding):**

| Constraint | Source | Consequence |
|------------|--------|-------------|
| `$queryRaw` / `$executeRaw` are an ESLint error anywhere under `src/` | `eslint.config.mjs` `no-restricted-syntax` | `SELECT … FOR UPDATE`, advisory locks, and partial unique indexes created at runtime are all unavailable. Migration SQL is unaffected. |
| Importing `@/generated/prisma*` directly is an ESLint error outside `src/server/db/**`, `src/server/tenant/**`, `src/server/auth/**` | `eslint.config.mjs` `no-restricted-imports` | New enum types (`OrderState`, `ClaimStatus`, …) must be **re-exported from a sanctioned module** (recommend `src/server/db/tenant-scoped.ts` or a new `src/server/db/enums.ts`) before feature code can name them. This is easy to miss and will fail the lint gate. |
| `createLimiter()` in `src/server/rate-limit.ts` is module-private | `src/server/rate-limit.ts` (no `export` keyword) | New limiters must be **added as new exported consts inside that file**, not built by importing the factory elsewhere. |
| One Redis namespace per module (C-11) | `src/server/tenant/cache.ts` header | `cart:`, `idem:` and any new prefix each need their own owning module. `tenant:host:` must not be touched from them. |
| All user-facing copy lives in `src/lib/strings.ts`, never inline JSX | `src/lib/strings.ts` (C-14) | New namespaces needed: `strings.product`, `strings.cart`, `strings.checkout`, `strings.orderStatus`, `strings.claims`, `strings.paymentSettings`; plus a new key under the existing `strings.entitlements` for the product cap. |
| Storefront routes are reached only via subdomain rewrite to `/s/{slug}/**`; direct `/s/...` paths return 404 | `src/proxy.ts` | All customer-facing pages (catalog, PDP, cart, checkout, tracking) live under `src/app/s/[slug]/**`. |
| Dashboard pages call `requireMerchantContext()` themselves — no layout-level auth | `src/server/merchant/context.ts` header | Each of `/dashboard/products`, `/orders`, `/claims`, `/settings/payment` calls it directly. |
| `requireMerchantContext()` takes no parameters, ever; `tests/unit/no-tenant-id-param.test.ts` fails the build if it grows one | `src/server/merchant/context.ts` | No `getOrderForMerchant(tenantId, …)` helpers under `src/server/merchant/**`. |

---

## Payment Rails: the D-15 Blocker, Resolved

This section is the deliverable for D-15 and supersedes the MEDIUM-confidence note in `.planning/STATE.md` § Blockers/Concerns.

### Verified operator strings (Cameroon, current as of research date)

| Operator | Purpose | Exact string | Parametrized? | Confidence | Source |
|----------|---------|--------------|---------------|-----------|--------|
| MTN Cameroon | MoMo main menu | `*126#` | No | **HIGH** | [CITED: mtn.cm/helppersonal/momo-account/] — official |
| MTN Cameroon | **Merchant payment** | `*126*4*XXXXXX*Amount#` where `XXXXXX` is the merchant's **6-digit MTN merchant code** and `Amount` the invoice amount; confirmed with the customer's MoMo PIN | **Yes — fully** | **HIGH** | [CITED: mtn.cm/helppersonal/momo-bills-payment/] — official; independently corroborated |
| MTN Cameroon | Transaction history | `*126*7*2#` | Yes | HIGH | [CITED: mtn.cm/helppersonal/momo-bills-payment/] |
| MTN Cameroon | Send money to a phone number (P2P) | `*126#` → `1` (money transfer) → `1` MTN / `2` non-MTN → number → amount → PIN | **No — menu only** | HIGH (that it is menu-driven) | [CITED: mtn.cm/helppersonal/momo-account/] — official |
| Orange Cameroon | Orange Money main menu | `#150#` | No | **HIGH** | [CITED: orange.cm "Codes utiles" — `#150#` = "Portemonnaie sécurisé"] — official |
| Orange Cameroon | **Merchant payment (Flash Pay)** | `#150*47#`, then type the merchant code, then the OM PIN | **No — entry point only; no amount or code parameter** | **HIGH** | [CITED: orangemoney.orange.cm/fr/om-paiement/flash-pay.html] — official |
| Orange Cameroon | Send money to a phone number (P2P) | `#150#` → select "transfert d'argent" → number → amount → PIN | **No — menu only** | HIGH | [CITED: orange.cm/fr/om-gestion-de-compte/transfert-d-argent.html] — official |
| Orange Cameroon | (precedent only) Airtime credit transfer | `#144*numéro*montant#` | Yes | HIGH | [CITED: orange.cm "Codes utiles"] — shows Orange *does* publish parametrized strings; the OM equivalent is simply not published |

**Negative claim, verified:** Neither MTN Cameroon nor Orange Cameroon publishes a one-shot parametrized *person-to-person send-money* USSD string in their official documentation. Both P2P flows are interactive menus. Third-party blog posts that claim strings like `*126*1*<number>*<amount>#` were checked against `mtn.cm` and are **not** corroborated by the operator — treat as `[ASSUMED]` and do not ship. This was verified by reading the official MTN MoMo account-management and bill-payment pages, and the official Orange Cameroun money-transfer and Flash Pay pages, not by absence-of-search-result reasoning.

### The design consequence the planner must absorb

Both parametrizable merchant-payment paths require an **operator-issued merchant code**, which is a separate commercial registration (MTN MoMoPay / Orange "code marchand"). A typical Douala SME on this platform receives money into a **personal Mobile Money wallet identified by a phone number** and has no merchant code.

That produces three tiers of tap-to-dial quality, and the payment-settings model must be able to express all three:

| Merchant setup | Android experience | iOS experience | Deep link |
|----------------|-------------------|----------------|-----------|
| MTN merchant code configured | **Best.** One tap opens the dialer pre-filled with code + exact amount. Customer presses call, enters PIN. | Manual copy only | `tel:*126*4*<code>*<amount>%23` |
| Orange merchant code configured | **Partial.** One tap opens the OM merchant-payment menu; customer still types the merchant code and amount. | Manual copy only | `tel:%23150*47%23` |
| Personal wallet only (**expected majority**) | **Menu shortcut only.** Opens the MoMo/OM root menu; the customer does the whole transfer by hand. Arguably worse than nothing, because it hides the number they need to type. | Manual copy only | `tel:*126%23` / `tel:%23150%23` — **recommend not offering this; show manual copy instead** |

**Recommendation (prescriptive):**
1. Manual copy is the **default and always-rendered** path on every platform: receiving number and exact XAF amount as large, selectable text with an explicit copy button. This is what D-15 mandates unconditionally and what CHK-03 calls the iOS fallback.
2. Render the `tel:` tap-to-dial button **only** when (a) the visitor is not iOS **and** (b) the selected operator has a merchant code configured. Anything less specific produces a button that makes the flow worse.
3. Model merchant code as **optional** per operator (`mtnMerchantCode`, `orangeMerchantCode`), separate from the required receiving number. D-17's "no verification" applies to both.
4. Never fail a checkout because a merchant code is absent — it is an enhancement, not a requirement.

### `tel:` URI mechanics

- **iOS:** Apple's official documentation states: *"To prevent users from maliciously redirecting phone calls or changing the behavior of a phone or account, the Phone app supports most, but not all, of the special characters in the `tel` scheme. Specifically, if a URL contains the `*` or `#` characters, the Phone app does not attempt to dial the corresponding phone number."* [CITED: developer.apple.com — Phone Links, iPhone URL Scheme Reference] — **HIGH confidence.** Percent-encoding as `%2A`/`%23` does not work around it; the dialer simply does not open. Detect iOS and render manual copy; do not render a dead button.
- **Android:** `tel:` links open the dialer pre-filled. The browser cannot auto-dial — the user presses the call button. That is acceptable and is what "tap-to-dial assist" means in CHK-03. `[VERIFIED: cross-referenced across Apple developer forums + tel-link tooling docs]` — MEDIUM-HIGH.
- **Encoding:** `#` **must** be percent-encoded as `%23` inside the `href`, otherwise the browser treats it as a fragment delimiter and truncates the URI. `*` may be left literal. Orange's own site links its `#…#` codes as clickable dial links, which is precedent that the pattern works in-market. `[CITED: orange.cm "Codes utiles" — "cliquez directement sur ces codes… pour composer le numéro automatiquement"]`
- **Never** build the string client-side from user-controllable input. Build it server-side in the RSC from the tenant's stored settings and the server-computed amount, and validate the merchant code against `/^\d{6}$/` (MTN) before interpolation.

### WhatsApp deep link (CHK-02 / D-01)

Official format: `https://wa.me/<number>?text=<urlencodedtext>` where `<number>` is a full international number with **no `+`, no leading zeroes, no brackets, no dashes or spaces**. [CITED: faq.whatsapp.com — "How to use click to chat"] — HIGH.

For Cameroon that is `237` + the 9-digit national number, e.g. `https://wa.me/2376XXXXXXXX?text=…`. Encode the message body with `encodeURIComponent`. Keep the pre-filled message compact (order number, tracking link, item lines, total) — very long `text` values are truncated by some clients, so put the tracking URL near the top.

Per D-01, the `Order` row and its tracking token must exist **before** the redirect to `wa.me` — construct the message server-side in the placement action's response, then navigate.

### Cameroon phone-number validation (discretion item)

Mobile numbers are **9 digits beginning with `6`**, dialled internationally as `+237 6XXXXXXXX`. Block allocations, widely reported but not read from an ART primary source in this session:

| Block | Operator | Confidence |
|-------|----------|-----------|
| `650`–`654`, `67X`, `68X` | MTN Cameroon | MEDIUM `[ASSUMED]` |
| `655`–`659`, `69X` | Orange Cameroun | MEDIUM `[ASSUMED]` |
| `66X` | Camtel / Nexttel | LOW `[ASSUMED]` |

**Cameroon has mobile number portability**, so a prefix indicates the *original allocation*, not the current network. `[VERIFIED: cross-referenced across multiple current Cameroon telecom sources]` — MEDIUM.

**Recommendation:** validate format strictly (`/^6\d{8}$/` after stripping `+237`, spaces, dots and dashes; store normalized as `2376XXXXXXXX`). Do **not** hard-reject a number whose prefix disagrees with the selected operator — show a soft inline warning at most. Hard-rejecting would lock out ported numbers, which is a real and growing population, and D-17 has already settled that the merchant is trusted here.

---

## Standard Stack

### Core (already installed — no action)

| Library | Version | Purpose | Why standard |
|---------|---------|---------|--------------|
| `next` | 16.3.1 | App Router, Server Actions, Route Handlers, `after()` | Already the project baseline |
| `@prisma/client` + `prisma` + `@prisma/adapter-pg` | 7.9.1 | Schema, migrations, tenant-scoped queries | Already wired in `src/server/db/base.ts` |
| `zod` | 4.4.3 | Every server-action input boundary | Already the convention in `merchantAction` |
| `@upstash/redis` | 1.38.2 | Guest cart, idempotency keys | Already used by `src/server/tenant/cache.ts` |
| `@upstash/ratelimit` | 2.0.8 | Claim/checkout throttling | Already used by `src/server/rate-limit.ts` |
| `react-hook-form` + `@hookform/resolvers` | 7.85.0 / 5.9.0 | Product form, claim form, checkout form | Already the convention |
| `sharp` | 0.35.3 | Image enhancement | **Already present in `node_modules`** as a Next.js dependency, but **not a direct dependency** — must be added to `package.json` explicitly so it is not silently dropped by a Next upgrade |

### Supporting (new installs required)

| Library | Verified version | Purpose | When to use |
|---------|-----------------|---------|-------------|
| `@aws-sdk/client-s3` | 3.1116.0 `[VERIFIED: npm registry]` | R2 client (S3-compatible) | `PutObjectCommand`, `GetObjectCommand` for derivative write-back |
| `@aws-sdk/s3-request-presigner` | 3.1116.0 `[VERIFIED: npm registry]` | `getSignedUrl` for browser-direct PUT | Minting presigned upload URLs in a Server Action |
| `resend` | 6.22.0 `[VERIFIED: npm registry]` | Merchant claim-notification email (D-13) | One transactional send, fired from `after()` |
| `nanoid` | 6.0.1 `[VERIFIED: npm registry]` | Human-readable order numbers | Customer reads the order number back over WhatsApp; not for the tracking token (see below) |

> `nanoid@3.3.18` is currently present transitively. Install `nanoid@^6` explicitly if used; do not rely on the transitive copy.

### Deliberately NOT installed

| Considered | Verdict | Reason |
|------------|---------|--------|
| `zustand` (in `CLAUDE.md`'s stack table) | **Skip in this phase** | The cart's source of truth is Redis, reached through Server Actions. A client store would be a third copy of cart state alongside the cookie and Redis, and the React Compiler already removes the memoization busywork that motivates it. Revisit only if a genuinely optimistic multi-step cart UI appears. |
| `date-fns` | Skip | `Intl.DateTimeFormat` covers order timestamps; no date math beyond `new Date()` is needed here. |
| A UUID library | Skip | Prisma `@default(cuid())` is already the project's id convention. |
| `next-safe-action` | Skip | `merchantAction` + the `{ ok, error }` union is the established contract (documented explicitly in `src/server/merchant/action.ts`). |
| A state-machine library (xstate etc.) | Skip | Seven states and one transition table. A `Readonly<Record<OrderState, readonly OrderState[]>>` mirrors the existing `PLANS` / `TENANT_SCOPED_MODELS` registry discipline and needs no dependency. |
| Postgres RLS | Skip (per `CLAUDE.md` Alternatives Considered) | Explicitly deferred to post-V1 hardening. |

**Installation:**

```bash
npm install @aws-sdk/client-s3@3.1116.0 @aws-sdk/s3-request-presigner@3.1116.0 resend@6.22.0 nanoid@6.0.1 sharp@0.35.3
```

New environment variables to add to `src/env.ts` (which is the only sanctioned reader of `process.env`):

```
R2_ACCOUNT_ID           # required
R2_ACCESS_KEY_ID        # required
R2_SECRET_ACCESS_KEY    # required
R2_BUCKET               # required
R2_PUBLIC_BASE_URL      # required — the public/CDN origin derivatives are served from
RESEND_API_KEY          # optional; absent => degrade to console.warn, never fail a claim
RESEND_FROM_EMAIL       # optional, paired with the above
```

Follow the `UPSTASH_*` precedent: Resend is `.optional()` and degrades loudly rather than failing boot, because a missing email key must never take claim submission offline. The `R2_*` set is **required** — a missing bucket makes product creation impossible, and `@t3-oss/env-nextjs` failing at boot is strictly better than discovering it on the merchant's first upload.

---

## Package Legitimacy Audit

slopcheck 0.6.1 was installed and run against the npm registry on 2026-08-23. The scan completed (`4 OK`); the subsequent `npm install` subprocess failed on this Windows host, which is irrelevant — the verification is the scan, and nothing was installed.

| Package | Registry | Age | Downloads (last week) | Source repo | slopcheck | Disposition |
|---------|----------|-----|----------------------|-------------|-----------|-------------|
| `@aws-sdk/client-s3` | npm | since 2020-01-14 | 41,103,885 | github.com/aws/aws-sdk-js-v3 | `[OK]` | Approved |
| `@aws-sdk/s3-request-presigner` | npm | since 2019-07-12 | (same monorepo) | github.com/aws/aws-sdk-js-v3 | `[OK]` | Approved |
| `resend` | npm | since 2017-02-25 | 9,963,635 | github.com/resend/resend-node | `[OK]` | Approved |
| `nanoid` | npm | since 2017-08-06 | 237,951,165 | github.com/ai/nanoid | `[OK]` | Approved |
| `sharp` | npm | since 2013-08-20 | 88,795,721 | github.com/lovell/sharp | not scanned (already in tree) | Approved — already resolved in `node_modules` at 0.35.3 |

`npm view <pkg> scripts.postinstall` returned empty for all five — no postinstall scripts, no network-calling install hooks.

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged `[SUS]`:** none.

All package names above were additionally corroborated against official documentation (Cloudflare R2's own AWS-SDK-v3 example names `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`; Resend's official Next.js guide names `resend`).

---

## Architecture Patterns

### System Architecture Diagram

```
                              ┌──────────────────────────────────────┐
   MERCHANT (authenticated)   │  {slug}.einort.com  →  proxy.ts      │   CUSTOMER (anonymous)
                              │  rewrites to /s/{slug}/**            │
            │                 └──────────────────────────────────────┘                │
            │                                                                          │
            ▼                                                                          ▼
  /dashboard/products                                                        /s/[slug]  catalog
  /dashboard/orders                                                          /s/[slug]/p/[slug]  PDP
  /dashboard/claims                                                          /s/[slug]/cart
  /dashboard/settings/payment                                                /s/[slug]/checkout
            │                                                                /s/[slug]/order/[token]
            │                                                                          │
            ▼                                                                          ▼
  requireMerchantContext()                                            resolveTenantBySlug(slug)
  (session → tenantId, plan,                                          (host → tenantId, Redis-cached)
   canWrite)                                                                           │
            │                                                                          │
            ▼                                                                          ▼
  merchantAction({mode:"write"})                             ┌────────────────────────────────────┐
   ├─ trial/read-only gate                                   │  addToCart (Server Action)         │
   ├─ zod parse                                              │   ├─ mint opaque cartId cookie     │
   └─ handler(ctx, input)                                    │   │   (host-scoped, HttpOnly)      │
            │                                                │   └─ Redis  cart:{cartId}          │
            │                                                │       {tenantId, [{variantId,qty}]}│
            ▼                                                └────────────────────────────────────┘
  ┌──────────────────────────┐                                              │
  │ assertProductLimit(ctx)  │  ← PLANS[tier].limits.products               ▼
  └──────────────────────────┘                            ┌─────────────────────────────────────┐
            │                                             │ placeOrder (Server Action)          │
            ▼                                             │  0. rate limit + Redis idempotency  │
  scopedDb(tenantId)  ── Prisma Client Extension           │  1. re-read variants from DB (TEN-08)│
    injects tenantId into every                            │  2. sort items by variantId          │
    where / data / upsert                                  │  3. $transaction:                    │
            │                                              │     • conditional updateMany decrement│
            ▼                                              │     • create Order + OrderItems       │
  ┌───────────────────────────────────────────┐            │     • create genesis OrderEvent       │
  │ Postgres (Neon, shared schema, tenantId)  │◄───────────┤  4. mint tracking token → hash in DB  │
  │  Product ─┬─ ProductVariant (stock)       │            └─────────────────────────────────────┘
  │           └─ ProductImage                 │                             │
  │  Category                                 │              ┌──────────────┴──────────────┐
  │  Order ─┬─ OrderItem (price snapshot)     │              ▼                             ▼
  │         ├─ OrderEvent (append-only audit) │      channel = WHATSAPP/COD        channel = MANUAL_TRANSFER
  │         └─ PaymentClaim                   │      → ORDER_PLACED                → ORDER_PLACED
  │  MerchantPaymentSettings                  │      → (merchant) CONFIRMED          → PAYMENT_PENDING
  └───────────────────────────────────────────┘              │                             │
            ▲                                                ▼                             ▼
            │                                        wa.me deep link          instructions page:
  ┌─────────┴──────────────┐                         (pre-filled cart)        • receiving number
  │ transitionOrder()      │                                                  • exact XAF amount
  │  • validate against    │                                                  • copy button (always)
  │    ORDER_TRANSITIONS   │                                                  • tel: USSD (Android +
  │    + channel rule      │                                                    merchant code only)
  │  • hold/release stock  │                                                          │
  │  • append OrderEvent   │                                                          ▼
  │    (same transaction)  │◄──────────────────────────────────────  submitClaim (token-gated)
  └────────────────────────┘                                          • rate limited
            ▲                                                         • reference normalized
            │                                                         • unique(tenantId, refNorm)
            │                                                         • screenshot via presigned PUT
            │                                                                  │
            │                                                                  ▼
            │                                                          → PAYMENT_CLAIMED
            │                                                                  │
   merchant confirm/reject ◄─── /dashboard/claims queue ◄─── after(): Resend email + badge count
            │
            ├─ confirm → CONFIRMED (stock stays held) → FULFILLED
            └─ reject (reason required) → DISPUTED (stock released)
                                              │
                                              └─ customer resubmits → PAYMENT_CLAIMED (stock re-held)


   IMAGE INGEST (product images CAT-02 + claim screenshots CHK-04 + Phase 4 logos ONB-03)

   Browser ──1. requestUploadUrl (Server Action) ──► API mints presigned PUT
                                                     key: tenants/{tenantId}/{kind}/{uuid}/original
           ──2. PUT bytes DIRECTLY to R2 ──────────► R2   (never transits Vercel; Next 16 caps
                                                           Server Action bodies at 1 MB)
           ──3. finalizeUpload (Server Action) ────► Node-runtime handler:
                                                       GetObject original
                                                       → sharp: rotate() • resize(cover, ratio)
                                                                • normalise() • sharpen() • webp()
                                                       → PutObject derivatives (thumb/card/detail)
                                                       → write ProductImage / claim.screenshotKey row
```

### Recommended Project Structure

```
src/
├── app/
│   ├── s/[slug]/
│   │   ├── page.tsx                    # catalog grid (replaces the Phase-1 placeholder conditionally)
│   │   ├── p/[productSlug]/page.tsx    # PDP + variant picker + add-to-cart island
│   │   ├── cart/page.tsx               # cart review / order summary (CHK-01)
│   │   ├── checkout/page.tsx           # channel picker (CHK-02) + operator picker (D-16)
│   │   └── order/[token]/
│   │       ├── page.tsx                # status (CHK-05) + claim form (CHK-04) + resubmit (D-11)
│   │       └── claim-form.tsx          # client island
│   ├── (dashboard)/dashboard/
│   │   ├── products/{page.tsx,new/page.tsx,[id]/page.tsx,product-form.tsx}
│   │   ├── orders/{page.tsx,[id]/page.tsx}
│   │   ├── claims/page.tsx             # ORD-03 queue
│   │   └── settings/payment/page.tsx   # D-14
│   └── api/upload/finalize/route.ts    # Node runtime — Sharp lives here
├── server/
│   ├── catalog/{actions.ts,queries.ts,slug.ts}
│   ├── orders/
│   │   ├── state-machine.ts            # ORDER_TRANSITIONS registry — pure, unit-testable
│   │   ├── transition.ts               # the single transitionOrder() chokepoint
│   │   ├── place.ts                    # placeOrder + atomic stock hold
│   │   ├── stock.ts                    # holdStock / releaseStock (idempotent)
│   │   ├── tracking-token.ts           # mint / hash / verify — pure, unit-testable
│   │   └── actions.ts                  # "use server" surface
│   ├── claims/{actions.ts,reference.ts,notify.ts}
│   ├── cart/{cache.ts,actions.ts}      # cart: Redis namespace owner (C-11)
│   ├── idempotency/cache.ts            # idem: Redis namespace owner (C-11)
│   ├── images/{r2.ts,pipeline.ts,actions.ts}
│   ├── payments/{ussd.ts,whatsapp.ts,phone.ts}   # pure string builders — unit-testable
│   ├── db/{tenant-scoped.ts,enums.ts}  # enums.ts re-exports generated enums past the lint zone
│   ├── entitlements/plans.ts           # + productLimitFor()
│   └── rate-limit.ts                   # + 3 new exported limiters
└── lib/strings.ts                      # + 6 new copy namespaces
```

---

### Pattern 1: Prisma schema — tenant-scoped models with composite FKs

**What:** Every new model carries `tenantId String` (required, no default) and is registered in `TENANT_SCOPED_MODELS`. Intra-tenant relations use a **composite foreign key on `(tenantId, id)`** so a cross-tenant reference is rejected by Postgres, not merely by convention.

**When to use:** every relation between two tenant-scoped models in this phase.

**Why it matters:** `scopedDb` guarantees you cannot *read* another tenant's row, but nothing stops a forged `categoryId` in a product-create payload from *pointing at* another tenant's category — the FK would validate, and the join would then be filtered by `scopedDb` into a confusing empty result. The composite FK makes the write itself fail at the database.

```prisma
enum OrderState {
  ORDER_PLACED
  PAYMENT_PENDING
  PAYMENT_CLAIMED
  CONFIRMED
  DISPUTED
  FULFILLED
}

enum OrderChannel {
  WHATSAPP
  MANUAL_TRANSFER
  CASH_ON_DELIVERY
}

enum PaymentOperator {
  MTN_MOMO
  ORANGE_MONEY
}

enum ClaimStatus {
  PENDING
  CONFIRMED
  REJECTED
}

enum EventActor {
  CUSTOMER
  MERCHANT
  SYSTEM
}

model Category {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  slug      String
  createdAt DateTime @default(now())

  products  Product[]

  @@unique([tenantId, id])     // enables the composite FK below
  @@unique([tenantId, slug])   // D-06: free-form but unique within the merchant
  @@index([tenantId])
  @@map("category")
}

model Product {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  slug        String
  description String?
  /// Whole XAF. No minor unit exists in common use, so no Decimal and no
  /// conversion. Overridable per variant.
  basePriceXaf Int
  /// D-08: deactivate-only. There is no delete path anywhere in this phase.
  active      Boolean  @default(true)

  /// D-05: at most two option axes. NULL means "this axis is unused".
  option1Name String?
  option2Name String?

  categoryId  String?
  category    Category? @relation(fields: [tenantId, categoryId], references: [tenantId, id])

  variants    ProductVariant[]
  images      ProductImage[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, id])
  @@unique([tenantId, slug])
  @@index([tenantId, active])
  @@index([tenantId, categoryId])
  @@map("product")
}

model ProductVariant {
  id        String  @id @default(cuid())
  tenantId  String
  productId String
  product   Product @relation(fields: [tenantId, productId], references: [tenantId, id])

  /// EMPTY STRING, NOT NULL — see Pitfall 2. Postgres treats NULLs as distinct
  /// in a unique index, so two all-NULL variant rows would both be permitted
  /// and the matrix would silently accept duplicates.
  option1Value String @default("")
  option2Value String @default("")

  /// NULL inherits Product.basePriceXaf. Whole XAF.
  priceXaf  Int?
  /// D-04 / CAT-03: the ONLY place stock lives. Every product has at least one
  /// variant row, so there is exactly one decrement code path.
  stock     Int     @default(0)
  sku       String?
  active    Boolean @default(true)

  @@unique([tenantId, id])
  @@unique([tenantId, productId, option1Value, option2Value])
  @@index([tenantId, productId])
  @@map("product_variant")
}

model ProductImage {
  id        String  @id @default(cuid())
  tenantId  String
  productId String
  product   Product @relation(fields: [tenantId, productId], references: [tenantId, id])

  /// R2 object key prefix; derivative suffixes are appended by the pipeline.
  storageKey String
  /// D-10: 0 is the primary/hero image used everywhere a single thumbnail is needed.
  position   Int
  width      Int
  height     Int
  createdAt  DateTime @default(now())

  @@unique([tenantId, productId, position])
  @@index([tenantId, productId])
  @@map("product_image")
}

model Order {
  id          String       @id @default(cuid())
  tenantId    String
  /// Short, typeable, read back over WhatsApp. nanoid over an unambiguous alphabet.
  orderNumber String
  state       OrderState
  channel     OrderChannel

  customerName    String
  customerPhone   String
  deliveryAddress String?
  customerNote    String?

  subtotalXaf Int
  totalXaf    Int

  /// D-12. SHA-256 hex of the plaintext token. The plaintext is NEVER persisted.
  trackingTokenHash String
  /// Idempotent stock-hold marker — see Pattern 2b. Guards double release.
  stockHeld   Boolean  @default(false)

  items   OrderItem[]
  events  OrderEvent[]
  claims  PaymentClaim[]

  placedAt    DateTime  @default(now())
  confirmedAt DateTime?
  updatedAt   DateTime  @updatedAt

  @@unique([tenantId, id])
  @@unique([tenantId, orderNumber])
  /// Deliberately GLOBAL, like StoreSlugHistory.slug — a collision anywhere is a
  /// correctness bug, and the constraint costs nothing.
  @@unique([trackingTokenHash])
  @@index([tenantId, state, placedAt])
  @@map("order")
}

model OrderItem {
  id       String @id @default(cuid())
  tenantId String
  orderId  String
  order    Order  @relation(fields: [tenantId, orderId], references: [tenantId, id])

  /// Plain columns, NOT relations. D-08 keeps products forever, but a merchant
  /// can rename or reprice one; an order must show what was actually bought at
  /// the price actually charged.
  productId    String
  variantId    String
  productName  String
  variantLabel String
  unitPriceXaf Int
  quantity     Int
  lineTotalXaf Int
  imageKey     String?

  @@index([tenantId, orderId])
  @@map("order_item")
}

/// ORD-05. APPEND-ONLY. Nothing in this codebase may update or delete a row here.
model OrderEvent {
  id       String @id @default(cuid())
  tenantId String
  orderId  String
  order    Order  @relation(fields: [tenantId, orderId], references: [tenantId, id])

  /// NULL only on the genesis event written by placeOrder.
  fromState  OrderState?
  toState    OrderState
  actor      EventActor
  /// user.id when actor = MERCHANT. NULL for CUSTOMER and SYSTEM.
  actorUserId String?
  /// D-11: the merchant's rejection reason, shown to the customer.
  reason     String?
  createdAt  DateTime @default(now())

  @@index([tenantId, orderId, createdAt])
  @@map("order_event")
}

model PaymentClaim {
  id       String @id @default(cuid())
  tenantId String
  orderId  String
  order    Order  @relation(fields: [tenantId, orderId], references: [tenantId, id])

  operator PaymentOperator
  /// Exactly as the customer typed it — this is what the merchant compares
  /// against their SMS receipt.
  reference String
  /// ORD-04's actual uniqueness key. Uppercased, non-alphanumerics stripped.
  referenceNormalized String
  amountClaimedXaf    Int
  /// R2 object key. NULL when the customer skipped the optional screenshot.
  screenshotKey String?

  status          ClaimStatus @default(PENDING)
  rejectionReason String?
  submittedAt     DateTime    @default(now())
  reviewedAt      DateTime?
  reviewedByUserId String?

  @@unique([tenantId, id])
  /// ORD-04. A unique index cannot be raced; an application-level count() can.
  @@unique([tenantId, referenceNormalized])
  @@index([tenantId, status, submittedAt])
  @@index([tenantId, orderId])
  @@map("payment_claim")
}

/// D-14 / D-16. One row per tenant. Deliberately NOT columns on Organization:
/// Organization is Better Auth's generated model with `input: false` markers,
/// and these fields are merchant-editable, so they belong behind scopedDb and
/// merchantAction rather than behind a widened Better Auth write path.
model MerchantPaymentSettings {
  id       String @id @default(cuid())
  tenantId String @unique

  /// Normalized to 2376XXXXXXXX (no +, no spaces) for wa.me.
  whatsappNumber     String?
  mtnMomoNumber      String?
  /// D-15: OPTIONAL. Present only for merchants registered for MTN MoMoPay.
  /// Six digits. Its presence is what unlocks the fully-parametrized tel: link.
  mtnMerchantCode    String?
  orangeMoneyNumber  String?
  /// D-15: OPTIONAL. Orange's #150*47# takes no parameters, so this improves
  /// only the on-screen instructions, not the deep link.
  orangeMerchantCode String?

  codEnabled   Boolean @default(true)
  payoutNotice String?

  updatedAt DateTime @updatedAt

  @@map("merchant_payment_settings")
}
```

Register every one of these in `src/server/db/tenant-scoped.ts`:

```ts
const REGISTERED_MODELS: readonly Prisma.ModelName[] = [
  "StoreSlugHistory",
  "Category", "Product", "ProductVariant", "ProductImage",
  "Order", "OrderItem", "OrderEvent", "PaymentClaim",
  "MerchantPaymentSettings",
];
```

`tests/isolation/model-registry-drift.test.ts` already exists and will fail if any of these is missed — good, but the planner should not rely on discovering it there.

**Note on `MerchantPaymentSettings`:** `tenantId String @unique` (not `@@unique([tenantId, …])`) means `findUnique({ where: { tenantId } })` and `upsert({ where: { tenantId }, … })` work directly, and `scopedDb`'s `upsert` branch already stamps both `where` and `create`. Do not add a second unique key.

---

### Pattern 2: Atomic, race-safe stock decrement (CAT-03 / D-04)

**What:** A single conditional `UPDATE` that carries its own precondition, checked with `count === 0`.

**Recommended approach — conditional `updateMany` with a `stock >= quantity` guard.**

```ts
const { count } = await tx.productVariant.updateMany({
  where: { id: variantId, active: true, stock: { gte: quantity } },
  data:  { stock: { decrement: quantity } },
});
if (count === 0) throw new OutOfStockError(variantId);
```

**Why this is correct, not merely convenient.** PostgreSQL's official documentation on the Read Committed isolation level states: *"If the first updater commits, the second updater will ignore the row if the first updater deleted it, otherwise it will attempt to apply its operation to the updated version of the row. **The search condition of the command (the `WHERE` clause) is re-evaluated to see if the updated version of the row still matches the search condition.** If so, the second updater proceeds with its operation using the updated version of the row."* [CITED: postgresql.org/docs/current/transaction-iso.html] — **HIGH confidence.**

That single sentence is the whole guarantee: two concurrent orders for the last unit both target the same row; the second one blocks on the row lock, then re-checks `stock >= quantity` against the *committed* new value, fails the predicate, updates zero rows, and `count === 0` sends it down the out-of-stock path. No retry loop, no explicit isolation level, no raw SQL.

**Alternatives considered and rejected:**

| Instead of | Could use | Why rejected |
|------------|-----------|--------------|
| Conditional `updateMany` | `SELECT … FOR UPDATE` then `UPDATE` | Requires `$queryRaw`, which `eslint.config.mjs` bans outright — and even if allowed, it is two round trips and a longer lock hold for an identical guarantee. |
| Conditional `updateMany` | Prisma's documented optimistic-concurrency `version` column pattern | The `stock >= quantity` predicate *is* the version check, and it is semantically exactly what CAT-03 asks for. A separate `version` column adds a read-then-write round trip and a retry loop for no additional safety. |
| Conditional `updateMany` | `isolationLevel: Serializable` + P2034 retry | Correct but strictly more expensive: serialization failures must be caught and retried, and READ COMMITTED already gives the needed guarantee for a single-row conditional update. |
| Per-variant Redis lock | — | Adds a distributed-lock failure mode (lock held after a crashed function) in front of a database that already solves this. |

**Deadlock avoidance (required):** an order with two lines can deadlock against a concurrent order with the same two lines in the opposite order. **Sort line items by `variantId` before the decrement loop.** This is one line and it removes the entire class:

```ts
const lines = [...input.items].sort((a, b) => a.variantId.localeCompare(b.variantId));
```

**Pattern 2b — idempotent hold/release.** D-04 requires releasing stock when a claim is rejected and re-holding it on an accepted resubmission. A double-release silently *increases* inventory, which is the same bug as overselling pointed the other way. Guard it with the same primitive, on the `Order` row:

```ts
// release — runs at most once
const { count } = await tx.order.updateMany({
  where: { id: orderId, stockHeld: true },
  data:  { stockHeld: false },
});
if (count === 0) return; // already released; do not touch variant stock
for (const item of order.items) {
  await tx.productVariant.updateMany({
    where: { id: item.variantId },
    data:  { stock: { increment: item.quantity } },
  });
}
```

The re-hold on resubmission uses the placement guard again and **can legitimately fail** if the units sold out during the dispute window. Recommendation: re-hold at the `DISPUTED → PAYMENT_CLAIMED` transition (the moment the customer re-commits, which is the closest analogue to "the same way a fresh order would" in D-04), and if the re-hold fails, refuse the resubmission with an explicit out-of-stock message rather than moving the order and leaving stock unheld.

---

### Pattern 3: The order state machine as a registry + one chokepoint

**What:** A pure transition table plus a single `transitionOrder()` function that is the only writer of `Order.state` and the only writer of `OrderEvent`. Mirrors the `PLANS` / `TENANT_SCOPED_MODELS` discipline: the rules are *data*, and drifting from them is a compile error.

**"Cart" is not an `Order` row.** ORD-01's first state lives in Redis (Pattern 7). The first persisted state is `ORDER_PLACED`. Document this in the module header so nobody adds a `CART` enum member later.

```ts
// src/server/orders/state-machine.ts  — pure, no I/O, unit-testable with no DB
import type { OrderState, OrderChannel } from "@/server/db/enums";

export const ORDER_TRANSITIONS: Readonly<
  Record<OrderState, readonly OrderState[]>
> = {
  ORDER_PLACED:    ["PAYMENT_PENDING", "CONFIRMED"],
  PAYMENT_PENDING: ["PAYMENT_CLAIMED"],
  PAYMENT_CLAIMED: ["CONFIRMED", "DISPUTED"],
  // D-11: recoverable. A corrected claim re-enters review.
  DISPUTED:        ["PAYMENT_CLAIMED"],
  CONFIRMED:       ["FULFILLED"],
  FULFILLED:       [],
} as const;

/**
 * D-02: PAYMENT_PENDING and PAYMENT_CLAIMED exist ONLY on the manual-transfer
 * path. D-03: DISPUTED is reachable only from a rejected claim, which is the
 * same path. Encoding this as a second, explicit rule rather than as three
 * separate transition tables keeps one readable graph.
 */
const CLAIM_ONLY_STATES: ReadonlySet<OrderState> = new Set([
  "PAYMENT_PENDING", "PAYMENT_CLAIMED", "DISPUTED",
]);

export function canTransition(
  channel: OrderChannel, from: OrderState, to: OrderState,
): boolean {
  if (!ORDER_TRANSITIONS[from].includes(to)) return false;
  if (CLAIM_ONLY_STATES.has(to) && channel !== "MANUAL_TRANSFER") return false;
  return true;
}
```

`Readonly<Record<OrderState, …>>` over a lookup-with-default is the point: adding a seventh state becomes a compile error at every incomplete table, exactly as `PLANS` does for a fourth tier.

```ts
// src/server/orders/transition.ts
export async function transitionOrder(
  tx: ScopedTx,
  args: {
    orderId: string;
    to: OrderState;
    actor: EventActor;
    actorUserId?: string;
    reason?: string;   // D-11: REQUIRED by the caller when to === "DISPUTED"
  },
): Promise<void> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: args.orderId },
    select: { id: true, state: true, channel: true },
  });

  if (!canTransition(order.channel, order.state, args.to)) {
    throw new InvalidTransitionError(order.state, args.to, order.channel);
  }

  // ORD-02: reaching CONFIRMED from PAYMENT_CLAIMED is only ever a merchant
  // act. The state graph alone does not say that; this does.
  if (args.to === "CONFIRMED" && args.actor !== "MERCHANT") {
    throw new InvalidTransitionError(order.state, args.to, order.channel);
  }

  await tx.order.update({
    where: { id: order.id },
    data: {
      state: args.to,
      ...(args.to === "CONFIRMED" ? { confirmedAt: new Date() } : {}),
    },
  });

  // ORD-05, in the SAME transaction as the state change. There is no code path
  // that can move an order without leaving a record, because there is no other
  // writer of Order.state anywhere in the codebase.
  await tx.orderEvent.create({
    data: scopedCreateData<Prisma.OrderEventUncheckedCreateInput>({
      orderId: order.id,
      fromState: order.state,
      toState: args.to,
      actor: args.actor,
      actorUserId: args.actorUserId ?? null,
      reason: args.reason ?? null,
    }),
  });
}
```

Add a lint-adjacent test that greps `src/` for `state:` writes to the `order` delegate outside `transition.ts`, in the spirit of the existing `tests/unit/no-tenant-id-param.test.ts`.

**Anti-patterns to avoid:**
- **A `status` string column with free-form values.** The Better Auth-generated models use `String` because the generator emitted them; new models should use Prisma enums so a `switch` over states is exhaustive at compile time.
- **Writing `OrderEvent` from the caller after `transitionOrder` returns.** Two statements means one can be forgotten or fail independently. Same transaction, same function, no exceptions.
- **Deriving state from claims.** `Order.state` is the authority; `PaymentClaim.status` is a detail of the current claim.

---

### Pattern 4: Tenant-scoped transactions

**What:** Call `$transaction` on the **extended** client, and keep the callback body inline.

```ts
const db = scopedDb(tenantId);
await db.$transaction(async (tx) => {
  // tx IS extended: the tenant-scope extension still injects tenantId.
}, { timeout: 15_000 });
```

At runtime, `tx` from an extended client's `$transaction` is itself extended, so `scopedDb`'s `$allOperations` argument-mutation still applies. The known Prisma issue in this area (prisma/prisma#20738) is about **TypeScript types**, not runtime behaviour; the maintainer-referenced PR #19565 made `tx` extended. `[VERIFIED: prisma/prisma#20738 + #19565 discussion]` — MEDIUM-HIGH.

**Important qualifier:** the *other* commonly-cited problem — extensions whose handlers issue their own additional queries escaping the transaction context (prisma/prisma#17948) — **does not apply here.** `scopedDb`'s extension only mutates `args` and calls `query(a)`; it issues no side queries. This distinction is worth a line in the plan so a reviewer who finds #17948 does not conclude the pattern is broken.

**Mandatory Wave-0 verification.** Phase 1 established the precedent of empirically proving extension behaviour rather than assuming it (`$queryRaw` is *not* intercepted — "verified empirically, not assumed"). Add the mirror test to `tests/isolation/`: inside `scopedDb(tenantA).$transaction(...)`, attempt `tx.product.updateMany({ where: { id: <tenantB's product id> }, … })` and assert `count === 0`. This is a two-line test that turns the MEDIUM-HIGH above into a HIGH the codebase owns.

**Typing.** `Omit<PrismaClient, runtime.ITXClientDenyList>` is what the generated client uses (`src/generated/prisma/internal/prismaNamespace.ts:1469` exports `Prisma.TransactionClient` this way), but naming `runtime.ITXClientDenyList` requires importing the generated client, which ESLint forbids outside `src/server/db/**`. **Declare `export type ScopedTx = …` once in `src/server/db/tenant-scoped.ts`** — the same file that already hosts `ScopedDb` and `ScopedCreateData` for exactly this reason — and import it from feature code. Alternatively, keep transaction bodies inline so TypeScript infers `tx` and the alias is never needed.

---

### Pattern 5: R2 presigned upload + Sharp enhancement (CAT-02 / D-07)

**What:** Three steps — mint, upload direct, finalize — with Sharp running only in the Node.js runtime.

**Why presigned is mandatory, not preferred:** Next.js 16's own docs state *"Action requests are capped at 1MB by default"* [CITED: `node_modules/next/dist/docs/01-app/02-guides/server-actions.md:83`]. A phone camera JPEG routinely exceeds that. `STACK.md`'s 4.5 MB figure is the Vercel *function* body limit, which is a different, looser ceiling — do not raise `serverActions.bodySizeLimit` as a workaround; that puts the bytes through Vercel compute for no benefit.

**Step 1 — mint (Server Action, `merchantAction({ mode: "write" })` for products):**

```ts
// src/server/images/r2.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",                                   // required by the SDK, unused by R2
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export function presignUpload(key: string, contentType: string) {
  return getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 },   // 5 min; R2 permits 1s–604800s
  );
}
```

[CITED: developers.cloudflare.com/r2/api/s3/presigned-urls/ — official; `region: "auto"` is documented as "Required by SDK but not used by R2"]

- **`ContentType` in the command is a security control, not metadata.** R2 rejects an upload whose actual `Content-Type` header differs, with `403 SignatureDoesNotMatch`. Restrict to an allowlist (`image/jpeg`, `image/png`, `image/webp`) server-side before signing.
- **Key layout is the tenant boundary in storage:** `tenants/{tenantId}/{kind}/{uuid}/original`. `tenantId` comes from `ctx.tenantId`, never from the request. `kind` ∈ `products` | `claims` | `logos` — the `logos` slot is what makes Phase 4's ONB-03 a reuse rather than a rewrite (D-07).
- The presigned URL grants a write to exactly one key with exactly one content type for five minutes. It cannot be replayed against another tenant's prefix.

**Step 2 — browser PUTs the bytes directly to R2.** Nothing to build server-side.

**Step 3 — finalize (Node.js runtime Route Handler, `src/app/api/upload/finalize/route.ts`):**

```ts
// NO `export const runtime = 'edge'` — Sharp needs native libvips.
export const maxDuration = 30;

const derived = await sharp(originalBuffer)
  .rotate()                                    // honour EXIF orientation FIRST
  .resize(target.w, target.h, { fit: "cover", position: "attention" })
  .normalise()                                 // stretch luminance 1st–99th percentile
  .modulate({ saturation: 1.06 })              // gentle; merchant photos are often flat
  .sharpen()                                   // fast mild sharpen, default params
  .webp({ quality: 82 })
  .toBuffer();
```

Sharp API signatures and defaults confirmed against the official reference [CITED: sharp.pixelplumbing.com/api-operation/]: `normalise([options])` defaults `{ lower: 1, upper: 99 }`; `sharpen([options])` with no args performs "fast mild sharpening"; `modulate([options])` takes `brightness`/`saturation`/`hue`/`lightness`; `gamma([gamma], [gammaOut])` defaults to 2.2. — HIGH.

Produce a **fixed** set of three derivatives (`thumb` 400×400, `card` 800×800, `detail` 1600×1600 — all square `cover` for grid consistency, which is the "aspect-ratio pipeline" CAT-02 asks for) and write each back with `PutObjectCommand`. Do not build a dynamic-size system. Run it synchronously in the request per `STACK.md` — a handful of derivatives on a few-MB photo completes in low hundreds of milliseconds, well inside `maxDuration = 30`.

**Reuse contract for Phase 4 (D-07).** Structure `src/server/images/pipeline.ts` around a small preset registry so Phase 4 adds a row rather than a module:

```ts
export const IMAGE_PRESETS = {
  product: { sizes: [400, 800, 1600], fit: "cover",   ratio: 1,    format: "webp" },
  claim:   { sizes: [1200],           fit: "inside",  ratio: null, format: "webp" },
  logo:    { sizes: [128, 512],       fit: "contain", ratio: 1,    format: "webp",
             background: { r: 0, g: 0, b: 0, alpha: 0 } },   // ← Phase 4 / ONB-03 slot
} as const;
```

**Claim screenshots use the same three steps** with `kind: "claims"` and an unauthenticated, token-gated, rate-limited mint action — not `merchantAction`.

---

### Pattern 6: The order-tracking token (D-12 / CHK-05)

**What:** A high-entropy random token in the URL path; only its SHA-256 hash is persisted.

```ts
// src/server/orders/tracking-token.ts — pure, no I/O, unit-testable
import { randomBytes, createHash } from "node:crypto";

/** 24 bytes → 192 bits → 32 base64url chars. Guessing is not a threat model. */
export function mintTrackingToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Deterministic and unsalted ON PURPOSE: the input is already 192 bits of
 *  entropy, so there is no dictionary to defend against, and the lookup must be
 *  a single indexed equality read. */
export function hashTrackingToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
```

**Why hash at rest:** the token is a bearer credential with no expiry and no second factor. Hashing means a database read — a backup, a Prisma Studio session, Phase 6's ADM-02 global claims ledger — cannot be turned into access to live customer orders. Cost: the plaintext exists exactly once, in the placement response. Accept that the merchant cannot later re-send a customer's link; if support needs that, the right answer is a "regenerate tracking link" action that mints a new token and invalidates the old, not storing plaintext.

**Why `randomBytes` and not `nanoid`:** `nanoid` is correct for the *order number* (short, human-readable, spoken over WhatsApp). For a security token, `node:crypto` is the zero-dependency, obviously-CSPRNG choice and needs no justification in review.

**Enumeration and leakage controls (all required):**
- Look up via `scopedDb(tenant.id).order.findFirst({ where: { trackingTokenHash } })` — the storefront's tenant already comes from the host, so the token lookup is *additionally* tenant-scoped for free.
- Return the identical `notFound()` for a malformed token, an unknown token, and a token belonging to another tenant. No distinguishable responses.
- Rate-limit the tracking route (Pattern 9) so a scripted walk is throttled even though 192 bits makes it futile.
- Set `Referrer-Policy: no-referrer` and `<meta name="robots" content="noindex, nofollow">` on `/s/[slug]/order/[token]` — the token is in the path, and a referrer header or a search crawler is the realistic leak, not brute force.
- **Known accepted residual:** the token appears in Vercel's request logs because it is a path segment. Document it; the alternative (fragment-only tokens read by client JS) costs more than it buys here.

---

### Pattern 7: Anonymous cart (CHK-01)

**What:** An opaque, host-scoped, HttpOnly cookie holding *only* a random cart id; the contents live in Redis; the contents hold *no money*.

```ts
// src/server/cart/cache.ts — sole owner of the `cart:` namespace (C-11)
const KEY_PREFIX = "cart:";
const TTL_SECONDS = 60 * 60 * 24 * 30;     // 30 days, per CLAUDE.md

export type StoredCart = {
  tenantId: string;                         // guards against a cookie replayed on another store
  items: { variantId: string; quantity: number }[];
  updatedAt: number;
};
```

Cookie:

```ts
(await cookies()).set("einort_cart", cartId, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: TTL_SECONDS,
  // NO `domain` option. Omitting it host-scopes the cookie to
  // {slug}.einort.com, so one merchant's cart cookie is never sent to
  // another merchant's storefront. Setting `domain: ".einort.com"` would
  // share one cart cookie across every tenant — a cross-tenant leak dressed
  // up as a convenience.
});
```

**Three non-negotiables:**
1. **No prices in the cart.** `{variantId, quantity}` only. Every displayed total is recomputed from the database on render, and re-derived again at placement (TEN-08). A cart that carries a price is a client-supplied price.
2. **The cart records its `tenantId`.** On read, compare it to the host-resolved tenant and discard the cart on mismatch. Cheap, and it makes the cookie useless if it ever escapes its host scope.
3. **Redis degrades the same way `tenant/cache.ts` does.** If Upstash is unconfigured, the cart is in-memory-for-one-request, i.e. effectively absent — warn loudly once per process; never throw. A missing cache must not take the storefront down.

**Pattern 7b — idempotent placement.** Before creating an order, `SET idem:{clientKey} → orderId NX EX 600`. On a duplicate key, return the cached order instead of creating a second one and decrementing stock twice. The client key is generated once per checkout-page mount (a `useId`/`crypto.randomUUID()` hidden field), not per submit. Own the `idem:` prefix in its own module per C-11.

---

### Pattern 8: Product-count entitlement (carried-forward 02-CONTEXT.md D-07)

`plans.ts` already declares `readonly products: number | null` with the comment *"ENFORCED FROM PHASE 3 (catalog). Registered now."* and `assert.ts` already declares `"products"` in `PlanLimitKey`. The values are already correct (Starter 50 / Business 250 / Professional `null`). **No registry change is needed** — only a resolver and a call site.

Mirror `memberLimitFor` exactly, in `plans.ts`:

```ts
/**
 * The organization's product cap. `null` is unlimited.
 *
 * Fails CLOSED for the same reason memberLimitFor does: an absent, null or
 * unrecognised tier resolves to the Starter cap, never to unlimited. Returning
 * `null` on an unknown tier would make a bad backfill grant every merchant an
 * unlimited catalogue.
 */
export function productLimitFor(org: { planTier?: string | null }): number | null {
  const tier = org.planTier;
  return isPlanTier(tier) ? PLANS[tier].limits.products : PLANS.starter.limits.products;
}
```

Call site, following `switchPlan`'s shape exactly (count first, refuse before the write):

```ts
export const createProduct = merchantAction({
  mode: "write",                       // the trial/read-only gate is the wrapper's job
  schema: createProductSchema,
  handler: async (ctx, input) => {
    const limit = limitFor(ctx, "products");     // already exported by assert.ts
    if (limit !== null) {
      const count = await scopedDb(ctx.tenantId).product.count({
        where: { active: true },                 // D-08: deactivated products don't count
      });
      if (count >= limit) {
        return { ok: false, error: { form: [
          strings.entitlements.productLimitReached
            .replace("{n}", String(limit))
            .replace("{plan}", strings.plan[ctx.plan.tier].name),
        ] } };
      }
    }
    // … create
  },
});
```

Two decisions worth stating in the plan:
- **Deactivated products do not count against the cap.** D-08 forbids deletion, so counting inactive rows would make the cap permanently ratchet down and give merchants no way to recover — which reads as a bug, not a limit.
- **The count-then-create is not transactionally atomic.** Two simultaneous creates could both pass at `limit - 1`. Accepted: the actor is a single merchant on a single dashboard, the overshoot is one row, and the alternative (a counter column or a serializable transaction) buys nothing at pilot scale. The `assertEntitlement`-style throwing guard in `assert.ts` remains available if a stricter gate is ever wanted.

Add the copy under the existing `strings.entitlements` namespace next to `memberLimitReached`.

---

### Pattern 9: Rate limiters

`createLimiter` is **module-private** in `src/server/rate-limit.ts`. Add new limiters *inside that file* as exported consts, each with its own `prefix` — the module header is explicit that a shared prefix lets one surface starve another.

| Export | Prefix | Suggested budget | Surface |
|--------|--------|------------------|---------|
| `orderPlacementLimiter` | `rl:order` | 10 / 5 m per IP | Each success writes an order and decrements stock — a flood is an inventory-denial attack, not just noise |
| `claimSubmissionLimiter` | `rl:claim` | 5 / 10 m per **order token hash**, plus an IP bucket | Per-order keying is the meaningful one: it caps resubmission spam on a single order (D-11) without punishing a shared NAT |
| `orderTrackingLimiter` | `rl:track` | 60 / 1 m per IP | Blunts a scripted walk of the token space |
| `uploadPresignLimiter` | `rl:upload` | 20 / 5 m per IP | The unauthenticated claim-screenshot mint path |

Keep the established contract: fail **open**, loudly, on transport failure and on missing Upstash config. An Upstash blip must not take checkout offline.

---

### Pattern 10: Duplicate transaction reference (ORD-04)

**A database unique index, not an application `count()`.** Two claims submitted in the same millisecond both pass a `findFirst` check; only one survives a unique index.

```ts
// src/server/claims/reference.ts — pure, unit-testable
/**
 * Operators format references inconsistently across SMS receipts, the MoMo app
 * and the USSD confirmation, and customers retype them by hand. Comparing raw
 * strings would let "MP240823.1234.A56789", "mp240823 1234 a56789" and
 * "MP-240823-1234-A56789" all coexist as distinct "unique" references, which
 * defeats the point of ORD-04.
 */
export function normalizeReference(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
```

Store both: `reference` (as typed, for the merchant's eyeball comparison) and `referenceNormalized` (the constraint key). Catch Prisma's `P2002` on `[tenantId, referenceNormalized]` and return a specific, non-leaky message — *"This transaction reference has already been submitted"* — without revealing which order holds it (that would be a cross-customer information leak within a tenant).

**The rejected-claim edge case.** The constraint is absolute: once a reference is used, it cannot be reused even by a rejected claim. This is correct for D-11's actual scenarios (a typo'd reference is corrected to a *different* string; a wrong amount means a new transfer with a new reference). For the remaining case — the merchant rejected in error and the reference was right all along — the remedy is a **merchant-side reopen** (`DISPUTED → PAYMENT_CLAIMED` initiated by the merchant, actor `MERCHANT`), not a customer resubmission of the same reference. Build that; it is a few lines and it removes a real dead end.

A Postgres *partial* unique index (`WHERE status <> 'REJECTED'`) is the alternative. Prisma's `@@unique` cannot express it, so it would need hand-written migration SQL. Not recommended — the reopen path is simpler and does not fork the schema from `schema.prisma`.

---

### Pattern 11: Claim notification (D-13)

**In-app badge — a `count()`, not a maintained counter.**

```ts
const pendingClaims = await scopedDb(ctx.tenantId).paymentClaim.count({
  where: { status: "PENDING" },
});
```

`@@index([tenantId, status, submittedAt])` makes this an index-only scan. A denormalized counter column would need to be kept correct across submit / confirm / reject / reopen — four places to drift — for a query that is already sub-millisecond at pilot scale. Do not build one.

**Email — Resend, fired from `after()`.**

```ts
import { after } from "next/server";

// inside the claim-submission action, AFTER the claim row is committed
after(async () => {
  try {
    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: [merchantEmail],
      subject: strings.claims.email.subject.replace("{order}", order.orderNumber),
      react: NewClaimEmail({ /* … */ }),
    });
  } catch (error) {
    // Non-fatal: the in-app badge is the reliable channel. Same
    // "console.error and continue" convention Phase 2 established.
    console.error("[claims] Resend notification failed", error);
  }
});
```

Next 16's `after` runs the callback after the response is sent and *"will be executed even if the response didn't complete successfully"* [CITED: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`] — HIGH. It is available in Server Functions and Route Handlers and honours the route's `maxDuration`. This is `CLAUDE.md`'s "`waitUntil()` first, before any queue product" guidance, expressed in the framework's own current API rather than the Vercel primitive.

Resend usage confirmed against the official Next.js guide: package `resend`, `new Resend(process.env.RESEND_API_KEY)`, `resend.emails.send({ from, to, subject, react })` returning `{ data, error }` [CITED: resend.com/docs/send-with-nextjs] — HIGH. Note the API returns errors in the result object rather than throwing for API-level failures, so check `error` in addition to the `try/catch`.

**Never let email failure fail the claim.** The customer's submission must succeed even with `RESEND_API_KEY` unset — degrade with one warning, exactly as the rate limiter and tenant cache do.

---

### Pattern 12: Deep-link string builders (pure, unit-testable)

Put every deep link in `src/server/payments/{ussd,whatsapp,phone}.ts` as pure functions with no I/O. They are the highest-value unit tests in the phase — a malformed `tel:` or `wa.me` string fails silently on a customer's phone with no server-side signal.

```ts
// src/server/payments/ussd.ts
/**
 * D-15. Returns null when no fully-parametrized dial string is possible, which
 * is the COMMON case: only MTN publishes one, and only for merchants holding a
 * 6-digit MoMoPay merchant code. A null return is the instruction to render the
 * manual-copy block alone — never a dead button.
 */
export function buildMerchantUssd(
  operator: PaymentOperator,
  settings: { mtnMerchantCode: string | null; orangeMerchantCode: string | null },
  amountXaf: number,
): { href: string; display: string } | null {
  if (operator === "MTN_MOMO" && /^\d{6}$/.test(settings.mtnMerchantCode ?? "")) {
    const display = `*126*4*${settings.mtnMerchantCode}*${amountXaf}#`;
    // '#' MUST be %23 or the browser truncates the URI at the fragment.
    return { href: `tel:${display.replace(/#/g, "%23")}`, display };
  }
  // Orange's #150*47# takes no parameters, so a deep link saves one menu hop
  // and hides the number the customer still has to type. Not worth a button.
  return null;
}
```

```ts
// src/server/payments/whatsapp.ts
export function buildWhatsAppOrderLink(
  merchantMsisdn: string,      // already normalized to 2376XXXXXXXX
  message: string,
): string {
  return `https://wa.me/${merchantMsisdn}?text=${encodeURIComponent(message)}`;
}
```

```ts
// src/server/payments/phone.ts
const CM_MOBILE = /^6\d{8}$/;

/** Accepts +237 6XX XX XX XX, 237-6XXXXXXXX, 6XX.XX.XX.XX; returns 2376XXXXXXXX. */
export function normalizeCameroonMsisdn(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").replace(/^237/, "");
  return CM_MOBILE.test(digits) ? `237${digits}` : null;
}
```

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Preventing oversell under concurrency | A read-check-then-write in application code, or a Redis mutex per variant | One conditional `UPDATE` with `stock: { gte: qty }` | Postgres re-evaluates the `WHERE` after lock acquisition at READ COMMITTED. Application checks and distributed locks both add failure modes to solve a problem the database already solves. |
| Duplicate transaction references | A `findFirst` uniqueness check before insert | `@@unique([tenantId, referenceNormalized])` | Two simultaneous submissions both pass a read; only one survives an index. |
| Cross-tenant reference integrity | Validating `categoryId` belongs to the tenant in every action | Composite FK `references: [tenantId, id]` | A validation you must remember at N call sites versus a constraint the database enforces at all of them. |
| Unguessable tracking tokens | A hash of orderId + phone + a secret, or a short "order code" | `randomBytes(24).toString("base64url")` | Derived tokens leak structure and become forgeable the moment the derivation is understood. Random is random. |
| Image resize/crop/enhance | Canvas, ImageMagick shell-outs, or `next/image` as an ingest step | Sharp (Node runtime), fixed derivative set | `next/image` is a display-time transform cache; it produces no stable stored derivatives and cannot normalize a badly-exposed merchant photo. |
| Large file upload | Raising `serverActions.bodySizeLimit` and POSTing the file | Presigned direct-to-R2 PUT | Next 16 caps action bodies at 1 MB; raising it routes megabytes through Vercel compute for zero benefit. |
| EXIF orientation | Reading EXIF manually and rotating | `sharp().rotate()` with no arguments | Auto-orients from EXIF. Phone photos are the single most common source of sideways product images. |
| Rate limiting | A per-instance counter | `@upstash/ratelimit` via the existing `src/server/rate-limit.ts` | The module header already explains why an in-process counter is a *fictional* limit on Vercel, not a weak one. |
| Guest sessions | A signed JWT in a cookie carrying cart contents | Opaque id in an HttpOnly cookie + Redis | Contents in the cookie are client-tamperable and grow unboundedly; an id is 24 bytes and unforgeable. |
| Fire-and-forget post-response work | A queue, a cron, or an un-awaited promise | `after()` from `next/server` | An un-awaited promise in a serverless function may be killed when the response flushes. `after()` is the framework's supported answer, and `CLAUDE.md` explicitly forbids a worker process. |
| XAF money | A currency library, `Decimal`, or minor units | `Int` columns + `Intl.NumberFormat('fr-CM', …)` | XAF has no decimal subunit in common use, and `PLANS.monthlyPriceXaf` already set the whole-XAF-integer precedent. |
| Order state validation | `if (order.state === …)` scattered across actions | One `ORDER_TRANSITIONS` table + one `transitionOrder()` | The registry discipline `PLANS` and `TENANT_SCOPED_MODELS` already established: rules are data, drift is a compile error. |

**Key insight:** every item above has the same shape — the alternative moves a guarantee from a place that enforces it structurally (a database constraint, a framework API, a single chokepoint) to a place that enforces it by remembering (a call site, a convention, a review comment). This codebase has already chosen structural enforcement three times (`scopedDb`, `merchantAction`, the ESLint import zones); Phase 3 should not be where that stops.

---

## Common Pitfalls

### Pitfall 1: Prisma nested writes bypass the tenant-scope extension
**What goes wrong:** `db.order.create({ data: { …, items: { create: [...] } } })` writes `OrderItem` rows without `tenantId` being injected.
**Why:** the extension hooks the client *operation*, not the generated SQL. `src/server/db/tenant-scoped.ts` documents this as a known hole.
**How to avoid:** `tenantId` is required with no default on every new model, so a nested create is a **compile error**. Keep it that way. Create parents and children as separate calls inside one `$transaction`, using `scopedCreateData<…>()` on each. Never relax `tenantId` to optional or give it a default to "make the types work."
**Warning sign:** reaching for a `Prisma.…CreateInput` cast because a nested create won't typecheck. That cast is the bug.

### Pitfall 2: NULL option values silently break the variant matrix
**What goes wrong:** `@@unique([tenantId, productId, option1Value, option2Value])` on nullable columns permits unlimited rows where both are NULL, because Postgres treats NULLs as distinct in a unique index. A product with no options can end up with five "default" variants, each holding separate stock.
**Why:** SQL NULL is not equal to itself. Prisma cannot express `NULLS NOT DISTINCT`.
**How to avoid:** declare `option1Value String @default("")` and `option2Value String @default("")` — **NOT NULL, empty string as the sentinel**. Every product gets exactly one implicit `("", "")` variant when it has no options, which is also what makes stock live uniformly at the variant level (the D-05 discretion item, resolved).
**Warning sign:** any `option1Value String?` in the schema.

### Pitfall 3: Sharp on the Edge runtime
**What goes wrong:** hard runtime failure, not graceful degradation — libvips native bindings cannot load.
**How to avoid:** no `export const runtime = 'edge'` in `src/app/api/upload/**` or anything importing `src/server/images/pipeline.ts`. Node is the default; the failure mode is adding the line, not omitting it.
**Warning sign:** copying an Edge-runtime snippet from a rate-limiting or middleware tutorial into an upload route.

### Pitfall 4: Setting cookies during a Server Component render
**What goes wrong:** the guest-cart cookie is never set; every page load looks like an empty cart.
**Why:** *"HTTP does not allow setting cookies after streaming starts, so you must use `.set` in a Server Function or Route Handler"* [CITED: Next 16 `cookies` API reference].
**How to avoid:** mint the cart id inside the `addToCart` Server Action. A page may only `get()`.
**Warning sign:** a `getOrCreateCart()` helper called from `page.tsx`.

### Pitfall 5: Multi-line deadlock on the stock decrement
**What goes wrong:** two concurrent orders each buying variants A and B, in opposite order, deadlock; Postgres kills one with a serialization/deadlock error that surfaces as a 500.
**How to avoid:** sort line items by `variantId` before the decrement loop. One line.
**Warning sign:** intermittent `40P01` errors under load test.

### Pitfall 6: Double release of held stock
**What goes wrong:** a rejected claim released once, then a retry or a second rejection releases again — inventory silently inflates and the merchant oversells for real.
**How to avoid:** the `Order.stockHeld` boolean guarded by a conditional `updateMany` (Pattern 2b). Never release based on state alone.
**Warning sign:** release logic that reads `if (order.state === "DISPUTED")` rather than atomically claiming the hold.

### Pitfall 7: Trusting the cart's prices at placement
**What goes wrong:** a customer edits the cart payload and buys a 50,000 XAF item for 500.
**How to avoid:** the cart stores `{variantId, quantity}` and nothing else; `placeOrder` re-reads every variant and recomputes every total. TEN-08 is a stated project constraint, and `tests/isolation/` is the right place to prove it with a forged payload — exactly as `tests/isolation/plan-selection.test.ts` does with a real second-tenant id.
**Warning sign:** a `unitPriceXaf` field anywhere in a checkout Zod schema.

### Pitfall 8: A `tel:` button that does nothing on iOS
**What goes wrong:** the customer taps, nothing happens, and they conclude the store is broken.
**Why:** Apple's Phone app refuses any `tel:` URL containing `*` or `#`, and percent-encoding does not help.
**How to avoid:** detect iOS (UA sniffing is acceptable here — the consequence of a wrong guess is showing the copy block, which is the safe default) and render manual copy. Never render a `tel:` button you cannot be confident will open the dialer.
**Warning sign:** a single unconditional `<a href="tel:…">` in the checkout instructions.

### Pitfall 9: Unencoded `#` in a `tel:` href
**What goes wrong:** `tel:*126*4*123456*5000#` is parsed as URI `tel:*126*4*123456*5000` with fragment `""` — the terminating `#` is stripped and the USSD session never fires.
**How to avoid:** `.replace(/#/g, "%23")` when building the `href`. Show the unencoded string in the visible label.
**Warning sign:** the displayed code and the `href` are the same string.

### Pitfall 10: Generated Prisma enums are unimportable from feature code
**What goes wrong:** `import type { OrderState } from "@/generated/prisma/client"` is an ESLint error under `no-restricted-imports`, and the lint gate is the TEN-02/TEN-05 enforcement mechanism — it cannot be waived.
**How to avoid:** create `src/server/db/enums.ts` (inside the sanctioned zone) that re-exports the enum types and value objects, and import from there everywhere else. Decide this in Wave 0; retrofitting it touches every new file.
**Warning sign:** an `// eslint-disable-next-line no-restricted-imports` anywhere outside `src/server/db/**`.

### Pitfall 11: The Phase-1 storefront placeholder
**What goes wrong:** `src/app/s/[slug]/page.tsx` currently renders "Store coming soon" and its header comment says *"Phase 4 replaces it wholesale."* Phase 3 needs a catalog at that exact route.
**How to avoid:** the planner must decide the transition explicitly — recommended: `page.tsx` becomes the catalog and falls back to the existing placeholder copy when the tenant has zero active products. That satisfies both phases without Phase 4 having to undo anything. Confirm before writing the plan; CONTEXT.md's `<code_context>` flags this as unresolved.

### Pitfall 12: `createLimiter` is not exported
**What goes wrong:** `import { createLimiter } from "@/server/rate-limit"` fails to compile.
**How to avoid:** add new limiters as exported consts inside `src/server/rate-limit.ts` itself.

---

## Code Examples

### Placing an order (the composite of Patterns 2, 3, 4, 7b)

```ts
// src/server/orders/place.ts
export async function placeOrder(
  tenantId: string,
  input: PlaceOrderInput,          // already zod-parsed; carries NO prices
): Promise<{ orderId: string; orderNumber: string; trackingToken: string }> {
  const db = scopedDb(tenantId);

  // Sorted so two concurrent multi-line orders can never deadlock (Pitfall 5).
  const lines = [...input.items].sort((a, b) => a.variantId.localeCompare(b.variantId));

  const token = mintTrackingToken();

  const order = await db.$transaction(async (tx) => {
    // TEN-08: price and stock come from the database, never from the client.
    const variants = await tx.productVariant.findMany({
      where: { id: { in: lines.map((l) => l.variantId) }, active: true },
      select: {
        id: true, priceXaf: true, option1Value: true, option2Value: true,
        product: { select: { id: true, name: true, basePriceXaf: true, active: true } },
      },
    });
    if (variants.length !== lines.length) throw new UnavailableItemError();

    // CAT-03 / D-04: atomic hold, one conditional UPDATE per line.
    for (const line of lines) {
      const { count } = await tx.productVariant.updateMany({
        where: { id: line.variantId, active: true, stock: { gte: line.quantity } },
        data:  { stock: { decrement: line.quantity } },
      });
      if (count === 0) throw new OutOfStockError(line.variantId);
    }

    const items = lines.map((line) => buildOrderItem(line, variants));
    const subtotal = items.reduce((sum, i) => sum + i.lineTotalXaf, 0);

    const created = await tx.order.create({
      data: scopedCreateData<Prisma.OrderUncheckedCreateInput>({
        orderNumber: newOrderNumber(),
        state: "ORDER_PLACED",
        channel: input.channel,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        deliveryAddress: input.deliveryAddress ?? null,
        subtotalXaf: subtotal,
        totalXaf: subtotal,
        trackingTokenHash: hashTrackingToken(token),
        stockHeld: true,
      }),
      select: { id: true, orderNumber: true },
    });

    // Separate call, NOT a nested create — the extension does not intercept
    // nested writes (Pitfall 1). createMany IS intercepted and stamps each row.
    await tx.orderItem.createMany({
      data: items.map((i) => ({ ...i, orderId: created.id })),
    });

    // ORD-05 genesis event: fromState is null exactly once per order.
    await tx.orderEvent.create({
      data: scopedCreateData<Prisma.OrderEventUncheckedCreateInput>({
        orderId: created.id,
        fromState: null,
        toState: "ORDER_PLACED",
        actor: "CUSTOMER",
      }),
    });

    // D-02: only the manual-transfer path has intermediate payment states.
    if (input.channel === "MANUAL_TRANSFER") {
      await transitionOrder(tx, {
        orderId: created.id, to: "PAYMENT_PENDING", actor: "SYSTEM",
      });
    }

    return created;
  }, { timeout: 15_000 });

  // The plaintext token is returned ONCE and never persisted (Pattern 6).
  return { orderId: order.id, orderNumber: order.orderNumber, trackingToken: token };
}
```

### Rejecting a claim (D-11 + stock release)

```ts
export const rejectClaim = merchantAction({
  mode: "write",
  schema: z.object({
    claimId: z.string().min(1),
    reason: z.string().trim().min(3).max(200),   // D-11: required, shown to the customer
  }),
  handler: async (ctx, { claimId, reason }) => {
    const db = scopedDb(ctx.tenantId);

    await db.$transaction(async (tx) => {
      const claim = await tx.paymentClaim.findUniqueOrThrow({
        where: { id: claimId },
        select: { id: true, orderId: true, status: true },
      });
      if (claim.status !== "PENDING") throw new AlreadyReviewedError();

      await tx.paymentClaim.update({
        where: { id: claim.id },
        data: {
          status: "REJECTED",
          rejectionReason: reason,
          reviewedAt: new Date(),
          reviewedByUserId: ctx.userId,
        },
      });

      // D-03: DISPUTED is reachable only from a rejected claim. The state
      // machine already refuses every other origin; this is the only caller.
      await transitionOrder(tx, {
        orderId: claim.orderId,
        to: "DISPUTED",
        actor: "MERCHANT",
        actorUserId: ctx.userId,
        reason,                                  // lands in the ORD-05 audit row
      });

      // D-04: held stock goes back on sale. Idempotent (Pattern 2b).
      await releaseStock(tx, claim.orderId);
    });

    return { ok: true };
  },
});
```

> `ctx.userId` does not exist on `MerchantContext` today — it carries `tenantId`, `storeName`, `storeSlug`, `plan`, `trial`, `canWrite`. ORD-05 requires a *who*, so `requireMerchantContext()` must be extended to include the session's `user.id`. That is a small, additive change to `src/server/merchant/context.ts` (add `id: true` to the session read, add the field to `MerchantContext`) and it must **not** grow a parameter — `tests/unit/no-tenant-id-param.test.ts` guards that.

---

## Runtime State Inventory

Not applicable — this is a greenfield feature phase, not a rename, refactor or migration. No existing runtime state carries strings this phase changes.

The one adjacent item worth naming: **`src/app/s/[slug]/page.tsx` is live rendered content**, not dead scaffolding. See Pitfall 11.

---

## State of the Art

| Old approach | Current approach | When changed | Impact here |
|--------------|-----------------|--------------|-------------|
| `middleware.ts` | `proxy.ts` with an exported `proxy()` function | Next 16 | Already done — `src/proxy.ts` exists. Do not add a `middleware.ts`. |
| `unstable_after` | `after` from `next/server`, stable | Next 15.1 → stable | Use `after`, not `waitUntil` from `@vercel/functions`, for the Resend send. |
| `cookies()` synchronous | `cookies()` async, `.set` only in Server Functions / Route Handlers | Next 15 → enforced in 16 | Pitfall 4. |
| Server Action body ~4.5 MB (Vercel function limit) | Server Action body **1 MB** by default | Next 16 docs | Makes presigned upload mandatory (Pattern 5). |
| `next lint` | ESLint invoked directly | Next 16 removed `next lint` | Already handled by the `lint` npm script. |
| Prisma implicit query engine | Prisma 7 Rust-free client + mandatory driver adapter | Prisma 7.0 (Nov 2025) | Already handled in `src/server/db/base.ts`. |
| `findUnique` → `findFirst` rewrite for tenant scoping | `extendedWhereUnique` accepts non-unique scalars in `WhereUniqueInput` | Prisma 5 GA | `src/server/db/tenant-scoped.ts` already documents this and deliberately does not rewrite. Do not reintroduce the workaround. |

**Deprecated / outdated for this phase:**
- Third-party USSD code lists for Cameroon that predate the 9-digit renumbering, and any code sourced from another African MTN/Orange market. `*126#` and `#150#` are Cameroon-specific; Orange uses `#144#` in most other francophone markets.
- Advice to percent-encode `*`/`#` "to make USSD work on iOS." Apple's documentation is explicit that the Phone app refuses regardless.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Cameroon prefix→operator blocks (650–654/67X/68X MTN, 655–659/69X Orange, 66X Camtel/Nexttel) | Payment Rails § | Low — the recommendation is already "warn, never reject," precisely because portability makes the mapping unreliable. |
| A2 | Third-party-reported one-shot MTN P2P strings (`*126*1*<number>*<amount>#`) do not work | Payment Rails § | Low — the recommendation is not to ship them. If one *does* work it would be an enhancement, verifiable only with a real Cameroonian SIM. |
| A3 | `after()` on Vercel keeps the function alive long enough for a Resend round trip | Pattern 11 | Low — the send is wrapped in try/catch and the in-app badge is the reliable channel. |
| A4 | Suggested rate-limit budgets (10/5m orders, 5/10m claims, 60/1m tracking) | Pattern 9 | Low — tunable constants; no structural dependency. |
| A5 | Three fixed image derivative sizes (400/800/1600) suit the flagship template | Pattern 5 | Medium — Phase 4's TMPL-01 layout may want a different set. Mitigated by the `IMAGE_PRESETS` registry: changing sizes is a data edit plus a reprocess, not a rewrite. |
| A6 | Re-holding stock at `DISPUTED → PAYMENT_CLAIMED` (rather than at `→ CONFIRMED`) is the right reading of D-04's "the same way a fresh order would" | Pattern 2b | Medium — a wrong reading means either stock held too long or oversell at confirm time. **Worth one confirming question to the user.** |
| A7 | Deactivated products should not count against the plan's product cap | Pattern 8 | Medium — a stricter reading would count all rows. Wrong guess means either a too-generous cap or a permanently-ratcheting one. |
| A8 | Order tracking tokens have no expiry | Pattern 6 | Low — an order is a permanent record and D-12 sets no expiry. |

---

## Open Questions (RESOLVED)

All five questions below were resolved during planning; each recommendation was adopted by name in the plan noted.

1. **Does the phase need a `CANCELLED` order state? (RESOLVED — 03-07)**
   - What we know: ORD-01 enumerates exactly six states and CONTEXT.md adds none. D-03 deliberately narrows `DISPUTED` so it cannot serve as a general escape hatch.
   - What's unclear: a customer who never pays leaves an order in `PAYMENT_PENDING` holding stock forever, which is a real inventory leak at pilot scale.
   - Recommendation (adopted): **do not add the state** (it is scope the user did not ask for), but do build the release primitive so a Phase 6 "cancel stale order" action is a call, not a redesign. 03-07 builds `releaseStock` as exactly that primitive; no `SYSTEM`-actor sweep was added this phase.

2. **What replaces the Phase-1 storefront placeholder, and when? (RESOLVED — 03-09)**
   - What we know: `src/app/s/[slug]/page.tsx` says Phase 4 replaces it wholesale; CONTEXT.md's `<code_context>` says "planner should confirm the exact transition condition."
   - Recommendation (adopted): catalog becomes the page; the existing placeholder copy becomes the zero-active-products empty state.

3. **Which merchant email address receives the claim notification? (RESOLVED — 03-15)**
   - What we know: `Organization` has no email column; the owner's address lives on `User` via `Member`. Better Auth's `Member` join is reachable through `platformDb.member`.
   - Recommendation (adopted): resolve owner email via `platformDb.member` → `user.email` at send time; skip the send with a warning if no owner is found. No new column.

4. **Is `MANUAL_TRANSFER` selectable when the merchant has configured no receiving number? (RESOLVED — 03-08 / 03-12)**
   - Recommendation (adopted): no. The channel is hidden entirely at checkout when `MerchantPaymentSettings` has neither an MTN nor an Orange number, both in the storefront markup and refused server-side in the checkout action.

5. **Does the merchant confirm/reject flow need optimistic-locking against two dashboard tabs? (RESOLVED — 03-13)**
   - Recommendation (adopted): the `if (claim.status !== "PENDING") throw` guard inside the transaction is sufficient at this scale; the second tab gets a clear "already reviewed" message.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + npm | Everything | ✓ | project baseline | — |
| PostgreSQL (Neon, pooled) | All persistence | ✓ | via `DATABASE_URL` | — |
| Neon test branch (`TEST_DATABASE_URL`) | `isolation` vitest project | ✓ | already wired in `vitest.config.ts` | — |
| Upstash Redis | Guest cart, idempotency, rate limits | ✓ (optional env) | `@upstash/redis` 1.38.2 | Documented loud degradation; cart becomes non-persistent in local dev |
| Cloudflare R2 bucket + API token | CAT-02 product images, CHK-04 screenshots | ✗ **not yet configured** | — | **None. Blocking for CAT-02.** Needs a bucket, an API token, and a public/CDN base URL before the image plan can be executed end to end. |
| Sharp native binary | Image enhancement | ✓ | 0.35.3 present in `node_modules` | — (must be promoted to a direct dependency) |
| Resend API key + verified sending domain | D-13 merchant email | ✗ **not yet configured** | — | Degrade to `console.warn`; the in-app badge (also shipping this phase) is the reliable channel |
| Docker | — | ✗ | — | Not needed; `vitest.config.ts` already documents that Testcontainers is unavailable and a Neon branch is the substitute |
| A Cameroonian MTN/Orange SIM | End-to-end USSD verification | ✗ | — | The `tel:` string builders are unit-testable as pure functions; real dial behaviour is a manual pilot check, not an automated gate |

**Missing dependencies with no fallback:**
- **Cloudflare R2 credentials.** CAT-02 cannot be verified without them. The planner should place R2 provisioning and env wiring in Wave 0, with a `checkpoint:human-verify` for the bucket/token creation (a human must do this in the Cloudflare dashboard).

**Missing dependencies with fallback:**
- Resend API key — the phase ships with a degraded, warning-only email path if absent.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10, two projects (`unit`, `isolation`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test:unit` (`vitest run tests/unit --reporter=dot`, no DB, target < 2s) |
| Full suite command | `npm run test:full` (`dotenv -e .env.test -- vitest run`, requires `TEST_DATABASE_URL`) |
| Also gating | `npm run lint` (`--max-warnings=0`) and `npm run typecheck` — the lint gate *is* the TEN-02/TEN-05 enforcement mechanism and must stay green |

### Phase Requirements → Test Map

| Req | Behavior | Type | Automated command | File exists? |
|-----|----------|------|-------------------|--------------|
| CAT-01 | Product + 2-axis variant matrix creation; variant uniqueness | isolation | `vitest run --project isolation tests/isolation/catalog.test.ts` | ❌ Wave 0 |
| CAT-01 | Product creation refused at the tier's product cap | unit + isolation | `vitest run --project unit tests/unit/product-limit.test.ts` | ❌ Wave 0 |
| CAT-02 | Sharp pipeline produces the 3 derivatives at the right dimensions | unit | `vitest run --project unit tests/unit/image-pipeline.test.ts` | ❌ Wave 0 (fixture image, no network — Sharp runs locally) |
| CAT-02 | Presigned key is always under `tenants/{ctx.tenantId}/` regardless of input | unit | `vitest run --project unit tests/unit/r2-key.test.ts` | ❌ Wave 0 |
| **CAT-03** | **Two concurrent placements for the last unit: exactly one succeeds** | **isolation** | `vitest run --project isolation tests/isolation/stock-race.test.ts` | ❌ **Wave 0 — the phase's single most important test.** Use `Promise.all` of two real `placeOrder` calls against one variant with `stock: 1`; assert one `ok`, one `OutOfStockError`, and `stock === 0`. |
| CAT-03 | Multi-line orders do not deadlock (sorted decrement) | isolation | same file, second case: `Promise.all` of two 2-line orders with reversed input order | ❌ Wave 0 |
| CHK-01 | Cart survives a refresh; cart bound to the wrong tenant is discarded | unit | `vitest run --project unit tests/unit/cart.test.ts` (mock Redis client) | ❌ Wave 0 |
| CHK-02 | `wa.me` link format, number normalization, message encoding | unit | `vitest run --project unit tests/unit/whatsapp.test.ts` | ❌ Wave 0 |
| CHK-03 | `buildMerchantUssd` returns the MTN string only with a valid 6-digit code; `#` is `%23`; null otherwise | unit | `vitest run --project unit tests/unit/ussd.test.ts` | ❌ Wave 0 |
| CHK-03 | iOS renders manual copy, no `tel:` anchor | manual | — | Manual pilot check; UA branching is unit-testable, real-device behaviour is not |
| CHK-04 | Claim submission requires a valid token; wrong/absent token 404s identically | isolation | `vitest run --project isolation tests/isolation/tracking-token.test.ts` | ❌ Wave 0 |
| CHK-05 | Every `OrderState` maps to non-empty customer copy (exhaustive) | unit | `vitest run --project unit tests/unit/order-status-copy.test.ts` | ❌ Wave 0 |
| ORD-01 | Every legal transition allowed, every illegal one refused, channel rules enforced | unit | `vitest run --project unit tests/unit/state-machine.test.ts` | ❌ Wave 0 — pure, no DB, table-driven |
| ORD-02 | `PAYMENT_CLAIMED → CONFIRMED` with actor `CUSTOMER` or `SYSTEM` is refused | unit | same file | ❌ Wave 0 |
| ORD-03 | Confirm/reject are refused for another tenant's claim id | isolation | `vitest run --project isolation tests/isolation/claims.test.ts` | ❌ Wave 0 |
| ORD-04 | Duplicate normalized reference rejected within a tenant; **the same reference IS accepted in a different tenant** | isolation | same file | ❌ Wave 0 — the cross-tenant half is the one that proves the constraint is scoped, not global |
| ORD-05 | Every transition writes exactly one `OrderEvent` with the correct actor; no state change without one | isolation | `vitest run --project isolation tests/isolation/order-audit.test.ts` | ❌ Wave 0 |
| TEN-02 | New models registered; unregistered model throws | isolation | `tests/isolation/model-registry-drift.test.ts` | ✅ exists — will fail if a model is missed |
| TEN-08 | A forged price/quantity in the placement payload is ignored | isolation | `tests/isolation/checkout-trust.test.ts` | ❌ Wave 0 — mirror `plan-selection.test.ts`'s forged-tenant-id approach |
| Pattern 4 | Extension still injects `tenantId` inside `$transaction` | isolation | `tests/isolation/tenant-isolation.test.ts` (extend) | ✅ file exists, ❌ case to add — **required**, converts a MEDIUM-HIGH assumption into a proven fact |

### Sampling Rate

- **Per task commit:** `npm run test:unit && npm run lint && npm run typecheck`
- **Per wave merge:** `npm run test:full`
- **Phase gate:** full suite green before `/gsd:verify-work`, plus a manual Android + iOS pass on the checkout instructions page

### Wave 0 Gaps

- [ ] `src/server/db/enums.ts` — re-export generated enums past the ESLint import zone (Pitfall 10); **blocks nearly every other file**
- [ ] `ScopedTx` type alias in `src/server/db/tenant-scoped.ts` (Pattern 4)
- [ ] `tests/isolation/stock-race.test.ts` — CAT-03, the phase's highest-value test
- [ ] `tests/unit/state-machine.test.ts` — ORD-01/ORD-02
- [ ] `tests/unit/ussd.test.ts`, `tests/unit/whatsapp.test.ts`, `tests/unit/phone.test.ts` — CHK-02/CHK-03
- [ ] `tests/isolation/order-audit.test.ts` — ORD-05
- [ ] `tests/isolation/claims.test.ts` — ORD-03/ORD-04 (including the cross-tenant-reference-reuse case)
- [ ] `tests/isolation/checkout-trust.test.ts` — TEN-08
- [ ] Extend `tests/setup/seed-two-tenants.ts` with catalog + order fixtures for both tenants
- [ ] Add the extension-inside-`$transaction` case to `tests/isolation/tenant-isolation.test.ts`
- [ ] R2 provisioning + `src/env.ts` additions (`checkpoint:human-verify`)

No framework install is needed — Vitest 4.1.10 and both projects already exist.

---

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json` — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control in this phase |
|---------------|---------|-------------------------------|
| V2 Authentication | Partly | Merchant side only, already solved by Better Auth + `requireMerchantContext()`. Customer side is deliberately accountless (CHK-01); the tracking token is a bearer credential, not an authentication mechanism. |
| V3 Session Management | Yes | Guest cart cookie: opaque id, `HttpOnly`, `Secure`, `SameSite=Lax`, **no `domain` attribute** so it stays host-scoped per tenant. |
| V4 Access Control | Yes | `scopedDb` extension (every query), composite `(tenantId, id)` FKs (every write), token-hash lookup for the customer order view, `merchantAction` for every merchant mutation. |
| V5 Input Validation | Yes | `zod` 4.4.3 at every server-action boundary — already the enforced convention in `merchantAction`. Image `Content-Type` allowlisted before presigning. Merchant code validated `/^\d{6}$/` before `tel:` interpolation. |
| V6 Cryptography | Yes | `node:crypto` `randomBytes` (token) and `createHash("sha256")` (at-rest hash). No hand-rolled derivation, no `Math.random()`. |
| V7 Error Handling & Logging | Yes | ORD-05 `OrderEvent` is the domain audit log. Never log the plaintext tracking token or the full R2 presigned URL. |
| V8 Data Protection | Yes | Customer name, phone and delivery address are personal data in a shared-schema DB — protected by the same tenant scoping as everything else; never rendered outside the owning tenant or the token-holder's view. |
| V12 Files & Resources | Yes | Uploads go direct to R2 under a server-chosen, tenant-prefixed key. Content type is pinned at signing time. Never derive a storage key from a client-supplied filename. |
| V13 API & Web Service | Yes | Next 16 Server Actions carry a built-in `Origin`/`Host` CSRF check; treat every action as a public endpoint (the `merchantAction` header already says so). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Client-supplied price or quantity at checkout | Tampering | Cart carries `{variantId, quantity}` only; all money re-derived from the DB at placement (TEN-08) |
| Cross-tenant `categoryId` / `variantId` in a create payload | Tampering / Elevation | Composite FK `references: [tenantId, id]` — a database rejection, not a code check |
| Order-tracking token enumeration | Information disclosure | 192-bit random token, hash at rest, identical 404 for all failure modes, rate-limited route, `Referrer-Policy: no-referrer`, `noindex` |
| Payment-claim spam / fake "I've paid" | Repudiation / DoS | ORD-02 (no auto-confirm, ever), per-order + per-IP rate limits, unique reference index, merchant review with a required rejection reason |
| Reused proof-of-payment reference | Spoofing | `@@unique([tenantId, referenceNormalized])` with normalization (ORD-04) |
| Oversell via concurrent checkout | Tampering | Conditional `UPDATE` guard verified against PostgreSQL READ COMMITTED semantics (CAT-03) |
| Double-submit creating duplicate orders | Tampering | Redis idempotency key on placement |
| Presigned-URL abuse (upload outside your prefix, or as another tenant) | Elevation | Key derived from `ctx.tenantId` server-side; content type pinned; 5-minute expiry; rate-limited mint |
| Malicious image upload (decompression bomb, polyglot) | DoS / Tampering | Sharp re-encodes every image to WebP — the stored derivative is never the uploaded bytes. Cap `sharp({ limitInputPixels })` and set `maxDuration` on the finalize route. Never serve the `original` key publicly. |
| Cart cookie shared across tenants | Information disclosure | Omit the cookie `domain` attribute; additionally store and verify `tenantId` inside the cart payload |
| `tel:` injection via merchant-controlled settings | Tampering | Merchant code validated `/^\d{6}$/`, MSISDN validated `/^6\d{8}$/`, both before interpolation into a URI |
| Claim-screenshot enumeration in R2 | Information disclosure | UUID path segment per upload; serve screenshots through a token/session-gated route, never from a guessable public URL |

---

## Sources

### Primary (HIGH confidence)

**Operator / platform documentation (the D-15 blocker)**
- [MTN Cameroon — MoMo Bills Payment](https://mtn.cm/helppersonal/momo-bills-payment/) — merchant payment `*126*4*XXXXXX*Amount#`, transaction history `*126*7*2#`
- [MTN Cameroon — MoMo Account Management](https://mtn.cm/helppersonal/momo-account/) — `*126#` menu; menu-driven P2P transfer
- [Orange Money Cameroun — Paiement marchand / Flash Pay](https://orangemoney.orange.cm/fr/om-paiement/flash-pay.html) — `#150*47#`, merchant code entered interactively
- [Orange Cameroun — Codes utiles](https://www.orange.cm/en/codes-utiles-en-22-migrated.html) — `#150#` Orange Money; `#144*numéro*montant#` parametrized precedent; codes rendered as clickable dial links
- [Orange Cameroun — Transfert d'argent](https://www.orange.cm/fr/om-gestion-de-compte/transfert-d-argent.html) — `#150#` menu-driven, no one-shot string
- [Apple — Phone Links, iPhone URL Scheme Reference](https://developer.apple.com/library/safari/featuredarticles/iPhoneURLScheme_Reference/PhoneLinks/PhoneLinks.html) — the Phone app does not dial `tel:` URLs containing `*` or `#`
- [WhatsApp Help Center — How to use click to chat](https://faq.whatsapp.com/5913398998672934) — `https://wa.me/<number>?text=<urlencodedtext>`, international format, no `+`/zeroes/brackets/dashes

**Framework / library documentation**
- [PostgreSQL — Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) — READ COMMITTED re-evaluates the `WHERE` clause after lock acquisition (the CAT-03 guarantee)
- `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` — Server Action bodies capped at 1 MB; built-in CSRF `Origin`/`Host` check
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` — `after()` semantics, runs even on error, honours `maxDuration`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` — async `cookies()`; `.set` only in Server Functions / Route Handlers
- [Cloudflare R2 — Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) — AWS SDK v3 config, `region: "auto"`, expiry 1s–604800s, `ContentType` pinning
- [Sharp — API: Operations](https://sharp.pixelplumbing.com/api-operation/) — `normalise`, `modulate`, `sharpen`, `gamma` signatures and defaults
- [Resend — Send with Next.js](https://resend.com/docs/send-with-nextjs) — package name, client construction, `emails.send` returning `{ data, error }`
- [Prisma — Transactions and concurrency control](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) — `updateMany` + conditional `where` optimistic-concurrency pattern, interactive transaction options
- npm registry (`npm view`, 2026-08-23) — exact current versions for `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `resend`, `nanoid`, `sharp`
- slopcheck 0.6.1 scan (2026-08-23) — 4/4 `[OK]`

**This codebase (read directly, not from summaries)**
- `prisma/schema.prisma`, `src/server/db/{base,platform,tenant-scoped}.ts`, `src/server/entitlements/{plans,resolve,assert}.ts`, `src/server/merchant/{action,actions,context}.ts`, `src/server/rate-limit.ts`, `src/server/tenant/cache.ts`, `src/proxy.ts`, `src/app/s/[slug]/page.tsx`, `src/env.ts`, `eslint.config.mjs`, `vitest.config.ts`, `package.json`, `src/generated/prisma/internal/prismaNamespace.ts`

### Secondary (MEDIUM confidence)

- [prisma/prisma#20738](https://github.com/prisma/prisma/issues/20738) — `tx` from an extended client's `$transaction` is extended at runtime (PR #19565); the open issue is TypeScript typing only
- prisma/prisma#17948 / #20016 — extensions that *issue their own queries* escape the transaction context; does not apply to `scopedDb`'s arg-mutating extension
- Cameroon mobile numbering: 9 digits beginning with `6`; prefix blocks by operator; mobile number portability makes prefix an unreliable operator indicator — cross-referenced across multiple current Cameroon telecom sources
- Upstash — Redis session storage in Next.js: opaque id in an `HttpOnly` cookie, data in Redis with TTL

### Tertiary (LOW confidence — flagged, not shipped)

- Third-party USSD aggregator sites reporting one-shot MTN P2P strings (`*126*1*…`) — **not corroborated by mtn.cm; do not ship** (assumption A2)
- MMGate 2026 Cameroon prefix table — could not be fetched (HTTP 403); the prefix claims above rest on other, weaker corroboration (assumption A1)

---

## Metadata

**Confidence breakdown:**
- **D-15 payment rails: HIGH.** Both operators' merchant-payment strings read from their own official sites; the iOS limitation quoted verbatim from Apple's developer documentation; the WhatsApp format from WhatsApp's own help centre. The negative claim (no published one-shot P2P string) was verified by reading the operators' own transfer pages, not by absence of search results.
- **Concurrency / CAT-03: HIGH.** The guarantee is quoted verbatim from PostgreSQL's official isolation-level documentation, and the ESLint ban on raw SQL independently forecloses the alternatives.
- **Schema design: HIGH on structure, MEDIUM on the composite-FK ergonomics.** Multi-field Prisma relations are standard, but `prisma validate` + `prisma migrate dev` on a Neon branch should confirm the generated DDL in Wave 0 before the rest of the phase builds on it.
- **Prisma extension inside `$transaction`: MEDIUM-HIGH.** Runtime behaviour is confirmed by the maintainer-referenced PR, and the required Wave-0 isolation test converts it to HIGH before any feature code depends on it.
- **Image pipeline: HIGH on mechanics** (Cloudflare's and Sharp's own docs), **MEDIUM on the chosen derivative sizes** (assumption A5).
- **Cameroon phone-prefix heuristics: MEDIUM**, and deliberately non-load-bearing — the recommendation is to warn, never reject.
- **Rate-limit budgets, copy, UX specifics: LOW by design** — tunable constants and discretion items, not structural claims.

**Research date:** 2026-08-23
**Valid until:** 2026-09-22 for the framework/library findings (30 days — stable majors). The **operator USSD strings should be re-checked before public launch** and again at any point the pilot reports a tap-to-dial failure; operator short codes change without notice and are the single item here with no automated regression test.
