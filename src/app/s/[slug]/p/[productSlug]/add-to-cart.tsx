"use client";

import { useMemo, useState, useTransition } from "react";
import { ImageOffIcon, MinusIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { addToCart } from "@/server/cart/actions";
import type { StorefrontVariant } from "@/server/storefront/queries";

/**
 * The B2 gallery and the add-to-cart island — the client half of the product
 * page. Every price and stock number rendered here came from the server as
 * props; this file computes nothing about money beyond re-displaying the
 * selected variant's server-supplied price and re-formatting it.
 *
 * Two components, one file, because the plan declares exactly this file for
 * the PDP's client-interactive surface: `Gallery` owns the hero/thumbnail
 * selection, `AddToCart` owns variant selection, quantity and the CTA. They
 * are independent — `page.tsx` composes them either side of the product name
 * — and share nothing but the module's currency formatter.
 */

const currency = new Intl.NumberFormat("fr-CM", {
  style: "currency",
  currency: "XAF",
  maximumFractionDigits: 0,
});

// ---------------------------------------------------------------------------
// Gallery (D-10)
// ---------------------------------------------------------------------------

export function Gallery({
  productName,
  images,
}: {
  productName: string;
  images: { detailUrl: string; thumbUrl: string }[];
}) {
  const [selected, setSelected] = useState(0);
  const hero = images[selected];

  return (
    <div className="lg:sticky lg:top-20 lg:w-1/2 lg:shrink-0">
      <div className="relative aspect-square w-full overflow-hidden rounded bg-muted">
        {hero ? (
          <Image
            src={hero.detailUrl}
            alt={productName}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            priority
            className="object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            aria-hidden="true"
          >
            <ImageOffIcon className="size-10 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Single-image products render no strip. */}
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.thumbUrl}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`${productName} ${index + 1}`}
              aria-current={index === selected}
              className={cn(
                "relative size-14 shrink-0 overflow-hidden rounded",
                index === selected
                  ? "ring-2 ring-foreground"
                  : "ring-1 ring-border",
              )}
            >
              <Image
                src={image.thumbUrl}
                alt=""
                fill
                sizes="56px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddToCart (D-05 variant pickers, D-09 CTA rule)
// ---------------------------------------------------------------------------

function distinctValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

function AxisRow({
  label,
  values,
  selected,
  isDisabled,
  onSelect,
}: {
  label: string;
  values: string[];
  selected: string | null;
  isDisabled: (value: string) => boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => {
          const disabled = isDisabled(value);
          const isSelected = selected === value;
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              aria-disabled={disabled}
              onClick={() => onSelect(value)}
              className={cn(
                "min-h-11 rounded border border-border px-3 text-sm leading-snug font-semibold",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground",
                disabled &&
                  "text-muted-foreground line-through decoration-1 opacity-60",
              )}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AddToCart({
  slug,
  option1Name,
  option2Name,
  variants,
}: {
  slug: string;
  option1Name: string | null;
  option2Name: string | null;
  variants: StorefrontVariant[];
}) {
  const hasAxis1 = option1Name !== null;
  const hasAxis2 = option2Name !== null;

  const router = useRouter();
  const [option1, setOption1] = useState<string | null>(null);
  const [option2, setOption2] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();

  // The no-options product's single implicit `("", "")` variant — nothing to
  // choose, so it is treated as already selected.
  const singleVariant =
    !hasAxis1 && !hasAxis2 ? variants[0] : undefined;

  const axis1Values = useMemo(
    () => (hasAxis1 ? distinctValues(variants.map((v) => v.option1Value)) : []),
    [hasAxis1, variants],
  );
  const axis2Values = useMemo(
    () => (hasAxis2 ? distinctValues(variants.map((v) => v.option2Value)) : []),
    [hasAxis2, variants],
  );

  const needsSelection =
    (hasAxis1 && option1 === null) || (hasAxis2 && option2 === null);

  const selectedVariant =
    singleVariant ??
    (needsSelection
      ? undefined
      : variants.find(
          (v) =>
            (!hasAxis1 || v.option1Value === option1) &&
            (!hasAxis2 || v.option2Value === option2),
        ));

  function isAxis1Disabled(value: string): boolean {
    return !variants.some(
      (v) =>
        v.option1Value === value &&
        (!hasAxis2 || option2 === null || v.option2Value === option2) &&
        v.stock > 0,
    );
  }

  function isAxis2Disabled(value: string): boolean {
    return !variants.some(
      (v) =>
        v.option2Value === value &&
        (!hasAxis1 || option1 === null || v.option1Value === option1) &&
        v.stock > 0,
    );
  }

  const displayPriceXaf =
    selectedVariant?.priceXaf ?? Math.min(...variants.map((v) => v.priceXaf));

  const outOfStock = selectedVariant !== undefined && selectedVariant.stock <= 0;

  function stockLabel(): string | null {
    if (!selectedVariant) return null;
    if (selectedVariant.stock <= 0) return strings.catalog.outOfStock;
    if (selectedVariant.stock <= 5) {
      return strings.catalog.lowStock.replace(
        "{n}",
        String(selectedVariant.stock),
      );
    }
    return strings.catalog.inStock;
  }

  function ctaLabel(): string {
    if (needsSelection) return strings.catalog.chooseAnOption;
    if (outOfStock) return strings.catalog.outOfStock;
    return strings.catalog.addToCart;
  }

  // D-09: the button is disabled, never hidden. `pending` only disables it
  // for the duration of the in-flight action — the label itself never
  // changes to a submitting variant, because the toast is the confirmation.
  const ctaDisabled = needsSelection || !selectedVariant || outOfStock || pending;

  function handleAdd() {
    if (!selectedVariant) return;
    const variantId = selectedVariant.id;

    startTransition(async () => {
      const result = await addToCart({ slug, variantId, quantity });

      if (result.ok) {
        toast.success(strings.catalog.addedToast, {
          action: {
            label: strings.catalog.addedToastAction,
            onClick: () => {
              router.push(`/s/${slug}/cart`);
            },
          },
        });
      } else {
        toast.error(strings.catalog.outOfStock);
      }
    });
  }

  const stepperMax = selectedVariant?.stock ?? 0;

  return (
    <div className="mt-4 flex flex-col gap-6">
      <p className="text-2xl leading-tight font-semibold tabular-nums text-foreground">
        {currency.format(displayPriceXaf)}
      </p>

      {hasAxis1 && option1Name && (
        <AxisRow
          label={option1Name}
          values={axis1Values}
          selected={option1}
          isDisabled={isAxis1Disabled}
          onSelect={setOption1}
        />
      )}

      {hasAxis2 && option2Name && (
        <AxisRow
          label={option2Name}
          values={axis2Values}
          selected={option2}
          isDisabled={isAxis2Disabled}
          onSelect={setOption2}
        />
      )}

      {stockLabel() && (
        <p
          role="status"
          aria-live="polite"
          className="text-sm leading-snug font-semibold text-muted-foreground"
        >
          {stockLabel()}
        </p>
      )}

      <div className="flex items-center gap-1 self-start rounded border border-border">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={quantity <= 1}
          aria-label="Decrease quantity"
          className="flex size-11 items-center justify-center text-foreground disabled:opacity-40"
        >
          <MinusIcon className="size-4" aria-hidden="true" />
        </button>
        <span className="w-8 text-center text-base leading-normal font-semibold tabular-nums text-foreground">
          {quantity}
        </span>
        <button
          type="button"
          onClick={() =>
            setQuantity((q) => Math.min(Math.max(stepperMax, 1), q + 1))
          }
          disabled={!selectedVariant || quantity >= stepperMax}
          aria-label="Increase quantity"
          className="flex size-11 items-center justify-center text-foreground disabled:opacity-40"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
        </button>
      </div>

      <Button
        type="button"
        onClick={handleAdd}
        disabled={ctaDisabled}
        className="h-12 min-h-12 w-full text-base"
      >
        {ctaLabel()}
      </Button>
    </div>
  );
}
