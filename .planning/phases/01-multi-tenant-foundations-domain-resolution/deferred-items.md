# Phase 1 — Deferred Items

Out-of-scope discoveries logged during execution. Not fixed by the discovering plan.

---

## D1 — shadcn `form` component is empty under the Base UI registry

**Found during:** plan 01-01, Task 2
**Blocks:** plan 01-07 (`/signup` — the only real form in this phase)

`npx shadcn@latest add form` reports success but writes no file. `shadcn view form`
returns a registry item with a `name` and no `files` array: the `form` wrapper is a
Radix + `react-hook-form` construct and is not shipped in the `base` (Base UI)
distribution this project initialized with (`components.json` → `"style": "base-nova"`).

`button`, `input`, `label`, `card`, `alert` and `separator` all installed normally —
`form` is the only gap, and nothing in plan 01-01 renders a form, so it is not a
blocker for wave 1.

**Options for 01-07, in preference order:**

1. Compose Base UI's `Field` primitives with `react-hook-form` directly. Both are
   already installed (`@base-ui/react`, `react-hook-form@7.85.0`,
   `@hookform/resolvers@5.9.0`). No registry change, no mixed bases.
2. Pull only the `form` component from the Radix distribution
   (`npx shadcn@latest add form --base radix`). 01-UI-SPEC.md § Design System
   explicitly sanctions this: *"Fall back to `--base radix` only if a required
   primitive is missing."* Mixing bases for one component is the documented
   escape hatch, not a contract violation.

Do **not** register a third-party registry to solve this — 01-UI-SPEC.md
§ Registry Safety authorizes none for Phase 1.

---

## D2 — `typescript` is pinned to 5.9.3, not the locked 7.0.2

**Found during:** plan 01-01, Task 3
**Revert trigger:** `typescript-eslint` ships TS >= 7.1 support
([typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940))

Recorded here as well as in `01-01-SUMMARY.md` so it is not lost when the phase
closes. Reverting is a one-line change to `package.json` plus `npm install`; the
`comment:typescript` key in `package.json` carries the same note at the point of use.

---

## D3 — Cosmetic Vitest config-loader warning

**Found during:** plan 01-01, Task 3
**Impact:** none — noise only

Every Vitest run prints:

```
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1).
```

The config loads and both projects run correctly. The two documented fixes —
renaming to `vitest.config.mts`, or adding `"type": "module"` to `package.json` —
were both rejected for now: the filename is fixed by this plan's artifact contract,
and `"type": "module"` is a repo-wide module-resolution change with real blast
radius against Next 16 and PostCSS for zero functional gain. Revisit only if the
warning becomes an error in a future Vite major.

---

## D4 — Intermittent P2028 at isolation-suite teardown

**Found during:** plan 01-06, Task 2 (full-suite verification)
**Impact:** none on results — all 171 tests pass and `vitest run` exits 0

On some runs of the FULL isolation suite (never when `signup.test.ts` runs
alone, never on the four pre-01-06 files alone), the process prints one
unhandled rejection *after* the last test has already passed:

```
PrismaClientKnownRequestError: Invalid `prisma.$executeRawUnsafe()` invocation:
Transaction API error: A rollback cannot be executed on an expired transaction.
The timeout for this transaction was 5000 ms, however 260478 ms passed since
the start of the transaction.
{ code: 'P2028', meta: { operation: 'rollback', timeout: 5000 } }
```

sometimes followed by `close timed out after 10000ms`. A subsequent identical
run was completely clean and also exited 0, so it is intermittent rather than
deterministic.

**Diagnosis (not a fix):** the only `$executeRawUnsafe` in the tree is the
truncate inside `seedTwoTenants`' batch `$transaction([...])`
(`tests/setup/seed-two-tenants.ts:407`), which runs against a remote Neon branch
on Prisma's **default 5 s** transaction timeout. Plan 01-06 adds 22 tests that
each reseed and each perform real Better Auth password hashing; scrypt is
CPU-bound and blocks the event loop, so a batch transaction can occasionally
overrun the 5 s budget and its rollback is then attempted after the pool has
been released. The reported elapsed time (~260 s) is the length of the whole
isolation run, which fits a rollback deferred to teardown rather than one slow
statement.

**Why it is deferred, not fixed:** the fix belongs to shared test infrastructure
owned by plan 01-04 — `seedTwoTenants` should pass an explicit
`{ timeout, maxWait }` to `$transaction`, and `closeSeedClient` should drain
in-flight work before disconnecting. Editing the seed harness from plan 01-06
would put every earlier plan's isolation suite on an untested code path to
silence a teardown warning that fails nothing. Out of scope per the executor
scope boundary.

**Pick this up when:** the isolation suite grows again (Phase 3 adds
tenant-scoped models and more reseeds), or if this ever fails a run rather than
printing after one. Suggested fix:
`db.$transaction(batch, { timeout: 30_000, maxWait: 10_000 })`.
