# Codebase Structure

**Analysis Date:** 2026-08-30

## Directory Layout

```
einort-commerce/
├── prisma/
│   ├── schema.prisma        # Single shared-schema data model (all tenants)
│   ├── seed.ts               # Dev seed script
│   └── migrations/           # Timestamped SQL migrations (Prisma 7)
├── scripts/
│   └── prisma-generate.mjs   # Runs on `postinstall`; regenerates src/generated/prisma
├── src/
│   ├── app/                  # Next.js App Router — routes, layouts, route handlers
│   │   ├── (dashboard)/       # Route GROUP (no URL segment) — apex merchant dashboard
│   │   │   └── dashboard/       # Actual /dashboard/* URL segment, inside the group
│   │   ├── api/                # Route Handlers (non-Server-Action HTTP endpoints)
│   │   │   ├── auth/[...all]/    # Better Auth catch-all
│   │   │   └── upload/finalize/  # R2 upload finalize
│   │   ├── login/, signup/     # Apex auth pages
│   │   ├── onboarding/         # create-store, plan-selection flows
│   │   ├── s/[slug]/           # Storefront route tree (rewrite target of src/proxy.ts)
│   │   │   └── p/[productSlug]/  # Product detail page
│   │   ├── store-not-found/    # Branded 404 for unresolved/suspended tenants
│   │   ├── suspended/          # Shown to a merchant whose own org is suspended
│   │   ├── layout.tsx          # Root layout (fonts, metadata template)
│   │   ├── globals.css         # Tailwind v4 + design-token CSS (dual palette)
│   │   └── page.tsx             # Apex landing page
│   ├── components/
│   │   └── ui/                 # shadcn/ui primitives (base-nova style, zinc base)
│   ├── generated/prisma/       # Prisma 7 generated client — NEVER hand-edited or imported outside src/server/db/**
│   ├── hooks/                  # Shared React hooks (e.g. use-mobile.ts)
│   ├── lib/                    # Small framework-agnostic utilities (strings, cn())
│   ├── server/                 # ALL business logic + data access, by domain
│   │   ├── admin/                # (not yet built — platform admin surface, see below)
│   │   ├── auth/                  # Better Auth instance + login/signup actions
│   │   ├── cart/                  # Cart Server Actions + Redis cache
│   │   ├── catalog/               # Product/category/variant CRUD + storefront reads
│   │   ├── claims/                # Payment-claim queries
│   │   ├── db/                    # The data-access wall: base/scoped/platform/admin clients
│   │   ├── entitlements/          # Plan tiers, trial resolver, write-gate assertions
│   │   ├── idempotency/           # Redis-backed dedupe for retried mutations
│   │   ├── images/                # Sharp pipeline + R2 client
│   │   ├── merchant/              # requireMerchantContext() DAL + merchantAction() wrapper
│   │   ├── orders/                # Placement, state machine, transitions, stock, tracking
│   │   ├── payments/               # Manual-transfer settings, phone/USSD/WhatsApp helpers
│   │   ├── storefront/             # Storefront-facing read queries
│   │   ├── tenant/                 # Hostname classification, resolution, cache, slugs
│   │   └── rate-limit.ts          # Upstash-backed sliding-window limiters (flat file)
│   ├── env.ts                   # @t3-oss/env-nextjs validated environment schema
│   └── proxy.ts                 # Next 16 Proxy (formerly middleware.ts) — hostname routing
├── tests/
│   ├── unit/                  # Database-free, pure-function tests (vitest "unit" project)
│   ├── isolation/             # Real-Postgres two-tenant isolation tests ("isolation" project)
│   ├── fixtures/               # Static test assets (e.g. sample-product.jpg)
│   └── setup/                  # Global setup, two-tenant seeding for the isolation project
├── .env.local, .env.test       # Local/test environment values (never committed contents)
├── eslint.config.mjs           # Flat config; also encodes the import-zone security boundaries
├── vitest.config.ts            # Two-project split: unit (fast, no DB) vs isolation (real Neon branch)
├── prisma.config.ts             # Prisma 7 driver-adapter + connection config (replaces schema.prisma datasource.url)
├── components.json              # shadcn/ui config (base-nova style, zinc base color)
└── CLAUDE.md                    # Project brief, stack rationale, conventions, architecture notes
```

## Directory Purposes

**`src/app/`:**
- Purpose: routing, layouts, and the thin presentation layer. Server Components by default.
- Contains: `page.tsx`/`layout.tsx` per route, co-located Client Components (e.g. `login-form.tsx`, `add-to-cart.tsx`), co-located small helpers (`format.ts`, `slug-status.ts`).
- Key files: `src/app/layout.tsx` (root), `src/app/(dashboard)/layout.tsx` (dashboard shell, NOT auth boundary), `src/app/s/[slug]/layout.tsx` (storefront shell, IS the auth boundary).

**`src/app/(dashboard)/`:**
- Purpose: route GROUP — the parentheses mean it adds no URL segment. Everything here is apex-hostname-only; it is unreachable from a merchant subdomain because `src/proxy.ts` rewrites subdomain traffic under `/s/{slug}`, where no matching route exists (structural, not an added check).
- Contains: `dashboard/` (the actual `/dashboard` URL segment and its children: `orders/`, `products/`, `plan/`, `settings/payment/`).

**`src/app/s/[slug]/`:**
- Purpose: the storefront route tree — the internal rewrite target of every `{slug}.einort.com` request. Never a URL a visitor types directly (the proxy 404s a direct `/s/*` request from the apex).
- Contains: `layout.tsx` (tenant gate), `page.tsx` (storefront home), `p/[productSlug]/` (product detail + `add-to-cart.tsx`), `store-header.tsx`.

**`src/server/`:**
- Purpose: every business rule and every I/O operation in the codebase. If it touches Prisma, Redis, R2, or Better Auth, it lives here — `src/app/**` never imports these clients directly.
- Contains: one subdirectory per domain concept (not per Prisma model) — e.g. `orders/` covers placement, transitions, stock, and tracking tokens together, because those are one lifecycle.
- Key files: `db/tenant-scoped.ts` (the tenant guarantee), `merchant/context.ts` (session→tenant DAL), `merchant/action.ts` (write-gate factory), `tenant/host.ts` + `tenant/resolve.ts` (hostname→tenant).

**`src/server/db/`:**
- Purpose: the sole data-access wall. Three client "shapes" for three trust levels.
- Contains: `base.ts` (raw client, import-restricted), `tenant-scoped.ts` (`scopedDb`), `platform.ts` (`platformDb`), `admin.ts` (`adminDb`), `enums.ts` (re-exported Prisma enums as types, the sanctioned door for enum imports), `model-inputs.ts` (narrowed create-input types for `scopedCreateData`).
- Key files: `tenant-scoped.ts` — read this first when touching any tenant-scoped table.

**`src/server/admin/`:**
- Not yet populated (Phase 6 territory per in-code comments). Reserved and lint-fenced ahead of time: `eslint.config.mjs` already forbids this zone from importing `src/server/db/tenant-scoped`, and forbids everywhere else from importing `src/server/db/admin`. Build platform-admin features here when that phase starts.

**`src/generated/prisma/`:**
- Purpose: Prisma 7's generated (Rust-free) client output — models, enums, runtime.
- Generated: Yes, via `prisma generate` (wired to `npm run postinstall` → `scripts/prisma-generate.mjs`).
- Committed: check `.gitignore`, but treat as build output regardless — never hand-edit, and ESLint (`no-restricted-imports` on `**/generated/prisma*`) blocks importing it from anywhere except `src/server/db/**`.

**`src/components/ui/`:**
- Purpose: shadcn/ui primitives, installed via the `shadcn` CLI (`components.json`, style `base-nova`, base color `zinc`, icon library `lucide`).
- Contains: unmodified-or-lightly-modified shadcn component files (button, dialog, sheet, sidebar, table, etc.). Treat as vendored — prefer composing over editing.
- Not here: feature-specific components (`app-sidebar.tsx`, `order-state-chip.tsx`) live one level up in `src/components/`, not `src/components/ui/`.

**`tests/unit/`:**
- Purpose: fast, database-free tests of pure functions (state machine, entitlements resolver, slug/phone/USSD formatting, order-number generation).
- Naming: `{module-under-test}.test.ts`, mirroring the `src/server/**` module it exercises.
- Run via `npm run test:unit` (`vitest run tests/unit --reporter=dot`).

**`tests/isolation/`:**
- Purpose: real-Postgres, two-tenant behavioral proofs of the tenant-isolation guarantee — the actual evidence behind `scopedDb`'s claims (cross-tenant writes/reads, entitlement enforcement, order actions, plan selection).
- Run via `npm run test:full` (`dotenv -e .env.test -- vitest run`), against a dedicated Neon test branch.
- Setup: `tests/setup/seed-two-tenants.ts` seeds two isolated tenants in dependency order matching `TENANT_SCOPED_MODELS`' insertion order (load-bearing — re-sorting that array breaks the seed).

## Key File Locations

**Entry Points:**
- `src/proxy.ts`: hostname classification + subdomain rewrite (runs on nearly every request)
- `src/app/layout.tsx`: root HTML shell, fonts, metadata
- `src/app/api/auth/[...all]/route.ts`: Better Auth HTTP surface
- `src/app/api/upload/finalize/route.ts`: R2 upload finalize + image derive trigger

**Configuration:**
- `src/env.ts`: validated environment schema (`@t3-oss/env-nextjs`) — the canonical list of required env vars
- `prisma.config.ts`: Prisma 7 driver-adapter config (pooled vs direct Postgres URL)
- `eslint.config.mjs`: linting rules AND the tenant-isolation import-boundary enforcement (read this to understand what code is allowed to import what)
- `vitest.config.ts`: two-project test split (unit vs isolation)
- `components.json`: shadcn/ui generation config

**Core Logic:**
- `src/server/db/tenant-scoped.ts`: the tenant-isolation guarantee itself
- `src/server/orders/place.ts`: order placement (price re-read, stock hold, snapshotting)
- `src/server/orders/state-machine.ts`: order lifecycle legality rules
- `src/server/merchant/context.ts`: session→tenant identity derivation
- `src/server/merchant/action.ts`: the merchant write-gate wrapper
- `src/server/tenant/resolve.ts` + `src/server/tenant/host.ts`: hostname→tenant resolution
- `src/server/entitlements/resolve.ts` + `src/server/entitlements/plans.ts`: plan/trial logic

**Testing:**
- `tests/unit/`: pure-function tests, no database
- `tests/isolation/`: real-database, two-tenant isolation tests
- `tests/setup/`: global setup + seeding shared by the isolation project

## Naming Conventions

**Files:**
- kebab-case for nearly all TypeScript files (`tenant-scoped.ts`, `app-sidebar.tsx`, `order-row-actions.tsx`).
- The only PascalCase files in the tree are Prisma-generated model files under `src/generated/prisma/models/` (e.g. `Product.ts`, `Organization.ts`) — generated output, not a convention to follow elsewhere.
- Server Action modules are often named `actions.ts` (plural, multiple actions) vs `action.ts` (singular, one exported factory — e.g. `src/server/merchant/action.ts`). Check the file's actual exports rather than assuming from the name alone.
- Test files: `{unit-under-test}.test.ts`, one-to-one with the source module where practical (`state-machine.ts` → `state-machine.test.ts`).

**Directories:**
- `src/server/**` is organized by domain concept (`orders`, `cart`, `catalog`, `tenant`), not by technical layer (no `controllers/`, `services/`, `repositories/` split) and not strictly one-to-one with Prisma models — a domain folder can span several related models and non-model concerns together.
- Route groups use parentheses per Next.js convention: `(dashboard)` adds no URL segment.
- Dynamic route segments use bracket syntax: `[slug]`, `[productSlug]`, `[id]`, `[...all]` (catch-all).

## Where to Add New Code

**New merchant-facing feature (dashboard):**
- Server logic: new file or new domain folder under `src/server/{domain}/actions.ts`, using `merchantAction()` from `src/server/merchant/action.ts` for every write.
- Route: `src/app/(dashboard)/dashboard/{feature}/page.tsx`, following the existing `products/`, `orders/`, `settings/payment/` pattern (list page + `loading.tsx` + co-located row-action client component).
- Tests: a pure-logic unit test under `tests/unit/`; if the feature has cross-tenant implications, add an isolation test under `tests/isolation/`.

**New storefront-facing feature:**
- Server logic: `src/server/{domain}/` or `src/server/storefront/queries.ts` for reads; remember the tenant must be resolved per-call (`resolveTenantBySlug` or a passed-in `tenantId` from an already-resolved layout), never assumed from a session.
- Route: under `src/app/s/[slug]/`, inheriting the tenant gate from `src/app/s/[slug]/layout.tsx` automatically.
- Respect the surface palette boundary: storefront pages must use the ordinary semantic Tailwind utilities (`bg-background`, `text-foreground`) — never a literal `bg-zinc-*`/`text-slate-*` utility — enforced by `tests/unit/surface-token-isolation.test.ts`.

**New database model:**
- Add to `prisma/schema.prisma`, run a migration, regenerate the client (`postinstall` hook or manual `prisma generate`).
- If the model carries a `tenantId` column, add its name to `REGISTERED_MODELS` in `src/server/db/tenant-scoped.ts` — deliberately, in FK dependency order — or every query against it will throw at runtime. If it does not carry `tenantId` (a registry/auth table), add a getter to `platformDb` in `src/server/db/platform.ts` instead.

**New external integration (payment gateway, SMS, etc.):**
- New subdirectory under `src/server/{integration-name}/`, mirroring the existing `payments/`, `images/` pattern (a thin client module plus an `actions.ts` for the write paths that touch it).
- Add required credentials to `src/env.ts`'s validated schema before use — do not read `process.env` ad hoc outside `src/proxy.ts` (which has a documented, deliberate exception).

**Shared UI:**
- Generic/vendored primitives: `src/components/ui/` via the `shadcn` CLI.
- Feature-agnostic but app-specific components (nav, badges, chips): `src/components/` directly (see `app-sidebar.tsx`, `order-state-chip.tsx`).
- Route-specific components: co-located next to the page that uses them (e.g. `src/app/s/[slug]/store-header.tsx`, `src/app/(dashboard)/dashboard/orders/order-row-actions.tsx`) rather than centralized.

**Utilities:**
- Framework-agnostic helpers: `src/lib/` (currently `strings.ts` for centralized copy, `utils.ts` for `cn()` and similar).
- Server-only cross-domain helpers (rate limiting): flat files directly under `src/server/` when they don't warrant a subdirectory (`src/server/rate-limit.ts`).

## Special Directories

**`src/generated/prisma/`:**
- Purpose: Prisma 7 generated client output.
- Generated: Yes (`prisma generate`, run automatically via `postinstall`).
- Committed: Not intended to be hand-edited regardless of `.gitignore` status; import-restricted to `src/server/db/**` by ESLint.

**`.next/`:**
- Purpose: Next.js build output.
- Generated: Yes.
- Committed: No.

**`.claude/worktrees/`:**
- Purpose: GSD executor agent worktrees, each with its own `.next` build output.
- Generated: Yes (created by the agent workflow, not by `next build`).
- Committed: Excluded from lint via `globalIgnores` in `eslint.config.mjs`.

**`prisma/migrations/`:**
- Purpose: timestamped SQL migration history, one directory per migration (e.g. `20260817013504_init_tenant_foundations`).
- Generated: Yes (`prisma migrate dev`/`deploy`), but the SQL itself is committed and treated as an append-only historical record — never edited after the fact.
- Committed: Yes.

---

*Structure analysis: 2026-08-30*
