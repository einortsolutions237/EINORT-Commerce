import "server-only";

import { adminDb } from "@/server/db/admin";

/**
 * ADM-01 / ADM-03 — the platform owner's merchants list and per-store detail
 * (`06-UI-SPEC.md § C1` / `§ C2`), read exclusively through `adminDb`.
 *
 * ---------------------------------------------------------------------------
 * `adminDb`, NOT `platformDb`. THIS IS A DELIBERATE CHOICE, NOT AN ACCIDENT.
 * ---------------------------------------------------------------------------
 * `platformDb` is a narrow, four-delegate allowlist facade
 * (`organization`/`user`/`member`/`invitation`/`session`) built for the
 * merchant surface's own narrow needs (slug lookup, hostname resolution).
 * This module also needs `product`, `order` and `paymentClaim` — every one of
 * which carries a `tenantId`, so a query against any of them is, by
 * definition, cross-tenant. `adminDb` is the client this codebase built for
 * exactly that (`src/server/db/admin.ts`, TEN-05), and it is
 * import-fenced to `src/server/admin/**` by `eslint.config.mjs` — using it
 * consistently here, rather than mixing it with `platformDb` call by call,
 * keeps every read in this file legible as "the admin zone's own client" at a
 * glance.
 *
 * ---------------------------------------------------------------------------
 * PASSING AN ORGANIZATION ID TO A QUERY IS LEGAL AND IS THE POINT.
 * ---------------------------------------------------------------------------
 * `src/server/merchant/context.ts`'s header warns that a `requireXContext(id)`
 * overload is "the precise shape of the bug this module exists to prevent,
 * and it is the shape that arrives innocently: an admin view that wants to
 * look at one store". That sentence names this exact page.
 * `merchantDetailForAdmin` below takes a store id and reads that one store —
 * and that is the sanctioned shape, not a violation of it. The rule is about
 * the IDENTITY FUNCTION (`requireAdminContext()`, which must stay
 * zero-parameter forever, per `tests/unit/no-tenant-id-param.test.ts`), not
 * about every function on this surface. The admin surface looks at one store
 * by passing an id to a QUERY, never to the identity function; this file is
 * where that distinction is exercised, not where it is broken.
 *
 * `tests/unit/no-tenant-id-param.test.ts` also enforces something narrower and
 * easy to trip by accident: it bans the literal parameter spellings
 * `tenantId`, `organizationId` and `storeId` from every exported signature
 * under `src/server/admin/**`, with no carve-out for a legitimate query
 * parameter versus the identity function — because this zone has no tenant
 * predicate underneath a mis-scoped one to catch. `merchantDetailForAdmin`'s
 * parameter is therefore spelled `merchantId`, matching the precedent already
 * set by `listOrderClaimsForAdmin`'s `filter.merchantId` in
 * `src/server/admin/claims.ts` — the same id, a different, unbanned name for
 * it.
 *
 * ---------------------------------------------------------------------------
 * ROW CAP. BE HONEST ABOUT PILOT SCALE, THE SAME WAY `REVENUE_WINDOW_ROW_CAP`
 * IS.
 * ---------------------------------------------------------------------------
 * `ADMIN_MERCHANT_LEDGER_ROW_CAP` below is a handful of index-backed reads and
 * a JS merge at the pilot's fleet size. A platform running many thousands of
 * stores at once would exceed it and the list would silently drop its tail.
 * Revisiting this — pagination, most plausibly — is a follow-up for whenever
 * pilot volume approaches it, not a correctness bug today.
 *
 * ---------------------------------------------------------------------------
 * COUNTS ARE DERIVED PER RENDER. NEVER A COUNTER COLUMN.
 * ---------------------------------------------------------------------------
 * Same doctrine as `pendingClaimCount` (`src/server/claims/queries.ts`) and
 * `pendingOrderClaimCount` (`src/server/admin/claims.ts`), restated once more
 * because it applies here to two more counters: a product count and an order
 * count that live on `Organization` would need to be incremented and
 * decremented at every product/order write site across the whole codebase,
 * and the day one of those sites forgets, the number on this page lies. A
 * `groupBy` derives both fresh from the rows on every render instead.
 * `Organization` declares no Prisma relation to `Product` or `Order` (only
 * `Member`/`Invitation` carry a declared relation back to it), so there is no
 * `_count` shortcut through a `select` — each is its own `groupBy(["tenantId"])`
 * read, run in parallel and merged into the row list by a `Map`, matching the
 * store-name join idiom `listOrderClaimsForAdmin` already established in
 * `src/server/admin/claims.ts`.
 *
 * ---------------------------------------------------------------------------
 * NO RAW SQL ESCAPE HATCH, ANYWHERE IN THIS FILE.
 * ---------------------------------------------------------------------------
 * Prisma's raw-query methods are banned repository-wide
 * (`eslint.config.mjs`, `no-restricted-syntax`) because they are verified
 * empirically not to be intercepted by the tenant extension. Every join in
 * this file is a second, ordinary Prisma call merged in JS — more code than a
 * raw query, and provably safe under the same rule every other module in this
 * codebase follows.
 *
 * ---------------------------------------------------------------------------
 * `isPublished` RIDES ALONG FOR § D, EVEN THOUGH THE PLAN'S PROSE ROW-DTO
 * DIDN'T NAME IT.
 * ---------------------------------------------------------------------------
 * `<DomainCell>` (`src/components/admin/domain-cell.tsx`) calls
 * `domainStatusFor`, which needs `Organization.status` AND whether the store
 * has ever published its home page — `Live` requires both. Without this field
 * every row would render `Offline` regardless of the organization's actual
 * status, which is a chip that lies (the one failure `06-UI-SPEC.md § D`
 * names explicitly). "Published" is read the same way
 * `src/server/theming/queries.ts` reads it elsewhere: `StorefrontPage
 * .publishedAt !== null` for the tenant's `"home"` page. `HOME_PAGE_TYPE` is
 * duplicated as a literal here rather than imported from
 * `src/server/theming/queries.ts`, for the same reason `ACTIVE_STATUS` is
 * duplicated in `src/server/admin/domain.ts` rather than imported from
 * `src/server/merchant/context.ts`: that module reads through `scopedDb`,
 * which this zone is fenced off from importing (TEN-05,
 * `eslint.config.mjs`).
 */

/** See the header. Pilot scale, not a hard platform ceiling. */
const ADMIN_MERCHANT_LEDGER_ROW_CAP = 1000;

/** `StorefrontPage.pageType` for the one page this phase checks — matches the
 * module-private constant of the same name in `src/server/theming/queries.ts`
 * and `src/server/theming/actions.ts`, duplicated rather than imported (see
 * the header). */
const HOME_PAGE_TYPE = "home";

/** `Member.role` for the organization's creator (`src/server/auth/auth.ts`'s
 * `creatorRole: "owner"`), matching the precedent in
 * `src/server/claims/notify.ts`'s `ownerEmailFor` and
 * `src/server/support/notify.ts`. */
const OWNER_ROLE = "owner";

/** One row of the § C1 merchants list. */
export interface AdminMerchantRow {
  readonly id: string;
  readonly storeName: string;
  readonly slug: string;
  readonly ownerName: string;
  readonly ownerEmail: string;
  /** `null` until the merchant completes plan selection (D-05). */
  readonly planTier: string | null;
  /** `Organization.status`, raw — `"active"` today; plan 06-14 adds
   * `"suspended"` as a live write path. */
  readonly status: string;
  readonly createdAt: Date;
  readonly productCount: number;
  readonly orderCount: number;
  /** Feeds `<DomainCell>` — see the header's `isPublished` note. */
  readonly isPublished: boolean;
}

/** § C2's full detail — every C1 field, plus the subscription and
 * at-a-glance figures a single row in a table has no room for. */
export interface AdminMerchantDetail extends AdminMerchantRow {
  readonly trialEndsAt: Date | null;
  /** `"none"` until Phase 6's merchant-pays-EINORT claim flow confirms one. */
  readonly subscriptionStatus: string;
  readonly subscriptionCurrentPeriodEnd: Date | null;
  /** The third § C2 "At a glance" figure C1 has no room for. */
  readonly pendingClaimCount: number;
}

/** The columns every row needs from `organization`, named once so the list
 * and detail reads cannot drift on which ones they select. */
const MERCHANT_ORG_COLUMNS = {
  id: true,
  name: true,
  slug: true,
  status: true,
  planTier: true,
  createdAt: true,
} as const;

interface OwnerLookup {
  readonly name: string;
  readonly email: string;
}

/** One `member` read for however many organization ids are on the current
 * page, merged by a `Map` — the store-name join idiom, applied to an owner
 * instead of a name. */
async function ownersFor(
  organizationIds: readonly string[],
): Promise<Map<string, OwnerLookup>> {
  if (organizationIds.length === 0) return new Map();

  const owners = await adminDb.member.findMany({
    where: { organizationId: { in: [...organizationIds] }, role: OWNER_ROLE },
    select: {
      organizationId: true,
      user: { select: { name: true, email: true } },
    },
  });

  return new Map(
    owners.map((owner) => [
      owner.organizationId,
      { name: owner.user.name, email: owner.user.email },
    ]),
  );
}

/** One `groupBy` each for products and orders, across however many
 * organization ids are on the current page — never a per-row query. */
async function countsFor(organizationIds: readonly string[]): Promise<{
  readonly products: Map<string, number>;
  readonly orders: Map<string, number>;
}> {
  if (organizationIds.length === 0) {
    return { products: new Map(), orders: new Map() };
  }

  const [productGroups, orderGroups] = await Promise.all([
    adminDb.product.groupBy({
      by: ["tenantId"],
      where: { tenantId: { in: [...organizationIds] } },
      _count: { _all: true },
    }),
    adminDb.order.groupBy({
      by: ["tenantId"],
      where: { tenantId: { in: [...organizationIds] } },
      _count: { _all: true },
    }),
  ]);

  return {
    products: new Map(
      productGroups.map((group) => [group.tenantId, group._count._all]),
    ),
    orders: new Map(
      orderGroups.map((group) => [group.tenantId, group._count._all]),
    ),
  };
}

/** One `storefrontPage` read for the `"home"` page across however many
 * organization ids are on the current page — see the header's `isPublished`
 * note for why this is here at all. */
async function publishedFlagsFor(
  organizationIds: readonly string[],
): Promise<Map<string, boolean>> {
  if (organizationIds.length === 0) return new Map();

  const pages = await adminDb.storefrontPage.findMany({
    where: {
      tenantId: { in: [...organizationIds] },
      pageType: HOME_PAGE_TYPE,
    },
    select: { tenantId: true, publishedAt: true },
  });

  return new Map(
    pages.map((page) => [page.tenantId, page.publishedAt !== null]),
  );
}

/**
 * The § C1 list, newest store first, optionally narrowed to one status.
 *
 * `status` is the only filter today, matching the § C1 `All stores` / `Active`
 * / `Suspended` select — there is no search input at pilot scale (§ C1, "an
 * unimplemented search input is worse than none").
 */
export async function listMerchantsForAdmin(
  filter: { readonly status?: "active" | "suspended" } = {},
): Promise<readonly AdminMerchantRow[]> {
  const organizations = await adminDb.organization.findMany({
    where: filter.status ? { status: filter.status } : {},
    orderBy: { createdAt: "desc" },
    select: MERCHANT_ORG_COLUMNS,
    take: ADMIN_MERCHANT_LEDGER_ROW_CAP,
  });

  if (organizations.length === 0) return [];

  const ids = organizations.map((org) => org.id);
  const [owners, counts, published] = await Promise.all([
    ownersFor(ids),
    countsFor(ids),
    publishedFlagsFor(ids),
  ]);

  return organizations.map((org) => {
    const owner = owners.get(org.id);
    return {
      id: org.id,
      storeName: org.name,
      slug: org.slug,
      ownerName: owner?.name ?? "",
      ownerEmail: owner?.email ?? "",
      planTier: org.planTier,
      status: org.status,
      createdAt: org.createdAt,
      productCount: counts.products.get(org.id) ?? 0,
      orderCount: counts.orders.get(org.id) ?? 0,
      isPublished: published.get(org.id) ?? false,
    };
  });
}

/**
 * True when `merchantId` names a real organization — nothing more.
 *
 * ADM-05 / SUB-03 (plan 06-11): `requestAdminThreadAttachmentUpload`
 * (`src/server/images/thread-upload.ts`) validates its caller-supplied target
 * tenant id against this before minting a presigned grant under that tenant's
 * prefix. An unvalidated id would let a typo — or a probe — mint a write
 * grant under a prefix nobody owns; `objectKeyFor` would happily compose the
 * key regardless, because it only checks the STRING is shaped like a tenant
 * id, never that the tenant behind it exists.
 *
 * A dedicated existence check rather than reusing `merchantDetailForAdmin`:
 * that function's owner/count/published joins exist to fill a detail page and
 * would be pure waste on a hot upload-mint path that needs one boolean.
 */
export async function merchantExistsForAdmin(
  merchantId: string,
): Promise<boolean> {
  const org = await adminDb.organization.findUnique({
    where: { id: merchantId },
    select: { id: true },
  });
  return org !== null;
}

/**
 * One store, in full, for `/admin/merchants/[id]` — `null` when `merchantId`
 * matches no row, so the page can call `notFound()` and render the same
 * response an unauthorized caller gets (D-06).
 */
export async function merchantDetailForAdmin(
  merchantId: string,
): Promise<AdminMerchantDetail | null> {
  const org = await adminDb.organization.findUnique({
    where: { id: merchantId },
    select: {
      ...MERCHANT_ORG_COLUMNS,
      trialEndsAt: true,
      subscriptionStatus: true,
      subscriptionCurrentPeriodEnd: true,
    },
  });

  if (!org) return null;

  const [owners, counts, published, pendingClaimCount] = await Promise.all([
    ownersFor([org.id]),
    countsFor([org.id]),
    publishedFlagsFor([org.id]),
    adminDb.paymentClaim.count({
      where: { tenantId: org.id, status: "PENDING" },
    }),
  ]);

  const owner = owners.get(org.id);

  return {
    id: org.id,
    storeName: org.name,
    slug: org.slug,
    ownerName: owner?.name ?? "",
    ownerEmail: owner?.email ?? "",
    planTier: org.planTier,
    status: org.status,
    createdAt: org.createdAt,
    productCount: counts.products.get(org.id) ?? 0,
    orderCount: counts.orders.get(org.id) ?? 0,
    isPublished: published.get(org.id) ?? false,
    trialEndsAt: org.trialEndsAt,
    subscriptionStatus: org.subscriptionStatus,
    subscriptionCurrentPeriodEnd: org.subscriptionCurrentPeriodEnd,
    pendingClaimCount,
  };
}
