"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Columns2,
  MessageCircle,
  Package,
  Palette,
  PanelTop,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { strings } from "@/lib/strings";
import type { SectionType } from "@/server/theming/schema";

/**
 * EDIT-02 — the storefront editor rail, list view (04-UI-SPEC.md § The rail).
 *
 * ---------------------------------------------------------------------------
 * THIS COMPONENT OWNS NO DRAFT STATE AND MUST NEVER GROW ANY.
 * ---------------------------------------------------------------------------
 * It renders the sections it is handed and calls back. The reducer that decides
 * what a move means lives in `src/lib/editor/reducer.ts`, where it has a test
 * suite; `vitest.config.ts` runs the `unit` project on `environment: "node"`
 * with no jsdom, so any behaviour inlined here would be EDIT-02's core
 * interaction with zero automated coverage. Plan 04-15's `editor-shell.tsx`
 * owns the `useReducer` and passes `onSelect` / `onMove` down.
 *
 * The one piece of state below is the live-region announcement, which is
 * chrome: it describes a move that already happened in the parent, and it
 * touches nothing that is saved.
 *
 * ---------------------------------------------------------------------------
 * NOTHING IS RENDERED FOR ADDING OR REMOVING A SECTION, AND NOTHING EVER WILL
 * BE. DO NOT "COMPLETE" THIS LIST.
 * ---------------------------------------------------------------------------
 * D-05 fixes membership: this template has exactly five sections and only their
 * order varies. There is deliberately no add control, no remove control, no
 * overflow menu holding one, and no disabled placeholder for either — a
 * disabled affordance is a promise, and a merchant who taps it files a support
 * question about a capability that does not exist. `editorReducer` has no
 * matching action either, so there is nothing here to call. The footnote at the
 * bottom of the list says the same thing to the merchant in words.
 *
 * ---------------------------------------------------------------------------
 * THE DISABLED REORDER EDGES ARE COURTESY. THE REDUCER IS THE CONTROL.
 * ---------------------------------------------------------------------------
 * `move-up` at index 0 and `move-down` at the last index are SILENT no-ops in
 * the reducer (D-05). The `disabled` attributes below mirror that rule so the
 * edge reads as a fact about the list rather than a mistake to report; they do
 * not enforce it. A merchant who tabs to a disabled button and presses Enter
 * gets nothing, which is exactly what the reducer would have given them.
 *
 * ---------------------------------------------------------------------------
 * SURFACE 3 TOKENS ONLY.
 * ---------------------------------------------------------------------------
 * This directory sits under `(dashboard)`: blue/gold/slate, Outfit headings,
 * 0.75rem radius. The merchant's own accent resolves to nothing here (D-12) and
 * the only place they see it applied is inside the preview iframe, which is a
 * different document. `tests/unit/surface-token-isolation.test.ts` bans 1, 2
 * and 6 fail the build on a literal colour, a palette utility or the merchant
 * accent anywhere in this file.
 *
 * `--primary` gets one new reserved use here: the 2px left rule on the selected
 * row. It does NOT fill the row, and it never travels alone — `aria-current`
 * ships with it, because colour is never the only signal (04-UI-SPEC.md
 * § Accessibility floor, the rule `app-sidebar.tsx` follows for the same reason).
 */

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

/**
 * One glyph per section type, so a merchant scanning the rail reads shapes
 * before words.
 *
 * THE MAP LIVES HERE AND NOT IN `src/server/theming/registry.ts` ON PURPOSE.
 * That module carries `server-only` and, per its own header, icon identities
 * travel out of it as lucide NAME strings precisely so a server module never
 * imports React. A `Record<SectionType, LucideIcon>` is a React value, so it
 * belongs at the `.tsx` boundary — the same split `INDUSTRY_SEGMENT_ICONS`
 * already documents.
 *
 * Typed against `SectionType` rather than written loosely: a sixth member added
 * to the Zod union is a COMPILE error right here instead of a row that renders
 * with no icon.
 */
const SECTION_ICONS: Readonly<Record<SectionType, LucideIcon>> = {
  hero: PanelTop,
  "trust-bar": ShieldCheck,
  "product-grid": Package,
  "editorial-split": Columns2,
  contact: MessageCircle,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** One row's worth of section, already resolved by the RSC. */
export interface SectionListEntry {
  readonly id: string;
  readonly type: SectionType;
  /**
   * `SECTION_TYPES[type].label`, resolved on the server. The registry is
   * `server-only`, so the label arrives as a plain string rather than being
   * looked up here.
   */
  readonly label: string;
}

export interface SectionListProps {
  readonly sections: readonly SectionListEntry[];
  readonly selectedSectionId: string | null;
  /** True while the `Brand & logo` panel is open, so its row reads as current. */
  readonly themeSelected: boolean;
  readonly onSelectTheme: () => void;
  readonly onSelect: (sectionId: string) => void;
  readonly onMove: (sectionId: string, direction: "up" | "down") => void;
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** `Theme` / `Sections`. Label 14/600, tracked out, muted. */
function GroupHeader({
  children,
  className,
}: {
  readonly children: string;
  readonly className: string;
}) {
  return (
    <h3
      className={`px-4 pb-2 text-sm font-semibold tracking-[0.08em] text-muted-foreground uppercase ${className}`}
    >
      {children}
    </h3>
  );
}

/**
 * The shared row shell.
 *
 * The left rule is always two pixels wide and merely transparent when the row
 * is not current, so selecting a row cannot nudge its label sideways.
 */
function rowShellClass(selected: boolean): string {
  return selected
    ? "flex items-stretch border-l-2 border-primary border-b border-b-border bg-accent text-accent-foreground last:border-b-0"
    : "flex items-stretch border-l-2 border-l-transparent border-b border-b-border last:border-b-0";
}

/** A 44px reorder control. Never the enforcement — see the file header. */
function ReorderButton({
  label,
  disabled,
  onClick,
  children,
}: {
  readonly label: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-11 shrink-0 items-center justify-center self-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

export function SectionList({
  sections,
  selectedSectionId,
  themeSelected,
  onSelectTheme,
  onSelect,
  onMove,
}: SectionListProps) {
  /*
   * The id of the section the merchant last moved, plus a nonce.
   *
   * The announced position is read from `sections` at render time rather than
   * computed at click time: the parent reorders first, so by the time this
   * renders the array already holds the new order and the two cannot disagree.
   * The nonce keys the announcement element so React replaces the node even
   * when the sentence is byte-identical — a live region reports DOM mutations,
   * and moving a section up and straight back down would otherwise be silent.
   */
  const [announced, setAnnounced] = useState<{
    sectionId: string;
    nonce: number;
  } | null>(null);

  function handleMove(sectionId: string, direction: "up" | "down") {
    onMove(sectionId, direction);
    setAnnounced((previous) => ({
      sectionId,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
  }

  const movedIndex =
    announced === null
      ? -1
      : sections.findIndex((section) => section.id === announced.sectionId);
  const moveMessage =
    announced === null || movedIndex < 0
      ? null
      : strings.editor.sectionMoved
          .replace("{section}", sections[movedIndex].label)
          .replace("{n}", String(movedIndex + 1))
          .replace("{total}", String(sections.length));

  return (
    <div className="flex flex-col">
      <GroupHeader className="pt-4">{strings.editor.railThemeGroup}</GroupHeader>

      {/* `Brand & logo` — EDIT-02's "swap … colors" lives behind this row. */}
      <div className={rowShellClass(themeSelected)}>
        <button
          type="button"
          onClick={onSelectTheme}
          aria-current={themeSelected ? "true" : undefined}
          className="flex min-h-14 flex-1 items-center gap-3 px-4 text-left text-sm font-semibold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Palette aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{strings.editor.railThemeEntry}</span>
        </button>
      </div>

      <GroupHeader className="pt-6">
        {strings.editor.railSectionsGroup}
      </GroupHeader>

      {/*
       * NO ADD CONTROL AND NO REMOVE CONTROL — see the file header. The list is
       * exactly what the template declares; only the order is the merchant's.
       */}
      <ul className="flex flex-col">
        {sections.map((section, index) => {
          const selected = section.id === selectedSectionId;
          const Icon = SECTION_ICONS[section.type];

          return (
            <li key={section.id} className={rowShellClass(selected)}>
              <button
                type="button"
                onClick={() => onSelect(section.id)}
                aria-current={selected ? "true" : undefined}
                className="flex min-h-14 flex-1 items-center gap-3 overflow-hidden px-4 text-left text-sm font-semibold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{section.label}</span>
              </button>

              <div className="flex shrink-0 items-center pr-2">
                <ReorderButton
                  label={strings.editor.moveSectionUp.replace(
                    "{section}",
                    section.label,
                  )}
                  disabled={index === 0}
                  onClick={() => handleMove(section.id, "up")}
                >
                  <ChevronUp aria-hidden="true" />
                </ReorderButton>
                <ReorderButton
                  label={strings.editor.moveSectionDown.replace(
                    "{section}",
                    section.label,
                  )}
                  disabled={index === sections.length - 1}
                  onClick={() => handleMove(section.id, "down")}
                >
                  <ChevronDown aria-hidden="true" />
                </ReorderButton>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="px-4 pt-4 pb-6 text-sm leading-normal text-muted-foreground">
        {strings.editor.fixedListFootnote}
      </p>

      {/*
       * The move is silent otherwise: nothing about a swapped pair of rows is
       * announced by a screen reader on its own.
       */}
      <div role="status" aria-live="polite" className="sr-only">
        {moveMessage === null ? null : (
          <span key={announced?.nonce}>{moveMessage}</span>
        )}
      </div>
    </div>
  );
}
