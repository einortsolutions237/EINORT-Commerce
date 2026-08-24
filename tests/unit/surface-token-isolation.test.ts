import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The two-surface design split, asserted against the source.
 *
 * This project runs two design systems at once. The merchant platform
 * (`src/app/(dashboard)/dashboard/**`) is blue/gold/slate with Outfit headings
 * and a 0.75rem radius; the customer storefront (`src/app/s/[slug]/**`) is
 * zinc-monochrome editorial with no Outfit and a 0.25rem radius. They share one
 * `globals.css`, so the split is held by exactly two things: the
 * `[data-surface="storefront"]` scope in that file, and the discipline of
 * writing semantic utilities (`bg-background`, `border-border`) instead of
 * palette ones (`bg-zinc-50`).
 *
 * The scope is structural and cannot be forgotten. The discipline can, and once
 * already was: incident 260823-gu4 leaked the storefront's zinc palette across
 * the entire merchant platform and cost a full retrofit. The failure mode is
 * nasty because nothing breaks — the app compiles, every behavioural test
 * passes, and the damage is only visible to someone who opens the right page on
 * the right surface and recognises the wrong colour.
 *
 * A grep over the source is the only guard that survives a contributor who has
 * not read 03-UI-SPEC.md. This file is that grep, run by CI instead of
 * remembered by a human. It reads files from disk and matches text — it imports
 * no application code, touches no database, and opens no socket, which is why
 * it lives in the `unit` project.
 *
 * IT MUST NOT PASS VACUOUSLY. A scan over an empty directory — after a rename,
 * a moved route group, a typo in a path below — would report "no violations"
 * with total confidence and zero coverage. Each ban therefore pins that it
 * actually examined a non-zero number of files before asserting anything about
 * them. Ban 5 is the single documented exception, for the reason given there.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Both surfaces plus the shared component library. Bans 1, 2 and 4 apply here.
 *
 * `src/components` is in scope on purpose even though most of it is unmodified
 * shadcn registry output: `components.json` still carries `"baseColor": "zinc"`,
 * which is vestigial under `cssVariables: true` but does occasionally cause the
 * CLI to emit a hardcoded `zinc-*` utility. Reviewing every `shadcn add` by eye
 * is the instruction; this is the version of it that does not get skipped.
 */
const SHARED_DIRS = ["src/app", "src/components"] as const;

/** Surface B. Bans 3 and 4 are statements about this tree specifically. */
const STOREFRONT_DIR = "src/app/s";

/**
 * Surface A's product pages. Ban 5's scope.
 *
 * Written with the literal parentheses of the route group, because that is what
 * is on disk — `(dashboard)` is a directory name, not a glob.
 */
const PRODUCTS_DIR = "src/app/(dashboard)/dashboard/products";

interface SourceLine {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/** Every `.tsx` file under a directory, recursively, as repo-relative paths. */
function tsxFilesUnder(dir: string): string[] {
  const absolute = join(repoRoot, dir);
  if (!existsSync(absolute)) return [];

  const found: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...tsxFilesUnder(child));
    } else if (entry.name.endsWith(".tsx")) {
      found.push(child);
    }
  }
  return found;
}

/**
 * Every line of every file, with comment lines blanked.
 *
 * Blanked rather than dropped so the reported line numbers still point at the
 * real line in the real file — a failure message that says "line 41" and means
 * line 41 is the difference between an instruction and a puzzle.
 *
 * Comments must be excluded or the guard eats itself: the comment above
 * `[data-surface="storefront"]` in the storefront layout has to be able to say
 * "do not reach for `bg-zinc-50` here" in order to explain the rule, and the
 * doc comment in `src/components/ui/sonner.tsx` has to be able to name what it
 * is avoiding. A rule whose own documentation violates it does not survive its
 * first reader.
 *
 * Only whole-line comments are stripped: a line whose first non-space character
 * begins a line comment, and a line whose first non-space character is the
 * asterisk continuing a block comment. (Both patterns are spelled out in the
 * regexes below rather than here — a doc comment cannot contain the first one
 * without closing itself.) A trailing comment after
 * live code is deliberately still matched: `className="p-4" // was bg-zinc-50`
 * sits on a line that also ships code, and treating half a line as documentation
 * is how an exemption becomes a loophole.
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

const sharedFiles = SHARED_DIRS.flatMap(tsxFilesUnder).sort();
const sharedLines = codeLinesIn(sharedFiles);

const storefrontFiles = tsxFilesUnder(STOREFRONT_DIR).sort();
const storefrontLines = codeLinesIn(storefrontFiles);

const productsFiles = tsxFilesUnder(PRODUCTS_DIR).sort();
const productsLines = codeLinesIn(productsFiles);

/**
 * A hex colour, `oklch(`, `rgb(`/`rgba(` or `hsl(`/`hsla(`.
 *
 * The hex arm requires a full 6 (or 8, with alpha) digits so that an anchor
 * like `href="#faq"` or a fragment link is not mistaken for a colour. Three-digit
 * shorthand is given up deliberately: catching `#fff` would also catch `#abc`
 * and every other three-letter fragment, and a false positive in a build-failing
 * guard is worse than a narrow one — the palette ban below catches the realistic
 * version of this mistake anyway.
 */
const LITERAL_COLOUR = /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b|\boklch\(|\brgba?\(|\bhsla?\(/;

/** Tailwind's built-in palette scales. Semantic tokens only, on both surfaces. */
const PALETTE_UTILITY =
  /\b(zinc|slate|blue|amber|emerald|red|green|yellow|indigo|gray)-[0-9]{2,3}\b/;

/**
 * Merchant-only signals, banned on the storefront.
 *
 * `border-success` is included alongside the three the spec names
 * (`--success`, `text-success`, `bg-success`) because a green hairline
 * communicates the same thing a green chip does, and an enumeration that stops
 * one utility short of the idea it is protecting is an invitation.
 */
const MERCHANT_ONLY_SIGNAL =
  /\bfont-heading\b|gold-accent|(?:--|text-|bg-|border-)success\b/;

const STOREFRONT_SURFACE_ATTRIBUTE = /data-surface=["']storefront["']/;

/**
 * lucide's trash icons, in import and JSX spellings.
 *
 * `trash-2` is the registry name, `Trash2Icon`/`Trash2`/`TrashIcon`/`Trash` are
 * what lucide-react exports and what appears in JSX.
 */
const TRASH_ICON = /\btrash-2\b|\bTrash2?(?:Icon)?\b/;

describe("surface token isolation", () => {
  it("ban 1 — no literal colour value in any component", () => {
    expect(
      sharedFiles.length,
      `No .tsx files were found under ${SHARED_DIRS.join(" or ")}. A source ` +
        "grep that scans nothing passes with zero coverage — update " +
        "SHARED_DIRS in tests/unit/surface-token-isolation.test.ts to the " +
        "directory's new home.",
    ).toBeGreaterThan(0);

    const offenders = sharedLines.filter(({ text }) =>
      LITERAL_COLOUR.test(text),
    );

    expect(
      report(offenders),
      "UI-SPEC ban #1 — a literal colour value appears in a component.\n" +
        "  src/app/globals.css is the only place in this codebase that may " +
        "hold a colour value, because it is the only place that knows which " +
        "surface a token belongs to. A hex or oklch() written into a component " +
        "renders the same on the merchant dashboard and on a customer's " +
        "storefront, which is precisely the distinction both surfaces exist " +
        "to make.\n" +
        "  Use the semantic utility instead — bg-background, text-foreground, " +
        "border-border, bg-primary — and let the scope resolve it.",
    ).toEqual([]);
  });

  it("ban 2 — no Tailwind palette utility in any component", () => {
    expect(
      sharedFiles.length,
      "No .tsx files were scanned for ban 2 — see the message on ban 1.",
    ).toBeGreaterThan(0);

    const offenders = sharedLines.filter(({ text }) =>
      PALETTE_UTILITY.test(text),
    );

    expect(
      report(offenders),
      "UI-SPEC ban #2 — a Tailwind palette utility appears in a component.\n" +
        "  bg-zinc-50 is a fixed colour wearing a utility's clothes: it ignores " +
        '[data-surface="storefront"] entirely, so it renders identically on ' +
        "both surfaces and silently opts that element out of the split. This " +
        "is the exact shape of incident 260823-gu4.\n" +
        "  Map it to the semantic token that means what you meant: page field " +
        "-> bg-background, panel -> bg-card, quiet fill -> bg-muted, hairline " +
        "-> border-border, helper text -> text-muted-foreground, ink fill -> " +
        "bg-primary.\n" +
        "  If the shadcn CLI emitted this, that is expected — components.json " +
        'still carries a vestigial "baseColor": "zinc". Rewrite the generated ' +
        "utility rather than exempting the file.",
    ).toEqual([]);
  });

  it("ban 3 — no merchant-only signal under the storefront tree", () => {
    expect(
      existsSync(join(repoRoot, STOREFRONT_DIR)),
      `${STOREFRONT_DIR} does not exist, so this ban is guarding nothing. ` +
        "Update STOREFRONT_DIR in tests/unit/surface-token-isolation.test.ts.",
    ).toBe(true);

    expect(
      storefrontFiles.length,
      `No .tsx files were found under ${STOREFRONT_DIR}.`,
    ).toBeGreaterThan(0);

    const offenders = storefrontLines.filter(({ text }) =>
      MERCHANT_ONLY_SIGNAL.test(text),
    );

    expect(
      report(offenders),
      "UI-SPEC ban #3 — a merchant-only signal appears on the customer " +
        "storefront.\n" +
        "  font-heading is Outfit, which is Surface A's face; the storefront " +
        "sets headings in font-sans on purpose.\n" +
        "  gold-accent means 'a merchant needs to look at this now' — it has " +
        "no meaning at all to a shopper, and --gold-accent is deliberately not " +
        "declared in the storefront scope, so it would resolve to the merchant " +
        "value and leak the palette.\n" +
        "  --success is worse than useless here (T-03-10): a green chip on an " +
        "order page reads to a customer as a confirmed payment, which is a " +
        "guarantee this platform does not make — every payment on this surface " +
        "is a manual claim awaiting a human. Storefront order status is " +
        "communicated by heading copy, an icon and a rule instead.",
    ).toEqual([]);
  });

  it("ban 4 — no storefront surface attribute outside the storefront tree", () => {
    expect(
      sharedFiles.length,
      "No .tsx files were scanned for ban 4 — see the message on ban 1.",
    ).toBeGreaterThan(0);

    const offenders = sharedLines.filter(
      ({ file, text }) =>
        !file.startsWith(`${STOREFRONT_DIR}/`) &&
        STOREFRONT_SURFACE_ATTRIBUTE.test(text),
    );

    expect(
      report(offenders),
      'UI-SPEC ban #4 — data-surface="storefront" appears outside ' +
        `${STOREFRONT_DIR}.\n` +
        "  The attribute repaints everything beneath it in the zinc storefront " +
        "palette. On a merchant page that is incident 260823-gu4 happening " +
        "again, one subtree at a time.\n" +
        "  It belongs in exactly one place: src/app/s/[slug]/layout.tsx, where " +
        "it wraps the whole storefront once. If a dashboard component needs to " +
        "preview storefront styling, that is a Phase 4 theming concern and not " +
        "this attribute.",
    ).toEqual([]);
  });

  it("ban 5 — no delete-product affordance in the products pages", () => {
    /*
     * The one ban that tolerates an empty scan.
     *
     * The products route tree is built by later plans in this phase, and this
     * guard ships in the first one — it has to be in place before the pages
     * that could violate it exist, or it arrives after the mistake. When the
     * directory is absent there is genuinely nothing to check; when it exists
     * it must contain files, so a rename cannot quietly turn this back into a
     * no-op.
     */
    if (existsSync(join(repoRoot, PRODUCTS_DIR))) {
      expect(
        productsFiles.length,
        `${PRODUCTS_DIR} exists but holds no .tsx files. If the products ` +
          "pages moved, update PRODUCTS_DIR in " +
          "tests/unit/surface-token-isolation.test.ts — otherwise this ban " +
          "silently stops guarding anything.",
      ).toBeGreaterThan(0);
    }

    const offenders = productsLines.filter(({ text }) => TRASH_ICON.test(text));

    expect(
      report(offenders),
      "D-08 violation — a trash/delete affordance appears in the products " +
        "pages.\n" +
        "  Products are never deleted. A product is referenced by the order " +
        "lines of every order that ever contained it, so deleting one either " +
        "orphans a merchant's own sales history or cascades it away. Neither " +
        "is recoverable and neither is what the merchant meant by 'remove ' " +
        "this from my store'.\n" +
        "  Archive instead: set the product inactive so it leaves the " +
        "storefront and stays in the order history. Use an archive or " +
        "eye-off icon, never trash — the icon is the promise, and a trash can " +
        "promises the row is gone.",
    ).toEqual([]);
  });
});
