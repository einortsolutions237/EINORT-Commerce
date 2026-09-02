import type { ThemeTokens } from "@/server/theming/schema";

import {
  CONTRAST_NON_TEXT,
  accentForeground,
  contrastRatio,
} from "@/lib/contrast";

/**
 * D-10 / D-11. The five default brand colours, and the derivation that turns a
 * merchant's two choices into the five custom properties the storefront reads.
 *
 * THESE CONSTANTS LIVE HERE AND NOT IN A COMPONENT, AND MOVING THEM BREAKS THE
 * BUILD. `tests/unit/surface-token-isolation.test.ts` ban #1 greps every `.tsx`
 * under `src/app` and `src/components` for `#[0-9a-fA-F]{6}` (plus `oklch(`,
 * `rgb(`, `hsl(`) on any non-comment line and fails the suite on a hit, so a
 * `const DEFAULT_ACCENT = "#18181B"` sitting next to the colour picker that
 * needs it is a red build, not a lint nit. `src/lib/**` is not scanned. The
 * injection site stays clean the same way: `src/app/s/[slug]/layout.tsx` writes
 * a `style` object whose VALUES ARE VARIABLES, never literals.
 *
 * The defaults are the reference's own position — the 10% accent in this system
 * is ink, not a hue — so a merchant who skips the picker entirely gets the
 * zinc editorial storefront rather than a half-branded one.
 */

/** zinc-900. The default primary accent: hero CTA, "View all", selected chip. */
export const DEFAULT_PRIMARY_ACCENT = "#18181B";

/** zinc-500. The default secondary accent: announcement bar, trust-bar wash. */
export const DEFAULT_SECONDARY_ACCENT = "#71717A";

/** The light candidate for any derived foreground. */
export const ACCENT_FOREGROUND_LIGHT = "#FFFFFF";

/** The dark candidate for any derived foreground (zinc-900 ink). */
export const ACCENT_FOREGROUND_INK = "#18181B";

/** zinc-400. The focus ring an accent below 3:1 against white falls back to. */
export const DEFAULT_RING_FALLBACK = "#A1A1AA";

/**
 * The five custom properties the storefront scope resolves, keyed by their CSS
 * names so the injection site is a spread and cannot rename one by accident.
 */
export type ThemeCssVars = {
  "--brand-accent": string;
  "--brand-accent-foreground": string;
  "--brand-accent-secondary": string;
  "--brand-accent-secondary-foreground": string;
  "--brand-accent-ring": string;
};

/**
 * Two stored colours in, five resolved values out.
 *
 * Pure, and deliberately so: the same function runs on the server for the live
 * storefront and inside the preview iframe on every keystroke (D-07), and the
 * two must not be able to disagree about what a colour resolves to.
 *
 * ONLY THE TWO ACCENTS ARE STORED. The foregrounds and the ring are derived
 * here rather than persisted, because a stored derived value is a value that
 * can go stale against the accent it was computed from — and the whole point is
 * that a merchant cannot end up with an unreadable pair.
 *
 * The ring is auto-fixed instead of warned about (unlike the accent-as-link
 * case, which stays a merchant judgement): a focus ring is an accessibility
 * mechanism under WCAG SC 1.4.11 / 2.4.11 on a route tree that includes
 * checkout, so it is not discretionary. Below 3:1 against white the accent is
 * replaced by zinc-400 — THE RING IS NEVER UNUSABLE.
 */
export function deriveThemeCssVars(
  tokens: Pick<ThemeTokens, "primaryAccent" | "secondaryAccent">,
): ThemeCssVars {
  const { primaryAccent, secondaryAccent } = tokens;
  return {
    "--brand-accent": primaryAccent,
    "--brand-accent-foreground": accentForeground(
      primaryAccent,
      ACCENT_FOREGROUND_LIGHT,
      ACCENT_FOREGROUND_INK,
    ),
    "--brand-accent-secondary": secondaryAccent,
    "--brand-accent-secondary-foreground": accentForeground(
      secondaryAccent,
      ACCENT_FOREGROUND_LIGHT,
      ACCENT_FOREGROUND_INK,
    ),
    "--brand-accent-ring":
      contrastRatio(primaryAccent, ACCENT_FOREGROUND_LIGHT) >= CONTRAST_NON_TEXT
        ? primaryAccent
        : DEFAULT_RING_FALLBACK,
  };
}
