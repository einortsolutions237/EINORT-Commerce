import type { Prisma } from "@/generated/prisma/client";

/**
 * The sanctioned door to the generated CREATE-INPUT types — `enums.ts`'s
 * sibling, for the same reason and with the same discipline.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `scopedCreateData<T>` (see `src/server/db/tenant-scoped.ts`) cannot infer
 * `T`: its parameter is `Omit<T, "tenantId">`, and TypeScript cannot run an
 * `Omit` backwards. So every caller must name the generated input type
 * explicitly — and every caller lives in feature code, where
 * `eslint.config.mjs` makes importing the generated client an error. That rule
 * is the TEN-02/TEN-05 enforcement mechanism and cannot be waived per call
 * site: an `eslint-disable` at each one would teach every future reader that
 * the boundary is negotiable and would bury a real violation among benign
 * ones.
 *
 * The input types themselves are not dangerous. They are compile-time shapes
 * describing the columns of one table; nothing about them reaches a database,
 * and `scopedCreateData` emits no runtime code at all. So the import lives
 * here once, inside the sanctioned zone, exactly as the enum re-export does.
 *
 * ONE ALIAS PER MODEL, ADDED DELIBERATELY. Not `export type { Prisma }` and not
 * a wildcard: re-exporting the whole namespace would hand feature code every
 * `WhereInput`, `Select` and `Payload` type in the schema, which is how "the
 * generated client is not importable" quietly becomes "the generated client is
 * importable under a different name". A new entry here is a visible decision
 * in a diff, and `grep -rn "generated/prisma" src/` stays a two-hit audit.
 *
 * NOTE: no `import "server-only"`. This module is types only and is fully
 * erased at build time — same reasoning as `enums.ts`.
 */

/**
 * `OrderEvent` (ORD-05), written by `src/server/orders/transition.ts` and by
 * nothing else.
 *
 * The `Unchecked` variant is the right one: the audit row names its order by
 * `orderId` scalar rather than through a nested relation connect, because the
 * tenant-scope extension does NOT intercept nested writes (Pitfall 1/4) and a
 * nested create would therefore slip past the `tenantId` stamp.
 */
export type OrderEventCreateInput = Prisma.OrderEventUncheckedCreateInput;

/**
 * `Order` at genesis, written by `openOrderAtGenesis` in
 * `src/server/orders/transition.ts` and by nothing else.
 *
 * The `Unchecked` variant for the same reason as the audit row above: the row
 * is created with scalar columns only, never through a nested relation write,
 * because the tenant-scope extension hooks client operations rather than the
 * generated SQL and a nested create would land without a `tenantId` stamp
 * (Pitfall 1/4).
 */
export type OrderCreateInput = Prisma.OrderUncheckedCreateInput;

/**
 * One `OrderItem` row inside a `createMany` batch, written by
 * `src/server/orders/place.ts`.
 *
 * `createManyInput` and NOT `UncheckedCreateInput`: `createMany` takes an array
 * of a distinct, flatter type, and it is the one batch operation the extension
 * DOES intercept — `$allOperations` normalises the array and stamps every row.
 * That is precisely why the line items are a separate `createMany` call rather
 * than an `items: { create: [...] }` nested off the order.
 */
export type OrderItemCreateManyInput = Prisma.OrderItemCreateManyInput;

/**
 * `PaymentClaim` (CHK-04 / ORD-04), written by `submitClaim` in
 * `src/server/claims/submit.ts` and by nothing else. `src/server/claims/actions.ts`
 * only ever UPDATES a claim the customer already created.
 *
 * The `Unchecked` variant for the same Pitfall 1/4 reason as the rows above: the
 * claim names its order by the `orderId` scalar rather than through a nested
 * relation connect, because the tenant-scope extension hooks client operations
 * and a nested write would land with no `tenantId` stamp — on the one table
 * whose `@@unique([tenantId, referenceNormalized])` index IS requirement ORD-04.
 */
export type PaymentClaimCreateInput = Prisma.PaymentClaimUncheckedCreateInput;

/**
 * `MerchantPaymentSettings` (D-14), written by `savePaymentSettings` in
 * `src/server/payments/actions.ts` and by nothing else.
 *
 * The `Unchecked` variant, for the same Pitfall 1/4 reason as the rows above:
 * the row is written with scalar columns only. It is needed for the `create`
 * half of an UPSERT rather than a plain create — `scopedDb` stamps `tenantId`
 * into both `where` and `create`, so the caller must not name it, but the
 * generated input still demands it because every tenant-scoped model declares
 * `tenantId` required with no default.
 */
export type MerchantPaymentSettingsCreateInput =
  Prisma.MerchantPaymentSettingsUncheckedCreateInput;

/**
 * `Category` (D-06), written by `createCategory` in
 * `src/server/catalog/actions.ts` and by nothing else.
 *
 * The `Unchecked` variant for the same reason as every entry above: the row is
 * written with scalar columns only, never through a nested relation write.
 */
export type CategoryCreateInput = Prisma.CategoryUncheckedCreateInput;

/**
 * `Product` (CAT-01), written by `createProduct` in
 * `src/server/catalog/actions.ts` and by nothing else.
 *
 * `Unchecked` is load-bearing here beyond the usual reason. The checked variant
 * would expose `category: { connect: … }`, and a nested connect on a
 * tenant-scoped relation is precisely the shape Pitfall 1/4 warns about — it
 * does not pass through the scope extension. The unchecked variant offers only
 * the `categoryId` scalar, whose composite foreign key makes a cross-tenant
 * value a Postgres rejection (T-03-29) rather than a silent link.
 */
export type ProductCreateInput = Prisma.ProductUncheckedCreateInput;

/**
 * One `ProductVariant` row inside a `createMany` batch, written by
 * `src/server/catalog/actions.ts`.
 *
 * `CreateManyInput` and NOT `UncheckedCreateInput`, exactly as the order lines
 * above: `createMany` takes an array of a distinct, flatter type, and it is one
 * of the batch operations the scope extension DOES intercept. That is why the
 * variant matrix is written as its own `createMany` call rather than nested off
 * the product.
 */
export type ProductVariantCreateManyInput = Prisma.ProductVariantCreateManyInput;

/**
 * One `ProductImage` row inside a `createMany` batch (D-10), written by
 * `src/server/catalog/actions.ts`. Same reasoning as the variant batch above.
 */
export type ProductImageCreateManyInput = Prisma.ProductImageCreateManyInput;

/**
 * `StorefrontTheme` (EDIT-01 / ONB-04), written by `ensureStorefrontSeeded` and
 * `saveBranding` in `src/server/theming/actions.ts` and by nothing else.
 *
 * The `Unchecked` variant, and needed for the `create` half of an UPSERT rather
 * than a plain create — the same shape as `MerchantPaymentSettings` above,
 * because this model has the same single-column `@unique` on `tenantId`.
 * `scopedDb` stamps `tenantId` into both halves of an upsert, so the caller must
 * not name it, while the generated input still demands it because every
 * tenant-scoped model declares `tenantId` required with no default.
 */
export type StorefrontThemeCreateInput =
  Prisma.StorefrontThemeUncheckedCreateInput;

/**
 * `StorefrontPage` (EDIT-01 / ONB-04), written by the same two actions.
 *
 * Same `Unchecked` reasoning. The difference from the theme above is the
 * selector: this model's uniqueness is the composite `@@unique([tenantId,
 * pageType])`, so the upsert's `where` is `tenantId_pageType` — which is exactly
 * why `pageType` is a scalar the create half must supply rather than something
 * a relation write could imply.
 */
export type StorefrontPageCreateInput =
  Prisma.StorefrontPageUncheckedCreateInput;
