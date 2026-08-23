# EINORT-Commerce-Front-End — Merchant Platform Design Source

Registration and token analysis of the **dedicated design reference for EINORT's merchant platform surfaces** — the merchant dashboard and the platform Super Admin console. This is a different kind of artifact from the other four files in this directory: `FRAMER-TEMPLATE-REFERENCES.md`, `AWWWARDS-REFERENCES.md`, `RECENT-DESIGN-REFERENCES.md` and `SHOPIFY-THEME-STORE-RESEARCH.md` are all *research passes over third-party catalogues* — inspiration gathered to inform decisions not yet made. This one is not research. It is a design the project owner **supplied for this product**, and it settles decisions rather than informing them. Where the other four say "here is what the market does," this one says "here is what EINORT's merchant platform looks like."

## What this is and where it came from

- **Source:** private GitHub repo `https://github.com/njeirheinard21-ai/Einort-Commerce-Front-End`, supplied by the project owner.
- **Provenance:** generated with Google AI Studio as a **Vite + React** prototype. It is not a Next.js app, does not share this project's routing or data model, and was never intended to be production code.
- **Status:** **visual and token reference only. Its code is not to be ported.** Read it for palette, radius, typography, spacing rhythm and component silhouette. Do not copy components, hooks, routing, or state management out of it. Where its markup and this project's markup disagree, this project's markup wins — the reference has no server actions, no auth, no tenant scoping, and no awareness of the constraints in `CLAUDE.md`.
- **Local availability:** the repo was cloned to a scratchpad directory for the inspection that produced this document. **That clone is ephemeral and will not be there for you.** Re-clone from the URL above if you need to look at a specific component. Everything in the "Confirmed token values" section below was read directly out of the reference's `src/index.css` and is reproduced here precisely so that most future work does *not* need the clone.

## Confirmed token values

Read directly from the reference's `src/index.css`. The reference declares its palette in **hex**; this project's `src/app/globals.css` is **uniformly oklch and must stay that way**, so the oklch equivalents (computed sRGB → Oklab) are given alongside and are the column to actually use when editing `globals.css`.

**Brand — blue** (the standard Tailwind blue ramp), reference `--color-brand-*`:

| Token | Hex | oklch |
|-------|-----|-------|
| brand-300 | `#93c5fd` | `oklch(0.809 0.096 251.8)` |
| brand-400 | `#60a5fa` | `oklch(0.714 0.143 254.6)` |
| brand-500 | `#3b82f6` | `oklch(0.623 0.188 259.8)` |
| brand-600 | `#2563eb` | `oklch(0.546 0.215 262.9)` |

**Surface — slate** (the standard Tailwind slate ramp), reference `--surface-*`:

| Token | Hex | oklch |
|-------|-----|-------|
| slate-50  | `#f8fafc` | `oklch(0.984 0.003 247.9)` |
| slate-100 | `#f1f5f9` | `oklch(0.968 0.007 247.9)` |
| slate-200 | `#e2e8f0` | `oklch(0.929 0.013 255.5)` |
| slate-300 | `#cbd5e1` | `oklch(0.869 0.020 252.9)` |
| slate-400 | `#94a3b8` | `oklch(0.711 0.035 256.8)` |
| slate-500 | `#64748b` | `oklch(0.554 0.041 257.4)` |
| slate-600 | `#475569` | `oklch(0.446 0.037 257.3)` |
| slate-800 | `#1e293b` | `oklch(0.279 0.037 260.0)` |
| slate-900 | `#0f172a` | `oklch(0.208 0.040 265.8)` |
| slate-950 | `#020617` | `oklch(0.129 0.041 264.7)` |

**Accent — gold**, reference `--color-accent-*`:

| Token | Hex | oklch |
|-------|-----|-------|
| gold-100 | `#FBFBF0` | `oklch(0.985 0.014 106.7)` |
| gold-500 | `#D4AF37` | `oklch(0.767 0.139 91.1)` |
| gold-900 | `#4A3B09` | `oklch(0.359 0.067 91.0)` |

**Ancillary facts, all confirmed by direct inspection:**

- **Radius: `--radius: 0.75rem`.** This project shipped `0.625rem` through Phase 1-2 (the shadcn default) and was corrected to `0.75rem` by the `260823-gu4` retrofit. Noticeably softer corners on cards and buttons.
- **`--ring` maps to brand-500, not brand-600.** The focus ring is deliberately one step lighter than the primary fill — the ring reads as a halo beside a filled button rather than merging into it. Do not "tidy" this into brand-600.
- **Dark mode is a real, full surface inversion**, not scaffolding. The reference's `.dark` swaps the surface scale end-for-end (50↔950, 100↔900, 200↔800, 300↔700, 400↔600, with 500 fixed as the pivot) and then re-derives `--background` / `--foreground` / `--card` / `--border` from the swapped scale. **The brand and accent scales are not inverted** — blue and gold hold their values across appearances; only the neutral chrome flips. Primary does lift from brand-600 to brand-500 on dark so it keeps contrast against a slate-950 field.
- **Two fonts, split by role.** `--font-sans: "Plus Jakarta Sans"` for body copy, labels, buttons and data. `--font-display: "Outfit"` for heading-role elements. This project already had Plus Jakarta Sans wired correctly from Phase 1; Outfit was absent until the retrofit added it via `next/font/google` as `--font-heading`.
- **Component idiom:** `rounded-lg`, `shadow-sm` on primary actions, and subtle `hover:bg-surface-50` hover states. Cards and buttons hover to a faint neutral, **not to gold** — gold appears only as a deliberate brand highlight, never as a generic hover colour. This distinction is why the retrofit introduced a separate `--gold-accent` token pair instead of repointing shadcn's `--accent` slot (which is the neutral-hover slot every ghost/outline button reads from) at gold.

## File inventory / coverage

The reference matters well beyond the token retrofit, because it covers three distinct surfaces — including the entire platform admin console, which nothing else in this directory addresses at all.

- **Merchant dashboard** (`src/pages/`): Dashboard, Orders, Products, Inventory, Customers, Payments, Delivery, Analytics, Domains, Storefront, Settings, Auth.
- **Platform Super Admin** (`src/pages/admin/`, ~20 pages): AdminOverview, Merchants, MerchantDetail, Stores, Orders, Products, Customers, Payments, Subscriptions, Usage, Domains, Themes, FeatureFlags, Fraud, Health, Errors, AuditLogs, Notifications, Support, Analytics, Settings.
- **Storefront** (`src/pages/storefront/`): StoreLayout, StoreHome, ProductDetails, Cart, Checkout.
- **Shell and primitives:** `components/layout/{AppShell,Header,Sidebar}`, `components/admin/layout/AdminShell`, `components/ui/{Button,Card,Input,Badge,Table,Tabs,Skeleton,PageSkeleton,EmptyState,SearchModal,Motion}`, `components/ThemeProvider`.
- **Tokens:** `src/index.css`.

## Canonical-source flag

**This repo is the canonical design source for (a) the `260823-gu4` token/typography retrofit and (b) all future `ui-phase` and `discuss-phase` work in Phases 3-6** covering merchant dashboard sections and the platform admin surface. A planner opening a dashboard or admin phase should re-clone it and design against it rather than inventing a look or reaching for the storefront references below.

**Known open item, deliberately deferred:** the reference's sidebar + header `AppShell` (and its `AdminShell` counterpart) is **not** implemented here. The `260823-gu4` retrofit was scoped to tokens and typography only, and the user explicitly locked two structural decisions for it: keep separate `/login` and `/signup` routes rather than the reference's combined split-screen mode-toggle page, and keep the existing centered-card layouts for onboarding/plan, dashboard, dashboard/plan and suspended. Adopting the app shell is legitimate Phase 3+ scope — it becomes worth building once there is real dashboard content to shell, and not before. Record it as *deferred by decision*, not as an oversight.

## Do-not-conflate cross-reference

There is a **second, earlier visual reference** in play, and the two have already been mixed up once at real cost. Keep them straight:

| Surface | Governing reference | Aesthetic |
|---------|--------------------|-----------|
| Merchant dashboard, platform admin, auth/onboarding | **This document** (`Einort-Commerce-Front-End`) | Blue brand / gold accent / slate surface, Outfit + Plus Jakarta Sans, `0.75rem` radius |
| Flagship storefront template | The earlier storefront/DTC flagship visual reference | Zinc monochrome, editorial DTC |

**What went wrong, so it does not recur:** Phase 1's `01-UI-SPEC.md` sourced its "Color" section from the *storefront* flagship reference — a zinc-monochrome editorial DTC palette designed for a shopper-facing template — and applied it to the entire **merchant platform**. Every merchant-facing surface shipped in Phases 1-2 consequently wore near-black zinc primary buttons and a pure-white page field, which is not what the owner's merchant-platform design specifies. The leading comment block in `src/app/globals.css` recorded that zinc palette as the contract; the `260823-gu4` retrofit rewrote both the tokens and that comment. The rule going forward is simple: **check which surface you are designing before you pick a palette.** A reference is scoped to a surface, not to the product.

**A second tension, flagged now rather than discovered later:** this reference carries its *own* storefront pages (`src/pages/storefront/`), which means the storefront surface now has **two candidate design sources** — the zinc/editorial DTC flagship reference, and this repo's blue/slate storefront treatment. They are not reconcilable by splitting the difference. Which one governs customer-facing storefront templates is a **deliberate decision for Phase 4-5 planning**, and it should be made explicitly and recorded, not resolved silently by whichever file a planner happens to open first. Note that the storefront route `src/app/s/[slug]/page.tsx` was deliberately left untouched by the `260823-gu4` retrofit precisely because that decision is still open.

## Implications for EINORT's phases

- **Phases 1-2 (done, retrofitted):** tokens and display typography now match this reference. Structure intentionally does not.
- **Phase 3+ (dashboard build-out):** design against this reference's `AppShell` / `Sidebar` / `Header` and the `src/pages/` dashboard screens. The token layer is already in place, so this becomes a layout-and-composition exercise rather than a re-skin — which is exactly why the retrofit was worth doing at 10 pages instead of at 40.
- **Phase 4-5 (storefront templates):** resolve the two-source storefront tension **first**, as a recorded decision, before any template work starts.
- **Platform admin surface:** this repo is currently the *only* design source that covers it. Any admin phase that does not open it is designing blind.
