# Phase 7: Trial & Template-Tier Business Rules - Research

**Researched:** 2026-09-13
**Domain:** In-repo constant/copy/test reconciliation (no external technology)
**Confidence:** HIGH (every finding below is a direct read of this repository's source at HEAD, not an inference)

## Summary

This phase has no external technology domain. Every question it raises is answerable by reading this repository, and every claim below was produced by parsing the actual source files rather than by recalling how the code "probably" looks. The two changes are a one-line constant edit (`TRIAL_DAYS 10 → 30`) and twelve one-word edits to `minTier` fields in `src/server/theming/registry.ts`, plus two numeric edits in `src/server/entitlements/plans.ts` and nine copy edits confined to `src/lib/strings/index.ts` and `src/lib/strings/marketing.ts`. No new package, no migration, no schema change, no architecture change.

**The single most important finding is that D-01's premise does not hold against the real registry.** CONTEXT.md's D-01 says to "take the current `minTier` boundary lines and shift them mechanically." There are no boundary lines. The 50 templates' tiers are **interleaved**, not blocked: the declaration order produces **48 contiguous tier runs across 50 entries** (i.e. almost every entry differs in tier from the one before it). Applying the only sensible reading of "shift by registration order" — promote the first 5 business entries and the first 7 professional entries in declaration order — produces a result that **fails D-02's own sanity check**: all 12 moves land inside just two of six segments, leaving fashion-apparel with **zero** Professional templates and electronics with **one**, while beauty, grocery, furniture and general-retail are untouched. D-02 explicitly instructs flagging exactly this outcome rather than silently accepting it. Two segment-balanced alternatives that hit the same 15/17/18 totals and preserve the monotone-downward invariant are computed below.

The second most important finding is the test-suite blast radius of the trial change. `tests/unit/entitlements.test.ts` encodes the number 10 not only as `expect(TRIAL_DAYS).toBe(10)` but structurally, as **absolute day offsets** (`at(11 * DAY_MS)` meaning "after the trial", `at(9 * DAY_MS)` meaning "day 9 of 10"). Six assertion sites go red and two more go silently **vacuous** at 30 days. These must be re-expressed relative to `TRIAL_DAYS`, not merely renumbered.

**Primary recommendation:** Implement the trial change as `TRIAL_DAYS = 30` (one line, zero migration — verified below). Do **not** apply D-01's literal mechanical shift; take it to the user with Option C or Option D below, both of which satisfy 15/17/18, satisfy D-03's no-template-becomes-more-restricted invariant, and keep every segment's tier mix balanced. Re-express the entitlement tests in terms of `TRIAL_DAYS` rather than hardcoded day offsets.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Template tier reassignment**
- **D-01:** Move the tier boundary by registration order in `TEMPLATE_KEYS`/the registry array — take the current `minTier` boundary lines and shift them mechanically to produce 15/17/18, rather than hand-picking specific templates by visual judgment. No manual per-template review across all 50.
- **D-02:** After the mechanical shift, verify the resulting per-segment tier mix (fashion/electronics/beauty/grocery/furniture/general-retail) still looks reasonable — a sanity check, not a redesign. If a segment ends up badly lopsided (e.g., all of one segment's templates landing in one tier), flag it for the user rather than silently accepting a mechanical shift that produces an obviously bad distribution.
- **D-03:** Confirmed direction of the reassignment (from the math, not a new decision, but binding for the plan): 5 templates move from `minTier: "business"` down to `minTier: "starter"`; 7 templates move from `minTier: "professional"` down to `minTier: "business"`. Every move is a downward relaxation — no template becomes MORE tier-restricted than it is today, so no currently-live merchant store loses access to its own template. This must hold as an explicit acceptance criterion, not an assumption: verify no template's `minTier` rank increases.

**Trial length retroactivity**
- **D-04:** The 30-day trial applies retroactively to every existing `Organization` row, not just newly-created ones. This requires zero migration: `resolve.ts` already derives trial expiry from `createdAt + TRIAL_DAYS` at read time rather than stamping a value at signup (the same "derive, never stamp" pattern SUB-01/ONB-05 established and Phase 6's SUB-03 work explicitly reuses) — changing the `TRIAL_DAYS` constant alone extends every trial, live and dev/test data alike, the moment this phase ships. No merchant's trial ever gets shorter under this change.
- **D-05:** No separate migration script, no `trialEndsAt` backfill, no dual-rate logic (some orgs on 10 days, others on 30). One constant, one meaning, applied uniformly and immediately.

### Claude's Discretion
- Exact list of which 5 template keys move business→starter and which 7 move professional→business, once D-01's mechanical shift is applied to the actual registry order — a research/planning-time computation, not a vision question.
- Whether the shift touches `TEMPLATE_KEYS`' declared order itself or only the `minTier` field per entry (leaving declaration order untouched) — an implementation detail.
- Exact wording changes needed across trial-day copy (`src/lib/strings/**`) and template-tier copy (public landing page's "Starter reaches 10 templates, Business 25, Professional all 50" line, onboarding/plan, dashboard/plan, pricing) — mechanical find-and-replace guided by the actual new cumulative-access numbers (Starter reaches 15, Business reaches 15+17=32, Professional reaches all 50).
- Whether any test fixtures or isolation tests hardcode the old 10/15/25 or 10-day numbers and need updating alongside the source change — a research task (grep for the literals) rather than something to decide now.

### Deferred Ideas (OUT OF SCOPE)
- **Hand-curated (non-mechanical) template tier reassignment** — deferred in favor of D-01's mechanical shift; revisit only if D-02's sanity check finds the mechanical result genuinely unreasonable for a specific segment.
- **A "what changed" banner or announcement copy** about the trial/tier changes — not requested, not part of this phase's scope; the changes should read as simply correct, not as a migration event surfaced to merchants.

**Reviewed Todos (not folded):** None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **ONB-05** | Every merchant gets a **30-day** full-feature trial of their selected plan, enforced server-side, starting at signup *(was 10 days)* | § Trial Change: Complete Reference Inventory (one constant + 9 copy strings). § Runtime State Inventory confirms D-04's zero-migration claim is true — verified against `resolve.ts:135`, `prisma/schema.prisma:132` and every "expired" test fixture. § Test Impact: Trial lists the exact assertion sites that must move. |
| **TMPL-04** | The full template library reaches 50 visually distinct variations (**15 Starter / 17 Business / 18 Professional**) *(was 10/15/25)* | § Template Tier Change: Computed Reassignment (three concrete options with exact key lists, all verified to hit 15/17/18 and to satisfy D-03). § Cumulative-Access Arithmetic confirms 15/32/50 against `accessibleTemplateKeys`' real semantics. § Test Impact: Templates. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These are binding on this phase's plan and are all directly relevant:

| Directive | Relevance to Phase 7 |
|-----------|---------------------|
| **UI copy is centralized in `src/lib/strings.ts`, one namespace per surface. Never inline a user-facing string literal in a component** — contract tests scan `.tsx` source for prose-shaped literals | Every copy change in this phase MUST land in `src/lib/strings/index.ts` or `src/lib/strings/marketing.ts`. Zero `.tsx` edits are needed (verified — see § Copy Surfaces). |
| **`npm run lint` runs `eslint . --max-warnings=0`** — warnings fail | Any stale comment left referencing "10 days" is not a lint failure, but a code-review failure. |
| **Every non-trivial module opens with a header comment citing the requirement/decision ID it satisfies** | Several such headers currently assert "10-day trial" and "TMPL-04's 10/15/25 split" as fact. They are documentation, and they must be updated in the same commit or the codebase's own comments become misinformation. Full list in § Comment / Documentation Debt. |
| **Do not make direct repo edits outside a GSD workflow** | Execution happens under `/gsd:execute-phase`. |
| **Two-space indent, double quotes; no Prettier** | Match surrounding style in `registry.ts` / `strings/*.ts`. |
| **`Readonly<Record<Enum, …>>` tables so a missing key is a compile error** | `PLANS` and `TEMPLATES` are both such tables — the edits here are value-only, no key changes, so no compile-error surface moves. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trial length as an enforced rule | API / Backend (`src/server/entitlements/resolve.ts`) | — | `resolveEntitlements` is a pure `(OrgRow, now) → MerchantEntitlements`; it is the only computer of trial state in the codebase (verified: `TRIAL_DAYS` has exactly two non-test, non-generated references, both in `resolve.ts`). |
| Trial length as a **stated** number | Frontend copy (`src/lib/strings/**`) | — | Per CLAUDE.md, `.tsx` never holds prose. The number appears in copy 9 times; none of them read `TRIAL_DAYS` programmatically. |
| Per-template tier assignment | API / Backend (`src/server/theming/registry.ts` `TEMPLATES[key].minTier`) | — | Data, not logic. The gate reads it; nothing else. |
| Template access enforcement | API / Backend (`src/server/theming/access.ts`) | — | `canUseTemplate` / `accessibleTemplateKeys` / `assertTemplateAccess`. **Unchanged by this phase** — they are pure functions of `minTier` and `PLAN_TIER_RANK`. |
| Documented tier catalog size | API / Backend (`src/server/entitlements/plans.ts` `PlanLimits.templates`) | — | Explicitly "the DOCUMENTED catalog size, not the gate" per its own doc comment; a unit test cross-checks it against the registry's real count, so it MUST move in lockstep. |
| Template picker rendering (locked/dimmed) | Frontend Server (RSC) | — | `onboarding/branding/page.tsx` and `dashboard/storefront/page.tsx` both derive `locked` from `accessibleTemplateKeys`. **No hardcoded counts. No change needed.** |

## Standard Stack

No new dependencies. This phase adds nothing to `package.json`.

| Existing tool | Version | Role in this phase |
|---------------|---------|--------------------|
| Vitest | 4.1.10 | `npm run test:unit` (fast, no DB), `npm run test:full` (isolation, needs `TEST_DATABASE_URL`) |
| TypeScript | 5.9.3 | `npm run typecheck` — value-only edits, no type surface change |
| ESLint 9 flat config | — | `npm run lint --max-warnings=0` |

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** No `npm install` step exists in any viable plan for this work. The slopcheck gate is therefore vacuous here and was not run.

---

## Part 1 — Trial Change (ONB-05): Complete Reference Inventory

### 1a. The constant

| File:line | Current | New | Notes |
|-----------|---------|-----|-------|
| `src/server/entitlements/resolve.ts:34` | `export const TRIAL_DAYS = 10;` | `= 30` | **The only functional change.** [VERIFIED: read at HEAD] |
| `src/server/entitlements/resolve.ts:33` | `/** ONB-05: every plan gets the same 10-day full-feature trial. */` | 30-day | Doc comment on the same constant. |

**Exhaustive `TRIAL_DAYS` reference list** (verified by repo-wide grep, excluding `src/generated/prisma/**` which only quotes the Prisma schema comment):

- `src/server/entitlements/resolve.ts:34` (declaration), `:135` (the single consumer: `org.trialEndsAt ?? new Date(org.createdAt.getTime() + TRIAL_DAYS * DAY_MS)`)
- `prisma/schema.prisma:132` — a doc comment on `Organization.trialEndsAt` reading `"derive from createdAt + TRIAL_DAYS"`. **Correct as written; no edit needed** (it names the constant, not its value).
- `tests/isolation/trial.test.ts:95,160,193,195`
- `tests/unit/entitlements.test.ts:15,52,53,270,271`

### 1b. D-04's zero-migration claim — VERIFIED, with one caveat

`resolve.ts:135` reads:

```ts
const endsAt =
  org.trialEndsAt ?? new Date(org.createdAt.getTime() + TRIAL_DAYS * DAY_MS);
```

[VERIFIED: source read at HEAD]

D-04 is therefore correct for every `Organization` row where `trialEndsAt IS NULL` — which the schema comment (`prisma/schema.prisma:132`) and `tests/isolation/trial.test.ts` both confirm is the **normal case**, since signup deliberately never stamps it.

**Caveat the planner must record as an accepted, not overlooked, consequence:** a row that *does* carry a non-null `trialEndsAt` (a support-granted override) is **not** extended by this change — the `??` short-circuits before `TRIAL_DAYS` is read. This is consistent with D-05 ("no `trialEndsAt` backfill") and with D-04's "no merchant's trial ever gets shorter", but it does mean D-04's phrase "applies retroactively to *every* existing `Organization` row" is true only of the null-`trialEndsAt` population. In practice: `tests/isolation/read-only.test.ts:201` and `tests/isolation/storefront-editor.test.ts:257` are the only writers of a non-null `trialEndsAt` anywhere in the repo, and both are test fixtures. **No production code path writes `trialEndsAt`** [VERIFIED: repo-wide grep — the only non-test occurrences are the schema, the resolver's read, and doc comments]. So in the live database the caveat has an empty population today.

### 1c. Copy surfaces — the 9 strings that state "10 days"

All in `src/lib/strings/**`. **Zero inline literals exist in `src/app/**`** [VERIFIED: `grep -rniE "(10[- ]day|ten[- ]day|10 days|ten days)" src/` returned no `src/app` hit]. There are therefore **no pre-existing inline-literal violations to flag** for the trial change.

| File:line | Current | Proposed |
|-----------|---------|----------|
| `src/lib/strings/index.ts:111` (`strings.signup.subline`) | `"Free for 10 days. No card required."` | `"Free for 30 days. No card required."` |
| `src/lib/strings/index.ts:267` (`strings.plan.subline`) | `"Free for 10 days. No card required. You can change your plan any time during your trial."` | `"Free for 30 days. …"` |
| `src/lib/strings/index.ts:277` (`strings.plan.cta`) | `"Start my 10-day trial"` | `"Start my 30-day trial"` |
| `src/lib/strings/marketing.ts:50` (`strings.root.hero.ctaNote`) | `"Free for 10 days. No card required."` | `"Free for 30 days. No card required."` |
| `src/lib/strings/marketing.ts:66` (`strings.root.templates.constraint`) | `"Starter reaches 10 templates, Business 25, Professional all 50. Every plan gets the full 10-day trial first."` | see § Part 2f — this string carries **both** changes |
| `src/lib/strings/marketing.ts:95` (`strings.root.finalCta.heading`) | `"Ten days. No card. Your own storefront."` | `"Thirty days. No card. Your own storefront."` |
| `src/lib/strings/marketing.ts:96` (`strings.root.finalCta.body`) | `"Every plan starts with a full 10-day trial of everything it includes. …"` | `"…full 30-day trial…"` |
| `src/lib/strings/marketing.ts:29` (module header comment) | `"Every numeric claim on this page (10-day trial, 10/25/50 templates per tier) matches …"` | `(30-day trial, 15/32/50 templates per tier)` |
| `src/lib/strings/index.ts:5` (module header) | `"…no locale routing … in V1 (30-day solo…"` | **DO NOT TOUCH** — this "30-day" is the *project timeline*, not the trial. A blind find-and-replace on "10 day"/"30 day" must not create a false match here. |

**Both plan surfaces read from the same namespace** [VERIFIED]: `src/app/onboarding/plan/page.tsx:143-148` and `src/app/(dashboard)/dashboard/plan/page.tsx` both consume `strings.plan.*`, so the three `strings.plan` edits cover onboarding **and** dashboard with no duplicate copy to keep in sync.

**The trial banner needs no change** [VERIFIED]: `strings.trial.daysLeft` is `"{days} days left in your trial."` and `strings.plan.dashboard.trialDaysLeft` is the same shape — both interpolate a server-computed integer. `strings.trial.oneDayLeft` is the `daysLeft === 1` variant. None hardcode 10.

---

## Part 2 — Template Tier Change (TMPL-04)

### 2a. Current state, verified by parsing the actual registry

[VERIFIED: parsed `src/server/theming/registry.ts` at HEAD with a script; 50 rows found]

- Totals: **10 starter / 15 business / 25 professional** — matches CONTEXT.md.
- `TEMPLATES` object key order is **byte-identical** to `TEMPLATE_KEYS` declaration order.
- Per-segment mix today:

| Segment | starter | business | professional |
|---|---|---|---|
| fashion-apparel | 2 | 2 | 4 |
| electronics | 2 | 3 | 4 |
| beauty-cosmetics | 2 | 2 | 4 |
| grocery-food | 1 | 3 | 4 |
| furniture-home | 2 | 2 | 4 |
| general-retail | 1 | 3 | 5 |

### 2b. **D-01's premise is false: there are no "boundary lines" to shift**

The registry is **not** ordered as a starter block, then a business block, then a professional block. Tiers alternate almost entry-by-entry, deliberately (the pattern is `starter, professional, starter, professional, business, professional, business, professional, …` within each segment — Phase 5 paired each structure with a low-tier and a high-tier sibling).

**Measured: the 50-entry declaration order contains 48 contiguous tier runs.** [VERIFIED: computed] There is no single boundary index whose movement produces 15/17/18. D-01 as literally written is not executable.

The nearest faithful reading of "shift by registration order" is: *promote the first N entries of each tier, in declaration order.* That is Option A below. (A second interpretation — stable-sort all 50 by current tier rank, then cut at index 15 and 32 — was also computed and produces the **identical** result, which is reassuring for "what did D-01 mean", and damning for the outcome.)

### 2c. Option A — literal mechanical shift (**FLAGGED: fails D-02**)

**business → starter (5):** `fashion-studio`, `fashion-runway`, `electronics-pulse`, `electronics-module`, `electronics-frame`
**professional → business (7):** `fashion-classic`, `fashion-muse`, `fashion-house`, `fashion-loft`, `electronics-signal`, `electronics-current`, `electronics-volt`

Totals: 15 / 17 / 18 ✓  ·  D-03 monotone-down invariant: holds ✓

| Segment | starter | business | professional |
|---|---|---|---|
| fashion-apparel | 4 | 4 | **0** |
| electronics | 5 | 3 | **1** |
| beauty-cosmetics | 2 | 2 | 4 |
| grocery-food | 1 | 3 | 4 |
| furniture-home | 2 | 2 | 4 |
| general-retail | 1 | 3 | 5 |

**This is precisely the outcome D-02 instructs us to flag rather than silently accept.** Three concrete problems:

1. **Fashion-apparel has zero Professional-only templates.** A Professional-tier fashion merchant gets nothing their Business-tier competitor cannot also have. The tier's value proposition collapses for the product's flagship segment.
2. **All 12 moves land in 2 of 6 segments.** The other four segments' merchants see literally no change from a headline "we expanded Starter from 10 to 15 templates" — a grocery merchant on Starter still has exactly 1 template, same as before.
3. **It inverts the intent.** The segments that most needed more Starter choice (grocery: 1, general-retail: 1) get nothing; the segments already best-served (fashion: 2, electronics: 2) go to 4 and 5.

**Recommendation: do not ship Option A.** Take Option C or D to the user per D-02's explicit escalation instruction.

### 2d. Option C — segment round-robin (**RECOMMENDED**)

Promote in declaration order **within each segment**, cycling segments so the moves spread evenly.

**business → starter (5):** `fashion-studio`, `electronics-pulse`, `beauty-radiance`, `grocery-pantry`, `furniture-timber`
**professional → business (7):** `fashion-classic`, `electronics-signal`, `beauty-veil`, `grocery-harvest`, `furniture-grain`, `retail-emporium`, `fashion-muse`

Totals: 15 / 17 / 18 ✓  ·  D-03 monotone-down invariant: holds ✓

| Segment | starter | business | professional |
|---|---|---|---|
| fashion-apparel | 3 | 3 | 2 |
| electronics | 3 | 3 | 3 |
| beauty-cosmetics | 3 | 2 | 3 |
| grocery-food | 2 | 3 | 3 |
| furniture-home | 3 | 2 | 3 |
| general-retail | 1 | 4 | 4 |

Still mechanical (no visual judgement, no per-template review — D-01's actual concern), still deterministic and re-derivable. **Residual issue: general-retail stays at 1 Starter template**, because the round-robin ran out of slots before its second pass. Option D fixes that.

### 2e. Option D — even per-segment allocation (**RECOMMENDED if general-retail's Starter floor matters**)

Target 3/3/3/2/2/2 Starter across the six segments (=15), then even out Business.

**business → starter (5):** `fashion-studio`, `electronics-pulse`, `beauty-radiance`, `grocery-pantry`, `retail-bazaar`
**professional → business (7):** `fashion-classic`, `fashion-muse`, `electronics-signal`, `beauty-veil`, `beauty-satin`, `grocery-harvest`, `furniture-grain`

Totals: 15 / 17 / 18 ✓  ·  D-03 monotone-down invariant: holds ✓

| Segment | starter | business | professional |
|---|---|---|---|
| fashion-apparel | 3 | 3 | 2 |
| electronics | 3 | 3 | 3 |
| beauty-cosmetics | 3 | 3 | 2 |
| grocery-food | 2 | 3 | 3 |
| furniture-home | 2 | 3 | 3 |
| general-retail | 2 | 2 | 5 |

Every segment now has **at least 2 Starter templates** (up from a floor of 1) and **at least 2 Professional-only templates**. This is the most defensible distribution of the three.

**Verified for all three options:** no template's `minTier` rank increases (D-03's acceptance criterion), and no template moves more than one rank.

### 2f. Cumulative-access arithmetic — CONFIRMED against real semantics, not assumed

CONTEXT.md's discretion note asserts Starter reaches 15, Business 32, Professional 50. **Confirmed** by reading the gate rather than assuming nesting:

- `PLAN_TIER_RANK = { starter: 0, business: 1, professional: 2 }` (`src/server/entitlements/plans.ts:43-47`) [VERIFIED]
- `accessibleTemplateKeys(tier)` returns `TEMPLATE_KEYS.filter(key => rank >= PLAN_TIER_RANK[TEMPLATES[key].minTier])` (`src/server/theming/access.ts:74-82`) [VERIFIED]

Because the predicate is `>=` against a total order, the sets are **strictly nested** — Business's set is Starter's set plus every `minTier: "business"` template. Therefore, post-change:

| Tier | Reachable count | Composition |
|------|-----------------|-------------|
| Starter | **15** | the 15 `minTier: "starter"` templates |
| Business | **32** | 15 + 17 |
| Professional | **50** | 15 + 17 + 18 |

`tests/unit/template-distinctiveness.test.ts:346-348` already asserts exactly this nesting property plus the triple, so the arithmetic is machine-checked once the numbers are updated.

### 2g. `PlanLimits.templates` must move in lockstep

| File:line | Current | New |
|-----------|---------|-----|
| `src/server/entitlements/plans.ts:202` (`PLANS.starter.limits.templates`) | `10` | `15` |
| `src/server/entitlements/plans.ts:216` (`PLANS.business.limits.templates`) | `25` | `32` |
| `src/server/entitlements/plans.ts:230` (`PLANS.professional.limits.templates`) | `null` | `null` — unchanged |

`tests/unit/template-distinctiveness.test.ts:353-354` asserts `starter.size === PLANS.starter.limits.templates` and the same for business. **Missing this edit is a red unit test, not a silent drift** — the codebase already defends this.

### 2h. Template-count copy — the 4 strings

| File:line | Current | Proposed |
|-----------|---------|----------|
| `src/lib/strings/index.ts:292` (`strings.plan.starter.features[1]`) | `"10 templates with your logo, brand colors and basic sections"` | `"15 templates with your logo, brand colors and basic sections"` |
| `src/lib/strings/index.ts:310` (`strings.plan.business.features[1]`) | `"25 templates reachable (Starter's 10, plus 15 more)"` | `"32 templates reachable (Starter's 15, plus 17 more)"` |
| `src/lib/strings/index.ts:329` (`strings.plan.professional.features[1]`) | `"All 50 templates reachable"` | **unchanged** |
| `src/lib/strings/marketing.ts:66` (`strings.root.templates.constraint`) | `"Starter reaches 10 templates, Business 25, Professional all 50. Every plan gets the full 10-day trial first."` | `"Starter reaches 15 templates, Business 32, Professional all 50. Every plan gets the full 30-day trial first."` |

Also **unchanged and correct**: `strings.root.templates.heading` = `"Fifty templates. Six industries. Not one of them generic."` — the 50 total does not move.

### 2i. Picker surfaces need no code change — but note a divergence

Both picker surfaces derive everything from `accessibleTemplateKeys`; neither hardcodes a count [VERIFIED]:

- `src/app/onboarding/branding/page.tsx:167-188` builds **all 50** tiles and sets `locked: !accessibleKeys.has(key)` — the "sort, never filter" rule.
- `src/app/(dashboard)/dashboard/storefront/page.tsx:98-127` (`editorTemplateTiles`) builds tiles from **`accessible` only**, plus the merchant's current key if it is out of tier.

**Flag for the verifier, not for the plan:** ROADMAP Phase 7 success criterion 3 says "locked templates stay visible-but-dimmed in the picker rather than disappearing." That is true of the **onboarding** picker and **not** true of the **dashboard themes browser**, which shows only reachable templates. This is a **pre-existing Phase 5/05.3 design divergence, not something this phase introduces or should fix** — but a verifier reading criterion 3 literally against the dashboard surface will report a false failure. Worth one sentence in the plan's notes.

---

## Part 3 — Test Impact (the largest slice of this phase's real work)

### 3a. Trial: `tests/unit/entitlements.test.ts` — 6 red, 2 vacuous

The file defines `const DERIVED_END = new Date(T0.getTime() + TRIAL_DAYS * DAY_MS)` (L53) — that half is already `TRIAL_DAYS`-relative and safe. The damage is in the **absolute** `at(N * DAY_MS)` call sites.

| Line | Assertion | At `TRIAL_DAYS = 30` | Required fix |
|------|-----------|---------------------|--------------|
| **271** | `expect(TRIAL_DAYS).toBe(10)` | **RED** | `.toBe(30)` |
| **275-279** | `daysLeft` at day 1 expects `9`; at day 9 expects `1` | **RED (both)** | Re-express: `TRIAL_DAYS - 1` and `TRIAL_DAYS - 9`, or better, re-anchor via the existing `atDaysLeft()` helper |
| **326** | `at(11 * DAY_MS)` → `expect(state).toBe("expired")`, `isUrgentTrial === false` | **RED** — day 11 is now mid-trial with 19 days left | `at((TRIAL_DAYS + 1) * DAY_MS)` |
| **365** | `const AFTER_TRIAL = at(11 * DAY_MS)` — consumed across the whole D-15 editor-capability block | **RED (cascades)** | `at((TRIAL_DAYS + 1) * DAY_MS)` |
| **497** | `ctxAt({ planTier: "starter" }, at(11 * DAY_MS))` → expects `EditorLockedError` | **RED** | `at((TRIAL_DAYS + 1) * DAY_MS)` |
| **245-253** | "lets a stored `trialEndsAt` override the `createdAt` derivation": `granted = at(30 * DAY_MS)`, resolved at day 20 | **PASSES BUT GOES VACUOUS** — at `TRIAL_DAYS = 30`, `granted` is *exactly* `DERIVED_END`, so the test can no longer detect a resolver that ignores `trialEndsAt` entirely | `granted = at((TRIAL_DAYS + 20) * DAY_MS)` |
| **226-232** | "is subscribed, and writable, **once past the end**" at `at(30 * DAY_MS)` | **PASSES** (the `subscribed` branch short-circuits) but day 30 is now *exactly* the end, not past it — the test name becomes false | `at((TRIAL_DAYS + 1) * DAY_MS)` |
| **180** | `it("is active on day 9")` at `at(9 * DAY_MS)` | **PASSES** but loses its meaning (it was a near-boundary probe on a 10-day window) | Consider `at((TRIAL_DAYS - 1) * DAY_MS)` and rename |
| **363** | `DURING_TRIAL = at(2 * DAY_MS)` + comment `/** Inside the derived 10-day window. */` | passes; comment stale | comment only |
| **297** | `at(90 * DAY_MS)` → `daysLeft === 0` | passes (90 > 30) | none |
| **511** | subscribed Business at `at(30 * DAY_MS)` | passes (subscribed short-circuits) | none |
| **303-322** | The whole `urgency` block via `atDaysLeft(n)` — computed off `DERIVED_END` | passes, correctly, at any `TRIAL_DAYS` | **none — this is the pattern to imitate** |

**Structural recommendation for the planner:** the `urgency` block's `atDaysLeft(days) => new Date(DERIVED_END.getTime() - days * DAY_MS)` helper is already `TRIAL_DAYS`-agnostic and survives this change untouched. Re-express the failing sites in that register rather than swapping `11` for `31`. That converts "this test breaks every time the trial length changes" into "this test never breaks again", and it directly serves ROADMAP success criterion 4 ("a later edit that reintroduces a 10-day trial … fails the build").

### 3b. Trial: `tests/isolation/trial.test.ts` — 2 red

| Line | Assertion | Fix |
|------|-----------|-----|
| **195** | `expect(TRIAL_DAYS).toBe(10)` | `.toBe(30)` |
| **199** | `expect(ctx.trial.daysLeft).toBe(10)` | `.toBe(TRIAL_DAYS)` (preferred) or `30` |
| 7, 17, 131, 159 | prose: "the 10-day trial", `"createdAt + 10 days"`, test name `"derives endsAt as createdAt + 10 days …"`, `"the 10-day window"` | text only |
| 193 | `createdAt.getTime() + TRIAL_DAYS * DAY_MS` | **already correct — no change** |

Note this file requires `TEST_DATABASE_URL` (`npm run test:full`). If that Neon test branch is unavailable at execution time, this file cannot be run and the phase gate must say so explicitly rather than declaring green off the unit suite alone.

### 3c. Trial: fixtures that are **NOT** affected (verified, so the planner does not chase them)

- `tests/isolation/read-only.test.ts:201` — forces expiry via `trialEndsAt: new Date(Date.now() - 24h)`, an explicit override. `??` short-circuits before `TRIAL_DAYS`. **Unaffected.**
- `tests/isolation/storefront-editor.test.ts:257` — same pattern (`trialEndsAt: new Date(Date.now() - DAY_MS)`). **Unaffected.**
- `tests/setup/seed-two-tenants.ts` — `FIXTURE_EPOCH = 2026-01-01`, and the seed never writes `trialEndsAt`. Long expired at both 10 and 30 days. **Unaffected.**
- `tests/isolation/template-switch.test.ts:341-368` — asserts an *active* trial (`trialEndsAt: null`, day 0) so the refusal below can only be the tier gate. Lengthening the trial only strengthens its premise. **Unaffected.**
- `prisma/seed.ts` — contains no trial/`createdAt` references at all. **Unaffected.**
- `src/app/**` — no inline trial literal anywhere. **Unaffected.**

### 3d. Templates: `tests/unit/template-distinctiveness.test.ts` — 1 red, and it is the good kind

| Line | Assertion | Impact |
|------|-----------|--------|
| **346-348** | `expect([starter.size, business.size, professional.size]).toEqual([10, 25, 50])` | **RED** → `[15, 32, 50]` |
| **353-354** | `expect(starter.size).toBe(PLANS.starter.limits.templates)` (+ business) | Passes only if `plans.ts` is edited in the same commit — this is the lockstep guard |
| **355-359** | `PLANS.professional.limits.templates` must stay `null` | unchanged |
| **336-344** | nesting: Starter ⊆ Business ⊆ Professional | holds for all three options |
| **291-309** | "gives every segment at least one Starter-accessible template" | **holds under all three options** (no segment loses a Starter template — every move is downward) [VERIFIED by computation] |
| **313-326** | "spans at least 8 distinct structures in the Starter-accessible set" | Starter grows 10 → 15, a superset, so distinct-structure count can only rise. **Holds.** |
| 330 | test name `"keeps the tier sets nested and the cumulative counts at 10/25/50"` | rename to `15/32/50` |

### 3e. Templates: tests whose **comments and names** go false but whose assertions still pass

These are the trap. They stay green, so a plan that only chases red tests will leave the repository asserting things its own comments contradict.

| File:line | Text | What happens |
|-----------|------|--------------|
| `tests/isolation/template-switch.test.ts:373` | `// "fashion-classic" is professional-tier (registry.ts) — out of reach for a Starter merchant` | Under **all three options** `fashion-classic` becomes **business**-tier. Fixture is Starter (asserted at L368), so business is still out of reach → **assertion passes, comment is now wrong.** |
| `tests/isolation/onboarding-template.test.ts:404` | test name: `"refuses a **Professional** key from a Starter-tier organization"` + L415 comment `"fashion-classic" is professional-tier` | Same: passes, but the test no longer tests what its name says. |
| `tests/isolation/template-switch.test.ts:532` | `// "fashion-studio" is business-tier — reachable by this fixture's tier` | Under **all three options** `fashion-studio` becomes **starter**-tier. Still reachable → passes, comment wrong. |

**Recommended fix, not just a comment edit:** in the two "refuses a Professional key" tests, swap the key to one that remains `minTier: "professional"` under whichever option is chosen, so the test keeps testing the tier it names. Keys that stay Professional under **all three** options (safe regardless of the user's choice): `beauty-luxe`, `beauty-muse`, `grocery-larder`, `grocery-grove`, `furniture-haven`, `furniture-loft`, `retail-mercantile`, `retail-provisions`, `retail-trading`, `retail-district`. `retail-district` is the cleanest pick — it is Professional today, Professional in A, C and D, and is not referenced by any other test.

### 3f. Tests that are **NOT** affected by the tier change (verified)

- `tests/unit/template-preview-manifest.test.ts` — asserts 50 keys and manifest completeness. Tier-agnostic. The `"fashion-classic"` occurrences at L164-202 are ordering fixtures, not tier claims.
- `tests/unit/theming-registry.test.ts` — asserts section/variant/document shape for all 50. Tier-agnostic.
- `tests/unit/template-picker-contract.test.ts` — a source-scanning contract on the picker component's CSS/ARIA (`aspect-[16/10]`, `@container`, `disabled=`/`aria-disabled` on locked cards). Contains no tier counts. **The `16/10` in `aspect-[16/10]` is an aspect ratio — a find-and-replace on "10" must not touch it.**
- `tests/unit/landing-page-contract.test.ts` — see 3g.

### 3g. CLAUDE.md's prose-literal contract tests — CONFIRMED SAFE

The additional-context question #5 asks whether any *new* literal this phase introduces could trip the centralization contract test. **It cannot.** Verified mechanics:

1. **`tests/unit/dashboard-nav.test.ts:244`** — scans **only** the sidebar module (`SIDEBAR_FILE`), not the whole tree. Its `looksLikeProse(value)` (L183-188) requires **≥3 words, every word matching `/^[A-Za-z][A-Za-z'']*$/`** — i.e. purely alphabetic. `"Free for 30 days."` contains `30` and would not match even if it were scanned. This phase touches no `.tsx`, so the scan is doubly unreachable.
2. **`tests/unit/landing-page-contract.test.ts:218`** — `"inlines no user-facing prose in src/app/page.tsx"`, same triple, same all-alphabetic predicate. This phase makes no `src/app/page.tsx` edit.
3. **`tests/unit/landing-page-contract.test.ts:279`** — `BANNED_PHRASES` over `src/lib/strings/marketing.ts`. The list is `/custom domain/i, /discount code/i, /bulk import/i, /staff account/i, /delivery zone/i, /low-stock/i, /priority support/i, /testimonial/i, /trusted by/i, /millions/i, /thousands of/i, /\d[\d,]*\+?\s*(merchants?|businesses?|stores?)\b/i`. **None of the proposed marketing strings match any of these.** In particular `"Starter reaches 15 templates, Business 32, Professional all 50."` — the digit-headcount regex requires the digit to be followed by *merchants/businesses/stores*, and `"32, Professional"` and `"15 templates"` do not match.
4. **`tests/unit/landing-page-contract.test.ts:303`** — voice contract: no `!`, no `oops|whoops`. All proposed copy complies.
5. **`registry.ts`'s own header rule** ("NO USER-FACING PROSE IN THIS FILE", L46-55) — this phase changes only `minTier` values in that file, no labels. Compliant.

**Conclusion: all copy changes route through `src/lib/strings/**` as CLAUDE.md requires, and no contract test is at risk.** [VERIFIED by reading the predicates, not by assuming]

---

## Runtime State Inventory

This is a value-change phase with a rename-like blast radius, so the inventory applies.

| Category | Items found | Action required |
|----------|-------------|-----------------|
| **Stored data** | `Organization.trialEndsAt` — **NULL for every row written by the signup path** (`prisma/schema.prisma:132`; `tests/isolation/trial.test.ts:157` asserts signup leaves it NULL). Trial expiry is derived at read time from `createdAt`, never stored. `StorefrontTheme.draftTemplateKey`/`publishedTemplateKey` store a template *key*, never a tier. | **None.** D-04/D-05's zero-migration claim is verified correct. No backfill, no migration file, no data touch. Every existing org's trial extends the moment the constant ships. |
| **Live service config** | None — this product has no externally-hosted workflow/config surface. Vercel env vars carry no trial or tier values (`src/env.ts` schema contains neither). | None — verified by reading `src/env.ts`'s server and client blocks. |
| **OS-registered state** | None — no scheduled tasks, cron, or process-manager registrations exist in this repo. | None. |
| **Secrets / env vars** | None. `TRIAL_DAYS` and the tier split are compile-time constants, not env-configurable. | None. |
| **Build artifacts / generated code** | `src/generated/prisma/**` embeds the Prisma schema text, which contains the comment `"derive from createdAt + TRIAL_DAYS"` — a *reference to the constant name*, not its value. Regeneration is unnecessary and would produce no diff. `src/server/theming/preview-manifest.ts` + the R2 preview images are keyed by template key, **not** by tier. | **None.** Do **not** run `npm run templates:previews` — tier changes do not invalidate any preview. |

**The canonical question — "after every file is updated, what runtime system still holds the old value?" — answers: nothing.** This is the payoff of the derive-never-stamp pattern, and it is worth stating in the plan as a verified fact rather than an assumption.

---

## Comment / Documentation Debt

Source comments in this codebase are load-bearing (CLAUDE.md: headers cite the decision ID they satisfy). These state the old values as fact and will be actively misleading after the change:

| File:line | Text |
|-----------|------|
| `src/server/entitlements/resolve.ts:23` | `ONB-05 reads "10 days from signup"` |
| `src/server/entitlements/resolve.ts:33` | `/** ONB-05: every plan gets the same 10-day full-feature trial. */` |
| `src/server/entitlements/resolve.ts:97` | `a Starter merchant on day 2 of their 10 days has the same editor …` |
| `src/server/entitlements/plans.ts:123` | `D-15 grants every merchant full editor capability during the 10-day trial` |
| `src/server/entitlements/plans.ts:139-141` | `Business's 25 is Starter's 10 plus 15 more` |
| `src/server/theming/access.ts:13` | `TMPL-04's 10/15/25 split is enforced HERE` |
| `src/server/theming/access.ts:37` | `D-15 elevates the EDITOR during the 10-day trial` |
| `src/lib/strings/marketing.ts:29` | `(10-day trial, 10/25/50 templates per tier)` |
| `tests/unit/entitlements.test.ts:362` | `/** Inside the derived 10-day window. */` |
| `tests/unit/entitlements.test.ts:23,347` | `ONB-05 (10-day trial …)`, `day 2 of their 10-day trial` |
| `tests/isolation/trial.test.ts:7,17,131,159` | four "10-day" / "createdAt + 10 days" references incl. a test name |

`.planning/` docs (PROJECT.md L52, ROADMAP.md L27/L141) deliberately retain "10 days" as **historical record** of what Phase 2 shipped — per REQUIREMENTS.md L323. **Do not update those.**

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Extending existing merchants' trials | A migration or `trialEndsAt` backfill script | Nothing — change the constant | `resolve.ts:135` already derives from `createdAt`. A backfill would *stamp* values and permanently break the derive-never-stamp invariant `tests/isolation/trial.test.ts:157` guards. This is D-05, and it is verified correct. |
| Enforcing the new tier counts | A count check against `PLANS[tier].limits.templates` | `accessibleTemplateKeys` / `canUseTemplate` (unchanged) | `plans.ts:146-161` explicitly warns: the count key is "the DOCUMENTED catalog size, not the gate." Gating on it would make the reachable set depend on declaration order. |
| Keeping the documented count and the real count in sync | Manual review | `tests/unit/template-distinctiveness.test.ts:353-354` (already exists) | It already cross-checks. Just update the expected numbers. |
| Trial-day copy interpolation | Building a `{days}`-templated trial-length string that reads `TRIAL_DAYS` | Plain literals in `strings` | The codebase deliberately keeps marketing copy as literals with a source-scanning honesty test (`landing-page-contract.test.ts`) rather than a runtime interpolation; introducing interpolation here is scope creep and would defeat that test's ability to read the claim. |

---

## Common Pitfalls

### Pitfall 1: Blind find-and-replace on "10"
**What goes wrong:** `aspect-[16/10]` in `tests/unit/template-picker-contract.test.ts:200-201` and `src/app/onboarding/branding/*` is a preview aspect ratio. `"Up to 10 staff accounts"` (`strings.plan.professional.features`) is a seat count. `"1 day left in your trial."` is a plural variant. `src/lib/strings/index.ts:5`'s "30-day solo" is the *project timeline*.
**How to avoid:** Work from the explicit file:line tables in Parts 1c, 2g and 2h. Every site is enumerated; there is no need to search.
**Warning sign:** A diff touching a `.tsx` file, or touching `strings.trial.*`.

### Pitfall 2: Fixing only the red tests
**What goes wrong:** Three tests (§3e) keep passing while their names and comments become factually false, and two more (§3a L245-253, L226-232) keep passing while going **vacuous** — they can no longer detect the bug they exist to catch.
**How to avoid:** Treat §3a and §3e as the checklist, not the test runner's output.
**Warning sign:** `npm run test:unit` green with `git diff --stat` showing no change to `template-switch.test.ts` or `onboarding-template.test.ts`.

### Pitfall 3: Shipping Option A because D-01 said "mechanical"
**What goes wrong:** Fashion-apparel ends with zero Professional templates; the four segments that most needed Starter choice get nothing. D-02 exists precisely to catch this, and it triggers.
**How to avoid:** Escalate to the user with Options C and D before writing the registry diff. D-02 is a locked decision that *requires* the flag.
**Warning sign:** A plan task that says "apply the mechanical shift" without a `checkpoint:human-verify` in front of it.

### Pitfall 4: Editing `registry.ts`'s `TEMPLATE_KEYS` declaration order
**What goes wrong:** `TEMPLATE_KEYS` order is load-bearing: `accessibleTemplateKeys` returns in that order (`access.ts:64-66`), `onboarding/branding/page.tsx` uses it as the stable within-segment tiebreaker (L197-207), and `template-preview-manifest.test.ts` asserts manifest order against it.
**How to avoid:** CONTEXT.md leaves this to discretion — **choose "only the `minTier` field per entry."** Do not reorder. Twelve one-word edits, nothing else.
**Warning sign:** Any diff line inside the `export const TEMPLATE_KEYS = [...]` block.

### Pitfall 5: Regenerating template previews
**What goes wrong:** `npm run templates:previews` re-renders 50 storefronts and re-uploads to R2 — expensive, slow, and it produces no meaningful diff because previews are keyed by template key, not tier.
**How to avoid:** Don't run it. Nothing in this phase invalidates a preview.

### Pitfall 6: Assuming the dashboard themes browser shows locked templates
**What goes wrong:** ROADMAP criterion 3 implies visible-but-dimmed everywhere; `dashboard/storefront/page.tsx:98-108` filters to `accessible` + the current key. A verifier checks the dashboard, sees no dimmed cards, and reports a regression this phase did not cause.
**How to avoid:** Note the divergence in the plan; verify criterion 3 against `/onboarding/branding`.

---

## Code Examples

### The one functional change

```ts
// src/server/entitlements/resolve.ts:33-34
/** ONB-05: every plan gets the same 30-day full-feature trial. */
export const TRIAL_DAYS = 30;
```

Nothing else in the trial path moves — `resolve.ts:135`'s `org.trialEndsAt ?? new Date(org.createdAt.getTime() + TRIAL_DAYS * DAY_MS)` already does the right thing for every existing row.

### The test pattern that survives future changes (already in the repo — imitate it)

```ts
// tests/unit/entitlements.test.ts:304-305 — the urgency block's helper.
// Anchored to DERIVED_END (= T0 + TRIAL_DAYS * DAY_MS), so it is correct at
// any trial length. Every RED site in §3a should be re-expressed in this
// register instead of having its literal renumbered.
const atDaysLeft = (days: number): Date =>
  new Date(DERIVED_END.getTime() - days * DAY_MS);
```

### The registry edit shape (12 of these, value-only)

```ts
// src/server/theming/registry.ts — e.g. under Option D
  "fashion-studio": {
    key: "fashion-studio",
    segment: "fashion-apparel",
    minTier: "starter",   // was "business"
    sections: [ /* UNCHANGED */ ],
  },
```

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10, two projects (`unit`, `isolation`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test:unit` (`vitest run tests/unit --reporter=dot`) — no database |
| Full suite command | `npm run test:full` (`dotenv -e .env.test -- vitest run`) — requires `TEST_DATABASE_URL` |
| Gates | `npm run lint` (`--max-warnings=0`), `npm run typecheck`, `npm run build` |

### Phase Requirements → Test Map

| Req | Behavior | Type | Automated command | File exists? |
|-----|----------|------|-------------------|--------------|
| ONB-05 | `TRIAL_DAYS === 30` | unit | `npx vitest run tests/unit/entitlements.test.ts -t "daysLeft"` | ✅ (assertion must change) |
| ONB-05 | Trial active mid-window, expired at boundary, at 30 days | unit | `npx vitest run tests/unit/entitlements.test.ts -t "trial"` | ✅ (offsets must be re-anchored) |
| ONB-05 | D-15 editor grant during / after a 30-day trial | unit | `npx vitest run tests/unit/entitlements.test.ts -t "editor capability"` | ✅ (`AFTER_TRIAL` must move) |
| ONB-05 | `endsAt === createdAt + 30d` with `trialEndsAt` NULL, end-to-end | isolation | `npm run test:full -- tests/isolation/trial.test.ts` | ✅ (2 assertions must change) |
| ONB-05 | Every trial-day figure a merchant reads says 30 | manual | — | ❌ **manual-only**: no DOM in the unit project; requires a walkthrough of `/`, `/signup`, `/onboarding/plan`, `/dashboard/plan` on `localhost:3001` |
| TMPL-04 | Reachable counts are 15/32/50 and remain nested | unit | `npx vitest run tests/unit/template-distinctiveness.test.ts -t "nested"` | ✅ (numbers must change) |
| TMPL-04 | Documented `PlanLimits.templates` matches the registry's real count | unit | same block, L353-354 | ✅ (guard already exists) |
| **TMPL-04 / D-03** | **No template's `minTier` rank increased** | unit | — | ❌ **Wave 0 gap** — see below |
| TMPL-04 | Segment tier-mix sanity (D-02) | unit | — | ❌ **Wave 0 gap** — see below |
| TMPL-04 | Out-of-tier template selection still refused server-side | isolation | `npm run test:full -- tests/isolation/template-switch.test.ts tests/isolation/onboarding-template.test.ts` | ✅ (key/comment swap per §3e) |
| TMPL-04 | Locked templates stay visible-but-dimmed at onboarding | unit (source-scan) | `npx vitest run tests/unit/template-picker-contract.test.ts` | ✅ unchanged |

### Sampling Rate

- **Per task commit:** `npm run test:unit && npm run lint && npm run typecheck`
- **Per wave merge:** `npm run test:unit` + `npm run test:full` (isolation, needs `TEST_DATABASE_URL`)
- **Phase gate:** full suite green + `npm run build` + the manual copy walkthrough on `localhost:3001`

### Wave 0 Gaps

- [ ] **A D-03 invariant test.** D-03 requires "no template's `minTier` rank increases" as an *explicit acceptance criterion, not an assumption*, and nothing in the suite currently expresses it. A minimal, honest form: pin the expected post-change `minTier` for all 50 keys as a frozen table in the test and assert `TEMPLATES[key].minTier` matches — a snapshot of the *decision*, which also makes any future accidental re-tiering a red build. (A rank-comparison against the pre-change values requires committing the old table too; the frozen-table form is simpler and achieves the same protection going forward.)
- [ ] **A D-02 segment-balance test** (optional but cheap): assert every `INDUSTRY_SEGMENT` has ≥2 Starter-accessible templates and ≥1 Professional-only template. This is what would have caught Option A automatically, and it would prevent a future re-tiering from silently emptying a segment's top tier. Note the existing L291 rule only requires **≥1** Starter per segment.
- [ ] No framework install needed — Vitest, both projects, and all fixtures already exist.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | everything | ✓ | v24.16.0 (meets the Node 24 LTS requirement) | — |
| npm | everything | ✓ | 11.13.0 | — |
| Vitest `unit` project | all unit assertions | ✓ | 4.1.10, no DB needed | — |
| `TEST_DATABASE_URL` (Neon test branch) | `tests/isolation/trial.test.ts`, `template-switch.test.ts`, `onboarding-template.test.ts` | **not verified** — `.env.test` is gitignored and was not read | — | None. `tests/setup/global-setup.ts` **fails closed** rather than falling back to the dev branch, so an absent value means the isolation suite cannot run at all. |
| Dev server on `localhost:3001` | the manual copy walkthrough | not checked this session | — | The copy change is also verifiable by reading `src/lib/strings/**`, but criterion 1 ("no surface still says 10") is only honestly demonstrable in a browser. |

**Missing dependencies with no fallback:** `TEST_DATABASE_URL` availability is unconfirmed. If the isolation suite cannot run, the plan must say so at the phase gate rather than reporting green off the unit suite — `tests/isolation/trial.test.ts` carries two of the four ONB-05 assertions.

---

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section is included.

### Applicable ASVS categories

| ASVS Category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | no | Untouched — Better Auth, no change |
| V3 Session Management | no | Untouched |
| **V4 Access Control** | **yes** | This phase changes **authorization data**. The gate itself (`assertTemplateAccess`, `assertCanWrite`) is unchanged, but the values it reads are relaxed. Every change is a **relaxation**, never a tightening. |
| V5 Input Validation | no | No new input surface; no Zod schema changes |
| V6 Cryptography | no | None involved |

### Known threat patterns for this change

| Pattern | STRIDE | Mitigation status |
|---------|--------|-------------------|
| **Privilege relaxation is intentional but must be bounded** — a Starter merchant gains access to 5 more templates and 20 more trial days | Elevation of Privilege | **Intentional, and bounded by construction.** Verified: no template's `minTier` rank increases under any of the three options; no plan gains a *capability* (`storefrontEditor`, `discountCodes`, `bulkImport`, `members`, `products` all unchanged). |
| Trial extension as a write-gate bypass window | Elevation of Privilege | `canWrite = subscribed \|\| !expired` is unchanged. A 30-day trial means 20 more days of writes for a non-paying merchant — an accepted commercial decision (locked at PROJECT.md, 2026-09-13), not a defect. Product caps (`products: 50` for Starter) still apply throughout the trial. |
| Client-side-only tier gating (Phase 5 "Pitfall 6") | Elevation of Privilege | Already mitigated and **must stay** mitigated: `assertTemplateAccess` (`access.ts:95-103`) throws on the write path independent of the picker's `locked` flag. `tests/isolation/template-switch.test.ts` and `onboarding-template.test.ts` pin the server-side refusal. This phase must not weaken either — see §3e's recommendation to swap in a still-Professional key so the refusal test keeps testing a genuine out-of-tier case. |
| D-12 no-auto-migration corollary | Tampering | Unaffected. `variantsForTemplate` and the storefront renderer never consult `minTier` (`access.ts:19-26`). A merchant on a template whose tier changed keeps rendering it either way — and since every move is downward, none could lose access regardless. |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The user will accept a **non-literal** reading of D-01 (segment-balanced rather than pure declaration-order) once shown Option A's outcome | Part 2c-2e | If they insist on Option A verbatim, fashion-apparel ships with zero Professional templates. **Mitigation: this is exactly the escalation D-02 mandates — the plan must gate the registry edit behind a `checkpoint:human-verify`, not pick an option unilaterally.** |
| A2 | The exact new copy wording (e.g. `"Thirty days. No card. Your own storefront."`) is acceptable | Part 1c, 2h | Low risk — CONTEXT.md marks wording as Claude's discretion and calls it a mechanical find-and-replace. |
| A3 | `TEST_DATABASE_URL` is configured and the Neon test branch is reachable | Environment Availability | If absent, two of four ONB-05 assertions cannot run. Verify before the phase gate. |
| A4 | The D-03 invariant test should take the frozen-table form rather than a before/after rank comparison | Wave 0 Gaps | Low — either form satisfies D-03; the frozen table is simpler and provides ongoing protection. |

**Everything else in this document was verified by direct source read or by executing a parser over the real registry file.** No claim here rests on training-data recall about this codebase.

---

## Open Questions (RESOLVED — Q1 by CONTEXT.md D-06, Q2 by 07-02 Task 3's fashion-classic→retail-district swap, Q3 by 07-03 Task 1's probe-and-report step)

1. **Which tier-reassignment option ships?**
   - What we know: all three hit 15/17/18 exactly and all three satisfy D-03's monotone-down invariant. Option A is D-01's literal reading and fails D-02's sanity gate. Options C and D are equally mechanical and pass it.
   - What's unclear: whether the user weights "literal fidelity to D-01" above "balanced segments," and whether general-retail's Starter floor (1 under C, 2 under D) matters.
   - Recommendation: **Option D.** Present the three per-segment tables side by side and let the user pick. Gate the registry edit behind a `checkpoint:human-verify` task. Do not let the planner choose silently.

2. **Should the two "refuses a Professional key" tests keep using `fashion-classic`?**
   - What we know: under all three options `fashion-classic` becomes Business-tier, so both tests keep passing while their names become false.
   - Recommendation: swap to `retail-district` (Professional under all three options, referenced by no other test) and keep the test names honest. Low cost, preserves intent.

3. **Is `tests/isolation/trial.test.ts` runnable at execution time?**
   - What we know: it needs `TEST_DATABASE_URL`; `global-setup.ts` fails closed.
   - Recommendation: probe `.env.test` in the plan's first task and record the answer, so the phase gate reports honestly rather than claiming green off `test:unit`.

---

## State of the Art

Not applicable — this phase involves no external technology whose state could have moved. Every fact here is a property of this repository at HEAD on 2026-09-13.

---

## Sources

### Primary (HIGH confidence — direct source reads at HEAD)

- `src/server/entitlements/resolve.ts` — `TRIAL_DAYS`, the derive-from-`createdAt` expiry, `MerchantContext`, `isUrgentTrial`
- `src/server/entitlements/plans.ts` — `PLAN_TIER_RANK`, `PLANS`, `PlanLimits.templates` and its "documented, not the gate" warning
- `src/server/theming/registry.ts` — all 50 `TEMPLATES` rows (parsed programmatically), `TEMPLATE_KEYS`, `INDUSTRY_SEGMENTS`
- `src/server/theming/access.ts` — `canUseTemplate`, `accessibleTemplateKeys`, `assertTemplateAccess`
- `src/lib/strings/index.ts`, `src/lib/strings/marketing.ts` — all trial-day and template-count copy
- `src/app/onboarding/branding/page.tsx`, `src/app/(dashboard)/dashboard/storefront/page.tsx`, `src/app/onboarding/plan/page.tsx`, `src/app/(dashboard)/dashboard/plan/page.tsx`
- `tests/unit/entitlements.test.ts`, `tests/unit/template-distinctiveness.test.ts`, `tests/unit/dashboard-nav.test.ts`, `tests/unit/landing-page-contract.test.ts`, `tests/unit/template-picker-contract.test.ts`
- `tests/isolation/trial.test.ts`, `tests/isolation/template-switch.test.ts`, `tests/isolation/onboarding-template.test.ts`, `tests/isolation/read-only.test.ts`, `tests/isolation/storefront-editor.test.ts`, `tests/setup/seed-two-tenants.ts`
- `prisma/schema.prisma`, `prisma/seed.ts`, `package.json`, `.planning/config.json`
- `.planning/phases/07-.../07-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `./CLAUDE.md`

### Computed (HIGH confidence)

- Tier totals, contiguous-run count (48), the three reassignment options, and every per-segment table were produced by a script parsing `registry.ts` directly, not by manual counting. Each option was machine-verified for the 15/17/18 totals and the D-03 monotone-down invariant.

### Secondary / Tertiary

- None. No web search or external documentation was needed or used.

---

## Metadata

**Confidence breakdown:**
- Reference inventory (trial + template counts): **HIGH** — exhaustive greps across `src/`, `tests/`, `prisma/`, `scripts/`, cross-checked with targeted reads
- Tier reassignment computation: **HIGH** — parsed from source, three options each machine-verified against the totals and the invariant
- Test impact analysis: **HIGH** — each affected assertion was read in context and its post-change outcome reasoned through individually, including the two vacuous-not-red cases
- Zero-migration claim (D-04/D-05): **HIGH** — verified at the `??` in `resolve.ts:135`, at the schema comment, and against every `trialEndsAt` writer in the repo
- Contract-test safety (CLAUDE.md item #5): **HIGH** — verified by reading the `looksLikeProse` predicate and the `BANNED_PHRASES` list, not by assuming
- D-02 segment-balance judgement: **MEDIUM** — the numbers are exact; whether "zero Professional templates in fashion" is unacceptable is a product call, which is why it is escalated rather than decided

**Research date:** 2026-09-13
**Valid until:** Until `src/server/theming/registry.ts`, `src/server/entitlements/{resolve,plans}.ts`, `src/lib/strings/**`, or the named test files change. Because Phase 6 is executing concurrently and touches dashboard surfaces, **re-run the greps in Parts 1c and 2h at plan time** if Phase 6 lands first — this document is a snapshot of HEAD on 2026-09-13.
