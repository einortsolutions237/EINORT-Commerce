import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A small, non-interactive keyboard-shortcut chip (e.g. "⌘K"). Purely
 * decorative: it renders beside the dashboard top-bar's non-functional
 * search input (quick task 260903-ugl, `dashboard-topbar-search.tsx`) and
 * carries no keydown listener anywhere in this codebase. A future task that
 * wires up real search may reuse it as-is.
 *
 * Satisfies the `data-slot="kbd"` selectors `tooltip.tsx` already carries
 * (`has-data-[slot=kbd]:pr-1.5`, `**:data-[slot=kbd]:...`).
 */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 items-center justify-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground select-none",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
