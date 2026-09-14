"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { strings } from "@/lib/strings";
import { callerIp, loginLimiter } from "@/server/rate-limit";

import { auth } from "./auth";

/**
 * TEN-04: a returning merchant gets back into their own dashboard.
 *
 * `signInMerchant` is deliberately thin next to `signUpMerchant` — there is no
 * provisioning to chain, so this is one Better Auth call and one error-code
 * mapping. The two things that ARE load-bearing are the rate limit's position
 * (before parsing, before any Better Auth call — T-02-19) and returning the
 * SAME failure result for every authentication failure (T-02-20): a wrong
 * password and an unknown email must be indistinguishable to the caller.
 */

const loginSchema = z.object({
  // Zod 4 top-level form (C-9), matching `signup.ts`.
  email: z.email(),
  password: z.string().min(1).max(128),
});

/**
 * `redirectTo` is computed SERVER-SIDE and is the D-05 control.
 *
 * The client cannot know `platformRole` before it navigates — the field is
 * `input: false` and is never sent to the browser as part of the sign-in
 * response — and it must not be trusted to decide even if it could. So the
 * destination is resolved here, from the session that was just created, and the
 * form's only job is to push the string it is handed.
 *
 * This closes 06-RESEARCH.md Pitfall 5: with a hardcoded client-side
 * `/dashboard`, the platform owner logged in, `requireMerchantContext()` found
 * no `activeOrganizationId`, and walked them into `/onboarding/create-store` —
 * which, if completed, gives the owner a store and breaks D-04 permanently.
 */
export type SignInMerchantResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: Record<string, string[]> };

/** The one `platformRole` value that routes to the platform admin surface. */
const ADMIN_ROLE = "admin";

/**
 * The two post-login destinations. Allowlisted rather than derived, so a role a
 * future migration adds lands on the merchant dashboard — where the merchant
 * ladder will make its own decision — instead of being routed somewhere by
 * string interpolation.
 */
const ADMIN_DESTINATION = "/admin";
const MERCHANT_DESTINATION = "/dashboard";

/** Better Auth signals failures as `APIError`; the code lives on `body.code`. */
function apiErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const body = (error as { body?: unknown }).body;
  if (typeof body !== "object" || body === null) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * The one failure result every "this login attempt did not work" path
 * returns — a malformed submission and Better Auth's own
 * `INVALID_EMAIL_OR_PASSWORD` alike. Held in a single constant, rather than
 * written out at each call site, so the login copy's one credential-failure
 * string is referenced from exactly one place in this module.
 */
const credentialFailure: SignInMerchantResult = {
  ok: false,
  error: { form: [strings.login.invalidCredentials] },
};

export async function signInMerchant(
  input: unknown,
): Promise<SignInMerchantResult> {
  const requestHeaders = new Headers(await headers());

  /**
   * Rate limit before parsing and before any read (T-02-19). The ordering is
   * the control, not an optimisation: scrypt verification is CPU-bound, so a
   * limiter placed after parsing would still let a flood spend CPU on every
   * request it reports as throttled.
   */
  const { success } = await loginLimiter.limit(callerIp(requestHeaders));
  if (!success) {
    return { ok: false, error: { form: [strings.login.rateLimited] } };
  }

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    // A malformed submission reads as a failed login, not as a distinct
    // validation message: there is no field-level feedback surface on this
    // form (02-UI-SPEC.md), and a different message here would be a second
    // code path for the same enumeration question T-02-20 closes.
    return credentialFailure;
  }

  const { email, password } = parsed.data;

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: requestHeaders,
    });
  } catch (error) {
    /**
     * Map EVERY authentication failure to the same result. RESEARCH.md line
     * 639 verified all four of Better Auth's failure paths deliberately
     * throw the same `INVALID_EMAIL_OR_PASSWORD` code — a wrong password, an
     * unknown email, a user with no credential account, and (per
     * `sign-in.mjs:289-297`) even the timing is equalised with a dummy hash.
     * A distinguishing message here would rebuild the enumeration oracle
     * Better Auth removed.
     */
    if (apiErrorCode(error) === "INVALID_EMAIL_OR_PASSWORD") {
      return credentialFailure;
    }

    console.error("[login] unexpected signInEmail failure", error);
    return { ok: false, error: { form: [strings.login.genericError] } };
  }

  /*
   * D-05: one login page, routed by role, decided SERVER-SIDE.
   *
   * The session has to be re-read rather than taken from `signInEmail`'s return
   * value: that payload is the public user object, and `platformRole` is an
   * `input: false` additional field that exists to be unreachable from the
   * client half of this exchange. `getSession` goes through Better Auth's own
   * output schema, which DOES carry the field (it has no `returned: false`, and
   * no `session.cookieCache` is configured), so this reads the column from the
   * row that was just written.
   *
   * `requestHeaders` already carries the freshly-issued session cookie: the
   * `nextCookies()` plugin writes `Set-Cookie` into Next's cookie store, and
   * `auth.api.signInEmail` mutated this same mutable `Headers` instance via the
   * cookie helpers, so the lookup below authenticates as the user who just
   * signed in rather than as whoever the incoming request was.
   *
   * A failed or missing session here falls through to the merchant
   * destination rather than throwing. `/dashboard` is gated by
   * `requireMerchantContext()`, which runs its own ladder on arrival — so the
   * worst case is one extra redirect, never an unauthorized render. Sending a
   * merchant to `/admin` on an ambiguous read would be the unsafe direction,
   * and that is the branch that requires a positive match.
   */
  const session = await auth.api.getSession({ headers: requestHeaders });
  const redirectTo =
    session?.user.platformRole === ADMIN_ROLE
      ? ADMIN_DESTINATION
      : MERCHANT_DESTINATION;

  return { ok: true, redirectTo };
}

/**
 * Revokes the session server-side (T-02-21) and sends the merchant back to
 * `/login`. A cleared client cookie alone would leave the token valid on the
 * server — `auth.api.signOut` is what actually invalidates it.
 */
export async function signOutMerchant(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
