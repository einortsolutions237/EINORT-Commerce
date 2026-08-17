import { z } from "zod";

import {
  SLUG_FORMAT_MESSAGE,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_PATTERN,
  SLUG_RESERVED_MESSAGE,
} from "./host";
import { RESERVED_SLUGS } from "./reserved-slugs";

/**
 * Store-slug validation — layer 1 of the three-layer TEN-06 defence.
 *
 * This is the merchant-facing layer: it powers the inline D-02 availability
 * feedback on the signup form and the submit-time parse. It is explicitly NOT
 * authoritative — the gate that actually cannot be bypassed is the Better Auth
 * `beforeCreateOrganization` hook in plan 01-06, which validates against this
 * same schema and the same `RESERVED_SLUGS` set.
 *
 * Normalization runs first (`trim` → `toLowerCase`), so every rule below sees
 * the value that will actually be stored and every rule below is therefore
 * testing the thing that ends up in DNS. `"  MaBoutique  "` and `"maboutique"`
 * are the same store address, and a schema that disagrees produces a merchant
 * who cannot understand why their own name is rejected.
 *
 * Messages are part of the contract, not cosmetics. Plan 01-07's
 * `checkStoreSlug` maps an issue to the `reserved` UI state by looking for the
 * word "reserved" in the message and falls back to `invalid` otherwise.
 *
 * Zod 4, not 3 (CLAUDE.md C-9): the error-map API and inference internals
 * changed, so v3 snippets are not safe to paste here.
 */
export const storeSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(SLUG_MIN_LENGTH, SLUG_FORMAT_MESSAGE)
  .max(SLUG_MAX_LENGTH, SLUG_FORMAT_MESSAGE)
  // One regex, three rules: the lowercase-alphanumeric character set, single
  // interior hyphens only, and no leading or trailing hyphen.
  .regex(SLUG_PATTERN, SLUG_FORMAT_MESSAGE)
  // Punycode homograph impersonation. Mostly redundant with the `--` rule the
  // regex already enforces, kept explicit because the *reason* matters: an
  // `xn--` label renders as a non-ASCII string that can be visually identical
  // to a real store's address.
  .refine((slug) => !slug.startsWith("xn--"), SLUG_FORMAT_MESSAGE)
  // An all-numeric label is legal DNS but reads as an ID, invites enumeration,
  // and collides with any future numeric-route scheme.
  .refine((slug) => !/^\d+$/.test(slug), "Cannot be all numbers")
  .refine((slug) => !RESERVED_SLUGS.has(slug), SLUG_RESERVED_MESSAGE);

export type StoreSlug = z.infer<typeof storeSlugSchema>;

/**
 * The display name a store gets from its address.
 *
 * D-01 is explicit that the merchant types exactly one thing — their address —
 * so there is no store-name field to ask. `alpha-store` becomes "Alpha Store",
 * which is what the storefront renders until Phase 4 gives the merchant a real
 * branding surface.
 *
 * Lives here, beside the schema, because both the signup form and the recovery
 * action derive it and the two must agree. `storeSlugSchema` guarantees at
 * least `SLUG_MIN_LENGTH` (3) characters, so the result always clears the
 * 2-character floor the signup schema enforces on the name.
 */
export function storeNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
