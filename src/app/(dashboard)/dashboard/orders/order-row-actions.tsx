"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BellRing, ChevronRight, LoaderCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { OrderChannelChip, OrderStateChip } from "@/components/order-state-chip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";
import { strings } from "@/lib/strings";
import type { OrderChannel, OrderState, PaymentOperator } from "@/server/db/enums";
import { confirmOrder, markFulfilled } from "@/server/orders/actions";

/**
 * The A3 list row's status chip AND its inline action, together — 03-UI-SPEC.md
 * § A3's "Inline action" and "Confirm feedback" rows.
 *
 * ---------------------------------------------------------------------------
 * WHY ONE COMPONENT OWNS BOTH PIECES.
 * ---------------------------------------------------------------------------
 * D-02's one-tap confirm is optimistic: the row's STATUS chip swaps the
 * instant the button is tapped, before the server has answered. On the `md`+
 * table those two pieces sit in adjacent cells of the same `<tr>`; on the
 * stacked mobile card the chip is on line 1 and the action is on line 3 (A3's
 * three-line arrangement) — different positions, same shared state, so both
 * layouts are driven by the ONE `useConfirmable` hook below rather than two
 * copies of the optimistic-update logic.
 *
 * `OrderRowActions` is the `md`+ table row (returns a `<TableCell>` pair).
 * `OrderCard` is the sub-`md` stacked card (returns the whole three-line
 * block, because the chip and the action cannot be split across two
 * components without lifting the state to a parent that would then just be a
 * third copy of this file). `page.tsx` still renders `OrderStateChip` and
 * `OrderChannelChip` directly wherever no confirm affordance exists, so
 * neither chip has more than one implementation.
 *
 * ---------------------------------------------------------------------------
 * WHAT "OPTIMISTIC" MEANS HERE, PRECISELY.
 * ---------------------------------------------------------------------------
 * `optimisticState` is set to `"CONFIRMED"` BEFORE `confirmOrder` is awaited,
 * not after — a true optimistic update, not a same-tick re-render dressed up
 * as one. On failure it reverts to the server-supplied `state` prop and shows
 * a destructive `alert` (never a toast alone, per 03-UI-SPEC.md § Interaction
 * & State Contract). `router.refresh()` is deliberately NOT called on
 * success: a full refetch would replace this row's local optimistic state
 * with the next server render anyway, and the whole point of the optimism was
 * to skip waiting on that round trip.
 */

interface ConfirmableOrder {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly channel: OrderChannel;
  readonly state: OrderState;
}

function useConfirmable({ orderId, orderNumber, channel, state }: ConfirmableOrder) {
  const [optimisticState, setOptimisticState] = useState<OrderState>(state);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canOneTapConfirm =
    optimisticState === "ORDER_PLACED" && channel !== "MANUAL_TRANSFER";
  const needsClaimReview = optimisticState === "PAYMENT_CLAIMED";

  async function handleConfirm() {
    setError(null);
    setPending(true);
    // Swap FIRST, await SECOND — see the header for why this is what makes
    // the update optimistic rather than merely fast.
    setOptimisticState("CONFIRMED");

    const result = await confirmOrder({ orderId });

    setPending(false);

    if (result.ok) {
      toast.success(strings.orders.confirmedToast.replace("{n}", orderNumber));
      return;
    }

    // Revert. The row goes back to exactly what the server last told it.
    setOptimisticState(state);
    setError(result.error.form?.[0] ?? strings.orders.genericError);
  }

  const chip = <OrderStateChip channel={channel} state={optimisticState} />;

  let action: React.ReactNode;
  if (canOneTapConfirm) {
    action = (
      <Button
        type="button"
        size="sm"
        className="min-h-11"
        disabled={pending}
        onClick={() => {
          void handleConfirm();
        }}
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        {strings.orders.confirmOrder}
      </Button>
    );
  } else if (needsClaimReview) {
    action = (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        render={<Link href="/dashboard/claims" />}
      >
        <BellRing aria-hidden="true" />
        {strings.orders.reviewClaim}
      </Button>
    );
  } else {
    action = (
      <Link
        href={`/dashboard/orders/${orderId}`}
        aria-label={strings.orders.viewOrder.replace("{n}", orderNumber)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronRight aria-hidden="true" />
      </Link>
    );
  }

  const errorAlert =
    error === null ? null : (
      <Alert variant="destructive">
        <TriangleAlert aria-hidden="true" />
        <AlertDescription className="text-destructive">
          {error}
        </AlertDescription>
      </Alert>
    );

  return { chip, action, errorAlert };
}

export function OrderRowActions(props: ConfirmableOrder) {
  const { chip, action, errorAlert } = useConfirmable(props);

  return (
    <>
      <TableCell>{chip}</TableCell>
      <TableCell>
        <div className="flex flex-col items-end gap-2">
          {action}
          {errorAlert}
        </div>
      </TableCell>
    </>
  );
}

export interface OrderCardProps extends ConfirmableOrder {
  readonly customerName: string;
  readonly customerPhone: string;
  readonly totalFormatted: string;
  readonly placedAtRelative: string;
  readonly operator: PaymentOperator | null;
}

/** The sub-`md` stacked card — A3's three-line arrangement, self-contained. */
export function OrderCard({
  orderId,
  orderNumber,
  channel,
  state,
  customerName,
  customerPhone,
  totalFormatted,
  placedAtRelative,
  operator,
}: OrderCardProps) {
  const { chip, action, errorAlert } = useConfirmable({
    orderId,
    orderNumber,
    channel,
    state,
  });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/dashboard/orders/${orderId}`}
          className="font-mono text-sm leading-normal font-semibold text-foreground"
        >
          {orderNumber}
        </Link>
        {chip}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-base leading-normal font-normal text-foreground">
            {customerName}
          </span>
          <span className="text-sm leading-normal font-normal text-muted-foreground">
            {customerPhone} · {placedAtRelative}
          </span>
        </div>
        <span className="text-base leading-normal font-semibold tabular-nums text-foreground">
          {totalFormatted}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <OrderChannelChip channel={channel} operator={operator} />
        {action}
      </div>
      {errorAlert}
    </div>
  );
}

/**
 * A4's terminal-state action: `Mark as fulfilled` on a `CONFIRMED` order.
 *
 * Unlike the list row above, this one DOES call `router.refresh()` on
 * success — there is no adjacent row to swap in place, and the detail page
 * has more to update than one chip (the terminal action itself disappears
 * once the order is `FULFILLED`, and the `Order history` card grows a row).
 * A full server re-render is the correct source of truth here, not an
 * optimistic local guess about a page this dense.
 */
export function MarkFulfilledButton({ orderId }: { readonly orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setPending(true);

    const result = await markFulfilled({ orderId });

    setPending(false);

    if (result.ok) {
      router.refresh();
      return;
    }

    setError(result.error.form?.[0] ?? strings.orders.genericError);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        className="min-h-11 w-full sm:w-fit"
        disabled={pending}
        onClick={() => {
          void handleClick();
        }}
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        {strings.orders.markFulfilled}
      </Button>
      {error === null ? null : (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
