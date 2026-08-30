# Coding Conventions

**Analysis Date:** 2026-08-30

## Naming Patterns

**Files:**
- kebab-case for every `.ts`/`.tsx` file: `app-sidebar.tsx`, `order-state-chip.tsx`, `tenant-scoped.ts`, `variant-matrix.ts`, `store-address-field.tsx`, `no-tenant-id-param.test.ts`.
- Route segment folders use Next.js App Router conventions: `(dashboard)` route group, `[slug]` dynamic segment (`src/app/s/[slug]`), reserved files `page.tsx`, `layout.tsx`, `not-found.tsx`.
- Server-side domain modules are grouped under `src/server/<domain>/` with small, purpose-named files inside: `actions.ts` (mutations, `"use server"`), `queries.ts` (reads, `import "server-only"`), `errors.ts` (domain error classes), plus one file per narrow concern (`slug.ts`, `state-machine.ts`, `stock.ts`, `tracking-token.ts`).
- Test files mirror the unit under test by name, not by path: `tests/unit/state-machine.test.ts` tests `src/server/orders/state-machine.ts`; `tests/isolation/catalog.test.ts` tests the catalog write layer end-to-end. Static-analysis "contract" tests are named after what they assert, not what they touch: `no-tenant-id-param.test.ts`, `surface-token-isolation.test.ts`, `single-order-state-writer.test.ts`.

**Functions:**
- camelCase, verb-first for actions and mutations: `createProduct`, `setProductActive`, `signUpMerchant`, `assertCanWrite`, `resolveVariants`.
- Boolean-returning helpers read as predicates: `canTransition`, `isUniqueViolation`, `looksLikeProse`.
- Paired boolean/throw entitlement checks share a stem: `can` / `assertEntitlement`, `limitFor` (boolean-shaped) vs `assertCanWrite` (throwing). See `src/server/entitlements/assert.ts`.

**Variables:**
- camelCase throughout; `SCREAMING_SNAKE_CASE` reserved for true module-level constants that encode a rule or contract: `STARTER_PRODUCT_CAP`, `SUFFIX_ALPHABET`, `DEFAULT_TEST_ENDPOINTS`, `ORDER_TRANSITIONS`.
- Test fixtures use descriptive fixed identifiers instead of random ones on purpose (`tenant-a-fixed-id`, not `randomUUID()`), so a failing assertion names the leak directly. See `tests/setup/seed-two-tenants.ts`.

**Types:**
- PascalCase for types/interfaces: `MerchantContext`, `ActionResult<T>`, `TenantFixture`, `VariantCombination`.
- Domain error classes are PascalCase, always extend `Error`, and always set `override readonly name = "ClassName"` explicitly (a transpiled subclass otherwise reports `name: "Error"` in logs): `InvalidTransitionError`, `OutOfStockError`, `UnavailableItemError`, `AlreadyReviewedError`, `EntitlementError`, `ReadOnlyError`, `MissingTestDatabaseError`, `UnsafeSeedTargetError`.
- Discriminated-union result types are the standard shape for anything that can fail without throwing: `{ ok: true } & T | { ok: false; error: Record<string, string[]> }` (`ActionResult<T>` in `src/server/merchant/action.ts`).

## Code Style

**Formatting:**
- No Prettier config file is present in the repo (`.prettierrc*` absent). ESLint (flat config, `eslint.config.mjs`) plus `eslint-config-next` govern style. Match the two-space indentation and double-quote string style already present in every file rather than introducing a new formatter.

**Linting:**
- `eslint.config.mjs` extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`, then layers project-specific rules on top of them.
- `npm run lint` runs `eslint . --max-warnings=0` — CI/local gate treats warnings as failures.
- `no-unused-vars` is configured to ignore identifiers with a leading underscore (`argsIgnorePattern: "^_"`, `varsIgnorePattern: "^_"`, `caughtErrorsIgnorePattern: "^_"`). Use `_` prefix for an intentionally-unused parameter (commonly a hook argument reserved for a later phase).
- **Import-zone boundaries are enforced by lint, not convention** (`eslint.config.mjs`):
  - `src/**` may not import `**/server/db/base`, `**/server/db/admin`, or `**/generated/prisma*` directly. Use `scopedDb(tenantId)`, `platformDb`, or `adminDb` instead.
  - `src/server/db/**`, `src/server/tenant/**`, and `src/server/auth/**` are the sanctioned zone allowed to import the raw client (they build the scoped clients on top of it).
  - `src/server/admin/**` is a separate zone that may not import `**/server/db/tenant-scoped` (admin surface must not reuse tenant-scoped services).
  - `no-restricted-syntax` bans any `$queryRaw`/`$executeRaw*` call anywhere under `src/**` — raw queries bypass the tenant-scoping Prisma extension. The single sanctioned exception lives in `tests/setup/seed-two-tenants.ts` (outside `src/`) and is explicitly called out as the one raw-SQL statement in the repository.
- When adding a new server module that needs the unscoped client, put it inside one of the three sanctioned zones above rather than disabling the rule inline.

## Import Organization

**Order (observed consistently across the codebase):**
1. Node.js builtins (`node:crypto`, `node:fs`, `node:path`, `node:url`), blank line after.
2. External packages (`zod`, `sharp`, `vitest`, `@prisma/adapter-pg`, `next/headers`, `react-hook-form`), blank line after.
3. Internal `@/*`-aliased imports, blank line after.
4. Relative imports (`./queries`, `./slug`, `../setup/seed-two-tenants`), last, no trailing blank line before the code.

Example (`src/server/catalog/actions.ts`):
```ts
"use server";

import { randomBytes } from "node:crypto";

import { z } from "zod";

import { strings } from "@/lib/strings";
import type { CategoryCreateInput, ... } from "@/server/db/model-inputs";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";
import { limitFor } from "@/server/entitlements/assert";
import { merchantAction } from "@/server/merchant/action";

import { activeProductCount } from "./queries";
import { slugifyProductName } from "./slug";
```

**Path Aliases:**
- `@/*` maps to `./src/*` (`tsconfig.json`). Vitest does not read `tsconfig.json` paths, so the alias is re-declared per test project in `vitest.config.ts` (`resolve.alias`) — if you add a new path alias, update both files.
- `"use server"` and `import "server-only"` are mutually exclusive markers placed as the very first line of a file, before any import. `"use server"` marks a Server Actions module (every export must be an async function reachable as an endpoint); `server-only` marks a module that must never reach a client bundle (data-access, secrets-adjacent code). A factory module that builds actions for others (e.g. `src/server/merchant/action.ts`) uses `server-only`, not `"use server"`, because it exports a higher-order function, not an action itself.

## Error Handling

**Patterns:**
- Two parallel error-signaling styles, deliberately not mixed within one call path:
  - **Discriminated-union returns** (`ActionResult<T>`) for expected, user-facing validation/business-rule failures reachable from a form. `{ ok: false, error: Record<string, string[]> }` keyed by field name so a form can render the message beside the right input; the `form` key is the convention for a whole-submission error (e.g. read-only trial block, plan-limit reached).
  - **Thrown domain error classes** for failures that must roll back a Postgres transaction or that a caller is not required to specially handle. Everything under `src/server/orders/errors.ts` is thrown from inside `$transaction` callbacks specifically so the throw aborts partial writes — a function that instead returned `{ ok: false }` would leave the caller responsible for rollback, and a caller that forgot would commit a half-applied write.
- The single point where the two styles meet is `merchantAction()` (`src/server/merchant/action.ts`): it catches `ReadOnlyError` and `EntitlementError` and converts them into `{ ok: false, error: { form: [message] } }`; every other thrown error rethrows uncaught rather than being swallowed into a fake validation message (an unexpected error must stay an error, visible in logs).
- Domain errors carry structured fields (not just a message) so callers can branch programmatically: `OutOfStockError.variantId`, `InvalidTransitionError.from/to/channel/detail`. Prefer adding a field over parsing `error.message`.
- Recognize a Prisma unique-constraint violation via a duck-typed helper rather than importing the generated client (`isUniqueViolation` checks `error.code === "P2002"`), consistent with the "never import `@/generated/prisma*` directly" lint rule.
- Every Server Action built with `merchantAction()` runs entitlement/write-gate checks **before** parsing the payload and **before** touching the database, so a replayed or scripted POST from an expired trial costs nothing.

**Validation:**
- `zod` schemas validate every Server Action input. Schemas are defined near their action (module-level `const xSchema = z.object({...})`), not in a shared schema file, unless the same shape is also needed client-side — in which case the client schema imports/reuses the server one (`storeSlugSchema` reused verbatim in `signup-form.tsx`'s `signupFormSchema`) so client-time and server-time validation cannot disagree.
- Failed validation is surfaced via `z.flattenError(parsed.error).fieldErrors`.

## Logging

**Framework:** `console.warn`/`console.error`/`console.log` directly — no logging library.

**Patterns:**
- `console.warn` used for recoverable/degraded-path conditions worth surfacing but not failing the request (grepped usages are `vi.spyOn(console, "warn")`-tested in `tests/unit/cart.test.ts` and `tests/unit/tracking-token.test.ts`, meaning warn-path behavior is itself under test, not just fire-and-forget).
- `console.error` + `process.exitCode = 1` for CLI/script failure paths (`tests/setup/seed-two-tenants.ts` direct-invocation entry point).
- Error class `name` is always set explicitly so Vercel/console log lines show the real error type, not `Error`.

## Comments

**When to Comment:**
- Every non-trivial module opens with a substantial header comment explaining *why* the module exists, which requirement/decision ID it satisfies (e.g. `CAT-01`, `D-08`, `TEN-05`, `T-03-31` — cross-referenced against `.planning/` requirement and decision IDs), and what invariant it protects. This is the dominant style in the codebase — comments justify design decisions and warn against "obvious" wrong fixes, not restate what the code does.
- Section dividers use a consistent ASCII-line style:
  ```ts
  // ---------------------------------------------------------------------------
  // Section Name
  // ---------------------------------------------------------------------------
  ```
- All-caps sentence-lead-ins mark load-bearing warnings that must not be casually "fixed": `THIS FILE WRITES THROUGH AN UNSCOPED CLIENT ON PURPOSE. DO NOT "FIX" IT.`, `THREE SEPARATE CALLS, NEVER A NESTED create`, `POSITIONS ARE VACATED BEFORE THEY ARE REASSIGNED.`
- Comments frequently cite the specific decision/task ID that motivates a piece of logic (e.g. `D-08 forbids removal`, `T-03-30`, `SUB-01`) so a reader can trace code back to `.planning/` requirements.

**JSDoc/TSDoc:**
- `/** ... */` doc comments precede nearly every exported function, type, and class, explaining purpose and any non-obvious constraint — not auto-generated boilerplate, always specific to the "why."

## Function Design

**Size:** Functions are kept narrow and single-purpose; larger flows (e.g. `createProduct`, `updateProduct`) are broken into small named helpers (`resolveVariants`, `alignVariants`, `storedAxisNames`, `combinationKey`) rather than left as one long inline block, even though the top-level handler itself can span 100+ lines when it wraps a `$transaction`.

**Parameters:** Server Action handlers always receive `(ctx: MerchantContext, input: ParsedInput)` — never the raw untrusted payload, and never a tenant ID as a parameter (tenant ID comes only from `ctx`, resolved server-side from the session). See `tests/unit/no-tenant-id-param.test.ts`, which statically enforces this by scanning source for a `tenantId` parameter.

**Return Values:** Server Actions return `ActionResult<T>` (`{ ok: true, ...T } | { ok: false, error: Record<string,string[]> }`). Pure helpers return plain values or throw a typed error class — never a loosely-typed `{ success, message }` ad hoc shape.

## Module Design

**Exports:** Named exports throughout; no default exports observed in application code. One export per concern is preferred over a single object namespacing multiple actions.

**Barrel Files:** Not used. Each `src/server/<domain>/` module is imported directly by path (`@/server/catalog/actions`, `@/server/orders/state-machine`) rather than through an `index.ts` re-export.

**Domain module shape:** Within `src/server/<domain>/`, mutations (`"use server"`) and reads (`server-only`) are split into separate files (`actions.ts` vs `queries.ts`) because the two directives are mutually exclusive and reads may need to be called from places actions cannot reach (or vice versa).

## Project-Specific Rules (from CLAUDE.md, binding on all new code)

- **Tenant isolation is enforced structurally, not by convention.** Never call the raw Prisma client from `src/**` outside the sanctioned zones; always go through `scopedDb(tenantId)`, `platformDb`, or `adminDb`. Never trust a `tenantId`, price, stock, or order/payment status supplied by the client.
- **No hard deletes for merchant-owned catalog data (D-08).** "Remove from store" means `setProductActive(false)`, never a Prisma `delete`. Variant/image rows dropped from a product are marked inactive/parked, never removed, because an `OrderItem` may still reference them.
- **UI copy is centralized** in `src/lib/strings.ts`, one namespace per surface. Never inline a user-facing string literal in a component — `tests/unit/dashboard-nav.test.ts` and similar contract tests scan `.tsx` source for prose-shaped string literals and fail the build if one is found outside `strings`.
- **Sharp/image-processing code must run in the Node.js runtime**, never `export const runtime = "edge"`.
- **Currency/number formatting** uses `Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF" })` directly — no currency library.

---

*Convention analysis: 2026-08-30*
