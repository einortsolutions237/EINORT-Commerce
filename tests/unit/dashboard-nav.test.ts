import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The dashboard navigation contract, asserted against the source.
 *
 * Three properties of `src/components/app-sidebar.tsx` are load-bearing enough
 * that losing one is a real regression and none of them is visible to a
 * behavioural test:
 *
 *   1. **Every dashboard destination is reachable.** A route file can be added
 *      under `(dashboard)/` and work perfectly when typed into the address bar
 *      while being unreachable by clicking. Nothing fails; the page is simply
 *      invisible to the merchant it was built for. 03-UI-SPEC.md § A.
 *      Navigation Shell exists because that already happened once — the rail
 *      was deferred out of Phase 2 with four destinations still to come.
 *   2. **No user-facing literal in the rail.** C-14 puts all copy in
 *      `src/lib/strings.ts`. A label inlined here is copy that a later i18n
 *      extraction silently misses.
 *   3. **The gold accent budget is spent exactly where the contract says.**
 *      03-UI-SPEC.md § A. Color gives this phase two uses of `--gold-accent`
 *      and no more: this badge and the `Payment claimed` order chip. Gold means
 *      "a human needs to look at this now", and a signal that appears in a
 *      third place stops meaning anything. A budget that is only written down
 *      is a budget that gets spent.
 *
 * The idiom is `tests/unit/no-tenant-id-param.test.ts`'s and
 * `tests/unit/surface-token-isolation.test.ts`'s: read what is on disk, match
 * text, and fail with a message that names the offending file. It imports no
 * application code, opens no socket and touches no database, which is why it
 * lives in the `unit` project.
 *
 * IT MUST NOT PASS VACUOUSLY. A rename that moved the rail would leave every
 * assertion below scanning an empty string and reporting perfect health, so the
 * first test pins that the file exists and was actually read.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const SIDEBAR_FILE = "src/components/app-sidebar.tsx";

/** Both surfaces' component trees — the scope of the gold-accent budget. */
const GOLD_SCAN_DIRS = ["src/app", "src/components"] as const;

/**
 * The seven destinations the rail must offer, in 03-UI-SPEC.md's order, extended
 * by 04-UI-SPEC.md § Navigation.
 *
 * This list is the contract. Adding a dashboard route means adding it here and
 * in the rail, in that order — which is the point: the test is what turns
 * "we forgot to link it" into a red build instead of a support message three
 * weeks later.
 */
const REQUIRED_HREFS = [
  "/dashboard",
  "/dashboard/products",
  /*
   * Phase 4, EDIT-02. Placed between `Products` and `Orders` because that is
   * where 04-UI-SPEC.md § Navigation puts the rail item, and this list is
   * ordered to match the rail rather than sorted.
   */
  "/dashboard/storefront-editor",
  "/dashboard/orders",
  "/dashboard/claims",
  "/dashboard/plan",
  "/dashboard/settings/payment",
] as const;

/**
 * The one other module allowed to spend gold: the order-state chip.
 *
 * Matched by filename rather than pinned to a path, because the chip is built
 * by a later plan in this phase and does not exist yet. Loose enough not to
 * fail on the file it is waiting for, tight enough that a `variant="gold"` in
 * a product card or a settings alert is still a failure.
 */
const ORDER_STATE_CHIP = /order-state/;

/**
 * Blank out comments, keeping string literals and line numbering intact.
 *
 * Comments must go or the guard eats itself: the header of `app-sidebar.tsx`
 * has to be able to say `variant="gold"` and name the routes in order to
 * explain the rules this file enforces. String literals must STAY, because
 * they are the thing being checked. (`no-tenant-id-param.test.ts` blanks both,
 * for the opposite reason — there the strings are what produce false
 * positives.)
 *
 * Characters are replaced with spaces rather than removed so a reported line
 * number still points at the real line in the real file.
 */
function stripComments(code: string): string {
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

    // Skip over a string literal without touching it.
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
      i = k;
      continue;
    }

    i += 1;
  }

  return out.join("");
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

function readCode(file: string): string {
  return stripComments(readFileSync(join(repoRoot, file), "utf8"));
}

const sidebarExists = existsSync(join(repoRoot, SIDEBAR_FILE));
const sidebarCode = sidebarExists ? readCode(SIDEBAR_FILE) : "";

/**
 * Attributes whose values are addresses, styling or accessibility plumbing
 * rather than prose. A line carrying one of them is exempt from the
 * inline-copy scan below.
 */
const NON_COPY_LINE = /\bimport\b|\bclassName\b|\bhref\b|\baria-[a-z]+\b/;

/** A quoted run of three or more plain words — the shape of a sentence. */
const QUOTED_PROSE = /"([^"\\\n]+)"|'([^'\\\n]+)'/g;

function looksLikeProse(value: string): boolean {
  const words = value.trim().split(/\s+/);
  if (words.length < 3) return false;
  return words.every((word) => /^[A-Za-z][A-Za-z'’]*$/.test(word));
}

const GOLD_VARIANT = /variant="gold"/g;

function countGold(code: string): number {
  return code.match(GOLD_VARIANT)?.length ?? 0;
}

describe("dashboard navigation contract", () => {
  it("actually read the sidebar module", () => {
    expect(
      sidebarExists,
      `${SIDEBAR_FILE} does not exist. Every assertion in this file would ` +
        "then scan an empty string and pass with zero coverage — update " +
        "SIDEBAR_FILE in tests/unit/dashboard-nav.test.ts to the rail's new " +
        "home.",
    ).toBe(true);

    expect(
      sidebarCode.trim().length,
      `${SIDEBAR_FILE} is empty once comments are stripped, so there is no ` +
        "code left to check.",
    ).toBeGreaterThan(0);
  });

  it("offers every dashboard destination", () => {
    const missing = REQUIRED_HREFS.filter(
      (href) => !sidebarCode.includes(`"${href}"`),
    );

    expect(
      missing,
      "A dashboard destination is not reachable from the navigation rail.\n" +
        `  ${SIDEBAR_FILE} is the only navigation surface the merchant has. A ` +
        "route that is not listed there still resolves when typed into the " +
        "address bar, which is exactly why this fails silently in every other " +
        "kind of test: the page works, and no one can get to it.\n" +
        "  Add the item to NAV_ITEMS with its label from strings.dashboard.nav " +
        "and its lucide icon from 03-UI-SPEC.md § A. Navigation Shell. If a " +
        "route was deliberately removed, remove it from REQUIRED_HREFS here in " +
        "the same commit so the contract and the rail stay one thing.",
    ).toEqual([]);
  });

  it("marks the active destination with aria-current", () => {
    expect(
      /aria-current=(?:"page"|\{[^}]*"page"[^}]*\})/.test(sidebarCode),
      "The active navigation item does not set aria-current=\"page\".\n" +
        "  03-UI-SPEC.md § A. Color deliberately withholds the blue fill bar " +
        "from the active nav item — the accent budget does not cover it — so " +
        "the active state is carried by a --sidebar-accent fill and " +
        "--sidebar-primary text. Neither of those is available to a screen " +
        "reader, and the accessibility floor requires that colour is never the " +
        "only signal. aria-current is the other half of that pair, not a nicety.",
    ).toBe(true);
  });

  it("inlines no user-facing copy", () => {
    const offenders: string[] = [];

    sidebarCode.split(/\r?\n/).forEach((text, index) => {
      if (NON_COPY_LINE.test(text)) return;

      for (const match of text.matchAll(QUOTED_PROSE)) {
        const value = match[1] ?? match[2] ?? "";
        if (looksLikeProse(value)) {
          offenders.push(`${SIDEBAR_FILE}:${index + 1}: "${value}"`);
        }
      }
    });

    expect(
      offenders,
      "C-14 violation — user-facing copy is written into the navigation " +
        "rail.\n" +
        "  Every visible string in this component reads from " +
        "strings.dashboard.nav. Copy inlined in a component is copy the later " +
        "i18n extraction cannot see: this object is meant to become the `en` " +
        "message catalogue whole, and a label that never entered it is a label " +
        "that silently stays English forever.\n" +
        "  Add the string to strings.dashboard.nav and read it from there.",
    ).toEqual([]);
  });

  it("spends the gold accent exactly twice, and only where the contract says", () => {
    const files = GOLD_SCAN_DIRS.flatMap(tsxFilesUnder).sort();

    expect(
      files.length,
      `No .tsx files were found under ${GOLD_SCAN_DIRS.join(" or ")}. A ` +
        "counted grep that counts nothing is not a budget.",
    ).toBeGreaterThan(0);

    const spenders = files
      .map((file) => ({ file, count: countGold(readCode(file)) }))
      .filter(({ count }) => count > 0);

    expect(
      spenders.find(({ file }) => file === SIDEBAR_FILE)?.count,
      "The pending-claims badge is the rail's one use of the gold accent " +
        "(D-13). Exactly one `variant=\"gold\"` belongs in " +
        `${SIDEBAR_FILE} — no more, and not zero.`,
    ).toBe(1);

    const unauthorized = spenders
      .filter(
        ({ file }) =>
          file !== SIDEBAR_FILE && !ORDER_STATE_CHIP.test(basename(file)),
      )
      .map(({ file, count }) => `${file}: ${count}`);

    expect(
      unauthorized,
      "03-UI-SPEC.md § A. Color violation — the gold accent is spent outside " +
        "its budget.\n" +
        "  --gold-accent has exactly two uses in this phase: the pending-claims " +
        "count badge on the Payment claims rail item, and the `Payment " +
        "claimed` order-state chip. Both mean the same thing — a human needs " +
        "to look at this now — and that meaning is the whole value of the " +
        "colour. A third use makes gold decorative, and a merchant who learns " +
        "gold is decorative stops checking the claims queue.\n" +
        "  For a status that is merely notable use `secondary`; for something " +
        "settled use `success` or `outline-success`; for something wrong use " +
        "`destructive`. Gold is not a stronger version of any of them.",
    ).toEqual([]);
  });
});
