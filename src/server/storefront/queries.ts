import "server-only";

import { scopedDb } from "@/server/db/tenant-scoped";

import type { StoredCart } from "../cart/cache";

/**
 * What an anonymous visitor may see — as distinct from
 * `src/server/catalog/queries.ts` (03-06, not yet landed in this worktree),
 * which answers "what does this merchant own". The two modules read the same
 * tables under deliberately different filters and must not merge: a merchant
 * product list has to include inactive and out-of-stock rows so the owner can
 * manage them, and this module must never leak one to a shopper.
 *
 * Every export here is a plain read behind `scopedDb(tenantId)` — there is no
 * write in this file, and no caller may pass anything the client supplied as
 * `tenantId`; it always comes from `resolveTenantBySlug`.
 */

/** The catalog grid tile (B1). No description, no variant detail — those cost a second query the grid does not need. */
export type StorefrontProductListItem = {
  id: string;
  name: string;
  slug: string;
  /** The minimum active-variant price override, or the product's own base price. */
  priceXaf: number;
  /** The `position: 0` image's derivative-prefix `storageKey` (D-10), or `null`. */
  imageKey: string | null;
  /** Summed stock across every active variant. D-09: this drives the tile's chip, never whether the tile renders. */
  inStock: boolean;
};

/** Rendered only when the merchant has two or more (D-06). */
export type StorefrontCategory = {
  id: string;
  name: string;
  slug: string;
};

export type StorefrontVariant = {
  id: string;
  option1Value: string;
  option2Value: string;
  /** Resolved: the variant's own `priceXaf` override, or the product's `basePriceXaf`. */
  priceXaf: number;
  stock: number;
};

export type StorefrontImage = {
  storageKey: string;
  position: number;
};

/** The PDP's full read (B2). */
export type StorefrontProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  option1Name: string | null;
  option2Name: string | null;
  categoryName: string | null;
  images: StorefrontImage[];
  variants: StorefrontVariant[];
};

/**
 * `"M / Blue"`, or `"M"`, or `""` for the no-options product's single implicit
 * `("", "")` variant.
 *
 * TEMPORARY LOCATION, reproduced rather than imported for the same reason
 * `src/server/orders/place.ts` reproduces it: 03-06 owns the canonical
 * `variantLabelFor` at `src/server/catalog/variant-matrix.ts`, and that plan
 * has not run in this worktree (03-09 depends on 03-01/03-02/03-04 only).
 * Creating the file from here would collide with 03-06's own version of it.
 * The behaviour matches `place.ts`'s `snapshotVariantLabel` exactly, and
 * swapping this for the import is a one-line change once 03-06 lands.
 */
function variantLabelFor(variant: {
  option1Value: string;
  option2Value: string;
}): string {
  return [variant.option1Value, variant.option2Value]
    .filter((value) => value.length > 0)
    .join(" / ");
}

/**
 * The catalog grid (B1) — D-08: `active: true` products only. A deactivated
 * product is invisible on the storefront by design; it still exists for the
 * merchant to reactivate, which is why `active` is a filter here and not a
 * delete anywhere in this codebase.
 *
 * `categorySlug` filters at the database level. The store-empty check in
 * `src/app/s/[slug]/page.tsx` reads the length of THIS call's result — there
 * is deliberately only one call site, so a category with zero products in it
 * currently falls through to the same Phase-1 placeholder as a genuinely
 * empty store. That is a known, narrow trade-off (see the page's own header
 * comment), not an oversight.
 */
export async function listStorefrontProducts(
  tenantId: string,
  categorySlug?: string,
): Promise<StorefrontProductListItem[]> {
  const db = scopedDb(tenantId);

  const products = await db.product.findMany({
    where: {
      active: true,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      basePriceXaf: true,
      images: {
        where: { position: 0 },
        select: { storageKey: true },
        take: 1,
      },
      variants: {
        where: { active: true },
        select: { priceXaf: true, stock: true },
      },
    },
  });

  return products.map((product) => {
    const overridePrices = product.variants
      .map((variant) => variant.priceXaf)
      .filter((price): price is number => price !== null);
    const minOverride =
      overridePrices.length > 0 ? Math.min(...overridePrices) : null;
    const totalStock = product.variants.reduce(
      (sum, variant) => sum + variant.stock,
      0,
    );

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      priceXaf: minOverride ?? product.basePriceXaf,
      imageKey: product.images[0]?.storageKey ?? null,
      inStock: totalStock > 0,
    };
  });
}

/** D-06: only categories that currently have at least one active product. */
export async function listStorefrontCategories(
  tenantId: string,
): Promise<StorefrontCategory[]> {
  const db = scopedDb(tenantId);

  const categories = await db.category.findMany({
    where: { products: { some: { active: true } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return categories;
}

/**
 * The PDP read (B2). `null` for a foreign, inactive, or nonexistent slug —
 * indistinguishable on purpose (T-03-48), so the page's `notFound()` cannot be
 * used to probe whether a slug belongs to this tenant.
 */
export async function getStorefrontProduct(
  tenantId: string,
  productSlug: string,
): Promise<StorefrontProductDetail | null> {
  const db = scopedDb(tenantId);

  const product = await db.product.findFirst({
    where: { slug: productSlug, active: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      basePriceXaf: true,
      option1Name: true,
      option2Name: true,
      category: { select: { name: true } },
      images: {
        orderBy: { position: "asc" },
        select: { storageKey: true, position: true },
      },
      variants: {
        where: { active: true },
        select: {
          id: true,
          option1Value: true,
          option2Value: true,
          priceXaf: true,
          stock: true,
        },
      },
    },
  });

  if (!product) return null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    option1Name: product.option1Name,
    option2Name: product.option2Name,
    categoryName: product.category?.name ?? null,
    images: product.images,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      option1Value: variant.option1Value,
      option2Value: variant.option2Value,
      priceXaf: variant.priceXaf ?? product.basePriceXaf,
      stock: variant.stock,
    })),
  };
}

/** A cart line ready to render — every amount and label computed here, from database rows (TEN-08). */
export type HydratedCartLine = {
  variantId: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPriceXaf: number;
  lineTotalXaf: number;
  imageKey: string | null;
  availableStock: number;
  /**
   * `"clamped"` — the stored quantity exceeded current stock and was reduced.
   * `"unavailable"` — the variant or its product is gone or deactivated.
   * `"none"` — the line rendered exactly as stored.
   */
  adjustment: "none" | "clamped" | "unavailable";
};

/**
 * Turn `{variantId, quantity}` lines into display lines.
 *
 * **Every amount is computed here from database rows.** `stored` contributes
 * only ids and quantities — nothing else on the stored object is read, so an
 * extra key a caller happens to be carrying (or a hostile one smuggled through
 * a tampered cookie payload) cannot reach this function's output (TEN-08).
 */
export async function hydrateCart(
  tenantId: string,
  stored: StoredCart | null,
): Promise<HydratedCartLine[]> {
  if (!stored || stored.items.length === 0) return [];

  const db = scopedDb(tenantId);

  const variantIds = stored.items.map((item) => item.variantId);
  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      option1Value: true,
      option2Value: true,
      priceXaf: true,
      stock: true,
      active: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          basePriceXaf: true,
          active: true,
          images: {
            where: { position: 0 },
            select: { storageKey: true },
            take: 1,
          },
        },
      },
    },
  });
  const byId = new Map(variants.map((variant) => [variant.id, variant]));

  const lines: HydratedCartLine[] = [];

  for (const item of stored.items) {
    const variant = byId.get(item.variantId);

    if (!variant || !variant.active || !variant.product.active) {
      // THE IDENTITY FIELDS SURVIVE DEACTIVATION; THE MONEY FIELDS DO NOT.
      // B3's removed-item note names the product — *{name} is no longer
      // available and has been removed.* — so a deactivated row that came back
      // with a name has to hand that name on, or the shopper reads a sentence
      // with a hole where the product used to be. The amounts are still zeroed
      // and the quantity is still dropped: a line the shopper cannot buy must
      // not contribute to a total, and `src/server/orders/place.ts` will refuse
      // it independently at placement (D-08 means the row is deactivated, never
      // deleted, so the lookup normally succeeds and only `active` is false).
      lines.push({
        variantId: item.variantId,
        productSlug: variant?.product.slug ?? "",
        productName: variant?.product.name ?? "",
        variantLabel: variant ? variantLabelFor(variant) : "",
        quantity: 0,
        unitPriceXaf: 0,
        lineTotalXaf: 0,
        imageKey: variant?.product.images[0]?.storageKey ?? null,
        availableStock: 0,
        adjustment: "unavailable",
      });
      continue;
    }

    const unitPriceXaf = variant.priceXaf ?? variant.product.basePriceXaf;
    const clampedQuantity = Math.max(0, Math.min(item.quantity, variant.stock));
    const adjustment: HydratedCartLine["adjustment"] =
      clampedQuantity < item.quantity ? "clamped" : "none";

    lines.push({
      variantId: variant.id,
      productSlug: variant.product.slug,
      productName: variant.product.name,
      variantLabel: variantLabelFor(variant),
      quantity: clampedQuantity,
      unitPriceXaf,
      lineTotalXaf: unitPriceXaf * clampedQuantity,
      imageKey: variant.product.images[0]?.storageKey ?? null,
      availableStock: variant.stock,
      adjustment,
    });
  }

  return lines;
}

/** The header bubble number (B1) — the sum of hydrated quantities. */
export function cartLineCount(hydrated: HydratedCartLine[]): number {
  return hydrated.reduce((sum, line) => sum + line.quantity, 0);
}
