import "server-only";

import { scopedDb } from "@/server/db/tenant-scoped";

/**
 * Quick task 260906-egn — the first authenticated typeahead endpoint in this
 * codebase: the Cmd/Ctrl+K search modal over a merchant's own Products and
 * Orders.
 *
 * ---------------------------------------------------------------------------
 * WHY A TOP-LEVEL `OR` IS TENANT-SAFE HERE.
 * ---------------------------------------------------------------------------
 * `scopedDb(tenantId)` (`src/server/db/tenant-scoped.ts`) rewrites every
 * `findMany`'s `where` as `{ ...where, tenantId }` — `tenantId` is spread in
 * as a SIBLING key of whatever the caller passed, including a top-level `OR`
 * array. A sibling of an `OR` is an implicit AND in Prisma's query language
 * (`{ OR: [...], tenantId }` compiles to `(a OR b OR c) AND tenantId = ?`), so
 * there is no arrangement of the `OR`'s branches that can widen the result
 * past this tenant's own rows. This is the same guarantee every other
 * `scopedDb` caller in the codebase relies on; nothing here is a new
 * exception to it. `tests/isolation/search.test.ts` asserts it against a real
 * Postgres rather than by inspection.
 *
 * ---------------------------------------------------------------------------
 * EVERY `contains` ON A TEXT COLUMN GETS `mode: "insensitive"` — EXCEPT ONE.
 * ---------------------------------------------------------------------------
 * Postgres `LIKE`/`ILIKE` semantics mean a case-sensitive `contains` would
 * silently fail to match "shirt" against a product named "Shirt", which reads
 * to a merchant as "search is broken" rather than as a deliberate constraint.
 * `Order.customerPhone` is the one exception: `src/server/checkout/actions.ts`
 * normalizes it to digits-only MSISDN before `placeOrder` persists it
 * (T-egn's customers-metric reasoning applies here too), so case sensitivity
 * is meaningless for a string that never contains a letter — adding `mode`
 * there would be a no-op that invites a reader to wonder why it is missing
 * everywhere else.
 *
 * ---------------------------------------------------------------------------
 * NO `pg_trgm`, NO FULL-TEXT INDEX, NO `$queryRaw`.
 * ---------------------------------------------------------------------------
 * A `%q%` pattern cannot use a B-tree index, so this is an accepted sequential
 * scan over a tiny tenant-filtered set at pilot scale. Reaching for a trigram
 * index or Postgres full-text search here would be scope creep for a quick
 * task, and `$queryRaw`/`$executeRaw` are lint-banned repository-wide
 * (`eslint.config.mjs`, `no-restricted-syntax`) regardless.
 *
 * `channel` is selected on the order arm even though the plan's own interface
 * sketch did not list it: `dashboard-topbar-search.tsx` renders each order hit
 * through `OrderStateChip`, whose `channel` prop is required to pick the
 * right state vocabulary for that row (see `src/components/order-state-chip.tsx`).
 * Omitting it would be a compile error at the call site, not a smaller query.
 */
export async function searchMerchantSurface(tenantId: string, q: string) {
  const db = scopedDb(tenantId);

  const [products, orders] = await Promise.all([
    db.product.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, active: true, basePriceXaf: true },
    }),
    db.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" } },
          { customerName: { contains: q, mode: "insensitive" } },
          // No `mode`: customerPhone is a normalized digits-only MSISDN.
          { customerPhone: { contains: q } },
        ],
      },
      orderBy: { placedAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        state: true,
        channel: true,
        totalXaf: true,
      },
    }),
  ]);

  return { products, orders };
}

/**
 * Named so `src/server/search/actions.ts` can annotate its handler's return
 * type explicitly. `merchantAction`'s generic `R` cannot be inferred from an
 * object literal with no contextual type to check against, so leaving the
 * handler unannotated fails typecheck with `ok: true` widened away entirely —
 * this is that contextual type.
 */
export type SearchMerchantSurfaceResult = Awaited<
  ReturnType<typeof searchMerchantSurface>
>;
