import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";

import { OrderChannelChip, STATE_CHIPS } from "@/components/order-state-chip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { strings } from "@/lib/strings";
import { requireMerchantContext } from "@/server/merchant/context";
import { getOrderDetail } from "@/server/orders/queries";
import { publicUrlFor } from "@/server/images/r2";

import { formatAbsoluteTime, formatXaf } from "../format";
import { MarkFulfilledButton } from "../order-row-actions";

/**
 * `/dashboard/orders/[id]` (03-UI-SPEC.md § A4, ORD-05).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF, AND `getOrderDetail`'S `null` IS T-03-53'S
 * WHOLE CROSS-TENANT DEFENCE.
 * ---------------------------------------------------------------------------
 * `getOrderDetail` returns `null` both when the id does not exist AND when it
 * belongs to another tenant — `scopedDb` turns a foreign id into a miss
 * rather than a read, so there is nothing here for a tenant check to add.
 * `notFound()` renders the same 404 either way, which is deliberate: telling
 * a merchant "that order belongs to someone else" would be an existence
 * oracle over another tenant's order ids.
 *
 * ---------------------------------------------------------------------------
 * NO RAW `EventActor` EVER REACHES THIS FILE.
 * ---------------------------------------------------------------------------
 * `getOrderDetail` already converted `actor` to the presentational
 * `actorKind` ("self" | "customer" | "automatic") before this component ever
 * sees an event — see that function's own header for why the mapping lives
 * there and not here. This page only ever branches on `actorKind`.
 */

export const metadata: Metadata = {
  title: strings.orders.heading,
};

export default async function OrderDetailPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const ctx = await requireMerchantContext();
  const { id } = await params;
  const order = await getOrderDetail(ctx.tenantId, id);

  if (!order) notFound();

  const operator = order.claims[0]?.operator ?? null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-sm leading-normal font-semibold text-muted-foreground">
          {order.orderNumber}
        </span>
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight tabular-nums text-foreground">
          {formatXaf(order.totalXaf)}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column: what was bought. */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{strings.orders.itemsCardTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  {item.imageKey ? (
                    // R2 is not registered in next.config's image
                    // remotePatterns, and a plain <img> avoids taking on that
                    // config surface for a single 64px thumbnail already
                    // served pre-sized by 03-05's Sharp pipeline.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={publicUrlFor(item.imageKey)}
                      alt=""
                      className="size-16 shrink-0 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div className="flex size-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                      <Package
                        aria-hidden="true"
                        className="size-5 text-muted-foreground"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm leading-normal font-semibold text-foreground">
                      {item.productName}
                    </span>
                    {item.variantLabel ? (
                      <span className="text-sm leading-normal font-normal text-muted-foreground">
                        {item.variantLabel}
                      </span>
                    ) : null}
                    <span className="text-sm leading-normal font-normal tabular-nums text-muted-foreground">
                      {strings.orders.itemUnitTimesQuantity
                        .replace("{price}", formatXaf(item.unitPriceXaf))
                        .replace("{qty}", String(item.quantity))}
                    </span>
                  </div>
                  <span className="text-sm leading-normal font-semibold tabular-nums text-foreground">
                    {formatXaf(item.lineTotalXaf)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm leading-normal font-semibold text-foreground">
                  {strings.orders.subtotal}
                </span>
                <span className="text-sm leading-normal font-normal tabular-nums text-foreground">
                  {formatXaf(order.subtotalXaf)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
                  {strings.orders.total}
                </span>
                <span className="font-heading text-2xl leading-tight font-semibold tracking-tight tabular-nums text-foreground">
                  {formatXaf(order.totalXaf)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: who it is for, how it arrived, and its history. */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{strings.orders.customerCardTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <span className="text-base leading-normal font-normal text-foreground">
                {order.customerName}
              </span>
              <a
                href={`tel:${order.customerPhone}`}
                className="w-fit text-base leading-normal font-normal text-foreground underline underline-offset-3"
              >
                {order.customerPhone}
              </a>
              {order.deliveryAddress ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm leading-normal font-semibold text-foreground">
                    {strings.orders.addressLabel}
                  </span>
                  <span className="text-sm leading-normal font-normal text-muted-foreground">
                    {order.deliveryAddress}
                  </span>
                </div>
              ) : null}
              {order.customerNote ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm leading-normal font-semibold text-foreground">
                    {strings.orders.noteLabel}
                  </span>
                  <span className="text-sm leading-normal font-normal text-muted-foreground">
                    {order.customerNote}
                  </span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{strings.orders.channelCardTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderChannelChip channel={order.channel} operator={operator} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{strings.orders.historyCardTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {order.events.map((event) => {
                const Icon = STATE_CHIPS[event.toState].icon;
                // The genesis row's `toState` is always ORDER_PLACED, but its
                // history-card label reads as `genesisEvent` rather than as
                // that state's ordinary chip label — 03-UI-SPEC.md § A4 names
                // the two labels separately.
                const label =
                  event.fromState === null
                    ? strings.orders.genesisEvent
                    : STATE_CHIPS[event.toState].label;
                const actorLabel =
                  event.actorKind === "self"
                    ? strings.orders.actorMerchant
                    : event.actorKind === "automatic"
                      ? strings.orders.actorSystem
                      : order.customerName;

                return (
                  <div
                    key={event.id}
                    className="flex flex-col gap-1 border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <Icon aria-hidden="true" className="size-4 text-foreground" />
                      <span className="text-sm leading-normal font-semibold text-foreground">
                        {label}
                      </span>
                    </div>
                    <span className="text-sm leading-normal font-normal text-muted-foreground">
                      {actorLabel} · {formatAbsoluteTime(event.createdAt)}
                    </span>
                    {event.reason ? (
                      <p className="rounded-md bg-muted px-3 py-2 text-sm leading-normal font-normal text-foreground">
                        {event.reason}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {order.state === "CONFIRMED" ? (
            <MarkFulfilledButton orderId={order.id} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
