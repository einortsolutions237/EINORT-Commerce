import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * TMPL-03 / TMPL-04, T-04-24 — asserted against the source rather than
 * against behaviour.
 *
 * `src/server/theming/registry.ts` and `src/server/theming/defaults.ts` both
 * carry `import "server-only"` on line 1. Every section component under
 * `src/app/s/[slug]/sections/**` renders from TWO trees: the live storefront's
 * RSC tree, and `src/app/s/[slug]/preview/preview-canvas.tsx`'s `"use client"`
 * editor iframe. `section-renderer.tsx` pulls in every section in one
 * exhaustive switch, so a `server-only` import anywhere beneath it is not a
 * lint warning — it is a build failure on the editor route, discovered a
 * plan later by someone who did not write the import (05-RESEARCH.md
 * Pitfall 2).
 *
 * No runtime test can catch this the way `single-order-state-writer.test.ts`
 * catches a second `Order.state` writer: a `server-only` violation fails at
 * BUILD time on the editor route, not at test time, and by the time someone
 * notices the editor route will not build, `git blame` points at a commit
 * that only touched `registry.ts` and never ran `next build`. So the check is
 * a source scan, run by CI instead of discovered on a later branch — the same
 * idiom as `tests/unit/single-order-state-writer.test.ts` and
 * `tests/unit/no-tenant-id-param.test.ts`. It lives in the `unit` project
 * because it reads files and matches text — no database, no network, and
 * critically, it must NOT import `@/server/theming/registry` or
 * `@/server/theming/defaults` itself, or it would recreate the exact failure
 * it exists to catch.
 *
 * IT MUST NOT PASS VACUOUSLY. A scan over an empty directory — a rename, a
 * moved module, a typo in a path below — would report "no violation found"
 * with total confidence and zero coverage. The first test pins that both
 * scans actually found files.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** The directory every section component and its RSC-tree siblings live in. */
const SECTION_DIR = "src/app/s/[slug]/sections";

/** Every source file in the repository, scanned for the client-boundary rule. */
const SRC_DIR = "src";

/**
 * `src/generated/**` is the Prisma client output — machine-written, never
 * hand-edited, and irrelevant to this boundary. `eslint.config.mjs` ignores
 * it for the same reason `single-order-state-writer.test.ts` skips it.
 */
const SKIPPED_DIRS = new Set(["generated"]);

/**
 * Matches one whole `import … from "@/server/theming/registry"` (or
 * `/defaults`) statement and captures the clause between `import` and
 * `from` — the part that says WHAT is imported, which is what
 * `isTypeOnlyImportClause` below inspects.
 *
 * `[^;]*?` rather than `[\s\S]*?`: excluding the statement terminator keeps
 * the lazy match from skipping over an earlier, unrelated import statement
 * and misattributing its clause to this one. Every import in this codebase
 * ends in `;` (this repo's ESLint config enforces it), so a clause never
 * legitimately contains one.
 */
const IMPORT_CLAUSE =
  /import\s+([^;]*?)\s+from\s+["']@\/server\/theming\/(?:registry|defaults)["']\s*;?/g;

/**
 * True if an import clause is erased entirely by the TypeScript compiler —
 * either `import type X from "…"` or `import { type A, type B } from "…"` —
 * and therefore never evaluates the target module at runtime, never trips
 * `server-only`'s throw, and never reaches a client bundle.
 *
 * This is the codebase's own established pattern, not an invention of this
 * test: `editor-shell.tsx`, `field-renderer.tsx` and `settings-panel.tsx` all
 * write `import type { FieldDescriptor } from "@/server/theming/registry"`,
 * and `field-renderer.tsx`'s own comment names the reason inline — "It is a
 * literal rather than an import because `src/server/theming/registry.ts`
 * carries `server-only`" — for the one VALUE it needs. A value import (no
 * `type` keyword, or a named import missing the per-specifier `type` prefix)
 * is exactly the shape that reaches the client bundle and is what this
 * boundary actually forbids.
 */
function isTypeOnlyImportClause(clause: string): boolean {
  const trimmed = clause.trim();
  if (/^type\b/.test(trimmed)) return true;

  const braced = trimmed.match(/^\{([\s\S]*)\}$/);
  if (!braced) return false;

  const specifiers = (braced[1] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    specifiers.length > 0 &&
    specifiers.every((specifier) => /^type\s+/.test(specifier))
  );
}

/**
 * Every VALUE-importing `import … from "@/server/theming/registry"` (or
 * `/defaults`) statement in one file — the ones that actually reach a client
 * bundle. A type-only import clause is filtered out; see
 * `isTypeOnlyImportClause`.
 */
function forbiddenValueImports(code: string): string[] {
  const stripped = stripCommentLines(code);
  const offenders: string[] = [];

  IMPORT_CLAUSE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMPORT_CLAUSE.exec(stripped)) !== null) {
    const clause = match[1] ?? "";
    if (!isTypeOnlyImportClause(clause)) {
      offenders.push(match[0].replace(/\s+/g, " ").trim());
    }
  }

  return offenders;
}

/**
 * The one documented client-side exception in `SECTION_DIR`.
 *
 * `reveal.tsx`'s own header comment says it explicitly: "`"use client"` is
 * correct here and nowhere else in this directory." It is a state-free
 * motion primitive with no data dependency and no import of `registry.ts` or
 * `defaults.ts` — assertion 1 below still covers it, unexcepted. Only the
 * marker-literal check (assertion 3) names this one file by name, the same
 * way `theming-registry.test.ts` names its one repeatable section rather
 * than leave a real exception looking like an undetected violation.
 */
const DOCUMENTED_CLIENT_FILE = `${SECTION_DIR}/reveal.tsx`;

/** Every `.ts`/`.tsx` file under a directory, recursively, repo-relative. */
function sourceFilesUnder(dir: string): string[] {
  const absolute = `${repoRoot}/${dir}`;
  if (!existsSync(absolute)) return [];

  const found: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      found.push(...sourceFilesUnder(`${dir}/${entry.name}`));
    } else if (/\.tsx?$/.test(entry.name)) {
      found.push(`${dir}/${entry.name}`);
    }
  }
  return found;
}

/**
 * Blank out comment lines, preserving line count.
 *
 * Without this the guard is self-invalidating: this very file, `render-data.ts`
 * and `schema.ts`'s own header all discuss `@/server/theming/registry` and
 * `server-only` in prose, in order to explain why the rule exists. Matching
 * raw text would flag the documentation that records the rule. The same idiom
 * as `single-order-state-writer.test.ts`'s `stripCommentLines`.
 */
function stripCommentLines(code: string): string {
  return code
    .split("\n")
    .map((line) =>
      /^\s*(?:\/\/|\/\*|\*)/.test(line) ? " ".repeat(line.length) : line,
    )
    .join("\n");
}

/** The first non-blank line of a file, trimmed — where a directive must sit. */
function firstNonBlankLine(code: string): string {
  return code.split("\n").find((line) => line.trim().length > 0)?.trim() ?? "";
}

const CLIENT_DIRECTIVE = /^["']use client["'];?$/;

const repoFiles = sourceFilesUnder(SRC_DIR).sort();
const sectionFiles = sourceFilesUnder(SECTION_DIR).sort();

const fileContents = new Map<string, string>(
  repoFiles.map((file) => [file, readFileSync(`${repoRoot}/${file}`, "utf8")]),
);

/** Every file anywhere under `src/` whose first non-blank line is `"use client"`. */
const clientFiles = repoFiles.filter((file) =>
  CLIENT_DIRECTIVE.test(firstNonBlankLine(fileContents.get(file) ?? "")),
);

describe("theming marker boundary (server-only vs. client-safe sections)", () => {
  it("actually scanned the section tree and the client-component tree", () => {
    expect(
      existsSync(`${repoRoot}/${SECTION_DIR}`),
      `${SECTION_DIR} does not exist. This guard would then scan nothing and ` +
        "pass with zero coverage — update SECTION_DIR to the directory's new " +
        "home.",
    ).toBe(true);

    expect(
      sectionFiles.length,
      `No .ts/.tsx files were found under ${SECTION_DIR}. A vacuous pass is ` +
        "the one failure mode a source-level guard must not have.",
    ).toBeGreaterThanOrEqual(5);

    expect(
      clientFiles.length,
      'No file anywhere under src/ was detected as a "use client" module. ' +
        "Either the repository has no client components (implausible) or " +
        "CLIENT_DIRECTIVE has drifted from how this codebase writes the " +
        "directive — in either case the second guard below is vacuous.",
    ).toBeGreaterThanOrEqual(5);
  });

  it("has no section-tree file importing the server-only registry or defaults module", () => {
    const offenders = sectionFiles.filter(
      (file) => forbiddenValueImports(fileContents.get(file) ?? "").length > 0,
    );

    expect(
      offenders,
      `T-04-24 violation — a file under ${SECTION_DIR} imports ` +
        "@/server/theming/registry or @/server/theming/defaults, both of " +
        'which carry `import "server-only"`. This directory renders from ' +
        "TWO trees: the live storefront's RSC tree and the editor's " +
        '`"use client"` preview canvas, and the second one will not build ' +
        "with a server-only dependency anywhere beneath it.\n" +
        "  FIX: resolve the value server-side in the RSC above this " +
        "component and pass it down as a prop — the `SegmentTile[]` " +
        "precedent in src/app/onboarding/branding/page.tsx.\n" +
        '  WRONG FIX: do not remove `import "server-only"` from ' +
        "registry.ts or defaults.ts to make the import resolve.",
    ).toEqual([]);
  });

  it('has no "use client" file anywhere in src/ importing a VALUE from the server-only registry or defaults module', () => {
    const offenders = clientFiles.filter(
      (file) => forbiddenValueImports(fileContents.get(file) ?? "").length > 0,
    );

    expect(
      offenders,
      "T-04-24 violation — a \"use client\" module imports a runtime VALUE " +
        "from @/server/theming/registry or @/server/theming/defaults. Both " +
        "carry `import \"server-only\"`, and a value import reachable from a " +
        "client component is a Next.js build failure, not a runtime one — it " +
        "will not be caught by any test that only exercises behaviour.\n" +
        "  A `import type { … } from …` reference is fine and does not trip " +
        "this guard — it is erased by the compiler and never evaluates the " +
        "module. See editor-shell.tsx / field-renderer.tsx / " +
        "settings-panel.tsx's `import type { FieldDescriptor }` for the " +
        "sanctioned pattern this codebase already uses.\n" +
        "  FIX: resolve the VALUE in the nearest Server Component and pass it " +
        "down as a prop.\n" +
        '  WRONG FIX: do not remove `import "server-only"` from the module to ' +
        "make the import resolve.",
    ).toEqual([]);
  });

  it('has no section-tree file (other than the documented reveal.tsx exception) marked "use client" or server-only', () => {
    const offenders: string[] = [];

    for (const file of sectionFiles) {
      if (file === DOCUMENTED_CLIENT_FILE) continue;

      const stripped = stripCommentLines(fileContents.get(file) ?? "");

      if (CLIENT_DIRECTIVE.test(firstNonBlankLine(stripped))) {
        offenders.push(`${file} — carries "use client"`);
      }
      if (/^\s*import\s+"server-only"\s*;?\s*$/m.test(stripped)) {
        offenders.push(`${file} — carries import "server-only"`);
      }
    }

    expect(
      offenders,
      `${SECTION_DIR} must stay marker-free, with the one documented ` +
        `exception (${DOCUMENTED_CLIENT_FILE}, a state-free motion primitive ` +
        "with no data dependency — see its own header comment).\n" +
        '  A `"use client"` section component still renders from the RSC ' +
        "tree, so this alone is not a build failure the way a server-only " +
        "import is — but every OTHER file in this directory is deliberately " +
        "marker-free so it can render identically from both trees, and a " +
        "second client-marked file is exactly the kind of quiet drift " +
        "05-RESEARCH.md Pitfall 2 warns about.\n" +
        '  An `import "server-only"` here is always wrong: it is a hard ' +
        "build failure on the editor's preview route.",
    ).toEqual([]);
  });

  it("keeps schema.ts free of an actual server-only import", () => {
    const schemaPath = "src/server/theming/schema.ts";
    const raw = readFileSync(`${repoRoot}/${schemaPath}`, "utf8");
    const stripped = stripCommentLines(raw);

    expect(
      /^\s*import\s+"server-only"\s*;?\s*$/m.test(stripped),
      `${schemaPath} now carries a literal \`import "server-only"\` ` +
        "statement (comments stripped before matching, since the file's own " +
        "header deliberately discusses the string in prose to warn against " +
        "adding it). This file is read by the client preview canvas through " +
        "the section components — a server-only marker here breaks the " +
        "editor route exactly like a violation in registry.ts or defaults.ts " +
        "would.",
    ).toBe(false);
  });
});
