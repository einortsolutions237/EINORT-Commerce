---
phase: 04-theme-section-block-system-flagship-template
plan: 07
subsystem: storefront-flagship-sections
tags: [react-server-components, client-safety, intersection-observer, tw-animate-css, tailwind-v4, motion, accessibility, discriminated-union, next-image, lucide]

# Dependency graph
requires:
  - phase: 04-theme-section-block-system-flagship-template
    plan: 02
    provides: "src/server/theming/schema.ts — the SectionInstance discriminated union every section's props are narrowed out of, and the module deliberately built marker-free so this client-safe directory can reach it"
  - phase: 04-theme-section-block-system-flagship-template
    plan: 04
    provides: "the storefront design tokens in globals.css — the zinc set, --brand-accent*, the six --motion-* tokens and the prefers-reduced-motion floor; plus strings.flagship, which supplies the default document these sections render"
  - phase: 03-product-catalog-order-payment-claim-state-machine
    provides: "IMAGE_PRESETS.product (labels thumb/card/detail) whose widest derivative both image-bearing sections address; the imageBaseUrl-as-a-prop precedent from image-gallery-field.tsx; the Label/Body utility spellings already used on src/app/s/[slug]/page.tsx"
provides:
  - "src/app/s/[slug]/sections/render-data.ts — StorefrontRenderData / StorefrontRenderProduct / StorefrontRenderCategory, the client-safe data contract every flagship section receives. Zero imports, zero runtime output"
  - "src/app/s/[slug]/sections/reveal.tsx — <Reveal>, the phase's only motion primitive: one-shot IntersectionObserver, visible-by-default, unanimated under reduced motion"
  - "src/app/s/[slug]/sections/hero-section.tsx — HeroSection (S1), with an image mode and a first-class no-image mode"
  - "src/app/s/[slug]/sections/trust-bar-section.tsx — TrustBarSection (S2), the secondary accent's 8% wash band"
  - "src/app/s/[slug]/sections/editorial-split-section.tsx — EditorialSplitSection (S4), the page's only inverted ink band"
affects: [04-08-remaining-sections, 04-09-section-renderer, 04-10-storefront-read-path, 04-14-preview-canvas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A whole route subdirectory declared client-safe by convention and defended by a per-file grep: nothing under sections/ may reach a server-only module, because the preview canvas is a client component that transitively imports every section"
    - "Structural redeclaration instead of a type-only import across a trust boundary — render-data.ts restates the product/category shapes rather than importing them from server-only queries, so no future edit can turn a type import into a value import"
    - "Section props narrowed out of the discriminated union with Extract<SectionInstance, { type: X }>[\"settings\"] rather than a hand-written interface, so a settings rename is a compile error at the component"
    - "Motion as progressive enhancement with an inverted default: the wrapper renders visible and unanimated and the observer only ADDS animation classes, so no-JS, no-IntersectionObserver and reduced-motion all land on the same safe state without a branch each"
    - "Two designs per section, not one design plus a fallback: the hero's no-image mode and the editorial split's no-image collapse are the day-one states and are specified as fully as the image modes"
    - "A merchant-supplied value reaches a style attribute only as a NUMBER (overlayOpacity, a stagger index); the colour beside it is always a token utility, so there is no colour string on the injection path"
    - "The pill radius on marketing CTAs is deliberately inconsistent with the 0.25rem transactional buttons, and the file says so, because the shape is how a shopper tells a story button from a money button"

key-files:
  created:
    - src/app/s/[slug]/sections/render-data.ts
    - src/app/s/[slug]/sections/reveal.tsx
    - src/app/s/[slug]/sections/hero-section.tsx
    - src/app/s/[slug]/sections/trust-bar-section.tsx
    - src/app/s/[slug]/sections/editorial-split-section.tsx
  modified: []

key-decisions:
  - "The hero's <h1> id is a module constant (HERO_HEADING_ID) rather than a useId() value or a threaded prop. useId is a hook and these components are deliberately hook-free so they render from both the RSC tree and the client preview canvas; D-05 fixes the section list at five entries with exactly one hero, so precisely one element in the document ever carries the id and the aria-labelledby link is unambiguous by construction"
  - "The trust bar's column mapping is four explicit comparisons in a small function, not a Readonly<Record<1|2|3|4, string>>. The Record is the better shape when the key is an enum the compiler already knows, but blocks.length is typed number — a keyed lookup would need a cast to convince TypeScript of what the schema's .min(1).max(4) already guarantees, and a cast to satisfy a lookup is worse than a total function. The ICON mapping, whose key IS the z.enum, stayed a Record with no fallback arm exactly as the plan requires"
  - "The reveal class combination is duplicated as a local constant in trust-bar-section.tsx and editorial-split-section.tsx rather than exported from reveal.tsx. reveal.tsx carries \"use client\", and a server component reading a plain named export across that boundary receives a client reference, not the string. Both copies name 04-UI-SPEC.md § Motion Language as the authority, matching the existing courtesy-mirror convention in image-gallery-field.tsx"
  - "<Reveal>'s cleanup calls observer.disconnect() rather than unobserve(node). The one-shot unobserve() still fires on first intersection as the spec requires; disconnect() on teardown is the stricter of the two and cannot leave a live observer behind if the component unmounts before ever intersecting — which is the normal case for a section the shopper never scrolls to"
  - "The reduced-motion query is READ once inside the effect rather than subscribed to with useSyncExternalStore (the use-mobile.ts idiom). This animation is a one-shot that has either already played or never will, so re-running it because the OS setting changed mid-scroll would be exactly the animation the setting asked us not to play"
  - "The editorial split's image carries alt={data.storeName} while the hero's background carries alt=\"\". The hero photo is behind a scrim with the h1 on top of it — it is decoration and describing it makes a screen reader narrate the page twice. The split's image is a content-bearing half of a two-column band, so it gets an accessible identity without a merchant-authored alt field existing in the schema to supply a better one"
  - "Both image-bearing sections address the product preset's `detail` derivative (1600px, the widest). The hero is priority and full-bleed so it is the home page's LCP element, and the 800px `card` derivative visibly softens across a desktop hero"

requirements-completed: [TMPL-01, TMPL-02]

# Metrics
duration: ~18min
completed: 2026-09-02
---

# Phase 4 Plan 07: Motion Primitive and Flagship Sections S1/S2/S4 Summary

**The flagship's client-safe foundation and three of its five bands: a types-only data contract with literally zero imports, a scroll-reveal primitive whose default state is visible-and-unanimated so a failed bundle degrades to a readable page rather than a blank one, and the hero / trust-bar / editorial-split sections built to 04-UI-SPEC's contracts with a merchant accent spent on exactly one fill.**

## Performance

- **Duration:** ~18 min, including worktree environment repair (`node_modules`, `src/generated/prisma`, `.env.local`, `.env.test` and `.next` all absent from the fresh worktree and restored from the main checkout)
- **Tasks:** 3, all `type="auto"`, three commits
- **Files created:** 5. **Modified:** 0
- **Gates:** `npm run typecheck` 0 · `npm run lint --max-warnings=0` 0 · `npm run test:unit` 547/547 across 31 files · `npm run build` succeeded

## Accomplishments

- **A whole directory is now provably client-safe.** `render-data.ts` has **zero** import statements and every other file in `sections/` reaches exactly one module outside its own tree — `@/server/theming/schema`, the one plan 04-02 deliberately built marker-free. This is T-04-24 closed before the surface that would break exists: `preview-canvas.tsx` (plan 04-14) is a `"use client"` component that transitively imports every section, so a single `server-only` dependency anywhere here would be an editor-route build failure discovered by whoever writes plan 04-14 rather than by whoever caused it.
- **The data shapes are redeclared, not imported.** `StorefrontRenderProduct` and `StorefrontRenderCategory` restate the fields `src/app/s/[slug]/page.tsx` already consumes instead of re-exporting `StorefrontProductListItem` from the `server-only` query module. The duplication is the barrier: a type-only import is one keyword away from a value import, and a structural declaration is not.
- **The reveal cannot produce a blank page (T-04-23).** The default state is visible and unanimated; the observer only *adds* classes. No-JS, no `IntersectionObserver`, and `prefers-reduced-motion: reduce` all land on that same state, which is why the reduced-motion branch needed no "turn the animation off" logic — it simply never attaches one. `grep -c "opacity-0\|invisible"` over the file returns **0**, comments included.
- **The hero has two designs, not one design and a fallback.** The no-image mode is a zinc-100 band with the type re-inked onto the `--foreground` family and no scrim, because a scrim over nothing is a grey rectangle. It is the day-one state for a merchant who publishes from onboarding without opening the editor — which is the exact moment TMPL-01's "would a stranger think this cost money" bar is judged.
- **The accent budget was spent once, on purpose.** Across all three sections the merchant's `--brand-accent` appears on exactly one element: the hero's pill CTA fill. The trust band spends one of `--brand-accent-secondary`'s two permitted uses on its 8% wash. `grep -c "bg-brand-accent" editorial-split-section.tsx` returns **0**, which is the point of that section's longest comment.
- **The ink-on-ink collision is documented where it will be re-introduced.** The editorial split's CTA is `bg-background text-foreground` and the file explains, in the all-caps warning voice, that the default accent is ink and this band is `--foreground`: a fill-versus-fill collision that no foreground derivation can fix, because a derived label colour makes the *text* readable while the button's own shape still disappears into the band.
- **A fifth trust icon is a compile error.** `TRUST_ICONS` is a `Readonly<Record<TrustIcon, LucideIcon>>` keyed off the schema's own `z.enum`, with no fallback arm — the `ORDER_TRANSITIONS` idiom. A fallback would render a new enum value as the wrong glyph on a live public storefront, which is the failure mode that survives review.
- **Nothing merchant-authored reaches a `style` attribute as a string.** The only values in a `style` on these three sections are `overlayOpacity` (a number, clamped `0…0.8` by `heroSettings`) and `calc(var(--motion-stagger) * {index})` (a token and an integer). The scrim's colour is the token utility `bg-foreground`. T-04-09 has no injection path to guard here because there is no colour string on it.

## Task Commits

1. **Task 1 — the client-safe render-data contract and the `<Reveal>` primitive** — `7ba0401`
2. **Task 2 — S1, the hero section with its no-image mode** — `629957a`
3. **Task 3 — S2 trust-bar and S4 editorial-split** — `b7caa6a`

## Files Created

- `src/app/s/[slug]/sections/render-data.ts` — `StorefrontRenderProduct`, `StorefrontRenderCategory`, `StorefrontRenderData`. A types module with **no import statement at all** and no runtime output, opening with the all-caps client-safety rule and the reason for it. Documents why `imageBaseUrl` and `whatsappHref` are pre-resolved server-side rather than assembled here
- `src/app/s/[slug]/sections/reveal.tsx` — `<Reveal>`, `"use client"`. `IntersectionObserver` at `threshold: 0.1` / `rootMargin: "0px 0px -10% 0px"`, `unobserve()` on first intersection, `disconnect()` on teardown, a bare unstyled `<div>` wrapper so it cannot move the band dimensions it wraps
- `src/app/s/[slug]/sections/hero-section.tsx` — `HeroSection`. `min-h-[85svh] max-h-[900px]`, a 40→64px/600/1.05 `tracking-tighter` `<h1>`, accent pill CTA at `min-h-12`, and the four-step on-mount cascade at `--motion-hero` with **no** scroll observer above the fold
- `src/app/s/[slug]/sections/trust-bar-section.tsx` — `TrustBarSection`. `border-y border-border bg-brand-accent-secondary/8`, 1/2/3/4-column arms, enum-typed icon `Record`, per-item `--motion-stagger` delay
- `src/app/s/[slug]/sections/editorial-split-section.tsx` — `EditorialSplitSection`. `bg-foreground text-background`, the Display role's 32→40px fifth size step, an inverted (non-accent) CTA, an `aspect-[4/3]` image column, and a single centred `max-w-3xl` collapse when there is no image

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Worktree shipped with no installed dependencies or generated artifacts**

- **Found during:** Task 1, at the first `npm run typecheck`
- **Issue:** The freshly spawned worktree had no `node_modules`, no `src/generated/prisma`, no `.env.local`, no `.env.test` and no `.next/types` — all gitignored, so none of them arrive with a checkout. Without `.next/types` in particular, `tsc` reported nine pre-existing `Cannot find name 'PageProps' / 'LayoutProps'` errors in files this plan does not touch (Next 16 generates those global types at build time)
- **Fix:** Copied all five from the main checkout at `D:\Maxs\Claude\einort-commerce`. A real copy rather than a Windows junction, per the environment note about Turbopack's "Symlink points out of the filesystem root" failure
- **Files modified:** none — every restored path is gitignored and nothing was committed
- **Commit:** n/a (environment repair, not a code change)

**2. [Rule 1 — Bug] Documentation prose tripped the plan's own literal acceptance greps**

- **Found during:** Tasks 1 and 2, at the acceptance-criteria verification step
- **Issue:** Several acceptance criteria are literal `grep -c` counts with hard expected values — `"@/server/"` exactly 1 in `hero-section.tsx`, `"font-bold"` 0, no `import` statement in `render-data.ts`, no `opacity-0` in `reveal.tsx`. Header comments written to *explain* those rules ("never write `font-bold` here", "the only permitted import is `@/server/theming/schema`") contained the banned literals and pushed the counts off. `tests/unit/surface-token-isolation.test.ts` blanks whole-line comments and so passed throughout — but a criterion that a correct file fails is a criterion nobody will trust the second time
- **Fix:** Reworded the affected comments so they carry the same instruction without the literal token: paths written as `src/server/theming/schema.ts` instead of the `@/` alias, "NEVER REACH FOR THE WEIGHT-700 UTILITY HERE" instead of naming the class, "A ZERO-OPACITY OR HIDDEN INITIAL CLASS" instead of naming the utility, and "pull in / reference" instead of "import". Also removed a `#18181B` / `zinc-900` pair from an editorial-split comment for the same reason
- **Files modified:** `render-data.ts`, `reveal.tsx`, `hero-section.tsx`, `editorial-split-section.tsx`
- **Commit:** folded into `7ba0401`, `629957a`, `b7caa6a`

### Judgement calls recorded rather than auto-fixed

- **The trust bar's stagger is implemented exactly as specified, and there is a known subtlety in it.** The plan and 04-UI-SPEC § Motion Language both say `<Reveal>` wraps the band while each item carries the reveal class combination plus a `--motion-stagger` delay. Because CSS animations do not cascade to children and `animate-in` fires on mount, the items' own cascade plays at mount (below the fold, ending at their final state under `fill-mode-both`) while the band's observer-driven reveal is what moves at scroll time — so the per-item stagger is polish rather than the primary effect. Making it observer-driven would require `<Reveal>` to expose its state to descendants (a `data-` attribute plus an `in-*` variant, or a `style` prop), which is a change to a primitive two other plans in this wave and the next already consume. That is a spec-level design call, not a bug to fix unilaterally mid-wave — recorded here so plan 04-14 or a later polish pass can decide it deliberately. Content is never hidden either way, so there is no accessibility exposure.

## Authentication Gates

None. This plan installs nothing, reaches no network, and touches no credentialed surface.

## Threat Flags

None. The three trust boundaries this plan sits on are all in the plan's own register and all mitigated as written: `overlayOpacity` and the stagger index are the only values reaching a `style` attribute and both are numbers (T-04-09); both image keys are `storageKeySchema`-validated prefixes concatenated onto a server-supplied base under `next.config.ts`'s `remotePatterns` allowlist (T-04-15); and no file here reaches a `server-only` module (T-04-24). No new network endpoint, auth path, file-access pattern or schema change was introduced.

## Known Stubs

None. Every component renders real merchant settings through to the DOM. `StorefrontRenderData.whatsappHref` and `activeCategorySlug` are declared but not yet consumed — they belong to S3 and S5, which plan 04-08 builds against this same contract; that is the contract being complete ahead of its consumers, not a stub.

## Self-Check: PASSED

- `src/app/s/[slug]/sections/render-data.ts` — FOUND
- `src/app/s/[slug]/sections/reveal.tsx` — FOUND
- `src/app/s/[slug]/sections/hero-section.tsx` — FOUND
- `src/app/s/[slug]/sections/trust-bar-section.tsx` — FOUND
- `src/app/s/[slug]/sections/editorial-split-section.tsx` — FOUND
- commit `7ba0401` — FOUND
- commit `629957a` — FOUND
- commit `b7caa6a` — FOUND
