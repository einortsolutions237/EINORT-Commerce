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
