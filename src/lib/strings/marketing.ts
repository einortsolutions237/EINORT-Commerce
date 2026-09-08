/**
 * MKTG-01 — the public landing page's (`src/app/page.tsx`, apex `/`) copy.
 *
 * Extracted to its own module for a DIFFERENT reason than `flagship.ts`'s
 * TS7022 circularity (see that file's header for contrast): `index.ts` is
 * already 1,867 lines, and this page's copy adds roughly 150-250 more to a
 * self-contained surface with its own distinct voice (public, unauthenticated,
 * conversion-oriented) — nothing here imports back from `index.ts` or from
 * `templates/*.ts`, so there is no cycle to break, only a file worth keeping
 * separate for its own sake.
 *
 * EVERY claim below is traceable to `.planning/phases/
 * 05.2-marketing-landing-page-redesign/05.2-RESEARCH.md` § Verified Feature
 * Ledger, cross-checked against `src/server/entitlements/plans.ts` and
 * `src/server/theming/registry.ts` directly. `strings.plan.*.features`
 * (rendered on `/onboarding/plan` and `/dashboard/plan`) is explicitly NOT a
 * source for this file — it advertises at least six features this codebase
 * has not shipped; see 05.2-RESEARCH.md § "DO NOT CLAIM" for the full list.
 * Do not copy phrasing from it even for inspiration.
 *
 * `finalCta` deliberately has no dedicated sign-in-link field: `page.tsx`
 * renders `strings.signup.loginLink` ("Already have a store? Sign in")
 * directly for that spot instead of duplicating an identical string here —
 * the checker's non-blocking nit on 05.2-UI-SPEC.md.
 *
 * Voice contract (05.2-UI-SPEC.md § Copywriting Contract, D-03): English,
 * second person, no exclamation marks, no apology interjections, no emoji, no
 * superlative with no referent, no invented count. Every numeric claim on
 * this page (10-day trial, 10/25/50 templates per tier) matches
 * `src/server/entitlements/plans.ts`'s actual `PLANS` values exactly; the
 * 5,000/12,500/25,000 XAF monthly prices are deliberately not printed here —
 * out of D-04's scope for this page.
 */
export const marketingCopy = {
  /** Kept for `page.tsx`'s top-lockup wordmark. Must stay byte-identical to `BRAND` in `index.ts` — not imported from there to avoid re-creating the exact circularity `flagship.ts`'s header warns against. */
  wordmark: "EINORT",
  tagline: "Create your online store in minutes.",
  cta: "Create my store",

  /** Top-lockup "Sign in" label — short chrome text, distinct from the final-CTA's full-sentence link. */
  signIn: "Sign in",

  metaTitle: "EINORT — Create your online store in Cameroon",
  metaDescription:
    "Sell online in Cameroon with Mobile Money, Orange Money, cash on delivery and WhatsApp orders. Pick a template, add your products, and publish your storefront in minutes.",

  hero: {
    heading: "Your store online, taking orders today.",
    body: "Pick your industry, add your logo and your products, and publish a storefront at your own yourshop.einort.com address. Your customers pay by MTN Mobile Money, Orange Money, cash on delivery, or send their order straight through WhatsApp.",
    ctaNote: "Free for 10 days. No card required.",
  },

  /** Differentiator 1, placed first per 05.2-RESEARCH.md Finding 1 (payments is EINORT's sharpest, most defensible claim). */
  payments: {
    heading: "Get paid the way Cameroon actually pays.",
    body: "Every EINORT store takes MTN Mobile Money and Orange Money transfers, cash on delivery, and WhatsApp orders from the day it opens. Your customer sees your receiving number and the exact amount, sends the money, and submits their transaction reference — with a screenshot if they have one. You confirm or reject it from your dashboard in one tap.",
    constraint:
      "No order is ever marked paid on the customer's word alone, and the same transaction reference can't be used twice. There is no card gateway and no automatic settlement — the money arrives in your own wallet, exactly as it does today.",
  },

  /** Differentiator 2. */
  templates: {
    heading: "Fifty templates. Six industries. Not one of them generic.",
    body: "Fashion, electronics, beauty, grocery, furniture and general retail each get their own layout structure — a different section order, a different way of showing products, a different type treatment. Add your logo and your brand colors and the whole storefront takes them, right down to the buttons.",
    constraint:
      "Starter reaches 10 templates, Business 25, Professional all 50. Every plan gets the full 10-day trial first.",
  },

  /** Differentiator 3. */
  speed: {
    heading: "From sign-up to a live address, in one sitting.",
    body: "Name your business, choose your industry, upload your logo, pick your colors and a template. EINORT publishes your store at yourshop.einort.com straight away — a real address you can share the same afternoon. Photos taken on a phone are resized and cleaned up automatically, so one bad picture doesn't wreck the page.",
    constraint: "No developer, no hosting to set up, no domain to buy.",
  },

  howItWorks: {
    heading: "Three steps, no developer.",
    steps: [
      {
        title: "Create your store",
        body: "Email, password, and the address you want. Your .einort.com address is live the moment you finish.",
      },
      {
        title: "Make it yours",
        body: "Pick your industry and a template, add your logo and colors, and list your first products.",
      },
      {
        title: "Start selling",
        body: "Share your address. Take orders by Mobile Money, cash on delivery or WhatsApp, and confirm each payment from your dashboard.",
      },
    ],
  },

  finalCta: {
    heading: "Ten days. No card. Your own storefront.",
    body: "Every plan starts with a full 10-day trial of everything it includes. Set your store up, show it to a customer, and decide after.",
  },
} as const;
