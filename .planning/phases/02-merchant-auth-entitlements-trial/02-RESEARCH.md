# Phase 2: Merchant Auth, Entitlements & Trial - Research

**Researched:** 2026-08-17
**Domain:** Session-derived tenant context, server-enforced subscription entitlements, trial lifecycle (Better Auth 1.6.29 `organization` plugin + Next.js 16.3.1 App Router + Prisma 7.9.1)
**Confidence:** HIGH on mechanism (every Better Auth and Next.js claim below was verified against the *installed* source or the *bundled* docs in `node_modules`, not against training data or the public website). MEDIUM on the commercial inputs (per-tier feature lists, exact staff-count semantics) — those depend on a document not in the repo.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Plan Selection at Signup**

- **D-01:** A plan-selection step is inserted between Phase 1's signup form submission and the redirect to the new storefront: `signup form → plan selection → storefront`. Not a change to Phase 1's existing 3-field form.
- **D-02:** The plan-selection screen shows real price points and the full planned per-tier feature list from the v4.0 Master Specification (Section 4.4) — Starter 5,000 FCFA/mo, Business 12,500 FCFA/mo ("Most Popular"), Professional 25,000 FCFA/mo, all with a 10-day trial — even though most listed features (bulk import, discount codes, staff accounts, etc.) aren't built or enforced yet. Sets accurate expectations for what the merchant is eventually paying for; do not invent a slimmer feature list.
- **D-03:** No payment or payment-method capture happens at signup. This is purely a preference pick. Billing/subscribing is deferred entirely to end-of-trial (see D-09/D-10).
- **D-04:** Business is pre-highlighted as the recommended/"Most Popular" tier, matching v4.0's own positioning.
- **D-05:** The plan pick is mandatory — no "decide later" skip option. The merchant must choose one of the three tiers to proceed to their storefront.
- **D-06:** The plan choice is changeable during the trial. Build a plan-switch mechanism now as part of this phase's dashboard work (not deferred) — a merchant can change their trial tier before it ends.

**Entitlement Enforcement Scope**

- **D-07:** Build the generic entitlement-checking mechanism (a `checkEntitlement(tenant, feature)`-style pattern) and prove it concretely on the one thing that's real this phase: staff-account and store limits (per v4.0's numbers — Starter: no staff accounts beyond owner, Business: up to 3, Professional: up to 10). Known future limits that belong to later phases (product count caps, discount-code access, etc.) get stubbed as registered-but-unenforced placeholders for Phase 3+ to wire in, not built out now.

**Trial Expiry Behavior**

- **D-08:** When the 10-day trial ends without a confirmed subscription, the dashboard goes **read-only** — the merchant can still log in and see everything (orders, products, once those exist in later phases), but cannot create/edit/publish anything until they subscribe. Not a hard lockout.
- **D-09:** Conceptually, subscribing at end-of-trial reuses the same manual-payment-claim pattern already designed for customer→merchant payments (Section 5 of the original build plan), just with the payer/payee reversed: merchant transfers to EINORT's own Mobile Money/Orange Money account, submits a claim (transaction reference + optional screenshot), and the platform owner (Super Admin) confirms it manually.
- **D-10:** **However, Phase 2 does NOT build this subscribe-via-claim flow.** It depends on the payment-claim infrastructure (transaction-reference uniqueness, claim submission, audit trail) that belongs to Phase 3 (`ORD-01` through `ORD-05`), which doesn't exist yet. Phase 2's expired-trial state shows a placeholder ("Contact us to subscribe" or equivalent — exact copy is Claude's discretion) instead of a working claim form. The real subscribe flow gets built once Phase 3's payment-claim system exists to reuse, or in a dedicated later phase — not decided here, just explicitly out of Phase 2's scope.

**Trial Visibility in the UI**

- **D-11:** A persistent, visible trial countdown/banner is shown in the dashboard the whole time the trial is active ("X days left in your trial").
- **D-12:** The banner escalates in urgency: neutral styling for most of the trial, shifting to a more urgent visual treatment (e.g. warning/red) in the final 1-2 days.
- **D-13:** No email reminder in this phase — dashboard banner only. Matches the already-documented low-priority status of transactional email (Resend) for V1 in the stack research.

### Claude's Discretion

- Exact copy/wording for the expired-trial placeholder ("contact us to subscribe" or equivalent).
- Exact visual treatment/threshold for the escalating urgency banner (what counts as "final 1-2 days" styling vs. neutral).
- Internal data-model specifics for how plan choice, trial start/end, and entitlement checks are represented (e.g. fields on Organization vs. a separate Subscription model) — follow whatever pattern research recommends, consistent with Phase 1's `scopedDb` conventions.

### Deferred Ideas (OUT OF SCOPE)

- The actual subscribe-via-claim flow (merchant pays EINORT via manual Mobile Money/Orange Money transfer + claim + Super Admin verification) — explicitly deferred past Phase 2, tied to Phase 3's payment-claim infrastructure existing first. Whichever phase builds it should re-read D-09/D-10 here.
- Email reminder for trial expiry — deferred, dashboard banner only for now.
- Full billing/invoice history, annual pricing toggle, and any other subscription-management depth beyond "pick a plan, see a countdown, go read-only at expiry" — out of scope for this phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim from REQUIREMENTS.md) | Research Support |
|----|---------------------------------------------|------------------|
| **TEN-04** | Tenant identity for the merchant dashboard is resolved server-side from the authenticated session only | Pattern 1 (Merchant DAL). `session.activeOrganizationId` is `input: false` at the Better Auth schema level — verified unforgeable at `plugins/organization/organization.mjs:827-831`. Phase 1 already proved the field is populated on signup *and* on every subsequent login (01-06-SUMMARY "A3, resolved"). Pitfalls 1, 2, 3 cover the ways a layout-level check leaks. |
| **SUB-01** | Starter, Business, and Professional plans run on one shared codebase, differentiated only by server-enforced entitlements (product limits, staff limits, editor capability, feature access) — never separate codebases or client-side-only gating | Pattern 2 (Entitlement Registry) + Pattern 5 (`organizationHooks` as the un-bypassable layer). Alternatives Considered explains why role-based Access Control (`better-auth/plugins/access`) is the wrong primitive for plan tiers. |
| **SUB-02** | Plan limits and trial state are checked server-side on every relevant write, not just hidden/disabled in the UI | Pattern 3 (the write gate / `merchantAction` wrapper) + Pattern 5. Next.js's own guidance is explicit that render-time gating is not a boundary — see Code Example 9 and Pitfall 2. **A live, un-gated write surface exists today**: `/api/auth/organization/*` — see Pitfall 6. |
| **ONB-05** | Every merchant gets a 10-day full-feature trial of their selected plan, enforced server-side, starting at signup | Pattern 4 (data model). `Organization.createdAt` is stamped by the endpoint and spread **last** over the request body (`crud-org.mjs:74-77`), so it is unforgeable and is a correct trial anchor. Pitfall 8 covers timezone/off-by-one on "days left". |
</phase_requirements>

---

## Summary

Phase 2 is not a feature phase; it is a **mechanism phase**, and almost all of its risk is concentrated in one question: *where does the check live so that it cannot be skipped?* Next.js's own bundled documentation (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`, shipped with the installed 16.3.1) answers this unambiguously and contradicts the most common intuition: **a layout is not a security boundary**, because it does not re-render on client-side navigation and does not control whether child segments render. Proxy (née middleware) is explicitly downgraded to "optimistic checks" only. The one recommended structure is a **Data Access Layer** — a `server-only` module wrapping `React.cache()` that every page, component and Server Action calls, so the check travels with the data rather than with the route.

That maps cleanly onto what Phase 1 already built. `scopedDb(tenantId)` is a data-access layer that makes tenant isolation structural; Phase 2's job is a second, thinner layer *above* it — `requireMerchantContext()` — that derives `tenantId` from `session.activeOrganizationId` (never from a URL segment, form field, or header) and returns a resolved entitlement snapshot alongside it. `scopedDb` then receives a tenant id whose only possible provenance is the session. That is TEN-04 satisfied structurally, in the same shape as TEN-02.

The second finding is more urgent and was not anticipated by the phase description. Better Auth's `organization` plugin registers **34 HTTP endpoints** under `/api/auth/organization/*`, and Phase 1's apex-only handler (`src/app/api/auth/[...all]/route.ts`) already serves all of them. Three of those are live, authenticated, un-gated write surfaces on the merchant's own tenant *right now*: `/organization/update` (which accepts a new `slug`, bypassing the `beforeCreateOrganization` reserved-slug gate and the `StoreSlugHistory` D-03 record entirely), `/organization/delete`, and `/organization/invite-member` + `/organization/add-member` (which default to a **membership limit of 100**). Phase 2 cannot claim SUB-02 ("checked on every relevant write") while those exist unguarded, and the fix is the same mechanism the phase already has to build: `organizationHooks`, the exact pattern Phase 1 used for `beforeCreateOrganization`. Better Auth 1.6.29 ships `beforeUpdateOrganization`, `beforeDeleteOrganization`, `beforeAddMember` and `beforeCreateInvitation` — verified in `plugins/organization/types.d.mts:323-582`.

Third: **this phase should install nothing.** Every capability it needs — session reading, plan storage, entitlement enforcement, distributed rate limiting for the new login endpoint, trial arithmetic — is available from packages already in `package.json`. The one genuine gap (login is an HTTP endpoint, so Phase 1's server-action rate limiters do not cover it) is closed by `rateLimit.customStorage`, an existing Better Auth option that accepts a small Upstash-backed adapter. Critically, the *obvious* alternative — setting `secondaryStorage` — would silently move sessions out of Postgres (`db/internal-adapter.mjs:20`) and break the `activeOrganizationId` back-fill Phase 1 spent a plan proving.

**Primary recommendation:** Build one `server-only` merchant DAL (`requireMerchantContext`) that resolves tenant id + plan + trial state from the session in a single `React.cache()`d call; express plan differences as a typed entitlement registry evaluated by one `assertEntitlement()` function; make every mutating Server Action go through a `merchantWriteAction()` wrapper that calls the DAL and refuses writes when the trial has expired without a subscription; and mirror the same checks into Better Auth `organizationHooks` so the live `/api/auth/organization/*` endpoints cannot be used to route around the wrapper. Store plan and trial state as `input: false` additional fields on `Organization` (the `status` precedent from Phase 1), and derive trial expiry from `Organization.createdAt` so there is never a nullable window.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Merchant login form (fields, validation UX, pending state) | Browser / Client | — | Client island under a Server Component shell, exactly as `src/app/signup/signup-form.tsx` does. Purely presentational. |
| Credential verification, session issuance, CSRF | API / Backend (Better Auth) | — | Delegated entirely to `better-auth`. `auth.api.signInEmail` + `nextCookies()`. Never hand-rolled (Phase 1 threat T-01-47). |
| Tenant identity for the dashboard (TEN-04) | API / Backend (DAL) | — | Derived from `session.activeOrganizationId` server-side. **Must not** touch the Browser tier at all — no tenant id in a URL, prop, or hidden field that a write path reads back. |
| Optimistic redirect of signed-out visitors away from `/dashboard` | Frontend Server (Proxy) | — | `src/proxy.ts`, cookie-presence only. Explicitly *not* a security boundary — Next docs call the equivalent pattern "NOT SECURE". A UX nicety that saves a render. |
| Authoritative auth check on every dashboard page/action | API / Backend (DAL) | — | Next.js docs: checks belong "as close as possible to your data source". Never a layout. |
| Plan / trial state storage | Database | — | Columns on `organization`. Single indexed PK read per request. |
| Entitlement evaluation (is this tenant allowed to do X?) | API / Backend | — | Pure function over a resolved snapshot. No I/O. Testable in the fast `unit` project. |
| Write gate (read-only mode, D-08) | API / Backend (Server Action wrapper) | Browser (disabled UI) | Server refuses; client *also* disables controls so the merchant is never confused (CONTEXT `<specifics>`). The client half is UX only and is assumed bypassed. |
| Staff/member limit enforcement | API / Backend (Better Auth `organizationHooks` + `membershipLimit`) | — | Must live at the Better Auth layer, because `/api/auth/organization/invite-member` and `/add-member` are live HTTP endpoints that no Server Action wrapper can intercept. |
| Trial countdown display | Frontend Server (Server Component) | Browser | Days-left is computed server-side from `Date.now()` and passed down as a number. Computing it in the browser makes it a function of the *client's* clock. |
| Plan-selection screen (prices, feature lists, "Most Popular") | Frontend Server + Browser | — | Server-rendered pricing content from `strings.ts`; one client island for the selection + submit. |
| Plan switch write (D-06) | API / Backend (Server Action) | — | Session-derived tenant, Zod-validated tier, no tenant id in the payload — the `createStoreForCurrentUser` precedent (T-01-49). |
| Rate limiting the login endpoint | API / Backend (Better Auth `rateLimit.customStorage`) | — | Login is an HTTP route handler, not a Server Action, so Phase 1's `signupLimiter` pattern cannot be applied to it by importing anything. |

---

## Project Constraints (from CLAUDE.md)

These are directives, not suggestions. The planner must verify compliance for every task.

| # | Constraint | Source | Impact on this phase |
|---|-----------|--------|---------------------|
| C-1 | **GSD workflow enforcement** — no direct repo edits outside a GSD command. | `## GSD Workflow Enforcement` | Procedural. |
| C-2 | **Tenant isolation enforced server-side on every query, non-negotiable.** | `## Project / Constraints` | TEN-04 is this constraint applied to the dashboard. |
| C-3 | **Never trust price, stock, tenant ID, or payment/order status from the client — always re-derive or re-validate server-side.** | `## Project / Constraints` | Extends to `planTier` and trial state: neither may ever arrive from a request body. |
| C-4 | **No live PSP/gateway integration in V1.** | `## Project / Constraints` | Rules out `@better-auth/stripe` outright, despite it modelling exactly this problem. See Alternatives Considered. |
| C-5 | Runtime uses the **pooled** Neon URL (`DATABASE_URL`); migrations use `DIRECT_URL`. | Stack table + `prisma.config.ts` | Any migration in this phase runs through the existing Prisma 7 config. |
| C-6 | **Prisma 7 requires an explicit driver adapter**; `datasource.url` in `schema.prisma` silently does nothing. | Stack "What NOT to Use" | Adding columns changes nothing here — do not add a `url`. |
| C-7 | **Postgres RLS deliberately deferred past V1.** | 01-02-SUMMARY "Intentional Debt" | Do not propose RLS as the entitlement mechanism. |
| C-8 | **Better Auth `organization` = tenant primitive**; platform Super Admin is a `platformRole` field on `User`, not the `admin` plugin. | Stack "Auth" rationale | Plan/trial fields belong on `Organization`. Do not add the `admin` plugin for the "Super Admin confirms subscription" flow (that is Phase 3+/6 anyway per D-10). |
| C-9 | **Zod v4 only** — `z.email()`, `z.flattenError()`, not the v3 chains. | `src/server/auth/signup.ts` comment | All new schemas follow the v4 top-level form. |
| C-10 | Import the generated Prisma client from `@/generated/prisma/client`, never `@prisma/client`; direct imports are lint-banned outside `src/server/{db,tenant,auth}/**`. | 01-02-SUMMARY "Notes for Downstream Plans" | A new `src/server/billing/**` or `src/server/entitlements/**` directory is **not** in the sanctioned lint zone — see Pitfall 12. |
| C-11 | Redis key namespaces are per-surface and explicit (`tenant:host:`, `rl:slugcheck`, `rl:signup`). | `src/server/rate-limit.ts` | Any new limiter gets its own prefix. |
| C-12 | **This is NOT the Next.js you know** — read `node_modules/next/dist/docs/` before writing code. | `nextjs-agent-rules` block | Honoured: every Next.js claim in this document is cited to a file under `node_modules/next/dist/docs/`. |
| C-13 | **TypeScript is pinned to 5.9.3, not the 7.0.2 in the stack table** — `typescript-eslint@8.67.0` hard-throws on TS ≥ 7.0, which takes down the ESLint gate that *is* the TEN-02/TEN-05 enforcement mechanism. | `package.json` `comment:typescript` | Do not "upgrade" TypeScript as part of this phase. Do not write code that requires a TS 7-only feature. |
| C-14 | Copy is **English**, centralised in `src/lib/strings.ts`; never inline a user-facing literal in JSX. | 01-01-SUMMARY, honoured by plans 05/06/07 | Plan-selection copy, trial banner, expired placeholder, login form labels all go in `strings.ts`. |
| C-15 | Forms use **Base UI primitives + `react-hook-form` directly** — shadcn's `form` component is empty under the Base UI registry and no Radix fallback was pulled in. `components.json` has `"registries": {}`. | 01-07-SUMMARY "Deferred Items" | The login form and plan-selection form follow `signup-form.tsx`, not a shadcn `<Form>` tutorial. |
| C-16 | **No `middleware.ts`.** Next 16 renamed the convention; the file is `src/proxy.ts`, and `git ls-files \| grep -c middleware.ts` is an asserted `0`. | 01-07-SUMMARY | Any auth-in-middleware guidance found online must be translated to `proxy.ts`. |

---

## Standard Stack

### Core — everything needed is already installed

| Library | Installed version | Purpose in this phase | Why standard |
|---------|-------------------|----------------------|--------------|
| `better-auth` | **1.6.29** — confirmed `npm view better-auth version` → `1.6.29`, i.e. the pinned version *is* the current latest [VERIFIED: npm registry] | Login (`auth.api.signInEmail`), logout (`auth.api.signOut`), session read (`auth.api.getSession`), tenant identity (`session.activeOrganizationId`), the un-bypassable entitlement hooks (`organizationHooks`), and login rate limiting (`rateLimit.customStorage`) | Already the project's auth primitive (C-8). Every API used below was read out of the installed `dist/`, so there is no version-drift risk. |
| `next` | 16.3.1 | `proxy.ts` optimistic redirect, Server Components, Server Actions, `React.cache()`-backed DAL | Installed. Its own bundled docs are the authority used throughout this document. |
| `@prisma/client` + `@prisma/adapter-pg` | 7.9.1 | Plan/trial columns; reads via `platformDb.organization` | Installed. `Organization` is deliberately **not** in `TENANT_SCOPED_MODELS` — it *is* the tenant — so plan/trial reads go through `platformDb`, exactly as `resolveTenantBySlug` does. |
| `zod` | 4.4.3 | Validating the plan-selection and plan-switch action inputs | Installed; C-9. |
| `@upstash/redis` + `@upstash/ratelimit` | 1.38.2 / 2.0.8 | Backing store for the new login limiter | Installed. Already wired with a documented degradation contract in `src/server/rate-limit.ts`. |
| `react-hook-form` | 7.85.0 | Login form + plan-selection form state | Installed; C-15. |
| `@base-ui/react` | ^1.7.0 | Form primitives | Installed; C-15. |
| `server-only` | 0.0.1 | Marks the DAL and entitlement modules server-only so a client import is a build failure | Installed. Vitest already aliases it (`vitest.config.ts:19-21`). |

**Installation for this phase:**

```bash
# Nothing. Deliberately.
```

### Supporting — evaluated and rejected

| Library | Version on registry | Why NOT to add it |
|---------|--------------------|--------------------|
| `date-fns` | 4.4.0 (published 2026-05-29) [VERIFIED: npm registry] | Listed in CLAUDE.md's stack table for "trial countdown (10-day enforcement)". Not needed. The trial is a **duration**, not a calendar span, so days-remaining is exactly `Math.ceil((trialEndsAt - Date.now()) / 86_400_000)` — three tokens, zero dependencies, and immune to the DST/locale bugs a calendar-day helper introduces. Adding it also drags in the `@date-fns/tz` question (v4 moved timezone support to a separate package, `@date-fns/tz@1.5.0`) for no gain. Revisit if a later phase needs real calendar arithmetic. |
| `next-safe-action` | 8.6.0 (published 2026-07-18, ~252k downloads/week, peer `next: ">= 14.0.0"` so 16.3.1 is in range) [VERIFIED: npm registry] | Genuinely the standard library for typed Server Actions with a middleware chain, and it would express `auth → entitlement → validate` elegantly. **Reject for this project**: plans 01-06 and 01-07 established a plain-action convention (`safeParse` + a `{ ok, error }` result union) that seven plans and 186 tests already depend on. Introducing a second action convention mid-build costs more in inconsistency than a ~40-line in-repo wrapper costs to write. Documented here so the planner does not re-litigate it. |
| `@better-auth/stripe` | 1.6.29 [VERIFIED: npm registry] | Models exactly this problem (plans with `limits`, `freeTrial.days`, `trialStart`/`trialEnd`, `referenceId` bound to an organization) and is first-party. **Excluded by C-4** — V1 has no PSP. Its *schema shape* is still the best available reference design; see Pattern 4. |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Plan/trial as `input: false` fields on `Organization` | A separate `Subscription` model with `tenantId`, registered in `TENANT_SCOPED_MODELS` | The separate model is the right shape once billing history, invoices and multiple subscription periods exist. Today it buys a second table, a second read, a `TENANT_SCOPED_MODELS` entry, and a chicken-and-egg problem (`scopedDb(tenantId)` needs the tenant id that the entitlement read is trying to resolve context for). It also does not match the `status` precedent, which is the one existing example of tenant-level platform state. **Recommendation: fields on `Organization` now**; the Phase-3+ payment-claim work that D-09/D-10 defer is the natural moment to introduce `Subscription`, and at that point the org columns become a denormalised cache of the current subscription. Record that as intentional debt. |
| A hand-written entitlement registry | Better Auth's `access` plugin / `dynamicAccessControl` | Wrong primitive. Access Control in Better Auth is **role**-scoped (`owner`, `admin`, `member`) and answers "may *this user* do X within the org". Entitlements are **plan**-scoped and answer "may *this tenant* do X at all". The merchant's role is `owner` on every tier, so encoding tiers as roles would either require three parallel role sets or a role rewrite on every plan switch. Keep them orthogonal: AC governs *who*, entitlements govern *what the tenant bought*. |
| A `checkEntitlement()` that returns a boolean | An `assertEntitlement()` that throws | Prefer **both**, with the boolean form named for reading (`can(...)`, used in Server Components to hide UI) and the throwing form named for writing (`assertEntitlement(...)`, used in actions). A single boolean-returning API makes the failure mode "developer forgot to check the return value", which is precisely the silent bypass the phase exists to prevent. This is the same reasoning that made `scopedDb` throw for unregistered models rather than pass through. |
| Redis-cached entitlements | Direct read on every request | CLAUDE.md's stack notes list "Trial/entitlement cache (optional)" as a Redis use case. **Do not build it in this phase.** The read is one indexed primary-key lookup on a row the request already needs. A cache introduces exactly one new failure mode — a downgraded tenant retaining Professional limits for the TTL — which is a *security* regression traded for a sub-millisecond saving. If a later phase adds it, invalidation must be on the plan-switch write, mirroring `invalidateTenantHost`. |
| `rateLimit: { storage: "secondary-storage" }` + an Upstash `secondaryStorage` | `rateLimit: { customStorage: … }` | **`secondaryStorage` is a trap here.** `db/internal-adapter.mjs:20` computes `databaseStoresSessions = !secondaryStorage \|\| options.session?.storeSessionInDatabase === true` — so merely configuring `secondaryStorage` moves session rows out of Postgres by default. That would invalidate the `databaseHooks.session.create.before` back-fill Phase 1 proved (01-06 "A3, resolved") and break `tests/isolation/signup.test.ts`'s assertions against the `session` table. `customStorage` sets *only* the rate-limit backend and is explicitly documented as taking precedence: *"NOTE: If custom storage is used storage is ignored"* (`@better-auth/core/dist/types/init-options.d.mts:160-164`). |
| `rateLimit: { storage: "database" }` | `customStorage` | Would require adding a `rateLimit` Prisma model and would put a write on the hot path of every auth request against the pooled Neon connection. Upstash is already provisioned and already the project's rate-limit substrate (C-11). |

---

## Package Legitimacy Audit

**This phase installs zero packages.** The audit below records the candidates that were evaluated and rejected, so a later plan does not re-open them without reading the reasoning.

`slopcheck` was **not available** in this environment (`command -v slopcheck` → not found; no Python package manager install was attempted inside the sandbox). Per the graceful-degradation rule this would normally force every recommended package to `[ASSUMED]` and require a `checkpoint:human-verify` before install — but since the recommendation is to install **nothing**, no such gate is required. **If the planner deviates and adds any package, it must be gated behind `checkpoint:human-verify`.**

| Package | Registry | Version verified | Downloads | Source repo | slopcheck | Disposition |
|---------|----------|------------------|-----------|-------------|-----------|-------------|
| `date-fns` | npm | 4.4.0 (`npm view`, 2026-05-29) | not measured | github.com/date-fns/date-fns | unavailable | **Not needed** — see Supporting table |
| `@date-fns/tz` | npm | 1.5.0 (`npm view`) | not measured | github.com/date-fns/tz | unavailable | **Not needed** |
| `next-safe-action` | npm | 8.6.0 (`npm view`, 2026-07-18) | 252,471/week (`api.npmjs.org` last-week point) | github.com/TheEdoRan/next-safe-action | unavailable | **Rejected** — convention conflict, not a legitimacy concern |
| `@better-auth/stripe` | npm | 1.6.29 (`npm view`) | not measured | github.com/better-auth/better-auth | unavailable | **Excluded by C-4** (no PSP in V1) |

**Packages removed due to slopcheck `[SLOP]` verdict:** none (tool unavailable; none proposed).
**Packages flagged `[SUS]`:** none.

**Verification of the *installed* stack** (the packages this phase actually leans on) was done more strongly than a registry lookup: every Better Auth API cited in this document was read out of `node_modules/better-auth/dist/**` and `node_modules/@better-auth/core/dist/**` on this machine, and `npm view better-auth version` returns `1.6.29`, matching the pin exactly. Every Next.js API cited was read out of `node_modules/next/dist/docs/**`, which ships with the installed 16.3.1.

---

## Architecture Patterns

### System Architecture Diagram

```
                          ┌───────────────────────────────────────────────┐
  Browser                 │  einort.com  (apex — D-07 cookie boundary)    │
  ───────                 └───────────────────────────────────────────────┘
     │                                       │
     │  GET /dashboard/*                     ▼
     │  POST <server action>       ┌────────────────────┐
     └────────────────────────────►│   src/proxy.ts     │  classifyHost → "root"
                                   │  (Node runtime)    │  + strip x-tenant-id
                                   │                    │  + OPTIMISTIC ONLY:
                                   │                    │    cookie present?
                                   └─────────┬──────────┘    no → 307 /login
                                             │               (NOT a security check)
                    ┌────────────────────────┴────────────────────────┐
                    │                                                 │
                    ▼                                                 ▼
        ┌───────────────────────┐                       ┌──────────────────────────┐
        │  Server Component     │                       │  Server Action           │
        │  app/(dashboard)/…    │                       │  "use server"            │
        └───────────┬───────────┘                       └────────────┬─────────────┘
                    │                                                 │
                    │        ┌────────────────────────────────────────┘
                    ▼        ▼
        ╔═══════════════════════════════════════════════════════════════╗
        ║  src/server/merchant/context.ts   — THE MERCHANT DAL          ║
        ║  requireMerchantContext()  · wrapped in React.cache()         ║
        ║                                                               ║
        ║   1. auth.api.getSession({ headers })                         ║
        ║        └─ no session ────────────────► redirect("/login")     ║
        ║   2. tenantId := session.activeOrganizationId   ◄── TEN-04    ║
        ║        └─ null ─────────────────► redirect("/onboarding/…")   ║
        ║   3. platformDb.organization.findUnique({ id: tenantId })     ║
        ║        └─ status !== "active" ──► redirect("/suspended")      ║
        ║        └─ planTier === null ────► redirect("/onboarding/plan")║
        ║   4. resolveEntitlements(org, now)  ── pure, no I/O           ║
        ║        → { tenantId, plan, trial:{state,daysLeft}, canWrite,  ║
        ║            limits }                                           ║
        ╚═════════╤═════════════════════════════════╤═══════════════════╝
                  │ read path                       │ write path
                  ▼                                 ▼
      ┌───────────────────────┐        ╔══════════════════════════════════╗
      │ scopedDb(ctx.tenantId)│        ║ assertCanWrite(ctx)   ◄── D-08   ║
      │  (Phase 1, TEN-02)    │        ║ assertEntitlement(ctx,"…")◄─SUB-01║
      │  stamps tenantId      │        ╚═══════════════╤══════════════════╝
      └───────────┬───────────┘                        │ passes
                  │                                    ▼
                  │                        ┌───────────────────────┐
                  │                        │ scopedDb(ctx.tenantId)│
                  │                        └───────────┬───────────┘
                  ▼                                    ▼
              ┌─────────────────────────────────────────────┐
              │            Neon Postgres 17                 │
              │  organization{ status, planTier, trial… }   │
              └─────────────────────────────────────────────┘

  ═══ SECOND, INDEPENDENT ENTRY POINT — bypasses everything above ═══

     POST /api/auth/organization/{update,delete,invite-member,add-member,…}
                    │   (34 live endpoints, apex-only, session-authenticated)
                    ▼
        ┌──────────────────────────────────────────────────────────┐
        │  better-auth organization plugin endpoint                │
        │    ├─ zod body schema  (strips input:false fields)       │
        │    ├─ hasPermission(role)                                │
        │    ├─ membershipLimit(user, organization)  ◄── SUB-01     │
        │    └─ organizationHooks.before*  ◄── THE ONLY GATE HERE   │
        └──────────────────────────────────────────────────────────┘
```

The two entry points at the bottom are the crux of the phase. A Server Action wrapper cannot intercept an HTTP route handler, and `organizationHooks` cannot see a Server Action. **Both layers must exist**, and the entitlement rules they consult must be the same module so they cannot drift.

### Recommended Project Structure

```
src/
├── app/
│   ├── login/
│   │   ├── page.tsx                    # Server Component shell (mirrors signup/page.tsx)
│   │   └── login-form.tsx              # client island: RHF + Base UI (C-15)
│   ├── onboarding/
│   │   ├── create-store/               # EXISTS (Phase 1) — do not restructure
│   │   └── plan/
│   │       ├── page.tsx                # D-01/D-02 pricing screen, server-rendered
│   │       └── plan-picker.tsx         # client island, D-04 "Most Popular" on Business
│   └── (dashboard)/                    # route group: no URL segment, shared chrome
│       ├── layout.tsx                  # shell + <TrialBanner/>. NOT an auth check (Pitfall 2)
│       └── dashboard/
│           └── page.tsx                # calls requireMerchantContext() itself
├── server/
│   ├── auth/
│   │   ├── auth.ts                     # EXTEND: rateLimit.customStorage, organizationHooks
│   │   ├── signup.ts                   # EXISTS — provisionStore is the trial-start anchor
│   │   └── login.ts                    # NEW: signInMerchant / signOutMerchant actions
│   ├── merchant/                       # NEW — the DAL (see Pitfall 12 re: lint zones)
│   │   ├── context.ts                  # requireMerchantContext, getMerchantContext
│   │   └── actions.ts                  # selectPlan, switchPlan (D-05, D-06)
│   ├── entitlements/                   # NEW — pure, no I/O, unit-testable
│   │   ├── plans.ts                    # PLAN_TIERS registry: prices, limits, features
│   │   ├── resolve.ts                  # resolveEntitlements(org, now) → snapshot
│   │   └── assert.ts                   # can(), assertEntitlement(), assertCanWrite()
│   └── rate-limit.ts                   # EXTEND: rl:login + the customStorage adapter
└── lib/
    └── strings.ts                      # EXTEND: login, plan, trial, readOnly namespaces (C-14)
```

**Note on the `(dashboard)` route group:** it needs no hostname guard. `src/proxy.ts` rewrites any storefront subdomain's `/dashboard` to `/s/{slug}/dashboard`, where no route file exists → 404. The dashboard is apex-only for free, by the same mechanism that makes `/api/auth/*` apex-only (`src/server/auth/auth.ts` header comment). State this in a comment so nobody "fixes" it later.

---

### Pattern 1: The Merchant DAL — one function, called everywhere

**What:** A `server-only` module exporting a `React.cache()`-memoised `requireMerchantContext()` that turns "this request" into "this tenant, this plan, this trial state, may-write yes/no" — or redirects.

**When to use:** At the top of *every* dashboard page, every dashboard leaf Server Component that reads tenant data, and every merchant Server Action. There is no other sanctioned way to learn the tenant id in the dashboard.

**Why this shape:**

- Next.js's bundled docs prescribe it by name: *"We recommend creating a DAL to centralize your data requests and authorization logic… Then use React's `cache` API to memoize the return value of the function during a React render pass"* [CITED: `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1129-1135`].
- `React.cache()` makes calling it in the layout, the page, and three leaf components cost exactly one `getSession` and one `organization` read per render pass. Without it, an auth-check-per-component pattern is prohibitively chatty.
- It mirrors `scopedDb`: the guarantee is structural, not remembered.

**Critical detail — `cache()` does NOT span a Server Action and its subsequent re-render.** React's `cache` is scoped to a single render pass. A Server Action that calls `requireMerchantContext()` and then triggers a re-render will re-resolve. That is correct and desirable (the action may have changed the plan), but it means the per-request cost is 2× when an action runs. Acceptable: two indexed reads.

```ts
// src/server/merchant/context.ts
import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth/auth";
import { platformDb } from "@/server/db/platform";
import { resolveEntitlements, type MerchantContext } from "@/server/entitlements/resolve";

/**
 * TEN-04, structurally.
 *
 * `tenantId` comes from `session.activeOrganizationId` and from nowhere else.
 * That field is declared `input: false` on the session schema by the
 * organization plugin (verified at
 * node_modules/better-auth/dist/plugins/organization/organization.mjs:827-831),
 * so no request body can set it. There is deliberately no parameter on this
 * function — a `requireMerchantContext(tenantId)` overload is the exact shape
 * of the bug this exists to prevent.
 */
export const requireMerchantContext = cache(async (): Promise<MerchantContext> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenantId = session.session.activeOrganizationId;
  // A user with an account and no store: Phase 1's recovery route owns this.
  if (!tenantId) redirect("/onboarding/create-store");

  const org = await platformDb.organization.findUnique({
    where: { id: tenantId },
    // DTO discipline: select, never spread the row into a client component.
    select: {
      id: true, name: true, slug: true, status: true,
      createdAt: true, planTier: true, trialEndsAt: true, subscriptionStatus: true,
    },
  });
  // Session outlived the organization (deleted / mid-migration). Fail closed.
  if (!org) redirect("/login");
  if (org.status !== "active") redirect("/suspended");
  // D-05: the plan pick is mandatory. This is the gate that enforces it.
  if (org.planTier === null) redirect("/onboarding/plan");

  return resolveEntitlements(org, new Date());
});
```

**Anti-shape to reject in review:** a `getTenantId(searchParams)` / `getTenantId(props.params.orgId)` helper. Phase 1 built the hostname resolver for storefronts precisely so tenant identity never comes from a client-controllable channel; the dashboard's equivalent channel is the session, and adding a parameter reintroduces the class of bug both requirements exist to close.

---

### Pattern 2: The entitlement registry — data, not conditionals

**What:** One typed table mapping plan tier → limits and feature flags, plus a pure resolver that turns `(organization, now)` into a snapshot.

**When to use:** Every plan-dependent decision in the codebase reads from here. No `if (plan === "professional")` anywhere else.

```ts
// src/server/entitlements/plans.ts
export const PLAN_TIERS = ["starter", "business", "professional"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

/**
 * D-07: every limit this product will ever gate is REGISTERED here now, even
 * where nothing reads it yet. A registered-but-unenforced key is a Phase 3+
 * wiring task with a compile-time home; an unregistered one is a design
 * decision someone will make ad hoc under time pressure.
 *
 * `null` means "unlimited". `0` means "not available on this tier" — and it is
 * genuinely 0, not absent, so a missing key is a TYPE ERROR rather than a
 * silently permissive `undefined`.
 */
export interface PlanLimits {
  /** Total org members INCLUDING the owner. See Open Question OQ-2. */
  readonly members: number;
  /** ENFORCED FROM PHASE 3. Registered now. */
  readonly products: number | null;
  /** ENFORCED FROM PHASE 4 (EDIT-03). Registered now. */
  readonly editorSections: number | null;
  /** ENFORCED IN v2 (COM-V2-01). Registered now. */
  readonly discountCodes: boolean;
  /** ENFORCED IN v2 (COM-V2-03). Registered now. */
  readonly bulkImport: boolean;
}

export interface PlanDefinition {
  readonly tier: PlanTier;
  /** XAF minor-unit-free integer. XAF has no decimal subunit in common use. */
  readonly monthlyPriceXaf: number;
  readonly recommended: boolean;   // D-04
  readonly limits: PlanLimits;
}

export const PLANS: Readonly<Record<PlanTier, PlanDefinition>> = {
  starter:      { tier: "starter",      monthlyPriceXaf:  5_000, recommended: false, limits: { members: 1,  products: /* OQ-1 */ null, editorSections: null, discountCodes: false, bulkImport: false } },
  business:     { tier: "business",     monthlyPriceXaf: 12_500, recommended: true,  limits: { members: 4,  products: /* OQ-1 */ null, editorSections: null, discountCodes: false, bulkImport: false } },
  professional: { tier: "professional", monthlyPriceXaf: 25_000, recommended: false, limits: { members: 11, products: /* OQ-1 */ null, editorSections: null, discountCodes: false, bulkImport: false } },
} as const;
```

**Why a `Record<PlanTier, …>` and not a lookup with a default:** `Record` makes adding a fourth tier a compile error at every incomplete table, which is exactly the drift-detection property `TENANT_SCOPED_MODELS: readonly Prisma.ModelName[]` gives the tenant registry (01-02-SUMMARY, minor scope note 2). Follow the established idiom.

**Do not put the marketing copy here.** Prices are enforcement inputs and belong in code; the per-tier bullet lists D-02 asks for are user-facing copy and belong in `strings.ts` (C-14). Keeping them apart is what stops a copy revision from silently changing a limit.

The trial resolver:

```ts
// src/server/entitlements/resolve.ts  (pure — no imports from @/server/db)
export type TrialState = "active" | "expired" | "subscribed";

export const TRIAL_DAYS = 10;                              // ONB-05
const DAY_MS = 86_400_000;

export interface MerchantContext {
  readonly tenantId: string;
  readonly storeName: string;
  readonly storeSlug: string;
  readonly plan: PlanDefinition;
  readonly trial: { readonly state: TrialState; readonly endsAt: Date; readonly daysLeft: number };
  /** D-08. The single boolean every write path consults. */
  readonly canWrite: boolean;
}

export function resolveEntitlements(org: OrgRow, now: Date): MerchantContext {
  // Derive, don't store. `createdAt` is stamped by better-auth's own endpoint
  // and spread LAST over the request body (crud-org.mjs:74-77), so it cannot
  // be forged and there is no nullable window between insert and back-fill.
  // `trialEndsAt` is an optional override for support gestures; null is normal.
  const endsAt = org.trialEndsAt ?? new Date(org.createdAt.getTime() + TRIAL_DAYS * DAY_MS);

  const subscribed = org.subscriptionStatus === "active";
  const expired = !subscribed && now.getTime() >= endsAt.getTime();

  return {
    tenantId: org.id,
    storeName: org.name,
    storeSlug: org.slug,
    plan: PLANS[org.planTier],
    trial: {
      state: subscribed ? "subscribed" : expired ? "expired" : "active",
      endsAt,
      // Duration, not calendar days — see Pitfall 8. Never negative.
      daysLeft: Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS)),
    },
    canWrite: subscribed || !expired,
  };
}
```

`now` is a **parameter**, not `new Date()` inside the function. That single choice is what makes the entire trial lifecycle — day 1, day 9, day 10 boundary, day 11, subscribed-after-expiry — testable in the fast `unit` project with no database and no clock mocking.

---

### Pattern 3: The write gate — read-only mode that cannot be forgotten (D-08)

**What:** A wrapper that every mutating Server Action is built from, rather than a check every action is trusted to call.

**Why a wrapper and not a convention:** Next.js's own guidance is that *"Render-time gating (only rendering a form on an authenticated page) is not a security boundary, because requests can be sent without going through the UI"* and *"Treat Server Actions with the same security considerations as public-facing API endpoints"* [CITED: `node_modules/next/dist/docs/01-app/02-guides/server-actions.md:88, 95`]. There is no framework-level hook that runs before all actions. The only structural answer is to make the guarded form the *easiest* form to write.

```ts
// src/server/merchant/action.ts
import "server-only";
import { z } from "zod";

import { requireMerchantContext } from "./context";
import type { MerchantContext } from "@/server/entitlements/resolve";
import { strings } from "@/lib/strings";

export type ActionResult<T = void> =
  | ({ ok: true } & T)
  | { ok: false; error: Record<string, string[]> };

/**
 * D-08 / SUB-02. Every merchant mutation is built with this.
 *
 * Three properties are load-bearing:
 *
 *  1. `mode: "write"` is REQUIRED, not defaulted. A default would make the
 *     safe choice the one you have to remember, which is the failure this
 *     wrapper exists to remove.
 *  2. The handler receives `ctx` and the PARSED input. It has no way to reach
 *     the raw request, so it cannot accidentally read a tenant id out of it.
 *  3. `requireMerchantContext()` redirects rather than returning null, so an
 *     unauthenticated caller never reaches the handler at all.
 */
export function merchantAction<S extends z.ZodType, R>(config: {
  mode: "read" | "write";
  schema: S;
  handler: (ctx: MerchantContext, input: z.infer<S>) => Promise<ActionResult<R>>;
}) {
  return async (raw: unknown): Promise<ActionResult<R>> => {
    const ctx = await requireMerchantContext();

    if (config.mode === "write" && !ctx.canWrite) {
      // Not a 403 page and not a redirect: the merchant is legitimately signed
      // in and legitimately viewing this data. They are being told, in the
      // place they tried to act, exactly why it did not happen (CONTEXT
      // <specifics>: "never leave the merchant confused about their own state").
      return { ok: false, error: { form: [strings.trial.readOnlyBlocked] } };
    }

    const parsed = config.schema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }

    return config.handler(ctx, parsed.data);
  };
}
```

**The read-only state has three visible layers, and only the innermost is a control:**

| Layer | Where | Purpose | Bypassable? |
|-------|-------|---------|-------------|
| Banner + disabled controls | Client components | The merchant understands their state | Yes — assumed bypassed |
| `mode: "write"` refusal | `merchantAction` wrapper | Blocks the Server Action path | No (for actions) |
| `organizationHooks.before*` | Better Auth config | Blocks the `/api/auth/organization/*` path | No |

Note that D-08 says *reads still work*. That is why the gate is a `canWrite` boolean on the context rather than a redirect out of the dashboard: an expired merchant must still be able to load `/dashboard` and see everything.

---

### Pattern 4: The data model — plan and trial as `input: false` fields on `Organization`

**What:** Four columns on `organization`, declared to Better Auth as `input: false` additional fields, exactly mirroring how Phase 1 handled `status`.

```prisma
model Organization {
  // … existing fields …
  status  String @default("active")   // existing, hand-corrected NOT NULL

  /// D-05: NULL means "signed up, has not picked a plan yet". This is the ONE
  /// place a nullable enum-ish column is correct in this schema, and it is
  /// deliberately different from the `status`/`platformRole` precedent (which
  /// were hand-corrected to NOT NULL because a third state there had no
  /// meaning). Here the third state is the D-01 flow itself, and exactly one
  /// gate handles it: requireMerchantContext() redirects to /onboarding/plan.
  planTier            String?

  /// Optional override for a support-granted trial extension. NULL is normal
  /// and means "derive from createdAt + TRIAL_DAYS". Deriving rather than
  /// stamping means there is no window in which a just-created organization
  /// has no trial, and no second write that can fail.
  trialEndsAt         DateTime?

  /// D-09/D-10: "none" until a later phase builds the claim flow. NOT NULL so
  /// no authorization check has to special-case a third state — the same
  /// argument 01-02 used for `status`.
  subscriptionStatus  String   @default("none")

  /// Audit breadcrumb for D-06 plan switches. Cheap, and the alternative
  /// (reconstructing tier history) is impossible after the fact.
  planSelectedAt      DateTime?
}
```

And in `src/server/auth/auth.ts`, inside `organization({ schema: { organization: { additionalFields: { … } } } })` alongside the existing `status`:

```ts
planTier:           { type: "string", input: false, required: false },
trialEndsAt:        { type: "date",   input: false, required: false },
subscriptionStatus: { type: "string", input: false, required: false, defaultValue: "none" },
planSelectedAt:     { type: "date",   input: false, required: false },
```

**Why `input: false` is a real control and not decoration** [VERIFIED: installed source]:

1. `/organization/create` builds its body schema as `z.object({ ...baseOrganizationSchema.shape, ...additionalFieldsSchema.shape })` where `additionalFieldsSchema = toZodSchema({ fields, isClientSide: true })` (`plugins/organization/routes/crud-org.mjs:20-30`).
2. `toZodSchema` drops `input: false` fields when `isClientSide` is set: `if (isClientSide && field.input === false) return acc;` (`db/to-zod.mjs:7`).
3. Zod's `z.object` strips unknown keys by default, so a forged `{"planTier":"professional"}` in the create body is discarded before `ctx.body` exists.
4. `/organization/update` uses the identical construction (`crud-org.mjs:166-172`), so the same is true for updates.

That is C-3 ("never trust … from the client") satisfied at the library boundary, with the same mechanism `status` already relies on.

**Writes go through `platformDb.organization.update`,** not through Better Auth — which is correct, because `input: false` means there is no API path to set them, by design. `platformDb` already exposes the `organization` delegate (`src/server/db/platform.ts:30-32`) and is the sanctioned client for a model with no `tenantId`. Do not add `Organization` to `TENANT_SCOPED_MODELS`; `scopedDb` will (correctly) throw for it.

**Reference design.** The field set above is a deliberate subset of `@better-auth/stripe`'s `subscription` table — `plan`, `referenceId`, `status`, `periodStart/End`, `trialStart/trialEnd`, `limits` on the plan definition [CITED: better-auth.com/docs/plugins/stripe]. When D-09/D-10's claim flow lands, promoting these columns to a real `Subscription` model with that shape is the migration, and having used the same names makes it mechanical.

**Backfill.** `alpha-store` and `recovered-store` already exist on the development Neon branch (01-07-SUMMARY "Test data") with no plan. `planTier String?` makes the migration additive with no backfill required — they will hit the `/onboarding/plan` redirect on first dashboard visit, which is the correct behaviour and is also a free manual test of D-05.

---

### Pattern 5: `organizationHooks` — the layer that cannot be routed around

**What:** Entitlement checks registered inside `betterAuth({ plugins: [organization({ organizationHooks: { … } })] })`, consuming the *same* `src/server/entitlements/**` module the Server Action wrapper uses.

**When to use:** For every `/api/auth/organization/*` endpoint that mutates tenant state. This is the exact pattern Phase 1 already established for `beforeCreateOrganization` as "the AUTHORITATIVE layer of the three-layer TEN-06 defence" (`src/server/auth/auth.ts:195-215`). Phase 2 extends the same idea to entitlements.

Available hooks in 1.6.29 [VERIFIED: `plugins/organization/types.d.mts:323-582`]: `beforeCreateOrganization`, `afterCreateOrganization`, `beforeUpdateOrganization`, `afterUpdateOrganization`, `beforeDeleteOrganization`, `afterDeleteOrganization`, `beforeAddMember`, `afterAddMember`, `beforeRemoveMember`, `afterRemoveMember`, `beforeCreateInvitation`, `afterCreateInvitation`, `beforeAcceptInvitation`, `beforeRejectInvitation`, `beforeCancelInvitation`, plus the team variants.

**Three traps, all verified in the installed source:**

1. **The re-spread trap differs between create and update.** Phase 1 documented that `beforeCreateOrganization` returning `{ data }` causes `orgData = { ...ctx.body, ...response.data }` — re-injecting *the entire request body* including non-column fields (`crud-org.mjs:63-72`). `beforeUpdateOrganization` is milder: `ctx.body.data = { ...ctx.body.data, ...response.data }` (`crud-org.mjs:218-224`) — it merges only over the already-parsed `data`. **Keep the throw-or-void discipline for both anyway.** A rule with an exception is a rule nobody follows.

2. **`beforeAddMember` fires for the organization creator's own membership.** `crud-org.mjs:85-99` invokes it while creating the owner's `Member` row during `/organization/create`. A naive "members limit reached" check would therefore refuse every signup on the Starter tier (limit 1, count 0 → but the *hook* runs before the count matters). Guard on `role !== creatorRole`, or place the limit logic only in `membershipLimit`, which is checked with a real count.

3. **`membershipLimit` is NOT checked when an invitation is created — only when it is accepted.** Verified: the only two call sites are `crud-members.mjs:62-66` (`/organization/add-member`) and `crud-invites.mjs:275-279` (`/organization/accept-invitation`). `/organization/invite-member` checks only `invitationLimit` (default 100). The UX consequence is bad — the merchant sends three invites on Starter, all appear to succeed, and every invitee is rejected at accept time. **Put the plan check in `beforeCreateInvitation` as well.**

Plus a falsy-coalescing bug worth knowing: both call sites read `ctx.context.orgOptions?.membershipLimit || 100`. **`membershipLimit: 0` silently becomes 100.** Starter's "no staff beyond the owner" must therefore be expressed as `1` (the owner is a member; `count >= limit` → `1 >= 1` → refused), never `0`. A *function* is truthy, so the function form is unaffected.

```ts
// inside organization({ … }) in src/server/auth/auth.ts
membershipLimit: async (_user, organization) => {
  // `organization` here comes from adapter.findOrganizationById, which runs
  // filterOutputFields(row, orgAdditionalFields) (adapter.mjs:297-305), so the
  // declared additional fields ARE present on it. No second read needed.
  const tier = (organization as { planTier?: string | null }).planTier;
  // No plan chosen yet: owner only. Fail closed, never to the 100 default.
  if (!tier || !isPlanTier(tier)) return 1;
  return PLANS[tier].limits.members;
},
```

---

### Pattern 6: Login, and the rate-limit gap Phase 1 could not have closed

Login is a **Server Action** calling `auth.api.signInEmail`, following the `signUpMerchant` precedent exactly (`nextCookies()` persists the issued cookie; the `databaseHooks.session.create.before` hook back-fills `activeOrganizationId` — proven in 01-06 by asserting it on a real `signInEmail`, not just on signup).

Two things are already correct and need no work:

- **No user enumeration.** All four failure paths throw the same `INVALID_EMAIL_OR_PASSWORD` (`api/routes/sign-in.mjs:292, 298, 304, 311`).
- **No timing oracle.** For an unknown email and for a user with no credential account, Better Auth still runs `await ctx.context.password.hash(password)` before throwing (`sign-in.mjs:289-297`).

One thing is **not** correct by default and is a genuine new gap:

| Fact | Source | Consequence |
|------|--------|-------------|
| `enabled: options.rateLimit?.enabled ?? isProduction` | `context/create-context.mjs:171` | Better Auth's built-in limiter is **off in development**, so nothing about it will be observed locally. |
| `storage: options.rateLimit?.storage \|\| (options.secondaryStorage ? "secondary-storage" : "memory")` | `create-context.mjs:174` | Defaults to **in-process memory** — the exact "fictional limit" `src/server/rate-limit.ts:21-28` refuses to ship, because on Vercel the effective limit is `max × instances`. |
| Default rule for `/sign-in*`: `window: 10, max: 3` | `api/rate-limiter/index.mjs:370-377` | The *intent* is right; the storage makes it unenforceable. |
| Scrypt hashing is CPU-bound and blocks the event loop | 01-06-SUMMARY, deviation 7 | An unthrottled login flood is a CPU-exhaustion vector, not merely a credential-stuffing one. |

**Fix:** `rateLimit: { enabled: true, customStorage: upstashRateLimitStorage }` in `auth.ts`, with a small adapter in `src/server/rate-limit.ts` implementing `{ get, set, consume }` on the existing Upstash client. Implement `consume` — it is the atomic path and its own doc comment says the `get`/`set` fallback *"is best-effort under concurrency"* and that N simultaneous requests can all pass a stale read (`@better-auth/core/dist/types/init-options.d.mts:76-95`). Mirror the existing degradation contract: if Upstash is unconfigured, allow-all with one loud warning, never an in-process counter.

Do **not** reach for `secondaryStorage` — see Alternatives Considered.

---

### Pattern 7: Inserting plan selection into the existing signup flow (D-01)

The current post-signup redirect is at two sites, both a cross-origin jump:

- `src/app/signup/signup-form.tsx:98` — `window.location.assign(storeOrigin(result.slug))`
- `src/app/onboarding/create-store/create-store-form.tsx:66` — the same call

`window.location.assign` is used (rather than `router.push`) because `storeOrigin(slug)` is a *different origin* — `alpha-store.localhost:3000`. The plan-selection step is same-origin (apex), so it must use `router.push("/onboarding/plan")` instead. Keeping `window.location.assign` for a same-origin path would throw away the client router and full-page-reload the merchant mid-onboarding.

Flow after the change:

```
POST signUpMerchant  →  ok:true
      │                    (user + org + membership + slug history + active session)
      ▼
router.push("/onboarding/plan")            ← apex, same origin, authenticated
      │
      ▼  merchant picks a tier (D-05: mandatory, no skip)
POST selectPlan  →  platformDb.organization.update({ planTier, planSelectedAt })
      │
      ▼
window.location.assign(storeOrigin(slug))  ← cross-origin, unchanged
```

**The abandonment case is why D-05 needs a server-side gate, not just a missing "skip" button.** The organization already exists when the merchant reaches `/onboarding/plan`; closing the tab leaves a store with `planTier === null`. `requireMerchantContext()`'s `planTier === null → redirect("/onboarding/plan")` branch is what makes the pick genuinely mandatory, and it mirrors Phase 1's own precedent exactly (an authenticated user with zero organizations is redirected to `/onboarding/create-store`, 01-07-SUMMARY). The storefront itself must **not** be gated on plan selection — ONB-05 gives a full-feature trial from signup, and the store is already live and resolvable at that point.

`/onboarding/plan` must also handle the already-chosen case by redirecting to the storefront, the same way `createStoreForCurrentUser` returns the existing slug rather than colliding with `organizationLimit: 1`.

---

### Anti-Patterns to Avoid

- **Auth check in `(dashboard)/layout.tsx`.** *"A layout also does not control whether the rest of the route renders. Route segments and parallel route slots are rendered by the router, so a layout that hides or swaps them does not stop them from running or from appearing in the RSC Payload"* [CITED: `authentication.md:1352`]. And: *"A common pattern in SPAs is to `return null` in a layout … This pattern is **not recommended**"* [CITED: `authentication.md:1456`]. The layout may *render* trial-banner data from the DAL; it may not be the thing that authorizes.
- **Trusting the Proxy.** `src/proxy.ts` may do a cookie-presence redirect for UX. Better Auth's own docs are blunt about the equivalent helper: *"THIS IS NOT SECURE!"* and *"The `getSessionCookie` function only checks for the existence of a session cookie; it does not validate it"* [CITED: better-auth.com/docs/integrations/next]. Next agrees: Proxy *"should not be your only line of defense"* [CITED: `authentication.md:1119`]. Also note the file's own rule 1 — no I/O in the Proxy — which forbids a real session lookup there anyway.
- **`forbidden()` / `unauthorized()` from `next/navigation`.** Both exist in 16.3.1 but are **experimental** and require `experimental.authInterrupts: true` in `next.config.ts` [VERIFIED: `03-api-reference/04-functions/forbidden.md` front-matter `version: experimental`; introduced v15.1.0]. `next.config.ts` is currently empty. Opting a 30-day build into an experimental flag to get a 403 page is a bad trade; use `redirect()` and in-place error results.
- **Storing a computed `isTrialExpired` boolean.** It would need a cron to flip, and between ticks the answer is wrong. Derive from timestamps on every read. (`@better-auth/stripe`'s `onTrialExpired` callback exists precisely because Stripe pushes the event — with no PSP there is nothing to push, so scheduling would be hand-rolled.)
- **Returning the whole `organization` row to a client component.** *"Constrain return values. Action returns are serialized to the client"* [CITED: `server-actions.md:91`]. Use the `select` in the DAL as the DTO.
- **Two sources of truth for limits.** If `membershipLimit` in `auth.ts` hardcodes numbers and `PLANS` also has them, they will drift. `membershipLimit` must import from `PLANS`.
- **Adding `src/server/merchant/**` or `src/server/entitlements/**` without updating `eslint.config.mjs`.** See Pitfall 12 — this will be a lint failure, and "fixing" it the wrong way weakens TEN-02 for the whole project.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Password verification, session issuance, CSRF, cookie signing | Anything | `better-auth` `signInEmail` / `signOut` / `getSession` | Already the project's ASVS V2/V3/V6 transfer (Phase 1 threat T-01-47). The session cookie is *signed* (`cookies/index.mjs:127`) — hand-parsing it produced a real bug in Phase 1 (01-06 deviation 1). |
| Deciding whether the dashboard request is authenticated | A `getSession` call at every call site | One `React.cache()`d `requireMerchantContext()` | The Next.js-documented DAL pattern; also the only way the per-render cost stays at one query. |
| Uniform "invalid credentials" messaging + anti-enumeration + timing equalisation on login | A custom compare-and-message layer | `auth.api.signInEmail`'s existing behaviour | Verified: same error code on all four paths, dummy hash for unknown users. Re-implementing this is how enumeration oracles get introduced. |
| Distributed rate limiting for the login HTTP endpoint | An in-process counter, or a fresh limiter abstraction | `rateLimit.customStorage` + the existing Upstash client, following `src/server/rate-limit.ts`'s degradation contract | `src/server/rate-limit.ts:21-28` already argues at length why a per-instance counter is worse than no counter. Better Auth's own `consume()` doc explains why non-atomic get/set leaks under concurrency. |
| Enforcing "max N members per org" | A count query in a Server Action | `membershipLimit` (function form) + `beforeCreateInvitation` | The member/invite endpoints are HTTP routes; a Server Action check cannot see them. |
| Blocking a reserved or malformed slug on rename | A validator in a future rename UI | `beforeUpdateOrganization` (now) | `/organization/update` is live *today* and accepts `slug` (`crud-org.mjs:162`). Phase 4 owns the rename UI; Phase 2 must own the gate, or the hole ships. |
| Tenant-scoped queries | A `where: { tenantId }` in each query | `scopedDb(ctx.tenantId)` | Phase 1, TEN-02. Unchanged. |
| A subscription/trial schema | A bespoke design | The `@better-auth/stripe` `subscription` table shape, as a naming reference | First-party, current, and the migration target when D-09/D-10's flow lands. |
| Currency formatting for FCFA | A currency library | `Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF' })` | CLAUDE.md "What NOT to Use" is explicit. XAF has no decimal subunit in common use. |

**Key insight:** in this domain the custom solution is not merely worse-engineered, it is *invisible*. A hand-rolled entitlement check that is missing from one Server Action looks identical in review to one that is present. That is why every recommendation above pushes the check into a position where its absence is a compile error, a lint error, or a 404 — never a quiet pass-through.

---

## Runtime State Inventory

Phase 2 is not a rename or migration phase, but it *does* add columns to a table that already has rows, and it introduces a live HTTP surface. Each category answered explicitly:

| Category | Items found | Action required |
|----------|-------------|-----------------|
| **Stored data** | Development Neon branch holds two organizations created before plan/trial columns exist: `alpha-store` ("Alpha Store", `smoke.alpha@einort.test`) and `recovered-store` ("Recovered Store", `smoke.orphan@einort.test`), both password `correct-horse-8` — 01-07-SUMMARY "Test data". The **test** branch is wiped per suite by `seedTwoTenants`, so it holds nothing durable. | **None.** `planTier String?` makes the migration additive; both rows get `NULL` and will be redirected to `/onboarding/plan` on first dashboard visit — which is a free live test of D-05. Do **not** backfill a plan; that would hide the gate. |
| **Live service config** | None. No n8n, no Datadog, no external dashboard holds Phase 2 state. Vercel wildcard `*.einort.com` is still an unperformed one-time human task (01-07-SUMMARY) and is unaffected by this phase. | None. |
| **OS-registered state** | None — verified: no cron, no scheduled task, no pm2 process exists in this repo (`scripts/` contains only `prisma-generate.mjs`). The derive-don't-store trial design keeps it that way, deliberately. | None. |
| **Secrets / env vars** | No new variable is required. `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `UPSTASH_REDIS_REST_*` all already exist in `src/env.ts`. If the planner adds a "contact us to subscribe" destination (D-10 placeholder), prefer a `strings.ts` constant over an env var — it is copy, not configuration. | None. |
| **Build artifacts / installed packages** | `src/generated/prisma` is gitignored and must be regenerated after any `schema.prisma` change (`node scripts/prisma-generate.mjs`; 01-07-SUMMARY deviation 7 records that the `postinstall` hook is unreliable in a fresh worktree). `.next/types` must exist before `npm run typecheck` — run `npx next typegen` or `npx next build` first (01-02-SUMMARY deviation 8). | Regenerate the client after the migration; run `next typegen` before typecheck in any fresh worktree. |

**Also worth flagging as a live-surface inventory item:** `/api/auth/organization/*` exposes **34 endpoints** today, all reachable on the apex through the existing `[...all]` handler. Six of them mutate tenant state without any Phase-1 gate: `create` (gated), `update` (**ungated**), `delete` (**ungated**), `invite-member` (**ungated beyond `invitationLimit: 100`**), `add-member` (**ungated beyond `membershipLimit: 100`**), `remove-member`, `update-member-role`, `leave`. Enumerated from `grep -rn 'createAuthEndpoint("' plugins/organization/routes/*.mjs`.

---

## Common Pitfalls

### Pitfall 1: Assuming the Proxy protects the dashboard
**What goes wrong:** `proxy.ts` grows a `/dashboard` cookie check, and pages stop checking because "middleware already did".
**Why it happens:** It is the pattern every pre-2024 Next.js tutorial teaches, and it *looks* airtight.
**How to avoid:** Treat the Proxy branch as UX only and say so in a comment. The authoritative check is `requireMerchantContext()` in the page/action. Note also that `src/proxy.ts`'s own rule 1 forbids I/O there, so a real validation is not even possible in that file.
**Warning signs:** A page under `(dashboard)/` that never calls the DAL. A code comment saying "auth handled in proxy".

### Pitfall 2: Putting the auth check in `(dashboard)/layout.tsx`
**What goes wrong:** Layouts do not re-render on client-side navigation (Partial Rendering), so the session is not re-checked as the merchant moves between dashboard routes; and a layout cannot prevent its child segments from rendering or from appearing in the RSC Payload.
**Why it happens:** A route group with a shared layout is the natural place to put shared behaviour, and auth *feels* like shared behaviour.
**How to avoid:** The layout may render `<TrialBanner daysLeft={ctx.trial.daysLeft} />` from the DAL — that is a *data* use. Each page and each action calls the DAL itself. `React.cache()` makes the duplication free.
**Warning signs:** `redirect()` inside a `layout.tsx`. A page whose only auth is inherited.
**Source:** [CITED: `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1348-1358, 1454-1457`]

### Pitfall 3: A tenant id that can arrive from the request
**What goes wrong:** A `switchPlan({ organizationId, tier })` action, or a `/dashboard/[orgId]/` route, gives a merchant a field to substitute another tenant's id into.
**Why it happens:** It reads as normal REST design, and `organizationLimit: 1` makes it feel harmless.
**How to avoid:** Phase 1 already solved this once and the reasoning transfers verbatim — `createStoreForCurrentUser`'s schema is `{ slug }` and nothing else, "so there is no field an attacker could set to provision a store onto someone else's account" (T-01-49). Every Phase 2 action schema must contain *only* the change, never the target. Next's own docs put it identically: *"Send a reference (typically an ID) plus the user's change, and re-read the rest from a trusted source using the session. Schema validation only checks the shape of the input"* [CITED: `server-actions.md:113`].
**Warning signs:** `organizationId`, `tenantId`, or `storeId` appearing in any Zod schema in `src/server/merchant/**`.

### Pitfall 4: Assuming a Server Action is only reachable from your form
**What goes wrong:** A "delete product" action ships with no `canWrite` check because the button is disabled in read-only mode.
**Why it happens:** The disabled button *is* the mental model of the feature.
**How to avoid:** The `merchantAction` wrapper. Next says it directly: *"Treat Server Actions with the same security considerations as public-facing API endpoints"* and *"Render-time gating … is not a security boundary"* [CITED: `server-actions.md:88, 95`].
**Warning signs:** A `"use server"` export that does not go through the wrapper.

### Pitfall 5: `forbidden()` looks available but is experimental
**What goes wrong:** A plan reaches for `forbidden()` from `next/navigation` for the read-only state and the build fails, or someone flips `experimental.authInterrupts: true` to make it work.
**How to avoid:** Both `forbidden()` and `unauthorized()` are gated behind `experimental.authInterrupts` in 16.3.1 (front-matter `version: experimental`, introduced v15.1.0). `next.config.ts` is currently empty and should stay that way for this phase.
**Warning signs:** `import { forbidden } from "next/navigation"`.

### Pitfall 6: The `/api/auth/organization/*` endpoints are a live, ungated write surface
**What goes wrong:** SUB-02 is claimed on the strength of the Server Action wrapper while an authenticated merchant can `POST /api/auth/organization/update {"data":{"slug":"admin"}}` — changing their hostname to a reserved slug, orphaning their `StoreSlugHistory` row (D-03), and stranding every inbound link — or `POST /organization/delete` to destroy their own tenant, or add 99 members on a Starter plan.
**Why it happens:** The endpoints are registered by the plugin, not written by anyone on this project, so they do not appear in a `grep` for routes and are invisible in review.
**How to avoid:** Enumerate them (`grep -rn 'createAuthEndpoint("' node_modules/better-auth/dist/plugins/organization/routes/*.mjs` → 34 paths) and decide, explicitly, for each mutating one: gated by a hook, or acceptable. At minimum this phase needs `beforeUpdateOrganization` (slug validation via the existing `storeSlugSchema` + `StoreSlugHistory` consideration), `beforeDeleteOrganization` (refuse outright in V1 — nothing in the product offers store deletion), and the membership gates.
**Warning signs:** A phase-verification checklist that tests the dashboard UI but never issues a raw `POST /api/auth/organization/update`.

### Pitfall 7: `membershipLimit: 0` silently becomes 100
**What goes wrong:** Starter is expressed as "zero staff" → `membershipLimit: 0` → `ctx.context.orgOptions?.membershipLimit || 100` evaluates the falsy `0` and yields **100**. The tier with the tightest limit gets the loosest.
**How to avoid:** Owner-only is `1`, because the owner *is* a member and the guard is `count >= limit`. Or use the function form, which is truthy regardless of what it returns.
**Warning signs:** Any literal `0` in a membership-limit position.
**Source:** [VERIFIED: `plugins/organization/routes/crud-members.mjs:62`, `crud-invites.mjs:275`]

### Pitfall 8: "Days left" computed as calendar days, or in the browser
**What goes wrong:** A merchant in Douala (WAT, UTC+1) sees "3 days left" on one page and "2 days left" on another, or the countdown changes when they change their laptop clock.
**Why it happens:** `Organization.createdAt` is stored as `TIMESTAMP(3)` **without** time zone (confirmed in the applied migration SQL), Prisma round-trips it as UTC, and a calendar-day helper will bucket by whatever zone it is handed. Meanwhile a client-side countdown is a function of the client's clock by definition.
**How to avoid:** Compute server-side, as a **duration**: `Math.ceil((endsAt - now) / 86_400_000)`. Pass the resulting number down as a prop. The trial is "10 days from signup", not "until the end of the 10th calendar day", so duration is also the semantically correct reading of ONB-05.
**Warning signs:** `differenceInCalendarDays`, `new Date()` inside a client component, `toLocaleDateString` feeding a comparison.

### Pitfall 9: Enabling `session.cookieCache` later and silently staling entitlements
**What goes wrong:** A future performance pass turns on `session.cookieCache` (default `maxAge: 300`), and any entitlement read out of the session — or any `customSession` enrichment — is up to five minutes stale. A downgraded merchant keeps Professional limits; a just-subscribed one stays read-only.
**Current state:** `cookieCache` is **not** enabled (`cookies/index.mjs:75` guards on `options.session?.cookieCache?.enabled`, and `auth.ts` sets no `session` block), so every `getSession` hits Postgres today.
**How to avoid:** Keep entitlements *out* of the session object entirely. `requireMerchantContext()` reads them from `organization` on every request. That keeps the door open for cookie-caching sessions later without coupling the two decisions.
**Warning signs:** `customSession(...)` added to the plugin array to carry `planTier`; any `session.user.plan` reference.

### Pitfall 10: Adding `secondaryStorage` to get distributed rate limiting
**What goes wrong:** Sessions stop being written to Postgres (`databaseStoresSessions = !secondaryStorage || options.session?.storeSessionInDatabase === true`, `db/internal-adapter.mjs:20`). The `activeOrganizationId` back-fill Phase 1 proved against a real database, and the isolation tests that assert on `session` rows, both break — and the failure looks like a session bug, not a config bug.
**How to avoid:** `rateLimit.customStorage`. It is documented to take precedence over `storage` and touches nothing else.
**Warning signs:** `secondaryStorage:` appearing in `auth.ts`.

### Pitfall 11: A missing `TENANT_SCOPED_MODELS` registration, or a wrong one
**What goes wrong:** If a later plan introduces a genuinely tenant-scoped table in this phase, forgetting the registry entry means `scopedDb` throws on first use; adding `Organization` to it means `scopedDb` injects `tenantId` into a table with no such column.
**How to avoid:** Phase 2 as scoped here adds **no** tenant-scoped model — plan/trial live on `Organization`, which is the tenant and is deliberately absent from the registry. If that changes, the registry edit and the schema edit must land in the same commit (01-02-SUMMARY "Notes for Downstream Plans"). Note plan 01-04's `model-registry-drift` test already catches a new `tenantId`-bearing model that was never registered.

### Pitfall 12: New `src/server/**` directories are not in the lint sanctuary
**What goes wrong:** `src/server/merchant/context.ts` imports `platformDb` — fine — but if any new module needs the generated Prisma types (`import type { Prisma } from "@/generated/prisma/client"`), it hits `no-restricted-imports` because the allowlist is exactly `src/server/db/**`, `src/server/tenant/**`, `src/server/auth/**` (`eslint.config.mjs:83-89`). `npm run lint` runs at `--max-warnings=0`, so this fails the gate.
**How to avoid:** Prefer designing the new modules so they need no generated-client import (pass plain structural types; `resolveEntitlements` takes an `OrgRow` interface it declares itself). If a generated import is genuinely needed, **extend the allowlist deliberately in `eslint.config.mjs` with a comment explaining why** — do not add a file-level `eslint-disable`, which removes the boundary silently for that file forever.
**Warning signs:** An `// eslint-disable-next-line no-restricted-imports` anywhere in `src/server/merchant/**` or `src/server/entitlements/**`.

### Pitfall 13: React Compiler lint rules on the new client islands
**What goes wrong:** `eslint-config-next@16.3.1` ships the React Compiler rule set and `lint` runs at `--max-warnings=0`. Plan 01-07 hit **four** distinct violations building one form: `react-hooks/set-state-in-effect`, `react-hooks/immutability` (assigning `window.location.href`), `react-hooks/refs` (closures in `form.register(name, {…})`), and `react-hooks/incompatible-library` (`form.watch()` silently opts the whole component out of compilation).
**How to avoid:** Copy the patterns 01-07 landed on: derive state rather than syncing it in an effect; `window.location.assign(...)` not `.href =`; handlers on the JSX element composed over `registration.onChange`; `useWatch({ control, name })` not `form.watch(name)`.
**Warning signs:** Any of the four rule names in lint output. This will recur on the login form and the plan picker.

### Pitfall 14: The `beforeAddMember` hook fires during organization creation
**What goes wrong:** An entitlement check in `beforeAddMember` refuses the *owner's own* membership row, breaking signup entirely — and only on the tier with the smallest limit, so it may pass a casual test.
**How to avoid:** Verified at `crud-org.mjs:85-99` — the hook is invoked for `{ userId: user.id, organizationId, role: creatorRole }` inside `/organization/create`. Guard on `role !== "owner"`, or rely on `membershipLimit` (which is checked against a real count and is not consulted on this path).

### Pitfall 15: Fresh-worktree setup, every single time
**What goes wrong:** Plans 01-02 through 01-07 *all* recorded the same three-part blocker: no `node_modules`, no `.env.local`/`.env.test`, and a `postinstall` `prisma generate` that does not leave a usable client. Then `npm run typecheck` fails on Next-generated globals (`LayoutProps`/`PageProps`) that only exist after `next typegen`/`next build`.
**How to avoid:** Bake it into the plan's setup step: `npm ci` → `cp -n` the two env files → `node scripts/prisma-generate.mjs` → `npx next typegen`. It is documented in `README.md` as of 01-07.

---

## Code Examples

### 1. Reading the session server-side (the only sanctioned form)

```tsx
// Source: better-auth.com/docs/integrations/next  [CITED]
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function ServerComponent() {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if(!session) {
        return <div>Not authenticated</div>
    }
    return <div><h1>Welcome {session.user.name}</h1></div>
}
```

In this project the raw call is wrapped once, in `requireMerchantContext()` — see Pattern 1 — and never repeated at a call site.

### 2. The DAL, as Next.js documents it

```tsx
// Source: node_modules/next/dist/docs/01-app/02-guides/authentication.md:1137-1153  [CITED]
import 'server-only'

import { cookies } from 'next/headers'
import { decrypt } from '@/app/lib/session'

export const verifySession = cache(async () => {
  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)

  if (!session?.userId) {
    redirect('/login')
  }

  return { isAuth: true, userId: session.userId }
})
```

### 3. Authorization in a Server Action, per the framework's own guidance

```ts
// Source: node_modules/next/dist/docs/01-app/02-guides/server-actions.md:104-115  [CITED]
'use server'

import { auth } from '@/lib/auth'

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  if (!(await canDelete(session.user, postId))) throw new Error('Forbidden')

  await db.post.delete({ where: { id: postId } })
}
```

### 4. Take only the change; re-read the rest from the session

```ts
// Source: node_modules/next/dist/docs/01-app/02-guides/server-actions.md:118-140  [CITED]
'use server'

// Unsafe: no auth, no ownership check. The whole item, including its id, comes
// from the client, so anyone who can POST here can mark any item complete.
export async function completeItemUnsafe(item: Item) {
  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}

// Safe: take only the change, derive identity from the session, look up by ownership.
export async function completeItem(itemId: string) {
  const session = await auth()
  if (!session?.user) return

  const item = await db.item.findFirst({
    where: { id: itemId, ownerId: session.user.id },
  })
  if (!item) return

  await db.item.update({ where: { id: item.id }, data: { completed: true } })
}
```

### 5. A merchant write action, in this project's idiom

```ts
// src/server/merchant/actions.ts
"use server";

import { z } from "zod";

import { merchantAction } from "./action";
import { platformDb } from "@/server/db/platform";
import { PLAN_TIERS } from "@/server/entitlements/plans";
import { strings } from "@/lib/strings";

/**
 * D-06: change tier during the trial.
 *
 * The schema is `{ tier }` and NOTHING else — no organizationId, no tenantId.
 * There is no field to substitute (Pitfall 3 / T-01-49). The target comes from
 * `ctx.tenantId`, which came from `session.activeOrganizationId`.
 */
const switchPlanSchema = z.object({ tier: z.enum(PLAN_TIERS) });

export const switchPlan = merchantAction({
  mode: "write",                       // refused when the trial has expired (D-08)
  schema: switchPlanSchema,
  handler: async (ctx, { tier }) => {
    if (tier === ctx.plan.tier) return { ok: true };     // idempotent no-op

    await platformDb.organization.update({
      where: { id: ctx.tenantId },
      data: { planTier: tier, planSelectedAt: new Date() },
    });

    return { ok: true };
  },
});
```

### 6. The plan-tier gate at the Better Auth layer

```ts
// inside organization({ … }) in src/server/auth/auth.ts
organizationHooks: {
  beforeCreateOrganization: async ({ organization: org }) => { /* EXISTING — Phase 1 */ },

  /**
   * `/organization/update` accepts `slug` (crud-org.mjs:162) and is live today.
   * Without this, a merchant can rename onto a reserved hostname and orphan
   * their StoreSlugHistory row (D-03), from a curl, with no UI involved.
   *
   * THROW-OR-VOID, same discipline as beforeCreateOrganization. The re-spread
   * here is narrower than on create (crud-org.mjs:218-224 merges only
   * response.data over ctx.body.data), but a rule with an exception is a rule
   * nobody follows.
   */
  beforeUpdateOrganization: async ({ organization: patch }) => {
    if (typeof patch.slug === "string") {
      // Phase 4 owns the rename FLOW (new StoreSlugHistory row, releasedAt on
      // the old, invalidateTenantHost on both). Until that exists, renaming is
      // not a supported operation and must be refused rather than half-done.
      throw new APIError("BAD_REQUEST", { message: strings.dashboard.renameUnsupported });
    }
  },

  /** No product surface offers store deletion in V1. Close the endpoint. */
  beforeDeleteOrganization: async () => {
    throw new APIError("FORBIDDEN", { message: strings.dashboard.deleteUnsupported });
  },

  /**
   * membershipLimit is NOT consulted when an invitation is CREATED — only on
   * add-member and accept-invitation (verified: crud-members.mjs:62,
   * crud-invites.mjs:275). Without this the merchant sends invites that all
   * appear to work and every recipient is refused at accept time.
   */
  beforeCreateInvitation: async ({ organization: org }) => {
    const limit = memberLimitFor(org);
    const count = await platformDb.member.count({ where: { organizationId: org.id } });
    const pending = await platformDb /* … pending invitations … */;
    if (count + pending >= limit) {
      throw new APIError("FORBIDDEN", { message: strings.entitlements.memberLimitReached });
    }
  },
},
```

### 7. Upstash-backed rate-limit storage for the login endpoint

```ts
// src/server/rate-limit.ts (addition)
import type { BetterAuthRateLimitStorage } from "better-auth";   // shape verified in @better-auth/core

/**
 * Implements `consume` — the ATOMIC path. Better Auth's own doc comment on the
 * get/set fallback says it "is best-effort under concurrency" and that N
 * simultaneous requests can all pass a stale read before any increment lands
 * (@better-auth/core/dist/types/init-options.d.mts:76-95).
 *
 * Same degradation contract as every other limiter in this file: when Upstash
 * is unconfigured, allow-all with ONE loud warning. Never an in-process
 * counter — see the module header for why that is dishonest rather than weak.
 */
export const authRateLimitStorage: BetterAuthRateLimitStorage = {
  async consume(key, { window, max }) { /* Upstash INCR + EXPIRE(window) on `rl:auth:${key}` */ },
  async get(key) { /* … */ },
  async set(key, value) { /* … */ },
};
```

Wired as `rateLimit: { enabled: true, customStorage: authRateLimitStorage }`. Setting `enabled: true` explicitly is deliberate: the default is `?? isProduction` (`create-context.mjs:171`), so leaving it unset means the control is untestable locally and unobserved until production.

### 8. The trial banner reads from the DAL, not from a client clock

```tsx
// src/app/(dashboard)/layout.tsx  — DATA use of the DAL, not an auth check (Pitfall 2)
import { requireMerchantContext } from "@/server/merchant/context";
import { strings } from "@/lib/strings";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const ctx = await requireMerchantContext();   // cache()d — free if the page also calls it

  return (
    <div>
      {ctx.trial.state === "active" && (
        // D-11 / D-12. `daysLeft` is a NUMBER computed server-side; the client
        // never sees a date to subtract from its own clock (Pitfall 8).
        <TrialBanner daysLeft={ctx.trial.daysLeft} urgent={ctx.trial.daysLeft <= 2} />
      )}
      {ctx.trial.state === "expired" && <ReadOnlyBanner />}
      {children}
    </div>
  );
}
```

Consider wrapping the banner in `<Suspense>` if the DAL await measurably delays the first streamed chunk — *"A top-level `await` on `cookies()`, `headers()`, or the DAL in a layout delays the first streamed chunk for that segment and holds `{children}` behind that work"* [CITED: `authentication.md:1362-1364`]. On a low-end-Android, mobile-first market this is worth measuring rather than assuming.

---

## State of the Art

| Old approach | Current approach | When changed | Impact here |
|--------------|------------------|--------------|-------------|
| `middleware.ts` as the auth boundary | `proxy.ts` for optimistic redirects; a DAL for the real check | Next 16 renamed Middleware → Proxy; the "not a security boundary" guidance predates it and hardened after CVE-2025-29927 | Every online tutorial's file name and architecture are both wrong for this repo. C-16. |
| `getServerSession()` / `auth()` helper per page | `auth.api.getSession({ headers })` wrapped once in a `React.cache()`d DAL | Better Auth's server API; React `cache` GA | One query per render pass instead of one per component. |
| Auth.js / NextAuth v5 | Better Auth | Auth.js entered maintenance mode early 2026; maintenance passed to the Better Auth team Sept 2025; Vercel acquired Better Auth July 2026 | Already decided (CLAUDE.md). Any NextAuth-shaped guidance found while researching is off-target. |
| Prisma `$use()` middleware for multi-tenancy | Prisma Client Extensions (`$extends`) | `$use()` removed in Prisma 7 | Already handled by `scopedDb`; do not reintroduce. |
| Role-based gating standing in for plan gating | Separate entitlement layer over a role layer | Long-standing SaaS practice; reinforced by the entitlement-management literature | Keeps `owner`/`member` orthogonal to `starter`/`business`/`professional`. |
| Storing a boolean `isTrialExpired`, flipped by a cron | Deriving from timestamps on every read | — | No scheduler exists or is wanted in a solo Vercel build; a derived value cannot go stale. |
| `forbidden()` / `unauthorized()` as the standard 403/401 | Still experimental in 16.3.1 behind `authInterrupts` | Introduced v15.1.0, still flagged experimental as of 16.3.1 | Use `redirect()` + in-place error results. |

**Deprecated / outdated for this repo:**
- `middleware.ts` — renamed; `git ls-files | grep -c middleware.ts` is an asserted `0`.
- `next lint` — removed in Next 16; ESLint is invoked directly (`eslint.config.mjs` header).
- shadcn `<Form>` — empty under the Base UI registry; C-15.
- Zod v3 chains (`z.string().email()`) — deprecated; C-9.
- TypeScript 7.0.2 — reverted to 5.9.3 for this project; C-13.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Staff limits are "Starter: owner only; Business: up to 3; Professional: up to 10" and these are *staff in addition to* the owner, making `membershipLimit` 1 / 4 / 11. | Pattern 2, Pattern 5 | The numbers come from D-07's summary of a document not in the repo. If "up to 3" means 3 total including the owner, every limit is off by one and Business/Professional under-deliver. **Confirm with the user before implementing.** See OQ-2. |
| A2 | Product-count caps, discount-code access and bulk-import are registered-but-unenforced placeholders with no committed numbers yet. | Pattern 2 | If v4.0 §4.4 specifies concrete product caps, `products: null` (unlimited) in the registry is wrong and Phase 3 will inherit a permissive default. See OQ-1. |
| A3 | XAF prices are exactly 5,000 / 12,500 / 25,000 FCFA per month with no annual option in V1. | Pattern 2 | Taken verbatim from D-02, which is itself a summary. Wrong prices on a live pricing screen is a commercial error, not a technical one. |
| A4 | "Read-only" (D-08) means the merchant may still change their *plan* — otherwise an expired merchant is locked out of the very action that would restore write access. | Pattern 3 | If `switchPlan` is gated by `mode: "write"`, an expired merchant cannot upgrade. Recommend `switchPlan` use `mode: "read"` (or an explicit `allowWhenReadOnly` escape) with a comment explaining why. **Needs a decision.** |
| A5 | Store deletion and store rename are not offered in V1, so `beforeDeleteOrganization` / `beforeUpdateOrganization` may refuse outright. | Pattern 5, Code Example 6 | Rename is explicitly Phase 4 (D-03), and REQUIREMENTS lists no deletion requirement — but refusing an endpoint the merchant "should" have is a product decision. Low risk; easy to relax later. |
| A6 | `organization` passed to `membershipLimit(user, organization)` carries the declared `input: false` additional fields, so `planTier` is readable without a second query. | Pattern 5 | Traced to `adapter.findOrganizationById` → `filterOutputFields(row, orgAdditionalFields)` (`adapter.mjs:297-305`), which is strong evidence, but the exact semantics of `filterOutputFields` were not read. **Assert it in the first task's test**; the fallback (a `platformDb.organization.findUnique` inside the limit function) costs one indexed read. |
| A7 | Better Auth's `enabled: true` + `customStorage` combination applies the default `/sign-in*` rule (`window: 10, max: 3`) without further configuration. | Pattern 6 | Read from `api/rate-limiter/index.mjs:288-292, 370-377`, but not exercised. If wrong, login is unthrottled while appearing configured — the worst class of failure for a control. **Assert behaviourally** (a fourth rapid login attempt must be refused), never by reading the source, exactly as 01-06 asserted limiter ordering. |
| A8 | No `Suspense` boundary is needed around the trial banner for acceptable first-paint on the target market. | Code Example 8 | Untested. Low risk — measurable and reversible. |

---

## Open Questions

1. **OQ-1 — The per-tier feature list and any product caps are not in the repo.**
   - What we know: D-02 requires the plan screen to show "the full planned per-tier feature list from the v4.0 Master Specification (Section 4.4)", and D-07 names staff and store limits. CONTEXT `<canonical_refs>` states the PDF is *not* committed and instructs: *"ask the user to re-supply this document rather than inventing feature lists."*
   - What's unclear: the exact bullet lists per tier, and whether §4.4 commits to numeric product caps.
   - Recommendation: **the planner must open with a `checkpoint:human-verify` (or `user_setup`) task requesting v4.0 §4.4** before the plan-selection screen's copy or the `PLAN_LIMITS` numbers are written. Do not let an executor invent them — CONTEXT forbids it explicitly.

2. **OQ-2 — Does "Business: up to 3 staff accounts" mean 3 members or 4?**
   - What we know: `membershipLimit` counts *all* members including the owner (`count >= limit`, owner created as a member at org creation).
   - What's unclear: whether v4.0's "3" is staff-in-addition-to-owner (→ limit 4) or total seats (→ limit 3).
   - Recommendation: ask alongside OQ-1. Default to staff-in-addition-to-owner (1 / 4 / 11) and state the interpretation in a comment next to `PLANS` so it is visible if wrong.

3. **OQ-3 — Can an expired-trial merchant switch plans? (A4)**
   - What we know: D-08 says read-only. D-06 says plan switching is "changeable during the trial".
   - What's unclear: whether "during the trial" excludes after it.
   - Recommendation: allow it. Blocking it means the only path out of read-only is the D-10 placeholder ("contact us"), which is a support ticket per merchant. Implement `switchPlan` outside the write gate with a comment naming this decision, and surface it to the user for confirmation.

4. **OQ-4 — What does the expired-trial dashboard actually offer? (D-10)**
   - What we know: a placeholder, exact copy is Claude's discretion; the real claim flow is deferred.
   - What's unclear: whether the placeholder should carry a real contact channel (WhatsApp number? email?) or be pure copy.
   - Recommendation: Claude's discretion covers the wording; if a real channel is needed the planner should ask, because a phone number is a business fact, not copy.

5. **OQ-5 — Is a `/suspended` route in scope?**
   - What we know: `Organization.status` can be `"suspended"` (D-05, Phase 1), suspension is a Phase 6 admin write, and `requireMerchantContext()` must do *something* when it sees a suspended org.
   - Recommendation: minimum viable is `redirect("/login")` after a sign-out, or a one-paragraph `/suspended` page. Either is small; pick one deliberately rather than leaving the branch undefined, because "suspended merchant silently sees a normal dashboard" is the failure mode of leaving it out.

6. **OQ-6 — Should `/organization/check-slug` be rate limited?**
   - What we know: it is live, and uses `requestOnlySessionMiddleware`, which *does* require a session when called over HTTP (`api/routes/session.mjs:343-350`) — so it is not an anonymous enumeration vector. But it is an *authenticated*, unthrottled second path to the same registry `rl:slugcheck` protects (T-01-39).
   - Recommendation: low severity given the session requirement and `organizationLimit: 1`. Cover it with a `rateLimit.customRules` entry for `/organization/*` if the customStorage work is happening anyway; otherwise log as deferred.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything | ✓ | 24.x (01-07-SUMMARY) | — |
| npm | Install/lockfile restore | ✓ | 11.13.0 | — |
| `better-auth` (installed) | Login, session, org hooks, rate limiting | ✓ | 1.6.29 (= current latest) | — |
| `next` (installed, with bundled docs) | Everything | ✓ | 16.3.1 | — |
| Neon **development** branch | Local dev, manual walkthrough | ✓ | Postgres 17, `.env.local` | — |
| Neon **test** branch | `isolation` vitest project | ✓ | `.env.test` / `TEST_DATABASE_URL` | — |
| Upstash Redis | The new login limiter | ✓ (credentials in `.env.local` / `.env.test`, per 01-06/01-07) | REST | Documented allow-all-with-warning degradation already exists |
| Vitest | Both test projects | ✓ | 4.1.10 | — |
| `ctx7` (Context7 CLI) | Library docs lookup | ✗ | — | **Used instead:** Next.js's own docs bundled at `node_modules/next/dist/docs/`, and direct reading of `node_modules/better-auth/dist/`. Both are *stronger* than Context7 for this task because they are the exact installed versions. |
| `slopcheck` | Package legitimacy gate | ✗ | — | Moot — this phase installs nothing. Any deviation must be gated behind `checkpoint:human-verify`. |
| Docker | Testcontainers-style DB isolation | ✗ (01-VALIDATION: "Docker is unavailable on this machine") | — | The dedicated Neon test branch, already in use |
| `EINORT-Commerce_Master_Specification_v4.pdf` §4.4 | D-02 feature lists, D-07 limit numbers | ✗ **not in repo** | — | **No fallback.** See OQ-1 — must be re-supplied by the user. |

**Missing dependencies with no fallback:**
- v4.0 §4.4 (pricing/feature/limit source of truth). Blocks the plan-selection screen's copy and the `PLANS` limit numbers. Everything else in the phase can proceed without it.

**Missing dependencies with fallback:**
- Context7 / `ctx7` → bundled Next docs + installed `better-auth` source (used throughout).
- `slopcheck` → not needed; zero installs.
- Docker → Neon test branch (already the established pattern).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10, two projects (`unit`, `isolation`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test:unit` (`vitest run tests/unit --reporter=dot`) |
| Full suite command | `npm run test:full` (`dotenv -e .env.test -- vitest run`) |
| Current baseline | **186 passing, 0 skipped** across 10 files (01-07-SUMMARY) |
| Other gates | `npm run lint` (`--max-warnings=0`), `npm run typecheck`, `npx next build` |

`unit` is node-environment with no DB and no network — that is why `resolveEntitlements(org, now)` takes `now` as a parameter. `isolation` runs serially (`fileParallelism: false`) against the Neon test branch and is where anything touching Better Auth or Prisma belongs. `tests/isolation/signup.test.ts` already demonstrates end-to-end Server Action testing with `vi.mock("next/headers")` and a mutable cookie jar so the real `nextCookies()` plugin runs — **reuse it rather than mocking Better Auth** (01-06-SUMMARY "Notes for Downstream Plans").

### Phase Requirements → Test Map

| Req | Behavior | Type | Automated command | File exists? |
|-----|----------|------|-------------------|--------------|
| ONB-05 | `resolveEntitlements` returns `trial.state === "active"` on day 1 and day 9 | unit | `npx vitest run tests/unit/entitlements.test.ts -t "trial active"` | ❌ Wave 0 |
| ONB-05 | Boundary: `now === endsAt` is expired, `now === endsAt - 1ms` is active | unit | `… -t "trial boundary"` | ❌ Wave 0 |
| ONB-05 | `daysLeft` is never negative and is 10 at t=0 | unit | `… -t "daysLeft"` | ❌ Wave 0 |
| ONB-05 | A real signup produces an org whose derived `trialEndsAt` is `createdAt + 10d` | integration | `npx dotenv -e .env.test -- npx vitest run tests/isolation/trial.test.ts -t "trial anchored to createdAt"` | ❌ Wave 0 |
| TEN-04 | `requireMerchantContext()` returns `tenantId === session.activeOrganizationId` after a real `signInEmail` | integration | `… tests/isolation/merchant-context.test.ts -t "tenant from session"` | ❌ Wave 0 |
| TEN-04 | No exported merchant function accepts a tenant id — source-level assertion over `src/server/merchant/**` | unit | `… tests/unit/no-tenant-id-param.test.ts` | ❌ Wave 0 |
| TEN-04 | Merchant A's session cannot read Merchant B's data through the DAL (two-tenant fixture) | integration | `… tests/isolation/merchant-context.test.ts -t "cross-tenant"` | ❌ Wave 0 |
| SUB-01 | `PLANS` is exhaustive over `PLAN_TIERS` and every tier has every limit key | unit | `… tests/unit/entitlements.test.ts -t "registry"` | ❌ Wave 0 |
| SUB-01 | `membershipLimit` resolves 1 / 4 / 11 per tier and **1** (not 100) when `planTier` is null | unit | `… -t "member limit"` | ❌ Wave 0 |
| SUB-01 | `POST /organization/add-member` on a Starter org is refused with `ORGANIZATION_MEMBERSHIP_LIMIT_REACHED` — **exercised through the real endpoint, not the registry** | integration | `… tests/isolation/entitlements.test.ts -t "starter refuses second member"` | ❌ Wave 0 |
| SUB-02 | A `mode: "write"` action returns the read-only error when the trial is expired | integration | `… tests/isolation/read-only.test.ts -t "write refused"` | ❌ Wave 0 |
| SUB-02 | A `mode: "read"` action still succeeds when the trial is expired (D-08 is read-only, not lockout) | integration | `… -t "read still allowed"` | ❌ Wave 0 |
| SUB-02 | A forged `{ tier, organizationId: <other> }` payload cannot retarget the write | integration | `… -t "forged organizationId ignored"` | ❌ Wave 0 |
| SUB-02 | `POST /api/auth/organization/update {"data":{"slug":"admin"}}` is refused (Pitfall 6) | integration | `… tests/isolation/org-endpoints.test.ts -t "update slug refused"` | ❌ Wave 0 |
| SUB-02 | `POST /api/auth/organization/delete` is refused | integration | `… -t "delete refused"` | ❌ Wave 0 |
| SUB-02 (A7) | The 4th rapid `/sign-in/email` in a 10s window is refused — **behaviourally, not by reading config** | integration | `… tests/isolation/login.test.ts -t "login throttled"` | ❌ Wave 0 |
| D-05 | A merchant with `planTier === null` reaching the dashboard is redirected to `/onboarding/plan` | integration | `… tests/isolation/merchant-context.test.ts -t "plan gate"` | ❌ Wave 0 |
| D-11/D-12 | Banner urgency threshold flips at the documented day count | unit | `… tests/unit/entitlements.test.ts -t "urgency"` | ❌ Wave 0 |
| D-01/D-02 | Plan screen renders three tiers, correct prices, "Most Popular" on Business, 44px touch targets, English copy | **manual-only** | human-verify walkthrough (UI-SPEC) | n/a |
| D-08 | Read-only dashboard reads as intentional, not broken (CONTEXT `<specifics>`) | **manual-only** | human-verify walkthrough | n/a |

### Sampling Rate

- **Per task commit:** `npm run test:unit` (< 2s, no DB)
- **Per wave merge:** `npm run test:full` + `npm run lint` + `npm run typecheck` + `npx next build`
- **Phase gate:** full suite green (≥ 186 inherited + new, **0 skipped**) before `/gsd:verify-work`, plus the human-verify walkthrough

### Wave 0 Gaps

- [ ] `tests/unit/entitlements.test.ts` — ONB-05 (trial math, boundaries, urgency), SUB-01 (registry exhaustiveness, member limits)
- [ ] `tests/unit/no-tenant-id-param.test.ts` — TEN-04 source-level guard over `src/server/merchant/**` and `src/server/entitlements/**`
- [ ] `tests/isolation/merchant-context.test.ts` — TEN-04 (session-derived tenant, cross-tenant refusal, plan gate)
- [ ] `tests/isolation/login.test.ts` — login round trip, `activeOrganizationId` on the new session, throttling (A7)
- [ ] `tests/isolation/read-only.test.ts` — SUB-02 write gate, read allowance, forged-payload rejection
- [ ] `tests/isolation/org-endpoints.test.ts` — **the Pitfall 6 suite**: raw calls to `/organization/{update,delete,add-member,invite-member}`
- [ ] `tests/isolation/trial.test.ts` — trial anchored to `createdAt` through a real signup
- [ ] No new framework, config or fixture infrastructure is required — `tests/setup/seed-two-tenants.ts` and the `signup.test.ts` cookie-jar harness already cover what these need.

---

## Security Domain

### Applicable ASVS Categories

| ASVS category | Applies | Standard control |
|---------------|---------|------------------|
| **V2 Authentication** | yes | Delegated to `better-auth` scrypt + `signInEmail`. Verified: uniform `INVALID_EMAIL_OR_PASSWORD` on all four failure paths and a dummy hash for unknown users (no enumeration, no timing oracle). **Gap:** brute-force throttling is memory-backed and production-only by default → `rateLimit.customStorage` (Pattern 6). |
| **V3 Session Management** | yes | Delegated. Host-only cookie (no `crossSubDomainCookies` — T-01-44), signed cookie value, `cookiePrefix: "einort"`. **New surface:** logout must call `auth.api.signOut` (real revocation) rather than clearing a cookie client-side. |
| **V4 Access Control** | yes | **The core of this phase.** Two orthogonal layers: role AC (`owner`/`member`, Better Auth `hasPermission`) and plan entitlements (`src/server/entitlements/**`). Tenant identity from `session.activeOrganizationId` only (TEN-04). Enforcement at the DAL, the action wrapper, and `organizationHooks` — three positions because there are three entry points. |
| **V5 Input Validation** | yes | Zod 4 `safeParse` on every action input (C-9). Schemas contain the change and never the target (Pitfall 3). `input: false` at the Better Auth layer strips plan/trial fields from create and update bodies before they reach handler code. |
| **V6 Cryptography** | yes (by delegation) | No bespoke crypto. Password hashing, cookie signing and CSRF all remain Better Auth's. Do not hand-parse the signed session cookie — Phase 1 hit exactly this (01-06 deviation 1) and the correct tool is `applySetCookies`. |
| **V7 Error Handling & Logging** | yes | The read-only refusal and the entitlement refusal must be distinguishable to the merchant but must not leak internals. C-14 keeps all such copy in `strings.ts`; T-01-55's rule ("no `/s/`, `scopedDb`, `proxy.ts`, or phase/tier internals in user-facing strings") applies. |
| **V13 API & Web Service** | yes | The 34 `/api/auth/organization/*` endpoints are the API surface this phase inherits. Enumerate and gate — Pitfall 6. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation | Status entering Phase 2 |
|---------|--------|---------------------|-------------------------|
| Client supplies `organizationId`/`tenantId` in a write payload | Elevation of Privilege | Schema contains only the change; identity from session | Precedent set (T-01-49); must be re-applied to every new action |
| Tenant id read from a URL segment or header | Elevation of Privilege | Proxy already strips `x-tenant-id`/`x-store-slug` unconditionally; dashboard reads session only | Proxy half done; DAL half is Phase 2's |
| Client-only tier gating (disabled button, hidden route) | Elevation of Privilege | `merchantAction({ mode: "write" })` + `organizationHooks` | **Open — the phase's core deliverable (SUB-01/SUB-02)** |
| Trial bypass by clock manipulation | Tampering | Server-side `new Date()` compared to a server-derived `endsAt`; client receives only a number | Design fixed by Pattern 4 |
| Trial bypass via a forged `planTier`/`trialEndsAt` in a create/update body | Tampering | `input: false` → stripped by `toZodSchema(isClientSide)` → stripped by Zod's default object behaviour | Mechanism verified; must be *used* |
| Rename onto a reserved hostname via `/organization/update` | Tampering / Spoofing | `beforeUpdateOrganization` refusing `slug` until Phase 4's rename flow exists | **Open — live hole today** |
| Self-service tenant deletion via `/organization/delete` | Denial of Service (self) | `beforeDeleteOrganization` refusing | **Open — live hole today** |
| Seat-limit bypass via `/organization/invite-member` | Elevation of Privilege | Plan check in `beforeCreateInvitation` (the create path does **not** consult `membershipLimit`) | **Open** |
| `membershipLimit: 0` silently becoming 100 | Elevation of Privilege | Owner-only is `1`; never `0` | Documented (Pitfall 7) |
| Credential stuffing / login flood (also CPU exhaustion via scrypt) | Denial of Service / Spoofing | `rateLimit.customStorage` on Upstash, `enabled: true` explicitly | **Open — memory-backed and prod-only by default** |
| Session fixation across tenant storefronts | Spoofing | Host-only cookie; auth apex-only; storefront `/api/auth/*` rewritten into a 404 | Mitigated in Phase 1 (T-01-44) — do not regress by moving the dashboard to a subdomain |
| Stale entitlements served from a cache | Elevation of Privilege | No entitlement cache in this phase; `cookieCache` stays off; entitlements never enter the session object | Design decision (Pitfall 9) |
| Whole-row leakage to the client via a Server Action return | Information Disclosure | DTO discipline — the DAL `select`s explicit columns; *"Constrain return values"* [CITED: `server-actions.md:91`] | New surface; enforce in review |
| Server Action CSRF | Spoofing | Framework-level: Origin vs. Host comparison, encrypted action IDs, 1MB body cap [CITED: `server-actions.md:82-86`] | Inherited; no action needed |

---

## Sources

### Primary (HIGH confidence)

**Installed source, read directly on this machine — the strongest available evidence, because it is the exact code that will run:**
- `node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs` — create/update/delete/check-slug endpoints, `createdAt` stamping (`:74-77`), the create re-spread trap (`:63-72`), the update merge (`:218-224`), `slug` accepted on update (`:162`)
- `node_modules/better-auth/dist/plugins/organization/routes/crud-members.mjs:62-66` and `crud-invites.mjs:275-279` — `membershipLimit` call sites and the `|| 100` falsy fallback
- `node_modules/better-auth/dist/plugins/organization/types.d.mts:22-215, 323-582` — plugin options (`membershipLimit`, `invitationLimit`, `sendInvitationEmail`) and the full `organizationHooks` list
- `node_modules/better-auth/dist/plugins/organization/organization.mjs:824-835` — `activeOrganizationId` declared `input: false` on the session schema
- `node_modules/better-auth/dist/plugins/organization/adapter.mjs:297-305` — `findOrganizationById` → `filterOutputFields(row, orgAdditionalFields)`
- `node_modules/better-auth/dist/db/to-zod.mjs:7` — `input: false` excluded from client-side body schemas
- `node_modules/better-auth/dist/db/schema.mjs:59-105` — `parseInputData` default/`input:false` handling
- `node_modules/better-auth/dist/db/internal-adapter.mjs:19-21` — `secondaryStorage` moves sessions out of the database
- `node_modules/better-auth/dist/api/routes/sign-in.mjs:280-325` — uniform error code, dummy hash for unknown users
- `node_modules/better-auth/dist/api/routes/session.mjs:343-350` — `requestOnlySessionMiddleware` semantics
- `node_modules/better-auth/dist/api/rate-limiter/index.mjs:210-305, 370-384` — storage selection and the default `/sign-in*` rule
- `node_modules/better-auth/dist/context/create-context.mjs:169-174` — rate-limit defaults (`enabled ?? isProduction`, `storage || "memory"`)
- `node_modules/better-auth/dist/cookies/index.d.mts:97-115` — `getSessionCookie` / `getCookieCache` signatures
- `node_modules/@better-auth/core/dist/types/init-options.d.mts:73-165` — `BetterAuthRateLimitStorage` (`get`/`set`/`consume`), `customStorage` precedence
- `node_modules/@better-auth/core/dist/db/type.d.mts:53, 138-175` — `defaultValue` may be a function; `SecondaryStorage` interface
- `node_modules/@better-auth/core/dist/db/adapter/factory.mjs:110-140` + `utils.mjs:2-10` — `withApplyDefault` on create

**Next.js 16.3.1 bundled documentation (ships with the installed package):**
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md` — DAL pattern (`:1129-1231`), layouts are not a boundary (`:1348-1358`), the `return null` anti-pattern (`:1454-1457`), optimistic Proxy checks (`:1024-1125`), Server Action and Route Handler guidance (`:1459-1552`)
- `node_modules/next/dist/docs/01-app/02-guides/server-actions.md:80-140` — framework protections, "render-time gating is not a security boundary", take-the-change-not-the-target
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` — Middleware→Proxy rename, "not intended for slow data fetching", not a full authorization solution
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/{forbidden,unauthorized}.md` — `version: experimental`, `authInterrupts` requirement, introduced v15.1.0

**Repository artifacts (authoritative for project constraints):**
- `CLAUDE.md`, `package.json` (incl. the `comment:typescript` pin rationale), `eslint.config.mjs`, `vitest.config.ts`, `next.config.ts`, `prisma/schema.prisma`, `prisma/migrations/20260817013504_init_tenant_foundations/migration.sql`
- `src/server/auth/auth.ts`, `src/server/auth/signup.ts`, `src/server/db/{tenant-scoped,platform}.ts`, `src/server/rate-limit.ts`, `src/proxy.ts`, `src/env.ts`
- `.planning/phases/01-.../01-02-SUMMARY.md`, `01-06-SUMMARY.md`, `01-07-SUMMARY.md`, `01-VALIDATION.md`
- `.planning/{REQUIREMENTS,ROADMAP,STATE,config.json}`, `.planning/phases/02-.../02-CONTEXT.md`

**npm registry (`npm view`, 2026-08-17):**
- `better-auth@1.6.29` (latest = installed), `@better-auth/stripe@1.6.29`, `date-fns@4.4.0`, `@date-fns/tz@1.5.0`, `next-safe-action@8.6.0` (+ 252,471 weekly downloads via `api.npmjs.org`)

### Secondary (MEDIUM confidence)

- [Better Auth — Next.js integration](https://www.better-auth.com/docs/integrations/next) — the "THIS IS NOT SECURE!" warning on `getSessionCookie`, the `nextCookies()`-must-be-last rule, and the canonical `auth.api.getSession({ headers: await headers() })` form. Cross-checked against the installed source, which agrees.
- [Better Auth — Stripe plugin](https://better-auth.com/docs/plugins/stripe) — the reference `subscription` schema, plan `limits` shape, `freeTrial.days`, `referenceId` bound to an organization. Vendor-authored; used only as a *design* reference since C-4 excludes the plugin.
- [Better Auth — Organization plugin](https://better-auth.com/docs/plugins/organization) — corroborates the hook and limit options read from the installed types.
- [Schematic — Entitlement Management System for SaaS (2026)](https://schematichq.com/blog/entitlement-management-system) and [Multi-Tenant SaaS — Subscription & Plan Enforcement](https://www.multi-tenant-saas.com/tenant-billing-usage-metering/subscription-and-plan-enforcement/) — corroborating, vendor-independent statements of the pattern this document recommends: resolve tenant context first, evaluate entitlements from a policy map rather than scattered conditionals, and refuse hard limits at the write rather than metering them.
- [Makerkit — Next.js Server Actions Security](https://makerkit.dev/blog/tutorials/secure-nextjs-server-actions) and [jsdev.space — Protecting Next.js Applications in the Era of Server Actions](https://jsdev.space/server-actions-security/) — community corroboration of the DAL + wrapper approach; nothing relied on that the official docs do not also state.

### Tertiary (LOW confidence — flagged, not relied upon)

- [Why I Built Custom Payment Integration Instead of Using Better Auth's Payment Plugin](https://victorymakes.medium.com/why-i-built-custom-payment-integration-instead-of-using-better-auths-payment-plugin-b0c64ace2b43) — single-author opinion; noted only because it independently makes the same observation that Better Auth couples entitlement to subscription-record existence, which is why this phase keeps `subscriptionStatus` and `planTier` as separate columns.
- v4.0 Master Specification §4.4 pricing/feature/limit numbers as relayed through D-02/D-07 — **the source document was not available to this research.** Every number in the `PLANS` sketch is an [ASSUMED] placeholder. See OQ-1, OQ-2, A1, A2, A3.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Better Auth mechanics (hooks, limits, session fields, rate-limit storage, `input: false`) | **HIGH** | Read from the installed 1.6.29 `dist/`, with file and line references. Not training data, not the website. `npm view` confirms 1.6.29 is also current-latest, so there is no "docs describe a newer version" gap. |
| Next.js 16 auth architecture (DAL, layouts-are-not-a-boundary, Proxy, Server Action security, `authInterrupts` status) | **HIGH** | Read from the docs bundled inside the installed `next@16.3.1` package — the exact version's own guidance. |
| Existing codebase integration points (insertion sites, lint zones, test harness, established idioms) | **HIGH** | Read directly from source and from three Phase 1 SUMMARY documents that record verified behaviour, not intent. |
| Data-model recommendation (fields on `Organization`, derive trial from `createdAt`) | **HIGH** on mechanism, **MEDIUM** on it being the best long-term shape | The mechanism is verified. Whether a `Subscription` table would have been better to build now is a judgement call about D-09/D-10's eventual shape; the recommendation records it as intentional debt with a named migration trigger. |
| Entitlement architecture (registry + assert + wrapper + hooks) | **MEDIUM-HIGH** | The individual mechanisms are all verified; their composition is a design recommendation, corroborated by two independent SaaS-architecture sources but not by a first-party doc for this exact stack. |
| Rate-limit fix (`customStorage` over `secondaryStorage`) | **HIGH** on the hazard, **MEDIUM** on the fix working end-to-end | The `secondaryStorage` session side-effect is verified at `internal-adapter.mjs:20`. `customStorage` precedence is documented in the type. That the default `/sign-in*` rule fires correctly through a custom storage is **A7 — must be asserted behaviourally, not assumed.** |
| Pricing, per-tier feature lists, staff-limit semantics | **LOW** | Sourced from a document not in the repo, relayed through a summary. Explicitly gated behind OQ-1/OQ-2 and logged as A1/A2/A3. |

**Research date:** 2026-08-17
**Valid until:** 2026-09-16 for the ecosystem-level claims (30 days — the stack is pinned and `better-auth@1.6.29` is current-latest, so drift risk is low). The installed-source findings are valid for as long as `package-lock.json` is unchanged; **re-verify every `node_modules/better-auth/**` line reference if the pin moves off 1.6.29.**
