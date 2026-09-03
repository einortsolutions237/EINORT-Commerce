import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { strings } from "@/lib/strings"

/**
 * Quick task 260903-ugl, CONTEXT.md's locked decision #3: a visual-only
 * top-bar search box. Deliberately a Server Component — there is no state,
 * no `onChange`, no keydown listener, and nothing to wire up. The `Input`
 * stays real and focusable (not `disabled`) so it matches Shopify's admin
 * look, but no value handler exists anywhere in this diff.
 *
 * Hidden below `sm` on purpose: the header is already full at that width
 * (sidebar trigger, store name, sign-out control).
 */
function DashboardTopbarSearch() {
  return (
    <div className="hidden flex-1 sm:block">
      <div className="relative mx-auto w-full max-w-md">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          placeholder={strings.dashboard.topbar.searchPlaceholder}
          aria-label={strings.dashboard.topbar.searchAriaLabel}
          className="h-8 rounded-lg bg-muted pr-12 pl-8"
        />
        <Kbd
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2"
        >
          {strings.dashboard.topbar.searchShortcutHint}
        </Kbd>
      </div>
    </div>
  )
}

export { DashboardTopbarSearch }
