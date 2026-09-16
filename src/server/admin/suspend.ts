import "server-only";

import { strings } from "@/lib/strings";
import { postSystemMessageAsAdmin } from "@/server/admin/support";
import { adminDb } from "@/server/db/admin";
import { invalidateTenantHost } from "@/server/tenant/cache";

/**
 * ADM-01 / D-14..D-17 — the first and only write of `Organization.status`.
 *
 * ---------------------------------------------------------------------------
 * THIS IS THE ONLY MODULE IN `src/` THAT WRITES `Organization.status`. THIS
 * IS TESTED, NOT ASKED.
 * ---------------------------------------------------------------------------
 * `Organization.status` has been NOT NULL with a default of `"active"` since
 * Phase 1, and its schema comment has said "suspension is a Phase 6
 * admin-only write" the whole time. `tests/unit/single-org-status-writer.test.ts`
 * walks every `.ts`/`.tsx` file under `src/`, strips comments, and fails the
 * build if any file other than this one passes `status:` to an
 * `organization` create/update/upsert. The reason it is worth a build gate
 * rather than a review comment: `Organization.status` decides, on every
 * single request, whether the storefront resolver (`src/server/tenant/
 * resolve.ts`) and the merchant DAL (`src/server/merchant/context.ts`)
 * treat a store as open for business. A second writer that flips the
 * column without going through the two steps below would suspend or
 * restore a store that keeps serving anyway, or that has no record of why
 * it stopped — both silent, both invisible until a merchant asks.
 *
 * ---------------------------------------------------------------------------
 * THE REASON LIVES IN THE MERCHANT'S THREAD, NOT ON THIS ROW — AND THAT
 * MESSAGE IS THE AUDIT RECORD (ADM-04).
 * ---------------------------------------------------------------------------
 * `Organization` has no audit table, and this phase deliberately does not
 * add one: ADM-04 keeps the pilot's admin scope small, and a merchant reads
 * their own support thread, never a table only the platform owner can see.
 * So the D-15 `SYSTEM` message posted below — inside the SAME transaction as
 * the status flip — is not a courtesy CC, it is the only durable record that
 * a suspension or restoration happened and why. If this function ever wrote
 * the status without posting that message, there would be no way, for
 * anyone, to reconstruct when or why a store went down.
 *
 * ---------------------------------------------------------------------------
 * THE HOSTNAME CACHE EVICTION IS LOAD-BEARING, NOT A PERFORMANCE NICETY
 * (T-06-69).
 * ---------------------------------------------------------------------------
 * `src/server/tenant/cache.ts` caches a resolved tenant — including its
 * `status` — for `TTL_HIT_SECONDS` (300s). Without the
 * cache-eviction call below, a storefront that was
 * resolved and cached moments before a suspension would keep answering
 * requests as if nothing had happened, for up to five minutes — a
 * "suspended" store the merchant, and any customer, can still reach. That
 * call happens AFTER the transaction commits, never inside it: invalidating
 * a cache for a transaction that then rolls back would evict a still-valid
 * entry for no reason, whereas invalidating slightly late (the tiny window
 * between commit and this line) only ever costs a brief stale read — the
 * strictly safer direction to be wrong in.
 *
 * ---------------------------------------------------------------------------
 * `merchantId`, NOT `organizationId` — A DELIBERATE RENAME FROM THIS PLAN'S
 * OWN DRAFT INTERFACE.
 * ---------------------------------------------------------------------------
 * `tests/unit/no-tenant-id-param.test.ts` bans the literal identifiers
 * `tenantId`, `organizationId` and `storeId` from every exported signature
 * under `src/server/admin/**` — the admin zone reads through `adminDb`,
 * which is deliberately unscoped, so there is no tenant predicate
 * underneath to catch a substituted id; the signature IS the boundary. The
 * same rename already happened once in this codebase for the identical
 * reason: `src/server/admin/claims.ts`'s `listOrderClaimsForAdmin` filters
 * by `merchantId`, not `tenantId`, and says so in its own header. This
 * function follows that precedent rather than reintroducing the collision.
 *
 * ---------------------------------------------------------------------------
 * `actorUserId` IS ACCEPTED BUT NOT PERSISTED, AND THAT IS DELIBERATE
 * (ADM-04).
 * ---------------------------------------------------------------------------
 * Every other admin writer in this codebase threads the caller's
 * `ctx.userId` onto a column — `adminConfirmOrderClaim`'s
 * `reviewedByUserId`, `postPlatformMessage`'s `SupportMessage.authorUserId`.
 * `Organization` has no such column, and ADM-04 keeps this phase's scope
 * pilot-sized rather than adding one. The parameter still exists on this
 * signature — matching `suspend-actions.ts`'s Zod-validated actions, which
 * always source it from `ctx.userId` and never from a client payload — so
 * that a future `suspendedByUserId` column costs a one-line change to this
 * function's body, not a signature change at every call site. The
 * system-message writer's own header already states the complementary
 * half: a `SYSTEM` message names no human, by design.
 */

export interface SetOrganizationSuspendedArgs {
  readonly merchantId: string;
  /** The TARGET state. `true` suspends, `false` restores. */
  readonly suspend: boolean;
  /**
   * Required (10–280 chars, enforced by `suspend-actions.ts`'s Zod schema)
   * when `suspend` is `true` — it is interpolated into
   * `strings.support.system.suspended` and is what the merchant reads.
   * Ignored when `suspend` is `false`: `strings.support.system.restored`
   * carries no `{reason}` token, by design (R-2 — restoring is a safe
   * action and needs no justification the merchant must read).
   */
  readonly reason?: string;
  readonly actorUserId: string;
}

/**
 * Symmetric by construction (D-17): one function, one target status derived
 * from a boolean, so "suspend" and "un-suspend" cannot drift into two
 * half-matching code paths.
 */
export async function setOrganizationSuspended(
  args: SetOrganizationSuspendedArgs,
): Promise<void> {
  const { merchantId, suspend, reason } = args;
  const targetStatus = suspend ? "suspended" : "active";
  const trimmedReason = reason?.trim() ?? "";

  // Server-side floor, matching `transitionOrder`'s identical D-11 guard: the
  // Zod schema in `suspend-actions.ts` already enforces 10–280 characters,
  // but this function is the one place the rule cannot be silently skipped
  // by a caller that forgets to validate.
  if (suspend && trimmedReason.length === 0) {
    throw new Error(
      "setOrganizationSuspended: a suspension requires a non-empty reason.",
    );
  }

  const result = await adminDb.$transaction(async (tx) => {
    const organization = await tx.organization.findUniqueOrThrow({
      where: { id: merchantId },
      select: { id: true, slug: true, status: true },
    });

    // THE OPTIMISTIC GUARD, inside the transaction, before anything is
    // written. Two admin tabs closing the same store is the normal case,
    // not an attack (T-06-71) — the repeat call must write nothing: no
    // status update, no second system message.
    if (organization.status === targetStatus) {
      return { slug: organization.slug, changed: false as const };
    }

    await tx.organization.update({
      where: { id: organization.id },
      data: { status: targetStatus },
    });

    // D-15, in the SAME transaction as the status flip — see the header.
    const body = suspend
      ? strings.support.system.suspended.replace("{reason}", trimmedReason)
      : strings.support.system.restored;

    await postSystemMessageAsAdmin(merchantId, body, { tx });

    return { slug: organization.slug, changed: true as const };
  });

  if (!result.changed) return;

  // AFTER the transaction commits, never inside it — see the header.
  await invalidateTenantHost(result.slug);
}
