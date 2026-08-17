"use server";

import { headers } from "next/headers";

import { strings } from "@/lib/strings";
import { prismaBase } from "@/server/db/base";
import { platformDb } from "@/server/db/platform";
import { callerIp, slugCheckLimiter } from "@/server/rate-limit";

import { SLUG_FORMAT_MESSAGE, SLUG_RESERVED_MESSAGE } from "./host";
import { storeSlugSchema } from "./slug";

/**
 * The live store-address availability check D-02 needs.
 *
 * This is hand-written rather than wired to Better Auth's own built-in slug
 * checker, and the reasons are not stylistic — all three were verified against
 * 1.6.29 (Pitfall 3):
 *
 *  1. `/organization/check-slug` sits behind `requestOnlySessionMiddleware`,
 *     which throws `UNAUTHORIZED` whenever a call carries request headers and
 *     no session. That is *precisely* an anonymous signup form, so it 401s on
 *     every keystroke — the one caller D-02 is about.
 *  2. It only tests uniqueness. It knows nothing about the reserved list, so it
 *     would cheerfully report `admin` as available.
 *  3. It signals a collision by THROWING rather than returning a value, so the
 *     "taken" state would arrive as an exception on the happy path.
 *
 * The status union maps one-to-one onto the states `01-UI-SPEC.md` renders, so
 * plan 01-07's form is a lookup rather than a translation layer.
 */
export type SlugStatus =
  | { status: "available" }
  | {
      status: "invalid" | "reserved" | "taken" | "rate-limited";
      message: string;
    };

export async function checkStoreSlug(raw: string): Promise<SlugStatus> {
  /**
   * RATE LIMIT FIRST — before parsing, before any database read.
   *
   * The ordering is the control, not an optimisation (T-01-39). This endpoint
   * is unauthenticated and enumerable: it is a direct read of which merchants
   * exist on the platform, and walking it maps the entire customer base. A
   * limiter placed after the parse would still spend a database round trip per
   * request on well-formed input, which is the traffic an enumerator actually
   * sends. `tests/isolation/signup.test.ts` asserts this ordering behaviourally
   * — a throttled caller asking about `admin` must get `rate-limited`, not
   * `reserved` — because a source-order convention is one refactor away from
   * being silently inverted.
   */
  const requestHeaders = await headers();
  const { success } = await slugCheckLimiter.limit(callerIp(requestHeaders));
  if (!success) {
    /**
     * Plan 01-07 renders this as the "check unavailable" state and keeps the
     * submit button ENABLED. The server is the authority; the live check is
     * UX. Disabling submit here would let a throttled or degraded checker
     * block a legitimate signup outright.
     */
    return {
      status: "rate-limited",
      message: strings.signup.slugCheckUnavailable,
    };
  }

  const parsed = storeSlugSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? SLUG_FORMAT_MESSAGE;
    /**
     * Compared against the exported constant rather than sniffing for the
     * substring "reserved". Both work today, but the constant is the actual
     * contract with `@/server/tenant/slug` — a copy change that drops the word
     * would silently downgrade every reserved hostname to the generic
     * `invalid` state, and nothing would fail.
     */
    return {
      status: message === SLUG_RESERVED_MESSAGE ? "reserved" : "invalid",
      message,
    };
  }

  const slug = parsed.data;

  /**
   * Two independent claims, both of which mean "taken".
   *
   * `organization.slug` is the live holder. `StoreSlugHistory` is every slug
   * ever claimed, including ones since released by a Phase 4 rename — and a
   * released slug must never be re-issued (T-01-41). Handing
   * `ancienne-boutique` to a different merchant would give them the previous
   * store's inbound links, printed QR codes and WhatsApp shares, which is a
   * store-hijack window rather than a cosmetic collision.
   *
   * `StoreSlugHistory` is read through `prismaBase` on purpose. It is a
   * tenant-scoped model, so `scopedDb` would be the normal path — but there is
   * no tenant here: an anonymous visitor is asking a question about the GLOBAL
   * hostname registry, and `slug` carries a platform-wide `@unique` precisely
   * because it is global. `platformDb` is not the alternative either; its
   * surface is a deliberate allowlist that excludes every model carrying a
   * `tenantId`, and widening it for this would blur that boundary for everyone.
   * `eslint.config.mjs` sanctions `src/server/tenant/**` for exactly this kind
   * of narrow registry read. Only `id` is selected: the answer is a boolean,
   * and no tenant data crosses this call.
   */
  const [liveHolder, everClaimed] = await Promise.all([
    platformDb.organization.findUnique({
      where: { slug },
      select: { id: true },
    }),
    prismaBase.storeSlugHistory.findUnique({
      where: { slug },
      select: { id: true },
    }),
  ]);

  if (liveHolder || everClaimed) {
    return { status: "taken", message: strings.signup.slugTaken };
  }

  return { status: "available" };
}
