# Phase 7: Trial & Template-Tier Business Rules - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Make two already-locked Master Product Specification V3 business-rule changes true everywhere the product enforces or states them, with no surface still quoting the old numbers:

1. **Storefront trial: 10 days → 30 days.** `TRIAL_DAYS` in `src/server/entitlements/resolve.ts`, plus every trial-day copy reference across onboarding, dashboard, and pricing surfaces (confirmed live on the running dev server's landing page: "Free for 10 days", "Every plan gets the full 10-day trial", "Ten days. No card. Your own storefront.").
2. **Template tier split: 10 Starter / 15 Business / 25 Professional → 15 Starter / 17 Business / 18 Professional.** Same 50-template total, same 6 segment categories — only the tier boundary moves. Confirmed via `grep -o 'minTier: "[a-z]*"' src/server/theming/registry.ts | sort | uniq -c`: today's registry has exactly 10 starter / 15 business / 25 professional `minTier` values.

Explicitly NOT in scope: adding new templates, changing template content/segments, changing the entitlement/plan-access architecture itself (`canUseTemplate`, `accessibleTemplateKeys`, `resolveEntitlements`'s derive-never-stamp pattern) — only the constants and the specific `minTier` assignments change.

Both changes were already locked at the milestone level (PROJECT.md Key Decisions, 2026-09-13) before this phase's discuss-phase ran — this discussion covered only the migration MECHANICS (which specific templates move tiers, whether the trial change is retroactive), not whether to make the changes.

</domain>

<decisions>
## Implementation Decisions

### Template tier reassignment
- **D-01:** Move the tier boundary by registration order in `TEMPLATE_KEYS`/the registry array — take the current `minTier` boundary lines and shift them mechanically to produce 15/17/18, rather than hand-picking specific templates by visual judgment. No manual per-template review across all 50.
- **D-02:** After the mechanical shift, verify the resulting per-segment tier mix (fashion/electronics/beauty/grocery/furniture/general-retail) still looks reasonable — a sanity check, not a redesign. If a segment ends up badly lopsided (e.g., all of one segment's templates landing in one tier), flag it for the user rather than silently accepting a mechanical shift that produces an obviously bad distribution.
- **D-03:** Confirmed direction of the reassignment (from the math, not a new decision, but binding for the plan): 5 templates move from `minTier: "business"` down to `minTier: "starter"`; 7 templates move from `minTier: "professional"` down to `minTier: "business"`. Every move is a downward relaxation — no template becomes MORE tier-restricted than it is today, so no currently-live merchant store loses access to its own template. This must hold as an explicit acceptance criterion, not an assumption: verify no template's `minTier` rank increases.

### Trial length retroactivity
- **D-04:** The 30-day trial applies retroactively to every existing `Organization` row, not just newly-created ones. This requires zero migration: `resolve.ts` already derives trial expiry from `createdAt + TRIAL_DAYS` at read time rather than stamping a value at signup (the same "derive, never stamp" pattern SUB-01/ONB-05 established and Phase 6's SUB-03 work explicitly reuses) — changing the `TRIAL_DAYS` constant alone extends every trial, live and dev/test data alike, the moment this phase ships. No merchant's trial ever gets shorter under this change.
- **D-05:** No separate migration script, no `trialEndsAt` backfill, no dual-rate logic (some orgs on 10 days, others on 30). One constant, one meaning, applied uniformly and immediately.

### Claude's Discretion
- Exact list of which 5 template keys move business→starter and which 7 move professional→business, once D-01's mechanical shift is applied to the actual registry order — a research/planning-time computation, not a vision question.
- Whether the shift touches `TEMPLATE_KEYS`' declared order itself or only the `minTier` field per entry (leaving declaration order untouched) — an implementation detail.
- Exact wording changes needed across trial-day copy (`src/lib/strings/**`) and template-tier copy (public landing page's "Starter reaches 10 templates, Business 25, Professional all 50" line, onboarding/plan, dashboard/plan, pricing) — mechanical find-and-replace guided by the actual new cumulative-access numbers (Starter reaches 15, Business reaches 15+17=32, Professional reaches all 50).
- Whether any test fixtures or isolation tests hardcode the old 10/15/25 or 10-day numbers and need updating alongside the source change — a research task (grep for the literals) rather than something to decide now.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked prior decisions this phase implements
- `.planning/PROJECT.md` Key Decisions table — "v2.0: Storefront trial changed from 10 days to 30 days" and "v2.0: Template tier split changed from 10/15/25 to 15/17/18" (2026-09-13), both citing Master Product Specification V3 as the source.
- `.planning/design-references/EINORT-V3-MASTER-SPEC-AND-PROTOTYPE-V6.md` — the table of exact v1.0-vs-V3 numbers this phase implements.
- `.planning/REQUIREMENTS.md` — `ONB-05` (updated in place 2026-09-13 to state 30 days) and `TMPL-04` (updated in place to state 15/17/18) — both already carry the "Scheduled 2026-09-13: Phase 7" note and their original v1.0 traceability rows (Phase 2, Phase 5) are kept as historical record of what shipped originally.

### Existing code this phase touches
- `src/server/entitlements/resolve.ts` — `TRIAL_DAYS` constant (currently `10`), and the derive-from-`createdAt` trial-expiry logic D-04 relies on.
- `src/server/theming/registry.ts` — the `TEMPLATES`/`TEMPLATE_KEYS` registry, each entry's `minTier: PlanTier` field (10 `"starter"` / 15 `"business"` / 25 `"professional"` today).
- `src/server/theming/access.ts` — `canUseTemplate`, `accessibleTemplateKeys`, `PLAN_TIER_RANK` — the gating logic that reads `minTier`; unchanged by this phase except for the data it reads.
- `src/lib/strings/**` — all trial-day and template-tier-count copy (per `CLAUDE.md`'s "UI copy is centralized in `src/lib/strings.ts`" rule and its source-scanning contract test).
- Public landing page (`src/app/page.tsx`, Phase 05.2) — confirmed live on the dev server as still quoting "Free for 10 days" and "Starter reaches 10 templates, Business 25, Professional all 50."
- `src/app/onboarding/plan/**`, `src/app/(dashboard)/dashboard/plan/**` — the plan-selection/display surfaces quoting trial days and tier template counts (per `260831-urm`/`260831-vd2` quick-task history).

</canonical_refs>

<specifics>
## Specific Ideas

Confirmed directly against the running dev server (`http://localhost:3001`) during this session: the current landing page reads "Free for 10 days. No card required." and "Starter reaches 10 templates, Business 25, Professional all 50. Every plan gets the full 10-day trial first." — both must change as part of this phase.

</specifics>

<deferred>
## Deferred Ideas

- **Hand-curated (non-mechanical) template tier reassignment** — deferred in favor of D-01's mechanical shift; revisit only if D-02's sanity check finds the mechanical result genuinely unreasonable for a specific segment.
- **A "what changed" banner or announcement copy** about the trial/tier changes — not requested, not part of this phase's scope; the changes should read as simply correct, not as a migration event surfaced to merchants.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 7-trial-template-tier-business-rules*
*Context gathered: 2026-09-13*
