import { describe, expect, it } from "vitest";

import { TEMPLATE_PREVIEWS, type TemplatePreview } from "@/server/theming/preview-manifest";
import { TEMPLATE_KEYS, type TemplateKey } from "@/server/theming/registry";

/**
 * TMPL-06 / 05.1 — the preview manifest's drift guard.
 *
 * `src/server/theming/preview-manifest.ts` is a GENERATED file
 * (`scripts/generate-template-previews.ts`, landing in plan 05.1-08). Nothing
 * at the type level stops that script — or a future hand-edit nobody should
 * make but somebody eventually will — from emitting a key that is not a real
 * `TemplateKey`, from emitting keys out of `TEMPLATE_KEYS` order (which would
 * make every regeneration diff noisy), or from emitting an entry missing one
 * of its four fields. This file is that guard.
 *
 * This runs in the `unit` project — no database, no network. `server-only` is
 * aliased to an empty module by `vitest.config.ts`, which is what lets these
 * `src/server/**` modules be imported here at all.
 *
 * IT MUST NOT PASS VACUOUSLY, in the spirit of
 * `tests/unit/theming-registry.test.ts` and
 * `tests/unit/single-order-state-writer.test.ts`. A predicate that always
 * returns "no errors" would make the real, committed manifest look clean for
 * a reason that has nothing to do with correctness. The positive-control
 * fixtures below exist so the predicate is observed saying "no" at least
 * once, and the negative-control fixture so it is observed saying "yes" at
 * least once — a guard nobody has watched fail is not a guard.
 *
 * The manifest is EMPTY at this point in the phase (05.1-02 lands before
 * generation runs in 05.1-08), so this file deliberately does NOT assert
 * "all 50 templates present" — that assertion lands in the same commit that
 * populates the manifest. Test 7 below states that explicitly so the
 * omission reads as sequencing, not oversight.
 */

/**
 * The real scan (test 1, on the committed `TEMPLATE_PREVIEWS`) and every
 * fixture control below all call this one function, so they are provably
 * exercising the same check rather than two checks that merely resemble
 * each other.
 */
function previewManifestErrors(manifest: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const keys = Object.keys(manifest);

  const knownKeys = keys.filter((key): key is TemplateKey =>
    (TEMPLATE_KEYS as readonly string[]).includes(key),
  );
  for (const key of keys) {
    if (!(TEMPLATE_KEYS as readonly string[]).includes(key)) {
      errors.push(`"${key}" is not a member of TEMPLATE_KEYS`);
    }
  }

  // Keys present in the manifest must appear in the same relative order they
  // hold in TEMPLATE_KEYS, so a regeneration diff stays stable. Only the
  // FIRST out-of-order key is named — mirrors how a diff tool reports the
  // first divergence, not every downstream consequence of it.
  const expectedOrder = TEMPLATE_KEYS.filter((key) => knownKeys.includes(key));
  for (let index = 0; index < knownKeys.length; index += 1) {
    if (knownKeys[index] !== expectedOrder[index]) {
      errors.push(
        `"${knownKeys[index]}" is out of TEMPLATE_KEYS order (expected "${expectedOrder[index]}" at this position)`,
      );
      break;
    }
  }

  for (const key of keys) {
    const entry = manifest[key];
    if (typeof entry !== "object" || entry === null) {
      errors.push(`"${key}" entry is not an object`);
      continue;
    }
    const record = entry as Record<string, unknown>;
    for (const field of ["width", "height", "bytes", "generatedAt"] as const) {
      if (!(field in record)) {
        errors.push(`"${key}" entry is missing "${field}"`);
      }
    }
    for (const numericField of ["width", "height", "bytes"] as const) {
      if (numericField in record && typeof record[numericField] !== "number") {
        errors.push(`"${key}" entry has a non-numeric "${numericField}"`);
      }
    }
    if ("generatedAt" in record && typeof record.generatedAt !== "string") {
      errors.push(`"${key}" entry has a non-string "generatedAt"`);
    }
  }

  return errors;
}

/**
 * A well-formed synthetic manifest entry, for building both the positive and
 * negative control fixtures below without repeating all four fields at every
 * call site.
 */
function fixtureEntry(overrides: Partial<TemplatePreview> = {}): TemplatePreview {
  return {
    width: 800,
    height: 500,
    bytes: 31204,
    generatedAt: "2026-09-07T00:00:00.000Z",
    ...overrides,
  };
}

describe("previewManifestErrors — anti-vacuity", () => {
  it("TEMPLATE_KEYS still has all 50 entries, so the checks below cover real ground", () => {
    // If this drifts to a smaller number, every "exhaustive" claim made by
    // the fixtures below silently covers less than it says it does.
    expect(TEMPLATE_KEYS.length).toBe(50);
  });

  it("the predicate itself distinguishes a bad fixture from a good one", () => {
    // A degenerate predicate that always returns [] would make every "invalid"
    // assertion below false-negative in the SAME way — this is the guard that
    // catches that particular failure mode before trusting any test that follows.
    const badFixture = { "not-a-template": fixtureEntry() };
    const goodFixture = { "flagship-fashion": fixtureEntry() };
    expect(previewManifestErrors(badFixture).length).toBeGreaterThan(0);
    expect(previewManifestErrors(goodFixture)).toEqual([]);
  });
});

describe("previewManifestErrors — positive controls (invalid fixtures)", () => {
  it("rejects a manifest containing a key that is not in TEMPLATE_KEYS", () => {
    const fixture = {
      "flagship-fashion": fixtureEntry(),
      "not-a-real-template": fixtureEntry(),
    };
    const errors = previewManifestErrors(fixture);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.includes("not-a-real-template"))).toBe(true);
  });

  it("rejects a manifest whose keys appear out of TEMPLATE_KEYS order, naming the first offender", () => {
    // TEMPLATE_KEYS order is flagship-fashion, fashion-classic, … — this
    // fixture reverses the first two.
    const fixture = {
      "fashion-classic": fixtureEntry(),
      "flagship-fashion": fixtureEntry(),
    };
    const errors = previewManifestErrors(fixture);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.includes("fashion-classic"))).toBe(true);
  });

  it("rejects a synthetic entry missing width, height, bytes or generatedAt", () => {
    const missingWidth = { "flagship-fashion": { height: 500, bytes: 31204, generatedAt: "x" } };
    const missingHeight = { "flagship-fashion": { width: 800, bytes: 31204, generatedAt: "x" } };
    const missingBytes = { "flagship-fashion": { width: 800, height: 500, generatedAt: "x" } };
    const missingGeneratedAt = { "flagship-fashion": { width: 800, height: 500, bytes: 31204 } };

    for (const badFixture of [missingWidth, missingHeight, missingBytes, missingGeneratedAt]) {
      expect(previewManifestErrors(badFixture).length).toBeGreaterThan(0);
    }
  });

  it("rejects a synthetic entry with a non-numeric bytes field", () => {
    const fixture = {
      "flagship-fashion": fixtureEntry({ bytes: "31204" as unknown as number }),
    };
    const errors = previewManifestErrors(fixture);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.includes("bytes"))).toBe(true);
  });
});

describe("previewManifestErrors — negative control (valid fixture)", () => {
  it("accepts two real TemplateKeys, in TEMPLATE_KEYS order, with well-formed entries", () => {
    // Proves the predicate can say yes as well as no — a check that only
    // ever rejects would pass every test above vacuously.
    const fixture = {
      "flagship-fashion": fixtureEntry({ width: 800, height: 500, bytes: 31204 }),
      "fashion-classic": fixtureEntry({ width: 800, height: 500, bytes: 28110 }),
    };
    expect(previewManifestErrors(fixture)).toEqual([]);
  });
});

describe("TEMPLATE_PREVIEWS — the real, committed manifest", () => {
  it("reports no errors for the real manifest", () => {
    expect(previewManifestErrors(TEMPLATE_PREVIEWS)).toEqual([]);
  });

  it("is empty at this point in the phase — every key present is a real TemplateKey", () => {
    // Generation (05.1-08) has not run yet, so TEMPLATE_PREVIEWS ships empty.
    // An empty manifest is explicitly VALID here: 05.1-08 is the plan that
    // replaces this assertion with an all-50-present completeness check once
    // generation has actually produced entries — the absence of that check
    // in THIS file is sequencing, not an oversight.
    expect(Object.keys(TEMPLATE_PREVIEWS)).toEqual([]);
    expect(
      Object.keys(TEMPLATE_PREVIEWS).every((key) =>
        (TEMPLATE_KEYS as readonly string[]).includes(key),
      ),
    ).toBe(true);
  });
});
