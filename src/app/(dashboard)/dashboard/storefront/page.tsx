import type { Metadata } from "next";

import type { TemplateTile } from "@/components/theming/template-picker";
import { strings } from "@/lib/strings";
import { publicUrlFor, templatePreviewPrefixFor } from "@/server/images/r2";
import { requireMerchantContext } from "@/server/merchant/context";
import { accessibleTemplateKeys } from "@/server/theming/access";
import { ensureStorefrontSeeded } from "@/server/theming/actions";
import { templateDefaultTokens } from "@/server/theming/defaults";
import { TEMPLATE_PREVIEWS } from "@/server/theming/preview-manifest";
import { getEditorStorefront } from "@/server/theming/queries";
import {
  INDUSTRY_SEGMENTS,
  isTemplateKey,
  TEMPLATES,
  type TemplateKey,
} from "@/server/theming/registry";

import { ThemesBrowser } from "./themes-browser";

/**
 * `/dashboard/storefront` (EDIT-02, EDIT-03) — the Themes half of the
 * storefront-editor page split (05.3-CONTEXT.md D-A, D-B).
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE AUTHORIZES ITSELF.
 * ---------------------------------------------------------------------------
 * `requireMerchantContext()` is not inherited from `(dashboard)/layout.tsx` —
 * that file's own header explains why a Next 16 layout cannot be the gate: it
 * does not control whether its child segments render, and it does not re-run
 * on client-side navigation between sibling routes. Every page under
 * `(dashboard)/` calls the DAL itself; `React.cache()` makes the repeat call
 * free (T-04-34).
 *
 * ---------------------------------------------------------------------------
 * THE SEED CALL, BELOW, IS A SECOND ENTRY POINT — NOT A NEW WRITE.
 * ---------------------------------------------------------------------------
 * The idempotent storefront-seeding upsert (empty `update` on both halves)
 * used to run from exactly one authenticated page: the combined editor.
 * Before this phase, that page was the ONE place a pre-Phase-4 organization
 * could land to self-heal its missing storefront row. After the split, this
 * Themes page is now also reachable first (from the sidebar, before the
 * Editor ever loads), so the same idempotent call has to run here too — cite
 * Pitfall 4. It stays behind the authenticated session exactly as it already
 * does on the Editor page, never on a public route: the storefront's own
 * render path is anonymous and unrate-limited, so a lazy seed there would
 * turn a URL and a loop into free write amplification (T-04-11).
 *
 * ---------------------------------------------------------------------------
 * THREE PROPS, NO PREVIEW IFRAME, NO PUBLISH BAR.
 * ---------------------------------------------------------------------------
 * This page explicitly does NOT fetch payment settings, active product
 * count, the settings-panel field/section descriptor tables, the theme
 * field maxima, the draft's section-variant map, the image base URL, or the
 * storefront/preview-URL/preview-target-origin trio the Editor page needs —
 * none of it is needed without a live-preview iframe, and this page has none
 * (05.3-UI-SPEC.md § Page Data Contract). The template cards already carry
 * real `.webp` previews from Phase 05.1's manifest, and `switchTemplate` is
 * a fully separate, self-committing server action with its own confirm
 * dialog — a second commit UI here (a `PublishBar`) would be new capability,
 * forbidden by D-B (05.3-UI-SPEC.md § U-6).
 */

export const metadata: Metadata = {
  // Renders as "Storefront · EINORT" through the root layout's template.
  title: strings.editor.themesPageHeading,
};

/**
 * The editor's own `TemplateTile[]`, tier-scoped rather than segment-sorted.
 *
 * D-08/TMPL-04 (05-UI-SPEC.md § Editor "Change Template" Action). Unlike the
 * onboarding grid, the picker on this page shows ONLY the merchant's
 * current-tier accessible set as ordinary selectable cards — no locked
 * upsell cards repeat here, because a working surface is not a conversion
 * moment. The one exception is `currentKey`: it must always render, even
 * when a downgrade has since put it above the merchant's tier, marked
 * `locked: true` so `<TemplatePicker>`'s own inert-current-card treatment
 * (`isRetainedAboveTier`) takes over — see that component's header for why
 * the rendering split lives there and not here.
 *
 * `primaryAccent` on every tile is the TEMPLATE's own default accent
 * (`templateDefaultTokens(key).primaryAccent`), never the merchant's actual
 * saved colour (05-UI-SPEC.md § Template Thumbnail Component) — the
 * thumbnail is a generic preview of the template's own design, not a live
 * rendering of this merchant's brand. `previewUrl`'s `.webp` is generated
 * from that same `TEMPLATE_DEFAULTS`-derived default styling
 * (`npm run templates:previews`, plan 05.1-08) — a screenshot of the
 * template's own look, so the "generic preview, not this merchant's brand"
 * promise above survives the redesign unchanged.
 *
 * Tiles are returned in `INDUSTRY_SEGMENTS` order (a pure reorder, D-05 —
 * `keys.length` is unchanged) rather than `accessible`'s own order, so the
 * client component can group by first-appearing segment without importing
 * the registry — the same contract the onboarding surface's flatten in
 * `src/app/onboarding/branding/page.tsx` establishes.
 */
function editorTemplateTiles(
  tier: string,
  currentKey: string,
): TemplateTile[] {
  const accessible = accessibleTemplateKeys(tier);
  const currentIsAccessible =
    isTemplateKey(currentKey) && accessible.includes(currentKey);
  const keys: readonly TemplateKey[] =
    currentIsAccessible || !isTemplateKey(currentKey)
      ? accessible
      : [...accessible, currentKey];

  const tiles: TemplateTile[] = keys.map((key) => {
    const template = TEMPLATES[key];
    return {
      key,
      name: strings.templates[key]?.name ?? key,
      segment: template.segment,
      segmentTag: strings.branding.segments[template.segment],
      minTier: template.minTier,
      sections: template.sections,
      primaryAccent: templateDefaultTokens(key).primaryAccent,
      locked: !accessible.includes(key),
      previewUrl: TEMPLATE_PREVIEWS[key]
        ? publicUrlFor(`${templatePreviewPrefixFor(key)}/card.webp`)
        : null,
      segmentLabel: strings.branding.segments[template.segment],
    };
  });

  const segmentOrder: readonly string[] = INDUSTRY_SEGMENTS;
  return tiles
    .map((tile, index) => ({ tile, index }))
    .sort((a, b) => {
      const aRank = segmentOrder.indexOf(a.tile.segment);
      const bRank = segmentOrder.indexOf(b.tile.segment);
      return aRank !== bRank ? aRank - bRank : a.index - b.index;
    })
    .map(({ tile }) => tile);
}

export default async function StorefrontThemesPage() {
  const ctx = await requireMerchantContext();
  await ensureStorefrontSeeded({});
  const editor = await getEditorStorefront(ctx.tenantId);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <ThemesBrowser
        tiles={editorTemplateTiles(ctx.plan.tier, editor.templateKey)}
        currentTemplateKey={editor.templateKey}
        canEditStorefront={ctx.canEditStorefront}
      />
    </div>
  );
}
