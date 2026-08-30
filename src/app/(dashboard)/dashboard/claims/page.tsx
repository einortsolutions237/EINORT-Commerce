import type { Metadata } from "next";

import { strings } from "@/lib/strings";
import {
  findDuplicateReference,
  listClaimsForReview,
} from "@/server/claims/queries";
import { publicUrlFor } from "@/server/images/r2";
import { requireMerchantContext } from "@/server/merchant/context";

import { formatRelativeTime, formatXaf } from "../orders/format";
import { ClaimCard } from "./claim-card";

/**
 * `/dashboard/claims` (03-UI-SPEC.md § A5, ORD-02 / ORD-03 / ORD-04 / D-11).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireMerchantContext()` is called here, not inherited from
 * `(dashboard)/layout.tsx` — the layout is a shell, explicitly not an
 * authorization boundary. Every page under this route group repeats the call for
 * that reason; it is `React.cache()`-memoized, so the repetition costs nothing.
 *
 * ---------------------------------------------------------------------------
 * EVERY `Intl` CALL AND EVERY STORAGE KEY IS RESOLVED HERE, ON THE SERVER.
 * ---------------------------------------------------------------------------
 * `claim-card.tsx` receives pre-formatted money and a finished URL, never a raw
 * amount or a storage key. Two different reasons, both load-bearing:
 *
 *   - Money: `formatXaf` is one `fr-CM` instantiation shared with A3 and A4, and
 *     formatting on the client would render against the MERCHANT'S device locale
 *     instead — so the same order could read `5 000 FCFA` on one phone and
 *     `XAF 5,000.00` on another.
 *   - Screenshots: `publicUrlFor` REFUSES a key ending in `/original` (T-03-69).
 *     The bytes a browser uploaded are never served; only Sharp's re-encoded
 *     derivative is. Composing that key in a Client Component would put the rule
 *     somewhere the guard cannot reach, and `src/server/images/r2.ts` is
 *     `server-only` precisely so it cannot be imported there.
 *
 * ---------------------------------------------------------------------------
 * THE DUPLICATE LOOKUP IS ONE QUERY PER CARD, AND THAT IS ACCEPTABLE HERE.
 * ---------------------------------------------------------------------------
 * The queue is the claims a merchant has not yet reviewed — realistically a
 * handful, bounded by their own attention rather than by their order volume. The
 * lookup rides `@@unique([tenantId, referenceNormalized])`, so each is an index
 * probe. Folding it into the queue query would mean a self-join whose result is
 * `null` under the current schema anyway (see that function's header), and the
 * honest version of that optimisation is to do it when the queue is long enough
 * to notice.
 */

export const metadata: Metadata = {
  title: strings.claims.title,
};

/**
 * The `claim` preset's single derivative, whose label is `full` — read from
 * `IMAGE_PRESETS.claim` in `src/server/images/pipeline.ts`, not assumed.
 * `PaymentClaim.screenshotKey` stores the PREFIX the derivatives live under, and
 * the finalize route writes each one as `${prefix}/${label}.webp`.
 */
const CLAIM_DERIVATIVE = "full.webp";

export default async function ClaimsPage() {
  const ctx = await requireMerchantContext();
  const claims = await listClaimsForReview(ctx.tenantId);

  // One clock for the whole render, so two cards submitted a second apart
  // cannot report relative times computed against two different instants.
  const now = new Date();

  const cards = await Promise.all(
    claims.map(async (claim) => {
      const duplicateOnOrderNumber = await findDuplicateReference(
        ctx.tenantId,
        claim.referenceNormalized,
        claim.order.id,
      );

      return {
        claimId: claim.id,
        orderId: claim.order.id,
        orderNumber: claim.order.orderNumber,
        customerName: claim.order.customerName,
        channel: claim.order.channel,
        operator: claim.operator,
        reference: claim.reference,
        amountClaimedFormatted: formatXaf(claim.amountClaimedXaf),
        orderTotalFormatted: formatXaf(claim.order.totalXaf),
        amountMismatch: claim.amountClaimedXaf !== claim.order.totalXaf,
        submittedAtRelative: formatRelativeTime(claim.submittedAt, now),
        screenshotUrl:
          claim.screenshotKey === null
            ? null
            : publicUrlFor(`${claim.screenshotKey}/${CLAIM_DERIVATIVE}`),
        duplicateOnOrderNumber,
      };
    }),
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl leading-tight font-semibold text-foreground">
          {strings.claims.heading}
        </h1>
        <p className="text-sm leading-normal font-medium text-muted-foreground">
          {cards.length === 0
            ? strings.claims.sublineEmpty
            : strings.claims.subline.replace("{n}", String(cards.length))}
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <h2 className="text-lg leading-snug font-semibold text-foreground">
            {strings.claims.emptyHeading}
          </h2>
          <p className="max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {strings.claims.emptyBody}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {cards.map((card) => (
            <ClaimCard key={card.claimId} {...card} />
          ))}
        </div>
      )}
    </div>
  );
}
