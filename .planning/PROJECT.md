# EINORT-Commerce

## What This Is

EINORT-Commerce is a multi-tenant commerce platform that lets Cameroonian small and medium business owners create a professional, good-looking online storefront in minutes using pre-built templates — without hiring developers or waiting months for an uncertain result. It is modeled on Shopify's product promise (Create → Customize → Publish → Sell) but is not attempting Shopify's scope or feature parity in V1. The architecture is deliberately built with a path to massive scale (eventually 100 → 1,000 → 100,000 → 1,000,000+ storefronts) in mind, but V1 itself is a 30-day, Cameroon/Douala-first, solo-built product.

## Core Value

A merchant picks an industry, adds a logo and a few products, and within minutes has a storefront that looks like it cost them money to build. Everything else — subscriptions, dashboards, order management, the platform admin surface — exists to support that moment and to let the merchant actually run a business afterward.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Merchant signup → guided onboarding (business name, industry, logo, brand colors) → live storefront on an EINORT subdomain, in minutes
- [ ] ~20 visually distinct storefront template variations, produced by recombining a small set of segment-flagship layouts through a Theme → Page → Section → Block system (not 20 independently bespoke designs) — mapped to real Cameroonian merchant segments (fashion, electronics, beauty/cosmetics, grocery/food, furniture/home, general retail)
- [ ] Flagship template (fashion/apparel segment) built to genuinely polished, portfolio-quality standard, anchored on the zinc-monochrome DTC visual reference already supplied — this is the pattern library the other variations inherit from
- [ ] Section/block-based storefront customization editor, gated by subscription tier
- [ ] Product catalog: images (with automatic enhancement/cropping), variants, price, simple stock count, categories
- [ ] Storefront checkout ending in one of: WhatsApp order (pre-filled cart message), manual Mobile Money/Orange Money transfer (receiving number + exact amount shown, tap-to-dial USSD assist where possible, "I've paid" + transaction reference + optional screenshot), or Cash on Delivery
- [ ] Order state machine: Cart → Order Placed → Payment Pending → Payment Claimed → Confirmed/Disputed → Fulfilled, with a customer-facing "payment being confirmed" state that never leaves the customer uncertain the order registered
- [ ] Merchant-side Payment Claims queue: one-tap confirm/reject per claim, transaction reference and screenshot visible
- [ ] Multi-tenant foundations: tenant-indexed schema (every tenant-scoped table carries an indexed tenant ID from the first migration), server-side tenant enforcement on every query, tenant-safe hostname resolution (subdomain now, custom domain as fast-follow if time allows)
- [ ] Subscription plans (Starter / Business / Professional, entitlements per v4.0's pricing structure as a reference point) as limits on one shared codebase — never separate codebases per tier
- [ ] 10-day full-feature trial, server-side enforced
- [ ] Merchant dashboard: orders (with payment confirmation queue), products/inventory, basic sales numbers
- [ ] Super Admin dashboard for the platform owner (the user): merchants/stores list with suspend, payment-claims ledger view, domains, support contact — pilot-scoped, not the full ~20-module admin surface from the design reference
- [ ] Merchant↔platform support messaging: a persistent, per-merchant in-app thread (text + file/image attachments) between the platform owner and each merchant, with an in-app badge and email nudge on new activity — no real-time/websocket infrastructure
- [ ] Merchant subscription payment verification: a merchant pays their monthly plan via manual Mobile Money/Orange Money transfer and submits proof through the support-messaging thread; the platform owner confirms/rejects it there, reusing the same manual-claim-and-verify pattern built for customer→merchant payments with payer/payee reversed
- [ ] Architecture decisions (schema, indexing, async job/queue pattern for order placement and notifications) made with a 2,000,000-store / 300-products-per-store target in mind, without building or load-testing at that scale in V1

### Out of Scope

- Live payment gateway / PSP API integration (MTN MoMo, Orange Money APIs, Stripe, Paystack, etc.) — explicitly rejected for V1 even though the v4.0 reference document listed a live integration as P0; the user's own confirmed approach is manual transfer + claim + verification only. Pursue provider conversations in parallel if desired later; never a launch blocker.
- Vendure or Medusa as the commerce engine — v4.0 recommended evaluating these, but rejected in favor of a custom Next.js/Prisma layer to avoid framework learning-curve risk for a solo 30-day build.
- 40-day timeline / v4.0's larger feature set as a whole — v4.0 is a useful reference for detail (data model, pricing structure, non-functional requirements) but the 30-day window governs scope, not v4.0's schedule.
- 20 independently hand-designed bespoke templates — recombination of a smaller flagship set via the block system instead, to keep the highest-risk phase (template visual quality) achievable solo.
- Wholesale/B2B, staff accounts beyond one owner login, discount codes, customer segmentation, AI-generated descriptions, analytics beyond basics, multi-warehouse, dedicated search infrastructure — deferred; matches both source documents' exclusion lists.
- Custom domains — fast-follow if time allows within the 30 days, not a launch blocker.
- Any platform admin module beyond the pilot-scoped list (analytics, fraud/abuse, theme library management, feature flags, broadcast notifications, full observability, usage dashboards) — deferred to post-launch per both source documents.

## Context

Two prior planning documents inform this project and were reconciled during initialization:

- **EINORT-Commerce V1 Build Plan** (30-day version, supplied as project instructions) — trims a larger original spec specifically to make a 30-day solo/small-team delivery realistic; deliberately cuts live payment integration and commerce-framework adoption as the two biggest risk reducers.
- **EINORT-Commerce Master Specification v4.0** (uploaded PDF, `EINORT-Commerce_Master_Specification_v4.pdf`) — a more detailed 40-day specification with a fully specified subscription/pricing model, a 2,000,000-store scale mandate, a P0–P3 feature prioritization framework, and a recommendation to build on Vendure or Medusa. Treated as a detail reference (data model, pricing tiers, non-functional requirements, security requirements) rather than the governing timeline/scope document — several of its specific recommendations (40-day window, live PSP as P0, Vendure/Medusa) were explicitly overridden during project initialization in favor of the 30-day plan's positions.
- A front-end prototype (`einort-commerce.zip`, React/Vite/Zustand, generated via Google AI Studio/Gemini) was supplied as a **visual reference only** — palette (zinc monochrome), typography (Plus Jakarta Sans/Outfit), motion language, and editorial copy voice for the fashion-segment flagship template. It is explicitly not production code: its storefront components hardcode colors instead of using its own theme tokens, its checkout is a simulated instant-pay flow that doesn't match this project's manual-payment-claim order state machine, and its locale defaults (Senegal/Côte d'Ivoire/Ghana/Nigeria) are not Cameroon-specific. See project memory `project_einort_flagship_visual_reference` for the full breakdown.
- The user is a solo builder driving the entire 30-day build through Claude Code, and is also the platform owner (the Super Admin dashboard user).
- Market: Cameroon-exclusive for V1, Douala-focused pilot, XAF currency, Orange Money/MTN Mobile Money as the payment context (handled via manual transfer, not API integration).

## Constraints

- **Timeline**: 30 days, solo builder — governs scope; v4.0's larger feature set is trimmed to fit, not used to extend the timeline.
- **Tech stack**: Next.js (App Router) + TypeScript, PostgreSQL + Prisma, Redis, S3-compatible object storage (e.g. Cloudflare R2), Vercel + managed Postgres — chosen over a commerce framework (Vendure/Medusa) for solo-dev speed and control.
- **Payments**: No live PSP/gateway integration in V1 — manual Mobile Money/Orange Money transfer instructions + claim/verify flow + Cash on Delivery + WhatsApp order only.
- **Security**: Tenant isolation must be enforced server-side on every query, non-negotiable regardless of pilot scale. Never trust price, stock, tenant ID, or payment/order status from the client.
- **Market**: Cameroon/Douala-first; architecture stays multi-country-ready in the data model (currency/locale) without building expansion-market features.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 30-day timeline governs over v4.0's 40-day figure | Solo builder capacity; original 30-day plan's risk analysis already stress-tested against this team size | — Pending |
| Custom Next.js/Prisma over Vendure/Medusa | Avoid commerce-framework learning curve and "fighting the framework's opinions" for a solo dev on a tight timeline | — Pending |
| ~20 template variations via Theme→Page→Section→Block recombination, not 20 bespoke designs | Achievable solo; matches the block-based customization architecture already required for the section editor | — Pending |
| No live payment gateway in V1; manual Mobile Money/Orange Money transfer + claim + USSD tap-to-dial assist | Matches actual Cameroonian merchant/customer behavior per the user; avoids PSP approval/integration delays as a launch blocker | — Pending |
| Zinc-monochrome DTC reference adopted as the fashion-segment flagship template direction | User-supplied visual reference judged as a tasteful, non-generic starting point superior to inventing a direction from adjectives | — Pending |
| Architect for v4.0's 2,000,000-store / 300-products-per-store scale target without building or load-testing it in V1 | Cheap as a schema/indexing design discipline now; expensive to retrofit later; zero added engineering time at pilot scale | — Pending |
| Merchant↔platform support messaging (SUB-03/ADM-05) built as a lightweight async in-app thread, not real-time chat, and slotted into Phase 6 rather than a new dedicated phase | User request (2026-08-23); async thread matches the manual-first pattern already established for payment claims and avoids new real-time infrastructure; Phase 6 already builds both the merchant dashboard and the Super Admin surface this thread lives in, and only has real subscription/claim data to work with once Phase 3 ships | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-16 after initialization*
