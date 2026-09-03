import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import einortLogo from "@/assets/brand/einort-logo.png";
import { Card, CardContent } from "@/components/ui/card";
import { BRAND, strings } from "@/lib/strings";

import { LoginForm } from "./login-form";

/**
 * `/login` — TEN-04's returning-merchant entry point.
 *
 * Mirrors `src/app/signup/page.tsx` essentially whole: apex-only (D-07), so
 * the session cookie this issues stays host-only, and a server component
 * wrapping one client island so the heading and the card ship as HTML before
 * the form's JavaScript arrives.
 */

export const metadata: Metadata = {
  // Renders as "Sign in · EINORT" via the root layout's template.
  title: strings.login.title,
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16 sm:px-8">
      {/* Single column, max-w-md (448px), centered — identical to /signup. */}
      <div className="w-full max-w-md">
        <Image src={einortLogo} alt={BRAND} className="mb-6 h-9 w-auto" priority />

        {/* Heading role: 24px / 600 / 1.2 */}
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.login.heading}
        </h1>

        {/* Body role: 16px / 400 / 1.5 */}
        <p className="mt-2 text-base leading-normal font-normal text-muted-foreground">
          {strings.login.subline}
        </p>

        {/*
         * Same Card overrides as /signup: --muted fill, --border hairline,
         * rounded-lg, and the same responsive --card-spacing values.
         */}
        <Card className="mt-8 rounded-lg border border-border bg-muted ring-0 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <p className="mt-6 text-base leading-normal font-normal text-muted-foreground">
          <Link
            href="/signup"
            className="text-foreground underline underline-offset-3"
          >
            {strings.login.signupLink}
          </Link>
        </p>
      </div>
    </main>
  );
}
