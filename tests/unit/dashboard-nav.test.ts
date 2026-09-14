import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
 *      03-UI-SPEC.md § A. Color gave the merchant surface two uses of
 *      `--gold-accent`; 06-UI-SPEC.md § Color amends that to five when the
 *      platform admin surface arrives, as an ITEMISED allow-table rather than
 *      a directory exemption — see `GOLD_BUDGET` below. Gold means "a human
 *      needs to look at this now", and a signal that appears in one more place
 *      than the contract names stops meaning anything. A budget that is only
 *      written down is a budget that gets spent.
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
 * The eight destinations the rail must offer, in 03-UI-SPEC.md's order, extended
 * by 04-UI-SPEC.md § Navigation and by 06-UI-SPEC.md § R-4.
 *
 * This list is the contract. Adding a dashboard route means adding it here and
 * in the rail, in that order — which is the point: the test is what turns
 * "we forgot to link it" into a red build instead of a support message three
 * weeks later.
 */
const REQUIRED_HREFS = [
  "/dashboard",
  "/dashboard/support",
  /*
   * Plan 06-09, 06-UI-SPEC.md § R-4 (D-07). Second, directly after the
   * apex — the General group's rail item sits right beneath `Overview`,
   * and this list is ordered to match the rail rather than sorted. Landed
   * in the same commit as the `NAV_GROUPS` row it pairs with; either half
   * alone fails this test (06-UI-SPEC.md § Open Items 5).
   */
  "/dashboard/products",
  /*
   * Phase 4, EDIT-02. Placed between `Products` and `Orders` because that is
   * where 04-UI-SPEC.md § Navigation puts the rail item, and this list is
   * ordered to match the rail rather than sorted.
   */
  "/dashboard/storefront",
  "/dashboard/orders",
  "/dashboard/claims",
  "/dashboard/plan",
  "/dashboard/settings/payment",
] as const;

/**
 * The gold allow-table — 06-UI-SPEC.md § Color, transcribed file for file.
 *
 * Phase 6 amends `03-UI-SPEC.md`'s two-use budget to FIVE, because the platform
 * admin surface did not exist when the original was written. The budget is
 * extended, itemised and re-enforced — never blanket-exempted, which is why
 * there is a row per file here rather than a directory-wide pass for the new
 * surface. Both halves matter: a file in this table that spends MORE than its
 * allowance fails, and so does a file that spends gold without being in it.
 *
 * Every entry is `1`. That is not a coincidence worth collapsing into a
 * constant: each one is a separate decision about one signal, and the day a
 * row legitimately needs `2` the table should be able to say so.
 *
 *   1. the merchant rail's pending order-claims count   (existing)
 *   2. the `Payment claimed` order-state chip           (existing)
 *   3. the persistent Platform Admin strip (D-02)       (new)
 *   4. the admin rail's shared pending-count badge slot (new) — ONE occurrence
 *      rendered inside the item map and used by both `Payment claims` and
 *      `Subscription payments`
 *   5. the `Awaiting review` subscription-claim chip    (new)
 */
const GOLD_BUDGET: Readonly<Record<string, number>> = {
  "src/components/app-sidebar.tsx": 1,
  "src/components/order-state-chip.tsx": 1,
  "src/components/admin/admin-banner.tsx": 1,
  "src/components/admin/admin-sidebar.tsx": 1,
  "src/components/subscription-claim-chip.tsx": 1,
};

/** What the five rows above add up to, asserted independently of them. */
const GOLD_TOTAL = 5;

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

/**
 * The gold accent, counted in BOTH the forms this codebase spends it in:
 * `variant="gold"` as a JSX attribute, and `variant: "gold"` as a row in a
 * status-chip registry.
 *
 * The JSX-only matcher this file shipped with counted ONE of the two budgeted
 * uses and called the budget kept — `order-state-chip.tsx` reaches `Badge`
 * through `chip.variant`, so its gold has always been a data row rather than an
 * attribute, and the scan never saw it. That is not a technicality: a chip
 * registry is exactly where a sixth gold would be cheapest to add and hardest
 * to notice. `tests/unit/phase-03-requirement-coverage.test.ts` already counts
 * both forms for this reason; the two matchers are now the same matcher.
 */
const GOLD_VARIANT = /\bvariant\s*[:=]\s*"gold"/g;

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

  it("spends the gold accent exactly five times, in the five files the budget names", () => {
    const files = GOLD_SCAN_DIRS.flatMap(tsxFilesUnder).sort();

    expect(
      files.length,
      `No .tsx files were found under ${GOLD_SCAN_DIRS.join(" or ")}. A ` +
        "counted grep that counts nothing is not a budget.",
    ).toBeGreaterThan(0);

    const counts = new Map(
      files.map((file) => [file, countGold(readCode(file))] as const),
    );

    const BUDGET_REASONING =
      "  --gold-accent means one thing on both surfaces: a human needs to " +
      "look at this now, and what they are looking at is unreviewed money. " +
      "06-UI-SPEC.md § Color amends 03-UI-SPEC.md's original two-use budget " +
      "to exactly five, itemised per file — the pending order-claims count " +
      "on the merchant rail, the `Payment claimed` order chip, the persistent " +
      "Platform Admin strip, the admin rail's shared pending-count badge and " +
      "the `Awaiting review` subscription-claim chip. A sixth use makes gold " +
      "decorative, and a merchant — or an owner — who learns gold is " +
      "decorative stops checking the queues it marks.\n" +
      "  For a status that is merely notable use `secondary`; for unread " +
      "information use `default` (blue, § Color's narrow accent amendment); " +
      "for something settled use `success` or `outline-success`; for " +
      "something wrong use `destructive`. Gold is not a stronger version of " +
      "any of them.\n" +
      "  If a new gold surface is genuinely required, add its file and its " +
      "expected count to GOLD_BUDGET above and raise GOLD_TOTAL in the same " +
      "commit, so the budget stays a decision somebody made rather than a " +
      "number that drifted. Do not exempt a directory, and do not reach for a " +
      "raw gold fill utility to dodge this scan — that renders identically " +
      "and slips past silently, which is strictly worse than an honest " +
      "failure.";

    const wrong = Object.entries(GOLD_BUDGET)
      .filter(([file, allowed]) => counts.get(file) !== allowed)
      .map(
        ([file, allowed]) =>
          `${file}: expected ${allowed}, found ${counts.get(file) ?? "no such file"}`,
      );

    expect(
      wrong,
      "06-UI-SPEC.md § Color violation — a file in the gold budget does not " +
        "spend what the budget says.\n" +
        "  Every row of GOLD_BUDGET is a signal somebody depends on, so zero " +
        "is as much a failure as two: a missing badge is a queue that stopped " +
        "shouting.\n" +
        BUDGET_REASONING,
    ).toEqual([]);

    const unauthorized = [...counts]
      .filter(([file, count]) => count > 0 && !(file in GOLD_BUDGET))
      .map(([file, count]) => `${file}: ${count}`);

    expect(
      unauthorized,
      "06-UI-SPEC.md § Color violation — the gold accent is spent outside " +
        "its budget.\n" + BUDGET_REASONING,
    ).toEqual([]);

    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);

    expect(
      total,
      `The gold accent is spent ${total} times across ` +
        `${GOLD_SCAN_DIRS.join(" and ")}; the budget is exactly ` +
        `${GOLD_TOTAL}.\n` +
        BUDGET_REASONING,
    ).toBe(GOLD_TOTAL);
  });
});
