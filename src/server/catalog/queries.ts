import "server-only";

import { scopedDb } from "@/server/db/tenant-scoped";

/**
 * The catalog reads (CAT-01) — everything `/dashboard/products` and 03-11's
 * product form need, and nothing a customer-facing surface should call.
 *
 * ---------------------------------------------------------------------------
 * THE `tenantId` PARAMETER HERE IS CORRECT, AND IS NOT WHAT TEN-04 BANS.
 * ---------------------------------------------------------------------------
 * `tests/unit/no-tenant-id-param.test.ts` forbids a tenant identifier in an
 * exported signature under `src/server/merchant/**` and
 * `src/server/entitlements/**`, because on those surfaces the tenant must come
 * from `session.session.activeOrganizationId` and a parameter would be a field
 * a caller could substitute. This module is not on that surface and is not
 * reachable from a client: the marker on line 1 fails the build if it is ever
 * pulled into a browser bundle, it exports no Server Action,
 * and every caller has already resolved the tenant through
 * `requireMerchantContext()`. `src/server/claims/queries.ts` set this precedent
 * one plan earlier and the scan's own doc comment names the distinction.
 *
 * The guarantee stays structural rather than trusted: `scopedDb` injects the
 * tenant into the `where` of every call it forwards, all four catalog models
 * are registered in `TENANT_SCOPED_MODELS`, and
 * `tests/isolation/model-registry-drift.test.ts` fails if one ever is not.
 *
 * ---------------------------------------------------------------------------
 * READS ONLY. NO MUTATION MAY EVER BE ADDED HERE.
 * ---------------------------------------------------------------------------
 * Every catalog write goes through `src/server/catalog/actions.ts`, so that the
 * trial gate (D-08 / SUB-02) and the plan cap (SUB-01) are enforced by one
 * wrapper on one surface. A write added to this module would be a write with no
 * gate at all, because nothing here runs inside `merchantAction`.
 */

/** One row of the A1 products list. */
export interface MerchantProductListItem {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly active: boolean;
  readonly basePriceXaf: number;
  /** `null` when the merchant filed the product under no category (D-06). */
  readonly categoryName: string | null;
  /** Summed across every variant — CAT-03's single stock level. */
  readonly stock: number;
  /** The `position: 0` hero image (D-10), or `null` when there is none. */
  readonly heroStorageKey: string | null;
}

/**
 * Every product this merchant owns, newest first — hidden ones included.
 *
 * A1 renders the whole catalog with a `Hidden` badge rather than filtering the
 * inactive rows out, and that is the point of D-08: a hidden product is still
 * the merchant's product. A list that silently omitted it would look exactly
 * like a list that had it removed, which is the impression the deactivate-only
 * rule exists to avoid.
 *
 * ---------------------------------------------------------------------------
 * STOCK IS SUMMED FROM A NESTED `select`, NOT FROM A SECOND ROUND TRIP.
 * ---------------------------------------------------------------------------
 * Prisma has no relation-aggregate in a `select` (`_count` counts rows; it does
 * not sum a column), so the honest choices are one query that returns each
 * variant's `stock` and adds them here, or a second `groupBy` keyed by product
 * id. The first is one round trip against `@@index([tenantId, productId])` and
 * returns a handful of integers per product — a merchant capped at 50 or 250
 * products, each capped at 50 variants, is a bounded result set by
 * construction. The second is a second network hop to Neon plus a join in
 * application code, which is more moving parts for the same answer.
 *
 * The nested `where`/`take` on images is what keeps this from fanning out: only
 * the hero is selected, because the list renders exactly one thumbnail.
 */
export async function listProductsForMerchant(
  tenantId: string,
): Promise<MerchantProductListItem[]> {
  const rows = await scopedDb(tenantId).product.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      basePriceXaf: true,
      category: { select: { name: true } },
      variants: { select: { stock: true } },
      images: {
        where: { position: 0 },
        select: { storageKey: true },
        take: 1,
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: row.active,
    basePriceXaf: row.basePriceXaf,
    categoryName: row.category?.name ?? null,
    stock: row.variants.reduce((total, variant) => total + variant.stock, 0),
    heroStorageKey: row.images[0]?.storageKey ?? null,
  }));
}

/**
 * One product with everything 03-11's form needs to render it, or `null`.
 *
 * `null` rather than a throw: the caller is a page, and a product id that does
 * not resolve — because it belongs to another tenant, or because the merchant
 * followed a stale link — is a `notFound()`, not a 500. The two cases are
 * deliberately indistinguishable from here: `scopedDb` filters by tenant, so
 * another merchant's product simply does not exist as far as this reader is
 * concerned, and no probe can tell "not yours" from "not there".
 *
 * Variants are ordered by their option values rather than by insertion, so the
 * A2 stock table reads in the same order the matrix was expanded in.
 */
export async function getProductForEdit(tenantId: string, productId: string) {
  return scopedDb(tenantId).product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      basePriceXaf: true,
      active: true,
      option1Name: true,
      option2Name: true,
      categoryId: true,
      variants: {
        orderBy: [{ option1Value: "asc" }, { option2Value: "asc" }],
        select: {
          id: true,
          option1Value: true,
          option2Value: true,
          priceXaf: true,
          stock: true,
          sku: true,
          active: true,
        },
      },
      images: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          storageKey: true,
          position: true,
          width: true,
          height: true,
        },
      },
    },
  });
}

/** What one product edit resolves to, or `null`. */
export type ProductForEdit = Awaited<ReturnType<typeof getProductForEdit>>;

/**
 * This merchant's categories, alphabetically (D-06).
 *
 * Free-form and merchant-defined — there is no shared taxonomy and there is not
 * meant to be one. A Douala boutique and a phone-accessory shop do not sort
 * their stock into the same boxes, and forcing them to pick from a platform
 * list is how a catalog becomes something a merchant fights.
 */
export async function listCategories(tenantId: string) {
  return scopedDb(tenantId).category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

/**
 * How many products count against the plan cap (SUB-01).
 *
 * ACTIVE only. D-08 forbids removing a product, so counting hidden rows would
 * ratchet the cap permanently downward: a merchant on Starter who listed 50
 * products and hid 40 of them would still be refused a 51st, with no action
 * available to them that could ever free a slot. That reads as a broken product
 * rather than as a limit, and a limit a merchant cannot act on is not a limit —
 * it is a dead end.
 *
 * The count matches `@@index([tenantId, active])` exactly, so Postgres answers
 * it from the index.
 */
export async function activeProductCount(tenantId: string): Promise<number> {
  return scopedDb(tenantId).product.count({ where: { active: true } });
}
