import type { ReactElement } from "react";

import { strings } from "@/lib/strings";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { TemplateMedia } from "./template-media";
import type { TemplateTile } from "./template-picker";

/**
 * The merchant's current template, spotlighted above the switchable grid
 * (quick task 260908-bv1, CONTEXT.md D-A / D-B). Phase 5.1's redesign
 * (05.1-06) rendered the current template as a large, disabled card sitting
 * among selectable ones — visually redundant, and less like "here is what
 * you have" than a dedicated card above the grid.
 *
 * ---------------------------------------------------------------------------
 * ZERO INTERACTIVE ELEMENTS. THIS IS A T-05-35 MITIGATION BY CONSTRUCTION.
 * ---------------------------------------------------------------------------
 * No selectable radio control, no click handler, no change handler, no form
 * control of any kind renders here. T-05-35's original concern — re-selecting
 * the merchant's own current template must never re-fire a switch, even if a
 * downgrade has since put it above their tier — is not satisfied here by a
 * runtime guard the way the shared picker grid's own inert-current-card
 * early return satisfies it for the grid. It is satisfied structurally:
 * there is no click surface on this card at all, so there is nothing that
 * could fire a switch for the merchant's own current key. A grep-based test
 * gate enforces this by banning the radio-item component and both handler
 * props from ever appearing in this file's source, comments included.
 *
 * No "use client" — this component holds no state and runs no effect, the
 * same reasoning `template-thumbnail.tsx`'s own header gives for staying
 * marker-free. Its only caller, `ChangeTemplatePanel`, is already a Client
 * Component.
 */
export function CurrentTemplateCard({
  tile,
}: {
  readonly tile: TemplateTile;
}): ReactElement {
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-lg border border-primary/40 bg-card ring-2 ring-primary">
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border bg-muted">
        <TemplateMedia
          previewUrl={tile.previewUrl}
          sections={tile.sections}
          primaryAccent={tile.primaryAccent}
          sizes="320px"
        />
      </div>

      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm leading-normal font-semibold text-foreground">
            {tile.name}
          </Label>
          <Badge className="bg-primary text-primary-foreground">
            {strings.editor.templateCurrentBadge}
          </Badge>
        </div>
        <p className="text-sm leading-normal text-muted-foreground">
          {tile.segmentTag}
        </p>

        {tile.locked ? (
          <p className="text-sm leading-normal text-muted-foreground">
            {strings.editor.templateRetainedCaption}
          </p>
        ) : null}
      </div>
    </div>
  );
}
