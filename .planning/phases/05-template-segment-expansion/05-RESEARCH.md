# Phase 5: Template Segment Expansion - Research

**Researched:** 2026-09-03
**Domain:** Extending an existing in-repo theme/section/template registry (TypeScript + Zod discriminated union + Next 16 RSC) to N templates with build-time rendering variants, a tier-gated picker, and a destructive re-seed action
**Confidence:** HIGH

> **Source posture for this phase:** every load-bearing claim below was read directly out of
> this repository's own source, tests and Prisma schema in this session. There is no external
> library question here — the phase installs zero packages (see § Package Legitimacy Audit),
> so `[VERIFIED: codebase]` means "I opened the file and read the line," which is a stronger
> guarantee than any registry or documentation lookup would have been.

---

<user_constraints>
## User Constraints (from 05-CONTEXT.md)

### Locked Decisions

- **D-01:** The 3+ new segment templates reuse the SAME 5 section types Phase 4 shipped (hero,
  trust-bar, product-grid, editorial-split, contact) — no brand-new section types this phase.
  Distinctiveness comes from which sections a template includes, their order, and (per D-02
  below) which rendering variant each uses — not from new component/schema surface area.
- **D-02:** Each of the 5 section types gets 2-3 rendering variants (e.g. hero: full-bleed photo
  vs. split image+text; product-grid: dense 2-col vs. the flagship's grid). A template's row
  fixes which variant of each section type it uses, the same way it already fixes the section
  list itself — variant selection is template-level, not merchant-editable, consistent with
  Phase 4's D-05/D-06 (section list and layout are fixed by the template; the merchant edits
  content only). Pure reordering/omission of identically-rendered sections was explicitly
  rejected as too weak a distinctiveness signal to reliably pass TMPL-05's stranger test.
- **D-03:** Each of the 50 is a real, individually named row in the `TEMPLATES` registry
  (`Readonly<Record<TemplateKey, TemplateDefinition>>`) — not a smaller set of skeletons with a
  separate preset-application layer. Matches the existing registry pattern exactly (Phase 4's
  `flagship-fashion` is already exactly this shape) and means every one of the 50 is something a
  merchant actually sees and picks by name, with no new indirection concept to design or
  maintain.
- **D-04:** All 50 templates are fully authored THIS phase — real per-template imagery/color/copy
  presets on top of the (likely 3-5, per D-01/D-02) layout skeletons, not a smaller initial set
  with the rest deferred. TMPL-04 and the ROADMAP success criteria both state "the full template
  library reaches 50" as this phase's own done-condition. **Image sourcing/licensing for this
  volume is unresolved and flagged for research** — Phase 4's own flagship default deliberately
  ships with NO stock photograph in its hero default ("a generic hero image on a Douala boutique
  is worse than no image" — `src/server/theming/defaults.ts`), which may mean the right answer
  for many of the 50's default images is the same no-image, typography/color-led treatment
  rather than sourcing 50 sets of real photography — the researcher should investigate and
  recommend rather than this being assumed either way.
- **D-05:** Per Phase 4's own D-03 (unchanged, still binding): a `templateKey` stays independent
  of `Organization.industry`. Industry informs the onboarding template picker (D-06/D-07 below)
  but never mechanically determines the pick — the merchant still chooses.
- **D-06:** The 10/15/25 split is a REAL entitlement gate, not just a catalog-size description.
  Starter merchants can pick only from a specific 10-template subset; Business unlocks 15 more
  (25 reachable total); Professional unlocks the remaining 25 (all 50 reachable). Nested/additive
  — a higher tier always sees everything a lower tier sees, plus more. Matches the existing
  onboarding/plan copy ("3-5 templates..." for Starter, already live on `/onboarding/plan` and
  `/dashboard/plan`) and this codebase's established tier-gating pattern
  (`src/server/entitlements/plans.ts`, already gating the storefront editor itself per Phase 4's
  D-13).
- **D-07:** A new onboarding step lets the merchant pick their template, positioned right after
  the existing industry-selection step (industry informs/filters what's shown, per D-05) and
  before/alongside branding. The merchant leaves onboarding with a real, deliberate template
  pick — not defaulted onto `flagship-fashion` regardless of segment, as Phase 4 shipped.
- **D-08:** A "Change template" action lives inside the existing storefront editor
  (`/dashboard/storefront-editor`), letting a merchant switch after their store is live —
  constrained to whatever templates their CURRENT plan tier can access (same gate as D-06, not a
  one-time or trial-only exception).
- **D-09:** Switching templates RE-SEEDS the storefront document from the new template's
  defaults, discarding prior section customization — no best-effort content carry-over between
  section variants. An explicit confirmation/warning is shown before the switch commits, since a
  different template can have an entirely different section list/variant set with no sensible
  mapping from the old one. This mirrors Phase 4's D-03 (no silent/automatic migration) applied
  to a now-real manual switch capability.

### Claude's Discretion

- Exact count and identity of new layout skeletons beyond the minimum 3 segments TMPL-03
  requires (the researcher/planner should determine how many of the 5 remaining segments —
  electronics, beauty/cosmetics, grocery/food, furniture/home, general retail — get their own
  skeleton this phase, consistent with reaching 50 total variations per D-04.
- Exact per-section-type variant count and specific variant designs (D-02 sets 2-3 as a target,
  not a hard rule).
- Exact mechanism/schema shape for the tier-gate check (D-06) — follow the existing
  `src/server/entitlements/{plans,resolve,assert}.ts` pattern, exact function/field names left to
  the planner.
- Exact UI copy, layout, and interaction design for both the onboarding template-picker step
  (D-07) and the editor's "Change template" action (D-08) — a UI-SPEC pass should cover this
  given the phase's `UI hint: yes` in ROADMAP.md.
- Image sourcing strategy for the 50 templates' default presets (D-04's flagged open question) —
  research should investigate and recommend (e.g. no-image/typography-led defaults vs. a
  specific free/licensed stock source) rather than this being assumed.

### Deferred Ideas (OUT OF SCOPE)

None beyond the above — discussion stayed within phase scope. (The broader dashboard-shell
Shopify-layout redesign, discussed and shipped earlier this session as quick task `260903-ugl`,
is unrelated to this phase and already closed out separately.)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **TMPL-03** | At least 3 additional merchant segments (from: electronics, beauty/cosmetics, grocery/food, furniture/home, general retail) get their own structurally distinct layout — not just a recolored copy of the flagship | § Architecture Patterns Pattern 1 (the variant mechanism that makes "structurally distinct" expressible without new section types) + § The 50-Template Plan (recommends all **6** segments, not 3 — see the picker-coverage argument in Finding 5) |
| **TMPL-04** | The full template library reaches 50 visually distinct variations (10 Starter / 15 Business / 25 Professional tier split) by recombining the segment layouts' sections/blocks with different imagery, color, and copy — not 50 independently designed templates | § The 50-Template Plan (25 skeletons × 2 = 50, per-segment and per-tier allocation table) + § Architecture Patterns Pattern 4 (the tier gate) + § Don't Hand-Roll (the copy-volume reality: ~1,250 strings) |
| **TMPL-05** | Template distinctiveness is checked explicitly (side-by-side comparison) before the library is considered done — genericness is treated as a failure condition, not a subjective nice-to-have | § The Distinctiveness Gate at N=50 — an automated, unit-testable distance metric + an *adversarial-pair* human stranger test (all-pairs is 1,225 comparisons and is not performable; sampling the closest pairs is) |
</phase_requirements>

---

## Summary

This phase has almost no external-technology surface. Every question it raises is answered by
reading this repository's own code, and the answers are unusually constrained: Phase 4 built the
theming system with explicit, load-bearing invariants (one exhaustive `switch`, marker-free
renderer modules, a `Readonly<Record<K,V>>` drift-guard idiom, a strict/lenient parse asymmetry,
an ungated public preview route, a regex-anchored storage-key schema) and each one of them
narrows this phase's design space to essentially one correct answer. The single largest risk in
Phase 5 is not choosing wrong — it is choosing something that *looks* right and silently violates
one of those invariants, producing a build failure at the editor route, a security-control
regression, or a mass unannounced redesign of live merchant storefronts.

Six findings drive the plan. **(1)** The variant vocabulary must live in
`src/server/theming/schema.ts`, not `registry.ts` — `registry.ts` carries `server-only` and
`section-renderer.tsx` renders inside the editor's *client* preview canvas, so importing the
registry from the renderer is an editor-route build failure (the exact T-04-24 trap Phase 4
documented). **(2)** The variant map reaches the renderer as a fully-populated
`Record<SectionType, VariantForThatType>` prop indexed by literal key inside each switch arm,
which preserves the `: ReactElement` exhaustiveness mechanism with zero casts. **(3)** The
current `storageKeySchema` regex is anchored to `^tenants/{id}/(products|logos)/…`, so a shared
stock photograph is *structurally unreferenceable* from a template default without either
widening a documented security control or writing per-tenant R2 copies during onboarding —
which settles D-04's open image question decisively in favour of no-stock-image,
typography-and-colour-led defaults, matching Phase 4's own precedent. **(4)** `StorefrontTheme`
has draft/published pairs for tokens and `StorefrontPage` for the document, but `templateKey` is
a lone unpaired column; a template switch that writes it directly would publish to live
customers with no explicit publish, breaking D-08 — so the column must be split into
`draftTemplateKey`/`publishedTemplateKey`, and the Prisma migration for that rename must be
hand-edited to `RENAME COLUMN` or it will DROP+ADD and reset every existing merchant's template.
**(5)** Because D-07's picker filters by industry, covering only 3 of 6 segments leaves half of
all merchants facing a picker with nothing relevant in it — so all six segments should be
covered, and every segment needs at least one Starter-tier template or the gate creates
segment-shaped dead ends. **(6)** Template access must **not** be trial-elevated the way the
editor is (D-15): the editor grant is reversible, a template grant is not, and un-granting one
would require either force-migrating a live storefront (permanently banned by
`registry.ts`'s own header) or leaving an unenforceable entitlement in place.

**Primary recommendation:** Add a typed, marker-free `SECTION_VARIANTS` vocabulary to
`schema.ts`; extend `TemplateDefinition` with `segment`, `minTier` and per-section `variant`;
author 25 skeletons × 2 copy/colour presets = 50 rows across all six segments with **no stock
imagery**; split `templateKey` into draft/published columns via a hand-edited `RENAME COLUMN`
migration; put the picker inside the existing `/onboarding/branding` form (no new route, no new
DAL rung, no new nullable state) and behind a rail entry in the editor; gate on
`ctx.plan.tier` directly (never trial-elevated) through a `TemplateLockedError extends
EntitlementError`; and make TMPL-05's stranger test an *adversarial-pair* sample driven by an
automated distinctiveness metric rather than an unperformable all-pairs review.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Variant vocabulary (`SECTION_VARIANTS`, `SectionVariantMap`) | Shared marker-free module (`schema.ts`) | — | Read by the server renderer, the client preview canvas, *and* the picker island. `registry.ts` is `server-only` and cannot be reached from any of the last two `[VERIFIED: codebase — registry.ts:1, preview-canvas.tsx is a client component]` |
| Template rows (`TEMPLATES`, `segment`, `minTier`, section+variant list) | Backend (`src/server/theming/registry.ts`, `server-only`) | — | Build-time code, exactly like `PLANS`/`ORDER_TRANSITIONS`. `registry.ts`'s own header forbids this becoming runtime-authorable |
| Per-template default documents/tokens (50 builders) | Backend (`src/server/theming/defaults.ts` + `templates/*.ts`, `server-only`) | — | Reads `strings` and the registry; passed to client islands as props, never imported by them (04-PATTERNS Shared Pattern 1) |
| Variant → component selection | Frontend Server (RSC) *and* Browser (preview canvas) | — | `section-renderer.tsx` and all five section components are deliberately marker-free so they render from both trees |
| Tier gate (`accessibleTemplateKeys`, `assertTemplateAccess`) | Backend (`src/server/theming/access.ts` + `PLAN_TIER_RANK` in `entitlements/plans.ts`) | — | A Server Action is reachable by direct POST; the picker hiding a card is a courtesy, the assert is the control |
| Template switch + re-seed (`switchTemplate`) | Backend Server Action (`src/server/theming/actions.ts`) | — | Writes draft columns only; the tenant comes from the session, never the payload |
| Onboarding template pick | Frontend Server (`/onboarding/branding/page.tsx`) → Browser island | Backend (`saveBranding`) | Route resolves session + assembles plain-data template tiles; the island is presentational; the existing non-DAL action writes |
| "Change template" surface | Browser (editor rail + `alert-dialog`) | Backend (`switchTemplate`) | Existing editor shell pattern; `alert-dialog` primitive already installed |
| Template thumbnails | Browser (CSS/SVG wireframe component) | — | Zero image bytes, no R2 dependency, auto-tracks skeleton changes |

---

## Standard Stack

### Core — already installed, no additions

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 (pinned) | The variant type-safety mechanism (mapped types + discriminated unions) is the whole design | `[VERIFIED: codebase — CLAUDE.md § Languages]` |
| zod | 4.4.3 | `sectionVariantsSchema` for the postMessage door; existing `pageDocumentSchema` unchanged | `[VERIFIED: codebase — package.json / schema.ts]` |
| Next.js | 16.3.1 | App Router, Server Actions, RSC/client boundary | `[VERIFIED: codebase]` |
| React | 19.2.8 | Section components, editor islands | `[VERIFIED: codebase]` |
| Prisma / @prisma/client | 7.9.1 | The `draftTemplateKey`/`publishedTemplateKey` migration | `[VERIFIED: codebase]` |
| Tailwind CSS | 4 | Every new variant's layout; no new CSS system | `[VERIFIED: codebase]` |
| lucide-react | (installed) | Rail icon for the new "Change template" entry | `[VERIFIED: codebase — used in section-list.tsx]` |
| Vitest | 4.1.10 | `unit` (DB-free) + `isolation` (Neon test branch) projects | `[VERIFIED: codebase — `npx vitest --version` → 4.1.10]` |

### Supporting — already installed shadcn primitives this phase needs

| Primitive | Purpose | When to Use |
|-----------|---------|-------------|
| `src/components/ui/alert-dialog.tsx` | D-09's destructive "this will discard your customization" confirm | The exact precedent is Phase 4's `Discard` control (04-UI-SPEC § Decisions Made Under Claude's Discretion) |
| `src/components/ui/radio-group.tsx` | Template selection semantics in both picker surfaces | One-of-N choice; keyboard + a11y already handled |
| `src/components/ui/dialog.tsx` | Optional modal host for the editor's picker if the settings panel is too narrow | Only if the UI-SPEC pass calls for it |
| `src/components/ui/card.tsx`, `badge.tsx` | Template cards + tier-lock badges | Existing dashboard vocabulary (blue/gold/slate) |

`[VERIFIED: codebase — `ls src/components/ui/` shows all four present]`

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Variant as a `Record<SectionType, Variant>` prop | Variant field inside `sectionInstanceSchema` settings | **Rejected.** Puts variant in the stored document → a direct POST to `saveDraft` can change it (violates D-02's "not merchant-editable"), and it *breaks the existing drift test*: `tests/unit/theming-registry.test.ts` § "has a field descriptor for every schema key" would fail unless `variant` gets an editor descriptor, which is exactly the merchant-facing control D-02 forbids `[VERIFIED: codebase — theming-registry.test.ts:261-276]` |
| Variant as a `Record` prop | Nested per-variant `case` arms inside the existing switch | Viable, but grows `section-renderer.tsx` from 5 arms to 12 and moves layout decisions into the file whose stated job is *only* type→component. Prefer each section component owning its own internal variant switch |
| 25 skeletons × 2 | 12 skeletons × ~4 | 4 siblings per skeleton means 4 templates differing only in accent + copy — the highest-risk configuration for TMPL-05's stranger test. Skeletons are nearly free (a skeleton is ~6 lines of data once the variant components exist); copy is the real cost and it is 50 either way |
| 25 skeletons × 2 | 50 unique skeletons | Explicitly forbidden by TMPL-04 ("not 50 independently designed templates") |
| No-image defaults | Unsplash / Pexels API, or bundled CC0 photography | **Rejected on a hard technical ground, not taste** — see § Finding 3. `storageKeySchema` structurally refuses any key outside `tenants/{id}/(products\|logos)/…` |
| Picker card inside `/onboarding/branding` | New `/onboarding/template` route + new DAL rung | Needs a new "template not yet chosen" state; `templateKey` carries a DB default so absence is not representable, and the alternative signal (StorefrontTheme row absence) would add a second-table read to `requireMerchantContext`, a module whose parameter-less, single-read shape is pinned by `tests/unit/no-tenant-id-param.test.ts` |
| `draftTemplateKey` + `publishedTemplateKey` | Single `templateKey`, switch = immediate publish | Simpler migration, but a merchant clicking "Change template" would instantly redesign their **live** store with no preview and no undo — directly against D-08's draft/publish split, which `actions.ts` calls "the whole of D-08" |

**Installation:**
```bash
# None. This phase installs zero packages.
```

---

## Package Legitimacy Audit

**This phase requires no external packages.** Every capability it needs — typed registries,
Zod validation, RSC/client rendering, Tailwind layout, `alert-dialog`/`radio-group`/`card`
primitives, Vitest — is already installed and verified present in this repository
`[VERIFIED: codebase — package.json, ls src/components/ui/]`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none)* | — | — | — | — | — | No installs this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

**Standing rule inherited from 04-UI-SPEC.md § npm packages, and it still binds:** if the
planner or a UI-SPEC pass later concludes a package *is* needed (an image library for
thumbnails, a colour-contrast library, a carousel), that install is a
`checkpoint:human-verify` task that must run the full Package Legitimacy Gate first. It is
**not** pre-approved by this document. The thumbnail recommendation in § Pattern 6 is
specifically designed to need zero dependencies for this reason.

---

## Key Findings

### Finding 1 — The variant vocabulary MUST live in a marker-free module, not the registry

`src/server/theming/registry.ts` line 1 is `import "server-only"`
`[VERIFIED: codebase — registry.ts:1]`. `src/app/s/[slug]/sections/section-renderer.tsx` is
deliberately marker-free because, in its own words, *"it renders from the RSC tree on the live
storefront and from inside the editor's client-side preview canvas, so a server-marked
dependency anywhere beneath it is an editor-route build failure (T-04-24)"*
`[VERIFIED: codebase — section-renderer.tsx:82-85]`.

`src/server/theming/schema.ts` was built marker-free for exactly this reason and says so:
*"THIS FILE DELIBERATELY CARRIES NO `server-only` MARKER. DO NOT ADD ONE.
`preview-canvas.tsx` is a client component and it MUST validate the postMessage payload with
`pageDocumentSchema`"* `[VERIFIED: codebase — schema.ts:3-13]`.

**Therefore:** `SECTION_VARIANTS`, `SectionVariant<T>`, `SectionVariantMap` and
`sectionVariantsSchema` go in `schema.ts`. `TEMPLATES`, `TemplateDefinition` and
`variantsForTemplate()` stay in `registry.ts`. Putting the variant vocabulary in the registry
is the single most likely wrong turn in this phase, and it fails at *build* time on the editor
route — loudly, but only after the work is done.

### Finding 2 — The renderer keeps its exhaustiveness with a literal-key indexed Record

`section-renderer.tsx`'s exhaustiveness mechanism is the `: ReactElement` return annotation
combined with no `default` arm and no cast. Its header is emphatic that a `Record`-keyed
registry *cannot* be mapped over without a cast, "and an assertion is precisely the check being
given up" `[VERIFIED: codebase — section-renderer.tsx:45-54]`.

That warning is about mapping **section type → component**. Passing a **variant** through a
`Record` is a different shape and does not trip it, provided the record's value type is
correlated to its key at the type level and every read uses a *literal* key:

```ts
// schema.ts (marker-free)
variant={variants.hero}          // narrows to HeroVariant — no cast
variant={variants["product-grid"]} // narrows to ProductGridVariant — no cast
```

Because each switch arm already knows its literal type, the lookup is `variants.hero`, not
`variants[section.type]`. The former narrows; the latter would not. **This distinction is
load-bearing and must be written into the file's header comment**, or the first reader who
"simplifies" it to `variants[section.type]` reintroduces exactly the cast Phase 4 banned.

### Finding 3 — Stock imagery is structurally unreferenceable; the no-image answer is forced

`storageKeySchema` is:

```ts
/^tenants\/[A-Za-z0-9_-]+\/(products|logos)\/[a-z0-9-]{8,64}$/
```

`[VERIFIED: codebase — schema.ts:66-71]`, and its comment states the anchoring is a security
control: *"accepting an absolute URL here would let a document point the storefront's `<Image>`
at an arbitrary host."* Both image fields in the document (`hero.backgroundImageKey`,
`editorial-split.imageKey`) are `storageKeySchema.nullable()`
`[VERIFIED: codebase — schema.ts:88, 130]`.

A template default cannot reference a shared/global stock photo because such an asset has no
`tenants/{id}/` prefix. The only two ways to make it work are both unacceptable:

1. **Widen the regex** to admit a `templates/` prefix or an absolute URL. That relaxes a
   documented ASVS-V5 security control on the storefront render path to buy decoration.
2. **Copy the stock asset into every tenant's R2 prefix at seed time.** That puts N R2 writes
   on the onboarding critical path (`saveBranding`) and on `ensureStorefrontSeeded`, multiplies
   storage by tenant count, and creates a new failure mode ("onboarding failed because R2 was
   slow") on the one flow that must never fail.

Combined with Phase 4's already-recorded judgement — *"There is no stock photograph to fall
back to and there should not be one: a generic hero image on a Douala boutique is worse than no
image"* `[VERIFIED: codebase — defaults.ts:111-118]` — and with `hero-section.tsx`'s
*"THE NO-IMAGE MODE IS A FIRST-CLASS STATE, NOT A FALLBACK … Treat both modes as designs. Do
not let one rot"* `[VERIFIED: codebase — hero-section.tsx:23-33]`:

**Recommendation (HIGH confidence): all 50 templates ship with `backgroundImageKey: null` and
`imageKey: null`. Distinctiveness comes from structure, type, colour and copy. Zero images are
sourced, zero licences are needed, zero image-processing packages are installed.**

**This is a hard design constraint on the variant set, not just a defaults decision:** every
hero, editorial-split and product-grid variant must be *designed for the null-image case first*
and merely *accommodate* an uploaded image second. A hero variant that only reads as designed
with a photo behind it will look broken on day one for every merchant who picks it — which is
most of them.

### Finding 4 — `templateKey` is the one unpaired column, and a switch that writes it publishes

The data model consistently pairs draft and published
`[VERIFIED: codebase — prisma/schema.prisma]`:

| Model | Draft column | Published column |
|---|---|---|
| `StorefrontPage` | `draft Json` | `published Json?` |
| `StorefrontTheme` | `draftTokens Json` | `publishedTokens Json` |
| `StorefrontTheme` | *(none)* | `templateKey String @default("flagship-fashion")` |

`templateKey` is unpaired because Phase 4 had exactly one template, so it could never change.
Once it can change, a `switchTemplate` that writes it directly makes the *live customer-facing
storefront* re-render under new variants the instant the merchant clicks — while `published`
still holds the old document. That is simultaneously a silent publish (against `actions.ts`'s
*"Adding either column to the `data` objects below would silently turn every keystroke into a
deploy"* `[VERIFIED: codebase — actions.ts:156-163]`) and a *structurally inconsistent* render
(old document, new variant map).

**Recommendation:** rename `templateKey` → `publishedTemplateKey` and add
`draftTemplateKey String @default("flagship-fashion")`. Then:
- `getPublishedStorefront` reads `publishedTemplateKey` (and must add it to its `select` — it
  currently selects only `publishedTokens, logoKey` `[VERIFIED: codebase — queries.ts:124-127]`).
- `getEditorStorefront` reads `draftTemplateKey` (it currently reads `templateKey`
  `[VERIFIED: codebase — queries.ts:206]`).
- `publishStorefront` promotes `publishedTemplateKey = draftTemplateKey` inside its existing
  `$transaction`.
- `discardDraft` reverts `draftTemplateKey = publishedTemplateKey` — **and must also re-seed the
  draft document from that template's defaults**, because its existing flagship fallback
  (`flagshipDefaultDocument()` when `published` is null) is now wrong for a non-flagship tenant.

See § Common Pitfalls Pitfall 1 for the migration-safety trap this rename carries.

### Finding 5 — Industry filtering makes 3-segment coverage a trap; cover all six

D-07's picker is filtered/informed by `Organization.industry`, and `INDUSTRY_SEGMENTS` is a
closed set of six `[VERIFIED: codebase — registry.ts:487-494]`. TMPL-03 asks for "at least 3
additional" segments, which reads as a floor on *effort*. But with a filtered picker it becomes
a floor on *coverage*, and 3-of-6 coverage means a merchant who picked `furniture-home` opens
the picker and sees either nothing relevant or a silent fallback to fashion templates — the
exact "generic" experience TMPL-05 treats as a failure.

**Recommendation: cover all six segments.** The marginal cost is copy presets (which is the
dominant cost anyway, and is 50 templates' worth regardless of how they are distributed); the
marginal *design* cost is near zero because the variant components are shared.

**Second, sharper constraint:** because the picker is tier-gated (D-06), **every segment must
have at least one Starter-accessible template**, or a Starter merchant in an uncovered segment
gets a segment-shaped dead end. With 10 Starter slots and 6 segments this is satisfiable but
tight — four segments can have 2, two can have 1. It cannot be 2-everywhere. This should be
asserted by a unit test, not left to authoring discipline.

**Third:** the filter must be **soft** (a default sort/pre-filter with a visible "show all"
affordance), never a hard restriction. A hard filter makes `Organization.industry` mechanically
determine the reachable set — which is D-05's prohibition arriving through the back door, and
`registry.ts`'s D-03 header calls the underlying rule *permanent*
`[VERIFIED: codebase — registry.ts:426-447]`.

### Finding 6 — Template access must NOT be trial-elevated (this is a new decision)

Phase 4's D-15 grants the storefront editor to every tier during the 10-day trial, composed in
`resolveEntitlements` as `canEditStorefront: subscribed ? plan.limits.storefrontEditor :
!expired` `[VERIFIED: codebase — resolve.ts:185]`. The obvious-looking move is to mirror that
for templates. **It is wrong, and the asymmetry needs to be recorded as a decision.**

The editor grant is *reversible*: when the trial lapses, the merchant loses the editor and keeps
their storefront exactly as it was. A template grant is *not* reversible. If a Starter merchant
picks a Professional template during their trial, at expiry there are only three outcomes:

1. Force them onto a Starter template → a mass unannounced redesign of a live business's
   storefront. Permanently banned: *"NO MERCHANT IS EVER AUTO-MIGRATED … A backfill that
   'upgrades' live storefronts is a mass unannounced redesign of other people's businesses"*
   `[VERIFIED: codebase — registry.ts:434-440]`.
2. Leave them on it → the 10/15/25 gate is not a gate; every merchant reaches every template by
   signing up.
3. Break their storefront → obviously unacceptable.

**Recommendation:** gate on `ctx.plan.tier` directly. A Starter merchant on trial gets the full
editor (D-15, unchanged) but only the 10 Starter templates. This is honest — the editor is a
capability you can try and lose; a template is a durable choice you cannot.

**Corollary — the gate is on the WRITE, never on the render.** A Business merchant who
downgrades to Starter keeps rendering their Business template forever (D-03, permanent). Only
`switchTemplate` and the picker are gated. The picker must therefore always display the
merchant's *current* template even when it is above their tier, marked as retained-not-
reselectable — otherwise a downgraded merchant opens the editor and sees "no template selected."

---

## The 50-Template Plan

### Variant set (D-02) — 12 variant components total, 7 of them new

| Section type | Variants | The flagship's | New |
|---|---|---|---|
| `hero` | 3 | `full-bleed` (photo/no-photo band, centred type, pill CTA) | `split` (type column beside an image/colour field), `stack` (type-led, oversized headline, rule + CTA, designed to need no image at all) |
| `trust-bar` | 2 | `band` (washed band, icon + heading + body rows) | `strip` (thin single-line rule-separated strip, icon + heading only, no body) |
| `product-grid` | 3 | `grid` (4-col, `aspect-[4/5]`, category chips) | `dense` (2-col mobile / 5-col desktop, `aspect-square`, tight gap, price inline), `showcase` (2-col desktop, large tiles, generous gap, price under a rule) |
| `editorial-split` | 2 | `split` (image beside text; collapses to one column when null) | `banner` (full-width ink band, centred type, no image slot at all) |
| `contact` | 2 | `band` | `card` (bordered card floated on white, centred) |

Structural combinations with all five sections present: 3 × 2 × 3 × 2 × 2 = **72**. With section
*inclusion* (recommend `hero` and `product-grid` mandatory; the other three optional → 8 subsets)
and *ordering*, the reachable skeleton space is in the hundreds. Drawing 25 well-separated
skeletons from it is comfortable.

**Note on `trust-bar` variants:** `trust-bar` is the one repeatable section, and the drift test
pins that fact by name (`REPEATABLE_SECTION`) `[VERIFIED: codebase — theming-registry.test.ts:77,
278-301]`. A `strip` variant that renders fewer *fields* per block is fine; a variant that
changes the *block count bounds* (1…4) is a schema change and is out of scope.

### Skeleton and template allocation

| Segment | Skeletons | Templates | Starter | Business | Professional |
|---|---|---|---|---|---|
| `fashion-apparel` (incl. `flagship-fashion`) | 4 | 8 | 2 | 2 | 4 |
| `electronics` | 4 | 9 | 2 | 3 | 4 |
| `beauty-cosmetics` | 4 | 8 | 2 | 2 | 4 |
| `grocery-food` | 4 | 8 | 1 | 3 | 4 |
| `furniture-home` | 4 | 8 | 2 | 2 | 4 |
| `general-retail` | 5 | 9 | 1 | 3 | 5 |
| **Total** | **25** | **50** | **10** | **15** | **25** |

Two templates per skeleton, differing in accent pair + full copy set. This is the *maximum*
sibling count that reliably survives a stranger test when imagery is uniformly absent — at three
or more siblings per skeleton, two of them will read as the same shop in a different colour.

`flagship-fashion` **keeps its key, its skeleton and its exact default document byte-for-byte**.
`tests/setup/seed-two-tenants.ts` depends on fixture byte-identity and
`tests/unit/theming-registry.test.ts` pins the flagship's section order, ids and content
`[VERIFIED: codebase — theming-registry.test.ts:411-471]`. It becomes template #1 of 50, not a
rewritten one.

### Copy volume — the real cost of this phase

Per template: hero (5 strings) + 3 trust items × 2 (6) + product-grid (3) + editorial-split (5)
+ contact (3) + announcement (1) + footerTagline (1) ≈ **24 strings**, minus any omitted
sections. Across 50 templates: **≈ 1,000–1,250 strings**, all industry-appropriate,
Douala-appropriate, in the 01-UI-SPEC voice (direct, second person, no exclamation marks, no
"Oops", no emoji `[VERIFIED: codebase — strings.ts:1-30]`), each within its Zod character cap.

This is the single largest task in the phase and it must be waved as such — one wave per segment,
parallelizable, each producing one `src/lib/strings/templates/<segment>.ts` plus one
`src/server/theming/templates/<segment>.ts`.

**The character caps are self-enforcing.** Every cap lives in `schema.ts` (`heading` max 120,
`body` max 280, `ctaLabel` max 30, trust `heading` max 48, trust `body` max 140, grid `heading`
max 80 `[VERIFIED: codebase — schema.ts:82-138]`), and the generalized drift test parses every
one of the 50 default documents. A too-long string is a red unit test, not a runtime surprise.

---

## The Distinctiveness Gate at N=50 (TMPL-05)

Phase 4's Design-Distinctiveness Gate compares **two** stores across seven checks, six objective
and one human `[VERIFIED: codebase — 04-UI-SPEC.md:752-768]`. That structure is right and should
be inherited, but it does not scale: 50 templates is **1,225 unordered pairs**. Nobody performs
1,225 side-by-side comparisons, and a gate nobody performs is a gate that passes vacuously —
precisely the failure mode `theming-registry.test.ts` warns about at length
(*"IT MUST NOT PASS VACUOUSLY"* `[VERIFIED: codebase — theming-registry.test.ts:49-55]`).

**Recommended scaled mechanism — three layers, in this order:**

#### Layer 1 — Automated distinctiveness metric (new `tests/unit/template-distinctiveness.test.ts`)

Define per template:
- `structure` = the ordered `"{type}:{variant}"` join of its declared sections
- `accent` = its default `primaryAccent`
- `voice` = its default hero `heading` + `eyebrow`

Assert, over all 50:

| # | Rule | Rationale |
|---|---|---|
| 1 | No two templates share both `structure` and `accent` | The literal definition of "the same shop twice" |
| 2 | No `structure` is used by more than **2** templates | Caps sibling count; makes "25 skeletons" a *tested* claim, not a plan |
| 3 | All 50 `voice` values are distinct | Copy is one of the three distinctiveness axes; duplicates mean it was not really authored |
| 4 | All 50 `key` values are distinct and `Object.keys(TEMPLATES).length === 50` | TMPL-04's literal count |
| 5 | Every segment has ≥ 1 Starter-accessible template | Finding 5's dead-end guard |
| 6 | The Starter-accessible set (10) spans ≥ **8** distinct structures | The tier gate must not make the library look generic to the majority of merchants |
| 7 | Cumulative accessible counts are exactly 10 / 25 / 50 by tier | D-06's split, asserted rather than described |
| 8 | Non-vacuity control: the metric still reports a difference on a hand-built colliding pair | Inherited idiom from `theming-registry.test.ts:200-216` |

All eight are objectively decidable, run in the DB-free `unit` project in milliseconds, and turn
"genericness is a failure condition" into a red build.

#### Layer 2 — Contact sheet (`checkpoint:human-verify`)

Render all 50 default documents as 360px-wide thumbnails on one page and screenshot it. Show it
to someone who has not seen the project and ask, verbatim: *"Group these into 'shops that look
like the same shop'. How many groups do you end up with?"* **Pass condition: no group contains
more than 2 templates**, and the total group count is ≥ 20.

This is one artifact and one question, and it covers all 50 — where all-pairs covers none.

#### Layer 3 — Adversarial-pair stranger test (`checkpoint:human-verify`, blocking)

Do **not** sample randomly. Rank all 1,225 pairs by the Layer-1 metric (same structure first,
then closest accent) and take the **6 closest pairs** — the library's hardest cases by
construction. Run Phase 4's exact check #1 on each: two seeded demo stores, different logos,
screenshotted side by side at 360px and 1440px, asked *"Are these two different shops, or the
same shop twice?"*

**Pass condition (inherited verbatim from Phase 4): the answer is "different shops," unprompted,
and they can name three differences without help — for all six pairs.** If the six *most
similar* pairs pass, every other pair passes a fortiori. That is the logic that makes sampling
sound here and would not make random sampling sound.

Phase 4's checks #2–#7 (surface separation, band rhythm, type hierarchy, motion, token hygiene,
accent extremes) carry forward unchanged and are run against a 5-template sample spanning all
variants, not all 50.

> **Dependency note:** Phase 4's own Wave 7 Tasks 2-3 — including its stranger test — have **not
> been run** and were deliberately deferred `[VERIFIED: .planning/STATE.md:29]`. Phase 5's gate
> subsumes Phase 4's for the flagship, but the planner should surface that Phase 4's check #1 is
> still formally open so it is closed once rather than twice.

---

## Architecture Patterns

### System Architecture Diagram

```
                        ONBOARDING                                    EDITOR
  ┌───────────────────────────────────────┐      ┌──────────────────────────────────────┐
  │ /onboarding/branding (RSC)            │      │ /dashboard/storefront-editor (RSC)   │
  │  session → org(name,slug,plan,industry)│      │  requireMerchantContext()            │
  │  reads TEMPLATES (server-only)         │      │  getEditorStorefront(tenantId)       │
  │  → plain TemplateTile[] props          │      │  reads draftTemplateKey              │
  └────────────┬───────────────────────────┘      │  → accessibleTemplateKeys(plan.tier) │
               │ props                            └───────────┬──────────────────────────┘
               ▼                                              │ props
  ┌────────────────────────────────────────┐                  ▼
  │ <BrandingForm> (client island)         │      ┌──────────────────────────────────────┐
  │  name · industry tiles · LOGO · colors │      │ <EditorShell> (client)               │
  │  + NEW: <TemplatePicker> filtered by   │      │  rail: Brand&logo · CHANGE TEMPLATE  │
  │    the industry just selected (soft)   │      │        · sections…                   │
  │    <TemplateThumbnail/> = CSS wireframe│      │  <TemplatePicker> (same component)   │
  └────────────┬───────────────────────────┘      │  → <AlertDialog> destructive confirm │
               │ saveBranding({…, templateKey})   └───────────┬──────────────────────────┘
               ▼                                              │ switchTemplate({templateKey})
  ┌────────────────────────────────────────┐                  ▼
  │ saveBranding (NOT merchantAction —     │      ┌──────────────────────────────────────┐
  │  DAL would loop; T-04-27)              │      │ switchTemplate (merchantAction write)│
  │  isTemplateKey refine → narrow         │      │  1. assertCanEditStorefront          │
  │  seed draft+published from THAT        │      │  2. assertTemplateAccess(plan.tier)  │
  │  template's defaults                   │      │  3. re-seed DRAFT ONLY               │
  └────────────┬───────────────────────────┘      └───────────┬──────────────────────────┘
               │                                              │
               ▼                                              ▼
  ┌──────────────────────────────────────────────────────────────────────────────────────┐
  │ scopedDb(ctx.tenantId) — tenant stamped LAST, never from a payload                    │
  │  StorefrontTheme: draftTemplateKey │ publishedTemplateKey │ draftTokens │ publishedT. │
  │  StorefrontPage : draft            │ published                                        │
  └────────────┬─────────────────────────────────────────────────┬───────────────────────┘
               │ getEditorStorefront (draft*)                    │ getPublishedStorefront (published*)
               ▼                                                 ▼
  ┌────────────────────────────────┐              ┌──────────────────────────────────────┐
  │ editor preview (client canvas) │              │ /s/[slug] home (RSC)                 │
  │  postMessage: document+tokens  │              │  variantsForTemplate(publishedTplKey)│
  │           + NEW: variants      │              └───────────┬──────────────────────────┘
  │  validated by sectionVariants- │                          │
  │  Schema (marker-free schema.ts)│                          ▼
  └────────────┬───────────────────┘              ┌──────────────────────────────────────┐
               └─────────────────────────────────▶│ <SectionRenderer section data        │
                                                  │   variants={SectionVariantMap} />    │
                                                  │  ONE switch · 5 arms · no default    │
                                                  │  variant={variants.hero}  ← LITERAL  │
                                                  └───────────┬──────────────────────────┘
                                                              ▼
                                                  ┌──────────────────────────────────────┐
                                                  │ <HeroSection variant="stack"|…>      │
                                                  │  own inner exhaustive variant switch │
                                                  │  (× 5 section components)            │
                                                  └──────────────────────────────────────┘
```

### Recommended Project Structure

```
src/server/theming/
├── schema.ts             # + SECTION_VARIANTS, SectionVariant<T>, SectionVariantMap,
│                         #   sectionVariantsSchema  ← MARKER-FREE, do not add server-only
├── registry.ts           # + TEMPLATE_KEYS (50), TemplateSection, TemplateDefinition
│                         #   {segment, minTier, sections:[{type,variant}]},
│                         #   variantsForTemplate(), TEMPLATE_SEGMENT index
├── access.ts             # NEW — accessibleTemplateKeys(tier), canUseTemplate(tier,key),
│                         #   assertTemplateAccess(ctx,key,message)
├── errors.ts             # + TemplateLockedError extends EntitlementError
├── defaults.ts           # flagship* unchanged + TEMPLATE_DEFAULTS registry +
│                         #   templateDefaultDocument(key) / templateDefaultTokens(key)
├── templates/            # NEW — one file per segment, 8-9 builders each
│   ├── fashion-apparel.ts
│   ├── electronics.ts
│   ├── beauty-cosmetics.ts
│   ├── grocery-food.ts
│   ├── furniture-home.ts
│   └── general-retail.ts
├── queries.ts            # getPublishedStorefront += publishedTemplateKey in select;
│                         # getEditorStorefront: templateKey → draftTemplateKey
└── actions.ts            # + switchTemplate; publishStorefront/discardDraft handle the
                          #   template columns; saveBranding takes templateKey

src/app/s/[slug]/sections/
├── section-renderer.tsx  # + variants prop; still 5 arms, no default, no cast
├── hero-section.tsx      # + variant prop, own inner exhaustive switch (3 variants)
├── trust-bar-section.tsx # (2)   ├─ product-grid-section.tsx (3)
├── editorial-split-section.tsx (2)   └─ contact-section.tsx (2)
└── (optionally one file per variant if a component exceeds ~250 lines)

src/components/theming/
└── template-thumbnail.tsx  # NEW — CSS/SVG wireframe from {type,variant}[]; zero images

src/lib/strings/           # MOVED from src/lib/strings.ts (import path unchanged)
├── index.ts               # the existing 1,731 lines, verbatim, + `templates` splice
└── templates/<segment>.ts # ≈1,000-1,250 new copy strings
```

### Pattern 1: The typed variant vocabulary (goes in `schema.ts`)

**What:** A `SECTION_VARIANTS` table whose value type is correlated to its key, producing a
`SectionVariantMap` that narrows on literal-key access.
**When to use:** This is the load-bearing type for the entire phase.

```ts
// src/server/theming/schema.ts — MARKER-FREE. Do not add `server-only` (see file header).

/**
 * The complete vocabulary of rendering variants, one closed list per section type.
 *
 * `Readonly<Record<SectionType, …>>` for the same reason SECTION_TYPES is: a sixth
 * member of the discriminated union becomes a COMPILE error right here.
 *
 * THE FIRST ENTRY OF EACH LIST IS THE FLAGSHIP'S AND IS THE DEGRADED-READ DEFAULT.
 * `variantsForTemplate()` falls back to it for an omitted section and for an
 * unrecognised template key, so a drifted column renders the Phase 4 design rather
 * than nothing.
 */
export const SECTION_VARIANTS = {
  hero: ["full-bleed", "split", "stack"],
  "trust-bar": ["band", "strip"],
  "product-grid": ["grid", "dense", "showcase"],
  "editorial-split": ["split", "banner"],
  contact: ["band", "card"],
} as const satisfies Readonly<
  Record<SectionType, readonly [string, string, ...string[]]>
>;

/** The legal variants for one section type. */
export type SectionVariant<T extends SectionType> =
  (typeof SECTION_VARIANTS)[T][number];

/**
 * A complete variant assignment. Complete, never Partial: SectionRenderer indexes
 * it with a LITERAL key inside each switch arm, and a Partial would widen every
 * read to `| undefined` and put an `??` fallback in the renderer — which is the
 * lookup-with-a-default shape that file's header bans.
 */
export type SectionVariantMap = {
  readonly [K in SectionType]: SectionVariant<K>;
};

/**
 * A template's per-section variant choice, as a discriminated union rather than
 * `{ type: SectionType; variant: string }` — so a row cannot pair "hero" with
 * "dense" and still compile.
 */
export type TemplateSectionRef = {
  [K in SectionType]: { readonly type: K; readonly variant: SectionVariant<K> };
}[SectionType];

/**
 * The postMessage door for the variant map (T-04-08's third trust boundary).
 *
 * DELIBERATELY NOT PART OF `pageDocumentSchema`. Variants are template-level and
 * not merchant-editable (D-02), so a direct POST to `saveDraft` still cannot set
 * one — this schema exists only so the editor can tell its own preview iframe
 * which variants to render after a template switch, without a reload.
 */
export const sectionVariantsSchema = z.object({
  hero: z.enum(SECTION_VARIANTS.hero),
  "trust-bar": z.enum(SECTION_VARIANTS["trust-bar"]),
  "product-grid": z.enum(SECTION_VARIANTS["product-grid"]),
  "editorial-split": z.enum(SECTION_VARIANTS["editorial-split"]),
  contact: z.enum(SECTION_VARIANTS.contact),
});
```

### Pattern 2: The renderer, unchanged in shape

```tsx
// src/app/s/[slug]/sections/section-renderer.tsx

export function SectionRenderer({
  section,
  data,
  variants,
}: {
  readonly section: SectionInstance;
  readonly data: StorefrontRenderData;
  readonly variants: SectionVariantMap;
}): ReactElement {
  switch (section.type) {
    // `variants.hero` — A LITERAL KEY, NEVER `variants[section.type]`.
    // The literal narrows to HeroVariant; the computed index would widen to the
    // union of ALL variants and force the cast this file exists to refuse.
    case "hero":
      return (
        <HeroSection
          settings={section.settings}
          data={data}
          variant={variants.hero}
        />
      );

    case "trust-bar":
      return (
        <TrustBarSection
          settings={section.settings}
          variant={variants["trust-bar"]}
        />
      );
    // …three more arms, still no `default`, still `: ReactElement`
  }
}
```

Each section component then owns an inner exhaustive switch using the same mechanism:

```tsx
export function HeroSection({ settings, data, variant }: {
  readonly settings: Extract<SectionInstance, { type: "hero" }>["settings"];
  readonly data: StorefrontRenderData;
  readonly variant: SectionVariant<"hero">;
}): ReactElement {
  switch (variant) {                  // no default arm, `: ReactElement` annotation
    case "full-bleed": return <HeroFullBleed settings={settings} data={data} />;
    case "split":      return <HeroSplit     settings={settings} data={data} />;
    case "stack":      return <HeroStack     settings={settings} data={data} />;
  }
}
```

**Anti-pattern:** a `Record<Variant, Component>` lookup inside the section component. It would
compile (the settings type is already narrowed at that point, so no correlation is lost) — but it
reintroduces the lookup-with-a-default shape and makes a fourth variant silently render nothing.
Use the switch for consistency with the file directly above it.

### Pattern 3: Template rows carry segment, tier and variants

```ts
// src/server/theming/registry.ts (server-only)

export interface TemplateDefinition {
  readonly key: TemplateKey;
  /**
   * The segment this template was DESIGNED FOR — a property of the template, not a
   * derivation from any merchant's `Organization.industry`.
   *
   * D-03/D-05 STILL BIND. The picker uses this to sort and pre-filter, and must
   * always offer a "show all" affordance. There is no function anywhere that maps
   * an organization's industry to a template, and there must not be one.
   */
  readonly segment: IndustrySegment;
  /** D-06. The lowest tier that may SELECT this template. Not a render gate. */
  readonly minTier: PlanTier;
  /** The ordered sections AND the variant each renders in (D-02). */
  readonly sections: readonly TemplateSectionRef[];
}

/**
 * Resolves a template key to a COMPLETE variant map.
 *
 * Omitted section types get their list's first entry (the flagship's). An
 * unrecognised key gets the all-first map, matching the read path's
 * safeParse-to-flagship-defaults posture: a drifted column renders the Phase 4
 * design, never nothing.
 */
export function variantsForTemplate(key: string): SectionVariantMap;
```

### Pattern 4: The tier gate — registry owns membership, entitlements owns rank

```ts
// src/server/entitlements/plans.ts

/**
 * D-06's nesting, made structural. Starter's set ⊂ Business's ⊂ Professional's is a
 * consequence of `rank >= minTier.rank`, not three hand-maintained lists that could
 * disagree. Adding a fourth tier is a compile error here.
 */
export const PLAN_TIER_RANK: Readonly<Record<PlanTier, number>> = {
  starter: 0,
  business: 1,
  professional: 2,
};

// …and inside PlanLimits, following the D-07 register-everything discipline:
/**
 * How many templates this tier can SELECT from. `null` is all of them.
 *
 * ENFORCED, but NOT FROM THIS NUMBER — the gate is a per-template `minTier`
 * comparison in `src/server/theming/access.ts`. This key is the DOCUMENTED catalog
 * size (10 / 25 / null), and `tests/unit/template-distinctiveness.test.ts` asserts
 * the registry's actual accessible count for each tier equals it. Gating on the
 * count directly would make the reachable set depend on registry declaration order.
 */
readonly templates: number | null;   // starter 10, business 25, professional null
```

```ts
// src/server/theming/access.ts (new, server-only)

/** Rendering-time question. The picker hides a card from this; the assert is the control. */
export function canUseTemplate(tier: PlanTier, key: TemplateKey): boolean {
  return PLAN_TIER_RANK[tier] >= PLAN_TIER_RANK[TEMPLATES[key].minTier];
}

/**
 * Write-time gate (D-06/D-08). Throws.
 *
 * READS `ctx.plan.tier`, NOT a trial-composed boolean, AND THE ASYMMETRY WITH
 * `assertCanEditStorefront` IS DELIBERATE — DO NOT "MAKE THEM CONSISTENT".
 * D-15 elevates the EDITOR during the trial because losing the editor at expiry
 * costs the merchant nothing they can see. A template is a durable choice: elevating
 * it would mean either force-migrating a live storefront at expiry (permanently
 * banned — see registry.ts's D-03 header) or never enforcing the gate at all.
 */
export function assertTemplateAccess(
  ctx: MerchantContext,
  key: TemplateKey,
  message: string,
): void {
  if (!canUseTemplate(ctx.plan.tier, key)) throw new TemplateLockedError(key, message);
}
```

`TemplateLockedError extends EntitlementError` (in `src/server/theming/errors.ts`) so
`merchantAction`'s existing `instanceof EntitlementError` arm converts it to
`{ ok: false, error: { form: [message] } }` with **no change to that file** — the exact trick
`EditorLockedError` already uses `[VERIFIED: codebase — assert.ts:61-84]`. Remember the
`this.name` re-assignment after `super()`, or every log line names the parent class.

### Pattern 5: `switchTemplate` — draft-only, destructive, sibling to `ensureStorefrontSeeded`

```ts
// src/server/theming/actions.ts

const switchTemplateSchema = z.object({
  // Narrows through the registry's own predicate rather than a z.enum, so the closed
  // set lives in one place — the `saveBranding`/`isIndustrySegment` precedent exactly.
  // NO TENANT IDENTIFIER (T-04-04): the target is ctx.tenantId and nothing else.
  templateKey: z.string().refine(isTemplateKey, "Not a template."),
});

type SwitchTemplateData = {
  document: PageDocument;      // returned so the open editor swaps state without a reload
  tokens: ThemeTokens;         //   — the `discardDraft` precedent
  variants: SectionVariantMap; //   — posted to the preview iframe
  templateKey: string;
  draftUpdatedAt: string;
};

export const switchTemplate = merchantAction<typeof switchTemplateSchema, SwitchTemplateData>({
  mode: "write",
  schema: switchTemplateSchema,
  handler: async (ctx, { templateKey }) => {
    assertCanEditStorefront(ctx, strings.editor.starterViewOnly);   // EDIT-03/D-13/D-15
    assertTemplateAccess(ctx, templateKey, strings.editor.templateTierLocked); // D-06

    const document = templateDefaultDocument(templateKey);
    /*
     * THE MERCHANT'S TWO ACCENTS AND THEIR LOGO SURVIVE THE SWITCH. D-09 discards
     * the DOCUMENT, not the brand. `saveBranding` already establishes this exact
     * composition — `{ ...defaultTokens(), primaryAccent, secondaryAccent }` — and
     * resetting an identity the merchant chose at onboarding because they changed
     * layout would read as data loss, not as a template change. The announcement
     * text and footer tagline DO reset: they are template copy, not brand identity.
     */
    const tokens = { ...templateDefaultTokens(templateKey), ...keepAccents };

    // DRAFT COLUMNS ONLY. `published`, `publishedTokens` and `publishedTemplateKey`
    // are left byte-identical — D-08's whole point. The merchant previews the new
    // template, then publishes it, and `discardDraft` still walks it back.
    await scopedDb(ctx.tenantId).$transaction(/* draft, draftTokens, draftTemplateKey, draftUpdatedAt */);

    revalidatePath("/dashboard/storefront-editor");
    return { ok: true as const, /* … */ };
  },
});
```

**On `ensureStorefrontSeeded`'s idempotency (the flagged open question): it is orthogonal and
must stay so.** `ensureStorefrontSeeded` is an `upsert` with `update: {}` on both halves,
explicitly so it "NEVER CLOBBERS AN EXISTING MERCHANT'S WORK"
`[VERIFIED: codebase — actions.ts:399-416]`. `switchTemplate` is the *deliberate clobber*. They
are opposite intents and must remain separate exports; folding the switch into the seed as a
parameter would put a destructive path behind a function every editor visit calls. Leave
`ensureStorefrontSeeded` writing the flagship defaults — it only fires when rows are *missing*,
and for a pre-Phase-4 organization whose column already reads `flagship-fashion` that is the
honest answer.

### Pattern 6: Template thumbnails as CSS wireframes, not screenshots

A picker showing 25 template cards needs a preview per card. Screenshots would mean 50 images
in R2 or in `public/`, a regeneration obligation on every skeleton change, and real bytes on the
low-end Android this market runs on.

**Instead:** one `<TemplateThumbnail sections={TemplateSectionRef[]} accent={hex} />` client
component (~60-80 lines) that maps each `{type, variant}` to a small styled block —
`hero:full-bleed` → one tall filled block; `hero:split` → two side-by-side blocks;
`product-grid:dense` → a 3×2 grid of small squares; `editorial-split:banner` → one wide dark bar.
Zero image bytes, zero R2 dependency, and it cannot drift from the skeleton because it renders
*from* the skeleton. The same component serves the onboarding picker and the editor's change
dialog — one component, two surfaces.

The accent fill must come from the template's own default `primaryAccent` as an inline CSS
custom property, **not** a Tailwind palette utility and **not** a literal colour in the `.tsx` —
`tests/unit/surface-token-isolation.test.ts` bans 1 and 2 catch both
`[VERIFIED: codebase — surface-token-isolation.test.ts:222, 249]`.

### Pattern 7: The onboarding picker slots into the existing branding form

**Where industry is captured today** `[VERIFIED: codebase]`: `/onboarding/branding`, as a
six-tile grid inside `<BrandingForm>`, assembled server-side into plain `SegmentTile[]` props
because `registry.ts` is `server-only`. The step is written by `saveBranding`, which is
**deliberately not built with `merchantAction`** — routing it through the DAL would redirect the
submission back to the page it came from, since a merchant on that page has `industry === null`
by definition (T-04-27). The DAL ladder is: no session → `/login`; no org →
`/onboarding/create-store`; `planTier === null` → `/onboarding/plan`; `industry === null` →
`/onboarding/branding` `[VERIFIED: codebase — context.ts:97-139]`.

**Recommendation: add the template picker as one more card inside `<BrandingForm>`, submitted by
the same `saveBranding` call.** Rationale:

- D-07 says "right after the existing industry-selection step." In the same form, immediately
  below the industry tiles, is *literally* that — and the picker can filter on the industry the
  merchant just clicked with **zero** round trips.
- A separate `/onboarding/template` route needs a "template not yet chosen" state to gate on.
  `templateKey` carries a DB default so absence is not representable; the only other signal
  (StorefrontTheme row absence) would require adding a second-table read to
  `requireMerchantContext`, whose shape is pinned by `tests/unit/no-tenant-id-param.test.ts` and
  whose header calls its single-read design load-bearing.
- Zero new routes, zero new DAL rungs, zero new nullable columns, zero new half-onboarded states.

`saveBrandingSchema` gains `templateKey: z.string().refine(isTemplateKey, …)` — a sixth field
alongside the existing five, narrowing through the registry predicate exactly as `industry`
already does. The seed then uses `templateDefaultDocument(templateKey)` /
`templateDefaultTokens(templateKey)` instead of the flagship's, and writes both
`draftTemplateKey` and `publishedTemplateKey`.

**Payload concern, addressed:** a Starter merchant sees 10 cards, a Professional 25 (soft-filtered
to their segment first). With Pattern 6's CSS wireframes that is a few kilobytes of DOM, not 25
images.

### Pattern 8: The "Change template" surface in the editor

The rail already has a `Theme` group with one `Brand & logo` row above a `Sections` group
`[VERIFIED: codebase — section-list.tsx:233-250]`. Add a second row to the `Theme` group —
`Change template`, with a lucide `LayoutTemplate` icon — selecting it swaps the settings panel
to the picker, exactly as `Brand & logo` does today (`onSelectTheme` / `themeSelected` is the
pattern to copy). Choosing a template opens a destructive `<AlertDialog>` naming what will be
lost, then calls `switchTemplate`.

**Preview resync (a real integration constraint, not a detail):** the preview route is
**deliberately ungated and serves ONLY published data** — *"There is also nothing here for a gate
to protect. This route serves ONLY data the storefront already serves publicly"*
`[VERIFIED: codebase — preview/page.tsx:51-59]`. So the preview page must **not** be taught to
read `draftTemplateKey`; that would leak an unpublished choice and break a documented invariant.
The draft variant map therefore travels through the existing postMessage handshake alongside the
draft document and tokens, validated by `sectionVariantsSchema` at the receiver — which is
precisely the door `schema.ts` was built marker-free to serve.

### Anti-Patterns to Avoid

- **Putting `variant` inside `sectionInstanceSchema`.** Makes it merchant-settable by direct POST
  (violates D-02) and fails `tests/unit/theming-registry.test.ts`'s "field descriptor for every
  schema key" assertion unless you also expose a merchant-facing variant control — which is the
  thing D-02 forbids.
- **`variants[section.type]` in the renderer.** Widens to the union of all variants and forces a
  cast. Use literal keys.
- **Importing `registry.ts` (or `defaults.ts`) from `section-renderer.tsx`, any section
  component, `preview-canvas.tsx`, or the picker island.** All are `server-only`; the failure is
  an editor-route build error (T-04-24). Resolve server-side, pass as props.
- **Deriving a template from `Organization.industry`.** Permanently banned by `registry.ts`'s
  D-03 header. A *soft* filter in the picker is fine; a hard one is the same prohibition arriving
  through the back door.
- **Writing `publishedTemplateKey` from `switchTemplate`.** That is a silent publish.
- **Auto-migrating existing merchants onto a new segment template.** Also permanently banned.
  Every existing tenant stays on `flagship-fashion` until they choose otherwise.
- **Widening `storageKeySchema` to admit stock imagery.** It is a security control (§ Finding 3).
- **Making `ensureStorefrontSeeded` template-aware by adding a parameter.** Puts a destructive
  path behind an idempotent one called on every editor visit.
- **Inlining template copy into `defaults.ts` or the section components.** CLAUDE.md's centralized
  copy rule; the `.tsx` prose scan enforces it for components, and `registry.ts`'s header states
  the same rule for `.ts` files under `src/server/**` that the scan cannot reach.
- **Hoisting any of the 50 default-document builders to a module constant.** The
  fresh-object-per-call rule is pinned by a mutation test and its violation is silent,
  cross-tenant corruption `[VERIFIED: codebase — defaults.ts:11-22, theming-registry.test.ts:411]`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Exhaustiveness over 50 template keys | A `Map` with a `?? fallback` | `Readonly<Record<TemplateKey, …>>` | Four confirmed instances of this idiom already (`PLANS`, `IMAGE_PRESETS`, `ORDER_TRANSITIONS`, `SECTION_TYPES`/`TEMPLATES`). A 51st key becomes a compile error at every table |
| Variant → component dispatch | A `Record<Variant, Component>` lookup | An exhaustive `switch` with a `: ReactElement` annotation and no `default` | `section-renderer.tsx`'s header is a 40-line argument for why; a fourth variant must be a build error, not a section that renders nothing |
| Untrusted `templateKey` narrowing | An inline `includes()` or a `z.enum` restating the 50 keys | The existing `isTemplateKey` predicate `[VERIFIED: codebase — registry.ts:471-473]` | Two narrowers that resolve differently are two chances to be wrong. `isIndustrySegment` is the same function, copied body-for-body, and says so |
| Entitlement refusal plumbing | A new error type + a new `merchantAction` catch arm | `TemplateLockedError extends EntitlementError` | The existing catch arm handles it with zero changes — the `EditorLockedError` precedent |
| Tier nesting (Starter ⊂ Business ⊂ Professional) | Three hand-maintained key arrays | `PLAN_TIER_RANK` + per-template `minTier` | Three lists can disagree; a rank comparison cannot. Also survives adding a template without touching three places |
| Character-cap enforcement on ~1,250 copy strings | Manual review or a lint rule | The existing Zod caps + a generalized default-document parse test | Already built; extend the loop from 1 template to 50 |
| Draft/published consistency for the template column | A `templateVersion` or an `isDirty` flag | The existing paired-column model | `queries.ts` already argues against derived state stored (`isDirty` "goes stale the first time a write path forgets to set it") |
| Template preview images | 50 screenshots in R2 or `public/` | Pattern 6's CSS wireframe component | Zero bytes, zero regeneration obligation, cannot drift from the skeleton |
| Colour-contrast checking on 50 accent pairs | A new contrast library | `deriveThemeCssVars` / `accentForeground` in `src/lib/theme-defaults.ts` | Already ships (D-11): foregrounds and the focus ring are auto-derived so an unreadable pair cannot be persisted |

**Key insight:** every mechanism this phase needs already exists in this repository, built by
Phase 4 with the explicit expectation that Phase 5 would extend it. The registry header literally
says *"Phase 5 adds ROWS to this table and a picker that writes a merchant's choice"*. The work
is authoring data and seven variant components — not designing infrastructure. Any task that
proposes a new abstraction should be treated as suspect.

---

## Runtime State Inventory

> Included because this phase carries a column **rename** on a table that already holds live
> merchant rows. Everything else in the phase is additive.

| Category | Items Found | Action Required |
|---|---|---|
| **Stored data** | `storefront_theme.templateKey` — every existing tenant row holds `"flagship-fashion"`. Renaming it to `publishedTemplateKey` and adding `draftTemplateKey` must preserve those values. | **Hand-edited migration** using `ALTER TABLE … RENAME COLUMN` + `ADD COLUMN … DEFAULT 'flagship-fashion'`. See Pitfall 1 |
| **Stored data** | `storefront_page.draft` / `.published` — existing documents were built from the flagship skeleton. They stay valid: the flagship template, its section list and its default document are unchanged this phase. | **None** — no backfill, no auto-migration (D-03, permanent) |
| **Live service config** | None. No external service holds a template identifier. | None — verified: no template key appears outside `src/` and `prisma/` |
| **OS-registered state** | None. No scheduled task, pm2 process or systemd unit references templates. | None |
| **Secrets / env vars** | None. This phase adds no environment variable. R2 stays required (existing product/logo uploads), but no *new* R2 dependency is introduced because no stock imagery is sourced. | None |
| **Build artifacts** | `src/generated/prisma/**` — regenerated by the `postinstall` hook after the schema change. | `npx prisma generate` (or any `npm install`) after the migration; typecheck will fail loudly until it runs |
| **Test fixtures** | `tests/setup/seed-two-tenants.ts` seeds tenants on `flagship-fashion` and depends on default-document byte-identity. The new columns carry defaults, so the fixture keeps working unmodified — **but only because `flagship-fashion`'s default document is left untouched.** | Verify the fixture still passes; do **not** "improve" the flagship's copy while authoring the other 49 |

---

## Common Pitfalls

### Pitfall 1: Prisma renames a column by DROP + ADD, resetting every merchant's template

**What goes wrong:** `prisma migrate dev` sees `templateKey` gone and `publishedTemplateKey`
present and generates `DROP COLUMN "templateKey"; ADD COLUMN "publishedTemplateKey" … DEFAULT
'flagship-fashion'`. Every existing merchant silently reverts to the flagship. Because every
existing merchant *is* on the flagship today, **this will not be caught by any test or by manual
inspection in dev** — it becomes a data-loss bug only after Phase 5 ships and merchants start
picking templates, and by then the migration is applied.
**Why it happens:** Prisma's schema diff has no rename primitive; it infers drop+add.
**How to avoid:** Generate the migration with `--create-only`, then hand-edit
`prisma/migrations/*/migration.sql` to:
```sql
ALTER TABLE "storefront_theme" RENAME COLUMN "templateKey" TO "publishedTemplateKey";
ALTER TABLE "storefront_theme" ADD COLUMN "draftTemplateKey" TEXT NOT NULL DEFAULT 'flagship-fashion';
UPDATE "storefront_theme" SET "draftTemplateKey" = "publishedTemplateKey";
```
The codebase already writes raw DDL in `prisma/migrations/**/migration.sql`, so this is the
house style, not an exception.
**Warning signs:** the generated SQL contains `DROP COLUMN`; the migration runs clean on an empty
dev branch.
**Descope option:** if the planner judges the rename too risky, keep the column named
`templateKey` as the *published* one and add only `draftTemplateKey`. Cheaper and safer;
costs a naming asymmetry that must then be explained in the schema comment.

### Pitfall 2: Importing the server-only registry from a marker-free renderer

**What goes wrong:** the editor route fails to build with an opaque `server-only` error, after
the variant work is already done.
**Why it happens:** `registry.ts` and `defaults.ts` both carry `server-only`; every file under
`src/app/s/[slug]/sections/` and `preview-canvas.tsx` are deliberately marker-free.
**How to avoid:** the variant vocabulary lives in `schema.ts`. Template *rows* are resolved in an
RSC and handed down as props — the `SegmentTile[]` precedent in `/onboarding/branding/page.tsx`.
**Warning signs:** any `import { … } from "@/server/theming/registry"` in a `.tsx` under
`src/app/s/**` or in any file with `"use client"`.

### Pitfall 3: The generalized drift test passing vacuously across 50 templates

**What goes wrong:** the loop over `Object.keys(TEMPLATES)` iterates but the assertions inside
compare empty sets, so 50 broken templates report green.
**Why it happens:** exactly the failure `theming-registry.test.ts` already guards against for one
template — a Zod-internals change makes introspection return nothing.
**How to avoid:** inherit that file's non-vacuity control idiom. Assert
`Object.keys(TEMPLATES).length === 50` **first**, assert each template's section list is
non-empty, and keep the positive control on the comparison helper.
**Warning signs:** a test named "every template …" that passes when you delete a template's
default builder.

### Pitfall 4: A variant that only reads as designed with a photograph

**What goes wrong:** a hero or editorial-split variant is designed against a stock mock-up, ships
with `backgroundImageKey: null`, and every merchant who picks it sees an empty band on day one.
**Why it happens:** the no-image state is the *day-one* state for essentially every merchant, and
it is easy to design for the wrong one.
**How to avoid:** design and review every variant with `null` images **first**. Add at least one
hero variant (`stack`) and one editorial variant (`banner`) that have **no image slot at all**, so
some templates cannot fail this way.
**Warning signs:** a variant whose distinctiveness argument mentions imagery.

### Pitfall 5: `discardDraft` reverting the document but not the template (or vice versa)

**What goes wrong:** merchant switches template, doesn't like it, clicks Discard — and gets the
old document under the new variants, or the new document under the old variants. Either way the
page is structurally incoherent.
**Why it happens:** `discardDraft` currently reverts two things (`draft`, `draftTokens`); after
this phase it must revert three, and its flagship fallback for a never-published tenant becomes
wrong for a non-flagship tenant.
**How to avoid:** revert `draftTemplateKey = publishedTemplateKey` in the same transaction, and
change the never-published fallback from `flagshipDefaultDocument()` to
`templateDefaultDocument(publishedTemplateKey)`.
**Warning signs:** `flagshipDefaultDocument` still appearing in `discardDraft` after the phase.

### Pitfall 6: The tier gate rendered but not asserted

**What goes wrong:** the picker filters correctly, so manual testing passes; a direct POST to
`switchTemplate` with a Professional key from a Starter account succeeds.
**Why it happens:** `assert.ts`'s own header names this exact failure — *"a mutation whose only
gate is `if (can(...))` has no gate at all when the caller drops the `if`"*.
**How to avoid:** `assertTemplateAccess` as the second statement of the handler, before any DB
call; an isolation test that calls the action directly with an out-of-tier key.
**Warning signs:** the only tier check in the diff is in a `.tsx`.

### Pitfall 7: `src/lib/strings.ts` growing past readability

**What goes wrong:** ~1,250 new strings land in a file that is already 1,731 lines, making it
~3,000+ and effectively unreviewable.
**How to avoid:** convert `src/lib/strings.ts` → `src/lib/strings/index.ts` (a **verbatim** move,
zero content diff) plus `src/lib/strings/templates/<segment>.ts` merged in as `strings.templates`.
The `@/lib/strings` import path resolves identically, so **no call site changes**. No test
references the file path as a path — only in comments `[VERIFIED: codebase — grep across
tests/, eslint.config.mjs, vitest.config.ts]`.
**Warning signs:** the move commit shows content changes, not just a rename.

### Pitfall 8: Adding a "reset to template defaults" convenience to `ensureStorefrontSeeded`

**What goes wrong:** it is called on every editor visit; making it capable of overwriting means
one bad condition wipes a merchant's storefront on page load.
**How to avoid:** keep the two functions separate and keep `update: {}` on both upsert halves.
**Warning signs:** `ensureStorefrontSeeded` growing a parameter.

---

## Code Examples

### Generalizing the flagship drift assertions to 50 templates

```ts
// tests/unit/theming-registry.test.ts — replace the single-template assertions

it("declares exactly 50 templates, all pointing at real section types", () => {
  const keys = Object.keys(TEMPLATES);
  // NON-VACUITY FIRST. Every assertion below loops over this list; an empty or
  // short list would make all of them pass while checking almost nothing.
  expect(keys).toHaveLength(50);                 // TMPL-04's literal count
  expect(new Set(keys).size).toBe(50);

  for (const key of keys) {
    const template = TEMPLATES[key as TemplateKey];
    expect(template.sections.length, `${key} declares no sections`).toBeGreaterThan(0);

    for (const ref of template.sections) {
      expect(settingsShapes.has(ref.type), `${key} lists unknown type ${ref.type}`).toBe(true);
      expect(
        (SECTION_VARIANTS[ref.type] as readonly string[]).includes(ref.variant),
        `${key} pairs ${ref.type} with unknown variant "${ref.variant}"`,
      ).toBe(true);
    }
  }
});

it("builds every template's default document in its own declared order and variants", () => {
  for (const key of Object.keys(TEMPLATES) as TemplateKey[]) {
    const document = templateDefaultDocument(key);

    const parsed = pageDocumentSchema.safeParse(document);
    expect(
      parsed.success ? [] : parsed.error.issues.map((i) => `${key}: ${i.message}`),
      `${key}'s default document does not parse. Most likely a copy string exceeded ` +
        "its schema cap — the cap lives in schema.ts and is the only place it lives.",
    ).toEqual([]);

    expect(
      document.sections.map((s) => s.type),
      `${key}'s default document and TEMPLATES["${key}"].sections disagree.`,
    ).toEqual(TEMPLATES[key].sections.map((ref) => ref.type));

    // D-05's stable-id rule, per template.
    expect(document.sections.filter((s) => s.id !== s.type)).toEqual([]);

    // T-04-22's fresh-object rule, per template. A hoisted literal is silent,
    // cross-tenant corruption.
    expect(templateDefaultDocument(key)).not.toBe(document);
  }
});
```

### The distinctiveness metric (new test file)

```ts
// tests/unit/template-distinctiveness.test.ts — TMPL-05's automated half

const MAX_TEMPLATES_PER_STRUCTURE = 2;
const MIN_STARTER_STRUCTURES = 8;

function signatureOf(key: TemplateKey) {
  const tokens = templateDefaultTokens(key);
  const doc = templateDefaultDocument(key);
  const hero = doc.sections.find((s) => s.type === "hero");
  return {
    structure: TEMPLATES[key].sections.map((r) => `${r.type}:${r.variant}`).join("|"),
    accent: tokens.primaryAccent.toLowerCase(),
    voice: hero ? `${hero.settings.eyebrow}··${hero.settings.heading}` : "",
  };
}

it("has no two templates that are the same shop twice", () => {
  const seen = new Map<string, TemplateKey>();
  const collisions: string[] = [];
  for (const key of Object.keys(TEMPLATES) as TemplateKey[]) {
    const { structure, accent } = signatureOf(key);
    const id = `${structure}##${accent}`;
    const prior = seen.get(id);
    if (prior) collisions.push(`${prior} ≡ ${key}`);
    else seen.set(id, key);
  }
  expect(
    collisions,
    "Two templates share BOTH their structure and their accent — they are the same " +
      "design twice and will fail TMPL-05's stranger test by construction.\n" +
      "  FIX: change one template's variant assignment or its accent pair.\n" +
      "  WRONG FIX: do not relax this check. Genericness is the failure condition.",
  ).toEqual([]);
});

it("spreads the tier gate across structures instead of concentrating it", () => {
  const starter = accessibleTemplateKeys("starter");
  expect(starter).toHaveLength(10);                          // D-06
  expect(
    new Set(starter.map((k) => signatureOf(k).structure)).size,
    "The 10 Starter-accessible templates span too few distinct structures. Starter is " +
      "the tier most merchants land on, so a concentrated Starter set makes the whole " +
      "library read as generic to the majority of the product's users.",
  ).toBeGreaterThanOrEqual(MIN_STARTER_STRUCTURES);

  // Finding 5's dead-end guard.
  for (const segment of INDUSTRY_SEGMENTS) {
    expect(
      starter.some((k) => TEMPLATES[k].segment === segment),
      `Segment "${segment}" has no Starter-accessible template, so a Starter merchant ` +
        "who picks it at onboarding opens a picker with nothing designed for them.",
    ).toBe(true);
  }
});

it("keeps the tier sets nested and the counts at 10/25/50", () => {
  const s = new Set(accessibleTemplateKeys("starter"));
  const b = new Set(accessibleTemplateKeys("business"));
  const p = new Set(accessibleTemplateKeys("professional"));
  expect([...s].every((k) => b.has(k))).toBe(true);   // D-06 nesting, structurally
  expect([...b].every((k) => p.has(k))).toBe(true);
  expect([s.size, b.size, p.size]).toEqual([10, 25, 50]);
  // Drift guard against the registered PlanLimits number.
  expect(s.size).toBe(PLANS.starter.limits.templates);
  expect(b.size).toBe(PLANS.business.limits.templates);
  expect(PLANS.professional.limits.templates).toBeNull();
});
```

---

## State of the Art

| Old Approach (Phase 4) | Current Approach (Phase 5) | Impact |
|---|---|---|
| One template, `flagship-fashion` | 50 rows, 6 segments, 25 skeletons | `TEMPLATE_KEYS` becomes a 50-member tuple; `isTemplateKey`'s Set narrowing is unchanged and still correct |
| Section type → exactly one component | Section type → 2-3 variants | New `variants` prop on `SectionRenderer`; the exhaustiveness mechanism is unchanged |
| `templateKey` a single unpaired column | `draftTemplateKey` / `publishedTemplateKey` | The theme row's draft/published symmetry becomes complete; one hand-edited migration |
| `saveBranding` seeds the flagship unconditionally | Seeds the merchant's picked template | Sixth field on `saveBrandingSchema` |
| No template selection surface anywhere | Onboarding card + editor rail entry | Two surfaces, one shared picker component |
| `PlanLimits.editorSections` permanently `null`; the editor is the only tier-differentiated theming capability | `PlanLimits.templates` (10/25/`null`) joins it | A second theming entitlement — the first that is **not** trial-elevated (Finding 6) |
| Distinctiveness gate = 7 checks on 2 stores | Metric + contact sheet + 6 adversarial pairs | Scales to N; keeps Phase 4's human check as the requirement |

**Deprecated / no longer accurate after this phase:**
- `registry.ts`'s comment *"No display name lives on a row yet — Phase 5 adds it to `strings` at
  the same time it adds the surface"* — this phase is that moment. Every row needs a display name
  and a one-line description in `strings`.
- `actions.ts`'s `DEFAULT_TEMPLATE_KEY` as the *universal* seed source — it stays as
  `ensureStorefrontSeeded`'s self-heal value only.
- `pricing-reference.md`'s Starter "3-5 templates…" copy — D-06 reconciles it to 10. The
  marketing copy in `strings` must be updated in the same commit as the gate, or the product
  promises one number and enforces another.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | Everything | ✓ | v24.16.0 (meets the Node 24 LTS requirement) | — |
| Vitest | Both test projects | ✓ | 4.1.10 | — |
| TypeScript | The whole variant type design | ✓ | 5.9.3 (pinned) | — |
| Prisma CLI | The column migration | ✓ | 7.9.1 | — |
| Neon test branch (`TEST_DATABASE_URL`) | `npm run test:full` isolation tests for `switchTemplate` | Pre-existing project requirement; not re-verified in this session | — | Unit tests cover the registry, gate and distinctiveness metric with **no** database; only the action-level tests need it |
| Cloudflare R2 | Existing product/logo uploads only | Pre-existing project requirement | — | **This phase adds no new R2 dependency** — the no-stock-image decision means zero new assets |
| Upstash Redis | Nothing in this phase | Optional in dev by design | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 4.1.10, two projects: `unit` (DB-free, `server-only` aliased to a stub) and `isolation` (dedicated Neon branch) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test:unit` |
| Full suite command | `npm run test:full` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| TMPL-03 | ≥3 additional segments have their own structurally distinct skeletons (recommend all 6) | unit | `npx vitest run tests/unit/template-distinctiveness.test.ts -t "segment"` | ❌ Wave 0 |
| TMPL-04 | Exactly 50 templates; every default document parses, matches its declared sections+variants, has type-as-id, and is fresh per call | unit | `npx vitest run tests/unit/theming-registry.test.ts` | ✅ (extend) |
| TMPL-04 | Cumulative tier counts are exactly 10 / 25 / 50 and the sets are nested | unit | `npx vitest run tests/unit/template-distinctiveness.test.ts -t "nested"` | ❌ Wave 0 |
| TMPL-05 | No two templates share structure + accent; no structure used > 2×; all hero voices distinct; Starter set spans ≥8 structures; every segment has a Starter option | unit | `npx vitest run tests/unit/template-distinctiveness.test.ts` | ❌ Wave 0 |
| TMPL-05 | Contact sheet + 6 adversarial-pair stranger tests | manual | `checkpoint:human-verify` (final wave, **blocking**) | — |
| D-02 | Variant vocabulary is complete and marker-free; a 6th section type is a compile error at `SECTION_VARIANTS` | unit + `npm run typecheck` | `npm run typecheck && npx vitest run tests/unit/theming-registry.test.ts` | ✅ (extend) |
| D-02 | No `server-only` module is reachable from `src/app/s/[slug]/sections/**` or any `"use client"` file | unit (source scan) | `npx vitest run tests/unit/theming-marker-boundary.test.ts` | ❌ Wave 0 — a small source-scanning contract test in the house idiom; catches Pitfall 2 without waiting for a build |
| D-06 | `switchTemplate` refuses an out-of-tier key posted directly, before any DB write | isolation | `npx vitest run tests/isolation/template-switch.test.ts -t "tier"` | ❌ Wave 0 |
| D-08/D-09 | Switching writes draft columns only; `published`, `publishedTokens`, `publishedTemplateKey` byte-identical; then publish promotes all three | isolation | `npx vitest run tests/isolation/template-switch.test.ts` | ❌ Wave 0 |
| D-09 | `discardDraft` reverts document, tokens **and** `draftTemplateKey` together | isolation | `npx vitest run tests/isolation/template-switch.test.ts -t "discard"` | ❌ Wave 0 |
| D-07 | `saveBranding` seeds from the picked template, not the flagship; refuses a forged `templateKey` | isolation | `npx vitest run tests/isolation/onboarding-template.test.ts` | ❌ Wave 0 |
| Migration | Existing tenants' template values survive the rename | isolation | `npm run test:full` against a branch seeded **before** migrating | ❌ Wave 0 (see Pitfall 1) |
| Regression | Existing Phase 4 fixtures and the flagship's byte-identity still hold | unit + isolation | `npm run test:unit && npm run test:full` | ✅ |
| All | Token hygiene bans 1-6 still green with the new variants and picker | unit | `npx vitest run tests/unit/surface-token-isolation.test.ts` | ✅ |

### Sampling Rate

- **Per task commit:** `npm run test:unit` (DB-free, seconds)
- **Per wave merge:** `npm run lint && npm run typecheck && npm run test:unit`
- **Phase gate:** `npm run test:full` green, then the contact sheet and adversarial-pair
  checkpoints, then `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/template-distinctiveness.test.ts` — covers TMPL-05, TMPL-04's tier counts
- [ ] `tests/unit/theming-marker-boundary.test.ts` — covers D-02's marker constraint (Pitfall 2)
- [ ] `tests/isolation/template-switch.test.ts` — covers D-06, D-08, D-09
- [ ] `tests/isolation/onboarding-template.test.ts` — covers D-07
- [ ] Extend `tests/unit/theming-registry.test.ts` from 1 template to 50
- [ ] Framework install: **none** — Vitest 4.1.10 and both projects are already configured

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | Unchanged; the session is the only tenant channel and this phase adds no auth surface |
| V3 Session Management | no | Unchanged |
| V4 Access Control | **yes** | `assertTemplateAccess(ctx, key, message)` as the second statement of `switchTemplate`, before any DB call — the throwing half of the codebase's boolean/throw pair. Never `if (canUseTemplate(...))` alone |
| V5 Input Validation | **yes** | `templateKey` narrows through `isTemplateKey` inside the Zod schema on **both** write doors (`switchTemplate`, `saveBranding`). `variantsForTemplate()` falls back to the all-flagship map for an unrecognised value, so a drifted column degrades rather than crashing a public page |
| V6 Cryptography | no | None introduced |
| V5 (regression risk) | **yes** | `storageKeySchema` and `hexColorSchema` are security controls, not formatting niceties. Neither may be widened to accommodate stock imagery or richer template colours |
| V7 Error handling / logging | yes | `TemplateLockedError` carries the key as a structured field; log lines name the tenant id and nothing else — never document content (Phase 3 T-03-27) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Starter account POSTs `switchTemplate` with a Professional key, never having loaded the picker | **Elevation of Privilege** | `assertTemplateAccess` in the handler, gated before the DB call. `merchantAction` also refuses writes before parsing for an expired trial |
| Forged `templateKey` string lands in `draftTemplateKey`, is read back, and selects a renderer variant map | **Tampering** | `isTemplateKey` refine at the schema door + `variantsForTemplate`'s fallback-to-flagship for an unrecognised stored value |
| Tenant retargeting via a `tenantId` in the new action's payload | **Spoofing / Tampering** | No tenant field in `switchTemplateSchema` (T-04-04); `scopedDb` stamps `ctx.tenantId` last |
| Forged `postMessage` sets a variant map in the preview canvas | **Tampering** | Existing `event.origin` comparison against the server-computed `editorOrigin` (T-04-08) + `sectionVariantsSchema` validation. Worst case is the merchant's own preview pane; nothing is stored |
| Preview route taught to read draft data to resolve the draft template | **Information Disclosure** | Explicitly rejected — the route is deliberately ungated and serves published data only. The draft variant map travels by postMessage instead |
| Widened `storageKeySchema` lets a document point `<Image>` at an arbitrary host | **Tampering / SSRF-adjacent** | Do not widen it. No stock imagery (Finding 3) |
| A copy string longer than its cap makes a default document unparseable, degrading a live storefront | **Denial of Service (self-inflicted)** | The generalized default-document parse test fails the build first |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | 12 variant components (3/2/3/2/2) is the right granularity for D-02's "2-3 per type" | § The 50-Template Plan | Low — D-02 explicitly calls 2-3 a target, not a rule. Adjusting one section's count changes only the combinatorics headroom, which is already generous (72 with all five present) |
| A2 | 25 skeletons × 2 templates is the right split of 50 | § The 50-Template Plan | Medium — if the distinctiveness metric's rule 2 (`≤2 per structure`) proves too tight during authoring, the alternative is 17 skeletons × 3, which weakens the stranger-test margin. The metric is what surfaces this, early |
| A3 | Covering all six segments beats covering three | Finding 5 | Low — TMPL-03 sets a floor of 3, and 6 exceeds it. The argument is product coverage under a filtered picker, and the marginal cost is copy that must be written anyway |
| A4 | The per-segment/per-tier allocation table (2/2/2/1/2/1 Starter) is the right distribution | § The 50-Template Plan | Low — mechanically constrained: 10 Starter slots ÷ 6 segments cannot be ≥2 everywhere. Which two segments get 1 is a product judgement the planner may revise |
| A5 | Brand accents and `logoKey` survive a template switch; `announcementText`/`footerTagline` reset | Pattern 5 | **Medium — flag for user confirmation.** D-09 says "re-seeds the storefront document," which is silent on tokens. The `saveBranding` precedent supports preserving accents, but the announcement/tagline boundary is a judgement call |
| A6 | Template access is not trial-elevated | Finding 6 | **Medium-high — flag for user confirmation.** This is a *new* decision, not one D-06 made. The argument is strong (irreversibility) but it creates a visible asymmetry with D-15 that the merchant experiences |
| A7 | The picker belongs inside the existing branding form rather than a new route | Pattern 7 | Medium — the technical argument (no new nullable state, no new DAL rung) is solid, but it makes an already-long onboarding form longer, which is a UX judgement the UI-SPEC pass should confirm |
| A8 | The contact sheet's pass condition (no group > 2, ≥20 groups) is calibrated correctly | § Distinctiveness Gate Layer 2 | Low — the numbers follow mechanically from 25 skeletons × 2, but they are a first calibration and may want adjusting after the first run |
| A9 | The Neon test branch is currently reachable | § Environment Availability | Low — pre-existing project requirement; not re-verified in this session. All new *unit* coverage is DB-free regardless |

---

## Open Questions

1. **Does a template switch reset the merchant's brand accents?** (A5)
   - What we know: D-09 says the *document* is re-seeded. `saveBranding` already establishes the
     `{ ...templateDefaults, primaryAccent, secondaryAccent }` composition.
   - What's unclear: whether `announcementText` and `footerTagline` count as brand (keep) or
     template copy (reset).
   - Recommendation: preserve the two accents and `logoKey`; reset the two copy tokens. Record it
     as an explicit decision in the plan and state it in the confirmation dialog's copy so the
     merchant is not surprised either way.

2. **Is the trial/template asymmetry acceptable product behaviour?** (A6)
   - What we know: elevating it is unenforceable at expiry without violating the permanent
     no-auto-migration rule.
   - What's unclear: whether the user wants a different resolution (e.g. Starter's 10 include one
     "premium taster" template).
   - Recommendation: ship the non-elevated gate; surface the asymmetry to the user during
     planning as a decision to confirm, not an implementation detail.

3. **Rename `templateKey`, or add `draftTemplateKey` and leave the published one named
   `templateKey`?**
   - What we know: the rename is the cleaner naming; the hand-edited migration is the risk.
   - Recommendation: rename, with the hand-edited SQL and a migration-safety isolation test. The
     descope (add-only) is documented in Pitfall 1 if the planner prefers.

4. **Does Phase 4's still-open Wave 7 stranger test get folded into Phase 5's gate?**
   - What we know: Phase 4's Tasks 2-3 were deliberately deferred by the user and remain open
     `[VERIFIED: .planning/STATE.md:29]`.
   - Recommendation: fold check #1 into Phase 5's Layer 3 (the flagship will naturally appear in
     at least one adversarial pair) and note it in STATE.md, so the human check is performed once
     rather than twice.

5. **How many templates does the onboarding picker show before it needs pagination or a
   "show more"?**
   - What we know: a Professional merchant soft-filtered to their segment sees ~8-9 cards; "show
     all" reveals 50.
   - Recommendation: leave to the UI-SPEC pass. Segment-first with a "show all templates"
     disclosure is the shape; the exact affordance is a design decision.

---

## Sources

### Primary (HIGH confidence) — read directly in this session

- `src/server/theming/registry.ts` — `SECTION_TYPES`, `TEMPLATES`, `INDUSTRY_SEGMENTS`,
  `isTemplateKey`/`isIndustrySegment`, the `server-only` marker, the permanent D-03 header
- `src/server/theming/schema.ts` — the discriminated union, `storageKeySchema`, `hexColorSchema`,
  the character caps, the deliberate absence of a marker
- `src/server/theming/defaults.ts` — the fresh-object rule, the no-stock-photo rationale
- `src/server/theming/actions.ts` — `saveDraft`, `publishStorefront`, `discardDraft`,
  `ensureStorefrontSeeded`, `saveBranding`, and the T-04-27 DAL-loop explanation
- `src/server/theming/queries.ts` — `getPublishedStorefront`, `getEditorStorefront`, the
  strict/lenient parse asymmetry
- `src/app/s/[slug]/sections/section-renderer.tsx` — the exhaustiveness mechanism and the
  no-cast rule; `hero-section.tsx`, `product-grid-section.tsx` for the marker constraint
- `src/app/s/[slug]/preview/page.tsx` — the deliberately-ungated, published-only posture and the
  server-computed `editorOrigin`
- `src/server/entitlements/{plans,resolve,assert}.ts` — `PLANS`, `PlanLimits`,
  `resolveEntitlements`'s `canEditStorefront` composition, the boolean/throw pair,
  `EditorLockedError`
- `src/server/merchant/context.ts` — the redirect ladder and the parameter-less contract
- `src/app/onboarding/branding/page.tsx`, `src/app/(dashboard)/dashboard/storefront-editor/section-list.tsx`
- `prisma/schema.prisma` — `StorefrontTheme` / `StorefrontPage`, including `templateKey`'s own
  comment naming Phase 5 by name
- `tests/unit/theming-registry.test.ts` — the drift-guard idiom and its non-vacuity controls
- `tests/unit/surface-token-isolation.test.ts` — bans 1-6
- `src/lib/strings.ts` — shape, size (1,731 lines), voice contract
- `.planning/phases/04-theme-section-block-system-flagship-template/04-UI-SPEC.md` §
  Design-Distinctiveness Gate, § Decisions Made Under Claude's Discretion, § npm packages
- `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/config.json`, `./CLAUDE.md`
- Toolchain verified by execution: `node --version` → v24.16.0; `vitest --version` → 4.1.10

### Secondary (MEDIUM confidence)

- None required. This phase's questions are all internal to the repository.

### Tertiary (LOW confidence)

- None. No claim below HIGH confidence is load-bearing in this document.

---

## Project Constraints (from CLAUDE.md)

Binding on every task in this phase:

- **Tenant isolation is structural.** Never call raw Prisma from `src/**` outside the sanctioned
  zones; go through `scopedDb(tenantId)` / `platformDb` / `adminDb`. Never trust a `tenantId`,
  price, stock or status from the client. `switchTemplate` and `saveBranding` take **no** tenant
  field.
- **UI copy is centralized** in `src/lib/strings.ts` (→ `src/lib/strings/` after Pitfall 7's
  move). Never inline a user-facing literal. `registry.ts`'s header extends the same rule to
  `.ts` files under `src/server/**` that the `.tsx` prose scan cannot reach — every template
  display name, description and copy string is a member expression into `strings`.
- **No hard deletes for merchant-owned data (D-08).** `switchTemplate` *overwrites* the draft
  columns; it must never `delete` a `StorefrontPage` or `StorefrontTheme` row — the exact
  decision `discardDraft` already documents.
- **Node.js runtime only.** No `export const runtime = "edge"` anywhere.
- **`npm run lint` runs with `--max-warnings=0`.** Warnings fail the build; use `_`-prefixed
  identifiers for intentionally-unused parameters.
- **Currency/number formatting** stays `Intl.NumberFormat("fr-CM", { currency: "XAF" })` — no
  currency library. (Relevant if any template thumbnail renders a mock price.)
- **`$queryRaw` / `$executeRaw` are banned repository-wide** by `no-restricted-syntax`. The
  template-column migration's raw SQL lives in `prisma/migrations/**/migration.sql`, which is
  outside `src/` and outside the rule.
- **Never read `process.env` outside `src/env.ts`** (documented exception: `next.config.ts`).
- **Substantial "why" header comments citing decision/requirement IDs** on every non-trivial new
  module — this is the dominant codebase style and the reviewer will expect it on all six new
  files.
- **GSD workflow enforcement:** file changes go through a GSD command, not direct edits.

---

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — zero new packages; every tool and primitive verified present by
  direct inspection
- Architecture / variant mechanism: **HIGH** — the design is forced by three invariants read
  verbatim from the source (`server-only` markers, the `: ReactElement` exhaustiveness
  mechanism, the drift test's descriptor/schema symmetry)
- Image sourcing decision: **HIGH** — settled by the `storageKeySchema` regex, which is a
  verifiable technical constraint rather than a preference
- Draft/published template column split: **HIGH** on the necessity (D-08 + the existing paired
  model), **MEDIUM** on the exact naming (rename vs. add-only is a risk trade-off for the planner)
- Tier gate mechanism: **HIGH** on shape (`minTier` + `PLAN_TIER_RANK` follows four existing
  precedents), **MEDIUM** on the no-trial-elevation decision (sound reasoning, but a new product
  decision that should be user-confirmed)
- Onboarding slot: **HIGH** on where industry is captured today, **MEDIUM** on the
  in-form-vs-new-route recommendation (technically strong, UX judgement pending the UI-SPEC pass)
- 50-template combinatorics: **MEDIUM-HIGH** — the arithmetic is exact and the metric makes it
  testable, but the specific 25×2 allocation is a first calibration
- Distinctiveness gate at N=50: **HIGH** on the need to abandon all-pairs (1,225 comparisons),
  **MEDIUM** on the specific pass thresholds
- Pitfalls: **HIGH** — each is derived from a named invariant or an existing test in this
  repository, not from general experience

**Research date:** 2026-09-03
**Valid until:** stable — this research is grounded almost entirely in this repository's own
source, so it stays valid until the code changes. Re-verify if Phase 4's deferred Wave 7 work
alters `defaults.ts`, `registry.ts` or the flagship's default document.
