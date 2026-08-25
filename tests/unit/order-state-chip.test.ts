import { describe, expect, it } from "vitest";

import {
  STATE_CHIPS,
  STATES_BY_CHANNEL,
} from "@/components/order-state-chip";
import { strings } from "@/lib/strings";
import { OrderChannel } from "@/server/db/enums";
import type { OrderState } from "@/server/db/enums";
import {
  canTransition,
  ORDER_TRANSITIONS,
} from "@/server/orders/state-machine";

/**
 * The display half of ORD-01, cross-checked against the server half.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE IS A SWEEP AND NOT SIX ASSERTIONS.
 * ---------------------------------------------------------------------------
 * `src/components/order-state-chip.tsx` and `src/server/orders/state-machine.ts`
 * encode the SAME rule twice — D-02's "a WhatsApp or cash-on-delivery order only
 * ever sees New order, Confirmed, Fulfilled" is a display fact in one file and a
 * transition fact in the other. Two expressions of one rule is the classic shape
 * that drifts, and the drift is silent in both directions: a display map that
 * grows a state the server can never produce renders a chip nobody will ever
 * see, and a display map that LOSES a state the server can produce renders a row
 * with no status at all, which is a CHK-05-class hole on the merchant side.
 *
 * So the agreement is asserted by construction rather than by inspection. The
 * state set is driven off `ORDER_TRANSITIONS`'s own keys and the channel set off
 * the `OrderChannel` enum object, so a seventh state or a fourth channel added
 * to `prisma/schema.prisma` fails HERE — at the map that forgot it — instead of
 * passing quietly because this file still lists six and three.
 *
 * ---------------------------------------------------------------------------
 * "REACHABLE" MEANS REACHABLE FROM THE GENESIS, NOT "APPEARS IN THE REGISTRY".
 * ---------------------------------------------------------------------------
 * `ORDER_TRANSITIONS` is keyed by the state being LEFT, so `ORDER_PLACED` — the
 * one state every order starts in — is never a transition TARGET and a naive
 * "is it in some row's target list?" check would declare it unreachable and
 * demand it be dropped from every channel's display set. The correct question is
 * a graph walk: start at the genesis and take every move `canTransition` permits
 * for that channel. That walk is what the display map is claiming to mirror.
 *
 * This file imports a `.tsx` module. It renders nothing and needs no DOM — the
 * chip CONFIG is a plain data object, which is exactly why 03-UI-SPEC.md asks
 * for it as a `Record` rather than as a `switch` inside the component. That is
 * what keeps this in the fast, database-free `unit` project.
 */

/** Every `OrderState`, from the registry that must already list all of them. */
const ALL_STATES = Object.keys(ORDER_TRANSITIONS) as OrderState[];

/**
 * Every `OrderChannel`, from the generated enum object rather than a literal.
 *
 * A hand-written `["WHATSAPP", "CASH_ON_DELIVERY", "MANUAL_TRANSFER"]` would
 * still pass on the day a fourth channel is added — it would simply never look
 * at it — and the new channel would reach production with no display rule.
 */
const ALL_CHANNELS = Object.keys(OrderChannel) as OrderChannel[];

/** The genesis state, and the only entry point into the graph walk below. */
const GENESIS: OrderState = "ORDER_PLACED";

/**
 * Every state an order on `channel` can actually be in, by walking the graph.
 *
 * Breadth-first from the genesis, taking only moves `canTransition` permits —
 * so the channel rule (D-02/D-03's claim-only states) narrows the walk exactly
 * as it narrows a real order's life.
 */
function reachableStates(channel: OrderChannel): Set<OrderState> {
  const seen = new Set<OrderState>([GENESIS]);
  const queue: OrderState[] = [GENESIS];

  while (queue.length > 0) {
    const from = queue.shift() as OrderState;
    for (const to of ALL_STATES) {
      if (seen.has(to)) continue;
      if (!canTransition(channel, from, to)) continue;
      seen.add(to);
      queue.push(to);
    }
  }

  return seen;
}

/**
 * Every value in `strings.orders`, so a label can be proved to come from it.
 *
 * Widened to `Record<string, unknown>` before the filter on purpose. Without
 * it the narrowing predicate is a type error — `Object.values` on a literal
 * object yields the union of the literal strings, and `value is string` is not
 * assignable to that — and the obvious "fix" of dropping the predicate would
 * make this list silently follow the namespace's exact shape, so the day a
 * nested group is added the filter would stop compiling for a reason that has
 * nothing to do with what is being asserted here.
 */
const ORDER_STRINGS: readonly string[] = Object.values(
  strings.orders as Record<string, unknown>,
).filter((value): value is string => typeof value === "string");

describe("the chip config covers the enum", () => {
  it("did not sweep an empty set", () => {
    // A rename that emptied either list would make every assertion below
    // vacuous and report perfect health over zero coverage.
    expect(ALL_STATES.length).toBe(6);
    expect(ALL_CHANNELS.length).toBe(3);
  });

  it("gives every OrderState a label, a variant and an icon", () => {
    const missing = ALL_STATES.filter((state) => !STATE_CHIPS[state]);

    expect(
      missing,
      "An OrderState has no chip row.\n" +
        "  STATE_CHIPS is typed Readonly<Record<OrderState, …>>, so a missing " +
        "row should already be a compile error — this is the runtime half, for " +
        "the case where the type was widened or a key was spelled wrong. A " +
        "state with no chip renders a row with no status, which is the one " +
        "thing an order list may not do.",
    ).toEqual([]);

    for (const state of ALL_STATES) {
      const chip = STATE_CHIPS[state];
      expect(chip.label.trim().length, `${state} has a blank label`).toBeGreaterThan(0);
      expect(chip.variant.length, `${state} has no badge variant`).toBeGreaterThan(0);
      expect(typeof chip.icon, `${state} has no icon`).not.toBe("undefined");
    }
  });

  it("reads every label from strings.orders and never from the enum", () => {
    for (const state of ALL_STATES) {
      const { label } = STATE_CHIPS[state];

      // C-14: the label must be a value that exists in the copy catalogue, not
      // a literal typed into the component.
      expect(
        ORDER_STRINGS,
        `The chip label for ${state} is not a value in strings.orders.`,
      ).toContain(label);

      // A raw enum member is an internal identifier and means nothing to a
      // merchant (03-UI-SPEC.md § Copywriting Contract names PAYMENT_CLAIMED
      // explicitly as copy that must never ship).
      expect(label, `${state} renders its own enum name`).not.toBe(state);
      expect(
        /^[A-Z][A-Z_]*$/.test(label),
        `The chip label for ${state} has the shape of an enum member.`,
      ).toBe(false);
    }
  });
});

describe("the per-channel display rule (D-02)", () => {
  it("gives WhatsApp and cash on delivery exactly the three-state life", () => {
    // Not `toContain` — the assertion is that these are the ONLY three. A
    // fourth would put a payment state on a channel that has no in-band
    // payment, which is the thing 03-UI-SPEC.md asks to be a type error.
    expect(STATES_BY_CHANNEL.WHATSAPP).toEqual([
      "ORDER_PLACED",
      "CONFIRMED",
      "FULFILLED",
    ]);
    expect(STATES_BY_CHANNEL.CASH_ON_DELIVERY).toEqual([
      "ORDER_PLACED",
      "CONFIRMED",
      "FULFILLED",
    ]);
  });

  it("gives manual transfer every state", () => {
    expect([...STATES_BY_CHANNEL.MANUAL_TRANSFER].sort()).toEqual(
      [...ALL_STATES].sort(),
    );
  });

  it("lists a display state only once per channel", () => {
    for (const channel of ALL_CHANNELS) {
      const states = STATES_BY_CHANNEL[channel];
      expect(
        new Set(states).size,
        `${channel} lists a state twice in STATES_BY_CHANNEL.`,
      ).toBe(states.length);
    }
  });
});

describe("the display map agrees with canTransition, exhaustively", () => {
  /*
   * THIS IS THE ASSERTION THE FILE EXISTS FOR.
   *
   * Both directions, per channel, over every state — not a spot check:
   *   - every state the chip map offers must be one the server can actually
   *     put an order into on that channel (no dead chips);
   *   - every state the server can reach must have a chip (no blank statuses).
   * Equality of the two sets says both at once, and says it about a graph walk
   * rather than about a list somebody remembered to update.
   */
  it.each(["WHATSAPP", "CASH_ON_DELIVERY", "MANUAL_TRANSFER"] as const)(
    "%s: the chip map is exactly the set of reachable states",
    (channel) => {
      const displayed = [...STATES_BY_CHANNEL[channel]].sort();
      const reachable = [...reachableStates(channel)].sort();

      expect(
        displayed,
        `The ${channel} display map and the server's transition graph ` +
          "disagree.\n" +
          "  src/components/order-state-chip.tsx (STATES_BY_CHANNEL) and " +
          "src/server/orders/state-machine.ts (ORDER_TRANSITIONS + the " +
          "claim-only channel rule) encode the same D-02/D-03 decision twice. " +
          "An extra entry here renders a chip no order on this channel can " +
          "ever wear; a missing one renders a row with no status at all.\n" +
          "  Change the SERVER map first — it is the one that decides what an " +
          "order may actually do — then mirror it here.",
      ).toEqual(reachable);
    },
  );

  it("keeps every claim-only state off the two direct-confirm channels", () => {
    // Stated separately from the sweep above because it is the specific
    // security-shaped claim: without it a cash-on-delivery order could be walked
    // into DISPUTED and used to fabricate a dispute over a payment that was
    // never in-band to begin with (T-03-15 / T-03-54).
    const claimOnly: OrderState[] = [
      "PAYMENT_PENDING",
      "PAYMENT_CLAIMED",
      "DISPUTED",
    ];

    for (const channel of ALL_CHANNELS) {
      if (channel === "MANUAL_TRANSFER") continue;
      for (const state of claimOnly) {
        expect(
          STATES_BY_CHANNEL[channel],
          `${state} is displayable on a ${channel} order.`,
        ).not.toContain(state);
      }
    }
  });

  it("covers every channel the enum declares", () => {
    const unmapped = ALL_CHANNELS.filter(
      (channel) => !STATES_BY_CHANNEL[channel],
    );

    expect(
      unmapped,
      "A channel in prisma/schema.prisma has no display rule. Add its row to " +
        "STATES_BY_CHANNEL and decide, explicitly, which states it can wear.",
    ).toEqual([]);
  });
});
