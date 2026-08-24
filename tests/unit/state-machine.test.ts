import { describe, expect, it } from "vitest";

import type { OrderChannel, OrderState } from "@/server/db/enums";
import {
  ORDER_TRANSITIONS,
  canTransition,
} from "@/server/orders/state-machine";

/**
 * ORD-01, D-02 and D-03 — the whole order lifecycle, proved with no database.
 *
 * `src/server/orders/state-machine.ts` is pure data plus one predicate, so
 * every rule in the phase's state graph is expressible here as arithmetic over
 * a table. That is the point of splitting the registry out of
 * `transitionOrder()`: the *rules* are testable in milliseconds in the `unit`
 * project, and the isolation suite is left to prove only the things that need a
 * real Postgres (the audit row, the rollback, the tenant scope).
 *
 * THE SWEEP IS THE TEST. The named cases below read as sentences and document
 * intent, but a hand-written case list is exactly the thing that goes stale
 * when a state is added: nobody remembers to write the twelve new pairs. The
 * final block therefore walks all 3 channels x 6 from-states x 6 to-states and
 * asserts `canTransition` agrees with the registry AND the channel rule and
 * with nothing else — so a seventh state gets swept the moment it appears in
 * `ORDER_TRANSITIONS`, and an accidental extra allowance anywhere in the graph
 * is a failure rather than an untested corner.
 *
 * `CLAIM_ONLY` below is deliberately a SECOND, literal expression of the rule
 * rather than an import: the production set is module-private, and a test that
 * imported it would move with it and prove nothing about what the rule is
 * supposed to be.
 */

/** Every state, derived from the registry so a new one cannot be skipped. */
const STATES = Object.keys(ORDER_TRANSITIONS) as OrderState[];

/** Literal, because the enum is the contract and this file is the check on it. */
const CHANNELS: readonly OrderChannel[] = [
  "WHATSAPP",
  "MANUAL_TRANSFER",
  "CASH_ON_DELIVERY",
];

/** D-02/D-03, restated independently of the implementation. */
const CLAIM_ONLY: ReadonlySet<string> = new Set([
  "PAYMENT_PENDING",
  "PAYMENT_CLAIMED",
  "DISPUTED",
]);

describe("ORDER_TRANSITIONS registry", () => {
  it("covers exactly the six persisted order states", () => {
    // A vacuous sweep is the one failure mode a table-driven test must not
    // have: if this registry lost a row, every loop below would still pass.
    expect([...STATES].sort()).toEqual(
      [
        "CONFIRMED",
        "DISPUTED",
        "FULFILLED",
        "ORDER_PLACED",
        "PAYMENT_CLAIMED",
        "PAYMENT_PENDING",
      ].sort(),
    );
  });

  it("has no CART state — the cart lives in Redis, not in `order`", () => {
    // ORD-01's first *conceptual* state is a Redis cart (RESEARCH.md Pattern
    // 7). The first PERSISTED state is ORDER_PLACED. This pins that so a later
    // plan cannot quietly add a CART member and start writing half-orders.
    expect(STATES).not.toContain("CART");
  });

  it("lets a placed order go to payment-pending or straight to confirmed", () => {
    expect(ORDER_TRANSITIONS.ORDER_PLACED).toEqual([
      "PAYMENT_PENDING",
      "CONFIRMED",
    ]);
  });

  it("lets a pending payment only become a claimed one", () => {
    expect(ORDER_TRANSITIONS.PAYMENT_PENDING).toEqual(["PAYMENT_CLAIMED"]);
  });

  it("lets a claimed payment be accepted or disputed", () => {
    expect(ORDER_TRANSITIONS.PAYMENT_CLAIMED).toEqual([
      "CONFIRMED",
      "DISPUTED",
    ]);
  });

  it("makes a dispute recoverable by re-entering review (D-11)", () => {
    expect(ORDER_TRANSITIONS.DISPUTED).toEqual(["PAYMENT_CLAIMED"]);
  });

  it("lets a confirmed order only be fulfilled", () => {
    expect(ORDER_TRANSITIONS.CONFIRMED).toEqual(["FULFILLED"]);
  });

  it("makes FULFILLED terminal", () => {
    expect(ORDER_TRANSITIONS.FULFILLED).toEqual([]);
  });
});

describe("canTransition channel rule", () => {
  it("lets a manual-transfer order enter payment-pending", () => {
    expect(canTransition("MANUAL_TRANSFER", "ORDER_PLACED", "PAYMENT_PENDING"))
      .toBe(true);
  });

  it("refuses a WhatsApp order entering payment-pending (D-02)", () => {
    expect(canTransition("WHATSAPP", "ORDER_PLACED", "PAYMENT_PENDING")).toBe(
      false,
    );
  });

  it("refuses a cash-on-delivery order entering payment-pending (D-02)", () => {
    expect(
      canTransition("CASH_ON_DELIVERY", "ORDER_PLACED", "PAYMENT_PENDING"),
    ).toBe(false);
  });

  it("refuses a cash-on-delivery dispute (D-03)", () => {
    // There is no claim to reject on a COD order, so a DISPUTED COD order
    // could only ever be a fabricated payment dispute (T-03-15).
    expect(
      canTransition("CASH_ON_DELIVERY", "PAYMENT_CLAIMED", "DISPUTED"),
    ).toBe(false);
  });

  it("lets a WhatsApp order be confirmed directly by the merchant", () => {
    expect(canTransition("WHATSAPP", "ORDER_PLACED", "CONFIRMED")).toBe(true);
  });

  it("refuses every move out of FULFILLED, on every channel", () => {
    for (const channel of CHANNELS) {
      for (const to of STATES) {
        expect(
          canTransition(channel, "FULFILLED", to),
          `FULFILLED is terminal, but ${channel} allowed FULFILLED -> ${to}`,
        ).toBe(false);
      }
    }
  });

  it("refuses a dispute raised from CONFIRMED, on every channel (D-03)", () => {
    for (const channel of CHANNELS) {
      expect(
        canTransition(channel, "CONFIRMED", "DISPUTED"),
        `${channel} allowed CONFIRMED -> DISPUTED`,
      ).toBe(false);
    }
  });
});

describe("canTransition exhaustive sweep", () => {
  it("agrees with the registry and the channel rule, and with nothing else", () => {
    const combinations = CHANNELS.length * STATES.length * STATES.length;
    // 3 x 6 x 6. Pinned so a shrunken CHANNELS or STATES cannot make the loop
    // below pass by iterating over almost nothing.
    expect(combinations).toBe(108);

    const disagreements: string[] = [];

    for (const channel of CHANNELS) {
      for (const from of STATES) {
        for (const to of STATES) {
          const registryAllows = ORDER_TRANSITIONS[from].includes(to);
          const channelAllows =
            !CLAIM_ONLY.has(to) || channel === "MANUAL_TRANSFER";
          const expected = registryAllows && channelAllows;
          const actual = canTransition(channel, from, to);

          if (actual !== expected) {
            disagreements.push(
              `${channel}: ${from} -> ${to} returned ${actual}, expected ${expected}`,
            );
          }
        }
      }
    }

    expect(
      disagreements,
      "canTransition disagreed with `registry row contains `to`` AND `to is " +
        "not claim-only unless the channel is MANUAL_TRANSFER`. Those two " +
        "clauses are the whole rule (ORD-01 + D-02/D-03); a third condition " +
        "living in the function is a rule nobody can find from the table.",
    ).toEqual([]);
  });

  it("allows a non-empty set of transitions on every channel", () => {
    // The mirror of the vacuity guard above: a `canTransition` that returned
    // false for everything would satisfy the sweep trivially.
    for (const channel of CHANNELS) {
      const allowed = STATES.flatMap((from) =>
        STATES.filter((to) => canTransition(channel, from, to)),
      );
      expect(
        allowed.length,
        `${channel} has no legal transition at all — an order on that channel ` +
          "could never leave ORDER_PLACED.",
      ).toBeGreaterThan(0);
    }
  });

  it("gives the manual-transfer channel strictly more moves than the others", () => {
    const countFor = (channel: OrderChannel) =>
      STATES.flatMap((from) =>
        STATES.filter((to) => canTransition(channel, from, to)),
      ).length;

    // The claim-only states exist on exactly one path, so this ordering is the
    // channel rule observed from the outside.
    expect(countFor("MANUAL_TRANSFER")).toBeGreaterThan(countFor("WHATSAPP"));
    expect(countFor("WHATSAPP")).toBe(countFor("CASH_ON_DELIVERY"));
  });
});
