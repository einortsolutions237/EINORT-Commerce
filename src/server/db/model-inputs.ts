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
