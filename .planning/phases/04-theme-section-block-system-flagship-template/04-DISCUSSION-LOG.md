# Phase 4: Theme/Section/Block System & Flagship Template - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-01
**Phase:** 4-theme-section-block-system-flagship-template
**Areas discussed:** Onboarding industry picker vs. one built template, Editor scope, Brand color vs. the zinc-monochrome look, Editor tier gating

---

## Onboarding industry picker vs. one built template

### What happens for a non-fashion merchant when only the flagship exists?

| Option | Description | Selected |
|--------|-------------|----------|
| Everyone gets the flagship regardless of industry | Industry captured now for Phase 5; every merchant uses the fashion flagship's layout/components this phase | ✓ |
| Only offer "Fashion/Apparel" for now | Hide the other 5 segments until Phase 5 builds their templates | |
| Full picker, non-fashion shows "coming soon" | Merchant picks real industry, sees an honest in-dashboard note | |

**User's choice:** Everyone gets the flagship template regardless of industry.

### Should onboarding capture the full 6-segment list now?

| Option | Description | Selected |
|--------|-------------|----------|
| Capture all 6 segments now | Matches PROJECT.md, avoids a Phase 5 backfill migration | ✓ |
| Just "Fashion/Apparel" and "Other" | Simpler form, requires a follow-up migration later | |

**User's choice:** Capture all 6 segments now.

### Auto-migrate to a real segment template when Phase 5 ships it, or manual opt-in?

| Option | Description | Selected |
|--------|-------------|----------|
| Stay on flagship until manual switch | Protects existing EDIT-02 customization work from being silently discarded | ✓ |
| Auto-migrate when the new template ships | Keeps every merchant on their "correct" template automatically, but risks destroying customization | |

**User's choice:** Stay on the flagship until the merchant manually switches.
**Notes:** Implies the data model needs an explicit template/theme-instance field, separate from the industry field.

### Fashion-flavored or generic default copy?

| Option | Description | Selected |
|--------|-------------|----------|
| Generic, industry-neutral default copy | e.g. "New Arrivals" — reads fine regardless of what the merchant sells | ✓ |
| Fashion-flavored copy for everyone | Matches the reference's editorial voice most closely, but reads wrong for other segments | |

**User's choice:** Generic, industry-neutral default copy.

---

## Editor scope

### Can merchants add/remove whole sections?

| Option | Description | Selected |
|--------|-------------|----------|
| Reorder + edit existing sections only, no add/remove | Fixed section list; keeps every storefront within the "professionally designed" guardrail | ✓ |
| Add/remove sections from a library | More flexible, much bigger editor + registry surface for this phase | |

**User's choice:** Reorder + edit existing sections only, no add/remove.

### How deep does block editing go?

| Option | Description | Selected |
|--------|-------------|----------|
| Content only — text, images, colors, links | Matches the code-registry pattern (component + Zod settings schema per block type) | ✓ |
| Content plus a small set of layout variants per block | More visual flexibility, but each variant is effectively a second component to build | |

**User's choice:** Content only.

### How live is "live-preview"?

| Option | Description | Selected |
|--------|-------------|----------|
| Instant, as-you-type preview | The expected "looks like it cost them money" experience | ✓ |
| Save-then-refresh preview | Simpler to build, feels more like a settings form | |

**User's choice:** Instant, as-you-type preview.

### Does an edit go live immediately, or stay a draft?

| Option | Description | Selected |
|--------|-------------|----------|
| Draft + explicit Publish step | Standard site-builder pattern (Shopify, Squarespace); merchant can experiment safely | ✓ |
| Every save goes live immediately | Simpler data model, but exposes half-finished edits to real customers | |

**User's choice:** Draft + explicit Publish step.
**Notes:** Implies the Theme/Page/Section/Block instance data needs a draft/published split.

---

## Brand color vs. the zinc-monochrome look

### How should brand colors apply to the zinc aesthetic?

| Option | Description | Selected |
|--------|-------------|----------|
| Accent-only — brand color drives CTAs/links, structure stays zinc | Protects the portfolio-quality guardrail; matches the reference's own sparse accent use | ✓ |
| Full palette override | More "their brand," but risks a poorly-chosen color pair making the storefront look amateurish | |

**User's choice:** Accent-only.

### How many brand colors are captured?

| Option | Description | Selected |
|--------|-------------|----------|
| One accent color | Simplest, matches accent-only application (single role) | |
| Primary + secondary accent colors | More flexibility (e.g. primary CTA vs. secondary link states) | ✓ |

**User's choice:** Primary + secondary accent colors.
**Notes:** User chose the non-default option here — two colors, not one.

### Should the picker guard against low-contrast colors?

| Option | Description | Selected |
|--------|-------------|----------|
| Warn on low contrast, allow proceeding | Matches the existing manual-trust pattern (Phase 3 D-17) | ✓ |
| Accept any color as-entered, no check | Simplest, but risks an unreadable CTA | |
| Restrict to a curated palette | Guarantees good results but removes "my actual brand color" flexibility | |

**User's choice:** Warn on low contrast, but let the merchant proceed anyway.

### Should brand colors ever appear in the dashboard?

| Option | Description | Selected |
|--------|-------------|----------|
| Storefront-only | Matches the existing two-design-system separation (surface-token-isolation.test.ts) | ✓ |
| Also tint a small dashboard accent | Some personalization, but risks cross-surface bleed | |

**User's choice:** Storefront-only.

---

## Editor tier gating

### What differs between Starter/Business/Professional in the editor?

| Option | Description | Selected |
|--------|-------------|----------|
| View-only on Starter, full edit on Business/Professional | Gives Starter merchants a concrete, visible upgrade reason | ✓ |
| Fully unavailable on Starter | Simpler gate, but Starter merchants can't see what they'd upgrade for | |
| All tiers full editor, gate something else | — | |

**User's choice:** Editor is view-only on Starter; full edit on Business/Professional.

### Does Professional get anything more than Business?

| Option | Description | Selected |
|--------|-------------|----------|
| Business and Professional identical for the editor | Single boolean gate; Professional's differentiation is elsewhere (product cap, seats) | ✓ |
| Professional gets something extra | — | |

**User's choice:** Business and Professional are identical for the editor.

### Full editor access during the 10-day trial?

| Option | Description | Selected |
|--------|-------------|----------|
| Full editor access during the entire trial | Matches "full-feature trial" from Phase 2; reuses the trial-overrides-tier-limits pattern | ✓ |
| View-only from day one if on the Starter track | Contradicts the Phase 2 full-feature-trial decision | |

**User's choice:** Full editor access during the entire trial.

---

## Claude's Discretion

- Exact list/count of block types within each section
- The specific WCAG contrast-ratio threshold/algorithm for the low-contrast warning
- Exact draft/publish UI mechanics beyond the core draft-then-publish requirement (e.g. a "discard draft" control)
- Exact onboarding step ordering for the new industry/logo/brand-color step relative to `create-store` and `plan`
- Specific segment labels/icons in the industry picker
- Exact Zod settings-schema shape per block type

## Deferred Ideas

- Segment-specific templates for the other 5 industries — explicitly Phase 5 scope.
- Add/remove sections in the editor, and per-block layout-variant switching — rejected for this phase's timeline; revisit post-pilot if merchant feedback shows the fixed section list is too restrictive.
- A curated/restricted accent-color swatch picker — rejected in favor of a contrast warning; revisit only if unreadable-accent-color complaints become a real observed problem.
- Auto-migrating a merchant to their real segment template once Phase 5 ships it — rejected in favor of manual opt-in, to protect existing customization work.
