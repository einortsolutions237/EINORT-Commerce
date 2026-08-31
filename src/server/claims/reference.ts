/**
 * ORD-04's uniqueness key, derived. One function, no I/O (RESEARCH.md Pattern 10).
 *
 * ---------------------------------------------------------------------------
 * THIS FILE IMPORTS NOTHING. THAT IS THE POINT, NOT AN OVERSIGHT.
 * ---------------------------------------------------------------------------
 * This lives beside `queries.ts` rather than inside it because it is the one
 * piece of the claim domain that is pure arithmetic over a string, and the
 * database-free `unit` Vitest project can only load a module that pulls nothing
 * behind it. `tests/unit/claim-reference.test.ts` is what decides whether
 * ORD-04's unique index constrains payments or merely strings, so it has to be
 * able to run in the fast gate after every commit rather than behind a Neon
 * branch.
 *
 * It also carries none of the server-boundary marker that every sibling in this
 * directory opens with, deliberately. That marker would be a promise this
 * module has no secret to keep — it holds no database client, reads no env, and
 * the customer-facing claim form (plan 03-15) legitimately wants this same
 * derivation client-side to warn about a duplicate before a round trip. The
 * enforcement half of ORD-04 is the database index, never this function, so
 * making it reachable from a browser bundle gives away nothing.
 */

/**
 * Reduce a typed transaction reference to the value ORD-04 compares.
 *
 * Operators format references inconsistently across the SMS receipt, the MoMo
 * app and the USSD confirmation, and customers retype them by hand. Comparing
 * raw strings would let `MP240823.1234.A56789`, `mp240823 1234 a56789` and
 * `MP-240823-1234-A56789` all coexist as distinct "unique" references — three
 * spellings of ONE payment, each passing the constraint — which defeats the
 * point of ORD-04 entirely.
 *
 * Uppercase FIRST, then strip: doing it the other way round would drop every
 * lowercase character on the floor, because the character class below is
 * uppercase-only. That ordering is why the class can stay `A-Z0-9` rather than
 * growing a case-insensitive flag whose absence would be silent.
 *
 * The class is an ALLOWLIST, not a punctuation denylist. A denylist would have
 * to enumerate the Unicode dashes, quotes and spaces a phone keyboard emits,
 * and would let through whichever one nobody thought of; keeping only `A-Z0-9`
 * cannot have that gap. It also means non-Latin scripts vanish rather than
 * surviving as an unmatched key — a Cyrillic homoglyph of `MP` is not the
 * reference the merchant is holding, and treating it as one would be worse than
 * dropping it.
 *
 * Returns `""` when nothing survives, and the caller MUST refuse that rather
 * than store it: a blank normalised reference would claim the tenant's one
 * empty-string slot under `@@unique([tenantId, referenceNormalized])` and block
 * every later claim that also normalised to nothing.
 */
export function normalizeReference(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
