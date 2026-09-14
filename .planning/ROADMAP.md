# Roadmap: EINORT-Commerce

## Overview

EINORT-Commerce goes from an empty repository to a working, trustworthy, Cameroon-first storefront-builder in six phases. The first two phases build the invisible foundation every surface depends on — structurally enforced multi-tenant data isolation with working subdomain resolution, then session-based merchant auth with server-enforced subscription entitlements and trial. Phase 3 builds the single most load-bearing feature in the product: a merchant can list a product and a customer can complete a full purchase through WhatsApp order, manual Mobile Money/Orange Money claim, or Cash on Delivery, with an auditable order state machine and oversell-proof stock. Phase 4 closes the core value loop — the schema-driven Theme→Page→Section→Block system and the portfolio-quality fashion flagship template, wired into onboarding so a merchant genuinely gets a live, branded, professional-looking storefront within minutes. Phase 5 proves the recombination system scales to real segment diversity (electronics, beauty, grocery, furniture, general retail) without collapsing into "same layout, different color." Phase 6 closes the loop for both operators: the merchant dashboard for running the business day-to-day, and the pilot-scoped Super Admin surface for the platform owner.

### Milestone v2.0 — Design Parity + Marketplace/Marketing Build-out

Milestone v2.0 (added 2026-09-13) continues the same phase sequence rather than restarting it. **Phase 6 is not renumbered and its requirement mappings are unchanged** — it was already committed in v1.0's traceability table (DASH-01, DASH-02, ADM-01..05, SUB-03) but was never planned or executed, and it is exactly the foundation the rest of this milestone needs: the merchant dashboard shell every new v2.0 dashboard surface plugs into, the pilot-scoped Super Admin that MMKT-06's listing-moderation page lives inside, and the ADM-05 support thread that is this product's only merchant↔platform notification channel. It therefore executes first in v2.0, carrying its v1.0 requirement mappings forward untouched. All *new* v2.0 phases start at Phase 7. Nothing already-committed is dropped or renumbered.

The nine new phases follow the research's dependency-driven order and nothing else. Phase 7 lands the two Master Spec V3 commercial-rule changes (30-day trial, 15/17/18 template tiers) early and alone, because they are small, block nothing, and every later phase would otherwise render copy it would have to re-edit. Phase 8 extracts the shared design-token/component layer and visually migrates the already-real surfaces, so the six new dashboard areas that follow compose from one design system instead of each inventing its own. Phases 9-12 (Inventory → Delivery → Customers → Analytics) are a **non-negotiable ordering**: Inventory, Delivery, and Customers each edit the same safety-critical `placeOrder` transaction and must land in that order so each edit hits a settled base, and Analytics must follow Delivery because delivery fees redefine what "revenue" means. Phases 13-14 (Marketplace Marketing → Marketplace) are likewise ordered: the public marketplace has nothing real to render or test against until merchant listings exist. Phase 15 (Custom Domains) is deliberately last despite depending on nothing — it is the only area touching 100% of request traffic and the only one with external DNS/TLS wall-clock risk, so a regression there cannot contaminate six in-flight areas.

Granularity is `standard` (5-8 phases). This milestone runs to nine new phases anyway: the money-path trio cannot be compressed without violating the `placeOrder` sequencing above, and each remaining area is a self-contained capability with its own independently verifiable user outcome. Compressing further would trade a real correctness guarantee for a smaller number.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

**Milestone v1.0:**

- [x] **Phase 1: Multi-Tenant Foundations & Domain Resolution** - Structurally enforced tenant isolation and working subdomain resolution, from signup onward (completed 2026-08-17)
- [x] **Phase 2: Merchant Auth, Entitlements & Trial** - Session-scoped merchant login with server-enforced plan limits and a 10-day trial (completed 2026-08-23)
- [ ] **Phase 3: Product Catalog & Order/Payment-Claim State Machine** - A customer can browse, buy, and pay by claim; a merchant can list products and confirm payment
- [ ] **Phase 4: Theme/Section/Block System & Flagship Template** - Onboarding produces a live, branded, portfolio-quality storefront; merchants can customize it
- [ ] **Phase 5: Template Segment Expansion** - 50 structurally distinct template variations across real merchant segments
- [x] **Phase 05.1: Template Preview Rendering & Picker Redesign** (INSERTED) - Real rendered screenshot previews for all 50 templates (completed 2026-09-08)
- [x] **Phase 05.2: Marketing Landing Page Redesign** (INSERTED) - A real public landing page at `/` (completed 2026-09-08)
- [x] **Phase 05.3: Storefront Editor Page Split** (INSERTED) - Separate Themes and Editor pages, matching Shopify's admin separation (completed 2026-09-13)

**Milestone v2.0 — Design Parity + Marketplace/Marketing Build-out:**

- [ ] **Phase 6: Merchant Dashboard & Platform Admin** - Merchants run their business day-to-day; the platform owner operates the pilot fleet *(carried forward from v1.0's traceability table unchanged; executes first in v2.0 as its foundation phase)*
- [ ] **Phase 7: Trial & Template-Tier Business Rules** - The 30-day trial and the 15/17/18 template tier split are true everywhere the product states them
- [ ] **Phase 8: Design System & Visual Migration** - One shared component layer, and every existing surface migrated onto it and verified responsive
- [ ] **Phase 9: Inventory** - Merchants see and correct real stock through exactly one auditable writer
- [ ] **Phase 10: Delivery** - Customers see what delivery costs before they pay; merchants control it by zone
- [ ] **Phase 11: Customers** - Merchants recognize returning buyers and see their full order history
- [ ] **Phase 12: Analytics** - One page that answers "how did the business do", agreeing with every other number in the product
- [ ] **Phase 13: Marketplace Marketing** - Merchants pay for a second subscription and put chosen products forward as moderated listings
- [ ] **Phase 14: Marketplace** - Shoppers discover products across merchants and land on the merchant's own storefront to buy
- [ ] **Phase 15: Custom Domains** - Merchants put their store on a domain they own, with HTTPS and a clean teardown

## Key Decisions Pending Resolution (Milestone v2.0)

Two structural blockers must be **decided before the phases that depend on them are planned in detail** — not discovered mid-phase. Both were independently flagged by all four research passes (`STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`), which is the strongest convergence signal in the research set.

### KD-V2-01: The `marketplaceDb` fourth data-access client

**Status:** Unresolved. **Must be decided and built at the start of Phase 13**, not deferred into Phase 14.

The public Marketplace browse surface is the codebase's first cross-tenant read with *no tenant identity at all* — anonymous, apex-hosted, no session and no `Host`-derived tenant. None of the three existing DB clients can legally serve it: `scopedDb` requires a `tenantId`, `platformDb` is a five-table registry allowlist, and `adminDb` is unscoped and ESLint-fenced to `src/server/admin/**` (a zone also forbidden from importing tenant-scoped modules). The research's unanimous recommendation is a fourth client: a read-only Prisma Client Extension, ESLint-fenced bidirectionally to `src/server/marketplace/**`, exposing only read operations over an explicit model+column `select` allowlist, with a non-overridable published-and-active predicate **computed at query time, never read from a stored flag** (MKPL-05 states this as a requirement).

**Why it must be decided at the start of Phase 13, not Phase 14:** Marketplace Marketing designs the `MarketplaceListing` schema, and that schema's shape (which columns exist, which indexes are non-tenant-prefixed, whether display data is referenced or duplicated) is determined by how listings will later be read. Designing the schema without knowing the read client's shape is the exact rework this decision exists to prevent.

**The wrong shortcut, named explicitly:** widening `adminDb`'s ESLint fence to include marketplace code. It reads as a two-line config diff and is the milestone's #1 flagged risk — it makes the platform-owner-only unscoped client reachable from an anonymous, crawler-hit, public route.

**Resolve via:** `/gsd:plan-phase 13 --research-phase` — validate the extension mechanics (read-only enforcement, predicate injection) against a running Prisma 7 client before committing. `ARCHITECTURE.md` rates its exact shape MEDIUM confidence (extrapolated from `scopedDb`, not externally verified); the *problem* it solves is HIGH confidence and read directly from source.

### KD-V2-02: The second-subscription entitlement model shape

**Status:** Unresolved. **Must be decided before Phase 13's schema design begins** — this is a decision, not an implementation detail.

Marketplace Marketing (MMKT-01) is a second, independently-priced, independently-expiring subscription. Today `resolveEntitlements(org, now)` is a pure function of scalar fields on one `Organization` row (`planTier`, `subscriptionStatus`, `trialEndsAt`). A second product with its own price, capacity, status, and expiry has nowhere to live in that shape.

**The choice:** a dedicated `MarketplaceSubscription` model versus a generalized `Subscription` table (with `Organization.marketplaceAddonUntil` as a narrower third option `ARCHITECTURE.md` sketches).

**Why it must precede schema design:** whichever shape wins changes `resolveEntitlements`'s signature, which touches `merchantAction`, `requireMerchantContext`, and every entitlement-gated Server Action in the codebase. Both `FEATURES.md` and `ARCHITECTURE.md` call this the single largest hidden cost in the entire milestone — invisible from the feature description.

**Coupled sub-decision (MMKT-07):** the chosen model must make it possible for a merchant whose *Storefront* plan has lapsed to still pause or withdraw their own *Marketplace* listings. `merchantAction({mode:"write"})` currently blocks all writes on `canWrite: false`, which would silently orphan public content the merchant can no longer control. The research's fix is a third `merchantAction` mode (`"retract"`), allowlisted to footprint-reducing actions only.

**Resolve via:** `/gsd:plan-phase 13 --research-phase`, in the phase context document, before any migration is written.

### Resolved at roadmap time (recorded so nobody "re-fixes" them)

| Question | Resolution |
|----------|------------|
| **Moderation with no moderator** (`PITFALLS.md` Pitfall 16, `ARCHITECTURE.md` Anti-Pattern 6). The research recommended *omitting* `PENDING_REVIEW`/`REJECTED` from `ListingStatus` because Platform Admin is deferred and no moderator surface would exist. | **Superseded by requirements.** MMKT-03/MMKT-04/MMKT-06 explicitly require the Pending Review state, a rejection reason, and a platform-side moderation page inside the pilot-scoped Super Admin. Phase 6 builds that Super Admin, so the moderator exists before Phase 13 needs it. Build the full lifecycle. Do **not** "correct" the enum back to four members on the strength of the research document. |
| **Where DSGN-01..03 lives** — its own phase, or threaded through each phase's UI work. | **Its own phase (Phase 8), early.** DSGN-01's component layer is a *dependency* of six later phases that each build new dashboard surfaces; threading it through means the first of those phases invents the primitives and the other five either inherit half-formed conventions or get retrofitted. DSGN-02 targets only surfaces that already exist and has no dependency on any later phase, so it can complete early and completely. The one part that genuinely cannot finish in Phase 8 is DSGN-03's responsive verification of *new* surfaces — handled as a standing phase-gate obligation inherited by Phases 9-15 (see Phase 8's detail). |
| **Shopper accounts on Customers or Marketplace** (`PITFALLS.md` Pitfall 8). | Already closed in REQUIREMENTS.md's Out of Scope table. Checkout stays guest-only; `Customer` is an index over orders, never an identity with a login. Recorded here because the feature being *named* "Customers" is what makes people build it anyway. |
| **Marketplace cart/checkout** (`PITFALLS.md` Pitfall 15). | MKPL-06 makes this a requirement-level prohibition, not a preference. The cart cookie's host-scoping (no `Domain` attribute) is what structurally prevents cross-tenant cart leakage; an apex-hosted cart would reintroduce that leak as a feature. |

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
  2. Every merchant is on a 10-day full-feature trial starting at signup, enforced server-side per-request — after expiry, tier limits actually apply, not just a banner. *(Superseded 2026-09-13: ONB-05 was updated to 30 days for milestone v2.0. The implementation change lands in Phase 7, which owns ONB-05's v2.0 mapping. This criterion records what Phase 2 shipped, not what the product now promises.)*
  3. Starter/Business/Professional plan differences exist only as server-enforced entitlement checks (product limits, staff limits, feature access) on one shared codebase — no separate codebase or client-only gating per tier.
  4. Plan limits and trial state are checked server-side on every relevant write, and attempting to exceed a limit is blocked even if the UI is bypassed.

**Plans**: 7 plans (6 waves)
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Organization plan/trial columns (input:false), the entitlement registry, the pure trial resolver and its unit suite

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Mandatory plan-selection step: pricing copy, badge, selectPlan write, and the rewired post-signup redirects

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — The merchant DAL, the merchantAction write gate, the dashboard shell with the trial banner, and /suspended

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-04-PLAN.md — /login, sign-in/sign-out actions, the signup cross-link and distributed login throttling
- [x] 02-05-PLAN.md — /dashboard/plan switch during the trial, the read-only refusal after it, and the SUB-02 isolation suite

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-06-PLAN.md — Seat limits and refusals on the raw /api/auth/organization/* endpoints (membershipLimit + four hooks)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 02-07-PLAN.md — Phase gate (full suite, lint, typecheck, build) and the human walkthrough of the plan screen and read-only mode

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

**Plans**: 16 plans (6 waves)
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Prisma schema: nine tenant-scoped models, five enums, composite-FK guard, enum re-export, ScopedTx, migration, fixtures
- [x] 03-02-PLAN.md — The `[data-surface="storefront"]` token split, the R2/Sharp/Resend installs, the env surface and the surface-isolation grep test

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-03-PLAN.md — ORDER_TRANSITIONS, transitionOrder() as the single state writer, actor identity and the four rate limiters
- [x] 03-04-PLAN.md — The AppShell sidebar, the two-page migration, the pending-claims badge and the complete Phase-3 copy module
- [x] 03-05-PLAN.md — The R2 presign → Sharp enhance → derivative write-back image pipeline and its preset registry

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-06-PLAN.md — Catalog write layer, the product-count entitlement cap, and the A1 products list
- [x] 03-07-PLAN.md — Order placement engine: tracking token, idempotency, atomic stock hold/release, placeOrder and the CAT-03 race proof
- [x] 03-08-PLAN.md — Payment settings (D-14/16/17) and the pure phone / USSD / wa.me deep-link builders
- [x] 03-09-PLAN.md — Anonymous Redis cart, the storefront catalog grid and the product detail page with add-to-cart
- [x] 03-10-PLAN.md — Merchant orders list and detail, the one order-state chip module, confirm and mark-fulfilled

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-11-PLAN.md — The A2 product form: details, the D-10 image gallery and the D-05 live variant matrix
- [x] 03-12-PLAN.md — The cart review page and the three-path checkout with idempotent submission
- [x] 03-13-PLAN.md — The payment-claims queue: one-tap confirm, required-reason reject, stock release and reopen
- [x] 03-14-PLAN.md — The order-tracking page: exhaustive CHK-05 status map and the D-15 three-tier payment instructions

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 03-15-PLAN.md — Claim submission and D-11 resubmission: token-gated screenshot upload, ORD-04 enforcement, D-13 email

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 03-16-PLAN.md — Phase gate: requirement-coverage test, full suite/lint/typecheck/build, and the real-device iOS + Android walkthrough

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

**Plans**: 16 plans (7 waves)
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Prisma schema (StorefrontTheme, StorefrontPage, Organization.industry), TENANT_SCOPED_MODELS registration, seed fixtures, and the [BLOCKING] schema push
- [x] 04-02-PLAN.md — The four pure modules: the Zod page-document union, WCAG contrast, the default colour constants, and the editor reducer
- [x] 04-03-PLAN.md — The EDIT-03 tier gate: PlanLimits.storefrontEditor, trial-aware canEditStorefront, EditorLockedError (the D-15 trap)
- [x] 04-04-PLAN.md — All phase copy (strings.branding / editor / flagship) and all design tokens (--brand-accent*, motion, reduced-motion floor, ban #5)
- [x] 04-05-PLAN.md — ONB-03 logo pipeline: per-preset enhance flag, requestLogoUpload, finalize KIND_PRESET map

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-06-PLAN.md — The theming registry (SECTION_TYPES, TEMPLATES, INDUSTRY_SEGMENTS), the flagship default document, and the registry drift guard
- [x] 04-07-PLAN.md — Flagship sections A: the render-data contract, Reveal, hero, trust-bar, editorial-split

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-08-PLAN.md — Flagship sections B: product-grid, contact, and the one exhaustive section renderer
- [x] 04-09-PLAN.md — The theming server domain: queries (read-only, degrade-not-throw) and actions (saveDraft, publish, discard, seed, saveBranding)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-10-PLAN.md — Brand-token injection, theme chrome (header, footer, announcement bar) and the flagship home render
- [x] 04-11-PLAN.md — The /onboarding/branding step and the industry redirect-ladder rung (ONB-02/03/04)
- [x] 04-12-PLAN.md — Editor rail and panel components: section list, six field kinds, settings panel, publish bar
- [x] 04-13-PLAN.md — Isolation suites: publish atomicity, cross-tenant refusal, tier refusal, branding idempotency

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 04-14-PLAN.md — The /preview route and the origin-checked, Zod-validated postMessage receiver

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 04-15-PLAN.md — Editor assembly: nav item + REQUIRED_HREFS, toggle-group, the RSC, and the reducer/iframe shell

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 04-16-PLAN.md — Phase gate: token hygiene, the live-preview device pass, and the Design-Distinctiveness Gate

**UI hint**: yes

### Phase 5: Template Segment Expansion

**Goal**: Merchants outside the fashion segment get their own structurally distinct storefront, and the template library reaches 50 visually distinct variations that a stranger would not mistake for one another.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: TMPL-03, TMPL-04, TMPL-05
**Success Criteria** (what must be TRUE):

  1. At least 3 additional merchant segments (from electronics, beauty/cosmetics, grocery/food, furniture/home, general retail) each get their own structurally distinct layout skeleton — not a recolored copy of the flagship.
  2. The full template library reaches 50 visually distinct variations by recombining the segment layouts' sections/blocks with different imagery, color, and copy, not 50 independently designed templates. *(Shipped as 10 Starter / 15 Business / 25 Professional. TMPL-04's tier split was revised to 15/17/18 on 2026-09-13 for milestone v2.0; the re-tiering lands in Phase 7, which owns TMPL-04's v2.0 mapping. The 50 total and the six segment categories are unchanged.)*
  3. Template distinctiveness is checked explicitly via side-by-side comparison ("would a stranger think these are the same product") before the library is considered done — genericness is treated as a failure condition.

**Plans**: 22 plans (6 waves)
Plans:
**Wave 1**

- [x] 05-01-PLAN.md — The variant vocabulary in marker-free schema.ts, the extended TemplateDefinition, variantsForTemplate, and the marker-boundary guard
- [x] 05-02-PLAN.md — templateKey → draft/published split, the hand-edited RENAME migration, the [BLOCKING] schema push, and the two read paths
- [x] 05-03-PLAN.md — strings.ts → strings/ directory split, six segment copy namespaces, and all Phase-5 chrome copy

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-04-PLAN.md — The tier gate: PLAN_TIER_RANK, PlanLimits.templates, TemplateLockedError, and the boolean/throw access pair (D-12, not trial-elevated)
- [x] 05-05-PLAN.md — Hero variants: the three-arm switch plus split and stack (no image slot)
- [x] 05-06-PLAN.md — trust-bar:strip and contact:card variants
- [x] 05-07-PLAN.md — product-grid:dense, product-grid:showcase and editorial-split:banner variants
- [x] 05-08-PLAN.md — The 50 registry rows, 25 skeletons, tier allocation, and the TEMPLATE_DEFAULTS builder dispatch
- [x] 05-09-PLAN.md — The zero-byte geometric template thumbnail and the shared picker grid

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-10-PLAN.md — Render path: the variants prop by literal key, both storefront routes, and the fourth validated postMessage field
- [x] 05-11-PLAN.md — switchTemplate plus template-aware publish, discard and saveBranding
- [x] 05-12-PLAN.md — fashion-apparel: 8 templates, 4 skeletons (flagship frozen)
- [x] 05-13-PLAN.md — electronics: 9 templates, 4 skeletons
- [x] 05-14-PLAN.md — beauty-cosmetics: 8 templates, 4 skeletons
- [x] 05-15-PLAN.md — grocery-food: 8 templates, 4 skeletons
- [x] 05-16-PLAN.md — furniture-home: 8 templates, 4 skeletons
- [x] 05-17-PLAN.md — general-retail: 9 templates, 5 skeletons

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 05-18-PLAN.md — The onboarding template picker as Card 3, submitted with saveBranding
- [x] 05-19-PLAN.md — The editor's Change template rail row, picker panel, destructive confirm and preview repaint
- [x] 05-20-PLAN.md — The eight-rule distinctiveness metric and the drift guard generalized to 50

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 05-21-PLAN.md — Isolation suites: the non-elevated tier gate, draft-only switch, discard revert and onboarding seed

**Wave 6** *(blocked on Wave 5 completion — Phase 05.1 dependency cleared 2026-09-08, Phase 05.1 is now complete. Phase 05.1 was required to land first so no reviewer-facing surface in the product still shows the 05-09 CSS-wireframe placeholders as primary UI when 05-22's human stranger tests run; that condition now holds. Note from plan 05.1-09 Task 2's reconciliation: 05-22's contact-sheet mechanism (`scripts/contact-sheet.mjs`) never actually consumed 05.1's `TemplatePicker`/`TEMPLATE_PREVIEWS` real-screenshot cards — it was already designed to render full default home pages directly from `templateDefaultDocument()`/the section components, independent of both the picker and its CSS-wireframe fallback; see 05-22-PLAN.md's own reconciliation note for the full audit)*

- [ ] 05-22-PLAN.md — Phase gate: full automated suite, the 50-template contact sheet, and the six adversarial-pair stranger tests (closes Phase 4's D-14 check)

**UI hint**: yes

### Phase 05.1: Template Preview Rendering & Picker Redesign (INSERTED)

**Goal**: The template picker (onboarding and the storefront editor's "Change template" action) shows a real rendered screenshot per template in a large, polished grid — not the placeholder CSS-wireframe thumbnails Phase 5 shipped — closing the gap against the owner-supplied Shopify Discover-Themes reference before Phase 5's Wave 6 builds its 50-template contact sheet on top of it.
**Mode:** mvp
**Depends on**: Phase 5 (Waves 1-5)
**Requirements**: TMPL-06
**Success Criteria** (what must be TRUE):

  1. All 50 templates have a real rendered preview image (cropped hero + first section) generated by a one-time build script, stored in R2, and resolved per `TemplateKey` at render time. *(Reconciled during planning 2026-09-07: the original wording said "referenced from the `TEMPLATES` registry". Storage was left to Claude's discretion by `05.1-CONTEXT.md`; `05.1-RESEARCH.md` Pattern 3 chose a generated, committed `src/server/theming/preview-manifest.ts` keyed by `TemplateKey` over a hand-authored `previewImageKey` column, because only the manifest can express generation state — the exact fact D-05's fallback branches on — and because a script must not rewrite the 1262-line hand-edited registry. `TEMPLATES` remains the sole source of truth for which templates exist. Read this criterion as intent-satisfied by the manifest, not as a literal requirement for a registry column.)*
  2. The shared `TemplatePicker`/`TemplateTile` component renders these real images in both the onboarding flow and the editor's "Change template" panel, at a card size/grid density close to the Shopify reference, with the old CSS-wireframe thumbnail retained only as a fallback for a missing image.
  3. Phase 5's Wave 6 (05-22) can build its 50-template contact sheet against this redesigned component.

**Plans**: 9 plans across 5 waves — COMPLETE (Task 3 full-set human-verify checkpoint approved 2026-09-08)
**Canonical refs:** `.planning/phases/05.1-template-preview-rendering-picker-redesign/` — `05.1-CONTEXT.md`, `05.1-RESEARCH.md`, `05.1-PATTERNS.md`, `05.1-UI-SPEC.md`, `05.1-VALIDATION.md`

Plans:

- [x] 05.1-01-PLAN.md — Package legitimacy gate (blocking human-verify) + playwright devDependency install (Wave 1)
- [x] 05.1-02-PLAN.md — Preview asset contracts: IMAGE_PRESETS lossless decoupling + templatePreview row, templatePreviewPrefixFor, generated manifest + drift guard (Wave 1)
- [x] 05.1-03-PLAN.md — Fail-closed scratch-tenant target guard + refusal tests + .env.example entry (Wave 1)
- [x] 05.1-04-PLAN.md — D-06 placeholder segment photography, licence checkpoint, and the source-scanning containment test (Wave 1)
- [x] 05.1-05-PLAN.md — TemplateTile gains previewUrl/segmentLabel, show-all toggle deleted, both call sites segment-ordered, onboarding widened to max-w-5xl (Wave 2)
- [x] 05.1-06-PLAN.md — Picker visual redesign: container-query grid, segment grouping, 16:10 full-bleed card, D-05 fallback, contract test (Wave 3)
- [x] 05.1-07-PLAN.md — scripts/generate-template-previews.ts: guarded reseed, Playwright capture, Sharp + R2, manifest emit, documented command (Wave 2)
- [x] 05.1-08-PLAN.md — Calibration run over four varied templates + blocking crop-framing checkpoint (Wave 4)
- [x] 05.1-09-PLAN.md — Full 50-template generation, manifest completeness gate, 05-22 reconciliation, blocking 50-preview review (Wave 5)

### Phase 05.2: Marketing Landing Page Redesign (INSERTED)

**Goal**: A prospective merchant landing on einort.com's root page understands, within seconds, what EINORT does and why it fits their business, and is compelled toward signup by honest, specific claims about real Cameroon-first payment methods, real template quality, and genuine speed-to-launch — not the current bare wordmark-plus-button placeholder.
**Mode:** mvp
**Depends on**: nothing technically (isolated public route); Phase 05.1 for the hero visual specifically (see D-02 sequencing note)
**Requirements**: MKTG-01
**Success Criteria** (what must be TRUE):

  1. The root page (`/`) is a real, professionally designed landing page — hero, 3 differentiator sections (payment methods / template quality / speed-to-launch), a simple how-it-works section, and one final CTA — replacing the current placeholder.
  2. Every claim on the page is honest and verifiable against the actual shipped product — no fabricated merchant counts, logos, or testimonials.
  3. The page visually extends the existing merchant-platform blue/gold/slate design system rather than introducing a new one.

**Plans**: 1 plan (1 wave) — COMPLETE (Task 3 human-verify checkpoint approved 2026-09-08)
**Canonical refs:** `.planning/phases/05.2-marketing-landing-page-redesign/` — `05.2-CONTEXT.md`, `05.2-DISCUSSION-LOG.md`, `05.2-RESEARCH.md`, `05.2-UI-SPEC.md`, `05.2-PATTERNS.md`, `05.2-VALIDATION.md`

Plans:
**Wave 1**

- [x] 05.2-01-PLAN.md — marketing.ts copy module + strings.root rewire, the five-band page.tsx rewrite (top lockup, hero with D-05 manifest-conditional image slot, three differentiators, how-it-works, final CTA), and the landing-page-contract.test.ts honesty guard

### Phase 05.3: Storefront Editor Page Split (INSERTED)

**Goal:** Split the merchant dashboard's storefront editor from its current single-screen, single-route design into two genuinely separate pages/routes -- a dedicated "Themes" page for browsing/switching templates, and a dedicated full-screen "Editor" page for section/block editing only -- matching the navigational separation in Shopify's own admin, layout/structure only, no new capabilities (existing fixed-five-sections, no-add/remove behavior from Phase 4's locked D-05 preserved exactly).
**Requirements**: EDIT-01, EDIT-02, EDIT-03
**Depends on:** Phase 4 (the editor this phase restructures); Phase 05.1 (the template-picker/current-template-card work this phase's new Themes page builds on)
**Plans:** 4 plans across 3 waves
**Canonical refs:** `.planning/phases/05.3-storefront-editor-page-split/` — `05.3-CONTEXT.md`, `05.3-DISCUSSION-LOG.md`, `05.3-RESEARCH.md`, `05.3-UI-SPEC.md`, `05.3-PATTERNS.md`, `05.3-VALIDATION.md`

Plans:
**Wave 1**

- [x] 05.3-01-PLAN.md — Shared infra: seven strings.editor keys, sidebar href repoint + paired test, switchTemplate dual revalidatePath fix

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05.3-02-PLAN.md — Editor route move: git mv the seven editor files into storefront/editor/, delete the changeTemplate rail branch, add the R-1 full-bleed wrapper and the R-4 leave-guard dialog
- [x] 05.3-03-PLAN.md — New Themes page: storefront/page.tsx + loading.tsx, change-template-panel.tsx moved and renamed to themes-browser.tsx with the R-3 spotlight composition and toast-on-switch

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05.3-04-PLAN.md — Phase gate: dead-route grep gate, D-B scope-creep check, full automated suite, and the blocking six-item manual verification checkpoint (Task 2's six checks approved by the user 2026-09-13)

---

## Milestone v2.0 Phase Details

### Phase 6: Merchant Dashboard & Platform Admin

> **v2.0 reconciliation (2026-09-13):** This phase was defined and requirement-mapped during v1.0 but never planned or executed. It is **not renumbered and its requirements are unchanged** — DASH-01, DASH-02, ADM-01..05, and SUB-03 keep their existing "Phase 6" traceability rows. It becomes milestone v2.0's foundation phase and executes first, because three later v2.0 phases depend on what it builds: Phase 8 migrates the dashboard surfaces this phase creates, Phase 13's MMKT-06 moderation page lives inside this phase's pilot-scoped Super Admin, and Phases 9-15 use the ADM-05 support thread as their notification channel (`resend` is still unwired — no module under `src/` imports it, so an in-app thread message plus a dashboard badge is the only real channel that exists).

**Goal**: A merchant can run their business day-to-day from a dashboard that surfaces what needs attention, and the platform owner can operate and support the pilot fleet of stores from a pilot-scoped Super Admin surface — including a direct messaging channel to every merchant and the ability to verify their subscription payments through it.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: DASH-01, DASH-02, ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, SUB-03
**Success Criteria** (what must be TRUE):

  1. Merchant dashboard shows orders (with the Payment Claims queue surfaced prominently), products/inventory, and basic sales numbers (revenue, order count, products sold).
  2. Dashboard answers "how is the business performing, what needs attention, what's next" at a glance — pending claims, low stock, and disputed orders are visible without digging.
  3. Platform owner can view and suspend merchants/stores from a Super Admin dashboard.
  4. Platform owner can view a global payment-claims ledger across all tenants, domain status per tenant, and a support-contact view.
  5. Platform admin scope stays pilot-sized (the items above only) — no broader admin modules are built in v1.
  6. A merchant and the platform owner can exchange messages and file/image attachments in a persistent, per-merchant thread — visible in the merchant dashboard and a Super Admin inbox, with an in-app badge and email nudge on new activity. No real-time/websocket infrastructure.
  7. A merchant can submit their monthly subscription payment (Mobile Money/Orange Money transaction reference + receipt image) through that same thread, and the platform owner can confirm or reject it there, activating/extending the subscription on confirmation — reusing Phase 3's claim-and-verify pattern with payer/payee reversed.

**Plans:** 7/17 plans executed
**UI hint**: yes

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Admin trust boundary: `requireAdminContext()`, `adminAction()`, the out-of-band bootstrap script minting the admin account, D-05's server-side post-login role routing
- [x] 06-02-PLAN.md — Complete Phase 6 copy surface: two new string modules plus index keys, enforcing 06-UI-SPEC.md's two-audiences rule structurally
- [x] 06-03-PLAN.md — Full Phase 6 schema migration in one pass, plus the four files a new tenant-scoped model costs in this codebase, applied to the dev database

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-04-PLAN.md — `/admin` shell as chrome/composition over the existing token system; gold-accent budget contract test amended in the same commit that spends the gold
- [x] 06-05-PLAN.md — Extend the shipped Overview with a "Needs your attention" band and a fifth metric card — rebuilds nothing
- [x] 06-06-PLAN.md — Merchant-side support-thread domain, the reusable "post a system message" primitive every later v2.0 phase depends on, second Resend consumer
- [x] 06-07-PLAN.md — Resolve R-1 (`transitionOrder`'s `ScopedTx` typing, the phase's single highest-risk integration) and build the admin-side order-claim writer on the resolution

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 06-08-PLAN.md — `/admin` merchants list + per-merchant detail page, domain status derived (not stored) per D-21
- [ ] 06-09-PLAN.md — Merchant-side support thread UI (three reusable transcript components + page) and D-07's persistent nav item, `REQUIRED_HREFS` extended in the same commit
- [ ] 06-10-PLAN.md — Flat cross-tenant payment-claims ledger (D-18/D-19) on top of 06-07's admin claim writer, admin rail pending count wired

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 06-11-PLAN.md — Extend the presign→PUT→finalize upload triad to support-thread image attachments (two narrow doors), rendered in the transcript

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 06-12-PLAN.md — Platform side of the thread: flat unread-first inbox, per-merchant conversation, admin-side message writer, reusing 06-09's transcript components via a `viewer` prop
- [ ] 06-15-PLAN.md — SUB-03 merchant half: claim writer, submit dialog on `/dashboard/plan`, claim card replacing the submit button while a claim is under review

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 06-13-PLAN.md — D-22's PDF attachment path as a genuinely separate, non-re-encoding storage/serving path (own allowlist, own finalize verification, own download doors) — resolves the D-22/UI-SPEC conflict rather than deferring it
- [ ] 06-14-PLAN.md — First and only writer of `Organization.status`, its source-scanning guard, symmetric suspend/restore UI mounted at both entry points, Redis hostname-cache invalidation
- [ ] 06-16-PLAN.md — SUB-03 platform half: the only writer of `SubscriptionPaymentClaim.status`, D-20's separate review page, inline read-only claim cards in both threads

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 06-17-PLAN.md — Phase gate: requirement-coverage guard, full automated suite, the two checkpoint:human-verify checks 06-VALIDATION.md names as automation-impossible (admin bootstrap correctness, full two-session thread round trip), documentation corrections

Cross-cutting constraints:

- `Organization.status` has exactly one writer (06-14) — every other plan that reads suspension state does so through `resolveEntitlements` or the derived domain-status function, never a second write path.
- The support-thread "post a system message" primitive (06-06) is the only notification channel this milestone has — 06-14's suspension notice and 06-16's claim decisions both post through it rather than inventing their own.
- Transcript UI components (06-09) are built once and reused via a `viewer` prop by 06-12's platform side, never forked.

### Phase 7: Trial & Template-Tier Business Rules

**Goal**: The two Master Spec V3 commercial rules — a 30-day trial and a 15/17/18 template tier split — are true everywhere the product enforces or states them, with no surface still quoting the old numbers.
**Mode:** mvp
**Depends on**: Phase 6 (the dashboard/plan surfaces that quote trial days and template access)
**Requirements**: ONB-05, TMPL-04
**Milestone**: v2.0
**Success Criteria** (what must be TRUE):

  1. A merchant who signs up today gets a 30-day full-feature trial, enforced server-side, and every trial figure they read — onboarding, the dashboard trial banner, the plan/pricing screens — says 30 days. No surface still says 10.
  2. Merchants already mid-trial are handled by one stated, deliberate rule (extended to 30 days from signup, or left on their existing end date) rather than by whatever the constant change happens to do.
  3. A Starter merchant can open exactly 15 templates, a Business merchant 32, and a Professional merchant all 50; locked templates stay visible-but-dimmed in the picker rather than disappearing (Phase 5's SORT-NEVER-FILTER rule survives the re-tiering).
  4. The entitlement and plan-access test suites assert the new figures, so a later edit that reintroduces a 10-day trial or a 10/15/25 split fails the build rather than shipping quietly.

**Plans**: 3 plans (3 waves)
Plans:
**Wave 1**

- [ ] 07-01-PLAN.md — 30-day trial: TRIAL_DAYS=30, its load-bearing comments, and every trial figure a merchant reads (ONB-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 07-02-PLAN.md — Re-tier all 50 templates to 15/17/18 per D-06, with the 15/32/50 documented counts, copy and frozen-table invariant (TMPL-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 07-03-PLAN.md — Phase gate: full suite + build, honest isolation-suite reporting, and the manual copy/tier walkthrough checkpoint

**Notes for planning:** Both changes are small and touch known code — `TRIAL_DAYS` in `src/server/entitlements/resolve.ts`, `PlanLimits.templates` and the 50 templates' tier assignment in the theming registry, plus the centralized copy in `src/lib/strings/**` (no user-facing string may be inlined — the prose-literal contract tests will fail the build). Deliberately sequenced before Phase 8 so the visual migration renders final copy instead of numbers it would have to re-edit.

### Phase 8: Design System & Visual Migration

**Goal**: Every merchant-facing surface that already exists looks like one deliberately designed product matching the V3 design reference, and a reusable component layer exists that all six remaining v2.0 phases build their new screens from.
**Mode:** mvp
**Depends on**: Phase 6 (the dashboard and Super Admin surfaces this phase migrates must exist first), Phase 7 (so the migration renders the final 30-day / 15-17-18 copy)
**Requirements**: DSGN-01, DSGN-02, DSGN-03
**Milestone**: v2.0
**Success Criteria** (what must be TRUE):

  1. A merchant moving between Auth, Onboarding, Dashboard Overview, Products, Orders, Storefront Themes/Editor, and Settings sees one consistent visual language — the same buttons, cards, badges, page headers, status badges, empty states, and tables — instead of per-page one-offs.
  2. Every migrated surface still does exactly what it did before the migration: same data, same server actions, same auth boundaries, same entitlement gating — demonstrated by the existing test suite passing without being weakened.
  3. A merchant can complete every migrated flow on a 320px phone through a 1920px desktop with no horizontal scroll, clipped control, or unreachable action, verified at all nine named breakpoints (320/375/390/430/768/1024/1280/1440/1920).
  4. A developer building a new dashboard page in a later phase composes it from the shared component layer instead of inventing new primitives — the layer is complete enough that doing the wrong thing takes more effort than doing the right thing.

**Plans**: TBD
**UI hint**: yes

**Notes for planning:**

- DSGN-01 **extends** the already-shipped blue/gold/slate/zinc token retrofit (quick task `260823-gu4`) and the `DashboardCard` primitive from `260903-ugl`/`260906-egn` — it does not replace them. The storefront palette is a separate scope (`[data-surface="storefront"]`) and `tests/unit/surface-token-isolation.test.ts` will fail the build if the two are mixed.
- **DSGN-03 carries a standing obligation into every later phase.** Its requirement covers "every migrated *and new* surface", but new surfaces do not exist yet. Phase 8 owns the responsive contract, the breakpoint checklist, and full verification of the migrated surfaces; Phases 9-15 each inherit the same checklist as a phase-gate item for the surfaces they add. DSGN-03 is mapped to Phase 8 for traceability, not because responsiveness stops being checked after it.
- The v2.0 design reference is the merchant-platform blue/gold/slate direction (see project memory `project_einort_merchant_platform_design_reference`) — distinct from the zinc-monochrome storefront flagship reference.

### Phase 9: Inventory

**Goal**: A merchant can see and correct what they actually have in stock, and every number in the product's stock column changes through exactly one auditable path.
**Mode:** mvp
**Depends on**: Phase 8
**Requirements**: INV-01, INV-02, INV-03, INV-04
**Milestone**: v2.0
**Success Criteria** (what must be TRUE):

  1. Merchant can open a stock-levels view across every variant in their catalog and filter it down to low-stock and out-of-stock items.
  2. Merchant can set a variant's stock to an exact number or adjust it by an amount, pick a reason for the change, and see the new level immediately.
  3. Merchant can open a variant's adjustment history and see every manual change with its reason, amount, actor, and time — nothing is ever silently overwritten.
  4. Merchant sets one store-wide low-stock threshold and the dashboard flags items at or below it without them going looking.
  5. Two customers checking out the last unit at the same time still cannot both succeed, and no combination of checkout and manual adjustment can produce a stock number the adjustment ledger cannot explain.

**Plans**: TBD
**UI hint**: yes

**Notes for planning:** This phase is deliberately first in the money-path sequence because it *reduces* risk for Phases 10 and 11: `ProductVariant.stock` currently has two uncoordinated writers (`src/server/orders/stock.ts`'s conditional-decrement hold and `src/server/catalog/actions.ts`'s variant matrix), and INV-02's single-writer consolidation must land before Delivery and Customers each edit `placeOrder`. Do the consolidation in the phase's first plan, in isolation, with the isolation suite green — not concurrently with any `placeOrder` change. Enforce it with a source-scanning contract test modeled on `tests/unit/single-order-state-writer.test.ts`. Ship the levels list paginated from day one (two unbounded `findMany`s are already logged in `CONCERNS.md`; do not add a third).

### Phase 10: Delivery

**Goal**: A customer knows what delivery will actually cost before they commit to paying, and the merchant controls those costs by zone without ever being able to be overridden from the browser.
**Mode:** mvp
**Depends on**: Phase 9
**Requirements**: DLV-01, DLV-02, DLV-03, DLV-04, DLV-05
**Milestone**: v2.0
**Success Criteria** (what must be TRUE):

  1. Merchant can define named delivery zones with a flat fee each — starting from editable Douala presets — plus a pickup-in-store option.
  2. Merchant can set a free-delivery threshold and a delivery-promise line, and a customer whose order clears the threshold sees delivery become free.
  3. Customer picks their zone at checkout and sees the delivery fee and the resulting order total *before* any payment instructions appear.
  4. The amount the customer is told to transfer, the amount recorded on the order, and the amount the merchant sees are the same number, computed server-side inside the order transaction — a tampered client cannot change the fee.
  5. Renaming or repricing a zone later never changes the zone name or fee shown on an already-placed order.

**Plans**: TBD
**UI hint**: yes

**Notes for planning:** Must precede Analytics — delivery fees change what "revenue" means, and re-deciding whether the sales chart shows GMV or product revenue *after* the chart ships is expensive. The checkout input schema must accept `deliveryZoneId` only and **never** a `deliveryFeeXaf` field; the fee is recomputed from a pure `quoteDelivery(settings, zone, subtotalXaf)` (mirroring `resolveEntitlements`'s zero-I/O shape) inside the existing `placeOrder` transaction. Open question for the phase context: whether a WhatsApp-channel order carries a delivery fee in its pre-filled message or negotiates it in chat — that path bypasses the payment state machine entirely.

### Phase 11: Customers

**Goal**: A merchant can recognize a returning buyer, see everything that buyer has ever ordered, and reach them in one tap — without anybody ever having to create an account.
**Mode:** mvp
**Depends on**: Phase 10
**Requirements**: CUST-01, CUST-02, CUST-03, CUST-04
**Milestone**: v2.0
**Success Criteria** (what must be TRUE):

  1. Placing an order automatically creates or matches a customer on the normalized phone number — the merchant never types a customer in by hand, and the same number never produces two customers.
  2. Merchant can search their customer list by name or phone and open a profile showing that customer's full order history and total spent.
  3. Merchant can start a WhatsApp chat or place a call to a customer in one tap from that profile.
  4. Orders placed before this phase still appear everywhere they appeared before and are never dropped, even when their phone number cannot be matched to a customer.
  5. A customer giving a corrected name on a new order never rewrites the name recorded on an older one.

**Plans**: TBD
**UI hint**: yes

**Notes for planning:** **Key Decision, recorded now so it is not rediscovered mid-phase: this phase adds no shopper account, login, or password-reset surface.** Checkout stays guest-only; `Customer` is an index *over* orders, never the source of an order's identity. `Order.customerName`/`.customerPhone`/`.deliveryAddress` stay and stay authoritative — a nullable `Order.customerId` is added *alongside* them (which is also what CUST-04 requires). Do not build a saved-address book: with no authentication, it is either unreachable or reachable by typing a stranger's phone number. Reuse the existing normalizer in `src/server/checkout/actions.ts`; do not write a second one. Watch the retry hazard: `placeOrder` retries exactly once on a `P2002` on the order number, and the new `[tenantId, phoneNormalized]` unique constraint can `P2002` under two concurrent first-orders from the same phone — handle it locally, never by widening the outer retry (which would re-run the stock hold).

### Phase 12: Analytics

**Goal**: A merchant can answer "how did the business actually do this period, and how does that compare to last period" from one page whose numbers agree with every other number the product shows them.
**Mode:** mvp
**Depends on**: Phase 11
**Requirements**: ANLY-01, ANLY-02, ANLY-03, ANLY-04, ANLY-05, ANLY-06
**Milestone**: v2.0
**Success Criteria** (what must be TRUE):

  1. Merchant picks a period and sees revenue, order count, average order value, and units sold, each with a comparison against the previous period.
  2. Headline revenue counts only confirmed and fulfilled orders, with pending/at-risk money shown separately and clearly labeled — and the dashboard Overview card, the Analytics page, a customer's total spent, and the CSV export all show the same number for the same period.
  3. Merchant sees a day-by-day chart and a top-10 products table (by revenue and by units), grouped by the canonical product and labeled with its current display name.
  4. Merchant sees their orders broken down by state and by channel (WhatsApp / manual transfer / cash on delivery).
  5. Merchant can export the period's analytics as CSV, and no figure anywhere on the page is silently truncated by a row cap.

**Plans**: TBD
**UI hint**: yes

**Notes for planning:** Extract one shared metrics module (`EARNED_STATES`/`OPEN_STATES`, currently module-private in `src/server/dashboard/queries.ts`) **first**, and make Overview consume it — redefining revenue in a second place is exactly how the Overview card and the Analytics page end up disagreeing in front of a merchant. The existing `unitsSold` figure is not state-filtered the same way revenue is; ANLY-02 resolves that inconsistency and the chosen definition must be recorded as a decision, not assumed. `$queryRaw`/`$executeRaw` are banned repository-wide, so `date_trunc`/`generate_series`/window functions are off the table: add `Order.placedOnDay` for index-backed `groupBy` and bucket in TypeScript, reusing `dashboard/buckets.ts` and `DOUALA_UTC_OFFSET_MINUTES`. `REVENUE_WINDOW_ROW_CAP = 5000` must not survive into a 90- or 365-day window. ANLY-06 forbids any raw or cross-tenant query — `groupBy`/`aggregate` are covered by the tenant extension.

### Phase 13: Marketplace Marketing

**Goal**: A merchant can pay for a separate Marketplace Marketing subscription, put chosen catalog products forward as listings, and stay in control of those listings' fate — while the platform owner keeps the last word on what goes public.
**Mode:** mvp
**Depends on**: Phase 6 (the pilot-scoped Super Admin that MMKT-06's moderation page lives inside, and the ADM-05 thread), Phase 8, Phase 12
**Blocked on decisions**: **KD-V2-01** (`marketplaceDb` shape — decide and build at the start of this phase, because the listing schema depends on how listings will later be read) and **KD-V2-02** (second-subscription entitlement model — decide *before* schema design). See "Key Decisions Pending Resolution" above.
**Requirements**: MMKT-01, MMKT-02, MMKT-03, MMKT-04, MMKT-05, MMKT-06, MMKT-07, MMKT-08
**Milestone**: v2.0
**Success Criteria** (what must be TRUE):

  1. Merchant can activate Marketplace Marketing as a subscription separate from their Storefront plan, seeing an explicit "this is a second, additional charge" disclosure before committing — and the two subscriptions can expire independently of each other.
  2. Merchant selects existing catalog products into listings through a picker (never a form that creates listing-only content) and is stopped at their tier's capacity of 10/25/50.
  3. A submitted listing sits in Pending Review until the platform owner approves or rejects it from the Super Admin moderation page; a rejected listing shows the merchant the reason; a merchant can never move their own listing to Active.
  4. A merchant whose Storefront plan has lapsed, or whose trial has expired into read-only, can still pause or withdraw their own listings — they are never locked out of retracting content that is still public.
  5. Merchant sees per-listing view and click-through counts, and a listing whose Marketplace subscription period has ended stops being active on its own, with no cron job or manual flag flip involved.

**Plans**: TBD
**UI hint**: yes
**Research flag**: recommended — run `/gsd:plan-phase 13 --research-phase`. Both KD-V2-01 and KD-V2-02 are genuinely open design questions rather than implementation details.

**Notes for planning:**

- Model the lifecycle in the codebase's established idiom: a `LISTING_TRANSITIONS` legality table keyed by **`(actor, from, to)`** (not `(channel, from, to)` — a merchant and the platform have different rights, and self-approval must be structurally impossible), one sanctioned writer paired with an append-only event row, and a source-scanning contract test modeled on `tests/unit/single-order-state-writer.test.ts`.
- MMKT-05: expiry is **derived at read time** from the subscription period. A stored `EXPIRED` status flipped by a cron drifts from `resolveEntitlements` and fails open during any cron outage — suspended stores stay visible, re-subscribed merchants stay hidden. Export a visibility predicate builder from the entitlements module and pin it to `resolveEntitlements` with a unit test.
- A listing is a **live pointer**, not a snapshot. Do not copy the product's name, price, or images onto it (the `OrderItem` snapshot instinct is the wrong instinct here) — marketplace and storefront prices would visibly drift and "remove listing" would start to behave like "delete product". A denormalized sort key that is *allowed* to lag is the one acceptable exception, and only if the detail page reads the live price.
- `MarketplaceListing`'s public-browse indexes will deliberately **not** lead with `tenantId`, breaking the schema's usual rule for the same reason `StoreSlugHistory.slug` does. Document it in the schema comment or the next reader will "fix" it. Insert new models into `TENANT_SCOPED_MODELS` in FK dependency order — that array drives the seed fixture's batched transaction and must never be re-sorted.

### Phase 14: Marketplace

**Goal**: A shopper who has never heard of any individual merchant can find a product on EINORT's public marketplace and land on that merchant's own storefront to buy it.
**Mode:** mvp
**Depends on**: Phase 13 (there is nothing real to render, search, or test against until listings exist)
**Blocked on decisions**: **KD-V2-01** must already be resolved and built (see Phase 13).
**Requirements**: MKPL-01, MKPL-02, MKPL-03, MKPL-04, MKPL-05, MKPL-06, MKPL-07
**Milestone**: v2.0
**Success Criteria** (what must be TRUE):

  1. Shopper can browse a public marketplace home with category, featured, and recently-added rails, page through a category, and keyword-search active listings.
  2. Shopper opens a listing and sees the merchant's live current price, name, and images — never a stale stored copy — and the primary button takes them to that product on the merchant's own storefront.
  3. Shopper can open a merchant profile showing store identity (logo, name, segment, city) and its active listing count.
  4. A paused, rejected, expired, or suspended-merchant listing disappears from every marketplace surface the moment its underlying condition changes, with no scheduled job required to make that true.
  5. There is no cart, no checkout, and no payment anywhere on the marketplace — every purchase completes on the merchant's own storefront — and no merchant can claim `marketplace` or its sibling reserved words as a store subdomain.

**Plans**: TBD
**UI hint**: yes
**Research flag**: recommended — validate the `marketplaceDb` extension mechanics (read-only enforcement, predicate injection) against a running Prisma 7 client early; `ARCHITECTURE.md` rates the proposed shape MEDIUM confidence.

**Notes for planning:**

- MKPL-07's reserved-slug addition (`marketplace`, and siblings such as `discover`, `explore`, `market`, `listings`) must land **before** the marketplace ships — a merchant can claim `marketplace.einort.com` today. One edit to `src/server/tenant/reserved-slugs.ts` closes all three layers (`classifyHost`, the write-path hook, the slug checker).
- The public marketplace route tree must contain **no session read, no `requireMerchantContext`, and no `scopedDb`** — enforce with a contract test. Anonymous browsing must never redirect to a login.
- Use explicit `select` allowlists, never `include:`, on every cross-tenant read — otherwise every column added to `Product` in a future phase ships to anonymous visitors the day it is added.
- The marketplace is an apex surface and gets the apex palette; `data-surface="storefront"` is applied only by `s/[slug]/layout.tsx`. Merchant branding takes over after the deep link, not before.
- Cross-tenant `%q%` search cannot use a B-tree index. `pg_trgm` + a GIN index (declared via Prisma's `raw("gin_trgm_ops")`, or a raw migration file — the `$queryRaw` ban applies to application code, not `prisma/migrations/**`) keeps MKPL-02 viable without dedicated search infrastructure.

### Phase 15: Custom Domains

**Goal**: A merchant can put their store on a domain they own, with working HTTPS, and take it down again cleanly — without anyone else ever being able to claim it out from under them.
**Mode:** mvp
**Depends on**: Nothing technically (fully independent of Phases 7-14). Sequenced last deliberately.
**Requirements**: DOM-03, DOM-04, DOM-05, DOM-06, DOM-07, DOM-08, DOM-09
**Milestone**: v2.0
**Success Criteria** (what must be TRUE):

  1. A merchant on a plan that includes custom domains can add one domain and see the exact DNS records to create, each with a copy button, alongside a live status (Pending / Verifying / Active / Misconfigured) and a manual re-check they can come back to hours later.
  2. A domain only becomes Active after EINORT's own DNS ownership challenge passes — never on the hosting provider's say-so alone — and HTTPS then works on it without the merchant doing anything further.
  3. Both the apex and `www` work with one redirecting to the other, and the store's original einort.com subdomain keeps resolving (redirecting to the custom domain) so links already shared never break.
  4. Merchant can remove or replace their domain and the store stops serving on it everywhere at once — cache, database, and hosting provider — with nothing left dangling.
  5. A released domain cannot be immediately re-claimed by a different merchant, and suspending a store takes its custom domain down at the same instant it takes its subdomain down.

**Plans**: TBD
**UI hint**: yes
**Research flag**: recommended — highest external-dependency risk in the milestone.

**Notes for planning:**

- **Why last:** this is the only v2.0 area that touches the request path for 100% of traffic, and the only one with external wall-clock dependencies (DNS propagation is 24-48h, a real test domain and a provider token are needed). Isolating it at the tail keeps a regression here from contaminating six other in-flight areas. PROJECT.md has always treated custom domains as cuttable. It has no technical dependency on Phases 7-14 and could be pulled forward if the schedule demanded it.
- **DOM-05 is the security core of this phase.** The hosting provider's TXT challenge fires only on conflict with another account on that provider — an unclaimed domain "verifies" with zero proof of ownership, which is a first-writer-wins takeover. Generate EINORT's own random per-`(tenantId, hostname)` TXT token, verify it with `dns/promises` using an explicit resolver and exact string equality, and only then call the provider. Add scheduled re-verification: verify-once-trust-forever leaves an expired or transferred domain mapped to the old tenant indefinitely.
- **Keep `src/proxy.ts` at zero I/O.** `classifyHost` gains a fourth, still-pure `custom` kind (a syntactic check only) and the proxy rewrites to a sentinel path segment; resolution happens in the storefront layout behind its own Redis namespace, exactly where slug resolution already happens. Spike the sentinel-segment rewrite against a running Next 16 app before committing to it — `ARCHITECTURE.md` rates it MEDIUM confidence.
- **DOM-08's teardown is ordered, not parallel:** Redis cache entry → database mapping → provider project domain → provider account domain. The first two are the security-relevant steps and must complete first. Suspension currently evicts one cache key; after this phase it must evict 1 + N.
- Confirm before scheduling: the hosting plan tier (domain cap and cron frequency ceiling), and whether `einort.com`'s apex is already on the provider's nameservers — wildcard `*.einort.com` TLS requires it, and if it is not already true, the existing subdomain storefronts have a latent infrastructure gap independent of custom domains. Start the Public Suffix List submission for `einort.com` during this phase; its review time is unbounded and cannot be a gating dependency.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 05.1 → 05.2 → 05.3 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15

Milestone v2.0 begins at Phase 6. Phases 9 → 10 → 11 → 12 are a hard ordering (each of Inventory, Delivery, and Customers edits the same `placeOrder` transaction; Analytics must follow Delivery). Phase 13 → 14 is a hard ordering (the public marketplace needs real listings). Phase 15 is independent and last by choice.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Multi-Tenant Foundations & Domain Resolution | v1.0 | 7/7 | Complete | 2026-08-17 |
| 2. Merchant Auth, Entitlements & Trial | v1.0 | 7/7 | Complete | 2026-08-23 |
| 3. Product Catalog & Order/Payment-Claim State Machine | v1.0 | 6/16 | In Progress | - |
| 4. Theme/Section/Block System & Flagship Template | v1.0 | 15/16 | In Progress | - |
| 5. Template Segment Expansion | v1.0 | 9/22 | In Progress | - |
| 05.1. Template Preview Rendering & Picker Redesign | v1.0 | 9/9 | Complete | 2026-09-08 |
| 05.2. Marketing Landing Page Redesign | v1.0 | 1/1 | Complete | 2026-09-08 |
| 05.3. Storefront Editor Page Split | v1.0 | 3/4 | In Progress | - |
| 6. Merchant Dashboard & Platform Admin | v2.0 | 7/17 | In Progress|  |
| 7. Trial & Template-Tier Business Rules | v2.0 | 0/TBD | Not started | - |
| 8. Design System & Visual Migration | v2.0 | 0/TBD | Not started | - |
| 9. Inventory | v2.0 | 0/TBD | Not started | - |
| 10. Delivery | v2.0 | 0/TBD | Not started | - |
| 11. Customers | v2.0 | 0/TBD | Not started | - |
| 12. Analytics | v2.0 | 0/TBD | Not started | - |
| 13. Marketplace Marketing | v2.0 | 0/TBD | Not started | - |
| 14. Marketplace | v2.0 | 0/TBD | Not started | - |
| 15. Custom Domains | v2.0 | 0/TBD | Not started | - |

---
*Milestone v2.0 phases added 2026-09-13. Phase 6 reconciled (kept, not renumbered) as v2.0's foundation phase; its v1.0 requirement mappings are unchanged.*
