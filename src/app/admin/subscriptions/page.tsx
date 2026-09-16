import type { Metadata } from "next";
import Link from "next/link";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { strings } from "@/lib/strings";
import { formatAbsoluteDate, formatRelativeTime, planLabelFor } from "@/app/admin/format";
import { requireAdminContext } from "@/server/admin/context";
import {
  listSubscriptionClaimsForAdmin,
  pendingSubscriptionClaimCount,
  resolveNextPeriodEnd,
  type AdminSubscriptionClaimRow,
} from "@/server/admin/subscription-claims";
import type { ClaimStatus } from "@/server/db/enums";
import { platformDb } from "@/server/db/platform";
import { formatXaf } from "@/server/payments/whatsapp";
import { IMAGE_PRESETS } from "@/server/images/pipeline";
import { publicUrlFor } from "@/server/images/r2";

import {
  SubscriptionCard,
  SubscriptionRow,
  SubscriptionsFilterBar,
} from "./subscription-row";

/**
 * `/admin/subscriptions` — 06-UI-SPEC.md § C4, SUB-03's platform review
 * surface (D-20).
 *
 * ---------------------------------------------------------------------------
 * A SEPARATE PAGE FROM `/admin/claims`. NO COMBINED TABLE, NO TYPE COLUMN.
 * ---------------------------------------------------------------------------
 * D-20 gives customer-> merchant order claims and merchant->platform
 * subscription claims two separate views: different actors, different
 * consequences — confirming one releases an order, confirming the other
 * extends a subscription. This page shares `/admin/claims/page.tsx`'s
 * STRUCTURE (self-authorizing, server-resolved formatting, the same filter
 * shape) but not one row of its markup — see 06-RESEARCH.md § Discretion Q1
 * for why a shared table with a discriminator column was rejected.
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireAdminContext()` is called here, not inherited from
 * `src/app/admin/layout.tsx` — the layout is a shell, explicitly not an
 * authorization boundary. `React.cache()` makes the repeated call free.
 *
 * ---------------------------------------------------------------------------
 * EVERY `Intl` CALL, THE RECEIPT URL, AND THE RESULTING PERIOD-END DATE ARE
 * RESOLVED HERE, ON THE SERVER.
 * ---------------------------------------------------------------------------
 * `subscription-row.tsx` receives pre-formatted money, a pre-resolved
 * relative time, a finished receipt URL, and — the one specific to this
 * page — a pre-formatted "what confirming right now would produce" date. The
 * row's confirm dialog quotes that string directly rather than recomputing
 * `resolveNextPeriodEnd` client-side, so the sentence the owner reads and the
 * value `confirmSubscriptionClaim` actually writes can never disagree
 * (T-06-86). `resolveNextPeriodEnd` is imported from
 * `src/server/admin/subscription-claims.ts` — the SAME pure function the
 * writer uses — rather than re-derived here.
 *
 * `RECEIPT_DERIVATIVE` is read from `IMAGE_PRESETS.thread` rather than
 * hardcoded, matching `/admin/claims/page.tsx`'s own `CLAIM_DERIVATIVE`
 * precedent: a future change to that preset's derivative label cannot
 * silently 404 every receipt thumbnail on this page without this file also
 * changing.
 */

export const metadata: Metadata = {
  title: strings.admin.subscriptions.title,
};

/** The `thread` preset's single derivative (`src/server/images/pipeline.ts`) — also the preset
 * plan 06-15's subscription-receipt upload reuses, per that file's own comment. */
const RECEIPT_DERIVATIVE = `${IMAGE_PRESETS.thread.labels[0]}.${IMAGE_PRESETS.thread.format}`;

const STATUS_VALUES: readonly ClaimStatus[] = ["PENDING", "CONFIRMED", "REJECTED"];

function parseStatusFilter(raw: string | string[] | undefined): ClaimStatus | "ALL" {
  if (typeof raw !== "string") return "PENDING";
  return (STATUS_VALUES as readonly string[]).includes(raw)
    ? (raw as ClaimStatus)
    : "PENDING";
}

function parseMerchantFilter(raw: string | string[] | undefined): string {
  return typeof raw === "string" && raw.length > 0 ? raw : "ALL";
}

type SortColumn = "submitted" | "amount" | "merchant";
type SortDir = "asc" | "desc";

function parseSortColumn(raw: string | string[] | undefined): SortColumn {
  return raw === "amount" || raw === "merchant" ? raw : "submitted";
}

function parseSortDir(raw: string | string[] | undefined): SortDir {
  return raw === "asc" ? "asc" : "desc";
}

function sortRows(
  rows: readonly AdminSubscriptionClaimRow[],
  column: SortColumn,
  dir: SortDir,
): readonly AdminSubscriptionClaimRow[] {
  const sorted = [...rows];
  const sign = dir === "asc" ? 1 : -1;

  if (column === "amount") {
    sorted.sort((a, b) => sign * (a.amountXaf - b.amountXaf));
  } else if (column === "merchant") {
    sorted.sort((a, b) => sign * a.storeName.localeCompare(b.storeName));
  } else {
    sorted.sort((a, b) => sign * (a.submittedAt.getTime() - b.submittedAt.getTime()));
  }

  return sorted;
}

function buildSortHref(
  currentParams: URLSearchParams,
  column: SortColumn,
  nextDir: SortDir,
): string {
  const params = new URLSearchParams(currentParams);
  params.set("sort", column);
  params.set("dir", nextDir);
  return `/admin/subscriptions?${params.toString()}`;
}

/** One sortable `<TableHead>` — matches `/admin/claims/page.tsx`'s `SortableHead` shape. */
function SortableHead({
  column,
  label,
  activeColumn,
  activeDir,
  currentParams,
}: {
  readonly column: SortColumn;
  readonly label: string;
  readonly activeColumn: SortColumn;
  readonly activeDir: SortDir;
  readonly currentParams: URLSearchParams;
}) {
  const isActive = activeColumn === column;
  const nextDir: SortDir = isActive && activeDir === "desc" ? "asc" : "desc";
  const href = buildSortHref(currentParams, column, nextDir);
  const accessibleLabel = isActive
    ? (activeDir === "asc"
        ? strings.admin.merchants.sortedAscending
        : strings.admin.merchants.sortedDescending
      ).replace("{column}", label)
    : strings.admin.merchants.sortLabel.replace("{column}", label);

  return (
    <TableHead>
      <Link href={href} className="hover:underline" aria-label={accessibleLabel}>
        {label}
      </Link>
    </TableHead>
  );
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly [key: string]: string | string[] | undefined;
  }>;
}) {
  await requireAdminContext();
  const params = await searchParams;

  const statusFilter = parseStatusFilter(params.status);
  const merchantFilter = parseMerchantFilter(params.merchant);
  const sortColumn = parseSortColumn(params.sort);
  const sortDir = parseSortDir(params.dir);

  const [rawRows, pendingCount, merchants] = await Promise.all([
    listSubscriptionClaimsForAdmin({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      merchantId: merchantFilter === "ALL" ? undefined : merchantFilter,
    }),
    pendingSubscriptionClaimCount(),
    platformDb.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows = sortRows(rawRows, sortColumn, sortDir);

  // One clock for the whole render, so two rows a second apart cannot report
  // relative times — or resulting period ends — computed against two
  // different instants.
  const now = new Date();

  const cards = rows.map((row) => ({
    claimId: row.id,
    tenantId: row.tenantId,
    storeName: row.storeName,
    planLabel: planLabelFor(row.planTier),
    amountFormatted: formatXaf(row.amountXaf),
    operator: row.operator,
    reference: row.reference,
    submittedAtRelative: formatRelativeTime(row.submittedAt, now),
    coversThroughFormatted:
      row.coversThrough === null ? null : formatAbsoluteDate(row.coversThrough),
    // What CONFIRMING RIGHT NOW would produce — resolved through the exact
    // same pure function `confirmSubscriptionClaim` writes through, so the
    // dialog's quoted date and the value the server would write cannot
    // disagree.
    resultingPeriodEndFormatted: formatAbsoluteDate(
      resolveNextPeriodEnd(row.organizationCurrentPeriodEnd, now),
    ),
    receiptUrl:
      row.receiptKey === null ? null : publicUrlFor(`${row.receiptKey}/${RECEIPT_DERIVATIVE}`),
    status: row.status,
    activeStatusFilter: statusFilter === "ALL" ? undefined : statusFilter,
  }));

  const isDefaultView = statusFilter === "PENDING" && merchantFilter === "ALL";
  const isEmpty = cards.length === 0;
  const isUnfilteredEmpty = isDefaultView && isEmpty;
  const isFilteredEmpty = !isDefaultView && isEmpty;

  const currentParams = new URLSearchParams();
  currentParams.set("status", statusFilter);
  currentParams.set("merchant", merchantFilter);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.admin.subscriptions.heading}
        </h1>
        <p className="text-sm leading-normal font-medium text-muted-foreground">
          {pendingCount === 0
            ? strings.admin.subscriptions.sublineEmpty
            : strings.admin.subscriptions.subline.replace("{n}", String(pendingCount))}
        </p>
      </div>

      <SubscriptionsFilterBar
        status={statusFilter}
        merchant={merchantFilter}
        merchants={merchants}
      />

      {isUnfilteredEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <h2 className="text-lg leading-snug font-semibold text-foreground">
            {strings.admin.subscriptions.emptyHeading}
          </h2>
          <p className="max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {strings.admin.subscriptions.emptyBody}
          </p>
        </div>
      ) : isFilteredEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <p className="max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {strings.admin.subscriptions.filteredEmptyBody}
          </p>
        </div>
      ) : (
        <>
          {/* >= md: one flat table. Never a horizontal scroll — the column set
              fits `max-w-6xl` at this density. */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{strings.admin.subscriptions.columnReceipt}</TableHead>
                  <SortableHead
                    column="merchant"
                    label={strings.admin.subscriptions.columnMerchant}
                    activeColumn={sortColumn}
                    activeDir={sortDir}
                    currentParams={currentParams}
                  />
                  <TableHead>{strings.admin.subscriptions.columnPlan}</TableHead>
                  <SortableHead
                    column="amount"
                    label={strings.admin.subscriptions.columnAmount}
                    activeColumn={sortColumn}
                    activeDir={sortDir}
                    currentParams={currentParams}
                  />
                  <TableHead>{strings.admin.subscriptions.columnOperator}</TableHead>
                  <TableHead>{strings.admin.subscriptions.columnReference}</TableHead>
                  <TableHead>{strings.admin.subscriptions.columnSubmitted}</TableHead>
                  <TableHead>{strings.admin.subscriptions.columnCoversThrough}</TableHead>
                  <TableHead>{strings.admin.subscriptions.columnStatus}</TableHead>
                  <TableHead>{strings.admin.subscriptions.columnActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((card) => (
                  <SubscriptionRow key={card.claimId} {...card} />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* < md: stacked cards. */}
          <div className="flex flex-col gap-4 md:hidden">
            {cards.map((card) => (
              <SubscriptionCard key={card.claimId} {...card} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
