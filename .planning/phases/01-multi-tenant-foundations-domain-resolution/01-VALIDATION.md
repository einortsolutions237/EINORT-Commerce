---
phase: 1
slug: multi-tenant-foundations-domain-resolution
status: ready-for-execution
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-16
updated: 2026-08-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` — created by plan 01-01 Task 3 (wave 1) |
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

Task IDs below are `{plan}.T{n}` and refer to the `<task>` blocks in the corresponding `PLAN.md`. The requirement→test mapping is fixed by research; the Task/Plan/Wave columns are the planner's assignment of that mapping onto the seven plans.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Created By | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-----------------|--------|
| 04.T2 | 01-04 | 3 | TEN-01 | see 01-04 `<threat_model>` | Every tenant-scoped model has `tenantId` + a `tenantId`-leading index | unit | `npx vitest run tests/isolation/model-registry-drift.test.ts` | 01-04 T2 | ⬜ planned |
| 04.T2 | 01-04 | 3 | TEN-02 | see 01-04 `<threat_model>` | All 14 Prisma ops inject `tenantId`; unregistered models throw | integration | `npx vitest run tests/isolation/tenant-isolation.test.ts -t "injects"` | 01-04 T2 (extension: 01-02 T2) | ⬜ planned |
| 01.T3 | 01-01 | 1 | TEN-02 | see 01-01 `<threat_model>` | No module outside allowed zones imports `prismaBase`/generated client; no stray `$queryRaw` | lint | `npx eslint . --max-warnings=0` | 01-01 T3 (`eslint.config.mjs`) | ⬜ planned |
| 03.T1 | 01-03 | 2 | TEN-03 | see 01-03 `<threat_model>` | Hostname classification is exact and fails closed | unit | `npx vitest run tests/unit/host.test.ts` | 01-03 T1 | ⬜ planned |
| 03.T2 | 01-03 | 2 | TEN-03 | see 01-03 `<threat_model>` | Client-supplied `x-tenant-id` header is stripped by the proxy | unit | `npx vitest run tests/unit/proxy.test.ts -t "strips"` | 01-03 T2 | ⬜ planned |
| 02.T2 + 04.T2 | 01-02, 01-04 | 2, 3 | TEN-05 | see 01-02 / 01-04 `<threat_model>` | `adminDb` is unscoped and importable only from `server/admin/**` | lint + integration | `npx eslint . --max-warnings=0` + `vitest -t "adminDb sees both tenants"` | 01-02 T2 (client + zone), 01-04 T2 (assertion) | ⬜ planned |
| 03.T1 + 06.T2 + 07.T1 | 01-03, 01-06, 01-07 | 2, 5, 6 | TEN-06 | see 01-03 / 01-06 / 01-07 `<threat_model>` | Reserved slugs rejected at form, write, and route layers | unit + integration | `npx vitest run tests/unit/slug.test.ts tests/isolation/signup.test.ts` | 01-03 T1 (schema + unit), 01-06 T2 (write layer), 01-07 T1 (form layer) | ⬜ planned |
| 04.T2 | 01-04 | 3 | TEN-07 | see 01-04 `<threat_model>` | Two-tenant isolation suite green across every registered model | integration | `npx dotenv -e .env.test -- npx vitest run tests/isolation` | 01-04 T2 (fixture: 01-04 T1) | ⬜ planned |
| 04.T2 | 01-04 | 3 | TEN-08 | see 01-04 `<threat_model>` | Caller-supplied `tenantId` in `data`/`where` is overwritten, never honoured | integration | `vitest -t "ignores client-supplied tenantId"` | 01-04 T2 (extension: 01-02 T2) | ⬜ planned |
| 06.T2 | 01-06 | 5 | DOM-01 | see 01-06 `<threat_model>` | Signup produces a resolvable slug; `resolveTenantBySlug` returns it | integration | `vitest -t "signup provisions a resolvable store"` | 01-06 T2 (resolver: 01-05 T1) | ⬜ planned |
| 03.T1 | 01-03 | 2 | DOM-02 | see 01-03 `<threat_model>` | Unknown/foreign/deep hostnames never resolve to any tenant | unit | `npx vitest run tests/unit/host.test.ts -t "fails closed"` | 01-03 T1 | ⬜ planned |
| 03.T2 | 01-03 | 2 | DOM-02 | see 01-03 `<threat_model>` | `GET einort.com/s/{slug}` (internal rewrite prefix) returns 404 from the apex | unit | `npx vitest run tests/unit/proxy.test.ts -t "internal prefix"` | 01-03 T2 | ⬜ planned |
| 05.T1 | 01-05 | 4 | TEN-03, DOM-02 | see 01-05 `<threat_model>` | Resolution is cached, negative-cached and fail-closed; suspended is indistinguishable from unknown | integration | `npx dotenv -e .env.test -- npx vitest run tests/isolation/resolve.test.ts --reporter=dot` | 01-05 T1 (fixture: 01-04 T1) | ⬜ planned |
| 05.T2 | 01-05 | 4 | DOM-02 | see 01-05 `<threat_model>` | Unknown and suspended hostnames render one shared branded 404 body | build + unit | `npx next build && npm run lint && npx vitest run tests/unit --reporter=dot` | 01-05 T2 | ⬜ planned |
| 06.T2 | 01-06 | 5 | ONB-01 | see 01-06 `<threat_model>` | Signup creates user + org + membership; a second store attempt is refused | integration | `npx vitest run tests/isolation/signup.test.ts` | 01-06 T2 | ⬜ planned |
| 07.T1 | 01-07 | 6 | TEN-06, ONB-01 | see 01-07 `<threat_model>` | Live store-address check fails open on rate-limit; stale in-flight responses cannot overwrite current state | unit | `npx vitest run tests/unit/slug-status.test.ts --reporter=dot` | 01-07 T1 | ⬜ planned |
| 07.T2 + 07.T3 | 01-07 | 6 | — | see 01-07 `<threat_model>` | Windows `next build && next start` actually serves the proxy rewrite (Pitfall 10) | manual smoke | `next build && next start`, then `curl -H "Host: store1.localhost" localhost:3000/` | 01-07 T2 (smoke), 01-07 T3 (human-verify gate) | ⬜ planned |

Threat Ref column points at the per-plan `<threat_model>` STRIDE register, which is authoritative for threat IDs (`T-01-01` … `T-01-52`).

---

## Wave 0 Requirements

Wave 0 (test scaffolding) is fully scoped across plans 01-01, 01-03, 01-04 and 01-06. Every row in the map above has a named creating task.

- [ ] `vitest.config.ts` — two projects (`unit`, `isolation`), `globalSetup` for the isolation project → **01-01 T3 (wave 1)**
- [ ] `.env.test` + `TEST_DATABASE_URL` pointing at a dedicated Neon branch (Docker is unavailable on this machine — Testcontainers is not an option) → **01-01 T3 (wave 1)**, documented via `.env.test.example`
- [ ] `tests/setup/global-setup.ts` — `prisma migrate deploy`, then truncate + seed → **01-01 T3 (wave 1)** creates it with a runnable migrate step and an exported seed hook; **01-04 T1 (wave 3)** fills the truncate + seed hook
- [ ] `tests/setup/seed-two-tenants.ts` — tenants A and B, one row per registered model each → **01-04 T1 (wave 3)**
- [ ] `tests/unit/host.test.ts` — full hostname classification table → **01-03 T1 (wave 2)**
- [ ] `tests/unit/slug.test.ts` — format + reserved-word cases → **01-03 T1 (wave 2)**
- [ ] `tests/unit/proxy.test.ts` — `unstable_doesProxyMatch`, `isRewrite`, `getRewrittenUrl`, header-strip, `/s/` 404 → **01-03 T2 (wave 2)**
- [ ] `tests/isolation/tenant-isolation.test.ts` — model-generic isolation suite (iterates `TENANT_SCOPED_MODELS`, not per-model tests) → **01-04 T2 (wave 3)**
- [ ] `tests/isolation/model-registry-drift.test.ts` — schema-drift guard (every model with a `tenantId` column is registered) → **01-04 T2 (wave 3)**
- [ ] `tests/isolation/resolve.test.ts` — cache/negative-cache/fail-closed resolution → **01-05 T1 (wave 4)**
- [ ] `tests/isolation/signup.test.ts` — ONB-01 + TEN-06 write-layer → **01-06 T2 (wave 5)**
- [ ] `tests/unit/slug-status.test.ts` — form-layer availability state machine → **01-07 T1 (wave 6)**
- [ ] `eslint.config.mjs` — import-zone rules (Next 16 removed `next lint`; wire ESLint into package scripts + CI directly) → **01-01 T3 (wave 1)**
- [ ] Framework install: `npm i -D vitest@4.1.10 tsx@4.23.12 dotenv-cli@11.0.0` → **01-01 T3 (wave 1)**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Windows `next build && next start` serves the proxy (`proxy.ts`) rewrite correctly | — (Pitfall 10, regression risk) | Historical Windows-specific Next.js proxy/middleware regression (issue #85243, reported closed but unverified on this exact patch/OS combo) — needs a live smoke check, not just a unit test | `next build && next start`, then `curl -H "Host: store1.localhost" localhost:3000/` and confirm the tenant storefront renders, not a 404 or the apex page. Executed by **01-07 T2**, gated by the **01-07 T3** human-verify checkpoint. |

---

## Wave Gates

| Wave | Plans | Gate command before advancing |
|------|-------|-------------------------------|
| 1 | 01-01 | `npm run lint && npm run typecheck && npx vitest run tests/unit --reporter=dot --passWithNoTests` |
| 2 | 01-02, 01-03 | `npm run lint && npm run typecheck && npx vitest run tests/unit --reporter=dot && npx next build` |
| 3 | 01-04 | `npx dotenv -e .env.test -- npx vitest run --reporter=dot` |
| 4 | 01-05 | `npx dotenv -e .env.test -- npx vitest run --reporter=dot && npx next build` |
| 5 | 01-06 | `npx dotenv -e .env.test -- npx vitest run --reporter=dot && npm run lint` |
| 6 | 01-07 | `npm run lint && npm run typecheck && npx next build && npx dotenv -e .env.test -- npx vitest run --reporter=dot` |

Wave 4 is where `tests/isolation/resolve.test.ts` first runs; it consumes the `TENANT_A`/`TENANT_B` fixture created in wave 3 by 01-04 T1, which is why 01-05 depends on 01-04 rather than running beside it.

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies — every `<verify>` in all 7 plans carries an `<automated>` command
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — all 16 tasks across the 7 plans have automated verification, including the two checkpoint tasks (01-01 T1, 01-07 T3)
- [x] Wave 0 covers all MISSING references — every test file in the map has a named creating plan/task
- [x] No watch-mode flags — every command uses `vitest run`
- [x] Feedback latency < 10s (quick) — confirmed by research
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution
