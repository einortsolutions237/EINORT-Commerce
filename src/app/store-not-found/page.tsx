import { notFound } from "next/navigation";

/**
 * The Proxy's landing pad for an unclassifiable hostname — and nothing else.
 *
 * `src/proxy.ts` cannot return a rendered page, so its fail-closed branch
 * rewrites to this route. This file's entire job is to call `notFound()`, which
 * buys three properties at once:
 *
 *   1. **A genuine 404.** A bare rewrite renders with a 200, which would let a
 *      crawler index every hostname in the wildcard as a live page (T-01-33).
 *   2. **The branded body.** `notFound()` renders `src/app/not-found.tsx`, so
 *      this path gets D-04's EINORT page rather than a framework error screen.
 *   3. **D-05.** The unclaimed-hostname path (`/s/[slug]/layout.tsx`) also calls
 *      `notFound()`. Both therefore render the identical component with the
 *      identical props, which is exactly the criterion a reviewer checks
 *      (T-01-29).
 *
 * Do NOT render the branded body inline here. Duplicating it — even
 * byte-for-byte today — is precisely how the suspended and unknown paths drift
 * apart later, and the drift would be invisible until someone diffed two
 * responses.
 */
export default function StoreNotFoundPage(): never {
  notFound();
}
