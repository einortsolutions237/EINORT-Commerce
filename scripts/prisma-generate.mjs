// Guarded `prisma generate` for the postinstall hook.
//
// Prisma 7 has no implicit query-engine binary: the client must be generated
// explicitly, and CI fails on a missing client. But the schema does not exist
// until plan 01-02, and an unguarded postinstall would make `npm install` fail
// on a fresh clone of this commit.
//
// A shell one-liner would not survive both cmd.exe and sh, so this is a script.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const schemaPath = fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url));

if (!existsSync(schemaPath)) {
  console.log("[postinstall] no prisma/schema.prisma yet — skipping prisma generate.");
  process.exit(0);
}

execFileSync("npx", ["prisma", "generate"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
