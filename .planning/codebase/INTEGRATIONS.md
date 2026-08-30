# External Integrations

**Analysis Date:** 2026-08-30

## APIs & External Services

**Payments:**
- **None (by design).** There is no live PSP/payment-gateway integration in V1. `enum PaymentOperator { MTN_MOMO, ORANGE_MONEY }` in `prisma/schema.prisma` names the mobile-money rails a customer used, not an integration — checkout is manual Mobile Money/Orange Money transfer instructions + a customer-submitted payment-claim/verify flow + Cash on Delivery + WhatsApp order. `MerchantPaymentSettings` (`prisma/schema.prisma`) stores per-merchant WhatsApp number, MTN MoMo number/merchant code, Orange Money number/merchant code — used to render `tel:`/`wa.me` deep links, not to call any external API.

**Transactional Email:**
- Resend - SDK dependency (`resend` 6.22.0) declared but **not yet called anywhere in `src/`**. Env vars `RESEND_API_KEY` / `RESEND_FROM_EMAIL` are both optional (`src/env.ts`); when unset, the (future) payment-claim notification path is documented to degrade to a `console.warn` rather than blocking claim submission. Reserved for the "merchant email when a customer submits a payment claim" feature.
  - SDK/Client: `resend` npm package (unused import at present)
  - Auth: `RESEND_API_KEY` env var
  - Sender: `RESEND_FROM_EMAIL` (must be a Resend-verified sending domain)

## Data Storage

**Databases:**
- PostgreSQL via **Neon** (managed, serverless-friendly Postgres)
  - Runtime connection: `DATABASE_URL` — the **pooled** connection string (host contains `-pooler`), used by `@prisma/adapter-pg` in `src/server/db/base.ts`. Required, validated with `z.url()`.
  - Migration connection: `DIRECT_URL` — the **unpooled** string (same host, no `-pooler`), used only by the Prisma CLI via `prisma.config.ts`. Migrations take session-level advisory locks that don't survive a transaction pooler.
  - Client: `@prisma/client` 7.9.1 (custom generator output at `src/generated/prisma`, NOT the default `@prisma/client` package path) + `@prisma/adapter-pg` 7.9.1 driver adapter (Prisma 7 has no implicit query engine).
  - Access pattern: four-tier client discipline documented across `src/server/db/*.ts` — `prismaBase` (raw, unscoped, import-restricted via ESLint to `src/server/db/**`, `src/server/tenant/**`, `src/server/auth/**`), plus `scopedDb(tenantId)`, `platformDb`, and `adminDb` for feature code (see `src/server/db/base.ts`, `platform.ts`, `admin.ts`, `tenant-scoped.ts`).
  - Testing: a **second, dedicated** Neon branch supplies `TEST_DATABASE_URL` (`.env.test`); the isolation suite truncates/reseeds it and refuses to fall back to the dev branch if unset (`tests/setup/global-setup.ts`).

**File Storage:**
- Cloudflare R2 (S3-compatible object storage), accessed via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (`src/server/images/r2.ts`).
  - Endpoint: `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, `region: "auto"` (required by the SDK, ignored by R2).
  - Auth: `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` (API token scoped to one bucket, "Object Read & Write" permission).
  - Bucket: `R2_BUCKET` (e.g. `einort-media`).
  - Public origin: `R2_PUBLIC_BASE_URL` (a `https://pub-<hash>.r2.dev` origin or bound custom domain); consumed by `next.config.ts` to build the `next/image` remote-pattern allowlist.
  - All five R2 env vars are **required in every environment**, including local dev — there is no fallback storage path (product images and payment-claim screenshots upload direct-to-R2 via presigned PUT; a missing bucket makes product creation and claim submission impossible, so the app fails at boot rather than at first upload).
  - Upload flow: browser gets a 5-minute presigned PUT grant to exactly one key (`tenants/{tenantId}/{kind}/{uploadId}/original`), with `content-type` and `content-length` explicitly included in `signableHeaders` (verified against the live bucket — without this, `ContentType` alone is unenforced and a mismatched upload silently succeeds). Sharp then re-encodes derivatives server-side; the `/original` object is never served publicly (`publicUrlFor` throws if asked to build a URL for a key ending `/original`).

**Caching / Session Store:**
- Upstash Redis (`@upstash/redis` 1.38.2), HTTP/REST-based (no persistent TCP connection — works from serverless and Edge alike).
  - Auth: `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, both optional.
  - Used for: tenant hostname resolution cache (`src/server/tenant/cache.ts`, `host.ts`, `resolve.ts`), guest cart cache (`src/server/cart/cache.ts`, `actions.ts`), idempotency keys for order placement (`src/server/idempotency/cache.ts`, `src/server/orders/place.ts`, `state-machine.ts`, `stock.ts`), slug-availability lookups (`src/app/signup/slug-status.ts`), and rate-limit counters (below).
  - Degradation contract (applies uniformly across every consumer): when Upstash credentials are absent, each caller falls back to a direct-DB read or "allow-all" behavior and logs exactly one loud `console.warn` — explicitly documented as never silently degrading, and explicitly rejecting any in-process fallback counter (dishonest under Vercel's unbounded concurrent serverless instances).

## Authentication & Identity

**Auth Provider:**
- Better Auth 1.6.29 (self-hosted, not a third-party SaaS) — `src/server/auth/auth.ts`, mounted at `src/app/api/auth/[...all]/route.ts`.
  - Persistence: Better Auth's own Prisma adapter (`better-auth/adapters/prisma`), against the same Neon Postgres database (`User`, `Session`, `Account`, `Verification`, `Organization`, `Member`, `Invitation` models in `prisma/schema.prisma` — schema emitted by `npx auth generate`, then hand-corrected for NOT NULL / default-value guarantees).
  - Tenant model: the `organization` plugin (`better-auth/plugins`) is the tenant primitive — one `Organization` == one storefront == one merchant. `organizationLimit: 1`, `allowUserToCreateOrganization: false` (organizations are only created via a system-action bypass in the signup server code, never through the public API).
  - Platform Super Admin: a `platformRole` field on `User` (`"merchant"` default), not the Better Auth `admin` plugin — single-owner V1 scope.
  - Secrets: `BETTER_AUTH_SECRET` (32+ random bytes; rotating invalidates every session), `BETTER_AUTH_URL` (apex origin cookies/callbacks are issued against — dev `http://localhost:3000`, prod `https://einort.com`).
  - Cookie scope: deliberately apex-only, no `Domain` widening to `*.einort.com` — a stored-XSS on any tenant storefront must never be able to read the merchant/platform session (see extensive threat-model comment in `auth.ts`).
  - Rate limiting: Better Auth's built-in HTTP-endpoint throttle is wired to a custom Upstash-backed storage adapter (`authRateLimitStorage` in `src/server/rate-limit.ts`) rather than its default in-memory store.

## Monitoring & Observability

**Error Tracking:**
- None detected. No Sentry/Datadog/etc. SDK in `package.json`.

**Logs:**
- `console.warn` only, used pervasively and deliberately as the "loud degradation" signal for every optional external dependency (Upstash, Resend) and for security-relevant fallbacks. No structured logging framework.

## CI/CD & Deployment

**Hosting:**
- Vercel (inferred throughout codebase comments — Server Action body-size-limit discussion in `src/server/images/r2.ts`, serverless connection-pooling rationale in `src/server/db/base.ts`, `x-forwarded-for` trust model in `src/server/rate-limit.ts`, and `CLAUDE.md`'s stated stack). No `vercel.json` present (defaults).

**CI Pipeline:**
- None detected. No `.github/workflows/` directory found in the repo.

## Environment Configuration

**Required env vars (validated at boot, `src/env.ts`):**
- `DATABASE_URL` (Neon pooled), `DIRECT_URL` (Neon unpooled, CLI/migrations only)
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` (all five required)
- `NEXT_PUBLIC_ROOT_DOMAIN` (client-exposed; sole input to hostname/tenant classification — blank or wrong takes every storefront offline)

**Optional env vars:**
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (required in production, optional in dev/test)
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (optional in every environment)
- `TEST_DATABASE_URL` (test-only, `.env.test`)
- `SKIP_ENV_VALIDATION` (escape hatch for lint/typecheck/CI paths with no secrets)

**Secrets location:**
- `.env.local` (gitignored) for local development; `.env.test` (gitignored) for the isolation test suite. Templates committed as `.env.example` and `.env.test.example` with inline per-provider setup instructions (Neon console, Better Auth secret generation, Upstash console, Cloudflare R2 dashboard, Resend dashboard).

## Webhooks & Callbacks

**Incoming:**
- None. No live PSP means no payment webhook receiver. `src/app/api/auth/[...all]/route.ts` is the only catch-all API route, and it is Better Auth's own handler (session/org management), not a third-party callback.

**Outgoing:**
- None (no webhook dispatch to external systems). Customer-facing "notifications" are deep links the merchant/customer opens manually: `wa.me` (WhatsApp) links and `tel:`/USSD-style deep links for MTN MoMoPay / Orange Money, built from `MerchantPaymentSettings` — not API calls.

---

*Integration audit: 2026-08-30*
