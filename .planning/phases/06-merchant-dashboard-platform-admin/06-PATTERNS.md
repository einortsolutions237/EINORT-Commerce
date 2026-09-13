# Phase 6: Merchant Dashboard & Platform Admin - Pattern Map

**Mapped:** 2026-09-13
**Files analyzed:** 64 new/modified files
**Analogs found:** 58 / 64 (exact: 31 · role-match: 27 · none: 6)

> **How to read this document.** Every excerpt below is verbatim from the file and line range named above it. Line numbers were read on 2026-09-13; 06-RESEARCH.md's own warning applies — re-verify a line reference before quoting it in a task, but the *file* assignments are stable.
>
> **The rule this codebase enforces harder than any other:** every analog carries a multi-paragraph "why" header explaining a non-obvious control. Read the analog's header before writing the new file. A fresh implementation silently omits the control; a copy does not.

---

## File Classification

### A. Schema & registry (modify)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `prisma/schema.prisma` (+`SupportMessage`, `SupportAttachment`, `SubscriptionPaymentClaim`, `SupportAuthor`, `Organization.subscriptionCurrentPeriodEnd`) | model | CRUD | `prisma/schema.prisma` § `PaymentClaim` (519-553) + `ProductImage` | exact |
| `prisma/migrations/<ts>_phase6_support_and_subscription_claims/migration.sql` | migration | batch | existing `prisma/migrations/**/migration.sql` | exact |
| `src/server/db/tenant-scoped.ts` (`REGISTERED_MODELS`) | config | — | itself (append in FK dependency order) | exact |
| `src/server/db/enums.ts` (`SupportAuthor` re-export) | config | — | itself (`ClaimStatus`, `OrderState` precedent) | exact |
| `tests/setup/seed-two-tenants.ts` (3 fixtures) | test | batch | itself | exact |
| `tests/isolation/tenant-isolation.test.ts` (3 fixture-map entries) | test | batch | itself | exact |

### B. Admin server zone — `src/server/admin/**` (all new)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/server/admin/context.ts` | middleware (DAL) | request-response | `src/server/merchant/context.ts` | exact |
| `src/server/admin/action.ts` | middleware (factory) | request-response | `src/server/merchant/action.ts` | exact |
| `src/server/admin/queries.ts` (merchant list, ledgers) | service (read) | CRUD | `src/server/claims/queries.ts` + `src/server/dashboard/queries.ts` | role-match |
| `src/server/admin/support.ts` (cross-tenant inbox, unread) | service (read) | CRUD | `src/server/claims/queries.ts` (`pendingClaimCount`) | role-match |
| `src/server/admin/suspend.ts` (**only** `Organization.status` writer) | service (write) | event-driven | `src/server/orders/transition.ts` (single-writer + audit row) | role-match |
| `src/server/admin/subscription-claims.ts` (**only** `SubscriptionPaymentClaim.status` writer) | service (write) | CRUD | `src/server/claims/actions.ts` (optimistic lock in transaction) | exact |
| `src/server/admin/claims.ts` (admin-side order-claim confirm/reject) | service (write) | CRUD | `src/server/claims/actions.ts` — **see Risk R-1, cannot be reused directly** | exact |
| `src/server/admin/domain.ts` (`domainStatusFor`) | utility (pure) | transform | `src/server/orders/state-machine.ts` (pure, unit-testable, registry-as-data) | role-match |
| `src/server/admin/actions.ts` (`"use server"` entry points) | controller | request-response | `src/server/claims/actions.ts` | exact |

### C. Support domain — `src/server/support/**` (all new)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/server/support/queries.ts` (thread read, merchant unread) | service (read) | CRUD | `src/server/claims/queries.ts` | exact |
| `src/server/support/messages.ts` (`postMessage`/`postSystemMessage`) | service (write) | event-driven | `src/server/orders/transition.ts` | role-match |
| `src/server/support/actions.ts` (merchant compose) | controller | request-response | `src/server/claims/actions.ts` | exact |
| `src/server/support/notify.ts` (Resend nudge, both directions) | service | event-driven | `src/server/claims/notify.ts` | **exact — copy near-verbatim** |
| `src/server/support/shared.ts` (pure types/predicates, no DB client) | utility | transform | `src/server/orders/state-machine.ts` | role-match |

### D. Upload pipeline (2 new, 2 modified)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/server/images/thread-upload.ts` (mint, ×2 doors) | controller | file-I/O | `src/server/images/claim-upload.ts` | exact |
| `src/app/api/upload/thread-finalize/route.ts` | route handler | file-I/O | `src/app/api/upload/claim-finalize/route.ts` | exact |
| `src/server/images/r2.ts` (`UploadKind` += `"threads"`) | config | — | itself (line 87) | exact |
| `src/server/images/pipeline.ts` (`IMAGE_PRESETS` += `thread`) | config | — | itself (`claim` row, lines 74-82) | exact |

### E. Admin route tree — `src/app/admin/**` (all new)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/app/admin/layout.tsx` | layout | request-response | `src/app/(dashboard)/layout.tsx` | exact |
| `src/app/admin/page.tsx` (merchants + domain column) | page (RSC) | CRUD | `src/app/(dashboard)/dashboard/claims/page.tsx` | exact |
| `src/app/admin/loading.tsx` | page | — | `src/app/(dashboard)/dashboard/claims/loading.tsx` | exact |
| `src/app/admin/merchants/[id]/page.tsx` | page (RSC) | CRUD | `src/app/(dashboard)/dashboard/claims/page.tsx` | role-match |
| `src/app/admin/claims/page.tsx` | page (RSC) | CRUD | `src/app/(dashboard)/dashboard/claims/page.tsx` | **exact** |
| `src/app/admin/claims/ledger-row.tsx` (client island) | component | request-response | `src/app/(dashboard)/dashboard/claims/claim-card.tsx` | exact |
| `src/app/admin/subscriptions/page.tsx` + row island | page + component | CRUD | same two files above | exact |
| `src/app/admin/support/page.tsx` (inbox) | page (RSC) | CRUD | `src/app/(dashboard)/dashboard/claims/page.tsx` | role-match |
| `src/app/admin/support/[tenantId]/page.tsx` | page (RSC) | CRUD | same | role-match |
| *(no `src/app/admin/not-found.tsx` — D-06 forbids it)* | — | — | — | n/a |

### F. Merchant surface (modify + new)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/app/(dashboard)/dashboard/support/page.tsx` + `loading.tsx` | page (RSC) | streaming-ish (append-only log) | `src/app/(dashboard)/dashboard/claims/page.tsx` | role-match |
| `src/app/(dashboard)/dashboard/page.tsx` (attention band + 5th card) | page (RSC) | CRUD | itself — **extend, do not rebuild** | exact |
| `src/app/(dashboard)/dashboard/overview-metrics.tsx` (5th card) | component | — | itself | exact |
| `src/app/(dashboard)/dashboard/plan/page.tsx` + submit dialog | page + component | CRUD | `.../claims/reject-dialog.tsx` (dialog) + `claim-card.tsx` (upload affordance) | role-match |
| `src/app/(dashboard)/layout.tsx` (pass `unreadSupport`) | layout | — | itself (line 86, `pendingClaimCount`) | exact |
| `src/components/app-sidebar.tsx` (Support nav item) | component | — | itself (`NAV_GROUPS`, lines 115-178) | exact |
| `src/server/dashboard/queries.ts` (attention-band counts, `activeProductCount`) | service (read) | CRUD | itself (`overviewMetrics`) | exact |

### G. New project components

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/components/admin/admin-sidebar.tsx` | component | — | `src/components/app-sidebar.tsx` | exact |
| `src/components/admin/admin-banner.tsx` | component | — | `src/app/(dashboard)/trial-banner.tsx` (persistent strip precedent) | role-match |
| `src/components/admin/domain-cell.tsx` | component | — | `src/components/order-state-chip.tsx` (chip registry) | role-match |
| `src/components/subscription-claim-chip.tsx` | component | — | `src/components/order-state-chip.tsx` | **exact** |
| `src/components/subscription-claim-card.tsx` | component | — | `src/app/(dashboard)/dashboard/claims/claim-card.tsx` | role-match |
| `src/components/support/message-list.tsx` · `message-bubble.tsx` · `attachment-grid.tsx` | component | — | *no analog* — see § No Analog Found | none |
| `src/components/support/composer.tsx` | component | request-response | `.../claims/reject-dialog.tsx` (controlled textarea + counter + pending + inline error) | role-match |
| `src/components/dashboard/attention-band.tsx` | component | — | `src/app/(dashboard)/dashboard/overview-metrics.tsx` + `src/components/dashboard-card.tsx` | role-match |

### H. Copy, auth, bootstrap, tests

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/lib/strings/admin.ts` | config (copy) | — | `src/lib/strings/marketing.ts` | exact |
| `src/lib/strings/support.ts` | config (copy) | — | `src/lib/strings/marketing.ts` | exact |
| `src/lib/strings/index.ts` (spread + new keys) | config | — | itself (lines 30-43, 1419) | exact |
| `src/server/auth/login.ts` (return `redirectTo`) | controller | request-response | itself | exact |
| `src/app/login/login-form.tsx` (`router.push(result.redirectTo)`) | component | request-response | itself | exact |
| `src/server/merchant/context.ts` (admin rung above `!tenantId`) | middleware | — | itself (lines 98-126, the redirect ladder) | exact |
| `src/components/dashboard-header-controls.tsx` (update stale comment) | component | — | itself | exact |
| `scripts/promote-admin.ts` | script | batch | `prisma/seed.ts` / `tests/setup/seed-two-tenants.ts` CLI posture | role-match |
| `tests/unit/single-org-status-writer.test.ts` | test (source scan) | — | `tests/unit/single-order-state-writer.test.ts` | **exact** |
| `tests/unit/domain-status.test.ts` | test | — | `tests/unit/state-machine.test.ts` | role-match |
| `tests/unit/support-notify.test.ts` | test | — | `tests/unit/cart.test.ts` (`vi.spyOn(console, "warn")`) | role-match |
| `tests/unit/dashboard-nav.test.ts` (gold allow-table + `REQUIRED_HREFS`) | test | — | itself | exact |
| `tests/unit/no-tenant-id-param.test.ts` (add `src/server/admin/**`) | test | — | itself | exact |
| `tests/isolation/admin-access.test.ts` · `suspension.test.ts` · `subscription-claims.test.ts` · `dashboard-attention.test.ts` | test | — | `tests/isolation/claims.test.ts` | role-match |

---

## Pattern Assignments

### 1. `src/server/admin/context.ts` (middleware/DAL, request-response)

**Analog:** `src/server/merchant/context.ts` (163 lines — read the whole header)

**Imports pattern** (lines 1-12) — note `server-only` first, `cache` from react, and that no DB client is imported until needed:

```ts
import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/server/auth/auth";
import { platformDb } from "@/server/db/platform";
```

**Auth-ladder pattern** (lines 92-120) — the shape to mirror, swapping every `redirect(...)` for `notFound()` per D-06:

```ts
export const requireMerchantContext = cache(
  async (): Promise<MerchantContext> => {
    // The signed cookie, decoded by Better Auth. Never hand-parsed...
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");

    const tenantId = session.session.activeOrganizationId;
    if (!tenantId) redirect("/onboarding/create-store");

    const org = await platformDb.organization.findUnique({
      where: { id: tenantId },
      select: MERCHANT_COLUMNS,
    });

    if (!org) redirect("/login");
    if (org.status !== ACTIVE_STATUS) redirect("/suspended");
```

**Allowlist-constant pattern** (lines 88-90) — copy this idiom for `ADMIN_ROLE`:

```ts
/** The only status that may reach the dashboard. Allowlisted, so a status a
 * future migration adds fails closed rather than serving by omission. */
const ACTIVE_STATUS = "active";
```

**Header contract to restate in the new file** (lines 17-29) — this paragraph names Phase 6 by description; the new module must say why it is not the bug it describes:

> `A requireMerchantContext(tenantId) overload is the precise shape of the bug this module exists to prevent, and it is the shape that arrives innocently: an admin view that wants to "look at one store"...`

**Non-negotiable:** `requireAdminContext()` takes no parameters. The admin surface looks at one store by passing an id to a **query**, never to the identity function. Extend `tests/unit/no-tenant-id-param.test.ts` to scan `src/server/admin/**` in the same commit.

---

### 2. `src/server/admin/action.ts` (middleware/factory, request-response)

**Analog:** `src/server/merchant/action.ts`

**Imports + result type** (lines 1-10, 62-64):

```ts
import "server-only";

import { z } from "zod";
```

```ts
export type ActionResult<T = void> =
  | ({ ok: true } & T)
  | { ok: false; error: Record<string, string[]> };
```

**Core factory pattern** (lines 66-101) — identity resolves *before* the payload is touched:

```ts
export function merchantAction<S extends z.ZodType, R>(config: {
  mode: "read" | "write";
  schema: S;
  handler: (ctx: MerchantContext, input: z.infer<S>) => Promise<ActionResult<R>>;
}) {
  return async (raw: unknown): Promise<ActionResult<R>> => {
    // Identity and entitlements first, before anything looks at the payload.
    const ctx = await requireMerchantContext();

    if (config.mode === "write" && !ctx.canWrite) {
      return { ok: false, error: { form: [strings.trial.readOnlyBlocked] } };
    }

    const parsed = config.schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: z.flattenError(parsed.error).fieldErrors as Record<
          string,
          string[]
        >,
      };
    }
```

**Error-conversion pattern** (lines 115-125) — the admin version drops `EntitlementError`/`ReadOnlyError` (unreachable) but keeps the "rethrow everything else" discipline:

```ts
    try {
      return await config.handler(ctx, parsed.data as z.infer<S>);
    } catch (error) {
      if (error instanceof ReadOnlyError || error instanceof EntitlementError) {
        return { ok: false, error: { form: [error.message] } };
      }
      throw error;
    }
```

**Three deliberate differences for `adminAction`:** no `mode` axis · no entitlement conversion · `notFound()` not `redirect()`. Import `ActionResult` as a **type-only** import from `@/server/merchant/action` — erased at build time, so no runtime coupling between zones.

---

### 3. `src/server/admin/subscription-claims.ts` and `src/server/admin/claims.ts` (service/write, CRUD)

**Analog:** `src/server/claims/actions.ts` (366 lines)

**Single-writer header pattern** (lines 24-33) — the new modules need the equivalent paragraph naming their own scanning test:

```ts
/**
 * ---------------------------------------------------------------------------
 * THE ONLY PLACE IN `src/` THAT WRITES `PaymentClaim.status`. THIS IS TESTED.
 * ---------------------------------------------------------------------------
 * `tests/isolation/claims.test.ts` scans the source tree and fails if any other
 * module sets a claim's status to `CONFIRMED`. That guard is the structural half
 * of ORD-02: the requirement is not "we do not auto-confirm payments", it is
 * "there is nowhere an auto-confirmation could be written".
 */
```

**Optimistic-lock pattern — the core thing to copy** (lines 148-174):

```ts
    try {
      await scopedDb(ctx.tenantId).$transaction(async (tx) => {
        const claim = await tx.paymentClaim.findUniqueOrThrow({
          where: { id: claimId },
          select: { id: true, orderId: true, status: true },
        });

        // THE OPTIMISTIC LOCK. Inside the transaction, before anything is
        // written. See the file header.
        if (claim.status !== "PENDING") throw new AlreadyReviewedError();

        await tx.paymentClaim.update({
          where: { id: claim.id },
          data: {
            status: "CONFIRMED",
            reviewedAt: new Date(),
            reviewedByUserId: ctx.userId,
          },
        });
```

**Zod reason-schema pattern** (lines 85-88) — reuse verbatim shape for D-14's suspend reason (widen to `.min(10).max(280)` per UI-SPEC) and for C4's reject reason:

```ts
const rejectSchema = z.object({
  claimId: z.string().min(1),
  reason: z.string().trim().min(3).max(200),
});
```

`.trim()` runs **before** the length check — three spaces is a two-character reason and is refused.

**Error-refusal pattern** (lines 107-124) — `refusalOrRethrow`; convert the routine races, rethrow everything else:

```ts
function refusalOrRethrow(
  error: unknown,
  outOfStockCopy?: string,
): ActionResult {
  if (error instanceof AlreadyReviewedError) {
    return { ok: false, error: { form: [strings.claims.alreadyReviewed] } };
  }
  if (error instanceof InvalidTransitionError) {
    return { ok: false, error: { form: [strings.orders.staleAction] } };
  }
  ...
  throw error;
}
```

Reuse `AlreadyReviewedError` from `src/server/orders/errors.ts`, `normalizeReference()` from `src/server/claims/reference.ts:52`, and `ClaimStatus`/`PaymentOperator` from `src/server/db/enums.ts`.

> ⚠️ **`src/server/admin/claims.ts` cannot call `confirmClaim`/`rejectClaim`.** See § Risks, R-1 — verified this session.

---

### 4. `src/server/admin/suspend.ts` (service/write, event-driven)

**Analog for the single-writer discipline:** `src/server/orders/transition.ts` — a write paired with an audit row, in one transaction.
**Analog for the "already there → write nothing" guard:** `src/server/claims/actions.ts:155-157` (above).

**Cache-invalidation dependency — VERIFIED this session:**

`src/server/tenant/cache.ts:273`

```ts
export async function invalidateTenantHost(...slugs: string[]): Promise<void>
```

Research Assumption A3 is **confirmed**. The suspend/restore path must call `invalidateTenantHost(org.slug)` after the status flip, or a stale positive Redis entry keeps a suspended storefront serving until TTL.

**Test analog:** `tests/unit/single-order-state-writer.test.ts` (220 lines) — clone the whole structure for `tests/unit/single-org-status-writer.test.ts`. The three tests, in order, are the pattern:

```ts
/** The one module allowed to write `Order.state`. */
const SANCTIONED_WRITER = "src/server/orders/transition.ts";

/** Order delegate operations that can persist a column value. */
const WRITE_OPS = ["update", "updateMany", "create", "createMany", "upsert"];

const WRITE_CALL = new RegExp(
  `\\.order\\.(?:${WRITE_OPS.join("|")})\\s*\\(`,
  "g",
);
```

```ts
describe("single Order.state writer", () => {
  it("actually scanned the source tree", () => { /* anti-vacuous guard */ });
  it("still detects a state write in the sanctioned writer", () => { /* positive control */ });
  it("has no second writer of Order.state anywhere in src/", () => { /* the real test */ });
});
```

**Do not omit `stripCommentLines`** (lines 102-109) — without it the guard is self-invalidating, because the new module's own header will quote the pattern it forbids.

---

### 5. `src/server/support/notify.ts` (service, event-driven)

**Analog:** `src/server/claims/notify.ts` — **copy this near-verbatim.** Research's correction stands: Resend is already wired; this is the second consumer, not the first.

**Imports** (lines 1-8):

```ts
import "server-only";

import { Resend } from "resend";

import { env } from "@/env";
import { strings } from "@/lib/strings";
import { platformDb } from "@/server/db/platform";
import { formatXaf } from "@/server/payments/whatsapp";
```

**Degradation pattern** (lines 103-115) — match the register: name the surface, name the missing keys, name the reliable channel, say what it means in production:

```ts
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn(
      "[claims] DEGRADED: no payment-claim email was sent. Missing " +
        "RESEND_API_KEY and/or RESEND_FROM_EMAIL. The merchant's in-app claims " +
        "badge is unaffected and remains the reliable channel (D-13). " +
        "Acceptable in local development and in tests; in production it means " +
        "merchants are not being nudged.",
    );
    return;
  }
```

**Recipient resolution — no new column** (lines 84-93). For the merchant direction copy verbatim; for the platform direction use `platformDb.user.findFirst({ where: { platformRole: "admin" }, select: { email: true } })`:

```ts
async function ownerEmailFor(tenantId: string): Promise<string | null> {
  const owner = await platformDb.member.findFirst({
    where: { organizationId: tenantId, role: "owner" },
    select: { user: { select: { email: true } } },
  });

  const email = owner?.user.email ?? null;
  return email && email.length > 0 ? email : null;
}
```

**Both failure channels** (lines 136-165) — the half a reimplementation always misses is the *resolved* `error` field:

```ts
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject,
      html: `<p>${copy.heading}</p><p>${body}</p>`,
      text: `${copy.heading}\n\n${body}`,
    });

    // The RESOLVED failure channel. See the header — checking only the
    // rejection would let an unverified sending domain read as a success.
    if (error) {
      console.error(...);
    }
  } catch (error) {
    console.error(...);
  }
```

**Content rule to carry over** (lines 47-58): the nudge says a message arrived; it never quotes the transaction reference. Mail is unencrypted, and the reference is the one value the reviewer must read off their own receipt.

**Call site:** from `after()` (`next/server`), precedent at `src/server/claims/submit.ts:353`. Function returns `void` and never rejects.

---

### 6. `src/server/admin/queries.ts` / `support.ts` / `src/server/support/queries.ts` (service/read, CRUD)

**Analog:** `src/server/claims/queries.ts` (206 lines) — the derived-count doctrine and the "`tenantId` parameter is legal *here*" carve-out both live in its header.

**Derived-count pattern** (lines 61-65) — the whole shape of D-11's unread badge:

```ts
export async function pendingClaimCount(tenantId: string): Promise<number> {
  return scopedDb(tenantId).paymentClaim.count({
    where: { status: "PENDING" },
  });
}
```

**The doctrine to restate in the new module's header** (lines 14-33):

> `THE BADGE IS A count(). IT IS NOT A COUNTER COLUMN. DO NOT "OPTIMIZE" IT.` … `A number derived from the rows cannot drift from the rows.`

**The `tenantId`-parameter carve-out** (lines 34-45) — the new support queries need this same paragraph, or a reader will think they violate TEN-04:

> `tests/unit/no-tenant-id-param.test.ts` forbids a tenant identifier in an exported signature under `src/server/merchant/**` and `src/server/entitlements/**` … This module is not on that surface and is not reachable from a client: it is `server-only`, it exports no Server Action…

**Row-DTO pattern** (lines 78-98) — declare the row interface explicitly rather than inferring from Prisma; annotate why each joined field rides along.

**Cross-tenant read pattern for `src/server/admin/**`** — `$queryRaw`/`$executeRaw` are banned repo-wide (`eslint.config.mjs:68-75`). Three parallel `groupBy` reads merged in JS, with an honest row-cap comment modeled on `src/server/dashboard/queries.ts:46-53`:

```ts
/**
 * Bounded at pilot scale but unbounded in principle: a merchant doing many
 * thousands of orders in a single 7-day window would exceed this...
 */
const REVENUE_WINDOW_ROW_CAP = 5000;
```

**Parallel-read pattern** (`src/server/dashboard/queries.ts:97-133`) — the admin inbox's three-query merge copies this shape:

```ts
  const [
    revenueAgg,
    openOrders,
    unitsAgg,
    windowCustomers,
    priorCustomers,
    windowRows,
  ] = await Promise.all([
    db.order.aggregate({ ... }),
    db.order.count({ where: { state: { in: [...OPEN_STATES] } } }),
    db.order.groupBy({ by: ["customerPhone"], where: { placedAt: { gte: since } } }),
    ...
  ]);
```

**Named-state-set pattern** (`dashboard/queries.ts:32-42`) — the attention band's `DISPUTED` filter and `LOW_STOCK_THRESHOLD` follow this, not inline arrays:

```ts
const EARNED_STATES: readonly OrderState[] = [
  OrderState.CONFIRMED,
  OrderState.FULFILLED,
];
```

---

### 7. `src/server/images/thread-upload.ts` (controller, file-I/O)

**Analog:** `src/server/images/claim-upload.ts` (166 lines)

**Two-narrow-doors rationale** (lines 28-41) — restate it in both new upload files:

> `…the only honest alternatives were this file or widening the merchant path's authorization to accept "or a tracking token". The second is exactly the kind of one-more-branch that turns a tenant boundary into a review item… Two narrow doors, each with one credential, stay readable.`

**Schema pattern — note what is absent** (lines 78-93):

```ts
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Everything a browser is permitted to influence. Note what is absent: no
 * tenant id, no key, no path, no file name.
 */
const requestClaimScreenshotUploadSchema = z.object({
  slug: z.string().min(1).max(64),
  token: z.string().min(1).max(64),
  contentType: z.string().min(1).max(128),
  byteSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});
```

`MAX_UPLOAD_BYTES = 10 * 1024 * 1024` is the constant UI-SPEC Open Item #2 asks the planner to confirm — it is **10 MB**, declared per-upload-path, not globally.

**Mint sequence** (lines 121-165) — allowlist checked *before* signing; key composed server-side:

```ts
  if (!isAllowedContentType(contentType)) {
    return { ok: false, message: strings.checkout.genericError };
  }

  const uploadId = crypto.randomUUID();
  const key = objectKeyFor(tenant.id, "claims", uploadId);
  const uploadUrl = await presignUpload(key, contentType, byteSize);

  return { ok: true, uploadUrl, uploadId };
```

**Registry rows to add** — `src/server/images/r2.ts:87`:

```ts
export type UploadKind = "products" | "claims" | "logos";
```

and `src/server/images/pipeline.ts:74-82` (copy the `claim` row's spec verbatim for `thread` — a support attachment is the same kind of artifact, and a square crop can remove the transaction reference):

```ts
  claim: {
    sizes: [1200],
    labels: ["full"],
    fit: "inside",
    ratio: null,
    format: "webp",
    enhance: true,
    lossless: false,
  },
```

**Content-type allowlist is three raster formats** (`r2.ts:56-60`) — this is the hard blocker on D-22's PDF. See § Risks R-2.

---

### 8. `src/app/api/upload/thread-finalize/route.ts` (route handler, file-I/O)

**Analog:** `src/app/api/upload/claim-finalize/route.ts` (217 lines)

**Runtime + duration** (lines 61-94) — copy both the comment and the export:

```ts
/**
 * NODE RUNTIME. DO NOT ADD A `runtime` EXPORT.
 * This route reaches `processImage`, which imports Sharp, which is a binding
 * over native libvips… the failure mode is ADDING the line, not omitting it.
 */
export const maxDuration = 30;
```

**Error surface** (lines 106-113) — codes only, never a key and never a URL:

```ts
type ErrorCode =
  | "invalid_request"
  | "not_found"
  | "unprocessable_image"
  | "storage_unavailable";

const fail = (code: ErrorCode, status: number): NextResponse =>
  NextResponse.json({ error: code }, { status });
```

**Derive-and-store sequence** (lines 160-216) — re-authorize from scratch, recompute the key, return the **prefix**:

```ts
  let originalKey: string;
  try {
    originalKey = storage.objectKeyFor(tenant.id, "claims", uploadId);
  } catch {
    return fail("invalid_request", 400);
  }
  ...
  derived = await processImage(original, "claim");
  const single = derived.at(0);
  const prefix = storage.derivativePrefixFor(originalKey);
  await storage.putObject(`${prefix}/${single.label}.webp`, single.body, single.contentType);
  ...
  return NextResponse.json({ storageKey: prefix });
```

**"It writes no database row"** (lines 69-77) — the thread-finalize route must follow this too: `postMessage` persists `SupportAttachment`, because it is the caller that knows whether the message itself succeeded.

---

### 9. `src/app/admin/layout.tsx` (layout, request-response)

**Analog:** `src/app/(dashboard)/layout.tsx` (160 lines)

**Provider composition + data-fetch-not-gate pattern** (lines 79-93, 156):

```ts
export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  const ctx = await requireMerchantContext();
  const pendingClaims = await pendingClaimCount(ctx.tenantId);

  return (
    <ThemeProvider>
      <SidebarProvider>
        <AppSidebar pendingClaims={pendingClaims} />

        <SidebarInset>
          ...
        </SidebarInset>

        <Toaster />
      </SidebarProvider>
    </ThemeProvider>
  );
}
```

**Header band pattern** (lines 105-119) — the admin header band mirrors this shape, minus the store name and search:

```tsx
          <header className="flex min-h-14 items-center gap-3 border-b border-border px-4 sm:px-8">
            <SidebarTrigger
              aria-label={strings.dashboard.nav.openNavigation}
              className="lg:hidden"
            />
            <span className="text-sm leading-normal font-semibold text-foreground">
              {ctx.storeName}
            </span>
            <DashboardTopbarSearch />
            <div className="ml-auto flex items-center gap-1">
              <DashboardHeaderControls />
              <SignOutButton />
            </div>
          </header>
```

**The `<Toaster />` comment to adapt** (lines 137-155) — Pitfall 8. The existing comment warns that two mounts show every toast twice; the new mount's comment must say why that does not apply here (the two trees never render together), so a future reader does not "fix" it:

```tsx
        {/*
         * The toast host, mounted once for the whole dashboard shell.
         * …(Quick task 260906-egn removed a second `<Toaster />` that had been
         * mounted inside `SidebarInset` above — the two mounts would have shown
         * every toast twice.)
         */}
        <Toaster />
```

**The "not the authorization boundary" header** (lines 22-44) — restate verbatim-in-spirit in `src/app/admin/layout.tsx`; the gate is `requireAdminContext()` in **every** `page.tsx`.

---

### 10. `src/app/admin/**/page.tsx` (page RSC, CRUD)

**Analog:** `src/app/(dashboard)/dashboard/claims/page.tsx` (133 lines) — the closest existing page by role *and* data flow: a server list page that authorizes itself, pre-formats money and URLs server-side, and hands finished props to a client island.

**Self-authorization header + metadata** (lines 15-23, 53-55):

```ts
/**
 * THIS PAGE AUTHORIZES ITSELF.
 * `requireMerchantContext()` is called here, not inherited from
 * `(dashboard)/layout.tsx` — the layout is a shell, explicitly not an
 * authorization boundary. …it is `React.cache()`-memoized, so the repetition
 * costs nothing.
 */

export const metadata: Metadata = {
  title: strings.claims.title,
};
```

**Server-side formatting + storage-key resolution** (lines 65-100) — `formatXaf` and `publicUrlFor` are resolved on the server, never in the island:

```ts
export default async function ClaimsPage() {
  const ctx = await requireMerchantContext();
  const claims = await listClaimsForReview(ctx.tenantId);

  // One clock for the whole render, so two cards submitted a second apart
  // cannot report relative times computed against two different instants.
  const now = new Date();

  const cards = await Promise.all(
    claims.map(async (claim) => {
      ...
      return {
        amountClaimedFormatted: formatXaf(claim.amountClaimedXaf),
        amountMismatch: claim.amountClaimedXaf !== claim.order.totalXaf,
        submittedAtRelative: formatRelativeTime(claim.submittedAt, now),
        screenshotUrl:
          claim.screenshotKey === null
            ? null
            : publicUrlFor(`${claim.screenshotKey}/${CLAIM_DERIVATIVE}`),
      };
    }),
  );
```

**The derivative-name constant** (lines 57-63) — copy this idiom for thread attachments and subscription receipts:

```ts
/**
 * The `claim` preset's single derivative, whose label is `full` — read from
 * `IMAGE_PRESETS.claim` in `src/server/images/pipeline.ts`, not assumed.
 */
const CLAIM_DERIVATIVE = "full.webp";
```

**Heading + subline + empty-state layout** (lines 102-131) — the exact JSX shape for C1/C3/C4/C5 headers and empty states. Note `max-w-5xl` for list pages; UI-SPEC raises the admin ledgers to `max-w-6xl`:

```tsx
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl leading-tight font-semibold text-foreground">
          {strings.claims.heading}
        </h1>
        <p className="text-sm leading-normal font-medium text-muted-foreground">
          {cards.length === 0
            ? strings.claims.sublineEmpty
            : strings.claims.subline.replace("{n}", String(cards.length))}
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <h2 className="text-lg leading-snug font-semibold text-foreground">
            {strings.claims.emptyHeading}
          </h2>
          <p className="max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {strings.claims.emptyBody}
          </p>
        </div>
      ) : ( ... )}
    </div>
```

> Note: UI-SPEC's typography contract requires `font-heading` on page headings (see `dashboard/page.tsx:98`, which has it). The claims page predates that and uses plain `text-2xl` — **copy the layout from claims, copy the `font-heading` class from `dashboard/page.tsx:98`.**

---

### 11. `src/app/admin/claims/ledger-row.tsx` + `subscription-claim-card.tsx` (client islands)

**Analog:** `src/app/(dashboard)/dashboard/claims/claim-card.tsx`

**Imports** (lines 1-36) — the exact primitive set the ledger rows need:

```tsx
"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Check, CircleCheck, Copy, ImageOff, LoaderCircle, TriangleAlert, X,
} from "lucide-react";
import { toast } from "sonner";

import { OrderChannelChip } from "@/components/order-state-chip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
```

**Action-call + toast pattern** (lines 261-284):

```tsx
    const result = await confirmClaim({ claimId });
    ...
      toast.success(...);
    ...
    const result = await rejectClaim({ claimId, reason });
    ...
      toast.success(strings.claims.rejectedToast);
```

`AlertDialog` is already the amount-mismatch confirm affordance here — C3's mismatch dialog and C4's subscription-confirm dialog reuse this exact import set.

---

### 12. `src/components/support/composer.tsx` and the suspend/restore dialogs

**Analog:** `src/app/(dashboard)/dashboard/claims/reject-dialog.tsx` (223 lines) — Research names this "the closest existing analogue (required reason, min-length, destructive confirm)".

**Controlled-state + disabled-until-valid pattern** (lines 78-93):

```tsx
  const otherFieldId = useId();
  const [choice, setChoice] = useState<string>("");
  const [otherReason, setOtherReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOther = choice === OTHER;
  const reason = isOther ? otherReason.trim() : choice;

  const canSubmit = reason.length >= 3 && !pending;
```

**Submit handler with reset-on-success** (lines 95-112):

```tsx
  async function handleSubmit() {
    setError(null);
    setPending(true);

    const succeeded = await onReject(reason);

    setPending(false);
    if (succeeded) {
      setChoice("");
      setOtherReason("");
      onOpenChange(false);
      return;
    }

    setError(strings.orders.genericError);
  }
```

**Live character counter** (lines 160-181) — the composer and both ≤140/≤280 reason fields copy this, `aria-live` included:

```tsx
            <Textarea
              id={otherFieldId}
              value={otherReason}
              maxLength={OTHER_MAX_LENGTH}
              rows={3}
              onChange={(event) => { setOtherReason(event.target.value); setError(null); }}
            />
            <span
              aria-live="polite"
              className="self-end text-sm leading-normal font-normal tabular-nums text-muted-foreground"
            >
              {otherReason.length}/{OTHER_MAX_LENGTH}
            </span>
```

**Inline destructive alert (never a toast alone for a blocking error)** (lines 184-191):

```tsx
        {error === null ? null : (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        )}
```

**Footer button pair** (lines 193-219) — `min-h-11` on both, `LoaderCircle` spinner in the pending state:

```tsx
          <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={...}>
            {strings.claims.rejectDialogCancel}
          </Button>
          <Button type="button" variant="destructive" className="min-h-11" disabled={!canSubmit} onClick={...}>
            {pending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            {strings.claims.rejectDialogConfirm}
          </Button>
```

**Canned-reasons-are-the-text rule** (lines 45-51) — carries over to C3's admin reject dialog, which UI-SPEC says reuses the merchant copy verbatim:

> `Each radio's value IS the sentence the customer will read. Mapping a code to copy at submit time would put the customer-facing string in two places.`

---

### 13. `src/components/admin/admin-sidebar.tsx` (component)

**Analog:** `src/components/app-sidebar.tsx` (250 lines)

**Registry-as-data nav pattern** (lines 93-104, 115-126):

```ts
interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Only the claims item carries the gold pending count. */
  readonly badged?: boolean;
}

interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

/** The apex route, matched exactly — every other item matches by prefix. */
const OVERVIEW_HREF = "/dashboard";
```

**Active-match helper** (lines 187-190) — copy verbatim, swapping `OVERVIEW_HREF` for `/admin`:

```ts
function isCurrent(pathname: string, href: string): boolean {
  if (href === OVERVIEW_HREF) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

**Render shape + touch-target override + the single gold badge** (lines 216-241):

```tsx
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={current}
                        className="h-auto min-h-11 text-sm font-semibold data-active:font-semibold data-active:text-sidebar-primary"
                        aria-current={current ? "page" : undefined}
                        render={<Link href={item.href} />}
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                        {item.badged && pendingClaims > 0 ? (
                          <Badge variant="gold" className="ml-auto tabular-nums">
                            {pendingClaims}
                          </Badge>
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
```

**Header lockup** (lines 197-204) — the admin rail adds a second `Platform Admin` line beneath:

```tsx
      <SidebarHeader className="min-h-14 justify-center border-b border-sidebar-border px-4">
        <div className="flex items-center gap-2">
          <Image src={einortLogo} alt={BRAND} className="h-6 w-auto shrink-0" />
          <span className="text-sm leading-normal font-semibold tracking-wide text-sidebar-foreground">
            {BRAND}
          </span>
        </div>
      </SidebarHeader>
```

**The active item is not blue** (lines 46-56) — carry this header paragraph into the admin rail so nobody "fixes" it.

---

### 14. `src/components/subscription-claim-chip.tsx` and `admin/domain-cell.tsx`

**Analog:** `src/components/order-state-chip.tsx` (273 lines)

**Why-a-map-not-a-switch header** (lines 23-40) — the reasoning applies unchanged to the subscription-claim chip and the two-state domain chip:

> `Readonly<Record<OrderState, …>> makes a seventh enum member a COMPILE error here, the same discipline ORDER_TRANSITIONS and PLANS apply. A switch with a default would instead render the new state with whatever the fallback happens to be, which is a status chip that lies.`
>
> `A plain data object is importable from the database-free unit project, so tests/unit/order-state-chip.test.ts can sweep it… A rule expressed as a value is a rule a test can restate; a rule expressed as control flow is not.`

**Map row shape** (lines ~100-125):

```ts
  PAYMENT_CLAIMED: {
    // The second and last gold in the product. See the header.
    label: strings.orders.statePaymentClaimed,
    variant: "gold",
    icon: BellRing,
  },
  CONFIRMED: {
    label: strings.orders.stateConfirmed,
    variant: "success",
    icon: CircleCheck,
  },
  DISPUTED: {
    label: strings.orders.stateDisputed,
    variant: "destructive",
    icon: TriangleAlert,
  },
  FULFILLED: {
    label: strings.orders.stateFulfilled,
    variant: "outline-success",
    icon: PackageCheck,
  },
```

**`as const satisfies` pattern** (lines ~150-170) — use it so a new enum member is a compile error, not a silent fallback.

**Available badge variants — do not add one** (`src/components/ui/badge.tsx:56-59`):

```ts
        gold: "bg-gold-accent/15 text-gold-accent-foreground [a]:hover:bg-gold-accent/25",
        success: "bg-success/10 text-success [a]:hover:bg-success/20",
        "outline-success":
          "border-success text-success [a]:hover:bg-success/10",
```

**Pure-function analog for `domainStatusFor(org)`:** `src/server/orders/state-machine.ts` — a pure predicate over a data table, unit-testable with no DOM and no Postgres. Put the derivation in one exported function so Phase 15 replaces one function, not a JSX expression.

---

### 15. `src/components/dashboard/attention-band.tsx` + Overview extension

**Analogs:** `src/components/dashboard-card.tsx` (the card shell primitive — currently has **no consumer**; this phase may be its first) and `src/app/(dashboard)/dashboard/overview-metrics.tsx`.

```tsx
function DashboardCard({ title, children, ...props }: DashboardCardProps) {
  return (
    <Card {...props}>
      {title !== undefined ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
```

> `dashboard-card.tsx`'s header says "Do not wire it into any existing page as part of quick task 260903-ugl" — that prohibition was scoped to *that* task. Wiring it here is the retrofit it was built for; state that in the plan so a reader does not treat it as a violation.

**Overview extension point** (`src/app/(dashboard)/dashboard/page.tsx:76-129`) — insert the band between the header block and `<OverviewMetrics>`, and add the fifth prop. **Do not touch** `RevenueBars`, `RecentOrders`, or the storefront-address block:

```tsx
export default async function DashboardPage() {
  const ctx = await requireMerchantContext();

  const now = new Date();
  const since = new Date(now.getTime() - OVERVIEW_WINDOW_DAYS * 86_400_000);
  const [metrics, orders] = await Promise.all([
    overviewMetrics(ctx.tenantId, since),
    recentOrders(ctx.tenantId),
  ]);
  ...
      <OverviewMetrics
        revenueXaf={metrics.revenueXaf}
        openOrders={metrics.openOrders}
        unitsSold={metrics.unitsSold}
        newCustomers={metrics.newCustomers}
      />
```

**Heading typography to copy** (line 98) — this is the `font-heading` reference for every new page heading:

```tsx
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
```

---

### 16. `src/lib/strings/admin.ts` and `src/lib/strings/support.ts`

**Analog:** `src/lib/strings/marketing.ts` (98 lines)

**Module header pattern** (lines 1-33) — say *why* this copy is a separate file, name the voice contract, and name what it must NOT copy from:

```ts
/**
 * MKTG-01 — the public landing page's (`src/app/page.tsx`, apex `/`) copy.
 *
 * Extracted to its own module for a DIFFERENT reason than `flagship.ts`'s
 * TS7022 circularity…: `index.ts` is already 1,867 lines…
 *
 * Voice contract (05.2-UI-SPEC.md § Copywriting Contract, D-03): English,
 * second person, no exclamation marks, no apology interjections, no emoji…
 */
export const marketingCopy = { ... }
```

For `admin.ts`, the equivalent voice note is UI-SPEC's **two-audiences rule**: admin copy says `{store name}` / `the merchant`, never `your`. A string used on both surfaces is a bug.

**Spread-into-index pattern** (`src/lib/strings/index.ts:30-31, 41-43, 1419`):

```ts
import { flagshipCopy } from "./flagship";
import { marketingCopy } from "./marketing";
...
export const strings = {
  ...
  root: { ...marketingCopy },
  ...
  flagship: { ...flagshipCopy },
```

Add `admin: { ...adminCopy }` and `support: { ...supportCopy }` the same way. Author the copy **before** the components (Pitfall 10).

---

### 17. `src/server/auth/login.ts` + `src/app/login/login-form.tsx` (D-05)

**Analog:** the file itself. Current shape at lines 29-31 and 104:

```ts
export type SignInMerchantResult =
  | { ok: true }
  | { ok: false; error: Record<string, string[]> };
```

```ts
  return { ok: true };
```

Widen to `{ ok: true; redirectTo: string }` and compute it server-side after `auth.api.signInEmail` succeeds. **Preserve unchanged:** the rate-limit-before-parse ordering (lines 59-68) and the single `credentialFailure` constant (lines 42-52) — both are named controls with their own header paragraphs.

**Belt-and-braces rung** in `src/server/merchant/context.ts`, inserted **above** the `!tenantId` rung (line 103) — one line, and the function signature must stay parameterless:

```ts
    const tenantId = session.session.activeOrganizationId;
    // An account with no store. Phase 1's recovery route owns this case…
    if (!tenantId) redirect("/onboarding/create-store");
```

---

## Shared Patterns

### S-1. Module "why" header with requirement/decision IDs

**Source:** every non-trivial module; canonical examples `src/server/merchant/context.ts:14-55`, `src/server/db/admin.ts:5-29`
**Apply to:** every new `.ts`/`.tsx` file in this phase
**Shape:** ASCII-rule section dividers, ALL-CAPS lead-ins for load-bearing warnings, explicit requirement/decision citations (`ADM-01`, `D-14`, `SUB-03`, `T-06-nn`), and a paragraph naming the "obvious wrong fix" that must not be applied.

```ts
/**
 * The platform-admin data client. **Deliberately unscoped and cross-tenant.**
 *
 * This is not an oversight and it is not a hole — it is the requirement.
 * TEN-05 asks that the platform admin surface be *architecturally* isolated
 * from the tenant surface, and this module is that architecture:
 *   1. It is a separate module from `scopedDb`…
 *   2. It is importable only from `src/server/admin/**`, enforced by the
 *      `no-restricted-imports` zone in `eslint.config.mjs`…
 *   3. The same ESLint config forbids `src/server/admin/**` from importing
 *      `tenant-scoped.ts`. The isolation runs both ways…
 */
```

### S-2. `"use server"` vs `import "server-only"` — mutually exclusive first lines

**Source:** `src/server/merchant/action.ts:48-52` (factory → `server-only`), `src/server/claims/actions.ts:67-68` (actions → `"use server"`)
**Apply to:** `admin/context.ts`, `admin/action.ts`, `admin/queries.ts`, `admin/suspend.ts`, `support/notify.ts`, `support/queries.ts`, `support/shared.ts` → **`server-only`**. `admin/actions.ts`, `support/actions.ts`, `images/thread-upload.ts` → **`"use server"`**.

```ts
 * `import "server-only"` and not `"use server"`: this module exports a FACTORY,
 * not an action. Every export of a `"use server"` module must be an async
 * function that Next can register as an endpoint, and a generic higher-order
 * function is not that.
```

### S-3. Three-client discipline and the bidirectional ESLint fence

**Source:** `src/server/db/admin.ts`, `eslint.config.mjs:42-111`
**Apply to:** all server modules

| Zone | Client | Fence |
|---|---|---|
| `src/server/admin/**` | `adminDb` only | may **not** import `tenant-scoped.ts` |
| `src/server/support/**`, all merchant code | `scopedDb(tenantId)` | may **not** import `db/admin` |
| Non-tenant registry tables (Organization, User, Member) | `platformDb` | — |
| `src/app/admin/**` | **neither** — page components call into `src/server/admin/**` | `src/app/admin/**` is *not* in the admin ESLint zone; do not widen the fence to "fix" the lint error |

`$queryRaw`/`$executeRaw` are banned repository-wide by `no-restricted-syntax` — the admin inbox's "latest message per tenant" is three `groupBy` reads merged in JS, not a lateral join.

### S-4. Derived counts, never counter columns

**Source:** `src/server/claims/queries.ts:14-33`
**Apply to:** D-11 unread badges (both directions), D-08 inbox ordering, DASH-02 attention band, C1's Products/Orders columns

> `Miss one — or let one land outside the transaction that changed the claim — and the badge lies, which is worse than no badge at all… A number derived from the rows cannot drift from the rows.`

**Forbidden columns, each already rejected by name in the codebase:** `pendingClaimCount`, `lastMessageAt`, `unreadCount`, `notificationEmail`, `domainStatus`.

### S-5. Optimistic lock inside the transaction

**Source:** `src/server/claims/actions.ts:42-53` (header) and `:155-157` (code)
**Apply to:** subscription-claim confirm/reject, suspend/restore, admin-ledger confirm/reject

> `A merchant with two tabs open is the NORMAL case, not an attack… the status check is the optimistic lock… Without the guard inside the transaction, two rejections would each write an OrderEvent and each release the stock.`

### S-6. Side effects inside `after()`, never in the transaction

**Source:** `src/server/claims/submit.ts:353` (call site), `src/server/claims/notify.ts:11-25` (contract)
**Apply to:** the D-09 email nudge in both directions, and any future automated thread notice

The notify function returns `void`, never rejects, and swallows everything into `console.warn`/`console.error`. Any route that both derives an image and sends mail carries `export const maxDuration` (30 is the precedent).

### S-7. Copy in `src/lib/strings/**`, zero prose literals in JSX

**Source:** `src/lib/strings/marketing.ts` + `index.ts:30-43`; enforcement in `tests/unit/dashboard-nav.test.ts`
**Apply to:** every new `.tsx` in this phase. Author `admin.ts` and `support.ts` before the components.

### S-8. Server-side formatting and URL composition

**Source:** `src/app/(dashboard)/dashboard/claims/page.tsx:25-40`
**Apply to:** every admin ledger row, the merchant list, subscription cards, thread attachments

> `claim-card.tsx receives pre-formatted money and a finished URL, never a raw amount or a storage key.` — `formatXaf` is one `fr-CM` instantiation (client formatting would render against the *merchant's device locale*), and `publicUrlFor` **refuses** a key ending in `/original`, a guard a Client Component cannot reach.

### S-9. Contract tests are part of the feature, not a follow-up

**Source:** `tests/unit/single-order-state-writer.test.ts`, `tests/unit/dashboard-nav.test.ts`
**Apply to:** three landings that must be atomic, or the build breaks mid-wave:

| Landing | Files that must change in ONE commit |
|---|---|
| Support nav item (Pitfall 2) | `strings.dashboard.nav.support` + `NAV_GROUPS` in `app-sidebar.tsx` + `REQUIRED_HREFS` in `tests/unit/dashboard-nav.test.ts` |
| First gold spend (Pitfall 1) | the component + the gold allow-table in `tests/unit/dashboard-nav.test.ts` |
| Each new tenant-scoped model (Pitfall 4) | `schema.prisma` + migration · `REGISTERED_MODELS` (FK dependency order) · `tests/setup/seed-two-tenants.ts` · `tests/isolation/tenant-isolation.test.ts` |

Current test constants, for the diff:

```ts
const REQUIRED_HREFS = [
  "/dashboard",
  "/dashboard/products",
  "/dashboard/storefront",
  "/dashboard/orders",
  "/dashboard/claims",
  "/dashboard/plan",
  "/dashboard/settings/payment",
] as const;
```

```ts
/** Both surfaces' component trees — the scope of the gold-accent budget. */
const GOLD_SCAN_DIRS = ["src/app", "src/components"] as const;
...
const GOLD_VARIANT = /variant="gold"/g;
```

The scan matches the **literal string** `variant="gold"`. A raw `bg-gold-accent/*` utility slips past silently, which is strictly worse than an honest failure — every gold surface goes through the tracked `Badge` variant.

### S-10. Anti-vacuous source-scanning test structure

**Source:** `tests/unit/single-order-state-writer.test.ts:168-219`
**Apply to:** `tests/unit/single-org-status-writer.test.ts`, and any new prose/`adminDb`-usage scan

Three tests, always in this order: (1) the tree was actually scanned; (2) the detector still fires on the sanctioned writer (positive control); (3) no second writer. Plus `stripCommentLines` so the module's own header quoting the forbidden pattern does not trip the guard.

---

## No Analog Found

Planner should use RESEARCH.md § Code Examples and UI-SPEC § S instead.

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/support/message-list.tsx` | component | append-only log | No conversation/transcript UI exists anywhere in this codebase. Closest structural cousin is `src/app/(dashboard)/dashboard/recent-orders.tsx` (a server-fed list), which shares nothing but "renders rows". Build from UI-SPEC § S. |
| `src/components/support/message-bubble.tsx` | component | — | Same. No bubble, no day separator, no `aria-live="polite" role="log"` container exists. |
| `src/components/support/attachment-grid.tsx` | component | — | `claim-card.tsx` has a **single** screenshot thumb + lightbox; a multi-thumb grid with staged-upload state is new. Reuse the lightbox `dialog` from `claim-card.tsx`, build the grid fresh. |
| `src/components/admin/admin-banner.tsx` | component | — | `trial-banner.tsx` is the only persistent strip precedent, but it is dismissible-adjacent, conditional and uses `--destructive`/muted, not a `sticky top-0 z-30` non-interactive gold note. Build from UI-SPEC § R-1. |
| `scripts/promote-admin.ts` | script | batch | `scripts/` currently holds only `prisma-generate.mjs`. Closest posture analog is `tests/setup/seed-two-tenants.ts`'s direct-invocation entry point (`console.error` + `process.exitCode = 1`) and `prisma/seed.ts`'s `tsx` execution. **No existing script writes through `prismaBase` from the CLI.** |
| Optimistic message send (`useOptimistic`) | component | — | No `useOptimistic` usage exists in the repo. `claim-card.tsx` uses plain `useState` + `pending` and awaits the server. UI-SPEC § S requires a genuinely optimistic pending bubble — this is net-new interaction code. |

---

## Risks Verified This Session

### R-1 — `transitionOrder` is typed to `ScopedTx`. Research Assumption A4 is **FALSE as stated**, and Pitfall 3 is live.

`src/server/orders/transition.ts:206-209`

```ts
export async function transitionOrder(
  tx: ScopedTx,
  args: TransitionOrderArgs,
): Promise<void> {
```

`src/server/db/tenant-scoped.ts:189`

```ts
export type ScopedTx = Omit<ScopedDb, runtime.ITXClientDenyList>;
```

`releaseStock`, `holdStockForLines` and `markStockHeld` (`src/server/orders/stock.ts:115, 166, 208`) are all `ScopedTx`-typed too.

**Consequence:** `src/server/admin/claims.ts` cannot pass an `adminDb.$transaction` client to `transitionOrder`. And the admin zone **cannot import `tenant-scoped.ts` at all** (ESLint fence), so it cannot even name the type. The three options, cheapest first:

1. **Widen the parameter to the structural minimum `transitionOrder` actually uses** (`{ order: { findUniqueOrThrow, updateMany }, orderEvent: { create } }`-shaped) so both clients satisfy it. Keeps one writer, no new test violation. Requires the type to live somewhere both zones may import (`src/server/orders/errors.ts`-style neutral module, or a local structural type in `transition.ts` that carries no `tenant-scoped` import).
2. Have `src/server/admin/claims.ts` call a thin bridge in `src/server/orders/**` that constructs the scoped client for the target tenant. Admin passes the id to a **query/writer**, never to the identity function — legal per Pattern 1.
3. Duplicate the writer — **forbidden**, breaks `tests/unit/single-order-state-writer.test.ts`.

**Budget the spike task before the C3 ledger wave is planned.** This is the phase's single highest-risk integration.

### R-2 — D-22 (PDF attachments) collides with the verified upload allowlist.

`src/server/images/r2.ts:56-60`

```ts
export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
```

`isAllowedContentType` (line 74) is an **exact match, no normalization** — the value is echoed into `PutObjectCommand.ContentType` and signed. A PDF cannot be re-encoded by Sharp, so it would be served as the uploaded bytes, which is the exact outcome `publicUrlFor`'s `/original` refusal exists to prevent. CONTEXT D-22 says PDF is in; UI-SPEC Assumption A2 and Open Item #1 say it is out. **The planner must resolve this before writing the attachment tasks**; if PDF stays in, it is a second, non-re-encoding storage path with its own content-disposition and origin-isolation story — a wave, not a task.

### R-3 — `invalidateTenantHost` **confirmed** (Research A3 resolved).

`src/server/tenant/cache.ts:273` — `export async function invalidateTenantHost(...slugs: string[]): Promise<void>`. Call it in the same code path as the `Organization.status` flip.

---

## Metadata

**Analog search scope:** `src/server/**` (18 domain dirs), `src/app/(dashboard)/**`, `src/app/api/upload/**`, `src/components/**`, `src/lib/strings/**`, `tests/unit/**`, `prisma/**`
**Files read in full:** 16 · **Files read by targeted range/grep:** 9
**Strongest analog cluster:** `src/server/claims/**` + `src/app/(dashboard)/dashboard/claims/**` — Phase 3's claim surface is a near-complete template for this phase's admin ledgers, subscription claims, reason dialogs and email nudge.
**Pattern extraction date:** 2026-09-13
