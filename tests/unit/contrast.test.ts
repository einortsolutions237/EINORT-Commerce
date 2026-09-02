import { describe, expect, it } from "vitest";

import {
  CONTRAST_NON_TEXT,
  CONTRAST_TEXT,
  accentForeground,
  contrastRatio,
  relativeLuminance,
} from "@/lib/contrast";
import {
  ACCENT_FOREGROUND_INK,
  ACCENT_FOREGROUND_LIGHT,
  DEFAULT_PRIMARY_ACCENT,
  DEFAULT_RING_FALLBACK,
  DEFAULT_SECONDARY_ACCENT,
  deriveThemeCssVars,
} from "@/lib/theme-defaults";

/**
 * D-11 — the WCAG maths, pinned against the W3C's own reference values.
 *
 * These are not "does multiplication work" tests. `src/lib/contrast.ts` is the
 * only thing standing between a merchant's colour choice and a button whose own
 * label cannot be read, on a route tree that contains checkout. The two
 * anchors below (21:1 for black-on-white, 1:1 for a colour against itself) are
 * the W3C's stated bounds, so a transcription slip in the linearisation
 * exponent or the 0.05 offset moves at least one of them.
 *
 * THE UNROUNDED CASE IS THE POINT OF THE SUITE. The spec states 4.499:1 does
 * not meet 4.5:1; a `toFixed(1)` anywhere in the module would make a failing
 * pair report as passing, which is the exact failure this file exists to catch.
 */

/** Every value the module treats as a fixed point of the brand palette. */
const BLACK = "#000000";
const WHITE = "#FFFFFF";
/** Pale yellow — needs dark text, and fails 3:1 against white. */
const PALE_YELLOW = "#FDE047";
/** Dark orange — needs white text, and clears 3:1 against white. */
const DARK_ORANGE = "#C2410C";
/** Grey whose ratio against white is 4.478: rounds to 4.5, but is not 4.5. */
const NEAR_MISS_GREY = "#777777";

describe("relativeLuminance", () => {
  it("returns the W3C bounds for black and white", () => {
    expect(relativeLuminance(BLACK)).toBeCloseTo(0, 12);
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 12);
  });

  it("weights green far above red and red above blue", () => {
    // 0.2126 / 0.7152 / 0.0722 — if the coefficients are transposed, this is
    // the assertion that notices, and it notices without a magic number.
    const red = relativeLuminance("#FF0000");
    const green = relativeLuminance("#00FF00");
    const blue = relativeLuminance("#0000FF");
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe("contrastRatio", () => {
  it("returns exactly 21 for black on white", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 9);
  });

  it("returns exactly 1 for a colour against itself", () => {
    expect(contrastRatio("#3D3D3D", "#3D3D3D")).toBeCloseTo(1, 9);
  });

  it("is symmetric — argument order carries no meaning", () => {
    // The caller has no consistent "foreground first" convention (the ring
    // derivation passes the accent first, `accentForeground` passes it second),
    // so asymmetry here would be a silent wrong answer at one of the two sites.
    for (const [a, b] of [
      [BLACK, WHITE],
      [PALE_YELLOW, DEFAULT_PRIMARY_ACCENT],
      [DARK_ORANGE, WHITE],
      [DEFAULT_SECONDARY_ACCENT, WHITE],
    ]) {
      expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 12);
    }
  });

  it("does not round — 4.478 is below the threshold it rounds to", () => {
    const ratio = contrastRatio(NEAR_MISS_GREY, WHITE);
    // Rounded to one decimal this pair reads as 4.5 and would look compliant.
    expect(Math.round(ratio * 10) / 10).toBe(4.5);
    // Unrounded, it is not, and that is the answer the W3C text demands.
    expect(ratio).toBeLessThan(CONTRAST_TEXT);
  });

  it("is case-insensitive about the hex digits", () => {
    expect(contrastRatio("#fde047", WHITE)).toBeCloseTo(
      contrastRatio("#FDE047", WHITE),
      12,
    );
  });
});

describe("thresholds", () => {
  it("carries the two WCAG floors as named constants", () => {
    // SC 1.4.3 normal text and SC 1.4.11 non-text. Named so a call site reads
    // as the rule it is applying rather than as an unexplained 4.5.
    expect(CONTRAST_TEXT).toBe(4.5);
    expect(CONTRAST_NON_TEXT).toBe(3);
  });
});

describe("accentForeground", () => {
  it("picks ink for a pale accent", () => {
    expect(
      accentForeground(PALE_YELLOW, ACCENT_FOREGROUND_LIGHT, ACCENT_FOREGROUND_INK),
    ).toBe(ACCENT_FOREGROUND_INK);
  });

  it("picks light for a dark accent", () => {
    expect(
      accentForeground(DARK_ORANGE, ACCENT_FOREGROUND_LIGHT, ACCENT_FOREGROUND_INK),
    ).toBe(ACCENT_FOREGROUND_LIGHT);
  });

  it("picks light for the default ink accent", () => {
    // The degenerate case: ink against ink is 1:1, so the alternative always
    // wins. A merchant who never opens the picker still gets a readable button.
    expect(
      accentForeground(
        DEFAULT_PRIMARY_ACCENT,
        ACCENT_FOREGROUND_LIGHT,
        ACCENT_FOREGROUND_INK,
      ),
    ).toBe(ACCENT_FOREGROUND_LIGHT);
  });

  it("always returns a foreground clearing 4.5:1 against the accent", () => {
    // The guardrail stated as a property rather than as three examples.
    for (const accent of [
      PALE_YELLOW,
      DARK_ORANGE,
      DEFAULT_PRIMARY_ACCENT,
      DEFAULT_SECONDARY_ACCENT,
      "#808080",
    ]) {
      const chosen = accentForeground(
        accent,
        ACCENT_FOREGROUND_LIGHT,
        ACCENT_FOREGROUND_INK,
      );
      expect(contrastRatio(accent, chosen)).toBeGreaterThanOrEqual(
        CONTRAST_TEXT,
      );
    }
  });
});

describe("deriveThemeCssVars", () => {
  const tokens = (primaryAccent: string, secondaryAccent: string) => ({
    primaryAccent,
    secondaryAccent,
    announcementText: "Order online.",
    footerTagline: "Thanks for shopping with us.",
  });

  it("passes the accents through and derives both foregrounds", () => {
    const vars = deriveThemeCssVars(tokens(DARK_ORANGE, PALE_YELLOW));
    expect(vars["--brand-accent"]).toBe(DARK_ORANGE);
    expect(vars["--brand-accent-foreground"]).toBe(ACCENT_FOREGROUND_LIGHT);
    expect(vars["--brand-accent-secondary"]).toBe(PALE_YELLOW);
    expect(vars["--brand-accent-secondary-foreground"]).toBe(
      ACCENT_FOREGROUND_INK,
    );
  });

  it("keeps the accent as the focus ring when it clears 3:1 against white", () => {
    // Both the default ink and a mid-dark orange clear the non-text floor, so
    // the merchant's colour is what the ring actually shows.
    expect(deriveThemeCssVars(tokens(DARK_ORANGE, WHITE))["--brand-accent-ring"]).toBe(
      DARK_ORANGE,
    );
    expect(
      deriveThemeCssVars(
        tokens(DEFAULT_PRIMARY_ACCENT, DEFAULT_SECONDARY_ACCENT),
      )["--brand-accent-ring"],
    ).toBe(DEFAULT_PRIMARY_ACCENT);
  });

  it("falls the focus ring back to zinc-400 below 3:1", () => {
    // WCAG 1.4.11 / 2.4.11 on a route tree containing checkout is not
    // merchant-discretionary: a pale-yellow ring on white is invisible, so the
    // ring is auto-fixed rather than warned about. THE RING IS NEVER UNUSABLE.
    expect(contrastRatio(PALE_YELLOW, WHITE)).toBeLessThan(CONTRAST_NON_TEXT);
    expect(
      deriveThemeCssVars(tokens(PALE_YELLOW, DEFAULT_SECONDARY_ACCENT))[
        "--brand-accent-ring"
      ],
    ).toBe(DEFAULT_RING_FALLBACK);
  });
});
