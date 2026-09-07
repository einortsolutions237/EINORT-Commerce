"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Quick task 260906-egn — the merchant dashboard's 3-way Light/System/Dark
 * theme, human-gated at install (`260906-egn-PLAN.md` Task 1: `next-themes`
 * was `[ASSUMED]` in the package-legitimacy audit because `slopcheck` was
 * unavailable, so the install waited for an explicit human approval before
 * running).
 *
 * ---------------------------------------------------------------------------
 * MOUNTED IN THE DASHBOARD LAYOUT ONLY. NEVER THE ROOT LAYOUT.
 * ---------------------------------------------------------------------------
 * Dark mode is a merchant-surface feature. `globals.css`'s `.dark` class is
 * already a full, deliberate inversion of the merchant palette (`--background`,
 * `--card`, the sidebar tokens, `--chart-1`, and so on) — that CSS existed
 * before this task and was simply unreachable without a class toggle on
 * `<html>`, which is exactly what `next-themes` provides via `attribute="class"`
 * below. The storefront has NO `.dark` counterpart by design (see the comment
 * on `[data-surface="storefront"]` in `globals.css`), so mounting this provider
 * at the root would put next-themes' bundle and its theme-toggle affordance in
 * front of every shopper for a feature that does nothing on that surface.
 * `src/app/(dashboard)/layout.tsx` is the one mount point.
 *
 * `attribute="class"` matches `@custom-variant dark (&:is(.dark *));` in
 * `globals.css` exactly — next-themes toggles the `.dark` class on `<html>`,
 * and every Tailwind `dark:` utility and every `.dark { … }` token override
 * already keys off that same class. `defaultTheme="system"` and `enableSystem`
 * together are CONTEXT's locked 3-way decision: a merchant who has never
 * touched the toggle gets their OS preference, not a hardcoded light default.
 * `disableTransitionOnChange` avoids a visible cross-fade of every colour token
 * at once the instant the toggle fires — next-themes' own documented flag for
 * exactly this.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
