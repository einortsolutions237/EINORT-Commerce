"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The flagship's one motion primitive (TMPL-02, 04-UI-SPEC.md § Motion
 * Language → `<Reveal>`).
 *
 * ---------------------------------------------------------------------------
 * THE DEFAULT STATE IS VISIBLE AND UNANIMATED. THE OBSERVER ONLY *ADDS* THE
 * ANIMATION. DO NOT "FIX" THIS BY SEEDING A ZERO-OPACITY OR HIDDEN INITIAL
 * CLASS ON THE WRAPPER.
 * ---------------------------------------------------------------------------
 * T-04-23. The obvious implementation hides the content and reveals it on
 * intersection — and then a shopper whose JavaScript failed, whose bundle was
 * blocked, or whose browser has no `IntersectionObserver` gets a blank page
 * where the storefront should be. On a Douala mid-range Android over a patchy
 * connection that is not a theoretical branch, and a storefront that renders
 * nothing is a worse outcome than a storefront that renders without a fade.
 * Motion is the enhancement; the content is the product.
 *
 * The same rule is what makes the reduced-motion branch trivially correct: we
 * do not need to "turn off" an animation, we simply never attach one, so the
 * first frame is already the final frame.
 *
 * ONE-SHOT. `unobserve()` fires on the first intersection because a section
 * that re-animates every time it scrolls back into view is a distraction, not
 * a delight — and on a page of five bands it is five distractions.
 *
 * The wrapper is a bare `<div>` with no styling of its own. It must not
 * introduce a layout box that changes the wrapped section's spacing: the band
 * dimensions in 04-UI-SPEC.md § Spacing Scale are measured on the section, and
 * a wrapper with padding would silently move all of them.
 *
 * `"use client"` is correct here and nowhere else in this directory — every
 * section component is state-free and renders from both the RSC tree and the
 * client preview canvas.
 */

/**
 * 04-UI-SPEC.md § Motion Language, "Section reveal on scroll", verbatim.
 *
 * `animate-in` fires on MOUNT, not on scroll — which is exactly why it is
 * applied only after the observer says the element has entered the viewport,
 * rather than being present from the first render with a paused state.
 */
const REVEAL_CLASSES =
  "animate-in fade-in slide-in-from-bottom-4 fill-mode-both " +
  "ease-[var(--motion-ease)] animation-duration-[var(--motion-reveal)]";

/** The observer's parameters. Fixed by the spec; not tuning knobs. */
const REVEAL_THRESHOLD = 0.1;
const REVEAL_ROOT_MARGIN = "0px 0px -10% 0px";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function Reveal({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;

    /*
     * Both bail-outs leave `revealed` false, which is the visible-and-
     * unanimated state. Neither is an error path — one is a browser without
     * the API, the other is a shopper who has asked the operating system for
     * less motion, and both are entitled to read the page.
     *
     * The reduced-motion check is deliberately read here rather than
     * subscribed to: this component's animation is a one-shot that has either
     * already played or never will, so re-running it because the OS setting
     * changed mid-scroll would be the animation the setting asked us not to
     * play.
     */
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          setRevealed(true);
        }
      },
      { threshold: REVEAL_THRESHOLD, rootMargin: REVEAL_ROOT_MARGIN },
    );

    observer.observe(node);

    // The `use-mobile.ts` idiom: whatever the effect attached, the returned
    // function detaches. `disconnect()` rather than `unobserve()` so a
    // re-render before intersection cannot leave a live observer behind.
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn(revealed && REVEAL_CLASSES, className)}>
      {children}
    </div>
  );
}
