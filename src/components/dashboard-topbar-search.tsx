"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { OrderStateChip } from "@/components/order-state-chip";
import {
  Combobox,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { usePlatformIsMac } from "@/hooks/use-platform-is-mac";
import { strings } from "@/lib/strings";
import { searchMerchantSurfaceAction } from "@/server/search/actions";

import { formatXaf } from "@/app/(dashboard)/dashboard/orders/format";

/**
 * Quick task 260906-egn — the real Cmd/Ctrl+K search modal over the
 * merchant's own Products and Orders, replacing quick task 260903-ugl's
 * decorative box.
 *
 * ---------------------------------------------------------------------------
 * PREVIOUSLY: "Deliberately a Server Component — there is no state, no
 * onChange, no keydown listener." NONE OF THAT IS TRUE ANY MORE.
 * ---------------------------------------------------------------------------
 * This module is now `"use client"`. It owns the modal's open state, the
 * debounced query, a global keydown listener, and calls
 * `searchMerchantSurfaceAction` (`@/server/search/actions`) on every settled
 * keystroke. The collapsed trigger kept its visual treatment (muted rounded
 * box, `Search` icon, `Kbd` hint, hidden below `sm`) but is now a `<button>`
 * rather than a bare `Input` — clicking it, or pressing Cmd/Ctrl+K anywhere in
 * the dashboard, opens the modal.
 *
 * ---------------------------------------------------------------------------
 * PLATFORM-AWARE SHORTCUT HINT, HYDRATION-SAFE.
 * ---------------------------------------------------------------------------
 * The server always renders the Windows/Linux glyph — CLAUDE.md names this
 * market's hardware as Windows-majority, so that is the correct default, and
 * the Mac glyph is the exception. `usePlatformIsMac()`
 * (`@/hooks/use-platform-is-mac`) swaps it post-hydration on a real Mac.
 * That hook is a `useSyncExternalStore` gate, the same primitive
 * `src/hooks/use-mobile.ts` already established for this exact class of
 * problem (a value that only exists on the client and must not cause a
 * hydration mismatch) — not a `useEffect` + `setState`, because this
 * project's `react-hooks/set-state-in-effect` lint rule runs at
 * `--max-warnings=0` and rejects a synchronous `setState` seeded inside an
 * effect body. `navigator` is therefore never read outside that hook.
 *
 * The keyboard listener itself checks BOTH `metaKey` and `ctrlKey` — never
 * Meta-only — so Ctrl+K works on the Windows/Linux hardware this hint
 * defaults to, and Cmd+K works on a Mac.
 *
 * ---------------------------------------------------------------------------
 * WHY THE DEBOUNCED FETCH INSIDE `useEffect` DOES NOT TRIP THE SAME LINT RULE.
 * ---------------------------------------------------------------------------
 * `react-hooks/set-state-in-effect` rejects `setState` called SYNCHRONOUSLY in
 * an effect body; it is the documented, sanctioned shape for an effect to call
 * `setState` inside a callback once an external event (here, a `setTimeout`
 * firing after the debounce window, or the search action's response arriving)
 * has actually happened. Every `setState` below runs inside such a callback.
 *
 * ---------------------------------------------------------------------------
 * SELECTING A RESULT NAVIGATES; THE COMBOBOX ITSELF NEVER RETAINS A "VALUE".
 * ---------------------------------------------------------------------------
 * This is a command-palette use of the combobox primitive, not a form field:
 * there is nothing for the dashboard to remember about which result was
 * picked once the merchant has been sent to that product or order's own page.
 * `onValueChange` is used purely as a "the merchant chose this" event.
 */

const SEARCH_DEBOUNCE_MS = 220;

type SearchActionResult = Awaited<
  ReturnType<typeof searchMerchantSurfaceAction>
>;
type SearchSuccess = Extract<SearchActionResult, { ok: true }>;
type ProductHit = SearchSuccess["products"][number];
type OrderHit = SearchSuccess["orders"][number];

interface ProductResultItem {
  readonly kind: "product";
  readonly value: string;
  readonly label: string;
  readonly href: string;
  readonly hit: ProductHit;
}

interface OrderResultItem {
  readonly kind: "order";
  readonly value: string;
  readonly label: string;
  readonly href: string;
  readonly hit: OrderHit;
}

type ResultItem = ProductResultItem | OrderResultItem;

function toResultGroups(
  result: SearchSuccess | null,
): readonly { readonly label: string; readonly items: readonly ResultItem[] }[] {
  if (!result) return [];

  const products: ResultItem[] = result.products.map((hit) => ({
    kind: "product",
    value: `product:${hit.id}`,
    label: hit.name,
    href: `/dashboard/products/${hit.id}`,
    hit,
  }));

  const orders: ResultItem[] = result.orders.map((hit) => ({
    kind: "order",
    value: `order:${hit.id}`,
    label: hit.orderNumber,
    href: `/dashboard/orders/${hit.id}`,
    hit,
  }));

  return [
    { label: strings.dashboard.topbar.groupProducts, items: products },
    { label: strings.dashboard.topbar.groupOrders, items: orders },
  ].filter((group) => group.items.length > 0);
}

function DashboardTopbarSearch() {
  const router = useRouter();
  const isMac = usePlatformIsMac();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchSuccess | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Platform-aware Cmd/Ctrl+K, reachable from anywhere in the dashboard.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounced fetch. Cleared and reset whenever the modal closes or the query
  // empties, so reopening never briefly flashes a stale result set.
  //
  // The empty-query reset lives in `handleInputValueChange` below, NOT here:
  // `react-hooks/set-state-in-effect` (`--max-warnings=0`) rejects a `setState`
  // called synchronously in an effect body, and clearing state the instant the
  // input empties is exactly that shape. Doing it in the change handler
  // instead is a `setState` in direct response to a user event, which the
  // rule has no objection to — this effect's own `setState` calls are all
  // inside the `setTimeout` callback below, which is the sanctioned "callback
  // fires once an external event has happened" shape.
  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (trimmed.length === 0) return;

    const timer = setTimeout(() => {
      void (async () => {
        const response = await searchMerchantSurfaceAction({ q: trimmed });
        if (response.ok) {
          setResult(response);
          setErrorMessage(null);
        } else {
          setResult(null);
          setErrorMessage(response.error.form?.[0] ?? null);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, open]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setResult(null);
      setErrorMessage(null);
    }
  }

  function handleInputValueChange(value: string) {
    setQuery(value);
    // Clearing here, in direct response to the keystroke that emptied the
    // field, rather than in the debounce effect above — see that effect's
    // header comment for why the lint rule cares about the distinction.
    if (value.trim().length === 0) {
      setResult(null);
      setErrorMessage(null);
    }
  }

  const groups = toResultGroups(result);
  const shortcutHint = isMac
    ? strings.dashboard.topbar.searchShortcutHintMac
    : strings.dashboard.topbar.searchShortcutHintWindows;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={strings.dashboard.topbar.searchAriaLabel}
        className="hidden min-h-11 flex-1 items-center sm:flex"
      >
        <span className="mx-auto flex h-8 w-full max-w-md items-center gap-2 rounded-lg bg-muted px-2.5 text-left">
          <Search aria-hidden="true" className="size-4 text-muted-foreground" />
          <span className="flex-1 text-sm leading-normal font-normal text-muted-foreground">
            {strings.dashboard.topbar.searchPlaceholder}
          </span>
          <Kbd aria-hidden="true">{shortcutHint}</Kbd>
        </span>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="top-[20%] max-w-lg translate-y-0 gap-0 p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">
            {strings.dashboard.topbar.modalTitle}
          </DialogTitle>

          <Combobox<ResultItem>
            inline
            open={open}
            onOpenChange={handleOpenChange}
            items={groups}
            filter={null}
            inputValue={query}
            onInputValueChange={handleInputValueChange}
            onValueChange={(item) => {
              if (!item) return;
              handleOpenChange(false);
              router.push(item.href);
            }}
          >
            <ComboboxInput
              autoFocus
              showTrigger={false}
              placeholder={strings.dashboard.topbar.modalPlaceholder}
              aria-label={strings.dashboard.topbar.modalPlaceholder}
              className="h-12 rounded-none border-0 border-b border-border px-4"
            />

            <ComboboxEmpty className="px-4 py-6">
              {errorMessage ?? strings.dashboard.topbar.modalEmpty}
            </ComboboxEmpty>

            <ComboboxList className="p-2">
              {(group: { label: string; items: readonly ResultItem[] }) => (
                <ComboboxGroup key={group.label} items={group.items}>
                  <ComboboxLabel>{group.label}</ComboboxLabel>
                  <ComboboxCollection>
                    {(item: ResultItem) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.kind === "product" ? (
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="truncate">{item.hit.name}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {formatXaf(item.hit.basePriceXaf)}
                            </span>
                          </span>
                        ) : (
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate font-mono text-sm font-semibold">
                                {item.hit.orderNumber}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {item.hit.customerName}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="tabular-nums text-muted-foreground">
                                {formatXaf(item.hit.totalXaf)}
                              </span>
                              <OrderStateChip
                                channel={item.hit.channel}
                                state={item.hit.state}
                              />
                            </span>
                          </span>
                        )}
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxGroup>
              )}
            </ComboboxList>
          </Combobox>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { DashboardTopbarSearch };
