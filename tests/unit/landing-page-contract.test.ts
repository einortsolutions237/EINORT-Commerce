import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * MKTG-01's honesty contract, asserted against the source.
 *
 * `src/app/page.tsx` is the apex root page — a prospective merchant's very
 * first contact with EINORT. D-01 requires every claim on it to be traceable
 * to `05.2-RESEARCH.md`'s Verified Feature Ledger; `strings.plan.*.features`
 * (rendered on `/onboarding/plan` and `/dashboard/plan`) is explicitly NOT a
 * source, because it advertises at least six features this codebase has not
 * shipped. Nothing about that discipline is visible to a behavioural test —
 * there is no DOM in this project's Vitest `unit` project, and even if there
 * were, "is this claim honest" is not a DOM property.
 *
 * This file composes three existing source-scanning idioms rather than
 * inventing a fourth:
 *   1. `tests/unit/dashboard-nav.test.ts`'s `stripComments` / `QUOTED_PROSE` /
 *      `looksLikeProse` triple, for the no-inline-prose assertion.
 *   2. `tests/unit/surface-token-isolation.test.ts`'s ban-regex-over-scanned-
 *      lines shape.
 *   3. `tests/unit/preview-photo-isolation.test.ts`'s banned-token-with-
 *      positive/negative-control idiom, extended here to a banned-*phrase*
 *      list over `src/lib/strings/marketing.ts`.
 * It reads files from disk and matches text — it imports no application
 * code, opens no socket and touches no database, which is why it lives in
 * the `unit` project.
 *
 * IT MUST NOT PASS VACUOUSLY. A rename that moved the page or the copy
 * module would leave every assertion below scanning an empty string and
 * reporting perfect health, so the first test pins that both files exist and
 * were actually read, and the banned-claims/voice-contract predicate carries
 * its own positive and negative control fixtures proving it discriminates
 * rather than always agreeing.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const PAGE_FILE = "src/app/page.tsx";
const MARKETING_FILE = "src/lib/strings/marketing.ts";

/**
 * Blank out comments, keeping string literals and line numbering intact.
 *
 * Copied verbatim in shape from `dashboard-nav.test.ts`'s `stripComments`:
 * comments must go or this guard eats itself (this file's own header names
 * the banned phrases in prose), and string literals must stay, because they
 * are the thing being checked.
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

function readCode(file: string): string {
  return stripComments(readFileSync(join(repoRoot, file), "utf8"));
}

const pageExists = existsSync(join(repoRoot, PAGE_FILE));
const pageCode = pageExists ? readCode(PAGE_FILE) : "";

const marketingExists = existsSync(join(repoRoot, MARKETING_FILE));
const marketingCode = marketingExists ? readCode(MARKETING_FILE) : "";

/**
 * Attributes whose values are addresses, styling or accessibility plumbing
 * rather than prose. A line carrying one of them is exempt from the
 * inline-copy scan below. Identical to `dashboard-nav.test.ts`'s constant.
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
 * The five D-04 band namespaces plus the how-it-works band, exactly as
 * `strings.root.*` sub-namespaces. Literal substring match is sufficient
 * (05.2-PLAN.md's own instruction) — this does not assert a specific JSX
 * shape, only that the page actually reads from each namespace.
 */
const REQUIRED_BAND_REFERENCES = [
  "strings.root.hero",
  "strings.root.payments",
  "strings.root.templates",
  "strings.root.speed",
  "strings.root.howItWorks",
  "strings.root.finalCta",
] as const;

/**
 * The banned-claims phrase list (05.2-RESEARCH.md § Verified Feature Ledger
 * "DO NOT CLAIM"), plus a digit-followed-by-merchant/business/store pattern
 * for an invented headcount claim ("500 merchants", "10,000 businesses").
 */
const BANNED_PHRASES = [
  /custom domain/i,
  /discount code/i,
  /bulk import/i,
  /staff account/i,
  /delivery zone/i,
  /low-stock/i,
  /priority support/i,
  /testimonial/i,
  /trusted by/i,
  /millions/i,
  /thousands of/i,
  /\d[\d,]*\+?\s*(merchants?|businesses?|stores?)\b/i,
];

function findBannedClaim(text: string): RegExp | undefined {
  return BANNED_PHRASES.find((pattern) => pattern.test(text));
}

const EXCLAMATION = /!/;
const APOLOGY_INTERJECTION = /\b(oops|whoops)\b/i;

describe("landing page contract (MKTG-01)", () => {
  it("actually read the page and the marketing copy module", () => {
    expect(
      pageExists,
      `${PAGE_FILE} does not exist. Every assertion in this file would then ` +
        "scan an empty string and pass with zero coverage — update PAGE_FILE " +
        "in tests/unit/landing-page-contract.test.ts to the page's new home.",
    ).toBe(true);
    expect(
      pageCode.trim().length,
      `${PAGE_FILE} is empty once comments are stripped, so there is no ` +
        "code left to check.",
    ).toBeGreaterThan(0);

    expect(
      marketingExists,
      `${MARKETING_FILE} does not exist. The banned-claims and voice-contract ` +
        "scans below would then run over an empty string and pass with zero " +
        "coverage — update MARKETING_FILE in " +
        "tests/unit/landing-page-contract.test.ts to the copy module's new home.",
    ).toBe(true);
    expect(
      marketingCode.trim().length,
      `${MARKETING_FILE} is empty once comments are stripped, so there is no ` +
        "copy left to check.",
    ).toBeGreaterThan(0);
  });

  it("renders every D-04 band, not the 3-element placeholder", () => {
    const missing = REQUIRED_BAND_REFERENCES.filter(
      (reference) => !pageCode.includes(reference),
    );

    expect(
      missing,
      "MKTG-01 violation — the root page does not reference every landing- " +
        "page band.\n" +
        `  ${PAGE_FILE} must read from each of ${REQUIRED_BAND_REFERENCES.join(", ")} ` +
        "so the hero, all three differentiators, how-it-works and the final " +
        "CTA are all genuinely present — not the old 3-element wordmark/" +
        "tagline/button placeholder this page replaces.",
    ).toEqual([]);
  });

  it("inlines no user-facing prose in src/app/page.tsx", () => {
    const offenders: string[] = [];

    pageCode.split(/\r?\n/).forEach((text, index) => {
      if (NON_COPY_LINE.test(text)) return;

      for (const match of text.matchAll(QUOTED_PROSE)) {
        const value = match[1] ?? match[2] ?? "";
        if (looksLikeProse(value)) {
          offenders.push(`${PAGE_FILE}:${index + 1}: "${value}"`);
        }
      }
    });

    expect(
      offenders,
      "CLAUDE.md violation — user-facing copy is written directly into the " +
        "landing page.\n" +
        "  Every visible string on this page must come from strings.root.* " +
        "(spread from marketingCopy) or strings.signup.loginLink. Copy " +
        "inlined in the component is copy a later i18n extraction cannot " +
        "see, and it is copy this file's banned-claims scan cannot protect " +
        "either, because that scan only reads src/lib/strings/marketing.ts.\n" +
        "  Add the string to src/lib/strings/marketing.ts and read it from " +
        "strings.root instead.",
    ).toEqual([]);
  });

  it("the banned-claims matcher fires on a known fabricated claim (positive control)", () => {
    expect(
      findBannedClaim("EINORT now offers custom domain support."),
      "findBannedClaim does not fire on a line containing \"custom domain\" " +
        "— the scan below would be passing over nothing. BANNED_PHRASES has " +
        "drifted.",
    ).toBeDefined();

    expect(
      findBannedClaim("Trusted by thousands of merchants across Africa."),
      "findBannedClaim does not fire on a line containing both \"trusted by\" " +
        "and \"thousands of\" — BANNED_PHRASES has drifted.",
    ).toBeDefined();

    expect(
      findBannedClaim("Join 500 merchants already selling on EINORT."),
      "findBannedClaim does not fire on a digit-followed-by-merchants " +
        "invented-headcount claim — the digit+merchant/business/store " +
        "pattern in BANNED_PHRASES has drifted.",
    ).toBeDefined();
  });

  it("the banned-claims matcher does not fire on an honest, verified claim (negative control)", () => {
    expect(
      findBannedClaim(
        "Every EINORT store takes MTN Mobile Money and Orange Money transfers.",
      ),
      "findBannedClaim fires on a real, verified-feature-ledger claim about " +
        "Mobile Money. It must discriminate between fabricated and honest " +
        "claims, not ban broad categories of text outright.",
    ).toBeUndefined();
  });

  it("no banned unbuilt-feature claim appears in the marketing copy", () => {
    const offenders: string[] = [];

    marketingCode.split(/\r?\n/).forEach((text, index) => {
      const match = findBannedClaim(text);
      if (match) {
        offenders.push(`${MARKETING_FILE}:${index + 1}: ${match} matched "${text.trim()}"`);
      }
    });

    expect(
      offenders,
      "D-01 violation — src/lib/strings/marketing.ts contains a claim not " +
        "traceable to 05.2-RESEARCH.md's Verified Feature Ledger.\n" +
        "  strings.plan.*.features is NOT a source for this file — it " +
        "advertises features (custom domains, discount codes, bulk import, " +
        "staff accounts, delivery zones, low-stock alerts, priority support, " +
        "and more) that do not exist in this codebase, plus invented social " +
        "proof (testimonials, \"trusted by\", merchant counts). Every claim " +
        "on the landing page must be independently verifiable against " +
        "src/server/**.",
    ).toEqual([]);
  });

  it("the marketing copy carries no exclamation marks or apology interjections (voice contract)", () => {
    const offenders: string[] = [];

    marketingCode.split(/\r?\n/).forEach((text, index) => {
      if (EXCLAMATION.test(text)) {
        offenders.push(`${MARKETING_FILE}:${index + 1}: exclamation mark in "${text.trim()}"`);
      }
      if (APOLOGY_INTERJECTION.test(text)) {
        offenders.push(`${MARKETING_FILE}:${index + 1}: apology interjection in "${text.trim()}"`);
      }
    });

    expect(
      offenders,
      "05.2-UI-SPEC.md § Copywriting Contract voice violation — the landing " +
        "page copy must stay direct and second person: no exclamation " +
        "marks, no \"Oops\"/\"Whoops\", no emoji, no superlative with no " +
        "referent, no invented count.",
    ).toEqual([]);
  });
});
