import * as React from "react"

/**
 * `lg`, not the registry's `md`.
 *
 * The only consumer of this hook is the sidebar shell, and 03-UI-SPEC.md
 * § A. Navigation Shell fixes that shell's breakpoint at 1024px: the rail is
 * visible at `lg` and above, and below it the rail is replaced by an off-canvas
 * sheet opened from the header trigger. At the registry's 768px a 900px-wide
 * tablet would render a 256px rail beside content that has no room for it.
 *
 * The two hardcoded `lg:` utilities in `src/components/ui/sidebar.tsx` (the
 * wrapper's `lg:block` and the container's `lg:flex`) are the CSS half of this
 * same decision and must move together with it — a mismatch between the media
 * query the JS reads and the one the CSS applies renders both the rail and the
 * sheet trigger in the gap between them.
 */
const MOBILE_BREAKPOINT = 1024
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Rewritten from the shadcn registry's `use-mobile` to satisfy this project's
 * ESLint gate, which runs `react-hooks/set-state-in-effect` at
 * `--max-warnings=0`.
 *
 * The registry version subscribes with `useEffect` and then calls `setIsMobile`
 * synchronously in the effect body to seed the first value. That is exactly the
 * cascading-render pattern the React Compiler lint rule rejects: the component
 * renders once with `undefined`, the effect fires, state changes, and it renders
 * again — so the sidebar mounts desktop-shaped and snaps to the mobile sheet on
 * the frame after hydration.
 *
 * `useSyncExternalStore` is the sanctioned primitive for this shape: it reads
 * the current value during render instead of after it, so there is no seeding
 * setState and no second render. The third argument is the server snapshot,
 * required because this hook renders under SSR — returning `false` there means
 * the server markup is the desktop layout, matching the registry's
 * `!!undefined` behaviour and keeping hydration consistent.
 *
 * If a future `shadcn add sidebar` overwrites this file, this whole
 * implementation is the diff to re-apply — the exported name and return type
 * are unchanged, so no call site needs to move.
 */

function subscribe(onStoreChange: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches
}

/** No `window` on the server; the desktop layout is the SSR default. */
function getServerSnapshot(): boolean {
  return false
}

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
