# Architecture Research

**Domain:** Multi-tenant commerce platform — integrating 7 new capability areas (Marketplace, Marketplace Marketing, Customers, Inventory, Delivery, Domains, Analytics) into an existing Next.js 16 / Prisma 7 / Postgres modular monolith
**Researched:** 2026-09-13
**Confidence:** HIGH for everything derived from repository source (verified by reading `prisma/schema.prisma`, `src/server/db/*`, `src/proxy.ts`, `src/server/tenant/*`, `src/server/dashboard/*`); HIGH for the Vercel custom-domain integration (official docs, last updated 2026-08-25); MEDIUM for the recommended new abstractions (`marketplaceDb`, listing state machine) — they are extrapolations of existing in-repo patterns, not externally verified.

**Research type:** Architecture *integration*, not greenfield. Existing architecture is treated as fixed and correct. Every recommendation below is expressed as either **NEW** (net-new file/model) or **MODIFIED** (an existing file that must change).

---

## Executive Finding

The existing architecture absorbs six of the seven areas with **zero new abstractions** — they are ordinary tenant-scoped domains that plug into `scopedDb` + `merchantAction()` + a `/dashboard/{area}` route.

Two areas break the existing model and need a deliberate decision:

1. **Marketplace (public browse)** is the codebase's **first cross-tenant read with no tenant identity at all**. There is no session (anonymous) and no `Host`-derived tenant (it lives on the apex). None of the three existing DB clients can serve it: `scopedDb` requires a `tenantId`, `platformDb` is an allowlist of five registry tables, and `adminDb` is ESLint-fenced to `src/server/admin/**` (a zone that is *also* forbidden from importing `tenant-scoped`, and whose owning feature — Platform Admin — is deferred this milestone). **Recommendation: a fourth client, `marketplaceDb`.**

2. **Domains** must add a hostname-resolution path to `classifyHost`/`proxy.ts` without granting them I/O. **Recommendation: `classifyHost` gains a pure fourth `kind`, and resolution stays in the storefront layout behind a new Redis namespace — the exact split the codebase already documents ("proxy: is this hostname *shaped* like a store? / resolve: does that store *exist and serve*?").**

Everything else in this document is detail hanging off those two decisions plus the build order.

---

## Standard Architecture

### System Overview (after this milestone)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                    Next.js 16 Proxy — src/proxy.ts  [MODIFIED]                  │
│  classifyHost(): root | reserved | store | custom (NEW) | unknown               │
│  Still pure. Still zero I/O. Still strips x-tenant-id / x-store-slug.           │
└───┬──────────────────┬─────────────────────────┬──────────────────────┬────────┘
    │ root/reserved    │ store → /s/{slug}       │ custom → /s/@{host}  │ unknown
    │ (passthrough)    │                         │ (NEW sentinel)       │ → 404
    ▼                  ▼─────────────────────────▼                      ▼
┌──────────────────────────────┐   ┌────────────────────────────────────────────┐
│  APEX SURFACE                 │   │  STOREFRONT SURFACE  src/app/s/[slug]/**   │
│  ├─ (dashboard)/dashboard/**  │   │  layout.tsx [MODIFIED] IS the auth         │
│  │   + customers/  [NEW]      │   │  boundary. Now resolves BOTH:              │
│  │   + inventory/  [NEW]      │   │    "acme"      → resolveTenantBySlug       │
│  │   + delivery/   [NEW]      │   │    "@shop.cm"  → resolveTenantByDomain NEW │
│  │   + domains/    [NEW]      │   │  + checkout gains a delivery-zone picker   │
│  │   + analytics/  [NEW]      │   └────────────────────┬───────────────────────┘
│  │   + marketing/  [NEW]      │                        │
│  ├─ marketplace/**  [NEW]     │                        │
│  │   PUBLIC, CROSS-TENANT,    │                        │
│  │   NO tenant identity.      │                        │
│  │   Read-only. Deep-links    │                        │
│  │   OUT to {slug}.einort.com │                        │
│  └─ login/signup/onboarding   │                        │
└──────────┬───────────────────┬┘                        │
           │                   │                         │
           ▼                   ▼                         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                     src/server/** (domain modules)                              │
│  EXISTING: auth cart catalog checkout claims dashboard db entitlements          │
│            idempotency images merchant orders payments search storefront        │
│            tenant theming                                                        │
│  NEW:      customers/  inventory/  delivery/  domains/  analytics/              │
│            marketing/          (merchant-side listing lifecycle, scopedDb)      │
│            marketplace/        (PUBLIC cross-tenant reads, marketplaceDb)       │
└──────────┬─────────────────────────────────────────────────────────────────────┘
           ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                     THE DATA-ACCESS WALL — src/server/db/**                     │
│                                                                                 │
│  scopedDb(tenantId)   auto-stamps/filters tenantId. Registry grows by 8 models. │
│  platformDb           allowlist facade. Grows by 2 getters: domain,             │
│                       marketplaceCategory.                                      │
│  adminDb              UNCHANGED. Do not widen. Platform Admin still deferred.   │
│  marketplaceDb  [NEW] Read-only cross-tenant facade. A Prisma Client Extension  │
│                       that injects an unconditional  status=PUBLISHED AND       │
│                       org.status=active  predicate and exposes NO write ops.    │
│                       ESLint-fenced to src/server/marketplace/** only.          │
└──────────┬─────────────────────────────────────────────────────────────────────┘
           ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL (Neon)  ·  Upstash Redis (+2 namespaces)  ·  R2  ·  Vercel SDK NEW  │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (new components only)

| Component | Responsibility | New / Modified | File |
|-----------|----------------|----------------|------|
| Marketplace read client | Cross-tenant, read-only, published-only Prisma facade. The one sanctioned door to other tenants' listings. | **NEW** | `src/server/db/marketplace.ts` |
| Marketplace public queries | Search, category browse, featured/trending, merchant discovery, listing detail. No tenant identity. | **NEW** | `src/server/marketplace/queries.ts` |
| Listing lifecycle state machine | Pure `(from, to) → boolean` legality table for listing status. Mirrors `ORDER_TRANSITIONS`. | **NEW** | `src/server/marketing/state-machine.ts` |
| Listing transition writer | The **only** module allowed to write `MarketplaceListing.status`; pairs every transition with a `ListingEvent`. | **NEW** | `src/server/marketing/transition.ts` |
| Listing merchant actions | Create/submit/pause/unlist a listing. `merchantAction({mode:"write"})`, entitlement-gated on the add-on. | **NEW** | `src/server/marketing/actions.ts` |
| Listing stat writer | Impression/click counters. Redis-buffered, flushed to `MarketplaceListingStat`. Own Redis namespace (C-11). | **NEW** | `src/server/marketing/stats.ts` |
| Customer upsert | Upserts a `Customer` row inside the existing `placeOrder` transaction; maintains rollups. | **NEW** | `src/server/customers/upsert.ts` |
| Customer queries | Profile list, detail, order history (reads `Order` by `customerId`). | **NEW** | `src/server/customers/queries.ts` |
| Stock writer (consolidated) | **The single sanctioned writer of `ProductVariant.stock`.** Absorbs today's two writers. Every change emits a `StockAdjustment`. | **NEW** (absorbs existing) | `src/server/inventory/write.ts` |
| Inventory queries | Stock levels, low-stock list (threshold compared at read time, never stored). | **NEW** | `src/server/inventory/queries.ts` |
| Delivery quote | Pure `(settings, zone, subtotalXaf) → feeXaf`. Zero I/O, unit-testable — mirrors `resolveEntitlements`. | **NEW** | `src/server/delivery/quote.ts` |
| Delivery settings/zones | Zone + settings CRUD via `merchantAction`. | **NEW** | `src/server/delivery/actions.ts` |
| Domain resolver | `hostname → tenant`, Redis-cached, fail-closed. Sibling of `resolve.ts`, same contract. | **NEW** | `src/server/tenant/resolve-domain.ts` |
| Domain Redis cache | Owns the `tenant:domain:*` namespace and nothing else (C-11). | **NEW** | `src/server/tenant/domain-cache.ts` |
| Vercel domains client | Thin wrapper over `@vercel/sdk` add/verify/get/remove. Fail-loud. | **NEW** | `src/server/domains/vercel.ts` |
| Domain actions | Merchant add/verify/remove a custom domain. `merchantAction`, entitlement-gated. | **NEW** | `src/server/domains/actions.ts` |
| Analytics queries | Sales/orders/top-products/conversion aggregates. **Reuses** `dashboard/buckets.ts` and `EARNED_STATES`. | **NEW** | `src/server/analytics/queries.ts` |

---

## Answer 1 — New Prisma Models and the Tenant/Platform Split

### Scope classification

| Model | Scope | Registry action | Why this scope |
|-------|-------|-----------------|----------------|
| `Customer` | **Tenant-scoped** | Add to `TENANT_SCOPED_MODELS` | A customer belongs to one merchant. Cross-merchant customer identity is explicitly out of scope (no shopper login exists). |
| `StockAdjustment` | **Tenant-scoped** | Add to registry (after `ProductVariant`) | Append-only ledger of a merchant's own stock. |
| `InventorySettings` | **Tenant-scoped** | Add to registry (no FK parent → end of list) | Singleton per tenant, exactly the `MerchantPaymentSettings` shape. |
| `DeliveryZone` | **Tenant-scoped** | Add to registry (no FK parent → end of list) | Zones are merchant-defined (Akwa / Bonapriso / Bonanjo …). |
| `DeliverySettings` | **Tenant-scoped** | Add to registry (end of list) | Singleton per tenant. |
| `MarketplaceListing` | **Tenant-scoped** | Add to registry (after `Product`) | **Yes — the prompt's hypothesis is correct.** The merchant owns and pays for the listing; every merchant-side write gets the structural `scopedDb` guarantee for free. |
| `ListingEvent` | **Tenant-scoped** | Add to registry (after `MarketplaceListing`) | Audit trail scoped to the listing. Mirrors `OrderEvent`. |
| `MarketplaceListingStat` | **Tenant-scoped** | Add to registry (after `MarketplaceListing`) | Per-listing analytics the merchant reads on their own dashboard. |
| `MarketplaceCategory` | **Platform-scoped** | Add `platformDb.marketplaceCategory` getter | **Yes — the prompt's hypothesis is correct.** A shared taxonomy is the entire point of a marketplace. Per-tenant `Category` rows cannot produce cross-tenant browse. Seeded/curated, small, no `tenantId`. |
| `Domain` | **Platform-scoped** | Add `platformDb.domain` getter | See the reasoning below — this is the one non-obvious call. |
| `CustomerAddress` | **DO NOT BUILD** | — | See below. |

### `MarketplaceListing` references `Product` by composite FK, never duplicates it

Use the codebase's existing composite-FK pattern (the one `Product.category` uses), not a bare `productId String`:

```prisma
model MarketplaceListing {
  id        String @id @default(cuid())
  tenantId  String
  productId String

  /// COMPOSITE FK, same reasoning as Product.category (T-03-01): a forged
  /// cross-tenant productId becomes a Postgres rejection, not a convention
  /// the application is trusted to remember. onDelete stated explicitly.
  product   Product @relation(fields: [tenantId, productId], references: [tenantId, id], onDelete: Restrict)

  status      ListingStatus @default(DRAFT)
  publishedAt DateTime?
  expiresAt   DateTime?

  marketplaceCategoryId String?   // FK to the PLATFORM-scoped taxonomy

  /// Merchant-authored marketplace copy. NOT a copy of Product.name/description
  /// — an override, NULL means "use the live product's value".
  headline   String?
  blurb      String?

  /// Sort keys ONLY. Deliberately denormalized, deliberately allowed to be
  /// slightly stale (see the anti-pattern note below).
  sortPriceXaf Int
  featured     Boolean @default(false)
  trendingScore Int    @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, id])
  @@unique([tenantId, productId])            // one listing per product
  @@index([status, marketplaceCategoryId])   // PUBLIC browse — deliberately NOT tenant-led
  @@index([status, featured, trendingScore]) // PUBLIC home
  @@index([tenantId, status])                // MERCHANT dashboard
  @@map("marketplace_listing")
}
```

**Two deliberate exceptions worth writing into the schema comments:**

- **The public browse indexes do not lead with `tenantId`.** The schema's stated rule is "every index leads with `tenantId`" (Pitfall 8), with `StoreSlugHistory.slug` as the one documented exception. This adds a second class of exception, for the same kind of reason: a cross-tenant query filtered by `tenantId` first would be useless. Document it exactly as `StoreSlugHistory.slug` is documented, or the next reader will "fix" it.
- **`sortPriceXaf` is a denormalized copy of the product/variant price.** This looks like a violation of the "never join live catalog data / never duplicate" discipline, but it is the opposite class of thing from an `OrderItem` snapshot: an order snapshot is *permanently* authoritative, whereas this is a *sort key that may lag*. Refresh it from the listing-update path and accept a short staleness window. The listing detail page must read the **live** price from `Product`/`ProductVariant`, never from `sortPriceXaf`. State this in the block comment or the two will drift and the marketplace will advertise a stale price — a consumer-protection problem, not a cosmetic one.

### `ListingStatus` — omit the states no transition can reach this milestone

```prisma
enum ListingStatus {
  DRAFT
  PUBLISHED
  PAUSED
  EXPIRED
}
```

`PENDING_REVIEW` and `REJECTED` are **deliberately absent**. Listing moderation is a Platform Admin surface, and Platform Admin is explicitly deferred from this milestone (PROJECT.md). Adding those two members now reproduces exactly the mistake the codebase already decided against for `OrderState.CANCELLED`: *"an enum member no transition can reach is a state the machine must still defend against forever."* Publish on submit, gated by the paid add-on entitlement; add moderation states in the milestone that builds the moderation queue.

### `Customer` — an index over orders, not the source of order identity

```prisma
model Customer {
  id       String @id @default(cuid())
  tenantId String

  /// Digits-only MSISDN. src/server/checkout/actions.ts ALREADY normalizes
  /// Order.customerPhone to this shape before placeOrder persists it — reuse
  /// that normalizer, do not write a second one.
  phoneNormalized String

  /// Most recent values seen. NOT authoritative for any past order — every
  /// Order keeps its own customerName/customerPhone snapshot, unchanged.
  displayName          String
  lastDeliveryAddress  String?

  /// Rollups, maintained inside the placeOrder / transitionOrder transactions.
  orderCount       Int      @default(0)
  lifetimeValueXaf Int      @default(0)
  firstOrderAt     DateTime @default(now())
  lastOrderAt      DateTime @default(now())

  @@unique([tenantId, id])
  @@unique([tenantId, phoneNormalized])
  @@index([tenantId, lastOrderAt])
  @@map("customer")
}
```

`Order` gains `customerId String?` (**MODIFIED**), set inside the existing `placeOrder` transaction. **`Order.customerName` / `.customerPhone` / `.deliveryAddress` stay and stay authoritative for that order** — this is the existing snapshot-on-write rule, and a `Customer` FK does not replace it. A merchant renaming a customer must never retroactively rewrite what a past order said.

### `CustomerAddress` — recommend NOT building it

There is no shopper account in this product. Checkout is anonymous; the only identity a returning customer has is a phone number typed into a form. A saved-address book with no authentication is either (a) unreachable, or (b) reachable by typing someone else's phone number, which leaks a stranger's home address to whoever guesses it. `Order.deliveryAddress` (snapshot) plus `Customer.lastDeliveryAddress` (merchant-visible convenience) covers everything "profiles + order history" actually needs. Revisit only if/when shopper accounts ship.

### `Domain` — platform-scoped, precedent: `Member` / `Invitation`

This is the least obvious call, so the reasoning matters.

The reverse lookup is `hostname → tenant`, performed **before tenant identity exists**. `scopedDb` cannot serve it (chicken-and-egg — the same reason `Organization` goes through `platformDb`). So either the model is platform-scoped, or you need a second escape hatch.

`platformDb`'s own header says its allowlist is for tables that carry no `tenantId`. `Member` and `Invitation` are already in that allowlist and are *per-organization* rows filtered by explicit `organizationId` — which is structurally identical to what a `Domain` row is. **`Domain` is a registry fact about an Organization, not tenant business data.** Follow the existing precedent:

```prisma
model Domain {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  /// GLOBALLY UNIQUE, same reasoning as Organization.slug and
  /// StoreSlugHistory.slug: a hostname must resolve to exactly one store,
  /// platform-wide, for all time. Lowercased, punycode-encoded, no port,
  /// no trailing dot — normalized once at write time by the same normalizer
  /// classifyHost uses, so the write key and the lookup key cannot disagree.
  hostname String @unique

  /// PENDING_DNS | PENDING_VERIFICATION | ACTIVE | ERROR.
  /// ONLY "ACTIVE" serves traffic — allowlist, not denylist, so a future
  /// status fails closed. Same rule as ResolvedTenant's ACTIVE_STATUS.
  status String @default("PENDING_DNS")

  /// Verbatim from the Vercel API so the merchant sees the exact record to add.
  verificationType  String?   // "TXT"
  verificationName  String?   // "_vercel"
  verificationValue String?
  lastCheckedAt     DateTime?
  lastError         String?

  isPrimary Boolean  @default(false)  // canonical host for SEO / redirects
  createdAt DateTime @default(now())
  verifiedAt DateTime?

  @@index([organizationId])
  @@map("domain")
}
```

Add `platformDb.domain` (**MODIFIED** `src/server/db/platform.ts`). Every merchant-side query in `src/server/domains/**` hardcodes `organizationId: ctx.tenantId` from `requireMerchantContext()`. Because that filter is convention rather than structure, back it with `tests/isolation/domains.test.ts` proving tenant A cannot read, verify, or delete tenant B's domain — the same evidence-not-assertion posture as `tests/isolation/tenant-isolation.test.ts`.

**Alternative considered and rejected:** give `Domain` a `tenantId`, register it in `TENANT_SCOPED_MODELS`, and add a fourth tiny reverse-lookup client. That gets structural safety on the merchant path but forces a new DB-client zone for a single `findUnique`, and puts a `tenantId`-bearing model inside `platformDb`'s reach — breaking `platformDb`'s stated invariant. Not worth it when `Member`/`Invitation` already establish the platform-scoped-per-org pattern.

### Schema changes to existing models (all **MODIFIED**)

| Model | Change | Driven by |
|-------|--------|-----------|
| `Order` | `+ deliveryFeeXaf Int @default(0)` | Delivery |
| `Order` | `+ deliveryZoneId String?` and `+ deliveryZoneName String?` — **snapshots**, never joined live | Delivery |
| `Order` | `+ customerId String?` | Customers |
| `Order` | `+ @@index([tenantId, placedAt])` — the existing `@@index([tenantId, state, placedAt])` cannot serve a pure date-range scan because `state` sits between the two useful columns | Analytics |
| `Order` | `+ @@index([tenantId, customerId])` | Customers |
| `OrderItem` | `+ @@index([tenantId, productId])` — "top products" is a `groupBy productId`, and the only index today is `[tenantId, orderId]` | Analytics |
| `ProductVariant` | `+ lowStockThreshold Int?` (NULL inherits the tenant default) | Inventory |
| `Organization` | `+ marketplaceAddonUntil DateTime?`, declared `input: false` in the Better Auth `additionalFields` config exactly like `trialEndsAt`/`planTier` | Marketplace Marketing |
| `Organization` | `+ primaryDomainHost String?` — denormalized canonical host, so `resolveTenantBySlug`'s cached record can emit a canonical-URL redirect without a second lookup. Optional; skip if canonicalization is deferred. | Domains |

---

## Answer 2 — Safe Build Order

### Dependency graph

```
 EXISTING (all present): catalog · orders · entitlements · claims · dashboard/buckets · theming

 (1) INVENTORY ──────────► consolidates the ProductVariant.stock writer
      │                    touches: orders/stock.ts, catalog/actions.ts
      ▼
 (2) DELIVERY ───────────► adds money columns to Order + fee math in placeOrder
      │                    touches: orders/place.ts, checkout/*, s/[slug]/checkout
      ▼
 (3) CUSTOMERS ──────────► adds Order.customerId + upsert in the SAME transaction
      │                    touches: orders/place.ts (again)
      ▼
 (4) ANALYTICS ──────────► pure reads over the now-final Order shape
      │                    touches: nothing (extends dashboard/buckets.ts)
      │
 (5) MARKETING ──────────► MarketplaceListing + lifecycle + entitlement + merchant UI
      │                    depends on: catalog ✓ entitlements ✓  (both already exist)
      ▼
 (6) MARKETPLACE ────────► public /marketplace tree + marketplaceDb + taxonomy seed
      │                    depends on: (5) for anything to render
      ▼
 (7) LISTING ANALYTICS ──► MarketplaceListingStat; depends on (4) buckets + (6) surface
                           (fold into 6 if it fits)

 (8) DOMAINS ────────────► independent of 1–7. Touches only host.ts / proxy.ts / tenant/*
                           Deliberately last (see rationale).
```

### Recommended order, with rationale

| # | Area | Why here | Riskiest thing it touches |
|---|------|----------|---------------------------|
| 1 | **Inventory** | Smallest, no `Order` schema change, and it *reduces* risk for everything after it by consolidating stock writes into one module before two other areas edit `placeOrder`. | `src/server/orders/stock.ts`, `src/server/catalog/actions.ts` |
| 2 | **Delivery** | Must precede Analytics (it changes what "revenue" means: gross vs. product revenue) and must precede Customers (both edit `placeOrder`; do the money-math edit while that module is freshly in context, not as a second pass). | `src/server/orders/place.ts` — the most safety-critical module in the repo |
| 3 | **Customers** | Depends on the `Order` shape being final. The upsert must land inside the *existing* `placeOrder` transaction, so it should be the last edit to that transaction. | `src/server/orders/place.ts` (second edit) |
| 4 | **Analytics** | Pure read layer. Cheapest possible once 2 and 3 have settled the schema; expensive to redo if built against a pre-delivery `Order`. | Nothing — additive only |
| 5 | **Marketplace Marketing** | Its stated dependencies (product catalog, entitlements) already exist, so it can start any time after 1 — but it must precede 6, or the public tree has no real data to render or test against. | `src/server/entitlements/resolve.ts`, `plans.ts` |
| 6 | **Marketplace (public)** | Needs listings to exist. Introduces `marketplaceDb` + the new ESLint zone — do this while the listing model is settled, not before. | `src/server/db/**`, `eslint.config.mjs` |
| 7 | **Domains** | Genuinely independent — nothing in 1–6 depends on it and it depends on nothing. Last because: (a) it is the only area needing external account setup (Vercel token, a real test domain) and DNS-propagation wall-clock slack; (b) it is the only area that touches the request path for **100% of traffic**, so isolating that change at the end of the milestone keeps a regression there from contaminating six other in-flight areas; (c) PROJECT.md already characterizes custom domains as cuttable ("fast-follow if time allows"), so it is the correct thing to have at the tail of a fixed-deadline milestone. | `src/proxy.ts`, `src/server/tenant/host.ts` |

**Do NOT do:** Analytics before Delivery. Every revenue number would be built against a `totalXaf` with no delivery component, and the fix is not "add a column" — it's re-deciding whether the sales chart shows GMV or product revenue, after the chart already shipped.

**Parallelizable if more than one worker existed:** {5, 6} and {7} are independent of {1, 2, 3, 4}. For a solo builder this is sequencing advice, not scheduling advice.

---

## Answer 3 — New Route Trees and the Authorization Boundary

### New routes

| Route tree | Surface | Auth boundary | Notes |
|------------|---------|---------------|-------|
| `src/app/marketplace/**` **NEW** | **Public, apex, cross-tenant, zero tenant identity** | None — deliberately | `/marketplace`, `/marketplace/search`, `/marketplace/c/[categorySlug]`, `/marketplace/m/[storeSlug]`, `/marketplace/p/[listingId]` |
| `src/app/(dashboard)/dashboard/customers/` (+ `[id]/`) **NEW** | Merchant | `requireMerchantContext()` in each page | Standard pattern |
| `src/app/(dashboard)/dashboard/inventory/` **NEW** | Merchant | same | Standard pattern |
| `src/app/(dashboard)/dashboard/delivery/` **NEW** | Merchant | same | Standard pattern |
| `src/app/(dashboard)/dashboard/domains/` **NEW** | Merchant | same | Standard pattern |
| `src/app/(dashboard)/dashboard/analytics/` **NEW** | Merchant | same | Standard pattern |
| `src/app/(dashboard)/dashboard/marketing/` (+ `[listingId]/`) **NEW** | Merchant | same | Standard pattern |
| `src/app/s/[slug]/checkout/**` **MODIFIED** | Storefront | Inherited from `s/[slug]/layout.tsx` | Delivery-zone selector |

### Does anything cross the storefront/dashboard authorization boundary?

**No — but only because of one structural property that must be preserved deliberately.**

The six dashboard trees are ordinary. They live inside `(dashboard)`, which is unreachable from a storefront subdomain *structurally*: the proxy rewrites subdomain traffic under `/s/{slug}`, where no `/dashboard` route exists. No new check is needed.

`/marketplace` is the interesting one, and it is safe **for the same structural reason, in reverse**:

- On the apex, `classifyHost` returns `root`, the proxy passes through, and `/marketplace` renders. Zero proxy change required.
- On a storefront subdomain, `{slug}.einort.com/marketplace` rewrites to `/s/{slug}/marketplace`, where no route exists → 404. Also zero proxy change required.

Three things must be done deliberately to keep that true:

1. **Reserve the hostname.** `marketplace` is **not** in `RESERVED_SLUGS` today (verified — the list contains `store`, `shop`, `cart`, `checkout`, `orders`, but not `marketplace`, `discover`, `explore`, or `market`). A merchant can claim `marketplace.einort.com` right now. Add `marketplace`, `discover`, `explore`, `market`, `listings` to `src/server/tenant/reserved-slugs.ts` (**MODIFIED**) *before* the marketplace ships. Note the existing invariant: `classifyHost` checks reserved names *before* format rules, and the write-path hook in `beforeCreateOrganization` reads the same set — so one edit closes all three layers.
2. **Never put a cart or a checkout on `/marketplace`.** The cart cookie is deliberately `httpOnly` with **no `Domain` attribute**, which is what structurally prevents cross-tenant cart leakage. An apex-hosted cart would be apex-scoped and therefore shared across every marketplace visit — reintroducing exactly the leak that design prevents, and doing it in a way that reads as a feature. `/marketplace/p/[listingId]` must be a read-only detail page whose primary CTA is an outbound link to `https://{slug}.einort.com/p/{productSlug}`. Vercel's own multi-tenant guidance reinforces this (Public Suffix List section): sensitive cookies should omit `Domain`, prefix with `__Host-`, and validate `Origin` — the current design already complies, and an apex cart would break it.
3. **Do not apply the storefront palette.** `data-surface="storefront"` is applied by `s/[slug]/layout.tsx` only. `/marketplace` is an apex surface and gets the apex palette. `tests/unit/surface-token-isolation.test.ts` will fail the build if a marketplace component reaches for a literal `bg-zinc-*` utility. **Design decision to lock now: the marketplace has one neutral chrome; merchant brand takes over only after the deep link.** Rendering per-tenant theme tokens inside a shared page means loading N tenants' themes on one page and is not worth it.

### Files outside `src/app/**` that must change with the routes

| File | Change | Why |
|------|--------|-----|
| `src/components/app-sidebar.tsx` **MODIFIED** | +6 nav entries | The nav is a data array (`href`/label groups) |
| `src/lib/strings.ts` **MODIFIED** | +1 namespace per new surface | Every user-facing string must live here — `tests/unit/dashboard-nav.test.ts` and the prose-literal scanners fail the build on an inline literal |
| `tests/unit/dashboard-nav.test.ts` **MODIFIED** | Assert the new nav shape | Existing contract test |
| `eslint.config.mjs` **MODIFIED** | New import zone for `src/server/db/marketplace` | Access level visible at the import — the codebase's central thesis |
| `src/env.ts` **MODIFIED** | `+ VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (all optional so Domains degrades loudly rather than blocking boot) | Never read `process.env` outside this file |
| `prisma/seed.ts` **MODIFIED** | Seed `MarketplaceCategory` | Platform taxonomy has no merchant to create it |
| `tests/setup/seed-two-tenants.ts` **MODIFIED** | Insert new models in FK dependency order | The seed's single batched `$transaction` is driven off `TENANT_SCOPED_MODELS` insertion order — **re-sorting that array breaks the seed** |

---

## Answer 4 — Domains vs. the Zero-I/O Hostname Classifier

### The constraint, restated

`src/proxy.ts` runs on nearly every request including prefetches and must not import Prisma, Redis, or `@/env`. `classifyHost` is a pure function of `(rawHost, rootDomain)`. Custom-domain resolution is inherently a database lookup. These are not reconcilable *inside the proxy* — and they don't need to be, because the codebase already documents the correct split in `resolve.ts`:

> `proxy.ts` — is this hostname *shaped* like a store? (pure, zero I/O)
> `resolve.ts` — does that store *exist and serve*? (cached DB read)

**Custom domains extend that split rather than violating it.** The proxy answers a purely syntactic question; the layout does the I/O.

### Step 1 — `classifyHost` gains a fourth kind (still pure) — **MODIFIED**

Today, any host not under the root domain returns `{ kind: "unknown", reason: "foreign-domain" }` and renders the branded 404. Split that branch:

```ts
export type HostResult =
  | { kind: "root" }
  | { kind: "reserved"; label: string }
  | { kind: "store"; slug: string }
  | { kind: "custom"; hostname: string }   // NEW
  | { kind: "unknown"; reason: string };
```

The `custom` branch replaces today's `foreign-domain` return and applies only *syntactic* tests — no I/O, no allowlist, no env:

- must contain at least one dot (bare labels are not public hostnames)
- must not be an IPv4/IPv6 literal, `localhost`, or `*.localhost`
- must not be `*.vercel.app` (already handled above as `root`)
- must not be, or be under, the root domain (already handled above)
- total length ≤ 253; every label 1–63 chars, LDH only, no leading/trailing hyphen
- final label alphabetic, length ≥ 2 (rejects `foo.123`)
- returns the **already-normalized** hostname (lowercased, port stripped, trailing dot stripped) — the same normalization the top of the function already does. Anything failing these → `unknown`, unchanged.

Everything above is a string predicate. `host.ts` still imports nothing but `RESERVED_SLUGS`. Its unit test file gains cases; nothing else about it moves.

**Free safety property:** `HostResult` is a discriminated union consumed by an exhaustive `switch` in `proxy.ts`. Adding a member makes the proxy a compile error until it is handled — the same "adding an enum member is a compile error until the table is updated" discipline as `ORDER_TRANSITIONS`, `TENANT_SCOPED_MODELS`, and `PLANS`.

### Step 2 — the proxy rewrites to a sentinel segment — **MODIFIED**

```ts
case "custom": {
  const url = request.nextUrl.clone();
  // "@" can never appear in a slug (SLUG_PATTERN is [a-z0-9-] only), so this
  // sentinel is unforgeable as a store address and unreachable via classifyHost's
  // "store" branch. Same trust model as /s/{slug}: the client cannot forge a path
  // the proxy derives from the Host header, and the unconditional /s/* 404 above
  // already blocks direct addressing of either form.
  url.pathname = `/s/@${encodeURIComponent(result.hostname)}${pathname}`;
  return NextResponse.rewrite(url, forward);
}
```

**Why a path sentinel and not a header.** The proxy *could* strip-then-set `x-store-host`. But the file's own comment states the reason it doesn't: *"nothing downstream enforces that a header it reads came from here."* `config.matcher` excludes a handful of paths where the strip therefore does not run; a path the proxy generates has no equivalent gap. Reusing the existing, already-hardened `/s/*`-is-never-externally-addressable 404 costs nothing and keeps one trust story instead of two.

**Why reuse `/s/[slug]` rather than add `/d/[host]`.** A sibling tree would duplicate the entire storefront route tree (layout, home, product detail, cart, checkout, order tracking, sections) or force a shared-catch-all refactor. The sentinel keeps **one route tree and one authorization boundary**, which is the property worth protecting. The cost is that the dynamic segment is no longer always a slug — pay for that by renaming the resolver, not the segment (below).

### Step 3 — the layout resolves both shapes — **MODIFIED**

`src/app/s/[slug]/layout.tsx` swaps `resolveTenantBySlug(slug)` for one new dispatcher:

```ts
// src/server/tenant/resolve-host-segment.ts  [NEW]
export const resolveTenantByHostSegment = cache(
  async (segment: string): Promise<ResolvedTenant | null> =>
    segment.startsWith("@")
      ? resolveTenantByDomain(decodeURIComponent(segment.slice(1)))
      : resolveTenantBySlug(segment),
);
```

`resolveTenantBySlug` is **unchanged**. `resolveTenantByDomain` (**NEW**, `src/server/tenant/resolve-domain.ts`) is a structural copy of it with three differences:

1. Reads its own Redis namespace, `tenant:domain:*`, owned by its own module (`src/server/tenant/domain-cache.ts`, **NEW**) — constraint C-11 says one module per key namespace, and `cache.ts`'s header says it owns `tenant:host:` "and nothing else."
2. Reads `platformDb.domain.findUnique({ where: { hostname } , include: { organization: … } })`.
3. **Two allowlist checks, both required:** `domain.status === "ACTIVE"` **and** `organization.status === "active"`. Suspending a merchant must take their custom domain down at the same instant it takes their subdomain down. A domain-status-only check leaves a suspended store live on its own domain — a real, silent bypass of D-05.

Everything else is preserved verbatim: negative caching (a stranger can spoof a `Host` header on any request Vercel routes to this project, so the wildcard-scan mitigation still applies), 300s/60s TTLs, fail-open-to-database on cache error, fail-closed to `null` on anything not certainly live, `React.cache()` per-render memoization, and `null` → branded not-found indistinguishable from "never existed."

`invalidateTenantHost` (**MODIFIED**) gains a domain-keyed sibling, and **every** existing caller that invalidates on suspend/rename must also invalidate that tenant's domains. This is the single easiest thing to get wrong: suspension currently evicts one key; after Domains it must evict 1 + N.

### Step 4 — provisioning against Vercel (**NEW**, `src/server/domains/vercel.ts`)

Verified against Vercel's official multi-tenant domain docs (page last updated 2026-08-25) — **HIGH confidence**:

| Operation | `@vercel/sdk` function |
|-----------|------------------------|
| Add a tenant domain to the project (auto-attempts SSL issuance) | `projectsAddProjectDomain` |
| Read config/verification state | `projectsGetProjectDomain` |
| Trigger verification | `projectsVerifyProjectDomain` |
| Detach from project | `projectsRemoveProjectDomain` |
| Delete from account | `domainsDeleteDomain` |

Flow: merchant submits hostname → normalize + uniqueness check → `Domain` row at `PENDING_DNS` → `projectsAddProjectDomain` → persist the returned verification challenge → merchant adds the TXT/CNAME at their registrar → merchant clicks "Check now" (a `merchantAction`, rate-limited) → `projectsVerifyProjectDomain` → on `verified` set `ACTIVE`, stamp `verifiedAt`, invalidate the domain cache.

Notes that matter for this project specifically:
- **DNS propagation is 24–48h.** Build the UI as a state machine the merchant can leave and come back to, not a spinner. Add a Vercel Cron re-check later if desired; a manual "Check now" button is sufficient for the pilot and avoids standing up a new authenticated route surface.
- **`*.einort.com` wildcard SSL requires Vercel nameservers** (`ns1/ns2.vercel-dns.com`) on the apex. If the platform's own apex is not already on Vercel DNS, the existing subdomain storefronts have an infrastructure prerequisite that Domains work will surface.
- **Public Suffix List:** Vercel recommends submitting `einort.com` to the PSL private section so browsers treat each `{slug}.einort.com` as its own site. The current cookie design (no `Domain` attribute, `httpOnly`) already implements the recommended interim mitigations. Worth noting in planning; PSL review time is unbounded and cannot be a milestone dependency.
- Gate custom domains behind an entitlement (`PlanLimits.customDomains: number | null`, registered in `PLANS` per the existing "registered now, enforced later" convention) and behind `canWrite`. An expired trial should not be able to attach a new domain, but must not take an existing one down.

---

## Architectural Patterns to Reuse

### Pattern 1: State-machine-as-data, for the listing lifecycle

**What:** `LISTING_TRANSITIONS: Readonly<Record<ListingStatus, readonly ListingStatus[]>>` + `canTransitionListing()` + exactly one writer (`src/server/marketing/transition.ts`) that pairs every status change with a `ListingEvent` row + a source-scanning test (`tests/unit/single-listing-status-writer.test.ts`) modeled byte-for-byte on `tests/unit/single-order-state-writer.test.ts`.
**When:** Any time a new model gains a lifecycle column. Marketplace Marketing is the only new area that does.
**Trade-offs:** Slightly more ceremony than a `status` string. Buys: an inspectable legality table, an audit row that cannot be forgotten, and a build failure the day someone adds a status member without wiring it.

### Pattern 2: Single sanctioned writer, applied to stock

**What:** Today `ProductVariant.stock` is written from **two** places — `src/server/orders/stock.ts` (conditional-decrement hold/release) and `src/server/catalog/actions.ts` (the variant matrix on product create/update). Inventory adds a third reason to write it (manual adjustment, restock, damage). Three uncoordinated writers with a new `StockAdjustment` ledger means the ledger will silently miss entries.
**When to use:** Now, as step 1 of the Inventory build.
**How:** Introduce `src/server/inventory/write.ts` as the only module allowed to write `stock`; route both existing callers through it; every call emits a `StockAdjustment`; enforce with `tests/unit/single-stock-writer.test.ts`.
**Trade-offs:** Touching `orders/stock.ts` means touching the checkout race-safety path. Do it first, in isolation, with the isolation suite green — not concurrently with Delivery's `placeOrder` edit.

```ts
// src/server/inventory/write.ts  [NEW] — the ONLY module that may write ProductVariant.stock
export async function adjustStock(
  tx: ScopedTx,
  input: { variantId: string; delta: number; reason: StockReason; actorUserId?: string; note?: string },
): Promise<{ resultingStock: number }> {
  // conditional decrement (unchanged semantics from orders/stock.ts)
  // + one StockAdjustment row, in the same transaction, always
}
```

### Pattern 3: Pure resolver, applied to delivery pricing

**What:** `resolveEntitlements(org, now)` is pure — no I/O, no clock read, fully unit-testable. Do the same for delivery: `quoteDelivery(settings, zone, subtotalXaf) → { feeXaf, zoneName }`.
**Why it matters here:** the fee is money, and money must be server-computed. Keeping the arithmetic in a pure function means the checkout action's only job is to *fetch the zone by id and call it* — there is no place for a client-supplied `deliveryFeeXaf` to slip in, because the function's signature does not accept one.
**Trade-offs:** None material.

```ts
// PlaceOrderInput may carry an ID. It may NEVER carry money.
type PlaceOrderInput = {
  lines: { variantId: string; quantity: number }[];
  deliveryZoneId?: string;   // an id — OK, same class as variantId
  // deliveryFeeXaf          // ← never. This is the documented anti-pattern.
};
```

### Pattern 4: Inverted-axis client extension, for `marketplaceDb`

**What:** `scopedDb` is a Prisma Client Extension over `$allModels.$allOperations` that (a) throws for unregistered models and (b) rewrites `args` to inject `tenantId`. `marketplaceDb` uses the identical construction with the axis inverted: it throws for any model not in `MARKETPLACE_READABLE_MODELS`, throws for **any non-read operation**, and injects a non-overridable published-and-live predicate.
**When:** Only for `src/server/marketplace/**`. ESLint-fence it there.
**Trade-offs:** A fourth DB client is real cost. It buys the property the whole `src/server/db/**` design exists for — *the trust level of a query is visible at the import statement* — for the one access pattern that would otherwise have to reach for raw, unscoped Prisma.

```ts
// src/server/db/marketplace.ts  [NEW]
const MARKETPLACE_READABLE_MODELS: readonly Prisma.ModelName[] = [
  "MarketplaceListing", "Product", "ProductVariant", "ProductImage", "MarketplaceCategory",
];
const READ_OPERATIONS = new Set(["findMany", "findFirst", "findUnique", "count", "aggregate", "groupBy"]);

export const marketplaceDb = prismaBase.$extends({
  name: "marketplace-public",
  query: { $allModels: { async $allOperations({ model, operation, args, query }) {
    if (!model || !MARKETPLACE_READABLE_MODELS.has(model)) throw new Error(/* … */);
    if (!READ_OPERATIONS.has(operation)) throw new Error("marketplaceDb is read-only.");
    // inject published-and-live predicate as a SIBLING of the caller's where
    // (a sibling of OR is an implicit AND in Prisma — the same guarantee
    //  src/server/search/queries.ts already documents and isolation-tests)
    return query(withPublishedPredicate(model, args));
  }}},
});
```

---

## Data Flow

### Order placement, after Delivery + Customers (**MODIFIED** `src/server/orders/place.ts`)

```
placeOrder(tenantId, { lines, deliveryZoneId?, customer… })
  │  input carries IDs and quantities only — no money fields, unchanged rule
  ▼
scopedDb(tenantId).$transaction:
  1. re-read variants from Postgres              (unchanged — server is sole price source)
  2. adjustStock() per line via inventory/write  (MODIFIED: was holdStockForLines)
       └─► writes StockAdjustment(reason=ORDER_HOLD) in the same tx      [NEW]
  3. snapshot line items                          (unchanged)
  4. read DeliveryZone by id + DeliverySettings; quoteDelivery(...)       [NEW]
       └─► deliveryFeeXaf + deliveryZoneName SNAPSHOTTED onto Order       [NEW]
  5. totalXaf = subtotalXaf + deliveryFeeXaf                              [NEW]
  6. upsert Customer by (tenantId, phoneNormalized); bump rollups         [NEW]
       └─► Order.customerId set; Order.customerName/Phone UNCHANGED
  7. openOrderAtGenesis(...) via transition.ts    (unchanged)
  8. MANUAL_TRANSFER → transitionOrder(PAYMENT_PENDING)  (unchanged)
```

**Pitfall this introduces:** `placeOrder` today retries **exactly once**, and only on a `P2002` on the order number. Step 6 adds a second unique constraint (`[tenantId, phoneNormalized]`) that can `P2002` under two concurrent first-orders from the same phone. If the retry is left unchanged, the second concurrent order fails with an unhandled unique violation. Fix by narrowing the customer write to `updateMany` (bump rollups) followed by `create`-only-on-zero-rows, catching `P2002` locally and re-reading — **not** by widening the outer retry, which would re-run the whole stock hold.

### Marketplace public browse (the new access pattern)

```
GET https://einort.com/marketplace/c/fashion
  │  classifyHost → { kind: "root" }  → proxy passthrough (NO CHANGE)
  ▼
src/app/marketplace/c/[categorySlug]/page.tsx     [NEW]
  │  no session read, no Host-derived tenant — there is no tenant here
  ▼
src/server/marketplace/queries.ts                  [NEW]
  │  marketplaceDb.marketplaceListing.findMany({ where: { marketplaceCategoryId } })
  │    └─ extension injects: status=PUBLISHED AND publishedAt<=now
  │                          AND organization.status="active"
  ▼  card renders: listing.headline ?? product.name, LIVE price, hero image
  │  CTA href = https://{org.slug}.einort.com/p/{product.slug}
  ▼
[click] → leaves the apex entirely → storefront layout does its normal
          tenant gate → cart cookie is created host-scoped, as today
```

### Analytics read (no new source of truth)

```
/dashboard/analytics
  │ requireMerchantContext()  → ctx.tenantId
  ▼
src/server/analytics/queries.ts                    [NEW]
  │ scopedDb(tenantId).order.groupBy / .aggregate
  │   └─ the tenant extension DOES cover groupBy/aggregate (verified: they fall
  │      into the `default:` branch of $allOperations and its comment names them
  │      explicitly, including the no-`where` case)
  │ reuses EARNED_STATES / OPEN_STATES from dashboard/queries.ts   [MODIFIED: export them]
  │ reuses bucketByDay + DOUALA_UTC_OFFSET_MINUTES from dashboard/buckets.ts
  ▼ time bucketing happens in TypeScript, never SQL — $queryRaw/$executeRaw are
    banned repository-wide by no-restricted-syntax, so date_trunc / generate_series
    / window functions are off the table. This is the single largest Analytics
    constraint and there is already in-repo precedent for working within it.
```

---

## Scaling Considerations

| Scale | Adjustment |
|-------|------------|
| Pilot (Douala, tens of stores) | Everything above as written. `groupBy` over `@@index([tenantId, placedAt])` is fine. Listing impressions can be written synchronously. |
| 1k stores / high per-store order volume | Add `OrderDailyRollup` (tenant-scoped, `@@unique([tenantId, day])`) written from `placeOrder`/`transition.ts`; Analytics reads rollups and only falls back to `groupBy` for the current partial day. Move listing impressions to Redis counters flushed on a Vercel Cron. |
| 100k+ stores | Marketplace search leaves Postgres `contains` (see below). Marketplace listing feed becomes a materialized/denormalized table refreshed on a schedule rather than a live cross-tenant query. |

### Scaling priorities

1. **First bottleneck: marketplace search.** The existing merchant search (`src/server/search/queries.ts`) documents an accepted sequential scan — correct at *one tenant's* row count. The marketplace searches **all tenants at once**, and `%q%` cannot use a B-tree index. A cross-tenant `contains` over every published listing is the first thing that falls over. Mitigations in ascending cost: (a) restrict marketplace search to `MarketplaceListing.headline` + a denormalized `searchText` column rather than joining to `Product`; (b) add a `pg_trgm` GIN index (this needs a raw-SQL migration file, which is fine — the `$queryRaw` ban is on *application* code, not on `prisma/migrations/**/migration.sql`); (c) dedicated search infra, which both source documents already list as out of scope.
2. **Second bottleneck: Analytics `groupBy` over `Order`.** Fixed by the rollup table above. Cheap to add later precisely because Analytics is a pure read layer with no source of truth of its own — which is a good reason not to build the rollup now.
3. **Third: listing impression writes.** One row-write per marketplace page view is the only new high-frequency write in the milestone. Buffer in Redis (own namespace, own module, per C-11), fail-open with a loud warn, exactly like the rate limiters.

---

## Anti-Patterns (specific to this milestone)

### Anti-Pattern 1: Widening `adminDb`'s ESLint fence to serve the marketplace

**What people do:** `adminDb` is already "the unscoped cross-tenant client," so add `src/server/marketplace/**` to its allowed-import zone.
**Why it's wrong:** `adminDb` is raw, unfiltered Prisma. A marketplace query with one missing `where` clause would read draft listings, paused listings, and suspended merchants' catalogs onto a public page. Worse, the admin zone is *also* forbidden from importing `tenant-scoped`, so marketplace code placed there loses access to every other domain module. And Platform Admin is deferred this milestone — widening its fence for an unrelated feature makes the fence mean nothing by the time it's actually needed.
**Do this instead:** `marketplaceDb`, a read-only extension whose published-and-live predicate cannot be overridden by a caller. Different guarantee, different name, different import zone.

### Anti-Pattern 2: A cart or checkout on `/marketplace`

**What people do:** "Add to cart" directly from a marketplace listing card, so the shopper never leaves the marketplace.
**Why it's wrong:** the cart cookie is deliberately host-scoped with no `Domain` attribute — that is what structurally prevents one tenant's cart from being visible to another. A cart created on the apex is apex-scoped by definition, and a *multi-merchant* apex cart would then have to fan out into N orders across N tenants with N different payment instructions, N different delivery zones, and N different manual-transfer numbers. This is a different product.
**Do this instead:** marketplace listing detail is a read-only page. The CTA deep-links to the merchant's own storefront. Buying happens exactly where it happens today.

### Anti-Pattern 3: A `Customer` row that overwrites what an order said

**What people do:** drop `Order.customerName`/`customerPhone` and join to `Customer` at read time — "the data is normalized now."
**Why it's wrong:** this is the exact inverse of the rule the `OrderItem` snapshot columns exist to enforce. A customer correcting a typo in their name would retroactively rewrite the name on a six-month-old order that is under payment dispute.
**Do this instead:** `Customer` is an *index over* orders, never the source of an order's identity fields. `Order.customerId` is additive.

### Anti-Pattern 4: `deliveryFeeXaf` on the checkout input schema

**What people do:** the client already computed and displayed the fee, so send it along and "validate it against the zone."
**Why it's wrong:** this is verbatim the anti-pattern already documented in `ARCHITECTURE.md` ("Validating a client-submitted price against the database"). The comparison degrades the moment a free-delivery threshold or a promotional rate is added — and by then it reads as legitimate in review.
**Do this instead:** accept `deliveryZoneId` only. Re-read the zone and recompute the fee inside the write transaction, via the pure `quoteDelivery`.

### Anti-Pattern 5: A `Domain` lookup inside `src/proxy.ts`

**What people do:** "the proxy already has the hostname; just look it up there so the rewrite goes straight to the right slug."
**Why it's wrong:** the proxy runs on every matched request including prefetches, and Next 16's own guidance says it should not rely on shared modules or globals. Importing Prisma or Redis there pulls a connection pool into the interception path, and importing `@/env` pulls Zod. Both are documented hard constraints, enforced by convention and review rather than tooling — so nothing will stop the change except this note.
**Do this instead:** the proxy answers only "is this hostname *shaped* like a custom domain." Resolution happens in `s/[slug]/layout.tsx`, cached, exactly where slug resolution already happens.

### Anti-Pattern 6: Adding `PENDING_REVIEW` to `ListingStatus` "for later"

**What people do:** the design reference shows a moderation queue, so put the states in the enum now.
**Why it's wrong:** Platform Admin is deferred, so nothing can move a listing out of `PENDING_REVIEW`. The codebase has already made this exact call once, against `OrderState.CANCELLED`, and pinned it with a test: an unreachable enum member is a state every transition table, every switch, and every UI branch must defend against forever, for zero delivered value.
**Do this instead:** ship `DRAFT | PUBLISHED | PAUSED | EXPIRED`. Add moderation states in the milestone that builds the moderation queue — the `LISTING_TRANSITIONS` table makes that a typed, compile-checked change.

---

## Integration Points

### External services

| Service | Integration pattern | Notes |
|---------|---------------------|-------|
| **Vercel Domains API** (`@vercel/sdk`) **NEW** | Server-side only, from `src/server/domains/vercel.ts`. Bearer token from `env.VERCEL_TOKEN`. | Adding a domain auto-attempts SSL issuance. Verification is a TXT record when the domain is already in use on Vercel. Propagation is 24–48h — model it as state, not a spinner. Wildcard `*.einort.com` SSL requires Vercel nameservers on the apex. Consider PSL submission for `einort.com`. |
| **Upstash Redis** (existing) | Two new namespaces, each with its own owning module per C-11: `tenant:domain:*` (domain resolution cache) and `marketplace:stat:*` (impression buffer). | Both must degrade loudly, never silently — match `tenant/cache.ts`'s three-state memoized `{ redis: Redis \| null }` discipline. |
| **Cloudflare R2** (existing) | No change. Marketplace reuses the `product` image preset; no new preset needed. | If marketplace cards want a different aspect ratio, add a `marketplace` entry to `IMAGE_PRESETS` — the registry is designed for exactly that. |
| **Resend** (declared, unwired) | Optional: low-stock alert email, domain-verified email. | Still not wired to any send call today. Treat as new integration work, not existing capability. |

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `src/app/marketplace/**` ↔ `src/server/marketplace/**` | Direct import, Server Components | The only pair in the codebase with **no** tenant identity on either side. Document that loudly at the top of both. |
| `src/server/marketplace/**` ↔ `src/server/db/marketplace.ts` | Direct import; **exclusive** ESLint zone | New rule in `eslint.config.mjs`. Also forbid `marketplace/**` from importing `db/base` and `db/admin`. |
| `src/server/marketing/**` ↔ `scopedDb` | Direct, standard | Merchant-side listing CRUD. Kept in a **separate folder** from `marketplace/` precisely so the two access levels never share a file. |
| `src/server/marketplace/**` → `src/server/marketing/stats.ts` | Direct call, passes a `tenantId` derived from an already-read row | This is the **second** instance of the documented `placeOrder(tenantId, …)` exception: an anonymous surface passing a tenant id that the *server* derived from a row it just read, never from the client. Document it with the same rationale, or `tests/unit/no-tenant-id-param.test.ts`'s spirit erodes. |
| `src/server/orders/place.ts` → `inventory/write.ts`, `delivery/quote.ts`, `customers/upsert.ts` | Direct calls **inside the existing transaction**, taking `ScopedTx` | All three must accept the caller's `tx`, never open their own `scopedDb`. A second client inside a transaction escapes the transaction. |
| `src/server/analytics/**` → `src/server/dashboard/{queries,buckets}.ts` | Direct import of `EARNED_STATES`, `OPEN_STATES`, `bucketByDay` | **MODIFIED:** export `EARNED_STATES`/`OPEN_STATES` (currently module-private). Redefining "revenue" in a second place is how the Overview card and the Analytics page end up disagreeing in front of a merchant. |
| `src/server/tenant/resolve-host-segment.ts` → `resolve.ts` \| `resolve-domain.ts` | Dispatcher on the `@` sentinel | The only new fork in the tenant-resolution path. Both branches must return the identical `ResolvedTenant` shape and the identical fail-closed `null`. |

---

## Confidence and Gaps

| Claim | Confidence | Basis |
|-------|------------|-------|
| Existing registry/index/writer facts (models, indexes, `EARNED_STATES`, two stock writers, `marketplace` absent from `RESERVED_SLUGS`, `groupBy` covered by the tenant extension, `$queryRaw` banned) | **HIGH** | Read directly from repository source |
| Vercel domain provisioning flow and SDK function names | **HIGH** | Official Vercel multi-tenant docs, page dated 2026-08-25 |
| `Domain` as platform-scoped with the `Member`/`Invitation` precedent | **HIGH** | Follows an existing in-repo pattern and `platformDb`'s own stated invariant |
| `marketplaceDb` as a fourth client | **MEDIUM** | Extrapolation of `scopedDb`'s construction. The *problem* (no client can serve a public cross-tenant read) is verified from source; the *shape of the fix* is a design proposal |
| Sentinel-segment custom-domain rewrite | **MEDIUM** | Follows the codebase's documented proxy/resolve split and its `/s/*`-not-externally-addressable guarantee. Not validated against a running Next 16 app — **verify early** that `[slug]` matches a percent-encoded `@`-prefixed segment as expected, and that the proxy's `/s/*` 404 does not fire on the rewritten path (rewrites do not re-enter the Proxy, per the file's own comment) |
| Build order | **MEDIUM** | Derived from real dependency analysis; the Inventory-first / Domains-last calls are judgement, not fact |

**Open questions for phase-level research:**

1. Does the marketplace show **listings** (merchant-curated, opt-in) only, or also merchants' full catalogs? This document assumes listings-only, which is what "merchant paid add-on, listing lifecycle" implies. If merchant *discovery* (`/marketplace/m/[storeSlug]`) shows a full catalog, `marketplaceDb` needs to read `Product` cross-tenant with a different predicate (`active AND org.active`) and the "listing = the unit of publication" model weakens.
2. Trending score: computed from `MarketplaceListingStat` clicks, from confirmed orders, or hand-curated? Order-derived trending requires the marketplace to read *other tenants'* order counts, which is a materially wider cross-tenant read than listing metadata. Prefer click-derived or curated.
3. Delivery + WhatsApp channel: the WhatsApp order path bypasses the payment state machine entirely. Does a WhatsApp order carry a delivery fee in its pre-filled message, or is delivery negotiated in the chat? Affects `src/server/checkout/order-message.ts`.
4. Whether `Organization.primaryDomainHost` canonicalization ships this milestone (subdomain → custom domain 301) or is deferred. It affects the storefront layout, sitemap, and every absolute URL the marketplace emits.

---

## Sources

- Repository source (authoritative for all existing-architecture claims): `prisma/schema.prisma`, `src/server/db/{tenant-scoped,platform,admin,base}.ts`, `src/proxy.ts`, `src/server/tenant/{host,resolve,cache,reserved-slugs}.ts`, `src/server/dashboard/{queries,buckets}.ts`, `src/server/search/queries.ts`, `src/server/entitlements/plans.ts`, `src/components/app-sidebar.tsx`, `eslint.config.mjs`
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/PROJECT.md`
- [Vercel — Configuring Custom Domains (multi-tenant platforms)](https://vercel.com/docs/multi-tenant/domain-management) — last updated 2026-08-25 — HIGH
- [Vercel — Multi-Tenant Platform Quickstart](https://vercel.com/docs/platforms/multi-tenant-platforms/quickstart) — HIGH
- [Vercel — Platforms Starter Kit announcement](https://vercel.com/blog/platforms-starter-kit) — MEDIUM (context only)
- [Public Suffix List guidelines](https://publicsuffix.org/learn/) — referenced by Vercel's docs — MEDIUM

---
*Architecture research for: multi-tenant commerce platform, v2.0 capability integration*
*Researched: 2026-09-13*
