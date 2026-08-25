import { describe, expect, it } from "vitest";

import { slugifyProductName } from "@/server/catalog/slug";
import {
  expandVariantMatrix,
  VARIANT_MATRIX_MAX,
  VariantAxisOrderError,
  VariantMatrixTooLargeError,
  variantLabelFor,
} from "@/server/catalog/variant-matrix";

/**
 * The two pure catalog helpers — D-05's option matrix and the product slug.
 *
 * Both live in this one file because both are the same kind of thing: no I/O,
 * no database, no `server-only`, and both are imported by BOTH the server
 * authority (`src/server/catalog/actions.ts`) and 03-11's client-side form.
 * That shared-by-two-callers property is exactly why they are exhaustively
 * tested here rather than incidentally through the isolation suite: the form
 * shows the merchant a live variant preview, and if the preview and the server
 * ever disagree about how many rows a `Size x Color` product has, the merchant
 * is shown one catalogue and sold another.
 *
 * `expandVariantMatrix` is the authority in that pairing. The form's array is a
 * convenience; `createProduct` re-expands the axes and rejects a submitted set
 * that does not match (TEN-08).
 */

// ---------------------------------------------------------------------------
// Product slug
// ---------------------------------------------------------------------------

describe("product slug", () => {
  it("strips accents, punctuation and repeated separators", () => {
    // NFD + combining-mark strip is what turns Édition into edition rather
    // than into `dition`, which a naive [a-z0-9] filter would produce.
    expect(slugifyProductName("Robe Wax  Édition -- Limitée!")).toBe(
      "robe-wax-edition-limitee",
    );
  });

  it("lowercases and collapses interior whitespace", () => {
    expect(slugifyProductName("Sac   À   Main")).toBe("sac-a-main");
  });

  it("trims leading and trailing separators", () => {
    expect(slugifyProductName("  --Chaussures--  ")).toBe("chaussures");
  });

  it("returns the empty string when nothing survives", () => {
    // Deliberate and documented: the caller appends a short random suffix
    // rather than this function inventing one, so it stays pure and testable.
    expect(slugifyProductName("   ")).toBe("");
    expect(slugifyProductName("!!!")).toBe("");
    expect(slugifyProductName("")).toBe("");
  });

  it("caps at 60 characters without leaving a trailing hyphen", () => {
    const slug = slugifyProductName(`${"ab ".repeat(40)}tail`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.startsWith("ab-ab-ab")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Variant matrix
// ---------------------------------------------------------------------------

const noAxes = {
  option1Name: null,
  values1: [] as readonly string[],
  option2Name: null,
  values2: [] as readonly string[],
};

describe("variant matrix", () => {
  it("gives a product with no options exactly one implicit variant", () => {
    // Pitfall 2: the empty string is the sentinel, never NULL, because Postgres
    // treats NULLs as distinct in a unique index — two all-NULL rows would both
    // be permitted and the product would hold two separate stock counts.
    expect(expandVariantMatrix(noAxes)).toEqual([
      { option1Value: "", option2Value: "" },
    ]);
  });

  it("expands one axis, leaving the second value empty", () => {
    expect(
      expandVariantMatrix({
        ...noAxes,
        option1Name: "Size",
        values1: ["S", "M"],
      }),
    ).toEqual([
      { option1Value: "S", option2Value: "" },
      { option1Value: "M", option2Value: "" },
    ]);
  });

  it("expands two axes in values1 x values2 order", () => {
    expect(
      expandVariantMatrix({
        option1Name: "Size",
        values1: ["S", "M"],
        option2Name: "Color",
        values2: ["Blue", "Red"],
      }),
    ).toEqual([
      { option1Value: "S", option2Value: "Blue" },
      { option1Value: "S", option2Value: "Red" },
      { option1Value: "M", option2Value: "Blue" },
      { option1Value: "M", option2Value: "Red" },
    ]);
  });

  it("collapses duplicate values case-insensitively, keeping the merchant's casing", () => {
    // `["S", " s "]` is one option value typed twice, not two — and writing it
    // as two rows would violate the @@unique on (option1Value, option2Value)
    // only AFTER the transaction had already started.
    expect(
      expandVariantMatrix({
        ...noAxes,
        option1Name: "Size",
        values1: ["S", " s ", "M"],
      }),
    ).toEqual([
      { option1Value: "S", option2Value: "" },
      { option1Value: "M", option2Value: "" },
    ]);
  });

  it("drops values that are empty once trimmed", () => {
    expect(
      expandVariantMatrix({
        ...noAxes,
        option1Name: "Size",
        values1: ["S", "  ", ""],
      }),
    ).toEqual([{ option1Value: "S", option2Value: "" }]);
  });

  it("falls back to the implicit variant when a declared axis has no values", () => {
    // A merchant who clicked "Add an option", typed a name and no values has a
    // product with no options yet — not a product with zero variants.
    expect(
      expandVariantMatrix({ ...noAxes, option1Name: "Size", values1: [] }),
    ).toEqual([{ option1Value: "", option2Value: "" }]);
  });
});

describe("variant matrix guard", () => {
  it("refuses more than VARIANT_MATRIX_MAX combinations, carrying the count", () => {
    const values1 = Array.from({ length: 10 }, (_, i) => `v${i}`);
    const values2 = Array.from({ length: 6 }, (_, i) => `w${i}`);

    expect(VARIANT_MATRIX_MAX).toBe(50);

    let thrown: unknown;
    try {
      expandVariantMatrix({
        option1Name: "Size",
        values1,
        option2Name: "Color",
        values2,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(VariantMatrixTooLargeError);
    // The count travels on the error because A2's copy renders it:
    // "That's {n} variants — more than the 50 this form can handle."
    expect((thrown as VariantMatrixTooLargeError).count).toBe(60);
  });

  it("allows exactly VARIANT_MATRIX_MAX combinations", () => {
    const values1 = Array.from({ length: 10 }, (_, i) => `v${i}`);
    const values2 = Array.from({ length: 5 }, (_, i) => `w${i}`);

    expect(
      expandVariantMatrix({
        option1Name: "Size",
        values1,
        option2Name: "Color",
        values2,
      }),
    ).toHaveLength(VARIANT_MATRIX_MAX);
  });

  it("refuses a second axis declared without a first", () => {
    // D-05 caps at two axes and they are ordered: axis 2 cannot exist without
    // axis 1, or `option1Value` would be the empty sentinel on every row while
    // `option2Value` carried real data.
    expect(() =>
      expandVariantMatrix({
        option1Name: null,
        values1: [],
        option2Name: "Color",
        values2: ["Blue"],
      }),
    ).toThrow(VariantAxisOrderError);
  });

  it("refuses a second axis whose first axis has no usable values", () => {
    expect(() =>
      expandVariantMatrix({
        option1Name: "Size",
        values1: ["   "],
        option2Name: "Color",
        values2: ["Blue"],
      }),
    ).toThrow(VariantAxisOrderError);
  });
});

describe("variant label", () => {
  it("joins both values with a slash", () => {
    expect(variantLabelFor({ option1Value: "M", option2Value: "Blue" })).toBe(
      "M / Blue",
    );
  });

  it("renders a single axis without a separator", () => {
    expect(variantLabelFor({ option1Value: "M", option2Value: "" })).toBe("M");
  });

  it("renders the implicit variant as the empty string", () => {
    // The implicit default variant has no label to show. The caller decides
    // what to render in its place; inventing "Default" here would put a
    // user-facing word outside src/lib/strings.ts.
    expect(variantLabelFor({ option1Value: "", option2Value: "" })).toBe("");
  });
});
