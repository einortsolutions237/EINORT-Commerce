# Quick Task 260908-bv1: Restructure the storefront editor's "Change template" panel layout

**Gathered:** 2026-09-08
**Status:** Ready for research/planning

<domain>
## Task Boundary

Restructure the dashboard's storefront editor "Change template" panel to match the pattern the user showed via three screenshots of Shopify's own "Online Store" admin page: the merchant's currently-published template spotlighted in its own card at the top of the panel, with the full switchable template grid (unchanged content, unchanged tiles) displayed below it — rather than the current template rendering inert-in-place inside the same flat/segmented grid as every other tile, which is how it renders today after Phase 05.1's Wave 3 (plan 05.1-06) redesign.

Explicitly NOT in scope: onboarding's initial template picker (`src/app/onboarding/branding/page.tsx`, `branding-form.tsx`). Onboarding has no "current theme" concept — the merchant is choosing their first template — so its existing segment-grouped grid (shipped in 05.1-06) is untouched.
</domain>

<decisions>
## Implementation Decisions

### Tier-locked templates in the switcher
- **D-A:** Templates outside the merchant's current plan tier stay visible-but-dimmed with their "Requires {tier}" lock chip, exactly as they render today. This is a pure LAYOUT restructuring, not a filtering change. It must not conflict with or weaken Phase 5's locked D-05 "SORT NEVER FILTER" decision, nor the contract tests that assert `tiles.length`/partition invariants (`tests/unit/template-picker-contract.test.ts` and the picker's own header invariants). The currently-selected template remains part of the same underlying `tiles` data passed to the picker; it is now visually spotlighted at the top of the panel instead of rendered inert-in-place within the grid below.

### Scope
- **D-B:** This restructuring applies ONLY to the dashboard's storefront editor "Change template" panel (`src/app/(dashboard)/dashboard/storefront-editor/page.tsx`, `change-template-panel.tsx`, and whatever picker-adjacent component is needed for the new spotlight card). Onboarding's picker is explicitly out of scope and must render byte-identical to its current (05.1-06) state.

### Claude's Discretion
- Exact visual treatment of the spotlight card (what actions it shows — e.g. a "current" badge, a link to the live storefront, an "Edit" affordance if one already exists elsewhere in the editor) — grounded in the existing merchant-platform design system, not a literal copy of Shopify's "Launch store"/"Edit theme" button pair, since EINORT's editor already has its own established actions elsewhere on the page that must not be duplicated.
- How much of the current-template's card markup is extracted/reused from `TemplatePicker`'s existing card rendering vs. built as a new small component — implementer's call, guided by this project's component-reuse convention, but duplication should be avoided where a shared card-body renderer can be pulled out cleanly.
- Exact section heading/copy for the "available templates" grid below the spotlight (e.g. "Available templates", "Switch template") — must go through `src/lib/strings/index.ts`, never inline.
- Whether the current template is excluded from the grid below (shown only in the spotlight) or still appears in the grid too but inert — this affects whether the existing `disableHoverLift`/`isInert` current-card guard logic (T-05-32/T-05-35 threat mitigations, Phase 5) needs to be removed, repurposed, or left as a defense-in-depth belt-and-suspenders. Research/UI-SPEC should resolve this with a stated reason, not silently pick one.
</decisions>

<specifics>
## Specific Ideas

The user's own words: "For the Einort-Commerce Platform i will like the chosen Theme to be at the top like that displayed for Shopify and the Available switchable themes should appear on the bottom just as displayed by shopify i think that is more professional and user friendly for the Users."

Reference screenshots (Shopify admin, Online Store section): the active theme's own card at the top with "Launch store" and "Edit theme" primary actions, and a "Discover themes" grid of switchable themes below it in rows, each themed card showing name + publisher + an "Add" action.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md` — the locked blue/slate design system this new spotlight card must extend (no gold — this is a dashboard surface).
- `src/components/theming/template-picker.tsx` — just redesigned in Phase 05.1 plan 05.1-06 (container-query grid, segment grouping, D-05 fallback branch, the `disableHoverLift`/`isInert` current-card guard). Read its full header invariants before touching anything nearby.
- `tests/unit/template-picker-contract.test.ts` — the 13-assertion contract this restructuring must not break, plus `tests/unit/surface-token-isolation.test.ts`, `tests/unit/theming-marker-boundary.test.ts`, `tests/unit/dashboard-nav.test.ts`.
- `.planning/phases/05.1-template-preview-rendering-picker-redesign/05.1-06-PLAN.md` and its UI-SPEC section — the current card's existing inert treatment and the threat mitigations (T-05-32, T-05-35) it satisfies, which must survive this restructuring in some form.
- `src/app/(dashboard)/dashboard/storefront-editor/page.tsx`, `change-template-panel.tsx` — the RSC flatten and the call site this task modifies.

</canonical_refs>

<deferred>
## Deferred Ideas

None raised.

### Reviewed Todos (not folded)
None — no pending todos matched this task.

</deferred>

---

*Quick task: 260908-bv1-restructure-change-template-panel-layout*
*Context gathered: 2026-09-08*
