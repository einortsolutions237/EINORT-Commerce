# Phase 4: Theme/Section/Block System & Flagship Template - Pattern Map

**Mapped:** 2026-09-01
**Files analyzed:** 57 (36 new, 21 modified)
**Analogs found:** 53 / 57

> **How to read this.** Every row names the ONE existing file the new file should be
> opened beside. Where the analog is exact, copy its structure line for line. Where it
> is a role-match only, copy its *conventions* (module header, marker line, error idiom)
> and not its logic. Four files have no analog and are called out in § No Analog Found —
> for those, the style conventions in § Shared Patterns are the whole contract.

---

## File Classification

### Wave-0 foundations (schema + registry + pure logic)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `prisma/schema.prisma` (M) — `StorefrontTheme`, `StorefrontPage`, `Organization.industry` | model | CRUD | `prisma/schema.prisma` § `model Organization` (lines 101–155) | exact |
| `src/server/db/tenant-scoped.ts` (M) — register 2 models | config | CRUD | itself, `REGISTERED_MODELS` (lines 53–66) | exact |
| `tests/setup/seed-two-tenants.ts` (M) — 2 fixture builders | test | CRUD | itself, `MODEL_FIXTURES` (lines 318–340) | exact |
| `src/server/theming/schema.ts` (N) | model/validation | transform | `src/server/payments/actions.ts` lines 67–74 (Zod object style) + `src/server/orders/state-machine.ts` (pure-module header) | role-match |
| `src/server/theming/registry.ts` (N) — `SECTION_TYPES`, `TEMPLATES`, `INDUSTRY_SEGMENTS` | config registry | transform | `src/server/entitlements/plans.ts` (`PLANS`, lines 92–140) **and** `src/server/images/pipeline.ts` (`IMAGE_PRESETS`, lines 27–75) | exact |
| `src/server/theming/defaults.ts` (N) | config | transform | `src/server/images/pipeline.ts` lines 45–73 (row-per-surface data literal) | role-match |
| `src/lib/contrast.ts` (N) | utility (pure) | transform | `src/server/orders/state-machine.ts` lines 105–125 (pure predicate + exported constants) | role-match, wrong dir |
| `src/lib/theme-defaults.ts` (N) | config constants | — | `src/server/orders/state-machine.ts` lines 91–103 (module-private/exported constant block) | role-match, wrong dir |
| `src/lib/editor/reducer.ts` (N) | utility (pure) | transform | **none** — see § No Analog Found | none |

### Server domain — theming

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/server/theming/queries.ts` (N) | service (read) | request-response | `src/server/storefront/queries.ts` (lines 1–18, 101–115) | exact |
| `src/server/theming/actions.ts` (N) — `saveDraft`, `publishStorefront`, `discardDraft`, `saveBranding`, `ensureStorefrontSeeded` | service (write) | CRUD | `src/server/payments/actions.ts` (lines 1–12, 44–52, 186–192) — the scoped-`upsert`-through-`merchantAction` module | exact |
| `src/server/entitlements/plans.ts` (M) — `storefrontEditor` | config registry | — | itself, `PlanLimits` (lines 41–77) | exact |
| `src/server/entitlements/resolve.ts` (M) — `canEditStorefront` | service (pure) | transform | itself, `canWrite` (lines 88–90, 150) | exact |
| `src/server/entitlements/assert.ts` (M) — `EditorLockedError`, `assertCanEditStorefront` | middleware/guard | — | itself, `ReadOnlyError`/`assertCanWrite` (lines 48–59, 91–100) | exact |
| `src/server/merchant/action.ts` (M) — catch arm | middleware | request-response | itself, lines 115–123 | exact |
| `src/server/merchant/context.ts` (M) — `industry === null` rung | middleware | request-response | itself, line 116 (`planTier === null` rung) | exact |

### Image pipeline (ONB-03)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/server/images/pipeline.ts` (M) — per-preset `enhance` | service | file-I/O | itself, `IMAGE_PRESETS` (lines 45–73) + `processImage` chain (lines 148–164) | exact |
| `src/server/images/actions.ts` (M) — `requestLogoUpload` | service (write) | file-I/O | itself, `requestProductImageUpload` (lines 90–118) | exact |
| `src/app/api/upload/finalize/route.ts` (M) — `kind` enum + `KIND_PRESET` | route handler | file-I/O | itself, lines 84–87, 149–175 | exact |

### Storefront (surface 1 — `src/app/s/[slug]/**`)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/globals.css` (M) — `--brand-accent*`, motion tokens | config | — | itself, `@theme inline` gold pair (lines 33–34) + `[data-surface="storefront"]` block (lines 156+) | exact |
| `src/app/s/[slug]/layout.tsx` (M) — token injection + chrome | layout | request-response | itself (lines 24–70) | exact |
| `src/app/s/[slug]/page.tsx` (M) — `renderPage(published)` | page (RSC) | request-response | itself (lines 46–110) | exact |
| `src/app/s/[slug]/store-header.tsx` (M) — logo + translucency | component (RSC) | request-response | itself (lines 18–72) | exact |
| `src/app/s/[slug]/store-footer.tsx` (N) | component (RSC) | request-response | `src/app/s/[slug]/store-header.tsx` | exact |
| `src/app/s/[slug]/sections/section-renderer.tsx` (N) | component | transform | `src/server/orders/state-machine.ts` lines 117–125 (exhaustive-switch discipline) | role-match |
| `src/app/s/[slug]/sections/product-grid-section.tsx` (N) | component (RSC) | request-response | `src/app/s/[slug]/page.tsx` lines 107–195 (grid + chips + tile, verbatim source) | exact |
| `src/app/s/[slug]/sections/hero-section.tsx` (N) | component | request-response | `src/app/s/[slug]/page.tsx` lines 144–182 (`next/image` + token utilities) | role-match |
| `src/app/s/[slug]/sections/trust-bar-section.tsx` (N) | component | request-response | same | role-match |
| `src/app/s/[slug]/sections/editorial-split-section.tsx` (N) | component | request-response | same | role-match |
| `src/app/s/[slug]/sections/contact-section.tsx` (N) | component (RSC) | request-response | `src/app/s/[slug]/store-header.tsx` (RSC that reads a server query for one value) | role-match |
| `src/app/s/[slug]/sections/reveal.tsx` (N) | component (client) | event-driven | **none** — see § No Analog Found | none |
| `src/app/s/[slug]/preview/page.tsx` (N) | page (RSC) | request-response | `src/app/s/[slug]/page.tsx` (lines 58–79 data bundle) | exact |
| `src/app/s/[slug]/preview/preview-canvas.tsx` (N) | component (client) | pub-sub (`postMessage`) | **none** — see § No Analog Found | none |

### Onboarding (surface 2)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/onboarding/branding/page.tsx` (N) | page (RSC) | request-response | `src/app/onboarding/plan/page.tsx` (lines 26–145) | exact |
| `src/app/onboarding/branding/branding-form.tsx` (N) | component (client) | request-response + file-I/O | `src/app/(dashboard)/dashboard/products/image-gallery-field.tsx` (lines 93–95, 271–326) for the upload leg; `src/app/(dashboard)/dashboard/settings/payment/payment-settings-form.tsx` for the RHF+action leg | exact (split) |
| `src/app/onboarding/plan/page.tsx` (M) — redirect target | page (RSC) | request-response | itself (lines 104–110) | exact |
| `src/app/onboarding/branding/loading.tsx` (N) | page | — | `src/app/(dashboard)/dashboard/products/loading.tsx` | exact |

### Dashboard editor (surface 3)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(dashboard)/dashboard/storefront-editor/page.tsx` (N) | page (RSC) | request-response | `src/app/(dashboard)/dashboard/products/page.tsx` (lines 1–62) | exact |
| `.../editor-shell.tsx` (N) | component (client) | event-driven | `src/app/(dashboard)/dashboard/products/image-gallery-field.tsx` (client island holding array state + `patch()` reducer-ish updater, lines 263–269) | role-match |
| `.../section-list.tsx` (N) | component (client) | event-driven | `src/components/app-sidebar.tsx` (lines 90–188 — `NAV_ITEMS` list → `aria-current` selected row, `min-h-11`) | role-match |
| `.../settings-panel.tsx` + `.../field-renderer.tsx` (N) | component (client) | transform | `src/app/(dashboard)/dashboard/settings/payment/payment-settings-form.tsx` | role-match |
| `.../publish-bar.tsx` (N) | component (client) | request-response | `src/app/(dashboard)/dashboard/products/product-row-actions.tsx` (action call + `ActionResult` handling) | role-match |
| `.../loading.tsx` (N) | page | — | `src/app/(dashboard)/dashboard/products/loading.tsx` | exact |
| `src/components/app-sidebar.tsx` (M) | component (client) | — | itself, `NAV_ITEMS` (lines 90–122) | exact |
| `src/components/ui/toggle-group.tsx` (N, `shadcn add`) | component | — | `src/components/ui/radio-group.tsx` | exact |
| `src/lib/strings.ts` (M) — `branding`, `editor`, `flagship` | config | — | itself, namespace pattern (`plan:` line 236, `paymentSettings:` line 897) | exact |

### Tests

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tests/unit/theming-registry.test.ts` (N) | test (source/registry drift) | transform | `tests/unit/single-order-state-writer.test.ts` (non-vacuity guards, lines 168–195) + `tests/unit/dashboard-nav.test.ts` (contract-list idiom, lines 56–63) | exact |
| `tests/unit/page-document-schema.test.ts` (N) | test (pure) | transform | `tests/unit/state-machine.test.ts` | exact |
| `tests/unit/editor-reducer.test.ts` (N) | test (pure) | transform | `tests/unit/state-machine.test.ts` / `tests/unit/variant-matrix.test.ts` | exact |
| `tests/unit/contrast.test.ts` (N) | test (pure) | transform | `tests/unit/state-machine.test.ts` | exact |
| `tests/isolation/storefront-editor.test.ts` (N) | test (db) | CRUD | `tests/isolation/storefront-catalog.test.ts` (lines 1–70) + `tests/isolation/tenant-isolation.test.ts` (lines 1–36) | exact |
| `tests/isolation/branding.test.ts` (N) | test (db) | CRUD | `tests/isolation/storefront-catalog.test.ts` | exact |
| `tests/unit/dashboard-nav.test.ts` (M) | test | — | itself, `REQUIRED_HREFS` (lines 56–63) | exact |
| `tests/unit/entitlements.test.ts` (M) | test (pure) | — | itself | exact |
| `tests/unit/image-pipeline.test.ts` (M) | test | file-I/O | itself | exact |
| `tests/unit/r2-key.test.ts` (M) | test | — | itself | exact |
| `tests/unit/surface-token-isolation.test.ts` (M) — one `brand-accent`-under-`(dashboard)` assertion | test (source scan) | — | itself, ban #4 (line 164, 272–277) | exact |

---

## Pattern Assignments

### `src/server/theming/registry.ts` (config registry, transform)

**Analog:** `src/server/entitlements/plans.ts` — the codebase's canonical `Readonly<Record<…>>`
registry — plus `src/server/images/pipeline.ts` for the "row is the whole specification" shape.

**Marker + header** (`plans.ts` lines 1–25) — a registry is `server-only`, never `"use server"`:

```ts
import "server-only";

/**
 * The plan registry — SUB-01's single source of truth.
 *
 * Plan differences are *data*, not conditionals. Every plan-dependent decision
 * in the codebase reads from this table; there is no `if (plan === "…")`
 * anywhere outside `src/server/entitlements/**`.
 * …
 * Two things deliberately do NOT live here:
 *   - **Marketing copy.** … belong in `src/lib/strings.ts`.
 *   - **Database access.** This module is pure data plus two pure functions…
 */
```

> **Binding for this phase:** `SECTION_TYPES`'s `label` and every field's helper text
> must be a *reference* into `strings.editor.*` / `strings.flagship.*`, never an inline
> literal — this is the exact split `plans.ts` documents above and what
> `tests/unit/dashboard-nav.test.ts`'s prose scan enforces.

**The `Readonly<Record<…>>` drift-detection pattern** (`plans.ts` lines 92–140):

```ts
/**
 * `Readonly<Record<PlanTier, …>>` rather than a lookup with a default: adding a
 * fourth tier becomes a compile error at every incomplete table in the
 * codebase, which is exactly the drift detection the tenant-model registry
 * provides. A default would turn the same change into a silent fallback.
 */
export const PLANS: Readonly<Record<PlanTier, PlanDefinition>> = {
  starter: { tier: "starter", monthlyPriceXaf: 5_000, recommended: false, limits: { … } },
  …
} as const;

const TIER_SET: ReadonlySet<string> = new Set(PLAN_TIERS);

/** Narrows an untrusted value … to a real tier. */
export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === "string" && TIER_SET.has(value);
}
```

Copy this exactly for `INDUSTRY_SEGMENTS` (the 6 segments, D-02) → a `PLAN_TIERS`-style
`as const` tuple + an `isIndustrySegment` narrower, because `Organization.industry` is a
`String?` column with the same "bad backfill" exposure `planTier` has.

**The "row is the whole spec, unused rows stay" pattern** (`pipeline.ts` lines 27–73):

```ts
/**
 * The registry. One row per surface; the row is the whole specification.
 * …
 * `sizes` is a FIXED list, not a dynamic parameter. …
 * `labels` lives in the row rather than in a lookup table beside it, so adding
 * a preset stays a single edit.
 */
export const IMAGE_PRESETS = {
  product: { sizes: [400, 800, 1600], labels: ["thumb","card","detail"], fit: "cover", ratio: 1, format: "webp" },
  …
  /**
   * The D-07 Phase-4 slot (ONB-03). Unused in Phase 3 — do NOT delete it as
   * dead code; its existence is the contract that the logo upload adds data
   * rather than a second implementation of this file.
   */
  logo: { sizes: [128, 512], labels: ["small","large"], fit: "contain", ratio: 1, format: "webp",
          background: { r: 0, g: 0, b: 0, alpha: 0 } },
} as const;

export type ImagePresetName = keyof typeof IMAGE_PRESETS;
```

`SECTION_TYPES` is this shape: `as const` object + `keyof typeof` type export.

---

### `src/server/theming/schema.ts` (validation, transform)

**Analog for the Zod idiom:** `src/server/payments/actions.ts` lines 54–74.
**Analog for the module header + pure-module discipline:** `src/server/orders/state-machine.ts` lines 62–70.

**No marker line.** This is the one `src/server/**` module that must carry **neither**
`import "server-only"` **nor** `"use server"` — `preview-canvas.tsx` (a client component)
imports `pageDocumentSchema` to validate the `postMessage` payload. Record that in the
header, in the codebase's all-caps warning voice, or a later reader will "fix" it:

```
/**
 * ---------------------------------------------------------------------------
 * THIS FILE DELIBERATELY CARRIES NO `server-only` MARKER. DO NOT ADD ONE.
 * ---------------------------------------------------------------------------
 * `src/app/s/[slug]/preview/preview-canvas.tsx` is a client component and it
 * MUST validate the postMessage payload with `pageDocumentSchema` before any
 * state update (Pitfall 4). A `server-only` import here breaks that build.
 * There are no secrets and no data access in this file — it is Zod and nothing
 * else, which is precisely why the marker is unnecessary as well as harmful.
 */
```

**Zod style** — schemas are module-level `const`s near their consumer, and validation that
carries merchant-facing copy lives in the handler, not in the schema (`payments/actions.ts`
lines 54–74):

```ts
/**
 * Every number field arrives as free text, deliberately.
 * …
 * Validation therefore lives in the handler rather than in the schema, so each
 * refusal carries the A6 copy from `strings.paymentSettings` instead of a Zod
 * default no one wrote.
 */
const savePaymentSettingsSchema = z.object({
  whatsappNumber: z.string(),
  …
  codEnabled: z.boolean(),
});
```

**Exhaustive-switch discipline for `SectionRenderer`** — the reason the discriminated union
beats a `Record` registry is stated in the codebase already (`state-machine.ts` lines 62–70):

```ts
/**
 * `Readonly<Record<OrderState, …>>` and NOT a lookup-with-default: a seventh
 * enum member must be a COMPILE error at this table. A
 * `Partial<Record<…>>`-plus-`?? []` shape would instead make the new state
 * silently terminal — legal-looking, untested, and discovered by a merchant
 * whose order will not move.
 */
```

---

### `src/server/theming/queries.ts` (service read, request-response)

**Analog:** `src/server/storefront/queries.ts` — same marker, same "reads only, tenantId is
never client-supplied" header, same `scopedDb(tenantId)` body.

**Imports + header** (lines 1–18):

```ts
import "server-only";

import { scopedDb } from "@/server/db/tenant-scoped";

import type { StoredCart } from "../cart/cache";

/**
 * What an anonymous visitor may see — as distinct from
 * `src/server/catalog/queries.ts` …
 *
 * Every export here is a plain read behind `scopedDb(tenantId)` — there is no
 * write in this file, and no caller may pass anything the client supplied as
 * `tenantId`; it always comes from `resolveTenantBySlug`.
 */
```

**Read body** (lines 101–115) — note relative `./` imports for same-domain siblings and
`@/server/...` for cross-domain:

```ts
export async function listStorefrontProducts(
  tenantId: string,
  categorySlug?: string,
): Promise<StorefrontProductListItem[]> {
  const db = scopedDb(tenantId);

  const products = await db.product.findMany({
    where: { active: true, ...(categorySlug ? { category: { slug: categorySlug } } : {}) },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, … },
  });
```

> **Phase-4 delta (Pitfall 9/11):** `getPublishedStorefront` must use `safeParse` +
> registry-default fallback + `console.error`, and must contain **no write**. The
> degrade-with-a-loud-log precedent already exists at
> `src/server/entitlements/resolve.ts` lines 128–134:
> ```ts
> if (org.planTier !== null && !isPlanTier(org.planTier)) {
>   console.error(
>     `SUB-01 degraded: organization ${org.id} has unknown planTier ` +
>       `"${org.planTier}"; falling back to starter limits.`,
>   );
> }
> ```
> Copy that message shape verbatim (`EDIT-01 degraded: tenant …`), including the tenant id
> and *excluding* any storage key or URL (T-03-27).

---

### `src/server/theming/actions.ts` (service write, CRUD)

**Analog:** `src/server/payments/actions.ts` — the closest module in the repo: a `"use server"`
file whose single write is a tenant-scoped `upsert` behind `merchantAction({ mode: "write" })`
on a one-row-per-tenant model.

**Imports** (lines 1–11):

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { strings } from "@/lib/strings";
import type { MerchantPaymentSettingsCreateInput } from "@/server/db/model-inputs";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";
import { merchantAction } from "@/server/merchant/action";
```

**The "no trial check, no tenant id" header** (lines 43–52) — reproduce this block, adapted:

```
 * ---------------------------------------------------------------------------
 * NO TRIAL CHECK AND NO TENANT ID LIVE IN THIS HANDLER.
 * ---------------------------------------------------------------------------
 * `mode: "write"` IS the read-only gate — re-checking it here would create a
 * second place for D-08 to drift. And the schema below accepts five strings and
 * a boolean and nothing else, so there is no field a direct POST could set to
 * retarget the write: the target is `ctx.tenantId`, resolved from the session
 * before this handler runs, and `scopedDb` stamps both halves of the upsert
 * (T-03-42).
```

**The scoped upsert** (lines 186–192) — exactly the shape `ensureStorefrontSeeded` /
`saveBranding` need, including the comment that names why `scopedCreateData` is required:

```ts
// The single-field unique on `tenantId` makes this a direct upsert, and
// `scopedDb` stamps both `where` and `create`.
await scopedDb(ctx.tenantId).merchantPaymentSettings.upsert({
  where: { tenantId: ctx.tenantId },
  create: scopedCreateData<MerchantPaymentSettingsCreateInput>(data),
  update: data,
});
```

**Typed action construction** — `merchantAction`'s `R` must be *named*, it cannot be inferred
(`src/server/images/actions.ts` lines 68–96):

```ts
/**
 * What a successful mint hands back.
 *
 * `merchantAction`'s success arm is `{ ok: true } & R`, and `R` appears only in
 * the handler's return position, so TypeScript cannot infer it from the config
 * object — it has to be named.
 */
export type ProductImageUploadGrant = { uploadUrl: string; key: string; uploadId: string };

export const requestProductImageUpload = merchantAction<
  typeof requestProductImageUploadSchema,
  ProductImageUploadGrant
>({
  mode: "write",
  schema: requestProductImageUploadSchema,
  handler: async (ctx, { contentType, byteSize }) => { … return { ok: true as const, … }; },
});
```

**`revalidatePath` after a write that a Server Component above the form renders**
(`payments/actions.ts` lines 214–217) — `publishStorefront` needs the same, or the publish-bar
status line stays stale:

```ts
// The nothing-configured alert lives in the Server Component above the
// form, so without this the merchant saves their first number and the
// "customers can't check out" alert stays on screen until a hard reload.
revalidatePath("/dashboard/settings/payment");
```

---

### `src/server/entitlements/plans.ts` (M) — `PlanLimits.storefrontEditor`

**Analog:** itself. Slot the new key beside `editorSections` and follow the doc-comment
convention exactly — every key states *where it is enforced* (lines 41–77):

```ts
export interface PlanLimits {
  readonly members: number;
  readonly products: number | null;
  /** ENFORCED FROM PHASE 4 (EDIT-03, editor sections). Registered now. */
  readonly editorSections: number | null;
  /** ENFORCED IN v2 (COM-V2-01, discount codes). Registered now. */
  readonly discountCodes: boolean;
  /** ENFORCED IN v2 (COM-V2-03, bulk product import). Registered now. */
  readonly bulkImport: boolean;
}
```

> **Phase-4 delta:** `editorSections`'s comment is now stale (D-05 fixes the section list for
> every tier). Rewrite it to say `null` on all tiers is the permanent answer — do **not**
> delete the key (Phase 2 D-07 registered it on purpose, and the `PLANS` table above
> documents the same reasoning at lines 96–102).

---

### `src/server/entitlements/resolve.ts` (M) — `canEditStorefront`

**Analog:** itself, `canWrite`. This is the **D-15 trap**: `plan` is computed from
`org.planTier` alone and trial state touches only `canWrite`, so a `can(ctx, "storefrontEditor")`
gate would refuse a Starter merchant on trial day 2.

**The field to mirror** (lines 88–90 and 150):

```ts
  /** D-08. The single boolean every write path consults. */
  readonly canWrite: boolean;
```

```ts
  const subscribed = org.subscriptionStatus === "active";
  const expired = !subscribed && now.getTime() >= endsAt.getTime();
  …
  return {
    …
    canWrite: subscribed || !expired,
  };
```

Add, in the same return object and with the same "derive, don't store" discipline (this file
reads no clock — `now` is a parameter, lines 16–21):

```ts
  /** EDIT-03. D-15: an ACTIVE trial grants this regardless of tier. */
  readonly canEditStorefront: boolean;
```

> `MerchantEntitlements = Omit<MerchantContext, "userId">` (lines 92–107) means the new field
> propagates automatically — no edit needed in `context.ts`'s spread.

---

### `src/server/entitlements/assert.ts` (M) — `EditorLockedError` + `assertCanEditStorefront`

**Analog:** itself, `ReadOnlyError` / `assertCanWrite` (lines 48–59, 91–100). The paired
boolean/throw convention is stated in this file's own header (lines 5–20) — read it first.

```ts
/**
 * D-08: the trial has ended without a subscription, so the dashboard is
 * read-only. Distinct from `EntitlementError` because the remedy is different —
 * subscribe, rather than upgrade tier — and the merchant must never be left
 * guessing which of the two just happened to them.
 */
export class ReadOnlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadOnlyError";
  }
}

/**
 * Write-time gate for the trial/subscription state (SUB-02). Every mutation
 * path is built on this — reads stay allowed, which is what makes D-08
 * read-only rather than a lockout.
 */
export function assertCanWrite(ctx: MerchantContext, message: string): void {
  if (!ctx.canWrite) {
    throw new ReadOnlyError(message);
  }
}
```

Also note the header's binding rule: **both errors take a caller-supplied message** —
`strings.editor.starterViewOnly`, never a message composed here (lines 21–25).

**Decide the `instanceof` question deliberately.** `merchantAction`'s catch (lines 115–123)
converts exactly two types; anything else becomes a 500:

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

Recommended: `class EditorLockedError extends EntitlementError` — it *is* an entitlement
refusal, it inherits the `feature` field (assert.ts lines 38–46), and `action.ts` needs no
edit. **Note:** `EntitlementError` sets `this.name = "EntitlementError"` in its constructor,
so the subclass must re-assign `this.name = "EditorLockedError"` after `super(...)` — the
codebase's stated rule is that a transpiled subclass otherwise logs the wrong type.

---

### `src/server/merchant/context.ts` (M) — the `/onboarding/branding` rung

**Analog:** itself, line 116. Add exactly one line beneath it, with the same comment shape:

```ts
    // D-05: the plan pick is mandatory, and this is the gate that enforces it.
    // The plan screen and `selectPlan` are deliberately outside this wrapper —
    // routing them through it would loop the merchant on the surface that fixes
    // exactly this state.
    if (org.planTier === null) redirect("/onboarding/plan");
```

`industry` must be added to `MERCHANT_COLUMNS` (lines 67–76) for the check to compile — that
block's own comment says a new column has to be added there deliberately:

```ts
const MERCHANT_COLUMNS = {
  id: true, name: true, slug: true, status: true,
  createdAt: true, planTier: true, trialEndsAt: true, subscriptionStatus: true,
} as const;
```

> **Trap:** `resolveEntitlements`'s `OrgRow` (resolve.ts lines 50–59) is a *structural* type.
> Adding `industry` to `MERCHANT_COLUMNS` without adding it to `OrgRow` is fine (excess
> properties are allowed); adding it to `OrgRow` without a fixture update breaks
> `tests/unit/entitlements.test.ts`. Prefer reading `org.industry` for the redirect only and
> leaving `OrgRow` untouched.

---

### `src/app/api/upload/finalize/route.ts` (M) — accept `kind: "logos"`

**Analog:** itself. Two hardcoded lines change and nothing else.

**Current schema** (lines 84–87) and the `ctx.canWrite` re-check that must survive (lines 121–130):

```ts
const finalizeSchema = z.object({
  uploadId: z.string(),
  kind: z.literal("products"),
});
```

```ts
  /*
   * The trial gate, restated deliberately (D-08 / SUB-02). `merchantAction`
   * enforces it for the mint step, but this is a Route Handler and the wrapper
   * does not reach it — and a Route Handler is every bit as reachable by direct
   * POST as a Server Action. …
   */
  if (!ctx.canWrite) {
    return fail("read_only", 403);
  }
```

**Current preset call** (line 170) — this is Pitfall 7, the one line that must become a
server-side map, never `parsed.data.kind` cast to a preset name:

```ts
    derived = await processImage(original, "product");
```

The route's header already anticipates this phase (lines 55–64): *"Phase 4's ONB-03 logo will
write an organization field. Coupling storage to one schema here would make each of those a
modification of this file."* — so **do not** add a DB write here; `saveBranding` persists
`StorefrontTheme.logoKey` from the response's `storageKey`.

---

### `src/server/images/actions.ts` (M) — `requestLogoUpload`

**Analog:** itself. Add a **sibling**, do not parameterise the existing action — its header
(lines 17–34) is explicit about why the client may not name a namespace:

```ts
/**
 * ---------------------------------------------------------------------------
 * THIS ACTION IS REACHABLE BY DIRECT POST, SO THE SCHEMA IS THE TRUST BOUNDARY.
 * ---------------------------------------------------------------------------
 * … the schema below is the exhaustive list of things a browser is permitted to
 * influence, and it contains neither a tenant id, nor a key, nor a path, nor
 * the name of the file being uploaded. …
 */
```

**The body to clone** (lines 96–117), changing only `"products"` → `"logos"`:

```ts
  handler: async (ctx, { contentType, byteSize }) => {
    if (!isAllowedContentType(contentType)) {
      return { ok: false as const, error: { contentType: [UNSUPPORTED_TYPE_MESSAGE] } };
    }

    const uploadId = crypto.randomUUID();
    const key = objectKeyFor(ctx.tenantId, "products", uploadId);
    const uploadUrl = await presignUpload(key, contentType, byteSize);

    return { ok: true as const, uploadUrl, key, uploadId };
  },
```

---

### `src/server/images/pipeline.ts` (M) — per-preset `enhance`

**Analog:** itself. The registry gets a boolean column; the chain (lines 148–164) becomes
conditional on it. The chain-order comment (lines 108–129) is load-bearing — `.rotate()` stays
first and unconditional:

```ts
    const { data, info } = await sharp(input, { limitInputPixels: LIMIT_INPUT_PIXELS })
      .rotate()
      .resize(size, size, {
        fit: spec.fit,
        ...(spec.fit === "cover" ? { position: "attention" } : {}),
        ...(background ? { background } : {}),
      })
      .normalise()
      .modulate({ saturation: SATURATION_BOOST })
      .sharpen()
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
```

---

### `src/app/onboarding/branding/page.tsx` (page RSC, request-response)

**Analog:** `src/app/onboarding/plan/page.tsx` — the most recently built onboarding step.
Copy its shape end to end.

**Imports + metadata + the "identity from the session only" header** (lines 1–29):

```tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { strings } from "@/lib/strings";
import { auth } from "@/server/auth/auth";
import { platformDb } from "@/server/db/platform";
import { PLAN_TIERS, PLANS } from "@/server/entitlements/plans";

import { PlanPicker, type PlanCard } from "./plan-picker";

/**
 * `/onboarding/plan` — the mandatory step between signup and the storefront …
 *
 * A server component wrapping one client island. The heading, the subline and
 * all three cards' content ship as HTML, so the merchant reads a real pricing
 * page before the picker's JavaScript arrives — which matters on the low-end
 * Android this market runs on.
 *
 * IDENTITY COMES FROM THE SESSION AND NOWHERE ELSE. This route reads no search
 * parameter and no route parameter …
 */

export const metadata: Metadata = { title: strings.plan.title };
```

**The redirect ladder** (lines 77–110) — `/onboarding/branding` needs the same four rungs, and
its "already done" branch is the absolute redirect to the storefront:

```tsx
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) redirect("/onboarding/create-store");

  const organization = await platformDb.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true, planTier: true },
  });
  if (!organization) redirect("/onboarding/create-store");

  if (organization.planTier !== null) {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "einort.com";
    // Their storefront is a different host, so this is an absolute redirect.
    // `http` locally, `https` everywhere a real root domain is configured.
    const protocol = rootDomain.startsWith("localhost") ? "http" : "https";
    redirect(`${protocol}://${organization.slug}.${rootDomain}`);
  }
```

> **Two required edits, not one.** (a) `/onboarding/plan`'s branch above must now redirect to
> `/onboarding/branding` when `industry === null`, or a merchant who bounces back skips
> branding forever. (b) The `rootDomain` / `protocol` expression is the **exact** builder the
> editor's iframe URL must reuse (Pitfall 12) — `NEXT_PUBLIC_ROOT_DOMAIN` via a literal
> `process.env` read, never `window.location.host`.

**Page chrome** (lines 128–143) — copy verbatim, changing only `max-w-5xl` → `max-w-2xl`:

```tsx
    <main className="flex flex-1 flex-col items-center px-4 py-16 sm:px-8">
      <div className="w-full max-w-5xl">
        {/* Heading role: 24px / 600 / 1.2 */}
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.plan.heading}
        </h1>

        {/* Body role: 16px / 400 / 1.5 */}
        <p className="mt-2 text-base leading-normal font-normal text-muted-foreground">
          {strings.plan.subline}
        </p>

        <PlanPicker plans={plans} />
      </div>
    </main>
```

---

### `src/app/onboarding/branding/branding-form.tsx` (client island)

**Analog (upload leg):** `src/app/(dashboard)/dashboard/products/image-gallery-field.tsx` —
the working three-step reference. Copy `runUpload` structurally; change only `FINALIZE_KIND`.

**The endpoint constants** (lines 93–101):

```tsx
/** The finalize endpoint. `kind` is what scopes it to this surface. */
const FINALIZE_ENDPOINT = "/api/upload/finalize";
const FINALIZE_KIND = "products";

/**
 * The derivative rendered in a tile — the mid-size square from the `product`
 * preset in `src/server/images/pipeline.ts`.
 */
const TILE_DERIVATIVE = "card.webp";
```

**The three-step sequence** (lines 271–326) — every failure branch is `patch(id, { status: "failed" })`,
never a thrown error:

```tsx
  async function runUpload(id: string, file: File) {
    patch(id, { status: "uploading" });

    if (!ACCEPTED_CONTENT_TYPES.includes(file.type)) {
      patch(id, { status: "failed" }); return;
    }

    const grant = await requestProductImageUpload({ contentType: file.type, byteSize: file.size });
    if (!grant.ok) { patch(id, { status: "failed" }); return; }

    /*
     * The header must be byte-for-byte the signed value. R2 compares it against
     * the signature, so `image/JPEG` here is a 403 blamed on storage and caused
     * three lines above.
     */
    const stored = await fetch(grant.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!stored.ok) { patch(id, { status: "failed" }); return; }

    const finalized = await fetch(FINALIZE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId: grant.uploadId, kind: FINALIZE_KIND }),
    });
    if (!finalized.ok) { patch(id, { status: "failed" }); return; }

    const result = readFinalizeResult(await finalized.json());
    if (result === null) { patch(id, { status: "failed" }); return; }

    patch(id, {
      status: "ready",
      previewUrl: `${imageBaseUrl}/${result.storageKey}/${TILE_DERIVATIVE}`,
      storageKey: result.storageKey, width: result.width, height: result.height,
    });
  }
```

> For the logo, `TILE_DERIVATIVE` becomes `small.webp` or `large.webp` (the `logo` preset's
> labels, `pipeline.ts` line 68), and the single-image field replaces the entries array.
> `image-gallery-field.tsx` line 104's note applies here too: the content-type allowlist is a
> **courtesy mirror** of `ALLOWED_UPLOAD_CONTENT_TYPES`, never the authority.

**The same component is also the analog for the editor's `image` field kind** — one
implementation, two call sites, per § Don't Hand-Roll.

---

### `src/app/(dashboard)/dashboard/storefront-editor/page.tsx` (page RSC)

**Analog:** `src/app/(dashboard)/dashboard/products/page.tsx`.

**Imports + the two headers that must be reproduced** (lines 1–62):

```tsx
import type { Metadata } from "next";
…
import { strings } from "@/lib/strings";
import { limitFor } from "@/server/entitlements/assert";
import { requireMerchantContext } from "@/server/merchant/context";

/**
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireMerchantContext()` is not inherited from `(dashboard)/layout.tsx` —
 * that file's own header explains why a Next 16 layout cannot be the gate.
 * Every page under `(dashboard)/` calls the DAL itself; `React.cache()` makes
 * the repeat call free.
 *
 * ---------------------------------------------------------------------------
 * THE DISABLED CTA AND THE ALERT ARE COURTESY ONLY (SUB-01).
 * ---------------------------------------------------------------------------
 * `src/server/catalog/actions.ts` `createProduct` is reachable by a POST that
 * never loaded this page, and it re-counts and refuses independently. Nothing
 * rendered here is the control.
 */

export const metadata: Metadata = {
  // Renders as "Products · EINORT" through the root layout's template.
  title: strings.products.title,
};
```

The second block transposes exactly onto D-13: the disabled `Save`/`Publish` buttons are
courtesy; `assertCanEditStorefront` inside `saveDraft`/`publishStorefront` is the control.

---

### `src/components/app-sidebar.tsx` (M) — the `Storefront` item

**Analog:** itself. Insert one `NavItem` between Products and Orders (lines 90–122):

```tsx
const NAV_ITEMS: readonly NavItem[] = [
  { href: OVERVIEW_HREF,        label: strings.dashboard.nav.overview, icon: LayoutDashboard },
  { href: "/dashboard/products", label: strings.dashboard.nav.products, icon: Package },
  { href: "/dashboard/orders",   label: strings.dashboard.nav.orders,   icon: ShoppingBag },
  { href: "/dashboard/claims",   label: strings.dashboard.nav.claims,   icon: Banknote, badged: true },
  …
];
```

Note the header's binding constraint (lines 54–66): **`badged` must stay `undefined`** for the
new item — gold's two-use budget is spent and `tests/unit/dashboard-nav.test.ts` counts it.

The paired edit is `REQUIRED_HREFS` in `tests/unit/dashboard-nav.test.ts` (lines 49–63), whose
own comment says it is the contract:

```ts
/**
 * The six destinations the rail must offer, in 03-UI-SPEC.md's order.
 *
 * This list is the contract. Adding a dashboard route means adding it here and
 * in the rail, in that order …
 */
const REQUIRED_HREFS = [
  "/dashboard", "/dashboard/products", "/dashboard/orders",
  "/dashboard/claims", "/dashboard/plan", "/dashboard/settings/payment",
] as const;
```

**`section-list.tsx` also mirrors this file** for the selected-row treatment — `isActive` +
`aria-current` + `h-auto min-h-11` (lines 156–178), and the header's "colour is never the only
signal" rule (lines 42–52) is exactly why the selected section row needs `aria-current="true"`
alongside the `border-l-2 border-primary` rule.

---

### `src/app/s/[slug]/layout.tsx` (M) — brand-token injection

**Analog:** itself. The `data-surface="storefront"` div (lines 56–68) is where the `style`
object lands. Ban #1 passes only because the values are variables:

```tsx
  return (
    <div data-surface="storefront" className="flex min-h-full flex-1 flex-col">
      {children}
      <Toaster />
    </div>
  );
```

The header (lines 38–55) is the statement of *why* this file is the only legal home for the
attribute — extend it, do not replace it:

```
   * The corollary is the rule: reaching for a palette utility (`bg-zinc-50`,
   * `text-slate-900`) anywhere under this tree is never necessary and is exactly
   * the retrofit this attribute exists to prevent. `tests/unit/
   * surface-token-isolation.test.ts` fails the build if one appears — there and
   * on the merchant side both.
```

---

### `src/app/globals.css` (M) — `--brand-accent*` + motion tokens

**Analog:** itself. The gold pair is the exact wiring precedent (lines 33–34 and 101–102):

```css
@theme inline {
  …
  --color-gold-accent-foreground: var(--gold-accent-foreground);
  --color-gold-accent: var(--gold-accent);
  …
}
```

```css
  /*
   * The brand gold is a *separate* token, not a repoint of --accent. shadcn's
   * --accent is the neutral hover slot every ghost/outline button reads from;
   * pointing it at gold would turn every hover in the app gold. …
   */
  --gold-accent: oklch(0.767 0.139 91.1); /* gold-500 */
  --gold-accent-foreground: oklch(0.359 0.067 91); /* gold-900 */
```

The storefront scope block (line 156 onward) carries the "five tokens are excluded on purpose"
header (lines 142–155) — the new `--brand-accent*` fallbacks go **inside** that block, and the
same header must be extended to record that they are declared there and nowhere else (D-12).

> `oklch(...)` literals are legal in `.css` — ban #1 scans `.tsx` under `src/app` and
> `src/components` only. The five hex defaults still belong in `src/lib/theme-defaults.ts`.

---

### `src/app/s/[slug]/page.tsx` (M) → `product-grid-section.tsx`

**Analog:** itself. The grid, category chips, tile, out-of-stock badge and currency formatter
move wholesale into the section component. Lift these verbatim and re-token them per UI-SPEC:

**Currency** (lines 52–56) — the storefront formatter, not the plan page's:

```tsx
const currency = new Intl.NumberFormat("fr-CM", {
  style: "currency",
  currency: "XAF",
  maximumFractionDigits: 0,
});
```

**Category chips** (lines 111–142) — note **origin-relative hrefs** and the
`bg-primary`→`bg-brand-accent` swap the UI-SPEC mandates for the selected chip:

```tsx
        {categories.length >= 2 && (
          <nav aria-label={strings.catalog.allCategories} className="mb-4 flex gap-2 overflow-x-auto pb-2">
            <Link href="/" className={cn(
                "shrink-0 rounded-full border border-border px-3 py-1.5 text-sm leading-snug font-semibold tracking-[0.08em] uppercase",
                !categorySlug ? "bg-primary text-primary-foreground" : "bg-background text-foreground",
              )}>
              {strings.catalog.allCategories}
            </Link>
            {categories.map((category) => ( <Link href={`/?category=${category.slug}`} … /> ))}
          </nav>
        )}
```

**Tile** (lines 144–192) — `next/image` + `publicUrlFor(prefix + "/card.webp")` + the D-09
dim-not-hide rule; only the aspect changes (`aspect-square` → `aspect-[4/5]`):

```tsx
              <div className="relative aspect-square overflow-hidden rounded bg-muted">
                {product.imageKey ? (
                  <Image
                    src={publicUrlFor(`${product.imageKey}/card.webp`)}
                    alt={product.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                    className={cn("object-cover",
                      // D-09: the image is dimmed, never the tile removed and
                      // never the link disabled.
                      !product.inStock && "opacity-60")}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
                    <ImageOffIcon className="size-8 text-muted-foreground" />
                  </div>
                )}
```

The page's own header (lines 21–44) already documents the Phase-4 handover — *"Phase 4's
Theme/Section/Block system replaces the RENDERED OUTPUT of the non-empty branch — the
zero-products branch, and its copy in `strings.storefront`, are not touched"* — and pins the
one-query rule. Preserve both.

---

### `src/app/s/[slug]/store-header.tsx` (M) — logo + translucency

**Analog:** itself (lines 18–72). Two changes: `bg-background` → `bg-background/80 backdrop-blur-sm`,
and the wordmark becomes a conditional logo `<Image>`. The link-prefix comment (lines 33–48) is
the canonical statement for the whole route tree and **must survive the edit**:

```tsx
      {/*
       * EVERY LINK IN THIS ROUTE TREE IS ORIGIN-RELATIVE. This is the canonical
       * statement for all of `src/app/s/[slug]/**` (quick task 260901-00j).
       * …
       * `tests/unit/storefront-link-prefix.test.ts` fails the build if the
       * prefix comes back. The fix for that failure is to make the link
       * origin-relative — NEVER to relax the `/s/` check in `src/proxy.ts`.
       */}
      <Link href="/" className="text-sm leading-snug font-semibold tracking-[0.08em] text-foreground uppercase">
        {storeName}
      </Link>
```

This applies to every new section CTA `href` and to the editor's `link` field validator, which
must reject a `/s/`-prefixed path with the UI-SPEC copy rather than accepting it.

---

### `tests/unit/theming-registry.test.ts` (source/registry drift)

**Analog:** `tests/unit/single-order-state-writer.test.ts` for the **non-vacuity guards** (the
most important part), `tests/unit/dashboard-nav.test.ts` for the contract-list idiom.

**Boilerplate** (lines 1–5, 37):

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
```

**The two non-vacuity tests every new contract test must carry** (lines 168–195) — this is the
repo's hardest rule for source-scanning tests, stated in the file header at lines 29–34:

```ts
describe("single Order.state writer", () => {
  it("actually scanned the source tree", () => {
    expect(existsSync(join(repoRoot, "src")),
      "src/ does not exist. This guard would then scan nothing and pass with zero coverage.",
    ).toBe(true);

    expect(scannedFiles.length,
      "No .ts files were found under src/. A vacuous pass is the one failure " +
        "mode a source-level guard must not have.",
    ).toBeGreaterThan(0);
  });

  it("still detects a state write in the sanctioned writer", () => {
    // The positive control. … If this fails, either the file
    // moved (update SANCTIONED_WRITER) or the matcher above no longer
    // recognises a state write, in which case the real test below is passing
    // over nothing.
    expect(allWrites.map((w) => w.file), `${SANCTIONED_WRITER} contains no detected …`)
      .toContain(SANCTIONED_WRITER);
  });
```

**Failure-message convention** (lines 202–218) — a failure names the rule, the reason, the fix,
and the wrong fix:

```ts
    expect(offenders.map((w) => `${w.file}:${w.line} — ${w.snippet}`),
      "ORD-05 violation — something other than " + `${SANCTIONED_WRITER} writes Order.state.\n` +
        "  Every state change must leave an OrderEvent naming who made it, in the SAME transaction. …\n" +
        "  Call `transitionOrder(tx, { orderId, to, actor, actorUserId })` instead. …\n" +
        "  If a genuinely new state-writing path is ever needed, it belongs " +
        `INSIDE ${SANCTIONED_WRITER}, not beside it.`,
    ).toEqual([]);
```

> `tests/unit/storefront-link-prefix.test.ts` lines 44–48 restates the same rule
> (*"IT MUST NOT PASS VACUOUSLY … Three guards below pin that files were really read"*) and
> lines 102–109 of `single-order-state-writer.test.ts` carry `stripCommentLines`, which any new
> source scan needs so that documenting a prohibition does not trip it.

---

### `tests/isolation/storefront-editor.test.ts` and `tests/isolation/branding.test.ts`

**Analog:** `tests/isolation/storefront-catalog.test.ts` (shape) + `tests/isolation/tenant-isolation.test.ts`
(the cross-tenant framing and the failure-reading note).

**Imports + `beforeEach`** (storefront-catalog lines 1–35):

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { scopedDb } from "@/server/db/tenant-scoped";
import { getStorefrontProduct, hydrateCart, listStorefrontProducts } from "@/server/storefront/queries";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * These are `isolation` (not `unit`) tests for the reason the seed fixture's
 * own header names: `scopedDb`'s tenant guarantee is a database property, not
 * a stub property …
 */

beforeEach(async () => {
  await seedTwoTenants();
});
```

**Cross-tenant assertion shape** (lines 37–48) — fixed fixture ids so a failure names the leak:

```ts
describe("listStorefrontProducts", () => {
  it("never returns another tenant's product", async () => {
    const productsA = await listStorefrontProducts(TENANT_A.id);

    expect(productsA.length).toBeGreaterThan(0);
    expect(productsA.every((p) => p.id !== `${TENANT_B.id}-product-1`)).toBe(true);
    expect(productsA.some((p) => p.id === `${TENANT_A.id}-product-1`)).toBe(true);
  });
```

**How to phrase the failure** (`tenant-isolation.test.ts` lines 32–36):

```
 * Reading a failure: `expected "tenant-b-fixed-id", received "tenant-a-fixed-id"`
 * means tenant A's data reached a tenant B caller. That is a production-severity
 * finding, not a flaky test.
```

**"Row survives, is not deleted" assertion** (storefront-catalog lines 50–70) — reuse this exact
shape for `discardDraft` (draft is *overwritten*, never deleted) and for publish atomicity:

```ts
    // Still there, just inactive — the same `scopedDb` read a merchant
    // product list uses. Deactivation, not deletion.
    const stillExists = await scopedDb(TENANT_A.id).product.findUnique({
      where: { id: `${TENANT_A.id}-product-1` },
      select: { id: true, active: true },
    });
    expect(stillExists).toEqual({ id: `${TENANT_A.id}-product-1`, active: false });
```

---

### `prisma/schema.prisma` (M) + `tenant-scoped.ts` (M) + `seed-two-tenants.ts` (M)

**This is one atomic three-part change** (Pitfall 6). All three analogs are in-file.

**Column doc-comment convention** (`schema.prisma` lines 121–129) — `///` triple-slash, states
the requirement id, the meaning of NULL, and the Better Auth `input: false` posture:

```prisma
  /// SUB-01 / D-05: the merchant's chosen tier, one of `PLAN_TIERS` in
  /// `src/server/entitlements/plans.ts`. NULL means "signed up, has not picked
  /// a plan yet" and is the ONE place a nullable enum-ish column is correct in
  /// this schema … Declared `input: false` in the
  /// Better Auth config, so no merchant can forge their own tier.
  planTier           String?
```

`Organization.industry` is the same shape and the same `input: false` obligation in
`src/server/auth/auth.ts`. **Note `Organization.logo` already exists at line 111** — Pitfall 5
says it is a Better Auth *core* field that `input: false` cannot protect, so the logo key goes
on `StorefrontTheme.logoKey`, not there.

**Registry insertion** (`tenant-scoped.ts` lines 44–66) — the order comment is binding:

```ts
/**
 * ORDER IS LOAD-BEARING, not alphabetical. `TENANT_SCOPED_MODELS` preserves
 * this insertion order, and `tests/setup/seed-two-tenants.ts` drives its single
 * batched `$transaction` off that iteration order. Postgres checks foreign keys
 * immediately rather than at commit, so a child row inserted before its parent
 * fails the whole fixture. … Re-sorting this array will break the seed.
 */
const REGISTERED_MODELS: readonly Prisma.ModelName[] = [
  "StoreSlugHistory", "Category", "Product", "ProductVariant", "ProductImage",
  "Order", "OrderItem", "OrderEvent", "PaymentClaim", "MerchantPaymentSettings",
];
```

`StorefrontTheme` and `StorefrontPage` have no FK parents — append them at the end beside
`MerchantPaymentSettings`.

**Fixture builders** (`seed-two-tenants.ts` lines 307–338) — `tenantId` is **never** set by a
builder; the loop appends it:

```ts
/**
 * Per-model row builders for the tenant-scoped registry.
 *
 * The seed loop is driven by `TENANT_SCOPED_MODELS`, not by this map, so
 * registering a model in Phase 3 without adding a builder here is a loud,
 * self-describing failure at seed time …
 *
 * `tenantId` is NOT set here — the loop appends it, so a builder cannot
 * accidentally cross-stamp a tenant.
 */
const MODEL_FIXTURES: Record<string, (tenant: TenantFixture) => Record<string, unknown>> = {
  StoreSlugHistory: (tenant) => ({
    id: `${tenant.id}-slug-history`, slug: tenant.slug,
    claimedAt: FIXTURE_EPOCH, releasedAt: null,
  }),
  …
```

Note the `FIXTURE_EPOCH` convention and the explicit-`updatedAt` note at lines 366–367 —
`@updatedAt` would otherwise break byte-identity between runs, which matters for the
`draftUpdatedAt > publishedAt` comparison. `StorefrontTheme` also needs
`singleRowPerTenant: true` in `tests/isolation/tenant-isolation.test.ts`'s `ModelProbe`
(lines 87–107), because `tenantId` is `@unique` on it — exactly like `MerchantPaymentSettings`.

---

## Shared Patterns

### 1. Module marker line — the first line, always

**Source:** `CLAUDE.md` § Import Organization; enforced structurally by `merchantAction`'s own header (`src/server/merchant/action.ts` lines 48–53)
**Apply to:** every new `src/server/**` file

```
 * `import "server-only"` and not `"use server"`: this module exports a FACTORY,
 * not an action. Every export of a `"use server"` module must be an async
 * function that Next can register as an endpoint, and a generic higher-order
 * function is not that. Callers put `"use server"` at the top of their own
 * action module and build the exported action with `merchantAction({ … })`.
```

| New file | Marker |
|---|---|
| `src/server/theming/registry.ts` | `import "server-only"` |
| `src/server/theming/defaults.ts` | `import "server-only"` |
| `src/server/theming/queries.ts` | `import "server-only"` |
| `src/server/theming/actions.ts` | `"use server"` (every export must be an async action) |
| `src/server/theming/schema.ts` | **neither** — client-importable, see above |
| `src/lib/contrast.ts`, `src/lib/theme-defaults.ts`, `src/lib/editor/reducer.ts` | none (`src/lib` is unmarked) |

> **Trap:** `defaults.ts` reads `registry.ts` and `strings`; if the preview client component
> ever needs defaults, they must be passed as props from the RSC, not imported.

### 2. The gated Server Action

**Source:** `src/server/merchant/action.ts` lines 66–124
**Apply to:** every export of `src/server/theming/actions.ts`

```ts
export function merchantAction<S extends z.ZodType, R>(config: {
  mode: "read" | "write";
  schema: S;
  handler: (ctx: MerchantContext, input: z.infer<S>) => Promise<ActionResult<R>>;
}) {
  return async (raw: unknown): Promise<ActionResult<R>> => {
    const ctx = await requireMerchantContext();

    if (config.mode === "write" && !ctx.canWrite) {
      return { ok: false, error: { form: [strings.trial.readOnlyBlocked] } };
    }

    const parsed = config.schema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
    }
    …
```

Three consequences for this phase, all from the header at lines 28–40:
1. `mode` is **required** — no default. `saveDraft` and `publishStorefront` are both `"write"`.
2. The handler never sees the raw payload, so **no theming schema may contain a `tenantId`**.
3. `assertCanEditStorefront` must **throw** inside the handler, not return — the boolean/throw
   pairing in `assert.ts` lines 5–20 explains why: *"a mutation whose only gate is `if (can(...))`
   has no gate at all when the caller drops the `if`."*

### 3. Tenant scoping on the new models

**Source:** `src/server/db/tenant-scoped.ts` lines 96–146
**Apply to:** `theming/queries.ts`, `theming/actions.ts`, both isolation tests

The `upsert` arm is what makes `ensureStorefrontSeeded` safe (lines 114–120):

```ts
            case "upsert":
              // Both halves, or the operation becomes a cross-tenant hijack:
              // `where` alone would let an upsert resurrect another tenant's
              // row, `create` alone would let a miss insert an unstamped one.
              a.where = { ...(a.where as object), tenantId };
              a.create = { ...(a.create as object), tenantId };
              break;
```

`$transaction` stays scoped (lines 150–183) — the `publishStorefront` two-row transaction
inherits the guarantee, and `tests/isolation/tenant-isolation.test.ts` already proves it.

`scopedCreateData<T>()` (lines 185–226) is **required** on both new models' `create` halves,
because tenant-scoped models declare `tenantId` required with no default.

### 4. Error classes

**Source:** `src/server/entitlements/assert.ts` lines 38–59
**Apply to:** `EditorLockedError`, `StorefrontNotSeededError`

```ts
export class EntitlementError extends Error {
  readonly feature: string;

  constructor(feature: string, message: string) {
    super(message);
    this.name = "EntitlementError";
    this.feature = feature;
  }
}
```

Per `CLAUDE.md` § Naming Patterns the canonical form is
`override readonly name = "ClassName"`; `assert.ts` uses the constructor-assignment variant.
**Match the file you are editing** — a new class inside `assert.ts` uses the constructor form.

### 5. Module header comments

**Source:** every non-trivial module; the densest exemplars are `src/server/merchant/action.ts`
lines 14–53 and `src/app/api/upload/finalize/route.ts` lines 12–72
**Apply to:** all 36 new files

The house form, in order:
1. One-line purpose naming the requirement/decision id (`EDIT-01`, `D-08`, `TMPL-02`).
2. ASCII-rule section dividers, `// ---------------------------------------------------------------------------`.
3. All-caps lead-ins for load-bearing warnings: `THIS PAGE AUTHORIZES ITSELF.`,
   `IT NEVER ACCEPTS A KEY (T-03-23).`, `ORDER IS LOAD-BEARING, not alphabetical.`
4. What was rejected and *why*, so it is not re-litigated (e.g. `finalize/route.ts` lines 55–64).
5. `/** … */` on every exported symbol, explaining the "why", never the "what".

Phase-4 headers that must exist verbatim-in-spirit, per RESEARCH:
- `theming/schema.ts` — "no `server-only` marker, deliberately".
- `theming/actions.ts` — "a route that can take money or change order state is never section-rendered" (Pattern 12).
- `theming/queries.ts` — "never writes (Pitfall 11), never throws on bad data (Pitfall 9)".
- `preview/page.tsx` — "no session and no token: this route serves only already-public data".

### 6. UI copy

**Source:** `src/lib/strings.ts` lines 1–33
**Apply to:** every `.tsx` in this phase

```ts
/**
 * Centralized user-facing copy.
 * …
 *   - One namespace per user-facing surface, named after its route.
 *   - Never inline a user-facing literal in a component; add it here first.
 *   - Copy must satisfy the voice contract in `01-UI-SPEC.md` § Copywriting
 *     Contract: direct, second person, no exclamation marks, no "Oops", no emoji.
 * …
 * Later plans extend this file: `signup` (01-07), `plan` (02-02). Do not
 * pre-populate a namespace before its surface exists.
 */

export const BRAND = "EINORT" as const;

export const strings = {
  /** `/` — root-domain placeholder (D-06). Not a marketing site. */
  root: { wordmark: BRAND, tagline: "Create your online store in minutes.", cta: "Create my store" },
```

New namespaces this phase: `branding`, `editor`, `flagship`, plus one key in
`dashboard.nav`. Existing namespaces are at `plan:` (line 236), `paymentSettings:` (line 897),
`storefront:` (line 66) — the last is reused unchanged for the product-grid empty state.

> **Multi-plan warning:** `strings.ts` is one 1220-line file and is the single most likely
> merge conflict if plans run in parallel waves. `src/server/images/actions.ts` lines 59–66
> records the precedent for the escape hatch (inline constant + a comment saying which plan
> owns lifting it) — but that is a *server-module* escape hatch only. A `.tsx` may never use
> it: the prose scan fails the build.

### 7. Surface-token isolation (the four bans)

**Source:** `tests/unit/surface-token-isolation.test.ts` lines 53, 164, 190, 214, 247, 272–277
**Apply to:** every new `.tsx` in `src/app/**` and `src/components/**`

```ts
const STOREFRONT_DIR = "src/app/s";
const STOREFRONT_SURFACE_ATTRIBUTE = /data-surface=["']storefront["']/;
```

| Ban | What fails | Phase-4 exposure |
|---|---|---|
| #1 | a literal colour value (`#rrggbb`, `oklch(`, `rgb(`, `hsl(`) in a component | the five default accents → `src/lib/theme-defaults.ts` |
| #2 | a Tailwind palette utility (`bg-zinc-50`, `text-slate-900`) | every ported section from the reference zip |
| #3 | `font-heading` / gold / `--success` under `src/app/s/**` | the flagship's display type must be `font-sans` |
| #4 | `data-surface="storefront"` outside `src/app/s/` | forces the preview iframe (Pattern 4) |

The `(dashboard)`-must-not-use-`brand-accent` assertion this phase adds mirrors ban #4's shape
at lines 272–277.

---

## No Analog Found

Four files are genuinely new territory. The planner should use `04-RESEARCH.md`'s code examples
as the body and **§ Shared Patterns 1, 4 and 5 above** as the style contract.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/editor/reducer.ts` | utility (pure) | transform | `src/lib/` contains only `strings.ts` (1220 lines of copy) and `utils.ts` (6 lines, `cn`). There is no pure-logic module in `src/lib/` at all. The nearest *behavioural* analogs live in `src/server/`: `src/server/orders/state-machine.ts` (pure predicate + exported table, unit-tested in the `node` project) and `src/server/catalog/variant-matrix.ts` (pure transform + typed errors). Copy their header voice, their `PascalCase` type names and their "this function takes `(a, b)` alone and that is what makes it exhaustively testable" rationale (state-machine.ts lines 105–116); copy nothing else. |
| `src/lib/contrast.ts` | utility (pure) | transform | Same. `04-RESEARCH.md` § Code Examples already supplies the full W3C-transcribed body; the only decisions left are the header (§ Shared Pattern 5) and keeping `CONTRAST_TEXT` / `CONTRAST_NON_TEXT` as `SCREAMING_SNAKE_CASE` module constants per `CLAUDE.md`. |
| `src/app/s/[slug]/preview/preview-canvas.tsx` | component (client) | pub-sub | No `postMessage` receiver, no cross-origin messaging and no iframe exists anywhere in the repo. `04-RESEARCH.md` § Code Examples supplies the body. The one in-repo convention that applies: validate at the boundary with Zod exactly as every Server Action does (`merchantAction` lines 92–101), and fail closed silently rather than throwing on a render path (`resolve.ts` lines 123–134). |
| `src/app/s/[slug]/sections/reveal.tsx` | component (client) | event-driven | No `IntersectionObserver`, no scroll-driven behaviour and no `useEffect`-based observer exists in the repo. `src/hooks/use-mobile.ts` (62 lines) is the only `matchMedia` precedent in the codebase and is the right file to read for the effect/cleanup idiom before writing this one. UI-SPEC § `<Reveal>` fixes every parameter. |

Two further files are **partial** analogs worth flagging so the planner does not over-trust the mapping:

- `src/app/(dashboard)/dashboard/storefront-editor/editor-shell.tsx` — no client island in this
  repo holds a `useReducer`; `image-gallery-field.tsx` uses `useState` + a `patch()` updater
  (lines 263–269), and `variant-matrix-field.tsx` (816 lines) is the largest client island but
  is form-state, not document-state. Take the *file organisation* from `image-gallery-field.tsx`
  (contract types at the top, constants, then the component) and the reducer itself from
  `src/lib/editor/reducer.ts`.
- `src/app/s/[slug]/sections/section-renderer.tsx` — no exhaustive `switch` over a discriminated
  union exists yet; `state-machine.ts`'s `Readonly<Record<Enum, …>>` is the same *drift-detection
  intent* expressed as a table rather than a switch. Its lines 62–70 are the rationale to cite.

---

## Metadata

**Analog search scope:** `src/app/**`, `src/server/**`, `src/components/**`, `src/lib/**`, `src/hooks/**`, `prisma/`, `tests/unit/**`, `tests/isolation/**`, `tests/setup/**`
**Files scanned:** 197 source files (45,471 lines, excluding `src/generated/**`)
**Files read in full or in targeted ranges:** 27
**Pattern extraction date:** 2026-09-01
