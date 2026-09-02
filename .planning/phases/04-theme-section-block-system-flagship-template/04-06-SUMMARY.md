---
phase: 04-theme-section-block-system-flagship-template
plan: 06
subsystem: theming
tags: [registry, zod-introspection, drift-test, contract-test, defaults, industry-segments, templates, narrower, vitest]

# Dependency graph
requires:
  - phase: 04-theme-section-block-system-flagship-template
    plan: 02
    provides: "src/server/theming/schema.ts — the Zod discriminated union whose .options/.shape/.element the drift test introspects, the SectionType/PageDocument/ThemeTokens types, and themeTokensSchema; src/lib/theme-defaults.ts — DEFAULT_PRIMARY_ACCENT / DEFAULT_SECONDARY_ACCENT"
  - phase: 04-theme-section-block-system-flagship-template
    plan: 04
    provides: "strings.flagship (every default settings value), strings.editor.sectionLabels, strings.branding.segments and the three brand-field labels this registry reuses"
  - phase: 02-merchant-auth-entitlements-trial
    provides: "src/server/entitlements/plans.ts — the PLAN_TIERS tuple + TIER_SET + isPlanTier narrower shape copied body-for-body into isIndustrySegment, and the header's copy-vs-enforcement split"
  - phase: 03-product-catalog-order-payment-claim-state-machine
    provides: "src/server/images/pipeline.ts's row-per-surface registry literal; tests/unit/single-order-state-writer.test.ts's non-vacuity + positive-control idiom and its rule/reason/fix/wrong-fix failure-message convention"
provides:
  - "src/server/theming/registry.ts — FIELD_KINDS, FieldKind, FieldOption, FieldDescriptor, SectionTypeDefinition, SECTION_TYPES, SectionTypeKey, THEME_FIELDS, THEME_NON_TOKEN_FIELD, TEMPLATE_KEYS, TemplateKey, TemplateDefinition, TEMPLATES, isTemplateKey, INDUSTRY_SEGMENTS, IndustrySegment, INDUSTRY_SEGMENT_ICONS, isIndustrySegment"
  - "src/server/theming/defaults.ts — flagshipDefaultDocument(), flagshipDefaultTokens(); the document every brand-new storefront is seeded with and the storefront read path falls back to"
  - "tests/unit/theming-registry.test.ts — 19 assertions guarding registry/schema drift in both directions, with two non-vacuity controls"
  - "strings.editor.fieldLabels / .fieldHelpers / .overlayOpacityOptions / .itemCountOptions / .iconOptions — the editor field copy the registry references"
affects: [04-08-section-renderer, 04-10-storefront-read-path, 04-11-theming-persistence, 04-12-onboarding-branding, 04-13-storefront-editor, 04-14-field-renderer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A Readonly<Record<SectionType, ...>> editor registry living ALONGSIDE the discriminated union rather than replacing it: the Record serves the editor (homogeneous value type, indexable), the union's exhaustive switch stays the only place a type maps to a component"
    - "Zod 4 introspection (.options on a discriminated union, .shape on an object, .element on an array) used in a contract test to derive one side of a comparison, so the test cannot itself drift into a hand-written parallel list"
    - "A drift test whose first assertion is that introspection returned exactly 5 entries — set-difference comparisons against an empty set report perfect health with zero coverage"
    - "The repeatable-block exception encoded as a named constant plus its own pinning test, so the one section whose descriptors describe an array ITEM rather than the array cannot be silently simplified"
    - "Defaults as functions returning fresh objects, never frozen module constants — the callers are the tenant seed path and the read-path fallback, where a mutated shared literal corrupts cross-tenant and silently"
    - "A section instance's id IS its type string, because D-05 fixes membership at one instance per type; this keeps seeded documents byte-identical across tenants"
    - "Icon identities travel as lucide NAME strings, never components, so a server-only registry never imports React"

key-files:
  created:
    - src/server/theming/registry.ts
    - src/server/theming/defaults.ts
    - tests/unit/theming-registry.test.ts
  modified:
    - src/lib/strings.ts

key-decisions:
  - "trust-bar modelled with an explicit `repeatable: \"blocks\"` marker and per-ITEM descriptors, rather than pretending `blocks` is a scalar field — the drift test compares against one blocks[] item minus its `type` discriminant"
  - "logoKey is on THEME_FIELDS but deliberately NOT in themeTokensSchema; the exception is exported as THEME_NON_TOKEN_FIELD so the drift test names it rather than hardcoding a string"
  - "The three brand-field labels are read from strings.branding rather than duplicated under strings.editor, because 04-UI-SPEC makes the editor colour field identical to the onboarding one and a second copy is free to drift"
  - "TEMPLATES rows carry no display name this phase — nothing renders one until Phase 5's picker, and a string nothing reads is a string nobody keeps accurate"
  - "The `link` field kind's helper is a property of the KIND (rendered from strings.editor.linkHelper), not of each descriptor, so 04-UI-SPEC's one sentence for every link field cannot be written five times"

# Metrics
metrics:
  duration: ~25 min
  completed: 2026-09-02
  tasks: 3
  files-created: 3
  files-modified: 1
  commits: 3
  tests-added: 19
  tests-total: 566
---

# Phase 4 Plan 06: Section Registry, Flagship Defaults & Drift Guard Summary

The editor-side half of EDIT-01: a `Readonly<Record<SectionType, …>>` field registry, the six-segment industry set with an `isPlanTier`-shaped narrower, the one-row template table, the flagship default document — and a Zod-introspecting drift test that fails the build the moment the registry and the schema stop agreeing.

## What Was Built

**`src/server/theming/registry.ts`** — the editor's field vocabulary as data. `FIELD_KINDS` (six, closed), `FieldDescriptor`, and `SECTION_TYPES` typed as `Readonly<Record<SectionType, SectionTypeDefinition>>` so adding a sixth member to the Zod union is a compile error here rather than a section that silently has no settings panel. `THEME_FIELDS` covers `themeTokensSchema`'s four keys plus the logo. `TEMPLATES` has its single `flagship-fashion` row carrying the ordered default section list. `INDUSTRY_SEGMENTS` is the closed six-member tuple with `SEGMENT_SET` + `isIndustrySegment`, copied body-for-body from `isPlanTier`, plus `INDUSTRY_SEGMENT_ICONS` mapping each id to a lucide icon *name* string.

**`src/server/theming/defaults.ts`** — `flagshipDefaultDocument()` and `flagshipDefaultTokens()`, both functions returning fresh objects. Five sections in the locked order `hero → trust-bar → product-grid → editorial-split → contact`, each section's `id` equal to its `type`, every settings value a reference into `strings.flagship`.

**`tests/unit/theming-registry.test.ts`** — 19 assertions. The Zod union is introspected once via `.options` / `.shape` / `.element`; for `trust-bar` the comparison runs against a single `blocks[]` item minus its `type` discriminant.

## Key Decisions

**The `Record` is for the editor; the `switch` stays for the renderer.** Plan 04-02's header argues at length that a `Record`-keyed registry cannot be mapped over without a cast, because TypeScript cannot prove `REGISTRY[section.type].Component` accepts `section.settings`. That argument is about *rendering*. The editor's value type is homogeneous — every entry is `{ label, fields }` — so a `Record` is exactly right there. Both exist, and the registry header states the split explicitly so nobody "unifies" them by hanging a `Component` off these rows.

**`trust-bar` declares `repeatable: "blocks"`.** Its Zod settings shape is `{ blocks }`, one array key, while its descriptors are the per-item fields. Modelling `blocks` as a scalar descriptor would have made the drift test compare a one-element list against a one-key shape and pass while describing nothing. A dedicated test pins that this section is repeatable and that no other section is, so the introspection's assumption cannot rot.

**Section `id` is the `type` string.** D-05 fixes membership at one instance per type, so the type is a stable unique id. A `randomUUID()` would make every seeded document differ from every other for no benefit and break the fixture byte-identity `tests/setup/seed-two-tenants.ts` depends on.

**Both defaults are functions, not frozen constants.** The callers are the tenant seed path and the storefront read-path fallback. A shared literal is one `sections.reverse()` upstream away from corrupting every subsequent tenant created in that process — cross-tenant, silent, invisible in the database. A mutation test pins it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `strings.editor` had no field labels, helpers or select-option copy**

- **Found during:** Task 1
- **Issue:** The plan requires every `label` / `helper` / `options[].label` in the registry to be a `strings.editor.*` member expression, and its acceptance criteria forbid any prose literal in the file. But plan 04-04 landed only `sectionLabels` and the field-*kind* strings (`linkHelper`, `imageAdd`, …) — there were no per-field labels, no helper texts, and no copy for the `overlayOpacity`, `itemCount` or `icon` select options. 04-UI-SPEC.md § Settings-panel view requires a visible `<label>` on every field, and § The six field kinds requires select option copy to "come from the registry descriptor and `strings`". Neither list was ever written down. Task 1 was not completable as specified without them.
- **Fix:** Added four groups to `strings.editor` — `fieldLabels`, `fieldHelpers`, `overlayOpacityOptions`, `itemCountOptions`, `iconOptions` — with a header comment recording that 04-04 missed them and why they live there rather than in the registry. Keyed by settings key rather than by section, so `heading` is one entry and not five chances to write the same word five ways. Followed 04-04's voice contract (English, second person, no exclamation marks, no ALL-CAPS, no promise the product cannot keep). `eyebrow` is labelled "Line above the heading" rather than "Eyebrow", following the same rule `sectionLabels` uses for `editorial-split` → "About": nobody outside this codebase knows what an eyebrow is.
- **Files modified:** `src/lib/strings.ts`
- **Commit:** `a78b989`
- **Coordination note:** `src/lib/strings.ts` is the file 04-PATTERNS.md flags as "the single most likely merge conflict if plans run in parallel waves". Plan 04-07, the only other plan in this wave, does not touch it (its `files_modified` is five files under `src/app/s/[slug]/sections/`), so this edit cannot conflict with the sibling worktree.

**2. [Rule 3 - Blocking] Environment repair — the worktree shipped with no dependencies**

- **Found during:** Setup, before Task 1
- **Issue:** The freshly spawned worktree had no `node_modules`, no `src/generated/prisma`, no `.env.local` / `.env.test` and no `.next/types` — all gitignored and therefore absent from the branch. Nothing could be typechecked, linted, tested or built.
- **Fix:** Copied all four from the main checkout at `D:\Maxs\Claude\einort-commerce` (a real copy, not a junction). Verified with a clean baseline `npm run typecheck` before writing any code. No repository files were changed.
- **Files modified:** none (all copied paths are gitignored)

### Notes on Task 3's TDD gate

Task 3 is marked `tdd="true"`, but the plan itself orders the registry (Task 1) and the defaults (Task 2) *before* the test. That ordering is correct for this kind of test and the RED gate was satisfied differently: a drift guard has no behaviour of its own to write first — its subject is two data structures that must agree. Its RED proof is mutation, which is exactly what the task's own acceptance criteria specify, and both were executed:

- Deleting the `eyebrow` descriptor from `SECTION_TYPES.hero` → **red**, with `expected [ 'eyebrow' ] to deeply equal []` under the "silently uneditable, forever" message. Reverted.
- Adding a bogus `{ key: "nope", … }` descriptor to `contact` → **red**, with `expected [ 'nope' ] to deeply equal []` under the "the save throws a Zod error on a field they were invited to edit" message. Reverted.

`git diff --stat src/server/theming/registry.ts` was empty after both reverts, confirmed before the test was committed. The commit is typed `test(...)` rather than `feat(...)`, so the gate sequence in `git log` reads `feat → feat → test` rather than the canonical `test → feat`.

## Verification

| Gate | Result |
|---|---|
| `npx vitest run --project unit tests/unit/theming-registry.test.ts` | 19 passed |
| `npm run test:unit` | 32 files, 566 tests passed |
| `npm run lint` (`--max-warnings=0`) | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run build` | succeeded |

Acceptance-criteria greps, all confirmed on the committed files:

- `head -1 src/server/theming/registry.ts` → `import "server-only";` (same for `defaults.ts`)
- `grep -c '"use server"' src/server/theming/registry.ts` → `0`
- `grep -c 'from "react"' src/server/theming/registry.ts` → `0`
- `grep -cE '"[A-Z][a-z]+ [a-z]' src/server/theming/defaults.ts` → `0` (zero even before comment-stripping)
- `SECTION_TYPES` has exactly five keys; `INDUSTRY_SEGMENTS` has exactly six entries; `TEMPLATES` has exactly one key
- Default document: order `hero > trust-bar > product-grid > editorial-split > contact`, every `id === type`, three trust blocks, `overlayOpacity 0.3`, `backgroundImageKey null`, parses against `pageDocumentSchema`

## Interfaces for Later Plans

```ts
// src/server/theming/registry.ts
FIELD_KINDS: readonly ["text","textarea","link","image","color","select"]
type FieldKind, FieldOption, FieldDescriptor, SectionTypeDefinition
SECTION_TYPES: Readonly<Record<SectionType, SectionTypeDefinition>>
type SectionTypeKey
THEME_FIELDS: readonly FieldDescriptor[]
THEME_NON_TOKEN_FIELD: "logoKey"
TEMPLATE_KEYS: readonly ["flagship-fashion"]
type TemplateKey, TemplateDefinition
TEMPLATES: Readonly<Record<TemplateKey, TemplateDefinition>>
isTemplateKey(value: unknown): value is TemplateKey
INDUSTRY_SEGMENTS: readonly [six ids]
type IndustrySegment
INDUSTRY_SEGMENT_ICONS: Readonly<Record<IndustrySegment, string>>  // lucide NAMES
isIndustrySegment(value: unknown): value is IndustrySegment

// src/server/theming/defaults.ts
flagshipDefaultDocument(): PageDocument   // fresh object per call
flagshipDefaultTokens(): ThemeTokens      // fresh object per call

// src/lib/strings.ts — added under strings.editor
fieldLabels, fieldHelpers, overlayOpacityOptions, itemCountOptions, iconOptions
```

- **04-08 (section renderer)** must use the exhaustive `switch`, not `SECTION_TYPES`. The registry is the editor's.
- **04-11 (theming persistence)** seeds with `flagshipDefaultDocument()` / `flagshipDefaultTokens()`. Both take no parameters — the tenant is resolved from the session by `merchantAction` and stamped by `scopedDb` (T-04-04).
- **04-12 (onboarding branding)** reads `INDUSTRY_SEGMENTS` + `INDUSTRY_SEGMENT_ICONS` and must map the icon *name* to a component at the `.tsx` boundary, and narrow any stored industry through `isIndustrySegment` before use.
- **04-14 (field renderer)** switches on `FieldDescriptor.kind` and supplies the `link` kind's helper from `strings.editor.linkHelper` itself — link descriptors deliberately declare no `helper`.

## Known Stubs

None. Every export is fully implemented and covered. `TEMPLATES` has one row and `isTemplateKey` currently narrows a single-member set — both are the deliberate Phase-4 state (TMPL-01), not placeholders: Phase 5 adds rows, and D-03 records that it must not derive one from `Organization.industry`.

## Threat Flags

None. Neither file declares, accepts or emits a tenant identifier; `flagshipDefaultDocument()` takes no parameters at all. No new network endpoint, auth path, file access or schema change. The plan's registered mitigations were all applied: T-04-21 (`isIndustrySegment` narrows the `String?` column), T-04-12 (the drift suite), T-04-22 (functions, not shared literals, with a mutation test), T-04-17 (no prose literal in either file), T-04-04 (no tenant field). Zero packages installed.

## Self-Check: PASSED

Files verified present on disk:
- `src/server/theming/registry.ts` — FOUND
- `src/server/theming/defaults.ts` — FOUND
- `tests/unit/theming-registry.test.ts` — FOUND
- `src/lib/strings.ts` — FOUND (modified)

Commits verified in `git log`:
- `a78b989` feat(04-06): add the theming registry — section types, templates, segments — FOUND
- `46f6ee1` feat(04-06): add the flagship default document and tokens (D-04) — FOUND
- `19fd5a1` test(04-06): add the registry/schema drift guard (T-04-12) — FOUND
