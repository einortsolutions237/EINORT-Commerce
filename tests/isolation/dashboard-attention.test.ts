import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { scopedDb } from "@/server/db/tenant-scoped";
import {
  activeProductCount,
  attentionCounts,
  LOW_STOCK_THRESHOLD,
} from "@/server/dashboard/queries";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * DASH-02 — the three counts behind the `Needs your attention` band, and
 * DASH-01's `Products live` card, proved against a real Postgres.
 *
 * ---------------------------------------------------------------------------
 * THE BOUNDARY IS ASSERTED, NOT ASSUMED.
 * ---------------------------------------------------------------------------
 * R-5 fixes low stock at `LOW_STOCK_THRESHOLD` and the tile copy interpolates
 * that same number, so a merchant reads "Items at or below 5 in stock" and
 * then counts the rows themselves. An off-by-one in an attention band is
 * therefore not a cosmetic bug: `lt` instead of `lte` HIDES a variant the
 * merchant was told would be listed, and `lte: threshold + 1` INVENTS work
 * that is not there. Either way the band stops matching the sentence printed
 * directly underneath it, and a merchant who catches it once stops trusting
 * the whole band — which is the one band on the page that must never be
 * noise. So the cases at exactly `LOW_STOCK_THRESHOLD` and at
 * `LOW_STOCK_THRESHOLD + 1` are both seeded explicitly below.
 *
 * ---------------------------------------------------------------------------
 * EVERY FIGURE DIFFERS BETWEEN THE TWO TENANTS, ON PURPOSE.
 * ---------------------------------------------------------------------------
 * T-06-18 is a cross-tenant disclosure threat, and the usual mirror-image
 * fixture cannot detect it: if both tenants held two claims, a query that
 * dropped its tenant predicate would return four — but a query that read the
 * WRONG tenant's rows would still return two and the assertion would pass. So
 * tenant A and tenant B are given deliberately unequal counts for all four
 * figures (claims 2/1, low stock 2/1, disputed 1/3, active products 2/3), and
 * each is asserted from both sides. A leak changes the number rather than
 * merely duplicating it.
 *
 * Rows are created through `scopedDb(tenantId)`, which is also the code under
 * test's own door — that is safe here because the fixture identifiers are
 * fixed and tenant-named (`tenant-a-…`), so a row landing under the wrong
 * tenant is visible in the failure diff rather than silently absorbed.
 * `tests/setup/seed-two-tenants.ts` keeps its unscoped client for the
 * different reason its own header gives.
 *
 * `attentionCounts` and `activeProductCount` are plain `(tenantId) => …`
 * functions with no session or header dependency, so this file calls them
 * directly rather than standing up the signed-session harness — the only
 * boundary under test is `scopedDb`'s tenant filter. Same reasoning as
 * `tests/isolation/search.test.ts`.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const QUERIES_FILE = "src/server/dashboard/queries.ts";
const BAND_FILE = "src/components/dashboard/attention-band.tsx";

// ---------------------------------------------------------------------------
// Fixture rows, on top of the two-tenant baseline
// ---------------------------------------------------------------------------

/**
 * The baseline fixture already gives each tenant one active product whose one
 * variant holds `stock: 10` — comfortably above the threshold, so it never
 * contributes to the low-stock count and every number below is one this file
 * seeded on purpose.
 */
const FIXTURE_EPOCH = new Date("2026-01-01T00:00:00.000Z");

interface OrderSeed {
  readonly suffix: string;
  readonly state: "PAYMENT_CLAIMED" | "DISPUTED";
}

async function seedOrders(
  tenantId: string,
  slug: string,
  orders: readonly OrderSeed[],
): Promise<void> {
  // `createMany`, not `create`: the composite FKs in this schema
  // (`[tenantId, productId]`, `[tenantId, orderId]`) make Prisma's CHECKED
  // create input demand a nested relation once `tenantId` is present — and
  // `scopedDb` always stamps `tenantId`. `createMany` takes plain scalars, so
  // the fixture can name the parent by id the way
  // `tests/setup/seed-two-tenants.ts` does.
  await scopedDb(tenantId).order.createMany({
    data: orders.map((order) => ({
      tenantId,
      id: `${tenantId}-${order.suffix}`,
      orderNumber: `${slug}-${order.suffix}`,
      state: order.state,
      channel: "MANUAL_TRANSFER" as const,
      customerName: `${slug} customer`,
      customerPhone: "237600000000",
      subtotalXaf: 5000,
      totalXaf: 5000,
      trackingTokenHash: `${tenantId}-${order.suffix}-token-hash`,
      stockHeld: true,
      placedAt: FIXTURE_EPOCH,
      updatedAt: FIXTURE_EPOCH,
    })),
  });
}

interface VariantSeed {
  readonly suffix: string;
  readonly stock: number;
  readonly active: boolean;
}

async function seedProduct(
  tenantId: string,
  slug: string,
  product: {
    readonly suffix: string;
    readonly active: boolean;
    readonly variants: readonly VariantSeed[];
  },
): Promise<void> {
  const db = scopedDb(tenantId);
  const productId = `${tenantId}-${product.suffix}`;

  await db.product.createMany({
    data: [
      {
        tenantId,
        id: productId,
        name: `${slug} ${product.suffix}`,
        slug: `${slug}-${product.suffix}`,
        basePriceXaf: 5000,
        active: product.active,
        createdAt: FIXTURE_EPOCH,
        updatedAt: FIXTURE_EPOCH,
      },
    ],
  });

  await db.productVariant.createMany({
    data: product.variants.map((variant) => ({
      tenantId,
      id: `${productId}-${variant.suffix}`,
      productId,
      // Distinct option values: `@@unique([tenantId, productId,
      // option1Value, option2Value])` would otherwise reject the second
      // variant of the same product.
      option1Value: variant.suffix,
      option2Value: "",
      stock: variant.stock,
      active: variant.active,
    })),
  });
}

beforeAll(async () => {
  /*
   * The three exports this whole file is about, checked before a single row is
   * seeded. Without this the fixture below fails first and reports something
   * unhelpful — `stock: undefined` reaches Prisma and the run dies with
   * "Argument `stock` is missing", which reads as a broken fixture rather than
   * as the missing module it actually is.
   */
  expect(
    typeof LOW_STOCK_THRESHOLD,
    `${QUERIES_FILE} does not export LOW_STOCK_THRESHOLD. R-5 puts the ` +
      "threshold in exactly one place, and this file reads it from there " +
      "rather than hardcoding a number that could drift from the query.",
  ).toBe("number");
  expect(
    typeof attentionCounts,
    `${QUERIES_FILE} does not export attentionCounts.`,
  ).toBe("function");
  expect(
    typeof activeProductCount,
    `${QUERIES_FILE} does not export activeProductCount.`,
  ).toBe("function");

  await seedTwoTenants();

  // -------------------------------------------------------------------------
  // Tenant A — claims 2, low stock 2, disputed 1, active products 2
  // -------------------------------------------------------------------------
  await seedOrders(TENANT_A.id, TENANT_A.slug, [
    { suffix: "claimed-1", state: "PAYMENT_CLAIMED" },
    { suffix: "claimed-2", state: "PAYMENT_CLAIMED" },
    { suffix: "disputed-1", state: "DISPUTED" },
  ]);

  await seedProduct(TENANT_A.id, TENANT_A.slug, {
    suffix: "low-stock-product",
    active: true,
    variants: [
      // THE INCLUSIVE EDGE. "at or below" means this one counts.
      { suffix: "at-threshold", stock: LOW_STOCK_THRESHOLD, active: true },
      // ONE ABOVE. This one must not.
      { suffix: "above-threshold", stock: LOW_STOCK_THRESHOLD + 1, active: true },
      // Sold out is the loudest case of low stock, not a separate one.
      { suffix: "zero", stock: 0, active: true },
      // D-08: a variant the merchant took out of the store is not work.
      { suffix: "parked-zero", stock: 0, active: false },
    ],
  });

  // A DEACTIVATED product's live variant is not work either — the merchant
  // already removed the product from the store, so nothing can be sold out of
  // stock on it.
  await seedProduct(TENANT_A.id, TENANT_A.slug, {
    suffix: "parked-product",
    active: false,
    variants: [{ suffix: "zero", stock: 0, active: true }],
  });

  // -------------------------------------------------------------------------
  // Tenant B — claims 1, low stock 1, disputed 3, active products 3
  // -------------------------------------------------------------------------
  await seedOrders(TENANT_B.id, TENANT_B.slug, [
    { suffix: "claimed-1", state: "PAYMENT_CLAIMED" },
    { suffix: "disputed-1", state: "DISPUTED" },
    { suffix: "disputed-2", state: "DISPUTED" },
    { suffix: "disputed-3", state: "DISPUTED" },
  ]);

  await seedProduct(TENANT_B.id, TENANT_B.slug, {
    suffix: "low-stock-product",
    active: true,
    variants: [{ suffix: "one-left", stock: 1, active: true }],
  });

  await seedProduct(TENANT_B.id, TENANT_B.slug, {
    suffix: "well-stocked-product",
    active: true,
    variants: [{ suffix: "plenty", stock: 100, active: true }],
  });
});

describe("attentionCounts", () => {
  it("counts tenant A's own pending claims, low stock and disputed orders", async () => {
    const counts = await attentionCounts(TENANT_A.id);

    expect(counts.pendingClaims).toBe(2);
    expect(counts.lowStock).toBe(2);
    expect(counts.disputedOrders).toBe(1);
  });

  it("counts tenant B's own figures, all four different from tenant A's", async () => {
    const counts = await attentionCounts(TENANT_B.id);

    expect(counts.pendingClaims).toBe(1);
    expect(counts.lowStock).toBe(1);
    expect(counts.disputedOrders).toBe(3);
  });

  it("never mixes the two tenants' rows into one number", async () => {
    const [a, b] = await Promise.all([
      attentionCounts(TENANT_A.id),
      attentionCounts(TENANT_B.id),
    ]);

    // The platform-wide totals, which no tenant may ever see: 3 claims, 3
    // low-stock variants, 4 disputed orders. Asserting against the SUM is what
    // catches a dropped tenant predicate specifically, as opposed to a
    // wrong-tenant read (which the unequal per-tenant numbers above catch).
    expect(
      a.pendingClaims + b.pendingClaims,
      "the two tenants' claim counts no longer sum to the seeded total, so " +
        "one of them is reading rows it does not own",
    ).toBe(3);
    expect(a.lowStock + b.lowStock).toBe(3);
    expect(a.disputedOrders + b.disputedOrders).toBe(4);

    expect(a.pendingClaims).not.toBe(b.pendingClaims);
    expect(a.lowStock).not.toBe(b.lowStock);
    expect(a.disputedOrders).not.toBe(b.disputedOrders);
  });

  it("includes a variant sitting exactly on the threshold and excludes the one above it", async () => {
    const db = scopedDb(TENANT_A.id);
    const productId = `${TENANT_A.id}-low-stock-product`;

    const counted = await db.productVariant.findUnique({
      where: { tenantId_id: { tenantId: TENANT_A.id, id: `${productId}-at-threshold` } },
      select: { stock: true },
    });
    const excluded = await db.productVariant.findUnique({
      where: {
        tenantId_id: { tenantId: TENANT_A.id, id: `${productId}-above-threshold` },
      },
      select: { stock: true },
    });

    // The positive control: without these the two assertions below could pass
    // over rows that were never seeded at the values this test claims.
    expect(counted?.stock).toBe(LOW_STOCK_THRESHOLD);
    expect(excluded?.stock).toBe(LOW_STOCK_THRESHOLD + 1);

    const before = await attentionCounts(TENANT_A.id);

    // Move the above-threshold variant DOWN onto the boundary: the count must
    // rise by exactly one, which is only true if the comparison is `lte`.
    await db.productVariant.update({
      where: { tenantId_id: { tenantId: TENANT_A.id, id: `${productId}-above-threshold` } },
      data: { stock: LOW_STOCK_THRESHOLD },
    });
    const onBoundary = await attentionCounts(TENANT_A.id);
    expect(
      onBoundary.lowStock,
      "a variant AT the threshold was not counted — the copy promises " +
        "'at or below', so the comparison must be lte, not lt",
    ).toBe(before.lowStock + 1);

    // And back up one, which must undo it exactly.
    await db.productVariant.update({
      where: { tenantId_id: { tenantId: TENANT_A.id, id: `${productId}-above-threshold` } },
      data: { stock: LOW_STOCK_THRESHOLD + 1 },
    });
    const restored = await attentionCounts(TENANT_A.id);
    expect(
      restored.lowStock,
      "a variant ONE ABOVE the threshold was counted — the band is " +
        "inventing work that does not exist",
    ).toBe(before.lowStock);
  });

  it("excludes parked variants and variants of deactivated products", async () => {
    // Tenant A holds four zero-or-low variants in total: at-threshold, zero,
    // parked-zero (inactive variant) and the parked product's live variant.
    // Only the first two are work, so a count of 2 is the assertion that the
    // other two are excluded — and the two exclusions have different causes,
    // which is why both are seeded.
    const counts = await attentionCounts(TENANT_A.id);
    expect(counts.lowStock).toBe(2);
  });
});

describe("activeProductCount", () => {
  it("counts only this tenant's active products", async () => {
    // A: the fixture product + `low-stock-product`. `parked-product` is
    // `active: false` and D-08 keeps it forever, so counting it would make the
    // `Products live` card report a catalogue the shopper cannot see.
    expect(await activeProductCount(TENANT_A.id)).toBe(2);

    // B: the fixture product + two more.
    expect(await activeProductCount(TENANT_B.id)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// VALIDATION TBD-13 — the threshold exists in exactly one place
// ---------------------------------------------------------------------------

/**
 * Blank out whole-line comments, preserving line count and column offsets.
 *
 * Without this the guard is self-invalidating: `queries.ts`'s header explains
 * R-5 by naming the number, and so does this file. Documenting a rule must not
 * trip it. Characters become spaces rather than disappearing so a reported
 * line number still points at the real source. Same helper, same reasoning, as
 * `tests/unit/single-order-state-writer.test.ts`.
 */
function stripCommentLines(code: string): string {
  return code
    .split("\n")
    .map((line) =>
      /^\s*(?:\/\/|\/\*|\*)/.test(line) ? " ".repeat(line.length) : line,
    )
    .join("\n");
}

/**
 * The threshold value as a standalone integer literal.
 *
 * The trailing `-` in the lookbehind is what keeps Tailwind out of the scan:
 * `size-5`, `grid-cols-5` and `min-h-11` all embed digits inside a class name
 * and none of them is a stock threshold. A negative stock threshold is not a
 * thing, so nothing legitimate is lost by refusing to match after a hyphen.
 */
function thresholdLiteral(): RegExp {
  return new RegExp(`(?<![\\w.$-])${LOW_STOCK_THRESHOLD}(?![\\w.])`);
}

/** `const NAME = …` / `export const NAME: T = …` at module level. */
const CONSTANT_DECLARATION =
  /^\s*(?:export\s+)?const\s+[A-Z][A-Z0-9_]*\s*(?::[^=]*)?=/;

function readStripped(file: string): string | null {
  const path = join(repoRoot, file);
  if (!existsSync(path)) return null;
  return stripCommentLines(readFileSync(path, "utf8"));
}

describe("LOW_STOCK_THRESHOLD is a single exported constant", () => {
  it("is declared once, in the queries module, at the value the code uses", () => {
    const code = readStripped(QUERIES_FILE);
    expect(
      code,
      `${QUERIES_FILE} does not exist, so every scan below would pass over ` +
        "an empty string with zero coverage",
    ).not.toBeNull();

    const declarations = (code ?? "")
      .split("\n")
      .filter((line) => /\bexport\s+const\s+LOW_STOCK_THRESHOLD\b/.test(line));

    expect(
      declarations.length,
      "LOW_STOCK_THRESHOLD must be declared exactly once, and exported, so " +
        "the query and the tile copy read the same number.",
    ).toBe(1);

    expect(
      thresholdLiteral().test(declarations[0] ?? ""),
      `the declaration does not carry the literal ${LOW_STOCK_THRESHOLD} that ` +
        "the module actually exports — the constant and its value have drifted",
    ).toBe(true);
  });

  it("never appears as a bare literal at a use site in the queries module", () => {
    const code = readStripped(QUERIES_FILE) ?? "";
    const literal = thresholdLiteral();

    const offenders = code
      .split("\n")
      .map((line, index) => ({ line, number: index + 1 }))
      // A `const NAME = <n>` line is a DECLARATION, not a use site. This
      // module already owns an unrelated constant that happens to hold the
      // same value (`RECENT_ORDERS_TAKE`), and flagging it would be a false
      // positive. What must never appear is the number at a USE site — an
      // inline `lte: 5` in the query or a `5` interpolated into copy — which
      // is exactly what this filter leaves exposed.
      .filter(
        ({ line }) =>
          literal.test(line) && !CONSTANT_DECLARATION.test(line),
      )
      .map(({ line, number }) => `${QUERIES_FILE}:${number}: ${line.trim()}`);

    expect(
      offenders,
      "R-5 violation — the low-stock threshold is written out as a literal " +
        "instead of read from LOW_STOCK_THRESHOLD.\n" +
        "  The tile copy interpolates the constant, so a second copy of the " +
        "number lets the query and the sentence printed under it disagree " +
        "without anything failing. Reference LOW_STOCK_THRESHOLD instead.",
    ).toEqual([]);
  });

  it("never appears as a bare literal beside `stock` anywhere in the queries module", () => {
    const code = readStripped(QUERIES_FILE) ?? "";
    // Tighter than the use-site rule above and aimed at the one place a
    // hardcoded threshold would actually do damage: the stock comparison. No
    // line that mentions stock may carry a standalone integer at all.
    const offenders = code
      .split("\n")
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(
        ({ line }) =>
          /\bstock\b/i.test(line) &&
          /(?<![\w.$-])\d+(?![\w.])/.test(line) &&
          !CONSTANT_DECLARATION.test(line),
      )
      .map(({ line, number }) => `${QUERIES_FILE}:${number}: ${line.trim()}`);

    expect(
      offenders,
      "A stock comparison carries a numeric literal. The threshold is " +
        "LOW_STOCK_THRESHOLD and nothing else.",
    ).toEqual([]);
  });

  it("never appears at all in the attention band component", () => {
    const code = readStripped(BAND_FILE);
    expect(
      code,
      `${BAND_FILE} does not exist, so this scan would pass with zero coverage`,
    ).not.toBeNull();

    const literal = thresholdLiteral();
    const offenders = (code ?? "")
      .split("\n")
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => literal.test(line))
      .map(({ line, number }) => `${BAND_FILE}:${number}: ${line.trim()}`);

    expect(
      offenders,
      "R-5 violation — the band writes the threshold out instead of " +
        "interpolating LOW_STOCK_THRESHOLD into " +
        "strings.dashboard.attention.lowStock. The merchant reads that " +
        "sentence and then counts the rows; the two must come from one number.",
    ).toEqual([]);

    expect(
      (code ?? "").includes("LOW_STOCK_THRESHOLD"),
      "the band never references LOW_STOCK_THRESHOLD, so the {threshold} " +
        "placeholder in its copy is either unfilled or filled from somewhere " +
        "else",
    ).toBe(true);
  });
});
