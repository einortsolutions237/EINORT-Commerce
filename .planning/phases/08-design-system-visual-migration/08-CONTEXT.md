# Phase 8: Design System & Visual Migration - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning — but NOT ready for research/execution yet (see Phase Boundary)

<domain>
## Phase Boundary

Bring every existing merchant-facing surface (Auth, Onboarding, Dashboard Overview, Products, Orders, Storefront Themes/Editor, Settings) into close visual/layout parity with the Master Product Specification V3 design-reference prototype, and extract a reusable component layer that Phases 9-15's new screens build from.

**Hard dependency, not just a sequencing preference:** ROADMAP.md states Phase 8 "Depends on: Phase 6 (the dashboard and Super Admin surfaces this phase migrates must exist first), Phase 7 (so the migration renders the final 30-day / 15-17-18 copy)." This is a REAL content dependency, not just a scheduling convenience — Phase 8 migrates surfaces Phase 6 is actively building/modifying (the dashboard shell, the new Support nav item, the Overview attention band) and needs Phase 7's final trial/tier numbers rendered, not the old ones. **This discuss-phase captured the STRATEGIC/vision decisions now (safe — they don't require Phase 6/7's code to exist), but Phase 8's own research and planning should wait until Phase 6 is executed (code merged) and Phase 7 is at least planned, or research will be investigating a codebase state that's about to change out from under it.**

Explicitly NOT in scope: Marketplace, Marketplace Marketing, Customers, Inventory, Delivery, Domains, Analytics (Phases 9-15's own new pages — each of those phases builds its own UI using the component layer this phase produces, but does not fall under this phase's migration list). Also not in scope: Platform Admin's full surface (deferred milestone-wide), any backend/data/auth changes (DSGN-02's own requirement: "same data, same server actions, same auth boundaries, same entitlement gating").

</domain>

<decisions>
## Implementation Decisions

### Migration fidelity to the reference
- **D-01:** Aim for close visual/layout parity with the design-reference prototype across ALL migrated surfaces — including revisiting very recently shipped, human-approved work if the reference's structure differs meaningfully. This explicitly includes Phase 05.3's Themes/Editor page-split structure and Phase 05.2's researched landing page: if the reference's layout for these differs from what's currently live, restyle/relayout toward the reference. Consistency with the reference takes priority over "don't touch what was just approved." (This is a deliberate deviation from the initially-recommended lighter-touch option — the user chose maximum consistency over minimum churn.)
- **D-02:** Where the reference's layout implies a capability EINORT's real page doesn't have (richer filters, extra fields, functionality with no backend behind it), reproduce the visual structure but keep the control non-functional or hidden. Never fake data, never ship a dead button that looks live — matches this project's existing "no placeholder that looks real" discipline (TMPL-05's genericness-as-failure standard, the "no PRODUCT IMAGE placeholders" rule from Master Spec V3).
- **D-03 (hard exception to D-01 — does not yield to "close parity"):** Phase 05.2's no-fabrication rule stays locked regardless of visual-fidelity level. If the reference's Landing page (or any other page) has sections requiring content EINORT can't honestly back — fake testimonials, invented merchant/customer counts, unsupported performance claims — do NOT add that section, even if skipping it means less parity with the reference. This was a locked, human-approved decision (D-01 in `05.2-CONTEXT.md`) made after deep research into what EINORT can honestly claim; it is not reopened by this phase's higher general fidelity bar.
- **D-04 (hard exception to D-01 — does not yield to "close parity"):** EINORT's own locked 9-breakpoint responsive contract (320/375/390/430/768/1024/1280/1440/1920, per DSGN-03) governs regardless of what breakpoints or responsive behavior the reference itself uses. The reference informs visual/component styling at each size; it does not override this project's own structural testing contract.
- **D-05:** Where the reference and this project's own prior locked UI-SPECs (Phase 6's just-approved `06-UI-SPEC.md`, the merchant-platform design reference doc, any earlier phase's locked decisions) disagree on a detail not already covered by a locked decision, this project's own specs win — they are the more specific, more recently-verified source for THIS product. The prototype is a visual inspiration and fidelity target, not an override authority, matching the source-of-truth hierarchy already established for milestone v2.0 (Master Spec V3 for business rules → this project's own architecture/decisions → the design-reference prototype for visual/UX patterns → screenshots for verification only).
- **D-06:** Stay strictly scoped to what the component-layer migration itself touches. Do not opportunistically fix unrelated pre-existing rough edges (an awkward empty state, inconsistent spacing that predates this migration) just because a page is already being touched — flag them as deferred ideas/follow-up tasks instead, so this already-large phase's diff stays reviewable and its scope stays auditable.

### Claude's Discretion
- **Component library scope:** whether to build the full ~13-primitive set (DesignButton, Card, Badge, Modal, PageHeader, StatusBadge, PricingCard, TemplateCard, ProductCard, MetricCard, EmptyState, DataTable, StorePreview) up front in one wave, or build only what the 7 existing surfaces actually need now and let later phases (9-15) add primitives as they need them. Not discussed — left to research/planning to recommend, informed by what Phase 6's actual shipped components (once executed) already provide versus what's genuinely still missing.
- **Migration order/wave strategy:** which of the 7 surfaces (Auth, Onboarding, Dashboard Overview, Products, Orders, Storefront Themes/Editor, Settings) migrates first, and whether they're migrated one at a time with checkpoints or grouped into waves. Not discussed — left to planning, likely informed by risk/value ordering and by which surfaces Phase 6 actually touches (migrate those last, after Phase 6 lands, to avoid rework).
- **Verification rigor:** whether a per-surface `checkpoint:human-verify` (mirroring Phase 05.3's six-item pattern) is sufficient, or whether something more (before/after screenshots for every migrated page) is warranted given DSGN-02's "existing test suite passes unweakened" requirement. Not discussed — left to the validation-strategy step once research/planning actually runs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design reference (the fidelity target per D-01)
- `.planning/design-references/EINORT-V3-MASTER-SPEC-AND-PROTOTYPE-V6.md` — the v6 prototype snapshot registration; lists which pages are new vs. already-covered by the earlier merchant-platform reference, and the milestone-level conflicts already resolved (trial/tier numbers, payment gateway, Admin deferral).
- `.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md` — the original token/component inventory for this same reference repo (blue/gold/zinc tokens, Outfit + Plus Jakarta Sans, `0.75rem` radius) — already partially adopted via `260823-gu4`/`260906-egn`; this phase extends structure, not tokens.

### Hard exceptions that survive D-01's "close parity" mandate — do not silently override
- `.planning/phases/05.2-marketing-landing-page-redesign/05.2-CONTEXT.md` D-01 — the no-fabrication rule (D-03 above).
- Wherever DSGN-03's 9-breakpoint contract is formally specified (likely `.planning/REQUIREMENTS.md` DSGN-03, and any prior phase's responsive-testing convention) — the breakpoint exception (D-04 above).

### Prior locked UI-SPECs this phase's fidelity decisions (D-05) must defer to when the reference doesn't specify
- `.planning/phases/06-merchant-dashboard-platform-admin/06-UI-SPEC.md` — the just-approved contract for the dashboard/Super Admin surfaces Phase 6 is building; Phase 8 migrates around/after this, not in conflict with it.
- `.planning/phases/02-merchant-auth-entitlements-trial/02-UI-SPEC.md`, `.planning/phases/04-theme-section-block-system-flagship-template/04-UI-SPEC.md`, `.planning/phases/05-template-segment-expansion/05-UI-SPEC.md`, `.planning/phases/05.1-template-preview-rendering-picker-redesign/*`, `.planning/phases/05.2-marketing-landing-page-redesign/05.2-UI-SPEC.md`, `.planning/phases/05.3-storefront-editor-page-split/05.3-UI-SPEC.md` — the locked specs for every surface this phase touches; each must be read before that specific surface's migration is planned.

### Requirements this phase implements
- `.planning/REQUIREMENTS.md` DSGN-01, DSGN-02, DSGN-03.
- `.planning/ROADMAP.md` § "Phase 8: Design System & Visual Migration" — goal, success criteria, dependency note, and the planning notes about `260823-gu4`/`260906-egn`'s existing token/component work and the storefront-vs-merchant-platform reference distinction.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (confirmed already shipped — do not rebuild)
- Blue/gold/zinc token system (`260823-gu4` retrofit) — tokens are done; this phase is structural/compositional, not a re-skin.
- `DashboardCard` primitive (`260903-ugl`/`260906-egn`) — an existing component-layer starting point; extend, don't replace.
- The dashboard shell (3-group sidebar nav, Cmd/Ctrl+K search modal, theme toggle) from `260906-egn`.
- `TemplateMedia`, `TemplatePicker`/`TemplateTile`, `CurrentTemplateCard` (Phase 05.1/quick task `260908-bv1`) — already-built, already-reference-aligned components for the template/theme surfaces.

### Established Patterns
- `tests/unit/surface-token-isolation.test.ts` — will fail the build if the storefront's zinc palette and the merchant-platform's blue/gold/zinc tokens get mixed. This phase's migration must respect that boundary (storefront `[data-surface="storefront"]` scope is separate from everything Phase 8 touches).
- `tests/unit/dashboard-nav.test.ts` — the prose-literal contract test scanning `.tsx` source; any new copy this phase introduces must route through `src/lib/strings/**`.

### Integration Points
- Phase 6's Support nav item, gold-accent banner, and new dashboard sections (once executed) become part of what this phase's shell/nav migration must account for — do not plan this phase's sidebar/nav work assuming Phase 6 hasn't happened.
- Phase 7's final trial/tier numbers (once executed or at least planned) must be what any migrated copy displays — do not plan copy against the old 10-day/10-15-25 numbers.

</code_context>

<specifics>
## Specific Ideas

The user's choice on fidelity ("close parity everywhere," including revisiting 05.2/05.3) is a deliberate, informed deviation from the lighter-touch recommendation — confirmed explicitly when asked directly whether this extends even to very recently shipped, human-approved work. Take this at face value: do not quietly soften it back to "keep what already works" during planning.

</specifics>

<deferred>
## Deferred Ideas

- **Opportunistic cleanup of unrelated pre-existing rough edges** encountered while migrating a page — explicitly deferred per D-06; log as follow-up quick-task candidates rather than folding into this phase's diff.
- **Component library scope, migration order, and verification rigor** — not vision questions, deliberately left to research/planning once Phase 6's actual shipped state is known (see Phase Boundary's dependency note).

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 8-design-system-visual-migration*
*Context gathered: 2026-09-13*
