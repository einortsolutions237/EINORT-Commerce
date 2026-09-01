import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * TEN-03 / DOM-02, asserted against the source rather than against behaviour.
 * Installed by quick task 260901-00j, which fixed the bug described below.
 *
 * A shopper reaches a storefront at `{slug}.{root}` — never at `/s/{slug}`.
 * `src/proxy.ts` classifies the `Host` header and REWRITES `{slug}.{root}/foo`
 * into the internal path `/s/{slug}/foo`; the same file returns a bare 404 for
 * any request whose pathname is `/s` or starts with `/s/`. That 404 is not an
 * oversight, it is the rule: serving merchant-controlled content under the apex
 * host would duplicate every storefront across two origins and drop it inside
 * the apex cookie scope, breaking D-07's cookie separation. The prefix is the
 * proxy's to add, on the way in, and nobody else's to write down.
 *
 * The bug this guard exists to prevent: every link under `src/app/s/[slug]/**`
 * was authored as href={`/s/${slug}/cart`} and friends. The FIRST page load
 * worked, because it arrived already-rewritten and was rendered server-side —
 * so the storefront looked completely healthy. The first CLICK did not, because
 * the browser then requested `/s/{slug}/cart` literally, from the subdomain
 * origin, and the proxy answered 404 with an empty body: a blank page. The
 * entire storefront — product pages, cart, checkout, the payment methods on it
 * — was unreachable past the entry page, and 720/720 tests were green.
 *
 * NO BEHAVIOURAL TEST IN THIS REPOSITORY COULD HAVE CAUGHT IT. There is no
 * end-to-end or browser layer at all: no Playwright, no `test:e2e` script, and
 * nothing that has ever rendered a page or followed a link. The isolation suite
 * calls server functions in-process, so `src/proxy.ts` never runs and the
 * `Host`-header rewrite is never exercised. `tests/unit/proxy.test.ts` tests the
 * proxy correctly but in isolation, and the pages were tested — where they were
 * tested — in isolation from it. Each half of the contract passed alone; the
 * seam between them was the bug. This file is that seam, checked cheaply.
 *
 * WHEN THIS TEST FAILS, MAKE THE LINK ORIGIN-RELATIVE. Write `href="/cart"`,
 * not href={`/s/${slug}/cart`}. NEVER relax the `/s/` check in
 * `src/proxy.ts` to make an existing link work — that "fix" reintroduces the
 * duplicate-origin and cookie-scope holes the check exists to close, and it is
 * a security regression, not a routing convenience.
 *
 * IT MUST NOT PASS VACUOUSLY. A scan that found no files, or a detector that no
 * longer recognises the prefix, would both report "no offenders" with total
 * confidence and zero coverage. Three guards below pin that files were really
 * read, that the detector still fires on the occurrences that are SUPPOSED to
 * match, and that comment-stripping has not turned the whole scan into a no-op.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/**
 * The exact broken shape: the rewrite prefix followed by a template hole.
 *
 * Deliberately NOT the bare string `/s/`. The template-literal form is what an
 * emitted link looks like, and it cleanly excludes the occurrences that are
 * legitimate: `PageProps<"/s/[slug]/cart">` names the filesystem route with a
 * plain string literal, and `src/proxy.ts` itself must obviously keep both the
 * rewrite and the 404. Widening this constant would flag all of them.
 */
const FORBIDDEN_PREFIX = "/s/${";

/** Every path emitted from this tree is a URL a browser will request back. */
const STOREFRONT_DIR = "src/app/s";

/**
 * The one module where the prefix is still correct — on one line.
 *
 * `revalidatePath` addresses the Next.js ROUTE TREE, not the browser. The
 * internal path is the only thing it can be given; rewriting it to "/" would
 * silently stop invalidating the storefront layout after an add-to-cart write,
 * and the stale cart bubble would be blamed on Redis for a week.
 */
const REVALIDATING_MODULES = ["src/server/cart/actions.ts"];

/**
 * Modules that must contain the prefix ZERO times, on any kind of line.
 *
 * `src/server/checkout/actions.ts` used to sit in the list above, holding one
 * legitimate `revalidatePath` occurrence. Quick task 260901-6wq deleted that
 * call: revalidating from the checkout action made Next re-render the open
 * `/checkout` route inside the same Server Action response, whereupon the
 * page's `payable.length === 0 -> redirect("/cart")` guard fired against a
 * basket that was empty precisely because the order had just succeeded, and
 * the shopper lost their confirmation screen. See
 * `tests/unit/checkout-revalidation-race.test.ts`, which is what forbids the
 * call from returning.
 *
 * IT MOVED TO A STRICTER SCOPE RATHER THAN OUT OF SCOPE, DELIBERATELY. Simply
 * dropping it from the list would leave the module UNSCANNED, and this file
 * exists because `trackingPath` in exactly this module had been built with the
 * internal prefix (260901-00j). With no `revalidatePath` left to excuse an
 * occurrence, every occurrence here is now an offender unconditionally.
 */
const NO_PREFIX_MODULES = ["src/server/checkout/actions.ts"];

/** Both scopes, scanned together — neither may be silently skipped. */
const ACTION_MODULES = [...REVALIDATING_MODULES, ...NO_PREFIX_MODULES];

/** The one token that makes an occurrence in an action module legitimate. */
const ALLOWED_ON = "revalidatePath";

/** Machine-written Prisma output — never hand-edited, never a navigation site. */
const SKIPPED_DIRS = new Set(["generated"]);

/** Every `.ts`/`.tsx` file under a directory, recursively, repo-relative. */
function sourceFilesUnder(dir: string): string[] {
  const absolute = join(repoRoot, dir);
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
 * Blank out comment lines, preserving line count and column offsets.
 *
 * Without this the guard is self-invalidating: the rationale comment in
 * `src/app/s/[slug]/store-header.tsx` explains the rule by naming the very
 * prefix it forbids, and so does the header of this file. Documenting a
 * prohibition must not trip it. Characters become spaces rather than being
 * removed so the line numbers in a failure still point at real source.
 *
 * Line-oriented rather than a tokenizer, matching the idiom already used in
 * `tests/unit/single-order-state-writer.test.ts`: `//` lines and JSDoc `*`
 * continuations are what every comment in this repository looks like. A
 * trailing `// …` after live code is left alone, which is the safe direction —
 * it can only cause a false POSITIVE, and a false positive is a failing build
 * somebody reads rather than a silent hole.
 */
function stripCommentLines(code: string): string {
  return code
    .split("\n")
    .map((line) =>
      /^\s*(?:\/\/|\/\*|\*|\{\/\*)/.test(line) ? " ".repeat(line.length) : line,
    )
    .join("\n");
}

interface Occurrence {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/** Every live (non-comment) occurrence of the rewrite prefix in one module. */
function occurrencesIn(file: string, code: string): Occurrence[] {
  const found: Occurrence[] = [];

  stripCommentLines(code)
    .split("\n")
    .forEach((text, index) => {
      let at = text.indexOf(FORBIDDEN_PREFIX);
      while (at !== -1) {
        found.push({
          file,
          line: index + 1,
          text: text.trim().slice(0, 120),
        });
        at = text.indexOf(FORBIDDEN_PREFIX, at + 1);
      }
    });

  return found;
}

function read(file: string): string {
  return readFileSync(join(repoRoot, file), "utf8");
}

/** How to fix it, appended to every failure so the reader is never guessing. */
const REMEDY =
  "\n  A browser-visible navigation target must NOT carry the /s/ rewrite " +
  "prefix: the shopper's origin is already {slug}.{root}, src/proxy.ts adds " +
  "the prefix from the Host header on the way in, and it hard-404s that path " +
  "when a browser requests it directly (TEN-03/DOM-02).\n" +
  '  Write href="/cart", not href={`/s/${slug}/cart`}. Same for redirect() ' +
  "and router.push().\n" +
  `  The ONLY legitimate exception is ${ALLOWED_ON}(), which addresses the ` +
  "Next.js route tree rather than the browser and must keep the internal " +
  "path.\n" +
  "  NEVER relax the /s/ check in src/proxy.ts to make a link work — see the " +
  "header of tests/unit/storefront-link-prefix.test.ts (quick task " +
  "260901-00j).";

const storefrontFiles = sourceFilesUnder(STOREFRONT_DIR).sort();

const storefrontOffenders = storefrontFiles.flatMap((file) =>
  occurrencesIn(file, read(file)),
);

const presentActionModules = ACTION_MODULES.filter((file) =>
  existsSync(join(repoRoot, file)),
);

const actionOccurrences = presentActionModules.flatMap((file) =>
  occurrencesIn(file, read(file)),
);

describe("storefront links never carry the internal /s/ prefix", () => {
  it("actually scanned the storefront route tree", () => {
    expect(
      existsSync(join(repoRoot, STOREFRONT_DIR)),
      `${STOREFRONT_DIR} does not exist. This guard would then scan nothing ` +
        "and pass with zero coverage.",
    ).toBe(true);

    expect(
      storefrontFiles.length,
      `No .ts/.tsx files were found under ${STOREFRONT_DIR}. A vacuous pass ` +
        "is the one failure mode a source-level guard must not have.",
    ).toBeGreaterThan(0);
  });

  it("still detects the prefix where it is supposed to survive", () => {
    // The positive control against real source. `cart/actions.ts` keeps
    // exactly one occurrence — its revalidatePath call — so the detector MUST
    // find it. If this fails, either a module moved (update REVALIDATING_MODULES
    // / NO_PREFIX_MODULES) or the detector no longer recognises the prefix, in
    // which case the real assertions below are passing over nothing.
    expect(
      presentActionModules,
      "An action module in REVALIDATING_MODULES or NO_PREFIX_MODULES was not " +
        "found on disk, so its share of this guard is silently skipped.",
    ).toEqual(ACTION_MODULES);

    for (const file of REVALIDATING_MODULES) {
      const allowed = actionOccurrences.filter(
        (hit) => hit.file === file && hit.text.includes(ALLOWED_ON),
      );

      expect(
        allowed.length,
        `${file} should contain exactly one ${ALLOWED_ON} call carrying the ` +
          "internal /s/ path. Finding none means the detector has drifted " +
          "from the code (this guard is then vacuous); finding several means " +
          "the cache-invalidation surface grew and this control needs " +
          "revisiting.",
      ).toBe(1);
    }
  });

  it("holds the checkout action at zero occurrences, revalidatePath or not", () => {
    for (const file of NO_PREFIX_MODULES) {
      const hits = actionOccurrences.filter((hit) => hit.file === file);

      expect(
        hits.map((hit) => `${hit.file}:${hit.line} — ${hit.text}`),
        `${file} must not contain the internal /s/ prefix at all. It holds no ` +
          `${ALLOWED_ON} call any more (quick task 260901-6wq deleted it — ` +
          "see tests/unit/checkout-revalidation-race.test.ts), so there is no " +
          "longer any legitimate reason for the prefix to appear here, and an " +
          "occurrence is either a browser-visible path that will 404 or a " +
          "reintroduced cache invalidation that costs the shopper their order " +
          "confirmation." +
          REMEDY,
      ).toEqual([]);
    }
  });

  it("detects a reintroduced link and ignores one that is only quoted", () => {
    // A synthetic control, so the detector is proven on both answers without
    // depending on the repository staying in any particular state. Both inputs
    // are built FROM the constant, so they cannot drift away from it.
    const reintroduced = [
      "<Link",
      `  href={\`${FORBIDDEN_PREFIX}slug}/cart\`}`,
      ">Cart</Link>",
    ].join("\n");

    expect(
      occurrencesIn("synthetic-offender.tsx", reintroduced).map(
        (hit) => hit.line,
      ),
      "The detector no longer fires on a link written with the forbidden " +
        "prefix, so the scan above proves nothing.",
    ).toEqual([2]);

    const quotedOnly = [
      `// Never write ${FORBIDDEN_PREFIX}slug}/cart} into an href.`,
      ` * Nor ${FORBIDDEN_PREFIX}slug} in a JSDoc continuation line.`,
      `{/* Nor ${FORBIDDEN_PREFIX}slug} in a JSX comment. */}`,
      '<Link href="/cart">Cart</Link>',
    ].join("\n");

    expect(
      occurrencesIn("synthetic-clean.tsx", quotedOnly),
      "Comment stripping is broken: a comment that merely NAMES the forbidden " +
        "prefix was counted as an offender. The rule would then be " +
        "undocumentable — every file explaining it would fail this test.",
    ).toEqual([]);
  });

  it("emits no /s/ prefix anywhere under the storefront route tree", () => {
    expect(
      storefrontOffenders.map((hit) => `${hit.file}:${hit.line} — ${hit.text}`),
      `TEN-03/DOM-02 violation — a link under ${STOREFRONT_DIR} carries the ` +
        "internal rewrite prefix, so the shopper's browser will request a " +
        "path src/proxy.ts answers with an empty-bodied 404 (a blank page)." +
        REMEDY,
    ).toEqual([]);
  });

  it("allows the prefix in the action modules only on a revalidatePath line", () => {
    const offenders = actionOccurrences.filter(
      (hit) => !hit.text.includes(ALLOWED_ON),
    );

    expect(
      offenders.map((hit) => `${hit.file}:${hit.line} — ${hit.text}`),
      "A server action builds a path with the internal /s/ prefix outside a " +
        `${ALLOWED_ON}() call. If that value is ever handed to the browser — ` +
        "as a redirect, a confirmation CTA href, or a link in a message — it " +
        "404s." +
        REMEDY,
    ).toEqual([]);
  });
});
