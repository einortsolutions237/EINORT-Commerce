# Phase 2: Merchant Auth, Entitlements & Trial - Pattern Map

**Mapped:** 2026-08-17
**Files analyzed:** 31 (23 new, 8 modified)
**Analogs found:** 28 / 31

Sources for the file list: `02-CONTEXT.md` (D-01…D-13 + addendum), `02-RESEARCH.md` § "Recommended Project Structure" (lines 263-297), § "Wave 0 Gaps" (lines 1184-1193), `02-UI-SPEC.md` § Copywriting Contract (route headings).

---

## File Classification

### New files

| New file | Role | Data flow | Closest analog | Match quality |
|----------|------|-----------|----------------|---------------|
| `src/app/login/page.tsx` | page (RSC shell) | request-response | `src/app/signup/page.tsx` | **exact** |
| `src/app/login/login-form.tsx` | component (client island) | request-response | `src/app/onboarding/create-store/create-store-form.tsx` | **exact** |
| `src/server/auth/login.ts` | service (server action) | request-response | `src/server/auth/signup.ts` (`createStoreForCurrentUser`) | **exact** |
| `src/app/onboarding/plan/page.tsx` | page (RSC shell + guard) | request-response | `src/app/onboarding/create-store/page.tsx` | **exact** |
| `src/app/onboarding/plan/plan-picker.tsx` | component (client island) | request-response | `src/app/signup/signup-form.tsx` | **exact** |
| `src/server/merchant/context.ts` | service (DAL) | request-response | `src/server/tenant/resolve.ts` + `src/server/db/platform.ts` | **role-match** |
| `src/server/merchant/action.ts` | utility (action wrapper) | request-response | `src/server/auth/signup.ts` (parse + result union) | **role-match** |
| `src/server/merchant/actions.ts` | service (server actions) | CRUD | `src/server/auth/signup.ts` (`createStoreForCurrentUser`) | **exact** |
| `src/server/entitlements/plans.ts` | config (registry) | transform | `src/server/db/tenant-scoped.ts` (`TENANT_SCOPED_MODELS`) + `src/server/tenant/reserved-slugs.ts` | **role-match** |
| `src/server/entitlements/resolve.ts` | utility (pure resolver) | transform | `src/server/tenant/slug.ts` / `src/server/tenant/host.ts` | **role-match** |
| `src/server/entitlements/assert.ts` | utility (guard) | transform | `src/server/db/tenant-scoped.ts` (throw-on-unregistered) | **role-match** |
| `src/app/(dashboard)/layout.tsx` | layout | request-response | `src/app/s/[slug]/layout.tsx` | **partial** (see note) |
| `src/app/(dashboard)/dashboard/page.tsx` | page | request-response | `src/app/onboarding/create-store/page.tsx` | **exact** |
| `src/app/(dashboard)/trial-banner.tsx` | component (RSC) | request-response | `src/app/onboarding/create-store/page.tsx` lines 80-84 (`Alert` block) | **role-match** |
| `src/app/(dashboard)/dashboard/plan/page.tsx` | page | request-response | `src/app/onboarding/create-store/page.tsx` | **exact** |
| `src/app/(dashboard)/dashboard/plan/plan-switch-form.tsx` | component (client island) | CRUD | `src/app/onboarding/create-store/create-store-form.tsx` | **exact** |
| `src/app/suspended/page.tsx` | page (static) | request-response | `src/app/store-not-found/page.tsx` | **exact** |
| `tests/unit/entitlements.test.ts` | test (unit) | transform | `tests/unit/slug.test.ts` | **exact** |
| `tests/unit/no-tenant-id-param.test.ts` | test (unit, source assertion) | batch | `tests/isolation/model-registry-drift.test.ts` | **role-match** |
| `tests/isolation/merchant-context.test.ts` | test (integration) | request-response | `tests/isolation/signup.test.ts` | **exact** |
| `tests/isolation/login.test.ts` | test (integration) | request-response | `tests/isolation/signup.test.ts` | **exact** |
| `tests/isolation/read-only.test.ts` | test (integration) | CRUD | `tests/isolation/signup.test.ts` | **exact** |
| `tests/isolation/org-endpoints.test.ts` | test (integration, raw HTTP) | request-response | `tests/isolation/signup.test.ts` | **exact** |
| `tests/isolation/trial.test.ts` | test (integration) | CRUD | `tests/isolation/signup.test.ts` | **exact** |

### Modified files

| Modified file | Role | Data flow | Pattern source (in-file precedent) | Match quality |
|---------------|------|-----------|-----------------------------------|---------------|
| `prisma/schema.prisma` (`Organization`) | model | — | its own `status` field, lines 114-119 | **exact** |
| `src/server/auth/auth.ts` | config | event-driven | its own `status` additionalField (170-191) + `beforeCreateOrganization` (193-224) | **exact** |
| `src/server/rate-limit.ts` | utility | request-response | its own `createLimiter` / `signupLimiter` (87-158) | **exact** |
| `src/lib/strings.ts` | config (copy) | — | its own `signup` / `createStore` namespaces (87-168) | **exact** |
| `src/app/signup/signup-form.tsx` | component | request-response | its own `onSubmit` redirect, line 98 | **exact** |
| `src/app/onboarding/create-store/create-store-form.tsx` | component | request-response | its own `onSubmit` redirect, line 66 | **exact** |
| `src/proxy.ts` | middleware (proxy) | request-response | its own `switch (result.kind)` block, lines 87-107 | **exact** |
| `eslint.config.mjs` | config | — | its own "Sanctioned zone" block, lines 81-90 | **exact** |

**Note on `src/app/(dashboard)/layout.tsx`:** `src/app/s/[slug]/layout.tsx` is the closest structural analog (async layout, awaits a resolver, gates), but its *authorization* behaviour must **not** be copied. RESEARCH.md Anti-Patterns (line 689) and Pitfall 2 are explicit: a Next 16 layout is not a security boundary. Copy the file shape and the "no try/catch, fail closed" comment discipline; put the authoritative check in each `page.tsx` via `requireMerchantContext()`. The dashboard layout may call the DAL for *data* (the trial banner) only.

---

## Pattern Assignments

### `src/server/merchant/context.ts` (service — the merchant DAL, request-response)

**Analog:** `src/server/tenant/resolve.ts` (React.cache + `platformDb` read + fail-closed) and `src/server/db/platform.ts` (why `platformDb`, not `scopedDb`).

**Module header + `React.cache` import pattern** — `src/server/tenant/resolve.ts` lines 1-6:
```ts
import "server-only";

import { cache } from "react";

import { platformDb } from "@/server/db/platform";
```
`import "server-only"` is the first line of every `src/server/**` module in this repo (`auth.ts:1`, `rate-limit.ts:1`, `platform.ts:1`, `tenant-scoped.ts`, `resolve.ts:1`). Vitest already aliases the package (`vitest.config.ts` header comment), so this costs nothing in tests.

**Fail-closed doc-comment discipline** — `src/server/tenant/resolve.ts` lines 21-25:
```ts
 * Fail-closed is the whole contract. There is no default tenant, no "probably
 * this one" branch, and no status treated as active-by-omission. Anything that
 * is not a live, active organization resolves to `null`, and `null` renders the
 * one branded not-found body (D-04/D-05).
```
Mirror this for the DAL: no default tenant, no parameter, no "probably this org".

**Session read + redirect guard (the exact shape to copy)** — `src/app/onboarding/create-store/page.tsx` lines 40-63:
```tsx
const session = await auth.api.getSession({ headers: await headers() });

// Not signed in: this surface has nothing to offer an anonymous visitor, and
// the only way to get an account is the signup form.
if (!session) redirect("/signup");

const existing = await platformDb.organization.findFirst({
  where: { members: { some: { userId: session.user.id } } },
  select: { slug: true },
});
```
Two things to carry over verbatim: `headers: await headers()` (never a hand-parsed cookie — 01-06 deviation 1), and a narrow `select` rather than a row spread.

**Narrow-select DTO discipline** — `src/server/tenant/resolve.ts` lines 34-40:
```ts
export type ResolvedTenant = {
  id: string;
  slug: string;
  name: string;
  status: string;
};
```
Declare an explicit exported result type; do not return the Prisma row type (that would also drag `@/generated/prisma` into a directory outside the lint sanctuary — see Shared Patterns § Lint zones).

**Why `platformDb` and not `scopedDb`** — `src/server/db/platform.ts` lines 5-27 (read this comment before writing the DAL):
```ts
/**
 * Narrow reads and writes on the **non**-tenant-scoped registry tables.
 * ... `organization` ... has no `tenantId` column and therefore cannot go
 * through `scopedDb` — that would throw, correctly, because `Organization` is
 * not a tenant-scoped model. It IS the tenant.
 */
export const platformDb = {
  get organization() { return prismaBase.organization; },
  ...
} as const;
```
`platformDb.organization` is already exposed — **no edit to `platform.ts` is required** for the plan/trial read.

---

### `src/server/auth/login.ts` (service — server action, request-response)

**Analog:** `src/server/auth/signup.ts` — specifically `createStoreForCurrentUser` (lines 362-416) for the shape and `signUpMerchant` (lines 56-137) for the Better Auth call + error handling.

**Imports + `"use server"` header** — `src/server/auth/signup.ts` lines 1-15:
```ts
"use server";

import { applySetCookies } from "better-auth/cookies";
import { headers } from "next/headers";
import { z } from "zod";

import { strings } from "@/lib/strings";
import { platformDb } from "@/server/db/platform";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";
import { callerIp, signupLimiter } from "@/server/rate-limit";
import { invalidateTenantHost } from "@/server/tenant/cache";
import { storeNameFromSlug, storeSlugSchema } from "@/server/tenant/slug";
import type { Prisma } from "@/generated/prisma/client";

import { auth } from "./auth";
```
Import ordering is enforced: node/external → `@/` aliases → `type` imports → relative. Copy it.

**Zod v4 schema + result union** — `src/server/auth/signup.ts` lines 32-45:
```ts
const signupSchema = z.object({
  // Zod 4 top-level form. The v3 `z.string().email()` chain still exists but is
  // deprecated, and this project is v4-only (C-9).
  email: z.email(),
  password: z.string().min(8).max(128),
  storeName: z.string().trim().min(2).max(80),
  slug: storeSlugSchema,
});

export type SignUpMerchantResult =
  | { ok: true; slug: string }
  | { ok: false; error: Record<string, string[]> };
```

**Parse-failure branch (`z.flattenError`, not v3 `.flatten()`)** — lines 59-68:
```ts
const parsed = signupSchema.safeParse(input);
if (!parsed.success) {
  return {
    ok: false,
    error: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
  };
}
```

**Mutable header copy + rate limit before any write** — lines 77-88:
```ts
const requestHeaders = new Headers(await headers());

const { success } = await signupLimiter.limit(callerIp(requestHeaders));
if (!success) {
  return { ok: false, error: { form: [strings.signup.rateLimited] } };
}
```
For login, RESEARCH.md Pattern 6 says the throttle must ALSO exist at the Better Auth HTTP layer (`rateLimit.customStorage`) because `/api/auth/sign-in/email` is reachable without the action. Do both.

**Better Auth error-code extraction (do not pattern-match messages)** — lines 47-54:
```ts
/** Better Auth signals failures as `APIError`; the code lives on `body.code`. */
function apiErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const body = (error as { body?: unknown }).body;
  if (typeof body !== "object" || body === null) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}
```
Login catches `INVALID_EMAIL_OR_PASSWORD` here. **Do not add a second message** — RESEARCH.md line 639 verified all four failure paths return the same code deliberately (anti-enumeration). Map every auth failure to one string.

**Better Auth call with `returnHeaders` (needed if login must chain a follow-up authenticated call)** — lines 95-126:
```ts
signUp = await auth.api.signUpEmail({
  body: { email, password, name: storeName },
  headers: requestHeaders,
  returnHeaders: true,
});
...
const setCookie = signUp.headers.get("set-cookie");
if (setCookie) applySetCookies(requestHeaders, [setCookie]);
```
Login needs this only if the action reads the session it just created. Otherwise `nextCookies()` handles persistence on its own.

**Session-derived identity comment block to reuse** — lines 355-358:
```ts
 * IDENTITY COMES FROM THE SESSION AND NOWHERE ELSE (T-01-49). The input schema
 * accepts a slug and nothing more — no user id, no organization id — so there
 * is no field an attacker could set to provision a store onto someone else's
 * account. A caller who forges extra keys has them dropped by the parse.
```

---

### `src/server/merchant/actions.ts` (service — `selectPlan` / `switchPlan`, CRUD)

**Analog:** `src/server/auth/signup.ts` lines 362-416 (`createStoreForCurrentUser`).

**Idempotence-not-authorization guard** (reuse for "plan already chosen" on `/onboarding/plan`) — lines 395-405:
```ts
/**
 * Idempotence, not authorization: `organizationLimit: 1` already refuses a
 * second store ... A merchant who double-submits, or who lands here from a
 * stale tab after the store was created, should simply be sent to the store
 * they already have.
 */
const existing = await platformDb.organization.findFirst({
  where: { members: { some: { userId } } },
  select: { slug: true },
});
if (existing) return { ok: true, slug: existing.slug };
```
RESEARCH.md line 683 requires the same for `/onboarding/plan`: an already-chosen plan redirects to the storefront rather than erroring.

**Session-expired branch** — lines 379-383:
```ts
const session = await auth.api.getSession({ headers: requestHeaders });
if (!session) {
  // The page redirects unauthenticated visitors to /signup; reaching this
  // branch means the session expired between render and submit.
  return { ok: false, error: { form: [strings.signup.sessionExpired] } };
}
```
`strings.signup.sessionExpired` already exists (`src/lib/strings.ts:147`) — reuse it, do not add a duplicate.

**D-06 note:** the plan-switch action must be built through `merchantAction({ mode: "write", ... })`, and (per CONTEXT OQ-3) must refuse when `trial.state === "expired"` — which `mode: "write"` gives for free via `ctx.canWrite`.

---

### `src/server/merchant/action.ts` (utility — the `merchantAction` write-gate wrapper)

**Analog:** `src/server/auth/signup.ts` (result union + `safeParse` + `flattenError`, excerpted above) — this wrapper generalises exactly that idiom. RESEARCH.md line 152 explicitly forbids introducing `next-safe-action`: seven plans and 186 tests depend on the plain `{ ok, error }` union.

**Structural guard idiom to copy from `src/server/db/tenant-scoped.ts`:** the module throws for an unregistered model rather than passing through. RESEARCH.md line 161 applies the same reasoning here — export both a boolean `can(...)` for rendering and a throwing `assertEntitlement(...)` for writes, so "forgot to check the return value" is not a silent bypass.

**Required config shape** (RESEARCH.md lines 502-525 — treat as the spec):
- `mode: "read" | "write"` is **required, never defaulted**.
- The handler receives `(ctx, parsedInput)` only — no raw request, so no tenant id can be read from it.
- Write refusal returns `{ ok: false, error: { form: [strings.trial.readOnlyBlocked] } }` — an in-place message, not a redirect (D-08: the merchant stays on the page).

---

### `src/server/entitlements/plans.ts` (config — the plan registry)

**Analog:** `src/server/db/tenant-scoped.ts` (`TENANT_SCOPED_MODELS` as a `readonly` const registry whose incompleteness is a compile error) and `src/server/tenant/reserved-slugs.ts` (a pure, data-only, dependency-free module).

**The `as const` + `Readonly<Record<K, V>>` idiom** — RESEARCH.md line 417 states the rule explicitly: `Record<PlanTier, …>` makes adding a fourth tier a compile error at every incomplete table, matching the `TENANT_SCOPED_MODELS: readonly Prisma.ModelName[]` drift-detection property.

**Copy/enforcement split (load-bearing)** — RESEARCH.md line 419:
> Prices are enforcement inputs and belong in code; the per-tier bullet lists D-02 asks for are user-facing copy and belong in `strings.ts` (C-14). Keeping them apart is what stops a copy revision from silently changing a limit.

**Numbers are pre-decided** — CONTEXT addendum OQ-1/OQ-2: `membershipLimit` (inclusive of the owner) is Starter=1, Business=4, Professional=11. Source data: `.planning/phases/02-merchant-auth-entitlements-trial/pricing-reference.md`.

**Constraint:** this file must import nothing from `@/generated/prisma*` — `src/server/entitlements/**` is outside the lint sanctuary (see Shared Patterns).

---

### `src/server/entitlements/resolve.ts` + `assert.ts` (utility — pure, no I/O)

**Analog:** `src/server/tenant/slug.ts` / `src/server/tenant/host.ts` — pure, exported-constant-driven modules with unit tests in `tests/unit/`.

**Message-constants-live-with-the-schema pattern** — `src/server/tenant/actions.ts` lines 71-81:
```ts
/**
 * Compared against the exported constant rather than sniffing for the
 * substring "reserved". Both work today, but the constant is the actual
 * contract with `@/server/tenant/slug` — a copy change that drops the word
 * would silently downgrade every reserved hostname to the generic
 * `invalid` state, and nothing would fail.
 */
return { status: message === SLUG_RESERVED_MESSAGE ? "reserved" : "invalid", message };
```
Apply the same discipline to `TRIAL_DAYS` and the D-12 urgency threshold: export a named constant, never a magic number duplicated in the banner component.

**`now` must be a parameter** (RESEARCH.md line 466) — that single choice is what makes day-1 / day-9 / day-10-boundary / day-11 testable in the fast `unit` project with no clock mocking. `src/server/tenant/host.ts` has the same property (pure function of its inputs) and is why `tests/unit/host.test.ts` needs no fixtures.

**Structural type, no Prisma import:** `resolveEntitlements` takes an `OrgRow` interface it declares itself (RESEARCH.md Pitfall 12, line 800).

---

### `src/app/login/page.tsx` (page — RSC shell)

**Analog:** `src/app/signup/page.tsx`. Copy essentially the whole file, swapping the namespace.

**Metadata** — lines 22-25:
```tsx
export const metadata: Metadata = {
  // Renders as "Create your store · EINORT" via the root layout's template.
  title: strings.signup.title,
};
```

**Page shell + Card overrides (do not re-author the Card)** — lines 27-57:
```tsx
export default function SignupPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16 sm:px-8">
      <div className="w-full max-w-md">
        {/* Heading role: 24px / 600 / 1.2 */}
        <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.signup.heading}
        </h1>

        {/* Body role: 16px / 400 / 1.5 */}
        <p className="mt-2 text-base leading-normal font-normal text-muted-foreground">
          {strings.signup.subline}
        </p>

        <Card className="mt-8 rounded-lg border border-border bg-muted ring-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
          <CardContent>
            <SignupForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
```
`02-UI-SPEC.md` line 381 names this file as the construction reference for `/login` and `/suspended`.

**Guard-then-render page variant** (for `/onboarding/plan`, `/dashboard/*`) — `src/app/onboarding/create-store/page.tsx` lines 39-63 (excerpted above under the DAL). For `/onboarding/plan` the guard is: no session → `/login`; no `activeOrganizationId` → `/onboarding/create-store`; `planTier !== null` → storefront origin.

**Cross-origin redirect helper (already written)** — `src/app/onboarding/create-store/page.tsx` lines 57-63:
```tsx
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "einort.com";
const protocol = rootDomain.startsWith("localhost") ? "http" : "https";
redirect(`${protocol}://${existing.slug}.${rootDomain}`);
```

---

### `src/app/login/login-form.tsx` · `plan-picker.tsx` · `plan-switch-form.tsx` (client islands)

**Analog:** `src/app/onboarding/create-store/create-store-form.tsx` (closest — small form, session-derived identity) and `src/app/signup/signup-form.tsx` (two-field version with email + password).

**Client island imports** — `create-store-form.tsx` lines 1-18:
```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";
import { createStoreForCurrentUser } from "@/server/auth/signup";
```

**Form setup (Base UI + RHF directly, no shadcn `<Form>` — C-15)** — `signup-form.tsx` lines 54-74:
```tsx
const form = useForm<SignupFormValues>({
  resolver: zodResolver(signupFormSchema),
  mode: "onBlur",
  defaultValues: { email: "", password: "", slug: "" },
});

const { control, formState: { errors, isSubmitting }, setError, setValue } = form;

/**
 * `useWatch` rather than `form.watch(...)`: the latter returns a function the
 * React Compiler cannot memoize safely, which opts this whole component out
 * of compilation. `useWatch` is a subscription and re-renders on exactly the
 * same changes.
 */
const slugValue = useWatch({ control, name: "slug" }) ?? "";
```
RESEARCH.md Pitfall 13 (line 804) warns these four React-Compiler rules WILL recur on the login form and plan picker. Lint runs at `--max-warnings=0`.

**Submit + server-error mapping (copy verbatim, change field names)** — `signup-form.tsx` lines 76-113:
```tsx
const onSubmit = form.handleSubmit(async (values) => {
  setFormError(null);

  const result = await signUpMerchant({ ... });

  if (result.ok) {
    setRedirecting(true);
    window.location.assign(storeOrigin(result.slug));
    return;
  }

  // Field-scoped errors land on their field and mark it aria-invalid;
  // whole-form errors render in the destructive alert above the form.
  for (const [field, messages] of Object.entries(result.error)) {
    const message = messages?.[0];
    if (!message) continue;
    if (field === "email" || field === "password" || field === "slug") {
      setError(field, { type: "server", message });
    } else {
      setFormError(message);
    }
  }
});

const busy = isSubmitting || redirecting;
```

**REDIRECT DIVERGENCE — the one place NOT to copy** (D-01, RESEARCH.md lines 659-664): `/onboarding/plan` is **same-origin apex**, so the plan picker must use `router.push("/onboarding/plan")` / `router.push("/dashboard")`. `window.location.assign` is reserved for the cross-origin storefront jump only. Keeping `window.location.assign` for an apex path throws away the client router and full-page-reloads the merchant mid-onboarding.

**Blocking error alert (never a toast)** — `signup-form.tsx` lines 117-132:
```tsx
{formError ? (
  /**
   * Above the form, and in the document flow: a blocking error the
   * merchant has to act on must not be able to disappear on a timer
   * (01-UI-SPEC.md § Error). The transient-notification library that
   * would make that mistake easy is deliberately not installed.
   */
  <Alert variant="destructive">
    <AlertCircle aria-hidden="true" />
    <AlertDescription className="text-destructive">{formError}</AlertDescription>
  </Alert>
) : null}
```

**Labelled field with aria wiring** — `signup-form.tsx` lines 136-155:
```tsx
<div className="flex flex-col gap-2">
  <Label htmlFor="email" className="text-sm leading-snug font-semibold">
    {strings.signup.emailLabel}
  </Label>
  <Input
    id="email"
    type="email"
    autoComplete="email"
    inputMode="email"
    className="min-h-11 bg-background"
    aria-invalid={errors.email ? true : undefined}
    aria-describedby={errors.email ? "email-error" : undefined}
    {...form.register("email")}
  />
  {errors.email ? (
    <p id="email-error" className="text-sm text-destructive">{errors.email.message}</p>
  ) : null}
</div>
```
For login, `autoComplete="current-password"` (not `"new-password"`, which `signup-form.tsx:168` uses).

**Submit button with pending state (`min-h-11` = the 44px touch floor)** — `signup-form.tsx` lines 200-213:
```tsx
<Button
  type="submit"
  disabled={fieldState.submitDisabled || busy}
  className="min-h-11 w-full px-6 text-sm font-semibold"
>
  {busy ? (
    <>
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      {strings.signup.ctaSubmitting}
    </>
  ) : (
    strings.signup.cta
  )}
</Button>
```

---

### `src/app/(dashboard)/layout.tsx` (layout)

**Analog:** `src/app/s/[slug]/layout.tsx` — **shape only, not the gate semantics.**

**Async layout signature + typed route props (Next 16: `params` is a Promise)** — lines 23-28:
```tsx
export default async function StorefrontLayout({ children, params }: LayoutProps<"/s/[slug]">) {
  // `params` is a Promise in Next 16.
  const { slug } = await params;
```
`LayoutProps<...>` is a Next-generated global — `npx next typegen` must run before `npm run typecheck` in a fresh worktree (RESEARCH.md Pitfall 15).

**Explicit "why the check lives here" comment** — lines 12-21. Write the **inverse** comment in the dashboard layout, citing RESEARCH.md Pitfall 2: this layout renders the trial banner from `requireMerchantContext()` as DATA; the authorization gate is in each `page.tsx`, because a Next 16 layout does not control whether child segments render.

**Also document the apex-only property** (RESEARCH.md line 297): `src/proxy.ts` rewrites any storefront subdomain's `/dashboard` to `/s/{slug}/dashboard`, where no route file exists → 404. State this in a comment so nobody "fixes" it later.

---

### `src/app/suspended/page.tsx` (page — static)

**Analog:** `src/app/store-not-found/page.tsx` (26 lines — a static branded body reading only from `strings`). Per CONTEXT OQ-5 the merchant-facing suspended surface must not silently let a suspended merchant operate normally; per `02-UI-SPEC.md` line 381 it uses the same `max-w-md` card construction as `/login`.

---

### `prisma/schema.prisma` — `Organization` (model)

**Analog:** the `status` field already in the same model.

**Hand-correction comment idiom** — lines 114-119:
```prisma
  // HAND-CORRECTED: emitted as `String?`. Made NOT NULL for D-05 — hostname
  // resolution branches on this value, and a NULL status is neither "active"
  // nor "suspended", so a row with one would resolve ambiguously. Declared
  // `input: false` in the Better Auth config, so it can never be set through
  // the public create/update API; suspension is a Phase 6 admin-only write.
  status      String       @default("active")
```
Every hand edit to a Better-Auth-generated block is annotated inline (schema header, lines 8-12). Annotate the four new columns the same way.

**Columns to add** (RESEARCH.md lines 544-571): `planTier String?`, `trialEndsAt DateTime?`, `subscriptionStatus String @default("none")`, `planSelectedAt DateTime?`.

**Do NOT touch `TENANT_SCOPED_MODELS`** — RESEARCH.md Pitfall 11 (line 794): `Organization` is the tenant and is deliberately absent from the registry. `tests/isolation/model-registry-drift.test.ts` only fires on a new `tenantId`-bearing model.

---

### `src/server/auth/auth.ts` (config — extended)

**Analog:** its own existing blocks.

**`input: false` additionalField (copy this comment structure for all four new fields)** — lines 170-191:
```ts
schema: {
  organization: {
    additionalFields: {
      /**
       * ... `input: false` keeps suspension a platform-admin-only write with
       * no public API surface (Phase 6) — otherwise a merchant could
       * un-suspend their own store by including `status` in an update
       * body. Same NOT NULL agreement as `platformRole` above: the column
       * is NOT NULL, and `defaultValue` is what satisfies it on insert.
       */
      status: {
        type: "string",
        input: false,
        required: false,
        defaultValue: "active",
      },
    },
  },
},
```

**`organizationHooks` — throw-or-void discipline** — lines 193-224:
```ts
organizationHooks: {
  /**
   * The AUTHORITATIVE layer of the three-layer TEN-06 defence (T-01-36).
   * ...
   * THROW-OR-VOID ONLY — never hand back a data object (T-01-37).
   */
  beforeCreateOrganization: async ({ organization: org }) => {
    const parsed = storeSlugSchema.safeParse(org.slug ?? "");
    if (!parsed.success) {
      throw new APIError("BAD_REQUEST", {
        message: parsed.error.issues[0]?.message ?? "Invalid store address.",
      });
    }
  },
},
```
`beforeUpdateOrganization`, `beforeDeleteOrganization`, `beforeCreateInvitation`, `beforeAddMember` all follow this exact form: validate, `throw new APIError(...)`, return nothing. `APIError` is already imported at line 5.

**Plugin-option comment style (cite the verified `node_modules` source)** — lines 142-166:
```ts
/**
 * No merchant can mint an extra store through the public API.
 * ... verified in this exact version at
 * `node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs`:
 *   const isSystemAction = !session && ctx.body.userId;
 */
allowUserToCreateOrganization: false,
organizationLimit: 1,
creatorRole: "owner",
```
`membershipLimit` (function form, importing from `PLANS`) goes in this same options block. RESEARCH.md line 616: express Starter as `1`, never `0` — `membershipLimit || 100` makes `0` silently become 100.

**`databaseHooks.session.create.before` already exists** (lines 100-138) and already back-fills `activeOrganizationId` on every login. **Do not rewrite it.** Its own comment (lines 105-107) says it is TEN-04 groundwork for Phase 2.

**Plugin ordering constraint** — lines 227-236: `nextCookies()` MUST stay the final element of the `plugins` array.

---

### `src/server/rate-limit.ts` (utility — extended)

**Analog:** its own `createLimiter` factory.

**Limiter interface** — lines 35-48:
```ts
/** The narrow surface callers depend on — keeps the degraded path type-identical. */
export interface RateLimiter {
  /** Upstash key namespace. Distinct per surface, by design. */
  readonly prefix: string;
  limit(identifier: string): Promise<{ success: boolean }>;
}

type LimiterSpec = {
  readonly prefix: string;
  readonly tokens: number;
  readonly window: `${number} ${"ms" | "s" | "m" | "h" | "d"}`;
  /** Named so the degradation warning can say which surface is unprotected. */
  readonly surface: string;
};
```

**New limiter declaration** — lines 147-158:
```ts
/**
 * Merchant signup (`signUpMerchant`).
 *
 * Much tighter at 5/minute: each success creates a user, a tenant and a
 * DNS-addressable hostname, and no legitimate visitor signs up twice (T-01-40).
 */
export const signupLimiter: RateLimiter = createLimiter({
  prefix: "rl:signup",
  tokens: 5,
  window: "1 m",
  surface: "merchant signup",
});
```
Add `rl:login` in exactly this form (C-11: one prefix per surface).

**Degradation contract — the non-negotiable part** — lines 24-33 and 111-128:
```ts
if (limiter === null) return { success: true };

try {
  const { success } = await limiter.limit(identifier);
  return { success };
} catch (error) {
  // Fail OPEN, loudly. An Upstash blip must not take signup offline ...
  console.warn(
    `[rate-limit] ${spec.prefix} transport failure; allowing the ` +
      `request. ${spec.surface} is momentarily unthrottled.`,
    error,
  );
  return { success: true };
}
```
RESEARCH.md line 651 requires the new Better Auth `rateLimit.customStorage` adapter to **mirror this same contract**: if Upstash is unconfigured, allow-all with one loud warning — never an in-process counter. Implement `consume` (the atomic path), not just `get`/`set`.

**Three-state memoization idiom** — lines 87-92 (`undefined` = not resolved, `null` = resolved-to-degraded). Reuse for the customStorage adapter's client resolution.

---

### `src/lib/strings.ts` (config — extended)

**Analog:** its own `signup` (lines 87-148) and `createStore` (lines 150-168) namespaces.

**Namespace rules (file header, lines 8-16):**
```
 *   - One namespace per user-facing surface, named after its route.
 *   - Never inline a user-facing literal in a component; add it here first.
 *   - Copy must satisfy the voice contract ... direct, second person, no
 *     exclamation marks, no "Oops", no emoji.
```

**Namespace + doc-comment shape** — lines 150-168:
```ts
/**
 * `/onboarding/create-store` — the recovery route for the one genuinely
 * non-atomic step in the phase.
 * ... It deliberately does NOT reuse `signup.provisioningFailed` — that string
 * ends "sign back in to finish", and the merchant reading this page is already
 * signed in, so repeating it would send them in a circle.
 */
createStore: {
  title: "Finish creating your store",
  heading: "Finish creating your store",
  notice: "...",
  cta: "Create my store",
  ctaSubmitting: "Creating…",
},
```

**Interpolation token idiom (needed for "X days left")** — lines 111-121:
```ts
/**
 * ... `{host}` is replaced with the full hostname the merchant would get ...
 * Kept as an interpolation token rather than string concatenation at the
 * call site so a later i18n pass can move the token, which languages with
 * different word order need.
 */
slugAvailable: "{host} is available.",
```
The trial banner copy must be `"{days} days left in your trial."`, not concatenated.

**Namespaces to add** (per `02-UI-SPEC.md` line 160): `login`, `plan`, `dashboard`, `trial`, `entitlements`, `suspended`. The D-02 per-tier feature bullet lists live here, **not** in `plans.ts`. The D-10 WhatsApp link (`https://wa.me/237686661578`, CONTEXT OQ-4) is copy, not config — RESEARCH.md line 726 says prefer a `strings.ts` constant over an env var.

**Currency formatting:** file header lines 24-27 — copy language is English, but money stays `Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF' })` with no decimals.

---

### `src/proxy.ts` (middleware — optional optimistic redirect)

**Analog:** its own `switch (result.kind)` block, lines 87-107.

**Two hard rules stated in the file header, lines 14-22:**
```
 *   1. **No I/O, no ORM, no cache client.** ...
 *   2. **No `runtime` config export.** Proxy is always the Node.js runtime in
 *      Next 16, and setting that option throws.
```
This forbids a real session lookup here. A cookie-presence redirect is the maximum, and it must be commented as "NOT a security boundary" (RESEARCH.md Pitfall 1 / line 690). The `case "root":` branch (lines 91-93) is where it goes. The comment at lines 88-90 already anticipates this: *"The apex serves D-06's placeholder plus D-07's signup, login, dashboard and `/api/auth/*`."*

---

### `eslint.config.mjs` (config — extended)

**Analog:** its own "Sanctioned zone" block, lines 81-90:
```js
// --- Sanctioned zone: the data-access layer itself ------------------------
// These modules are what the rest of the app is restricted *to*, so they must
// be able to import the base client to build the scoped clients on top of it.
{
  files: [
    "src/server/db/**",
    "src/server/tenant/**",
    "src/server/auth/**",
  ],
  rules: { "no-restricted-imports": "off" },
},
```
See Shared Patterns § Lint zones for when (and whether) to extend this.

---

### Test files

**Unit test analog:** `tests/unit/slug.test.ts` — for `tests/unit/entitlements.test.ts`.

**Header + imports + helper** — lines 1-28:
```ts
import { describe, expect, it } from "vitest";

import { RESERVED_SLUGS } from "@/server/tenant/reserved-slugs";
import { SLUG_FORMAT_MESSAGE, ... } from "@/server/tenant/host";
import { storeSlugSchema } from "@/server/tenant/slug";

/**
 * TEN-06 (form layer) — store-slug format and reserved-word rules.
 *
 * This is layer 1 of the three-layer reserved-slug defence ...
 */

const firstMessage = (input: string): string => { ... };
```
Every test file opens with a doc comment naming the requirement ID and the layer it covers. Nested `describe("accepts", …)` / `describe("rejects on length", …)` grouping (lines 30-60) maps directly onto the entitlements test names in `02-RESEARCH.md`'s test map (`"trial active"`, `"trial boundary"`, `"daysLeft"`, `"registry"`, `"member limit"`, `"urgency"`) — use those exact `-t` strings.

**Integration test analog:** `tests/isolation/signup.test.ts` — for all five new `tests/isolation/*.test.ts` files. RESEARCH.md line 1151: **reuse this harness rather than mocking Better Auth.**

**"Only three substitutions" doc block** — lines 21-38:
```
 *   next/headers   — there is no Next request scope in Vitest. The stand-in is
 *                    behaviour-accurate: `cookies()` returns a mutable jar ...
 *   rate limiters  — replaced with controllable verdicts so the ORDER of the
 *                    checks is assertable behaviourally ...
 *   invalidateTenantHost — wrapped in a spy that delegates to the real
 *                    implementation ...
 * Better Auth itself, Prisma, the slug schema, the reserved list, the
 * organization hooks and the resolver are all the real thing.
```

**Mutable cookie jar (copy verbatim)** — lines 45-65:
```ts
const { requestContext } = vi.hoisted(() => ({
  requestContext: {
    headers: new Headers(),
    cookies: new Map<string, { name: string; value: string }>(),
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => requestContext.headers,
  cookies: async () => ({
    get: (name: string) => requestContext.cookies.get(name),
    getAll: () => Array.from(requestContext.cookies.values()),
    has: (name: string) => requestContext.cookies.has(name),
    set: (name: string, value: string) => { requestContext.cookies.set(name, { name, value }); },
    delete: (name: string) => { requestContext.cookies.delete(name); },
  }),
}));
```

**Controllable limiter verdicts** — lines 71-88:
```ts
const { limitVerdict } = vi.hoisted(() => ({ limitVerdict: { slugCheck: true, signup: true } }));

vi.mock("@/server/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/rate-limit")>();
  return {
    ...actual,
    signupLimiter: { prefix: "rl:signup", limit: async () => ({ success: limitVerdict.signup }) },
  };
});
```
Add a `login` key for `tests/isolation/login.test.ts`.

**Post-mock dynamic imports (ordering is load-bearing)** — lines 107-111:
```ts
// Imported after the mocks so the modules under test pick them up.
const { checkStoreSlug } = await import("@/server/tenant/actions");
const { signUpMerchant } = await import("@/server/auth/signup");
const { auth } = await import("@/server/auth/auth");
```

**Two-tenant fixture (already exists, no new infrastructure)** — line 8:
```ts
import { seedTwoTenants, TENANT_A } from "../setup/seed-two-tenants";
```
This is what `tests/isolation/merchant-context.test.ts`'s cross-tenant assertion uses.

**Commands:** `npm run test:unit` per task commit; `npm run test:full` (`dotenv -e .env.test -- vitest run`) per wave. Baseline to preserve: **186 passing, 0 skipped**.

---

## Shared Patterns

### Module preamble (every `src/server/**` file)
**Source:** `src/server/auth/auth.ts:1`, `src/server/rate-limit.ts:1`, `src/server/db/platform.ts:1`, `src/server/tenant/resolve.ts:1`
**Apply to:** `src/server/merchant/context.ts`, `action.ts`, `src/server/entitlements/*.ts`
```ts
import "server-only";
```
Server Action files use `"use server";` as line 1 instead (`src/server/auth/signup.ts:1`, `src/server/tenant/actions.ts:1`). A file is one or the other, never both.

### Session-derived identity (TEN-04)
**Source:** `src/server/auth/signup.ts:355-358` + `:379-386`; `src/app/onboarding/create-store/page.tsx:23-27`
**Apply to:** every new server action, every dashboard page, `requireMerchantContext`
```ts
const session = await auth.api.getSession({ headers: requestHeaders });
if (!session) return { ok: false, error: { form: [strings.signup.sessionExpired] } };
const userId = session.user.id;
```
No exported function in `src/server/merchant/**` may take a tenant id parameter — `tests/unit/no-tenant-id-param.test.ts` asserts this at source level.

### Zod v4 validation + `{ ok, error }` result union
**Source:** `src/server/auth/signup.ts:32-68`
**Apply to:** `src/server/auth/login.ts`, `src/server/merchant/action.ts`, `src/server/merchant/actions.ts`
```ts
const parsed = schema.safeParse(input);
if (!parsed.success) {
  return { ok: false, error: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
}
```
C-9: `z.email()` not `z.string().email()`; `z.flattenError(err)` not `err.flatten()`.

### Rate limit before any work
**Source:** `src/server/tenant/actions.ts:39-66` (the ordering rationale) and `src/server/auth/signup.ts:79-88`
**Apply to:** `src/server/auth/login.ts`, plus the new Better Auth `customStorage` adapter
```ts
const requestHeaders = await headers();
const { success } = await slugCheckLimiter.limit(callerIp(requestHeaders));
if (!success) { /* ...limited response... */ }
```
> "RATE LIMIT FIRST — before parsing, before any database read. The ordering is the control, not an optimisation (T-01-39)." — `src/server/tenant/actions.ts:40-45`
The isolation suite asserts this ordering behaviourally, not by reading source.

### Better Auth error handling
**Source:** `src/server/auth/signup.ts:47-54` (`apiErrorCode`), `:199-227` (ask the DB, don't pattern-match the error)
**Apply to:** `src/server/auth/login.ts`, `src/server/merchant/actions.ts`
Read `error.body.code`. Never match on `error.message` — "the error shape it surfaces through is an implementation detail of two libraries, and matching on it would rot on a patch release" (`signup.ts:206-208`).

### Non-fatal failure = `console.error` and continue
**Source:** `src/server/auth/signup.ts:268-284`, `:306-314`, `:331-341`
**Apply to:** `src/server/merchant/actions.ts` (audit breadcrumbs like `planSelectedAt`)
Every swallowed error gets a `console.error` naming the requirement that is now degraded and what repair it needs. Never a bare `catch {}`.

### Copy centralisation (C-14)
**Source:** `src/lib/strings.ts:8-16`
**Apply to:** every new page, form, banner, and every server-returned message
No user-facing literal in JSX or in a server action. Add the namespace to `strings.ts` first.

### Lint zones — the one thing that will break the gate
**Source:** `eslint.config.mjs:41-90`
**Apply to:** `src/server/merchant/**`, `src/server/entitlements/**` (new directories, **outside** the sanctuary)

The default zone bans these import groups for everything under `src/`:
```js
{ group: ["**/server/db/base"],      message: "Use scopedDb(tenantId), platformDb, or adminDb." },
{ group: ["**/server/db/admin"],     message: "adminDb is only importable from src/server/admin/**." },
{ group: ["**/generated/prisma*"],   message: "Never import the generated client directly." },
```
The sanctuary is exactly `src/server/db/**`, `src/server/tenant/**`, `src/server/auth/**` (lines 83-89).

**Preferred fix (RESEARCH.md Pitfall 12):** design the new modules so they need no generated-client import — `resolveEntitlements` takes an `OrgRow` interface it declares itself, and the DAL returns its own exported `MerchantContext` type. Importing `platformDb` is fine from anywhere.
**If genuinely needed:** extend the `files:` array in `eslint.config.mjs` with a comment explaining why. **Never** a file-level `eslint-disable` — that removes the boundary silently and forever.

Also banned project-wide (lines 65-76): `$queryRaw` / `$executeRaw` via a `no-restricted-syntax` selector.

### React Compiler rules on client islands
**Source:** `src/app/signup/signup-form.tsx:67-74`, `:97-98`, `:186-192`
**Apply to:** `login-form.tsx`, `plan-picker.tsx`, `plan-switch-form.tsx`
Four rules bit plan 01-07 and will bite again (`npm run lint` is `--max-warnings=0`):
- `react-hooks/incompatible-library` → use `useWatch({ control, name })`, never `form.watch(name)`
- `react-hooks/immutability` → `window.location.assign(...)`, never `window.location.href = ...`
- `react-hooks/refs` → handlers on the JSX element composed over `registration.onChange`, not closures inside `form.register(name, {...})`
- `react-hooks/set-state-in-effect` → derive state, do not sync it in an effect

### Fresh-worktree setup (blocked 6 of 7 Phase 1 plans)
**Source:** RESEARCH.md Pitfall 15; `package.json` scripts
```
npm ci  →  cp -n .env.local.example .env.local && cp -n .env.test.example .env.test
        →  node scripts/prisma-generate.mjs
        →  npx next typegen        # LayoutProps/PageProps globals for typecheck
```
Regenerate the Prisma client after the `schema.prisma` change; the `postinstall` hook is unreliable in a fresh worktree.

---

## No Analog Found

| File | Role | Data flow | Reason |
|------|------|-----------|--------|
| Better Auth `rateLimit.customStorage` adapter (new export in `src/server/rate-limit.ts`) | utility | request-response | No existing code implements a Better Auth storage interface. The *degradation contract* has a strong analog (`rate-limit.ts:24-33, 111-128`) but the `{ get, set, consume }` shape does not exist in-repo. Use RESEARCH.md Pattern 6 (line 651) + Code Example 7 (line 990) as the spec; implement `consume` for atomicity. |
| `membershipLimit` function form in `auth.ts` | config (guard) | event-driven | No existing plugin option in the repo is a function. RESEARCH.md lines 618-629 give the verified implementation, including why Starter must be `1` and never `0`. |
| `src/app/(dashboard)/dashboard/plan/plan-switch-form.tsx` — the "switch during trial" write | component | CRUD | Structurally identical to `create-store-form.tsx`, but no existing form in the repo performs an *authenticated update to an existing tenant row*; every current form creates. The `merchantAction({ mode: "write" })` wrapper is what makes the difference, and it does not exist yet. |

---

## Metadata

**Analog search scope:** `src/app/**`, `src/server/**`, `src/lib/**`, `src/components/ui/**`, `prisma/**`, `tests/**`, `eslint.config.mjs`, `vitest.config.ts`, `package.json`
**Files scanned:** 60 source/test files (line counts enumerated); 16 read in full or targeted
**Pattern extraction date:** 2026-08-17
**Related phase docs:** `02-CONTEXT.md`, `02-RESEARCH.md`, `02-UI-SPEC.md`, `02-VALIDATION.md`, `pricing-reference.md`
