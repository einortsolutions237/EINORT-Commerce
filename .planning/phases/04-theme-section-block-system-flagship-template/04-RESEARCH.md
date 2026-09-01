# Phase 4: Theme/Section/Block System & Flagship Template - Research

**Researched:** 2026-09-01
**Domain:** Storefront-builder content modelling (Theme→Page→Section→Block), live WYSIWYG editing in Next.js 16 App Router, brand-token theming, onboarding branding capture
**Confidence:** HIGH on everything grounded in this codebase and in installed package source; MEDIUM on the two genuinely open design calls flagged in *Open Questions*

---

## Summary

This phase has three technically distinct problems wearing one name. The first is a **data-modelling** problem: what shape stores "which sections, in what order, with what settings" per tenant, with a draft/published split that can never show a customer a half-published store. The second is a **live-preview** problem: how a dashboard-side editor renders the *actual* storefront components with as-you-type fidelity when the storefront lives on a different hostname behind a proxy that hard-404s the internal route. The third is a **craft** problem: building one fashion/apparel template that genuinely looks expensive, in a codebase with a zero-tolerance lint gate, two source-scanning design guards, and no animation library.

The research resolves all three concretely. The **data model** should be a *document per surface* — one `StorefrontPage` row per (tenant, pageType) holding the whole ordered section tree as validated JSONB in a `draft`/`published` column pair, plus a `StorefrontTheme` row for accents/logo/template. This is not a shortcut: it is the only shape that makes publish a **single-row write** (atomic by construction), and it is the only shape that gets end-to-end TypeScript safety for free via `z.discriminatedUnion`, because `$queryRaw`/`$executeRaw` are banned repo-wide and Prisma cannot express `SET published = draft` across rows in one statement. `.planning/research/ARCHITECTURE.md` Pattern 3 explicitly sanctions this as the acceptable variant; every relational benefit it cites (partial saves, per-row reorder writes) is needed only if the editor writes per-field to the server, and **D-07 says it does not** — the draft lives in memory and is saved wholesale.

The **live preview** should be a cross-origin `<iframe>` pointing at a new public `https://{slug}.{root}/preview` route under `src/app/s/[slug]/preview/`, synchronised by `postMessage`. This is not a preference; it is close to forced. `tests/unit/surface-token-isolation.test.ts` ban #4 forbids `data-surface="storefront"` outside `src/app/s/**` and D-12 forbids weakening that test, so the preview cannot be an inline dashboard subtree. `src/proxy.ts` hard-404s `/s/*` from the apex, so the iframe must target the tenant subdomain. An iframe additionally gets a real viewport (so `md:` breakpoints are correct and a device-size toggle is free) and is exactly how Shopify's theme editor works. Because the editor pushes the draft document over `postMessage` and the iframe renders it client-side from the same registry components, **there is zero server round-trip per keystroke** — which is what D-07 actually asks for and is a stronger guarantee than Shopify's own server-side section re-render.

**Primary recommendation:** Ship a code registry (`TEMPLATES` / `SECTION_TYPES`) + a Zod `z.discriminatedUnion("type", …)` page document, persisted as a `draft`/`published` JSONB pair on one row per page; render the storefront from `published` and the editor's iframe from an in-memory draft delivered by `postMessage`; add **zero new npm packages**.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Onboarding: Industry & the One Built Template**

- **D-01:** Every merchant's storefront uses the fashion/apparel flagship's layout/components this phase, regardless of the industry they select during onboarding — their own products/branding populate it, but the template itself doesn't vary by industry yet. Industry is captured now purely so Phase 5's real segment templates have data to key off later, with no re-onboarding needed.
- **D-02:** The full 6-segment industry list from PROJECT.md is captured at onboarding now — fashion/apparel, electronics, beauty/cosmetics, grocery/food, furniture/home, general retail — not a placeholder "Fashion / Other" pair. Avoids a Phase 5 backfill migration to re-ask or infer the real segment.
- **D-03:** When Phase 5 later ships a real template for a merchant's actual segment, their storefront does **not** auto-migrate to it — it stays on the flagship until the merchant manually switches. Auto-swapping risks silently discarding EDIT-02 customization work the merchant has already done. **Data-model implication:** the schema needs an explicit "which template/theme this tenant is instantiated from" field, separate from and independent of the `industry`/segment field — industry alone must not determine which template renders.
- **D-04:** The flagship's default block content (hero tagline, section headings, etc.) uses generic, industry-neutral copy (e.g. "New Arrivals," not "The Autumn Collection") rather than fashion-flavored copy. Every merchant edits this via the block editor before publishing for real (EDIT-02), so the default only needs to not look obviously wrong for a non-fashion merchant previewing their new store.

**Editor Scope**

- **D-05:** The merchant can reorder and edit the flagship's existing sections (content, settings, images, colors per block) but **cannot add or remove whole sections** this phase. The section list itself is fixed by the template. Keeps every storefront within the "looks professionally designed" guardrail — an empty or duplicated section is a common way a DIY builder starts looking amateurish, and this is a much smaller editor + registry surface for the timeline.
- **D-06:** Block editing is **content-only** — text, images, colors, links/button labels via a form-like panel per block type — with no layout-variant switching (e.g. no choosing image-left vs. image-right vs. full-bleed for a Hero). Matches the code-registry pattern already researched in `.planning/research/ARCHITECTURE.md` (Pattern 3): each block type is one component + one settings schema. A layout variant would need to be its own registered block type, which is out of scope this phase.
- **D-07:** The live-preview editor updates **instantly, as the merchant types or picks a color** — not a save-then-refresh model. This is the actual "looks like it cost them money" product differentiator EDIT-02 is describing, not a settings form with a preview button.
- **D-08:** Edits save as a **draft**; the live storefront customers see is untouched until the merchant clicks **Publish**. Standard site-builder pattern (Shopify, Squarespace) and consistent with "live-preview" implying preview and live are different states. **Data-model implication:** the Theme/Page/Section/Block instance data needs a draft/published split (e.g. a published snapshot plus an editable draft, or a `status` per revision) — the planner should confirm the exact shape.

**Brand Color vs. the Zinc-Monochrome Look**

- **D-09:** Merchant brand colors apply **accent-only** — they drive CTA buttons, links, and active states, while backgrounds, text, and layout stay zinc-monochrome. Protects the portfolio-quality guardrail: a merchant picking a clashing color combo can only tint the storefront, never break its professional structure. This mirrors how the DTC reference itself uses zinc-950/zinc-50 as the base with sparse accent use (see project memory `project_einort_flagship_visual_reference`).
- **D-10:** Onboarding captures **two** brand colors — primary and secondary accent — not just one.
- **D-11:** The color picker runs a contrast check (e.g. a WCAG-style ratio against the zinc surface the accent color will sit on) and shows an inline warning for low contrast, but does **not** block the merchant from proceeding with their choice anyway. Matches this codebase's existing manual-trust pattern for merchant-entered data (Phase 3 D-17: payment numbers accepted as-entered, no verification gate).
- **D-12:** Brand accent colors are **storefront-only** (`src/app/s/[slug]/**`) and must never appear in the merchant dashboard, including the editor's own dashboard-side chrome. The dashboard keeps its fixed blue/gold/slate palette regardless of what any merchant picks. This preserves the existing, deliberate two-design-system separation already enforced by `tests/unit/surface-token-isolation.test.ts` — do not weaken or add an exception to that test for the editor UI.

**Editor Tier Gating (EDIT-03)**

- **D-13:** The editor is **view-only on Starter** (can preview the live-editing experience, cannot publish changes) and **full edit on Business/Professional**. Matches how the plan-tier system already gates elsewhere in this project (limits, not full feature removal) and gives Starter merchants a concrete, visible reason to upgrade rather than a locked/hidden feature they can't evaluate.
- **D-14:** Business and Professional are **identical** for editor purposes — this is a single boolean gate (paid tier vs. Starter), not a 3-way branch. Professional's actual differentiation comes from other limits (product cap, member seats per `pricing-reference.md`), not editor capability.
- **D-15:** During the 10-day full-feature trial, **every** merchant gets full editor access regardless of which tier they'll eventually land on — the view-only Starter restriction only takes effect once the trial ends and Starter is the merchant's actual (non-trial) tier. Reuses Phase 2's existing entitlements pattern where trial state overrides tier limits (`.planning/phases/02-merchant-auth-entitlements-trial/02-CONTEXT.md` D-08: trial merchants get full functionality; only an *expired* trial goes read-only).

### Claude's Discretion

- Exact list and count of block types within each section (e.g. how many distinct block types a "Hero" or "Product Grid" section is built from) — follow whatever the planner/research determines is cleanest given D-06's content-only, code-registry pattern.
- The specific WCAG contrast-ratio threshold and calculation used for D-11's warning.
- Exact draft/publish UI mechanics (e.g. whether there's a "discard draft" / "revert to published" control) beyond the core draft-then-publish requirement in D-08.
- Exact onboarding step ordering/UI for capturing industry, logo, and the two brand colors relative to the existing `create-store` and `plan` onboarding steps already built in Phases 1–2.
- Specific segment labels/icons shown in the industry picker for the 6 segments in D-02.
- Exact Zod settings-schema shape per block type — follow the code-registry pattern from `.planning/research/ARCHITECTURE.md` Pattern 3.

### Deferred Ideas (OUT OF SCOPE)

- Segment-specific templates for the other 5 industries (electronics, beauty/cosmetics, grocery/food, furniture/home, general retail) — explicitly Phase 5 scope, not this phase (TMPL-03/04-territory).
- Add/remove sections in the editor, and per-block layout-variant switching — considered and rejected for this phase (D-05, D-06).
- A curated/restricted accent-color swatch picker instead of a free color picker — considered and rejected in favor of a contrast warning (D-11).
- Auto-migrating a merchant to their real segment template once Phase 5 ships it — considered and rejected (D-03).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **ONB-02** | Onboarding captures business name, industry/segment, logo upload, and brand colors | Pattern 6 (onboarding step placement + `Organization.industry` as a Better Auth `input: false` additional field), Pattern 8 (colour capture + contrast) |
| **ONB-03** | Uploaded logos and product images pass through automatic enhancement/cropping | Pattern 7 — `IMAGE_PRESETS.logo` and `UploadKind = "logos"` already exist unused; the gap is the finalize route's hardcoded `kind: z.literal("products")` and the enhancement chain's product-photo bias |
| **ONB-04** | Completing onboarding produces a live, published storefront on an EINORT subdomain within minutes, pre-populated with the flagship template + merchant branding | Pattern 6 (seed-in-transaction) + Pattern 2 (`published` is written directly at seed time, so the store is live the instant onboarding returns) |
| **TMPL-01** | One fashion/apparel flagship template built to portfolio-quality standard, anchored on the zinc-monochrome DTC reference | Pattern 9 (section catalogue derived from the reference's own `StoreHome.tsx`), Pattern 10 (motion language reproduced with the already-installed `tw-animate-css`, no new dependency) |
| **TMPL-02** | The flagship's patterns (layout structure, section types, motion language, typography) form the pattern library other segment templates inherit | Pattern 3 (`SECTION_TYPES` registry keyed by `type`, `TEMPLATES` registry keyed by `templateKey`) + Pattern 10 (motion tokens declared once in `globals.css` under the storefront scope) |
| **EDIT-01** | Storefront content modelled as Theme → Page → Section → Block, types in code, instances per tenant | Pattern 1 (schema) + Pattern 3 (registry). The four levels map to: `TEMPLATES`/`StorefrontTheme` → `StorefrontPage.pageType` → `sections[]` → `sections[].blocks[]`, all validated by one discriminated union |
| **EDIT-02** | Merchants customize (reorder sections, edit block content/settings, swap images and colors) through a live-preview editor | Pattern 4 (iframe + `postMessage`), Pattern 5 (pure reducer for reorder/edit), Pattern 8 (colour swap) |
| **EDIT-03** | Editor access/capability gated by subscription tier, enforced server-side | Pattern 11 — `PlanLimits.storefrontEditor` + a trial-aware `canEditStorefront` computed in `resolveEntitlements`, asserted by `assertCanEditStorefront` inside `merchantAction` handlers |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Section/block **type** definitions (component + schema + defaults) | Build-time code (`src/server/theming/**` + `src/app/s/[slug]/sections/**`) | — | Pattern 3 / ARCHITECTURE.md Anti-Pattern 3: this is not a runtime-authorable CMS |
| Section/block **instance** data (order, settings) | Database (`StorefrontPage.draft` / `.published` JSONB) | — | Per-tenant, merchant-mutable, must survive a deploy |
| Draft→published promotion | API/Backend (Server Action, `scopedDb` transaction) | — | Never a client write; a half-published state must be unrepresentable |
| As-you-type preview rendering | Browser (iframe document, client React) | — | D-07 forbids a server round-trip per keystroke |
| Preview data bundle (products, categories, store name) | Frontend Server (`/preview` RSC on the tenant subdomain) | — | Already-public data, resolved from `Host`, no session needed |
| Editor chrome (panels, field forms, publish button) | Frontend Server + Browser (`(dashboard)` route group) | — | Session-derived tenant, blue/gold/slate palette only (D-12) |
| Brand accent → CSS custom properties | Frontend Server (storefront layout inline `style`) | Browser (preview overrides from draft) | Server-validated hex; the browser only ever re-applies an already-validated value |
| Logo bytes | CDN/Storage (Cloudflare R2) | API (presign + Sharp derive) | Existing pipeline, D-07 of Phase 3 |
| Industry / templateKey / accents persistence | Database (`Organization` + `StorefrontTheme`) | — | `industry` is business identity (platform table); theme is tenant-owned (`scopedDb`) |
| Tier gate | API/Backend (`resolveEntitlements` + `merchantAction`) | Browser (disabled controls, courtesy only) | Phase 2 precedent: the rendered UI is never the control |

---

## Project Constraints (from CLAUDE.md)

These are binding on every task in this phase. Several of them **directly constrain** the designs below and are the reason some otherwise-obvious approach is not recommended.

| Constraint | Consequence for Phase 4 |
|---|---|
| Tenant isolation is structural: `scopedDb` / `platformDb` / `adminDb`, never raw Prisma outside sanctioned zones | Every new tenant-owned model goes through `scopedDb` **and** must be registered in `TENANT_SCOPED_MODELS` **and** given a fixture in `tests/setup/seed-two-tenants.ts` (the seed throws otherwise — verified below) |
| `$queryRaw` / `$executeRaw` **banned repo-wide** (`no-restricted-syntax` in `eslint.config.mjs`) | **Decisive.** You cannot write `UPDATE … SET published_settings = draft_settings` across rows. Prisma's `updateMany` accepts literal values only, not column references. A row-per-section published/draft model therefore needs an N-row update loop; a document model needs one write |
| No hard deletes for merchant-owned catalog data (D-08 of Phase 3) | Discard-draft must *overwrite* the draft column, never delete rows. Reordering must never delete-and-recreate |
| All UI copy in `src/lib/strings.ts`, no inline prose literals | Section/block **default content** (D-04) and every editor field label belong in `strings`, not in the registry's `defaults` object as inline literals. Put defaults in `strings.flagship.*` and have the registry reference them |
| Sharp/image code must run Node runtime, never `runtime = "edge"` | The logo finalize path inherits this. Add nothing |
| Currency via `Intl.NumberFormat("fr-CM", …)` directly | Any price rendered inside a section component uses the existing storefront formatter, not a new one |
| `npm run lint --max-warnings=0` | A registry with an intentionally-unused export must use the `_`-prefix convention or be genuinely referenced |
| Never trust price, stock, tenantId, or payment/order status from the client | The editor's `saveDraft` payload carries settings only. It must never carry a tenantId, a product price, or a product id it then renders as authoritative — the preview reads products server-side from `scopedDb`/storefront queries |

Two **source-scanning contract tests** additionally gate this phase and are treated as constraints, not suggestions:

- `tests/unit/surface-token-isolation.test.ts` — bans 1–4 (see *Common Pitfalls* 1 and 2).
- `tests/unit/dashboard-nav.test.ts` — `REQUIRED_HREFS` is an exhaustive list of six dashboard destinations; adding the editor route means adding it **there and in `src/components/app-sidebar.tsx`, in the same commit**, with its label from `strings.dashboard.nav`.

---

## Standard Stack

### Core (already installed — no action)

| Library | Version | Purpose here | Why it's the answer |
|---------|---------|--------------|---------------------|
| `zod` | 4.4.3 | The section/block settings schemas, the page-document schema, and the `postMessage` payload validator | `z.discriminatedUnion("type", …)` is what makes the JSONB document end-to-end typed with **zero casts**; `z.infer` of the union *is* the TypeScript union |
| `@prisma/client` / `prisma` | 7.9.1 | `StorefrontTheme`, `StorefrontPage` | Prisma's `Json` scalar maps to PostgreSQL `jsonb` by default `[CITED: prisma.io/docs/orm/reference/prisma-schema-reference]` |
| `react` / `react-dom` | 19.2.8 | Editor state, iframe sync | `useReducer` + `useState` is sufficient; see *Don't Hand-Roll* |
| `next` | 16.3.1 | `/preview` route, Server Actions, `next/image` | — |
| `tailwindcss` + `tw-animate-css` | 4 / 1.4.0 | Layout + the flagship motion language | `tw-animate-css@1.4.0` ships `animate-in`, `fade-in`, `slide-in-from-bottom-*`, `delay-*`, `animation-duration-*`, `fill-mode-*` — verified by reading `node_modules/tw-animate-css/dist/tw-animate.css` `[VERIFIED: installed package source]` |
| `sharp` | 0.35.3 | Logo derive | `IMAGE_PRESETS.logo` already exists |
| `@aws-sdk/client-s3` + presigner | 3.1116.0 | Logo upload | `UploadKind = "logos"` already exists |
| `react-hook-form` + `@hookform/resolvers` | 7.85.0 / 5.9.0 | Onboarding branding form | Established pattern in `product-form.tsx`, `signup-form.tsx` |
| `@base-ui/react` (via shadcn) | 1.7.0 | Editor panel primitives | Existing `src/components/ui/**` |
| `lucide-react` | ^1.31.0 | Icons (industry picker, reorder arrows) | Existing |

### Supporting (new installs required)

**None.** This phase installs zero packages.

### Alternatives Considered

| Instead of | Could use | Why rejected |
|------------|-----------|--------------|
| CSS keyframes via `tw-animate-css` | `motion` (Framer Motion) — the reference zip's own choice (`motion/react`) | ~30–50 kB gzipped of JS on the first paint of a Douala-mobile storefront, to reproduce a fade-up + stagger that four already-installed utility classes express exactly. The reference's motion vocabulary is *entirely* `opacity` + `translateY` + `cubic-bezier(0.16, 1, 0.3, 1)` + 50 ms stagger — verified by reading `src/components/ui/Motion.tsx` from the zip. All four are CSS-expressible |
| Up/down reorder buttons | `@dnd-kit/*`, `react-beautiful-dnd`, HTML5 drag-and-drop | D-05 fixes the section list at ~6 entries. Drag-and-drop is a new dependency, is poor on touch, is an accessibility liability, and buys nothing over two buttons for a 6-item list. Up/down buttons are also trivially unit-testable as a pure reducer in the `node` test environment (there is no jsdom in this repo) |
| Hand-written WCAG luminance (≈20 lines) | `wcag-contrast`, `color`, `chroma-js`, `colord` | The formula is 8 lines of arithmetic from a W3C spec that has not changed since 2008. A dependency here is pure supply-chain surface for zero capability. See Pattern 8 |
| Relational `StorefrontSection` / `StorefrontBlock` rows | — | See Pattern 2. Documented as the fallback, not the primary |
| `next/headers` `draftMode()` for the draft/publish split | — | Draft Mode's *entire* function is bypassing Next's fetch/ISR/`use cache` caches `[CITED: node_modules/next/dist/docs/01-app/02-guides/draft-mode.md]`. This project's storefront reads are direct dynamic Prisma calls with no `fetch` cache and no `use cache`, so Draft Mode bypasses nothing that exists. Worse, `draft.enable()` sets the `__prerender_bypass` cookie on the **apex** response, and the storefront is a different host — the cookie would never be sent. Do not reach for it |

**Installation:**

```bash
# Intentionally empty — Phase 4 adds no dependencies.
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none)* | — | — | — | — | — | No external packages are installed this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none — no installs proposed.
**Packages flagged as suspicious [SUS]:** none.

The zero-install posture is deliberate and matches Phase 3's audit discipline. Every capability this phase needs is either already installed (verified against `package.json` and `node_modules`) or is fewer than 30 lines of arithmetic. If the planner later decides a motion library is required for TMPL-01's quality bar, that becomes a `checkpoint:human-verify` install task and must run the full legitimacy gate first — it is **not** pre-approved by this document.

---

## Architecture Patterns

### System Architecture Diagram

```
                       ┌──────────────────────────────────────────────┐
   MERCHANT (apex)     │  einort.com  —  session cookie, host-only    │
                       └──────────────────────────────────────────────┘
                                          │
   ┌──────────────────────────────────────┴───────────────────────────────────┐
   │  /onboarding/branding          /dashboard/storefront-editor              │
   │  ─────────────────────         ────────────────────────────              │
   │  industry (6 seg)              ┌────────────────┐   ┌──────────────────┐ │
   │  logo  ──► presign ──► R2      │ Editor panel   │   │  <iframe>        │ │
   │  2 accents + contrast          │ (blue/gold/    │   │  src = https://  │ │
   │        │                       │  slate ONLY)   │   │  {slug}.{root}/  │ │
   │        ▼                       │                │   │  preview         │ │
   │  saveBranding (Server Action)  │ useReducer ────┼──►│  postMessage     │ │
   │        │                       │  draft doc     │   │  (targetOrigin   │ │
   │        │                       │       │        │◄──┤   exact)         │ │
   │        │                       │  Save  Publish │   │  ready handshake │ │
   │        │                       └───┬────────┬───┘   └────────┬─────────┘ │
   └────────┼───────────────────────────┼────────┼────────────────┼───────────┘
            │                           │        │                │
            ▼                           ▼        ▼                │ renders the
   ┌────────────────────────────────────────────────────┐         │ SAME
   │  merchantAction( mode:"write" )                    │         │ SECTION_TYPES
   │   ├─ requireMerchantContext()  → tenantId, plan    │         │ components
   │   ├─ assertCanEditStorefront() → EDIT-03, D-13/15  │         │ client-side
   │   └─ zod parse → scopedDb(tenantId).$transaction   │         │
   └───────────────────┬────────────────────────────────┘         │
                       ▼                                          │
   ┌───────────────────────────────────────────┐                  │
   │  PostgreSQL                               │                  │
   │  storefront_theme  { templateKey,         │                  │
   │        logoKey, draftTokens, pubTokens }  │                  │
   │  storefront_page   { pageType,            │                  │
   │        draft jsonb, published jsonb }     │                  │
   │  organization      { industry, … }        │                  │
   └───────────────────┬───────────────────────┘                  │
                       │ published only                           │
   ┌───────────────────▼──────────────────────────────────────────┴───────────┐
   │  SHOPPER  —  {slug}.einort.com  (proxy rewrite → /s/{slug})              │
   │  layout.tsx  data-surface="storefront"  +  style={{ "--brand-accent" }}  │
   │       │                                                                  │
   │       ├─ /            renderPage(published)  → SECTION_TYPES[type]       │
   │       ├─ /p/[slug]    PDP        ─┐                                      │
   │       ├─ /cart        cart        ├─ FIXED routes; theme chrome only,    │
   │       ├─ /checkout    checkout    │  never section-editable (Pattern 12) │
   │       ├─ /order/[tok] tracking   ─┘                                      │
   │       └─ /preview     noindex, public data only, hydrates from           │
   │                        postMessage draft                                 │
   └──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── app/
│   ├── onboarding/
│   │   └── branding/                    # NEW — ONB-02/03: industry, logo, 2 accents
│   │       ├── page.tsx                 # RSC: session gate, redirect ladder
│   │       └── branding-form.tsx        # client island: picker + upload + contrast
│   ├── (dashboard)/dashboard/
│   │   └── storefront-editor/           # NEW — EDIT-02/03
│   │       ├── page.tsx                 # RSC: requireMerchantContext, load draft
│   │       ├── editor-shell.tsx         # client: reducer + iframe + panel
│   │       ├── section-list.tsx         # reorder (up/down), select
│   │       ├── settings-panel.tsx       # field descriptors → inputs
│   │       └── publish-bar.tsx          # Save / Publish / Discard + tier notice
│   ├── s/[slug]/
│   │   ├── layout.tsx                   # EXTEND — inject --brand-accent vars
│   │   ├── page.tsx                     # REPLACE body — renderPage(published)
│   │   ├── preview/                     # NEW — the iframe target
│   │   │   ├── page.tsx                 # RSC: public data bundle, noindex
│   │   │   └── preview-canvas.tsx       # client: postMessage receiver + render
│   │   ├── sections/                    # NEW — the flagship's components
│   │   │   ├── hero-section.tsx
│   │   │   ├── trust-bar-section.tsx
│   │   │   ├── product-grid-section.tsx
│   │   │   ├── editorial-split-section.tsx
│   │   │   ├── contact-section.tsx
│   │   │   └── section-renderer.tsx     # the ONE type→component switch
│   │   └── store-header.tsx / store-footer.tsx   # theme-driven chrome
│   └── api/upload/finalize/route.ts     # EXTEND — accept kind "logos"
├── server/
│   ├── theming/
│   │   ├── registry.ts                  # SECTION_TYPES, BLOCK_TYPES, TEMPLATES
│   │   ├── schema.ts                    # z.discriminatedUnion page document
│   │   ├── defaults.ts                  # flagship default document (D-04)
│   │   ├── queries.ts                   # server-only reads (published/draft)
│   │   └── actions.ts                   # "use server": saveDraft/publish/discard
│   ├── entitlements/{plans,resolve,assert}.ts   # EXTEND — storefrontEditor gate
│   └── images/pipeline.ts               # EXTEND — per-preset enhancement switch
└── lib/
    ├── contrast.ts                      # NEW — pure WCAG ratio, client-importable
    ├── editor/reducer.ts                # NEW — pure draft reducer (unit-testable)
    └── strings.ts                       # EXTEND — branding.*, editor.*, flagship.*
```

**Structure rationale.** `src/server/theming/` matches ARCHITECTURE.md's own suggested layout and this codebase's `src/server/<domain>/{actions,queries}.ts` convention. The **section components themselves live under `src/app/s/[slug]/sections/`, not under `src/server/`** — deliberately. They are client-renderable React components imported by both the storefront RSC tree and the preview client canvas; putting them under `src/server/**` would invite a `server-only` marker that breaks the preview. Placing them under `src/app/s/**` also means `tests/unit/surface-token-isolation.test.ts` ban #3 (no `font-heading`, no `gold-accent`, no `success`) scans them automatically, which is exactly the guard you want on a template's components.

`src/lib/contrast.ts` and `src/lib/editor/reducer.ts` are in `src/lib` because both must be importable from a client component **and** unit-testable in the `node` Vitest project with no DOM and no database.

---

### Pattern 1: The schema — two tables, one document each

**What:** Two new tenant-scoped Prisma models plus one new column on `Organization`.

```prisma
/// EDIT-01 / D-03. The tenant's theme instance: which template it is
/// instantiated from, its logo, and its brand tokens. ONE row per tenant.
///
/// `templateKey` is DELIBERATELY SEPARATE FROM `Organization.industry` (D-03).
/// Industry is what the merchant said their business is; templateKey is what
/// their storefront actually renders. Phase 5 ships real segment templates and
/// must NOT auto-migrate anyone — that is only expressible if the two are
/// independent columns, and it is why `templateKey` is not derived at read time.
model StorefrontTheme {
  id       String @id @default(cuid())
  tenantId String @unique

  /// A key into TEMPLATES in src/server/theming/registry.ts. Never a foreign
  /// key to a Theme table: template *types* are code (ARCHITECTURE.md
  /// Anti-Pattern 3), exactly like PLANS and IMAGE_PRESETS.
  templateKey String @default("flagship-fashion")

  /// The R2 derivative PREFIX (e.g. `tenants/{id}/logos/{uuid}`), matching
  /// ProductImage.storageKey's convention. NEVER a full URL, and never
  /// Better Auth's `organization.logo` column — see Pitfall 5.
  logoKey String?

  /// D-08. `{ primaryAccent, secondaryAccent }` as validated hex strings.
  /// Two columns, not two tables: publish is then one row write.
  draftTokens     Json
  publishedTokens Json

  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([tenantId])
  @@map("storefront_theme")
}

/// EDIT-01. One row per (tenant, page). `pageType` is "home" this phase;
/// the column exists so Phase 5 adds a row, not a migration.
model StorefrontPage {
  id       String @id @default(cuid())
  tenantId String
  pageType String

  /// The FULL ordered section tree, validated against pageDocumentSchema.
  /// jsonb by default on PostgreSQL (Prisma schema reference).
  draft     Json
  published Json?

  publishedAt    DateTime?
  draftUpdatedAt DateTime  @default(now())
  createdAt      DateTime  @default(now())

  @@unique([tenantId, pageType])
  @@index([tenantId, pageType])
  @@map("storefront_page")
}
```

```prisma
model Organization {
  // … existing columns …

  /// ONB-02 / D-02. One of the six INDUSTRY_SEGMENTS in
  /// src/server/theming/registry.ts. NULL means onboarding's branding step has
  /// not been completed yet — the same "third state IS the flow" reasoning that
  /// makes planTier nullable. `input: false` in the Better Auth organization
  /// additionalFields, so no request body can set it.
  industry String?
}
```

**Why `industry` on `Organization` and tokens on `StorefrontTheme`:** `Organization` is *not* tenant-scoped (it **is** the tenant) and is only reachable through `platformDb`. Industry is business identity and belongs beside `planTier`. The theme is tenant-owned data and belongs behind `scopedDb`, which also means it is covered by the two-tenant isolation suite for free.

**Why not put accents on `Organization` (and get them free from the Redis tenant cache):** `resolveTenantBySlug` caches a deliberately narrow `{ id, slug, name, status }` for 300 s, and `src/server/tenant/cache.ts` documents that any new cached field creates a `invalidateTenantHost` obligation on every mutation (Pitfall 7 of Phase 1). Publishing a colour change would then have to remember to bust the hostname cache or the storefront would show the old accent for up to five minutes. Reading `StorefrontTheme` in the same `scopedDb` call as the page document is one extra indexed read on an already-dynamic page and creates no cache-coherence obligation at all. **Do not widen the tenant cache for this.**

**Confidence:** HIGH. Grounded in `prisma/schema.prisma`, `src/server/db/platform.ts`, `src/server/tenant/cache.ts`, and the Prisma schema reference for `Json` → `jsonb`.

---

### Pattern 2: The draft/published split — a column pair on one row (D-08)

**The three candidate shapes, and why the third wins.**

| Shape | Publish operation | Atomicity | Cost |
|---|---|---|---|
| **(A) Two row-sets** discriminated by a `state` column | delete published rows, copy draft rows | Atomic inside `$transaction`; id churn on every publish | 2× rows, a delete path that contradicts the no-hard-delete convention, matching logic by `key` |
| **(B) Row-per-section with `draftSettings`/`publishedSettings` column pairs** | `SET published = COALESCE(draft, published)` for every row | Atomic inside `$transaction` | **Blocked in practice.** Prisma's `updateMany` takes literal values, not column references, and `$executeRaw` is banned repo-wide — so this becomes an N-row read-then-update loop inside a transaction |
| **(C) One row per page, `draft`/`published` JSONB columns** ← **recommended** | `update({ data: { published: draft, publishedAt: now } })` | **Atomic by construction** — one row, one statement. A half-published state is not representable | Two new models total; no per-row bookkeeping |

**Recommendation: (C).** The decisive argument is not elegance, it is the `$executeRaw` ban interacting with Prisma's inability to express column-to-column assignment. In shape (B) the publish path is a loop of ~20 `update` calls whose correctness depends on the loop, the transaction, and the reorder unique-constraint dance all being right. In shape (C) it is:

```ts
await scopedDb(ctx.tenantId).$transaction(async (tx) => {
  const page = await tx.storefrontPage.findUnique({
    where: { tenantId_pageType: { tenantId: ctx.tenantId, pageType: "home" } },
  });
  if (!page) throw new StorefrontNotSeededError();

  // Parse before promoting. A draft that does not satisfy the current
  // registry's schema must never reach `published` — that is the one place
  // a schema change could otherwise publish an unrenderable storefront.
  const document = pageDocumentSchema.parse(page.draft);

  await tx.storefrontPage.update({
    where: { id: page.id },
    data: { published: document, publishedAt: new Date() },
  });
  await tx.storefrontTheme.update({
    where: { tenantId: ctx.tenantId },
    data: { publishedTokens: themeTokensSchema.parse(theme.draftTokens), publishedAt: new Date() },
  });
});
```

Two row writes, one transaction. `scopedDb`'s extension follows into `$transaction` (proven by `tests/isolation/tenant-isolation.test.ts`, per the comment on `ScopedTx`).

**Discard draft** (a Claude's-discretion item — recommend shipping it, it is four lines): `update({ data: { draft: published ?? flagshipDefaultDocument() } })`. Never a delete.

**"Unpublished changes" indicator:** compare `draftUpdatedAt > publishedAt`. Do **not** deep-compare JSON on every dashboard render.

**Reordering.** With shape (C) reordering is a permutation of the in-memory `sections` array. There is no `position` column, therefore no unique-constraint dance, therefore none of the "positions are vacated before they are reassigned" hazard that `src/server/catalog/actions.ts` documents for product images. This is a real, concrete simplification worth naming: **the array index *is* the order.** (Prisma does not support `DEFERRABLE` unique constraints declaratively `[CITED: prisma.io schema reference — no mention]`, so the alternative would have required hand-edited migration SQL.)

**Does (C) violate EDIT-01 or ARCHITECTURE.md Pattern 3?** No, on both counts, and the planner should be ready to defend this:

- EDIT-01 requires "section/block types defined in code and **instances** (order, settings, content) **stored per tenant**." A per-tenant row holding the ordered instance list satisfies this literally. The Theme→Page→Section→Block hierarchy is fully present: `TEMPLATES`/`StorefrontTheme` → `StorefrontPage.pageType` → `document.sections[]` → `document.sections[].blocks[]`.
- ARCHITECTURE.md Pattern 3's own trade-off note says: *"A single-JSON-per-page approach is simpler to build and is an acceptable fallback if the 30-day timeline is tight, but it forgoes those admin/query capabilities and complicates concurrent field-level edits in the editor."* Both losses are inapplicable here: cross-tenant "how many stores use the hero section" is Phase 6/deferred territory and remains answerable with a `jsonb` query, and **D-07 explicitly removes field-level server edits** — the draft is held in the browser and saved wholesale.
- It is also, precisely, how Shopify models this: a JSON template file listing the sections, their order, and their settings `[CITED: shopify.dev/docs/storefronts/themes/architecture/templates/json-templates, via ARCHITECTURE.md]`.

**Documented fallback:** if the planner or the user wants relational instance rows anyway (for literal EDIT-01 optics or future admin analytics), use shape (B) — `StorefrontSection` + `StorefrontBlock` with `draftSettings`/`publishedSettings`/`draftPosition`/`publishedPosition` pairs, `@@unique([tenantId, pageType, key])`, **no unique constraint on either position column** (use a plain index and a deterministic `orderBy: [{ position: "asc" }, { key: "asc" }]` tiebreak), and accept the N-row publish loop. Everything else in this document — the registry, the discriminated union, the preview architecture, the entitlement gate — is unchanged by that choice.

**Confidence:** HIGH on the mechanics (verified against `eslint.config.mjs`, Prisma docs, `tenant-scoped.ts`). MEDIUM on it being the choice the user will prefer — see *Open Questions* Q1.

---

### Pattern 3: The code registry — one discriminated union, zero casts (D-06, EDIT-01, TMPL-02)

**What:** Section and block *types* are a build-time registry. Each entry pairs (a) a Zod settings schema, (b) a React component, (c) a list of editor field descriptors, (d) default settings.

The single most important decision here is that **the settings schema and the page document schema are the same Zod object graph**, built as a discriminated union on `type`. That is what gives end-to-end typing from JSONB column → parsed document → component props with no `as` anywhere.

```ts
// src/server/theming/schema.ts  — pure, no server-only marker: the preview
// client component imports this to validate the postMessage payload.
import { z } from "zod";

/** Hex only. This value is written into a CSS custom property (Pitfall 3). */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour.");

/** An R2 derivative prefix, never a URL (matches ProductImage.storageKey). */
export const storageKeySchema = z
  .string()
  .regex(/^tenants\/[A-Za-z0-9_-]+\/(products|logos)\/[a-z0-9-]{8,64}$/);

const heroSettings = z.object({
  eyebrow: z.string().max(60),
  heading: z.string().min(1).max(120),
  body: z.string().max(280),
  ctaLabel: z.string().min(1).max(30),
  ctaHref: z.string().max(200),
  backgroundImageKey: storageKeySchema.nullable(),
  overlayOpacity: z.number().min(0).max(0.8),
});

const trustBarSettings = z.object({
  blocks: z
    .array(
      z.object({
        type: z.literal("trust-item"),
        icon: z.enum(["truck", "shield-check", "clock", "message-circle"]),
        heading: z.string().min(1).max(48),
        body: z.string().max(140),
      }),
    )
    .min(1)
    .max(4),
});

// … productGridSettings, editorialSplitSettings, contactSettings …

/**
 * THE discriminated union. Adding a section type here is a compile error at
 * every incomplete switch in the codebase — the same drift detection
 * ORDER_TRANSITIONS and TENANT_SCOPED_MODELS provide.
 */
export const sectionInstanceSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("hero"), settings: heroSettings }),
  z.object({ id: z.string(), type: z.literal("trust-bar"), settings: trustBarSettings }),
  z.object({ id: z.string(), type: z.literal("product-grid"), settings: productGridSettings }),
  z.object({ id: z.string(), type: z.literal("editorial-split"), settings: editorialSplitSettings }),
  z.object({ id: z.string(), type: z.literal("contact"), settings: contactSettings }),
]);

export type SectionInstance = z.infer<typeof sectionInstanceSchema>;

export const pageDocumentSchema = z.object({
  /** Bump when a settings shape changes incompatibly. See Pitfall 8. */
  version: z.literal(1),
  /** Order IS the array order. D-05: length and membership are fixed. */
  sections: z.array(sectionInstanceSchema).min(1).max(12),
});

export type PageDocument = z.infer<typeof pageDocumentSchema>;
```

The renderer is then a plain, exhaustive `switch` with **no cast**, because TypeScript narrows `section.settings` from `section.type`:

```tsx
// src/app/s/[slug]/sections/section-renderer.tsx
export function SectionRenderer({ section, data }: { section: SectionInstance; data: StorefrontRenderData }) {
  switch (section.type) {
    case "hero":            return <HeroSection settings={section.settings} />;
    case "trust-bar":       return <TrustBarSection settings={section.settings} />;
    case "product-grid":    return <ProductGridSection settings={section.settings} data={data} />;
    case "editorial-split": return <EditorialSplitSection settings={section.settings} />;
    case "contact":         return <ContactSection settings={section.settings} data={data} />;
  }
}
```

> **This is the payoff of the discriminated union over a `Record<string, {schema, Component}>` registry.** A `Record`-keyed registry cannot be mapped over without a cast, because TypeScript cannot prove that `REGISTRY[section.type].Component` accepts `section.settings`. The `switch` proves it. A `Record` registry is still useful for the *editor* side (field descriptors, defaults, labels) where the value type is homogeneous — use both, and keep the one exhaustive `switch` as the only place a type maps to a component.

**Editor field descriptors** are hand-declared per type rather than introspected out of the Zod schema. Introspecting Zod 4 internals to build a form is brittle and produces labels you cannot put in `strings.ts`. Declare them:

```ts
// src/server/theming/registry.ts
export const SECTION_TYPES = {
  hero: {
    label: strings.editor.sections.hero,
    fields: [
      { key: "eyebrow",            kind: "text" },
      { key: "heading",            kind: "text" },
      { key: "body",               kind: "textarea" },
      { key: "ctaLabel",           kind: "text" },
      { key: "ctaHref",            kind: "link" },
      { key: "backgroundImageKey", kind: "image" },
    ],
  },
  // …
} as const;
```

Six field kinds cover the entire flagship: `text | textarea | link | image | color | select`. `<FieldRenderer>` switches on `kind`.

**Add a registry drift test** (`tests/unit/theming-registry.test.ts`) asserting: every `fields[].key` exists in the corresponding Zod schema's shape, every schema key has a field descriptor, and every section type in the union has a `SECTION_TYPES` entry. This mirrors `tests/isolation/model-registry-drift.test.ts` and is the cheapest way to stop a settings field from becoming silently uneditable.

**Confidence:** HIGH. Zod 4's `discriminatedUnion` and `z.infer` behaviour is stable API; the pattern mirrors `ORDER_TRANSITIONS` / `PLANS` / `IMAGE_PRESETS` already in this codebase.

---

### Pattern 4: Live preview — cross-origin iframe + `postMessage` (D-07, EDIT-02)

**The constraints that decide this, before any preference:**

1. `src/proxy.ts` returns a bare **404 for any request whose path starts with `/s/`** — unconditionally, on every host. The editor lives on the apex. It therefore **cannot** iframe `/s/{slug}` and cannot server-render the storefront route from a dashboard page.
2. `tests/unit/surface-token-isolation.test.ts` **ban #4** fails the build if `data-surface="storefront"` appears in any `.tsx` outside `src/app/s/`. The test's own failure message says: *"If a dashboard component needs to preview storefront styling, that is a Phase 4 theming concern and not this attribute."* **D-12 forbids weakening it.** So the preview cannot be an inline dashboard subtree wrapped in that attribute.
3. Even if (2) were solvable, an inline preview gets the **window's** viewport, so every `md:`/`lg:` breakpoint in the flagship fires against the browser width rather than the preview pane width. The preview would be systematically wrong at exactly the moment the merchant is judging quality.

**Therefore:** a `<iframe src="https://{slug}.{ROOT_DOMAIN}/preview">`. The proxy rewrites that to `/s/{slug}/preview`, which inherits `src/app/s/[slug]/layout.tsx` — so the preview gets `data-surface="storefront"` from the one legal place it exists, the zinc token scope, the 0.25 rem radius, and the tenant gate, all for free. It also gets its own viewport, which makes a mobile/desktop toggle a width change on the iframe element.

**The sync protocol (recommended, concrete):**

```
editor (apex)                          iframe (subdomain)
     │                                        │
     │            ◄── { type: "einort:preview-ready" }   (iframe posts on mount,
     │                                        │            targetOrigin = apex origin)
     ├── { type: "einort:preview-doc",        │
     │     document, tokens } ───────────────►│  validate origin === expected
     │   targetOrigin = `https://{slug}.{root}`│  validate payload with
     │                                        │    pageDocumentSchema + themeTokensSchema
     │   (re-posted on EVERY reducer action)  │  setState → React re-render
     │                                        │
     ├── { type: "einort:preview-select",     │  scroll section into view,
     │     sectionId } ──────────────────────►│  draw a focus ring
```

**Why this is genuinely instant.** `postMessage` between same-browser documents is a structured-clone hop measured in microseconds. React re-renders a five-section tree in a frame. There is **no network in the loop at all** — which is stronger than Shopify's own theme editor, where a settings change triggers a server-side section re-render `[CITED: shopify.dev/docs/storefronts/themes/best-practices/editor/integrate-sections-and-blocks — the editor emits `shopify:section:load` after re-rendering a section]`. On a Douala mobile connection a per-keystroke round trip is not "instant" under any definition, so the client-render approach is not merely simpler, it is the only one that satisfies D-07 on the target network.

**What the `/preview` route server-renders:** the *data bundle* only — the merchant's products, categories, store name, and the currently **published** document as the initial paint (so the pane is never blank while the handshake completes). All of it is data the storefront already serves publicly to anonymous visitors, which is why the route needs **no session and no token**. The draft never reaches the server during editing; it lives in the merchant's own browser and travels only between two documents that browser already has open.

**Security posture for `/preview`** (all of these are required, none is optional):

- `export const metadata = { robots: { index: false, follow: false } }` — a preview URL indexed by Google is a duplicate-content and confusion problem.
- The receiver validates `event.origin` against the exact expected apex origin, computed from `NEXT_PUBLIC_ROOT_DOMAIN`, before reading `event.data`. A `postMessage` handler that skips this accepts messages from any framing page.
- The receiver validates the payload with `pageDocumentSchema.safeParse` and ignores anything that fails. Never `JSON.parse` + trust.
- The sender uses an **exact** `targetOrigin`, never `"*"`.
- Do not add a global `X-Frame-Options: DENY` / `frame-ancestors 'none'` header to the storefront while this route exists. There is currently no CSP or frame header configured anywhere (`next.config.ts` sets only `images` and `allowedDevOrigins`) `[VERIFIED: read next.config.ts]`. If a future phase adds clickjacking protection, `/preview` needs `frame-ancestors https://{ROOT_DOMAIN}` rather than a blanket deny.

**Local development note.** `NEXT_PUBLIC_ROOT_DOMAIN` is `localhost:3000` in `.env.test`/examples while `npm run dev` binds port **3001**. The iframe URL builder must derive protocol and host exactly the way `src/app/onboarding/plan/page.tsx` already does (`rootDomain.startsWith("localhost") ? "http" : "https"`) and must use the *configured* root domain, not `window.location.host`. Expect to verify this on a real dev run — it is the single most likely "works in prod, blank iframe locally" failure.

**Confidence:** HIGH on the constraint analysis (all three constraints read directly from source). MEDIUM-HIGH on the protocol details — the shape is standard (Shopify theme editor, WordPress Customizer) but has not been exercised in this repo.

---

### Pattern 5: Editor state — a pure reducer, no state library (D-05, D-06, D-07)

There is no state-management library in `package.json` and none is needed. The editor's entire state is one `PageDocument` plus a `selectedSectionId` plus a dirty flag. Model it as a `useReducer` whose reducer is a **pure function exported from `src/lib/editor/reducer.ts`**:

```ts
export type EditorAction =
  | { kind: "select"; sectionId: string }
  | { kind: "move-up"; sectionId: string }
  | { kind: "move-down"; sectionId: string }
  | { kind: "set-field"; sectionId: string; key: string; value: unknown }
  | { kind: "set-token"; key: "primaryAccent" | "secondaryAccent"; value: string }
  | { kind: "reset"; state: EditorState };

export function editorReducer(state: EditorState, action: EditorAction): EditorState { … }
```

Why this matters more than usual here: **this repository's Vitest `unit` project runs `environment: "node"` with no jsdom and no testing-library** `[VERIFIED: read vitest.config.ts]`. Component rendering cannot be tested. Every existing "component" test in `tests/unit/` (e.g. `order-state-chip.test.ts`) is a source-scanning or pure-logic test. Putting reorder and field-edit logic in a pure reducer is therefore the *only* way EDIT-02's core behaviour gets automated coverage at all. Do not inline these mutations into the component.

Consequences to encode in the reducer, not the UI:
- `move-up` on index 0 and `move-down` on the last index are **no-ops**, not errors (D-05: membership is fixed, only order varies).
- `set-field` writes the whole settings object for that section; never a deep merge (see Pitfall 8).
- Every action bumps a `dirty` flag; `reset` clears it.

Save semantics (discretion item, recommended): **explicit Save** plus an "unsaved changes" indicator plus a `beforeunload` guard, not autosave. Autosave on a draft that the merchant might be experimenting with, on a flaky mobile connection, produces more support questions than it prevents; and D-07's "instant" promise is about the *preview*, not persistence.

**Confidence:** HIGH.

---

### Pattern 6: Onboarding integration and the seed (ONB-02, ONB-04, D-01…D-04)

**Where the new step goes.** The current flow is `/signup` → (`/onboarding/create-store` only as recovery) → `/onboarding/plan` → storefront. Both `create-store` and `plan` end by absolute-redirecting to `{slug}.{root}` `[VERIFIED: read both page.tsx files]`, and `requireMerchantContext()` redirects a `planTier === null` merchant to `/onboarding/plan` `[VERIFIED: read context.ts]`.

**Recommendation:** add `/onboarding/branding` **after** `/onboarding/plan`, and extend the ladder by exactly one rung, mirroring the existing pattern:

```
signup ──► /onboarding/plan ──► /onboarding/branding ──► {slug}.{root}
                                       ▲
   requireMerchantContext(): planTier === null  → /onboarding/plan       (exists)
                             industry  === null → /onboarding/branding   (NEW)
```

Rationale: plan selection is already mandatory and already gated in the DAL; adding the branding gate immediately beneath it reuses a proven mechanism instead of inventing a second one. Putting branding *before* plan would mean uploading a logo before knowing whether the merchant will complete signup at all. Business name is already captured (`Organization.name` at signup) — the branding step should let them **confirm/edit** it rather than re-ask, satisfying ONB-02's "captures business name."

**Do the redirect on `/onboarding/plan`'s existing "already chosen" branch point at `/onboarding/branding` instead of the storefront** — otherwise a merchant who bounces back lands on the store and skips branding forever.

**The seed, and what ONB-04 actually requires.** ONB-04 says onboarding produces a **live, published** storefront. With Pattern 2 that is literally one write: the branding action, in one `scopedDb` transaction, does

```ts
await scopedDb(ctx.tenantId).$transaction(async (tx) => {
  const document = flagshipDefaultDocument();              // from the registry + strings
  await tx.storefrontTheme.upsert({
    where:  { tenantId: ctx.tenantId },
    create: scopedCreateData<StorefrontThemeUncheckedCreateInput>({
      templateKey: "flagship-fashion",
      logoKey,
      draftTokens: tokens,
      publishedTokens: tokens,      // published immediately — that IS ONB-04
      publishedAt: now,
    }),
    update: { logoKey, draftTokens: tokens, publishedTokens: tokens, publishedAt: now },
  });
  await tx.storefrontPage.upsert({
    where:  { tenantId_pageType: { tenantId: ctx.tenantId, pageType: "home" } },
    create: scopedCreateData<StorefrontPageUncheckedCreateInput>({
      pageType: "home", draft: document, published: document, publishedAt: now,
    }),
    update: {},                     // never clobber an existing merchant's work
  });
});
// industry goes to platformDb.organization.update — Organization is not tenant-scoped.
```

`upsert` (not `create`) is what makes the step idempotent against a double submit; `scopedDb`'s extension stamps `tenantId` into **both** the `where` and the `create` halves of an upsert, so this is safe `[VERIFIED: read tenant-scoped.ts `case "upsert"`]`. Note `scopedCreateData<T>()` is required because tenant-scoped models declare `tenantId` required with no default — the helper exists precisely for this.

**Pre-Phase-4 merchants** (every org in dev and test today) have no theme or page row. Two required behaviours:
1. The storefront render **falls back to the flagship defaults from the registry** when `published` is absent — a pure read, no write. This also covers the millisecond a brand-new org exists before the seed lands.
2. The editor page calls an idempotent `ensureStorefrontSeeded()` (the same upsert pair) before rendering, so any legacy org self-heals on first editor visit. That write is inside an authenticated dashboard path, never on a public storefront render.

**Do not put a write on the public storefront render path.** It would be a free write amplifier for anyone hitting a store URL.

**Confidence:** HIGH.

---

### Pattern 7: Logo upload — what actually changes (ONB-03)

Phase 3 left this deliberately half-built. Verified present and unused:

- `IMAGE_PRESETS.logo` in `src/server/images/pipeline.ts` — `sizes: [128, 512]`, `labels: ["small","large"]`, `fit: "contain"`, `ratio: 1`, transparent `background`. Its comment says explicitly: *"do NOT delete it as dead code; its existence is the contract that the logo upload adds data rather than a second implementation of this file."*
- `UploadKind = "products" | "claims" | "logos"` in `src/server/images/r2.ts`, with the same instruction.
- `uploadPresignLimiter` is already exported from `src/server/rate-limit.ts`.

**What must actually be built or changed:**

| Item | Current state | Change needed |
|---|---|---|
| Presign action | `requestProductImageUpload` hardcodes `objectKeyFor(ctx.tenantId, "products", …)` | Add a sibling `requestLogoUpload` in `src/server/images/actions.ts` using `"logos"`. **Do not** parameterise the existing one with a client-supplied `kind` — a client-chosen namespace is a client-influenced key |
| Finalize route | `src/app/api/upload/finalize/route.ts` has `kind: z.literal("products")` and calls `processImage(original, "product")` | Widen to `z.enum(["products","logos"])` with a **server-side** `kind → preset` map (`{ products: "product", logos: "logo" }`). Keep the `ctx.canWrite` re-check — it is a Route Handler, `merchantAction` does not reach it |
| Enhancement chain | `processImage` applies `.normalise()`, `.modulate({saturation: 1.06})`, `.sharpen()` to **every** preset | **Add a per-preset `enhance: boolean`.** Those three steps are tuned for an under-lit phone photo of a product. On a flat brand logo, `.normalise()` shifts the brand's own colours, `.sharpen()` halos flat edges, and lossy `.webp({ quality: 82 })` fringes semi-transparent edges. Recommend `enhance: false` + `webp({ lossless: true })` for the `logo` row |
| Client island | `image-gallery-field.tsx` is the working three-step reference | Copy its presign → PUT → finalize sequence; it must PUT with **exactly** the signed content type and byte count or R2 answers 403 |
| Persistence | Finalize deliberately writes no DB row | The branding action writes `StorefrontTheme.logoKey` from the finalize response's `storageKey` |

**Answer to the research question "can the presigned flow be reused as-is?"** — Yes for R2 transport (`presignUpload`, `objectKeyFor`, `getObjectBuffer`, `putObject`, `publicUrlFor` need **no change at all**), and yes for the browser sequence. No for the two hardcoded call sites above, and no for the enhancement chain if you care about logo fidelity.

**Confidence:** HIGH — all read from source.

---

### Pattern 8: Brand accents — contrast check and token injection (D-09, D-10, D-11, D-12)

**The contrast math (verified against the W3C source, not recalled):**

> Contrast ratio = `(L1 + 0.05) / (L2 + 0.05)`, L1 the lighter relative luminance.
> Relative luminance `L = 0.2126·R + 0.7152·G + 0.0722·B`, where each 8-bit channel is normalised by 255 and then linearised: `c ≤ 0.04045 ? c/12.92 : ((c + 0.055)/1.055) ^ 2.4`.
> Thresholds: **4.5:1** normal text, **3:1** large text (≥18 pt, or ≥14 pt bold), non-text UI components covered by SC 1.4.11.
> *"Computed values should not be rounded (e.g., 4.499:1 would not meet the 4.5:1 threshold)."*
> `[CITED: w3.org/WAI/WCAG22/Understanding/contrast-minimum.html]`

That is ~20 lines in `src/lib/contrast.ts`, pure, no imports, unit-testable in the `node` project, and importable from a client component. **No dependency.**

**Recommended thresholds for D-11** (the discretion item):

| Check | Pair | Threshold | Action |
|---|---|---|---|
| Accent as a **link/text** colour | accent vs storefront `--background` (white) | 4.5:1 | Inline warning if below |
| Accent as a **button fill** | accent vs the auto-chosen accent foreground | 4.5:1 | Auto-fix, never warn — see below |
| Accent as a **non-text** mark (focus ring, active bar) | accent vs white | 3:1 | Inline warning if below |

**Auto-choose the accent foreground rather than warning about it.** Compute, server-side, whether white or zinc-950 has more contrast against the merchant's accent, and store/emit that as `--brand-accent-foreground`. A merchant should never be able to produce a button whose own label is unreadable — that is a structural break of the portfolio-quality guardrail D-09 exists to protect, and it costs two lines. The *warning* (D-11's non-blocking inline notice) is reserved for the accent-as-link case, which is a taste judgement the merchant is allowed to make badly.

**Token injection, and the ban-#1 trap.** The storefront layout injects the accents as CSS custom properties:

```tsx
// src/app/s/[slug]/layout.tsx  — the line contains NO literal colour value,
// so surface-token-isolation ban #1 passes.
<div
  data-surface="storefront"
  style={{
    "--brand-accent": tokens.primaryAccent,
    "--brand-accent-foreground": tokens.primaryAccentForeground,
    "--brand-accent-secondary": tokens.secondaryAccent,
  } as React.CSSProperties}
  className="flex min-h-full flex-1 flex-col"
>
```

and `globals.css` maps them to utilities the same way `--gold-accent` already is:

```css
@theme inline {
  --color-brand-accent: var(--brand-accent);
  --color-brand-accent-foreground: var(--brand-accent-foreground);
  --color-brand-accent-secondary: var(--brand-accent-secondary);
}

[data-surface="storefront"] {
  /* … existing 20 zinc tokens, unchanged … */
  /* Fallbacks so a tenant with no theme row still renders correctly. */
  --brand-accent: var(--primary);
  --brand-accent-foreground: var(--primary-foreground);
  --brand-accent-secondary: var(--muted-foreground);
}
```

Section components then write `bg-brand-accent text-brand-accent-foreground` — a semantic utility, so bans #1 and #2 both pass, and D-09 is enforced *by vocabulary*: there is simply no utility that lets a merchant colour a background or body text.

**D-12 compliance is structural here.** `--brand-accent` is declared only inside the `[data-surface="storefront"]` block and injected only from a file under `src/app/s/`. A dashboard component that wrote `bg-brand-accent` would resolve to nothing — and the editor's own chrome must use the merchant palette (`bg-primary`, `--gold-accent`) exactly as every other dashboard surface does. The only accent colour visible in the editor is **inside the iframe**, which is a different document. That is the cleanest possible satisfaction of D-12: the separation is enforced by a document boundary, not by discipline.

**Default accents for a merchant who skips the picker:** zinc-900 ink (`#18181B`) primary and zinc-500 (`#71717A`) secondary — i.e. the reference's own "the 10% accent in this system is ink, not a hue." Put these constants in `src/lib/` or `src/server/`, **never** in a `.tsx` under `src/app`/`src/components`, because ban #1's regex `#[0-9a-fA-F]{6}` would fail the build.

**Confidence:** HIGH on the maths (W3C primary source) and on the token plumbing (mirrors the existing `--gold-accent` wiring read from `globals.css`).

---

### Pattern 9: What the flagship is actually made of (TMPL-01, TMPL-02)

Derived by reading the reference implementation in `C:\Users\LFD Service\Downloads\einort-commerce.zip` — specifically `src/pages/storefront/StoreHome.tsx` (173 lines) and `StoreLayout.tsx` (126 lines) `[VERIFIED: extracted and read]`. **This is a visual/structural reference only.** Its known gaps are on record (hardcoded `zinc-*` and `bg-white` utilities instead of theme tokens — which would fail ban #2 outright; a simulated checkout; non-Cameroon locale). Reimplement through the token system; do not port.

**The reference's home page is exactly five sections, in this order:**

| # | Reference section | Registry type | Blocks | Data it needs |
|---|---|---|---|---|
| 1 | Full-bleed hero, 85 vh, background photo + `zinc-950/30` scrim, centred eyebrow/H1/body/pill CTA | `hero` | none (single settings object) | image key |
| 2 | Trust indicators — 3 icon + heading + body columns on a hairline-bordered band | `trust-bar` | **`trust-item` × 1–4** | none |
| 3 | Featured products — section heading + "View all →" + a 4-up grid of `aspect-[4/5]` cards | `product-grid` | none | products, categories (already in `src/server/storefront/queries.ts`) |
| 4 | Promotional/editorial split — inverted `zinc-950` band, 2-col: heading + body + CTA, and a `aspect-[4/3]` image | `editorial-split` | none | image key |
| 5 | Newsletter — centred heading, body, inline email form | `contact` (**re-purposed**) | none | merchant WhatsApp number (Phase 3 payment settings) |
| — | Sticky translucent header with announcement bar, nav, cart bubble | theme chrome, **not a section** | — | logo, cart count |
| — | Footer: brand wordmark + link columns | theme chrome, **not a section** | — | store name |

**Two deliberate deviations from the reference, both required:**

- **Section 5 must not be a newsletter.** There is no email-capture backend in V1 (`resend` is installed but wired to nothing) and a form that silently discards submissions is worse than no form. Replace it with a **contact/WhatsApp band** — same layout, same weight in the page, and it drives the channel this product actually has (CHK-02's `wa.me` deep link). This also keeps `strings` honest.
- **Section 3 is the store's real product grid, and `/` stays the home route.** Phase 3's `src/app/s/[slug]/page.tsx` is the catalogue grid, `store-header.tsx` links to `/`, and `tests/unit/storefront-link-prefix.test.ts` pins the link vocabulary. Introducing a marketing home at `/` and pushing the catalogue to `/shop` would mean editing every internal link — the exact class of bug quick-task `260901-00j` already cost 35 minutes. **Keep `/` as the flagship home *including* the grid section**, preserving the existing `?category=` filtering at the database layer. The `product-grid` section's settings then carry heading, "view all" label, item count, and an optional category filter — nothing that changes routing.

**Block types.** Only one repeatable block type is genuinely needed for the flagship: `trust-item`. That is the honest answer to the discretion question, and inventing more to look thorough would be padding. Model blocks as a typed array **inside** the owning section's settings (`trustBarSettings.blocks`), validated by the same Zod graph — the Section→Block relationship is real and typed, it simply does not need its own table under Pattern 2.

**Zero-products branch.** `src/app/s/[slug]/page.tsx`'s existing empty-store placeholder and its `strings.storefront` copy are explicitly out of scope for replacement per Phase 3's own note. Under the section system, a `product-grid` section with zero products should render its heading and the existing placeholder body inside the section frame — the *page* is no longer empty because the hero and trust bar are there, which is a strict improvement.

**Confidence:** HIGH on the section inventory (read from the reference). MEDIUM on the two deviations being what the user wants — flagged in *Open Questions* Q2.

---

### Pattern 10: The motion language, without a motion library (TMPL-02)

The reference's motion vocabulary, read from `src/components/ui/Motion.tsx` and the inline `motion.h1` props in `StoreHome.tsx`:

| Token | Value |
|---|---|
| Easing | `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) — used **everywhere**, including hover transforms |
| Enter transform | `opacity 0→1` + `translateY 10–20px→0` |
| Duration | 0.4 s for reveals, 0.7–0.8 s for hero, 0.7 s for image hover scale |
| Stagger | 0.05 s per child in a grid |
| Hero cascade | headline 0.2 s, body 0.4 s, CTA 0.6 s |
| Hover | image `scale(1.05)→1`, icon `scale(1.1)` |

Every one of these is CSS. Declare them as custom properties once, under the storefront scope in `globals.css`, and compose with the already-installed `tw-animate-css` utilities (`animate-in fade-in slide-in-from-bottom-4 animation-duration-500 delay-200 fill-mode-both`) `[VERIFIED: utilities present in node_modules/tw-animate-css/dist/tw-animate.css]`.

Two things the planner must not skip:

1. **`prefers-reduced-motion`.** Wrap the reveal utilities in `@media (prefers-reduced-motion: reduce) { … animation: none; transition: none; }`. This is an accessibility floor, and the existing UI specs treat those as non-negotiable.
2. **Scroll-triggered reveal needs ~25 lines of client code.** `animate-in` fires on mount, not on scroll. Options: (a) a tiny `<Reveal>` client component using `IntersectionObserver` — recommended, well-supported, ~25 lines; (b) CSS `animation-timeline: view()` — zero JS but browser support is not safe for this market yet; (c) no scroll trigger, everything animates on mount — acceptable and simplest, and arguably better on a slow connection where the whole page arrives at once. Recommend (a) with (c) as the descope.

**Typography.** The storefront deliberately does **not** use `font-heading` (Outfit) — ban #3 fails the build on it. The reference's `font-display` role must be expressed as Plus Jakarta Sans at display sizes with `tracking-tighter` and heavier weight. Note the root layout currently loads Plus Jakarta Sans at weights **400 and 600 only**; the reference's hero is `font-bold` (700). Either accept 600 as the display weight or add 700 to the `next/font` declaration — a deliberate, one-line decision the planner should make explicitly rather than discover as a rendering fallback.

**Confidence:** HIGH on the token values (read from the reference source) and utility availability (read from installed package). MEDIUM on (a)-vs-(c) for scroll reveal.

---

### Pattern 11: The tier gate — and the D-15 trap (EDIT-03, D-13, D-14, D-15)

**There is a real bug waiting here that the planner must be warned about.** `resolveEntitlements` computes `plan` purely from `org.planTier`; trial state affects **only** `canWrite`. Existing feature flags (`discountCodes`, `bulkImport`) are therefore **not** trial-elevated. If the editor gate is written as the obvious `can(ctx, "storefrontEditor")`, a Starter merchant **on day 2 of their trial gets a view-only editor** — a direct violation of D-15.

**Recommended shape** — mirror `canWrite` exactly, because `canWrite` is already the codebase's one trial-aware boolean and lives in the one pure function that knows trial state:

```ts
// src/server/entitlements/plans.ts — the tier data stays registry data.
export interface PlanLimits {
  readonly members: number;
  readonly products: number | null;
  readonly editorSections: number | null;   // see note below
  readonly discountCodes: boolean;
  readonly bulkImport: boolean;
  /** EDIT-03 / D-13, D-14. Starter false, Business and Professional both true —
   *  a single boolean, never a 3-way branch. Composed with trial state by
   *  `resolveEntitlements`; do NOT read this directly at a call site. */
  readonly storefrontEditor: boolean;
}
```

```ts
// src/server/entitlements/resolve.ts
export interface MerchantContext {
  // …
  readonly canWrite: boolean;
  /** EDIT-03. D-15: an ACTIVE trial grants this regardless of tier. */
  readonly canEditStorefront: boolean;
}

// inside resolveEntitlements(), after `plan` and the trial state are computed:
canEditStorefront:
  (subscribed || !expired) &&                       // never on an expired trial
  (trialState === "active" || plan.limits.storefrontEditor),
```

```ts
// src/server/entitlements/assert.ts — pairs with assertCanWrite, same idiom.
export class EditorLockedError extends Error {
  override readonly name = "EditorLockedError";
}
export function assertCanEditStorefront(ctx: MerchantContext, message: string): void {
  if (!ctx.canEditStorefront) throw new EditorLockedError(message);
}
```

`merchantAction`'s `catch` currently converts only `ReadOnlyError` and `EntitlementError` into `{ ok: false }`; everything else rethrows. Either make `EditorLockedError extends EntitlementError` (cleanest — it *is* an entitlement refusal and inherits the `feature` field) or add it to the `instanceof` check. **Choose deliberately; forgetting produces a 500 instead of a message.**

**Which actions the gate covers.** Recommend gating **both** `saveDraft` and `publishStorefront` — not publish alone. D-13 says "cannot publish changes," which strictly permits saving unpublishable drafts, but a draft the merchant can save and never publish is a trap that reads as a bug. Gating both keeps the promise honest: on Starter (post-trial) the editor is fully interactive **in the browser**, the preview updates live, and nothing persists — which is exactly "can preview the live-editing experience." Surface it with explicit copy from `strings.editor.starterViewOnly`, not a silently disabled button. *(Flagged as a judgement call in Open Questions Q3.)*

**`editorSections` is already registered but must stay unenforced.** `PlanLimits.editorSections` carries the comment *"ENFORCED FROM PHASE 4 (EDIT-03, editor sections)"* and is `null` on all three tiers. **D-05 fixes the section list for every tier**, so there is no per-tier section cap to enforce. Leave it `null`, and update its doc comment to say so, rather than inventing a cap to satisfy a stale note. Removing the key would be worse — D-07 of Phase 2 registered it on purpose.

**Confidence:** HIGH. The D-15 conflict was found by reading `resolve.ts` and `plans.ts` directly; it is not speculative.

---

### Pattern 12: How Phase 3's storefront pages relate to the section system

Phase 3's `03-CONTEXT.md` explicitly left this for the Phase 4 planner to confirm. **Recommendation, with reasoning:**

| Route | Under the section system? | Why |
|---|---|---|
| `/` (home) | **Yes** — rendered from `published.sections` | This is the page TMPL-01 is about |
| `/p/[productSlug]` (PDP) | **No** this phase. Fixed route, theme chrome only | A PDP is 90 % product data and 10 % layout; making it section-editable this phase multiplies the registry and the editor surface for near-zero merchant value. Phase 5's `pageType` column is where it lands |
| `/cart`, `/checkout` | **No, and never** | Transactional surfaces with server-authoritative logic. A merchant able to reorder or blank a checkout section can break their own revenue path, and D-08's draft/publish must have **no** reachable interaction with order placement |
| `/order/[token]` (tracking) | **No, and never** | Customer-facing order state. Phase 3 deliberately withholds `--success`/gold here (T-03-10) so a shopper cannot read a colour as a payment guarantee — merchant-editable content on this page would reopen exactly that |
| Header / footer chrome | **Yes, but as theme settings, not sections** | They appear on *every* route including cart and checkout. Model them as `StorefrontTheme` settings (logo, announcement text, footer tagline, nav labels) applied by `src/app/s/[slug]/layout.tsx`, so branding is consistent across editable and fixed pages alike |

The practical rule to write into the plan: **a route that can take money or change order state is never section-rendered.** That line is worth putting in a module header comment, because it is exactly the kind of scope creep a later phase will propose innocently.

**Confidence:** HIGH on cart/checkout/tracking (follows directly from CLAUDE.md's server-authoritative constraints). MEDIUM on the PDP deferral — see Open Questions Q4.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| WCAG contrast ratio | Nothing to build — but also don't add a package | ~20 lines in `src/lib/contrast.ts` from the W3C formula | The formula is fixed since 2008 and 8 lines of arithmetic. A dependency here is supply-chain surface for zero capability. This is the rare inverse case: *hand-roll it* |
| Tenant scoping on the new models | A `where: { tenantId }` in each theming query | `scopedDb(ctx.tenantId)` + registration in `TENANT_SCOPED_MODELS` | An unregistered model throws; a hand-written filter is forgotten once |
| Server-Action auth/entitlement plumbing | A bespoke check at the top of each theming action | `merchantAction({ mode: "write", schema, handler })` | It runs identity → write gate → parse in the right order, before any DB call |
| Presign/derive/store for the logo | A `processLogoImage()` | `IMAGE_PRESETS.logo` + `processImage(buf, "logo")` | `pipeline.ts`'s header says this in as many words; a second copy is where EXIF rotation quietly stops being applied |
| Editor draft state | Zustand / Jotai / Redux | `useReducer` + a pure reducer in `src/lib/editor/` | One document, one selection, one dirty flag. A library adds a dependency and moves the logic out of the only test environment this repo has |
| Section reordering UX | A drag-and-drop library | Two buttons + a pure reducer | 6 fixed items, touch-first market, accessibility for free, testable in `node` |
| Motion | `motion` / `framer-motion` | `tw-animate-css` utilities + CSS custom properties | 30–50 kB gz to reproduce `opacity` + `translateY` + one easing curve |
| Rate limiting the logo presign | A new limiter | The exported `uploadPresignLimiter` | `createLimiter` is deliberately not exported |
| The draft/published mechanism | Next.js `draftMode()` | A `published` column | Draft Mode bypasses caches this project does not use, and its cookie is set on the wrong host |
| Colour parsing/validation | A colour library | `hexColorSchema` (one Zod regex) | `<input type="color">` emits exactly `#rrggbb`. Anything else is an attack, not a user |

**Key insight:** this phase's temptation is to reach for libraries because "page builder" sounds like a solved product category. It is not — the solved category is *generic* page builders, and ARCHITECTURE.md Anti-Pattern 3 already rejected building one. Every library that looks applicable (dnd, motion, state, colour) is solving a problem D-05/D-06/D-07 already removed.

---

## Common Pitfalls

### Pitfall 1: A hex literal in a `.tsx` fails the build
**What goes wrong:** `const DEFAULT_ACCENT = "#18181B"` in the onboarding colour picker, or `<div style={{ background: "#fff" }}>` in a section component.
**Why:** `tests/unit/surface-token-isolation.test.ts` ban #1 greps every `.tsx` under `src/app` **and** `src/components` for `#[0-9a-fA-F]{6}`, `oklch(`, `rgb(`, `hsl(` on any non-comment line.
**Avoid:** default colour constants live in `src/lib/**` or `src/server/**` (not scanned). Inject accents through a `style` object whose *values are variables*, never literals.
**Warning sign:** `npm run test:unit` fails with "UI-SPEC ban #1".

### Pitfall 2: `data-surface="storefront"` in the editor
**What goes wrong:** wrapping the preview pane in the attribute so it picks up zinc tokens.
**Why:** ban #4 fails the build for the attribute anywhere outside `src/app/s/`, and **D-12 forbids adding an exception.**
**Avoid:** the iframe (Pattern 4). The attribute stays exactly where it is, in `src/app/s/[slug]/layout.tsx`.

### Pitfall 3: A merchant-supplied colour reaching a `style` attribute unvalidated
**What goes wrong:** `style={{ "--brand-accent": theme.primaryAccent }}` where `primaryAccent` came from a JSONB column that a bad backfill filled with `red; background-image: url(https://evil/x)`.
**Why:** React sets custom properties via `setProperty` and does not sanitise the value.
**Avoid:** validate with `hexColorSchema` on **write** *and* on **read** (parse the JSONB through Zod every time), and fail **closed** to the zinc-ink default rather than throwing on a render path. ASVS V5.

### Pitfall 4: `postMessage` with `targetOrigin: "*"` or an unvalidated `event.origin`
**What goes wrong:** the preview accepts a document from any page that frames it, or the editor broadcasts the merchant's draft to whatever origin happens to be loaded.
**Avoid:** exact `targetOrigin` computed from `NEXT_PUBLIC_ROOT_DOMAIN`; `if (event.origin !== EXPECTED) return;` as the first line of the receiver; `pageDocumentSchema.safeParse` before any state update.

### Pitfall 5: Writing the logo to `Organization.logo`
**What goes wrong:** the merchant's logo key lives in a column any signed-in merchant can overwrite with an arbitrary string by POSTing directly to `/organization/update`.
**Why:** verified in `node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs` — `baseUpdateOrganizationSchema` includes `logo: z.string().nullish()` and it is a **core** field, so the `input: false` trick that protects `planTier`/`status` (which are `additionalFields`) does not apply to it `[VERIFIED: read installed source]`.
**Avoid:** store the logo key on `StorefrontTheme.logoKey`. If the planner insists on the `Organization.logo` column, add a `beforeUpdateOrganization` hook that refuses an incoming `logo` — exactly as the existing hook refuses `slug`.
**Warning sign:** none at runtime. This is silent until someone abuses it.

### Pitfall 6: New tenant-scoped models break the isolation suite in a confusing way
**What goes wrong:** you add `StorefrontTheme` and `StorefrontPage`, register them in `TENANT_SCOPED_MODELS`, and every isolation test explodes with a message about a missing fixture.
**Why:** `tests/setup/seed-two-tenants.ts` iterates `TENANT_SCOPED_MODELS` and **throws** for any registered model with no fixture entry `[VERIFIED: read the seed]`. And `tests/isolation/model-registry-drift.test.ts` fails if a model with a `tenantId` column is *not* registered. The two guards clamp you from both sides.
**Avoid:** treat it as a **three-part atomic change**: schema + `TENANT_SCOPED_MODELS` (appended in dependency order — the comment says the order is load-bearing) + seed fixture. Do all three in one Wave-0 task.

### Pitfall 7: The finalize route silently deriving the wrong preset
**What goes wrong:** widening `finalizeSchema` to accept `kind` but leaving `processImage(original, "product")` hardcoded — logos then get cover-cropped to a square with `position: "attention"`, cutting the wordmark.
**Avoid:** a server-side `KIND_PRESET` map, plus a unit test asserting `logos → "logo"`.

### Pitfall 8: Deep-merging settings on edit
**What goes wrong:** the reducer merges a partial settings patch into the stored settings, so clearing a field restores the template default instead of clearing it.
**Avoid:** `set-field` writes the **complete** settings object for that section. The Zod schema then validates a complete object every time, and "cleared" is representable as `""`.

### Pitfall 9: A schema change orphaning already-published documents
**What goes wrong:** you rename `heading` to `title` in `heroSettings`; every existing tenant's `published` JSONB now fails `pageDocumentSchema.parse` and their storefront 500s.
**Avoid:** the `version: z.literal(1)` field exists for this. Renaming a settings key is a **migration**, not an edit: bump the version, write a one-time backfill, or (cheaper for a pilot) parse with `safeParse` on the *storefront read path* and fall back to the registry defaults with a `console.error`, so a bad deploy degrades to a default-looking store instead of a white screen. Never let a parse failure take a live storefront offline.

### Pitfall 10: Forgetting the sidebar contract test
**What goes wrong:** the editor route ships, works when typed into the address bar, and no merchant can find it.
**Why:** `REQUIRED_HREFS` in `tests/unit/dashboard-nav.test.ts` is exhaustive and `src/components/app-sidebar.tsx` is the only navigation surface.
**Avoid:** add `/dashboard/storefront-editor` to both, in one commit, label from `strings.dashboard.nav`. Note ban #3's gold-accent budget is already fully spent (two uses) — do **not** give the new nav item a gold badge.

### Pitfall 11: A write on the public storefront render path
**What goes wrong:** "lazily seed the page document if missing" inside `src/app/s/[slug]/page.tsx`.
**Why:** every anonymous hit on an unseeded store becomes a database write; it is a free amplification lever.
**Avoid:** read-only fallback to registry defaults on the public path; `ensureStorefrontSeeded()` only in the authenticated editor path and the onboarding action.

### Pitfall 12: Iframe blank in local dev
**What goes wrong:** `NEXT_PUBLIC_ROOT_DOMAIN` is `localhost:3000` but `next dev` binds 3001, so the iframe URL points at a dead port.
**Avoid:** build the URL exactly as `src/app/onboarding/plan/page.tsx` does, and verify on a real `npm run dev` as an explicit task acceptance criterion.

---

## Code Examples

### Reading the published storefront (the public path)

```tsx
// src/server/theming/queries.ts
import "server-only";

import { scopedDb } from "@/server/db/tenant-scoped";

import { flagshipDefaultDocument, flagshipDefaultTokens } from "./defaults";
import { pageDocumentSchema, themeTokensSchema, type PageDocument, type ThemeTokens } from "./schema";

/**
 * The storefront's ONE read. Never writes (Pitfall 11), never throws on bad
 * data (Pitfall 9): a document the current registry cannot parse degrades to
 * the template defaults with a loud log, because a live storefront going white
 * is strictly worse than a live storefront showing default copy.
 */
export async function getPublishedStorefront(
  tenantId: string,
): Promise<{ document: PageDocument; tokens: ThemeTokens }> {
  const db = scopedDb(tenantId);
  const [page, theme] = await Promise.all([
    db.storefrontPage.findUnique({
      where: { tenantId_pageType: { tenantId, pageType: "home" } },
      select: { published: true },
    }),
    db.storefrontTheme.findUnique({
      where: { tenantId },
      select: { publishedTokens: true, logoKey: true },
    }),
  ]);

  const parsedDoc = pageDocumentSchema.safeParse(page?.published);
  if (page?.published && !parsedDoc.success) {
    console.error(
      `EDIT-01 degraded: tenant ${tenantId} has an unparseable published ` +
        `document; falling back to flagship defaults.`,
    );
  }

  const parsedTokens = themeTokensSchema.safeParse(theme?.publishedTokens);

  return {
    document: parsedDoc.success ? parsedDoc.data : flagshipDefaultDocument(),
    tokens: parsedTokens.success ? parsedTokens.data : flagshipDefaultTokens(),
  };
}
```

### The publish action (D-08, EDIT-03)

```ts
// src/server/theming/actions.ts
"use server";

import { z } from "zod";

import { strings } from "@/lib/strings";
import { scopedDb } from "@/server/db/tenant-scoped";
import { assertCanEditStorefront } from "@/server/entitlements/assert";
import { merchantAction } from "@/server/merchant/action";

import { pageDocumentSchema, themeTokensSchema } from "./schema";

export const publishStorefront = merchantAction<z.ZodObject<{}>, { publishedAt: string }>({
  mode: "write",
  schema: z.object({}),
  handler: async (ctx) => {
    // EDIT-03 / D-13 / D-14 / D-15. Throws; merchantAction converts it.
    assertCanEditStorefront(ctx, strings.editor.starterViewOnly);

    const db = scopedDb(ctx.tenantId);
    const publishedAt = new Date();

    await db.$transaction(async (tx) => {
      const [page, theme] = await Promise.all([
        tx.storefrontPage.findUnique({
          where: { tenantId_pageType: { tenantId: ctx.tenantId, pageType: "home" } },
        }),
        tx.storefrontTheme.findUnique({ where: { tenantId: ctx.tenantId } }),
      ]);
      if (!page || !theme) throw new Error("Storefront not seeded");

      /*
       * PARSE BEFORE PROMOTING. This is the one gate that stops a draft written
       * under an older registry from becoming the live storefront. A parse
       * failure here is a refused publish, which the merchant can act on — a
       * parse failure on the public read path is a customer looking at nothing.
       */
      const document = pageDocumentSchema.parse(page.draft);
      const tokens = themeTokensSchema.parse(theme.draftTokens);

      // Two rows, one statement each, one transaction. No half-published state
      // is representable, and no raw SQL is required (which is banned anyway).
      await tx.storefrontPage.update({
        where: { id: page.id },
        data: { published: document, publishedAt },
      });
      await tx.storefrontTheme.update({
        where: { tenantId: ctx.tenantId },
        data: { publishedTokens: tokens, publishedAt },
      });
    });

    return { ok: true as const, publishedAt: publishedAt.toISOString() };
  },
});
```

### WCAG contrast, in full (D-11)

```ts
// src/lib/contrast.ts — pure, no imports, client-safe, unit-testable in `node`.

/**
 * D-11. WCAG 2.2 relative luminance and contrast ratio, transcribed from
 * https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html.
 *
 * NOT ROUNDED, deliberately: the spec states 4.499:1 does not meet 4.5:1, so a
 * caller comparing a rounded value would pass a failing pair.
 */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** `#rrggbb` only — validated upstream by `hexColorSchema`. */
export function relativeLuminance(hex: string): number {
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** WCAG 1.4.3 normal-text threshold. */
export const CONTRAST_TEXT = 4.5;
/** WCAG 1.4.11 non-text (focus rings, active bars, icon marks). */
export const CONTRAST_NON_TEXT = 3;

/**
 * Never let a merchant produce an unreadable button label (D-09's guardrail).
 * The warning in D-11 is for the accent-as-link case; the button foreground is
 * chosen, not warned about.
 */
export function accentForeground(accent: string, light: string, dark: string): string {
  return contrastRatio(accent, light) >= contrastRatio(accent, dark) ? light : dark;
}
```

### The preview receiver (Pattern 4)

```tsx
// src/app/s/[slug]/preview/preview-canvas.tsx
"use client";

import { useEffect, useState } from "react";

import { pageDocumentSchema, themeTokensSchema } from "@/server/theming/schema";

export function PreviewCanvas({
  initialDocument, initialTokens, data, editorOrigin,
}: PreviewCanvasProps) {
  const [document, setDocument] = useState(initialDocument);
  const [tokens, setTokens] = useState(initialTokens);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Pitfall 4 — origin first, before touching event.data at all.
      if (event.origin !== editorOrigin) return;

      const envelope = event.data;
      if (typeof envelope !== "object" || envelope === null) return;
      if ((envelope as { type?: unknown }).type !== "einort:preview-doc") return;

      const doc = pageDocumentSchema.safeParse((envelope as { document?: unknown }).document);
      const tok = themeTokensSchema.safeParse((envelope as { tokens?: unknown }).tokens);
      if (doc.success) setDocument(doc.data);
      if (tok.success) setTokens(tok.data);
    }

    window.addEventListener("message", onMessage);
    // Handshake: the editor holds its first post until this arrives, so no
    // message is lost to a race with hydration.
    window.parent.postMessage({ type: "einort:preview-ready" }, editorOrigin);
    return () => window.removeEventListener("message", onMessage);
  }, [editorOrigin]);

  return (
    <div
      style={{
        "--brand-accent": tokens.primaryAccent,
        "--brand-accent-foreground": tokens.primaryAccentForeground,
        "--brand-accent-secondary": tokens.secondaryAccent,
      } as React.CSSProperties}
    >
      {document.sections.map((section) => (
        <SectionRenderer key={section.id} section={section} data={data} />
      ))}
    </div>
  );
}
```

---

## Runtime State Inventory

Not a rename/refactor/migration phase in the string-replacement sense, but this phase **does** change what an existing runtime holds. Answering each category explicitly:

| Category | Items found | Action required |
|---|---|---|
| **Stored data** | Every existing `Organization` row has `industry = NULL` and **no** `StorefrontTheme` / `StorefrontPage` row. Includes the dev database's live stores and both isolation fixtures (`tenant-a-fixed-id`, `tenant-b-fixed-id`) | Code edit **and** a data path: registry-default fallback on the public read (Pattern 6), `ensureStorefrontSeeded()` on the editor path, seed-fixture rows for both test tenants |
| **Live service config** | None — no n8n, Datadog, Tailscale, or Cloudflare Tunnel config carries any Phase 4 identifier. Verified: the only external services are Neon, Upstash, R2, Resend (unwired), all configured purely through `src/env.ts` | None |
| **OS-registered state** | None — no scheduled tasks, no pm2/launchd/systemd units in this repo | None |
| **Secrets / env vars** | None. This phase introduces no new environment variable. `R2_*`, `NEXT_PUBLIC_ROOT_DOMAIN` are already required and already validated in `src/env.ts` | None |
| **Build artifacts / installed packages** | `src/generated/prisma/**` is stale the moment `schema.prisma` changes | `npm install` (the `postinstall` hook regenerates) or `node scripts/prisma-generate.mjs` after the migration. Without it, `Prisma.ModelName` will not include the new models and `TENANT_SCOPED_MODELS` will not compile |
| **Redis** | `tenant:host:*` entries cache `{ id, slug, name, status }` for 300 s. Phase 4 adds **nothing** to that shape (deliberately, Pattern 1) | None — and that is the point of not widening the cache |

---

## State of the Art

| Old approach | Current approach | When changed | Impact here |
|---|---|---|---|
| `middleware.ts` | `proxy.ts` (Next 16) | Next 16 | ARCHITECTURE.md's Pattern 1 snippet is pseudocode; the real file is `src/proxy.ts` and it hard-404s `/s/*` — which is what forces the iframe target to be the subdomain |
| Preview via `getStaticProps` + `preview` mode | `draftMode()` / `__prerender_bypass` cookie | Next 13 → 16 | Still not applicable — this project has no fetch cache, no ISR, and no `use cache` on storefront reads, and the cookie is host-scoped to the apex |
| Prisma `dmmf` runtime introspection | `Prisma.ModelName` + generated meta | Prisma 7 removed `dmmf` | `tests/isolation/model-registry-drift.test.ts` already encodes this; new models are covered automatically |
| `tailwindcss-animate` | `tw-animate-css` | Tailwind v4 | Already installed at 1.4.0; the motion utilities this phase needs exist today |
| JS animation libraries as the default for "premium feel" | CSS `@keyframes` + custom-property easing tokens | Ongoing | The reference's entire motion vocabulary is CSS-expressible; a JS library would be pure payload |

**Deprecated / outdated in this context:**
- ARCHITECTURE.md's speculative `Theme` / `TenantTheme` / `Page` / `Section` / `Block` Prisma models — superseded by Pattern 1/2 for the reasons given, and by this codebase's own "registry as code" abstraction (`PLANS`, `IMAGE_PRESETS`, `ORDER_TRANSITIONS`).
- The `PlanLimits.editorSections` doc comment ("ENFORCED FROM PHASE 4") — D-05 removed the need; update the comment rather than inventing a cap.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `postMessage` + client re-render of a 5-section tree is perceptually instant on a mid-range Android | Pattern 4 | If the flagship's sections turn out to be heavy, "instant" degrades. Mitigation: the sections are static markup + `next/image`; measure on a real device at the phase gate |
| A2 | React 19 sets CSS custom properties in the `style` prop via `setProperty` and does not sanitise values | Pitfall 3 | If React sanitised, the validation would be redundant (harmless). If it *interpolates* instead, unvalidated input would be a CSS-injection vector — which is exactly why validation is prescribed regardless |
| A3 | Six field kinds (`text`/`textarea`/`link`/`image`/`color`/`select`) cover the whole flagship's editable surface | Pattern 3 | A seventh kind is a small additive change; low risk |
| A4 | No CSP / `frame-ancestors` header is emitted anywhere today, so the preview iframe will load | Pattern 4 | Verified by reading `next.config.ts` (no `headers()`), but Vercel project settings are outside this repo and were not inspected. Confirm on the first deploy |
| A5 | The user accepts the JSONB-document model over relational Section/Block rows | Pattern 2 | If not, switch to the documented fallback (B). Everything else in this document survives unchanged — this is deliberately the only decision the rest depends on loosely |
| A6 | Replacing the reference's newsletter section with a WhatsApp/contact band is acceptable | Pattern 9 | If the user wants a literal newsletter, it needs an email-capture backend that V1 does not have |
| A7 | The Plus Jakarta Sans display weight question (600 vs adding 700) is a free choice | Pattern 10 | Adding 700 costs one more font file on first paint |

---

## Open Questions

1. **Document-per-page (recommended) vs. relational Section/Block rows?**
   - *What we know:* the `$executeRaw` ban plus Prisma's lack of column-to-column assignment makes the relational publish an N-row loop; D-07 removes the only benefit relational rows would buy; ARCHITECTURE.md sanctions the document model in writing.
   - *What's unclear:* whether the user reads EDIT-01 / Pattern 3 as *mandating* relational rows for their own sake.
   - *Recommendation:* go with the document model; the fallback is fully specified in Pattern 2 and costs one plan's worth of extra work if reversed later.

2. **Does `/` stay the catalogue-plus-home route, or does a marketing home displace the grid to `/shop`?**
   - *What we know:* Phase 3 built `/` as the grid; `store-header.tsx` and `tests/unit/storefront-link-prefix.test.ts` pin the link vocabulary; quick-task `260901-00j` already cost 35 minutes on exactly this class of bug.
   - *Recommendation:* keep `/` and make the grid a section within the flagship home. Lowest risk, no new routes, no link churn.

3. **Does Starter (post-trial) get to save drafts it can never publish?**
   - *What we know:* D-13 says "cannot publish changes," which is literally satisfied by allowing draft saves.
   - *Recommendation:* gate **both** save and publish; the editor stays fully interactive client-side so "preview the live-editing experience" is honoured, and nothing persists that the merchant cannot use.

4. **Is the PDP section-editable this phase?**
   - *Recommendation:* no. `pageType` exists so Phase 5 adds a row, not a migration. Confirm with the user, since "customize my storefront" could reasonably be read to include the product page.

5. **Plus Jakarta Sans 700 for the flagship's display type?**
   - The root layout loads 400/600 only; the reference's hero is 700 with `tracking-tighter`. Decide explicitly rather than discovering a synthesised bold.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js 24 LTS | Everything | ✓ | (repo runs today) | — |
| Cloudflare R2 credentials | ONB-03 logo upload | ✓ | Already required in every env | None — and none is wanted |
| Neon Postgres (`DATABASE_URL`) | New migration | ✓ | — | — |
| Neon test branch (`TEST_DATABASE_URL`) | Isolation suite for the new models | ✓ | — | Isolation suite fails closed |
| Upstash Redis | `uploadPresignLimiter` | Optional | — | Degrades to allow-all with a `console.warn` (existing behaviour) |
| `sharp` 0.35.3 | Logo derive | ✓ | Installed | — |
| `tw-animate-css` 1.4.0 | Motion language | ✓ | Installed, utilities verified | Hand-written `@keyframes` |
| A second browser hostname for the iframe (`*.localhost`) | Preview development | ✓ | Works with zero config in Chrome/Edge/Firefox per README | — |
| jsdom / `@testing-library/react` | Component render tests | ✗ | — | **No fallback.** Component behaviour cannot be DOM-tested; push logic into pure modules (Pattern 5) and use source-scanning contract tests |
| The reference zip | Visual direction | ✓ | `C:\Users\LFD Service\Downloads\einort-commerce.zip`, 74 files, read | — |

**Missing dependencies with no fallback:** none that block execution.
**Missing dependencies with fallback:** jsdom — deliberately absent; the mitigation (pure reducer + registry drift test + source-scanning guards) is prescribed above and is consistent with how Phases 1–3 tested UI.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 4.1.10, two projects (`unit`, `isolation`), both `environment: "node"` |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test:unit` (`vitest run tests/unit --reporter=dot`, no DB, target < 2 s) |
| Full suite command | `npm run test:full` (`dotenv -e .env.test -- vitest run`, requires `TEST_DATABASE_URL`) |
| Also gating | `npm run lint` (`--max-warnings=0`) and `npm run typecheck` |

### Phase Requirements → Test Map

| Req | Behavior | Type | Automated command | File exists? |
|---|---|---|---|---|
| ONB-02 | The 6-segment list is exhaustive and each has copy; an unknown industry is rejected | unit | `vitest run --project unit tests/unit/theming-registry.test.ts` | ❌ Wave 0 |
| ONB-02 | Branding action persists industry + both accents; forged `tenantId` in the payload is ignored | isolation | `vitest run --project isolation tests/isolation/branding.test.ts` | ❌ Wave 0 |
| ONB-03 | `processImage(buf, "logo")` produces 128 + 512 derivatives with the declared dimensions and transparency preserved | unit | `vitest run --project unit tests/unit/image-pipeline.test.ts` (extend) | ✅ file exists, ❌ case to add |
| ONB-03 | Presigned logo key is always `tenants/{ctx.tenantId}/logos/…` regardless of input; finalize maps `logos → "logo"` preset | unit | `tests/unit/r2-key.test.ts` (extend) + new preset-map case | ✅ file exists, ❌ cases to add |
| ONB-04 | Seed is idempotent: two branding submissions leave exactly one theme + one page row, `published` non-null | isolation | `tests/isolation/branding.test.ts` | ❌ Wave 0 |
| TMPL-01 | No literal colour, no palette utility, no `font-heading`/gold/success anywhere under `src/app/s/**` | unit | `tests/unit/surface-token-isolation.test.ts` | ✅ exists — **will fail on a careless section component; that is the point** |
| TMPL-01 | No storefront link carries the internal `/s/${…}` prefix | unit | `tests/unit/storefront-link-prefix.test.ts` | ✅ exists |
| TMPL-02 | Every section type in the union has a `SECTION_TYPES` entry, a defaults entry, and field descriptors that match its schema keys exactly | unit | `tests/unit/theming-registry.test.ts` | ❌ Wave 0 — the registry drift guard |
| EDIT-01 | `pageDocumentSchema` rejects an unknown `type`, a missing `settings` key, and a non-hex colour | unit | `tests/unit/page-document-schema.test.ts` | ❌ Wave 0 |
| EDIT-01 | New models registered in `TENANT_SCOPED_MODELS`; unregistered model throws | isolation | `tests/isolation/model-registry-drift.test.ts` | ✅ exists — fails if a model is missed |
| EDIT-02 | Reducer: move-up at index 0 and move-down at the last index are no-ops; `set-field` replaces (never merges); order is the array order | unit | `vitest run --project unit tests/unit/editor-reducer.test.ts` | ❌ Wave 0 — **the only automated coverage EDIT-02's core logic can get** |
| EDIT-02 | `saveDraft` writes `draft` and leaves `published` byte-identical | isolation | `vitest run --project isolation tests/isolation/storefront-editor.test.ts` | ❌ Wave 0 |
| **EDIT-02 / D-08** | **Publish promotes draft→published atomically; a draft failing schema validation refuses the publish and leaves `published` untouched** | **isolation** | same file | ❌ **Wave 0 — the phase's highest-value correctness test** |
| EDIT-02 | Tenant A's `saveDraft` cannot touch tenant B's page row | isolation | same file, mirroring `tests/isolation/tenant-isolation.test.ts` | ❌ Wave 0 |
| **EDIT-03 / D-15** | **A Starter merchant with an ACTIVE trial has `canEditStorefront === true`; the same merchant with an expired trial has `false`; Business/Professional identical to each other** | **unit** | `tests/unit/entitlements.test.ts` (extend) | ✅ file exists, ❌ cases to add — **the D-15 trap** |
| EDIT-03 | `publishStorefront` refuses a post-trial Starter merchant by direct invocation (no UI) | isolation | `tests/isolation/storefront-editor.test.ts` | ❌ Wave 0 |
| D-11 | Known WCAG pairs produce the documented ratios (black/white = 21, identical = 1); `accentForeground` picks the higher-contrast option | unit | `vitest run --project unit tests/unit/contrast.test.ts` | ❌ Wave 0 |
| D-12 | Editor route contains no `data-surface="storefront"` and no `brand-accent` utility | unit | `tests/unit/surface-token-isolation.test.ts` (ban 4) + one new assertion | ✅ ban 4 exists, ❌ brand-accent assertion to add |
| Nav | `/dashboard/storefront-editor` reachable from the rail | unit | `tests/unit/dashboard-nav.test.ts` | ✅ exists — **add the href to `REQUIRED_HREFS` in the same commit** |
| Preview | Manual: as-you-type latency, correct breakpoints in the iframe, no flash of published content | manual | — | Real-device pass at the phase gate; no runner can judge "instant" |
| TMPL-01 | Manual: side-by-side distinctiveness / "would a stranger think this cost money" | manual | — | **STATE.md's named Phase 4 risk. Must be an explicit `checkpoint:human-verify` task in the plan, not an implied review** |

### Sampling Rate

- **Per task commit:** `npm run test:unit && npm run lint && npm run typecheck`
- **Per wave merge:** `npm run test:full`
- **Phase gate:** full suite green, plus two manual checkpoints — the live-preview device pass and the design-distinctiveness side-by-side

### Wave 0 Gaps

- [ ] Prisma migration: `StorefrontTheme`, `StorefrontPage`, `Organization.industry` — **blocks everything**
- [ ] `TENANT_SCOPED_MODELS` registration + `tests/setup/seed-two-tenants.ts` fixtures for both new models (Pitfall 6 — all three parts in one task)
- [ ] `src/server/theming/schema.ts` — the discriminated union; **blocks the registry, the actions, the renderer and the preview**
- [ ] `src/server/theming/registry.ts` + `defaults.ts` + `strings.flagship.*`
- [ ] `src/lib/contrast.ts` + `tests/unit/contrast.test.ts`
- [ ] `src/lib/editor/reducer.ts` + `tests/unit/editor-reducer.test.ts`
- [ ] `PlanLimits.storefrontEditor` + `MerchantContext.canEditStorefront` + `assertCanEditStorefront` + `EditorLockedError` wiring in `merchantAction`'s catch
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

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json` — treated as enabled.

### Applicable ASVS Categories

| ASVS category | Applies | Standard control in this phase |
|---|---|---|
| V2 Authentication | yes (indirect) | Better Auth session via `requireMerchantContext()`; the `/preview` route is deliberately **unauthenticated** because it serves only already-public data |
| V3 Session Management | yes | Session cookie stays host-only on the apex (Phase 1 D-07). The preview iframe is a different host and receives **no** session — verify no new code widens the cookie `Domain` |
| V4 Access Control | yes | `assertCanEditStorefront` server-side (EDIT-03); `merchantAction`'s write gate; `scopedDb` tenant scoping on both new models. The disabled Publish button is never the control |
| V5 Input Validation | yes | `hexColorSchema`, `storageKeySchema`, `pageDocumentSchema` on **every** boundary: Server Action input, `postMessage` payload, and JSONB read-back |
| V6 Cryptography | no | No new secrets, tokens, or hashing. R2 presigning is unchanged |
| V7 Error Handling & Logging | yes | A degraded parse logs `console.error` with the tenant id and **never** a storage key or presigned URL (Phase 3 T-03-27) |
| V12 File Upload | yes | Unchanged controls: content-type and content-length are in the SigV4 signature; Sharp re-encode is the sanitiser; SVG remains excluded; the original is never publicly served |
| V14 Configuration | yes | No new env var. Do not add a blanket `frame-ancestors 'none'` while `/preview` exists |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Cross-origin `postMessage` accepted from a hostile framing page | Spoofing / Tampering | Exact `event.origin` check before reading `event.data`; Zod-validate the payload; exact `targetOrigin` on send |
| Merchant-controlled colour injected into a CSS custom property | Tampering / XSS-adjacent | `hexColorSchema` on write **and** on read; fail closed to the default |
| Merchant-controlled storage key rendered as an image `src` | Tampering | `storageKeySchema` regex; `publicUrlFor()` already refuses an `/original` key; `next.config.ts` `remotePatterns` restricts the host |
| Direct POST to `saveDraft`/`publishStorefront` from an expired trial or a Starter merchant | Elevation of privilege | `merchantAction({ mode: "write" })` refuses before the parse; `assertCanEditStorefront` refuses inside the handler |
| Direct POST to the widened `/api/upload/finalize` with `kind: "logos"` and someone else's upload id | Information disclosure / Tampering | The key is recomputed from `ctx.tenantId`; the route never accepts a key; `objectKeyFor` throws on a malformed id |
| Cross-tenant write via a forged `tenantId` in the editor payload | Elevation of privilege | The schema contains no tenant field; `scopedDb` stamps `tenantId` **last** in the spread |
| Unauthenticated write amplification on a public storefront hit | Denial of service | Read-only fallback on the public path; seeding only in authenticated paths (Pitfall 11) |
| Preview URL indexed / shared publicly | Information disclosure | `robots: { index: false }`; the route exposes only already-public data, so leakage impact is nil by design |
| A schema change taking every live storefront offline | Denial of service | `version` field + `safeParse`-with-defaults on the read path; strict `parse` on the publish path (Pitfall 9) |

---

## Sources

### Primary (HIGH confidence)

- **This codebase, read directly:** `src/proxy.ts`, `src/app/s/[slug]/{layout,page}.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/onboarding/{create-store,plan}/page.tsx`, `src/server/entitlements/{plans,resolve,assert}.ts`, `src/server/merchant/{action,context,actions}.ts`, `src/server/db/{tenant-scoped,platform}.ts`, `src/server/images/{pipeline,r2,actions}.ts`, `src/app/api/upload/finalize/route.ts`, `src/server/auth/auth.ts`, `src/server/tenant/{resolve,cache}.ts`, `src/server/orders/tracking-token.ts`, `src/server/catalog/actions.ts` (reorder pattern), `prisma/schema.prisma`, `next.config.ts`, `vitest.config.ts`, `package.json`
- **Contract tests, read directly:** `tests/unit/surface-token-isolation.test.ts` (bans 1–5), `tests/unit/dashboard-nav.test.ts` (`REQUIRED_HREFS`, prose scan), `tests/unit/storefront-link-prefix.test.ts`, `tests/isolation/model-registry-drift.test.ts`, `tests/setup/seed-two-tenants.ts`
- **Installed package source:** `node_modules/next/dist/docs/01-app/02-guides/draft-mode.md` (Next 16.3.1's own Draft Mode guide — what it does and does not bypass); `node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs` (`baseUpdateOrganizationSchema` includes a client-settable `logo`); `node_modules/tw-animate-css/dist/tw-animate.css` (`@utility` list confirming `fade-in`, `slide-in-from-bottom-*`, `delay-*`, `animation-duration-*`, `fill-mode-*`)
- [WCAG 2.2 Understanding SC 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) — contrast-ratio and relative-luminance formulas, the 4.5:1 / 3:1 thresholds, and the do-not-round instruction
- [Prisma schema reference](https://www.prisma.io/docs/orm/reference/prisma-schema-reference) — `Json` maps to PostgreSQL `jsonb` by default; `@db.Json` / `@db.JsonB` native attributes; no declarative `DEFERRABLE` support
- **The flagship reference zip**, `C:\Users\LFD Service\Downloads\einort-commerce.zip` — extracted and read `src/pages/storefront/StoreHome.tsx`, `StoreLayout.tsx`, `src/components/ui/Motion.tsx`. Visual/structural direction only; its hardcoded `zinc-*` utilities would fail ban #2 and must not be ported

### Secondary (MEDIUM confidence)

- [Shopify: Integrate sections and blocks with the theme editor](https://shopify.dev/docs/storefronts/themes/best-practices/editor/integrate-sections-and-blocks) — confirms the editor fires DOM events *inside the theme preview document* (i.e. a separate document) and re-renders a section on settings change (`shopify:section:load`). Corroborates the iframe architecture; this project's client-render variant is a deliberate improvement for the target network
- [Shopify: Sections](https://shopify.dev/docs/storefronts/themes/architecture/sections) and [JSON templates](https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates) — via `.planning/research/ARCHITECTURE.md`'s existing citations; the "structure as data, rendering as code" split and the whole-page-as-one-JSON precedent
- `.planning/research/ARCHITECTURE.md` Pattern 3 and Anti-Pattern 3 — the project's own prior research, including its explicit sanctioning of the single-JSON-per-page variant
- `.planning/phases/03-.../03-CONTEXT.md` and `03-RESEARCH.md` — the R2/Sharp reuse contract (D-07), the storefront placeholder's stated Phase 4 fate, `createLimiter` not being exported

### Tertiary (LOW confidence — flagged, not relied on)

- Assumption A2 (React 19's exact handling of custom properties in the `style` prop) — not verified against React source this session. The prescribed mitigation (validate hex on write and read, fail closed) is correct either way, so nothing depends on resolving it
- Assumption A4 (no CSP / `frame-ancestors` set at the Vercel project level) — verified absent from this repo, not from the deployment platform

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Standard stack (zero installs) | HIGH | Every capability verified present in `package.json` / `node_modules` by reading the installed source |
| Schema + draft/publish model | HIGH on mechanics, MEDIUM on shape choice | The `$executeRaw` ban and Prisma's column-assignment limit are verified facts; whether the user prefers the document model is Open Question 1 |
| Live-preview architecture | HIGH | Forced by three independently verified constraints (proxy 404, ban #4 + D-12, iframe viewport) |
| Registry + discriminated union | HIGH | Standard Zod 4 API, mirrors three existing registries in this codebase |
| Entitlement gate + the D-15 trap | HIGH | Found by reading `resolve.ts`/`plans.ts`; the bug is real, not hypothetical |
| Logo pipeline reuse | HIGH | Both reusable slots read from source, both hardcoded call sites identified |
| Contrast maths | HIGH | W3C primary source, transcribed not recalled |
| Flagship section catalogue | HIGH on inventory, MEDIUM on the two deviations | Inventory read from the reference; deviations are Open Questions 2 and 6 |
| Motion language | HIGH on values and utility availability, MEDIUM on scroll-reveal approach | Values read from the reference; utilities read from the installed package |
| Pitfalls | HIGH | Nine of twelve are derived from contract tests or installed source read this session |

**Research date:** 2026-09-01
**Valid until:** 2026-10-01 (30 days — the stack is pinned and this phase's dependencies do not move; re-verify only if Next, Prisma, or Better Auth are upgraded)
