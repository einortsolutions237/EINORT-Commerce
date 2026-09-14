"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ArrowUpDown, Ban, CircleCheck, Ellipsis, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { strings } from "@/lib/strings";

/**
 * `/admin`'s client island — § C1's table (`md`+) and stacked cards (`< md`),
 * the status filter, the sortable Products/Orders/Joined headers, and the
 * per-row `⋯` menu.
 *
 * ---------------------------------------------------------------------------
 * EVERY ROW ARRIVES FULLY FORMATTED. THIS FILE DOES NO `Intl` CALL AND NO
 * URL COMPOSITION.
 * ---------------------------------------------------------------------------
 * `page.tsx` resolves one clock for the whole render, formats every relative
 * date and composes every URL server-side, and hands finished strings down —
 * the same discipline `claim-card.tsx` and `/dashboard/orders`'s row
 * components follow, for the identical reason: client-side `Intl` would
 * format against the platform OWNER's device locale, and two admins in two
 * time zones must read the same "joined 3 days ago".
 *
 * ---------------------------------------------------------------------------
 * `domainCell` ARRIVES AS A RENDERED `ReactNode`, NOT DATA THIS FILE BUILDS
 * A `<DomainCell>` FROM.
 * ---------------------------------------------------------------------------
 * `src/components/admin/domain-cell.tsx` calls `domainStatusFor`
 * (`src/server/admin/domain.ts`), which opens with `import "server-only"` —
 * importing that chain from this Client Component would fail the build. The
 * Server Component `page.tsx` renders `<DomainCell>` per row and passes the
 * result down as a prop, the standard "Server Component as a child of a
 * Client Component" composition — this file never imports `domain-cell.tsx`.
 *
 * ---------------------------------------------------------------------------
 * FILTERING AND SORTING ARE CLIENT STATE, DELIBERATELY, UNLIKE
 * `/dashboard/orders`'S LINK-BASED FILTER CHIPS.
 * ---------------------------------------------------------------------------
 * `listMerchantsForAdmin` (`src/server/admin/queries.ts`) already returns the
 * WHOLE pilot fleet in one bounded read (`ADMIN_MERCHANT_LEDGER_ROW_CAP`) —
 * there is no pagination to round-trip for. Re-fetching from the server on
 * every filter or sort change would trade one client-side array operation for
 * a network round trip, for no correctness benefit at this scale.
 *
 * ---------------------------------------------------------------------------
 * THE ROW ACTION MENU IS A DATA ARRAY OF ONE ITEM TODAY, ON PURPOSE.
 * ---------------------------------------------------------------------------
 * `06-08-PLAN.md` § "row actions": `View store` ships now; `Open support
 * thread` is plan 06-12's, `Suspend store` / `Restore store` are plan 06-14's.
 * Each later plan appends one row to `rowActionsFor` below rather than this
 * file being rewritten — a menu item pointing at a route that does not exist
 * yet is worse than an absent one.
 */

export interface AdminMerchantListItem {
  readonly id: string;
  readonly storeName: string;
  readonly ownerName: string;
  readonly ownerEmail: string;
  readonly planLabel: string;
  /** `Organization.status`, raw — `"active"` today; plan 06-14 writes
   * `"suspended"`. Anything else renders with the Suspended chip's styling,
   * matching this codebase's allowlist-`active` fail-closed convention. */
  readonly status: string;
  readonly productCount: number;
  readonly orderCount: number;
  /** Epoch millis, for client-side sorting only — never displayed raw. */
  readonly joinedAtMs: number;
  readonly joinedRelative: string;
  readonly storefrontHref: string;
  /** A `<DomainCell compact />`, rendered server-side. See the file header. */
  readonly domainCell: ReactNode;
}

type StatusFilter = "all" | "active" | "suspended";
type SortColumn = "products" | "orders" | "joined";
type SortDirection = "asc" | "desc";

const STORE_STATUS_CHIP: Readonly<
  Record<"active" | "suspended", { readonly icon: typeof CircleCheck; readonly variant: "outline-success" | "destructive" }>
> = {
  active: { icon: CircleCheck, variant: "outline-success" },
  suspended: { icon: Ban, variant: "destructive" },
};

function StoreStatusBadge({ status }: { readonly status: string }) {
  // Allowlist `active`; anything else — including a status this component has
  // never seen — reads as Suspended's styling rather than Active's, matching
  // `src/server/admin/domain.ts`'s fail-closed convention.
  const chip = status === "active" ? STORE_STATUS_CHIP.active : STORE_STATUS_CHIP.suspended;
  const Icon = chip.icon;
  const label =
    status === "active"
      ? strings.admin.storeStatus.active
      : strings.admin.storeStatus.suspended;

  return (
    <Badge variant={chip.variant}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}

/** One row's `⋯` menu. A data array of one item today — see the file header. */
function rowActionsFor(item: AdminMerchantListItem) {
  return [
    {
      key: "view-store",
      label: strings.admin.merchants.actionViewStore,
      icon: ExternalLink,
      href: item.storefrontHref,
    },
    // Plan 06-12 appends "Open support thread" here.
    // Plan 06-14 appends "Suspend store" / "Restore store" here.
  ] as const;
}

function RowActionsMenu({ item }: { readonly item: AdminMerchantListItem }) {
  const actions = rowActionsFor(item);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
          />
        }
      >
        <Ellipsis aria-hidden="true" />
        <span className="sr-only">
          {strings.admin.merchants.rowActionsLabel.replace(
            "{store}",
            item.storeName,
          )}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.key}
              render={
                <a href={action.href} target="_blank" rel="noopener" />
              }
            >
              <Icon aria-hidden="true" />
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const SORTABLE_COLUMNS: readonly { readonly key: SortColumn; readonly label: string }[] = [
  { key: "products", label: strings.admin.merchants.columnProducts },
  { key: "orders", label: strings.admin.merchants.columnOrders },
  { key: "joined", label: strings.admin.merchants.columnJoined },
];

function SortableHead({
  column,
  label,
  activeColumn,
  direction,
  onSort,
  className,
}: {
  readonly column: SortColumn;
  readonly label: string;
  readonly activeColumn: SortColumn | null;
  readonly direction: SortDirection;
  readonly onSort: (column: SortColumn) => void;
  readonly className?: string;
}) {
  const active = activeColumn === column;
  const ariaSort = active ? (direction === "asc" ? "ascending" : "descending") : "none";
  const announcement = active
    ? direction === "asc"
      ? strings.admin.merchants.sortedAscending.replace("{column}", label)
      : strings.admin.merchants.sortedDescending.replace("{column}", label)
    : strings.admin.merchants.sortLabel.replace("{column}", label);

  return (
    <TableHead aria-sort={ariaSort} className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={announcement}
        className="inline-flex min-h-11 items-center gap-1 text-left font-medium text-foreground"
      >
        {label}
        <ArrowUpDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </button>
    </TableHead>
  );
}

export function MerchantsList({
  items,
}: {
  readonly items: readonly AdminMerchantListItem[];
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((direction) => (direction === "desc" ? "asc" : "desc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  }

  const filtered = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const sorted = useMemo(() => {
    if (sortColumn === null) return filtered;

    const sign = sortDirection === "asc" ? 1 : -1;
    const valueFor = (item: AdminMerchantListItem): number => {
      if (sortColumn === "products") return item.productCount;
      if (sortColumn === "orders") return item.orderCount;
      return item.joinedAtMs;
    };

    return [...filtered].sort((a, b) => sign * (valueFor(a) - valueFor(b)));
  }, [filtered, sortColumn, sortDirection]);

  const isUnfilteredEmpty = items.length === 0;
  const isFilteredEmpty = !isUnfilteredEmpty && sorted.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Select
          items={[
            { label: strings.admin.merchants.filterAll, value: "all" },
            { label: strings.admin.merchants.filterActive, value: "active" },
            { label: strings.admin.merchants.filterSuspended, value: "suspended" },
          ]}
          value={statusFilter}
          onValueChange={(next) => setStatusFilter(next as StatusFilter)}
        >
          <SelectTrigger
            aria-label={strings.admin.merchants.filterLabel}
            className="min-h-11 w-44"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{strings.admin.merchants.filterAll}</SelectItem>
            <SelectItem value="active">{strings.admin.merchants.filterActive}</SelectItem>
            <SelectItem value="suspended">
              {strings.admin.merchants.filterSuspended}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isUnfilteredEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <h2 className="font-heading text-lg leading-snug font-semibold text-foreground">
            {strings.admin.merchants.emptyHeading}
          </h2>
          <p className="max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {strings.admin.merchants.emptyBody}
          </p>
        </div>
      ) : isFilteredEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-16 text-center">
          <p className="max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {strings.admin.merchants.filteredEmptyBody}
          </p>
        </div>
      ) : (
        <>
          {/* >= md: table, max-w-6xl per § C1. */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{strings.admin.merchants.columnStore}</TableHead>
                  <TableHead>{strings.admin.merchants.columnPlan}</TableHead>
                  <TableHead>{strings.admin.merchants.columnStatus}</TableHead>
                  <TableHead>{strings.admin.merchants.columnDomain}</TableHead>
                  <SortableHead
                    column="products"
                    label={SORTABLE_COLUMNS[0].label}
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHead
                    column="orders"
                    label={SORTABLE_COLUMNS[1].label}
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHead
                    column="joined"
                    label={SORTABLE_COLUMNS[2].label}
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <TableHead className="text-right">
                    <span className="sr-only">
                      {strings.admin.merchants.columnActions}
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        href={`/admin/merchants/${item.id}`}
                        className="flex flex-col gap-0.5"
                      >
                        <span className="text-base leading-normal font-semibold text-foreground">
                          {item.storeName}
                        </span>
                        <span className="text-sm leading-normal font-normal text-muted-foreground">
                          {item.ownerEmail}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.planLabel}</Badge>
                    </TableCell>
                    <TableCell>
                      <StoreStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="max-w-56">{item.domainCell}</TableCell>
                    <TableCell className="tabular-nums">{item.productCount}</TableCell>
                    <TableCell className="tabular-nums">{item.orderCount}</TableCell>
                    <TableCell className="text-sm leading-normal font-normal text-muted-foreground">
                      {item.joinedRelative}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <RowActionsMenu item={item} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* < md: stacked cards, domain as its own labelled row (§ D). */}
          <div className="flex flex-col gap-3 md:hidden">
            {sorted.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/admin/merchants/${item.id}`} className="flex flex-col gap-0.5">
                    <span className="text-base leading-normal font-semibold text-foreground">
                      {item.storeName}
                    </span>
                    <span className="text-sm leading-normal font-normal text-muted-foreground">
                      {item.ownerEmail}
                    </span>
                  </Link>
                  <RowActionsMenu item={item} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.planLabel}</Badge>
                  <StoreStatusBadge status={item.status} />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    {strings.admin.merchants.columnDomain}
                  </span>
                  {item.domainCell}
                </div>

                <div className="flex items-center justify-between gap-2 text-sm leading-normal text-muted-foreground">
                  <span className="tabular-nums">
                    {strings.admin.merchants.columnProducts}: {item.productCount}
                  </span>
                  <span className="tabular-nums">
                    {strings.admin.merchants.columnOrders}: {item.orderCount}
                  </span>
                  <span>{item.joinedRelative}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
