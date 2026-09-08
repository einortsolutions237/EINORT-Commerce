import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { LayoutGrid, type LucideIcon, Wallet, Zap } from "lucide-react";

import einortLogo from "@/assets/brand/einort-logo.png";
import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";
import { publicUrlFor, templatePreviewPrefixFor } from "@/server/images/r2";
import { TEMPLATE_PREVIEWS } from "@/server/theming/preview-manifest";

/**
 * The public marketing landing page (MKTG-01).
 *
 * Replaces the prior 3-element placeholder (wordmark/tagline/CTA) with the
 * full D-04 page: a top lockup, a hero, three differentiator sections
 * (payments, templates, speed — in that order, per 05.2-RESEARCH.md Finding
 * 1), a how-it-works section, and a final CTA. Every visible string comes
 * from `strings.root.*` (spread from `src/lib/strings/marketing.ts`) or
 * `strings.signup.loginLink` — never inlined here — and every claim in that
 * copy module is traceable to 05.2-RESEARCH.md's Verified Feature Ledger.
 *
 * This page renders only at the apex hostname: `src/proxy.ts`'s
 * `classifyHost` rewrites a storefront subdomain's `/` to `/s/{slug}` before
 * this component is ever reached, and a direct `/s/*` request is hard-404'd.
 * Nothing here needs to change to keep that true (05.2-RESEARCH.md Pattern
 * 6) — this phase does not touch the proxy.
 *
 * Design-system guardrails (05.2-UI-SPEC.md § Read This First): semantic
 * tokens only, no gold (D-06), no dark-mode variant (next-themes never
 * mounts on the root layout), no storefront surface scope attribute. All six
 * of this project's build-failing source-scanning guards apply to this file.
 */

export const metadata: Metadata = {
  // `absolute` bypasses the root layout's "%s · EINORT" template — a bare
  // string here would render "EINORT · EINORT" (05.2-RESEARCH.md Pitfall 8).
  title: { absolute: strings.root.metaTitle },
  description: strings.root.metaDescription,
};

/**
 * The one template whose real screenshot fronts the marketing page.
 *
 * `flagship-fashion` is TMPL-01's frozen, portfolio-quality anchor
 * (05.2-UI-SPEC.md U-13), chosen specifically because it will not silently
 * drift as the other 49 templates are authored.
 *
 * D-02/D-05: `TEMPLATE_PREVIEWS` ships empty until 05.1-09's screenshot
 * generation run populates it. An absent key here is the signal to render
 * the hero copy-only — never a wireframe, never stock photography, and
 * never `scripts/preview-assets/**` (banned from `src/` by
 * `tests/unit/preview-photo-isolation.test.ts`). The branch below is decided
 * once, server-side, before any JSX is produced — never via `onError`.
 */
const HERO_TEMPLATE_KEY = "flagship-fashion";

const heroPreview = TEMPLATE_PREVIEWS[HERO_TEMPLATE_KEY];
const heroSrc = heroPreview
  ? publicUrlFor(`${templatePreviewPrefixFor(HERO_TEMPLATE_KEY)}/card.webp`)
  : null;

interface Differentiator {
  readonly icon: LucideIcon;
  readonly heading: string;
  readonly body: string;
  readonly constraint: string;
  /** Alternating band fill, per 05.2-UI-SPEC.md § Page Structure. */
  readonly background: "bg-muted/40" | "bg-background";
}

/**
 * Payments -> templates -> speed, in that exact order (05.2-RESEARCH.md
 * Finding 1: the hero and the first differentiator carry ~57% of page
 * attention, so payments — EINORT's sharpest, most defensible claim versus
 * Wix/Shopify/a Facebook page — leads).
 */
const DIFFERENTIATORS: readonly Differentiator[] = [
  {
    icon: Wallet,
    heading: strings.root.payments.heading,
    body: strings.root.payments.body,
    constraint: strings.root.payments.constraint,
    background: "bg-muted/40",
  },
  {
    icon: LayoutGrid,
    heading: strings.root.templates.heading,
    body: strings.root.templates.body,
    constraint: strings.root.templates.constraint,
    background: "bg-background",
  },
  {
    icon: Zap,
    heading: strings.root.speed.heading,
    body: strings.root.speed.body,
    constraint: strings.root.speed.constraint,
    background: "bg-muted/40",
  },
];

/**
 * One repeated shape, rendered three times. Not extracted to its own
 * component file — 05.2-RESEARCH.md Pattern 2 explicitly warns against a
 * `src/components/marketing/` tree of single-use files for a page this
 * size.
 */
function DifferentiatorSection({
  icon: Icon,
  heading,
  body,
  constraint,
  background,
}: Differentiator) {
  return (
    <section
      className={`border-t border-border ${background} px-4 py-16 sm:px-8`}
    >
      <div className="mx-auto max-w-3xl">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <Icon className="size-6 text-primary" />
        </div>

        {/* Heading role: 24px / 600 / 1.2 */}
        <h2 className="mt-2 font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {heading}
        </h2>

        {/* Body role, muted: 16px / 400 / 1.5 */}
        <p className="mt-4 text-base leading-normal text-muted-foreground">
          {body}
        </p>

        {/*
         * The honest-constraint line (D-01's core mechanism, made visible).
         * Full ink (text-foreground), NOT muted, NOT boxed, NOT italic, NOT
         * prefixed with "Note:" — 05.2-RESEARCH.md Finding 3: this sentence
         * is the page's competitive advantage, not a caveat, and a
         * apologetic treatment would undercut exactly the point it makes.
         */}
        <p className="mt-3 text-base leading-normal text-foreground">
          {constraint}
        </p>
      </div>
    </section>
  );
}

export default function RootPage() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Band 0 — top lockup. Chrome, not a content band: py-6 is a
          declared exception to the 3xl section rhythm, not a scale token. */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 sm:px-8">
        <div className="flex items-center gap-2">
          <Image src={einortLogo} alt="" className="h-8 w-auto" loading="eager" />
          <span className="text-sm font-semibold text-foreground">
            {strings.root.wordmark}
          </span>
        </div>

        <Link
          href="/login"
          className="text-foreground underline underline-offset-3"
        >
          {strings.root.signIn}
        </Link>
      </div>

      {/* Band 1 — hero. The heroSrc branch above is decided before this
          renders; nothing here checks image-load state. */}
      <section className="bg-background px-4 py-16 sm:px-8">
        {heroSrc === null ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <h1 className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {strings.root.hero.heading}
            </h1>
            <p className="mt-4 text-base leading-normal text-muted-foreground">
              {strings.root.hero.body}
            </p>
            <Button
              render={<Link href="/signup" />}
              className="mt-6 min-h-11 px-6 text-sm font-semibold"
            >
              {strings.root.cta}
            </Button>
            <p className="mt-2 text-sm leading-normal text-muted-foreground">
              {strings.root.hero.ctaNote}
            </p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
            <div>
              <h1 className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {strings.root.hero.heading}
              </h1>
              <p className="mt-4 text-base leading-normal text-muted-foreground">
                {strings.root.hero.body}
              </p>
              <Button
                render={<Link href="/signup" />}
                className="mt-6 min-h-11 px-6 text-sm font-semibold"
              >
                {strings.root.cta}
              </Button>
              <p className="mt-2 text-sm leading-normal text-muted-foreground">
                {strings.root.hero.ctaNote}
              </p>
            </div>

            <Image
              src={heroSrc}
              alt=""
              width={1280}
              height={800}
              sizes="(min-width: 1024px) 480px, 100vw"
              loading="eager"
              fetchPriority="high"
              className="rounded-lg border border-border"
            />
          </div>
        )}
      </section>

      {/* Bands 2-4 — differentiators, payments -> templates -> speed. */}
      {DIFFERENTIATORS.map((differentiator) => (
        <DifferentiatorSection key={differentiator.heading} {...differentiator} />
      ))}

      {/* Band 5 — how it works. */}
      <section className="border-t border-border bg-background px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
            {strings.root.howItWorks.heading}
          </h2>

          <div className="mt-8 grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-8">
            {strings.root.howItWorks.steps.map((step, index) => (
              <div key={step.title} className="flex flex-col items-center text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                  <span className="font-heading text-2xl leading-none font-semibold text-primary">
                    {index + 1}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {step.title}
                </p>
                <p className="mt-1 text-base leading-normal text-muted-foreground">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Band 6 — final CTA. Same centred treatment as the manifest-absent
          hero — a deliberate visual bookend. */}
      <section className="border-t border-border bg-muted/40 px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
            {strings.root.finalCta.heading}
          </h2>
          <p className="mt-4 text-base leading-normal text-muted-foreground">
            {strings.root.finalCta.body}
          </p>

          <Button
            render={<Link href="/signup" />}
            className="mt-6 min-h-11 px-6 text-sm font-semibold"
          >
            {strings.root.cta}
          </Button>

          <p className="mt-2 text-base leading-normal">
            <Link
              href="/login"
              className="text-foreground underline underline-offset-3"
            >
              {strings.signup.loginLink}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
