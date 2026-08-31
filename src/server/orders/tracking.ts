import "server-only";

import { scopedDb } from "@/server/db/tenant-scoped";
// Imported under a local alias, the same convention `src/app/s/[slug]/page.tsx`
// uses for its catalog read: the digest helper is named once, at the top, and
// the call site below reads as what it produces rather than as how.
import { hashTrackingToken as digestOf } from "@/server/orders/tracking-token";

/**
 * D-12 — the whole of the access control on a customer's own order.
 *
 * ---------------------------------------------------------------------------
 * THE TOKEN IS THE AUTHORISATION. THERE IS NOTHING ELSE.
 * ---------------------------------------------------------------------------
 * Checkout is accountless, so there is no session to bind an order to and no
 * phone-number-plus-order-number lookup form to fall back on. Whoever holds the
 * link holds the order. That makes the token a bearer credential with no expiry
 * and no second factor, which is exactly why only its SHA-256 digest is stored
 * (`src/server/orders/tracking-token.ts` carries the reasoning) and why this
 * module is deliberately the narrowest function in the orders domain.
 *
 * ---------------------------------------------------------------------------
 * THREE FAILURES, ONE ANSWER. THAT IS THE POINT, NOT A SIMPLIFICATION.
 * ---------------------------------------------------------------------------
 * A malformed token, an unknown token and a token that is perfectly valid for
 * ANOTHER tenant all resolve to the identical `null`. A caller cannot tell
 * which happened, so the page above cannot render a difference, so an attacker
 * cannot read one. This is Phase 1's D-05 discipline applied one layer down —
 * `src/server/tenant/resolve.ts` collapses unknown / unclaimed / suspended for
 * the same reason, and states the same rule: collapse it in the resolver rather
 * than at the render layer, so no future caller can branch on the difference.
 *
 * The malformed case returns before touching Postgres. A token that is not 32
 * base64url characters cannot be one this system minted, so a query for it is
 * work done on behalf of a scripted walk and nothing else. The shape check is
 * an anti-load measure, never a security claim — the security is the 192 bits.
 *
 * The foreign-tenant case is closed structurally rather than by a comparison
 * after the read: the storefront's tenant already comes from the `Host` header,
 * so `scopedDb(tenantId)` narrows the lookup before it runs and another store's
 * live token simply does not match anything visible here. The global unique
 * index on `trackingTokenHash` is what makes that safe without a tenant column
 * in the index — a digest is unique platform-wide, so a tenant-scoped read of
 * it can never be ambiguous, only empty.
 *
 * ---------------------------------------------------------------------------
 * THE DIGEST IS NEVER SELECTED BACK OUT.
 * ---------------------------------------------------------------------------
 * Nothing downstream needs it, and a value in a Server Component's props is a
 * value in the serialised HTML that ships to the browser. The select list below
 * is exactly what 03-UI-SPEC.md § B7 renders and nothing more, for that reason.
 *
 * ---------------------------------------------------------------------------
 * THE ACCEPTED RESIDUAL, STATED PLAINLY.
 * ---------------------------------------------------------------------------
 * The token travels as a URL path segment, so it lands in Vercel's request logs
 * (03-RESEARCH.md Pattern 6). That is accepted and bounded by log retention and
 * by who can read those logs. The alternative — a fragment-only token read by
 * client JavaScript, or a POST-only lookup form — costs the shareable link that
 * makes the feature work over WhatsApp at all, which is the entire delivery
 * mechanism in this market. The mitigations that ARE cheap are applied at the
 * route instead: `robots: noindex, nofollow` and a `no-referrer` policy, both
 * on `src/app/s/[slug]/order/[token]/page.tsx`.
 */

/**
 * What `mintTrackingToken()` produces: 24 random bytes as exactly 32 base64url
 * characters, with no padding. Anything else was not minted by this system.
 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{32}$/;

/**
 * The customer's order, or `null` — and `null` says nothing about why.
 *
 * @param tenantId the store resolved from the `Host` header, never from input
 * @param rawToken the plaintext path segment, entirely untrusted
 */
export async function findOrderByTrackingToken(
  tenantId: string,
  rawToken: string,
) {
  // A shape mismatch is answered without a query. An empty string, a
  // path-traversal attempt and a 31-character near-miss all land here.
  if (typeof rawToken !== "string" || !TOKEN_SHAPE.test(rawToken)) return null;

  return scopedDb(tenantId).order.findFirst({
    where: { trackingTokenHash: digestOf(rawToken) },
    select: {
      id: true,
      orderNumber: true,
      state: true,
      channel: true,
      customerName: true,
      subtotalXaf: true,
      totalXaf: true,
      placedAt: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productName: true,
          variantLabel: true,
          unitPriceXaf: true,
          quantity: true,
          lineTotalXaf: true,
          imageKey: true,
        },
      },
      // The most recent claim only. `PAYMENT_CLAIMED` shows the customer what
      // they submitted and `DISPUTED` shows them why the merchant could not
      // match it (D-11 — a dispute is recoverable, so the reason has to travel
      // to the person who can act on it).
      claims: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: {
          id: true,
          operator: true,
          reference: true,
          screenshotKey: true,
          status: true,
          rejectionReason: true,
          submittedAt: true,
        },
      },
    },
  });
}

/** The resolved order, for components that render it. */
export type TrackedOrder = NonNullable<
  Awaited<ReturnType<typeof findOrderByTrackingToken>>
>;
