import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/server/auth/auth";

/**
 * The Better Auth HTTP surface — apex-only (D-07).
 *
 * "Apex-only" is enforced by routing, not by a check in this file.
 * `src/proxy.ts` rewrites a storefront subdomain's `/api/auth/*` into
 * `/s/{slug}/api/auth/*`, where no route handler exists, so it 404s. Plan 01-03
 * deliberately left `/api` OUT of the Proxy's matcher exclusions to produce
 * exactly that result.
 *
 * Do not "fix" that 404 by excluding `/api` from the Proxy matcher. It is the
 * T-01-44 control: with the exclusion, a live authentication endpoint would
 * exist on every merchant-controlled subdomain, and merchant-controlled
 * subdomains are the least trusted surface on the platform.
 *
 * There is deliberately no Edge runtime export here or anywhere in this plan's
 * files. Better Auth's Prisma adapter needs the Node.js runtime, which is also
 * the Next.js default — so the correct action is to add nothing at all.
 */
export const { GET, POST } = toNextJsHandler(auth);
