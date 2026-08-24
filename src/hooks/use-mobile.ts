import * as React from "react"

const MOBILE_BREAKPOINT = 768
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
