import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Import-zone boundaries — the enforcement mechanism for TEN-02 and TEN-05.
 *
 * Prisma has no built-in guard against a feature module reaching for the
 * unscoped client, and neither requirement is achievable by convention on a
 * solo AI-assisted build. Making it a lint error is the control.
 *
 * The `src/server/**` directories referenced below are created by plans 01-02
 * and 01-06. The zones are declared here first, on purpose, so that code lands
 * inside an already-enforced boundary rather than having the boundary retrofitted
 * around code that already drifted.
 *
 * Note: `next lint` was removed in Next 16, so ESLint is invoked directly from
 * the `lint` npm script and from CI — there is no framework wrapper left to
 * silently pick this config up.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // --- Project-wide conventions ---------------------------------------------
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // A leading underscore marks a binding that is intentionally unused —
      // typically a hook parameter reserved for a later plan to consume.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // --- Default zone: everything under src/ ----------------------------------
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/server/db/base"],
              message: "Use scopedDb(tenantId), platformDb, or adminDb.",
            },
            {
              group: ["**/server/db/admin"],
              message: "adminDb is only importable from src/server/admin/**.",
            },
            {
              group: ["**/generated/prisma*"],
              message: "Never import the generated client directly.",
            },
          ],
        },
      ],
      // Raw queries are NOT intercepted by Prisma client extensions — this was
      // verified empirically, not assumed. A single $queryRaw in a feature
      // module silently bypasses every tenant guarantee in the system.
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name=/^\\$(queryRaw|executeRaw)/]",
          message:
            "Raw queries bypass tenant scoping (verified NOT intercepted by client extensions).",
        },
      ],
    },
  },

  // --- Sanctioned zone: the data-access layer itself ------------------------
  // These modules are what the rest of the app is restricted *to*, so they must
  // be able to import the base client to build the scoped clients on top of it.
  {
    files: [
      "src/server/db/**",
      "src/server/tenant/**",
      "src/server/auth/**",
    ],
    rules: { "no-restricted-imports": "off" },
  },

  // --- Admin zone: architecturally isolated (TEN-05) ------------------------
  // adminDb lives here and is deliberately unscoped. The trade is that the admin
  // surface may not reuse tenant-scoped services — otherwise "isolated" degrades
  // into "shares most of its code with the tenant path".
  {
    files: ["src/server/admin/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/server/db/tenant-scoped"],
              message:
                "Admin surface must not reuse tenant-scoped services (TEN-05).",
            },
          ],
        },
      ],
    },
  },

  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "**/.next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma 7 client output (plan 01-02) — generated, never hand-edited.
    "src/generated/**",
    // GSD executor worktrees live inside the repo root, each with its own
    // .next build output. Without this, ESLint recurses into every worktree
    // still checked out and lints their generated route types.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
