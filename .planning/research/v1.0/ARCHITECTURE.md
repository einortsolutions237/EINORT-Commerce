# Architecture Research

**Domain:** Multi-tenant commerce SaaS (storefront-builder) — Next.js App Router + Postgres + Prisma, shared schema, hostname-routed storefronts
**Researched:** 2026-08-16
**Confidence:** MEDIUM-HIGH (patterns cross-verified across multiple independent sources; no single authoritative "multi-tenant commerce" spec exists, so this is a synthesis of general multi-tenant SaaS practice + Shopify's public theme architecture + Prisma's own extension docs)

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                         EDGE / REQUEST LAYER                          │
├───────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  Next.js Middleware — Host Resolver                            │   │
│  │  Host header → strip base domain → subdomain/custom-domain     │   │
│  │  → cache lookup (Redis) → DB fallback → rewrite/inject tenant  │   │
│  └───────────────────────────────────────────────────────────────┘   │
├───────────────────────────────────────────────────────────────────────┤
│                     THREE SURFACES (one Next.js app)                  │
│  ┌───────────────┐   ┌────────────────┐   ┌────────────────────┐     │
│  │  Storefront    │   │  Merchant       │   │  Platform Admin     │     │
│  │  {tenant}.     │   │  Dashboard      │   │  admin.einort.tld   │     │
│  │  einort.tld    │   │  app.einort.tld │   │  (owner-only)       │     │
│  │  hostname→     │   │  session→       │   │  no tenant scope,   │     │
│  │  tenant scoped │   │  tenantId scoped│   │  cross-tenant reads │     │
│  └───────┬────────┘   └────────┬────────┘   └──────────┬──────────┘     │
├──────────┴─────────────────────┴────────────────────────┴──────────────┤
│                       SERVICE / DATA-ACCESS LAYER                       │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │  Tenant-scoped Prisma Client (extension wraps every query,     │    │
│  │  injects tenantId server-side — never trusts client input)     │    │
│  │  + separate unscoped client used only by Platform Admin path   │    │
│  └───────────────────────────────────────────────────────────────┘    │
├───────────────────────────────────────────────────────────────────────┤
│                            DATA / INFRA LAYER                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐   │
│  │  Postgres   │  │  Redis      │  │  R2/S3      │  │  Queue/jobs     │   │
│  │  shared     │  │  host→tenant│  │  images,    │  │  (Redis-backed,│   │
│  │  schema,    │  │  cache,     │  │  presigned  │  │  order/notify  │   │
│  │  tenant_id  │  │  sessions   │  │  uploads    │  │  side-effects) │   │
│  │  on every   │  │             │  │             │  │                │   │
│  │  tenant row │  │             │  │             │  │                │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| Host resolver (middleware) | Map incoming `Host` header to a tenant (or reject/404) before any route handler runs | `middleware.ts` (Next.js 15) — parse hostname, strip base domain to get subdomain OR look up custom domain, check Redis cache first, fall back to a single indexed DB lookup, rewrite the URL into an internal `/_sites/[tenantId]/...` path or set a request header consumed downstream |
| Storefront surface | Render the public, hostname-scoped store (home, PDP, PLP, cart, checkout-lite) from the resolved tenant's Theme/Page/Section/Block tree + product catalog | Next.js Server Components, reading only through the tenant-scoped Prisma client, tenantId sourced from middleware — never from a route param the client controls |
| Merchant dashboard | Authenticated, single-tenant app for the store owner (orders, catalog, payment-claims queue, basic sales, storefront editor) | Session-based auth; `tenantId` comes from the session/JWT claim, not from any client-supplied value; same tenant-scoped Prisma client as storefront |
| Platform admin | Owner-only, explicitly cross-tenant surface (merchant list/suspend, payment-claims ledger, domains, support) | Separate route group + separate role check; uses an *unscoped* Prisma client deliberately, isolated in its own service module so tenant-scoping bugs can never leak into it and it can never accidentally be reached by tenant-scoped session logic |
| Tenant-scoped data-access layer | Guarantee every tenant-scoped query is filtered by `tenantId` server-side, regardless of which surface calls it | Prisma Client Extension (`$extends`) wrapping `findMany`/`findFirst`/`update`/`delete`/`create` for `$allModels`, injecting `tenantId` into `where` (and `data` on create) from a value carried on the extended client instance — instantiated once per request from the resolved session/hostname tenant, never per-tenant Prisma Client singletons |
| Theme/Page/Section/Block engine | Store *instances* of which sections/blocks a tenant's pages contain, their order, and their settings values; render them through a code-defined component+schema registry | Relational tables for structure (ordering, tenant scoping, editor partial-saves) + a JSONB `settings` column per row for flexible field values; section/block *types* (Hero, ProductGrid, Footer, etc.) defined as a versioned registry in code, not as rows in a database |
| Order/payment-claim state machine | Enforce the Cart → Order Placed → Payment Pending → Payment Claimed → Confirmed/Disputed → Fulfilled transitions server-side | A single `status` enum column + an `OrderEvent`/audit table for transition history; transitions only ever happen through service-layer functions, never direct client writes to `status` |
| Async/notify layer | Decouple order-placement and payment-claim side effects (dashboard badge, WhatsApp link generation, future email/SMS) from the request/response cycle | Thin `notify()`/`enqueue()` interface from day one, backed initially by a simple Redis list or Postgres job table; can be swapped for BullMQ or a hosted queue later without touching call sites |
| Object storage | Product images, logos — enhancement/cropping pipeline | Presigned PUT URLs issued by a server action/route handler to Cloudflare R2 (S3-compatible); client never gets direct write credentials |

## Recommended Project Structure

```
src/
├── middleware.ts                # host resolution: subdomain/custom-domain → tenant, cache-first
├── app/
│   ├── (storefront)/            # hostname-routed, rendered per resolved tenant
│   │   ├── [[...slug]]/         # catch-all resolved against Page records for that tenant
│   │   └── layout.tsx           # loads TenantTheme, injects design tokens
│   ├── (dashboard)/             # app.einort.tld — merchant-authenticated
│   │   ├── orders/
│   │   ├── products/
│   │   ├── payment-claims/
│   │   └── storefront-editor/   # Theme/Page/Section/Block editor, subscription-gated
│   └── (admin)/                 # admin.einort.tld or /admin — platform-owner only
│       ├── merchants/
│       ├── payment-claims-ledger/
│       └── domains/
├── server/
│   ├── db/
│   │   ├── client.ts             # base PrismaClient singleton (never instantiated per-request)
│   │   ├── tenant-scoped.ts      # $extends wrapper: takes tenantId, returns scoped client
│   │   └── admin-client.ts       # unscoped client, used ONLY by (admin) route group services
│   ├── tenant/
│   │   ├── resolve-host.ts       # shared logic used by middleware + any server-side re-resolution
│   │   └── cache.ts              # Redis host→tenant cache (TTL, invalidation on domain change)
│   ├── theming/
│   │   ├── registry.ts           # code-defined Section/Block types: component + Zod settings schema
│   │   └── render-tree.ts        # loads Page→Section→Block rows, maps type → component
│   ├── orders/
│   │   ├── state-machine.ts      # allowed transitions, guards
│   │   └── notify.ts             # enqueue side effects (WhatsApp link, dashboard notification)
│   └── entitlements/
│       └── plan-limits.ts        # subscription tier + trial enforcement, checked server-side
├── prisma/
│   └── schema.prisma
└── lib/                          # shared utilities (formatting, validation, XAF currency helpers)
```

### Structure Rationale

- **`middleware.ts` + `server/tenant/`:** Hostname resolution is the single highest-leverage piece of infrastructure in this system — every other surface depends on knowing "which tenant is this request for" correctly and cheaply. Keeping it in one place (not re-implemented per route) is what lets custom domains be added later as a fast-follow without touching storefront rendering code.
- **`server/db/tenant-scoped.ts` as the only tenant-scoped DB entry point:** This is the mechanism that satisfies "server-side tenant enforcement on every query, non-negotiable" — if every service function is written against the scoped client instead of the raw Prisma client, it becomes structurally hard to accidentally leak cross-tenant data, and it is the single place a future upgrade to Postgres Row-Level Security would plug in (see Scaling Considerations).
- **`server/theming/registry.ts` as code, not data:** The requirements describe ~20 template variations built by *recombining* a small set of segment-flagship layouts through Theme→Page→Section→Block — not an open-ended page builder. Defining section/block types in code (component + settings schema) rather than as database-configurable "content types" avoids building a meta-CMS that this project doesn't need, while the *instances* (which sections a tenant's page uses, in what order, with what values) stay in the database so merchants can customize them.
- **`(storefront)` / `(dashboard)` / `(admin)` as Next.js route groups in one app:** Matches the "shared codebase, tier as limits" decision already made — one deployable, one build, one Prisma schema. Route groups plus middleware-based host/session resolution keep the three experiences physically separate in the URL space without needing three separate Next.js projects.

## Architectural Patterns

### Pattern 1: Middleware-based hostname-to-tenant resolution

**What:** Next.js `middleware.ts` runs before any page/route handler. It reads the `Host` header, determines whether the request is for the marketing/root domain, the merchant-dashboard subdomain, the admin subdomain, or a tenant storefront (either `{slug}.einort.tld` or, later, a custom domain), resolves the tenant record, and rewrites the request into an internal path (or attaches the resolved tenant as a request header) before the app router ever executes.
**When to use:** Any time a single Next.js deployment must serve many logically distinct "sites" from different hostnames.
**Trade-offs:** Fast (runs at the edge, cache-first) and keeps tenant resolution in one place; but middleware runs on *every* request including static assets, so the lookup path must be cheap (cache hit, not a DB round trip) and must fail closed (unknown host → 404, never fall through to some default tenant).

**Example:**
```typescript
// middleware.ts
export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const hostname = host.replace(/:\d+$/, "");

  if (hostname === ROOT_DOMAIN || hostname === `app.${ROOT_DOMAIN}` || hostname === `admin.${ROOT_DOMAIN}`) {
    return NextResponse.next(); // marketing / dashboard / admin — handled by their own route groups
  }

  const tenant = await resolveTenantByHost(hostname); // Redis cache first, indexed DB lookup fallback
  if (!tenant) return NextResponse.rewrite(new URL("/not-found", req.url));

  const url = req.nextUrl.clone();
  url.pathname = `/_sites/${tenant.id}${url.pathname}`;
  const res = NextResponse.rewrite(url);
  res.headers.set("x-tenant-id", tenant.id); // available to server components downstream
  return res;
}
```

### Pattern 2: Tenant-scoped Prisma Client via extensions

**What:** Rather than remembering to add `where: { tenantId }` on every query by hand, build one function that returns a Prisma Client extended (`$extends`) to auto-inject `tenantId` into `where` on reads/updates/deletes and into `data` on creates, for every tenant-scoped model. Session/host-resolved `tenantId` is the only source of truth — it is never accepted from a client-supplied field, query param, or request body.
**When to use:** From the very first migration — this is the mechanism that makes "server-side tenant enforcement on every query" actually enforceable rather than aspirational, and it is far cheaper to establish now than to retrofit after dozens of hand-written queries exist.
**Trade-offs:** Requires discipline that *no* code path uses the base (unscoped) `PrismaClient` for tenant-scoped models except the explicitly separate platform-admin service layer; in exchange, it eliminates an entire class of "forgot the WHERE clause" data leaks without needing Postgres Row-Level Security on day one.

**Example:**
```typescript
// server/db/tenant-scoped.ts
export function scopedDb(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        // findFirst, update, delete follow the same shape
      },
    },
  });
}
```

### Pattern 3: Theme → Page → Section → Block as relational structure + JSONB settings, with types defined in code

**What:** Split the content model into two layers. (1) A code-level **registry** of Section and Block *types* (e.g. `HeroSection`, `ProductGridSection`, `TestimonialBlock`), each pairing a React render component with a settings schema (Zod). (2) A relational **instance** model in Postgres recording, per tenant, which sections a page uses, in what order, with what settings values — plus which blocks live inside which sections, in what order, with what settings values.
**When to use:** Storefront-builder products where the customization surface is "recombine a bounded catalog of pre-built layouts," not an open-ended drag-and-drop page builder.
**Trade-offs:** More setup than a single JSON blob per page (Shopify's own `.json` template files store the whole section list as one file), but a relational instance model gives partial saves/reordering in the editor, per-row tenant scoping and indexing, and lets the platform admin ask cross-tenant questions later ("how many stores use the hero-carousel section") without parsing JSON blobs. A single-JSON-per-page approach is simpler to build and is an acceptable fallback if the 30-day timeline is tight, but it forgoes those admin/query capabilities and complicates concurrent field-level edits in the editor.

**Example (schema shape):**
```prisma
model Theme {                 // shared catalog, NOT tenant-scoped — the flagship pattern library
  id        String   @id @default(cuid())
  slug      String   @unique   // e.g. "flagship-fashion"
  name      String
}

model TenantTheme {            // tenant's selected theme + global token overrides
  id        String   @id @default(cuid())
  tenantId  String
  themeId   String
  tokens    Json                // color palette, fonts chosen at onboarding
  @@index([tenantId])
}

model Page {                   // one per storefront route type (home, PDP, PLP, cart...)
  id             String  @id @default(cuid())
  tenantId       String
  tenantThemeId  String
  type           String         // "home" | "product" | "collection" | "cart"
  @@index([tenantId, type])
}

model Section {                 // instance: which section, in what order, on which page
  id        String   @id @default(cuid())
  tenantId  String
  pageId    String
  type      String              // key into the code registry, e.g. "hero"
  position  Int
  settings  Json
  @@index([tenantId, pageId, position])
}

model Block {                   // instance: repeatable content unit inside a section
  id        String   @id @default(cuid())
  tenantId  String
  sectionId String
  type      String
  position  Int
  settings  Json
  @@index([tenantId, sectionId, position])
}
```

## Data Flow

### Storefront request flow

```
Browser request to {slug}.einort.tld/products/red-dress
    ↓
middleware.ts resolves host → tenantId (Redis cache hit, or DB fallback + cache fill)
    ↓ (rewrite, x-tenant-id header)
Server Component (storefront route) reads x-tenant-id
    ↓
scopedDb(tenantId) — tenant-scoped Prisma client
    ↓
Loads: Page (type="product") → Sections (ordered) → Blocks (ordered) + Product row
    ↓
Section/Block registry maps each `type` → React component, passes `settings` as props
    ↓
Rendered HTML response
```

### Order placement + payment-claim flow

```
Customer submits cart on storefront (tenant-scoped)
    ↓
Order created: status = "Placed" → "PaymentPending" (server action, scopedDb)
    ↓
notify() enqueues: WhatsApp deep-link generation is NOT an API call —
    it is a URL builder (wa.me/<merchant-number>?text=<prefilled order summary>),
    executed synchronously; only the dashboard "new order" signal needs async delivery
    ↓
Customer marks "I've paid" + reference/screenshot → status = "PaymentClaimed"
    ↓
Merchant dashboard Payment Claims queue (scopedDb, tenantId from session)
    ↓
Merchant confirms/rejects → status = "Confirmed"/"Disputed" → "Fulfilled"
    ↓
Every transition writes an OrderEvent row (audit trail); platform admin's
payment-claims ledger reads across tenants via the unscoped admin client
```

### Key data flows

1. **Hostname → tenant → storefront render:** The only path by which the *public* surface learns which tenant it's serving; must fail closed on unknown hosts and must never derive tenant identity from anything else (URL query param, cookie set by the client, etc.).
2. **Session → tenant → dashboard/editor:** The merchant dashboard and storefront editor derive `tenantId` from the authenticated session, not from the hostname — a merchant logged into `app.einort.tld` is editing their own tenant regardless of what hostname their storefront happens to be reachable at.
3. **Platform admin → cross-tenant reads:** The only place in the system allowed to query without a `tenantId` filter; isolated into its own service module using the unscoped client so this exception is structurally visible in the codebase rather than an ad hoc `where` clause omission elsewhere.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|---------------------------|
| Pilot (Douala, low hundreds of tenants) | Single Postgres instance, no partitioning, no read replica, no RLS. Every tenant-scoped table already has `tenantId` as the leading column of its composite index. Redis host→tenant cache with a 60–300s TTL is enough; DB fallback lookup is cheap because it's a single indexed lookup, not a scan. |
| 1k–100k tenants | First real bottleneck is Postgres **connection count**, not query speed — serverless Next.js functions each holding a direct connection exhausts Postgres's connection limit quickly. Introduce a connection pooler (PgBouncer in transaction mode, or a managed pooling layer such as Prisma Accelerate) before this becomes a production incident, not after. Add a read replica for storefront reads once write contention from dashboard/order traffic starts affecting storefront render latency. Cache rendered Page/Section/Block trees per tenant in Redis, invalidated on publish, since storefront traffic is read-heavy and largely static between edits. |
| 100k–2M+ tenants | Because every composite index and every query already leads with `tenantId`, **table partitioning by tenant_id (hash or range)** becomes a mechanical operation rather than a redesign — this is the direct payoff of the "index tenant_id everywhere from day one" discipline. Heaviest tenants could be moved to isolated schemas/databases behind the *same* `scopedDb()` interface if truly necessary, without rewriting call sites, because application code never queries Postgres directly outside that layer. Postgres Row-Level Security can be layered in at this point as defense-in-depth (the tenant-scoped client already centralizes where a `SET LOCAL app.tenant_id` call would be added) — not required at pilot scale, but the architecture doesn't block adding it later. |

### Scaling Priorities

1. **First bottleneck:** Postgres connection exhaustion under serverless concurrency (not query performance) — solved with connection pooling, well before 100k tenants, and unrelated to the schema design itself.
2. **Second bottleneck:** Storefront read load competing with dashboard/order write load on the same primary — solved with a read replica and/or per-tenant render caching, both additive changes that don't touch the schema.

## Anti-Patterns

### Anti-Pattern 1: Trusting a client-supplied tenant identifier

**What people do:** Read `tenantId` from a request body, query string, or client-set cookie and use it directly in a database query.
**Why it's wrong:** Any client-controlled value can be tampered with; this is the single most common way multi-tenant systems leak or corrupt another tenant's data. It directly contradicts this project's own non-negotiable constraint ("never trust price, stock, tenant ID, or payment/order status from the client").
**Do this instead:** `tenantId` is derived exactly two ways — from the middleware-resolved hostname (storefront) or from the authenticated session (dashboard/editor) — and both funnel into the single `scopedDb(tenantId)` factory. No other code path should be able to set it.

### Anti-Pattern 2: Schema-per-tenant or database-per-tenant

**What people do:** Give each tenant an isolated Postgres schema or database for "stronger isolation," especially tempting when a team is worried about cross-tenant leaks.
**Why it's wrong:** Explicitly the opposite of the architecture already chosen for this project (shared schema, `tenant_id` column). At meaningful tenant counts it also fights serverless connection pooling (each schema/database effectively needs its own migration run and often its own connection), and it makes the platform admin's cross-tenant queries (merchant list, payment-claims ledger) require fan-out across N schemas instead of one indexed query.
**Do this instead:** Shared schema with `tenantId` on every tenant-scoped table, enforced through the scoped Prisma client — isolation is a server-side application-layer + indexing guarantee, not a database-provisioning guarantee, which is also what keeps onboarding a new merchant a zero-infrastructure, instant operation.

### Anti-Pattern 3: Building a fully generic, infinitely-nestable page-builder content model

**What people do:** Model Section/Block as an arbitrary recursive component tree with a database-driven "content type" system, so any merchant or admin could theoretically define new component types at runtime.
**Why it's wrong:** This project's requirement is ~20 visually distinct templates produced by recombining a *small, bounded* set of segment-flagship layouts — not a general-purpose CMS. A fully generic content-modeling system is significantly more engineering than a 30-day solo build can absorb, and it's unnecessary: nothing in the requirements calls for merchants or admins to invent new section types.
**Do this instead:** Keep the catalog of Section/Block *types* in code (component + settings schema), and let the database only store *instances* (which types, in what order, with what settings values) per tenant page. New template variety comes from adding new types to the code registry during development, not from a runtime type-authoring system.

### Anti-Pattern 4: Instantiating `new PrismaClient()` per request or per tenant

**What people do:** Create a fresh Prisma Client (or a fresh client per tenant, cached in a map) to "isolate" tenants at the client level.
**Why it's wrong:** Prisma Client manages its own connection pool internally; instantiating it repeatedly exhausts database connections fast, especially in serverless environments — a well-documented performance anti-pattern independent of multi-tenancy.
**Do this instead:** One singleton base `PrismaClient`, extended per-request via `$extends` into a lightweight scoped wrapper that carries `tenantId` as a closure variable, not a new connection.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| Cloudflare R2 (S3-compatible) | Presigned PUT URLs issued by a server action; client uploads directly to R2, never through the Next.js server as a proxy | Image enhancement/cropping runs as a post-upload processing step, not inline with the presigned upload |
| Redis | (1) host→tenant resolution cache, (2) session store, (3) backing store for the async notify/job interface | Same Redis instance can serve all three at pilot scale; keep key namespaces separate (`tenant:host:*`, `session:*`, `jobs:*`) so any one of them can be split out later without a redesign |
| WhatsApp | **Not an API integration** — a `wa.me` deep link with a URL-encoded, prefilled order-summary message | No webhook, no auth, no rate limit concerns; this is a link-building utility function, not a service client |
| Mobile Money / Orange Money | **Not an API integration** — manual transfer instructions rendered to the customer (receiving number, exact amount) plus a "tap-to-dial USSD" `tel:` link where feasible | Confirmed out of scope for V1; the order state machine's `PaymentClaimed` step exists specifically to accommodate this manual flow |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| Middleware ↔ Storefront route handlers | Rewrite + request header (`x-tenant-id`) | Middleware never renders content itself; it only resolves and hands off |
| Storefront/Dashboard ↔ Data layer | Always through `scopedDb(tenantId)`, never the raw Prisma client | This boundary is what makes tenant isolation a structural property of the codebase rather than a per-query discipline |
| Dashboard ↔ Platform Admin | No shared service functions — admin has its own unscoped service module | Prevents an admin-side change from accidentally weakening tenant scoping used by the dashboard, and vice versa |
| Order flow ↔ Notify layer | Function call into `notify()`/`enqueue()`, never a direct WhatsApp/email/SMS call inline in the order-placement handler | Keeps the request/response cycle fast and gives a single place to later add real async delivery (queue, retries) without touching order logic |

## Sources

- [Prisma Client extensions: query component (official docs)](https://www.prisma.io/docs/orm/prisma-client/client-extensions/query) — HIGH confidence, official documentation for the `$extends` tenant-scoping pattern
- [Prisma Client extensions (official docs)](https://www.prisma.io/docs/orm/prisma-client/client-extensions) — HIGH confidence
- [Multi-Tenant SaaS Data Isolation: Row-Level Security, Tenant Scoping, and Plan Enforcement with Prisma — DEV Community](https://dev.to/whoffagents/multi-tenant-saas-data-isolation-row-level-security-tenant-scoping-and-plan-enforcement-with-1gd4) — MEDIUM confidence, cross-checked against Prisma's own extension docs
- [Securing Multi-Tenant Applications Using Row Level Security in PostgreSQL with Prisma ORM — Medium](https://medium.com/@francolabuschagne90/securing-multi-tenant-applications-using-row-level-security-in-postgresql-with-prisma-orm-4237f4d4bd35) — MEDIUM confidence
- [Multi-Tenant Search in PostgreSQL with Row-Level Security — Pedro Alonso](https://www.pedroalonso.net/blog/postgres-multi-tenant-search/) — MEDIUM confidence
- [Multi-Tenant Architecture: Row-Level vs Schema-Level Isolation](https://abhaypratapsingh.co.in/blog/multi-tenant-architecture-isolation) — MEDIUM confidence, corroborates shared-schema-with-tenant_id as the standard SaaS default
- [Multi-Tenant Subdomain Routing in Next.js: The Complete Pattern — peal.dev](https://www.peal.dev/blog/multi-tenant-subdomain-routing-nextjs-patterns) — MEDIUM confidence
- [Next.js Multi-Tenant Architecture Patterns for SaaS — Kostra](https://kostra.io/blog/what-is-nextjs-multi-tenant-architecture) — MEDIUM confidence
- [Vercel Platforms starter kit (GitHub)](https://github.com/vercel/platforms) — MEDIUM confidence (official Vercel reference implementation for subdomain-based multi-tenant Next.js; confirms the middleware-rewrite pattern and root/subdomain/custom-domain routing split, though it uses Redis rather than Postgres/Prisma for its own data layer)
- [Shopify: JSON templates (official theme architecture docs)](https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates) — HIGH confidence, official source for the Theme→Page(JSON template)→Section→Block hierarchy and the "structure as data, rendering as code" split that this project's Section/Block registry pattern is modeled on
- [Shopify: Sections (official docs)](https://shopify.dev/docs/storefronts/themes/architecture/sections) — HIGH confidence
- [Shopify Help Center: Sections and blocks](https://help.shopify.com/en/manual/online-store/themes/theme-structure/sections-and-blocks) — HIGH confidence
- [Prisma Schema Design: Relationships, Enums, and Indexes That Scale — DEV Community](https://dev.to/whoffagents/prisma-schema-design-relationships-enums-and-indexes-that-scale-9gm) — MEDIUM confidence, corroborates composite-index-leading-with-tenantId guidance
- [Multi-Tenancy Implementation Approaches With Prisma and ZenStack](https://zenstack.dev/blog/multi-tenant) — MEDIUM confidence

---
*Architecture research for: multi-tenant commerce SaaS storefront-builder (EINORT-Commerce)*
*Researched: 2026-08-16*
