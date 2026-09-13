---
phase: 06-merchant-dashboard-platform-admin
plan: 02
subsystem: copy
tags: [strings, copy, admin, support, i18n-ready]
requires: []
provides:
  - strings.admin.*
  - strings.support.*
  - strings.dashboard.nav.support
  - strings.dashboard.attention.*
  - strings.plan.subscriptionClaim.*
affects:
  - src/lib/strings/index.ts
tech-stack:
  added: []
  patterns:
    - "Copy module extracted per surface and spread into `strings`, following the `marketing.ts` / `flagship.ts` precedent"
    - "`as const` object literal so every key is a literal type and a call-site typo is a compile error"
    - "Module-level constant for a sentence read by two namespaces, because an object literal cannot reference its own earlier keys during initialization"
key-files:
  created:
    - src/lib/strings/admin.ts
    - src/lib/strings/support.ts
  modified:
    - src/lib/strings/index.ts
decisions:
  - "Admin and merchant copy are separate modules, not separate keys in one file — the two-audiences rule becomes a file boundary a reviewer can see"
  - "The admin reject dialog reuses `strings.claims.rejectDialog*` at the call site rather than retyping the merchant copy into `admin.ts`"
  - "The ORD-04 duplicate-reference sentence is a module-level `DUPLICATE_REFERENCE` constant shared by `orderStatus` and `plan.subscriptionClaim`"
  - "The composer keyboard hint is two platform-specific strings, following `dashboard.topbar`'s Windows/Mac precedent, not one string with a slash"
metrics:
  duration: ~20 minutes
  completed: 2026-09-13
  tasks: 2
  commits: 2
  files-created: 2
  files-modified: 1
  lines-added: 822
---

# Phase 6 Plan 02: Phase 6 Copy Surface Summary

The complete Phase 6 copy surface — the platform owner's console and the merchant↔platform support thread — authored in one pass into two new `as const` string modules plus five new keys in the existing index, so every later plan in the phase is a lookup rather than a copy decision.

## What Was Built

**`src/lib/strings/admin.ts`** (433 lines, exports `adminCopy`) — Surface C's entire copy surface in twelve namespaces: `banner`, `nav`, `merchants`, `merchantDetail`, `claims`, `subscriptions`, `inbox`, `suspend`, `restore`, `domain`, `storeStatus`, `errors`. Every string traces to a specific section of `06-UI-SPEC.md` (§ C1–C6, § D, § Status Chip Registry, § Copywriting Contract).

**`src/lib/strings/support.ts`** (208 lines, exports `supportCopy`) — the thread's copy in six namespaces: `page`, `composer`, `thread`, `attachments`, `system`, `email`. `thread`/`attachments`/`system` are deliberately audience-neutral because § S builds one message component mirrored by a `viewer` prop and forbids forking it per surface.

**`src/lib/strings/index.ts`** — two imports, two spreads, and three new namespaces: `dashboard.nav.support` (R-4), `dashboard.attention.*` (§ A1 / R-6), `plan.subscriptionClaim.*` (§ A3 / R-3).

### The two-audiences rule is now structural, not advisory

`06-UI-SPEC.md § Copywriting Contract` says a string used on both the owner console and a merchant screen is a bug. That is now enforced three ways: the copy lives in two files with a stated boundary in each header; `admin.ts` contains zero occurrences of `your` outside comments (machine-checked); and the one sanctioned cross-audience reuse — the admin claims ledger's reject dialog — is implemented as an *absence* in `admin.ts` with a comment pointing the call site at `strings.claims.rejectDialog*`, so reuse is visible in review rather than silently duplicated.

### The email nudge quotes nothing (T-06-06)

`strings.support.email` has a `toMerchant` and a `toPlatform` variant, each `subject`/`heading`/`body` with `{token}` placeholders, mirroring `strings.claims.email`'s shape exactly — including its link-free rendering (`notify.ts` emits `<p>${heading}</p><p>${body}</p>` plus a text part, and its `cta` key is authored but never rendered). Neither variant interpolates a message body or a transaction identifier. The rule and its reasoning are stated in the module header, citing `src/server/claims/notify.ts`'s equivalent paragraph. Verified: `grep -v '^\s*\*' src/lib/strings/support.ts | grep -ci "reference"` returns 0.

## Key Implementation Details

**One sentence, one literal.** The plan required reusing rather than retyping the Phase 3 duplicate-reference refusal. An object literal cannot reference its own earlier keys during initialization, so the sentence was lifted to a module-level `DUPLICATE_REFERENCE` constant that both `orderStatus.claimDuplicateReference` and `plan.subscriptionClaim.duplicateReference` read. Verified at runtime that the two keys are `===`, not two equal strings that could drift.

**Where the key actually lived.** The plan located the duplicate-reference string in "the existing `claims` namespace"; it is in fact in `orderStatus` (`claims.duplicateReference` is a different, order-scoped sentence). Found by grep and handled correctly; a doc comment that had followed the plan's assumption was corrected to name `orderStatus`.

**`productsLive` sits in `dashboard.attention`.** The plan directs the fifth metric card's copy into the attention namespace, even though R-6 is explicit that the band and the metric row answer different questions and must not share a card. Followed as written — they land in the same edit to the same page — with a comment in the namespace stating that `productsLive` is not a tile and must never render inside the band.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree had no generated Prisma client, no Next.js route types, and an empty `node_modules`**

- **Found during:** Task 1 verification
- **Issue:** The worktree's `node_modules` was empty (0 entries) — Node was resolving `eslint`/`tsc`/`vitest` by walking up to the parent repository. `npm run typecheck` reported 152 errors, none of them in this plan's files: 137 from the missing `src/generated/prisma` client and 15 from the missing `PageProps`/`LayoutProps` globals and `next-env.d.ts` image-module declarations. `npm run test:unit` failed 10 files at import time with `Cannot find package 'server-only'`, because `vitest.config.ts` aliases `server-only` to `./node_modules/server-only/empty.js` and that path did not exist.
- **Fix:** Ran `prisma generate` with placeholder connection URLs (generation reads the schema only and never connects), `next typegen`, and a bare `npm install` from the committed lockfile. No package name was introduced — `npm install` with no argument materializes what `package-lock.json` already pins, so the package-legitimacy gate does not apply. `package-lock.json` is unchanged and all three artifacts are gitignored.
- **Files modified:** none committed (build artifacts only)
- **Commit:** n/a

**2. [Rule 3 - Blocking] Worktree branched from a stale commit that predated the Phase 6 plans**

- **Found during:** Plan load
- **Issue:** `.planning/phases/06-merchant-dashboard-platform-admin/` did not exist. The worktree branch sat at `d302801` (Phase 05.3 Wave 2), 32 commits behind `master`, which already carried all 17 Phase 6 plans.
- **Fix:** Confirmed the branch held no unique commits (`git log master..HEAD` empty, clean tree, HEAD an ancestor of `master`) and fast-forwarded with `git merge --ff-only master`. Nothing was discarded; `git reset --hard` was deliberately not used.
- **Files modified:** none
- **Commit:** n/a

### Copy authored beyond the plan's explicit enumeration

The plan enumerates most strings literally but success criterion 2 is broader — *every* string `06-UI-SPEC.md` specifies for this phase must resolve through `strings.*`, because later plans read and never author. A small number of strings the UI-SPEC requires as elements without quoting exact copy were therefore authored here rather than left for a component plan to invent:

| Namespace | Added | Required by |
|---|---|---|
| `admin.nav` | `pendingCountLabel`, `unreadCountLabel` | § Accessibility floor — colour is never the only signal; count badges are `role="status"` regions |
| `admin.merchantDetail` | `statusChangedSuspended`, `statusChangedActive`, `subscriptionsLink` | § C2 — "a Body line naming when and why it last changed"; "a link to this store's rows in `/admin/subscriptions`" |
| `admin.claims` | `screenshotAlt`, `viewScreenshot`, `rejectedToast`, `mismatchDialogTitle` | § C3 lightbox + § Interaction (a stay-on-page action gets a toast); the contract forbids "Are you sure?" standing alone, so the mismatch dialog needed a title |
| `admin.subscriptions` | `coversThroughPending`, receipt-lightbox labels, `confirmSubmitting`/`rejectSubmitting`, `rejectReasonCounter`/`Helper`, `rejectedToast` | § C4 — `—` while unreviewed; confirm is explicitly not optimistic, so a submitting state is required |
| `admin.suspend` / `admin.restore` | `confirming`, `toast`, `reasonHelper`/`noteHelper` | § Optimistic updates — suspend/restore wait for the server; § Success — a stay-on-page action gets a toast |
| `support.attachments` | `uploading`, `uploadError`, `openLabel` | § S — "a failed upload removes the thumb and shows the error inline" |
| `support.thread` | `logLabel`, `messagePending` | § Accessibility floor — the `role="log"` region needs an accessible name; the optimistic bubble's spinner replaces the timestamp |
| `plan.subscriptionClaim` | `payToLabel`, `copyNumber`, `copiedNumber`, `receiptHelper`, `cancel`, `submitting` | § A3 — the dialog restates the platform's own MoMo/OM number with a manual-copy affordance; submit is not optimistic |

No namespace outside the plan's list was created, and no string contradicts the UI-SPEC's quoted copy.

## Threat Model Coverage

| Threat ID | Disposition | How it landed |
|---|---|---|
| T-06-06 | mitigated | `support.email` states only that a message arrived; no transaction identifier and no message body is interpolated in either variant. Grep-verified at 0. |
| T-06-07 | mitigated | No `platformRole`, `tenantId`, `scopedDb`, `PAYMENT_CLAIMED` or `SupportMessage` appears outside comments in `admin.ts`. Grep-verified empty. |
| T-06-08 | mitigated | Separate modules with stated boundaries; `\byour\b` outside comments in `admin.ts` verified at 0. |
| T-06-SC | mitigated | Zero packages added. `package-lock.json` is byte-unchanged. |

No new threat surface was introduced — this plan ships no executable behaviour, no route, no query and no network call.

## Verification

| Check | Result |
|---|---|
| `npm run lint` (`--max-warnings=0`) | pass |
| `npm run typecheck` | pass, 0 errors — no `TS7022` circularity (neither new module imports back from `index.ts`) |
| `npm run test:unit` | 40 files, 664 tests, all pass — including the prose-literal contract tests (`dashboard-nav`, `landing-page-contract`, `product-form-contract`, `order-status-copy`) |
| Two-audiences grep | `admin.ts` non-comment `\byour\b` count: 0 |
| Internal-name grep | `admin.ts` non-comment matches: none |
| Namespace presence grep | 14 (≥ 11 required) |
| `email` no-reference grep | `support.ts` non-comment "reference" count: 0 |
| Index wiring grep | `adminCopy\|supportCopy`: 4 (2 imports + 2 spreads) · `attention`: 6 · `subscriptionClaim`: 2 |
| `dashboard.nav.support` | present at `index.ts:616` |
| Runtime resolution | `strings.admin.banner.short`, `strings.support.page.heading`, `strings.dashboard.nav.support`, `strings.dashboard.attention.heading`, `strings.plan.subscriptionClaim.trigger` all resolve; the shared duplicate-reference literal is `===` across both call sites |
| No `.tsx` touched | confirmed — the diff is exactly the three files in `files_modified` |

## Known Stubs

None. This plan ships copy only; there is no data source to wire and no component renders these strings yet — that is the plan's stated design (later plans read, never author).

## Notes for Future Plans

- **Plan 06-09 owns a paired edit.** `strings.dashboard.nav.support` is the label only. The `NAV_GROUPS` row in `src/components/app-sidebar.tsx` and `"/dashboard/support"` in `REQUIRED_HREFS` (`tests/unit/dashboard-nav.test.ts`) must land in the same commit — either half alone fails the build (§ Open Items 5). The rail badge is blue, not gold.
- **The gold budget is still unspent by this plan.** All five allowed `variant="gold"` occurrences remain available; the test amendment in § Color must land in the same commit as the first spend (§ Open Items 4).
- **`support.attachments.sizeError` interpolates `{max}`** from the real upload constant. § Open Items 2 asks the planner to confirm which constant governs the thread preset — the string is deliberately not hardcoded to a number.
- **`admin.claims` has no reject-dialog copy on purpose.** The call site reads `strings.claims.rejectDialogTitle`, `.rejectDialogBody`, and the four `rejectReason*` keys. Do not "fix" the apparent omission by adding them.

## Self-Check: PASSED

- `src/lib/strings/admin.ts` — FOUND (433 lines, ≥120 required)
- `src/lib/strings/support.ts` — FOUND (208 lines, ≥80 required)
- `src/lib/strings/index.ts` — FOUND, modified (2,072 lines)
- Commit `4c6473e` — FOUND
- Commit `f85dda6` — FOUND
