import { applySetCookies } from "better-auth/cookies";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { strings } from "@/lib/strings";
import type { PageDocument, ThemeTokens } from "@/server/theming/schema";

import { seedTwoTenants, TENANT_A, TENANT_B } from "../setup/seed-two-tenants";

/**
 * 04-13 Task 1 — EDIT-02 and EDIT-03 against a real database.
 *
 * These are `isolation` (not `unit`) tests for the reason the seed fixture's
 * own header names: `scopedDb`'s tenant guarantee is a DATABASE property, not a
 * stub property. Publish atomicity is the same kind of claim — "both rows moved
 * or neither" is a statement about a Postgres transaction, and against a stubbed
 * client it is vacuously true. A stub cannot fail the way the thing being
 * guarded against fails, so a stubbed version of this file would stay green
 * while the guarantee it claims to prove had been deleted.
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
 * printing two opaque identifiers that have to be traced back to a tenant
 * first.
 *
 * The same reading applies to the publish assertions. A failure on
 * "published is byte-identical after a refused publish" is not a slow clock —
 * it means a draft the current registry cannot parse reached the live
 * storefront, and every customer of that store is looking at the result.
 *
 * ---------------------------------------------------------------------------
 * HOW THE ACTIONS ARE INVOKED: A REAL SESSION, NOT A MOCKED CONTEXT.
 * ---------------------------------------------------------------------------
 * `saveDraft` / `publishStorefront` / `discardDraft` / `ensureStorefrontSeeded`
 * are built with `merchantAction`, which resolves the tenant through
 * `requireMerchantContext()` from a signed session cookie. An isolation test has
 * no request, so something has to stand in.
 *
 * This file takes the SECOND of the two options plan 04-13 offers — reuse the
 * session-construction helper this repository already established
 * (`tests/isolation/plan-selection.test.ts`, inherited by `read-only.test.ts`
 * and `merchant-context.test.ts`) — rather than mocking
 * `@/server/merchant/context`. The difference matters for what the file proves:
 * with the real DAL in the loop, the tenant under test is one Better Auth
 * actually derived from a signed cookie, and `canEditStorefront` is one
 * `resolveEntitlements` actually computed from a real organization row. A
 * mocked context would let this file assert that the gate refuses a
 * hand-written `canEditStorefront: false` — which proves the `if` statement
 * works, not that a post-trial Starter merchant is refused.
 *
 * So the tier-refusal case below builds the refusing state the way production
 * reaches it: a Starter plan, an expired trial, `subscriptionStatus: "active"`.
 * `resolveEntitlements` reads that as `subscribed ? plan.limits.storefrontEditor
 * : !expired` → `false`, while `canWrite` stays TRUE. That combination is the
 * whole point — the read-only gate passes and the EDITOR gate is what refuses,
 * so the test cannot pass for the wrong reason (D-13/D-15, T-04-05).
 *
 * Only `next/headers`, the rate limiters and `next/cache` are substituted.
 * BETTER AUTH AND PRISMA STAY THE REAL THING, AND NOTHING STUBS `scopedDb` —
 * that is the point of this file.
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
 * `publishStorefront` and `discardDraft` both call `revalidatePath` so the
 * publish bar's status line stops saying "unpublished changes" without a hard
 * reload. Outside a Next request scope that call throws, which would turn a
 * successful publish into a rejected promise and make every assertion below
 * fail for a reason that has nothing to do with the database. Same idiom as
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
const { selectPlan } = await import("@/server/merchant/actions");
const {
  saveDraft,
  publishStorefront,
  discardDraft,
  ensureStorefrontSeeded,
  saveBranding,
} = await import("@/server/theming/actions");
const { getEditorStorefront } = await import("@/server/theming/queries");
const { flagshipDefaultDocument, flagshipDefaultTokens } = await import(
  "@/server/theming/defaults"
);
const { platformDb } = await import("@/server/db/platform");
const { scopedDb } = await import("@/server/db/tenant-scoped");
const { auth } = await import("@/server/auth/auth");

// ---------------------------------------------------------------------------
// Session harness — plan-selection.test.ts's, reused rather than re-invented
// ---------------------------------------------------------------------------

const PASSWORD = "correct-horse-battery";
const DAY_MS = 86_400_000;

function resetRequestContext(): void {
  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
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

  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
  const setCookie = signIn.headers.get("set-cookie");
  if (!setCookie) throw new Error("fixture sign-in issued no session cookie");
  applySetCookies(requestContext.headers, [setCookie]);
}

/** A merchant with a store, a chosen plan and a live session. Returns its id. */
async function signUpChooseAndCarrySession(
  email: string,
  slug: string,
  tier: "starter" | "business" | "professional" = "business",
): Promise<string> {
  const result = await signUpMerchant({
    email,
    password: PASSWORD,
    storeName: "Editor Store",
    slug,
  });
  if (!result.ok) {
    throw new Error(`fixture signup failed: ${JSON.stringify(result.error)}`);
  }
  await authenticateAs(email);

  const chosen = await selectPlan({ tier });
  if (!chosen.ok) {
    throw new Error(`fixture plan pick failed: ${JSON.stringify(chosen.error)}`);
  }

  /*
   * ONB-02's mandatory branding step. `requireMerchantContext()` — which every
   * editor action built with `merchantAction()` reaches — redirects a merchant
   * whose `industry` is still null to `/onboarding/branding` (plan 04-11).
   * This fixture predates that gate; without this call every editor action
   * below (including through `seededMerchant`, which calls through here)
   * would throw an uncaught `NEXT_REDIRECT` instead of exercising the
   * behaviour under test.
   */
  const branded = await saveBranding({
    businessName: "Editor Store",
    industry: "general-retail",
    logoKey: null,
    primaryAccent: "#18181B",
    secondaryAccent: "#71717A",
  });
  if (!branded.ok) {
    throw new Error(`fixture branding failed: ${JSON.stringify(branded.error)}`);
  }

  const organization = await platformDb.organization.findUnique({
    where: { slug: result.slug },
    select: { id: true },
  });
  if (!organization) throw new Error("fixture signup produced no organization");
  return organization.id;
}

/** The same merchant, with the theme and page rows `ensureStorefrontSeeded` creates. */
async function seededMerchant(
  email: string,
  slug: string,
  tier: "starter" | "business" | "professional" = "business",
): Promise<string> {
  const tenantId = await signUpChooseAndCarrySession(email, slug, tier);
  await expectOk(ensureStorefrontSeeded({}));
  return tenantId;
}

/**
 * The post-trial, subscribed state a Starter merchant reaches (D-13/D-15).
 *
 * `subscriptionStatus: "active"` is deliberate and load-bearing: it makes
 * `canWrite` TRUE, so `merchantAction`'s read-only gate lets the call through
 * and `assertCanEditStorefront` is unambiguously the thing that refuses. An
 * expired-and-unsubscribed merchant would be refused by the read-only gate
 * first, and the test would pass without EDIT-03 existing at all.
 */
async function lockEditor(tenantId: string): Promise<void> {
  await platformDb.organization.update({
    where: { id: tenantId },
    data: {
      trialEndsAt: new Date(Date.now() - DAY_MS),
      subscriptionStatus: "active",
    },
  });
}

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

type Failed = { ok: false; error: Record<string, string[]> };

async function expectOk<T extends { ok: boolean }>(
  call: Promise<T>,
): Promise<T> {
  const result = await call;
  expect(
    result.ok,
    `the action failed but this fixture needed it to succeed: ${JSON.stringify(result)}`,
  ).toBe(true);
  return result;
}

async function expectRefused<T extends { ok: boolean }>(
  call: Promise<T>,
): Promise<Failed> {
  const result = await call;
  expect(
    result.ok,
    "the action SUCCEEDED where it had to be refused — a gate that lets the " +
      "call through is not a gate",
  ).toBe(false);
  return result as unknown as Failed;
}

// ---------------------------------------------------------------------------
// Row readers — always through `scopedDb`, never the base client
// ---------------------------------------------------------------------------

function pageRow(tenantId: string) {
  return scopedDb(tenantId).storefrontPage.findUnique({
    where: { tenantId_pageType: { tenantId, pageType: "home" } },
    select: {
      id: true,
      draft: true,
      published: true,
      draftUpdatedAt: true,
      publishedAt: true,
    },
  });
}

function themeRow(tenantId: string) {
  return scopedDb(tenantId).storefrontTheme.findUnique({
    where: { tenantId },
    select: {
      id: true,
      draftTokens: true,
      publishedTokens: true,
      publishedAt: true,
    },
  });
}

/** Non-null assertion with a message, so a missing row is not a bare TypeError. */
async function requirePage(tenantId: string) {
  const row = await pageRow(tenantId);
  expect(row, `tenant ${tenantId} has no storefront page row`).not.toBeNull();
  return row!;
}

async function requireTheme(tenantId: string) {
  const row = await themeRow(tenantId);
  expect(row, `tenant ${tenantId} has no storefront theme row`).not.toBeNull();
  return row!;
}

// ---------------------------------------------------------------------------
// Document builders
// ---------------------------------------------------------------------------

/**
 * The flagship default document with one distinguishable value in it.
 *
 * A marker in the hero heading is what makes "this document, and not that one"
 * expressible without deep-diffing five sections in a failure message.
 */
function documentWithMarker(marker: string): PageDocument {
  const document = flagshipDefaultDocument();
  const sections = document.sections.map((section) => {
    if (section.type !== "hero") return section;
    return { ...section, settings: { ...section.settings, heading: marker } };
  });
  return { ...document, sections };
}

function tokensWithMarker(marker: string, primaryAccent: string): ThemeTokens {
  return { ...flagshipDefaultTokens(), primaryAccent, announcementText: marker };
}

/**
 * A document THE CURRENT REGISTRY CANNOT PARSE, in the realistic shape.
 *
 * `version` stays 1 and the section carries a type outside the discriminated
 * union — which is exactly what a draft saved under an OLDER registry looks
 * like after a section type is renamed or dropped. `schema.ts` names this case
 * in as many words: "a type outside this list — `"newsletter"`, say — is
 * refused rather than ignored".
 *
 * It is written straight through `scopedDb`, never through `saveDraft`, because
 * `saveDraft` validates with the SAME schema and would refuse the payload
 * before it ever landed in a column. The scenario under test is a row that is
 * already in the database, not a hostile request.
 */
const STALE_DRAFT = {
  version: 1,
  sections: [
    {
      id: "newsletter",
      type: "newsletter",
      settings: { heading: "Sign up", body: "" },
    },
  ],
};

// ---------------------------------------------------------------------------
// Fixture lifecycle
// ---------------------------------------------------------------------------

/** Mirrors `FIXTURE_EPOCH` in `tests/setup/seed-two-tenants.ts`. */
const FIXTURE_EPOCH = new Date("2026-01-01T00:00:00.000Z");
const FIXTURE_TOKENS = {
  primaryAccent: "#18181B",
  secondaryAccent: "#71717A",
};
const FIXTURE_DOCUMENT = { version: 1, sections: [] };

/**
 * Put the two SEEDED tenants' storefront rows back to their fixture values.
 *
 * WHY THIS EXISTS INSTEAD OF A PER-TEST `seedTwoTenants()`. Every test below
 * signs up its own merchant under its own email and slug and mutates only that
 * merchant's rows, so per-test isolation of the ACTING tenant is a property of
 * the fixtures rather than of a truncate. What the tests do share is the two
 * seeded tenants, which several of them read as the untouched victim — and
 * those four rows are restored here in four statements instead of by
 * re-truncating seventeen tables.
 *
 * The cost of the alternative is documented in this suite already:
 * `merchant-context.test.ts`'s header records that five `seedTwoTenants()`
 * calls in one session-bearing file intermittently failed with "Unable to start
 * a transaction in the given time", because the `TRUNCATE … CASCADE` runs in a
 * transaction while a second pool is already live for `prismaBase`. This file
 * is session-bearing for the same reason that one is, so it inherits the same
 * `beforeAll` posture — and gets a pristine victim baseline anyway.
 *
 * Every assertion about "did not change" still reads the row BEFORE the action
 * and compares against what it actually read, never against these constants.
 * The constants are a starting line, not an oracle.
 */
async function restoreSeededStorefronts(): Promise<void> {
  for (const tenant of [TENANT_A, TENANT_B]) {
    const db = scopedDb(tenant.id);
    await db.storefrontPage.update({
      where: { id: `${tenant.id}-storefront-page` },
      data: {
        draft: FIXTURE_DOCUMENT,
        published: FIXTURE_DOCUMENT,
        publishedAt: FIXTURE_EPOCH,
        draftUpdatedAt: FIXTURE_EPOCH,
      },
    });
    await db.storefrontTheme.update({
      where: { tenantId: tenant.id },
      data: {
        draftTokens: FIXTURE_TOKENS,
        publishedTokens: FIXTURE_TOKENS,
        publishedAt: FIXTURE_EPOCH,
        logoKey: null,
      },
    });
  }
}

beforeAll(async () => {
  await seedTwoTenants();
});

beforeEach(async () => {
  // Without this the previous test's session cookie would authenticate the
  // next one, and "the acting tenant" would silently stop being this test's.
  resetRequestContext();
  limitVerdict.slugCheck = true;
  limitVerdict.signup = true;
  await restoreSeededStorefronts();
});

// ---------------------------------------------------------------------------

describe("publish atomicity", () => {
  it("moves the page's published document and the theme's published tokens together, or neither", async () => {
    const tenantId = await seededMerchant("publish@example.test", "pub-store");

    const beforePage = await requirePage(tenantId);
    const beforeTheme = await requireTheme(tenantId);

    const document = documentWithMarker("PUBLISHED HEADING");
    const tokens = tokensWithMarker("PUBLISHED BAR", "#aa1122");

    await expectOk(saveDraft({ document, tokens }));

    // The draft moved and published did not — the precondition that makes the
    // publish below prove something.
    const staged = await requirePage(tenantId);
    expect(staged.draft).toEqual(document);
    expect(staged.published).toEqual(beforePage.published);

    await expectOk(publishStorefront({}));

    const afterPage = await requirePage(tenantId);
    const afterTheme = await requireTheme(tenantId);

    expect(afterPage.published).toEqual(document);
    expect(afterTheme.publishedTokens).toEqual(tokens);

    expect(afterPage.publishedAt!.getTime()).toBeGreaterThan(
      beforePage.publishedAt!.getTime(),
    );
    expect(afterTheme.publishedAt!.getTime()).toBeGreaterThan(
      beforeTheme.publishedAt!.getTime(),
    );

    /*
     * THE ATOMICITY ASSERTION. Both rows are stamped from the SAME `publishedAt`
     * constant inside one `$transaction`, so two different values here means the
     * two updates did not happen together — which is the half-published
     * storefront the one-row-per-page data model exists to make unrepresentable
     * (04-RESEARCH.md Pattern 2). A merchant whose copy went live without their
     * colours, or the reverse, is looking at a storefront that never existed as
     * a design.
     */
    expect(
      afterPage.publishedAt!.getTime(),
      "the page and the theme carry different publish timestamps, so publish " +
        "is no longer one transaction over two rows",
    ).toBe(afterTheme.publishedAt!.getTime());
  });
});

describe("publish refuses a draft the current registry cannot parse", () => {
  it("leaves published and publishedAt byte-identical (T-04-12)", async () => {
    const tenantId = await seededMerchant("stale@example.test", "stale-store");
    await expectOk(publishStorefront({}));

    const beforePage = await requirePage(tenantId);
    const beforeTheme = await requireTheme(tenantId);

    // Straight into the column, bypassing `saveDraft`'s schema — see STALE_DRAFT.
    await scopedDb(tenantId).storefrontPage.update({
      where: { id: beforePage.id },
      data: { draft: STALE_DRAFT },
    });

    /*
     * The parse failure is a thrown ZodError, not a failed `ActionResult`.
     * `merchantAction` converts only `ReadOnlyError` and `EntitlementError`
     * into `{ ok: false }` and rethrows everything else on purpose — an
     * unexpected error must stay an error, visible in logs, rather than being
     * laundered into a fake validation message.
     */
    await expect(publishStorefront({})).rejects.toThrow();

    const afterPage = await requirePage(tenantId);
    const afterTheme = await requireTheme(tenantId);

    /*
     * WHAT CUSTOMERS SEE MUST NOT MOVE. This is the entire value of the strict
     * `parse` on the publish path, and the reason its asymmetry with
     * `queries.ts`'s `safeParse` IS DELIBERATE AND MUST NOT BE "MADE
     * CONSISTENT": a parse failure HERE is a refused publish the merchant can
     * see and act on, with the last good storefront still live. A parse failure
     * on the public READ path is a customer looking at nothing, which is why
     * that path degrades to flagship defaults instead of throwing. Making the
     * two agree breaks whichever one it is changed to match.
     */
    expect(afterPage.published).toEqual(beforePage.published);
    expect(afterPage.publishedAt!.getTime()).toBe(
      beforePage.publishedAt!.getTime(),
    );
    expect(afterTheme.publishedTokens).toEqual(beforeTheme.publishedTokens);
    expect(afterTheme.publishedAt!.getTime()).toBe(
      beforeTheme.publishedAt!.getTime(),
    );
  });
});

describe("saveDraft", () => {
  it("writes the draft and leaves published byte-identical (D-08)", async () => {
    const tenantId = await seededMerchant("draft@example.test", "draft-store");

    const beforePage = await requirePage(tenantId);
    const beforeTheme = await requireTheme(tenantId);

    const document = documentWithMarker("DRAFT ONLY HEADING");
    const tokens = tokensWithMarker("DRAFT ONLY BAR", "#00ff7f");

    await expectOk(saveDraft({ document, tokens }));

    const afterPage = await requirePage(tenantId);
    const afterTheme = await requireTheme(tenantId);

    expect(afterPage.draft).toEqual(document);
    expect(afterTheme.draftTokens).toEqual(tokens);
    expect(afterPage.draftUpdatedAt.getTime()).toBeGreaterThan(
      beforePage.draftUpdatedAt.getTime(),
    );

    /*
     * A merchant editing their store must be able to make any change at all,
     * including a broken one, without a customer ever seeing it. Adding
     * `published` to `saveDraft`'s `data` would silently turn every keystroke
     * into a deploy.
     */
    expect(afterPage.published).toEqual(beforePage.published);
    expect(afterPage.publishedAt!.getTime()).toBe(
      beforePage.publishedAt!.getTime(),
    );
    expect(afterTheme.publishedTokens).toEqual(beforeTheme.publishedTokens);
    expect(afterTheme.publishedAt!.getTime()).toBe(
      beforeTheme.publishedAt!.getTime(),
    );
  });
});

describe("discardDraft", () => {
  it("overwrites the draft with published and never deletes the row (D-08)", async () => {
    const tenantId = await seededMerchant(
      "discard@example.test",
      "discard-store",
    );
    await expectOk(publishStorefront({}));

    const published = await requirePage(tenantId);
    const publishedTheme = await requireTheme(tenantId);

    await expectOk(
      saveDraft({
        document: documentWithMarker("ABANDONED HEADING"),
        tokens: tokensWithMarker("ABANDONED BAR", "#123456"),
      }),
    );

    await expectOk(discardDraft({}));

    const afterPage = await requirePage(tenantId);
    const afterTheme = await requireTheme(tenantId);

    expect(afterPage.draft).toEqual(published.published);
    expect(afterTheme.draftTokens).toEqual(publishedTheme.publishedTokens);

    /*
     * STILL THERE, JUST REVERTED — the same assertion shape
     * `storefront-catalog.test.ts` makes for a deactivated product. "Discard my
     * changes" is the exact request that looks like it wants a delete, and
     * D-08's no-hard-delete convention is why it must not be one: deleting
     * would take the merchant's page row out of existence between the discard
     * and the next seed.
     */
    expect(afterPage.id).toBe(published.id);
    expect(afterPage.published).toEqual(published.published);
  });
});

describe("cross-tenant write", () => {
  it("leaves the other tenant's page row completely unchanged", async () => {
    const tenantId = await seededMerchant("acting@example.test", "act-store");

    // TENANT_B is a real, seeded tenant with real seeded rows — not an invented
    // id — so a write that crossed the boundary would genuinely land on it.
    const victimBefore = await requirePage(TENANT_B.id);
    const victimThemeBefore = await requireTheme(TENANT_B.id);

    await expectOk(
      saveDraft({
        document: documentWithMarker("TENANT A ONLY"),
        tokens: tokensWithMarker("TENANT A ONLY", "#abcdef"),
      }),
    );
    await expectOk(publishStorefront({}));

    // Non-vacuous: the acting tenant's own row DID move, so the untouched
    // victim below is the tenant boundary doing work, not a write that no-oped.
    const actingAfter = await requirePage(tenantId);
    expect(actingAfter.draft).not.toEqual(victimBefore.draft);

    // Read back through the victim's OWN scoped client and compare field by
    // field against what was there before.
    const victimAfter = await requirePage(TENANT_B.id);
    const victimThemeAfter = await requireTheme(TENANT_B.id);

    expect(victimAfter.id).toBe(`${TENANT_B.id}-storefront-page`);
    expect(victimAfter.draft).toEqual(victimBefore.draft);
    expect(victimAfter.published).toEqual(victimBefore.published);
    expect(victimAfter.draftUpdatedAt.getTime()).toBe(
      victimBefore.draftUpdatedAt.getTime(),
    );
    expect(victimAfter.publishedAt!.getTime()).toBe(
      victimBefore.publishedAt!.getTime(),
    );
    expect(victimThemeAfter.draftTokens).toEqual(victimThemeBefore.draftTokens);
    expect(victimThemeAfter.publishedTokens).toEqual(
      victimThemeBefore.publishedTokens,
    );
  });
});

describe("cross-tenant read", () => {
  it("never surfaces the other tenant's document through getEditorStorefront", async () => {
    const MARKER = "TENANT B PRIVATE HEADING";

    // Set the victim's draft up through its own scoped client. This is fixture
    // setup, not a cross-tenant write — the point is to give tenant B content
    // that is unmistakably its own.
    await scopedDb(TENANT_B.id).storefrontPage.update({
      where: { id: `${TENANT_B.id}-storefront-page` },
      data: { draft: documentWithMarker(MARKER) },
    });

    // Non-vacuous: tenant B's OWN read does surface the marker, so the absence
    // asserted below is a boundary rather than an empty column.
    const own = await getEditorStorefront(TENANT_B.id);
    expect(
      JSON.stringify(own.document),
      "tenant B's own editor read did not surface its marker, so the " +
        "cross-tenant assertion below would prove nothing",
    ).toContain(MARKER);

    const other = await getEditorStorefront(TENANT_A.id);
    expect(
      JSON.stringify(other.document),
      `tenant ${TENANT_A.id}'s editor read returned tenant ${TENANT_B.id}'s ` +
        "content. That is a production-severity cross-tenant leak, not a " +
        "flaky test.",
    ).not.toContain(MARKER);
  });
});

describe("tier refusal by direct invocation (EDIT-03)", () => {
  /*
   * NO UI IS IN THIS LOOP, AND THAT IS THE POINT. A disabled Save button is a
   * courtesy to the merchant, never the control — an attacker never loads the
   * page whose disabled button is the "control". These two calls are what a
   * scripted POST reaches, so this is the only shape of test that can prove
   * EDIT-03 holds (T-04-05).
   */
  it("refuses saveDraft from a post-trial Starter merchant and writes nothing", async () => {
    const tenantId = await seededMerchant(
      "locked-save@example.test",
      "locksave-store",
      "starter",
    );
    await lockEditor(tenantId);

    const before = await requirePage(tenantId);
    const beforeTheme = await requireTheme(tenantId);

    const refused = await expectRefused(
      saveDraft({
        document: documentWithMarker("SHOULD NEVER LAND"),
        tokens: tokensWithMarker("SHOULD NEVER LAND", "#ff0000"),
      }),
    );
    expect(refused.error.form).toEqual([strings.editor.starterViewOnly]);

    const after = await requirePage(tenantId);
    const afterTheme = await requireTheme(tenantId);
    expect(after.draft).toEqual(before.draft);
    expect(after.published).toEqual(before.published);
    expect(afterTheme.draftTokens).toEqual(beforeTheme.draftTokens);
    expect(afterTheme.publishedTokens).toEqual(beforeTheme.publishedTokens);
  });

  it("refuses publishStorefront from a post-trial Starter merchant and writes nothing", async () => {
    const tenantId = await seededMerchant(
      "locked-pub@example.test",
      "lockpub-store",
      "starter",
    );

    // A real pending change, staged while the trial still grants the editor
    // (D-15), so the refusal below is refusing something rather than a no-op.
    await expectOk(
      saveDraft({
        document: documentWithMarker("STAGED BEFORE LOCK"),
        tokens: tokensWithMarker("STAGED BEFORE LOCK", "#0000ff"),
      }),
    );
    await lockEditor(tenantId);

    const before = await requirePage(tenantId);
    const beforeTheme = await requireTheme(tenantId);

    const refused = await expectRefused(publishStorefront({}));
    expect(refused.error.form).toEqual([strings.editor.starterViewOnly]);

    const after = await requirePage(tenantId);
    const afterTheme = await requireTheme(tenantId);
    expect(after.published).toEqual(before.published);
    expect(after.publishedAt!.getTime()).toBe(before.publishedAt!.getTime());
    expect(afterTheme.publishedTokens).toEqual(beforeTheme.publishedTokens);
  });
});

describe("ensureStorefrontSeeded", () => {
  it("is idempotent and never clobbers an edited draft", async () => {
    const tenantId = await signUpChooseAndCarrySession(
      "seed@example.test",
      "seed-store",
    );

    await expectOk(ensureStorefrontSeeded({}));

    const edited = documentWithMarker("MERCHANT EDIT SURVIVES");
    const editedTokens = tokensWithMarker("MERCHANT EDIT SURVIVES", "#c0ffee");
    await expectOk(saveDraft({ document: edited, tokens: editedTokens }));

    // The second call — what happens on every editor visit.
    await expectOk(ensureStorefrontSeeded({}));

    const db = scopedDb(tenantId);
    expect(
      await db.storefrontTheme.count(),
      "a second seed created a second theme row; the upsert is no longer " +
        "idempotent and this tenant now has two sources of truth",
    ).toBe(1);
    expect(await db.storefrontPage.count()).toBe(1);

    /*
     * `update: {}` ON BOTH HALVES IS WHAT THIS ASSERTS. An `update` carrying
     * data would quietly overwrite a published storefront with registry
     * defaults every time a merchant opened the editor.
     */
    const after = await requirePage(tenantId);
    const afterTheme = await requireTheme(tenantId);
    expect(after.draft).toEqual(edited);
    expect(afterTheme.draftTokens).toEqual(editedTokens);
  });
});
