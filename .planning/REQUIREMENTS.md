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

### Onboarding

- [ ] **ONB-01**: A prospective merchant can sign up with email/password (or equivalent) and create one store
- [ ] **ONB-02**: Onboarding captures business name, industry/segment, logo upload, and brand colors
- [ ] **ONB-03**: Uploaded logos and product images pass through automatic enhancement/cropping so a low-quality photo doesn't visibly wreck the storefront
- [ ] **ONB-04**: Completing onboarding produces a live, published storefront on an EINORT subdomain within minutes, pre-populated with the selected flagship template and the merchant's own branding
- [ ] **ONB-05**: Every merchant gets a 10-day full-feature trial of their selected plan, enforced server-side, starting at signup

### Storefront Templates

- [ ] **TMPL-01**: One fashion/apparel flagship template is built to genuinely polished, portfolio-quality standard, anchored on the supplied zinc-monochrome DTC visual reference
- [ ] **TMPL-02**: The flagship template's patterns (layout structure, section types, motion language, typography system) form the pattern library that other segment templates inherit from
- [ ] **TMPL-03**: At least 3 additional merchant segments (from: electronics, beauty/cosmetics, grocery/food, furniture/home, general retail) get their own structurally distinct layout — not just a recolored copy of the flagship
- [ ] **TMPL-04**: The full template library reaches ~20 visually distinct variations by recombining the segment layouts' sections/blocks with different imagery, color, and copy — not 20 independently designed templates
- [ ] **TMPL-05**: Template distinctiveness is checked explicitly (side-by-side comparison) before the library is considered done — genericness is treated as a failure condition, not a subjective nice-to-have

### Storefront Editor

- [ ] **EDIT-01**: Storefront content is modeled as Theme → Page → Section → Block, with section/block types defined in code and instances (order, settings, content) stored per tenant
- [ ] **EDIT-02**: Merchants can customize their storefront (reorder sections, edit block content/settings, swap images and colors) through a live-preview editor
- [ ] **EDIT-03**: Editor access/capability is gated by subscription tier, enforced server-side

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

- [ ] **SUB-01**: Starter, Business, and Professional plans run on one shared codebase, differentiated only by server-enforced entitlements (product limits, staff limits, editor capability, feature access) — never separate codebases or client-side-only gating
- [ ] **SUB-02**: Plan limits and trial state are checked server-side on every relevant write, not just hidden/disabled in the UI

### Merchant Dashboard

- [ ] **DASH-01**: Merchant dashboard shows orders (with the Payment Claims queue surfaced prominently), products/inventory, and basic sales numbers (revenue, order count, products sold)
- [ ] **DASH-02**: Dashboard answers "how is the business performing, what needs attention, what's next" at a glance

### Platform Admin (Super Admin)

- [ ] **ADM-01**: Platform owner can view and suspend merchants/stores
- [ ] **ADM-02**: Platform owner can view a global payment-claims ledger across all tenants
- [ ] **ADM-03**: Platform owner can view domain status across tenants and has a support-contact view
- [ ] **ADM-04**: Platform admin scope stays pilot-sized (the four items above) — the broader ~20-module admin surface referenced in prior planning docs is explicitly deferred

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

- **PLAT-V2-01**: Custom domain connection (fast-follow if 30-day time allows; otherwise deferred)
- **PLAT-V2-02**: Full platform admin suite (analytics, fraud/abuse, theme library management, feature flags, broadcast notifications, full observability, usage dashboards)
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

## Traceability

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
| EDIT-01 | Phase 4 | Pending |
| EDIT-02 | Phase 4 | Pending |
| EDIT-03 | Phase 4 | Pending |
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
| SUB-01 | Phase 2 | Pending |
| SUB-02 | Phase 2 | Pending |
| DASH-01 | Phase 6 | Pending |
| DASH-02 | Phase 6 | Pending |
| ADM-01 | Phase 6 | Pending |
| ADM-02 | Phase 6 | Pending |
| ADM-03 | Phase 6 | Pending |
| ADM-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 44 total (corrected from initial count of 39 during roadmap creation — full line-by-line recount of this file's requirement list)
- Mapped to phases: 44/44 ✓
- Unmapped: 0

**Phase distribution:**
- Phase 1 (Multi-Tenant Foundations & Domain Resolution): 10 requirements
- Phase 2 (Merchant Auth, Entitlements & Trial): 4 requirements
- Phase 3 (Product Catalog & Order/Payment-Claim State Machine): 13 requirements
- Phase 4 (Theme/Section/Block System & Flagship Template): 8 requirements
- Phase 5 (Template Segment Expansion): 3 requirements
- Phase 6 (Merchant Dashboard & Platform Admin): 6 requirements

---
*Requirements defined: 2026-08-16*
*Last updated: 2026-08-16 after roadmap creation (traceability populated, requirement count corrected 39→44)*
