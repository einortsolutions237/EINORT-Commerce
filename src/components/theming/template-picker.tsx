"use client";

import type { ReactElement } from "react";
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
 * The shared template-picker grid (05-UI-SPEC.md § Onboarding Template
 * Picker, § Editor "Change Template" Action, TMPL-04).
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
   * The merchant's chosen industry — onboarding surface only. U-07
   * repurposes this from "sort" to "which segment group is hoisted first
   * and titled Recommended for you"; unused by this task's render (which
   * maps `tiles` directly) -- consumed by the grouping introduced in
   * 05.1-06.
   */
  readonly sortBySegment?: string;
  readonly error?: string;
}): ReactElement {
  // consumed by the grouping introduced in 05.1-06
  void sortBySegment;

  return (
    <div className="flex flex-col gap-2">
      <RadioGroup
        value={selectedKey ?? undefined}
        onValueChange={(value: unknown) => {
          const key = String(value);
          if (currentKey !== undefined && key === currentKey) return;
          onChange(key);
        }}
        className="grid grid-cols-2 gap-4 sm:grid-cols-3"
      >
        <TooltipProvider>
          {tiles.map((tile) => {
            const isCurrent =
              currentKey !== undefined && tile.key === currentKey;
            const isSelected = isCurrent || selectedKey === tile.key;
            const isRetainedAboveTier = isCurrent && tile.locked;
            const isLocked = tile.locked && !isCurrent;
            const isInert = isLocked || isRetainedAboveTier;
            const tileLabelId = `template-tile-${tile.key}`;
            const tierName = strings.plan[tile.minTier].name;

            const card = (
              <div
                key={tile.key}
                className={cn(
                  "relative flex flex-col rounded-lg border p-2 text-left transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                  isSelected
                    ? "border-primary ring-2 ring-primary"
                    : "border-border hover:bg-accent",
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

                <div className={cn("relative", isLocked && "opacity-60")}>
                  <TemplateThumbnail
                    sections={tile.sections}
                    primaryAccent={tile.primaryAccent}
                  />

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
                    <Badge className="absolute top-1 left-1 bg-primary text-primary-foreground">
                      {strings.editor.templateCurrentBadge}
                    </Badge>
                  ) : null}
                </div>

                <Label
                  id={tileLabelId}
                  className="mt-2 px-1 text-sm leading-normal font-semibold text-foreground"
                >
                  {tile.name}
                </Label>
                <p className="mt-1 px-1 text-sm leading-normal text-muted-foreground">
                  {tile.segmentTag}
                </p>

                {isRetainedAboveTier ? (
                  <p className="mt-1 px-1 text-sm leading-normal text-muted-foreground">
                    {strings.editor.templateRetainedCaption}
                  </p>
                ) : null}
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
        </TooltipProvider>
      </RadioGroup>

      {error !== undefined ? (
        <p className="text-sm leading-normal text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
