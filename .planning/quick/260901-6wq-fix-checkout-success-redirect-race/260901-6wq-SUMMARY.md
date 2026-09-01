---
phase: quick/260901-6wq
plan: 01
subsystem: checkout
tags: [nextjs, server-actions, revalidatePath, router-cache, vitest, source-scanning-test]

# Dependency graph
requires:
  - phase: quick/260901-00j
    provides: "tests/unit/storefront-link-prefix.test.ts, the /s/ prefix guard this task rescoped rather than descoped"
  - phase: 03-checkout-and-orders
    provides: "submitCheckout, placeOrder, the checkout page guard and the client-state confirmation view"
provides:
  - "submitCheckout no longer invalidates the route it is rendering inside, so the order confirmation actually reaches the shopper on all three channels"
  - "tests/unit/checkout-revalidation-race.test.ts — an always-on, database-free source guard forbidding all four cache-invalidation APIs in the checkout action"
  - "A runtime assertion in the isolation suite that a successful placement calls no invalidation API"
  - "A documented, citation-backed finding about revalidatePath's behaviour in Next 16.3.1 that applies far beyond checkout"
affects: [checkout, orders, storefront, any-future-page-pairing-a-render-time-redirect-guard-with-a-mutating-action]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Comment-stripped source-scanning contract test with a real-source positive control plus a synthetic red/green pair"
    - "A deliberately retained vi.mock promoted to a spy so an ABSENCE of behaviour is assertable at runtime"

key-files:
  created:
    - tests/unit/checkout-revalidation-race.test.ts
  modified:
    - src/server/checkout/actions.ts
    - tests/unit/storefront-link-prefix.test.ts
    - tests/isolation/checkout-paths.test.ts

key-decisions:
  - "Deleted the revalidatePath call outright rather than scoping it narrower — Next 16.3.1 performs no path matching, so a narrower path would re-render /checkout identically"
  - "Forbade the whole invalidation family (revalidatePath, revalidateTag, updateTag, refresh) in the checkout action, not just the one API that caused the bug"
  - "Moved src/server/checkout/actions.ts to a stricter zero-tolerance scope in the /s/ prefix guard instead of dropping it out of scope"
  - "Accepted browser back/forward Router Cache staleness as the cost; every mechanism that would fix it is closed by the same pathWasRevalidated flag"

patterns-established:
  - "Any Server Action that revalidates re-renders the route the user is currently on — a page-level redirect() guard is therefore effectively a redirect that can fire on any mutation performed from that page"
  - "When a fix is a deletion, the rationale comment and a source-scanning guard are both required, because a deletion looks like an oversight to the next reader"

requirements-completed: [QUICK-260901-6wq]

# Metrics
duration: 22min
completed: 2026-09-01
---

# Quick Task 260901-6wq: Fix Checkout Success Redirect Race Summary

**Deleted one `revalidatePath` call from `submitCheckout` — the invalidation was making Next re-render the open `/checkout` route inside the same Server Action response, firing the page's empty-cart redirect against a basket emptied by the very order that had just succeeded, so every shopper on every channel was bounced to "Your cart is empty" instead of their confirmation.**

## Performance

- **Duration:** ~22 min (excluding the isolation-suite run, which did not return — see below)
- **Started:** 2026-09-01T04:10:00Z
- **Completed:** 2026-09-01T04:32:20Z
- **Tasks:** 2 of 3 complete (Task 3 is a blocking human checkpoint, NOT satisfied — see "Blocking Checkpoint")
- **Files modified:** 3 modified, 1 created

## Accomplishments

- Removed the cache invalidation that cost every shopper their order number, their D-12 tracking link and, on the manual-transfer path, their payment instructions. The order row, stock hold and audit trail were always written correctly; only the screen proving it was lost.
- Replaced it with a ~65-line rationale comment carrying the mechanism, the Next.js source citations, the reason the obvious narrower-scoping fix cannot work, and the reason `src/server/cart/actions.ts` legitimately keeps its own call.
- Added an always-on, database-free source guard that fails `npm run test:unit` if any of the four cache-invalidation APIs returns to the checkout action, mutation-checked to prove it is not vacuous.
- Rescoped the `260901-00j` `/s/` prefix guard so `checkout/actions.ts` moved to a **stricter** scope rather than out of scope — the `trackingPath` hole that task closed stays closed.

## Task Commits

1. **Task 1: Stop submitCheckout from invalidating the route it is rendering inside** — `24050f3` (fix)
2. **Task 2: Make the redirect race impossible to reintroduce silently** — `683e9af` (test)
3. **Task 3: Place a real order on all three channels in a live browser** — NOT DONE. Blocking human checkpoint.

## Files Created/Modified

- `src/server/checkout/actions.ts` — deleted `revalidatePath(\`/s/${slug}\`, "layout")` and the `next/cache` import; added the rationale block after `clearStoredCart`; retargeted one stale `260901-00j` comment that pointed at the deleted call.
- `tests/unit/checkout-revalidation-race.test.ts` (new) — comment-stripped source scan; zero invalidation calls and zero `next/cache` imports in the checkout action, exactly one call in the cart action as a positive control, plus a synthetic red/green pair.
- `tests/unit/storefront-link-prefix.test.ts` — `ACTION_MODULES` split into `REVALIDATING_MODULES` (cart, exactly one) and `NO_PREFIX_MODULES` (checkout, zero, `revalidatePath` line or not); both scopes still existence-checked together.
- `tests/isolation/checkout-paths.test.ts` — the dead `next/cache` no-op stub promoted to a `vi.hoisted` spy, cleared in `beforeEach`, with a new `"a successful placement invalidates nothing"` block asserting `not.toHaveBeenCalled()` on a real Cash-on-Delivery placement.

## 1. What Changed

`submitCheckout` used to end with three statements: claim the idempotency key, clear the stored cart, then `revalidatePath(\`/s/${slug}\`, "layout")`. The third is gone, along with `import { revalidatePath } from "next/cache"` (the module's only `next/cache` import — leaving it would have failed `npm run lint --max-warnings=0`).

Nothing else in the action moved: the Zod schema, `buildOutcome`, `storeOriginFor`, `trackingPath`/`trackingUrl`, the idempotency pack/unpack and the `rememberOrderForKey`-before-`clearStoredCart` ordering are all unchanged. `src/app/s/[slug]/checkout/page.tsx`, `checkout-form.tsx`, `src/server/cart/actions.ts`, `tests/unit/cart.test.ts`, `next.config.ts` and `src/proxy.ts` are untouched.

## 2. The Next.js Finding — the reusable part

**`revalidatePath` performs no path matching in Next 16.3.1.** Read from the installed package, not inferred:

- `node_modules/next/dist/server/web/spec-extension/revalidate.js` carries Next's own comment — `// TODO: only revalidate if the path matches` — directly above the line that sets `store.pathWasRevalidated`. The affected-path test is simply not implemented. Any path, any type (`"page"` or `"layout"`), sets the flag.
- `node_modules/next/dist/server/app-render/action-handler.js` then derives `skipPageRendering` from that flag **alone**; the requested path is never consulted. So `skipPageRendering === false` for every revalidating action, and the route the user is currently on is re-rendered regardless of which path was named.

**The rule this implies for this codebase, stated generally:**

> Any Server Action that revalidates re-renders the route the user is currently standing on, as part of that same action's response. A page-level `redirect()` guard is therefore effectively a redirect that can fire on **any** mutation performed from that page — including one whose success is precisely what makes the guard's condition true.

`refresh()` (new in Next 16) sets the same flag with `ActionDidRevalidateDynamicOnly`, and writing a cookie from an action sets it too (`.../adapters/request-cookies.js`), so neither is an escape hatch. Reordering is not one either — revalidations execute after the action body returns.

This is not a checkout fact. It applies to every future page that pairs a render-time guard with a mutating action.

## 3. Why the Naive Fix Was Rejected

The bug report's own hypothesis was to scope the invalidation narrower — revalidate the storefront root, the PDP route and the cart page, so the open `/checkout` route is not a target. **That cannot work**, for the reason in section 2: there is no path comparison anywhere in the chain, so `/s/{slug}/cart` and `/s/{slug}` produce the identical re-render of `/checkout`.

This was determined by reading the installed package source, not assumed. Two further doors are closed by the same flag and were also rejected: `refresh()`, and writing a "just placed an order" cookie for the page to read (which would have forced the very re-render it was meant to survive). The cookie route had a second defect worth recording: had the page re-rendered instead of redirecting, the surviving `CheckoutForm` would have received `lines: []`, `itemCount: 0` and `total: currency.format(0)` — and the manual-transfer confirmation interpolates that `total` into its body, so the shopper would have been told their transfer was for **0 FCFA**. Deleting the invalidation removes the re-render entirely and preserves the amount exactly as first rendered.

## 4. The Accepted Cost

Forward navigation is unaffected. `StoreHeader` is rendered by each storefront `page.tsx`, not by `src/app/s/[slug]/layout.tsx` (so the `"layout"` scope was never buying it anything); every one of those pages is dynamic because `getCurrentCart` awaits `cookies()`, so each navigation re-reads the cart from Redis; and the client Router Cache's `staleTimes.dynamic` default has been 0s since Next 15, with no `experimental.staleTimes` set in `next.config.ts`. `loading.tsx` files at the root, cart and checkout segments mean prefetch only ever caches the static shell above the loading boundary.

What is accepted: **browser back/forward restores from the Router Cache regardless of staleness.** A shopper who presses Back from the confirmation may briefly see the pre-order cart, and the header bubble on the confirmation screen itself keeps its pre-order count for as long as they stay there. Both self-heal on the next interaction — clicking through from that stale cart re-renders `/checkout` server-side, finds an empty basket and correctly redirects to a freshly rendered empty `/cart`. Nothing another shopper owns can appear there: the cart is per-browser, keyed by an `httpOnly`, host-scoped, `domain`-less cookie. This is a cosmetic, transient, back-button-only artifact and is strictly better than losing the confirmation screen on 100% of orders.

## 5. The Next-Upgrade Risk

The fix's premise is that `skipPageRendering` ignores the requested path. **If a future Next implements that `// TODO: only revalidate if the path matches`, the premise changes** and a scoped invalidation could become safe again. The rule and its citations live in `tests/unit/checkout-revalidation-race.test.ts`, which records `16.3.1` as the version everything here was verified against. That guard must be revisited **deliberately**, by re-reading the two Next source files, and never deleted just to make a build pass.

## 6. The Coverage Gap, Again

This bug reached a shipped phase with a fully green suite, for exactly the same reason `260901-00j` did:

- There is no end-to-end or browser layer at all — no Playwright, no `test:e2e` script.
- The isolation suite calls `submitCheckout` in-process, so Next's action/render pipeline never runs; the re-render, the guard and the redirect are all outside what it can observe.
- No test in this repository has ever rendered a page or followed a redirect.

Task 2's guards close *this* regression. They do not close the gap. That is now **two live-blocking Phase 3 bugs found only by manual browser reproduction**. The recommendation stands and is restated here: add a Playwright smoke suite driving the shopper journey through a real `Host` header — grid → PDP → cart → checkout → confirmation → tracking page — as a separate, scoped task. It was deliberately **not** done here; no dependency was added by this task.

## 7. Environment Repair and Test Runnability

The worktree shipped without any of its gitignored build artifacts, exactly as `260831-urm`, `260831-vd2` and `260901-00j` documented. Restored from the main checkout at `D:\Maxs\Claude\einort-commerce` — all gitignored, so nothing tracked was modified (`git status` was clean immediately after):

- `node_modules/` — absent entirely; restored as a directory junction.
- `src/generated/` (Prisma client) — restored as a directory junction.
- `.next/types` (Next 16 route-type globals) — copied.
- `.env.test` — copied, to attempt the isolation suite.

**`npm run test:full` did not complete.** With `.env.test` in place it ran for over 15 minutes without emitting a single line of output and was still running when this summary was written — consistent with the dedicated Neon test branch being unreachable or cold-starting from scale-to-zero in this worktree. Per the plan, this was not chased. **The isolation-suite assertion added in Task 2B is therefore committed but unexecuted**; it should go green on the next environment where `test:full` runs. The durable gate is `tests/unit/checkout-revalidation-race.test.ts`, which needs no database and is green.

Everything else passed:

- Task 1 gate script — PASS.
- Task 2 gate script — PASS.
- `npx vitest run tests/unit/storefront-link-prefix.test.ts` — 6/6.
- `npx vitest run tests/unit/checkout-revalidation-race.test.ts` — 5/5.
- `npm run lint` (`--max-warnings=0`) — clean.
- `npm run typecheck` — clean.
- `npm run test:unit` — 28 files, 453 tests, all passing (was 27/448 before this task).
- Mutation check — the guard goes **red** when `revalidatePath` is reintroduced into `src/server/checkout/actions.ts` and stays **green** when the API is merely named in a comment, and the file was restored cleanly.

## Decisions Made

- **Delete, do not scope.** Section 3. The alternative was disproven from Next's source rather than argued about.
- **Forbid the whole invalidation family.** `revalidateTag`, `updateTag` and `refresh` all set the same `pathWasRevalidated` flag; forbidding only `revalidatePath` would have left the identical bug reachable under a different name.
- **Rescope, do not descope, the `/s/` prefix guard.** Dropping `checkout/actions.ts` from `ACTION_MODULES` would have left the module unscanned and reopened the `trackingPath` hole `260901-00j` closed. It now sits in a zero-tolerance scope, which is stricter than what it had before.
- **Keep the isolation-suite `next/cache` mock as an assertion target** rather than deleting it with the import. An absence of behaviour is only assertable if something is watching for it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A pre-existing comment was made false by the deletion**

- **Found during:** Task 1 (checkout action deletion)
- **Issue:** `src/server/checkout/actions.ts` carried a `260901-00j` comment above `trackingPath` reading *"Contrast the `revalidatePath("/s/{slug}", "layout")` call further down: that one addresses the Next.js route tree rather than the browser…"*. After the deletion there is no such call further down. The plan's Task 1 said existing comments should stay byte-for-byte, but leaving this one would have actively told the next reader that a `revalidatePath` exists in this module — the precise reintroduction risk the whole task exists to prevent.
- **Fix:** Retargeted the contrast to `src/server/cart/actions.ts` (where the call genuinely is and must stay), and noted that this module had one until `260901-6wq` deleted it, pointing at the rationale block below. The `260901-00j` point it was making — that `revalidatePath` legitimately keeps the internal prefix while browser-visible paths must not — is preserved intact.
- **Files modified:** `src/server/checkout/actions.ts`
- **Verification:** Task 1 gate script PASS (it greps for anchors, none of which were touched); `npm run test:unit` green including the rescoped prefix guard.
- **Committed in:** `24050f3` (Task 1 commit)

### Issues Encountered

**1. The plan's Task 2 mutation-check script has a restore-ordering bug.** Its `restore()` runs `rm -f "$A.bak"`, so the second probe's `restore()` had no backup to copy from and failed with `cp: cannot stat 'src/server/checkout/actions.ts.bak'`, leaving the harmless comment probe appended to the working file. **Both probes had already returned the correct answers** — the script only prints `FAIL` and exits early when the guard answers wrongly, and it did neither. Recovered with `git checkout -- src/server/checkout/actions.ts` (a single named file, not a blanket reset) and re-ran a corrected copy of the script that keeps the backup until the end. Result: `OK: red on reintroduction` / `OK: green on documentation` / `PASS: … restored`. **The bug is in the plan's verification script, not in the guard.** Worth fixing in the plan template if that script is reused.

**2. The worktree branch was two commits behind `master`.** Its merge-base with the plan commit `0356455` was `0c75e8f`, i.e. the plan file did not exist in the worktree yet. Fast-forwarded with `git merge --ff-only 0356455` on the per-agent branch (`worktree-agent-ae2347e4b57961efd`) before starting; no protected ref was touched.

---

**Total deviations:** 1 auto-fixed (1 bug — a stale comment invalidated by the change).
**Impact on plan:** Minimal and squarely within the plan's own intent. No scope creep, no dependency added, no file on the `<do_not_touch>` list modified.

## Blocking Checkpoint — Task 3 is NOT satisfied

**Task 3 (`checkpoint:human-verify`, `gate="blocking"`) requires a human at a real browser and was deliberately not attempted.** This bug was only ever caught by literal browser reproduction: there is no end-to-end layer, no automated test in this repository renders a page or follows a redirect, and the isolation suite calls `submitCheckout` in-process so Next's action/render pipeline never runs. **The automated gates prove the call is gone and cannot come back; they cannot prove the shopper now sees the confirmation.** Only Task 3 can.

Required: dev server on port **3001**, store `http://megasolution.localhost:3001/`, seeded product `iphone-17-pro-maxs`, dev-server console visible (the bug's signature is `POST /checkout` 200 immediately followed by `GET /cart`). Three real orders — WhatsApp, Manual Transfer (MTN or Orange), Cash on Delivery — each of which must render the confirmation **in place** with the address bar still on `/checkout`; plus two regressions: a direct visit to `/checkout` with a genuinely empty cart must still redirect to `/cart`, and the header bubble must read 0 on the storefront root, a PDP and the cart page on the first forward navigation after an order. The manual-transfer amount must match the order summary — **0 FCFA means a re-render is still happening**. Back/forward staleness is known and accepted, not a failure. The plan's `<how-to-verify>` section has the full step-by-step.

## User Setup Required

None — no external service configuration required by this task. (The isolation suite's Neon test branch is a pre-existing environment requirement, not something this task introduced.)

## Next Phase Readiness

- The fix and both regression guards are committed and green under `npm run lint`, `npm run typecheck` and `npm run test:unit`.
- **Blocked on Task 3.** Do not consider this task done until the three browser placements are confirmed.
- `npm run test:full` should be re-run wherever the Neon test branch is reachable, to execute the isolation assertion added here.
- The Playwright smoke-suite recommendation (section 6) remains open and is now backed by two live-blocking bugs.

## Self-Check: PASSED

- All four source files claimed above exist on disk; the SUMMARY exists at the path the plan's `<output>` specifies.
- Both task commits exist in the log: `24050f3`, `683e9af`.
- `git diff 0356455..HEAD` is **empty** for every file on the plan's `<do_not_touch>` list plus the two the gates pin: `src/app/s/[slug]/checkout/page.tsx`, `src/app/s/[slug]/checkout/checkout-form.tsx`, `src/server/cart/actions.ts`, `tests/unit/cart.test.ts`, `next.config.ts`, `src/proxy.ts`, `tests/unit/proxy.test.ts`, `package.json`, `vitest.config.ts`.
- Working tree clean apart from this SUMMARY.

---
*Phase: quick/260901-6wq*
*Completed: 2026-09-01*
