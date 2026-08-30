import { describe, expect, it } from "vitest";

import {
  buildMerchantUssd,
  MERCHANT_CODE_PATTERN,
  MTN_MENU_CODE,
  ORANGE_MENU_CODE,
  ORANGE_MERCHANT_CODE_ENTRY,
} from "@/server/payments/ussd";

/**
 * D-15, as a test rather than as a hope.
 *
 * The research resolved a narrow answer: exactly one operator publishes a
 * fully-parametrized merchant-payment dial string, and only for merchants
 * holding a 6-digit MoMoPay code. Every other combination must return `null`,
 * because a `null` return is the instruction to render the manual-copy block
 * alone — a dead `tel:` button is worse than no button at all.
 *
 * The `href !== display` assertion below is not cosmetic: it IS the fix for the
 * pitfall where an unencoded `#` makes a browser treat the rest of the URI as a
 * fragment and truncate the dial string silently, on the customer's phone,
 * with no server-side signal that anything went wrong.
 */

const MTN_CODED = { mtnMerchantCode: "123456", orangeMerchantCode: null };

describe("operator constants", () => {
  it("are the verified official entry points and nothing else", () => {
    expect(MTN_MENU_CODE).toBe("*126#");
    expect(ORANGE_MENU_CODE).toBe("#150#");
    expect(ORANGE_MERCHANT_CODE_ENTRY).toBe("#150*47#");
  });

  it("validates a merchant code as exactly six digits", () => {
    expect(MERCHANT_CODE_PATTERN.test("123456")).toBe(true);
    expect(MERCHANT_CODE_PATTERN.test("12345")).toBe(false);
    expect(MERCHANT_CODE_PATTERN.test("1234567")).toBe(false);
    expect(MERCHANT_CODE_PATTERN.test("12345a")).toBe(false);
  });
});

describe("buildMerchantUssd — the one case that works", () => {
  it("builds the MTN merchant-payment string for a valid 6-digit code", () => {
    const built = buildMerchantUssd("MTN_MOMO", MTN_CODED, 5000);
    expect(built).not.toBeNull();
    expect(built?.display).toBe("*126*4*123456*5000#");
    expect(built?.href).toBe("tel:*126*4*123456*5000%23");
  });

  it("percent-encodes every hash in the href and keeps the label literal", () => {
    const built = buildMerchantUssd("MTN_MOMO", MTN_CODED, 5000);
    expect(built).not.toBeNull();
    if (!built) throw new Error("unreachable");

    // The inequality IS the fix: an href identical to the display string is an
    // href whose '#' was never encoded.
    expect(built.href).not.toBe(built.display);
    expect(built.display).toContain("#");
    expect(built.href).not.toContain("#");
    expect(built.href.startsWith("tel:")).toBe(true);
  });

  it("interpolates the server-computed amount verbatim", () => {
    expect(buildMerchantUssd("MTN_MOMO", MTN_CODED, 1)?.display).toBe(
      "*126*4*123456*1#",
    );
    expect(buildMerchantUssd("MTN_MOMO", MTN_CODED, 1_250_000)?.display).toBe(
      "*126*4*123456*1250000#",
    );
  });
});

describe("buildMerchantUssd — null is the normal case", () => {
  it("returns null for a 5-digit merchant code", () => {
    expect(
      buildMerchantUssd(
        "MTN_MOMO",
        { mtnMerchantCode: "12345", orangeMerchantCode: null },
        5000,
      ),
    ).toBeNull();
  });

  it("returns null for a 7-digit merchant code", () => {
    expect(
      buildMerchantUssd(
        "MTN_MOMO",
        { mtnMerchantCode: "1234567", orangeMerchantCode: null },
        5000,
      ),
    ).toBeNull();
  });

  it("returns null when no merchant code is configured", () => {
    expect(
      buildMerchantUssd(
        "MTN_MOMO",
        { mtnMerchantCode: null, orangeMerchantCode: null },
        5000,
      ),
    ).toBeNull();
  });

  it("returns null for a non-numeric merchant code — never interpolated", () => {
    // T-03-40: a merchant-controlled string reaching a tel: URI is the threat.
    for (const code of ["12345a", "*126*4", "12 3456", "1234 56", "＃150"]) {
      expect(
        buildMerchantUssd(
          "MTN_MOMO",
          { mtnMerchantCode: code, orangeMerchantCode: null },
          5000,
        ),
      ).toBeNull();
    }
  });

  it("returns null for Orange even with a valid merchant code", () => {
    // Orange's entry point takes no parameters, so a button would hide the
    // code and the amount the customer still has to type by hand.
    expect(
      buildMerchantUssd(
        "ORANGE_MONEY",
        { mtnMerchantCode: null, orangeMerchantCode: "123456" },
        5000,
      ),
    ).toBeNull();
    expect(
      buildMerchantUssd(
        "ORANGE_MONEY",
        { mtnMerchantCode: "123456", orangeMerchantCode: "123456" },
        5000,
      ),
    ).toBeNull();
  });

  it("returns null for a zero, negative or non-integer amount", () => {
    expect(buildMerchantUssd("MTN_MOMO", MTN_CODED, 0)).toBeNull();
    expect(buildMerchantUssd("MTN_MOMO", MTN_CODED, -5000)).toBeNull();
    expect(buildMerchantUssd("MTN_MOMO", MTN_CODED, 12.5)).toBeNull();
    expect(buildMerchantUssd("MTN_MOMO", MTN_CODED, Number.NaN)).toBeNull();
    expect(buildMerchantUssd("MTN_MOMO", MTN_CODED, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
