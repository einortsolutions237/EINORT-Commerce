---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Design Parity + Marketplace/Marketing Build-out
status: executing
stopped_at: Phase 6 Wave 7 Tasks 1-2 merged to master; Task 3 (blocking human checkpoint) awaiting the developer
last_updated: "2026-09-16T20:00:00.000Z"
last_activity: 2026-09-16 -- Phase 6 Wave 7 (06-17) Tasks 1-2 executed and merged
progress:
  total_phases: 18
  completed_phases: 6
  total_plans: 102
  completed_plans: 94
  percent: 35
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-16)

**Core value:** A merchant picks an industry, adds a logo and a few products, and within minutes has a storefront that looks like it cost them money to build.
**Current focus:** Phase 6 is one signed-off checkpoint away from complete. All 17 plan files' automatable scope is done and merged to master (06-01 through 06-17 Tasks 1-2). 06-17 Task 3 — two blocking `checkpoint:human-verify` manual verifications (admin-account bootstrap correctness against a real account, a full two-session merchant↔platform thread round trip) — is the only thing left, and it requires the developer directly; no agent can complete it. Phase 7 (3 plans, 3 waves) is fully planned and verified, queued to execute once Phase 6's checkpoint is signed off.

## Current Position

Phase: 6 (Merchant Dashboard & Platform Admin) — EXECUTING, blocked on the developer
Plan: Wave 7 (06-17) Tasks 1-2 merged to master; Task 3 (blocking human checkpoint) is the only remaining work in the entire phase
Status: Executing Phase 6 — awaiting developer sign-off on 06-VALIDATION.md § Manual-Only Verifications
Last activity: 2026-09-16 -- 06-17 Tasks 1-2 executed and merged: tests/unit/phase-06-requirement-coverage.test.ts (all eight Phase 6 requirements mapped to real artifacts, plus an ADM-04 scope-ceiling assertion walking the real src/app/admin/ tree), and four corrected project documents (CLAUDE.md's stale "resend unwired" claim, ROADMAP.md's "Plans: TBD", REQUIREMENTS.md marking ADM-04 complete with the two deferred items recorded — KD-V2-02 entitlement enforcement, R-5's low-stock constant — and 06-VALIDATION.md's TBD task IDs replaced with real ones). Full gate green on master: lint/typecheck/build/715 unit tests, test:full 1120/1125 on a clean solo run (5 known-pattern Neon pool-timeout flakes; an earlier contaminated run showing 153 failures was traced to two test:full processes racing on the same Neon test branch after a background subagent's stale process wasn't cleaned up — not a regression, confirmed by the clean rerun). Also fixed a real bug earlier this session: tests/isolation/claims.test.ts's ORD-02 confirmer scan used a bare `status: "CONFIRMED"` text match with no model context, false-positiving on 06-16's sanctioned SubscriptionPaymentClaim writer — rescoped to the PaymentClaim delegate call site specifically.

**Waiting on the developer for 06-17 Task 3** — see `.planning/phases/06-merchant-dashboard-platform-admin/06-VALIDATION.md` § Manual-Only Verifications and `06-17-PLAN.md`'s Task 3 for the full 17-step checklist (admin bootstrap + a two-browser-session merchant↔owner round trip covering messages, attachments in both formats, unread badges, suspend/restore, and the subscription-claim flow). Once signed off, Phase 6 closes and Phase 7 is ready to execute immediately.

**Phase 05.3 (Storefront Editor Page Split) — COMPLETE 2026-09-13.** All 4 plans (05.3-01 through 05.3-04) merged and gated: 664/664 unit tests, lint, typecheck, build all green; dead-route grep gate zero; D-B zero-new-capability constraint held; the six-behavior manual UI walkthrough approved by the user. EDIT-02/EDIT-03 marked complete in REQUIREMENTS.md.

**Milestone v2.0 phase sequence:** 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15
Phases 9 → 10 → 11 → 12 (Inventory → Delivery → Customers → Analytics) are a hard ordering: the first three each edit the same `placeOrder` transaction and must land in that order, and Analytics must follow Delivery because delivery fees redefine "revenue". Phase 13 → 14 is a hard ordering: the public Marketplace has nothing real to render or test against until merchant listings exist. Phase 15 (Custom Domains) is technically independent and last by deliberate risk-isolation choice.

## Performance Metrics

**Velocity:**

- Total plans completed (v2.0): 0
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
| Phase 05.2 P01 | ~20min | 3 tasks | 4 files |
| Phase 05.1 P08 | ~75min | 2 tasks | 3 files |
| Phase 05.3 P01 | ~35min | 3 tasks | 5 files |
| Phase 06-merchant-dashboard-platform-admin P10 | 55min | 2 tasks | 6 files |
| Phase 06-merchant-dashboard-platform-admin P11 | ~35min | 3 tasks | 22 files |
| Phase 06 P12 | 70min | 3 tasks | 13 files |

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
| 260908-bv1 | Restructure the storefront editor's "Change template" panel to match the Shopify Online Store admin pattern the user referenced: the merchant's currently-published template gets its own spotlight card at the top (zero interactive elements, no way to select it), and the switchable grid below excludes only that one tile -- tier-locked templates stay visible-but-dimmed, unchanged (no conflict with Phase 5's D-05 SORT-NEVER-FILTER). Onboarding's picker untouched. Extracted TemplateMedia (the D-05 image/wireframe-fallback branch) out of template-picker.tsx into its own file, reused by both the grid and the new CurrentTemplateCard; extended (not weakened) the picker's contract test to scan the new file. Full --full pipeline (discuss/research/plan/plan-check/execute), plan-checker PASSED with 2 cosmetic non-blocking warnings. Commit `959157b`. | ~35min | complete ✓ |

*Updated after each plan completion*
| Phase 02 P06 | 13min | 3 tasks | 3 files |

## Accumulated Context

### Roadmap Evolution

- Phase 05.1 inserted after Phase 5: Template Preview Rendering & Picker Redesign: replace zero-byte CSS-wireframe template thumbnails with real rendered screenshot previews for all 50 templates, and redesign the shared TemplatePicker/TemplateTile grid to Shopify-Discover-Themes-quality layout. Must land before Phase 5's Wave 6 (05-22), which builds a 50-thumbnail contact sheet using this same component for the design-distinctiveness stranger test. (URGENT)
- Phase 05.2 inserted after Phase 5: Marketing Landing Page Redesign: replace the bare-bones root page (src/app/page.tsx, previously documented as deliberately deferred marketing-site scope) with a real, professional public landing page for EINORT-Commerce, modeled on Shopify's own marketing site quality bar -- deep research, real copywriting, honest (non-fabricated) trust signals, and a full UI-SPEC. Ran in parallel with Phase 05.1's remaining execution -- zero file overlap. Completed 2026-09-08. (URGENT)
- Phase 05.3 inserted after Phase 5 (and after 05.2 in document order): Storefront Editor Page Split: split the single-screen storefront editor into two separate pages (a Themes page for browsing/switching templates, a full-screen Editor page for section/block editing), matching the navigational separation in Shopify's own admin. Layout/structure only -- no new capabilities (Header/Template/Footer grouping, add/remove sections, and undo/redo all explicitly deferred to a future phase). Runs in parallel with Phase 05.1's Wave 5. (URGENT)
- **2026-09-13 — Milestone v2.0 roadmapped (Phases 6-15).** Numbering continues from v1.0 rather than resetting. **Phase 6 was reconciled, not renumbered:** it was defined and requirement-mapped during v1.0 (SUB-03, DASH-01/02, ADM-01..05) but never planned or executed, and it is exactly the foundation v2.0 needs — the merchant dashboard shell every new v2.0 surface plugs into, the pilot-scoped Super Admin that MMKT-06's moderation page lives inside, and the ADM-05 support thread that is the only merchant↔platform notification channel that exists. It keeps its number, its requirements, and its success criteria, and runs first in v2.0. New v2.0 phases start at Phase 7. Nine new phases: 7 (Trial & Template-Tier Business Rules), 8 (Design System & Visual Migration), 9 (Inventory), 10 (Delivery), 11 (Customers), 12 (Analytics), 13 (Marketplace Marketing), 14 (Marketplace), 15 (Custom Domains). Ordering follows the research's dependency analysis exactly; the money-path trio (9-11) and the Marketing→Marketplace pair (13-14) are hard orderings, and Domains is last by deliberate risk isolation.
- **2026-09-13 — DSGN-01..03 given their own early phase (8) rather than being threaded through each later phase's UI work.** The component layer is a dependency of six phases that each build new dashboard surfaces; threading it means the first of those invents the primitives and the rest inherit half-formed conventions. DSGN-03's "new surface" half cannot finish in Phase 8 (those surfaces don't exist yet) and is carried as a standing phase-gate obligation into Phases 9-15.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Multi-tenant foundations (Phase 1) and dashboard-session tenant resolution (TEN-04, deferred to Phase 2) are split because session-based resolution has no dashboard/auth to resolve against until Phase 2 exists.
- Roadmap: Full onboarding (ONB-02/03/04) deferred to Phase 4 alongside the theme/template system, since a "live, branded storefront" cannot exist until the flagship template and Theme→Page→Section→Block system are built — Phase 1 only covers bare signup + subdomain provisioning.
- [Phase 02-06]: beforeAddMember omitted (verified against crud-members.mjs/crud-org.mjs that membershipLimit already gates add-member and org creation never calls membershipLimit)
- [Phase 02-06]: beforeUpdateOrganization refuses any incoming slug rather than validating it, pending Phase 4's real rename flow (StoreSlugHistory, invalidateTenantHost)
- [Phase 02-06]: beforeDeleteOrganization refuses unconditionally; remove-member/update-member-role/leave left deliberately ungated (T-02-37, accepted)
- [Phase 05.1-07]: Deferred the r2.ts dynamic import inside main(), called after the cheaper guards, to avoid @/env's createEnv() throwing before the script's own .env.local/.env loading loop runs — ES module static imports evaluate fully before an importing module's own top-level statements run, regardless of textual position, so a static import of r2.ts (which imports @/env) always crashed before the env-loading loop could run
- [Phase 05.2-01]: Reused strings.signup.loginLink verbatim for the final-CTA secondary link instead of declaring a duplicate string in marketing.ts, per the UI-SPEC checker's non-blocking nit
- [Phase 05.2-01]: Hero image slot resolves TEMPLATE_PREVIEWS['flagship-fashion'] server-side; renders copy-only today (manifest ships empty) with no placeholder ever shipped, auto-upgrading once 05.1-09 lands
- [v2.0 roadmap]: Phase 11 (Customers) adds **no shopper account, login, or password-reset surface** — checkout stays guest-only, `Customer` is an index over orders, and `Order`'s snapshot identity columns stay authoritative. Recorded explicitly because the feature being *named* "Customers" is what makes people build it anyway (PITFALLS.md Pitfall 8).
- [v2.0 roadmap]: MMKT-03/04/06 **supersede** the research's recommendation to omit `PENDING_REVIEW`/`REJECTED` from the listing lifecycle. The research assumed no moderator surface would exist; MMKT-06 creates one inside Phase 6's pilot-scoped Super Admin, which lands before Phase 13. Build the full lifecycle — do not "correct" the enum back to four members on the strength of ARCHITECTURE.md Anti-Pattern 6.
- [Phase 06-merchant-dashboard-platform-admin]: 06-10: /admin/claims Status chip reuses OrderStateChip against the order's live channel/state (not a new ClaimStatus chip) -- required adding orderChannel/orderState to AdminClaimRow, and keeps the 5-use --gold-accent budget intact
- [Phase 06-merchant-dashboard-platform-admin]: 06-10: merchant-side RejectDialog (dashboard/claims/reject-dialog.tsx) reused directly on /admin/claims, not recomposed -- verified genuinely surface-agnostic (no tenant context, no merchant-only action) before importing
- [Phase 06-merchant-dashboard-platform-admin]: 06-11: thread-finalize route serves the merchant door only -- the admin door's mint half exists (requestAdminThreadAttachmentUpload) per Task 1's acceptance criteria but is inert until 06-12/06-15 build the consuming admin UI and their own admin-authenticated finalize route, matching finalize/route.ts's existing precedent of deferring the claims namespace to its own file rather than a branch
- [Phase 06-merchant-dashboard-platform-admin]: 06-11: message-bubble.tsx cannot statically import anything from src/server/images/** (server-only) because it is reachable from composer.tsx's client tree -- the resolved attachment URL is threaded down as a resolveAttachmentUrl closure prop from message-list.tsx (a server component) instead; verified empirically via a clean npm run build
- [Phase 06-merchant-dashboard-platform-admin]: 06-12: composer.tsx (06-09) had no viewer prop and hardcoded merchant-only Server Actions at mint/finalize/send -- extended with viewer/tenantId props (default MERCHANT) rather than forking a second composer, and built the admin-authenticated finalize route (admin-thread-finalize/route.ts) thread-finalize/route.ts's own header had already deferred to this plan by name
- [Phase 06-merchant-dashboard-platform-admin]: 06-12: ADM-05 left Pending (not Complete) in REQUIREMENTS.md despite the two-way thread loop landing -- SUB-03's own claim-card surface (06-15/06-16) is still outstanding, per explicit orchestrator instruction not to overclaim

### Pending Todos

- **KD-V2-01 — `marketplaceDb` fourth data-access client.** Unresolved. Must be decided and built at the **start of Phase 13** (not deferred to Phase 14), because the `MarketplaceListing` schema's shape depends on how listings will later be read. The public marketplace is the codebase's first cross-tenant read with no tenant identity at all, and none of the three existing DB clients can legally serve it. The wrong shortcut — widening `adminDb`'s ESLint fence — is the milestone's #1 flagged risk. Resolve via `/gsd:plan-phase 13 --research-phase`. Full write-up in ROADMAP.md § Key Decisions Pending Resolution.
- **KD-V2-02 — second-subscription entitlement model shape.** Unresolved. Must be decided **before Phase 13's schema design**, not during it. Dedicated `MarketplaceSubscription` model vs. a generalized `Subscription` table. Whichever wins changes `resolveEntitlements`'s signature, which touches `merchantAction`, `requireMerchantContext`, and every entitlement-gated Server Action in the codebase — named by both FEATURES.md and ARCHITECTURE.md as the milestone's single largest hidden cost. Coupled sub-decision: MMKT-07 needs a merchant with a lapsed Storefront plan to still be able to retract public listings, which today's `merchantAction({mode:"write"})` gate blocks. Resolve via `/gsd:plan-phase 13 --research-phase`.
- Confirm before Phase 15 is planned in detail: the hosting plan tier (custom-domain cap and cron frequency ceiling), and whether `einort.com`'s apex is already on the provider's nameservers — wildcard `*.einort.com` TLS requires it, and if it isn't already true the existing subdomain storefronts have a latent infrastructure gap independent of custom domains.
- Decide once, before Phase 12: which `Order` states count as earned revenue and whether `unitsSold` is filtered the same way (ANLY-02). The existing `overviewMetrics` code is already inconsistent on this. The answer must be applied to Overview, Analytics, and Customers' "total spent" simultaneously.

### Blockers/Concerns

- Phase 7 (Trial & Template-Tier Business Rules): the automated `check.decision-coverage-plan` gate reported 2/4 decisions (D-04, D-05, trial-retroactivity) not cited by ID in plan frontmatter — same known false-positive pattern as Phase 6/Phase 2 below. Plan-checker's independent review confirmed "D-04/D-05 (zero-migration, derive-never-stamp) are implemented and explicitly documented as an accepted, not overlooked, consequence in 07-01"; spot-checked directly, both terms present in `07-01-PLAN.md`. Overridden 2026-09-13.

- Phase 6 (Merchant Dashboard & Platform Admin): the automated `check.decision-coverage-plan` gate reported only 9/22 CONTEXT.md decisions (D-01..D-22) cited by ID in plan frontmatter — same false-positive pattern already documented for Phase 2 below (the gate only greps for literal `D-NN:` strings in specific fields, not semantic coverage). The plan-checker's independent full-content review explicitly confirmed all 22 decisions map to an implementing task; spot-checked 3 of the 13 flagged-uncovered items directly (D-01's separate `/admin` route appears in 5 plans, D-14's suspend-confirm-with-required-reason in 3 plans, D-22's PDF attachment support in 4 plans) — all genuinely implemented. Overridden and proceeded to execute-phase readiness 2026-09-13. Re-verify formally during Phase 6's verify-phase pass if this pattern recurs.

- ~~Phase 3: MTN MoMo / Orange Money USSD merchant-code strings need re-verification~~ — **Resolved 2026-08-23** by `03-RESEARCH.md`'s "Payment Rails: the D-15 Blocker, Resolved" section, sourced directly from MTN Cameroon's and Orange Cameroun's own official documentation (HIGH confidence). Neither operator publishes a one-shot parametrized P2P string; both require an operator-issued merchant code for a parametrized tap-to-dial link. Manual-copy ships unconditionally as the floor regardless of merchant-code availability.
- Phase 4 (Theme/Section/Block System): design-distinctiveness has no objective completion signal — the side-by-side "would a stranger think these are the same product" check must be built into this phase's definition of done explicitly.
- Phase 2 (Merchant Auth, Entitlements & Trial): automated decision-coverage gate reported 0/13 CONTEXT.md decisions (D-01–D-13) cited in plan `must_haves`/`truths` frontmatter — overridden and proceeded to execute-phase on 2026-08-17. The plan-checker's independent semantic review confirmed all 13 decisions have implementing tasks; manual grep confirmed D-04–D-09/10, D-12 are cited by ID in task `<action>` bodies (just not in the scanned frontmatter fields). D-01/D-02/D-03 are only cited as a range ("D-01 through D-05"); D-11 and D-13 have no ID citation found anywhere. Re-verify these five during Phase 2's verify-phase pass. **Still open as of 2026-08-30** — a cross-phase GSD skill audit confirmed no `02-VERIFICATION.md` was ever produced (Phases 1 and 2 were merged wave-by-wave without ever reaching `gsd-execute-phase`'s own verifier/code-review/`phase.complete` gate). Queued to close via `gsd-execute-phase 2` as part of the post-Phase-3 retroactive audit pass (alongside `gsd-secure-phase` and `gsd-code-review --depth=deep` on Phases 1-3).
- **Isolation-suite runtime, v2.0.** The model-generic isolation suite already runs 22-27 minutes, and v2.0 registers roughly 5-7 new tenant-scoped models. Without the already-identified fix (per-`describe` reseed for read-only assertions, plus a `test:isolation:smoke` split for per-task gates), every v2.0 plan ends with a 40+ minute test gate. PITFALLS.md recommends scheduling this **before the first v2.0 schema phase** — i.e. as early work inside Phase 9, which is the first phase to register new models.
- **`TENANT_SCOPED_MODELS` insertion order is load-bearing.** It is in FK dependency order and `tests/setup/seed-two-tenants.ts` drives its batched `$transaction` off it. Every v2.0 phase adding a model must insert it in the right position and must never re-sort the array.
- **Known pre-existing environmental flakiness in `tests/isolation/stock-race.test.ts` and two `tests/isolation/claims.test.ts` cases**, confirmed 2026-09-14 during Phase 6 Wave 2's post-merge gate: `stock-race.test.ts`'s concurrent-transaction tests intermittently fail with a Neon `"Unable to start a transaction in the given time"` pool-timeout error — reproduced identically on unmodified master, so it is not a regression from any Wave 2 change. Two `claims.test.ts` tests (the heaviest fixtures — two full merchant sign-ups, and a reject→reopen→reject cycle) exceed Vitest's default 30s per-test timeout under this environment's real Neon round-trip latency; both pass cleanly with `--testTimeout=60000`. Neither needs a code fix; both are latency/pool-capacity characteristics of running isolation tests against a real remote Neon branch. Worth revisiting alongside the already-tracked "Isolation-suite runtime, v2.0" item below (a per-test timeout bump or connection-pool tuning, not a logic change).
- **A second, related environmental pattern confirmed 2026-09-16 during Phase 6 Wave 6's post-merge full-suite run: intermittent genuine Neon connection drops** (`"Can't reach database server"`, `"Connection terminated unexpectedly"`, `"expired transaction"`) scattered across whichever isolation test happens to be running at the time — not the same test twice across reruns, and reproduced in files (`tenant-isolation.test.ts`) untouched by any recent plan. Two separate full-suite runs each showed a different, larger-than-usual set of failures (10-14 files) that shrank to 0-1 genuine failures on a targeted rerun of just the affected file. Root cause is the Neon branch's connection capacity/stability under this session's cumulative multi-hour test load, not application code. Do not re-diagnose this as a regression without first rerunning the specific failing file(s) alone.

## Deferred Items

Items acknowledged and carried forward from v1.0 (never formally closed via `/gsd:complete-milestone` — v2.0 started alongside these, not after them; phase numbering continues rather than resets, so these phase directories and their plan files remain in place, not archived):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Phase 03 (`03-16`) | Task 3 — blocking human-verify checkpoint requiring a real iPhone and Android device to confirm CHK-03's tap-to-dial USSD behavior. All other Phase 3 content (Waves 1-5, phase-gate Tasks 1-2, 720/720 tests) is done. | Open — user chose to move on 2026-09-01 | v1.0 → v2.0 transition, 2026-09-13 |
| Phase 04 (`04-16`) | Wave 7 Tasks 2-3 — live-preview device pass and the Design-Distinctiveness stranger test, both blocking `checkpoint:human-verify` tasks. Wave 7 Task 1 (fully-automated gate) is confirmed clean. Phase's own closing gates (Requirements/Decision Coverage, verifier, code-review, `phase.complete`) have not run. | Open — user chose to move on, deliberately, mirroring Phase 3 | v1.0 → v2.0 transition, 2026-09-13 |
| Phase 05.3 (`05.3-04`) | Task 2 — blocking `checkpoint:human-verify` gate, 6 manual UI behaviors. | **Resolved 2026-09-13** — user approved all 6 checks ("All 6 check points good."). Phase 05.3 is closed; EDIT-02/EDIT-03 marked complete. | v1.0 → v2.0 transition, 2026-09-13 |
| Phase 02 | No `02-VERIFICATION.md` was ever produced — Phases 1-2 were merged wave-by-wave without reaching `gsd-execute-phase`'s own verifier/code-review/`phase.complete` gate. Plan-checker independently confirmed all 13 CONTEXT.md decisions have implementing tasks despite the frontmatter-citation gate reporting 0/13. | Open, tracked since 2026-08-30 | v1.0 → v2.0 transition, 2026-09-13 |
| Phase 05 (`05-22`) | Phase gate — the 50-template contact sheet and the six adversarial-pair stranger tests. Note that Phase 7 re-tiers all 50 templates (TMPL-04, 15/17/18); the contact sheet itself is tier-independent, but the picker screenshots it may be compared against are not. | Open | v1.0 → v2.0 transition, 2026-09-13 |

## Session Continuity

Last session: 2026-09-16T20:00:00.000Z
Stopped at: Phase 6 Wave 7 Tasks 1-2 merged to master; Task 3 (the blocking human checkpoint) is all that remains in the phase
Resume file: .planning/phases/06-merchant-dashboard-platform-admin/06-VALIDATION.md § Manual-Only Verifications, and 06-17-PLAN.md's Task 3
Next command: run the 17-step manual checklist with the developer, record results in 06-VALIDATION.md, then close Phase 6 and proceed to `/gsd:execute-phase 7`
