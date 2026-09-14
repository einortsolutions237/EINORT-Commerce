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
import { requireAdminContext } from "@/server/admin/context";
import {
  listOrderClaimsForAdmin,
  pendingOrderClaimCount,
  type AdminClaimRow,
} from "@/server/admin/claims";
import type { ClaimStatus } from "@/server/db/enums";
import { platformDb } from "@/server/db/platform";
import { IMAGE_PRESETS } from "@/server/images/pipeline";
import { publicUrlFor } from "@/server/images/r2";

import { ClaimsFilterBar, LedgerCard, LedgerRow } from "./ledger-row";

/**
 * `/admin/claims` — 06-UI-SPEC.md § C3, ADM-02's global cross-tenant
 * order-payment-claims ledger. D-18: one flat table across every tenant, the
 * merchant as a column — not grouped, not expandable.
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireAdminContext()` is called here, not inherited from
 * `src/app/admin/layout.tsx` — the layout is a shell, explicitly not an
 * authorization boundary (see its own header). Every page under this tree
 * repeats the call for that reason; it is `React.cache()`-memoized, so the
 * repetition costs nothing beyond the one already paid by the layout.
 *
 * ---------------------------------------------------------------------------
 * EVERY `Intl` CALL AND THE SCREENSHOT URL ARE RESOLVED HERE, ON THE SERVER.
 * ---------------------------------------------------------------------------
 * `ledger-row.tsx` receives pre-formatted money, a pre-resolved relative
 * time and a finished screenshot URL — never a raw amount, a `Date` or a
 * storage key. Two reasons, matching `/dashboard/claims/page.tsx`'s header
 * exactly:
 *
 *   - Money and relative time: formatting on the client would render against
 *     the OWNER's device locale instead of the fixed `fr-CM` one, and a
 *     relative time computed against a client clock is a countdown this
 *     product does not trust (see `strings.trial`'s header for the same
 *     rule stated at length).
 *   - Screenshots: `publicUrlFor` REFUSES a key ending in `/original`
 *     (T-03-69). Composing that key in a Client Component would put the
 *     rule somewhere the guard cannot reach — `@/server/images/r2` is
 *     `server-only` precisely so it cannot be imported there.
 *
 * `CLAIM_DERIVATIVE` is read from `IMAGE_PRESETS.claim` rather than
 * hardcoded, so a future change to that preset's derivative label cannot
 * silently 404 every claim screenshot on this page without this file also
 * changing.
 *
 * ---------------------------------------------------------------------------
 * THE MERCHANT-NAME LIST FOR THE FILTER IS EVERY STORE, NOT JUST ONES WITH
 * CLAIMS.
 * ---------------------------------------------------------------------------
 * § C3: "Merchant select (`All merchants` + one option per store)" — every
 * store on the platform is a legitimate filter target, including one with
 * zero claims today. `platformDb.organization` is the non-tenant-scoped
 * registry facade (`src/server/db/platform.ts`), the same one
 * `src/app/admin/layout.tsx` already reads inline for the owner's own email
 * — reading it directly in a Server Component is established precedent on
 * this route tree, not a new pattern.
 */

export const metadata: Metadata = {
  title: strings.admin.claims.title,
};

/**
 * The `claim` preset's single derivative — read from `IMAGE_PRESETS.claim`,
 * not assumed. `PaymentClaim.screenshotKey` stores the PREFIX the
 * derivatives live under, and the finalize route writes each one as
 * `${prefix}/${label}.${format}`.
 */
const CLAIM_DERIVATIVE = `${IMAGE_PRESETS.claim.labels[0]}.${IMAGE_PRESETS.claim.format}`;

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

/** `?status=` and `?merchant=` carry the row's own filter value literally,
 * so "PENDING" in the URL is exactly `parseStatusFilter`'s output — the
 * ONE spelling this page and `ledger-row.tsx`'s `select`s ever use. */
const XAF_FORMATTER = new Intl.NumberFormat("fr-CM", {
  style: "currency",
  currency: "XAF",
  maximumFractionDigits: 0,
});

function formatXaf(amountXaf: number): string {
  return XAF_FORMATTER.format(amountXaf);
}

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const RELATIVE_TIME_DIVISIONS: readonly {
  readonly amount: number;
  readonly unit: Intl.RelativeTimeFormatUnit;
}[] = [
  { amount: 60, unit: "seconds" },
  { amount: 60, unit: "minutes" },
  { amount: 24, unit: "hours" },
  { amount: 7, unit: "days" },
  { amount: 4.34524, unit: "weeks" },
  { amount: 12, unit: "months" },
  { amount: Number.POSITIVE_INFINITY, unit: "years" },
];

/** "2 hours ago" against the ONE clock resolved for this whole render. */
function formatRelativeTime(date: Date, now: Date): string {
  let duration = (date.getTime() - now.getTime()) / 1000;

  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return RELATIVE_TIME_FORMATTER.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return RELATIVE_TIME_FORMATTER.format(Math.round(duration), "years");
}

function sortRows(
  rows: readonly AdminClaimRow[],
  column: SortColumn,
  dir: SortDir,
): readonly AdminClaimRow[] {
  const sorted = [...rows];
  const sign = dir === "asc" ? 1 : -1;

  if (column === "amount") {
    sorted.sort((a, b) => sign * (a.amountClaimedXaf - b.amountClaimedXaf));
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
  return `/admin/claims?${params.toString()}`;
}

/** One sortable `<TableHead>`, per § C3: Amount and Merchant are sortable. */
function SortableHead({
  column,
  label,
  activeColumn,
  activeDir,
  currentParams,
  className,
}: {
  readonly column: SortColumn;
  readonly label: string;
  readonly activeColumn: SortColumn;
  readonly activeDir: SortDir;
  readonly currentParams: URLSearchParams;
  readonly className?: string;
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
    <TableHead className={className}>
      <Link href={href} className="hover:underline" aria-label={accessibleLabel}>
        {label}
      </Link>
    </TableHead>
  );
}

export default async function AdminClaimsPage({
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
    listOrderClaimsForAdmin({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      merchantId: merchantFilter === "ALL" ? undefined : merchantFilter,
    }),
    pendingOrderClaimCount(),
    platformDb.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows = sortRows(rawRows, sortColumn, sortDir);

  // One clock for the whole render, so two rows a second apart cannot report
  // relative times computed against two different instants.
  const now = new Date();

  const cards = rows.map((row) => ({
    claimId: row.id,
    tenantId: row.tenantId,
    storeName: row.storeName,
    orderNumber: row.orderNumber,
    orderChannel: row.orderChannel,
    orderState: row.orderState,
    amountClaimedFormatted: formatXaf(row.amountClaimedXaf),
    orderTotalFormatted: formatXaf(row.orderTotalXaf),
    amountMismatch: row.amountClaimedXaf !== row.orderTotalXaf,
    operator: row.operator,
    reference: row.reference,
    submittedAtRelative: formatRelativeTime(row.submittedAt, now),
    screenshotUrl:
      row.screenshotKey === null
        ? null
        : publicUrlFor(`${row.screenshotKey}/${CLAIM_DERIVATIVE}`),
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
          {strings.admin.claims.heading}
        </h1>
        <p className="text-sm leading-normal font-medium text-muted-foreground">
          {pendingCount === 0
            ? strings.admin.claims.sublineEmpty
            : strings.admin.claims.subline.replace("{n}", String(pendingCount))}
        </p>
      </div>

      <ClaimsFilterBar
        status={statusFilter}
        merchant={merchantFilter}
        merchants={merchants}
      />

      {isUnfilteredEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <h2 className="text-lg leading-snug font-semibold text-foreground">
            {strings.admin.claims.emptyHeading}
          </h2>
          <p className="max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {strings.admin.claims.emptyBody}
          </p>
        </div>
      ) : isFilteredEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <p className="max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {strings.admin.claims.filteredEmptyBody}
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
                  <TableHead>{strings.admin.claims.columnScreenshot}</TableHead>
                  <SortableHead
                    column="merchant"
                    label={strings.admin.claims.columnMerchant}
                    activeColumn={sortColumn}
                    activeDir={sortDir}
                    currentParams={currentParams}
                  />
                  <TableHead>{strings.admin.claims.columnOrder}</TableHead>
                  <SortableHead
                    column="amount"
                    label={strings.admin.claims.columnAmount}
                    activeColumn={sortColumn}
                    activeDir={sortDir}
                    currentParams={currentParams}
                  />
                  <TableHead>{strings.admin.claims.columnOperator}</TableHead>
                  <TableHead>{strings.admin.claims.columnReference}</TableHead>
                  <TableHead>{strings.admin.claims.columnSubmitted}</TableHead>
                  <TableHead>{strings.admin.claims.columnStatus}</TableHead>
                  <TableHead>{strings.admin.claims.columnActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((card) => (
                  <LedgerRow key={card.claimId} {...card} />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* < md: stacked cards. */}
          <div className="flex flex-col gap-4 md:hidden">
            {cards.map((card) => (
              <LedgerCard key={card.claimId} {...card} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
