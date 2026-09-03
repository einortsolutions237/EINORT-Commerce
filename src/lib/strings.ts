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

    /**
     * Phase 4, 04-UI-SPEC.md § Copywriting Contract → Core contract. The
     * flagship product-grid section with zero active products.
     *
     * It lives HERE and not in `flagship` on purpose: `/preview` *is* the
     * storefront, so the merchant editing their store sees exactly the copy a
     * shopper would, and there must be exactly one sentence to keep in step.
     * Shopper-voiced — "this shop", never "your store".
     *
     * The merchant-facing nudge ("Add your first product…") belongs in the
     * editor's settings panel for that section, never in the rendered page.
     */
    emptyHeading: "Nothing here yet",
    emptyBody: "This shop hasn't added any products yet. Check back soon.",
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

    /**
     * 03-UI-SPEC.md § A. Navigation Shell — the rail destinations, in the
     * order the rail renders them.
     *
     * Every label in `src/components/app-sidebar.tsx` is read from here and
     * `tests/unit/dashboard-nav.test.ts` fails if a visible string is inlined
     * there instead. Nested under `dashboard` rather than given a top-level
     * namespace because the rail is a property of this surface, not a surface
     * of its own — it has no page, no heading and no empty state.
     *
     * `openNavigation` is the accessible name on the header trigger that opens
     * the off-canvas sheet below `lg`. The registry's `SidebarTrigger` ships its
     * own hardcoded "Toggle Sidebar" sr-only label; the rail passes this instead
     * so the one string a screen-reader user hears is copy like every other.
     */
    nav: {
      overview: "Overview",
      products: "Products",
      /**
       * Phase 4, 04-UI-SPEC.md § Storefront Editor → Navigation. The label
       * exists here BEFORE the rail item does, because this file is authored in
       * one pass at the start of the phase and every later plan only reads it.
       *
       * The rail entry itself — the `NAV_ITEMS` row in
       * `src/components/app-sidebar.tsx` and the matching href in
       * `REQUIRED_HREFS` — is a single paired edit owned by plan 04-15 and must
       * land in one commit: adding either half alone fails
       * `tests/unit/dashboard-nav.test.ts`. Adding a label is neither half.
       *
       * No badge. The gold budget is fully spent (claims), and this destination
       * is not a queue.
       */
      storefrontEditor: "Storefront",
      orders: "Orders",
      claims: "Payment claims",
      plan: "Plan",
      paymentSettings: "Payment settings",
      openNavigation: "Open navigation",
    },

    /**
     * Quick task 260903-ugl. VISUAL PLACEHOLDER ONLY, per CONTEXT.md's
     * locked decision #3: no search Server Action or query is wired to this
     * copy anywhere in the codebase. Real cross-entity search across
     * products/orders/customers is a deliberately separate future task —
     * these strings existing is not a sign the feature is live.
     *
     * `searchShortcutHint` in particular is decorative only; no keydown
     * listener is registered anywhere in this task.
     */
    topbar: {
      searchPlaceholder: "Search",
      searchAriaLabel: "Search",
      searchShortcutHint: "⌘K",
    },

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

    /**
     * SUB-01, Phase 3. `{cap}` is `PLANS[tier].limits.products`, read on the
     * server and rendered by the caller — the same placeholder convention
     * `memberLimitReached` uses, and for the same reason: the limit a merchant
     * reads must come from the registry that enforces it, never from a number
     * typed into copy.
     *
     * The products list disables `Add product` when the cap is reached; that is
     * a courtesy, and this string is what the SERVER returns when the action is
     * called anyway. 03-UI-SPEC.md § Copywriting Contract fixes the wording.
     */
    productLimitReached:
      "You've reached your plan's {cap}-product limit. Upgrade your plan to add more.",
  },

  /* =======================================================================
   * PHASE 3 — the product catalog, the order lifecycle and the payment claim.
   * =======================================================================
   * Everything from here to `suspended` is transcribed from 03-UI-SPEC.md,
   * landed in ONE pass by plan 03-04 before any Phase-3 page is written. Later
   * plans in this phase READ these namespaces; none of them appends to this
   * file. That is deliberate: eight plans each adding a few keys to the same
   * object is eight merge conflicts and eight chances for the same sentence to
   * be written twice, slightly differently.
   *
   * The copywriting contract in 03-UI-SPEC.md is absolute and every string
   * below was checked against it: English, second person, no exclamation marks,
   * no emoji. Never the hard-removal verb for a product (D-08 — products are
   * hidden, never removed), never the confirmed-number adjective for a payment
   * number (D-17 — there is no verification step, so no copy may imply one),
   * and never "Payment received"
   * before a merchant confirms (ORD-02), and never an internal identifier — no
   * enum member, no module name, no route shape. Dashboard copy says "your
   * store"; storefront copy says "the seller".
   */

  /**
   * 03-UI-SPEC.md §§ A1, A2 — the products list and the create/edit form.
   *
   * `{n}`, `{cap}`, `{name}` and `{value}` are all replaced at the call site.
   * There is no delete copy in this namespace and there must never be one: a
   * product is referenced by every order line that ever contained it, so the
   * only safe "remove it from my store" is `Hide`, which is what the merchant
   * actually means. The hide dialog is deliberately NOT worded or styled as a
   * destructive confirmation — calling a reversible action red teaches
   * merchants to fear a safe one.
   */
  products: {
    /** Renders as "Products · EINORT" through the layout template. */
    title: "Products",
    heading: "Products",

    /** A1's meter. The first is used when the plan caps products, the second
     * when `PLANS[tier].limits.products` is `null`. */
    meterWithCap: "{n} of {cap} products",
    meterNoCap: "{n} products",

    /** The one primary button on the list page, and the one on the form. */
    addCta: "Add product",
    saveCta: "Save product",
    /** Named for what it does — the form holds unsaved edits. */
    discardCta: "Discard changes",
    saveSubmitting: "Saving…",

    detailsCardTitle: "Product details",
    imagesCardTitle: "Images",
    optionsCardTitle: "Options and stock",
    visibilityCardTitle: "Visibility",

    nameLabel: "Name",
    descriptionLabel: "Description",
    categoryLabel: "Category",
    /** D-06 categories are free-form, so creating one cannot need a page. */
    newCategoryOption: "New category",
    newCategoryLabel: "New category name",
    priceLabel: "Price",
    /** A suffix adornment beside the input, not part of a formatted number. */
    priceSuffix: "FCFA",
    priceHelper: "Whole francs. No decimals.",

    imagesAddCta: "Add images",
    imagesHelper:
      "Up to 5 photos. The first one is what customers see in your store.",
    imagesCounter: "{n} of 5",
    imagesFull:
      "You've added the maximum of 5 photos. Remove one to add another.",
    imagePrimaryBadge: "Main photo",
    imageMakePrimary: "Make main photo",
    imageRemove: "Remove photo",
    imageUploadFailed: "Upload failed. Tap to try again.",

    stockLabel: "Stock",
    stockHelper: "How many you have to sell.",
    addOptionCta: "Add an option",
    optionNameLabel: "Option name",
    optionValuesLabel: "Option values",
    /** D-05 caps the axes at two; these are placeholders, never labels. */
    optionOnePlaceholder: "Size",
    optionTwoPlaceholder: "Color",

    variantColumnVariant: "Variant",
    variantColumnPrice: "Price",
    variantColumnStock: "Stock",
    variantColumnSku: "SKU",
    variantColumnActive: "Active",
    variantPriceHelper: "Leave blank to use the product price",
    variantLimitExceeded:
      "That's {n} variants — more than the 50 this form can handle. Use fewer option values.",
    /** A warning, never a block: the merchant may genuinely mean it. */
    optionValueRemovalWarning:
      "Removing '{value}' will remove {n} variants and their stock counts.",

    visibleLabel: "Visible in your store",
    visibleHelper:
      "Hidden products stay in your records and on past orders — customers just can't see or order them.",

    columnProduct: "Product",
    columnPrice: "Price",
    columnStock: "Stock",
    columnStatus: "Status",
    columnActions: "Actions",

    statusActive: "Active",
    statusHidden: "Hidden",

    rowEdit: "Edit",
    rowDeactivate: "Deactivate",
    rowReactivate: "Reactivate",

    /** A1's stock cell. Zero is destructive text, 1–5 is muted. */
    stockOut: "Out of stock",
    stockLow: "{n} left",

    deactivateTitle: "Hide this product?",
    deactivateBody:
      "Customers won't see {name} in your store and can't order it. Your past orders keep their record of it. You can bring it back any time.",
    deactivateConfirm: "Hide product",
    deactivateCancel: "Keep it visible",

    emptyHeading: "No products yet",
    emptyBody: "Add your first product so customers have something to buy.",
    emptyCta: "Add product",

    /** A stay-on-list confirmation after a redirect; a toast is correct here. */
    savedToast: "Product saved",
  },

  /**
   * 03-UI-SPEC.md §§ A3, A4 and § A. Order-State Display Contract — the orders
   * list and the order detail page.
   *
   * The six `state*` keys are the MERCHANT chip labels and the only place an
   * order state is ever named for a merchant. They are keyed in camelCase
   * rather than by the enum member so no internal identifier is spelled in this
   * file; the component owns the `Record<OrderState, …>` that maps one to the
   * other.
   *
   * D-02 is why `channel*` exists beside them: a WhatsApp or cash-on-delivery
   * order only ever moves New order → Confirmed → Fulfilled, so the channel
   * chip is what makes a two-state row legible next to a six-state transfer
   * row. The pair is always rendered together.
   *
   * The three `actor*` keys are ORD-05's audit trail. An event is attributed to
   * `You`, to the customer by name, or to `Automatic` — never to the raw actor
   * value, which is an internal identifier and means nothing to a merchant.
   */
  orders: {
    /** Renders as "Orders · EINORT" through the layout template. */
    title: "Orders",
    heading: "Orders",

    /** Accessible name for the filter-chip row's `<nav>`. */
    filterNavLabel: "Filter orders",

    filterAll: "All",
    /** New orders and claimed payments — the default landing filter. */
    filterNeedsAttention: "Needs attention",
    filterAwaitingPayment: "Awaiting payment",
    filterConfirmed: "Confirmed",
    filterFulfilled: "Fulfilled",
    filterDisputed: "Disputed",

    stateOrderPlaced: "New order",
    statePaymentPending: "Awaiting payment",
    statePaymentClaimed: "Payment claimed",
    stateConfirmed: "Confirmed",
    stateDisputed: "Disputed",
    stateFulfilled: "Fulfilled",

    /** lucide ships no WhatsApp glyph — the word carries it. */
    channelWhatsapp: "WhatsApp",
    channelCashOnDelivery: "Cash on delivery",
    channelManualTransfer: "Mobile Money",
    operatorMtn: "MTN",
    operatorOrange: "Orange",

    columnOrder: "Order",
    columnCustomer: "Customer",
    columnChannel: "Channel",
    columnTotal: "Total",
    columnStatus: "Status",
    columnAction: "Action",

    /** D-02's one-tap confirm, inline in the row. No dialog. */
    confirmOrder: "Confirm order",
    reviewClaim: "Review claim",
    markFulfilled: "Mark as fulfilled",
    confirmedToast: "Order {n} confirmed",

    itemsCardTitle: "Items",
    /** "{price} × {qty}" beneath each item's name in the A4 Items card. */
    itemUnitTimesQuantity: "{price} × {qty}",
    subtotal: "Subtotal",
    total: "Total",
    customerCardTitle: "Customer",
    /** Only rendered when `Order.deliveryAddress` is non-null (D-01). */
    addressLabel: "Delivery address",
    /** Only rendered when `Order.customerNote` is non-null. */
    noteLabel: "Note",
    channelCardTitle: "Channel",

    /**
     * Screen-reader-only name for the row's chevron-right link, added on TASK
     * 3 for the same reason `staleAction` was added on Task 2: the field
     * carries a `{n}` token for the order number so a screen reader user
     * navigating by link text hears which order each row's link opens,
     * rather than six identical "View order" announcements in a row.
     */
    viewOrder: "View order {n}",

    historyCardTitle: "Order history",
    actorMerchant: "You",
    actorSystem: "Automatic",
    /** The first event of every order, which has no previous state. */
    genesisEvent: "Order placed",

    /** The catch-all when a refusal is not `staleAction` and not the D-08
     * read-only block (which already carries its own message). */
    genericError: "Something went wrong. Try again in a moment.",

    /**
     * The refusal a merchant reads when the order moved underneath them.
     *
     * ADDED BY PLAN 03-10, and the one exception to the "03-04 lands this file
     * whole" rule stated at the top of the Phase 3 block — noted here rather
     * than left to be discovered.
     *
     * `confirmOrder` and `markFulfilled` catch `InvalidTransitionError` and
     * return it as a form-level failure. The realistic cause is not an attack
     * but a second dashboard tab, or two staff on one shop: the order already
     * left the state the button was rendered for. "Something went wrong. Try
     * again in a moment." — the generic used elsewhere in this file — would be
     * actively wrong copy for that, because trying again cannot help and the
     * merchant would keep tapping. This says what happened and what to do.
     */
    staleAction:
      "This order has already moved on. Refresh the page to see where it is now.",

    emptyHeading: "No orders yet",
    emptyBody:
      "Orders show up here the moment a customer checks out — through WhatsApp, Mobile Money, or cash on delivery.",
    filteredEmptyHeading: "No matching orders",
    filteredEmptyBody: "No orders match this filter.",
    filteredEmptyCta: "Show all orders",
  },

  /**
   * 03-UI-SPEC.md § A5 — the payment-claims queue (ORD-03 / ORD-04 / D-11).
   *
   * Nothing here may say a payment was received. A claim is a customer's
   * assertion; only the merchant's confirmation makes it a fact (ORD-02), and
   * copy that blurs the two would have this platform guaranteeing a transfer it
   * has no way to see.
   *
   * `rejectDialogBody` is load-bearing rather than decorative: D-11 makes the
   * reason REQUIRED because the customer reads it and can send a corrected
   * claim from it. The three canned reasons cover the cases a merchant actually
   * meets; `Something else` reveals a free-text field.
   */
  claims: {
    /** Renders as "Payment claims · EINORT" through the layout template. */
    title: "Payment claims",
    heading: "Payment claims",
    subline: "{n} awaiting review",
    /** The subline when the queue is empty but the page is not. */
    sublineEmpty: "Nothing waiting",

    /** Shown beneath the claimed amount when it differs from the order total. */
    amountMismatch: "Order total is {total}.",
    noScreenshot: "No screenshot",
    screenshotAlt: "Payment screenshot for order {n}",
    viewScreenshot: "View screenshot",
    closeScreenshot: "Close",
    copyReference: "Copy reference",
    copiedReference: "Copied",
    /** ORD-04. Inline, and it does NOT disable the buttons — the merchant is
     * the judge of their own duplicate. */
    duplicateReference: "This reference was already submitted on order {n}.",

    operatorMtn: "MTN Mobile Money",
    operatorOrange: "Orange Money",

    confirmCta: "Confirm payment",
    rejectCta: "Reject",

    mismatchDialogBody:
      "The customer claimed {claimed} but the order total is {total}. Confirm anyway?",
    mismatchDialogConfirm: "Confirm payment",
    mismatchDialogCancel: "Go back",

    rejectDialogTitle: "Why are you rejecting this?",
    rejectDialogBody: "The customer sees this, and can send a corrected claim.",
    rejectReasonAmount: "Amount doesn't match",
    rejectReasonReference: "Reference not found",
    rejectReasonNotReceived: "Payment not received",
    rejectReasonOther: "Something else",
    rejectReasonOtherLabel: "Tell the customer why",

    rejectDialogConfirm: "Reject claim",
    rejectDialogCancel: "Go back",

    confirmedToast: "Payment confirmed for order {n}",
    rejectedToast: "Claim rejected — the customer can send a corrected one.",

    /**
     * The two refusals a claim review can produce, ADDED BY PLAN 03-13 — the
     * second exception to the "03-04 lands this file whole" rule stated at the
     * top of the Phase 3 block, after `orders.staleAction`. Noted here rather
     * than left to be discovered.
     *
     * There is deliberately no third key for the state machine's refusal.
     * `confirmClaim` and `rejectClaim` catch `InvalidTransitionError` and reuse
     * `strings.orders.staleAction`, because it is the SAME event described from
     * the same merchant's point of view — the order moved underneath them in
     * another tab — and this file's own header forbids writing one sentence
     * twice, slightly differently.
     */

    /**
     * ORD-02's optimistic lock, surfaced. The realistic cause is two dashboard
     * tabs or two staff on one shop, not an attack, so the copy says what
     * happened rather than apologising. "Refresh" is the only useful next step:
     * unlike a stale order the decision is already made and re-tapping cannot
     * change it.
     */
    alreadyReviewed:
      "This claim has already been reviewed. Refresh the page to see the decision.",

    /**
     * D-04 / RESEARCH.md A6. Reopening a rejected claim re-holds the stock that
     * the rejection put back on sale, and between those two moments the units
     * can genuinely have sold to somebody else. `{name}` is the order line's
     * snapshotted product name, so the merchant reads the item they are looking
     * at rather than a variant id. The order stays DISPUTED — saying so is the
     * point, because the alternative the merchant must not imagine is that the
     * claim reopened and the stock quietly went negative.
     */
    reopenOutOfStock:
      "{name} has sold out since this claim was rejected, so it can't be reopened. The order stays disputed.",

    emptyHeading: "No claims to review",
    emptyBody:
      "When a customer says they've paid by Mobile Money, their claim shows up here for you to check.",

    /**
     * D-13's second channel. The in-app badge is the reliable one — this send
     * is fired from `after()` and is allowed to fail — so the email says only
     * what a notification needs to say and sends the merchant to the queue to
     * do the actual work. `{order}` is the order number, never an internal id.
     */
    email: {
      subject: "New payment claim on order {order}",
      heading: "A customer says they've paid",
      body: "{customer} submitted a claim of {amount} against order {order}. Open your payment claims to check the reference and confirm or reject it.",
      cta: "Review the claim",
    },
  },

  /**
   * 03-UI-SPEC.md § A6 — payment settings (D-14 / D-16 / D-17).
   *
   * D-17 IS A COPY RULE BEFORE IT IS A CODE RULE. There is no verification step
   * on a payment number: no code, no pending state, no badge, and therefore no
   * string in this namespace that could imply one. Saved is live. A merchant
   * who reads a confirmation badge here would reasonably believe this platform
   * checked the number with the operator, which it cannot do.
   *
   * The prefix warnings never block, because Cameroon has number portability
   * and an MTN prefix on an Orange line is an ordinary fact, not an error.
   */
  paymentSettings: {
    /** Renders as "Payment settings · EINORT" through the layout template. */
    title: "Payment settings",
    heading: "Payment settings",

    whatsappCardTitle: "WhatsApp orders",
    whatsappNumberLabel: "WhatsApp number",
    whatsappHelper:
      "Customers' orders arrive as a WhatsApp message to this number.",

    mtnCardTitle: "MTN Mobile Money",
    mtnNumberLabel: "Receiving number",
    mtnMerchantCodeLabel: "Merchant code",
    mtnHelper:
      "Only if you're registered for MTN MoMoPay. With a merchant code, customers can tap once to dial the exact amount.",

    orangeCardTitle: "Orange Money",
    orangeNumberLabel: "Receiving number",
    orangeMerchantCodeLabel: "Merchant code",
    orangeHelper:
      "Only if Orange gave you a merchant code. It'll show in your payment instructions.",

    codCardTitle: "Cash on delivery",
    codLabel: "Accept cash on delivery",
    codHelper: "Let customers pay the courier when their order arrives.",

    /** A fixed, non-editable adornment — the merchant types 9 digits. */
    phonePrefix: "+237",

    /** Destructive, because a store nobody can check out of is broken. */
    nothingConfigured:
      "No payment method is set up yet. Customers can't check out until you add at least one.",

    prefixWarningOrange:
      "That prefix is usually an Orange number. Save it anyway if it's correct.",
    prefixWarningMtn:
      "That prefix is usually an MTN number. Save it anyway if it's correct.",

    numberFormatError: "Enter a 9-digit Cameroon mobile number starting with 6.",
    merchantCodeFormatError: "An MTN merchant code is exactly 6 digits.",

    saveCta: "Save payment settings",
    saveSubmitting: "Saving…",
    /** Stay-on-page save, so a toast is the correct success signal. */
    savedToast: "Payment settings saved",
  },

  /**
   * 03-UI-SPEC.md §§ B1, B2 — the storefront catalog and product page.
   *
   * Storefront voice: this addresses the SHOPPER and calls the merchant "the
   * seller", never "your store". D-09 is why `outOfStock` is a chip label
   * rather than a reason the tile is missing — an out-of-stock product stays in
   * the grid, stays linkable and stays shareable.
   */
  catalog: {
    /** The first category chip, rendered only when there are two or more. */
    allCategories: "All",
    outOfStock: "Out of stock",
    inStock: "In stock",
    lowStock: "Only {n} left",
    /** Disabled and relabelled `outOfStock` when the variant has none. */
    addToCart: "Add to cart",
    /** The CTA label until every declared option axis has a selection. */
    chooseAnOption: "Choose an option",
    backToProducts: "All products",
    addedToast: "Added to your cart",
    addedToastAction: "View cart",
  },

  /**
   * 03-UI-SPEC.md § B3 — the cart.
   *
   * There is no shipping line and no tax line, and no string here for one. V1
   * has neither, and a `0 FCFA` shipping row invents a promise the seller never
   * made. The two stock notes are informational and never block checkout — the
   * server re-derives both price and stock at placement regardless.
   */
  cart: {
    /** Renders as "Your cart · EINORT" through the layout template. */
    title: "Your cart",
    heading: "Your cart",
    subtotal: "Subtotal",
    total: "Total",
    checkoutCta: "Checkout",
    quantityReduced: "Only {n} left — we've updated your quantity.",
    itemUnavailable: "{name} is no longer available and has been removed.",
    emptyHeading: "Your cart is empty",
    emptyBody: "Add something you like and it'll show up here.",
    emptyCta: "Browse products",
  },

  /**
   * 03-UI-SPEC.md § B4 — checkout (CHK-02 / D-16).
   *
   * The three payment paths are radio cards, and a path the seller has not
   * configured is NOT RENDERED — not rendered and disabled. A shopper must
   * never be shown a way to pay this seller cannot accept.
   *
   * The submit label changes with the selected path because the three do
   * genuinely different things: one hands off to WhatsApp, one continues to
   * payment instructions, one places the order outright. A single "Continue"
   * would hide that difference at the exact moment it matters.
   *
   * D-12: `tracking*` is shown on-screen immediately after placement on every
   * path. The link is the only way back to the order, so the copy says so.
   */
  checkout: {
    /** Renders as "Checkout · EINORT" through the layout template. */
    title: "Checkout",

    detailsHeading: "Your details",
    paymentHeading: "How you'll pay",
    summaryHeading: "Order summary",

    nameLabel: "Name",
    phoneLabel: "Phone",
    phonePrefix: "+237",
    phoneHelper: "We'll send your order link here on WhatsApp.",
    /** Required only once cash on delivery is the selected path. */
    addressLabel: "Delivery address",
    noteLabel: "Note for the seller",

    whatsappTitle: "Order on WhatsApp",
    whatsappDescription:
      "Send your order to the seller on WhatsApp and agree how to pay.",
    transferTitle: "Mobile Money transfer",
    transferDescription:
      "Send the money yourself, then tell us the transaction reference.",
    codTitle: "Cash on delivery",
    codDescription: "Pay the courier when your order arrives.",

    /** D-16 — revealed by the transfer card, filtered to what is configured. */
    operatorMtn: "MTN Mobile Money",
    operatorOrange: "Orange Money",

    /** The collapsed summary row below `md`. */
    summaryCollapsed: "{n} items · {total}",

    submitWhatsapp: "Order on WhatsApp",
    submitTransfer: "Continue to payment",
    submitCod: "Place order",
    /** The disabled label when no path is selected. */
    submitNoSelection: "Choose how you'll pay",
    submittingWhatsapp: "Preparing your order…",
    submittingTransfer: "Placing your order…",
    submittingCod: "Placing your order…",

    trackingHeading: "Your order link",
    trackingBody:
      "Bookmark this link. It's how you check on your order — we've also sent it on WhatsApp.",
    trackingCopy: "Copy link",
    trackingCopied: "Copied",
    /**
     * The way on to the tracking page from the confirmation screen, on the
     * paths that have no further step of their own. The manual-transfer path
     * uses `submitTransfer` instead, because "Continue to payment" names what
     * is actually waiting there.
     */
    trackingCta: "View your order",

    /*
     * ---------------------------------------------------------------------
     * THE REFUSALS. WRITTEN FROM THE SHOPPER'S SIDE, NEVER THE SERVER'S.
     * ---------------------------------------------------------------------
     * `submitCheckout` (03-12) refuses for eight distinct reasons and every
     * one of them reaches a person standing in a shop doorway on a phone.
     * None of these says what the server checked: a shopper cannot act on
     * "channel not configured", and a message that names an internal rule
     * teaches a prober the shape of the rule for nothing in return.
     *
     * `errorEmptyCart` deliberately covers BOTH an empty basket and a basket
     * belonging to another store — the second is a cookie that cannot be
     * honest here, and telling the two apart would answer a question only
     * someone probing would ask. The server logs the difference; the shopper
     * reads one sentence.
     *
     * `errorOutOfStock` is 03-UI-SPEC.md § B4's approved wording verbatim,
     * and it ends by pointing at the cart because the cart is where the
     * shopper can actually do something — the basket is deliberately left
     * intact when this fires.
     */
    errorRateLimited: "Too many attempts. Try again in a few minutes.",
    errorStoreUnavailable: "This store isn't taking orders right now.",
    errorEmptyCart: "Your cart is empty. Add something before you check out.",
    errorNameRequired: "Enter your name.",
    errorPhoneFormat: "Enter a 9-digit Cameroon mobile number starting with 6.",
    errorAddressRequired:
      "Add the delivery address so the courier can find you.",
    errorPathUnavailable:
      "This seller can't accept that payment method. Choose another way to pay.",
    errorOperatorUnavailable:
      "This seller doesn't accept that network. Choose the other one.",
    errorOutOfStock:
      "Someone just bought the last one. We've updated your cart — check it and try again.",
    errorItemUnavailable:
      "Something in your cart is no longer available. Check your cart and try again.",
    genericError: "Something went wrong. Try again in a moment.",
  },

  /**
   * 03-UI-SPEC.md §§ B5, B6, B7 — the order tracking page, the manual-transfer
   * payment instructions and the claim form (CHK-03 / CHK-04 / CHK-05 / D-15).
   *
   * CHK-05 IS ABSOLUTE: every order state has a heading and a body here, so
   * there is no state in which a customer reaches this page and reads nothing.
   * `ORDER_PLACED` splits by channel — a WhatsApp order was SENT and awaits a
   * conversation, a cash-on-delivery order was RECEIVED and awaits a courier —
   * which is why there are seven heading keys for six states. A state without a
   * row is a requirement violation, not a gap to fill at render time with a
   * spinner or a raw value.
   *
   * `{store}` is the store name and `{amount}` a server-formatted XAF total.
   * The dial codes are separated from the steps so the component can set them
   * in `font-mono` without parsing a sentence, and because D-15's tap-to-dial
   * tiers need the code as a value, not as prose.
   */
  orderStatus: {
    /** Label/uppercase eyebrow at the top of the page. */
    orderNumberEyebrow: "Order {orderNumber}",

    placedWhatsappHeading: "Order sent",
    placedWhatsappBody:
      "We've sent your order to {store}. They'll confirm it with you on WhatsApp.",
    placedCodHeading: "Order received",
    placedCodBody:
      "{store} will confirm your order and arrange delivery. Pay the courier when it arrives.",
    paymentPendingHeading: "Waiting for your payment",
    paymentPendingBody:
      "Send {amount} to {store}, then tell us the transaction reference.",
    paymentClaimedHeading: "Payment being confirmed",
    paymentClaimedBody:
      "{store} is checking your transaction reference. This usually takes a few hours.",
    confirmedHeading: "Order confirmed",
    confirmedBody: "{store} confirmed your order and is getting it ready.",
    disputedHeading: "We couldn't confirm your payment",
    disputedBody: "{store} couldn't match your payment.",
    /** Rendered beneath the merchant's quoted reason. D-11 is recoverable. */
    disputedInstruction:
      "Check your confirmation SMS and send the corrected details.",
    fulfilledHeading: "Order complete",
    fulfilledBody:
      "This order has been delivered. Thank you for shopping with {store}.",

    /** The only action on a WhatsApp order — reopens the same conversation. */
    openWhatsappAgain: "Open WhatsApp again",

    /* --- B5: the payment-instructions block ----------------------------- */

    payHeading: "Send {amount} to {store}",
    payNumberLabel: "{operator} number",
    payAmountLabel: "Exact amount",
    payAmountHelper:
      "Send this exact amount — a different amount is harder for the seller to match.",
    /** The copy button swaps to this for two seconds, at the point of action. */
    copy: "Copy",
    copied: "Copied",

    mtnDialCode: "*126#",
    mtnSteps: [
      "Dial {code}",
      "Choose Transfer money",
      "Enter the number and the exact amount",
      "Confirm with your PIN",
    ],
    orangeDialCode: "#150*47#",
    orangeSteps: [
      "Dial {code}",
      "Choose Send money",
      "Enter the number and the exact amount",
      "Confirm with your secret code",
    ],

    /** D-15 tier A only: MTN, a 6-digit merchant code, and not on iOS. */
    dialCta: "Dial the payment code",
    dialHelper:
      "This opens your phone's dialler with the code already filled in. Press call, then enter your PIN.",
    /** D-15 tier B: Orange takes no parameters, so the code is copyable text. */
    merchantCodeLabel: "Merchant code",

    /* --- B6: the claim form --------------------------------------------- */

    claimOperatorLabel: "Which network did you send from?",
    claimReferenceLabel: "Transaction reference",
    claimReferenceHelper: "The reference in the confirmation SMS from {operator}.",
    claimScreenshotLabel: "Add a screenshot (optional)",
    claimScreenshotHelper: "It helps the seller find your payment faster.",
    claimSubmit: "I've paid",
    claimSubmitting: "Sending…",
    /** ORD-04, field-level and destructive — never a toast. */
    claimDuplicateReference:
      "This reference has already been used. Check your confirmation SMS and enter the exact reference.",
    /** Matches the Phase 1 wording exactly; one rate-limit voice, not two. */
    claimRateLimited: "Too many attempts. Try again in a minute.",
    /** The submit label when resubmitting after a rejection (D-11). */
    claimResubmit: "Send corrected details",
    /** The read-only recap shown while a claim is being checked. */
    claimSummaryHeading: "What you sent",
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

  /* =======================================================================
   * PHASE 4 — the flagship template, onboarding branding and the editor.
   * =======================================================================
   * Three namespaces, transcribed from 04-UI-SPEC.md § Copywriting Contract
   * and landed in ONE pass by plan 04-04, in wave 1, BEFORE any component that
   * renders them exists. Every later plan in this phase only READS them.
   *
   * That ordering is the whole point. 04-PATTERNS.md names this file "the
   * single most likely merge conflict if plans run in parallel waves": five
   * executors each appending a few keys to the same object is five conflicts
   * and five chances for the same sentence to be written twice, slightly
   * differently. A plan that needs a string it cannot find here has found a
   * bug in this plan, not a licence to inline a literal.
   *
   * The voice contract is unchanged and absolute: English, second person, no
   * exclamation marks, no emoji, no ALL-CAPS. Plus four Phase-4 prohibitions:
   * never a promise the product cannot keep (no mailing-list signup, no
   * delivery guarantee, no "Verified"); never an industry-specific claim
   * (D-04 — the default document is the same for a boutique and a hardware
   * shop, and Phase 5 owns industry variants); never an internal identifier;
   * and never fashion-flavoured default copy.
   *
   * `flagship` addresses the SHOPPER. `branding` and `editor` address the
   * MERCHANT. Nothing crosses.
   */

  /**
   * 04-UI-SPEC.md § Flagship default content (D-04, TMPL-01).
   *
   * The default document every new storefront ships with — what a merchant who
   * publishes without opening the editor actually shows their customers. It is
   * read by the section registry's `defaults.ts` (plan 04-06), one key per
   * settings field, which is why the shape below mirrors the settings schemas
   * rather than the page layout.
   *
   * INDUSTRY-NEUTRAL IS A HARD CONSTRAINT, NOT A STYLE PREFERENCE (D-04). Every
   * merchant on this platform gets these exact sentences on day one, so a word
   * that only fits a clothing shop is a word that is wrong for most stores that
   * ever render it. "New arrivals" and "What we're selling" work for a
   * boutique, a phone dealer and a grocer alike; "Shop the collection" does
   * not.
   *
   * Nothing here promises anything the platform cannot do. `Delivery in
   * Douala` says the merchant delivers, not that this platform guarantees it;
   * `Pay your way` names the two payment paths V1 actually has (D-14/D-17).
   *
   * The product-grid empty state is deliberately ABSENT: it is
   * `strings.storefront.emptyHeading` / `.emptyBody`, reused unchanged, so the
   * sentence a shopper reads and the sentence the merchant previews cannot
   * drift apart. Do not copy it in here.
   *
   * The editorial-split body is the one instructional default: it reads as a
   * prompt to the merchant in the editor and is still a coherent, shippable
   * sentence if they never touch it. Everything else is real copy, not lorem.
   */
  flagship: {
    /** Theme chrome, not a section — renders on every storefront route. */
    announcement: "Order online. Pay by Mobile Money or on delivery.",

    hero: {
      eyebrow: "Welcome",
      heading: "New arrivals",
      body: "Everything we're selling right now, in one place.",
      /** The one accent-filled CTA above the fold. */
      ctaLabel: "Shop now",
      /** Home, because the product grid lives on `/` — no new routes. */
      ctaHref: "/",
    },

    /**
     * Three fixed items. The icon is a schema enum on the settings row
     * (`truck`, `message-circle`, `shield-check`), never copy — an icon name
     * in a copy catalogue is a string an i18n pass would try to translate.
     */
    trustBar: {
      itemOne: {
        heading: "Delivery in Douala",
        body: "We'll get your order to you.",
      },
      itemTwo: {
        heading: "Talk to us",
        body: "Message us on WhatsApp before or after you order.",
      },
      itemThree: {
        heading: "Pay your way",
        body: "Mobile Money, or cash when your order arrives.",
      },
    },

    productGrid: {
      heading: "What we're selling",
      /** A link, never a button — 04-UI-SPEC.md § Core contract. */
      viewAllLabel: "View all",
      viewAllHref: "/",
    },

    editorialSplit: {
      eyebrow: "About us",
      heading: "A little about this shop",
      body: "Tell customers who you are and why they should buy from you. You can change this text any time.",
      ctaLabel: "See what's in stock",
      ctaHref: "/",
    },

    /**
     * Replaces the visual reference's mailing-list band. A store that collects
     * addresses it will never send to is a promise the product cannot keep;
     * WhatsApp is the channel these merchants already answer.
     */
    contact: {
      heading: "Questions? Message us.",
      body: "Send us a message on WhatsApp and we'll get back to you.",
      ctaLabel: "Message us on WhatsApp",
    },

    footerTagline: "Thanks for shopping with us.",
  },

  /**
   * `/onboarding/branding` (ONB-02, ONB-03, D-02, D-10, D-11) — surface 2.
   *
   * The merchant-facing step between `/onboarding/plan` and a published store.
   * Blue/gold/slate chrome like every other onboarding step; the only place a
   * merchant's own colour appears on this page is the sample chip beneath each
   * picker (D-12's "sample, never chrome" exception).
   *
   * `industryHelper` is a D-01 honesty clause and must not be softened into a
   * promise: today every store starts on the same template, and copy implying
   * a matched industry design exists is copy that lies until Phase 5.
   *
   * `contrastWarning` is INFORMATIONAL AND NON-BLOCKING (D-11). It never
   * disables the submit and it is never styled as a destructive alert — an
   * accent that is hard to read is the merchant's call, the same way a payment
   * number is accepted as entered (D-17). There is deliberately no equivalent
   * warning on the secondary accent: that colour is only ever a fill whose
   * foreground is derived server-side, so it is readable at every value, and
   * warning about a problem that cannot occur teaches merchants to dismiss
   * warnings.
   */
  branding: {
    /** Renders as "Set up how your store looks · EINORT" via the template. */
    title: "Set up how your store looks",
    heading: "Set up how your store looks",
    subline: "This is what your customers see. You can change all of it later.",

    nameCardTitle: "Your business name",
    nameLabel: "Business name",
    nameHelper: "This is the name customers see on your storefront.",

    industryCardTitle: "What do you sell?",
    industryHelper:
      "We'll use this to suggest a better-matched design later. Every store starts on the same polished template.",

    /**
     * Keyed by segment id so the tile grid reads its label from the id it
     * already holds, and a renamed segment is one edit here rather than a
     * parallel array that can fall out of order.
     */
    segments: {
      "fashion-apparel": "Fashion & apparel",
      electronics: "Electronics",
      "beauty-cosmetics": "Beauty & cosmetics",
      "grocery-food": "Grocery & food",
      "furniture-home": "Furniture & home",
      "general-retail": "General retail",
    },

    logoCardTitle: "Your logo",
    logoHelper:
      "Optional. PNG or JPG — a square logo works best. You can add one later.",
    logoAdd: "Add your logo",
    logoReplace: "Replace",
    logoRemove: "Remove",
    logoUploadFailed: "Upload failed. Tap to try again.",

    coloursCardTitle: "Your brand colours",
    coloursHelper:
      "These tint your buttons and links. The rest of your store stays clean black-and-white on purpose.",

    primaryAccentLabel: "Primary accent",
    /** Caption under the primary sample chip — where that colour shows up. */
    primaryAccentCaption: "Buttons and links",
    secondaryAccentLabel: "Secondary accent",
    secondaryAccentCaption: "Announcement bar",

    contrastWarning:
      "This colour is light against a white page — links in it may be hard to read. You can use it anyway.",
    invalidHex: "Use a 6-digit colour code, like #1A1A1A.",

    /** The one primary button on the page. */
    cta: "Publish my store",
    /** Width retained while in flight — no layout shift, no full-page spinner. */
    ctaSubmitting: "Publishing your store…",
  },

  /**
   * `/dashboard/storefront-editor` (EDIT-02, EDIT-03, D-05…D-08, D-12…D-15) —
   * surface 3.
   *
   * The editor's own chrome is a dashboard surface: blue/gold/slate, Outfit
   * headings, 0.75rem radius. The merchant's accent resolves to nothing here
   * and must never be written (D-12) — the only place they see their colour
   * applied is inside the preview iframe, which is a different document.
   *
   * There is no add-section and no remove-section copy in this namespace and
   * there must never be one (D-05). The section list is fixed: reorderable,
   * never addable or removable, and nothing at all is rendered for either — not
   * even a disabled control, because a disabled affordance invites a support
   * question about a capability that does not exist.
   *
   * `discard*` is the phase's only destructive confirmation. Publishing is a
   * forward action and gets a toast, not a dialog.
   *
   * The three error strings are the honest surfacing of three different
   * failures and must stay distinct: a refused publish left the live store
   * untouched, a failed save left the draft untouched, and a preview that never
   * loaded touched nothing at all. Collapsing them into one "Something went
   * wrong" throws away the only reassurance the merchant actually needs.
   */
  editor: {
    /** Renders as "Storefront editor · EINORT" through the layout template. */
    title: "Storefront editor",
    heading: "Storefront editor",

    /* --- the rail ------------------------------------------------------- */
    railThemeGroup: "Theme",
    railSectionsGroup: "Sections",
    railThemeEntry: "Brand & logo",
    /** Back row of the settings-panel view — this is a push/pop, not a pane. */
    railBack: "All sections",

    /**
     * Keyed by section type. `trust-bar` and `editorial-split` are named for
     * what the merchant sees, not for what the registry calls them: nobody
     * outside this codebase knows what an editorial split is.
     */
    sectionLabels: {
      hero: "Hero",
      "trust-bar": "Why shop with us",
      "product-grid": "Products",
      "editorial-split": "About",
      contact: "Contact",
    },

    fixedListFootnote:
      "This template's sections are fixed. You can reorder them and change what's inside.",

    /** `{section}` is the label above. Reorder is keyboard-reachable. */
    moveSectionUp: "Move {section} up",
    moveSectionDown: "Move {section} down",
    /** Announced in a polite live region — the move is silent otherwise. */
    sectionMoved: "{section} moved to position {n} of {total}.",

    /* --- settings panel: field descriptors -------------------------------- */
    /*
     * Read by `src/server/theming/registry.ts` (plan 04-06). Every
     * `FieldDescriptor.label` / `.helper` / `.options[].label` in that registry
     * is a reference into the four groups below and NEVER an inline literal —
     * 04-PATTERNS.md § Shared Pattern 1 makes that binding, and it is the same
     * copy/enforcement split `src/server/entitlements/plans.ts` documents in its
     * header.
     *
     * These keys were missed by plan 04-04's transcription: 04-UI-SPEC.md
     * § Settings-panel view requires a visible label on every field and § The
     * six field kinds requires select option copy to "come from the registry
     * descriptor and `strings`", but neither list was written down. They are
     * added here rather than inlined in the registry for exactly the reason the
     * namespace header above gives.
     *
     * KEYED BY THE SETTINGS KEY, NOT BY SECTION. `heading` means the same thing
     * in the hero, the product grid and the contact band, so it is one entry.
     * A per-section map would be five chances to write the same word five
     * slightly different ways, which is the drift this file exists to prevent.
     *
     * Three brand-field labels are deliberately ABSENT and are read from
     * `strings.branding` instead — see the note on `THEME_FIELDS` in the
     * registry. 04-UI-SPEC.md § The six field kinds makes the editor's colour
     * field "identical to the onboarding colour field", so a second copy of
     * "Primary accent" here would be a sentence that can drift from the one the
     * merchant already read at onboarding.
     */

    /**
     * `eyebrow` is named for what it is, not for what the registry calls it —
     * the same rule `sectionLabels` follows. Nobody outside this codebase calls
     * a short line above a headline an eyebrow.
     */
    fieldLabels: {
      eyebrow: "Line above the heading",
      heading: "Heading",
      body: "Body text",
      ctaLabel: "Button label",
      ctaHref: "Button link",
      backgroundImageKey: "Background image",
      overlayOpacity: "Darken the image",
      icon: "Icon",
      viewAllLabel: "Link label",
      viewAllHref: "Link",
      itemCount: "Products to show",
      imageKey: "Image",
      announcementText: "Announcement bar text",
      footerTagline: "Footer tagline",
    },

    /**
     * Declared only where a field needs guidance the label cannot carry. A
     * helper on every field is a helper the merchant stops reading.
     *
     * The `link` kind's helper is NOT here — it is `linkHelper` below, supplied
     * by the field renderer for the kind rather than per descriptor, because
     * 04-UI-SPEC.md pins one sentence for every link field on the surface.
     */
    fieldHelpers: {
      backgroundImageKey:
        "Optional. Without one, this section uses a clean light background.",
      overlayOpacity:
        "Only applies when you've added a background image. Darkening helps your text stay readable.",
      itemCount:
        "How many products show on your home page. Customers can still browse the rest.",
      announcementText:
        "Shows in the thin bar across the top of your storefront.",
      footerTagline: "A short line in your storefront footer.",
    },

    /**
     * The hero scrim, as three named steps rather than a slider.
     *
     * The stored values are `0`, `0.3` and `0.6`. They are not spelled out to
     * the merchant because a percentage is not the question they are answering —
     * "can my customers read the headline over this photo" is.
     */
    overlayOpacityOptions: {
      none: "None",
      medium: "Medium",
      strong: "Strong",
    },

    /** The grid's three legal counts (schema literals 4 / 8 / 12). */
    itemCountOptions: {
      four: "4 products",
      eight: "8 products",
      twelve: "12 products",
    },

    /**
     * The four trust-bar icons, keyed by the schema's enum value and labelled
     * by WHAT THE PICTURE SHOWS, not by what it is meant to imply. A merchant
     * choosing between "Delivery" and "Trust" is guessing at a glyph; a merchant
     * choosing between "Delivery van" and "Shield" is reading a list.
     *
     * The enum values themselves are lucide identifiers, not copy, and stay in
     * the schema and the registry — an icon name in a copy catalogue is a string
     * a later i18n pass would try to translate.
     */
    iconOptions: {
      truck: "Delivery van",
      "shield-check": "Shield",
      clock: "Clock",
      "message-circle": "Chat bubble",
    },

    /* --- field kinds ---------------------------------------------------- */
    linkHelper:
      "Where this button goes — a path like /cart, or a full https:// address.",
    linkInvalid: "Use a path starting with / or a full https:// address.",
    /**
     * The internal route shape is named here, and only here, because the
     * merchant can type it and the proxy hard-404s it. Telling them the rule
     * without telling them the fix is a dead end.
     */
    linkInternalPrefix: "Leave out the /s/ part — just use /cart.",

    imageAdd: "Add image",
    imageReplace: "Replace",
    imageRemove: "Remove",
    imageUploadFailed: "Upload failed. Tap to try again.",

    /**
     * Shown on the contact section's settings panel when no WhatsApp number is
     * saved. The section still renders — this is a nudge, never a block.
     */
    contactNoWhatsapp:
      "Add a WhatsApp number in payment settings so this button works.",
    contactNoWhatsappLink: "Payment settings",

    /**
     * The product grid's twin of the nudge above, shown on that section's
     * settings panel when the merchant has no active products.
     *
     * MERCHANT-FACING, AND THEREFORE NOT THE SECTION'S EMPTY STATE. The rendered
     * grid shows `strings.storefront`'s shopper-voiced line, because `/preview`
     * IS the storefront and the merchant has to see exactly the copy their
     * customers would (04-UI-SPEC.md § Flagship default content). This sentence
     * is the one only they can see.
     *
     * Missed by plan 04-04's transcription: 04-UI-SPEC.md § S3 names the copy
     * and the link but neither reached this file, and plan 04-15 is the first
     * caller. Added here rather than inlined in the shell for the reason the
     * namespace header gives.
     */
    productGridNoProducts:
      "Add your first product so this section fills up.",
    productGridNoProductsLink: "Products",

    /* --- preview canvas -------------------------------------------------- */
    previewFrameTitle: "Your storefront preview",
    previewLoading: "Loading your storefront preview…",
    previewTimeout:
      "The preview didn't load. Your changes are safe — try loading it again.",
    reloadPreview: "Reload preview",
    viewportDesktop: "Desktop",
    viewportMobile: "Mobile",
    /** The below-`lg` pane switch. No side-by-side at 360px. */
    paneEdit: "Edit",
    panePreview: "Preview",

    /* --- publish bar ----------------------------------------------------- */
    statusUnsaved: "Unsaved changes",
    statusSaved: "Saved · not published yet",
    statusPublished: "Published",

    save: "Save",
    saveSubmitting: "Saving…",
    publish: "Publish",
    publishSubmitting: "Publishing…",
    discard: "Discard",
    viewStore: "View store",

    /** Stay-on-page publish, so a toast is the correct success signal. */
    publishedToast: "Your storefront is live",

    publishRefused:
      "We couldn't publish these changes. Reload the editor and try again — what customers see right now hasn't changed.",
    saveFailed:
      "Couldn't save your changes. Check your connection and try again.",

    /* --- the one destructive confirmation --------------------------------- */
    discardTitle: "Discard your unpublished changes?",
    discardBody:
      "Your storefront will go back to exactly what customers see right now. This can't be undone.",
    discardConfirm: "Discard changes",
    discardCancel: "Keep editing",

    /**
     * D-13/D-15. The message `assertCanEditStorefront` hands back when an
     * expired-trial Starter merchant calls save or publish anyway — the
     * disabled buttons are courtesy, never the control, so this string is what
     * the SERVER returns and what the inline notice renders. Both read it from
     * this one key.
     *
     * It names what still works before it names what does not, because the
     * whole proposition of the view-only state is that the merchant can try the
     * editor properly before deciding to pay for it.
     */
    starterViewOnly:
      "You're on the Starter plan. Try the editor as much as you like — saving and publishing changes needs Business or Professional.",
    /**
     * The inline link inside the view-only notice above, to `/dashboard/plan`.
     * Named for the link rather than for the notice so a grep for the notice's
     * key finds exactly one line — that key is an interface (plan 04-09 passes
     * it to `assertCanEditStorefront`) and it must be unambiguous.
     */
    seePlansLink: "See plans",
  },
} as const;
