/**
 * The reserved-slug blocklist — the single source of truth for TEN-06.
 *
 * Three independent layers consume this set (RESEARCH.md Pattern 2), and all
 * three must consume *this* module. A second copy anywhere is the bug: the
 * layers drift, and the one that drifts is always the authoritative one.
 *
 *   1. Form   — `storeSlugSchema` in `./slug.ts` (merchant-visible feedback)
 *   2. Write  — `organizationHooks.beforeCreateOrganization` (plan 01-06,
 *               authoritative: blocks every path to org creation)
 *   3. Route  — `classifyHost` in `./host.ts` (defence in depth: even a
 *               reserved slug that somehow reached the database never routes
 *               as a store)
 *
 * Entries are lowercase and already normalized — callers lowercase their input
 * before testing membership, they do not lowercase the entries.
 *
 * Two entries deserve their reasons written down:
 *
 *   `app` / `dashboard` — D-07 puts signup, login and the merchant dashboard on
 *   the apex, so these are not live hostnames today. They stay reserved anyway,
 *   because that is what keeps D-07 *reversible*: the day the dashboard moves to
 *   its own subdomain, it must not collide with a merchant who already claimed it.
 *
 *   `s` — the internal rewrite prefix. `proxy.ts` rewrites storefronts to
 *   `/s/{slug}`, so a store slugged `s` would produce `/s/s/...` and shadow the
 *   prefix itself.
 *
 * Format-based blocks (punycode prefixes, all-numeric labels, hyphen placement)
 * are deliberately NOT in this list — they are rules, not names, and live in the
 * schema and the classifier where they can be expressed once.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // Infrastructure
  "www",
  "api",
  "admin",
  "app",
  "dashboard",
  "auth",
  "login",
  "signup",
  "account",
  "cdn",
  "static",
  "assets",
  "media",
  "img",
  "images",
  "files",
  "download",
  "uploads",

  // Mail / DNS
  "mail",
  "smtp",
  "imap",
  "pop",
  "mx",
  "ns",
  "ns1",
  "ns2",
  "webmail",
  "email",
  "autodiscover",

  // Platform
  "einort",
  "store",
  "stores",
  "shop",
  "shops",
  "my",
  "go",
  "link",
  "s",

  // Ops / meta
  "status",
  "health",
  "monitor",
  "metrics",
  "logs",
  "staging",
  "dev",
  "test",
  "demo",
  "preview",
  "sandbox",
  "internal",
  "beta",
  "alpha",

  // Content
  "blog",
  "docs",
  "help",
  "support",
  "faq",
  "about",
  "contact",
  "legal",
  "privacy",
  "terms",
  "press",
  "careers",
  "pricing",
  "partners",

  // Commerce
  "billing",
  "invoice",
  "invoices",
  "payments",
  "pay",
  "checkout",
  "cart",
  "orders",
  "webhook",
  "webhooks",

  // Abuse-adjacent
  "security",
  "abuse",
  "postmaster",
  "hostmaster",
  "root",
  "sysadmin",
  "noreply",
  "no-reply",
]);
