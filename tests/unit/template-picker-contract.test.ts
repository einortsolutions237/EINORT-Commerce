import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The picker grid-engine contract, asserted against the source
 * (05.1-UI-SPEC.md § Grid Engine, § Segment Grouping, § Card Anatomy,
 * § D-05 Fallback, § Accessibility; TMPL-06).
 *
 * `template-picker.tsx:136` used to set `grid grid-cols-2 gap-4
 * sm:grid-cols-3` — VIEWPORT breakpoints — inside an editor rail that is a
 * fixed 320px column, so a desktop merchant opening "Change template" got
 * three cards inside ~288px, roughly 85px each. This file pins the fix
 * (Tailwind v4 container queries) and pins that the bug cannot silently
 * return.
 *
 * There is no DOM in either Vitest project (`environment: "node"`), so every
 * assertion here is a source scan over comment-blanked lines — the
 * established pattern (`tests/unit/surface-token-isolation.test.ts`,
 * `tests/unit/dashboard-nav.test.ts`). Comment lines are blanked first so the
 * component's own header comment can explain the rule ("no `sm:grid-cols-*`
 * here") without failing its own scan — load-bearing, since the header must
 * cite the exact deleted string to warn against its return.
 *
 * IT MUST NOT PASS VACUOUSLY. A rename or a move of the picker component
 * would leave every assertion below scanning an empty string and reporting
 * perfect health, so the first test pins that the file was found and is
 * substantial enough to be the real component, not a stub.
 *
 * Quick task 260908-bv1 relocated the D-05 fallback branch itself (the
 * `previewUrl !== null ? <Image> : <TemplateThumbnail>` decision, plus the
 * `priority`/`onError` bans that pin it) out of `template-picker.tsx` and
 * into `template-media.tsx`, shared with the editor's new spotlight card.
 * Those assertions below now scan `MEDIA_FILE`, not `PICKER_FILE` — an
 * extension, not a weakening, since the branch itself physically moved.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** The one file this whole contract is about. */
const PICKER_FILE = "src/components/theming/template-picker.tsx";

/**
 * The D-05 fallback branch's own file, since quick task 260908-bv1 moved it
 * out of `PICKER_FILE` and into here, shared with `current-template-card.tsx`.
 */
const MEDIA_FILE = "src/components/theming/template-media.tsx";

/**
 * Anti-vacuity floor. The shipped (pre-redesign) file is 239 lines; the
 * redesign adds segment grouping, the D-05 fallback branch and a fifth
 * header invariant, so it can only grow. If a future refactor legitimately
 * shrinks the file below this, lower MIN_LINE_COUNT here rather than
 * assuming the scan below is still meaningful.
 */
const MIN_LINE_COUNT = 150;

/**
 * Anti-vacuity floor for `MEDIA_FILE`, mirroring `MIN_LINE_COUNT`'s own
 * rationale — a future rename/deletion of `template-media.tsx` must not
 * make the D-05 fallback assertions below pass vacuously over an empty
 * string.
 */
const MEDIA_MIN_LINE_COUNT = 30;

interface SourceLine {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/**
 * Every line of the picker file, with comment lines blanked — identical
 * discipline to `tests/unit/surface-token-isolation.test.ts`'s
 * `codeLinesIn`. Blanked rather than dropped so a reported line number still
 * points at the real line in the real file.
 */
function codeLinesIn(file: string): SourceLine[] {
  const content = readFileSync(`${repoRoot}/${file}`, "utf8");
  return content.split(/\r?\n/).map((text, index) => ({
    file,
    line: index + 1,
    text: /^\s*\/\//.test(text) || /^\s*\*/.test(text) ? "" : text,
  }));
}

/** `file:line: the offending text`, trimmed, for a failure message. */
function report(offenders: readonly SourceLine[]): string[] {
  return offenders.map(
    ({ file, line, text }) => `${file}:${line}: ${text.trim()}`,
  );
}

/**
 * The exact bug this plan exists to fix: a viewport breakpoint (`sm:`,
 * `md:` or `lg:`) directly ahead of `grid-cols-`, not prefixed by `@` (which
 * would make it a container-query variant — `@lg:grid-cols-2` is the
 * *correct* replacement and must not trip this).
 *
 * Mirrors the plan's own `<verify>` grep exactly:
 * `grep -Ec "(^|[^@])(sm|md|lg):grid-cols-"` — so the real scan and the
 * fixtures below are provably the same predicate, not two checks that
 * resemble each other.
 */
const VIEWPORT_GRID_BREAKPOINT = /(^|[^@])(sm|md|lg):grid-cols-/;

function isViewportGridBreakpointOffender({ text }: SourceLine): boolean {
  return VIEWPORT_GRID_BREAKPOINT.test(text);
}

/** A synthetic line, for the positive and negative controls below. */
function fixture(file: string, text: string): SourceLine {
  return { file, line: 1, text };
}

const rawContent = readFileSync(`${repoRoot}/${PICKER_FILE}`, "utf8");
const codeLines = codeLinesIn(PICKER_FILE);

const mediaRawContent = readFileSync(`${repoRoot}/${MEDIA_FILE}`, "utf8");
const mediaCodeLines = codeLinesIn(MEDIA_FILE);

describe("template picker contract (grid engine, grouping, D-05 fallback)", () => {
  it("actually scanned a real, substantial component file", () => {
    expect(
      rawContent.length,
      `${PICKER_FILE} could not be read, or is empty. A scan over an empty ` +
        "string reports every ban below as passing with zero coverage.",
    ).toBeGreaterThan(0);

    const lineCount = rawContent.split(/\r?\n/).length;
    expect(
      lineCount,
      `${PICKER_FILE} is only ${lineCount} lines — below the ` +
        `MIN_LINE_COUNT (${MIN_LINE_COUNT}) floor in ` +
        "tests/unit/template-picker-contract.test.ts. If the component " +
        "legitimately moved or shrank, update MIN_LINE_COUNT there rather " +
        "than assume this scan still means anything.",
    ).toBeGreaterThan(MIN_LINE_COUNT);
  });

  it("actually scanned a real, substantial media component file", () => {
    expect(
      mediaRawContent.length,
      `${MEDIA_FILE} could not be read, or is empty. A scan over an empty ` +
        "string reports every D-05 fallback ban below as passing with zero " +
        "coverage.",
    ).toBeGreaterThan(0);

    const mediaLineCount = mediaRawContent.split(/\r?\n/).length;
    expect(
      mediaLineCount,
      `${MEDIA_FILE} is only ${mediaLineCount} lines — below the ` +
        `MEDIA_MIN_LINE_COUNT (${MEDIA_MIN_LINE_COUNT}) floor in ` +
        "tests/unit/template-picker-contract.test.ts. If the component " +
        "legitimately moved or shrank, update MEDIA_MIN_LINE_COUNT there " +
        "rather than assume this scan still means anything.",
    ).toBeGreaterThan(MEDIA_MIN_LINE_COUNT);
  });

  it("uses @container for the grid engine (U-01)", () => {
    expect(
      rawContent.includes("@container"),
      `${PICKER_FILE} must wrap each segment group in a \`@container\` div ` +
        "so the grid's column count follows the container's width (the " +
        "editor rail), not the viewport's.",
    ).toBe(true);
  });

  it("uses @lg and @4xl container breakpoints for column count (U-01)", () => {
    expect(
      rawContent.includes("@lg:grid-cols-"),
      `${PICKER_FILE} must contain \`@lg:grid-cols-\` — the 2-column step ` +
        "at a 512px container width (U-01).",
    ).toBe(true);
    expect(
      rawContent.includes("@4xl:grid-cols-"),
      `${PICKER_FILE} must contain \`@4xl:grid-cols-\` — the 3-column step ` +
        "at an 896px container width (U-01).",
    ).toBe(true);
  });

  it("contains no viewport grid-cols breakpoint — the bug this plan deletes", () => {
    const offenders = codeLines.filter(isViewportGridBreakpointOffender);

    expect(
      report(offenders),
      "A viewport breakpoint (`sm:grid-cols-`, `md:grid-cols-` or " +
        "`lg:grid-cols-`) appears on the picker grid. This is the exact " +
        "05.1-06 bug: the editor rail is a fixed ~288px column whose width " +
        "is decoupled from the viewport's, so a viewport breakpoint there " +
        "fires (or doesn't) based on the wrong axis entirely.\n" +
        "  FIX: use a container-query variant (`@lg:grid-cols-`, " +
        "`@4xl:grid-cols-`) inside a `@container` wrapper instead.",
    ).toEqual([]);
  });

  it("uses the 16:10 preview frame aspect ratio (U-04)", () => {
    expect(
      rawContent.includes("aspect-[16/10]"),
      `${PICKER_FILE} must contain \`aspect-[16/10]\` on the preview image ` +
        "frame — matches D-01's crop and the 800×500 WebP the pipeline " +
        "emits.",
    ).toBe(true);
  });

  it("never sets `priority` on the tile image (T-05.1-26)", () => {
    const offenders = mediaCodeLines.filter(({ text }) =>
      /\bpriority\b/.test(text),
    );

    expect(
      report(offenders),
      "The tile <Image> in template-media.tsx must never carry `priority` " +
        "— 50 tiles with `priority` cancels lazy loading and drops several " +
        "MB on a Douala mobile connection at first paint. next/image " +
        "lazy-loads by default; leave it.",
    ).toEqual([]);
  });

  it("contains both branches of the D-05 fallback (previewUrl and TemplateThumbnail)", () => {
    expect(
      mediaRawContent.includes("previewUrl"),
      `${MEDIA_FILE} must branch on \`previewUrl\` to decide between the ` +
        "real preview image and the wireframe fallback (D-05), decided in " +
        "the RSC before render.",
    ).toBe(true);
    expect(
      mediaRawContent.includes("TemplateThumbnail"),
      `${MEDIA_FILE} must still render <TemplateThumbnail> as the silent ` +
        "fallback when a template has no generated preview.",
    ).toBe(true);
    expect(
      rawContent.includes("TemplateMedia"),
      `${PICKER_FILE} must delegate its image/fallback rendering to the ` +
        "shared <TemplateMedia> component (quick task 260908-bv1), not " +
        "re-inline the D-05 branch.",
    ).toBe(true);
  });

  it("never decides the fallback from onError (T-05.1-27)", () => {
    const offenders = mediaCodeLines.filter(({ text }) =>
      /\bonError\b/.test(text),
    );

    expect(
      report(offenders),
      "The D-05 fallback must be decided from manifest state in the RSC " +
        "before render, never via `onError` — an `onError` handler flashes " +
        "a broken image, logs console noise, and cannot catch the " +
        "un-allowlisted-host case at all (next/image throws there instead " +
        "of failing to load).",
    ).toEqual([]);
  });

  it("uses the closed spacing scale on the grid — gap-6, never gap-4 or gap-5 (U-02)", () => {
    const gap4Offenders = codeLines.filter(({ text }) => /\bgap-4\b/.test(text));
    const gap5Offenders = codeLines.filter(({ text }) => /\bgap-5\b/.test(text));

    expect(
      report(gap4Offenders),
      "The grid container must not use `gap-4` (16px) — U-02 sets the " +
        "card grid gap to `gap-6` (24px, the `lg` spacing token).",
    ).toEqual([]);
    expect(
      report(gap5Offenders),
      "The grid container must not use `gap-5` (20px) — that step is not " +
        "in the closed seven-step spacing scale. 05.1-RESEARCH.md's example " +
        "grid uses it; the UI-SPEC deliberately corrects it to `gap-6`.",
    ).toEqual([]);
  });

  it("gives each segment group role=\"group\" + aria-labelledby, and never an <h3> (U-12)", () => {
    expect(
      rawContent.includes('role="group"'),
      `${PICKER_FILE} must wrap each segment group in an element carrying ` +
        '`role="group"`, so a screen reader announces the group boundary ' +
        "(U-12).",
    ).toBe(true);
    expect(
      rawContent.includes("aria-labelledby"),
      `${PICKER_FILE} must point each group's \`aria-labelledby\` at its ` +
        "own heading id.",
    ).toBe(true);

    const h3Offenders = codeLines.filter(({ text }) => /<h3\b/.test(text));
    expect(
      report(h3Offenders),
      "Segment group headings must be a <span> (or <div>), never an " +
        "<h3> — six new heading nodes would distort the onboarding page's " +
        "heading outline. Group semantics are carried by role=\"group\" + " +
        "aria-labelledby instead (U-12).",
    ).toEqual([]);
  });

  it("keeps the Phase 5 lock/inert-card controls (T-05-32 / T-05-35)", () => {
    expect(
      rawContent.includes("disabled="),
      `${PICKER_FILE} must keep the \`disabled=\` wiring on the locked-card ` +
        "radio input.",
    ).toBe(true);
    expect(
      rawContent.includes("aria-disabled"),
      `${PICKER_FILE} must keep \`aria-disabled\` on the locked-card radio ` +
        "input.",
    ).toBe(true);
    expect(
      rawContent.includes(
        "if (currentKey !== undefined && key === currentKey) return;",
      ),
      `${PICKER_FILE} must keep the inert-current-card early return ` +
        "BYTE-IDENTICAL — re-selecting the merchant's existing template " +
        "must never fire the change handler (T-05-35), even if a downgrade " +
        "has since put it above their tier.",
    ).toBe(true);
  });

  it("positive control: the offender predicate fires on the exact deleted string", () => {
    expect(
      isViewportGridBreakpointOffender(
        fixture(
          PICKER_FILE,
          'className="grid grid-cols-2 gap-4 sm:grid-cols-3"',
        ),
      ),
      "The viewport-breakpoint predicate does not fire on the exact string " +
        "this plan deletes — VIEWPORT_GRID_BREAKPOINT has drifted, and the " +
        "ban above is passing over nothing.",
    ).toBe(true);
  });

  it("negative control: the offender predicate does not fire on the container-query replacement", () => {
    expect(
      isViewportGridBreakpointOffender(
        fixture(
          PICKER_FILE,
          'className="grid grid-cols-1 gap-6 @lg:grid-cols-2 @4xl:grid-cols-3"',
        ),
      ),
      "The viewport-breakpoint predicate fires on the correct " +
        "container-query replacement string — it must discriminate an " +
        "`@lg:`/`@4xl:` variant from a bare `sm:`/`md:`/`lg:` one, not ban " +
        "the substring `lg:grid-cols-` outright.",
    ).toBe(false);
  });
});
