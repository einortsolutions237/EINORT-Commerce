import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { BRAND } from "@/lib/strings";

import "./globals.css";

/**
 * Single family for the whole platform (01-UI-SPEC.md § Design System).
 * Exactly two weights — 400 and 600 — are declared by the typography contract;
 * loading more would be dead weight. Exposed as `--font-sans`, which
 * `globals.css` maps onto Tailwind's `font-sans` utility.
 */
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
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
      className={`${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
