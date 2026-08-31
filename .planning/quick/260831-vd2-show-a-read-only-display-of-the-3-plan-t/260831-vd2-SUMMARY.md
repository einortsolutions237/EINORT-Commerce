---
phase: quick/260831-vd2
plan: 01
subsystem: merchant-dashboard
tags: [plan-surface, entitlements, trial-expiry, accessibility, read-only]
requires:
  - src/server/entitlements/plans.ts (PLAN_TIERS, PLANS)
  - src/lib/strings.ts (plan namespace — read only, unmodified)
  - src/server/merchant/context.ts (requireMerchantContext)
provides:
  - Read-only three-tier plan display on the expired-trial branch of /dashboard/plan
  - A single hoisted tier/name/price array shared by both branches of the page
affects:
  - src/app/(dashboard)/dashboard/plan/page.tsx
tech-stack:
  added: []
  patterns:
    - Hoist shared derived data above a branch so two render paths cannot diverge
    - Non-colour redundancy for selected state (ring + icon + sr-only label, WCAG 1.4.1)
key-files:
  created: []
  modified:
    - src/app/(dashboard)/dashboard/plan/page.tsx
decisions:
  - "Expired-trial plan display stays read-only: no switch button, no subscribe route, no click target — the WhatsApp contact link remains the only functional CTA (OQ-3)."
  - "Tier name and price are built once above the expired/non-expired split so the switcher and the read-only display can never disagree; the member-count query stays below the split because a read-only display enforces no limits."
  - "No strings.plan.dashboard.heading sub-heading above the grid — the expired heading already anchors the page."
metrics:
  duration: ~14 min
  tasks: 1
  files: 1
  completed: 2026-08-31
---

# Quick 260831-vd2: Read-only plan tiers on the expired-trial branch

Expired-trial merchants on `/dashboard/plan` now see all three tiers with names and prices below the unchanged "Your trial has ended." block, rendered entirely read-only.

## What Changed

One file: `src/app/(dashboard)/dashboard/plan/page.tsx`.

**Hoisted shared tier data.** A `planTiers` array (`{ tier, name, price }`) is now built from `PLAN_TIERS` immediately after `requireMerchantContext()` and before the `ctx.trial.state === "expired"` branch. Both branches read it, so a tier name or a price cannot diverge between the in-trial switcher and the expired-trial display, and both go through the same module-level `priceFormatter`. The `await platformDb.member.count(...)` and the `memberLimit` field deliberately stayed below the branch — the read-only display enforces no limits and must not pay for a query it has no use for.

**Expired branch.** The existing `h1` / `p` / WhatsApp `a` moved verbatim (same classes, same string keys, same `target`/`rel`, same `ExternalLink` and `sr-only` label) into an inner `flex flex-col gap-4` wrapper, and the outer container's `gap-4` became `gap-6` — matching the non-expired branch's outer column exactly, so the existing elements' mutual spacing is preserved byte-for-byte. A `grid items-stretch gap-4 lg:grid-cols-3` of three static cards is the container's second child. The merchant's current tier carries `ring-2 ring-primary`, a `Check` icon and an `sr-only` "Selected" label, so colour is never the only signal (WCAG 1.4.1). Each card holds a tier name and a price plus `/month` suffix — nothing else.

**Non-expired branch.** `cards: PlanSwitchCard[]` now derives from the hoisted array by spreading each entry and adding `memberLimit`. The `PlanSwitchCard` interface, `PlanSwitchForm`'s props, the `trialLine` computation and the returned JSX are unchanged; `plan-switch-form.tsx` was not touched.

**Comments.** The file's "A FUNCTIONAL POST-EXPIRY SWITCHER IS A CONTRACT VIOLATION" header gained one sentence noting the branch now also shows the tiers read-only. A new block at the grid records the read-only contract: the OQ-3 resolution quoted verbatim from `02-CONTEXT.md` § Addendum, the note that `switchPlan`'s `merchantAction({ mode: "write" })` refuses the write server-side regardless, that a subscribe/payment redirect is deferred to Phase 6 (platform receiving number + subscription-claim flow) and must not be added here, and that the omitted sub-heading is deliberate. All of it cites quick task `260831-vd2`. The `priceFormatter` doc comment was not touched.

Zero new strings, zero new files, no `"use client"`, no palette literal or arbitrary Tailwind value.

## Verification

Run fresh from a clean tree after the commit — all four gates green:

| Gate | Result |
|------|--------|
| Plan gate script | PASS (grid present; ring + `sr-only` label present; exactly one `PLAN_TIERS.map` and one `Intl.NumberFormat`; zero `use client`/`onClick`/`useState`/`switchPlan`/`<Button`; `<PlanSwitchForm` rendered once; `trialDaysLeft`/`oneDayLeft` once each; `platformDb.member.count` once; exactly one changed source file) |
| `npm run lint` | PASS — zero warnings (`--max-warnings=0`) |
| `npm run typecheck` | PASS — `PlanSwitchCard[]` still typechecks from the derived array without editing `plan-switch-form.tsx` |
| `npm run test:unit` | PASS — 26 files, 442 tests, including `surface-token-isolation.test.ts` and `dashboard-nav.test.ts` |

The gate script's scope assertion was run twice: pre-commit against `git status --porcelain -- src` (as written in the plan), and post-commit against `git diff --name-only HEAD~1 HEAD -- src` plus a clean-tree check, since a committed change leaves `git status` empty. Both forms returned exactly `src/app/(dashboard)/dashboard/plan/page.tsx`.

`npx next build` was not run — the plan designates it a bonus, not a gate, because of the known worktree/Turbopack `node_modules` junction issue.

## Deviations from Plan

None affecting code. The plan executed exactly as written.

## Environment Repair (not a code change)

This worktree spawned with **all** gitignored build artifacts absent — `node_modules/`, `src/generated/`, and `.next/types/` were missing entirely, exactly the recurring condition quick task `260831-urm` documented. Each was restored as a Windows directory junction to the main checkout at `D:\Maxs\Claude\einort-commerce`:

- `node_modules` → `D:\Maxs\Claude\einort-commerce\node_modules`
- `src\generated` → `D:\Maxs\Claude\einort-commerce\src\generated`
- `.next\types` → `D:\Maxs\Claude\einort-commerce\.next\types`

A baseline `npm run typecheck` was run before any edit to confirm the repair produced a clean starting state, so no gate result below can be attributed to the environment. All three paths are gitignored: `git status --porcelain` was empty both after the repair and after the commit, and the commit touched one tracked file.

The worktree also spawned on a stale base (`c1815eb`) and was hard-reset to the instructed base `7c4dee9` before any work began.

## Self-Check: PASSED

- `src/app/(dashboard)/dashboard/plan/page.tsx` — FOUND (modified)
- Commit `34a2843` — FOUND on `worktree-agent-a2f6663f1e63a57a1`
- Commit contains no file deletions (`git diff --diff-filter=D HEAD~1 HEAD` empty)
- No stubs, no placeholder values, no TODO markers introduced
- No new threat surface: the branch renders zero interactive controls, imports no action, and reads only public marketing data (tier names and prices) already rendered unauthenticated on `/onboarding/plan` — consistent with the plan's threat register (T-vd2-01/02/03/SC). No package was installed.
