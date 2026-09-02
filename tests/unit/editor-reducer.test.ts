import { describe, expect, it } from "vitest";

import { editorReducer, type EditorState } from "@/lib/editor/reducer";
import type { PageDocument, ThemeTokens } from "@/server/theming/schema";

/**
 * EDIT-02 — the reorder and field-edit rules, proved without a browser.
 *
 * THIS SUITE IS THE ONLY AUTOMATED COVERAGE EDIT-02 CAN HAVE. `vitest.config.ts`
 * runs the `unit` project with `environment: "node"`, no jsdom and no
 * testing-library, so a reducer living inside the editor component would be
 * untestable by construction — every existing "component" test in `tests/unit/`
 * is a source scan or a pure-logic test. That is why the logic is here and why
 * these assertions are the specification rather than a regression net.
 *
 * The three rules under test are the ones a UI would otherwise own and get
 * wrong: the two silent reorder edges (D-05), replace-never-merge (Pitfall 8),
 * and immutability (the whole document crosses `postMessage` on every action,
 * so a mutated object defeats React's re-render check and the preview stops
 * updating while the state is technically correct).
 */

/** Five sections in the locked default order, built by hand on purpose. */
function makeDocument(): PageDocument {
  return {
    version: 1,
    sections: [
      {
        id: "s-hero",
        type: "hero",
        settings: {
          eyebrow: "Welcome",
          heading: "New arrivals",
          body: "Everything we're selling right now.",
          ctaLabel: "Shop now",
          ctaHref: "/",
          backgroundImageKey: null,
          overlayOpacity: 0.3,
        },
      },
      {
        id: "s-trust",
        type: "trust-bar",
        settings: {
          blocks: [
            {
              type: "trust-item",
              icon: "truck",
              heading: "Delivery in Douala",
              body: "We'll get your order to you.",
            },
          ],
        },
      },
      {
        id: "s-grid",
        type: "product-grid",
        settings: {
          heading: "What we're selling",
          viewAllLabel: "View all",
          viewAllHref: "/",
          itemCount: 8,
        },
      },
      {
        id: "s-split",
        type: "editorial-split",
        settings: {
          eyebrow: "About us",
          heading: "A little about this shop",
          body: "Tell customers who you are.",
          ctaLabel: "See what's in stock",
          ctaHref: "/",
          imageKey: null,
        },
      },
      {
        id: "s-contact",
        type: "contact",
        settings: {
          heading: "Questions? Message us.",
          body: "Send us a message on WhatsApp.",
          ctaLabel: "Message us on WhatsApp",
        },
      },
    ],
  };
}

function makeTokens(): ThemeTokens {
  return {
    primaryAccent: "#18181B",
    secondaryAccent: "#71717A",
    announcementText: "Order online. Pay by Mobile Money or on delivery.",
    footerTagline: "Thanks for shopping with us.",
  };
}

function makeState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    document: makeDocument(),
    tokens: makeTokens(),
    selectedSectionId: null,
    dirty: false,
    ...overrides,
  };
}

/** The section ids in their current order — the only ordering there is. */
function order(state: EditorState): string[] {
  return state.document.sections.map((section) => section.id);
}

const DEFAULT_ORDER = [
  "s-hero",
  "s-trust",
  "s-grid",
  "s-split",
  "s-contact",
];

describe("editorReducer — reorder edges (D-05)", () => {
  it("treats move-up on the first section as a silent no-op", () => {
    // NOT an error. D-05 fixes membership and only order varies, so "you
    // cannot move this further" is a fact about the list, not a mistake the
    // merchant made. The disabled button in the rail mirrors this; it is
    // courtesy, never the control.
    const state = makeState();
    const next = editorReducer(state, { kind: "move-up", sectionId: "s-hero" });
    expect(next).toEqual(state);
  });

  it("treats move-down on the last section as a silent no-op", () => {
    const state = makeState();
    const next = editorReducer(state, {
      kind: "move-down",
      sectionId: "s-contact",
    });
    expect(next).toEqual(state);
  });

  it("treats a move on an unknown section id as a no-op", () => {
    // A stale id can arrive from a queued click after a reset. Refusing it
    // quietly is right; throwing would take the editor down over nothing.
    const state = makeState();
    expect(
      editorReducer(state, { kind: "move-up", sectionId: "s-nope" }),
    ).toEqual(state);
    expect(
      editorReducer(state, { kind: "move-down", sectionId: "s-nope" }),
    ).toEqual(state);
  });

  it("leaves dirty untouched on a no-op move", () => {
    // A refused move is not an unsaved change. Flipping dirty here would make
    // the leave-guard fire for a merchant who changed nothing.
    const clean = makeState({ dirty: false });
    expect(
      editorReducer(clean, { kind: "move-up", sectionId: "s-hero" }).dirty,
    ).toBe(false);

    const dirty = makeState({ dirty: true });
    expect(
      editorReducer(dirty, { kind: "move-down", sectionId: "s-contact" }).dirty,
    ).toBe(true);
  });
});

describe("editorReducer — reorder effects", () => {
  it("swaps a section with the one above it and disturbs nothing else", () => {
    const state = makeState();
    const next = editorReducer(state, { kind: "move-up", sectionId: "s-grid" });
    expect(order(next)).toEqual([
      "s-hero",
      "s-grid",
      "s-trust",
      "s-split",
      "s-contact",
    ]);
    expect(next.dirty).toBe(true);
  });

  it("swaps the first two on move-down of the first section", () => {
    const state = makeState();
    const next = editorReducer(state, {
      kind: "move-down",
      sectionId: "s-hero",
    });
    expect(order(next)).toEqual([
      "s-trust",
      "s-hero",
      "s-grid",
      "s-split",
      "s-contact",
    ]);
    expect(next.dirty).toBe(true);
  });

  it("is reversible — up then down restores the original order", () => {
    const state = makeState();
    const moved = editorReducer(state, {
      kind: "move-up",
      sectionId: "s-split",
    });
    const back = editorReducer(moved, {
      kind: "move-down",
      sectionId: "s-split",
    });
    expect(order(back)).toEqual(DEFAULT_ORDER);
  });

  it("does not mutate the state it was given", () => {
    const state = makeState();
    const snapshot = structuredClone(state);
    editorReducer(state, { kind: "move-up", sectionId: "s-grid" });
    expect(state).toEqual(snapshot);
  });
});

describe("editorReducer — set-field (Pitfall 8)", () => {
  it("writes the value it was given and does not restore a default", () => {
    // The whole of Pitfall 8 in one assertion: clearing a field must leave it
    // cleared. A deep merge would drop the empty string and the template's
    // default copy would reappear, which reads as the editor refusing the edit.
    const state = makeState();
    const next = editorReducer(state, {
      kind: "set-field",
      sectionId: "s-hero",
      key: "eyebrow",
      value: "",
    });
    const hero = next.document.sections[0];
    expect(hero.type).toBe("hero");
    expect(hero.settings).toMatchObject({ eyebrow: "" });
    expect(next.dirty).toBe(true);
  });

  it("replaces the settings object rather than editing it in place", () => {
    const state = makeState();
    const before = state.document.sections[0].settings;
    const next = editorReducer(state, {
      kind: "set-field",
      sectionId: "s-hero",
      key: "heading",
      value: "Back in stock",
    });
    expect(next.document.sections[0].settings).not.toBe(before);
    expect(before).toMatchObject({ heading: "New arrivals" });
  });

  it("leaves every other key of the target section alone", () => {
    const state = makeState();
    const next = editorReducer(state, {
      kind: "set-field",
      sectionId: "s-hero",
      key: "heading",
      value: "Back in stock",
    });
    expect(next.document.sections[0].settings).toEqual({
      eyebrow: "Welcome",
      heading: "Back in stock",
      body: "Everything we're selling right now.",
      ctaLabel: "Shop now",
      ctaHref: "/",
      backgroundImageKey: null,
      overlayOpacity: 0.3,
    });
  });

  it("leaves every other section untouched", () => {
    const state = makeState();
    const next = editorReducer(state, {
      kind: "set-field",
      sectionId: "s-grid",
      key: "itemCount",
      value: 12,
    });
    expect(next.document.sections[0]).toEqual(state.document.sections[0]);
    expect(next.document.sections[4]).toEqual(state.document.sections[4]);
    expect(order(next)).toEqual(DEFAULT_ORDER);
  });

  it("is a no-op for an unknown section id", () => {
    const state = makeState();
    expect(
      editorReducer(state, {
        kind: "set-field",
        sectionId: "s-nope",
        key: "heading",
        value: "x",
      }),
    ).toEqual(state);
  });

  it("does not mutate the state it was given", () => {
    const state = makeState();
    const snapshot = structuredClone(state);
    editorReducer(state, {
      kind: "set-field",
      sectionId: "s-hero",
      key: "heading",
      value: "Back in stock",
    });
    expect(state).toEqual(snapshot);
  });
});

describe("editorReducer — set-token", () => {
  it("updates only the named token", () => {
    const state = makeState();
    const next = editorReducer(state, {
      kind: "set-token",
      key: "primaryAccent",
      value: "#C2410C",
    });
    expect(next.tokens).toEqual({
      primaryAccent: "#C2410C",
      secondaryAccent: "#71717A",
      announcementText: "Order online. Pay by Mobile Money or on delivery.",
      footerTagline: "Thanks for shopping with us.",
    });
    expect(next.dirty).toBe(true);
  });

  it("leaves the document alone", () => {
    const state = makeState();
    const next = editorReducer(state, {
      kind: "set-token",
      key: "announcementText",
      value: "Free delivery in Douala this week.",
    });
    expect(next.document).toEqual(state.document);
  });

  it("does not mutate the state it was given", () => {
    const state = makeState();
    const snapshot = structuredClone(state);
    editorReducer(state, {
      kind: "set-token",
      key: "secondaryAccent",
      value: "#FDE047",
    });
    expect(state).toEqual(snapshot);
  });
});

describe("editorReducer — select", () => {
  it("sets the selection", () => {
    const next = editorReducer(makeState(), {
      kind: "select",
      sectionId: "s-grid",
    });
    expect(next.selectedSectionId).toBe("s-grid");
  });

  it("does not set dirty — looking at a section is not an edit", () => {
    // If selection dirtied the draft, opening the editor and clicking around
    // would arm the unsaved-changes guard on a document nobody changed.
    expect(
      editorReducer(makeState({ dirty: false }), {
        kind: "select",
        sectionId: "s-grid",
      }).dirty,
    ).toBe(false);
  });

  it("does not touch the document or the tokens", () => {
    const state = makeState();
    const next = editorReducer(state, {
      kind: "select",
      sectionId: "s-contact",
    });
    expect(next.document).toEqual(state.document);
    expect(next.tokens).toEqual(state.tokens);
  });
});

describe("editorReducer — reset", () => {
  it("replaces the state wholesale and clears dirty", () => {
    // What a successful save and a discard both dispatch: the server's copy is
    // now the truth, and nothing is outstanding.
    const edited = editorReducer(makeState(), {
      kind: "set-field",
      sectionId: "s-hero",
      key: "heading",
      value: "Edited",
    });
    expect(edited.dirty).toBe(true);

    const fresh = makeState({ selectedSectionId: "s-grid", dirty: true });
    const next = editorReducer(edited, { kind: "reset", state: fresh });
    expect(next.document).toEqual(fresh.document);
    expect(next.tokens).toEqual(fresh.tokens);
    expect(next.selectedSectionId).toBe("s-grid");
    // Cleared even though the incoming state said otherwise: reset MEANS clean.
    expect(next.dirty).toBe(false);
  });
});

describe("editorReducer — the shape of the state", () => {
  it("carries no ordering field beside the array order", () => {
    // Two representations of one ordering is how they drift. The array index
    // is the order, in the state and in the stored document alike.
    const next = editorReducer(makeState(), {
      kind: "move-up",
      sectionId: "s-grid",
    });
    for (const section of next.document.sections) {
      expect(Object.keys(section).sort()).toEqual(["id", "settings", "type"]);
    }
    expect(Object.keys(next).sort()).toEqual([
      "dirty",
      "document",
      "selectedSectionId",
      "tokens",
    ]);
  });
});
