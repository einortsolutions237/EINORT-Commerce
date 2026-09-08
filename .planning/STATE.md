---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 05.1-07-PLAN.md
last_updated: "2026-09-08T03:06:11.930Z"
last_activity: 2026-09-07 -- Quick task 260907-a2v (remove Super Admin Panel header stub) merged and gated; quick task 260906-egn (dashboard shell rebuild + real Overview page) and Phase 5 Wave 4 (05-18..20) also merged and gated.
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 77
  completed_plans: 71
  percent: 38
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-16)

**Core value:** A merchant picks an industry, adds a logo and a few products, and within minutes has a storefront that looks like it cost them money to build.
**Current focus:** Phase 05.1 Wave 2 next (template-preview-rendering-picker-redesign); Phase 05.2 (marketing-landing-page-redesign) awaiting discuss-phase, running in parallel

## Current Position

Phase: 05.1 (template-preview-rendering-picker-redesign) — EXECUTING, WAVE 1 OF 5 MERGED, WAVE 2's 05.1-07 COMPLETE (this branch, not yet merged)
Urgent decimal-phase insertion after Phase 5 Waves 1-5 (all merged) and before Phase 5's Wave 6 (05-22), triggered by the user reviewing the live "Change template" panel against Shopify's Discover Themes reference. Full planning pipeline completed 2026-09-07: discuss-phase (6 decisions D-01–D-06), research (chose Playwright over Puppeteer, a generated manifest over a registry field, found the picker's real container-query grid bug), UI-SPEC (approved 6/6, 3 consequential decisions confirmed by the user), pattern-mapper, planner (9 plans across 5 waves), plan-checker (PASSED). TMPL-06 added to REQUIREMENTS.md. Wave 1 (05.1-01 playwright install, 05.1-02 image pipeline/manifest, 05.1-03 scratch-tenant guard, 05.1-04 placeholder photos + containment test) all merged to master 2026-09-07; lint/typecheck/test:unit (637/637)/build all clean. Both Wave 1 blocking `checkpoint:human-verify` gates (playwright package legitimacy, CC0 placeholder-photo licensing) were independently re-verified by the orchestrator (npm registry packument checks; live StockSnap.io license-page and photo-page checks) before the user's approval. 05.1-07 (Wave 2 — `scripts/generate-template-previews.ts`, the guarded reseed + Playwright capture + Sharp/R2 + manifest-emit generator) completed 2026-09-08 in worktree branch `worktree-agent-a24c88366ec96d99b`, commit `f8f422f`: found and fixed a real ESM static-import evaluation-order bug (a static import of `r2.ts`, which imports `@/env`, always crashed before this script's own `.env.local`/`.env` loading loop could run — fixed via a deferred dynamic `import()` inside `main()`) plus a Windows-specific `*.localhost` DNS-resolution false-negative in the dev-server probe (fixed via `node:http` for local-dev hosts). All three of the plan's behavioral acceptance criteria verified against a real scratch store and a running dev server (see `05.1-07-SUMMARY.md`); lint/typecheck/test:unit (637/637) all clean. Remaining: Wave 2's 05.1-05 (status not confirmed by this session — may be in progress in a sibling worktree), Wave 3 (05.1-06), Wave 4 (05.1-08, crop-framing checkpoint), Wave 5 (05.1-09, full 50-template run + blocking review). Next: merge this branch, then `/gsd:execute-phase 05.1` to continue.

Phase: 05.2 (marketing-landing-page-redesign) — INSERTED, NOT YET PLANNED
Urgent decimal-phase insertion after Phase 5 (lands at 05.2 since 05.1 already exists), triggered by the user supplying a screenshot of Shopify's actual marketing/landing page (shopify.com "Start an online store for free" — hero, email capture, "Powering millions of businesses worldwide" + real client logos) and asking for EINORT's root page to reach the same professional quality. The current root page (`src/app/page.tsx`) is a deliberate placeholder — its own header comment already says "This is deliberately NOT a marketing site — that is future scope with its own phase," confirming this was always intended, not scope creep. Explicitly scoped to the root `/` page only (not signup/onboarding/dashboard). Known open questions for discuss-phase: honest trust-signal strategy (EINORT has no real merchant base yet, so Shopify's "millions of businesses" + client-logo pattern cannot be honestly replicated — needs a non-fabricated alternative), visual asset strategy (real template screenshot via Phase 05.1's new preview pipeline vs. illustration), primary language (French-first vs. English-first for the Cameroon market), section structure, and whether to extend the existing merchant-platform blue/gold/slate design reference or use a distinct treatment. Runs in parallel with Phase 05.1 — zero file overlap. Next: `/gsd:discuss-phase 05.2`.

Phase 05 (template-segment-expansion) itself: 22 plans across 6 waves, plan-checker PASSED (one non-blocking warning found and fixed pre-execution: a copy-namespace typing gap between plans 05-03/05-08, `e21fe3e`). UI-SPEC approved 6/6 after two revision cycles (a spacing violation, then a stray 2px margin) plus one deliberate content update incorporating a user-supplied Shopify theme-editor reference into the template-picker/switcher design. Waves 1-5 (05-01 through 05-21) all merged to master; lint/typecheck/test:unit/build all clean, and the full isolation suite (including 05-21's fix for the 6 fixtures deferred by 05-11) is green. Remaining in Phase 05 itself: Wave 6 (05-22, the final gate with 2 blocking human-verify checkpoints) — now blocked on Phase 05.1 completing first.
Phase 04 (theme-section-block-system-flagship-template) remains genuinely incomplete, deliberately, by the user's own choice (2026-09-03), mirroring the Phase 3 precedent below: all 16 plans (Waves 1-6) are merged and gate-verified, and Wave 7's Task 1 (the fully-automated gate: lint/typecheck/test:unit/build plus all six token-hygiene greps) is confirmed clean -- a real regression (04-11's industry-null redirect breaking 7 pre-Phase-4 isolation test fixtures, 36 tests) was found and fixed (`b9295d2`), then `test:full` came back 0/882 failing on a clean retry. But Wave 7's Tasks 2-3 -- the live-preview device pass and the Design-Distinctiveness stranger test, both blocking `checkpoint:human-verify` tasks requiring the user's direct involvement (and, for Task 3, a real third-party bystander) -- have NOT been run. The phase's own closing gates (Requirements Coverage Gate, Decision Coverage Gate, verifier + code-review + `phase.complete`) have also not run. `04-16-PLAN.md` is not ticked complete in ROADMAP.md. Once the user resumes this, finish Wave 7's Tasks 2-3, then run Phase 4's completion gate.
Phase 03 (product-catalog-order-payment-claim-state-machine) remains genuinely incomplete for the same kind of reason: all content (Waves 1-5, 03-01 through 03-15) plus phase-gate Tasks 1-2 are done (720/720 tests, nyquist_compliant: true), but 03-16's Task 3 — a blocking human-verify checkpoint requiring a real iPhone and Android device to confirm CHK-03's tap-to-dial USSD behavior — has not been completed. The user chose to move on rather than complete it first (2026-09-01); it remains open and 03-16 is still unticked in ROADMAP.md. Once approved, mark 03-16 complete and run Phase 3's own completion gate (verifier + code-review + phase.complete) — it has not yet run.
Last activity: 2026-09-07 -- Quick task 260907-a2v (remove Super Admin Panel header stub) merged and gated; quick task 260906-egn (dashboard shell rebuild + real Overview page) and Phase 5 Wave 4 (05-18..20) also merged and gated.

Progress: [█████████░] 92% plans (71/77 complete — Phase 3's 03-16, Phase 4's 04-16, Phase 5's Wave 6 (05-22, blocked on 05.1), Phase 05.1's remaining plans (05.1-05, 05.1-06, 05.1-08, 05.1-09 — 05.1-07 now done, this branch not yet merged), and Phase 05.2's plan count TBD after planning, still to execute)

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

| Phase 05.1 P07 | 50min | 2 tasks | 3 files |

## Quick Tasks Completed

| Quick ID | Description | Duration | Status |
|----------|-------------|----------|--------|
| 260823-gu4 | Retrofit merchant-platform UI tokens (blue/gold/slate) + register design reference | 24min | complete ✓ |
| 260831-tjj | Elevate the recommended tier on the onboarding plan-selection cards (floating badge, icon tiles, raised card, primary checkmarks) | ~15min | complete ✓ |
| 260831-urm | Display subscription-plan prices as "5,000 XAF" (comma-grouped, code suffix) on onboarding/plan and dashboard/plan | ~12min | complete ✓ |
| 260831-vd2 | Show the three plan tiers read-only on dashboard/plan's expired-trial branch (no trial-day framing, no switch buttons, no payment redirect -- deferred to Phase 6) | ~14min | complete ✓ |
| 260901-00j | Fix storefront navigation: every internal link used the internal /s/{slug} rewrite-target prefix that src/proxy.ts hard-404s on direct request, making the storefront unreachable past the entry page (real root cause of "no product/checkout page" report) -- 11 links corrected across 7 files plus a source-scanning regression guard; live-browser-verified through the full shopper journey (grid -> product -> cart -> checkout with WhatsApp/Mobile Money/COD visible) | ~35min | complete ✓ |
| 260901-6wq | Fix checkout success screen lost to a revalidation race: submitCheckout's revalidatePath call re-rendered the currently-open /checkout route as part of the Server Action response (Next 16 performs no path matching -- verified from installed source), tripping the empty-cart redirect guard against a cart that was empty because the order just succeeded, on all three payment channels -- deleted the call (header bubble doesn't need it: per-page StoreHeader, dynamic pages, staleTimes.dynamic default 0s), added a source-scanning regression guard against all four cache-invalidation APIs; live-browser-verified (Mobile Money order rendered correct confirmation with 6,500,000 FCFA amount and tracking link, no /cart redirect; empty-cart guard and header-bubble-to-0 regressions both still correct) | ~40min | complete ✓ |
| 260903-fsr | Reconcile stale "~20 template variations" figure in PROJECT.md/REQUIREMENTS.md/ROADMAP.md with the locked 50 (10 Starter/15 Business/25 Professional) split confirmed 2026-08-31 -- 6 call sites across 3 files corrected, unrelated "~20-module admin surface" mentions left alone | ~5min | complete ✓ |
| 260903-nxf | Add the EINORT platform brand mark (blue-to-purple gradient faceted "S") as favicon/icon/apple-icon via Next 16's App Router file convention, plus inline next/image renders in the dashboard sidebar header, /login, and /signup -- checkpoint (real-browser confirmation of favicon, sidebar, login, signup, and storefront-isolation-from-platform-branding) approved 2026-09-03 | ~12min | complete ✓ |
| 260903-ugl | Restyle the dashboard shell toward Shopify admin's structure (dark left icon-nav rail, top-bar search placeholder, new DashboardCard primitive for a future page retrofit) while keeping EINORT's own blue/gold/slate palette -- shell only, no page-content retrofit, no real search yet; caught and fixed a genuine nav-item contrast bug during checkpoint verification (color locked in one DOM level above where the new dark-scope CSS class was applied, a Tailwind 4 @theme inline indirection gotcha) that passed every automated gate; live-browser-verified on desktop rail, mobile off-canvas sheet, other dashboard pages, and storefront isolation | ~30min | complete ✓ |
| 260906-egn | Rebuild the merchant dashboard shell and Overview page against the owner-supplied design reference: 3-group sidebar nav (General/Commerce/Configuration), a real platform-aware Cmd/Ctrl+K search modal over Products and Orders (new tenant-keyed `searchLimiter`, cross-tenant isolation test), a 3-way Light/System/Dark theme toggle (`next-themes@0.4.6`, human-approved package gate) plus a decorative bell and a Super Admin Panel stub, and a real `/dashboard` Overview (revenue/active-orders/units/new-customers cards, a hand-rolled 7-bar `bg-chart-1` chart, recent orders) replacing the Phase-2 empty-state placeholder -- Active-orders card is a deliberate unwindowed backlog exception to the locked 7-day window, confirmed with the user after the plan-checker flagged it; fixed an incidental duplicate-Toaster bug found in the same file. Live-browser checkpoint approved 2026-09-07. Commit `1085181`. | ~2.5hr | complete ✓ |
| 260907-a2v | Remove the Super Admin Panel header button entirely (added unconditionally by 260906-egn as a stub linking to /admin, which doesn't exist yet) -- the user flagged that showing it to every merchant is misleading since there's no admin-role concept to gate it on yet; real deletion (no dead code/hidden flag), deferred to Phase 6's real admin auth + role-based visibility. Commit `11667f9`. | ~10min | complete ✓ |

*Updated after each plan completion*
| Phase 02 P06 | 13min | 3 tasks | 3 files |

## Accumulated Context

### Roadmap Evolution

- Phase 05.1 inserted after Phase 5: Template Preview Rendering & Picker Redesign: replace zero-byte CSS-wireframe template thumbnails with real rendered screenshot previews for all 50 templates, and redesign the shared TemplatePicker/TemplateTile grid to Shopify-Discover-Themes-quality layout. Must land before Phase 5's Wave 6 (05-22), which builds a 50-thumbnail contact sheet using this same component for the design-distinctiveness stranger test. (URGENT)
- Phase 05.2 inserted after Phase 5: Marketing Landing Page Redesign: replace the bare-bones root page (src/app/page.tsx, previously documented as deliberately deferred marketing-site scope) with a real, professional public landing page for EINORT-Commerce, modeled on Shopify's own marketing site quality bar -- deep research, real copywriting, honest (non-fabricated) trust signals, and a full UI-SPEC. Runs in parallel with Phase 05.1's remaining execution -- zero file overlap. (URGENT)

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Multi-tenant foundations (Phase 1) and dashboard-session tenant resolution (TEN-04, deferred to Phase 2) are split because session-based resolution has no dashboard/auth to resolve against until Phase 2 exists.
- Roadmap: Full onboarding (ONB-02/03/04) deferred to Phase 4 alongside the theme/template system, since a "live, branded storefront" cannot exist until the flagship template and Theme→Page→Section→Block system are built — Phase 1 only covers bare signup + subdomain provisioning.
- [Phase 02-06]: beforeAddMember omitted (verified against crud-members.mjs/crud-org.mjs that membershipLimit already gates add-member and org creation never calls membershipLimit)
- [Phase 02-06]: beforeUpdateOrganization refuses any incoming slug rather than validating it, pending Phase 4's real rename flow (StoreSlugHistory, invalidateTenantHost)
- [Phase 02-06]: beforeDeleteOrganization refuses unconditionally; remove-member/update-member-role/leave left deliberately ungated (T-02-37, accepted)
- [Phase 05.1-07]: Deferred the r2.ts dynamic import inside main(), called after the cheaper guards, to avoid @/env's createEnv() throwing before the script's own .env.local/.env loading loop runs — ES module static imports evaluate fully before an importing module's own top-level statements run, regardless of textual position, so a static import of r2.ts (which imports @/env) always crashed before the env-loading loop could run

### Pending Todos

None yet.

### Blockers/Concerns

- ~~Phase 3: MTN MoMo / Orange Money USSD merchant-code strings need re-verification~~ — **Resolved 2026-08-23** by `03-RESEARCH.md`'s "Payment Rails: the D-15 Blocker, Resolved" section, sourced directly from MTN Cameroon's and Orange Cameroun's own official documentation (HIGH confidence). Neither operator publishes a one-shot parametrized P2P string; both require an operator-issued merchant code for a parametrized tap-to-dial link. Manual-copy ships unconditionally as the floor regardless of merchant-code availability.
- Phase 4 (Theme/Section/Block System): design-distinctiveness has no objective completion signal — the side-by-side "would a stranger think these are the same product" check must be built into this phase's definition of done explicitly.
- Phase 2 (Merchant Auth, Entitlements & Trial): automated decision-coverage gate reported 0/13 CONTEXT.md decisions (D-01–D-13) cited in plan `must_haves`/`truths` frontmatter — overridden and proceeded to execute-phase on 2026-08-17. The plan-checker's independent semantic review confirmed all 13 decisions have implementing tasks; manual grep confirmed D-04–D-09/10, D-12 are cited by ID in task `<action>` bodies (just not in the scanned frontmatter fields). D-01/D-02/D-03 are only cited as a range ("D-01 through D-05"); D-11 and D-13 have no ID citation found anywhere. Re-verify these five during Phase 2's verify-phase pass. **Still open as of 2026-08-30** — a cross-phase GSD skill audit confirmed no `02-VERIFICATION.md` was ever produced (Phases 1 and 2 were merged wave-by-wave without ever reaching `gsd-execute-phase`'s own verifier/code-review/`phase.complete` gate). Queued to close via `gsd-execute-phase 2` as part of the post-Phase-3 retroactive audit pass (alongside `gsd-secure-phase` and `gsd-code-review --depth=deep` on Phases 1-3).

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-09-08T03:06:11.906Z
Stopped at: Completed 05.1-07-PLAN.md
Resume file: None
