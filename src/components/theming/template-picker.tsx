"use client";

import type { ReactElement } from "react";
import Image from "next/image";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { strings } from "@/lib/strings";
import type { PlanTier } from "@/server/entitlements/plans";
import type { TemplateSectionRef } from "@/server/theming/schema";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TemplateThumbnail } from "./template-thumbnail";

/**
 * The shared template-picker grid (05.1-UI-SPEC.md § Grid Engine, §
 * Segment Grouping, § Card Anatomy, § D-05 Fallback; TMPL-06).
 *
 * ---------------------------------------------------------------------------
 * ONE COMPONENT, TWO SURFACES. IT MUST NEVER FORK.
 * ---------------------------------------------------------------------------
 * The onboarding branding step and the storefront editor's "Change template"
 * panel both need the identical grid of tile-thumbnail-name-tag cards, with
 * the identical tier-lock and current-template affordances. The three
 * differences between the two surfaces (industry sort/show-all, tier-locked
 * upsell cards, the current-template badge) are all expressed through props
 * below — never through a second component or an internal surface switch —
 * so the two pickers cannot quietly diverge the way two hand-copied JSX
 * trees eventually would.
 *
 * `TemplateTile` is plain, already-flattened data. This component takes NO
 * template key, resolves nothing itself, and imports neither the template
 * registry nor its defaults module — both carry a server-only marker, and a
 * value import of either here would break the editor's "use client" preview
 * route at build time, not at runtime (T-05-33). The caller (a Server
 * Component) is responsible for flattening the registry into `TemplateTile[]`
 * first, exactly as `src/app/onboarding/branding/page.tsx` already does for
 * `SegmentTile[]`.
 *
 * SORT, NEVER FILTER (D-05). `sortBySegment` only ever reorders `tiles` — no
 * card is ever removed from the rendered set, because a merchant's chosen
 * industry must never mechanically determine which templates are reachable.
 * Tier locking is the same story: a locked card still renders, dimmed and
 * disabled, never hidden. The one control that actually gates access is
 * `assertTemplateAccess` on the server (plans 05-04, 05-11) — everything this
 * component renders for a locked card is a courtesy, not the boundary
 * (T-05-32). The `Show all {N} templates` toggle that used to let a merchant
 * flip between a sorted and a full view was deleted in 05.1-05: explicit
 * segment headings (05.1-06) prove "nothing is hidden" more directly than a
 * button ever did, and the rendered set -- `tiles.length` -- is unchanged by
 * that removal.
 *
 * THE CURRENT-TEMPLATE CARD IS INERT (T-05-35). Re-selecting the template a
 * merchant already has must never fire the change handler, even if a
 * downgrade has since put it above their tier — that is exactly the
 * re-selection path a stale/forged request would replay to route around a
 * plan gate the confirm dialog is supposed to enforce.
 *
 * ---------------------------------------------------------------------------
 * THE PREVIEW .WEBP CONTAINS STOREFRONT COLOUR — THIS IS CONTENT, NOT A LEAK.
 * ---------------------------------------------------------------------------
 * Each `tile.previewUrl` points at a photograph of a real, rendered
 * storefront and therefore contains that template's own zinc palette and
 * merchant accent AS PIXELS. That is categorically different from a token
 * leak: no CSS custom property crosses the surface boundary, no class is
 * written, and the source scanners (`surface-token-isolation.test.ts`) see
 * only `<Image src={tile.previewUrl}>` — a URL, not a colour. Do NOT "fix"
 * this by stripping colour from the screenshot pipeline; it is the entire
 * point of TMPL-06.
 *
 * ---------------------------------------------------------------------------
 * GROUPING IS A PARTITION, NEVER A FILTER.
 * ---------------------------------------------------------------------------
 * `partitionBySegment` below buckets `tiles` by `tile.segment`, preserving
 * first-appearance order. Every tile handed in renders in exactly one group:
 * `Σ group.tiles.length === tiles.length` always holds, because a tile is
 * pushed into exactly one bucket and no bucket is ever dropped except for
 * being empty (which cannot happen for a segment with zero tiles, since no
 * bucket is created for a segment that never appears). This is D-05's
 * SORT-NEVER-FILTER rule extended to grouping, not a new rule.
 *
 * ---------------------------------------------------------------------------
 * WHY `@container`, NOT A VIEWPORT BREAKPOINT.
 * ---------------------------------------------------------------------------
 * The editor's "Change template" panel renders inside a fixed ~288px rail
 * column (`editor-shell.tsx`'s `lg:w-80` minus its own padding) whose width
 * is completely decoupled from the browser viewport's. A viewport breakpoint
 * (`sm:grid-cols-3`) fires based on the WINDOW's width, so a desktop merchant
 * with a wide window got three columns squeezed into 288px — roughly 85px per
 * card. A container query fires based on the GRID'S OWN CONTAINING BLOCK, so
 * the same markup renders 1-up in the rail and 3-up on the wider onboarding
 * page, correctly, with zero surface-specific branching. Do not reintroduce
 * `sm:grid-cols-`, `md:grid-cols-` or `lg:grid-cols-` here — the point of this
 * component's design is that it never again depends on the viewport at all.
 */

/**
 * One tile's worth of already-flattened, plain data. `key` is a plain
 * `string` rather than the registry's own key type on purpose: the type
 * itself lives in the server-only registry module, and this component must
 * not reach for it even as a type-only import, to keep this file at zero
 * textual reference to that module.
 */
export type TemplateTile = {
  readonly key: string;
  readonly name: string;
  readonly segment: string;
  readonly segmentTag: string;
  readonly minTier: PlanTier;
  readonly sections: readonly TemplateSectionRef[];
  readonly primaryAccent: string;
  readonly locked: boolean;
  /**
   * A finished, public preview-image URL, or `null` when no preview has
   * been generated for this template yet. `null` is D-05's fallback signal,
   * decided in the RSC from `TEMPLATE_PREVIEWS` manifest state BEFORE
   * render -- never via an `onError` handler, which flashes a broken image
   * and cannot catch the un-allowlisted-`next/image`-host case at all.
   */
  readonly previewUrl: string | null;
  /**
   * The human label for `tile.segment`, flattened by the RSC because
   * `tile.segment` is typed `string` here and narrowing it to index
   * `strings.branding.segments` would pull registry types across the
   * `server-only` boundary that `tests/unit/theming-marker-boundary.test.ts`
   * enforces. `segmentTag` stays a separate field -- the two feed different
   * slots.
   */
  readonly segmentLabel: string;
};

/** One segment's worth of tiles, in the order they should render. */
type SegmentGroup = {
  readonly segment: string;
  readonly label: string;
  readonly tiles: readonly TemplateTile[];
};

/**
 * Partition `tiles` by `tile.segment`, preserving first-appearance order,
 * then (when `sortBySegment` matches a real group) hoist that one group to
 * the front. A `Map` is used specifically because it preserves insertion
 * order — the first tile of a new segment creates that segment's bucket in
 * place, so the bucket order always mirrors `tiles`' own order (both RSCs
 * already hand tiles in `INDUSTRY_SEGMENTS` order, which is why this
 * function needs no registry import to reproduce a stable, sensible order).
 *
 * A PARTITION, NOT A FILTER: every tile is appended to exactly one bucket,
 * so `groups.reduce((n, g) => n + g.tiles.length, 0) === tiles.length`
 * always holds. A segment with zero tiles never gets a bucket at all, so a
 * zero-length group can never be rendered.
 */
function partitionBySegment(
  tiles: readonly TemplateTile[],
  sortBySegment: string | undefined,
): readonly SegmentGroup[] {
  const bySegment = new Map<string, TemplateTile[]>();

  for (const tile of tiles) {
    const bucket = bySegment.get(tile.segment);
    if (bucket) {
      bucket.push(tile);
    } else {
      bySegment.set(tile.segment, [tile]);
    }
  }

  const groups: SegmentGroup[] = Array.from(bySegment.entries()).map(
    ([segment, segmentTiles]) => ({
      segment,
      label: segmentTiles[0]!.segmentLabel,
      tiles: segmentTiles,
    }),
  );

  if (sortBySegment === undefined) return groups;

  const hoistIndex = groups.findIndex(
    (group) => group.segment === sortBySegment,
  );
  if (hoistIndex <= 0) return groups;

  const hoisted = groups[hoistIndex]!;
  const rest = groups.filter((_, index) => index !== hoistIndex);
  return [hoisted, ...rest];
}

export function TemplatePicker({
  tiles,
  selectedKey,
  onChange,
  currentKey,
  sortBySegment,
  error,
}: {
  readonly tiles: readonly TemplateTile[];
  /** The `radio-group`'s controlled value. `null` before a real pick is made. */
  readonly selectedKey: string | null;
  readonly onChange: (key: string) => void;
  /** The merchant's existing template — editor surface only. */
  readonly currentKey?: string;
  /**
   * The merchant's chosen industry — onboarding surface only. Repurposed
   * from "sort" to "which segment group is hoisted first and titled
   * Recommended for you" (U-07). The editor passes no `sortBySegment`; a
   * merchant there is changing template, not declaring an industry.
   */
  readonly sortBySegment?: string;
  readonly error?: string;
}): ReactElement {
  const groups = partitionBySegment(tiles, sortBySegment);

  return (
    <div className="flex flex-col gap-2">
      <RadioGroup
        value={selectedKey ?? undefined}
        onValueChange={(value: unknown) => {
          const key = String(value);
          if (currentKey !== undefined && key === currentKey) return;
          onChange(key);
        }}
        className="flex flex-col gap-8"
      >
        <TooltipProvider>
          {groups.map((group) => {
            const isRecommended =
              sortBySegment !== undefined && group.segment === sortBySegment;
            const headingId = `template-group-${group.segment}`;
            const headingText = (
              isRecommended
                ? strings.branding.templateGroupRecommended
                : strings.branding.templateGroupHeading
            )
              .replace("{segment}", group.label)
              .replace("{n}", String(group.tiles.length));

            return (
              <div key={group.segment} role="group" aria-labelledby={headingId}>
                <div
                  id={headingId}
                  className="border-b border-border pb-2 text-sm leading-normal font-semibold text-foreground"
                >
                  {headingText}
                </div>

                <div className="@container mt-4">
                  <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2 @4xl:grid-cols-3">
                    {group.tiles.map((tile) => {
                      const isCurrent =
                        currentKey !== undefined && tile.key === currentKey;
                      const isSelected =
                        isCurrent || selectedKey === tile.key;
                      const isRetainedAboveTier = isCurrent && tile.locked;
                      const isLocked = tile.locked && !isCurrent;
                      const isInert = isLocked || isRetainedAboveTier;
                      /**
                       * Locked and current cards never suggest an available
                       * action, so they omit `group` entirely — that is what
                       * keeps the image's `group-hover:scale-[1.02]` from
                       * resolving on hover for either state.
                       */
                      const disableHoverLift = isLocked || isCurrent;
                      const tileLabelId = `template-tile-${tile.key}`;
                      const tierName = strings.plan[tile.minTier].name;

                      const card = (
                        <div
                          key={tile.key}
                          className={cn(
                            "relative flex flex-col overflow-hidden rounded-lg border bg-card transition-colors duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                            !disableHoverLift && "group",
                            isSelected
                              ? "border-primary ring-2 ring-primary"
                              : "border-border hover:border-primary/40 hover:bg-accent",
                            isLocked && "opacity-60",
                          )}
                        >
                          <RadioGroupItem
                            value={tile.key}
                            disabled={isInert}
                            aria-disabled={isInert ? "true" : undefined}
                            aria-labelledby={tileLabelId}
                            className={cn(
                              "absolute inset-0 aspect-auto size-full rounded-lg border-0 bg-transparent opacity-0 after:hidden data-checked:bg-transparent",
                              isInert && "cursor-not-allowed",
                            )}
                          />

                          <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border bg-muted">
                            {tile.previewUrl !== null ? (
                              <Image
                                src={tile.previewUrl}
                                alt=""
                                fill
                                sizes="(min-width: 1024px) 340px, (min-width: 640px) 50vw, 92vw"
                                className="object-cover object-top transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none"
                              />
                            ) : (
                              <TemplateThumbnail
                                sections={tile.sections}
                                primaryAccent={tile.primaryAccent}
                                className="h-full w-full aspect-auto min-w-0 rounded-none border-0"
                              />
                            )}

                            {isLocked ? (
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-border bg-background text-xs font-medium text-foreground"
                                >
                                  <Lock aria-hidden="true" className="size-3" />
                                  {strings.branding.templateLockedChip.replace(
                                    "{tier}",
                                    tierName,
                                  )}
                                </Badge>
                              </div>
                            ) : null}

                            {isCurrent ? (
                              <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">
                                {strings.editor.templateCurrentBadge}
                              </Badge>
                            ) : null}
                          </div>

                          <div className="flex flex-col gap-2 p-4">
                            <Label
                              id={tileLabelId}
                              className="text-sm leading-normal font-semibold text-foreground"
                            >
                              {tile.name}
                            </Label>
                            <p className="text-sm leading-normal text-muted-foreground">
                              {tile.segmentTag}
                            </p>

                            {isRetainedAboveTier ? (
                              <p className="text-sm leading-normal text-muted-foreground">
                                {strings.editor.templateRetainedCaption}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );

                      if (!isLocked) return card;

                      return (
                        <Tooltip key={tile.key}>
                          <TooltipTrigger render={card} />
                          <TooltipContent>
                            {strings.branding.templateLockedTooltip.replace(
                              "{tier}",
                              tierName,
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </TooltipProvider>
      </RadioGroup>

      {error !== undefined ? (
        <p className="text-sm leading-normal text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
