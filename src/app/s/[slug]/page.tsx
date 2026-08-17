import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { strings } from "@/lib/strings";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

/**
 * The placeholder storefront. This is the page that makes the Walking Skeleton
 * walk: a real visitor on a real subdomain gets a real page backed by a real
 * database read.
 *
 * Phase 4 replaces it wholesale with the template system, so it stays
 * deliberately bare — no catalog, no basket, no checkout, no branding controls,
 * and (01-UI-SPEC.md is explicit about this one) no sign-up call to action.
 * Anything added here is work Phase 4 has to delete.
 *
 * The second `resolveTenantBySlug` call costs nothing: the layout above already
 * made it and React's `cache()` dedupes both to a single lookup within one
 * render pass. Re-resolving rather than threading the tenant down through props
 * keeps the gate and the read independent — this page cannot end up rendering
 * for a tenant the layout rejected.
 */

export const metadata: Metadata = {
  // Static on purpose. Per-tenant metadata would be one more surface that has
  // to be proven not to differ between a live store and a suspended one; a
  // constant title cannot leak anything (D-05). Renders as
  // "Store coming soon · EINORT" via the root layout's template.
  title: strings.storefront.heading,
};

export default async function StorefrontPage({
  params,
}: PageProps<"/s/[slug]">) {
  const { slug } = await params;

  const tenant = await resolveTenantBySlug(slug);

  // Unreachable in practice — the layout gates this subtree — but the check is
  // what makes that a type-level fact rather than an assumption, and it fails
  // in the same direction as the gate if the tree is ever restructured.
  if (!tenant) notFound();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-8 py-16">
      <div className="flex max-w-prose flex-col items-center text-center">
        {/*
         * The store's own name, straight from Postgres. Not decoration: this is
         * the only thing on the page that proves hostname -> tenant resolution
         * actually reached the database, rather than the route merely existing.
         * Label role: 14px / 600 / 1.4.
         */}
        <p className="text-sm leading-snug font-semibold tracking-wide text-muted-foreground uppercase">
          {tenant.name}
        </p>

        {/* Heading role: 24px / 600 / 1.2 */}
        <h1 className="mt-4 text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {strings.storefront.heading}
        </h1>

        {/* Body role: 16px / 400 / 1.5 */}
        <p className="mt-4 text-base leading-normal font-normal text-muted-foreground">
          {strings.storefront.body}
        </p>
      </div>
    </main>
  );
}
