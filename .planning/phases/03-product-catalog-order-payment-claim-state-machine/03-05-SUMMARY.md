---
phase: 03-product-catalog-order-payment-claim-state-machine
plan: 05
subsystem: infra
tags: [cloudflare-r2, aws-sdk-v3, s3-request-presigner, sharp, sigv4, presigned-upload, exif, webp, image-pipeline, vitest]

# Dependency graph
requires:
  - phase: 01-multi-tenant-foundations-domain-resolution
    provides: "src/env.ts (@t3-oss/env-nextjs, the only sanctioned reader of process.env), the two-project vitest config, and the source-grep/pure-function unit-test idiom"
  - phase: 02-subscriptions-entitlements
    provides: "requireMerchantContext(), MerchantContext.tenantId and MerchantContext.canWrite — the session-resolved tenant that composes every object key"
  - phase: 03-product-catalog-order-payment-claim-state-machine
    provides: "plan 03-02 installed @aws-sdk/client-s3, @aws-sdk/s3-request-presigner and sharp at pinned versions and added the five required R2_* env keys; plan 03-03 established merchantAction() as the write gate"
provides:
  - "src/server/images/r2.ts — the R2 S3 client, objectKeyFor() as a throwing tenant-boundary control, presignUpload() with content-type AND content-length inside the signature, getObjectBuffer/putObject, and publicUrlFor() that refuses originals"
  - "src/server/images/actions.ts — requestProductImageUpload, the mint half of the three-step ingest, whose Zod schema accepts no tenant id, no key, no path and no filename"
  - "src/server/images/pipeline.ts — IMAGE_PRESETS (product/claim/logo) and processImage(), the D-07 registry Phase 4's ONB-03 logo joins as a row"
  - "src/app/api/upload/finalize/route.ts — the Node-runtime derive-and-store round trip that writes no database row"
  - "tests/unit/r2-key.test.ts and tests/unit/image-pipeline.test.ts — 40 network-free assertions over the tenant boundary and the Sharp chain"
  - "tests/fixtures/sample-product.jpg — a 6 KB Sharp-generated 900x600 JPEG tagged EXIF orientation 6"
affects: [03-04-product-crud, 03-06-product-gallery, 03-10-payment-claims, 03-storefront-catalog, phase-04-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The object key IS the tenant boundary: one shared bucket, no per-tenant credential and no ACL, so objectKeyFor() is a security control that throws rather than a naming helper that sanitises"
    - "A client-supplied filename is never sanitised, it is never sent — the upload id is minted server-side with crypto.randomUUID()"
    - "Presigned grants pin content-type AND content-length inside the SigV4 signature via signableHeaders, so a schema ceiling becomes an R2-enforced one"
    - "Preset registry over function-per-surface: a new image target is a row in IMAGE_PRESETS, not a second module that quietly forgets EXIF rotation (D-07)"
    - "Storage routes write no database row: persistence belongs to the caller that knows the owning entity, which is what makes the pipeline reusable across products, claims and Phase 4 logos"
    - "Error bodies carry a fixed code enum, never an object key and never a presigned URL (ASVS V7 / T-03-27)"
    - "Test-only env placeholders live in vitest.config.ts, not behind a lazy getter in production code, so src/env.ts keeps its boot-time failure"

key-files:
  created:
    - src/server/images/r2.ts
    - src/server/images/actions.ts
    - src/server/images/pipeline.ts
    - src/app/api/upload/finalize/route.ts
    - tests/unit/r2-key.test.ts
    - tests/unit/image-pipeline.test.ts
    - tests/fixtures/sample-product.jpg
  modified:
    - vitest.config.ts

key-decisions:
  - "presignUpload signs content-type and content-length via signableHeaders, which the plan did not specify. Measured against the live einort-commerce bucket: a grant minted with ContentType alone accepted a text/html body with 200 OK, because SigV4 presigning signs only the host header by default. The documented control failed open; the signature is what makes the grant single-purpose"
  - "The 10 MB byteSize ceiling is enforced by Cloudflare, not by trust. Because the declared size is signed, a caller who understates it to slip under the ceiling has minted a grant its real file cannot use — verified 403 at one kilobyte over"
  - "tenantId is validated by objectKeyFor even though ctx.tenantId is trusted today: it costs one regex and turns a future call site that passes something else into an exception instead of a silent cross-tenant write"
  - "publicUrlFor throws on a key ending in /original rather than merely documenting the rule, because T-03-28 depends on every future caller remembering it"
  - "The finalize route re-checks ctx.canWrite. merchantAction enforces the trial gate for the mint step, but a Route Handler sits outside the wrapper and is equally reachable by direct POST, so an expired merchant holding a live five-minute grant must not be able to convert it into stored objects (D-08 / SUB-02)"
  - "Labels live inside each IMAGE_PRESETS row rather than in a lookup table beside it, so adding Phase 4's logo preset stays a single edit; labels are stable public names because they become object basenames (card.webp)"
  - "The claims kind is deliberately unhandled by the finalize route: a claim screenshot is uploaded by an anonymous customer holding a checkout token, which needs a different gate and its own rate limiter"
  - "Unit-project env placeholders were added to vitest.config.ts instead of hiding the env read behind a lazy getter, so production code does not contort around test wiring and src/env.ts keeps validating at module evaluation"

patterns-established:
  - "Three-step image ingest: mint a scoped presigned PUT server-side, browser PUTs bytes direct to R2, Node-runtime route derives and stores — the bytes never transit Vercel compute"
  - "Sharp chain order is load-bearing and documented as such: rotate() with no arguments FIRST (EXIF auto-orient), then resize, normalise, modulate, sharpen, webp"
  - "sharp(input, { limitInputPixels: 50_000_000 }) explicitly, because Sharp's own ~268 MP default is high enough that an 80 MP bomb sails past it"
  - "Security claims about a third-party API are verified against the real service before being written down as a mitigation"

requirements-completed: [CAT-02]

# Metrics
duration: 17min implementation + 12min continuation verification
completed: 2026-08-25
---

# Phase 3 Plan 05: Image Upload and Enhancement Pipeline Summary

**Direct-to-R2 presigned uploads scoped to one key, one content type and one exact byte count by the SigV4 signature itself, plus a Sharp preset registry that turns a sideways phone JPEG into three square normalised WebP derivatives.**

## Performance

- **Duration:** ~17 min implementation (2026-08-25T01:40:47+01:00 → 01:57:47+01:00), plus a continuation session for full verification after the first session hit an API session limit
- **Tasks:** 3 (2 TDD, 1 straight implementation)
- **Files created/modified:** 8 (7 created, 1 modified)
- **Tests added:** 40 assertions across two network-free unit files

## Accomplishments

- **A presigned grant that is actually a grant.** `presignUpload` mints a five-minute write capability for exactly one key, one content type and one exact byte count. All three are inside the signature, so Cloudflare — not this codebase, and not the browser's good behaviour — is what refuses everything else.
- **The tenant boundary is a tested function.** One bucket holds every tenant's images; `tenants/{tenantId}/{kind}/{uploadId}/original` is the entire separation mechanism. `objectKeyFor` throws on traversal, separators, mixed case, dots and out-of-range lengths, and `tests/unit/r2-key.test.ts` walks 14 traversal shapes and 6 tenant-id shapes to prove it.
- **CAT-02 enhancement, not display-time resizing.** A 900x600 fixture tagged EXIF orientation 6 comes back as three genuinely square 400/800/1600 WebP derivatives, auto-rotated before the crop, luminance-normalised and gently saturated — with the WebP magic bytes asserted so a pass-through can never masquerade as a re-encode.
- **Phase 4's logo is already a row.** `IMAGE_PRESETS.logo` exists, is unused, is commented as the D-07 slot, and has a test asserting its shape specifically so nobody deletes it as dead code.
- **The route writes no database row.** Product images are uploaded on `/dashboard/products/new` before a `Product` exists, so the finalize route returns `{ storageKey, width, height }` and lets the caller that knows the owning entity persist it.

## Task Commits

1. **Task 1: R2 client, tenant-prefixed key builder, presign mint action** — `bdbe590` (test, RED) → `f68620a` (feat, GREEN)
2. **Task 2: Sharp preset registry and processImage()** — `365ff12` (test, RED) → `87d1f03` (feat, GREEN)
3. **Task 3: Node-runtime finalize route** — `61da52c` (feat)
4. **Rule 1 fix, found while verifying Task 1 against the live bucket** — `7ca1e52` (fix)

## Files Created/Modified

- `src/server/images/r2.ts` — S3 client (`region: "auto"`, R2 endpoint), `ALLOWED_UPLOAD_CONTENT_TYPES`, `isAllowedContentType`, `objectKeyFor`, `derivativePrefixFor`, `presignUpload`, `getObjectBuffer`, `putObject`, `publicUrlFor`
- `src/server/images/actions.ts` — `requestProductImageUpload`, built with `merchantAction({ mode: "write" })`; schema is `{ contentType, byteSize }` and nothing else
- `src/server/images/pipeline.ts` — `IMAGE_PRESETS`, `ImagePresetName`, `DerivedImage`, `processImage`
- `src/app/api/upload/finalize/route.ts` — `POST` and `maxDuration = 30`; auth, trial gate, key recomputation, derive, store, report
- `tests/unit/r2-key.test.ts` — 170 lines proving traversal and foreign-tenant keys cannot be produced
- `tests/unit/image-pipeline.test.ts` — preset shapes, square dimensions, WebP magic bytes, EXIF orientation via the aspect-preserving preset, and a hand-built 80 MP decompression bomb
- `tests/fixtures/sample-product.jpg` — 6,111 bytes; regeneration script is in the test header
- `vitest.config.ts` — `unitEnv` placeholders for the `unit` project (see deviations)

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one is the first: the plan's stated mitigation for T-03-24 — "R2 rejects an upload whose actual header differs" — is true only when `content-type` is in the signature, and it is not there by default.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ContentType` in `PutObjectCommand` does not scope a presigned URL on its own**

- **Found during:** Task 1, while verifying the mint action against the real bucket rather than against the documentation
- **Issue:** The plan (and RESEARCH.md Pattern 5, and the T-03-24 mitigation column) specified `getSignedUrl(r2, new PutObjectCommand({ …, ContentType }), { expiresIn: 300 })` and asserted that R2 answers `403 SignatureDoesNotMatch` when the uploaded header differs. It does not. SigV4 presigning signs the `host` header and nothing else by default, so `ContentType` on the command lands in the request the SDK *would* have sent and stays out of the signature entirely. Measured against `einort-commerce`: a grant minted for `image/jpeg` accepted a body sent as `Content-Type: text/html` with **200 OK**. The documented control failed open, which means the grant was in fact "write anything you like to this path for five minutes" — precisely the reuse T-03-24 exists to prevent.
- **Fix:** Added `signableHeaders: new Set(["content-type", "content-length"])` to the `getSignedUrl` options and a third `byteSize` parameter to `presignUpload`, threaded from the mint action's existing schema field. Signing `content-length` for the same reason promotes the schema's 10 MB ceiling from a number the browser is asked to respect into one Cloudflare enforces.
- **Files modified:** `src/server/images/r2.ts`, `src/server/images/actions.ts`
- **Verification:** Against the live `einort-commerce` bucket, twice — once when the fix was written and once independently in the continuation session. Honest PUT (signed type, signed length) → **200**. Same URL with `content-type: text/html` → **403**. Same URL with a body one kilobyte over the signed length → **403**. Test object deleted afterwards; the throwaway script was not committed.
- **Committed in:** `7ca1e52`

**2. [Rule 3 - Blocking] The `unit` vitest project could not import `@/server/images/r2`**

- **Found during:** Task 1 (RED step)
- **Issue:** `r2.ts` opens with `import { env } from "@/env"`, and `createEnv` validates at module evaluation. Importing the pure `objectKeyFor` helper therefore pulled the whole env schema in and threw before a single assertion ran. The `unit` project had no env block; only the `isolation` project did.
- **Fix:** Refactored `vitest.config.ts` to hoist the shared placeholders into `placeholderEnv`, then gave the `unit` project its own `unitEnv` that adds a syntactically valid `DATABASE_URL`/`DIRECT_URL` pointing at nothing. The plan offered a lazy-getter escape hatch in production code; that was rejected because it makes `r2.ts` contort around test wiring and drops the boot-time failure `src/env.ts` exists to provide.
- **Files modified:** `vitest.config.ts`
- **Verification:** `npx vitest run --project unit` → 14 files, 264 tests, 0 skipped. The `isolation` project's env is unchanged (it still spreads the same placeholders over the real `TEST_DATABASE_URL`).
- **Committed in:** `f68620a`

**3. [Rule 2 - Missing Critical] Four hardening additions the plan did not specify**

- **Found during:** Tasks 1 and 3
- **Issue and fix:**
  - `objectKeyFor` also validates `tenantId` against `/^[A-Za-z0-9][A-Za-z0-9_-]*$/`. The plan required validation of `uploadId` only. `ctx.tenantId` is trusted today, so this is defence in depth — but it is one regex, and it converts a future call site that passes something else from a silent cross-tenant write into an exception.
  - `publicUrlFor` **throws** on a key ending in `/original` instead of only carrying a comment saying originals are never served. T-03-28's mitigation as written depended on every future caller remembering the rule.
  - `derivativePrefixFor` was extracted into `r2.ts` and exported, rather than having the finalize route strip `/original` inline as the plan described, so the two halves of the key layout cannot drift apart in two files.
  - The finalize route re-checks `ctx.canWrite` and returns `read_only` 403. `merchantAction` enforces the trial gate for the mint step, but a Route Handler is outside the wrapper and is every bit as reachable by direct POST — an expired merchant holding a grant minted before expiry could otherwise still convert it into stored objects (D-08 / SUB-02).
- **Files modified:** `src/server/images/r2.ts`, `src/app/api/upload/finalize/route.ts`
- **Verification:** The tenant-id guard has its own six-case table in `tests/unit/r2-key.test.ts`; the rest are covered by lint, typecheck and `npx next build`.
- **Committed in:** `f68620a`, `61da52c`

### Interface and shape drift (followed the code, not the plan's restatement)

**4. The plan's `<interfaces>` block misstated `ActionResult`.** It gave `{ ok: true; data: T } | { ok: false; error: { form?: string[]; fields?: Record<string, string[]> } }`. The real `src/server/merchant/action.ts` is `({ ok: true } & T) | { ok: false; error: Record<string, string[]> }`. `actions.ts` follows the actual module. A `ProductImageUploadGrant` type is exported and passed explicitly as the wrapper's `R`, because `R` appears only in the handler's return position and TypeScript cannot infer it from the config object.

**5. Each `IMAGE_PRESETS` row carries a `labels` array.** The plan's `<behavior>` listed `{ sizes, fit, ratio, format }` and separately required the product derivatives to be labelled `thumb`/`card`/`detail`. Keeping the labels in the row means adding a preset is still a single edit (D-07), instead of a row plus an entry in a parallel lookup table. The tests use `toMatchObject`, so the plan's exact shape is still asserted verbatim on all three presets.

**6. `presignUpload` has a third parameter.** `presignUpload(key, contentType, byteSize)` rather than the planned `(key, contentType)` — a direct consequence of deviation 1.

### Acceptance-criteria nuances (no code change)

- Task 3's criterion `grep -c "requireMerchantContext" … returns 1` returns **2**: the import line and the call site. Any implementation that is not a namespace import produces two. The intent — the route is authorized by the merchant DAL — holds.
- Task 1's criterion `grep -c "svg" src/server/images/r2.ts returns 0 outside a comment` returns **1** match, and that match is line 49, inside the block comment explaining why `image/svg+xml` is excluded. This is the criterion's own stated exception.

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing-critical bundle of four) + 3 documented shape deviations.
**Impact on plan:** The Rule 1 fix is the difference between a mitigation that works and one that reads correctly in a threat table while failing open in production. Nothing else changed the plan's scope; no file outside `files_modified` was touched except `vitest.config.ts`, which the plan anticipated needing to accommodate.

## Verification

All of the plan's `<verification>` block and every task's `<acceptance_criteria>` were re-run in the continuation session against the committed tree:

| Check | Result |
|-------|--------|
| `npx vitest run --project unit` | 14 files, **264 tests passed**, 0 skipped |
| `npm run lint` (`--max-warnings=0`) | exit 0 |
| `npm run typecheck` | exit 0 |
| `npx next build` | success; `/api/upload/finalize` listed as `ƒ` (Node-runtime function) |
| `npm run test:full` | **inconclusive — did not complete in ~2h, see below.** Not part of this plan's `<verification>` block |
| `grep -rn "process.env" src/server/images/` | no lines — every value comes from `@/env` |
| Edge runtime anywhere under `src/server/images/**` or `src/app/api/upload/**` | none |
| `region: "auto"` / `expiresIn: 300` / `limitInputPixels` counts | 1 / 1 / 1 |
| `rotate()` before `resize(` in the chain | line 151 before line 152 |
| `^\s*(product\|claim\|logo):` in pipeline.ts | 3 |
| `tests/fixtures/sample-product.jpg` under 100 KB | 6,111 bytes |
| `filename` in actions.ts / `body.key\|input.key` in route.ts / `prisma\|scopedDb\|productImage` in route.ts | 0 / 0 / 0 |
| Live R2 negative control: wrong content-type | **403** |
| Live R2 negative control: over-declared content-length | **403** |
| Live R2 positive control: honest PUT | **200** |

### Note on `npm run test:full`

It was started and left to run for **just under two hours without producing a single line of output**, then abandoned rather than killed (the process tree could not be distinguished with confidence from a sibling worktree agent's, and killing the wrong one would have destroyed another agent's run).

This is the known transient Neon symptom in an amplified form. `test:full` runs the `isolation` project against the shared remote Neon test branch, and `git worktree list` shows a second wave-3 agent (`agent-a8d598652c2681737`) active at the same time, with a `node` process started 80 seconds after this one. Two concurrent isolation suites against one Neon branch starve each other on transaction acquisition.

**Why this is not treated as a blocker for plan 03-05:**

1. `npm run test:full` is **not** in this plan's `<verification>` block. The block asks for `npm run test:unit`, `npm run lint`, `npm run typecheck` and `npx next build`, and all four pass.
2. This plan contains **no database code at all** — `grep -cE "prisma|scopedDb|productImage"` over the finalize route returns 0, and no file under `src/server/images/**` imports Prisma. The `isolation` project exercises tenant-scoped Prisma queries, which this plan does not touch.
3. The only shared file modified is `vitest.config.ts`, and the change is provably inert for the `isolation` project: the placeholders were hoisted into `placeholderEnv` and `isolationEnv` now spreads them over the same `TEST_DATABASE_URL`, producing a byte-identical env object to the one before this plan.
4. The `unit` project — which contains **all 40 of this plan's assertions** plus every pre-existing unit test — runs green in 4.4 seconds, and it is the project this plan actually adds to.

**Recommendation for the orchestrator:** run `npm run test:full` once on `master` after all wave-3 branches are merged and no worktree agents are active, exactly as was done for wave 1 (commit `b0fcd7f`, "412/412 confirmed clean on retry after transient Neon timeout"). A single serialized run is both faster and more meaningful than N contended per-worktree runs.

## TDD Gate Compliance

Both TDD tasks show the full gate sequence in `git log`, RED before GREEN, with no test written after its implementation:

- Task 1: `bdbe590` (test) → `f68620a` (feat)
- Task 2: `365ff12` (test) → `87d1f03` (feat)

No REFACTOR commit was needed for either. The `7ca1e52` fix is a `fix` commit rather than a gate, because the defect it corrects was found by measurement against a live third-party API and is not reproducible in a network-free unit test.

## Issues Encountered

- **The first executor session hit an API session limit** immediately after committing `7ca1e52`, before writing this summary. The continuation session verified all six commits against the plan line by line rather than trusting the commit messages, re-ran every acceptance criterion, and independently re-confirmed both live-R2 negative controls. No implementation gaps were found; no additional implementation commits were needed.
- **`npm run test:full` could not be completed from inside a worktree while a sibling wave-3 agent was active.** Detailed above under Verification. Resolved by scoping the claim honestly rather than by asserting a green suite that was never observed.
- **Documentation was wrong about a security control.** RESEARCH.md Pattern 5 and this plan both stated that setting `ContentType` on a `PutObjectCommand` scopes the resulting presigned URL. It does not, and the failure is silent and open. Recorded here because the same assumption will appear again in the claims-screenshot plan, which mints its own grants.

## Known Stubs

None. Every export in this plan is fully wired. `IMAGE_PRESETS.logo` and `UploadKind`'s `logos` member are intentionally unused in Phase 3 — they are the D-07 contract that Phase 4's ONB-03 adds a row rather than a second pipeline, and both are guarded by assertions so they cannot be removed as dead code.

## Threat Flags

None. Every surface this plan introduces is already in the `<threat_model>` register (T-03-23 through T-03-28), and each mitigation is implemented and verified. The one correction to the register is that T-03-24's mitigation text should read "`content-type` is listed in `signableHeaders` at signing time" rather than "`ContentType` is pinned in `PutObjectCommand`" — the latter does not do what the register claims.

## User Setup Required

None. The five `R2_*` keys were added to `src/env.ts`, `.env.example` and `.env.test.example` by plan 03-02 and are populated in `.env.local` against the live `einort-commerce` bucket.

## Next Phase Readiness

**Ready for the callers.**

- **Plan 03-04 / 03-06 (product CRUD and gallery)** consume `requestProductImageUpload` for the mint, do the browser `PUT` with exactly the signed `Content-Type` and exactly `byteSize` bytes, then `POST /api/upload/finalize` with `{ uploadId, kind: "products" }` and persist `{ storageKey, width, height }` as `ProductImage` rows. D-10's cap is five images with the first as hero; the cap belongs to that plan, not to this one.
- **Plan 03-10 (payment claims)** calls `processImage(buffer, "claim")` from its own anonymous, token-gated, rate-limited action — deliberately not through this route — and stores `PaymentClaim.screenshotKey`.
- **Phase 4 ONB-03 (merchant logo)** adds `logos` to whatever gate it needs and calls `processImage(buffer, "logo")`. The preset row and the `UploadKind` member already exist.
- **Anything that renders an image** must call `publicUrlFor` on a derivative key (`{storageKey}/card.webp`), never on the original; the function throws if you try.

**One carry-forward for whoever builds the browser half:** the upload `fetch` must send the exact `Content-Type` string that was declared to the mint action and a body of exactly `byteSize` bytes. Both are inside the signature. Anything else is a 403 from Cloudflare, and that 403 is the feature, not a bug to work around.

## Self-Check: PASSED

All 8 claimed files exist on disk and all 6 claimed commit hashes resolve in `git log`:

- `src/server/images/{r2,actions,pipeline}.ts`, `src/app/api/upload/finalize/route.ts`, `tests/unit/{r2-key,image-pipeline}.test.ts`, `tests/fixtures/sample-product.jpg`, `vitest.config.ts` — all FOUND
- `bdbe590`, `f68620a`, `365ff12`, `87d1f03`, `61da52c`, `7ca1e52` — all FOUND

The only claim in this document not backed by direct observation is the `npm run test:full` result, and it is reported as inconclusive rather than as a pass.

---
*Phase: 03-product-catalog-order-payment-claim-state-machine*
*Completed: 2026-08-25*
