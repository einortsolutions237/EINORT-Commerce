# Phase 5: Template Segment Expansion - Context

**Gathered:** 2026-09-03
**Status:** Ready for planning

<domain>
## Phase Boundary

At least 3 additional merchant segments (from electronics, beauty/cosmetics, grocery/food,
furniture/home, general retail) get their own structurally distinct storefront layout skeleton —
built by recombining the same 5 section types Phase 4 shipped, given new per-type rendering
variants so recombination alone can't fail the distinctiveness bar. The full template library
grows from Phase 4's single `flagship-fashion` row to 50 real, individually pickable
`TEMPLATES` entries this phase, split 10 Starter / 15 Business / 25 Professional as a real,
enforced entitlement gate (not just a catalog-size description). A new onboarding step lets a
merchant pick their template (from their tier's accessible subset) right after choosing their
industry segment, and a new "Change template" action inside the existing storefront editor lets
them switch later — constrained to their current plan's accessible set, re-seeding the storefront
document from the new template's defaults after an explicit warning.

Covers: TMPL-03, TMPL-04, TMPL-05.

</domain>

<decisions>
## Implementation Decisions

### Section Reuse and Structural Distinctiveness

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

### The 50-Template Library, as Data

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

### The Tier Gate (10/15/25)

- **D-06:** The 10/15/25 split is a REAL entitlement gate, not just a catalog-size description.
  Starter merchants can pick only from a specific 10-template subset; Business unlocks 15 more
  (25 reachable total); Professional unlocks the remaining 25 (all 50 reachable). Nested/additive
  — a higher tier always sees everything a lower tier sees, plus more. Matches the existing
  onboarding/plan copy ("3-5 templates..." for Starter, already live on `/onboarding/plan` and
  `/dashboard/plan`) and this codebase's established tier-gating pattern
  (`src/server/entitlements/plans.ts`, already gating the storefront editor itself per Phase 4's
  D-13).

### Where Merchants Pick and Switch Templates

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/PROJECT.md` — core value, the 6 merchant segments, the 50-template (10/15/25) split
- `.planning/REQUIREMENTS.md` — TMPL-03, TMPL-04, TMPL-05 full requirement text
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, dependency on Phase 4

### The Theme/Section/Block system this phase extends (MUST read before designing anything)
- `src/server/theming/registry.ts` — `SECTION_TYPES`, `TEMPLATES`, `INDUSTRY_SEGMENTS`, the
  `Readonly<Record<...>>` drift-guard pattern D-03/D-06 above extend directly. Its own header
  comments document D-01/D-02/D-03 from Phase 4 (industry-vs-template independence, no
  auto-migration) as still-binding constraints on this phase.
- `src/server/theming/defaults.ts` — `flagshipDefaultDocument()`/`flagshipDefaultTokens()`, the
  pattern every new template's own default document/tokens function follows; its header explains
  why both are functions (never shared mutable literals) and why the flagship's default hero has
  no stock image (informs D-04's open image-sourcing question).
- `src/app/s/[slug]/sections/section-renderer.tsx` — the one exhaustive switch mapping section
  type to component; adding variants (D-02) must go through this file's established
  narrowing/exhaustiveness discipline.
- `src/server/theming/schema.ts` — `pageDocumentSchema`/`sectionInstanceSchema`, the Zod shapes
  D-02's variant field (if schema-level) would extend.
- `.planning/phases/04-theme-section-block-system-flagship-template/04-CONTEXT.md` — D-01
  through D-15, especially D-01/D-02/D-03 (industry capture, template independence, no
  auto-migration — all still binding) and D-05/D-06 (fixed section list, content-only editing —
  extended by this phase's D-02 variant concept, not violated by it).
- `.planning/phases/04-theme-section-block-system-flagship-template/04-PATTERNS.md` — the
  code-registry pattern precedent this phase's new templates/variants must follow.

### Entitlements — the tier-gate pattern D-06/D-08 extend
- `src/server/entitlements/plans.ts` — `PLANS` registry; the template-count gate (D-06) is a new
  field/check here, following the same pattern as existing product-count/member-count/editor
  checks.
- `src/server/entitlements/resolve.ts`, `src/server/entitlements/assert.ts` — the
  resolve/assert-pair pattern D-06's new gate should follow.
- `.planning/phases/02-merchant-auth-entitlements-trial/pricing-reference.md` — the canonical
  per-tier feature table; note it already shows "3-5 templates..." copy for Starter that D-06
  reconciles against a real number (10).

### Onboarding — where D-07's new picker step slots in
- `src/app/onboarding/{create-store,plan,branding}/` — existing onboarding steps; D-07's new
  template-picker step slots in relative to the existing industry-selection step inside
  `branding` (or wherever industry is currently captured — confirm exact location).
- `src/server/theming/registry.ts` `INDUSTRY_SEGMENTS`/`isIndustrySegment` — the 6-segment list
  D-07's picker filters/informs against.

### The storefront editor — where D-08/D-09's switch action lives
- `src/app/(dashboard)/dashboard/storefront-editor/` (page.tsx, editor-shell.tsx, and the
  section-list/settings-panel/publish-bar components) — Phase 4's editor surface; D-08's "Change
  template" action is a new capability inside this existing shell.
- `src/server/theming/{queries,actions}.ts` — `getEditorStorefront`, `saveDraft`,
  `publishStorefront`, `ensureStorefrontSeeded` — D-09's re-seed-on-switch behavior is a new
  action following this file's existing patterns (likely sibling to `ensureStorefrontSeeded`,
  not a variant of it, since re-seeding an EXISTING tenant's document on demand is a different
  operation from seeding a brand-new one).

### Design references
- `.planning/phases/01-multi-tenant-foundations-domain-resolution/01-UI-SPEC.md` (§ Color /
  zinc-monochrome direction) — the storefront's design system every new template/variant must
  stay within; D-02's variants are layout/structure changes, not palette changes.
- `.planning/phases/04-theme-section-block-system-flagship-template/04-UI-SPEC.md` — the
  flagship's specific spacing/typography/motion contract, the baseline every new template
  extends rather than replaces.
- `.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md` — governs D-07's
  onboarding picker UI and D-08's editor action UI (both dashboard-side, blue/gold/slate, never
  the merchant's own accent colors per Phase 4's D-12, still binding).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/server/theming/registry.ts` (`TEMPLATES`, `SECTION_TYPES`, `INDUSTRY_SEGMENTS`) — the
  exact registry this phase adds ~49 new `TEMPLATES` rows to, and where D-02's variant concept
  needs a home (likely a new field on `SectionTypeDefinition` or `TemplateDefinition`).
- `src/server/theming/defaults.ts` pattern (`flagshipDefaultDocument`/`flagshipDefaultTokens`,
  fresh-object-per-call discipline) — every new template needs its own default-document/tokens
  function following this exact shape.
- `src/app/s/[slug]/sections/*.tsx` (hero-section, trust-bar-section, product-grid-section,
  editorial-split-section, contact-section) — the 5 existing components D-02's variants extend,
  not replace.
- `src/server/entitlements/plans.ts` pattern (`PLANS`, boolean/limit checks per tier) — D-06's
  template-count gate follows this exact established shape.

### Established Patterns
- `Readonly<Record<K, V>>` code-registry pattern (now four confirmed instances: `PLANS`,
  `IMAGE_PRESETS`, `ORDER_TRANSITIONS`, `SECTION_TYPES`/`TEMPLATES`/`INDUSTRY_SEGMENTS`) — the
  house style this phase's 50 new rows and any new variant/gate registries must follow.
- Section/block TYPES are build-time code; instances are tenant rows (`registry.ts`'s own
  Anti-Pattern-3 warning) — still binding; D-02's variants are a build-time registry concept, not
  a merchant-authorable one.
- Document-per-page JSONB data model (draft/published split) — unaffected by this phase; D-09's
  re-seed-on-switch writes into the same existing draft/published columns.

### Integration Points
- `Organization.industry` (nullable, captured at branding per Phase 4) — D-07's picker reads this
  to inform/filter, per D-05.
- The storefront editor's existing `PublishBar`/`saveDraft`/`publishStorefront` flow — D-09's
  switch-and-reseed action needs to interact correctly with an in-progress unpublished draft
  (does switching require publishing first, or does it overwrite the draft directly? — left to
  planner, but must be resolved explicitly, not left ambiguous).
- `tests/setup/seed-two-tenants.ts` and `tests/unit/theming-registry.test.ts` — the existing
  fixture/drift-guard tests that assert `TEMPLATES["flagship-fashion"].sections` agrees with
  `flagshipDefaultDocument()`; the same assertion needs to hold for every one of the 49 new rows.

</code_context>

<specifics>
## Specific Ideas

- The image-sourcing question for D-04 was explicitly left open rather than decided in this
  discussion — flagged strongly for research, with Phase 4's own "no stock photo, ever" hero
  precedent as the leading candidate answer rather than sourcing external photography.
- D-02's variant framing used concrete examples during discussion (hero: full-bleed photo vs.
  split image+text; product-grid: dense 2-col vs. the flagship's grid) — these are illustrative,
  not a locked spec; the planner/UI-phase should determine the actual variant set per section
  type.

</specifics>

<deferred>
## Deferred Ideas

None beyond the above — discussion stayed within phase scope. (The broader dashboard-shell
Shopify-layout redesign, discussed and shipped earlier this session as quick task `260903-ugl`,
is unrelated to this phase and already closed out separately.)

</deferred>

---

*Phase: 05-template-segment-expansion*
*Context gathered: 2026-09-03*
