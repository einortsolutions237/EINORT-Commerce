import { RESERVED_SLUGS } from "./reserved-slugs";

/**
 * Pure, zero-I/O hostname classification (TEN-03, TEN-06 route layer, DOM-02).
 *
 * This module runs inside `proxy.ts`, which executes on **every** matched
 * request including prefetches. It therefore imports nothing but the blocklist:
 * no Prisma, no Redis, no `@/env`, no `@/server/db/**`. The root domain arrives
 * as an argument rather than being read here, so the function stays a pure
 * function of its inputs and the whole table below is unit-testable with no
 * environment at all. Resolving a slug to an actual tenant is plan 01-05's job,
 * in the storefront layout, behind a cache.
 *
 * It also owns the slug *format* constants, for a boring reason: `slug.ts`
 * imports Zod, and `host.ts` must not pull Zod into the proxy bundle. Putting
 * the constants here and having `slug.ts` import them keeps one number in one
 * place while the dependency arrow points the safe way.
 */

/** Lower bound. 3 is the shortest address that reads as a name rather than a typo. */
export const SLUG_MIN_LENGTH = 3;

/**
 * Upper bound. Well under the 63-character DNS label ceiling, and the number
 * `01-UI-SPEC.md` § "Slug field states" already renders to the merchant.
 */
export const SLUG_MAX_LENGTH = 30;

/**
 * Lowercase alphanumerics with single interior hyphens. One regex covers the
 * character set, the "no leading/trailing hyphen" rule and the "no `--` run"
 * rule (which incidentally also blocks the `xx--` IDN prefix shape).
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The merchant-facing "invalid format" copy, verbatim from `01-UI-SPEC.md`
 * § "Slug field states". Built from the constants above so the bounds the
 * schema enforces and the bounds the merchant is told can never disagree.
 */
export const SLUG_FORMAT_MESSAGE = `Use ${SLUG_MIN_LENGTH}–${SLUG_MAX_LENGTH} characters: lowercase letters, numbers and hyphens, no leading or trailing hyphen.`;

/**
 * The merchant-facing "reserved" copy, verbatim from `01-UI-SPEC.md`.
 * Plan 01-07's `checkStoreSlug` distinguishes a reserved slug from a merely
 * invalid one by looking for the word "reserved" in the message, so the wording
 * is load-bearing, not decorative.
 */
export const SLUG_RESERVED_MESSAGE =
  "That address is reserved by EINORT. Choose another.";

export type HostResult =
  | { kind: "root" }
  | { kind: "reserved"; label: string }
  | { kind: "store"; slug: string }
  | { kind: "unknown"; reason: string };

/**
 * Classify a raw `Host` header against the platform root domain.
 *
 * Fail-closed throughout: anything this function is not certain about returns
 * `unknown`, which `proxy.ts` turns into the branded not-found page. There is
 * no "probably a store" branch, because every misclassification here is silent.
 *
 * @param rawHost    the `Host` header exactly as received, or `null`
 * @param rootDomain `"einort.com"` in production, `"localhost:3000"` in dev.
 *                   The port is ignored on both sides.
 */
export function classifyHost(rawHost: string | null, rootDomain: string): HostResult {
  if (!rawHost) return { kind: "unknown", reason: "missing-host" };

  // Normalize once: case, whitespace, the port, and the FQDN trailing dot.
  // `einort.com.` and `EINORT.COM:443` are the same host as `einort.com`, and a
  // classifier that treats them differently is a bypass, not a nuance.
  const host = rawHost.toLowerCase().trim().split(":")[0].replace(/\.$/, "");
  const root = rootDomain.toLowerCase().trim().split(":")[0].replace(/\.$/, "");

  if (!host) return { kind: "unknown", reason: "empty-host" };

  // Preview deployments exercise the apex surface only (RESEARCH.md Open
  // Question 2). Preview URLs hit the 63-character DNS-label ceiling, so tenant
  // subdomains on previews are not supported in V1 — treating them as root is
  // the deliberate choice, not an oversight.
  if (host === "vercel.app" || host.endsWith(".vercel.app")) return { kind: "root" };

  if (host === root) return { kind: "root" };

  // FAIL CLOSED (DOM-02). The leading dot is the entire defence against
  // suffix confusion: `endsWith(root)` alone would accept `einort.com.evil.tld`
  // and hand an attacker-controlled origin a storefront on our routing table.
  if (!host.endsWith(`.${root}`)) return { kind: "unknown", reason: "foreign-domain" };

  const label = host.slice(0, -(root.length + 1));

  if (label.includes(".")) return { kind: "unknown", reason: "deep-subdomain" };
  if (label === "www") return { kind: "root" };
  // Checked before the format rules on purpose: a reserved name must report as
  // reserved even when it would also fail some other rule.
  if (RESERVED_SLUGS.has(label)) return { kind: "reserved", label };
  if (label.startsWith("xn--")) return { kind: "unknown", reason: "punycode" };
  if (/^\d+$/.test(label)) return { kind: "unknown", reason: "numeric-label" };
  if (label.length < SLUG_MIN_LENGTH || label.length > SLUG_MAX_LENGTH) {
    return { kind: "unknown", reason: "bad-length" };
  }
  if (!SLUG_PATTERN.test(label)) return { kind: "unknown", reason: "bad-format" };

  return { kind: "store", slug: label };
}
