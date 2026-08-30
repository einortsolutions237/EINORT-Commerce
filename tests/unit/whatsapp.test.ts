import { describe, expect, it } from "vitest";

import {
  buildOrderMessage,
  buildWhatsAppOrderLink,
  formatXaf,
  type OrderMessageArgs,
} from "@/server/payments/whatsapp";

/**
 * CHK-02 / D-01 — the click-to-chat handoff.
 *
 * The number segment is the whole risk surface: the official click-to-chat
 * format takes a full international number with no `+`, no leading zero, no
 * brackets and no separators, and a number that fails that shape produces a
 * link that opens a "phone number not on WhatsApp" dead end on the customer's
 * device with nothing logged server-side. So `buildWhatsAppOrderLink` throws
 * rather than emitting a broken link (T-03-41), and this suite pins the throw.
 */

const MSISDN = "237670000001";

const sampleArgs: OrderMessageArgs = {
  storeName: "Ma Boutique",
  orderNumber: "AB12CD",
  trackingUrl: "https://maboutique.einort.com/order/tok_abc123",
  lines: [
    { quantity: 2, name: "Chemise en pagne", amountXaf: 30_000 },
    { quantity: 1, name: "Sac à main", amountXaf: 15_000 },
  ],
  totalXaf: 45_000,
};

describe("buildWhatsAppOrderLink", () => {
  it("builds the click-to-chat URL with a URL-encoded message body", () => {
    const message = "Order AB12 — 5 000 FCFA";
    const link = buildWhatsAppOrderLink(MSISDN, message);

    expect(link).toBe(
      `https://wa.me/${MSISDN}?text=${encodeURIComponent(message)}`,
    );
  });

  it("leaves no plus, space or bracket in the number segment", () => {
    const link = buildWhatsAppOrderLink(MSISDN, "hello");
    const numberSegment = link.slice(
      "https://wa.me/".length,
      link.indexOf("?"),
    );

    expect(numberSegment).toBe(MSISDN);
    expect(numberSegment).toMatch(/^237[0-9]{9}$/);
    expect(numberSegment).not.toMatch(/[+\s()\-.]/);
  });

  it("encodes characters that would otherwise break the query string", () => {
    const message = "Total: 45 000 F CFA & 2 items #AB12";
    const link = buildWhatsAppOrderLink(MSISDN, message);

    expect(link).not.toContain("#");
    expect(link).not.toContain(" ");
    expect(link).toContain(encodeURIComponent("&"));
    expect(decodeURIComponent(link.split("?text=")[1] ?? "")).toBe(message);
  });

  it("throws rather than emitting a link for an unnormalized number", () => {
    for (const bad of [
      "+237670000001",
      "237 670 000 001",
      "670000001",
      "0670000001",
      "23767000000",
      "2376700000012",
      "",
      "not-a-number",
    ]) {
      expect(() => buildWhatsAppOrderLink(bad, "hello")).toThrow();
    }
  });

  it("accepts exactly the storage form normalizeCameroonMsisdn produces", () => {
    expect(() => buildWhatsAppOrderLink("237690112233", "hi")).not.toThrow();
  });
});

describe("formatXaf", () => {
  it("formats whole XAF with no decimal subunit", () => {
    const formatted = formatXaf(45_000);
    expect(formatted).toContain("45");
    expect(formatted).not.toContain(",00");
    expect(formatted).not.toContain(".00");
  });
});

describe("buildOrderMessage", () => {
  it("puts the tracking URL within the first two lines", () => {
    const lines = buildOrderMessage(sampleArgs).split("\n");
    const trackingIndex = lines.findIndex((line) =>
      line.includes(sampleArgs.trackingUrl),
    );

    expect(trackingIndex).toBeGreaterThanOrEqual(0);
    expect(trackingIndex).toBeLessThanOrEqual(1);
  });

  it("names the store and the order number before anything else", () => {
    const first = buildOrderMessage(sampleArgs).split("\n")[0] ?? "";
    expect(first).toContain("Ma Boutique");
    expect(first).toContain("AB12CD");
  });

  it("renders each item as quantity, name and amount", () => {
    const message = buildOrderMessage(sampleArgs);
    expect(message).toContain("2 x Chemise en pagne");
    expect(message).toContain("1 x Sac à main");
  });

  it("puts the total on the last line", () => {
    const lines = buildOrderMessage(sampleArgs).split("\n");
    const last = lines[lines.length - 1] ?? "";
    expect(last).toContain(formatXaf(45_000));
    // No item line may follow the total.
    expect(last).not.toContain(" x ");
  });

  it("stays under 800 characters for a ten-line order", () => {
    const message = buildOrderMessage({
      ...sampleArgs,
      lines: Array.from({ length: 10 }, (_, index) => ({
        quantity: index + 1,
        name: `Produit numéro ${index + 1}`,
        amountXaf: (index + 1) * 5_000,
      })),
      totalXaf: 275_000,
    });

    expect(message.length).toBeLessThan(800);
  });

  it("survives an empty order without throwing", () => {
    expect(() =>
      buildOrderMessage({ ...sampleArgs, lines: [], totalXaf: 0 }),
    ).not.toThrow();
  });

  it("round-trips through the link encoder unchanged", () => {
    const message = buildOrderMessage(sampleArgs);
    const link = buildWhatsAppOrderLink(MSISDN, message);
    expect(decodeURIComponent(link.split("?text=")[1] ?? "")).toBe(message);
  });
});
