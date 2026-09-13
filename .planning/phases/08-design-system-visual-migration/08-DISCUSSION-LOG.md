# Phase 8: Design System & Visual Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-13
**Phase:** 8-design-system-visual-migration
**Areas discussed:** Migration fidelity to the reference (only area selected of the 4 offered — Component library scope, Migration order & wave strategy, and Verification rigor were not selected, left to research/planning)

---

## Migration fidelity to the reference

| Option | Description | Selected |
|--------|-------------|----------|
| Extract tokens/components, keep good layouts | Restyle with the shared layer where structure already works | |
| Close parity with the reference everywhere | Re-layout every surface to match the prototype's composition | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Match the layout, keep it non-functional or hidden | Reproduce structure, omit fake data/dead controls | ✓ |
| Skip that part of the layout entirely | Don't reference capabilities that don't exist | |

| Option | Description | Selected |
|--------|-------------|----------|
| This project's own locked UI-SPECs win | More specific/recent source for this product | ✓ |
| The reference prototype wins | Treat prototype as authoritative over prior UI-SPECs | |

| Option | Description | Selected |
|--------|-------------|----------|
| Stay strictly scoped to the component migration | Fix only what the migration itself touches | ✓ |
| Fix obvious rough edges opportunistically | Clean up unrelated issues in the same pass | |

**User's choice (round 1):** Close parity everywhere; non-functional/hidden for capability gaps; project's own specs win on undecided details; stay strictly scoped.
**Notes:** "Close parity everywhere" deviated from the recommended lighter-touch option — flagged as a deliberate choice, confirmed explicitly in round 2.

Follow-up round:

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, close parity applies even there | Revisit 05.2/05.3's recent structure if reference differs | ✓ |
| No — 05.2/05.3's own recent structure stands | Keep recent locked structure, restyle only | |

| Option | Description | Selected |
|--------|-------------|----------|
| The no-fabrication rule always wins | Never add a section requiring fabricated content | ✓ |
| Open to reconsidering if the reference makes a strong case | Revisit 05.2's D-01 case-by-case | |

| Option | Description | Selected |
|--------|-------------|----------|
| EINORT's own 9 breakpoints still govern | Reference informs styling, not the breakpoint contract | ✓ |
| Match the reference's own breakpoint behavior too | Adopt reference's responsive behavior even where it diverges | |

**User's choice (round 2):** Confirmed close parity extends even to 05.2/05.3's recent work; the no-fabrication rule and the 9-breakpoint contract both stay as hard exceptions regardless of fidelity level.

---

## Claude's Discretion

- Component library scope: full ~13-primitive set up front vs. only what's needed now.
- Migration order/wave strategy across the 7 surfaces.
- Verification rigor: per-surface checkpoint vs. something more (e.g. screenshot diffing).

## Deferred Ideas

- Opportunistic cleanup of unrelated pre-existing rough edges encountered during migration — logged as follow-up candidates, not folded in.
