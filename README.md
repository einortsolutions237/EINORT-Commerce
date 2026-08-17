# EINORT-Commerce

A multi-tenant commerce platform. One deployment serves every merchant's
storefront on its own subdomain: `{store}.einort.com` in production,
`{store}.localhost:3000` in development.

---

## Prerequisites

| Requirement | Notes |
| --- | --- |
| **Node.js 24 LTS** | `node -v` should print `v24.x`. |
| **A Neon Postgres branch** | Supplies `DATABASE_URL` (pooled) and `DIRECT_URL` (unpooled — same host, without `-pooler`). Prisma 7 requires an explicit driver adapter, configured in `prisma.config.ts`; there is no implicit query engine. |
| **A second Neon branch for tests** | Supplies `TEST_DATABASE_URL` in `.env.test`. The isolation suite truncates and reseeds, so it must never point at the development branch — `tests/setup/global-setup.ts` fails closed rather than falling back. |
| **Upstash Redis** *(optional locally)* | `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. Without them the rate limiters allow every request and log one warning; there is deliberately no in-process counter fallback, because a per-instance counter across serverless instances reads as a working control while providing none. |

Copy `.env.example` to `.env.local` and `.env.test.example` to `.env.test`, then
fill both in. Every key is validated at boot by `src/env.ts`, so a missing or
blank value fails immediately with a named error rather than at first use.

`NEXT_PUBLIC_ROOT_DOMAIN` must be `localhost:3000` for local development. It is
what every hostname is classified against — blank or wrong, and every request
looks like the apex, so no storefront resolves.

---

## Run it locally

```bash
npm install
npx prisma migrate deploy
npm run dev
```

`npm install` runs `prisma generate` through `scripts/prisma-generate.mjs`,
which no-ops if there is no schema yet. If `@/generated/prisma/client` is
missing at build time, run `node scripts/prisma-generate.mjs` directly.

---

## Verifying multi-tenancy locally

**No hosts-file edit, no dnsmasq, no ngrok, no tunnel.** Chrome, Edge and
Firefox resolve any `*.localhost` name to `127.0.0.1` with zero configuration,
on Windows included. Just type the address.

With the dev server running, open these three URLs:

| URL | Expected |
| --- | --- |
| <http://localhost:3000/> | The EINORT apex placeholder: wordmark, tagline, one button. |
| <http://store1.localhost:3000/> | That merchant's storefront — **if a store with the slug `store1` exists**. Sign one up at <http://localhost:3000/signup> first. |
| <http://nosuchstore.localhost:3000/> | The branded "Store not found" page, **not** a framework 404. |

A fourth check is worth doing once, because it is a real isolation boundary
rather than a nicety:

| URL | Expected |
| --- | --- |
| <http://localhost:3000/s/store1> | **404.** `/s/{slug}` is an internal rewrite target, not a public route. If this renders a storefront, tenant identity has become forgeable from the URL. |

### The full journey

1. <http://localhost:3000/> → click **Create my store**
2. On `/signup`, enter an email, a password (8+ characters), and a store
   address. The address is checked live as you type: below 3 characters nothing
   fires; above it you get available / taken / reserved / invalid feedback
   within about half a second.
3. Submit. You are redirected to `http://{your-address}.localhost:3000/`, which
   is your own storefront.

If store creation ever fails after the account is created, the merchant is not
stranded — `/onboarding/create-store` lets any signed-in user with no store
pick an address and finish.

---

## Production-mode smoke check

`next dev` and `next start` do not exercise the same code path for
`src/proxy.ts`, and a Windows-specific regression in this area has been
reported before (Next.js issue #85243). Run this before trusting a build:

```bash
npx next build
npx next start
```

Then, in a second terminal:

```bash
# A live storefront must render under production mode, not just under next dev.
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: store1.localhost" http://localhost:3000/
curl -s -H "Host: store1.localhost" http://localhost:3000/ | grep -o "Store coming soon"

# An unknown subdomain must still 404.
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: nosuchstore.localhost" http://localhost:3000/

# The internal rewrite prefix must not be reachable from the apex.
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/s/store1
```

Expected: `200`, `Store coming soon`, `404`, `404`. Replace `store1` with a slug
that actually exists in your development database.

If the storefront request returns the apex page instead, the Proxy is not
running. **Do not work around it by renaming `src/proxy.ts` back to
`middleware.ts`** — `middleware.ts` is deprecated and slated for removal, and
the workaround would have to be undone. Treat it as a blocking finding.

---

## Tests and gates

| Command | What it covers |
| --- | --- |
| `npm run test:unit` | Unit project only. No database, no network, a couple of seconds. This is the gate to run after every change. |
| `npm run test:full` | Unit **and** isolation projects against the Neon test branch. Requires `TEST_DATABASE_URL` in `.env.test`. Takes a few minutes — the isolation project runs files serially because they share one branch. |
| `npm run lint` | ESLint at `--max-warnings=0`. This is also the tenant-isolation enforcement mechanism: import zones make reaching for the unscoped Prisma client a build error rather than a review comment. |
| `npm run typecheck` | `tsc --noEmit`. Run `npx next build` first if it complains about `PageProps`/`LayoutProps` — those are generated by the build. |

---

## Layout

```
src/
  proxy.ts                    Hostname -> tenant routing. Must live in src/, not the repo root.
  env.ts                      Boot-validated environment surface.
  app/
    page.tsx                  Apex placeholder.
    signup/                   Merchant signup + the live store-address field.
    onboarding/create-store/  Recovery for a signup that half-failed.
    s/[slug]/                 Storefront. Internal rewrite target only.
    store-not-found/          One branded failure page for every unresolved host.
  server/
    db/                       base / platform / tenant-scoped / admin clients.
    tenant/                   Hostname classification, slug rules, resolution cache.
    auth/                     Better Auth, tenant provisioning.
  lib/strings.ts              All user-facing copy. Never inline a literal in JSX.
```
