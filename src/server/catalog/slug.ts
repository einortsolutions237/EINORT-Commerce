/**
 * The product slug — `Product.slug`, unique per tenant (`@@unique([tenantId, slug])`).
 *
 * ---------------------------------------------------------------------------
 * PURE. NO I/O, NO `server-only`, NO DATABASE.
 * ---------------------------------------------------------------------------
 * The marker is absent on purpose, not by oversight: 03-11's product form
 * previews the storefront URL as the merchant types the name, so this function
 * runs in the browser too. Adding `import "server-only"` would fail that build,
 * and duplicating the rule in a client-side copy is how the preview and the
 * stored slug start disagreeing.
 *
 * ---------------------------------------------------------------------------
 * THE SAME CHARACTER RULES AS THE STORE SLUG, A DIFFERENT SCOPE.
 * ---------------------------------------------------------------------------
 * `src/server/tenant/slug.ts` governs the STORE address: globally unique, DNS
 * label, reserved-word checked, and merchant-typed — so it is a Zod schema that
 * REJECTS. This one governs a product path segment: unique only within one
 * merchant's catalogue, derived from a name the merchant typed for humans, and
 * therefore a transform that NORMALISES rather than refuses. A merchant who
 * names a product `Robe Wax — Édition Limitée!` must not be told their own
 * product name is invalid.
 *
 * Character set is identical (`[a-z0-9]` plus single interior hyphens, no
 * leading or trailing hyphen) so a product URL and a store URL never disagree
 * about what a legal path segment looks like.
 */

/**
 * The stored length ceiling.
 *
 * Not a database constraint — `Product.slug` is an unbounded `String` — but a
 * URL-readability one. 60 characters is roughly a full product name and well
 * inside every practical URL limit; past that the tail carries no information a
 * customer reads.
 */
const SLUG_MAX_LENGTH = 60;

/**
 * A product name reduced to a URL-safe slug.
 *
 * `Robe Wax  Édition -- Limitée!` becomes `robe-wax-edition-limitee`.
 *
 * The NFD normalisation is the step that is easy to omit and expensive to omit:
 * without it, a naive `[^a-z0-9]` filter turns `Édition` into `dition` rather
 * than `edition`, because the accented character is a single code point that
 * matches nothing in the allowed set. Decomposing first splits it into a base
 * letter plus a combining mark, and the mark is what gets stripped. This market
 * writes French; accented product names are the common case, not the edge one.
 *
 * ---------------------------------------------------------------------------
 * RETURNING `""` IS A CONTRACT, NOT A FAILURE.
 * ---------------------------------------------------------------------------
 * A name made entirely of characters this function strips — `"   "`, `"!!!"`,
 * a name written in a script with no ASCII decomposition — slugifies to
 * nothing, and there is no honest slug to return. This function does NOT invent
 * one: generating a random suffix here would make it impure, untestable by
 * equality, and would put a second source of randomness beside the retry the
 * caller already needs for the `P2002` unique-collision case.
 *
 * `createProduct` owns that fallback: an empty result means "append a fresh
 * short suffix", which is the same code path a slug collision takes. One
 * fallback, one place, one behaviour to reason about.
 */
export function slugifyProductName(raw: string): string {
  const slug = raw
    .normalize("NFD")
    // The Unicode combining-marks block, left over from the decomposition
    // above. Stripping it is what turns `e` + U+0301 into `e`.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Every run of disallowed characters collapses to ONE hyphen, so
    // `Wax  --  Édition` cannot produce `wax----edition`.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length <= SLUG_MAX_LENGTH) return slug;

  // Truncating can land mid-word and leave a trailing hyphen, which would be a
  // slug the store-slug rules would reject. Trim again after the cut rather
  // than before it.
  return slug.slice(0, SLUG_MAX_LENGTH).replace(/-+$/g, "");
}
