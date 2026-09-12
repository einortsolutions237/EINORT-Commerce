# Feature Research

**Domain:** Multi-tenant commerce SaaS for Cameroonian SME merchants — v2.0 capability expansion (Marketplace, Marketplace Marketing, Customers, Inventory, Delivery, Domains, Analytics)
**Researched:** 2026-09-13
**Confidence:** MEDIUM-HIGH overall (see per-area confidence table at the end)

> **Scope note.** This document covers only the seven *genuinely new* v2.0 subsystems. Storefront templates, the section/block editor, the product catalog, checkout, the order state machine, payment claims, subscriptions, and the merchant dashboard shell are already built and are treated here strictly as *dependencies and constraints*, not as things to research.

> **The single most important framing for this milestone:** every one of the seven areas has an obvious "Shopify-shaped" version that is 5–20× the work of the version a Douala SME merchant would actually notice. The recommendations below are deliberately biased toward the smaller version, because the project's Core Value is "a storefront that looks like it cost money to build," not "feature parity with Shopify."

---

## 0. Constraints inherited from the existing codebase

These are load-bearing for every recommendation below. They come from `.planning/codebase/ARCHITECTURE.md`, `prisma/schema.prisma`, and `CLAUDE.md`.

| Constraint | Where it comes from | Which new features it constrains |
|-----------|---------------------|----------------------------------|
| Three DB clients only: `scopedDb(tenantId)` (single-tenant), `platformDb` (registry allowlist), `adminDb` (unscoped, ESLint-fenced to `src/server/admin/**` and forbidden from importing `tenant-scoped`) | `src/server/db/*`, `eslint.config.mjs` | **Marketplace** (needs cross-tenant reads — no sanctioned client exists) |
| `$queryRaw` / `$executeRaw` banned repository-wide (`no-restricted-syntax`) | `eslint.config.mjs` | **Analytics** (no `date_trunc`), **Marketplace** (no custom relevance ranking) |
| Proxy has **zero I/O** — `src/proxy.ts` may not import Prisma, Redis, or `@/env`; `classifyHost` is pure over a static reserved-slug list | `src/proxy.ts`, `src/server/tenant/host.ts` | **Domains** (custom hostname → tenant requires a lookup) |
| Snapshot-on-write for financial records — `OrderItem.productId`/`variantId` are **plain columns, not relations**; `productName`/`unitPriceXaf` are frozen at placement | `src/server/orders/place.ts`, schema `OrderItem` | **Analytics** (top-products grouping), **Customers** (order snapshot must survive), **Delivery** (fee snapshot) |
| `ProductVariant.stock` is documented as "the ONLY place stock lives," mutated by a race-safe conditional decrement inside the order transaction, guarded by `Order.stockHeld` | `src/server/orders/stock.ts`, schema comment D-04/CAT-03 | **Inventory** (a second writer re-opens a closed race) |
| Six order states, **no `CANCELLED`**, enforced by a unit test; exactly one module may write `Order.state` (`transition.ts`), enforced by a source-scanning test | `src/server/orders/state-machine.ts`, `tests/unit/*` | **Inventory** (no restock hook), **Analytics** (no cancelled-order exclusion) |
| Never accept money fields from the client; prices re-read server-side inside the write transaction | `src/server/orders/place.ts` | **Delivery** (fee), **Marketplace** (listing price) |
| Entitlements are a **pure function of one `Organization` row** — `planTier`, `subscriptionStatus`, `trialEndsAt`; trial expiry is *derived, never stamped* | `src/server/entitlements/resolve.ts` | **Marketplace Marketing** (a second, independently-expiring subscription does not fit a single scalar) |
| No job/queue/cron infrastructure exists yet | ARCHITECTURE.md (only Redis caches + rate limits) | **Domains** (async verification), **Marketplace Marketing** (listing expiry) |
| All user-facing copy lives in `src/lib/strings.ts`; a contract test scans `.tsx` for prose literals | `CLAUDE.md`, `tests/unit/dashboard-nav.test.ts` | Every new surface, including the public Marketplace |
| `Order` has `subtotalXaf` + `totalXaf`, `deliveryAddress` (nullable free text) — **no delivery-fee column, no zone reference, no `customerId`** | schema `Order` | **Delivery**, **Customers**, **Analytics** |
| Platform Admin is **deferred out of v2.0**; only the pilot-scoped Super Admin concept exists (and is not yet built as a surface) | `.planning/PROJECT.md` | **Marketplace Marketing** (moderation queue has no home — open gap) |

---

## 1. Marketplace (public shopper discovery)

**The non-negotiable rule (Master Spec V3):** discovery only. No marketplace cart, no split payments, no vendor payouts. Shoppers click through to the merchant's own storefront to buy.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Keyword search across active listings | It is a discovery destination; a directory without search is a dead end | MEDIUM | `$queryRaw` is banned → use Prisma `contains` + `mode: "insensitive"`, or a precomputed `searchText` column with a trigram GIN index **created in the migration SQL** (the ban is on runtime raw queries, not on DDL in `prisma/migrations/**`) |
| Category browse | Six segment categories already exist as `INDUSTRY_SEGMENTS` — reuse verbatim, do not invent a second taxonomy | LOW | Pagination required from day one; do not ship an infinite list |
| Listing detail page with a single dominant "Buy on {store}" CTA | The click-through *is* the product | LOW | CTA must land on the merchant's **storefront product page**, not a generic store home — otherwise the shopper has to re-find the item and the referral is wasted |
| Merchant/store profile page (logo, name, segment, city/quartier, listing count) | In a referral marketplace the *store* is the discovery unit shoppers evaluate for trust | LOW | Reuses existing `Organization` branding fields |
| Featured / trending rails on the marketplace home | Empty-looking marketplaces read as abandoned; rails also give the platform a merchandising lever | LOW | "Trending" at pilot scale = manually curated or click-count-ordered. Do not build a ranking algorithm |
| Mobile-first, low-bandwidth image handling | Target market is low-end Android on metered data | MEDIUM | Existing Sharp/R2 preset registry already solves this — add a `marketplace` preset rather than a new pipeline |
| SEO-indexable pages (canonical URLs, metadata, sitemap) | Organic search is the only free acquisition channel a directory has; this is the entire commercial case for the marketplace | MEDIUM | Also the reason listing pages must render server-side, not client-fetched |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Filter by city / quartier | Proximity dominates purchase decisions when payment is COD and delivery is a moto driver | LOW | Depends on Delivery's zone data or a simple `Organization.city` field |
| Referral attribution — "this order came from the Marketplace" | The single fact that makes the paid add-on renewable. Directories that show listing owners real referral traffic convert to paid fastest ([Directorist](https://directorist.com/blog/online-directory-business-model/)) | MEDIUM | `?ref=mkt&listing=…` → persisted into the cart blob → snapshotted onto the `Order` row at placement. Must be a *snapshot column*, not a live join |
| "Verified merchant" badge tied to live subscription status | Cheap trust signal; the market's dominant marketplace (Jumia) has a well-documented counterfeit/trust problem ([Business Daily](https://www.businessdailyafrica.com/markets/marketnews/Jumia-delists-vendors-selling-counterfeits/3815534-5442654-2qop4o/index.html)) | LOW | Derive from the org row at query time; never store a `verified` boolean that can go stale |
| Recently-added rail | Gives new merchants immediate visibility, which is what makes them pay in month two | LOW | Pure `orderBy` |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Marketplace cart / unified checkout | "It's a marketplace, marketplaces have carts" | Forbidden by spec. Also implies split payments, vendor payouts, escrow, chargeback handling, and makes the platform merchant-of-record — with **no payment gateway integration in the product at all** | Click-through to the merchant storefront, which already has a working cart and the manual-payment claim flow |
| Cross-store shopper reviews / ratings | Trust signal | Needs shopper identity (doesn't exist), moderation capacity (doesn't exist), and dispute handling. One fake-review scandal at pilot scale is unrecoverable | "Verified merchant" badge + order-count signal derived from real orders |
| Shopper accounts / wishlists / saved searches on the marketplace | "Every marketplace has accounts" | An entirely new, tenant-less auth surface with password resets, GDPR-shaped data, and zero revenue attached. Checkout is deliberately guest-only | localStorage "recently viewed"; share-to-WhatsApp instead of a wishlist |
| Personalized recommendations | Sounds modern | No behavioral data, no shopper identity, and at pilot catalog size the recommendations would be visibly random | Category rails + "more from this store" |
| Live stock/quantity display on marketplace cards | "Shoppers want to know it's available" | Cross-tenant reads of `ProductVariant.stock` on every card is an N+1 and a caching nightmare; also leaks competitive information across merchants | Boolean "available / sold out" derived at render, computed once per listing |
| Price comparison across merchants for the same item | Classic marketplace feature | Turns the platform into a race to the bottom and gives merchants a direct reason to churn. Also requires a product-identity graph (GTIN/matching) that does not exist | No comparison surface. Listings are per-merchant, period |
| Marketplace-wide promotions / coupon codes | Growth lever | Discount codes are explicitly out of scope; a platform-funded discount has no settlement path without a gateway | Featured placement as the merchandising lever instead |

### Hidden Complexity — CRITICAL

1. **There is no sanctioned database client for a cross-tenant read.** `scopedDb` filters to one tenant; `platformDb` is a narrow allowlist of registry tables (`Organization`, `User`, `Member`, …); `adminDb` is ESLint-fenced to `src/server/admin/**` *and* forbidden from importing `tenant-scoped`. The Marketplace reads `Product` / `ProductImage` / `ProductVariant` rows across all tenants. **Do not "just use `adminDb`"** — it is unscoped in both directions and its import zone is the admin surface, which this milestone deferred. This needs a deliberately designed **fourth client** (e.g. `marketplaceDb`) with: its own ESLint import zone, read-only method surface, a hard-coded allowlist of readable models *and columns*, and a mandatory visibility predicate baked in. Getting this wrong is a cross-tenant data leak, which the project treats as non-negotiable.

2. **Never trust the listing row as the display source of truth.** A listing that carries its own title/price/image is a merchant-editable bait-and-switch surface (list at 5,000 XAF, sell at 15,000) and doubles the moderation surface. The listing row should carry **only**: `productId`, lifecycle state, review/moderation metadata, sort/boost fields, timestamps, and (at most) one reviewed "highlight" string. Everything shopper-visible — name, price, image, availability — must join from the canonical `Product` / `ProductVariant` at render time. This is the exact inverse of the `OrderItem` snapshot rule, and the difference is intentional: an order is a record of the past, a listing is a *live pointer to the present*.

3. **Visibility must be a query-time predicate, not a denormalized flag.** A listing must disappear from marketplace results when *any* of these becomes true: product deactivated (`setProductActive(false)`, D-08), organization suspended (`status != "active"`), storefront subscription lapsed, marketplace add-on lapsed or expired, listing paused/rejected/expired, all variants out of stock. A stored `isVisible` boolean will go stale on at least one of those six paths. Compute it.

4. **`/marketplace` must be in the reserved-slug list** in `src/server/tenant/host.ts`, or a merchant can register the slug `marketplace` and collide with the apex route. Audit `RESERVED_SLUGS` before building.

5. **Marketplace pages must live outside `/s/[slug]/**`.** That subtree's layout *is* the tenant authorization boundary and re-scopes the palette to zinc via `data-surface="storefront"`. A cross-tenant public surface rendered inside it would be structurally wrong and visually wrong.

6. **Caching vs. freshness.** Marketplace pages are the one surface where ISR is genuinely valuable (public, high-read, low-write). But price and availability changes must invalidate. Recommend short `revalidate` plus on-demand revalidation triggered from `updateProduct` / `setProductActive` — not a long TTL.

### Minimum viable Marketplace

Home page with category rails + a featured rail + a recently-added rail; category browse with pagination; substring keyword search with no relevance ranking; listing detail that re-reads the canonical product and CTAs to the storefront product page; merchant profile page; click counting. **That is complete to a shopper.** Anything more is over-building.

---

## 2. Marketplace Marketing (merchant paid add-on)

Separate subscription from the Storefront plan. Plan capacities 10 / 25 / 50 products. Lifecycle: Selected-Not-Published → Pending Review → Active → Paused → Rejected → Expired.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Add-on activation page: price, capacity, explicit "this is a second, separate subscription" | Merchants who think they already paid for it will dispute the charge | LOW | Reuse the existing pricing-card/plan-selection components |
| Product picker sourced from the existing catalog | The core rule: listings reference products, never duplicate them | LOW | Must be a picker, never a "create listing product" form. Exclude already-listed and inactive products from the picker |
| Listings list with state chips and a capacity counter ("18 of 25 used") | Capacity is what the merchant is paying for; they must see it burn | LOW | Reuse the existing `StatusBadge` / `DataTable` primitives |
| Lifecycle actions: submit for review, pause, resume, withdraw | Standard publish-workflow expectation | MEDIUM | Actor asymmetry matters — see hidden complexity #2 |
| Rejection reason visible to the merchant | A rejection with no reason generates a support thread every single time | LOW | Mirrors the existing D-11 pattern: `OrderEvent.reason` is already shown to customers on a rejected payment claim |
| Expiry date per listing | They bought a time-boxed thing | LOW | Derived, not stamped — see hidden complexity #4 |
| Per-listing views and click-throughs | Minimum proof that money bought something | LOW | Two counters, incremented on render / on CTA click |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Attributed orders per listing** (not just clicks) | Converts "I paid 5,000 XAF for views" into "I paid 5,000 XAF and got 4 orders." This is the renewal argument | MEDIUM | Requires the marketplace referral param → cart → `Order` snapshot chain. Build the chain once in Marketplace; surface it here |
| "Your listed product is out of stock / was deactivated" nudge | Protects the marketplace's quality and the merchant's spend simultaneously | LOW | Derived at page load; no job needed |
| Auto-pause on capacity downgrade (oldest-first, merchant chooses which to keep) | Silently deleting listings when someone downgrades is the kind of thing merchants tell each other about | MEDIUM | Pause, never delete. D-08's no-hard-delete philosophy extends naturally |
| Bulk submit (select 10 products → one review submission) | A merchant with 25 capacity will not run 25 separate flows | LOW | One action, N rows, one transaction |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| CPC bidding / auction placement / ad budgets | "That's how marketplace ads work" | Requires metered billing, budget pacing, click-fraud detection, and a payment gateway that does not exist. Payment here is a manual Mobile Money transfer verified by a human | Fixed-capacity flat-fee tiers (already the spec's model). Featured slots sold manually if needed |
| Separate listing content (own title / description / images) | "Merchants want marketing copy" | The bait-and-switch surface, and it doubles moderation load — every field becomes a thing a human must read | At most one short, reviewed "highlight" string. Everything else comes from the canonical product |
| Auto-list every product in the catalog | Convenience | Destroys the scarcity that makes 10/25/50 capacity tiers sellable, and floods a moderation queue that has one human behind it | Explicit per-product selection. Bulk submit for ergonomics |
| Instant self-serve publish (no review) | Faster merchant experience | The marketplace is the *platform's* brand surface. One counterfeit or adult listing on the homepage at pilot scale is unrecoverable. Jumia's own controls are onboarding vetting + catalogue configuration + ongoing moderation + delisting penalties ([Jumia anti-counterfeit policy](https://vendorhub.jumia.com.ng/counterfeits/)) | Pending Review is already in the spec's lifecycle. Keep it. Optionally fast-path merchants with a clean history later |
| Per-listing conversion-rate metric | "Views, clicks, and conversion rate" reads as a complete analytics set | At 30 views and 1 order, "3.3% conversion" is noise presented as insight ([Quikly](https://hello.quikly.com/blog/ecommerce-performance-metrics/), [Affinsy](https://www.affinsy.com/blog/the-top-10-ecommerce-analytics-mistakes-to-avoid)) | Absolute counts only: views, clicks, attributed orders, attributed revenue |
| Scheduled publishing / campaign calendars | Shopify has scheduled publishing | Needs a scheduler; there is no job infrastructure. Also solves a problem nobody in the pilot has | Manual submit. Revisit if merchants ask twice |

### Hidden Complexity — CRITICAL

1. **The entitlement model cannot represent two subscriptions.** `resolveEntitlements(org, now)` is a *pure function of one `Organization` row*, reading `planTier`, `subscriptionStatus`, and `trialEndsAt` — all scalars. A second product with its own independent price, status, capacity, and expiry has nowhere to live. This needs either a dedicated `MarketplaceSubscription` model or (better, and only marginally more work now) a generalized `Subscription` table keyed by `(tenantId, product)`. Either way `resolveEntitlements`'s signature changes, which touches `merchantAction`, `requireMerchantContext`, and every gated action. **This is the largest hidden cost in the whole milestone and it is invisible from the feature description.** Plan it explicitly.

2. **Reuse the order state-machine pattern verbatim, but note the actor asymmetry.** The codebase already has a hard-won, test-enforced pattern: one `Readonly<Record<…>>` transition table, one `canTransition` predicate, one sanctioned writer, one append-only event row per transition. The listing lifecycle should be `LISTING_TRANSITIONS` / `canTransitionListing` / `transitionListing` / `ListingEvent`, with a matching source-scanning test. The difference from orders: the order machine keys on `(channel, from, to)`; the listing machine must key on **`(actor, from, to)`** — a merchant may pause/resume/withdraw, only the platform may approve/reject. Encoding the actor in the table is what prevents a merchant self-approving via a direct POST to the Server Action.

3. **The moderation queue has no home — this is an unresolved roadmap gap.** Pending Review requires a platform-side reviewer surface, and Platform Admin was explicitly deferred out of v2.0. Three options, all of which are roadmap decisions rather than implementation details: (a) build a single minimal moderation page inside the pilot-scoped Super Admin; (b) route review requests through the existing SUB-03/ADM-05 merchant↔platform support thread; (c) descope Pending Review to auto-approve with retroactive takedown. **(a) is recommended** — one page, one list, two buttons — but it must be named in the roadmap, or Marketplace Marketing ships with a lifecycle state nobody can move a listing out of.

4. **Expiry must be derived, not stamped — follow the trial precedent.** There is no cron. The codebase already solved this exact problem once: trial expiry is never written to a column, it is computed by `resolveEntitlements` from `(createdAt + TRIAL_DAYS)` and `now`, specifically so there is no window where a row is in the wrong state. Do the same: store `expiresAt` on the listing (or derive it from the add-on subscription period) and treat `EXPIRED` as a **read-time derived state**, not a persisted enum value someone has to write. This removes the need for job infrastructure entirely.

5. **Capacity enforcement is a server-side count at submit time, and the definition matters.** Decide once, in writing, which states consume capacity. Recommended: **Pending Review + Active + Paused consume; Selected-Not-Published, Rejected, and Expired do not.** Enforce in the Server Action (count-then-write, refusing at `count >= limit`), exactly as `createProduct` already enforces the product cap — the disabled button is a courtesy, the action is the control.

6. **A listing whose product was hard-referenced must survive product deactivation.** D-08 means products are never deleted, so the `productId` reference is always resolvable — good. But `active: false` must make the listing invisible *and* tell the merchant why, rather than silently rejecting it.

### Minimum viable Marketplace Marketing

Activation page → product picker → listing list with capacity counter and state chips → submit/pause/resume/withdraw → a platform-side approve/reject page with a reason field → views and click counts per listing → derived expiry. **That is complete to a merchant.**

---

## 3. Customers

Merchant-side profiles + order history. Checkout stays guest-only.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Customer list: name, phone, order count, total spent, last order date | Every commerce dashboard has this; its absence reads as "this isn't a real system" | LOW | Aggregate columns can be computed live at pilot volume; do not denormalize yet |
| Search by phone or name | The merchant's actual use case is "someone just called me, who are they?" | LOW | Phone search must match on the normalized form, not the typed form |
| Customer detail with full order history | The reason the list exists | LOW | Links into the existing order detail pages |
| Auto-creation from checkout — merchant never types a customer | Manual customer entry guarantees an empty, useless list | MEDIUM | Requires phone normalization at order-write time |
| Click-to-WhatsApp and click-to-call from the profile | In this market, that *is* the CRM. WhatsApp deep-link generation already exists in `src/server/payments/*` | LOW | Reuse the existing deep-link helper |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Repeat-customer flag surfaced on the Orders list | Merchants make fulfillment and COD-risk decisions on exactly this signal, and currently do it from memory | LOW | One count, one badge |
| COD/payment reliability signal per customer (placed vs. confirmed vs. disputed vs. fulfilled) | The dominant real-world risk in a COD + manual-transfer market is the customer who orders and vanishes. No competitor in this segment surfaces it | MEDIUM | Pure aggregation over existing `Order.state` — no new data needed |
| Merchant-private note per customer | "Always late, call before delivery." Merchants keep this in their heads or a notebook | LOW | Free text, never shown to the customer |
| Manual merge of duplicate customer records | Duplicate rates of 10–30% are normal without a data-quality process ([CDP.com](https://cdp.com/glossary/identity-resolution/)) | MEDIUM | Merge must relink orders, not delete them |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Shopper login / customer accounts | "Customers want to track their orders and reorder" | An entirely new auth surface: password resets over unreliable SMS, account-takeover risk, and it converts a zero-friction guest checkout into a signup wall in a market where signup walls kill conversion. The tracking-token link already solves order tracking | Keep guest checkout. The existing hashed tracking token gives order visibility with no account |
| Email marketing / campaigns / newsletters | "I have their contact details, let me market" | Explicitly out of scope in PROJECT.md. Also needs consent capture, unsubscribe handling, deliverability/reputation work, and Resend is not yet wired into a single send call | Click-to-WhatsApp. It's what merchants use anyway |
| Customer segmentation / tags / smart lists | "Segment my VIPs" | Explicitly out of scope. Segmentation without a campaign tool to act on it is a filter with no destination | Sort the list by total spent |
| Loyalty points / store credit | Retention lever | Creates a money-like balance with no payment system, no settlement, and no accounting behind it. A credit balance you can't reconcile is a liability | Repeat-customer badge; merchant-negotiated discounts happen over WhatsApp |
| Cross-tenant customer identity ("this shopper also bought at Store B") | "Platform-level insight" | A direct tenant-isolation violation and a privacy problem, on a platform whose security constraint is explicitly non-negotiable | Customers are per-merchant, full stop |
| Automatic fuzzy merge on name similarity | "Deduplicate for me" | Shared handsets are common in this market — same phone, genuinely different buyers — and name spelling varies wildly. Probabilistic merging will merge real people | Deterministic key (normalized phone) only. Manual merge/split affordance for the rest |

### Hidden Complexity

1. **The only durable identity key is the phone number, and it is currently free text.** `Order.customerPhone` is an unvalidated string. A `Customer` model needs a normalized column (E.164) with `@@unique([tenantId, phoneE164])`. Phone formatting helpers already exist under `src/server/payments/*` for the Mobile Money flow — reuse them rather than writing a second normalizer, or the two will diverge and the same person will exist twice.

2. **Backfill is the real work, and some of it will fail.** Existing orders carry unnormalized phones. The migration must create `Customer` rows from distinct normalized phones and link orders. Some strings will not normalize (typos, landlines, international formats). **Make `Order.customerId` nullable** so unlinkable historical orders keep rendering, rather than blocking the migration or inventing placeholder customers.

3. **Do not replace the order's snapshot columns with a join.** `Order.customerName` / `customerPhone` must stay as snapshot columns. Adding `customerId` alongside them is correct; removing them would violate the snapshot-on-write rule and let a customer rename retroactively rewrite order history — the exact failure `OrderItem.productName` exists to prevent.

4. **Which name wins?** Multiple orders from one phone will carry different name spellings. Recommended: the canonical `Customer.name` is the *most recent* order's name, with the merchant able to override. First-write-wins produces a list full of typos from six months ago.

5. **Aggregate definitions must match Analytics.** "Total spent" on a customer profile and "revenue" on the analytics page must use the same order-state definition (see Analytics hidden complexity #1) or the numbers will visibly disagree.

6. `Customer` is tenant-scoped: required `tenantId`, registered in `TENANT_SCOPED_MODELS`, indexed leading with `tenantId`.

### Minimum viable Customers

Auto-created customer rows keyed on normalized phone; searchable list with order count / total spent / last order; detail page with order history and a WhatsApp/call button; a nullable-`customerId` backfill. **That is complete to a merchant.**

---

## 4. Inventory

Expanding beyond today's single `ProductVariant.stock` field.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Stock levels view across all variants, filterable to low / out-of-stock | The merchant's daily question is "what am I about to run out of" | LOW | Variant-level rows, grouped by product |
| Inline "set to N" and "adjust by ±N" | Typing an absolute and adjusting a delta are different mental operations; supporting only one frustrates half the time | MEDIUM | Both must route through one writer — see hidden complexity #1 |
| Low-stock threshold + a dashboard indicator | The whole point of tracking stock | LOW | Start with one store-wide default threshold, add per-product override only if asked |
| Adjustment history per variant with reason codes | Turns "a number I typed" into something a merchant trusts | MEDIUM | Append-only, mirroring `OrderEvent` |
| Storefront out-of-stock behavior | Already partially exists via stock holds; must stay consistent with the new surface | LOW | Do not add a second availability rule |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Reason-coded adjustments (Restock / Damaged / Lost / Correction / Returned-COD) | Adjustment logs with timestamps, user IDs, and reason codes are the standard control ([Extensiv](https://www.extensiv.com/blog/inventory-audit)); reason codes also let the merchant see *why* stock evaporates | LOW | A short, fixed enum. Do not allow free-text reason categories |
| "Returned — COD refused" as a first-class reason code | The most common inventory event in a COD market, and there is no order state for it | LOW | Product framing that costs almost nothing and matches reality |
| Bulk stock update grid or CSV import | A grocery merchant with 200 SKUs will not click 200 times | MEDIUM | One transaction, one ledger row per changed variant |
| Low-stock in-app nudge / email | Prevents the silent stockout | LOW–MEDIUM | Resend is a declared dependency but not yet wired to any send call — first email send is more work than it looks |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-warehouse / multi-location stock | "We'll need it eventually" | Explicitly out of scope. Multiplies every stock read, every hold, and every availability check, and forces a location dimension into the order transaction | Single implicit location |
| Purchase orders / supplier management / auto-reorder | ERP-shaped completeness | SME merchants here buy stock in person at a market. There is no supplier to send a PO to | Low-stock alert. The merchant knows what to do next |
| COGS / inventory valuation (FIFO, weighted average) | "Show me my margin" | Accounting, not commerce. Requires cost prices merchants will not maintain, and produces confidently wrong numbers when they don't | Nothing. Revisit only if merchants ask for margin repeatedly |
| Cart-level stock reservations with timed expiry | "Hold the item while they check out" | The current model holds stock at *order placement*, which is correct and race-safe. Cart reservations need a reaper job (no job infra) and cause phantom out-of-stocks that merchants can't explain | Keep placement-time holds |
| Barcode / GTIN scanning | Warehouse-grade feel | No scanner hardware, and no GTIN discipline in the informal supply chain | SKU is already an optional free-text field |
| Making the ledger the source of truth (stock = SUM of movements) | "Event sourcing is more correct" | Requires summing on every storefront availability read, and is incompatible with the conditional-decrement race protection that guards checkout | Counter is authoritative; ledger is an audit companion (see #2) |

### Hidden Complexity — CRITICAL

1. **`ProductVariant.stock` is guarded by a race-safe conditional decrement, and a second writer re-opens that race.** `holdStockForLines` performs a conditional decrement inside the order transaction, and `Order.stockHeld` is an idempotency marker against double release. An Inventory feature that calls `variant.update({ stock })` from a second code path can lose a concurrent checkout's decrement. **Mitigation:** exactly one non-order writer, `adjustStock`, which (a) applies the delta as a conditional/atomic update rather than a read-modify-write, and (b) writes the ledger row in the same transaction — mirroring `transition.ts`'s "state write + event row, always paired" rule. Consider a source-scanning contract test (`single-stock-writer.test.ts`) in the style of the existing `single-order-state-writer.test.ts`; the codebase's own precedent says this is how invariants get kept.

2. **Counter + append-only ledger, not one or the other.** Keep `ProductVariant.stock` as the authoritative counter (fast reads, race-safe decrement) and add an append-only `StockMovement` ledger as the audit companion. This is the same split the codebase already uses for `Order.state` + `OrderEvent`, so it needs no new mental model.

3. **Order-driven movements currently write nothing to any ledger.** If the ledger is meant to reconcile against the counter, `holdStockForLines` must also emit ledger rows — which means editing the single most safety-critical transaction in the codebase. **Recommended MVP: scope the ledger to manual adjustments only, and label it "Adjustments" in the UI, not "Stock history."** A ledger that silently omits sales will be read as a bug by the first merchant who does the arithmetic. Decide and label explicitly; do not leave it ambiguous.

4. **No `CANCELLED` state and no returns flow means restocking has no hook.** A COD delivery refused at the door is the most common real inventory event in this market, and the order state machine deliberately has no state for it (cancellation is "a human conversation," enforced by a test). Handle it as a manual, reason-coded adjustment — and say so in the UI copy. **Do not** propose a seventh order state; that fight was already had and settled.

5. **`Product` has no stock column and every product has ≥1 variant.** Product-level stock in the UI must be a computed sum over variants, never a stored column, or it will drift.

6. **DISPUTED orders still hold stock.** Decide and document: does a dispute release the hold? Recommended **no** — the goods may already be gone, and auto-releasing would let a disputing customer's stock be re-sold. Make it a manual adjustment.

7. **Negative stock.** An "adjust by −10" on a variant with 3 in stock must do something defined. Recommend clamping to 0 while recording the *requested* delta in the ledger, so the discrepancy is visible rather than silently swallowed.

### Minimum viable Inventory

A variant-level stock table with low/out-of-stock filters; one `adjustStock` writer supporting set-to and adjust-by; a fixed reason-code enum; an append-only adjustment ledger visible per variant; one store-wide low-stock threshold with a dashboard indicator. **That is complete to a merchant.**

---

## 5. Delivery

Today delivery is only copy in checkout; there is no configuration surface, no fee, and no zone.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Merchant-defined named zones with a flat fee each (Akwa, Bonanjo, Deido, Bonabéri, "Hors Douala") | Flat per-zone pricing is how delivery is actually priced here; couriers charge per trip | LOW | 3–10 zones is the realistic count. Do not build for 100 |
| Zone selection at checkout with the fee shown before commitment | A fee that appears after the customer commits destroys trust — and here it also breaks the transfer amount | MEDIUM | Must resolve before the payment instructions render |
| Fee included in the order total, the WhatsApp message, and the transfer amount | The manual-transfer flow shows an *exact amount*; a mismatch breaks payment-claim reconciliation | MEDIUM | See hidden complexity #3 |
| Free-delivery threshold ("free over 25,000 XAF") | Near-universal expectation and the merchant's main AOV lever | LOW | Evaluated on the server-recomputed subtotal |
| Pickup-in-store as a zero-fee option | Very common here; also the fallback when a zone isn't covered | LOW | Branches address validation and the WhatsApp template |
| Fulfillment settings: preparation time / delivery promise text | "Livraison sous 24–48h à Douala" is the answer to the question every shopper asks | LOW | Free text with a sensible default |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Seeded zone presets per city (Douala / Yaoundé quartiers) | Merchant configures delivery in one tap instead of typing 15 quartier names — matches the onboarding promise of "live in minutes" | LOW | A static data table, same pattern as the plan registry and industry segments |
| Landmark / description address field instead of a street-address form | Sub-Saharan Central African cities lack comprehensive street addressing; deliveries are found by landmark and phone call ([Cameroon Tribune](https://www.cameroon-tribune.cm/article.html/57336/fr.html/e-commerce-douala-iii-les-vendeuses-de-rue), [Smarty](https://www.smarty.com/global-address-formatting/cameroon-address-format-examples)) | LOW | Prompt for "quartier + repère (landmark)" rather than "street, city, postal code" |
| "Delivery fee paid on delivery" toggle for COD orders | Lets the merchant collect the transfer for goods only and the fee in cash — matches how this actually runs | LOW | Changes the displayed transfer amount, not the order total |
| WhatsApp location-pin instruction in the order message | The de facto address-sharing mechanism in this market | LOW | One line in the existing message template |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Weight / dimension-based rate tables | "Real shipping software has them" | Merchants do not know product weights and will not enter them; local courier pricing is per-trip, not per-kg. The tables would be filled with zeros | Flat fee per zone |
| Carrier API integration / live rates / label printing | Shopify does it | No carrier serving Douala SMEs exposes a usable API; delivery is a moto driver the merchant knows personally. DHL/UPS/FedEx coverage is urban-only and irrelevant to a 3,000 XAF order | Nothing. Manual coordination over WhatsApp |
| Postal-code or geocoded address validation | Data quality | Postal codes are effectively unused in Cameroon and street addressing is inconsistent; a validating form will *reject real orders* | Free-text landmark + a required phone number |
| Map picker with lat/long | "Precise delivery location" | Needs a paid maps key, heavy JS on low-end Android, and indoor GPS is unreliable. Also solves a problem the phone call already solves | Optional WhatsApp location pin |
| Per-product shipping rules / shipping classes | Edge cases (fragile, bulky) | Combinatorial explosion over a 3-zone reality. Every product form grows a field nobody fills in | One store-wide zone table. Bulky items handled by conversation |
| Real-time driver tracking | "Where is my order" | Requires a driver app, GPS, and a dispatch system — an entire second product | The existing order-tracking link + a WhatsApp message |
| Multi-currency delivery pricing | "Multi-country ready" | The data model is already multi-country-ready; the *feature* is not needed for a Cameroon-only pilot | XAF only, via the existing `Intl.NumberFormat("fr-CM", …)` |

### Hidden Complexity

1. **`Order` has no delivery-fee column and no zone reference.** `subtotalXaf` and `totalXaf` exist, but nothing distinguishes them today. Adding delivery requires schema change *and* a change to `placeOrder`, the most safety-critical write path in the codebase.

2. **The client may send a zone id, never a fee.** The project's own documented anti-pattern is "validating a client-submitted price against the database" — the field itself is the vulnerability. `PlaceOrderInput` must gain a `deliveryZoneId` (or a pickup discriminant) and nothing more; the fee is re-read from the zone row inside the same transaction that re-reads variant prices.

3. **Snapshot the zone name and fee onto the order.** `deliveryZoneName` + `deliveryFeeXaf` as plain columns, not an FK to a live zone the merchant can rename or reprice — identical reasoning to `OrderItem.productName` / `unitPriceXaf`. A merchant who renames "Akwa" to "Zone A" must not rewrite last month's orders.

4. **The manual-transfer amount is derived from `totalXaf`, and reconciliation depends on it being exact.** The whole payment-claim flow rests on "transfer exactly this amount." If the delivery fee is resolved after the amount renders — or if a free-delivery threshold flips between render and submit — the customer transfers the wrong amount and the merchant's claim queue fills with near-misses. The fee must be final before the payment instructions are shown, and re-validated server-side at placement.

5. **Pickup orders have no address.** Checkout validation, the WhatsApp template, and the order detail view all need a branch. Cheap, but easy to miss until a pickup order renders "Delivery address: —".

6. **Keep `deliveryAddress` as free text.** Do not attempt to parse it into structured fields. Add zone as a separate structured column alongside it.

7. **Analytics must not count delivery fees as product revenue.** Another reason the fee needs its own column rather than being folded silently into `totalXaf`. If Delivery ships after Analytics, this is a rework.

### Minimum viable Delivery

A zone table (name + flat fee + active) seeded with Douala presets; a free-delivery threshold; pickup-in-store; a zone selector at checkout with the fee shown before payment instructions; `deliveryZoneName` + `deliveryFeeXaf` snapshotted onto the order; a delivery-promise text field. **That is complete to a merchant and a shopper.**

---

## 6. Domains

Custom domain + DNS verification + TLS. Today only `{slug}.einort.com` exists.

**This is the highest-risk of the seven areas** — most of the failure modes are outside the application, asynchronous, and invisible until a merchant's live store is broken.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Add a custom domain and see the exact DNS records to create, copyable | The merchant will paste these into a registrar UI they barely understand | MEDIUM | Apex needs an **A** record; `www` needs a **CNAME** ([Vercel](https://vercel.com/docs/domains/troubleshooting)) |
| Live status: Pending DNS → Verifying → Active → Misconfigured, with a re-check button | DNS is asynchronous and outside your control; a silent spinner generates support tickets | MEDIUM | Poll on page view + manual re-check. No cron exists |
| Automatic TLS | Nobody ships a paid storefront over HTTP in 2026 | LOW (delegated) | Vercel issues via Let's Encrypt automatically once DNS resolves |
| Apex + www both handled, one redirecting to the other | Half of shoppers will type `www` | MEDIUM | Add both to the project; set `redirect` on one ([Vercel multi-tenant docs](https://vercel.com/docs/platforms/multi-tenant-platforms/configuring-domains)) |
| The EINORT subdomain keeps working after the custom domain goes live | Existing WhatsApp shares, QR codes, and links must not break | LOW | Recommend a 308 from subdomain → custom domain once active |
| Remove / replace a domain | Merchants change their minds and let domains lapse | MEDIUM | Must detach from the Vercel project *and* from the account |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Registrar-specific instructions with screenshots for the registrars Cameroonian merchants actually use | This is where 90% of the support cost lives. A generic "add a CNAME" instruction is where non-technical merchants stop | LOW (content) | Static content, high leverage |
| A "diagnose my DNS" check that names the *specific* problem | "You have a CAA record that doesn't allow Let's Encrypt" is actionable; "Invalid Configuration" is not | HIGH | Requires server-side DNS lookups for A/AAAA/CNAME/CAA/TXT. Genuinely valuable, genuinely fiddly |
| Canonical-URL / redirect control between subdomain and custom domain | Prevents duplicate-content SEO damage, which silently costs the merchant traffic | LOW | Vercel's own docs call this out |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Selling / registering domains on the merchant's behalf | "Make it one click" | Registrar accreditation or reseller relationships, WHOIS, renewals, refunds, and an ICANN-mandated 60-day transfer lock. This is a business, not a feature | Instructions + a list of registrars |
| Running DNS / nameservers for merchants | "Then we control it" | You become responsible for their MX records and their email going down. Vercel explicitly does not provide mail service | Merchant keeps their DNS at their registrar; they add two records |
| Email hosting on the custom domain | Merchants will absolutely ask | Out of scope for the platform and for Vercel. Getting this wrong breaks a business's email | Point at MX-record documentation and stop |
| Wildcard custom domains for merchants (`*.merchant.com`) | "Sub-stores" | Wildcard certificates require the DNS-01 challenge, which on Vercel means the merchant must move their nameservers to Vercel — a much bigger ask that also takes over their email DNS | Apex + www only |
| "Live in 60 seconds" promises anywhere in the UI | Marketing appeal | Nameserver changes take 24–48h to propagate globally and are entirely outside your control. Promising speed converts a normal wait into a support ticket | "Usually within an hour, sometimes up to 48 hours" |
| Building your own ACME/certificate pipeline | "Avoid vendor lock-in" | Renewal, rate limits, key storage, and OCSP for a solo builder on a 30-day cadence. Vercel already does it for free | Delegate entirely to Vercel |

### Hidden Complexity — CRITICAL

1. **The "proxy has zero I/O" constraint and custom domains are in direct conflict.** `classifyHost` is a pure function over a static reserved-slug list, and `src/proxy.ts` is forbidden from importing Prisma, Redis, or `@/env`. An arbitrary custom hostname cannot be classified without a lookup. **This is an architectural decision that must be made during phase planning, not discovered during implementation.** Two viable shapes: (a) keep the proxy pure — unknown hostnames fall through to a catch-all route that performs the Redis/DB lookup and renders or 404s there, keeping the I/O in the app layer where `resolveTenantBySlug` already lives; (b) permit a Redis-only lookup in the proxy, which explicitly relaxes a documented invariant. **(a) is recommended**, because the tenant Redis cache and its degrade-to-DB behavior already exist in `src/server/tenant/cache.ts` and can be reused as-is.

2. **A custom domain needs a `StoreSlugHistory` equivalent.** That table exists because a released slug would otherwise be re-claimable by a different merchant and would inherit the original's inbound links, QR codes, and WhatsApp shares — a store-hijack window. A released custom domain has exactly the same property. Needs a globally unique `domain` column (not tenant-scoped — a hostname must be unique platform-wide, the same documented exception `StoreSlugHistory.slug` makes) plus an append-only holder history.

3. **Vercel-side edge cases, all verified against Vercel's current documentation:**
   - Apex domains **must** use an A record — a CNAME at the zone apex violates RFC 1034 §3.6.2 and breaks NS/MX records.
   - **Vercel does not support IPv6** for third-party custom domains. A stale `AAAA` record left over from a previous host silently breaks the site for IPv6-capable clients.
   - A pre-existing **CAA record** that does not include `0 issue "letsencrypt.org"` blocks certificate issuance silently.
   - A leftover **`_acme-challenge` TXT record** from a previous host blocks issuance.
   - **`/.well-known` must never be rewritten or redirected** — Vercel uses the HTTP-01 challenge through that path. Worth an explicit check against `src/proxy.ts`'s matcher.
   - A domain already attached to **another Vercel account** requires a TXT ownership record before it can be used.
   - **Cloudflare-proxied ("orange cloud") domains** are a recurring failure: recursive CAA lookups don't follow the CNAME to Vercel's records, and Flexible SSL mode produces a redirect loop. The practical fix is DNS-only during verification.
   - **Punycode**: `crème.cm` must be converted to `xn--crme-hpa.cm` before submission.

4. **The platform's own `*.einort.com` wildcard requires Vercel nameservers on `einort.com`.** Wildcard SSL is DNS-01-only, and Vercel requires the nameserver method to handle the challenge. **Verify this is already how the platform domain is configured before planning any of this work** — if it is not, the existing subdomain model has a latent problem independent of custom domains.

5. **The Public Suffix List gap.** Vercel's multi-tenant guidance recommends submitting the shared tenant suffix (`einort.com`) to the PSL so browsers treat `a.einort.com` and `b.einort.com` as separate sites for cookie scoping. Without it, one tenant can set a `Domain=einort.com` cookie that is sent to every other tenant and to the dashboard. **The codebase already applies the correct mitigation for the cart** (host-scoped cookie with no `Domain` attribute — explicitly documented as preventing cross-tenant leakage), but the **Better Auth session cookie should be audited for the same property**, and `__Host-` prefixing considered. PSL review has no guaranteed timeline, so if it is going to happen it must start early. Custom domains do *not* need PSL entries — merchant-owned domains are already separate sites.

6. **Two hostnames, two carts.** Because the cart cookie is deliberately host-scoped, a shopper who browses on the subdomain and then lands on the custom domain has two independent carts. Do not attempt to share cart state across hostnames — that would require relaxing the very cookie scoping that prevents cross-tenant leakage. A 308 redirect from subdomain → active custom domain solves this and the duplicate-content SEO issue in one move.

7. **Verification is asynchronous and can fail forever.** With no job infrastructure, use: poll on dashboard page view, a manual "Re-check" button, and a stored backoff/attempt counter on the row so a permanently-misconfigured domain doesn't hammer the Vercel API on every render. Vercel API rate limits are per-account.

8. **New external dependency and new secrets.** `@vercel/sdk`, plus `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` added to the validated `src/env.ts` schema. The token is highly privileged — it can add and delete domains on the production project. Treat it accordingly; it should be optional in the env schema so local dev without it still boots (following the existing Upstash-optional precedent).

9. **Entitlement gate.** Custom domains are almost certainly a Business/Professional feature. `PlanLimits` needs a `customDomain: boolean`, and the gate must be enforced in the Server Action, not the UI — the existing `merchantAction` pattern already does this correctly.

10. **Scale note (not a pilot blocker):** per-project domain counts and API rate limits on Vercel are a real ceiling long before the 2,000,000-store architectural target. Worth one sentence in the architecture doc; worth zero engineering time now.

### Minimum viable Domains

One custom domain per store, gated by plan; a settings page showing the required A and CNAME records with copy buttons; status polling with a manual re-check; automatic TLS via Vercel; apex+www added together with a redirect; a globally unique domain table with holder history; 308 from the subdomain once active; remove/replace. **That is complete to a merchant.** The DNS diagnostic is the first thing to add afterward, driven by real support tickets.

---

## 7. Analytics

Today: ad hoc revenue/order/unit cards on the dashboard Overview. Target: a dedicated analytics page.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Revenue, order count, average order value, units sold for a selectable period | The baseline set every commerce dashboard has | MEDIUM | Depends entirely on nailing the revenue definition — see #1 below |
| Previous-period comparison (± %) | A number without a comparison is not information | LOW | Same query, shifted window |
| A time-series chart | Merchants read shape faster than tables | MEDIUM | Bucketing is the awkward part — see #4 |
| Top products by revenue and by units | The single most-used report in small-merchant commerce | MEDIUM | `groupBy` on `OrderItem.productId` — see #3 |
| Order breakdown by state and by channel (WhatsApp / manual transfer / COD) | Genuinely decision-useful *in this market specifically* — it tells the merchant which payment path actually converts | LOW | Straight `groupBy` on existing columns |
| A useful empty state | New merchants will see this page before they see an order | LOW | Tell them what to do, don't say "No data" |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Payment-channel reliability view: claims confirmed vs. disputed, COD fulfilled vs. not | This is the merchant's actual daily pain and no generic analytics package surfaces it, because no generic package has a manual-claim state machine | MEDIUM | Pure aggregation over `Order.state` + `PaymentClaim.status`. All the data already exists |
| Marketplace-attributed revenue | Directly justifies the Marketplace Marketing renewal; closes the loop on the paid add-on | MEDIUM | Requires the referral snapshot column on `Order` |
| CSV export | Merchants take numbers to an accountant or a lender | LOW | Server-generated, respecting the same revenue definition |
| WhatsApp-shareable weekly summary ("Cette semaine: 14 commandes, 87 500 XAF") | Matches how these merchants actually consume information — they will not open a dashboard daily | LOW–MEDIUM | Reuses the existing WhatsApp deep-link helper. Genuinely differentiating and cheap |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Conversion rate as a headline metric | Every ecommerce dashboard has one | With single-digit monthly orders the rate swings wildly on one order, and there is **no session/pageview pipeline** to compute a denominator anyway. It is a well-documented small-merchant analytics failure mode ([Affinsy](https://www.affinsy.com/blog/the-top-10-ecommerce-analytics-mistakes-to-avoid), [Quikly](https://hello.quikly.com/blog/ecommerce-performance-metrics/)) | Absolute counts. If a "conversion indicator" is required by the spec, show *storefront visits → orders* as two raw numbers side by side, not a percentage |
| Session / visitor analytics, funnels, cohorts, heatmaps | "Understand my traffic" | Needs a client-side event pipeline, bot filtering, consent handling, and storage growth proportional to traffic rather than orders. Explicitly out of scope ("analytics beyond basics") | Order-derived metrics only |
| Per-merchant third-party analytics embeds (GA4 / Meta Pixel snippets) | "Let merchants use their own tools" | A tenant-controlled `<script>` tag in a shared codebase is a stored-XSS-shaped hole across every storefront. It is the single most dangerous "small" feature on this list | If ever needed: a validated ID field that renders a first-party, known-shape snippet — never merchant-supplied HTML |
| Real-time / live dashboards | Feels premium | Requires polling or websockets (explicitly avoided elsewhere in this project) for data that changes a few times a day | Period-based with a refresh |
| Profit / margin reporting | "Am I making money?" | Requires cost prices per variant that merchants will not maintain, producing confidently wrong numbers | Revenue only. Explicitly labelled as revenue, not profit |
| Forecasting / trend prediction | AI-era expectation | Statistically meaningless at this order volume; will embarrass the product | Previous-period comparison |
| Pre-aggregated summary tables / materialized rollups | "It won't scale" | At pilot volume live aggregation is cheap, and a stale rollup is a whole cache-invalidation problem with no upside yet | Live aggregation. Revisit when a single merchant crosses ~50k orders |

### Hidden Complexity

1. **"Revenue" needs a state definition, and the order state machine forces the choice.** With states `ORDER_PLACED → PAYMENT_PENDING → PAYMENT_CLAIMED → CONFIRMED/DISPUTED → FULFILLED` and **no `CANCELLED`**, counting every placed order as revenue badly overstates in a manual-transfer + COD market where a meaningful share never confirm. **Recommended: headline revenue = `CONFIRMED` + `FULFILLED`, with a separate, visibly-labelled "pending / at risk" figure for `ORDER_PLACED` + `PAYMENT_PENDING` + `PAYMENT_CLAIMED` + `DISPUTED`.** Whatever is chosen, it must be defined in exactly one place and reused by the Overview cards, the analytics page, the CSV export, and the Customers page's "total spent" — or the surfaces will disagree and the merchant will trust none of them.

2. **Which timestamp buckets a metric?** `placedAt`, `confirmedAt`, and `updatedAt` all exist. A `CONFIRMED`-only revenue metric bucketed by `placedAt` means historical periods change value as old claims get confirmed. Bucketing by `confirmedAt` means "today" looks empty until claims clear. **Recommended: bucket by `placedAt` and accept late-arriving revenue** (it matches the merchant's mental model of "the day I got the order"), and note it in the UI. Decide once.

3. **Top products must group on `OrderItem.productId`, which is a plain column, not a relation — deliberately.** `groupBy({ by: ["productId"] })` works. But: (a) joining back to the live `Product` for the current name and image is a **second query**, not an `include`; and (b) `OrderItem.productName` is the *historical snapshot*, so grouping by name would split a renamed product into two rows. Group by `productId`, resolve display name from the live product.

4. **`$queryRaw` / `$executeRaw` are banned repository-wide**, so Prisma cannot express `date_trunc` for a per-day/week time series. Two options: **(a) fetch the period's orders (`id`, `placedAt`, `totalXaf`, `state`) and bucket in TypeScript** — fine to tens of thousands of rows per period, needs no schema change, no lint exception, and is the recommended MVP; or (b) add a Prisma-queryable date-only `placedOnDate` column written at placement. Do not add a lint exception for raw SQL.

5. **Index coverage.** `Order` already has `@@index([tenantId, state, placedAt])`, which is well-shaped for state-filtered date ranges. `OrderItem` has only `@@index([tenantId, orderId])` — a date-ranged top-products query must either go through `Order` first (fetch order ids, then group items) or `OrderItem` needs a `(tenantId, productId)` index. Flag this for the analytics phase's plan.

6. **Delivery fees must be excluded from product revenue** once Delivery ships. If Analytics ships first and folds everything into `totalXaf`, this becomes a rework. **Order Delivery before Analytics, or at minimum decide the fee column before Analytics is planned.**

7. **Tenant scoping is free here but worth stating:** every aggregation goes through `scopedDb(ctx.tenantId)`, which auto-filters. There is no cross-tenant analytics in this milestone (that is Platform Admin, deferred).

### Minimum viable Analytics

One page: period selector (7/30/90 days, this month) with previous-period comparison; four cards (revenue, orders, AOV, units) on one stated revenue definition plus a "pending" figure; one daily time-series chart bucketed in TypeScript; top 10 products by revenue and by units; a state breakdown and a channel breakdown; CSV export. **That is complete to a merchant.**

---

## Feature Dependencies

```
EXISTING (do not rebuild)
  Product catalog ──┬──> Marketplace Marketing (listings reference products)
                    ├──> Inventory (variant stock)
                    └──> Marketplace (canonical display source)

  Order state machine ──┬──> Analytics (revenue definition, state/channel breakdown)
                        ├──> Customers (order history, spend, reliability signal)
                        └──> Inventory (stock holds — the safety-critical overlap)

  placeOrder transaction ──┬──> Delivery (fee re-read + snapshot)
                           ├──> Customers (customerId link + phone normalization)
                           └──> Marketplace (referral attribution snapshot)

  Entitlements (planTier scalar) ──┬──> Marketplace Marketing (SECOND subscription — does not fit)
                                   └──> Domains (customDomain plan gate)

  Proxy / classifyHost / tenant cache ──> Domains (zero-I/O constraint conflict)

  Payments phone formatter ──> Customers (E.164 normalization)


NEW, INTERNAL
  Cross-tenant read client (marketplaceDb)
      └──required by──> Marketplace
                            └──required by──> Marketplace Marketing
                                                  └──requires──> Second-subscription entitlement model
                                                  └──requires──> A moderation surface  ⚠ GAP

  Marketplace referral param → cart → Order snapshot
      └──enables──> Marketplace Marketing per-listing attributed orders
      └──enables──> Analytics marketplace-attributed revenue

  Order.deliveryFeeXaf column
      └──required by──> Delivery
      └──required-before──> Analytics (or revenue is wrong)

  Customer.phoneE164 + Order.customerId (nullable)
      └──required by──> Customers
      └──enhances──> Analytics (repeat-purchase rate)

  StockMovement ledger + single adjustStock writer
      └──required by──> Inventory
      └──conflicts-with──> holdStockForLines if a second raw writer is introduced  ⚠

  Domain table (globally unique) + holder history + hostname resolution path
      └──required by──> Domains
      └──independent of──> all six other areas (can be sequenced anywhere)
```

### Dependency Notes

- **Marketplace Marketing requires Marketplace:** there is nothing to list into until the public surface exists. Building the merchant-side listing manager first produces a feature with no observable output.
- **Marketplace Marketing requires a second-subscription entitlement model:** `resolveEntitlements` is a pure function of one `Organization` row with scalar plan fields. This is the milestone's biggest hidden cost and it is not visible from the feature description.
- **Marketplace Marketing requires a moderation surface, which this milestone deferred.** ⚠ Unresolved. Must be named in the roadmap (recommended: one minimal page in the pilot-scoped Super Admin) or Pending Review becomes a dead-end state.
- **Analytics should follow Delivery**, because delivery fees must not be counted as product revenue and the fee column is the mechanism.
- **Inventory conflicts with the order stock-hold path** if implemented naively: a second raw writer to `ProductVariant.stock` re-opens the concurrency race that `holdStockForLines`' conditional decrement closed. One writer, atomic update, paired ledger row.
- **Customers enhances Analytics** (repeat-purchase rate, customer counts) but neither blocks the other; both must share one revenue/state definition.
- **Domains is fully independent** of the other six and is the only one with a hard external dependency (Vercel API + merchant DNS). It can be sequenced early (to de-risk) or late (to avoid blocking) without affecting anything else.
- **Marketplace referral attribution is one chain used by two features** — build it once, in Marketplace, and Marketplace Marketing and Analytics both consume it.

---

## MVP Definition

### Launch With (v2.0)

- [ ] **Customers** — auto-created from checkout on normalized phone, list + detail + order history + WhatsApp/call. Cheapest of the seven; unblocks repeat-customer signals everywhere.
- [ ] **Inventory** — stock table with low/out-of-stock filters, one `adjustStock` writer, reason codes, append-only adjustment ledger, one store-wide threshold.
- [ ] **Delivery** — zone table with Douala presets, flat fees, free-delivery threshold, pickup, fee snapshotted onto the order, delivery-promise text.
- [ ] **Analytics** — one page, one revenue definition, four cards + comparison, daily chart, top products, state/channel breakdown, CSV export.
- [ ] **Domains** — one domain per store, plan-gated, A+CNAME instructions with status polling and manual re-check, automatic TLS, apex+www, 308 from subdomain.
- [ ] **Marketplace** — home rails, category browse, substring search, listing detail re-reading canonical product, merchant profile, click tracking, cross-tenant read client.
- [ ] **Marketplace Marketing** — add-on activation, product picker, capacity counter, full lifecycle, platform approve/reject page, views/clicks, derived expiry.

All seven are in the milestone. The MVP discipline here is not *which* features, it is **which version of each feature** — every "Minimum viable X" section above is the line.

### Add After Validation (v2.x)

- [ ] Marketplace attributed-orders chain (referral param → cart → order snapshot) — **trigger:** first merchant asks whether the add-on is working
- [ ] DNS diagnostic that names the specific misconfiguration — **trigger:** third support ticket about a domain that "isn't working"
- [ ] Bulk stock update grid / CSV — **trigger:** first merchant with >100 variants
- [ ] Low-stock email nudge (first real Resend integration) — **trigger:** a merchant reports a stockout they didn't see coming
- [ ] Customer merge/split — **trigger:** first duplicate complaint
- [ ] WhatsApp weekly summary — **trigger:** analytics page engagement is low (which it will be)
- [ ] Quartier filter on the Marketplace — **trigger:** marketplace listing count crosses ~200

### Future Consideration (v3+)

- [ ] Shopper accounts on the Marketplace — **defer:** needs a real reason to exist beyond "marketplaces have them"; revisit only if repeat cross-store shopping is observed
- [ ] Marketplace reviews/ratings — **defer:** requires shopper identity *and* moderation capacity, neither of which exists
- [ ] Multi-location inventory — **defer:** explicitly out of scope; no pilot merchant has two locations
- [ ] Session/traffic analytics — **defer:** needs an event pipeline; order-derived metrics answer the merchant's real questions first
- [ ] Pre-aggregated analytics rollups — **defer:** until a single merchant's order volume makes live aggregation slow
- [ ] CPC/auction marketplace advertising — **defer:** requires a payment gateway, which is rejected for this product

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Rationale |
|---------|------------|---------------------|----------|-----------|
| Customers (list + detail + auto-create) | HIGH | LOW | P1 | Cheapest completeness win; enables signals across other surfaces |
| Inventory (levels + adjustments + ledger) | HIGH | MEDIUM | P1 | Daily-use merchant surface; cost is concentrated in one concurrency concern |
| Delivery (zones + flat fees + pickup) | HIGH | MEDIUM | P1 | Blocks Analytics correctness; also the most-requested missing checkout piece |
| Analytics (one page, order-derived) | MEDIUM | MEDIUM | P1 | Table stakes for "running a business"; cost is all in definition discipline, not code |
| Marketplace (discovery surface) | HIGH (platform) | HIGH | P1 | The platform's own growth engine and the prerequisite for the paid add-on |
| Marketplace Marketing (add-on + lifecycle) | HIGH (revenue) | HIGH | P1 | The milestone's only new revenue line; gated on the entitlement rework and the moderation gap |
| Domains (custom domain + TLS) | MEDIUM | HIGH | P2 | Fewer merchants will use it than will use the others; highest external risk; fully independent so it can slip without blocking |
| Marketplace referral attribution | HIGH | MEDIUM | P2 | Turns the add-on from a leap of faith into a measurable purchase; skippable at launch |
| DNS diagnostic tool | MEDIUM | HIGH | P3 | Support-cost reducer, not a merchant-facing feature; build after real tickets exist |
| Bulk stock / CSV import | MEDIUM | MEDIUM | P3 | Matters only above ~100 variants |
| Low-stock email alerts | MEDIUM | MEDIUM | P3 | Requires the first real email integration; in-app indicator covers most of the value |

---

## Competitor Feature Analysis

| Area | Shopify | Jumia (regional marketplace) | Our Approach |
|------|---------|------------------------------|--------------|
| Marketplace model | Shop app + sales-channel publications; checkout stays on Shopify | Full multi-vendor marketplace: centralized cart, checkout, payouts, logistics | **Discovery-only directory.** Click-through to the merchant's own storefront. No cart, no payouts, no merchant-of-record exposure |
| Listing ↔ product relationship | `Publication` / `ProductListing`: a listing is a *relationship* between a product and a channel; product and variant publication states are independent ([Shopify](https://shopify.dev/docs/apps/build/sales-channels/product-publishing)) | Sellers create marketplace-native catalogue entries | **Adopt Shopify's model exactly.** A listing is a pointer + lifecycle state; all display data joins from the canonical product at render time |
| Listing moderation | Channel-app dependent; largely automated | Onboarding vetting + catalogue controls + AI attribute checks + ongoing moderation + delisting penalties ([Jumia](https://vendorhub.jumia.com.ng/counterfeits/)) | **Human review before first publish** (Pending Review is already in the spec's lifecycle), plus retroactive takedown. One reviewer, one page |
| Customers | Full CRM: accounts, segments, marketing consent, email campaigns | Marketplace-owned customer relationship; merchant sees little | **Merchant-side profiles only, keyed on phone.** No shopper login, no campaigns, no segments |
| Inventory | Multi-location, ledger, transfers, purchase orders | Fulfilment-centre managed | **Single location, counter + adjustment ledger, reason codes.** No PO, no valuation, no transfers |
| Delivery | Weight/dimension rate tables, carrier APIs, live rates, labels | Own logistics network | **Named flat-fee zones seeded with Douala quartiers**, landmark addresses, pickup, free-delivery threshold. No carriers, no weights, no postal codes |
| Domains | Buys/registers on your behalf, manages DNS | N/A | **Bring-your-own-domain only.** Two DNS records, Vercel-issued TLS, no registrar business |
| Analytics | Sessions, funnels, cohorts, attribution | Seller-centre dashboards | **Order-derived only**, one revenue definition, absolute counts over rates, payment-channel reliability as the local differentiator |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Existing-system constraints (all seven areas) | **HIGH** | Read directly from `prisma/schema.prisma`, `.planning/codebase/ARCHITECTURE.md`, `CLAUDE.md`, `src/server/entitlements/plans.ts` |
| Domains (Vercel behavior, DNS edge cases) | **HIGH** | Vercel official docs, current as of 2026-08 (`/docs/domains/troubleshooting`, `/docs/platforms/multi-tenant-platforms/configuring-domains`), corroborated by community reports |
| Marketplace Marketing (listing-as-publication model) | **HIGH** | Shopify's official sales-channel publishing docs; matches the spec's own "never duplicate products" rule |
| Marketplace (directory vs. marketplace tradeoffs) | **MEDIUM** | Multiple industry sources agree on the model distinction; the "shows referral traffic → converts to paid" claim is single-source and should be treated as a hypothesis |
| Delivery (Cameroon addressing reality) | **MEDIUM-HIGH** | Multiple independent sources confirm limited/inconsistent street addressing in Douala and Yaoundé; specific quartier lists were not verified and must be confirmed with the owner |
| Customers (identity resolution pitfalls) | **MEDIUM** | Industry CDP sources on duplicate rates and guest-checkout matching; the "shared handset" observation is a market inference, not a verified statistic |
| Inventory (counter vs. ledger) | **MEDIUM-HIGH** | General best-practice sources on adjustment audit trails; the counter-vs-ledger recommendation is derived primarily from this codebase's own existing `Order.state` + `OrderEvent` pattern, which is a stronger argument than any external source |
| Analytics (conversion-rate anti-feature) | **MEDIUM-HIGH** | Multiple independent sources on low-volume conversion-rate distortion and vanity metrics; the specific "no session pipeline exists" constraint is verified from the codebase |

### Gaps and Open Questions for Phase Planning

1. **Where does listing moderation live?** Platform Admin is deferred; Pending Review needs a reviewer surface. Must be resolved before Marketplace Marketing can ship end-to-end.
2. **Is `einort.com` already on Vercel nameservers?** Wildcard subdomain SSL requires it. Verify before planning Domains.
3. **Second-subscription model shape:** dedicated `MarketplaceSubscription` vs. generalized `Subscription` table. Affects `resolveEntitlements`' signature and therefore every gated action.
4. **The one revenue definition.** Must be decided before Analytics is planned and applied retroactively to the Overview cards and Customers' "total spent."
5. **Does the inventory ledger include sales, or only manual adjustments?** Determines whether `holdStockForLines` must be touched.
6. **Actual Douala quartier list** for the delivery zone presets — needs owner input, not research.
7. **Marketplace add-on pricing in XAF** and whether the 10/25/50 capacities map to the existing Starter/Business/Professional names or to independent add-on tiers — the spec gives capacities but the naming/pricing is unconfirmed.
8. **Session cookie `Domain` attribute audit** — the cart cookie is verified host-scoped; the Better Auth session cookie was not inspected in this research.

---

## Sources

- Vercel — [Troubleshooting domains](https://vercel.com/docs/domains/troubleshooting) (official, last updated 2026-08-11): apex A-record requirement, no IPv6 support, CAA records, `_acme-challenge`, `/.well-known`, wildcard/nameserver requirement, domain-ownership TXT, punycode, propagation times
- Vercel — [Configuring Custom Domains for multi-tenant platforms](https://vercel.com/docs/platforms/multi-tenant-platforms/configuring-domains) (official, last updated 2026-08-25): SDK add/verify/remove calls, wildcard + nameservers, apex/www redirects, Public Suffix List guidance, `__Host-` cookie prefixing
- Vercel KB — [A records and CAA with Vercel](https://vercel.com/kb/guide/a-record-and-caa-with-vercel)
- Cloudflare — [Troubleshooting Cloudflare for SaaS](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/reference/troubleshooting/): proxied-CNAME CAA lookup behavior
- Shopify — [Product and variant publishing](https://shopify.dev/docs/apps/build/sales-channels/product-publishing) and [ProductListing](https://shopify.dev/docs/api/admin-rest/latest/resources/productlisting): the listing-as-publication model
- Jumia — [Anti-counterfeit policy / VendorHub](https://vendorhub.jumia.com.ng/counterfeits/) and [Jumia delists vendors selling counterfeits](https://www.businessdailyafrica.com/markets/marketnews/Jumia-delists-vendors-selling-counterfeits/3815534-5442654-2qop4o/index.html): marketplace moderation and vetting practice in African markets
- [Directory Website vs Marketplace](https://directoryeasy.com/blog/directory-website-vs-marketplace) and [Online Directory Business Model](https://directorist.com/blog/online-directory-business-model/): directory vs. marketplace tradeoffs, referral-traffic-drives-paid-conversion claim (single-source, LOW confidence)
- [Cameroon Tribune — E-Commerce Douala III](https://www.cameroon-tribune.cm/article.html/57336/fr.html/e-commerce-douala-iii-les-vendeuses-de-rue) and [Smarty — Cameroon address format](https://www.smarty.com/global-address-formatting/cameroon-address-format-examples): limited/inconsistent street addressing in Douala and Yaoundé
- [Extensiv — Inventory audit procedures](https://www.extensiv.com/blog/inventory-audit) and [Shopify — Inventory adjustment](https://www.shopify.com/blog/inventory-adjustment): reason-coded, timestamped, user-attributed adjustment logs as the standard control
- [CDP.com — Identity resolution](https://cdp.com/glossary/identity-resolution/) and [Klaviyo — Identity resolution](https://help.klaviyo.com/hc/en-us/articles/12902308138011): guest-checkout identity matching, 10–30% duplicate rates without a data-quality process
- [Affinsy — Top 10 ecommerce analytics mistakes](https://www.affinsy.com/blog/the-top-10-ecommerce-analytics-mistakes-to-avoid) and [Quikly — Ecommerce performance metrics](https://hello.quikly.com/blog/ecommerce-performance-metrics/): conversion-rate distortion and vanity metrics at low volume
- Internal: `prisma/schema.prisma`, `.planning/codebase/ARCHITECTURE.md`, `.planning/PROJECT.md`, `.planning/design-references/EINORT-V3-MASTER-SPEC-AND-PROTOTYPE-V6.md`, `src/server/entitlements/plans.ts`, `CLAUDE.md`

---
*Feature research for: EINORT-Commerce v2.0 — Marketplace, Marketplace Marketing, Customers, Inventory, Delivery, Domains, Analytics*
*Researched: 2026-09-13*
