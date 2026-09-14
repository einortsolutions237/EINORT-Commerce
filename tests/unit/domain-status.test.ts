import { describe, expect, it } from "vitest";

import {
  domainStatusFor,
  storefrontHostFor,
  type DomainStatusInput,
} from "@/server/admin/domain";

/**
 * ADM-03 / D-21, proved with no database.
 *
 * `src/server/admin/domain.ts` is a pure derivation over `Organization.status`
 * and whether a store has been published — this file is the sweep over that
 * derivation's four cases (active+published, active+unpublished,
 * suspended+published, and an unrecognised future status), plus the shape
 * assertions the header promises: a bare hostname with no scheme, and a
 * LIST of length one rather than a scalar.
 */

const ROOT_DOMAIN = "localhost:3000";

function orgInput(
  overrides: Partial<DomainStatusInput> = {},
): DomainStatusInput {
  return {
    slug: "duala-fabrics",
    status: "active",
    isPublished: true,
    rootDomain: ROOT_DOMAIN,
    ...overrides,
  };
}

describe("storefrontHostFor", () => {
  it("composes {slug}.{rootDomain} with no scheme and no trailing slash", () => {
    expect(storefrontHostFor({ slug: "duala-fabrics", rootDomain: ROOT_DOMAIN }))
      .toBe("duala-fabrics.localhost:3000");
  });

  it("never hardcodes einort.com — the injected root domain wins", () => {
    expect(storefrontHostFor({ slug: "acme", rootDomain: "einort.test" })).toBe(
      "acme.einort.test",
    );
  });
});

describe("domainStatusFor", () => {
  it("returns a LIST of length one, not a scalar", () => {
    const result = domainStatusFor(orgInput());
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("reads Live when the org is active and the store is published", () => {
    const [entry] = domainStatusFor(
      orgInput({ status: "active", isPublished: true }),
    );
    expect(entry?.status).toBe("live");
    expect(entry?.host).toBe("duala-fabrics.localhost:3000");
  });

  it("reads Offline when the org is active but the store has never published", () => {
    const [entry] = domainStatusFor(
      orgInput({ status: "active", isPublished: false }),
    );
    expect(entry?.status).toBe("offline");
  });

  it("reads Offline when the org is suspended, even if the store is published", () => {
    const [entry] = domainStatusFor(
      orgInput({ status: "suspended", isPublished: true }),
    );
    expect(entry?.status).toBe("offline");
  });

  it("fails closed on an unrecognised future status — allowlist, not denylist", () => {
    // A status this module has never seen — a typo, a migration's new value —
    // must read Offline. Denylisting only "suspended" would read this as Live
    // by omission, which is the chip-that-lies failure D-21 exists to prevent.
    const [entry] = domainStatusFor(
      orgInput({ status: "pending-review", isPublished: true }),
    );
    expect(entry?.status).toBe("offline");
  });

  it("composes the entry's host through storefrontHostFor, never a literal", () => {
    const [entry] = domainStatusFor(
      orgInput({ slug: "kribi-goods", rootDomain: "einort.com" }),
    );
    expect(entry?.host).toBe(
      storefrontHostFor({ slug: "kribi-goods", rootDomain: "einort.com" }),
    );
  });
});
