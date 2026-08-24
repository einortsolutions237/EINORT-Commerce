import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Typed, validated environment surface. Import as `@/env` — never read
 * `process.env` directly outside this file.
 *
 * Why this exists (threat T-01-03): `NEXT_PUBLIC_ROOT_DOMAIN` is the sole input
 * to hostname classification. If it is missing or blank, every hostname
 * classifies as the root domain, silently taking every tenant storefront
 * offline. That must fail at boot with a named error, not at first request —
 * hence validation here plus `emptyStringAsUndefined` below.
 */
export const env = createEnv({
  server: {
    /** Neon **pooled** connection string. Used by the app at runtime (C-5). */
    DATABASE_URL: z.url(),
    /** Neon **unpooled** connection string. Used by migrations only. */
    DIRECT_URL: z.url(),
    /**
     * Upstash is optional: `resolveTenantBySlug` degrades to a direct DB read
     * when Redis is unconfigured so local dev works without credentials. The
     * degradation is loud by design (plan 01-05) — it must never ship silently.
     */
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    /** 32+ random bytes. Rotating this invalidates every session. */
    BETTER_AUTH_SECRET: z.string().min(32),
    /** Apex origin Better Auth issues cookies and callbacks against. */
    BETTER_AUTH_URL: z.url(),
    /*
     * Cloudflare R2 — all five REQUIRED (threat T-03-08).
     *
     * There is no fallback storage path: CAT-02 product images and CHK-04 claim
     * screenshots are uploaded direct-to-R2 via a presigned PUT, so a missing
     * bucket does not degrade the product — it makes product creation and claim
     * submission impossible. Required here means the failure lands at boot with
     * a named error on the deploy that broke it, instead of on a merchant's
     * first upload hours later. Combined with `emptyStringAsUndefined` below, a
     * key left blank in a deploy dashboard fails the same way a missing one does.
     */
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET: z.string().min(1),
    /** Public origin objects are served from (r2.dev subdomain or custom domain). */
    R2_PUBLIC_BASE_URL: z.url(),
    /*
     * Resend — both OPTIONAL (threat T-03-09), following the `UPSTASH_*`
     * precedent above.
     *
     * The only thing these keys buy is D-13's proactive merchant email when a
     * payment claim arrives. The in-app claims badge is the reliable channel and
     * does not depend on them. Making these required would mean an expired
     * Resend key takes claim submission offline for every merchant — trading a
     * missing notification for a broken checkout. The claim path degrades to a
     * `console.warn` instead.
     */
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_FROM_EMAIL: z.email().optional(),
  },
  client: {
    /** `localhost:3000` in dev, `einort.com` in production. Never blank. */
    NEXT_PUBLIC_ROOT_DOMAIN: z.string().min(3),
  },
  /**
   * Every key is listed as a literal `process.env.X` reference on purpose.
   * Next inlines only literal references at build time — spreading
   * `process.env` here compiles, then silently yields `undefined` for every
   * client variable in the browser bundle.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  },
  /**
   * Treat `FOO=` as missing rather than as a valid empty string. Without this,
   * a blank line in a deploy dashboard passes `z.string()` and reintroduces
   * exactly the failure mode this module exists to prevent.
   */
  emptyStringAsUndefined: true,
  /** Escape hatch for lint/typecheck/CI paths that have no secrets. */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
