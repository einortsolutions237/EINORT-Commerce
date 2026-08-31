---
phase: quick/260831-urm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/onboarding/plan/page.tsx
  - src/app/(dashboard)/dashboard/plan/page.tsx
autonomous: true
requirements: [QUICK-260831-urm]

must_haves:
  truths:
    - "A merchant on /onboarding/plan sees the Starter price as `5,000 XAF` — comma thousands-separator, literal `XAF` as a trailing suffix."
    - "A merchant on /dashboard/plan sees the identical string `5,000 XAF` for the same tier — the two plan surfaces never disagree about how a price reads."
    - "A future reader diffing these two files against CLAUDE.md's `fr-CM`/`style: 'currency'` rule finds an in-file comment explaining the deviation, and does not 'fix' it back."
    - "No product, cart, checkout, order or WhatsApp price anywhere else in the codebase changes format."
  artifacts:
    - path: "src/app/onboarding/plan/page.tsx"
      provides: "Decimal-style priceFormatter + ` XAF` suffix at the one call site"
      contains: 'new Intl.NumberFormat("en-US"'
    - path: "src/app/(dashboard)/dashboard/plan/page.tsx"
      provides: "Identical decimal-style priceFormatter + ` XAF` suffix at the one call site"
      contains: 'new Intl.NumberFormat("en-US"'
  key_links:
    - from: "src/app/onboarding/plan/page.tsx"
      to: "src/app/(dashboard)/dashboard/plan/page.tsx"
      via: "byte-identical priceFormatter construction, asserted by the verify gate"
      pattern: 'new Intl\.NumberFormat\("en-US", \{'
---

<objective>
Change the subscription-plan price display on the two plan-tier surfaces from the current
`5 000 FCFA` (fr-CM currency style) to `5,000 XAF`.

Purpose: The product owner asked for comma-grouped thousands with a literal trailing `XAF`
currency code on the subscription-plan pricing surfaces specifically. This is a deliberate,
explicitly-requested deviation from the project-wide `fr-CM` currency-style convention, scoped
to exactly two call sites.

Output: Two modified files, ~4 changed lines each, plus an in-file comment at each site
recording why the deviation exists.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md

@src/app/onboarding/plan/page.tsx
@src/app/(dashboard)/dashboard/plan/page.tsx

<pre_verified_facts>
The orchestrator already verified the following via `node -e` — do NOT re-derive, do NOT
experiment with other locales, do NOT reach for a currency library.

- Current output: `new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(5000)` → `"5 000 FCFA"` (narrow-no-break-space grouping, `FCFA` display name).
- **No standard Intl locale produces `"5,000 XAF"` via `style: "currency"`.** Verified: en-US / en-CA / en-GB / en-AU all *prefix* (`"XAF 5,000"`); fr-CM / de-DE / sv-SE / fi-FI all suffix correctly but use space- or dot-grouping (`"5 000 XAF"` / `"5.000 XAF"`).
- The **only** way to get comma-grouping AND a trailing `XAF` is a plain decimal formatter plus a literal string suffix:
  - formatter: `new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })` — no `style`, no `currency` key at all.
  - call site: append `" XAF"` after `.format(...)`.

Because `style: "currency"` is what emits the `FCFA`/`XAF` text today, removing it means the
suffix MUST be added manually at every `.format()` call site or the price renders as a bare
number.
</pre_verified_facts>

<scope_boundary>
**Exactly two files. Nothing else.**

These other files each have their OWN independent `Intl.NumberFormat({ style: "currency",
currency: "XAF" })` call. They are product / order / cart prices, not subscription-plan prices.
They are OUT OF SCOPE and must not be touched:

- `src/app/(dashboard)/dashboard/orders/format.ts`
- `src/app/(dashboard)/dashboard/products/page.tsx`
- `src/app/s/[slug]/cart/page.tsx`
- `src/app/s/[slug]/checkout/page.tsx`
- `src/app/s/[slug]/p/[productSlug]/add-to-cart.tsx`
- `src/app/s/[slug]/page.tsx`
- `src/server/payments/whatsapp.ts`

**Do not touch `CLAUDE.md`.** Whether the project-wide convention should change is a separate
decision for later. This is a two-file display change, not a convention change.
</scope_boundary>

<decisions_already_made>
Two questions the executor might otherwise stop and second-guess. Both are already settled —
implement as stated.

1. **`" XAF"` stays inline at the call site; it does NOT go into `src/lib/strings.ts`.**
   CLAUDE.md's centralized-copy rule targets user-facing *prose*. A currency code inside a
   number-formatting utility is a formatter-level config value — the same class of thing as
   the `currency: "XAF"` option it replaces, which was already a hardcoded config value in
   these files. It is also the same shape as the existing `strings.plan.priceSuffix: "/month"`
   pattern: a concatenated fragment, not a sentence.
   Corroborated: `tests/unit/dashboard-nav.test.ts`'s prose-literal scanner runs against
   `SIDEBAR_FILE` only — it does not scan either of these two files. And `looksLikeProse()`
   requires ≥3 whitespace-separated words, which `" XAF"` is not.

2. **Both formatters change together and must remain byte-identical to each other.**
   `/dashboard/plan`'s existing doc comment states the invariant explicitly: it matches
   `/onboarding/plan`'s formatter "so a price never reads differently between the two plan
   surfaces." Preserve that invariant and preserve the cross-reference sentence — update the
   comment to describe the *new* formatter, do not delete the cross-reference.
</decisions_already_made>

<no_test_updates_needed>
Verified by grep before planning — no existing test asserts the formatted plan-price string:
- `tests/unit/entitlements.test.ts` asserts raw registry numbers (`PLANS.starter.monthlyPriceXaf === 5_000`), never a formatted string. Unaffected.
- `tests/unit/whatsapp.test.ts:36` contains the literal `"Order AB12 — 5 000 FCFA"`, but it is a hand-written input fixture for a URL-encoding test, unrelated to these formatters. Do not touch it.

If `npm run test:unit` nonetheless goes red on a price string, fix the assertion to the new
format as part of this task rather than leaving it failing.
</no_test_updates_needed>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Switch both subscription-plan price formatters to comma-grouped "5,000 XAF"</name>

  <files>src/app/onboarding/plan/page.tsx, src/app/(dashboard)/dashboard/plan/page.tsx</files>

  <action>
In BOTH files, replace the `priceFormatter` declaration and update its single call site.

**Formatter (identical in both files, byte for byte):** drop `style` and `currency` entirely so
the formatter defaults to `"decimal"`, and switch the locale to `"en-US"` for comma grouping.
Keep `maximumFractionDigits: 0`. The construction becomes
`new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })`.

**Call site (one per file):** the currency text no longer comes from the formatter, so append it
manually. Both files currently read
`price: priceFormatter.format(PLANS[tier].monthlyPriceXaf),` — wrap it in a template literal so
the value becomes `priceFormatter.format(...)` followed by a space and the literal `XAF`.

**Doc comment above the formatter — rewrite in both files.** Follow the existing codebase
convention: a `/** ... */` JSDoc block, explaining *why*, not what. It must cover three points:
  1. This is deliberately NOT the `fr-CM` `style: "currency"` formatter CLAUDE.md documents for
     the rest of this codebase.
  2. Why: the product owner asked for comma-grouped `5,000 XAF` on the subscription-plan price
     display specifically, and no Intl locale produces that shape via `style: "currency"` —
     English locales prefix the code, suffixing locales use space/dot grouping. Hence a plain
     decimal formatter plus a literal ` XAF` suffix at the call site. Cite quick task
     `260831-urm` so the decision is traceable.
  3. `maximumFractionDigits: 0` is required rather than cosmetic — the currency has no decimal
     subunit in common use (this rationale already exists in the onboarding file; keep it).

For `src/app/(dashboard)/dashboard/plan/page.tsx` ONLY, the comment must additionally retain the
existing cross-reference invariant — that it matches `/onboarding/plan`'s formatter exactly so a
price never reads differently between the two plan surfaces. Do not drop that sentence.

Keep the "Copy language is English" note where it already appears; it is still true and still
independent of the number formatting.

Write the deviation rationale INSIDE the `/** */` block (lines beginning with `*`), not as a
trailing `//` comment — the verify gate strips `//` comments and `*`-led doc lines before
counting, and a stray `//` mention of `style: "currency"` will not trip it, but keeping the
rationale in the JSDoc block matches the file's existing style.

Nothing else in either file changes: no import changes, no JSX changes, no `strings.ts` entry,
no new dependency.
  </action>

  <verify>
    <automated>
bash -c '
set -e
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
FAIL=0
for f in "src/app/onboarding/plan/page.tsx" "src/app/(dashboard)/dashboard/plan/page.tsx"; do
  # Positive: decimal en-US formatter present.
  grep -qF "new Intl.NumberFormat(\"en-US\", {" "$f" || { echo "FAIL: no en-US decimal formatter in $f"; FAIL=1; }
  # Positive: literal XAF suffix appended at the call site.
  grep -qF ")} XAF" "$f" || { echo "FAIL: no \" XAF\" suffix at call site in $f"; FAIL=1; }
  # Negative: no currency-style formatter left in CODE. Strip // comments and
  # JSDoc *-led lines first, because the required rationale comment names the
  # very tokens being counted.
  CODE=$(sed -e "s://.*::" "$f" | grep -v "^[[:space:]]*\*")
  N=$(printf "%s\n" "$CODE" | grep -c "style: \"currency\"" || true)
  [ "$N" = "0" ] || { echo "FAIL: $N live style:\"currency\" occurrence(s) remain in $f"; FAIL=1; }
  M=$(printf "%s\n" "$CODE" | grep -c "fr-CM" || true)
  [ "$M" = "0" ] || { echo "FAIL: $M live fr-CM occurrence(s) remain in $f"; FAIL=1; }
  # Rationale comment must exist so a future reader does not revert this.
  grep -q "260831-urm" "$f" || { echo "FAIL: no 260831-urm deviation rationale in $f"; FAIL=1; }
done
# Invariant: the two formatter constructions are identical to each other.
A=$(grep -F "new Intl.NumberFormat(" "src/app/onboarding/plan/page.tsx")
B=$(grep -F "new Intl.NumberFormat(" "src/app/(dashboard)/dashboard/plan/page.tsx")
[ "$A" = "$B" ] || { echo "FAIL: plan formatters diverged between the two surfaces"; FAIL=1; }
# Out-of-scope files must still use the fr-CM currency formatter.
for f in "src/app/(dashboard)/dashboard/orders/format.ts" "src/app/s/[slug]/cart/page.tsx" "src/server/payments/whatsapp.ts"; do
  grep -qF "fr-CM" "$f" || { echo "FAIL: out-of-scope file $f was modified"; FAIL=1; }
done
[ "$FAIL" = "0" ] && echo "PASS: gates green"
exit $FAIL
'
    </automated>
    <automated>npm run lint</automated>
    <automated>npm run typecheck</automated>
    <automated>npm run test:unit</automated>
  </verify>

  <done>
Both plan pages construct `new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })` and
append a literal ` XAF` at their one call site, producing `5,000 XAF` for Starter,
`12,500 XAF` for Business and `25,000 XAF` for Professional on both surfaces. Each file carries
a JSDoc rationale citing quick task `260831-urm`; the dashboard file still states the
match-onboarding invariant. `npm run lint` (`--max-warnings=0`), `npm run typecheck` and
`npm run test:unit` are all green. No other file in the repo is modified.
  </done>
</task>

</tasks>

<verification>
- Gate script above passes (formatter shape, suffix present, no live `fr-CM`/`style: "currency"`
  in either file, formatters identical to each other, out-of-scope files untouched).
- `npm run lint` — zero warnings (`--max-warnings=0` is a hard gate).
- `npm run typecheck` — clean.
- `npm run test:unit` — green. In particular `tests/unit/entitlements.test.ts` and
  `tests/unit/dashboard-nav.test.ts` must stay green.
- `git status` shows exactly two modified files.
- `npx next build` is a BONUS, not a gate — the known pre-existing worktree/Turbopack
  `node_modules` junction issue in this environment makes it unreliable, same caveat as the
  previous quick task in this session. Do not spend context chasing it.
</verification>

<success_criteria>
- `/onboarding/plan` and `/dashboard/plan` both render the Starter tier as exactly `5,000 XAF`.
- The two surfaces render byte-identical price strings for the same tier.
- The CLAUDE.md deviation is recorded in-file at both sites and traceable to quick task
  `260831-urm`, so it reads as an intentional decision rather than drift.
- `CLAUDE.md` is unmodified.
- No product / cart / checkout / order / WhatsApp price formatting changed.
</success_criteria>

<output>
Create `.planning/quick/260831-urm-change-the-subscription-plan-price-displ/260831-urm-SUMMARY.md` when done.
</output>
