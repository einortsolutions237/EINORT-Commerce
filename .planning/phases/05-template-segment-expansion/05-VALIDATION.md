---
phase: 5
slug: template-segment-expansion
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-03
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10, two projects: `unit` (DB-free, `server-only` aliased to a stub) and `isolation` (dedicated Neon test branch) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm run test:full` |
| **Estimated runtime** | ~5s (unit) / ~5-35min (full, subject to this session's documented Neon connectivity variance) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit`
- **After every plan wave:** Run `npm run lint && npm run typecheck && npm run test:unit`
- **Phase gate:** `npm run test:full` green, then the contact sheet + adversarial-pair checkpoints, then `/gsd:verify-work`
- **Max feedback latency:** ~5s per task (unit), full suite at wave boundaries

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|---|---|---|---|---|
| TMPL-03 | ≥3 additional segments have their own structurally distinct skeletons (D-10: all 6 covered) | unit | `npx vitest run tests/unit/template-distinctiveness.test.ts -t "segment"` | ❌ Wave 0 |
| TMPL-04 | Exactly 50 templates; every default document parses, matches its declared sections+variants, has type-as-id, fresh per call | unit | `npx vitest run tests/unit/theming-registry.test.ts` | ✅ (extend from 1 to 50) |
| TMPL-04 | Cumulative tier counts are exactly 10/25/50 and the sets are nested (D-06) | unit | `npx vitest run tests/unit/template-distinctiveness.test.ts -t "nested"` | ❌ Wave 0 |
| TMPL-05 | No two templates share structure+accent; no structure used >2×; all hero voices distinct; Starter set spans ≥8 structures; every segment has a Starter option | unit | `npx vitest run tests/unit/template-distinctiveness.test.ts` | ❌ Wave 0 |
| TMPL-05 | Contact sheet + 6 adversarial-pair stranger tests (folds in Phase 4's deferred check per D-14) | manual | `checkpoint:human-verify` (final wave, **blocking**) | — |
| D-02 | Variant vocabulary complete and marker-free; a 6th section type is a compile error at `SECTION_VARIANTS` | unit + typecheck | `npm run typecheck && npx vitest run tests/unit/theming-registry.test.ts` | ✅ (extend) |
| D-02 | No `server-only` module reachable from `src/app/s/[slug]/sections/**` or any `"use client"` file | unit (source scan) | `npx vitest run tests/unit/theming-marker-boundary.test.ts` | ❌ Wave 0 |
| D-06/D-12 | `switchTemplate` refuses an out-of-tier key posted directly, before any DB write; trial does not elevate | isolation | `npx vitest run tests/isolation/template-switch.test.ts -t "tier"` | ❌ Wave 0 |
| D-08/D-09 | Switching writes draft columns only; published document/tokens/templateKey byte-identical until publish | isolation | `npx vitest run tests/isolation/template-switch.test.ts` | ❌ Wave 0 |
| D-09/D-11 | `discardDraft` reverts document, tokens, and `draftTemplateKey` together; accents/logoKey survive a switch, copy tokens reset | isolation | `npx vitest run tests/isolation/template-switch.test.ts -t "discard\|accents"` | ❌ Wave 0 |
| D-07 | `saveBranding`/picker seeds from the picked template, not the flagship; refuses a forged `templateKey` | isolation | `npx vitest run tests/isolation/onboarding-template.test.ts` | ❌ Wave 0 |
| D-13 | Existing tenants' template values survive the `templateKey` → `publishedTemplateKey` rename migration | isolation | `npm run test:full` against a branch seeded before migrating | ❌ Wave 0 |
| Regression | Existing Phase 4 fixtures and the flagship's byte-identity still hold | unit + isolation | `npm run test:unit && npm run test:full` | ✅ |
| All | Token hygiene bans 1-6 still green with new variants and the picker | unit | `npx vitest run tests/unit/surface-token-isolation.test.ts` | ✅ |

*Status: all ⬜ pending until execution begins.*

---

## Wave 0 Requirements

- [ ] `tests/unit/template-distinctiveness.test.ts` — TMPL-05, TMPL-04's nested tier counts, D-10's per-segment Starter-coverage assertion
- [ ] `tests/unit/theming-marker-boundary.test.ts` — D-02's marker-boundary constraint (server-only leakage into client-reachable code)
- [ ] `tests/isolation/template-switch.test.ts` — D-06, D-08, D-09, D-11, D-12
- [ ] `tests/isolation/onboarding-template.test.ts` — D-07
- [ ] Extend `tests/unit/theming-registry.test.ts` from 1 template to 50
- [ ] Framework install: **none** — Vitest 4.1.10 and both projects already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The stranger test: two people shown template pairs correctly identify them as different shops and name real differences, for all 6 adversarial-closest pairs (including the flagship per D-14) | TMPL-05 | No automated proxy exists for a human's genericness judgment — this is the actual requirement, not a stand-in for it | Generate the 50-thumbnail contact sheet (Layer 2), identify the 6 closest pairs by the automated distinctiveness metric (Layer 1), run Phase 4's verbatim stranger-test script against each pair, record verbatim responses |
| Onboarding picker UX at real breakpoints (segment-filtered view, "show all" disclosure, tier-locked template affordance) | D-07 | Visual/interaction quality judgment, not a boolean the test suite can assert | Live-browser walkthrough once the picker is built, per the UI-SPEC this phase's `UI hint: yes` requires |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 new files + 1 extension, listed above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s (unit) at task granularity
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-03
