# Requirements: EINORT-Commerce

**Defined:** 2026-08-16
**Core Value:** A merchant picks an industry, adds a logo and a few products, and within minutes has a storefront that looks like it cost them money to build.

## v1 Requirements

### Multi-Tenant Foundations & Security

- [ ] **TEN-01**: Every tenant-scoped database table carries an indexed `tenantId` column from the first migration
- [ ] **TEN-02**: All tenant-scoped queries route through a single centralized data-access layer (Prisma Client Extension) that auto-injects `tenantId` — no route is permitted to query tenant-scoped tables directly
- [ ] **TEN-03**: Tenant identity for the storefront is resolved server-side from the request hostname only, never from client-supplied input
- [ ] **TEN-04**: Tenant identity for the merchant dashboard is resolved server-side from the authenticated session only
- [ ] **TEN-05**: Platform admin uses a deliberately separate, unscoped data-access client, isolated from the tenant-scoped layer
- [ ] **TEN-06**: Reserved subdomain slugs (e.g. `api`, `admin`, `www`) are blocked from tenant assignment
- [ ] **TEN-07**: Automated tenant-isolation tests exist and run before any milestone is considered done
- [ ] **TEN-08**: Price, stock, tenant ID, and payment/order status are never trusted from client input — always re-derived or re-validated server-side

### Marketing

- [x] **MKTG-01**: The public root page (`/`) is a real marketing landing page — not a placeholder — that explains what EINORT-Commerce does, why a Cameroonian merchant should choose it, and drives toward signup, using only honest, non-fabricated content (no invented merchant counts, logos, or testimonials)

### Onboarding

- [ ] **ONB-01**: A prospective merchant can sign up with email/password (or equivalent) and create one store
- [ ] **ONB-02**: Onboarding captures business name, industry/segment, logo upload, and brand colors
- [ ] **ONB-03**: Uploaded logos and product images pass through automatic enhancement/cropping so a low-quality photo doesn't visibly wreck the storefront
- [ ] **ONB-04**: Completing onboarding produces a live, published storefront on an EINORT subdomain within minutes, pre-populated with the selected flagship template and the merchant's own branding
- [ ] **ONB-05**: Every merchant gets a 30-day full-feature trial of their selected plan, enforced server-side, starting at signup *(updated 2026-09-13 for milestone v2.0 — was 10 days; Master Product Specification V3 names 30 days a "critical commercial rule." Code change: `TRIAL_DAYS` in `src/server/entitlements/resolve.ts`, plus every trial-day copy reference across onboarding/dashboard/pricing. **Scheduled 2026-09-13: Phase 7 (Trial & Template-Tier Business Rules).** Phase 2's original 10-day mapping remains in the traceability table as the historical record of what shipped.)*

### Storefront Templates

- [ ] **TMPL-01**: One fashion/apparel flagship template is built to genuinely polished, portfolio-quality standard, anchored on the supplied zinc-monochrome DTC visual reference
- [ ] **TMPL-02**: The flagship template's patterns (layout structure, section types, motion language, typography system) form the pattern library that other segment templates inherit from
- [ ] **TMPL-03**: At least 3 additional merchant segments (from: electronics, beauty/cosmetics, grocery/food, furniture/home, general retail) get their own structurally distinct layout — not just a recolored copy of the flagship
- [ ] **TMPL-04**: The full template library reaches 50 visually distinct variations (15 Starter / 17 Business / 18 Professional tier split) by recombining the segment layouts' sections/blocks with different imagery, color, and copy — not 50 independently designed templates *(updated 2026-09-13 for milestone v2.0 — was 10/15/25; same 50 total and same 6 segment categories, only the tier boundaries move, per Master Product Specification V3. Code change: re-tier all 50 already-built templates' plan-access assignment and update entitlement/plan-access tests. **Scheduled 2026-09-13: Phase 7 (Trial & Template-Tier Business Rules).** Phase 5's original 10/15/25 mapping remains in the traceability table as the historical record of what shipped.)*
- [ ] **TMPL-05**: Template distinctiveness is checked explicitly (side-by-side comparison) before the library is considered done — genericness is treated as a failure condition, not a subjective nice-to-have
- [x] **TMPL-06**: The template picker (onboarding and the storefront editor's "Change template" action) shows a real rendered preview image per template, not a placeholder geometric thumbnail, in a grid layout comparable to mainstream theme-store quality (owner-supplied Shopify reference)

### Storefront Editor

- [ ] **EDIT-01**: Storefront content is modeled as Theme → Page → Section → Block, with section/block types defined in code and instances (order, settings, content) stored per tenant
- [x] **EDIT-02**: Merchants can customize their storefront (reorder sections, edit block content/settings, swap images and colors) through a live-preview editor
- [x] **EDIT-03**: Editor access/capability is gated by subscription tier, enforced server-side

### Product Catalog

- [ ] **CAT-01**: Merchants can create products with images, price, simple variants, stock count, and category assignment
- [ ] **CAT-02**: Product images pass through the same automatic enhancement/aspect-ratio pipeline as onboarding logos
- [ ] **CAT-03**: Stock decrement on order placement is atomic/race-safe — concurrent orders cannot oversell the same unit

### Storefront & Checkout

- [ ] **CHK-01**: A customer can browse the storefront, view product detail, add to cart, and review an order summary without creating an account
- [ ] **CHK-02**: Checkout offers three payment paths: WhatsApp order (pre-filled cart message to the merchant's number), manual Mobile Money/Orange Money transfer, and Cash on Delivery
- [ ] **CHK-03**: The manual transfer path displays the merchant's receiving number and the exact amount, with a tap-to-dial USSD assist where technically possible (Android `tel:` deep link) and a clear manual-copy fallback (iOS)
- [ ] **CHK-04**: After sending payment, the customer submits an "I've paid" claim with a transaction reference (and optionally a screenshot)
- [ ] **CHK-05**: The customer always sees an explicit order status (e.g. "payment being confirmed") — never left uncertain whether the order was created

### Orders & Payment Claims

- [ ] **ORD-01**: Orders move through an explicit state machine: Cart → Order Placed → Payment Pending → Payment Claimed → Confirmed/Disputed → Fulfilled
- [ ] **ORD-02**: A payment claim is never auto-confirmed from the customer's self-report alone — it requires explicit merchant action
- [ ] **ORD-03**: Merchants get a Payment Claims queue showing transaction reference and screenshot per claim, with one-tap confirm/reject
- [ ] **ORD-04**: Each payment claim's transaction reference is checked for uniqueness per tenant, to catch reused/duplicate proof-of-payment
- [ ] **ORD-05**: Every state transition is recorded in an audit trail (who/what/when), not just the current status

### Domains

- [ ] **DOM-01**: Every store gets a working `{store}.einort.com`-style subdomain automatically at publish time
- [ ] **DOM-02**: Hostname-to-tenant resolution is exact and fails closed — no hostname can ever resolve to more than one store, and unrecognized hostnames do not fall through to any tenant

### Subscriptions & Entitlements

- [x] **SUB-01**: Starter, Business, and Professional plans run on one shared codebase, differentiated only by server-enforced entitlements (product limits, staff limits, editor capability, feature access) — never separate codebases or client-side-only gating
- [x] **SUB-02**: Plan limits and trial state are checked server-side on every relevant write, not just hidden/disabled in the UI
- [x] **SUB-03**: A merchant can pay their monthly subscription via manual Mobile Money/Orange Money transfer and submit proof (transaction reference + receipt image) through the merchant↔platform support thread (ADM-05); the platform owner reviews and confirms/rejects it there, activating or extending the merchant's subscription on confirmation — reuses the same manual-claim-and-verify pattern already built for customer→merchant payments (Phase 3), with payer and payee reversed. Formalizes what Phase 2's `02-CONTEXT.md` (D-09/D-10) explicitly deferred pending Phase 3's claim infrastructure.

### Merchant Dashboard

- [x] **DASH-01**: Merchant dashboard shows orders (with the Payment Claims queue surfaced prominently), products/inventory, and basic sales numbers (revenue, order count, products sold)
- [x] **DASH-02**: Dashboard answers "how is the business performing, what needs attention, what's next" at a glance

### Platform Admin (Super Admin)

- [x] **ADM-01**: Platform owner can view and suspend merchants/stores
- [x] **ADM-02**: Platform owner can view a global payment-claims ledger across all tenants
- [x] **ADM-03**: Platform owner can view domain status across tenants and has a support-contact view
- [ ] **ADM-04**: Platform admin scope stays pilot-sized (the items in this section) — the broader ~20-module admin surface referenced in prior planning docs is explicitly deferred
- [x] **ADM-05**: A merchant and the platform owner have a persistent, in-app messaging thread per merchant (text plus file/image attachments), surfaced in both the merchant dashboard and a Super Admin inbox, with an in-app badge and email nudge on a new message. No real-time/websocket infrastructure — async, check-in-when-you-can, matching the manual-first pattern already established for payment claims. This is also the channel SUB-03's subscription-payment-claim flow runs through.

## v2.0 Milestone Requirements

New requirements for milestone v2.0 (Design Parity + Marketplace/Marketing Build-out), added 2026-09-13. Driven by Master Product Specification V3 and a design-reference prototype snapshot — see `.planning/design-references/EINORT-V3-MASTER-SPEC-AND-PROTOTYPE-V6.md` and `.planning/research/SUMMARY.md`. **Mapped to phases 2026-09-13** — see the Traceability table below and `.planning/ROADMAP.md`.

### Design System & Visual Migration

- [ ] **DSGN-01**: A central design token/component layer (buttons, cards, badges, modals, page headers, status badges, pricing cards, empty states, data tables) is extracted and reused across dashboard surfaces, extending the already-shipped blue/gold/zinc token retrofit (`260823-gu4`) rather than replacing it
- [ ] **DSGN-02**: Existing real surfaces (Auth, Onboarding, Dashboard Overview, Products, Orders, Storefront Themes + Editor, Settings) are visually migrated toward the design-reference prototype's layout/interaction patterns while their real data, server actions, and auth boundaries stay unchanged
- [ ] **DSGN-03**: Responsive behavior is verified at 320/375/390/430/768/1024/1280/1440/1920px on every migrated and new surface *(mapped to Phase 8 for traceability; the "new surface" half is a standing phase-gate obligation inherited by Phases 9-15, since those surfaces do not exist when Phase 8 runs — see ROADMAP.md Phase 8 notes)*

### Marketplace (public discovery)

- [ ] **MKPL-01**: Shoppers can browse a public Marketplace home with category, featured, and recently-added rails, and paginated category browse
- [ ] **MKPL-02**: Shoppers can keyword-search active listings (substring match, no ranking)
- [ ] **MKPL-03**: A listing detail page re-reads the canonical product/variant live (never a stored snapshot) and its primary CTA lands on the merchant's own storefront product page
- [ ] **MKPL-04**: A merchant/store profile page shows store identity (logo, name, segment, city) and its active listing count
- [ ] **MKPL-05**: Marketplace read access uses a dedicated, read-only, ESLint-fenced data-access client (`marketplaceDb`) — never the unscoped admin client or an ad hoc query — with a mandatory published-and-active visibility predicate computed at query time, not a stored flag
- [ ] **MKPL-06**: The Marketplace never becomes a checkout — no cart, no split payments, no vendor payouts; every purchase completes on the merchant's own storefront
- [ ] **MKPL-07**: `marketplace` (and related reserved words) are added to the platform's reserved-slug list so no merchant can claim them as a store subdomain

### Marketplace Marketing (merchant add-on)

- [ ] **MMKT-01**: A merchant can activate Marketplace Marketing as a separate, optionally-priced subscription from their Storefront plan, with an explicit "this is a second charge" disclosure
- [ ] **MMKT-02**: A merchant selects existing catalog products into Marketplace listings through a picker — never a form that creates new listing-only content — up to their plan's capacity (10/25/50)
- [ ] **MMKT-03**: Listings move through an explicit lifecycle (Selected → Pending Review → Active → Paused/Rejected → Expired) with exactly one module permitted to write listing state, mirroring the existing order-state-machine pattern, keyed by actor (merchant vs. platform) so a merchant cannot self-approve
- [ ] **MMKT-04**: A rejected listing shows the merchant a reason
- [ ] **MMKT-05**: Listing expiry is derived at read time from the subscription period, never a persisted status a cron must flip
- [ ] **MMKT-06**: A platform-side moderation page, inside the pilot-scoped Super Admin, lets the platform owner approve or reject Pending Review listings with a reason
- [ ] **MMKT-07**: A merchant can always pause or withdraw their own listing even if their Storefront plan has lapsed or entered a read-only/expired-trial state — a dedicated allowance, since Marketplace Marketing is a separate subscription from Storefront
- [ ] **MMKT-08**: Per-listing view and click-through counts are visible to the merchant

### Customers

- [ ] **CUST-01**: A Customer record is created automatically from checkout, keyed on the normalized phone number — merchants never manually create customers
- [ ] **CUST-02**: Merchants can search customers by name or phone and view a detail page with full order history
- [ ] **CUST-03**: A customer's WhatsApp/call contact actions are one click from their profile, reusing the existing deep-link helper
- [ ] **CUST-04**: Historical orders that can't be linked to a normalized phone remain visible (nullable `customerId`) rather than blocking the migration or being dropped

### Inventory

- [ ] **INV-01**: Merchants see a stock-levels view across all variants, filterable to low-stock and out-of-stock
- [ ] **INV-02**: Exactly one server-side writer handles all non-order stock changes (both "set to" and "adjust by"), enforced by a source-scanning contract test mirroring the existing single-order-state-writer pattern, so it can never race the checkout stock hold
- [ ] **INV-03**: Every manual stock change is recorded in an append-only, reason-coded adjustment ledger
- [ ] **INV-04**: A store-wide low-stock threshold drives a dashboard indicator

### Delivery

- [ ] **DLV-01**: Merchants can define named delivery zones with a flat fee each, seeded with Douala presets, plus a pickup-in-store option
- [ ] **DLV-02**: A free-delivery threshold can be set and is evaluated against the server-recomputed subtotal
- [ ] **DLV-03**: The delivery fee is shown to the customer before payment instructions render, and is re-read server-side (never accepted from the client) inside the same transaction that finalizes the order
- [ ] **DLV-04**: The chosen zone's name and fee are snapshotted onto the order at placement — a later zone rename/reprice never rewrites past orders
- [ ] **DLV-05**: A merchant can set delivery-promise text shown to customers

### Domains (custom domains — extends the existing Domains category)

- [ ] **DOM-03**: A merchant on a plan that includes custom domains can add one custom domain to their store
- [ ] **DOM-04**: The dashboard shows the exact DNS records to create (with copy buttons) and a live status (Pending/Verifying/Active/Misconfigured) with a manual re-check
- [ ] **DOM-05**: A domain is only trusted as verified after EINORT's own DNS ownership challenge succeeds — the hosting provider's own "verified" flag is never trusted alone
- [ ] **DOM-06**: TLS is provisioned and renewed automatically once DNS verifies
- [ ] **DOM-07**: Both apex and `www` are handled, with one redirecting to the other; the original EINORT subdomain keeps resolving (redirecting to the custom domain once active) so existing shared links never break
- [ ] **DOM-08**: A merchant can remove or replace their custom domain; removal cleanly tears down the mapping across every system it touched (cache, database, hosting provider)
- [ ] **DOM-09**: A released custom domain is never immediately re-claimable by a different merchant without a holder-history record, mirroring the existing store-slug-release protection

### Analytics

- [ ] **ANLY-01**: A dedicated Analytics page shows revenue, order count, average order value, and units sold for a selectable period, with a previous-period comparison
- [ ] **ANLY-02**: Headline revenue counts only CONFIRMED and FULFILLED orders; a separate, clearly labeled "pending/at-risk" figure covers the remaining open states — this single definition is shared by the dashboard Overview, the Analytics page, the Customers "total spent" figure, and CSV export, replacing the current inconsistency where units-sold isn't filtered the same way revenue is
- [ ] **ANLY-03**: A daily time-series chart and a top-10-products table (by revenue and by units) are shown, grouped by the canonical product id and resolved to its live display name
- [ ] **ANLY-04**: Orders are broken down by state and by channel (WhatsApp / manual transfer / COD)
- [ ] **ANLY-05**: Analytics data can be exported as CSV
- [ ] **ANLY-06**: Every analytics aggregation is tenant-scoped through the existing scoped data-access client — never a cross-tenant or raw-SQL query

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Payments

- **PAY-V2-01**: Live payment gateway/PSP integration (MTN MoMo API, Orange Money API, or similar)

### Commerce Depth

- **COM-V2-01**: Discount codes and promotional pricing
- **COM-V2-02**: Customer segmentation and tagging
- **COM-V2-03**: Bulk product import/export
- **COM-V2-04**: Staff accounts beyond the single owner login
- **COM-V2-05**: Wholesale/B2B workflows (tiered pricing, MOQs, bulk order entry)

### Platform

- ~~**PLAT-V2-01**: Custom domain connection~~ — **promoted to active scope 2026-09-13** as `DOM-03` through `DOM-09` in milestone v2.0
- **PLAT-V2-02**: Full platform admin suite (analytics, fraud/abuse, theme library management, feature flags, broadcast notifications, full observability, usage dashboards) — still deferred in v2.0; only one minimal moderation page (`MMKT-06`) is added to the pilot-scoped Super Admin
- **PLAT-V2-03**: AI-assisted product descriptions / storefront copy

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Live payment gateway / PSP API integration | User's confirmed approach is manual transfer + claim + verification only; avoids PSP approval/integration delay as a launch blocker |
| Vendure or Medusa commerce framework | Rejected in favor of custom Next.js/Prisma to avoid framework learning-curve risk for a solo 30-day build |
| 40-day timeline / v4.0's full feature set | 30-day window governs; v4.0 used only as a detail reference, not the governing scope document |
| 20 independently hand-designed templates | Recombination of a smaller flagship set instead, to keep template-quality work achievable solo in the time available |
| Wholesale/B2B engine | Deferred to v2+ per both source planning documents |
| Multi-warehouse management, ERP integrations, advanced CRM | Explicitly out of scope per both source documents; no pilot-stage payoff |
| Dedicated search infrastructure (Meilisearch/Elasticsearch/etc.) | Not needed at pilot catalogue size; async indexing pathway noted as a future add, not built now |
| Real-time collaborative editing on the storefront editor | No pilot-stage need; adds complexity with no payoff at this scale |
| Free-form drag-and-drop / unrestricted HTML page building | Conflicts architecturally with the schema-driven Theme→Page→Section→Block design that keeps templates non-generic |
| Live payment gateway/PSP integration (again) | Master Product Specification V3 asked for "at least one real payment integration" — rejected a second time, same reasoning as the original v4.0 rejection above; manual transfer stays the only path |
| Full Platform Admin surface (again) | Deferred a second time this milestone — only `MMKT-06`'s one minimal moderation page is added |
| Marketplace cart / unified checkout | Forbidden by Master Spec V3; would make the platform merchant-of-record with no payment gateway to settle it |
| Cross-store shopper reviews/ratings on the Marketplace | Needs shopper identity and moderation capacity that don't exist; one fake-review scandal at pilot scale is unrecoverable |
| Shopper accounts/logins on the Marketplace or Customers | Checkout is deliberately guest-only; a login surface adds a third tenant-identity channel and a password-reset/SMS burden with no revenue attached |
| Personalized marketplace recommendations, price comparison across merchants | No behavioral data or shopper identity to drive it; price comparison also incentivizes merchant churn |
| CPC bidding / auction placement / ad budgets for Marketplace Marketing | Needs metered billing, budget pacing, and fraud detection — no payment gateway exists to run it on |
| Multi-warehouse inventory, purchase orders/supplier management, COGS/margin reporting | ERP-shaped completeness with no pilot-stage payoff; merchants buy stock informally and won't maintain cost data |
| Carrier API integration, weight-based delivery rate tables, live driver tracking, map picker with lat/long | No carrier in this market exposes a usable API; delivery is a moto driver coordinated by phone/WhatsApp |
| Selling/registering domains on the merchant's behalf, running DNS/nameservers for merchants, email hosting on custom domains, wildcard custom domains | Each is a different, larger business (registrar accreditation, mail hosting, DNS-01 nameserver takeover) that this platform does not need to become |
| Session/funnel/cohort analytics, conversion-rate as a headline metric, forecasting/trend prediction | No session/pageview pipeline exists; at this order volume these are noise presented as insight |
| Per-merchant third-party analytics embeds (GA4/Meta Pixel snippets) | A tenant-controlled `<script>` tag in a shared codebase is a stored-XSS-shaped hole across every storefront |
| Saved customer address book | No shopper authentication exists — an address book is either unreachable or reachable by typing a stranger's phone number, leaking their home address. `Order.deliveryAddress` (snapshot) plus a merchant-visible last-known address covers what CUST-02 needs |

## Traceability

### v1.0 requirements

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEN-01 | Phase 1 | Pending |
| TEN-02 | Phase 1 | Pending |
| TEN-03 | Phase 1 | Pending |
| TEN-04 | Phase 2 | Pending |
| TEN-05 | Phase 1 | Pending |
| TEN-06 | Phase 1 | Pending |
| TEN-07 | Phase 1 | Pending |
| TEN-08 | Phase 1 | Pending |
| MKTG-01 | Phase 05.2 | Complete |
| ONB-01 | Phase 1 | Pending |
| ONB-02 | Phase 4 | Pending |
| ONB-03 | Phase 4 | Pending |
| ONB-04 | Phase 4 | Pending |
| ONB-05 | Phase 2 | Pending |
| TMPL-01 | Phase 4 | Pending |
| TMPL-02 | Phase 4 | Pending |
| TMPL-03 | Phase 5 | Pending |
| TMPL-04 | Phase 5 | Pending |
| TMPL-05 | Phase 5 | Pending |
| TMPL-06 | Phase 05.1 | Complete |
| EDIT-01 | Phase 4 | Pending |
| EDIT-02 | Phase 4 (restructured Phase 05.3) | Complete |
| EDIT-03 | Phase 4 (restructured Phase 05.3) | Complete |
| CAT-01 | Phase 3 | Pending |
| CAT-02 | Phase 3 | Pending |
| CAT-03 | Phase 3 | Pending |
| CHK-01 | Phase 3 | Pending |
| CHK-02 | Phase 3 | Pending |
| CHK-03 | Phase 3 | Pending |
| CHK-04 | Phase 3 | Pending |
| CHK-05 | Phase 3 | Pending |
| ORD-01 | Phase 3 | Pending |
| ORD-02 | Phase 3 | Pending |
| ORD-03 | Phase 3 | Pending |
| ORD-04 | Phase 3 | Pending |
| ORD-05 | Phase 3 | Pending |
| DOM-01 | Phase 1 | Pending |
| DOM-02 | Phase 1 | Pending |
| SUB-01 | Phase 2 | Complete |
| SUB-02 | Phase 2 | Complete |
| SUB-03 | Phase 6 | Complete |
| DASH-01 | Phase 6 | Complete |
| DASH-02 | Phase 6 | Complete |
| ADM-01 | Phase 6 | Complete |
| ADM-02 | Phase 6 | Complete |
| ADM-03 | Phase 6 | Complete |
| ADM-04 | Phase 6 | Pending |
| ADM-05 | Phase 6 | Complete |

**Phase 6 reconciliation (2026-09-13):** the eight rows above mapped to Phase 6 (SUB-03, DASH-01/02, ADM-01..05) were committed during v1.0 but never planned or executed. Milestone v2.0 **keeps Phase 6 exactly as-is — same number, same requirements, same success criteria** — and runs it first, as v2.0's foundation phase. Nothing was renumbered, moved, or dropped. Rationale: Phase 6 builds the merchant dashboard shell that every new v2.0 dashboard surface plugs into, the pilot-scoped Super Admin that MMKT-06's moderation page lives inside, and the ADM-05 support thread that is the only merchant↔platform notification channel that exists (`resend` is declared but unwired). New v2.0 phases therefore start at Phase 7.

### v2.0 milestone requirements

| Requirement | Phase | Status |
|-------------|-------|--------|
| ONB-05 (30-day trial) | Phase 7 | Pending |
| TMPL-04 (15/17/18 tier split) | Phase 7 | Pending |
| DSGN-01 | Phase 8 | Pending |
| DSGN-02 | Phase 8 | Pending |
| DSGN-03 | Phase 8 | Pending |
| INV-01 | Phase 9 | Pending |
| INV-02 | Phase 9 | Pending |
| INV-03 | Phase 9 | Pending |
| INV-04 | Phase 9 | Pending |
| DLV-01 | Phase 10 | Pending |
| DLV-02 | Phase 10 | Pending |
| DLV-03 | Phase 10 | Pending |
| DLV-04 | Phase 10 | Pending |
| DLV-05 | Phase 10 | Pending |
| CUST-01 | Phase 11 | Pending |
| CUST-02 | Phase 11 | Pending |
| CUST-03 | Phase 11 | Pending |
| CUST-04 | Phase 11 | Pending |
| ANLY-01 | Phase 12 | Pending |
| ANLY-02 | Phase 12 | Pending |
| ANLY-03 | Phase 12 | Pending |
| ANLY-04 | Phase 12 | Pending |
| ANLY-05 | Phase 12 | Pending |
| ANLY-06 | Phase 12 | Pending |
| MMKT-01 | Phase 13 | Pending |
| MMKT-02 | Phase 13 | Pending |
| MMKT-03 | Phase 13 | Pending |
| MMKT-04 | Phase 13 | Pending |
| MMKT-05 | Phase 13 | Pending |
| MMKT-06 | Phase 13 | Pending |
| MMKT-07 | Phase 13 | Pending |
| MMKT-08 | Phase 13 | Pending |
| MKPL-01 | Phase 14 | Pending |
| MKPL-02 | Phase 14 | Pending |
| MKPL-03 | Phase 14 | Pending |
| MKPL-04 | Phase 14 | Pending |
| MKPL-05 | Phase 14 | Pending |
| MKPL-06 | Phase 14 | Pending |
| MKPL-07 | Phase 14 | Pending |
| DOM-03 | Phase 15 | Pending |
| DOM-04 | Phase 15 | Pending |
| DOM-05 | Phase 15 | Pending |
| DOM-06 | Phase 15 | Pending |
| DOM-07 | Phase 15 | Pending |
| DOM-08 | Phase 15 | Pending |
| DOM-09 | Phase 15 | Pending |

**ONB-05 and TMPL-04 appear in both tables on purpose.** Their v1.0 rows (Phase 2, Phase 5) record what actually shipped — a 10-day trial and a 10/15/25 tier split. Their v2.0 rows (Phase 7) record where the revised values are implemented. Neither is duplicated *work*: Phase 7 changes the two values in place on top of what Phases 2 and 5 built.

**Coverage:**

- v1.0 requirements: 46 total — mapped 46/46 ✓ (unchanged by this milestone)
- v2.0 requirements: 46 total (44 new — DSGN-01..03, MKPL-01..07, MMKT-01..08, CUST-01..04, INV-01..04, DLV-01..05, DOM-03..09, ANLY-01..06 — plus the 2 updated-in-place: ONB-05, TMPL-04) — mapped 46/46 ✓
- Unmapped: 0
- Orphaned (mapped to no phase): 0
- Duplicated within a milestone (same requirement in two phases of the same milestone): 0

**Phase distribution:**

*v1.0:*
- Phase 1 (Multi-Tenant Foundations & Domain Resolution): 10 requirements
- Phase 2 (Merchant Auth, Entitlements & Trial): 4 requirements
- Phase 3 (Product Catalog & Order/Payment-Claim State Machine): 13 requirements
- Phase 4 (Theme/Section/Block System & Flagship Template): 8 requirements
- Phase 5 (Template Segment Expansion): 3 requirements
- Phase 05.1 (Template Preview Rendering & Picker Redesign): 1 requirement
- Phase 05.2 (Marketing Landing Page Redesign): 1 requirement
- Phase 6 (Merchant Dashboard & Platform Admin): 8 requirements

*v2.0 (Phase 6 executes first, carrying its v1.0 mappings — no v2.0 requirements are assigned to it):*
- Phase 7 (Trial & Template-Tier Business Rules): 2 requirements
- Phase 8 (Design System & Visual Migration): 3 requirements
- Phase 9 (Inventory): 4 requirements
- Phase 10 (Delivery): 5 requirements
- Phase 11 (Customers): 4 requirements
- Phase 12 (Analytics): 6 requirements
- Phase 13 (Marketplace Marketing): 8 requirements
- Phase 14 (Marketplace): 7 requirements
- Phase 15 (Custom Domains): 7 requirements

---
*Requirements defined: 2026-08-16*
*Last updated: 2026-09-13 — milestone v2.0 roadmapped: all 46 v2.0 requirements (44 new + ONB-05 and TMPL-04 updated in place) mapped to Phases 7-15; Phase 6 reconciled and kept unchanged as v2.0's foundation phase; added one Out of Scope row (saved customer address book) surfaced during roadmapping*
