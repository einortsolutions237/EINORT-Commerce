import type {
  PageDocument,
  SectionInstance,
  ThemeTokens,
} from "@/server/theming/schema";

/**
 * EDIT-02. The storefront editor's draft state, as a pure function.
 *
 * THIS LOGIC LIVES HERE AND NOT IN THE EDITOR COMPONENT, AND MOVING IT INTO ONE
 * WOULD DELETE ITS ENTIRE TEST SUITE. `vitest.config.ts` runs the `unit`
 * project with `environment: "node"`, no jsdom and no testing-library, so
 * component behaviour is untestable in this repository by construction — every
 * existing "component" test under `tests/unit/` is a source scan or a pure-logic
 * test. A reorder handler inlined into a `useReducer` callback is EDIT-02's core
 * behaviour with zero automated coverage. The component calls this; it does not
 * reimplement it.
 *
 * Three rules are encoded here rather than in the UI:
 *
 *   1. D-05 — moving the first section up, or the last one down, is a SILENT
 *      NO-OP. Membership is fixed and only order varies, so "you cannot move
 *      this further" is a fact about the list rather than a mistake to report.
 *      The rail's disabled button mirrors this rule; it never enforces it.
 *   2. Pitfall 8 — `set-field` writes the COMPLETE settings object for its
 *      section and never deep-merges a patch into it. A merge makes "clear this
 *      field" restore the template default instead of clearing it, and the Zod
 *      schema is written to validate a complete object every time.
 *   3. D-07 — every change returns NEW state and new nested objects. The editor
 *      pushes the whole document over `postMessage` on every action, so a
 *      mutated object both defeats React's re-render check and leaves the
 *      preview showing stale copy while the state is technically correct.
 *
 * D-06 and D-08 are visible here as absences: there is no add-section and no
 * remove-section action, and nothing in this file publishes. The draft never
 * reaches the server during editing — it lives in the merchant's browser and
 * travels only between two documents that browser already has open.
 *
 * Pure in the strict sense: no clock read, no randomness, no I/O. A section id
 * is supplied by the caller precisely so this stays a function of
 * `(state, action)` alone, which is what makes it exhaustively testable.
 */

/**
 * Everything the editor holds. `document` and `tokens` are the two things that
 * get saved; `selectedSectionId` and `dirty` are chrome.
 *
 * THE ARRAY INDEX IS THE ORDER. There is no separate ordering field on a
 * section, here or in the stored document — two representations of one ordering
 * is how they drift apart.
 */
export type EditorState = {
  document: PageDocument;
  tokens: ThemeTokens;
  selectedSectionId: string | null;
  dirty: boolean;
};

/**
 * Every edit the merchant can make, as data.
 *
 * `set-field`'s `value` is `unknown` because the field descriptors that drive
 * the settings panel are a homogeneous table, so the panel cannot know the
 * narrowed type of the field it is writing. Validation is not skipped, it is
 * relocated: `pageDocumentSchema` parses the result at the publish gate and
 * again inside the preview iframe, both of which refuse a bad document.
 */
export type EditorAction =
  | { kind: "select"; sectionId: string }
  | { kind: "move-up"; sectionId: string }
  | { kind: "move-down"; sectionId: string }
  | { kind: "set-field"; sectionId: string; key: string; value: unknown }
  | { kind: "set-token"; key: keyof ThemeTokens; value: string }
  | { kind: "reset"; state: EditorState };

/**
 * A new section list with the entries at `index` and `index + 1` exchanged.
 *
 * Module-private, and expressed as a single swap rather than a splice-and-
 * reinsert: a swap cannot change the list's length, which is the D-05 invariant
 * stated as code instead of as a comment.
 */
function swapped(
  sections: readonly SectionInstance[],
  index: number,
): SectionInstance[] {
  const next = [...sections];
  const moved = next[index];
  next[index] = next[index + 1];
  next[index + 1] = moved;
  return next;
}

/**
 * One section with `key` set to `value`, as a whole new settings object.
 *
 * THE CAST IS THE ONE THE ACTION'S SHAPE FORCES, AND IT IS CONTAINED TO THIS
 * LINE. `settings` is narrowed by `section.type`, but the editor's field
 * descriptors are a data table, so TypeScript cannot prove that a descriptor's
 * `key` belongs to the shape being written — a computed key widens the spread
 * to an index signature no union member accepts. Widening the union or making
 * `settings` a `Record<string, unknown>` would buy the assertion back at the
 * cost of the renderer's cast-free switch, which is the whole reason the
 * document is a discriminated union. The result is re-parsed by
 * `pageDocumentSchema` at every boundary that stores or renders it.
 */
function withSetting(
  section: SectionInstance,
  key: string,
  value: unknown,
): SectionInstance {
  return {
    ...section,
    settings: { ...section.settings, [key]: value },
  } as SectionInstance;
}

/**
 * `(state, action)` → next state. Never mutates `state`.
 *
 * The switch is exhaustive over `action.kind` and carries NO `default` arm on
 * purpose: a seventh action must be a COMPILE error here. A default that
 * returned `state` unchanged would instead make the new action silently do
 * nothing — legal-looking, untested, and discovered by a merchant whose button
 * does not work.
 */
export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.kind) {
    case "select":
      // Deliberately does not set `dirty`: looking at a section is not an edit,
      // and dirtying here would arm the leave-guard for a merchant who only
      // clicked around.
      return { ...state, selectedSectionId: action.sectionId };

    case "move-up": {
      const index = state.document.sections.findIndex(
        (section) => section.id === action.sectionId,
      );
      // Unknown id, or already first. Both are no-ops, and both leave `dirty`
      // exactly as it was — a refused move is not an unsaved change.
      if (index <= 0) return state;
      return {
        ...state,
        document: {
          ...state.document,
          sections: swapped(state.document.sections, index - 1),
        },
        dirty: true,
      };
    }

    case "move-down": {
      const index = state.document.sections.findIndex(
        (section) => section.id === action.sectionId,
      );
      if (index < 0 || index >= state.document.sections.length - 1) {
        return state;
      }
      return {
        ...state,
        document: {
          ...state.document,
          sections: swapped(state.document.sections, index),
        },
        dirty: true,
      };
    }

    case "set-field": {
      const index = state.document.sections.findIndex(
        (section) => section.id === action.sectionId,
      );
      if (index < 0) return state;
      const sections = [...state.document.sections];
      sections[index] = withSetting(sections[index], action.key, action.value);
      return {
        ...state,
        document: { ...state.document, sections },
        dirty: true,
      };
    }

    case "set-token":
      return {
        ...state,
        tokens: { ...state.tokens, [action.key]: action.value },
        dirty: true,
      };

    case "reset":
      // Wholesale replacement, and `dirty` is forced false rather than copied:
      // this is what a completed save and a discard both dispatch, and in both
      // cases the incoming document IS the saved truth by definition.
      return { ...action.state, dirty: false };
  }
}
