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
