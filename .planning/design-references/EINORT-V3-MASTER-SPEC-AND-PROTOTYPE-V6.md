# Master Product Specification V3 + Design-Reference Prototype (v6 snapshot) — Milestone v2.0 Source

Registration for the two documents driving milestone v2.0 (`docs(state): start milestone v2.0`). Read this before opening any v2.0 phase's `discuss-phase`/`ui-phase`/`research` step — it settles conflicts between this pair and what v1.0 already built, so a phase planner does not have to re-litigate them.

## What these are and where they came from

- **Master Product Specification V3** — `EINORT-Commerce_Master_Product_Specification_V3_Updated.docx`, supplied by the project owner from their Downloads folder, dated September 2026, "Status: CURRENT MASTER SPECIFICATION... Supersedes the previous Version 2.0 specification." Full text extracted 2026-09-13 (word/document.xml → plain text, 840 lines) for this registration; the docx itself was not committed to the repo (matches this directory's existing convention — every other file here is an analysis of a supplied artifact, not the artifact itself). If you need the literal document again, ask the project owner for the current-dated `EINORT-Commerce_Master_Product_Specification*.docx` in their Downloads — note there are multiple dated/versioned copies there (V1, V2, V3, "(1)" duplicates); V3 dated 2026-09-12/13 is the one this milestone is built from.
- **Design-reference prototype, v6 snapshot** — `einort-commerce (6).zip`, same Vite + React + Zustand + react-router-dom client-only prototype already registered in `EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md` (that file called it `Einort-Commerce-Front-End`, a private GitHub repo). This is a **later iteration of the same evolving reference**, not a new source — do not conflate it with the separate zinc/editorial DTC flagship-storefront reference (see that file's "Do-not-conflate" section, which still applies unchanged).
- **Confirmed unchanged from the earlier analysis:** `src/index.css` tokens are byte-identical to what's already documented — blue brand ramp, gold accent, zinc-hex "surface" scale (the doc calls it slate; the actual CSS values are Tailwind's zinc ramp), Plus Jakarta Sans + Outfit, `--radius: 0.75rem`. **The token retrofit (`260823-gu4`) and the dashboard shell rebuild (`260906-egn`) already cover this layer — do not re-do it as part of v2.0's "design system extraction" phase.** Confirm against the live app before assuming drift; don't re-derive from the reference blind.

## What's new in this v6 snapshot vs. the earlier registration

The earlier document's file inventory (`src/pages/`: Dashboard, Orders, Products, Inventory, Customers, Payments, Delivery, Analytics, Domains, Storefront, Settings, Auth, plus `admin/*`) is a subset of what v6 actually contains. Newly present, not previously catalogued:

- `src/pages/landing/Landing.tsx` (+ `components.tsx`/`components2-4.tsx`) — the public marketing/entry page. Compare against the real app's already-shipped `05.2` landing page rewrite before treating this as a fresh source; `05.2` has its own recent, human-approved design (see `STATE.md` Phase 05.2 history) and may already be closer to "done" than this reference.
- `src/pages/ThemeEditor.tsx` and `src/pages/storefront/TemplateMarketplace.tsx` — split out as distinct pages, matching Master Spec V3 §9 (current-theme page vs. a separate Template Marketplace that "opens in a new browser tab"). The real app's own recent `05.3` phase already built exactly this page split (`/dashboard/storefront` Themes page + `/dashboard/storefront/editor`) — treat `05.3`'s shipped structure as the base to restyle, not as something to re-architect from this reference.
- `src/pages/marketplace/Marketplace.tsx` + `src/data/mockMarketplace.ts` — the public Marketplace discovery page. Genuinely new; nothing in the real app corresponds to this yet.
- `src/pages/Marketing.tsx` + `src/pages/settings/BillingTab.tsx` — the merchant-side Marketplace Marketing activation/listing-management page, and a dedicated billing tab (Monthly/Yearly toggle, Amount Due Today, combined pricing per Master Spec V3 §15). Genuinely new.
- `src/pages/SuperAdmin.tsx` (top-level, distinct from the `src/pages/admin/*` ~17-page console) — **out of scope for v2.0** per the milestone decision to defer the full Platform Admin surface; noted here only so a future milestone knows it exists in the reference.
- `src/store/admin.ts` — Zustand store backing the admin console's mock state. Not relevant to v2.0 (admin deferred); relevant once a later milestone picks the admin surface back up.

## Master Spec V3 — numbers that changed vs. what v1.0 shipped

Full extracted text lives in this session's transcript / can be re-extracted from the docx (`word/document.xml`, strip tags, per the method used here) if needed again. The load-bearing numbers, already reconciled into `PROJECT.md`'s Key Decisions for v2.0:

| Item | v1.0 (shipped, tested) | Master Spec V3 | v2.0 decision |
|---|---|---|---|
| Storefront trial length | 10 days (`TRIAL_DAYS`, `resolve.ts`, ONB-05) | 30 days ("critical commercial rule") | **Change to 30 days** |
| Template tier split | 10 Starter / 15 Business / 25 Professional (50 total, 6 segments) | 15 Starter / 17 Business / 18 Professional (50 total, same 6 segments) | **Change to 15/17/18** |
| Live payment gateway | None — manual Mobile Money/Orange Money transfer + claim/verify + COD only | "At least one real payment integration" (Revised MVP Scope) | **Rejected again** — same ask an earlier spec (v4.0) made; manual-transfer-only stands |
| Platform Admin surface | Pilot-scoped Super Admin only | Full ~17-page admin console (merchants, stores, subscriptions, moderation, health, audit, feature flags, fraud...) | **Deferred out of v2.0** — revisit in a later milestone |
| Commerce engine | Custom Next.js/Prisma | Suggests evaluating Vendure/Medusa (§23) | **Not adopted** — same rejection as v4.0 made earlier; this milestone's own brief is explicit that architecture/backend/auth must be preserved, not replaced |

Everything else in Master Spec V3 not listed above (six segment categories, 50-template total, Marketplace-as-discovery-not-checkout rule, Marketplace Marketing plan capacities 10/25/50, listing lifecycle states, "never duplicate merchant products into Marketplace listings," Cameroon-first requirements) is **consistent with what v1.0 already built or intended** — no conflict, adopt as additional detail/confirmation rather than a change.

## How to use this pair going forward

- **Source-of-truth order for v2.0** (per the project owner's own framing when this milestone was scoped): Master Spec V3 for product/business rules → the real app for current architecture/data/auth/business logic → the design-reference prototype for visual/UX/interaction patterns → screenshots (none supplied this round) for verification only.
- **Never port the reference's code.** It is a client-only mock (Zustand local state, `src/data/mockData.ts`/`mockMarketplace.ts`, simulated auth, simulated checkout, `Math.random()` in places the real app's tests explicitly forbid). Read it for layout, component composition, and visual treatment; every data source, mutation, and auth check stays the real app's own.
- **For each v2.0 phase**, the phase's own `discuss-phase`/`ui-phase`/`research` step is where the actual reference-screen → real-screen → target-component mapping gets produced (with fresh context, per that phase's actual scope) — this document exists so that work starts from the right baseline instead of re-discovering the token layer is already done or re-litigating the three conflicts above.
