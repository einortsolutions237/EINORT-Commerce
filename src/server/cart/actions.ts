"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { scopedDb } from "@/server/db/tenant-scoped";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

import {
  CART_COOKIE_NAME,
  CART_MAX_LINE_QUANTITY,
  CART_TTL_SECONDS,
  cartForTenant,
  readStoredCart,
  writeStoredCart,
  type StoredCart,
} from "./cache";

/**
 * The three cart mutations — and the only place in the codebase permitted to
 * write the cart cookie.
 *
 * WHY THESE ARE SERVER ACTIONS AND NOT HELPERS (03-RESEARCH.md Pitfall 4).
 * HTTP does not allow setting a cookie after streaming has started, so Next 16
 * only permits `cookies().set` inside a Server Function or a Route Handler. A
 * page may call `get()` and nothing else. The failure mode if that is ignored
 * is silent and total: a `getOrCreateCart()` helper invoked during render mints
 * a fresh id on every request, never persists it, and every page load looks
 * like an empty basket with no error anywhere. The cart id is therefore minted
 * *here*, on a real POST, or not at all.
 *
 * NONE OF THESE IS A `merchantAction`. The caller is an anonymous shopper, not
 * a signed-in merchant: there is no session to require, no trial to check and
 * no entitlement to consult. What replaces that gate is the tenant resolution
 * on the first line of every mutation — the shopper may only touch a cart bound
 * to the store whose hostname actually resolved.
 *
 * The result type is a plain discriminated union rather than the merchant
 * surface's `ActionResult<T>`: that shape carries a `Record<string, string[]>`
 * of field errors for a form, and none of these mutations is a form. A caller
 * needs to know which of three things went wrong so it can choose copy, and
 * `strings.*` is where the copy lives.
 */

export type CartActionResult =
  | { ok: true; lineCount: number }
  | {
      ok: false;
      reason: "store_not_found" | "variant_unavailable" | "invalid_quantity";
    };

type CartItems = StoredCart["items"];

/**
 * Normalise a requested quantity, or reject it.
 *
 * `null` means "the shopper asked for something that is not a quantity" and the
 * caller refuses. Truncation rather than rounding is deliberate: a request for
 * 2.7 becomes 2, so a malformed or hostile input can only ever move the number
 * DOWN, never up into stock the shopper did not ask for.
 *
 * Zero is legal here and means removal; `addToCart` is the one caller that
 * rejects it, because "add zero of this" is a bug at the call site rather than
 * an intent.
 */
function normalizeQuantity(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const truncated = Math.trunc(raw);
  if (truncated < 0) return null;
  return Math.min(truncated, CART_MAX_LINE_QUANTITY);
}

/** Sum of quantities — the number the header bubble shows. */
function lineCountOf(items: CartItems): number {
  return items.reduce((running, line) => running + line.quantity, 0);
}

/**
 * Confirm a variant id is one this store can actually sell (T-03-46).
 *
 * Read through `scopedDb(tenant.id)`, so a variant belonging to another
 * merchant is invisible here regardless of what the client sent — the id
 * arrives from the browser and is therefore a claim, not a fact. `active` is
 * checked on both the variant and its product because D-08 makes deactivation
 * the only way to remove a product: a deactivated product is invisible on the
 * storefront, and a variant of one must not be reachable through a stale PDP
 * tab either.
 *
 * Stock is deliberately NOT checked. D-09 keeps sold-out products visible and
 * linkable, the PDP disables the button rather than hiding it, and the
 * authoritative stock decision is made atomically at placement (D-04). Refusing
 * here would only move a race one step earlier without closing it.
 */
async function variantIsSellable(
  tenantId: string,
  variantId: string,
): Promise<boolean> {
  if (!variantId) return false;

  const variant = await scopedDb(tenantId).productVariant.findFirst({
    where: { id: variantId, active: true, product: { active: true } },
    select: { id: true },
  });

  return variant !== null;
}

/**
 * The one code path that resolves the store, loads the cart, applies a change
 * and writes both the cookie and Redis back.
 *
 * Having exactly one is the point: the cookie attributes below are a security
 * control, and a second `cookies().set` for the cart elsewhere in the codebase
 * would be a second place for them to drift. `tests/unit/cart.test.ts` asserts
 * the attributes; the acceptance criteria for this plan grep that there is only
 * one site setting them.
 */
async function mutateCart(
  slug: string,
  apply: (
    items: CartItems,
    tenantId: string,
  ) => Promise<CartItems | { refuse: CartActionResult }>,
): Promise<CartActionResult> {
  // The tenant first, before the cookie and before any write. A cart must never
  // be bound to a store the visitor cannot reach, and an unresolvable slug must
  // cost nothing.
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return { ok: false, reason: "store_not_found" };

  const jar = await cookies();
  const existingId = jar.get(CART_COOKIE_NAME)?.value;

  const stored = existingId ? await readStoredCart(existingId) : null;

  // A cart carrying another tenant's id is discarded, not merged (T-03-45).
  // The cart id itself is reused: it is opaque and carries no tenant meaning,
  // so re-minting would only churn cookies.
  const current = cartForTenant(stored, tenant.id);
  const items: CartItems = current
    ? current.items.map((line) => ({ ...line }))
    : [];

  const outcome = await apply(items, tenant.id);
  if ("refuse" in outcome) return outcome.refuse;

  const cartId = existingId && existingId !== "" ? existingId : randomCartId();

  /*
   * NO `domain` OPTION, and that omission is the control.
   *
   * Omitting it host-scopes the cookie to `{slug}.einort.com`, so one
   * merchant's cart cookie is never sent to another merchant's storefront.
   * Setting `domain: ".einort.com"` would share one cart cookie across every
   * tenant — a cross-tenant leak dressed up as a convenience. The `tenantId`
   * comparison above is the belt to this pair of braces; neither replaces the
   * other.
   *
   * `httpOnly` because no client script has any reason to read an opaque id,
   * and `sameSite: "lax"` because the cart must survive a shopper following a
   * shared product link into the store while still refusing cross-site POSTs.
   */
  jar.set(CART_COOKIE_NAME, cartId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_TTL_SECONDS,
  });

  await writeStoredCart(cartId, {
    tenantId: tenant.id,
    items: outcome,
    updatedAt: Date.now(),
  });

  // The header bubble and the cart page both read the cart during render, so
  // they have to be told it moved. `layout` covers the whole storefront subtree
  // in one call rather than enumerating routes that later plans will add.
  revalidatePath(`/s/${slug}`, "layout");

  return { ok: true, lineCount: lineCountOf(outcome) };
}

/**
 * An opaque cart id.
 *
 * `crypto.randomUUID()` rather than anything derived: the id is the only thing
 * in the cookie, so it must reveal nothing about the tenant, the shopper or
 * when it was issued, and it must not be guessable by someone who has seen
 * another one.
 */
function randomCartId(): string {
  return crypto.randomUUID();
}

/**
 * Add a variant to the cart, or increase its line if it is already there.
 *
 * Increment rather than append — two lines for the same variant would display
 * as a duplicate, and the stock check at placement would then be made twice
 * against the same row.
 */
export async function addToCart(input: {
  slug: string;
  variantId: string;
  quantity?: number;
}): Promise<CartActionResult> {
  const requested = normalizeQuantity(input.quantity ?? 1);
  if (requested === null || requested < 1) {
    return { ok: false, reason: "invalid_quantity" };
  }

  return mutateCart(input.slug, async (items, tenantId) => {
    if (!(await variantIsSellable(tenantId, input.variantId))) {
      return { refuse: { ok: false, reason: "variant_unavailable" } };
    }

    const existing = items.find((line) => line.variantId === input.variantId);
    if (existing) {
      existing.quantity = Math.min(
        existing.quantity + requested,
        CART_MAX_LINE_QUANTITY,
      );
      return items;
    }

    items.push({ variantId: input.variantId, quantity: requested });
    return items;
  });
}

/**
 * Set a line to an exact quantity. Zero removes it.
 *
 * The variant is re-validated on any non-zero quantity for the same reason
 * `addToCart` validates: this action is reachable directly, so "the variant was
 * legitimate when it went in" is not a claim about the id arriving now.
 */
export async function setCartQuantity(input: {
  slug: string;
  variantId: string;
  quantity: number;
}): Promise<CartActionResult> {
  const requested = normalizeQuantity(input.quantity);
  if (requested === null) return { ok: false, reason: "invalid_quantity" };

  return mutateCart(input.slug, async (items, tenantId) => {
    if (requested === 0) {
      return items.filter((line) => line.variantId !== input.variantId);
    }

    if (!(await variantIsSellable(tenantId, input.variantId))) {
      return { refuse: { ok: false, reason: "variant_unavailable" } };
    }

    const existing = items.find((line) => line.variantId === input.variantId);
    if (existing) {
      existing.quantity = requested;
      return items;
    }

    items.push({ variantId: input.variantId, quantity: requested });
    return items;
  });
}

/**
 * Remove a line.
 *
 * Note the absence of a variant check. Removal must work for a line that is no
 * longer sellable — the merchant deactivated the product while the tab was
 * open — because refusing would strand the shopper with a line they cannot get
 * rid of and a checkout they cannot reach.
 */
export async function removeCartLine(input: {
  slug: string;
  variantId: string;
}): Promise<CartActionResult> {
  return mutateCart(input.slug, async (items) =>
    items.filter((line) => line.variantId !== input.variantId),
  );
}
