"use server";

import { applySetCookies } from "better-auth/cookies";
import { headers } from "next/headers";
import { z } from "zod";

import { strings } from "@/lib/strings";
import { platformDb } from "@/server/db/platform";
import { scopedCreateData, scopedDb } from "@/server/db/tenant-scoped";
import { callerIp, signupLimiter } from "@/server/rate-limit";
import { invalidateTenantHost } from "@/server/tenant/cache";
import { storeSlugSchema } from "@/server/tenant/slug";
import type { Prisma } from "@/generated/prisma/client";

import { auth } from "./auth";

/**
 * ONB-01: an email, a password and a chosen address become a working store.
 *
 * The whole loop closes here. One call produces a user, a session, a tenant, a
 * membership, a slug-history row, an active organization on the session, and a
 * subdomain that plan 01-05's resolver answers for on the very next request.
 *
 * DOM-01 needs nothing further. With the Vercel wildcard domain configured
 * (`*.einort.com`, a one-time human setup task), inserting the organization row
 * IS provisioning: there is no per-tenant Vercel SDK call, no DNS write, no
 * certificate step and nothing asynchronous. Do not add one — a per-tenant
 * domain API call would introduce an async failure mode into a flow that
 * currently has none.
 */

const signupSchema = z.object({
  // Zod 4 top-level form. The v3 `z.string().email()` chain still exists but is
  // deprecated, and this project is v4-only (C-9).
  email: z.email(),
  password: z.string().min(8).max(128),
  storeName: z.string().trim().min(2).max(80),
  // The same schema the authoritative write gate uses, so the form-time parse
  // and the un-bypassable hook can never disagree about what a valid slug is.
  slug: storeSlugSchema,
});

export type SignUpMerchantResult =
  | { ok: true; slug: string }
  | { ok: false; error: Record<string, string[]> };

/** Better Auth signals failures as `APIError`; the code lives on `body.code`. */
function apiErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const body = (error as { body?: unknown }).body;
  if (typeof body !== "object" || body === null) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export async function signUpMerchant(
  input: unknown,
): Promise<SignUpMerchantResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const { email, password, storeName, slug } = parsed.data;

  /**
   * A mutable copy: the session cookie issued by step 1 has to be merged into
   * this header set so step 4 can authenticate as the user who was just
   * created. `await headers()` returns the immutable incoming request headers.
   */
  const requestHeaders = new Headers(await headers());

  /**
   * Rate limit before any write (T-01-40). Each success here creates a user, a
   * tenant and a DNS-addressable hostname, so a limiter placed after step 1
   * would still let a flood accumulate throwaway accounts while reporting
   * itself as throttled.
   */
  const { success } = await signupLimiter.limit(callerIp(requestHeaders));
  if (!success) {
    return { ok: false, error: { form: [strings.signup.rateLimited] } };
  }

  // -------------------------------------------------------------------------
  // 1. User + session. Better Auth owns hashing, session issuance and CSRF.
  // -------------------------------------------------------------------------
  let signUp;
  try {
    signUp = await auth.api.signUpEmail({
      body: { email, password, name: storeName },
      headers: requestHeaders,
      // Gives back the response headers alongside the payload so the
      // `Set-Cookie` this issued can be replayed into `requestHeaders` below.
      returnHeaders: true,
    });
  } catch (error) {
    if (apiErrorCode(error) === "USER_ALREADY_EXISTS") {
      return { ok: false, error: { email: [strings.signup.emailTaken] } };
    }
    return { ok: false, error: { form: [strings.signup.genericError] } };
  }

  /**
   * Replay the freshly issued session cookie into the request headers.
   *
   * `nextCookies()` writes it to Next's cookie store, which is what sends it to
   * the browser — but `requestHeaders` is a snapshot of the INCOMING request
   * and therefore still has no session on it. Step 4 authenticates from
   * `headers`, so without this merge `setActiveOrganization` would look up a
   * session that, from its point of view, does not exist yet and fail with
   * `UNAUTHORIZED`.
   *
   * `applySetCookies` is Better Auth's own helper, used rather than a
   * hand-rolled `Set-Cookie` parse: the session cookie value is SIGNED
   * (`ctx.setSignedCookie`) and percent-encoded, so getting the encode/decode
   * round trip subtly wrong would produce an invalid signature and an
   * authentication failure that looks like a session bug.
   */
  const setCookie = signUp.headers.get("set-cookie");
  if (setCookie) applySetCookies(requestHeaders, [setCookie]);

  const userId = signUp.response.user.id;

  // -------------------------------------------------------------------------
  // 2. The tenant, created as a SYSTEM ACTION.
  // -------------------------------------------------------------------------
  let organization;
  try {
    organization = await auth.api.createOrganization({
      /**
       * `userId` present and `headers` ABSENT is what makes this a system
       * action. Verified in 1.6.29's `crud-org.mjs`:
       *
       *   const isSystemAction = !session && ctx.body.userId;
       *   if (!canCreateOrg && !isSystemAction) throw ... FORBIDDEN
       *
       * so this is the only route past `allowUserToCreateOrganization: false`
       * (T-01-38). Passing `headers` here would attach the session, make
       * `isSystemAction` false, and the call would be rejected by the very
       * flag that stops merchants minting extra stores. `organizationLimit: 1`
       * is checked earlier and WITHOUT the bypass, so it still applies —
       * which is what makes a retried signup idempotent instead of a second
       * store.
       */
      body: { name: storeName, slug, userId },
    });
  } catch (error) {
    /**
     * Ask the database who holds the slug rather than pattern-matching the
     * error. Two different failures mean "someone else got there first" —
     * Better Auth's in-endpoint `findOrganizationBySlug` re-check
     * (`ORGANIZATION_ALREADY_EXISTS`) and, when two requests clear that check
     * concurrently, the `@unique` constraint on `organization.slug` itself.
     * The constraint is the real guarantee (T-01-42); the error shape it
     * surfaces through is an implementation detail of two libraries, and
     * matching on it would rot on a patch release.
     */
    const holder = await platformDb.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (holder) {
      return { ok: false, error: { slug: [strings.signup.slugRaceLost] } };
    }

    // A 400 from here is the `beforeCreateOrganization` gate — a reserved or
    // malformed slug that bypassed the form. Surface its message on the field.
    const status = (error as { status?: unknown }).status;
    const message = (error as { body?: { message?: unknown } }).body?.message;
    if (
      (status === "BAD_REQUEST" || status === 400) &&
      typeof message === "string"
    ) {
      return { ok: false, error: { slug: [message] } };
    }

    /**
     * The non-atomic gap, reported honestly (T-01-46). The user row exists and
     * the organization does not, and no amount of wrapping makes those two
     * writes one transaction — they span two Better Auth endpoints. Telling
     * the merchant nothing happened would send them into a retry that fails on
     * the duplicate email. Plan 01-07 owns the `/onboarding/create-store`
     * recovery route that any authenticated user with zero organizations is
     * redirected to.
     */
    console.error(
      `[signup] user ${userId} was created but provisioning "${slug}" failed; ` +
        `they now need the /onboarding/create-store recovery route.`,
      error,
    );
    return { ok: false, error: { form: [strings.signup.provisioningFailed] } };
  }

  if (!organization) {
    return { ok: false, error: { form: [strings.signup.provisioningFailed] } };
  }

  // -------------------------------------------------------------------------
  // 3. The initial slug claim (D-03).
  // -------------------------------------------------------------------------
  try {
    /**
     * No `tenantId` in `data` — the `scopedDb` extension stamps it, and that is
     * the entire point (TEN-08, T-01-45). `scopedCreateData` is a compile-time
     * assertion only; it reconciles the generated type (which requires
     * `tenantId`, deliberately, as the Pitfall 4 defence) with the runtime
     * contract (which forbids the caller from choosing it).
     *
     * This row is what makes a released slug un-reissuable, so it is also what
     * `checkStoreSlug` consults.
     */
    await scopedDb(organization.id).storeSlugHistory.create({
      data: scopedCreateData<Prisma.StoreSlugHistoryUncheckedCreateInput>({
        slug,
      }),
    });
  } catch (error) {
    /**
     * Effectively unreachable: `checkStoreSlug` screens released slugs at the
     * form, and this runs only after an organization was successfully created
     * on the same globally-unique slug. Logged rather than surfaced, because
     * the store genuinely exists and resolves at this point — telling the
     * merchant their signup failed would be false. The consequence of a
     * missing row is a D-03 rename-safety gap for this one store, which is a
     * data-repair task, not a signup failure.
     */
    console.error(
      `[signup] organization ${organization.id} was created but its ` +
        `StoreSlugHistory claim for "${slug}" failed; D-03 rename safety for ` +
        `this store needs repair.`,
      error,
    );
  }

  // -------------------------------------------------------------------------
  // 4. Activate the organization on the session.
  // -------------------------------------------------------------------------
  try {
    /**
     * A system action does NOT set the active organization: `crud-org.mjs`
     * runs `setActiveOrganization` only `if (ctx.context.session && ...)`, and
     * a system action has no session in its context by construction. Step 1
     * created the session BEFORE the organization existed, so the
     * `databaseHooks.session.create.before` back-fill found no member row and
     * wrote `null`. Without this call `session.activeOrganizationId` stays
     * null for the merchant's entire first session.
     *
     * `headers` IS passed here — unlike step 2 — because this call needs the
     * session it is modifying.
     */
    await auth.api.setActiveOrganization({
      headers: requestHeaders,
      body: { organizationId: organization.id },
    });
  } catch (error) {
    // Not fatal: the store exists and the merchant is signed in. The dashboard
    // can recover from a null active organization; a failed signup cannot.
    console.error(
      `[signup] could not set active organization ${organization.id} on the ` +
        `new session for user ${userId}.`,
      error,
    );
  }

  // -------------------------------------------------------------------------
  // 5. Evict any negative cache entry for this hostname.
  // -------------------------------------------------------------------------
  try {
    /**
     * Invalidate on write; never wait for the TTL (T-01-43, Pitfall 7).
     *
     * A scanner walking wildcard hostnames — or the merchant themselves
     * impatiently loading their address during signup — may already have
     * caused a `{"kind":"miss"}` entry for this exact slug, and plan 01-05's
     * 60-second negative TTL would then shadow a brand-new store for up to a
     * minute after the merchant lands on it. That is the single most likely
     * first-run bug in this phase.
     */
    await invalidateTenantHost(slug);
  } catch (error) {
    // `invalidateTenantHost` deliberately does not swallow errors, because for
    // a SUSPENSION a failed eviction means a suspended store keeps serving.
    // Here the stake is inverted and much lower: a new store may 404 for up to
    // 60s. Failing the whole signup over that would be the worse outcome.
    console.error(
      `[signup] could not evict the tenant host cache for "${slug}"; the ` +
        `store may 404 until the negative entry expires.`,
      error,
    );
  }

  return { ok: true, slug };
}
