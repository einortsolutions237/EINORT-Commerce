# Project Research Summary

**Project:** EINORT-Commerce
**Domain:** Multi-tenant commerce storefront-builder SaaS (Shopify-style "create → customize → publish → sell"), Cameroon-first, manual-payment-claim checkout, solo 30-day build
**Researched:** 2026-08-16
**Confidence:** MEDIUM-HIGH

## Executive Summary

EINORT-Commerce is a multi-tenant storefront-builder in the Shopify Online Store 2.0 mold: merchants pick a segment template, customize it through a schema-driven section/block editor, and get a live subdomain storefront in minutes. Experts build this class of product on a shared-schema, `tenantId`-indexed Postgres database (never schema-per-tenant), with tenant identity resolved server-side exclusively from hostname (storefront) or session (dashboard) and enforced through a single centralized data-access layer — never trusted from client input. The recommended stack — Next.js 16 / React 19 / TypeScript 7, Prisma 7 with driver adapters, Neon Postgres, Better Auth, Upstash Redis, Cloudflare R2 + Sharp — is current, mutually compatible, and specifically chosen to minimize solo-developer operational surface (no persistent workers, no second auth vendor, HTTP-based Redis with no connection-pooling headaches).

The recommended approach sequences work around two non-negotiable foundations that everything else depends on: (1) tenant-scoped data access enforced structurally via a Prisma Client Extension from the first migration, and (2) a schema-driven Theme→Page→Section→Block content model where section/block *types* live in code and *instances* live in the database. On top of that foundation, the product's real differentiator is not feature breadth but design quality (a portfolio-grade flagship template) and a trustworthy manual-payment-claim flow purpose-built for Cameroonian MoMo/Orange Money/WhatsApp behavior — replacing the "payment succeeded" moment other builders get for free from a PSP with a deliberate, merchant-gated Payment Claims queue and a state machine that never lets a customer sit in ambiguous limbo.

The key risks are well-documented and mutually reinforcing: cross-tenant data leaks (the single most consequential class of bug in this architecture), inventory oversell during the long manual-payment pending window, payment-claim fraud (fake/reused transaction references), template recombination collapsing into "same layout, different color" genericness that undermines the core value proposition, and — specific to a solo AI-assisted build — architectural drift across long Claude Code sessions without a stable shared-pattern reference. Mitigation is consistent across all four research files: centralize the risky logic (tenant scoping, entitlement checks, payment-state transitions, stock decrement) into a small number of shared server-side modules that every feature is required to call, test tenant isolation and stock concurrency automatically on every deploy, and sequence security/trust-critical phases before or alongside — never strictly after — the highest-visibility template-design work, since design has no natural stopping point and will otherwise crowd out invisible, high-risk work under solo time pressure.

## Key Findings

### Recommended Stack

Next.js 16 (App Router, stable React Compiler) + React 19 + TypeScript 7 forms the application layer, backed by Prisma 7 (driver-adapter architecture, no more implicit Rust engine — budget setup time for `prisma.config.ts`) against Neon-hosted Postgres 17, chosen over Supabase specifically for instant copy-on-write DB branching per preview deploy. Better Auth replaces both Auth.js (now maintenance-mode, its own team recommends migrating away) and Clerk (wrong economics for a mostly-anonymous, accountless-checkout shopper population) — its `organization` plugin maps near-exactly onto "tenant." Upstash Redis (HTTP-based, no connection-pooling problem) backs tenant-hostname caching, guest carts, rate limiting, and idempotency keys. Cloudflare R2 + Sharp handle image storage/processing via presigned direct-to-R2 uploads (bypassing Vercel's body-size limit), run synchronously in the Node.js runtime (Sharp cannot run on Edge). Async work uses `waitUntil()` first, escalating to Vercel Queues/Workflow (native to the platform, zero new vendor) only where guaranteed delivery is actually needed — explicitly avoiding BullMQ or any persistent worker process, which would violate the solo-Vercel-only constraint.

**Core technologies:**
- Next.js 16 + React 19 + TypeScript 7 — current stable stack, React Compiler removes manual memoization busywork for a solo dev
- Prisma 7 + `@prisma/adapter-pg` on Neon Postgres — shared-schema multi-tenancy at 2M-store scale target, pooled connection string mandatory
- Better Auth (self-hosted, Prisma-backed) — `organization` plugin as the tenant primitive, avoids per-MAU vendor cost for anonymous shoppers
- Upstash Redis + `@upstash/ratelimit` — hostname cache, cart sessions, rate limiting, idempotency, all HTTP-based (serverless-safe)
- Cloudflare R2 + Sharp + AWS SDK v3 (S3-compatible) — presigned direct uploads, synchronous Node.js-runtime image processing

### Expected Features

The product is judged against the Shopify OS2.0 mental model (schema-driven sections/blocks, live preview, instant subdomain) as table stakes, while its actual competitive edge is a portfolio-quality flagship template plus a first-class (not WhatsApp-DM-fallback) manual payment-claim experience that Africa-focused lighter tools (Bumpa/Catlog/Selar) don't offer alongside a real storefront.

**Must have (table stakes):**
- Guided onboarding → live subdomain storefront in one sitting (pick, don't type)
- Schema-driven Theme→Page→Section→Block editor with live preview
- Product catalog basics (images, price, simple variants, stock, categories)
- Cart → checkout with a clear "payment being confirmed" order-confirmation state
- Mobile-responsive storefront, order notifications to merchant, 10-day server-enforced trial

**Should have (competitive differentiators):**
- Portfolio-quality flagship template as the design anchor (the actual differentiator, not editor feature count)
- First-class manual MoMo/Orange Money claim flow (tap-to-dial USSD, reference + screenshot) formalized beyond a WhatsApp DM handoff
- One-tap merchant Payment Claims queue (confirm/reject with evidence visible)
- Subscription tiers as pure server-side entitlement gates on one codebase, no per-tier forks
- Segment-mapped template variations from one recombination system (~20 from a handful of flagships)

**Defer (v2+):**
- Live PSP/gateway integration (MTN MoMo API, Orange Money API) — explicitly rejected for V1
- Full free-form drag-and-drop builder, full attribute-matrix variants, discount codes/segmentation, staff accounts, real-time collaborative editing — all explicitly anti-features that either conflict architecturally with the schema-driven design system or add complexity with no pilot-stage payoff

### Architecture Approach

One Next.js deployment serves three surfaces (hostname-routed tenant storefronts, session-routed merchant dashboard, owner-only platform admin) over a shared-schema Postgres database where every tenant-scoped table carries an indexed `tenantId` column. Tenant identity is resolved exactly two ways — middleware-resolved hostname for storefronts, authenticated session for the dashboard — and both funnel into a single `scopedDb(tenantId)` factory built on a Prisma Client Extension, making "forgot the tenant filter" structurally impossible rather than a code-review hope. The Theme→Page→Section→Block content model splits into a code-level registry (component + Zod settings schema per section/block *type*) and a relational instance model (which types, in what order, with what settings, per tenant page) — bounded recombination, not an open-ended page builder or runtime content-type system.

**Major components:**
1. Host resolver (middleware) — maps `Host` header to tenant via Redis-cached lookup, fails closed on unknown hosts, runs before any route handler
2. Tenant-scoped data-access layer (`scopedDb`) — the single sanctioned entry point for all tenant-scoped queries; platform admin uses a deliberately separate unscoped client, isolated in its own service module
3. Theme/Section/Block engine — code-defined type registry + relational instance rows, rendering server components from tenant page trees
4. Order/payment-claim state machine — enum status + audit `OrderEvent` table, transitions only through service-layer functions, never direct client writes
5. Async/notify layer — thin `enqueue()` interface starting on `waitUntil()`, escalating to Vercel Queues/Workflow only where retries are genuinely required

### Critical Pitfalls

1. **Cross-tenant data leak via forgotten or client-trusted tenant scoping** — the single most consequential bug class; avoid by making the Prisma Client Extension the only sanctioned tenant-scoped query path and writing an automated two-tenant isolation test that runs on every deploy.
2. **Subdomain/hostname routing edge cases** (reserved-word slug collisions, wildcard auth cookies leaking across subdomains, stale cached tenant resolution after suspend) — avoid with a hard-coded reserved-slug blocklist enforced at signup, narrow cookie `Domain` scoping (or fully separate dashboard/admin hosts), and short-TTL cache invalidation on tenant state change.
3. **Manual payment-claim flow becomes a fraud/trust liability** — a reused or fabricated transaction reference can be rubber-stamped by a busy merchant; avoid with a per-tenant-unique reference constraint, an immutable claim-decision audit log, and treating screenshots as evidence only, never as auto-confirming proof.
4. **Inventory oversell during the payment-claim window** — the pending-payment window is minutes-to-hours, not milliseconds, making classic read-modify-write stock races far more likely; avoid with atomic conditional updates (`WHERE stock > 0`), decrement-at-placement (not at-confirmation), and a reservation TTL that releases stock on abandoned orders.
5. **Template recombination collapses into "same layout, different color"** — directly undermines the stated core value ("looks like it cost money"); avoid by making each segment flagship differ *structurally* (layout skeleton, hero type, density, type pairing), reserving chromatic/content variation for merchant-to-merchant personalization within a flagship only.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Multi-Tenant Foundations
**Rationale:** Every other surface (storefront, dashboard, admin) depends on correct, cheap tenant resolution and structurally-enforced query scoping; retrofitting this after feature code exists is the single most expensive mistake this architecture can make. Research (Pitfalls 1, 2, 6) is unanimous that this must be first and non-negotiable.
**Delivers:** Prisma schema with `tenantId` on every tenant-scoped table (composite-indexed), `scopedDb(tenantId)` Prisma Client Extension, middleware hostname resolver with Redis cache + reserved-slug blocklist + fail-closed 404, auth cookie scoping (Better Auth, separate dashboard/admin hosts or explicit `Domain`), and an automated two-tenant isolation test suite wired into every deploy.
**Addresses:** "Subdomain live URL immediately at signup," "Server-enforced tenant isolation on every query" (FEATURES.md table stakes)
**Avoids:** Pitfall 1 (cross-tenant leak), Pitfall 2 (hostname routing edge cases)

### Phase 2: Auth, Entitlements & Trial
**Rationale:** Subscription tiers and the trial gate must be architected as server-side entitlement checks before any tier-gated feature (the editor, in particular) is built on top — retrofitting is the documented failure mode (Pitfall 7, FEATURES.md dependency notes).
**Delivers:** Better Auth wired to Prisma (`organization` plugin = tenant, `platformRole` field for Super Admin), a centralized entitlement-check helper used by every gated mutation, server-computed trial expiry enforced per-request (not per-login).
**Uses:** Better Auth 1.6.x, `@t3-oss/env-nextjs` for config safety
**Implements:** Entitlements service module (`server/entitlements/plan-limits.ts`)

### Phase 3: Product Catalog & Order/Payment-Claim State Machine
**Rationale:** The order state machine is "the single most load-bearing feature in the whole product" (FEATURES.md) — it makes the manual-payment promise trustworthy. Catalog and stock-decrement logic must land together with it because the two interact directly around the oversell race (Pitfall 4).
**Delivers:** Product/variant/stock schema with atomic conditional stock updates and reservation TTL, full order state machine (Cart → Placed → Pending → Claimed → Confirmed/Disputed → Fulfilled) with an `OrderEvent` audit table, per-tenant-unique payment-claim reference constraint, Merchant Payment Claims queue (one-tap confirm/reject with evidence).
**Addresses:** Checkout (WhatsApp order, manual MoMo/Orange transfer + claim, COD), order state machine, Payment Claims queue (FEATURES.md P1 items)
**Avoids:** Pitfall 3 (payment-claim fraud), Pitfall 4 (inventory oversell)

### Phase 4: Theme/Section/Block System & Flagship Template
**Rationale:** The schema (section/block type registry + settings) must exist before the editor or the template library can be built on it (FEATURES.md dependency notes: "editor requires the schema system, not the other way around"). This is also the highest design-risk, highest-payoff, and most time-hazardous phase (Pitfall 8) — sequence it after the trust-critical phases above so a beautiful storefront isn't built on an unproven foundation, and give it an explicit time ceiling.
**Delivers:** Code-level Section/Block type registry (component + Zod schema), relational instance model (Theme/Page/Section/Block tables), portfolio-quality flagship (fashion) template, live-preview editor UI, subscription-tier gating on editor capabilities.
**Addresses:** Section/block theme editor, flagship template, live preview (FEATURES.md P1 items)
**Avoids:** Pitfall 5 (generic-looking recombination), Pitfall 8 (scope creep eating the schedule) — set explicit per-flagship time budgets before starting

### Phase 5: Template Segment Expansion
**Rationale:** Only proceed once the flagship + editor prove the recombination system produces structurally (not just chromatically) distinct results — validated via the side-by-side "would a stranger think these are the same product" check from PITFALLS.md.
**Delivers:** Additional segment flagships (electronics, beauty, grocery, furniture, general retail) built via recombination, each with a genuinely distinct layout skeleton per FEATURES.md's segment-mapped template picker requirement.

### Phase 6: Merchant Dashboard & Platform Admin
**Rationale:** Both surfaces read data that only becomes meaningful once catalog/order/claims flows exist; the admin surface's cross-tenant queries are architecturally isolated (unscoped client) and should be built last to avoid any temptation to reuse tenant-scoped service functions across the admin boundary (ARCHITECTURE.md internal boundaries).
**Delivers:** Merchant dashboard (orders + claims queue, products, basic sales numbers), Super Admin pilot-scoped dashboard (merchants list + suspend, claims ledger, domains, support contact).
**Addresses:** Merchant dashboard, Super Admin dashboard (FEATURES.md P1 items)

### Phase Ordering Rationale

- Tenant foundations must be first because every subsequent phase's data access depends on it, and retrofitting is the single most expensive class of bug in the architecture (cross-referenced by STACK.md, ARCHITECTURE.md, and PITFALLS.md alike).
- Trust/security-critical phases (tenant isolation, entitlements, order/payment-claim integrity) are sequenced before or alongside — not strictly after — the template/design phase specifically because PITFALLS.md flags design work as having no natural stopping point on a solo build, making it the easiest place to silently consume the 30-day budget at the expense of invisible-but-critical correctness work.
- The schema-driven Section/Block system precedes the flagship template build because FEATURES.md's dependency graph is explicit: the editor is a generic renderer over schema, and templates are content built with that schema — building templates before the schema risks a retrofit.
- Segment expansion is deliberately separated from the flagship phase so the recombination system's structural-distinctiveness assumption is validated on one flagship before being trusted at scale across five more.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Order/Payment-Claim State Machine):** MTN MoMo / Orange Money USSD merchant-code strings need re-verification against official Cameroon operator merchant docs before build (STACK/FEATURES flagged this as MEDIUM confidence, general regional sourcing only).
- **Phase 4 (Theme/Section/Block System):** No single authoritative "multi-tenant commerce theme system" spec exists; the Shopify-derived pattern is a synthesis, and the design-distinctiveness requirement is inherently subjective — worth a dedicated research/validation pass on section-type inventory before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Multi-Tenant Foundations):** Well-documented, cross-verified pattern (Prisma Client Extensions, middleware hostname resolution) — HIGH confidence official Prisma docs + Vercel's own reference implementation.
- **Phase 2 (Auth, Entitlements & Trial):** Better Auth's `organization` plugin and standard server-side entitlement-gating patterns are well-documented (HIGH confidence peer-dependency verification, official docs).
- **Phase 6 (Dashboard/Admin):** Standard CRUD/dashboard patterns, no novel research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified directly against npm registry and official changelogs (Aug 2026); architecture-pattern recommendations (tenant scoping, job/queue layering) are MEDIUM, cross-referenced across multiple current community sources rather than a single authority |
| Features | MEDIUM | HIGH on Shopify OS2.0 architecture and WooCommerce manual-payment precedent (official docs); MEDIUM on Africa-specific competitor behavior (Bumpa/Catlog/Selar), sourced from secondary coverage rather than their own product docs; MEDIUM on Cameroon MoMo/Orange Money mechanics specifically |
| Architecture | MEDIUM-HIGH | Patterns cross-verified across multiple independent sources (Prisma official docs, Vercel's own Platforms reference implementation, Shopify's public theme architecture docs); no single authoritative "multi-tenant commerce" spec exists, so this is a synthesis |
| Pitfalls | MEDIUM-HIGH | Tenant isolation, subdomain routing, and inventory-race patterns are well-documented and verified against multiple sources including CVE references; manual-payment-fraud and "AI-generic-template" findings are MEDIUM, synthesized from adjacent-domain reporting rather than EINORT-specific case studies |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- MTN MoMo / Orange Money merchant USSD code formats (e.g. `*126*4*<merchant code>*<amount>#`) are sourced from general regional blog coverage, not official Cameroon operator merchant documentation — verify exact strings before building the tap-to-dial assist in Phase 3.
- Africa-focused competitor behavior (Bumpa, Catlog, Selar theme-customization depth, pricing-tier structure) is based on secondary/press coverage, not their own product docs — treat competitive positioning claims as directional, not precise, during roadmap/positioning decisions.
- TypeScript 7.0 ecosystem tooling gaps (some non-Next.js framework language servers lag until 7.1) are flagged MEDIUM confidence and low-risk for this plain Next.js/React stack, but worth a quick sanity check early in Phase 1 if any ESLint plugin or codegen tool throws obscure errors — fallback is pinning to TypeScript 5.9 LTS.
- Postgres RLS as a defense-in-depth layer is explicitly deferred past V1 across all four research files — flag this as intentional technical debt to revisit post-pilot, not an oversight, when scoping Phase 1.
- Template structural-distinctiveness (Pitfall 5) has no objective completion signal — the "side-by-side, would a stranger say these are the same product" check needs to be built into Phase 4's definition of done explicitly, since design quality won't self-report as finished.

## Sources

### Primary (HIGH confidence)
- Next.js 16 official blog + upgrade docs — https://nextjs.org/blog/next-16, https://nextjs.org/docs/app/guides/upgrading/version-16
- Prisma ORM v7 changelog + announcement + upgrade docs — https://www.prisma.io/changelog/2025-11-19, https://www.prisma.io/blog/announcing-prisma-orm-7-0-0
- Prisma Client extensions official docs — https://www.prisma.io/docs/orm/prisma-client/client-extensions
- Neon docs — Connect from Prisma to Neon — https://neon.com/docs/guides/prisma
- Shopify.dev theme architecture docs (sections, JSON templates, best practices) — https://shopify.dev/docs/storefronts/themes/architecture/sections
- Vercel Multi-Tenant Platform docs + Platforms starter kit — https://vercel.com/docs/multi-tenant, https://github.com/vercel/platforms
- WooCommerce official docs on manual/BACS payment order status behavior
- Stripe — Free Trial Abuse Prevention for SaaS Platforms — https://stripe.com/resources/more/free-trial-abuse
- Meta for Developers — WhatsApp Catalogs/cart documentation

### Secondary (MEDIUM confidence)
- DEV Community / Medium multi-tenant SaaS isolation and Prisma schema-design write-ups (cross-referenced, 3+ independent sources agree on shared-schema + tenantId + extension pattern)
- Upstash blog — Edge Rate Limiting pattern
- Riverpe / MTN Cameroon — Mobile Money USSD payment mechanics (needs re-verification per Gaps section)
- Practical Ecommerce, Microtraction, Dignited — Africa-focused competitor tool coverage (Bumpa, Catlog, Selar)
- Nairametrics, TechCabal — Nigerian/regional ecommerce trust and fraud context
- Netcash, Wiley Security and Communication Networks — manual/mobile-money fraud patterns (adjacent market)

### Tertiary (LOW confidence)
- Graystudio, DEV Community — "AI-generated website looks generic" pattern (single-domain-adjacent sourcing, corroborated across articles but not EINORT-specific)
- Stork.AI, DEV Community — Claude Code long-session architectural drift (used to inform Pitfall 6, general pattern rather than domain-specific evidence)
- Indie Hackers / Medium indie-builder retrospectives — solo scope-creep pattern (general pattern synthesis, not domain-specific)

---
*Research completed: 2026-08-16*
*Ready for roadmap: yes*
