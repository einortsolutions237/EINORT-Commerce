import { storeSlugSchema } from "../src/server/tenant/slug";

/**
 * The fail-closed target guard for `npm run templates:previews`
 * (`scripts/generate-template-previews.ts`, plan 05.1-07).
 *
 * ---------------------------------------------------------------------------
 * THIS GUARD EXISTS BECAUSE THE SCRIPT IT PROTECTS PERFORMS DESTRUCTIVE
 * WRITES.
 * ---------------------------------------------------------------------------
 * The generator overwrites `StorefrontTheme.publishedTemplateKey` /
 * `publishedTokens` and `StorefrontPage.published` fifty times in a row — once
 * per template in the catalog — so it can screenshot each one. Pointed at a
 * real merchant's store, that is their live storefront silently replaced with
 * platform defaults fifty times over. `05.1-RESEARCH.md` § Security Domain
 * names this the phase's highest-severity threat (T-05.1-08 .. T-05.1-10 in
 * this plan's threat register). This module is what stands between the
 * script and that outcome: TMPL-06 and `05.1 D-02` require the generator to
 * refuse to run against anything but an explicitly-configured scratch store.
 *
 * Two independent refusal layers, mirroring `tests/setup/seed-two-tenants.ts`'s
 * `UnsafeSeedTargetError` / `assertSafeSeedTarget` / `resolveSeedTargetUrl`
 * triple almost exactly:
 *   1. `resolvePreviewStoreSlug` — is a target even configured, and is it
 *      shaped like a real slug? No fallback to any other variable.
 *   2. `assertSafePreviewTarget` — does the store the script actually
 *      resolved match the configured slug, and is it empty of orders?
 *
 * WHY THIS MODULE READS `process.env` DIRECTLY even though CLAUDE.md routes
 * all env through `src/env.ts`: that rule binds `src/**`. `scripts/**` and
 * `tests/setup/**` are outside it, exactly as `seed-two-tenants.ts` documents
 * for itself. DO NOT "FIX" THIS by importing `@/env` — that module carries
 * the full Zod boot-time schema (every required provider credential) and is
 * not resolvable from a plain `tsx` script invocation of this file alone.
 *
 * WHY THIS IS A SEPARATE MODULE rather than inline in the generator script:
 * `assertSafeSeedTarget` is unit-testable precisely because it was extracted
 * from `seed-two-tenants.ts`, and `tests/unit/seed-guard.test.ts` is what
 * proves it actually says no. A guard nobody has watched refuse is not a
 * guard — this module exists so `tests/unit/preview-target-guard.test.ts` can
 * make the same observation about the preview generator.
 *
 * IT DOES NOT DELETE ANYTHING. D-08 forbids hard deletes of merchant-owned
 * catalog data; the generator's scratch-tenant handling (plan 05.1-07) uses
 * upserts and overwrites, never row deletes. This module contains zero
 * `.delete(`/`deleteMany` calls, asserted by grep in this plan's acceptance
 * criteria.
 */

/** Raised when the preview generator is pointed at anything unsafe. */
export class UnsafePreviewTargetError extends Error {
  override readonly name = "UnsafePreviewTargetError";
}

/**
 * Reduce a candidate slug down to the shape that either matches the
 * project's canonical store-slug rule (`storeSlugSchema`) or does not.
 *
 * `storeSlugSchema` itself normalises (`trim().toLowerCase()`) before it
 * validates, which is correct for the signup form — a merchant typing
 * "MaBoutique" should not be rejected for the accident of shift-key. A
 * destructive-write target is a different kind of input: a slug that only
 * validates AFTER being silently re-cased is exactly the kind of "close
 * enough" match this guard exists to refuse (see Test 4's `"UPPER"` case).
 * So this reuses `storeSlugSchema` for the actual rule — length, character
 * set, no leading/trailing hyphen, not all-numeric, not `xn--`, not a
 * reserved word — rather than re-authoring a second regex, but additionally
 * requires the schema's output to equal the input unchanged. Any
 * normalisation happening at all means the configured value does not, byte
 * for byte, match a valid slug, and the guard refuses rather than "helpfully"
 * substituting the corrected one.
 */
function looksLikeAValidSlug(candidate: string): boolean {
  const parsed = storeSlugSchema.safeParse(candidate);
  return parsed.success && parsed.data === candidate;
}

/**
 * Resolve the store slug the preview generator is allowed to write to.
 *
 * Reads `TEMPLATE_PREVIEW_STORE_SLUG` and **never** falls back to any other
 * variable — not `NEXT_PUBLIC_ROOT_DOMAIN`, not `DATABASE_URL`, not a
 * differently-named decoy. This mirrors `resolveSeedTargetUrl`'s refusal to
 * fall back from `TEST_DATABASE_URL` to `DATABASE_URL`, and is the single
 * property that stops a guard like this one being decorative: a fallback
 * would mean the "guard" quietly picks a target on the operator's behalf the
 * one time the intended variable is missing — exactly the accident this
 * function exists to catch.
 */
export function resolvePreviewStoreSlug(explicit?: string): string {
  const candidate = explicit ?? process.env.TEMPLATE_PREVIEW_STORE_SLUG;
  if (candidate === undefined || candidate.trim() === "") {
    throw new UnsafePreviewTargetError(
      "Refusing to run: TEMPLATE_PREVIEW_STORE_SLUG is not set.\n" +
        "npm run templates:previews performs destructive writes to a store's " +
        "published theme and page document, overwriting them once per " +
        "template. It only ever runs against an explicitly-configured " +
        "scratch store.\n" +
        "Set TEMPLATE_PREVIEW_STORE_SLUG in .env.local to a throwaway " +
        "store's slug — sign one up at http://localhost:3001/signup and use " +
        "the slug you chose there. Do not point it at a store you care about.",
    );
  }

  const trimmed = candidate.trim();
  if (!looksLikeAValidSlug(trimmed)) {
    throw new UnsafePreviewTargetError(
      `Refusing to run: TEMPLATE_PREVIEW_STORE_SLUG "${trimmed}" does not ` +
        "match the store-slug rule (lowercase letters, numbers and hyphens " +
        "only, no leading or trailing hyphen, not reserved, not all-numeric — " +
        "see src/server/tenant/slug.ts's storeSlugSchema).\n" +
        "Set TEMPLATE_PREVIEW_STORE_SLUG in .env.local to the exact slug of " +
        "a throwaway store, as it appears in that store's URL.",
    );
  }

  return trimmed;
}

/**
 * The second refusal layer: the store the script actually resolved must BE
 * the explicitly-configured one, and must be empty of orders.
 *
 * Two independent checks, in this order, mirroring `assertSafeSeedTarget`'s
 * denylist-then-allowlist structure — neither sanitises, warns, or
 * continues, both throw `UnsafePreviewTargetError`:
 *   1. slug mismatch — the resolved store is not the one the operator
 *      configured, however that happened (a stale cache, a slug that was
 *      released and re-claimed by someone else, a copy-paste error).
 *   2. any orders — a store with even one order is somebody's real
 *      business, not a scratch fixture, regardless of what its slug is.
 */
export function assertSafePreviewTarget(target: {
  readonly slug: string;
  readonly configuredSlug: string;
  readonly orderCount: number;
}): void {
  if (target.slug !== target.configuredSlug) {
    throw new UnsafePreviewTargetError(
      `Refusing to run: the resolved store slug "${target.slug}" does not ` +
        `match TEMPLATE_PREVIEW_STORE_SLUG "${target.configuredSlug}". ` +
        "npm run templates:previews only ever writes to the explicitly-" +
        "configured scratch store — never to whatever store happened to " +
        "resolve.\n" +
        "Set TEMPLATE_PREVIEW_STORE_SLUG in .env.local to the store you " +
        "intend to overwrite, or investigate why resolution returned a " +
        "different one.",
    );
  }

  if (target.orderCount > 0) {
    throw new UnsafePreviewTargetError(
      `Refusing to run: store "${target.slug}" has ${target.orderCount} ` +
        "order(s). A store with orders is somebody's real business, not a " +
        "scratch fixture, and npm run templates:previews overwrites the " +
        "store's published theme and page document once per template.\n" +
        "Point TEMPLATE_PREVIEW_STORE_SLUG in .env.local at a genuinely " +
        "empty throwaway store instead.",
    );
  }
}
