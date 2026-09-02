import { describe, expect, it } from "vitest";

import {
  hexColorSchema,
  pageDocumentSchema,
  sectionInstanceSchema,
  storageKeySchema,
  themeTokensSchema,
} from "@/server/theming/schema";

/**
 * EDIT-01 — the page document graph, proved with no database and no browser.
 *
 * `src/server/theming/schema.ts` is the single validation boundary three
 * separate trust boundaries all narrow through: the JSONB column, the
 * `postMessage` payload the preview receives from a framing page, and the
 * publish gate. Each of those is reached by a different route with a different
 * attacker model, and none of them has a second check downstream — so the
 * assertions below are not "does Zod work", they are the statement of what
 * those three doors refuse.
 *
 * THE COLOUR AND KEY CASES ARE SECURITY TESTS, NOT FORMATTING TESTS. A value
 * that clears `hexColorSchema` is written verbatim into a CSS custom property
 * by `setProperty`, which does not sanitise (Pitfall 3, T-04-09); a value that
 * clears `storageKeySchema` is used to build an object path. The rejected
 * inputs below are the payloads, spelled out, so a later "let's also accept
 * `rgb()`" arrives as a failing test rather than as a rendered stylesheet.
 */

/** Valid settings per type, reused and spread-modified by the cases below. */
const HERO = {
  eyebrow: "Welcome",
  heading: "New arrivals",
  body: "Everything we're selling right now, in one place.",
  ctaLabel: "Shop now",
  ctaHref: "/",
  backgroundImageKey: null,
  overlayOpacity: 0.3,
} as const;

const TRUST_ITEM = {
  type: "trust-item",
  icon: "truck",
  heading: "Delivery in Douala",
  body: "We'll get your order to you.",
} as const;

const PRODUCT_GRID = {
  heading: "What we're selling",
  viewAllLabel: "View all",
  viewAllHref: "/",
  itemCount: 8,
} as const;

const EDITORIAL_SPLIT = {
  eyebrow: "About us",
  heading: "A little about this shop",
  body: "Tell customers who you are and why they should buy from you.",
  ctaLabel: "See what's in stock",
  ctaHref: "/",
  imageKey: null,
} as const;

const CONTACT = {
  heading: "Questions? Message us.",
  body: "Send us a message on WhatsApp and we'll get back to you.",
  ctaLabel: "Message us on WhatsApp",
} as const;

/** A section of each type, in the locked default order (UI-SPEC S1-S5). */
function validSections() {
  return [
    { id: "s-hero", type: "hero", settings: { ...HERO } },
    {
      id: "s-trust",
      type: "trust-bar",
      settings: { blocks: [{ ...TRUST_ITEM }] },
    },
    { id: "s-grid", type: "product-grid", settings: { ...PRODUCT_GRID } },
    {
      id: "s-split",
      type: "editorial-split",
      settings: { ...EDITORIAL_SPLIT },
    },
    { id: "s-contact", type: "contact", settings: { ...CONTACT } },
  ];
}

/** The whole flagship home, valid. */
function validDocument() {
  return { version: 1, sections: validSections() };
}

/** `n` trust items, for the 0/1/4/5 boundary cases. */
function trustBar(count: number) {
  return {
    id: "s-trust",
    type: "trust-bar",
    settings: {
      blocks: Array.from({ length: count }, () => ({ ...TRUST_ITEM })),
    },
  };
}

describe("hexColorSchema", () => {
  it("accepts a 6-digit hex in either case", () => {
    expect(hexColorSchema.safeParse("#18181B").success).toBe(true);
    expect(hexColorSchema.safeParse("#fde047").success).toBe(true);
  });

  it("rejects everything that is not a 6-digit hex", () => {
    // A CSS keyword is a valid colour to a browser and an invalid one to us:
    // accepting it would mean accepting the injection case below, since both
    // arrive through the same field.
    expect(hexColorSchema.safeParse("red").success).toBe(false);
    // Three-digit shorthand is given up deliberately — `<input type="color">`
    // emits `#rrggbb` and nothing else, so shorthand is never a real user.
    expect(hexColorSchema.safeParse("#FFF").success).toBe(false);
    expect(hexColorSchema.safeParse("#18181Z").success).toBe(false);
  });

  it("rejects a declaration-injection payload (T-04-09)", () => {
    // This is the whole reason the regex is anchored at both ends. React writes
    // this value into a custom property with setProperty and does not sanitise.
    expect(
      hexColorSchema.safeParse("red; background-image: url(https://evil/x)")
        .success,
    ).toBe(false);
  });
});

describe("storageKeySchema", () => {
  it("accepts an R2 derivative prefix in the tenants namespace", () => {
    expect(
      storageKeySchema.safeParse(
        "tenants/abc-123/logos/0191c2f4-aaaa-bbbb-cccc-000000000001",
      ).success,
    ).toBe(true);
    expect(
      storageKeySchema.safeParse("tenants/abc/products/0191c2f4-aaaa-bbbb")
        .success,
    ).toBe(true);
  });

  it("rejects an absolute URL", () => {
    // A key is a prefix, never a URL. Accepting one would let a document point
    // the storefront's <Image> at an arbitrary host.
    expect(
      storageKeySchema.safeParse("https://evil.example/tenants/abc/logos/x")
        .success,
    ).toBe(false);
  });

  it("rejects a traversal segment", () => {
    expect(
      storageKeySchema.safeParse("tenants/../../etc/logos/passwd-file").success,
    ).toBe(false);
  });

  it("rejects a key outside the tenants namespace", () => {
    expect(
      storageKeySchema.safeParse("uploads/abc/logos/0191c2f4-aaaa").success,
    ).toBe(false);
  });
});

describe("sectionInstanceSchema", () => {
  it("rejects a type that is not in the union", () => {
    // D-05: membership is fixed. "newsletter" is the exact section the spec
    // refused (UI-SPEC S5) — there is no email backend to receive it.
    const parsed = sectionInstanceSchema.safeParse({
      id: "s-news",
      type: "newsletter",
      settings: { heading: "Sign up" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a hero missing a required settings key", () => {
    const { heading: _heading, ...withoutHeading } = HERO;
    const parsed = sectionInstanceSchema.safeParse({
      id: "s-hero",
      type: "hero",
      settings: withoutHeading,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a hero overlay opacity above the 0.8 clamp", () => {
    // Above 0.8 the photo is gone and the section is a dark rectangle — the
    // clamp is a design floor, enforced where it cannot be forgotten.
    expect(
      sectionInstanceSchema.safeParse({
        id: "s-hero",
        type: "hero",
        settings: { ...HERO, overlayOpacity: 0.9 },
      }).success,
    ).toBe(false);
  });

  it("accepts the full legal overlay opacity range", () => {
    for (const overlayOpacity of [0, 0.3, 0.8]) {
      expect(
        sectionInstanceSchema.safeParse({
          id: "s-hero",
          type: "hero",
          settings: { ...HERO, overlayOpacity },
        }).success,
      ).toBe(true);
    }
  });

  it("bounds trust-bar blocks to 1..4", () => {
    expect(sectionInstanceSchema.safeParse(trustBar(0)).success).toBe(false);
    expect(sectionInstanceSchema.safeParse(trustBar(1)).success).toBe(true);
    expect(sectionInstanceSchema.safeParse(trustBar(4)).success).toBe(true);
    expect(sectionInstanceSchema.safeParse(trustBar(5)).success).toBe(false);
  });

  it("rejects a trust-item icon outside the closed enum", () => {
    expect(
      sectionInstanceSchema.safeParse({
        id: "s-trust",
        type: "trust-bar",
        settings: { blocks: [{ ...TRUST_ITEM, icon: "rocket" }] },
      }).success,
    ).toBe(false);
  });

  it("rejects a product-grid item count outside 4 / 8 / 12", () => {
    expect(
      sectionInstanceSchema.safeParse({
        id: "s-grid",
        type: "product-grid",
        settings: { ...PRODUCT_GRID, itemCount: 6 },
      }).success,
    ).toBe(false);
    for (const itemCount of [4, 8, 12]) {
      expect(
        sectionInstanceSchema.safeParse({
          id: "s-grid",
          type: "product-grid",
          settings: { ...PRODUCT_GRID, itemCount },
        }).success,
      ).toBe(true);
    }
  });

  it("rejects a non-hex value reaching an image key field", () => {
    expect(
      sectionInstanceSchema.safeParse({
        id: "s-hero",
        type: "hero",
        settings: { ...HERO, backgroundImageKey: "https://evil.example/x.png" },
      }).success,
    ).toBe(false);
  });
});

describe("pageDocumentSchema", () => {
  it("refuses an empty section list", () => {
    // A zero-section document renders a blank page. `.min(1)` means a merchant
    // cannot reach that state through any door, including a direct POST.
    expect(pageDocumentSchema.safeParse({ version: 1, sections: [] }).success).toBe(
      false,
    );
  });

  it("refuses a version it was not written for", () => {
    // Pitfall 9 / T-04-12: a settings rename is a migration, not an edit. A
    // literal makes the mismatch a refused parse instead of a silent misread.
    expect(
      pageDocumentSchema.safeParse({ version: 2, sections: validSections() })
        .success,
    ).toBe(false);
  });

  it("refuses a document containing one bad section", () => {
    // Built as a fresh literal rather than by mutating `validSections()`: the
    // helper's element type is narrowed to the legal shapes, so assigning an
    // out-of-range value into it is a compile error before it is a parse error.
    const sections = [
      {
        id: "s-hero",
        type: "hero",
        settings: { ...HERO, overlayOpacity: 5 },
      },
      ...validSections().slice(1),
    ];
    expect(pageDocumentSchema.safeParse({ version: 1, sections }).success).toBe(
      false,
    );
  });

  it("round-trips a valid document unchanged", () => {
    const doc = validDocument();
    expect(pageDocumentSchema.parse(doc)).toEqual(doc);
  });

  it("preserves array order, because array order IS the section order", () => {
    const doc = validDocument();
    const parsed = pageDocumentSchema.parse(doc);
    expect(parsed.sections.map((section) => section.type)).toEqual([
      "hero",
      "trust-bar",
      "product-grid",
      "editorial-split",
      "contact",
    ]);
  });
});

describe("themeTokensSchema", () => {
  const TOKENS = {
    primaryAccent: "#18181B",
    secondaryAccent: "#71717A",
    announcementText: "Order online. Pay by Mobile Money or on delivery.",
    footerTagline: "Thanks for shopping with us.",
  };

  it("accepts the default token set", () => {
    expect(themeTokensSchema.safeParse(TOKENS).success).toBe(true);
  });

  it("rejects a non-hex primary accent", () => {
    expect(
      themeTokensSchema.safeParse({ ...TOKENS, primaryAccent: "rebeccapurple" })
        .success,
    ).toBe(false);
  });

  it("rejects a non-hex secondary accent", () => {
    expect(
      themeTokensSchema.safeParse({ ...TOKENS, secondaryAccent: "#71717" })
        .success,
    ).toBe(false);
  });
});
