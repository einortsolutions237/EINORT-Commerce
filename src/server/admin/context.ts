import "server-only";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";

import { auth } from "@/server/auth/auth";

/**
 * The platform-admin Data Access Layer — ADM-01 and D-06, made structural.
 *
 * This is the gate in front of every `src/app/admin/**` page and every admin
 * Server Action. It is the admin surface's equivalent of
 * `src/server/merchant/context.ts`, and it is deliberately the SMALLER of the
 * two: there is no tenant to resolve, no organization row to read, no plan
 * tier, no trial clock. One session, one column, one answer.
 *
 * ---------------------------------------------------------------------------
 * THIS FUNCTION TAKES NO PARAMETERS. IT NEVER WILL.
 * ---------------------------------------------------------------------------
 * `requireMerchantContext`'s header names the way that bug arrives: "an admin
 * view that wants to look at one store". This IS that admin view — so the
 * temptation is not hypothetical here, it is the resident temptation of this
 * whole directory. It must still be refused.
 *
 * The admin surface looks at one store by passing an id to a QUERY. It never
 * passes one to the IDENTITY function. Those are different things and the
 * distinction is the entire safety property: `requireAdminContext()` answers
 * "who is calling, and are they allowed on this surface at all", which is a
 * question about the session and about nothing the caller can supply. A query
 * that then reads organization `X` is authorized by the fact that the caller
 * reached it, not by the id it was handed. Collapse the two and the parameter
 * becomes the authorization, which is the substitution both TEN-04 and
 * 02-RESEARCH.md § Pitfall 3 exist to close — and here there is no tenant
 * predicate underneath to catch it, because `adminDb` is deliberately unscoped
 * (see `src/server/db/admin.ts`). The guard matters MORE on this surface, not
 * less. `tests/unit/no-tenant-id-param.test.ts` scans this directory and fails
 * the build if the signature ever grows one.
 *
 * ---------------------------------------------------------------------------
 * EVERY FAILURE IS notFound(). NEVER redirect(). NEVER 403.
 * ---------------------------------------------------------------------------
 * D-06. A `redirect("/login")` tells an anonymous prober that `/admin` is a
 * real route and that a credential is the only thing missing. A 403 tells them
 * that AND that they are close enough to be worth attacking. A 404 tells them
 * nothing they did not already know — the surface is indistinguishable from
 * every path this application has never heard of.
 *
 * The two rungs below therefore fail IDENTICALLY, and that identity is
 * asserted, not assumed: `tests/isolation/admin-access.test.ts` compares the
 * digest thrown for an anonymous caller against the one thrown for a merchant
 * and requires them to be byte-equal. Two 404s that differ in any observable
 * way are still an oracle, just a quieter one.
 *
 * Note that this differs from `requireMerchantContext`'s posture ON PURPOSE
 * rather than by omission. That function redirects because its callers are
 * legitimately signed-in merchants who need to be told where to go next; this
 * one 404s because its non-callers must not learn that there is anywhere to go.
 *
 * ---------------------------------------------------------------------------
 * IT IS THE GATE, AND EVERY PAGE CALLS IT — NOT JUST THE LAYOUT.
 * ---------------------------------------------------------------------------
 * Same rule, and the same reason, as the dashboard's: a Next 16 layout cannot
 * prevent its child segments from rendering and does not re-run on client-side
 * navigation between sibling routes, so a check placed only there is a check
 * that sometimes does not happen. `React.cache()` collapses the duplicated
 * calls within one render pass to a single `getSession`, so there is no cost to
 * economise on.
 *
 * ---------------------------------------------------------------------------
 * NO RATE LIMITER IS ADDED FOR THIS SURFACE, DELIBERATELY.
 * ---------------------------------------------------------------------------
 * Stated rather than left silent, because an unexplained omission reads as an
 * oversight (06-RESEARCH.md Open Question 4). There is exactly one legitimate
 * user of this surface, and the only pre-authentication path to it is `/login`,
 * which `loginLimiter` already throttles by IP before it parses anything. A
 * second limiter here would throttle a population of one against an attack that
 * cannot get past the first one. T-06-05, disposition "accept".
 */

/**
 * The one value `platformRole` may hold to reach this surface.
 *
 * Allowlisted rather than denylisted, in the same idiom as `ACTIVE_STATUS` in
 * `src/server/merchant/context.ts`: a role a future migration adds — "support",
 * "billing", "readonly" — fails closed and is refused, rather than being served
 * by omission because nobody remembered to exclude it.
 */
const ADMIN_ROLE = "admin";

/**
 * Who the platform owner is, and nothing else.
 *
 * `userId` exists for one purpose: to name the actor on the audit rows this
 * surface writes (an `OrderEvent.actorUserId`, a SYSTEM message in a merchant's
 * support thread). It comes from the signed session cookie, so it is exactly as
 * untrusted-free as the merchant surface's `userId` is — and, as there, no
 * admin action schema accepts a user id and none ever should.
 *
 * There is no `tenantId` on this type and there must never be one. The platform
 * owner has no organization (D-04); an admin context carrying a tenant would be
 * a context that had picked one, which is a decision no identity function gets
 * to make.
 */
export interface AdminContext {
  readonly userId: string;
}

export const requireAdminContext = cache(async (): Promise<AdminContext> => {
  // The signed cookie, decoded by Better Auth. Never hand-parsed, for the same
  // reason `requireMerchantContext` does not: a bespoke reader would be a
  // second, weaker implementation of the check that matters most.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

  /*
   * `platformRole` is present on `session.user` at runtime because Better Auth
   * 1.6.29 merges `options.user.additionalFields` into its output schema and
   * `parseUserOutput` filters against that schema. The field carries no
   * `returned: false`, and no `session.cookieCache` is configured in
   * `src/server/auth/auth.ts` — so this value is read from the database row on
   * every call rather than from a cached copy of the cookie.
   *
   * That last point is load-bearing and is the reason cookie caching must not
   * be enabled without revisiting this file: with it, a demoted administrator
   * would keep platform access for the life of their cached session.
   *
   * The field is `input: false` in that same config, which is what makes this
   * check meaningful — there is no request body anywhere that can set it, and
   * the only writer in the repository is `scripts/promote-admin.ts`, which runs
   * out of band. Do not add a public write path (T-06-02, Pitfall 6).
   */
  if (session.user.platformRole !== ADMIN_ROLE) notFound();

  return { userId: session.user.id };
});
