import type { Metadata } from "next";

import { env } from "@/env";
import { strings } from "@/lib/strings";

/**
 * THE branded EINORT failure body. One component, every failure path.
 *
 * Three routes converge here and they must be indistinguishable:
 *
 *   1. an unclassifiable hostname  — `src/proxy.ts` rewrites to
 *      `/store-not-found`, which calls `notFound()`
 *   2. a well-formed but unclaimed hostname — `/s/[slug]/layout.tsx` resolves
 *      to `null` and calls `notFound()`
 *   3. a store the platform has taken out of service — same layout, same
 *      `null`, same `notFound()`
 *
 * That convergence is D-04 (one branded page with a link back to the root
 * domain, not a bare framework 404) and D-05 / T-01-29 (a visitor must not be
 * able to tell a store taken out of service from a hostname nobody ever
 * claimed, and no copy on this page may hint at which one it is). The
 * enforcement criterion is that a reviewer can confirm all three paths render
 * the *same component with the same props* — which is only checkable if there
 * is exactly one such component. Rendering this body inline anywhere else, even
 * identically, is how the paths drift apart.
 *
 * `notFound()` is also what makes the status a genuine 404 rather than the 200
 * a bare proxy rewrite would return, so a crawler walking the wildcard does not
 * index thousands of hostnames as live pages (T-01-33).
 *
 * Spacing uses declared scale tokens only: py-16 = 3xl (64px) page padding,
 * px-8 = xl (32px) gutter, mt-4 = md (16px), mt-8 = xl (32px).
 */

export const metadata: Metadata = {
  // Renders as "Store not found · EINORT" via the root layout's title
  // template. The accessibility floor in 01-UI-SPEC.md is explicit that a
  // visitor arriving at a dead subdomain must never see a bare "404" in the tab.
  title: strings.storeNotFound.title,
};

/**
 * The public origin to send a lost visitor back to.
 *
 * Derived from the same variable that drives hostname classification, so the
 * link cannot point somewhere the router does not consider the apex. Local
 * development runs on plain HTTP; everything else is HTTPS.
 */
function rootDomainUrl(): string {
  const domain = env.NEXT_PUBLIC_ROOT_DOMAIN;
  const scheme =
    domain === "localhost" || domain.startsWith("localhost:") ? "http" : "https";
  return `${scheme}://${domain}`;
}

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-8 py-16">
      <div className="flex max-w-prose flex-col items-center text-center">
        {/* Display role: 36px / 600 / 1.1 */}
        <h1 className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight text-foreground">
          {strings.storeNotFound.heading}
        </h1>

        {/* Body role: 16px / 400 / 1.5 */}
        <p className="mt-4 text-base leading-normal font-normal text-muted-foreground">
          {strings.storeNotFound.body}
        </p>

        {/*
         * A plain anchor, not next/link: the root domain is a different origin
         * from the storefront subdomain this visitor landed on, so there is no
         * client-side navigation to prefetch.
         *
         * Styled as --foreground plus underline. The accent is explicitly NOT
         * for links (01-UI-SPEC.md § Color). `min-h-11` is the 44px touch-target
         * floor — non-negotiable for this mobile-first, low-end Android market.
         */}
        <a
          href={rootDomainUrl()}
          className="mt-8 inline-flex min-h-11 items-center text-base leading-normal font-normal text-foreground underline underline-offset-4"
        >
          {strings.storeNotFound.link}
        </a>
      </div>
    </main>
  );
}
