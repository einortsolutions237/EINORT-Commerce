import { BellRing, CircleCheck, X, type LucideIcon } from "lucide-react";
import type { VariantProps } from "class-variance-authority";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { strings } from "@/lib/strings";
import type { ClaimStatus } from "@/server/db/enums";

/**
 * The ONE place a subscription payment's review state becomes something a
 * person reads (06-UI-SPEC.md § Status Chip Registry, SUB-03 / D-20).
 *
 * Rendered on BOTH surfaces: the merchant sees it on `/dashboard/plan` and in
 * their support thread after submitting proof of payment; the owner sees it in
 * the `/admin/subscriptions` ledger. One map, so the two never disagree about
 * what a claim's state is called — a merchant and the owner discussing one
 * payment must be looking at the same word.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A MAP AND NOT A `switch` INSIDE THE COMPONENT.
 * ---------------------------------------------------------------------------
 * The same reason `src/components/order-state-chip.tsx` gives, and the pattern
 * is copied from it deliberately rather than re-invented: `as const satisfies
 * Readonly<Record<ClaimStatus, SubscriptionClaimChip>>` makes a FOURTH member
 * added to `ClaimStatus` in `prisma/schema.prisma` a compile error HERE. A
 * `switch` with a `default` would instead render the new state through whatever
 * the fallback happens to be, which is a status chip that lies about money.
 *
 * A plain data object is also importable from the database-free `unit` project,
 * so a rule expressed as a value stays a rule a test can restate.
 *
 * ---------------------------------------------------------------------------
 * THE GOLD BUDGET: THIS FILE IS ENTRY #5, THE LAST ONE.
 * ---------------------------------------------------------------------------
 * 06-UI-SPEC.md § Color extends `03-UI-SPEC.md`'s two-use budget to exactly
 * five uses in exactly five files, and `PENDING` below is the fifth. Gold means
 * *unreviewed money* — here, a payment the platform owner has not decided on
 * yet — and `tests/unit/dashboard-nav.test.ts` fails the build on a sixth
 * spender. The gold reaches `Badge` through `chip.variant`, never as an inline
 * attribute, because there is only ever one renderer.
 *
 * ---------------------------------------------------------------------------
 * COLOUR IS NEVER THE ONLY SIGNAL (WCAG 1.4.1).
 * ---------------------------------------------------------------------------
 * Every row below carries an icon AND a text label. `Confirmed` and `Rejected`
 * are a decision about somebody's subscription; a reader who cannot separate
 * emerald from red must still be able to tell which one happened.
 *
 * ---------------------------------------------------------------------------
 * `ClaimStatus` COMES FROM `@/server/db/enums`, NEVER THE GENERATED CLIENT.
 * ---------------------------------------------------------------------------
 * `eslint.config.mjs` makes a `generated/prisma*` import an error outside three
 * server directories — that rule is the TEN-02 / TEN-05 enforcement mechanism,
 * not style policing. `enums.ts` exists so a Client Component can name an enum
 * member without the boundary becoming negotiable.
 *
 * Every label comes from `strings.plan.subscriptionClaim` (C-14). None is typed
 * here, and none reads as an enum member.
 */

/** The badge variants `src/components/ui/badge.tsx` actually declares. */
type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface SubscriptionClaimChip {
  /** Read from `strings.plan.subscriptionClaim`, never written here. */
  readonly label: string;
  readonly variant: BadgeVariant;
  readonly icon: LucideIcon;
}

/**
 * § Status Chip Registry, transcribed row for row.
 *
 * `as const satisfies` rather than a plain annotation: `satisfies` is what makes
 * a missing or misspelled member a compile error, and `as const` keeps the
 * literal types so a caller reading one row gets the row it asked for rather
 * than the union of all three.
 */
export const SUBSCRIPTION_CLAIM_CHIPS = {
  PENDING: {
    // The fifth and final gold in the product. See the header.
    label: strings.plan.subscriptionClaim.chipAwaiting,
    variant: "gold",
    icon: BellRing,
  },
  CONFIRMED: {
    label: strings.plan.subscriptionClaim.chipConfirmed,
    variant: "success",
    icon: CircleCheck,
  },
  REJECTED: {
    label: strings.plan.subscriptionClaim.chipRejected,
    variant: "destructive",
    icon: X,
  },
} as const satisfies Readonly<Record<ClaimStatus, SubscriptionClaimChip>>;

export interface SubscriptionClaimStatusChipProps {
  readonly status: ClaimStatus;
  readonly className?: string;
}

/** The chip. One renderer, so the registry above is the only thing to edit. */
export function SubscriptionClaimStatusChip({
  status,
  className,
}: SubscriptionClaimStatusChipProps) {
  const chip = SUBSCRIPTION_CLAIM_CHIPS[status];
  const Icon = chip.icon;

  return (
    <Badge variant={chip.variant} className={className}>
      <Icon aria-hidden="true" />
      {chip.label}
    </Badge>
  );
}
