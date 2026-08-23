import Link from "next/link";

import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";

/**
 * Root-domain placeholder (D-06).
 *
 * This is deliberately NOT a marketing site — that is future scope with its own
 * phase. Exactly three elements ship here: the wordmark, one line of copy, and a
 * single primary call to action. Per 01-UI-SPEC.md this page must not link to
 * the sign-in surface (Phase 2 owns it) nor to any help channel (none exists).
 *
 * Spacing uses only declared scale tokens: py-16 = 3xl (64px) page padding,
 * px-8 = xl (32px) gutter, mt-4 = md (16px), mt-8 = xl (32px).
 */
export default function RootPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-8 py-16">
      <div className="flex max-w-prose flex-col items-center text-center">
        {/* Display role: 36px / 600 / 1.1 */}
        <h1 className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight text-foreground">
          {strings.root.wordmark}
        </h1>

        {/* Body role: 16px / 400 / 1.5 */}
        <p className="mt-4 text-base leading-normal font-normal text-muted-foreground">
          {strings.root.tagline}
        </p>

        {/*
         * One primary button per page, never two. `min-h-11` enforces the 44px
         * touch-target floor — non-negotiable for this mobile-first, low-end
         * Android market.
         */}
        <Button
          render={<Link href="/signup" />}
          className="mt-8 min-h-11 px-6 text-sm font-semibold"
        >
          {strings.root.cta}
        </Button>
      </div>
    </main>
  );
}
