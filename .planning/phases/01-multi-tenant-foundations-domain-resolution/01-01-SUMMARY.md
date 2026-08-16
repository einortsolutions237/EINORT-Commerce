---
phase: 01-multi-tenant-foundations-domain-resolution
plan: 01
subsystem: foundation
tags: [scaffold, tooling, lint-boundary, test-harness, env-validation, design-tokens]
requires: []
provides:
  - "src/env.ts — typed, boot-validated env surface (`@/env`)"
  - "eslint.config.mjs — four data-access import zones (TEN-02 / TEN-05 enforcement)"
  - "vitest.config.ts — `unit` and `isolation` projects"
  - "tests/setup/global-setup.ts — fail-closed test-DB gate + `truncateAndSeed` hook"
  - "src/lib/strings.ts — centralized user-facing copy"
  - "src/app/layout.tsx — Plus Jakarta Sans, lang=en, title template"
  - "src/app/page.tsx — D-06 root placeholder"
  - "npm scripts: lint, typecheck, test:unit, test:full"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07]
tech-stack:
  added:
    - next@16.3.1
    - react@19.2.8 / react-dom@19.2.8
    - typescript@5.9.3
    - "@prisma/client@7.9.1 / @prisma/adapter-pg@7.9.1 / prisma@7.9.1 / pg@8.23.0"
    - better-auth@1.6.29
    - "@upstash/redis@1.38.2 / @upstash/ratelimit@2.0.8"
    - zod@4.4.3 / react-hook-form@7.85.0 / "@hookform/resolvers@5.9.0"
    - "@t3-oss/env-nextjs@0.13.11"
    - vitest@4.1.10 / tsx@4.23.12 / dotenv-cli@11.0.0
    - "shadcn@4.18.0 (Base UI, base-nova) + @base-ui/react@1.7.0 + lucide-react@1.31.0"
    - tailwindcss@4.3.3 / eslint@9.39.5 / eslint-config-next@16.3.1
  patterns:
    - "Import-zone lint boundary declared before the code it governs exists"
    - "Env validated at boot with literal runtimeEnv references, not a spread"
    - "Test harness fails closed rather than defaulting to the dev database"
    - "User-facing copy centralized in one module for a later i18n extraction"
key-files:
  created:
    - src/env.ts
    - vitest.config.ts
    - tests/setup/global-setup.ts
    - tests/isolation/harness.test.ts
    - src/lib/strings.ts
    - src/app/page.tsx
    - scripts/prisma-generate.mjs
    - .env.example
    - .env.test.example
    - components.json
  modified:
    - package.json
    - eslint.config.mjs
    - src/app/layout.tsx
    - src/app/globals.css
    - .gitignore
decisions:
  - "Phase 1 ships English copy; French deferred to a fast-follow i18n phase"
  - "typescript pinned to 5.9.3 (CLAUDE.md fallback) so the lint gate survives"
  - "shadcn `form` unavailable under Base UI — deferred to plan 01-07"
metrics:
  duration: "~77 min (21:50 → 23:07 UTC+1, including the Task 1 decision gate)"
  completed: 2026-08-16
  tasks: 3
  commits: 3
---

# Phase 1 Plan 01: Foundation, Enforcement Gates & Root Placeholder Summary

Stood up the EINORT-Commerce skeleton on the locked stack and, more importantly, the two
enforcement mechanisms every later plan leans on: an ESLint import-zone boundary that
already rejects TEN-02/TEN-05 violations before any data-access code exists, and a
two-project Vitest harness whose isolation project fails closed without a test database.

---

## Copy language decision

**Decision: English now, French as a fast-follow.** `<html lang="en">`.

Recorded verbatim from the developer, for plans 05 and 07 to read instead of re-asking:

- The user wants the platform to eventually be fully bilingual (English and French) with a
  language switcher, since Cameroon is officially bilingual. Given the 30-day solo timeline
  constraint, a full i18n system (locale routing, switcher UI, dual-language copy across
  every phase) is out of scope for V1 — that's a real scope expansion, not a same-cost swap
  of which language to hardcode.
- Decision: ship English as the single hardcoded language for Phase 1 (and V1 generally,
  until a fast-follow i18n phase). `<html lang="en">`.
- Structure the copy so a future i18n pass is a clean addition, not a rewrite: keep
  user-facing strings centralized (e.g. a dedicated strings/constants module per surface,
  not scattered inline JSX literals) so they're easy to extract into an i18n library later.
  Don't build any actual i18n infrastructure now (no next-intl, no locale routing, no
  switcher) — that's explicitly deferred.
- This reverses the UI-SPEC's default (which recommended French/fr-CM) per the user's
  explicit choice.
- Number/currency formatting locale (`Intl.NumberFormat('fr-CM', ...)` from CLAUDE.md) is
  unaffected by this — that's XAF currency-formatting convention, independent of UI copy
  language. Keep using fr-CM for currency formatting even though UI copy is English.

### What plans 05 and 07 must do

1. Read the **"English reference"** column of every copy table in `01-UI-SPEC.md`. Do not
   translate independently and do not use the French column.
2. Add strings to `src/lib/strings.ts` under a namespace named for the route
   (`signup`, `storeNotFound`, `storefront`) — never inline a user-facing literal in JSX.
   That module is the future `en` message catalogue; scattering literals is what makes the
   later i18n pass a rewrite instead of an extraction.
3. `01-UI-SPEC.md` is **superseded** on two points: its French-shipping default, and its
   `<html lang="fr">` instruction (§ Accessibility floor). Everything else in that contract
   — spacing scale, typography roles, color, component inventory — still binds.

---

## What Was Built

### Task 2 — App scaffold, design tokens, root placeholder (`c86715b`)

Next 16.3.1 App Router project on the locked stack, shadcn initialized against the Base UI
distribution with `baseColor` forced to `zinc` and `lucide` icons, and the D-06 root
placeholder.

`globals.css` carries the zinc OKLCH token set from `01-UI-SPEC.md` § Color plus one token
shadcn does not ship — `--success: oklch(0.596 0.145 163.225)`, mapped through
`@theme inline` as `--color-success`. It exists because D-02's slug tri-state cannot signal
"available" by the absence of red; that is ambiguity, not a state. It appears exactly once
and is reserved for that single use.

`layout.tsx` loads Plus Jakarta Sans at weights 400/600 only (the typography contract
declares exactly two weights) and sets a `%s · EINORT` title template — load-bearing, not
decoration: the accessibility floor requires a visitor on a dead subdomain to see
`Store not found · EINORT`, never a bare `404`.

`page.tsx` renders three elements and nothing else: wordmark, tagline, one primary CTA to
`/signup` at the 44px touch-target floor. No sign-in link (Phase 2), no help link (no such
surface). `/signup` 404s until plan 07 — expected.

### Task 3 — The enforcement gates (`0f41392`)

**`src/env.ts`** — every key enumerated as a literal `process.env.X` reference in
`runtimeEnv`. A spread compiles and then silently yields `undefined` for every client
variable in the browser bundle. `emptyStringAsUndefined: true` means `FOO=` counts as
missing, closing the exact hole T-01-03 describes: a blank `NEXT_PUBLIC_ROOT_DOMAIN`
classifies every hostname as the root domain and takes every storefront offline.

**`eslint.config.mjs`** — the four zones from RESEARCH.md Pattern 6, declared now so plans
02 and 06 land inside an already-enforced boundary. Verified live with throwaway probe
files (all four deleted before commit; none are in the tree):

| Probe | Location | Result |
|---|---|---|
| `import { prismaBase } from "@/server/db/base"` | `src/app/` | rejected — *"Use scopedDb(tenantId), platformDb, or adminDb."* |
| `db.$queryRaw(...)` | `src/app/` | rejected — *"Raw queries bypass tenant scoping…"* |
| `import { prismaBase } from "@/server/db/base"` | `src/server/db/` | **allowed** (sanctioned zone) |
| `import { scopedDb } from "@/server/db/tenant-scoped"` | `src/server/admin/` | rejected — *"Admin surface must not reuse tenant-scoped services (TEN-05)."* |

The third row matters as much as the other three: a boundary that rejects everything is
not a boundary, and the exemption is what lets the data-access layer be built at all.

**`vitest.config.ts`** — `unit` (no DB) and `isolation` (needs `TEST_DATABASE_URL`,
`fileParallelism: false` because all isolation files share one branch and a parallel
truncate would wipe a sibling's fixtures mid-assertion). The `@/*` alias is re-declared per
project: Vitest does not read tsconfig `paths`, and omitting it fails only at test time.

**`tests/setup/global-setup.ts`** — throws a named `MissingTestDatabaseError` that names
`.env.test`, and never falls back to `DATABASE_URL`. That fallback is the failure this
guards: a truncate-and-seed suite pointed at the development database.

---

## Verification

| Gate | Command | Result |
|---|---|---|
| Wave 1 gate | `npm run lint && npm run typecheck && npx vitest run tests/unit --reporter=dot --passWithNoTests` | exit 0 |
| Build | `npx next build` | exit 0, `/` static |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Boundary probes | `npx eslint src/app/_probe.ts src/app/_probe2.ts` | exit 1, both expected messages |
| Isolation fails closed | `TEST_DATABASE_URL` unset → `npx vitest run tests/isolation` | exit 1, error names `TEST_DATABASE_URL` and `.env.test` |
| Full suite | `npm run test:full` | exit 0, 3 tests passed |
| Flagged packages absent | `grep -c 'neon-testing\|pglite-prisma-adapter' package.json` | 0 |

Every package installed carries an Approved disposition in RESEARCH.md § Package Legitimacy
Audit; all versions were re-confirmed against the live npm registry before install. No
install failed for a name-resolution reason, so no package-legitimacy checkpoint was needed.

---

## Deviations from Plan

### 1. [Rule 3 — Blocking] `typescript` pinned to 5.9.3, not the locked 7.0.2

- **Found during:** Task 3, first `npm run lint`
- **Issue:** `typescript-eslint@8.67.0` hard-throws `"typescript-eslint does not support
  TS 7.0"` on load and takes the entire ESLint run with it. Support returns with TS 7.1
  ([typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)).
  This is not cosmetic: the lint gate **is** the TEN-02/TEN-05 enforcement mechanism and
  the stated deliverable of this task, so it could not be sacrificed to keep the pin.
- **Attempted first:** an npm `overrides` entry pinning TS 6.0.3 only under
  `eslint-config-next`, keeping root TS at 7.0.2 (the side-by-side approach the TypeScript
  7.0 release notes recommend). Rejected: `typescript` is a `peerOptional` of
  `eslint-config-next`, so npm resolves it at the root and the override produces an
  unresolvable `ERESOLVE` conflict. Making it work needs repo-wide `legacy-peer-deps`,
  which weakens peer resolution for every dependency to fix one tool.
- **Fix:** pinned `typescript@5.9.3`. This is the contingency **CLAUDE.md pre-authorizes
  verbatim**, naming both the trigger and the action: *"if any tool in your chain (ESLint
  plugin, codegen) throws obscure errors, pin to TypeScript 5.9 LTS as a fallback rather
  than debugging a 7.0-era tooling gap mid-sprint."* Per the executor's precedence rule,
  a CLAUDE.md directive outranks the plan's `"typescript": "7.0.2"` acceptance criterion.
- **Cost:** loses the Go-native compiler's 8–12x typecheck speedup. `npm run typecheck`
  still completes in seconds at this size, so the practical cost today is ~0.
- **Revert:** one line in `package.json` plus `npm install`, once typescript-eslint
  supports TS >= 7.1. A `comment:typescript` key in `package.json` carries the note at the
  point of use, and it is logged as D2 in `deferred-items.md`.
- **Files:** `package.json`, `package-lock.json` · **Commit:** `0f41392`

### 2. [Rule 3 — Blocking] `create-next-app` cannot scaffold into this repository root

- **Found during:** Task 2
- **Issue:** the plan states the existing files "none of which collide with
  create-next-app's conflict list". That is incorrect — the CLI's allow-list permits `.git`
  and `.gitignore`, but **not** `.planning/`, `CLAUDE.md`, `.claude/`, `.env.local` or
  `.env.test`, all of which are present. Running it in place aborts.
- **Fix:** scaffolded into a temporary `cna-scaffold/` subdirectory, moved the generated
  files up, and deleted the temp directory. The CLI's own `README.md`, `AGENTS.md` and
  `CLAUDE.md` were deliberately **not** moved up — the last would have overwritten the
  project's real `CLAUDE.md`, and none appear in the plan's `files_modified` list.
- **Files:** all Task 2 files · **Commit:** `c86715b`

### 3. [Rule 3 — Blocking] `shadcn init` hangs on an interactive preset prompt

- **Found during:** Task 2
- **Issue:** the plan's `npx shadcn@latest init --template next --base base --css-variables -y`
  still prompts *"Which preset would you like to use?"* — `-y` does not cover it.
- **Fix:** added `--preset nova`. `01-UI-SPEC.md` § Design System specifies
  `style: "base-nova"`, and `nova` is the CLI's name for it (`base-nova` is rejected as an
  invalid preset name; the resulting `components.json` correctly reads `"style": "base-nova"`).
  The preset chose `baseColor: "neutral"`, so it was set to `"zinc"` explicitly as the plan
  instructs, and the zinc OKLCH values were authored into `globals.css` by hand — changing
  `components.json` after init does not retroactively rewrite the token block.
- **Files:** `components.json`, `src/app/globals.css` · **Commit:** `c86715b`

### 4. [Rule 2 — Missing critical functionality] `tests/isolation/harness.test.ts` added

- **Found during:** Task 3 verification
- **Issue:** the acceptance criterion *"`npx vitest run tests/isolation --passWithNoTests`
  with `TEST_DATABASE_URL` unset exits non-zero"* failed — it exited **0**. Vitest skips a
  project's `globalSetup` entirely when no test file matches its `include`. With zero
  isolation tests (they arrive in plan 01-04), the fail-closed gate never executed. The
  plan's headline guarantee was unobservable — a stub in everything but name.
- **Fix:** added a harness self-check asserting the contract directly: missing
  `TEST_DATABASE_URL` throws `MissingTestDatabaseError`; a whitespace-only value is treated
  as missing; and it never falls back to `DATABASE_URL`. Its presence also makes
  `globalSetup` actually run, so the end-to-end behaviour is now real and verified.
- **Files:** `tests/isolation/harness.test.ts` · **Commit:** `0f41392`

### 5. [Rule 3 — Blocking] `postinstall` moved into a script file

- **Found during:** Task 3
- **Issue:** the plan asks for `postinstall = prisma generate` "guarded so it no-ops until
  `prisma/schema.prisma` exists". An inline shell guard cannot be written once and work
  under both `cmd.exe` and `sh`, and this is a Windows machine.
- **Fix:** `scripts/prisma-generate.mjs` performs the existence check in Node and is
  invoked as `node scripts/prisma-generate.mjs`. Verified: `npm install` prints
  `[postinstall] no prisma/schema.prisma yet — skipping prisma generate.` and exits 0.
- **Files:** `scripts/prisma-generate.mjs`, `package.json` · **Commit:** `0f41392`

### 6. [Rule 2 — Missing critical functionality] `src/lib/strings.ts` added

- **Found during:** Task 2
- **Issue:** not in the plan's file list; required by the Task 1 decision, which directs
  that copy be centralized so a later i18n pass is an extraction rather than a rewrite.
- **Fix:** one module, one namespace per route, seeded only with the `root` surface this
  plan actually renders. Namespaces for surfaces owned by plans 05 and 07 were deliberately
  **not** pre-populated.
- **Files:** `src/lib/strings.ts` · **Commit:** `c86715b`

### 7. [Rule 2 — Missing critical functionality] `no-unused-vars` underscore convention

- **Found during:** Task 3
- **Issue:** `npm run lint` runs at `--max-warnings=0`, and the deliberately-unused
  `_databaseUrl` parameter on the `truncateAndSeed` hook (reserved for plan 01-04) failed
  the gate.
- **Fix:** configured `argsIgnorePattern` / `varsIgnorePattern` / `caughtErrorsIgnorePattern`
  to `^_` project-wide. Plans 02-07 will hit the same convention.
- **Files:** `eslint.config.mjs` · **Commit:** `0f41392`

### 8. Minor scope notes

- **`@hookform/resolvers` and `pg` versions** — the plan and RESEARCH.md name both without
  a version. Resolved from the registry to `5.9.0` (`react-hook-form/resolvers`, the
  official org) and `8.23.0`.
- **`skeleton` and `sonner` not installed**, per the plan. `01-UI-SPEC.md` marks both as
  not required this phase and bars `sonner` for blocking errors.
- **No third-party shadcn registry** was added; `components.json` → `"registries": {}`.
- **`.dark` block left exactly as `shadcn init` scaffolded it**, per the plan. Light is the
  only supported appearance in Phase 1, and `--success` is intentionally not defined there
  (it must appear exactly once).

---

## Authentication Gates

None. No task required credentials.

---

## Known Stubs

| Stub | File | Reason / resolved by |
|---|---|---|
| `truncateAndSeed()` is an empty hook | `tests/setup/global-setup.ts` | Intentional and named in the plan: there is no schema (plan 01-02) and no fixture (plan 01-04) to seed yet. **Plan 01-04 T1** fills the body from `tests/setup/seed-two-tenants.ts`. The hook exists now so `globalSetup` does not change shape later. |
| `prisma migrate deploy` skipped when `prisma/schema.prisma` is absent | `tests/setup/global-setup.ts` | The migrate step is real and unguarded once the schema exists (**plan 01-02**). Until then it warns loudly on stderr rather than reporting a passing migration. Unreachable in a normal run — the isolation suites that need tables do not exist until plan 01-04. |

Neither stub prevents this plan's goal. Nothing user-facing is stubbed: `/` renders real,
final copy.

---

## Required Before Plan 01-02 (developer action)

`src/env.ts` treats `DIRECT_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` as **required**,
per this plan's `<interfaces>` contract. `.env.local` currently holds only `DATABASE_URL`,
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Nothing imports `@/env` yet, so the build is green today — but the first module that does
(plan 01-02's Prisma client) will fail at boot with a named validation error. That is the
designed behaviour, not a regression. Before plan 01-02, add to `.env.local`:

| Key | Value |
|---|---|
| `DIRECT_URL` | the Neon **unpooled** string (same host as `DATABASE_URL`, without `-pooler`) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `localhost:3000` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` |

`.env.example` documents all four with sources. `SKIP_ENV_VALIDATION=1` is the escape hatch
for credential-free CI paths.

---

## Threat Flags

None. This plan adds no network endpoint, auth path, file-access pattern or schema change.
It only *adds* controls: T-01-01 and T-01-02 are mitigated by the lint zones (probe-verified
above), T-01-03 by boot-time env validation, T-01-04 by shipping only `.env*.example`
templates, and T-01-SC by installing exclusively Approved packages with both `[Flagged]`
packages asserted absent.

---

## Deferred Items

Logged in `deferred-items.md`: shadcn `form` is empty under the Base UI registry and must be
resolved by plan 01-07 (**D1**); the TypeScript 5.9 pin and its revert trigger (**D2**); a
cosmetic Vitest config-loader warning (**D3**).

---

## Commits

| Commit | Task | Description |
|---|---|---|
| `c86715b` | 2 | Scaffold Next 16 app, zinc design tokens and root placeholder |
| `0f41392` | 3 | Wire typed env, ESLint import zones and Vitest harness |

---

## Self-Check: PASSED

All 15 claimed files exist on disk; both claimed commits resolve in `git log`; both
throwaway lint probes are confirmed absent from the tree; and Task 1's own automated verify
(`grep -qi "copy language decision" 01-01-SUMMARY.md`) passes.

---

## Execution Environment Note

This plan was dispatched to a worktree-isolated executor, but the worktree
(`.claude/worktrees/agent-abe142d3d75cdddc6`) and its `worktree-agent-*` branch were torn
down by the harness while the agent was parked on the Task 1 decision gate. On resume the
worktree no longer existed and `git worktree list` showed only the main checkout.

Execution therefore completed in the main repository on `master`, which is consistent with
this project's configuration (`git.branching_strategy: "none"`) and carried no concurrency
risk — this was the only agent in wave 1. The worktree-mode commit guards did not apply
(`.git` is a directory here, not a file). Files were staged individually throughout, so the
orchestrator's in-flight edits to `STATE.md`, `config.json` and `design-references/` were
never captured by any commit in this plan.

Per the orchestrator's instructions, `STATE.md` and `ROADMAP.md` were **not** modified —
those writes remain the orchestrator's to make.
