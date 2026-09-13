# Phase 6: Merchant Dashboard & Platform Admin - Research

**Researched:** 2026-09-13
**Domain:** Multi-tenant admin surfaces, cross-tenant authorization, in-app messaging, manual payment claim (reversed payer/payee)
**Confidence:** HIGH (codebase-derived; every load-bearing claim verified by reading the file it describes)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Super Admin surface identity**
- **D-01:** A separate route tree with its own layout (e.g. `src/app/admin/**` or `src/app/(admin)/**`), not the merchant dashboard shell with an extra nav section. Admin-only code and layout stay out of the merchant dashboard bundle entirely.
- **D-02:** Visually distinct from the merchant dashboard — reuse the existing gold accent (already reserved in the design system as "a deliberate brand highlight, never generic") for admin chrome, plus a persistent "you are here" banner (e.g. "EINORT Platform Admin") given how consequential its actions (suspend, moderate) are.
- **D-03:** Reached only via an unlinked URL — no link anywhere in the merchant dashboard UI (deliberately more obscure than re-adding the removed header stub from `260907-a2v`; no discoverability risk at all).
- **D-04:** The platform owner's account is admin-only — `platformRole = "admin"` with no `Organization`/store of its own. No switching between a merchant dashboard and the Super Admin from the same account.
- **D-05:** Login flow is unchanged — same `/login` page as merchants (email/password via Better Auth), then post-auth routing sends `platformRole === "admin"` sessions to `/admin` instead of `/dashboard`. No second login page.
- **D-06:** A non-admin session hitting `/admin/*` sees an indistinguishable 404 — the same not-found page as a route that doesn't exist at all, not a "you don't have permission" page. Matches this codebase's existing fail-closed, ambiguous-on-purpose pattern (suspended/unknown tenants already resolve identically).

**Support messaging thread (ADM-05 / SUB-03's channel)**
- **D-07:** Placement in the merchant dashboard: a persistent sidebar nav item (e.g. "Support" or "Messages"), same visual weight as Orders/Products, with an unread badge — not tucked into Settings, not gated behind the header bell alone.
- **D-08:** The Super Admin inbox is a flat list of every merchant thread, sorted unread/most-recent first — not grouped by urgency/reason category (no such taxonomy exists or is needed at pilot scale).
- **D-09:** A new message triggers both the in-app badge AND an email nudge — this is the first real wiring of `resend` (currently a declared dependency with zero send calls anywhere under `src/`).
- **D-10:** Attachments (files/images) are allowed on ANY message in the thread, not restricted to the payment-claim-submission flow — matches ADM-05's literal wording ("text plus file/image attachments"). Reuses the existing R2 upload pipeline.
- **D-11:** Unread indication is both a total-count badge at the inbox entry point AND a per-thread indicator in the flat list — both derive from the same unread-message query, so building one gets the other nearly free.
- **D-12:** A merchant's thread is one continuous conversation, never archived or closed — matches ADM-05's "persistent, per-merchant thread" wording. No thread-lifecycle UI to build.
- **D-13:** No canned/quick-reply templates for the owner in this phase — freeform typing only. Revisit if message volume grows past what a solo owner can handle by typing.

**Suspend action**
- **D-14:** Suspending opens a confirm dialog with a REQUIRED reason field — the reason is logged (not just a plain "Are you sure?").
- **D-15:** Suspending automatically posts a message into that merchant's support thread containing the reason — reuses the thread built above; no separate notification system.
- **D-16:** A suspended merchant's dashboard login resolves to the existing branded `/suspended` page, dashboard otherwise fully inaccessible — reuses the fail-closed pattern `ARCHITECTURE.md` documents for the storefront. Do not build a read-only dashboard mode for suspended merchants.
- **D-17:** Suspension is reversible from the same Super Admin control — a symmetric toggle (suspend when active, un-suspend when suspended). No separate reactivation flow, no "needs a manual DB fix" friction.

**Payment-claims ledger & domain status**
- **D-18:** The global payment-claims ledger is one flat, sortable/filterable table across every tenant (merchant name as a column) — not grouped-by-merchant/expandable.
- **D-19:** Confirm/reject happens inline, directly from the ledger row — same one-tap pattern as the existing merchant-side Payment Claims queue (ORD-03). No jump into a per-merchant context required to act.
- **D-20:** Customer→merchant order-payment claims (Phase 3's existing `PaymentClaim` model) and merchant→platform subscription-payment claims (this phase's new SUB-03 flow) get TWO SEPARATE views/pages in the Super Admin — different actors and different consequences (confirming one releases an order; confirming the other extends a subscription). Do not build one combined table with a type-discriminator column.
- **D-21:** ADM-03's "domain status" requirement is satisfied as a column/section within the merchant/store list, NOT its own dedicated page — at this phase, only `{store}.einort.com` subdomains exist (custom domains are Phase 15, not yet built), so there is no real per-domain content to justify a separate page yet. Design the merchant-list column so Phase 15 has an obvious place to extend it later, without over-building a near-empty page now.

### Claude's Discretion
- Exact SUB-03 data model: whether the subscription-payment claim reuses/extends the existing `PaymentClaim` model with a discriminator, or is a new, separate model (e.g. `SubscriptionPaymentClaim`) tied to `Organization` rather than `Order`. Research should evaluate both against the existing claim pattern and recommend one — this is an implementation detail, not a vision question.
- Exact `/admin` route naming and internal structure (`src/app/admin/**` vs. a route group like `src/app/(admin)/**`), and how `requireMerchantContext`'s sibling admin-auth check should be named/shaped.
- Exact confirmation of what quick task `260906-egn`'s dashboard Overview already satisfies against DASH-01/DASH-02's literal wording, so this phase's plan doesn't redundantly rebuild it.
- Whether the merchant-list "suspend" action lives as a row action, a detail-page action, or both — left to UI-SPEC.
- Exact visual treatment of the gold accent + banner (banner copy, placement, whether it's a full-width top bar or a smaller badge near the Admin surface's own header) — left to UI-SPEC.

### Deferred Ideas (OUT OF SCOPE)
- **The full ~17-page Platform Admin surface** (analytics, fraud/abuse, theme library management, feature flags, broadcast notifications, full observability, usage dashboards) — explicitly deferred to a future milestone.
- **Canned/quick-reply templates** for the support thread (D-13) — deferred, not rejected.
- **Grouped/categorized inbox** (D-08) — deferred in favor of a flat list.
- **Domains as its own Super Admin page** (D-21) — deferred until Phase 15 (Custom Domains).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Merchant dashboard shows orders (with the Payment Claims queue surfaced prominently), products/inventory, and basic sales numbers | § "DASH-01/02 Gap Analysis" — 3 of 4 clauses already satisfied by `260906-egn`; the missing clauses are the Overview-level claims queue and products/inventory |
| DASH-02 | Dashboard answers "how is the business performing, what needs attention, what's next" at a glance — pending claims, low stock, disputed orders visible without digging | § "DASH-01/02 Gap Analysis" — "how is it performing" satisfied; "what needs attention" is the real gap (low stock does not exist anywhere in the codebase; disputed orders are not surfaced) |
| ADM-01 | Platform owner can view and suspend merchants/stores | § Pattern 1 (`requireAdminContext`), Pattern 2 (`adminAction`), Pattern 5 (single sanctioned `Organization.status` writer) |
| ADM-02 | Platform owner can view a global payment-claims ledger across all tenants | § Pattern 6 (cross-tenant reads through `adminDb`), § Pitfall 3 (the merchant-side claim actions cannot be reused) |
| ADM-03 | Platform owner can view domain status across tenants and has a support-contact view | § Pattern 7 (domain status is derived, not stored), § Pattern 3 (the support thread) |
| ADM-04 | Platform admin scope stays pilot-sized | Enforced by scope, not code — see § Anti-Patterns |
| ADM-05 | Persistent per-merchant messaging thread with attachments, in-app badge, email nudge | § Pattern 3 (schema), Pattern 4 (attachments via R2), Pattern 8 (Resend — already wired, see the correction below) |
| SUB-03 | Merchant submits subscription payment proof through the thread; owner confirms/rejects, activating/extending the subscription | § "Discretion Q1" — recommend a new `SubscriptionPaymentClaim` model; § Open Question 1 (what "extending" means, unresolved) |
</phase_requirements>

---

## Summary

This phase is roughly 80% new construction and 20% wiring into machinery that already exists and is unusually well-defended. The good news is that almost every primitive the phase needs was deliberately pre-built and left unused: `adminDb` (the unscoped cross-tenant Prisma facade, ESLint-fenced to `src/server/admin/**`), `User.platformRole` (`input: false`, NOT NULL, default `"merchant"`), `Organization.status` (NOT NULL, default `"active"`), the `IMAGE_PRESETS` registry, the presign→PUT→finalize R2 upload triad, and the `merchantAction()` factory whose shape the admin equivalent should mirror. Nothing needs inventing at the infrastructure layer; the phase's real work is composing these correctly and not tripping the codebase's many source-scanning contract tests.

**One material correction to the phase's own framing.** CONTEXT.md D-09, `CLAUDE.md`, and `ROADMAP.md` all state that `resend` is "a declared dependency with zero send calls anywhere under `src/`" and that D-09 is its first real wiring. **This is no longer true.** `src/server/claims/notify.ts` is a complete, production Resend integration — it imports `Resend`, resolves the store owner's address through `platformDb.member`, sends via `resend.emails.send`, checks *both* failure channels (the rejection and the resolved `error` field), and degrades to a loud `console.warn` when `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are absent. It is called from `after()` in `src/server/claims/submit.ts:353`. D-09's intent is unchanged — the support thread does need an email nudge — but the plan must treat this as **the second consumer of an established pattern**, not a greenfield integration. The pattern to copy is already written, tested in production shape, and carries a 60-line header explaining every decision. Duplicating it badly is now the risk; inventing it is not.

**The three things most likely to break the build are contract tests, not features.** `tests/unit/dashboard-nav.test.ts` asserts that `variant="gold"` appears exactly once in `app-sidebar.tsx` and nowhere else outside the order-state chip — D-02's gold admin chrome will fail that test unless it is extended in the same commit. `tests/unit/dashboard-nav.test.ts` also fails if a new nav destination (D-07's "Support" item) is added to the rail without adding its href to `REQUIRED_HREFS`. And `tests/isolation/model-registry-drift.test.ts` fails if any new model carrying a `tenantId` column is not registered in `TENANT_SCOPED_MODELS` — which in turn obliges edits to `tests/setup/seed-two-tenants.ts` and `tests/isolation/tenant-isolation.test.ts`, both of which throw explicit "you added a model and forgot me" errors. Every new schema model in this phase costs four files, not one.

**Primary recommendation:** Build `src/server/admin/**` as a mirror of `src/server/merchant/**` — `context.ts` exporting a parameterless, `React.cache()`-memoized `requireAdminContext()` that calls `notFound()` (never `redirect`) on any failure, and `action.ts` exporting an `adminAction()` factory with no entitlement/`mode` axis. Put the routes at `src/app/admin/**` (a literal segment, not a route group). Model the support thread as **one** tenant-scoped `SupportMessage` table plus a `SupportAttachment` child, with every count derived at read time and no counter columns. Model SUB-03 as a **new** `SubscriptionPaymentClaim` model, not a discriminated `PaymentClaim` — the existing model's composite FK to `Order`, its per-tenant reference uniqueness, and the source-scanning single-writer test all make extension worse than a sibling.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Admin identity / `platformRole` check | API / Backend (`src/server/admin/context.ts`) | — | Session-derived; a client-side role check is decoration. Mirrors `requireMerchantContext` exactly. |
| `/admin` route gating | Frontend Server (RSC page) calling Backend DAL | — | A Next 16 layout cannot prevent child segments rendering and does not re-run on sibling client nav — this codebase already documents that at `src/app/(dashboard)/layout.tsx:23-44`. Every admin page calls the DAL itself. |
| Cross-tenant reads (merchant list, claims ledger) | API / Backend (`adminDb`) | — | `adminDb` is ESLint-fenced to `src/server/admin/**`; a page component cannot import it. |
| Suspend / un-suspend write | API / Backend (single sanctioned writer module) | — | First writer of `Organization.status`; must pair with an audit trail and a thread message (D-15). |
| Support message compose + send | API / Backend Server Action | Browser (form state via react-hook-form + Zod) | Server Action is a public endpoint; the schema is the trust boundary. |
| Attachment bytes | CDN / Storage (direct browser→R2 presigned PUT) | API / Backend (mint + finalize) | Next 16 caps Server Action bodies at 1 MB; a phone screenshot exceeds it. Documented at `src/server/images/r2.ts:18-27`. |
| Attachment re-encode | API / Backend, Node runtime only (Sharp) | — | Sharp is a libvips binding; Edge cannot load it. Hard crash, not degradation. |
| Unread badge counts | API / Backend (derived `count()` per render) | — | The codebase explicitly rejects denormalized counters — `src/server/claims/queries.ts:14-33`. |
| Email nudge | API / Backend, inside `after()` | — | Never blocks the response; never fails the mutation. Established at `src/server/claims/notify.ts`. |
| Post-login role routing | API / Backend (`signInMerchant` returns the target) | Browser (`router.push`) | The client cannot be trusted to decide, and it does not know `platformRole` before the push. |
| Domain status display | API / Backend (derived from `Organization.slug` + `status`) | — | No `Domain` table exists; nothing to read. Phase 15 adds the real source. |

---

## Discretion Questions — Answered

These are the seven genuinely open questions the orchestrator flagged. Each answer below is derived from files actually read in this session.

### Q1 — SUB-03's data model: extend `PaymentClaim`, or a new model?

**Recommendation: a new `SubscriptionPaymentClaim` model. Reuse the *pattern*, not the *table*.** Confidence: HIGH.

Four independent facts in the existing schema and test suite make extension the more expensive option:

1. **The composite FK cannot be made optional cleanly.** `PaymentClaim.order` is `@relation(fields: [tenantId, orderId], references: [tenantId, id], onDelete: Cascade)` (`prisma/schema.prisma:525`). A subscription claim has no order, so `orderId` would have to become nullable — and the schema already documents (at `Product.category`, lines 351-360) that a partially-required composite FK forces an explicit non-default `onDelete` because `SetNull` is invalid when one half of the key is NOT NULL. You would be weakening the strongest structural guarantee on the table to store rows that never use it.
2. **The uniqueness scope is wrong.** `@@unique([tenantId, referenceNormalized])` (line 549) is correct for customer→merchant claims: two customers of *different* merchants may legitimately quote the same operator reference, and duplicate detection is a per-merchant concern. For merchant→platform claims the receiving account is the platform's single account, so the correct constraint is **global** — the same reasoning `Order.trackingTokenHash` (line 466) and `StoreSlugHistory.slug` already carry. One table cannot hold both constraints.
3. **A source-scanning test forbids a second writer.** `src/server/claims/actions.ts:25-33` states that `tests/isolation/claims.test.ts` scans the source tree and fails if any module other than that file sets a claim's status to `CONFIRMED`. An admin-side confirm on the same table would be exactly that second writer. You would have to weaken an ORD-02 structural control to ship SUB-03.
4. **The judge and the consequence differ.** Confirming a `PaymentClaim` transitions an `Order` through `transitionOrder` and writes an `OrderEvent`; confirming a subscription claim writes `Organization.subscriptionStatus`. Sharing a table would put two unrelated state machines behind one `status` column.

**Recommended shape** (field names deliberately echo `PaymentClaim` so the pattern is visibly the same):

```prisma
/// SUB-03. The manual-claim pattern with payer and payee reversed: the MERCHANT
/// is the payer, the PLATFORM OWNER is the judge. Deliberately NOT a
/// discriminated PaymentClaim — see 06-RESEARCH.md § Discretion Q1.
model SubscriptionPaymentClaim {
  id       String @id @default(cuid())
  /// `organization.id`. Tenant-scoped so the merchant side reads it through
  /// scopedDb; the admin side reads it through adminDb.
  tenantId String

  operator PaymentOperator
  reference           String
  /// DELIBERATELY GLOBAL UNIQUE, unlike PaymentClaim's per-tenant key: the
  /// payee is one platform account, so the same reference twice is the same
  /// payment twice, whoever sent it.
  referenceNormalized String @unique
  amountXaf           Int

  /// R2 derivative PREFIX (never an `/original` key). NULL when no receipt.
  receiptKey String?

  status           ClaimStatus @default(PENDING)
  rejectionReason  String?
  submittedAt      DateTime    @default(now())
  reviewedAt       DateTime?
  /// The platform owner's user.id. NULL until reviewed.
  reviewedByUserId String?

  @@unique([tenantId, id])
  @@index([status, submittedAt])   // the admin ledger's own access path
  @@index([tenantId, submittedAt]) // the merchant's own history
  @@map("subscription_payment_claim")
}
```

Reuse `normalizeReference()` from `src/server/claims/reference.ts:52` verbatim (it is a pure function with no tenant coupling) and `ClaimStatus` / `PaymentOperator` from the existing enums. Reuse `AlreadyReviewedError` from `src/server/orders/errors.ts:123` for the optimistic-lock refusal, exactly as `confirmClaim` does.

**Caveat on the global unique:** a cross-tenant duplicate surfaces as a Prisma `P2002`, which is technically an existence oracle ("someone already claimed this reference"). Refuse it with a single generic message, never one that names the other tenant. This is the same posture `src/server/claims/actions.ts:56-65` takes for cross-tenant claim ids.

### Q2 — What does `adminAction()` look like?

**Recommendation:** two files mirroring `src/server/merchant/`, with three deliberate differences. Confidence: HIGH.

`merchantAction` (`src/server/merchant/action.ts`) has this shape: `import "server-only"` (not `"use server"` — it exports a factory, not an action), a required `mode: "read" | "write"` with no default, identity resolution *before* the payload is touched, the write refusal *before* the Zod parse, and a `catch` that converts exactly two error classes and rethrows everything else.

The admin equivalent drops `mode` entirely (there is no entitlement or trial axis on the platform owner), drops the `EntitlementError`/`ReadOnlyError` conversion (neither is reachable), and **fails with `notFound()` rather than `redirect()`**:

```ts
// src/server/admin/context.ts
import "server-only";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";

import { auth } from "@/server/auth/auth";

/** The one value a platformRole may hold to reach this surface. Allowlisted. */
const ADMIN_ROLE = "admin";

export interface AdminContext {
  /** The platform owner's user.id — the actor on every audit row this surface writes. */
  readonly userId: string;
}

/**
 * TAKES NO PARAMETERS, EVER — same contract as requireMerchantContext.
 * EVERY FAILURE IS notFound(), NEVER redirect() — D-06. A redirect to /login
 * tells an anonymous prober that /admin is a real route; a 403 tells them it is
 * a real route AND that they are close. The 404 is the whole control.
 */
export const requireAdminContext = cache(async (): Promise<AdminContext> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  if (session.user.platformRole !== ADMIN_ROLE) notFound();
  return { userId: session.user.id };
});
```

`session.user.platformRole` **is** present at runtime: `better-auth@1.6.29`'s `getFields(options, "user", "output")` merges `options.user.additionalFields` into the output schema, and `parseUserOutput` filters against it (`node_modules/better-auth/dist/db/schema.mjs:6-26`). The field carries no `returned: false`, and no `session.cookieCache` is configured in `src/server/auth/auth.ts`, so the value is read from the database row on every `getSession`. `[VERIFIED: installed better-auth source]`

```ts
// src/server/admin/action.ts
import "server-only";

import { z } from "zod";
// Type-only import: erased at build time, so this creates no runtime coupling
// between the admin zone and the merchant zone (TEN-05 is about code reuse, not
// about a shared result shape — forking ActionResult would fork the contract
// every form in this codebase already consumes).
import type { ActionResult } from "@/server/merchant/action";

import { requireAdminContext, type AdminContext } from "./context";

export function adminAction<S extends z.ZodType, R>(config: {
  schema: S;
  handler: (ctx: AdminContext, input: z.infer<S>) => Promise<ActionResult<R>>;
}) {
  return async (raw: unknown): Promise<ActionResult<R>> => {
    const ctx = await requireAdminContext();   // notFound() on any failure
    const parsed = config.schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      };
    }
    return config.handler(ctx, parsed.data as z.infer<S>);
  };
}
```

Two notes the planner must carry into tasks:

- **`notFound()` is legal in a Server Action.** Next 16's own reference states `notFound()` "can be invoked in Server Components, Server Functions, and Route Handlers" (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`). `[VERIFIED: bundled Next 16.3.1 docs]`
- **`tests/unit/no-tenant-id-param.test.ts` scans `src/server/merchant/**` and `src/server/entitlements/**`.** It does not currently scan `src/server/admin/**`. Extend it: `requireAdminContext(tenantId)` is the exact same substitution bug in a surface with *no* tenant predicate to fall back on, so the guard matters more here, not less.

### Q3 — What does `260906-egn`'s Overview already satisfy? (DASH-01/02 Gap Analysis)

Read line-by-line from `src/app/(dashboard)/dashboard/page.tsx`, `src/server/dashboard/queries.ts`, `src/app/(dashboard)/dashboard/overview-metrics.tsx`, and `src/app/(dashboard)/layout.tsx`.

**What ships today on `/dashboard`:** store name + storefront address + "View my store" link; four metric cards — Revenue (7-day window, `CONFIRMED`+`FULFILLED` only), Active orders (deliberately **unwindowed** backlog across `ORDER_PLACED`/`PAYMENT_PENDING`/`PAYMENT_CLAIMED`/`CONFIRMED`), Units sold (7 days), New customers (7 days, set difference over normalized `customerPhone`); a hand-rolled 7-bar revenue chart; and the five most recent orders. Separately, the shell renders a **gold pending-claims count badge on the sidebar's "Payment claims" rail item**, fed by `pendingClaimCount()` on every dashboard render (`src/app/(dashboard)/layout.tsx:86`).

| Requirement clause | Status | Evidence / gap |
|---|---|---|
| DASH-01 "shows orders" | ✅ Satisfied | `recentOrders()` (5 rows) on Overview + the full `/dashboard/orders` page |
| DASH-01 "with the Payment Claims queue surfaced prominently" | ⚠️ **Partial** | The queue lives on `/dashboard/claims`; its only Overview-adjacent presence is the gold sidebar badge. Nothing on the Overview page itself shows a pending claim. Defensible as "prominent" but **not** "on the dashboard" — recommend a claims panel/card on Overview |
| DASH-01 "products/inventory" | ❌ **Missing** | No product or stock figure appears on Overview at all. `/dashboard/products` exists; the Overview has no products card |
| DASH-01 "basic sales numbers (revenue, order count, products sold)" | ✅ Satisfied | Revenue, Active orders, Units sold cards |
| DASH-02 "how is the business performing" | ✅ Satisfied | Cards + 7-bar chart |
| DASH-02 "pending claims visible without digging" | ⚠️ **Partial** | Sidebar badge only — a count, not the work |
| DASH-02 "low stock visible without digging" | ❌ **Missing** | **Low stock does not exist anywhere in this codebase.** A repo-wide grep for `lowStock`/`LOW_STOCK` returns exactly two hits, both the storefront shopper-facing "Only {n} left" copy (`src/lib/strings/index.ts:1089`, `src/app/s/[slug]/p/[productSlug]/add-to-cart.tsx:231`). There is no threshold constant, no query, no merchant-facing surface |
| DASH-02 "disputed orders visible without digging" | ❌ **Missing** | `DISPUTED` appears in the dashboard tree only inside `reject-dialog.tsx`'s comments and as an explicit *exclusion* from the revenue metric. No count, no card, no filter chip |

**Conclusion for the planner:** do **not** rebuild the Overview. The net-new merchant-side work is a "What needs attention" band — pending claims, low stock, disputed orders — plus a products/inventory figure, added alongside the existing cards. Three of those four require new queries; low stock additionally requires a *threshold decision* that does not exist yet (see Open Question 2).

### Q4 — Resend: the send-call pattern and graceful degradation

**Correction first:** Resend is already wired. `src/server/claims/notify.ts` is a full integration. D-09 is its second consumer, not its first.

**Recommendation:** create `src/server/support/notify.ts` modeled on `claims/notify.ts`, and extract the shared transport into a thin `src/server/email/send.ts` so the degradation posture exists in exactly one place. Confidence: MEDIUM (the extraction touches a Phase-3 file with existing behavior; a planner may reasonably prefer a self-contained copy).

The pattern that must be preserved verbatim, whichever structure wins:

1. **Read `env.RESEND_API_KEY` and `env.RESEND_FROM_EMAIL`; if either is absent, `console.warn` a named, explicit DEGRADED message and return.** Both are `.optional()` in `src/env.ts:59-60` precisely so a deployment without email still functions. The existing warn text names the surface, names the missing keys, names the reliable channel that is unaffected, and says what it means in production. Match that register.
2. **Check BOTH failure channels.** `resend.emails.send` rejects on transport failure *and* returns `{ error }` on API-level refusal (unverified sending domain, malformed address, suppressed recipient). `claims/notify.ts:150` checks the resolved `error`; the surrounding `try/catch` checks the rejection. Checking only one makes an undelivered notification look like a success.
3. **Never reject.** The function returns `void` and swallows everything into `console.warn`/`console.error`. Call it from `after()` (`src/server/claims/submit.ts:353` is the precedent) so it runs after the response is flushed.
4. **The in-app badge is the reliable channel; the email is a nudge.** No retry, no queue, no delivery-status column. `claims/notify.ts:27-36` argues this at length; the same argument applies to D-11's unread badge.
5. **Resolve the recipient at send time, add no column.** Merchant direction: `platformDb.member.findFirst({ where: { organizationId, role: "owner" }, select: { user: { select: { email: true } } } })` — copy `ownerEmailFor` from `claims/notify.ts:85`. Admin direction: `platformDb.user.findFirst({ where: { platformRole: "admin" }, select: { email: true } })`.
6. **Copy lives in `strings`.** `strings.claims.email` is the precedent (`subject`/`heading`/`body` with `{token}` placeholders, plain single-column HTML plus a text part, no links).

One content rule worth carrying over: `claims/notify.ts:47-58` deliberately omits the transaction reference from the email body because mail is unencrypted and the reference is the one value the reviewer must read off their *own* receipt. The same reasoning applies to a SUB-03 nudge — say a claim arrived, do not quote the reference.

### Q5 — Attachment storage for the support thread

**Recommendation: reuse the R2 triad exactly, add one `UploadKind` and one `IMAGE_PRESETS` row, and restrict attachments to the three raster image types already allowed. Do not build an arbitrary-file path in this phase.** Confidence: HIGH on the mechanism, MEDIUM on the image-only scope (it is a narrowing of D-10's "file/image", so it needs user confirmation — see Assumption A2).

The existing pipeline is a three-step triad, and every step is a security control:

- **Mint** — a Server Action that accepts *only* `contentType` and `byteSize` (never a key, path, or filename) and returns a 5-minute presigned PUT. `presignUpload` signs `content-type` **and** `content-length` into `signableHeaders`; `src/server/images/r2.ts:183-213` records that this was verified empirically against the real bucket, and that without it a grant minted for `image/jpeg` accepted a `text/html` body with 200 OK.
- **PUT** — browser → R2 directly. Bytes never transit the app (Next 16 caps Server Action bodies at 1 MB).
- **Finalize** — a Route Handler that re-authorizes from scratch, reads the original back, runs `processImage`, writes the derivative beside it, and returns the **prefix** — never the `/original` key. `publicUrlFor` throws on a key ending in `/original` (`r2.ts:273`), so the uploaded bytes are structurally unservable.

For the thread, that means:
- `UploadKind` gains `"threads"` (or `"support"`) alongside `products | claims | logos` (`r2.ts:87`). Key layout stays `tenants/{tenantId}/{kind}/{uploadId}/original`.
- `IMAGE_PRESETS` gains one row. **Copy the `claim` row's spec** (`sizes: [1200]`, `labels: ["full"]`, `fit: "inside"`, `ratio: null`, `enhance: true`, `lossless: false`) — the reasoning at `pipeline.ts:36-42` is that a payment screenshot is *evidence* and a square crop can remove the transaction reference. A support-thread attachment is the same kind of artifact. If nothing differs, reusing the `claim` preset outright is also defensible and cheaper.
- **Two upload doors, not one branch.** The merchant's attachment mint is a `merchantAction`; the admin's is an `adminAction`. `src/server/images/claim-upload.ts:28-41` and `src/app/api/upload/claim-finalize/route.ts:22-35` both argue at length that widening one route's authorization to accept a second credential is the change that makes a trust boundary unreadable. Follow that precedent: `src/server/images/thread-upload.ts` + `src/app/api/upload/thread-finalize/route.ts`, or two narrow actions, but never one route with an "or".

**Why not arbitrary files (PDF etc.):** `ALLOWED_UPLOAD_CONTENT_TYPES` is three raster formats, and `r2.ts:46-54` explains that every accepted format is a decoder Sharp must be trusted with, and that SVG is excluded because it is a script-carrying document served from the platform's own origin. A PDF cannot be re-encoded by Sharp, so it would have to be served as the uploaded bytes — the exact outcome the re-encode exists to prevent (T-03-28). Shipping PDF support means designing a second, non-re-encoding storage path with its own content-disposition and origin-isolation story. That is a phase of its own, not a task.

**One property to state explicitly in the plan:** R2 derivatives are served from `R2_PUBLIC_BASE_URL` with no authentication. A support-thread attachment is therefore a capability URL — unguessable (a v4 UUID in the key) but public to anyone holding it. This is already true of claim screenshots, so it is established precedent rather than a new exposure, but a thread attachment may contain a receipt with a phone number, so the plan should record the acceptance rather than discover it later.

### Q6 — Exact Prisma schema additions

**Recommendation: three new models, all tenant-scoped, no counter columns.** Confidence: HIGH on shape, MEDIUM on the thread-vs-messages split (see below).

**Do not create a `SupportThread` model.** D-12 makes a thread "one continuous conversation, never archived or closed" and there is exactly one per organization, so a thread row would carry no state of its own — only denormalized `lastMessageAt` / `unreadCount` columns, which is precisely what `src/server/claims/queries.ts:14-33` argues against at length ("a number derived from the rows cannot drift from the rows"). The thread is `SupportMessage WHERE tenantId = X ORDER BY createdAt`. The inbox is a `groupBy(["tenantId"])`. `[Recommendation, HIGH confidence — derived from the codebase's own stated doctrine]`

```prisma
/// ADM-05. Who wrote a support message. Mirrors `EventActor`'s three-valued
/// shape deliberately: SYSTEM is what D-15's automatic suspension notice and
/// every later phase's automated notice are written as, so a merchant can tell
/// a human reply from a platform event.
enum SupportAuthor {
  MERCHANT
  PLATFORM
  SYSTEM
}

/// ADM-05 / D-07..D-13. One continuous per-merchant conversation. There is no
/// thread row: the thread IS the set of messages for a tenant, and every count
/// this surface shows is derived at read time. DO NOT ADD A COUNTER COLUMN.
model SupportMessage {
  id       String @id @default(cuid())
  /// `organization.id`. Organization-scoped, not user-scoped — the thread
  /// belongs to the store, so a future second staff account inherits it.
  tenantId String

  author SupportAuthor
  /// user.id for MERCHANT and PLATFORM. NULL for SYSTEM. Same contract as
  /// `OrderEvent.actorUserId`.
  authorUserId String?

  /// Freeform. May be empty ONLY when the message carries an attachment;
  /// enforced in the action's Zod schema, not by the column.
  body String

  /// Read receipts as timestamps, not booleans — "when" is free to store and
  /// impossible to reconstruct later. NULL means unread by that side.
  readByMerchantAt DateTime?
  readByPlatformAt DateTime?

  /// SUB-03: set when this message is the one that announced a subscription
  /// claim, so the thread can render the claim inline. NULL on every other
  /// message. NOT a relation — a claim may be reviewed from the ledger page
  /// with no message in scope, and a required relation would invert that.
  subscriptionClaimId String?

  createdAt DateTime @default(now())

  attachments SupportAttachment[]

  @@unique([tenantId, id])                      // enables the composite FK below
  @@index([tenantId, createdAt])                // the thread read
  @@index([author, readByPlatformAt, createdAt]) // the admin inbox's unread scan
  @@map("support_message")
}

/// D-10. Zero or more per message. A child model rather than a JSON column,
/// matching `ProductImage` — width/height are read back from the encoder and a
/// JSON blob cannot be indexed or constrained.
model SupportAttachment {
  id        String @id @default(cuid())
  tenantId  String
  messageId String
  /// `onDelete: Cascade` — an attachment has no meaning without its message.
  message   SupportMessage @relation(fields: [tenantId, messageId], references: [tenantId, id], onDelete: Cascade)

  /// R2 derivative PREFIX, never an `/original` key.
  storageKey String
  width      Int
  height     Int
  createdAt  DateTime @default(now())

  @@index([tenantId, messageId])
  @@map("support_attachment")
}
```

Plus `SubscriptionPaymentClaim` as specified in Q1.

**Every new model costs four files, not one.** This is the single most-missed obligation in this codebase:

1. `prisma/schema.prisma` + a migration.
2. `REGISTERED_MODELS` in `src/server/db/tenant-scoped.ts:54` — **appended in FK dependency order** (`SupportMessage` before `SupportAttachment`; `SubscriptionPaymentClaim` has no parent so it goes at the end). The array's insertion order drives a batched `$transaction` in the seed fixture; re-sorting it breaks the suite. `tests/isolation/model-registry-drift.test.ts` derives the required set from the generated client and fails on any model with a `tenantId` column that is not registered.
3. `tests/setup/seed-two-tenants.ts` — the seed loop iterates `TENANT_SCOPED_MODELS` and throws by name if a registered model has no seed data (line ~746: *"The isolation suite iterates TENANT_SCOPED_MODELS and needs one …"*).
4. `tests/isolation/tenant-isolation.test.ts` — a fixture-data map entry (line ~83, error at ~302: *"Adding a model to TENANT_SCOPED_MODELS also means adding an entry to …"*). The suite then generates ~9 isolation assertions per model automatically.

`[VERIFIED: read directly from each file]`

**Scoping note that resolves an apparent contradiction:** these models are tenant-scoped *and* read by the admin surface. That is not a conflict. The merchant side reads them through `scopedDb(ctx.tenantId)`; the admin side reads them through `adminDb`, which is the raw client and works on every model. The ESLint fence forbidding `src/server/admin/**` from importing `tenant-scoped.ts` is satisfied because the admin code never touches `scopedDb` — it uses the unscoped client on purpose, and its authorization comes from `requireAdminContext` instead of from a tenant predicate.

### Q7 — Route structure and proxy interaction

**Recommendation: `src/app/admin/**` — a literal segment, not a route group. No proxy change is needed. Confirmed, not assumed.** Confidence: HIGH.

- A route group `(admin)` adds no URL segment; it exists to share a layout *without* changing the URL. The URL here **is** `/admin`, so the literal directory is the correct convention and reads the same on disk as in the address bar. `(dashboard)` is a group only because the dashboard's layout also wraps other apex routes.
- **The proxy needs nothing.** `src/proxy.ts` classifies the `Host` header: `root` and `reserved` are plain passthroughs (`NextResponse.next(forward)`), `store` rewrites the whole path under `/s/{slug}`, `unknown` rewrites to `/store-not-found`. `/admin` on the apex passes straight through. A merchant subdomain requesting `/admin` is rewritten to `/s/{slug}/admin`, where no route file exists — a 404, for free, by the same mechanism that keeps `/dashboard` and `/api/auth/*` apex-only. `[VERIFIED: src/proxy.ts:87-107]`
- **`"admin"` is already in `RESERVED_SLUGS`** (`src/server/tenant/reserved-slugs.ts:37`), so no merchant can register `admin.einort.com` and shadow the surface.
- **The gate goes in every page, and also in the layout.** `src/app/(dashboard)/layout.tsx:23-44` documents why a Next 16 layout is not an authorization boundary (it cannot prevent child segments rendering, and it does not re-run on client-side navigation between siblings). Put `requireAdminContext()` in `src/app/admin/layout.tsx` *for the chrome's data* and in **every** `page.tsx` as the actual gate. `React.cache()` collapses the duplicates to one `getSession`.
- **Do not add `src/app/admin/not-found.tsx`.** D-06 requires the 404 to be byte-identical to a route that does not exist. With no local boundary, `notFound()` thrown in the admin tree bubbles to the root `src/app/not-found.tsx`, rendered inside the root layout with the admin layout skipped — indistinguishable from `/asdf`. A local not-found page would render *inside* the admin chrome and leak the surface's existence.
- **`src/app/admin/**` is not inside the ESLint admin zone.** The zone is `src/server/admin/**` only (`eslint.config.mjs:96`). Page components therefore cannot import `adminDb` — they must call into `src/server/admin/**`. This is correct and should be stated in the plan so nobody "fixes" the lint error by widening the fence.

---

## Project Constraints (from CLAUDE.md)

Binding on all new code in this phase:

| Directive | Application to this phase |
|---|---|
| Tenant isolation enforced structurally; never call raw Prisma outside sanctioned zones | Admin code lives in `src/server/admin/**` and uses `adminDb`; merchant code uses `scopedDb`. No third path. |
| Never trust client-supplied `tenantId`, price, stock, or payment/order status | The suspend action takes an organization id **from the admin's own list**, and that is legitimate (the admin surface is cross-tenant by design) — but it must still be validated against a real row, and the reason string must be Zod-bounded. |
| No hard deletes for merchant-owned data (D-08) | Suspension is a status flip, never a delete. Support messages are append-only — no edit, no delete. |
| UI copy centralized in `src/lib/strings` — contract tests scan `.tsx` for prose literals | New `admin` and `support` namespaces required. Given the file is already ~1,600 lines, follow the `marketing.ts`/`flagship.ts` precedent: `src/lib/strings/admin.ts` spread into the index. |
| Sharp/image code runs Node runtime only — never `export const runtime = "edge"` | The thread-finalize route reaches `processImage`. Add nothing; Node is the default. The failure mode is *adding* the line. |
| Currency formatting via `Intl.NumberFormat("fr-CM", …)` | The claims ledger and subscription amounts. `formatXaf` already exists in `src/server/payments/whatsapp.ts`. |
| `"use server"` and `import "server-only"` are mutually exclusive first lines | `action.ts`/`context.ts` factories are `server-only`; actual action modules are `"use server"`. |
| Every non-trivial module opens with a *why* header citing requirement/decision IDs | Non-negotiable house style. Cite `ADM-01`..`ADM-05`, `SUB-03`, `D-01`..`D-21`. |
| `npm run lint` runs with `--max-warnings=0` | Zero-tolerance gate. |
| `$queryRaw`/`$executeRaw` banned repository-wide | The admin inbox's "latest message per tenant" cannot be a raw SQL lateral join. See Pattern 6. |
| Read the bundled Next 16 docs before writing code | `node_modules/next/dist/docs/` — this Next differs from training data. |

---

## Standard Stack

### Core

**No new packages. This phase installs nothing.** Every capability it needs is already a declared, in-use dependency.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.3.1 | App Router, Server Actions, `notFound()`, `after()` | Already the framework |
| `better-auth` | 1.6.29 | `platformRole` additional field on the session user | Already the auth layer; the field is already emitted and generated |
| `prisma` / `@prisma/client` | 7.9.1 | New models + migration | Already the ORM |
| `zod` | 4.4.3 | Every action schema | Already the validation layer |
| `resend` | 6.22.0 | D-09 email nudge | **Already wired** at `src/server/claims/notify.ts` — copy the pattern |
| `sharp` | 0.35.3 | Attachment re-encode | Already the image pipeline |
| `@aws-sdk/client-s3` + presigner | 3.1116.0 | Attachment upload to R2 | Already the storage transport |
| `react-hook-form` + `@hookform/resolvers` | 7.85.0 / 5.9.0 | Compose form, suspend dialog | Already the form layer |
| `sonner` | 2.0.8 | Toasts on admin actions | Already mounted in the dashboard shell — **note it is NOT mounted in an admin layout yet** |
| `lucide-react` | ^1.31.0 | Icons | Already the icon set |

### Supporting (already present, worth naming)

| Module | Purpose | When to Use |
|---|---|---|
| `src/components/ui/table.tsx` | The claims ledger and merchant list | D-18's flat sortable table |
| `src/components/ui/alert-dialog.tsx` | D-14's suspend confirm dialog | Already used by `reject-dialog.tsx` — that file is the closest existing analogue (required reason, min-length, destructive confirm) |
| `src/components/dashboard-card.tsx` | Card primitive from `260903-ugl` | Overview's "needs attention" band |
| `src/server/claims/reference.ts` → `normalizeReference()` | SUB-03 reference normalization | Pure, reusable, no tenant coupling |
| `src/server/payments/whatsapp.ts` → `formatXaf()` | XAF display | Already used by `claims/notify.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Hand-rolled `adminAction` factory | `next-safe-action` | Rejected for the same reason `merchantAction`'s header rejects it: it would fork the `{ ok, error }` contract every form in this codebase consumes, and it is a new package this project's zero-install audit would have to justify. |
| Better Auth `admin` plugin | The existing `platformRole` field | Already rejected in `src/server/auth/auth.ts:73-77` — one staff account does not need banning/impersonation, and the plugin is unnecessary attack surface. Do not revisit. |
| Derived unread counts | Counter columns on a thread row | Rejected by the codebase's own stated doctrine (`claims/queries.ts:14-33`): four places to be wrong, and a badge that lies is worse than no badge. |
| `SupportThread` + `SupportMessage` | `SupportMessage` alone | The thread row would carry no state D-12 permits it to carry. Adding it costs a fifth model registration for nothing. |

**Installation:** none.

---

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.**

Every dependency it uses is already present in `package.json` with a pinned or caret version, already imported by shipped code, and already exercised by the existing test suite. No `npm install` task should appear in any plan for this phase. If a plan proposes one, that is a signal the design drifted from the recommendations above (most likely: an arbitrary-file upload path, a rich-text editor, or a table library).

Should a later planning decision introduce a package after all, run the Package Legitimacy Gate (`slopcheck install <pkg> --json`, then `npm view <pkg> version` and `npm view <pkg> scripts.postinstall`) before it enters a plan, and gate the install behind a `checkpoint:human-verify` task — the precedent in this repo is `260906-egn`'s "human-approved package gate" for `next-themes@0.4.6`.

---

## Architecture Patterns

### System Architecture Diagram

```text
                          ┌───────────────────────────────┐
   Host header  ─────────►│  src/proxy.ts (no I/O)        │
                          │  classifyHost()               │
                          └───┬───────────┬───────────┬───┘
                     root/reserved      store      unknown
                              │           │           │
                              │      rewrite to   /store-not-found
                              │      /s/{slug}/*      (404)
                              ▼           ▼
              ┌───────────────────────────────────────────────┐
              │            APEX ROUTE TREES                   │
              └───┬───────────────────────┬───────────────────┘
                  │                       │
        /login ───┴──► signInMerchant ────┴──► returns { ok, redirectTo }
                          (server reads platformRole)      │
                                                            │
              ┌─────────────────────────────────────────────┴──────────┐
              │                                                        │
        platformRole = "merchant"                         platformRole = "admin"
              │                                                        │
              ▼                                                        ▼
   ┌────────────────────────────┐                    ┌────────────────────────────┐
   │ src/app/(dashboard)/**     │                    │ src/app/admin/**           │
   │ requireMerchantContext()   │                    │ requireAdminContext()      │
   │  → redirect ladder         │                    │  → notFound() ONLY (D-06)  │
   │  → /suspended  (D-16)      │                    │  gold chrome + banner(D-02)│
   └───────────┬────────────────┘                    └───────────┬────────────────┘
               │                                                 │
               │ merchantAction({mode, schema})                  │ adminAction({schema})
               ▼                                                 ▼
   ┌────────────────────────────┐                    ┌────────────────────────────┐
   │ scopedDb(tenantId)         │                    │ adminDb  (UNSCOPED)        │
   │ tenant predicate injected  │                    │ ESLint-fenced to           │
   │ on every operation         │                    │ src/server/admin/**        │
   └───────────┬────────────────┘                    └───────────┬────────────────┘
               │                                                 │
               └──────────────────┬──────────────────────────────┘
                                  ▼
                    ┌──────────────────────────────┐
                    │  Postgres (Neon)             │
                    │  SupportMessage              │◄── both sides read/write
                    │  SupportAttachment           │
                    │  SubscriptionPaymentClaim    │
                    │  PaymentClaim (Phase 3)      │
                    │  Organization.status ◄───────┼─── ONE sanctioned writer
                    └──────────────────────────────┘

   SIDE EFFECTS (never block the response — always inside after()):
     postSystemMessage()  ──► SupportMessage (author: SYSTEM)   [D-15 + Phases 7-15]
     notifySupportEmail() ──► Resend  ─(degrades to console.warn)─► [D-09]

   ATTACHMENTS (bytes never transit the app):
     browser ──mint──► adminAction/merchantAction ──presigned PUT──► R2
     browser ──PUT bytes────────────────────────────────────────────► R2
     browser ──finalize──► Route Handler ──Sharp derive──► R2 ──prefix──► SupportAttachment
```

### Recommended Project Structure

```text
src/app/admin/                       # literal segment, apex-only via the proxy
├── layout.tsx                       # gold chrome + persistent banner (D-02); NOT the gate
├── page.tsx                         # merchant/store list + domain column (ADM-01/ADM-03/D-21)
├── merchants/[id]/page.tsx          # optional detail; suspend also lives here (UI-SPEC call)
├── claims/page.tsx                  # global order-payment-claims ledger (ADM-02/D-18/D-19)
├── subscriptions/page.tsx           # subscription-payment claims — SEPARATE page (D-20)
├── support/page.tsx                 # flat inbox, unread-first (D-08/D-11)
└── support/[tenantId]/page.tsx      # one merchant's thread, platform side
                                     # NO not-found.tsx — see Discretion Q7

src/server/admin/                    # the ESLint zone; the ONLY importer of adminDb
├── context.ts                       # requireAdminContext() — server-only, React.cache
├── action.ts                        # adminAction() factory — server-only
├── queries.ts                       # cross-tenant reads (merchants, ledger, inbox)
├── suspend.ts                       # THE ONLY writer of Organization.status
└── subscription-claims.ts           # THE ONLY writer of SubscriptionPaymentClaim.status

src/server/support/                  # shared by BOTH surfaces
├── messages.ts                      # postMessage / postSystemMessage / markRead
├── queries.ts                       # thread read + unread counts (merchant side, scopedDb)
├── actions.ts                       # "use server" — merchant-side compose
└── notify.ts                        # Resend nudge, both directions

src/app/(dashboard)/dashboard/support/page.tsx   # D-07's merchant surface
src/app/api/upload/thread-finalize/route.ts      # attachment derive (Node runtime)
src/lib/strings/admin.ts                         # new copy namespace, spread into index
```

**One structural tension the planner must resolve explicitly:** `src/server/support/**` is imported by both zones. The merchant path must use `scopedDb`; the admin path must not import `tenant-scoped.ts` (ESLint). Therefore `src/server/support/**` must **not** be imported from `src/server/admin/**` if it imports `scopedDb` at module scope — the lint rule matches on the import specifier of the *file being linted*, so a transitive import is not caught, but the spirit of TEN-05 is. **Recommended split:** put merchant-side reads/writes in `src/server/support/**` (using `scopedDb`), and put the admin-side reads/writes in `src/server/admin/support.ts` (using `adminDb`). Share only pure helpers (types, the unread predicate as data, copy) through a `src/server/support/shared.ts` that imports no DB client. This mirrors how `claims` and `orders` already split by trust boundary rather than by entity.

### Pattern 1: The parameterless, cached, fail-closed DAL

**What:** `requireAdminContext()` — zero parameters, `React.cache()`, `notFound()` on every failure rung.
**When to use:** at the top of every `src/app/admin/**` page and inside `adminAction`.
**Why:** `src/server/merchant/context.ts:17-29` argues that a `requireXContext(id)` overload "is the precise shape of the bug this module exists to prevent, and it is the shape that arrives innocently: an admin view that wants to 'look at one store'". That sentence names *this exact phase*. The admin surface legitimately looks at one store — but it does so by passing an id to a **query**, never to the identity function.

### Pattern 2: The factory wrapper as the path of least resistance

**What:** `adminAction({ schema, handler })`.
**When:** every mutation on the admin surface.
**Why:** Next has no framework-level pre-action hook, and a Server Action is reachable by direct POST without loading the form. Making the guarded action the easiest one to write is the only structural answer (`merchant/action.ts:18-27`). Identity resolves before the payload is parsed.

### Pattern 3: Derive, never store, every count

**What:** unread badges, pending-claim counts, inbox ordering — all live `count()`/`groupBy` per render.
**When:** D-11's total badge, D-08's per-thread indicator, DASH-02's attention band.
**Why:** `claims/queries.ts:14-33` enumerates the four places a denormalized counter drifts and concludes "a number derived from the rows cannot drift from the rows". The index is what makes it cheap — hence the composite indexes in the Q6 schema.

### Pattern 4: Two narrow doors, one credential each

**What:** separate mint actions and separate finalize routes for merchant-side and admin-side attachments.
**When:** any upload surface with more than one caller type.
**Why:** stated twice in the existing code (`claim-upload.ts:28-41`, `claim-finalize/route.ts:22-35`): widening one route to "a session OR a token" means every later editor must establish which credential is in force on the line they are changing.

### Pattern 5: One sanctioned writer per invariant, with an audit row

**What:** `src/server/admin/suspend.ts` is the only module that writes `Organization.status`; `src/server/admin/subscription-claims.ts` is the only module that writes `SubscriptionPaymentClaim.status`.
**When:** any column whose value encodes an authorization or financial decision.
**Why:** the codebase enforces this for `Order.state` with a source-scanning test (`tests/unit/single-order-state-writer.test.ts`) and for `PaymentClaim.status` in the isolation suite. **Recommendation: add `tests/unit/single-org-status-writer.test.ts` in this phase**, modeled on the existing one. Without it, the second writer arrives in Phase 7 and nothing notices.

The suspend transaction should be one unit: flip `Organization.status`, write the reason somewhere durable, and post the D-15 system message. Since `Organization` has no audit table, the **system message in the thread is the audit record** — which is a genuine benefit of D-15 rather than a side effect, and worth stating in the module header. If the planner wants a stronger trail, an append-only `AdminAuditEvent` model is a reasonable fifth model, but it is not required by any Phase 6 requirement and pushes against ADM-04's pilot-sized scope.

### Pattern 6: Cross-tenant reads without raw SQL

**What:** the admin inbox's "every merchant, with their latest message and unread count, unread-first".
**Constraint:** `$queryRaw`/`$executeRaw` are banned repository-wide by `no-restricted-syntax` in `eslint.config.mjs:68-75`, because raw queries are empirically *not* intercepted by the tenant extension. The ban is unconditional — it applies to the admin zone too, even though the admin zone has no tenant predicate to bypass.
**Recommended shape:** three parallel reads merged in JS.

```ts
const [orgs, latest, unread] = await Promise.all([
  adminDb.organization.findMany({ select: { id: true, name: true, slug: true, status: true } }),
  adminDb.supportMessage.groupBy({ by: ["tenantId"], _max: { createdAt: true } }),
  adminDb.supportMessage.groupBy({
    by: ["tenantId"],
    where: { author: "MERCHANT", readByPlatformAt: null },
    _count: { _all: true },
  }),
]);
// merge + sort: unread desc, then lastMessageAt desc, then name asc
```

At pilot scale (tens of organizations) this is three index-backed scans and a JS sort. It is honest about its own ceiling: state the row cap in a comment the way `REVENUE_WINDOW_ROW_CAP` does in `dashboard/queries.ts:46-53`, rather than pretending it scales.

### Pattern 7: Domain status is derived, not stored (D-21)

There is no `Domain` model, no `customDomain` column, and no DNS state anywhere in the schema. Every store's domain today is exactly `{organization.slug}.{NEXT_PUBLIC_ROOT_DOMAIN}`, and its "status" is a function of `Organization.status` plus the fact that `resolveTenantBySlug` fails closed on anything non-active.

**Recommendation:** render the column as a derived cell — the resolved hostname, plus a state chip driven by `Organization.status`. Put the derivation in one exported function (`domainStatusFor(org)`) rather than inline in the table cell, so Phase 15 replaces one function instead of a JSX expression. Do **not** add a `domainStatus` column to `Organization`; there is no writer for it and it would immediately be a second source of truth.

### Pattern 8: Side effects inside `after()`, never in the transaction

The email nudge and any future webhook run in `after()` (`next/server`), after the response is flushed. `src/server/claims/submit.ts:353` is the precedent. Per the bundled Next 16 docs, `after` is not a request-time API and does not make a route dynamic; it runs within the route's `maxDuration`. `[VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md]`

### Anti-Patterns to Avoid

- **Re-adding the Super Admin link to the dashboard header.** `src/components/dashboard-header-controls.tsx:23-32` says the stub "returns in Phase 6, gated on a real `User.platformRole` check". **D-03 overrides that comment.** The link does not return. Update that comment in this phase's commit so the next reader does not treat its absence as an oversight — CONTEXT.md explicitly asks for this to be recorded as a considered deviation.
- **A "you don't have permission" page, a 403, or a redirect to `/login` from `/admin`.** All three confirm the route exists. D-06 requires the root 404.
- **Building a read-only dashboard mode for suspended merchants.** D-16 forbids it; `/suspended` already exists and `requireMerchantContext:120` already routes there.
- **A combined claims table with a `type` discriminator column.** D-20 forbids it, and Q1 shows the schema forbids it too.
- **`adminDb` imported from a page component.** The ESLint zone is `src/server/admin/**`, not `src/app/admin/**`. Do not widen the fence — that is flagged in STATE.md as the v2.0 milestone's #1 risk (in the `marketplaceDb` context, but the fence is the same fence).
- **A `notificationEmail` column, a `pendingClaimCount` column, a `lastMessageAt` column, or a `domainStatus` column.** Every one of these is a second source of truth the codebase has already rejected by name.
- **Building any of the ~17 deferred admin pages** because the route tree makes them cheap. ADM-04 is a scope requirement, and cheapness is exactly how it gets violated.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Cross-tenant DB access | A new Prisma client, or a `scopedDb(ALL_TENANTS)` escape hatch | `adminDb` (`src/server/db/admin.ts`) | Already built, already lint-fenced, already documented as this phase's first consumer |
| Admin role check | A per-page `if (user.role !== "admin")` | `requireAdminContext()` in one module | A check written 8 times is a check forgotten once |
| Presigned upload / image derive | A second upload path for attachments | `presignUpload` + `processImage` + a new `IMAGE_PRESETS` row | `signableHeaders` on `content-type`+`content-length` was verified empirically against the real bucket; a reimplementation will omit it and fail open |
| Email send + degradation | A new Resend wrapper | The pattern in `src/server/claims/notify.ts` (both failure channels, `console.warn` on missing keys, never rejects) | Already correct, already load-bearing, and the subtle half (the resolved `error` field) is the half a reimplementation misses |
| Reference normalization | A new uppercase/strip helper | `normalizeReference()` (`src/server/claims/reference.ts:52`) | Pure, unit-tested (`tests/unit/claim-reference.test.ts`), no tenant coupling |
| Unread/pending counts | Counter columns + increment/decrement | `count()` / `groupBy` per render on an index | Four drift opportunities vs zero |
| Confirm dialog with required reason | A bespoke modal | `src/app/(dashboard)/dashboard/claims/reject-dialog.tsx` as the model, on `ui/alert-dialog` | D-14 is structurally identical to D-11's rejection reason: min-length, trimmed, disabled-until-valid |
| Currency formatting | A currency library, or manual string building | `formatXaf` / `Intl.NumberFormat("fr-CM", { currency: "XAF" })` | CLAUDE.md mandates it |
| Order state chips in the ledger | New status pills | `src/components/order-state-chip.tsx` | Already carries the gold `PAYMENT_CLAIMED` treatment and is one of the two sanctioned gold spenders |

**Key insight:** every "new" capability in this phase has a shipped analogue two directories away, and each analogue carries a multi-paragraph header explaining a non-obvious control that a fresh implementation will silently omit. The correct instinct in this codebase is always "find the file that already did this and read its header before writing anything".

---

## Common Pitfalls

### Pitfall 1: The gold-budget contract test fails the moment D-02 is implemented

**What goes wrong:** `tests/unit/dashboard-nav.test.ts` scans every `.tsx` under `src/app` and `src/components` for `variant="gold"` and asserts it appears exactly once in `app-sidebar.tsx` and otherwise only in a file matching `/order-state/`. D-02's gold admin chrome breaks this test on the first commit that touches it.
**Why it happens:** the budget was written when gold meant exactly one thing ("a human needs to look at this now") and the admin surface did not exist.
**How to avoid:** extend the test in the same commit that spends the gold — add an explicit allowance for `src/app/admin/**` (or the specific chrome component) with its own expected count. **Do not delete the assertion or add a blanket exemption**; the test's own header argues that "a budget that is only written down is a budget that gets spent". Note also that the scan matches the literal string `variant="gold"` — using `bg-gold-accent/10` utilities directly would slip past it silently, which is worse than an honest failure. Prefer the tracked variant.
**Warning signs:** `npm run test:unit` fails with "the gold accent is spent outside…" naming an admin file.

### Pitfall 2: Adding the Support nav item without updating `REQUIRED_HREFS`

**What goes wrong:** D-07's sidebar item is added to `NAV_GROUPS` but not to `REQUIRED_HREFS` in `tests/unit/dashboard-nav.test.ts` — or vice versa. Either half alone fails the build.
**Why it happens:** the two live in different files, and the test's error message is the only place the pairing is documented.
**How to avoid:** one commit, three edits: the `strings.dashboard.nav.support` label, the `NAV_GROUPS` row (in the "Commerce" or a new group — D-07 says same weight as Orders/Products), and `REQUIRED_HREFS`. The label may land earlier; the other two must land together.
**Warning signs:** "A dashboard destination is not reachable from the navigation rail."

### Pitfall 3: Reusing the merchant claim actions for the admin ledger

**What goes wrong:** the admin ledger's inline confirm (D-19) calls `confirmClaim` from `src/server/claims/actions.ts`, which resolves the tenant from `requireMerchantContext()` — and the platform owner has no organization (D-04), so the call redirects to `/onboarding/create-store`.
**Why it happens:** the two surfaces look like the same action.
**How to avoid:** the admin ledger needs its own confirm/reject in `src/server/admin/**`, using `adminDb`. But note it must still perform the *same* side effects: transition the order, write the `OrderEvent`, release stock on rejection. Those live in `src/server/orders/transition.ts` and `stock.ts`, which take a transaction client as their first parameter — so they are reusable from the admin zone **if** the admin passes an `adminDb.$transaction` client. Verify the parameter types accept it; if `transitionOrder` is typed to `ScopedTx`, the admin path needs either a widened type or its own writer, and a second `Order.state` writer would break `tests/unit/single-order-state-writer.test.ts`.
**This is the single highest-risk integration in the phase.** Budget a spike task for it before the ledger UI is planned.
**Warning signs:** a type error on `transitionOrder(tx, …)` in the admin zone; or a passing build with a duplicated state-transition implementation.

### Pitfall 4: Forgetting the four-file cost of a new tenant-scoped model

**What goes wrong:** the migration lands, the app works, and the isolation suite fails 20 minutes later with "TENANT_SCOPED_MODELS has drifted" or "…is registered in TENANT_SCOPED_MODELS but has no seed data".
**Why it happens:** the isolation suite takes 22-27 minutes (per STATE.md) so it is not run per-task.
**How to avoid:** make the schema task explicitly include all four edits (schema+migration, `REGISTERED_MODELS` in dependency order, `seed-two-tenants.ts` fixture, `tenant-isolation.test.ts` fixture map). Run `npm run test:full` once at the end of the schema wave rather than discovering it at the phase gate.
**Warning signs:** the isolation suite failing on models unrelated to the change (a mis-ordered `REGISTERED_MODELS` breaks the batched seed transaction for *everything after* the misplaced entry).

### Pitfall 5: An admin session landing on `/dashboard`

**What goes wrong:** the platform owner logs in, `login-form.tsx:67` does `router.push("/dashboard")`, `requireMerchantContext()` finds no `activeOrganizationId`, and redirects to `/onboarding/create-store` — walking the platform owner into store creation.
**Why it happens:** the redirect target is hardcoded client-side and the client does not know `platformRole`.
**How to avoid:** change `signInMerchant` to return `{ ok: true, redirectTo }` computed server-side after `signInEmail` succeeds (read the session, branch on `platformRole`), and have the form push that value. Additionally add a rung to `requireMerchantContext` **above** the `!tenantId` rung: if `session.user.platformRole === "admin"`, redirect to `/admin` — belt and braces, and it costs one line. Be careful not to change the function's signature (`tests/unit/no-tenant-id-param.test.ts`).
**Warning signs:** the owner's account acquiring an `Organization` — which then breaks D-04 permanently.

### Pitfall 6: No way to mint the admin account

**What goes wrong:** `platformRole` is `input: false` in the Better Auth config specifically so no signup payload can mint an administrator. There is consequently **no code path anywhere that sets it to `"admin"`** — and this phase does not obviously add one, because adding a public one would defeat the field's purpose.
**Why it happens:** the security property and the bootstrap requirement pull in opposite directions, and the bootstrap is invisible until someone tries to log in as the owner.
**How to avoid:** plan the bootstrap explicitly. Options, best first: (a) a one-off `tsx` script under `scripts/` that takes an email and sets `platformRole = "admin"` through `prismaBase`, run manually against each environment, mirroring `prisma/seed.ts`'s posture; (b) a documented manual SQL `UPDATE` in the README; (c) an env-var-driven promotion at boot (**rejected** — an env var that mints admins is a worse secret than a password). Whichever is chosen, the phase is not verifiable without it — a `checkpoint:human-verify` task confirming the owner can actually reach `/admin` belongs at the end of the first wave, not the last.
**Warning signs:** a plan whose first admin-surface task has no way to be manually tested.

### Pitfall 7: The `after()` callback outliving the request on Vercel

**What goes wrong:** an email nudge scheduled in `after()` from a Server Action is cut off by the function's max duration, or throws unhandled and dirties the invocation.
**How to avoid:** `notify` functions must never reject (the `claims/notify.ts` contract), and any route that both derives an image and sends mail should carry `export const maxDuration` the way `claim-finalize/route.ts:94` does (30s there).
**Warning signs:** `unhandledRejection` in Vercel logs with no user-visible failure.

### Pitfall 8: Sonner toasts do not exist on the admin surface

**What goes wrong:** an admin action calls `toast()` and nothing renders — `<Toaster />` is mounted in `src/app/(dashboard)/layout.tsx:156`, and D-01 keeps the admin surface out of that tree entirely.
**How to avoid:** mount a second `<Toaster />` in `src/app/admin/layout.tsx`. Note the header comment at that mount point warns that two mounts show every toast twice — that risk does not apply here because the two trees never render together, but say so in the new mount's comment so a future reader does not "fix" it.

### Pitfall 9: An `/admin` page that renders before the gate resolves

**What goes wrong:** `requireAdminContext()` is called only in `layout.tsx`, and a client-side navigation between `/admin/claims` and `/admin/support` does not re-run it.
**How to avoid:** every `page.tsx` calls it. This is the same rule already documented for the dashboard, and `React.cache()` makes the duplicate free.

### Pitfall 10: Prose literals in new admin components

**What goes wrong:** `tests/unit/dashboard-nav.test.ts` currently scans only `app-sidebar.tsx` for inline prose, but the convention (CLAUDE.md C-14) is repository-wide and other contract tests scan other trees.
**How to avoid:** author `src/lib/strings/admin.ts` and `strings.support` **before** the components, following the file's own instruction that copy is authored in one pass and later plans only read it. Consider extending the prose scan to `src/app/admin/**` in this phase so the convention is enforced rather than remembered.

---

## Code Examples

### The suspend write — one transaction, one audit trail, one thread message

```ts
// src/server/admin/suspend.ts
import "server-only";

import { adminDb } from "@/server/db/admin";

/**
 * ADM-01 / D-14..D-17 — THE ONLY MODULE IN src/ THAT WRITES Organization.status.
 *
 * Symmetric by construction: one function, one target status, so "suspend" and
 * "un-suspend" cannot drift into two half-matching code paths (D-17). The reason
 * is REQUIRED on the way in and is not stored on the organization row — it is
 * stored where the merchant will actually read it, as a SYSTEM message in their
 * support thread (D-15). That message IS the audit record; Organization has no
 * audit table and this phase deliberately does not add one (ADM-04).
 */
const ACTIVE = "active";
const SUSPENDED = "suspended";

export async function setOrganizationSuspended(input: {
  organizationId: string;
  suspend: boolean;
  reason: string;
  actorUserId: string;
}): Promise<void> {
  const nextStatus = input.suspend ? SUSPENDED : ACTIVE;

  await adminDb.$transaction(async (tx) => {
    // The optimistic guard, inside the transaction: two admin tabs is the
    // normal case, not an attack. Same reasoning as claims/actions.ts.
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
      select: { id: true, status: true },
    });
    if (org.status === nextStatus) return; // already there; write nothing

    await tx.organization.update({
      where: { id: org.id },
      data: { status: nextStatus },
    });

    await tx.supportMessage.create({
      data: {
        tenantId: org.id,
        author: "SYSTEM",
        authorUserId: null,
        body: input.reason, // rendered under a SYSTEM chip, never as the owner
      },
    });
  });

  // NOTE: the tenant hostname cache must be invalidated after a status flip, or
  // a suspended storefront keeps serving from Redis until the TTL expires.
  // See src/server/tenant/cache.ts — invalidateTenantHost(slug).
}
```

> The cache-invalidation line is load-bearing and easy to miss: `src/server/tenant/resolve.ts` caches slug→tenant resolution in Redis and fails closed on anything non-active, but a *stale positive* entry will keep a just-suspended storefront online. The plan must confirm the exact invalidation helper's name and call it. `[ASSUMED — the helper is referenced in STATE.md as `invalidateTenantHost`; verify the export before writing the task]`

### The unread counts — one query shape, two consumers (D-11)

```ts
// merchant side (src/server/support/queries.ts) — tenant-scoped
export async function unreadForMerchant(tenantId: string): Promise<number> {
  return scopedDb(tenantId).supportMessage.count({
    where: { author: { in: ["PLATFORM", "SYSTEM"] }, readByMerchantAt: null },
  });
}

// admin side (src/server/admin/support.ts) — cross-tenant, one query for both
// the total badge and the per-thread indicator (D-11: "both derive from the
// same unread-message query, so building one gets the other nearly free").
export async function unreadByTenant(): Promise<Map<string, number>> {
  const rows = await adminDb.supportMessage.groupBy({
    by: ["tenantId"],
    where: { author: "MERCHANT", readByPlatformAt: null },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.tenantId, r._count._all]));
}
```

### Post-login role routing (D-05)

```ts
// src/server/auth/login.ts — signInMerchant, after signInEmail succeeds
export type SignInMerchantResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: Record<string, string[]> };

// …after the successful auth.api.signInEmail call:
const session = await auth.api.getSession({ headers: requestHeaders });
// D-05: same login page, routed by role. Read server-side — the client cannot
// know platformRole before it navigates, and must not be trusted to decide.
return {
  ok: true,
  redirectTo: session?.user.platformRole === "admin" ? "/admin" : "/dashboard",
};
```

> The form then does `router.push(result.redirectTo)` instead of a hardcoded `"/dashboard"` (`src/app/login/login-form.tsx:67`). Keep the existing `redirecting` state so the button stays in its submitting state across the navigation.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `resend` is a declared-but-unwired dependency | `resend` is wired and in production use at `src/server/claims/notify.ts` | Phase 3 (plan 03-xx, D-13) | **D-09 is the second consumer, not the first.** CLAUDE.md, ROADMAP.md and CONTEXT.md all still say otherwise — all three should be corrected in this phase's commit |
| `middleware.ts` | `src/proxy.ts` (Next 16 rename; `middleware.ts` deprecated) | Next 16 | Any admin-surface routing idea that reaches for middleware is reaching for a deprecated file |
| Prisma `dmmf` runtime introspection | `Prisma.ModelName` + `<Model>ScalarFieldEnum` | Prisma 7 | `dmmf` was removed; the drift test pins its absence |
| `next lint` | ESLint invoked directly (`eslint . --max-warnings=0`) | Next 16 | No framework wrapper picks up `eslint.config.mjs` — CI must run the script |
| Flat `NAV_ITEMS` sidebar | Three-group `NAV_GROUPS` | Quick task `260906-egn` | D-07's Support item joins a group, not a flat list |
| Dashboard Overview empty state | Real metrics + chart + recent orders | Quick task `260906-egn` | Do not rebuild; extend |
| Ungated `/admin` header stub | Removed | Quick task `260907-a2v` | D-03 keeps it removed; update the stale comment |

**Deprecated/outdated in this repo's own docs:**
- CLAUDE.md § Key Dependencies: "`resend` … **not yet wired into any send call** — no other source file under `src/` imports `resend` as of this analysis". **Stale.**
- ROADMAP.md § Phase 6 v2.0 reconciliation note: "`resend` is still unwired — no module under `src/` imports it". **Stale.**
- CONTEXT.md D-09: "this is the first real wiring of `resend` (currently a declared dependency with zero send calls anywhere under `src/`)". **Stale in its parenthetical; the decision itself stands.**
- `src/components/dashboard-header-controls.tsx:30`: "It returns in Phase 6, gated on a real `User.platformRole` check". **Superseded by D-03.**

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `SubscriptionPaymentClaim.referenceNormalized` should be **globally** unique rather than per-tenant | Discretion Q1 | A per-tenant key would let two merchants claim the same platform-side MoMo transaction; a global key leaks a weak existence signal. Either is defensible — needs a one-line user confirmation |
| A2 | Support-thread attachments are restricted to `image/jpeg`, `image/png`, `image/webp` in this phase (no PDF) | Discretion Q5 | Narrows D-10's literal "file/image attachments". If the owner expects to receive PDF receipts, a second, non-re-encoding storage path must be designed — a substantially larger scope |
| A3 | `invalidateTenantHost` (or equivalently named helper) exists in `src/server/tenant/cache.ts` and must be called after a suspend | Code Examples | A stale positive Redis entry keeps a suspended storefront serving until TTL. The helper name was read from STATE.md, not from the source file — verify before writing the task |
| A4 | `transitionOrder` / `releaseStock` accept a transaction client from `adminDb.$transaction` (not narrowly typed to a scoped client) | Pitfall 3 | If they are typed to `ScopedTx`, the admin ledger's inline confirm/reject needs either a type widening or a second `Order.state` writer — the latter breaks a contract test. **Highest-risk unverified assumption in this document** |
| A5 | The platform owner's account is bootstrapped by a one-off script or manual SQL, not by any in-app flow | Pitfall 6 | If the owner expects a UI to promote a user, that is unbuilt scope. If the deployment story forbids manual DB access, option (a) must be a real, committed script |
| A6 | An `AdminAuditEvent` model is out of scope; the D-15 system message serves as the suspend audit record | Pattern 5 | If a real audit trail is expected for every admin action (not just suspends), that is a fifth model plus a writer plus its four-file registration cost |
| A7 | The merchant-side "needs attention" band (low stock, disputed) is in scope for DASH-02 in this phase | DASH Gap Analysis | The success criteria say so explicitly, but STATE.md defers the related revenue-state question to Phase 12 — the low-stock threshold may be intended to arrive with Phase 9 (Inventory) |

---

## Open Questions

1. **What does "activating or extending the merchant's subscription" actually write?**
   - **What we know:** `resolveEntitlements` (`src/server/entitlements/resolve.ts:137`) treats `subscriptionStatus === "active"` as unconditionally subscribed — `canWrite` becomes `true` forever, with no period end anywhere in the schema. `Organization` has `trialEndsAt` but no `subscriptionEndsAt`/`paidThroughAt`.
   - **What's unclear:** whether confirming one month's payment should grant permanent write access (today's behavior if you only flip the status), or whether the phase must add a period-end column and teach the pure resolver to expire it. "Extending" in SUB-03's wording implies the latter.
   - **Recommendation:** add `Organization.subscriptionCurrentPeriodEnd DateTime?` (`input: false`, following every other Better Auth additional field's posture) and have the confirm action set it to `max(now, existing) + 1 month`. Whether `resolveEntitlements` *enforces* the lapse is a separate, larger decision — enforcing it changes `canWrite` semantics for every existing action and touches the well-covered `tests/unit/entitlements.test.ts`. **Recommend: store the period end in Phase 6, display it, and defer enforcement**, with the deferral recorded explicitly. Confirm with the user before planning either way. Note that STATE.md's `KD-V2-02` already flags any change to `resolveEntitlements`'s shape as the milestone's largest hidden cost.

2. **What is "low stock"?**
   - **What we know:** no threshold, no query, and no merchant-facing stock signal exists. `ProductVariant.stock` is an `Int` with no floor column. The only stock language in the product is the storefront's shopper-facing "Only {n} left".
   - **What's unclear:** a global constant (e.g. `LOW_STOCK_THRESHOLD = 5`, in the registry-as-data style of `STARTER_PRODUCT_CAP`) vs. a per-product merchant setting vs. deferring to Phase 9 (Inventory).
   - **Recommendation:** a single exported module-level constant in this phase — it satisfies DASH-02's success criterion at pilot scale, costs one query, and is exactly the shape Phase 9 will later replace with a real setting. Do not add a schema column for it now.

3. **Does the admin ledger's inline confirm reuse `transitionOrder`?** (Assumption A4.)
   - **Recommendation:** resolve this with a 15-minute spike before the ledger wave is planned. Read the exact parameter type of `transitionOrder` and `releaseStock`. If they are `ScopedTx`-typed, the cheapest correct fix is widening the parameter to the structural minimum those functions actually use — **not** duplicating the writer.

4. **Does the admin surface need its own rate limiting?**
   - **What we know:** `src/server/rate-limit.ts` has eight named limiters, all for anonymous or pre-auth surfaces. Every admin action is behind a session with `platformRole === "admin"`.
   - **Recommendation:** no new limiter. The surface has exactly one legitimate user and the login path is already throttled by `loginLimiter`. State the omission in the module header rather than leaving it unexplained.

5. **Where does SUB-03's merchant-side submit form live?**
   - CONTEXT.md says the claim runs "through" the thread (ADM-05's channel), but does not say whether the submit form is *in* the thread view or on `/dashboard/plan` with a system message posted into the thread as the receipt.
   - **Recommendation:** the form on `/dashboard/plan` (where a merchant goes to think about paying — and where `260831-vd2` already left a read-only expired-trial branch with the payment redirect explicitly "deferred to Phase 6"), with a `SYSTEM`-authored message posted into the thread carrying `subscriptionClaimId`. This satisfies "through the thread" for the review/decision half — which is where D-20's admin page acts — without putting a payment form inside a chat transcript. **Flag to UI-SPEC as a decision, not a fact.**

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js 24 LTS | Everything | ✓ (project prerequisite) | v24.x per README | — |
| Neon Postgres (`DATABASE_URL` + `DIRECT_URL`) | New models, migration | ✓ | — | none — hard requirement |
| Neon test branch (`TEST_DATABASE_URL`) | Isolation suite for the 3 new models | ✓ (`.env.test` present) | — | none — `global-setup.ts` fails closed |
| Cloudflare R2 (5 vars, all required) | Attachment upload | ✓ (required in every env incl. local) | — | none by design |
| Upstash Redis | Tenant hostname cache invalidation after suspend | Optional | — | Degrades loudly to direct DB read; suspend still correct, just cached-stale until TTL locally |
| Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`) | D-09 email nudge | Optional | resend 6.22.0 installed | `console.warn` + in-app badge remains the reliable channel — established pattern |
| Vitest + `dotenv-cli` | Both test projects | ✓ | 4.1.10 / 11.0.0 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Upstash and Resend, both already handled by the codebase's "degrade loudly, never silently" convention. Neither blocks any Phase 6 capability.

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 4.1.10, two projects declared in `vitest.config.ts` |
| Config file | `vitest.config.ts` (project `unit`: `tests/unit/**`, `server-only` aliased to a stub; project `isolation`: `tests/isolation/**`, real DB via `TEST_DATABASE_URL`) |
| Quick run command | `npm run test:unit` |
| Full suite command | `npm run test:full` (`dotenv -e .env.test -- vitest run`) |
| Other gates | `npm run lint` (`--max-warnings=0`), `npm run typecheck` |

**Runtime warning:** STATE.md records the isolation suite at **22-27 minutes**, and this phase registers **three** new tenant-scoped models (each generating ~9 generic isolation assertions). Expect the full gate to grow. Per-task gates must use `test:unit` + `lint` + `typecheck`; `test:full` belongs at wave merges and the phase gate only.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| ADM-01 | A non-admin session hitting `/admin` gets the root 404, not a redirect or 403 (D-06) | isolation | `vitest run tests/isolation/admin-access.test.ts` | ❌ Wave 0 |
| ADM-01 | `Organization.status` has exactly one writer in `src/` | unit (source scan) | `vitest run tests/unit/single-org-status-writer.test.ts` | ❌ Wave 0 |
| ADM-01 | Suspending a tenant makes its storefront resolve to not-found and its owner's dashboard to `/suspended` | isolation | `vitest run tests/isolation/suspension.test.ts` | ❌ Wave 0 |
| ADM-02 | The admin ledger reads across tenants; the merchant queue still cannot | isolation | extend `tests/isolation/claims.test.ts` | ✅ exists — extend |
| ADM-03 | Domain status derives from `Organization.slug` + `status` (pure) | unit | `vitest run tests/unit/domain-status.test.ts` | ❌ Wave 0 |
| ADM-05 | `SupportMessage`/`SupportAttachment` are tenant-isolated | isolation (generic) | `vitest run tests/isolation/tenant-isolation.test.ts` | ✅ auto-generated once registered |
| ADM-05 | Unread counts derive from rows (no counter column exists) | unit (schema scan) | fold into `tests/unit/…-writer` scan or a new contract test | ❌ Wave 0 |
| ADM-05 | The Support nav item is reachable and the gold budget is respected | unit | `vitest run tests/unit/dashboard-nav.test.ts` | ✅ exists — **must be extended** |
| ADM-05 | Email nudge degrades loudly when Resend is unconfigured | unit | `vitest run tests/unit/support-notify.test.ts` (spy on `console.warn`, per the `cart`/`tracking-token` precedent) | ❌ Wave 0 |
| SUB-03 | A duplicate normalized reference is refused | isolation | `vitest run tests/isolation/subscription-claims.test.ts` | ❌ Wave 0 |
| SUB-03 | Confirming a subscription claim is idempotent under a double-tap (optimistic lock) | isolation | same file | ❌ Wave 0 |
| DASH-01/02 | The attention band's queries return correct counts for pending claims / low stock / disputed | isolation | `vitest run tests/isolation/dashboard-attention.test.ts` | ❌ Wave 0 |
| DASH-02 | Low-stock threshold is a single exported constant (no scattered literals) | unit | fold into the attention-band test | ❌ Wave 0 |
| All | Admin identity function takes no parameters | unit (source scan) | extend `tests/unit/no-tenant-id-param.test.ts` to cover `src/server/admin/**` | ✅ exists — extend |

### Sampling Rate

- **Per task commit:** `npm run lint && npm run typecheck && npm run test:unit`
- **Per wave merge:** `npm run test:full`
- **Phase gate:** full suite green before `/gsd:verify-work`, plus the `checkpoint:human-verify` for the admin-account bootstrap (Pitfall 6) and the live admin/merchant thread round trip.

### Wave 0 Gaps

- [ ] `tests/isolation/admin-access.test.ts` — covers ADM-01/D-06 (anonymous, merchant, and admin sessions against `/admin`)
- [ ] `tests/unit/single-org-status-writer.test.ts` — covers ADM-01/D-17 (modeled on `single-order-state-writer.test.ts`)
- [ ] `tests/isolation/suspension.test.ts` — covers ADM-01/D-15/D-16 end to end
- [ ] `tests/isolation/subscription-claims.test.ts` — covers SUB-03
- [ ] `tests/isolation/dashboard-attention.test.ts` — covers DASH-02
- [ ] `tests/unit/domain-status.test.ts` — covers ADM-03/D-21
- [ ] `tests/unit/support-notify.test.ts` — covers ADM-05/D-09 degradation
- [ ] **Extensions to existing tests (not new files, but blocking):** `dashboard-nav.test.ts` (gold budget + `REQUIRED_HREFS`), `no-tenant-id-param.test.ts` (admin zone), `seed-two-tenants.ts` + `tenant-isolation.test.ts` (three new models)
- [ ] No framework install needed — Vitest and both projects are configured

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | Better Auth email/password, unchanged. `loginLimiter` already throttles by IP before parsing. No second login page (D-05) means no second auth surface to harden |
| V3 Session Management | yes | Host-only session cookie (no `Domain` attribute) — `src/server/auth/auth.ts:103-119` explains why widening it would expose the platform session to every merchant-controlled storefront. **The admin session rides the same cookie**, which makes that decision load-bearing for the highest-privilege account on the platform. Do not touch it |
| V4 Access Control | **yes — the phase's core risk** | `requireAdminContext()` as the single decision point; `notFound()` (never 403/redirect) so the surface is not enumerable; `adminDb` ESLint-fenced to one directory; every page gates itself rather than trusting the layout |
| V5 Input Validation | yes | Zod on every action. Notable fields: the suspend reason (trim → min → max, as `rejectSchema` does), the message body (max length; empty allowed only with an attachment), the subscription reference (normalized, length-bounded) |
| V6 Cryptography | no new use | No new crypto. Upload ids stay `crypto.randomUUID()`; nothing here hashes or signs |
| V7 Error Handling & Logging | yes | Errors carry codes, never keys or presigned URLs (`claim-finalize/route.ts:79-85`). Admin failures must be indistinguishable from a missing route |
| V12 File Upload | yes | Content-type allowlist checked before signing; `content-type` + `content-length` in `signableHeaders`; server-generated keys only; Sharp re-encode so served bytes are never uploaded bytes; `publicUrlFor` throws on `/original` |
| V13 API / Server Actions | yes | Every Server Action is a public endpoint reachable by direct POST — the schema is the trust boundary, and the identity resolves before the payload is parsed |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Privilege escalation via a forged `platformRole` in a signup/update payload | Elevation of Privilege | `input: false` on the Better Auth additional field — already in place. **Do not add a write path.** The bootstrap must be out-of-band (Pitfall 6) |
| Admin surface enumeration (probing `/admin` to confirm it exists) | Information Disclosure | `notFound()` on every failure rung; no local `not-found.tsx`; no link anywhere (D-03) |
| Cross-tenant data leak through an unscoped admin query reused on the merchant path | Information Disclosure | Bidirectional ESLint fence: admin cannot import `tenant-scoped`, and nothing outside `src/server/admin/**` can import `adminDb` |
| A second `Order.state` / `PaymentClaim.status` / `Organization.status` writer | Tampering | Source-scanning contract tests, one per invariant. Two exist; this phase must add the third |
| Double-review race (two admin tabs confirming the same claim) | Tampering | Status guard **inside** the transaction as an optimistic lock — the exact pattern at `claims/actions.ts:155-157` |
| Presigned-URL abuse (write anything to the bucket) | Tampering | `signableHeaders: ["content-type","content-length"]`, 5-minute expiry, server-composed key. Empirically verified against the real bucket |
| Publicly readable attachment containing PII (a receipt with a phone number) | Information Disclosure | Capability URL with a v4 UUID; existing precedent for claim screenshots. **Record the acceptance explicitly** rather than rediscovering it |
| Enumeration oracle from a globally-unique subscription reference (`P2002`) | Information Disclosure | One generic refusal message that never names the other tenant (Assumption A1) |
| Email as an exfiltration channel (payment references in plaintext mail) | Information Disclosure | The established rule: the nudge says a claim arrived; it never quotes the reference (`claims/notify.ts:47-58`) |
| Suspension not taking effect due to a stale Redis positive | Tampering / Availability | Invalidate the tenant hostname cache in the same code path as the status flip (Assumption A3) |

---

## Sources

### Primary (HIGH confidence — read directly in this session)

- `prisma/schema.prisma` — `User.platformRole` (27-49), `Organization` (101-174), `PaymentClaim` (519-553), enums (274-312), `MerchantPaymentSettings` (555-587)
- `src/server/merchant/action.ts`, `src/server/merchant/context.ts` — the factory and DAL patterns the admin equivalents mirror
- `src/server/db/admin.ts`, `src/server/db/platform.ts`, `src/server/db/tenant-scoped.ts` — the three-client split and `REGISTERED_MODELS`
- `eslint.config.mjs` — import zones (42-111), raw-query ban (68-75)
- `src/server/claims/actions.ts`, `queries.ts`, `notify.ts`, `reference.ts` — the claim pattern, the derived-count doctrine, and the **already-wired Resend integration**
- `src/server/dashboard/queries.ts`, `src/app/(dashboard)/dashboard/page.tsx`, `overview-metrics.tsx`, `src/app/(dashboard)/layout.tsx` — the DASH gap analysis
- `src/server/images/pipeline.ts`, `r2.ts`, `claim-upload.ts`, `src/app/api/upload/claim-finalize/route.ts` — the upload triad
- `src/proxy.ts`, `src/server/tenant/reserved-slugs.ts` — apex routing, `admin` reserved
- `src/server/auth/auth.ts` (40-170), `src/server/auth/login.ts`, `src/app/login/login-form.tsx` — auth config and post-login routing
- `src/server/entitlements/resolve.ts` — subscription semantics
- `src/app/not-found.tsx`, `src/app/suspended/page.tsx` — the two failure surfaces D-06/D-16 reuse
- `tests/unit/dashboard-nav.test.ts`, `tests/unit/surface-token-isolation.test.ts`, `tests/isolation/model-registry-drift.test.ts`, `tests/isolation/tenant-isolation.test.ts`, `tests/setup/seed-two-tenants.ts`, `vitest.config.ts` — the contract-test obligations
- `node_modules/better-auth/dist/db/schema.mjs:6-26` — `getFields`/`parseUserOutput` merge `additionalFields` into the output schema (proves `session.user.platformRole` is populated)
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md` and `.../after.md` — Next 16.3.1's own bundled reference
- `.planning/REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `06-CONTEXT.md`, `config.json`
- `.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md` — token values, `AdminShell` inventory, canonical-source flag

### Secondary (MEDIUM confidence)

- `CLAUDE.md` — accurate on conventions and constraints; **stale** on the Resend claim (corrected above)
- STATE.md's `invalidateTenantHost` reference — named there, not verified in source this session

### Tertiary (LOW confidence)

- None. No web search was required or performed: every question this phase raises is answered by the repository itself, and external sources would have been less current than the installed packages.

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — zero new packages; every dependency verified present in `package.json` and in use
- Architecture (admin zone, routing, proxy, 404 semantics): **HIGH** — each claim read from the file that implements it, including the installed Next 16 and better-auth sources
- Schema recommendations: **HIGH** on shape and registration cost; **MEDIUM** on the subscription-period question (Open Question 1) and the global-unique reference (Assumption A1)
- Pitfalls: **HIGH** — nine of ten are contract tests or documented invariants read directly; Pitfall 3's severity depends on Assumption A4, which is unverified
- DASH gap analysis: **HIGH** — line-by-line against the shipped Overview
- Validation architecture: **HIGH** on framework and commands; **MEDIUM** on isolation-suite runtime growth (extrapolated from STATE.md's measurement)

**Research date:** 2026-09-13
**Valid until:** 2026-10-13 for the ecosystem claims (nothing fast-moving is involved); **valid only until the next commit** for the codebase claims — this document cites line numbers, and this repo edits its own headers frequently. Re-verify any line reference before quoting it in a task.
