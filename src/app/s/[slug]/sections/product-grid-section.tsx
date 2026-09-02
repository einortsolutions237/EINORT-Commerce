import { ArrowRightIcon, ImageOffIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import type { SectionInstance } from "@/server/theming/schema";

import type { StorefrontRenderData } from "./render-data";
import { Reveal } from "./reveal";

/**
 * S3 — the product grid (TMPL-01, TMPL-02, CHK-01, D-06, D-09).
 *
 * 04-UI-SPEC.md § S3 is the contract; every class string below is quoted from
 * it rather than chosen here.
 *
 * ---------------------------------------------------------------------------
 * THIS IS PHASE 3's CATALOGUE GRID, RE-TOKENED — NOT A SECOND ONE.
 * ---------------------------------------------------------------------------
 * The tile, the category chips, the out-of-stock treatment and the currency
 * formatter are lifted structurally VERBATIM from the storefront home page's
 * own body, which 04-RESEARCH.md Pattern 9 (deviation 2) keeps as the home
 * route precisely so no link in the catalogue has to move. Quick task
 * 260901-00j already spent 35 minutes on the class of bug that link churn
 * produces here; the answer was to change what the home route RENDERS, never
 * where it lives. Three things changed and they are all visual: the tile
 * proportion, the selected chip's fill, and a hover scale on the image.
 *
 * ---------------------------------------------------------------------------
 * EVERY HREF IN THIS FILE IS ORIGIN-RELATIVE, AND MUST STAY THAT WAY.
 * ---------------------------------------------------------------------------
 * The shopper's origin is already `{slug}.{root}`; `src/proxy.ts` supplies the
 * internal rewrite prefix on the way in, from the `Host` header, and hard-404s
 * that path when a browser requests it directly (TEN-03/DOM-02). So the three
 * shapes below are `/`, `/?category={slug}` and `/p/{slug}` and nothing else.
 * `store-header.tsx` holds the canonical statement of this rule for the whole
 * route tree and `tests/unit/storefront-link-prefix.test.ts` fails the build if
 * the prefix comes back — the fix for that failure is ALWAYS to make the link
 * origin-relative, NEVER to relax the check in `src/proxy.ts`, which is a
 * security control and not a routing convenience.
 *
 * ---------------------------------------------------------------------------
 * NO `"use client"`, AND NO SERVER-MARKED DEPENDENCY.
 * ---------------------------------------------------------------------------
 * Like every sibling in this directory, this component renders from the RSC
 * tree on the live storefront AND from inside the editor's client-side preview
 * canvas. The one cross-boundary module it touches is the theming schema, which
 * plan 04-02 deliberately built marker-free (T-04-24). That is also why the
 * image URL arrives as `data.imageBaseUrl` and is concatenated here rather than
 * being built by `publicUrlFor()`, which lives behind that boundary — see
 * `render-data.ts`.
 *
 * ---------------------------------------------------------------------------
 * PRODUCTS COME FROM `data`. NOTHING PRICED, STOCKED OR IDENTIFIED COMES FROM
 * `settings`. (T-04-25)
 * ---------------------------------------------------------------------------
 * The section's settings carry a heading, a link label, a link target and an
 * item count — no price, no product id, no stock. Everything a shopper is
 * quoted is read server-side through the tenant-scoped catalogue query and
 * handed down in `data`. A settings field that could name a product would make
 * a merchant-authored document able to select what another merchant's
 * storefront displays, which is the whole reason the split is drawn here.
 */

/**
 * The storefront money format, unchanged from the page this grid replaces.
 *
 * `fr-CM` / `XAF` / no fraction digits, constructed directly rather than
 * through a currency library — a project rule, and the same call the cart,
 * checkout and product pages already make. Module scope so the `Intl` lookup
 * happens once per process rather than once per tile.
 */
const currency = new Intl.NumberFormat("fr-CM", {
  style: "currency",
  currency: "XAF",
  maximumFractionDigits: 0,
});

/**
 * The `card` derivative of the `product` preset in the image pipeline
 * (`sizes: [400, 800, 1600]`, `labels: ["thumb", "card", "detail"]`).
 *
 * 800px is the right rung for a tile that is at most a quarter of a 1280px
 * grid; the hero addresses `detail` because it is full-bleed. `imageKey` is a
 * validated storage-key PREFIX written by the Phase 3 upload pipeline, never a
 * URL and never merchant-authored text, so this concatenation cannot point
 * `next/image` at a host outside the `remotePatterns` allowlist (T-04-15).
 */
const TILE_DERIVATIVE = "card.webp";

/**
 * 04-UI-SPEC.md § Motion Language, "Grid / column stagger".
 *
 * A courtesy copy of the reveal combination for the same reason
 * `trust-bar-section.tsx` holds one: `reveal.tsx` carries the client directive,
 * and a server component reading a plain export across that boundary receives a
 * client reference rather than the string. The spec table is the authority for
 * both copies.
 */
const TILE_ENTER =
  "animate-in fade-in slide-in-from-bottom-4 fill-mode-both " +
  "ease-[var(--motion-ease)] animation-duration-[var(--motion-reveal)]";

/**
 * The stagger ceiling — 04-UI-SPEC.md § Motion Language, verbatim.
 *
 * Capped at 7 (350ms at the 50ms token) so a twelve-tile grid does not spend
 * two seconds arriving. A shopper waiting for the eleventh tile to fade in has
 * stopped reading the motion as polish and started reading it as slowness.
 */
const MAX_STAGGER_INDEX = 7;

export function ProductGridSection({
  settings,
  data,
}: {
  /* Narrowed out of the union — see the note in `hero-section.tsx`. */
  readonly settings: Extract<
    SectionInstance,
    { type: "product-grid" }
  >["settings"];
  readonly data: StorefrontRenderData;
}) {
  const visible = data.products.slice(0, settings.itemCount);

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 md:px-8 md:py-24">
      <Reveal>
        <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
          {/* Heading role: 24→32px / 600 / 1.2. */}
          <h2 className="text-2xl leading-tight font-semibold tracking-tight text-foreground md:text-[32px]">
            {settings.heading}
          </h2>

          {/*
           * One of the accent's four permitted uses (04-UI-SPEC.md § Color).
           *
           * THE UNDERLINE AND THE ARROW ARE LOAD-BEARING, NOT DECORATION.
           * Colour is never the only signal: a merchant may pick an accent that
           * fails 4.5:1 against white, and D-11 says that stays their call
           * rather than a blocked save. The underline plus the glyph are what
           * keep this link discoverable at that colour, so neither may be
           * dropped for tidiness. `min-h-11` is the 44px tap target.
           */}
          <Link
            href={settings.viewAllHref}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1.5",
              "text-sm leading-snug font-semibold",
              "text-brand-accent underline underline-offset-4",
              "transition-colors duration-[var(--motion-quick)] ease-[var(--motion-ease)]",
            )}
          >
            {settings.viewAllLabel}
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </Reveal>

      {/*
       * D-06, inherited from Phase 3: chips appear only from two categories up.
       * One category is not a filter, it is a label, and a row containing "All"
       * and one other option asks the shopper to make a choice that has no
       * second outcome.
       */}
      {data.categories.length >= 2 && (
        <nav
          aria-label={strings.catalog.allCategories}
          className="mt-6 flex gap-2 overflow-x-auto pb-2"
        >
          <Link
            href="/"
            aria-pressed={data.activeCategorySlug === null}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full px-4",
              "text-sm leading-snug font-semibold tracking-[0.08em] uppercase",
              "transition-colors duration-[var(--motion-quick)] ease-[var(--motion-ease)]",
              data.activeCategorySlug === null
                ? "bg-brand-accent text-brand-accent-foreground"
                : "border border-border text-foreground hover:bg-accent",
            )}
          >
            {strings.catalog.allCategories}
          </Link>

          {data.categories.map((category) => (
            <Link
              key={category.id}
              href={`/?category=${category.slug}`}
              aria-pressed={data.activeCategorySlug === category.slug}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center rounded-full px-4",
                "text-sm leading-snug font-semibold tracking-[0.08em] uppercase",
                "transition-colors duration-[var(--motion-quick)] ease-[var(--motion-ease)]",
                data.activeCategorySlug === category.slug
                  ? "bg-brand-accent text-brand-accent-foreground"
                  : "border border-border text-foreground hover:bg-accent",
              )}
            >
              {category.name}
            </Link>
          ))}
        </nav>
      )}

      {visible.length === 0 ? (
        /*
         * -------------------------------------------------------------------
         * THE ZERO-PRODUCTS STATE IS AN IN-SECTION BLOCK. THE PHASE 1 FULL-PAGE
         * PLACEHOLDER IS RETIRED ON THE HOME ROUTE AND MUST NOT COME BACK.
         * -------------------------------------------------------------------
         * 04-UI-SPEC.md § S3 records this as the intended behaviour rather than
         * a regression: the page is no longer empty, because the hero and the
         * trust bar are above this band and the contact band is below it. A
         * merchant who has published without adding a product still gets a page
         * that looks finished, which is exactly the moment TMPL-01's "would a
         * stranger think this cost money" bar is judged.
         *
         * The copy is REUSED from the existing storefront namespace, not
         * duplicated. It is shopper-voiced on purpose — the preview route IS the
         * storefront, so a merchant editing their store reads the same sentence
         * their customer would. The merchant-facing nudge ("add your first
         * product") belongs in the editor's settings panel for this section and
         * never in the rendered page.
         */
        <div className="mt-8 rounded border border-dashed border-border p-8 text-center">
          {/* Heading role: 24px / 600 / 1.2. */}
          <p className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
            {strings.storefront.emptyHeading}
          </p>
          {/* Body role: 16px / 400 / 1.6. */}
          <p className="mx-auto mt-2 max-w-prose text-base leading-[1.6] font-normal text-muted-foreground">
            {strings.storefront.emptyBody}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {visible.map((product, index) => (
            <Link
              key={product.id}
              href={`/p/${product.slug}`}
              className={cn("group flex flex-col", TILE_ENTER)}
              /*
               * A token and an integer inside `calc()` — never a merchant
               * string — so nothing injectable reaches a `style` attribute and
               * ban #1 sees no colour on this line (T-04-09).
               */
              style={{
                animationDelay: `calc(var(--motion-stagger) * ${Math.min(index, MAX_STAGGER_INDEX)})`,
              }}
            >
              {/*
               * The editorial DTC proportion, 4:5. The product-detail gallery
               * deliberately keeps its 1:1 frame (03-UI-SPEC.md § B2) — a
               * shopper comparing tiles benefits from the taller crop, a shopper
               * inspecting one product benefits from the squarer one, and making
               * them "consistent" costs one of those two.
               */}
              <div className="relative aspect-[4/5] overflow-hidden rounded bg-muted">
                {product.imageKey ? (
                  <Image
                    src={`${data.imageBaseUrl}/${product.imageKey}/${TILE_DERIVATIVE}`}
                    alt={product.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                    className={cn(
                      "object-cover",
                      "transition-transform duration-[var(--motion-hover)] ease-[var(--motion-ease)] group-hover:scale-105",
                      /*
                       * D-09: the image DIMS. The tile stays in the grid, the
                       * link stays live and the product stays shareable — an
                       * out-of-stock item a customer already has a link to must
                       * not answer with a 404, and a merchant restocking
                       * tomorrow must not lose the page's history today.
                       */
                      !product.inStock && "opacity-60",
                    )}
                  />
                ) : (
                  /*
                   * A deliberate glyph, never a broken-image icon. The tile
                   * background is already `bg-muted`, so what a shopper sees is
                   * a placeholder that looks chosen rather than a failure that
                   * looks like the site is broken.
                   */
                  <div
                    className="flex h-full w-full items-center justify-center"
                    aria-hidden="true"
                  >
                    <ImageOffIcon className="size-8 text-muted-foreground" />
                  </div>
                )}

                {!product.inStock && (
                  <Badge
                    variant="outline"
                    className="absolute top-2 left-2 border-border bg-background text-xs leading-none font-semibold tracking-[0.08em] text-foreground uppercase"
                  >
                    {strings.catalog.outOfStock}
                  </Badge>
                )}
              </div>

              {/* Body 16/400, two-line clamp. */}
              <p className="mt-4 line-clamp-2 text-base leading-normal font-normal text-foreground">
                {product.name}
              </p>

              {/* Body 16/600, tabular-nums so prices align down the column. */}
              <p className="mt-1 text-base leading-normal font-semibold tabular-nums text-foreground">
                {currency.format(product.priceXaf)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
