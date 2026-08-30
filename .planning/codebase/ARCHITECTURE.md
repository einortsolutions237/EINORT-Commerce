<!-- refreshed: 2026-08-30 -->
# Architecture

**Analysis Date:** 2026-08-30

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                     Next.js 16 Proxy (edge-adjacent)                     │
│                              `src/proxy.ts`                              │
│   Zero-I/O hostname classification only. Rewrites `{slug}.einort.com`    │
│   requests to `/s/{slug}/...`. Strips any inbound `x-tenant-id` header.  │
└───────────────┬───────────────────────────────────┬──────────────────────┘
                │ root / reserved (passthrough)      │ store (rewrite to /s/{slug})
                ▼                                     ▼
┌────────────────────────────────┐    ┌──────────────────────────────────────┐
│   Apex App Router surface       │    │   Storefront App Router surface       │
│  `src/app/(dashboard)/**`       │    │  `src/app/s/[slug]/**`                │
│  `src/app/login|signup|...`     │    │  Tenant gate lives in the layout:     │
│  `src/app/api/auth/[...all]`    │    │  `resolveTenantBySlug` (cached),      │
│  Session-gated via              │    │  404s (branded) on any non-active     │
│  `requireMerchantContext()`     │    │  tenant. Palette re-scoped to zinc    │
│  called in every page/action.   │    │  via `data-surface="storefront"`.     │
└───────────────┬─────────────────┘    └───────────────┬────────────────────┘
                │                                        │
                ▼                                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  Server Actions & Route Handlers                         │
│  `src/server/{merchant,orders,catalog,cart,payments,images,tenant}/*`    │
│  Merchant writes wrapped by `merchantAction()` (src/server/merchant/     │
│  action.ts) — entitlement + trial + Zod gate, single `{ok,error}` shape. │
│  Anonymous storefront writes (cart, checkout, claims) resolve tenant     │
│  from hostname/session per call — no shared "current tenant" global.     │
└───────────────┬───────────────────────────────────┬──────────────────────┘
                │                                     │
                ▼                                     ▼
┌────────────────────────────────┐   ┌───────────────────────────────────────┐
│   Data-access layer (the wall)  │   │   External services                   │
│  `src/server/db/*`               │   │  Upstash Redis — cart, tenant-host    │
│  `scopedDb(tenantId)`  — tenant  │   │    cache, rate limits, idempotency    │
│    Prisma Client Extension       │   │  Cloudflare R2 (S3 API) — product/    │
│  `platformDb`          — registry│   │    claim/logo images, via presigned   │
│    tables (Organization, User…)  │   │    PUT + `src/server/images/r2.ts`    │
│  `adminDb`             — platform│   │  Better Auth — session/org/member     │
│    admin, unscoped, lint-fenced  │   │    persisted through Prisma           │
└───────────────┬──────────────────┘   └───────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Neon) via Prisma 7 + adapter-pg           │
│              `prisma/schema.prisma` — shared schema, `tenantId` column   │
│              on every tenant-scoped table (Category, Product, Order...)  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Proxy (hostname router) | Classify `Host` header, rewrite subdomains to `/s/{slug}`, strip forged tenant headers. Zero I/O. | `src/proxy.ts` |
| Host classifier | Pure function: hostname string → `root`/`reserved`/`store`/`unknown`. Unit-testable, no env access. | `src/server/tenant/host.ts` |
| Tenant resolver | Slug → live tenant row, Redis-cached, fail-closed to `null` on anything non-active. | `src/server/tenant/resolve.ts` |
| Tenant Redis cache | Positive/negative cache for hostname resolution, degrades to DB-only on Redis outage. | `src/server/tenant/cache.ts` |
| Merchant DAL (`requireMerchantContext`) | The one place session → tenant identity is derived. Zero parameters, `React.cache()`-memoized, redirect-based auth ladder. | `src/server/merchant/context.ts` |
| Entitlements resolver | Pure `(organization row, now)` → plan, trial state, `canWrite`. No I/O, no clock read. | `src/server/entitlements/resolve.ts` |
| Entitlements assertions | Throwing guards (`EntitlementError`, `ReadOnlyError`) consumed by `merchantAction`. | `src/server/entitlements/assert.ts` |
| Plan registry | Static plan-tier definitions (limits, features) as data, not scattered conditionals. | `src/server/entitlements/plans.ts` |
| Merchant action wrapper | Factory producing gated Server Actions: identity, `canWrite`, Zod parse, typed `ActionResult`. | `src/server/merchant/action.ts` |
| Base Prisma client | The one raw, unscoped `PrismaClient` instance (dev-cached on `globalThis`). Import-restricted via ESLint. | `src/server/db/base.ts` |
| Tenant-scoped client | Prisma Client Extension stamping/filtering every operation on registered models by `tenantId`. | `src/server/db/tenant-scoped.ts` |
| Platform client | Narrow allowlist facade over non-tenant registry tables (Organization, User, Member, Invitation, Session). | `src/server/db/platform.ts` |
| Admin client | Deliberately unscoped, cross-tenant. Import-restricted to `src/server/admin/**` (not yet built). | `src/server/db/admin.ts` |
| Order placement | Single sanctioned writer of new orders: server-side price re-read, atomic stock hold, one transaction. | `src/server/orders/place.ts` |
| Order state machine | Pure `(channel, from, to) → boolean` legality table for the 6-state order lifecycle. | `src/server/orders/state-machine.ts` |
| Order transition writer | The only module allowed to write `Order.state`; pairs every transition with an `OrderEvent` audit row. | `src/server/orders/transition.ts` |
| Stock holds | Conditional-decrement stock reservation, race-safe under concurrent checkouts. | `src/server/orders/stock.ts` |
| Cart actions | Server Actions for add/set/remove; sole owner of the cart cookie; tenant re-resolved from slug per call. | `src/server/cart/actions.ts` |
| Cart cache | Redis-backed cart storage keyed by opaque cookie id, tenant-bound. | `src/server/cart/cache.ts` |
| Catalog actions/queries | Product/category/variant CRUD (merchant side) and storefront reads. | `src/server/catalog/actions.ts`, `src/server/catalog/queries.ts` |
| Image pipeline | Sharp-based derive step (resize/normalize/webp) behind a preset registry (`product`, `claim`, `logo`). Node-runtime only. | `src/server/images/pipeline.ts` |
| R2 client | S3-compatible presigned upload/finalize against Cloudflare R2. | `src/server/images/r2.ts` |
| Payments (manual transfer) | USSD helper text, WhatsApp deep-link generation, merchant payment settings, phone formatting. | `src/server/payments/*.ts` |
| Rate limiting | Upstash-backed sliding-window limiters, one per surface, fail-open with a loud warning if unconfigured. | `src/server/rate-limit.ts` |
| Idempotency cache | Redis-backed dedupe for client-retried mutations. | `src/server/idempotency/cache.ts` |
| Auth | Better Auth instance (organization + admin plugin surface), login/signup Server Actions. | `src/server/auth/auth.ts`, `src/server/auth/login.ts`, `src/server/auth/signup.ts` |
| Env validation | `@t3-oss/env-nextjs`-based typed/validated environment variables, boot-time fail-fast. | `src/env.ts` |
| Dashboard shell | Sidebar layout; NOT an authorization boundary (calls DAL for data only, never redirects). | `src/app/(dashboard)/layout.tsx` |
| Storefront shell | Tenant gate + zinc-palette surface scoping for `/s/[slug]/**`. IS the authorization boundary for that subtree. | `src/app/s/[slug]/layout.tsx` |

## Pattern Overview

**Overall:** Modular monolith on Next.js App Router (server-first: Server Components + Server Actions), single shared-schema PostgreSQL database with application-layer multi-tenancy. No microservices, no separate API layer — the "API" is Server Actions plus one Better Auth catch-all route handler.

**Key Characteristics:**
- Multi-tenant SaaS with tenant identity derived from two untrusted-free channels only: the `Host` header (storefront) and the signed session cookie (dashboard) — never from a client-supplied id, path parameter, or form field.
- Tenant isolation enforced structurally by a Prisma Client Extension (`scopedDb`), not by convention — an unregistered model throws rather than running unscoped.
- Three-tier database client separation (`scopedDb` / `platformDb` / `adminDb`), each with its own ESLint-enforced import zone, so a call site's access level is visible at the import statement.
- "Fail closed" is a repeated, explicit design rule across the resolver (`resolveTenantBySlug`), the classifier (`classifyHost`), and the merchant DAL (`requireMerchantContext`): anything not certainly valid resolves to `null`/404/redirect, never to a best-guess default.
- Financial values are never trusted from the client and never joined from live catalog data at read time on an order — every order line snapshots `productName`, `variantLabel`, `unitPriceXaf`, and `imageKey` at placement so a later price/name change cannot retroactively alter a placed order.
- Order state is a single authoritative table (`ORDER_TRANSITIONS`) plus one predicate (`canTransition`), and exactly one module (`transition.ts`) is permitted to write `Order.state` — enforced by a source-scanning test (`tests/unit/single-order-state-writer.test.ts`).
- V1 has no live payment gateway: payment is manual Mobile Money/Orange Money transfer + a merchant-reviewed claim flow, or WhatsApp/cash-on-delivery outside the payment state machine entirely.
- Extensive block-comment "why" documentation is a first-class codebase convention — most non-trivial modules carry a multi-paragraph rationale header referencing internal decision IDs (`TEN-02`, `D-08`, `T-03-34`, etc.) from planning documents.

## Layers

**Proxy / edge routing:**
- Purpose: classify inbound hostnames and rewrite storefront subdomains into the internal `/s/{slug}` route tree; strip any client-forged tenant headers.
- Location: `src/proxy.ts` (Next 16's renamed `middleware.ts`), `src/server/tenant/host.ts`
- Contains: pure functions only — no Prisma, no Redis, no `@/env` import (env is read once via a raw `process.env` reference at module scope, not through the validated `@/env` module).
- Depends on: nothing but a static reserved-slugs list.
- Used by: every request; the only inputs downstream layers can trust for tenant identity are the rewritten `/s/{slug}` path and the (stripped) forwarded headers.

**App Router (presentation):**
- Purpose: route-level layouts, pages, and client islands for three route trees — apex marketing/auth (`src/app/(dashboard)`, `login`, `signup`, `onboarding`), the storefront (`src/app/s/[slug]`), and the Better Auth catch-all API (`src/app/api/auth/[...all]`).
- Location: `src/app/**`
- Contains: Server Components (default), a small number of Client Components (forms, interactive cart/product widgets), layouts.
- Depends on: `src/server/**` for all data access and mutation; `src/components/**` for UI primitives.
- Used by: end users (merchants via the dashboard, anonymous shoppers via the storefront).

**Server layer (business logic + data access):**
- Purpose: all business rules, all database/cache/storage access, all Server Actions.
- Location: `src/server/**`, organized by domain (`auth`, `cart`, `catalog`, `claims`, `db`, `entitlements`, `idempotency`, `images`, `merchant`, `orders`, `payments`, `storefront`, `tenant`) plus `src/server/rate-limit.ts`.
- Depends on: Prisma (through the three DB-client facades only), Upstash Redis, Cloudflare R2 (via AWS SDK v3), Better Auth, Sharp.
- Used by: `src/app/**` pages/layouts and their co-located Server Action files (e.g. `create-store-form.tsx` calling into `src/server/tenant/actions.ts`).

**Data-access wall:**
- Purpose: the single sanctioned door to Postgres, split into three access levels by trust boundary rather than by domain.
- Location: `src/server/db/base.ts` (raw client), `src/server/db/tenant-scoped.ts` (`scopedDb`), `src/server/db/platform.ts` (`platformDb`), `src/server/db/admin.ts` (`adminDb`), `src/server/db/enums.ts`, `src/server/db/model-inputs.ts`.
- Contains: the Prisma Client Extension, the `TENANT_SCOPED_MODELS` registry, type helpers (`ScopedDb`, `ScopedTx`, `ScopedCreateData`).
- Depends on: `src/generated/prisma/**` (the Prisma 7 generated client — never imported directly outside this layer).
- Used by: every domain module in `src/server/**` except the admin surface, which uses `adminDb` exclusively.

**Generated code:**
- Purpose: Prisma 7's generated (Rust-free) client output.
- Location: `src/generated/prisma/**`
- Contains: `PrismaClient`, model types, enums. Never hand-edited; regenerated via `scripts/prisma-generate.mjs` (the `postinstall` hook).
- Depends on: `prisma/schema.prisma`.
- Used by: exclusively `src/server/db/**` — an ESLint rule (`no-restricted-imports` on `**/generated/prisma*`) blocks any other import path.

## Data Flow

### Storefront request (subdomain hostname resolution)

1. Request hits `{slug}.einort.com/...` — classified by `classifyHost()` inside `src/proxy.ts` (pure, zero I/O).
2. Proxy rewrites the path to `/s/{slug}/...` and forwards with `x-tenant-id`/`x-store-slug` headers stripped.
3. `src/app/s/[slug]/layout.tsx` calls `resolveTenantBySlug(slug)` (`src/server/tenant/resolve.ts`), which checks the Redis tenant-host cache (`src/server/tenant/cache.ts`) before falling back to `platformDb.organization.findUnique`.
4. Any non-`active` status, or no such organization, resolves to `null` and the layout calls `notFound()` — rendered as the one branded not-found page, indistinguishable from "never existed."
5. Child pages/components render using `scopedDb(tenant.id)` reads (catalog, storefront queries) — never a second, independent tenant lookup.

### Merchant dashboard request (session-derived tenant)

1. Every dashboard page and every Server Action calls `requireMerchantContext()` (`src/server/merchant/context.ts`) itself — the layout (`src/app/(dashboard)/layout.tsx`) calls it too, but only for banner data, and explicitly never redirects.
2. `requireMerchantContext` reads the Better Auth session via `auth.api.getSession()`, extracts `session.session.activeOrganizationId` (never a URL/body parameter), and walks a fail-closed ladder: no session → `/login`; no active org → `/onboarding/create-store`; org not `active` → `/suspended`; no `planTier` → `/onboarding/plan`.
3. On success, returns a `MerchantContext` (`resolveEntitlements(org, now)` plus `userId`), memoized per-render via `React.cache()`.
4. Write actions route through `merchantAction({ mode, schema, handler })` (`src/server/merchant/action.ts`), which re-derives context, checks `ctx.canWrite` before parsing input, Zod-validates, and converts `EntitlementError`/`ReadOnlyError` throws into the shared `ActionResult` shape.
5. All persistence inside the handler goes through `scopedDb(ctx.tenantId)`.

### Order placement (checkout)

1. `placeOrder(tenantId, input)` (`src/server/orders/place.ts`) receives only variant ids and quantities — no price fields exist on the input type.
2. Inside one `scopedDb(tenantId).$transaction(...)`: variants are re-read from Postgres (server is the sole source of price/availability), stock is conditionally decremented (`holdStockForLines`), line items are snapshotted (name, variant label, unit price, hero image key), and the order + first `OrderEvent` are written together via `openOrderAtGenesis` in `transition.ts`.
3. For the `MANUAL_TRANSFER` channel only, the order is immediately transitioned to `PAYMENT_PENDING` through `transitionOrder` (never a raw `order.update`), which appends a `SYSTEM`-actor audit row.
4. On a duplicate order-number unique-constraint violation, the whole attempt retries exactly once with a freshly minted number; every other failure rethrows immediately.
5. Caller receives `{ orderId, orderNumber, trackingToken }` — the plaintext tracking token is returned exactly once and never persisted (only its hash is stored).

**State Management:**
- Server-authoritative for everything financial and tenant-scoped (orders, stock, catalog, entitlements) — no client-trusted state ever reaches a write.
- Client-side ephemeral state: cart is a Redis blob keyed by an opaque, host-scoped, `httpOnly` cookie (no `domain` attribute — cross-tenant cookie leakage is structurally prevented). The cart is explicitly *not* an `Order` row; the first persisted order state is `ORDER_PLACED`.
- Order lifecycle state lives entirely in Postgres (`Order.state`), governed by the pure `ORDER_TRANSITIONS` table and written exclusively through `src/server/orders/transition.ts`.
- Trial/entitlement state is never stored (no `isExpired` column) — always derived from `(organization row, now)` by `resolveEntitlements`.

## Key Abstractions

**Three-tier Prisma client:**
- Purpose: make the trust boundary of every database call visible at the import site rather than at the call site.
- Examples: `src/server/db/tenant-scoped.ts` (`scopedDb`), `src/server/db/platform.ts` (`platformDb`), `src/server/db/admin.ts` (`adminDb`)
- Pattern: Prisma Client Extension for `scopedDb` (auto-stamps/filters by `tenantId` on every operation for a registered model, throws for unregistered ones); getter-based allowlist facade for `platformDb`; raw passthrough with an ESLint-only boundary for `adminDb`.

**merchantAction wrapper:**
- Purpose: make the "safe" Server Action (identity-checked, entitlement-gated, schema-validated) the path of least resistance, since Next has no framework-level pre-action hook.
- Examples: `src/server/merchant/action.ts`; consumed throughout `src/server/catalog/actions.ts`, `src/server/orders/actions.ts`, `src/app/(dashboard)/dashboard/**`
- Pattern: higher-order factory — `merchantAction({ mode: "read"|"write", schema, handler })` returns an async function taking raw unknown input, resolving context first, refusing writes before parsing, then Zod-parsing and dispatching to the typed handler.

**State-machine-as-data:**
- Purpose: express legality rules as an inspectable/testable value rather than scattered conditionals, applied consistently across the order lifecycle, tenant model registry, and plan tiers.
- Examples: `src/server/orders/state-machine.ts` (`ORDER_TRANSITIONS`, `canTransition`), `src/server/db/tenant-scoped.ts` (`TENANT_SCOPED_MODELS`), `src/server/entitlements/plans.ts` (`PLANS`)
- Pattern: `Readonly<Record<EnumType, ...>>` typed against the full enum so an added enum member is a compile error until the table is updated.

**Snapshot-on-write for financial records:**
- Purpose: an order is a record of a past event, not a live view — later catalog changes must never retroactively alter what a customer was charged or shown.
- Examples: `src/server/orders/place.ts` (`OrderItem.productName`, `.variantLabel`, `.unitPriceXaf`, `.imageKey`)
- Pattern: copy denormalized values onto the child row at transaction time instead of joining to the live parent at read time.

**Preset registry (image pipeline):**
- Purpose: let a new image surface (logo, claim screenshot, product photo) become a data row rather than a new function.
- Examples: `src/server/images/pipeline.ts` (`IMAGE_PRESETS`)
- Pattern: one object literal per surface (`sizes`, `labels`, `fit`, `ratio`, `format`) consumed by a single `processImage(input, preset)` function.

## Entry Points

**`src/proxy.ts` (Next 16 Proxy, formerly `middleware.ts`):**
- Location: `src/proxy.ts`
- Triggers: every request except `_next/static`, `_next/image`, `favicon.ico`, `robots.txt`, `sitemap.xml` (see `config.matcher`)
- Responsibilities: hostname classification, subdomain-to-`/s/{slug}` rewrite, forged-header stripping, hard 404 on any direct `/s/*` request.

**`src/app/layout.tsx` (root layout):**
- Location: `src/app/layout.tsx`
- Triggers: every page render
- Responsibilities: font loading (Plus Jakarta Sans body, Outfit heading), global metadata template (`"%s · EINORT"`).

**`src/app/(dashboard)/layout.tsx`:**
- Location: `src/app/(dashboard)/layout.tsx`
- Triggers: any apex-hostname request under the dashboard route group (unreachable from a storefront subdomain — the proxy rewrite makes `/dashboard` 404 under `/s/{slug}/dashboard`)
- Responsibilities: sidebar shell, trial banner, sign-out control. Explicitly NOT the auth boundary.

**`src/app/s/[slug]/layout.tsx`:**
- Location: `src/app/s/[slug]/layout.tsx`
- Triggers: every rewritten storefront request
- Responsibilities: the tenant existence/active-status gate (IS the auth boundary for this subtree), storefront palette scoping via `data-surface="storefront"`.

**`src/app/api/auth/[...all]/route.ts`:**
- Location: `src/app/api/auth/[...all]/route.ts`
- Triggers: all Better Auth HTTP traffic (sign-in, sign-up, session, organization plugin endpoints)
- Responsibilities: delegates entirely to the Better Auth handler configured in `src/server/auth/auth.ts`. Reachable only apex-side (the proxy rewrite makes it 404 under any storefront subdomain).

**`src/app/api/upload/finalize/route.ts`:**
- Location: `src/app/api/upload/finalize/route.ts`
- Triggers: client confirmation after a direct-to-R2 presigned PUT completes
- Responsibilities: verifies the uploaded object, drives the Sharp derive pipeline, persists resulting image rows.

## Architectural Constraints

- **Runtime split:** Any module importing `sharp` (`src/server/images/pipeline.ts` and its callers) must run in the Node.js runtime — never `export const runtime = 'edge'` — because Sharp's native libvips bindings cannot load on Edge. This is a hard crash, not a graceful degradation, and is not caught by typecheck or lint.
- **Proxy has no I/O:** `src/proxy.ts` must never import Prisma, Redis, or `@/env` (the validated env module) — enforced by convention/review, not by tooling. It reads `NEXT_PUBLIC_ROOT_DOMAIN` via a literal `process.env` reference so Next inlines it at build time.
- **Global state:** `prismaBase` (`src/server/db/base.ts`) is cached on `globalThis` in development only (hot-reload connection-pool reuse), never in production. Redis client resolution in `src/server/rate-limit.ts` and `src/server/tenant/cache.ts` memoizes a `{ redis: Redis | null }` decision at module scope (three-state discipline: unresolved / resolved-live / resolved-degraded).
- **Import-zone enforcement (ESLint, `eslint.config.mjs`):** `src/server/db/base` and `src/generated/prisma*` are unimportable outside `src/server/db/**`, `src/server/tenant/**`, `src/server/auth/**`. `src/server/db/admin` is unimportable outside `src/server/admin/**`. The admin zone additionally forbids importing `src/server/db/tenant-scoped` — isolation is enforced in both directions. `$queryRaw`/`$executeRaw` are banned repository-wide via `no-restricted-syntax` (verified empirically not to be intercepted by the tenant extension).
- **No `CANCELLED` order state:** the order lifecycle has exactly six states; a cancellation is handled outside the state machine (a human conversation), not as a seventh enum member — enforced by `tests/unit/state-machine.test.ts`.
- **Single sanctioned writer of `Order.state`:** only `src/server/orders/transition.ts` may set it — enforced by `tests/unit/single-order-state-writer.test.ts` scanning source for direct writes elsewhere.
- **`requireMerchantContext()` takes no parameters, ever:** enforced by `tests/unit/no-tenant-id-param.test.ts`. A parameterized overload is treated as the exact shape of the tenant-substitution bug the function exists to prevent.

## Anti-Patterns

### Validating a client-submitted price against the database

**What happens:** A checkout schema that includes `unitPriceXaf`/`totalXaf` fields and "checks" them against a database read before accepting the order.
**Why it's wrong:** The comparison degrades the moment a discount, rounding rule, or currency conversion is added — and by then the check reads as legitimate in review. The field itself is the vulnerability surface.
**Do this instead:** Never accept money fields from the client at all. `PlaceOrderInput` (`src/server/orders/place.ts`) carries only ids and quantities; every price is read fresh from `ProductVariant`/`Product` inside the write transaction.

### Direct `Order.state` writes outside `transition.ts`

**What happens:** A feature module calls `order.update({ data: { state: ... } })` directly instead of going through `transitionOrder`.
**Why it's wrong:** It moves the order without writing the paired `OrderEvent`, leaving a gap in the audit trail at exactly the point a payment dispute needs it — and it bypasses `canTransition`'s legality check entirely.
**Do this instead:** Call `transitionOrder(tx, { orderId, to, actor })` from `src/server/orders/transition.ts`, always inside the same transaction as any related writes.

### Passing `tenantId` as a function/action parameter on the merchant surface

**What happens:** A helper, admin view, or background job signature grows a `tenantId` parameter "just for this one case."
**Why it's wrong:** A Server Action is reachable by direct POST without the UI ever rendering, so "the UI only ever passes the right id" is not a real property of the system — a parameterized tenant id is a bypass waiting to be called directly.
**Do this instead:** Derive tenant identity exclusively from the session (`requireMerchantContext()`, zero parameters) on the merchant surface, or from the resolved hostname (`resolveTenantBySlug`) on the anonymous storefront surface. `placeOrder(tenantId, input)` is the one documented, deliberate exception — checkout is anonymous and has no session to read from.

### Reaching for `prismaBase` or the generated Prisma client directly in feature code

**What happens:** A feature module imports `src/server/db/base.ts` or `src/generated/prisma/**` to "just run one query."
**Why it's wrong:** It bypasses the tenant-scoping extension entirely — a query built this way is unscoped by construction, and nothing about its shape flags it as dangerous in review.
**Do this instead:** Use `scopedDb(tenantId)` for tenant-scoped models, `platformDb` for registry tables, or `adminDb` only from `src/server/admin/**`. Both forbidden imports are ESLint errors (`eslint.config.mjs`), gated in CI.

## Error Handling

**Strategy:** Fail closed and fail loud. Anything genuinely unexpected propagates as a real error rather than being swallowed into a friendly-looking success or a silent default; only classifiable domain errors (validation, entitlement, read-only) are converted into a typed result the UI can render.

**Patterns:**
- Typed domain errors thrown from deep in the call stack (`EntitlementError`, `ReadOnlyError` in `src/server/entitlements/assert.ts`; `UnavailableItemError` in `src/server/orders/errors.ts`) and caught only at the boundary that knows how to present them (`merchantAction`'s `try`/`catch`, or the checkout action).
- Ambiguity is deliberate where it protects against enumeration: an unknown, suspended, or non-existent tenant/organization all resolve identically (`null` → branded not-found, or `/suspended` only when the *caller's own* session is bound to it).
- Third-party outages (Upstash Redis) degrade to a documented, logged fail-open or fail-closed posture per surface — rate limiters and the hostname cache fail open with a loud `console.warn`; a resolver database error is never swallowed.
- Retries are narrow and explicit: `placeOrder` retries exactly once, only on a unique-constraint violation (`P2002`) on the order number, and rethrows everything else immediately.

## Cross-Cutting Concerns

**Logging:** `console.warn`/`console.error` at documented degradation points (rate limiter fallback, tenant cache miss on Redis outage, unrecognized `planTier`). No structured logging framework observed.

**Validation:** Zod schemas at every Server Action boundary (`merchantAction`'s `schema` field; anonymous cart/checkout actions validate inline). Validation happens after the entitlement/write-gate check, never before, so a blocked write costs nothing.

**Authentication:** Better Auth (`src/server/auth/auth.ts`), organization plugin mapping `Organization` → tenant/store. Session read via `auth.api.getSession({ headers })`, never hand-parsed. Two identity channels only: the session cookie (dashboard) and the `Host` header (storefront) — no third path exists.

---

*Architecture analysis: 2026-08-30*
