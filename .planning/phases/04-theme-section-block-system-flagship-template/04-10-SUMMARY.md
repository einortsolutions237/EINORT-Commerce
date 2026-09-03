---
phase: 04-theme-section-block-system-flagship-template
plan: 10
subsystem: storefront-render-assembly
tags:
  [
    react-server-components,
    css-custom-properties,
    wcag-contrast,
    theme-chrome,
    react-cache,
    next-image,
    tenant-isolation,
    zod-read-validation,
  ]

# Dependency graph
requires:
  - phase: 04-theme-section-block-system-flagship-template
    plan: 02
    provides: "hexColorSchema (the anchored 6-digit regex re-run on READ here) and themeTokensSchema's announcementText / footerTagline"
  - phase: 04-theme-section-block-system-flagship-template
    plan: 04
    provides: "the five --brand-accent* fallbacks in globals.css's storefront scope, deriveThemeCssVars / accentForeground in src/lib, and strings.flagship"
  - phase: 04-theme-section-block-system-flagship-template
    plan: 08
    provides: "SectionRenderer — the exhaustive five-arm switch this page maps the document through"
  - phase: 04-theme-section-block-system-flagship-template
    plan: 09
    provides: "getPublishedStorefront(tenantId) — the one theming read, safe-parsed with flagship fallbacks and provably write-free"
  - phase: 03-product-catalog-order-payment-claim-state-machine
    provides: "listStorefrontProducts / listStorefrontCategories, getPaymentSettings, the wa.me host and MSISDN pattern in payments/whatsapp.ts, publicUrlFor, and the Phase 3 header this plan lifts into the layout"
provides:
  - "src/app/s/[slug]/layout.tsx — the ONE brand-token injection site: read-side hex re-validation, deriveThemeCssVars spread onto the existing data-surface div, the announcement bar, and the header/footer mount"
  - "src/app/s/[slug]/store-footer.tsx — StoreFooter, three rows and no links"
  - "src/app/s/[slug]/store-header.tsx — translucent sticky band with a logo-or-wordmark branch"
  - "src/app/s/[slug]/page.tsx — the flagship home: published.document.sections mapped through SectionRenderer with one StorefrontRenderData bundle"
  - "buildWhatsAppContactLink(msisdn) in src/server/payments/whatsapp.ts — the null-returning sibling of the throwing order-link builder"
  - "getPublishedStorefront is now React cache()-wrapped, so the layout and the page share one read"
affects:
  [04-14-preview-canvas, 05-industry-templates, seo-and-metadata-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A write-side schema re-run on the READ path, failing closed to a default instead of throwing, because the value's destination (a CSS custom property set via setProperty) does not sanitise and a render path must never take a storefront down over a colour"
    - "Derived-not-stored accessibility values: the merchant picks two colours and the foregrounds and focus ring are computed server-side, so an unreadable pair is unrepresentable rather than merely discouraged"
    - "Chrome as theme settings rather than sections, so the same branding reaches routes that are deliberately NOT merchant-editable — the boundary that keeps a reorderable document away from checkout"
    - "React cache() as the dedupe for a read two levels of the same render tree both need, chosen over widening a cross-request Redis cache whose invalidation obligation would surface as a stale accent after publish"
    - "A second builder beside an existing one, differing only in its failure posture (null vs throw), because the same URL is assembled on a gated path and on an anonymous public one"

key-files:
  created:
    - src/app/s/[slug]/store-footer.tsx
  modified:
    - src/app/s/[slug]/layout.tsx
    - src/app/s/[slug]/store-header.tsx
    - src/app/s/[slug]/page.tsx
    - src/app/s/[slug]/cart/page.tsx
    - src/app/s/[slug]/checkout/page.tsx
    - src/app/s/[slug]/p/[productSlug]/page.tsx
    - src/server/theming/queries.ts
    - src/server/payments/whatsapp.ts

key-decisions:
  - "getPublishedStorefront is wrapped in React's cache() rather than accepting a second indexed read. The plan offered both; cache() wins because the two callers are the layout and the page of the SAME render pass, which is precisely what resolveTenantBySlug already uses cache() for on this route tree — the alternative would have made this the one storefront read that does not dedupe. Cross-request caching stays out (T-04-28)"
  - "The logo src goes through publicUrlFor rather than a threaded imageBaseUrl prop. The plan preferred the prop for symmetry with sections/, but that symmetry exists because sections/ must stay client-safe and StoreHeader is unambiguously server-only (it awaits the cart). publicUrlFor carries the /original refusal that the T-04-15 mitigation explicitly names, and hand-concatenating would have dropped a stated control for a cosmetic consistency"
  - "The footer copyright is assembled inline as `© ${year} ${storeName}` and NOT added to strings.ts. It contains no translatable word, and the plan's own Task 3 criterion requires src/lib/strings.ts to be byte-unchanged by this plan — 04-PATTERNS names that file as the phase's likeliest parallel-wave conflict. Recorded rather than silently chosen; see Judgement Calls"
  - "buildWhatsAppContactLink returns null on a bad or absent number where buildWhatsAppOrderLink throws. The order link is built after a gated checkout, so a malformed number there must be loud; this one is built on the anonymous render path for a merchant who may never have opened the payment settings page, and a throw would take a live storefront down over an unconfigured field"
  - "The home page's static metadata became generateMetadata returning the store name. With the placeholder branch retired, the pinned title would have shipped a live storefront advertising itself as not yet open in every browser tab and search result"

requirements-completed: [TMPL-01, EDIT-01]

# Metrics
duration: ~35min
completed: 2026-09-03
---

# Phase 4 Plan 10: Storefront Render Assembly Summary

**The moment the phase becomes visible to a real customer: a shopper on `{slug}.einort.com` now gets the merchant's published five-section flagship, tinted with their accent, under a translucent logo-bearing header and above a three-row footer — with the accent's foregrounds and focus ring derived server-side so no merchant colour can produce an unreadable button label on a route tree that contains checkout.**

## Performance

- **Duration:** ~35 min, including worktree environment repair
- **Tasks:** 3, all `type="auto"`, three commits
- **Files created:** 1. **Modified:** 8
- **Gates:** `npm run typecheck` 0 · `npm run lint --max-warnings=0` 0 · `npm run test:unit` 566/566 across 32 files · `npm run build` succeeded

## Accomplishments

- **The five `--brand-accent*` values are injected exactly once, and the line that injects them holds no colour.** `deriveThemeCssVars(tokens)` is spread onto the `style` of the **existing** `data-surface="storefront"` div — no second wrapper, attribute not moved. `grep -cE "#[0-9a-fA-F]{6}|oklch\(|rgb\(|hsl\("` over the layout on non-comment lines returns **0**, and `grep -c 'data-surface="storefront"'` returns **1** (the comments that explain the rule were reworded so they do not spell the token they discuss, the same discipline plan 04-08 recorded).
- **Pitfall 3 is closed on the read side, and it is not redundant.** `hexColorSchema.safeParse` runs on both accents **in the layout**, falling back to `DEFAULT_PRIMARY_ACCENT` / `DEFAULT_SECONDARY_ACCENT`. React sets custom properties through `setProperty`, which does not sanitise, so a value like `red; background-image: url(https://evil/x)` arriving from a bad backfill or a manual SQL fix is stopped by this anchored regex and by nothing else downstream (T-04-09, ASVS V5). It fails **closed to the default** and never throws — a live storefront going white is strictly worse than one rendering in zinc.
- **A merchant cannot produce an unreadable button or an invisible focus ring.** Only the two accents are stored; `--brand-accent-foreground`, `--brand-accent-secondary-foreground` and `--brand-accent-ring` are computed by `accentForeground()` / `contrastRatio()` at render. That asymmetry is written into the layout's header with the reason: WCAG 1.4.3 / 1.4.11 on a tree containing `/cart`, `/checkout` and `/order/[token]` is not merchant-discretionary, and D-11's non-blocking warning is reserved for the accent-as-link taste call (T-04-03).
- **A tenant with no `StorefrontTheme` row renders correctly, with no database error and no extra query.** `getPublishedStorefront` already degrades a missing row to `flagshipDefaultTokens()`, and the `globals.css` storefront scope declares all five properties as `var()` references, so the injected `style` is an *override on a scope that already resolves* rather than the only source. Nothing on this path writes (T-04-11) — no lazy seed, no cache write, no Redis widening.
- **`/` renders the merchant's document, not a hardcoded grid.** `published.document.sections.map(...)` through `SectionRenderer`. `grep -c "aspect-square\|grid-cols-4"` over `page.tsx` returns **0** — the tile markup lives in `product-grid-section.tsx` where plan 04-08 put it. The `?category=` search param still reaches `listStorefrontProducts` at the database layer, still through exactly **one** call, and now arrives at the section as `data.activeCategorySlug`.
- **The Phase 1 full-page placeholder is retired on `/`, and its copy is untouched.** `git diff src/lib/strings.ts` is **empty** for this plan. `strings.storefront.emptyHeading` / `.emptyBody` are now rendered by the product-grid section's dashed in-section block, between a real hero and a real contact band — a store with zero products gets a finished page instead of a centred paragraph on white (04-UI-SPEC § S3 Empty).
- **The WhatsApp href is server-built and the phone number never leaves the RSC.** `page.tsx` reads `getPaymentSettings(tenant.id)` and passes the finished `wa.me` URL — or `null` — into the render bundle. No raw number appears in any prop crossing into a section, and `null` produces a shorter contact band rather than a dead CTA (T-04-26).
- **The chrome is now genuinely shared.** Header, announcement bar and footer are mounted once in the layout, so they reach `/`, the PDP, `/cart`, `/checkout` and `/order/[token]` identically — which is the entire argument for modelling them as theme settings instead of sections (Pattern 12). The three pages that mounted their own header in Phase 3 no longer do, and each carries a one-line note saying where it went.
- **The header shows a logo or a wordmark, never both, and never a cropped logo.** `object-contain` + `w-auto` + `h-7 md:h-8`, `alt={storeName}`, in a single ternary. The canonical origin-relative-links comment block — including the sentence forbidding a relaxation of the `/s/` check in `src/proxy.ts` — survives the edit verbatim, and `tests/unit/storefront-link-prefix.test.ts` passes.

## Task Commits

1. **Task 1 — brand-token injection, announcement bar and chrome mount in the layout** — `535907e`
2. **Task 2 — the logo-aware translucent header and the three-row footer** — `8137eec`
3. **Task 3 — page.tsx renders the published document** — `9992558`

## Files Created

- `src/app/s/[slug]/store-footer.tsx` — `StoreFooter`. `border-t border-border py-12 md:py-16` frame, `mx-auto max-w-7xl px-6 md:px-8` inner; wordmark, `mt-4` tagline (dropped when the theme setting is blank), and a `mt-8 border-t pt-6` copyright rule. `grep -c "href="` returns **0**. The header names Pattern 9 deviation 3 and states, in all caps, that the missing link columns are a decision and not an unfinished footer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Mounting the header in the layout would have drawn two headers on four routes**

- **Found during:** Task 1
- **Issue:** Phase 3 mounted `<StoreHeader>` per page — `cart/page.tsx`, `checkout/page.tsx`, `p/[productSlug]/page.tsx` and both branches of `page.tsx`. Task 1 moves it into the layout, which every one of those routes is nested inside, so each would have rendered two sticky bands stacked on top of each other
- **Fix:** Removed the render and the import from all four pages, leaving a one-line comment at each site pointing at the layout and citing Pattern 12, so the next person to wonder where the header went does not re-add it
- **Files modified:** `src/app/s/[slug]/cart/page.tsx`, `src/app/s/[slug]/checkout/page.tsx`, `src/app/s/[slug]/p/[productSlug]/page.tsx`, `src/app/s/[slug]/page.tsx`
- **Commits:** `535907e` (cart, checkout, PDP), `9992558` (home)

**2. [Rule 1 — Bug] A live storefront's browser tab said the store was not open yet**

- **Found during:** Task 3
- **Issue:** `page.tsx` exported a static `metadata` pinned to `strings.storefront.heading` — the Phase 1 placeholder heading. That was true while the page WAS the placeholder. With the placeholder branch retired, every published flagship storefront would have shipped that heading as its `<title>`, in the browser tab and in any search result
- **Fix:** Replaced with `generateMetadata` returning `{ title: tenant.name }`, and `{}` for an unresolved slug so a suspended and a nonexistent tenant still respond identically (D-05). `resolveTenantBySlug` is `cache()`-wrapped, so this costs no extra query
- **Files modified:** `src/app/s/[slug]/page.tsx`
- **Commit:** `9992558`

**3. [Rule 2 — Missing functionality] There was no builder for a contact-only `wa.me` link**

- **Found during:** Task 3
- **Issue:** The plan says to call the existing CHK-02 builder. `buildWhatsAppOrderLink` requires a message body and **throws** on a number that fails the MSISDN pattern. Neither fits: the contact band has no order to describe, and it renders on the anonymous public path for merchants who may never have saved a number — a throw there takes the whole storefront down over an unconfigured optional field. Assembling the URL inline in `page.tsx` was the other option and would have put a second spelling of the `wa.me` host and number rules outside `src/server/payments/**`, which `render-data.ts` explicitly warns against
- **Fix:** Added `buildWhatsAppContactLink(msisdn: string | null): string | null` beside the order builder, sharing the same `WA_MSISDN_PATTERN`. Same host, no `text` parameter, `null` instead of a throw. Its doc comment states why the two builders differ in failure posture so neither is later "made consistent" with the other
- **Files modified:** `src/server/payments/whatsapp.ts`
- **Commit:** `9992558`

**4. [Rule 3 — Blocking] Worktree shipped with no installed dependencies or generated artifacts**

- **Found during:** setup, before the first gate run
- **Issue:** The freshly spawned worktree had no `node_modules`, no `src/generated/prisma`, no `.env.local`, no `.env.test` and no `.next` — all gitignored. Without `.next`, `tsc` reports pre-existing `Cannot find name 'PageProps'` errors in files this plan does not touch, because Next 16 generates those global route types at build time
- **Fix:** Copied all five from the main checkout at `D:\Maxs\Claude\einort-commerce`, as real copies rather than junctions. Identical to the repair plans 04-07 and 04-08 documented in earlier waves. A baseline `npm run typecheck` was run before any edit and was clean, so nothing below is confounded by a broken environment
- **Files modified:** none — every restored path is gitignored and nothing was committed

### Judgement calls recorded rather than auto-fixed

- **The footer copyright is not a `strings` entry, and the plan asks for both.** Task 2 says "the copy template comes from `strings`, not an inline literal"; Task 3's acceptance criteria say `git diff src/lib/strings.ts` must be empty for this plan. There is no existing copyright key to read, so the two cannot both hold by adding one. The tie was broken toward leaving `strings.ts` alone: 04-PATTERNS names it the phase's single most likely parallel-wave merge conflict, plan 04-04 owns it, and three sibling executors are running against the same base. The rendered value is `` `© ${year} ${storeName}` `` — a symbol, a number and the merchant's own name, with **no translatable word in it**, so it is not the kind of thing C-14's catalogue exists to capture. The reason is written into the file. If a later plan does add a `strings.flagship.footerCopyright` template, this is a one-line change.
- **`publicUrlFor` over a threaded `imageBaseUrl` prop for the logo.** The plan preferred the prop "for symmetry with the sections". That symmetry exists for a specific reason — everything under `sections/` must stay client-safe for the editor preview — and `StoreHeader` is not in that category: it already awaits `getCurrentCart` and `hydrateCart`. Meanwhile `publicUrlFor` refuses a key ending in `/original` (T-03-28), and the T-04-15 register entry names that refusal as part of the mitigation. Concatenating by hand would have satisfied the stylistic preference by discarding a control the threat model claims is present.
- **The three commits are one render-tree change and are not individually buildable.** Task 1's layout imports `store-footer.tsx`, which Task 2 creates; Task 2's `StoreHeader` gains a required prop that Task 3's `page.tsx` rewrite is what stops passing incorrectly. Committing in plan order keeps the history readable against the plan, at the cost of two intermediate trees that would not typecheck in isolation. All four gates were run on the complete change before the first commit and again after the final edit; the wave merges as a unit. An alternative 3→2→1 ordering would have been individually green but reads backwards against the plan it implements.
- **`/preview` does not exist yet, so the token-injection claim is currently proven on the live route only.** Plan 04-14 builds the editor's preview canvas, which must apply the same five values inside the iframe by calling the same `deriveThemeCssVars`. The layout's header records that obligation.

## Authentication Gates

None. This plan installs nothing, reaches no network, and touches no credentialed surface.

## Threat Flags

| Flag                          | File                                | Description                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| threat_flag: outbound-link    | `src/server/payments/whatsapp.ts`   | `buildWhatsAppContactLink` is a new outbound-URL builder on the public render path. The number segment is pattern-checked before interpolation and there is no `text` parameter to encode, so the surface is narrower than the order link's; flagged only because it is a **new** builder that a later caller could reach for without noticing the null-vs-throw split is deliberate.                |
| threat_flag: metadata-read    | `src/app/s/[slug]/page.tsx`         | `generateMetadata` now emits `tenant.name` — merchant-controlled text — into the document title. Next escapes it and `Organization.name` is already rendered as visible copy on every storefront route, so this introduces no new trust boundary; recorded because it is the first merchant value to reach a `<head>` element rather than the body.                                                 |

Everything else this plan sits on is in the plan's own register and mitigated as written: the accents are re-validated on read and fail closed (T-04-09); the derived foregrounds and ring are computed server-side (T-04-03); the surface attribute and the tokens stay on the one div and both bans pass (T-04-02); no write occurs on the render path and no Redis cache was widened (T-04-11, T-04-28); `logoKey` reaches `next/image` through `publicUrlFor` under the `remotePatterns` allowlist (T-04-15); every link is origin-relative and `storefront-link-prefix` passes (T-04-07); the `wa.me` href is server-built and the anchor carries `rel="noopener noreferrer"` from plan 04-08 (T-04-26). No package was installed (T-04-SC).

## Known Stubs

None. Every value the layout and the page pass down is read from the database or the validated env, and both `StorefrontRenderData` fields that plan 04-07 declared ahead of a consumer — `activeCategorySlug` and `whatsappHref` — are now produced by real reads rather than placeholders.

Two things are deliberately deferred and are not stubs:

- **`/preview` is not wired.** Plan 04-14 owns the editor's preview canvas, which must call `deriveThemeCssVars` inside the iframe so the merchant's keystroke-level preview and the live storefront cannot disagree about what a colour resolves to. The layout's header records this.
- **The PDP, cart, checkout and tracking routes are fixed, not unfinished.** They receive the brand tokens from the layout and are never section-rendered, this phase or later — the reason is written into `page.tsx`'s header and `section-renderer.tsx`'s.

## Self-Check: PASSED

- `src/app/s/[slug]/store-footer.tsx` — FOUND
- `src/app/s/[slug]/layout.tsx` — FOUND
- `src/app/s/[slug]/store-header.tsx` — FOUND
- `src/app/s/[slug]/page.tsx` — FOUND
- commit `535907e` — FOUND
- commit `8137eec` — FOUND
- commit `9992558` — FOUND
