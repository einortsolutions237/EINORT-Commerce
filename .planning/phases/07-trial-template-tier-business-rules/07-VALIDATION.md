---
phase: 7
slug: trial-template-tier-business-rules
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-13
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10, two projects (`unit`, `isolation`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:unit` (`vitest run tests/unit --reporter=dot`) — no database |
| **Full suite command** | `npm run test:full` (`dotenv -e .env.test -- vitest run`) — requires `TEST_DATABASE_URL` |
| **Estimated runtime** | Small phase — unit suite seconds, full isolation suite in the existing 22-27 min range with no new models added |

Other gates: `npm run lint` (`--max-warnings=0`), `npm run typecheck`, `npm run build`.

---

## Sampling Rate

- **After every task commit:** `npm run test:unit && npm run lint && npm run typecheck`
- **After every plan wave:** `npm run test:unit` + `npm run test:full` (isolation, needs `TEST_DATABASE_URL`)
- **Phase gate:** full suite green + `npm run build` + the manual copy walkthrough on `localhost:3001`

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------------|-----------|-------------------|-------------|--------|
| TBD-01 | TBD | 1 | ONB-05 | `TRIAL_DAYS === 30` | unit | `npx vitest run tests/unit/entitlements.test.ts -t "daysLeft"` | ✅ assertion must change | ⬜ pending |
| TBD-02 | TBD | 1 | ONB-05 | Trial active mid-window, expired at boundary, at 30 days | unit | `npx vitest run tests/unit/entitlements.test.ts -t "trial"` | ✅ offsets must be re-anchored | ⬜ pending |
| TBD-03 | TBD | 1 | ONB-05 | D-15 editor grant during/after a 30-day trial | unit | `npx vitest run tests/unit/entitlements.test.ts -t "editor capability"` | ✅ `AFTER_TRIAL` must move | ⬜ pending |
| TBD-04 | TBD | 1 | ONB-05 | `endsAt === createdAt + 30d` with `trialEndsAt` NULL, end to end | isolation | `npm run test:full -- tests/isolation/trial.test.ts` | ✅ 2 assertions must change | ⬜ pending |
| TBD-05 | TBD | 2 | TMPL-04 | Reachable counts are 15/32/50 and remain nested | unit | `npx vitest run tests/unit/template-distinctiveness.test.ts -t "nested"` | ✅ numbers must change | ⬜ pending |
| TBD-06 | TBD | 2 | TMPL-04 | `PlanLimits.templates` matches the registry's real count | unit | same file, L353-354 | ✅ guard already exists | ⬜ pending |
| TBD-07 | TBD | 2 | TMPL-04 / D-03 | No template's `minTier` rank increased vs. today | unit (frozen-table) | new test | ❌ Wave 0 gap | ⬜ pending |
| TBD-08 | TBD | 2 | TMPL-04 / D-02 | Every segment has ≥2 Starter-accessible and ≥1 Professional-only template post-reassignment | unit | new test | ❌ Wave 0 gap | ⬜ pending |
| TBD-09 | TBD | 2 | TMPL-04 | Out-of-tier template selection still refused server-side | isolation | `npm run test:full -- tests/isolation/template-switch.test.ts tests/isolation/onboarding-template.test.ts` | ✅ key/comment swap needed | ⬜ pending |
| TBD-10 | TBD | 2 | TMPL-04 | Locked templates stay visible-but-dimmed at onboarding | unit (source-scan) | `npx vitest run tests/unit/template-picker-contract.test.ts` | ✅ unchanged | ⬜ pending |

*Plan/wave/task IDs are placeholders (`TBD`) — the planner fills these in. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] A D-03 invariant test — pin the expected post-change `minTier` for all 50 keys as a frozen table, assert `TEMPLATES[key].minTier` matches. Makes any future accidental re-tiering a red build.
- [ ] A D-02 segment-balance test (cheap, recommended) — assert every `INDUSTRY_SEGMENT` has ≥2 Starter-accessible templates and ≥1 Professional-only template. This is exactly what would have caught the original Option A automatically.
- [ ] No framework install needed — Vitest, both projects, and all fixtures already exist.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Every trial-day figure a merchant reads says 30, everywhere | ONB-05 | No DOM in the unit test project; this is a cross-page copy consistency check | Walk through `/`, `/signup`, `/onboarding/plan`, `/dashboard/plan` on `localhost:3001` after the copy changes land; confirm no surface still says "10 days" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (unit gate)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
