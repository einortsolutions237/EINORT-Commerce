# Project Research Summary

**Project:** EINORT-Commerce — v2.0 milestone (Design Parity + Marketplace/Marketing Build-out)
**Domain:** Multi-tenant commerce SaaS for Cameroonian SME merchants, integrating 7 new capability areas (Marketplace, Marketplace Marketing, Customers, Inventory, Delivery, Domains, Analytics) into an existing Next.js 16 / Prisma 7 / Postgres modular monolith
**Researched:** 2026-09-13
**Confidence:** HIGH

## Executive Summary

This is architecture *integration* research, not greenfield research — the existing codebase (structurally-enforced tenant isolation via a three-tier Prisma Client Extension split: `scopedDb` / `platformDb` / `adminDb`) is treated as fixed and correct, and six of the seven new v2.0 areas (Customers, Inventory, Delivery, Analytics, Marketplace Marketing, Domains-as-a-merchant-feature) are ordinary extensions of that pattern requiring no new abstractions. At the stack layer, the milestone needs almost no new dependencies — one npm package (`tldts`) — because Vercel's own Domains API handles DNS/TLS entirely, `pg_trgm` plus existing Prisma `contains` filters handle marketplace search, and Postgres aggregates plus one daily rollup table handle analytics, all without touching the codebase's hard bans on `$queryRaw`/raw SQL or a warehouse/search-engine dependency.

**The single highest-confidence, highest-impact finding, independently reached by all four research passes (stack, features, architecture, pitfalls): the public Marketplace browsing surface has no legal path into the database under the existing three-client split.** `scopedDb` requires a `tenantId` (the Marketplace has none — it is anonymous and apex-hosted); `platformDb` is a narrow allowlist of registry tables; `adminDb` is unscoped and ESLint-fenced to `src/server/admin/**`, a zone whose owning feature (Platform Admin) is explicitly deferred this milestone, and which is also forbidden from importing tenant-scoped modules. Every research pass independently proposed the same fix under the same name: a fourth client, `marketplaceDb` — a read-only Prisma Client Extension, ESLint-fenced to `src/server/marketplace/**`, exposing only read operations over an explicit model+column allowlist with an unconditional published-and-active predicate baked in. This is not an implementation detail to defer to the Marketplace phase's plan — it is a foundational decision that gates every other marketplace-adjacent feature (Marketplace Marketing has nothing to list into until it exists) and it is the single largest tenant-isolation risk in the milestone. The wrong shortcut — widening `adminDb`'s fence instead of building a fourth client — is flagged as the #1 critical pitfall across research: it looks like a two-line ESLint diff but converts the platform-owner-only unscoped client into something reachable from an anonymous, crawler-hit, public route.

**The second cross-cutting blocker, also raised independently by multiple researchers, is that Marketplace Marketing is a second, independently-priced and independently-expiring subscription that the existing entitlement model cannot represent.** `resolveEntitlements(org, now)` is a pure function of scalar fields on one `Organization` row (`planTier`, `subscriptionStatus`, `trialEndsAt`). A second product — its own price, capacity, status, and expiry — has nowhere to live in that shape. This is not a detail internal to the Marketing phase: fixing it changes `resolveEntitlements`'s signature, which touches `merchantAction`, `requireMerchantContext`, and every gated Server Action in the codebase. Both FEATURES.md and ARCHITECTURE.md call this the single largest hidden cost in the entire milestone, invisible from the feature description, and it needs to be sequenced and decided early (dedicated `MarketplaceSubscription` model vs. a generalized `Subscription` table) rather than discovered mid-build. A related, still-unresolved gap: Marketplace Marketing's "Pending Review" lifecycle state implies a moderator, but Platform Admin (the natural home for a moderation queue) is deferred out of v2.0 — this must be named explicitly in the roadmap (recommended: route through the existing ADM-05 merchant-platform support thread, or a single minimal page in the pilot-scoped Super Admin) or the feature ships with a dead-end state nobody can move a listing out of.

Beyond those two structural blockers, the remaining risk is concentrated in two places: Domains (the only area that touches 100% of request traffic, requires an architectural extension to the zero-I/O proxy, and depends on external DNS/TLS mechanics with well-documented takeover failure modes — verify-once-trust-forever, first-writer-wins squatting, dangling teardown), and money-path sequencing (Inventory must consolidate the stock writer before Delivery and Customers each edit `placeOrder`, and Delivery must land before Analytics or "revenue" gets defined against a `totalXaf` that doesn't yet include delivery fees). All four research files converge on the same recommended build order: Inventory then Delivery then Customers then Analytics then Marketplace Marketing then Marketplace then Domains (last, because it is fully independent and is the only area with external wall-clock dependencies and full-traffic blast radius).

## Key Findings

### Recommended Stack

Net-new npm dependencies for the entire milestone: one (`tldts`, for domain/PSL validation). Everything else is schema, migration, and code reusing existing idioms. Custom domains and TLS are handled entirely by Vercel's own Domains REST API (hand-written ~120-line fetch client, not the 41.7 MB `@vercel/sdk`) — Vercel auto-issues and auto-renews certificates, so there is no ACME/cert-provider work at all. Marketplace search uses `pg_trgm` plus GIN indexes over the existing Prisma `contains`/`mode: "insensitive"` pattern — zero query-shape change, and it is the one thing that makes unindexed cross-tenant discovery search viable within the repo's hard ban on `$queryRaw`. Analytics extends the existing `aggregate`/`groupBy` idiom plus one denormalized daily rollup table (`StoreDailyStat`) written by a Vercel Cron Job, with no chart library (the codebase already hand-rolls SVG charts on purpose) and no warehouse.

**Core technologies:**
- **Vercel Domains REST API** (raw `fetch`, Zod-parsed responses) — programmatic add/verify/poll/remove of custom domains against the existing production project; TLS lifecycle disappears as a work item entirely.
- **`tldts` 7.4.12** — the only new dependency; validates merchant-submitted domains (public-suffix rejection, apex-vs-subdomain classification), server-only import.
- **PostgreSQL `pg_trgm` + GIN indexes** — index-backed substring search for the marketplace's unavoidable cross-tenant `ILIKE '%q%'` queries, declared via Prisma's `raw("gin_trgm_ops")` (expression indexes like `tsvector` are explicitly not declarable in Prisma and are ruled out for that reason).
- **Next.js `after()`** — fire-and-forget write-path counters (listing impressions, cart-created) with zero added latency, no queue/workflow product needed.
- **Vercel Cron Jobs** — nightly rollups; must be designed idempotent and daily-safe because Hobby plan caps cron at once/day (a real product-tier decision to confirm before Domains is scheduled).

### Expected Features

All seven v2.0 areas are in scope; the research's core discipline is not which features but which version of each — every area has an "obvious Shopify-shaped" version that is 5-20x the necessary work, and the recommendations are deliberately biased toward the minimal version a Douala SME merchant would actually notice.

**Must have (table stakes), condensed to the "minimum viable" bar per area:**
- **Marketplace:** category/featured/recent rails, substring search (no ranking), listing detail that re-reads the canonical product live and CTAs out to the merchant's own storefront, merchant profile page, click tracking. Discovery only — no cart, no checkout, ever.
- **Marketplace Marketing:** add-on activation, product-picker (never a "create listing product" form), capacity counter, submit/pause/resume/withdraw lifecycle, a platform-side approve/reject page with a reason field, per-listing views/clicks, derived (not stamped) expiry.
- **Customers:** auto-created from checkout on normalized phone (never manually typed), searchable list plus detail plus order history, click-to-WhatsApp/call.
- **Inventory:** stock levels view with low/out-of-stock filters, one `adjustStock` writer (set-to and adjust-by), fixed reason-code enum, append-only adjustment ledger, one store-wide low-stock threshold.
- **Delivery:** merchant-defined named zones with flat fees (3-10 zones, Douala presets), free-delivery threshold, pickup-in-store, fee shown before commitment and snapshotted onto the order.
- **Domains:** one custom domain per store (plan-gated), A/CNAME instructions with copy buttons, async status polling with manual re-check, automatic TLS, apex+www with redirect, remove/replace.
- **Analytics:** one page — period selector with previous-period comparison, revenue/orders/AOV/units cards on one explicit revenue definition, one daily chart, top products, state/channel breakdown, CSV export.

**Should have (differentiators):** referral attribution turning marketplace clicks into "attributed orders" (the renewal argument for the paid add-on); payment-channel/COD reliability signals (no competitor in this market segment surfaces this); WhatsApp-shareable weekly summaries; "verified merchant" badge derived live from subscription status (never a stored boolean).

**Defer / anti-features (explicitly rejected, with reasons that recur across every area):** marketplace cart/checkout (forbidden by spec, would make the platform merchant-of-record with no gateway); shopper accounts/logins anywhere (checkout is deliberately guest-only; would add a third tenant-identity channel); CPC/auction marketplace ads, multi-warehouse inventory, carrier API integration, weight-based delivery rate tables, session/funnel/cohort analytics, conversion-rate as a headline metric, profit/margin reporting — all rejected as ERP/Shopify-shaped completeness that doesn't fit either the market reality (informal supply chains, moto-driver delivery, COD) or the product's stated non-goals.

### Architecture Approach

The existing architecture absorbs six of the seven areas with zero new abstractions — they are ordinary tenant-scoped domains plugging into `scopedDb` plus `merchantAction()` plus a `/dashboard/{area}` route. Two areas break the model and require deliberate new components: Marketplace (first cross-tenant, no-tenant-identity-at-all read — needs `marketplaceDb`, detailed above) and Domains (the zero-I/O proxy cannot resolve an arbitrary custom hostname to a tenant without a DB lookup). The recommended resolution for Domains preserves the proxy's documented zero-I/O contract exactly: `classifyHost()` gains a fourth, still-pure `custom` kind (a syntactic check only), and the proxy rewrites to a sentinel path segment (`/s/@{host}`) that the existing `/s/[slug]/layout.tsx` resolves via a new `resolveTenantByDomain()` sibling of `resolveTenantBySlug()` — reusing the whole storefront route tree, the existing Redis cache pattern, and the existing fail-closed posture, with zero new route tree and zero I/O added to the proxy itself.

**Major new components:**
1. **`marketplaceDb`** (`src/server/db/marketplace.ts`) — read-only, cross-tenant, published-only Prisma Client Extension; the one sanctioned door into other tenants' listings; ESLint-fenced bidirectionally (marketplace code cannot import `adminDb`/`scopedDb`, and nothing outside `src/server/marketplace/**` can import it).
2. **Listing lifecycle state machine** (`src/server/marketing/state-machine.ts`, `src/server/marketing/transition.ts`) — mirrors the existing `ORDER_TRANSITIONS`/`canTransition`/single-writer pattern exactly, but keyed on `(actor, from, to)` rather than `(channel, from, to)`, because a merchant and the platform have different transition rights (self-approval must be structurally impossible).
3. **Consolidated stock writer** (`src/server/inventory/write.ts`) — absorbs today's two uncoordinated `ProductVariant.stock` writers into one atomic/conditional writer paired with an append-only `StockAdjustment` ledger, closing the race `holdStockForLines` currently protects alone.
4. **Pure delivery quote function** (`src/server/delivery/quote.ts`) — `(settings, zone, subtotalXaf) -> feeXaf`, mirroring `resolveEntitlements`'s pure-function shape so the fee can never be accepted from the client.
5. **Domain resolver plus Vercel client** (`src/server/tenant/resolve-domain.ts`, `src/server/domains/vercel.ts`) — Redis-cached hostname-to-tenant lookup (own namespace) plus a thin, fail-loud wrapper over four Vercel endpoints.

### Critical Pitfalls

1. **Widening `adminDb`'s ESLint fence to serve the Marketplace, instead of building a fourth client.** Reads as a harmless two-line config diff but makes the platform-owner-only unscoped client reachable from an anonymous public route. Fix: build `marketplaceDb` as the milestone's first Marketplace plan, before any marketplace UI exists.
2. **Marketplace visibility stored as a boolean flipped by a cron.** A stored `isVisible`/`status='EXPIRED'` column drifts from `resolveEntitlements` and fails open during any cron outage (suspended stores stay visible; re-subscribed merchants stay hidden). Fix: export a `marketplaceVisibilityWhere(now)` predicate builder from the entitlements module, pinned to `resolveEntitlements` by a unit test; cron becomes a housekeeping nicety, not a correctness dependency.
3. **A downgraded/expired-trial merchant locked out of retracting their own public listings.** `merchantAction({mode:"write"})` blocks all writes on `canWrite: false`, including safety writes like "pause my listing" — silently orphaning public content the merchant can no longer control. Fix: a third `merchantAction` mode (`"retract"`) allowlisted to footprint-reducing actions only.
4. **Snapshotting product display data onto the listing** (applying the `OrderItem` snapshot-on-write instinct where it's wrong). A listing is a live pointer, not a record of the past — it must reference `Product`/`ProductVariant` at render time via `select`-allowlisted joins, never carry its own name/price/image, or marketplace and storefront prices will visibly drift and "delete listing" will start to feel like "delete product."
5. **Persisting an unverified custom-domain claim and trusting Vercel's `verified: true` as ownership proof.** Vercel's TXT challenge fires only on conflict with another Vercel account — an unclaimed domain "verifies" with zero proof of who owns it, enabling first-writer-wins takeover. Fix: EINORT's own randomly-generated, per-`(tenantId, hostname)` TXT challenge, verified via exact-match `dns/promises` lookup, before any Vercel API call; plus scheduled re-verification and an ordered, idempotent 4-system teardown on removal (Redis to DB to Vercel project to Vercel account).

## Implications for Roadmap

Based on combined research, all four documents converge on the same dependency-driven build order. Suggested phase structure:

### Phase 1: Inventory
**Rationale:** Smallest area, touches no `Order` schema, and reduces risk for every subsequent phase by consolidating `ProductVariant.stock` into one sanctioned writer before Delivery and Customers each edit `placeOrder`.
**Delivers:** Stock levels view, `adjustStock` writer (relative + compare-and-swap absolute), reason-code enum, append-only `StockAdjustment` ledger, low-stock threshold + indicator.
**Addresses:** Inventory table-stakes from FEATURES.md.
**Avoids:** Pitfall 9 (absolute stock write races the conditional-decrement hold) and Pitfall 10 (second stock balance / unreconcilable ledger) — both closed with a `single-stock-writer` contract test in this phase's first plan.

### Phase 2: Delivery
**Rationale:** Must precede Analytics (delivery fees change what "revenue" means) and should be the last edit to `placeOrder` before Customers, since both touch the same transaction and Delivery's edit is the money-math one.
**Delivers:** Zone table with Douala presets, flat fees, free-delivery threshold, pickup option, fee snapshotted onto `Order` (`deliveryFeeXaf`, `deliveryZoneName`), delivery-promise text.
**Uses:** Pure `quoteDelivery(settings, zone, subtotalXaf)` pattern from ARCHITECTURE.md, mirroring `resolveEntitlements`'s zero-I/O shape.
**Implements:** The `Order` schema additions and the "never accept a fee from the client" rule from PITFALLS.md Pitfall 11.

### Phase 3: Customers
**Rationale:** Depends on the `Order` shape being final; the customer upsert must be the last edit inside the existing `placeOrder` transaction.
**Delivers:** Auto-created `Customer` rows keyed on normalized phone, searchable list, detail with order history, WhatsApp/call buttons, nullable `Order.customerId` backfill.
**Addresses:** Customers table-stakes from FEATURES.md.
**Avoids:** Pitfall 8 (shopper accounts added because the feature is named "Customers") — this must be a Key Decision recorded explicitly, not left implicit.

### Phase 4: Analytics
**Rationale:** Pure read layer, cheapest once the `Order` schema has settled post-Delivery/Customers; expensive to redo if built against a pre-delivery `Order`.
**Delivers:** One analytics page — revenue/orders/AOV/units cards on one explicit, shared revenue definition, daily chart, top products, state/channel breakdown, CSV export.
**Addresses:** Analytics table-stakes from FEATURES.md.
**Avoids:** Pitfall 12 (Analytics as a second, drifting source of truth) and Pitfall 13 (reaching for raw SQL/`adminDb` for `date_trunc`) — extract `EARNED_STATES`/`OPEN_STATES`/bucketing into one shared module first, and add `Order.placedOnDay` for index-backed `groupBy`.

### Phase 5: Marketplace Marketing (merchant-side listing lifecycle)
**Rationale:** Its stated dependencies (product catalog, entitlements) already exist, so it can start any time after Phase 1 — but must precede Phase 6, since the public Marketplace has nothing real to render or test against otherwise. This phase must also resolve the second-subscription entitlement problem and the moderation-queue gap as explicit roadmap decisions before schema design, not as details discovered mid-phase.
**Delivers:** Add-on activation, product picker, listing lifecycle (`DRAFT`/`PUBLISHED`/`PAUSED`/`EXPIRED` only — no unreachable `PENDING_REVIEW`/`REJECTED` states without a moderator), capacity enforcement, platform approve/reject surface, views/clicks.
**Addresses:** Marketplace Marketing table-stakes; the entitlement-model rework flagged as the milestone's single largest hidden cost.
**Avoids:** Pitfall 3 (retraction lockout), Pitfall 4 (listing duplicates product data), Pitfall 16 (moderation with no moderator).

### Phase 6: Marketplace (public discovery surface)
**Rationale:** Needs listings to exist to be testable/renderable. This is also where the `marketplaceDb` fourth client and its ESLint zone get built — do it while the listing model is settled, not before.
**Delivers:** Home rails, category browse, substring search (`pg_trgm`), listing detail (live-joined, never snapshotted), merchant profile page, click tracking, the reserved-slug additions (`marketplace`, `discover`, etc.).
**Addresses:** Marketplace table-stakes from FEATURES.md.
**Avoids:** Pitfall 1 (adminDb fence widening — the milestone's #1 flagged risk), Pitfall 2 (stored visibility boolean), Pitfall 14 (personalization/session code leaking onto the public route tree), Pitfall 15 (marketplace cart/checkout).

### Phase 7: Domains
**Rationale:** Fully independent of the other six — nothing depends on it and it depends on nothing. Deliberately last because: (a) it is the only area needing external account setup (Vercel token, a real test domain) and DNS-propagation wall-clock slack; (b) it is the only area touching the request path for 100% of traffic, so isolating it at the end keeps a regression there from contaminating six other in-flight areas; (c) PROJECT.md already treats custom domains as cuttable/fast-follow.
**Delivers:** One custom domain per store (plan-gated), A/CNAME instructions with copy buttons, on-demand status polling plus manual re-check, automatic TLS via Vercel, apex+www with redirect, globally-unique domain table with holder history, ordered teardown.
**Uses:** Vercel Domains REST API (hand-written client), `tldts`, `dns/promises` for EINORT's own ownership verification.
**Avoids:** Pitfall 5 (unverified claim trusted as ownership), Pitfall 6 (verify-once-trust-forever / dangling two-system delete), Pitfall 7 (I/O added to the zero-I/O proxy).

### Phase Ordering Rationale

- Money-path sequencing is non-negotiable: Inventory, then Delivery, then Customers all edit the same safety-critical `placeOrder` transaction; doing them in this order means each edit lands once, on a settled base, rather than as rework. Analytics must follow Delivery specifically because delivery fees change the definition of "revenue," and building charts against a pre-delivery `Order` is expensive to unwind after the fact.
- The two structural blockers (`marketplaceDb`, second-subscription entitlements) must be resolved as roadmap-level decisions before Phases 5-6 are planned in detail, not discovered during implementation — both are called out by name in STACK.md, FEATURES.md, ARCHITECTURE.md, and PITFALLS.md independently, which is the strongest possible convergence signal in this research set.
- Domains is intentionally last despite having zero technical dependency on the other six, purely because of its full-traffic blast radius and external-dependency wall-clock risk — a deliberate risk-isolation choice, not a technical requirement. It could be pulled forward (e.g., run in parallel by a second builder) without breaking anything.
- The moderation-queue gap and the second-subscription entitlement model are the two items most likely to cause mid-phase scope renegotiation if not resolved explicitly at roadmap time — both are flagged as unresolved open questions across multiple research files.

### Research Flags

Phases likely needing deeper research during planning (`/gsd:plan-phase --research-phase <N>`):
- **Phase 5 (Marketplace Marketing):** the entitlement-model rework (`resolveEntitlements` signature change touching `merchantAction` and every gated action) and the moderation-queue placement decision are both genuinely open design questions, not just implementation details — confirm the chosen shape before schema design.
- **Phase 6 (Marketplace):** the `marketplaceDb` Client Extension shape is a design proposal extrapolated from `scopedDb`'s construction (MEDIUM confidence in ARCHITECTURE.md, not externally verified) — validate the extension mechanics (read-only enforcement, predicate injection) against a running Prisma 7 client early in the phase.
- **Phase 7 (Domains):** highest external-dependency risk in the milestone — Vercel plan tier (Hobby vs Pro) must be confirmed before scheduling (50-domain cap, once-daily cron), and the sentinel-segment proxy rewrite (`/s/@{host}`) should be spiked against a running Next 16 app before committing to it as the routing shape.

Phases with standard, well-documented patterns (safe to skip research-phase):
- **Phase 1 (Inventory):** the single-sanctioned-writer plus append-only-ledger pattern already exists twice in this codebase (`Order.state`/`OrderEvent`, `stockHeld`/conditional decrement) — this is direct pattern reuse, HIGH confidence.
- **Phase 2 (Delivery):** the pure-quote-function plus snapshot-on-write pattern directly mirrors `resolveEntitlements` and `OrderItem`'s existing snapshot columns.
- **Phase 3 (Customers):** the "derived view over `Order`, no new auth surface" approach is already partially implemented (`overviewMetrics`'s `groupBy(["customerPhone"])`); this phase is an extension, not new design.
- **Phase 4 (Analytics):** pure extraction/reuse of `dashboard/queries.ts` and `dashboard/buckets.ts` plus one new rollup column — no new architectural pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Vercel Domains API behavior, Prisma index/FTS capabilities, and Next 16 primitives (`after()`, `revalidate`) all verified against current official docs and in-repo source; only the pg_trgm-at-pilot-scale performance judgement is a scale estimate (MEDIUM) rather than a documented fact |
| Features | MEDIUM-HIGH | Existing-system constraints read directly from source (HIGH); Vercel/DNS mechanics and Shopify's listing-as-publication model verified against official docs (HIGH); Cameroon-specific market claims (addressing conventions, directory-vs-marketplace conversion dynamics, shared-handset prevalence) are single-source or inferential (MEDIUM/LOW) and flagged as such throughout FEATURES.md |
| Architecture | HIGH for existing-system facts (verified by reading `prisma/schema.prisma`, `src/server/db/*`, `src/proxy.ts`) and for Vercel domain mechanics (official docs); MEDIUM for the new abstractions proposed (`marketplaceDb`'s exact extension shape, the sentinel-segment proxy rewrite, the build-order judgement calls) — these are extrapolations of existing in-repo patterns, not externally verified |
| Pitfalls | HIGH for codebase-specific pitfalls (read directly from `tenant-scoped.ts`, `orders/stock.ts`, `dashboard/queries.ts`, `proxy.ts`, `entitlements/plans.ts`); MEDIUM-HIGH for Vercel/TLS mechanics (official docs, Aug 2026); MEDIUM for domain-takeover threat classes (OWASP/Azure guidance applied to this codebase's specific resolver design, not incident-verified against this exact stack) |

**Overall confidence:** HIGH

### Gaps to Address

- Second-subscription entitlement model shape (dedicated `MarketplaceSubscription` vs. generalized `Subscription` table) — must be decided before Phase 5 schema design; affects `resolveEntitlements`'s signature and therefore every `merchantAction`-gated write in the codebase. Flag as a Key Decision at roadmap time.
- Marketplace Marketing moderation-queue placement — no home currently exists (Platform Admin deferred). Must be named explicitly (recommended: route through the existing ADM-05 support thread) or Phase 5 ships a dead-end lifecycle state.
- Vercel plan tier (Hobby vs Pro) for the production project — determines the 50-domain cap and cron frequency ceiling; confirm before Phase 7 is scheduled in detail.
- Whether `einort.com`'s apex is already on Vercel nameservers — wildcard `*.einort.com` SSL requires it; if not already true, existing subdomain storefronts have a latent infrastructure gap independent of custom domains. Verify early.
- One shared revenue-state definition (which `Order` states count as "earned revenue," and whether `unitsSold` should be state-filtered) — currently inconsistent even in the existing `overviewMetrics` code (PITFALLS.md Pitfall 12); must be decided once and applied to Overview, Analytics, and Customers' "total spent" simultaneously.
- Better Auth session cookie's `Domain` attribute — the cart cookie is verified host-scoped with no `Domain` attribute; the session cookie was not inspected in this research round and should be audited for the same property before/during the Domains phase (Public Suffix List gap).
- Actual Douala/Yaoundé quartier list for delivery zone presets and marketplace add-on pricing/capacity-tier naming — both require direct owner/product input, not further research.

## Sources

### Primary (HIGH confidence)
- Repository source, read directly (2026-09-13): `prisma/schema.prisma`, `src/server/db/base.ts`, `src/server/db/tenant-scoped.ts`, `src/server/db/platform.ts`, `src/server/db/admin.ts`, `src/proxy.ts`, `src/server/tenant/host.ts`, `src/server/tenant/resolve.ts`, `src/server/tenant/cache.ts`, `src/server/tenant/reserved-slugs.ts`, `src/server/dashboard/queries.ts`, `src/server/dashboard/buckets.ts`, `src/server/orders/place.ts`, `src/server/orders/stock.ts`, `src/server/orders/state-machine.ts`, `src/server/orders/transition.ts`, `src/server/search/queries.ts`, `src/server/entitlements/resolve.ts`, `src/server/entitlements/plans.ts`, `src/server/payments/phone.ts`, `eslint.config.mjs`, `package.json`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONCERNS.md`, `.planning/PROJECT.md`, `CLAUDE.md`
- Vercel official docs (last updated 2026-08/09): Domains REST API / OpenAPI spec, multi-tenant platform domain-configuration guide, `/docs/limits`, `/docs/cron-jobs/usage-and-pricing`, `/docs/domains/troubleshooting`, system environment variables reference
- Prisma 7 docs (Context7 `/websites/prisma_io`): GIN operator classes via `raw()`, expression-index limitations, `postgresqlExtensions`/`fullTextSearchPostgres` preview flags
- PostgreSQL / Neon docs: `pg_trgm` mechanics and Neon extension support
- Shopify official docs: product/variant publishing and `ProductListing` — the listing-as-publication model adopted verbatim for `MarketplaceListing`
- OWASP Subdomain Takeover Prevention Cheat Sheet, OWASP Multi-Tenant Security Cheat Sheet, Microsoft Learn dangling-DNS guidance

### Secondary (MEDIUM confidence)
- Jumia vendor policy / Business Daily coverage — marketplace moderation and counterfeit-vetting practice in African markets
- Cameroon Tribune / Smarty address-format references — limited/inconsistent street addressing in Douala and Yaoundé
- Extensiv / Shopify blog — inventory adjustment audit-trail conventions
- CDP.com / Klaviyo — guest-checkout identity-resolution duplicate rates
- Affinsy / Quikly — conversion-rate distortion and vanity-metric risk at low order volumes

### Tertiary (LOW confidence, needs validation)
- Directorist/DirectoryEasy — "showing referral traffic drives paid-add-on conversion" claim (single source, treated as a hypothesis, not a fact, in FEATURES.md)
- Shared-handset prevalence in the Cameroonian market — a market inference, not a verified statistic

---
*Research completed: 2026-09-13*
*Ready for roadmap: yes*
