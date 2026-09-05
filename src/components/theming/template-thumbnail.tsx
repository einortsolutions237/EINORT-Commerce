import type { ReactElement } from "react";

import { cn } from "@/lib/utils";
import type {
  SectionType,
  SectionVariant,
  TemplateSectionRef,
} from "@/server/theming/schema";

/**
 * The zero-byte geometric template thumbnail (05-UI-SPEC.md § Template
 * Thumbnail Component, 05-RESEARCH.md Pattern 6).
 *
 * ---------------------------------------------------------------------------
 * RENDERS FROM THE SKELETON. NEVER FROM A STORED IMAGE.
 * ---------------------------------------------------------------------------
 * 50 templates in R2 or `public/` would create a regeneration obligation on
 * every skeleton change, plus real image bytes on the low-end Android this
 * market runs on. This component instead draws a proportional miniature of a
 * template's own `{type, variant}[]` section list — it CANNOT drift from the
 * skeleton it represents, because it is not a second copy of anything, it is
 * a direct geometric read of the same data the real page renders from.
 *
 * Props are exactly `sections` and `primaryAccent` — no template key, no
 * name, no segment. The display name and segment tag render on the card
 * OUTSIDE this frame, per 05-UI-SPEC.md; this component draws only the
 * skeleton's shape.
 *
 * NO "use client". This component holds no state and runs no effect, so it
 * renders inside whichever tree its parent (a Server Component onboarding
 * page, or the "use client" editor picker panel) happens to be in.
 *
 * NEVER IMPORTS `@/server/theming/registry` OR `@/server/theming/defaults`.
 * Both carry `import "server-only"`, and `tests/unit/theming-marker-boundary
 * .test.ts` fails the build if a client-reachable module pulls either in.
 * `@/server/theming/schema` is safe: it is deliberately marker-free (see that
 * file's own header) precisely so components like this one can import its
 * types.
 *
 * COLOUR: EXACTLY ONE BLOCK PER RENDER, VIA THE SINGLE `AccentBlock` BELOW.
 * Every other block is `bg-muted`, `bg-border` or `bg-foreground` — neutral,
 * semantic dashboard tokens, never a literal and never a Tailwind palette
 * utility (`tests/unit/surface-token-isolation.test.ts` bans 1 and 2). The
 * one coloured block is the hero section's miniature (or the contact
 * section's, on the arguably-impossible skeleton with no hero) — the same
 * "accent used once, for the CTA" restraint the real rendered page keeps.
 * `AccentBlock` is the ONLY place in this file that writes a `style`
 * attribute, so the one inline colour value stays trivially auditable.
 *
 * NO TEXT. Purely geometric — legible micro-copy at a 140px-wide thumbnail
 * across 50 templates in a 25-card grid is neither readable nor cheap to
 * render. The frame carries `aria-hidden="true"`; the card's own `Label`
 * (rendered by the caller, outside this component) is the accessible name.
 */

/** Relative vertical weight per section type — hero tallest, band shortest. */
function sectionWeightClass(type: SectionType): string {
  switch (type) {
    case "hero":
      return "flex-[3]";
    case "trust-bar":
      return "flex-[1]";
    case "product-grid":
      return "flex-[2]";
    case "editorial-split":
      return "flex-[2]";
    case "contact":
      return "flex-[1]";
  }
}

/**
 * The index of the one section whose miniature carries `primaryAccent` — the
 * hero, or the contact section on a hero-less skeleton. `-1` (no accent
 * block at all) only if a skeleton somehow has neither, which no real
 * `TEMPLATES` row produces (D-05 fixes hero as one of the five section
 * types), but this stays a lookup rather than an assumption.
 */
function accentSectionIndex(sections: readonly TemplateSectionRef[]): number {
  const heroIndex = sections.findIndex((section) => section.type === "hero");
  if (heroIndex !== -1) return heroIndex;
  return sections.findIndex((section) => section.type === "contact");
}

/** A plain neutral block — no colour, no state, just shape. */
function Block({ className }: { readonly className: string }): ReactElement {
  return <div className={className} />;
}

/**
 * THE ONLY BLOCK IN THIS FILE THAT WRITES `style`.
 *
 * `primaryAccent` is validated Zod state (a hex colour from the template's
 * own default tokens) arriving as a prop, never a literal written here (ban
 * 1) and never a Tailwind palette/brand-accent utility (ban 2 / D-12) — it is
 * a runtime colour value on one `style` attribute, and this function is the
 * only place that attribute exists in the source.
 */
function AccentBlock({
  primaryAccent,
  className,
}: {
  readonly primaryAccent: string;
  readonly className: string;
}): ReactElement {
  return <div className={className} style={{ backgroundColor: primaryAccent }} />;
}

// ---------------------------------------------------------------------------
// Per-type miniatures, each with an inner exhaustive switch on its variant.
//
// Mirrors the discipline `src/app/s/[slug]/sections/section-renderer.tsx`
// and its per-type components already establish: no default arm, explicit
// `: ReactElement` return type, so a thirteenth variant is a compile error
// here rather than a blank block on a live picker.
// ---------------------------------------------------------------------------

function renderHero(
  variant: SectionVariant<"hero">,
  isAccent: boolean,
  primaryAccent: string,
): ReactElement {
  switch (variant) {
    case "full-bleed": {
      const shape = "h-full w-full rounded-sm";
      return isAccent ? (
        <AccentBlock primaryAccent={primaryAccent} className={shape} />
      ) : (
        <Block className={cn(shape, "bg-muted")} />
      );
    }
    case "split": {
      const shape = "h-full w-1/2 rounded-sm";
      return (
        <div className="flex h-full w-full gap-1">
          {isAccent ? (
            <AccentBlock primaryAccent={primaryAccent} className={shape} />
          ) : (
            <Block className={cn(shape, "bg-muted")} />
          )}
          <Block className={cn(shape, "bg-border")} />
        </div>
      );
    }
    case "stack": {
      const shape = "h-1 w-1/4 rounded-full";
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1">
          <Block className="h-1 w-1/2 rounded-full bg-border" />
          <Block className="h-1 w-1/3 rounded-full bg-border" />
          {isAccent ? (
            <AccentBlock primaryAccent={primaryAccent} className={shape} />
          ) : (
            <Block className={cn(shape, "bg-muted")} />
          )}
        </div>
      );
    }
  }
}

function renderTrustBar(variant: SectionVariant<"trust-bar">): ReactElement {
  switch (variant) {
    case "band":
      return (
        <div className="flex h-full w-full items-center justify-center gap-1 rounded-sm bg-muted">
          <Block className="size-1 rounded-full bg-border" />
          <Block className="size-1 rounded-full bg-border" />
          <Block className="size-1 rounded-full bg-border" />
          <Block className="size-1 rounded-full bg-border" />
        </div>
      );
    case "strip":
      return (
        <div className="flex h-full w-full items-center justify-center gap-2 border-y border-border">
          <Block className="size-1 rounded-full bg-border" />
          <Block className="size-1 rounded-full bg-border" />
        </div>
      );
  }
}

function renderProductGrid(
  variant: SectionVariant<"product-grid">,
): ReactElement {
  switch (variant) {
    case "grid":
      return (
        <div className="grid h-full w-full grid-cols-4 gap-1">
          <Block className="aspect-square w-full rounded-sm bg-muted" />
          <Block className="aspect-square w-full rounded-sm bg-muted" />
          <Block className="aspect-square w-full rounded-sm bg-muted" />
          <Block className="aspect-square w-full rounded-sm bg-muted" />
        </div>
      );
    case "dense":
      return (
        <div className="grid h-full w-full grid-cols-6 gap-0.5">
          <Block className="aspect-square w-full rounded-sm bg-muted" />
          <Block className="aspect-square w-full rounded-sm bg-muted" />
          <Block className="aspect-square w-full rounded-sm bg-muted" />
          <Block className="aspect-square w-full rounded-sm bg-muted" />
          <Block className="aspect-square w-full rounded-sm bg-muted" />
          <Block className="aspect-square w-full rounded-sm bg-muted" />
        </div>
      );
    case "showcase":
      return (
        <div className="grid h-full w-full grid-cols-2 gap-1">
          <Block className="h-full w-full rounded-sm bg-muted" />
          <Block className="h-full w-full rounded-sm bg-muted" />
        </div>
      );
  }
}

function renderEditorialSplit(
  variant: SectionVariant<"editorial-split">,
): ReactElement {
  switch (variant) {
    case "split":
      return (
        <div className="flex h-full w-full gap-1">
          <Block className="h-full w-1/2 rounded-sm bg-foreground" />
          <Block className="h-full w-1/2 rounded-sm bg-muted" />
        </div>
      );
    case "banner":
      return <Block className="h-full w-full rounded-sm bg-foreground" />;
  }
}

function renderContact(
  variant: SectionVariant<"contact">,
  isAccent: boolean,
  primaryAccent: string,
): ReactElement {
  switch (variant) {
    case "band": {
      const shape = "h-1 w-1/3 rounded-full";
      return (
        <div className="flex h-full w-full items-center justify-center">
          {isAccent ? (
            <AccentBlock primaryAccent={primaryAccent} className={shape} />
          ) : (
            <Block className={cn(shape, "bg-muted")} />
          )}
        </div>
      );
    }
    case "card": {
      const shape = "h-2/3 w-1/2 rounded-sm border border-border";
      return (
        <div className="flex h-full w-full items-center justify-center rounded-sm bg-muted">
          {isAccent ? (
            <AccentBlock primaryAccent={primaryAccent} className={shape} />
          ) : (
            <Block className={cn(shape, "bg-background")} />
          )}
        </div>
      );
    }
  }
}

/** Dispatches one section ref to its per-type miniature. No default arm. */
function renderSectionMiniature(
  section: TemplateSectionRef,
  isAccent: boolean,
  primaryAccent: string,
): ReactElement {
  switch (section.type) {
    case "hero":
      return renderHero(section.variant, isAccent, primaryAccent);
    case "trust-bar":
      return renderTrustBar(section.variant);
    case "product-grid":
      return renderProductGrid(section.variant);
    case "editorial-split":
      return renderEditorialSplit(section.variant);
    case "contact":
      return renderContact(section.variant, isAccent, primaryAccent);
  }
}

export function TemplateThumbnail({
  sections,
  primaryAccent,
}: {
  readonly sections: readonly TemplateSectionRef[];
  readonly primaryAccent: string;
}): ReactElement {
  const accentIndex = accentSectionIndex(sections);

  return (
    <div
      aria-hidden="true"
      className="aspect-[3/4] rounded-md border border-border bg-background overflow-hidden min-w-[140px]"
    >
      <div className="flex h-full w-full flex-col gap-1 p-1.5">
        {sections.map((section, index) => (
          <div
            key={`${section.type}-${index}`}
            className={cn(
              "flex min-h-0 items-center justify-center",
              sectionWeightClass(section.type),
            )}
          >
            {renderSectionMiniature(
              section,
              index === accentIndex,
              primaryAccent,
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
