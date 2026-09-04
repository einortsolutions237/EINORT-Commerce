# Phase 5: Template Segment Expansion - Pattern Map

**Mapped:** 2026-09-04
**Files analyzed:** 51 new/modified files
**Analogs found:** 47 / 51

> **Reading note for the planner.** Almost every file in this phase extends code Phase 4
> shipped, so its closest analog is usually the *sibling declaration in the same file* — a new
> `TEMPLATES` row's analog is `TEMPLATES["flagship-fashion"]`, `switchTemplate`'s analog is
> `discardDraft` twelve lines above it. Where that is true the "analog" column names the file
> **and the symbol**, not just the file. `04-PATTERNS.md` was consulted and its Shared Patterns
> 1–7 are re-verified against current source below (§ Shared Patterns); its per-file assignments
> for `registry.ts` / `schema.ts` / `actions.ts` are superseded by the concrete excerpts here,
> which were read fresh from HEAD in this session.

---

## File Classification

### Group A — Foundations (schema, registry, gate, migration)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/server/theming/schema.ts` (M) — `SECTION_VARIANTS`, `SectionVariant<T>`, `SectionVariantMap`, `TemplateSectionRef`, `sectionVariantsSchema` | validation / vocabulary | transform | same file: `hexColorSchema` / `storageKeySchema` / `sectionInstanceSchema` (`schema.ts:36-155`) | exact |
| `src/server/theming/registry.ts` (M) — `TEMPLATE_KEYS` ×50, `TemplateDefinition{segment,minTier,sections}`, `variantsForTemplate()` | config registry | transform | same file: `TEMPLATES` + `isTemplateKey` (`registry.ts:413-473`), `INDUSTRY_SEGMENT_ICONS` (`registry.ts:508-516`) | exact |
| `src/server/theming/access.ts` (NEW) — `canUseTemplate`, `accessibleTemplateKeys`, `assertTemplateAccess` | guard / entitlement | request-response | `src/server/entitlements/assert.ts` — `can` / `assertCanEditStorefront` pair (`assert.ts:86-152`) | exact |
| `src/server/theming/errors.ts` (M) — `TemplateLockedError` | domain error | — | `src/server/entitlements/assert.ts:79-84` `EditorLockedError` | exact |
| `src/server/entitlements/plans.ts` (M) — `PLAN_TIER_RANK`, `PlanLimits.templates` | config registry | transform | same file: `PLANS` + `PlanLimits.products` doc block (`plans.ts:41-186`) | exact |
| `prisma/schema.prisma` (M) — `templateKey` → `publishedTemplateKey` + `draftTemplateKey` | model | — | same file: `StorefrontTheme.draftTokens`/`publishedTokens` pair (`schema.prisma:593-641`) | exact |
| `prisma/migrations/<ts>_template_draft_published/migration.sql` (NEW) | migration | — | `prisma/migrations/20260902141926_storefront_theme_page_industry/migration.sql` | role-match |

### Group B — Template data authoring (the phase's bulk)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/server/theming/defaults.ts` (M) — `TEMPLATE_DEFAULTS`, `templateDefaultDocument(key)`, `templateDefaultTokens(key)` | data builder registry | transform | same file: `flagshipDefaultDocument()` / `flagshipDefaultTokens()` (`defaults.ts:98-224`) | exact |
| `src/server/theming/templates/fashion-apparel.ts` (NEW) | data builder | transform | `src/server/theming/defaults.ts:98-196` (one builder per template, verbatim shape) | exact |
| `src/server/theming/templates/electronics.ts` (NEW) | data builder | transform | same | exact |
| `src/server/theming/templates/beauty-cosmetics.ts` (NEW) | data builder | transform | same | exact |
| `src/server/theming/templates/grocery-food.ts` (NEW) | data builder | transform | same | exact |
| `src/server/theming/templates/furniture-home.ts` (NEW) | data builder | transform | same | exact |
| `src/server/theming/templates/general-retail.ts` (NEW) | data builder | transform | same | exact |
| `src/lib/strings.ts` → `src/lib/strings/index.ts` (MOVE, zero content diff) | copy catalogue | — | *no analog — first module-directory split in this repo* | none |
| `src/lib/strings/templates/<segment>.ts` (NEW ×6) | copy catalogue | — | `src/lib/strings.ts:1322-1375` `strings.flagship` namespace | exact |

### Group C — Storefront rendering (the 7 new variants)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/app/s/[slug]/sections/section-renderer.tsx` (M) — `variants` prop | component (dispatch) | request-response | same file, unchanged shape (`section-renderer.tsx:87-116`) | exact |
| `src/app/s/[slug]/sections/hero-section.tsx` (M) — inner variant switch + `HeroFullBleed` | component | request-response | current body of `HeroSection` (`hero-section.tsx:91-222`) becomes `HeroFullBleed` verbatim | exact |
| `.../hero-split.tsx`, `.../hero-stack.tsx` (NEW) | component | request-response | `hero-section.tsx:91-222` | exact |
| `.../trust-bar-section.tsx` (M) + `trust-bar-strip` (NEW) | component | request-response | `trust-bar-section.tsx` (current body) | exact |
| `.../product-grid-section.tsx` (M) + `dense`, `showcase` (NEW) | component | request-response | `product-grid-section.tsx` (current body) | exact |
| `.../editorial-split-section.tsx` (M) + `banner` (NEW) | component | request-response | `editorial-split-section.tsx` (current body) | exact |
| `.../contact-section.tsx` (M) + `card` (NEW) | component | request-response | `contact-section.tsx` (current body) | exact |
| `src/app/s/[slug]/page.tsx` (M) — resolve + pass `variants` | page RSC | request-response | same file `:166-183` (the existing `.map` call site) | exact |
| `src/app/s/[slug]/preview/page.tsx` (M) — published variants only | page RSC | request-response | same file (ungated, published-only posture) | exact |
| `src/app/s/[slug]/preview/preview-canvas.tsx` (M) — 4th postMessage field | client island | event-driven | same file `:262-268` (`safeParse` step 3) | exact |

### Group D — Server read/write

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/server/theming/actions.ts` (M) — `switchTemplate` | Server Action (write) | CRUD | same file: `discardDraft` (`actions.ts:280-371`) | exact |
| `src/server/theming/actions.ts` (M) — `publishStorefront` promotes template | Server Action (write) | CRUD | same file `:213-261` | exact |
| `src/server/theming/actions.ts` (M) — `discardDraft` reverts template | Server Action (write) | CRUD | same file `:304-365` | exact |
| `src/server/theming/actions.ts` (M) — `saveBranding` takes `templateKey` | Server Action (non-DAL) | CRUD | same file `:508-663` | exact |
| `src/server/theming/queries.ts` (M) — `publishedTemplateKey` / `draftTemplateKey` in `select` | service read | request-response | same file `:114-159` and `:194-208` | exact |

### Group E — Dashboard surfaces

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/components/theming/template-thumbnail.tsx` (NEW) | presentational component | transform | *partial* — `src/app/s/[slug]/sections/*` for token discipline; no wireframe precedent | partial |
| `src/components/theming/template-picker.tsx` (NEW) | client island | request-response | `src/app/onboarding/branding/branding-form.tsx:605-667` (industry `RadioGroup` tile grid) | exact |
| `src/app/onboarding/branding/page.tsx` (M) — assemble `TemplateTile[]` | page RSC | request-response | same file `:105-118` (`SegmentTile[]` assembly) | exact |
| `src/app/onboarding/branding/branding-form.tsx` (M) — new Card 3 | client island | request-response | same file `:605-667` (Card 2) | exact |
| `.../storefront-editor/section-list.tsx` (M) — `Change template` rail row | client island | event-driven | same file `:233-246` (`Brand & logo` row) | exact |
| `.../storefront-editor/change-template-panel.tsx` (NEW) | client island | request-response | `.../settings-panel.tsx` (theme-panel branch) + `publish-bar.tsx:315-339` (alert-dialog) | exact |
| `.../storefront-editor/editor-shell.tsx` (M) — `onTemplateSwitched` | client island / state | event-driven | same file's existing `onDiscarded` / `DiscardedState` callback contract | exact |
| `.../storefront-editor/page.tsx` (M) — pass accessible templates + variants | page RSC | request-response | same file `:179-191` (`<EditorShell …>` prop block) | exact |
| `.../storefront-editor/publish-bar.tsx` (read-only) — no change; status branch reused | client island | event-driven | same file's `dirty ? … : hasUnpublishedChanges ? …` derivation | exact |

### Group F — Tests

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `tests/unit/template-distinctiveness.test.ts` (NEW) | unit test | transform | `tests/unit/theming-registry.test.ts` (non-vacuity idiom, `:49-55`, `:200-216`) | exact |
| `tests/unit/theming-marker-boundary.test.ts` (NEW) | source-scan contract test | batch | `tests/unit/single-order-state-writer.test.ts`, `tests/unit/no-tenant-id-param.test.ts` | exact |
| `tests/unit/theming-registry.test.ts` (M) — loop 1 → 50 | unit test | transform | same file `:411-471` | exact |
| `tests/isolation/template-switch.test.ts` (NEW) | isolation test | CRUD | `tests/isolation/storefront-editor.test.ts:1-67` (header + real-session harness) | exact |
| `tests/isolation/onboarding-template.test.ts` (NEW) | isolation test | CRUD | `tests/isolation/branding.test.ts` | exact |
| `tests/setup/seed-two-tenants.ts` (verify unchanged) | fixture | — | itself | exact |

---

## Pattern Assignments

### `src/server/theming/schema.ts` (M) — the variant vocabulary

**Analog:** the same file's existing primitives + union. **This file must stay marker-free.**

**The marker constraint, quoted from the file it governs** (`schema.ts:3-13`):

```ts
/**
 * ---------------------------------------------------------------------------
 * THIS FILE DELIBERATELY CARRIES NO `server-only` MARKER. DO NOT ADD ONE.
 * ---------------------------------------------------------------------------
 * `src/app/s/[slug]/preview/preview-canvas.tsx` is a client component and it
 * MUST validate the postMessage payload with `pageDocumentSchema` before any
 * state update (Pitfall 4, T-04-08). A `server-only` import here breaks that
 * build. ...
 */
```

**Registry-constant pattern to copy** — `SECTION_VARIANTS` follows `INDUSTRY_SEGMENTS` /
`INDUSTRY_SEGMENT_ICONS`'s `as const` + `Readonly<Record<…>>` shape (`registry.ts:487-516`),
not a plain object:

```ts
export const INDUSTRY_SEGMENTS = [
  "fashion-apparel",
  ...
] as const;

export type IndustrySegment = (typeof INDUSTRY_SEGMENTS)[number];

export const INDUSTRY_SEGMENT_ICONS: Readonly<Record<IndustrySegment, string>> = { ... };
```

**Security-control comment style for the new `sectionVariantsSchema`** (copy the register, not
the words) — `schema.ts:57-71`:

```ts
/**
 * An R2 derivative PREFIX, never a URL — the same convention
 * `ProductImage.storageKey` already stores.
 *
 * A key is combined with `R2_PUBLIC_BASE_URL` at render time, so accepting an
 * absolute URL here would let a document point the storefront's `<Image>` at an
 * arbitrary host. ...
 */
export const storageKeySchema = z
  .string()
  .regex(
    /^tenants\/[A-Za-z0-9_-]+\/(products|logos)\/[a-z0-9-]{8,64}$/,
    "Not a storage key.",
  );
```

> **Do not widen this regex.** RESEARCH Finding 3 turns on it: it is why all 50 templates ship
> `backgroundImageKey: null` / `imageKey: null`.

**Trust-boundary framing to reuse in `sectionVariantsSchema`'s doc comment** — `schema.ts:15-33`
enumerates three doors (`draft`/`published` JSONB, postMessage, publish gate). The variant map
adds a **fourth, narrower** door: postMessage only, deliberately *not* part of
`pageDocumentSchema`. Say so explicitly, and say why (D-02: not merchant-editable).

---

### `src/server/theming/registry.ts` (M) — 50 rows, `segment`, `minTier`, per-section variants

**Analog:** `TEMPLATES["flagship-fashion"]` and `isTemplateKey`, in the same file.

**Current row + narrower** (`registry.ts:413-473`) — the exact shape 49 new rows extend:

```ts
export const TEMPLATE_KEYS = ["flagship-fashion"] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export interface TemplateDefinition {
  readonly key: TemplateKey;
  /** The ordered section types a new storefront on this template ships with. */
  readonly sections: readonly SectionType[];
}

export const TEMPLATES: Readonly<Record<TemplateKey, TemplateDefinition>> = {
  "flagship-fashion": {
    key: "flagship-fashion",
    sections: ["hero", "trust-bar", "product-grid", "editorial-split", "contact"],
  },
};

const TEMPLATE_KEY_SET: ReadonlySet<string> = new Set(TEMPLATE_KEYS);

/** Narrows an untrusted value — a stored column, a form field — to a template. */
export function isTemplateKey(value: unknown): value is TemplateKey {
  return typeof value === "string" && TEMPLATE_KEY_SET.has(value);
}
```

**Binding constraints carried in this file's own header** (`registry.ts:423-448`) — reproduce
them, updated, rather than deleting them:

```
 * D-03: A `templateKey` IS DELIBERATELY INDEPENDENT OF `Organization.industry`.
 *   - NO MERCHANT IS EVER AUTO-MIGRATED. When Phase 5 ships a fashion-specific
 *     template, every merchant already on `flagship-fashion` stays on it until
 *     they choose otherwise. A backfill that "upgrades" live storefronts is a
 *     mass unannounced redesign of other people's businesses.
 *
 * No display name lives on a row yet — ... Phase 5 adds it to `strings` at the
 * same time it adds the surface.
```

Phase 5 is that phase: `TemplateDefinition` gains a display-name reference (or the picker reads
`strings.templates[key].name`), `segment`, `minTier`, and `sections: readonly TemplateSectionRef[]`.
The "no derivation from industry" paragraph stays word-for-word.

**Ordering comment to preserve per row** (`registry.ts:452-457`):

```ts
    /*
     * The order is LOCKED and is not alphabetical — see the header of
     * `src/server/theming/defaults.ts` for the background-treatment alternation
     * rule it encodes. `flagshipDefaultDocument()` builds against this list and
     * the drift test asserts the two agree.
     */
```

**`variantsForTemplate(key)` fallback posture** — copy `isIndustrySegment`'s degrade rationale
(`registry.ts:520-536`), which is the house argument for "an unrecognised string degrades, it
does not throw":

```ts
/**
 * Narrows an untrusted value to a real segment (T-04-21).
 *
 * Copied from `isPlanTier` in `src/server/entitlements/plans.ts` deliberately,
 * body for body, because it guards the same shape of hole ...
 * Two narrowers that resolve differently are two chances to be wrong, and the
 * second one is always the one nobody re-reads.
 */
```

---

### `src/server/theming/access.ts` (NEW) — the tier gate

**Analog:** `src/server/entitlements/assert.ts` — copy the boolean/throw pairing *and* its header
argument verbatim in spirit.

**The pairing rule** (`assert.ts:5-25`):

```ts
/**
 * The entitlement guards — SUB-01 and SUB-02 at the call site.
 *
 * Each check exists in two forms on purpose:
 *
 *   - a **boolean** (`can`, `limitFor`) for rendering. A page that hides a
 *     button is a courtesy to the merchant, not a control.
 *   - a **throw** (`assertEntitlement`, `assertCanWrite`) for writes. "Forgot
 *     to check the return value" is a silent bypass; "forgot to call the
 *     assert" is at least a reviewable absence ...
 *
 * Mixing them up is the failure mode this pairing is designed to make obvious:
 * a mutation whose only gate is `if (can(...))` has no gate at all when the
 * caller drops the `if`.
 *
 * Both errors carry a caller-supplied message rather than composing one here.
 */
```

**The pair to mirror shape-for-shape** (`assert.ts:86-89`, `:145-152`):

```ts
/** Rendering-time question: does this tenant's plan include the feature? */
export function can(ctx: MerchantContext, feature: PlanFeature): boolean {
  return ctx.plan.limits[feature];
}

export function assertCanEditStorefront(
  ctx: MerchantContext,
  message: string,
): void {
  if (!ctx.canEditStorefront) {
    throw new EditorLockedError(message);
  }
}
```

**The one deliberate divergence (D-12 / Finding 6).** `assertCanEditStorefront` reads
`ctx.canEditStorefront` (trial-composed). `assertTemplateAccess` reads **`ctx.plan.tier`
directly**. Document the asymmetry at the function, quoting `assert.ts:137-139`'s inverse rule so
a later reader cannot "make them consistent":

```ts
 * Reads `ctx.canEditStorefront` and never `ctx.plan.limits.storefrontEditor`.
 * The registry value is tier-only; `resolveEntitlements` is what folds D-15's
 * trial grant into it.
```

`src/server/theming/access.ts` carries `import "server-only";` as line 1 (Shared Pattern 1).

---

### `src/server/theming/errors.ts` (M) — `TemplateLockedError`

**Analog:** `EditorLockedError`, `src/server/entitlements/assert.ts:61-84` — copy the class **and**
its comment, which explains both the subclass trick and the `this.name` line:

```ts
/**
 * EDIT-03: the merchant may not use the storefront editor ...
 *
 * EXTENDS `EntitlementError` ON PURPOSE, AND THE SUBCLASS RELATIONSHIP IS THE
 * FEATURE. An editor refusal *is* an entitlement refusal, so this inherits the
 * `feature` field and, more importantly, `merchantAction`'s existing
 * `instanceof EntitlementError` arm converts it into
 * `{ ok: false, error: { form: [message] } }` with NO change to that file's
 * control flow. ...
 *
 * The `this.name` re-assignment is not redundant: `EntitlementError`'s own
 * constructor has already set it to `"EntitlementError"` by the time `super()`
 * returns ...
 */
export class EditorLockedError extends EntitlementError {
  constructor(message: string) {
    super("storefrontEditor", message);
    this.name = "EditorLockedError";
  }
}
```

**Naming-convention conflict to resolve deliberately.** `errors.ts:32-38` (the file the new class
lands in) states the *opposite* convention for that file:

```ts
 * `override readonly name` rather than a constructor assignment. That is the
 * canonical form for a NEW file per CLAUDE.md § Naming Patterns ...
 * `src/server/entitlements/assert.ts` assigns in the constructor instead, and
 * that variant is matched only when editing that file
```

→ `TemplateLockedError` lives in `src/server/theming/errors.ts`, so it uses
`override readonly name = "TemplateLockedError"`, **and** carries a `templateKey` field (the
`StorefrontNotSeededError.tenantId` precedent at `errors.ts:42-43`: "a caller that wants to branch
must not have to parse an error string").

---

### `src/server/entitlements/plans.ts` (M) — `PLAN_TIER_RANK` + `PlanLimits.templates`

**Analog:** `PlanLimits.products` / `PlanLimits.storefrontEditor`, same file.

**The registry table + drift argument** (`plans.ts:134-186`):

```ts
/**
 * `Readonly<Record<PlanTier, …>>` rather than a lookup with a default: adding a
 * fourth tier becomes a compile error at every incomplete table in the
 * codebase, which is exactly the drift detection the tenant-model registry
 * provides. A default would turn the same change into a silent fallback.
 */
export const PLANS: Readonly<Record<PlanTier, PlanDefinition>> = {
  starter: { tier: "starter", monthlyPriceXaf: 5_000, recommended: false,
    limits: { members: 1, products: 50, editorSections: null,
              storefrontEditor: false, discountCodes: false, bulkImport: false } },
  ...
} as const;
```

**The "registered but enforced elsewhere" doc pattern for `templates`** — copy the shape of
`storefrontEditor`'s warning (`plans.ts:90-114`), which is the precedent for "this key is
documentation, not the gate":

```ts
  /**
   * Whether the tier includes the storefront editor at all (EDIT-03).
   *
   * ENFORCED FROM PHASE 4, but NEVER FROM THIS KEY DIRECTLY — see the warning
   * below.
   * ...
   * DO NOT READ THIS VALUE AT A CALL SITE, AND DO NOT GATE THE EDITOR WITH
   * `can(ctx, …)`.
   */
  readonly storefrontEditor: boolean;
```

→ `readonly templates: number | null;` (starter 10, business 25, professional `null`) documented
as the **catalog size the distinctiveness test asserts against**, never the gate. The gate is
`minTier` + `PLAN_TIER_RANK` in `access.ts`.

`PLAN_TIER_RANK` mirrors `INDUSTRY_SEGMENT_ICONS`'s `Readonly<Record<K, V>>` literal
(`registry.ts:508-516`).

---

### `src/server/theming/defaults.ts` (M) + `src/server/theming/templates/<segment>.ts` (NEW ×6)

**Analog:** `flagshipDefaultDocument()` / `flagshipDefaultTokens()` — every one of the 49 new
builders is this function with different data.

**The fresh-object rule (pinned by a mutation test — do not hoist)** (`defaults.ts:11-22`):

```ts
/**
 * ---------------------------------------------------------------------------
 * BOTH EXPORTS ARE FUNCTIONS. NEITHER IS A FROZEN MODULE-LEVEL CONSTANT.
 * ---------------------------------------------------------------------------
 * T-04-22. A shared literal is a literal one careless caller can mutate — and
 * the callers here are the tenant seed path and the storefront read-path
 * fallback, so a single `document.sections.reverse()` or
 * `settings.heading = …` upstream would corrupt every subsequent tenant created
 * in that process and every degraded read served from it. ...
 * `tests/unit/theming-registry.test.ts` pins it with a mutation test — do not
 * "optimise" either function into a hoisted constant.
 */
```

> `TEMPLATE_DEFAULTS` must therefore be `Readonly<Record<TemplateKey, () => PageDocument>>` — a
> record of **builders**, never a record of documents.

**The exact document literal to clone per template** (`defaults.ts:98-196`, abridged):

```ts
export function flagshipDefaultDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "hero",
        type: "hero",
        settings: {
          eyebrow: strings.flagship.hero.eyebrow,
          heading: strings.flagship.hero.heading,
          body: strings.flagship.hero.body,
          ctaLabel: strings.flagship.hero.ctaLabel,
          ctaHref: strings.flagship.hero.ctaHref,
          backgroundImageKey: null,
          overlayOpacity: DEFAULT_OVERLAY_OPACITY,
        },
      },
      {
        id: "trust-bar",
        type: "trust-bar",
        settings: {
          blocks: [
            { type: "trust-item", icon: "truck",
              heading: strings.flagship.trustBar.itemOne.heading,
              body: strings.flagship.trustBar.itemOne.body },
            /* ×3 — three items, not four */
          ],
        },
      },
      { id: "product-grid", type: "product-grid",
        settings: { heading: …, viewAllLabel: …, viewAllHref: …, itemCount: DEFAULT_ITEM_COUNT } },
      { id: "editorial-split", type: "editorial-split",
        settings: { eyebrow: …, heading: …, body: …, ctaLabel: …, ctaHref: …, imageKey: null } },
      { id: "contact", type: "contact",
        settings: { heading: …, body: …, ctaLabel: … } },
    ],
  };
}
```

**Three invariants every new builder inherits verbatim:**

1. **`id === type`** (`defaults.ts:89-96`) — "EACH SECTION'S `id` IS ITS OWN `type` STRING. That is
   not laziness. D-05 fixes membership at exactly one instance per type … a `randomUUID()` here
   would … break the fixture byte-identity `tests/setup/seed-two-tenants.ts` depends on."
2. **`backgroundImageKey: null` / `imageKey: null`** (`defaults.ts:111-118`) — "NULL IS THE DAY-ONE
   STATE, NOT A MISSING VALUE … There is no stock photograph to fall back to and there should not
   be one: a generic hero image on a Douala boutique is worse than no image." RESEARCH Finding 3
   makes this mandatory for all 50, not just the flagship.
3. **Zero inline prose** (`defaults.ts:35-37`) — "Every string below is a reference into
   `strings.flagship`. There is no inline prose in this file and there must not be one."

**Tokens builder** (`defaults.ts:217-224`) — the shape each of the 50 `templateDefaultTokens`
returns; note only two accents are stored, foregrounds are derived by `deriveThemeCssVars`:

```ts
export function flagshipDefaultTokens(): ThemeTokens {
  return {
    primaryAccent: DEFAULT_PRIMARY_ACCENT,
    secondaryAccent: DEFAULT_SECONDARY_ACCENT,
    announcementText: strings.flagship.announcement,
    footerTagline: strings.flagship.footerTagline,
  };
}
```

**`flagship-fashion` is frozen.** RESEARCH § Skeleton allocation: it keeps its key, its skeleton
and its default document byte-for-byte. Do not "improve" its copy while authoring the other 49 —
`tests/setup/seed-two-tenants.ts` and `theming-registry.test.ts:411-471` both depend on it.

---

### `src/lib/strings/templates/<segment>.ts` (NEW ×6)

**Analog:** `src/lib/strings.ts:1322-1375`, the `strings.flagship` namespace — copy its nesting
(`hero`/`trustBar.itemOne…Three`/`productGrid`/`editorialSplit`/`contact`), its comment register,
and its voice:

```ts
  flagship: {
    /** Theme chrome, not a section — renders on every storefront route. */
    announcement: "Order online. Pay by Mobile Money or on delivery.",

    hero: {
      eyebrow: "Welcome",
      heading: "New arrivals",
      body: "Everything we're selling right now, in one place.",
      /** The one accent-filled CTA above the fold. */
      ctaLabel: "Shop now",
      /** Home, because the product grid lives on `/` — no new routes. */
      ctaHref: "/",
    },

    /**
     * Three fixed items. The icon is a schema enum on the settings row
     * (`truck`, `message-circle`, `shield-check`), never copy — an icon name
     * in a copy catalogue is a string an i18n pass would try to translate.
     */
    trustBar: { itemOne: { heading: "Delivery in Douala", body: "We'll get your order to you." }, … },
```

**The move (Pitfall 7):** `src/lib/strings.ts` → `src/lib/strings/index.ts` must be a **verbatim**
move with zero content diff; `@/lib/strings` resolves identically so no call site changes.

---

### `src/app/s/[slug]/sections/section-renderer.tsx` (M) — add `variants`, keep the mechanism

**Analog:** the file's own current body. **Nothing about its shape changes** — it gains one prop.

**The mechanism that must survive** (`section-renderer.tsx:87-116`):

```tsx
export function SectionRenderer({
  section,
  data,
}: {
  readonly section: SectionInstance;
  readonly data: StorefrontRenderData;
}): ReactElement {
  switch (section.type) {
    case "hero":
      return <HeroSection settings={section.settings} data={data} />;

    case "trust-bar":
      return <TrustBarSection settings={section.settings} />;

    case "product-grid":
      return <ProductGridSection settings={section.settings} data={data} />;

    case "editorial-split":
      return <EditorialSplitSection settings={section.settings} data={data} />;

    case "contact":
      return <ContactSection settings={section.settings} data={data} />;
  }
}
```

**Three header rules that constrain the edit** (`section-renderer.tsx:15-54`, `:82-85`):

```
 * ONE `switch`, FIVE ARMS, NO `default` ARM, NO CAST. ADDING A SIXTH SECTION
 * TYPE MUST BE A COMPILE ERROR HERE.
 *
 * THE `: ReactElement` RETURN ANNOTATION IS THE MECHANISM AND MUST NOT BE
 * DELETED AS REDUNDANT.
 *
 * A keyed registry cannot be mapped over without a cast. ... an assertion is
 * precisely the check being given up. ... IF YOU FIND YOURSELF REACHING FOR AN
 * ASSERTION IN THIS FILE, THE UNION IS NOT NARROWING AND THE FIX IS UPSTREAM
 * IN THE SCHEMA — never a widened type here.
 *
 * Marker-free like every other file in this directory ... so a server-marked
 * dependency anywhere beneath it is an editor-route build failure (T-04-24).
```

**The one new discipline to write into the header** (RESEARCH Finding 2) — literal-key indexing:

```tsx
      variant={variants.hero}            // narrows to SectionVariant<"hero">
      variant={variants["trust-bar"]}    // narrows — literal key
      // NEVER variants[section.type] — a computed index widens to the union of
      // ALL variants and forces the exact cast this file exists to refuse.
```

**Note the `trust-bar` asymmetry stays** (`section-renderer.tsx:98-105`): it takes no `data`, and
the comment explaining why must not be dropped when the `variant` prop is threaded through.

---

### `src/app/s/[slug]/sections/hero-section.tsx` (M) + `hero-split.tsx` / `hero-stack.tsx` (NEW)

**Analog:** the current `HeroSection` body — it becomes `HeroFullBleed` unchanged, and
`HeroSection` becomes a 3-arm inner switch.

**Props shape to copy exactly** (`hero-section.tsx:91-103`):

```tsx
export function HeroSection({
  settings,
  data,
}: {
  /*
   * Narrowed OUT of the discriminated union rather than hand-written as a
   * seven-key interface. That is the entire reason `sectionInstanceSchema` is
   * a union: adding or renaming a hero setting becomes a compile error here,
   * where a duplicated interface would just drift silently.
   */
  readonly settings: Extract<SectionInstance, { type: "hero" }>["settings"];
  readonly data: StorefrontRenderData;
}) {
```

→ each variant component takes the same `Extract<…>` narrowing; `HeroSection` adds
`readonly variant: SectionVariant<"hero">` and returns `: ReactElement` with **no default arm**
(RESEARCH Pattern 2's anti-pattern note: not a `Record<Variant, Component>` lookup).

**Four design constraints every new variant inherits** (`hero-section.tsx:15-46`):

```
 * NO `"use client"`. THIS COMPONENT HOLDS NO STATE AND RUNS NO EFFECT.
 *   ... The single cross-boundary module it touches is
 *   `src/server/theming/schema.ts`, which plan 04-02 deliberately built
 *   marker-free (T-04-24).
 *
 * THE NO-IMAGE MODE IS A FIRST-CLASS STATE, NOT A FALLBACK.
 *   ... it is a zinc-100 band with the type re-inked onto the `--foreground`
 *   family and NO scrim, because a scrim over nothing is a grey rectangle.
 *   Treat both modes as designs. Do not let one rot.
 *
 * ACCENT BUDGET: THE CTA FILL AND NOTHING ELSE.
 *   ... Not the eyebrow, not the headline, not the scrim, not a border.
```

**Concrete no-image branch to copy** (`hero-section.tsx:104-116`, `:145-218`):

```tsx
  const hasImage = settings.backgroundImageKey !== null;

  <section className={cn("relative isolate flex min-h-[85svh] …", !hasImage && "bg-secondary")}>
    …
    <p className={cn("text-sm … uppercase", CASCADE, "delay-0",
                     hasImage ? "text-background/80" : "text-muted-foreground")}>
    <h1 className={cn("mt-4 text-[40px] leading-[1.05] font-semibold tracking-tighter md:text-[64px]",
                     CASCADE, "delay-200",
                     hasImage ? "text-background" : "text-foreground")}>
    <Link className={cn("mt-8 inline-flex min-h-12 … rounded-full px-8",
                     "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90",
                     "transition-colors duration-[var(--motion-quick)] ease-[var(--motion-ease)]",
                     CASCADE, "delay-[600ms]")}>
```

**The scrim's split-responsibility rule** (`hero-section.tsx:130-141`) — reproduce it in any
variant that has an image slot:

```tsx
          {/*
           * The scrim. A token utility supplies the COLOUR and a plain number
           * supplies the opacity (T-04-09) — so the only merchant-controlled
           * value that reaches a `style` attribute on this page is a number
           * clamped to 0…0.8 by `heroSettings` ... Never move the fill into `style`.
           */}
          <div aria-hidden="true" className="absolute inset-0 bg-foreground"
               style={{ opacity: settings.overlayOpacity }} />
```

**Typography ban to carry into every new variant** (`hero-section.tsx:160-173`): weight 700 is not
loaded; display presence is SIZE + `tracking-tighter` + 1.05 line-height.

`hero-stack` and `editorial-split:banner` are the two variants RESEARCH Pitfall 4 requires to have
**no image slot at all**.

The same treatment applies file-for-file to `trust-bar-section.tsx`, `product-grid-section.tsx`,
`editorial-split-section.tsx` and `contact-section.tsx` — read each file's current body as the
analog for its own variants; none of them has a different pattern.

---

### `src/server/theming/actions.ts` (M) — `switchTemplate`

**Analog:** `discardDraft` in the same file (`actions.ts:280-371`). It is the only existing action
that (a) takes an empty-ish payload, (b) overwrites the draft destructively, and (c) returns the
new `{ document, tokens }` so the open editor re-renders without a reload.

**The full shape to copy** (`actions.ts:282-371`, abridged):

```ts
type DiscardDraftData = {
  /**
   * What the draft now is. The editor holds its state in the browser (D-07), so
   * without this payload a discard would leave the open editor showing the
   * content it just threw away until a full reload.
   */
  document: PageDocument;
  tokens: ThemeTokens;
};

export const discardDraft = merchantAction<typeof discardDraftSchema, DiscardDraftData>({
  mode: "write",
  schema: discardDraftSchema,
  handler: async (ctx) => {
    assertCanEditStorefront(ctx, strings.editor.starterViewOnly);

    const db = scopedDb(ctx.tenantId);
    const draftUpdatedAt = new Date();

    const reverted = await db.$transaction(async (tx) => {
      const [page, theme] = await Promise.all([
        tx.storefrontPage.findUnique({
          where: { tenantId_pageType: { tenantId: ctx.tenantId, pageType: HOME_PAGE_TYPE } },
          select: { id: true, published: true },
        }),
        tx.storefrontTheme.findUnique({
          where: { tenantId: ctx.tenantId },
          select: { id: true, publishedTokens: true },
        }),
      ]);
      if (!page || !theme) throw new StorefrontNotSeededError(ctx.tenantId);
      …
      await tx.storefrontPage.update({ where: { id: page.id }, data: { draft: document, draftUpdatedAt } });
      await tx.storefrontTheme.update({ where: { tenantId: ctx.tenantId }, data: { draftTokens: tokens } });
      return { document, tokens };
    });

    revalidatePath("/dashboard/storefront-editor");
    return { ok: true as const, ...reverted };
  },
});
```

**The gate-first ordering + its rationale** (`actions.ts:124-133`):

```ts
    /*
     * EDIT-03 / D-13 / D-15, and it is the FIRST statement — before any database
     * call. ... Throws `EditorLockedError`, which extends `EntitlementError`, so
     * `merchantAction`'s existing catch arm turns it into a form-level message
     * with no change to that file.
     */
    assertCanEditStorefront(ctx, strings.editor.starterViewOnly);
```

→ `switchTemplate`'s first two statements: `assertCanEditStorefront`, then
`assertTemplateAccess(ctx, templateKey, strings.editor.templateTierLocked)` (Pitfall 6).

**The draft/published separation rule — the single most important line to copy**
(`actions.ts:156-168`):

```ts
      /*
       * `published` AND `publishedTokens` ARE LEFT BYTE-IDENTICAL. That is the
       * whole of D-08's draft/publish split: a merchant editing their store must
       * be able to make any change at all, including a broken one, without a
       * customer ever seeing it. Adding either column to the `data` objects below
       * would silently turn every keystroke into a deploy. ...
       *
       * `draftUpdatedAt` is set EXPLICITLY rather than left to `@updatedAt` ...
       */
```

→ `switchTemplate` writes `draft`, `draftTokens`, `draftTemplateKey`, `draftUpdatedAt`. Writing
`publishedTemplateKey` here is a silent publish.

**Schema shape** — narrow through the registry predicate, not a `z.enum` restating 50 keys, and
carry **no tenant field**. The precedent is `saveBrandingSchema` (`actions.ts:503-514`) plus its
header (`actions.ts:489-495`):

```ts
/**
 * Exactly five fields, and NO TENANT IDENTIFIER (T-04-04).
 *
 * A tenant field here is precisely the retargeting vector the whole
 * architecture exists to prevent: this action is reachable by a direct POST that
 * never rendered the form, so the schema IS the trust boundary.
 * ...
 * `industry` narrows through `isIndustrySegment` rather than a `z.enum`, so the
 * closed set lives in the registry (D-02) and this schema cannot drift from it.
 */
const saveBrandingSchema = z.object({
  businessName: z.string().trim().min(2).max(80),
  industry: z.string().refine(isIndustrySegment, "Not an industry segment."),
  logoKey: storageKeySchema.nullable(),
  primaryAccent: hexColorSchema,
  secondaryAccent: hexColorSchema,
});
```

**Accent/logo survival on switch (D-11)** — the composition already exists at `actions.ts:583-593`
and is exactly what `switchTemplate` reuses:

```ts
  const tokens = { ...flagshipDefaultTokens(), primaryAccent, secondaryAccent };
```

**`ensureStorefrontSeeded` stays untouched (Pitfall 8)** — its `update: {}` guarantee
(`actions.ts:399-416`) is the opposite intent to `switchTemplate`:

```ts
     * `upsert`, NOT `create`, and `update: {}` ON BOTH HALVES.
     * ... it NEVER CLOBBERS AN EXISTING MERCHANT'S WORK
```

---

### `src/server/theming/actions.ts` (M) — `publishStorefront` / `discardDraft` template columns

**Analog:** the same two handlers.

**Publish promotes inside the existing transaction** (`actions.ts:231-260`):

```ts
      /*
       * PARSE BEFORE PROMOTING — STRICT `parse`, NOT `safeParse`.
       * ... THE ASYMMETRY WITH `queries.ts` IS DELIBERATE AND MUST NOT BE "MADE
       * CONSISTENT". Strict here, lenient there, because the two failures land
       * on different people ...
       */
      const document = pageDocumentSchema.parse(page.draft);
      const tokens = themeTokensSchema.parse(theme.draftTokens);

      await tx.storefrontPage.update({ where: { id: page.id }, data: { published: document, publishedAt } });
      await tx.storefrontTheme.update({
        where: { tenantId: ctx.tenantId },
        data: { publishedTokens: tokens, publishedAt },
      });
```

→ add `publishedTemplateKey: theme.draftTemplateKey` to the theme `data` (and `draftTemplateKey`
to that `select`).

**Discard's flagship fallback becomes wrong (Pitfall 5)** — the lines to change are
`actions.ts:342-349`:

```ts
      const parsedDocument = pageDocumentSchema.safeParse(page.published);
      const parsedTokens = themeTokensSchema.safeParse(theme.publishedTokens);
      const document = parsedDocument.success ? parsedDocument.data : flagshipDefaultDocument();
      const tokens = parsedTokens.success ? parsedTokens.data : flagshipDefaultTokens();
```

→ `templateDefaultDocument(theme.publishedTemplateKey)` /
`templateDefaultTokens(theme.publishedTemplateKey)`, plus
`draftTemplateKey: theme.publishedTemplateKey` in the theme update. **Warning sign:**
`flagshipDefaultDocument` still appearing in `discardDraft` after the phase.

---

### `src/server/theming/queries.ts` (M) — read the right column on each path

**Analog:** the two functions in the file, which already differ exactly the way this change needs.

**Published read** (`queries.ts:119-158`) — add `publishedTemplateKey` to the `select`:

```ts
  const [page, theme] = await Promise.all([
    db.storefrontPage.findUnique({
      where: { tenantId_pageType: { tenantId, pageType: HOME_PAGE_TYPE } },
      select: { published: true },
    }),
    db.storefrontTheme.findUnique({
      where: { tenantId },
      select: { publishedTokens: true, logoKey: true },   // ← + publishedTemplateKey
    }),
  ]);
  …
  return {
    document: parsedDocument.success ? parsedDocument.data : flagshipDefaultDocument(),
    tokens: parsedTokens.success ? parsedTokens.data : flagshipDefaultTokens(),
    logoKey: theme?.logoKey ?? null,
  };
```

**Editor read** (`queries.ts:162-208`) — `templateKey` becomes `draftTemplateKey`:

```ts
export type EditorStorefront = {
  document: PageDocument;
  tokens: ThemeTokens;
  logoKey: string | null;
  templateKey: string;          // ← reads draftTemplateKey
  draftUpdatedAt: Date;
  publishedAt: Date | null;
};
…
    db.storefrontTheme.findUnique({
      where: { tenantId },
      select: { draftTokens: true, logoKey: true, templateKey: true },
    }),
```

**Degraded-read log discipline to reuse for an unrecognised template key** (`queries.ts:133-144`):

```ts
  /*
   * The log fires only when a row EXISTS and fails to parse. A missing row is
   * the expected pre-seed state described in the header — logging it would
   * print a line for every request to every legacy store and drown the case
   * that actually needs a human.
   */
  if (page?.published != null && !parsedDocument.success) {
    console.error(`EDIT-01 degraded: tenant ${tenantId} has an unparseable published document; falling back to flagship defaults.`);
  }
```

**Raw-timestamps rule (do not add a derived column)** — `queries.ts:185-193`: "an `isDirty` column
is derived state stored — a second source of truth that goes stale the first time a write path
forgets to set it." Applies directly to any temptation to store a `templateDirty` flag.

---

### `prisma/schema.prisma` (M) + the hand-edited migration

**Analog:** `StorefrontTheme`'s own `draftTokens`/`publishedTokens` pair, and the column's existing
doc comment (`schema.prisma:600-610`):

```prisma
  /// A key into `TEMPLATES` in `src/server/theming/registry.ts`. Never a
  /// foreign key to a Theme table: template *types* are code, exactly like
  /// `PLANS`, `IMAGE_PRESETS` and `ORDER_TRANSITIONS`.
  ///
  /// DELIBERATELY SEPARATE FROM `Organization.industry` (D-03). Industry is
  /// what the merchant said their business is; templateKey is what their
  /// storefront actually renders. Phase 5 ships real segment templates and
  /// MUST NOT auto-migrate anyone onto one ... Do not "simplify" this away.
  templateKey String @default("flagship-fashion")
```

→ split into `draftTemplateKey` / `publishedTemplateKey`; keep the whole comment, adding the
draft/published rationale (Finding 4).

**Migration SQL (Pitfall 1 — the DROP+ADD trap).** The generated diff must be replaced by hand
after `prisma migrate dev --create-only`:

```sql
ALTER TABLE "storefront_theme" RENAME COLUMN "templateKey" TO "publishedTemplateKey";
ALTER TABLE "storefront_theme" ADD COLUMN "draftTemplateKey" TEXT NOT NULL DEFAULT 'flagship-fashion';
UPDATE "storefront_theme" SET "draftTemplateKey" = "publishedTemplateKey";
```

Existing migrations (`prisma/migrations/20260902141926_storefront_theme_page_industry/`) are raw
DDL already, so hand-edited SQL is house style, not an exception. **Warning sign:** the generated
file contains `DROP COLUMN`.

---

### `src/components/theming/template-picker.tsx` (NEW)

**Analog:** the industry tile grid inside `branding-form.tsx:605-667` — same `RadioGroup`, same
grid rhythm, same selected-state classes, same whole-tile-is-the-tap-target trick.

```tsx
          <RadioGroup
            value={industry}
            onValueChange={(value: unknown) => {
              setValue("industry", String(value), { shouldValidate: true });
            }}
            aria-labelledby={industryLabelId}
            aria-describedby={industryHelperId}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3"
          >
            {segments.map((segment) => {
              const Icon = SEGMENT_ICONS[segment.icon] ?? Store;
              const selected = industry === segment.id;
              const tileLabelId = `${tilePrefix}-${segment.id}`;
              return (
                <div
                  key={segment.id}
                  className={
                    /*
                     * THE WHOLE TILE IS THE TAP TARGET. The radio itself is
                     * stretched over the tile at zero opacity rather than
                     * shrunk into a corner, so there is no 16px dot to hit on a
                     * phone — the border and ring below are what communicate
                     * the selection instead.
                     */
                    selected
                      ? "relative flex min-h-24 flex-col items-start gap-2 rounded-lg border border-primary bg-card p-4 text-left ring-2 ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
                      : "relative flex min-h-24 flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
                  }
                >
                  <RadioGroupItem
                    value={segment.id}
                    aria-labelledby={tileLabelId}
                    className="absolute inset-0 aspect-auto size-full rounded-lg border-0 bg-transparent opacity-0 after:hidden data-checked:bg-transparent"
                  />
                  <Icon aria-hidden="true" className="size-6 text-foreground" />
                  <Label id={tileLabelId} className="text-sm leading-normal font-medium text-foreground">
                    {segment.label}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
          {errors.industry ? (
            <p className="text-sm leading-normal text-destructive">{errors.industry.message}</p>
          ) : null}
```

Per 05-UI-SPEC § Grid and card: identical `border-primary ring-2 ring-primary` selected language,
`grid grid-cols-2 gap-4 sm:grid-cols-3`, `<TemplateThumbnail>` replacing `<Icon>`, plus a
tier-locked branch (`opacity-60`, `disabled`, `aria-disabled`, chip overlay).

**Card chrome** (`branding-form.tsx:606-614`) — the new Card 3 wrapper:

```tsx
      <Card className="rounded-lg border border-border bg-muted ring-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle id={industryLabelId}>{strings.branding.industryCardTitle}</CardTitle>
          <CardDescription id={industryHelperId}>{strings.branding.industryHelper}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
```

---

### `src/app/onboarding/branding/page.tsx` (M) — assemble `TemplateTile[]` server-side

**Analog:** the `SegmentTile[]` assembly in the same file (`page.tsx:105-118`) — the canonical
"registry is `server-only`, so the RSC flattens it to plain data" move:

```tsx
  /**
   * The six tiles, assembled HERE and handed down as plain data.
   *
   * `src/server/theming/registry.ts` carries `server-only`, so the island
   * cannot import it — and it stores an icon NAME rather than a component for
   * exactly that reason. The island maps the name to a lucide component at its
   * own boundary. Order comes from `INDUSTRY_SEGMENTS` itself rather than a
   * second ordering to keep in sync.
   */
  const segments: SegmentTile[] = INDUSTRY_SEGMENTS.map((id) => ({
    id,
    label: strings.branding.segments[id],
    icon: INDUSTRY_SEGMENT_ICONS[id],
  }));
```

→ `const templates: TemplateTile[] = accessibleTemplateKeys(tier).map(key => ({ key, name, segment, minTier, sections, primaryAccent }))`. `sections` is the plain
`{type, variant}[]` the thumbnail renders from; `primaryAccent` comes from
`templateDefaultTokens(key).primaryAccent`.

**The plan tier is already read here** (`page.tsx:82-90`) — no new query needed:

```tsx
  const organization = await platformDb.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, slug: true, planTier: true, industry: true },
  });
  if (!organization) redirect("/onboarding/create-store");
  if (organization.planTier === null) redirect("/onboarding/plan");
```

**Do not route this file through the DAL** (`page.tsx:29-52`): "A merchant who is ON this page has
a null industry BY DEFINITION … so calling the DAL here would redirect the page to itself,
forever." The audit is a grep for the wrapper's name — do not spell it in the new code either.

---

### `.../storefront-editor/section-list.tsx` (M) — the `Change template` rail row

**Analog:** the `Brand & logo` row directly above it (`section-list.tsx:233-246`) — copy it row for
row, swapping icon and handler:

```tsx
      <GroupHeader className="pt-4">{strings.editor.railThemeGroup}</GroupHeader>

      {/* `Brand & logo` — EDIT-02's "swap … colors" lives behind this row. */}
      <div className={rowShellClass(themeSelected)}>
        <button
          type="button"
          onClick={onSelectTheme}
          aria-current={themeSelected ? "true" : undefined}
          className="flex min-h-14 flex-1 items-center gap-3 px-4 text-left text-sm font-semibold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Palette aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{strings.editor.railThemeEntry}</span>
        </button>
      </div>
```

→ `<LayoutTemplate />` + `strings.editor.railChangeTemplateEntry` +
`onSelectChangeTemplate` / `changeTemplateSelected`, added to `SectionListProps`
(`section-list.tsx:190-195`) alongside `themeSelected` / `onSelectTheme`.

**The list itself stays closed** (`section-list.tsx:252-255`): "NO ADD CONTROL AND NO REMOVE
CONTROL … The list is exactly what the template declares; only the order is the merchant's."

---

### `.../storefront-editor/change-template-panel.tsx` (NEW) — the destructive confirm

**Analog:** `publish-bar.tsx:315-339`, the Discard dialog. Copy it exactly; only the strings and
the handler change:

```tsx
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{strings.editor.discardTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {strings.editor.discardBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {strings.editor.discardCancel}
            </AlertDialogCancel>
            {/* Destructive, because this one genuinely drops work. */}
            <AlertDialogAction
              variant="destructive"
              disabled={pending === "discard"}
              onClick={() => {
                void handleDiscard();
              }}
            >
              {strings.editor.discardConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

**Import block to copy** (`publish-bar.tsx:9-16`): `AlertDialog`, `AlertDialogAction`,
`AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`,
`AlertDialogHeader`, `AlertDialogTitle` from `@/components/ui/alert-dialog`.

**Disabled-when-locked pattern** (`publish-bar.tsx:300-311`) — `disabled={busy || !canEditStorefront}`
is the courtesy; the assert in the action is the control.

Per 05-UI-SPEC § Relationship to the existing PublishBar: this panel adds **no** save/publish
button and **no** status pill; after a switch the bar renders its existing
`hasUnpublishedChanges: true, dirty: false` branch.

---

### `.../storefront-editor/page.tsx` (M) — prop plumbing

**Analog:** the existing `<EditorShell>` call (`page.tsx:179-191`):

```tsx
      <EditorShell
        initialDocument={editor.document}
        initialTokens={editor.tokens}
        …
        themeFields={EDITABLE_THEME_FIELDS}
        themeMaxima={THEME_MAXIMA}
        imageBaseUrl={env.R2_PUBLIC_BASE_URL}
        previewUrl={`${storefrontUrl}/preview`}
        previewOrigin={storefrontUrl}
        storefrontUrl={storefrontUrl}
        canEditStorefront={ctx.canEditStorefront}
        draftUpdatedAt={editor.draftUpdatedAt.toISOString()}
        publishedAt={publishedAt}
```

→ add `initialVariants={variantsForTemplate(editor.templateKey)}`,
`templates={editorTemplateTiles}`, `currentTemplateKey={editor.templateKey}`.

**The boolean-vs-control rule this file already states** (`page.tsx:39-43`): "`canEditStorefront`
travels down from here to decide what the merchant READS, never what they may do. Nothing rendered
here is the control (T-04-05)." The same sentence applies to the tier-filtered template list.

---

### `src/app/s/[slug]/preview/preview-canvas.tsx` (M) — the fourth postMessage field

**Analog:** the existing step-3 parse in the same file (`preview-canvas.tsx:262-268`):

```tsx
      const parsedDocument = pageDocumentSchema.safeParse(
        (envelope as { document?: unknown }).document,
      );
      const parsedTokens = themeTokensSchema.safeParse(
        (envelope as { tokens?: unknown }).tokens,
      );
```

→ add `sectionVariantsSchema.safeParse((envelope as { variants?: unknown }).variants)`.

**The four ordered mitigations that must not be reordered** (`preview-canvas.tsx:52-58`,
`:221-227`):

```
 *   1. The origin comparison, FIRST, before the payload is touched at all.
 *   2. A shape check on the envelope — object, non-null, a known `type`.
 *   3. `safeParse` against the real schemas.
 *   4. Only then a state update.
 *
 * `event.data` is NOT read above this line and must never be.
```

**Independent-refusal posture** (`preview-canvas.tsx:256-261`): document and tokens are parsed
separately "because refusing both would make one bad section blank a merchant's whole preview" —
variants get the same treatment: a bad variant map falls back to the all-first map, it does not
blank the canvas.

**The preview route stays published-only** (RESEARCH Pattern 8 / `preview/page.tsx:51-59`): do not
teach it to read `draftTemplateKey`.

---

### `src/app/s/[slug]/page.tsx` (M) — pass variants at the map

**Analog:** the existing map (`page.tsx:166-183`):

```tsx
      {/*
       * The document's own order, not a hardcoded one (D-05). `SectionRenderer`
       * is the single type-to-component switch and is exhaustive by construction
       * — a sixth section type is a compile error there, never a silently blank
       * band here.
       *
       * `key={section.id}` is set at this call site because this is the map, and
       * it is the only place React needs it.
       */}
      {published.document.sections.map((section) => (
        <SectionRenderer key={section.id} section={section} data={data} />
      ))}
```

→ `variants={variants}`, resolved once above via
`variantsForTemplate(published.publishedTemplateKey)` — this file is an RSC, so importing the
`server-only` registry here is correct.

---

### `tests/unit/template-distinctiveness.test.ts` (NEW) + `theming-registry.test.ts` (M)

**Analog:** `tests/unit/theming-registry.test.ts` — inherit its non-vacuity idiom and its failure
messages that name the fix *and* the wrong fix.

**Mutation test to generalize from 1 to 50** (`theming-registry.test.ts:411-440`):

```ts
  it("returns a fresh document on every call", () => {
    // T-04-22. The seed path and the storefront read-path fallback both call
    // this; a shared literal is one careless caller away from corrupting every
    // subsequent tenant in the process, silently and cross-tenant.
    const first = flagshipDefaultDocument();
    const second = flagshipDefaultDocument();

    expect(first).not.toBe(second);
    expect(first.sections).not.toBe(second.sections);

    first.sections.pop();
    (first.sections[0] as { id: string }).id = "mutated";

    expect(
      flagshipDefaultDocument().sections.length,
      "Mutating one flagshipDefaultDocument() result changed the next one. " +
        "The function is returning a shared object.\n" +
        "  FIX: build and return a fresh literal inside the function.\n" +
        "  WRONG FIX: do not hoist the literal to module scope and freeze it — " +
        "a frozen object fails silently in non-strict callers and still shares " +
        "nested arrays.",
    ).toBe(5);
```

**Registry↔builder drift assertion to generalize** (`theming-registry.test.ts:442-455`):

```ts
  it("builds the default document in the template's declared order", () => {
    expect(
      flagshipDefaultDocument().sections.map((section) => section.type),
      "flagshipDefaultDocument() and TEMPLATES['flagship-fashion'].sections " +
        "disagree about which sections a new storefront gets, or in what order.\n" +
        "  FIX: change both, deliberately, in one commit.",
    ).toEqual([...TEMPLATES["flagship-fashion"].sections]);
  });
```

**`id === type` assertion to generalize** (`theming-registry.test.ts:457-471`):

```ts
  it("uses each section's own type as its id", () => {
    const sections = flagshipDefaultDocument().sections;
    expect(
      sections.filter((section) => section.id !== section.type).map((s) => s.id),
      "A default section's id is not its own type string. ...",
    ).toEqual([]);
    expect(new Set(sections.map((s) => s.id)).size).toBe(sections.length);
  });
```

**Closed-set count assertion pattern** (`theming-registry.test.ts:475-478`):

```ts
  it("declares exactly the six segments, each with a label and an icon", () => {
    expect(INDUSTRY_SEGMENTS).toHaveLength(6);
    expect(new Set(INDUSTRY_SEGMENTS).size).toBe(6);
```

→ `expect(Object.keys(TEMPLATES)).toHaveLength(50)` **first**, before any loop (Pitfall 3), plus
the 8 distinctiveness rules from RESEARCH § Layer 1 including rule 8's positive control.

---

### `tests/unit/theming-marker-boundary.test.ts` (NEW)

**Analog:** `tests/unit/single-order-state-writer.test.ts` and `tests/unit/no-tenant-id-param.test.ts` —
the house source-scanning contract-test idiom, named after what it asserts rather than what it
touches (CLAUDE.md § Naming Patterns). It scans `src/app/s/[slug]/sections/**` and every
`"use client"` file for `from "@/server/theming/registry"` / `defaults` (Pitfall 2).

---

### `tests/isolation/template-switch.test.ts` (NEW)

**Analog:** `tests/isolation/storefront-editor.test.ts` — copy its header, its real-session harness
choice and its failure-reading instructions (`storefront-editor.test.ts:9-67`):

```ts
/**
 * These are `isolation` (not `unit`) tests for the reason the seed fixture's
 * own header names: `scopedDb`'s tenant guarantee is a DATABASE property, not a
 * stub property. ... A stub cannot fail the way the thing being guarded against
 * fails ...
 *
 * HOW THE ACTIONS ARE INVOKED: A REAL SESSION, NOT A MOCKED CONTEXT.
 * ... reuse the session-construction helper this repository already established
 * (`tests/isolation/plan-selection.test.ts`, inherited by `read-only.test.ts`
 * and `merchant-context.test.ts`) — rather than mocking `@/server/merchant/context`.
 * ... A mocked context would let this file assert that the gate refuses a
 * hand-written `canEditStorefront: false` — which proves the `if` statement
 * works, not that a post-trial Starter merchant is refused.
 *
 * Only `next/headers`, the rate limiters and `next/cache` are substituted.
 * BETTER AUTH AND PRISMA STAY THE REAL THING, AND NOTHING STUBS `scopedDb`.
 */
```

→ the D-12 tier case builds a **Starter tier with an ACTIVE trial** (so `canEditStorefront` is
`true` via D-15 and `canWrite` is `true`) and asserts `switchTemplate` still refuses a Professional
key. That combination is what proves the gate is not trial-elevated and cannot pass for the wrong
reason — the mirror image of the `storefront-editor.test.ts:57-62` construction.

---

## Shared Patterns

### 1. Module marker line — always line 1

**Source:** `defaults.ts:1`, `registry.ts:1`, `errors.ts:1`, `plans.ts:1`, `assert.ts:1` — `import "server-only";`.
`schema.ts:1` — `import { z } from "zod";` and **nothing else** (marker-free by design).

**Apply to:** every new file.

| New file | Marker |
|---|---|
| `src/server/theming/access.ts` | `import "server-only";` |
| `src/server/theming/templates/*.ts` | `import "server-only";` |
| `src/server/theming/schema.ts` additions | **none — do not add one** |
| `src/app/s/[slug]/sections/*` variants | **none — no `"use client"`, no `server-only`** |
| `src/components/theming/template-thumbnail.tsx` | `"use client"` only if it needs state; prefer none |
| `src/components/theming/template-picker.tsx` | `"use client"` |

`"use server"` and `import "server-only"` are mutually exclusive and go before any import
(CLAUDE.md § Import Organization). `actions.ts` is the `"use server"` module; `access.ts` is a
`server-only` helper module, not an action module.

### 2. The gated Server Action

**Source:** `src/server/theming/actions.ts:120-133`
**Apply to:** `switchTemplate`

```ts
export const saveDraft = merchantAction<typeof saveDraftSchema, SaveDraftData>({
  mode: "write",
  schema: saveDraftSchema,
  handler: async (ctx, { document, tokens }) => {
    assertCanEditStorefront(ctx, strings.editor.starterViewOnly);
```

Order is fixed: `merchantAction({mode:"write"})` refuses on `canWrite` → `assertCanEditStorefront`
→ `assertTemplateAccess` → any DB call. The named-generic requirement is documented at
`actions.ts:110-114`: "`R` appears only in the handler's return position, so TypeScript cannot
infer it from the config object — it has to be named."

### 3. Tenant scoping

**Source:** `actions.ts:135`, `:417`, `:624`
**Apply to:** `switchTemplate`, `saveBranding`

```ts
    const db = scopedDb(ctx.tenantId);
    …
    await scopedDb(ctx.tenantId).$transaction(async (tx) => { … });
```

No schema in this phase may carry a tenant field (`schema.ts:28-33`, `actions.ts:489-495`). On
`create` halves use `scopedCreateData<StorefrontThemeCreateInput>({ … })` (`actions.ts:410-415`).

### 4. Error classes

**Source:** `src/server/theming/errors.ts:40-52`
**Apply to:** `TemplateLockedError`

```ts
export class StorefrontNotSeededError extends Error {
  override readonly name = "StorefrontNotSeededError";
  /** The organization whose theme or page row is missing. */
  readonly tenantId: string;
  constructor(tenantId: string) { super(`…`); this.tenantId = tenantId; }
}
```

Structured field over message-parsing; `override readonly name` in this file (see the
per-file note above for why `assert.ts` differs).

### 5. Module header comments

**Source:** every file read for this map. The house form is: what the module is + the requirement/
decision IDs it satisfies + an ALL-CAPS section divider per load-bearing invariant + an explicit
"wrong fix" warning.

**Apply to:** all 20+ new files. Concretely, each new file must carry at least:
`registry.ts:426-448` (the permanent D-03 no-auto-migration block, restated where relevant),
`defaults.ts:11-22` (fresh-object rule), `schema.ts:3-13` (marker rule),
`section-renderer.tsx:15-34` (exhaustiveness rule).

### 6. UI copy

**Source:** CLAUDE.md § Project-Specific Rules + `defaults.ts:35-37` + `registry.ts:445-447`
**Apply to:** every `.tsx` and every `src/server/theming/templates/*.ts`

No user-facing string literal outside `@/lib/strings`. The `.tsx` prose scan
(`tests/unit/dashboard-nav.test.ts` and siblings) enforces it for components; `registry.ts`'s
header extends the same rule to `.ts` files under `src/server/**` that the scan cannot reach. All
~1,250 template strings go in `src/lib/strings/templates/<segment>.ts`.

### 7. Surface-token isolation (the four bans)

**Source:** `tests/unit/surface-token-isolation.test.ts` (bans 1 and 2 at `:222` and `:249`)
**Apply to:** `template-thumbnail.tsx`, `template-picker.tsx`, all 7 new section variants

- Dashboard surfaces (picker, editor panel, thumbnail chrome): blue/gold/slate, Outfit headings,
  0.75rem radius. Never `--brand-accent*`, never the zinc storefront palette.
- Storefront variants: zinc palette, `bg-brand-accent`/`text-brand-accent-foreground` for the CTA
  only (`hero-section.tsx:36-41` — "ACCENT BUDGET: THE CTA FILL AND NOTHING ELSE").
- The thumbnail's one accent block uses `style={{ backgroundColor: primaryAccent }}` sourced from
  the template's validated default tokens — never a Tailwind palette utility (ban 1) and never a
  literal colour in `.tsx` (ban 2).

### 8. Degrade-loudly-or-not-at-all

**Source:** `queries.ts:133-150`, `errors.ts:3-24`, `section-renderer.tsx:69-77`
**Apply to:** `variantsForTemplate()`, the preview variant parse, `discardDraft`'s fallback

The read path degrades to defaults with a `console.error`; the write path throws. Never both, never
neither. `variantsForTemplate("unknown-key")` returns the all-first (flagship) map — a drifted
column renders the Phase 4 design, never nothing.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/theming/template-thumbnail.tsx` | presentational component | transform | No CSS/SVG wireframe component exists anywhere in the repo. Nearest guidance is 05-UI-SPEC § Template Thumbnail Component (per-variant block shapes, `aspect-[3/4] rounded-md border border-border bg-background overflow-hidden`, min-width 140px) plus Shared Pattern 7's token bans. Build from the spec; borrow only the token discipline from `src/app/s/[slug]/sections/*`. |
| `src/lib/strings/index.ts` (the directory split) | copy catalogue | — | First module-directory split in this codebase. It is a **pure rename** — Pitfall 7's warning sign is a move commit that shows content changes. No analog needed; verify with `git mv` + a zero-diff check. |
| Distinctiveness contact sheet generator | tooling / script | batch | No screenshot-harness precedent exists (`scripts/` holds only `prisma-generate.mjs`). 05-UI-SPEC § Distinctiveness Gate Contact Sheet explicitly leaves the mechanism to the planner, with two hard constraints: no new public route, and no new npm package without the Package Legitimacy Gate. |
| `src/server/theming/access.ts` — `accessibleTemplateKeys(tier)` | query helper | transform | *Partial.* The `can`/`assert` pair has an exact analog; the **list-returning** helper does not — nothing in `entitlements/` returns a filtered set. Model it on `productLimitFor`'s fail-closed posture (`plans.ts:238-245`): an unrecognised tier resolves to the **Starter** set, never to all 50. |

---

## Metadata

**Analog search scope:** `src/server/theming/**`, `src/server/entitlements/**`,
`src/app/s/[slug]/**`, `src/app/(dashboard)/dashboard/storefront-editor/**`,
`src/app/onboarding/**`, `src/components/ui/**`, `src/lib/strings.ts`, `prisma/schema.prisma`,
`prisma/migrations/**`, `tests/unit/**`, `tests/isolation/**`

**Files scanned:** 108 enumerated, 17 read for excerpts
**Pattern extraction date:** 2026-09-04
**Upstream inputs:** `05-CONTEXT.md` (D-01…D-14), `05-RESEARCH.md` (Findings 1-6, Patterns 1-8,
Pitfalls 1-8, § Validation Architecture), `05-UI-SPEC.md` (§ variant contracts, picker, editor
action, thumbnail), `04-PATTERNS.md` (Shared Patterns 1-7, re-verified against HEAD)
