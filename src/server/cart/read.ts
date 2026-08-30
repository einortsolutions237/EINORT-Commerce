import "server-only";

import { cookies } from "next/headers";

import { resolveTenantBySlug } from "@/server/tenant/resolve";

import { CART_COOKIE_NAME, cartForTenant, readStoredCart, type StoredCart } from "./cache";

/**
 * The one sanctioned read of the cart cookie from a Server Component.
 *
 * `src/server/cart/actions.ts` is deliberately framed as "the three cart
 * mutations, and the only place permitted to WRITE the cookie" — Pitfall 4
 * (03-RESEARCH.md) is about `cookies().set` needing a Server Function or
 * Route Handler, and a plain `cookies().get()` is legal anywhere including a
 * Server Component. But this plan's acceptance criteria go further than the
 * framework requires: no file under `src/app/s/**` may reference `cookies()`
 * at all, so every storefront page that needs to know "does a cart already
 * exist, and whose" — the header bubble on every route, the catalog page
 * before any add-to-cart has happened — goes through here instead of
 * inlining a `cookies().get()` of its own. Centralising it is what keeps
 * "which code can read a shopper's basket?" answerable by reading two files
 * (this one and `actions.ts`) rather than grepping the whole route tree.
 *
 * Deliberately its own module rather than a fourth export of `actions.ts`:
 * that file's `"use server"` directive turns every export into a callable
 * Server Action, which is the right shape for a mutation a client component
 * calls, and the wrong shape for a plain data read a Server Component awaits
 * during render. Splitting them keeps `actions.ts` true to its own header.
 */
export async function getCurrentCart(slug: string): Promise<StoredCart | null> {
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return null;

  const jar = await cookies();
  const cartId = jar.get(CART_COOKIE_NAME)?.value;
  if (!cartId) return null;

  const stored = await readStoredCart(cartId);
  return cartForTenant(stored, tenant.id);
}
