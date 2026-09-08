import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { chromium } from "playwright";

import { PrismaClient } from "../src/generated/prisma/client";
import { processImage } from "../src/server/images/pipeline";
import {
  INDUSTRY_SEGMENTS,
  TEMPLATE_KEYS,
  isTemplateKey,
  type IndustrySegment,
  type TemplateKey,
} from "../src/server/theming/registry";
import {
  templateDefaultDocument,
  templateDefaultTokens,
} from "../src/server/theming/defaults";
import type { TemplatePreview } from "../src/server/theming/preview-manifest";
import { previewPlaceholderPhotoFor } from "./preview-placeholder-photos";
import {
  UnsafePreviewTargetError,
  assertSafePreviewTarget,
  resolvePreviewStoreSlug,
} from "./template-preview-target";

/**
 * `scripts/generate-template-previews.ts` — TMPL-06, `05.1` D-01 through D-06.
 *
 * ---------------------------------------------------------------------------
 * THIS IS NOT A ONE-OFF.
 * ---------------------------------------------------------------------------
 * It exists so that a change to any template's default design regenerates
 * every preview from one command — `npm run templates:previews` — rather
 * than a manual export nobody remembers how to reproduce (D-02). Re-run it
 * whenever `TEMPLATE_DEFAULTS` changes for any key, or to calibrate the crop
 * on a handful of templates with `--only` before committing to all fifty.
 *
 * ---------------------------------------------------------------------------
 * THIS SCRIPT PERFORMS DESTRUCTIVE WRITES to one tenant's published theme and
 * page document, once per template, in a loop.
 * ---------------------------------------------------------------------------
 * `./template-preview-target` is what makes that safe — it refuses to run
 * against anything but the explicitly-configured scratch store, and refuses
 * a store that has ever taken an order. Do not bypass it, and do not "helpfully"
 * widen what it accepts.
 *
 * ---------------------------------------------------------------------------
 * WHY IT RESEEDS INSTEAD OF ADDING A ROUTE (D-02, RESEARCH Pattern 1 and
 * Pitfall 7).
 * ---------------------------------------------------------------------------
 * A `preview/template/[key]` route would be a permanently public,
 * unauthenticated page rendering platform content on every merchant's own
 * brand-bearing hostname. `src/proxy.ts` hard-404s every `/s/*` path on every
 * host, and the storefront tree deliberately ships no
 * `X-Frame-Options`/`frame-ancestors` header because the editor iframe depends
 * on its absence — a preview route there would be a real brand-confusion
 * surface for a build-time convenience. Reseeding adds zero public surface and
 * produces pixel-identical output, because it screenshots the merchant's own
 * real, published storefront home page — it does not simulate one.
 *
 * ---------------------------------------------------------------------------
 * WHY IT READS `process.env` DIRECTLY AND BUILDS ITS OWN PRISMA CLIENT.
 * ---------------------------------------------------------------------------
 * CLAUDE.md's `src/env.ts`-only rule binds `src/**`; `scripts/**` is outside
 * it, exactly as `tests/setup/seed-two-tenants.ts` documents for itself. DO
 * NOT "FIX" THIS by importing the validated env module — that module carries
 * the full boot-time schema (every required provider credential) and is not
 * resolvable from a plain `tsx` invocation of this file alone.
 *
 * ---------------------------------------------------------------------------
 * WHY IT USES RELATIVE IMPORTS, never the path alias.
 * ---------------------------------------------------------------------------
 * `tsx` is not guaranteed to read `tsconfig.json` paths (Vitest famously does
 * not, which is why `vitest.config.ts` re-declares the alias). `prisma/seed.ts`
 * sets the precedent for this codebase's scripts.
 *
 * ---------------------------------------------------------------------------
 * THE PLACEHOLDER PHOTOGRAPHY IS FOR SCREENSHOTS ONLY (D-06).
 * ---------------------------------------------------------------------------
 * It never reaches `TEMPLATE_DEFAULTS` or a real merchant;
 * `tests/unit/preview-photo-isolation.test.ts` enforces that automatically.
 *
 * ---------------------------------------------------------------------------
 * ENV LOADING.
 * ---------------------------------------------------------------------------
 * `npm run templates:previews` is a plain `tsx` invocation with no dotenv
 * wrapper, so this file loads `.env.local` then `.env` itself, the same way
 * `prisma.config.ts` does for the same reason: the Prisma CLI (and here, a
 * bare `tsx` process) never reads `.env.local` on its own, and this project's
 * real credentials live there. Node's built-in loader never overwrites a key
 * already present in the real environment (CI, a developer's shell), matching
 * Next.js's own precedence.
 *
 * ---------------------------------------------------------------------------
 * WHY `../src/server/images/r2` IS A DYNAMIC `import()`, NOT A STATIC ONE.
 * ---------------------------------------------------------------------------
 * `r2.ts` itself imports `@/env`, whose `createEnv()` call throws synchronously
 * — at module-EVALUATION time, not call time — the moment it runs with a
 * required var missing. ES modules evaluate every static import, recursively
 * and depth-first, before the importing module's OWN top-level statements run,
 * regardless of where the import sits textually in the file. So a static
 * `import { putObject } from "../src/server/images/r2"` up here would make
 * `@/env` evaluate — and potentially throw — before the `.env.local`/`.env`
 * loading loop three lines below it ever gets a chance to populate
 * `process.env`. The generic `@t3-oss/env-nextjs` crash that produces is not
 * just a test artefact: it is real breakage, because `.env.local` is never
 * loaded before `r2.ts` needs it. The fix is to defer the import with `await
 * import(...)` inside `main()`, called only after the loop above has already
 * run — see the call site for exactly where.
 */
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

/**
 * Type-only reference to `../src/server/images/r2`'s exports. A `typeof
 * import(...)` type query is erased entirely at compile time — it never
 * becomes a runtime import — so this gives the dynamically-imported module
 * (see `main()`) full type safety without re-introducing the static-import
 * evaluation-order problem documented above.
 */
type R2Module = typeof import("../src/server/images/r2");

const LOG_PREFIX = "[generate-template-previews]";

function log(message: string): void {
  console.log(`${LOG_PREFIX} ${message}`);
}

function logError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${LOG_PREFIX} ${message}`);
}

/**
 * Issues one reachability probe against `url`, resolving to `{ ok, status }`
 * and never throwing on a non-2xx response (RESEARCH Pitfall 4 — one
 * actionable failure, never fifty timeouts).
 *
 * WHY THIS IS NOT A PLAIN `fetch(url)` FOR A `localhost`/`*.localhost` TARGET.
 * Node's own DNS resolver — unlike Chromium, which the Playwright browser
 * below uses, and unlike curl or any real browser — does not implement RFC
 * 6761's requirement that every `*.localhost` name resolve to loopback
 * without a DNS query. On some Windows/Node combinations, a plain
 * `fetch("http://sub.localhost:3001/")` fails with `ENOTFOUND` even while
 * the dev server is listening and reachable, producing a false "server is
 * down" reading — exactly the kind of misleading failure this probe exists
 * to prevent. Since RFC 6761 guarantees the target is loopback, connect to
 * `127.0.0.1` directly for these hosts instead of asking Node's resolver.
 * `fetch()` itself cannot be reused for that "connect by IP, route by
 * hostname" trick either: the WHATWG spec makes `Host` a forbidden request
 * header, so `fetch` silently discards any attempt to override it, which
 * breaks `classifyHost()`'s subdomain routing (verified empirically — it
 * 404s instead of reaching the tenant). `node:http`'s `request()` carries no
 * such restriction, so it is used for exactly this one local-dev case; a real
 * (non-localhost) production hostname still goes through a plain `fetch`.
 */
function probeReachable(url: string): Promise<{ ok: boolean; status: number }> {
  const parsed = new URL(url);
  const isLocalDevHost =
    parsed.hostname === "localhost" || parsed.hostname.endsWith(".localhost");

  if (!isLocalDevHost) {
    return fetch(url).then((response) => ({
      ok: response.ok,
      status: response.status,
    }));
  }

  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: "GET",
        headers: { Host: parsed.host },
      },
      (res) => {
        res.resume(); // drain the body — only the status matters here
        const status = res.statusCode ?? 0;
        resolve({ ok: status >= 200 && status < 300, status });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

interface CliOptions {
  /** Empty means "every template key" — the default, full-catalog run. */
  readonly onlyKeys: readonly TemplateKey[];
  /** Do everything except the R2 upload and the manifest rewrite. */
  readonly dryRun: boolean;
}

/**
 * Parses `--only=key1,key2` and `--dry-run`. Returns `null` on any unknown
 * flag or unknown `--only` key, having already logged an actionable message —
 * the caller only needs to set `process.exitCode` and stop.
 */
function parseCliArgs(argv: readonly string[]): CliOptions | null {
  let onlyKeys: TemplateKey[] = [];
  let dryRun = false;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg.startsWith("--only=")) {
      const candidates = arg
        .slice("--only=".length)
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry !== "");

      const unknown = candidates.filter((candidate) => !isTemplateKey(candidate));
      if (unknown.length > 0) {
        logError(
          `refusing to run: --only names unknown template key(s): ` +
            `${unknown.join(", ")}. Valid keys: ${TEMPLATE_KEYS.join(", ")}.`,
        );
        return null;
      }

      onlyKeys = candidates as TemplateKey[];
      continue;
    }

    logError(
      `unrecognised argument "${arg}". Supported flags: --only=key1,key2 --dry-run.`,
    );
    return null;
  }

  return { onlyKeys, dryRun };
}

// ---------------------------------------------------------------------------
// Scratch-tenant product seeding (RESEARCH Pitfall 5)
// ---------------------------------------------------------------------------

/**
 * Eight products, drawing from the six industry-segment placeholder photos
 * (the last two segments are reused to reach eight) — RESEARCH Pitfall 5: with
 * zero products every product-grid section renders a dashed empty-state block,
 * which reads as a broken template.
 */
const SCRATCH_PRODUCT_SEGMENTS: readonly IndustrySegment[] = [
  ...INDUSTRY_SEGMENTS,
  INDUSTRY_SEGMENTS[0],
  INDUSTRY_SEGMENTS[1],
];

const SCRATCH_PRODUCT_COUNT = SCRATCH_PRODUCT_SEGMENTS.length;

/** Plausible, varied XAF prices — not read for correctness anywhere. */
function scratchProductPriceXaf(index: number): number {
  return 3000 + index * 1500;
}

/**
 * Seeds (or verifies) the scratch tenant's eight preview products, each with a
 * real placeholder photo run through the same `product` preset and key layout
 * `src/app/api/upload/finalize/route.ts` produces — never a bespoke layout.
 *
 * IDEMPOTENT AND NON-DESTRUCTIVE (D-08): every write below is an `upsert`
 * keyed on the model's own unique constraint. There is no `delete` or
 * `deleteMany` anywhere in this function, or in this file.
 *
 * Skips the whole step when `skipIfPresent` is true and the tenant already
 * carries all eight products, so a `--only` calibration re-run stays fast.
 */
async function seedScratchProducts(
  prisma: PrismaClient,
  tenantId: string,
  options: { readonly skipIfPresent: boolean; readonly dryRun: boolean },
  // Dynamically-resolved (see `main()`'s "WHY ... IS A DYNAMIC import()"
  // comment) — threaded through as a parameter rather than a free variable
  // captured from a top-level static import.
  r2: Pick<R2Module, "objectKeyFor" | "derivativePrefixFor" | "putObject">,
): Promise<void> {
  if (options.skipIfPresent) {
    const existing = await prisma.product.count({ where: { tenantId } });
    if (existing >= SCRATCH_PRODUCT_COUNT) {
      log(
        `scratch tenant already has ${existing} product(s) — skipping product seed (--only).`,
      );
      return;
    }
  }

  for (const [index, segment] of SCRATCH_PRODUCT_SEGMENTS.entries()) {
    const n = index + 1;
    const slug = `preview-product-${n}`;
    // Stable, deterministic — not `crypto.randomUUID()` — so re-running the
    // seed overwrites the same R2 objects instead of orphaning a new set
    // every time. Matches `UPLOAD_ID_PATTERN` (lowercase letters, digits and
    // hyphens, 8-64 chars).
    const uploadId = slug;

    const photoPath = previewPlaceholderPhotoFor(segment);
    const original = readFileSync(photoPath);
    const derived = await processImage(original, "product");
    const largest = derived.at(-1);
    if (!largest) {
      throw new Error(`processImage produced no derivative for "${slug}"`);
    }

    const originalKey = r2.objectKeyFor(tenantId, "products", uploadId);
    const prefix = r2.derivativePrefixFor(originalKey);

    if (!options.dryRun) {
      await Promise.all(
        derived.map((image) =>
          r2.putObject(`${prefix}/${image.label}.webp`, image.body, image.contentType),
        ),
      );
    }

    const product = await prisma.product.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      update: {
        name: `Preview product ${n}`,
        basePriceXaf: scratchProductPriceXaf(index),
        active: true,
      },
      create: {
        tenantId,
        slug,
        name: `Preview product ${n}`,
        basePriceXaf: scratchProductPriceXaf(index),
        active: true,
      },
    });

    await prisma.productVariant.upsert({
      where: {
        tenantId_productId_option1Value_option2Value: {
          tenantId,
          productId: product.id,
          option1Value: "",
          option2Value: "",
        },
      },
      update: { stock: 10, active: true },
      create: {
        tenantId,
        productId: product.id,
        option1Value: "",
        option2Value: "",
        stock: 10,
        active: true,
      },
    });

    await prisma.productImage.upsert({
      where: {
        tenantId_productId_position: { tenantId, productId: product.id, position: 0 },
      },
      update: { storageKey: prefix, width: largest.width, height: largest.height },
      create: {
        tenantId,
        productId: product.id,
        position: 0,
        storageKey: prefix,
        width: largest.width,
        height: largest.height,
      },
    });

    log(`seeded product "${slug}" (${segment})`);
  }
}

// ---------------------------------------------------------------------------
// Playwright capture — browser context, per-template loop, measured crop
// ---------------------------------------------------------------------------

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;

/**
 * D-01's "hero plus roughly the next section", expressed as a fixed overlap
 * added to the SECOND section's own measured top offset (RESEARCH Pitfall 6).
 * A single named constant so the crop can be recalibrated in one place if
 * plan 05.1-08's eyeball pass says otherwise.
 */
const SECOND_SECTION_CLIP_MARGIN_PX = 120;

/** Used only when the second section cannot be located at all. */
const FALLBACK_CLIP_HEIGHT_PX = VIEWPORT_HEIGHT;

/**
 * Measures the crop for the CURRENT page, then screenshots it.
 *
 * Locates the second `<section>` element on the page — every section variant
 * in `src/app/s/[slug]/sections/**` renders a top-level `<section>`, and the
 * announcement bar / header are not `<section>` elements, so index 1 is always
 * the template's own second content section, never chrome. The clip height is
 * that section's own measured top offset plus the fixed margin, clamped to the
 * page's actual scroll height so a short template is never asked for more
 * pixels than it has.
 */
async function measureAndCapture(
  page: import("playwright").Page,
): Promise<Buffer> {
  let clipHeight = FALLBACK_CLIP_HEIGHT_PX;

  try {
    const secondSection = page.locator("section").nth(1);
    const box = await secondSection.boundingBox();
    if (!box) throw new Error("second section has no bounding box");
    clipHeight = box.y + SECOND_SECTION_CLIP_MARGIN_PX;
  } catch (error) {
    logError(
      `could not measure the second section — using the fallback height ` +
        `(${FALLBACK_CLIP_HEIGHT_PX}px). Cause: ${
          error instanceof Error ? error.message : String(error)
        }`,
    );
  }

  const scrollHeight = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  const height = Math.max(1, Math.min(clipHeight, scrollHeight));

  return page.screenshot({
    type: "png",
    // The other half of the animation control (RESEARCH Pitfall 1): Playwright
    // fast-forwards any finite CSS animation to its end state before
    // capturing, complementing the reduced-motion context option below.
    animations: "disabled",
    caret: "hide",
    scale: "device",
    clip: { x: 0, y: 0, width: VIEWPORT_WIDTH, height },
  });
}

/**
 * Writes the scratch tenant's published (and matching draft) state to one
 * template's defaults, in a single transaction — so the tenant is never left
 * half-migrated between two templates if the process is interrupted.
 *
 * `StorefrontTheme.tenantId` is itself the unique key (one theme per tenant);
 * `StorefrontPage` is keyed on `(tenantId, pageType)` — both upserts, never a
 * delete, matching every other write in this file.
 */
async function writeScratchTenantTemplate(
  prisma: PrismaClient,
  tenantId: string,
  key: TemplateKey,
): Promise<void> {
  const now = new Date();

  await prisma.$transaction([
    prisma.storefrontTheme.upsert({
      where: { tenantId },
      update: {
        draftTemplateKey: key,
        publishedTemplateKey: key,
        draftTokens: templateDefaultTokens(key),
        publishedTokens: templateDefaultTokens(key),
        publishedAt: now,
      },
      create: {
        tenantId,
        draftTemplateKey: key,
        publishedTemplateKey: key,
        draftTokens: templateDefaultTokens(key),
        publishedTokens: templateDefaultTokens(key),
        publishedAt: now,
      },
    }),
    prisma.storefrontPage.upsert({
      where: { tenantId_pageType: { tenantId, pageType: "home" } },
      update: {
        draft: templateDefaultDocument(key),
        published: templateDefaultDocument(key),
        publishedAt: now,
        draftUpdatedAt: now,
      },
      create: {
        tenantId,
        pageType: "home",
        draft: templateDefaultDocument(key),
        published: templateDefaultDocument(key),
        publishedAt: now,
        draftUpdatedAt: now,
      },
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Generated manifest — merge, never clobber (D-05's partial-state contract)
// ---------------------------------------------------------------------------

const MANIFEST_PATH = fileURLToPath(
  new URL("../src/server/theming/preview-manifest.ts", import.meta.url),
);

const MANIFEST_DECLARATION_MARKER = "export const TEMPLATE_PREVIEWS";

/**
 * Pulls the currently-committed entries back out of the manifest's own
 * generated syntax, so a `--only` run can merge into them rather than
 * clobbering the other 49. Deliberately a text-level parse rather than a
 * dynamic `import()` of the file this function's caller is about to
 * overwrite — the two would otherwise have to reason about Node's module
 * cache across a single read-then-write pass in this same process.
 */
function parseExistingManifestEntries(
  source: string,
): Partial<Record<TemplateKey, TemplatePreview>> {
  const entries: Partial<Record<TemplateKey, TemplatePreview>> = {};
  const pattern =
    /"([a-z0-9-]+)":\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+),\s*bytes:\s*(\d+),\s*generatedAt:\s*"([^"]*)"\s*,?\s*\}/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const [, key, width, height, bytes, generatedAt] = match;
    if (!key || !isTemplateKey(key)) continue;
    entries[key] = {
      width: Number(width),
      height: Number(height),
      bytes: Number(bytes),
      generatedAt: generatedAt ?? "",
    };
  }

  return entries;
}

function formatManifestEntry(key: TemplateKey, preview: TemplatePreview): string {
  return (
    `  "${key}": { width: ${preview.width}, height: ${preview.height}, ` +
    `bytes: ${preview.bytes}, generatedAt: "${preview.generatedAt}" },`
  );
}

/**
 * Rewrites `preview-manifest.ts`, preserving everything above the
 * `TEMPLATE_PREVIEWS` declaration byte-for-byte (the committed banner, header
 * and `TemplatePreview` interface) so a regeneration diff shows only entries.
 */
function writeManifest(
  updates: Partial<Record<TemplateKey, TemplatePreview>>,
): number {
  const source = readFileSync(MANIFEST_PATH, "utf8");
  const markerIndex = source.indexOf(MANIFEST_DECLARATION_MARKER);
  if (markerIndex === -1) {
    throw new Error(
      `${MANIFEST_PATH} no longer contains the "${MANIFEST_DECLARATION_MARKER}" ` +
        "marker this script rewrites — the committed file has drifted.",
    );
  }

  const header = source.slice(0, markerIndex);
  const existing = parseExistingManifestEntries(source);
  const merged: Partial<Record<TemplateKey, TemplatePreview>> = {
    ...existing,
    ...updates,
  };

  const lines = TEMPLATE_KEYS.filter((key) => merged[key] !== undefined).map(
    (key) => formatManifestEntry(key, merged[key]!),
  );

  const declaration =
    `${MANIFEST_DECLARATION_MARKER}: Readonly<\n` +
    `  Partial<Record<TemplateKey, TemplatePreview>>\n` +
    `> = {\n${lines.length > 0 ? `${lines.join("\n")}\n` : ""}};\n`;

  writeFileSync(MANIFEST_PATH, header + declaration, "utf8");
  return lines.length;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (!options) {
    process.exitCode = 1;
    return;
  }

  const selectedKeys = options.onlyKeys.length > 0 ? options.onlyKeys : TEMPLATE_KEYS;

  // -- Guard 1: is a scratch target even configured, and shaped like a slug? --
  let configuredSlug: string;
  try {
    configuredSlug = resolvePreviewStoreSlug();
  } catch (error) {
    if (error instanceof UnsafePreviewTargetError) {
      logError(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  // -- Guard 2: is there even a database to connect to? -----------------------
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() === "") {
    logError(
      "DATABASE_URL is not set. This script builds its own Prisma client " +
        "against it (mirroring tests/setup/seed-two-tenants.ts) and never " +
        "falls back to another variable. Set DATABASE_URL in .env.local.",
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    // -- Guard 3: does the configured store actually exist? -------------------
    const org = await prisma.organization.findUnique({
      where: { slug: configuredSlug },
    });
    if (!org) {
      logError(
        `no store with slug "${configuredSlug}" exists. Sign one up at ` +
          `http://localhost:3001/signup using that exact slug, then re-run ` +
          `npm run templates:previews.`,
      );
      process.exitCode = 1;
      return;
    }

    // -- Guard 4 + 5: does it have orders, and does it match what's configured? --
    const orderCount = await prisma.order.count({ where: { tenantId: org.id } });
    try {
      assertSafePreviewTarget({ slug: org.slug, configuredSlug, orderCount });
    } catch (error) {
      if (error instanceof UnsafePreviewTargetError) {
        logError(error.message);
        process.exitCode = 1;
        return;
      }
      throw error;
    }

    // -- Dev-server probe (RESEARCH Pitfall 4), once, before any browser work --
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    if (!rootDomain || rootDomain.trim() === "") {
      logError(
        "NEXT_PUBLIC_ROOT_DOMAIN is not set. This is required to derive the " +
          "scratch store's storefront URL. Set it in .env.local.",
      );
      process.exitCode = 1;
      return;
    }

    // Mirrors `src/app/s/[slug]/preview/page.tsx`'s `editorOrigin` derivation
    // verbatim — two spellings of one rule is how the two drift.
    const protocol = rootDomain.startsWith("localhost") ? "http" : "https";
    const baseUrl =
      process.env.TEMPLATE_PREVIEW_BASE_URL?.trim() ||
      `${protocol}://${configuredSlug}.${rootDomain}/`;

    try {
      const { ok, status } = await probeReachable(baseUrl);
      if (!ok) throw new Error(`HTTP ${status}`);
    } catch (error) {
      logError(
        `cannot reach ${baseUrl} — start the server first with \`npm run dev\` ` +
          `(it binds port 3001) and re-run \`npm run templates:previews\`. ` +
          `(${error instanceof Error ? error.message : String(error)})`,
      );
      process.exitCode = 1;
      return;
    }

    // -- Dynamic import of `../src/server/images/r2` --------------------------
    // Deferred until here (well after the `.env.local`/`.env` loading loop at
    // the top of this file has run) for the ES-module evaluation-order reason
    // explained in the "WHY ... IS A DYNAMIC import()" header comment: `r2.ts`
    // imports `@/env`, which throws at evaluation time if a required var is
    // missing, and a static import of it would evaluate before this file's own
    // env-loading loop ever ran. Placed after every guard above so that a run
    // refused for a missing/unsafe `TEMPLATE_PREVIEW_STORE_SLUG` never has to
    // touch R2 credentials at all — the cheapest, most specific guard fails
    // first.
    const r2: R2Module = await import("../src/server/images/r2");

    // -- Scratch-tenant product seeding (RESEARCH Pitfall 5) -------------------
    await seedScratchProducts(
      prisma,
      org.id,
      {
        skipIfPresent: options.onlyKeys.length > 0,
        dryRun: options.dryRun,
      },
      r2,
    );

    // -- The capture loop -------------------------------------------------------
    const browser = await chromium.launch();
    const manifestUpdates: Partial<Record<TemplateKey, TemplatePreview>> = {};

    try {
      const context = await browser.newContext({
        viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
        // 2x so the stored WebP is crisp on the high-DPI screens a merchant
        // evaluates templates on; Sharp downscales the resulting capture back
        // down to the preset's 800px long edge.
        deviceScaleFactor: 2,
        // Half of the animation control (RESEARCH Pitfall 1): the storefront's
        // global stylesheet collapses every animation under its data-surface
        // scope to 1ms under this media query, so the hero's mount cascade is
        // already at its end state on the first painted frame.
        reducedMotion: "reduce",
        // The storefront has no dark variant; pinning this stops an OS
        // preference on the generating machine from leaking into fifty
        // committed assets.
        colorScheme: "light",
        // The prices on the page are Intl-formatted from this locale/timezone
        // pair, so pinning both is what makes every capture show the same
        // currency string a Cameroonian shopper actually sees, regardless of
        // whatever locale the generating machine happens to run.
        locale: "fr-CM",
        timezoneId: "Africa/Douala",
      });
      const page = await context.newPage();

      for (const key of selectedKeys) {
        try {
          await writeScratchTenantTemplate(prisma, org.id, key);

          await page.goto(baseUrl, { waitUntil: "networkidle" });

          const pngBuffer = await measureAndCapture(page);
          const [derivative] = await processImage(pngBuffer, "templatePreview");
          if (!derivative) {
            throw new Error(`processImage produced no derivative for "${key}"`);
          }

          if (!options.dryRun) {
            await r2.putObject(
              `${r2.templatePreviewPrefixFor(key)}/card.webp`,
              derivative.body,
              derivative.contentType,
            );
          }

          manifestUpdates[key] = {
            width: derivative.width,
            height: derivative.height,
            bytes: derivative.body.length,
            generatedAt: new Date().toISOString(),
          };

          log(
            `${key}: ${derivative.body.length} bytes ` +
              `(${derivative.width}x${derivative.height})`,
          );
        } catch (error) {
          logError(
            `failed to generate the preview for "${key}": ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
          process.exitCode = 1;
          // A partial manifest is a valid state (D-05's fallback exists for
          // exactly this) — one bad template must not abort the run.
        }
      }
    } finally {
      await browser.close();
    }

    // -- Manifest emit ----------------------------------------------------------
    if (options.dryRun) {
      log("dry run: skipping the R2 upload(s) and the manifest rewrite.");
    } else {
      const total = writeManifest(manifestUpdates);
      log(
        `wrote ${Object.keys(manifestUpdates).length} preview(s) to R2 under ` +
          `templates/{key}/card.webp and updated ` +
          `src/server/theming/preview-manifest.ts (${total} entries total).`,
      );
    }
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
