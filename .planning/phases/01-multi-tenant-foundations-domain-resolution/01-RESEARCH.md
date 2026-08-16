# Phase 1: Multi-Tenant Foundations & Domain Resolution - Research

**Researched:** 2026-08-16
**Domain:** Shared-schema multi-tenant SaaS foundations — hostname→tenant routing, centralized tenant-scoped data access, tenant provisioning at signup
**Confidence:** HIGH (core mechanics empirically verified against installed Prisma 7.9.1 / better-auth 1.6.29 / zod 4.4.3 in this session; official Next.js 16 + Vercel docs for routing)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Subdomain Selection at Signup**

- **D-01:** The merchant types their own desired store slug directly during signup (not auto-generated) — mirrors the familiar "yourstore.myshopify.com" pattern.
- **D-02:** Slug availability is checked live as the merchant types/on blur, not only on form submit — show taken/available/reserved inline before they can proceed.
- **D-03:** The slug is changeable later (e.g. during Phase 4 onboarding or dashboard settings), not locked permanently at signup. Phase 1 only needs the underlying rename-safe data model (subdomain resolution keyed by a stable internal tenant ID, not the slug string itself) — the actual rename UI is out of scope for this phase, but the schema must not make renaming structurally hard later.

**Unrecognized & Suspended Hostname Behavior**

- **D-04:** A hostname that doesn't resolve to any tenant (typo, never claimed, or suspended store) shows one branded EINORT "store not found" page, with a link back to the root domain — not a generic framework 404.
- **D-05:** Suspended stores show the exact same generic message as never-existed hostnames — no distinct "temporarily unavailable" messaging in V1. Deliberately chosen to avoid revealing to an anonymous visitor whether a given hostname is suspended vs. never claimed, and to keep this phase's scope smaller.

**Root Domain Behavior**

- **D-06:** The bare root domain (einort.com) serves a minimal placeholder page in Phase 1 — not a full marketing site (that's future scope), but the hostname-resolution middleware must explicitly know the root domain is never a tenant lookup.
- **D-07:** Merchant signup, login, and the merchant dashboard all live on the root domain itself (einort.com) — not a dedicated `app.einort.com` or `dashboard.einort.com` subdomain. Simpler routing for V1; one fewer reserved subdomain to manage.

### Claude's Discretion

- Exact reserved-slug list (api, admin, www, app, dashboard, mail, support, help, blog, status, docs, cdn, static, and similar) — the user did not want to enumerate this explicitly; use judgment based on what the platform is likely to need as first-class routes later, informed by D-07 (since app/dashboard aren't reserved as separate subdomains, they should still probably be reserved as slugs to avoid future collision if that decision ever changes).
- Exact slug format/validation rules (length limits, allowed characters, case normalization) — standard subdomain-safe slug validation (lowercase, alphanumeric + hyphens, no leading/trailing hyphens, reasonable min/max length).
- Internal data model specifics for making slug rename safe (e.g. whether hostname resolution keys off a separate `Domain` table pointing at `tenantId` vs. a direct slug column on `Tenant`) — this is exactly the kind of decision ARCHITECTURE.md's research already covers; follow that guidance.

### Deferred Ideas (OUT OF SCOPE)

- Full marketing/landing site at the root domain — placeholder only in Phase 1, real site is future scope.
- Custom domain connection (beyond the EINORT subdomain) — already tracked as PLAT-V2-01 in REQUIREMENTS.md v2 section; not part of Phase 1.
- Distinct "temporarily unavailable" messaging for suspended stores — explicitly deferred by decision D-05.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **TEN-01** | Every tenant-scoped database table carries an indexed `tenantId` column from the first migration | Pattern 3 (schema shape) + Pitfall 8 (composite-index leading column). `tenantId String` **required, no default** — makes un-scoped nested writes fail loudly (Pitfall 4). |
| **TEN-02** | All tenant-scoped queries route through a single centralized data-access layer (Prisma Client Extension) that auto-injects `tenantId` | Pattern 4 (`scopedDb`) — **all 14 model operations empirically verified as intercepted** in Prisma 7.9.1. Enforcement mechanism = ESLint `no-restricted-imports` zones (Pattern 6), since Prisma has no built-in guard. |
| **TEN-03** | Tenant identity for the storefront is resolved server-side from the request hostname only, never from client-supplied input | Pattern 1 (two-stage resolution) + Pitfall 1 (**header spoofing** — the single most dangerous trap in the naive `x-tenant-id` pattern). Recommendation: carry the slug in the rewritten **path**, not a header. |
| **TEN-05** | Platform admin uses a deliberately separate, unscoped data-access client, isolated from the tenant-scoped layer | Pattern 6 (four-client model: `prismaBase` / `scopedDb` / `platformDb` / `adminDb`) with lint-enforced import boundaries. |
| **TEN-06** | Reserved subdomain slugs (e.g. `api`, `admin`, `www`) are blocked from tenant assignment | Pattern 2 (slug validation) — enforced at **three** layers: Zod schema (form), `organizationHooks.beforeCreateOrganization` throwing `APIError` (server, verified in 1.6.29 source), and `classifyHost` (routing). |
| **TEN-07** | Automated tenant-isolation tests exist and run before any milestone is considered done | Validation Architecture section — model-generic isolation suite + **schema-drift guard** using `Prisma.ModelName` + `Prisma.<Model>ScalarFieldEnum` (both verified present in Prisma 7.9.1; note `Prisma.dmmf` is **gone**). |
| **TEN-08** | Price, stock, tenant ID, and payment/order status are never trusted from client input | Phase 1 scope = the `tenantId` half only. Structurally satisfied by `scopedDb` ignoring any client-supplied `tenantId` (it overwrites, not merges — see Code Example 4). Price/stock/status land in Phase 3. |
| **DOM-01** | Every store gets a working `{store}.einort.com`-style subdomain automatically at publish time | Pattern 7 — with a Vercel **wildcard domain**, provisioning is a DB row only. **No per-tenant Vercel API call is needed.** |
| **DOM-02** | Hostname-to-tenant resolution is exact and fails closed | Pattern 1 `classifyHost` returns `unknown` for anything not matching `<label>.<ROOT>` exactly; DB `@unique` on `organization.slug` (verified in better-auth 1.6.29 schema) guarantees one-hostname-one-store. |
| **ONB-01** | A prospective merchant can sign up with email/password (or equivalent) and create one store | Pattern 5 (signup + system-action org creation), with `organizationLimit: 1` verified to apply even to system actions. |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

Directives extracted from the project root `CLAUDE.md`. Plans must not contradict these.

| # | Directive | Source section | Phase 1 impact |
|---|-----------|----------------|----------------|
| C-1 | Tenant isolation enforced **server-side on every query**, non-negotiable regardless of pilot scale | Constraints | This phase's entire reason to exist |
| C-2 | Never trust price, stock, tenant ID, or payment/order status from the client | Constraints | `scopedDb` must **overwrite**, never merge, a caller-supplied `tenantId` |
| C-3 | Stack is fixed: Next.js 16.3.1 / React 19.2 / TypeScript 7.0.x / Prisma 7.9.1 + `@prisma/adapter-pg` / Neon Postgres 17 / Better Auth 1.6.29 + `organization` plugin / Upstash Redis / Zod 4.4.3 | Technology Stack | No stack exploration in this phase |
| C-4 | **Prisma 7 requires an explicit driver adapter**; `datasource.url` is no longer read from `schema.prisma` — connection config lives in `prisma.config.ts` | Stack, "What NOT to Use" | Verified this session (Code Example 1) |
| C-5 | Point `@prisma/adapter-pg` at Neon's **pooled** connection string, not the direct one | Stack | Two env vars: `DATABASE_URL` (pooled, runtime) + `DIRECT_URL` (unpooled, migrations) |
| C-6 | Shared schema + indexed `tenantId` on every table; **never** schema-per-tenant or database-per-tenant | "What NOT to Use" | Locked |
| C-7 | Prisma Client Extension is the primary tenant guard; Postgres RLS is deliberately deferred past V1 | Alternatives Considered | RLS is out of scope — record as intentional debt, not an oversight |
| C-8 | Map Better Auth `Organization` → `Store`/tenant. Platform Super Admin = a `platformRole` enum field on `User`, checked in middleware/server actions. Do **not** adopt the Better Auth `admin` plugin in V1 | Auth rationale | Locked |
| C-9 | Validate **every** server action input with Zod. Zod v4's error-map API and inference internals differ from v3 — do not paste v3 snippets | Supporting Libraries | Verified v4.4.3 behaviour (Code Example 3) |
| C-10 | Use `@t3-oss/env-nextjs` for typed/validated env vars — fail at boot, not first use | Supporting Libraries | Especially important here: a missing `NEXT_PUBLIC_ROOT_DOMAIN` silently breaks every hostname decision |
| C-11 | Redis key namespaces stay separated (`tenant:host:*`, `session:*`, `jobs:*`) | Redis Usage Patterns | Phase 1 owns `tenant:host:*` |
| C-12 | Do not run Sharp / native bindings on Edge | "What NOT to Use" | Not applicable this phase, but note `proxy.ts` is now Node.js runtime anyway |
| C-13 | **Workflow enforcement:** all repo edits go through a GSD command (`/gsd-quick`, `/gsd-debug`, `/gsd-execute-phase`) — no direct ad-hoc edits | GSD Workflow Enforcement | Applies to execution, not planning |

**No conflicts found** between CLAUDE.md, CONTEXT.md decisions, and the recommendations below.

---

## Summary

This phase is almost entirely infrastructure, and the project-level research already got the *shape* right: shared schema, `tenantId` everywhere, a `scopedDb()` Prisma Client Extension as the single sanctioned query path, and hostname resolution centralized in one place. This research does not relitigate any of that. What it does is close the gap between "the pattern is correct" and "here is the exact code that works on Next.js 16.3.1 + Prisma 7.9.1 + Better Auth 1.6.29" — because on all three of those, the current release differs from what training data and most public tutorials describe.

Three findings change the plan materially. **First, `middleware.ts` no longer exists as the recommended convention.** Next.js 16 renamed it to `proxy.ts` with an exported `proxy` function, it runs on the Node.js runtime, and setting `export const runtime` inside it now throws. Every hostname-resolution snippet in the project-level ARCHITECTURE.md is written against the deprecated convention and must be rewritten, not copy-pasted. **Second, the widely-repeated advice that a tenant-scoping extension must rewrite `findUnique` into `findFirst` is stale.** I verified empirically against a generated Prisma 7.9.1 client that `findUnique({ where: { id, tenantId } })` passes both type-checking and runtime validation (`WhereUniqueInput` is `Prisma.AtLeast<{...all scalars...}, "id" | ...>`), and that all fourteen model operations — including `upsert`, `groupBy`, `aggregate`, and `createManyAndReturn` — are intercepted by `$allModels.$allOperations`. That makes the extension dramatically simpler and closes the escape hatches that the `findFirst`-rewrite workaround leaves open. `$queryRaw`/`$executeRaw` remain the only un-intercepted paths and must be banned by lint. **Third, Better Auth's built-in slug checker cannot be used for the live availability check D-02 requires.** Reading the 1.6.29 source, `/organization/check-slug` sits behind `requestOnlySessionMiddleware`, which throws `UNAUTHORIZED` whenever the call carries request headers and no session — which is exactly the anonymous signup form. It also only tests uniqueness (never the reserved list) and signals "taken" by *throwing* rather than returning `false`. The phase therefore needs its own thin `checkStoreSlug` server action wrapping format + reserved + uniqueness, rate-limited because it is an unauthenticated enumeration endpoint.

The remaining risk concentrates in two places the success criteria don't obviously cover. The naive `x-tenant-id` request-header pattern that most multi-tenant tutorials teach is **spoofable** unless the proxy unconditionally strips the header on every request — a client can simply send it. Carrying the resolved slug in the rewritten URL path instead removes the attack surface entirely, but then introduces its own hole: the internal `/s/{slug}` prefix is directly reachable from the root domain unless the proxy explicitly 404s it. Both are one-line fixes and both are silent, total failures of DOM-02/TEN-03 if missed. And the isolation test suite (TEN-07) will rot the moment Phase 3 adds a model unless it is written model-generically with a drift guard; `Prisma.ModelName` plus `Prisma.<Model>ScalarFieldEnum` make that guard possible at runtime, but note `Prisma.dmmf` — the usual way to do this — was **removed** from the Prisma 7 generated client.

**Primary recommendation:** Build hostname resolution as two stages — a **pure, zero-I/O `proxy.ts`** that classifies the Host header and rewrites to `/s/{slug}/…`, and a **cached, fail-closed `resolveTenantBySlug()`** in the storefront layout that calls `notFound()`. Build `scopedDb()` as a single `$allOperations` extension over an explicit model allowlist that *throws* on unregistered models. Enforce both boundaries with ESLint import zones, and prove them with a model-generic two-tenant suite plus a schema-drift guard.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Host header → store slug classification | **Frontend Server (proxy.ts)** | — | Must run before routing; pure string work, no I/O. Node.js runtime as of Next 16. |
| Slug → tenant record resolution (+ suspension check) | **API/Backend (server module)** | Redis (cache) | Needs DB + cache; explicitly *not* in proxy (Next docs: proxy "should not rely on shared modules or globals"). |
| Hostname resolution cache | **Database/Storage (Upstash Redis)** | — | HTTP-based, serverless-safe. Positive **and negative** caching (see Pitfall 6). |
| Reserved-slug blocklist | **API/Backend** | Frontend Server, Client | Single source-of-truth constant, consumed by all three; authoritative check is server-side in `beforeCreateOrganization`. |
| Live slug-availability check | **API/Backend (server action)** | Client (debounced call) | Client is UX only; server is authority. Rate-limited — unauthenticated endpoint. |
| Email/password signup | **API/Backend (Better Auth)** | — | Better Auth route handler at `/api/auth/[...all]`, root domain only. |
| Tenant (organization) provisioning | **API/Backend** | — | System action, server-side only, no headers. Never client-initiated. |
| Tenant-scoped query filtering | **API/Backend (`scopedDb`)** | Database (unique/index constraints) | The load-bearing guarantee. DB constraints are the backstop, not the mechanism (RLS deferred per C-7). |
| Platform-admin cross-tenant reads | **API/Backend (`adminDb`)** | — | Deliberately unscoped, lint-isolated to `src/server/admin/**`. |
| Session cookie scoping | **Frontend Server (Better Auth defaults)** | — | Host-only cookie on apex. Must **not** enable `crossSubDomainCookies` (see Pitfall 5). |
| "Store not found" page | **Frontend Server (RSC)** | — | Branded, rendered from a real route (D-04), reachable via rewrite and `notFound()`. |
| Storefront render | **Frontend Server (RSC)** | — | Dynamic by default in Next 16 (Cache Components opt-in) — leave off in Phase 1. |
| Wildcard DNS + TLS for `*.einort.com` | **CDN / Platform (Vercel)** | — | One-time config, not per-tenant. |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.3.1 | App Router, `proxy.ts`, RSC, server actions | Locked by C-3. Verified current on npm this session. |
| `react` / `react-dom` | 19.2.x | UI runtime | Ships with Next 16. |
| `typescript` | 7.0.2 | Language | Locked by C-3. Fallback to 5.9 LTS if tooling breaks (STACK.md gap note). |
| `prisma` / `@prisma/client` | 7.9.1 | Schema, migrations, query builder | Locked. **Must** keep `@prisma/*` versions in lockstep. |
| `@prisma/adapter-pg` | 7.9.1 | Driver adapter (Node.js runtime) | Required — Prisma 7 has no implicit engine. Point at Neon **pooled** URL (C-5). |
| `better-auth` | 1.6.29 | Auth + `organization` plugin as the tenant primitive | Locked by C-3/C-8. Peer deps verified: `prisma ^5||^6||^7`, `next ^14||^15||^16`. |
| `auth` (CLI) | 1.6.29 | `npx auth@latest generate` — emits Better Auth's Prisma models | **Note:** the CLI package is `auth`, not `@better-auth/cli` (which is stale at 1.4.21). Same version line as `better-auth`, same repo. |
| `zod` | 4.4.3 | Slug + signup input validation | Locked by C-9. v4 adds top-level `z.email()`; `z.string().email()` still present but deprecated (verified at runtime). |
| `@upstash/redis` | 1.38.2 | `tenant:host:*` resolution cache | HTTP-based; safe in both Node runtime and serverless. |
| `@upstash/ratelimit` | 2.0.8 | Rate-limit the unauthenticated slug-check + signup endpoints | Same vendor, designed together. |
| `@t3-oss/env-nextjs` | 0.13.11 | Typed env validation | C-10. Critical for `NEXT_PUBLIC_ROOT_DOMAIN`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | 4.1.10 | Test runner for the TEN-07 isolation suite | Default choice; native TS/ESM, no Babel config. |
| `tsx` | 4.23.12 | Run TS scripts (seed, migration helpers) | Prisma 7 no longer auto-runs seeds — `migrations.seed` in `prisma.config.ts` needs an explicit runner. |
| `react-hook-form` + `@hookform/resolvers` | 7.85.0 | Signup form state + debounced slug field | Standard Zod pairing; D-02's live check is a debounced `onChange`/`onBlur` handler. |
| `dotenv-cli` | 11.0.0 | Load `.env.test` for the isolation suite | Keeps test DB URL out of the app env. |
| `nanoid` | 6.0.1 | Short IDs | Not needed in Phase 1; listed because CLAUDE.md includes it. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure `proxy.ts` + resolve-in-RSC (Pattern 1) | Resolve tenant fully inside `proxy.ts` (Redis + Prisma fallback) | Saves one indirection, but bundles Prisma into the proxy (cold-start cost on *every* request) and contradicts the Next 16 docs' explicit "do not rely on shared modules or globals" guidance for Proxy. **Not recommended.** |
| Rewrite to `/s/{slug}` path | `x-tenant-id` request header | Header is the tutorial-standard pattern but is **spoofable** unless unconditionally stripped on every request (Pitfall 1). Path rewrite is inherently un-forgeable by the client *provided* the `/s/` prefix is 404'd on direct access. |
| Better Auth `organization` as the tenant table | Separate `Tenant` model with a 1:1 to `organization` | A separate table is one more join and one more thing to keep in sync; `organization` already gives `slug @unique` + `metadata` + `additionalFields`. Only worth splitting if tenant fields grow far beyond auth concerns — revisit at Phase 4, not now. |
| Neon test branch for isolation tests | Testcontainers Postgres | **Testcontainers is not viable here — Docker is not installed on this machine** (see Environment Availability). |
| Neon test branch | PGlite (`@electric-sql/pglite` + `pglite-prisma-adapter`) | Zero-infra in-process Postgres, but the Prisma adapter is a *community* package (`lucasthevenet/pglite-utils`), and testing tenant isolation against a different engine build than production weakens the guarantee. Keep as fallback only. |
| Single persistent Neon test branch | `neon-testing` (branch-per-test-file) | `neon-testing@3.0.1` is third-party (`starmode-base`), ~2.7k downloads/wk, created mid-2025. Nice ergonomics, low adoption. **Recommend the simpler persistent-branch + truncate approach** for a 30-day solo build. |
| Postgres RLS as second layer | — | Explicitly deferred by C-7. Record as intentional debt. |

**Installation:**

```bash
# Core app
npm install next@16.3.1 react@19.2 react-dom@19.2
npm install -D typescript@7.0.2 @types/node @types/react @types/react-dom

# Data layer (keep all @prisma/* on the same version)
npm install @prisma/client@7.9.1 @prisma/adapter-pg@7.9.1 pg
npm install -D prisma@7.9.1

# Auth
npm install better-auth@1.6.29

# Cache + rate limiting
npm install @upstash/redis@1.38.2 @upstash/ratelimit@2.0.8

# Validation / forms / env
npm install zod@4.4.3 react-hook-form@7.85.0 @hookform/resolvers @t3-oss/env-nextjs@0.13.11

# Test + tooling
npm install -D vitest@4.1.10 tsx@4.23.12 dotenv-cli@11.0.0

# Better Auth schema generation (npx, not a dependency)
npx auth@latest generate
```

**Version verification:** every version above was confirmed against the npm registry on 2026-08-16 via `npm view <pkg> version`.

---

## Package Legitimacy Audit

Run with `slopcheck` (installed via `pip install slopcheck`, invoked as `python -m slopcheck install …`) on 2026-08-16, cross-checked against `npm view` metadata and weekly download counts from the npm downloads API.

| Package | Registry | Age | Downloads/wk | Source Repo | slopcheck | Disposition |
|---------|----------|-----|--------------|-------------|-----------|-------------|
| `next` | npm | since 2011 | 45.9M | vercel/next.js | [OK] | Approved |
| `react` | npm | since 2011 | 115.6M | react/react | [OK] | Approved |
| `typescript` | npm | since 2012 | 180.4M | microsoft/TypeScript | [OK] | Approved |
| `prisma` | npm | since 2016 | 13.9M | prisma/prisma | [OK] | Approved |
| `@prisma/client` | npm | since 2020 | 12.9M | prisma/prisma | [OK] | Approved |
| `@prisma/adapter-pg` | npm | since 2023 | 4.2M | prisma/prisma | [OK] | Approved |
| `better-auth` | npm | since 2024-04 | 4.7M | better-auth/better-auth | [OK] | Approved |
| `auth` (CLI) | npm | pkg since 2012, now BA CLI | 120.6k | better-auth/better-auth | [OK] | Approved — *name is generic; confirmed repo + version line match `better-auth`* |
| `zod` | npm | since 2020 | 224.1M | colinhacks/zod | [OK] | Approved |
| `@upstash/redis` | npm | since 2021 | 3.8M | upstash/redis-js | [OK] | Approved |
| `@upstash/ratelimit` | npm | since 2022 | 1.9M | upstash/ratelimit-js | [OK] | Approved |
| `@t3-oss/env-nextjs` | npm | since 2023 | 1.5M | t3-oss/t3-env | [OK] | Approved |
| `vitest` | npm | since 2021 | 77.6M | vitest-dev/vitest | [SUS]* | Approved — *false positive* |
| `nanoid` | npm | since 2017 | 163.5M | ai/nanoid | [OK] | Approved |
| `@electric-sql/pglite` | npm | — | — | electric-sql/pglite | [OK] | Approved (fallback only) |
| `neon-testing` | npm | 2025-06 (~14 mo) | **2,699** | starmode-base/neon-testing | [OK] | **Flagged** — third-party, low adoption |
| `pglite-prisma-adapter` | npm | 2024-05 | 84.7k | lucasthevenet/pglite-utils | [OK] | **Flagged** — community adapter, not `@prisma/*` |

\* `vitest` was flagged `[SUS]` only for lexical similarity to `vite` ("could be a typosquat"). This is a false positive: `vitest` is the official Vite test runner at 77.6M weekly downloads from `vitest-dev/vitest`. Approved.

**Packages removed due to slopcheck [SLOP] verdict:** none.

**Packages flagged as suspicious:** `neon-testing`, `pglite-prisma-adapter`. Neither is in the recommended path — both are fallbacks. **If the planner selects either, insert a `checkpoint:human-verify` task before install.** The recommended testing approach (persistent Neon test branch + `@prisma/adapter-pg` + truncate-between-tests) requires **zero** additional packages beyond `vitest` and `dotenv-cli`.

---

## Architecture Patterns

### System Architecture Diagram

```
                          ┌──────────────────────────────────────┐
   HTTP request ────────► │  Vercel edge / wildcard DNS          │
   Host: ?                │  einort.com  +  *.einort.com         │
                          │  (one project, per-host TLS auto)    │
                          └──────────────────┬───────────────────┘
                                             │
                          ┌──────────────────▼───────────────────┐
                          │  proxy.ts   (Node.js runtime)        │
                          │  PURE — no DB, no Redis, no I/O      │
                          │                                      │
                          │  1. 404 if path starts with /s/      │◄── blocks direct
                          │  2. classifyHost(Host header)        │    internal-prefix access
                          └───┬────────┬────────┬────────┬───────┘
                              │        │        │        │
                 kind=root ◄──┘        │        │        └──► kind=unknown
                 (D-06/D-07)           │        │             rewrite → /store-not-found
                      │       kind=reserved  kind=store              │
                      │        (api/admin/…)     │                   │
                      │            │             │                   │
                      ▼            ▼             ▼                   │
        ┌─────────────────────┐  ┌────────┐  ┌──────────────────┐    │
        │ (root) route group  │  │platform│  │ rewrite to       │    │
        │ • / placeholder     │  │ routes │  │ /s/{slug}/…      │    │
        │ • /signup           │  └────────┘  └────────┬─────────┘    │
        │ • /api/auth/[...all]│                       │              │
        └──────────┬──────────┘                       ▼              │
                   │                    ┌──────────────────────────┐ │
                   │                    │ app/s/[slug]/layout.tsx  │ │
                   │                    │ resolveTenantBySlug()    │ │
                   │                    │  ├─ Redis tenant:host:*  │ │
                   │                    │  │   (pos + NEG cache)   │ │
                   │                    │  ├─ platformDb fallback  │ │
                   │                    │  └─ notFound() if none   │─┘
                   │                    │      or suspended (D-05) │
                   │                    └────────────┬─────────────┘
                   │                                 │ tenantId
                   ▼                                 ▼
        ┌──────────────────────────────────────────────────────────┐
        │              DATA-ACCESS BOUNDARY (lint-enforced)         │
        │                                                           │
        │   scopedDb(tenantId)      platformDb          adminDb     │
        │   $allOperations          registry only       unscoped    │
        │   injects tenantId        (org/user/slug)     (Phase 6)   │
        │   allowlist or THROW      non-tenant tables   admin/** only│
        │        │                       │                   │      │
        │        └───────────┬───────────┴───────────────────┘      │
        │                    ▼                                      │
        │            prismaBase (singleton)                         │
        │            + @prisma/adapter-pg                           │
        └────────────────────┬──────────────────────────────────────┘
                             ▼
                  Neon Postgres 17 (pooled URL)
                  shared schema, tenantId on every
                  tenant-scoped table, composite
                  indexes leading with tenantId

   SIGNUP FLOW (root domain only):
   /signup form ──debounced──► checkStoreSlug() action ──► rate-limit → Zod → reserved → uniqueness
        │
        └─submit─► signUpEmail ──► createOrganization (SYSTEM action: userId, NO headers)
                                        │
                                        ├─ beforeCreateOrganization hook: reserved-slug APIError
                                        └─ setActiveOrganization(headers)
```

### Recommended Project Structure

Extends (does not replace) the layout in `.planning/research/ARCHITECTURE.md`, adjusted for the Next 16 `proxy.ts` rename and the four-client model.

```
proxy.ts                          # ROOT (or src/) — NOT middleware.ts. Pure, zero-I/O.
prisma.config.ts                  # Prisma 7: datasource url + migrations live here
prisma/
├── schema.prisma                 # generator output → ../src/generated/prisma
└── migrations/
src/
├── generated/prisma/             # gitignored; `prisma generate` output (Prisma 7 requires output path)
├── env.ts                        # @t3-oss/env-nextjs — validates ROOT_DOMAIN, DATABASE_URL, UPSTASH_*
├── app/
│   ├── (root)/                   # einort.com — D-06, D-07
│   │   ├── page.tsx              #   minimal placeholder
│   │   ├── signup/page.tsx       #   the only user-facing surface this phase
│   │   └── layout.tsx
│   ├── s/[slug]/                 # INTERNAL rewrite target — never linked, never public
│   │   ├── layout.tsx            #   resolveTenantBySlug() → notFound() on miss/suspended
│   │   └── page.tsx              #   placeholder storefront
│   ├── store-not-found/page.tsx  # branded EINORT page (D-04/D-05)
│   └── api/auth/[...all]/route.ts# Better Auth handler (root domain only)
├── server/
│   ├── db/
│   │   ├── base.ts               # prismaBase singleton — importable ONLY by server/db, server/tenant, server/admin
│   │   ├── tenant-scoped.ts      # scopedDb(tenantId) + TENANT_SCOPED_MODELS allowlist
│   │   ├── platform.ts           # platformDb — non-tenant-scoped registry reads (org, user, slug lookup)
│   │   └── admin.ts              # adminDb — unscoped, importable ONLY by server/admin/** (TEN-05)
│   ├── tenant/
│   │   ├── host.ts               # classifyHost() — PURE, no imports beyond env. Unit-tested exhaustively.
│   │   ├── reserved-slugs.ts     # single source of truth (TEN-06)
│   │   ├── slug.ts               # Zod schema + normalization
│   │   ├── resolve.ts            # resolveTenantBySlug() — cache() + Redis + DB, fails closed
│   │   └── cache.ts              # Upstash get/set/invalidate, positive + NEGATIVE caching
│   ├── auth/
│   │   ├── auth.ts               # betterAuth() config: organization plugin, hooks, nextCookies LAST
│   │   └── signup.ts             # signup server action (Pattern 5)
│   └── admin/                    # Phase 6 — the only place adminDb may be imported
└── lib/
tests/
├── unit/          host.test.ts, slug.test.ts, proxy.test.ts
├── isolation/     tenant-isolation.test.ts, model-registry-drift.test.ts
└── setup/         global-setup.ts, seed-two-tenants.ts
eslint.config.mjs                 # no-restricted-imports zones — the TEN-02/TEN-05 enforcement
```

---

### Pattern 1: Two-stage hostname resolution (`proxy.ts` classify → RSC resolve)

**What:** Split hostname→tenant into a *pure classification* stage in `proxy.ts` and a *cached lookup* stage in the storefront layout. `proxy.ts` does zero I/O; it only decides which of four kinds a Host header is and rewrites accordingly.

**When to use:** Always, for this phase. This is the load-bearing routing decision.

**Why split it:** The Next.js 16 Proxy docs state plainly that Proxy "is meant to be invoked separately of your render code and in optimized cases deployed to your CDN… you should not attempt relying on shared modules or globals," and that information should reach the app via headers, cookies, rewrites, redirects, or the URL. Putting a Prisma client behind `proxy.ts` bundles the ORM into a function that runs on **every** matched request, including prefetches. Splitting keeps the hot path free of I/O while still failing closed, because the second stage calls `notFound()`.

**Trade-offs:** One extra module boundary, and the slug travels through a URL rewrite rather than a resolved tenant ID. In exchange you get no ORM in the request-interception path, an exhaustively unit-testable pure function, and no spoofable header.

**Verified facts behind this pattern (Next.js 16.3.1 official docs):**

| Fact | Detail |
|------|--------|
| Filename | `proxy.ts` at project root or inside `src/`, same level as `app/` |
| Export | default export, or a named export called `proxy` (one per file) |
| Runtime | **Node.js, always.** Setting the `runtime` config option in a Proxy file **throws an error** |
| Migration | `npx @next/codemod@canary middleware-to-proxy .` |
| Config flag rename | `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize` |
| Matcher default | Without a matcher, Proxy runs on **every** request including `_next/static`, `_next/image`, and `public/` |
| `_next/data` | Runs even when excluded by a negative matcher — intentional, to prevent protecting a page but not its data route |
| Server Functions | Handled as POSTs to the route where they're used; a matcher that excludes a path also skips Server Function calls there |
| Request headers | `NextResponse.next({ request: { headers } })` — **not** `NextResponse.next({ headers })`, which exposes them to the client |
| Unit testing | `next/experimental/testing/server` exposes `unstable_doesProxyMatch`, `isRewrite`, `getRewrittenUrl`, `getRedirectUrl` |
| Deprecation | `middleware.ts` still works for Edge-runtime cases but is deprecated and will be removed |

---

### Pattern 2: Three-layer reserved-slug and format enforcement

**What:** The reserved list and slug format live in one module and are checked at three independent layers.

| Layer | Where | Purpose | Failure mode if omitted |
|-------|-------|---------|-------------------------|
| 1. Form | Zod schema on the signup form + debounced `checkStoreSlug` action | D-02 inline feedback | Merchant fills the whole form, then gets rejected at submit |
| 2. Write | `organizationHooks.beforeCreateOrganization` throwing `APIError` | **Authoritative.** Blocks any path to org creation, including future admin tooling | A direct API call claims `admin.einort.com` |
| 3. Route | `classifyHost` returns `kind: 'reserved'` | Defence in depth — even a reserved slug that somehow got into the DB never routes as a store | Platform route shadowed by a tenant |

**Verified (better-auth 1.6.29 source):** `beforeCreateOrganization` runs *after* the built-in slug-uniqueness check and *immediately before* the insert, and its JSDoc explicitly documents throwing `APIError` to abort. It is the correct hook.

**Recommended reserved list** (Claude's discretion per CONTEXT.md; informed by D-07 — reserve `app`/`dashboard` as slugs even though they aren't separate hosts, so the D-07 decision stays reversible):

```
Infrastructure : www, api, admin, app, dashboard, auth, login, signup, account, cdn, static,
                 assets, media, img, images, files, download, uploads
Mail / DNS     : mail, smtp, imap, pop, mx, ns, ns1, ns2, webmail, email, autodiscover
Platform       : einort, store, stores, shop, shops, my, go, link, s
Ops / meta     : status, health, monitor, metrics, logs, staging, dev, test, demo, preview,
                 sandbox, internal, beta, alpha
Content        : blog, docs, help, support, faq, about, contact, legal, privacy, terms, press,
                 careers, pricing, partners
Commerce       : billing, invoice, invoices, payments, pay, checkout, cart, orders, webhook, webhooks
Abuse-adjacent : security, abuse, postmaster, hostmaster, root, sysadmin, noreply, no-reply
```

Also block, via format rules rather than the list: any label starting `xn--` (punycode homograph), any label containing `--` at positions 3-4 (the IDN prefix pattern), and any all-numeric label.

---

### Pattern 3: Tenant model + schema shape

**What:** Better Auth's `organization` **is** the tenant table (C-8). `tenantId` on every tenant-scoped table is a plain required `String` holding `organization.id`.

**Verified (better-auth 1.6.29, `plugins/organization/organization.mjs`):** the `organization` table definition marks `slug` as `required: true, unique: true`, and `name` as `required: true`. So `npx auth@latest generate` produces a genuine DB-level unique constraint on `slug` — this is what makes DOM-02's "no hostname can ever resolve to more than one store" a database guarantee rather than an application convention. **Verify the emitted schema and do not accept a nullable `slug`** — an older release (issue #4869) emitted `slug String?`, and the planner should treat "confirm the generated column is `String @unique`, not `String?`" as an explicit task.

**Rename-safety (D-03):** satisfied for free. `tenantId` foreign keys point at `organization.id` (a stable cuid); the slug is a mutable column on `organization`. A rename is `UPDATE organization SET slug = …` plus a cache invalidation — no data migration. **No separate `Domain` table is needed in Phase 1**, and adding one later for PLAT-V2-01 (custom domains) is additive: `Domain(hostname @unique, tenantId)` consulted by `resolveTenantBySlug`'s sibling `resolveTenantByHostname`, with the subdomain path unchanged.

**Suspension:** add via the plugin's own extension point rather than a side table —

```ts
organization({
  schema: {
    organization: {
      additionalFields: {
        status: { type: "string", input: false, required: false, defaultValue: "active" },
      },
    },
  },
})
```

`input: false` is important: it prevents `status` from being settable through the public create/update API surface. Suspension becomes a platform-admin-only write in Phase 6.

**Index discipline (TEN-01):** every tenant-scoped model gets `@@index([tenantId])` *and*, for any list query, a composite index **leading** with `tenantId` (`@@index([tenantId, createdAt])`). Leading-column discipline is what makes hash/range partitioning by `tenant_id` a mechanical change at scale rather than a redesign.

**Make `tenantId` required with no default.** This is deliberate: Prisma Client Extensions do **not** intercept nested writes (see Pitfall 4), so a nested `create` on a tenant-scoped relation bypasses `scopedDb`. If `tenantId` is required, that bypass becomes a loud compile-time/runtime error instead of a silent `NULL`.

---

### Pattern 4: `scopedDb()` — one `$allOperations` extension, allowlist-gated

**What:** A single Prisma Client Extension that injects `tenantId` into every operation on every registered model, and **throws** for any model not on the allowlist.

**Empirically verified in this session** against a generated Prisma 7.9.1 client (probe: register an `$allModels.$allOperations` handler that records `{model, operation, args}` and throws a sentinel):

| Operation | Intercepted? | `args` shape observed |
|-----------|-------------|-----------------------|
| `findUnique` | ✅ | `{where}` |
| `findUniqueOrThrow` | ✅ | `{where}` |
| `findFirst` | ✅ | `{where}` |
| `findMany` | ✅ | `{}` / `{where}` |
| `count` | ✅ | `{where}` |
| `aggregate` | ✅ | `{_count}` — `where` may be **absent** |
| `groupBy` | ✅ | `{by}` — `where` may be **absent** |
| `create` | ✅ | `{data}` (object) |
| `createMany` | ✅ | `{data}` — **array** |
| `createManyAndReturn` | ✅ | `{data}` — **array** |
| `update` | ✅ | `{where, data}` |
| `updateMany` | ✅ | `{where, data}` |
| `upsert` | ✅ | `{where, create, update}` — needs `tenantId` in **both** `where` and `create` |
| `delete` | ✅ | `{where}` |
| `deleteMany` | ✅ | `{where}` |
| `$queryRaw` / `$executeRaw` | ❌ **NOT intercepted** | — |

**And the stale-advice correction:** a second probe injected `tenantId` into `findUnique`/`findUniqueOrThrow`/`update`/`delete`/`upsert`/`aggregate`/`groupBy`/`findMany` and let Prisma validate. All produced only `PrismaClientKnownRequestError: Can't reach database server` (a *connection* error, reached only **after** argument validation passes). A negative control injecting a genuinely bogus field produced `PrismaClientValidationError`. Inspecting the generated type confirms why:

```ts
// src/generated/prisma/models/Product.ts — Prisma 7.9.1 output
export type ProductWhereUniqueInput = Prisma.AtLeast<{
  id?: string
  tenantId_sku?: Prisma.ProductTenantIdSkuCompoundUniqueInput
  AND?: …; OR?: …; NOT?: …
  tenantId?: Prisma.StringFilter<"Product"> | string   // ← non-unique scalars permitted
  sku?: …; name?: …
}, "id" | "tenantId_sku">                              // ← at least one unique selector required
```

**Therefore: do NOT rewrite `findUnique` into `findFirst`.** That workaround (still the top result for "prisma tenant scoping findUnique") is stale — `extendedWhereUnique` has been GA since Prisma 5. Uniform `where` injection across all read/write ops is both simpler and stricter.

**Trade-offs:** `$allOperations` sees runtime `args` as loosely-typed, so the body needs a small amount of `any`. Contain it in this one file and keep the file short.

---

### Pattern 5: Signup → tenant provisioning as a *system action*

**What:** A single server action that validates the slug, creates the user via Better Auth, creates the organization as an unauthenticated **system action**, then activates it on the session.

**Verified (better-auth 1.6.29, `routes/crud-org.mjs` — `createOrganization`):**

```js
const session = await getSessionFromCtx(ctx);
if (!session && (ctx.request || ctx.headers)) throw APIError.fromStatus("UNAUTHORIZED");
let user = session?.user || null;
if (!user) {
  if (!ctx.body.userId) throw APIError.fromStatus("UNAUTHORIZED");
  user = await ctx.context.internalAdapter.findUserById(ctx.body.userId);
}
…
const isSystemAction = !session && ctx.body.userId;
if (!canCreateOrg && !isSystemAction) throw APIError.from("FORBIDDEN", …);
```

Five consequences that shape the plan:

1. **Calling `auth.api.createOrganization({ body: { …, userId } })` with NO `headers` is a supported "system action"** and bypasses `allowUserToCreateOrganization: false`. GitHub issue #6791 claims the opposite; that claim does **not** hold for 1.6.29. This lets you set `allowUserToCreateOrganization: false` so no merchant can ever mint an extra store through the public API, while signup still works.
2. **`organizationLimit` is checked *before* and *without* the `isSystemAction` bypass.** Setting `organizationLimit: 1` therefore also constrains the system action — which is exactly what ONB-01 ("create one store") wants, and it makes a retried signup idempotent rather than producing a second store.
3. **Slug uniqueness is re-checked inside the endpoint** (`findOrganizationBySlug` → `BAD_REQUEST ORGANIZATION_ALREADY_EXISTS`) on top of the DB unique constraint. The race between the live D-02 check and submit is handled — just catch and surface it.
4. **A system action does not set the active organization.** `setActiveOrganization` runs only `if (ctx.context.session && !keepCurrentActiveOrganization)`. Since `signUp.email` already created the session *before* the org existed, `session.activeOrganizationId` will be `null`. Fix explicitly with `auth.api.setActiveOrganization({ headers, body: { organizationId } })`, and additionally add a `databaseHooks.session.create.before` hook that back-fills `activeOrganizationId` on every future login (this is also the TEN-04 groundwork for Phase 2).
5. **Non-atomicity is unavoidable.** If org creation fails after user creation, you get a user with no store. Do not paper over it — plan an explicit `/onboarding/create-store` recovery route that any authenticated user with zero organizations is redirected to. This route is also the natural home for the Phase 4 rename UI (D-03).

> ⚠️ **Verified bug trap in `beforeCreateOrganization`.** The handler does
> `if (response && "data" in response) orgData = { ...ctx.body, ...response.data }` — it re-spreads the **entire** `ctx.body`, which still contains `userId` and `keepCurrentActiveOrganization`. Returning `{ data }` from this hook therefore leaks non-column fields into the organization insert. **The reserved-slug hook must only `throw` or return `void` — never return `{ data }`.**

---

### Pattern 6: Four data-access clients with lint-enforced boundaries

**What:** TEN-02 says "no route is permitted to query tenant-scoped tables directly" and TEN-05 says platform admin must be "architecturally isolated." Neither is achievable by convention on a solo AI-assisted build (PITFALLS.md Pitfall 6 predicts exactly this drift). Make it a lint error.

| Client | Module | May be imported by | Purpose |
|--------|--------|--------------------|---------|
| `prismaBase` | `server/db/base.ts` | `server/db/**`, `server/tenant/**`, `server/auth/**` only | Singleton + adapter. Never used directly by features. |
| `scopedDb(tenantId)` | `server/db/tenant-scoped.ts` | anywhere | **The only** path to tenant-scoped models |
| `platformDb` | `server/db/platform.ts` | `server/tenant/**`, `server/auth/**` | Narrow reads on **non**-tenant-scoped registry tables (organization, user, slug lookup, hostname resolution) |
| `adminDb` | `server/db/admin.ts` | `server/admin/**` only | Deliberately unscoped cross-tenant reads (Phase 6) |

The `platformDb` client is a Phase-1 addition to the project-level architecture, and it is necessary: slug-availability and hostname resolution must read the `organization` table, which is *not* tenant-scoped and therefore cannot go through `scopedDb`. Without naming this third category explicitly, that code would be forced to reach for either `prismaBase` (weakening the boundary) or `adminDb` (polluting the admin isolation TEN-05 requires).

**Enforcement** (`eslint.config.mjs`, flat config — note `next lint` was **removed** in Next 16, so wire ESLint into `package.json` scripts and CI directly):

```js
{
  files: ["src/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["**/server/db/base"],  message: "Use scopedDb(tenantId), platformDb, or adminDb." },
        { group: ["**/server/db/admin"], message: "adminDb is only importable from src/server/admin/**." },
        { group: ["**/generated/prisma*"], message: "Never import the generated client directly." },
      ],
    }],
    "no-restricted-syntax": ["error",
      { selector: "MemberExpression[property.name=/^\\$(queryRaw|executeRaw)/]",
        message: "Raw queries bypass tenant scoping (verified NOT intercepted by client extensions)." },
    ],
  },
},
{ files: ["src/server/db/**", "src/server/tenant/**", "src/server/auth/**"],
  rules: { "no-restricted-imports": "off" } },
{ files: ["src/server/admin/**"],
  rules: { "no-restricted-imports": ["error", { patterns: [
    { group: ["**/server/db/tenant-scoped"], message: "Admin surface must not reuse tenant-scoped services (TEN-05)." },
  ]}]}},
```

Add `import 'server-only'` at the top of every `server/db/*` and `server/tenant/resolve.ts` module so an accidental client import is a build failure, not a runtime leak.

---

### Pattern 7: Wildcard-domain provisioning (DOM-01 without an API call)

**What:** Per Vercel's multi-tenant docs, adding `*.einort.com` as a wildcard domain (requires the apex on Vercel nameservers `ns1.vercel-dns.com` / `ns2.vercel-dns.com`) makes **any** `tenant.einort.com` resolve to the deployment automatically, with per-subdomain certificates issued on the fly.

**Consequence:** DOM-01's "gets a working subdomain automatically" is satisfied by *inserting the organization row*. There is **no per-tenant Vercel SDK call, no DNS write, no certificate step, and nothing asynchronous** in Phase 1. The `@vercel/sdk` domain APIs only become relevant for PLAT-V2-01 (custom domains), which is out of scope.

**One-time setup tasks (human, not code):** point apex nameservers at Vercel → add `einort.com` to the project → add `*.einort.com` to the project. Wildcard SSL will silently not issue if the nameservers aren't Vercel's.

---

### Anti-Patterns to Avoid

- **Writing `middleware.ts`.** Deprecated in Next 16 and slated for removal. Use `proxy.ts` with an exported `proxy`. (Every hostname snippet in `.planning/research/ARCHITECTURE.md` uses the old convention — treat those as pseudocode, not copy-paste.)
- **Reading tenant identity from an `x-tenant-id` request header without stripping it first.** See Pitfall 1. If you must use headers, `requestHeaders.delete('x-tenant-id')` before setting, on **every** branch including `kind: 'root'`.
- **Copying `vercel/platforms`'s `extractSubdomain` verbatim.** The reference implementation only rewrites when `pathname === '/'`, has no reserved-slug handling, no fail-closed branch, and no guard on the internal `/s/` prefix. It is a demo, not a security boundary.
- **Putting Prisma behind `proxy.ts`.** Contradicts the official Proxy guidance and pays ORM cold-start on every matched request.
- **Rewriting `findUnique` → `findFirst` in the extension.** Stale advice; unnecessary in Prisma 7 and it fragments the extension logic.
- **Using `prisma.$use()` middleware.** **Removed in Prisma 7.** Extensions are the only mechanism.
- **Enabling `cacheComponents: true` in Phase 1.** Next 16 makes caching fully opt-in and everything dynamic by default — which is precisely the tenant-safe posture. Opting in early risks a cached storefront shell being served across tenants. Revisit in Phase 4 with explicit per-tenant cache keys.
- **Setting `advanced.crossSubDomainCookies`.** See Pitfall 5.
- **Instantiating `new PrismaClient()` per request or per tenant.** One singleton; `$extends` returns a cheap wrapper sharing the pool.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tenant filter on every query | Manual `where: { tenantId }` per call site, or a base repository class | Prisma Client Extension `$allOperations` (Pattern 4) | One forgotten filter = total cross-tenant leak. Verified to cover all 14 operations. |
| Organizations / members / roles / invitations | Custom `Tenant` + `Membership` tables and role logic | Better Auth `organization` plugin | Near-exact primitive match (C-8); already carries `slug @unique`, `metadata`, `additionalFields`, and lifecycle hooks. |
| Session + password hashing + CSRF + cookie flags | Anything | Better Auth core | Auth is the classic "looks easy, is not" domain. |
| Slug uniqueness under concurrency | Read-then-write "is it free?" check | DB `@unique` on `organization.slug` + catch the constraint error | The read-then-write TOCTOU race is real when two merchants submit the same slug seconds apart. Better Auth already does the read-check; the DB constraint is the actual guarantee. |
| Rate limiting the unauthenticated slug-check | Custom in-memory counter | `@upstash/ratelimit` sliding window | In-memory counters don't work across serverless instances at all. |
| Wildcard subdomain DNS + TLS per tenant | Vercel SDK calls at signup | Vercel wildcard domain (Pattern 7) | Zero per-tenant work; certs issued on the fly. |
| Subdomain-aware local dev | `hosts` file edits, `dnsmasq`, ngrok | `*.localhost` | Chrome, Edge and Firefox resolve any `*.localhost` name to 127.0.0.1 with no config, on Windows included. `store1.localhost:3000` just works. |
| Proxy matcher/rewrite testing | Booting a real server | `next/experimental/testing/server` (`unstable_doesProxyMatch`, `isRewrite`, `getRewrittenUrl`) | First-party, fast, runs in Vitest. |
| Enumerating models that need tenant scoping | A hand-maintained comment | `Prisma.ModelName` + `Prisma.<Model>ScalarFieldEnum` drift test | See Validation Architecture. Hand-maintained lists rot in exactly the way PITFALLS.md Pitfall 6 predicts. |

**Key insight:** In this domain the expensive failures are *omissions*, not bad implementations — a missing filter, an unstripped header, an unreserved slug, a model nobody added to the allowlist. Every recommendation above converts a thing you must remember into a thing that fails loudly: a throw, a lint error, a DB constraint, or a red test.

---

## Common Pitfalls

### Pitfall 1: `x-tenant-id` request headers are client-spoofable

**What goes wrong:** The canonical tutorial pattern sets `res.headers.set('x-tenant-id', id)` in middleware and reads it via `headers()` in a Server Component. But a client can send `x-tenant-id` on its own request. If the proxy only *sets* the header on the storefront branch and returns `NextResponse.next()` on the root-domain branch, then a request to `einort.com/dashboard` carrying a forged `x-tenant-id` reaches server code with an attacker-chosen tenant.

**Why it happens:** The proxy feels like a trusted boundary, so people assume anything read downstream came from it. Nothing enforces that. It's also invisible in testing, because no legitimate client ever sends the header.

**How to avoid:** Prefer the **URL rewrite** (`/s/{slug}/…`) — the client cannot forge the rewritten path because the proxy always rewrites based on Host. If you use a header at all, unconditionally strip it on **every** branch:

```ts
const requestHeaders = new Headers(request.headers);
requestHeaders.delete('x-tenant-id');   // ALWAYS, on every path
```

**Warning signs:** any `headers().get('x-tenant-id')` in the codebase; any proxy branch that returns bare `NextResponse.next()` without header sanitisation.

---

### Pitfall 2: The internal `/s/{slug}` rewrite prefix is publicly reachable

**What goes wrong:** With the rewrite pattern, `app/s/[slug]/page.tsx` is a real route. Nothing stops someone requesting `https://einort.com/s/some-other-store` directly — the Host is the root domain, the proxy passes it through with `NextResponse.next()`, and the filesystem route serves that tenant's storefront on the apex.

**Why it happens:** Rewrites *feel* internal. They aren't; they're ordinary routes that the proxy happens to point at.

**Consequences:** It isn't a data leak (storefronts are public), but it breaks DOM-02's "exact resolution," creates duplicate content across hosts, and — worse — renders a tenant storefront in the **apex cookie scope**, undermining the D-07 cookie separation described in Pitfall 5.

**How to avoid:** first statement in `proxy.ts`, before anything else:

```ts
if (pathname === '/s' || pathname.startsWith('/s/')) {
  return new NextResponse(null, { status: 404 });
}
```
This is safe because legitimate traffic reaches `/s/…` only *after* the rewrite, and rewrites don't re-enter the proxy.

**Warning signs:** no test asserts that `GET einort.com/s/{slug}` returns 404.

---

### Pitfall 3: `checkSlug` 401s for anonymous users, and signals "taken" by throwing

**What goes wrong:** D-02 needs a live availability check on the signup form, where the visitor has no account. Wiring `authClient.organization.checkSlug()` to that field returns **401 Unauthorized** on every keystroke.

**Why it happens (verified, better-auth 1.6.29):** `/organization/check-slug` uses `requestOnlySessionMiddleware`, defined as:

```js
const requestOnlySessionMiddleware = createAuthMiddleware(async (ctx) => {
  const session = await getSessionFromCtx(ctx);
  if (!session?.session && (ctx.request || ctx.headers)) throw APIError.from("UNAUTHORIZED", …);
  return { session };
});
```

Any HTTP-originated call has `ctx.request`, so no session ⇒ 401. Two further quirks compound it: the endpoint **only** tests uniqueness (it knows nothing about your reserved list, so it would report `admin` as available), and on collision it **throws** `BAD_REQUEST ORGANIZATION_SLUG_ALREADY_TAKEN` rather than returning `{ status: false }`.

**How to avoid:** write your own `checkStoreSlug` server action (Code Example 3). Server-side invocation without `headers` skips the session requirement (`ctx.request`/`ctx.headers` are undefined), so `auth.api.checkOrganizationSlug({ body: { slug } })` works — or simply query `platformDb.organization.findUnique({ where: { slug } })` and avoid the quirk entirely. Rate-limit it: it is unauthenticated and enumerable.

**Warning signs:** 401s in the network tab while typing in the store-slug field; `admin` reported as available.

---

### Pitfall 4: Nested writes and raw queries bypass the extension

**What goes wrong:** `scopedDb(t).order.create({ data: { …, items: { create: [{ … }] } } })` injects `tenantId` on the `Order` only. The extension is invoked once, for the top-level model; nested `OrderItem` rows are created by the same engine call and never pass through it. Same for `$queryRaw`/`$executeRaw` — **empirically confirmed not intercepted** this session.

**Why it happens:** the extension hooks the *client operation*, not the generated SQL.

**How to avoid:**
- Declare `tenantId` **required with no default** on every tenant-scoped model, so a nested create that omits it is a type error at authoring time and a DB `NOT NULL` violation at worst. This converts a silent leak into a loud failure.
- Ban `$queryRaw`/`$executeRaw` via `no-restricted-syntax` (Pattern 6). If one is ever genuinely needed, it belongs in a named, reviewed module with the tenant predicate written by hand.
- Prefer explicit sequential creates inside `scopedDb(t).$transaction(...)` over nested-relation creates on tenant-scoped models.

**Warning signs:** any `{ create: … }` / `{ createMany: … }` nested inside a `data` payload for a tenant-scoped relation; any `$queryRaw` outside a reviewed module.

> **Flagged for verification during execution:** whether the extension applies to clients yielded by `scopedDb(t).$transaction(async (tx) => …)`. Expected yes, but this was **not** verified in this session (it needs a live database). Make it an assertion in the isolation suite rather than an assumption.

---

### Pitfall 5: Cookie scope across apex and wildcard subdomains

**What goes wrong:** Enable `advanced.crossSubDomainCookies` and the merchant session cookie gets `Domain=.einort.com`, which means it is sent to **every tenant storefront**, all of which render merchant-controlled content. A stored-XSS in any one storefront can then read or ride the platform session.

**Why it happens:** cross-subdomain cookies are the reflexive setting for "one app, many subdomains," and Better Auth makes it a one-liner. Better Auth's own docs warn: "Only enable cross-subdomain cookies if it's necessary… Be cautious of untrusted subdomains that could potentially access these cookies."

**How to avoid:** **Do not set `crossSubDomainCookies`.** D-07 makes this free: signup, login and the dashboard all live on the apex, so a default host-only cookie (no `Domain` attribute) on `einort.com` is never sent to `*.einort.com`. Set `advanced.cookiePrefix` to something project-specific, and — because Pitfall 2 is what would break this — verify a tenant storefront can never render on the apex.

**Warning signs:** `Domain=.einort.com` on the session cookie in devtools; any storefront route reachable from the apex host.

---

### Pitfall 6: Unknown-hostname floods hammer the database (no negative caching)

**What goes wrong:** With a wildcard domain, **every** `<anything>.einort.com` reaches your app. A scanner walking random subdomains produces a stream of cache *misses*, each falling through to a DB lookup that returns nothing and caches nothing — an unauthenticated, amplification-free path to saturating the Neon connection pool.

**Why it happens:** cache-fill logic naturally writes only on success.

**How to avoid:** cache the negative result too, with a shorter TTL:

```ts
const MISS = ' none';
// hit  → set(key, JSON.stringify({id, status}), { ex: 300 })
// miss → set(key, MISS,                         { ex: 60  })
```

Also: apply `@upstash/ratelimit` per-IP on the resolution path, keep the proxy matcher tight so static assets never trigger resolution, and reject at `classifyHost` (zero I/O) anything that fails slug format — most scanner traffic dies there before touching Redis.

**Warning signs:** Neon connection-count spikes uncorrelated with real traffic; Redis showing only positive keys.

---

### Pitfall 7: Stale cache keeps a suspended store live

**What goes wrong:** Suspension flips `organization.status`, but the Redis entry still says `active` for up to the TTL, so the storefront keeps serving. PITFALLS.md flags this; the fix is concrete.

**How to avoid:** invalidate on write, don't rely on TTL. Every mutation of `slug` or `status` calls `invalidateTenantHost(oldSlug)` and, on rename, `invalidateTenantHost(newSlug)` as well. Cache `{ id, status }` — not just the id — so the resolver can enforce D-05 (suspended renders the *same* not-found page) without a second lookup. Keep TTL at ~300s as a backstop.

**Warning signs:** suspending in admin doesn't change the storefront immediately; the cached value stores only an id.

---

### Pitfall 8: Composite indexes that don't lead with `tenantId`

**What goes wrong:** `@@index([createdAt])` on an order table cannot serve `WHERE tenantId = ? ORDER BY createdAt` efficiently. Because `scopedDb` injects `tenantId` into *every* query, the tenant predicate is always present — so every index must lead with it.

**How to avoid:** treat `@@index([tenantId, <sortOrFilterColumn>])` as the default shape. It also keeps future partitioning by `tenant_id` mechanical.

**Warning signs:** any `@@index` on a tenant-scoped model whose first column isn't `tenantId` (and isn't part of a `@@unique` already led by `tenantId`).

---

### Pitfall 9: Prisma 7 setup differs from every pre-2026 tutorial

**What goes wrong:** `datasource { url = env("DATABASE_URL") }` in `schema.prisma` silently does not drive the client; `new PrismaClient()` without an adapter fails; the generated client isn't at `@prisma/client`; `prisma.$use()` doesn't exist; `prisma migrate dev` no longer runs seeds.

**How to avoid:** follow Code Example 1 exactly. Verified this session end-to-end (`prisma generate` succeeded with `datasource db { provider = "postgresql" }` carrying **no** `url`, config supplied entirely by `prisma.config.ts`).

**Also:** `.gitignore` the generated output directory, and make `prisma generate` a `postinstall`/prebuild step — CI will otherwise fail on a missing client.

---

### Pitfall 10: Windows-specific `next start` + `proxy.ts` regression

**What goes wrong:** vercel/next.js issue **#85243** — "Proxy does not work on Windows 11 in Next.js 16 when running `next start`." Reported against 16.0.0 on Windows 11; the workaround in the thread was renaming back to `middleware.ts`. Silent failure: the proxy simply doesn't run, so **every** host resolves as the root domain and no tenant storefront works.

**Status:** closed 2025-10-28 (opened 2025-10-22), so it should be fixed well before 16.3.1. **This developer is on Windows 11 Pro**, so do not assume.

**How to avoid:** make "`next build && next start` on Windows, then `curl -H 'Host: store1.localhost' http://localhost:3000/`, assert the rewrite happened" an explicit Wave-0 smoke check. `next dev` is not sufficient evidence — the reported bug was `next start`-only.

---

## Code Examples

Patterns below are written against the exact versions verified in this session. Provenance is noted per block.

### 1. Prisma 7 setup — config, generator, adapter, singleton

```ts
// prisma.config.ts   [VERIFIED: prisma@7.9.1 — `prisma generate` run successfully with this shape]
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",     // Prisma 7 no longer auto-seeds on `migrate dev`
  },
  datasource: {
    url: env("DATABASE_URL"),       // Neon POOLED url (C-5)
    // directUrl: env("DIRECT_URL"), // unpooled, for migrations
  },
});
```

```prisma
// prisma/schema.prisma   [VERIFIED: generated cleanly on 7.9.1]
generator client {
  provider = "prisma-client"          // NOT "prisma-client-js"
  output   = "../src/generated/prisma" // required in Prisma 7
}

datasource db {
  provider = "postgresql"             // NOTE: no `url` — it lives in prisma.config.ts
}
```

```ts
// src/server/db/base.ts   [CITED: prisma.io/docs/guides/upgrade-prisma-orm/v7]
import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/env";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prismaBase =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaBase;
```

---

### 2. `classifyHost` — pure, fail-closed, exhaustively testable

```ts
// src/server/tenant/host.ts
// [VERIFIED: fail-closed semantics designed against Next.js 16 proxy docs + DOM-02]
import { RESERVED_SLUGS } from "./reserved-slugs";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type HostResult =
  | { kind: "root" }
  | { kind: "reserved"; label: string }
  | { kind: "store"; slug: string }
  | { kind: "unknown"; reason: string };

/** rootDomain: "einort.com" in prod, "localhost:3000" in dev. Port is ignored. */
export function classifyHost(rawHost: string | null, rootDomain: string): HostResult {
  if (!rawHost) return { kind: "unknown", reason: "missing-host" };

  const host = rawHost.toLowerCase().trim().split(":")[0].replace(/\.$/, "");
  const root = rootDomain.toLowerCase().trim().split(":")[0];

  if (!host) return { kind: "unknown", reason: "empty-host" };
  if (host === root) return { kind: "root" };

  // FAIL CLOSED: anything not strictly under the root domain is never a tenant. (DOM-02)
  if (!host.endsWith(`.${root}`)) return { kind: "unknown", reason: "foreign-domain" };

  const label = host.slice(0, -(root.length + 1));

  if (label.includes(".")) return { kind: "unknown", reason: "deep-subdomain" };
  if (label === "www") return { kind: "root" };
  if (RESERVED_SLUGS.has(label)) return { kind: "reserved", label };
  if (label.startsWith("xn--")) return { kind: "unknown", reason: "punycode" };
  if (/^\d+$/.test(label)) return { kind: "unknown", reason: "numeric-label" };
  if (label.length < 3 || label.length > 40) return { kind: "unknown", reason: "bad-length" };
  if (!SLUG_RE.test(label)) return { kind: "unknown", reason: "bad-format" };

  return { kind: "store", slug: label };
}
```

Required unit-test table (TEN-07 / DOM-02):

| Input Host | Expected |
|---|---|
| `einort.com`, `EINORT.COM`, `einort.com.`, `einort.com:443` | `root` |
| `www.einort.com` | `root` |
| `api.einort.com`, `admin.einort.com`, `app.einort.com` | `reserved` |
| `mystore.einort.com` | `store: mystore` |
| `a.b.einort.com` | `unknown: deep-subdomain` |
| `einort.com.evil.tld` | `unknown: foreign-domain` ← **the critical one** |
| `notmyeinort.com` | `unknown: foreign-domain` |
| `xn--80ak6aa92e.einort.com` | `unknown: punycode` |
| `-bad-.einort.com`, `UP.einort.com`, `ab.einort.com` | `unknown` |
| `""`, `null`, `192.168.1.1` | `unknown` |
| `store1.localhost` (root=`localhost:3000`) | `store: store1` |

---

### 3. Slug schema + the availability action D-02 actually needs

```ts
// src/server/tenant/slug.ts   [VERIFIED at runtime against zod@4.4.3]
import { z } from "zod";
import { RESERVED_SLUGS } from "./reserved-slugs";

export const storeSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3,  "At least 3 characters")
  .max(40, "At most 40 characters")             // well under the 63-char DNS label limit
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
         "Lowercase letters, numbers and single hyphens only — cannot start or end with a hyphen")
  .refine((s) => !s.startsWith("xn--"), "Not allowed")
  .refine((s) => !/^\d+$/.test(s),      "Cannot be all numbers")
  .refine((s) => !RESERVED_SLUGS.has(s), "That name is reserved by EINORT");
```

```ts
// src/server/tenant/actions.ts
"use server";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { storeSlugSchema } from "./slug";
import { platformDb } from "@/server/db/platform";

const limiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "rl:slugcheck",
});

export type SlugStatus =
  | { status: "available" }
  | { status: "invalid" | "reserved" | "taken" | "rate-limited"; message: string };

export async function checkStoreSlug(raw: string): Promise<SlugStatus> {
  // Unauthenticated + enumerable ⇒ rate limit first (Pitfall 6).
  const h = await headers();                                  // async in Next 16
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await limiter.limit(ip)).success) {
    return { status: "rate-limited", message: "Too many checks — slow down." };
  }

  const parsed = storeSlugSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid name";
    const reserved = message.includes("reserved");
    return { status: reserved ? "reserved" : "invalid", message };
  }

  // Do NOT use authClient.organization.checkSlug here — it 401s for anonymous
  // callers (requestOnlySessionMiddleware) and ignores the reserved list. (Pitfall 3)
  const existing = await platformDb.organization.findUnique({
    where: { slug: parsed.data },
    select: { id: true },
  });

  return existing
    ? { status: "taken", message: "That address is already taken" }
    : { status: "available" };
}
```

---

### 4. `scopedDb()` — the whole tenant guarantee

```ts
// src/server/db/tenant-scoped.ts
// [VERIFIED: all 14 operations confirmed intercepted on prisma@7.9.1; tenantId in
//  findUnique.where confirmed to pass runtime validation]
import "server-only";
import { prismaBase } from "./base";

/** Every model carrying a tenantId column. Kept honest by tests/isolation/model-registry-drift.test.ts */
export const TENANT_SCOPED_MODELS = new Set<string>([
  // "Product", "Order", ... — populated as models land
]);

export function scopedDb(tenantId: string) {
  if (!tenantId) throw new Error("scopedDb: tenantId is required");

  return prismaBase.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) {
            throw new Error(
              `scopedDb: "${model}" is not a tenant-scoped model. ` +
              `Use platformDb (registry) or adminDb (platform admin, src/server/admin/** only).`
            );
          }

          const a = args as Record<string, any>;

          switch (operation) {
            case "create":
              // Overwrite, never merge — a client-supplied tenantId must never win. (C-2/TEN-08)
              a.data = { ...a.data, tenantId };
              break;

            case "createMany":
            case "createManyAndReturn":
              a.data = (Array.isArray(a.data) ? a.data : [a.data])
                .map((d: Record<string, any>) => ({ ...d, tenantId }));
              break;

            case "upsert":
              a.where  = { ...a.where,  tenantId };
              a.create = { ...a.create, tenantId };
              break;

            default:
              // findUnique/findUniqueOrThrow/findFirst(OrThrow)/findMany/count/
              // aggregate/groupBy/update/updateMany/delete/deleteMany
              // NOTE: `aggregate` and `groupBy` may arrive with no `where` at all — spreading
              // undefined is safe. findUnique accepts non-unique filters alongside the unique
              // selector in Prisma 5+, so NO findFirst rewrite is needed.
              a.where = { ...a.where, tenantId };
          }

          return query(a);
        },
      },
    },
  });
}

export type ScopedDb = ReturnType<typeof scopedDb>;
```

---

### 5. `proxy.ts` — pure classification and rewrite

```ts
// proxy.ts  (project root or src/ — NOT middleware.ts)
// [CITED: nextjs.org/docs/app/api-reference/file-conventions/proxy — v16.3.1]
import { NextResponse, type NextRequest } from "next/server";
import { classifyHost } from "@/server/tenant/host";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN!;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // (1) The internal rewrite prefix is never externally addressable. (Pitfall 2)
  if (pathname === "/s" || pathname.startsWith("/s/")) {
    return new NextResponse(null, { status: 404 });
  }

  // (2) Defence in depth: no inbound request may pre-set tenant headers. (Pitfall 1)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-tenant-id");
  requestHeaders.delete("x-store-slug");
  const passthrough = () => NextResponse.next({ request: { headers: requestHeaders } });

  const result = classifyHost(request.headers.get("host"), ROOT_DOMAIN);

  switch (result.kind) {
    case "root":                 // D-06 placeholder, D-07 signup/login/dashboard, /api/auth/*
    case "reserved":             // platform-owned hostnames — never a tenant lookup
      return passthrough();

    case "unknown":              // fail closed — DOM-02
      return NextResponse.rewrite(new URL("/store-not-found", request.url));

    case "store": {
      const url = request.nextUrl.clone();
      url.pathname = `/s/${result.slug}${pathname}`;
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }
  }
}

export const config = {
  // Deliberately does NOT exclude /api: a storefront subdomain hitting /api/auth/* must be
  // rewritten into /s/{slug}/api/auth/* (→ 404), keeping auth apex-only per D-07.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
```

---

### 6. `resolveTenantBySlug` — cached, negative-cached, fail-closed

```ts
// src/server/tenant/resolve.ts
import "server-only";
import { cache } from "react";
import { Redis } from "@upstash/redis";
import { platformDb } from "@/server/db/platform";

const redis = Redis.fromEnv();
const MISS = " none";
const TTL_HIT = 300;   // 5 min
const TTL_MISS = 60;   // shorter — bad hostnames churn (Pitfall 6)

export type ResolvedTenant = { id: string; slug: string; status: string };
const key = (slug: string) => `tenant:host:${slug}`;   // namespace per C-11

/** cache() dedupes within a single request/render pass. */
export const resolveTenantBySlug = cache(
  async (slug: string): Promise<ResolvedTenant | null> => {
    const cached = await redis.get<string>(key(slug));
    if (cached === MISS) return null;
    if (cached) {
      const t = typeof cached === "string" ? JSON.parse(cached) : (cached as ResolvedTenant);
      return t.status === "active" ? t : null;   // D-05: suspended === not found
    }

    const org = await platformDb.organization.findUnique({
      where: { slug },
      select: { id: true, slug: true, status: true },
    });

    if (!org) {
      await redis.set(key(slug), MISS, { ex: TTL_MISS });
      return null;
    }

    await redis.set(key(slug), JSON.stringify(org), { ex: TTL_HIT });
    return org.status === "active" ? org : null;
  }
);

/** Call on EVERY slug rename and status change — do not rely on TTL. (Pitfall 7) */
export async function invalidateTenantHost(...slugs: string[]) {
  await Promise.all(slugs.filter(Boolean).map((s) => redis.del(key(s))));
}
```

```tsx
// src/app/s/[slug]/layout.tsx
import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

export default async function StorefrontLayout(
  { children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }
) {
  const { slug } = await params;                 // params is async in Next 16
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) notFound();                       // renders the branded page (D-04/D-05)
  return <>{children}</>;
}
```

---

### 7. Better Auth config — organization as tenant, reserved-slug gate

```ts
// src/server/auth/auth.ts   [VERIFIED against better-auth@1.6.29 dist types + source]
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { prismaBase } from "@/server/db/base";
import { storeSlugSchema } from "@/server/tenant/slug";

export const auth = betterAuth({
  database: prismaAdapter(prismaBase, { provider: "postgresql" }),

  emailAndPassword: { enabled: true },

  user: {
    additionalFields: {
      // C-8: single-owner Super Admin as an enum-ish field, NOT the admin plugin.
      platformRole: { type: "string", input: false, required: false, defaultValue: "merchant" },
    },
  },

  databaseHooks: {
    session: {
      create: {
        // Back-fill activeOrganizationId on every login (groundwork for TEN-04, Phase 2).
        before: async (session) => {
          const membership = await prismaBase.member.findFirst({
            where: { userId: session.userId },
            select: { organizationId: true },
          });
          return { data: { ...session, activeOrganizationId: membership?.organizationId ?? null } };
        },
      },
    },
  },

  plugins: [
    organization({
      allowUserToCreateOrganization: false,  // public API cannot mint stores; system action still can
      organizationLimit: 1,                  // ONB-01 "create one store" — ALSO applies to system actions
      creatorRole: "owner",

      schema: {
        organization: {
          additionalFields: {
            status: { type: "string", input: false, required: false, defaultValue: "active" },
          },
        },
      },

      organizationHooks: {
        // Authoritative reserved-slug + format gate (TEN-06).
        // MUST only throw or return void — returning { data } re-spreads ctx.body
        // (including userId) into the insert. See Pattern 5.
        beforeCreateOrganization: async ({ organization: org }) => {
          const parsed = storeSlugSchema.safeParse(org.slug ?? "");
          if (!parsed.success) {
            throw new APIError("BAD_REQUEST", {
              message: parsed.error.issues[0]?.message ?? "Invalid store address",
            });
          }
        },
      },
    }),

    nextCookies(),   // MUST be last in the array
  ],
});
```

```ts
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/server/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";
export const { GET, POST } = toNextJsHandler(auth);
```

---

### 8. Signup server action — user + store in one flow

```ts
// src/server/auth/signup.ts
"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "./auth";
import { storeSlugSchema } from "@/server/tenant/slug";

const signupSchema = z.object({
  email: z.email(),                 // zod v4 top-level form (verified present in 4.4.3)
  password: z.string().min(8).max(128),
  storeName: z.string().trim().min(2).max(80),
  slug: storeSlugSchema,
});

export async function signUpMerchant(input: unknown) {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: z.treeifyError(parsed.error) };
  const { email, password, storeName, slug } = parsed.data;

  const h = await headers();

  // 1. Create user + session. nextCookies() persists the session cookie.
  const signUp = await auth.api.signUpEmail({
    body: { email, password, name: storeName },
    headers: h,
  });

  // 2. Create the tenant as a SYSTEM ACTION: pass userId, pass NO headers.
  //    Verified: `isSystemAction = !session && ctx.body.userId` bypasses
  //    allowUserToCreateOrganization:false, while organizationLimit:1 still applies.
  let org;
  try {
    org = await auth.api.createOrganization({
      body: { name: storeName, slug, userId: signUp.user.id },
    });
  } catch (e) {
    // Slug lost a race between the live check and submit, or the reserved gate fired.
    return { ok: false as const, error: { slug: ["That address was just taken — try another"] } };
  }

  // 3. A system action does NOT set the active org (no session in its ctx) — do it explicitly.
  if (org?.id) {
    await auth.api.setActiveOrganization({ headers: h, body: { organizationId: org.id } });
  }

  return { ok: true as const, slug };
}
```

> If step 2 fails the user exists with no store. Route any authenticated user with zero
> organizations to `/onboarding/create-store` — the recovery path, and later the home of D-03's rename UI.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact on this phase |
|--------------|------------------|--------------|----------------------|
| `middleware.ts` exporting `middleware`, Edge runtime | `proxy.ts` exporting `proxy`, **Node.js runtime always** | Next.js 16.0.0 | Rewrites Pattern 1 of the project-level ARCHITECTURE.md; `export const runtime` in the file now **throws** |
| `experimental.ppr` / `experimental.dynamicIO` | `cacheComponents: true`, fully opt-in; everything dynamic by default | Next.js 16.0.0 | Default posture is the tenant-safe one — leave it off |
| `next lint` | ESLint (flat config) invoked directly; `next build` no longer lints | Next.js 16.0.0 | The TEN-02/TEN-05 lint boundary must be a separate CI step |
| Sync `headers()`, `cookies()`, `params`, `searchParams` | All **async** — must be awaited | Next.js 15 → enforced in 16 | Every example above awaits them |
| `revalidateTag(tag)` | `revalidateTag(tag, profile)`; new `updateTag()` / `refresh()` | Next.js 16.0.0 | Relevant when cache invalidation lands (Phase 4) |
| `prisma.$use()` middleware | **Removed** — Client Extensions only | Prisma 7.0.0 | Removes the alternative; `$extends` is the sole mechanism |
| Implicit Rust query engine, `datasource.url` in schema | Rust-free client + **mandatory driver adapter**; connection in `prisma.config.ts` | Prisma 7.0.0 | Code Example 1 |
| `prisma-client-js` generator, import from `@prisma/client` | `prisma-client` generator with a **required** `output` path | Prisma 7.0.0 | Better Auth's Prisma adapter must be handed the custom-path client |
| `findUnique` cannot take non-unique filters (→ rewrite to `findFirst` for tenant scoping) | `WhereUniqueInput` = `AtLeast<{…all scalars…}, uniqueKeys>` — non-unique filters allowed | Prisma 5.0 (`extendedWhereUnique` GA) | **Deletes the most-cited workaround.** Verified on 7.9.1 |
| `Prisma.dmmf` for runtime model introspection | **Not exported** by the Prisma 7 `prisma-client` generator. Use `Prisma.ModelName` + `Prisma.<Model>ScalarFieldEnum` | Prisma 7.0.0 | Changes how the drift guard is written |
| Auth.js / NextAuth v5 | Better Auth (Auth.js in maintenance mode; its team now maintains Better Auth) | 2025-09 → 2026-07 | Already locked by C-3 |
| `@better-auth/cli` | `auth` (`npx auth@latest generate`) — `@better-auth/cli` stale at 1.4.21 vs `auth`/`better-auth` at 1.6.29 | — | Use the right package name |

**Deprecated / outdated:**
- `middleware.ts` — works, deprecated, slated for removal.
- `next/legacy/image`, `images.domains`, single-argument `revalidateTag()`.
- AMP, `serverRuntimeConfig`/`publicRuntimeConfig`, `next lint` — **removed** in Next 16.
- The `findUnique`→`findFirst` tenant-scoping workaround — obsolete since Prisma 5.

---

## Assumptions Log

Claims that were **not** verified in this session. The planner should treat these as needing confirmation.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The extension applies to clients yielded inside `scopedDb(t).$transaction(async (tx) => …)` | Pitfall 4 | If false, every transactional write is unscoped. **Highest-risk assumption here.** Assert it in the isolation suite before writing any transactional code. |
| A2 | `npx auth@latest generate` on 1.6.29 emits `slug String @unique` (non-nullable) for `organization` | Pattern 3 | A nullable slug weakens DOM-02 to an application-level guarantee. Table metadata says `required: true, unique: true`; the *emitted Prisma* was not inspected. Verify the generated file. |
| A3 | `databaseHooks.session.create.before` returning `{ data: { …, activeOrganizationId } }` persists correctly with the org plugin's session field | Code Example 7 | Dashboard tenant context silently null in Phase 2. Pattern is from official docs but untested here. |
| A4 | `Redis.fromEnv()` works with the Upstash env var names the project will use | Code Example 3/6 | Boot failure, caught immediately. Low risk. |
| A5 | Next 16 `proxy.ts` on Vercel has no problematic bundle-size ceiling for the pure classifier | Pattern 1 | Low — the classifier imports nothing heavy. Would only matter if someone adds Prisma to it. |
| A6 | `neon-testing@3.0.1` yields a connection string usable by `@prisma/adapter-pg` (its peer dep is `@neondatabase/serverless`) | Alternatives | Only relevant if the planner picks the flagged package. Recommended path avoids it. |
| A7 | Windows `next start` + `proxy.ts` regression (#85243) is genuinely fixed in 16.3.1 | Pitfall 10 | Total silent routing failure on the dev's own machine. Issue is closed; **not** verified on 16.3.1. → Wave-0 smoke check. |
| A8 | The recommended reserved-slug list is complete enough | Pattern 2 | A future platform hostname collides with a live tenant. Mitigated: the list is one constant, cheap to extend. |
| A9 | `NEXT_PUBLIC_ROOT_DOMAIN` is the right env-var choice (public prefix means it ships to the client) | Code Example 5 | The root domain is not a secret, so exposure is fine; the risk is only that a *server-only* var would fail inside `proxy.ts` if Next treats it differently. Confirm during setup. |

---

## Open Questions

1. **Does the tenant-scope extension survive `$transaction`?** (= A1)
   - Known: extensions wrap client operations; interactive-transaction clients are derived from the extended client.
   - Unclear: not verifiable without a live DB in this session.
   - Recommendation: make it the **first** test in the isolation suite. If it fails, `scopedDb` must expose its own `$transaction` wrapper.

2. **Vercel preview deployments and wildcard subdomains.**
   - Known: Vercel's own starter handles a `tenant---branch.vercel.app` convention; preview URLs have a 63-char DNS-label ceiling.
   - Unclear: whether preview deploys should support tenant subdomains at all in Phase 1.
   - Recommendation: don't. Do multi-tenant testing locally via `*.localhost` (zero config on Windows/Chrome/Edge/Firefox) and on production. Have `classifyHost` return `root` for any `*.vercel.app` host so previews exercise the apex surface only.

3. **Where does `platformRole` get checked in Phase 1?**
   - Known: C-8 fixes the mechanism (a `User` field, not the admin plugin).
   - Unclear: Phase 1 has no admin UI (that's Phase 6), so nothing reads it yet.
   - Recommendation: add the field and `adminDb` + its lint boundary now (TEN-05 demands the *architectural* isolation), but build no admin routes. TEN-05 is satisfied by the client existing, being unscoped, and being lint-fenced.

4. **Does `organizationLimit: 1` conflict with anything later?**
   - Known: it applies to system actions too (verified), which gives idempotent signup.
   - Unclear: whether a merchant will ever legitimately need a second store.
   - Recommendation: keep `1` for V1; it is a one-line change and REQUIREMENTS.md ONB-01 says "one store."

5. **Should `/store-not-found` return HTTP 404?**
   - Known: D-04 wants a branded page. A `NextResponse.rewrite` preserves 200 by default.
   - Unclear: SEO/monitoring preference.
   - Recommendation: return a genuine 404 status with branded content — reach it via `notFound()` and a custom `not-found.tsx` rather than rewriting to a 200 page, so crawlers don't index thousands of wildcard hostnames.

---

## Environment Availability

Probed on this machine (Windows 11 Pro, `win32`) on 2026-08-16.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next 16 (needs ≥ 20.9) | ✓ | v24.16.0 | — |
| npm | package install | ✓ | 11.13.0 | — |
| git | version control | ✓ | 2.54.0.windows.1 | — |
| Python + pip | `slopcheck` package auditing | ✓ | 3.14 | — |
| **Docker** | Testcontainers-based Postgres for isolation tests | **✗** | — | **Neon test branch** (recommended) or PGlite |
| **Local Postgres / `psql`** | local integration DB | **✗** | — | **Neon test branch** |
| pnpm | alt package manager | ✗ | — | npm (fine) |
| Vercel CLI | domain config, deploy | ✗ | — | Vercel dashboard (wildcard setup is a one-time UI task anyway) |
| Neon account + `DATABASE_URL` | everything | ? (not verifiable here) | — | none — hard requirement |
| Upstash Redis creds | hostname cache, rate limiting | ? (not verifiable here) | — | in-memory `Map` shim behind the same `cache.ts` interface for local dev only |

**Missing dependencies with no fallback:**
- Neon Postgres connection (pooled + direct URLs). Blocks migrations, Better Auth, and the isolation suite. Must be provisioned before any coding task.

**Missing dependencies with fallback:**
- **Docker is absent.** This eliminates `@testcontainers/postgresql`, the most commonly recommended Prisma integration-test approach. **The plan must not assume it.** Use a dedicated Neon branch (`einort-test`) as `TEST_DATABASE_URL`.
- Upstash: `resolveTenantBySlug` should degrade to a direct DB read if Redis is unconfigured, so local dev works without Upstash credentials. Keep the degradation behind the `cache.ts` interface, and make it **loud** (console warning) so it never silently ships to production.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | **none — Wave 0** (`vitest.config.ts`) |
| Quick run command | `npx vitest run tests/unit --reporter=dot` |
| Full suite command | `npx dotenv -e .env.test -- npx vitest run` |

Two projects in one config: `unit` (node env, no DB, < 2s) and `isolation` (node env, requires `TEST_DATABASE_URL`, `globalSetup` runs `prisma migrate deploy` + seeds two tenants).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEN-01 | Every tenant-scoped model has `tenantId` + a `tenantId`-leading index | unit | `npx vitest run tests/isolation/model-registry-drift.test.ts` | ❌ Wave 0 |
| TEN-02 | All 14 ops inject `tenantId`; unregistered models throw | integration | `npx vitest run tests/isolation/tenant-isolation.test.ts -t "injects"` | ❌ Wave 0 |
| TEN-02 | No module outside the allowed zones imports `prismaBase`/generated client; no `$queryRaw` | lint | `npx eslint . --max-warnings=0` | ❌ Wave 0 |
| TEN-03 | Hostname classification is exact and fails closed | unit | `npx vitest run tests/unit/host.test.ts` | ❌ Wave 0 |
| TEN-03 | Client-supplied `x-tenant-id` is stripped by the proxy | unit | `npx vitest run tests/unit/proxy.test.ts -t "strips"` | ❌ Wave 0 |
| TEN-05 | `adminDb` is unscoped and importable only from `server/admin/**` | lint + integration | `npx eslint . --max-warnings=0` + `vitest -t "adminDb sees both tenants"` | ❌ Wave 0 |
| TEN-06 | Reserved slugs rejected at form, write, and route layers | unit + integration | `npx vitest run tests/unit/slug.test.ts tests/isolation/signup.test.ts` | ❌ Wave 0 |
| TEN-07 | Two-tenant suite green across **every** registered model | integration | `npx dotenv -e .env.test -- npx vitest run tests/isolation` | ❌ Wave 0 |
| TEN-08 | A caller-supplied `tenantId` in `data`/`where` is overwritten, never honoured | integration | `vitest -t "ignores client-supplied tenantId"` | ❌ Wave 0 |
| DOM-01 | Signup produces a resolvable slug; `resolveTenantBySlug` returns it | integration | `vitest -t "signup provisions a resolvable store"` | ❌ Wave 0 |
| DOM-02 | Unknown/foreign/deep hostnames never resolve to any tenant | unit | `npx vitest run tests/unit/host.test.ts -t "fails closed"` | ❌ Wave 0 |
| DOM-02 | `GET einort.com/s/{slug}` returns 404 | unit | `npx vitest run tests/unit/proxy.test.ts -t "internal prefix"` | ❌ Wave 0 |
| ONB-01 | Signup creates user + org + membership; a second store is refused | integration | `npx vitest run tests/isolation/signup.test.ts` | ❌ Wave 0 |
| — | Windows `next build && next start` serves the proxy rewrite (Pitfall 10) | manual smoke | `next build && next start`, then `curl -H "Host: store1.localhost" localhost:3000/` | ❌ Wave 0 |

### The two structural tests (write these first)

**A. Model-generic isolation.** Do not write per-model tests — iterate the registry so new Phase 3+ models are covered automatically:

```ts
for (const model of TENANT_SCOPED_MODELS) {
  const key = model[0].toLowerCase() + model.slice(1);
  describe(model, () => {
    it("findMany returns only tenant B rows",         …);
    it("findUnique on a tenant-A id returns null",    …);   // exercises the extendedWhereUnique path
    it("update on a tenant-A id affects 0 rows",      …);
    it("delete on a tenant-A id throws / affects 0",  …);
    it("updateMany/deleteMany never touch tenant A",  …);
    it("count/aggregate/groupBy exclude tenant A",    …);
    it("create stamps tenantId=B even when data says A", …);   // TEN-08
    it("upsert cannot resurrect a tenant-A row",      …);
  });
}
it("adminDb sees rows from BOTH tenants", …);                  // TEN-05 — proves the layers differ
it("$transaction inside scopedDb stays scoped", …);            // A1 — the open question
```

**B. Schema-drift guard.** `Prisma.dmmf` is gone in Prisma 7, but the generated client still exports `Prisma.ModelName` and a `Prisma.<Model>ScalarFieldEnum` per model — **both verified present on 7.9.1** in this session:

```ts
import { Prisma } from "@/generated/prisma/client";
import { TENANT_SCOPED_MODELS } from "@/server/db/tenant-scoped";

it("every model with a tenantId column is registered in TENANT_SCOPED_MODELS", () => {
  const P = Prisma as any;
  const withTenantId = Object.keys(P.ModelName).filter((m) =>
    Object.keys(P[`${m}ScalarFieldEnum`] ?? {}).includes("tenantId")
  );
  expect([...withTenantId].sort()).toEqual([...TENANT_SCOPED_MODELS].sort());
});
```

This single test is what stops TEN-02 from silently decaying in Phases 3-6 — adding a model with `tenantId` and forgetting the registry becomes a red build.

### Sampling Rate

- **Per task commit:** `npx vitest run tests/unit --reporter=dot` + `npx eslint . --max-warnings=0` (both < 10s, no DB)
- **Per wave merge:** `npx dotenv -e .env.test -- npx vitest run` (full, includes isolation)
- **Phase gate:** full suite green + the Windows `next start` smoke check, before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — two projects (`unit`, `isolation`), `globalSetup` for the isolation project
- [ ] `.env.test` + `TEST_DATABASE_URL` pointing at a dedicated Neon branch (**Docker is unavailable — Testcontainers is not an option**)
- [ ] `tests/setup/global-setup.ts` — `prisma migrate deploy`, then truncate + seed
- [ ] `tests/setup/seed-two-tenants.ts` — tenants A and B, one row per registered model each
- [ ] `tests/unit/host.test.ts` — the full classification table above
- [ ] `tests/unit/slug.test.ts` — format + reserved cases
- [ ] `tests/unit/proxy.test.ts` — `unstable_doesProxyMatch`, `isRewrite`, `getRewrittenUrl`, header-strip, `/s/` 404
- [ ] `tests/isolation/tenant-isolation.test.ts` — model-generic suite
- [ ] `tests/isolation/model-registry-drift.test.ts` — the drift guard
- [ ] `tests/isolation/signup.test.ts` — ONB-01 + TEN-06 write-layer
- [ ] `eslint.config.mjs` — import-zone rules (Next 16 removed `next lint`; wire ESLint into scripts + CI)
- [ ] Framework install: `npm i -D vitest@4.1.10 tsx@4.23.12 dotenv-cli@11.0.0`

---

## Security Domain

`security_enforcement` is not disabled in `.planning/config.json` — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **yes** | Better Auth `emailAndPassword`; never hand-roll hashing/session. Rate-limit signup and login with `@upstash/ratelimit`. |
| V3 Session Management | **yes** | Better Auth cookies; **host-only on the apex** — do not set `crossSubDomainCookies` (Pitfall 5). Set `advanced.cookiePrefix`. |
| V4 Access Control | **yes** | The core of this phase. `scopedDb` for tenant scoping; `platformRole` on `User` for the platform boundary; lint-enforced client separation (TEN-05). |
| V5 Input Validation | **yes** | Zod 4 on every server action (C-9). Slug is the highest-value input — it becomes a DNS label and a routing decision. |
| V6 Cryptography | no (delegated) | Password hashing is Better Auth's; no bespoke crypto in this phase. |
| V7 Error Handling / Logging | **yes** | D-05 requires *identical* output for suspended vs. never-existed hostnames — an explicit anti-enumeration decision. Do not leak the distinction in status codes, timing, or logs surfaced to users. |
| V13 API / Web Service | **yes** | `/api/auth/*` must be apex-only; `checkStoreSlug` is unauthenticated and must be rate-limited. |

### Known Threat Patterns for Next.js 16 + Prisma 7 multi-tenant

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged `x-tenant-id` request header | Spoofing / Elevation | Unconditionally strip in `proxy.ts`; prefer path rewrite (Pitfall 1) |
| Direct hit on the internal `/s/{slug}` prefix | Spoofing / Information disclosure | 404 the prefix as the proxy's first statement (Pitfall 2) |
| Reserved-slug hijack (`admin.einort.com` claimed by a merchant) | Spoofing / Elevation | Three-layer reserved enforcement (Pattern 2) |
| Cross-tenant read/write via a query missing the filter | Information disclosure / Tampering | `scopedDb` `$allOperations` + allowlist throw + model-generic tests |
| Cross-tenant write via nested `create` or `$queryRaw` | Tampering | Required `tenantId`; lint-ban raw queries (Pitfall 4) |
| Session cookie readable from a merchant-controlled storefront | Elevation | No `crossSubDomainCookies`; auth apex-only (D-07) |
| Slug enumeration via the unauthenticated availability endpoint | Information disclosure | `@upstash/ratelimit` per IP; uniform response shape |
| Wildcard-subdomain scan exhausting the DB pool | Denial of service | Negative caching + format rejection at zero-I/O classification (Pitfall 6) |
| Suspended store still serving after admin action | Tampering / Repudiation | Invalidate on write, don't wait for TTL (Pitfall 7) |
| Suspended vs. non-existent disclosed to an anonymous visitor | Information disclosure | D-05 — identical response for both |
| Client-supplied `tenantId` honoured on create | Tampering | `scopedDb` **overwrites**, never merges (TEN-08, Code Example 4) |
| Punycode/homograph subdomain impersonating a real store | Spoofing | Reject `xn--` labels in both slug schema and `classifyHost` |

---

## Sources

### Primary (HIGH confidence)

- **Direct empirical verification in this session** — installed `prisma@7.9.1` + `@prisma/client@7.9.1` + `@prisma/adapter-pg@7.9.1`, generated a client, and probed extension interception across all 14 model operations, `findUnique` + `tenantId` runtime validation (with a `PrismaClientValidationError` negative control), `Prisma.dmmf` absence, and `Prisma.ModelName` / `Prisma.<Model>ScalarFieldEnum` presence.
- **Direct source inspection of `better-auth@1.6.29`** — `dist/plugins/organization/{organization.mjs,types.d.mts,schema.mjs}`, `dist/plugins/organization/routes/crud-org.mjs`, `dist/api/routes/session.mjs`. Established: `createOrganization` system-action semantics, `organizationLimit` applying to system actions, the `beforeCreateOrganization` `ctx.body` re-spread trap, `requestOnlySessionMiddleware` 401 behaviour, `checkOrganizationSlug` throwing on collision, and `slug: { required: true, unique: true }`.
- **Runtime verification of `zod@4.4.3`** — top-level `z.email()` present, `z.string().email()` still present, slug regex + `.trim().toLowerCase()` behaviour.
- [Next.js — `proxy.js` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (docs version 16.3.1, updated 2026-08-04) — export name, Node.js-only runtime, matcher semantics, `_next/data` behaviour, Server Function coverage caveat, request-header setting, `next/experimental/testing/server`, codemod.
- [Next.js 16 release blog](https://nextjs.org/blog/next-16) — Cache Components opt-in, proxy rename, async request APIs, `next lint` removal, Node 20.9+ minimum, `revalidateTag` signature change.
- [Prisma — Upgrade to v7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) — `prisma.config.ts`, `prisma-client` generator + required output, driver-adapter requirement, `$use()` removal, seed behaviour.
- [Prisma — Client extensions: query component](https://www.prisma.io/docs/orm/prisma-client/client-extensions/query) — `$allModels.$allOperations`, `model` undefined for raw queries, `include`/`select` mutation prohibition.
- [Vercel — Multi-tenant platforms: configuring domains](https://vercel.com/docs/platforms/multi-tenant-platforms/configuring-domains) and [quickstart](https://vercel.com/docs/platforms/multi-tenant-platforms/quickstart) — wildcard domain setup, Vercel nameserver requirement, on-the-fly certs, 63-char label limit.
- [Better Auth — Next.js integration](https://www.better-auth.com/docs/integrations/next) — `toNextJsHandler`, `nextCookies()` last, `auth.api.getSession({ headers: await headers() })`, Next 16 proxy note.
- [Better Auth — Cookies](https://www.better-auth.com/docs/concepts/cookies) — `crossSubDomainCookies` shape and the explicit untrusted-subdomain warning.
- [Better Auth — Database](https://www.better-auth.com/docs/concepts/database) and [Prisma adapter](https://www.better-auth.com/docs/adapters/prisma) — core schema, `databaseHooks` semantics, Prisma 7 custom-output requirement.
- [vercel/platforms `proxy.ts`](https://github.com/vercel/platforms/blob/main/proxy.ts) — fetched raw; confirms the rename in Vercel's own reference and the `tenant---branch.vercel.app` preview convention (also shows the gaps documented under Anti-Patterns).
- [vercel/next.js issue #85243](https://github.com/vercel/next.js/issues/85243) — fetched via GitHub API: closed 2025-10-28, Windows 11 `next start` proxy regression.
- npm registry (`npm view`, 2026-08-16) — versions for all packages in the Standard Stack, plus repository URLs, creation dates and weekly download counts from `api.npmjs.org`.
- `slopcheck` (pip, run 2026-08-16) — package legitimacy audit.

### Secondary (MEDIUM confidence)

- [Better Auth — Organization plugin docs](https://www.better-auth.com/docs/plugins/organization) — option list and hook shapes; **cross-checked against the installed 1.6.29 typings**, which is what the tables above actually reflect.
- [Prisma blog — CI for Prisma Tests with GitHub Actions (Prisma 7)](https://www.prisma.io/blog/testing-series-5-xWogenROXm) and [Unit Testing Prisma with Vitest](https://www.prisma.io/blog/testing-series-2-xPhjjmIEsM) — Prisma 7 testing guidance (explicit `prisma generate` in CI).
- [Neon — Neon Testing, a Vitest library](https://neon.com/blog/neon-testing-a-vitest-library-for-your-integration-tests) — branch-per-test-file model; the package itself is third-party and flagged.
- `*.localhost` resolution behaviour across Chrome/Edge/Firefox on Windows — multiple independent write-ups agree; consistent with RFC 6761.

### Tertiary (LOW confidence — flagged, not relied upon)

- GitHub issues [#6791](https://github.com/better-auth/better-auth/issues/6791) (`createOrganization` blocked in db hooks) and [#4334](https://github.com/better-auth/better-auth/issues/4334) (`autoCreateOrganizationOnSignUp` not implemented) — **both contradicted or superseded by direct source inspection of 1.6.29**: the system-action path works, and no `autoCreateOrganizationOnSignUp` option exists in this version (grep of the full dist found zero occurrences). Recorded to explain why the plan does not follow the advice in those threads.
- Community blog posts on Next.js multi-tenant subdomain routing — used only for orientation; every load-bearing claim above traces to an official doc or a direct verification.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard stack | HIGH | Every version confirmed against the npm registry today; peer-dep compatibility already established in project-level research and re-checked. |
| Prisma 7 tenant-scoping mechanics | **HIGH** | Empirically probed against a generated 7.9.1 client — operation coverage, arg shapes, `findUnique` validation, and available runtime metadata all measured rather than assumed. |
| Better Auth organization mechanics | **HIGH** | Read from installed 1.6.29 dist source, not docs. Corrects two widely-cited GitHub issues. |
| Next.js 16 routing (`proxy.ts`) | HIGH | Official file-convention docs at version 16.3.1 plus Vercel's own reference implementation. |
| Hostname/routing architecture | MEDIUM-HIGH | Mechanics HIGH; the specific two-stage split is a reasoned synthesis of official Proxy guidance rather than a documented named pattern. |
| Pitfalls | MEDIUM-HIGH | Pitfalls 1-4 and 9 derive from verified behaviour; 5-8 from official warnings plus project-level PITFALLS.md; 10 from a real (closed) issue that was not re-verified on 16.3.1. |
| Testing strategy | MEDIUM | Framework and drift-guard mechanics verified; the Neon-branch workflow itself is a reasoned choice forced by Docker's absence and was not executed end-to-end. |
| Environment availability | HIGH | Directly probed on this machine. |

**Research date:** 2026-08-16
**Valid until:** 2026-09-15 (~30 days). Shorten to ~7 days for the Better Auth specifics — 1.6.x is shipping frequently, and the `createOrganization` / `checkSlug` internals relied on here are unexported implementation details that could change in a patch release. Re-verify against the installed version at execution time if the lockfile moves off 1.6.29.
