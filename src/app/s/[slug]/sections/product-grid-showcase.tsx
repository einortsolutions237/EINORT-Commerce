import { ArrowRightIcon, ImageOffIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import type { SectionInstance } from "@/server/theming/schema";

import type { StorefrontRenderData } from "./render-data";
import { Reveal } from "./reveal";

/**
 * `product-grid:showcase` — 05-UI-SPEC.md § New Variant Contracts,
 * `product-grid` variant `showcase`. Every class string below is quoted from
 * that contract rather than chosen here.
 *
 * ---------------------------------------------------------------------------
 * THE HEADER, CHIPS, TILE ASPECT, OUT-OF-STOCK AND NO-IMAGE TREATMENTS ARE
 * UNCHANGED FROM `ProductGridGrid`. ONLY THE GRID AND THE TILE COPY DIFFER.
 * ---------------------------------------------------------------------------
 * `product-grid-section.tsx`'s file header records the rule this file must
 * not re-litigate: products, categories and prices all come from `data`,
 * never from `settings` (T-04-25). This component reads the same `data` the
 * `grid` and `dense` arms read — never a second query.
 *
 * `gap-8` / `md:gap-12` are the existing `xl`/`2xl` spacing-scale tokens
 * reused, not new values (05-UI-SPEC.md § Spacing Scale exceptions); the tile
 * aspect stays `aspect-[4/5]`, site-wide and unchanged — `showcase` earns its
 * distinctiveness from fewer, larger tiles and more surrounding space, not a
 * new crop.
 */

const currency = new Intl.NumberFormat("fr-CM", {
  style: "currency",
  currency: "XAF",
  maximumFractionDigits: 0,
});

/**
 * The `card` derivative of the `product` preset — same rung `grid` uses. See
 * `product-grid-section.tsx` for the full rationale (T-04-15).
 */
const TILE_DERIVATIVE = "card.webp";

/**
 * A courtesy copy of the reveal combination — see the identical note in
 * `product-grid-section.tsx` for why it cannot be re-used from `reveal.tsx`
 * across the client boundary.
 */
const TILE_ENTER =
  "animate-in fade-in slide-in-from-bottom-4 fill-mode-both " +
  "ease-[var(--motion-ease)] animation-duration-[var(--motion-reveal)]";

/**
 * 05-UI-SPEC.md § `product-grid` variant `showcase`: capped at 3, not
 * `grid`'s 7 — fewer, larger tiles fit per row before scrolling.
 */
const MAX_STAGGER_INDEX = 3;

export function ProductGridShowcase({
  settings,
  data,
}: {
  readonly settings: Extract<
    SectionInstance,
    { type: "product-grid" }
  >["settings"];
  readonly data: StorefrontRenderData;
}): ReactElement {
  const visible = data.products.slice(0, settings.itemCount);

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 md:px-8 md:py-24">
      <Reveal>
        <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
          {/* Heading role: 24→32px / 600 / 1.2. */}
          <h2 className="text-2xl leading-tight font-semibold tracking-tight text-foreground md:text-[32px]">
            {settings.heading}
          </h2>

          {/* One of the accent's four permitted uses (04-UI-SPEC.md § Color). */}
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

      {/* D-06, inherited from Phase 3/4: chips appear only from two categories up. */}
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
        /* Unchanged from `grid`'s in-section zero-products block. */
        <div className="mt-8 rounded border border-dashed border-border p-8 text-center">
          <p className="text-2xl leading-tight font-semibold tracking-tight text-foreground">
            {strings.storefront.emptyHeading}
          </p>
          <p className="mx-auto mt-2 max-w-prose text-base leading-[1.6] font-normal text-muted-foreground">
            {strings.storefront.emptyBody}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 md:gap-12">
          {visible.map((product, index) => (
            <Link
              key={product.id}
              href={`/p/${product.slug}`}
              className={cn("group flex flex-col", TILE_ENTER)}
              style={{
                animationDelay: `calc(var(--motion-stagger) * ${Math.min(index, MAX_STAGGER_INDEX)})`,
              }}
            >
              {/* Unchanged site-wide product aspect — `showcase` does not get a new crop. */}
              <div className="relative aspect-[4/5] overflow-hidden rounded bg-muted">
                {product.imageKey ? (
                  <Image
                    src={`${data.imageBaseUrl}/${product.imageKey}/${TILE_DERIVATIVE}`}
                    alt={product.name}
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className={cn(
                      "object-cover",
                      "transition-transform duration-[var(--motion-hover)] ease-[var(--motion-ease)] group-hover:scale-105",
                      !product.inStock && "opacity-60",
                    )}
                  />
                ) : (
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

              {/* Body 16/400, two-line clamp — same as `grid`. */}
              <p className="mt-4 line-clamp-2 text-base leading-normal font-normal text-foreground">
                {product.name}
              </p>

              {/*
               * A small rule, deliberately echoing `hero:stack`'s divider so
               * the quiet editorial language is consistent across variants
               * that use it (05-UI-SPEC.md § New Variant Contracts).
               */}
              <div className="mt-2 h-px w-8 bg-border" aria-hidden="true" />

              {/* Below the rule, not beside the name — the `showcase` signal. */}
              <p className="mt-2 text-base leading-normal font-semibold tabular-nums text-foreground">
                {currency.format(product.priceXaf)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
