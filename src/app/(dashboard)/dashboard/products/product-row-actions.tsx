"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, MoreHorizontal, Pencil } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { strings } from "@/lib/strings";
import { setProductActive } from "@/server/catalog/actions";

/**
 * A1's row action island (D-08) — the only place `setProductActive` is called
 * from the products list, and shared by both the >=`md` table row and the
 * <`md` stacked card, exactly as the plan requires.
 *
 * ---------------------------------------------------------------------------
 * THERE IS NO DELETE ITEM HERE AND THERE NEVER WILL BE.
 * ---------------------------------------------------------------------------
 * `Edit`, `Deactivate` and `Reactivate` are the whole menu. A product is
 * referenced by the order lines of every order that ever contained it, so
 * `src/server/catalog/actions.ts` writes no hard-removal path at all — this
 * component has nothing to call even if a Delete item were added, and
 * `tests/unit/surface-token-isolation.test.ts` ban 5 fails the build if the
 * `trash`/`trash-2` icon ever appears anywhere under this route tree.
 *
 * ---------------------------------------------------------------------------
 * ONLY HIDING ASKS FIRST. BRINGING IT BACK DOES NOT.
 * ---------------------------------------------------------------------------
 * Hiding a product removes it from the storefront, so the `alert-dialog`
 * confirms with the merchant using A1's exact copy before the write happens.
 * The confirm button is deliberately the DEFAULT button variant, not
 * destructive — hiding is reversible, and colouring a reversible action red
 * teaches a merchant to fear a safe one (UI-SPEC § Destructive-action
 * register). Reactivating undoes the same field with no confirmation at all,
 * because there is nothing to warn about in bringing a product back.
 */
export function ProductRowActions({
  productId,
  productName,
  active,
}: {
  readonly productId: string;
  readonly productName: string;
  readonly active: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSetActive(nextActive: boolean) {
    setPending(true);
    // The server refusal (a stale trial, a session that expired mid-click) is
    // the same read-only gate `merchantAction({ mode: "write" })` enforces
    // everywhere else; there is nothing this row can do about a refusal
    // beyond leaving the row exactly as it was, which `router.refresh()`
    // already guarantees by re-reading the real state.
    await setProductActive({ productId, active: nextActive });
    setPending(false);
    setConfirmOpen(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 min-h-11 min-w-11"
            />
          }
        >
          <MoreHorizontal aria-hidden="true" />
          <span className="sr-only">{strings.products.columnActions}</span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={<Link href={`/dashboard/products/${productId}`} />}
          >
            <Pencil aria-hidden="true" />
            {strings.products.rowEdit}
          </DropdownMenuItem>

          {active ? (
            <DropdownMenuItem onClick={() => setConfirmOpen(true)}>
              <EyeOff aria-hidden="true" />
              {strings.products.rowDeactivate}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={pending}
              onClick={() => {
                void handleSetActive(true);
              }}
            >
              <Eye aria-hidden="true" />
              {strings.products.rowReactivate}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {strings.products.deactivateTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {strings.products.deactivateBody.replace("{name}", productName)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {strings.products.deactivateCancel}
            </AlertDialogCancel>
            {/* Default variant, on purpose — see the header comment. */}
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                void handleSetActive(false);
              }}
            >
              {strings.products.deactivateConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
