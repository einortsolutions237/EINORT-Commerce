import { describe, expect, it } from "vitest";

import { PLANS } from "@/server/entitlements/plans";
import { accessibleTemplateKeys } from "@/server/theming/access";
import {
  templateDefaultDocument,
  templateDefaultTokens,
} from "@/server/theming/defaults";
import {
  INDUSTRY_SEGMENTS,
  TEMPLATE_KEYS,
  TEMPLATES,
  type TemplateKey,
} from "@/server/theming/registry";
import type { SectionInstance } from "@/server/theming/schema";

/**
 * TMPL-05's automated Layer 1 — the eight distinctiveness rules that turn
 * "genericness is a failure condition" into a red build, plus the
 * six-closest-pairs ranking that makes plan 05-22's human adversarial-pair
 * test a construction rather than a guess.
 *
 * 50 templates is 1,225 unordered pairs. Nobody performs 1,225 side-by-side
 * comparisons, and a gate nobody performs is a gate that passes vacuously —
 * precisely the failure `theming-registry.test.ts` warns about at length for
 * one template (T-05-75). This file is that same discipline generalized to
 * the whole library rather than one row of it.
 *
 * IT MUST NOT PASS VACUOUSLY. Rule 4 pins the non-empty, exact-50 template
 * list BEFORE any rule below is trusted, and rule 8 is a positive control on
 * `collides()` itself, inherited from `theming-registry.test.ts` lines
 * 200-216 — without it a bug in `signatureOf` would make every other rule
 * pass while checking nothing.
 */

// ---------------------------------------------------------------------------
// The signature: the three distinctiveness axes, per template
// ---------------------------------------------------------------------------

interface TemplateSignature {
  /** The ordered `"{type}:{variant}"` join of the template's declared sections. */
  readonly structure: string;
  /** The default `primaryAccent`, lowercased. */
  readonly accent: string;
  /** The default hero's `eyebrow` + `heading`, joined — "" if the template has no hero. */
  readonly voice: string;
}

function signatureOf(key: TemplateKey): TemplateSignature {
  const structure = TEMPLATES[key].sections
    .map((ref) => `${ref.type}:${ref.variant}`)
    .join("|");

  const accent = templateDefaultTokens(key).primaryAccent.toLowerCase();

  const document = templateDefaultDocument(key);
  const hero = document.sections.find(
    (section): section is Extract<SectionInstance, { type: "hero" }> =>
      section.type === "hero",
  );
  const voice = hero
    ? `${hero.settings.eyebrow}··${hero.settings.heading}`
    : "";

  return { structure, accent, voice };
}

/**
 * The literal definition of "the same shop twice": two signatures collide
 * when they share BOTH structure and accent. Extracted as a named function so
 * rule 8 can prove it still reports a difference on a hand-built pair — a
 * comparison inlined five times is a comparison that cannot be tested,
 * exactly the idiom `theming-registry.test.ts`'s `missingFrom` follows.
 */
function collides(a: TemplateSignature, b: TemplateSignature): boolean {
  return a.structure === b.structure && a.accent === b.accent;
}

// ---------------------------------------------------------------------------
// Six-closest-pairs ranking (feeds plan 05-22's adversarial-pair sample)
// ---------------------------------------------------------------------------

/** `"#rrggbb"` -> `[r, g, b]`, 0-255 each. Assumes `hexColorSchema`-shaped input. */
function parseHexChannels(hex: string): readonly [number, number, number] {
  const body = hex.replace("#", "");
  return [
    parseInt(body.slice(0, 2), 16),
    parseInt(body.slice(2, 4), 16),
    parseInt(body.slice(4, 6), 16),
  ];
}

/** Sum of per-channel absolute differences — small is "visually close". */
function accentDistance(a: string, b: string): number {
  const [ar, ag, ab] = parseHexChannels(a);
  const [br, bg, bb] = parseHexChannels(b);
  return Math.abs(ar - br) + Math.abs(ag - bg) + Math.abs(ab - bb);
}

interface RankedPair {
  readonly a: TemplateKey;
  readonly b: TemplateKey;
  readonly sameStructure: boolean;
  readonly accentDistance: number;
}

/**
 * Ranks every unordered pair of templates: same `structure` first (the
 * hardest case — two templates built on the identical skeleton), then by
 * smallest `accent` distance across hex channels. The first N entries are the
 * library's N most-similar pairs BY CONSTRUCTION, not by sampling — which is
 * what makes sampling sound here (05-RESEARCH.md § The Distinctiveness Gate
 * at N=50).
 */
function rankClosestPairs(keys: readonly TemplateKey[]): RankedPair[] {
  const signatures = new Map(keys.map((key) => [key, signatureOf(key)] as const));
  const pairs: RankedPair[] = [];

  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      const a = keys[i];
      const b = keys[j];
      const sigA = signatures.get(a)!;
      const sigB = signatures.get(b)!;
      pairs.push({
        a,
        b,
        sameStructure: sigA.structure === sigB.structure,
        accentDistance: accentDistance(sigA.accent, sigB.accent),
      });
    }
  }

  pairs.sort((x, y) => {
    if (x.sameStructure !== y.sameStructure) {
      return x.sameStructure ? -1 : 1;
    }
    return x.accentDistance - y.accentDistance;
  });

  return pairs;
}

const SIX_CLOSEST_PAIRS_COUNT = 6;

// ---------------------------------------------------------------------------

describe("template distinctiveness (TMPL-05)", () => {
  // -- non-vacuity first, before any rule below trusts the template list -----

  it("declares exactly 50 templates before any distinctiveness rule runs", () => {
    // Rule 4. Every rule below iterates TEMPLATE_KEYS or Object.keys(TEMPLATES),
    // so a short or empty list would make all of them pass while checking
    // almost nothing (Pitfall 3, 05-RESEARCH.md) — the same non-vacuity
    // discipline `theming-registry.test.ts` applies to its own 50-count check.
    expect(TEMPLATE_KEYS.length).toBe(50);
    expect(new Set(TEMPLATE_KEYS).size).toBe(50);
    expect(Object.keys(TEMPLATES).length).toBe(50);
    expect(new Set(Object.keys(TEMPLATES)).size).toBe(50);
  });

  // -- rule 8: positive control on the comparison helper itself --------------

  it("still reports a collision on a hand-built pair (non-vacuity control)", () => {
    // Inherited from theming-registry.test.ts lines 200-216. If `collides()`
    // ever stops reporting a genuine collision, every rule below it is passing
    // because it can no longer fail — not because the library is distinct.
    const colliding: TemplateSignature = {
      structure: "hero:full-bleed|product-grid:grid",
      accent: "#336699",
      voice: "irrelevant to this check··still irrelevant",
    };
    const sameSignatureDifferentVoice: TemplateSignature = {
      ...colliding,
      voice: "a completely different voice··that changes nothing",
    };
    const differentAccent: TemplateSignature = {
      ...colliding,
      accent: "#996633",
    };
    const differentStructure: TemplateSignature = {
      ...colliding,
      structure: "hero:split|product-grid:dense",
    };

    expect(
      collides(colliding, sameSignatureDifferentVoice),
      "collides() did not report two signatures sharing structure and accent " +
        "as colliding. `voice` is not part of the collision definition, so a " +
        "difference there must not hide a real one.",
    ).toBe(true);

    expect(
      collides(colliding, differentAccent),
      "collides() reported a collision where the accent differs — the helper " +
        "over-reports and every rule 1 failure below would be noise.",
    ).toBe(false);

    expect(
      collides(colliding, differentStructure),
      "collides() reported a collision where the structure differs — the " +
        "helper over-reports and every rule 1 failure below would be noise.",
    ).toBe(false);
  });

  // -- rule 1 ------------------------------------------------------------------

  it("has no two templates that are the same shop twice", () => {
    const seen = new Map<string, TemplateKey>();
    const collisions: string[] = [];

    for (const key of TEMPLATE_KEYS) {
      const signature = signatureOf(key);
      const id = `${signature.structure}##${signature.accent}`;
      const prior = seen.get(id);
      if (prior && collides(signatureOf(prior), signature)) {
        collisions.push(`${prior} ≡ ${key}`);
      } else {
        seen.set(id, key);
      }
    }

    expect(
      collisions,
      "Two templates share BOTH their structure and their accent — they are " +
        "the same design twice and will fail TMPL-05's stranger test by " +
        "construction.\n" +
        "  FIX: change one template's variant assignment or its accent pair.\n" +
        "  WRONG FIX: do not relax this check. Genericness is the failure " +
        "condition this whole file exists to catch.",
    ).toEqual([]);
  });

  // -- rule 2 ------------------------------------------------------------------

  it("caps sibling count at 2 templates per structure", () => {
    const byStructure = new Map<string, TemplateKey[]>();
    for (const key of TEMPLATE_KEYS) {
      const { structure } = signatureOf(key);
      const siblings = byStructure.get(structure) ?? [];
      siblings.push(key);
      byStructure.set(structure, siblings);
    }

    const offenders = [...byStructure.entries()]
      .filter(([, keys]) => keys.length > 2)
      .map(([structure, keys]) => `"${structure}" -> ${keys.join(", ")}`);

    expect(
      offenders,
      "A structure is shared by more than 2 templates. \"25 skeletons\" is " +
        "meant to be a TESTED claim, not just a plan — at 3+ siblings per " +
        "skeleton with no imagery, two of them read as the same shop in a " +
        "different colour.",
    ).toEqual([]);
  });

  // -- rule 3 ------------------------------------------------------------------

  it("gives all 50 templates a distinct voice", () => {
    const byVoice = new Map<string, TemplateKey[]>();
    for (const key of TEMPLATE_KEYS) {
      const { voice } = signatureOf(key);
      const withThisVoice = byVoice.get(voice) ?? [];
      withThisVoice.push(key);
      byVoice.set(voice, withThisVoice);
    }

    const offenders = [...byVoice.entries()]
      .filter(([, keys]) => keys.length > 1)
      .map(([voice, keys]) => `"${voice}" -> ${keys.join(", ")}`);

    expect(
      offenders,
      "Two or more templates share the exact same hero eyebrow+heading. Copy " +
        "is one of the three distinctiveness axes (structure, accent, voice); " +
        "a duplicate means it was not really authored for that template.",
    ).toEqual([]);
  });

  // -- rule 4 ------------------------------------------------------------------

  it("declares exactly 50 distinct template keys (TMPL-04's literal count)", () => {
    expect(TEMPLATE_KEYS.length).toBe(50);
    expect(new Set(TEMPLATE_KEYS).size).toBe(50);
    expect(Object.keys(TEMPLATES).length).toBe(50);
  });

  // -- rule 5 (block name contains "segment", per 05-VALIDATION.md's -t filter) --

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

  // -- rule 6 --------------------------------------------------------------------

  it("spans at least 8 distinct structures in the Starter-accessible set", () => {
    const starter = accessibleTemplateKeys("starter");
    const distinctStructures = new Set(
      starter.map((key) => signatureOf(key).structure),
    );

    expect(
      distinctStructures.size,
      "The Starter-accessible templates span too few distinct structures. " +
        "Starter is the tier most merchants land on, so a concentrated " +
        "Starter set makes the whole library read as generic to the " +
        "majority of the product's users.",
    ).toBeGreaterThanOrEqual(8);
  });

  // -- rule 7 (block name contains "nested", per 05-VALIDATION.md's -t filter) ---

  it("keeps the tier sets nested and the cumulative counts at 10/25/50", () => {
    const starter = new Set(accessibleTemplateKeys("starter"));
    const business = new Set(accessibleTemplateKeys("business"));
    const professional = new Set(accessibleTemplateKeys("professional"));

    expect(
      [...starter].every((key) => business.has(key)),
      "Starter's accessible template set is not a subset of Business's — " +
        "D-06's nesting (Starter ⊆ Business ⊆ Professional) does not hold.",
    ).toBe(true);
    expect(
      [...business].every((key) => professional.has(key)),
      "Business's accessible template set is not a subset of " +
        "Professional's — D-06's nesting does not hold.",
    ).toBe(true);

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

  // -- the six closest pairs, computed for plan 05-22's human gate ------------

  it("computes the six closest pairs by structure-then-accent distance", () => {
    const ranked = rankClosestPairs(TEMPLATE_KEYS);
    const closest = ranked.slice(0, SIX_CLOSEST_PAIRS_COUNT);

    expect(
      closest.length,
      "Fewer than six pairs were ranked — TEMPLATE_KEYS is too short for " +
        "plan 05-22's adversarial-pair sample.",
    ).toBe(SIX_CLOSEST_PAIRS_COUNT);

    // Emitting must not fail the suite. Written in a form the plan summary
    // quotes verbatim — plan 05-22's adversarial-pair stranger test consumes
    // this ranking directly, so producing it here (rather than resampling
    // later) is what makes that sampling sound rather than arbitrary.
    const lines = closest.map((pair, index) => {
      const sigA = signatureOf(pair.a);
      const sigB = signatureOf(pair.b);
      return (
        `${index + 1}. ${pair.a} <-> ${pair.b} ` +
        `(sameStructure=${pair.sameStructure}, accentDistance=${pair.accentDistance}, ` +
        `structure="${sigA.structure}", accents=${sigA.accent}/${sigB.accent})`
      );
    });

    // Deliberate: this output is the artifact plan 05-22 and 05-20-SUMMARY.md
    // record verbatim.
    console.log(
      "\nSix closest template pairs (TMPL-05 Layer 1 -> Layer 3 sample):\n" +
        lines.join("\n"),
    );
  });
});
