import type { Metadata } from "next";

import { DomainCell } from "@/components/admin/domain-cell";
import { env } from "@/env";
import { strings } from "@/lib/strings";
import { requireAdminContext } from "@/server/admin/context";
import {
  listMerchantsForAdmin,
  type AdminMerchantRow,
} from "@/server/admin/queries";
import { storefrontHostFor } from "@/server/admin/domain";

import { formatRelativeTime, planLabelFor } from "./format";
import { MerchantsList, type AdminMerchantListItem } from "./merchants-list";

/**
 * `/admin` — the merchants list, § C1 (ADM-01 / ADM-03 / R-2).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireAdminContext()` is called here, not inherited from
 * `src/app/admin/layout.tsx` — the layout is a shell, not an authorization
 * boundary (see its own header). `React.cache()` makes the repeated call free.
 *
 * ---------------------------------------------------------------------------
 * ONE CLOCK, EVERY `Intl` CALL, AND EVERY URL — ALL RESOLVED HERE, ON THE
 * SERVER.
 * ---------------------------------------------------------------------------
 * `merchants-list.tsx` receives pre-formatted relative dates, pre-composed
 * storefront URLs and a pre-rendered `<DomainCell>` per row — never a raw
 * timestamp, and never a hostname it would have to build itself. Same
 * discipline `/dashboard/claims/page.tsx` documents at length: `Intl`
 * formatted on the client renders against the viewer's device locale, and two
 * admins in two time zones must read the same "joined 3 days ago". `now` is
 * read exactly once so two rows a second apart cannot report relative times
 * computed against two different instants.
 */

export const metadata: Metadata = {
  // Renders as "Merchants · EINORT" through the root layout's template.
  title: strings.admin.merchants.title,
};

/** `http` only for a localhost root domain — same rule
 * `src/components/admin/domain-cell.tsx`'s local `storefrontUrlFor` applies,
 * duplicated rather than imported because it is three lines of URL-scheme
 * plumbing, not a fact this codebase centralizes. */
function storefrontUrlFor(host: string): string {
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

function toListItem(
  row: AdminMerchantRow,
  rootDomain: string,
  now: Date,
): AdminMerchantListItem {
  const host = storefrontHostFor({ slug: row.slug, rootDomain });

  return {
    id: row.id,
    storeName: row.storeName,
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
    planLabel: planLabelFor(row.planTier),
    status: row.status,
    productCount: row.productCount,
    orderCount: row.orderCount,
    joinedAtMs: row.createdAt.getTime(),
    joinedRelative: formatRelativeTime(row.createdAt, now),
    storefrontHref: storefrontUrlFor(host),
    domainCell: (
      <DomainCell
        slug={row.slug}
        status={row.status}
        isPublished={row.isPublished}
        rootDomain={rootDomain}
        compact
      />
    ),
  };
}

export default async function AdminMerchantsPage() {
  await requireAdminContext();

  const rows = await listMerchantsForAdmin();
  const now = new Date();
  const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN;

  const items = rows.map((row) => toListItem(row, rootDomain, now));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.admin.merchants.heading}
        </h1>
        <p className="text-sm leading-normal font-medium text-muted-foreground">
          {strings.admin.merchants.subline.replace("{n}", String(rows.length))}
        </p>
      </div>

      <MerchantsList items={items} />
    </div>
  );
}
