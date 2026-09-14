import type { OrderChannel, OrderState } from "@/server/db/enums";
import type { OrderEventCreateInput } from "@/server/db/model-inputs";

/**
 * `OrderWriteTx` — 06-PATTERNS.md § Risks R-1, resolved with option 1.
 *
 * ---------------------------------------------------------------------------
 * WHAT PROBLEM THIS TYPE EXISTS TO SOLVE.
 * ---------------------------------------------------------------------------
 * `transitionOrder` is the ONE sanctioned writer of `Order.state`
 * (`tests/unit/single-order-state-writer.test.ts` enforces it), and
 * `releaseStock` / `holdStockForLines` / `markStockHeld` are the one sanctioned
 * movers of inventory. All four were typed `ScopedTx`, which is
 * `Omit<ScopedDb, ITXClientDenyList>` — a type only `src/server/db/**` may even
 * name, and one the platform-admin zone cannot construct.
 *
 * ADM-02 requires the platform owner to confirm or reject ANY tenant's payment
 * claim with exactly the consequences the merchant's own tap has. The admin
 * zone reads through `adminDb`, which is deliberately unscoped, and
 * `eslint.config.mjs` forbids `src/server/admin/**` from importing
 * `src/server/db/tenant-scoped` at all. So the admin writer could neither pass a
 * `ScopedTx` nor mention the type. 06-PATTERNS.md ranked three ways out:
 *
 *   1. Widen the parameter to the STRUCTURAL MINIMUM those four functions
 *      actually use, declared in a module neither zone is fenced out of.  ← this
 *   2. A bridge in `src/server/orders/**` that builds a scoped client for the
 *      target tenant. Legal, but it re-introduces a tenant-id-to-client hop on
 *      the admin path for no benefit once option 1 works.
 *   3. Duplicate the writer. FORBIDDEN — it is the exact second `Order.state`
 *      writer the guard exists to make unconstructible.
 *
 * ---------------------------------------------------------------------------
 * WIDENING THIS TYPE IS HOW A TENANT BOUNDARY QUIETLY BECOMES OPTIONAL.
 * ---------------------------------------------------------------------------
 * READ THAT SENTENCE AGAIN BEFORE ADDING A MEMBER. Every member below was
 * enumerated from the source of the four functions that consume it — not
 * guessed, and not rounded up "for later". A member added here is a delegate
 * operation that an UNSCOPED client is henceforth allowed to perform through
 * order-domain code, on every tenant at once, with no predicate underneath to
 * catch a mistake. The narrowness IS the control. `any`, `unknown`-typed
 * delegates, an index signature, or `Partial<PrismaClient>` would each collapse
 * it to nothing while still compiling.
 *
 * The rule for a future edit: if a function in this module's consumer set needs
 * an operation that is not here, add THAT operation with THAT argument shape —
 * never a broader one that happens to cover it.
 *
 * ---------------------------------------------------------------------------
 * BOTH CLIENTS SATISFY THIS STRUCTURALLY, NOT BY INHERITANCE.
 * ---------------------------------------------------------------------------
 * `scopedDb(tenantId).$transaction`'s callback client and
 * `adminDb.$transaction`'s callback client share no base class and no declared
 * relationship: one is a `$extends`-wrapped client whose type parameters were
 * rewritten by the tenant extension, the other is the bare generated client.
 * They satisfy `OrderWriteTx` because TypeScript is structural and both really
 * do expose these delegates with these shapes. That is why no cast is needed at
 * any call site — and if a call site ever DOES need one, the type below is
 * wrong and must be narrowed, not casted around.
 *
 * ---------------------------------------------------------------------------
 * ON THE ADMIN PATH THE TENANT PREDICATE IS THE CALLER'S RESPONSIBILITY.
 * ---------------------------------------------------------------------------
 * NOTHING INJECTS `tenantId` FOR A CALLER WHO PASSES AN UNSCOPED CLIENT. On the
 * merchant path, `scopedDb`'s extension rewrites the `where` of every operation
 * and stamps `tenantId` into every create; pass `adminDb`'s transaction client
 * instead and every one of those rewrites simply does not happen. The
 * consequences split in two, and the split is worth stating precisely because
 * only one half is dangerous:
 *
 *   - READS AND UPDATES KEYED ON A PRIMARY KEY are safe either way. `Order.id`,
 *     `OrderItem.orderId` and `ProductVariant.id` are cuids and globally unique,
 *     so an unscoped `where: { id }` selects exactly the row a scoped one would
 *     have selected, or nothing. What changes is only WHICH ids are reachable —
 *     and reaching another tenant's order is precisely what ADM-02 authorises,
 *     gated by `requireAdminContext()` rather than by a predicate.
 *
 *   - CREATES ARE NOT SAFE EITHER WAY, because `tenantId` is a required column
 *     with no default on every tenant-scoped model (the Pitfall 4 defence), and
 *     an unscoped create has nobody to supply it. `transitionOrder` therefore
 *     derives the audit row's `tenantId` FROM THE ORDER ROW IT JUST READ inside
 *     the same transaction, rather than from the extension or from a parameter.
 *     See that function for the full reasoning; the short version is that an
 *     `OrderEvent` belongs to the tenant of the order it describes, and the
 *     order row is the only honest source of that fact on both paths.
 *
 * An admin-zone caller must still name `tenantId` explicitly in every `where`
 * it writes ITSELF — see `src/server/admin/claims.ts`, which does. This module
 * cannot do it for them.
 *
 * ---------------------------------------------------------------------------
 * NO `import "server-only"`, DELIBERATELY.
 * ---------------------------------------------------------------------------
 * Same reasoning as `src/server/db/enums.ts` and `src/server/db/model-inputs.ts`:
 * this module is types only and is fully erased at build time, so the marker
 * would buy nothing and would add a real runtime import to a file that
 * otherwise emits no JavaScript at all.
 *
 * It imports NOTHING from `src/server/db/tenant-scoped`, `src/server/db/admin`
 * or `src/server/db/base`, and nothing from the generated client directly — the
 * two generated-type aliases it needs come through the sanctioned doors
 * (`enums.ts`, `model-inputs.ts`). That is what lets both fenced zones import
 * it: `src/server/admin/**` may import this file, and importing it teaches that
 * zone nothing about the scoped client.
 */

/**
 * THE ENUMERATED SURFACE, and where each member comes from.
 *
 * `src/server/orders/transition.ts` — `transitionOrder`:
 *   1. `order.findUniqueOrThrow`  — reads `{ id, state, channel, tenantId }`
 *   2. `order.update`             — writes `{ state, confirmedAt? }`
 *   3. `orderEvent.create`        — writes the ORD-05 audit row
 *
 * `src/server/orders/stock.ts`:
 *   4. `productVariant.updateMany` — `holdStockForLines` (conditional decrement)
 *                                    and `releaseStock` (unconditional increment)
 *   5. `order.updateMany`          — `markStockHeld` (set) and `releaseStock`
 *                                    (the conditional claim of `stockHeld`)
 *   6. `orderItem.findMany`        — `releaseStock`, reading the lines to return
 *
 * Six operations across four delegates. `openOrderAtGenesis` is deliberately
 * NOT in this set and keeps its `ScopedTx`: an order is born on the storefront,
 * never on the admin surface, and its `create` relies on the extension's stamp.
 */
export interface OrderWriteTx {
  readonly order: {
    /**
     * The transition's read. `tenantId` is in the selection because the audit
     * row's tenant is derived from it — see the header. The `where` carries no
     * tenant of its own on purpose: on the merchant path the extension adds
     * one, and on the admin path the cuid IS the selector and the
     * authorization happened at `requireAdminContext()`.
     */
    findUniqueOrThrow(args: {
      where: { id: string };
      select: {
        id: true;
        state: true;
        channel: true;
        tenantId: true;
      };
    }): Promise<{
      id: string;
      state: OrderState;
      channel: OrderChannel;
      tenantId: string;
    }>;

    /**
     * The ONE state write in the codebase. `confirmedAt` rides along because it
     * must be stamped in the same statement that makes it true.
     */
    update(args: {
      where: { id: string };
      data: { state: OrderState; confirmedAt?: Date };
    }): Promise<unknown>;

    /**
     * `stockHeld` only, and `count` is load-bearing rather than incidental:
     * `releaseStock` claims the flag atomically and uses `count === 0` to
     * decide it lost the race and must not increment anything.
     */
    updateMany(args: {
      where: { id: string; stockHeld?: boolean };
      data: { stockHeld: boolean };
    }): Promise<{ count: number }>;
  };

  readonly orderEvent: {
    /**
     * `OrderEventCreateInput` is the FULL unchecked input, `tenantId` included
     * — NOT the `scopedCreateData` shape that omits it. That difference is the
     * whole reason this member is typed here rather than inherited: an
     * unscoped client has no extension to stamp the column, and the column is
     * `NOT NULL` with a composite foreign key to `(tenantId, orderId)`, so a
     * missing or wrong value is a write failure rather than a silent leak.
     */
    create(args: { data: OrderEventCreateInput }): Promise<unknown>;
  };

  readonly orderItem: {
    findMany(args: {
      where: { orderId: string };
      select: { variantId: true; quantity: true };
    }): Promise<{ variantId: string; quantity: number }[]>;
  };

  readonly productVariant: {
    /**
     * Both directions of the stock move. `count` is the conditional
     * decrement's verdict: zero rows means the `stock >= quantity` precondition
     * was false at the instant of the write, which is what makes overselling
     * impossible by construction (see `src/server/orders/stock.ts`).
     */
    updateMany(args: {
      where: { id: string; active?: boolean; stock?: { gte: number } };
      data: { stock: { decrement: number } | { increment: number } };
    }): Promise<{ count: number }>;
  };
}
