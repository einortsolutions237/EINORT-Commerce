import { describe, expect, it } from "vitest";

import {
  SLUG_FIELD_ICONS,
  slugFieldState,
  type SlugCheck,
  type SlugFieldIcon,
} from "@/app/signup/slug-status";
import { strings } from "@/lib/strings";
import {
  SLUG_FORMAT_MESSAGE,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_RESERVED_MESSAGE,
} from "@/server/tenant/host";

/**
 * The form-layer half of TEN-06 and the D-02 interaction contract.
 *
 * `slugFieldState` is deliberately the only piece of `/signup` with real
 * branching logic, and it is deliberately pure — no React, no DOM, no server
 * action — so this whole contract is assertable in the existing node-environment
 * `unit` project without adding a DOM test setup.
 *
 * The load-bearing row is `rate-limited`. Every other failing status must
 * disable submission; that one must NOT. See its own describe block below.
 */

const HOST = "maboutique.einort.com";

describe("slugFieldState", () => {
  it("is idle when the field has not been touched", () => {
    const result = slugFieldState(undefined);

    expect(result.state).toBe("idle");
    expect(result.icon).toBeNull();
    expect(result.tone).toBe("muted");
    expect(result.message).toBe(strings.signup.slugIdle);
    expect(result.submitDisabled).toBe(true);
  });

  it("is checking while a request is in flight", () => {
    const result = slugFieldState({ pending: true });

    expect(result.state).toBe("checking");
    expect(result.icon).toBe("loader-circle");
    expect(result.tone).toBe("muted");
    expect(result.message).toBe(strings.signup.slugChecking);
    expect(result.submitDisabled).toBe(true);
  });

  it("is available, and only then enables submission on a green check", () => {
    const result = slugFieldState({ status: "available" }, HOST);

    expect(result.state).toBe("available");
    expect(result.icon).toBe("check");
    expect(result.tone).toBe("success");
    expect(result.message).toContain(HOST);
    expect(result.submitDisabled).toBe(false);
  });

  it("is taken", () => {
    const result = slugFieldState({
      status: "taken",
      message: strings.signup.slugTaken,
    });

    expect(result.state).toBe("taken");
    expect(result.icon).toBe("x");
    expect(result.tone).toBe("destructive");
    expect(result.message).toBe(strings.signup.slugTaken);
    expect(result.submitDisabled).toBe(true);
  });

  it("is reserved", () => {
    const result = slugFieldState({
      status: "reserved",
      message: SLUG_RESERVED_MESSAGE,
    });

    expect(result.state).toBe("reserved");
    expect(result.icon).toBe("lock");
    expect(result.tone).toBe("destructive");
    expect(result.message).toBe(SLUG_RESERVED_MESSAGE);
    expect(result.submitDisabled).toBe(true);
  });

  it("is invalid", () => {
    const result = slugFieldState({
      status: "invalid",
      message: SLUG_FORMAT_MESSAGE,
    });

    expect(result.state).toBe("invalid");
    expect(result.icon).toBe("alert-circle");
    expect(result.tone).toBe("destructive");
    expect(result.message).toBe(SLUG_FORMAT_MESSAGE);
    expect(result.submitDisabled).toBe(true);
  });
});

describe("slugFieldState fails open when the check itself cannot run", () => {
  /**
   * T-01-52. The server is the authority — `beforeCreateOrganization` from plan
   * 01-06 refuses a reserved or taken slug no matter what this mapper says — so
   * a throttled or unreachable availability check must never be able to lock a
   * legitimate merchant out of signing up entirely.
   *
   * This is the row that is easy to get backwards, because every OTHER
   * non-available status disables submission. Asserted on its own rather than
   * as one line in a table so a future edit cannot quietly flip it.
   */
  it("maps rate-limited to the unavailable state with submission ENABLED", () => {
    const result = slugFieldState({
      status: "rate-limited",
      message: strings.signup.slugCheckUnavailable,
    });

    expect(result.state).toBe("unavailable");
    expect(result.icon).toBe("alert-circle");
    // Muted, not destructive: nothing is wrong with the address the merchant
    // typed, so it must not be coloured as an error.
    expect(result.tone).toBe("muted");
    expect(result.message).toBe(strings.signup.slugCheckUnavailable);
    expect(result.submitDisabled).toBe(false);
  });
});

describe("slugFieldState renders the server's own copy", () => {
  /**
   * 01-06's `checkStoreSlug` returns a rendered `message` for every failing
   * status. Re-authoring that copy in the client would let the bounds the
   * merchant reads drift from the bounds the schema enforces (01-03-SUMMARY).
   */
  it.each(["taken", "reserved", "invalid", "rate-limited"] as const)(
    "passes the %s message through verbatim",
    (status) => {
      const message = `server copy for ${status}`;
      expect(slugFieldState({ status, message }).message).toBe(message);
    },
  );

  it("states the enforced slug bounds in the invalid-format copy", () => {
    const result = slugFieldState({
      status: "invalid",
      message: SLUG_FORMAT_MESSAGE,
    });

    // 3–30, from 01-03-SUMMARY, via the single source of truth in host.ts.
    expect(result.message).toContain(String(SLUG_MIN_LENGTH));
    expect(result.message).toContain(String(SLUG_MAX_LENGTH));
  });
});

describe("slugFieldState icon vocabulary", () => {
  /**
   * 01-UI-SPEC.md § Component Inventory authorizes exactly five icons for this
   * phase. A sixth arriving through this mapper is a contract violation, and it
   * would arrive silently — the form renders whatever key it is handed.
   */
  const AUTHORIZED: readonly SlugFieldIcon[] = [
    "check",
    "x",
    "lock",
    "alert-circle",
    "loader-circle",
  ];

  const EVERY_INPUT: readonly SlugCheck[] = [
    undefined,
    { pending: true },
    { status: "available" },
    { status: "taken", message: "m" },
    { status: "reserved", message: "m" },
    { status: "invalid", message: "m" },
    { status: "rate-limited", message: "m" },
  ];

  it("only ever returns an authorized icon or null", () => {
    for (const input of EVERY_INPUT) {
      const { icon } = slugFieldState(input);
      if (icon !== null) expect(AUTHORIZED).toContain(icon);
    }
  });

  it("exports the same vocabulary it uses", () => {
    expect([...SLUG_FIELD_ICONS].sort()).toEqual([...AUTHORIZED].sort());
  });

  it("gives every non-idle state both an icon and a text label", () => {
    // WCAG 1.4.1: colour is never the only signal.
    for (const input of EVERY_INPUT) {
      const { state, icon, message } = slugFieldState(input, HOST);
      expect(message.length).toBeGreaterThan(0);
      if (state !== "idle") expect(icon).not.toBeNull();
    }
  });
});
