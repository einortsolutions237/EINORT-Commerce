/**
 * The flagship's copy, extracted to its own module (not inline in
 * `src/lib/strings/index.ts`'s `strings` object) for exactly one reason:
 * `strings.templates` (spliced into `strings` from the six per-segment
 * modules under `src/lib/strings/templates/`) types each namespace as
 * `Partial<Record<TemplateKey, Partial<typeof strings.flagship>>>` — reusing
 * this shape structurally rather than hand-declaring a duplicate interface
 * that could drift from it.
 *
 * If those six modules imported `typeof strings.flagship` directly from
 * `@/lib/strings` (i.e. from `index.ts` itself), TypeScript would refuse to
 * compile: `index.ts`'s own `strings` object initializer transitively
 * imports those six modules' values (to build `strings.templates`), which
 * would in turn import `strings`'s own type from `index.ts` — a genuine
 * circular type reference (TS7022 "referenced directly or indirectly in its
 * own initializer"), not a runtime circularity a `type`-only import can
 * paper over. Moving the flagship's copy here, where nothing imports back
 * from `index.ts` or `templates/*.ts`, breaks that cycle while keeping the
 * exact same single-source-of-truth guarantee: `strings.flagship` below is
 * this module's value verbatim, so the two can never drift.
 *
 * `flagship-fashion` is frozen (05-RESEARCH.md § Skeleton allocation) — do
 * not "improve" this copy while authoring the other 49 segment templates.
 */

export const flagshipCopy = {
  /**
   * Display name shown on template-picker cards (Label role, 05-UI-SPEC.md
   * § Onboarding Template Picker) — kept short and concrete, matching the
   * convention plans 05-12 through 05-17 follow for the other 49 templates.
   */
  name: "Flagship",
  /** Segment tag shown beneath the template name on picker cards. */
  segmentTag: "Fashion & apparel",

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
} as const;

/**
 * Deep-widens every literal string type `as const` puts on `flagshipCopy`,
 * keeping the shape (keys, nesting, arrays) otherwise identical.
 *
 * `typeof flagshipCopy` verbatim would type `hero.eyebrow` as the literal
 * `"Welcome"`, `trustBar.itemOne.heading` as the literal `"Delivery in
 * Douala"`, and so on for every leaf — because `as const` narrows every
 * string literal it touches, and the `Partial<FlagshipCopy>` the six
 * per-segment namespaces are typed against (`src/lib/strings/templates/
 * *.ts`) only optionalizes ONE level: it does not widen, and does not reach
 * into `hero`/`trustBar`/etc. to optionalize or widen THEIR fields. Left
 * unwidened, every one of the 49 non-flagship templates would be a type
 * error unless its copy were byte-identical to the flagship's own wording —
 * exactly backwards for TMPL-04, which requires fifty templates with
 * genuinely distinct copy.
 */
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

/**
 * The reference shape every one of the 50 templates' copy (`strings.templates
 * [key]`) is typed against — `Partial<FlagshipCopy>`, nested `Partial` at the
 * per-segment-namespace level (see `src/lib/strings/templates/*.ts`). Still
 * structurally derived from `typeof flagshipCopy` (see `Widen` above), so
 * this can never drift from `strings.flagship`'s own shape — only the leaf
 * literal types are relaxed to `string`.
 */
export type FlagshipCopy = Widen<typeof flagshipCopy>;
