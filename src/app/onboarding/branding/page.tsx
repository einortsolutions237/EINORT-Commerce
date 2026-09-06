import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { TemplateTile } from "@/components/theming/template-picker";
import { env } from "@/env";
import { strings } from "@/lib/strings";
import { auth } from "@/server/auth/auth";
import { platformDb } from "@/server/db/platform";
import { accessibleTemplateKeys } from "@/server/theming/access";
import { templateDefaultTokens } from "@/server/theming/defaults";
import {
  INDUSTRY_SEGMENTS,
  INDUSTRY_SEGMENT_ICONS,
  TEMPLATE_KEYS,
  TEMPLATES,
  type TemplateKey,
} from "@/server/theming/registry";

import { BrandingForm, type SegmentTile } from "./branding-form";

/**
 * Name + segment tag for one template tile.
 *
 * `flagship-fashion` is deliberately ABSENT from `strings.templates` (it
 * reads its copy from `strings.flagship` instead — see that module's own
 * header on why it lives separately) so it is special-cased here rather than
 * indexed like the other 49 keys. Every other key is authored in Wave 3
 * (05-12 through 05-17); the `?? ""` fallback only guards the type (the
 * per-segment namespaces are typed `Partial<Record<TemplateKey, …>>`), it is
 * never expected to fire in practice.
 */
function templateCopy(key: TemplateKey): {
  readonly name: string;
  readonly segmentTag: string;
} {
  if (key === "flagship-fashion") {
    return {
      name: strings.flagship.name,
      segmentTag: strings.flagship.segmentTag,
    };
  }
  const copy = strings.templates[key];
  return { name: copy?.name ?? "", segmentTag: copy?.segmentTag ?? "" };
}

/**
 * `/onboarding/branding` — the step between the plan pick and a live storefront
 * (ONB-02, ONB-03, ONB-04, D-01, D-02, D-10, D-11).
 *
 * A server component wrapping one client island, exactly like
 * `/onboarding/plan`. The heading, the subline and every card's chrome ship as
 * HTML so the merchant reads a real page before the form's JavaScript arrives —
 * which matters on the low-end Android this market runs on.
 *
 * IDENTITY COMES FROM THE SESSION AND NOWHERE ELSE. This route reads no search
 * parameter and no route parameter; the organization it renders for, and the
 * one `saveBranding` writes to, are both `session.session.activeOrganizationId`.
 *
 * ---------------------------------------------------------------------------
 * THIS ROUTE IS DELIBERATELY OUTSIDE THE MERCHANT DAL. DO NOT "FIX" IT BY
 * CALLING THAT WRAPPER HERE.
 * ---------------------------------------------------------------------------
 * T-04-27. The audit for this boundary is a plain grep for the wrapper's name,
 * so the name is deliberately not spelled anywhere in this file — including
 * here. It lives in `src/server/merchant/context.ts` and it is a ladder of
 * redirects for incomplete onboarding states; this plan added one more rung
 * to it:
 *
 *     industry === null  ->  redirect("/onboarding/branding")
 *
 * A merchant who is ON this page has a null industry BY DEFINITION — that is
 * the state this page exists to fix — so calling the DAL here would redirect
 * the page to itself, forever. It resolves the session directly instead, the
 * same shape `/onboarding/plan/page.tsx` and `selectPlan` already use, and for
 * the identical reason: `src/server/merchant/context.ts`'s own comment says
 * routing the surface that fixes a state through the gate for that state loops
 * the merchant on it. `src/server/theming/actions.ts` documents the write half
 * of the same decision.
 *
 * The ladder below is therefore hand-written and IS the authorization for this
 * route. It is the plan screen's, rung for rung, with the plan rung included —
 * branding comes after the plan pick, never instead of it.
 */

export const metadata: Metadata = {
  // Renders as "Set up how your store looks · EINORT" via the root layout's
  // template.
  title: strings.branding.title,
};

export default async function BrandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Nothing to offer an anonymous visitor: a store is branded behind a session.
  if (!session) redirect("/login");

  /**
   * No active organization means the store was never provisioned — the
   * non-atomic signup gap Phase 1 documents. The recovery route owns that
   * state; branding a store that does not exist would be a write with nowhere
   * to land.
   */
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) redirect("/onboarding/create-store");

  /**
   * `name` is read so the business-name field arrives pre-filled. ONB-02 says
   * the step "captures business name", and re-asking for something already
   * captured at signup is a worse experience than letting the merchant confirm
   * what they already typed.
   */
  const organization = await platformDb.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, slug: true, planTier: true, industry: true },
  });
  if (!organization) redirect("/onboarding/create-store");

  // D-05. The plan pick comes first and is mandatory; a merchant who reached
  // this URL without one goes back a step rather than skipping it.
  if (organization.planTier === null) redirect("/onboarding/plan");

  /**
   * Already done: send them to the store they already published rather than
   * rendering a form that would overwrite it. A merchant arriving here from a
   * stale tab, a bookmark or the back button has nothing to do on this page.
   */
  if (organization.industry !== null) {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "einort.com";
    // Their storefront is a different host, so this is an absolute redirect.
    // `http` locally, `https` everywhere a real root domain is configured.
    const protocol = rootDomain.startsWith("localhost") ? "http" : "https";
    redirect(`${protocol}://${organization.slug}.${rootDomain}`);
  }

  /**
   * The six tiles, assembled HERE and handed down as plain data.
   *
   * `src/server/theming/registry.ts` carries `server-only`, so the island
   * cannot import it — and it stores an icon NAME rather than a component for
   * exactly that reason. The island maps the name to a lucide component at its
   * own boundary. Order comes from `INDUSTRY_SEGMENTS` itself rather than a
   * second ordering to keep in sync.
   */
  const segments: SegmentTile[] = INDUSTRY_SEGMENTS.map((id) => ({
    id,
    label: strings.branding.segments[id],
    icon: INDUSTRY_SEGMENT_ICONS[id],
  }));

  /**
   * All 50 templates, assembled HERE as plain data — the same
   * "`server-only`-marked registry can't reach the client island, so the RSC
   * flattens it first" move `segments` above already makes. `locked` covers
   * every key ABOVE the merchant's own tier; TMPL-04/D-06's onboarding upsell
   * moment (05-UI-SPEC.md § Onboarding Template Picker) keeps them visible,
   * dimmed, rather than hidden — the picker sorts, it never filters. Order
   * comes from `TEMPLATE_KEYS` itself, not a second ordering to keep in sync.
   *
   * `organization.planTier` is already read above (the `null` case redirects
   * to `/onboarding/plan` first) — no new query.
   */
  const accessibleKeys = new Set(
    accessibleTemplateKeys(organization.planTier),
  );

  const templates: TemplateTile[] = TEMPLATE_KEYS.map((key) => {
    const definition = TEMPLATES[key];
    const copy = templateCopy(key);
    return {
      key,
      name: copy.name,
      segment: definition.segment,
      segmentTag: copy.segmentTag,
      minTier: definition.minTier,
      sections: definition.sections,
      primaryAccent: templateDefaultTokens(key).primaryAccent,
      locked: !accessibleKeys.has(key),
    };
  });

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16 sm:px-8">
      {/* Wider than create-store's max-w-md: the industry tile grid needs it. */}
      <div className="w-full max-w-2xl">
        {/* Heading role: 24px / 600 / 1.2 */}
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.branding.heading}
        </h1>

        {/* Body role: 16px / 400 / 1.5 */}
        <p className="mt-2 text-base leading-normal font-normal text-muted-foreground">
          {strings.branding.subline}
        </p>

        {/*
         * `R2_PUBLIC_BASE_URL` is not a `NEXT_PUBLIC_` variable and
         * `src/server/images/r2.ts` carries `server-only`, so the island cannot
         * resolve a derivative URL itself. The route reads it once and hands
         * over a string — the `image-gallery-field.tsx` precedent.
         */}
        <BrandingForm
          businessName={organization.name}
          segments={segments}
          templates={templates}
          industry={organization.industry}
          imageBaseUrl={env.R2_PUBLIC_BASE_URL}
        />
      </div>
    </main>
  );
}
