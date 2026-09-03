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

export const requireMerchantContext = cache(
  async (): Promise<MerchantContext> => {
    // The signed cookie, decoded by Better Auth. Never hand-parsed: the session
    // cookie is signed and percent-encoded, and a bespoke reader would be a
    // second, weaker implementation of the check that matters most.
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");

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
