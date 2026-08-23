import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * TEN-04, asserted against the source rather than against behaviour.
 *
 * The dashboard's tenant identity has exactly one provenance:
 * `session.session.activeOrganizationId`, read inside
 * `requireMerchantContext()`. Every runtime test in
 * `tests/isolation/merchant-context.test.ts` proves that the *current* code
 * honours it. None of them can prove anything about the change that breaks it —
 * and the realistic break is not a wrong value, it is a new parameter:
 *
 *   requireMerchantContext(tenantId)        // "just for the admin view"
 *   switchPlan({ organizationId, tier })    // reads as ordinary REST design
 *   loadDashboard(props.params.storeId)     // a route segment nobody questioned
 *
 * Each of those compiles, passes every behavioural test that does not happen to
 * exercise it, and hands a merchant a field to substitute another tenant's id
 * into. 02-RESEARCH.md § Pitfall 3 names this the shape to reject in review;
 * this file is that review, run by CI instead of remembered by a human.
 *
 * The idiom is `tests/isolation/model-registry-drift.test.ts`'s: derive the
 * truth from what is on disk instead of trusting a list, and fail with a message
 * that names the offending file. It lives in the `unit` project because it reads
 * files and matches text — no database, no network.
 *
 * IT MUST NOT PASS VACUOUSLY. A scan over an empty directory — a rename, a moved
 * module, a typo in a path below — would report "no offending signature found"
 * with total confidence and zero coverage. The first test therefore pins that
 * both directories exist and that a non-zero number of files and exported
 * signatures were actually examined.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/**
 * The directories under the rule, named explicitly.
 *
 * Explicit rather than "everything under src/server" on purpose: the rule is a
 * statement about the merchant surface and the entitlement surface, and a broad
 * glob would sweep in `src/server/tenant/resolve.ts`, whose
 * `resolveTenantBySlug(slug)` parameter is both legitimate and load-bearing —
 * the storefront's tenant genuinely arrives in the hostname. Listing the
 * directories keeps the prohibition true instead of merely wide. Every *file*
 * inside them is picked up automatically, so a module added later is covered
 * without editing this list.
 */
const SCANNED_DIRS = ["src/server/merchant", "src/server/entitlements"] as const;

/**
 * Names that may never appear in an exported signature in those directories.
 *
 * All three are checked, not just `tenantId`: the column is `organizationId` in
 * Better Auth's schema, `tenantId` in this repository's own vocabulary, and
 * `storeId` in the merchant-facing one. A rule that only knew the first spelling
 * would wave the other two through.
 */
const FORBIDDEN = ["tenantId", "organizationId", "storeId"] as const;

/** Every `.ts`/`.tsx` file under a directory, recursively. */
function sourceFilesUnder(dir: string): string[] {
  const absolute = join(repoRoot, dir);
  if (!existsSync(absolute)) return [];

  const found: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFilesUnder(child));
    } else if (/\.tsx?$/.test(entry.name)) {
      found.push(child);
    }
  }
  return found;
}

/**
 * Blank out comments and string/template literals.
 *
 * Every doc comment in these modules *discusses* `activeOrganizationId` and the
 * parameter this file forbids — saying why it is forbidden is the entire point
 * of those comments. Matching raw text would therefore flag the very
 * documentation that records the rule. Characters are replaced with spaces
 * rather than deleted so byte offsets stay aligned with the original source.
 */
function blankNonCode(code: string): string {
  const out = code.split("");
  let i = 0;

  const blankUntil = (end: number) => {
    for (let k = i; k < end && k < out.length; k++) {
      if (out[k] !== "\n") out[k] = " ";
    }
  };

  while (i < code.length) {
    const two = code.slice(i, i + 2);

    if (two === "//") {
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? code.length : end;
      blankUntil(stop);
      i = stop;
      continue;
    }

    if (two === "/*") {
      const end = code.indexOf("*/", i + 2);
      const stop = end === -1 ? code.length : end + 2;
      blankUntil(stop);
      i = stop;
      continue;
    }

    const quote = code[i];
    if (quote === '"' || quote === "'" || quote === "`") {
      let k = i + 1;
      while (k < code.length) {
        if (code[k] === "\\") {
          k += 2;
          continue;
        }
        if (code[k] === quote) {
          k += 1;
          break;
        }
        k += 1;
      }
      blankUntil(k);
      i = k;
      continue;
    }

    i += 1;
  }

  return out.join("");
}

/** Index of the `)` matching the `(` at `open`, or -1. */
function matchParen(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === "(") depth += 1;
    else if (code[i] === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export interface ExportedSignature {
  readonly name: string;
  readonly params: string;
}

/**
 * The parameter list of every exported function in one module.
 *
 * Two declaration forms are recognised, because both appear in this codebase:
 *
 *   export function merchantAction(config: {…}) {…}
 *   export const requireMerchantContext = cache(async (): Promise<…> => {…})
 *
 * The second is why this is a scanner rather than one regular expression: the
 * arrow's parameter list is nested inside a `cache(` call, so the first `(`
 * after the `=` is not the signature. The loop below walks candidate `(` … `)`
 * pairs in order and accepts the first whose closing paren is followed by `=>`
 * (allowing an explicit return-type annotation in between). It stops at a
 * statement-terminating `;`, so a plain data export — `export const PLANS = {…}`
 * — contributes no signature instead of borrowing an arrow from further down
 * the file.
 */
function exportedSignatures(code: string): ExportedSignature[] {
  const source = blankNonCode(code);
  const signatures: ExportedSignature[] = [];

  const fnPattern = /\bexport\s+(?:async\s+)?function\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = fnPattern.exec(source)) !== null) {
    const name = match[1] ?? "";
    // Skip a generic parameter list: `<S extends z.ZodType, R>` holds no `(`.
    const open = source.indexOf("(", match.index + match[0].length);
    if (open === -1) continue;
    const close = matchParen(source, open);
    if (close === -1) continue;
    signatures.push({ name, params: source.slice(open + 1, close) });
  }

  const constPattern = /\bexport\s+const\s+(\w+)\s*(?::[^=;]*)?=/g;
  while ((match = constPattern.exec(source)) !== null) {
    const name = match[1] ?? "";
    let cursor = match.index + match[0].length;

    while (cursor < source.length) {
      const open = source.indexOf("(", cursor);
      if (open === -1) break;

      // A `;` before the next `(` ends the declaration: this export is data.
      const semicolon = source.indexOf(";", cursor);
      if (semicolon !== -1 && semicolon < open) break;

      const close = matchParen(source, open);
      if (close === -1) break;

      const after = source.slice(close + 1);
      // `)` then optionally `: ReturnType` then `=>` is an arrow signature.
      if (/^\s*(?::[^=]*?)?=>/.test(after)) {
        signatures.push({ name, params: source.slice(open + 1, close) });
        break;
      }

      cursor = open + 1;
    }
  }

  return signatures;
}

const scannedFiles = SCANNED_DIRS.flatMap(sourceFilesUnder).sort();

const scanned = scannedFiles.map((file) => ({
  file: relative(".", file).replace(/\\/g, "/"),
  signatures: exportedSignatures(readFileSync(join(repoRoot, file), "utf8")),
}));

const allSignatures = scanned.flatMap((entry) =>
  entry.signatures.map((signature) => ({ ...signature, file: entry.file })),
);

describe("no tenant id parameter", () => {
  it("actually scanned the merchant and entitlement modules", () => {
    for (const dir of SCANNED_DIRS) {
      expect(
        existsSync(join(repoRoot, dir)),
        `${dir} does not exist. This guard would then scan nothing and pass ` +
          "with zero coverage — update SCANNED_DIRS in " +
          "tests/unit/no-tenant-id-param.test.ts to the directory's new home.",
      ).toBe(true);
    }

    expect(
      scannedFiles.length,
      "No .ts files were found under " +
        SCANNED_DIRS.join(" or ") +
        ". A vacuous pass is the one failure mode a source-level guard must " +
        "not have.",
    ).toBeGreaterThan(0);

    expect(
      allSignatures.length,
      "Files were read but no exported function signature was parsed out of " +
        "them, so nothing was actually checked. The scanner in this file has " +
        "drifted from the declaration style used in " +
        SCANNED_DIRS.join(" / ") +
        ".",
    ).toBeGreaterThan(0);
  });

  it("exposes no exported function that accepts a tenant id", () => {
    const offenders = allSignatures.filter(({ params }) =>
      FORBIDDEN.some((name) =>
        new RegExp(`\\b${name}\\b\\s*[?:,)]`).test(params),
      ),
    );

    expect(
      offenders.map(
        ({ file, name, params }) =>
          `${file}: ${name}(${params.replace(/\s+/g, " ").trim()})`,
      ),
      "TEN-04 violation — an exported function in the merchant/entitlement " +
        "surface accepts a tenant identifier as a parameter.\n" +
        "  Tenant identity in the dashboard comes from " +
        "`session.session.activeOrganizationId` inside " +
        "`requireMerchantContext()` and from nowhere else. A parameter is a " +
        "field a caller can set, and a Server Action is reachable by direct " +
        "POST without the form, so this reintroduces exactly the cross-tenant " +
        "substitution both TEN-04 and 02-RESEARCH.md § Pitfall 3 exist to " +
        "close.\n" +
        "  Take the id from the session inside the function instead, and pass " +
        "only the change — never the target.",
    ).toEqual([]);
  });

  it("resolves the dashboard tenant from the session and nowhere else", () => {
    const context = scanned.find(
      (entry) => entry.file === "src/server/merchant/context.ts",
    );

    expect(
      context,
      "src/server/merchant/context.ts was not scanned. It is the only " +
        "sanctioned way to learn the tenant id in the dashboard, so its " +
        "absence means the rule above is guarding a surface that no longer " +
        "has a resolver.",
    ).toBeDefined();

    const resolver = context?.signatures.find(
      (signature) => signature.name === "requireMerchantContext",
    );

    expect(
      resolver,
      "`requireMerchantContext` is not an exported signature in " +
        "src/server/merchant/context.ts.",
    ).toBeDefined();

    expect(
      resolver?.params.trim(),
      "`requireMerchantContext` must take NO parameters, ever. A " +
        "`requireMerchantContext(tenantId)` overload is the precise shape of " +
        "the bug this module exists to prevent.",
    ).toBe("");
  });
});
