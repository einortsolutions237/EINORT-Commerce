import "server-only";

/**
 * ADM-03 / D-21 — domain status, DERIVED, never stored.
 *
 * ---------------------------------------------------------------------------
 * THERE IS NO `Domain` MODEL AND NO `domainStatus` COLUMN. THAT IS NOT A GAP.
 * ---------------------------------------------------------------------------
 * ADM-03 asks the platform owner's console to show "domain status across
 * tenants". Every store's domain today is exactly `{slug}.{rootDomain}` — there
 * is no custom-domain feature, no DNS record this application controls, and no
 * per-domain row anywhere in `prisma/schema.prisma`. Adding a `domainStatus`
 * column now would immediately be a second source of truth with no writer: a
 * suspension (plan 06-14) or a publish (already live, `StorefrontPage`) would
 * each have to remember to keep a THIRD value in sync, and the day one of them
 * forgets, the chip on this page lies. D-21 answers this by making the status a
 * DERIVATION over facts that already have exactly one writer each —
 * `Organization.status` (Better Auth's own write path, and plan 06-14's) and
 * `StorefrontPage.publishedAt` (`publishStorefront`, Phase 5) — rather than a
 * fact of its own.
 *
 * `domainStatusFor` is deliberately the ONE function Phase 15 replaces when a
 * real per-domain state (a verified CNAME, a pending DNS check, a custom
 * domain a merchant configured) exists to observe. Everything that reads a
 * domain's liveness today — the `/admin` column, the `/admin/merchants/[id]`
 * card — calls this function and nothing recomputes the rule inline, so Phase
 * 15's change is a rewrite of one function body, not a hunt through JSX.
 *
 * ---------------------------------------------------------------------------
 * FAIL CLOSED: ALLOWLIST `active`, NEVER DENYLIST `suspended`.
 * ---------------------------------------------------------------------------
 * The same discipline as `ACTIVE_STATUS` in `src/server/merchant/context.ts`
 * and `src/server/tenant/resolve.ts`: an organization status this module has
 * never seen — a typo, a future migration's new value, a status a script wrote
 * incorrectly — must read `"offline"`, not `"live"`. A denylist of the one
 * known bad value (`"suspended"`) would instead read a fourth, unrecognised
 * status as live by omission, which is exactly the chip-that-lies failure this
 * module exists to prevent.
 *
 * ---------------------------------------------------------------------------
 * TWO CHIP STATES ONLY. A THIRD WOULD IMPLY DNS STATE THIS PHASE CANNOT
 * OBSERVE.
 * ---------------------------------------------------------------------------
 * `06-UI-SPEC.md § D` is explicit: `Live` when the org is `active` AND the
 * store is published, `Offline` in every other case. There is no "pending" or
 * "propagating" state, because nothing in this phase watches DNS — inventing a
 * third state here would be product copy for a capability that does not exist.
 *
 * ---------------------------------------------------------------------------
 * PURE, BY CONSTRUCTION — SAME DISCIPLINE AS `src/server/orders/state-machine.ts`
 * AND `src/server/tenant/host.ts`.
 * ---------------------------------------------------------------------------
 * No Prisma client, no I/O, no clock read. The one piece of environment this
 * module would otherwise need — the platform's root domain — arrives as a
 * field on the input object rather than being read from `@/env` in here, in the
 * same idiom `classifyHost(rawHost, rootDomain)` (`src/server/tenant/host.ts`)
 * uses: the caller (a Server Component, which may safely read `@/env`) resolves
 * it once and injects it, and this module stays importable from the
 * database-free `unit` project with zero environment of its own.
 *
 * ---------------------------------------------------------------------------
 * `domainStatusFor` RETURNS A LIST, NOT A SCALAR — TODAY EXACTLY ONE ENTRY.
 * ---------------------------------------------------------------------------
 * `06-UI-SPEC.md § D` builds `<DomainCell>` as a component that renders a LIST
 * of domains, because Phase 15 adds a second entry (a merchant's own custom
 * domain) without restructuring the cell. The data it renders has to be
 * list-shaped for the same reason one entry earlier: a component that maps over
 * an array today and is handed a scalar tomorrow is a component Phase 15 has to
 * rewrite, not extend. `tests/unit/domain-status.test.ts` asserts the returned
 * value is an array of length one, not merely a string.
 */

/** The only status that reads as live. Matches `ACTIVE_STATUS` in
 * `src/server/merchant/context.ts` and `src/server/tenant/resolve.ts` —
 * duplicated rather than imported for the same reason `ADMIN_ROLE` is
 * duplicated there: this module lives under `src/server/admin/**`, which
 * `eslint.config.mjs` fences off from importing the tenant surface (TEN-05),
 * and a shared constant module would be the first thread of exactly the
 * code-sharing that fence exists to prevent. */
const ACTIVE_STATUS = "active";

/** The two, and only two, states a domain chip may show (§ D). */
export type DomainLiveness = "live" | "offline";

/** One entry in the domain list — today always exactly one. */
export interface DomainEntry {
  /** `{slug}.{rootDomain}`, never a scheme, never `www`. */
  readonly host: string;
  readonly status: DomainLiveness;
}

/** What `storefrontHostFor` needs to compose the bare hostname. */
export interface StorefrontHostInput {
  readonly slug: string;
  /** `localhost:3000` in dev, `einort.com` in production — read by the caller
   * from `env.NEXT_PUBLIC_ROOT_DOMAIN` and injected here (see header). */
  readonly rootDomain: string;
}

/**
 * `{slug}.{rootDomain}` — the bare hostname, no scheme, no trailing slash.
 *
 * Composed from the SAME root-domain source every other server-side hostname
 * builder in this codebase uses (`env.NEXT_PUBLIC_ROOT_DOMAIN`, e.g.
 * `storeOriginFor` in `src/server/checkout/actions.ts`), never a hardcoded
 * `"einort.com"` — a preview or staging deploy with a different root domain
 * must show its own hostname, not production's.
 */
export function storefrontHostFor({
  slug,
  rootDomain,
}: StorefrontHostInput): string {
  return `${slug}.${rootDomain}`;
}

/** What `domainStatusFor` needs to derive the one entry's liveness. */
export interface DomainStatusInput {
  readonly slug: string;
  /** `Organization.status`, raw — `"active"`, `"suspended"`, or anything a
   * future migration writes. Allowlisted below, never denylisted. */
  readonly status: string;
  /** Whether the store's home page has been published at least once
   * (`StorefrontPage.publishedAt !== null` for `pageType: "home"`). */
  readonly isPublished: boolean;
  readonly rootDomain: string;
}

/**
 * The domain list for one store — today exactly one entry, `Live` when the
 * organization is `active` AND the store is published, `Offline` otherwise.
 *
 * See the module header for why this is a derivation and not a stored column,
 * why the allowlist runs on `active` rather than a denylist on `suspended`, and
 * why the return type is a list rather than a scalar.
 */
export function domainStatusFor(org: DomainStatusInput): readonly DomainEntry[] {
  const liveness: DomainLiveness =
    org.status === ACTIVE_STATUS && org.isPublished ? "live" : "offline";

  return [
    {
      host: storefrontHostFor({ slug: org.slug, rootDomain: org.rootDomain }),
      status: liveness,
    },
  ];
}
