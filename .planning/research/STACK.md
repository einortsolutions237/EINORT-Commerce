# Stack Research

**Domain:** Multi-tenant commerce platform (v2.0 milestone) — public marketplace discovery, merchant CRM/inventory/delivery, custom domains + TLS, first-party analytics
**Researched:** 2026-09-13
**Confidence:** HIGH (Vercel domain API + limits, Prisma index/FTS capabilities, Next 16 primitives all verified against current official docs; MEDIUM only on the pg_trgm-at-pilot-scale performance judgement, which is a scale estimate rather than a documented fact)

---

## Executive answer to the three questions

1. **Custom domains + TLS:** Use **Vercel's own Domains REST API** (`/v10/projects/{id}/domains`, `/v9/.../verify`, `/v6/domains/{domain}/config`) against the *existing* production project. Vercel issues and renews the TLS certificate automatically once the domain resolves — there is no certificate work to do and no second DNS/cert provider (Cloudflare for SaaS, Let's Encrypt/ACME, Caddy) to introduce. Do **not** install `@vercel/sdk` (41.7 MB unpacked) for four endpoints; hand-write a ~120-line `fetch` client with Zod-parsed responses, matching how `src/server/images/r2.ts` wraps R2.

2. **Marketplace search:** Nothing new at the runtime layer. Add the **`pg_trgm` Postgres extension + GIN `gin_trgm_ops` indexes** on the handful of columns the marketplace searches, and keep using Prisma's existing `contains` / `mode: "insensitive"` filters — the exact pattern already shipped in `src/server/search/queries.ts`. This is a migration + `@@index` change with **zero runtime code change, zero new dependency, zero `$queryRaw`**, and it is the one thing that makes cross-tenant (unindexed-by-`tenantId`) discovery search viable. Meilisearch/Typesense/Algolia stay out of scope, and so does Prisma's `fullTextSearchPostgres` preview.

3. **Analytics:** Nothing new at all. Extend the pattern already in `src/server/dashboard/queries.ts` (`aggregate` / `groupBy` / `count` over `Order` + `OrderItem`) plus **one denormalised daily rollup table** written by a **Vercel Cron Job** and incremented on the write path via Next 16's built-in **`after()`**. No ClickHouse, no Tinybird, no `@vercel/analytics`, no charting library (the codebase already hand-rolls charts in `src/app/(dashboard)/dashboard/revenue-bars.tsx` and explicitly rejected Recharts).

**Net new npm dependencies for this entire milestone: one (`tldts`).** Everything else is schema, migrations, config, and code.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Vercel Domains REST API** (raw `fetch`) | `/v10` add, `/v9` verify+get+remove, `/v6` config | Programmatic custom-domain add / ownership verification / DNS-config polling / removal | Vercel is already the deployment target. Adding a domain to the *existing* project is the only way inbound TLS traffic on that hostname reaches this app at all; any external cert provider would still need Vercel to terminate TLS. Vercel auto-provisions and auto-renews the certificate once the domain is verified and resolving — cert lifecycle disappears as a work item. Rate limits are generous (100 domain creates/min, 100 verifies/min, 500 domain gets/min) and Pro allows a soft limit of 100,000 domains per project, which comfortably covers the 2M-store *architecture* target's realistic custom-domain subset. |
| **`node:dns/promises`** | Node 24 built-in | Pre-flight DNS checks before spending a Vercel API call; merchant-facing "we can't see your record yet" diagnostics | Zero dependency. Next 16's Proxy and all routes here run the Node.js runtime (Proxy defaults to Node in v16 and `runtime` config is *forbidden* in Proxy files), so UDP DNS is available. Use a `dns.Resolver` with `setServers(["1.1.1.1","8.8.8.8"])` so you read public DNS rather than a stale platform resolver cache. |
| **`tldts`** | 7.4.12 | Validate merchant-submitted domains: reject public suffixes (`co.cm`), classify apex vs subdomain (drives A-record vs CNAME instructions), reject the platform's own root domain | The only genuinely new dependency. Bundled Public Suffix List, actively maintained (published 2026-09-07). Hand-rolling "is this an apex domain" against `.cm`, `.co.cm`, `.com` is exactly the kind of thing that quietly ships broken. Server-only import, so its 2.9 MB unpacked size never reaches a client bundle. |
| **PostgreSQL `pg_trgm` extension + GIN indexes** | Bundled with Neon Postgres | Index-backed `ILIKE '%q%'` for cross-tenant marketplace product/store search | Turns the marketplace's unavoidable leading-wildcard search from a full-table sequential scan into a bitmap index scan (`gin_trgm_ops` accelerates `LIKE`, `ILIKE`, `~`, `~*`). Critically it requires **no query rewrite** — Prisma's existing `contains: q, mode: "insensitive"` compiles to `ILIKE '%q%'`, which the index serves — so the repository-wide `$queryRaw`/`$executeRaw` ban (`eslint.config.mjs`, `no-restricted-syntax`) is never approached. Supported on Neon. |
| **Prisma `aggregate` / `groupBy` / `count`** | `@prisma/client` 7.9.1 (installed) | Sales, order counts, top products, conversion numerators/denominators | Already the established analytics idiom here (`src/server/dashboard/queries.ts` uses `_sum`, `groupBy(["customerPhone"])`, `count`). It flows through `scopedDb()`, so every analytics read is tenant-filtered by construction — a warehouse or raw-SQL analytics path would be the single biggest tenant-isolation regression risk in this milestone. |
| **Next.js `after()`** (`next/server`) | Next 16.3.1 (installed) | Fire-and-forget write-path counters (storefront visit, cart created, listing impression) without adding latency to the response | Built in and stable in Next 16; works in Server Components, Server Functions, Route Handlers, and Proxy. Removes any reason to reach for `@vercel/functions`' `waitUntil` or a queue. |
| **Vercel Cron Jobs** (`vercel.json` `crons`) | Platform feature | Nightly analytics rollup, "trending" recompute, stale-domain re-verification sweep, low-stock digest | 100 cron jobs per project on every plan. **Plan-sensitive:** Hobby is capped at *once per day* with ±59 min precision; Pro allows per-minute. Design every cron to be idempotent and daily-safe so the app works on Hobby, and treat sub-daily frequency as a Pro-only optimisation — never as a correctness dependency. |
| **Resend** | 6.22.0 (already a dependency, still unwired) | Low-stock alerts, "your domain is live" notification, marketplace listing status changes | Already installed and already modelled as optional in `src/env.ts` (`RESEND_API_KEY`/`RESEND_FROM_EMAIL` both `.optional()`). This milestone is where it finally gets a `send` call. Keep the optional-and-degrade-loudly posture used for Upstash. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@upstash/redis` | 1.38.2 (installed) | Daily visit/cart counters before flush; custom-domain → tenant negative cache | Only as an *accelerator*. Analytics counters must tolerate Upstash being absent (the project's existing rule: degrade loudly, never silently). Never make a financial number depend on Redis. |
| `@upstash/ratelimit` | 2.0.8 (installed) | Rate-limit the public marketplace search endpoint and the domain add/verify actions | Marketplace search is the first unauthenticated, cross-tenant, DB-touching surface in the codebase. Add a named limiter in `src/server/rate-limit.ts` alongside the existing ones. Domain verify needs one too — Vercel's own limit is 100/min *for the whole team*, so one abusive merchant could starve every other merchant. |
| `zod` | 4.4.3 (installed) | Parse every Vercel API response before it touches domain logic | The Vercel API is an external, versioned surface. Parsing responses (not just requests) with Zod is what keeps a silent API shape change from becoming a wrong "verified" badge. |
| `nanoid` | 6.0.1 (installed) | Verification-token generation if you add a platform-side TXT challenge in addition to Vercel's | Optional. Vercel already supplies its own `vercel-challenge-*` TXT value; a second challenge is only needed if you want ownership proof independent of Vercel. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Prisma `postgresqlExtensions` preview | Declare `extensions = [pg_trgm]` on the datasource so the extension is version-controlled and applied to the shadow DB | Still a **preview feature** in Prisma 7. Add `previewFeatures = ["postgresqlExtensions"]` to the `generator client` block. Low-risk and additive; the fallback (below) needs no flag. |
| Hand-edited migration SQL | `CREATE EXTENSION IF NOT EXISTS pg_trgm;` prepended to a generated `migration.sql` | The zero-preview-flag alternative. The `$queryRaw` lint ban is scoped to `src/**`, so DDL in `prisma/migrations/**` is unaffected. Replays correctly into the Neon shadow branch and the `TEST_DATABASE_URL` branch because migrations run in order. |
| Vercel CLI `vercel crons` | List / trigger cron entries on demand during development | Avoids waiting a day to test a rollup job. |
| `dotenv-cli` 11.0.0 (installed) | Already used by `npm run test:full` | New env vars (`VERCEL_API_TOKEN`, `VERCEL_TEAM_ID`) must be added to `.env.example` and `src/env.ts` as **optional** so `test:unit`, `lint`, and `typecheck` (with `SKIP_ENV_VALIDATION`) keep passing without them. |

## Installation

```bash
# Core — the only new runtime dependency in this milestone
npm install tldts@7.4.12

# Nothing else. Deliberately NOT installed:
#   @vercel/sdk           (41.7 MB unpacked, for 4 endpoints)
#   recharts / visx / nivo (codebase hand-rolls charts on purpose)
#   meilisearch / typesense / algoliasearch / @elastic/elasticsearch
#   @vercel/analytics      (cannot serve per-merchant metrics)
#   libphonenumber-js      (src/server/payments/phone.ts already does CM MSISDN)
#   papaparse / json2csv   (server-side CSV is ~15 lines)
#   react-email            (would break the strings.ts prose-literal contract test)
```

**Postgres-side (migration, not npm):**

```sql
-- prisma/migrations/<ts>_marketplace_search/migration.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

**Prisma schema-side (index declared normally, so `prisma migrate` owns it):**

```prisma
model Product {
  // ...
  @@index([name(ops: raw("gin_trgm_ops"))], type: Gin)
}
```

> Verified constraint: Prisma **does** support column operator classes via `raw("...")` with `type: Gin`, but **does not** support *expression* indexes (`to_tsvector(...)`) — those are invisible to `prisma db pull` and cannot be declared in the schema at all. This is the single technical fact that decides trigram-over-tsvector for this codebase.

**New environment variables** (add to `src/env.ts` server block, `.env.example`, and Vercel project settings):

| Var | Required? | Notes |
|-----|-----------|-------|
| `VERCEL_API_TOKEN` | Optional (feature-gates Domains) | Personal or team access token. **Not** a system env var — must be created manually and stored as a Vercel secret. |
| `VERCEL_TEAM_ID` | Optional | Required if the project lives under a team. **Not** a system env var. |
| `VERCEL_PROJECT_ID` | Auto-provided | Vercel exposes this as a **system environment variable at both build and runtime** (requires "Enable access to System Environment Variables" checked). Still declare it optional in `src/env.ts` so local dev works. |

Follow the Upstash precedent: if `VERCEL_API_TOKEN` is absent, the Domains feature reports "not configured" loudly rather than silently pretending to verify.

---

## The three questions, answered in detail

### 1. Custom domains: Vercel Domains API, not a separate DNS/cert provider

**Verified flow (HIGH confidence, from Vercel's multi-tenant platform docs + OpenAPI spec):**

| Step | Endpoint | What it gives you |
|------|----------|-------------------|
| Add | `POST /v10/projects/{idOrName}/domains` body `{ name }` | Returns `verified: false` plus a `verification[]` array of challenges (`{ type: "TXT", domain, value: "vercel-challenge-...", reason }`) when the hostname is already claimed on another Vercel account. Vercel begins attempting cert issuance immediately. |
| Instruct | `GET /v6/domains/{domain}/config?projectIdOrName=...` | `recommendedIPv4[]` (ranked; rank=1 is preferred) and `recommendedCNAME[]` — **read the record values from here, never hardcode them.** Each project now gets a *unique* CNAME target (e.g. `d1d4fc829fe7bc7c.vercel-dns-017.com`) and the legacy `76.76.21.21` apex IP is no longer universal. Also returns `configuredBy` (`A` / `CNAME` / `http` / `dns-01` / `null`) and `acceptedChallenges[]`. |
| Verify ownership | `POST /v9/projects/{idOrName}/domains/{domain}/verify` | Called after the merchant adds the TXT record. Docs advise waiting 5–10 min after the record is published. |
| Poll readiness | `GET /v9/projects/{idOrName}/domains/{domain}` + `GET /v6/domains/{domain}/config` | `misconfigured: false` on the config endpoint is documented as *"the domain is configured AND we can automatically generate a TLS certificate"* — **this is the single boolean your `DomainStatus` state machine should key off**, not `verified` alone. |
| Remove | `DELETE /v9/projects/{idOrName}/domains/{domain}` | Detach on merchant removal / store suspension. Confirm exact version against `openapi.vercel.sh` at implementation time. |

**TLS is not your problem.** Vercel issues and renews the certificate automatically after verification. There is no ACME client, no cert storage, no renewal cron, no `greenlock`/`Caddy`/`acme.sh`, and no `CERTIFICATE` table. The only TLS-adjacent merchant instruction is a possible `CAA` record note if their DNS already has restrictive CAA records.

**Polling: do it on demand, not on a cron.** Hobby caps cron at once/day, which is useless for a merchant staring at a "verifying…" spinner. Poll from the settings page while it is open (a Server Action behind a rate limiter, every ~20 s, with a hard attempt cap), plus one daily cron sweep for domains stuck in `PENDING`. This works identically on Hobby and Pro and is better UX than a cron regardless of plan.

**Hard limits you must design around (verified from `/docs/limits`, last updated 2026-09-03):**

| Limit | Hobby | Pro |
|-------|-------|-----|
| Domains per project | **50** | Unlimited (soft cap 100,000) |
| Project domain create/update/remove | 100 / min (owner scope) | same |
| Project domain verification | 100 / min (user scope) | same |
| Project domain get | 500 / min (user scope) | same |
| Cron jobs per project | 100, **once per day max** | 100, once per minute |

The 50-domain Hobby cap is a real product ceiling — custom domains as a paid tier feature effectively presumes a Pro plan.

**Wildcard domains require Vercel nameservers** (`ns1/ns2.vercel-dns.com`). That is a full DNS-hosting takeover of the merchant's domain and will break their email if they don't migrate MX records. **Do not offer wildcard custom domains to merchants.** Offer exactly two shapes: apex (`acme.cm`, A record) and single subdomain (`shop.acme.cm`, CNAME).

**Integration point that needs a roadmap decision — `src/proxy.ts` is documented as zero-I/O.** A custom domain arrives as an arbitrary `Host` header that the pure `classifyHost()` function cannot map to a slug. Two options:

- **(a) Recommended — keep the proxy I/O-free.** Let `classifyHost()` return a new `custom` class and have the proxy rewrite to the *existing* storefront tree using the hostname as the segment value: `shop.acme.cm/x` → `/s/shop.acme.cm/x`. Add a `resolveTenantByHost()` sibling to the existing Redis-cached `resolveTenantBySlug()`, disambiguated by "contains a dot" (the reserved-slug list already guarantees slugs never do). Reuses the whole `/s/[slug]/**` subtree, the existing tenant gate in its layout, and the existing Redis positive/negative cache. Zero new infrastructure and zero violation of the documented proxy constraint.
- **(b) Rejected — a Redis GET inside the proxy.** Technically viable (Next 16 Proxy defaults to Node runtime, and `@upstash/redis` is HTTP-based), but it breaks the "Proxy has no I/O, never imports Redis or `@/env`" constraint in `ARCHITECTURE.md` and puts a network hop on *every* request including root-domain ones.

### 2. Marketplace discovery search: pg_trgm, and that is the whole answer

The marketplace is the first surface in this codebase that reads **across** tenants. That inverts the search performance situation:

- The existing `searchMerchantSurface()` runs `ILIKE '%q%'` and accepts a sequential scan because `scopedDb` first narrows to one tenant's rows — a tiny set. Its own header comment says so explicitly and calls a trigram index "scope creep."
- Marketplace search has **no tenant predicate**. It scans every published product across every store. At 2,000 stores × 300 products that is 600,000 rows per keystroke on a typeahead. This is the point at which the earlier decision correctly stops holding.

**Recommendation:** `pg_trgm` + GIN `gin_trgm_ops` indexes on the marketplace-searchable columns of the published-listing surface (product name, and store/brand name). Keep the Prisma query shape exactly as it is today.

Known caveats, stated honestly:
- **Trigram indexes need ≥3 characters.** A 1–2 character query cannot use the index and falls back to a sequential scan. Enforce a `minLength: 3` in the Zod schema for the marketplace search input — this is a correctness-of-performance guard, not a UX limitation (2-char product searches are noise anyway).
- **GIN indexes are write-amplifying.** Fine here: product writes are rare relative to marketplace reads. Do not put trigram indexes on `Order` columns.
- **French/accents.** XAF/Cameroon catalogues will contain `é`, `à`, `ô`. `gin_trgm_ops` is accent-sensitive. If accent-insensitive matching matters, the fix is a stored, application-normalised `searchName` column (accent-stripped at write time in TypeScript via `String.prototype.normalize("NFD").replace(/\p{Diacritic}/gu, "")`) with the trigram index on *that* — **not** the `unaccent` extension, because `unaccent()` in a `WHERE` clause is an expression index, which Prisma cannot declare.

**Why not Prisma's `fullTextSearchPostgres` preview** (verified available in Prisma 7 via `previewFeatures = ["fullTextSearchPostgres"]` and the `search:` operator): it generates `to_tsvector(...) @@ to_tsquery(...)`, which requires an **expression index** — the one index shape Prisma explicitly cannot declare and cannot introspect. You would be hand-writing migration SQL for an index Prisma is unaware of, *and* opting into a preview feature, *and* accepting `to_tsquery`'s strict input syntax (a bare user query with a space or apostrophe throws a Postgres syntax error unless you sanitise it), in exchange for stemming that a 300-product-per-store catalogue does not need. Trigram wins on every axis here.

**Ranking (featured / trending) needs no search engine either.** Materialise sort keys as columns on the listing row — `featuredRank`, `trendingScore`, `publishedAt` — and recompute `trendingScore` in the nightly cron from `OrderItem` counts over a rolling window. Sorting and filtering are then plain B-tree index work through `scopedDb`-free, allowlisted cross-tenant reads.

**Cross-tenant read access needs a fourth DB facade, not a lint-rule exception.** `eslint.config.mjs` restricts `**/server/db/admin` to `src/server/admin/**`, and `scopedDb` is single-tenant by construction. Introduce `marketplaceDb` — a narrow, **read-only** getter allowlist over exactly the published-listing models (mirroring how `platformDb` is built), with its own ESLint import zone (`src/server/marketplace/**`) and a contract test asserting it exposes no mutating methods. This is the correct place for the milestone's biggest isolation risk, and it is a code pattern the codebase already has twice.

**Caching marketplace pages:** use the *previous* caching model — `export const revalidate = N` plus `revalidateTag`/`revalidatePath` on listing publish. Verified: Next 16 removes `dynamic`/`revalidate`/`fetchCache` **only when `cacheComponents` is enabled**; with `cacheComponents` off (the current state) they still work, documented under "Caching and Revalidating (Previous Model)". **Do not flip `cacheComponents: true` during this milestone** — it is an app-wide behavioural change that would land on top of seven new subsystems at once.

### 3. Analytics: Postgres rollups, no warehouse, no chart library

**Layer 1 — live aggregates (most of the requirement).** Revenue, order counts, AOV, and top products all come from `Order` / `OrderItem` via `aggregate` / `groupBy` / `count` through `scopedDb`, exactly as `src/server/dashboard/queries.ts` already does. Two known Prisma gotchas the existing code already documents and new code must respect:
- `_sum` returns `null`, not `0`, on an empty window — always `?? 0`.
- Prisma `groupBy` cannot truncate a `DateTime` to a calendar day. `src/server/dashboard/buckets.ts` solves this by bucketing a bounded, already-tenant-scoped window in Node rather than SQL, precisely to stay off `$queryRaw`. **Reuse `buckets.ts`; do not reinvent this per-surface.**

**Layer 2 — one daily rollup table.** Node-side bucketing scales to a 7-day window over a pilot tenant's orders; it does not scale to "revenue by month for the last year." Add a single `StoreDailyStat` model (`tenantId`, `day @db.Date`, `revenueXaf`, `orderCount`, `unitsSold`, `visitCount`, `cartCount`, `@@unique([tenantId, day])`) written by a daily cron. This is a tenant-scoped model, so it registers in `TENANT_SCOPED_MODELS` and is read through `scopedDb` like everything else. Long-range charts then read N rows instead of N orders.

**Layer 3 — conversion, without building a tracking pipeline.** Conversion needs a denominator this system does not currently record. Two options, in order of preference:

- **Cart → order conversion (recommended for this milestone).** The denominator is "carts created", and carts already exist as Redis blobs keyed by an opaque cookie id (`src/server/cart/cache.ts`). Increment a per-tenant per-day counter at cart creation, flush it into `StoreDailyStat.cartCount` in the nightly cron. This is a genuinely meaningful merchant metric ("of people who added something, how many bought"), needs no page instrumentation, and is honest about what it measures.
- **Visit → order conversion (defer or add cheaply).** Requires counting storefront sessions. Increment `StoreDailyStat.visitCount` from the storefront layout inside `after()` so it never blocks the render. At pilot volume a direct Postgres `upsert` + `increment` is fine; a Redis counter is an optimisation, not a requirement. Because Upstash is explicitly optional in this project, **the Postgres path must be the primary one** — otherwise conversion silently becomes wrong whenever Redis is unconfigured.

Label conversion in the UI with the denominator it actually uses. A number whose meaning is ambiguous is worse than no number.

**No chart library.** `src/app/(dashboard)/dashboard/revenue-bars.tsx` is a dependency-free Server Component whose header comment states it was hand-rolled *instead of* Recharts. Recharts 3.10.1 does support React 19, so this is a choice rather than a constraint — but adding a client-side charting runtime to render bar and line charts over ≤365 pre-aggregated points would contradict a decision this codebase already made and documented, and would force `"use client"` onto surfaces that are currently server-rendered. Extend `revenue-bars.tsx` into a small set of SVG primitives (bars, sparkline, donut) instead.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hand-written `fetch` client for 4 Vercel endpoints | `@vercel/sdk` 1.28.30 | If you end up calling >10 distinct Vercel endpoints (deployments, env vars, projects, edge config). At 41.7 MB unpacked for four calls, the trade flips only with much broader API use. Its `zod ^3 \|\| ^4` peer range is compatible with the installed `zod@4.4.3` if you do adopt it. |
| Vercel Domains API | **Cloudflare for SaaS** (custom hostnames + SSL for SaaS) | If you later move the storefront edge off Vercel, or need >100k custom hostnames, or need per-tenant WAF/caching rules. It is a genuinely good product — but it means Cloudflare terminates TLS and proxies to Vercel, which adds a hop, a second vendor in the request path, and a second place tenant routing can be wrong. Not worth it while Vercel is the origin. |
| Vercel Domains API | Registrar-hosted DNS + ACME/Let's Encrypt yourself | Only if self-hosting. On Vercel you cannot install your own cert for an unregistered domain anyway. |
| `pg_trgm` + `ILIKE` | Postgres tsvector FTS (hand-written expression index + `fullTextSearchPostgres` preview) | When catalogues get large enough that stemming and relevance ranking matter more than substring matching, *and* you are willing to own an index Prisma cannot see. Realistically a post-100k-product decision. |
| `pg_trgm` + `ILIKE` | Meilisearch / Typesense / Algolia | Explicitly out of scope per `PROJECT.md` ("dedicated search infrastructure — deferred"). Revisit only when p95 marketplace search exceeds ~300 ms with the trigram index in place and `EXPLAIN` confirms the index is being used. |
| Postgres rollup table | Tinybird / ClickHouse / DuckDB / Metabase | When merchants want ad-hoc slicing over >10M events. Not a pilot-scale problem, and every one of these adds a second data store that must be kept tenant-safe — duplicating the hardest invariant in the system. |
| `after()` from `next/server` | `waitUntil` from `@vercel/functions`; Vercel Queues; Vercel Workflows | `after()` is built in, framework-portable, and sufficient for counter increments. Queues/Workflows are billed per operation and are the right answer for durable multi-step jobs — which none of these seven features need. |
| Daily cron rollups | `pg_cron` extension on Neon | `pg_cron` keeps the schedule next to the data, but the job body would be raw SQL — reintroducing exactly the untenanted-SQL surface `eslint.config.mjs` bans. Vercel Cron hitting a Route Handler keeps rollups in TypeScript, behind the same DB facades, and unit-testable. |
| `tldts` | `psl` 1.15.0 | `psl` is smaller (712 KB) but was last published 2024-12; `tldts` shipped 2026-09-07 and returns richer parse output (`isIcann`, `subdomain`, `domainWithoutSuffix`). Prefer `tldts`. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@vercel/sdk` | 41.7 MB unpacked for four endpoints on a serverless target; wraps an API surface you'd Zod-parse anyway | ~120-line `fetch` client + Zod response schemas, in `src/server/domains/vercel-api.ts` |
| Hardcoding `76.76.21.21` or `cname.vercel-dns.com` | Vercel now issues **per-project** CNAME targets (`<hash>.vercel-dns-0NN.com`) and multiple ranked IPv4s; a hardcoded value is a silently-broken merchant onboarding | Read `recommendedIPv4[]` / `recommendedCNAME[]` from `GET /v6/domains/{domain}/config` and render them |
| Offering wildcard custom domains (`*.acme.cm`) | Requires the merchant to switch to Vercel nameservers, which takes over their entire DNS zone and breaks their MX/email unless every record is migrated | Apex + single subdomain only |
| Cron-based domain verification polling | Hobby caps cron at once/day with ±59 min precision — a merchant would wait up to 48 h for a "verified" badge | On-demand polling from the open settings page (rate-limited Server Action) + one daily sweep for stuck domains |
| `$queryRaw` / `$executeRaw` for analytics `date_trunc` or search | Verified empirically in this codebase as **not** intercepted by the tenant-scoping Prisma extension; banned repo-wide by `no-restricted-syntax` | Node-side bucketing (`src/server/dashboard/buckets.ts`) + a `@db.Date` rollup column |
| Prisma `fullTextSearchPostgres` preview | Generates `to_tsvector(...)`, which needs an expression index Prisma cannot declare or introspect; `to_tsquery` throws on unsanitised user input | `pg_trgm` GIN index + existing `contains` filters |
| `unaccent()` in query predicates | Same expression-index problem | Application-normalised `searchName` column with a trigram index on it |
| `@vercel/analytics` / Speed Insights for merchant metrics | Aggregate platform telemetry with no per-tenant query API — you cannot render a merchant's own numbers from it | First-party `StoreDailyStat` rollups. (Keeping Web Analytics for *your own* platform-owner traffic view is fine and orthogonal.) |
| Recharts / visx / nivo / Chart.js | Contradicts the documented decision in `revenue-bars.tsx`; forces `"use client"` onto currently server-rendered dashboards for ≤365 pre-aggregated points | Extend the existing hand-rolled SVG bar component |
| `react-email` / `@react-email/components` | Templates are `.tsx` containing prose, which trips the contract test that scans `.tsx` for prose-shaped string literals outside `src/lib/strings.ts` | Plain template functions reading from `strings.ts` |
| `libphonenumber-js` | `src/server/payments/phone.ts` already implements CM MSISDN normalisation (`CM_MOBILE_PATTERN`, `normalizeCameroonMsisdn`, `formatMsisdnForDisplay`) and Orders already store digits-only MSISDN | Reuse `normalizeCameroonMsisdn()` as the Customer identity key |
| `papaparse` / `json2csv` for exports | Server-side CSV *generation* (as opposed to parsing) is a `join`/escape function | Hand-rolled writer with explicit RFC 4180 quoting |
| A new `Customer` auth surface (Better Auth extension) | Storefront checkout is deliberately guest-only; marketplace shoppers do not have accounts in this milestone | `Customer` as merchant-owned CRM data keyed on `(tenantId, normalizedPhone)`, backfilled from existing `Order` rows |
| `adminDb` for marketplace cross-tenant reads | ESLint restricts it to `src/server/admin/**`, and it is read-**write** unscoped — the wrong trust level for a public, unauthenticated surface | A new read-only `marketplaceDb` allowlist facade with its own ESLint zone |
| Flipping `cacheComponents: true` for marketplace caching | Next 16 removes `dynamic`/`revalidate`/`fetchCache` when it is on — an app-wide behavioural change landing on top of seven new subsystems | `export const revalidate = N` + `revalidateTag` on publish (the documented "previous model", still supported) |
| TimescaleDB / partitioning for `StoreDailyStat` | One row per tenant per day is ~730k rows/year at 2,000 stores — a rounding error for Postgres | A plain table with `@@unique([tenantId, day])` |

## Stack Patterns by Variant

**If the Vercel plan is Hobby:**
- Custom domains are capped at **50 per project** — treat the feature as Pro-tier-gated on the *platform's* Vercel account, and say so in the roadmap's cost assumptions.
- Every cron must be daily-safe (idempotent, full-window recompute, not incremental-since-last-run).
- Domain verification must be on-demand-poll driven; a cron sweep is a backstop only.

**If/when the Vercel plan is Pro:**
- Domains soft cap rises to 100,000 — no product ceiling in practice.
- Per-minute crons unlock; you may add a 15-minute stuck-domain sweep and hourly trending recompute. Both are optimisations layered on the daily jobs, never replacements.

**If Upstash Redis is unconfigured (dev, or a production outage):**
- Analytics counters must still write straight to Postgres and remain correct. Redis is an accelerator here, never the source of truth. This mirrors the existing "degrade loudly, never silently, no in-process fallback counter" rule.

**If a merchant's DNS is behind Cloudflare's orange-cloud proxy:**
- `GET /v6/domains/{domain}/config` returns `configuredBy: "http"` ("resolving to Vercel but may be behind a Proxy") rather than `A`/`CNAME`. Treat `http` as a valid configured state and surface a "proxied DNS detected — set SSL/TLS mode to Full (strict)" hint, or merchants will hit redirect loops. Key the state machine on `misconfigured === false`, not on `configuredBy === "A"`.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `tldts@7.4.12` | Node 24, TypeScript 5.9.3 | Ships its own types. Import server-side only (`src/server/domains/**`) so the PSL data never enters a client bundle. |
| `pg_trgm` (Neon) | Prisma 7.9.1 `@@index(..., type: Gin, ops: raw("gin_trgm_ops"))` | Column operator classes via `raw()` are supported. **Expression** indexes are not — this is the constraint that rules out tsvector/`unaccent`. |
| Prisma `postgresqlExtensions` | Prisma 7.9.1 | Still **preview**. If added, it joins `previewFeatures` on the `generator client` block. The extension must also exist on the `TEST_DATABASE_URL` Neon branch — it will, because migrations replay in order there. |
| `after()` from `next/server` | Next 16.3.1 | Stable. Works in Server Components, Server Functions, Route Handlers, and Proxy. |
| `export const revalidate` | Next 16.3.1 with `cacheComponents` **off** | Removed only when Cache Components is enabled. Current config leaves it off, so it works. |
| Next 16 Proxy (`src/proxy.ts`) | Node.js runtime by default | The `runtime` segment config is **forbidden** in Proxy files and throws if set. Node I/O is therefore *possible* in the proxy — the zero-I/O rule here is an architecture decision, not a platform constraint. |
| `@vercel/sdk@1.28.30` (if ever adopted) | `zod@4.4.3` | Peer range `zod ^3.25.0 \|\| ^4.0.0`. |
| `recharts@3.10.1` (if ever adopted) | `react@19.2.8` | Peer range includes `^19.0.0`. Compatibility is not the reason to skip it. |
| `resend@6.22.0` | Already installed, unused | Must stay optional in `src/env.ts` (`RESEND_API_KEY`, `RESEND_FROM_EMAIL` are `.optional()`) so lint/typecheck/CI paths with `SKIP_ENV_VALIDATION` keep passing. |

---

## Integration Notes Against the Existing Stack

| New subsystem | New dependency | Existing machinery it plugs into | Watch out for |
|---------------|----------------|----------------------------------|---------------|
| **Marketplace** | none | New read-only `marketplaceDb` facade (mirrors `platformDb`); new ESLint import zone; `pg_trgm` indexes; `revalidate` + `revalidateTag`; new rate limiter | First unauthenticated cross-tenant read surface in the codebase — it is the milestone's top isolation risk. Suspended/expired-trial stores must be filtered at the facade, matching `resolveTenantBySlug`'s fail-closed posture. |
| **Marketplace Marketing** | none | Existing entitlements registry (`src/server/entitlements/plans.ts`); existing manual payment-claim flow for the paid add-on | Listing lifecycle is a second state machine. Follow the `ORDER_TRANSITIONS` pattern (one const table + one `canTransition` predicate + one sanctioned writer module + a source-scanning contract test) rather than inventing a different shape. |
| **Customers** | none | `scopedDb`; `normalizeCameroonMsisdn()`; existing `Order.customerPhone` (already digits-only MSISDN) | Identity key is `(tenantId, normalizedPhone)`. Backfill from `Order`. Guest checkout stays guest — no Better Auth change. Same no-hard-delete rule (D-08) applies. |
| **Inventory** | none | `src/server/orders/stock.ts` conditional-decrement holds; Resend for low-stock digests | Adjustments must be an append-only ledger written in the **same transaction** as the stock mutation, or the ledger and the count drift. Only the sanctioned stock module may write the count — mirror the single-order-state-writer contract test. |
| **Delivery** | none | `scopedDb`; XAF integer money (`Intl.NumberFormat("fr-CM", { currency: "XAF" })`, no currency library) | Rates snapshot onto the order at placement, exactly like `unitPriceXaf`/`productName` do today. A later zone-rate edit must never retroactively change a placed order's delivery fee. |
| **Domains** | `tldts` | New `src/server/domains/**` module; `classifyHost()` gains a `custom` class; `resolveTenantByHost()` beside `resolveTenantBySlug()`; existing Redis hostname cache; new optional env vars | Keep the proxy I/O-free (rewrite host-as-segment). Fail closed on unknown hosts. Domain must be released on store suspension/deletion, or it stays bound to your Vercel project forever. |
| **Analytics** | none | `src/server/dashboard/queries.ts` aggregate patterns; `src/server/dashboard/buckets.ts`; `revenue-bars.tsx`; `after()`; Vercel Cron | `_sum` returns `null` on empty windows. `StoreDailyStat` is tenant-scoped and must be added to `TENANT_SCOPED_MODELS`. Label conversion with its actual denominator. |

**Cross-cutting additions to make once, not seven times:**
- New env vars → `src/env.ts` (optional, `emptyStringAsUndefined` already handles blank dashboard values) + `.env.example`.
- New tenant-scoped models → `TENANT_SCOPED_MODELS` in `src/server/db/tenant-scoped.ts` (an unregistered model throws rather than running unscoped — that is the safety net, use it).
- New user-facing copy → `src/lib/strings.ts` namespaces (the prose-literal contract test will fail the build otherwise).
- New import zone for `marketplaceDb` → `eslint.config.mjs`, plus a bidirectional restriction (marketplace zone must not import `adminDb`, mirroring how the admin zone is forbidden `tenant-scoped`).

---

## Open Questions for the Roadmap

1. **Vercel plan.** The 50-domain Hobby cap and the once-per-day Hobby cron limit are the two hardest external constraints in this milestone. Confirm which plan the production project is on before Domains is scheduled.
2. **Proxy I/O decision.** Option (a) above (host-as-segment rewrite) preserves the documented zero-I/O proxy constraint and is recommended, but it is an architectural change to `classifyHost()` and the `/s/[slug]` contract that deserves an explicit Key Decision entry.
3. **Conversion denominator.** Cart→order needs no new tracking; visit→order needs storefront instrumentation. Pick one and label it in the UI. Recommend cart→order for this milestone.
4. **`postgresqlExtensions` preview flag vs hand-edited `CREATE EXTENSION` migration.** Both verified to work; the preview flag is more declarative, the migration is more conservative. Low stakes either way, but pick once.
5. **Accent-insensitive search.** Deferrable, but if it is wanted, the `searchName` normalised column must be designed in with the initial marketplace schema, not retrofitted.

---

## Sources

- `/openapi/openapi_vercel_sh` (Context7) — `GET /v6/domains/{domain}/config` full response schema (`configuredBy`, `acceptedChallenges`, `recommendedIPv4`, `recommendedCNAME`, `misconfigured`); `POST /v10/projects/{idOrName}/domains`; `POST /v9/projects/{idOrName}/domains/{domain}/verify` — **HIGH**
- `/vercel/sdk` (Context7) — `addProjectDomain` / `verifyProjectDomain` / `getProjectDomain` signatures and the TXT-challenge response shape — **HIGH**
- https://vercel.com/platforms/docs/multi-tenant-platforms/configuring-domains — recommended multi-tenant add→verify→SSL flow, wildcard-requires-nameservers rule, 5–10 min TXT wait guidance — **HIGH**
- https://vercel.com/platforms/docs/multi-tenant-platforms/reference — SDK function list for domain lifecycle; confirms no recommended schema is prescribed — **HIGH**
- https://vercel.com/docs/domains/working-with-domains/add-a-domain (last updated 2026-08-28) — per-project unique CNAME target format (`d1d4fc829fe7bc7c.vercel-dns-017.com`), apex=A / subdomain=CNAME, 50-domain Hobby cap, wildcard nameserver requirement — **HIGH**
- https://vercel.com/docs/limits (last updated 2026-09-03) — domains per project (Hobby 50 / Pro soft-cap 100,000); domain create-update-remove 100/min; verification 100/min; project domains get 500/min; 100 cron jobs per project — **HIGH**
- https://vercel.com/docs/cron-jobs/usage-and-pricing (last updated 2026-07-15) — Hobby once-per-day minimum interval with ±59 min precision; Pro/Enterprise per-minute — **HIGH**
- https://vercel.com/docs/environment-variables/system-environment-variables (last updated 2026-07-15) — `VERCEL_PROJECT_ID` available at build **and** runtime; no `VERCEL_TEAM_ID` system var — **HIGH**
- `/websites/prisma_io` (Context7), Prisma 7 docs — GIN operator classes incl. `raw("...")`; explicit warning that function/expression indexes (`to_tsvector`) are unsupported and invisible to `db pull`; `fullTextSearchPostgres` preview flag and `search:` operator; `postgresqlExtensions` preview flag with `datasource.extensions` — **HIGH**
- https://www.postgresql.org/docs/current/pgtrgm.html + pganalyze GIN index guide — `gin_trgm_ops` accelerates `LIKE`/`ILIKE`/`~`/`~*`; ≥3-character minimum for index usability — **HIGH**
- https://neon.com/docs/extensions/pg_trgm — `pg_trgm` supported on Neon — **HIGH**
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` — `after()` stable, usable in Server Components / Server Functions / Route Handlers / Proxy — **HIGH**
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/index.md` — `dynamic`/`revalidate`/`fetchCache` removed in v16 **only when `cacheComponents` is enabled** — **HIGH**
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — Proxy defaults to Node.js runtime in v16; `runtime` config forbidden in Proxy files — **HIGH**
- `npm view` (2026-09-13) — `@vercel/sdk@1.28.30` (41,675,434 B unpacked, peer `zod ^3.25 || ^4`), `tldts@7.4.12` (published 2026-09-07), `psl@1.15.0` (published 2024-12-02), `recharts@3.10.1` (peer `react ^19`) — **HIGH**
- Repository inspection — `eslint.config.mjs` (`no-restricted-imports` zones, `$queryRaw`/`$executeRaw` ban), `src/server/search/queries.ts` (documented "no pg_trgm, no FTS, no $queryRaw" decision), `src/server/dashboard/{queries,buckets}.ts` (aggregate/groupBy + Node bucketing rationale), `src/app/(dashboard)/dashboard/revenue-bars.tsx` (hand-rolled-instead-of-recharts decision), `src/server/payments/phone.ts` (`normalizeCameroonMsisdn`), `prisma/schema.prisma` (no Customer/Domain/Inventory/Delivery/Listing models yet), `package.json` — **HIGH**

---
*Stack research for: multi-tenant commerce — marketplace discovery, merchant CRM/inventory/delivery, custom domains + TLS, first-party analytics*
*Researched: 2026-09-13*
