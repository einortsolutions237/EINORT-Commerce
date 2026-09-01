# Phase 4: Theme/Section/Block System & Flagship Template - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Onboarding (business name, industry/segment, logo, brand colors) produces a live, published, portfolio-quality storefront within minutes, built from the fashion/apparel flagship template rendered through a code-defined Theme→Page→Section→Block registry with per-tenant instance data. The merchant can then customize that storefront — reorder its sections, edit each block's content/images/colors — through an instant, live-preview editor with an explicit draft/publish step, gated by subscription tier and enforced server-side.

Only **one** flagship template (fashion/apparel, anchored on the zinc-monochrome DTC reference) is built this phase. The other five merchant segments named in PROJECT.md (electronics, beauty/cosmetics, grocery/food, furniture/home, general retail) get their own real templates in Phase 5 — this phase captures the industry field and ships every merchant on the flagship regardless of their answer.

Covers: ONB-02, ONB-03, ONB-04, TMPL-01, TMPL-02, EDIT-01, EDIT-02, EDIT-03.

</domain>

<decisions>
## Implementation Decisions

### Onboarding: Industry & the One Built Template

- **D-01:** Every merchant's storefront uses the fashion/apparel flagship's layout/components this phase, regardless of the industry they select during onboarding — their own products/branding populate it, but the template itself doesn't vary by industry yet. Industry is captured now purely so Phase 5's real segment templates have data to key off later, with no re-onboarding needed.
- **D-02:** The full 6-segment industry list from PROJECT.md is captured at onboarding now — fashion/apparel, electronics, beauty/cosmetics, grocery/food, furniture/home, general retail — not a placeholder "Fashion / Other" pair. Avoids a Phase 5 backfill migration to re-ask or infer the real segment.
- **D-03:** When Phase 5 later ships a real template for a merchant's actual segment, their storefront does **not** auto-migrate to it — it stays on the flagship until the merchant manually switches. Auto-swapping risks silently discarding EDIT-02 customization work the merchant has already done. **Data-model implication:** the schema needs an explicit "which template/theme this tenant is instantiated from" field, separate from and independent of the `industry`/segment field — industry alone must not determine which template renders.
- **D-04:** The flagship's default block content (hero tagline, section headings, etc.) uses generic, industry-neutral copy (e.g. "New Arrivals," not "The Autumn Collection") rather than fashion-flavored copy. Every merchant edits this via the block editor before publishing for real (EDIT-02), so the default only needs to not look obviously wrong for a non-fashion merchant previewing their new store.

### Editor Scope

- **D-05:** The merchant can reorder and edit the flagship's existing sections (content, settings, images, colors per block) but **cannot add or remove whole sections** this phase. The section list itself is fixed by the template. Keeps every storefront within the "looks professionally designed" guardrail — an empty or duplicated section is a common way a DIY builder starts looking amateurish, and this is a much smaller editor + registry surface for the timeline.
- **D-06:** Block editing is **content-only** — text, images, colors, links/button labels via a form-like panel per block type — with no layout-variant switching (e.g. no choosing image-left vs. image-right vs. full-bleed for a Hero). Matches the code-registry pattern already researched in `.planning/research/ARCHITECTURE.md` (Pattern 3): each block type is one component + one settings schema. A layout variant would need to be its own registered block type, which is out of scope this phase.
- **D-07:** The live-preview editor updates **instantly, as the merchant types or picks a color** — not a save-then-refresh model. This is the actual "looks like it cost them money" product differentiator EDIT-02 is describing, not a settings form with a preview button.
- **D-08:** Edits save as a **draft**; the live storefront customers see is untouched until the merchant clicks **Publish**. Standard site-builder pattern (Shopify, Squarespace) and consistent with "live-preview" implying preview and live are different states. **Data-model implication:** the Theme/Page/Section/Block instance data needs a draft/published split (e.g. a published snapshot plus an editable draft, or a `status` per revision) — the planner should confirm the exact shape.

### Brand Color vs. the Zinc-Monochrome Look

- **D-09:** Merchant brand colors apply **accent-only** — they drive CTA buttons, links, and active states, while backgrounds, text, and layout stay zinc-monochrome. Protects the portfolio-quality guardrail: a merchant picking a clashing color combo can only tint the storefront, never break its professional structure. This mirrors how the DTC reference itself uses zinc-950/zinc-50 as the base with sparse accent use (see project memory `project_einort_flagship_visual_reference`).
- **D-10:** Onboarding captures **two** brand colors — primary and secondary accent — not just one.
- **D-11:** The color picker runs a contrast check (e.g. a WCAG-style ratio against the zinc surface the accent color will sit on) and shows an inline warning for low contrast, but does **not** block the merchant from proceeding with their choice anyway. Matches this codebase's existing manual-trust pattern for merchant-entered data (Phase 3 D-17: payment numbers accepted as-entered, no verification gate).
- **D-12:** Brand accent colors are **storefront-only** (`src/app/s/[slug]/**`) and must never appear in the merchant dashboard, including the editor's own dashboard-side chrome. The dashboard keeps its fixed blue/gold/slate palette regardless of what any merchant picks. This preserves the existing, deliberate two-design-system separation already enforced by `tests/unit/surface-token-isolation.test.ts` — do not weaken or add an exception to that test for the editor UI.

### Editor Tier Gating (EDIT-03)

- **D-13:** The editor is **view-only on Starter** (can preview the live-editing experience, cannot publish changes) and **full edit on Business/Professional**. Matches how the plan-tier system already gates elsewhere in this project (limits, not full feature removal) and gives Starter merchants a concrete, visible reason to upgrade rather than a locked/hidden feature they can't evaluate.
- **D-14:** Business and Professional are **identical** for editor purposes — this is a single boolean gate (paid tier vs. Starter), not a 3-way branch. Professional's actual differentiation comes from other limits (product cap, member seats per `pricing-reference.md`), not editor capability.
- **D-15:** During the 10-day full-feature trial, **every** merchant gets full editor access regardless of which tier they'll eventually land on — the view-only Starter restriction only takes effect once the trial ends and Starter is the merchant's actual (non-trial) tier. Reuses Phase 2's existing entitlements pattern where trial state overrides tier limits (`.planning/phases/02-merchant-auth-entitlements-trial/02-CONTEXT.md` D-08: trial merchants get full functionality; only an *expired* trial goes read-only).

### Claude's Discretion

- Exact list and count of block types within each section (e.g. how many distinct block types a "Hero" or "Product Grid" section is built from) — follow whatever the planner/research determines is cleanest given D-06's content-only, code-registry pattern.
- The specific WCAG contrast-ratio threshold and calculation used for D-11's warning.
- Exact draft/publish UI mechanics (e.g. whether there's a "discard draft" / "revert to published" control) beyond the core draft-then-publish requirement in D-08.
- Exact onboarding step ordering/UI for capturing industry, logo, and the two brand colors relative to the existing `create-store` and `plan` onboarding steps already built in Phases 1–2.
- Specific segment labels/icons shown in the industry picker for the 6 segments in D-02.
- Exact Zod settings-schema shape per block type — follow the code-registry pattern from `.planning/research/ARCHITECTURE.md` Pattern 3.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/PROJECT.md` — core value, the 6 merchant segments, brand-color/theming requirements
- `.planning/REQUIREMENTS.md` — full requirement text for ONB-02, ONB-03, ONB-04, TMPL-01, TMPL-02, EDIT-01, EDIT-02, EDIT-03
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria, dependency on Phases 2 and 3

### Architecture — the Theme/Section/Block model (MUST read before designing the schema)
- `.planning/research/ARCHITECTURE.md` — Pattern 3 ("Theme → Page → Section → Block as relational structure + JSONB settings, with types defined in code") is the already-researched architectural direction: section/block *types* as a code-level registry (component + Zod settings schema), section/block *instances* (order, tenant scoping, settings values) as relational rows. D-06 and D-08 above build directly on this pattern — the draft/publish split (D-08) needs to be designed within it.

### Prior-phase patterns this phase extends
- `.planning/phases/03-product-catalog-order-payment-claim-state-machine/03-CONTEXT.md` D-07 — the R2 + Sharp image-enhancement/crop pipeline built in Phase 3; ONB-03's logo upload reuses this same pipeline, does not rebuild it
- `.planning/phases/03-product-catalog-order-payment-claim-state-machine/03-CONTEXT.md` D-14 — the minimal payment-settings surface built in Phase 3; this phase's fuller onboarding surfaces/edits the same underlying fields, no rework
- `.planning/phases/02-merchant-auth-entitlements-trial/02-CONTEXT.md` D-08, D-11, D-12 — the trial countdown/read-only-on-expiry mechanism D-15 above reuses
- `.planning/phases/02-merchant-auth-entitlements-trial/pricing-reference.md` — the actual per-tier structure (Starter/Business/Professional limits) D-13/D-14's editor gate sits alongside
- `src/server/entitlements/{plans,resolve,assert}.ts` — the existing entitlements registry; the editor's Starter-vs-paid gate (D-13) should be added here, following the same pattern as the existing product-count/member-count checks
- `src/server/merchant/action.ts` (`merchantAction`) — the write-gate wrapper; the editor's publish action should be built through this, consulting entitlements before allowing a write
- `src/app/onboarding/{create-store,plan}/` — existing onboarding steps from Phases 1–2 that this phase's new industry/logo/brand-color step slots alongside

### Design references — TWO distinct systems for TWO distinct surfaces (do not conflate)
- `.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md` — blue/gold/slate + Outfit. Governs the editor's own dashboard-side chrome (the panel/controls the merchant uses to edit) — but per D-12, brand accent colors must NEVER appear here.
- `.planning/phases/01-multi-tenant-foundations-domain-resolution/01-UI-SPEC.md` (§ Color / zinc-monochrome direction) — governs the flagship template itself and the live-preview pane, under `src/app/s/[slug]/**`.
- `tests/unit/surface-token-isolation.test.ts` — the existing automated guard enforcing the above separation; D-12 depends on this test continuing to pass unmodified.

### The flagship's aesthetic reference (visual direction only — not code to port)
- Project memory `project-einort-flagship-visual-reference` — full details on the zinc-monochrome DTC prototype supplied as aesthetic reference (`C:\Users\LFD Service\Downloads\einort-commerce.zip`), including its known gaps: hardcoded colors instead of theme tokens (the real build must be theme-token-driven per D-09), a simulated fake checkout (irrelevant — Phase 3 already built the real checkout), and non-Cameroon locale defaults (irrelevant to the visual direction itself).

### Stack guidance already on file
- `CLAUDE.md` — "Image Upload/Processing Pipeline" section (R2 + Sharp + presigned uploads, reused per D-07 above's citation)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/server/images/pipeline.ts` (`IMAGE_PRESETS`, `processImage`) — Phase 3's Sharp-based derive pipeline; add a `logo` preset if one doesn't already exist, reuse the presigned-upload flow from `src/server/images/r2.ts` for ONB-03
- `src/server/merchant/action.ts`, `src/server/merchant/context.ts` — the established write-gate + tenant-identity pattern every new onboarding step and editor action should be built through
- `src/server/entitlements/{plans,resolve,assert}.ts` — extend with an editor-write-permission check (D-13/D-14/D-15) alongside the existing product-count/member-count checks
- `src/lib/strings.ts` — centralized copy; all new onboarding and editor copy belongs here, not inline JSX literals
- `src/server/db/tenant-scoped.ts` (`scopedDb`, `TENANT_SCOPED_MODELS`) — new tenant-scoped models (Theme/Page/Section/Block instances, whatever the planner names them) route through here like every other tenant-owned table

### Established Patterns
- `import "server-only"` / `"use server"` module-boundary convention (every domain module in `src/server/**`)
- Prisma Client Extension tenant-scoping (`scopedDb`) — the block-instance tables must register here
- Wave-based parallel execution via git worktrees for independent plans within a phase
- Centralized `strings.ts` for all user-facing copy, enforced by a source-scanning contract test (`tests/unit/dashboard-nav.test.ts` and similar) — any new onboarding/editor copy must follow this or a similar guard will need extending

### Integration Points
- `Organization` model (`prisma/schema.prisma`) currently has `logo String?` but **no industry/segment field and no brand-color fields** — these are new columns this phase must add (`industry`, `primaryAccentColor`, `secondaryAccentColor`, likely a `themeId`/template-instance reference per D-03)
- `src/app/onboarding/create-store/` (Phase 1) and `src/app/onboarding/plan/` (Phase 2) — existing onboarding steps; this phase's new business-info/branding step needs to slot into this flow, exact ordering left to Claude's discretion
- Phase 3 left the storefront pages under `src/app/s/[slug]/**` (product grid, PDP, cart, checkout, tracking) as "a plain, on-brand placeholder consistent with the zinc direction, not yet built out as reusable [Theme/Section/Block] components" (per `03-CONTEXT.md`) — this phase is what replaces/wraps them with the real Section/Block-rendered flagship template; the planner should confirm whether Phase 3's pages become sections within this system or stay as-is alongside it
- New dashboard route for the editor itself, likely `src/app/(dashboard)/dashboard/storefront-editor/` or similar (per `.planning/research/ARCHITECTURE.md`'s suggested structure), subscription-tier-gated per D-13

</code_context>

<specifics>
## Specific Ideas

- The zinc-monochrome DTC reference's own use of accent color (sparse, CTA/link-only against a zinc-950/zinc-50 base) is the direct model for D-09's accent-only brand-color application — not a new invention.
- The editor experience should feel instant and WYSIWYG (D-07) — the bar is "looks like it cost them money," and a laggy or save-then-refresh editor undercuts that on the one screen where the merchant is most actively judging the product's quality.

</specifics>

<deferred>
## Deferred Ideas

- Segment-specific templates for the other 5 industries (electronics, beauty/cosmetics, grocery/food, furniture/home, general retail) — explicitly Phase 5 scope, not this phase (TMPL-03/04-territory).
- Add/remove sections in the editor, and per-block layout-variant switching — considered and rejected for this phase (D-05, D-06); would meaningfully expand the editor + registry surface within the 30-day timeline. Revisit if merchant feedback post-pilot shows the fixed section list is too restrictive.
- A curated/restricted accent-color swatch picker instead of a free color picker — considered and rejected in favor of a contrast warning (D-11); revisit only if unreadable-accent-color complaints become a real observed problem.
- Auto-migrating a merchant to their real segment template once Phase 5 ships it — considered and rejected (D-03) in favor of a manual opt-in, to protect existing EDIT-02 customization work.

None beyond the above — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-theme-section-block-system-flagship-template*
*Context gathered: 2026-09-01*
