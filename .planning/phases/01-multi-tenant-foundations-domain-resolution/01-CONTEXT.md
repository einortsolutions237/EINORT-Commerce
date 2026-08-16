# Phase 1: Multi-Tenant Foundations & Domain Resolution - Context

**Gathered:** 2026-08-16
**Status:** Ready for planning

<domain>
## Phase Boundary

A prospective merchant can sign up (email/password + a chosen store slug) and land on a working, tenant-isolated subdomain storefront. Cross-tenant data leakage must be structurally impossible — enforced by a centralized tenant-scoped data-access layer, not a per-route convention. This phase is almost entirely backend/infrastructure: no product catalog, no real storefront content, no full onboarding (business name/industry/logo/colors — that's Phase 4). The only user-facing surface is the signup form itself and the empty/placeholder storefront it produces.

Covers: TEN-01, TEN-02, TEN-03, TEN-05, TEN-06, TEN-07, TEN-08, DOM-01, DOM-02, ONB-01.

</domain>

<decisions>
## Implementation Decisions

### Subdomain Selection at Signup

- **D-01:** The merchant types their own desired store slug directly during signup (not auto-generated) — mirrors the familiar "yourstore.myshopify.com" pattern.
- **D-02:** Slug availability is checked live as the merchant types/on blur, not only on form submit — show taken/available/reserved inline before they can proceed.
- **D-03:** The slug is changeable later (e.g. during Phase 4 onboarding or dashboard settings), not locked permanently at signup. Phase 1 only needs the underlying rename-safe data model (subdomain resolution keyed by a stable internal tenant ID, not the slug string itself) — the actual rename UI is out of scope for this phase, but the schema must not make renaming structurally hard later.

### Unrecognized & Suspended Hostname Behavior

- **D-04:** A hostname that doesn't resolve to any tenant (typo, never claimed, or suspended store) shows one branded EINORT "store not found" page, with a link back to the root domain — not a generic framework 404.
- **D-05:** Suspended stores show the exact same generic message as never-existed hostnames — no distinct "temporarily unavailable" messaging in V1. Deliberately chosen to avoid revealing to an anonymous visitor whether a given hostname is suspended vs. never claimed, and to keep this phase's scope smaller.

### Root Domain Behavior

- **D-06:** The bare root domain (einort.com) serves a minimal placeholder page in Phase 1 — not a full marketing site (that's future scope), but the hostname-resolution middleware must explicitly know the root domain is never a tenant lookup.
- **D-07:** Merchant signup, login, and the merchant dashboard all live on the root domain itself (einort.com) — not a dedicated `app.einort.com` or `dashboard.einort.com` subdomain. Simpler routing for V1; one fewer reserved subdomain to manage.

### Claude's Discretion

- Exact reserved-slug list (api, admin, www, app, dashboard, mail, support, help, blog, status, docs, cdn, static, and similar) — the user did not want to enumerate this explicitly; use judgment based on what the platform is likely to need as first-class routes later, informed by D-07 (since app/dashboard aren't reserved as separate subdomains, they should still probably be reserved as slugs to avoid future collision if that decision ever changes).
- Exact slug format/validation rules (length limits, allowed characters, case normalization) — standard subdomain-safe slug validation (lowercase, alphanumeric + hyphens, no leading/trailing hyphens, reasonable min/max length).
- Internal data model specifics for making slug rename safe (e.g. whether hostname resolution keys off a separate `Domain` table pointing at `tenantId` vs. a direct slug column on `Tenant`) — this is exactly the kind of decision ARCHITECTURE.md's research already covers; follow that guidance.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/PROJECT.md` — core value, constraints (tenant isolation non-negotiable, no live PSP, 30-day/solo scope), key decisions
- `.planning/REQUIREMENTS.md` — full v1 requirement text for TEN-01 through TEN-08, DOM-01, DOM-02, ONB-01
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, dependencies

### Research (produced during project initialization)
- `.planning/research/STACK.md` — Better Auth (`organization` plugin as tenant primitive), Prisma 7 driver-adapter setup, Redis hostname-cache pattern, Neon Postgres
- `.planning/research/ARCHITECTURE.md` — hostname→tenant middleware pattern, tenant-scoped Prisma Client Extension (`scopedDb(tenantId)`) pattern, Theme/Page/Section/Block data model (not needed until Phase 4, but establishes the tenant-scoped table pattern this phase's schema must follow)
- `.planning/research/PITFALLS.md` — tenant isolation failure modes (forgotten filters, client-trusted tenant IDs, reserved-slug collisions, stale hostname cache after suspension), all directly relevant to this phase's acceptance criteria
- `.planning/research/SUMMARY.md` — synthesized executive summary and suggested build order (Phase 1 = tenant model + Prisma extension + hostname middleware, blocks everything else)

### Project instructions
- `CLAUDE.md` (project root) — generated project guide with the full stack recommendation baked in; also encodes the workflow-enforcement rule (work through GSD commands, not direct edits)

</canonical_refs>

<code_context>
## Existing Code Insights

Greenfield project — no existing code, no prior codebase map. Nothing to reuse or integrate against yet; this phase establishes the first patterns (tenant-scoped data access, hostname resolution) that every subsequent phase builds on.

</code_context>

<specifics>
## Specific Ideas

- Subdomain UX should feel like Shopify's own signup ("yourstore.myshopify.com") — live availability check, not a submit-and-fail loop.
- The "store not found" page for bad/suspended hostnames should read as EINORT-branded, not a bare framework error page — this is a trust signal even this early in the product.

</specifics>

<deferred>
## Deferred Ideas

- Full marketing/landing site at the root domain — placeholder only in Phase 1, real site is future scope (not currently on the 6-phase roadmap; would need its own phase/backlog item if prioritized).
- Custom domain connection (beyond the EINORT subdomain) — already tracked as PLAT-V2-01 in REQUIREMENTS.md v2 section; not part of Phase 1.
- Distinct "temporarily unavailable" messaging for suspended stores — explicitly deferred by decision D-05, not just out of scope by default.

None — discussion stayed within phase scope otherwise.

</deferred>

---

*Phase: 01-multi-tenant-foundations-domain-resolution*
*Context gathered: 2026-08-16*
