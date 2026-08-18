# Roadmap: EINORT-Commerce

## Overview

EINORT-Commerce goes from an empty repository to a working, trustworthy, Cameroon-first storefront-builder in six phases. The first two phases build the invisible foundation every surface depends on — structurally enforced multi-tenant data isolation with working subdomain resolution, then session-based merchant auth with server-enforced subscription entitlements and trial. Phase 3 builds the single most load-bearing feature in the product: a merchant can list a product and a customer can complete a full purchase through WhatsApp order, manual Mobile Money/Orange Money claim, or Cash on Delivery, with an auditable order state machine and oversell-proof stock. Phase 4 closes the core value loop — the schema-driven Theme→Page→Section→Block system and the portfolio-quality fashion flagship template, wired into onboarding so a merchant genuinely gets a live, branded, professional-looking storefront within minutes. Phase 5 proves the recombination system scales to real segment diversity (electronics, beauty, grocery, furniture, general retail) without collapsing into "same layout, different color." Phase 6 closes the loop for both operators: the merchant dashboard for running the business day-to-day, and the pilot-scoped Super Admin surface for the platform owner.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Multi-Tenant Foundations & Domain Resolution** - Structurally enforced tenant isolation and working subdomain resolution, from signup onward (completed 2026-08-17)
- [ ] **Phase 2: Merchant Auth, Entitlements & Trial** - Session-scoped merchant login with server-enforced plan limits and a 10-day trial
- [ ] **Phase 3: Product Catalog & Order/Payment-Claim State Machine** - A customer can browse, buy, and pay by claim; a merchant can list products and confirm payment
- [ ] **Phase 4: Theme/Section/Block System & Flagship Template** - Onboarding produces a live, branded, portfolio-quality storefront; merchants can customize it
- [ ] **Phase 5: Template Segment Expansion** - ~20 structurally distinct template variations across real merchant segments
- [ ] **Phase 6: Merchant Dashboard & Platform Admin** - Merchants run their business day-to-day; the platform owner operates the pilot fleet

## Phase Details

### Phase 1: Multi-Tenant Foundations & Domain Resolution

**Goal**: A prospective merchant can sign up and land on a working, tenant-isolated subdomain storefront, with cross-tenant data leakage structurally impossible rather than a code-review hope.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: TEN-01, TEN-02, TEN-03, TEN-05, TEN-06, TEN-07, TEN-08, DOM-01, DOM-02, ONB-01
**Success Criteria** (what must be TRUE):

  1. A prospective merchant can sign up with email/password and a new tenant record is created with an indexed `tenantId`.
  2. Signup automatically provisions a working `{store}.einort.com` subdomain that resolves to that tenant's storefront (server-side, hostname-resolved only).
  3. Reserved slugs (e.g. `api`, `admin`, `www`) cannot be claimed as a store subdomain; unrecognized hostnames return a clean failure and never fall through to any tenant.
  4. All tenant-scoped queries route through a single centralized, tenant-injecting data-access layer, and an automated two-tenant isolation test suite passes before the phase is considered done.
  5. Platform admin uses a deliberately separate, unscoped data-access client, architecturally isolated from the tenant-scoped layer.

**Plans**: 7 plans (6 waves)
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold Next 16 + toolchain, typed env, ESLint import zones, Vitest harness, root placeholder page

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Prisma 7 + Better Auth schema, first migration, and the four data-access clients (scopedDb / platformDb / adminDb)
- [x] 01-03-PLAN.md — Reserved slugs, slug schema, classifyHost and the Next 16 proxy (header strip, /s/ 404, host rewrite)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — Two-tenant seed fixture, model-generic isolation suite and the schema-drift guard

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — Redis-cached fail-closed tenant resolution, storefront route tree and the branded store-not-found page

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-06-PLAN.md — Better Auth config, checkStoreSlug and signUpMerchant tenant provisioning

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01-07-PLAN.md — /signup form with live address checking, signup recovery route, Windows next start smoke check

**Walking Skeleton**: SKELETON.md (architectural contract for Phases 2-6)

### Phase 2: Merchant Auth, Entitlements & Trial

**Goal**: A merchant logs into a dashboard whose tenant context comes only from their session, and their subscription tier and trial state are enforced for real on the server, not just displayed in the UI.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: TEN-04, SUB-01, SUB-02, ONB-05
**Success Criteria** (what must be TRUE):

  1. Merchant can log in and reach a dashboard whose tenant identity is derived solely from the authenticated session, never from client-supplied input.
  2. Every merchant is on a 10-day full-feature trial starting at signup, enforced server-side per-request — after expiry, tier limits actually apply, not just a banner.
  3. Starter/Business/Professional plan differences exist only as server-enforced entitlement checks (product limits, staff limits, feature access) on one shared codebase — no separate codebase or client-only gating per tier.
  4. Plan limits and trial state are checked server-side on every relevant write, and attempting to exceed a limit is blocked even if the UI is bypassed.

**Plans**: 7 plans (6 waves)
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Organization plan/trial columns (input:false), the entitlement registry, the pure trial resolver and its unit suite

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Mandatory plan-selection step: pricing copy, badge, selectPlan write, and the rewired post-signup redirects

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 02-03-PLAN.md — The merchant DAL, the merchantAction write gate, the dashboard shell with the trial banner, and /suspended

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 02-04-PLAN.md — /login, sign-in/sign-out actions, the signup cross-link and distributed login throttling
- [ ] 02-05-PLAN.md — /dashboard/plan switch during the trial, the read-only refusal after it, and the SUB-02 isolation suite

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 02-06-PLAN.md — Seat limits and refusals on the raw /api/auth/organization/* endpoints (membershipLimit + four hooks)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 02-07-PLAN.md — Phase gate (full suite, lint, typecheck, build) and the human walkthrough of the plan screen and read-only mode

### Phase 3: Product Catalog & Order/Payment-Claim State Machine

**Goal**: A merchant can list a product and a customer can complete a full purchase through to a merchant-confirmed order, with stock, order state, and payment-claim integrity guaranteed server-side.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: CAT-01, CAT-02, CAT-03, CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, ORD-01, ORD-02, ORD-03, ORD-04, ORD-05
**Success Criteria** (what must be TRUE):

  1. Merchant can create a product with images, price, simple variants, stock count, and category; images pass through the same automatic enhancement/aspect-ratio pipeline as onboarding logos.
  2. Customer can browse the storefront, view a product, add to cart, and review an order summary without creating an account, then check out via WhatsApp order, manual Mobile Money/Orange Money transfer, or Cash on Delivery.
  3. On the manual transfer path, the customer sees the merchant's receiving number and exact amount (tap-to-dial USSD assist where possible, manual-copy fallback otherwise) and can submit an "I've paid" claim with a transaction reference and optional screenshot.
  4. The customer always sees an explicit order status (e.g. "payment being confirmed") and the order moves through an auditable state machine (Cart → Order Placed → Payment Pending → Payment Claimed → Confirmed/Disputed → Fulfilled), with every transition logged (who/what/when).
  5. Merchant sees a Payment Claims queue (transaction reference + screenshot) and can one-tap confirm/reject; a claim is never auto-confirmed from the customer's self-report alone, duplicate transaction references per tenant are rejected, and concurrent orders cannot oversell the same stock unit.

**Plans**: TBD

### Phase 4: Theme/Section/Block System & Flagship Template

**Goal**: Onboarding (business name, industry, logo, brand colors) produces a live, published, portfolio-quality storefront within minutes, and the merchant can then customize it through a live-preview section/block editor gated by subscription tier.
**Mode:** mvp
**Depends on**: Phase 2, Phase 3
**Requirements**: EDIT-01, EDIT-02, EDIT-03, TMPL-01, TMPL-02, ONB-02, ONB-03, ONB-04
**Success Criteria** (what must be TRUE):

  1. Onboarding captures business name, industry/segment, logo upload, and brand colors, and uploaded logos pass through automatic enhancement/cropping.
  2. Completing onboarding produces a live, published storefront pre-populated with the selected flagship template and the merchant's own branding, within minutes.
  3. The fashion/apparel flagship template is built to genuinely polished, portfolio-quality standard anchored on the zinc-monochrome DTC reference, with its patterns (layout structure, section types, motion language, typography) defined as a code-level Theme→Page→Section→Block type registry plus per-tenant instance data.
  4. Merchant can reorder sections, edit block content/settings, and swap images/colors through a live-preview editor.
  5. Editor access and capability is gated by subscription tier, enforced server-side.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Template Segment Expansion

**Goal**: Merchants outside the fashion segment get their own structurally distinct storefront, and the template library reaches ~20 visually distinct variations that a stranger would not mistake for one another.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: TMPL-03, TMPL-04, TMPL-05
**Success Criteria** (what must be TRUE):

  1. At least 3 additional merchant segments (from electronics, beauty/cosmetics, grocery/food, furniture/home, general retail) each get their own structurally distinct layout skeleton — not a recolored copy of the flagship.
  2. The full template library reaches ~20 visually distinct variations by recombining the segment layouts' sections/blocks with different imagery, color, and copy, not 20 independently designed templates.
  3. Template distinctiveness is checked explicitly via side-by-side comparison ("would a stranger think these are the same product") before the library is considered done — genericness is treated as a failure condition.

**Plans**: TBD
**UI hint**: yes

### Phase 6: Merchant Dashboard & Platform Admin

**Goal**: A merchant can run their business day-to-day from a dashboard that surfaces what needs attention, and the platform owner can operate and support the pilot fleet of stores from a pilot-scoped Super Admin surface.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: DASH-01, DASH-02, ADM-01, ADM-02, ADM-03, ADM-04
**Success Criteria** (what must be TRUE):

  1. Merchant dashboard shows orders (with the Payment Claims queue surfaced prominently), products/inventory, and basic sales numbers (revenue, order count, products sold).
  2. Dashboard answers "how is the business performing, what needs attention, what's next" at a glance — pending claims, low stock, and disputed orders are visible without digging.
  3. Platform owner can view and suspend merchants/stores from a Super Admin dashboard.
  4. Platform owner can view a global payment-claims ledger across all tenants, domain status per tenant, and a support-contact view.
  5. Platform admin scope stays pilot-sized (the four items above only) — no broader admin modules are built in v1.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Multi-Tenant Foundations & Domain Resolution | 7/7 | Complete   | 2026-08-17 |
| 2. Merchant Auth, Entitlements & Trial | 2/7 | In Progress|  |
| 3. Product Catalog & Order/Payment-Claim State Machine | 0/TBD | Not started | - |
| 4. Theme/Section/Block System & Flagship Template | 0/TBD | Not started | - |
| 5. Template Segment Expansion | 0/TBD | Not started | - |
| 6. Merchant Dashboard & Platform Admin | 0/TBD | Not started | - |
