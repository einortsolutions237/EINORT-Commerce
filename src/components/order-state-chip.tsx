import {
  BellRing,
  Banknote,
  CircleCheck,
  Clock,
  MessageCircle,
  PackageCheck,
  ReceiptText,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { VariantProps } from "class-variance-authority";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { strings } from "@/lib/strings";
import type {
  OrderChannel,
  OrderState,
  PaymentOperator,
} from "@/server/db/enums";

/**
 * The ONE place an order state or a channel becomes something a merchant reads.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A MAP AND NOT A `switch` INSIDE THE COMPONENT.
 * ---------------------------------------------------------------------------
 * 03-UI-SPEC.md § A. Order-State Display Contract gives six rows — label, badge
 * variant, icon — and asks for them "once, never inlined". A `switch` would
 * satisfy the letter of that and lose the two things that make it worth doing:
 *
 *   - `Readonly<Record<OrderState, …>>` makes a seventh enum member a COMPILE
 *     error here, the same discipline `ORDER_TRANSITIONS` and `PLANS` apply. A
 *     `switch` with a `default` would instead render the new state with
 *     whatever the fallback happens to be, which is a status chip that lies.
 *   - A plain data object is importable from the database-free `unit` project,
 *     so `tests/unit/order-state-chip.test.ts` can sweep it against
 *     `canTransition` with no DOM and no Postgres. A rule expressed as a value
 *     is a rule a test can restate; a rule expressed as control flow is not.
 *
 * ---------------------------------------------------------------------------
 * THE GOLD BUDGET: THIS FILE IS THE SECOND AND FINAL SPENDER.
 * ---------------------------------------------------------------------------
 * 03-UI-SPEC.md § A. Color grants `--gold-accent` exactly two uses in the whole
 * phase: the pending-claims count badge on the rail item (the literal
 * `variant="gold"` in `src/components/app-sidebar.tsx`) and the claimed-payment
 * chip below. Gold means *a human needs to look at this now*; a third use makes
 * it decorative, and a merchant who learns gold is decorative stops checking
 * the claims queue. `tests/unit/dashboard-nav.test.ts` counts the spenders
 * across `src/app` and `src/components` and fails the build on a third, so this
 * is a gate rather than a note. The chip's own gold row is the object entry in
 * `STATE_CHIPS` — it reaches `Badge` through `chip.variant`, never as an inline
 * attribute, because there is only ever one renderer.
 *
 * ---------------------------------------------------------------------------
 * COLOUR IS NEVER THE ONLY SIGNAL (WCAG 1.4.1).
 * ---------------------------------------------------------------------------
 * Every chip below renders an icon AND a text label. That is not a stylistic
 * preference: `Confirmed` and `Fulfilled` are the same emerald family one step
 * apart, and `Disputed` is the only red one — a merchant who cannot separate
 * those hues has no other way to read the row.
 *
 * ---------------------------------------------------------------------------
 * EVERY LABEL COMES FROM `strings.orders`. NONE IS TYPED HERE.
 * ---------------------------------------------------------------------------
 * C-14, and 03-UI-SPEC.md § Copywriting Contract names an enum member
 * explicitly as copy that must never ship. The unit test proves both halves: it
 * asserts each label is a value that actually exists in `strings.orders`, and
 * that none of them has the shape of an enum member.
 */

/** The badge variants `src/components/ui/badge.tsx` actually declares. */
type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface StateChip {
  /** Read from `strings.orders`, never written here. */
  readonly label: string;
  readonly variant: BadgeVariant;
  readonly icon: LucideIcon;
}

/**
 * 03-UI-SPEC.md § A. Order-State Display Contract, transcribed row for row.
 *
 * Annotated `Readonly<Record<OrderState, StateChip>>` rather than inferred: the
 * annotation is what makes a missing row a compile error instead of a runtime
 * `undefined` that renders a cell with no status.
 */
export const STATE_CHIPS: Readonly<Record<OrderState, StateChip>> = {
  ORDER_PLACED: {
    label: strings.orders.stateOrderPlaced,
    variant: "outline",
    icon: ReceiptText,
  },
  PAYMENT_PENDING: {
    label: strings.orders.statePaymentPending,
    variant: "secondary",
    icon: Clock,
  },
  PAYMENT_CLAIMED: {
    // The second and last gold in the product. See the header.
    label: strings.orders.statePaymentClaimed,
    variant: "gold",
    icon: BellRing,
  },
  CONFIRMED: {
    label: strings.orders.stateConfirmed,
    variant: "success",
    icon: CircleCheck,
  },
  DISPUTED: {
    label: strings.orders.stateDisputed,
    variant: "destructive",
    icon: TriangleAlert,
  },
  FULFILLED: {
    // Emerald twice by design: filled means confirmed, outlined means settled.
    label: strings.orders.stateFulfilled,
    variant: "outline-success",
    icon: PackageCheck,
  },
};

/**
 * D-02 / D-03 as a display rule — which states an order on `channel` can wear.
 *
 * `as const satisfies` rather than a plain type annotation, and the pair is
 * load-bearing in both directions:
 *
 *   - `satisfies Readonly<Record<OrderChannel, readonly OrderState[]>>` makes a
 *     fourth channel added to `prisma/schema.prisma` a compile error HERE,
 *     and a misspelled state member a compile error too.
 *   - `as const` keeps the literal tuples, which is what lets `OrderStateChip`
 *     narrow its `state` prop per channel below. A bare annotation would widen
 *     every row to `readonly OrderState[]` and the narrowing would silently
 *     become "any of the six", which is exactly the review-catch-instead-of-
 *     type-error that 03-UI-SPEC.md asks to be avoided.
 *
 * This map and `src/server/orders/state-machine.ts` encode the SAME decision
 * twice — one as a display fact, one as a transition fact — so
 * `tests/unit/order-state-chip.test.ts` asserts their agreement by an
 * exhaustive graph walk rather than by inspection. Change the SERVER map first;
 * it is the one that decides what an order may actually do.
 */
export const STATES_BY_CHANNEL = {
  // No in-band payment: the conversation is the negotiation, the merchant
  // confirms it, and it ships. Three states, and a claim state on this row
  // would imply a payment flow that does not exist for it.
  WHATSAPP: ["ORDER_PLACED", "CONFIRMED", "FULFILLED"],
  // Paid at the door. Same three-state life, same reason.
  CASH_ON_DELIVERY: ["ORDER_PLACED", "CONFIRMED", "FULFILLED"],
  // The only channel with an in-band payment, so the only one that can reach
  // the pending / claimed / disputed part of the graph.
  MANUAL_TRANSFER: [
    "ORDER_PLACED",
    "PAYMENT_PENDING",
    "PAYMENT_CLAIMED",
    "CONFIRMED",
    "DISPUTED",
    "FULFILLED",
  ],
} as const satisfies Readonly<Record<OrderChannel, readonly OrderState[]>>;

/** The states `channel` is allowed to display, as a union of literals. */
type StatesFor<C extends OrderChannel> = (typeof STATES_BY_CHANNEL)[C][number];

export interface OrderStateChipProps<C extends OrderChannel> {
  readonly channel: C;
  readonly state: StatesFor<C>;
  readonly className?: string;
}

/**
 * The status chip. Always rendered beside `OrderChannelChip` — the pair is what
 * makes a two-state WhatsApp order legible next to a six-state transfer order.
 *
 * GENERIC ON PURPOSE. At a call site that names a channel literally,
 * `C` binds to that literal and `state` narrows to that channel's three or six
 * — so a hand-written WhatsApp row carrying a claim state does not compile,
 * which is the type error 03-UI-SPEC.md asks for. At a call site holding a
 * value read from the database, `C` widens to `OrderChannel` and every state is
 * accepted, because there is nothing static to check: that combination is
 * constrained by `canTransition` on the server, and the unit test proves the
 * two maps agree, so a row the type system cannot narrow is a row the database
 * cannot produce.
 */
export function OrderStateChip<C extends OrderChannel>({
  channel,
  state,
  className,
}: OrderStateChipProps<C>) {
  // `channel` is not read: it exists to bind `C` and narrow `state`. Naming it
  // in the destructure rather than the signature keeps the prop out of the DOM.
  void channel;

  const chip = STATE_CHIPS[state as OrderState];
  const Icon = chip.icon;

  return (
    <Badge variant={chip.variant} className={className}>
      <Icon aria-hidden="true" />
      {chip.label}
    </Badge>
  );
}

/** How the order reached the merchant, as a chip. */
interface ChannelChip {
  readonly label: string;
  readonly icon: LucideIcon;
}

/**
 * The three channels. `MANUAL_TRANSFER` reads as the rail the customer used,
 * not as an integration — V1 has no live payment gateway.
 *
 * lucide ships no WhatsApp glyph and no brand-icon package may be installed, so
 * the conversation bubble carries it and the word does the identifying.
 */
const CHANNEL_CHIPS: Readonly<Record<OrderChannel, ChannelChip>> = {
  WHATSAPP: { label: strings.orders.channelWhatsapp, icon: MessageCircle },
  CASH_ON_DELIVERY: {
    label: strings.orders.channelCashOnDelivery,
    icon: Truck,
  },
  MANUAL_TRANSFER: {
    label: strings.orders.channelManualTransfer,
    icon: Banknote,
  },
};

/** The operator sub-label, when a claim has told us which rail was used. */
const OPERATOR_LABELS: Readonly<Record<PaymentOperator, string>> = {
  MTN_MOMO: strings.orders.operatorMtn,
  ORANGE_MONEY: strings.orders.operatorOrange,
};

export interface OrderChannelChipProps {
  readonly channel: OrderChannel;
  /** Known only for a manual transfer that already carries a claim. */
  readonly operator?: PaymentOperator | null;
  readonly className?: string;
}

/**
 * The channel chip, with the operator as a quiet sub-label rather than a second
 * chip: `Mobile Money · MTN` is one fact about one order, and splitting it in
 * two would read as two independent statuses in a dense table row.
 */
export function OrderChannelChip({
  channel,
  operator,
  className,
}: OrderChannelChipProps) {
  const chip = CHANNEL_CHIPS[channel];
  const Icon = chip.icon;
  const suffix = operator ? OPERATOR_LABELS[operator] : null;

  return (
    <span className={className}>
      <Badge variant="secondary">
        <Icon aria-hidden="true" />
        {chip.label}
      </Badge>
      {suffix ? (
        <span className="ml-1.5 text-sm leading-normal font-medium text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}
