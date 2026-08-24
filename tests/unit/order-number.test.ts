import { describe, expect, it } from "vitest";

import {
  newOrderNumber,
  ORDER_NUMBER_ALPHABET,
  ORDER_NUMBER_LENGTH,
} from "@/server/orders/order-number";

/**
 * ORD-01's human-facing handle.
 *
 * The order number is not a security value — `trackingTokenHash` is. This one
 * optimises for a different constraint entirely: a customer reads it back to a
 * merchant over WhatsApp, and a merchant types it into a search box. So the
 * properties worth pinning are about transcription, not entropy.
 *
 * THE ALPHABET IS ASSERTED BY REGEX, NOT BY INSPECTION. A test that read the
 * constant and compared it to a copy of itself would pass for any alphabet at
 * all. What follows checks the emitted characters, which is the thing a
 * customer actually has to say out loud.
 */

/** The four letters and two digits a person cannot reliably tell apart. */
const AMBIGUOUS = /[ILOU01]/;

describe("newOrderNumber", () => {
  it("emits eight characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const number = newOrderNumber();

      // The plan's shape rule, and then the stricter truth: `[0-9A-HJ-NP-Z]`
      // already excludes I and O, but it still admits L, U, 0 and 1.
      expect(number).toMatch(/^[0-9A-HJ-NP-Z]{8}$/);
      expect(number).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
    }
  });

  it("never emits I, L, O, U, zero or one", () => {
    // "Is that an I or a 1?" over a crackly voice note is a support ticket and
    // a mis-shipped parcel. 5,000 draws over a 30-character alphabet makes a
    // stray member overwhelmingly likely to show up if one is ever added.
    for (let i = 0; i < 5000; i++) {
      expect(newOrderNumber()).not.toMatch(AMBIGUOUS);
    }
  });

  it("produces 5,000 distinct values in 5,000 calls", () => {
    const numbers = new Set<string>();
    for (let i = 0; i < 5000; i++) numbers.add(newOrderNumber());

    // 30^8 is ~6.6e11, so the birthday probability of a collision in 5,000
    // draws is ~2e-5. A failure here means the generator is biased or
    // stateful, not that the run was unlucky.
    expect(numbers.size).toBe(5000);
  });

  it("draws every alphabet member, so no character is unreachable", () => {
    // Rejection sampling is how the modulo bias is removed, and the way to get
    // it wrong is an off-by-one in the acceptance threshold that silently
    // starves the last member or two of the alphabet.
    const seen = new Set<string>();
    for (let i = 0; i < 20000; i++) {
      for (const character of newOrderNumber()) seen.add(character);
    }

    expect([...seen].sort().join("")).toBe(
      [...ORDER_NUMBER_ALPHABET].sort().join(""),
    );
  });
});

describe("the alphabet constant", () => {
  it("holds 30 distinct unambiguous characters", () => {
    expect(ORDER_NUMBER_ALPHABET).not.toMatch(AMBIGUOUS);
    expect(new Set(ORDER_NUMBER_ALPHABET).size).toBe(
      ORDER_NUMBER_ALPHABET.length,
    );
    expect(ORDER_NUMBER_ALPHABET.length).toBe(30);
    expect(ORDER_NUMBER_LENGTH).toBe(8);
  });
});
