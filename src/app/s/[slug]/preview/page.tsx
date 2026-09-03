import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { env } from "@/env";
import { getPaymentSettings } from "@/server/payments/settings";
import { buildWhatsAppContactLink } from "@/server/payments/whatsapp";
// Aliased to `fetchProducts` for the same reason the storefront home does it:
// the query gets exactly one call site in this file, named once, here.
import {
  listStorefrontCategories,
  listStorefrontProducts as fetchProducts,
} from "@/server/storefront/queries";
import { getPublishedStorefront } from "@/server/theming/queries";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

import type { StorefrontRenderData } from "../sections/render-data";
import { PreviewCanvas } from "./preview-canvas";

/**
 * The editor's iframe target (EDIT-02, D-07) — 04-RESEARCH.md Pattern 4.
 *
 * A merchant editing their storefront sits on the apex host. Their storefront
 * lives on their own subdomain. This route is the document the editor frames,
 * reached as `{slug}.{root}/preview` and rewritten by the Proxy into this
 * file's path.
 *
 * ---------------------------------------------------------------------------
 * WHY AN IFRAME AT ALL, RATHER THAN AN INLINE PREVIEW PANE.
 * ---------------------------------------------------------------------------
 * Three independently verified constraints force this shape, and none of them
 * is a preference:
 *
 *   1. `src/proxy.ts` returns a bare 404 for every request whose path begins
 *      with the internal rewrite prefix, unconditionally, on every host. The
 *      editor lives on the apex, so it cannot frame the internal route and
 *      cannot server-render the storefront tree from a dashboard page.
 *   2. `tests/unit/surface-token-isolation.test.ts` ban #4 fails the build if
 *      the storefront surface attribute appears in any `.tsx` outside
 *      `src/app/s/`, and D-12 forbids weakening that guard. The preview
 *      therefore cannot be an inline dashboard subtree wearing that attribute.
 *   3. An inline preview would get the WINDOW's viewport, so every `md:` and
 *      `lg:` utility in the flagship would fire against the browser width
 *      rather than the pane width — systematically wrong at exactly the moment
 *      the merchant is judging whether their store looks expensive. A separate
 *      document has its own viewport, which also makes a mobile/desktop toggle
 *      a width change on the iframe element and nothing more.
 *
 * ---------------------------------------------------------------------------
 * NO SESSION AND NO TOKEN. THIS IS DELIBERATE AND MUST NOT BE "FIXED".
 * ---------------------------------------------------------------------------
 * "Add a login gate to the preview" is the obvious-looking change that would
 * break the entire architecture. The iframe is CROSS-ORIGIN and carries no
 * cookie: Phase 1 D-07 keeps the session cookie host-only on the apex, so a
 * gate here would fail for every legitimate merchant and the pane would render
 * a redirect instead of a storefront. Widening the cookie's domain to make it
 * work would hand a session to every merchant-controlled subdomain (T-04-32).
 *
 * There is also nothing here for a gate to protect. This route serves ONLY
 * data the storefront already serves publicly to any anonymous visitor — the
 * merchant's own products, categories, store name and PUBLISHED document. The
 * DRAFT never reaches the server while the merchant is editing: it lives in
 * their own browser and travels only between two documents that browser
 * already has open, over `postMessage`. That is the whole point of Pattern 4
 * and it is why D-07's "instant" promise has no network in the loop.
 *
 * The published document is rendered as the INITIAL PAINT so the pane is never
 * blank while the handshake completes. `preview-canvas.tsx` replaces it the
 * moment the editor's first draft arrives.
 *
 * ---------------------------------------------------------------------------
 * DO NOT ADD A BLANKET `X-Frame-Options: DENY` OR `frame-ancestors 'none'`
 * HEADER TO THE STOREFRONT WHILE THIS ROUTE EXISTS — IT WOULD BLANK THE
 * PREVIEW FOR EVERY MERCHANT.
 * ---------------------------------------------------------------------------
 * There is no CSP and no frame header configured anywhere today: `next.config
 * .ts` sets only `images` and `allowedDevOrigins`, and declares no `headers()`
 * at all (verified by reading it). If a future phase adds clickjacking
 * protection, this route needs `frame-ancestors https://{ROOT_DOMAIN}` — the
 * apex, and only the apex — rather than a blanket deny (T-04-14b). Vercel
 * project settings live outside this repository and should be confirmed on the
 * first deploy.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS ROUTE DOES NOT DO.
 * ---------------------------------------------------------------------------
 * It performs NO write (Pitfall 11, T-04-11). It is a public, unauthenticated,
 * unrate-limited path, so a lazy "seed the row if it is missing" here would
 * turn a URL and a loop into free write amplification. `getPublishedStorefront`
 * already degrades to the flagship defaults for an unseeded store; seeding
 * stays in the two gated paths that own it.
 *
 * It does NOT re-declare the storefront surface attribute or the brand tokens
 * either. It INHERITS `src/app/s/[slug]/layout.tsx`, which is the tenant gate,
 * the one legal home of that attribute, the zinc scope, the 0.25rem radius and
 * the published-token injection. A second scope nested inside the first would
 * buy nothing and would need explaining forever.
 */

/**
 * A preview URL indexed by a crawler is a duplicate-content and confusion
 * problem — the same storefront under two addresses, one of which is a
 * scaffold for an editor (T-04-14). The leakage impact is nil by design
 * regardless, which is the same fact that makes the missing session correct.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function StorefrontPreviewPage({
  params,
}: PageProps<"/s/[slug]/preview">) {
  const { slug } = await params;

  const tenant = await resolveTenantBySlug(slug);

  // Unreachable in practice — the inherited layout gates this subtree — but
  // the check is what makes that a type-level fact rather than an assumption.
  if (!tenant) notFound();

  const [published, categories, products, paymentSettings] = await Promise.all([
    getPublishedStorefront(tenant.id),
    listStorefrontCategories(tenant.id),
    fetchProducts(tenant.id),
    getPaymentSettings(tenant.id),
  ]);

  /*
   * THE SAME DATA BUNDLE `src/app/s/[slug]/page.tsx` BUILDS, BUILT THE SAME
   * WAY — MIRRORED RATHER THAN IMPORTED.
   *
   * Both constructions are thin, and a shared builder would need a home
   * neither route owns: it reads from three `server-only` modules, so it could
   * not live under `sections/`, and it is route assembly rather than a query,
   * so it does not belong in `src/server/storefront/` either. The duplication
   * is bounded by the type — `StorefrontRenderData` is the contract, so a
   * field added there is a compile error in both places on the same commit.
   *
   * `whatsappHref` is built SERVER-SIDE here, exactly as on the live home. The
   * raw phone number never leaves this function; the canvas receives a finished
   * URL or `null`, because the normalisation rules live in
   * `src/server/payments/**` and a second, client-side spelling of them is how
   * two versions of one number drift apart.
   *
   * NO `?category=` FILTER, AND THAT IS NOT AN OMISSION. Anchors inside the
   * preview are inert by design (04-UI-SPEC.md § Preview canvas → "Navigation
   * is intercepted"), so no chip in this document can ever change the filter.
   * Reading a search parameter that nothing can set would be dead plumbing
   * pretending to be a feature; `null` renders the "All" chip selected, which
   * is what the merchant is previewing.
   */
  const data: StorefrontRenderData = {
    imageBaseUrl: env.R2_PUBLIC_BASE_URL,
    storeName: tenant.name,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      priceXaf: product.priceXaf,
      imageKey: product.imageKey,
      inStock: product.inStock,
    })),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })),
    activeCategorySlug: null,
    whatsappHref: buildWhatsAppContactLink(
      paymentSettings?.whatsappNumber ?? null,
    ),
  };

  /*
   * THE EDITOR'S ORIGIN IS COMPUTED HERE, ON THE SERVER, FROM CONFIGURATION —
   * NEVER FROM ANYTHING THE BROWSER REPORTS ABOUT ITSELF (Pitfall 12).
   *
   * This one expression is both halves of the security control and the
   * local-development trap:
   *
   *   - Security: it becomes the receiver's `event.origin` comparison and the
   *     exact `targetOrigin` of the handshake post (T-04-08, T-04-08b). A value
   *     derived from the framed document's own address is attacker-influenced
   *     in exactly the case the comparison exists to catch, so the only honest
   *     source is the configured root domain.
   *   - Local dev: `npm run dev` binds port 3001 while `NEXT_PUBLIC_ROOT_DOMAIN`
   *     says 3000 in every example env file. Reading a port from the browser
   *     would silently disagree with what the editor posts, and the failure —
   *     a preview that works in production and stays blank locally — looks like
   *     a bug in the protocol rather than a mismatched port.
   *
   * The `startsWith("localhost")` protocol switch is copied verbatim from
   * `src/app/onboarding/plan/page.tsx`, which builds the storefront URL the
   * same way. Two spellings of one rule is how the two drift.
   */
  const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN;
  const protocol = rootDomain.startsWith("localhost") ? "http" : "https";
  const editorOrigin = `${protocol}://${rootDomain}`;

  return (
    <PreviewCanvas
      initialDocument={published.document}
      initialTokens={published.tokens}
      data={data}
      editorOrigin={editorOrigin}
    />
  );
}
