import { createHash, randomBytes } from "node:crypto";

/**
 * D-12 / T-03-38 — the customer's only key to their own order.
 *
 * Checkout is accountless by design: there is no login to attach an order to,
 * so the tracking link IS the authorisation. That makes the token a bearer
 * credential with no expiry and no second factor, and the two properties below
 * follow directly from that rather than from taste.
 *
 * ---------------------------------------------------------------------------
 * NO IMPORTS BUT `node:crypto`. THAT IS A CONSTRAINT, NOT AN ACCIDENT.
 * ---------------------------------------------------------------------------
 * This module is loaded by the database-free `unit` Vitest project, so it must
 * not reach a data layer, a marker package, or any transitive dependency that
 * does. It is also the reason there is no `server-only` marker here: nothing in
 * this file is a secret, and both functions are pure.
 *
 * ---------------------------------------------------------------------------
 * THE HASH IS UNSALTED ON PURPOSE. DO NOT "FIX" IT.
 * ---------------------------------------------------------------------------
 * A per-row salt is the correct answer for passwords and the wrong answer here,
 * for two independent reasons:
 *
 *   1. There is nothing to defend against. A salt exists to stop one precomputed
 *      dictionary from cracking many rows at once — and that attack needs the
 *      inputs to be guessable. The input here is 192 bits from a CSPRNG. There
 *      is no dictionary of those.
 *   2. It would break the lookup. Tracking a parcel means "find the order whose
 *      token hashes to this", which must be one indexed equality read against
 *      `Order.trackingTokenHash` under its global unique index. A per-row salt
 *      turns that into a full scan of every order on the platform, on a page
 *      an anonymous visitor can request repeatedly.
 *
 * Hashing AT REST is still worth doing, and that is the property being bought:
 * a database backup, a Studio session left open, or Phase 6's platform-wide
 * claims ledger cannot be turned into access to live customer orders. What
 * leaks in those scenarios is a digest, and a digest opens nothing.
 *
 * ---------------------------------------------------------------------------
 * THE ACCEPTED COST, STATED PLAINLY.
 * ---------------------------------------------------------------------------
 * The plaintext exists exactly once, in the value `placeOrder` returns, and is
 * never written to a column. So a merchant CANNOT re-send a customer their
 * tracking link — if the customer loses it, it is gone. That is a deliberate
 * trade and the remedy when it starts costing support time is a
 * regenerate-token action that mints a new value and overwrites the digest.
 * It is never a plaintext column: a column that exists to be re-read by a
 * merchant is a column an attacker reads too, and it would undo every reason
 * the digest is here.
 *
 * The other accepted residual (03-RESEARCH.md Pattern 6): the token travels in
 * a URL path, so it lands in Vercel's request logs. Bounded by log retention
 * and by who can read those logs, and the alternative — a POST-only tracking
 * form — costs the shareable link that makes the feature useful over WhatsApp.
 */

/**
 * A fresh 32-character base64url token.
 *
 * 24 bytes rather than 16 or 32: 24 encodes to exactly 32 base64url characters
 * with NO `=` padding, which keeps the token safe in a URL path segment without
 * anything having to strip or re-add anything. 192 bits is far past the point
 * where guessing is the attack anyone would choose.
 *
 * `randomBytes` and not the human-readable generator used for order numbers:
 * this value optimises for entropy and for being obviously a CSPRNG in review;
 * `newOrderNumber()` optimises for being read aloud. They are different jobs and
 * they get different tools.
 */
export function mintTrackingToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * The digest stored in `Order.trackingTokenHash`.
 *
 * 64 lowercase hex characters, deterministic, and the only form of the token
 * this system persists. SHA-256 rather than a password KDF for the reason in
 * the header: there is no low-entropy input here for a work factor to protect,
 * and the lookup this feeds runs on an anonymous request path where a
 * deliberately slow hash would be a denial-of-service lever pointed at
 * ourselves.
 */
export function hashTrackingToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
