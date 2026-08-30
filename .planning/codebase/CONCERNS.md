# Codebase Concerns

**Analysis Date:** 2026-08-30

**Project stage:** Actively executing a 6-phase GSD roadmap. Phases 1-2 merged wave-by-wave; Phase 3 is 10/16 plans in (Waves 1-3 merged, Waves 4-6 not started). Overall this is an unusually well-documented codebase — most "concerns" below are already known and logged by the team itself in `.planning/phases/*/deferred-items.md` and `.planning/STATE.md`, not blind spots this audit discovered. This document consolidates them plus a handful of new observations (pagination, RLS, dead config) found by direct inspection.

## Tech Debt

**Phase 1 & 2 never passed through the GSD verification gate:**
- Issue: Phases 1 and 2 were merged wave-by-wave directly to master without ever reaching `gsd-execute-phase`'s own verifier/code-review/`phase.complete` gate. No `02-VERIFICATION.md` exists.
- Files: `.planning/STATE.md` (Blockers/Concerns section), `.planning/phases/02-merchant-auth-entitlements-trial/`
- Impact: An automated decision-coverage check reported 0/13 of Phase 2's `02-CONTEXT.md` decisions (D-01–D-13) cited in plan `must_haves`/`truths` frontmatter. Manual grep confirmed D-04–D-09/10 and D-12 are cited by ID in task bodies, but D-01/D-02/D-03 are only cited as a range, and **D-11 and D-13 have no ID citation found anywhere** — unverified whether those two decisions have implementing tasks.
- Fix approach: Already queued in `STATE.md` — run `gsd-execute-phase 2` retroactively, plus `gsd-secure-phase` and `gsd-code-review --depth=deep` on Phases 1-3, once Phase 3 completes.

**`npm run test:full` runtime grew ~10x (from ~2 min to ~22-27 min):**
- Issue: `TENANT_SCOPED_MODELS` grew from 1 model to 10 in Phase 3 plan 03-01. `tests/isolation/tenant-isolation.test.ts` is model-generic and runs a 10-assertion battery per registered model, with a full reseed (`tests/setup/seed-two-tenants.ts`) before every single test.
- Files: `tests/isolation/tenant-isolation.test.ts`, `tests/setup/seed-two-tenants.ts`
- Impact: Every one of the remaining Phase 3 plans (03-02 through 03-16) ends with a ~22-27 min `test:full` run — a material fraction of total execution time for the rest of the phase. Documented in `.planning/phases/03-product-catalog-order-payment-claim-state-machine/deferred-items.md`.
- Fix approach (not yet evaluated/chosen): reseed once per `describe` instead of per `it` for read-only assertions; run the isolation project against local Postgres instead of remote Neon (round-trip latency to `eu-west-2` dominates the cost); or split a fast `test:isolation:smoke` (one representative model) for per-task gates, keeping the full matrix for per-plan gates.

**R2-hosted images render through a plain `<img>`, not `next/image`, in two dashboard pages:**
- Issue: `next/image` needs its source hostname declared in `next.config.ts`'s `images.remotePatterns` at build time; `env.R2_PUBLIC_BASE_URL` was only known at runtime when this was first hit, so the products-list thumbnail shipped as a plain `<img>` with an `eslint-disable-next-line @next/next/no-img-element`.
- Files: `src/app/(dashboard)/dashboard/products/page.tsx:97`, `src/app/(dashboard)/dashboard/orders/[id]/page.tsx:81`
- Status: `next.config.ts` now derives the R2 hostname from `env.R2_PUBLIC_BASE_URL` at build time and populates `images.remotePatterns` (added after the deferred-item was logged), so the *infrastructure* blocker is resolved. The two call sites above have not yet been swapped from `<img>` to `next/image`, and Phase 3's still-pending Wave 4/5 work (A2's image grid, claim screenshot thumbnails) will add more R2-rendered images that hit the same question.
- Fix approach: swap all `<img>` usages at R2-image call sites to `next/image` together in one pass now that `remotePatterns` is wired, rather than continuing to add ad-hoc `<img>` + eslint-disable pairs.

**TypeScript pinned to 5.9.3 instead of the stack-locked 7.0.2:**
- Issue: `typescript-eslint` does not yet support TypeScript >= 7.1 at the time this was pinned ([typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)).
- Files: `package.json` (`comment:typescript` key carries the same note at point of use), `.planning/phases/01-multi-tenant-foundations-domain-resolution/deferred-items.md` (D2)
- Impact: Project is running one TS minor below the version CLAUDE.md's stack research locked in (7.0.2), losing some of the Go-native compiler speed benefit that was the stated reason for choosing TS 7.
- Fix approach: One-line `package.json` change + `npm install` once `typescript-eslint` ships TS >= 7.1 support. Revert trigger already documented.

**Cosmetic Vitest config-loader warning on every run:**
- Issue: `vitest.config.ts` uses ESM syntax loaded as CommonJS, so every run prints an unsupported-features warning from `configLoader: 'native'`.
- Files: `vitest.config.ts`
- Impact: None — noise only, both documented fixes (rename to `.mts`, or repo-wide `"type": "module"`) were deliberately rejected as disproportionate for a cosmetic warning.
- Fix approach: Revisit only if the warning becomes a hard error in a future Vite major.

## Known Bugs

**Intermittent P2028 rollback error at isolation-suite teardown:**
- Symptoms: On some full-isolation-suite runs, an unhandled rejection prints *after* all tests have already passed and exited 0: `PrismaClientKnownRequestError ... Invalid prisma.$executeRawUnsafe() invocation: Transaction API error: A rollback cannot be executed on an expired transaction ... code: 'P2028'`, sometimes followed by `close timed out after 10000ms`.
- Files: `tests/setup/seed-two-tenants.ts:407` (the only `$executeRawUnsafe`, inside `seedTwoTenants`'s batch `$transaction([...])`)
- Trigger: Prisma's default 5s transaction timeout is exceeded by the batch truncate/reseed transaction against a remote Neon branch, most likely because scrypt password hashing (CPU-bound, blocks the event loop) makes some reseed cycles slow enough to overrun the budget; the rollback is then attempted after the connection pool has already been released.
- Workaround: None needed — result correctness is unaffected (171+ tests still pass, exit code 0). Suggested fix already identified: `db.$transaction(batch, { timeout: 30_000, maxWait: 10_000 })` plus draining in-flight work in `closeSeedClient` before disconnecting. Documented in `.planning/phases/01-multi-tenant-foundations-domain-resolution/deferred-items.md` (D4).

**`stock-race.test.ts` fails under branch contention or slow-Neon conditions:**
- Symptoms: All three concurrency cases in the stock-race test intermittently fail with timeout-shaped errors (wrong error TYPE from a losing transaction, a transaction leaving work behind, or a release rejecting) rather than logic-bug-shaped errors.
- Files: `tests/isolation/stock-race.test.ts`, `src/server/orders/place.ts:371` (`$transaction(..., { timeout: 15_000 })`)
- Trigger: Reproduced across three separate incidents — once during multi-agent concurrent `test:full` runs against a shared Neon branch, once during a *solo* sequential full-suite run (~27 min), and once as a much larger 77-test/13-file failure during four simultaneous Wave-3 executor agents each running their own `test:full`. The common thread is the 15s transaction timeout being tight relative to lock-wait time on a scale-to-zero Neon branch when the branch's compute has throttled down or warmed up mid-run, compounded by concurrent truncate-and-reseed cycles from parallel agents/worktrees racing the same shared branch.
- Workaround: Re-run the file solo on a quiet branch (isolated reruns pass 6/6 in ~68s both times tried). Not yet fixed as real code; the two candidate fixes are raising `place.ts:371`'s 15s timeout, or catching a timed-out transaction and mapping it to `OutOfStockError` only when the stock predicate provably did not match. At the infra level, a branch-per-agent or a cross-worktree lock around the isolation suite would remove the failure mode outright. Documented in `.planning/phases/03-product-catalog-order-payment-claim-state-machine/deferred-items.md`.

**Same-transaction `OrderEvent` rows share an identical `createdAt`, making event order a tie-break, not a guarantee:**
- Symptoms: `OrderEvent.createdAt` uses Postgres's `DEFAULT CURRENT_TIMESTAMP`, which resolves to the transaction's start time, not the statement's. `placeOrder`'s `MANUAL_TRANSFER` path writes two events (`fromState: null` genesis, then `ORDER_PLACED -> PAYMENT_PENDING`) in one transaction, so both land with byte-identical timestamps.
- Files: `src/server/orders/place.ts` (writer), `src/generated/prisma/models/OrderEvent.ts` (schema)
- Trigger: Any order-placement path that writes more than one `OrderEvent` in a single transaction.
- Workaround: None shipped yet. Affects the customer tracking timeline (Phase 3 plan 03-13, not yet built) and merchant order detail (03-16, not yet built) — either must order by `createdAt` plus a stable secondary key, or render same-transaction events as an unordered group. `tests/isolation/checkout-trust.test.ts` already asserts the event SET rather than order and documents this inline. Candidate fixes (a monotonic `sequence` column, `clock_timestamp()` as default, or app-supplied timestamps) are all schema or clock changes intentionally left to whoever owns the timeline UI. Documented in `.planning/phases/03-product-catalog-order-payment-claim-state-machine/deferred-items.md`.

## Security Considerations

**Tenant isolation is enforced at the application layer only — no database-level Row-Level Security:**
- Risk: The entire multi-tenant guarantee rests on Prisma Client Extensions (`scopedDb`, `src/server/db/tenant-scoped.ts`) stamping `tenantId` into every query. This is strong against ordinary application code but does not protect against a bypassed extension, a raw query, or any future direct-DB-access tooling. CLAUDE.md's own stack research explicitly recommends layering Postgres RLS underneath the extension as a "belt-and-suspenders" hardening pass, precisely because Prisma Client Extensions do not intercept nested writes (a documented pitfall — nested `create` on a tenant-scoped relation bypasses `scopedDb` entirely, which is why every tenant-scoped model's `tenantId` column is required with no default, turning a bypass into a compile-time type error / NOT NULL violation rather than a silent cross-tenant write).
- Files: `src/server/db/tenant-scoped.ts`, `src/server/tenant/`, `prisma/schema.prisma` (via `src/generated/prisma/internal/class.ts`'s inline schema — see the "Composite FK" and "TENANT_SCOPED_MODELS" comments)
- Current mitigation: Required (non-nullable, no-default) `tenantId` column on every tenant-scoped model; composite foreign keys (`references: [tenantId, id]`) so a forged cross-tenant relation ID is a Postgres constraint violation, not an application convention; an ESLint rule (`eslint.config.mjs`) banning direct imports from `@/generated/prisma*` outside `src/server/db/**`, `src/server/tenant/**`, `src/server/auth/**`.
- Recommendation: Add Postgres RLS as the documented hardening pass before scaling meaningfully past pilot, per CLAUDE.md's own guidance — it is explicitly deferred, not rejected.

**Rate limiting and checkout idempotency both fail OPEN on Redis/Upstash outage — by deliberate design, not oversight:**
- Risk: If Upstash is unreachable or misconfigured, `createLimiter` (rate limiting) and `rememberOrderForKey`/`recallOrderForKey` (idempotency) both degrade to "allow everything" rather than blocking. A Redis outage during an attack window means unthrottled login attempts, unthrottled payment-claim submissions, and unthrottled order placement (each successful placement decrements real stock) for the duration.
- Files: `src/server/rate-limit.ts` (`createLimiter`'s fail-open-and-log contract, all four limiters), `src/server/idempotency/cache.ts`
- Current mitigation: Explicitly the accepted trade, reasoned through in code comments — failing closed would convert a third-party Redis blip into "no Cameroonian merchant can take an order," judged strictly worse than a window of unthrottled traffic. Degradation is logged loudly (`console.warn`/`console.error`, once per process) rather than silent.
- Recommendation: No change recommended without a product-level reassessment — this is a considered trade-off, not a defect. Worth re-litigating only if abuse patterns are observed in production during a real Upstash incident.

**Missing platform-role/decision citations from Phase 2's decision-coverage audit (D-11, D-13) are unverified:**
- Risk: D-11 and D-13 in `02-CONTEXT.md` have no ID citation anywhere in the implementing plans, meaning it is unconfirmed whether their requirements were actually implemented (as opposed to implemented without being traced back to the decision).
- Files: `.planning/phases/02-merchant-auth-entitlements-trial/02-CONTEXT.md`, `.planning/STATE.md`
- Current mitigation: A semantic (non-ID-grep) review by the plan-checker separately confirmed all 13 decisions have *some* implementing tasks; only the ID-citation grep came up empty for D-11/D-13.
- Recommendation: Already queued for a retroactive `gsd-execute-phase 2` verification pass alongside Phases 1 and 3.

## Performance Bottlenecks

**`listOrdersForMerchant` and `listStorefrontProducts` fetch all rows with no pagination:**
- Problem: Both core list queries run an unbounded `findMany` — no `take`/`skip`/cursor — returning every order or every active product for a tenant in one response.
- Files: `src/server/orders/queries.ts:138` (`listOrdersForMerchant`), `src/server/storefront/queries.ts:107` (`listStorefrontProducts`)
- Cause: Not yet a problem at pilot scale (a new merchant with few orders/products), but orders accumulate unboundedly over a store's lifetime with no cap, and the `professional` plan tier has `products: null` (explicitly unlimited product count — see `src/server/entitlements/plans.ts`).
- Improvement path: Add cursor-based pagination to both queries before a real merchant accumulates enough order history or product count to make either page slow; the composite indexes (`@@index([tenantId, state, placedAt])` on `Order`) already support a keyset-pagination query shape without a schema change.

**Isolation test suite dominates CI wall-clock time (see Tech Debt above):**
- Problem: ~22-27 minutes per full run, growing with every tenant-scoped model added.
- Files: `tests/isolation/tenant-isolation.test.ts`, `tests/setup/seed-two-tenants.ts`
- Cause: Per-test reseed × model-generic 10-assertion battery, against a remote Neon branch.
- Improvement path: See Tech Debt entry above.

## Fragile Areas

**Shared Neon test branch under multi-agent/multi-worktree concurrency:**
- Files: `tests/setup/seed-two-tenants.ts`, `tests/isolation/*.test.ts`, `vitest.config.ts` (`fileParallelism: false`)
- Why fragile: `fileParallelism: false` only serializes files *within* one `vitest` process. Multiple GSD executor agents running `npm run test:full` concurrently in separate git worktrees (a pattern this project's own Wave-based execution model produces) interleave truncate-and-reseed cycles against the same shared Neon branch, producing large, non-deterministic multi-file test failures with no consistent error shape (documented: 77 failures across 13 files in one incident, with zero code changes to blame).
- Safe modification: Treat any `test:full` failure that occurs during a wave with multiple concurrent agents as environmental until reproduced on a solo, quiet run — do not treat it as a regression signal without first isolating to a single agent/branch.
- Test coverage gap: No branch-per-agent isolation or cross-worktree lock exists yet to prevent this class of failure outright.

**`stock-race.test.ts` timeout sensitivity (see Known Bugs above):**
- Files: `src/server/orders/place.ts:371`, `tests/isolation/stock-race.test.ts`
- Why fragile: A fixed 15s transaction timeout assumes lock-wait time on a scale-to-zero Neon branch stays well under that budget; both branch cold-starts and concurrent test contention have pushed real transactions past it.
- Safe modification: Any change to `place.ts`'s stock-decrement transaction logic should re-run this file solo, multiple times, before trusting a single green run.

## Scaling Limits

**Unbounded per-tenant order and product lists:**
- Current capacity: Fine for pilot-stage single-digit-to-low-hundreds order/product counts per merchant.
- Limit: No pagination ceiling exists; a merchant with thousands of historical orders or an unlimited-tier catalog of thousands of products will load the entire set into one dashboard/storefront render.
- Scaling path: Add pagination (see Performance Bottlenecks above) well before the platform's own stated 100 → 1,000 → 100,000 → 1,000,000-store growth targets are approached — this is exactly the kind of per-tenant-unbounded-query pattern that breaks first at scale.

**Shared-schema multi-tenant Postgres with no RLS backstop:**
- Current capacity: Adequate for pilot; the shared-schema-with-indexed-`tenantId` design is explicitly the only approach the project's own research judged viable at the 1M+-store target (schema-per-tenant/DB-per-tenant were rejected as unmanageable at that scale).
- Limit: Correctness currently depends entirely on every code path going through `scopedDb`/the Prisma Client Extension; there is no defense-in-depth layer.
- Scaling path: RLS layer, as already recommended in Security Considerations above — the project's own stack research (CLAUDE.md) calls this out as the intended hardening step, not yet executed.

## Dependencies at Risk

**None identified as currently at risk.** The stack is current as of research date (Aug 2026): Next.js 16.3.1, TypeScript 7.0.x (installed 5.9.3, see Tech Debt above), Prisma 7.9.1, Better Auth 1.6.29, React 19.2.x. Better Auth was chosen explicitly because Auth.js/NextAuth entered maintenance mode and its own maintainers now direct new projects to Better Auth — this decision is documented and sound, not itself a risk. Better Auth's July 2026 acquisition by Vercel is noted in CLAUDE.md as a factor but not flagged as introducing risk.

## Missing Critical Features

**No transactional email sending despite `resend` being a declared dependency and configured env vars:**
- Problem: `resend@6.22.0` is in `package.json`, and `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are declared (optional) in `src/env.ts` and `.env.example`, but no module anywhere in `src/` actually imports or calls the Resend SDK — no email-sending code exists.
- Blocks: Order confirmation emails, payment-claim-status emails, and any other merchant/customer notification channel beyond WhatsApp/dashboard are unimplemented. CLAUDE.md itself frames email as "low-priority for V1 given the WhatsApp/manual-payment-first design," so this may be intentional scope-trimming rather than an oversight — but the dependency and env plumbing exist without the feature, which is worth resolving one way or the other (implement it, or remove the unused dependency/env vars) before ship.

**No order cancellation state:**
- Problem: `OrderState` enum (`ORDER_PLACED, PAYMENT_PENDING, PAYMENT_CLAIMED, CONFIRMED, DISPUTED, FULFILLED`) deliberately has no `CANCELLED` member.
- Blocks: A merchant or customer cannot cancel an order once placed; this is a documented, deliberate V1 scope decision (Research doc's "Open Question 1"), not a bug — flagged here because it is a real product gap a future phase will need to close, and adding a new enum member later requires a full state-machine transition-table review (an enum member no transition can reach is explicitly called out in the schema comments as a state the machine must "defend against forever").

**No live payment gateway/PSP integration (by design):**
- Problem: V1 payments are manual Mobile Money/Orange Money transfer instructions + customer-submitted claim/verify flow + Cash on Delivery + WhatsApp order only. No live PSP exists — `PaymentOperator` enum values (`MTN_MOMO`, `ORANGE_MONEY`) "name the rails the customer used, not an integration" (schema comment).
- Blocks: Automatic payment confirmation, refunds, or any payment flow that doesn't route through a merchant manually reviewing a claimed reference number. This is an explicit V1 constraint (CLAUDE.md), not an oversight, but is the single largest manual-process dependency in the order lifecycle and the first place automation would reduce merchant workload in a future phase.

## Test Coverage Gaps

**Phase 3 Waves 4-6 (plans 03-11 through 03-16) not yet started:**
- What's not tested: Product image grid (A2), claim screenshot thumbnails, customer tracking timeline (03-13), merchant order detail's full audit-trail rendering (03-16), and whatever else those six plans cover — none of this code exists yet as of this analysis.
- Files: `.planning/phases/03-product-catalog-order-payment-claim-state-machine/03-11-PLAN.md` onward (plans only, no implementation)
- Risk: N/A — not yet built, not a coverage gap in shipped code. Listed here because `.planning/STATE.md` marks this as the immediate next work.
- Priority: N/A (roadmap item, not a defect)

**No `02-VERIFICATION.md` exists for Phase 2, and Phase 1 has no equivalent verification artifact confirmed:**
- What's not tested: Whether all 13 of Phase 2's CONTEXT.md decisions (D-01–D-13) are actually covered by passing tests, versus merely having *an* implementing task. Decision-coverage tooling and manual grep together leave D-11 and D-13 unconfirmed either way.
- Files: `.planning/phases/02-merchant-auth-entitlements-trial/`
- Risk: Low-probability but unquantified — the semantic review found implementing tasks for all 13 decisions, so this is most likely a citation/traceability gap rather than a functional gap, but it has not been closed out.
- Priority: Medium — already queued in `STATE.md` for a retroactive verification pass.

---

*Concerns audit: 2026-08-30*
