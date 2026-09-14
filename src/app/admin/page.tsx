import type { Metadata } from "next";

import { strings } from "@/lib/strings";
import { requireAdminContext } from "@/server/admin/context";

/**
 * `/admin` — the merchants list, § C1 (ADM-01 / ADM-03 / R-2).
 *
 * A minimal placeholder for now: plan 06-08 replaces this body with the real
 * table. Rendering only the heading — no fabricated empty state, no
 * placeholder rows — keeps this intermediate state honest about what exists
 * today rather than performing a table that is not there yet.
 *
 * `requireAdminContext()` is called here, not just in the layout: a Next 16
 * layout cannot prevent this segment from rendering and does not re-run on
 * client-side navigation between siblings, so this is the real gate for this
 * page specifically. `React.cache()` collapses the repeat call with the
 * layout's into one `getSession`.
 */

export const metadata: Metadata = {
  title: strings.admin.merchants.title,
};

export default async function AdminMerchantsPage() {
  await requireAdminContext();

  return (
    <h1 className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight text-foreground">
      {strings.admin.merchants.heading}
    </h1>
  );
}
