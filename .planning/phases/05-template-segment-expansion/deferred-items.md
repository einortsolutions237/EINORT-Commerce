# Deferred Items — Phase 05

Out-of-scope discoveries logged during plan execution, per the executor's scope-boundary
rule ("only auto-fix issues directly caused by the current task's changes").

## From 05-02 Task 3 (2026-09-04)

While verifying Task 3's changes, a supplementary full run of `tests/isolation/**` (25
files, `npx dotenv -e .env.test -- vitest run tests/isolation --reporter=dot`) was executed
as an extra precaution because Task 3 touched two files shared by every isolation test
(`tests/setup/seed-two-tenants.ts`, `tests/isolation/tenant-isolation.test.ts`). Result:
**23 of 25 files passed, 321 of 323 tests passed.** The two failures are unrelated to this
plan's changes — neither failing file references `StorefrontTheme`, `templateKey`,
`draftTemplateKey`, or `publishedTemplateKey`, and both files were last modified in Phase 3
(commit `29d8bb9`), long before this plan existed.

### 1. `tests/isolation/claim-submission.test.ts` — transaction timeout

```
CHK-04 — a link-holder can say they have paid > discards a screenshot key that is
not this tenant's own (T-03-23)
PrismaClientKnownRequestError: Transaction API error: Unable to start a
transaction in the given time.
  at pendingTransferOrder tests/isolation/claim-submission.test.ts:197:3
```

This is the exact failure mode `tests/isolation/merchant-context.test.ts`'s own header
comment already documents and names by message: multiple `seedTwoTenants()` calls
contending for a transaction slot against the shared Neon test branch, unrelated to any
Phase 5 code. Not fixed — out of scope for 05-02, and the file's own existing header
comments already treat this failure mode as a known, named class of flake rather than a
correctness bug.

### 2. `tests/isolation/stock-race.test.ts` — concurrency race timing

```
releasing a hold > is a no-op for two concurrent releases of the same order
AssertionError: expected false to be true
  at tests/isolation/stock-race.test.ts:246:61
```

A concurrent-release race assertion failing under real network latency against a remote
Neon branch — the kind of timing-sensitive test the filename itself names. Not fixed — out
of scope for 05-02; touches stock-hold release logic (`src/server/orders/*`), nothing this
plan modified.

**Recommendation:** re-run both files in isolation (not as part of the full 25-file batch)
before merging Wave 1, to distinguish "flaky under load" from "a real regression that
happens to also reproduce here." Neither was investigated further by this session because
neither file, nor anything it imports, was touched by 05-02.

## From 05-11 Task 3 (2026-09-06)

### 1. `ensureStorefrontSeeded`'s transaction — transient Neon contention

`tests/isolation/storefront-editor.test.ts` and `tests/isolation/branding.test.ts` each
pass in full isolation (9/9 and 8/8 respectively, run individually). Run together in one
`vitest` invocation as an extra check against this plan's own top-level `<verification>`
block, one storefront-editor.test.ts case failed:

```
ensureStorefrontSeeded > is idempotent and never clobbers an edited draft
PrismaClientKnownRequestError: Transaction API error: Unable to start a
transaction in the given time.
  at src/server/theming/actions.ts:583 (ensureStorefrontSeeded's $transaction)
```

This is the same named flake class `merchant-context.test.ts`'s own header documents and
the 05-02 entry above reproduces: two session-bearing isolation files run back-to-back both
call `seedTwoTenants()` in `beforeAll`, contending for a transaction slot against the shared
remote Neon test branch. The failing call is inside `ensureStorefrontSeeded`, which 05-11
explicitly does not modify (its `<action>` says so in as many words: "Do NOT modify
`ensureStorefrontSeeded`"). Not fixed — out of scope for 05-11, unrelated to any of
`switchTemplate`/`publishStorefront`/`discardDraft`/`saveBranding`'s changes, and each file
is proven green on its own.

### 2. Five isolation fixtures now under-supply `saveBranding`'s new required field

05-11 adds a sixth required field, `templateKey`, to `saveBrandingSchema`. Two fixtures in
this plan's own verification scope were updated (`branding.test.ts`'s `payload()` builder,
`storefront-editor.test.ts`'s `signUpChooseAndCarrySession`). Five more isolation files call
`saveBranding({...})` directly with a literal object missing `templateKey` and are outside
this plan's `files_modified` (`src/server/theming/actions.ts` only) and outside its
`<verify>` scope:

- `tests/isolation/catalog.test.ts`
- `tests/isolation/claims.test.ts`
- `tests/isolation/merchant-context.test.ts`
- `tests/isolation/order-actions.test.ts`
- `tests/isolation/read-only.test.ts`
- `tests/isolation/trial.test.ts`

Each of these will now fail their own fixture setup (`saveBranding` returns `{ ok: false }`
for a missing required field, and each fixture throws on that). Not fixed — `access.ts`'s
own header names `05-21` as the plan that "pins" the tier-gate isolation behaviour this
phase introduces, which is the natural home for updating these six shared fixtures in one
pass rather than each Wave 3 plan touching files outside its own `files_modified` list.
**Recommendation:** whichever plan runs next and touches `tests/isolation/**` broadly (05-21
per `access.ts`) should add `templateKey: "flagship-fashion"` to each of the six call sites
above before the next full `test:full` run.
