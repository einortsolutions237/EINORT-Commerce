# Stack Research

**Domain:** Multi-tenant commerce storefront-builder SaaS (Next.js/Postgres/Prisma, solo 30-day build, Cameroon-first, Vercel-hosted)
**Researched:** 2026-08-16
**Confidence:** HIGH for versions/library choices (verified against npm registry + official docs/changelogs, Aug 2026), MEDIUM for architecture-pattern recommendations (verified against multiple current community sources, not a single authority)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.3.1 | App Router, server actions, middleware, image optimization | Current stable major as of Aug 2026. React Compiler is now stable (auto-memoization, less manual perf work for a solo dev). `create-next-app` ships TS-first + Tailwind + ESLint by default. Cache Components are opt-in in v16, so you keep v15-style "everything dynamic by default" behavior unless you deliberately opt tenant storefront pages into caching later — important because per-tenant pages must never leak cached data across tenants by accident. |
| TypeScript | 7.0.x (installed: 7.0.2) | Language/type-checking | Went GA July 8, 2026 with the Go-native compiler (Project Corsa): 8–12x faster builds/typecheck, dramatically more responsive language server on a large monorepo-ish codebase. **Caveat (MEDIUM confidence, flag for validation):** TS 7.1, expected ~Oct 2026, is what restores full programmatic-API parity for some ecosystem tooling (Vue/Svelte/Astro/MDX language servers). This project is plain Next.js/React, which has first-class 7.0 support, so this is low-risk here — but if any tool in your chain (ESLint plugin, codegen) throws obscure errors, pin to TypeScript 5.9 LTS as a fallback rather than debugging a 7.0-era tooling gap mid-sprint. |
| React | 19.2.x | UI runtime | Ships with Next 16 by default; React Compiler stable removes most `useMemo`/`useCallback` busywork — meaningful time savings for a solo 30-day build. |
| PostgreSQL | 17 (via Neon) | Primary datastore | Row-level multi-tenancy at the scale target (2M stores) is only affordable on shared-schema Postgres; Neon defaults to current Postgres major. |
| Neon (managed Postgres) | — | Hosting for Postgres | Chosen over Supabase for this project. Native Vercel integration, **instant copy-on-write branching per PR/preview deploy** (a solo dev iterating daily benefits enormously — every preview gets a real, isolated DB branch in <1s, no migration replay), and scale-to-zero billing that fits a pilot with unpredictable traffic. Supabase is the better call only if you want its bundled Auth/Storage/Realtime BaaS stack — this project doesn't need that bundle since auth, storage (R2), and no realtime requirement are already decided independently. |
| Prisma ORM + Client | 7.9.1 | Schema, migrations, query builder | Current major. **Breaking change from Prisma 5/6 you must design around from day one:** Prisma 7 ships a Rust-free client by default and *requires* an explicit driver adapter — there is no more implicit query-engine binary. `datasource.url` is no longer read from `schema.prisma`; connection + adapter config now lives in `prisma.config.ts`. Budget ~30 minutes in Phase 1 to get this right (it is a common stumbling block if training-data intuition from Prisma 5 is used). |
| `@prisma/adapter-pg` | 7.9.1 | Prisma driver adapter (Node.js runtime) | Use for all server actions / route handlers that run in the Node.js runtime (the default, and mandatory wherever Sharp is used — see below). Point it at Neon's **pooled** connection string, not the direct one, to avoid exhausting Postgres connection limits under serverless concurrency. |
| `@prisma/adapter-neon` + `@neondatabase/serverless` | 7.9.1 / 1.1.0 | Prisma driver adapter (Edge runtime, HTTP-based) | Only needed if you deliberately put specific read paths (e.g. storefront hostname → tenant lookup) on the Edge runtime for latency. Not required for V1 — start with `adapter-pg` everywhere and only reach for this if you hit a real latency problem with the tenant-resolution middleware. |
| Better Auth | 1.6.29 | Authentication (merchant, platform admin) | See dedicated rationale below — replaces both Auth.js and Clerk for this project. |
| `@better-auth/prisma-adapter` | 1.6.29 (ships bundled with `better-auth`) | Persists Better Auth's schema through your existing Prisma client | Officially supported first-class adapter; peer-dep declares Prisma `^7.0.0` compatibility — confirmed compatible with the version above. |
| Upstash Redis | REST/HTTP Redis, `@upstash/redis` 1.38.2 | Cart sessions, tenant-resolution cache, idempotency keys, rate-limit state | HTTP-based (no persistent TCP connection), so it works natively from Vercel serverless *and* Edge middleware with no connection-pooling problem — the same class of problem you must solve for Postgres, Redis solves for free here. |
| `@upstash/ratelimit` | 2.0.8 | Rate limiting middleware | Purpose-built sliding-window/token-bucket limiter on top of Upstash Redis, designed to run in Next.js Edge Middleware. |
| Cloudflare R2 | S3-compatible API | Product image / asset storage | Already decided in project constraints. Zero egress fees matter for an image-heavy storefront-builder serving many tenants' product photos. |
| `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | 3.1111.0 | R2 client (S3-compatible protocol) | R2 speaks the S3 API, so the standard AWS SDK v3 works unmodified — just point `endpoint` at your R2 account URL. Use the presigner for direct browser-to-R2 presigned-URL uploads so large image uploads never transit your Vercel function body (avoids the ~4.5MB serverless request body limit and keeps upload latency off your compute). |
| Sharp | 0.35.3 | Server-side image processing (resize, crop, format conversion, enhancement) | The standard for Node.js image processing (also what `next/image`'s built-in optimizer uses internally). **Must run in the Node.js runtime, not Edge** — Sharp uses native (libvips) bindings that Edge Runtime cannot load. Confirm every route/server action that touches Sharp does not have `export const runtime = 'edge'`. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 4.4.3 | Runtime validation | Validate every server action input (product create, payment claim submit, checkout payload) — never trust client-submitted price/stock/tenant ID, per the project's own stated constraint. Zod v4 is a notable jump from v3 training-data familiarity: error-map API and some type-inference internals changed; check the migration notes if copying old Zod v3 snippets. |
| `react-hook-form` | 7.85.0 | Form state (merchant dashboard, checkout claim form) | Standard pairing with Zod via `@hookform/resolvers`. |
| `zustand` | 5.0.15 | Lightweight client-side state | Cart UI state on the storefront (optimistic add/remove) — pair with a server-persisted cart (Redis-backed, keyed by session cookie) so a refreshed/shared cart link still works. Don't use Redux/Zustand as your source of truth for anything that must survive a device switch — that's Redis/Postgres's job. |
| `@t3-oss/env-nextjs` | 0.13.11 | Typed, validated env vars | Cheap insurance against a missing `R2_*` or `DATABASE_URL` env var causing a silent prod failure — validates at build/boot time instead of at first use. |
| `nanoid` | 6.0.1 | Short unique IDs | Order numbers, payment-claim reference codes shown to customers — shorter and more typeable than a UUID when a customer has to read it back over WhatsApp. |
| `resend` | 6.20.0 | Transactional email | Low-priority for V1 given the WhatsApp/manual-payment-first design, but useful as a secondary channel for order confirmation / payment-claim-status emails if the merchant has an email on file. Don't build a bespoke SMTP integration for this — Resend's free tier and Next.js-friendly SDK cost nothing to wire up. |
| `date-fns` | 4.4.0 | Date math | Trial countdown (10-day enforcement), order timestamps. Prefer `Intl.NumberFormat`/`Intl.DateTimeFormat` directly for XAF currency formatting rather than a currency library — XAF has no decimal subunits in common usage, and a general currency-formatting library is overkill for a single-currency V1. |
| `@vercel/functions` (for `waitUntil`) | latest (bundled/available via Next.js on Vercel) | Fire-and-forget post-response work | See Job/Queue Pattern section below — this is the *first* tool to reach for, before any queue product. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint (flat config) + `eslint-config-next` | Linting | Next 16's `create-next-app` scaffolds this by default. |
| Prettier | Formatting | Standard; no notable 2026 changes worth flagging. |
| Prisma Studio (`npx prisma studio`) | DB inspection during dev | Works against your Neon branch directly; useful for a solo dev instead of building admin CRUD screens early. |
| Neon branch-per-PR (via Vercel-Neon integration) | Isolated DB per preview deploy | Turns every Vercel preview URL into a fully isolated environment with real (copied) schema — valuable for testing tenant-isolation bugs before they hit main. |

## Installation

```bash
# Core
npm install next@16.3.1 react@19.2.8 react-dom@19.2.8
npm install -D typescript@7.0.2 @types/react @types/node

# Database
npm install prisma@7.9.1 @prisma/client@7.9.1 @prisma/adapter-pg pg
npm install -D prisma

# Auth
npm install better-auth@1.6.29

# Redis
npm install @upstash/redis@1.38.2 @upstash/ratelimit@2.0.8

# Object storage (R2)
npm install @aws-sdk/client-s3@3.1111.0 @aws-sdk/s3-request-presigner@3.1111.0

# Image processing
npm install sharp@0.35.3

# Validation / forms / state
npm install zod@4.4.3 react-hook-form@7.85.0 @hookform/resolvers zustand@5.0.15

# Utilities
npm install nanoid@6.0.1 date-fns@4.4.0 @t3-oss/env-nextjs@0.13.11 resend@6.20.0
```

## Tenant-Scoped Prisma Query Pattern (HIGH confidence — cross-referenced multiple current sources)

Given the project's non-negotiable "tenant isolation enforced server-side on every query" constraint and the 2,000,000-store scale target, use:

1. **Shared database, shared schema, indexed `tenantId` column on every tenant-scoped table** — not schema-per-tenant or database-per-tenant. At the target scale, per-tenant schemas/databases are operationally impossible to provision/migrate/monitor; row-level scoping in one schema is the only pattern that scales to millions of tenants affordably. This matches the project's own architecture instinct already stated in `PROJECT.md`.
2. **Enforce scoping in code via a Prisma Client Extension**, not by remembering to add `where: { tenantId }` on every call site. Wrap the base client in an extension that injects `tenantId` into `where`/`data` automatically for every tenant-scoped model, derived from request context (resolved tenant from the authenticated session or subdomain). This makes "forgot the tenant filter" a class of bug that cannot compile/run rather than a code-review hope.
3. **Never accept `tenantId` from client input** for a mutation — always derive it server-side from the authenticated session/subdomain resolution, exactly as the project's constraint already states for price/stock/status.
4. **Postgres Row-Level Security (RLS) as defense-in-depth, deferred past V1.** RLS policies keyed on a session variable (`SET LOCAL app.tenant_id`) are a genuinely stronger belt-and-suspenders guarantee (protects even against an application bug), but wiring `SET LOCAL` per-request through Prisma's connection pooling correctly is nontrivial and easy to get subtly wrong under serverless concurrency. Given the 30-day solo timeline, ship V1 on the Prisma-extension pattern (still correct and testable) and treat RLS as a fast-follow hardening pass once past the pilot — write it into the architecture now (indexed `tenantId` on every table already gets you there) but don't spend V1 days on it.
5. **Test it:** write an integration test that creates data under tenant A, then queries as tenant B, and asserts zero rows returned. Run this on every deploy — this was the single most consistently repeated recommendation across sources.

## Auth: Better Auth over Clerk and over Auth.js (HIGH confidence, verified via npm dist-tags + official announcements)

**Recommendation: Better Auth 1.6.x, self-hosted, backed by your existing Prisma/Postgres.**

- **Auth.js (next-auth) is not a reasonable greenfield choice as of Aug 2026.** Confirmed via `npm view next-auth dist-tags`: the `latest` tag is still on the v4 line (4.24.15); v5 (Auth.js) has sat on the `beta` npm tag (5.0.0-beta.32) for a long time. As of early 2026 the Auth.js project entered maintenance mode (security/urgent fixes only, no new features), and in September 2025 maintenance passed to the Better Auth team — who, in July 2026, were acquired outright by Vercel. Auth.js's own maintainers now direct new projects to Better Auth. Starting a new multi-tenant SaaS on Auth.js in Aug 2026 means building on a library its own team says to migrate away from.
- **Clerk is a legitimate, faster-to-ship alternative but a poor fit for this specific project's economics.** Clerk's per-MAU pricing model is built around every end-user having a Clerk-managed account. This project's actual customer-facing checkout flow is intentionally accountless (WhatsApp order link, manual payment claim, Cash on Delivery — no live PSP, no customer login requirement in V1). The population that *does* need real authenticated accounts is small: merchants (one owner login per store) and the single platform Super Admin. Paying a per-MAU SaaS auth vendor for a user population that's mostly anonymous storefront shoppers is the wrong shape of bill for this product, and self-hosting avoids a second vendor dependency/cost line that scales with store count rather than with revenue.
- **Better Auth fits directly:** it is TypeScript-native, self-hosted (data stays in your existing Postgres via the first-class Prisma adapter — no separate auth database/service to manage), and ships an **`organization` plugin** that is a near-exact primitive match for "tenant" in this domain — organizations, members, roles, invitations, all pre-built rather than hand-rolled. Map `Organization` → `Store`/tenant. For the platform Super Admin (a single owner login, not itself tenant-scoped), the simplest correct approach for V1 is a `platformRole` enum field on the `User` model checked in middleware/server actions — Better Auth also ships a separate `admin` plugin (user banning, impersonation, more elaborate platform-role management) that is worth adopting later if staff accounts beyond the single owner are ever added, but is unnecessary complexity for V1's single-owner Super Admin.
- Peer-dependency check confirms compatibility: `better-auth@1.6.29` declares `prisma: "^5.0.0 || ^6.0.0 || ^7.0.0"` and `next: "^14.0.0 || ^15.0.0 || ^16.0.0"` — safe against the versions recommended above.

## Image Upload/Processing Pipeline (HIGH confidence on mechanics, MEDIUM on "keep it synchronous" recommendation)

Recommended flow for merchant product photo upload:

1. Client requests a **presigned PUT URL** from a Next.js server action (Node.js runtime), scoped to the tenant's R2 prefix (e.g. `tenants/{tenantId}/products/{productId}/...`) via `@aws-sdk/s3-request-presigner`.
2. Browser uploads the original image **directly to R2**, bypassing your Vercel function entirely — this sidesteps the ~4.5MB request-body limit on Vercel serverless functions and keeps large uploads off your compute/billing.
3. On upload completion (client calls back, or you use an R2 event notification if you want it decoupled), a Node.js-runtime route handler **fetches the original from R2, runs it through Sharp synchronously** to produce your fixed set of derived sizes (e.g. thumbnail/card/detail — pick 3, don't over-engineer a dynamic-size system for V1), and writes each derived asset back to R2 with a predictable key.
4. **Recommendation: do this synchronously in the request, not via a queue.** Sharp operations on typical merchant product photos (a few MB, a handful of output sizes) complete in low hundreds of milliseconds — well inside a Vercel function's execution window. Introducing a queue here (see below) adds operational surface (retry logic, a "processing" UI state, webhook plumbing) for a problem that a synchronous call already solves cleanly at this scale. Revisit only if/when bulk CSV product import needs to process hundreds of images at once — that's a legitimate future queue use case, not a V1 one.
5. `next/image`'s built-in on-request optimizer is **not a substitute** for this pipeline — it's a display-time transform cache, not an ingest-time normalization/enhancement step, and won't give you consistent stored derived assets across CDN cache evictions.

## Redis Usage Patterns (MEDIUM confidence — pattern-level, verified against multiple current Upstash-authored and third-party sources)

Wire Upstash Redis in from day one; it is cheap (HTTP-based, no idle cost concerns at pilot scale) and unlocks several of the project's own required behaviors:

| Use case | Pattern |
|----------|---------|
| **Tenant hostname resolution** | Cache `subdomain → tenantId` lookups (`tenant:host:{subdomain}`) with a short TTL (~5 min), read in Edge Middleware before every request is routed. Invalidate on tenant rename/suspend. Avoids a DB round-trip on every single storefront request — matters directly for the 2M-store scale target. |
| **Guest cart** | `cart:{sessionId}` as a JSON blob or hash, TTL ~30 days, keyed off a signed session cookie set on first cart add. Lets an anonymous shopper's cart survive a page refresh/return visit without requiring an account (consistent with the accountless checkout design). |
| **Rate limiting** | `@upstash/ratelimit` sliding-window limiter in Edge Middleware on: login attempts, payment-claim submissions (prevent spam/abuse of the "I've paid" flow), and checkout submission — cheap abuse protection with no separate infra. |
| **Idempotency keys** | Order placement should be idempotent against double-submit (slow network, impatient tap). Store `idempotency:{clientGeneratedKey}` → order ID with a short TTL (~10 min); on retry, return the cached order instead of creating a duplicate. |
| **Trial/entitlement cache (optional)** | Cache resolved subscription-tier entitlements per tenant to avoid a DB hit on every dashboard action gated by plan limits; invalidate on plan change. |

Don't use Redis as your source of truth for anything that must be durable/auditable — orders, payment claims, and subscription state belong in Postgres; Redis here is caching/ephemeral-session infrastructure only.

## Job/Queue Pattern for a Solo Vercel-Hosted App (MEDIUM confidence — Vercel Queues/Workflow are new products, public beta / recent GA as of 2026)

Layered approach, escalating only as far as actually needed:

1. **First choice: `waitUntil()`** (available via `next/server` / `@vercel/functions` on Vercel). For fire-and-forget work that should happen *after* the response is returned but doesn't need guaranteed delivery/retries — e.g., sending a "new order" notification, a non-critical logging call. Zero additional infrastructure, zero new vendor, works today. This should cover most of V1's "async" needs (order confirmation notification, merchant new-order alert).
2. **Second choice: Vercel Queues + Vercel Workflow** for anything that genuinely needs guaranteed delivery/retries (e.g., a payment-claim notification must not silently vanish if a transient failure occurs) or multi-step durable orchestration. Vercel Queues (public beta, Feb 2026) is Vercel's own durable event-streaming primitive with at-least-once delivery and automatic retries, built on Fluid Compute; Vercel Workflow (GA) sits on top of it for multi-step "use workflow" functions with automatic checkpoint/resume. **This is the right default for this project specifically because it requires zero new vendor account, zero new infra to provision, and zero new billing relationship** — it's already part of the Vercel platform you're deploying to, which matters for a 30-day solo build's setup-time budget. Caveat: it's a comparatively new product (beta/recent GA) — keep the integration thin (a handful of well-isolated call sites) so that if you hit a beta rough edge, swapping to QStash is a contained change, not a rewrite.
3. **Fallback if Vercel Queues has friction: Upstash QStash** (`@upstash/qstash`, current 2.11.3). HTTP-based message queue, framework/platform-agnostic, mature and stable, same vendor family as your Redis so one more Upstash account rather than a wholly new tool. Slightly more setup (you publish to QStash, which POSTs back to a route handler you write) but is the most-cited "default serverless queue for Vercel apps under ~1M jobs/day" pattern across current sources and has been production-proven longer than Vercel Queues.
4. **Do not reach for BullMQ + self-hosted Redis worker, Inngest, or any solution requiring a persistent Node worker process.** A persistent worker means a second deployment target (Railway/Fly/etc.), a second thing to monitor, and a second failure mode — direct opposition to "solo Vercel-hosted app... without standing up heavy message-queue infrastructure." Inngest is a fine product but is redundant with what Vercel Queues/Workflow now natively provides on the exact platform this project is already deployed to.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Neon | Supabase | If you want bundled Auth/Storage/Realtime and are willing to trade away Neon's superior branching/Vercel integration — not the case here since auth (Better Auth) and storage (R2) are already decided independently. |
| Better Auth | Clerk | If speed-to-first-login matters more than per-MAU cost and you're comfortable with most of your "users" (anonymous shoppers) never touching Clerk at all, or if you want polished pre-built UI components (`<OrganizationSwitcher />` etc.) and are willing to pay for that DX. |
| Better Auth | Auth.js v5 | Only if migrating an *existing* Auth.js codebase — not a reasonable greenfield choice given its maintenance-mode status. |
| Prisma Client Extension tenant scoping | Postgres Row-Level Security | Once past pilot/V1, as a hardening pass — genuinely stronger guarantee, but adds `SET LOCAL` session-variable plumbing complexity not worth the 30-day timeline risk now. |
| Vercel Queues/Workflow | Upstash QStash | If Vercel Queues' beta status causes friction, or if you want a platform-agnostic queue that survives a future move off Vercel. |
| Vercel Queues/Workflow | Inngest | If you want a more mature step-function-style DX with a dashboard/observability UI today rather than Vercel's newer native tooling — reasonable choice, just redundant with Vercel Queues for this project's platform. |
| `@aws-sdk/client-s3` for R2 | `aws4fetch` | If you want a much smaller (no AWS SDK bulk) signing-only client for Edge-runtime R2 access — not needed here since the Sharp pipeline already forces the Node.js runtime for upload/processing routes. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Auth.js / NextAuth v5 for a new project | Maintainer's own project is in maintenance mode as of early 2026; new-project guidance from the maintaining team points to Better Auth | Better Auth |
| Clerk, given this project's accountless-checkout design | Per-MAU billing model doesn't map to a mostly-anonymous shopper population; adds a second paid vendor dependency that scales with tenant/customer count rather than revenue | Better Auth (self-hosted, flat infra cost) |
| BullMQ + a dedicated worker process | Requires a persistent, separately-hosted Node process — directly contradicts the "solo Vercel-hosted, no heavy queue infra" constraint | `waitUntil()` for fire-and-forget; Vercel Queues/Workflow or QStash for anything needing retries |
| Schema-per-tenant or database-per-tenant Postgres | Cannot operationally scale to the project's own stated 2,000,000-store target — migrations, connection limits, and provisioning all become unmanageable well before that scale | Shared schema, indexed `tenantId` on every table, enforced via Prisma Client Extension |
| Running Sharp on the Edge Runtime | Sharp requires native libvips bindings; Edge Runtime cannot load native binaries — this will hard-fail at runtime, not degrade gracefully | Force Node.js runtime on any route/action that imports `sharp` |
| Prisma 7 with a bare `datasource.url` (Prisma 5/6-style config) | Prisma 7 requires an explicit driver adapter; the old implicit-engine config pattern silently doesn't apply and is a common source of "why won't this connect" confusion when copying older tutorials/training-data snippets | `@prisma/adapter-pg` (or `@prisma/adapter-neon`) configured via `prisma.config.ts` |
| A general-purpose multi-currency library for V1 | Over-engineering — V1 is XAF-only, single locale (Cameroon) | `Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF' })` directly |

## Stack Patterns by Variant

**If a route/action touches Sharp or the R2 SDK for processing (not just presigned-URL issuance):**
- Explicitly ensure Node.js runtime (the Next.js default — just don't add `export const runtime = 'edge'`).
- Because Sharp's native bindings and, less critically, some AWS SDK v3 internals are not Edge-compatible.

**If you later add custom domains (explicitly a fast-follow, not launch-blocking per PROJECT.md):**
- Keep the Redis-cached `hostname → tenantId` resolution pattern — it already generalizes from subdomain-only to custom-domain lookups without an architecture change, just an additional lookup key format.

**If you outgrow the Prisma Client Extension tenant-scoping pattern (post-pilot hardening):**
- Layer Postgres RLS underneath it rather than replacing it — keep the extension as the primary developer-ergonomics guard, add RLS as the belt-and-suspenders layer that also protects against application bugs and any future direct-DB-access tooling.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `next@16.3.1` | `react@19.2.x`, `typescript@7.0.x` | Confirmed via package peer-dependency ranges and current release notes; TS 7 has first-class Next.js/React support even while some other framework ecosystems lag until 7.1. |
| `prisma@7.9.1` / `@prisma/client@7.9.1` | `@prisma/adapter-pg@7.9.1` (match exact major.minor across all `@prisma/*` packages) | Prisma 7's Rust-free architecture ties the client and adapter versions together more tightly than Prisma 5/6 did — don't mix majors across `@prisma/*` packages. |
| `better-auth@1.6.29` | `prisma: "^5.0.0 || ^6.0.0 || ^7.0.0"`, `next: "^14.0.0 || ^15.0.0 || ^16.0.0"` | Confirmed directly from published `peerDependencies` — safe against the exact versions recommended above. |
| `@upstash/ratelimit@2.0.8` | `@upstash/redis@1.38.2` | Same vendor, designed together; both work identically in Edge Middleware and Node.js runtime. |
| `sharp@0.35.3` | Node.js runtime only, any current LTS Node | Do not attempt Edge Runtime — see "What NOT to Use." |

## Sources

- npm registry (`npm view` on each package, Aug 16 2026) — HIGH confidence, ground-truth current versions for: next, prisma, @prisma/client, sharp, better-auth, @upstash/redis, @upstash/ratelimit, @aws-sdk/client-s3, zod, react, typescript, ioredis, resend, @vercel/blob, @prisma/adapter-neon, @prisma/adapter-pg, @neondatabase/serverless, next-auth (+ dist-tags), inngest, @upstash/qstash, @upstash/workflow, react-hook-form, zustand, @aws-sdk/s3-request-presigner, nanoid, date-fns, @t3-oss/env-nextjs
- [Prisma ORM v7.0.0 changelog — Rust-free client becomes default](https://www.prisma.io/changelog/2025-11-19) — HIGH confidence, official source
- [Prisma 7 announcement blog](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0) — HIGH confidence, official source
- [Prisma docs — Upgrade to v7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) — HIGH confidence, official docs
- [Neon docs — Connect from Prisma to Neon](https://neon.com/docs/guides/prisma) — HIGH confidence, official docs
- [Next.js 16 blog post](https://nextjs.org/blog/next-16) — HIGH confidence, official source
- [Next.js docs — Upgrading to v16](https://nextjs.org/docs/app/guides/upgrading/version-16) — HIGH confidence, official docs
- [TypeScript 7.0 GA coverage — InfoQ](https://www.infoq.com/news/2026/08/typescript-7-released/) — MEDIUM confidence, reputable dev-press, cross-referenced with multiple similar reports
- [Auth.js v5 discussion — "Auth.js is now part of Better Auth"](https://github.com/nextauthjs/next-auth/discussions/13252) — HIGH confidence, official project discussion
- [Better Auth security update, July 2026](https://better-auth.com/blog/security-update-july-2026) — MEDIUM confidence, vendor-authored but directly relevant/verifiable claim (Vercel acquisition)
- [Vercel Queues changelog — public beta](https://vercel.com/changelog/vercel-queues-now-in-public-beta) — HIGH confidence, official source
- [Vercel Workflow docs](https://vercel.com/docs/workflows) — HIGH confidence, official docs
- [Vercel docs — Queues concepts](https://vercel.com/docs/queues/concepts) — HIGH confidence, official docs
- [Multi-Tenant SaaS Data Isolation with Prisma — DEV Community](https://dev.to/whoffagents/multi-tenant-saas-data-isolation-row-level-security-tenant-scoping-and-plan-enforcement-with-1gd4) — MEDIUM confidence, community source, pattern cross-referenced against 3+ similar independent write-ups
- [Achromatic — Multi-Tenant Architecture Patterns in Next.js](https://www.achromatic.dev/blog/multi-tenant-architecture-nextjs) — MEDIUM confidence, community source
- [Upstash blog — Rate Limiting Your Next.js App with Vercel Edge](https://upstash.com/blog/edge-rate-limiting) — MEDIUM confidence, vendor-authored but standard documented pattern
- [Sharp official site](https://sharp.pixelplumbing.com/) — HIGH confidence, official docs
- Indie Hackers / DEV Community Neon vs Supabase comparisons (multiple, cross-referenced) — MEDIUM confidence, community consensus

---
*Stack research for: Multi-tenant commerce storefront-builder SaaS*
*Researched: 2026-08-16*
