"use client";

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

import { strings } from "@/lib/strings";
import type { FieldDescriptor } from "@/server/theming/registry";

import { FieldRenderer } from "./field-renderer";

/**
 * EDIT-02 — the rail's settings-panel view (04-UI-SPEC.md § The rail).
 *
 * ---------------------------------------------------------------------------
 * THIS IS A PUSH/POP, NOT A THIRD PANE.
 * ---------------------------------------------------------------------------
 * Selecting an entry REPLACES the rail's list with this panel plus a back row,
 * Shopify-style. A third pane does not fit at 1024px, which is the width this
 * editor has to work at, and the two-pane layout is what leaves the preview the
 * room it needs to be worth looking at.
 *
 * ---------------------------------------------------------------------------
 * FIELD ORDER IS THE REGISTRY'S, EXACTLY.
 * ---------------------------------------------------------------------------
 * `fields` is rendered in array order with no sort and no grouping.
 * `SECTION_TYPES[type].fields` is the render order by contract (see the header
 * of `src/server/theming/registry.ts`), so reordering that array is a UI change
 * made in one place rather than a second ordering maintained here that can
 * disagree with it.
 *
 * ---------------------------------------------------------------------------
 * MERCHANT-FACING NUDGES LIVE HERE AND NEVER IN THE RENDERED PAGE.
 * ---------------------------------------------------------------------------
 * The `notice` slot is where the contact section's "no WhatsApp number
 * configured" nudge and the product grid's "add your first product" nudge go.
 * The `/preview` route IS the storefront: it serves the same document a
 * customer gets, and a merchant has to see exactly the copy their customers
 * would. A nudge painted into the preview would make the merchant confident
 * about a page nobody else is looking at.
 *
 * ---------------------------------------------------------------------------
 * THIS COMPONENT OWNS NO DRAFT STATE.
 * ---------------------------------------------------------------------------
 * `values` comes down, `onChange(key, value)` goes up, and plan 04-15's
 * `editor-shell.tsx` turns that into a `set-field` action. `set-field` REPLACES
 * the section's complete settings object rather than deep-merging a patch
 * (Pitfall 8) — `editorReducer` already enforces that and there is deliberately
 * no merge logic here to disagree with it.
 *
 * Surface 3 tokens only: blue/gold/slate, Outfit headings via `font-heading`,
 * 0.75rem radius. Neither the merchant's accent token nor the storefront's
 * surface attribute appears anywhere in this file (D-12) — both are deliberately
 * left unspelled here, because the audit for each is a plain grep over this file
 * (the `registry.ts` precedent).
 */

/**
 * The separator between the array key, the index and the field key in a
 * repeatable section's `onChange` key.
 *
 * `blocks.0.icon` is what `trust-bar` emits. The shell splits on this and
 * rebuilds the WHOLE array before dispatching a single `set-field` on `blocks`,
 * because `set-field` replaces a settings key outright and never merges into
 * one (Pitfall 8). The panel deliberately does not rebuild the array itself:
 * doing so here would put a second copy of the document's write semantics in a
 * component that no test in this repository can exercise.
 */
export const REPEATABLE_KEY_SEPARATOR = ".";

/** `blocks.0.icon`, built in one place so the shell can split on the same rule. */
export function repeatableFieldKey(
  arrayKey: string,
  index: number,
  fieldKey: string,
): string {
  return [arrayKey, String(index), fieldKey].join(REPEATABLE_KEY_SEPARATOR);
}

export interface SettingsPanelProps {
  /** The section label, resolved from the `server-only` registry by the RSC. */
  readonly title: string;
  readonly fields: readonly FieldDescriptor[];
  readonly values: Record<string, unknown>;
  /** The Zod `.max()` per key, where one exists. Drives the counters. */
  readonly maxima?: Record<string, number>;
  readonly imageBaseUrl: string;
  /** Rendered ABOVE the fields — see the header. */
  readonly notice?: ReactNode;
  /**
   * `SECTION_TYPES[type].repeatable` — the settings key holding an array of
   * blocks, when the section has one. `trust-bar` is the only such type this
   * phase (D-06). Where it is set, `fields` describes ONE ITEM of that array and
   * this panel repeats the list per block rather than rendering it once.
   *
   * Optional and absent for every other section, so a caller that only knows
   * about the scalar case is unaffected.
   */
  readonly repeatable?: string;
  readonly onBack: () => void;
  readonly onChange: (key: string, value: unknown) => void;
}

/**
 * The block list for a repeatable section.
 *
 * NO ADD AND NO REMOVE HERE EITHER (D-06). The block count is whatever the
 * document already holds; the merchant edits what is there and cannot change how
 * many there are, for the same reason they cannot add a section.
 */
function RepeatableFields({
  arrayKey,
  fields,
  blocks,
  maxima,
  imageBaseUrl,
  onChange,
}: {
  readonly arrayKey: string;
  readonly fields: readonly FieldDescriptor[];
  readonly blocks: readonly Record<string, unknown>[];
  readonly maxima?: Record<string, number>;
  readonly imageBaseUrl: string;
  readonly onChange: (key: string, value: unknown) => void;
}) {
  return (
    <>
      {blocks.map((block, index) => (
        <div
          key={`${arrayKey}-${index}`}
          role="group"
          /*
           * The block's own heading names the group, so the three identical
           * field labels inside are distinguishable to a screen reader without
           * inventing a "Block {n}" string the copy catalogue does not have —
           * and merchant content is the more useful name anyway.
           */
          aria-label={
            typeof block.heading === "string" && block.heading !== ""
              ? block.heading
              : undefined
          }
          className="flex flex-col gap-6 border-t border-border pt-6 first:border-t-0 first:pt-0"
        >
          {fields.map((field) => (
            <FieldRenderer
              key={field.key}
              descriptor={field}
              value={block[field.key]}
              max={maxima?.[field.key]}
              imageBaseUrl={imageBaseUrl}
              onChange={(value) =>
                onChange(repeatableFieldKey(arrayKey, index, field.key), value)
              }
            />
          ))}
        </div>
      ))}
    </>
  );
}

/** The stored blocks, narrowed from `unknown` without trusting their shape. */
function readBlocks(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null,
  );
}

export function SettingsPanel({
  title,
  fields,
  values,
  maxima,
  imageBaseUrl,
  notice,
  repeatable,
  onBack,
  onChange,
}: SettingsPanelProps) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onBack}
        className="flex min-h-11 items-center gap-2 border-b border-border px-4 py-2 text-left text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
        {strings.editor.railBack}
      </button>

      <div className="flex flex-col gap-6 px-4 py-6">
        <h2 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-foreground">
          {title}
        </h2>

        {notice === undefined ? null : notice}

        {repeatable === undefined ? (
          fields.map((field) => (
            <FieldRenderer
              key={field.key}
              descriptor={field}
              value={values[field.key]}
              max={maxima?.[field.key]}
              imageBaseUrl={imageBaseUrl}
              onChange={(value) => onChange(field.key, value)}
            />
          ))
        ) : (
          <RepeatableFields
            arrayKey={repeatable}
            fields={fields}
            blocks={readBlocks(values[repeatable])}
            maxima={maxima}
            imageBaseUrl={imageBaseUrl}
            onChange={onChange}
          />
        )}
      </div>
    </div>
  );
}
