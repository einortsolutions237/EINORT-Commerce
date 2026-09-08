"use client";

import type { ReactElement } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import type { TemplateSectionRef } from "@/server/theming/schema";
import { TemplateThumbnail } from "./template-thumbnail";

/**
 * The shared D-05 fallback branch (05.1-UI-SPEC.md § D-05 Fallback), pulled
 * out of `template-picker.tsx` in quick task 260908-bv1 so the picker grid's
 * card and the editor's new spotlight card (`current-template-card.tsx`)
 * cannot silently diverge on which image renders for a given tile.
 *
 * ---------------------------------------------------------------------------
 * THIS IS THE ONLY PLACE `previewUrl !== null ? <Image> : <TemplateThumbnail>`
 * IS DECIDED. DO NOT RE-INLINE IT AT A CALL SITE.
 * ---------------------------------------------------------------------------
 * `tile.previewUrl` is decided in the RSC from `TEMPLATE_PREVIEWS` manifest
 * state BEFORE render, never via an `onError` handler (T-05.1-27) — that
 * decision already happened by the time this component runs; it only
 * branches on the value it was handed. `tests/unit/template-picker-contract
 * .test.ts` pins both halves of this branch (D-05 fallback) and that the
 * `<Image>` here never gains `priority` (T-05.1-26) or `onError` (T-05.1-27)
 * against THIS file, not `template-picker.tsx`, now that the branch lives
 * here.
 *
 * `sizes` is a required prop, never hardcoded here — the picker grid card and
 * the spotlight card render at genuinely different widths (a responsive
 * breakpoint list vs. a single fixed rail width), and baking either one in
 * would silently mis-size the other caller's `<Image>`.
 */
export function TemplateMedia({
  previewUrl,
  sections,
  primaryAccent,
  sizes,
  imageClassName,
  fallbackClassName,
}: {
  readonly previewUrl: string | null;
  readonly sections: readonly TemplateSectionRef[];
  readonly primaryAccent: string;
  readonly sizes: string;
  readonly imageClassName?: string;
  readonly fallbackClassName?: string;
}): ReactElement {
  if (previewUrl !== null) {
    return (
      <Image
        src={previewUrl}
        alt=""
        fill
        sizes={sizes}
        className={cn(
          "object-cover object-top transition-transform duration-200 motion-reduce:transform-none motion-reduce:transition-none",
          imageClassName,
        )}
      />
    );
  }

  return (
    <TemplateThumbnail
      sections={sections}
      primaryAccent={primaryAccent}
      className={cn(
        "h-full w-full aspect-auto min-w-0 rounded-none border-0",
        fallbackClassName,
      )}
    />
  );
}
