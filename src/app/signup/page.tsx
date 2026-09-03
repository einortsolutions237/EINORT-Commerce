import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import einortLogo from "@/assets/brand/einort-logo.png";
import { Card, CardContent } from "@/components/ui/card";
import { BRAND, strings } from "@/lib/strings";

import { SignupForm } from "./signup-form";

/**
 * `/signup` — the only real form in Phase 1 (ONB-01).
 *
 * Served from the root domain, not an `app.` subdomain (D-07). That is not
 * cosmetic: keeping every authenticated surface on the apex is what lets the
 * session cookie stay host-only, so a stored XSS in any merchant's storefront
 * cannot reach a platform session (T-01-44).
 *
 * A server component wrapping one client island. Nothing here needs
 * interactivity, so the heading, the sub-line and the card ship as HTML and the
 * merchant sees the page before the form's JavaScript arrives — which matters
 * on the low-end Android this market runs on.
 */

export const metadata: Metadata = {
  // Renders as "Create your store · EINORT" via the root layout's template.
  title: strings.signup.title,
};

export default function SignupPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16 sm:px-8">
      {/*
       * Single column, max-w-md (448px), centered. Never two columns — the
       * layout is designed at 360px first and widened, not the reverse.
       */}
      <div className="w-full max-w-md">
        <Image src={einortLogo} alt={BRAND} className="mb-6 h-9 w-auto" priority />

        {/* Heading role: 24px / 600 / 1.2 */}
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.signup.heading}
        </h1>

        {/* Body role: 16px / 400 / 1.5 */}
        <p className="mt-2 text-base leading-normal font-normal text-muted-foreground">
          {strings.signup.subline}
        </p>

        {/*
         * --muted fill with a --border hairline and rounded-lg, per
         * 01-UI-SPEC.md § Layout. The shadcn defaults (bg-card, a ring, and
         * rounded-xl) are overridden rather than re-authored so the component
         * stays upgradable. Card inner padding is md (16px) on mobile and lg
         * (24px) from the sm breakpoint, both declared scale values.
         */}
        <Card className="mt-8 rounded-lg border border-border bg-muted ring-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
          <CardContent>
            <SignupForm />
          </CardContent>
        </Card>

        {/*
         * The only change to /signup in this phase (02-04): the sign-in
         * cross-link. Below the card, Body role, --foreground + underline.
         */}
        <p className="mt-6 text-base leading-normal font-normal text-muted-foreground">
          <Link
            href="/login"
            className="text-foreground underline underline-offset-3"
          >
            {strings.signup.loginLink}
          </Link>
        </p>
      </div>
    </main>
  );
}
