"use client";

import { useEffect, useRef } from "react";

/**
 * 06-UI-SPEC.md § A2's "Order" row: "the view scrolls to the newest message
 * on load." The thread renders oldest-at-top per D-12 (never reversed, never
 * re-sorted — see `message-list.tsx`'s own header), so a first-time page
 * load otherwise lands the merchant at the OLDEST message rather than the
 * conversation's current point.
 *
 * An invisible marker, mounted as the LAST child of the page — after
 * `Composer` — so `scrollIntoView({ block: "end" })` carries the viewport to
 * the true bottom of the page rather than to the top of the sticky composer
 * bar. Runs once, on mount, and never again: `router.refresh()` after a
 * send does not remount this component, so an in-progress read scrolled
 * partway up the thread is never yanked back down by a later message.
 */
export function ScrollToLatest() {
  const markerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markerRef.current?.scrollIntoView({ block: "end" });
  }, []);

  return <div ref={markerRef} aria-hidden="true" />;
}
