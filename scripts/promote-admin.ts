import { existsSync } from "node:fs";

/**
 * `scripts/promote-admin.ts` — ADM-01's bootstrap, and the ONLY code path in
 * this repository that sets `User.platformRole` to `"admin"`.
 *
 * ---------------------------------------------------------------------------
 * THERE IS NO IN-APP PROMOTION UI, AND ADDING ONE WOULD DEFEAT THE FIELD.
 * ---------------------------------------------------------------------------
 * `platformRole` is declared `input: false` in `src/server/auth/auth.ts`
 * precisely so that no request payload anywhere can mint a platform
 * administrator: Better Auth's `toZodSchema({ isClientSide: true })` drops
 * `input: false` fields from the create/update body schema, and `z.object`
 * then strips a forged `{"platformRole":"admin"}` before `ctx.body` exists.
 * That property is worth more than the convenience of a button. A "promote
 * user" endpoint — however well guarded — is a public write path to the
 * highest-privilege column in the product, and it would have to be defended
 * forever; a script that only runs from an operator's shell has no request
 * surface to defend at all (06-RESEARCH.md Pitfall 6, T-06-02).
 *
 * So the bootstrap is deliberately out of band. Run it once per environment:
 *
 *   npm run admin:promote -- owner@example.com          # dry run, prints the target
 *   npm run admin:promote -- owner@example.com --yes    # actually writes
 *
 * ---------------------------------------------------------------------------
 * IT REFUSES AN ACCOUNT THAT OWNS A STORE (D-04).
 * ---------------------------------------------------------------------------
 * The platform owner's account has no organization. That is not a style
 * preference — `requireMerchantContext()` and `requireAdminContext()` are two
 * different identities reading the same session, and an account that is both
 * would land in whichever ladder ran first and would carry a tenant into a
 * surface that is supposed to have none. 06-RESEARCH.md Pitfall 5 names the
 * owner acquiring an `Organization` as the failure that "breaks D-04
 * permanently". Refusing here is the cheapest place to stop it, because after
 * the fact there is no clean unwind: the store has a slug, a slug-history row,
 * and possibly orders.
 *
 * ---------------------------------------------------------------------------
 * CLI FAILURE POSTURE
 * ---------------------------------------------------------------------------
 * `console.error` plus `process.exitCode = 1`, matching
 * `tests/setup/seed-two-tenants.ts`. Never `process.exit()` — it terminates
 * the event loop immediately, which would abandon an in-flight write and leave
 * the connection pool open. Setting the exit code lets the process finish what
 * it started and then report the failure.
 *
 * ---------------------------------------------------------------------------
 * WHY `@/env`-DEPENDENT MODULES ARE IMPORTED DYNAMICALLY INSIDE `main()`
 * ---------------------------------------------------------------------------
 * `../src/server/db/base` imports `@/env`, whose `createEnv()` throws
 * synchronously at module-EVALUATION time when a required variable is missing.
 * ES modules evaluate every static import — recursively, depth-first — BEFORE
 * the importing module's own top-level statements run, regardless of where the
 * import sits textually. A static import of `base.ts` would therefore evaluate
 * `@/env` before the `.env.local`/`.env` loading loop below ever ran, and the
 * script would crash with a generic "Invalid environment variables" every time.
 * This is the lesson recorded in STATE.md from plan 05.1-07; the fix is the
 * deferred `await import(...)` in `main()`.
 *
 * `--conditions=react-server` is required in the npm script for a second,
 * unrelated reason: `base.ts` opens with `import "server-only"`, a marker
 * package whose default export condition throws on import. Only the
 * `react-server` condition resolves it to an empty module.
 */

/*
 * Same loader and the same precedence as `prisma.config.ts`: a variable already
 * present in the real environment always wins, then `.env.local`, then `.env`.
 * Node's built-in `loadEnvFile` rather than `dotenv/config`, because that only
 * ever reads `.env` and `dotenv` is not a declared dependency of this project.
 */
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

/**
 * Type-only reference to the base client module. A `typeof import(...)` type
 * query is erased entirely at compile time — it never becomes a runtime import
 * — so the deferred module below is still fully typed.
 */
type BaseModule = typeof import("../src/server/db/base");

const LOG_PREFIX = "[promote-admin]";

function log(message: string): void {
  console.log(`${LOG_PREFIX} ${message}`);
}

function logError(message: string): void {
  console.error(`${LOG_PREFIX} ${message}`);
}

const ADMIN_ROLE = "admin";

const USAGE =
  "Usage: npm run admin:promote -- <email> [--yes]\n" +
  "\n" +
  "  <email>  the address of an EXISTING account with no store (D-04).\n" +
  "  --yes    perform the write. Without it this is a dry run that only\n" +
  "           prints the account it would have promoted.\n" +
  "\n" +
  "This is the only code path in the repository that grants platform admin.\n" +
  "There is deliberately no in-app equivalent — see this file's header.";

interface CliOptions {
  readonly email: string;
  readonly confirmed: boolean;
}

/**
 * Parse `<email> [--yes]`.
 *
 * Returns `null` on anything ambiguous, having already logged an actionable
 * message. Zero positional arguments and two-or-more are BOTH refused: the
 * second case is the shape a shell-glob or a quoting mistake takes, and
 * silently promoting the first of several addresses is exactly the outcome a
 * one-shot privilege grant must not have.
 */
function parseCliArgs(argv: readonly string[]): CliOptions | null {
  const positional: string[] = [];
  let confirmed = false;

  for (const arg of argv) {
    if (arg === "--yes") {
      confirmed = true;
      continue;
    }
    if (arg.startsWith("--")) {
      logError(`Unknown flag "${arg}".\n\n${USAGE}`);
      return null;
    }
    positional.push(arg);
  }

  if (positional.length === 0) {
    logError(`No email address given.\n\n${USAGE}`);
    return null;
  }

  if (positional.length > 1) {
    logError(
      `Expected exactly one email address, got ${positional.length}: ` +
        `${positional.join(", ")}.\n\n${USAGE}`,
    );
    return null;
  }

  return { email: positional[0]!.trim(), confirmed };
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (!options) {
    process.exitCode = 1;
    return;
  }

  // Deferred for the ES-module evaluation-order reason in the header, and
  // placed after the argument guards so a mistyped invocation never has to
  // resolve a database connection string at all.
  const { prismaBase }: BaseModule = await import("../src/server/db/base");

  try {
    const user = await prismaBase.user.findUnique({
      where: { email: options.email },
      select: { id: true, email: true, name: true, platformRole: true },
    });

    if (!user) {
      logError(
        `No account exists for "${options.email}".\n` +
          "This script promotes an EXISTING account; it never creates one. " +
          "Sign up first, then re-run — and check the address for typos, " +
          "because a near-miss here silently does nothing.",
      );
      process.exitCode = 1;
      return;
    }

    /*
     * The target, printed BEFORE anything is written.
     *
     * The whole point of the `--yes` gate is that a human sees this line and
     * recognises the account, so it names the id, the address and the current
     * role rather than just confirming that "a user was found".
     */
    log(`resolved account:`);
    log(`  id            ${user.id}`);
    log(`  email         ${user.email}`);
    log(`  name          ${user.name}`);
    log(`  platformRole  ${user.platformRole}  (before)`);

    /*
     * D-04, enforced before the idempotence check rather than after: an account
     * that owns a store must be refused whether or not it is already an admin,
     * because "already admin AND owns a store" is the broken state this guard
     * exists to surface, not a reason to exit quietly.
     */
    const memberships = await prismaBase.member.findMany({
      where: { userId: user.id },
      select: { organization: { select: { name: true, slug: true } } },
    });

    if (memberships.length > 0) {
      const owned = memberships
        .map((row) => `${row.organization.name} (${row.organization.slug})`)
        .join(", ");
      logError(
        `Refusing to promote "${user.email}": the account is a member of ` +
          `${memberships.length} organization(s) — ${owned}.\n` +
          "D-04: the platform owner's account has no store. An account that " +
          "is both a merchant and the platform administrator carries a tenant " +
          "into a surface designed to have none, and after the fact there is " +
          "no clean unwind — the store already holds a slug, a slug-history " +
          "row and possibly orders.\n" +
          "Create a separate account for the platform owner and promote that.",
      );
      process.exitCode = 1;
      return;
    }

    if (user.platformRole === ADMIN_ROLE) {
      log(
        `"${user.email}" is already ${ADMIN_ROLE}. Nothing written — this ` +
          "script is idempotent on purpose, so re-running it during a " +
          "deployment is safe.",
      );
      return;
    }

    if (!options.confirmed) {
      log(
        "DRY RUN — nothing was written. Re-run with --yes to grant platform " +
          `admin to "${user.email}".`,
      );
      return;
    }

    const promoted = await prismaBase.user.update({
      where: { id: user.id },
      data: { platformRole: ADMIN_ROLE },
      select: { platformRole: true },
    });

    log(`  platformRole  ${promoted.platformRole}  (after)`);
    log(
      `done. "${user.email}" can now sign in at /login and will be routed to ` +
        "/admin (D-05).",
    );
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    // The client holds a connection pool; a CLI process hangs without this.
    await prismaBase.$disconnect();
  }
}

void main();
