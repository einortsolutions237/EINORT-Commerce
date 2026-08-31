"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { strings } from "@/lib/strings";
/*
 * Aliased at the import so the resolver's name appears exactly once in this
 * file — the same convention `src/app/s/[slug]/order/[token]/page.tsx` uses,
 * and here it doubles as the audit anchor for D-12: one call, one authorization
 * decision, no second way into an order.
 */
import { findOrderByTrackingToken as findOrder } from "@/server/orders/tracking";
/*
 * Namespace import on purpose: it keeps the limiter's name at the one line that
 * uses it, so a grep across `src/server` for that limiter returns a complete
 * list of the surfaces it protects with no import lines to read past.
 */
import * as rateLimit from "@/server/rate-limit";
import { resolveTenantBySlug } from "@/server/tenant/resolve";

import { isAllowedContentType, objectKeyFor, presignUpload } from "./r2";

/**
 * CHK-04 step 1 of 3 — mint a presigned PUT for a payment-claim screenshot,
 * for a caller who has no account and never will.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS BESIDE `src/server/images/actions.ts` INSTEAD OF INSIDE IT.
 * ---------------------------------------------------------------------------
 * 03-05's product-image mint is a `merchantAction`: it resolves a tenant from
 * the session and refuses anything a signed-in merchant cannot do. The caller
 * here is a customer standing in the street with a link from WhatsApp. They
 * have no session, so they cannot satisfy that wrapper, and the only honest
 * alternatives were this file or widening the merchant path's authorization to
 * accept "or a tracking token". The second is exactly the kind of one-more-
 * branch that turns a tenant boundary into a review item: every later reader of
 * that action would have to work out which of its two credentials was in force
 * on the line they were editing. Two narrow doors, each with one credential,
 * stay readable.
 *
 * ---------------------------------------------------------------------------
 * THE TOKEN IS THE ENTIRE AUTHORIZATION, SO EVERY FAILURE LOOKS THE SAME.
 * ---------------------------------------------------------------------------
 * An unknown store, a malformed token, an unknown token and another store's
 * perfectly valid token all return one identical refusal. `findOrder` already
 * collapses the last three into one `null` before this file sees them
 * (`src/server/orders/tracking.ts` carries the reasoning), and the store lookup
 * is collapsed into the same answer here. A distinguishable failure would turn
 * this endpoint into an oracle that says which tokens exist — for an endpoint
 * whose whole job is to hand out write grants against object storage, that is
 * the difference between a rate-limited nuisance and a map.
 *
 * ---------------------------------------------------------------------------
 * IT NEVER ACCEPTS A KEY, A PATH, OR THE NAME A BROWSER GAVE THE FILE.
 * ---------------------------------------------------------------------------
 * The key layout IS the tenant boundary in storage (T-03-23), so it is composed
 * here from the resolved tenant and an id this process generates. The name a
 * file carries on the customer's phone is the single input a browser controls
 * completely and every upload traversal bug ever written is the same sentence —
 * "we appended the name the user gave us". It is not sanitised here; it is
 * never sent.
 *
 * `"use server"` is the first line and there is deliberately no
 * `import "server-only"` beside it: the two markers are mutually exclusive, and
 * this module has to be reachable from the claim form's client island. The
 * transport helpers it calls live in `./r2.ts`, which IS `server-only`.
 */

/**
 * Ten megabytes, matching the product path's ceiling for the same reason.
 *
 * The browser declares the size and the browser can lie, but only once and only
 * against itself: `presignUpload` signs the declared value as `content-length`,
 * so R2 refuses any body that is not exactly that many bytes. Understating the
 * size to slip under this line mints a grant the real file cannot use.
 */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Everything a browser is permitted to influence. Note what is absent: no
 * tenant id, no key, no path, no file name.
 *
 * `slug` and `token` are not trusted as identity — the first is resolved
 * against Postgres and fails closed, and the second is matched against a digest
 * inside that store's scope.
 */
const requestClaimScreenshotUploadSchema = z.object({
  slug: z.string().min(1).max(64),
  token: z.string().min(1).max(64),
  contentType: z.string().min(1).max(128),
  byteSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

/**
 * The grant, or one refusal sentence the form can render inline.
 *
 * `uploadId` and nothing else identifies the object afterwards. The key is not
 * echoed back: a caller that never learns a key cannot present one, and the
 * finalize route recomputes it from the same two inputs rather than accepting
 * it (T-03-23).
 */
export type ClaimScreenshotUploadGrant =
  | { ok: true; uploadUrl: string; uploadId: string }
  | { ok: false; message: string };

/**
 * Mint a five-minute, one-key, one-content-type, one-byte-count write grant for
 * an anonymous customer holding a valid tracking link.
 */
export async function requestClaimScreenshotUpload(
  input: unknown,
): Promise<ClaimScreenshotUploadGrant> {
  /*
   * 1. Rate limit FIRST, before any database read. This is the one upload path
   *    reachable with no account at all, so an unthrottled mint endpoint is a
   *    free URL generator pointed at the project's bucket. It fails OPEN on an
   *    Upstash outage — a blip must degrade throttling, never stop a customer
   *    proving they paid.
   */
  const verdict = await rateLimit.uploadPresignLimiter.limit(
    rateLimit.callerIp(await headers()),
  );
  if (!verdict.success) {
    return { ok: false, message: strings.orderStatus.claimRateLimited };
  }

  const parsed = requestClaimScreenshotUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: strings.checkout.genericError };
  }

  const { slug, token, contentType, byteSize } = parsed.data;

  /*
   * 2. The store, then the order. Both failures are one answer — see the file
   *    header. `findOrder` is scoped to the resolved tenant, so another store's
   *    live token matches nothing here rather than matching and being filtered.
   */
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return { ok: false, message: strings.checkout.genericError };

  const order = await findOrder(tenant.id, token);
  if (!order) return { ok: false, message: strings.checkout.genericError };

  /*
   * 3. The allowlist, checked BEFORE signing, because the signature is what
   *    makes the content type binding: R2 compares the header the browser
   *    actually sends against the signed value and answers 403 on any other.
   *    Anything off the list simply never receives a grant.
   */
  if (!isAllowedContentType(contentType)) {
    return { ok: false, message: strings.checkout.genericError };
  }

  /*
   * 4. Server-generated, every time. This id is the only caller-facing segment
   *    of the key, and it is caller-facing only in the sense that the caller is
   *    told what it is afterwards — never that the caller chooses it.
   */
  const uploadId = crypto.randomUUID();
  const key = objectKeyFor(tenant.id, "claims", uploadId);
  const uploadUrl = await presignUpload(key, contentType, byteSize);

  return { ok: true, uploadUrl, uploadId };
}
