# Subscription Plan Pricing & Feature Reference

**Source:** `EINORT-Commerce_Master_Specification_v4.pdf`, Section 4.4 (uploaded by the user during project planning, not committed to this repo — this file exists so the pricing/feature data is available to downstream agents without needing to re-fetch the PDF). Verbatim structure preserved; used to resolve `02-RESEARCH.md`'s OQ-1 and OQ-2.

Every plan gets the same 10-day full-feature trial. Annual pricing is ~10 months of monthly pricing for 12 months of access.

## Starter — Launch & Grow
**5,000 FCFA/month | 50,000 FCFA/year**
Target: small retailers, individual entrepreneurs, first structured online store.

- Storefront: 1 online store, EINORT subdomain, custom domain connection, 3–5 standard templates, basic theme customization, logo and brand colors, basic homepage sections, About/Contact pages, responsive storefront
- Products & Inventory: up to 50 products, categories, product images, variants, prices, stock quantities, basic inventory management
- Commerce: shopping cart, checkout, order creation and dashboard, order status management, customer information and history, Cash on Delivery, one supported online payment integration (subject to provider availability — **not built in V1**, see PROJECT.md constraints), basic delivery zones and fixed fees, WhatsApp contact/support
- Analytics: orders, revenue, products sold, basic merchant dashboard
- **Staff accounts: none beyond the owner.** `membershipLimit = 1`.

## Business — Scale ("Most Popular")
**12,500 FCFA/month | 125,000 FCFA/year**
Target: growing businesses needing more catalogue capacity, operational controls, reporting. Includes everything in Starter, plus:

- Up to 250 products; advanced storefront customization, more homepage sections, featured products and promotional banners, custom navigation, additional pages
- Advanced product variants; bulk product import, export and editing
- Inventory history; stock alerts / low-stock indicators
- Advanced order search and filtering; order export
- Customer search and purchase history
- Discount codes; promotional pricing
- Sales trends, best-selling products, product performance, customer/order statistics
- **Up to 3 staff accounts** (in addition to the owner) → `membershipLimit = 4`
- Priority support

## Professional — Pro
**25,000 FCFA/month | 250,000 FCFA/year**
Target: established businesses, larger teams, maximum V1 operational capability. Includes everything in Business, plus:

- Unlimited products; advanced storefront customization, more advanced theme controls, custom promotional sections, advanced homepage configuration
- Advanced inventory dashboard, inventory adjustments, stock movement history, bulk inventory management
- Advanced order filtering and management; exportable order data
- Customer groups, tagging and basic segmentation
- Advanced discount rules; promotional campaigns
- Advanced sales dashboard, revenue trends, product performance reporting, basic customer analytics, exportable reports
- **Up to 10 staff accounts** (in addition to the owner) → `membershipLimit = 11`
- Priority support; assisted onboarding

## Enterprise / Wholesale — Custom
Custom pricing, sales-assisted. Out of scope for V1 per REQUIREMENTS.md (no wholesale/B2B in this milestone) — do not build a signup path for this tier.

---

## Resolved Open Questions from 02-RESEARCH.md

- **OQ-1 (blocking):** Resolved — this document is the source of truth for plan-selection screen copy and entitlement limits.
- **OQ-2:** Resolved — "Up to N staff accounts" is in addition to the owner. `membershipLimit` (which Better Auth counts inclusive of the owner, per 02-RESEARCH.md finding #3) should be set to N+1 per tier: Starter=1, Business=4, Professional=11.

**Note on V1 scope vs. this list:** Not every bullet above is buildable in V1 per REQUIREMENTS.md's existing v2-deferred list (discount codes, bulk import/export, customer segmentation are all explicitly deferred — see REQUIREMENTS.md's "v2 Requirements" section). This document's role is to supply the *marketing/pricing-page copy* for the plan-selection screen per CONTEXT.md's D-02 ("show the real planned feature differences... do not invent a slimmer feature list") — it does not mean Phase 2 must build every listed feature now. The entitlement *mechanism* only needs to enforce what's actually gateable this phase (staff/store limits per CONTEXT.md's D-07); the rest of the list is aspirational copy a future merchant would grow into.
