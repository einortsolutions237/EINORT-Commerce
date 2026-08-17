import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { prismaBase } from "./base";

/**
 * The tenant guarantee (TEN-02, TEN-08).
 *
 * One Prisma Client Extension injects `tenantId` into every operation on every
 * registered model, and throws for anything unregistered. This is the only
 * sanctioned path to tenant-scoped tables — isolation is structural here, not
 * a filter each route is trusted to remember.
 *
 * Two documented holes, both closed elsewhere rather than ignored:
 *   - Nested writes are NOT intercepted (Pitfall 4). The extension hooks the
 *     client operation, not the generated SQL, so a nested `create` on a
 *     tenant-scoped relation never passes through here. `tenantId` is declared
 *     required with no default on every tenant-scoped model precisely so that
 *     bypass is a type error, and a NOT NULL violation at worst.
 *   - `$queryRaw`/`$executeRaw` are NOT intercepted (verified empirically).
 *     `eslint.config.mjs` bans them outright via `no-restricted-syntax`.
 *
 * Behavioural proof lives in plan 01-04's two-tenant isolation suite.
 */

/**
 * Every model carrying a `tenantId` column.
 *
 * Typed as `Prisma.ModelName[]` rather than `string[]` so the registry cannot
 * silently drift from the schema: rename or drop a model in
 * `prisma/schema.prisma` and this array stops compiling. That is a build
 * failure at the moment of the rename, which is much earlier than plan 01-04's
 * runtime drift test would catch it.
 *
 * Adding a model here is a security decision, not bookkeeping. A tenant-scoped
 * table missing from this list throws on first use (loud, correct); a
 * non-tenant-scoped table wrongly added here would have `tenantId` injected
 * into queries against a column that does not exist (also loud). There is no
 * silent-failure path in either direction, which is the point.
 */
const REGISTERED_MODELS: readonly Prisma.ModelName[] = ["StoreSlugHistory"];

export const TENANT_SCOPED_MODELS: Set<string> = new Set(REGISTERED_MODELS);

/**
 * Returns a Prisma client bound to a single tenant.
 *
 * `$extends` returns a cheap wrapper that shares `prismaBase`'s connection
 * pool, so calling this per request is correct and calling `new PrismaClient()`
 * per tenant is not.
 */
export function scopedDb(tenantId: string) {
  if (!tenantId) throw new Error("scopedDb: tenantId is required");

  return prismaBase.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Fail loudly for anything nobody registered. A model that silently
          // ran unscoped here would defeat the entire mechanism, so an
          // unrecognised name is an error rather than a pass-through.
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            throw new Error(
              `scopedDb: "${model}" is not a tenant-scoped model. ` +
                `Use platformDb (registry tables) or adminDb ` +
                `(platform admin, src/server/admin/** only).`,
            );
          }

          const a = args as Record<string, unknown>;

          switch (operation) {
            case "create":
              // Spread order is the security property: `tenantId` goes LAST so
              // a caller-supplied `tenantId` in the payload is overwritten,
              // never merged. That is TEN-08 and CLAUDE.md's
              // "never trust a client-supplied tenant ID" in one line.
              a.data = { ...(a.data as object), tenantId };
              break;

            case "createMany":
            case "createManyAndReturn":
              // These two receive `data` as an ARRAY. Normalise first, then
              // stamp every row — same last-wins spread order as `create`.
              a.data = (Array.isArray(a.data) ? a.data : [a.data]).map(
                (row: unknown) => ({ ...(row as object), tenantId }),
              );
              break;

            case "upsert":
              // Both halves, or the operation becomes a cross-tenant hijack:
              // `where` alone would let an upsert resurrect another tenant's
              // row, `create` alone would let a miss insert an unstamped one.
              a.where = { ...(a.where as object), tenantId };
              a.create = { ...(a.create as object), tenantId };
              break;

            default:
              // Everything else — the unique and non-unique finders,
              // `findMany`, `count`, `aggregate`, `groupBy`, `update`,
              // `updateMany`, `delete`, `deleteMany` — is filtered by `where`.
              //
              // `aggregate` and `groupBy` can arrive with no `where` key at
              // all; spreading `undefined` yields `{}`, so this is safe.
              //
              // Deliberately NO rewrite of unique reads into non-unique ones.
              // The `findUnique` -> `findFirst` workaround is still the top
              // public search result for Prisma tenant scoping and it is
              // stale: `extendedWhereUnique` has been GA since Prisma 5, and
              // the generated 7.9.1 `WhereUniqueInput` is a `Prisma.AtLeast<>`
              // that accepts non-unique scalars such as `tenantId` alongside
              // the unique selector. Rewriting would fragment this switch and
              // reopen escape hatches.
              a.where = { ...(a.where as object), tenantId };
          }

          return query(a);
        },
      },
    },
  });
}

export type ScopedDb = ReturnType<typeof scopedDb>;

/**
 * A create payload for a tenant-scoped model with `tenantId` deliberately
 * omitted, because `scopedDb` stamps it.
 *
 * This exists to resolve a genuine disagreement between the runtime guarantee
 * and the generated types. Every tenant-scoped model declares `tenantId`
 * required with no default — that is the Pitfall 4 defence, and it must stay
 * that way, because it is what turns a nested or unscoped create into a
 * compile-time error. But it also means the generated `CreateInput` demands
 * `tenantId` from callers who must never supply it: the extension overwrites
 * whatever they pass (spread order in `$allOperations` puts `tenantId` last),
 * so a caller-provided value is at best noise and at worst a reader's false
 * impression that the value is theirs to choose (TEN-08).
 *
 * Without this helper the only ways to write the correct call are an inline
 * cast at every site, or passing a real `tenantId` that is then discarded. The
 * first scatters unexplained casts through feature code; the second is exactly
 * the client-supplied tenant id the whole mechanism exists to reject, and it
 * would read as legitimate in review.
 *
 * So the cast lives here, once, next to the code that makes it true.
 */
export type ScopedCreateData<T> = Omit<T, "tenantId">;

/**
 * Type-level companion to `scopedDb(...).<model>.create`.
 *
 * Purely a compile-time assertion — it emits no runtime behaviour and cannot
 * stamp anything itself. The stamp is the extension's job; this only stops the
 * generated type from demanding a field the caller is forbidden to set.
 *
 * ```ts
 * await scopedDb(orgId).storeSlugHistory.create({
 *   data: scopedCreateData<Prisma.StoreSlugHistoryUncheckedCreateInput>({ slug }),
 * });
 * ```
 */
export function scopedCreateData<T extends { tenantId: string }>(
  data: ScopedCreateData<T>,
): T {
  return data as T;
}
