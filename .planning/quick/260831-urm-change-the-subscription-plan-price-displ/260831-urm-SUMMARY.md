---
phase: quick/260831-urm
plan: 01
subsystem: subscription-plan-ui
tags: [formatting, currency, ui-copy, claude-md-deviation]
requires: []
provides:
  - "Comma-grouped `5,000 XAF` price rendering on both subscription-plan surfaces"
affects:
  - src/app/onboarding/plan/page.tsx
  - src/app/(dashboard)/dashboard/plan/page.tsx
tech-stack:
  added: []
  patterns:
    - "Plain `Intl.NumberFormat` decimal formatter + literal currency-code suffix, used only where a locale-driven currency formatter cannot produce the requested shape"
key-files:
  created: []
  modified:
    - src/app/onboarding/plan/page.tsx
    - src/app/(dashboard)/dashboard/plan/page.tsx
decisions:
  - "Subscription-plan prices deviate from CLAUDE.md's `fr-CM` + `style: \"currency\"` convention; the deviation is scoped to two files and documented in-file citing 260831-urm"
  - "The `\" XAF\"` suffix stays inline at the call site rather than moving to `src/lib/strings.ts` — it is formatter config, not prose"
metrics:
  duration: ~7 min
  completed: 2026-08-31
---

# Quick Task 260831-urm: Subscription Plan Price Display Summary

Changed the subscription-plan price display on `/onboarding/plan` and `/dashboard/plan` from the project-wide `fr-CM` currency formatter output `5 000 FCFA` to `5,000 XAF`, using a plain `en-US` decimal formatter plus a literal ` XAF` suffix.

## What Changed

Both plan surfaces previously built a currency-style formatter:

```ts
new Intl.NumberFormat("fr-CM", {
  style: "currency",
  currency: "XAF",
  maximumFractionDigits: 0,
})
```

which renders `5 000 FCFA` (narrow-no-break-space grouping, `FCFA` display name). No standard Intl locale produces `5,000 XAF` via `style: "currency"` — English locales prefix the code (`XAF 5,000`), and every locale that suffixes it groups with spaces or dots. The only construction that yields comma grouping *and* a trailing `XAF` is a plain decimal formatter with the code appended manually:

```ts
const priceFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
// call site
price: `${priceFormatter.format(PLANS[tier].monthlyPriceXaf)} XAF`,
```

Both files now carry byte-identical formatter constructions and identical call-site suffixes.

Rendered output, verified directly:

| Tier | Before | After |
|------|--------|-------|
| Starter | `5 000 FCFA` | `5,000 XAF` |
| Business | `12 500 FCFA` | `12,500 XAF` |
| Professional | `25 000 FCFA` | `25,000 XAF` |

## Documented Deviation from CLAUDE.md

CLAUDE.md states currency formatting uses `Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF" })`. This change deliberately departs from that on two files only. Per the plan, `CLAUDE.md` itself was **not** modified — whether the project-wide convention should change is a separate decision.

To keep the deviation from reading as drift, each file's JSDoc block above the formatter now carries an all-caps load-bearing warning in the codebase's established style (`THIS IS NOT THE CURRENCY FORMATTER CLAUDE.md DOCUMENTS. DO NOT "FIX" IT BACK.`), the product-owner rationale, the Intl evidence for why no locale achieves the shape, and a citation of quick task `260831-urm` for traceability. The `maximumFractionDigits: 0` rationale (the currency has no decimal subunit in common use) was preserved.

`src/app/(dashboard)/dashboard/plan/page.tsx` additionally retains its cross-reference invariant — that its formatter matches `/onboarding/plan` exactly so a price never reads differently between the two plan surfaces — restated to cover both the construction and the suffix.

## Scope Held

No product, cart, checkout, order, or WhatsApp price formatting changed. The seven out-of-scope files with their own independent `style: "currency"` formatters were untouched; the verify gate asserts three of them still contain `fr-CM`. The commit changed exactly two files with zero deletions.

The `" XAF"` suffix stayed inline rather than moving into `src/lib/strings.ts`: it is formatter-level config of the same class as the `currency: "XAF"` option it replaces, not user-facing prose. Corroborated — the prose-literal scanner in `tests/unit/dashboard-nav.test.ts` runs against `SIDEBAR_FILE` only, and `looksLikeProse()` requires three or more whitespace-separated words.

## Verification

All gates run fresh against the clean committed tree:

| Gate | Result |
|------|--------|
| Plan gate script | PASS — formatter shape, ` XAF` suffix, no live `fr-CM`/`style: "currency"`, formatters identical across surfaces, out-of-scope files intact |
| `npm run lint` (`--max-warnings=0`) | exit 0 |
| `npm run typecheck` | exit 0, zero errors |
| `npm run test:unit` | 26/26 files, 442/442 tests passed |
| `git status` | exactly two modified files, no untracked files |

`tests/unit/entitlements.test.ts` and `tests/unit/dashboard-nav.test.ts` are both green. No test asserted a formatted plan-price string, so no test needed updating.

## Deviations from Plan

### Environment repair (Rule 3 — blocking issue)

**Found during:** Task 1 verification.

**Issue:** `npm run typecheck` initially reported 129 errors and `npm run test:unit` 9 failing files. Investigation showed the worktree's `node_modules` was completely empty (0 packages vs. 581 in the main repo), `src/generated/` did not exist, and `.next/types` had never been produced. All three are gitignored build artifacts, absent because `prisma generate` and `next build` fail in this worktree (the known Turbopack/`node_modules` junction issue). None of the 129 errors referenced either changed file.

**Fix:** Restored three gitignored artifacts from the main repo checkout so the gates could produce real signal rather than environmental noise:
- `src/generated/` (Prisma client) — dropped errors from 129 to 9
- `.next/types` (Next 16 `PageProps`/`LayoutProps` globals) — dropped 9 to 0
- `node_modules/server-only` — the package the Vitest alias resolves to at `<root>/node_modules/server-only/empty.js`; restored 442/442 tests

**Files modified:** None tracked. All three paths are gitignored, and `git status` confirmed the working tree still showed exactly the two intended files. Nothing was committed as a result of this repair.

**Commit:** N/A — build-artifact restoration only.

No other deviations. The code change itself executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. The change is display-only formatting on two authenticated pages; it introduces no network endpoint, auth path, file access, or schema change. Prices continue to be read from the server-side `PLANS` registry and formatted on the server — only `tier` crosses to the client, so no price is accepted from or computed by the client.

## Self-Check: PASSED

- `src/app/onboarding/plan/page.tsx` — FOUND
- `src/app/(dashboard)/dashboard/plan/page.tsx` — FOUND
- Commit `59fdfb2` — FOUND
