# Phase 7: Trial & Template-Tier Business Rules - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-13
**Phase:** 7-trial-template-tier-business-rules
**Areas discussed:** Template tier reassignment mechanics, Trial length retroactivity

---

## Template tier reassignment mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Shift by registration order | Move the existing tier boundaries mechanically in TEMPLATE_KEYS order | ✓ |
| Hand-pick by template quality/complexity | Manually review all 50 templates and choose which move | |

**User's choice:** Shift by registration order — mechanical, no per-template judgment call.
**Notes:** Established during discussion that the math is a pure downward relaxation (5 business→starter, 7 professional→business) — no tier loses templates, so no currently-live merchant loses access to their own template regardless of which specific templates move.

---

## Trial length retroactivity

| Option | Description | Selected |
|--------|-------------|----------|
| Retroactive — recompute from createdAt for everyone | TRIAL_DAYS constant change alone extends every trial, zero migration | ✓ |
| New rule applies only to stores created after this phase ships | Requires snapshotting the old value onto existing orgs first | |

**User's choice:** Retroactive, no migration — relies on the existing derive-never-stamp pattern in resolve.ts.
**Notes:** All recommended options selected without deviation. Phase scope confirmed small/mechanical; no further gray areas raised.

---

## Claude's Discretion

- Exact list of which 5/7 template keys move tiers once the mechanical shift is computed against the actual registry order.
- Whether the shift reorders TEMPLATE_KEYS itself or only changes minTier per entry.
- Exact copy wording changes across strings/ and the affected pages.
- Whether test fixtures hardcode the old numbers — a research task.

## Deferred Ideas

- Hand-curated (non-mechanical) tier reassignment — deferred unless the mechanical result looks unreasonable per-segment.
- A "what changed" announcement banner for merchants — not requested, out of scope.
