/**
 * D-05's option matrix — the axes a merchant declares expanded into the exact
 * set of `ProductVariant` rows the product owns.
 *
 * ---------------------------------------------------------------------------
 * PURE. NO I/O, NO `server-only`, NO DATABASE.
 * ---------------------------------------------------------------------------
 * The marker is absent on purpose. This module has TWO callers and they must
 * agree:
 *
 *   1. `src/server/catalog/actions.ts` — the AUTHORITY. `createProduct`
 *      re-expands the axes server-side and rejects a submitted `variants` array
 *      whose combination set does not match (TEN-08). The client's array is a
 *      convenience for carrying prices and stock; it is never trusted to define
 *      which combinations exist.
 *   2. 03-11's product form — the live matrix PREVIEW, rendered in the browser
 *      as the merchant types option values.
 *
 * If those two ever disagreed, the form would show the merchant one catalogue
 * and the server would write another. One function, imported by both, is the
 * only way to make that class of bug impossible rather than merely unlikely.
 *
 * ---------------------------------------------------------------------------
 * D-05, EXACTLY
 * ---------------------------------------------------------------------------
 * At most TWO axes, ordered. Every combination is its own row with its own
 * stock and an optional per-variant price override. A product with no options
 * still owns exactly one variant row — so stock lives at exactly one level in
 * the schema and no reader ever has to ask whether to look at the product or at
 * its variants.
 */

/**
 * The combination ceiling for one product.
 *
 * Two guards in one number. It is a denial-of-service bound (T-03-33: a 40x40
 * matrix is 1,600 rows in a single request, checked BEFORE any array is
 * allocated), and it is a usability bound — a merchant who needs more than 50
 * combinations on one product is describing several products, and A2's form
 * cannot render a 1,600-row stock table usefully anyway.
 */
export const VARIANT_MATRIX_MAX = 50;

/** The two option axes as the merchant declared them. */
export interface VariantAxes {
  readonly option1Name: string | null;
  readonly values1: readonly string[];
  readonly option2Name: string | null;
  readonly values2: readonly string[];
}

/**
 * One `(option1Value, option2Value)` pair — the natural key of a
 * `ProductVariant` within its product.
 *
 * Both fields are ALWAYS strings, never `null`. Pitfall 2: Postgres treats
 * NULLs as distinct inside a unique index, so two all-NULL rows would both be
 * accepted by `@@unique([tenantId, productId, option1Value, option2Value])` and
 * one product would silently carry two independent stock counts. The empty
 * string collides; NULL does not.
 */
export interface VariantCombination {
  readonly option1Value: string;
  readonly option2Value: string;
}

/**
 * Thrown when the declared axes multiply out past {@link VARIANT_MATRIX_MAX}.
 *
 * Carries the computed count because A2's error copy renders it — the merchant
 * is told how far over they are, not merely that they are over.
 */
export class VariantMatrixTooLargeError extends Error {
  readonly count: number;

  constructor(count: number) {
    super(
      `Variant matrix would produce ${count} combinations, above the maximum of ${VARIANT_MATRIX_MAX}.`,
    );
    this.name = "VariantMatrixTooLargeError";
    this.count = count;
  }
}

/**
 * Thrown when a second axis is declared without a usable first one.
 *
 * The two axes are ORDERED, not a set. Allowing axis 2 to stand alone would put
 * the empty sentinel in `option1Value` on every row while `option2Value`
 * carried the real data — every downstream reader (the A2 stock table, the PDP
 * option picker, `variantLabelFor`) would then need a special case for a
 * shape the form cannot even produce.
 */
export class VariantAxisOrderError extends Error {
  constructor() {
    super("A second option axis cannot exist without a first.");
    this.name = "VariantAxisOrderError";
  }
}

/** The single implicit variant a product with no options owns. */
const IMPLICIT_VARIANT: VariantCombination = {
  option1Value: "",
  option2Value: "",
};

/**
 * Trimmed, empties dropped, duplicates collapsed case-insensitively — with the
 * FIRST occurrence's casing preserved.
 *
 * `["S", " s "]` is one option value typed twice, not two. Writing it as two
 * rows would trip the `@@unique` constraint only after the transaction had
 * already opened, turning a typo into a 500. Case-insensitive because a
 * merchant who typed `Blue` and `blue` meant one colour; preserving the first
 * casing because they meant THEIR casing, not a normalised one.
 */
function normaliseAxisValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const raw of values) {
    const value = raw.trim();
    if (value === "") continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    kept.push(value);
  }

  return kept;
}

/**
 * The axes expanded into the exact variant rows the product owns.
 *
 * Ordering is `values1` x `values2` — axis 1 is the outer loop — so the rows
 * come back grouped by the first option, which is the order A2's stock table
 * renders and the order a merchant reads.
 *
 * A declared axis with no usable values is NOT an error: a merchant who clicked
 * "Add an option", typed `Size` and no values has a product with no options
 * yet, not a product with zero variants. It degrades to the implicit variant.
 *
 * The cap is checked against the PRODUCT of the two axis lengths before the
 * result array is built, so a 1,600-combination request is refused without ever
 * allocating 1,600 objects (T-03-33).
 *
 * @throws {VariantAxisOrderError} axis 2 declared without a usable axis 1
 * @throws {VariantMatrixTooLargeError} more than {@link VARIANT_MATRIX_MAX}
 */
export function expandVariantMatrix(axes: VariantAxes): VariantCombination[] {
  const values1 = axes.option1Name === null ? [] : normaliseAxisValues(axes.values1);
  const values2 = axes.option2Name === null ? [] : normaliseAxisValues(axes.values2);

  if (values2.length > 0 && values1.length === 0) {
    throw new VariantAxisOrderError();
  }

  if (values1.length === 0) return [IMPLICIT_VARIANT];

  if (values2.length === 0) {
    return values1.map((option1Value) => ({ option1Value, option2Value: "" }));
  }

  const count = values1.length * values2.length;
  if (count > VARIANT_MATRIX_MAX) {
    throw new VariantMatrixTooLargeError(count);
  }

  const combinations: VariantCombination[] = [];
  for (const option1Value of values1) {
    for (const option2Value of values2) {
      combinations.push({ option1Value, option2Value });
    }
  }

  return combinations;
}

/**
 * A combination rendered for a human — `M / Blue`, `M`, or `""`.
 *
 * The implicit variant returns the EMPTY STRING rather than a word. Inventing
 * `"Default"` here would put a user-facing string outside `src/lib/strings.ts`
 * (C-14) and would show a merchant with no options a label they never chose.
 * The caller decides what, if anything, to render in its place.
 */
export function variantLabelFor(combination: VariantCombination): string {
  return [combination.option1Value, combination.option2Value]
    .filter((value) => value !== "")
    .join(" / ");
}
