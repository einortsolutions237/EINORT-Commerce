import { applySetCookies } from "better-auth/cookies";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { strings } from "@/lib/strings";

import { seedTwoTenants, TENANT_B } from "../setup/seed-two-tenants";

/**
 * 05-21 Task 2 — D-07, TMPL-04's onboarding half, proven end to end through
 * `saveBranding`.
 *
 * These are `isolation` (not `unit`) tests for the same reason
 * `branding.test.ts`'s own header names: "the seeded document came from the
 * picked template, not the flagship" is a claim about what actually landed
 * in Postgres. Against a stubbed database it is whatever the stub was
 * written to return, which is exactly the failure mode a regression test for
 * Pitfall 6 (05-RESEARCH.md — a picker that filters correctly so manual
 * testing passes, while a direct POST with an out-of-tier key succeeds)
 * must not have.
 *
 * ---------------------------------------------------------------------------
 * HOW TO READ A FAILURE HERE.
 * ---------------------------------------------------------------------------
 * `tenant-isolation.test.ts` states the rule this file reproduces, adapted:
 * `expected tenant-b-fixed-id, received tenant-a-fixed-id` means one
 * tenant's data reached another tenant's caller. THAT IS A
 * PRODUCTION-SEVERITY FINDING, NOT A FLAKY TEST.
 *
 * A failure on "the seeded document is not the flagship's" does not mean the
 * assertion is too strict — it means `saveBranding` seeded a fashion
 * storefront (or any wrong template) for a merchant who picked something
 * else, which is a real merchant looking at the wrong store on the proudest
 * click of their onboarding.
 *
 * ---------------------------------------------------------------------------
 * HOW THE ACTION IS INVOKED: A REAL SESSION, NOT A MOCKED CONTEXT.
 * ---------------------------------------------------------------------------
 * `saveBranding` is deliberately NOT built with `merchantAction` — see that
 * function's own header in `src/server/theming/actions.ts`. It resolves
 * `auth.api.getSession()` itself and takes its tenant from
 * `session.session.activeOrganizationId`, so this file reuses the same
 * session-construction helper `branding.test.ts` and
 * `storefront-editor.test.ts` already established
 * (`tests/isolation/plan-selection.test.ts`) rather than mocking anything
 * that resolves identity.
 *
 * Only `next/headers`, the rate limiters and `next/cache` are substituted.
 * BETTER AUTH AND PRISMA STAY THE REAL THING, AND NOTHING STUBS `scopedDb` OR
 * `platformDb`.
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

/**
 * `@/server/theming/actions` imports `revalidatePath` at module scope for the
 * editor actions that live alongside `saveBranding`. Outside a Next request
 * scope the real module throws. Same idiom as `branding.test.ts`.
 */
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));

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
const { saveBranding } = await import("@/server/theming/actions");
const { flagshipDefaultDocument, templateDefaultDocument, templateDefaultTokens } =
  await import("@/server/theming/defaults");
const { platformDb } = await import("@/server/db/platform");
const { scopedDb } = await import("@/server/db/tenant-scoped");
const { auth } = await import("@/server/auth/auth");

// ---------------------------------------------------------------------------
// Session harness — plan-selection.test.ts's, reused rather than re-invented
// ---------------------------------------------------------------------------

const PASSWORD = "correct-horse-battery";

function resetRequestContext(): void {
  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.31" });
  requestContext.cookies.clear();
}

async function authenticateAs(email: string): Promise<void> {
  const signIn = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    headers: requestContext.headers,
    returnHeaders: true,
  });

  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.31" });
  const setCookie = signIn.headers.get("set-cookie");
  if (!setCookie) throw new Error("fixture sign-in issued no session cookie");
  applySetCookies(requestContext.headers, [setCookie]);
}

/**
 * A merchant mid-onboarding: a store, a live session, and NO theme or page
 * row and NO `planTier` — `signUpMerchant` seeds no storefront and this
 * fixture deliberately never calls `selectPlan`, so `saveBranding`'s own
 * tier-gate fallback ("a `null` or unrecognised `planTier` fails CLOSED to
 * `starter`") is what determines the acting tenant's accessible set, exactly
 * as it would for a merchant who reached branding before choosing a plan.
 */
async function signUpAndCarrySession(
  email: string,
  slug: string,
): Promise<string> {
  const result = await signUpMerchant({
    email,
    password: PASSWORD,
    storeName: "Onboarding Template Store",
    slug,
  });
  if (!result.ok) {
    throw new Error(`fixture signup failed: ${JSON.stringify(result.error)}`);
  }
  await authenticateAs(email);

  const organization = await platformDb.organization.findUnique({
    where: { slug: result.slug },
    select: { id: true },
  });
  if (!organization) throw new Error("fixture signup produced no organization");
  return organization.id;
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

const FIRST_PRIMARY = "#123456";
const FIRST_SECONDARY = "#654321";
const SECOND_PRIMARY = "#aa1122";
const SECOND_SECONDARY = "#22bb33";

type BrandingPayload = {
  businessName: string;
  industry: string;
  logoKey: string | null;
  primaryAccent: string;
  secondaryAccent: string;
  templateKey: string;
};

function payload(overrides: Partial<BrandingPayload> = {}): BrandingPayload {
  return {
    businessName: "Confirmed Business Name",
    industry: "fashion-apparel",
    logoKey: null,
    primaryAccent: FIRST_PRIMARY,
    secondaryAccent: FIRST_SECONDARY,
    templateKey: "flagship-fashion",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Row readers
// ---------------------------------------------------------------------------

function themeRow(tenantId: string) {
  return scopedDb(tenantId).storefrontTheme.findUnique({
    where: { tenantId },
    select: {
      id: true,
      draftTemplateKey: true,
      publishedTemplateKey: true,
      logoKey: true,
      draftTokens: true,
      publishedTokens: true,
      publishedAt: true,
    },
  });
}

function pageRow(tenantId: string) {
  return scopedDb(tenantId).storefrontPage.findUnique({
    where: { tenantId_pageType: { tenantId, pageType: "home" } },
    select: { id: true, draft: true, published: true, publishedAt: true },
  });
}

function organizationRow(tenantId: string) {
  return platformDb.organization.findUnique({
    where: { id: tenantId },
    select: { name: true, industry: true, logo: true },
  });
}

async function requireTheme(tenantId: string) {
  const row = await themeRow(tenantId);
  expect(row, `tenant ${tenantId} has no storefront theme row`).not.toBeNull();
  return row!;
}

async function requirePage(tenantId: string) {
  const row = await pageRow(tenantId);
  expect(row, `tenant ${tenantId} has no storefront page row`).not.toBeNull();
  return row!;
}

async function requireOrganization(tenantId: string) {
  const row = await organizationRow(tenantId);
  expect(row, `tenant ${tenantId} has no organization row`).not.toBeNull();
  return row!;
}

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

async function expectOk<T extends { ok: boolean }>(
  call: Promise<T>,
): Promise<T> {
  const result = await call;
  expect(
    result.ok,
    `saveBranding failed but this case needed it to succeed: ${JSON.stringify(result)}`,
  ).toBe(true);
  return result;
}

async function expectRefused<T extends { ok: boolean }>(
  call: Promise<T>,
): Promise<T> {
  const result = await call;
  expect(
    result.ok,
    "saveBranding SUCCEEDED where the tier gate or the schema had to refuse " +
      "it — a validator that lets the payload through is not a trust boundary",
  ).toBe(false);
  return result;
}

/** Nothing landed: no theme row, no page row, and the tenant row untouched. */
async function expectNothingWritten(
  tenantId: string,
  before: { name: string; industry: string | null; logo: string | null },
): Promise<void> {
  const db = scopedDb(tenantId);
  expect(
    await db.storefrontTheme.count(),
    "a refused submission created a storefront theme anyway — the gate must " +
      "return before any write, or a rejected payload still costs a row",
  ).toBe(0);
  expect(await db.storefrontPage.count()).toBe(0);

  const organization = await requireOrganization(tenantId);
  expect(organization.name).toBe(before.name);
  expect(organization.industry).toBe(before.industry);
  expect(organization.logo).toBe(before.logo);
}

// ---------------------------------------------------------------------------
// Fixture lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await seedTwoTenants();
});

beforeEach(() => {
  resetRequestContext();
  limitVerdict.slugCheck = true;
  limitVerdict.signup = true;
});

// ---------------------------------------------------------------------------

describe("seeds from the picked template, not the flagship (D-07)", () => {
  it("seeds draftTemplateKey/publishedTemplateKey and both documents from the picked template", async () => {
    const tenantId = await signUpAndCarrySession(
      "picked-template@example.test",
      "picked-template-store",
    );

    // "fashion-edit" is starter-tier and NOT the flagship — reachable by
    // this fixture's fallback tier (null planTier -> starter) and
    // distinguishable from `flagship-fashion` by construction.
    await expectOk(saveBranding(payload({ templateKey: "fashion-edit" })));

    const theme = await requireTheme(tenantId);
    const page = await requirePage(tenantId);

    expect(theme.draftTemplateKey).toBe("fashion-edit");
    expect(theme.publishedTemplateKey).toBe("fashion-edit");

    const expectedDocument = templateDefaultDocument("fashion-edit");
    expect(page.draft).toEqual(expectedDocument);
    expect(page.published).toEqual(expectedDocument);

    /*
     * A test that only checked the column would pass even if the document
     * came from the flagship — this is the assertion that actually proves
     * D-07, and it is deliberately a document-shape inequality, not a
     * templateKey-string check repeated a second time.
     */
    const flagshipDocument = flagshipDefaultDocument();
    expect(
      page.draft,
      "the seeded draft document equals the FLAGSHIP's default document, " +
        "not the picked template's — a merchant who picked \"fashion-edit\" " +
        "would see a fashion-apparel storefront regardless of what they chose",
    ).not.toEqual(flagshipDocument);
    expect(page.published).not.toEqual(flagshipDocument);
  });
});

describe("brand colours survive the seed", () => {
  it("carries the submitted accents and takes announcement/footer from the picked template's defaults", async () => {
    const tenantId = await signUpAndCarrySession(
      "brand-colours@example.test",
      "brand-colours-store",
    );

    await expectOk(
      saveBranding(
        payload({
          templateKey: "fashion-edit",
          primaryAccent: FIRST_PRIMARY,
          secondaryAccent: FIRST_SECONDARY,
        }),
      ),
    );

    const theme = await requireTheme(tenantId);
    const pickedDefaults = templateDefaultTokens("fashion-edit");

    expect(theme.publishedTokens).toEqual({
      ...pickedDefaults,
      primaryAccent: FIRST_PRIMARY,
      secondaryAccent: FIRST_SECONDARY,
    });
    expect(theme.draftTokens).toEqual(theme.publishedTokens);
  });
});

describe("forged template key refusal", () => {
  it("returns a field error on templateKey and writes nothing", async () => {
    const tenantId = await signUpAndCarrySession(
      "forged-onb-template@example.test",
      "forged-onb-template-store",
    );
    const before = await requireOrganization(tenantId);

    const refused = await expectRefused(
      saveBranding(payload({ templateKey: "not-a-real-template" })),
    );
    const error = (refused as { ok: false; error: Record<string, string[]> })
      .error;
    expect(Object.keys(error)).toContain("templateKey");

    await expectNothingWritten(tenantId, before);
  });
});

describe("out-of-tier refusal", () => {
  it("refuses a Professional key from a Starter-tier organization and writes nothing", async () => {
    const tenantId = await signUpAndCarrySession(
      "out-of-tier@example.test",
      "out-of-tier-store",
    );
    const before = await requireOrganization(tenantId);

    /*
     * This fixture never calls `selectPlan`, so the organization's
     * `planTier` is null and `saveBranding`'s own gate falls back to
     * `starter` — the SAME closed posture a merchant who reaches branding
     * before picking a plan would hit in production. "fashion-classic" is
     * professional-tier (registry.ts).
     *
     * This is the `saveBranding` half of Pitfall 6: the picker dimming a
     * card is a courtesy on a surface that runs outside the DAL entirely,
     * so this action's own check is the only real control.
     */
    const refused = await expectRefused(
      saveBranding(payload({ templateKey: "fashion-classic" })),
    );
    const error = (refused as { ok: false; error: Record<string, string[]> })
      .error;
    expect(error.templateKey).toEqual([strings.editor.templateTierLocked]);

    await expectNothingWritten(tenantId, before);
  });
});

describe("idempotency preserved", () => {
  it("re-applies the template columns on a second submission without clobbering an edited draft", async () => {
    const tenantId = await signUpAndCarrySession(
      "onb-idempotent@example.test",
      "onb-idempotent-store",
    );

    await expectOk(saveBranding(payload({ templateKey: "fashion-edit" })));

    const db = scopedDb(tenantId);
    expect(
      await db.storefrontTheme.count(),
      "a second submission created a second theme row; the upsert is no " +
        "longer idempotent",
    ).toBe(1);
    expect(await db.storefrontPage.count()).toBe(1);

    /*
     * The merchant then customises their storefront, exactly the same
     * "what is under test is the SHAPE OF THE UPSERT" construction
     * `branding.test.ts`'s own idempotency case uses.
     */
    const CUSTOMISED = {
      version: 1,
      sections: [
        {
          id: "hero",
          type: "hero",
          settings: {
            heading: "MERCHANT CUSTOMISATION",
            subheading: "",
            ctaLabel: "",
            ctaHref: "",
            backgroundImageKey: null,
          },
        },
      ],
    };
    const editedPage = await requirePage(tenantId);
    await scopedDb(tenantId).storefrontPage.update({
      where: { id: editedPage.id },
      data: { draft: CUSTOMISED },
    });

    // Back to onboarding, a different template and different colours.
    await expectOk(
      saveBranding(
        payload({
          templateKey: "electronics-circuit",
          primaryAccent: SECOND_PRIMARY,
          secondaryAccent: SECOND_SECONDARY,
        }),
      ),
    );

    expect(await db.storefrontTheme.count()).toBe(1);
    expect(await db.storefrontPage.count()).toBe(1);

    const theme = await requireTheme(tenantId);
    const page = await requirePage(tenantId);

    /*
     * THE THEME'S `update` RE-APPLIES THE MERCHANT'S ANSWERS, INCLUDING THE
     * TEMPLATE KEY — extending `branding.test.ts`'s existing colour
     * assertion to the template columns rather than writing a parallel
     * test, per the plan's own instruction for this case.
     */
    expect(theme.draftTemplateKey).toBe("electronics-circuit");
    expect(theme.publishedTemplateKey).toBe("electronics-circuit");
    expect(
      (theme.publishedTokens as { primaryAccent: string }).primaryAccent,
    ).toBe(SECOND_PRIMARY);
    expect(
      (theme.publishedTokens as { secondaryAccent: string }).secondaryAccent,
    ).toBe(SECOND_SECONDARY);

    /*
     * THE PAGE'S `update` IS EMPTY, because the page document belongs to
     * the editor once it exists — redoing branding must never cost a
     * merchant the storefront they customised, even when they also pick a
     * different template the second time.
     */
    expect(
      page.draft,
      "the second submission overwrote the merchant's edited page document " +
        "with registry defaults — redoing branding must never cost a " +
        "merchant their customisation",
    ).toEqual(CUSTOMISED);
  });
});

describe("cross-tenant write during onboarding", () => {
  it("never writes to another organization even when the payload names it", async () => {
    const tenantId = await signUpAndCarrySession(
      "onb-cross@example.test",
      "onb-cross-store",
    );

    const victimThemeBefore = await requireTheme(TENANT_B.id);
    const victimOrgBefore = await requireOrganization(TENANT_B.id);

    const forged = {
      ...payload({ templateKey: "fashion-edit" }),
      tenantId: TENANT_B.id,
      organizationId: TENANT_B.id,
    } as unknown;

    await expectOk(saveBranding(forged));

    const actingTheme = await requireTheme(tenantId);
    expect(actingTheme.draftTemplateKey).toBe("fashion-edit");

    const victimThemeAfter = await requireTheme(TENANT_B.id);
    const victimOrgAfter = await requireOrganization(TENANT_B.id);
    expect(victimThemeAfter.draftTemplateKey).toBe(
      victimThemeBefore.draftTemplateKey,
    );
    expect(victimThemeAfter.publishedTemplateKey).toBe(
      victimThemeBefore.publishedTemplateKey,
    );
    expect(victimOrgAfter.industry).toBe(victimOrgBefore.industry);
  });
});
