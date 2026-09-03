/**
 * The storefront footer — three rows, and deliberately nothing else
 * (04-UI-SPEC.md § Theme Chrome → Footer).
 *
 * Wordmark, tagline, copyright rule. Mounted once by
 * `src/app/s/[slug]/layout.tsx`, below `{children}`, so it renders on every
 * storefront route: `/`, the PDP, `/cart`, `/checkout` and `/order/[token]`.
 * Like the header and the announcement bar it is THEME CHROME, not a section
 * (04-RESEARCH Pattern 12) — it is not reorderable and not removable, because a
 * merchant must not be able to blank the chrome on a page that takes money.
 *
 * The tagline is a `StorefrontTheme` setting (`footerTagline`), so it changes
 * with the theme rather than with the home document, and it reaches every route
 * for the same reason.
 *
 * ---------------------------------------------------------------------------
 * NO LINK COLUMNS. PATTERN 9 DEVIATION 3, AND IT IS NOT AN UNFINISHED FOOTER.
 * ---------------------------------------------------------------------------
 * The editorial reference this template is drawn from carries three columns of
 * links — About, Help, Policies. V1 HAS NONE OF THOSE PAGES. Shipping the
 * columns anyway would mean either dead links or fragment-only stubs on a
 * storefront a real, paying customer visits, and a link that goes nowhere is
 * how a shopper decides a store is abandoned. A clean three-row footer is
 * honest; a fuller one that lies is not.
 *
 * This is the same rule that replaced the reference's mailing-list band with
 * the WhatsApp contact section (deviation 1, `contact-section.tsx`): never
 * render a promise the product cannot keep. DO NOT "COMPLETE" THIS FOOTER by
 * adding the columns back — when those pages actually exist, they arrive with
 * their routes, not before them. THIS FILE CONTAINS NO ANCHOR AND NO LINK
 * TARGET OF ANY KIND, and a grep proving that is the acceptance criterion which
 * says so.
 *
 * No `"use client"` and no state: it renders a year, a name and a sentence.
 */
export function StoreFooter({
  storeName,
  tagline,
}: {
  storeName: string;
  /** `StorefrontTheme.footerTagline`. May be empty — the row simply drops. */
  tagline: string;
}) {
  /*
   * Read at render time rather than pinned to a build-time constant: this page
   * is already dynamic (the tenant resolves per request), so a stale year is a
   * bug with no upside.
   */
  const year = new Date().getFullYear();

  const trimmedTagline = tagline.trim();

  return (
    <footer className="border-t border-border py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6 md:px-8">
        {/* Row 1 — the wordmark. Label 14/600 uppercase. */}
        <p className="text-sm leading-snug font-semibold tracking-[0.08em] text-foreground uppercase">
          {storeName}
        </p>

        {/* Row 2 — the merchant's tagline. Body, muted, measure-capped. */}
        {trimmedTagline !== "" && (
          <p className="mt-4 max-w-prose text-base leading-normal font-normal text-muted-foreground">
            {trimmedTagline}
          </p>
        )}

        {/*
         * Row 3 — the copyright rule.
         *
         * Assembled from a symbol, a number and the merchant's own store name.
         * It carries NO ENGLISH WORDS, which is why it is not a `strings` entry:
         * `src/lib/strings.ts` is the catalogue an i18n extraction will lift
         * whole, and a template with nothing translatable in it would be an
         * entry that every future locale copies unchanged. C-14 bans inlined
         * COPY; this is punctuation around two interpolations.
         */}
        <p className="mt-8 border-t border-border pt-6 text-sm leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {`© ${year} ${storeName}`}
        </p>
      </div>
    </footer>
  );
}
