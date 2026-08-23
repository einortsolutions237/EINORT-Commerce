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
 * Later plans extend this file: `signup` (01-07), `plan` (02-02). Do not
 * pre-populate a namespace before its surface exists.
 *
 * Interpolation: a handful of messages carry a `{token}` placeholder rather
 * than being assembled by concatenation at the call site. Concatenation bakes
 * English word order into the code; a token can be moved by a translator.
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
    /** Renders as "Create your store · EINORT" through the layout template. */
    title: "Create your store",
    heading: "Create your store",
    subline: "Free for 10 days. No card required.",

    emailLabel: "Email address",
    passwordLabel: "Password",
    passwordHelper: "8 characters minimum.",
    slugLabel: "Your store address",

    /** The one primary button on the page. */
    cta: "Create my store",
    /**
     * Shown while the submit is in flight. The button keeps its width so the
     * card does not reflow — 01-UI-SPEC.md § Loading forbids a layout shift
     * here, and there is deliberately no full-page spinner.
     */
    ctaSubmitting: "Creating…",

    /** Slug field, `idle` state — nothing typed yet, no check has run. */
    slugIdle: "Choose your store address.",
    /** Slug field, `checking` state. */
    slugChecking: "Checking…",
    /**
     * Slug field, `available` state. `{host}` is replaced with the full
     * hostname the merchant would get (`maboutique.einort.com`), which is the
     * D-01 familiarity cue — the merchant reads back the actual address rather
     * than a bare "available".
     *
     * Kept as an interpolation token rather than string concatenation at the
     * call site so a later i18n pass can move the token, which languages with
     * different word order need.
     */
    slugAvailable: "{host} is available.",

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
    /** The session lapsed between rendering a form and submitting it. */
    sessionExpired: "Your session expired. Sign in again to continue.",
    /** Below the card, Body role, `--foreground` + underline on the link. */
    loginLink: "Already have a store? Sign in",
  },

  /**
   * `/login` — the returning-merchant sign-in (TEN-04, 02-UI-SPEC.md § `/login`).
   *
   * **Security-relevant copy rule:** `invalidCredentials` is the ONLY
   * failure message for a wrong password and for an email with no matching
   * account. A message that distinguishes the two is an account-enumeration
   * oracle over the merchant base — the same class of leak `01-UI-SPEC.md`
   * D-05 closes on the storefront side. One string, one code path — never a
   * second variant naming which half of the credential pair was the problem.
   */
  login: {
    /** Renders as "Sign in · EINORT" through the layout template. */
    title: "Sign in",
    heading: "Sign in",
    subline: "Manage your store, your products and your orders.",

    emailLabel: "Email address",
    passwordLabel: "Password",

    /** The one primary button on the page. */
    cta: "Sign in",
    /** Shown while the submit is in flight; the button keeps its width. */
    ctaSubmitting: "Signing in…",

    /** Every authentication failure maps to this ONE string. See above. */
    invalidCredentials: "That email or password is incorrect.",
    rateLimited: "Too many sign-in attempts. Try again in a minute.",
    genericError: "Something went wrong. Try again in a moment.",

    /** Below the card, Body role, `--foreground` + underline on the link. */
    signupLink: "Don't have a store yet? Create one",
  },

  /**
   * `/onboarding/create-store` — the recovery route for the one genuinely
   * non-atomic step in the phase.
   *
   * This surface is not in `01-UI-SPEC.md`'s four-route table, so its copy is
   * new rather than transcribed. It reuses the spec's voice: state what
   * happened, then what to do next. It deliberately does NOT reuse
   * `signup.provisioningFailed` — that string ends "sign back in to finish",
   * and the merchant reading this page is already signed in, so repeating it
   * would send them in a circle.
   */
  createStore: {
    title: "Finish creating your store",
    heading: "Finish creating your store",
    notice:
      "Your account was saved, but your store wasn't created. Choose your store address to finish.",
    cta: "Create my store",
    ctaSubmitting: "Creating…",
  },

  /**
   * The two plan surfaces (SUB-01, D-02, D-05, D-06): `/onboarding/plan`, the
   * mandatory selection step built in plan 02-02, and `/dashboard/plan`, the
   * in-trial switcher built in plan 02-05. One namespace, because the tier
   * names, taglines and bullet lists are the same copy on both — a second
   * namespace would be a second place for them to drift.
   *
   * ---------------------------------------------------------------------
   * PRICES ARE NOT COPY. THEY DO NOT LIVE HERE.
   * ---------------------------------------------------------------------
   * Every price renders from `PLANS[tier].monthlyPriceXaf` through
   * `Intl.NumberFormat("fr-CM", { … maximumFractionDigits: 0 })` at the call
   * site. Prices are enforcement inputs; bullets are marketing text. Keeping
   * them apart is what stops a copy revision from silently changing a limit —
   * and it is why there is no formatted price literal anywhere in this
   * namespace. `priceSuffix` is the one exception, and it is a suffix, not a
   * number: it is concatenated beside the formatted output as its own element
   * rather than baked into the `Intl` result.
   *
   * The per-tier bullets are transcribed VERBATIM from 02-UI-SPEC.md § Tier
   * copy (itself a transcription of the v4.0 Master Specification § 4.4
   * reconstruction). Do not shorten, reorder or paraphrase them: the counts
   * (8 / 10 / 8) and the wording are both checked. One bullet from the source
   * list — Starter's "one supported online payment integration" — is
   * deliberately absent, because CLAUDE.md's no-live-PSP constraint makes it a
   * promise the product is committed to not keeping. Every other aspirational
   * bullet is retained precisely because those are deferred-but-planned.
   *
   * There is deliberately no Enterprise tier and no annual price: the plan
   * screen shows exactly three cards, monthly only.
   */
  plan: {
    /** Renders as "Choose your plan · EINORT" through the layout template. */
    title: "Choose your plan",
    heading: "Choose your plan",
    /**
     * Every clause here is load-bearing and true: no payment is captured at
     * signup (D-03), and switching is an active-trial capability (D-06).
     * Do not soften either into a vaguer promise, and do not extend
     * "any time" past the trial.
     */
    subline:
      "Free for 10 days. No card required. You can change your plan any time during your trial.",

    /** Business only (D-04). The badge is the ONLY recommended treatment. */
    recommendedBadge: "Most Popular",
    /** A separate element beside the formatted price, never inside it. */
    priceSuffix: "/month",
    /** Visually hidden, beside the `check` icon on the chosen card. */
    selectedLabel: "Selected",

    /** The one primary button on the page. */
    cta: "Start my 10-day trial",
    ctaSubmitting: "Starting…",

    /**
     * The CTA is disabled until a tier is checked, so this is the belt to that
     * braces — what a merchant reads if a submit arrives with no selection.
     */
    noSelection: "Choose a plan to continue.",
    genericError: "Something went wrong. Try again in a moment.",

    starter: {
      name: "Starter",
      tagline: "For small retailers and first online stores.",
      features: [
        "1 online store on your EINORT address, plus your own domain",
        "3–5 templates with your logo, brand colors and basic sections",
        "Up to 50 products with images, variants, prices and stock",
        "Cart, checkout, orders and customer history",
        "Cash on delivery and WhatsApp orders",
        "Delivery zones with fixed fees",
        "Sales, revenue and product dashboard",
        "Owner account only",
      ],
    },

    business: {
      name: "Business",
      tagline:
        "For growing businesses that need more capacity and control.",
      /** Rendered above the bullets, not as one of them. */
      featuresHeader: "Everything in Starter, plus",
      features: [
        "Up to 250 products",
        "Advanced storefront customization, featured products and promotional banners",
        "Bulk product import, export and editing",
        "Inventory history and low-stock alerts",
        "Advanced order search, filtering and export",
        "Customer search and purchase history",
        "Discount codes and promotional pricing",
        "Sales trends and best-selling product reporting",
        "Up to 3 staff accounts",
        "Priority support",
      ],
    },

    professional: {
      name: "Professional",
      tagline: "For established businesses and larger teams.",
      featuresHeader: "Everything in Business, plus",
      features: [
        "Unlimited products",
        "Advanced theme controls and custom promotional sections",
        "Inventory adjustments and stock movement history",
        "Customer groups, tagging and segmentation",
        "Advanced discount rules and campaigns",
        "Exportable reports and customer analytics",
        "Up to 10 staff accounts",
        "Priority support and assisted onboarding",
      ],
    },

    /**
     * `/dashboard/plan` (D-06) — authored here, consumed by plan 02-05.
     *
     * Nested under `plan` rather than given its own top-level namespace
     * because this surface reuses the tier names, taglines and bullets above
     * verbatim; the only copy that is genuinely its own is the switcher's.
     *
     * `{plan}` is a tier NAME (`plan.business.name`), never the internal
     * `planTier` string — no user-facing copy in this phase may name an
     * internal identifier. `{days}`, `{n}` and `{m}` are integers the server
     * computed; the client never subtracts dates from its own clock.
     */
    dashboard: {
      /** Renders as "Your plan · EINORT" through the layout template. */
      title: "Your plan",
      heading: "Your plan",
      currentPlan: "You're on the {plan} plan.",
      trialDaysLeft: "{days} days left in your trial.",

      switchCta: "Switch to {plan}",
      switchSubmitting: "Switching…",
      /** Rendered inline after revalidation — deliberately not a toast. */
      switchSuccess: "You're now on the {plan} plan.",

      /**
       * The one confirmation this phase needs, and an inline two-step rather
       * than a modal. `{n}` is the target plan's member limit, `{m}` the
       * merchant's current member count.
       */
      downgradeConfirm:
        "Switch to {plan}? {plan} includes {n} team members and you currently have {m}. Remove team members first.",
      memberLimitBlocked:
        "You have {m} team members. {plan} includes {n}. Remove team members before switching.",

      /**
       * OQ-3 is resolved as NO: an expired-trial merchant cannot switch plans
       * in-app. This route renders the state below instead of a switcher.
       */
      expiredHeading: "Your trial has ended.",
      expiredBody:
        "Plan changes aren't available after your trial ends. Contact us to subscribe.",
      expiredCta: "Contact us to subscribe",
    },
  },

  /**
   * The trial countdown and the read-only state (ONB-05, D-08, D-11, D-12).
   *
   * ---------------------------------------------------------------------
   * `contactUrl` IS COPY, NOT CONFIGURATION.
   * ---------------------------------------------------------------------
   * It lives here rather than in `src/env.ts` because it is a single real,
   * monitored WhatsApp number that is the same in development, preview and
   * production, and because the only thing that would ever change it is a
   * copy revision. An env var would add a boot-time failure mode and a
   * deployment step to a string, and would let the contact route differ
   * between environments — which is exactly how a "Contact us" link ends up
   * pointing at nothing in production. There is no other support surface in
   * V1: every contact CTA in the product resolves to this one value.
   *
   * ---------------------------------------------------------------------
   * PLURALIZATION IS TWO STRINGS AND A `=== 1` CHECK.
   * ---------------------------------------------------------------------
   * `daysLeft` and `oneDayLeft` are separate entries, selected by the caller.
   * No `Intl.PluralRules`, no `"day(s)"`. The rule reads as over-simple until
   * the i18n pass, at which point two flat strings are trivially replaced by a
   * plural group while a `"day(s)"` fallback would have to be found and
   * unpicked. There is deliberately no "0 days left" copy: `resolveEntitlements`
   * uses `Math.ceil`, so an active trial with three hours left reports 1, and
   * the state after that is `expired`, which has its own copy below.
   *
   * `{days}` is an integer the SERVER computed. Nothing in the browser
   * subtracts dates from its own clock (T-02-14).
   */
  trial: {
    /** Neutral and urgent share this copy — only the treatment escalates. */
    daysLeft: "{days} days left in your trial.",
    /** Selected when `daysLeft === 1`. Carries no token by design. */
    oneDayLeft: "1 day left in your trial.",
    /** The action link on both active states. */
    changePlan: "Change plan",

    /** D-08. The persistent banner once the trial is over. */
    expiredHeading: "Your trial has ended.",
    expiredBody:
      "You can still see your store and your data, but you can't make changes until you subscribe.",
    expiredCta: "Contact us to subscribe",

    /** Visually hidden, beside the external-link icon on the contact CTA. */
    contactUrlLabel: "(opens WhatsApp)",
    contactUrl: "https://wa.me/237686661578",

    /**
     * SUB-02. What `merchantAction({ mode: "write" })` returns when the trial
     * has expired — rendered as `role="alert"` AT THE CONTROL the merchant
     * used, never as a toast and never as a redirect. It repeats the remedy
     * rather than pointing back at the banner, because the merchant reading it
     * is looking at the control, not at the top of the page.
     */
    readOnlyBlocked:
      "Your trial has ended. Contact us to subscribe before you make changes.",

    /**
     * The `title` / `aria-describedby` text on a disabled write control.
     * Disable, never hide: a hidden control makes the dashboard look broken
     * rather than restricted, and the merchant must always be able to reach
     * the reason by keyboard.
     */
    disabledHint: "Not available while your trial is expired.",
  },

  /**
   * `/dashboard` (D-08, TEN-04) — the merchant's own store, and nothing else
   * in Phase 2.
   *
   * The empty state links to the storefront and to NOTHING ELSE. There is no
   * "Add your first product" here: Phase 3 owns products, and a CTA pointing
   * at a route that does not exist is worse than no CTA at all. Do not add one
   * ahead of the surface it opens.
   *
   * `renameUnsupported` and `deleteUnsupported` are authored here and consumed
   * by plan 02-06's Better Auth organization hooks. They are refusals the
   * merchant may meet without ever seeing a form — the `/api/auth/organization/*`
   * endpoints are reachable directly — so they are phrased as complete
   * sentences rather than as field errors.
   */
  dashboard: {
    /** Renders as "Your store · EINORT" through the layout template. */
    title: "Your store",
    heading: "Your store",
    /** Label role, `--muted-foreground`. `{host}` is the store's address. */
    address: "{host}",
    viewStore: "View my store",
    /** Visually hidden, beside the external-link icon on the store link. */
    viewStoreLabel: "(opens your store)",
    signOut: "Sign out",

    emptyHeading: "Your store is live",
    emptyBody:
      "Your storefront is ready at your address. Open it to see what your customers see.",

    /**
     * D-03: the address is claimed once at signup and held in
     * `StoreSlugHistory`. Phase 4 owns the self-service change; until then the
     * honest answer is that this is not the place, not that it is impossible.
     */
    renameUnsupported: "Your store address can't be changed here.",
    deleteUnsupported:
      "Stores can't be deleted from here. Contact us if you need to close your store.",
  },

  /**
   * Plan-limit refusals (SUB-01) — consumed by plan 02-06.
   *
   * `{n}` is the limit the merchant's CURRENT plan includes, read from
   * `PLANS[tier].limits`. "including you" is not padding: the owner counts
   * against the limit, and a merchant on Starter reading "includes 1 team
   * member" while unable to add anyone would reasonably conclude the product
   * is broken.
   */
  entitlements: {
    memberLimitReached:
      "Your plan includes {n} team members, including you. Choose a larger plan to add more.",
  },

  /**
   * `/suspended` (OQ-5) — the terminal page for a suspended organization.
   *
   * ---------------------------------------------------------------------
   * THIS DOES NOT WEAKEN PHASE 1'S D-05.
   * ---------------------------------------------------------------------
   * D-05 forbids disclosing suspension to an ANONYMOUS visitor, because a
   * visible difference between "suspended" and "never claimed" is an
   * enumeration oracle over the merchant base. That path is untouched:
   * `storeNotFound` above still renders byte-identical copy for unknown,
   * unclaimed and suspended hostnames, and nothing in this namespace may be
   * reused there. This surface is reachable only behind a session whose active
   * organization IS the suspended one — i.e. only by that store's own owner,
   * for whom the information is a necessity rather than a leak.
   */
  suspended: {
    /** Renders as "Your store is unavailable · EINORT" via the template. */
    title: "Your store is unavailable",
    heading: "Your store is unavailable",
    body: "Your store has been suspended and customers can't reach it right now. Contact us to sort this out.",
    cta: "Contact us",
    signOut: "Sign out",
  },
} as const;
