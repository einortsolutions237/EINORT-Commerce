import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Deliberate overrides of the official registry defaults, applied in place
 * rather than re-authored so the component stays upgradable (the same
 * discipline `src/app/signup/page.tsx` applies to `card`):
 *
 * Base class (02-UI-SPEC.md § Typography):
 *   - `text-sm font-semibold` replaces the registry's `text-xs font-medium`.
 *     `Most Popular` on the plan screen is a **Label** role in the type scale
 *     (14px / 600), not caption text.
 *   - `h-6` replaces `h-5`, because the Label line-height no longer fits a
 *     20px box and the badge would clip its own text.
 *
 * Three added variants (03-UI-SPEC.md § A. Order-State Display Contract), for
 * the merchant order-state chips. All three are Surface A only — the storefront
 * scope deliberately does not declare `--gold-accent` or `--success`, and ban #3
 * in `tests/unit/surface-token-isolation.test.ts` fails the build if one of
 * these appears under `src/app/s/**`:
 *   - `gold`            — `PAYMENT_CLAIMED` / `Payment claimed`. Gold at 15%
 *                         fill, gold-900 text. Gold is this platform's "needs
 *                         your attention" signal, not a success signal.
 *   - `success`         — `CONFIRMED` / `Confirmed`. Emerald at 10% fill,
 *                         emerald text.
 *   - `outline-success` — `FULFILLED` / `Fulfilled`. Transparent fill, emerald
 *                         border and text. Emerald appears twice by design:
 *                         filled = "confirmed", outlined = "done and settled" —
 *                         same family, further along.
 * Each mirrors the `destructive` variant's shape (tinted fill + same-hue text +
 * a one-step-stronger hover) rather than inventing a new one, so the set stays
 * visually coherent.
 *
 * Nothing else is changed. If a future `shadcn add badge` overwrites this file,
 * the two base tokens above plus these three variant rows are the whole diff to
 * re-apply.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-sm font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        gold: "bg-gold-accent/15 text-gold-accent-foreground [a]:hover:bg-gold-accent/25",
        success: "bg-success/10 text-success [a]:hover:bg-success/20",
        "outline-success":
          "border-success text-success [a]:hover:bg-success/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
