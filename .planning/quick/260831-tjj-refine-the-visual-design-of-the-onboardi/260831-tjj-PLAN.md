---
phase: quick-260831-tjj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/onboarding/plan/plan-picker.tsx
autonomous: true
requirements: [SUB-01, D-04]
must_haves:
  truths:
    - "The Business (recommended) tier is visually distinguishable from Starter and Professional at rest, before any radio is selected."
    - "The 'Most Popular' badge floats on the top edge of the Business card in solid primary fill, not inline beside the tier name in flat grey."
    - "Every tier card shows a square icon tile above its name; the recommended tile is solid-filled and the other two are tinted."
    - "Feature-list checkmarks render in the primary accent on all three tiers."
    - "Selecting any card still produces the existing 2px primary ring plus the Check icon and its sr-only 'Selected' label, and that selected treatment is not confusable with the recommended-at-rest treatment."
    - "Keyboard focus still renders a visible outline on the card, and arrow-key roving focus across the three radios is unchanged."
  artifacts:
    - path: "src/app/onboarding/plan/plan-picker.tsx"
      provides: "Restructured tier card JSX with floating badge, icon tiles, elevated recommended card, primary checkmarks"
      contains: "TIER_ICONS"
  key_links:
    - from: "src/app/onboarding/plan/plan-picker.tsx"
      to: "lucide-react"
      via: "Store / TrendingUp / Building2 icon imports keyed by PlanTier"
      pattern: "Building2|TrendingUp|Store"
    - from: "src/app/onboarding/plan/plan-picker.tsx"
      to: "@/lib/strings"
      via: "strings.plan.* — every visible and accessible string"
      pattern: "strings\\.plan\\."
---

<objective>
Refine the visual hierarchy of the onboarding plan-selection cards
(`/onboarding/plan`) so the recommended Business tier reads as elevated above its
two siblings, using only tokens and component variants that already exist in the
merchant-platform surface scope.

Purpose: the three cards are currently flat and undifferentiated — identical
border, identical fill, identical size — and the only recommended treatment is a
`variant="secondary"` badge whose grey is indistinguishable from the rest of the
UI. D-04's intent ("pre-HIGHLIGHT Business") is not actually being delivered by
the pixels.

Output: a pure JSX/className refinement of `plan-picker.tsx`. No data flow, no
server logic, no type changes, no new copy, no new colours.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md

@src/app/onboarding/plan/plan-picker.tsx
@src/app/onboarding/plan/page.tsx
@src/components/ui/badge.tsx
@src/app/globals.css
@tests/unit/surface-token-isolation.test.ts

<interfaces>
<!-- Contracts the executor needs. Do not re-derive these by exploring. -->

From `src/server/entitlements/plans.ts`:
```typescript
export const PLAN_TIERS = ["starter", "business", "professional"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];
```

From `src/app/onboarding/plan/plan-picker.tsx` (UNCHANGED — do not edit this interface):
```typescript
export interface PlanCard {
  readonly tier: PlanTier;
  readonly name: string;
  readonly tagline: string;
  readonly featuresHeader: string | null;
  readonly features: readonly string[];
  readonly price: string;
  readonly recommended: boolean;
}
export function PlanPicker({ plans }: { plans: readonly PlanCard[] }): JSX.Element;
```

Badge variants available (`src/components/ui/badge.tsx`): `default` (solid
`bg-primary text-primary-foreground`), `secondary`, `destructive`, `outline`,
`ghost`, `link`, `gold`, `success`, `outline-success`. Base class already carries
`h-6 rounded-4xl text-sm font-semibold whitespace-nowrap`.

lucide-react exports confirmed present in the installed version: `Store`,
`TrendingUp`, `Building2`, and `type LucideIcon`. The established typing
convention for an icon map is `readonly icon: LucideIcon` — see
`src/components/app-sidebar.tsx:78` and `src/components/order-state-chip.tsx:80`.

Token values that matter for this change (from `src/app/globals.css` `:root`,
i.e. the default/merchant scope this route resolves under — this page is NOT
inside `src/app/s/**`, so it never sees the `[data-surface="storefront"]` block):
- `--background` slate-50, `--card` white, `--muted` slate-100,
  `--border` slate-200, `--primary` brand-600, `--ring` brand-500,
  `--radius` 0.75rem.
- The page field is slate-50, the current card fill is slate-100. White `--card`
  is therefore two steps *lighter* than the flat siblings — which is what makes
  `bg-card` a real elevation signal here without inventing a token.
</interfaces>

<constraints_verified_by_the_planner>
These were checked against the repo, not assumed. Do not re-litigate them.

1. **`PlanPicker` has exactly one consumer** — `src/app/onboarding/plan/page.tsx`.
   `/dashboard/plan` uses a separate `plan-switch-form.tsx` and is OUT OF SCOPE.
   Blast radius of this change is one route.
2. **`tests/unit/surface-token-isolation.test.ts` bans that apply to this file:**
   ban 1 (no literal `#hex`/`oklch(`/`rgb(`/`hsl(`) and ban 2 (no
   `zinc|slate|blue|amber|emerald|red|green|yellow|indigo|gray`-NNN palette
   utility) — both scan `src/app` + `src/components`. Ban 4 applies only in the
   sense of "do not add `data-surface="storefront"`". Bans 3 and 5 are scoped to
   `src/app/s/**` and `src/app/(dashboard)/dashboard/products/**` and do not
   reach this file. Note ban 2's regex includes `blue-` — a literal `blue-500`
   would fail the build. Use `bg-primary` / `text-primary` / `border-primary`.
3. **The gold budget is enforced twice** — `tests/unit/dashboard-nav.test.ts`
   and `tests/unit/phase-03-requirement-coverage.test.ts:507` both count
   `variant="gold"` / `variant: "gold"` across `src/app` + `src/components` and
   assert exactly two files (`src/components/app-sidebar.tsx`,
   `src/components/order-state-chip.tsx`). A third occurrence is a build failure.
   `variant="gold"` MUST NOT appear in this diff.
4. **No new copy is required.** The icon tiles are decorative
   (`aria-hidden="true"`); the tier name `<h2>` already carries the meaning, and
   the recommended signal already has its non-colour text label
   (`strings.plan.recommendedBadge` = "Most Popular"). `src/lib/strings.ts` is
   expected to be UNCHANGED by this task. If the executor somehow concludes a new
   visible or `aria-*` string is needed, it goes into the `strings.plan`
   namespace with a doc comment in that file's existing style — never inlined
   into the JSX.
5. **No prose-literal scan covers this file** (`dashboard-nav.test.ts`'s copy
   scan targets only `src/components/app-sidebar.tsx`), but CLAUDE.md's
   centralised-copy rule is binding regardless. Do not inline copy.
</constraints_verified_by_the_planner>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restructure the tier cards for visual hierarchy</name>
  <files>src/app/onboarding/plan/plan-picker.tsx</files>
  <action>
Edit `src/app/onboarding/plan/plan-picker.tsx` only. Five coordinated changes,
all inside the `plans.map(...)` render and the grid wrapper. Nothing outside the
returned JSX (and the new module-level icon map) may change — `PlanCard`,
`PlanPicker`'s signature, `onSubmit`, `selectPlan`, all `useState` calls, the
`<fieldset>`/`<legend>`/`sr-only` radio structure, the `Alert` block and the
submit `Button` all stay byte-identical.

**(a) Tier icon map, module level.**
Extend the lucide import to `AlertCircle, Building2, Check, LoaderCircle, Store,
TrendingUp, type LucideIcon` — keep the list alphabetically sorted and place
`type LucideIcon` the way `src/components/app-sidebar.tsx` places it, so ESLint's
import ordering stays clean. Add, below the existing `PlanCard` interface:

a `const TIER_ICONS: Readonly<Record<PlanTier, LucideIcon>>` mapping
`starter -> Store`, `business -> TrendingUp`, `professional -> Building2`.

Type it against `PlanTier` (not `string`) on purpose, mirroring the same drift
discipline `TIER_COPY` in `page.tsx` and `ORDER_TRANSITIONS` apply: a fourth
entry in `PLAN_TIERS` must become a compile error here, not a card that renders
with a missing icon. Give it a `/** ... */` doc comment in this codebase's style
explaining that choice and why these three glyphs (a storefront, a growth curve,
an institution — an ascending scale of business maturity, matching the ascending
price order; deliberately not playful/consumer iconography, this is a tool small
businesses run their revenue on). Inside the map body resolve the icon per card
as a capitalised local, e.g. `const TierIcon = TIER_ICONS[plan.tier];`, so it is
usable as a JSX component.

**(b) The "Most Popular" badge floats on the card's top edge.**
Remove the `<Badge variant="secondary">` from the header row entirely. Render it
instead as the FIRST child inside the `<label>` (the label already has
`relative`, so no wrapper is needed), guarded by the same `plan.recommended`
check, as:

`<Badge className="absolute -top-3 left-1/2 -translate-x-1/2">` with
`{strings.plan.recommendedBadge}` as its content.

Do not pass `variant="secondary"`. `default` is the component's own
`defaultVariants` value and resolves to `bg-primary text-primary-foreground` —
state it explicitly as `variant="default"` for readability at the call site. The
badge is `h-6` (24px), so `-top-3` (-12px) centres it exactly on the card's top
border, half in and half out, which is the whole point: it now reads as attached
to the card rather than as another grey chip inside it. `left-1/2
-translate-x-1/2` is chosen over `right-6` because the badge has to survive the
single-column mobile layout where the card is full-bleed and a right-anchored
pill drifts far from the tier name it modifies.

**(c) Icon tile above the tier name; header row keeps only the selected signal.**
Replace the header row's contents. The row stays
`<div className="flex items-start justify-between gap-2">`. Its LEFT child
becomes a `flex flex-col gap-3` stack holding, in order:

1. a decorative tile — a `<span>` with
   `flex size-10 shrink-0 items-center justify-center rounded-md` plus the
   conditional fill below — containing
   `<TierIcon aria-hidden="true" className="size-5" />`;
2. the existing `<h2 className="font-heading text-lg leading-snug font-semibold text-foreground">{plan.name}</h2>`, unchanged.

Tile fill, via `cn(...)`: `plan.recommended ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"`.
One hue, two weights — solid for the tier being recommended, tinted for the other
two. This deliberately does not give each tier its own colour; this project runs
one accent, and a per-tier palette would be exactly the semantic-token erosion
`surface-token-isolation.test.ts` exists to prevent.

The RIGHT child of the header row is the existing `isSelected` fragment — the
`<Check aria-hidden="true" className="size-5 text-primary" />` plus the
`<span className="sr-only">{strings.plan.selectedLabel}</span>` — kept exactly as
it is today, including its `flex shrink-0 items-center gap-2` wrapper (which now
holds only the check, since the badge left the row). WCAG 1.4.1 is load-bearing
here: colour is never the only signal, and that sr-only label is the other half.

**(d) Recommended card elevation at rest; selected state unchanged.**
In the `<label>`'s `cn(...)`, split the flat
`border border-border bg-muted` so the fill and border are conditional:

- base (unchanged): `relative flex min-h-11 cursor-pointer flex-col gap-4 rounded-lg border p-6`
- not recommended: `border-border bg-muted`
- recommended: `border-primary bg-card shadow-lg lg:-translate-y-2`
- focus (unchanged): `has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring`
- selected (unchanged): `isSelected && "ring-2 ring-primary"`

Rationale to record in the code comment, because the next reader will want to
change it: the recommended treatment and the selected treatment must not read as
the same thing. They are separated on three axes at once — fill (`bg-card` white
vs `bg-muted` slate-100 against a slate-50 page, so the recommended card is two
steps lighter than its siblings and genuinely reads raised), elevation
(`shadow-lg` + an 8px lift that applies only at `lg`, where the grid is actually
three columns), and geometry (recommended is a 1px border ON the box; selected is
a 2px ring OUTSIDE it). `border-2` is deliberately NOT used for the recommended
card — it would shift that card's content box 1px per side relative to its
siblings for no visual gain the shadow does not already deliver.

`lg:-translate-y-2` is a paint-time transform: it does not participate in layout,
so `items-stretch` still equalises all three heights and the two flat cards are
unaffected. Do NOT add `ring-offset-*` to the selected state — the existing
focus outline sits at `outline-offset-2` (2-4px outside the box) and the existing
`ring-2` sits at 0-2px outside; they are currently adjacent and non-overlapping,
and an offset ring would collide with the focus outline for a keyboard user on a
selected card.

**(e) Grid spacing, and coloured feature checkmarks.**
On the grid wrapper, change `gap-4` to `gap-6` and add `pt-3`:
`className="grid items-stretch gap-6 pt-3 lg:grid-cols-3"`. The gap increase
keeps `shadow-lg` from crowding the neighbouring cards now that one card is
raised, and — on the single-column mobile layout — gives the badge's 12px
overhang room to sit in the gutter instead of touching the card above it. `pt-3`
reserves that same 12px above the first row so the badge cannot crowd the
`subline` on mobile (where Starter is first) or ride up against it at `lg` once
the -8px lift is applied.

In the feature `<ul>`, change the per-feature `<Check>`'s
`text-muted-foreground` to `text-primary` on ALL THREE tiers (the surrounding
`<li>` text stays `text-muted-foreground` — only the glyph changes). Keep
`mt-0.5 size-4 shrink-0` and `aria-hidden="true"` exactly as they are.

**Header comment.** The module's existing doc comment says "D-04 pre-HIGHLIGHTS
Business with the `Most Popular` badge". Extend that paragraph (do not rewrite
the block) to record that the highlight is now carried by four coordinated
signals — the solid-primary badge on the top edge, the solid icon tile, the white
raised fill with shadow, and the desktop-only lift — and restate that none of
them may drift into the selected state's language, since a card that looks chosen
before the merchant chooses is the exact inertia D-04/D-05 were written to
prevent.

**Forbidden in this diff, restated:** any `variant="gold"`; any literal colour
(`#hex`, `oklch(`, `rgb(`, `hsl(`); any Tailwind palette utility matching
`(zinc|slate|blue|amber|emerald|red|green|yellow|indigo|gray)-[0-9]{2,3}`; any
gradient utility; any `data-surface` attribute; any inlined user-facing or
`aria-label` string; any edit to `page.tsx`, `strings.ts`, `plans.ts`,
`badge.tsx`, or any test file.
  </action>
  <verify>
    <automated>cd "D:/Maxs/Claude/einort-commerce" && npx vitest run tests/unit/surface-token-isolation.test.ts tests/unit/dashboard-nav.test.ts tests/unit/phase-03-requirement-coverage.test.ts --reporter=dot && npm run typecheck && npm run lint && git --no-pager diff --stat -- src/app/onboarding/plan/ src/lib/strings.ts</automated>
    <human-check>
      Run `npm run dev`, sign up a fresh merchant (or clear `planTier` on an
      existing org) and land on `http://localhost:3001/onboarding/plan`. Confirm,
      at a desktop width (>=1024px) and again at mobile width:
      1. The Business card is obviously the recommended one before you click
         anything — white raised fill, blue hairline, shadow, and at desktop it
         sits ~8px higher than Starter and Professional.
      2. A solid blue "Most Popular" pill straddles the Business card's top
         border. It is not clipped, does not touch the card above it on mobile,
         and does not crowd the "Free for 10 days…" subline.
      3. All three cards show a rounded square icon tile above the tier name;
         Business's is solid blue with a white glyph, the other two are pale blue
         with a blue glyph.
      4. Every feature checkmark is blue.
      5. Tab into the grid: a visible focus outline renders on the CARD, and
         arrow keys move between the three tiers. Select each tier in turn — the
         2px blue ring appears and is clearly a different thing from Business's
         recommended border. Selecting Starter or Professional does not make
         Business stop looking recommended.
      6. The CTA stays disabled until a tier is chosen, and submitting still
         redirects to the storefront origin.
    </human-check>
  </verify>
  <done>
`git diff --stat` shows exactly one changed file,
`src/app/onboarding/plan/plan-picker.tsx` (`src/lib/strings.ts` and `page.tsx`
show zero changes). `npm run typecheck` and `npm run lint --max-warnings=0` both
pass. `surface-token-isolation`, `dashboard-nav` and
`phase-03-requirement-coverage` all pass unmodified — in particular the gold
budget still reports exactly two files. `grep -n 'variant="gold"'
src/app/onboarding/plan/plan-picker.tsx` returns nothing. The human-check above
is confirmed.

`npx next build` is a bonus, not a gate: if it fails with the known
Turbopack/Windows-junction `node_modules` symlink error inside a worktree, record
that in the summary and rely on typecheck + lint + the human-check as the
evidence bar (a confirmed pre-existing environmental issue in this project, not
caused by this change).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → `selectPlan` server action | The only untrusted input on this page: the chosen `tier` string. UNCHANGED by this task — the action, its Zod schema and the session-derived organization id are all untouched. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-tjj-01 | Tampering | `selectPlan({ tier })` payload | accept | Pre-existing and out of scope: the payload already carries no organization id (T-02-06) and the tier is Zod-validated server-side against `PLAN_TIERS`. This task changes zero bytes of that path. |
| T-tjj-02 | Information disclosure | rendered price strings | accept | Prices are still formatted server-side in `page.tsx` and arrive as opaque strings; no arithmetic is introduced client-side. |
| T-tjj-03 | Elevation of privilege | recommended-vs-selected visual confusion | mitigate | A card that *looks* chosen before the merchant chooses would let a tier be assigned by inertia (the exact failure D-04/D-05 guard against). Mitigated by separating the two states on three axes (fill, elevation, border-vs-ring) and by keeping the `sr-only` "Selected" label as the non-colour selection signal. Verified in human-check step 5. |
| T-tjj-SC | Tampering | npm/pip/cargo installs | n/a | No package is installed by this task. `lucide-react` is an existing declared dependency and the three icons used were confirmed present in the installed version. No Package Legitimacy Gate is triggered. |
</threat_model>

<verification>
- `npx vitest run tests/unit --reporter=dot` — full unit suite green, no test file modified.
- `npm run typecheck` — clean.
- `npm run lint` (`--max-warnings=0`) — clean.
- `git --no-pager diff --name-only` lists exactly `src/app/onboarding/plan/plan-picker.tsx`.
- Human-check on `/onboarding/plan` at both desktop and mobile widths, per the task's `<human-check>` block.
</verification>

<success_criteria>
- The recommended (Business) tier is distinguishable from its siblings at rest, without any radio being selected.
- The "Most Popular" badge is a solid-primary pill straddling the Business card's top border, not an inline grey chip.
- All three tiers carry a decorative, `aria-hidden` icon tile above the tier name; the recommended tile is solid, the others tinted, all in one hue.
- Feature-list checkmarks render `text-primary` on all tiers.
- Selected state, focus outline, roving radio focus, the `sr-only` legend and the `sr-only` "Selected" label all behave exactly as before.
- Zero new colours, zero gradients, zero `variant="gold"`, zero inlined copy, zero logic or type changes, zero test-file edits.
</success_criteria>

<output>
Create `.planning/quick/260831-tjj-refine-the-visual-design-of-the-onboardi/260831-tjj-SUMMARY.md` when done.
</output>
