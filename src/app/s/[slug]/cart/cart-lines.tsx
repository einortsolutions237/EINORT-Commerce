"use client";

import { useState, useTransition } from "react";
import { ImageOffIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import Image from "next/image";

import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { removeCartLine, setCartQuantity } from "@/server/cart/actions";

/**
 * The B3 line list — the one interactive part of the cart.
 *
 * ---------------------------------------------------------------------------
 * EVERY FIGURE HERE ARRIVED AS A FORMATTED STRING. NOTHING IS COMPUTED.
 * ---------------------------------------------------------------------------
 * `unitPrice` is text, not a number, and there is deliberately no line total in
 * this component's props at all: the summary block on the page above owns the
 * arithmetic and it does it on the server. A client component that could add up
 * money is a client component that could be made to add it up differently, and
 * the whole point of TEN-08 is that the browser is never a party to the amount.
 *
 * ---------------------------------------------------------------------------
 * OPTIMISTIC, AND ONLY BECAUSE THIS IS ONE OF THE THREE PLACES IT IS ALLOWED.
 * ---------------------------------------------------------------------------
 * 03-UI-SPEC.md § Interaction & State Contract permits an optimistic update for
 * cart quantity and cart removal — the change is cheap, reversible, and the
 * shopper is looking straight at it. (Placing an order is explicitly NOT in
 * that list, and the checkout form waits.) The override below is applied
 * immediately, then DROPPED once the action resolves, so the server's value —
 * which may have clamped the request against live stock — is what the shopper
 * ends up reading. Dropping rather than keeping is the important half: an
 * override that outlived its action would let the browser display a quantity
 * the server never agreed to.
 */

export type CartLineView = {
  variantId: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  /** Already formatted by the server. */
  unitPrice: string;
  availableStock: number;
  adjustment: "none" | "clamped" | "unavailable";
  imageUrl: string | null;
};

export function CartLines({
  slug,
  lines,
}: {
  slug: string;
  lines: CartLineView[];
}) {
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function clearOverride(variantId: string): void {
    setOverrides((current) => {
      const next = { ...current };
      delete next[variantId];
      return next;
    });
  }

  function changeQuantity(variantId: string, quantity: number): void {
    setOverrides((current) => ({ ...current, [variantId]: quantity }));

    startTransition(async () => {
      await setCartQuantity({ slug, variantId, quantity });
      // Whatever the outcome, the server's rendering is now authoritative: on
      // success it carries the new quantity, and on refusal it still carries
      // the old one, which is exactly the revert.
      clearOverride(variantId);
    });
  }

  function remove(variantId: string): void {
    setRemoved((current) => [...current, variantId]);

    startTransition(async () => {
      const result = await removeCartLine({ slug, variantId });
      if (!result.ok) {
        setRemoved((current) => current.filter((id) => id !== variantId));
      }
    });
  }

  return (
    <ul className="mt-4">
      {lines
        .filter((line) => !removed.includes(line.variantId))
        .map((line) => {
          const quantity = overrides[line.variantId] ?? line.quantity;
          const isGone = line.adjustment === "unavailable";

          return (
            <li
              key={line.variantId}
              className="flex gap-3 border-t border-border py-4 first:border-t-0 first:pt-0"
            >
              <div className="relative size-16 shrink-0 overflow-hidden rounded bg-muted">
                {line.imageUrl ? (
                  <Image
                    src={line.imageUrl}
                    alt={line.productName}
                    fill
                    sizes="64px"
                    className={cn("object-cover", isGone && "opacity-60")}
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    aria-hidden="true"
                  >
                    <ImageOffIcon className="size-5 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {/* Body role. */}
                    <p className="text-base leading-relaxed font-normal text-foreground">
                      {line.productName}
                    </p>

                    {/* Label role, `--muted-foreground`. Empty for D-05's
                        no-options product, whose single variant has nothing to
                        distinguish — so the row is simply not rendered. */}
                    {line.variantLabel !== "" && (
                      <p className="text-sm leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                        {line.variantLabel}
                      </p>
                    )}

                    {!isGone && (
                      <p className="mt-1 text-base leading-relaxed font-normal tabular-nums text-foreground">
                        {line.unitPrice}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(line.variantId)}
                    disabled={pending}
                    aria-label="Remove"
                    className="flex size-11 shrink-0 items-center justify-center rounded text-foreground hover:bg-muted disabled:opacity-40"
                  >
                    <XIcon className="size-4" aria-hidden="true" />
                  </button>
                </div>

                {!isGone && (
                  <div className="mt-2 flex w-fit items-center rounded border border-border">
                    <button
                      type="button"
                      onClick={() =>
                        changeQuantity(line.variantId, Math.max(1, quantity - 1))
                      }
                      disabled={pending || quantity <= 1}
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
                        changeQuantity(
                          line.variantId,
                          Math.min(line.availableStock, quantity + 1),
                        )
                      }
                      disabled={pending || quantity >= line.availableStock}
                      aria-label="Increase quantity"
                      className="flex size-11 items-center justify-center text-foreground disabled:opacity-40"
                    >
                      <PlusIcon className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )}

                {/*
                 * Both notes are PAGE STATE on the affected line, never a
                 * toast: the shopper may arrive on this page minutes after the
                 * change happened, and a notification that has already
                 * dismissed itself cannot explain a number that moved. Neither
                 * blocks checkout — the server re-derives price and stock at
                 * placement regardless of what this page said.
                 */}
                {line.adjustment === "clamped" && (
                  <p className="mt-2 rounded bg-muted px-3 py-2 text-base leading-relaxed font-normal text-muted-foreground">
                    {strings.cart.quantityReduced.replace(
                      "{n}",
                      String(line.availableStock),
                    )}
                  </p>
                )}

                {isGone && (
                  <p className="mt-2 rounded bg-muted px-3 py-2 text-base leading-relaxed font-normal text-muted-foreground">
                    {strings.cart.itemUnavailable.replace(
                      "{name}",
                      line.productName,
                    )}
                  </p>
                )}
              </div>
            </li>
          );
        })}
    </ul>
  );
}
