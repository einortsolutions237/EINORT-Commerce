# Technology Stack

**Analysis Date:** 2026-08-30

## Languages

**Primary:**
- TypeScript 5.9.3 (pinned) - entire `src/` tree, `prisma.config.ts`, `next.config.ts`, `vitest.config.ts`
  - Pinned below the project's originally-recommended TypeScript 7.0.x. `package.json` carries a `comment:typescript` field explaining why: `typescript-eslint@8.67.0` hard-throws on TS >= 7.0 until TS 7.1 ships ecosystem support, and the ESLint gate is the enforcement mechanism for the project's tenant-isolation import-boundary rules (TEN-02/TEN-05 — see `eslint.config.mjs`). Revert to 7.0.x once `typescript-eslint` supports it.
  - `tsconfig.json`: `strict: true`, `target: ES2017`, `moduleResolution: bundler`, path alias `@/*` → `./src/*`.

**Secondary:**
- SQL - `prisma/migrations/**/migration.sql` (raw DDL, Prisma-generated)
- JavaScript (`.mjs`) - `eslint.config.mjs`, `postcss.config.mjs`, `scripts/prisma-generate.mjs`

## Runtime

**Environment:**
- Node.js 24 LTS (required per `README.md` prerequisites table: "`node -v` should print `v24.x`"). No `.nvmrc`/`.node-version` file present to enforce this automatically.
- Next.js server runtime is **Node.js**, not Edge, everywhere in this codebase — no route declares `export const runtime = 'edge'`. This is load-bearing: Sharp (image processing) and parts of the AWS SDK v3 used for R2 cannot run on Edge.

**Package Manager:**
- npm (lockfile `package-lock.json` present, 506KB)
- Install hook: `postinstall: "node scripts/prisma-generate.mjs"` — regenerates the Prisma client into `src/generated/prisma` after every `npm install` (no-ops if no schema yet).

## Frameworks

**Core:**
- Next.js 16.3.1 - App Router, server actions, middleware/proxy (`src/proxy.ts`), image optimization. Dev server runs on port 3001 (`npm run dev` → `next dev --port 3001`); production/tests assume port 3000 (`NEXT_PUBLIC_ROOT_DOMAIN="localhost:3000"`).
- React 19.2.8 / react-dom 19.2.8 - UI runtime, ships with Next 16.

**Testing:**
- Vitest 4.1.10 - two configured projects/suites (see `vitest.config.ts`): a database-free `unit` project (aliases `server-only` to a stub so pure modules under `src/server/entitlements/**` etc. can be imported) and a `isolation`/full-database project run against a dedicated Neon test branch via `TEST_DATABASE_URL`.
- Scripts: `npm run test:unit` → `vitest run tests/unit --reporter=dot`; `npm run test:full` → `dotenv -e .env.test -- vitest run` (needs `dotenv-cli` 11.0.0, a devDependency).

**Build/Dev:**
- ESLint 9 (flat config, `eslint.config.mjs`) + `eslint-config-next` 16.3.1 - `npm run lint` runs with `--max-warnings=0` (zero-tolerance gate). The flat config also encodes project-specific import-boundary rules (e.g. banning `@/generated/prisma*` imports outside `src/server/db/**`, `src/server/tenant/**`, `src/server/auth/**` — the TEN-02/TEN-05 tenant-isolation enforcement mechanism).
- Tailwind CSS 4 (`@tailwindcss/postcss`, `postcss.config.mjs`) - utility CSS.
- `shadcn` 4.18.0 + `components.json` - component scaffolding/config for the `src/components/ui/**` primitives (built on `@base-ui/react` 1.7.0, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `lucide-react`).
- `tsx` 4.23.12 - TypeScript execution for `prisma/seed.ts` and CLI scripts (invoked with `--conditions=react-server` in `prisma.config.ts` so `server-only`-marked modules resolve correctly during seeding).

## Key Dependencies

**Critical:**
- `@prisma/client` 7.9.1 + `prisma` 7.9.1 - ORM/schema/migrations. Prisma 7 is Rust-free and requires an explicit driver adapter (no implicit query engine); `datasource.url` is NOT read from `schema.prisma` (deliberately absent there — see comment in `prisma/schema.prisma`) and instead configured in `prisma.config.ts`.
- `@prisma/adapter-pg` 7.9.1 + `pg` 8.23.0 - Node.js-runtime Prisma driver adapter, used everywhere at runtime (`src/server/db/base.ts`), pointed at the **pooled** Neon connection string (`DATABASE_URL`).
- `better-auth` 1.6.29 - authentication, using the `organization` plugin as the tenant primitive (`Organization` == `Store`/tenant). Configured in `src/server/auth/auth.ts`. Ships bundled `@better-auth/prisma-adapter` equivalent via `better-auth/adapters/prisma`.
- `zod` 4.4.3 - runtime validation for every server action input and for `@t3-oss/env-nextjs` env schemas.
- `@t3-oss/env-nextjs` 0.13.11 - typed/validated environment surface, single source of truth at `src/env.ts` (see INTEGRATIONS.md for full var list). Project convention: **never** read `process.env` directly outside this file (with a documented, commented exception in `next.config.ts`, which runs outside request context).

**Infrastructure:**
- `@aws-sdk/client-s3` 3.1116.0 + `@aws-sdk/s3-request-presigner` 3.1116.0 - S3-protocol client used against Cloudflare R2 (R2 is S3-compatible; `region: "auto"` is a required-but-ignored SDK parameter). Presigned direct-to-R2 browser uploads (`src/server/images/r2.ts`).
- `sharp` 0.35.3 - server-side image re-encoding of uploaded product/claim images. Node.js runtime only (native libvips bindings, incompatible with Edge).
- `@upstash/redis` 1.38.2 + `@upstash/ratelimit` 2.0.8 - HTTP-based Redis for tenant-hostname cache, cart cache, idempotency keys, and multiple named rate limiters (`src/server/rate-limit.ts`). Fully optional at runtime: every consumer degrades to "allow-all"/direct-DB-read with a loud `console.warn` when Upstash credentials are absent — there is deliberately no in-process fallback counter (documented as dishonest under serverless concurrency).
- `resend` 6.22.0 - transactional email SDK. Declared as an optional dependency in `src/env.ts` (`RESEND_API_KEY`, `RESEND_FROM_EMAIL` both `.optional()`) but **not yet wired into any send call** — no other source file under `src/` imports `resend` as of this analysis; it is reserved for a future proactive "payment claim received" merchant email.
- `nanoid` 6.0.1 - short unique IDs (order numbers, tracking-token generation source).
- `server-only` 0.0.1 - marker package enforcing server-only module boundaries at build time (imported as the first line of every `src/server/db/**` module).

**Forms/UI:**
- `react-hook-form` 7.85.0 + `@hookform/resolvers` 5.9.0 - form state paired with Zod.
- `sonner` 2.0.8 - toast notifications.

## Configuration

**Environment:**
- All env vars validated centrally in `src/env.ts` via `@t3-oss/env-nextjs`/Zod, split into `server` and `client` (`NEXT_PUBLIC_*`) blocks, with `emptyStringAsUndefined: true` (a blank `FOO=` in a deploy dashboard is treated as missing, not as a valid empty string) and a `SKIP_ENV_VALIDATION` escape hatch for lint/typecheck/CI paths.
- Local dev secrets: `.env.local` (gitignored, real values). Template: `.env.example` (committed, placeholders + inline setup instructions per provider).
- Test env: `.env.test` (gitignored) / `.env.test.example` (committed) — carries `TEST_DATABASE_URL` only; the isolation test suite maps this into `DATABASE_URL`/`DIRECT_URL` at the Vitest-config layer (`vitest.config.ts`) so tests never silently touch the development database.
- `prisma.config.ts` loads `.env.local` then `.env` via Node's built-in `process.loadEnvFile` (not `dotenv/config` — that package is not a declared dependency); a `TEST_DATABASE_URL` present in the shell always overrides `DIRECT_URL` for migration safety.

**Build:**
- `next.config.ts` - derives the `next/image` remote-pattern allowlist from `R2_PUBLIC_BASE_URL`, read directly via `process.env` (not `@/env`) since this file runs outside request context and evaluating the full env schema here would be unnecessarily costly/fragile.
- `tsconfig.json` - strict mode, `@/*` path alias to `src/`.
- `postcss.config.mjs` - Tailwind 4 PostCSS plugin only.
- `components.json` - shadcn/ui generator config.

## Platform Requirements

**Development:**
- Node.js 24 LTS.
- A Neon Postgres branch (`DATABASE_URL` pooled + `DIRECT_URL` unpooled — same host, `DIRECT_URL` lacks `-pooler`).
- A **second**, dedicated Neon branch for tests (`TEST_DATABASE_URL`) — the isolation suite truncates/reseeds and `tests/setup/global-setup.ts` fails closed rather than falling back to the dev branch.
- Upstash Redis is optional locally (rate limiters/caches degrade loudly, never silently).
- Cloudflare R2 credentials are **required in every environment including local dev** — there is no fallback storage path for product/claim images.
- `*.localhost` wildcard DNS works with zero configuration in Chrome/Edge/Firefox (including Windows) for multi-tenant subdomain testing — no hosts-file edits needed.

**Production:**
- Target deployment: Vercel (implied throughout `CLAUDE.md`/code comments — e.g. Server Action body-size limits, serverless connection-pooling concerns, `x-forwarded-for` trust assumptions in `src/server/rate-limit.ts`).
- Neon managed Postgres (scale-to-zero, branch-per-PR via Vercel-Neon integration).
- Cloudflare R2 for object storage (zero egress fees).
- Upstash Redis REQUIRED in production (optional only in dev/test).

---

*Stack analysis: 2026-08-30*
