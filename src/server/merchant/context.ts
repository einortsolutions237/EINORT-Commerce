import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/server/auth/auth";
import { platformDb } from "@/server/db/platform";
import {
  resolveEntitlements,
  type MerchantContext,
} from "@/server/entitlements/resolve";

/**
 * The merchant Data Access Layer — TEN-04, made structural.
 *
 * ---------------------------------------------------------------------------
 * THIS FUNCTION TAKES NO PARAMETERS. IT NEVER WILL.
 * ---------------------------------------------------------------------------
 * A `requireMerchantContext(tenantId)` overload is the precise shape of the bug
 * this module exists to prevent, and it is the shape that arrives innocently: an
 * admin view that wants to "look at one store", a background job that already
 * knows the id, a route segment that reads so much like ordinary REST design
 * nobody questions it. Each of those turns tenant identity into a field a
 * caller can set — and a Server Action is reachable by direct POST without ever
 * loading the form, so "the UI only ever passes the right id" is not a
 * property of the system. `tests/unit/no-tenant-id-param.test.ts` fails the
 * build if the signature ever grows one, in this file or anywhere else under
 * `src/server/merchant/**`.
 *
 * The tenant comes from `session.session.activeOrganizationId` and from nowhere
 * else. Better Auth's organization plugin declares that field `input: false` at
 * the session-schema level, so no request body can set it; the value is written
 * server-side when the session is created and re-read here from the signed
 * cookie. Phase 1 solved the same problem for storefronts by deriving the tenant
 * from the `Host` header (DOM-02) — the dashboard's equivalent untrusted-free
 * channel is the session, and this is the one place it is read.
 *
 * ---------------------------------------------------------------------------
 * IT IS ALSO WHERE THE AUTHORIZATION LADDER LIVES — NOT THE LAYOUT.
 * ---------------------------------------------------------------------------
 * `src/app/(dashboard)/layout.tsx` calls this for the banner's data and does
 * not redirect. A Next 16 layout cannot prevent its child segments from
 * rendering and does not re-run on client-side navigation between sibling
 * routes, so a check placed there is a check that sometimes does not happen.
 * Every page and every action calls this function itself; `React.cache()` makes
 * the duplication cost one `getSession` and one organization read per render
 * pass, so there is no reason to economise on it.
 *
 * Fail-closed is the whole contract, in the same voice as
 * `src/server/tenant/resolve.ts`: there is no default tenant, no "probably this
 * organization" branch, and no state treated as authorized by omission. Every
 * rung below redirects. None returns null, because a nullable return is a check
 * a caller can forget — and forgetting it would render the dashboard.
 */

/**
 * The columns the dashboard is allowed to see, listed rather than spread.
 *
 * A DTO, not a row. `organization` also carries Better Auth's `metadata` and
 * `logo`, and a future migration will add more; `select`-ing eight named
 * columns means a new one has to be added here deliberately before it can reach
 * a component — and `MerchantContext` is what actually crosses into the render
 * tree, so nothing Prisma-shaped is serialized to a client component at all
 * (T-02-16).
 */
const MERCHANT_COLUMNS = {
  id: true,
  name: true,
  slug: true,
  status: true,
  createdAt: true,
  planTier: true,
  trialEndsAt: true,
  subscriptionStatus: true,
  /*
   * ONB-02. Added here deliberately, which is what the paragraph above asks
   * for: the branding rung below reads it and nothing else does. It is read
   * for the redirect ONLY and is NOT threaded into `resolveEntitlements`'s
   * `OrgRow` — that type is structural, so an extra property on the value is
   * accepted without widening it, and widening it would force every fixture in
   * `tests/unit/entitlements.test.ts` to carry a column the resolver never
   * consults.
   */
  industry: true,
} as const;

/** The only status that may reach the dashboard. Allowlisted, so a status a
 * future migration adds fails closed rather than serving by omission. */
const ACTIVE_STATUS = "active";

/**
 * The `platformRole` that belongs on the admin surface instead of this one.
 *
 * Kept in agreement with `ADMIN_ROLE` in `src/server/admin/context.ts` and
 * `src/server/auth/login.ts`. Deliberately duplicated rather than imported:
 * `eslint.config.mjs` fences `src/server/admin/**` off from the tenant surface
 * in both directions (TEN-05), and a shared constant module would be the first
 * thread of exactly the code-sharing that fence exists to prevent. Three copies
 * of a four-character string literal is the cheaper side of that trade.
 */
const ADMIN_ROLE = "admin";

export const requireMerchantContext = cache(
  async (): Promise<MerchantContext> => {
    // The signed cookie, decoded by Better Auth. Never hand-parsed: the session
    // cookie is signed and percent-encoded, and a bespoke reader would be a
    // second, weaker implementation of the check that matters most.
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");

    /*
     * The platform owner, sent home. Belt and braces, and it costs one line.
     *
     * D-05 already routes by role at login (`src/server/auth/login.ts` returns
     * a server-computed `redirectTo`), so in the normal flow this rung never
     * fires. It exists for the abnormal one: a bookmark, a stale client that
     * still pushes `/dashboard`, a back-button, a link in an old email. Every
     * one of those lands here with `activeOrganizationId` null — because the
     * owner has no organization (D-04) — and would fall straight through to the
     * rung below into `/onboarding/create-store`.
     *
     * That is 06-RESEARCH.md Pitfall 5, and its consequence is not a bad
     * redirect but a permanent one: if the owner completes that form they
     * acquire an `Organization`, and an account that is both merchant and
     * platform administrator cannot be cleanly unwound — the store already
     * holds a slug, a slug-history row and possibly orders.
     *
     * MUST STAY ABOVE THE `!tenantId` RUNG. Below it, it is unreachable.
     *
     * This changes nothing about the signature: the role, like the tenant,
     * comes from the session and is not a parameter.
     */
    if (session.user.platformRole === ADMIN_ROLE) redirect("/admin");

    const tenantId = session.session.activeOrganizationId;
    // An account with no store. Phase 1's recovery route owns this case — the
    // merchant is legitimately signed in, they just have nothing to run yet.
    if (!tenantId) redirect("/onboarding/create-store");

    const org = await platformDb.organization.findUnique({
      where: { id: tenantId },
      select: MERCHANT_COLUMNS,
    });

    // The session outlived its organization: deleted, or mid-migration. Fail
    // closed to the login screen rather than searching for another
    // organization this user belongs to — searching would re-derive a tenant
    // the session never asserted, which is the exact substitution the
    // parameter-less signature above exists to prevent (T-02-17).
    if (!org) redirect("/login");

    // OQ-5. Reachable only behind a session whose active organization IS the
    // suspended one, so telling this merchant why is a necessity rather than a
    // leak — the anonymous storefront path stays indistinguishable (D-05).
    //
    // `requireMerchantContextAllowSuspended()` below is the ONE deliberate
    // exception to this redirect, scoped to the support surface — see its own
    // header for why a suspended merchant still needs a way to reach the
    // platform owner.
    if (org.status !== ACTIVE_STATUS) redirect("/suspended");

    // D-05: the plan pick is mandatory, and this is the gate that enforces it.
    // The plan screen and `selectPlan` are deliberately outside this wrapper —
    // routing them through it would loop the merchant on the surface that fixes
    // exactly this state.
    if (org.planTier === null) redirect("/onboarding/plan");

    // ONB-02: the branding step is mandatory too, and this is the gate that
    // enforces it. Exactly one rung, immediately below the plan rung, because
    // the two states are ordered — a merchant picks a plan and then brands the
    // store the plan is for.
    //
    // The branding screen and `saveBranding` are deliberately outside this
    // wrapper, for the same reason the plan screen and `selectPlan` are:
    // routing them through it would loop the merchant on the surface that fixes
    // exactly this state. A merchant submitting that form has a null industry
    // BY DEFINITION, so the wrapper would redirect the write back to the page
    // it came from and the step could never be completed (T-04-27).
    if (org.industry === null) redirect("/onboarding/branding");

    // The one place in the system that reads the clock for trial purposes. The
    // resolver stays pure and takes `now` as a parameter, which is what makes
    // the whole trial lifecycle expressible in the database-free unit project.
    //
    // `userId` is spread in HERE rather than resolved there, and it comes from
    // the same Better Auth session object that supplied
    // `activeOrganizationId` above — so it is exactly as untrusted-free as the
    // tenant id is, arriving through the signed cookie and never through a
    // request body. It exists for exactly one purpose: to fill
    // `OrderEvent.actorUserId` so an ORD-05 audit row can name who confirmed a
    // payment or rejected a claim (T-03-16). No action schema accepts a user
    // id, and none ever should — a forged one in a payload is the shape of
    // attack this provenance closes.
    //
    // Note what did NOT change: `requireMerchantContext()` still takes no
    // parameters. The session is the source of both identities, so neither
    // has to be passed in.
    return {
      ...resolveEntitlements(org, new Date()),
      userId: session.user.id,
    };
  },
);

/** `requireMerchantContextAllowSuspended()`'s return shape: everything
 * `requireMerchantContext()` returns, plus whether the org is currently
 * suspended — the one fact its callers need that the strict resolver never
 * surfaces, because the strict resolver redirects away before returning at
 * all. */
export interface MerchantContextAllowSuspended extends MerchantContext {
  readonly suspended: boolean;
}

/**
 * `requireMerchantContext()`'s ladder, with exactly one rung removed: this
 * never redirects a suspended merchant to `/suspended`.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS: SUSPENSION MUST NOT ALSO CUT OFF THE ONE CHANNEL THAT
 * RESOLVES IT.
 * ---------------------------------------------------------------------------
 * `/admin`'s suspend action posts a system message into the merchant's own
 * support thread naming the reason (`src/server/admin/suspend.ts`) — the
 * thread IS the record of why a store was suspended. But until this
 * resolver existed, `requireMerchantContext()`'s unconditional redirect meant
 * the one person who most needs to read that message and reply to it could
 * not reach the page it lives on: every route under `(dashboard)/`,
 * including Support, bounced a suspended merchant straight to the static
 * `/suspended` notice. That is the same shape of lockout T-06-78 already
 * names for an expired trial's receipt upload — the write a blocked party
 * needs most is the one gated identically to every other write — except here
 * the block was a full redirect, not a narrower write-gate.
 *
 * ---------------------------------------------------------------------------
 * ONLY THE SUPPORT SURFACE USES THIS. EVERYTHING ELSE STAYS BLOCKED.
 * ---------------------------------------------------------------------------
 * Suspension still means the store cannot operate: catalog writes, order
 * handling, the storefront editor and the storefront itself all stay exactly
 * as blocked as before, because every one of those call sites still calls
 * `requireMerchantContext()` (the strict resolver) and still redirects. This
 * function is consumed by exactly three places — `(dashboard)/layout.tsx`
 * (so the shell can render at all for a suspended merchant),
 * `dashboard/support/page.tsx`, and the two support Server Actions
 * (`sendSupportMessage`, `markSupportThreadRead` via `merchantAction`'s
 * `allowSuspended` flag) — and MUST NOT be reached for by a new call site
 * without the same scrutiny this header asks of the ones already here.
 *
 * `canWrite` (D-08's trial gate) is UNCHANGED and NOT bypassed: an
 * expired-trial merchant is still refused when they try to send a message,
 * exactly as `sendSupportMessage`'s own header states. Suspension and trial
 * expiry are two independent gates; this resolver removes only the first.
 */
export const requireMerchantContextAllowSuspended = cache(
  async (): Promise<MerchantContextAllowSuspended> => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");

    if (session.user.platformRole === ADMIN_ROLE) redirect("/admin");

    const tenantId = session.session.activeOrganizationId;
    if (!tenantId) redirect("/onboarding/create-store");

    const org = await platformDb.organization.findUnique({
      where: { id: tenantId },
      select: MERCHANT_COLUMNS,
    });

    if (!org) redirect("/login");

    // THE ONE RUNG REMOVED FROM `requireMerchantContext()`'S LADDER. See this
    // function's header for why.

    if (org.planTier === null) redirect("/onboarding/plan");
    if (org.industry === null) redirect("/onboarding/branding");

    return {
      ...resolveEntitlements(org, new Date()),
      userId: session.user.id,
      suspended: org.status !== ACTIVE_STATUS,
    };
  },
);
