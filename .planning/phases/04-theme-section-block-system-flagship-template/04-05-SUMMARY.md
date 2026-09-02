---
phase: 04-theme-section-block-system-flagship-template
plan: 05
subsystem: images
tags: [onb-03, images, sharp, r2, upload, presign, tenant-isolation]
requires:
  - src/server/images/r2.ts (objectKeyFor, presignUpload, UploadKind — unchanged)
  - src/server/merchant/action.ts (merchantAction wrapper)
  - src/server/images/pipeline.ts (IMAGE_PRESETS.logo — the D-07 slot)
provides:
  - IMAGE_PRESETS[*].enhance — a per-preset flag selecting the photographic finishing chain and the WebP mode
  - requestLogoUpload — a merchant Server Action minting a presigned PUT under the tenant's logos namespace
  - LogoUploadGrant — the named return type for that action
  - POST /api/upload/finalize accepting kind "logos" and deriving through IMAGE_PRESETS.logo
affects:
  - plan 04-09 (saveBranding persists StorefrontTheme.logoKey from this route's storageKey)
  - plan 04-10 (the storefront header renders that key)
  - any future client island uploading a logo (presign -> direct PUT -> finalize)
tech-stack:
  added: []
  patterns:
    - "Registry row as the whole specification — a new behaviour becomes a column, never a name comparison"
    - "Readonly<Record<…>> keyed off a Zod enum's inferred type, so widening the enum is a compile error at the table"
    - "Sibling action per storage namespace rather than a client-supplied kind parameter"
key-files:
  created: []
  modified:
    - src/server/images/pipeline.ts
    - src/server/images/actions.ts
    - src/app/api/upload/finalize/route.ts
    - tests/unit/image-pipeline.test.ts
    - tests/unit/r2-key.test.ts
decisions:
  - "The enhancement chain became a per-row boolean rather than a preset-name branch, so the registry stays the single specification"
  - "An unenhanced row also encodes lossless WebP — skipping .normalise() while keeping a lossy encode would still fringe a wordmark's semi-transparent edges"
  - "requestLogoUpload is a sibling action; the namespace is never a client-supplied field, so the schema still names nothing about placement"
  - "KIND_PRESET's key type is inferred from finalizeSchema rather than restated, so a third UploadKind fails to compile at the table itself"
  - "The theming storageKeySchema drift guard loads the real module dynamically, staying inert only until the sibling plan lands"
metrics:
  duration: ~20 minutes
  completed: 2026-09-02
  tasks: 3
  commits: 4
  files-modified: 5
---

# Phase 04 Plan 05: Logo Upload Pipeline Summary

Closed ONB-03's logo half by turning Phase 3's three deliberately-hardcoded call sites into data: a per-preset `enhance` flag that derives a logo losslessly with its brand colours intact, a sibling `requestLogoUpload` action, and a finalize route that maps a client-named namespace to a server-chosen Sharp preset.

## What Was Built

**Task 1 — `enhance` as a registry column** (`test` commit `3218cd0`, `feat` commit `2ef176f`)

`IMAGE_PRESETS` gained a `readonly enhance` column: `product: true`, `claim: true`, `logo: false`. `processImage` now builds the Sharp chain into a local and applies `.normalise()`, `.modulate({ saturation })` and `.sharpen()` only when the row asks for them, then encodes lossy at `WEBP_QUALITY` for an enhanced row and `{ lossless: true }` for an unenhanced one.

The branch reads the row, never the preset's name — `grep -c 'preset === "logo"'` returns 0. `.rotate()` remains first and unconditional for every preset, and no second `processLogoImage()` function was introduced.

**Task 2 — `requestLogoUpload`** (commit `cfc16ec`)

A sibling of `requestProductImageUpload`, identical except for the namespace literal and its named return type `LogoUploadGrant`. The diff to `src/server/images/actions.ts` is **purely additive — 69 insertions, 0 deletions** — so the product action's handler is provably unchanged and still contains `"products"`. Neither the new schema nor its handler accepts a tenant id, key, path or filename; the key is composed from `ctx.tenantId` and a `crypto.randomUUID()` minted in-process.

**Task 3 — the finalize route** (commit `8f52417`)

`finalizeSchema.kind` widened from `z.literal("products")` to `z.enum(["products", "logos"])`, and a module-level `KIND_PRESET: Readonly<Record<FinalizeKind, ImagePresetName>>` maps namespace to preset. The route calls `processImage(original, KIND_PRESET[parsed.data.kind])` — no cast anywhere. The `ctx.canWrite` re-check survived untouched with its comment, the route still accepts no key and no path, and no database write or `runtime` export was added.

## Verification

| Gate | Result |
|---|---|
| `npx vitest run --project unit tests/unit/image-pipeline.test.ts` | 19 passed |
| `npx vitest run --project unit tests/unit/r2-key.test.ts` | 49 passed, 3 skipped (see deviation 2) |
| `npm run test:unit` | 28 files, 464 passed, 3 skipped |
| `npm run lint` (`--max-warnings=0`) | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run build` | succeeds; `/api/upload/finalize` listed as `ƒ` (dynamic, Node runtime) |

The TDD gate sequence is intact: `test(04-05)` at `3218cd0` failed on exactly the two feature assertions (`enhance` undefined, and the logo derivative returning `{r:254,g:124,b:113}` instead of the brand's `{r:176,g:32,b:40}`), and `feat(04-05)` at `2ef176f` turned them green. No refactor commit was needed.

### Acceptance criteria not literally satisfiable

One Task 3 criterion — `grep -c "runtime" src/app/api/upload/finalize/route.ts` returns 0 — **cannot** hold and never could: the file's pre-existing header contains the lowercase token twice ("`runtime` EXPORT", "The Edge runtime cannot load native binaries"). The criterion's intent was verified instead with `grep -c "export const runtime"`, which returns **0**. No Edge runtime declaration was added.

Two comments in `pipeline.ts` were reworded so the Task 1 greps verify literally rather than counting prose: `grep -c "enhance:"` now returns exactly 3 (one per row) and the preset-name-comparison grep returns 0. The reworded comments say the same thing without the token.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The worktree had no installed dependencies**

- **Found during:** Task 1, first test run
- **Issue:** A fresh worktree carries an empty `node_modules`, no `src/generated/prisma` and no `.next/types` — all three are gitignored. `vitest.config.ts` resolves its `server-only` stub relative to the config directory, so every test failed at import; `tsc` reported 20 cascading errors from the missing Prisma client; and 9 more from missing `PageProps`/`LayoutProps`.
- **Fix:** Ran `npm install` in the worktree, generated the Prisma client (`DIRECT_URL` placeholder — `prisma generate` opens no connection), and ran `npx next typegen`. An earlier junction to the main repo's `node_modules` was removed: Turbopack rejects a symlink leaving the project root, and a junctioned `src/generated/prisma` would have made `postinstall` write into the main repo.
- **Files modified:** none — environment only, all paths gitignored (`git status` stayed clean throughout).

**2. [Rule 3 - Blocking] `storageKeySchema` belongs to a parallel plan**

- **Found during:** Task 2
- **Issue:** The plan requires `tests/unit/r2-key.test.ts` to assert a generated logos key satisfies `storageKeySchema` from `src/server/theming/schema.ts` — a module created by plan 04-02, running concurrently in a different worktree. A static import would not compile here.
- **Fix:** The regex is restated in the test file with the reasoning spelled out, and a `describe.runIf(existsSync(...))` block dynamically loads the real module and asserts it accepts the minted logos and products prefixes and rejects the `/original` key, a URL and a traversal. A restated regex alone would be the very drift the assertion exists to catch, so the guard is what makes it trustworthy.
- **Verified:** temporarily standing up a `schema.ts` matching 04-02's documented shape activated the block and all **52** tests passed; the stand-in was then deleted and `git status` confirmed clean. The 3 skips become 3 passes automatically at merge.
- **Files modified:** `tests/unit/r2-key.test.ts` — commit `cfc16ec`

### Intentional divergence from the plan's literal code

**3. `KIND_PRESET`'s key type is inferred, not restated**

The plan specified `Readonly<Record<"products" | "logos", ImagePresetName>>` while also stating the goal: *"adding a third `UploadKind` to the enum becomes a compile error at this table rather than a silent fallback."* The hardcoded union does not achieve that — widening the enum would error at the **indexing site**, leaving the table silently incomplete. `type FinalizeKind = z.infer<typeof finalizeSchema>["kind"]` puts the error on the object literal itself, which is what the rationale asks for. The `Readonly<Record<…>>` shape and the no-cast rule are unchanged.

## Threat Model Coverage

| Threat ID | Disposition | How it is met |
|---|---|---|
| T-04-01 | mitigated | The finalize route accepts only `uploadId` + `kind` and recomputes the key from `ctx.tenantId`; `requestLogoUpload`'s schema contains only `contentType` and `byteSize`. New tests assert `objectKeyFor` still throws on a malformed id in the logos namespace. |
| T-04-18 | mitigated | `KIND_PRESET` is a server-side map keyed off the schema's own enum; `grep` confirms 0 casts and 0 hardcoded preset literals at the call site. |
| T-04-19 | mitigated | `ctx.canWrite` re-check present exactly once, unchanged, with its comment. |
| T-04-20 | accepted (existing) | `limitInputPixels` untouched; the bomb and undecodable-bytes tests still pass. No new decode path. |
| T-04-15 | mitigated | The r2-key drift guard described in deviation 2. |
| T-04-SC | accepted | No package was installed as a dependency; `package.json` and `package-lock.json` are unmodified. |

## Known Stubs

None. All three call sites are wired end to end. The one thing this plan deliberately does **not** build is the client island and the `StorefrontTheme.logoKey` write — the route's own header records that persistence belongs to plan 04-09's `saveBranding`, not here.

## Follow-ups for the orchestrator

- After the wave merges, `tests/unit/r2-key.test.ts`'s 3 skipped assertions should run. If plan 04-02's `storageKeySchema` regex differs from the one restated there, they will fail — that failure is the guard working, and the fix is to reconcile the two, not to loosen the test.

## Self-Check: PASSED

- `src/server/images/pipeline.ts` — FOUND (modified)
- `src/server/images/actions.ts` — FOUND (modified)
- `src/app/api/upload/finalize/route.ts` — FOUND (modified)
- `tests/unit/image-pipeline.test.ts` — FOUND (modified)
- `tests/unit/r2-key.test.ts` — FOUND (modified)
- Commit `3218cd0` — FOUND
- Commit `2ef176f` — FOUND
- Commit `cfc16ec` — FOUND
- Commit `8f52417` — FOUND
- `src/server/theming/**` — correctly ABSENT (owned by plan 04-02; no file from this plan imports it statically)
