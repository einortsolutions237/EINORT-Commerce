# Feature Research

**Domain:** Multi-tenant storefront-builder commerce SaaS (Shopify-style "create → customize → publish → sell"), Cameroon-first, manual-payment-claim checkout
**Researched:** 2026-08-16
**Confidence:** MEDIUM (HIGH on Shopify OS2.0 architecture and WooCommerce manual-payment patterns via official docs; MEDIUM on Africa-specific competitor behavior, sourced from secondary coverage of Bumpa/Catlog/Selar rather than their own docs; MEDIUM on Cameroon MoMo/Orange Money mechanics)

## Feature Landscape

### Table Stakes (Users Expect These)

Features merchants assume exist in any "build a store" SaaS. Missing these makes the product feel broken or untrustworthy, regardless of how good the templates look.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Guided signup → live store in one sitting | Every modern builder (Wix Blueprint AI, Squarespace, Shopify) frames onboarding as "answer a few questions, get a real result," not a blank canvas. Cameroonian merchants with limited time/data will abandon a builder that doesn't produce something visible fast. | MEDIUM | Sequence must minimize typing (pick, don't type, wherever possible — segment/industry picker, color swatches, not free-text theme config) per Squarespace's Blueprint pattern. |
| Industry/segment template picker | Users expect the tool to already know what a "fashion store" or "grocery store" should look like, not start from a blank layout. | LOW–MEDIUM | Maps directly to the Theme→Page→Section→Block recombination approach already planned. |
| Logo + brand color capture during onboarding | Baseline personalization; without it the store looks like a demo, not "their" business. | LOW | Simple upload + color picker; auto-derive an accent palette from logo dominant color is a nice-to-have, not required for V1. |
| Product catalog basics: images, price, variants, stock count, categories | This is the actual product being sold through the store — without it there's no storefront. | MEDIUM | Image auto-crop/enhancement is already scoped; keep variant model simple (size/color style) not a full attribute matrix. |
| Section/block theme editor (add/remove/reorder sections, edit content in place) | Since Shopify Online Store 2.0 (2021), "click into a live preview and edit blocks directly" is the baseline mental model merchants bring from other tools — even non-Shopify users have seen this pattern via Wix/Squarespace. A theme editor that requires re-publishing to see changes, or that only lets you fill in fixed slots, feels dated. | HIGH | Confirmed architecture (Shopify docs, HIGH confidence): JSON template → sections → blocks, each section/block has a schema defining its own settings. This 3-layer schema-driven model, not a flat page builder, is what makes an editor feel "real." |
| Live/instant preview while editing | Users expect WYSIWYG — see the change before publishing. | MEDIUM | Can be same-tab live preview iframe; doesn't need real-time collaborative multi-user editing. |
| Subdomain live URL immediately at signup | The core promise ("live in minutes") requires a working, shareable URL before the merchant does anything else. | LOW | `merchant.einort.com` pattern; must resolve correctly with tenant-safe hostname lookup from day one (already scoped). |
| Order notifications to the merchant | A merchant who doesn't know an order came in will lose the sale (especially critical since there's no auto-charge — a human must act on "Payment Claimed"). | LOW–MEDIUM | Email at minimum; WhatsApp/SMS notification is a strong differentiator given the WhatsApp-order channel already in scope. |
| Basic merchant dashboard: orders, products, sales numbers | Every commerce SaaS has this; merchants run their business day-to-day from here, not the storefront. | MEDIUM | Already scoped. Keep sales numbers to today/week/month totals — no cohort/funnel analytics for V1. |
| Cart → checkout flow with clear order confirmation | Customers expect confirmation that an order was placed, standard ecommerce UX. | LOW–MEDIUM | Critical given no live payment: the "your order is registered, payment is being confirmed" state (already scoped) IS the table-stakes replacement for the "payment succeeded" screen customers expect elsewhere. |
| Mobile-responsive storefront | The overwhelming majority of Cameroonian shoppers browse on phones over mobile data. A desktop-first template that breaks on mobile is a launch blocker, not a nice-to-have. | MEDIUM | Should be validated per template, not assumed from a single flagship. |
| Trial period with clear limits and expiry | Standard SaaS pattern; merchants expect to try before paying. | LOW–MEDIUM | Already scoped as 10-day full-feature trial, server-enforced. |

### Differentiators (Competitive Advantage)

Features that set EINORT apart from generic global builders (Wix/Shopify, which don't fit Cameroonian payment/behavior realities) and from lighter Africa-focused tools (Bumpa, Catlog, Selar — which lean WhatsApp-catalog-first rather than full customizable storefronts).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Portfolio-quality flagship template as the design anchor | Most low-cost/emerging-market store builders (and even many Wix templates — "over 500 templates... chances are your website looks like thousands of others") produce visibly generic results. A genuinely polished flagship signals "this looks like it cost money," which is explicitly the stated Core Value. | HIGH | Already scoped and the highest-risk/highest-payoff phase. The differentiator is design quality, not editor feature count. |
| Manual Mobile Money / Orange Money claim flow purpose-built for local behavior | Global builders assume a payment gateway. Africa-focused local tools mostly route to WhatsApp DM entirely, losing the "real storefront with cart and stock" experience. A first-class in-product "here's the number, here's the exact amount, tap to dial USSD, mark as paid, upload proof" flow is closer to how Cameroonian merchants already operate informally, but formalized and trustworthy. | MEDIUM–HIGH | USSD codes confirmed live in Cameroon: MTN MoMo merchant payment via `*126*4*<merchant code>*<amount>#`, Orange Money via `*144#` (MEDIUM confidence, general regional docs — verify exact Cameroon merchant-code USSD string before build, codes vary by operator/market). Tap-to-dial via `tel:` URI is trivial to implement; the differentiator is making manual payment feel designed rather than improvised. |
| WhatsApp order as a first-class checkout option, not a fallback | Confirms merchants' existing behavior (WhatsApp is already the de facto checkout channel across West/Central African informal commerce, per Catlog's whole product thesis) while still giving them a "real" storefront with catalog/cart/stock the WhatsApp-only tools don't provide. | LOW–MEDIUM | Pre-filled cart summary message via `wa.me` deep link; already scoped. |
| Subscription tiers as pure entitlement gates on one codebase (no per-tier forks) | Avoids the classic SaaS trap where "every pricing change requires a codebase audit... every feature gate is a one-off hack." Doing this right from day one is a genuine technical differentiator vs. competitors who bolt tiers on later. | MEDIUM–HIGH | Requires server-side entitlement checks at the API layer (never trust client-side plan state), a single entitlements config keyed by plan, and UI that reflects — never enforces — those checks. This is architecture work, not a customer-facing "feature," but it's what lets Starter/Business/Professional exist without forking the app. |
| One-tap merchant payment-claims queue (confirm/reject with reference + screenshot visible) | Turns the manual-payment weakness (no instant settlement) into a fast, low-friction merchant workflow rather than a spreadsheet/WhatsApp mess. This is the operational heart of trust in a no-gateway model. | MEDIUM | Already scoped. The differentiator is speed and clarity of this single screen, since merchants will check it constantly. |
| Segment-mapped template variations from one recombination system | Lets EINORT credibly offer ~20 "different" storefronts (fashion, electronics, beauty, grocery, furniture, general retail) without 20x the design effort — a structural advantage over both bespoke-per-client agencies (slow, expensive) and generic one-size-fits-all builders (visually undifferentiated). | HIGH | Already scoped; success depends on the Theme→Page→Section→Block system actually producing visual variety, not just re-skinned same layouts (see Pitfalls). |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Live payment gateway / PSP integration (MTN MoMo API, Orange Money API, Stripe) at launch | Feels like "real" ecommerce; competitors advertise instant checkout. | PSP approval/integration timelines are unpredictable and can block launch entirely; also adds PCI/compliance surface area a solo 30-day build can't absorb. Already explicitly rejected in PROJECT.md. | Manual claim flow now; treat gateway integration as a parallel, non-blocking conversation track post-launch. |
| Fully free-form drag-and-drop page builder (arbitrary element placement anywhere on canvas) | Feels more "powerful" and gives merchants unlimited creative control. | This is exactly the failure mode documented across drag-and-drop builder critiques: "freedom is mostly an illusion," results end up inconsistent/broken on mobile, and merchants without design skill produce worse-looking stores than constrained templates would. It also massively increases QA surface (any element combination must render correctly). | Schema-driven sections/blocks with bounded settings per block (Shopify OS2.0 pattern) — merchants recombine and restyle within a design system, they don't invent layout from scratch. |
| Full attribute-matrix product variants (e.g., N-dimensional size × color × material × ...) | Larger competitors (Shopify) support this, so it feels like table stakes. | Massive complexity for schema, cart logic, and stock tracking for a 30-day build; most Cameroonian SME catalogs (fashion, electronics, beauty) don't need more than 1–2 variant dimensions. | Simple variant model (one or two dimensions) — already implicitly scoped via "variants" without elaboration; keep it that way. |
| Automatic, instant order status transitions on "I've paid" (trusting the customer's self-report as final) | Simplifies the state machine and feels faster/friendlier for the customer. | This is the single biggest trap in manual-payment-claim systems: self-reported "I've paid" must never auto-confirm an order, or fraud (fake claims) becomes trivial and merchants lose trust in the platform fast. See Pitfalls for detail. | Keep "Payment Claimed" as a distinct, merchant-gated state from "Confirmed" — already correctly scoped in PROJECT.md's state machine. Never collapse the two. |
| Discount codes, customer segmentation, AI-generated descriptions in V1 | Feature-parity pressure vs. Shopify. | Explicitly out of scope already; each adds meaningful surface area (coupon logic, audience rules, AI cost/latency) with low pilot-stage payoff versus getting the core loop (browse → order → get paid) right. | Already correctly deferred in PROJECT.md. |
| Real-time collaborative theme editing (multiple users editing simultaneously) | Sounds modern (Figma-style). | Solo-owner accounts in V1 mean there's no multi-user editing need at all; building conflict resolution/presence for a feature nobody will use is pure waste. | Single-editor session model; revisit only if/when staff accounts are added post-V1. |
| Letting merchants freely edit raw theme code/CSS | Power users may ask for it; feels like "full control." | Breaks the "storefront always looks polished" promise the moment a merchant introduces a rendering bug, and breaks upgradability of the shared template system across all merchants on that theme. | Schema-bounded section/block settings only; no code injection surface in V1. |

## Feature Dependencies

```
Theme → Page → Section → Block editor
    └──requires──> Section/block schema system (settings definitions per section type)
                       └──requires──> Template segment library (flagship + variations built ON this schema)

Subscription tier entitlements (Starter/Business/Professional)
    └──requires──> Server-side entitlement check layer (API-level, not UI-level)
                       └──requires──> Multi-tenant schema with tenant-indexed plan/entitlement state

Manual payment claim flow (COD + MoMo/Orange transfer + claim)
    └──requires──> Order state machine (Cart → Placed → Pending → Claimed → Confirmed/Disputed → Fulfilled)
                       └──requires──> Merchant Payment Claims queue (confirm/reject UI)
                       └──requires──> Customer-facing "payment being confirmed" state (never leaves customer uncertain)

WhatsApp order checkout ──enhances──> Manual payment claim flow (WhatsApp thread becomes the informal verification channel merchants already trust)

Segment template picker (onboarding) ──requires──> Template segment library (must exist before onboarding can offer it)

Tap-to-dial USSD assist ──enhances──> Manual MoMo/Orange transfer claim (reduces friction, not required for the flow to function)

Fully free-form page builder ──conflicts──> Schema-driven section/block editor (cannot have both; free-form breaks the design-system guarantee that makes templates look non-generic)

Auto-confirm on customer "I've paid" click ──conflicts──> Trustworthy manual-payment-claim model (defeats the entire purpose of a merchant-gated Claims queue)
```

### Dependency Notes

- **Theme editor requires the schema system, not the other way around:** build section/block *schema* (what settings a "Hero" or "Product Grid" section exposes) before or alongside the editor UI — the editor is a generic renderer over schema, and the template library is content built with that schema. Sequencing template design before schema finalization risks having to retrofit templates.
- **Entitlements must be server-side from the first tier, not retrofitted:** research strongly confirms (WorkOS, Schematic, general SaaS entitlement literature) that client-side-only gating is a routine and costly mistake — a merchant could otherwise access Professional-tier editor sections while on Starter by manipulating client state. This needs to be an early architectural decision, not a later pass.
- **The order state machine is the single most load-bearing feature in the whole product**, because it's what makes a *promise* — "manual payment can still be a trustworthy checkout experience" — believable. Every other checkout feature (WhatsApp order, USSD tap-to-dial, claims queue) is in service of this state machine, not a parallel feature.
- **Free-form builder conflicts with the "non-generic" differentiator directly:** the research on drag-and-drop builder critiques shows that unconstrained freedom is what produces *generic-looking, inconsistent* results in practice (despite feeling more powerful) — so this anti-feature isn't just a build-time complexity tradeoff, it actively works against the stated Core Value.

## MVP Definition

### Launch With (v1)

Matches PROJECT.md's Active requirements; features below are the ones research confirms are genuinely load-bearing for the "storefront live in minutes, looks expensive, checkout is trustworthy without a gateway" promise.

- [ ] Guided onboarding (business name, industry/segment pick, logo, brand colors) → live subdomain storefront — this is the entire value proposition; everything else supports it
- [ ] Schema-driven Theme→Page→Section→Block editor with live preview — table stakes mental model since Shopify OS2.0 normalized it; a lesser editor undercuts the "looks like it cost money" promise
- [ ] Flagship template built to portfolio quality, ~20 variations via recombination — the actual differentiator; without this the platform is indistinguishable from generic builders
- [ ] Product catalog: images (auto-enhance/crop), simple variants, price, stock count, categories — nothing sells without this
- [ ] Checkout: WhatsApp order, manual MoMo/Orange transfer + claim, COD — matches real payment behavior; a gateway-only checkout would be unusable for the target market
- [ ] Order state machine with distinct Payment Claimed vs. Confirmed states — the trust mechanism; collapsing this is the single most dangerous shortcut available
- [ ] Merchant Payment Claims queue (one-tap confirm/reject, reference + screenshot visible) — without this the claim flow has no resolution path
- [ ] Server-enforced tenant isolation on every query — non-negotiable per PROJECT.md constraints, and confirmed by research as the standard baseline for any multi-tenant SaaS
- [ ] Subscription tiers as server-side entitlement gates, one codebase — must be architected now; retrofitting entitlement checks after V1 ships is the documented failure mode
- [ ] 10-day server-enforced trial — standard SaaS pattern, needed to let merchants evaluate before paying
- [ ] Merchant dashboard: orders (with claims queue), products, basic sales numbers — day-to-day operating surface
- [ ] Super Admin pilot-scoped dashboard: merchants list + suspend, claims ledger, domains, support contact — needed to operate the pilot at all

### Add After Validation (v1.x)

- [ ] Custom domains — already flagged as fast-follow if time allows; add once subdomain flow is proven stable
- [ ] WhatsApp/SMS order notifications to merchants (beyond email) — add once email-only notification proves insufficient for response speed
- [ ] Auto-derive accent palette from uploaded logo — nice onboarding polish, not required to hit "minutes"
- [ ] Additional template segments beyond initial launch set — expand once flagship + 2–3 segments validate the recombination system works visually

### Future Consideration (v2+)

- [ ] Live PSP/gateway integration (MTN MoMo API, Orange Money API) — explicitly deferred; pursue only once manual-claim volume/pain justifies the integration and compliance overhead
- [ ] Staff accounts / multi-user store management — deferred until solo-owner model proves insufficient
- [ ] Discount codes, customer segmentation, AI-generated descriptions — deferred per PROJECT.md; low pilot-stage payoff
- [ ] Multi-warehouse, dedicated search infrastructure — irrelevant at pilot catalog sizes (per PROJECT.md's own 300-products-per-store target, this is premature even at scale)
- [ ] Analytics beyond basic sales numbers — deferred until merchants ask for it post-validation

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Guided onboarding → live storefront | HIGH | MEDIUM | P1 |
| Schema-driven section/block editor | HIGH | HIGH | P1 |
| Flagship + segment template library | HIGH | HIGH | P1 |
| Manual payment claim flow + state machine | HIGH | MEDIUM–HIGH | P1 |
| Merchant Payment Claims queue | HIGH | MEDIUM | P1 |
| Server-side tenant isolation | HIGH (non-negotiable) | MEDIUM | P1 |
| Server-side subscription entitlements | HIGH | MEDIUM–HIGH | P1 |
| WhatsApp order checkout | HIGH | LOW–MEDIUM | P1 |
| USSD tap-to-dial assist | MEDIUM | LOW | P2 |
| Custom domains | MEDIUM | MEDIUM | P2 |
| WhatsApp/SMS order notifications | MEDIUM | MEDIUM | P2 |
| Auto-derive palette from logo | LOW–MEDIUM | LOW | P3 |
| Live PSP/gateway integration | HIGH (long-term) | HIGH | P3 |
| Discount codes / segmentation | LOW (pilot stage) | MEDIUM | P3 |
| Full attribute-matrix variants | LOW (pilot catalogs) | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Shopify (global reference) | Bumpa / Catlog / Selar (Africa-focused lighter tools) | Our Approach |
|---------|------------------------------|--------------------------------------------------------|--------------|
| Theme customization | Full Online Store 2.0 sections/blocks system, JSON templates, app blocks, up to 25 sections/1250 blocks per template — the industry-defining pattern | Generally simpler: catalog/list-based storefronts or WhatsApp-catalog-first, not a full section-based visual theme editor (MEDIUM confidence — not independently verified against their own docs) | Adopt Shopify's schema-driven sections/blocks pattern at V1 scope (fewer section types, same underlying model), anchored on a portfolio-quality flagship rather than breadth of options |
| Checkout / payments | Native gateway integrations (Shopify Payments, Stripe, etc.), instant confirmation | Payment collection often routes through mobile money/bank transfer instructions or WhatsApp DM handoff, similar informal pattern to what we're formalizing (MEDIUM confidence) | Manual MoMo/Orange transfer + claim + COD + WhatsApp order, formalized into a first-class in-product flow with a real state machine — not just a DM handoff |
| Onboarding | Full ecommerce "operating system" onboarding: products, shipping zones, payments, theme — broader and slower than a pure storefront builder | Fast setup focused on adding a product list/catalog and going live for WhatsApp-based selling (MEDIUM confidence) | Faster than Shopify (single "add products + pick template" loop, no shipping-zone complexity in V1), more visually complete than WhatsApp-catalog-only tools |
| Multi-tenant/subscription model | Shopify itself is the platform; merchants are effectively tenants of a single global SaaS with tiered plans | Typically flat SaaS pricing per merchant account, not published as an explicit entitlement-gated tier system in public materials found (LOW confidence — not verified) | Explicit Starter/Business/Professional entitlement tiers gating editor/section access and catalog limits on one shared codebase |
| Trust/verification | Automatic, gateway-confirmed payment — trust is delegated to the PSP | Trust is largely social/manual (DM negotiation, informal transfer) with no dedicated claims/verification UI documented (LOW confidence) | Dedicated Payment Claims queue with reference + screenshot, explicit Confirmed/Disputed states — more structured than either extreme |

## Sources

- Shopify Help Center, "Sections and blocks" — https://help.shopify.com/en/manual/online-store/themes/theme-structure/sections-and-blocks (HIGH confidence, official docs)
- Shopify.dev, "Sections" architecture docs — https://shopify.dev/docs/storefronts/themes/architecture/sections (HIGH confidence, official docs)
- Shopify.dev, "Building with sections and blocks" best practices — https://shopify.dev/docs/storefronts/themes/best-practices/templates-sections-blocks (HIGH confidence, official docs)
- Shopify Help Center, "Theme architecture versions and sources" — https://help.shopify.com/en/manual/online-store/themes/managing-themes/versions (HIGH confidence)
- WooCommerce official docs, "Troubleshooting Orders" and order status behavior for Direct Bank Transfer (BACS) — https://woocommerce.com/document/managing-orders/troubleshooting-orders/ (HIGH confidence, official docs, confirms manual-payment "On Hold until manually verified" pattern used as precedent for the Payment Claimed→Confirmed split)
- WordPress.org support thread on Direct Bank Transfer order status behavior (MEDIUM confidence, community-verified but not official)
- Practical Ecommerce, "Top Ecommerce Tools in Africa" — https://www.practicalecommerce.com/top-ecommerce-tools-in-africa (MEDIUM confidence)
- Microtraction, "Automate your Ecommerce Business with Bumpa" — https://www.microtraction.com/post/automate-your-ecommerce-business-with-bumpa (MEDIUM confidence, secondary coverage)
- Dignited, "Five African Platforms for Selling Digital Products and Services Online" (covers Selar) — https://www.dignited.com/99088/sell-digital-products-online/ (MEDIUM confidence)
- Nairametrics, "The trust problem killing Nigerian ecommerce (and how it gets solved)" — https://nairametrics.com/2026/08/03/the-trust-problem-killing-nigerian-ecommerce-and-how-it-gets-solved/ (MEDIUM confidence, regional trust/COD/fraud context)
- TechCabal, "Why Nigerians keep getting scammed buying online, and how escrow fixes it" — https://techcabal.com/2026/06/30/why-nigerians-keep-getting-scammed-buying-online-and-how-escrow-fixes-it/ (MEDIUM confidence)
- Riverpe, "Cameroon Payment Methods MTN MoMo & Orange Money" — https://www.riverpe.com/blog/cameroon-payment-methods-mtn-momo-orange-money (MEDIUM confidence — USSD code details should be re-verified against MTN Cameroon/Orange Cameroon official merchant docs before implementation)
- MTN Cameroon, "MoMo Bills Payment" — https://mtn.cm/helppersonal/momo-bills-payment/ (MEDIUM confidence, official but consumer-bill-pay page, not merchant-collection-specific)
- Autoflowly, "How to Accept Mobile Money Online in 2026" — https://autoflowly.com/blog/accept-mobile-money-online-store-2026 (MEDIUM confidence)
- 404 Marketing, "The Hidden Downsides of Drag & Drop Website Builders" — https://404marketing.co.uk/web-design/the-hidden-downsides-of-drag-drop-website-builders-for-small-businesses/ (MEDIUM confidence, industry commentary)
- Raytha, "The problem with drag and drop website builders is the mindset" — https://raytha.com/blog/The-problem-with-drag-and-drop-website-builders-is-the-mindset (LOW-MEDIUM confidence, opinion piece, used only for corroborating the "generic results" pattern already seen elsewhere)
- WorkOS, "The developer's guide to SaaS multi-tenant architecture" — https://workos.com/blog/developers-guide-saas-multi-tenant-architecture (MEDIUM confidence)
- Schematic, "SaaS Entitlement: Monetization Lessons From SaaS Operators" — https://schematichq.com/blog/saas-entitlements-a-roundup-of-some-of-the-best-thinking-and-writing-on-the (MEDIUM confidence)
- Meta for Developers, WhatsApp Catalogs/cart documentation — https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/catalogs-overview/ (HIGH confidence, official docs, confirms cart/catalog message pattern)
- Squarespace/Wix onboarding comparison coverage (emergent.sh, zapier.com) (MEDIUM confidence, secondary comparison articles, used only for onboarding-flow shape, not as authoritative product documentation)

---
*Feature research for: Multi-tenant storefront-builder commerce SaaS, Cameroon-first*
*Researched: 2026-08-16*
