---
phase: 4
slug: theme-section-block-system-flagship-template
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-01
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10, two projects (`unit`, `isolation`), both `environment: "node"` |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:unit` (`vitest run tests/unit --reporter=dot`, no DB, target < 2s) |
| **Full suite command** | `npm run test:full` (`dotenv -e .env.test -- vitest run`, requires `TEST_DATABASE_URL`) |
| **Estimated runtime** | ~2s (unit) / ~30s (full, per prior phases) |

Also gating on every task and every wave: `npm run lint` (`--max-warnings=0`) and `npm run typecheck`.

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit && npm run lint && npm run typecheck`
- **After every plan wave:** Run `npm run test:full`
- **Before `/gsd:verify-work`:** Full suite must be green, plus both manual checkpoints below
- **Max feedback latency:** ~2s (unit gate), well under any reasonable ceiling

---

## Per-Task Verification Map

| Task ID | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| W0 | EDIT-01 | T-04-06 | New models registered in `TENANT_SCOPED_MODELS`; unregistered model throws | isolation | `vitest run --project isolation tests/isolation/model-registry-drift.test.ts` | ✅ exists | ⬜ pending |
| W0 | EDIT-01 | — | `pageDocumentSchema` rejects an unknown `type`, a missing `settings` key, a non-hex color | unit | `vitest run --project unit tests/unit/page-document-schema.test.ts` | ❌ W0 | ⬜ pending |
| W0 | TMPL-02 | — | Every section type in the union has a `SECTION_TYPES` entry, a defaults entry, and field descriptors matching its schema keys exactly | unit | `vitest run --project unit tests/unit/theming-registry.test.ts` | ❌ W0 | ⬜ pending |
| W0 | D-11 | T-04-03 | Known WCAG pairs produce documented ratios (black/white = 21, identical = 1); `accentForeground` picks the higher-contrast option | unit | `vitest run --project unit tests/unit/contrast.test.ts` | ❌ W0 | ⬜ pending |
| W0 | EDIT-02 | — | Reducer: move-up at index 0 and move-down at the last index are no-ops; `set-field` replaces (never merges); order is the array order | unit | `vitest run --project unit tests/unit/editor-reducer.test.ts` | ❌ W0 — the only automated coverage EDIT-02's core logic can get | ⬜ pending |
| W0 | EDIT-03 / D-15 | T-04-05 | A Starter merchant with an ACTIVE trial has `canEditStorefront === true`; the same merchant with an expired trial has `false`; Business/Professional identical | unit | `vitest run --project unit tests/unit/entitlements.test.ts` (extend) | ✅ file exists, ❌ cases to add — the D-15 trap | ⬜ pending |
| W0 | TMPL-01 | T-04-02 | No literal color, no palette utility, no `font-heading`/gold/success anywhere under `src/app/s/**` | unit | `vitest run --project unit tests/unit/surface-token-isolation.test.ts` | ✅ exists — will fail on a careless section component; that is the point | ⬜ pending |
| W0 | D-12 | T-04-02 | Editor route contains no `data-surface="storefront"` and no `brand-accent` utility | unit | `tests/unit/surface-token-isolation.test.ts` (ban 4) + new brand-accent assertion | ✅ ban 4 exists, ❌ assertion to add | ⬜ pending |
| W0 | TMPL-01 | T-04-07 | No storefront link carries the internal `/s/${…}` prefix | unit | `tests/unit/storefront-link-prefix.test.ts` | ✅ exists | ⬜ pending |
| W0 | Nav | — | `/dashboard/storefront-editor` reachable from the rail | unit | `tests/unit/dashboard-nav.test.ts` | ✅ exists — add the href to `REQUIRED_HREFS` in the same commit | ⬜ pending |
| W0 | ONB-02 | T-04-04 | Branding action persists industry + both accents; a forged `tenantId` in the payload is ignored | isolation | `vitest run --project isolation tests/isolation/branding.test.ts` | ❌ W0 | ⬜ pending |
| W0 | ONB-04 | — | Seed is idempotent: two branding submissions leave exactly one theme + one page row, `published` non-null | isolation | `tests/isolation/branding.test.ts` | ❌ W0 | ⬜ pending |
| W0 | ONB-03 | — | `processImage(buf, "logo")` produces 128 + 512 derivatives with declared dimensions and preserved transparency | unit | `vitest run --project unit tests/unit/image-pipeline.test.ts` (extend) | ✅ file exists, ❌ case to add | ⬜ pending |
| W0 | ONB-03 | T-04-01 | Presigned logo key is always `tenants/{ctx.tenantId}/logos/…` regardless of input; finalize maps `logos → "logo"` preset | unit | `tests/unit/r2-key.test.ts` (extend) + new preset-map case | ✅ file exists, ❌ cases to add | ⬜ pending |
| W0 | EDIT-02 | T-04-06 | `saveDraft` writes `draft` and leaves `published` byte-identical | isolation | `vitest run --project isolation tests/isolation/storefront-editor.test.ts` | ❌ W0 | ⬜ pending |
| W0 | EDIT-02 / D-08 | T-04-06 | Publish promotes draft→published atomically; a draft failing schema validation refuses the publish and leaves `published` untouched | isolation | `tests/isolation/storefront-editor.test.ts` | ❌ W0 — the phase's highest-value correctness test | ⬜ pending |
| W0 | EDIT-02 | T-04-06 | Tenant A's `saveDraft` cannot touch tenant B's page row | isolation | `tests/isolation/storefront-editor.test.ts` (mirrors `tests/isolation/tenant-isolation.test.ts`) | ❌ W0 | ⬜ pending |
| W0 | EDIT-03 | T-04-05 | `publishStorefront` refuses a post-trial Starter merchant by direct invocation (no UI) | isolation | `tests/isolation/storefront-editor.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Prisma migration: `StorefrontTheme`, `StorefrontPage`, `Organization.industry` — blocks everything downstream
- [ ] `TENANT_SCOPED_MODELS` registration + `tests/setup/seed-two-tenants.ts` fixtures for both new models, in the same task as the migration (Pitfall 6 — all three parts atomic)
- [ ] `src/server/theming/schema.ts` — the discriminated union; blocks the registry, the actions, the renderer, and the preview
- [ ] `src/server/theming/registry.ts` + `defaults.ts` + `strings.flagship.*`
- [ ] `src/lib/contrast.ts` + `tests/unit/contrast.test.ts`
- [ ] `src/lib/editor/reducer.ts` + `tests/unit/editor-reducer.test.ts`
- [ ] `PlanLimits.storefrontEditor` + `MerchantContext.canEditStorefront` + `assertCanEditStorefront` + `EditorLockedError` wiring into `merchantAction`'s catch
- [ ] `tests/unit/entitlements.test.ts` — the D-15 trial-override cases
- [ ] `tests/unit/theming-registry.test.ts` — registry/schema drift guard
- [ ] `tests/isolation/storefront-editor.test.ts` — publish atomicity, cross-tenant refusal, tier refusal
- [ ] `tests/isolation/branding.test.ts` — seed idempotency, forged-payload rejection
- [ ] `REQUIRED_HREFS` + `app-sidebar.tsx` update (Pitfall 10)
- [ ] `IMAGE_PRESETS` per-preset `enhance` flag + finalize `kind → preset` map
- [ ] `globals.css` — `--brand-accent*` in `@theme inline` and the storefront scope fallbacks; motion tokens
- [ ] Regenerate the Prisma client after the migration (`npm install` / `scripts/prisma-generate.mjs`)

No framework install is needed — Vitest 4.1.10 and both projects already exist.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| As-you-type preview latency, correct breakpoints in the iframe, no flash of published content | EDIT-02 / D-07 | No test runner can judge "instant," and the iframe's own viewport behavior needs eyes on a real device | Open the editor, edit a Hero heading and an accent color, confirm the preview pane updates with no visible lag and no server round-trip in the network tab; toggle a mobile-width preview and confirm breakpoints render correctly |
| Design-distinctiveness / "would a stranger think this cost money" side-by-side check | TMPL-01 | This is STATE.md's explicitly named Phase 4 risk — design-distinctiveness has no objective completion signal a test can assert | At the phase gate, place the published flagship storefront next to 2-3 reference DTC sites (including the zinc-monochrome reference itself) and confirm it reads as a genuinely designed, on-brand storefront rather than an obviously templated one |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — confirmed by gsd-plan-checker across all 16 plans (04-01 through 04-16)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — 100% task-level automated-verify coverage
- [x] Wave 0 covers all MISSING references — every ❌ W0 item listed above is created by the plan/task that needs it (Waves 1-4, TDD-style co-location, not deferred)
- [x] No watch-mode flags
- [x] Feedback latency < 2s (unit gate)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-01 (gsd-plan-checker VERIFICATION PASSED, 0 blockers)
