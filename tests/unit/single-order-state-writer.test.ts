import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * ORD-05 / T-03-14, asserted against the source rather than against behaviour.
 *
 * `src/server/orders/transition.ts` is the only module in this codebase
 * permitted to write `Order.state`, because it is the only one that writes the
 * matching `OrderEvent` in the same transaction. That is a real guarantee only
 * for as long as it stays true, and the way it stops being true is not a
 * decision anybody makes — it is one line in a later plan:
 *
 *   await tx.order.update({ where: { id }, data: { state: "CONFIRMED" } })
 *
 * inside `confirmOrder`, `reviewClaim`, an admin fixup script, or a seed. That
 * line compiles, passes every behavioural test that does not happen to inspect
 * the event table, and moves an order with nobody's name attached to it. The
 * order's history then has a hole exactly where a payment dispute would need
 * it, and the hole is invisible until someone disputes (T-03-12, T-03-14).
 *
 * No runtime test can catch it: a second writer is, by construction, code that
 * the first writer's tests never execute. So the check is a source scan, run by
 * CI instead of remembered in review — the same idiom as
 * `tests/unit/no-tenant-id-param.test.ts`, and for the same reason.
 *
 * IT MUST NOT PASS VACUOUSLY. A scan that found no files, or a detector that no
 * longer recognises a state write, would both report "no second writer" with
 * total confidence and zero coverage. The first two tests below pin that files
 * were actually read and that the detector still fires on the one file that is
 * SUPPOSED to match. If `transition.ts` is ever renamed or moved, the positive
 * control fails loudly rather than the guard silently guarding nothing.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** The one module allowed to write `Order.state`. */
const SANCTIONED_WRITER = "src/server/orders/transition.ts";

/**
 * Directories skipped entirely.
 *
 * `src/generated/**` is the Prisma client output — machine-written, never
 * hand-edited, and full of `state:` in type declarations that describe the
 * column rather than write it. `eslint.config.mjs` ignores it for the same
 * reason.
 */
const SKIPPED_DIRS = new Set(["generated"]);

/** Order delegate operations that can persist a column value. */
const WRITE_OPS = ["update", "updateMany", "create", "createMany", "upsert"];

const WRITE_CALL = new RegExp(
  `\\.order\\.(?:${WRITE_OPS.join("|")})\\s*\\(`,
  "g",
);

/**
 * `state:` but not `toState:` / `fromState:`.
 *
 * The `\b` is load-bearing: `OrderEvent.toState` and `OrderEvent.fromState` are
 * written on every legitimate transition, and a bare substring match would flag
 * the audit row as if it were a state write.
 */
const STATE_ASSIGNMENT = /\bstate\s*:/;

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
 * Without this the guard is self-invalidating: the header of `transition.ts`
 * explains the rule by quoting the very pattern it forbids, and so does this
 * file. Documenting a prohibition must not trip it. Characters are replaced
 * with spaces rather than removed so the line numbers reported in a failure
 * still point at the real source.
 *
 * Line-oriented rather than a full tokenizer, deliberately: the shapes that
 * matter are `//` lines and JSDoc `*` continuation lines, which is what every
 * comment in this repository looks like. A trailing `// …` after live code is
 * left alone, which is the safe direction — it can only ever cause a false
 * POSITIVE, and a false positive is a failing build somebody reads, not a
 * silent hole.
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

export interface StateWrite {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
}

/**
 * Every `order.<write op>({ … state: … })` in one module.
 *
 * The statement WINDOW is the argument list of the call, found by matching
 * parentheses — not "the next N lines". A window of lines would both miss a
 * `data:` object formatted across a long argument list and flag an unrelated
 * `state:` in the statement that happens to follow.
 */
function stateWritesIn(file: string, code: string): StateWrite[] {
  const source = stripCommentLines(code);
  const writes: StateWrite[] = [];

  WRITE_CALL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WRITE_CALL.exec(source)) !== null) {
    const open = match.index + match[0].length - 1;
    const close = matchParen(source, open);
    if (close === -1) continue;

    const args = source.slice(open, close + 1);
    if (!STATE_ASSIGNMENT.test(args)) continue;

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
  stateWritesIn(file, readFileSync(join(repoRoot, file), "utf8")),
);

describe("single Order.state writer", () => {
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
  });

  it("still detects a state write in the sanctioned writer", () => {
    // The positive control. `transition.ts` writes `Order.state` — that is its
    // entire job — so the detector MUST find it. If this fails, either the file
    // moved (update SANCTIONED_WRITER) or the matcher above no longer
    // recognises a state write, in which case the real test below is passing
    // over nothing.
    expect(
      allWrites.map((write) => write.file),
      `${SANCTIONED_WRITER} contains no detected Order.state write, so the ` +
        "detector in tests/unit/single-order-state-writer.test.ts has drifted " +
        "from the code and the guard below is vacuous.",
    ).toContain(SANCTIONED_WRITER);
  });

  it("has no second writer of Order.state anywhere in src/", () => {
    const offenders = allWrites.filter(
      (write) => write.file !== SANCTIONED_WRITER,
    );

    expect(
      offenders.map(
        (write) => `${write.file}:${write.line} — ${write.snippet}`,
      ),
      "ORD-05 violation — something other than " +
        `${SANCTIONED_WRITER} writes Order.state.\n` +
        "  Every state change must leave an OrderEvent naming who made it, in " +
        "the SAME transaction. A direct order write skips that row, so the " +
        "order moves and its history does not record who moved it — which is " +
        "precisely the gap a payment dispute needs closed (T-03-12, " +
        "T-03-14).\n" +
        "  Call `transitionOrder(tx, { orderId, to, actor, actorUserId })` " +
        "instead. It takes the caller's transaction, so any stock or claim " +
        "work stays indivisible with the state change.\n" +
        "  If a genuinely new state-writing path is ever needed, it belongs " +
        `INSIDE ${SANCTIONED_WRITER}, not beside it.`,
    ).toEqual([]);
  });
});
