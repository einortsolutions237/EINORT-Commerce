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
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
