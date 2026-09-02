import { describe, expect, it } from "vitest";

import { strings } from "@/lib/strings";
import {
  flagshipDefaultDocument,
  flagshipDefaultTokens,
} from "@/server/theming/defaults";
import {
  FIELD_KINDS,
  INDUSTRY_SEGMENTS,
  INDUSTRY_SEGMENT_ICONS,
  SECTION_TYPES,
  TEMPLATES,
  THEME_FIELDS,
  THEME_NON_TOKEN_FIELD,
  isIndustrySegment,
} from "@/server/theming/registry";
import {
  pageDocumentSchema,
  sectionInstanceSchema,
  themeTokensSchema,
} from "@/server/theming/schema";

/**
 * EDIT-01's registry/schema drift guard (T-04-12).
 *
 * `src/server/theming/schema.ts` says what a stored document MAY contain.
 * `src/server/theming/registry.ts` says how a human EDITS it. Those are two
 * lists of the same field names in two files, and nothing in the type system
 * makes them agree — `FieldDescriptor.key` is a `string`, because a descriptor
 * list has to be declarable per section type without a generic that TypeScript
 * cannot infer through a `Record`.
 *
 * So drift is invisible until a merchant opens the settings panel. Both
 * directions are real failures and neither throws at build time:
 *
 *   - A schema key with NO descriptor is a setting the merchant can never
 *     reach. It is not broken, it is not logged, and it is not discovered — the
 *     field simply is not on the panel, forever.
 *   - A descriptor with NO schema key is worse: the panel renders the control,
 *     the merchant types into it, and the save throws a Zod error on a field
 *     they were invited to edit.
 *
 * This is the theming-side twin of `tests/isolation/model-registry-drift.test.ts`
 * and it runs in the `unit` project — no database, no network. `server-only` is
 * aliased to an empty module by `vitest.config.ts`, which is what lets these
 * `src/server/**` modules be imported here at all.
 *
 * IT MUST NOT PASS VACUOUSLY. The comparisons below are set differences, and a
 * set difference against an EMPTY introspected shape reports "no drift" with
 * total confidence and zero coverage. Zod's internals are the fragile part: if
 * a future Zod release moves `.options`, `.shape` or `.element`, the helper
 * would silently return nothing and every assertion here would pass over air.
 * The first two tests exist for exactly that, in the idiom of
 * `tests/unit/single-order-state-writer.test.ts` lines 168-195.
 */

// ---------------------------------------------------------------------------
// Introspection — done ONCE, then asserted non-empty before anything reads it
// ---------------------------------------------------------------------------

/**
 * `trust-bar` is THE ONE REPEATABLE SECTION (D-06, 04-PATTERNS.md Pattern 9).
 *
 * Its Zod settings shape is `{ blocks }` — a single array key — while its
 * registry descriptors are the PER-ITEM fields (`icon`, `heading`, `body`),
 * because the settings panel repeats them once per block. Comparing descriptors
 * against `{ blocks }` would therefore report three phantom orphans and one
 * phantom missing descriptor.
 *
 * The exception is encoded here by name rather than left implicit, so a reader
 * tempted to "simplify" `shapeKeysFor` into a plain `Object.keys(settings.shape)`
 * finds out why it is not one. If a second repeatable section is ever added,
 * this becomes a lookup driven by the registry's own `repeatable` marker — it
 * does not become a special case in the comparison.
 */
const REPEATABLE_SECTION = "trust-bar";

/**
 * The block discriminant is not an editable field: `type: z.literal("trust-item")`
 * is a value the schema fixes, not a choice the merchant makes. It is excluded
 * from the comparison rather than given a descriptor, because a select with one
 * option is a control that does nothing.
 */
const BLOCK_DISCRIMINANT = "type";

/** Minimal structural views of the Zod 4 internals this file reads. */
interface ZodObjectLike {
  readonly shape: Record<string, unknown>;
}
interface ZodArrayLike {
  readonly element: ZodObjectLike;
}
interface ZodLiteralLike {
  readonly value: unknown;
}

/**
 * Every section type's EDITABLE settings keys, read out of the discriminated
 * union.
 *
 * Zod 4 exposes `.options` on a discriminated union and `.shape` on an object,
 * which is what makes this possible without a parallel hand-written list — and
 * a parallel list is precisely what this file exists to abolish, so introspection
 * is the only honest implementation.
 *
 * For the repeatable section the keys come from ONE `blocks[]` item, minus the
 * discriminant. See `REPEATABLE_SECTION` above.
 */
function introspectSettingsShapes(): Map<string, ReadonlySet<string>> {
  const options = (
    sectionInstanceSchema as unknown as { options: readonly ZodObjectLike[] }
  ).options;

  const shapes = new Map<string, ReadonlySet<string>>();

  for (const option of options) {
    const type = (option.shape.type as ZodLiteralLike).value as string;
    const settings = option.shape.settings as ZodObjectLike;

    if (type === REPEATABLE_SECTION) {
      const item = (settings.shape.blocks as unknown as ZodArrayLike).element;
      shapes.set(
        type,
        new Set(
          Object.keys(item.shape).filter((key) => key !== BLOCK_DISCRIMINANT),
        ),
      );
      continue;
    }

    shapes.set(type, new Set(Object.keys(settings.shape)));
  }

  return shapes;
}

const settingsShapes = introspectSettingsShapes();

const themeTokenKeys = new Set(
  Object.keys((themeTokensSchema as unknown as ZodObjectLike).shape),
);

/**
 * The comparison the whole file rests on: what is on the left and not the
 * right.
 *
 * Extracted as a named function so the positive control below can prove it
 * still reports a difference. A comparison inlined five times is a comparison
 * that cannot be tested.
 */
function missingFrom(
  expected: Iterable<string>,
  actual: ReadonlySet<string>,
): string[] {
  return [...expected].filter((key) => !actual.has(key)).sort();
}

/** The fix/wrong-fix half of every drift failure message below. */
const DRIFT_REMEDY =
  "\n  FIX: add the missing half — a descriptor in " +
  "src/server/theming/registry.ts, or the key in " +
  "src/server/theming/schema.ts.\n" +
  "  WRONG FIX: do not delete the field to make this pass, and do not loosen " +
  "pageDocumentSchema to z.record(). The literal `version: 1` and the closed " +
  "shapes are what let the storefront read path degrade safely instead of " +
  "rendering a misread document (T-04-12).";

// ---------------------------------------------------------------------------

describe("theming registry / schema drift", () => {
  // -- non-vacuity controls, before anything below is trusted ---------------

  it("actually introspected the section union", () => {
    expect(
      settingsShapes.size,
      "Zod introspection returned no section shapes. Every comparison in this " +
        "file is a set difference, so an empty map makes all of them pass " +
        "while checking nothing — the one failure mode a contract test must " +
        "not have.\n" +
        "  Most likely cause: a Zod upgrade moved `.options` / `.shape` / " +
        "`.element`. Fix introspectSettingsShapes(), do not delete this test.",
    ).toBe(5);

    for (const [type, keys] of settingsShapes) {
      expect(
        keys.size,
        `Section type "${type}" introspected to zero settings keys, so its ` +
          "comparison below is vacuous.",
      ).toBeGreaterThan(0);
    }

    expect(
      themeTokenKeys.size,
      "themeTokensSchema introspected to zero keys — the THEME_FIELDS " +
        "comparison below would pass over nothing.",
    ).toBeGreaterThan(0);
  });

  it("still reports a difference when the two sides disagree", () => {
    // The positive control for `missingFrom`. If the comparison helper ever
    // stops reporting a mismatch, every real assertion in this file is passing
    // because it can no longer fail — not because the registry is correct.
    expect(
      missingFrom(["heading", "eyebrow"], new Set(["heading"])),
      "missingFrom() did not report a key that is genuinely absent. The " +
        "comparison helper has broken and every drift assertion below is now " +
        "vacuous.",
    ).toEqual(["eyebrow"]);

    expect(
      missingFrom(["heading"], new Set(["heading"])),
      "missingFrom() reported a difference where there is none — the helper " +
        "over-reports and the failures below would be noise.",
    ).toEqual([]);
  });

  // -- union <-> registry membership ----------------------------------------

  it("has a SECTION_TYPES entry for every type in the union", () => {
    expect(
      missingFrom(settingsShapes.keys(), new Set(Object.keys(SECTION_TYPES))),
      "A section type exists in the Zod discriminated union with no " +
        "SECTION_TYPES entry.\n" +
        "  The type is storable and renderable but has no editor entry, so the " +
        "merchant gets a section they cannot configure at all." +
        DRIFT_REMEDY,
    ).toEqual([]);
  });

  it("has no SECTION_TYPES entry that is not a real section type", () => {
    expect(
      missingFrom(Object.keys(SECTION_TYPES), new Set(settingsShapes.keys())),
      "SECTION_TYPES carries an entry for a type the Zod union does not " +
        "define.\n" +
        "  An orphan entry renders a rail row for a section that can never " +
        "appear in a document — and D-05 refuses the type at all three parse " +
        "doors." +
        DRIFT_REMEDY,
    ).toEqual([]);
  });

  // -- field descriptors <-> settings keys, in BOTH directions --------------

  it("has a schema key behind every field descriptor", () => {
    for (const [type, shape] of settingsShapes) {
      const entry = SECTION_TYPES[type as keyof typeof SECTION_TYPES];
      const descriptorKeys = entry.fields.map((field) => field.key);

      expect(
        missingFrom(descriptorKeys, shape),
        `Section "${type}" declares a field descriptor with no matching key ` +
          "in its Zod settings shape.\n" +
          "  The panel renders the control, the merchant types into it, and " +
          "the save throws a Zod error on a field they were invited to edit." +
          DRIFT_REMEDY,
      ).toEqual([]);
    }
  });

  it("has a field descriptor for every schema key", () => {
    for (const [type, shape] of settingsShapes) {
      const entry = SECTION_TYPES[type as keyof typeof SECTION_TYPES];
      const descriptorKeys = new Set(entry.fields.map((field) => field.key));

      expect(
        missingFrom(shape, descriptorKeys),
        `Section "${type}" has a settings key with no field descriptor.\n` +
          "  This is the exact failure this guard exists for: the field is " +
          "stored, validated and rendered, but it is not on the settings " +
          "panel — so it is silently uneditable, forever, with nothing " +
          "logged and nothing broken." +
          DRIFT_REMEDY,
      ).toEqual([]);
    }
  });

  it("declares the repeatable marker on the one repeatable section", () => {
    // Pins the D-06 exception the introspection above depends on. Without this,
    // dropping `repeatable` from trust-bar would leave `introspectSettingsShapes`
    // comparing per-item descriptors against `{ blocks }` with no test noticing
    // the model had changed.
    expect(
      SECTION_TYPES[REPEATABLE_SECTION].repeatable,
      `"${REPEATABLE_SECTION}" is the one repeatable section (D-06) and must ` +
        "say so, because its descriptors describe ONE blocks[] item rather " +
        "than the array. If this section stopped being repeatable, " +
        "introspectSettingsShapes() must change with it.",
    ).toBe("blocks");

    for (const [type, entry] of Object.entries(SECTION_TYPES)) {
      if (type === REPEATABLE_SECTION) continue;
      expect(
        entry.repeatable,
        `Section "${type}" declares a repeatable marker. D-06 fixes ` +
          `"${REPEATABLE_SECTION}" as the only repeatable section this phase; ` +
          "a second one needs introspectSettingsShapes() taught about it " +
          "first, or its descriptors are compared against the wrong shape.",
      ).toBeUndefined();
    }
  });

  // -- theme fields ----------------------------------------------------------

  it("has a themeTokensSchema key behind every THEME_FIELDS descriptor", () => {
    const allowed = new Set([...themeTokenKeys, THEME_NON_TOKEN_FIELD]);

    expect(
      missingFrom(
        THEME_FIELDS.map((field) => field.key),
        allowed,
      ),
      "THEME_FIELDS declares a field that is neither a themeTokensSchema key " +
        `nor the one sanctioned non-token field ("${THEME_NON_TOKEN_FIELD}", ` +
        "which is an organization column and deliberately NOT a theme token)." +
        DRIFT_REMEDY,
    ).toEqual([]);
  });

  it("has a THEME_FIELDS descriptor for every themeTokensSchema key", () => {
    expect(
      missingFrom(
        themeTokenKeys,
        new Set(THEME_FIELDS.map((field) => field.key)),
      ),
      "A theme token is stored and validated but has no descriptor, so the " +
        "merchant can never edit it from the Brand & logo panel." +
        DRIFT_REMEDY,
    ).toEqual([]);
  });

  // -- field kinds -----------------------------------------------------------

  it("uses only the six declared field kinds", () => {
    const kinds = new Set<string>(FIELD_KINDS);
    const offenders: string[] = [];

    for (const [type, entry] of Object.entries(SECTION_TYPES)) {
      for (const field of entry.fields) {
        if (!kinds.has(field.kind)) {
          offenders.push(`${type}.${field.key} → "${field.kind}"`);
        }
      }
    }
    for (const field of THEME_FIELDS) {
      if (!kinds.has(field.kind)) {
        offenders.push(`theme.${field.key} → "${field.kind}"`);
      }
    }

    expect(
      offenders,
      "A field descriptor names a kind outside FIELD_KINDS.\n" +
        "  <FieldRenderer> switches on this value, so an unknown kind renders " +
        "nothing — a labelled field with no control under it.\n" +
        "  FIX: use one of the six, or add a seventh deliberately — which is a " +
        "contract change that goes through FIELD_KINDS, this test and " +
        "04-UI-SPEC.md's field-kind table together.\n" +
        "  WRONG FIX: do not widen FieldKind to `string`.",
    ).toEqual([]);
  });

  it("gives every select field at least two options", () => {
    const offenders: string[] = [];
    for (const [type, entry] of Object.entries(SECTION_TYPES)) {
      for (const field of entry.fields) {
        if (field.kind !== "select") continue;
        if ((field.options?.length ?? 0) < 2) {
          offenders.push(`${type}.${field.key}`);
        }
      }
    }

    expect(
      offenders,
      "A select field has fewer than two options — a control the merchant " +
        "cannot actually change. Options come from the registry descriptor " +
        "(04-UI-SPEC.md § The six field kinds); a single-option select means " +
        "the value belongs in the schema as a literal instead.",
    ).toEqual([]);
  });

  // -- the flagship defaults -------------------------------------------------

  it("produces a default document that parses", () => {
    const result = pageDocumentSchema.safeParse(flagshipDefaultDocument());

    expect(
      result.success ? [] : result.error.issues.map((issue) => issue.message),
      "flagshipDefaultDocument() does not satisfy pageDocumentSchema.\n" +
        "  This is the document every brand-new storefront is seeded with, so " +
        "a refused parse here is a merchant whose store cannot be created — " +
        "or, through the read-path fallback, one whose storefront degrades on " +
        "day one.",
    ).toEqual([]);
    expect(result.success).toBe(true);
  });

  it("produces default tokens that parse", () => {
    const result = themeTokensSchema.safeParse(flagshipDefaultTokens());

    expect(
      result.success ? [] : result.error.issues.map((issue) => issue.message),
      "flagshipDefaultTokens() does not satisfy themeTokensSchema. Both " +
        "accents go through hexColorSchema, which is a security control " +
        "(the value is written into a CSS custom property unsanitised).",
    ).toEqual([]);
    expect(result.success).toBe(true);
  });

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
    expect(flagshipDefaultDocument().sections[0].id).toBe("hero");

    const tokens = flagshipDefaultTokens();
    tokens.announcementText = "mutated";
    expect(flagshipDefaultTokens().announcementText).toBe(
      strings.flagship.announcement,
    );
  });

  it("builds the default document in the template's declared order", () => {
    expect(
      flagshipDefaultDocument().sections.map((section) => section.type),
      "flagshipDefaultDocument() and TEMPLATES['flagship-fashion'].sections " +
        "disagree about which sections a new storefront gets, or in what " +
        "order.\n" +
        "  The order is LOCKED and is not alphabetical: it encodes " +
        "04-UI-SPEC.md's background-treatment alternation (photo hero → washed " +
        "band → white grid → ink band → white contact) so no two adjacent " +
        "sections share a treatment. It is also the order the " +
        "Design-Distinctiveness Gate is judged against.\n" +
        "  FIX: change both, deliberately, in one commit.",
    ).toEqual([...TEMPLATES["flagship-fashion"].sections]);
  });

  it("uses each section's own type as its id", () => {
    // D-05 fixes membership at one instance per type, so the type IS a stable
    // unique id — and the seed fixtures depend on that being byte-identical.
    const sections = flagshipDefaultDocument().sections;

    expect(
      sections.filter((section) => section.id !== section.type).map((s) => s.id),
      "A default section's id is not its own type string. D-05 makes the type " +
        "a stable unique id; a random id would make every seeded document " +
        "differ from every other for no benefit and would break the fixture " +
        "byte-identity tests/setup/seed-two-tenants.ts depends on.",
    ).toEqual([]);

    expect(new Set(sections.map((s) => s.id)).size).toBe(sections.length);
  });

  // -- industry segments (D-02, T-04-21) -------------------------------------

  it("declares exactly the six segments, each with a label and an icon", () => {
    expect(INDUSTRY_SEGMENTS).toHaveLength(6);
    expect(new Set(INDUSTRY_SEGMENTS).size).toBe(6);

    expect(
      missingFrom(
        INDUSTRY_SEGMENTS,
        new Set(Object.keys(strings.branding.segments)),
      ),
      "A segment has no label in strings.branding.segments, so its onboarding " +
        "tile would render blank.\n" +
        "  The ids are keyed rather than positional precisely so this cannot " +
        "drift by reordering — add the label under the same id.",
    ).toEqual([]);

    expect(
      missingFrom(
        Object.keys(strings.branding.segments),
        new Set(INDUSTRY_SEGMENTS),
      ),
      "strings.branding.segments carries a label for an id that is not in " +
        "INDUSTRY_SEGMENTS — copy for a segment no merchant can pick.",
    ).toEqual([]);

    expect(
      missingFrom(
        INDUSTRY_SEGMENTS,
        new Set(Object.keys(INDUSTRY_SEGMENT_ICONS)),
      ),
      "A segment has no icon name in INDUSTRY_SEGMENT_ICONS.",
    ).toEqual([]);

    for (const segment of INDUSTRY_SEGMENTS) {
      expect(INDUSTRY_SEGMENT_ICONS[segment].length).toBeGreaterThan(0);
    }
  });

  it("narrows an untrusted industry value to the closed set", () => {
    // T-04-21. Organization.industry is a String? column: nothing at the type
    // level stops it holding a leftover from a bad backfill.
    for (const segment of INDUSTRY_SEGMENTS) {
      expect(
        isIndustrySegment(segment),
        `isIndustrySegment rejected "${segment}", which is a real segment.`,
      ).toBe(true);
    }

    for (const rejected of ["fashion", "", null, 42, undefined, {}, []]) {
      expect(
        isIndustrySegment(rejected),
        `isIndustrySegment accepted ${JSON.stringify(rejected)}.\n` +
          "  It must narrow like isPlanTier: a `typeof value === \"string\"` " +
          "guard plus a Set membership check, and nothing else. An unknown " +
          "value degrades to \"no segment selected\" (D-01) rather than being " +
          "trusted.",
      ).toBe(false);
    }
  });

  // -- templates (D-03) ------------------------------------------------------

  it("declares one template whose sections are all real section types", () => {
    expect(Object.keys(TEMPLATES)).toEqual(["flagship-fashion"]);

    expect(
      missingFrom(
        TEMPLATES["flagship-fashion"].sections,
        new Set(settingsShapes.keys()),
      ),
      "The flagship template lists a section type the Zod union does not " +
        "define, so seeding a new storefront would produce a document that " +
        "cannot parse.",
    ).toEqual([]);
  });
});
