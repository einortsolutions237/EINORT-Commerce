import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D-09's degradation contract, proven the way `cart.test.ts` and
 * `tracking-token.test.ts` prove theirs: `vi.spyOn(console, "warn"/"error")`
 * rather than trusting the function resolved without inspecting what it did.
 *
 * `@/env` is mocked behind a mutable holder (`envHolder`) rather than a
 * static factory, because the same module under test must run once with both
 * Resend keys absent (the degraded path) and once with both present (the
 * resolved-error and rejection paths) — `@t3-oss/env-nextjs` validates once
 * at import time, so the only way to vary it across `it` blocks in one file
 * is to make the mock itself read a value this file controls.
 *
 * `resend` is mocked as a class whose `emails.send` is a `vi.fn()` the tests
 * configure per case — resolve `{ error }`, resolve `{ error: null }`, or
 * reject — exercising exactly the two failure channels `notify.ts`'s header
 * says both must be checked.
 */

const envHolder: {
  value: { RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string };
} = { value: {} };

vi.mock("@/env", () => ({
  get env() {
    return envHolder.value;
  },
}));

const sendMock = vi.hoisted(() => vi.fn());

/*
 * `function` here, not an arrow function: `notify.ts` calls `new Resend(apiKey)`,
 * and `vi.fn().mockImplementation(() => …)` cannot be invoked with `new` — an
 * arrow-function implementation has no `[[Construct]]`, so `new Resend(...)`
 * throws "is not a constructor" and every send is caught before it happens.
 */
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function Resend() {
    return { emails: { send: sendMock } };
  }),
}));

const findFirstMock = vi.hoisted(() => vi.fn());
const findUniqueMock = vi.hoisted(() => vi.fn());
const userFindFirstMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/platform", () => ({
  platformDb: {
    member: { findFirst: findFirstMock },
    organization: { findUnique: findUniqueMock },
    user: { findFirst: userFindFirstMock },
  },
}));

import {
  notifyMerchantOfPlatformMessage,
  notifyPlatformOfMerchantMessage,
} from "@/server/support/notify";

const TENANT_ID = "tenant-a-fixed-id";

beforeEach(() => {
  envHolder.value = {};
  sendMock.mockReset();
  findFirstMock.mockReset();
  findUniqueMock.mockReset();
  userFindFirstMock.mockReset();
});

describe("notify.ts, RESEND_API_KEY/RESEND_FROM_EMAIL absent", () => {
  it("notifyPlatformOfMerchantMessage degrades without throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await expect(
        notifyPlatformOfMerchantMessage(TENANT_ID),
      ).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledTimes(1);
      const message = String(warn.mock.calls[0]?.[0]);
      expect(message).toContain("DEGRADED");
      expect(message).toContain("RESEND_API_KEY");
      expect(message).toContain("RESEND_FROM_EMAIL");
    } finally {
      warn.mockRestore();
    }
  });

  it("notifyMerchantOfPlatformMessage degrades without throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await expect(
        notifyMerchantOfPlatformMessage(TENANT_ID),
      ).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledTimes(1);
      const message = String(warn.mock.calls[0]?.[0]);
      expect(message).toContain("DEGRADED");
      expect(message).toContain("RESEND_API_KEY");
      expect(message).toContain("RESEND_FROM_EMAIL");
    } finally {
      warn.mockRestore();
    }
  });
});

describe("notify.ts, both keys present", () => {
  beforeEach(() => {
    envHolder.value = {
      RESEND_API_KEY: "test-key",
      RESEND_FROM_EMAIL: "no-reply@example.test",
    };
  });

  it("checks the RESOLVED error channel, not just the rejection", async () => {
    userFindFirstMock.mockResolvedValue({ email: "owner@example.test" });
    sendMock.mockResolvedValue({ error: { message: "domain not verified" } });

    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(
        notifyPlatformOfMerchantMessage(TENANT_ID),
      ).resolves.toBeUndefined();

      expect(error).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledTimes(1);
    } finally {
      error.mockRestore();
    }
  });

  it("never rejects, even when the send call itself rejects", async () => {
    findFirstMock.mockResolvedValue({
      user: { email: "owner@example.test" },
    });
    sendMock.mockRejectedValue(new Error("network unreachable"));

    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(
        notifyMerchantOfPlatformMessage(TENANT_ID),
      ).resolves.toBeUndefined();

      expect(error).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledTimes(1);
    } finally {
      error.mockRestore();
    }
  });

  it("the composed email body never contains a transaction-reference-shaped token", async () => {
    findFirstMock.mockResolvedValue({
      user: { email: "owner@example.test" },
    });
    sendMock.mockResolvedValue({ error: null });

    await notifyMerchantOfPlatformMessage(TENANT_ID);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0]?.[0] as { text: string };

    // A reference-shaped token in this codebase's own claim-submission copy
    // is an alphanumeric string of meaningful length (MTN/Orange Money
    // transaction references). The body must say only that a message
    // arrived, never quote one.
    expect(call.text).not.toMatch(/\b[A-Z0-9]{8,}\b/);
  });
});
