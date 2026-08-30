<!-- GSD:project-start source:PROJECT.md -->

## Project

**EINORT-Commerce**

EINORT-Commerce is a multi-tenant commerce platform that lets Cameroonian small and medium business owners create a professional, good-looking online storefront in minutes using pre-built templates — without hiring developers or waiting months for an uncertain result. It is modeled on Shopify's product promise (Create → Customize → Publish → Sell) but is not attempting Shopify's scope or feature parity in V1. The architecture is deliberately built with a path to massive scale (eventually 100 → 1,000 → 100,000 → 1,000,000+ storefronts) in mind, but V1 itself is a 30-day, Cameroon/Douala-first, solo-built product.

**Core Value:** A merchant picks an industry, adds a logo and a few products, and within minutes has a storefront that looks like it cost them money to build. Everything else — subscriptions, dashboards, order management, the platform admin surface — exists to support that moment and to let the merchant actually run a business afterward.

### Constraints

- **Timeline**: 30 days, solo builder — governs scope; v4.0's larger feature set is trimmed to fit, not used to extend the timeline.
- **Tech stack**: Next.js (App Router) + TypeScript, PostgreSQL + Prisma, Redis, S3-compatible object storage (e.g. Cloudflare R2), Vercel + managed Postgres — chosen over a commerce framework (Vendure/Medusa) for solo-dev speed and control.
- **Payments**: No live PSP/gateway integration in V1 — manual Mobile Money/Orange Money transfer instructions + claim/verify flow + Cash on Delivery + WhatsApp order only.
- **Security**: Tenant isolation must be enforced server-side on every query, non-negotiable regardless of pilot scale. Never trust price, stock, tenant ID, or payment/order status from the client.
- **Market**: Cameroon/Douala-first; architecture stays multi-country-ready in the data model (currency/locale) without building expansion-market features.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.9.3 (pinned) - entire `src/` tree, `prisma.config.ts`, `next.config.ts`, `vitest.config.ts`
- SQL - `prisma/migrations/**/migration.sql` (raw DDL, Prisma-generated)
- JavaScript (`.mjs`) - `eslint.config.mjs`, `postcss.config.mjs`, `scripts/prisma-generate.mjs`

## Runtime

- Node.js 24 LTS (required per `README.md` prerequisites table: "`node -v` should print `v24.x`"). No `.nvmrc`/`.node-version` file present to enforce this automatically.
- Next.js server runtime is **Node.js**, not Edge, everywhere in this codebase — no route declares `export const runtime = 'edge'`. This is load-bearing: Sharp (image processing) and parts of the AWS SDK v3 used for R2 cannot run on Edge.
- npm (lockfile `package-lock.json` present, 506KB)
- Install hook: `postinstall: "node scripts/prisma-generate.mjs"` — regenerates the Prisma client into `src/generated/prisma` after every `npm install` (no-ops if no schema yet).

## Frameworks

- Next.js 16.3.1 - App Router, server actions, middleware/proxy (`src/proxy.ts`), image optimization. Dev server runs on port 3001 (`npm run dev` → `next dev --port 3001`); production/tests assume port 3000 (`NEXT_PUBLIC_ROOT_DOMAIN="localhost:3000"`).
- React 19.2.8 / react-dom 19.2.8 - UI runtime, ships with Next 16.
- Vitest 4.1.10 - two configured projects/suites (see `vitest.config.ts`): a database-free `unit` project (aliases `server-only` to a stub so pure modules under `src/server/entitlements/**` etc. can be imported) and a `isolation`/full-database project run against a dedicated Neon test branch via `TEST_DATABASE_URL`.
- Scripts: `npm run test:unit` → `vitest run tests/unit --reporter=dot`; `npm run test:full` → `dotenv -e .env.test -- vitest run` (needs `dotenv-cli` 11.0.0, a devDependency).
- ESLint 9 (flat config, `eslint.config.mjs`) + `eslint-config-next` 16.3.1 - `npm run lint` runs with `--max-warnings=0` (zero-tolerance gate). The flat config also encodes project-specific import-boundary rules (e.g. banning `@/generated/prisma*` imports outside `src/server/db/**`, `src/server/tenant/**`, `src/server/auth/**` — the TEN-02/TEN-05 tenant-isolation enforcement mechanism).
- Tailwind CSS 4 (`@tailwindcss/postcss`, `postcss.config.mjs`) - utility CSS.
- `shadcn` 4.18.0 + `components.json` - component scaffolding/config for the `src/components/ui/**` primitives (built on `@base-ui/react` 1.7.0, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `lucide-react`).
- `tsx` 4.23.12 - TypeScript execution for `prisma/seed.ts` and CLI scripts (invoked with `--conditions=react-server` in `prisma.config.ts` so `server-only`-marked modules resolve correctly during seeding).

## Key Dependencies

- `@prisma/client` 7.9.1 + `prisma` 7.9.1 - ORM/schema/migrations. Prisma 7 is Rust-free and requires an explicit driver adapter (no implicit query engine); `datasource.url` is NOT read from `schema.prisma` (deliberately absent there — see comment in `prisma/schema.prisma`) and instead configured in `prisma.config.ts`.
- `@prisma/adapter-pg` 7.9.1 + `pg` 8.23.0 - Node.js-runtime Prisma driver adapter, used everywhere at runtime (`src/server/db/base.ts`), pointed at the **pooled** Neon connection string (`DATABASE_URL`).
- `better-auth` 1.6.29 - authentication, using the `organization` plugin as the tenant primitive (`Organization` == `Store`/tenant). Configured in `src/server/auth/auth.ts`. Ships bundled `@better-auth/prisma-adapter` equivalent via `better-auth/adapters/prisma`.
- `zod` 4.4.3 - runtime validation for every server action input and for `@t3-oss/env-nextjs` env schemas.
- `@t3-oss/env-nextjs` 0.13.11 - typed/validated environment surface, single source of truth at `src/env.ts` (see INTEGRATIONS.md for full var list). Project convention: **never** read `process.env` directly outside this file (with a documented, commented exception in `next.config.ts`, which runs outside request context).
- `@aws-sdk/client-s3` 3.1116.0 + `@aws-sdk/s3-request-presigner` 3.1116.0 - S3-protocol client used against Cloudflare R2 (R2 is S3-compatible; `region: "auto"` is a required-but-ignored SDK parameter). Presigned direct-to-R2 browser uploads (`src/server/images/r2.ts`).
- `sharp` 0.35.3 - server-side image re-encoding of uploaded product/claim images. Node.js runtime only (native libvips bindings, incompatible with Edge).
- `@upstash/redis` 1.38.2 + `@upstash/ratelimit` 2.0.8 - HTTP-based Redis for tenant-hostname cache, cart cache, idempotency keys, and multiple named rate limiters (`src/server/rate-limit.ts`). Fully optional at runtime: every consumer degrades to "allow-all"/direct-DB-read with a loud `console.warn` when Upstash credentials are absent — there is deliberately no in-process fallback counter (documented as dishonest under serverless concurrency).
- `resend` 6.22.0 - transactional email SDK. Declared as an optional dependency in `src/env.ts` (`RESEND_API_KEY`, `RESEND_FROM_EMAIL` both `.optional()`) but **not yet wired into any send call** — no other source file under `src/` imports `resend` as of this analysis; it is reserved for a future proactive "payment claim received" merchant email.
- `nanoid` 6.0.1 - short unique IDs (order numbers, tracking-token generation source).
- `server-only` 0.0.1 - marker package enforcing server-only module boundaries at build time (imported as the first line of every `src/server/db/**` module).
- `react-hook-form` 7.85.0 + `@hookform/resolvers` 5.9.0 - form state paired with Zod.
- `sonner` 2.0.8 - toast notifications.

## Configuration

- All env vars validated centrally in `src/env.ts` via `@t3-oss/env-nextjs`/Zod, split into `server` and `client` (`NEXT_PUBLIC_*`) blocks, with `emptyStringAsUndefined: true` (a blank `FOO=` in a deploy dashboard is treated as missing, not as a valid empty string) and a `SKIP_ENV_VALIDATION` escape hatch for lint/typecheck/CI paths.
- Local dev secrets: `.env.local` (gitignored, real values). Template: `.env.example` (committed, placeholders + inline setup instructions per provider).
- Test env: `.env.test` (gitignored) / `.env.test.example` (committed) — carries `TEST_DATABASE_URL` only; the isolation test suite maps this into `DATABASE_URL`/`DIRECT_URL` at the Vitest-config layer (`vitest.config.ts`) so tests never silently touch the development database.
- `prisma.config.ts` loads `.env.local` then `.env` via Node's built-in `process.loadEnvFile` (not `dotenv/config` — that package is not a declared dependency); a `TEST_DATABASE_URL` present in the shell always overrides `DIRECT_URL` for migration safety.
- `next.config.ts` - derives the `next/image` remote-pattern allowlist from `R2_PUBLIC_BASE_URL`, read directly via `process.env` (not `@/env`) since this file runs outside request context and evaluating the full env schema here would be unnecessarily costly/fragile.
- `tsconfig.json` - strict mode, `@/*` path alias to `src/`.
- `postcss.config.mjs` - Tailwind 4 PostCSS plugin only.
- `components.json` - shadcn/ui generator config.

## Platform Requirements

- Node.js 24 LTS.
- A Neon Postgres branch (`DATABASE_URL` pooled + `DIRECT_URL` unpooled — same host, `DIRECT_URL` lacks `-pooler`).
- A **second**, dedicated Neon branch for tests (`TEST_DATABASE_URL`) — the isolation suite truncates/reseeds and `tests/setup/global-setup.ts` fails closed rather than falling back to the dev branch.
- Upstash Redis is optional locally (rate limiters/caches degrade loudly, never silently).
- Cloudflare R2 credentials are **required in every environment including local dev** — there is no fallback storage path for product/claim images.
- `*.localhost` wildcard DNS works with zero configuration in Chrome/Edge/Firefox (including Windows) for multi-tenant subdomain testing — no hosts-file edits needed.
- Target deployment: Vercel (implied throughout `CLAUDE.md`/code comments — e.g. Server Action body-size limits, serverless connection-pooling concerns, `x-forwarded-for` trust assumptions in `src/server/rate-limit.ts`).
- Neon managed Postgres (scale-to-zero, branch-per-PR via Vercel-Neon integration).
- Cloudflare R2 for object storage (zero egress fees).
- Upstash Redis REQUIRED in production (optional only in dev/test).

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- kebab-case for every `.ts`/`.tsx` file: `app-sidebar.tsx`, `order-state-chip.tsx`, `tenant-scoped.ts`, `variant-matrix.ts`, `store-address-field.tsx`, `no-tenant-id-param.test.ts`.
- Route segment folders use Next.js App Router conventions: `(dashboard)` route group, `[slug]` dynamic segment (`src/app/s/[slug]`), reserved files `page.tsx`, `layout.tsx`, `not-found.tsx`.
- Server-side domain modules are grouped under `src/server/<domain>/` with small, purpose-named files inside: `actions.ts` (mutations, `"use server"`), `queries.ts` (reads, `import "server-only"`), `errors.ts` (domain error classes), plus one file per narrow concern (`slug.ts`, `state-machine.ts`, `stock.ts`, `tracking-token.ts`).
- Test files mirror the unit under test by name, not by path: `tests/unit/state-machine.test.ts` tests `src/server/orders/state-machine.ts`; `tests/isolation/catalog.test.ts` tests the catalog write layer end-to-end. Static-analysis "contract" tests are named after what they assert, not what they touch: `no-tenant-id-param.test.ts`, `surface-token-isolation.test.ts`, `single-order-state-writer.test.ts`.
- camelCase, verb-first for actions and mutations: `createProduct`, `setProductActive`, `signUpMerchant`, `assertCanWrite`, `resolveVariants`.
- Boolean-returning helpers read as predicates: `canTransition`, `isUniqueViolation`, `looksLikeProse`.
- Paired boolean/throw entitlement checks share a stem: `can` / `assertEntitlement`, `limitFor` (boolean-shaped) vs `assertCanWrite` (throwing). See `src/server/entitlements/assert.ts`.
- camelCase throughout; `SCREAMING_SNAKE_CASE` reserved for true module-level constants that encode a rule or contract: `STARTER_PRODUCT_CAP`, `SUFFIX_ALPHABET`, `DEFAULT_TEST_ENDPOINTS`, `ORDER_TRANSITIONS`.
- Test fixtures use descriptive fixed identifiers instead of random ones on purpose (`tenant-a-fixed-id`, not `randomUUID()`), so a failing assertion names the leak directly. See `tests/setup/seed-two-tenants.ts`.
- PascalCase for types/interfaces: `MerchantContext`, `ActionResult<T>`, `TenantFixture`, `VariantCombination`.
- Domain error classes are PascalCase, always extend `Error`, and always set `override readonly name = "ClassName"` explicitly (a transpiled subclass otherwise reports `name: "Error"` in logs): `InvalidTransitionError`, `OutOfStockError`, `UnavailableItemError`, `AlreadyReviewedError`, `EntitlementError`, `ReadOnlyError`, `MissingTestDatabaseError`, `UnsafeSeedTargetError`.
- Discriminated-union result types are the standard shape for anything that can fail without throwing: `{ ok: true } & T | { ok: false; error: Record<string, string[]> }` (`ActionResult<T>` in `src/server/merchant/action.ts`).

## Code Style

- No Prettier config file is present in the repo (`.prettierrc*` absent). ESLint (flat config, `eslint.config.mjs`) plus `eslint-config-next` govern style. Match the two-space indentation and double-quote string style already present in every file rather than introducing a new formatter.
- `eslint.config.mjs` extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`, then layers project-specific rules on top of them.
- `npm run lint` runs `eslint . --max-warnings=0` — CI/local gate treats warnings as failures.
- `no-unused-vars` is configured to ignore identifiers with a leading underscore (`argsIgnorePattern: "^_"`, `varsIgnorePattern: "^_"`, `caughtErrorsIgnorePattern: "^_"`). Use `_` prefix for an intentionally-unused parameter (commonly a hook argument reserved for a later phase).
- **Import-zone boundaries are enforced by lint, not convention** (`eslint.config.mjs`):
- When adding a new server module that needs the unscoped client, put it inside one of the three sanctioned zones above rather than disabling the rule inline.

## Import Organization

- `@/*` maps to `./src/*` (`tsconfig.json`). Vitest does not read `tsconfig.json` paths, so the alias is re-declared per test project in `vitest.config.ts` (`resolve.alias`) — if you add a new path alias, update both files.
- `"use server"` and `import "server-only"` are mutually exclusive markers placed as the very first line of a file, before any import. `"use server"` marks a Server Actions module (every export must be an async function reachable as an endpoint); `server-only` marks a module that must never reach a client bundle (data-access, secrets-adjacent code). A factory module that builds actions for others (e.g. `src/server/merchant/action.ts`) uses `server-only`, not `"use server"`, because it exports a higher-order function, not an action itself.

## Error Handling

- Two parallel error-signaling styles, deliberately not mixed within one call path:
- The single point where the two styles meet is `merchantAction()` (`src/server/merchant/action.ts`): it catches `ReadOnlyError` and `EntitlementError` and converts them into `{ ok: false, error: { form: [message] } }`; every other thrown error rethrows uncaught rather than being swallowed into a fake validation message (an unexpected error must stay an error, visible in logs).
- Domain errors carry structured fields (not just a message) so callers can branch programmatically: `OutOfStockError.variantId`, `InvalidTransitionError.from/to/channel/detail`. Prefer adding a field over parsing `error.message`.
- Recognize a Prisma unique-constraint violation via a duck-typed helper rather than importing the generated client (`isUniqueViolation` checks `error.code === "P2002"`), consistent with the "never import `@/generated/prisma*` directly" lint rule.
- Every Server Action built with `merchantAction()` runs entitlement/write-gate checks **before** parsing the payload and **before** touching the database, so a replayed or scripted POST from an expired trial costs nothing.
- `zod` schemas validate every Server Action input. Schemas are defined near their action (module-level `const xSchema = z.object({...})`), not in a shared schema file, unless the same shape is also needed client-side — in which case the client schema imports/reuses the server one (`storeSlugSchema` reused verbatim in `signup-form.tsx`'s `signupFormSchema`) so client-time and server-time validation cannot disagree.
- Failed validation is surfaced via `z.flattenError(parsed.error).fieldErrors`.

## Logging

- `console.warn` used for recoverable/degraded-path conditions worth surfacing but not failing the request (grepped usages are `vi.spyOn(console, "warn")`-tested in `tests/unit/cart.test.ts` and `tests/unit/tracking-token.test.ts`, meaning warn-path behavior is itself under test, not just fire-and-forget).
- `console.error` + `process.exitCode = 1` for CLI/script failure paths (`tests/setup/seed-two-tenants.ts` direct-invocation entry point).
- Error class `name` is always set explicitly so Vercel/console log lines show the real error type, not `Error`.

## Comments

- Every non-trivial module opens with a substantial header comment explaining *why* the module exists, which requirement/decision ID it satisfies (e.g. `CAT-01`, `D-08`, `TEN-05`, `T-03-31` — cross-referenced against `.planning/` requirement and decision IDs), and what invariant it protects. This is the dominant style in the codebase — comments justify design decisions and warn against "obvious" wrong fixes, not restate what the code does.
- Section dividers use a consistent ASCII-line style:
- All-caps sentence-lead-ins mark load-bearing warnings that must not be casually "fixed": `THIS FILE WRITES THROUGH AN UNSCOPED CLIENT ON PURPOSE. DO NOT "FIX" IT.`, `THREE SEPARATE CALLS, NEVER A NESTED create`, `POSITIONS ARE VACATED BEFORE THEY ARE REASSIGNED.`
- Comments frequently cite the specific decision/task ID that motivates a piece of logic (e.g. `D-08 forbids removal`, `T-03-30`, `SUB-01`) so a reader can trace code back to `.planning/` requirements.
- `/** ... */` doc comments precede nearly every exported function, type, and class, explaining purpose and any non-obvious constraint — not auto-generated boilerplate, always specific to the "why."

## Function Design

## Module Design

## Project-Specific Rules (from CLAUDE.md, binding on all new code)

- **Tenant isolation is enforced structurally, not by convention.** Never call the raw Prisma client from `src/**` outside the sanctioned zones; always go through `scopedDb(tenantId)`, `platformDb`, or `adminDb`. Never trust a `tenantId`, price, stock, or order/payment status supplied by the client.
- **No hard deletes for merchant-owned catalog data (D-08).** "Remove from store" means `setProductActive(false)`, never a Prisma `delete`. Variant/image rows dropped from a product are marked inactive/parked, never removed, because an `OrderItem` may still reference them.
- **UI copy is centralized** in `src/lib/strings.ts`, one namespace per surface. Never inline a user-facing string literal in a component — `tests/unit/dashboard-nav.test.ts` and similar contract tests scan `.tsx` source for prose-shaped string literals and fail the build if one is found outside `strings`.
- **Sharp/image-processing code must run in the Node.js runtime**, never `export const runtime = "edge"`.
- **Currency/number formatting** uses `Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF" })` directly — no currency library.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- Multi-tenant SaaS with tenant identity derived from two untrusted-free channels only: the `Host` header (storefront) and the signed session cookie (dashboard) — never from a client-supplied id, path parameter, or form field.
- Tenant isolation enforced structurally by a Prisma Client Extension (`scopedDb`), not by convention — an unregistered model throws rather than running unscoped.
- Three-tier database client separation (`scopedDb` / `platformDb` / `adminDb`), each with its own ESLint-enforced import zone, so a call site's access level is visible at the import statement.
- "Fail closed" is a repeated, explicit design rule across the resolver (`resolveTenantBySlug`), the classifier (`classifyHost`), and the merchant DAL (`requireMerchantContext`): anything not certainly valid resolves to `null`/404/redirect, never to a best-guess default.
- Financial values are never trusted from the client and never joined from live catalog data at read time on an order — every order line snapshots `productName`, `variantLabel`, `unitPriceXaf`, and `imageKey` at placement so a later price/name change cannot retroactively alter a placed order.
- Order state is a single authoritative table (`ORDER_TRANSITIONS`) plus one predicate (`canTransition`), and exactly one module (`transition.ts`) is permitted to write `Order.state` — enforced by a source-scanning test (`tests/unit/single-order-state-writer.test.ts`).
- V1 has no live payment gateway: payment is manual Mobile Money/Orange Money transfer + a merchant-reviewed claim flow, or WhatsApp/cash-on-delivery outside the payment state machine entirely.
- Extensive block-comment "why" documentation is a first-class codebase convention — most non-trivial modules carry a multi-paragraph rationale header referencing internal decision IDs (`TEN-02`, `D-08`, `T-03-34`, etc.) from planning documents.

## Layers

- Purpose: classify inbound hostnames and rewrite storefront subdomains into the internal `/s/{slug}` route tree; strip any client-forged tenant headers.
- Location: `src/proxy.ts` (Next 16's renamed `middleware.ts`), `src/server/tenant/host.ts`
- Contains: pure functions only — no Prisma, no Redis, no `@/env` import (env is read once via a raw `process.env` reference at module scope, not through the validated `@/env` module).
- Depends on: nothing but a static reserved-slugs list.
- Used by: every request; the only inputs downstream layers can trust for tenant identity are the rewritten `/s/{slug}` path and the (stripped) forwarded headers.
- Purpose: route-level layouts, pages, and client islands for three route trees — apex marketing/auth (`src/app/(dashboard)`, `login`, `signup`, `onboarding`), the storefront (`src/app/s/[slug]`), and the Better Auth catch-all API (`src/app/api/auth/[...all]`).
- Location: `src/app/**`
- Contains: Server Components (default), a small number of Client Components (forms, interactive cart/product widgets), layouts.
- Depends on: `src/server/**` for all data access and mutation; `src/components/**` for UI primitives.
- Used by: end users (merchants via the dashboard, anonymous shoppers via the storefront).
- Purpose: all business rules, all database/cache/storage access, all Server Actions.
- Location: `src/server/**`, organized by domain (`auth`, `cart`, `catalog`, `claims`, `db`, `entitlements`, `idempotency`, `images`, `merchant`, `orders`, `payments`, `storefront`, `tenant`) plus `src/server/rate-limit.ts`.
- Depends on: Prisma (through the three DB-client facades only), Upstash Redis, Cloudflare R2 (via AWS SDK v3), Better Auth, Sharp.
- Used by: `src/app/**` pages/layouts and their co-located Server Action files (e.g. `create-store-form.tsx` calling into `src/server/tenant/actions.ts`).
- Purpose: the single sanctioned door to Postgres, split into three access levels by trust boundary rather than by domain.
- Location: `src/server/db/base.ts` (raw client), `src/server/db/tenant-scoped.ts` (`scopedDb`), `src/server/db/platform.ts` (`platformDb`), `src/server/db/admin.ts` (`adminDb`), `src/server/db/enums.ts`, `src/server/db/model-inputs.ts`.
- Contains: the Prisma Client Extension, the `TENANT_SCOPED_MODELS` registry, type helpers (`ScopedDb`, `ScopedTx`, `ScopedCreateData`).
- Depends on: `src/generated/prisma/**` (the Prisma 7 generated client — never imported directly outside this layer).
- Used by: every domain module in `src/server/**` except the admin surface, which uses `adminDb` exclusively.
- Purpose: Prisma 7's generated (Rust-free) client output.
- Location: `src/generated/prisma/**`
- Contains: `PrismaClient`, model types, enums. Never hand-edited; regenerated via `scripts/prisma-generate.mjs` (the `postinstall` hook).
- Depends on: `prisma/schema.prisma`.
- Used by: exclusively `src/server/db/**` — an ESLint rule (`no-restricted-imports` on `**/generated/prisma*`) blocks any other import path.

## Data Flow

### Storefront request (subdomain hostname resolution)

### Merchant dashboard request (session-derived tenant)

### Order placement (checkout)

- Server-authoritative for everything financial and tenant-scoped (orders, stock, catalog, entitlements) — no client-trusted state ever reaches a write.
- Client-side ephemeral state: cart is a Redis blob keyed by an opaque, host-scoped, `httpOnly` cookie (no `domain` attribute — cross-tenant cookie leakage is structurally prevented). The cart is explicitly *not* an `Order` row; the first persisted order state is `ORDER_PLACED`.
- Order lifecycle state lives entirely in Postgres (`Order.state`), governed by the pure `ORDER_TRANSITIONS` table and written exclusively through `src/server/orders/transition.ts`.
- Trial/entitlement state is never stored (no `isExpired` column) — always derived from `(organization row, now)` by `resolveEntitlements`.

## Key Abstractions

- Purpose: make the trust boundary of every database call visible at the import site rather than at the call site.
- Examples: `src/server/db/tenant-scoped.ts` (`scopedDb`), `src/server/db/platform.ts` (`platformDb`), `src/server/db/admin.ts` (`adminDb`)
- Pattern: Prisma Client Extension for `scopedDb` (auto-stamps/filters by `tenantId` on every operation for a registered model, throws for unregistered ones); getter-based allowlist facade for `platformDb`; raw passthrough with an ESLint-only boundary for `adminDb`.
- Purpose: make the "safe" Server Action (identity-checked, entitlement-gated, schema-validated) the path of least resistance, since Next has no framework-level pre-action hook.
- Examples: `src/server/merchant/action.ts`; consumed throughout `src/server/catalog/actions.ts`, `src/server/orders/actions.ts`, `src/app/(dashboard)/dashboard/**`
- Pattern: higher-order factory — `merchantAction({ mode: "read"|"write", schema, handler })` returns an async function taking raw unknown input, resolving context first, refusing writes before parsing, then Zod-parsing and dispatching to the typed handler.
- Purpose: express legality rules as an inspectable/testable value rather than scattered conditionals, applied consistently across the order lifecycle, tenant model registry, and plan tiers.
- Examples: `src/server/orders/state-machine.ts` (`ORDER_TRANSITIONS`, `canTransition`), `src/server/db/tenant-scoped.ts` (`TENANT_SCOPED_MODELS`), `src/server/entitlements/plans.ts` (`PLANS`)
- Pattern: `Readonly<Record<EnumType, ...>>` typed against the full enum so an added enum member is a compile error until the table is updated.
- Purpose: an order is a record of a past event, not a live view — later catalog changes must never retroactively alter what a customer was charged or shown.
- Examples: `src/server/orders/place.ts` (`OrderItem.productName`, `.variantLabel`, `.unitPriceXaf`, `.imageKey`)
- Pattern: copy denormalized values onto the child row at transaction time instead of joining to the live parent at read time.
- Purpose: let a new image surface (logo, claim screenshot, product photo) become a data row rather than a new function.
- Examples: `src/server/images/pipeline.ts` (`IMAGE_PRESETS`)
- Pattern: one object literal per surface (`sizes`, `labels`, `fit`, `ratio`, `format`) consumed by a single `processImage(input, preset)` function.

## Entry Points

- Location: `src/proxy.ts`
- Triggers: every request except `_next/static`, `_next/image`, `favicon.ico`, `robots.txt`, `sitemap.xml` (see `config.matcher`)
- Responsibilities: hostname classification, subdomain-to-`/s/{slug}` rewrite, forged-header stripping, hard 404 on any direct `/s/*` request.
- Location: `src/app/layout.tsx`
- Triggers: every page render
- Responsibilities: font loading (Plus Jakarta Sans body, Outfit heading), global metadata template (`"%s · EINORT"`).
- Location: `src/app/(dashboard)/layout.tsx`
- Triggers: any apex-hostname request under the dashboard route group (unreachable from a storefront subdomain — the proxy rewrite makes `/dashboard` 404 under `/s/{slug}/dashboard`)
- Responsibilities: sidebar shell, trial banner, sign-out control. Explicitly NOT the auth boundary.
- Location: `src/app/s/[slug]/layout.tsx`
- Triggers: every rewritten storefront request
- Responsibilities: the tenant existence/active-status gate (IS the auth boundary for this subtree), storefront palette scoping via `data-surface="storefront"`.
- Location: `src/app/api/auth/[...all]/route.ts`
- Triggers: all Better Auth HTTP traffic (sign-in, sign-up, session, organization plugin endpoints)
- Responsibilities: delegates entirely to the Better Auth handler configured in `src/server/auth/auth.ts`. Reachable only apex-side (the proxy rewrite makes it 404 under any storefront subdomain).
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

### Direct `Order.state` writes outside `transition.ts`

### Passing `tenantId` as a function/action parameter on the merchant surface

### Reaching for `prismaBase` or the generated Prisma client directly in feature code

## Error Handling

- Typed domain errors thrown from deep in the call stack (`EntitlementError`, `ReadOnlyError` in `src/server/entitlements/assert.ts`; `UnavailableItemError` in `src/server/orders/errors.ts`) and caught only at the boundary that knows how to present them (`merchantAction`'s `try`/`catch`, or the checkout action).
- Ambiguity is deliberate where it protects against enumeration: an unknown, suspended, or non-existent tenant/organization all resolve identically (`null` → branded not-found, or `/suspended` only when the *caller's own* session is bound to it).
- Third-party outages (Upstash Redis) degrade to a documented, logged fail-open or fail-closed posture per surface — rate limiters and the hostname cache fail open with a loud `console.warn`; a resolver database error is never swallowed.
- Retries are narrow and explicit: `placeOrder` retries exactly once, only on a unique-constraint violation (`P2002`) on the order number, and rethrows everything else immediately.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
