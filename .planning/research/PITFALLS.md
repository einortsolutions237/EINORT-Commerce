# Pitfalls Research

**Domain:** Adding a public cross-tenant Marketplace, a paid listing add-on, Customers, Inventory, Delivery, DNS-verified custom Domains, and Analytics to an existing multi-tenant commerce app with structurally-enforced (Prisma Client Extension) tenant isolation and no live payment gateway
**Milestone:** v2.0 (subsequent milestone — v1.0 shipped Phases 1–5.2, Phase 3 partially)
**Researched:** 2026-09-13
**Confidence:** HIGH for codebase-specific pitfalls (read directly from `src/server/db/tenant-scoped.ts`, `src/server/orders/stock.ts`, `src/server/dashboard/queries.ts`, `src/server/tenant/host.ts`, `src/proxy.ts`, `prisma/schema.prisma`, `src/server/entitlements/plans.ts`). MEDIUM–HIGH for the Vercel domain/TLS mechanics (official Vercel multi-tenant docs, Aug 2026). MEDIUM for domain-takeover classes (OWASP/Azure guidance applied to this codebase's specific resolver design).

**Framing:** This codebase's entire security posture is "tenant identity comes from exactly two untrusted-free channels (Host header, session cookie), and every DB call declares its trust level at the import statement." Six of the seven v2.0 features are ordinary extensions of that. **Marketplace and Domains both break one of the two load-bearing assumptions**, and every critical pitfall below is downstream of that.

---

## Critical Pitfalls

### Pitfall 1: Widening `adminDb`'s ESLint fence to serve the public Marketplace

**What goes wrong:**
The Marketplace needs to read Products/stores across all tenants. The codebase offers exactly three doors: `scopedDb` (throws unless a `tenantId` is supplied, one tenant only), `platformDb` (allowlist facade over `Organization`/`User`/`Member`/`Invitation`/`Session` only), and `adminDb` (deliberately unscoped, `no-restricted-imports`-fenced to `src/server/admin/**`). None of them fits, so the path of least resistance is to relax `eslint.config.mjs` to also allow `src/server/marketplace/**` to import `adminDb`. The moment that happens, the same fully-unscoped client that exists for the *authenticated platform owner* is reachable from an *anonymous, crawler-hit, rate-limited-fail-open public route*. The next feature ("show how many orders this store has done") is one `adminDb.order.findMany()` away from a cross-tenant order leak with no lint error and no failing test.

**Why it happens:**
The fence is a per-directory ESLint override, so "add one more directory" is a two-line diff that passes review. It reads as configuration, not as a trust-boundary change. And the alternative (looping `scopedDb(tenantId)` over every tenant) is obviously wrong for performance, so the reviewer feels there is no third option.

**How to avoid:**
Add a **fourth DB tier**, not a fourth consumer of the third. Create `src/server/db/marketplace.ts` exporting `marketplaceDb` — a getter-based allowlist facade in the exact shape of `src/server/db/platform.ts`, exposing:
- **only** the marketplace-owned models (`MarketplaceListing`, `MarketplaceListingEvent`) plus `Organization` (for store name/slug/logo/status),
- **only** read operations (`findMany`, `findFirst`, `findUnique`, `count`) — no `create`/`update`/`delete` getters exist on the facade at all, so a write is a TypeScript error, not a code-review catch,
- **explicit `select` allowlists** on every relation traversal into `Product`/`ProductVariant`/`ProductImage`. Never `include: { product: true }` — that ships `sku`, internal flags, and every future column added to `Product` to an anonymous visitor on the day it is added.

Then extend `eslint.config.mjs` in both directions, mirroring the existing admin rule: `src/server/db/marketplace` is unimportable outside `src/server/marketplace/**`, and `src/server/marketplace/**` may not import `src/server/db/admin` or `src/server/db/tenant-scoped`. Add a source-scanning contract test in the style of `tests/unit/single-order-state-writer.test.ts` that fails if `src/server/marketplace/**` contains the strings `adminDb`, `Order`, `PaymentClaim`, or `Customer`.

**Warning signs:**
- A diff to `eslint.config.mjs`'s `no-restricted-imports` block appears in the same PR as a marketplace feature.
- Any marketplace module imports something from `src/server/orders/**` or `src/server/claims/**`.
- A marketplace Prisma call uses `include:` rather than `select:`.
- `git log -p eslint.config.mjs` shows the admin zone growing.

**Phase to address:** The first Marketplace phase, as its **first plan**, before any marketplace UI exists. This is a foundations task exactly like Phase 1's `scopedDb`, and retrofitting it after five marketplace pages are written is the expensive path.

---

### Pitfall 2: Marketplace visibility stored as a boolean that a cron flips

**What goes wrong:**
Storefront-plan downgrade, trial expiry, subscription lapse, store suspension, product deactivation, and listing expiry all have to hide a listing. The obvious implementation is a `MarketplaceListing.isVisible` / `status = 'EXPIRED'` column written by a scheduled job. Then: the job fails for a day and expired listings stay publicly live; a suspended store keeps appearing on the marketplace until the next run; a merchant who re-subscribes finds their listings permanently `EXPIRED` with no path back; and the marketplace's idea of "active" drifts from `resolveEntitlements`'s.

**Why it happens:**
Cross-tenant queries need a `WHERE` clause that pushes into SQL. `resolveEntitlements(org, now)` is a pure TypeScript function over one org row — you cannot call it inside a Prisma `where`. A stored boolean is the only obvious way to make the filter indexable.

**How to avoid:**
Keep the codebase's existing "derive, never store" rule (`Organization` has `trialEndsAt` but deliberately no `isExpired` column, and `resolveEntitlements` is pure `(org, now)`), and make it work cross-tenant by **exporting a `where`-clause builder from the entitlements module**:

```
// src/server/entitlements/marketplace-visibility.ts
export function marketplaceVisibilityWhere(now: Date): Prisma.MarketplaceListingWhereInput
```

It returns a composed predicate over the *inputs* — `organization: { status: "active", planTier: { in: [...] }, OR: [{ subscriptionStatus: "active" }, { trialEndsAt: { gt: now } }] }`, `listing.state: "LIVE"`, `listing.expiresAt: { gt: now }`, `product.active: true`. Live it next to `resolveEntitlements` and pin the two together with a unit test: for a table of synthetic org rows, `marketplaceVisibilityWhere(now)` evaluated in JS must agree with `resolveEntitlements(org, now).canWrite`-derived expectations for every row. A disagreement is a red unit test, not a support ticket.

Cron jobs then become optional (a housekeeping nicety), not a correctness dependency.

**Warning signs:**
- Any column named `isVisible`, `isExpired`, `isActive` on a listing that something other than a merchant action writes.
- A `vercel.json` cron entry or scheduled function that is required for correctness rather than for cleanup.
- Marketplace query code containing a hardcoded `subscriptionStatus: "active"` string rather than importing the builder.

**Phase to address:** Marketplace Marketing (listing lifecycle) phase, but the builder must be written in the earlier Marketplace foundations phase because the public read query depends on it.

---

### Pitfall 3: A downgraded merchant is locked out of managing the listings that are still public

**What goes wrong:**
`merchantAction({ mode: "write" })` checks `ctx.canWrite` **before** parsing input and refuses with `ReadOnlyError`. When a merchant's trial expires or their Storefront plan lapses, every write is blocked — including "pause my listing" and "remove my listing." If listing visibility were (wrongly) stored, their listings stay live on a public marketplace they can no longer control. Even with derived visibility, they cannot clean up, cannot correct a mistake, and their listing data quietly rots. This is the exact "silently orphaning" failure the milestone brief is worried about.

**Why it happens:**
`canWrite` was designed for a single question: "should this merchant be able to add more stuff?" Retraction is also a write, but it is a *safety* write. Nobody notices because the read-only state is tested with "can they create a product?", never with "can they undo something?"

**How to avoid:**
Introduce a third `merchantAction` mode alongside `read` and `write` — call it `"retract"` — that runs the identity ladder and Zod parse but skips `assertCanWrite`. Restrict it, by contract test, to a hardcoded allowlist of action names whose only effect is to *reduce* the merchant's public footprint (pause listing, remove listing, unpublish storefront, disconnect custom domain). Document at the definition site that adding an action to this list is a security decision, in the same register as `TENANT_SCOPED_MODELS`'s header comment.

Separately: on a plan downgrade that reduces the listing entitlement (e.g. Professional 10 listings → Business 3), **never auto-delete the excess**. Derive visibility for the N most recently activated listings within the new cap and leave the rest intact-but-hidden, with an explicit merchant-facing "3 of your 7 listings are hidden because your plan changed — choose which 3 to show." Auto-deletion is unrecoverable and looks like data loss.

**Warning signs:**
- Test coverage for the read-only state only asserts creates are blocked.
- A merchant support message shaped "my listing is still up and I can't take it down."
- Any `deleteMany` in a downgrade or expiry code path.

**Phase to address:** Marketplace Marketing phase; the `retract` mode itself is a small change to `src/server/merchant/action.ts` and should land in the same phase that first needs it.

---

### Pitfall 4: Snapshotting the product onto the listing (violating reference-not-duplicate)

**What goes wrong:**
The codebase's strongest instinct is **snapshot-on-write** — `OrderItem` copies `productName`, `variantLabel`, `unitPriceXaf`, `imageKey` at placement precisely so a later catalog edit cannot rewrite history. Applying that same instinct to `MarketplaceListing` produces a second, editable, drifting copy of the product: the marketplace shows 12,000 XAF and a name the merchant changed last week; the shopper clicks through to a storefront showing 15,000 XAF; a deactivated product still has a live marketplace card. Worse, once display fields live on the listing, "delete the listing" starts to feel like "delete the product," which is the failure Master Spec V3 explicitly forbids.

**Why it happens:**
It is the same reasoning that is *correct* for orders, applied to a case where it is wrong. It is also faster — a cross-tenant read over one denormalized table needs no joins.

**How to avoid:**
State the rule explicitly in the model's schema comment: **an order is a record of a past event and must snapshot; a listing is a live pointer and must reference.** `MarketplaceListing` carries only `tenantId`, `productId`, lifecycle state, tier/placement, dates, moderation fields — no name, no price, no image key. Reads join to live `Product`/`ProductVariant`/`ProductImage` via the existing composite FK shape (`references: [tenantId, id]`), with an explicit `select` allowlist (Pitfall 1). Deactivating a product hides its listing automatically because the join predicate includes `product.active: true`.

If a denormalized copy later becomes unavoidable for search/index performance, it must be a **derived projection with a single writer and a documented refresh trigger**, never a row a merchant can edit, and it must be named to say so (`MarketplaceListingIndex`, not `MarketplaceListing`).

For the "never delete merchant products" rule, make it structural rather than cultural:
- FK direction is `MarketplaceListing → Product`, `onDelete: Restrict`. There is no cascade from listing to product and there cannot be.
- A source-scanning contract test (same pattern as `tests/unit/single-order-state-writer.test.ts`) fails if `src/server/marketplace/**` contains `product.update`, `product.delete`, `productVariant.`, or `setProductActive`.

**Warning signs:**
- `MarketplaceListing` grows a `priceXaf`, `title`, or `imageKey` column.
- A "remove listing" handler that touches anything other than the listing row and its event log.
- Marketplace card prices differ from storefront prices in manual testing.

**Phase to address:** Marketplace Marketing phase (schema design plan, before any listing UI).

---

### Pitfall 5: Persisting an unverified custom-domain claim, creating first-writer-wins takeover

**What goes wrong:**
A merchant enters `nike.cm` in the Domains page. The obvious implementation writes a `CustomDomain` row immediately with `status = PENDING`, calls Vercel's add-domain API, and shows DNS instructions. Two bugs follow, and both are takeovers:

1. **Pre-claim squatting.** The row now exists. If the resolver, the Redis host cache, or any admin view treats a row's existence as a mapping, whoever later points that hostname at Vercel lands on the squatter's storefront — including the real owner. The squatter did nothing but type a string into a form.
2. **Vercel does not verify for you.** Per Vercel's own multi-tenant docs (Aug 2026): *"If the domain is already in use on Vercel, the user needs to set a TXT record to prove ownership."* Ownership verification is triggered by a **conflict with another Vercel account**, not by domain ownership. `projectsAddProjectDomain` on a domain nobody else has on Vercel **succeeds with `verified: true`** and no proof whatsoever. Treating Vercel's `verified` flag as proof of merchant ownership is a verification bypass by design.

**Why it happens:**
The provider returns a field literally named `verified`, and the platform's job feels like "call the API and mirror its status."

**How to avoid:**
Run **EINORT's own DNS proof first, and treat Vercel purely as a TLS/routing provisioner afterwards.**

1. On claim, generate a **cryptographically random, per-`(tenantId, hostname)` token** stored server-side. Never derive it from the hostname, the tenant id, or a hash of either — a derivable token means any merchant can compute another merchant's challenge.
2. The merchant publishes `_einort-verify.<hostname> TXT "<token>"`.
3. Verify by resolving **the exact QNAME with `TYPE=TXT`** using `node:dns/promises`'s `Resolver` with explicit public resolvers, and require **exact string equality** against the stored token. Never "any TXT on the apex contains the token," never a substring match, never a resolution that follows a CNAME to an attacker-chosen target and accepts what it finds.
4. Only on success: write/flip the mapping to `VERIFIED`, enforce a **global unique index on the normalized hostname** (mirroring `Organization.slug @unique` and `Order.trackingTokenHash @unique` — "a collision anywhere is a correctness bug, and the constraint costs nothing"), and only then call Vercel.
5. The resolver and the Redis host cache must read **only `VERIFIED` rows**, structurally: put the status filter inside the single resolver function, not at its call sites.

Also enforce a per-plan cap on custom domains as a registered `PlanLimits` key (D-07's "register every limit now, even unenforced") plus a rate limiter on the claim action — otherwise one merchant can burn your Vercel project's domain quota in a loop.

**Warning signs:**
- Anything reads `CustomDomain` without a `status: VERIFIED` predicate.
- The verification token is computed rather than randomly generated and stored.
- The DNS check uses `dns.resolveAny` or a `fetch` to a DNS-over-HTTPS endpoint with default caching.
- The merchant-facing UI says "Connected" before a TLS certificate exists.

**Phase to address:** Domains phase, in the plan that creates the schema and the verification function — before any Vercel API call is written.

---

### Pitfall 6: Verify-once-then-trust-forever, and the two-system delete

**What goes wrong:**
Two follow-on takeover classes that a first implementation always misses:

- **Stale verification.** A domain verified in September is still mapped in March after it expired and was re-registered by someone else. The new owner's visitors get the old merchant's storefront; the old merchant retains a live hostname they no longer own. The TXT record is long gone, but nothing re-checks.
- **Dangling half-deletes.** Disconnecting a domain requires two calls to two systems (`projectsRemoveProjectDomain` **and** `domainsDeleteDomain`) plus your own DB row plus the Redis host-cache entry. Any subset succeeding leaves a dangling state. The worst ordering is deleting the Vercel entry first while leaving the DB row: the hostname still resolves to a tenant in your app but has no certificate. The second-worst is leaving the domain attached to your Vercel project after removing your DB row — the classic dangling-DNS shape that OWASP and Azure both flag, because a *different* tenant can later add that hostname and inherit the still-pointing DNS.

**Why it happens:**
Verification is modeled as a one-time onboarding step rather than an ongoing invariant. Deletion is modeled as one user action rather than a distributed transaction across three systems.

**How to avoid:**
- **Re-verify on a schedule** (weekly is sufficient at pilot scale) and on every certificate-renewal-adjacent event. On failure, do **not** immediately unmap — move to `VERIFICATION_FAILED` with a grace window (7 days), notify the merchant through the ADM-05 support thread (the channel already exists; do not build a second one), then demote to `UNVERIFIED`, which structurally removes it from resolution.
- **Order the teardown deliberately and document why:** (1) delete the Redis host-cache entry, (2) delete/demote the DB mapping so the hostname stops resolving to a tenant, (3) remove from the Vercel project, (4) remove from the Vercel account. Steps 3–4 are idempotent retries; steps 1–2 are the security-relevant ones and must come first. Make the teardown a single named function with this order in a header comment, in the codebase's existing "DO NOT 'FIX' THIS" register.
- Add a reconciliation script (dev/ops, not a request path) that diffs `CustomDomain` rows against `projectsGetProjectDomain` results and reports both directions of drift.

**Warning signs:**
- No `lastVerifiedAt` column on the domain model.
- Disconnect is implemented as a single `Promise.all` of unrelated deletes (the shape Vercel's own docs example uses — it is illustrative, not a correctness pattern).
- A Vercel project domain list longer than the count of `VERIFIED` rows in your DB.

**Phase to address:** Domains phase, same phase as Pitfall 5 — the re-verification job and the ordered teardown are part of "done," not a follow-up.

---

### Pitfall 7: Putting hostname→tenant I/O into `src/proxy.ts`

**What goes wrong:**
`classifyHost` currently returns `{ kind: "unknown", reason: "foreign-domain" }` for anything not under the root domain, and the proxy rewrites that to `/store-not-found`. Custom domains are, by definition, foreign domains. The obvious fix is to look the hostname up in Postgres or Redis inside `proxy.ts` and rewrite to `/s/{slug}`. That puts a database or network call on **every matched request including prefetches and `_next/data`**, violates the file's two explicit rules ("No I/O, no ORM, no cache client", "must never import Prisma, Redis, or `@/env`"), and pulls the validated-env module plus Zod into the interception path. It also creates a per-request failure mode where a Redis blip takes every storefront offline.

**Why it happens:**
The proxy is where hostname logic already lives, and "just one lookup" feels proportionate. Nothing in tooling stops it — the no-I/O rule is enforced by convention and review only (`ARCHITECTURE.md` says so explicitly).

**How to avoid:**
Mirror the existing subdomain pattern exactly. Add a fourth `HostResult` kind — `{ kind: "custom"; host: string }` — returned by the **pure** `classifyHost` for any syntactically valid FQDN that is not the root domain and not a `*.vercel.app` preview. The proxy rewrites it to `/d/{encodeURIComponent(host)}/...` with the same unconditional header stripping. Resolution happens in `src/app/d/[host]/layout.tsx` via a new `resolveTenantByCustomDomain(host)` living in `src/server/tenant/` — a directory **already inside the ESLint zone permitted to import `db/base`** — reusing the same Redis positive/negative cache and the same fail-closed-to-`notFound()` posture as `resolveTenantBySlug`.

Two guards that must ship with it:
- `/d` and `/d/*` get the same "never externally addressable" hard 404 that `/s` and `/s/*` already have in `proxy.ts` step (1). Without it, `einort.com/d/whatever` serves a tenant storefront inside the apex cookie scope, which is precisely what D-07's cookie separation depends on not happening.
- The hostname must be **normalized before it becomes a cache key** — lowercase, trim, strip port, strip trailing dot, reject length > 253 and labels > 63, reject anything failing an FQDN shape check. An attacker-controlled Host header is otherwise an unbounded Redis key space (negative-cache fill / cost DoS). `classifyHost` already does the first four of these for the root-domain path; reuse that normalization rather than writing a second one.

**Warning signs:**
- Any import in `src/proxy.ts` beyond `next/server` and `@/server/tenant/host`.
- `NEXT_PUBLIC_ROOT_DOMAIN` no longer being the only env value the proxy reads.
- A `/d/*` route that returns content when hit directly on the apex.

**Phase to address:** Domains phase, first plan. This is the routing shape everything else in the phase builds on.

---

### Pitfall 8: Adding shopper accounts because the feature is called "Customers"

**What goes wrong:**
"Customers" reads as "users who log in." Building shopper auth adds a **third tenant-identity channel** to a system whose entire architecture note says there are exactly two ("no third path exists"), puts a session cookie on merchant-controlled subdomains under a non-PSL apex (`tenant1.einort.com` can currently set a `Domain=einort.com` cookie that the browser sends to `app`/apex — Vercel's own multi-tenant guidance calls this out), and directly contradicts CHK-01 ("browse … and review an order summary **without creating an account**"). It also doubles the Better Auth surface and forces a decision about whether a shopper account is per-store or platform-wide — a decision with no good answer at pilot scale.

**Why it happens:**
The design reference is a client-only mock with no auth model, so "Customers" is visually indistinguishable from a logged-in-user list. And every commerce platform the merchant has seen has shopper accounts.

**How to avoid:**
**Customers is a merchant-side derived view over `Order`, with no new auth surface.** This is not a compromise — the codebase already does it. `overviewMetrics` (`src/server/dashboard/queries.ts`) computes the "new customers" card as a set difference over `groupBy(["customerPhone"])`, and its own header comment states the reasoning: *"There is no `Customer` model in this schema — the only customer identity is the `Order.customerName`/`customerPhone` snapshot pair."* Customers v2.0 is that, expanded: group orders by normalized `customerPhone`, aggregate lifetime value / order count / first-and-last order date, list order history.

Three rules that make it safe:
1. **`Order.customerName`/`customerPhone` stay snapshot columns forever.** If a materialized `Customer` row is ever added, `Order` gains at most a *nullable* `customerId` alongside the existing columns — the columns are never replaced by a join. Otherwise a customer correcting their name silently rewrites what every past order says it was sold to, which is the same class of bug `OrderItem`'s price snapshot exists to prevent.
2. **Normalization must move to the single sanctioned writer.** `normalizeCameroonMsisdn()` runs today in `src/server/checkout/actions.ts`, *upstream* of `placeOrder`. Any other order-creating path (an admin-created order, a future WhatsApp reconciliation, a seed) writes an unnormalized phone and forks one human into two customer cards. Move the normalization into `placeOrder` (or a `CustomerPhone` value object it constructs), backfill existing rows in the same migration, and add an isolation test asserting no `Order.customerPhone` in the DB fails the normalized-form predicate.
3. **The existing tracking-token pattern is the customer-facing identity mechanism.** Hashed, plaintext returned exactly once, never persisted. If customers need to see their own order, extend that; do not add a login.

Record this as an explicit Key Decision in PROJECT.md so it does not get relitigated per-phase.

**Warning signs:**
- A `Customer` model with a `passwordHash`, `emailVerified`, or Better Auth relation.
- Any new route under `src/app/s/[slug]/account/**`.
- Two customer rows in the dashboard for `+237670000000` and `670000000`.
- `Order.customerName` becoming nullable or being removed.

**Phase to address:** Customers phase; the phone-normalization move and backfill should be its first plan, since Analytics and the Customers list both depend on the key being stable.

---

### Pitfall 9: Absolute stock writes racing the conditional-decrement hold

**What goes wrong:**
An Inventory page needs "set stock to 24." The natural implementation is `productVariant.update({ where: { id }, data: { stock: 24 } })`. That is a **lost update** against `holdStockForLines`, which is a conditional `updateMany` with `stock: { gte: qty }` in its `WHERE` — the whole mechanism that makes overselling "impossible by construction rather than by timing." Sequence: merchant loads the Inventory page showing 25; a shopper checks out and the hold decrements to 24; the merchant clicks save with the stale 24 they were shown; the sold unit is resurrected. Worse in the other direction: the merchant sets 24 while a hold is mid-transaction, and the hold's `gte` check passes against a value that is about to be overwritten.

`src/server/orders/stock.ts` warns about exactly this class in its own header ("DO NOT 'UPGRADE' THIS") but only defends the placement path.

**Why it happens:**
"Set stock to N" is a UI affordance, and the DB verb for it is `update`. Nothing in the type system distinguishes a safe relative write from an unsafe absolute one.

**How to avoid:**
Inventory mutations live in `src/server/orders/stock.ts` (or a sibling that its header comment names), never in a new module, and use one of exactly two shapes:
- **Relative adjustment (preferred):** `updateMany({ where: { id, active: true, stock: { gte: delta > 0 ? 0 : -delta } }, data: { stock: { increment: delta } } })`, `count === 0` → refuse. This is the same conditional-write discipline `releaseStock` uses to claim `stockHeld` atomically.
- **Absolute set, compare-and-swap:** the form carries the value the merchant was *shown* (`expectedStock`), and the write is `updateMany({ where: { id, stock: expectedStock }, data: { stock: newValue } })`. `count === 0` means someone else moved it → return a typed `StockChangedError` carrying the current value and re-render, never retry silently. Note this is the *one* legitimate case for a client-supplied numeric in a `where` — it is a precondition, not a trusted value, and it can only ever cause a refusal.

Both go through `merchantAction({ mode: "write" })` so an expired trial cannot adjust stock, and both take a `ScopedTx` if any caller ever pairs them with another write.

**Warning signs:**
- `data: { stock: <number> }` anywhere without a `stock:` predicate in the same `where`.
- Any stock write outside `src/server/orders/stock.ts`.
- A merchant reporting "my stock number went back up."

**Phase to address:** Inventory phase, first plan. Add a source-scanning contract test (`tests/unit/single-stock-writer.test.ts`, modeled on `single-order-state-writer.test.ts`) in the same plan.

---

### Pitfall 10: A second source of truth for stock, or a ledger that cannot reconcile

**What goes wrong:**
Two variants of the same mistake:

- **Second balance.** `ProductVariant.stock` is documented in the schema as *"the ONLY place stock lives. Every product has at least one variant row, so there is exactly one decrement code path."* An Inventory feature that adds `Product.totalStock`, or an `InventoryItem` table holding a quantity, creates a balance that `holdStockForLines` does not decrement. Checkout and the Inventory page then disagree, and the merchant trusts the page.
- **Unreconcilable ledger.** Adding a `StockAdjustment` append-only ledger is the right instinct (it matches `OrderEvent`), but `holdStockForLines` and `releaseStock` write **no ledger rows today**. Ship the ledger without touching them and the sum of adjustments will never equal `ProductVariant.stock`, because every sale and every claim-rejection release is invisible to it. The merchant sees "Stock history" that does not explain their stock.

**Why it happens:**
The ledger is scoped as an Inventory-phase feature, and the order path is in a different module owned by a different phase. Nobody notices the ledger is missing half its inputs until a merchant tries to reconcile.

**How to avoid:**
- `ProductVariant.stock` remains the single balance. Inventory is a **view** over it plus a **delta ledger**, never a competing balance. Add an assertion to the isolation suite: for every variant, `stock` equals the seeded opening value plus the sum of all ledger deltas (once the ledger covers all movements).
- Pick one and say so in the UI copy (`src/lib/strings.ts`, per the centralized-strings rule):
  - **(a) Manual-only ledger, honestly labeled.** The ledger records merchant adjustments only, and the surface is called "Manual adjustments," not "Stock history." Smallest change, ships this milestone, no lie.
  - **(b) Complete ledger.** `holdStockForLines`, `releaseStock`, and the manual adjustment path all append. Correct, but it means editing the most concurrency-sensitive file in the codebase — the one whose own comments say re-run `stock-race.test.ts` solo, multiple times, before trusting a green run (`CONCERNS.md` documents this test as already timeout-fragile on Neon).

  **Recommendation: (a) for v2.0.** (b) is a phase of its own.
- **Surface "Reserved" separately from "Available."** `ProductVariant.stock` already excludes units held by unconfirmed `MANUAL_TRANSFER` orders — `holdStockForLines` decrements at placement, long before a human confirms payment. A merchant with three pending claims sees stock drop with no sales, then sees it jump back when claims are rejected. Show **Available** (`ProductVariant.stock`) and **Reserved** (sum of `OrderItem.quantity` for orders where `stockHeld: true` and state in `PAYMENT_PENDING`/`PAYMENT_CLAIMED`/`DISPUTED`) as two numbers, and compute low-stock alerts on Available with the reserved figure visible next to it.
- **Parked variants keep their stock.** D-08 forbids hard deletes; deactivated variants retain a `stock` value. Inventory lists must exclude `active: false` rows from sellable totals and low-stock alerts, and a bulk "zero everything" must not touch them (they may be reactivated).

**Warning signs:**
- Any new column named `stock`, `quantity`, or `onHand` outside `ProductVariant`.
- A merchant asking why their inventory dropped when they made no sales.
- Low-stock alerts firing during a payment-claim backlog.

**Phase to address:** Inventory phase.

---

### Pitfall 11: Delivery fees that are not re-derived and snapshotted at placement

**What goes wrong:**
`Order` has `subtotalXaf` and `totalXaf` but no delivery-fee column, and `placeOrder` accepts *"only variant ids and quantities — no price fields exist on the input type."* Adding Delivery zones/rates tempts two mistakes at once: accepting a `deliveryFeeXaf` from the checkout form (the exact anti-pattern `ARCHITECTURE.md` names — "Validating a client-submitted price against the database"), and joining `Order → DeliveryRate` at read time so a merchant who raises their Douala rate next month retroactively changes what a past order says it cost.

Then a manual-payments-specific money bug: the manual-transfer screen shows *"the exact amount"* to transfer via Mobile Money, and the WhatsApp deep-link message is generated from the order. If the delivery fee is added to the display but not to the persisted `totalXaf` (or vice versa), the customer transfers the wrong amount, the merchant's claim review has no matching figure, and the order lands in `DISPUTED` for a reason no one can reconstruct. With a live PSP this would be caught by the gateway; with manual transfer there is nothing between the mistake and the customer's money.

**Why it happens:**
The delivery quote is computed client-side for the UI (address → zone → rate), and passing the already-computed number to the server feels like avoiding duplicate work.

**How to avoid:**
- Extend `PlaceOrderInput` with the **zone selector only** (a zone id, or the address fields the zone is derived from) — never a fee. Re-derive the rate inside `placeOrder`'s existing `$transaction`, from the same tenant-scoped read the rest of the order uses.
- Add `deliveryFeeXaf Int @default(0)` **and** snapshot columns `deliveryZoneName String?` / `deliveryRateXaf Int?` to `Order`, in the exact spirit of `OrderItem`'s plain-column snapshot ("Plain columns, NOT relations"). Define and document the invariant `totalXaf = subtotalXaf + deliveryFeeXaf` and assert it in the isolation suite.
- Derive **every** customer-facing amount from `Order.totalXaf` — the manual-transfer "exact amount," the USSD helper string, the WhatsApp message, the tracking page, and the merchant's claim-review screen. One field, one number, no second computation. Add a unit test that the WhatsApp/USSD message contains the same integer as `order.totalXaf`.
- COD: the fee is part of the amount collected on delivery, so the same rule holds.

**Warning signs:**
- `deliveryFeeXaf` appearing in a Zod schema for a checkout action.
- Any read-time join from `Order` to `DeliveryRate`.
- The order confirmation page and the merchant order detail showing different totals.

**Phase to address:** Delivery phase — and it must land **before or with** any Analytics revenue work, because changing what `totalXaf` means after Analytics ships silently reinterprets every chart.

---

### Pitfall 12: Analytics as a second, drifting source of truth for numbers Overview already shows

**What goes wrong:**
`src/server/dashboard/queries.ts` already defines `EARNED_STATES` (`CONFIRMED`, `FULFILLED` only — *"money is only real once a human has confirmed it"*), `OPEN_STATES`, `DOUALA_UTC_OFFSET_MINUTES`, and a Node-side `bucketByDay`. A new `src/server/analytics/**` that redefines any of these produces two pages of the same product showing different revenue for the same week. Merchants do not report this as a bug; they stop trusting the product.

**There is already a live inconsistency Analytics will expose.** In `overviewMetrics`, revenue is filtered to `EARNED_STATES`, but `unitsSold` is not:

```
db.orderItem.aggregate({
  _sum: { quantity: true },
  where: { order: { placedAt: { gte: since } } },   // no state filter
})
```

So "Units sold" today counts items in `ORDER_PLACED`, `PAYMENT_PENDING`, `PAYMENT_CLAIMED` and `DISPUTED` orders. An Analytics "top products" or "units sold" chart will either match Overview (and be wrong by the platform's own definition of earned revenue) or filter correctly (and visibly disagree with Overview). Decide which is right **before** building the chart, fix the loser, and note the change.

**Why it happens:**
Analytics is scoped as a new module, and copying two small constant arrays is faster than importing across a module boundary.

**How to avoid:**
- Extract `EARNED_STATES`, `OPEN_STATES`, `DOUALA_UTC_OFFSET_MINUTES`, and `bucketByDay` into one shared module (`src/server/metrics/`), and have **both** `src/server/dashboard/**` and `src/server/analytics/**` import from it. Zero redefinitions. `bucketByDay` is already pure with no `server-only` marker specifically so it can be unit-tested — keep that property.
- Add an equivalence test: for a fixed set of seeded orders and a fixed window, `overviewMetrics().revenueXaf` must equal the Analytics revenue total for the same window. A drift is a red test.
- Resolve the `unitsSold` state-filter inconsistency as an explicit decision, recorded in PROJECT.md.
- Reuse the Douala offset constant rather than `Intl`/UTC truncation. Cameroon is UTC+1 year-round with no DST, and the existing comment explains that an order placed late in the UTC day belongs to the *next* Douala calendar day — a UTC-bucketed chart silently misfiles it.

**Warning signs:**
- The string `CONFIRMED` appearing in an array literal anywhere outside the shared metrics module.
- Two files containing the number `60` as a timezone offset.
- Overview and Analytics revenue differing in manual testing by exactly one late-evening order.

**Phase to address:** Analytics phase, first plan (the extraction), before any chart is built.

---

### Pitfall 13: Reaching for a raw query or `adminDb` to make an Analytics aggregation work

**What goes wrong:**
Analytics needs `GROUP BY date_trunc('day', placed_at)`. Prisma's `groupBy` cannot truncate a `DateTime`, and `$queryRaw`/`$executeRaw` are banned repo-wide via `no-restricted-syntax` **because they are the one escape hatch the tenant extension provably does not intercept**. The pressure to make one chart work is exactly how a `// eslint-disable-next-line no-restricted-syntax` lands on a query that turns out to have no tenant predicate — or how someone "just uses `adminDb` for the platform chart" and ships a per-merchant dashboard rendering another merchant's revenue.

The existing workaround does not scale to Analytics windows. `overviewMetrics` fetches raw rows and buckets them in Node with `REVENUE_WINDOW_ROW_CAP = 5000` and a comment conceding *"a merchant doing many thousands of orders in a single 7-day window would exceed this and the chart would undercount that window's tail."* Analytics over 30/90/365-day windows makes that documented risk real, and it fails **silently** — the chart just gets shorter.

**Why it happens:**
The lint rule blocks the direct route and Prisma blocks the ergonomic one, so the remaining options all look bad.

**How to avoid:**
Give SQL a column it can already group on. Add a denormalized **`placedOnDay` (Postgres `date`, Douala-local)** to `Order`, written by `placeOrder` inside the existing placement transaction using the shared offset constant, with `@@index([tenantId, placedOnDay])`. Then:

```
scopedDb(tenantId).order.groupBy({
  by: ["placedOnDay"],
  _sum: { totalXaf: true },
  _count: true,
  where: { placedOnDay: { gte: from, lte: to }, state: { in: [...EARNED_STATES] } },
})
```

No raw SQL, no row cap, no Node-side bucketing, fully intercepted by the tenant extension, and index-backed. Backfill in the migration. `bucketByDay` stays for the pure zero-fill/label/percent-of-max step, which is what it is actually good at.

Two further rules for every Analytics query:
- **The top-level model must be a registered tenant-scoped model.** The extension stamps the *top-level* `where` only; a nested relation filter is not rewritten. `overviewMetrics`'s `orderItem.aggregate({ where: { order: { placedAt } } })` is safe **only** because `OrderItem` itself carries `tenantId` and is stamped at the top level. Any query whose sole tenant discriminator lives inside a nested relation filter is unscoped in spirit and one refactor away from being unscoped in fact.
- **Cache keys carry the tenant id.** If any Analytics result is memoized in Redis, the key is `analytics:{tenantId}:{window}:{version}` — never just the window. This codebase already gets this right for the cart and tenant caches; a shared analytics cache is the obvious place to forget.

Cross-tenant/platform-wide analytics is **out of scope this milestone by construction** — `adminDb` is fenced to `src/server/admin/**`, and Platform Admin is explicitly deferred. Say so in the phase's non-goals so nobody builds it "while they're in there."

**Warning signs:**
- An `eslint-disable` comment for `no-restricted-syntax` anywhere under `src/`.
- `adminDb` imported outside `src/server/admin/**`.
- A `take:` cap on a query whose result is summed rather than listed.
- An analytics chart whose totals differ from the orders list for the same window.

**Phase to address:** Analytics phase. The `placedOnDay` column and backfill are a schema plan that must precede the chart plans.

---

### Pitfall 14: Personalized or session-touching code on the public Marketplace route tree

**What goes wrong:**
The Marketplace lives on the apex, which currently hosts the `(dashboard)` route group and the Better Auth catch-all. If a marketplace page ends up inside `(dashboard)` (or calls `requireMerchantContext()` for a "you're logged in as…" header, or renders a shared shell component that does), three things break at once: the page can no longer be statically cached or ISR'd; a cached fragment can serve one merchant's session-derived content to everyone; and `requireMerchantContext`'s **redirect ladder** fires for anonymous visitors — a shopper browsing the marketplace gets bounced to `/login` or `/onboarding/create-store`.

**Why it happens:**
The dashboard layout is the "app shell" everyone reaches for, and `requireMerchantContext()` is memoized and parameterless, so calling it feels free.

**How to avoid:**
- Marketplace pages live in their own route group (`src/app/(marketplace)/**`), outside `(dashboard)`, with their own layout. Add a source-scanning contract test asserting no file under that tree references `requireMerchantContext`, `auth.api.getSession`, `scopedDb`, or `adminDb`.
- Marketplace pages are **explicitly non-personalized**. If a "you're signed in" affordance is wanted, it is a client island that fetches its own state, never a server-rendered branch.
- Add a dedicated rate limiter for marketplace search via the existing `createLimiter` pattern — and remember the documented contract that limiters **fail open** on Upstash outage, so search must also be cheap enough to survive being unthrottled.
- Reserve the marketplace's own hostname *before* launch if it will ever live at `marketplace.einort.com`: add it to `RESERVED_SLUGS` **and** check no existing `Organization.slug` already holds it. `classifyHost` checks reserved names before format rules, so the ordering is already right — but an already-issued slug is a migration problem, not a config problem.

**Warning signs:**
- A marketplace page importing anything from `src/server/merchant/**`.
- An anonymous browser being redirected to `/login` from a marketplace URL.
- `export const dynamic = "force-dynamic"` added to a marketplace page to "fix" a caching bug.

**Phase to address:** Marketplace foundations phase.

---

### Pitfall 15: Building a marketplace-level cart or checkout

**What goes wrong:**
The design reference is a client-only Zustand mock, so a marketplace "Add to cart" button is trivial there and structurally impossible here. The cart is a Redis blob keyed by an opaque `httpOnly` cookie with **no `domain` attribute** — *"cross-tenant cookie leakage is structurally prevented"* — and `placeOrder(tenantId, input)` is single-tenant by signature. A marketplace cart means either a cross-tenant cookie (undoing D-07's isolation), a multi-tenant order (undoing the order model, the stock hold, the state machine, and the manual-payment flow, which routes to *one* merchant's Mobile Money number), or a split-order orchestrator — none of which is a v2.0-sized change, and the last of which has no answer for "which merchant do I transfer money to."

**Why it happens:**
It is what every marketplace looks like, and the prototype shows it working.

**How to avoid:**
Scope Marketplace as **discovery only**: search, categories, featured/trending, merchant profiles, product detail — and a "View in store" hand-off to `{slug}.einort.com/products/{...}` (or the merchant's verified custom domain). Write this into the phase's non-goals and into the marketplace product-detail page's own header comment, because it will be re-proposed. Route the hand-off through the `StoreSlugHistory` redirect path so a slug change does not turn every marketplace link into a 404.

**Warning signs:**
- Any cart cookie gaining a `domain` attribute.
- A `tenantId` becoming optional or an array anywhere in the order path.
- A marketplace component importing from `src/server/cart/**` or `src/server/checkout/**`.

**Phase to address:** Marketplace foundations phase (as an explicit non-goal in the phase context document).

---

### Pitfall 16: Shipping listing moderation with no moderator

**What goes wrong:**
Marketplace Marketing implies review/approval, and Platform Admin is **explicitly deferred out of this milestone**. Ship a `PENDING_REVIEW` state with no reviewer UI and either nothing ever goes live (the paid add-on is unusable, and merchants have paid), or someone quietly auto-approves and the marketplace becomes an unmoderated public surface carrying the platform's brand and TLS certificate.

**Why it happens:**
The lifecycle state machine is designed from the spec's vocabulary; the actor who drives the transitions is assumed to exist in the deferred admin surface.

**How to avoid:**
Force the decision in the phase context document, with three viable answers: (a) auto-approve on payment confirmation, with a takedown action in the pilot-scoped Super Admin dashboard that already exists; (b) approve manually through the ADM-05 support thread, which is already the channel for subscription-payment claims and needs no new surface; (c) defer paid listings entirely and ship Marketplace as read-only discovery of all active stores. **(b) is the most consistent with the manual-first, human-in-the-loop pattern the whole product already uses for payments.**

Model the lifecycle in the codebase's established idiom regardless: a `LISTING_TRANSITIONS` `Readonly<Record<...>>` table plus a `canTransitionListing` predicate, a single sanctioned writer paired with an append-only `MarketplaceListingEvent` row, and a source-scanning test — not a bag of `isPaused`/`isApproved`/`isRejected` booleans. And **expiry is derived from `expiresAt` at read time**, never a state a cron writes (Pitfall 2).

**Warning signs:**
- A listing state enum with no code path that leaves it.
- A `PENDING_REVIEW` row older than the phase.
- Independent boolean columns on the listing that can contradict each other.

**Phase to address:** Marketplace Marketing phase — the decision belongs in the phase context, before schema design.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Widen `adminDb`'s ESLint zone to include marketplace/analytics | Two-line diff, cross-tenant reads work immediately | Every future marketplace query has unrestricted reach into `Order`/`PaymentClaim`; a leak becomes a normal-looking commit | **Never.** Add a narrow read-only facade (`marketplaceDb`) instead |
| `$queryRaw` with an `eslint-disable` for one analytics `date_trunc` | The chart works today | The one query the tenant extension cannot intercept, in the module most likely to be copy-pasted from | **Never.** Add `Order.placedOnDay` and use `groupBy` |
| Denormalize product name/price onto `MarketplaceListing` | No joins on the hottest public query | Marketplace and storefront prices drift; "remove listing" starts to feel like "delete product" | Only as a clearly-named derived index (`MarketplaceListingIndex`) with one writer and a documented refresh trigger |
| Store listing visibility as a boolean flipped by cron | Indexable `WHERE`, simple query | Cron outage = expired listings stay public; re-subscribe does not restore; drifts from `resolveEntitlements` | Only as a cache column *alongside* the derived predicate, never as the authority |
| Manual-adjustments-only stock ledger | Ships in one plan; avoids editing the concurrency-critical `stock.ts` | Ledger sums never reconcile with `ProductVariant.stock` | **Acceptable for v2.0** if the UI is labeled "Manual adjustments," not "Stock history" |
| Materialize a `Customer` table with FK from `Order` | Clean relational model, easy joins | Breaks the snapshot invariant; a customer edit rewrites order history | Only with `Order`'s snapshot columns retained and a *nullable* `customerId` added alongside |
| Skip re-verification of custom domains after initial success | One less scheduled job | Expired/transferred domains stay mapped to the old tenant indefinitely | **Never** for a public TLS-terminated hostname |
| Trust Vercel's `verified: true` as proof of merchant ownership | No DNS code to write | Vercel only requires TXT when *another Vercel account* holds the domain — an unclaimed domain verifies with zero proof | **Never** |
| Skip the ADM-05 thread and add a new notification channel for domain/listing status | Feels self-contained | A third messaging surface; `resend` is still unwired (no email sends exist in `src/`) | **Never** while ADM-05 exists |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vercel Domains API | Treating `verified: true` from `projectsAddProjectDomain`/`projectsVerifyProjectDomain` as proof the merchant owns the domain | Vercel's TXT challenge fires only on conflict with another Vercel account. Run EINORT's own `_einort-verify` TXT check first; call Vercel only after it passes |
| Vercel Domains API | Removing a domain with a single `Promise.all` of `projectsRemoveProjectDomain` + `domainsDeleteDomain` (as the docs example shows) | Ordered teardown: Redis cache entry → DB mapping → project domain → account domain. The first two are the security-relevant steps and must complete first |
| Vercel Domains API | Marking the domain "Connected" in the merchant UI as soon as verification succeeds | Three distinct states to display and poll: TXT verified → A/CNAME pointed at Vercel → certificate issued. TLS is issued *after* DNS points at Vercel, not after TXT verification |
| Vercel Domains API | Unbounded merchant-triggered domain adds | Rate-limit the claim action and register a `customDomains` cap in `PlanLimits` (D-07: register every limit now, even unenforced) |
| Node DNS resolution | `dns.resolveAny`, a substring match, or a cached/DoH resolver for the ownership challenge | `dns/promises` `Resolver` with explicit servers, exact QNAME + `TYPE=TXT`, exact string equality against a server-stored random token |
| Wildcard `*.einort.com` TLS | Assuming the wildcard cert covers custom domains | Custom domains get individual certificates. Wildcard requires Vercel nameservers on the apex; custom domains do not and follow a separate path |
| Browser cookie scoping | Relying on subdomain separation while merchant-controlled content runs on `*.einort.com` | Without a Public Suffix List entry, `tenant1.einort.com` can set `Domain=einort.com` cookies that reach the apex dashboard. Keep session cookies `__Host-`-prefixed, `Path=/`, no `Domain` (the cart cookie already does this); submit `einort.com` to the PSL private section |
| Upstash Redis | Caching an analytics or marketplace result without the tenant id in the key | `analytics:{tenantId}:{window}:{version}`. Public marketplace results are the only legitimately tenant-free keys — mark them as such |
| Upstash Redis | Assuming the new marketplace-search limiter throttles under outage | `createLimiter` **fails open** by documented design. Marketplace search must be survivable unthrottled |
| Resend | Designing low-stock alerts, listing-approval notices, or domain-verification emails as emails | No module under `src/` imports `resend` today. Either wire it deliberately as its own plan, or make every v2.0 notification a dashboard badge plus an ADM-05 thread message |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Every existing index is `[tenantId, ...]`-prefixed | Marketplace category/featured/trending queries do full scans; slow public pages | `MarketplaceListing` needs **non-tenant-prefixed** indexes (`@@index([state, categoryId, ...])`, `@@index([state, featuredRank])`). It is the one table where that is correct — document why in the schema comment | Noticeable in the low hundreds of listings; severe in the thousands |
| `REVENUE_WINDOW_ROW_CAP = 5000` silently truncating longer analytics windows | Chart totals quietly lower than the orders list; no error | `Order.placedOnDay` + `groupBy` (Pitfall 13) removes the cap entirely | Already a documented risk at 7 days; certain at 90/365 days |
| Unpaginated `listOrdersForMerchant` / `listStorefrontProducts` (already logged in `CONCERNS.md`) | Slow dashboard/storefront for high-volume merchants | Cursor pagination; `@@index([tenantId, state, placedAt])` already supports the keyset shape. Customers and Inventory lists must ship paginated from day one rather than adding two more unbounded lists | Hundreds of orders / unlimited-tier catalogs |
| Isolation suite is model-generic over `TENANT_SCOPED_MODELS` and already runs 22–27 min | Every v2.0 plan ends with a 40+ min test gate | v2.0 adds ~5–7 tenant-scoped models (listing, listing event, stock adjustment, delivery zone, delivery rate, custom domain, saved analytics view). Land the already-identified fix **first**: reseed per `describe` for read-only assertions, and split a `test:isolation:smoke` for per-task gates | Immediately, on the first new registered model |
| `TENANT_SCOPED_MODELS` insertion order is load-bearing | Seed fixture fails with FK violations after adding a model | The array is in FK dependency order and `seed-two-tenants.ts` drives its batched `$transaction` off it. Insert `MarketplaceListing` **after** `Product`, `StockAdjustment` after `ProductVariant`, parentless models (`CustomDomain`, `DeliveryZone`) at the end. Never re-sort | The moment a child model is inserted above its parent |
| N+1 across tenants for the marketplace grid | Marketplace page issues one query per listed store | One `marketplaceDb` query with an explicit `select` join, never a loop of `scopedDb(tenantId)` calls | Immediately, at ~20 listings |
| Redis negative-cache fill via attacker-controlled Host headers | Upstash cost/latency spike, cache thrash | Normalize + shape-validate the hostname before it becomes a cache key; cap length; only cache syntactically valid FQDNs | Any time after custom domains are public |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Public marketplace code able to reach `Order`, `PaymentClaim`, or customer PII | Cross-tenant leak of order volumes, phone numbers, revenue on an anonymous surface | `marketplaceDb` facade exposing only listing + `Organization` + explicitly `select`-ed public product fields; contract test forbidding the model names |
| `include:` instead of `select:` on a cross-tenant read | Every column added to `Product` in a future phase ships to anonymous visitors the day it is added | Explicit `select` allowlists, enforced by review and a contract test scanning for `include:` under `src/server/marketplace/**` |
| Persisting an unverified domain claim | First-writer-wins domain takeover; the real owner's traffic lands on a squatter's storefront | Verify before mapping; global unique index on the normalized hostname; resolver reads only `VERIFIED` rows |
| Derivable verification token | Any merchant can compute another merchant's challenge and self-verify | Random per-`(tenantId, hostname)` token, generated and stored server-side, exact-match compared |
| Verify once, trust forever | Expired/transferred domain stays mapped; attacker inherits a tenant's storefront and its certificate | Weekly re-verification, grace window, demote to `UNVERIFIED` on sustained failure |
| Domain left attached to the Vercel project after the DB mapping is removed | Dangling DNS: a different tenant re-adds the hostname and inherits still-pointing DNS (OWASP subdomain-takeover class) | Ordered teardown plus a reconciliation script diffing DB rows against Vercel project domains |
| I/O in `src/proxy.ts` for host→tenant lookup | DB/Redis on every request incl. prefetch; a Redis blip takes all storefronts offline; violates the file's stated contract | `classifyHost` returns `{ kind: "custom" }`; proxy rewrites to `/d/{host}`; resolution happens in the layout behind the existing cache |
| `/d/*` reachable directly on the apex | Merchant-controlled content rendered inside the apex cookie scope — the thing D-07's cookie separation depends on not happening | Same unconditional hard 404 that `/s`/`/s/*` already gets in `proxy.ts` |
| No PSL entry while merchants control `*.einort.com` content | A merchant subdomain sets a `Domain=einort.com` cookie reaching the apex dashboard and auth surface | Submit `einort.com` to the PSL private section; meanwhile `__Host-` prefix, no `Domain` attribute, `Origin`/CSRF checks on mutations |
| Shopper accounts added for "Customers" | A third tenant-identity channel; session cookies on merchant-controlled subdomains under a non-PSL apex | Customers stays a derived merchant-side view over `Order`; the hashed tracking token remains the customer-facing identity mechanism |
| Unnormalized `customerPhone` from a non-checkout write path | One human forks into two customer profiles; the Overview "new customers" set-difference silently miscounts | Move `normalizeCameroonMsisdn()` into `placeOrder`; backfill; assert the normalized-form predicate in the isolation suite |
| Analytics query whose only tenant discriminator is a nested relation filter | The extension stamps the top-level `where` only — such a query is unscoped in spirit | Every analytics aggregate starts from a registered tenant-scoped model; nested relation filters are additional constraints, never the tenant boundary |
| Marketplace listing count / merchant directory leaking store existence | Undermines the deliberate "suspended and never-existed are indistinguishable" ambiguity | Marketplace shows only listings passing `marketplaceVisibilityWhere`; no total-store counts, no enumerable ids |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "Connected" shown as soon as the TXT record verifies | Merchant announces their domain; visitors get a TLS error or 404 for hours | Three-state progress (Ownership verified → DNS pointed → Certificate issued) with a poll and honest per-state copy |
| DNS instructions that assume a registrar UI the merchant does not have | Cameroonian merchants on registrars without apex A-record support get stuck with no path | Show both apex-A and `www`-CNAME paths, name the exact record type/name/value, offer a copy button, and route "my registrar can't do this" to the ADM-05 thread |
| Inventory showing only "stock" while pending claims hold units | Merchant sees stock drop with no sales, then jump back on rejection; assumes a bug | Show **Available** and **Reserved** side by side, with a one-line explanation of the payment-claim hold |
| Low-stock alerts firing on reserved-not-sold units | Alert fatigue during any claim backlog | Compute low-stock on Available with Reserved visible; consider suppressing alerts while an order for that variant is in `PAYMENT_PENDING` |
| Marketplace card price differing from the storefront price on click-through | Immediate trust loss; the shopper assumes bait-and-switch | Reference-not-duplicate (Pitfall 4) makes them the same number by construction |
| Auto-hiding listings on plan expiry with no explanation | Merchant sees traffic vanish and does not know why | Dashboard banner naming the cause, the affected listing count, and the exact action to restore |
| Auto-deleting listings above a reduced plan cap | Unrecoverable data loss that reads as a bug | Hide the excess, let the merchant choose which to keep |
| Marketplace "Add to cart" carried over from the prototype | Structurally impossible here; a dead-end for the shopper | Discovery only, with a clear "View in store" hand-off |
| Analytics and Overview showing different revenue | Merchant stops trusting all numbers in the product | One shared metrics module plus an equivalence test |

---

## "Looks Done But Isn't" Checklist

- [ ] **Marketplace cross-tenant reads:** often missing a dedicated read-only facade — verify no marketplace file imports `adminDb` or `scopedDb`, and that the facade exposes no write operations at the type level
- [ ] **Marketplace queries:** often use `include:` — verify every relation traversal uses an explicit `select` allowlist
- [ ] **Marketplace visibility:** often stored — verify a suspended store, an expired trial, a lapsed subscription, a deactivated product, and an expired listing each disappear from the public marketplace **with the cron disabled**
- [ ] **Listing removal:** often cascades — verify removing/pausing/rejecting/expiring a listing leaves `Product`, `ProductVariant`, and `ProductImage` byte-identical (assert row hashes before/after in an isolation test)
- [ ] **Plan downgrade:** often traps the merchant — verify a read-only (expired-trial) merchant can still pause and remove their own listings and disconnect their domain
- [ ] **Custom domain:** often trusts the provider — verify a domain with **no** TXT record is rejected by EINORT even when Vercel reports `verified: true`
- [ ] **Custom domain:** often verify-once — verify a `lastVerifiedAt` column exists, a re-verification job runs, and removing the TXT record eventually demotes the mapping
- [ ] **Custom domain teardown:** often partial — verify disconnect clears the Redis entry, the DB row, the Vercel project domain, and the Vercel account domain, in that order, and is safely re-runnable
- [ ] **Proxy:** often grows I/O — verify `src/proxy.ts` still imports only `next/server` and `@/server/tenant/host`, and that `/d/*` hard-404s on the apex
- [ ] **Customers:** often introduces auth — verify no new session/cookie/login surface and that `Order.customerName`/`customerPhone` remain non-nullable snapshot columns
- [ ] **Customers:** often has a fork — verify every `Order.customerPhone` in the DB is in normalized MSISDN form, including rows written before this milestone
- [ ] **Inventory:** often races — verify an absolute stock write is a compare-and-swap and that a concurrent checkout + merchant save cannot resurrect a sold unit (add a case to `stock-race.test.ts`)
- [ ] **Inventory:** often mislabels — verify the ledger's UI copy matches what it actually records (manual adjustments only vs. all movements)
- [ ] **Inventory:** often forgets the gate — verify stock adjustment goes through `merchantAction({ mode: "write" })` and is refused for an expired trial via a direct POST, not just a disabled button
- [ ] **Delivery:** often trusts the client — verify no checkout schema accepts a fee, that `totalXaf = subtotalXaf + deliveryFeeXaf` is asserted, and that the manual-transfer amount, USSD string, WhatsApp message, tracking page, and claim-review screen all render the same integer
- [ ] **Delivery:** often joins live — verify changing a `DeliveryRate` does not change any placed order's total
- [ ] **Analytics:** often redefines — verify `EARNED_STATES`, `OPEN_STATES`, `DOUALA_UTC_OFFSET_MINUTES` and `bucketByDay` exist in exactly one module, imported by both Overview and Analytics
- [ ] **Analytics:** often disagrees — verify an automated test asserts Overview revenue == Analytics revenue for the same window, and that the `unitsSold` state-filter inconsistency has been resolved as a recorded decision
- [ ] **Analytics:** often truncates — verify no summed query carries a `take:` cap
- [ ] **Isolation suite:** often forgotten — verify every new tenant-scoped model is registered in `TENANT_SCOPED_MODELS` **in FK dependency order**, that the seed still runs, and that suite runtime has not crossed the point where phase gates become impractical

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| `adminDb` fence widened and a cross-tenant leak shipped | HIGH | Revert the ESLint change; audit every query written under the widened zone; assume disclosure of anything the queries could reach; introduce `marketplaceDb` and port; add the contract test that would have caught it |
| Listing snapshot duplicated product fields | MEDIUM | Drop the denormalized columns; rewrite reads as joins; reconcile any listing whose stored price already diverged (a merchant-visible correction, not a silent fix) |
| Product deleted/deactivated by listing removal | HIGH | `OrderItem` snapshots mean order history survives, but catalog rows do not. Restore from a Neon branch/PITR; add the FK `onDelete: Restrict` and the contract test before re-enabling the path |
| Unverified domain claim exploited | HIGH | Immediately demote all `PENDING` mappings to non-resolving; force re-verification for every existing domain; remove orphaned Vercel project domains; disclose to affected merchants |
| Stale verification exploited after a domain transfer | MEDIUM | Unmap, remove from Vercel, notify both the previous merchant and (if identifiable) the new owner; ship the re-verification job before re-enabling custom domains |
| Absolute stock write resurrected sold units | MEDIUM | Reconcile against `OrderItem` sums for orders with `stockHeld: true`; the audit trail (`OrderEvent`) reconstructs what was actually sold; fix the write shape before reopening the page |
| Analytics and Overview shipped with different revenue definitions | LOW–MEDIUM | Extract the shared module, pick the correct definition, add the equivalence test, and tell merchants a number changed and why — silently changing a revenue figure is worse than the original bug |
| `TENANT_SCOPED_MODELS` re-sorted and the seed broken | LOW | Restore FK dependency order; the failure is loud and immediate (the batched `$transaction` fails), so no data is at risk |
| Isolation suite grown past practical runtime | LOW | Apply the already-identified fixes: per-`describe` reseed for read-only assertions, `test:isolation:smoke` for per-task gates, full matrix for per-plan gates |

---

## Pitfall-to-Phase Mapping

Phase names are proposals for roadmap creation; the ordering constraints are the load-bearing part.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. `adminDb` fence widened for Marketplace | **Marketplace Foundations** (first plan) | `marketplaceDb` facade exists with read-only getters; ESLint fences both directions; contract test forbids `adminDb`/`Order`/`PaymentClaim` under `src/server/marketplace/**` |
| 2. Stored listing visibility | **Marketplace Foundations** (builder) → **Marketplace Marketing** (consumed) | Suspend/expire/downgrade/deactivate each hide a listing with the cron disabled; unit test pins the builder against `resolveEntitlements` |
| 3. Downgraded merchant locked out of retraction | **Marketplace Marketing** | An expired-trial merchant can pause and remove listings; allowlist contract test on the `retract` mode |
| 4. Listing duplicating product data | **Marketplace Marketing** (schema plan) | `MarketplaceListing` has no display columns; isolation test asserts product rows unchanged after every listing lifecycle transition |
| 5. Unverified domain claim persisted | **Domains** (schema + verification plan) | Domain with no TXT is rejected despite Vercel `verified: true`; global unique index on hostname; resolver filters `VERIFIED` internally |
| 6. Verify-once / two-system delete | **Domains** | `lastVerifiedAt` + scheduled re-verification; ordered idempotent teardown; reconciliation script reports zero drift |
| 7. I/O in `proxy.ts` | **Domains** (first plan) | `proxy.ts` import list unchanged; `/d/*` hard-404s on apex; hostname normalized before caching |
| 8. Shopper accounts for "Customers" | **Customers** (recorded as a Key Decision at roadmap time) | No new auth surface; `Order` snapshot columns intact; normalized-MSISDN predicate asserted across all rows |
| 9. Absolute stock write races the hold | **Inventory** (first plan) | Compare-and-swap or relative-only writes; `single-stock-writer` contract test; new concurrent case in `stock-race.test.ts` |
| 10. Second stock balance / unreconcilable ledger | **Inventory** | No second quantity column; ledger scope matches its UI label; Available and Reserved shown separately |
| 11. Delivery fee not re-derived/snapshotted | **Delivery** (must precede or accompany Analytics) | No fee in any checkout schema; `totalXaf = subtotalXaf + deliveryFeeXaf` asserted; one integer across all customer-facing amount surfaces |
| 12. Analytics as a second source of truth | **Analytics** (first plan) | One shared metrics module; Overview↔Analytics equivalence test green; `unitsSold` inconsistency resolved as a recorded decision |
| 13. Raw query / `adminDb` for aggregation | **Analytics** (schema plan) | `Order.placedOnDay` + backfill; zero `eslint-disable` for `no-restricted-syntax`; no `take:` on summed queries; tenant id in every cache key |
| 14. Personalization on the public marketplace tree | **Marketplace Foundations** | Contract test forbids `requireMerchantContext`/session/`scopedDb` under `src/app/(marketplace)/**`; anonymous browsing never redirects |
| 15. Marketplace-level cart/checkout | **Marketplace Foundations** (explicit non-goal in phase context) | No cart/checkout import under marketplace; cart cookie still has no `Domain`; `placeOrder` signature unchanged |
| 16. Moderation with no moderator | **Marketplace Marketing** (decision in phase context) | Every listing state has a reachable exit; lifecycle modeled as a transition table + single writer + event log; expiry derived, not written |

**Cross-cutting, not owned by any feature phase — schedule explicitly:**

| Concern | Recommended placement |
|---------|----------------------|
| Isolation-suite runtime fix before ~6 new models are registered | A short foundations/hygiene phase **before** the first v2.0 schema phase |
| `einort.com` PSL submission (long lead time — maintainer review + browser rollout) | Start during the Domains phase; it does not gate the phase but the clock should be running |
| Postgres RLS as a defence-in-depth backstop (already recommended in `CONCERNS.md`) | Its value rises sharply once a public cross-tenant read path exists. Worth reconsidering for this milestone rather than "before scaling past pilot" |
| Cursor pagination for Customers/Inventory/Analytics lists | Inside each feature phase — do not add three more unbounded `findMany`s to the two already logged |

---

## Sources

**Codebase (HIGH confidence — read directly, 2026-09-13):**
- `src/server/db/tenant-scoped.ts` — extension mechanics, `TENANT_SCOPED_MODELS` insertion-order contract, documented nested-write and raw-query holes
- `src/server/orders/stock.ts` — conditional-decrement hold, `stockHeld` claim-before-increment, deadlock-ordering rule, "do not upgrade this"
- `src/server/dashboard/queries.ts` + `buckets.ts` — `EARNED_STATES`/`OPEN_STATES`, the `unitsSold` state-filter inconsistency, `REVENUE_WINDOW_ROW_CAP`, `groupBy(["customerPhone"])` customer derivation, Douala offset reasoning
- `src/server/tenant/host.ts`, `src/proxy.ts` — `classifyHost` fail-closed table, no-I/O contract, `/s/*` hard 404, header stripping
- `prisma/schema.prisma` — `Organization` (`status`, `planTier`, `trialEndsAt`, `subscriptionStatus`), `ProductVariant.stock` as the sole balance, `Order`/`OrderItem` snapshot columns, composite `[tenantId, id]` FK pattern, global unique constraints
- `src/server/entitlements/plans.ts` — D-07 register-limits-now discipline, `Readonly<Record<PlanTier, …>>` drift detection
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`

**External (MEDIUM–HIGH):**
- [Vercel — Configuring Custom Domains (multi-tenant platforms)](https://vercel.com/docs/multi-tenant/domain-management) — last updated 2026-08-25; TXT-only-on-conflict verification behaviour, SDK add/verify/remove flow, wildcard-requires-nameservers, Public Suffix List guidance and `__Host-` cookie advice
- [Vercel — Working with domains](https://vercel.com/docs/domains/working-with-domains) and [Troubleshooting domains](https://vercel.com/docs/domains/troubleshooting) — apex A record vs subdomain CNAME, certificate issuance after DNS verification
- [OWASP — Subdomain Takeover Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Subdomain_Takeover_Prevention_Cheat_Sheet.html) and [OWASP WSTG — Test for Subdomain Takeover](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/10-Test_for_Subdomain_Takeover) — dangling-DNS and decommissioning-order guidance
- [Microsoft Learn — Prevent dangling DNS entries and avoid subdomain takeover](https://learn.microsoft.com/en-us/azure/security/fundamentals/subdomain-takeover) — per-subscription TXT binding as the anti-takeover primitive (the model for the `_einort-verify` design)
- [OWASP — Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) — cross-tenant aggregation as its own engineering problem
- [Public Suffix List — Guidelines](https://github.com/publicsuffix/list/wiki/Guidelines) — private-section submission criteria

**Confidence caveats:**
- Vercel SDK function names and the exact conditions under which `verified` is returned were read from the Aug 2026 docs page, not exercised against the live API. Confirm the response shape in the Domains phase's first spike before designing UI states around it. (MEDIUM)
- The `unitsSold` state-filter inconsistency is read directly from source and is HIGH confidence as an observation, but whether the *intended* behaviour is filtered or unfiltered is a product decision, not a research finding.
- Whether `WHATSAPP`-channel checkouts persist an `Order` row (and therefore a `customerPhone`) was not verified; it materially affects Customers coverage and should be checked in the Customers phase's first plan.

---
*Pitfalls research for: v2.0 Marketplace / Marketing / Customers / Inventory / Delivery / Domains / Analytics on EINORT-Commerce*
*Researched: 2026-09-13*
</content>
</invoke>
