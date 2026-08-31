---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 11
subsystem: ui
tags: [react-hook-form, zod, next-app-router, r2, presigned-upload, variant-matrix, shadcn, tailwind]

# Dependency graph
requires:
  - phase: 03-05
    provides: "requestProductImageUpload presign mint, the direct-to-R2 PUT grant, and POST /api/upload/finalize returning { storageKey, width, height } with no database row"
  - phase: 03-06
    provides: "createProduct / updateProduct / setProductActive / createCategory, getProductForEdit, listCategories, activeProductCount, and the pure expandVariantMatrix the server re-expands against"
  - phase: 03-04
    provides: "strings.products — every label, helper, error and toast this form renders"
  - phase: 03-02
    provides: "the palette-scanned shadcn primitives (form, select, textarea, switch, table, checkbox, skeleton, sonner)"
provides:
  - "/dashboard/products/new and /dashboard/products/[id] — the A2 create and edit routes, each its own authorization boundary"
  - "product-form.tsx — the shared four-card client island over 03-06's existing write layer"
  - "image-gallery-field.tsx — the D-10 gallery: presign, direct PUT, finalize, Make main photo, 5-photo cap"
  - "variant-matrix-field.tsx — the D-05 live matrix driven by the server's own expander"
  - "tests/unit/product-form-contract.test.ts — the source-grep contract proving client and server cannot drift"
affects: [storefront product detail, order placement, merchant onboarding, platform admin catalog review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Importing a server-authored pure function (expandVariantMatrix) into a client component so the proposed and validated variant sets cannot diverge"
    - "Three-step browser upload that keeps image bytes off Vercel compute entirely (presign -> direct PUT -> finalize)"
    - "Persisting image rows from the form submission that knows the product id, not from the finalize route"

key-files:
  created:
    - "src/app/(dashboard)/dashboard/products/new/page.tsx"
    - "src/app/(dashboard)/dashboard/products/[id]/page.tsx"
    - "src/app/(dashboard)/dashboard/products/product-form.tsx"
    - "src/app/(dashboard)/dashboard/products/image-gallery-field.tsx"
    - "src/app/(dashboard)/dashboard/products/variant-matrix-field.tsx"
    - "src/app/(dashboard)/dashboard/products/new/loading.tsx"
    - "tests/unit/product-form-contract.test.ts"
  modified: []

key-decisions:
  - "The client imports the server's expandVariantMatrix rather than reimplementing the combination loop, because 03-06 re-expands and rejects a mismatch — a second implementation would surface as an unexplainable save failure"
  - "Image rows are persisted by createProduct/updateProduct, not by the finalize route, because a photo is uploaded before a Product exists"
  - "The primary-image picker is an explicit Make main photo action at a 44px target rather than drag-and-drop, on the grounds that dragging on a low-end Android touch screen is the wrong bet for this market"
  - "The primary tile is marked with a --primary ring and an outline badge, never gold — the gold budget is spent entirely on the claims badge and the Payment claimed chip"
  - "After two axes the add-option control is removed from the DOM rather than disabled, because a disabled third button invites a support question"
  - "The new route's cap redirect is a courtesy only; createProduct remains the authority and its refusal is surfaced verbatim (SUB-01)"
  - "The edit page's visibility switch writes through the same setProductActive the A1 list row uses, so D-08 has one code path and not two"

patterns-established:
  - "Shared create/edit client island: one form component parameterized by an optional existing record, with the route choosing the action"
  - "Controlled react-hook-form composite fields (gallery, matrix) that own array state and submit only settled entries"
  - "Source-grep contract tests that strip comment lines before matching, so a rationale comment naming a banned token does not fail the ban"

requirements-completed: [CAT-01, CAT-02]

# Metrics
duration: ~16min implementation + verification session
completed: 2026-08-31
---

# Phase 3 Plan 11: Product Create/Edit Form Summary

**The A2 four-card product form over 03-06's existing write layer: direct-to-R2 photo uploads with a tap-to-promote primary picker, and a live two-axis variant matrix driven by the same pure expander the server trusts.**

## Performance

- **Duration:** ~16 min for the three implementation tasks (19:19:19 → 19:35:07), plus a follow-up fix and a full verification pass
- **Started:** 2026-08-30T19:19:19+01:00
- **Completed:** 2026-08-31
- **Tasks:** 3
- **Files modified:** 7 created, 2602 insertions

## Accomplishments

- CAT-01 is complete end to end: a merchant creates and edits a product's name, description, category, whole-XAF price, images, two-axis variants, per-combination stock and visibility through one form, with no second server implementation and no divergent validation.
- CAT-02 is visible to the merchant: a sideways, badly-exposed phone photo goes straight to R2, comes back as an upright square sharpened WebP derivative, and is rendered from `publicUrlFor` — the original is never served.
- D-05's two-axis cap is enforced by the DOM's shape (the add control is absent, not disabled) and by `VARIANT_MATRIX_MAX`, with the >50 case blocked before the matrix is built.
- The client/server drift risk is closed structurally: `variant-matrix-field.tsx` imports `expandVariantMatrix` from `@/server/catalog/variant-matrix`, and a contract test asserts the absence of any local combination loop.
- Entered stock and price survive an axis edit wherever the combination key survives, so adding a third colour does not wipe the two the merchant already filled in.

## Task Commits

Each task was committed atomically:

1. **Task 1: The A2 shell — the new and edit routes, Cards 1, 3 and 4, and the action bar** - `4ec8d6b` (feat)
2. **Task 2: The D-10 image gallery — presign, direct PUT, finalize, primary picker** - `ace3bc6` (feat)
3. **Task 3: The D-05 live variant matrix and the form-contract test** - `1e66f01` (feat)

**Follow-up fix:** `52d52d9` (fix) — category sentinel re-encoded, found during verification.

## Files Created/Modified

- `src/app/(dashboard)/dashboard/products/new/page.tsx` (75) — the create route; calls `requireMerchantContext()` itself, checks `activeProductCount` against `limitFor(ctx, "products")` and redirects to the list with the cap alert as a courtesy.
- `src/app/(dashboard)/dashboard/products/[id]/page.tsx` (83) — the edit route; `getProductForEdit(ctx.tenantId, id)` and `notFound()` on null, plus the Card 4 visibility switch.
- `src/app/(dashboard)/dashboard/products/product-form.tsx` (725) — the shared four-card client island: react-hook-form + Zod v4 resolver, the `FCFA` suffix adornment, whole-franc parsing, the D-06 inline category create, the sticky-below-`md` action bar, and blocking errors as a destructive alert plus `aria-invalid` rather than a toast alone.
- `src/app/(dashboard)/dashboard/products/image-gallery-field.tsx` (510) — the D-10 gallery: the three-step upload, the 5-photo cap and counter, the `uploading`/`ready`/`failed` tile states with tap-to-retry, `Make main photo`, and `aria-live="polite"` regions.
- `src/app/(dashboard)/dashboard/products/variant-matrix-field.tsx` (816) — the D-05 field: two axis blocks with Enter/comma tag inputs, the live matrix as a `table` at `md` and stacked bordered blocks below it, the >50 guard and the non-blocking value-removal warning.
- `src/app/(dashboard)/dashboard/products/new/loading.tsx` (34) — the four-card skeleton.
- `tests/unit/product-form-contract.test.ts` (359) — 10 `it(` blocks covering the expander import, the absence of a local combination loop, both action references, the three-step upload contract, the no-inline-prose ban and the no-`trash` ban.

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one is that the client calls the server's own `expandVariantMatrix`: 03-06's handler re-expands the axes and rejects any mismatch, so the only way the form can reliably produce an acceptable `variants` array is to derive it from the identical function. The contract test exists specifically to keep that true under future edits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Category sentinel encoded as a raw NUL byte made a `.tsx` file binary to git**

- **Found during:** Verification after Task 3
- **Issue:** `NEW_CATEGORY_VALUE` — the D-06 sentinel distinguishing the `+ New category` option from a real category id — was written with a *literal* NUL control byte in the source. The runtime value was correct and deliberate (a cuid can never contain NUL, so the sentinel cannot collide with a real id), but the raw byte caused git to classify `product-form.tsx` as a binary file. The consequences were all reviewability, not behaviour: no diff, no blame, no review of a 725-line file, and EOL normalization silently skipped for this file alone.
- **Fix:** Re-encoded the sentinel as the escape sequence `"\u0000new-category"`. The runtime string is byte-identical, so both comparison sites (the option value at line 258 and the change handler at line 473) are unaffected; only the on-disk encoding changed.
- **Files modified:** `src/app/(dashboard)/dashboard/products/product-form.tsx`
- **Verification:** The working file now contains 0 raw NUL bytes, and `git grep -I` (which skips binary files) matches the file at HEAD — confirming git treats it as text again. Full suite, lint, typecheck and build all pass after the change.
- **Committed in:** `52d52d9` (standalone fix commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix is encoding-only and preserves the runtime value exactly. No behaviour change, no scope creep.

## Issues Encountered

**`npx next build` fails inside the git worktree for an infrastructure reason, not a code reason.**

The worktree's `node_modules` is a Windows junction pointing at the main checkout (`D:\Maxs\Claude\einort-commerce\node_modules`). Turbopack refuses to follow it:

```
Error [TurbopackInternalError]: Symlink [project]/node_modules is invalid, it points out of the filesystem root
- Execution of try_get_next_package failed
```

This fails while resolving the `next` package itself, before any application source is read, so it is independent of this plan's code. Confirmed by re-running the build with the Turbopack filesystem root temporarily set to the directory that contains both the worktree and the junction target: the build then completed with **exit 0**, and the route table included both new routes (`/dashboard/products/new` and `/dashboard/products/[id]`). The temporary config change was reverted; the tree is clean and `next.config.ts` is untouched at HEAD.

**Shared-test-branch contention (context, not encountered here).** A sibling worktree reported that `npm run test:full` against the shared Neon test branch can hit a genuine Postgres `deadlock detected (40P01)` during the harness's own truncate/reseed when several worktrees run concurrently. This run was executed solo after confirming no other `vitest` process was live, and no deadlock occurred.

## Verification Results

Run fresh from a clean tree, solo, with no concurrent sibling test processes:

| Gate | Result |
|------|--------|
| `npm run test:full` | **41/41 files, 632/632 tests passed**, exit 0 (1007s) |
| `npm run lint` | exit 0 at `--max-warnings=0` |
| `npm run typecheck` | exit 0 |
| `npx next build` | exit 0 (with the worktree junction worked around — see Issues Encountered) |

Acceptance-criteria greps all satisfied, including the negative bans: no `Decimal`/`toFixed(2)`/`/ 100` in the form, no `filename`/`file.name` and no `original` in the gallery, no `variant="gold"`, and no palette literal anywhere under the products tree. The single `trash` hit under that tree is a rationale comment in `product-row-actions.tsx` (a 03-06 file) explaining the ban itself; the contract test strips comment lines before matching, and `surface-token-isolation.test.ts` passes.

## Known Stubs

None. Every field on the form is wired to a real action or query from 03-05/03-06; no placeholder data source remains.

## Outstanding Manual Verification

The plan's `<human-check>` block has **not** been performed and still requires manual confirmation. It cannot be automated — it needs a real phone photo and a 360px viewport:

> In `npm run dev`, create a product end to end at 360px: type a name and a price, add a real phone photo (ideally one taken sideways) and confirm it comes back upright and square, add a second photo and make it the main one with the star action, declare `Size` with three values and `Color` with two, confirm six matrix rows appear with independent stock inputs, save, and confirm the product appears in `/dashboard/products` with the right thumbnail and summed stock. Then reopen it, flip `Visible in your store` off, and confirm the list row shows `Hidden`.

This is the only check that exercises the real R2 round trip and the Sharp derive pipeline against actual EXIF-rotated camera bytes — the automated gates prove the contract wiring, not the visual outcome.

## User Setup Required

None — no new external service configuration. R2 credentials and the Neon test branch were already required by 03-05 and the test harness respectively.

## Next Phase Readiness

- The merchant now has a way in: the catalog can be populated through the UI, which unblocks any storefront or order work that needs real products rather than seeded ones.
- The three-step upload pattern is now proven end to end from a browser and is directly reusable for the claim-screenshot and store-logo surfaces (the `IMAGE_PRESETS` registry already carries `claim` and `logo`).
- One concern to carry forward: the worktree `node_modules` junction breaks `npx next build` under Turbopack for every parallel executor in this wave. It is an environment issue rather than a code issue, but it will keep reappearing as a false build failure until the worktree setup materializes `node_modules` inside each worktree or the Turbopack root is configured.

---
*Phase: 03-product-catalog-order-payment-claim-state-machine*
*Completed: 2026-08-31*
