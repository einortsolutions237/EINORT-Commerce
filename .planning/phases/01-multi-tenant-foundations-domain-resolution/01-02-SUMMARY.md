---
phase: 01-multi-tenant-foundations-domain-resolution
plan: 02
subsystem: data-access
tags: [prisma7, multi-tenancy, schema, migration, client-extension, lint-boundary, better-auth]
requires:
  - "01-01: src/env.ts (DATABASE_URL, DIRECT_URL)"
  - "01-01: eslint.config.mjs four data-access import zones"
  - "01-01: .gitignore entry for src/generated/"
provides:
  - "prisma.config.ts — Prisma 7 CLI datasource + migration config"
  - "prisma/schema.prisma — Better Auth core + organization models, StoreSlugHistory"
  - "prisma/migrations/20260817013504_init_tenant_foundations — applied on Neon"
  - "src/generated/prisma — generated client (gitignored)"
  - "src/server/db/base.ts — prismaBase singleton on @prisma/adapter-pg"
  - "src/server/db/tenant-scoped.ts — scopedDb(tenantId), TENANT_SCOPED_MODELS, ScopedDb"
  - "src/server/db/platform.ts — platformDb (organization, user, member, session)"
  - "src/server/db/admin.ts — adminDb (unscoped, lint-fenced)"
affects: [01-03, 01-04, 01-05, 01-06, 01-07]
tech-stack:
  added:
    - server-only@0.0.1
  patterns:
    - "Prisma 7 CLI datasource (unpooled) is separate from the runtime adapter connection (pooled)"
    - "Tenant registry typed as Prisma.ModelName[] so schema drift is a build failure"
    - "tenantId injected LAST in every object spread — overwrite, never merge"
    - "Non-tenant-scoped registry reads get their own narrow facade rather than reaching for the base client"
key-files:
  created:
    - prisma.config.ts
    - prisma/schema.prisma
    - prisma/migrations/migration_lock.toml
    - prisma/migrations/20260817013504_init_tenant_foundations/migration.sql
    - src/server/db/base.ts
    - src/server/db/tenant-scoped.ts
    - src/server/db/platform.ts
    - src/server/db/admin.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "A2 confirmed: better-auth 1.6.29 emits a non-nullable slug; normalized to inline @unique"
  - "Organization.status and User.platformRole hand-corrected from nullable to NOT NULL"
  - "prisma.config.ts datasource points at DIRECT_URL — Prisma 7 removed directUrl, and this file is CLI-only"
  - "Postgres RLS deliberately deferred past V1 (CLAUDE.md C-7) — recorded as intentional debt"
metrics:
  duration: "~20 min (02:28 → 02:48 UTC+1)"
  completed: 2026-08-17
  tasks: 2
  commits: 2
---

# Phase 1 Plan 02: Tenant Data Model & the Sanctioned Path To It Summary

The load-bearing guarantee of the product now exists as code rather than convention:
`scopedDb(tenantId)` injects `tenantId` into every operation on every registered model and
throws for anything unregistered, backed by a first migration on Neon where
`organization.slug` is NOT NULL + UNIQUE and `store_slug_history.tenantId` is NOT NULL.

---

## Required Plan Outputs

| Question the plan asked | Answer |
|---|---|
| **A2 — was `slug` emitted non-nullable?** | **Yes.** `npx auth@latest generate` against better-auth 1.6.29 emitted `slug String` (no `?`) plus a block-level `@@unique([slug])`. Issue #4869's nullable-slug regression did **not** reproduce. Normalized to the inline `slug String @unique` — identical DDL, but it puts the DOM-02 guarantee on the same line as the column. Confirmed in the applied SQL: `"slug" TEXT NOT NULL` + `CREATE UNIQUE INDEX "organization_slug_key"`. |
| **Exact migration directory name** | `prisma/migrations/20260817013504_init_tenant_foundations` (166 lines; 8 tables: `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, `store_slug_history`) |
| **Final contents of `TENANT_SCOPED_MODELS`** | Exactly one entry: `"StoreSlugHistory"`. Sourced from `const REGISTERED_MODELS: readonly Prisma.ModelName[] = ["StoreSlugHistory"]`. |
| **RLS deferral** | Deferred, deliberately — see "Intentional Debt" below. |

---

## What Was Built

### Task 1 — Prisma 7 datasource, schema, first migration (`4c1ffae`)

`prisma.config.ts` carries the connection config that Prisma 7 no longer reads from
`schema.prisma` (Pitfall 9). `datasource db` is `{ provider = "postgresql" }` with no `url`,
and the generator is `prisma-client` (not `prisma-client-js`) with a mandatory explicit
`output`.

The Better Auth blocks were generated, not hand-written, so they can be regenerated when the
plugin set changes in plan 01-06. Two emitted fields were hand-corrected and annotated inline
in the schema — see Deviation 5.

`StoreSlugHistory` is the phase's one tenant-scoped model and the concrete artifact D-03 asks
for. Its `@@unique([slug])` is **deliberately global** rather than led by `tenantId` — the one
intentional exception to the Pitfall 8 leading-column rule, commented as such in the schema.
The exception is the point: a slug is a hostname, so it must be unique platform-wide for all
time, including after release. Without it, a merchant renaming `bella` → `bella-shop` frees
`bella` for a different merchant to claim and inherit their inbound links, QR codes and
WhatsApp shares.

`tenantId` is `String` — required, no default, no Prisma relation. All three properties are
load-bearing and none is stylistic:

- **Required, no default** converts the Pitfall 4 nested-write bypass from a silent `NULL`
  row (which a later read attributes to the wrong tenant) into a compile-time type error, and
  a `NOT NULL` violation at worst.
- **No relation field** keeps rename cheap: a rename is `UPDATE organization SET slug` plus a
  cache invalidation, with no data migration, because `tenantId` holds the stable
  `organization.id` and never the slug string.

### Task 2 — The four data-access clients (`5e2af5e`)

All four modules open with `import "server-only";` so an accidental client import is a build
failure, not a runtime credential leak.

**`scopedDb(tenantId)`** is one `$allOperations` extension over `prismaBase`. It checks
allowlist membership first and throws for anything unregistered — failing loudly there is the
entire mechanism, because a model nobody registered running unscoped would defeat it silently.
Then it branches on operation against the verified `args` shapes: `create` (object `data`),
`createMany`/`createManyAndReturn` (**array** `data`), `upsert` (both `where` **and** `create`,
or the operation becomes a cross-tenant hijack), and a default `where` injection covering the
remaining eleven read/write operations.

In all five injection sites `tenantId` is spread **last**. That ordering is the whole of
TEN-08: a caller-supplied `tenantId` in the payload is overwritten, never merged.

Two stale patterns were deliberately avoided, both documented in the file so a future
maintainer does not "fix" them back in: no `findUnique` → non-unique rewrite
(`extendedWhereUnique` has been GA since Prisma 5, and the generated 7.9.1 `WhereUniqueInput`
is a `Prisma.AtLeast<>` accepting non-unique scalars alongside the unique selector), and no
`prisma.$use()` (removed in Prisma 7).

**`platformDb`** is a four-delegate façade — `organization`, `user`, `member`, `session` —
exposed as getters so each access resolves against the live singleton. It is deliberately not
a re-export: reaching a tenant-scoped model through it is a type error rather than a review
comment. It exists because slug availability and hostname resolution must read `organization`,
which has no `tenantId` and would (correctly) throw through `scopedDb`. Without this third
category, that code would be forced to weaken the TEN-02 boundary via `prismaBase` or pollute
TEN-05's admin isolation via `adminDb`.

**`adminDb`** is unscoped on purpose. TEN-05 is satisfied by it existing, being unscoped, and
being lint-fenced — not by building admin UI now. Nothing consumes it until Phase 6.

---

## Verification

| Gate | Command | Result |
|---|---|---|
| Schema valid | `npx prisma validate` | exit 0 |
| Zero drift | `npx prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource --exit-code` | `No difference detected` |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` (`eslint . --max-warnings=0`) | exit 0 |
| Task 1 criteria | 20 scripted assertions (schema shape + applied SQL) | 20/20 PASS |
| Task 2 criteria | 26 scripted assertions (source-level, comments stripped) | 26/26 PASS |

Both verification scripts were throwaway and are confirmed absent from the tree.

### Lint-boundary probes (live, not assumed)

| Probe | Location | Result |
|---|---|---|
| `import { adminDb } from "@/server/db/admin"` | `src/app/` | **rejected** — *"adminDb is only importable from src/server/admin/\*\*"* |
| `import { prismaBase } from "@/server/db/base"` | `src/app/` | **rejected** — *"Use scopedDb(tenantId), platformDb, or adminDb"* |
| `import { scopedDb } from "@/server/db/tenant-scoped"` | `src/app/` | **allowed** (eslint exit 1 flagged only the two lines above) |
| `import { adminDb } from "@/server/db/admin"` | `src/server/admin/` | **allowed** (eslint exit 0) |

Rows 3 and 4 matter as much as rows 1 and 2: a boundary that rejects everything is not a
boundary. Both probe files were deleted before commit and are absent from the tree.

### Applied SQL — the guarantees, as DDL

```sql
"slug" TEXT NOT NULL                       -- organization
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");
"tenantId" TEXT NOT NULL                   -- store_slug_history
CREATE UNIQUE INDEX "store_slug_history_slug_key" ON "store_slug_history"("slug");
CREATE INDEX "store_slug_history_tenantId_idx" ON "store_slug_history"("tenantId");
CREATE INDEX "store_slug_history_tenantId_claimedAt_idx" ON "store_slug_history"("tenantId", "claimedAt");
```

Behavioural proof of the extension is plan 01-04's job. This plan is verified structurally and
by schema/database agreement.

---

## Deviations from Plan

### 1. [Rule 3 — Blocking] Worktree had no `node_modules` and no env files

- **Found during:** setup, before Task 1
- **Issue:** `.env.local`, `.env.test` and `node_modules/` are all gitignored, so a fresh
  worktree carries none of them. Without the env files there is no `DATABASE_URL` to migrate
  against; without `node_modules` there is no Prisma CLI.
- **Fix:** copied `.env.local` and `.env.test` in from the parent checkout (both re-confirmed
  gitignored inside the worktree via `git check-ignore`, so neither can be committed), and ran
  `npm ci` from the committed lockfile.
- **Files:** none committed.

### 2. [Rule 3 — Blocking] `import "dotenv/config"` would not have loaded this project's credentials

- **Found during:** Task 1
- **Issue:** the plan and RESEARCH.md Code Example 1 both open `prisma.config.ts` with
  `import "dotenv/config"`. That loads `.env` and only `.env`. This project's real credentials
  live in `.env.local` (Next.js's convention, and what plan 01-01's `.env.example` documents),
  so the CLI would have found no `DATABASE_URL` at all. Separately, `dotenv` is **not** a
  declared dependency — importing it would have relied on npm hoisting a transitive package.
- **Fix:** used Node's built-in `process.loadEnvFile` over `[".env.local", ".env"]`, guarded by
  `existsSync`. Zero dependencies, and it preserves Next.js precedence because `loadEnvFile`
  never overwrites a key already present in the real environment (CI/Vercel still win).
- **Files:** `prisma.config.ts` · **Commit:** `4c1ffae`

### 3. [Rule 3 — Blocking] `directUrl` does not exist in Prisma 7's config type

- **Found during:** Task 2, first `npm run typecheck`
- **Issue:** the plan specifies
  `datasource: { url: env("DATABASE_URL"), directUrl: env("DIRECT_URL") }`. Prisma 7 removed
  it — `@prisma/config`'s exported type is exactly
  `Datasource = { url?: string; shadowDatabaseUrl?: string }`, so `directUrl` is a
  `TS2353` error. (RESEARCH.md's own Code Example 1 has the `directUrl` line **commented
  out**, which is the surviving hint that it was dropped.)
- **Fix:** pointed the single `url` at `DIRECT_URL`. This is not a compromise — it is more
  correct than the plan's shape, because `prisma.config.ts` is read *only by the Prisma CLI*.
  The application runtime never loads it; `src/server/db/base.ts` builds its own connection
  through `@prisma/adapter-pg`. The result is the intended split, achieved in one field:
  runtime → `DATABASE_URL` (pooled, CLAUDE.md C-5); CLI/DDL → `DIRECT_URL` (unpooled, which is
  what migrations need since schema changes take session-level advisory locks that do not
  survive a transaction pooler).
- **Files:** `prisma.config.ts` · **Commit:** `5e2af5e`

### 4. [Rule 3 — Blocking] `prisma migrate diff` flags renamed in Prisma 7

- **Found during:** Task 1 verification
- **Issue:** the plan's verify command uses `--from-schema-datamodel` / `--to-schema-datasource`.
  Prisma 7 rejects the first outright: *"`--from-schema-datamodel` was removed. Please use
  `--[from/to]-schema` instead."*
- **Fix:** the Prisma 7 equivalent is
  `npx prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource --exit-code`.
  Same semantics — datamodel vs. live database. Reports `No difference detected`.
- **Files:** none (verification command only). Plans 01-04+ should use the new flags.

### 5. [Rule 2 — Missing critical functionality] Better Auth emitted `status` and `platformRole` as nullable

- **Found during:** Task 1
- **Issue:** the generator emitted `status String? @default("active")` and
  `platformRole String? @default("merchant")` — nullable, because both are declared
  `required: false` in the Better Auth field config. The plan's acceptance criteria demand the
  non-nullable form, and for `status` the nullability is a real correctness problem, not a
  cosmetic one: hostname resolution branches on this value (D-05), and a `NULL` status is
  neither `"active"` nor `"suspended"`, so such a row would resolve ambiguously. The same
  argument applies to `platformRole`: a `NULL` is neither `"merchant"` nor admin, and every
  future authorization check would have to special-case a third state.
- **Fix:** hand-corrected both to `String @default(...)`. The DB default supplies the value, so
  nothing needs to write these fields — and both are declared `input: false`, so neither can be
  set through the public create/update API. Each correction is annotated inline in
  `schema.prisma` with its reason so a future regeneration does not silently undo it.
- **Files:** `prisma/schema.prisma` · **Commit:** `4c1ffae`

### 6. [Rule 3 — Blocking] `npx auth generate` needs a Better Auth instance that does not exist yet

- **Found during:** Task 1
- **Issue:** the generator derives models from a live `betterAuth({...})` config. The real one
  is owned by plan 01-06, and it imports `prismaBase`, which imports the generated client,
  which does not exist before this migration — a cycle.
- **Fix:** a throwaway `_ba-generate.ts` at the repo root declaring only the plugin set and the
  two `additionalFields` this plan is responsible for, with `prismaAdapter({} as never, …)`
  since schema generation reads the provider and never the connection. Deleted immediately
  after generation and confirmed absent from the tree. Plan 01-06 must keep its real config's
  plugin set and `additionalFields` consistent with the committed schema, or regenerate.
- **Files:** none committed.

### 7. [Rule 3 — Blocking] `server-only` was not installed

- **Found during:** Task 2
- **Issue:** the plan requires `import "server-only";` as the first line of all four modules,
  but the package does not resolve. Next 16 does not depend on it (only `client-only` is
  present, transitively).
- **Fix:** verified legitimacy before installing rather than assuming, per this project's
  package-audit discipline: `server-only@0.0.1`, published 2022-09-03, maintainer
  `sebmarkbage` (Sebastian Markbåge, React core) — the **same publisher** as the `client-only`
  already in the dependency tree, and the package named by both RESEARCH.md Pattern 6 and the
  Next.js docs. Installed with `--save-exact`; diff is one additive line in `package.json` and
  seven in the lockfile, so merge-conflict risk against the concurrent plan 01-03 worktree is
  minimal.
- **Files:** `package.json`, `package-lock.json` · **Commit:** `5e2af5e`

### 8. [Rule 3 — Blocking] `LayoutProps` unresolved in a fresh worktree

- **Found during:** Task 2 typecheck
- **Issue:** `src/app/layout.tsx` (plan 01-01) uses the `LayoutProps<"/">` global, which Next
  generates into `.next/types`. `.next/` is gitignored, so a fresh worktree has no such
  directory and `tsc` reports `TS2304: Cannot find name 'LayoutProps'`.
- **Fix:** ran `npx next typegen`. Environment gap, not a code defect — plan 01-01's source is
  correct and unmodified. Worth knowing for CI: `typecheck` must be preceded by `next typegen`
  or `next build` on a clean checkout.
- **Files:** none.

### 9. Minor scope notes

- **`Organization.slug` normalized to inline `@unique`.** The generator emitted a block-level
  `@@unique([slug])`. Identical DDL (same `organization_slug_key` index), but the inline form
  states the DOM-02 guarantee on the column's own line and satisfies the plan's acceptance
  criterion literally.
- **`TENANT_SCOPED_MODELS` is typed, not stringly-typed.** Backed by
  `readonly Prisma.ModelName[]` (a Rule 2 addition) so renaming or dropping a model in
  `schema.prisma` stops the build at the moment of the rename — earlier than plan 01-04's
  runtime drift test would catch it. The exported contract is still `Set<string>` as the
  interface specifies.
- **`platformDb` uses getters**, so each access resolves against the live `prismaBase`
  singleton rather than capturing a delegate at module-evaluation time.
- **`prisma/seed.ts` deliberately not created** — plan 01-04 owns it. `prisma.config.ts`
  declares the `tsx prisma/seed.ts` runner now because Prisma 7 no longer auto-seeds on
  `migrate dev`, so the runner has to be explicit whenever the seed does land.
- **`npm run test:unit` exits non-zero on a bare invocation** because no `tests/unit/**` files
  exist yet (vitest without `--passWithNoTests`). Pre-existing from plan 01-01, unrelated to
  this plan's files, not fixed here. Plan 01-01's wave gate passes it explicitly.

---

## Authentication Gates

None. The Neon credentials in `.env.local` were already provisioned and worked as-is; no
interactive login was required.

---

## Intentional Debt

**Postgres Row-Level Security is deliberately not implemented.** CLAUDE.md C-7 defers it past
V1 for the 30-day timeline, and RESEARCH.md classifies threat **T-01-12** as `accept` rather
than `mitigate`.

This is a recorded trade, not an oversight. The primary guard is the Client Extension plus the
required-`tenantId` schema; what RLS would add is a second layer that also survives application
bugs and any future direct-DB tooling. Its cost is `SET LOCAL` session-variable plumbing on
every connection, which interacts awkwardly with a pooled serverless connection — real
complexity for this timeline. Revisit as a hardening pass after V1, at which point the
extension stays as the developer-ergonomics layer and RLS goes underneath it rather than
replacing it.

Two smaller items, both already owned by plan 01-04:

- **Assumption A1 is still unverified** — whether the extension applies to clients yielded by
  `scopedDb(t).$transaction(async (tx) => …)`. RESEARCH.md calls this the highest-risk open
  assumption, since if it is false every transactional write is unscoped. It needs a live
  database, so it must be an assertion in the isolation suite, not an assumption. **No
  transactional code should be written against `scopedDb` until this is proven.**
- **Registry drift is guarded at compile time but not yet at runtime.** `Prisma.ModelName[]`
  catches a renamed or dropped model; it does not catch a **newly added** model that carries a
  `tenantId` and was never registered. Plan 01-04's `model-registry-drift` test closes that
  direction by comparing the registry against the generated `ScalarFieldEnum`s.

---

## Known Stubs

None. Every artifact this plan claims is wired and exercised: the migration is applied on
Neon with zero drift, all four clients compile and pass the lint boundary, and the boundary
itself was probed live in both the reject and allow directions.

`adminDb` has no consumer until Phase 6, but that is the requirement rather than a stub —
TEN-05 asks for architectural isolation, and the client existing, being unscoped, and being
lint-fenced *is* that isolation.

---

## Threat Flags

None. This plan adds no network endpoint and no auth path. Its schema changes are the
mitigations themselves rather than new surface:

| Threat | Disposition | Evidence in this plan |
|---|---|---|
| T-01-05 (read missing `tenantId` filter) | mitigated | `where` injection on all 11 default-branch operations; allowlist throws for unregistered models |
| T-01-06 (client-supplied `tenantId` stamping another tenant) | mitigated | `tenantId` spread last in all 5 injection sites — asserted at source level |
| T-01-07 (nested-write bypass) | mitigated | `store_slug_history.tenantId` is `TEXT NOT NULL` in applied SQL |
| T-01-08 (feature code reaching for `adminDb`/`prismaBase`) | mitigated | probed live, both rejected from `src/app/` |
| T-01-09 (two orgs sharing one slug) | mitigated | A2 verified; `"slug" TEXT NOT NULL` + `organization_slug_key`, backstopped by `store_slug_history_slug_key` |
| T-01-10 (rename erasing hostname ownership) | mitigated | `StoreSlugHistory{tenantId, slug, claimedAt, releasedAt}` |
| T-01-11 (raw SQL bypass) | mitigated | plan 01-01's `no-restricted-syntax` ban; no raw query introduced here |
| T-01-12 (no RLS second layer) | **accepted** | see Intentional Debt above |

---

## Commits

| Commit | Task | Description |
|---|---|---|
| `4c1ffae` | 1 | Prisma 7 datasource, tenant schema and first migration |
| `5e2af5e` | 2 | The four data-access clients and the tenant-scoping extension |

---

## Notes for Downstream Plans

- Import the generated client from `@/generated/prisma/client` — **not** `@prisma/client`.
  Prisma 7 requires an explicit generator output and `eslint.config.mjs` bans direct
  `**/generated/prisma*` imports outside the sanctioned `src/server/{db,tenant,auth}/**` zones.
- Registering a new tenant-scoped model is two edits that must land together: the model in
  `prisma/schema.prisma` (with `tenantId String`, required, no default) and its name in
  `REGISTERED_MODELS` in `tenant-scoped.ts`. Miss the second and the first query throws.
- Hostname resolution and slug availability (plans 01-03/01-05) go through `platformDb`, not
  `scopedDb` — `Organization` is the tenant, so it is deliberately absent from the registry and
  `scopedDb` will throw for it by design.
- Plan 01-06's Better Auth config must stay consistent with the committed schema: the
  `organization` plugin with `status` (`input: false`, default `"active"`) and the user-level
  `platformRole` (`input: false`, default `"merchant"`). Both columns are NOT NULL in the
  database — see Deviation 5.
- On a clean checkout, run `npx next typegen` before `npm run typecheck` (Deviation 8), and
  use the Prisma 7 `migrate diff` flags (Deviation 4).

---

## Self-Check: PASSED

All 8 claimed files exist on disk. Both claimed commits (`4c1ffae`, `5e2af5e`) resolve in
`git log`. All four throwaway files (`_ba-generate.ts`, `_verify-task1.mjs`,
`_verify-task2.mjs`, and the two lint probes `src/app/_probe3.ts`,
`src/server/admin/_probe4.ts`) are confirmed absent from the tree and from every commit.
`git diff --diff-filter=D HEAD~1 HEAD` reports no deletions on either commit.
Per the orchestrator's instructions, `STATE.md` and `ROADMAP.md` were **not** modified.
