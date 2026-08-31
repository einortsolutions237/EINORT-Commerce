import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { env } from "@/env";
import { strings } from "@/lib/strings";
import { publicUrlFor } from "@/server/images/r2";
// Aliased at the import so the resolver's name appears once in this file, at
// the point it is used — the same convention the catalog page uses for its
// product query, and here it doubles as the audit anchor for D-12: one call,
// one `notFound()`, no second way into an order.
import { findOrderByTrackingToken as findOrder } from "@/server/orders/tracking";
import {
  getPaymentSettings,
  resolvePaymentPaths,
} from "@/server/payments/settings";
import {
  buildOrderMessage,
  buildWhatsAppOrderLink,
  formatXaf,
} from "@/server/payments/whatsapp";
import { callerIp, orderTrackingLimiter as trackingLimiter } from "@/server/rate-limit";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

import { CopyField } from "./copy-field";
import { PaymentInstructions } from "./payment-instructions";
import { StatusBlock } from "./status-block";

/**
 * D-12 / CHK-05 — the customer's whole view of their own order.
 *
 * ---------------------------------------------------------------------------
 * THE LINK IS THE ACCESS CONTROL, SO THE 404 IS THE SECURITY BOUNDARY.
 * ---------------------------------------------------------------------------
 * Checkout is accountless. There is no session, no phone-plus-order-number
 * form, and no "is this you?" step — whoever holds the link holds the order.
 * Every way of not holding a valid link therefore has to look the same from
 * outside: a malformed token, an unknown token, a token that belongs to another
 * store, and a rate-limited caller all reach the same `notFound()` and render
 * the same branded 404. The resolver in `src/server/orders/tracking.ts`
 * collapses the first three into one `null` before this file sees them,
 * precisely so this file has no opportunity to branch on the difference.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE REALISTIC LEAK ACTUALLY IS.
 * ---------------------------------------------------------------------------
 * Not brute force — the token is 192 bits and walking it is not a thing anyone
 * can do. The leak is mundane: a search engine crawling a link somebody pasted
 * into a public group, or a referrer header carrying the token to whichever
 * site the customer clicks to next. Both are closed below, and both are closed
 * in `metadata` rather than in a header rule so they live in the same file as
 * the page they protect and cannot be dropped by an unrelated config edit.
 *
 * The residual — the token in the hosting provider's request logs, because it
 * is a path segment — is stated and accepted in `src/server/orders/tracking.ts`.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PAGE DELIBERATELY DOES NOT DO.
 * ---------------------------------------------------------------------------
 * It renders the payment instructions but NOT the `I've paid` CTA or the claim
 * form. Plan 03-15 owns the whole claim submission flow, and a button here that
 * went nowhere would be worse than the gap — the customer would tap it, nothing
 * would happen, and they would conclude the store cannot take their money.
 */

export const metadata: Metadata = {
  /*
   * T-03-71, both halves.
   *
   * `index: false, follow: false` — a tracking link pasted into a public
   * WhatsApp group or a forum is the realistic path to a crawler, and an
   * indexed order page is a stranger's name, phone and total in a search
   * result.
   *
   * `referrer: "no-referrer"` — the token is a path segment, so the default
   * policy would hand it to whatever site the customer visits next as an
   * ordinary Referer header. This emits the document-level policy, which is
   * the mechanism a page (as opposed to a config-level header rule) actually
   * has; it applies to every request the document makes.
   *
   * No `title` on purpose: the page title lands in browser history and in
   * screenshots, and it would carry the order number for no benefit — the
   * order number is already the first thing on the page.
   */
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** The link the customer is standing on, rebuilt so it can be copied again. */
function trackingUrlFor(slug: string, token: string): string {
  const domain = env.NEXT_PUBLIC_ROOT_DOMAIN;
  const protocol = domain.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${slug}.${domain}/order/${token}`;
}

export default async function OrderTrackingPage({
  params,
}: PageProps<"/s/[slug]/order/[token]">) {
  const { slug, token } = await params;
  const requestHeaders = await headers();

  /*
   * 60 per minute per IP. It is not a security boundary — the token space is
   * not walkable — it is there so one scripted client cannot turn a refresh
   * loop into database load. A blocked caller gets the same `notFound()` as a
   * bad token, because a distinguishable "slow down" page would be one more
   * thing whose presence says something about the token that produced it.
   *
   * The limiter fails OPEN when Upstash is unconfigured or unreachable (it
   * warns loudly instead), so an infrastructure blip can never be the reason a
   * customer cannot see the order they paid for.
   */
  const { success } = await trackingLimiter.limit(callerIp(requestHeaders));
  if (!success) notFound();

  const tenant = await resolveTenantBySlug(slug);
  // Unreachable in practice — the storefront layout gates this subtree — but
  // the check is what makes the tenant a non-null value rather than a promise
  // someone kept.
  if (!tenant) notFound();

  const order = await findOrder(tenant.id, token);
  if (!order) notFound();

  const settings = await getPaymentSettings(tenant.id);
  const paths = resolvePaymentPaths(settings);

  const claim = order.claims[0] ?? null;
  const totalLabel = formatXaf(order.totalXaf);
  const trackingUrl = trackingUrlFor(slug, token);

  /*
   * D-01's link, rebuilt from the merchant's stored number rather than kept
   * from checkout — the customer may be opening this page days later on a
   * different device, and the conversation they need is the one with the
   * seller, not a stale URL.
   *
   * `buildWhatsAppOrderLink` throws on a number that is not in storage form.
   * That is correct for a builder and wrong for a page, so the shape is checked
   * here and a merchant with a broken number simply gets no button instead of a
   * customer getting a 500 on the page that tells them where their order is.
   */
  const whatsappNumber = settings?.whatsappNumber ?? null;
  const whatsappHref =
    whatsappNumber !== null && /^237[0-9]{9}$/.test(whatsappNumber)
      ? buildWhatsAppOrderLink(
          whatsappNumber,
          buildOrderMessage({
            storeName: tenant.name,
            orderNumber: order.orderNumber,
            trackingUrl,
            lines: order.items.map((item) => ({
              quantity: item.quantity,
              name: item.productName,
              amountXaf: item.lineTotalXaf,
            })),
            totalXaf: order.totalXaf,
          }),
        )
      : null;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-12 px-8 py-16">
      {/* Label/uppercase eyebrow — the order number, and nothing above it. */}
      <p className="text-sm leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {strings.orderStatus.orderNumberEyebrow.replace(
          "{orderNumber}",
          order.orderNumber,
        )}
      </p>

      {/*
       * Always rendered, for every one of the six states — CHK-05's absolute
       * requirement, held by a map that cannot compile with a row missing.
       */}
      <StatusBlock
        state={order.state}
        channel={order.channel}
        storeName={tenant.name}
        amount={totalLabel}
      />

      {/* --- The state's action region (B7's rightmost column) ------------- */}

      {order.state === "ORDER_PLACED" &&
      order.channel === "WHATSAPP" &&
      whatsappHref !== null ? (
        <Button
          variant="outline"
          className="min-h-12 w-full"
          render={<a href={whatsappHref} />}
        >
          {strings.orderStatus.openWhatsappAgain}
        </Button>
      ) : null}

      {/*
       * B5. Gated on the merchant having a receiving number rather than on the
       * state alone: a merchant who cleared their numbers after the order was
       * placed would otherwise get a heading telling the customer to send money
       * to nobody. The status block above still says what is owed and to whom,
       * so the page stays explicit either way.
       */}
      {order.state === "PAYMENT_PENDING" &&
      settings !== null &&
      paths.manualTransfer ? (
        <PaymentInstructions
          storeName={tenant.name}
          amountXaf={order.totalXaf}
          settings={settings}
          userAgent={requestHeaders.get("user-agent") ?? ""}
        />
      ) : null}

      {/*
       * A read-only recap, with NO resubmit affordance. A claim that is still
       * being checked is not a problem yet, and a second submit button beside
       * it invites a duplicate reference — which ORD-04 rejects at a unique
       * index and which reads, to the customer, as their payment being refused.
       */}
      {order.state === "PAYMENT_CLAIMED" && claim !== null ? (
        <section className="flex flex-col gap-4 rounded border border-border p-6">
          <h2 className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
            {strings.orderStatus.claimSummaryHeading}
          </h2>

          <p className="text-base leading-[1.6] font-normal text-foreground">
            {claim.operator === "MTN_MOMO"
              ? strings.checkout.operatorMtn
              : strings.checkout.operatorOrange}
          </p>

          <div className="flex flex-col gap-1">
            <span className="text-sm leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {strings.orderStatus.claimReferenceLabel}
            </span>
            <span className="font-mono text-base leading-[1.6] font-normal text-foreground select-all">
              {claim.reference}
            </span>
          </div>

          {claim.screenshotKey !== null ? (
            /*
             * 96px, the claim-screenshot thumb dimension from the spacing
             * table. `alt=""` deliberately: this is the customer's own photo,
             * already named by the heading above it, and any alt text this
             * component could write would be a guess about a picture it has
             * never seen.
             */
            <Image
              src={publicUrlFor(`${claim.screenshotKey}/full.webp`)}
              alt=""
              width={96}
              height={96}
              className="size-24 rounded border border-border object-cover"
            />
          ) : null}
        </section>
      ) : null}

      {/*
       * D-11 — a dispute is RECOVERABLE, and the merchant's own words are the
       * only thing that tells the customer which detail to fix. Quoted verbatim
       * rather than summarised: a paraphrase of "the reference was 8 digits,
       * not 10" is useless to the person holding the SMS.
       */}
      {order.state === "DISPUTED" ? (
        <section className="flex flex-col gap-3 rounded border border-destructive p-6">
          {claim?.rejectionReason ? (
            <blockquote className="text-base leading-[1.6] font-normal text-foreground">
              {claim.rejectionReason}
            </blockquote>
          ) : null}
          <p className="text-base leading-[1.6] font-normal text-muted-foreground">
            {strings.orderStatus.disputedInstruction}
          </p>
        </section>
      ) : null}

      {/* --- Line items and total ----------------------------------------- */}

      <section className="flex flex-col gap-4">
        <ul className="flex flex-col gap-4">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-base leading-[1.6] font-normal text-foreground">
                  {item.productName}
                </span>
                {item.variantLabel !== null ? (
                  <span className="text-base leading-[1.6] font-normal text-muted-foreground">
                    {item.variantLabel}
                  </span>
                ) : null}
                {/*
                 * A format pattern rather than surface copy — it is a price, a
                 * multiplication sign and a count, with no words in it — so it
                 * is read from the one place that pattern is written instead of
                 * being duplicated into a second namespace where the two could
                 * drift apart.
                 */}
                <span className="text-base leading-[1.6] font-normal tabular-nums text-muted-foreground">
                  {strings.orders.itemUnitTimesQuantity
                    .replace("{price}", formatXaf(item.unitPriceXaf))
                    .replace("{qty}", String(item.quantity))}
                </span>
              </div>
              <span className="shrink-0 text-base leading-[1.6] font-semibold tabular-nums text-foreground">
                {formatXaf(item.lineTotalXaf)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <span className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
            {strings.cart.total}
          </span>
          <span className="text-2xl leading-tight font-semibold tracking-tight tabular-nums text-foreground">
            {totalLabel}
          </span>
        </div>
      </section>

      {/*
       * The reminder. This link is the only route back to this order — there is
       * no account to log into and no lookup form — so the page it opens is
       * also the page that has to say so.
       */}
      <section className="flex flex-col gap-2">
        <CopyField
          compact
          label={strings.checkout.trackingHeading}
          value={trackingUrl}
        />
        <p className="text-base leading-[1.6] font-normal text-muted-foreground">
          {strings.checkout.trackingBody}
        </p>
      </section>
    </main>
  );
}
