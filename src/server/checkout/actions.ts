"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";

import { env } from "@/env";
import { strings } from "@/lib/strings";
import * as cartCache from "@/server/cart/cache";
import { OrderChannel, PaymentOperator } from "@/server/db/enums";
import { scopedDb } from "@/server/db/tenant-scoped";
import * as idempotency from "@/server/idempotency/cache";
import { OutOfStockError, UnavailableItemError } from "@/server/orders/errors";
import { placeOrder, type PlaceOrderInput } from "@/server/orders/place";
import { normalizeCameroonMsisdn } from "@/server/payments/phone";
import * as paymentSettings from "@/server/payments/settings";
import * as whatsapp from "@/server/payments/whatsapp";
import * as rateLimit from "@/server/rate-limit";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

import { orderMessageArgsFor } from "./order-message";

/**
 * CHK-02 — one anonymous submission becomes exactly one order.
 *
 * ===========================================================================
 * THERE IS NO PRICE IN THIS FILE, AND THERE MUST NEVER BE ONE.
 * ===========================================================================
 * The schema below carries a name, a phone number, an address, a note, a
 * channel, an operator and an idempotency key. It carries **no amount and no
 * line items**. That is not an oversight to be helpfully corrected later: a
 * unit price, a line total or a basket in this schema would be a number the
 * browser chose, and every guarantee in the TEN-08 chain — `placeOrder`'s
 * server-side price read, the snapshot columns on `OrderItem`,
 * `tests/isolation/checkout-trust.test.ts` — exists so that no such number can
 * reach an order row. The lines come from Redis, keyed by an opaque cookie id,
 * and every franc is read from `Product`/`ProductVariant` inside
 * `placeOrder`'s transaction. If you find yourself adding a field here to
 * "validate what the customer saw", that is the bug (T-03-59).
 *
 * The message the merchant receives on WhatsApp does quote money, which is why
 * assembling it lives in `./order-message.ts` and reads the committed order —
 * see that module's header.
 *
 * ===========================================================================
 * NOT A `merchantAction`, AND THAT IS THE POINT.
 * ===========================================================================
 * `merchantAction` resolves a tenant from the session. The caller here has no
 * session and no account (CHK-01 is explicit that checkout requires neither),
 * so the tenant arrives as a slug that the PROXY put in the URL and that
 * `resolveTenantBySlug` turns into a live, active organisation or into
 * nothing. Everything downstream runs through `scopedDb(tenant.id)` or takes
 * `tenant.id` as its first argument, so a variant, an order or a settings row
 * belonging to another merchant is not visible to this call at all.
 *
 * ===========================================================================
 * THE MARKUP HIDING A PAYMENT CARD IS A COURTESY. THIS FILE IS THE AUTHORITY.
 * ===========================================================================
 * The payment-path resolver from `@/server/payments/settings` is re-run here
 * and the channel is refused if the merchant cannot accept it, independently
 * of what the checkout page chose to render (T-03-60, RESEARCH.md Open
 * Question 4). The action is reachable by a
 * direct POST from someone who never loaded the page, and a `MANUAL_TRANSFER`
 * order for a merchant with no receiving number is an order whose customer is
 * sent to a payment-instructions page with no destination on it. D-16 gets the
 * same treatment one level down: an operator the merchant did not configure is
 * refused even when the channel itself is available.
 */

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

/**
 * What the checkout form gets back on success.
 *
 * `trackingPath` is the in-app route and `trackingUrl` the absolute link the
 * D-12 block shows on screen and the WhatsApp message carries. Both embed the
 * PLAINTEXT tracking token, which `placeOrder` returns exactly once and which
 * exists nowhere in the database — the column holds its SHA-256 digest, and
 * this file never reads or writes that column (T-03-63).
 *
 * `whatsappUrl` is non-null only on the WhatsApp channel. It is built AFTER
 * the order is committed, which is D-01 by construction: the sale is recorded
 * whether or not the shopper ever opens the conversation.
 */
export type CheckoutOutcome = {
  orderId: string;
  orderNumber: string;
  trackingPath: string;
  trackingUrl: string;
  whatsappUrl: string | null;
};

/** The codebase's `ActionResult` shape — a discriminated union, never a throw. */
export type SubmitCheckoutResult =
  | ({ ok: true } & CheckoutOutcome)
  | { ok: false; error: Record<string, string[]> };

function fail(field: string, message: string): SubmitCheckoutResult {
  return { ok: false, error: { [field]: [message] } };
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Note what is absent: no basket, no amount, no tenant id.
 *
 * `slug` is the ONE identifier the caller supplies, and it is not trusted as
 * an identity — it is resolved against Postgres, fails closed to `null`, and
 * every read below is scoped by the id that resolution returned.
 */
const submitCheckoutSchema = z.object({
  slug: z.string().min(1).max(64),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(1).max(32),
  deliveryAddress: z.string().trim().max(500).nullable(),
  customerNote: z.string().trim().max(500).nullable(),
  channel: z.enum(OrderChannel),
  /** Only meaningful on `MANUAL_TRANSFER` (D-16). */
  operator: z.enum(PaymentOperator).nullable(),
  /**
   * Minted once per checkout-page MOUNT, never per submit (Pattern 7b). A key
   * regenerated on each attempt would make every retry look like a new order,
   * which is precisely the failure this field exists to prevent.
   */
  idempotencyKey: z.string().min(8).max(128),
});

// ---------------------------------------------------------------------------
// The idempotency value
// ---------------------------------------------------------------------------

/**
 * `idem:{key}` holds `{orderId}.{trackingToken}`, and the second half is why.
 *
 * A repeat submit must be able to hand the shopper THEIR ORDER LINK — that is
 * the entire point of surviving a double tap on a slow network. The link
 * embeds the plaintext tracking token, and the plaintext exists exactly once,
 * in `placeOrder`'s return value: the `Order` row stores only its digest, so
 * there is nothing to look it up from. Storing the id alone would let the
 * second submit avoid a duplicate order and then strand the person holding the
 * phone on a screen with no link, which is the worse half of the bug.
 *
 * The exposure this adds is bounded and deliberate: the value lives in Redis
 * for 600 seconds under a key that is a UUID only that browser has ever seen,
 * it is never logged, and the database still holds nothing but the hash. The
 * separator is `.` because a tracking token is base64url (`A-Za-z0-9_-`) and a
 * cuid is alphanumeric, so neither half can contain one.
 */
function packOutcome(orderId: string, trackingToken: string): string {
  return `${orderId}.${trackingToken}`;
}

function unpackOutcome(
  value: string,
): { orderId: string; trackingToken: string } | null {
  const separator = value.indexOf(".");
  if (separator <= 0 || separator === value.length - 1) return null;

  return {
    orderId: value.slice(0, separator),
    trackingToken: value.slice(separator + 1),
  };
}

// ---------------------------------------------------------------------------
// Outcome construction
// ---------------------------------------------------------------------------

/**
 * The storefront's public origin, `http` only for a localhost root domain.
 *
 * The tracking link is read by a human out of a WhatsApp message, so it has to
 * be the address the shopper's browser can actually reach — the subdomain the
 * proxy rewrites, not the internal `/s/{slug}` path, which the proxy answers
 * with a hard 404 when it is requested directly.
 */
function storeOriginFor(slug: string): string {
  const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN;
  const protocol = rootDomain.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${slug}.${rootDomain}`;
}

async function buildOutcome(args: {
  tenantId: string;
  slug: string;
  storeName: string;
  channel: OrderChannel;
  merchantWhatsappNumber: string | null;
  orderId: string;
  orderNumber: string;
  trackingToken: string;
}): Promise<SubmitCheckoutResult> {
  // `trackingPath` is browser-visible: `checkout-form.tsx` renders it as the
  // post-order confirmation CTA's href, and on the Mobile-Money and
  // Cash-on-Delivery paths there is no `whatsappUrl`, so it is the shopper's
  // ONLY route to the page holding the payment instructions. It therefore takes
  // the same origin-relative form as every other storefront link — the proxy
  // supplies the `/s/{slug}` prefix from the `Host` header and hard-404s it when
  // a browser asks for it directly (TEN-03/DOM-02). This is the same rule the
  // doc comment on `storeOriginFor` above already states. Quick task 260901-00j.
  //
  // Contrast the `revalidatePath("/s/{slug}", "layout")` call in
  // `src/server/cart/actions.ts`: that one addresses the Next.js route tree
  // rather than the browser, so it keeps the internal prefix and must not be
  // "fixed" to match this line. This module had such a call too until quick
  // task 260901-6wq deleted it — see the block after `clearStoredCart` below
  // for why it can never come back here.
  const trackingPath = `/order/${args.trackingToken}`;
  const trackingUrl = `${storeOriginFor(args.slug)}/order/${args.trackingToken}`;

  let whatsappUrl: string | null = null;

  if (args.channel === "WHATSAPP" && args.merchantWhatsappNumber) {
    const message = whatsapp.buildOrderMessage(
      await orderMessageArgsFor({
        tenantId: args.tenantId,
        orderId: args.orderId,
        storeName: args.storeName,
        orderNumber: args.orderNumber,
        trackingUrl,
      }),
    );

    whatsappUrl = whatsapp.buildWhatsAppOrderLink(
      args.merchantWhatsappNumber,
      message,
    );
  }

  return {
    ok: true,
    orderId: args.orderId,
    orderNumber: args.orderNumber,
    trackingPath,
    trackingUrl,
    whatsappUrl,
  };
}

// ---------------------------------------------------------------------------
// The action
// ---------------------------------------------------------------------------

/**
 * Place one order for an anonymous shopper.
 *
 * Never throws for an expected refusal — every one of them is a
 * `{ ok: false, error }` the form can render against a field. An unexpected
 * error is deliberately NOT caught: it must stay visible in the logs rather
 * than becoming a polite sentence that hides a broken store.
 */
export async function submitCheckout(
  input: unknown,
): Promise<SubmitCheckoutResult> {
  // 1. Rate limit FIRST, before any database read. Each success writes an
  //    order and decrements stock, so an unthrottled flood is an
  //    inventory-denial attack, not noise (T-03-62). The limiter fails open on
  //    an Upstash outage: a blip degrades throttling, never checkout.
  const verdict = await rateLimit.orderPlacementLimiter.limit(
    rateLimit.callerIp(await headers()),
  );
  if (!verdict.success) {
    return fail("form", strings.checkout.errorRateLimited);
  }

  const parsed = submitCheckoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return {
      ok: false,
      error:
        Object.keys(fieldErrors).length > 0
          ? (fieldErrors as Record<string, string[]>)
          : { form: [strings.checkout.genericError] },
    };
  }

  const {
    slug,
    customerName,
    customerPhone,
    deliveryAddress,
    customerNote,
    channel,
    operator,
    idempotencyKey,
  } = parsed.data;

  // 2. The tenant. Fails closed — unknown, suspended and non-existent are one
  //    outcome, and an anonymous caller must not be able to tell them apart.
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return fail("form", strings.checkout.errorStoreUnavailable);

  /*
   * The merchant's payment destinations, read once and used twice: to refuse a
   * channel below, and to address the WhatsApp handoff. Hoisted above the
   * idempotency recall because a REPEAT submit has to rebuild the same
   * outcome, wa.me link included, and that link needs the merchant's number.
   */
  const settings = await paymentSettings.getPaymentSettings(tenant.id);
  const paths = paymentSettings.resolvePaymentPaths(settings);

  // 3. Has this exact submission already produced an order? A double tap on a
  //    slow connection is the normal case here, not the attack (T-03-61).
  const recalled = await idempotency.recallOrderForKey(idempotencyKey);
  if (recalled) {
    const previous = unpackOutcome(recalled);

    // Scoped lookup, so a key carrying another tenant's order id resolves to
    // nothing rather than to that order.
    const existing = previous
      ? await scopedDb(tenant.id).order.findUnique({
          where: { id: previous.orderId },
          select: { orderNumber: true, channel: true },
        })
      : null;

    if (previous && existing) {
      return buildOutcome({
        tenantId: tenant.id,
        slug: tenant.slug,
        storeName: tenant.name,
        // The COMMITTED channel, not the resubmitted one: the order is what it
        // is, and a second submit naming a different channel must not be able
        // to describe it differently.
        channel: existing.channel,
        merchantWhatsappNumber: settings?.whatsappNumber ?? null,
        orderId: previous.orderId,
        orderNumber: existing.orderNumber,
        trackingToken: previous.trackingToken,
      });
    }
    // A key with no order behind it — an expired or malformed value — falls
    // through and places, because refusing here would strand a real shopper.
  }

  // 4. The basket. Ids and quantities, read from Redis under an opaque cookie
  //    id, never from the payload.
  const jar = await cookies();
  const cartId = jar.get(cartCache.CART_COOKIE_NAME)?.value;
  if (!cartId) return fail("form", strings.checkout.errorEmptyCart);

  const stored = await cartCache.readStoredCart(cartId);

  if (stored && stored.tenantId !== tenant.id) {
    // Logged rather than reported: the shopper reads the same sentence an
    // empty basket produces, because telling the two apart would answer a
    // question only someone probing would ask (T-03-64).
    console.warn(
      `[checkout] cart/tenant mismatch: a cart stored for another tenant was ` +
        `presented to ${tenant.slug}. Refusing.`,
    );
  }

  const cart = cartCache.cartForTenant(stored, tenant.id);
  if (!cart || cart.items.length === 0) {
    return fail("form", strings.checkout.errorEmptyCart);
  }

  // 5. Refuse a channel this merchant cannot accept, whatever the markup did.
  const channelIsOffered =
    channel === "WHATSAPP"
      ? paths.whatsapp
      : channel === "MANUAL_TRANSFER"
        ? paths.manualTransfer
        : paths.cod;

  if (!channelIsOffered) {
    return fail("channel", strings.checkout.errorPathUnavailable);
  }

  if (
    channel === "MANUAL_TRANSFER" &&
    (operator === null || !paths.operators.includes(operator))
  ) {
    return fail("operator", strings.checkout.errorOperatorUnavailable);
  }

  // 6. The phone number is how the merchant reaches this customer at all, so a
  //    value that is not a Cameroon mobile number is a field error, not a
  //    best-effort save.
  const msisdn = normalizeCameroonMsisdn(customerPhone);
  if (!msisdn) {
    return fail("customerPhone", strings.checkout.errorPhoneFormat);
  }

  const address = deliveryAddress && deliveryAddress.length > 0 ? deliveryAddress : null;

  // Required only on the path that needs it — B4 is explicit that the
  // requirement appears WITH the selection rather than sitting greyed out.
  if (channel === "CASH_ON_DELIVERY" && address === null) {
    return fail("deliveryAddress", strings.checkout.errorAddressRequired);
  }

  /*
   * The compile-time half of TEN-08: `PlaceOrderInput` declares no price
   * field, so there is no property for a forged amount to arrive in and no
   * comparison that could later grow a tolerance. `cart.items` is carried
   * across unchanged — ids and quantities, exactly as stored.
   */
  const placementInput: PlaceOrderInput = {
    channel,
    customerName,
    customerPhone: msisdn,
    deliveryAddress: address,
    customerNote:
      customerNote && customerNote.length > 0 ? customerNote : null,
    items: cart.items,
  };

  // 7. One transaction: the stock hold, the order, the lines and the genesis
  //    event. On MANUAL_TRANSFER it also takes the D-02 hop to
  //    PAYMENT_PENDING through `transitionOrder`.
  let placed;
  try {
    placed = await placeOrder(tenant.id, placementInput);
  } catch (error) {
    // The basket is deliberately LEFT INTACT on both of these: the shopper's
    // next move is to open the cart and adjust it, and a cleared cart would
    // take that away at the exact moment they need it.
    if (error instanceof OutOfStockError) {
      return fail("form", strings.checkout.errorOutOfStock);
    }
    if (error instanceof UnavailableItemError) {
      return fail("form", strings.checkout.errorItemUnavailable);
    }
    throw error;
  }

  // 8. Claim the key, then drop the basket. In this order: a claim that failed
  //    after the cart was already gone would leave a repeat submit with
  //    neither an order to recall nor a basket to place.
  await idempotency.rememberOrderForKey(
    idempotencyKey,
    packOutcome(placed.orderId, placed.trackingToken),
  );
  await cartCache.clearStoredCart(cartId);

  // =========================================================================
  // NOTHING IS REVALIDATED HERE, AND THAT ABSENCE IS THE FIX (260901-6wq).
  // =========================================================================
  // This is where `revalidatePath("/s/{slug}", "layout")` used to sit, one
  // line below the call that empties the basket. It was not a stale-cache
  // nicety — it was a bug that lost the confirmation screen on 100% of
  // orders, on all three channels.
  //
  // WHAT IT DID. A cache-invalidation call inside a Server Action makes Next
  // re-render the route the shopper is CURRENTLY ON as part of this same
  // action response. That route is `/checkout`, and
  // `src/app/s/[slug]/checkout/page.tsx` opens with
  // `if (payable.length === 0) redirect("/cart")`. The basket is empty at
  // that instant precisely BECAUSE this order just succeeded, so the guard
  // fired, and a server-issued redirect beats the client's
  // `setOutcome(result)` in `checkout-form.tsx`. The shopper was bounced to
  // "Your cart is empty" and never saw their order number, their D-12
  // tracking link (the ONLY route back to their order — there is no account,
  // and the plaintext token is stored nowhere) or, on MANUAL_TRANSFER, their
  // payment instructions. The order row, the stock hold and the audit trail
  // all existed; only the screen proving it did not.
  //
  // SCOPING THE PATH NARROWER DOES NOT HELP. DO NOT TRY IT. The obvious fix
  // — "revalidate the storefront root, the PDP and the cart page instead, so
  // the open route is not a target" — cannot work, and this is read from the
  // installed package rather than inferred:
  //   · node_modules/next/dist/server/web/spec-extension/revalidate.js carries
  //     Next's own `// TODO: only revalidate if the path matches` directly
  //     above the line that sets `store.pathWasRevalidated`. Path matching is
  //     not implemented. ANY path, ANY type, sets the flag.
  //   · node_modules/next/dist/server/app-render/action-handler.js derives
  //     `skipPageRendering` from that flag alone; the requested path is never
  //     consulted. So every revalidating action re-renders the current page.
  // The same flag is set by `refresh()` (Next 16) and by writing a cookie
  // from the action, so a "just placed an order" signal read by the page
  // would itself force the re-render it was meant to survive. Reordering is
  // no escape either: revalidations run after the action body returns.
  //
  // THE HEADER BUBBLE DOES NOT NEED IT. `StoreHeader` is rendered by each
  // storefront `page.tsx`, not by `src/app/s/[slug]/layout.tsx`, so the
  // "layout" scope was never buying it anything. Every one of those pages is
  // dynamic (`getCurrentCart` awaits `cookies()`), so each navigation re-reads
  // the cart from Redis; and the client Router Cache's `staleTimes.dynamic`
  // default has been 0s since Next 15, so no <Link> navigation serves a stale
  // count. Accepted cost: browser back/forward restores from that cache
  // regardless, so the pre-order basket may flash on Back and the bubble on
  // the confirmation screen itself keeps its pre-order count. Both self-heal
  // on the next click, and both are strictly better than losing the
  // confirmation.
  //
  // `src/server/cart/actions.ts` KEEPS ITS OWN `revalidatePath` ON PURPOSE.
  // Do not "make them consistent". After add-to-cart the shopper stays on the
  // product page and the bubble must change in place — there the re-render is
  // the feature, and no page on that path has a redirect guard. Same API,
  // opposite consequence.
  //
  // Verified against Next 16.3.1. If a future Next implements that TODO, the
  // premise changes and this may be revisitable — deliberately, by reading
  // `tests/unit/checkout-revalidation-race.test.ts`, which fails the build if
  // `revalidatePath`, `revalidateTag`, `updateTag` or `refresh` returns to
  // this module. Never delete that guard just to make a build pass, and never
  // weaken the empty-cart guard in `checkout/page.tsx` instead: it is correct
  // for the case it was written for (arriving at checkout with nothing to
  // buy).

  // 9. The outcome, built from a committed order. D-01 holds by construction:
  //    the row and its tracking token already exist by the time a wa.me link
  //    is handed back, so the sale is recorded whether or not WhatsApp opens.
  return buildOutcome({
    tenantId: tenant.id,
    slug: tenant.slug,
    storeName: tenant.name,
    channel,
    merchantWhatsappNumber: settings?.whatsappNumber ?? null,
    orderId: placed.orderId,
    orderNumber: placed.orderNumber,
    trackingToken: placed.trackingToken,
  });
}
