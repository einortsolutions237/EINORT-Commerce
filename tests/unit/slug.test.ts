import { describe, expect, it } from "vitest";

import { RESERVED_SLUGS } from "@/server/tenant/reserved-slugs";
import {
  SLUG_FORMAT_MESSAGE,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_RESERVED_MESSAGE,
} from "@/server/tenant/host";
import { storeSlugSchema } from "@/server/tenant/slug";

/**
 * TEN-06 (form layer) — store-slug format and reserved-word rules.
 *
 * This is layer 1 of the three-layer reserved-slug defence (RESEARCH.md
 * Pattern 2). It is the only layer the merchant ever sees, and the only one
 * that is allowed to be bypassed — the authoritative gate is the Better Auth
 * write hook in plan 01-06. What must hold here is that the *messages* are
 * stable, because plan 01-07's `checkStoreSlug` distinguishes "reserved" from
 * "invalid" by inspecting the message text.
 */

const firstMessage = (input: string): string => {
  const parsed = storeSlugSchema.safeParse(input);
  expect(parsed.success).toBe(false);
  if (parsed.success) throw new Error("unreachable");
  return parsed.error.issues[0]?.message ?? "";
};

describe("storeSlugSchema", () => {
  describe("accepts", () => {
    it("a plain lowercase slug", () => {
      const parsed = storeSlugSchema.safeParse("maboutique");
      expect(parsed).toMatchObject({ success: true, data: "maboutique" });
    });

    it("a slug with single interior hyphens and digits", () => {
      const parsed = storeSlugSchema.safeParse("ma-boutique-2");
      expect(parsed).toMatchObject({ success: true, data: "ma-boutique-2" });
    });

    it("normalizes surrounding whitespace and case before validating", () => {
      const parsed = storeSlugSchema.safeParse("  MaBoutique  ");
      expect(parsed).toMatchObject({ success: true, data: "maboutique" });
    });

    it("a slug of exactly the minimum length", () => {
      const parsed = storeSlugSchema.safeParse("a".repeat(SLUG_MIN_LENGTH));
      expect(parsed.success).toBe(true);
    });

    it("a slug of exactly the maximum length", () => {
      const parsed = storeSlugSchema.safeParse("a".repeat(SLUG_MAX_LENGTH));
      expect(parsed.success).toBe(true);
    });
  });

  describe("rejects on length", () => {
    it("a slug below the minimum length", () => {
      expect(firstMessage("ab")).toBe(SLUG_FORMAT_MESSAGE);
    });

    it("a slug above the maximum length", () => {
      expect(firstMessage("a".repeat(SLUG_MAX_LENGTH + 1))).toBe(SLUG_FORMAT_MESSAGE);
    });
  });

  describe("rejects on hyphen placement", () => {
    it.each(["-boutique", "boutique-", "ma--boutique", "-", "--"])("%s", (input) => {
      expect(firstMessage(input)).toBe(SLUG_FORMAT_MESSAGE);
    });
  });

  describe("rejects on character set", () => {
    it.each(["ma_boutique", "ma boutique", "boutiqué", "ma.boutique", "ma/boutique", "ma+boutique"])(
      "%s",
      (input) => {
        expect(firstMessage(input)).toBe(SLUG_FORMAT_MESSAGE);
      },
    );
  });

  it("rejects the one-character internal rewrite prefix on length before it reaches the blocklist", () => {
    // `s` is reserved, but it is also shorter than the minimum — the merchant
    // sees the format message, and either way it never becomes a store.
    expect(firstMessage("s")).toBe(SLUG_FORMAT_MESSAGE);
  });

  it("rejects an all-numeric slug with its own message", () => {
    expect(firstMessage("12345")).toBe("Cannot be all numbers");
  });

  it("rejects a punycode-prefixed slug (homograph impersonation)", () => {
    // `xn--abc` is a syntactically valid slug under the regex; it must be
    // rejected by an explicit rule or an attacker registers a store whose
    // rendered hostname is visually identical to a real one.
    expect(storeSlugSchema.safeParse("xn--abc").success).toBe(false);
  });

  describe("rejects reserved slugs", () => {
    it.each(["admin", "api", "www", "app", "dashboard", "checkout", "security", "einort"])(
      "%s is reserved",
      (input) => {
        // 01-07's checkStoreSlug keys off the word "reserved" in this message to
        // return status "reserved" rather than "invalid". Changing the wording
        // silently downgrades the merchant-facing state.
        const message = firstMessage(input);
        expect(message).toBe(SLUG_RESERVED_MESSAGE);
        expect(message.toLowerCase()).toContain("reserved");
      },
    );

    it("rejects a reserved slug supplied with different casing and padding", () => {
      expect(firstMessage("  ADMIN ")).toBe(SLUG_RESERVED_MESSAGE);
    });

    it("rejects every entry in the blocklist that is otherwise well-formed", () => {
      const wellFormed = [...RESERVED_SLUGS].filter(
        (slug) => slug.length >= SLUG_MIN_LENGTH && slug.length <= SLUG_MAX_LENGTH,
      );
      expect(wellFormed.length).toBeGreaterThan(50);
      for (const slug of wellFormed) {
        expect(storeSlugSchema.safeParse(slug).success).toBe(false);
      }
    });
  });

  it("states the same length bounds in its message that the schema enforces", () => {
    // 01-UI-SPEC.md § "Slug field states" renders this exact string for the
    // "invalid format" state. One number, one place.
    expect(SLUG_FORMAT_MESSAGE).toContain(String(SLUG_MIN_LENGTH));
    expect(SLUG_FORMAT_MESSAGE).toContain(String(SLUG_MAX_LENGTH));
    expect(SLUG_FORMAT_MESSAGE).toBe(
      "Use 3–30 characters: lowercase letters, numbers and hyphens, no leading or trailing hyphen.",
    );
  });
});

describe("RESERVED_SLUGS", () => {
  it("is the single source of truth and contains the load-bearing entries", () => {
    for (const entry of ["www", "api", "admin", "app", "dashboard", "s", "checkout", "security"]) {
      expect(RESERVED_SLUGS.has(entry)).toBe(true);
    }
  });

  it("reserves the internal rewrite prefix", () => {
    // `/s/{slug}` is the rewrite target; a store slugged `s` would collide with it.
    expect(RESERVED_SLUGS.has("s")).toBe(true);
  });

  it("holds only lowercase, already-normalized entries", () => {
    for (const entry of RESERVED_SLUGS) {
      expect(entry).toBe(entry.trim().toLowerCase());
    }
  });
});
