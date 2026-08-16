---
phase: 1
slug: multi-tenant-foundations-domain-resolution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | none — Wave 0 installs (`vitest.config.ts`) |
| **Quick run command** | `npx vitest run tests/unit --reporter=dot` |
| **Full suite command** | `npx dotenv -e .env.test -- npx vitest run` |
| **Estimated runtime** | ~10s quick / full suite includes isolation project against a dedicated Neon branch |

Two Vitest projects: `unit` (node env, no DB, <2s) and `isolation` (node env, requires `TEST_DATABASE_URL`, `globalSetup` runs `prisma migrate deploy` + seeds two tenants).

---

## Sampling Rate

- **After every task commit:** `npx vitest run tests/unit --reporter=dot` + `npx eslint . --max-warnings=0` (both <10s, no DB)
- **After every plan wave:** `npx dotenv -e .env.test -- npx vitest run` (full suite, includes isolation)
- **Before `/gsd:verify-work`:** Full suite green + a Windows `next build && next start` smoke check (Pitfall 10 — Windows-specific proxy rewrite regression risk)
- **Max feedback latency:** 10s (quick) / full suite duration for wave gates

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TEN-01 | — | Every tenant-scoped model has `tenantId` + a `tenantId`-leading index | unit | `npx vitest run tests/isolation/model-registry-drift.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TEN-02 | — | All 14 Prisma ops inject `tenantId`; unregistered models throw | integration | `npx vitest run tests/isolation/tenant-isolation.test.ts -t "injects"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TEN-02 | — | No module outside allowed zones imports `prismaBase`/generated client; no stray `$queryRaw` | lint | `npx eslint . --max-warnings=0` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TEN-03 | — | Hostname classification is exact and fails closed | unit | `npx vitest run tests/unit/host.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TEN-03 | — | Client-supplied `x-tenant-id` header is stripped by the proxy | unit | `npx vitest run tests/unit/proxy.test.ts -t "strips"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TEN-05 | — | `adminDb` is unscoped and importable only from `server/admin/**` | lint + integration | `npx eslint . --max-warnings=0` + `vitest -t "adminDb sees both tenants"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TEN-06 | — | Reserved slugs rejected at form, write, and route layers | unit + integration | `npx vitest run tests/unit/slug.test.ts tests/isolation/signup.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TEN-07 | — | Two-tenant isolation suite green across every registered model | integration | `npx dotenv -e .env.test -- npx vitest run tests/isolation` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TEN-08 | — | Caller-supplied `tenantId` in `data`/`where` is overwritten, never honoured | integration | `vitest -t "ignores client-supplied tenantId"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DOM-01 | — | Signup produces a resolvable slug; `resolveTenantBySlug` returns it | integration | `vitest -t "signup provisions a resolvable store"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DOM-02 | — | Unknown/foreign/deep hostnames never resolve to any tenant | unit | `npx vitest run tests/unit/host.test.ts -t "fails closed"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DOM-02 | — | `GET einort.com/s/{slug}` (internal rewrite prefix) returns 404 from the apex | unit | `npx vitest run tests/unit/proxy.test.ts -t "internal prefix"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ONB-01 | — | Signup creates user + org + membership; a second store attempt is refused | integration | `npx vitest run tests/isolation/signup.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | — | Windows `next build && next start` actually serves the proxy rewrite (Pitfall 10) | manual smoke | `next build && next start`, then `curl -H "Host: store1.localhost" localhost:3000/` | ❌ W0 | ⬜ pending |

*Task/Plan/Wave columns filled in once the planner assigns tasks — the requirement→test mapping above is fixed by research.*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — two projects (`unit`, `isolation`), `globalSetup` for the isolation project
- [ ] `.env.test` + `TEST_DATABASE_URL` pointing at a dedicated Neon branch (Docker is unavailable on this machine — Testcontainers is not an option)
- [ ] `tests/setup/global-setup.ts` — `prisma migrate deploy`, then truncate + seed
- [ ] `tests/setup/seed-two-tenants.ts` — tenants A and B, one row per registered model each
- [ ] `tests/unit/host.test.ts` — full hostname classification table
- [ ] `tests/unit/slug.test.ts` — format + reserved-word cases
- [ ] `tests/unit/proxy.test.ts` — `unstable_doesProxyMatch`, `isRewrite`, `getRewrittenUrl`, header-strip, `/s/` 404
- [ ] `tests/isolation/tenant-isolation.test.ts` — model-generic isolation suite (iterates `TENANT_SCOPED_MODELS`, not per-model tests)
- [ ] `tests/isolation/model-registry-drift.test.ts` — schema-drift guard (every model with a `tenantId` column is registered)
- [ ] `tests/isolation/signup.test.ts` — ONB-01 + TEN-06 write-layer
- [ ] `eslint.config.mjs` — import-zone rules (Next 16 removed `next lint`; wire ESLint into package scripts + CI directly)
- [ ] Framework install: `npm i -D vitest@4.1.10 tsx@4.23.12 dotenv-cli@11.0.0`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Windows `next build && next start` serves the proxy (`proxy.ts`) rewrite correctly | — (Pitfall 10, regression risk) | Historical Windows-specific Next.js proxy/middleware regression (issue #85243, reported closed but unverified on this exact patch/OS combo) — needs a live smoke check, not just a unit test | `next build && next start`, then `curl -H "Host: store1.localhost" localhost:3000/` and confirm the tenant storefront renders, not a 404 or the apex page |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (all rows above currently ❌ W0)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s (quick) — confirmed by research
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 lands

**Approval:** pending
