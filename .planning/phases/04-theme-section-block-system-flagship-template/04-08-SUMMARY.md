---
phase: 04-theme-section-block-system-flagship-template
plan: 08
subsystem: storefront-flagship-sections
tags:
  [
    react-server-components,
    client-safety,
    discriminated-union,
    exhaustiveness,
    next-image,
    lucide,
    accessibility,
    motion,
    tailwind-v4,
    intl-numberformat,
  ]

# Dependency graph
requires:
  - phase: 04-theme-section-block-system-flagship-template
    plan: 02
    provides: "src/server/theming/schema.ts — the SectionInstance discriminated union that both section components narrow their props out of and that the renderer's switch is proven exhaustive against"
  - phase: 04-theme-section-block-system-flagship-template
    plan: 04
    provides: "the storefront design tokens in globals.css (--brand-accent*, the six --motion-* tokens, the reduced-motion floor) and strings.flagship.productGrid / strings.flagship.contact / strings.storefront.empty*"
  - phase: 04-theme-section-block-system-flagship-template
    plan: 07
    provides: "render-data.ts (StorefrontRenderData, including activeCategorySlug and whatsappHref, both first consumed here), reveal.tsx, and the three sections the renderer's other arms dispatch to"
  - phase: 03-product-catalog-order-payment-claim-state-machine
    provides: "the catalogue grid, category chips, out-of-stock treatment and fr-CM/XAF formatter on the storefront home page that S3 lifts; IMAGE_PRESETS.product's `card` derivative; the wa.me href shape built by src/server/payments/whatsapp.ts"
provides:
  - "src/app/s/[slug]/sections/product-grid-section.tsx — ProductGridSection (S3): header row, category chips, 4/5 tile grid, out-of-stock dimming, in-section dashed empty state"
  - "src/app/s/[slug]/sections/contact-section.tsx — ContactSection (S5): the WhatsApp band that replaces the visual reference's mailing-list sign-up, with a no-CTA branch when no number is configured"
  - "src/app/s/[slug]/sections/section-renderer.tsx — SectionRenderer, the ONE type-to-component switch: five arms, no default, no cast, no try"
affects:
  [
    04-09-storefront-read-path,
    04-10-storefront-render-assembly,
    04-12-editor-settings-panel,
    04-14-preview-canvas,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exhaustiveness enforced by an EXPLICIT return-type annotation plus a default-less switch, not by the switch alone — an inferred return type silently widens to include undefined and the guarantee evaporates without a single visible change"
    - "A Phase 3 page body promoted to a section by lifting its structure verbatim and re-tokening only its classes, so the route it lived on does not move and no link in the catalogue churns"
    - "A full-page empty state demoted to an in-section block once the surrounding page stopped being empty — the same copy, reused rather than duplicated, in the shopper's voice because the merchant's preview IS the storefront"
    - "An unconfigured integration renders a SHORTER section rather than an inert control: the absent-value branch removes the CTA entirely instead of rendering something unclickable"
    - "Acceptance criteria expressed as literal greps make the file's own documentation part of the contract — prose must state a rule without spelling the token it forbids"

key-files:
  created:
    - src/app/s/[slug]/sections/product-grid-section.tsx
    - src/app/s/[slug]/sections/contact-section.tsx
    - src/app/s/[slug]/sections/section-renderer.tsx
  modified: []

key-decisions:
  - "SectionRenderer carries an explicit `: ReactElement` return annotation. Without it the plan's own headline guarantee is absent: a sixth union member merely widens the INFERRED return type to include undefined, this file keeps compiling, and the new section renders as nothing on a live storefront. Verified empirically by adding a sixth member (typecheck stayed green at this file, erroring only at plan 04-06's registry table) and then again with the annotation (TS2366 lands here). The annotation is neither a default arm nor a cast, so both prohibitions hold"
  - "The trust-bar arm passes no `data`. Its content is entirely merchant-authored settings with nothing read from the catalogue, and threading the bundle in for symmetry would make every later reader hunt for the catalogue field it depends on"
  - "S3's tile keeps the 0.25rem `rounded` from the Phase 3 source even though § S3's tile row does not restate it. § S4's image column names the same radius explicitly, so dropping it here would make the two image treatments on one page disagree for no stated reason"
  - "The tile addresses the `card` (800px) derivative while the hero addresses `detail` (1600px). A tile is at most a quarter of a 1280px grid, so `detail` would ship four times the bytes for a crop nobody sees at full size — and this grid is below the fold on the LCP path the hero already owns"
  - "The empty branch keys off `visible.length` (post-slice) rather than `data.products.length`. `itemCount` is schema-clamped to 4/8/12 so the two can only disagree if a future edit widens it to include 0, and in that case the dashed block is the correct render rather than an empty grid with a border-bottom above it"
  - "Category chips are `<Link>` elements carrying `aria-pressed`, exactly as the plan specifies, rather than the `aria-current` a filter link would more conventionally use. Recorded rather than silently substituted — see Judgement Calls"

requirements-completed: [TMPL-01, TMPL-02]

# Metrics
duration: ~22min
completed: 2026-09-02
---

# Phase 4 Plan 08: Product Grid, Contact Band and the Exhaustive Renderer Summary

**The flagship's last two bands plus the switch that turns a parsed document into a page: Phase 3's catalogue grid promoted to a section without moving the route it lives on, a WhatsApp band that renders one element fewer rather than one dead element when no number is configured, and a five-arm renderer whose exhaustiveness had to be made real — the plan's compile-error guarantee did not hold until an explicit return type was added.**

## Performance

- **Duration:** ~22 min, including worktree environment repair (`node_modules`, `src/generated/prisma`, `.env.local`, `.env.test` and `.next` all absent from the fresh worktree and restored from the main checkout)
- **Tasks:** 3, all `type="auto"`, three commits
- **Files created:** 3. **Modified:** 0
- **Gates:** `npm run typecheck` 0 · `npm run lint --max-warnings=0` 0 · `npm run test:unit` 566/566 across 32 files · `npm run build` succeeded

## Accomplishments

- **The compile-error guarantee is now actually a compile error.** The plan's Task 3 acceptance criterion — "temporarily adding a sixth member to `sectionInstanceSchema` makes `npm run typecheck` fail pointing at this file" — was run as written and **failed**. A default-less switch over a discriminated union does not error on a new member when the function's return type is inferred; it just widens to `Element | undefined`, and the only error in the whole repository came from plan 04-06's `SECTION_TYPES` registry table. That is the precise failure mode the file's own header warns about, arriving in the file meant to prevent it. Adding `: ReactElement` makes the fall-off-the-end path illegal, and the re-run put `TS2366` at `section-renderer.tsx:93`. Both prohibitions still hold: no `default:` arm, no cast.
- **The catalogue became a section without a single link moving.** The tile, the chips, the out-of-stock chip and the `fr-CM`/`XAF` formatter are lifted structurally verbatim from the storefront home page's body. Three things changed and all three are visual: `aspect-[4/5]`, the accent-filled selected chip, and a hover scale. `?category=` filtering still resolves at the database layer through `data.activeCategorySlug`, and `grep -c` for the internal rewrite prefix over the new file returns **0** — the class of bug quick task 260901-00j cost 35 minutes on has no surface here.
- **A store with zero products now renders a finished page.** The Phase 1 full-page `Store coming soon` placeholder is retired on the home route in favour of a `border-dashed` block sitting between the trust bar and the contact band, carrying the **existing** `strings.storefront.emptyHeading` / `emptyBody` copy rather than a second sentence to keep in step. This is the moment TMPL-01's "would a stranger think this cost money" bar is judged for a merchant who published straight out of onboarding, and it is now a page with four bands and one honest note instead of a centred paragraph on white.
- **A merchant with no WhatsApp number gets a shorter section, not a broken one.** `whatsappHref === null` renders the heading and body and **no anchor at all**. `grep -c 'href="#"\|disabled'` over the file returns **0**, and there is no `<button` in it either. The nudge to go configure a number is documented as belonging to the editor's settings panel, with the reason stated in the file: the preview route IS the storefront, so anything this component draws is something a customer can see.
- **Deviation 1 is recorded where it will be re-litigated.** The contact band's header states, in the file rather than only in the research doc, that this is where the visual reference has a mailing-list sign-up and why it is not one: `resend` is a declared dependency wired to nothing, a form that silently discards submissions costs the shopper a real expectation and returns nothing, and it would put a promise in the copy catalogue the product cannot keep. The words that name the alternative appear **only** in that explanatory block.
- **The accent budget closed out exactly as specified.** This plan spends the third and fourth of `--brand-accent`'s four permitted uses — the product grid's "View all" link and the selected category chip — plus the second CTA fill on the contact band. The underline and the `arrow-right` glyph on the View all link are documented as load-bearing rather than decorative, because D-11 lets a merchant ship an accent that fails 4.5:1 and colour must never be the only signal.
- **All five sections exist and the directory is still provably client-safe.** `grep -c "@/server/"` returns exactly **1** in each of the three new files — the theming schema and nothing else. No `server-only` module is reachable from anywhere under this directory, which is what lets plan 04-14's client-side preview canvas import `section-renderer.tsx` and transitively pull in all five sections.

## Task Commits

1. **Task 1 — S3, the product grid section** — `e365bcf`
2. **Task 2 — S5, the contact band** — `f0c8538`
3. **Task 3 — the one exhaustive section renderer** — `daf00b0`

## Files Created

- `src/app/s/[slug]/sections/product-grid-section.tsx` — `ProductGridSection`. `<Reveal>`-wrapped header row with the accent "View all" link, `min-h-11` chips gated at two categories, a 2/3/4-column grid of `aspect-[4/5]` tiles with `group-hover:scale-105` at `--motion-hover`, D-09 out-of-stock dimming, an `image-off` placeholder, and the `border-dashed` in-section empty branch. Products sliced to `settings.itemCount`; stagger index capped at 7
- `src/app/s/[slug]/sections/contact-section.tsx` — `ContactSection`. Centred `max-w-3xl` column, accent pill CTA with `MessageCircleIcon` at `size-5`, `target="_blank" rel="noopener noreferrer"`, and the null-href branch that renders no CTA. Header records Pattern 9 deviation 1 with its reason
- `src/app/s/[slug]/sections/section-renderer.tsx` — `SectionRenderer`. One `switch (section.type)`, five arms, `: ReactElement`, no `default`, no cast, no `try`. Header explains why a `switch` beats a `Record` registry, cites `state-machine.ts` lines 62-70 for the same drift-detection intent, states the Pattern 12 rule that a route which can take money is never section-rendered, and says why there is no error boundary

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] The renderer's exhaustiveness guarantee did not exist as planned**

- **Found during:** Task 3, at the acceptance criterion that requires a temporary sixth union member to fail typecheck at this file
- **Issue:** The plan specifies the body as "ONE `switch (section.type)` with five `case` arms and **no `default` arm and no cast**", and asserts that a sixth section type is therefore a compile error here. It is not. With the return type left to inference, a sixth member widens `SectionRenderer`'s return type to include `undefined` and the file continues to compile — the new section would render as nothing on a live public storefront, which is verbatim the silent-drift outcome the header argues the `switch` prevents. Empirically confirmed: with a sixth member added, the only error in the repository was `TS2741` at plan 04-06's `SECTION_TYPES` registry, and `section-renderer.tsx` was clean
- **Fix:** Added an explicit `: ReactElement` return annotation (and its `import type { ReactElement } from "react"`). A non-exhaustive switch can then fall off the end of a function whose declared return type does not admit `undefined`, which is `TS2366`. Re-ran the criterion: the error now lands at `src/app/s/[slug]/sections/section-renderer.tsx(93,5)`. The temporary schema member was reverted and `git diff` confirmed `schema.ts` byte-identical to its committed state before Task 3 was committed. Neither prohibition was touched — there is still no `default:` arm and no cast. The header now carries an all-caps note that the annotation is the MECHANISM and must not be deleted as redundant, with the observed failure mode spelled out
- **Files modified:** `src/app/s/[slug]/sections/section-renderer.tsx`
- **Commit:** folded into `daf00b0`

**2. [Rule 3 — Blocking] Worktree shipped with no installed dependencies or generated artifacts**

- **Found during:** Task 1, before the first gate run
- **Issue:** The freshly spawned worktree had no `node_modules`, no `src/generated/prisma`, no `.env.local`, no `.env.test` and no `.next` — all gitignored, so none arrive with a checkout. Without `.next` in particular, `tsc` reports pre-existing `Cannot find name 'PageProps'` errors in files this plan does not touch, because Next 16 generates those global route types at build time
- **Fix:** Copied all five from the main checkout at `D:\Maxs\Claude\einort-commerce`. Real copies rather than Windows junctions, per the environment note about Turbopack's "Symlink points out of the filesystem root" failure. Identical to the repair plan 04-07 documented in the previous wave
- **Files modified:** none — every restored path is gitignored and nothing was committed
- **Commit:** n/a (environment repair, not a code change)

### Judgement calls recorded rather than auto-fixed

- **The tile stagger has the same known subtlety plan 04-07 recorded for the trust bar, and was implemented to spec for the same reason.** § S3 puts `<Reveal>` on the header row and gives the tiles their own reveal classes plus a `--motion-stagger` delay. Because CSS animations do not cascade to children and `animate-in` fires on mount, the tiles' cascade plays at mount — below the fold, ending at their final state under `fill-mode-both` — while the header row's observer-driven reveal is what moves at scroll time. Making it observer-driven would require `<Reveal>` to expose its state to descendants (a `data-` attribute plus an `in-*` variant, or a `style` prop), i.e. re-architecting a primitive that four plans now consume. 04-07 declined to do that unilaterally mid-wave and this plan follows that precedent rather than splitting it. Content is never hidden either way, so there is no accessibility exposure. A later polish pass or plan 04-14 should decide it deliberately, once, for all four consumers.
- **Category chips carry `aria-pressed` because the plan says so, and `aria-current` would be the more conventional choice.** These are `<Link>` elements, so their implicit role is `link`, and `aria-pressed` is defined for `button`. ESLint's `role-supports-aria-props` did not flag it and nothing is broken — an assistive technology that ignores an unsupported property falls back to the link text, which is the category name and is sufficient. But `aria-current` is the property built for "this is the active one among a set of navigation targets" and would be announced. Implemented as written rather than substituted, because the chip's ARIA is a spec-level accessibility decision that also affects how the editor previews the selected state; flagged here so the a11y pass can settle it in one place.

## Authentication Gates

None. This plan installs nothing, reaches no network, and touches no credentialed surface.

## Threat Flags

| Flag                          | File                                                | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| threat_flag: url-scheme       | `src/app/s/[slug]/sections/product-grid-section.tsx` | `settings.viewAllHref` is a merchant-authored `z.string().max(200)` with **no scheme validation**, rendered straight into a `<Link href>`. The same exposure already exists on `settings.ctaHref` in `hero-section.tsx` and `editorial-split-section.tsx` from plan 04-07, so this is a pre-existing surface this plan extends rather than introduces, and the schema that would fix it is plan 04-02's file — not this plan's to edit mid-wave. React 19 refuses to render a `javascript:` URL in an `href`, which is why this is a flag and not a Rule 2 fix, but that is a framework behaviour rather than a control this codebase states. Worth a `z.string().refine()` restricting the value to an origin-relative path in a later plan or a quick task. |
| threat_flag: outbound-link    | `src/app/s/[slug]/sections/contact-section.tsx`     | The first `target="_blank"` link on the storefront. `rel="noopener noreferrer"` is present (T-04-26 as registered) and the href is server-built, so the register's mitigation holds as written — noted only because it is a new **kind** of surface for this route tree, and any future outbound link here needs the same pair.                                                                                                                                                                                                                                                                                                                                                                                                                             |

Everything else this plan sits on is in the plan's own register and mitigated as written: every href is origin-relative and `storefront-link-prefix` passes (T-04-07); the grid's settings carry no price, product id or stock and `itemCount` is a closed union used only as a slice bound (T-04-25); `product.imageKey` is a pipeline-written storage-key prefix concatenated onto a server-supplied base under the `remotePatterns` allowlist (T-04-15); the renderer's switch has no `default` and no `try` (T-04-12); and nothing in this directory performs I/O of any kind, including on the zero-products path (T-04-11). No package was installed (T-04-SC).

## Known Stubs

None. All three components render real data through to the DOM, and the two `StorefrontRenderData` fields plan 04-07 declared ahead of their consumers — `activeCategorySlug` and `whatsappHref` — are both consumed here, closing that contract. `SectionRenderer` itself has no caller until plan 04-10 assembles the read path and passes it a parsed document; that is a consumer arriving after its dependency, not a stub.

## Self-Check: PASSED

- `src/app/s/[slug]/sections/product-grid-section.tsx` — FOUND
- `src/app/s/[slug]/sections/contact-section.tsx` — FOUND
- `src/app/s/[slug]/sections/section-renderer.tsx` — FOUND
- commit `e365bcf` — FOUND
- commit `f0c8538` — FOUND
- commit `daf00b0` — FOUND
