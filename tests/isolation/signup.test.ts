import { beforeEach, describe, expect, it, vi } from "vitest";

import { platformDb } from "@/server/db/platform";
import { scopedDb } from "@/server/db/tenant-scoped";
import { SLUG_RESERVED_MESSAGE } from "@/server/tenant/host";

import { seedTwoTenants, TENANT_A } from "../setup/seed-two-tenants";

/**
 * ONB-01 and the authoritative TEN-06 write layer, against the real Neon test
 * branch (01-VALIDATION.md).
 *
 * This file is in the `isolation` project rather than `unit` on purpose. Every
 * assertion here is about what actually reached Postgres — "no second
 * Organization was created", "the slug-history row was stamped with the new
 * tenant's id", "the session row carries activeOrganizationId". Against a
 * stubbed database all of those are trivially true, which is precisely the
 * failure mode a security control's regression test must not have.
 *
 * Three things ARE substituted, and only three:
 *
 *   next/headers   — there is no Next request scope in Vitest. The stand-in is
 *                    behaviour-accurate: `cookies()` returns a mutable jar whose
 *                    `set` is immediately visible to `getAll`, which is exactly
 *                    what Next's MutableRequestCookiesAdapter does inside a
 *                    Server Action. That makes the real `nextCookies()` plugin
 *                    run for real, so the session-cookie round trip is
 *                    exercised rather than assumed.
 *   rate limiters  — replaced with controllable verdicts so the ORDER of the
 *                    checks is assertable behaviourally (see "rate limit runs
 *                    before parsing"), not merely by reading the source.
 *   invalidateTenantHost — wrapped in a spy that delegates to the real
 *                    implementation, so the T-01-43 call is asserted without
 *                    changing what it does.
 *
 * Better Auth itself, Prisma, the slug schema, the reserved list, the
 * organization hooks and the resolver are all the real thing.
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

// ---------------------------------------------------------------------------
// invalidateTenantHost spy (delegates to the real implementation)
// ---------------------------------------------------------------------------

const { invalidateSpy } = vi.hoisted(() => ({ invalidateSpy: vi.fn() }));

vi.mock("@/server/tenant/cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/tenant/cache")>();
  return {
    ...actual,
    invalidateTenantHost: async (...slugs: string[]) => {
      invalidateSpy(...slugs);
      return actual.invalidateTenantHost(...slugs);
    },
  };
});

// Imported after the mocks so the modules under test pick them up.
const { checkStoreSlug } = await import("@/server/tenant/actions");
const { signUpMerchant } = await import("@/server/auth/signup");
const { auth } = await import("@/server/auth/auth");
const { resolveTenantBySlug } = await import("@/server/tenant/resolve");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PASSWORD = "correct-horse-battery";

function resetRequestContext(): void {
  requestContext.headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
  requestContext.cookies.clear();
}

/** A user with a session and NO organization — the pre-provisioning state. */
async function createBareUser(email: string): Promise<string> {
  const result = await auth.api.signUpEmail({
    body: { email, password: PASSWORD, name: "Bare User" },
    headers: requestContext.headers,
  });
  return result.user.id;
}

beforeEach(async () => {
  await seedTwoTenants();
  resetRequestContext();
  limitVerdict.slugCheck = true;
  limitVerdict.signup = true;
  invalidateSpy.mockClear();
});

// ---------------------------------------------------------------------------
// checkStoreSlug — DOM-01's live availability check (D-02)
// ---------------------------------------------------------------------------

describe("checkStoreSlug", () => {
  it("rejects a slug that is too short as invalid", async () => {
    await expect(checkStoreSlug("ab")).resolves.toMatchObject({
      status: "invalid",
    });
  });

  it("rejects an underscore as invalid", async () => {
    await expect(checkStoreSlug("ma_boutique")).resolves.toMatchObject({
      status: "invalid",
    });
  });

  it.each(["admin", "api", "www", "checkout"])(
    "reports the reserved platform hostname %s as reserved",
    async (slug) => {
      const result = await checkStoreSlug(slug);
      expect(result.status).toBe("reserved");
      expect(result).toMatchObject({ message: SLUG_RESERVED_MESSAGE });
    },
  );

  it("reports an already-seeded store address as taken", async () => {
    await expect(checkStoreSlug(TENANT_A.slug)).resolves.toMatchObject({
      status: "taken",
    });
  });

  it("reports a released slug as taken so it is never re-issued", async () => {
    // A slug recorded in StoreSlugHistory but held by no organization: the
    // Phase 4 rename case. Re-issuing it would hand the new merchant the old
    // store's inbound links, QR codes and WhatsApp shares (T-01-41).
    const released = "renamed-away-store";
    await scopedDb(TENANT_A.id).storeSlugHistory.create({
      data: { slug: released, releasedAt: new Date() },
    });

    const organization = await platformDb.organization.findUnique({
      where: { slug: released },
      select: { id: true },
    });
    expect(organization).toBeNull();

    await expect(checkStoreSlug(released)).resolves.toMatchObject({
      status: "taken",
    });
  });

  it("reports a fresh valid slug as available", async () => {
    await expect(checkStoreSlug("boutique-douala")).resolves.toEqual({
      status: "available",
    });
  });

  it("answers an anonymous caller with no headers instead of throwing", async () => {
    // This is the exact case better-auth's own /organization/check-slug rejects
    // with 401 via requestOnlySessionMiddleware (Pitfall 3): no session, and a
    // request that carries headers. Ours must answer.
    requestContext.headers = new Headers();
    requestContext.cookies.clear();

    const result = await checkStoreSlug("anon-visitor-store");
    expect(result.status).toBe("available");
  });

  it("rate limit runs before parsing, so a reserved slug still reports rate-limited", async () => {
    // Order matters: the endpoint is unauthenticated and enumerable, so it must
    // spend no parsing or database work on a throttled caller (T-01-39). If the
    // parse ran first this would come back "reserved".
    limitVerdict.slugCheck = false;
    const result = await checkStoreSlug("admin");
    expect(result.status).toBe("rate-limited");
  });
});

// ---------------------------------------------------------------------------
// signUpMerchant — ONB-01
// ---------------------------------------------------------------------------

describe("signUpMerchant", () => {
  it("signup provisions a resolvable store", async () => {
    const slug = "chez-marie";
    const email = "marie@example.test";

    const usersBefore = await platformDb.user.count();
    const orgsBefore = await platformDb.organization.count();

    const result = await signUpMerchant({
      email,
      password: PASSWORD,
      storeName: "Chez Marie",
      slug,
    });

    expect(result).toEqual({ ok: true, slug });

    // Exactly one of each, and the counts moved by exactly one.
    expect(await platformDb.user.count()).toBe(usersBefore + 1);
    expect(await platformDb.organization.count()).toBe(orgsBefore + 1);

    const user = await platformDb.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    // NOT NULL in the schema, supplied by the real Better Auth config — not by
    // a hand-patched migration (plan 01-02).
    expect(user?.platformRole).toBe("merchant");

    const organization = await platformDb.organization.findUnique({
      where: { slug },
    });
    expect(organization).not.toBeNull();
    expect(organization?.status).toBe("active");
    expect(organization?.name).toBe("Chez Marie");

    const members = await platformDb.member.findMany({
      where: { organizationId: organization!.id },
    });
    expect(members).toHaveLength(1);
    expect(members[0]?.userId).toBe(user!.id);
    expect(members[0]?.role).toBe("owner");

    // The slug-history row proves the write went through scopedDb and was
    // STAMPED — signUpMerchant never passes tenantId (TEN-08, T-01-45).
    const history = await scopedDb(organization!.id).storeSlugHistory.findMany({
      where: { slug },
    });
    expect(history).toHaveLength(1);
    expect(history[0]?.tenantId).toBe(organization!.id);
    expect(history[0]?.releasedAt).toBeNull();

    // T-01-43: the cache must be evicted on write, not left to the 60s TTL.
    expect(invalidateSpy).toHaveBeenCalledWith(slug);

    // The whole point of the plan: plan 01-05's resolver answers on the very
    // next request, with no DNS call and nothing asynchronous (DOM-01).
    const resolved = await resolveTenantBySlug(slug);
    expect(resolved).toMatchObject({
      id: organization!.id,
      slug,
      name: "Chez Marie",
      status: "active",
    });
  });

  it("signup invalidates a pre-warmed negative cache entry for the same slug", async () => {
    // A merchant who checked their address during signup — or any scanner —
    // may already have caused a negative entry. Without the invalidation their
    // brand-new store 404s for up to a minute after they land on it.
    const slug = "pre-scanned-store";

    expect(await resolveTenantBySlug(slug)).toBeNull();

    const result = await signUpMerchant({
      email: "scanned@example.test",
      password: PASSWORD,
      storeName: "Pre Scanned",
      slug,
    });
    expect(result.ok).toBe(true);
    expect(invalidateSpy).toHaveBeenCalledWith(slug);
  });

  it("refuses a second store for the same merchant", async () => {
    const first = await signUpMerchant({
      email: "solo@example.test",
      password: PASSWORD,
      storeName: "First Store",
      slug: "first-store",
    });
    expect(first.ok).toBe(true);

    const owner = await platformDb.user.findUnique({
      where: { email: "solo@example.test" },
      select: { id: true },
    });
    const orgsAfterFirst = await platformDb.organization.count();

    // Bypass the signup action entirely and hit the provisioning path directly
    // as the same user. organizationLimit is verified to be checked BEFORE and
    // WITHOUT the system-action bypass, so it constrains this too (T-01-38).
    await expect(
      auth.api.createOrganization({
        body: {
          name: "Second Store",
          slug: "second-store",
          userId: owner!.id,
        },
      }),
    ).rejects.toThrow();

    expect(await platformDb.organization.count()).toBe(orgsAfterFirst);
    expect(
      await platformDb.organization.findUnique({
        where: { slug: "second-store" },
      }),
    ).toBeNull();
  });

  it("refuses a second store when signup is retried with the same email", async () => {
    const first = await signUpMerchant({
      email: "retry@example.test",
      password: PASSWORD,
      storeName: "Retry Store",
      slug: "retry-store",
    });
    expect(first.ok).toBe(true);

    const orgsAfterFirst = await platformDb.organization.count();

    resetRequestContext();
    const second = await signUpMerchant({
      email: "retry@example.test",
      password: PASSWORD,
      storeName: "Retry Store Two",
      slug: "retry-store-two",
    });

    expect(second.ok).toBe(false);
    expect(await platformDb.organization.count()).toBe(orgsAfterFirst);
  });

  it("refuses a reserved slug at the write layer even when the form is bypassed", async () => {
    // The form and the submit-time parse are UX. This calls the provisioning
    // endpoint directly, which is the path an attacker actually takes (T-01-36).
    // The user is fresh and owns nothing, so organizationLimit cannot be what
    // rejects this — the assertion on the message proves it was the slug gate.
    const userId = await createBareUser("bypass@example.test");
    const orgsBefore = await platformDb.organization.count();

    await expect(
      auth.api.createOrganization({
        body: { name: "Admin Store", slug: "admin", userId },
      }),
    ).rejects.toThrow(/reserved/i);

    expect(await platformDb.organization.count()).toBe(orgsBefore);
    expect(
      await platformDb.organization.findUnique({ where: { slug: "admin" } }),
    ).toBeNull();
  });

  it("refuses a malformed slug at the write layer even when the form is bypassed", async () => {
    const userId = await createBareUser("badformat@example.test");
    const orgsBefore = await platformDb.organization.count();

    await expect(
      auth.api.createOrganization({
        body: { name: "Bad Format", slug: "-nope-", userId },
      }),
    ).rejects.toThrow();

    expect(await platformDb.organization.count()).toBe(orgsBefore);
  });

  it("resolves a race between two concurrent signups to exactly one store", async () => {
    const slug = "contested-store";
    const orgsBefore = await platformDb.organization.count();

    const [a, b] = await Promise.all([
      signUpMerchant({
        email: "racer-a@example.test",
        password: PASSWORD,
        storeName: "Racer A",
        slug,
      }),
      signUpMerchant({
        email: "racer-b@example.test",
        password: PASSWORD,
        storeName: "Racer B",
        slug,
      }),
    ]);

    const winners = [a, b].filter((r) => r.ok);
    const losers = [a, b].filter((r) => !r.ok);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);

    // The loser's error must be scoped to the slug field so the form can put
    // the message on the field the merchant has to change.
    const loser = losers[0] as { ok: false; error: Record<string, string[]> };
    expect(Object.keys(loser.error)).toContain("slug");

    // The database @unique on organization.slug is the actual guarantee
    // (T-01-42). No orphaned second organization, on that slug or any other.
    expect(await platformDb.organization.count()).toBe(orgsBefore + 1);
    const organizations = await platformDb.organization.findMany({
      where: { slug },
    });
    expect(organizations).toHaveLength(1);

    // And exactly one slug-history row for the contested address.
    const winnerOrg = organizations[0]!;
    const history = await scopedDb(winnerOrg.id).storeSlugHistory.findMany({
      where: { slug },
    });
    expect(history).toHaveLength(1);
  });

  it("refuses to create a user when the signup rate limit is exhausted", async () => {
    limitVerdict.signup = false;
    const usersBefore = await platformDb.user.count();

    const result = await signUpMerchant({
      email: "flood@example.test",
      password: PASSWORD,
      storeName: "Flood Store",
      slug: "flood-store",
    });

    expect(result.ok).toBe(false);
    // T-01-40: the limit must apply BEFORE any write, or a flood still creates
    // throwaway accounts even while it is "rate limited".
    expect(await platformDb.user.count()).toBe(usersBefore);
  });

  it("returns field errors for an invalid payload without writing anything", async () => {
    const usersBefore = await platformDb.user.count();

    const result = await signUpMerchant({
      email: "not-an-email",
      password: "short",
      storeName: "X",
      slug: "ab",
    });

    expect(result.ok).toBe(false);
    const error = (result as { ok: false; error: Record<string, string[]> })
      .error;
    expect(Object.keys(error).sort()).toEqual([
      "email",
      "password",
      "slug",
      "storeName",
    ]);
    expect(await platformDb.user.count()).toBe(usersBefore);
  });
});

// ---------------------------------------------------------------------------
// RESEARCH.md assumption A3
// ---------------------------------------------------------------------------

describe("session activeOrganizationId", () => {
  it("carries activeOrganizationId on the session created during signup", async () => {
    const slug = "active-org-store";
    const email = "activeorg@example.test";

    const result = await signUpMerchant({
      email,
      password: PASSWORD,
      storeName: "Active Org Store",
      slug,
    });
    expect(result.ok).toBe(true);

    const organization = await platformDb.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    const user = await platformDb.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const sessions = await platformDb.session.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: "desc" },
    });
    expect(sessions.length).toBeGreaterThan(0);

    // signUpEmail creates the session BEFORE the organization exists, so the
    // databaseHooks back-fill cannot see a member row. setActiveOrganization
    // after provisioning is what closes that gap.
    expect(sessions[0]?.activeOrganizationId).toBe(organization!.id);
  });

  it("back-fills activeOrganizationId on a later login (assumption A3)", async () => {
    // A3: databaseHooks.session.create.before returning { data: { ... } } was
    // never empirically verified. This is the assertion that settles it — the
    // hook is the ONLY thing that could set activeOrganizationId on a session
    // created by signInEmail.
    const slug = "returning-merchant";
    const email = "returning@example.test";

    await signUpMerchant({
      email,
      password: PASSWORD,
      storeName: "Returning Merchant",
      slug,
    });

    const organization = await platformDb.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    resetRequestContext();
    const signIn = await auth.api.signInEmail({
      body: { email, password: PASSWORD },
      headers: requestContext.headers,
      returnHeaders: true,
    });

    const session = await platformDb.session.findFirst({
      where: { token: signIn.response.token },
    });
    expect(session).not.toBeNull();
    expect(session?.activeOrganizationId).toBe(organization!.id);
  });
});
