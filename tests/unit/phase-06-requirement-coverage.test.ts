import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The Phase 6 gate, expressed as a build-failing assertion instead of a
 * checklist somebody ticks (06-17, Task 1 — modeled directly on
 * `tests/unit/phase-03-requirement-coverage.test.ts`).
 *
 * A requirement marked "Complete" in `.planning/REQUIREMENTS.md` is a claim.
 * The claim is only worth anything for as long as the artifact behind it
 * still exists and still contains what it is supposed to, and the way that
 * stops being true is never a decision — it is a rename during a later
 * phase's refactor, a file moved while splitting a module, or an export
 * deleted while somebody cleaned up a neighbouring concern. Every one of
 * those leaves a green suite and a requirement with nothing behind it.
 *
 * So the map from the eight Phase 6 requirement IDs to their real artifacts
 * lives here as code. Deleting `LOW_STOCK_THRESHOLD` from
 * `src/server/dashboard/queries.ts` fails THIS file with DASH-02's own text
 * quoted at whoever removed it, in the same commit that broke the link,
 * rather than being discovered in Phase 9 when the low-stock indicator it
 * feeds behaves in a way nobody can explain.
 *
 * ADM-04 gets a second, dedicated block below rather than a row in the proof
 * table, because it is not a "does the artifact exist" requirement — it is a
 * scope CEILING. The only way to test a ceiling is to assert nothing was
 * added past it, which is the opposite shape of every other assertion here.
 *
 * This file runs in the database-free `unit` project: filesystem and source
 * text only, no import of application code, no Prisma, no network. It must
 * be able to run when the app cannot boot.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

// ---------------------------------------------------------------------------
// The requirement -> proof map
// ---------------------------------------------------------------------------

interface Proof {
  /** Repo-relative path to the artifact that must exist. */
  readonly file: string;
  /**
   * Substrings that must appear in the file, beyond mere existence — the
   * named export/symbol that actually does the work, not just a file with
   * the right name sitting empty. Optional: a component/page proof is
   * sometimes satisfied by existing at all (its route registers it).
   */
  readonly mustContain?: readonly string[];
}

interface Requirement {
  /** The requirement's text, verbatim from `.planning/REQUIREMENTS.md`. */
  readonly text: string;
  /** Every artifact that proves it. All of them must exist and qualify. */
  readonly proofs: readonly Proof[];
}

/**
 * The seven Phase 6 requirements with a positive artifact (everything except
 * ADM-04, which is a ceiling and is asserted in its own block below).
 */
const REQUIREMENT_PROOFS: Readonly<Record<string, Requirement>> = {
  "DASH-01": {
    text:
      "Merchant dashboard shows orders (with the Payment Claims queue " +
      "surfaced prominently), products/inventory, and basic sales numbers " +
      "(revenue, order count, products sold)",
    proofs: [
      { file: "src/components/dashboard/attention-band.tsx" },
      {
        file: "src/app/(dashboard)/dashboard/overview-metrics.tsx",
        mustContain: ["productsLive"],
      },
    ],
  },
  "DASH-02": {
    text:
      'Dashboard answers "how is the business performing, what needs ' +
      'attention, what\'s next" at a glance',
    proofs: [
      {
        file: "src/server/dashboard/queries.ts",
        mustContain: ["LOW_STOCK_THRESHOLD", "attentionCounts"],
      },
    ],
  },
  "ADM-01": {
    text: "Platform owner can view and suspend merchants/stores",
    proofs: [
      {
        file: "src/server/admin/suspend.ts",
        mustContain: ["setOrganizationSuspended"],
      },
      { file: "src/app/admin/page.tsx" },
    ],
  },
  "ADM-02": {
    text:
      "Platform owner can view a global payment-claims ledger across all " +
      "tenants",
    proofs: [
      { file: "src/app/admin/claims/page.tsx" },
      {
        file: "src/server/admin/claims.ts",
        mustContain: ["listOrderClaimsForAdmin"],
      },
    ],
  },
  "ADM-03": {
    text:
      "Platform owner can view domain status across tenants and has a " +
      "support-contact view",
    proofs: [
      {
        file: "src/server/admin/domain.ts",
        mustContain: ["domainStatusFor"],
      },
      { file: "src/components/admin/domain-cell.tsx" },
      { file: "src/app/admin/support/page.tsx" },
    ],
  },
  "ADM-05": {
    text:
      "A merchant and the platform owner have a persistent, in-app " +
      "messaging thread per merchant (text plus file/image attachments), " +
      "surfaced in both the merchant dashboard and a Super Admin inbox, " +
      "with an in-app badge and email nudge on a new message",
    proofs: [
      {
        file: "src/server/support/messages.ts",
        mustContain: ["postMerchantMessage", "markThreadReadForMerchant"],
      },
      { file: "src/app/(dashboard)/dashboard/support/page.tsx" },
      { file: "src/app/admin/support/[tenantId]/page.tsx" },
      {
        file: "src/server/support/notify.ts",
        mustContain: [
          "notifyPlatformOfMerchantMessage",
          "notifyMerchantOfPlatformMessage",
        ],
      },
    ],
  },
  "SUB-03": {
    text:
      "A merchant can pay their monthly subscription via manual Mobile " +
      "Money/Orange Money transfer and submit proof (transaction reference " +
      "+ receipt image) through the merchant↔platform support thread " +
      "(ADM-05); the platform owner reviews and confirms/rejects it there, " +
      "activating or extending the merchant's subscription on confirmation",
    proofs: [
      {
        file: "src/server/subscription/claims.ts",
        mustContain: ["submitSubscriptionPaymentClaim"],
      },
      {
        file: "src/server/admin/subscription-claims.ts",
        mustContain: ["confirmSubscriptionClaim"],
      },
      { file: "src/app/admin/subscriptions/page.tsx" },
    ],
  },
};

/**
 * A source file that exists but is trivially small is a stub, not a proof —
 * the same anti-vacuous instinct as `phase-03-requirement-coverage.test.ts`'s
 * `ASSERTION_BLOCK` check, adapted for artifact files rather than test files
 * (a `page.tsx`/`.ts` module has no `it(`/`test(` block to look for; the
 * signal here is "not an empty or near-empty placeholder").
 */
const MIN_ARTIFACT_BYTES = 40;

// ---------------------------------------------------------------------------

describe("Phase 6 requirement coverage", () => {
  it("the proof map itself is non-empty and at least one listed path resolves", () => {
    // Anti-vacuous guard, required first: a refactor that silently emptied
    // REQUIREMENT_PROOFS above (or renamed every file it points at in one
    // sweep) must not produce an all-skipped, all-green suite.
    const ids = Object.keys(REQUIREMENT_PROOFS);
    expect(
      ids.length,
      "REQUIREMENT_PROOFS is empty — this file would then assert nothing " +
        "about any Phase 6 requirement while still reporting green.",
    ).toBeGreaterThan(0);

    const anyResolves = Object.values(REQUIREMENT_PROOFS).some((req) =>
      req.proofs.some((proof) => existsSync(join(repoRoot, proof.file))),
    );
    expect(
      anyResolves,
      "Not a single proof path in REQUIREMENT_PROOFS resolves on disk. That " +
        "means either the repo root was computed wrong (fileURLToPath above " +
        "has drifted) or every listed artifact is gone — either way, the " +
        "per-requirement checks below would be checking against a broken map.",
    ).toBe(true);
  });

  for (const [id, requirement] of Object.entries(REQUIREMENT_PROOFS)) {
    it(`${id} points at artifacts that exist and contain real content`, () => {
      const missing = requirement.proofs.filter(
        (proof) => !existsSync(join(repoRoot, proof.file)),
      );

      expect(
        missing.map((p) => p.file),
        `${id} has no proof: ${missing.map((p) => p.file).join(", ")} is ` +
          `missing.\n  ${id} — "${requirement.text}"\n` +
          "  A requirement whose named artifact is gone is a requirement " +
          "nothing checks. Either restore the file, or move the " +
          "requirement's proof to whatever replaced it and update " +
          "REQUIREMENT_PROOFS here in the SAME commit — the map and the " +
          "artifact are one contract.",
      ).toEqual([]);

      const tooSmall = requirement.proofs.filter((proof) => {
        if (!existsSync(join(repoRoot, proof.file))) return false;
        return readFileSync(join(repoRoot, proof.file), "utf8").trim().length < MIN_ARTIFACT_BYTES;
      });

      expect(
        tooSmall.map((p) => p.file),
        `${id} has a proof file that is functionally empty: ` +
          `${tooSmall.map((p) => p.file).join(", ")}.\n  ${id} — ` +
          `"${requirement.text}"\n` +
          "  The file is on disk but has almost no content, which is the " +
          "shape of a stub left behind mid-refactor rather than a real " +
          "artifact.",
      ).toEqual([]);

      for (const proof of requirement.proofs) {
        if (!proof.mustContain || !existsSync(join(repoRoot, proof.file))) {
          continue;
        }

        const source = readFileSync(join(repoRoot, proof.file), "utf8");
        const missingSymbols = proof.mustContain.filter(
          (symbol) => !source.includes(symbol),
        );

        expect(
          missingSymbols,
          `${id}'s proof ${proof.file} no longer contains: ` +
            `${missingSymbols.join(", ")}.\n  ${id} — "${requirement.text}"\n` +
            "  The file still exists, but the specific symbol this " +
            "requirement's proof depends on was renamed or removed. Update " +
            "either the code or REQUIREMENT_PROOFS in the SAME commit.",
        ).toEqual([]);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// ADM-04 — the pilot-scope CEILING, not a lower bound
// ---------------------------------------------------------------------------

/**
 * ADM-04, verbatim from `.planning/REQUIREMENTS.md`: "Platform admin scope
 * stays pilot-sized (the items in this section) — the broader ~20-module
 * admin surface referenced in prior planning docs is explicitly deferred."
 *
 * There is no artifact whose EXISTENCE proves a ceiling — the only way to
 * test a scope ceiling is to assert that nothing beyond it was added. So
 * this walks the real `src/app/admin` tree on every run and compares it
 * against the exact set of routes the pilot scope allows, rather than
 * trusting a stale list written before Waves 5-7 executed.
 */
const ADMIN_ROOT = "src/app/admin";

/**
 * Every route segment (relative to `src/app/admin`, `""` for the root
 * itself) that carries a `page.tsx` today, found by walking the real
 * directory tree — not by trusting a list written in the plan before this
 * phase's later waves landed.
 */
function pageRoutesUnder(dir: string): string[] {
  const absolute = join(repoRoot, dir);
  if (!existsSync(absolute)) return [];

  const routes: string[] = [];
  if (existsSync(join(absolute, "page.tsx"))) {
    routes.push(dir === ADMIN_ROOT ? "" : dir.slice(ADMIN_ROOT.length + 1));
  }

  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      routes.push(...pageRoutesUnder(`${dir}/${entry.name}`));
    }
  }
  return routes;
}

/** Top-level directory names directly under `src/app/admin`. */
function topLevelDirsUnder(dir: string): string[] {
  const absolute = join(repoRoot, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

const adminPageRoutes = pageRoutesUnder(ADMIN_ROOT).sort();
const adminTopLevelDirs = topLevelDirsUnder(ADMIN_ROOT);

/**
 * EXACTLY the six pilot-scoped routes, and no more: the four rail
 * destinations named in `AdminSidebar`'s `NAV_ITEMS` (`src/components/admin/
 * admin-sidebar.tsx`), plus the two detail routes reached only by clicking
 * into a list row rather than the rail itself — a merchant's own admin
 * detail page, and a specific merchant's support thread.
 */
const ADMIN_CEILING_ROUTES = [
  "", // rail item 1 — admin root, the merchants list
  "claims", // rail item 2 — the global payment-claims ledger (ADM-02)
  "merchants/[id]", // detail route, reached from the merchants list (ADM-01)
  "subscriptions", // rail item 3 — the subscription-claims ledger (SUB-03)
  "support", // rail item 4 — the support inbox (ADM-05)
  "support/[tenantId]", // detail route, reached from the support inbox (ADM-05)
].sort();

const ADMIN_CEILING_TOP_LEVEL_DIRS = [
  "claims",
  "merchants",
  "subscriptions",
  "support",
].sort();

describe("ADM-04 — the admin route tree stays pilot-sized (a ceiling, not a floor)", () => {
  it("actually scanned the real src/app/admin directory", () => {
    expect(
      existsSync(join(repoRoot, ADMIN_ROOT)),
      "src/app/admin does not exist, so the ceiling check below would run " +
        "over nothing and pass with zero coverage.",
    ).toBe(true);

    expect(
      adminPageRoutes.length,
      "No page.tsx was found anywhere under src/app/admin. A vacuous pass " +
        "is the one failure mode a scope-ceiling guard must not have.",
    ).toBeGreaterThan(0);
  });

  it("has NO MORE than the four rail directories at the top level", () => {
    const extraDirs = adminTopLevelDirs.filter(
      (dir) => !ADMIN_CEILING_TOP_LEVEL_DIRS.includes(dir),
    );

    expect(
      extraDirs,
      `A fifth top-level admin directory exists: ${extraDirs.join(", ")}.\n` +
        "  ADM-04 is a scope ceiling, not a checklist of features to add: " +
        '"the broader ~20-module admin surface referenced in prior ' +
        'planning docs is explicitly deferred." A new top-level directory ' +
        "under src/app/admin — even one with no page.tsx yet — is exactly " +
        "how that deferred surface starts leaking back in, one scaffold at " +
        "a time.",
    ).toEqual([]);
  });

  it("has EXACTLY the six pilot-scoped page routes, no more, no fewer", () => {
    const extraRoutes = adminPageRoutes.filter(
      (route) => !ADMIN_CEILING_ROUTES.includes(route),
    );
    const missingRoutes = ADMIN_CEILING_ROUTES.filter(
      (route) => !adminPageRoutes.includes(route),
    );

    expect(
      extraRoutes,
      `A FIFTH admin destination exists beyond the pilot-scoped ceiling: ` +
        `${extraRoutes.map((r) => `/admin/${r}`).join(", ")}.\n` +
        "  ADM-04's success criteria names an exact, closed set: the four " +
        "rail destinations (merchants, claims, subscriptions, support) plus " +
        "the two detail routes reached from them (a merchant's own admin " +
        "page, a specific merchant's support thread) — nothing else. A " +
        "route beyond that set means the deferred ~20-module admin surface " +
        "(PLAT-V2-02) started leaking in because the route tree made a new " +
        "destination cheap to add. If this is a deliberate scope change, it " +
        "needs a REQUIREMENTS.md decision first, not a routing accident.",
    ).toEqual([]);

    expect(
      missingRoutes,
      `A pilot-scoped admin route disappeared: ` +
        `${missingRoutes.map((r) => `/admin/${r}`).join(", ")}.\n` +
        "  This is the other half of the ceiling: ADM-04 fixes the shape of " +
        "the admin surface exactly, so a route silently vanishing is just " +
        "as much a scope drift as a new one silently appearing — either " +
        "way, ADMIN_CEILING_ROUTES in this file and the real route tree have " +
        "diverged and need reconciling in the same commit.",
    ).toEqual([]);
  });
});
