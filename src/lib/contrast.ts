/**
 * D-11. WCAG 2.2 relative luminance and contrast ratio, transcribed from
 * https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html.
 *
 * NO IMPORTS, AND THERE MUST NEVER BE ONE. This module is imported from the
 * storefront layout (server), from the onboarding colour picker (client) and
 * from the preview canvas inside the iframe (client). A single import pulls
 * whatever it drags with it into all three bundles, and one of them is the
 * critical render path of a public storefront on a Douala mobile connection.
 *
 * THE RESULT IS DELIBERATELY NOT ROUNDED. The W3C text states that 4.499:1
 * does not meet the 4.5:1 threshold, so a caller comparing a rounded value
 * would pass a failing pair as compliant — `#777777` on white computes 4.478
 * and presents as 4.5 at one decimal place. No rounding of any kind happens in
 * this file, and adding some is a correctness regression rather than a display
 * nicety: round at the point of display, never at the point of comparison.
 *
 * Why this is hand-rolled rather than a dependency (04-RESEARCH.md § Don't
 * Hand-Roll): the formula has been fixed since 2008 and is eight lines of
 * arithmetic. `wcag-contrast` / `colord` would add supply-chain surface, an
 * update cadence and a bundle cost for zero capability, in a phase whose threat
 * register (T-04-SC) records "zero packages installed" as the accepted posture.
 */

/**
 * One 8-bit channel, normalised and linearised (sRGB → linear-light).
 *
 * Module-private on purpose: exporting it would invite a caller to build a
 * second luminance function beside a different set of coefficients, and the
 * whole value of this module is that there is one formula to read and test.
 */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Relative luminance of a `#rrggbb` colour, 0 (black) to 1 (white).
 *
 * The input is assumed to have cleared `hexColorSchema` upstream — this
 * function takes a string and not a validated brand type because it is also
 * called on the two module constants in `theme-defaults.ts`, which are literals
 * that never travel through a parse. It is a maths function, not a boundary.
 */
export function relativeLuminance(hex: string): number {
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The contrast ratio between two colours: `(lighter + 0.05) / (darker + 0.05)`.
 *
 * Symmetric by construction — the lighter of the two is sorted into the
 * numerator rather than assumed to be the first argument, because the two call
 * sites disagree about ordering (`accentForeground` passes the accent first,
 * the ring derivation compares the accent against white).
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** WCAG SC 1.4.3 normal-text threshold. */
export const CONTRAST_TEXT = 4.5;

/** WCAG SC 1.4.11 non-text threshold (focus rings, active bars, icon marks). */
export const CONTRAST_NON_TEXT = 3;

/**
 * Whichever of `light` / `dark` reads better on `accent`.
 *
 * D-09's guardrail, and the reason it is a choice rather than a warning: a
 * merchant should never be able to produce a button whose own label is
 * unreadable. D-11's non-blocking inline warning is reserved for the
 * accent-as-link case, which is a taste judgement the merchant is allowed to
 * make badly; a button label is not.
 *
 * This picks the BETTER option, which is not the same as picking a compliant
 * one. A mid-grey accent (`#808080`) reaches only 3.9:1 against white and 4.3:1
 * against ink, so the winner still misses the 4.5:1 text floor — the guarantee
 * here is "never the worse of the two", and it always clears the 3:1 non-text
 * floor. The narrow band of accents where even the better choice fails is
 * exactly what D-11's inline picker warning is for; it is not a reason to
 * introduce a third candidate colour, which would break D-09's palette.
 */
export function accentForeground(
  accent: string,
  light: string,
  dark: string,
): string {
  return contrastRatio(accent, light) >= contrastRatio(accent, dark)
    ? light
    : dark;
}
