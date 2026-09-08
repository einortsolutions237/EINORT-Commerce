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
 * Plan 05.1-08 populated the manifest with exactly FOUR calibration entries
 * — a deliberate subset chosen for maximum template variety, not the full
 * 50-template run. Plan 05.1-09 then ran the full 50-template generation and
 * ADDS completeness as a build-time contract: every `TEMPLATE_KEYS` member
 * must have a manifest entry, and a missing one now fails this test (and
 * therefore the build), not a silent fallback. `<TemplateThumbnail>` (the
 * D-05 CSS-wireframe fallback) still exists in the picker component for a
 * runtime state this build-time contract does not cover — e.g. a future key
 * added to `TEMPLATE_KEYS` before regeneration has been re-run for it. The
 * fallback is a runtime safety net; this test is a build-time contract. Both
 * are correct, and neither makes the other redundant.
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

/**
 * Plan 05.1-09's completeness check. Returns every `TEMPLATE_KEYS` member
 * that has no entry in `manifest`, by name — a set difference in the
 * "missing" direction. (The other direction — an extraneous key not in
 * `TEMPLATE_KEYS` — is already covered by `previewManifestErrors` above; this
 * function is deliberately narrow so its one job, naming what is absent, is
 * easy to verify in isolation.)
 *
 * Named keys, not a bare count, on purpose: a length-only comparison cannot
 * distinguish "one real key is missing" from "one real key is missing AND a
 * bogus extra key is present," which would coincidentally balance the count
 * while being just as broken.
 */
function missingPreviewKeys(manifest: Record<string, unknown>): TemplateKey[] {
  const present = new Set(Object.keys(manifest));
  return TEMPLATE_KEYS.filter((key) => !present.has(key));
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

describe("missingPreviewKeys — completeness predicate self-check (anti-vacuity)", () => {
  it("TEMPLATE_KEYS still has all 50 entries, so a completeness check below covers real ground", () => {
    // Guards this describe block the same way the top-level anti-vacuity
    // check guards `previewManifestErrors` — a set difference computed
    // against an empty or truncated `TEMPLATE_KEYS` could report "nothing
    // missing" for a reason that has nothing to do with actual coverage.
    expect(TEMPLATE_KEYS.length).toBe(50);
  });

  it("(positive control) reports a synthetic manifest missing one real TemplateKey as incomplete, naming it", () => {
    const missingKey: TemplateKey = "grocery-fresh";
    const almostComplete: Record<string, TemplatePreview> = {};
    for (const key of TEMPLATE_KEYS) {
      if (key === missingKey) continue;
      almostComplete[key] = fixtureEntry();
    }
    const missing = missingPreviewKeys(almostComplete);
    expect(missing).toEqual([missingKey]);
  });

  it("(negative control) reports nothing missing for a fixture that already has all 50 keys", () => {
    const complete: Record<string, TemplatePreview> = {};
    for (const key of TEMPLATE_KEYS) {
      complete[key] = fixtureEntry();
    }
    expect(missingPreviewKeys(complete)).toEqual([]);
  });
});

describe("TEMPLATE_PREVIEWS — the real, committed manifest", () => {
  it("reports no errors for the real manifest", () => {
    expect(previewManifestErrors(TEMPLATE_PREVIEWS)).toEqual([]);
  });

  it("TEMPLATE_PREVIEWS is non-empty (anti-vacuity for every check below)", () => {
    expect(
      Object.keys(TEMPLATE_PREVIEWS).length,
      "TEMPLATE_PREVIEWS is empty — run `npm run templates:previews` to generate it.",
    ).toBeGreaterThan(0);
  });

  it("has all 50 TEMPLATE_KEYS entries, in TEMPLATE_KEYS order — the completeness gate plan 05.1-09 adds", () => {
    // Plan 05.1-08 populated exactly four calibration entries; plan 05.1-09
    // ran the full 50-template generation and promotes the guard from "valid
    // if present" to "must be complete". A missing preview is now a build
    // failure (this assertion), not a silent fallback to the wireframe.
    //
    // D-05's `<TemplateThumbnail>` fallback still exists in the component for
    // a partial-generation runtime state (e.g. a future template key added to
    // `TEMPLATE_KEYS` before its preview has been generated). That fallback
    // is a runtime safety net; this test is a build-time contract. Both are
    // correct, and neither makes the other redundant — the fallback covers a
    // state this test refuses to let the committed manifest be in.
    const missing = missingPreviewKeys(TEMPLATE_PREVIEWS);
    expect(
      missing,
      missing.length > 0
        ? `Missing preview(s) for: ${missing.join(", ")}. Run \`npm run templates:previews -- --only=${missing.join(",")}\` to generate them.`
        : undefined,
    ).toEqual([]);
    expect(Object.keys(TEMPLATE_PREVIEWS)).toEqual(TEMPLATE_KEYS);
  });

  it("every entry's long edge is exactly 800px and every entry has non-zero bytes", () => {
    for (const [key, entry] of Object.entries(TEMPLATE_PREVIEWS)) {
      expect(Math.max(entry!.width, entry!.height), `${key}: expected long edge 800`).toBe(800);
      expect(entry!.bytes, `${key}: expected bytes > 0`).toBeGreaterThan(0);
    }
  });

  it("every entry's generatedAt parses as a valid ISO-8601 date", () => {
    for (const [key, entry] of Object.entries(TEMPLATE_PREVIEWS)) {
      const parsed = new Date(entry!.generatedAt);
      expect(
        Number.isNaN(parsed.getTime()),
        `${key}: generatedAt "${entry!.generatedAt}" did not parse as a valid date`,
      ).toBe(false);
    }
  });
});
