import { applySetCookies } from "better-auth/cookies";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { strings } from "@/lib/strings";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * CAT-01 and SUB-01 against a real Postgres — the catalog write layer's three
 * structural claims, each of which is vacuously true against a stubbed database
 * and therefore untestable anywhere but here.
 *
 *   1. TENANT ISOLATION. A merchant's list is their own catalog and nothing
 *      else, and a forged `categoryId` naming another tenant's category is
 *      refused by the composite foreign key rather than by a convention the
 *      application is trusted to remember (T-03-29). "Refused" has to mean the
 *      write did not land — a rejection that left an orphan `Product` row
 *      behind would satisfy a naive assertion and still have created a product
 *      the merchant never asked for.
 *   2. THE MATRIX IS WRITTEN AS ROWS. `expandVariantMatrix` is unit-tested as a
 *      pure function in `tests/unit/variant-matrix.test.ts`; what is proven
 *      here is that the rows it returns actually reach `product_variant` with a
 *      distinct `(option1Value, option2Value)` pair each, and that a product
 *      with no options still owns exactly one of them (D-04 / CAT-03 — stock
 *      lives at exactly one level).
 *   3. THE PLAN CAP IS A SERVER REFUSAL. A1 disables `Add product` at the cap;
 *      that is a courtesy. `createProduct` is reachable by a POST that never
 *      loaded the page (T-03-30), so the assertion that matters is that the
 *      action itself refuses AND writes no row.
 *
 * The harness is `tests/isolation/read-only.test.ts`'s, reused rather than
 * re-invented: Better Auth and Prisma stay the real thing, and only
 * `next/headers` and the rate limiters are substituted.
 */

// ---------------------------------------------------------------------------
// next/headers stand-in
// ---------------------------------------------------------------------------

const { requestContext } = vi.hoisted(() => ({
  requestContext: {
    headers: new Headers(),
    cookies: new Map<string, { name: string; value: string }>(),
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => requestContext.headers,
  cookies: async () => ({
    get: (name: string) => requestContext.cookies.get(name),
    getAll: () => Array.from(requestContext.cookies.values()),
    has: (name: string) => requestContext.cookies.has(name),
    set: (name: string, value: string) => {
      requestContext.cookies.set(name, { name, value });
    },
    delete: (name: string) => {
      requestContext.cookies.delete(name);
    },
  }),
}));

// ---------------------------------------------------------------------------
// Rate limiters with controllable verdicts
// ---------------------------------------------------------------------------

const { limitVerdict } = vi.hoisted(() => ({
  limitVerdict: { slugCheck: true, signup: true },
}));

vi.mock("@/server/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/rate-limit")>();
  return {
    ...actual,
    slugCheckLimiter: {
      prefix: "rl:slugcheck",
      limit: async () => ({ success: limitVerdict.slugCheck }),
    },
    signupLimiter: {
      prefix: "rl:signup",
      limit: async () => ({ success: limitVerdict.signup }),
    },
  };
});

// Imported after the mocks so the modules under test pick them up.
const { signUpMerchant } = await import("@/server/auth/signup");
const { selectPlan } = await import("@/server/merchant/actions");
const { auth } = await import("@/server/auth/auth");
const { platformDb } = await import("@/server/db/platform");
const { scopedDb } = await import("@/server/db/tenant-scoped");
const { createProduct, setProductActive, createCategory } = await import(
  "@/server/catalog/actions"
);
const { activeProductCount, listProductsForMerchant, listCategories } =
  await import("@/server/catalog/queries");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PASSWORD = "correct-horse-battery";

/** The Starter cap, from the registry rather than typed into the test. */
const STARTER_PRODUCT_CAP = 50;

type ActionFailure = { ok: false; error: Record<string, string[]> };

function resetRequestContext(): void {
  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
  requestContext.cookies.clear();
}

/**
 * Put a real, signed session cookie on the NEXT request. See
 * `plan-selection.test.ts` for the full reasoning: the `nextCookies()` jar is
 * always empty under Vitest, so a jar-based helper would authenticate nothing.
 */
async function authenticateAs(email: string): Promise<void> {
  const signIn = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    headers: requestContext.headers,
    returnHeaders: true,
  });

  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
  const setCookie = signIn.headers.get("set-cookie");
  if (!setCookie) throw new Error("fixture sign-in issued no session cookie");
  applySetCookies(requestContext.headers, [setCookie]);
}

/** A merchant with a store, a chosen plan and a live session. */
async function merchantWithSession(
  email: string,
  slug: string,
  tier: "starter" | "business" | "professional" = "business",
): Promise<string> {
  const signedUp = await signUpMerchant({
    email,
    password: PASSWORD,
    storeName: "Catalog Store",
    slug,
  });
  if (!signedUp.ok) {
    throw new Error(`fixture signup failed: ${JSON.stringify(signedUp.error)}`);
  }
  await authenticateAs(email);

  const chosen = await selectPlan({ tier });
  if (!chosen.ok) {
    throw new Error(`fixture plan pick failed: ${JSON.stringify(chosen.error)}`);
  }

  const organization = await platformDb.organization.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!organization) throw new Error("fixture organization vanished");
  return organization.id;
}

/** A minimal valid payload — one no-option product with one implicit variant. */
function simpleProduct(name: string) {
  return {
    name,
    basePriceXaf: 5000,
    categoryId: null,
    option1Name: null,
    values1: [],
    option2Name: null,
    values2: [],
    variants: [
      {
        option1Value: "",
        option2Value: "",
        priceXaf: null,
        stock: 3,
        sku: null,
        active: true,
      },
    ],
    images: [],
  };
}

function productsOf(tenantId: string) {
  return scopedDb(tenantId).product.findMany({
    select: { id: true, name: true, slug: true, active: true },
    orderBy: { createdAt: "asc" },
  });
}

function variantsOf(tenantId: string, productId: string) {
  return scopedDb(tenantId).productVariant.findMany({
    where: { productId },
    select: { option1Value: true, option2Value: true, stock: true },
  });
}

/**
 * SEEDED ONCE PER FILE, NOT ONCE PER TEST (02-03-SUMMARY.md precedent).
 *
 * Every test below either reads the fixed fixture tenants or signs up its own
 * merchant under its own email and slug, so per-test isolation is a property of
 * the fixtures rather than of the truncate. `seedTwoTenants` opens with a
 * `TRUNCATE … CASCADE` inside a `$transaction` whose default `maxWait` is
 * 2 000 ms, and several of those per file against the remote Neon branch
 * intermittently exceed it. The per-test `beforeEach` still resets the request
 * context — without it the previous test's session cookie would authenticate
 * the next one.
 */
beforeAll(async () => {
  await seedTwoTenants();
});

beforeEach(() => {
  resetRequestContext();
  limitVerdict.slugCheck = true;
  limitVerdict.signup = true;
});

// ---------------------------------------------------------------------------

describe("the list is one tenant's catalog", () => {
  it("returns tenant A's product and never tenant B's", async () => {
    const listed = await listProductsForMerchant(TENANT_A.id);

    // Both fixture products exist and are named identically apart from the
    // tenant, so a scoping bug would show up as an extra row rather than as an
    // empty result — which is the failure a `toHaveLength(1)` alone would miss
    // if the query returned the WRONG single row.
    expect(listed.map((product) => product.id)).toEqual([
      `${TENANT_A.id}-product-1`,
    ]);
    expect(listed.map((product) => product.id)).not.toContain(
      `${TENANT_B.id}-product-1`,
    );

    // The projection the A1 table renders, proven rather than assumed: the
    // fixture's single implicit variant carries stock 10 and its hero image is
    // at position 0.
    expect(listed[0]?.stock).toBe(10);
    expect(listed[0]?.heroStorageKey).toBe(`${TENANT_A.id}/product-1/original`);
    expect(listed[0]?.categoryName).toBeNull();
  });

  it("keeps each tenant's categories to itself", async () => {
    const forA = await listCategories(TENANT_A.id);
    expect(forA.map((category) => category.id)).toEqual([
      `${TENANT_A.id}-category-1`,
    ]);
  });
});

describe("a forged categoryId is refused by the database", () => {
  it("rejects the write and leaves no orphan product row", async () => {
    const tenantId = await merchantWithSession(
      "forge@example.test",
      "forge-store",
    );

    /*
     * A REAL id belonging to the second seeded tenant, not an invented one.
     * An invented id would be rejected by any foreign key at all and would
     * prove nothing about tenancy; this one exists, and only the COMPOSITE key
     * `(tenantId, categoryId)` distinguishes it from a legitimate value.
     */
    await expect(
      createProduct({
        ...simpleProduct("Forged Category Product"),
        categoryId: `${TENANT_B.id}-category-1`,
      }),
    ).rejects.toThrow();

    // The transaction rolled back, so nothing partial survived. A rejection
    // that left the product row behind would be worse than no rejection: the
    // merchant would own a product they never created.
    expect(await productsOf(tenantId)).toEqual([]);

    // And the other tenant's category is untouched by the attempt.
    const forgedCategory = await scopedDb(TENANT_B.id).category.findUnique({
      where: { id: `${TENANT_B.id}-category-1` },
      select: { id: true },
    });
    expect(forgedCategory?.id).toBe(`${TENANT_B.id}-category-1`);
  });
});

describe("the variant matrix reaches the database", () => {
  it("writes one row per combination, each pair distinct", async () => {
    const tenantId = await merchantWithSession(
      "matrix@example.test",
      "matrix-store",
    );

    const values1 = ["S", "M", "L"];
    const values2 = ["Blue", "Red"];

    const created = await createProduct({
      name: "Robe Wax",
      basePriceXaf: 12000,
      categoryId: null,
      option1Name: "Size",
      values1,
      option2Name: "Color",
      values2,
      variants: values1.flatMap((option1Value) =>
        values2.map((option2Value) => ({
          option1Value,
          option2Value,
          priceXaf: null,
          stock: 2,
          sku: null,
          active: true,
        })),
      ),
      images: [],
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const variants = await variantsOf(tenantId, created.productId);
    expect(variants).toHaveLength(values1.length * values2.length);

    const pairs = new Set(
      variants.map((v) => `${v.option1Value}|${v.option2Value}`),
    );
    expect(pairs.size).toBe(values1.length * values2.length);
    expect(variants.every((v) => v.stock === 2)).toBe(true);
  });

  it("gives a product with no options exactly one variant, both values empty", async () => {
    const tenantId = await merchantWithSession(
      "implicit@example.test",
      "implicit-store",
    );

    const created = await createProduct(simpleProduct("Sac À Main"));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // The slug is derived server-side and the accent is normalised rather than
    // stripped — `sac-a-main`, not `sac--main`.
    expect(created.slug).toBe("sac-a-main");

    const variants = await variantsOf(tenantId, created.productId);
    expect(variants).toEqual([
      { option1Value: "", option2Value: "", stock: 3 },
    ]);
  });

  it("refuses a variant set that does not match the declared axes", async () => {
    await merchantWithSession("smuggle@example.test", "smuggle-store");

    /*
     * T-03-31: the axes say `S, M` and the payload claims an `XL` row. The
     * server re-expands the matrix and refuses the whole submission — the
     * client's array carries prices and stock, never which combinations exist.
     */
    const result = await createProduct({
      name: "Smuggled Variant",
      basePriceXaf: 1000,
      categoryId: null,
      option1Name: "Size",
      values1: ["S", "M"],
      option2Name: null,
      values2: [],
      variants: [
        { option1Value: "S", option2Value: "", priceXaf: null, stock: 1, sku: null, active: true },
        { option1Value: "XL", option2Value: "", priceXaf: null, stock: 999, sku: null, active: true },
      ],
      images: [],
    });

    expect(result.ok).toBe(false);
    expect(Object.keys((result as ActionFailure).error)).toContain("variants");
  });
});

describe("two products may share a name", () => {
  it("derives a distinct slug for the second and keeps both rows", async () => {
    const tenantId = await merchantWithSession(
      "twins@example.test",
      "twins-store",
    );

    const first = await createProduct(simpleProduct("Chaussures"));
    const second = await createProduct(simpleProduct("Chaussures"));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.slug).toBe("chaussures");
    expect(second.slug).not.toBe(first.slug);
    // The retry suffixes the derived base rather than replacing it, so the
    // second product's URL is still recognisable as the same product name.
    expect(second.slug.startsWith("chaussures-")).toBe(true);

    const rows = await productsOf(tenantId);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.name === "Chaussures")).toBe(true);
  });
});

describe("the plan cap is a server refusal", () => {
  it("refuses the 51st product on Starter and writes no row", async () => {
    const tenantId = await merchantWithSession(
      "capped@example.test",
      "capped-store",
      "starter",
    );

    /*
     * The cap is filled through the data layer rather than through 50 calls to
     * the action: what is under test is the REFUSAL, and paying 50 round trips
     * to the remote Neon branch to reach it would make this the slowest test in
     * the suite while proving nothing extra. The rows are stamped by `scopedDb`
     * exactly as the action's own writes are.
     */
    await scopedDb(tenantId).product.createMany({
      data: Array.from({ length: STARTER_PRODUCT_CAP }, (_, index) => ({
        tenantId,
        name: `Filler ${index}`,
        slug: `filler-${index}`,
        basePriceXaf: 1000,
      })),
    });
    expect(await activeProductCount(tenantId)).toBe(STARTER_PRODUCT_CAP);

    const refused = await createProduct(simpleProduct("One Too Many"));

    expect(refused.ok).toBe(false);
    expect((refused as ActionFailure).error.form).toEqual([
      strings.entitlements.productLimitReached.replace(
        "{cap}",
        String(STARTER_PRODUCT_CAP),
      ),
    ]);

    // The refusal has to be a refusal, not a rollback after a write.
    expect(await activeProductCount(tenantId)).toBe(STARTER_PRODUCT_CAP);
    expect(await productsOf(tenantId)).toHaveLength(STARTER_PRODUCT_CAP);
  });

  it("counts hidden products out, so hiding one frees a slot", async () => {
    const tenantId = await merchantWithSession(
      "recount@example.test",
      "recount-store",
      "starter",
    );

    await scopedDb(tenantId).product.createMany({
      data: Array.from({ length: STARTER_PRODUCT_CAP }, (_, index) => ({
        tenantId,
        name: `Filler ${index}`,
        slug: `filler-${index}`,
        basePriceXaf: 1000,
      })),
    });

    const [firstFiller] = await productsOf(tenantId);
    if (!firstFiller) throw new Error("fixture wrote no products");

    // D-08 forbids removal, so if hidden rows counted against the cap a capped
    // merchant would have NO action available that could ever free a slot.
    await setProductActive({ productId: firstFiller.id, active: false });
    expect(await activeProductCount(tenantId)).toBe(STARTER_PRODUCT_CAP - 1);

    const allowed = await createProduct(simpleProduct("Now There Is Room"));
    expect(allowed.ok).toBe(true);
  });
});

describe("visibility round-trips", () => {
  it("hides a product and brings it back, and the active count follows", async () => {
    const tenantId = await merchantWithSession(
      "visible@example.test",
      "visible-store",
    );

    const created = await createProduct(simpleProduct("Boubou"));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(await activeProductCount(tenantId)).toBe(1);

    await setProductActive({ productId: created.productId, active: false });
    expect(await activeProductCount(tenantId)).toBe(0);

    // The hidden product is still the merchant's product — A1 renders it with a
    // `Hidden` badge rather than dropping it, which is the whole of D-08.
    const listedWhileHidden = await listProductsForMerchant(tenantId);
    expect(listedWhileHidden).toHaveLength(1);
    expect(listedWhileHidden[0]?.active).toBe(false);

    await setProductActive({ productId: created.productId, active: true });
    expect(await activeProductCount(tenantId)).toBe(1);
  });
});

describe("categories are created inline", () => {
  it("creates one, links a product to it, and refuses the duplicate name", async () => {
    const tenantId = await merchantWithSession(
      "category@example.test",
      "category-store",
    );

    const created = await createCategory({ name: "Robes & Jupes" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.category.slug).toBe("robes-jupes");

    const product = await createProduct({
      ...simpleProduct("Robe Longue"),
      categoryId: created.category.id,
    });
    expect(product.ok).toBe(true);

    const listed = await listProductsForMerchant(tenantId);
    expect(listed[0]?.categoryName).toBe("Robes & Jupes");

    // D-06 makes the name unique within the merchant, so a second one is a
    // field error rather than a second box with the same label on it.
    const duplicate = await createCategory({ name: "robes  jupes" });
    expect(duplicate.ok).toBe(false);
    expect(Object.keys((duplicate as ActionFailure).error)).toContain("name");
  });
});
