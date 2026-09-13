# Phase 7: Trial & Template-Tier Business Rules - Pattern Map

**Mapped:** 2026-09-13
**Files analyzed:** 12 (11 modified, 1 created)
**Analogs found:** 12 / 12

> **Read this alongside `07-RESEARCH.md`, not instead of it.** RESEARCH.md owns the
> exhaustive *what and where* (every file:line, every old→new value). This document
> owns the *how it must look* — which existing file each edit should imitate, and the
> concrete excerpt to copy the shape from. Where the two overlap, RESEARCH.md's
> file:line table is authoritative for the site list.

This phase creates almost no new code. It is a **value-change phase with a
rename-like blast radius**, so the dominant pattern question is not "how do I write a
new controller" but "how does this codebase express a rule-carrying constant, its
dependent copy, and the tests that pin it — so that the three cannot drift apart." The
answer is already in the repo three times over (`STARTER_PRODUCT_CAP`/`products`,
`TRIAL_URGENT_DAYS`, `PLAN_TIER_RANK`), and every edit below should read as if it had
always been written that way.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/server/entitlements/resolve.ts` (mod) | config / rule constant | pure transform | `TRIAL_URGENT_DAYS` — same file, lines 36-41 | exact (same file, sibling constant) |
| `src/server/entitlements/plans.ts` (mod) | config / registry table | pure lookup | `PlanLimits.products` (50/250/null) in the same `PLANS` table | exact |
| `src/server/theming/registry.ts` (mod) | model / data registry | pure lookup | existing entries, e.g. `"fashion-edit"` L595-603 | exact (value-only edit of an existing shape) |
| `src/server/theming/access.ts` (mod) | service / gate | pure predicate | its own header comment block (L13, L37) | exact — **comments only, zero logic change** |
| `src/lib/strings/index.ts` (mod) | config / copy namespace | static data | adjacent `strings.plan.*` entries L262-316 | exact |
| `src/lib/strings/marketing.ts` (mod) | config / copy namespace | static data | its own header + `templates.constraint` L62-67 | exact |
| `tests/unit/entitlements.test.ts` (mod) | test (unit, no DB) | pure transform | the `urgency` block's `atDaysLeft` helper, L303-305 | exact — **in-file pattern to imitate** |
| `tests/unit/template-distinctiveness.test.ts` (mod) | test (unit, no DB) | pure lookup | its own rule-5 segment loop L291-309 | exact |
| `tests/isolation/trial.test.ts` (mod) | test (isolation, DB) | request-response | its own L191-193 (already `TRIAL_DAYS`-relative) | exact |
| `tests/isolation/template-switch.test.ts` (mod) | test (isolation, DB) | CRUD / write-gate | same file's surrounding refusal cases | exact — comment + fixture-key swap |
| `tests/isolation/onboarding-template.test.ts` (mod) | test (isolation, DB) | CRUD / write-gate | same file's surrounding refusal cases | exact — comment + fixture-key swap |
| **`tests/unit/template-tier-allocation.test.ts` (NEW)** | test (unit, no DB) | pure lookup | **`tests/unit/product-limit.test.ts` L9-51** | exact (structural twin) |

**Naming note for the new file:** repo convention is kebab-case, and contract/invariant
tests are *named after what they assert, not what they touch*
(`no-tenant-id-param.test.ts`, `single-order-state-writer.test.ts`,
`surface-token-isolation.test.ts`). `template-tier-allocation.test.ts` fits that
register. Do not name it `registry.test.ts` — `theming-registry.test.ts` already exists
and asserts something else (section/variant shape).

---

## Pattern Assignments

### `src/server/entitlements/resolve.ts` (config, pure transform)

**Analog:** the same file's `TRIAL_URGENT_DAYS`, immediately below the constant being
changed. It is the house style for "a number that encodes a rule."

**Constant + doc-comment pattern** (`resolve.ts:31-41`, read at HEAD):

```ts
const DAY_MS = 86_400_000;

/** ONB-05: every plan gets the same 10-day full-feature trial. */
export const TRIAL_DAYS = 10;

/**
 * D-12: the banner escalates in the final stretch. The threshold is one
 * constant, exported, so the visual treatment cannot drift away from the test
 * that pins it — "final 1-2 days" is `daysLeft <= 2`, decided once, here.
 */
export const TRIAL_URGENT_DAYS = 2;
```

**What to copy:** the doc comment leads with the requirement ID, states the rule in
prose, and — in `TRIAL_URGENT_DAYS`' case — names *why* it is a constant at all. The
edit is `10 → 30` plus `10-day → 30-day` in the line-33 comment. Do not restructure,
do not add a second constant, do not make it env-configurable (RESEARCH.md § Runtime
State Inventory verified it is compile-time by design).

**Header-comment debt pattern** — the module header (L14-28) asserts the old number as
fact in two places. This codebase treats headers as load-bearing (CLAUDE.md: "Every
non-trivial module opens with a header comment citing the requirement/decision ID it
satisfies"), so these are part of the change, not follow-up work:

```ts
 *   1. **`now` is a parameter.** This file never reads the system clock. That
 *      is what makes day 1, day 9, the day-10 boundary, the millisecond either
 *      side of it and subscribed-after-expiry all expressible in the fast unit
 *      project with no clock mocking and no database.
...
 *      count from the server. ONB-05 reads "10 days from signup", so
 *      `ceil((endsAt - now) / 86 400 000)` is also the semantically correct
```

**Pattern to apply:** rewrite these in the *same voice and structure*, substituting the
new numbers ("day 1, day 29, the day-30 boundary…", `"30 days from signup"`). Line 97's
`a Starter merchant on day 2 of their 10 days` becomes `…of their 30 days` — note the
example day (2) still works and should not change; only the window length does.

---

### `src/server/entitlements/plans.ts` (config, pure lookup)

**Analog:** the `products` key in the very same `PLANS` table — a per-tier numeric triple
with `null` meaning unlimited, guarded by a dedicated unit test. `templates` is its
structural twin and must move the same way.

**Registry-value pattern** (`plans.ts:190-232`):

```ts
export const PLANS: Readonly<Record<PlanTier, PlanDefinition>> = {
  starter: {
    tier: "starter",
    monthlyPriceXaf: 5_000,
    recommended: false,
    limits: {
      members: 1,
      products: 50,
      editorSections: null,
      storefrontEditor: false,
      discountCodes: false,
      bulkImport: false,
      templates: 10,        // → 15
    },
  },
  business: {
    // …
      templates: 25,        // → 32  (cumulative: 15 + 17, NOT 17)
  },
  professional: {
    // …
      templates: null,      // unchanged — "all of them", never a count
  },
```

**Doc-comment pattern that must move in lockstep** (`plans.ts:137-141`) — this comment is
the one place the cumulative arithmetic is written out, and it goes false on the same
commit:

```ts
  /**
   * How many templates this tier can SELECT from in the picker (TMPL-04).
   * `null` is all of them. These are CUMULATIVE reachable counts (nested,
   * per D-06) — Business's 25 is Starter's 10 plus 15 more, not a per-tier
   * increment.
```

→ `Business's 32 is Starter's 15 plus 17 more`. Keep the "not a per-tier increment"
clause — it is exactly the misreading `32` invites.

Also at `plans.ts:123`: `D-15 grants every merchant full editor capability during the
10-day trial` → `30-day`.

**What NOT to copy:** the same comment block (L143-161) warns twice, in all-caps, `DO
NOT READ THIS VALUE AT A CALL SITE`. This phase must not introduce any read of
`limits.templates` as a gate — the gate stays `accessibleTemplateKeys`.

---

### `src/server/theming/registry.ts` (model / data registry, pure lookup)

**Analog:** every existing entry in the same file. The edit is twelve one-word value
changes inside an already-correct shape.

**Entry pattern** (`registry.ts:595-623`, verbatim at HEAD):

```ts
  "fashion-edit": {
    key: "fashion-edit",
    segment: "fashion-apparel",
    minTier: "starter",
    sections: [
      { type: "hero", variant: "stack" },
      { type: "product-grid", variant: "showcase" },
    ],
  },

  "fashion-muse": {
    key: "fashion-muse",
    segment: "fashion-apparel",
    minTier: "professional",
    sections: [
      { type: "hero", variant: "stack" },
      { type: "product-grid", variant: "showcase" },
    ],
  },

  "fashion-studio": {
    key: "fashion-studio",
    segment: "fashion-apparel",
    minTier: "business",
    sections: [
      { type: "hero", variant: "split" },
      { type: "product-grid", variant: "dense" },
    ],
  },
```

**The edit shape — exactly this, twelve times** (D-06 / Option D key lists):

```ts
  "fashion-studio": {
    key: "fashion-studio",
    segment: "fashion-apparel",
    minTier: "starter",
    sections: [ /* UNCHANGED — do not touch */ ],
  },
```

**Binding constraints carried from RESEARCH.md § Pitfall 4 and the file's own header:**

1. **Only the `minTier` line changes per entry.** No `key`, no `segment`, no `sections`.
2. **Do not touch the `TEMPLATE_KEYS` array** (L433+). Its declaration order is
   load-bearing for `accessibleTemplateKeys`' return order, for
   `onboarding/branding/page.tsx`'s within-segment tiebreaker, and for
   `template-preview-manifest.test.ts`. A diff line inside that block is a defect.
3. **No trailing `// was "business"` comments in the registry.** The file's own header
   (L46-55) scopes it to data; the "what moved and why" record belongs in the new
   frozen-table test (below) and in the phase summary, where it is machine-checked.
   Verify against the header's wording before adding any comment here.
4. The 12 keys are fixed by D-06 (Option D) — **business→starter (5):** `fashion-studio`,
   `electronics-pulse`, `beauty-radiance`, `grocery-pantry`, `retail-bazaar`.
   **professional→business (7):** `fashion-classic`, `fashion-muse`,
   `electronics-signal`, `beauty-veil`, `beauty-satin`, `grocery-harvest`,
   `furniture-grain`.

---

### `src/server/theming/access.ts` (service / gate) — **comments only**

**Analog:** itself. Zero logic changes. RESEARCH.md § Architectural Responsibility Map
verified `canUseTemplate` / `accessibleTemplateKeys` / `assertTemplateAccess` are pure
functions of `minTier` and `PLAN_TIER_RANK` and need no edit.

Two header lines state the old split as fact and go false:

- `access.ts:13` — `TMPL-04's 10/15/25 split is enforced HERE` → `15/17/18`
  (note: **per-tier** counts here, not cumulative — this line describes the `minTier`
  population, unlike `plans.ts`' cumulative `15/32/50`. Getting these two the wrong way
  round is the single easiest mistake in this phase.)
- `access.ts:37` — `D-15 elevates the EDITOR during the 10-day trial` → `30-day`

**Warning sign for the verifier:** any diff line in this file that is not inside a
comment.

---

### `src/lib/strings/index.ts` and `src/lib/strings/marketing.ts` (config / copy)

**Analog:** the adjacent entries in the same objects. This codebase's copy convention is
strict and already-correct here: literals live in `strings`, each non-obvious one
carries a `/** … */` justifying its wording, and `.tsx` never holds prose.

**Copy-entry pattern** (`index.ts:262-277`):

```ts
     * signup (D-03), and switching is an active-trial capability (D-06).
     * Do not soften either into a vaguer promise, and do not extend
     * "any time" past the trial.
     */
    subline:
      "Free for 10 days. No card required. You can change your plan any time during your trial.",

    /** The one primary button on the page. */
    cta: "Start my 10-day trial",
```

**Marketing header pattern** (`marketing.ts:26-32`) — the file self-certifies its
numbers against source, so the header is part of the change:

```ts
 * Voice contract (05.2-UI-SPEC.md § Copywriting Contract, D-03): English,
 * second person, no exclamation marks, no apology interjections, no emoji, no
 * superlative with no referent, no invented count. Every numeric claim on
 * this page (10-day trial, 10/25/50 templates per tier) matches
 * `src/server/entitlements/plans.ts`'s actual `PLANS` values exactly; …
```

→ `(30-day trial, 15/32/50 templates per tier)`. Keep the "matches `PLANS` exactly"
clause — it is the honesty contract this phase is re-satisfying, not removing.

**Rules for every copy edit in both files:**

- **Work from RESEARCH.md § 1c and § 2h's file:line tables. Do not run a find-and-replace
  on "10".** Live traps confirmed in-repo: `aspect-[16/10]` (aspect ratio),
  `"Up to 10 staff accounts"` (seat count), `index.ts:5`'s `"30-day solo"` (the *project
  timeline* — a blind "10 day"→"30 day" sweep would leave it right by accident and a
  "30"→"…" sweep would corrupt it).
- **Do not touch `strings.trial.*`.** `daysLeft` / `oneDayLeft` interpolate a
  server-computed integer and are already correct at any trial length. A diff there is a
  warning sign.
- **Do not introduce interpolation** (e.g. reading `TRIAL_DAYS` into the copy). RESEARCH
  § Don't Hand-Roll: the literals are deliberate so `landing-page-contract.test.ts` can
  read the claim as source text.
- **Both plan surfaces share one namespace** — `onboarding/plan/page.tsx` and
  `(dashboard)/dashboard/plan/page.tsx` both read `strings.plan.*`, so the three
  `strings.plan` edits cover both. There is no second copy to keep in sync.
- **Zero `.tsx` files change in this phase.** A `.tsx` in the diff means a literal was
  inlined — a CLAUDE.md violation and a contract-test failure waiting to happen.

---

### **NEW** `tests/unit/template-tier-allocation.test.ts` (test, pure lookup)

**Analog:** `tests/unit/product-limit.test.ts` — a structural twin. Same problem
(a per-key value in a registry that a future edit could silently drift), same solution
(an independent expectation table + a completeness assertion + `it.each` driven from the
canonical key list). Copy its skeleton and its reasoning voice.

**Full pattern to imitate** (`product-limit.test.ts:9-51`):

```ts
/**
 * SUB-01, the catalog half — the carried-forward 02-CONTEXT.md D-07 product cap.
 *
 * `PlanLimits.products` was REGISTERED in Phase 2 and enforced by nothing. This
 * file is one half of making it real; `tests/isolation/catalog.test.ts` is the
 * other, and the two prove different things on purpose. …
 *
 * The tier cases are DRIVEN FROM `PLAN_TIERS` rather than typed out. A fourth
 * tier added to the registry without a `limits.products` value would otherwise
 * slip through a hand-written three-case table — the same drift-detection
 * discipline `TENANT_SCOPED_MODELS` applies to the schema.
 */

/**
 * The values the registry is expected to hold, written out ONCE, independently
 * of `PLANS`. Reading the expectation out of the object under test would make
 * the assertion tautological: a backfill that set every tier to `null` would
 * still pass. This table is the second, independent expression of the rule.
 */
const EXPECTED_CAP: Readonly<Record<string, number | null>> = {
  starter: 50,
  business: 250,
  professional: null,
};

describe("registry", () => {
  it("declares a products cap for every tier, with no key left unexpected", () => {
    // A fourth tier has to be added to EXPECTED_CAP before this file will pass,
    // which is the whole point of driving the cases from PLAN_TIERS.
    expect([...PLAN_TIERS].sort()).toEqual(Object.keys(EXPECTED_CAP).sort());
  });

  it.each(PLAN_TIERS)("PLANS.%s.limits.products matches the pricing reference", (tier) => {
    expect(PLANS[tier].limits.products).toBe(EXPECTED_CAP[tier]);
  });
});
```

**Map it onto D-03 exactly:**

- `EXPECTED_CAP` → `EXPECTED_MIN_TIER: Readonly<Record<TemplateKey, PlanTier>>`, all
  **50** keys pinned to their post-change tier. This is the *frozen-table* form RESEARCH
  § Wave 0 Gaps recommends (A4) — a snapshot of the D-06 decision, not of the code.
- The "no key left unexpected" case → `expect([...TEMPLATE_KEYS].sort()).toEqual(
  Object.keys(EXPECTED_MIN_TIER).sort())`. This is what makes a 51st template a red
  build rather than an untested one.
- `it.each(PLAN_TIERS)` → `it.each(TEMPLATE_KEYS)("%s sits at its decided tier", …)`.
- Add the D-03 direction assertion in the same register: the table must produce exactly
  15/17/18 by `minTier` population, and the header comment must state that **every move
  in Phase 7 was downward** (no key's rank increased), citing D-03.

**D-02 segment-balance case — analog:**
`tests/unit/template-distinctiveness.test.ts:291-309`. Copy this loop shape verbatim,
including the vacuity guard and the long `expect` message:

```ts
  it("gives every segment at least one Starter-accessible template", () => {
    const starter = accessibleTemplateKeys("starter");

    expect(
      starter.length,
      "accessibleTemplateKeys(\"starter\") did not return a non-empty list — " +
        "every assertion below is vacuous against an empty set.",
    ).toBeGreaterThan(0);

    for (const segment of INDUSTRY_SEGMENTS) {
      expect(
        starter.some((key) => TEMPLATES[key].segment === segment),
        `Segment "${segment}" has no Starter-accessible template, so a ` +
          "Starter merchant who picks it at onboarding opens a picker with " +
          "nothing designed for them — the dead-end guard Finding 5 exists " +
          "to prevent.",
      ).toBe(true);
    }
  });
```

**Adapt to:** every segment has **≥2** Starter-accessible templates *and* **≥1**
Professional-only template. The second half is the clause that would have caught Option
A automatically (fashion-apparel → zero Professional) and is the durable expression of
D-02. Note the existing L291 rule only requires ≥1 Starter, so the new file **raises**
the floor rather than duplicating it — say so in the header, the way
`product-limit.test.ts`'s header explains its relationship to
`tests/isolation/catalog.test.ts`.

**Voice note:** both analogs use a long, argued `expect(value, message)` second argument
explaining *what breaks in the product* when the assertion fails, not what the numbers
are. Match that. A bare `.toBe(true)` here would be out of register for this codebase.

---

### `tests/unit/entitlements.test.ts` (test, pure transform)

**Analog: the file's own `urgency` block.** This is the most important pattern in the
phase — RESEARCH § 3a's structural recommendation, and the difference between "fix six
assertions" and "this file never breaks on a trial-length change again."

**The pattern that survives** (`entitlements.test.ts:52-53` and `303-305`):

```ts
/** `TRIAL_DAYS` after T0 — the derived expiry when `trialEndsAt` is null. */
const DERIVED_END = new Date(T0.getTime() + TRIAL_DAYS * DAY_MS);

// …

describe("urgency", () => {
  const atDaysLeft = (days: number): Date =>
    new Date(DERIVED_END.getTime() - days * DAY_MS);
```

The entire `urgency` block passes unchanged at any `TRIAL_DAYS` because every instant it
names is anchored to `DERIVED_END`.

**The pattern that breaks** — absolute offsets from `T0` (`L271`, `L275-280`, `L326`,
`L363-365`):

```ts
    expect(TRIAL_DAYS).toBe(10);
    // …
    expect(resolveEntitlements(orgRow(), at(1 * DAY_MS)).trial.daysLeft).toBe(9);
    expect(resolveEntitlements(orgRow(), at(9 * DAY_MS)).trial.daysLeft).toBe(1);
    // …
    const ctx = resolveEntitlements(orgRow(), at(11 * DAY_MS));
    // …
  /** Inside the derived 10-day window. */
  const DURING_TRIAL = at(2 * DAY_MS);
  /** Past it — the derived trial has lapsed. */
  const AFTER_TRIAL = at(11 * DAY_MS);
```

**Rewrite rule:** re-express every `at(N * DAY_MS)` that *means* a trial-relative instant
in the `atDaysLeft` / `TRIAL_DAYS ± n` register — `at((TRIAL_DAYS + 1) * DAY_MS)` for
"after the trial", `atDaysLeft(1)` for "one day left". Do **not** renumber `11` to `31`.
Exception: `expect(TRIAL_DAYS).toBe(30)` at L271 stays a hard literal — it is the one
assertion whose entire job is to pin the number, and making it relative would make it
tautological (the same argument `product-limit.test.ts`'s `EXPECTED_CAP` header makes).

**The two vacuous sites are not optional** (RESEARCH § Pitfall 2 — they stay green):

- L245-253 `granted = at(30 * DAY_MS)` becomes *exactly* `DERIVED_END` at
  `TRIAL_DAYS = 30`, so the test can no longer detect a resolver that ignores
  `trialEndsAt`. → `at((TRIAL_DAYS + 20) * DAY_MS)`.
- L226-232 "once past the end" at `at(30 * DAY_MS)` is now *at* the end, not past it.
  → `at((TRIAL_DAYS + 1) * DAY_MS)`.

**Header debt in the same file** (L23, L29-30, L347, L362): `ONB-05 (10-day trial …)`,
`the day-10 boundary`, `day 2 of their 10-day trial`, `/** Inside the derived 10-day
window. */`. Same treatment as `resolve.ts`'s header — rewrite in voice, do not delete.

**Do not rename the six top-level `describe` blocks** (`registry`, `member limit`,
`trial active`, `trial boundary`, `daysLeft`, `urgency`). The file header (L40-43) warns
that `02-VALIDATION.md` targets them with `-t` filters, and 07-RESEARCH § Phase
Requirements → Test Map does the same. Renaming one breaks a documented command.

---

### `tests/isolation/trial.test.ts` (test, request-response)

**Analog:** the assertion two lines above the one that breaks — the file already
demonstrates the right and wrong forms side by side.

**Both forms, in situ** (`trial.test.ts:191-199`):

```ts
    // Exact, to the millisecond: `createdAt + TRIAL_DAYS` and nothing else.
    expect(ctx.trial.endsAt.getTime()).toBe(
      createdAt.getTime() + TRIAL_DAYS * DAY_MS,
    );
    expect(TRIAL_DAYS).toBe(10);

    expect(ctx.trial.state).toBe("active");
    // `Math.ceil` over a window that opened milliseconds ago: still a full 10.
    expect(ctx.trial.daysLeft).toBe(10);
```

L192-193 is already `TRIAL_DAYS`-relative and needs **no change**. L195 →
`.toBe(30)` (the pinning assertion, same exception as above). L199 →
`.toBe(TRIAL_DAYS)` and its comment → `still a full 30`. Prose at L7, L17, L131 and the
test *name* at L159 (`"derives endsAt as createdAt + 10 days …"`) are text-only edits.

**Environment caveat to carry into the plan:** this file needs `TEST_DATABASE_URL` and
`tests/setup/global-setup.ts` fails closed. It carries two of the four ONB-05
assertions, so if the Neon test branch is unavailable the phase gate must say so rather
than report green off `test:unit`.

---

### `tests/unit/template-distinctiveness.test.ts` (test, pure lookup)

**Analog:** its own rule-7 block, which already encodes the drift-guard pattern this
phase relies on.

**The block, at HEAD** (`L330-359`):

```ts
  it("keeps the tier sets nested and the cumulative counts at 10/25/50", () => {
    // … nesting assertions, unchanged …
    expect([starter.size, business.size, professional.size]).toEqual([
      10, 25, 50,
    ]);

    // The drift guard against the registered catalog size (T-05-76): two
    // numbers — the actual enforced set and the documented one — that can
    // disagree silently otherwise.
    expect(starter.size).toBe(PLANS.starter.limits.templates);
    expect(business.size).toBe(PLANS.business.limits.templates);
    expect(
      PLANS.professional.limits.templates,
      "PLANS.professional.limits.templates must stay null (\"all of them\"), " +
        "not a count that could drift from the registry's actual size.",
    ).toBeNull();
  });
```

**Edits:** the triple → `[15, 32, 50]`; the test *name* → `"…cumulative counts at
15/32/50"` (the name is a documented `-t` filter target — check
`05-VALIDATION.md` / 07-RESEARCH's test map before assuming the rename is free, and
record it if it changes). The `PLANS.*.limits.templates` lockstep assertions and the
nesting assertions need no edit — **they are the mechanism that makes forgetting the
`plans.ts` edit a red test rather than silent drift.** Do not weaken them.

Rules 5 and 6 (L291-326) hold unchanged under Option D — every move is downward, so no
segment loses a Starter template and the Starter-accessible structure count can only
rise.

---

### `tests/isolation/template-switch.test.ts` and `tests/isolation/onboarding-template.test.ts`

**Analog:** each other, and the surrounding refusal cases in each file. These are the
**green-but-false** traps (RESEARCH § 3e) — a plan that chases only the test runner's
output will miss all three sites.

Affected sites:

| File:line | Text that goes false | Why it still passes |
|-----------|----------------------|---------------------|
| `template-switch.test.ts:373` | `// "fashion-classic" is professional-tier (registry.ts) — out of reach for a Starter merchant` | `fashion-classic` becomes **business**; still out of reach for Starter |
| `onboarding-template.test.ts:404` | test name: `"refuses a **Professional** key from a Starter-tier organization"` (+ L415 comment) | same |
| `template-switch.test.ts:532` | `// "fashion-studio" is business-tier — reachable by this fixture's tier` | `fashion-studio` becomes **starter**; still reachable |

**Pattern to apply — swap the fixture key, don't just fix the comment.** For the two
"refuses a Professional key" cases, substitute a key that remains `minTier:
"professional"` under Option D so the test keeps testing the tier it names.
**`retail-district`** is the clean pick: Professional today, Professional under Option D,
and referenced by no other test. Then update the comment to match. L532 is a
comment-only fix (`"fashion-studio" is starter-tier — reachable by this fixture's tier`).

This preserves the security property RESEARCH § Security Domain flags: these two files
are what pin the *server-side* refusal that `assertTemplateAccess` provides independently
of the picker's `locked` flag. A refusal test that no longer exercises a genuine
out-of-tier case has quietly stopped guarding it.

---

## Shared Patterns

### 1. Rule-carrying constant + its doc comment + its pinning test move as one unit

**Source:** `src/server/entitlements/resolve.ts:36-41` (`TRIAL_URGENT_DAYS`),
`src/server/entitlements/plans.ts:137-161` (`templates`),
`tests/unit/product-limit.test.ts:30-40` (`EXPECTED_CAP`).
**Apply to:** every file in this phase.

The house rule, stated three different ways in three files: a number that encodes a
business rule lives in exactly one place, its doc comment names the decision ID and says
why it is a constant, and a test expresses the *same* rule independently so the two can
disagree loudly. Phase 7 changes values inside that structure — it should not add,
remove, or relocate any part of it.

### 2. Header comments are load-bearing and go false on the same commit

**Source:** CLAUDE.md ("Every non-trivial module opens with a header comment citing the
requirement/decision ID it satisfies"); the pattern is visible in every file this phase
touches.
**Apply to:** `resolve.ts` (L23, L33, L97), `plans.ts` (L123, L139-141), `access.ts`
(L13, L37), `marketing.ts` (L29), `entitlements.test.ts` (L23, L347, L362),
`trial.test.ts` (L7, L17, L131, L159).

RESEARCH § Comment/Documentation Debt is the exhaustive list. These are not lint
failures — they are review failures, and leaving them makes the codebase's own comments
misinformation. **Explicit exception:** `.planning/PROJECT.md` L52 and
`.planning/ROADMAP.md` L27/L141 deliberately retain "10 days" as historical record of
what Phase 2 shipped. Do not update those.

### 3. Copy centralization — the diff shape is the tell

**Source:** CLAUDE.md ("UI copy is centralized in `src/lib/strings.ts`, one namespace per
surface. Never inline a user-facing string literal in a component");
`tests/unit/landing-page-contract.test.ts:218,279,303`;
`tests/unit/dashboard-nav.test.ts:244`.
**Apply to:** all 13 copy edits.

RESEARCH § 3g verified by reading the predicates that none of this phase's proposed
strings can trip a contract test (`looksLikeProse` requires ≥3 *purely alphabetic* words,
so `"Free for 30 days."` cannot match; no `BANNED_PHRASES` regex matches
`"Starter reaches 15 templates, Business 32, Professional all 50."`). The corollary is
the review heuristic: **this phase's diff should contain zero `.tsx` files.** One means a
literal was inlined.

### 4. Derive, never stamp — and therefore, never migrate

**Source:** `src/server/entitlements/resolve.ts:135`
(`org.trialEndsAt ?? new Date(org.createdAt.getTime() + TRIAL_DAYS * DAY_MS)`);
`prisma/schema.prisma:132`; `tests/isolation/trial.test.ts:157`.
**Apply to:** the trial half of the phase, and to anything tempted to add a backfill.

This is why D-04/D-05 need zero migration and why RESEARCH's runtime-state inventory
answers "nothing" to "what still holds the old value." A `trialEndsAt` backfill would
*stamp* values and permanently break the invariant `trial.test.ts:157` guards. The
accepted, documented consequence: a row with a non-null `trialEndsAt` (support override)
is not extended — the `??` short-circuits. Population is empty in production today (no
production code path writes that column). Record it in the plan as accepted, not
overlooked.

### 5. Two different tier triples — never interchange them

**Source:** `plans.ts:137-141` (cumulative) vs `access.ts:13` (per-tier).
**Apply to:** every comment and copy edit in the phase.

- **Per-tier `minTier` population:** `15 / 17 / 18` — used in `access.ts`'s header, in
  the new frozen-table test, and in REQUIREMENTS' TMPL-04.
- **Cumulative reachable counts:** `15 / 32 / 50` — used in `plans.ts`'s
  `limits.templates`, in `template-distinctiveness.test.ts`'s triple, and in all
  merchant-facing copy (`"Starter reaches 15 templates, Business 32, Professional all
  50."`).

Confirmed against real semantics, not assumed: `accessibleTemplateKeys` filters on
`>=` against a total order, so the sets are strictly nested (`access.ts:74-82`,
`plans.ts:43-47`).

---

## No Analog Found

None. Every file in this phase has an exact or near-exact in-repo analog — expected for a
value-change phase that creates one new file, and that file is a structural twin of
`tests/unit/product-limit.test.ts`. The planner should not need RESEARCH.md's § Code
Examples as a *pattern* source (only as a value source); the repository already
demonstrates every shape required.

## Notes for the Planner

Three things that are pattern-adjacent and worth carrying into the plan:

1. **Gate the registry edit behind `checkpoint:human-verify`.** RESEARCH § Assumption A1
   and Pitfall 3 both require it; CONTEXT D-06 has since resolved the choice to Option D,
   so the checkpoint is now a *confirmation* of the recorded key lists rather than an
   open question — but the 12 keys are the one part of this phase a reviewer cannot
   re-derive from a constant.
2. **The checklist is RESEARCH §3a and §3e, not the test runner.** Three tests stay green
   while their names and comments become false, and two more stay green while going
   vacuous. `npm run test:unit` green with no diff in `template-switch.test.ts` or
   `onboarding-template.test.ts` is the warning sign.
3. **Do not run `npm run templates:previews`.** Previews are keyed by template key, not
   tier; nothing here invalidates one. Also note for the verifier: ROADMAP criterion 3
   ("locked templates stay visible-but-dimmed") is true of `/onboarding/branding` and not
   of the dashboard themes browser — a pre-existing Phase 5/05.3 divergence this phase
   neither introduces nor fixes.

## Metadata

**Analog search scope:** `src/server/entitlements/**`, `src/server/theming/**`,
`src/lib/strings/**`, `tests/unit/**` (40 files enumerated), `tests/isolation/**`
**Files read for excerpts:** 9 (`product-limit.test.ts`, `marketing.ts`, `resolve.ts`
header, `plans.ts` L115-230, `registry.ts` L575-624, `strings/index.ts` L262-316,
`entitlements.test.ts` L1-60 + L240-374, `template-distinctiveness.test.ts` L275-395,
`trial.test.ts` L185-203)
**Pattern extraction date:** 2026-09-13
