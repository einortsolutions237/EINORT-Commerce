import { beforeEach, describe, expect, it } from "vitest";

import type { Prisma } from "@/generated/prisma/client";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";
import { InvalidTransitionError } from "@/server/orders/errors";
import { transitionOrder } from "@/server/orders/transition";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * ORD-01 / ORD-02 / ORD-05 against a real Postgres.
 *
 * WHY THIS IS AN ISOLATION TEST AND NOT A UNIT TEST. Every claim here is about
 * what reached the database and what did NOT. "The state change and the audit
 * row are indivisible" is a statement about a transaction; against a stubbed
 * client it is vacuously true, because a stub has no transaction to roll back.
 * The one assertion this file exists for — that a refused transition leaves
 * neither a moved order nor a dangling event — can only be made where a real
 * `BEGIN`/`ROLLBACK` happens.
 *
 * The graph itself is already proved exhaustively and cheaply in
 * `tests/unit/state-machine.test.ts` (all 3x6x6 combinations, no database).
 * This file deliberately does not repeat that sweep. It covers the things
 * `canTransition` cannot see: the actor, the reason, the audit row, the
 * rollback, and the tenant scope.
 *
 * The fixture is `tests/setup/seed-two-tenants.ts`'s, reseeded before every
 * test. `${tenant.id}-order-1` is a MANUAL_TRANSFER order in `ORDER_PLACED`
 * with exactly ONE `OrderEvent` — the genesis row (`fromState: null`,
 * `toState: ORDER_PLACED`) that `placeOrder` will write in a later plan. Every
 * count below is relative to that one row rather than to a hard-coded number,
 * so a fixture that grows an event does not silently invert an assertion.
 */

const ORDER_A = `${TENANT_A.id}-order-1`;
const ORDER_B = `${TENANT_B.id}-order-1`;

/** Run one transition in its own scoped transaction, as `tenantId`. */
function transitionAs(
  tenantId: string,
  args: Parameters<typeof transitionOrder>[1],
): Promise<void> {
  return scopedDb(tenantId).$transaction((tx) => transitionOrder(tx, args));
}

function readOrder(tenantId: string, id: string) {
  return scopedDb(tenantId).order.findUniqueOrThrow({
    where: { id },
    select: { state: true, channel: true, confirmedAt: true },
  });
}

function countEvents(tenantId: string, orderId: string): Promise<number> {
  return scopedDb(tenantId).orderEvent.count({ where: { orderId } });
}

function readEvents(tenantId: string, orderId: string) {
  return scopedDb(tenantId).orderEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    select: {
      fromState: true,
      toState: true,
      actor: true,
      actorUserId: true,
      reason: true,
    },
  });
}

/** Walk the seeded order to PAYMENT_CLAIMED, the state a merchant reviews. */
async function claimSubmittedOn(tenantId: string, orderId: string) {
  await transitionAs(tenantId, {
    orderId,
    to: "PAYMENT_PENDING",
    actor: "SYSTEM",
  });
  await transitionAs(tenantId, {
    orderId,
    to: "PAYMENT_CLAIMED",
    actor: "CUSTOMER",
  });
}

beforeEach(async () => {
  await seedTwoTenants();
});

// ---------------------------------------------------------------------------

describe("a legal transition", () => {
  it("moves the order and writes exactly one matching OrderEvent", async () => {
    const before = await countEvents(TENANT_A.id, ORDER_A);

    await transitionAs(TENANT_A.id, {
      orderId: ORDER_A,
      to: "PAYMENT_PENDING",
      actor: "SYSTEM",
    });

    const order = await readOrder(TENANT_A.id, ORDER_A);
    expect(order.state).toBe("PAYMENT_PENDING");

    // EXACTLY one. A transition that wrote two events would make the history
    // ambiguous about how many times the order actually moved.
    expect(await countEvents(TENANT_A.id, ORDER_A)).toBe(before + 1);

    const events = await readEvents(TENANT_A.id, ORDER_A);
    expect(events.at(-1)).toMatchObject({
      fromState: "ORDER_PLACED",
      toState: "PAYMENT_PENDING",
      actor: "SYSTEM",
    });
  });

  it("does not stamp confirmedAt on a move that is not a confirmation", async () => {
    await transitionAs(TENANT_A.id, {
      orderId: ORDER_A,
      to: "PAYMENT_PENDING",
      actor: "SYSTEM",
    });

    expect((await readOrder(TENANT_A.id, ORDER_A)).confirmedAt).toBeNull();
  });
});

describe("an illegal transition", () => {
  it("throws InvalidTransitionError and leaves state and events untouched", async () => {
    const before = await countEvents(TENANT_A.id, ORDER_A);

    // ORDER_PLACED -> FULFILLED is not in the registry for any channel.
    await expect(
      transitionAs(TENANT_A.id, {
        orderId: ORDER_A,
        to: "FULFILLED",
        actor: "MERCHANT",
        actorUserId: TENANT_A.userId,
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    expect((await readOrder(TENANT_A.id, ORDER_A)).state).toBe("ORDER_PLACED");
    expect(await countEvents(TENANT_A.id, ORDER_A)).toBe(before);
  });

  it("rolls back a legal move made earlier in the same transaction", async () => {
    /*
     * THIS IS THE ASSERTION THE FILE EXISTS FOR.
     *
     * The test above only proves the guard returns early — the refusal happens
     * before anything is written, so "nothing changed" would also hold for a
     * function with no transaction at all. Here the transaction has ALREADY
     * written a state change and an audit row when the second, illegal call
     * throws. If `transitionOrder` opened its own transaction per call, the
     * first move would be committed and the order would be left in
     * PAYMENT_PENDING with an event describing a half-finished operation.
     *
     * Both moves must vanish together. That is what makes "an order cannot move
     * without leaving an audit row" true in the presence of a caller that fails
     * partway — which is every real caller: placeOrder holds stock, reviewClaim
     * releases it, and neither may survive a rolled-back state change.
     */
    const before = await countEvents(TENANT_A.id, ORDER_A);

    await expect(
      scopedDb(TENANT_A.id).$transaction(async (tx) => {
        await transitionOrder(tx, {
          orderId: ORDER_A,
          to: "PAYMENT_PENDING",
          actor: "SYSTEM",
        });
        await transitionOrder(tx, {
          orderId: ORDER_A,
          to: "FULFILLED",
          actor: "MERCHANT",
          actorUserId: TENANT_A.userId,
        });
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    expect((await readOrder(TENANT_A.id, ORDER_A)).state).toBe("ORDER_PLACED");
    expect(await countEvents(TENANT_A.id, ORDER_A)).toBe(before);
  });
});

describe("confirming a payment claim (ORD-02)", () => {
  it("refuses a CUSTOMER actor even though the graph allows the move", async () => {
    await claimSubmittedOn(TENANT_A.id, ORDER_A);
    const before = await countEvents(TENANT_A.id, ORDER_A);

    // PAYMENT_CLAIMED -> CONFIRMED IS in the registry. The refusal here is
    // purely about who is asking: a customer confirming their own payment is
    // the failure the whole manual-transfer review step exists to prevent
    // (T-03-13).
    await expect(
      transitionAs(TENANT_A.id, {
        orderId: ORDER_A,
        to: "CONFIRMED",
        actor: "CUSTOMER",
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    const order = await readOrder(TENANT_A.id, ORDER_A);
    expect(order.state).toBe("PAYMENT_CLAIMED");
    expect(order.confirmedAt).toBeNull();
    expect(await countEvents(TENANT_A.id, ORDER_A)).toBe(before);
  });

  it("accepts a MERCHANT actor, stamps confirmedAt and records the user", async () => {
    await claimSubmittedOn(TENANT_A.id, ORDER_A);

    await transitionAs(TENANT_A.id, {
      orderId: ORDER_A,
      to: "CONFIRMED",
      actor: "MERCHANT",
      actorUserId: TENANT_A.userId,
    });

    const order = await readOrder(TENANT_A.id, ORDER_A);
    expect(order.state).toBe("CONFIRMED");
    expect(order.confirmedAt).not.toBeNull();

    const events = await readEvents(TENANT_A.id, ORDER_A);
    expect(events.at(-1)).toMatchObject({
      fromState: "PAYMENT_CLAIMED",
      toState: "CONFIRMED",
      actor: "MERCHANT",
      // ORD-05's *who*. An anonymous MERCHANT row is the one shape the audit
      // trail may not take.
      actorUserId: TENANT_A.userId,
    });
  });

  it("refuses a MERCHANT actor that carries no user id", async () => {
    await claimSubmittedOn(TENANT_A.id, ORDER_A);

    await expect(
      transitionAs(TENANT_A.id, {
        orderId: ORDER_A,
        to: "CONFIRMED",
        actor: "MERCHANT",
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    expect((await readOrder(TENANT_A.id, ORDER_A)).state).toBe(
      "PAYMENT_CLAIMED",
    );
  });
});

describe("rejecting a claim (D-11)", () => {
  it("refuses DISPUTED with a blank reason and records it when given one", async () => {
    await claimSubmittedOn(TENANT_A.id, ORDER_A);

    // Whitespace, not absence: the caller-side Zod `min(1)` would pass this.
    await expect(
      transitionAs(TENANT_A.id, {
        orderId: ORDER_A,
        to: "DISPUTED",
        actor: "MERCHANT",
        actorUserId: TENANT_A.userId,
        reason: "   ",
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    expect((await readOrder(TENANT_A.id, ORDER_A)).state).toBe(
      "PAYMENT_CLAIMED",
    );

    await transitionAs(TENANT_A.id, {
      orderId: ORDER_A,
      to: "DISPUTED",
      actor: "MERCHANT",
      actorUserId: TENANT_A.userId,
      reason: "The transaction reference does not match any received payment.",
    });

    const events = await readEvents(TENANT_A.id, ORDER_A);
    expect(events.at(-1)).toMatchObject({
      toState: "DISPUTED",
      reason: "The transaction reference does not match any received payment.",
    });
  });
});

describe("the channel rule (D-02)", () => {
  it("cannot move a WHATSAPP order into PAYMENT_PENDING", async () => {
    const whatsappOrderId = `${TENANT_A.id}-order-whatsapp`;

    await scopedDb(TENANT_A.id).order.create({
      data: scopedCreateData<Prisma.OrderUncheckedCreateInput>({
        id: whatsappOrderId,
        orderNumber: `${TENANT_A.slug}-9001`,
        state: "ORDER_PLACED",
        channel: "WHATSAPP",
        customerName: "WhatsApp Customer",
        customerPhone: "237600000001",
        subtotalXaf: 5000,
        totalXaf: 5000,
        trackingTokenHash: `${TENANT_A.id}-whatsapp-tracking-token-hash`,
        stockHeld: true,
      }),
    });

    // A WhatsApp order has no in-band payment for the platform to be pending
    // on, so letting it reach a claim-only state would let a dispute be
    // fabricated over a payment that never existed (T-03-15).
    await expect(
      transitionAs(TENANT_A.id, {
        orderId: whatsappOrderId,
        to: "PAYMENT_PENDING",
        actor: "SYSTEM",
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    expect((await readOrder(TENANT_A.id, whatsappOrderId)).state).toBe(
      "ORDER_PLACED",
    );

    // The same order CAN be confirmed directly — the channel rule narrows the
    // graph, it does not strand the order.
    await transitionAs(TENANT_A.id, {
      orderId: whatsappOrderId,
      to: "CONFIRMED",
      actor: "MERCHANT",
      actorUserId: TENANT_A.userId,
    });

    expect((await readOrder(TENANT_A.id, whatsappOrderId)).state).toBe(
      "CONFIRMED",
    );
  });
});

describe("tenant scope", () => {
  it("cannot transition another tenant's order", async () => {
    const before = await countEvents(TENANT_B.id, ORDER_B);

    /*
     * The move itself is LEGAL — B's order is a MANUAL_TRANSFER order in
     * ORDER_PLACED, so `canTransition` would say yes. The only thing standing
     * between tenant A and tenant B's order is the scope extension rewriting
     * the `where` of `findUniqueOrThrow` into a miss. That is why the id is a
     * real, seeded one rather than an invented string: an invented id would
     * fail for the boring reason too, and the test would pass with the guard
     * removed.
     */
    const failure = await transitionAs(TENANT_A.id, {
      orderId: ORDER_B,
      to: "PAYMENT_PENDING",
      actor: "SYSTEM",
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    // NOT an InvalidTransitionError: the refusal must come from the row not
    // being visible, not from the state graph. If this ever becomes an
    // InvalidTransitionError, tenant A managed to READ tenant B's order.
    expect(failure).not.toBeInstanceOf(InvalidTransitionError);

    const order = await readOrder(TENANT_B.id, ORDER_B);
    expect(order.state).toBe("ORDER_PLACED");
    expect(await countEvents(TENANT_B.id, ORDER_B)).toBe(before);
  });
});
