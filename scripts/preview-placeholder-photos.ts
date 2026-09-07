/**
 * The placeholder-photo module — TMPL-06, 05.1 D-06.
 *
 * ---------------------------------------------------------------------------
 * THIS MODULE MUST NEVER BE IMPORTED FROM `src/`.
 * ---------------------------------------------------------------------------
 * The photographs it points at exist strictly to make template-preview
 * screenshots look like a stocked store the way Shopify's own theme-store
 * previews do (05.1-07, the screenshot-generation script). They are not
 * merchant content, not a template default, and not a fallback for a missing
 * merchant image. Phase 5's D-04 makes shared stock imagery structurally
 * unreferenceable from a template default on purpose —
 * `storageKeySchema`'s tenant-prefixed regex rejects anything that is not a
 * real tenant's own upload — and this module does not create a back door to
 * that invariant. `tests/unit/preview-photo-isolation.test.ts` enforces the
 * boundary with a source scan of every file under `src/` and will fail the
 * build the moment either this module's identifier or the
 * `preview-assets` directory name crosses into it.
 *
 * Deliberately NOT marked `server-only`: this module lives outside the
 * `src/` server tree on purpose and must stay importable from a plain `tsx`
 * script (05.1-07's generator), which does not resolve the `react-server`
 * condition that the `server-only` package requires.
 *
 * Every path below is resolved from `import.meta.url`, never
 * `process.cwd()` — the idiom used throughout `scripts/`
 * (`scripts/generate-brand-icons.mjs`, `tests/setup/seed-two-tenants.ts`)
 * because a script invoked from any working directory must still find its
 * own sibling files.
 */

import { fileURLToPath } from "node:url";

/**
 * The closed set of six segment ids. Kept as a literal tuple here rather
 * than imported from `src/server/theming/registry.ts` (`INDUSTRY_SEGMENTS`)
 * — that module opens with `import "server-only"`, which throws when
 * resolved outside a `react-server` condition, and this module must stay
 * importable from a plain `tsx` invocation. `tests/unit/preview-photo-isolation.test.ts`
 * cross-checks this list against the real `INDUSTRY_SEGMENTS` export from
 * the `unit` Vitest project, where `server-only` is aliased to a stub.
 */
const PLACEHOLDER_SEGMENTS = [
  "fashion-apparel",
  "electronics",
  "beauty-cosmetics",
  "grocery-food",
  "furniture-home",
  "general-retail",
] as const;

/**
 * Segment id -> the absolute on-disk path of that segment's placeholder
 * photograph. Resolved once, at module load, from `import.meta.url` — the
 * consuming script (05.1-07) may be invoked from any directory.
 */
export const PREVIEW_PLACEHOLDER_PHOTOS: Readonly<Record<string, string>> =
  Object.freeze(
    Object.fromEntries(
      PLACEHOLDER_SEGMENTS.map((segment) => [
        segment,
        fileURLToPath(
          new URL(`./preview-assets/${segment}.jpg`, import.meta.url),
        ),
      ]),
    ),
  );

/**
 * The one entry point 05.1-07 calls. Throws a plain `Error` naming the
 * unknown segment and listing the six valid ids rather than returning a
 * silent fallback — the throw-don't-sanitise posture
 * `src/server/images/r2.ts`'s `objectKeyFor` states for the same reason: a
 * quietly wrong default here would composite the wrong industry's photo (or
 * none at all) into a template preview with no error anywhere in the log.
 */
export function previewPlaceholderPhotoFor(segment: string): string {
  const path = PREVIEW_PLACEHOLDER_PHOTOS[segment];
  if (!path) {
    throw new Error(
      `Unknown preview placeholder segment: "${segment}". Valid segments: ` +
        `${PLACEHOLDER_SEGMENTS.join(", ")}.`,
    );
  }
  return path;
}
