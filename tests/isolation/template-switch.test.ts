import { applySetCookies } from "better-auth/cookies";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { strings } from "@/lib/strings";
import { Prisma } from "@/generated/prisma/client";
import type { PageDocument, ThemeTokens } from "@/server/theming/schema";

import { seedTwoTenants, TENANT_B } from "../setup/seed-two-tenants";

/**
 * 05-21 Task 1 — TMPL-04 (D-06, D-08, D-09, D-11, D-12) against a real
 * database and a real session.
 *
 * These are `isolation` (not `unit`) tests for the reason `storefront-editor
 * .test.ts`'s own header names: `scopedDb`'s tenant guarantee is a DATABASE
 * property, not a stub property. The tier gate is the same kind of claim —
 * "a Starter merchant on an active trial is refused a Professional template"
 * is a statement about what `assertTemplateAccess` does when handed a real
 * `MerchantContext` `resolveEntitlements` actually computed, not about
 * whether a hand-written `canEditStorefront: false` short-circuits an `if`.
 * A mocked context would let this file assert that the gate refuses an
 * object built to be refused, which proves nothing about production.
 *
 * ---------------------------------------------------------------------------
 * HOW TO READ A FAILURE HERE.
 * ---------------------------------------------------------------------------
 * `tenant-isolation.test.ts` states the rule this file reproduces, adapted:
 * `expected tenant-b-fixed-id, received tenant-a-fixed-id` means one
 * tenant's data reached another tenant's caller. THAT IS A
 * PRODUCTION-SEVERITY FINDING, NOT A FLAKY TEST. Do not re-run it until it
 * passes; do not "stabilise" it.
 *
 * A failure on "the tier case wrote nothing" means a direct POST from a
 * Starter account reached a Professional template — 05-RESEARCH.md Pitfall
 * 6's exact failure, where the picker filters correctly so manual testing
 * passes while the write path stays open. A failure on "published is
 * byte-identical after a switch" means `switchTemplate` silently published a
 * draft a merchant never asked to publish. Neither is a timing issue.
 *
 * ---------------------------------------------------------------------------
 * HOW THE ACTIONS ARE INVOKED: A REAL SESSION, NOT A MOCKED CONTEXT.
 * ---------------------------------------------------------------------------
 * `switchTemplate` / `publishStorefront` / `discardDraft` are built with
 * `merchantAction`, which resolves the tenant through
 * `requireMerchantContext()` from a signed session cookie. This file reuses
 * the session-construction helper this repository already established
 * (`tests/isolation/plan-selection.test.ts`, inherited by
 * `storefront-editor.test.ts`, `read-only.test.ts` and
 * `merchant-context.test.ts`) rather than mocking `@/server/merchant/context`.
 *
 * The tier-refusal case (D-06/D-12) is built exactly the way
 * `storefront-editor.test.ts`'s own EDIT-03 case is built, mirrored: that
 * file locks the editor with an EXPIRED trial to prove the gate is the
 * tier/trial composition and not the read-only gate underneath it. This file
 * does the opposite on purpose — a Starter merchant on an ACTIVE trial, so
 * `canWrite` is true and `canEditStorefront` is true via D-15 (the trial
 * elevates the EDITOR). `assertTemplateAccess` reads `ctx.plan.tier`
 * directly and never composes a trial-elevated boolean (`access.ts`'s own
 * header explains why), so the refusal below can only come from the tier
 * gate — not from a merchant who is locked out of the editor entirely, which
 * would prove nothing about D-12.
 *
 * Only `next/headers`, the rate limiters and `next/cache` are substituted.
 * BETTER AUTH AND PRISMA STAY THE REAL THING, AND NOTHING STUBS `scopedDb`.
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
 * `switchTemplate`, `publishStorefront` and `discardDraft` all call
 * `revalidatePath` outside of a Next request scope, which throws. Same idiom
 * as `storefront-editor.test.ts` and `tests/isolation/checkout-paths.test.ts`.
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
const { switchTemplate, publishStorefront, discardDraft, saveBranding } =
  await import("@/server/theming/actions");
const {
  flagshipDefaultDocument,
  templateDefaultDocument,
  templateDefaultTokens,
} = await import("@/server/theming/defaults");
const { resolveEntitlements } = await import("@/server/entitlements/resolve");
const { platformDb } = await import("@/server/db/platform");
const { scopedDb } = await import("@/server/db/tenant-scoped");
const { auth } = await import("@/server/auth/auth");

// ---------------------------------------------------------------------------
// Session harness — plan-selection.test.ts's, reused rather than re-invented
// ---------------------------------------------------------------------------

const PASSWORD = "correct-horse-battery";

function resetRequestContext(): void {
  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.21" });
  requestContext.cookies.clear();
}

/**
 * Put a real, signed session cookie on the NEXT request. See
 * `plan-selection.test.ts` for the full reasoning: the `nextCookies()` jar is
 * always empty under Vitest, so a jar-based helper would authenticate
 * nothing.
 */
async function authenticateAs(email: string): Promise<void> {
  const signIn = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    headers: requestContext.headers,
    returnHeaders: true,
  });

  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.21" });
  const setCookie = signIn.headers.get("set-cookie");
  if (!setCookie) throw new Error("fixture sign-in issued no session cookie");
  applySetCookies(requestContext.headers, [setCookie]);
}

/**
 * A merchant with a store, a chosen tier and a live session, ready to switch
 * templates. `saveBranding` seeds AND publishes the storefront (ONB-04), so
 * there is no separate `ensureStorefrontSeeded` call needed — by the time
 * this resolves, `draftTemplateKey`/`publishedTemplateKey` are both
 * `"flagship-fashion"` and `draft`/`published` are byte-identical, which is
 * the baseline every case below switches away from.
 *
 * `templateKey: "flagship-fashion"` is deliberate here regardless of `tier`:
 * it is `starter`-tier (the lowest), so onboarding itself never trips the
 * tier gate this file exists to test — every case below reaches the gate
 * through `switchTemplate`, on purpose, not through a fixture that
 * accidentally exercises it first.
 */
async function signUpChooseAndCarrySession(
  email: string,
  slug: string,
  tier: "starter" | "business" | "professional" = "professional",
): Promise<string> {
  const result = await signUpMerchant({
    email,
    password: PASSWORD,
    storeName: "Template Switch Store",
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

  const branded = await saveBranding({
    businessName: "Template Switch Store",
    industry: "general-retail",
    logoKey: null,
    primaryAccent: "#18181B",
    secondaryAccent: "#71717A",
    templateKey: "flagship-fashion",
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

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

type Failed = { ok: false; error: Record<string, string[]> };

async function expectOk<T extends { ok: boolean }>(
  call: Promise<T>,
): Promise<Extract<T, { ok: true }>> {
  const result = await call;
  expect(
    result.ok,
    `the action failed but this fixture needed it to succeed: ${JSON.stringify(result)}`,
  ).toBe(true);
  return result as Extract<T, { ok: true }>;
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
      draftTemplateKey: true,
      publishedTemplateKey: true,
      logoKey: true,
      draftTokens: true,
      publishedTokens: true,
      publishedAt: true,
    },
  });
}

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
// Document/token builders
// ---------------------------------------------------------------------------

function documentWithMarker(marker: string): PageDocument {
  const document = flagshipDefaultDocument();
  const sections = document.sections.map((section) => {
    if (section.type !== "hero") return section;
    return { ...section, settings: { ...section.settings, heading: marker } };
  });
  return { ...document, sections };
}

/** Tokens the schema cannot parse — required fields missing entirely. */
const MALFORMED_TOKENS = { notARealTokenShape: true };

// ---------------------------------------------------------------------------
// Fixture lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await seedTwoTenants();
});

beforeEach(() => {
  // Without this the previous test's session cookie would authenticate the
  // next one, and "the acting tenant" would silently stop being this test's.
  resetRequestContext();
  limitVerdict.slugCheck = true;
  limitVerdict.signup = true;
});

// ---------------------------------------------------------------------------

describe("tier refusal, not trial-elevated (D-06 / D-12)", () => {
  it("refuses a Professional template from a Starter merchant on an active trial and writes nothing", async () => {
    const tenantId = await signUpChooseAndCarrySession(
      "tier@example.test",
      "tier-store",
      "starter",
    );

    /*
     * The fixture premise, asserted rather than assumed: a freshly signed-up
     * organization has `trialEndsAt: null` and `subscriptionStatus` not
     * `"active"`, which `resolveEntitlements` reads as an ACTIVE trial —
     * `canEditStorefront` true via D-15, `canWrite` true. If either of these
     * is false, the refusal below could come from the read-only gate or the
     * editor lock instead of the tier gate, and the test would pass for the
     * wrong reason.
     */
    const orgRow = await platformDb.organization.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        planTier: true,
        trialEndsAt: true,
        subscriptionStatus: true,
      },
    });
    const entitlements = resolveEntitlements(orgRow!, new Date());
    expect(
      entitlements.canEditStorefront,
      "fixture premise failed: an active trial must grant the editor (D-15) " +
        "so the refusal below can only be the tier gate, not the editor lock",
    ).toBe(true);
    expect(entitlements.canWrite).toBe(true);
    expect(entitlements.plan.tier).toBe("starter");

    const beforePage = await requirePage(tenantId);
    const beforeTheme = await requireTheme(tenantId);

    // "fashion-classic" is professional-tier (registry.ts) — out of reach for
    // a Starter merchant regardless of trial state.
    const refused = await expectRefused(
      switchTemplate({ templateKey: "fashion-classic" }),
    );
    expect(refused.error.form).toEqual([strings.editor.templateTierLocked]);

    const afterPage = await requirePage(tenantId);
    const afterTheme = await requireTheme(tenantId);
    expect(afterPage.draft).toEqual(beforePage.draft);
    expect(afterPage.published).toEqual(beforePage.published);
    expect(afterTheme.draftTemplateKey).toBe(beforeTheme.draftTemplateKey);
    expect(afterTheme.publishedTemplateKey).toBe(
      beforeTheme.publishedTemplateKey,
    );
    expect(afterTheme.draftTokens).toEqual(beforeTheme.draftTokens);
    expect(afterTheme.publishedTokens).toEqual(beforeTheme.publishedTokens);
  });
});

describe("forged template key refusal", () => {
  it("refuses a string outside TEMPLATE_KEYS and writes nothing", async () => {
    const tenantId = await signUpChooseAndCarrySession(
      "forged-key@example.test",
      "forged-key-store",
    );

    const beforePage = await requirePage(tenantId);
    const beforeTheme = await requireTheme(tenantId);

    const refused = await expectRefused(
      switchTemplate({ templateKey: "not-a-real-template" }),
    );
    expect(Object.keys(refused.error)).toContain("templateKey");

    const afterPage = await requirePage(tenantId);
    const afterTheme = await requireTheme(tenantId);
    expect(afterPage.draft).toEqual(beforePage.draft);
    expect(afterPage.published).toEqual(beforePage.published);
    expect(afterTheme.draftTemplateKey).toBe(beforeTheme.draftTemplateKey);
    expect(afterTheme.publishedTemplateKey).toBe(
      beforeTheme.publishedTemplateKey,
    );
  });
});

describe("cross-tenant refusal", () => {
  it("leaves tenant B's storefront_theme and storefront_page rows untouched after tenant A's switch", async () => {
    const tenantId = await signUpChooseAndCarrySession(
      "cross-switch@example.test",
      "cross-switch-store",
    );

    // TENANT_B is a real, seeded tenant with real seeded rows — not an
    // invented id — so a write that crossed the boundary would genuinely
    // land on it.
    const victimPageBefore = await requirePage(TENANT_B.id);
    const victimThemeBefore = await requireTheme(TENANT_B.id);

    await expectOk(switchTemplate({ templateKey: "fashion-edit" }));

    // Non-vacuous: the acting tenant's own row DID move, so the untouched
    // victim below is the tenant boundary doing work, not a write that
    // no-oped.
    const actingAfter = await requirePage(tenantId);
    expect(actingAfter.draft).not.toEqual(victimPageBefore.draft);

    const victimPageAfter = await requirePage(TENANT_B.id);
    const victimThemeAfter = await requireTheme(TENANT_B.id);

    expect(victimPageAfter.id).toBe(`${TENANT_B.id}-storefront-page`);
    expect(victimPageAfter.draft).toEqual(victimPageBefore.draft);
    expect(victimPageAfter.published).toEqual(victimPageBefore.published);
    expect(victimPageAfter.draftUpdatedAt.getTime()).toBe(
      victimPageBefore.draftUpdatedAt.getTime(),
    );
    expect(victimThemeAfter.draftTemplateKey).toBe(
      victimThemeBefore.draftTemplateKey,
    );
    expect(victimThemeAfter.publishedTemplateKey).toBe(
      victimThemeBefore.publishedTemplateKey,
    );
    expect(victimThemeAfter.draftTokens).toEqual(victimThemeBefore.draftTokens);
    expect(victimThemeAfter.publishedTokens).toEqual(
      victimThemeBefore.publishedTokens,
    );
    expect(victimThemeAfter.logoKey).toBe(victimThemeBefore.logoKey);
  });
});

describe("draft-only write (D-08)", () => {
  it("changes draft, draftTemplateKey and draftTokens, and leaves published, publishedTemplateKey and publishedTokens byte-identical", async () => {
    const tenantId = await signUpChooseAndCarrySession(
      "draft-only@example.test",
      "draft-only-store",
      "professional",
    );

    const beforePage = await requirePage(tenantId);
    const beforeTheme = await requireTheme(tenantId);

    // "electronics-circuit" is a real, distinct, Professional-reachable
    // template — a Professional merchant switching to a Professional
    // template, per the plan's own construction for this case.
    await expectOk(switchTemplate({ templateKey: "electronics-circuit" }));

    const afterPage = await requirePage(tenantId);
    const afterTheme = await requireTheme(tenantId);

    expect(afterTheme.draftTemplateKey).toBe("electronics-circuit");
    expect(afterPage.draft).not.toEqual(beforePage.draft);
    expect(afterPage.draft).toEqual(templateDefaultDocument("electronics-circuit"));
    expect(afterTheme.draftTokens).not.toEqual(beforeTheme.draftTokens);

    /*
     * THE ASSERTION THAT PROVES THIS IS DRAFT-ONLY. Deep equality, not
     * truthiness — a silent publish would leave `publishedTemplateKey`
     * changed while everything else here still reads "unchanged" by a
     * shallower check.
     */
    expect(afterPage.published).toEqual(beforePage.published);
    expect(afterPage.publishedAt!.getTime()).toBe(
      beforePage.publishedAt!.getTime(),
    );
    expect(afterTheme.publishedTemplateKey).toBe(
      beforeTheme.publishedTemplateKey,
    );
    expect(afterTheme.publishedTokens).toEqual(beforeTheme.publishedTokens);
    expect(afterTheme.publishedAt!.getTime()).toBe(
      beforeTheme.publishedAt!.getTime(),
    );
  });
});

describe("accents and logo survive a switch; copy tokens reset (D-11)", () => {
  it("preserves primaryAccent, secondaryAccent and logoKey, and resets announcementText/footerTagline to the new template's defaults", async () => {
    const tenantId = await signUpChooseAndCarrySession(
      "accents@example.test",
      "accents-store",
      "business",
    );

    const DISTINCT_PRIMARY = "#ab12cd";
    const DISTINCT_SECONDARY = "#34ef56";
    const DISTINCT_LOGO = "tenants/accents-store-tenant/logos/brand-logo-01";

    await scopedDb(tenantId).storefrontTheme.update({
      where: { tenantId },
      data: {
        logoKey: DISTINCT_LOGO,
        draftTokens: {
          primaryAccent: DISTINCT_PRIMARY,
          secondaryAccent: DISTINCT_SECONDARY,
          announcementText: "OLD ANNOUNCEMENT, PRE-SWITCH",
          footerTagline: "OLD FOOTER, PRE-SWITCH",
        } satisfies ThemeTokens,
      },
    });

    // "fashion-studio" is business-tier — reachable by this fixture's tier.
    const switched = await expectOk(
      switchTemplate({ templateKey: "fashion-studio" }),
    );
    const newDefaults = templateDefaultTokens("fashion-studio");

    expect(switched.tokens.primaryAccent).toBe(DISTINCT_PRIMARY);
    expect(switched.tokens.secondaryAccent).toBe(DISTINCT_SECONDARY);
    expect(switched.tokens.announcementText).toBe(newDefaults.announcementText);
    expect(switched.tokens.footerTagline).toBe(newDefaults.footerTagline);

    const afterTheme = await requireTheme(tenantId);
    expect(afterTheme.logoKey).toBe(DISTINCT_LOGO);
    const afterTokens = afterTheme.draftTokens as ThemeTokens;
    expect(afterTokens.primaryAccent).toBe(DISTINCT_PRIMARY);
    expect(afterTokens.secondaryAccent).toBe(DISTINCT_SECONDARY);
    expect(afterTokens.announcementText).toBe(newDefaults.announcementText);
    expect(afterTokens.footerTagline).toBe(newDefaults.footerTagline);
  });
});

describe("publish promotes all three", () => {
  it("promotes publishedTemplateKey, published and publishedTokens together after a switch", async () => {
    const tenantId = await signUpChooseAndCarrySession(
      "publish-promote@example.test",
      "publish-promote-store",
      "professional",
    );

    const switched = await expectOk(
      switchTemplate({ templateKey: "grocery-market" }),
    );
    await expectOk(publishStorefront({}));

    const afterPage = await requirePage(tenantId);
    const afterTheme = await requireTheme(tenantId);

    expect(afterTheme.publishedTemplateKey).toBe("grocery-market");
    expect(afterPage.published).toEqual(switched.document);
    expect(afterTheme.publishedTokens).toEqual(switched.tokens);
  });
});

describe("discardDraft reverts template, document and tokens (D-09 / Pitfall 5)", () => {
  it("reverts draftTemplateKey to publishedTemplateKey and the document to the published one", async () => {
    const tenantId = await signUpChooseAndCarrySession(
      "discard-published@example.test",
      "discard-published-store",
      "professional",
    );

    // Establish a real, distinct published baseline first.
    await expectOk(switchTemplate({ templateKey: "beauty-glow" }));
    const published = await expectOk(publishStorefront({}));

    // Then switch away from it WITHOUT publishing.
    await expectOk(switchTemplate({ templateKey: "furniture-loom" }));

    const midPage = await requirePage(tenantId);
    const midTheme = await requireTheme(tenantId);
    expect(midTheme.draftTemplateKey).toBe("furniture-loom");

    const reverted = await expectOk(discardDraft({}));

    expect(reverted.templateKey).toBe("beauty-glow");
    expect(reverted.document).toEqual(templateDefaultDocument("beauty-glow"));

    const afterPage = await requirePage(tenantId);
    const afterTheme = await requireTheme(tenantId);
    expect(afterTheme.draftTemplateKey).toBe("beauty-glow");
    expect(afterPage.draft).toEqual(afterPage.published);
    expect(afterPage.draft).not.toEqual(midPage.draft);
    expect(published.publishedAt).toBeTruthy();
  });

  it("falls back to the reverted template's own default document and tokens, never the flagship's, for a tenant that has never published (Pitfall 5)", async () => {
    const tenantId = await signUpChooseAndCarrySession(
      "discard-never-published@example.test",
      "discard-never-pub-store",
      "professional",
    );
    const page = await requirePage(tenantId);

    /*
     * Simulate a tenant on a non-flagship template whose `published` half
     * has nothing usable — `published` is nullable and `publishedTokens`
     * can hold a malformed value for exactly this reason (the "never
     * published" / degraded-row case `discardDraft`'s own comment names).
     * Written straight through `scopedDb`, never through an action: this
     * is a row already in the database, not a request the schema would
     * ever accept — the same STALE_DRAFT idiom
     * `storefront-editor.test.ts` uses.
     */
    await scopedDb(tenantId).storefrontTheme.update({
      where: { tenantId },
      data: {
        draftTemplateKey: "grocery-market",
        publishedTemplateKey: "grocery-market",
        publishedTokens: MALFORMED_TOKENS,
      },
    });
    await scopedDb(tenantId).storefrontPage.update({
      where: { id: page.id },
      data: {
        draft: documentWithMarker("PRE-DISCARD, NEVER PUBLISHED"),
        published: Prisma.DbNull,
      },
    });

    const reverted = await expectOk(discardDraft({}));

    expect(reverted.templateKey).toBe("grocery-market");
    expect(reverted.document).toEqual(templateDefaultDocument("grocery-market"));
    expect(
      reverted.document,
      "discardDraft fell back to the FLAGSHIP's default document for a " +
        "non-flagship tenant — Pitfall 5's exact regression",
    ).not.toEqual(flagshipDefaultDocument());
    expect(reverted.tokens).toEqual(templateDefaultTokens("grocery-market"));

    const afterPage = await requirePage(tenantId);
    const afterTheme = await requireTheme(tenantId);
    expect(afterTheme.draftTemplateKey).toBe("grocery-market");
    expect(afterPage.draft).toEqual(templateDefaultDocument("grocery-market"));
  });
});
