import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The Phase 3 gate, expressed as a build-failing assertion instead of a
 * checklist somebody ticks (T-03-81, T-03-82).
 *
 * A requirement marked "done" in a planning document is a claim. The claim is
 * only worth anything for as long as the test behind it still exists and still
 * asserts something, and the way that stops being true is never a decision:
 * it is a rename during a refactor, a file moved into a different suite, or a
 * body emptied out while somebody debugged a neighbouring failure. Every one of
 * those leaves a green suite and a requirement with nothing behind it — a false
 * negative, which is strictly worse than a red build, because a red build gets
 * looked at.
 *
 * So the map from `.planning/.../03-VALIDATION.md` lives here as code. Renaming
 * `tests/isolation/claim-submission.test.ts` fails THIS file with CHK-04's
 * actual text quoted at the person doing the renaming, in the same commit that
 * broke the link, rather than being discovered in Phase 6 when a claim behaves
 * in a way nobody can explain.
 *
 * The three invariants at the bottom are here for the opposite reason. Each is
 * already guarded by the plan that introduced it, and each is re-checked here
 * ON PURPOSE: a cross-plan invariant is exactly the thing a late edit in an
 * unrelated plan breaks, and a guard that lives only inside the plan that
 * created it is a guard nobody reads while editing something else.
 *
 * This file runs in the `unit` project: filesystem and source text only, no
 * database, no import of application code. It must be able to run when the app
 * cannot boot.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const VALIDATION_DOC =
  ".planning/phases/03-product-catalog-order-payment-claim-state-machine/" +
  "03-VALIDATION.md";

// ---------------------------------------------------------------------------
// The requirement → proof map
// ---------------------------------------------------------------------------

interface Requirement {
  /** The requirement's text, verbatim from `.planning/REQUIREMENTS.md`. */
  readonly text: string;
  /** Every test file that proves it. All of them must exist and assert. */
  readonly proofs: readonly string[];
  /** Set where a human check carries part of the proof (CHK-03). */
  readonly manual?: string;
}

/**
 * The thirteen Phase 3 requirements and the files that prove them.
 *
 * The `text` fields are copied from `.planning/REQUIREMENTS.md` rather than
 * summarised, so a failure message reads as the requirement itself. "CHK-04 has
 * no proof" is an id lookup somebody has to go and perform; the sentence is the
 * thing that tells them whether the missing file mattered.
 */
const REQUIREMENT_PROOFS: Readonly<Record<string, Requirement>> = {
  "CAT-01": {
    text:
      "Merchants can create products with images, price, simple variants, " +
      "stock count, and category assignment",
    proofs: [
      "tests/isolation/catalog.test.ts",
      "tests/unit/product-limit.test.ts",
      "tests/unit/variant-matrix.test.ts",
      "tests/unit/product-form-contract.test.ts",
    ],
  },
  "CAT-02": {
    text:
      "Product images pass through the same automatic enhancement/" +
      "aspect-ratio pipeline as onboarding logos",
    proofs: ["tests/unit/image-pipeline.test.ts", "tests/unit/r2-key.test.ts"],
  },
  "CAT-03": {
    text:
      "Stock decrement on order placement is atomic/race-safe — concurrent " +
      "orders cannot oversell the same unit",
    proofs: ["tests/isolation/stock-race.test.ts"],
  },
  "CHK-01": {
    text:
      "A customer can browse the storefront, view product detail, add to " +
      "cart, and review an order summary without creating an account",
    proofs: [
      "tests/unit/cart.test.ts",
      "tests/isolation/storefront-catalog.test.ts",
    ],
  },
  "CHK-02": {
    text:
      "Checkout offers three payment paths: WhatsApp order (pre-filled cart " +
      "message to the merchant's number), manual Mobile Money/Orange Money " +
      "transfer, and Cash on Delivery",
    proofs: [
      "tests/unit/whatsapp.test.ts",
      "tests/isolation/checkout-paths.test.ts",
    ],
  },
  "CHK-03": {
    text:
      "The manual transfer path displays the merchant's receiving number and " +
      "the exact amount, with a tap-to-dial USSD assist where technically " +
      "possible (Android `tel:` deep link) and a clear manual-copy fallback " +
      "(iOS)",
    proofs: ["tests/unit/ussd.test.ts", "tests/unit/phone.test.ts"],
    // The string builders are unit-testable; what a real Phone app does with a
    // `tel:` URI containing `*` and `#` is not. The manual rows in
    // 03-VALIDATION.md are the other half of this requirement's proof, and the
    // assertion below checks they are still written down.
    manual: "Manual-Only Verifications",
  },
  "CHK-04": {
    text:
      "After sending payment, the customer submits an \"I've paid\" claim " +
      "with a transaction reference (and optionally a screenshot)",
    proofs: ["tests/isolation/claim-submission.test.ts"],
  },
  "CHK-05": {
    text:
      "The customer always sees an explicit order status (e.g. \"payment " +
      "being confirmed\") — never left uncertain whether the order was created",
    proofs: [
      "tests/unit/order-status-copy.test.ts",
      "tests/isolation/tracking-token.test.ts",
    ],
  },
  "ORD-01": {
    text:
      "Orders move through an explicit state machine: Cart → Order Placed → " +
      "Payment Pending → Payment Claimed → Confirmed/Disputed → Fulfilled",
    proofs: [
      "tests/unit/state-machine.test.ts",
      "tests/unit/order-state-chip.test.ts",
    ],
  },
  "ORD-02": {
    text:
      "A payment claim is never auto-confirmed from the customer's " +
      "self-report alone — it requires explicit merchant action",
    proofs: [
      "tests/isolation/claims.test.ts",
      "tests/isolation/claim-submission.test.ts",
    ],
  },
  "ORD-03": {
    text:
      "Merchants get a Payment Claims queue showing transaction reference and " +
      "screenshot per claim, with one-tap confirm/reject",
    proofs: [
      "tests/isolation/claims.test.ts",
      "tests/isolation/order-actions.test.ts",
    ],
  },
  "ORD-04": {
    text:
      "Each payment claim's transaction reference is checked for uniqueness " +
      "per tenant, to catch reused/duplicate proof-of-payment",
    proofs: [
      "tests/unit/claim-reference.test.ts",
      "tests/isolation/claims.test.ts",
      "tests/isolation/claim-submission.test.ts",
    ],
  },
  "ORD-05": {
    text:
      "Every state transition is recorded in an audit trail (who/what/when), " +
      "not just the current status",
    proofs: [
      "tests/isolation/order-audit.test.ts",
      "tests/unit/single-order-state-writer.test.ts",
    ],
  },
};

/**
 * Inherited guarantees this phase re-proved rather than introduced.
 *
 * They are not Phase 3 requirements, so they get one row rather than one each,
 * but they belong in the same map: Phase 3 added models, a second surface's
 * tokens and a sixth nav destination, and each of those is a way an earlier
 * phase's guarantee stops holding without anybody editing the file that states
 * it.
 */
const INHERITED_PROOFS: readonly string[] = [
  "tests/isolation/model-registry-drift.test.ts",
  "tests/isolation/checkout-trust.test.ts",
  "tests/isolation/tenant-isolation.test.ts",
  "tests/unit/surface-token-isolation.test.ts",
  "tests/unit/dashboard-nav.test.ts",
];

/**
 * A test file that contains no `it(` / `test(` block asserts nothing.
 *
 * `existsSync` alone would accept a file emptied to a stub during a debugging
 * session and never refilled — present on disk, green in CI, proving nothing.
 * Checked after comments are stripped so a header that quotes `it(` while
 * explaining a rule cannot stand in for a real block.
 */
const ASSERTION_BLOCK = /\b(?:it|test)\s*(?:\.\s*\w+\s*)?\(/;

// ---------------------------------------------------------------------------
// Source scanning shared by the three cross-plan invariants
// ---------------------------------------------------------------------------

/**
 * `src/generated/**` is the Prisma client output — machine-written, never
 * hand-edited, and full of `state:` and `status:` in type declarations that
 * describe a column rather than write one. `eslint.config.mjs` and
 * `tests/unit/single-order-state-writer.test.ts` skip it for the same reason.
 */
const SKIPPED_DIRS = new Set(["generated"]);

/**
 * Blank out comment lines, preserving line count and column offsets.
 *
 * Without this every guard below is self-invalidating: the headers of
 * `transition.ts`, `order-state-chip.tsx` and this very file quote the patterns
 * they forbid in order to explain them. Characters become spaces rather than
 * disappearing so a reported line number still points at the real line.
 *
 * Line-oriented on purpose — `//` lines and JSDoc `*` continuations are what
 * every comment in this repository looks like. A trailing `// …` after live
 * code survives, which is the safe direction: it can only ever cause a false
 * POSITIVE, and a false positive is a failing build somebody reads rather than
 * a silent hole.
 */
function stripCommentLines(code: string): string {
  return code
    .split("\n")
    .map((line) =>
      /^\s*(?:\/\/|\/\*|\*)/.test(line) ? " ".repeat(line.length) : line,
    )
    .join("\n");
}

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

interface Hit {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
}

/**
 * Every `<delegate>.<write op>({ … })` whose argument list matches `key`.
 *
 * The statement WINDOW is the call's argument list, found by matching
 * parentheses — not "the next N lines". A line window would both miss a `data:`
 * object formatted across a long argument list and flag an unrelated key in
 * whatever statement happened to follow.
 */
function writesMatching(
  delegate: string,
  key: RegExp,
  files: readonly string[],
): Hit[] {
  const call = new RegExp(
    `\\.${delegate}\\.(?:update|updateMany|upsert|create|createMany)\\s*\\(`,
    "g",
  );

  const hits: Hit[] = [];
  for (const file of files) {
    const source = stripCommentLines(readFileSync(join(repoRoot, file), "utf8"));

    call.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = call.exec(source)) !== null) {
      const open = match.index + match[0].length - 1;
      const close = matchParen(source, open);
      if (close === -1) continue;

      const args = source.slice(open, close + 1);
      if (!key.test(args)) continue;

      hits.push({
        file,
        line: source.slice(0, match.index).split("\n").length,
        snippet: args.replace(/\s+/g, " ").trim().slice(0, 120),
      });
    }
  }
  return hits;
}

const sourceFiles = sourceFilesUnder("src").sort();

/** The one module allowed to write `Order.state` (ORD-05, 03-03). */
const SANCTIONED_STATE_WRITER = "src/server/orders/transition.ts";

/** The one module allowed to confirm a payment claim (ORD-02, 03-13). */
const SANCTIONED_CLAIM_CONFIRMER = "src/server/claims/actions.ts";

/**
 * `state:` but not `toState:` / `fromState:`.
 *
 * The `\b` is load-bearing: `OrderEvent.toState` and `.fromState` are written
 * on every legitimate transition, and a bare substring match would flag the
 * audit row as if it were the state write it audits.
 */
const STATE_ASSIGNMENT = /\bstate\s*:/;

/** A claim being moved to confirmed — the merchant-only half of ORD-02. */
const CONFIRMED_STATUS = /\bstatus\s*:\s*"CONFIRMED"/;

const stateWrites = writesMatching("order", STATE_ASSIGNMENT, sourceFiles);
const claimConfirms = writesMatching(
  "paymentClaim",
  CONFIRMED_STATUS,
  sourceFiles,
);

/**
 * The gold accent, counted across both `variant="gold"` (JSX) and
 * `variant: "gold"` (the chip's state→appearance table).
 *
 * 03-UI-SPEC.md § A. Color grants `--gold-accent` exactly two uses in the whole
 * product, and the second one is a data row rather than an attribute, so a
 * JSX-only matcher would count one and call the budget kept.
 */
const GOLD_SPEND = /\bvariant\s*[:=]\s*"gold"/g;

const GOLD_BUDGET = [
  "src/components/app-sidebar.tsx",
  "src/components/order-state-chip.tsx",
] as const;

// ---------------------------------------------------------------------------

describe("Phase 3 requirement coverage", () => {
  for (const [id, requirement] of Object.entries(REQUIREMENT_PROOFS)) {
    it(`${id} points at a proof that exists and asserts something`, () => {
      const missing = requirement.proofs.filter(
        (proof) => !existsSync(join(repoRoot, proof)),
      );

      expect(
        missing,
        `${id} has no proof: ${missing.join(", ")} is missing.\n` +
          `  ${id} — "${requirement.text}"\n` +
          "  A requirement whose named test file is gone is a requirement " +
          "nothing checks. Either restore the file, or move the requirement's " +
          "proof to whatever replaced it and update REQUIREMENT_PROOFS here " +
          "in the SAME commit — the map and the suite are one artifact.",
      ).toEqual([]);

      const silent = requirement.proofs.filter(
        (proof) =>
          !ASSERTION_BLOCK.test(
            stripCommentLines(readFileSync(join(repoRoot, proof), "utf8")),
          ),
      );

      expect(
        silent,
        `${id} has a proof file that asserts nothing: ${silent.join(", ")}.\n` +
          `  ${id} — "${requirement.text}"\n` +
          "  The file is on disk and contains no `it(` or `test(` block, so " +
          "it passes by running nothing. That is the exact shape of a stub " +
          "left behind while debugging something else.",
      ).toEqual([]);

      if (requirement.manual) {
        const doc = readFileSync(join(repoRoot, VALIDATION_DOC), "utf8");

        expect(
          doc.includes(requirement.manual) && doc.includes(id),
          `${id} is proved partly by a human check, and ${VALIDATION_DOC} no ` +
            `longer records it under "${requirement.manual}".\n` +
            "  Real Phone-app behaviour for a `tel:` URI containing `*` and " +
            "`#` cannot be simulated in a test runner, so the manual rows ARE " +
            "part of this requirement's proof. Deleting them does not make " +
            "the requirement automated; it makes it unproven.",
        ).toBe(true);
      }
    });
  }

  it("re-proves the inherited guarantees this phase could have broken", () => {
    const missing = INHERITED_PROOFS.filter(
      (proof) => !existsSync(join(repoRoot, proof)),
    );

    expect(
      missing,
      `An inherited guard is missing: ${missing.join(", ")}.\n` +
        "  TEN-02 (model registry), TEN-08 (forged checkout payloads), the " +
        "two-surface token split and the nav/gold contract were all " +
        "established before this phase and were all re-exercised by it. They " +
        "fail quietly if their guard disappears, because nothing in Phase 3's " +
        "own tests would notice.",
    ).toEqual([]);
  });
});

describe("Phase 3 cross-plan invariants", () => {
  it("actually scanned the source tree", () => {
    expect(
      existsSync(join(repoRoot, "src")),
      "src/ does not exist, so every scan below would run over nothing and " +
        "pass with zero coverage.",
    ).toBe(true);

    expect(
      sourceFiles.length,
      "No .ts/.tsx files were found under src/. A vacuous pass is the one " +
        "failure mode a source-level guard must not have.",
    ).toBeGreaterThan(0);
  });

  it("still detects the sanctioned Order.state writer", () => {
    // Positive control. `transition.ts` writes `Order.state` — that is its
    // whole job — so the detector MUST find it. If this fails, the file moved
    // or the matcher drifted, and the guard below is passing over nothing.
    expect(
      stateWrites.map((hit) => hit.file),
      `${SANCTIONED_STATE_WRITER} contains no detected Order.state write, so ` +
        "the detector in this file has drifted from the code and the next " +
        "assertion is vacuous.",
    ).toContain(SANCTIONED_STATE_WRITER);
  });

  it("has exactly one writer of Order.state in src/", () => {
    const offenders = stateWrites
      .filter((hit) => hit.file !== SANCTIONED_STATE_WRITER)
      .map((hit) => `${hit.file}:${hit.line} — ${hit.snippet}`);

    expect(
      offenders,
      "ORD-05 violation — something other than " +
        `${SANCTIONED_STATE_WRITER} writes Order.state.\n` +
        "  Every state change must leave an OrderEvent naming who made it, in " +
        "the SAME transaction. A direct order write skips that row, so the " +
        "order moves and its history does not record who moved it — precisely " +
        "the gap a payment dispute needs closed (T-03-12, T-03-14).\n" +
        "  Call `transitionOrder(tx, { orderId, to, actor, actorUserId })` " +
        "instead. If a genuinely new state-writing path is needed it belongs " +
        `INSIDE ${SANCTIONED_STATE_WRITER}, not beside it.`,
    ).toEqual([]);
  });

  it("still detects the sanctioned payment-claim confirmer", () => {
    // The same positive control, for the same reason.
    expect(
      claimConfirms.map((hit) => hit.file),
      `${SANCTIONED_CLAIM_CONFIRMER} contains no detected write of a claim to ` +
        "CONFIRMED, so the detector has drifted and the next assertion is " +
        "vacuous.",
    ).toContain(SANCTIONED_CLAIM_CONFIRMER);
  });

  it("has exactly one confirmer of a payment claim in src/", () => {
    const offenders = claimConfirms
      .filter((hit) => hit.file !== SANCTIONED_CLAIM_CONFIRMER)
      .map((hit) => `${hit.file}:${hit.line} — ${hit.snippet}`);

    expect(
      offenders,
      "ORD-02 violation — something other than " +
        `${SANCTIONED_CLAIM_CONFIRMER} moves a PaymentClaim to CONFIRMED.\n` +
        "  A claim is never auto-confirmed from the customer's own report. " +
        "The single confirming path exists so that the optimistic-lock check " +
        "(`claim.status !== \"PENDING\"`), the merchant-actor transition and " +
        "the reviewer's id are written in one transaction and cannot be " +
        "assembled wrongly somewhere else.\n" +
        "  Call `confirmClaim` rather than writing the status directly.",
    ).toEqual([]);
  });

  it("spends the gold accent in exactly the two budgeted files", () => {
    const spenders = sourceFiles
      .map((file) => ({
        file,
        count:
          stripCommentLines(readFileSync(join(repoRoot, file), "utf8")).match(
            GOLD_SPEND,
          )?.length ?? 0,
      }))
      .filter(({ count }) => count > 0);

    const missing = GOLD_BUDGET.filter(
      (file) => !spenders.some((spender) => spender.file === file),
    );

    expect(
      missing,
      `A budgeted use of the gold accent has disappeared: ${missing.join(", ")}.\n` +
        "  The pending-claims badge and the `Payment claimed` order-state " +
        "chip are gold's two uses, and both mean the same thing: a human " +
        "needs to look at this now. Losing one is not a saving — it is the " +
        "signal going missing from a queue a merchant is supposed to work.",
    ).toEqual([]);

    const unauthorized = spenders
      .filter(
        ({ file }) => !(GOLD_BUDGET as readonly string[]).includes(file),
      )
      .map(({ file, count }) => `${file}: ${count}`);

    expect(
      unauthorized,
      "03-UI-SPEC.md § A. Color violation — the gold accent is spent outside " +
        "its budget.\n" +
        "  --gold-accent has exactly two uses in this phase: the " +
        "pending-claims count badge on the Payment claims rail item, and the " +
        "`Payment claimed` order-state chip. A third use makes gold " +
        "decorative, and a merchant who learns gold is decorative stops " +
        "checking the claims queue.\n" +
        "  For a status that is merely notable use `secondary`; for something " +
        "settled use `success` or `outline-success`; for something wrong use " +
        "`destructive`. Gold is not a stronger version of any of them.",
    ).toEqual([]);
  });
});
