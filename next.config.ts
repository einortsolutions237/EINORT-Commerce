import type { NextConfig } from "next";

/**
 * `next/image` remote-pattern allowlist for the storefront's product images.
 *
 * Read directly from `process.env` rather than `@/env`: this file is
 * evaluated by the Next.js CLI itself, outside any request context, and
 * `@/env`'s `createEnv` validates its FULL required set (R2 keys, auth
 * secrets, `DATABASE_URL`) at import time — a cost and a failure mode this
 * file has no reason to take on just to read one already-public URL. Derived
 * from a raw `new URL(...)` and guarded so a missing or malformed value
 * degrades to "no remote pattern" (images fail to optimise, loudly, in dev)
 * rather than crashing the build (03-09; ban #1/#2 do not apply to this file,
 * it renders no UI).
 */
function r2Hostname(): string | undefined {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return undefined;
  try {
    return new URL(base).hostname;
  } catch {
    return undefined;
  }
}

const hostname = r2Hostname();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: hostname
      ? [{ protocol: "https", hostname }]
      : [],
  },
};

export default nextConfig;
