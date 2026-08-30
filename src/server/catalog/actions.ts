"use server";

import { randomBytes } from "node:crypto";

import { z } from "zod";

import { strings } from "@/lib/strings";
import type {
  CategoryCreateInput,
  ProductCreateInput,
  ProductImageCreateManyInput,
  ProductVariantCreateManyInput,
} from "@/server/db/model-inputs";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";
import { limitFor } from "@/server/entitlements/assert";
import { merchantAction } from "@/server/merchant/action";

import { activeProductCount } from "./queries";
import { slugifyProductName } from "./slug";
import {
  expandVariantMatrix,
  VariantAxisOrderError,
  VariantMatrixTooLargeError,
  type VariantCombination,
} from "./variant-matrix";

/**
 * Every catalog mutation there is (CAT-01, D-05, D-06, D-08, D-10, SUB-01).
 *
 * `"use server"` is the first line and there is deliberately no
 * `import "server-only"` beside it: the two markers are mutually exclusive, and
 * this module has to be reachable from 03-11's form and from A1's row island.
 * The reads it calls live in `./queries.ts`, which IS `server-only`.
 *
 * ---------------------------------------------------------------------------
 * THERE IS NO HARD-REMOVAL ACTION IN THIS FILE AND THERE NEVER WILL BE (D-08).
 * ---------------------------------------------------------------------------
 * A product is referenced by the order lines of every order that ever contained
 * it. Removing one either orphans a merchant's own sales history or cascades it
 * away, and neither is recoverable — nor is either what a merchant means when
 * they say "take this off my store". What they mean is `setProductActive(false)`
 * below: gone from the storefront, still in the records, reversible in one tap.
 *
 * The rule is phase-wide rather than `Product`-only. `updateProduct` does not
 * remove the variant rows for combinations a merchant drops either; it sets
 * them inactive, because an `OrderItem` may name the variant id.
 *
 * ---------------------------------------------------------------------------
 * EVERY EXPORT IS REACHABLE BY A DIRECT POST, SO THE SCHEMA IS THE BOUNDARY.
 * ---------------------------------------------------------------------------
 * A Server Action is a public endpoint that happens to have a pleasant client
 * binding; nothing obliges a caller to have loaded the form first. So no schema
 * below carries a tenant identifier and none carries a slug — the tenant comes
 * from `ctx`, which `merchantAction` resolved from the session before the
 * handler ran (TEN-04/TEN-08), and the slug is derived here (T-03-32).
 *
 * `mode: "write"` on all four is what enforces the read-only trial gate
 * (D-08 / SUB-02). Re-checking `ctx.canWrite` inside a handler would create a
 * second place for that rule to drift, which is what the wrapper exists to
 * prevent.
 *
 * ---------------------------------------------------------------------------
 * THE MERCHANT-FACING COPY THAT IS NOT IN `strings` IS INLINE AND SAYS WHY.
 * ---------------------------------------------------------------------------
 * `strings.products` (landed whole by 03-04) carries A1's and A2's visible
 * copy, and this plan reads it without appending — eight plans editing one copy
 * module in the same wave is eight merge conflicts. Three refusals below have
 * no string there because they are not states A2's form can produce: they are
 * what a tampered or stale payload gets. They are written locally, exactly as
 * `src/server/images/actions.ts` did one plan earlier and for the same reason,
 * and 03-11 owns lifting them into `strings.products` if its form ever needs to
 * render one.
 */

/**
 * A submitted variant set that does not match the axes the merchant declared.
 *
 * TEN-08: the client's array is a convenience that carries prices and stock;
 * `expandVariantMatrix` decides which combinations exist. A payload claiming a
 * `Size: XL` row on a product whose axes say `S, M` is smuggling a stocked
 * combination past the form, so it is refused wholesale rather than
 * reconciled — a partial accept would be the platform guessing at what the
 * merchant meant to sell.
 */
const VARIANT_SET_MISMATCH_MESSAGE =
  "Those options don't match the variants submitted. Reload the page and try again.";

/** A second option axis with no first one — see `VariantAxisOrderError`. */
const VARIANT_AXIS_ORDER_MESSAGE =
  "Fill in the first option before adding a second one.";

/**
 * Two independent slug draws collided, or a category name is already in use.
 *
 * For the product slug this is close to unreachable — the retry below draws a
 * fresh 6-character suffix — so the honest message is the generic one rather
 * than an explanation of an internal identifier the merchant never sees. For a
 * category it is the ordinary case of typing a name that already exists.
 */
const SLUG_UNAVAILABLE_MESSAGE = "Something went wrong. Try again in a moment.";
const CATEGORY_NAME_TAKEN_MESSAGE = "You already have a category with that name.";
const CATEGORY_NAME_UNUSABLE_MESSAGE =
  "Use at least one letter or number in the category name.";

// ---------------------------------------------------------------------------
// Slug derivation
// ---------------------------------------------------------------------------

/**
 * Lowercase alphanumerics — the same character set `slugifyProductName` emits,
 * so a suffixed slug is still a legal path segment.
 */
const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const SUFFIX_LENGTH = 6;

/**
 * The largest multiple of the alphabet size that fits in a byte.
 *
 * Bytes at or above it are DISCARDED rather than folded in with `%`, the same
 * rejection sampling `src/server/orders/order-number.ts` uses. A biased draw
 * here would never surface as a bug report — only as a collision rate someone
 * eventually blames on Postgres.
 */
const SUFFIX_REJECTION_CEILING =
  Math.floor(256 / SUFFIX_ALPHABET.length) * SUFFIX_ALPHABET.length;

function slugSuffix(): string {
  let out = "";
  while (out.length < SUFFIX_LENGTH) {
    for (const byte of randomBytes(SUFFIX_LENGTH * 2)) {
      if (byte >= SUFFIX_REJECTION_CEILING) continue;
      out += SUFFIX_ALPHABET[byte % SUFFIX_ALPHABET.length];
      if (out.length === SUFFIX_LENGTH) break;
    }
  }
  return out;
}

/**
 * A slug guaranteed to be non-empty and distinct from the previous attempt.
 *
 * `slugifyProductName` returns `""` by contract for a name made entirely of
 * characters it strips, and that empty result is handled in exactly one place —
 * here — alongside the collision retry, so there is one fallback rather than
 * two that could drift apart.
 */
function suffixedSlug(base: string): string {
  return base === "" ? slugSuffix() : `${base}-${slugSuffix()}`;
}

/** A unique-constraint violation, recognised without importing the client. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * What the merchant may say about ONE combination.
 *
 * The option values are here so the server can match a submitted row to a
 * combination it computed itself — they are a lookup key, never the definition
 * of which rows exist. `priceXaf` is nullable because NULL inherits
 * `Product.basePriceXaf`, which is what "leave blank to use the product price"
 * means in A2.
 */
const variantSchema = z.object({
  option1Value: z.string(),
  option2Value: z.string(),
  priceXaf: z.number().int().nonnegative().nullable(),
  stock: z.number().int().nonnegative(),
  sku: z.string().trim().max(60).nullable(),
  active: z.boolean(),
});

/**
 * One uploaded image (D-10 / CAT-02).
 *
 * `storageKey` is minted by `src/server/images/actions.ts` from the tenant in
 * the session and an id that process generated, so it is not a path a browser
 * composed. Position is NOT in the schema: the ORDER of this array is the
 * merchant's chosen order, and the hero is whatever they put first.
 */
const imageSchema = z.object({
  storageKey: z.string().min(1).max(200),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

/**
 * The fields shared by create and update.
 *
 * No `tenantId`. No `slug`. No `active` — visibility is `setProductActive`'s
 * single job, so there is exactly one write behind both the A1 row action and
 * the A2 visibility switch and exactly one place for that rule to live.
 *
 * `.max(5)` on images is half of the T-03-33 defence; the other half is
 * `VARIANT_MATRIX_MAX` inside `expandVariantMatrix`.
 */
const productFields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  basePriceXaf: z.number().int().nonnegative(),
  option1Name: z.string().trim().min(1).max(40).nullable().optional(),
  values1: z.array(z.string()).max(100).optional(),
  option2Name: z.string().trim().min(1).max(40).nullable().optional(),
  values2: z.array(z.string()).max(100).optional(),
  variants: z.array(variantSchema).max(100),
  images: z.array(imageSchema).max(5),
};

const createProductSchema = z.object(productFields);
const updateProductSchema = z.object({
  ...productFields,
  productId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Variant reconciliation
// ---------------------------------------------------------------------------

type VariantInput = z.infer<typeof variantSchema>;

/**
 * The natural key of a variant within its product.
 *
 * The separator is NUL because it cannot occur in an option value a merchant
 * typed, so `("A", "B/C")` and `("A/B", "C")` cannot collapse to the same key —
 * which a `/` join would let them do, silently merging two real combinations
 * into one row's stock.
 */
function combinationKey(combination: {
  option1Value: string;
  option2Value: string;
}): string {
  return `${combination.option1Value}\u0000${combination.option2Value}`;
}

/**
 * The server's combinations paired with the merchant's prices and stock, or
 * `null` when the two sets are not the same set.
 *
 * "Same set" is checked in both directions on purpose: a submitted row the
 * expansion did not produce is the smuggled combination of T-03-31, and a
 * combination with no submitted row would otherwise be written silently at
 * stock 0 — a product the merchant believes they stocked and cannot sell.
 */
function alignVariants(
  combinations: readonly VariantCombination[],
  submitted: readonly VariantInput[],
): VariantInput[] | null {
  if (submitted.length !== combinations.length) return null;

  const byKey = new Map<string, VariantInput>();
  for (const row of submitted) {
    const key = combinationKey({
      option1Value: row.option1Value.trim(),
      option2Value: row.option2Value.trim(),
    });
    // A duplicate key means the payload names one combination twice; the
    // length check above then cannot catch the missing one, so refuse here.
    if (byKey.has(key)) return null;
    byKey.set(key, row);
  }

  const aligned: VariantInput[] = [];
  for (const combination of combinations) {
    const row = byKey.get(combinationKey(combination));
    if (!row) return null;
    aligned.push({
      ...row,
      option1Value: combination.option1Value,
      option2Value: combination.option2Value,
    });
  }

  return aligned;
}

/**
 * Expand the declared axes and pair them with the submitted rows, or produce
 * the field error the caller should return.
 *
 * Both matrix errors are converted here rather than allowed to escape:
 * `VariantMatrixTooLargeError` is A2's own copy with the computed count
 * substituted, and the axis-order error is a shape only a hand-built payload
 * can have.
 */
function resolveVariants(input: {
  option1Name?: string | null;
  values1?: readonly string[];
  option2Name?: string | null;
  values2?: readonly string[];
  variants: readonly VariantInput[];
}):
  | { ok: true; rows: VariantInput[] }
  | { ok: false; error: Record<string, string[]> } {
  let combinations: VariantCombination[];
  try {
    combinations = expandVariantMatrix({
      option1Name: input.option1Name ?? null,
      values1: input.values1 ?? [],
      option2Name: input.option2Name ?? null,
      values2: input.values2 ?? [],
    });
  } catch (error) {
    if (error instanceof VariantMatrixTooLargeError) {
      return {
        ok: false,
        error: {
          variants: [
            strings.products.variantLimitExceeded.replace(
              "{n}",
              String(error.count),
            ),
          ],
        },
      };
    }
    if (error instanceof VariantAxisOrderError) {
      return { ok: false, error: { option2Name: [VARIANT_AXIS_ORDER_MESSAGE] } };
    }
    throw error;
  }

  const rows = alignVariants(combinations, input.variants);
  if (!rows) {
    return { ok: false, error: { variants: [VARIANT_SET_MISMATCH_MESSAGE] } };
  }

  return { ok: true, rows };
}

/**
 * The axis names as they are stored: NULL when the axis carries no usable
 * values, so a merchant who typed `Size` and no values does not leave a product
 * claiming an option it has no combinations for.
 */
function storedAxisNames(
  input: {
    option1Name?: string | null;
    option2Name?: string | null;
  },
  rows: readonly VariantInput[],
): { option1Name: string | null; option2Name: string | null } {
  const usesAxis1 = rows.some((row) => row.option1Value !== "");
  const usesAxis2 = rows.some((row) => row.option2Value !== "");
  return {
    option1Name: usesAxis1 ? (input.option1Name ?? null) : null,
    option2Name: usesAxis2 ? (input.option2Name ?? null) : null,
  };
}

// ---------------------------------------------------------------------------
// createCategory (D-06)
// ---------------------------------------------------------------------------

/**
 * A merchant-defined category, created inline from the product form.
 *
 * D-06 makes categories free-form and merchant-owned: there is no platform
 * taxonomy, because a Douala boutique and a phone-accessory shop do not sort
 * their stock into the same boxes. That is why this is its own two-field action
 * rather than a page — the merchant meets the need mid-form, while naming a
 * product, and sending them to a separate screen to satisfy it would lose the
 * form they were filling in.
 */
const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(60),
});

/**
 * What a successful category create hands back.
 *
 * `merchantAction`'s success arm is `{ ok: true } & R`, and `R` appears only in
 * the handler's return position, so TypeScript cannot infer it from the config
 * object — it has to be named. Naming it also gives 03-11's form a type to
 * import instead of restating the three fields, which is what lets it drop the
 * new category into its own `select` without a refetch.
 */
export type CreatedCategory = {
  category: { id: string; name: string; slug: string };
};

export const createCategory = merchantAction<
  typeof createCategorySchema,
  CreatedCategory
>({
  mode: "write",
  schema: createCategorySchema,
  handler: async (ctx, { name }) => {
    const slug = slugifyProductName(name);
    if (slug === "") {
      // A name made entirely of characters the slug rules strip. Refusing is
      // honest: a category addressed by an invented identifier is one the
      // merchant cannot recognise in a URL later.
      return { ok: false, error: { name: [CATEGORY_NAME_UNUSABLE_MESSAGE] } };
    }

    try {
      const category = await scopedDb(ctx.tenantId).category.create({
        data: scopedCreateData<CategoryCreateInput>({ name, slug }),
        select: { id: true, name: true, slug: true },
      });
      return { ok: true as const, category };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { ok: false, error: { name: [CATEGORY_NAME_TAKEN_MESSAGE] } };
      }
      throw error;
    }
  },
});

// ---------------------------------------------------------------------------
// createProduct (CAT-01, SUB-01)
// ---------------------------------------------------------------------------

/**
 * List a product: the cap check, the matrix, the slug and one transaction.
 *
 * ---------------------------------------------------------------------------
 * THE CAP IS COUNTED BEFORE THE WRITE, AND THIS IS THE CONTROL (T-03-30).
 * ---------------------------------------------------------------------------
 * A1 disables `Add product` at the cap. That is a courtesy to the merchant and
 * nothing more: this action is reachable by a POST that never loaded the page,
 * so the refusal below is what actually enforces SUB-01. The same order
 * `switchPlan` uses — count first, refuse before touching anything.
 *
 * DECISION 1: deactivated products do NOT count. D-08 forbids removal, so
 * counting hidden rows would ratchet the cap permanently downward with no
 * action available to the merchant that could free a slot.
 *
 * DECISION 2: the count and the create are deliberately NOT atomic. Two
 * simultaneous submits could both read `count = limit - 1` and both write, so
 * a merchant could reach `limit + 1`. That is one row, for one merchant, who
 * would have to submit twice within a few milliseconds from one dashboard. A
 * counter column or a serializable transaction buys nothing at pilot scale and
 * costs a new invariant to keep true on every write path.
 */
export type CreatedProduct = { productId: string; slug: string };

export const createProduct = merchantAction<
  typeof createProductSchema,
  CreatedProduct
>({
  mode: "write",
  schema: createProductSchema,
  handler: async (ctx, input) => {
    const limit = limitFor(ctx, "products");
    if (limit !== null) {
      const count = await activeProductCount(ctx.tenantId);
      if (count >= limit) {
        return {
          ok: false,
          error: {
            form: [
              strings.entitlements.productLimitReached.replace(
                "{cap}",
                String(limit),
              ),
            ],
          },
        };
      }
    }

    const resolved = resolveVariants(input);
    if (!resolved.ok) return resolved;
    const { rows } = resolved;
    const axes = storedAxisNames(input, rows);

    const base = slugifyProductName(input.name);
    let slug = base === "" ? slugSuffix() : base;

    /*
     * ONE retry, and only for a slug collision.
     *
     * `@@unique([tenantId, slug])` is the real guarantee; the derivation only
     * makes a collision likely enough to plan for — two products genuinely
     * named the same thing is an ordinary day in a catalog, not an edge case.
     * A second collision against a fresh 6-character suffix is not a
     * probability worth a loop for, and an unbounded retry would mask a real
     * fault as a hang.
     */
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const productId = await scopedDb(ctx.tenantId).$transaction(
          async (tx) => {
            const product = await tx.product.create({
              data: scopedCreateData<ProductCreateInput>({
                name: input.name,
                slug,
                description: input.description ?? null,
                basePriceXaf: input.basePriceXaf,
                categoryId: input.categoryId ?? null,
                option1Name: axes.option1Name,
                option2Name: axes.option2Name,
              }),
              select: { id: true },
            });

            /*
             * THREE SEPARATE CALLS, NEVER A NESTED `create` (Pitfall 1).
             *
             * The scope extension hooks client operations rather than the
             * generated SQL, so a child written through a nested relation never
             * passes through it and lands with no tenant stamp. `createMany` IS
             * intercepted: `$allOperations` normalises the array and stamps
             * every row.
             */
            await tx.productVariant.createMany({
              data: rows.map((row) =>
                scopedCreateData<ProductVariantCreateManyInput>({
                  productId: product.id,
                  option1Value: row.option1Value,
                  option2Value: row.option2Value,
                  priceXaf: row.priceXaf,
                  stock: row.stock,
                  sku: row.sku,
                  active: row.active,
                }),
              ),
            });

            if (input.images.length > 0) {
              await tx.productImage.createMany({
                data: input.images.map((image, position) =>
                  scopedCreateData<ProductImageCreateManyInput>({
                    productId: product.id,
                    storageKey: image.storageKey,
                    // D-10: the merchant's first image is the hero.
                    position,
                    width: image.width,
                    height: image.height,
                  }),
                ),
              });
            }

            return product.id;
          },
        );

        return { ok: true as const, productId, slug };
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 1) {
          /*
           * A forged `categoryId` naming another tenant's category lands here
           * as a foreign-key rejection from the composite FK (T-03-29), and it
           * is rethrown rather than dressed up as a field error. A1 and A2 only
           * ever offer this merchant's own categories, so a value that fails
           * the FK did not come from the form — and the transaction has already
           * rolled the product row back, which
           * `tests/isolation/catalog.test.ts` asserts directly.
           */
          if (!isUniqueViolation(error)) throw error;
          return { ok: false, error: { name: [SLUG_UNAVAILABLE_MESSAGE] } };
        }
        slug = suffixedSlug(base);
      }
    }

    // Unreachable: the loop either returns or rethrows on its second attempt.
    return { ok: false, error: { name: [SLUG_UNAVAILABLE_MESSAGE] } };
  },
});

// ---------------------------------------------------------------------------
// updateProduct
// ---------------------------------------------------------------------------

/**
 * Edit a product in place.
 *
 * THE CAP IS NOT RE-CHECKED. Editing adds no product, and re-counting here
 * would strand a merchant who is already at their cap: they could no longer fix
 * a price or correct a stock count on the catalog they legitimately own, which
 * turns a limit into a lockout.
 *
 * THE SLUG IS NOT REDERIVED. A product's URL is what the merchant has already
 * shared on WhatsApp; silently moving it because they fixed a typo in the name
 * would break every link they sent. Phase 4 owns a deliberate address change if
 * one is ever wanted.
 *
 * Reconciliation, not replacement. Combinations the merchant dropped are set
 * inactive rather than removed, because an `OrderItem` may name the variant id
 * and the no-hard-removal rule is phase-wide, not `Product`-only.
 */
export const updateProduct = merchantAction({
  mode: "write",
  schema: updateProductSchema,
  handler: async (ctx, input) => {
    const resolved = resolveVariants(input);
    if (!resolved.ok) return resolved;
    const { rows } = resolved;
    const axes = storedAxisNames(input, rows);

    await scopedDb(ctx.tenantId).$transaction(async (tx) => {
      await tx.product.update({
        where: { id: input.productId },
        data: {
          name: input.name,
          description: input.description ?? null,
          basePriceXaf: input.basePriceXaf,
          categoryId: input.categoryId ?? null,
          option1Name: axes.option1Name,
          option2Name: axes.option2Name,
        },
      });

      // ------------------------------------------------------------------
      // Variants, keyed by (option1Value, option2Value)
      // ------------------------------------------------------------------
      const existingVariants = await tx.productVariant.findMany({
        where: { productId: input.productId },
        select: { id: true, option1Value: true, option2Value: true },
      });
      const variantIdByKey = new Map(
        existingVariants.map((variant) => [combinationKey(variant), variant.id]),
      );

      const fresh: ProductVariantCreateManyInput[] = [];
      const survivors = new Set<string>();

      for (const row of rows) {
        const key = combinationKey(row);
        survivors.add(key);
        const id = variantIdByKey.get(key);

        if (id === undefined) {
          fresh.push(
            scopedCreateData<ProductVariantCreateManyInput>({
              productId: input.productId,
              option1Value: row.option1Value,
              option2Value: row.option2Value,
              priceXaf: row.priceXaf,
              stock: row.stock,
              sku: row.sku,
              active: row.active,
            }),
          );
          continue;
        }

        await tx.productVariant.update({
          where: { id },
          data: {
            priceXaf: row.priceXaf,
            stock: row.stock,
            sku: row.sku,
            active: row.active,
          },
        });
      }

      if (fresh.length > 0) {
        await tx.productVariant.createMany({ data: fresh });
      }

      for (const variant of existingVariants) {
        if (survivors.has(combinationKey(variant))) continue;
        // Dropped by the merchant, retained by the platform. Its stock is
        // frozen where it stood and it stops being sellable; the row survives
        // because an order line may still point at it.
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { active: false },
        });
      }

      // ------------------------------------------------------------------
      // Images, keyed by storageKey (D-10)
      // ------------------------------------------------------------------
      const existingImages = await tx.productImage.findMany({
        where: { productId: input.productId },
        select: { id: true, storageKey: true },
      });

      /*
       * POSITIONS ARE VACATED BEFORE THEY ARE REASSIGNED.
       *
       * `@@unique([tenantId, productId, position])` means that promoting the
       * third photo to hero collides with the photo already at 0 the instant
       * the first update lands — Postgres checks the constraint per statement,
       * not at commit. Parking every row at a distinct negative position first
       * empties the whole range, so the second pass can assign 0..n freely.
       */
      for (const [index, image] of existingImages.entries()) {
        await tx.productImage.update({
          where: { id: image.id },
          data: { position: -(index + 1) },
        });
      }

      const imageIdByKey = new Map(
        existingImages.map((image) => [image.storageKey, image.id]),
      );
      const keptKeys = new Set(input.images.map((image) => image.storageKey));

      const newImages: ProductImageCreateManyInput[] = [];
      for (const [position, image] of input.images.entries()) {
        const id = imageIdByKey.get(image.storageKey);
        if (id === undefined) {
          newImages.push(
            scopedCreateData<ProductImageCreateManyInput>({
              productId: input.productId,
              storageKey: image.storageKey,
              position,
              width: image.width,
              height: image.height,
            }),
          );
          continue;
        }
        await tx.productImage.update({ where: { id }, data: { position } });
      }

      /*
       * Photos the merchant dropped are parked AFTER the ones they kept, so the
       * hero and the ordering they chose are exactly what they asked for.
       *
       * They are not removed, because this module writes no hard-removal path
       * at all (D-08 above) and `ProductImage` carries no `active` column to
       * hide one with. 03-11 owns the merchant-facing remove affordance and the
       * R2 object it would also have to release; until then a dropped photo is
       * inert rather than gone. `deferred-items.md` in this phase records it.
       */
      let tail = input.images.length;
      for (const image of existingImages) {
        if (keptKeys.has(image.storageKey)) continue;
        await tx.productImage.update({
          where: { id: image.id },
          data: { position: tail },
        });
        tail += 1;
      }

      if (newImages.length > 0) {
        await tx.productImage.createMany({ data: newImages });
      }
    });

    return { ok: true as const };
  },
});

// ---------------------------------------------------------------------------
// setProductActive (D-08)
// ---------------------------------------------------------------------------

/**
 * Hide a product from the storefront, or bring it back.
 *
 * The single write behind both the A1 row action and the A2 visibility switch —
 * one action, so the rule about what "hidden" means cannot be two rules. It is
 * symmetric by construction: the same call with `true` undoes it, which is what
 * lets A1's confirmation dialog be an ordinary one rather than a destructive
 * one. Styling a reversible action red teaches merchants to fear a safe one.
 *
 * This is the whole of what "remove it from my store" means in this product.
 */
export const setProductActive = merchantAction({
  mode: "write",
  schema: z.object({
    productId: z.string().min(1),
    active: z.boolean(),
  }),
  handler: async (ctx, { productId, active }) => {
    await scopedDb(ctx.tenantId).product.update({
      where: { id: productId },
      data: { active },
    });
    return { ok: true as const };
  },
});
