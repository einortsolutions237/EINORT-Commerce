import {
  Banknote,
  CircleCheck,
  Clock,
  MessageCircle,
  PackageCheck,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { strings } from "@/lib/strings";
import type { OrderChannel, OrderState } from "@/server/db/enums";

/**
 * CHK-05 as a table — the one place an order state becomes something a CUSTOMER
 * reads, as opposed to something a merchant reads.
 *
 * ---------------------------------------------------------------------------
 * CHK-05 IS ABSOLUTE, SO THE MAP IS TOTAL.
 * ---------------------------------------------------------------------------
 * "There is no state in which the customer is left uncertain" is not satisfied
 * by covering the states we happen to think of. It is satisfied by a structure
 * in which an uncovered state cannot compile. That is the `satisfies
 * Readonly<Record<OrderState, …>>` below, and it is the whole reason this is a
 * data object rather than a `switch` inside the component: a `switch` with a
 * missing arm is a runtime `undefined`, and a runtime `undefined` on this page
 * is a person who paid money looking at a blank rectangle.
 *
 * `tests/unit/order-status-copy.test.ts` sweeps the same table from the enum's
 * own keys, so the seventh state fails twice — once at `tsc` with a type error
 * and once at test time with a message naming the state and citing CHK-05.
 *
 * ---------------------------------------------------------------------------
 * NO COLOURED CHIP ON THIS SURFACE. THAT IS THE DESIGN, NOT AN OMISSION.
 * ---------------------------------------------------------------------------
 * `src/components/order-state-chip.tsx` exists and does exactly this job for
 * the merchant. It must NOT be reused here. 03-UI-SPEC.md § B. Color leaves the
 * green and gold tokens undeclared for `[data-surface="storefront"]` on
 * purpose, and § B7 asks for an icon, a heading and a hairline instead. Two
 * reasons, both load-bearing: the editorial direction says status is carried by
 * copy on this surface, and a green pill next to a payment a merchant has not
 * verified reads as a guarantee this platform does not make.
 *
 * ---------------------------------------------------------------------------
 * WHY ONE ROW SPLITS BY CHANNEL AND SIX DO NOT.
 * ---------------------------------------------------------------------------
 * `ORDER_PLACED` is the genesis of every channel, and it means two different
 * things depending on which one: a WhatsApp order has been SENT and is waiting
 * on a conversation; a cash-on-delivery order has been RECEIVED and is waiting
 * on a courier. `strings.orderStatus` therefore carries seven headings for six
 * states, and this is where that seventh lands.
 *
 * The other five states each mean one thing. Three of them
 * (`PAYMENT_PENDING`, `PAYMENT_CLAIMED`, `DISPUTED`) are reachable only on
 * `MANUAL_TRANSFER` — D-02, mirrored in `STATES_BY_CHANNEL` and proven against
 * the server state machine by `tests/unit/order-state-chip.test.ts` — so a
 * per-channel split for them would be three rows of copy nobody can ever open.
 */

/** One row of 03-UI-SPEC.md § B7's table, resolved for a real order. */
export interface StatusView {
  /** 24px, drawn in the ink token. The only non-text signal on this block. */
  readonly icon: LucideIcon;
  /** Read from `strings.orderStatus`, never written here. */
  readonly heading: string;
  /** May carry the `{store}` and `{amount}` placeholders. */
  readonly body: string;
}

/**
 * A row that reads the same on every channel, or one that splits across all of
 * them. A `Partial` split is deliberately not permitted: a channel missing from
 * a split is precisely the silent gap CHK-05 forbids.
 */
type StatusEntry = StatusView | Readonly<Record<OrderChannel, StatusView>>;

/**
 * 03-UI-SPEC.md § B7's exhaustive state table, transcribed row for row.
 *
 * `as const satisfies` rather than a plain annotation: `satisfies` is what makes
 * a missing state a compile error, and `as const` keeps the literal shape so
 * `statusViewFor` can tell a split row from a flat one without a discriminator
 * field nobody would remember to set.
 */
export const ORDER_STATUS_VIEW = {
  /**
   * The one row that splits. `MANUAL_TRANSFER` is listed because the map is
   * total by construction, not because a customer can open it: `placeOrder`
   * moves a transfer order to `PAYMENT_PENDING` inside the SAME transaction
   * that creates it, so this pair has no observable moment. It is answered with
   * the money-owed copy rather than left out, because if a future change ever
   * does strand an order here, "send this amount" is the true and useful thing
   * to say to someone who owes money — and a blank block is not.
   */
  ORDER_PLACED: {
    WHATSAPP: {
      icon: MessageCircle,
      heading: strings.orderStatus.placedWhatsappHeading,
      body: strings.orderStatus.placedWhatsappBody,
    },
    CASH_ON_DELIVERY: {
      icon: Truck,
      heading: strings.orderStatus.placedCodHeading,
      body: strings.orderStatus.placedCodBody,
    },
    MANUAL_TRANSFER: {
      icon: Banknote,
      heading: strings.orderStatus.paymentPendingHeading,
      body: strings.orderStatus.paymentPendingBody,
    },
  },
  PAYMENT_PENDING: {
    icon: Banknote,
    heading: strings.orderStatus.paymentPendingHeading,
    body: strings.orderStatus.paymentPendingBody,
  },
  PAYMENT_CLAIMED: {
    icon: Clock,
    heading: strings.orderStatus.paymentClaimedHeading,
    body: strings.orderStatus.paymentClaimedBody,
  },
  CONFIRMED: {
    icon: CircleCheck,
    heading: strings.orderStatus.confirmedHeading,
    body: strings.orderStatus.confirmedBody,
  },
  /**
   * The merchant's own reason is NOT part of this row. It is quoted verbatim by
   * the page's action region (D-11), because it is order data rather than
   * authored copy and must never be paraphrased on its way to the person who
   * has to act on it.
   */
  DISPUTED: {
    icon: TriangleAlert,
    heading: strings.orderStatus.disputedHeading,
    body: strings.orderStatus.disputedBody,
  },
  FULFILLED: {
    icon: PackageCheck,
    heading: strings.orderStatus.fulfilledHeading,
    body: strings.orderStatus.fulfilledBody,
  },
} as const satisfies Readonly<Record<OrderState, StatusEntry>>;

/**
 * The single resolver both the page and its test go through.
 *
 * One function rather than two call sites reading the map directly, so the test
 * cannot pass by resolving copy in a way the page does not. The return type is
 * `StatusView` and never `StatusView | undefined`: an unhandled combination is
 * a typed impossibility here, which is what stops a blank status region from
 * being expressible at all.
 */
export function statusViewFor(
  state: OrderState,
  channel: OrderChannel,
): StatusView {
  const entry: StatusEntry = ORDER_STATUS_VIEW[state];
  return "icon" in entry ? entry : entry[channel];
}

/**
 * `{store}` and `{amount}` filled from server-computed values.
 *
 * Both come from the order row and the tenant, never from anything the visitor
 * supplied — the amount in particular is the server's own total, which is the
 * same number the payment-instructions block tells them to send.
 */
function fill(template: string, storeName: string, amount: string): string {
  return template.replace("{store}", storeName).replace("{amount}", amount);
}

export interface StatusBlockProps {
  readonly state: OrderState;
  readonly channel: OrderChannel;
  /** The tenant's display name. */
  readonly storeName: string;
  /** The order total, already formatted `fr-CM` XAF by the caller. */
  readonly amount: string;
}

/**
 * B7's status block: icon, Display heading, Body explanation, hairline.
 *
 * The heading is the page's `h1` — it is the answer the customer opened the
 * link to get, so it is both the largest thing on the page and the first thing
 * a screen reader reaches.
 */
export function StatusBlock({
  state,
  channel,
  storeName,
  amount,
}: StatusBlockProps) {
  const view = statusViewFor(state, channel);
  const Icon = view.icon;

  return (
    <section className="border-b border-border pb-6">
      <Icon className="size-6 text-foreground" aria-hidden="true" />

      {/* Display role: 36px / 600 / 1.05 / tracking-tight. */}
      <h1 className="mt-4 text-4xl leading-[1.05] font-semibold tracking-tight text-foreground">
        {view.heading}
      </h1>

      {/* Body role: 16px / 400 / 1.6. Never muted — this sentence carries the
          meaning, and § B. Color reserves the muted token for helper text. */}
      <p className="mt-3 text-base leading-[1.6] font-normal text-foreground">
        {fill(view.body, storeName, amount)}
      </p>
    </section>
  );
}
