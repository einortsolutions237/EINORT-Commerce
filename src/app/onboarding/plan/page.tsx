import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { strings } from "@/lib/strings";
import { auth } from "@/server/auth/auth";
import { platformDb } from "@/server/db/platform";
import { PLAN_TIERS, PLANS } from "@/server/entitlements/plans";

import { PlanPicker, type PlanCard } from "./plan-picker";

/**
 * `/onboarding/plan` — the mandatory step between signup and the storefront
 * (SUB-01, D-01 through D-05).
 *
 * A server component wrapping one client island. The heading, the subline and
 * all three cards' content ship as HTML, so the merchant reads a real pricing
 * page before the picker's JavaScript arrives — which matters on the low-end
 * Android this market runs on.
 *
 * IDENTITY COMES FROM THE SESSION AND NOWHERE ELSE. This route reads no search
 * parameter and no route parameter; the organization it renders for, and the
 * one `selectPlan` writes to, are both `session.session.activeOrganizationId`.
 */

export const metadata: Metadata = {
  // Renders as "Choose your plan · EINORT" via the root layout's template.
  title: strings.plan.title,
};

/**
 * Copy language is English; the number formatting below is independent of that
 * and deliberate on its own terms.
 *
 * ---------------------------------------------------------------------------
 * THIS IS NOT THE CURRENCY FORMATTER CLAUDE.md DOCUMENTS. DO NOT "FIX" IT BACK.
 * ---------------------------------------------------------------------------
 * The rest of this codebase formats money with the locale-driven currency
 * formatter CLAUDE.md prescribes, which renders `5 000 FCFA`. Quick task
 * `260831-urm` asked for `5,000 XAF` — comma-grouped thousands, the literal
 * currency code trailing — on the subscription-plan price display specifically.
 * No standard locale produces that shape through a currency-style formatter:
 * English locales put the code in front (`XAF 5,000`), and every locale that
 * trails it groups with spaces or dots (`5 000 XAF`, `5.000 XAF`). So this is a
 * plain decimal formatter and the code is appended as a literal at the call
 * site. The deviation is scoped to the two plan surfaces and nothing else —
 * product, cart, checkout, order and WhatsApp prices are untouched.
 *
 * `maximumFractionDigits: 0` is required rather than cosmetic — the currency
 * has no decimal subunit in common use.
 */
const priceFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

/**
 * Keyed by tier so a fourth tier in `PLAN_TIERS` is a compile error here rather
 * than a card that silently renders without copy. Starter has no group header:
 * there is no earlier tier for it to build on.
 */
const TIER_COPY: Readonly<
  Record<
    (typeof PLAN_TIERS)[number],
    {
      name: string;
      tagline: string;
      featuresHeader: string | null;
      features: readonly string[];
    }
  >
> = {
  starter: { ...strings.plan.starter, featuresHeader: null },
  business: strings.plan.business,
  professional: strings.plan.professional,
};

export default async function PlanPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Nothing to offer an anonymous visitor: a plan is chosen for a store, and a
  // store is only reachable behind a session.
  if (!session) redirect("/login");

  /**
   * No active organization means the store was never provisioned — the
   * non-atomic signup gap Phase 1 documents. The recovery route owns that
   * state; choosing a plan for a store that does not exist would be a write
   * with nowhere to land.
   */
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) redirect("/onboarding/create-store");

  const organization = await platformDb.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true, planTier: true },
  });
  if (!organization) redirect("/onboarding/create-store");

  /**
   * Already chosen: send them to their store rather than rendering a
   * "you already picked" screen. A merchant arriving here from a stale tab, a
   * bookmark or the browser's back button has nothing to do on this page.
   */
  if (organization.planTier !== null) {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "einort.com";
    // Their storefront is a different host, so this is an absolute redirect.
    // `http` locally, `https` everywhere a real root domain is configured.
    const protocol = rootDomain.startsWith("localhost") ? "http" : "https";
    redirect(`${protocol}://${organization.slug}.${rootDomain}`);
  }

  /**
   * Prices are read from the registry and formatted HERE, on the server
   * (T-02-08). The island receives finished strings, so no price is ever
   * accepted from — or computed by — the client. Ascending price order comes
   * from `PLAN_TIERS` itself rather than a second ordering to keep in sync.
   */
  const plans: PlanCard[] = PLAN_TIERS.map((tier) => ({
    tier,
    name: TIER_COPY[tier].name,
    tagline: TIER_COPY[tier].tagline,
    featuresHeader: TIER_COPY[tier].featuresHeader,
    features: TIER_COPY[tier].features,
    price: `${priceFormatter.format(PLANS[tier].monthlyPriceXaf)} XAF`,
    recommended: PLANS[tier].recommended,
  }));

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16 sm:px-8">
      <div className="w-full max-w-5xl">
        {/* Heading role: 24px / 600 / 1.2 */}
        <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.plan.heading}
        </h1>

        {/* Body role: 16px / 400 / 1.5 */}
        <p className="mt-2 text-base leading-normal font-normal text-muted-foreground">
          {strings.plan.subline}
        </p>

        <PlanPicker plans={plans} />
      </div>
    </main>
  );
}
