# Walking Skeleton — EINORT-Commerce

**Phase:** 1 (01-multi-tenant-foundations-domain-resolution)
**Generated:** 2026-08-16

> This file records the architectural decisions every later vertical slice builds on. It is a contract, not a scratchpad. Phases 2-6 add slices on top of it without renegotiating what is below.

## Capability Proven End-to-End

A prospective merchant signs up on the root domain with an email, a password and a store address they choose themselves, and immediately lands on their own live storefront at `{their-slug}.einort.com` — resolved server-side from the request hostname, backed by a real database read, with cross-tenant access structurally blocked by a centralized data-access layer and proven by an automated two-tenant test suite.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.3.1, App Router, React 19.2, TypeScript 7.0.2 | Locked by CLAUDE.md C-3. Next 16 is dynamic-by-default (Cache Components are opt-in), which is the tenant-safe posture — a cached shell can never leak across tenants unless someone deliberately opts in. |
| Request interception | `proxy.ts` at the repo root, exporting `proxy`, Node.js runtime | Next 16 renamed `middleware.ts` to `proxy.ts`; the old convention is deprecated and slated for removal. Setting `export const runtime` inside a Proxy file throws. **No `middleware.ts` may ever be created in this repo.** |
| Tenant identity (storefront) | Two-stage: pure zero-I/O `classifyHost()` in `proxy.ts` -> URL rewrite to `/s/{slug}/...` -> cached `resolveTenantBySlug()` in the storefront layout | The `x-tenant-id` header pattern that most tutorials teach is client-spoofable. A server-generated rewritten path is un-forgeable. The Proxy stays free of the ORM, which the Next 16 Proxy docs explicitly call for. |
| Internal route prefix | `/s/{slug}` — 404'd unconditionally as the first statement of `proxy.ts` | The rewrite target is an ordinary filesystem route. Without the guard, a tenant storefront renders on the apex, inside the platform cookie scope. |
| Data layer | PostgreSQL 17 on Neon, Prisma 7.9.1 with `@prisma/adapter-pg` against the **pooled** connection string | Prisma 7 has no implicit query engine — an explicit driver adapter is mandatory and `datasource.url` lives in `prisma.config.ts`, not `schema.prisma`. Generated client output is `src/generated/prisma` (gitignored). |
| Multi-tenancy model | Shared schema; required, indexed `tenantId String` (no default) on every tenant-scoped table | Schema-per-tenant and database-per-tenant cannot reach the project's stated 2,000,000-store target. `tenantId` required-with-no-default turns a nested-write bypass into a loud failure instead of a silent NULL. |
| Tenant-scoped access | `scopedDb(tenantId)` — a single Prisma Client Extension over `$allModels.$allOperations`, gated by a `TENANT_SCOPED_MODELS` allowlist that **throws** for unregistered models | All 14 model operations are verified intercepted. `tenantId` is injected last in every spread, so a caller-supplied value is overwritten, never merged. `findUnique` is NOT rewritten to `findFirst` — that workaround is obsolete since Prisma 5. |
| Data-access client taxonomy | Four clients: `prismaBase` (singleton), `scopedDb(tenantId)` (tenant-scoped, the only sanctioned path), `platformDb` (non-tenant-scoped registry reads: organization, user, member, session), `adminDb` (deliberately unscoped, `src/server/admin/**` only) | TEN-02 and TEN-05 are not achievable by convention on a solo AI-assisted build. Boundaries are ESLint `no-restricted-imports` zones, so a violation is a build failure. `$queryRaw`/`$executeRaw` are lint-banned repo-wide — they are verified NOT intercepted by the extension. |
| Auth | Better Auth 1.6.29, self-hosted, via `@better-auth/prisma-adapter` into the same Postgres | Auth.js is in maintenance mode; Clerk's per-MAU model is wrong for an accountless-checkout product. Better Auth's `organization` plugin is a near-exact primitive match for "tenant". |
| Tenant primitive | Better Auth `Organization` IS the tenant. `tenantId` holds `organization.id`. No separate `Tenant` table. | `organization` already carries `slug @unique`, `metadata`, `additionalFields` and lifecycle hooks. Revisit a split at Phase 4 only if tenant fields grow far beyond auth concerns. |
| Tenant provisioning | System action: `auth.api.createOrganization({ body: { ..., userId } })` with **no** `headers`, under `allowUserToCreateOrganization: false` and `organizationLimit: 1` | The system-action path is the only route to store creation, so no merchant can mint extra stores through the public API. `organizationLimit: 1` also applies to system actions, which makes a retried signup idempotent. |
| Platform Super Admin | A `platformRole` string field on `User` (`input: false`, default `merchant`), checked in middleware/server actions | CLAUDE.md C-8. The Better Auth `admin` plugin is deliberately NOT adopted in V1 — a single owner login does not justify it. Revisit if staff accounts beyond the owner are ever added. |
| Suspension | `organization.status` additionalField (`input: false`, default `active`) | `input: false` keeps suspension a platform-admin-only write with no public API surface. A suspended store is indistinguishable from a never-claimed one to anonymous visitors (D-05) — an explicit anti-enumeration decision. |
| Slug rename safety | Slug is a mutable column on `organization`; `tenantId` foreign keys point at the stable `organization.id`. `StoreSlugHistory` (tenant-scoped, `slug` globally unique) records every claim. | A rename is one UPDATE plus a cache invalidation — no data migration. The history table blocks re-issuing a released slug to a different merchant, which would otherwise hand over inbound links, QR codes and WhatsApp shares. |
| Cache | Upstash Redis over HTTP, key namespace `tenant:host:*` only, positive TTL 300s and **negative** TTL 60s, invalidate-on-write | HTTP-based, so no connection-pooling problem from serverless. Negative caching is not optional: with a wildcard domain, a subdomain scan is otherwise an unauthenticated path to exhausting the Neon connection pool. Degrades to a loud no-op when unconfigured. |
| Session cookies | Better Auth defaults — host-only on the apex. `advanced.crossSubDomainCookies` is **never** enabled; `advanced.cookiePrefix` is set. | Signup, login and the dashboard all live on the apex (D-07), so a host-only cookie is never sent to `*.einort.com`. Enabling cross-subdomain cookies would expose the platform session to every merchant-controlled storefront. |
| Validation | Zod 4.4.3 on every server action input | CLAUDE.md C-9. Zod v4's error-map API and inference internals differ from v3 — v3 snippets must not be pasted. |
| Env config | `@t3-oss/env-nextjs`, validated at boot, every key enumerated literally in `runtimeEnv` | A missing `NEXT_PUBLIC_ROOT_DOMAIN` silently classifies every host as root and takes every storefront offline. It must fail at boot, not at first use. |
| Deployment target | Vercel, one project, apex `einort.com` plus wildcard `*.einort.com` on Vercel nameservers | With the wildcard domain, provisioning a store is a database row: no per-tenant SDK call, no DNS write, no certificate step, nothing asynchronous. Wildcard TLS silently fails to issue if the apex is not on Vercel nameservers, so the registrar change comes first. |
| Testing | Vitest 4.1.10, two projects: `unit` (node, no DB, <2s) and `isolation` (node, dedicated Neon branch `einort-test`, `globalSetup` runs `prisma migrate deploy` + a two-tenant seed) | Docker and local Postgres are both absent on this machine, so Testcontainers is not an option. Isolation tests are model-generic over `TENANT_SCOPED_MODELS`, with a schema-drift guard built on `Prisma.ModelName` + `Prisma.<Model>ScalarFieldEnum` (`Prisma.dmmf` was removed in Prisma 7). |
| UI system | shadcn CLI (`--base base`, `--css-variables`), Tailwind v4, zinc OKLCH tokens plus one added `--success` token, Plus Jakarta Sans (400/600 only), lucide icons | Governed by `01-UI-SPEC.md`. No third-party shadcn registry is authorized. Dark mode is not implemented in V1. |
| Directory layout | `proxy.ts` and `prisma.config.ts` at root; `src/app/**` routes; `src/server/db/**`, `src/server/tenant/**`, `src/server/auth/**`, `src/server/admin/**` as lint-fenced zones; `tests/{unit,isolation,setup}/**` | The `src/server/*` split is what the ESLint import zones key off. Moving a module between these directories changes its privileges — treat the layout as load-bearing. |

## Stack Touched in Phase 1

- [x] Project scaffold — Next 16 + TS 7 + Tailwind v4 + shadcn, ESLint flat config with import zones, Vitest two-project harness (plan 01)
- [x] Routing — `proxy.ts` host classification and rewrite, `/`, `/signup`, `/s/[slug]`, `/store-not-found`, `/onboarding/create-store`, `/api/auth/[...all]` (plans 01, 03, 05, 06, 07)
- [x] Database — real read (`resolveTenantBySlug` -> `platformDb.organization.findUnique`) AND real write (signup -> organization + member + `scopedDb(...).storeSlugHistory.create`) (plans 02, 05, 06)
- [x] UI — interactive element wired to the API: the `/signup` store-address field debounce-calls the `checkStoreSlug` server action and gates submission on its answer (plan 07)
- [x] Deployment — documented full-stack local run in `README.md` including `*.localhost` multi-tenant verification and a `next build && next start` production-mode smoke check; Vercel wildcard-domain setup declared as one-time human setup in plan 07 (plan 07)

## Out of Scope (Deferred to Later Slices)

Explicitly NOT in the skeleton. These are recorded so future phases do not re-litigate Phase 1's minimalism.

- Merchant login page, dashboard, and session-derived tenant context (TEN-04) — Phase 2
- Subscription tiers, entitlements, and the 10-day trial enforcement — Phase 2
- Product catalog, cart, checkout, orders, payment claims, stock — Phase 3
- Theme -> Page -> Section -> Block system, the flagship template, onboarding (business name, industry, logo, brand colors) — Phase 4
- Template segment expansion — Phase 5
- Merchant dashboard and the Super Admin surface, including the store-suspension UI that will call `invalidateTenantHost` — Phase 6
- Custom domain connection beyond the EINORT subdomain — tracked as PLAT-V2-01 (v2). The `Domain(hostname @unique, tenantId)` table is additive: `resolveTenantByHostname` sits beside `resolveTenantBySlug` with the subdomain path unchanged.
- Full marketing site at the root domain — placeholder only in V1
- Store slug rename UI — the data model is rename-safe now (D-03); the UI lands in Phase 4 at `/onboarding/create-store`
- Distinct "temporarily unavailable" messaging for suspended stores — deliberately deferred by D-05, not merely unbuilt
- Postgres Row-Level Security as a second isolation layer — deliberately deferred past V1 by CLAUDE.md C-7. **Recorded as intentional debt, not an oversight.** The Prisma Client Extension is the primary guard; RLS is the belt-and-suspenders hardening pass to add after V1, layered underneath rather than replacing the extension.
- i18n framework — V1 strings are hardcoded in the language chosen in plan 01
- Dark mode
- `cacheComponents: true` — revisit in Phase 4 with explicit per-tenant cache keys
- Job queues / background workers — `waitUntil()` first, then Vercel Queues or QStash if retries are ever needed. Never BullMQ with a persistent worker process.

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering the decisions above:

- **Phase 2:** A merchant logs in and reaches a dashboard whose tenant identity comes only from `session.activeOrganizationId` (already back-filled by the Phase 1 session hook), with plan tier and trial enforced server-side on every relevant write.
- **Phase 3:** A merchant lists a product and a customer completes a purchase through an auditable order state machine. First phase to register new models in `TENANT_SCOPED_MODELS` — the drift guard turns the build red until they are registered, and the model-generic isolation suite covers them automatically.
- **Phase 4:** Onboarding produces a live, branded, portfolio-quality storefront; `src/app/s/[slug]/page.tsx` is replaced wholesale by the Theme/Section/Block renderer.
- **Phase 5:** Roughly 20 structurally distinct template variations across merchant segments.
- **Phase 6:** Merchant dashboard and the pilot-scoped Super Admin surface — the first and only consumer of `adminDb`, and the first caller of `invalidateTenantHost` on suspension.

## Carried-Forward Risks

Findings from Phase 1 that later phases must not lose track of:

| Ref | Item | Where it must be honoured |
|---|---|---|
| A1 | Whether the tenant-scoping extension survives `scopedDb(t).$transaction(...)` — asserted by a dedicated test in plan 04 | Phase 3 writes the first transactional code. If the plan-04 test failed, `scopedDb` needs its own `$transaction` wrapper before any of it is written. |
| A3 | Whether `databaseHooks.session.create.before` persists `activeOrganizationId` — asserted in plan 06 | Phase 2's dashboard tenant context (TEN-04) depends on it. |
| A7 | Windows `next start` + `proxy.ts` regression (issue #85243) — smoke-checked in plan 07 | Re-run the smoke check after any Next.js upgrade. Renaming back to `middleware.ts` is never an acceptable workaround. |
| — | `better-auth` 1.6.x ships frequently, and the system-action / `beforeCreateOrganization` internals relied on here are unexported implementation details | Re-verify against the installed version if the lockfile moves off 1.6.29. |
| C-7 | Postgres RLS deferred | Hardening pass after V1. |
