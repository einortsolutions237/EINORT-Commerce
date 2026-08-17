import { strings } from "@/lib/strings";
import type { SlugStatus } from "@/server/tenant/actions";

/**
 * The D-02 store-address field state machine, as a pure function.
 *
 * This is the only part of `/signup` with real branching logic, and it is
 * isolated here on purpose: the form itself becomes a rendering of whatever
 * this returns, and the whole contract is assertable in the node-environment
 * `unit` project (`tests/unit/slug-status.test.ts`) without a DOM harness.
 *
 * Dependency-free by design. The `SlugStatus` import is `import type`, so it is
 * erased at compile time and this module never pulls the `"use server"` action
 * file — or Prisma, or Redis — into a test or a client bundle. Importing the
 * type rather than restating it structurally is what keeps the seven states
 * here from drifting away from the five statuses plan 01-06's `checkStoreSlug`
 * actually returns.
 *
 * Copy is rendered, never authored, for every failing status: `checkStoreSlug`
 * hands back a `message`, and re-writing it client-side would let the slug
 * bounds the merchant reads drift from the bounds the schema enforces
 * (01-03-SUMMARY).
 */

/**
 * The complete icon vocabulary 01-UI-SPEC.md § Component Inventory authorizes
 * for this phase. Nothing else may reach the field, and the unit suite asserts
 * that this list and the mapper's actual output stay in agreement.
 */
export const SLUG_FIELD_ICONS = [
  "check",
  "x",
  "lock",
  "alert-circle",
  "loader-circle",
] as const;

export type SlugFieldIcon = (typeof SLUG_FIELD_ICONS)[number];

/**
 * `muted` is not a neutral fallback — it is a deliberate signal that nothing is
 * wrong with what the merchant typed. It is used for `idle`, `checking` and
 * `unavailable`, the three states where the address itself is not at fault.
 */
export type SlugFieldTone = "muted" | "success" | "destructive";

export type SlugFieldStateName =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "reserved"
  | "invalid"
  | "unavailable";

/**
 * What the form knows about the address at this instant.
 *
 * `undefined` — nothing typed, or below the 3-character minimum, so no check
 *               has been fired.
 * `{ pending: true }` — a request is in flight.
 * `SlugStatus` — the latest non-stale answer from the server.
 */
export type SlugCheck = undefined | { pending: true } | SlugStatus;

export interface SlugFieldState {
  state: SlugFieldStateName;
  /** `null` only in the idle state; every other state carries icon AND text. */
  icon: SlugFieldIcon | null;
  tone: SlugFieldTone;
  message: string;
  /**
   * Whether the primary CTA must be disabled.
   *
   * Presentational only. The authoritative gates are `storeSlugSchema` inside
   * `signUpMerchant` and the `beforeCreateOrganization` hook, both of which a
   * caller bypassing this form still hits (T-01-48).
   */
  submitDisabled: boolean;
}

function isPending(check: SlugCheck): check is { pending: true } {
  return check !== undefined && "pending" in check;
}

/**
 * @param check the current knowledge about the typed address
 * @param host  the full hostname the merchant would receive
 *              (`maboutique.einort.com`). Only read in the `available` state.
 */
export function slugFieldState(
  check: SlugCheck,
  host?: string,
): SlugFieldState {
  if (check === undefined) {
    return {
      state: "idle",
      icon: null,
      tone: "muted",
      message: strings.signup.slugIdle,
      // Nothing has been checked yet, so there is nothing to submit.
      submitDisabled: true,
    };
  }

  if (isPending(check)) {
    return {
      state: "checking",
      icon: "loader-circle",
      tone: "muted",
      message: strings.signup.slugChecking,
      submitDisabled: true,
    };
  }

  switch (check.status) {
    case "available":
      return {
        state: "available",
        icon: "check",
        tone: "success",
        message: strings.signup.slugAvailable.replace("{host}", host ?? ""),
        submitDisabled: false,
      };

    case "taken":
      return {
        state: "taken",
        icon: "x",
        tone: "destructive",
        message: check.message,
        submitDisabled: true,
      };

    case "reserved":
      return {
        state: "reserved",
        icon: "lock",
        tone: "destructive",
        message: check.message,
        submitDisabled: true,
      };

    case "invalid":
      return {
        state: "invalid",
        icon: "alert-circle",
        tone: "destructive",
        message: check.message,
        submitDisabled: true,
      };

    /**
     * FAIL OPEN. This is the row that inverts the pattern of every other
     * failing status, and it is the one a future edit is most likely to
     * "correct" into a disabled button.
     *
     * The availability check is UX. The server is the authority: a reserved,
     * taken or malformed slug is refused by `beforeCreateOrganization`
     * regardless of what this field ever displayed. So when the check itself
     * cannot run — the caller is throttled, or the request failed in transit —
     * the merchant must still be allowed to try, and the submit will simply be
     * refused with a field error if the address really is unavailable.
     *
     * Disabling here would turn a degraded checker into a total signup outage
     * (T-01-52), which is a strictly worse failure than an occasional
     * server-side rejection. Tone is `muted`, not `destructive`, for the same
     * reason: nothing is wrong with the address the merchant typed.
     */
    case "rate-limited":
      return {
        state: "unavailable",
        icon: "alert-circle",
        tone: "muted",
        message: check.message,
        submitDisabled: false,
      };
  }
}
