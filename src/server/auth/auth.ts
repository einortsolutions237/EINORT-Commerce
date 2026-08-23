import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";

import { env } from "@/env";
import { prismaBase } from "@/server/db/base";
import { authRateLimitStorage } from "@/server/rate-limit";
import { storeSlugSchema } from "@/server/tenant/slug";

/**
 * Better Auth, configured with `organization` as the tenant primitive (C-8).
 *
 * One Organization IS one storefront IS one merchant's store. Nothing in this
 * project hand-rolls a `Tenant` table, a membership join, password hashing,
 * session issuance or CSRF — all of that is delegated (ASVS V2/V3/V6, T-01-47).
 *
 * This file is apex-only by construction. `src/proxy.ts` rewrites a storefront
 * subdomain's `/api/auth/*` into `/s/{slug}/api/auth/*`, where no handler
 * exists, so it 404s. That 404 is the D-07 control, not a routing bug — see the
 * note on the cookie configuration below for why it matters.
 */

/**
 * Cookie name prefix. Project-specific on purpose: a generic `better-auth.`
 * prefix collides with any other Better Auth app sharing a hostname during
 * local development on `localhost`, where cookies are not port-scoped.
 */
const COOKIE_PREFIX = "einort";

export const auth = betterAuth({
  appName: "EINORT",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  /**
   * The Prisma adapter is handed the custom-output client from plan 01-02 via
   * `prismaBase`. `@prisma/client` is NOT the import path in this project — the
   * generator writes to `src/generated/prisma` — so pointing the adapter at the
   * package name (as every tutorial does) resolves a different, unconfigured
   * client with no driver adapter, which under Prisma 7 fails outright.
   */
  database: prismaAdapter(prismaBase, { provider: "postgresql" }),

  emailAndPassword: { enabled: true },

  /**
   * T-02-18/T-02-19: distributed throttling for the raw HTTP surface.
   *
   * `enabled: true` is explicit rather than left to the default
   * (`?? isProduction`, `create-context.mjs:171`) precisely so the control is
   * observable in local development and verified before production, not
   * discovered missing there (02-RESEARCH.md Pattern 6).
   *
   * The storage option below is the ONLY one set here (Pitfall 10). The
   * OTHER top-level option that could distribute rate-limit state instead
   * flips `databaseStoresSessions` and moves session rows out of Postgres,
   * silently breaking the Phase 1 `activeOrganizationId` back-fill and every
   * isolation assertion against the `session` table. This option is
   * documented to take precedence over the plain `storage` setting and
   * touches nothing else — do not add that other option to this file.
   */
  rateLimit: { enabled: true, customStorage: authRateLimitStorage },

  user: {
    additionalFields: {
      /**
       * The single-owner platform Super Admin marker (C-8). Deliberately a
       * field rather than the Better Auth `admin` plugin: V1 has exactly one
       * staff account, and the plugin's banning/impersonation surface is
       * unnecessary complexity — and unnecessary attack surface — for that.
       *
       * `input: false` is the security half. It makes the field unsettable
       * through the public create/update API, so no signup payload can mint a
       * platform administrator by adding one key to the request body. Nothing
       * reads this in Phase 1; Phase 6 does.
       *
       * The column is NOT NULL in `prisma/schema.prisma` (hand-corrected in
       * plan 01-02 — a NULL role is neither "merchant" nor "admin" and would
       * force every future authorization check to special-case it).
       * `defaultValue` here is what keeps that constraint satisfiable from the
       * application side, so the two halves must stay in agreement: do not
       * regenerate this block to `required: false` with no default.
       */
      platformRole: {
        type: "string",
        input: false,
        required: false,
        defaultValue: "merchant",
      },
    },
  },

  advanced: {
    cookiePrefix: COOKIE_PREFIX,

    /**
     * DELIBERATELY ABSENT: the Better Auth option that widens the session
     * cookie's `Domain` attribute to the parent domain (T-01-44, Pitfall 5).
     *
     * Setting it would send the merchant's platform session to EVERY tenant
     * storefront on `*.einort.com` — all of which render merchant-controlled
     * content — so a stored XSS in any one merchant's storefront could read or
     * ride the platform session of any other merchant who visited it. That is a
     * total compromise of the multi-tenant boundary reachable from the least
     * trusted surface on the platform.
     *
     * D-07 makes avoiding it free rather than a trade: signup, login and the
     * merchant dashboard ALL live on the apex, so a default host-only cookie
     * (no `Domain` attribute) is never sent to a subdomain in the first place.
     * If a future plan ever proposes moving the dashboard to `app.einort.com`,
     * this comment is the reason that is not a cosmetic change.
     */
  },

  databaseHooks: {
    session: {
      create: {
        /**
         * Back-fill `activeOrganizationId` on every session creation.
         *
         * This is TEN-04 groundwork for Phase 2: the dashboard needs to know
         * which tenant it is acting for without asking on every login. Because
         * `organizationLimit` is 1, "the user's first membership" is
         * unambiguous today; a multi-store Phase would replace this with a
         * remembered choice rather than a first-row lookup.
         *
         * Note this does NOT cover the signup flow — `signUpEmail` creates the
         * session BEFORE the organization exists, so this hook finds no member
         * row and writes `null`. `signUpMerchant` fixes that explicitly with
         * `setActiveOrganization` after provisioning. The hook covers every
         * subsequent login.
         *
         * RESEARCH.md assumption A3 flagged that this persistence path was
         * never empirically verified; `tests/isolation/signup.test.ts` asserts
         * it against a real database.
         */
        before: async (session) => {
          const membership = await prismaBase.member.findFirst({
            where: { userId: session.userId },
            select: { organizationId: true },
            orderBy: { createdAt: "asc" },
          });

          return {
            data: {
              ...session,
              activeOrganizationId: membership?.organizationId ?? null,
            },
          };
        },
      },
    },
  },

  plugins: [
    organization({
      /**
       * No merchant can mint an extra store through the public API.
       *
       * Signup still works because provisioning in `signup.ts` is a *system
       * action* — verified in this exact version at
       * `node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs`:
       *
       *   const isSystemAction = !session && ctx.body.userId;
       *   if (!canCreateOrg && !isSystemAction) throw APIError.from("FORBIDDEN", ...)
       *
       * so passing `userId` with NO `headers` is the only route through
       * (T-01-38). GitHub issue #6791 claims this does not work; that claim
       * does not hold for 1.6.29.
       */
      allowUserToCreateOrganization: false,

      /**
       * ONB-01's "exactly one store".
       *
       * Verified in the same file to be checked BEFORE and WITHOUT the
       * system-action bypass, so it constrains provisioning too — which is what
       * makes a retried or concurrent signup idempotent rather than a way to
       * accumulate stores.
       */
      organizationLimit: 1,

      creatorRole: "owner",

      schema: {
        organization: {
          additionalFields: {
            /**
             * The suspension flag from plan 01-02's schema, read by
             * `resolveTenantBySlug` to enforce D-05.
             *
             * `input: false` keeps suspension a platform-admin-only write with
             * no public API surface (Phase 6) — otherwise a merchant could
             * un-suspend their own store by including `status` in an update
             * body. Same NOT NULL agreement as `platformRole` above: the column
             * is NOT NULL, and `defaultValue` is what satisfies it on insert.
             */
            status: {
              type: "string",
              input: false,
              required: false,
              defaultValue: "active",
            },

            /**
             * SUB-01 / ONB-05: the plan and trial columns from plan 02-01.
             *
             * `input: false` is a real control here, not decoration. Verified
             * in this exact version:
             *
             *   1. `/organization/create` builds its body schema as
             *      `z.object({ ...baseOrganizationSchema.shape,
             *      ...additionalFieldsSchema.shape })`, where
             *      `additionalFieldsSchema = toZodSchema({ fields,
             *      isClientSide: true })` (`routes/crud-org.mjs`).
             *   2. `toZodSchema` drops `input: false` fields when
             *      `isClientSide` is set: `if (isClientSide && field.input ===
             *      false) return acc;` (`db/to-zod.mjs`).
             *   3. Zod's `z.object` strips unknown keys, so a forged
             *      `{"planTier":"professional"}` is discarded before `ctx.body`
             *      exists.
             *   4. `/organization/update` uses the identical construction, so
             *      the same holds for updates.
             *
             * The only writer of these four columns is server code going
             * through `platformDb.organization.update`. That is not a gap — it
             * is the design: there is deliberately no public API path to set a
             * tier, a trial end, or a subscription status.
             *
             * `subscriptionStatus` is NOT NULL in the schema, so it carries a
             * `defaultValue` for the same reason `status` above does. The other
             * three are nullable and need none.
             */
            planTier: {
              type: "string",
              input: false,
              required: false,
            },
            trialEndsAt: {
              type: "date",
              input: false,
              required: false,
            },
            subscriptionStatus: {
              type: "string",
              input: false,
              required: false,
              defaultValue: "none",
            },
            planSelectedAt: {
              type: "date",
              input: false,
              required: false,
            },
          },
        },
      },

      organizationHooks: {
        /**
         * The AUTHORITATIVE layer of the three-layer TEN-06 defence (T-01-36).
         *
         * Layer 1 is the signup form's live check and layer 2 is the submit
         * parse — both are UX, both are bypassed by anyone who calls the API
         * directly. This hook is the one that cannot be bypassed: every path to
         * organization creation runs through it, including the system action
         * this project's own signup uses and any future admin tooling.
         *
         * THROW-OR-VOID ONLY — never hand back a data object (T-01-37).
         * Verified in `crud-org.mjs`: the caller does
         *
         *   let { keepCurrentActiveOrganization: _, userId: __, ...orgData } = ctx.body;
         *   if (response && ... "data" in response) orgData = { ...ctx.body, ...response.data };
         *
         * The destructure on the first line strips `userId` and
         * `keepCurrentActiveOrganization` from the insert payload — and the
         * second line puts them straight back by re-spreading the ENTIRE
         * `ctx.body`. Returning a value from this hook therefore leaks
         * non-column request fields into the organization insert. Validate and
         * throw; mutate nothing.
         */
        beforeCreateOrganization: async ({ organization: org }) => {
          const parsed = storeSlugSchema.safeParse(org.slug ?? "");
          if (!parsed.success) {
            throw new APIError("BAD_REQUEST", {
              message: parsed.error.issues[0]?.message ?? "Invalid store address.",
            });
          }
        },
      },
    }),

    /**
     * MUST be the final element of this array. `nextCookies()` registers an
     * `after` hook that copies Better Auth's `Set-Cookie` response headers into
     * Next's cookie store, which is what persists a session created inside a
     * Server Action. A plugin registered after it can emit cookies that this
     * hook has already run past, so they are silently dropped — Better Auth
     * even ships a `warnIfCookiePluginNotLast` guard for exactly this mistake.
     * Ordering here is load-bearing, not stylistic.
     */
    nextCookies(),
  ],
});
