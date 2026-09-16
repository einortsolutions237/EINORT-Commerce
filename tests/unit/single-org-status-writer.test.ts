import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * ADM-01, asserted against the source rather than against behaviour.
 *
 * `Organization.status` has been NOT NULL with a default since Phase 1, and
 * its schema comment has said "suspension is a Phase 6 admin-only write"
 * since then. `src/server/admin/suspend.ts` is that write, and it is the
 * ONLY module in this codebase permitted to make it, for the identical
 * reason `tests/unit/single-order-state-writer.test.ts` guards
 * `Order.state`: `suspend.ts` pairs the status flip with two other
 * consequences inside the same transaction — the D-15 `SYSTEM` message that
 * IS this phase's audit record (ADM-04 adds no audit table), and the Redis
 * hostname-cache eviction a suspended storefront needs to stop serving
 * immediately rather than after a TTL (T-06-69). A second writer would flip
 * the column and skip both, and the gap would be invisible until a merchant
 * asked why their "suspended" store kept answering requests, or why nobody
 * could say when or why a store went down.
 *
 * No runtime test can catch it: a second writer is, by construction, code
 * that the first writer's tests never execute. So the check is a source
 * scan, run by CI instead of remembered in review — cloned from
 * `single-order-state-writer.test.ts`'s own structure rather than
 * reinvented, down to the anti-vacuous guard and the positive control.
 *
 * IT MUST NOT PASS VACUOUSLY. A scan that found no files, or a detector that
 * no longer recognises a status write, would both report "no second writer"
 * with total confidence and zero coverage. The first two tests below pin
 * that files were actually read and that the detector still fires on the
 * one file that is SUPPOSED to match. If `suspend.ts` is ever renamed or
 * moved, the positive control fails loudly rather than the guard silently
 * guarding nothing.
 *
 * ---------------------------------------------------------------------------
 * THE DETECTOR IS SCOPED TO THE `organization` DELEGATE, NOT TO EVERY
 * `status:` ASSIGNMENT IN THE TREE.
 * ---------------------------------------------------------------------------
 * `PaymentClaim.status`, `SubscriptionPaymentClaim.status` and the Better
 * Auth `Invitation.status` column all exist, are all written legitimately
 * elsewhere, and all happen to share the column name `status`. A guard that
 * fired on the bare word would either be disabled by the first person it
 * falsely accused, or would have to special-case every unrelated model by
 * name — which is itself a second place this rule could drift. Matching
 * `\.organization\.(update|updateMany|create|createMany|upsert)\s*\(` first,
 * and only then checking that call's own argument window for a `status:`
 * assignment, is what keeps the guard both precise and durable: a future
 * `PaymentClaim.status` writer can never trip it, and a future
 * `Organization.status` writer — however it is spelled inside the call —
 * always will.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** The one module allowed to write `Organization.status`. */
const SANCTIONED_WRITER = "src/server/admin/suspend.ts";

/**
 * Directories whose coverage is asserted rather than assumed.
 *
 * Each one is a place a second writer would plausibly be written:
 * `src/server/admin` is where `suspend.ts` itself lives and the newest,
 * most tempting zone for a second admin-authored writer to appear beside it;
 * `src/server/auth` is where `Organization` rows are first created at signup
 * and where Better Auth's `input: false` plumbing for this very column
 * lives; `src/server/tenant` is where the hostname resolver and its cache
 * read `status` on every request and would be an easy — wrong — place to
 * "helpfully" patch it during a cache-invalidation fix. A rename or a move
 * that takes any of them out of `src/` must fail this file, not silently
 * shrink what it guards.
 */
const COVERED_ZONES = [
  "src/server/admin",
  "src/server/auth",
  "src/server/tenant",
] as const;

/**
 * Directories skipped entirely.
 *
 * `src/generated/**` is the Prisma client output — machine-written, never
 * hand-edited, and full of `status:` in type declarations that describe the
 * column rather than write it. `eslint.config.mjs` ignores it for the same
 * reason, and `single-order-state-writer.test.ts` skips it for the same
 * reason again.
 */
const SKIPPED_DIRS = new Set(["generated"]);

/** `organization` delegate operations that can persist a column value. */
const WRITE_OPS = ["update", "updateMany", "create", "createMany", "upsert"];

const WRITE_CALL = new RegExp(
  `\\.organization\\.(?:${WRITE_OPS.join("|")})\\s*\\(`,
  "g",
);

/**
 * `status:` and nothing that merely contains the word, such as
 * `subscriptionStatus:`.
 *
 * The `\b` before `status` is load-bearing for the identical reason
 * `single-order-state-writer.test.ts`'s own `STATE_ASSIGNMENT` documents:
 * `Organization.subscriptionStatus` is a real, legitimately-written column on
 * the very same model, and a bare substring match would flag every
 * subscription-status write as if it touched suspension.
 */
const STATUS_ASSIGNMENT = /\bstatus\s*:/;

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
 * Without this the guard is self-invalidating: `suspend.ts`'s own header
 * explains the rule by quoting the very pattern it forbids, and so does this
 * file. Documenting a prohibition must not trip it. Characters are replaced
 * with spaces rather than removed so the line numbers reported in a failure
 * still point at the real source. Cloned verbatim from
 * `single-order-state-writer.test.ts`.
 */
function stripCommentLines(code: string): string {
  return code
    .split("\n")
    .map((line) =>
      /^\s*(?:\/\/|\/\*|\*)/.test(line) ? " ".repeat(line.length) : line,
    )
    .join("\n");
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

export interface StatusWrite {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
}

/**
 * Every `organization.<write op>({ … status: … })` in one module.
 *
 * The statement WINDOW is the argument list of the call, found by matching
 * parentheses — not "the next N lines". A window of lines would both miss a
 * `data:` object formatted across a long argument list and flag an unrelated
 * `status:` in the statement that happens to follow.
 */
function statusWritesIn(file: string, code: string): StatusWrite[] {
  const source = stripCommentLines(code);
  const writes: StatusWrite[] = [];

  WRITE_CALL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WRITE_CALL.exec(source)) !== null) {
    const open = match.index + match[0].length - 1;
    const close = matchParen(source, open);
    if (close === -1) continue;

    const args = source.slice(open, close + 1);
    if (!STATUS_ASSIGNMENT.test(args)) continue;

    writes.push({
      file,
      line: source.slice(0, match.index).split("\n").length,
      snippet: args.replace(/\s+/g, " ").trim().slice(0, 120),
    });
  }

  return writes;
}

const scannedFiles = sourceFilesUnder("src").sort();

const allWrites = scannedFiles.flatMap((file) =>
  statusWritesIn(file, readFileSync(join(repoRoot, file), "utf8")),
);

describe("single Organization.status writer", () => {
  it("actually scanned the source tree", () => {
    expect(
      existsSync(join(repoRoot, "src")),
      "src/ does not exist. This guard would then scan nothing and pass with " +
        "zero coverage.",
    ).toBe(true);

    expect(
      scannedFiles.length,
      "No .ts files were found under src/. A vacuous pass is the one failure " +
        "mode a source-level guard must not have.",
    ).toBeGreaterThan(0);

    /*
     * PER-ZONE, not just in aggregate. A count over all of `src/` stays
     * comfortably non-zero even if one directory is renamed or moved out, so
     * it would report full confidence over a surface it had stopped reading.
     */
    for (const zone of COVERED_ZONES) {
      expect(
        existsSync(join(repoRoot, zone)),
        `${zone} does not exist. This guard would then be silently narrower ` +
          "than it claims — update COVERED_ZONES in " +
          "tests/unit/single-org-status-writer.test.ts to the directory's " +
          "new home.",
      ).toBe(true);

      expect(
        scannedFiles.filter((file) => file.startsWith(`${zone}/`)).length,
        `No .ts files under ${zone} were scanned, so nothing in that zone ` +
          "was checked for a second Organization.status writer.",
      ).toBeGreaterThan(0);
    }
  });

  it("still detects a status write in the sanctioned writer", () => {
    // The positive control. `suspend.ts` writes `Organization.status` — that
    // is its entire job — so the detector MUST find it. If this fails,
    // either the file moved (update SANCTIONED_WRITER) or the matcher above
    // no longer recognises a status write, in which case the real test below
    // is passing over nothing.
    expect(
      allWrites.map((write) => write.file),
      `${SANCTIONED_WRITER} contains no detected Organization.status write, ` +
        "so the detector in tests/unit/single-org-status-writer.test.ts has " +
        "drifted from the code and the guard below is vacuous.",
    ).toContain(SANCTIONED_WRITER);
  });

  it("has no second writer of Organization.status anywhere in src/", () => {
    const offenders = allWrites.filter(
      (write) => write.file !== SANCTIONED_WRITER,
    );

    expect(
      offenders.map(
        (write) => `${write.file}:${write.line} — ${write.snippet}`,
      ),
      "ADM-01 violation — something other than " +
        `${SANCTIONED_WRITER} writes Organization.status.\n` +
        "  Every suspension or restoration must invalidate the Redis " +
        "hostname cache and post a SYSTEM message into the merchant's " +
        "support thread, in the SAME transaction as the status flip. A " +
        "direct organization write skips both, so a suspended storefront " +
        "keeps serving until the cache TTL expires and nobody — not even " +
        "the platform owner — has a record of when or why the store went " +
        "down (T-06-69, ADM-04).\n" +
        "  Call `setOrganizationSuspended({ merchantId, suspend, reason, " +
        "actorUserId })` instead.\n" +
        "  If a genuinely new status-writing path is ever needed, it " +
        `belongs INSIDE ${SANCTIONED_WRITER}, not beside it.`,
    ).toEqual([]);
  });
});
