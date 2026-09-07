import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { INDUSTRY_SEGMENTS } from "@/server/theming/registry";

import {
  PREVIEW_PLACEHOLDER_PHOTOS,
  previewPlaceholderPhotoFor,
} from "../../scripts/preview-placeholder-photos";

/**
 * D-06's enforcement mechanism, not a comment promising one.
 *
 * `scripts/preview-assets/` holds six commercial-use-safe placeholder
 * photographs that exist strictly to make a template-preview screenshot look
 * like a stocked store (05.1-07). D-06 is explicit that this imagery "must
 * never reach `TEMPLATE_DEFAULTS` or any real merchant's live storefront" —
 * and Phase 5's D-04 already makes a shared stock asset structurally
 * unreferenceable from a template default via `storageKeySchema`'s
 * tenant-prefixed regex. This file is the wall built beside that invariant:
 * a source scan proving neither the asset directory nor the module that
 * points at it is ever named from anywhere under `src/`, with a named
 * assertion against `src/server/theming/defaults.ts` specifically (D-06
 * names that file by name) and fixture controls proving the scan
 * discriminates rather than passing vacuously.
 *
 * It runs in the `unit` project, like `surface-token-isolation.test.ts`,
 * because both Vitest projects use `environment: "node"` and there is no DOM
 * to render against — a source-text scan is the established pattern for a
 * boundary that must hold across every file, not just the ones a component
 * test happens to import.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** The directory this containment test protects. Update here if it moves. */
const SRC_DIR = "src";

/** Where the sanctioned references are allowed to live. */
const SCRIPTS_DIR = "scripts";

interface SourceLine {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/** Every `.ts`/`.tsx` file under a directory, recursively, as repo-relative paths. */
function sourceFilesUnder(dir: string): string[] {
  const absolute = join(repoRoot, dir);
  if (!existsSync(absolute)) return [];

  const found: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...sourceFilesUnder(child));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      found.push(child);
    }
  }
  return found;
}

/**
 * Every line of every file, with comment lines blanked.
 *
 * Copied in shape from `surface-token-isolation.test.ts`'s `codeLinesIn` —
 * load-bearing for the same reason there: the picker's and the defaults
 * module's own headers may legitimately mention this boundary in prose (this
 * very file does, above), and a guard whose own documentation trips it does
 * not survive its first reader. Reported line numbers still point at the real
 * line in the real file because lines are blanked, not dropped.
 */
function codeLinesIn(files: readonly string[]): SourceLine[] {
  const lines: SourceLine[] = [];
  for (const file of files) {
    const content = readFileSync(join(repoRoot, file), "utf8");
    content.split(/\r?\n/).forEach((text, index) => {
      if (/^\s*\/\//.test(text) || /^\s*\*/.test(text)) return;
      lines.push({ file, line: index + 1, text });
    });
  }
  return lines;
}

/** `file:line: the offending text`, trimmed, for a failure message. */
function report(offenders: readonly SourceLine[]): string[] {
  return offenders.map(
    ({ file, line, text }) => `${file}:${line}: ${text.trim()}`,
  );
}

const srcFiles = sourceFilesUnder(SRC_DIR).sort();
const srcLines = codeLinesIn(srcFiles);

const scriptsFiles = sourceFilesUnder(SCRIPTS_DIR).sort();
const scriptsLines = codeLinesIn(scriptsFiles);

const DEFAULTS_FILE = "src/server/theming/defaults.ts";
const defaultsLines = srcLines.filter(({ file }) => file === DEFAULTS_FILE);

/**
 * The two tokens D-06 forbids from crossing into `src/`: the asset
 * directory's own name, and the module's exported constant/import
 * specifier. Kept as two patterns rather than one so a failure message can
 * still name which token tripped, even though the offender predicate below
 * treats either as disqualifying.
 */
const PREVIEW_ASSET_DIR_TOKEN = /\bpreview-assets\b/;
const PREVIEW_MODULE_TOKEN =
  /\bpreview-placeholder-photos\b|\bPREVIEW_PLACEHOLDER_PHOTOS\b/;

/**
 * Ban's rule, as one function, so the real scan and the fixtures below are
 * provably the same check rather than two checks that resemble each other —
 * the `isBrandAccentOffender` shape from `surface-token-isolation.test.ts`.
 *
 * Scoped to `src/` on purpose: `scripts/preview-placeholder-photos.ts` itself
 * necessarily contains both tokens (it is the module they name), and that is
 * the one sanctioned place they are allowed to appear.
 */
function isPreviewAssetOffender({ file, text }: SourceLine): boolean {
  return (
    file.startsWith(`${SRC_DIR}/`) &&
    (PREVIEW_ASSET_DIR_TOKEN.test(text) || PREVIEW_MODULE_TOKEN.test(text))
  );
}

/** A synthetic line, for the positive and negative controls below. */
function fixture(file: string, text: string): SourceLine {
  return { file, line: 1, text };
}

describe("preview photo isolation (D-06)", () => {
  it("scans a non-empty src/ file set (anti-vacuity)", () => {
    expect(
      srcFiles.length,
      `No .ts/.tsx files were found under ${SRC_DIR}/. A source grep scanning ` +
        "nothing passes with zero coverage — update SRC_DIR in " +
        "tests/unit/preview-photo-isolation.test.ts to the directory's new home.",
    ).toBeGreaterThan(0);
  });

  it("the tokens genuinely exist somewhere, under scripts/ (anti-vacuity, other direction)", () => {
    const matches = scriptsLines.filter(
      ({ text }) =>
        PREVIEW_ASSET_DIR_TOKEN.test(text) || PREVIEW_MODULE_TOKEN.test(text),
    );

    expect(
      matches.length,
      "Neither token appears anywhere under scripts/, which means the scan " +
        "below would pass even if it checked nothing at all. " +
        "scripts/preview-placeholder-photos.ts is expected to contain both.",
    ).toBeGreaterThan(0);
  });

  it("comment lines are blanked before scanning", () => {
    const wholeLineComments = srcLines.filter(({ text }) =>
      /^\s*\/\//.test(text) || /^\s*\*/.test(text),
    );

    expect(
      wholeLineComments.length,
      "codeLinesIn no longer strips whole-line comments, so this guard is " +
        "about to fail on its own explanatory prose (this file's own header " +
        "names both tokens). Restore the stripping rather than rewording.",
    ).toBe(0);
  });

  it("the offender predicate fires on a known src/ violation (positive control)", () => {
    expect(
      isPreviewAssetOffender(
        fixture(
          DEFAULTS_FILE,
          "import { PREVIEW_PLACEHOLDER_PHOTOS } from '../../../scripts/preview-placeholder-photos';",
        ),
      ),
      "isPreviewAssetOffender does not fire on an import of " +
        "PREVIEW_PLACEHOLDER_PHOTOS from src/server/theming/defaults.ts — the " +
        "scan below would be passing over nothing. PREVIEW_MODULE_TOKEN or " +
        "isPreviewAssetOffender has drifted.",
    ).toBe(true);

    expect(
      isPreviewAssetOffender(
        fixture(
          "src/components/theming/template-picker.tsx",
          "src='/preview-assets/electronics.jpg'",
        ),
      ),
      "isPreviewAssetOffender does not fire on a component referencing the " +
        "asset directory by path — PREVIEW_ASSET_DIR_TOKEN or " +
        "isPreviewAssetOffender has drifted.",
    ).toBe(true);
  });

  it("the offender predicate does not fire inside scripts/ (negative control)", () => {
    expect(
      isPreviewAssetOffender(
        fixture(
          "scripts/generate-template-previews.ts",
          "import { previewPlaceholderPhotoFor } from './preview-placeholder-photos'; // preview-assets",
        ),
      ),
      "isPreviewAssetOffender fires inside scripts/, where these tokens are " +
        "the whole point. It must discriminate by path, not ban the tokens " +
        "outright.",
    ).toBe(false);
  });

  it("no file under src/ references the placeholder asset directory or module", () => {
    const offenders = srcLines.filter(isPreviewAssetOffender);

    expect(
      report(offenders),
      "D-06 violation — the preview-only placeholder photography has been " +
        "referenced from src/.\n" +
        "  scripts/preview-assets/ and scripts/preview-placeholder-photos.ts " +
        "exist strictly to make a template-preview screenshot look like a " +
        "stocked store (05.1-07). They are not merchant content, not a " +
        "template default, and not a fallback for a missing merchant image.\n" +
        "  Phase 5's D-04 makes shared stock imagery structurally " +
        "unreferenceable from a template default on purpose — " +
        "storageKeySchema's tenant-prefixed regex rejects it. This module " +
        "does not create a back door to it.\n" +
        "  If a template preview genuinely needs this photography, the " +
        "compositing must happen inside the scripts/-only screenshot " +
        "generator, never inside anything src/ ships to a real request.",
    ).toEqual([]);
  });

  it("src/server/theming/defaults.ts specifically references neither token (named assertion)", () => {
    expect(
      existsSync(join(repoRoot, DEFAULTS_FILE)),
      `${DEFAULTS_FILE} does not exist, so this named assertion is guarding ` +
        "nothing. Update DEFAULTS_FILE in " +
        "tests/unit/preview-photo-isolation.test.ts if the module moved.",
    ).toBe(true);

    expect(
      defaultsLines.length,
      `${DEFAULTS_FILE} was found but produced zero scannable lines, which ` +
        "means this assertion would pass over an empty file. That should " +
        "not happen for a real, non-empty source file.",
    ).toBeGreaterThan(0);

    const offenders = defaultsLines.filter(isPreviewAssetOffender);

    expect(
      report(offenders),
      "D-06 violation — src/server/theming/defaults.ts references the " +
        "preview-only placeholder photography. D-06 names this file " +
        "explicitly: the flagship default document must never resolve to " +
        "stock imagery, because Phase 5's D-04 already guarantees every " +
        "TEMPLATE_DEFAULTS row ships with a null backgroundImageKey/imageKey " +
        "— a real merchant supplies their own photos, always.",
    ).toEqual([]);
  });

  it("previewPlaceholderPhotoFor throws for an unknown segment", () => {
    expect(() => previewPlaceholderPhotoFor("not-a-segment")).toThrow();
  });

  it("previewPlaceholderPhotoFor resolves a known segment to a path that exists on disk", () => {
    const path = previewPlaceholderPhotoFor("electronics");
    expect(existsSync(path)).toBe(true);
  });

  it("every one of the six INDUSTRY_SEGMENTS ids resolves to an existing file", () => {
    expect(INDUSTRY_SEGMENTS.length).toBe(6);

    for (const segment of INDUSTRY_SEGMENTS) {
      const path = PREVIEW_PLACEHOLDER_PHOTOS[segment];
      expect(
        path,
        `PREVIEW_PLACEHOLDER_PHOTOS has no entry for segment "${segment}".`,
      ).toBeDefined();
      expect(
        existsSync(path!),
        `previewPlaceholderPhotoFor("${segment}") resolves to "${path}", ` +
          "which does not exist on disk.",
      ).toBe(true);
    }
  });
});
