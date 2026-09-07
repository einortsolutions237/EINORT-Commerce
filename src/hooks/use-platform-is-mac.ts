import * as React from "react";

/**
 * Quick task 260906-egn — the search modal's platform-aware Cmd/Ctrl+K hint.
 *
 * Same `useSyncExternalStore` shape as `src/hooks/use-mobile.ts` and
 * `src/hooks/use-mounted.ts`, for the same reason: `navigator` does not exist
 * during SSR, and this project's `react-hooks/set-state-in-effect` lint rule
 * (`--max-warnings=0`) rejects the more obvious
 * `useEffect(() => setIsMac(detect()), [])` seeding pattern. The server
 * snapshot is `false` — CLAUDE.md names Cameroon/Windows-majority hardware as
 * this product's market, so the Windows/Linux glyph is the correct default
 * for every render up to and including hydration, and the Mac glyph is the
 * exception that appears only once the client snapshot has actually run.
 *
 * `navigator.userAgentData?.platform` is checked first (the modern,
 * non-deprecated API, unavailable in Safari/Firefox as of this writing) with
 * a `navigator.userAgent` regex fallback. `navigator.platform` is not used —
 * it is a formally deprecated API.
 */
function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): boolean {
  const uaDataPlatform = (
    navigator as Navigator & {
      userAgentData?: { platform?: string };
    }
  ).userAgentData?.platform;
  return /Mac|iPhone|iPad/.test(uaDataPlatform ?? navigator.userAgent);
}

/** No `navigator` on the server; the Windows/Linux hint is always the SSR default. */
function getServerSnapshot(): boolean {
  return false;
}

/** `true` once the client has confirmed a Mac-family platform, `false` otherwise. */
export function usePlatformIsMac(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
