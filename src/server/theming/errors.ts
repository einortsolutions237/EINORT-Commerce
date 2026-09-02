import "server-only";

/**
 * The theming domain's one refusal, as a type rather than a string.
 *
 * ---------------------------------------------------------------------------
 * THIS IS A WRITE-PATH ERROR. THE PUBLIC READ PATH NEVER THROWS IT.
 * ---------------------------------------------------------------------------
 * EDIT-01 / ONB-04. `src/server/theming/queries.ts` reads the same two rows and
 * treats their absence as an ordinary, expected state — a pre-Phase-4
 * organization, or the millisecond between an organization existing and its
 * seed landing — which it degrades to `flagshipDefaultDocument()` /
 * `flagshipDefaultTokens()` with a log. That asymmetry is deliberate and is
 * described in full in that file's header; the short version is that a
 * customer looking at a white page is strictly worse than a customer looking at
 * default copy, so nothing on the anonymous storefront render path may throw.
 *
 * On a WRITE, the same absence means something entirely different: the caller
 * reached `saveDraft`, `publishStorefront` or `discardDraft` without ever
 * running `ensureStorefrontSeeded()` (or `saveBranding`, which seeds as part of
 * ONB-04). That is a bug in the calling surface, not a state to paper over —
 * silently seeding here would let an editor route ship with its seed call
 * missing and nobody would notice until a merchant's first publish wrote a
 * document they never authored.
 *
 * `tenantId` is carried as a field rather than only inside the message, in the
 * same spirit as `OutOfStockError.variantId` and
 * `InvalidTransitionError.from/to`: a caller that wants to branch — retry the
 * seed and re-dispatch, say — must not have to parse an error string to learn
 * which tenant was involved.
 *
 * `override readonly name` rather than a constructor assignment. That is the
 * canonical form for a NEW file per CLAUDE.md § Naming Patterns, and it is what
 * `src/server/orders/errors.ts` uses on all four of its classes.
 * `src/server/entitlements/assert.ts` assigns in the constructor instead, and
 * that variant is matched only when editing that file — a transpiled subclass
 * reports `name: "Error"` unless one of the two is present, and the name is
 * what a Vercel log line actually shows.
 */
export class StorefrontNotSeededError extends Error {
  override readonly name = "StorefrontNotSeededError";
  /** The organization whose theme or page row is missing. */
  readonly tenantId: string;

  constructor(tenantId: string) {
    super(
      `Tenant ${tenantId} has no storefront theme or page row. ` +
        `Call ensureStorefrontSeeded() before writing.`,
    );
    this.tenantId = tenantId;
  }
}
