import { applySetCookies } from "better-auth/cookies";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * 04-13 Task 2 — ONB-02 and ONB-04 against a real database.
 *
 * These are `isolation` (not `unit`) tests for the reason the seed fixture's own
 * header names: `scopedDb`'s tenant guarantee is a DATABASE property, not a stub
 * property. So is idempotency. "Two submissions leave exactly one theme row" is
 * a claim about a Postgres upsert against a real unique index, and against a
 * stubbed client it is whatever the stub was written to say. A stub cannot fail
 * the way the thing being guarded against fails, so a stubbed version of this
 * file would stay green while the guarantee it claims to prove had been deleted.
 *
 * ---------------------------------------------------------------------------
 * HOW TO READ A FAILURE HERE.
 * ---------------------------------------------------------------------------
 * `tenant-isolation.test.ts` states the rule this file reproduces, adapted:
 * `expected tenant-b-fixed-id, received tenant-a-fixed-id` means one tenant's
 * data reached another tenant's caller. THAT IS A PRODUCTION-SEVERITY FINDING,
 * NOT A FLAKY TEST. Do not re-run it until it passes; do not "stabilise" it.
 * The fixture ids are FIXED (`tenant-a-fixed-id`, `tenant-b-fixed-id`) rather
 * than randomised precisely so a failing assertion names the leak instead of
 * printing two opaque identifiers that have to be traced back to a tenant first.
 *
 * The forged-payload case below reads the same way. A failure there does not
 * mean the schema drifted — it means a field in a request body chose which
 * tenant a write landed on, which is the entire class of bug `scopedDb` and the
 * parameter-less merchant DAL exist to make unrepresentable (T-04-04).
 *
 * ---------------------------------------------------------------------------
 * HOW THE ACTION IS INVOKED: A REAL SESSION, NOT A MOCKED CONTEXT.
 * ---------------------------------------------------------------------------
 * `saveBranding` is deliberately NOT built with `merchantAction` — the merchant
 * DAL redirects a `industry === null` merchant to `/onboarding/branding`, and a
 * merchant submitting this form has `industry === null` by definition, so the
 * wrapper would loop the submission back to the screen it came from. The action
 * therefore resolves `auth.api.getSession()` itself and takes its tenant from
 * `session.session.activeOrganizationId`.
 *
 * That makes the session the ONLY channel by which this file can name an acting
 * tenant, so it takes the same option `storefront-editor.test.ts` took: reuse
 * the session-construction helper this repository already established
 * (`tests/isolation/plan-selection.test.ts`, inherited by `read-only.test.ts`
 * and `merchant-context.test.ts`) rather than mocking anything that resolves
 * identity. The difference matters for what the file proves: with the real
 * session in the loop, the tenant a write lands on is one Better Auth actually
 * derived from a signed cookie — which is the only way the forged-`tenantId`
 * case means anything. Against a mocked context, "the extra field was ignored"
 * would be a statement about the mock.
 *
 * Only `next/headers`, the rate limiters and `next/cache` are substituted.
 * BETTER AUTH AND PRISMA STAY THE REAL THING, AND NOTHING STUBS `scopedDb` OR
 * `platformDb` — that is the point of this file.
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
 * scope the real module throws, which would fail this file during import for a
 * reason that has nothing to do with the database. Same idiom as
 * `tests/isolation/checkout-paths.test.ts`.
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
const { flagshipDefaultTokens } = await import("@/server/theming/defaults");
const { platformDb } = await import("@/server/db/platform");
const { scopedDb } = await import("@/server/db/tenant-scoped");
const { auth } = await import("@/server/auth/auth");

// ---------------------------------------------------------------------------
// Session harness — plan-selection.test.ts's, reused rather than re-invented
// ---------------------------------------------------------------------------

const PASSWORD = "correct-horse-battery";

function resetRequestContext(): void {
  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.9" });
  requestContext.cookies.clear();
}

/**
 * Put a real, signed session cookie on the NEXT request.
 *
 * See `plan-selection.test.ts` for the full reasoning: the `nextCookies()` jar
 * is always empty under Vitest because that plugin reaches its store through a
 * dynamic `import("next/headers.js")` the `vi.mock` above does not intercept,
 * so a jar-based helper would silently authenticate nothing.
 */
async function authenticateAs(email: string): Promise<void> {
  const signIn = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    headers: requestContext.headers,
    returnHeaders: true,
  });

  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.9" });
  const setCookie = signIn.headers.get("set-cookie");
  if (!setCookie) throw new Error("fixture sign-in issued no session cookie");
  applySetCookies(requestContext.headers, [setCookie]);
}

/**
 * A merchant mid-onboarding: a store, a live session, and NO theme or page row.
 *
 * `signUpMerchant` deliberately seeds no storefront — that is `saveBranding`'s
 * job (ONB-04), and it is why the first assertion below can be "both published
 * halves went from not existing to non-null in one submission" rather than
 * "some column changed".
 */
async function signUpAndCarrySession(
  email: string,
  slug: string,
): Promise<string> {
  const result = await signUpMerchant({
    email,
    password: PASSWORD,
    storeName: "Signup Name",
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

/**
 * A storage KEY, never a URL — `storageKeySchema`'s shape, with the `logos/`
 * segment ONB-03 writes.
 */
const LOGO_KEY = "tenants/some-tenant/logos/brand-logo-01";

/** Fixed and legible, so a failing diff names the accent rather than a hash. */
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
};

function payload(overrides: Partial<BrandingPayload> = {}): BrandingPayload {
  return {
    businessName: "Confirmed Business Name",
    industry: "fashion-apparel",
    logoKey: null,
    primaryAccent: FIRST_PRIMARY,
    secondaryAccent: FIRST_SECONDARY,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Row readers — scoped data through `scopedDb`, the tenant row through platformDb
// ---------------------------------------------------------------------------

function themeRow(tenantId: string) {
  return scopedDb(tenantId).storefrontTheme.findUnique({
    where: { tenantId },
    select: {
      id: true,
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

/** The tenant row itself. `Organization` has no `tenantId`; `scopedDb` would throw. */
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
): Promise<void> {
  const result = await call;
  expect(
    result.ok,
    "saveBranding SUCCEEDED where the schema had to refuse it — a validator " +
      "that lets the payload through is not a trust boundary",
  ).toBe(false);
}

/** Nothing landed: no theme row, no page row, and the tenant row untouched. */
async function expectNothingWritten(
  tenantId: string,
  before: { name: string; industry: string | null; logo: string | null },
): Promise<void> {
  const db = scopedDb(tenantId);
  expect(
    await db.storefrontTheme.count(),
    "a refused submission created a storefront theme anyway — the parse must " +
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

/** Mirrors the `StorefrontTheme` builder in `tests/setup/seed-two-tenants.ts`. */
const FIXTURE_TOKENS = {
  primaryAccent: "#18181B",
  secondaryAccent: "#71717A",
};

/**
 * The industry tenant B is parked on, so "unchanged" is a real value.
 *
 * The seed leaves `industry` NULL. Asserting that a forged write left NULL as
 * NULL would pass just as well if the column had been dropped, so the victim is
 * given a distinguishable segment first and the forged submission below names a
 * DIFFERENT one. The assertion then reads as "tenant B still says electronics",
 * which fails loudly if the write crossed.
 */
const VICTIM_INDUSTRY = "electronics";

/**
 * Put the two SEEDED tenants back to their fixture values.
 *
 * WHY THIS EXISTS INSTEAD OF A PER-TEST `seedTwoTenants()`. Every test below
 * signs up its own merchant under its own email and slug and mutates only that
 * merchant's rows, so per-test isolation of the ACTING tenant is a property of
 * the fixtures rather than of a truncate. What the tests share is tenant B,
 * which the forged-payload case reads as the untouched victim — and its few
 * columns are restored here instead of by re-truncating seventeen tables.
 *
 * The cost of the alternative is documented in this suite already:
 * `merchant-context.test.ts`'s header records that repeated `seedTwoTenants()`
 * calls in one session-bearing file intermittently failed with "Unable to start
 * a transaction in the given time", because the `TRUNCATE … CASCADE` runs in a
 * transaction while a second pool is already live for `prismaBase`. This file is
 * session-bearing for the same reason that one is, so it inherits the same
 * `beforeAll` posture.
 *
 * Every assertion about "did not change" still reads the row BEFORE the action
 * and compares against what it actually read, never against these constants.
 * The constants are a starting line, not an oracle.
 */
async function restoreSeededTenants(): Promise<void> {
  for (const tenant of [TENANT_A, TENANT_B]) {
    await platformDb.organization.update({
      where: { id: tenant.id },
      data: { name: tenant.name, industry: VICTIM_INDUSTRY, logo: null },
    });
    const db = scopedDb(tenant.id);
    await db.storefrontTheme.update({
      where: { tenantId: tenant.id },
      data: {
        logoKey: null,
        draftTokens: FIXTURE_TOKENS,
        publishedTokens: FIXTURE_TOKENS,
      },
    });
  }
}

beforeAll(async () => {
  await seedTwoTenants();
});

beforeEach(async () => {
  // Without this the previous test's session cookie would authenticate the next
  // one, and "the acting tenant" would silently stop being this test's.
  resetRequestContext();
  limitVerdict.slugCheck = true;
  limitVerdict.signup = true;
  await restoreSeededTenants();
});

// ---------------------------------------------------------------------------

describe("ONB-04 — the store is live the instant the action returns", () => {
  it("publishes both the theme tokens and the page document on the first submission", async () => {
    const tenantId = await signUpAndCarrySession(
      "live@example.test",
      "live-store",
    );

    // The precondition that makes this test mean something: nothing exists yet.
    const db = scopedDb(tenantId);
    expect(await db.storefrontTheme.count()).toBe(0);
    expect(await db.storefrontPage.count()).toBe(0);

    await expectOk(saveBranding(payload()));

    const theme = await requireTheme(tenantId);
    const page = await requirePage(tenantId);

    /*
     * THERE IS NO SECOND PUBLISH STEP, AND THAT IS THE REQUIREMENT.
     *
     * A merchant who finishes onboarding and then visits their own domain must
     * see a storefront, not an empty shell waiting for them to discover an
     * editor they have not been shown yet. `saveBranding` writes `published`
     * and `publishedTokens` at seed time for exactly that reason — if these
     * assertions start failing because the write moved to `draft` only, the
     * regression is a merchant looking at nothing on the proudest click of
     * their onboarding.
     */
    expect(theme.publishedTokens).not.toBeNull();
    expect(theme.publishedAt).not.toBeNull();
    expect(page.published).not.toBeNull();
    expect(page.publishedAt).not.toBeNull();

    // And what was published is the merchant's own answers, not the defaults.
    expect(theme.publishedTokens).toEqual({
      ...flagshipDefaultTokens(),
      primaryAccent: FIRST_PRIMARY,
      secondaryAccent: FIRST_SECONDARY,
    });
  });
});

describe("idempotency", () => {
  it("leaves exactly one theme row and one page row after two submissions", async () => {
    const tenantId = await signUpAndCarrySession(
      "twice@example.test",
      "twice-store",
    );

    await expectOk(saveBranding(payload()));
    await expectOk(saveBranding(payload()));

    const db = scopedDb(tenantId);
    expect(
      await db.storefrontTheme.count(),
      "a second submission created a second theme row; the upsert is no longer " +
        "idempotent and this tenant now has two sources of truth for its colours",
    ).toBe(1);
    expect(
      await db.storefrontPage.count(),
      "a second submission created a second home page row; the " +
        "`@@unique([tenantId, pageType])` upsert has stopped matching",
    ).toBe(1);
  });

  it("updates the colours on the second submission without clobbering an edited page", async () => {
    const tenantId = await signUpAndCarrySession(
      "redo@example.test",
      "redo-store",
    );

    await expectOk(saveBranding(payload()));

    /*
     * The merchant then customises their storefront. Written straight through
     * `scopedDb` because what is under test is the SHAPE OF THE UPSERT, not the
     * editor — this file must keep failing for the right reason even if
     * `saveDraft`'s signature changes.
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

    // Back to onboarding, different answers.
    await expectOk(
      saveBranding(
        payload({
          primaryAccent: SECOND_PRIMARY,
          secondaryAccent: SECOND_SECONDARY,
        }),
      ),
    );

    const theme = await requireTheme(tenantId);
    const page = await requirePage(tenantId);

    /*
     * THE TWO `update` HALVES ARE ASYMMETRIC ON PURPOSE, AND THIS IS THE TEST
     * THAT PINS IT.
     *
     * The theme's `update` re-applies the merchant's answers, so redoing
     * branding actually changes the colours rather than being silently ignored.
     * The page's `update` is EMPTY, because the page document belongs to the
     * editor — and a merchant who redoes their branding after customising their
     * storefront must keep the customisation. That is what D-08's no-hard-delete
     * posture means for this action: the difference between "redo your branding"
     * and "lose your customisation" is the `update: {}` half of the page upsert,
     * and filling it in with `create`'s data is the tempting, wrong "fix".
     */
    expect(
      (theme.publishedTokens as { primaryAccent: string }).primaryAccent,
      "the second submission's accents did not reach publishedTokens — a " +
        "merchant redoing their branding was told it saved and got their old " +
        "colours",
    ).toBe(SECOND_PRIMARY);
    expect(
      (theme.publishedTokens as { secondaryAccent: string }).secondaryAccent,
    ).toBe(SECOND_SECONDARY);

    expect(
      page.draft,
      "the second submission overwrote the merchant's edited page document " +
        "with registry defaults — redoing branding must never cost a merchant " +
        "the storefront they customised",
    ).toEqual(CUSTOMISED);
  });
});

describe("ONB-02 — the two answers land on the tenant row", () => {
  it("persists the industry segment and the confirmed business name", async () => {
    const tenantId = await signUpAndCarrySession(
      "industry@example.test",
      "industry-store",
    );

    await expectOk(saveBranding(payload({ industry: "grocery-food" })));

    /*
     * Read back through `platformDb`, the only door to `Organization` —
     * `scopedDb` throws for it, correctly, because the organization IS the
     * tenant and carries no `tenantId` column.
     *
     * `industry` is declared `input: false` in the Better Auth organization
     * config with no default, so no request to `/organization/update` can set
     * it and this server-side write is the only way the column is ever
     * populated (T-04-13). If this assertion starts failing, check whether the
     * `input: false` was relaxed before checking this action.
     */
    const organization = await requireOrganization(tenantId);
    expect(organization.industry).toBe("grocery-food");
    expect(organization.name).toBe("Confirmed Business Name");
  });

  it("refuses an industry outside the registry's closed set and writes nothing", async () => {
    const tenantId = await signUpAndCarrySession(
      "badindustry@example.test",
      "badindustry-store",
    );
    const before = await requireOrganization(tenantId);

    /*
     * `"fashion"` is the near miss, not a nonsense string: the real segment is
     * `"fashion-apparel"`, so a typo or a stale client is what this refuses.
     * The set lives in the registry (D-02) and the schema narrows through
     * `isIndustrySegment` rather than restating a `z.enum`, so the two cannot
     * drift — this test is what proves the narrowing is actually wired up.
     */
    await expectRefused(saveBranding(payload({ industry: "fashion" })));
    await expectNothingWritten(tenantId, before);
  });
});

describe("accents", () => {
  it("refuses a colour name and a shorthand hex, and writes nothing", async () => {
    const tenantId = await signUpAndCarrySession(
      "badhex@example.test",
      "badhex-store",
    );
    const before = await requireOrganization(tenantId);

    await expectRefused(saveBranding(payload({ primaryAccent: "red" })));
    await expectNothingWritten(tenantId, before);

    /*
     * `#FFF` is refused too, and deliberately so. `hexColorSchema` accepts
     * `#rrggbb` and nothing else — widening the pattern to allow shorthand buys
     * no capability (every shorthand has a six-digit spelling) and costs the
     * anchor's guarantee that a stored token is one fixed length.
     */
    await expectRefused(saveBranding(payload({ secondaryAccent: "#FFF" })));
    await expectNothingWritten(tenantId, before);
  });
});

describe("a forged tenantId in the payload is ignored, not honoured (T-04-04)", () => {
  it("writes to the acting tenant and leaves the named tenant untouched", async () => {
    const tenantId = await signUpAndCarrySession(
      "forged@example.test",
      "forged-store",
    );

    const victimBefore = await requireOrganization(TENANT_B.id);
    const victimThemeBefore = await requireTheme(TENANT_B.id);
    expect(victimBefore.industry).toBe(VICTIM_INDUSTRY);

    /*
     * The cast is how an extra property gets past TypeScript, and it is honest
     * about what is being simulated: `saveBranding` takes `unknown` because it
     * is reachable by a direct POST that never rendered the form, so the
     * compiler was never the boundary here — the schema is.
     */
    const forged = {
      ...payload({ industry: "furniture-home" }),
      tenantId: TENANT_B.id,
      organizationId: TENANT_B.id,
    } as unknown;

    /*
     * THE ASSERTION IS NOT THAT THE CALL FAILS. IT IS THAT THE EXTRA FIELD IS
     * IGNORED AND THE WRITE STILL LANDS ON THE ACTING TENANT.
     *
     * That distinction is the whole point of the schema being the trust
     * boundary. `saveBrandingSchema` declares no tenant field, so `safeParse`
     * strips it; identity comes from `session.session.activeOrganizationId`,
     * resolved after the parse and from a signed cookie; and `scopedDb` stamps
     * the tenant LAST into both halves of both upserts. There is no field a
     * direct POST could set to retarget any of this — which is why a rejection
     * here would be the WEAKER outcome. Rejecting unknown keys would mean the
     * defence depended on enumerating every name an attacker might try.
     */
    await expectOk(saveBranding(forged));

    // Non-vacuous: the acting tenant's own row DID move, so the untouched victim
    // below is the trust boundary doing work, not a write that no-oped.
    const actingAfter = await requireOrganization(tenantId);
    expect(actingAfter.industry).toBe("furniture-home");
    await requireTheme(tenantId);

    const victimAfter = await requireOrganization(TENANT_B.id);
    const victimThemeAfter = await requireTheme(TENANT_B.id);

    expect(
      victimAfter.industry,
      `tenant ${TENANT_B.id}'s industry was rewritten by a payload submitted ` +
        `while acting as ${tenantId}. That is a production-severity ` +
        "cross-tenant write, not a flaky test.",
    ).toBe(VICTIM_INDUSTRY);
    expect(victimAfter.name).toBe(victimBefore.name);
    expect(victimThemeAfter.publishedTokens).toEqual(
      victimThemeBefore.publishedTokens,
    );
    expect(victimThemeAfter.logoKey).toBe(victimThemeBefore.logoKey);

    // And no EXTRA rows were conjured for the victim either.
    const victimDb = scopedDb(TENANT_B.id);
    expect(await victimDb.storefrontTheme.count()).toBe(1);
    expect(await victimDb.storefrontPage.count()).toBe(1);
  });
});

describe("Organization.logo is never written (T-04-10, Pitfall 5)", () => {
  it("keeps the core column byte-identical while StorefrontTheme.logoKey holds the value", async () => {
    const tenantId = await signUpAndCarrySession(
      "logo@example.test",
      "logo-store",
    );

    /*
     * Park a distinguishable value on the column first. Asserting that NULL
     * stayed NULL would pass just as well if the column had been dropped, and
     * this test's whole job is to be an alarm.
     */
    const SENTINEL = "sentinel-logo-value-set-by-fixture";
    await platformDb.organization.update({
      where: { id: tenantId },
      data: { logo: SENTINEL },
    });
    const before = await requireOrganization(tenantId);
    expect(before.logo).toBe(SENTINEL);

    await expectOk(saveBranding(payload({ logoKey: LOGO_KEY })));

    const after = await requireOrganization(tenantId);
    const theme = await requireTheme(tenantId);

    /*
     * `Organization.logo` IS A BETTER AUTH CORE FIELD, WHICH IS WHY NOTHING IN
     * THIS PHASE WRITES IT.
     *
     * `input: false` protects `industry` and `planTier` because they are
     * `additionalFields`. It cannot protect `logo`:
     * `baseUpdateOrganizationSchema` declares it as a nullish string, so any
     * signed-in merchant could overwrite it by POSTing directly to
     * `/organization/update`. The merchant's logo key therefore lives on
     * `StorefrontTheme.logoKey`, behind `scopedDb`, where the write path is
     * server-controlled.
     *
     * If a future change writes `logo` "as well, for convenience", this
     * assertion is the alarm — and the convenience re-opens exactly the hole
     * the split closes.
     */
    expect(
      after.logo,
      "saveBranding wrote Organization.logo. That column is a Better Auth " +
        "CORE field that `input: false` cannot protect, so anything stored " +
        "there is merchant-writable through /organization/update. The logo " +
        "key belongs on StorefrontTheme.logoKey and nowhere else.",
    ).toBe(SENTINEL);

    expect(
      theme.logoKey,
      "the submitted logo key did not reach StorefrontTheme.logoKey, so " +
        "ONB-03's logo was accepted by the form and then dropped",
    ).toBe(LOGO_KEY);
  });
});
