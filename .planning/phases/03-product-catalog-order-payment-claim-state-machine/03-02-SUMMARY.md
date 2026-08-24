---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 02
subsystem: ui
tags: [tailwind-v4, shadcn, base-nova, design-tokens, cloudflare-r2, resend, aws-sdk-v3, sharp, nanoid, t3-env, vitest]

# Dependency graph
requires:
  - phase: 01-multi-tenant-foundations-domain-resolution
    provides: "src/env.ts (@t3-oss/env-nextjs surface with the runtimeEnv literal-reference rule), src/app/globals.css token architecture, src/app/s/[slug]/layout.tsx tenant gate, tests/unit/no-tenant-id-param.test.ts (the source-grep idiom), the two-project vitest config and the Neon isolation branch"
  - phase: 02-subscriptions-entitlements
    provides: "the merchant blue/gold/slate :root palette and the shadcn base-nova setup that plan 03-02 extends"
provides:
  - "Five exact-pinned direct dependencies: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, resend, nanoid, sharp"
  - "Seven validated environment keys: five required R2_* and two optional RESEND_*"
  - "A [data-surface=\"storefront\"] scope in globals.css declaring the complete 20-token zinc set"
  - "src/app/s/[slug]/layout.tsx wrapping the storefront in that scope"
  - "Fifteen new shadcn components plus the use-mobile hook"
  - "badge.tsx gold / success / outline-success variants for the order-state chips"
  - "tests/unit/surface-token-isolation.test.ts — five build-failing greps guarding both surfaces"
affects: [03-04-product-crud, 03-05-image-pipeline, 03-08-storefront-catalog, 03-09-cart-checkout, 03-10-payment-claims, phase-04, phase-05]

# Tech tracking
tech-stack:
  added:
    - "@aws-sdk/client-s3@3.1116.0"
    - "@aws-sdk/s3-request-presigner@3.1116.0"
    - "resend@6.22.0"
    - "nanoid@6.0.1"
    - "sharp@0.35.3 (promoted from transitive to direct)"
    - "sonner@^2.0.8 (required peer of the shadcn sonner component)"
  patterns:
    - "Surface scoping by attribute selector: a route tree carries data-surface and re-declares the COMPLETE semantic token set, so pages use identical utilities on both surfaces"
    - "Required-vs-optional env split driven by blast radius: a key whose absence makes a feature impossible is required (fails at boot); a key whose absence only degrades a notification is .optional()"
    - "Source-grep guards as build gates, each proving non-vacuous coverage before asserting"
    - "Whole-line comment stripping in source-grep tests, so the comment explaining a ban cannot trip it"

key-files:
  created:
    - tests/unit/surface-token-isolation.test.ts
    - src/components/ui/{table,select,textarea,checkbox,switch,radio-group,dialog,alert-dialog,dropdown-menu,sonner,skeleton,sidebar,sheet,tooltip,field}.tsx
    - src/hooks/use-mobile.ts
  modified:
    - src/env.ts
    - src/app/globals.css
    - src/app/s/[slug]/layout.tsx
    - src/components/ui/badge.tsx
    - vitest.config.ts
    - tests/setup/seed-two-tenants.ts
    - .env.example
    - .env.test.example
    - package.json

key-decisions:
  - "The five R2_* keys are REQUIRED, not optional: product images and claim screenshots have no fallback storage path, so a missing bucket must fail at boot with a named error rather than on a merchant's first upload (T-03-08)"
  - "The two RESEND_* keys are .optional(): an expired email key must never take claim submission offline, so the claim path degrades to console.warn and the in-app badge stays the reliable channel (T-03-09)"
  - "Completeness, not selectivity, is the storefront scope's mechanism — all 20 tokens are declared because an omitted one inherits the merchant value rather than falling back to unstyled"
  - "--success and --gold-accent are deliberately absent from the storefront scope: a green chip on a customer's order page reads as a payment guarantee this platform does not make (T-03-10)"
  - "src/components/ui/form.tsx does not exist and cannot: under the configured base-nova style the shadcn `form` registry item is an empty stub, and field.tsx is its sanctioned replacement. Pulling form.tsx from the new-york style was rejected as cross-style contamination"
  - "src/components/ui/sonner.tsx drops next-themes and pins theme=\"light\", because the registry default falls back to theme=\"system\" with no ThemeProvider present and would render dark toasts on a light-only product"
  - "The seed's applyDataLayerEnv and vitest.config.ts's isolationEnv must both list every required env key — they cover different processes (main vs worker) and only one of them is reached by globalSetup"

patterns-established:
  - "Two-surface token isolation: [data-surface=\"storefront\"] scopes Surface B; Surface A keeps :root; neither surface writes a palette utility or a literal colour"
  - "Ban-as-test: each UI-SPEC ban is one it() block whose failure message names the offending file, line, and the correct replacement"
  - "In-place shadcn overrides are annotated in the file header with the diff to re-apply after a future `shadcn add`"

requirements-completed: [CAT-02, CHK-01, ORD-01]

# Metrics
duration: ~95min (across two sessions; the first was terminated mid-flight by a network outage)
completed: 2026-08-24
---

# Phase 3 Plan 02: Design-System Split, Dependencies and Environment Summary

**A `[data-surface="storefront"]` token scope that makes the zinc/slate two-surface split structural, guarded by five build-failing source greps, plus the R2/Resend env surface and the sixteen shadcn components the rest of Phase 3 builds on.**

## Performance

- **Duration:** ~95 min across two sessions
- **Completed:** 2026-08-24T20:30Z
- **Tasks:** 2 (plus one pre-work human checkpoint, satisfied before this session)
- **Files modified:** 27

## Accomplishments

- **The design split is now structural rather than aspirational.** `globals.css`'s `:root` resolved every semantic token to the merchant blue/gold/slate, so a storefront page writing `bg-background` shipped in merchant colours with nothing appearing to be wrong. The scoped block plus the layout wrapper mean every storefront page uses the *same* semantic utilities the dashboard uses and gets zinc, and the 0.25rem radius, for free.
- **Five greps now fail the build** when either surface borrows the other's tokens — the only guard that survives a contributor who has not read `03-UI-SPEC.md`. Verified by deliberately violating it, not just by watching it pass.
- **Environment validated at boot** with a required/optional split chosen by blast radius, and documented so the next person can tell which is which and why.
- **Sixteen shadcn components** present and free of palette literals, plus three badge variants for the order-state chips.

## Task Commits

1. **Task 1: Install dependencies, extend the env surface, add the shadcn component inventory** — `26bc653` (feat)
2. **Task 2: Scope the storefront token set and add the surface-isolation grep test** — `8d871ea` (feat)
3. **Deviation fix: isolation seed env** — `743ec68` (fix)

## Files Created/Modified

- `src/env.ts` — five required `R2_*` and two optional `RESEND_*` keys, one literal `process.env.X` per key in `runtimeEnv`, with the required/optional rationale named inline.
- `src/app/globals.css` — a `[data-surface="storefront"]` block between `:root` and `.dark` holding all 20 tokens of UI-SPEC § B. Color verbatim.
- `src/app/s/[slug]/layout.tsx` — wraps `{children}` in that attribute.
- `tests/unit/surface-token-isolation.test.ts` — the four UI-SPEC bans plus the D-08 trash-icon ban.
- `src/components/ui/badge.tsx` — `gold`, `success`, `outline-success` variants.
- `src/components/ui/*.tsx` — fifteen new components; `src/hooks/use-mobile.ts`.
- `vitest.config.ts` — fake `R2_*` in `isolationEnv`.
- `tests/setup/seed-two-tenants.ts` — the same placeholders in `applyDataLayerEnv` (see deviations).
- `.env.example`, `.env.test.example` — all seven keys documented with the dashboard path each comes from.
- `package.json` / `package-lock.json` — the five pinned dependencies plus `sonner`.

## Decisions Made

Beyond the frontmatter list, two worth surfacing:

- **`sonner` is a sixth installed package.** The plan says "five packages and no others", but the `sonner` shadcn component the plan explicitly requires cannot function without the `sonner` runtime package — it is a peer of a mandated component, not an independent choice. Provenance checked (`emilkowalski/sonner`, the component's own upstream).
- **The negative control was run for real.** `className="bg-zinc-100"` was injected into `src/app/s/[slug]/page.tsx`; ban 2 failed with `src/app/s/[slug]/page.tsx:45` naming the line; the probe was then reverted with `git checkout --` on that single file. A guard that has never been seen to fail is not known to work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The new required `R2_*` keys broke `npm run test:full` entirely**

- **Found during:** Post-Task-2 full verification
- **Issue:** Marking the five `R2_*` keys required in `src/env.ts` made the isolation suite die during global setup with `Invalid environment variables` and **zero tests collected**. Adding the placeholders to `isolationEnv` in `vitest.config.ts` — which the plan explicitly anticipated and which the prior session had already done — was not sufficient, and the reason is a process boundary that is easy to miss: Vitest applies `test.env` to the **worker** processes that run test files, but `globalSetup` runs in the **main** process, where it has not been applied and `.env.test` carries only `TEST_DATABASE_URL`. Global setup reaches `seedTwoTenants`, whose `applyDataLayerEnv()` is what actually satisfies `@/env` for its dynamic `@/server/db/tenant-scoped` import — and that function listed every required key as of Phase 1, so the five new ones were undefined.
- **Fix:** Added the five placeholders to `applyDataLayerEnv` with the same `??=` discipline (a real environment still wins) and the same values as `isolationEnv`, plus a doc-comment note that a key added to the required set in `src/env.ts` must be added in **both** places, naming why.
- **Rejected alternative:** relaxing the `R2_*` schema to `.optional()` would have made the symptom disappear and thrown away T-03-08, which is the entire reason the keys are required.
- **Files modified:** `tests/setup/seed-two-tenants.ts`
- **Verification:** the isolation project, which previously collected zero tests, collects and passes.
- **Committed in:** `743ec68`

**2. [Rule 3 - Blocking] `src/components/ui/form.tsx` is unobtainable under the configured shadcn style**

- **Found during:** Task 1 acceptance-criteria check
- **Issue:** The plan requires `npx shadcn@latest add form` and lists `src/components/ui/form.tsx` as an acceptance criterion. The command succeeds and writes nothing: `https://ui.shadcn.com/r/styles/base-nova/form.json` is a stub with no `files` and no `dependencies`, because the base-nova line replaced the react-hook-form `<Form>`/`<FormField>` wrapper with the Field primitives. Only the legacy `new-york` style still ships `ui/form.tsx` (verified by fetching both registry items). `components.json` pins `"style": "base-nova"`.
- **Fix:** Treated `src/components/ui/field.tsx` as `form`'s replacement — it was already installed — and documented the substitution in that file's header so the next person does not re-run the same dead command. `react-hook-form@7.85.0` and `@hookform/resolvers@5.9.0` remain direct dependencies and compose with `<Field>` directly.
- **Rejected alternative:** pulling `form.tsx` from the `new-york` style. That imports a second style's conventions into a base-nova app — the same class of cross-surface borrowing this plan exists to prevent — and no third-party or off-style registry is authorized (`registries: {}`).
- **Files modified:** `src/components/ui/field.tsx`
- **Committed in:** `26bc653`

**3. [Rule 1 - Bug] A palette literal inside a block comment failed Task 1's own grep criterion**

- **Found during:** Task 1 acceptance-criteria check
- **Issue:** `src/components/ui/sonner.tsx`'s doc comment contained the phrase "a slate-50 dashboard". Task 1's criterion strips only `^\s*//` lines, not block-comment continuations, so the count returned 1 instead of 0.
- **Fix:** Reworded to "the light dashboard field", with a note explaining that the phrasing avoids a palette name on purpose.
- **Files modified:** `src/components/ui/sonner.tsx`
- **Committed in:** `26bc653`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** No scope creep. Deviation 1 was a real regression this plan introduced and would have blocked every later plan in the phase. Deviations 2 and 3 are the plan's acceptance criteria meeting reality — the substance of both tasks is unchanged.

## Issues Encountered

- **The prior session for this plan was terminated mid-flight by a network outage.** All of its work was uncommitted. It was reviewed against the plan's acceptance criteria before being trusted, not assumed complete — which is how deviations 2 and 3 were found. Its `sonner.tsx` `next-themes` removal was verified as correct and preserved (`next-themes` is absent from `package.json` and the lockfile).
- **A self-referential parse error in the new test.** The doc comment explaining which comment patterns get stripped contained the literal `*//`, which closes a block comment. Rewritten to describe the patterns in prose and let the regexes below be the specification.
- **Intermittent Neon reachability (`P1001`) on the shared test branch.** `npx prisma migrate deploy` against the isolation branch succeeded on 1 of 3 consecutive attempts, with TCP reachability to the endpoint confirmed good throughout. This is environmental — plausibly contention from the other Wave 1 worktree agents on the same branch, or compute suspend/resume churn — and is unrelated to any change in this plan. The isolation suite passes when the branch is reachable.

## Verification

The plan's own verification block, all run in this worktree:

| Check | Result |
|---|---|
| `npm run lint` (`--max-warnings=0`) | exits 0 |
| `npm run typecheck` | exits 0 |
| `npm run test:unit` | 12 files, **207 passed** (202 before, +5 new bans) |
| `npx next build` | completes; 12 routes generated |
| Negative control (`bg-zinc-100` under `src/app/s/`) | ban 2 fails and names `src/app/s/[slug]/page.tsx:45`; reverted |
| `grep -c 'data-surface="storefront"' src/app/globals.css` | 1 |
| Scoped block declaration count | 20 |
| Excluded tokens inside the scope | 0 |
| `grep -c 'data-surface="storefront"' src/app/s/[slug]/layout.tsx` | 1 |
| `it(` blocks in the new test | 5 |
| Palette literals under `src/components/ui/` | 0 |
| Dependency presence check | prints `ok` |

Beyond the plan, the **built** CSS was checked rather than only the source: `.next/static/chunks/*.css` ships `[data-surface=storefront]` with exactly 20 declarations, `--radius:.25rem`, and no `--success` / `--gold-accent` / `--sidebar` / `--chart` leakage. That closes the gap between "the source says zinc" and "the browser gets zinc", which the two manual visual checks in the plan's verification block were there to cover.

**Not run to completion:** the two manual visual checks (`npm run dev`, eyeball the dashboard and a storefront subdomain). The built-CSS assertion above is the automated substitute; a human should still glance at both surfaces once a storefront page with real content exists, which is plan 03-08.

**Package legitimacy** (checkpoint requirement), spot-checked against the live npm registry rather than taken from RESEARCH.md: `resend` → `github.com/resend/resend-node`; `nanoid` → `github.com/ai/nanoid` (maintainer `ai`); `@aws-sdk/client-s3` → `github.com/aws/aws-sdk-js-v3` (maintainers `amzn-oss`, `aws-sdk-bot`); `sonner` → `github.com/emilkowalski/sonner`. All match the official org.

## User Setup Required

Complete. The five `R2_*` values are present in `.env.local` (bucket `einort-commerce`) and `next build` succeeds against them, which exercises the validation path end to end.

`RESEND_API_KEY` / `RESEND_FROM_EMAIL` remain unset — deliberate and supported. The D-13 merchant email degrades to a `console.warn` and the in-app claims badge is the reliable channel.

## Next Phase Readiness

Ready. Every later plan in Phase 3 depends on this one:

- **03-04 / 03-05 (product CRUD, image pipeline)** — R2 credentials validated at boot; `@aws-sdk/*` and `sharp` installed.
- **03-07+ (orders)** — `nanoid` installed for order numbers and claim references.
- **03-08+ (storefront pages)** — write plain semantic utilities and get zinc automatically; the grep test catches the mistake immediately rather than at review.
- **Dashboard plans** — the `sidebar` component the nav shell decision depends on is installed.

Two things for whoever comes next:

1. Use `<Field>`, not `<FormField>`. There is no `form.tsx` and there will not be one under base-nova.
2. Adding a **required** key to `src/env.ts` means adding it in two more places — `isolationEnv` in `vitest.config.ts` **and** `applyDataLayerEnv` in `tests/setup/seed-two-tenants.ts`. Missing the second one takes the whole isolation suite down with an error that does not point at the cause.

---
*Phase: 03-product-catalog-order-payment-claim-state-machine*
*Completed: 2026-08-24*
