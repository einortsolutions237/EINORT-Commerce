import * as React from "react";

/**
 * Quick task 260906-egn. Extracted from `theme-toggle.tsx`'s hydration gate so
 * `dashboard-topbar-search.tsx`'s platform-detection gate (same task) can
 * share it rather than re-deriving the same primitive twice.
 *
 * `useSyncExternalStore`, not `useEffect` + `setState`, for the same reason
 * `src/hooks/use-mobile.ts` already documents: this project's ESLint gate runs
 * `react-hooks/set-state-in-effect` at `--max-warnings=0`, and seeding a
 * "have we mounted yet" flag with a synchronous `setState` inside a `useEffect`
 * is exactly the cascading-render shape that rule rejects. `useSyncExternalStore`
 * reads the current value during render instead of after it: the server
 * snapshot is `false` (nothing has mounted on the server), the client snapshot
 * is `true`, and React reconciles the difference as part of its normal
 * post-hydration pass rather than as a second, hook-triggered render.
 *
 * The store never actually changes after mount, so `subscribe` has nothing to
 * listen for — it exists only to satisfy the hook's contract, and returns a
 * no-op unsubscribe.
 */
function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): boolean {
  return true;
}

/** No client has mounted yet on the server; the SSR snapshot is always `false`. */
function getServerSnapshot(): boolean {
  return false;
}

/** `true` once the component has hydrated on the client, `false` before. */
export function useMounted(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
