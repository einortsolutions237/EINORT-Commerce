/**
 * Centralized user-facing copy.
 *
 * Phase 1 ships a single hardcoded language (English) — there is deliberately no
 * i18n library, no locale routing and no language switcher in V1 (30-day solo
 * constraint). See `01-01-SUMMARY.md` § "Copy language decision".
 *
 * Strings live here rather than inline in JSX so that a later i18n pass is a
 * clean extraction (this object becomes the `en` message catalogue) instead of a
 * rewrite of every component. Rules:
 *
 *   - One namespace per user-facing surface, named after its route.
 *   - Never inline a user-facing literal in a component; add it here first.
 *   - Copy must satisfy the voice contract in `01-UI-SPEC.md` § Copywriting
 *     Contract: direct, second person, no exclamation marks, no "Oops", no emoji.
 *
 * Later plans extend this file: `signup` (01-07). Do not pre-populate a
 * namespace before its surface exists.
 *
 * Note: this governs UI copy language only. Currency and number formatting stay
 * on the `fr-CM` locale (`Intl.NumberFormat('fr-CM', { currency: 'XAF' })`) per
 * CLAUDE.md — that is a Cameroon formatting convention, independent of copy
 * language.
 */

export const BRAND = "EINORT" as const;

export const strings = {
  /** `/` — root-domain placeholder (D-06). Not a marketing site. */
  root: {
    wordmark: BRAND,
    tagline: "Create your online store in minutes.",
    cta: "Create my store",
  },

  /**
   * The single branded failure surface (D-04). Rendered by
   * `src/app/not-found.tsx` for **every** failure path in the phase: an
   * unrecognized hostname, a well-formed but unclaimed hostname, and a
   * suspended store.
   *
   * D-05 is a copy rule before it is a code rule. Nothing in this namespace may
   * hint at *why* the store is unavailable — no "suspended", no "temporarily
   * unavailable", no "this store has been disabled". A visitor must not be able
   * to tell a suspended store from a hostname nobody ever claimed, because that
   * difference is an enumeration oracle over the merchant base (T-01-29).
   * Adding a second variant of this copy is how that control gets lost.
   */
  storeNotFound: {
    /** Renders as "Store not found · EINORT" through the layout template. */
    title: "Store not found",
    heading: "Store not found",
    body: "No store exists at this address. Check the spelling of the address.",
    link: "Discover EINORT",
  },

  /**
   * The placeholder storefront (`/s/[slug]`). Phase 4 replaces this page
   * wholesale with the real template system — deliberately no catalog, no cart
   * and no onboarding call to action here.
   */
  storefront: {
    heading: "Store coming soon",
    body: "This store hasn't opened yet. Check back soon.",
  },

  /**
   * `/signup` — merchant onboarding (ONB-01, D-02).
   *
   * Only the copy the SERVER returns lives here today: plan 01-06 builds
   * `checkStoreSlug` and `signUpMerchant`, both of which hand a rendered
   * message back to the caller, so these strings have a live surface. Plan
   * 01-07 extends this namespace with the form's own labels, helper text and
   * button states.
   *
   * Two slug states are deliberately ABSENT from this namespace:
   * `SLUG_FORMAT_MESSAGE` and `SLUG_RESERVED_MESSAGE` are owned by
   * `@/server/tenant/host` because the Zod schema raises them and the format
   * message is built by template literal from `SLUG_MIN_LENGTH`/
   * `SLUG_MAX_LENGTH`. Copying them here would let the bounds the merchant
   * reads drift from the bounds the schema enforces — see 01-03-SUMMARY.
   */
  signup: {
    /** Slug field, `taken` state. */
    slugTaken: "That address is taken. Try another name.",
    /**
     * Slug field, "check unavailable" state — rate-limited or a transport
     * failure. The submit button stays ENABLED here: the server is the
     * authority and the client check is UX only, so a merchant must never be
     * blocked from trying by a check that could not run.
     */
    slugCheckUnavailable:
      "Can't check right now. You can continue — we'll verify on submit.",
    /** The TOCTOU window between the live check and submit closing on them. */
    slugRaceLost: "That address was just taken. Choose another.",
    emailTaken: "An account already exists with that email.",
    rateLimited: "Too many attempts. Try again in a minute.",
    /**
     * The honest message for the non-atomic gap: the user row was written and
     * the organization was not. Says so, rather than implying nothing happened
     * and inviting a retry that will fail on the duplicate email. Plan 01-07
     * owns the `/onboarding/create-store` route this points them toward.
     */
    provisioningFailed:
      "Store creation failed. Your account was saved — sign back in to finish.",
    genericError: "Something went wrong. Try again in a moment.",
  },
} as const;
