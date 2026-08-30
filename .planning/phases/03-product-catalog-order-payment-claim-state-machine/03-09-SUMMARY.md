---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 09
subsystem: storefront
tags: [redis, upstash, nextjs-server-actions, prisma, cart, catalog, pdp, zinc-surface]

# Dependency graph
requires:
  - phase: 03-01
    provides: tenant-scoped Prisma query pattern, Product/ProductVariant/ProductImage/Category schema
  - phase: 03-02
    provides: resolveTenantBySlug, the data-surface="storefront" wrapper, surface-token-isolation bans
  - phase: 03-04
    provides: strings.catalog / strings.cart / strings.storefront copy
provides:
  - Anonymous, host-scoped, money-free cart (Redis-backed, 30-day TTL, opaque cookie)
  - Storefront read queries separated from merchant catalog queries (listStorefrontProducts, listStorefrontCategories, getStorefrontProduct, hydrateCart, cartLineCount)
  - The B1 catalog grid replacing the Phase-1 placeholder conditionally (zero-products branch preserved)
  - The B2 product detail page with variant pickers, stock line, quantity stepper and add-to-cart island
affects: [03-10, 03-11, 03-12, phase-4-theming]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Redis namespace ownership per module (C-11): cart/cache.ts owns cart: exclusively, mirroring tenant/cache.ts's tenant:host: ownership"
    - "Server-action-only cookie writes: only src/server/cart/actions.ts calls cookies().set for the cart; pages only get()"
    - "Storefront read model separated from merchant read model (storefront/queries.ts vs catalog/queries.ts) to keep visibility filters from drifting"
    - "Money never stored client-side or in Redis: StoredCart holds only variantId+quantity; hydrateCart recomputes every amount from the database on each read"

key-files:
  created:
    - src/server/cart/cache.ts
    - src/server/cart/actions.ts
    - src/server/storefront/queries.ts
    - src/app/s/[slug]/loading.tsx
    - src/app/s/[slug]/store-header.tsx
    - src/app/s/[slug]/p/[productSlug]/page.tsx
    - src/app/s/[slug]/p/[productSlug]/add-to-cart.tsx
    - tests/unit/cart.test.ts
    - tests/isolation/storefront-catalog.test.ts
  modified:
    - src/app/s/[slug]/page.tsx

key-decisions:
  - "No `domain` cookie option, matching RESEARCH.md's cross-tenant-leak warning verbatim: host-scoping to {slug}.einort.com is the isolation boundary, not an application-level check alone"
  - "StoredCart.tenantId mismatch discards the cart on read rather than erroring, so a cart cookie replayed on another merchant's storefront silently reads as empty"
  - "Zero-active-products branch of the B1 catalog page reuses the exact Phase-1 placeholder markup and strings.storefront copy rather than authoring a second empty state"
  - "D-09 out-of-stock tiles stay in the grid and remain clickable; only the CTA disables, never the link or the tile itself"

requirements-completed: [CHK-01]

# Metrics
duration: ~90min active work (session spanned 2026-08-25 to 2026-08-30 due to a session-limit disconnect and resume; wall-clock timestamps are not representative of active effort)
completed: 2026-08-30
---

# Phase 03 Plan 09: Anonymous Cart and Storefront Browse Pages Summary

**Redis-backed anonymous cart (opaque host-scoped cookie, money-free StoredCart shape) plus the B1 catalog grid and B2 product detail page, both reading through a storefront-only query module separate from the merchant catalog queries.**

## Performance

- **Duration:** ~90 min of active execution (session interrupted by a session-limit disconnect between Task 1's RED commit on 2026-08-25 and the resumed Tasks 1-3 completion on 2026-08-30; this SUMMARY was written during the resume/verification pass)
- **Started:** 2026-08-25T10:21:21+01:00 (RED test commit)
- **Completed:** 2026-08-30T05:50:00+01:00 (Task 3 commit)
- **Tasks:** 3 (all `type="auto"`; Task 1 also `tdd="true"`)
- **Files modified:** 10 (9 created, 1 rewritten)

## Accomplishments
- An anonymous shopper now has a durable cart: `src/server/cart/cache.ts` owns the `cart:` Redis prefix exclusively (C-11), degrades to a non-persistent no-op when Upstash is unconfigured or unreachable, and never throws.
- `src/server/cart/actions.ts` is the sole cart-cookie writer in the codebase — `addToCart`, `setCartQuantity`, `removeCartLine` — each tenant-scoping the requested variant through `scopedDb`, clamping quantity, and setting the cookie with `httpOnly`, `sameSite: "lax"`, and deliberately no `domain` option so one merchant's cart cookie is never sent to another merchant's storefront.
- `src/server/storefront/queries.ts` is a new, deliberately separate read model from `src/server/catalog/queries.ts`: it answers "what may an anonymous visitor see" (active-only, tenant-scoped) rather than "what does this merchant own," and `hydrateCart` recomputes every price/stock number from the database — the stored cart never supplies money.
- `src/app/s/[slug]/page.tsx` is now the B1 catalog grid, conditionally rendering the untouched Phase-1 placeholder when a store has zero active products (no second empty state authored) and the real grid otherwise, with D-09's out-of-stock tiles staying in the grid, still linkable, at `opacity-60` with an `Out of stock` chip.
- `src/app/s/[slug]/p/[productSlug]/page.tsx` and its `add-to-cart.tsx` client island deliver the B2 product detail page: gallery with thumbnail strip, D-05 variant chip pickers (disabled on stock-exhausted combinations), a live stock line, a quantity stepper clamped to available stock, and a CTA that is disabled with `Out of stock` at zero stock and `Choose an option` before a required axis is picked — never hidden.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing test for the anonymous cart** - `29783ab` (test)
2. **Task 1 (GREEN): Anonymous cart Redis namespace and mutation actions** - `2b04be0` (feat)
3. **Task 2: Storefront read queries and the B1 catalog grid** - `2b5285a` (feat)
4. **Task 3: B2 product detail page and the add-to-cart client island** - `f7a4312` (feat)

**Plan metadata:** commit for this SUMMARY.md, made immediately after this file (see final commit in this plan's git log).

_TDD note: Task 1 declared `tdd="true"`; the RED commit (`29783ab`) preceded the GREEN commit (`2b04be0`) as required. No separate REFACTOR commit was needed._

## Files Created/Modified
- `src/server/cart/cache.ts` - `cart:` Redis namespace owner: `readStoredCart`, `writeStoredCart`, `clearStoredCart`, the `StoredCart` type (tenantId/items/updatedAt, no price field), 30-day TTL, degrades rather than throws
- `src/server/cart/actions.ts` - `"use server"` module and sole cart-cookie writer: `addToCart`, `setCartQuantity`, `removeCartLine`, tenant-mismatch discard, variant validation via `scopedDb`, no-`domain` cookie
- `src/server/storefront/queries.ts` - `listStorefrontProducts`, `listStorefrontCategories`, `getStorefrontProduct`, `hydrateCart`, `cartLineCount` — the anonymous-visitor read model, `import "server-only"`
- `src/app/s/[slug]/page.tsx` - Rewritten as the B1 catalog grid with the zero-products placeholder branch, category chip row (`?category=` param), and D-09 out-of-stock tile treatment
- `src/app/s/[slug]/loading.tsx` - Skeleton grid matching the B1 tile shape/count
- `src/app/s/[slug]/store-header.tsx` - Sticky B1 header with the `aria-live="polite"` cart-count bubble
- `src/app/s/[slug]/p/[productSlug]/page.tsx` - B2 server component: `getStorefrontProduct` + `notFound()`, two-column `max-w-6xl` layout
- `src/app/s/[slug]/p/[productSlug]/add-to-cart.tsx` - Client island: variant pickers, quantity stepper, CTA state machine, optimistic cart-count increment, `sonner` toast
- `tests/unit/cart.test.ts` - 24 cases covering every `<behavior>` row (unknown-id read, wrong-tenant discard, mint-on-empty, quantity increment/clamp/removal, Upstash-unconfigured degradation)
- `tests/isolation/storefront-catalog.test.ts` - 6 cases: cross-tenant isolation, active:false invisibility (still visible to merchant queries), foreign-slug null, hydrateCart pricing from DB ignoring extra stored keys, stock-clamped adjustment

## Decisions Made
- Cookie omits `domain` deliberately (RESEARCH.md's verbatim reasoning reproduced in `actions.ts`): host-scoping to `{slug}.einort.com` is the actual isolation mechanism; `StoredCart.tenantId` comparison on read is the second, defense-in-depth layer.
- `hydrateCart` is the single point where stored `{variantId, quantity}` lines become priced display lines — no other module derives a cart total, keeping TEN-08 (never trust client-supplied price) true through checkout in later plans.
- The Phase-1 placeholder is not replaced but demoted to the zero-active-products branch of the B1 page — Phase 4's Theme/Section/Block system inherits a single rendering path to replace, not two.

## Deviations from Plan

None - plan executed exactly as written. All acceptance-criteria greps pass with two documented non-issues:
- `grep -c "sameSite" src/server/cart/actions.ts` returns 2 (plan's acceptance criteria expected 1) — one occurrence is the code (`sameSite: "lax"`), the other is the explanatory comment immediately above it reproducing RESEARCH.md's reasoning. Not a defect; verified by reading the surrounding lines.
- `grep -cE "tenant:host:|idem:" src/server/cart/cache.ts` returns 2, both inside the C-11 header comment block (lines 12-13) that names the modules owning those other prefixes, as the acceptance criteria's "outside the header" qualifier anticipates.

## Issues Encountered
- The first `npm run test:full` attempt failed with `P1001: Can't reach database server` against the Neon test branch (`ep-sweet-shape-za5xwdvh...`). A retry succeeded — this was a transient connectivity/cold-start issue, not a code or test defect. The full suite then passed 504/504 across 32 files on a clean run, including `tests/isolation/stock-race.test.ts`, which did **not** flake on this pass (the deferred-items.md-documented `PrismaClientKnownRequestError` timeout shape did not reproduce).

## User Setup Required

None - no external service configuration required. Upstash Redis env vars remain optional per existing `src/env.ts` contract; the cart degrades to non-persistent behavior when absent, which is by design and covered by `tests/unit/cart.test.ts`.

## Next Phase Readiness
- CHK-01's browse and view halves are functionally complete and machine-verified: `npm run test:full` (504/504), `npm run lint` (0 warnings), `npm run typecheck` (0 errors), and `npx next build` all pass cleanly, and `/s/[slug]` and `/s/[slug]/p/[productSlug]` both appear as dynamic routes in the build output.
- **Outstanding: this plan's `<human-check>` block has not been performed.** It requires visiting a seeded store subdomain in `npm run dev` at 360px and 1280px to visually confirm: the zinc palette with 0.25rem radius and no blue/gold; an out-of-stock product staying in the grid with a working link and a disabled (not hidden) `Out of stock` PDP button; the header cart bubble incrementing on add and the cart surviving a hard refresh; and a zero-active-products store still showing the Phase-1 coming-soon copy. This was intentionally left for the orchestrator/user — it was not faked or skipped by this execution pass.
- Plans 03-10 (cart review/checkout), 03-11 and 03-12 depend on the `hydrateCart`/`cartLineCount` contract and the `addToCart`/`setCartQuantity`/`removeCartLine` action signatures established here; both are stable and grep-verified against the plan's threat register (T-03-45 through T-03-48 all mitigated as specified).

---
*Phase: 03-product-catalog-order-payment-claim-state-machine*
*Completed: 2026-08-30*
