import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The A2 product form's contract, asserted against the source.
 *
 * Four properties of `src/app/(dashboard)/dashboard/products/**` are
 * load-bearing enough that losing one is a real regression, and none of them is
 * visible to a behavioural test:
 *
 *   1. **The matrix the merchant sees is the matrix the server writes.**
 *      `createProduct` and `updateProduct` re-expand the submitted axes with
 *      `expandVariantMatrix` and REFUSE a `variants` array whose combination set
 *      is not exactly the expansion (T-03-56). If the form grew its own nested
 *      loop over the two value arrays, the two would eventually disagree — over
 *      a trimmed value, a case-folded duplicate, an ordering — and the merchant
 *      would meet a save failure with no explanation available to them. Nothing
 *      at runtime notices that two functions have drifted apart; only this does.
 *   2. **Neither route is wired to the wrong action.** A create route calling
 *      `updateProduct` throws on a missing id; an edit route calling
 *      `createProduct` silently makes a SECOND product and leaves the first
 *      untouched. The second failure is worse and is invisible until a merchant
 *      finds a duplicate in their list.
 *   3. **The three-step upload cannot collapse into a Server Action.** Next 16
 *      caps action bodies at 1 MB, which a phone photo routinely exceeds, so
 *      "simplify" the presign/PUT/finalize sequence into one action and every
 *      real photo fails while every test fixture passes.
 *   4. **No copy is inlined and no delete affordance exists.** C-14 puts all
 *      user-facing strings in `src/lib/strings.ts`; D-08 forbids a delete
 *      affordance for a product, because an `OrderItem` references it forever.
 *
 * The idiom is `tests/unit/dashboard-nav.test.ts`'s: read what is on disk,
 * strip comments, match text, and fail with a message that names the offending
 * file. It imports no application code, opens no socket and touches no
 * database, which is why it lives in the `unit` project.
 *
 * IT MUST NOT PASS VACUOUSLY. A moved route group would leave every assertion
 * scanning an empty string and reporting perfect health, so the first test pins
 * that the files exist and were actually read.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const PRODUCTS_DIR = "src/app/(dashboard)/dashboard/products";

const MATRIX_FIELD = `${PRODUCTS_DIR}/variant-matrix-field.tsx`;
const PRODUCT_FORM = `${PRODUCTS_DIR}/product-form.tsx`;
const GALLERY_FIELD = `${PRODUCTS_DIR}/image-gallery-field.tsx`;

const REQUIRED_FILES = [MATRIX_FIELD, PRODUCT_FORM, GALLERY_FIELD] as const;

/**
 * Blank out comments, keeping string literals and line numbering intact.
 *
 * Comments must go or the guard eats itself: the header of every file below has
 * to be able to name `expandVariantMatrix`, quote the copy rule and spell out
 * why a trash icon is banned in order to explain the contract this file
 * enforces. String literals must STAY, because they are the thing being
 * checked. Characters are replaced with spaces rather than removed so a
 * reported line number still points at the real line in the real file.
 *
 * Lifted verbatim from `tests/unit/dashboard-nav.test.ts` rather than shared:
 * a helper extracted into `tests/setup/` is a helper a future edit can change
 * for one caller and silently weaken for the other.
 */
function stripComments(code: string): string {
  const out = code.split("");
  let i = 0;

  const blankUntil = (end: number) => {
    for (let k = i; k < end && k < out.length; k++) {
      if (out[k] !== "\n") out[k] = " ";
    }
  };

  while (i < code.length) {
    const two = code.slice(i, i + 2);

    if (two === "//") {
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? code.length : end;
      blankUntil(stop);
      i = stop;
      continue;
    }

    if (two === "/*") {
      const end = code.indexOf("*/", i + 2);
      const stop = end === -1 ? code.length : end + 2;
      blankUntil(stop);
      i = stop;
      continue;
    }

    const quote = code[i];
    if (quote === '"' || quote === "'" || quote === "`") {
      let k = i + 1;
      while (k < code.length) {
        if (code[k] === "\\") {
          k += 2;
          continue;
        }
        if (code[k] === quote) {
          k += 1;
          break;
        }
        k += 1;
      }
      i = k;
      continue;
    }

    i += 1;
  }

  return out.join("");
}

/** Every `.tsx` file under a directory, recursively, as repo-relative paths. */
function tsxFilesUnder(dir: string): string[] {
  const absolute = join(repoRoot, dir);
  if (!existsSync(absolute)) return [];

  const found: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...tsxFilesUnder(child));
    } else if (entry.name.endsWith(".tsx")) {
      found.push(child);
    }
  }
  return found;
}

function readCode(file: string): string {
  const absolute = join(repoRoot, file);
  return existsSync(absolute)
    ? stripComments(readFileSync(absolute, "utf8"))
    : "";
}

const productsFiles = tsxFilesUnder(PRODUCTS_DIR).sort();
const code = new Map(productsFiles.map((file) => [file, readCode(file)]));

function codeOf(file: string): string {
  return code.get(file) ?? "";
}

/**
 * Attributes whose values are addresses, styling or accessibility plumbing
 * rather than prose. A line carrying one of them is exempt from the
 * inline-copy scan.
 */
const NON_COPY_LINE = /\bimport\b|\bclassName\b|\bhref\b|\baria-[a-z]+\b/;

/** A quoted run of three or more plain words — the shape of a sentence. */
const QUOTED_PROSE = /"([^"\\\n]+)"|'([^'\\\n]+)'/g;

function looksLikeProse(value: string): boolean {
  const words = value.trim().split(/\s+/);
  if (words.length < 3) return false;
  return words.every((word) => /^[A-Za-z][A-Za-z'’]*$/.test(word));
}

/** lucide's trash icons, in import and JSX spellings. */
const TRASH_ICON = /\btrash-2\b|\bTrash2?(?:Icon)?\b/;

/**
 * A locally grown combination loop — the shape this contract exists to forbid.
 *
 * Two spellings, because they are the two a well-meaning contributor reaches
 * for: a `map`/`flatMap` over the first value array that mentions the second
 * inside it, and a pair of nested `for … of` loops over the two arrays. Neither
 * is a formatting preference; either one is a second implementation of the
 * function the server trusts.
 */
const INLINE_MAP_LOOP = /values1[^\n]*\.(?:flatMap|map)\((?:[^\n]|\n(?!\n))*?values2/;
const INLINE_FOR_LOOP =
  /for\s*\((?:const|let)[^)]*\bof\b[^)]*values1[^)]*\)[\s\S]{0,400}?for\s*\((?:const|let)[^)]*\bof\b[^)]*values2/;

describe("A2 product form contract", () => {
  it("actually read the products route tree", () => {
    expect(
      productsFiles.length,
      `No .tsx files were found under ${PRODUCTS_DIR}. Every assertion in ` +
        "this file would then scan an empty string and pass with zero " +
        "coverage — update PRODUCTS_DIR in " +
        "tests/unit/product-form-contract.test.ts to the form's new home.",
    ).toBeGreaterThan(0);

    const missing = REQUIRED_FILES.filter(
      (file) => codeOf(file).trim().length === 0,
    );

    expect(
      missing,
      "A file this contract is about is missing or empty once comments are " +
        "stripped, so there is no code left to check. If it was renamed, " +
        "rename it here in the same commit.",
    ).toEqual([]);
  });

  it("derives the variant matrix from the server's own expander", () => {
    const matrix = codeOf(MATRIX_FIELD);

    expect(
      /import\s*\{[\s\S]*?expandVariantMatrix[\s\S]*?\}\s*from\s*["']@\/server\/catalog\/variant-matrix["']/.test(
        matrix,
      ),
      `${MATRIX_FIELD} does not import expandVariantMatrix from ` +
        "@/server/catalog/variant-matrix.\n" +
        "  createProduct and updateProduct re-expand the submitted axes with " +
        "that exact function and reject a variants array whose combination " +
        "set does not match (T-03-56). The client must therefore propose the " +
        "same set, and the only way to guarantee that is to call the same " +
        "function — a second implementation here surfaces to the merchant as " +
        "a save that fails for no visible reason.\n" +
        "  The module is deliberately pure and carries no server-only marker, " +
        "so importing it into a client island is sanctioned.",
    ).toBe(true);

    expect(
      [
        INLINE_MAP_LOOP.test(matrix) ? "map/flatMap over both value arrays" : "",
        INLINE_FOR_LOOP.test(matrix) ? "nested for…of over both value arrays" : "",
      ].filter((found) => found !== ""),
      `${MATRIX_FIELD} builds combinations itself.\n` +
        "  A local loop over values1 and values2 is a second implementation " +
        "of expandVariantMatrix, and the two will drift — over a trimmed " +
        "value, a case-folded duplicate, an ordering. Delete the loop and " +
        "call the expander; if the shape it returns is wrong for the UI, " +
        "change what is done WITH the rows, not where they come from.",
    ).toEqual([]);

    for (const symbol of ["VARIANT_MATRIX_MAX", "variantLabelFor"]) {
      expect(
        matrix.includes(symbol),
        `${MATRIX_FIELD} does not reference ${symbol}. The 50-combination ` +
          "bound and the human-readable variant label are both the server's, " +
          "and restating either one here is the same drift the expander " +
          "import exists to prevent.",
      ).toBe(true);
    }
  });

  it("wires each route to its own catalog action", () => {
    const form = codeOf(PRODUCT_FORM);

    for (const action of ["createProduct", "updateProduct"]) {
      expect(
        form.includes(action),
        `${PRODUCT_FORM} does not reference ${action}.\n` +
          "  One component serves both /dashboard/products/new and " +
          "/dashboard/products/[id], and the only difference between them is " +
          "which action the submit handler calls. A create route calling " +
          "updateProduct throws on a missing id, which is loud. An edit route " +
          "calling createProduct quietly makes a SECOND product and leaves " +
          "the first untouched, which is not.",
      ).toBe(true);
    }
  });

  it("keeps the image upload out of a Server Action", () => {
    const gallery = codeOf(GALLERY_FIELD);

    expect(
      gallery.includes("requestProductImageUpload"),
      `${GALLERY_FIELD} does not reference requestProductImageUpload — the ` +
        "presign step. Without it there is no signed grant and nothing to PUT " +
        "to.",
    ).toBe(true);

    expect(
      gallery.includes("/api/upload/finalize"),
      `${GALLERY_FIELD} does not reference /api/upload/finalize.\n` +
        "  The upload is three steps on purpose: presign, a direct browser PUT " +
        "to R2, then finalize. Next 16 caps Server Action bodies at 1 MB, " +
        "which a phone photo routinely exceeds, so routing the bytes through " +
        "an action fails for every real photo while passing for every small " +
        "fixture. Raising serverActions.bodySizeLimit is not the fix — it only " +
        "sends megabytes through metered compute to reach the same bucket.\n" +
        "  The finalize route is also what derives the WebP renditions, so " +
        "without it CAT-02 does not happen at all.",
    ).toBe(true);

    expect(
      /\bfilename\b|\bfile\.name\b/.test(gallery),
      `${GALLERY_FIELD} reads a filename.\n` +
        "  The storage key is composed server-side from the session's tenant " +
        "and a server-minted uuid (T-03-55). A name a browser supplies is the " +
        "one input the caller fully controls, and every path-traversal bug in " +
        "the history of file uploads is the same sentence — 'we appended the " +
        "name the user gave us'. Discard it; do not sanitise it.",
    ).toBe(false);
  });

  it("inlines no user-facing copy anywhere in the products tree", () => {
    const offenders: string[] = [];

    for (const file of productsFiles) {
      codeOf(file)
        .split(/\r?\n/)
        .forEach((text, index) => {
          if (NON_COPY_LINE.test(text)) return;

          for (const match of text.matchAll(QUOTED_PROSE)) {
            const value = match[1] ?? match[2] ?? "";
            if (looksLikeProse(value)) {
              offenders.push(`${file}:${index + 1}: "${value}"`);
            }
          }
        });
    }

    expect(
      offenders,
      "C-14 violation — user-facing copy is written into the products " +
        "pages.\n" +
        "  Every visible string on this surface reads from strings.products, " +
        "which 03-04 landed complete in one pass so that eight plans in this " +
        "phase would not each append a few keys to the same object. Copy " +
        "inlined in a component is copy the later i18n extraction cannot see: " +
        "that object is meant to become the `en` catalogue whole, and a label " +
        "that never entered it stays English forever.\n" +
        "  Add the string to strings.products and read it from there.",
    ).toEqual([]);
  });

  it("offers no delete affordance for a product", () => {
    const offenders: string[] = [];

    for (const file of productsFiles) {
      codeOf(file)
        .split(/\r?\n/)
        .forEach((text, index) => {
          if (TRASH_ICON.test(text)) {
            offenders.push(`${file}:${index + 1}: ${text.trim()}`);
          }
        });
    }

    expect(
      offenders,
      "D-08 violation — a trash/delete affordance appears in the products " +
        "pages.\n" +
        "  A product is referenced by the order lines of every order that ever " +
        "contained it, so deleting one either orphans the merchant's own sales " +
        "history or cascades it away. Neither is recoverable and neither is " +
        "what the merchant meant by 'remove this from my store'.\n" +
        "  Hide instead: setProductActive(false) takes it off the storefront " +
        "and leaves it in the order history. Use an eye-off or archive icon — " +
        "the icon is the promise, and a trash can promises the row is gone.",
    ).toEqual([]);
  });
});
