import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { strings } from "@/lib/strings";

import { SignOutButton } from "../sign-out-button";

/**
 * `/suspended` (OQ-5) — where `requireMerchantContext()` sends the owner of a
 * suspended store.
 *
 * ---------------------------------------------------------------------------
 * THIS DOES NOT WEAKEN PHASE 1'S D-05, AND MUST NOT BE MADE TO.
 * ---------------------------------------------------------------------------
 * D-05 forbids telling an ANONYMOUS visitor that a store is suspended, because
 * a visible difference between "suspended" and "never claimed" is an
 * enumeration oracle over the merchant base (T-01-29). That path is untouched
 * by this file: `/store-not-found` and `/s/[slug]/layout.tsx` both still call
 * `notFound()` and render the one branded body, byte-identical, for unknown,
 * unclaimed and suspended hostnames. Nothing here is reachable from there, and
 * no copy in `strings.suspended` may ever be reused in `strings.storeNotFound`.
 *
 * The only way to arrive here is a redirect out of the merchant DAL, which
 * fires only when a signed session's OWN active organization is the suspended
 * one. The reader is that store's owner, for whom "your store is suspended" is
 * a necessity rather than a leak — and the alternative, sending them to the
 * same anonymous not-found page, would leave the one person who can act on it
 * with no idea what happened (T-02-15).
 *
 * One message and two ways to reach a human — updated from Phase 2's "one",
 * because Phase 6 built an in-app support thread that Phase 2 could not have
 * pointed to yet. The external WhatsApp link is still here for a merchant who
 * would rather not sign back in; `strings.suspended.supportLink` now also
 * offers `/dashboard/support`, which `requireMerchantContextAllowSuspended()`
 * (`src/server/merchant/context.ts`) deliberately keeps reachable for exactly
 * this reader — the reason for the suspension already appears there as a
 * system message, and replying is how a merchant gets the discussion started
 * without leaving the product. Still no appeal form and no status detail
 * here on this page itself: the thread is where that conversation actually
 * happens now, not a form this static page would have to render.
 */

export const metadata: Metadata = {
  // "Your store is unavailable · EINORT" through the root layout's template.
  title: strings.suspended.title,
};

export default function SuspendedPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16 sm:px-8">
      {/* Single column, max-w-md, centered — identical construction to /signup. */}
      <div className="w-full max-w-md">
        {/* Heading role: 24px / 600 / 1.2 */}
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.suspended.heading}
        </h1>

        <Card className="mt-8 rounded-lg border border-border bg-muted ring-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
          <CardContent className="flex flex-col items-start gap-4">
            {/* Body role: 16px / 400 / 1.5 */}
            <p className="text-base leading-normal font-normal text-muted-foreground">
              {strings.suspended.body}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href={strings.trial.contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 text-base leading-normal font-medium text-foreground underline underline-offset-3"
              >
                {strings.suspended.cta}
                <ExternalLink aria-hidden="true" className="size-4" />
                <span className="sr-only">
                  {strings.trial.contactUrlLabel}
                </span>
              </a>

              {/*
               * `requireMerchantContextAllowSuspended()` keeps this one route
               * reachable while suspended (see its own header) — the
               * suspension reason already appears there as a system message,
               * so this is how a merchant continues that conversation without
               * leaving the product.
               */}
              <Link
                href="/dashboard/support"
                className="inline-flex min-h-11 items-center text-base leading-normal font-medium text-foreground underline underline-offset-3"
              >
                {strings.suspended.supportLink}
              </Link>

              {/*
               * The secondary action: a suspended merchant must have a way
               * out that is not the browser back button (T-02-15). Calls the
               * signOutMerchant server action; see sign-out-button.tsx.
               */}
              <SignOutButton />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
