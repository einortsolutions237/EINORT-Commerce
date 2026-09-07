import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";

import { BRAND } from "@/lib/strings";

import "./globals.css";

/**
 * The **body** face: everything that is not a heading — copy, labels, helper
 * text, button labels, price numerals. Exactly two weights — 400 and 600 — are
 * declared for it by the typography contract; loading more would be dead weight.
 * (That two-weight rule scopes to this face alone, not to the platform: the
 * display face below carries its own range.) Exposed as `--font-sans`, which
 * `globals.css` maps onto Tailwind's `font-sans` utility.
 */
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

/**
 * The **display** face, from the merchant-platform design reference
 * (`.planning/design-references/EINORT-COMMERCE-FRONT-END-MERCHANT-PLATFORM.md`,
 * where it is `--font-display`). Applied to heading-role elements only — `h1`,
 * `h2` and `CardTitle` — via the `font-heading` utility; Plus Jakarta Sans
 * remains the face for everything else. Exposed as `--font-heading`, which
 * `globals.css` re-exports as Tailwind's `font-heading` utility.
 */
const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

/**
 * `template` is load-bearing, not decoration: the accessibility floor in
 * 01-UI-SPEC.md requires a visitor landing on a dead subdomain to see
 * "Store not found · EINORT", never a bare "404". Every child route that sets a
 * `title` inherits the suffix automatically.
 */
export const metadata: Metadata = {
  title: {
    default: BRAND,
    template: `%s · ${BRAND}`,
  },
  description: "Create your online store in minutes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /*
     * `suppressHydrationWarning` — quick task 260906-egn. `next-themes`
     * (mounted only in `src/app/(dashboard)/layout.tsx`, never here) writes
     * the resolved theme's `class` attribute onto this element with an inline
     * pre-hydration script, before React hydrates. Without this flag React
     * would report a hydration mismatch on every dashboard page load for an
     * attribute React itself never set and does not own. Scoped to this one
     * attribute — `suppressHydrationWarning` only silences a mismatch on the
     * element it is applied to, never its descendants, so it cannot hide an
     * unrelated hydration bug anywhere else in the tree. The storefront route
     * tree never mounts the theme provider, so this is a no-op there.
     */
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${outfit.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
