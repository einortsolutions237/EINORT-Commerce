# Phase 5: Template Segment Expansion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-03
**Phase:** 05-template-segment-expansion
**Areas discussed:** New section types vs. reusing the 5 existing ones, What the 10/15/25 tier split actually gates, What "50 variations" means as actual data, Where merchants pick a template

---

## New section types vs. reusing the 5 existing ones

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the 5, recombine per segment | Each new template picks a different subset/order of the same 5 section types. Cheapest, matches TMPL-04's own phrasing. | ✓ |
| Mix: reuse most, add 1-2 new types where needed | Reuse as default, allow specific segments a genuinely new section type where the existing 5 can't represent them. | |
| Each segment gets its own full section set | Design each segment's sections mostly from scratch. Highest distinctiveness, largest scope. | |

**User's choice:** Reuse the 5, recombine per segment.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — each section type gets 2-3 layout variants | E.g. hero gets a full-bleed and a split variant; a template picks which variant of each type it uses. | ✓ |
| No — identical rendering, distinctiveness from order/selection/color only | Every section type renders exactly one way everywhere; zero new rendering code. | |

**User's choice:** Yes — 2-3 variants per section type.
**Notes:** Raised because pure reordering of identically-rendered sections risked failing TMPL-05's stranger test — every template would still "feel" like the same design just shuffled.

---

## What the 10/15/25 tier split actually gates

| Option | Description | Selected |
|--------|-------------|----------|
| Real gate: Starter sees only its 10 | Starter picks from a specific 10; Business unlocks 15 more (25 reachable); Professional unlocks the rest (all 50). Nested/additive. | ✓ |
| No real gate: 10/15/25 is just a target catalog count | Every merchant can pick any of the 50 regardless of tier. | |

**User's choice:** Real gate, nested/additive.
**Notes:** Matches existing "3-5 templates" copy already live on `/onboarding/plan` and `/dashboard/plan`, and the codebase's established tier-gating pattern (`src/server/entitlements/plans.ts`).

---

## What "50 variations" means as actual data

| Option | Description | Selected |
|--------|-------------|----------|
| 50 real TEMPLATES rows | Each of the 50 is a genuine `templateKey` a merchant picks by name. Matches the existing registry shape exactly. | ✓ |
| ~4-6 skeletons + a separate preset layer | TEMPLATES stays small; a new preset concept applies imagery/color/copy on top at pick time. | |

**User's choice:** 50 real TEMPLATES rows.

---

| Option | Description | Selected |
|--------|-------------|----------|
| All 50 now, this phase | TMPL-04 and the ROADMAP success criteria state "the full library reaches 50" as this phase's own done-condition. | ✓ |
| Infrastructure + segments this phase, remaining templates incremental | Build skeletons/variants and an initial subset now; fill out to 50 as fast-follow content work. | |

**User's choice:** All 50 now.
**Notes:** Image sourcing/licensing for this volume was explicitly flagged as unresolved and handed to research, with Phase 4's "no stock photo, ever" hero-default precedent as the leading candidate answer rather than an assumption either way.

---

## Where merchants pick a template

| Option | Description | Selected |
|--------|-------------|----------|
| Onboarding step, right after industry | A new step after industry selection, before/alongside branding, showing the tier-gated subset. | ✓ |
| Editor only, post-onboarding "Change template" action | Onboarding stays as Phase 4 built it; picking is a new editor-only capability. | |
| Both: onboarding AND a later editor action | A pick happens at onboarding, and the same picker is reachable later from the editor. | |

**User's choice:** Onboarding step, right after industry.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Permanent for this phase | Once picked at onboarding, the template stays fixed — no switch mechanism this phase. | |
| Allow a one-time switch within the trial window | A merchant can change their pick once, only during the 10-day trial. | |

**User's choice:** Neither preset option — free-text answer: "Merchants can switch between template[s] that are found in their payment plan[e], [e.g. starter plan[e], users can switch between the 10 available template[s]]."
**Notes:** This overturned the framing of the question (which had assumed switching was either off or trial-limited) — the user wants a real, ongoing switch capability constrained to the merchant's current tier's accessible set. Follow-up questions resolved where it lives and what happens to existing customization.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inside the storefront editor | A "Change template" action reachable from the editor the merchant already uses. | ✓ |
| Separate settings area, not the editor | A dedicated picker screen outside the editor, e.g. near /dashboard/plan. | |

**User's choice:** Inside the storefront editor.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Re-seed from the new template's defaults, with a clear warning first | Switching discards prior section customization and starts fresh, after a confirmation dialog. | ✓ |
| Best-effort carry-over of matching content | Content carries over where section types match; only new/removed sections reset. | |

**User's choice:** Re-seed with a warning.

---

## Claude's Discretion

- Exact count and identity of new layout skeletons beyond the minimum 3 segments TMPL-03 requires.
- Exact per-section-type variant count and specific variant designs (2-3 is a target, not a rule).
- Exact mechanism/schema shape for the tier-gate check.
- Exact UI copy, layout, and interaction design for the onboarding picker and the editor's "Change template" action (a UI-SPEC pass is expected, given ROADMAP.md's `UI hint: yes` for this phase).
- Image sourcing strategy for the 50 templates' default presets — handed to research rather than decided here.

## Deferred Ideas

None beyond the above — discussion stayed within phase scope. The broader dashboard-shell
Shopify-layout redesign (quick task `260903-ugl`, shipped earlier the same session) is unrelated
to this phase and was not part of this discussion.
